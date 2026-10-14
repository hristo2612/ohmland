// Pointer, touch and keyboard handling for the bench. One controller per <Bench>; it raycasts the hit proxies,
// drives drags through the store (inside an undo transaction) and leaves empty-space drags to the camera. Drag and
// drop feel and feedback (lift, marks, magnet, glide back, edge pan) are shared with the ink view through view/drag.ts.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { CameraControls as CameraControlsImpl } from "@react-three/drei";
import { parseAnchor } from "../anchors";
import { BOARD_PRINT, boardGeometry, boardOrigin, nearestHole } from "../board";
import { BOARD_TOP } from "../dims";
import { DIAL_MODES, METER, anchorPosition, clipTargets, fitCamera, meterLocalToWorld, nearestSocket, partPose, socketWorld, workCenter } from "../layout";
import { BOX, CARD } from "../dims";
import * as ops from "../ops";
import { penStroke, settingParams } from "../ops";
import { footprintOf, isThrowSwitch, partDef, rotateXZ } from "../parts";
import { holderOf } from "../seats";
import type { BenchStore } from "../store";
import type { Anchor, BenchAction, BenchState, MeterMode, Selection, TestLead, TrayItem, Vec2 } from "../types";
import { leadCable, makeFloor } from "./views";
import { PICK_LAYER, pickOf, type Pick } from "./pick";
import type { BenchLabels } from "../labels";
import { dragName, type LoupeFeed } from "../view/Loupe";
import {
  DRAG,
  LiftAnimator,
  NO_LIFT,
  dragMarks,
  easeOut,
  edgeVelocity,
  haptic,
  isHole,
  landed,
  partMisfit,
  reducedMotion,
  ringFor,
  type Covered,
  type DragMarksState,
  type Feed,
  type Lift,
  type Pt,
} from "../view/drag";

export type InteractionApi = {
  /** Start dragging a tray item from a DOM pointer event. */
  startSpawn: (item: TrayItem, e: PointerEvent) => void;
  /** Place an armed tray item at a client point (tap to place). */
  placeAt: (item: TrayItem, clientX: number, clientY: number) => boolean;
  topView: () => void;
  resetView: () => void;
  /** Client (page) coordinates of an anchor or world point, for tests and tutorials. */
  project: (target: Anchor | [number, number, number]) => { x: number; y: number } | null;
  /** Renderer statistics of the last frame (draw calls, triangles) for performance checks. */
  stats: () => { calls: number; triangles: number; geometries: number; textures: number };
  /** What the pointer would grab at a client point (for tests and tutorials). */
  pickAt: (clientX: number, clientY: number) => Pick | null;
  /** The desk point (mm) under an element-relative CSS px point. */
  deskAt: (x: number, y: number) => [number, number] | null;
};

type Drag =
  /**
   * `to`: where the part was last dragged (it goes into a holder's seat only when dropped there). `cable`: for a gate,
   * the lead drawn under the pointer there.
   */
  | { kind: "part"; id: string; offset: Vec2; spawned?: boolean; to?: Vec2; cable?: { lead: string; at: number } | null }
  | { kind: "leg"; id: string; leg: string; flying: boolean }
  | { kind: "wireEnd"; id: string; end: "a" | "b" }
  | { kind: "wireNew"; from: string }
  | { kind: "clip"; id: string; end: "a" | "b"; spawned?: boolean }
  | { kind: "probe"; color: "red" | "black" }
  | { kind: "plug"; color: "red" | "black" }
  | { kind: "meter"; offset: Vec2 }
  | { kind: "dial" }
  | { kind: "rotor"; id: string }
  | { kind: "press"; id: string }
  | { kind: "lead"; id: string }
  | { kind: "draw"; id: string; base: { length: number; layers: number }; reach: number };

type Gesture = {
  pointerId: number;
  x0: number;
  y0: number;
  pick: Pick | null;
  drag: Drag | null;
  moved: boolean;
  touch: boolean;
  longPress: number | null;
  /** Wire start chosen by this press (click-click wiring). */
  hole: string | null;
  /** CSS px from the pointer to the dragged item's hot point (where it lands): kept from where it was grabbed. */
  off: [number, number];
  /** When the drag began (ms): the lift eases in from here (and, on touch, the rise above the finger). */
  dragAt: number;
  /** The last pointer position (client px), to run the drag again as the view pans or the item rises. */
  last: [number, number] | null;
  /** The drop would not take where the item is now (a part over the board where it fits nowhere, the tray). */
  invalid: boolean;
  /** Escape (or a glide back) ended it: the pointer is ignored until it lifts. */
  done: boolean;
  /** When the pointer came into the edge band (ms), for edge auto-pan. */
  edgeAt: number | null;
  /** A press on a switch already flipped it (a short drag on its lever). */
  flipped?: boolean;
  /** A tray item being taken out: where it sits on screen (client px), and the take-out still waiting to happen. */
  home?: [number, number];
  spawn?: (() => boolean) | null;
};

const UP = new THREE.Vector3(0, 1, 0);

/** Drags that carry something to a new place (they lift, show where they land, glide back, pan at the edge). */
const carries = (d: Drag | null): boolean =>
  !!d && (d.kind === "part" || d.kind === "leg" || d.kind === "wireEnd" || d.kind === "clip" || d.kind === "probe" || d.kind === "plug" || d.kind === "meter" || d.kind === "wireNew");

/** Drags a finger lifts above itself (small things it would hide; not the meter, a dial or a knob). */
const rises = (d: Drag | null): boolean => !!d && carries(d) && d.kind !== "meter" && d.kind !== "wireNew";

export function useInteraction({
  store,
  element,
  readOnly,
  api,
  emit,
  viewPad,
  view,
  loupe,
  marks,
}: {
  store: BenchStore;
  element: HTMLElement | null;
  readOnly: boolean;
  api: React.MutableRefObject<InteractionApi | null>;
  emit: (a: BenchAction) => void;
  /** Pixels covered by overlay panels, so camera fits avoid them (and edge auto-pan keeps off the tray). */
  viewPad: React.MutableRefObject<{ left: number; bottom: number }>;
  /** Camera framing from the view rig (home view, focus on targets). */
  view?: React.MutableRefObject<{ home(top: boolean, smooth?: boolean): void; focus(targets: string[]): void } | null>;
  /** The touch loupe (view/Loupe.tsx): fed while a finger drags, cleared when it lifts. */
  loupe?: { feed: LoupeFeed; labels: () => BenchLabels };
  /** Where a drag would land (view/DragMarks.tsx): fed while something is dragged. */
  marks?: Feed<DragMarksState>;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as CameraControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const gesture = useRef<Gesture | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const hoverFrame = useRef<number | null>(null);

  useEffect(() => {
    if (!element) return;
    const rc = raycaster.current;
    rc.layers.set(PICK_LAYER);

    const ndc = (cx: number, cy: number) => {
      const r = element.getBoundingClientRect();
      return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    };
    const ray = (cx: number, cy: number) => {
      rc.setFromCamera(ndc(cx, cy), camera);
      return rc.ray;
    };
    const planePoint = (cx: number, cy: number, y: number): THREE.Vector3 | null => {
      const p = new THREE.Vector3();
      return ray(cx, cy).intersectPlane(new THREE.Plane(UP, -y), p);
    };
    const bench = () => store.getState().bench;
    /** Point under the pointer on the board top when over the board, else on the desk. */
    const workPoint = (cx: number, cy: number): THREE.Vector3 | null => {
      const b = bench();
      if (b.board) {
        const p = planePoint(cx, cy, BOARD_TOP);
        if (p) {
          const g = boardGeometry(b.board);
          const [ox, oz] = boardOrigin(b.board);
          if (Math.abs(p.x - ox) <= g.width / 2 + 2 && Math.abs(p.z - oz) <= g.depth / 2 + 2) return p;
        }
      }
      return planePoint(cx, cy, 0);
    };
    // Small handles (leads, buttons, clips, plugs) sit inside bigger body proxies; they win over the body.
    const PRIORITY: Record<Pick["type"], number> = {
      press: 3,
      flip: 3,
      setting: 3,
      draw: 1.5,
      rotor: 3,
      leg: 3,
      wireEnd: 3,
      clip: 2,
      plug: 2,
      probe: 2,
      dialMode: 3,
      range: 3,
      dial: 2,
      part: 1,
      wire: 1,
      meter: 0,
    };
    /** The hit proxies, gathered once per pick (several rays then test only them). */
    const proxies = (): THREE.Object3D[] => {
      const out: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.layers.test(rc.layers) && (o.userData as { pick?: Pick }).pick) out.push(o);
      });
      return out;
    };
    const hitIn = (cx: number, cy: number, list: THREE.Object3D[]): Pick | null => {
      rc.setFromCamera(ndc(cx, cy), camera);
      const hits = rc.intersectObjects(list, false);
      let best: Pick | null = null;
      let bestScore = -Infinity;
      const nearest = hits[0]?.distance ?? 0;
      const seen: Pick[] = [];
      for (const h of hits) {
        const p = pickOf(h.object);
        if (!p) continue;
        // Prefer handles, but only among things close to the nearest hit (do not reach through a whole part).
        // A probe's tip end gives way to a pencil card's drawing strip under it (the grip does not).
        const rank = p.type === "probe" && p.tip ? 1.4 : PRIORITY[p.type];
        const score = rank * 100 - (h.distance - nearest);
        if (h.distance - nearest > 40) break;
        seen.push(p);
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      // A part sitting in a holder (a resistor in the reject bin) is picked before the holder around it.
      if (best?.type === "part") {
        const holder = best.id;
        const inside = seen.find((p) => p.type === "part" && p.id !== holder && holderOf(bench(), p.id)?.holder.id === holder);
        if (inside) return inside;
      }
      return best;
    };
    /**
     * What the pointer would grab. Nothing right under it: the nearest thing within the grab padding (rings of rays
     * round the pointer), so every handle has a comfortable target without being drawn bigger.
     */
    const hit = (cx: number, cy: number, touch = false): Pick | null => {
      const list = proxies();
      const direct = hitIn(cx, cy, list);
      if (direct) return direct;
      const R = touch ? DRAG.grabTouch : DRAG.grabMouse;
      for (const r of [R * 0.4, R * 0.7, R]) {
        let best: Pick | null = null;
        let bestRank = -Infinity;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const p = hitIn(cx + r * Math.cos(a), cy + r * Math.sin(a), list);
          const rank = p ? PRIORITY[p.type] : -Infinity;
          if (p && rank > bestRank) {
            bestRank = rank;
            best = p;
          }
        }
        if (best) return best;
      }
      return null;
    };
    const holeAt = (cx: number, cy: number): string | null => {
      const b = bench();
      if (!b.board) return null;
      const p = planePoint(cx, cy, BOARD_TOP);
      return p ? nearestHole(b.board, p.x, p.z, 1.6) : null;
    };
    const toScreen = (p: [number, number, number]) => {
      const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
      const r = element.getBoundingClientRect();
      return { x: ((v.x + 1) / 2) * r.width + r.left, y: ((1 - v.y) / 2) * r.height + r.top, behind: v.z > 1 };
    };
    /** The drop point nearest the hot point (a magnet), and the other drop points near it that glow. */
    const snapTarget = (cx: number, cy: number, touch: boolean, opts: { probes?: boolean; leads?: boolean; exclude?: string }): { to: Anchor | null; near: Pt[] } => {
      const b = bench();
      const targets = clipTargets(b, { holes: true, probes: opts.probes, leads: opts.leads }).filter(
        // Never onto something that already hangs off the thing being dragged (a probe touching this clip, say).
        (t) => !opts.exclude || !(t.kind === "probe" || t.kind === "lead") || !hangsOn(b, t.anchor, opts.exclude),
      );
      const radius = touch ? DRAG.touchSnap : DRAG.mouseSnap;
      const r = element.getBoundingClientRect();
      let best: Anchor | null = null;
      let bestD: number = radius;
      const near: { p: Pt; d: number; a: Anchor }[] = [];
      for (const t of targets) {
        if (opts.exclude && t.anchor.startsWith(opts.exclude)) continue;
        const s = toScreen(t.pos);
        if (s.behind) continue;
        const raw = Math.hypot(s.x - cx, s.y - cy);
        // Leads and wire ends win over the hole underneath them.
        const bonus = t.kind === "hole" ? 0 : 9;
        const d = raw - bonus;
        if (d < bestD) {
          bestD = d;
          best = t.anchor;
        }
        if (t.kind !== "hole" && raw < DRAG.near) near.push({ p: { x: s.x - r.left, y: s.y - r.top }, d: raw, a: t.anchor });
      }
      return { to: best, near: near.filter((n) => n.a !== best && !isHole(n.a)).sort((a, b) => a.d - b.d).slice(0, 8).map((n) => n.p) };
    };
    const setUi = store.getState().setUi;
    const lockCamera = (lock: boolean) => {
      if (controls) controls.enabled = !lock;
    };

    const partCenter = (id: string): Vec2 | null => {
      const b = bench();
      const p = b.parts.find((x) => x.id === id);
      return p ? ops.partCenter(b, p) : null;
    };
    /** A client point the bench does not take a drop at: off the bench, or over its chrome (the tray, the toolbar). */
    const offBench = (cx: number, cy: number): boolean => {
      const r = element.getBoundingClientRect();
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return true;
      return !!(document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest?.("[data-bench-ui]");
    };

    // ---- A part lifted off the bench ---------------------------------------------------------------------------
    /** The model a dragged part draws with, while it is in hand (looked up again if React remounts it). */
    let liftObj: { id: string; o: THREE.Object3D } | null = null;
    const applyLift = (id: string, l: Lift | null) => {
      if (!liftObj || liftObj.id !== id || !liftObj.o.parent) {
        const o = scene.getObjectByName(`part:${id}`);
        liftObj = o ? { id, o } : null;
      }
      const o = liftObj?.o;
      if (!o) return;
      if (!l) {
        o.position.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        liftObj = null;
      } else {
        // The part's own frame is the desk's: scale it round its middle, and raise it a few mm off the bench.
        const c = partCenter(id) ?? [0, 0];
        o.scale.setScalar(l.k);
        o.position.set(l.dx + c[0] * (1 - l.k), l.h * 3, l.dz + c[1] * (1 - l.k));
      }
      invalidate();
    };
    const lifter = new LiftAnimator(applyLift);

    let active: Gesture | null = null;
    let tickFrame = 0;
    /** A glide back running through the store (a clip or probe going home): finished at once by the next press. */
    let glide: { frame: number; end: () => void } | null = null;

    const newGesture = (e: { pointerId: number; clientX: number; clientY: number }, touch: boolean, pick: Pick | null): Gesture => ({
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      pick,
      drag: null,
      moved: false,
      touch,
      longPress: null,
      hole: null,
      off: [0, 0],
      dragAt: 0,
      last: null,
      invalid: false,
      done: false,
      edgeAt: null,
    });

    /** 0 to 1: how far the lift has come since the drag began (all the way at once under reduced motion). */
    const liftT = (g: Gesture) => (reducedMotion() ? 1 : easeOut(Math.min(1, (performance.now() - g.dragAt) / DRAG.liftMs)));
    /** The dragged item's hot point (client px): the pointer, plus where it was grabbed, raised above a finger. */
    const hotOf = (g: Gesture, cx: number, cy: number): [number, number] => {
      if (!rises(g.drag)) return [cx, cy];
      return [cx + g.off[0], cy + g.off[1] - (g.touch ? DRAG.touchLift * liftT(g) : 0)];
    };

    const finishGlide = () => {
      if (glide) {
        cancelAnimationFrame(glide.frame);
        const end = glide.end;
        glide = null;
        end();
      }
      lifter.finish();
    };

    /** Runs `step(t)` for t from 0 to 1 over `ms` (once, at 1, under reduced motion), then `end`. */
    const animate = (ms: number, step: (t: number) => void, end: () => void) => {
      finishGlide();
      if (reducedMotion()) {
        step(1);
        end();
        return;
      }
      const t0 = performance.now();
      const g = { frame: 0, end };
      const frame = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        step(easeOut(t));
        invalidate();
        if (t >= 1) {
          glide = null;
          end();
          return;
        }
        g.frame = requestAnimationFrame(frame);
      };
      glide = g;
      g.frame = requestAnimationFrame(frame);
    };

    const beginDrag = (g: Gesture, cx: number, cy: number): Drag | null => {
      const p = g.pick;
      if (!p) return null;
      const b = bench();
      const locked = store.getState().locked;
      switch (p.type) {
        case "part":
        case "press":
        case "flip":
        // A tap on a setting spot (a tag, a torn piece) changes it; a drag from there moves the part, as in ink.
        case "setting":
          if (p.type === "press") return { kind: "press", id: p.id };
          if (locked.includes(p.id)) return null;
          {
            const c = partCenter(p.id);
            const wp = workPoint(cx, cy);
            if (!c || !wp) return null;
            return { kind: "part", id: p.id, offset: [wp.x - c[0], wp.z - c[1]] };
          }
        case "rotor":
          return { kind: "rotor", id: p.id };
        case "draw": {
          const card = b.parts.find((x) => x.id === p.id);
          if (card?.kind !== "card") return null;
          return { kind: "draw", id: p.id, base: { length: card.params.length, layers: card.params.layers }, reach: 0 };
        }
        case "leg":
          if (locked.includes(p.id)) return null;
          return { kind: "leg", id: p.id, leg: p.leg, flying: p.flying };
        case "wire":
          return null;
        case "wireEnd":
          return { kind: "wireEnd", id: p.id, end: p.end };
        case "clip":
          return { kind: "clip", id: p.id, end: p.end };
        case "probe":
          return { kind: "probe", color: p.color };
        case "plug":
          return { kind: "plug", color: p.color };
        case "meter": {
          const wp = planePoint(cx, cy, 0);
          if (!wp || !b.meter) return null;
          return { kind: "meter", offset: [wp.x - b.meter.pos[0], wp.z - b.meter.pos[1]] };
        }
        case "dial":
        case "dialMode":
          return { kind: "dial" };
        case "range":
          return null;
      }
    };

    /** Where the dragged thing is on screen now (client px), so a grab keeps its hold on it instead of jumping. */
    const itemAt = (d: Drag): [number, number] | null => {
      const anchor =
        d.kind === "clip" ? `lead:${d.id}.${d.end}` : d.kind === "probe" ? `probe:${d.color}` : d.kind === "wireEnd" ? `wire:${d.id}.${d.end}` : d.kind === "leg" ? `pin:${d.id}.${d.leg}` : null;
      const p = anchor ? anchorPosition(bench(), anchor) : null;
      if (!p) return null;
      const s = toScreen(p);
      return s.behind ? null : [s.x, s.y];
    };

    const dialModeAt = (cx: number, cy: number): MeterMode | null => {
      const m = bench().meter;
      if (!m) return null;
      const p = planePoint(cx, cy, METER.face);
      if (!p) return null;
      const c = meterLocalToWorld(m, [0, METER.face, METER.dial.z]);
      const [lx, lz] = rotateXZ(p.x - c[0], p.z - c[2], -m.rot);
      if (Math.hypot(lx, lz) < 3) return null;
      let a = Math.atan2(lx, -lz);
      if (a < 0) a += Math.PI * 2;
      const i = Math.round(a / ((Math.PI * 2) / DIAL_MODES.length)) % DIAL_MODES.length;
      return DIAL_MODES[i]!;
    };

    /** Cable points as the 3D view draws them, per lead object (they change only when the lead does). */
    const cables = new WeakMap<TestLead, THREE.Vector3[]>();
    let floorFor: { board: BenchState["board"]; meter: BenchState["meter"]; floor: ReturnType<typeof makeFloor> } | null = null;
    /**
     * For a gate whose clamp is dragged to the desk point `to`: the clip lead whose cable, as drawn, passes nearest the
     * clamp on screen, and how far along it by length (the cable bows well off the line between its clips, so the
     * straight-line test in ops can pick the wrong lead mid-span).
     */
    const cableAt = (id: string, to: Vec2, touch: boolean): { lead: string; at: number } | null => {
      const b = bench();
      if (b.parts.find((p) => p.id === id)?.kind !== "gate") return null;
      const clamp = toScreen([to[0], 2, to[1]]);
      const [cx, cy] = [clamp.x, clamp.y];
      if (!floorFor || floorFor.board !== b.board || floorFor.meter !== b.meter) floorFor = { board: b.board, meter: b.meter, floor: makeFloor(b) };
      const reach = touch ? 36 : 22;
      let best: { lead: string; at: number } | null = null;
      let bestD = reach;
      for (const l of b.leads) {
        let pts = cables.get(l);
        if (!pts) {
          pts = leadCable(b, l, floorFor.floor).cable;
          cables.set(l, pts);
        }
        let total = 0;
        for (let i = 1; i < pts.length; i++) total += pts[i]!.distanceTo(pts[i - 1]!);
        if (total <= 0) continue;
        // Each stretch of the cable on screen: the clamp's distance to it, and how far along the cable that is.
        let run = 0;
        let prev = toScreen([pts[0]!.x, pts[0]!.y, pts[0]!.z]);
        for (let i = 1; i < pts.length; i++) {
          const len = pts[i]!.distanceTo(pts[i - 1]!);
          const sp = toScreen([pts[i]!.x, pts[i]!.y, pts[i]!.z]);
          if (!sp.behind && !prev.behind) {
            const vx = sp.x - prev.x;
            const vy = sp.y - prev.y;
            const l2 = vx * vx + vy * vy;
            const k = l2 ? Math.max(0, Math.min(1, ((cx - prev.x) * vx + (cy - prev.y) * vy) / l2)) : 0;
            const d = Math.hypot(prev.x + vx * k - cx, prev.y + vy * k - cy);
            const t = (run + len * k) / total;
            if (d < bestD && t >= 0.05 && t <= 0.95) {
              bestD = d;
              best = { lead: l.id, at: Math.round(Math.max(0.15, Math.min(0.85, t)) * 100) / 100 };
            }
          }
          run += len;
          prev = sp;
        }
      }
      return best;
    };

    /** Draws a dragged part where the pointer holds it, off the place the state gives it (a magnet near it, with a mouse). */
    const liftPart = (g: Gesture, id: string, to: Vec2) => {
      const c = partCenter(id) ?? to;
      let dx = to[0] - c[0];
      let dz = to[1] - c[1];
      if (!g.touch) {
        const a = toScreen([to[0], BOARD_TOP, to[1]]);
        const b = toScreen([c[0], BOARD_TOP, c[1]]);
        if (Math.hypot(a.x - b.x, a.y - b.y) < DRAG.mouseSnap) dx = dz = 0;
      }
      const t = liftT(g);
      lifter.set(id, { dx, dz, k: 1 + (DRAG.liftScale - 1) * t, h: t });
    };

    /** CSS px between neighbouring holes (2.54 mm) on the desk under a client point. */
    const pitchAt = (cx: number, cy: number): number => {
      const p = workPoint(cx, cy);
      if (!p) return 10;
      const a = toScreen([p.x, p.y, p.z]);
      const b = toScreen([p.x + 2.54, p.y, p.z]);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    /** Feeds the marks (and the loupe, on touch) for the drag at hot point (hx, hy). */
    const feedback = (g: Gesture, hx: number, hy: number, near: Pt[] = []) => {
      const d = g.drag;
      if (!d) return;
      const st = store.getState();
      const r = element.getBoundingClientRect();
      const [lx, ly] = [hx - r.left, hy - r.top];
      if (marks && loupe && carries(d) && d.kind !== "meter" && d.kind !== "wireNew" && d.kind !== "lead") {
        const m = dragMarks(st.bench, { kind: d.kind, id: "id" in d ? d.id : undefined, leg: d.kind === "leg" ? d.leg : undefined, end: "end" in d ? d.end : undefined, color: "color" in d ? d.color : undefined }, {
          snap: st.ui.snapTarget,
          hot: { x: lx, y: ly },
          invalid: g.invalid,
          near,
          labels: loupe.labels(),
          r: ringFor(pitchAt(hx, hy)),
          project: (a) => {
            const p = anchorPosition(st.bench, a);
            if (!p) return null;
            const s = toScreen(p);
            return s.behind ? null : { x: s.x - r.left, y: s.y - r.top };
          },
        });
        // Under a finger the loupe names the drop point.
        if (g.touch) m.name = null;
        marks.set(m);
      }
      // A finger hides what it touches: the loupe shows it, and names where a drop would land.
      if (g.touch && loupe && (d.kind === "clip" || d.kind === "probe" || d.kind === "part" || d.kind === "leg" || d.kind === "wireEnd")) {
        loupe.feed.set({ x: lx, y: ly, name: dragName(st.bench, d as Parameters<typeof dragName>[1], st.ui.snapTarget, loupe.labels()) });
      }
    };
    const clearFeedback = () => {
      loupe?.feed.set(null);
      marks?.set(null);
    };

    const dragMove = (g: Gesture, cx: number, cy: number) => {
      const d = g.drag!;
      g.last = [cx, cy];
      if (g.done) return;
      const s = store.getState();
      const [hx, hy] = hotOf(g, cx, cy);
      let near: Pt[] = [];
      g.invalid = carries(d) && d.kind !== "wireNew" && offBench(hx, hy);
      switch (d.kind) {
        case "part": {
          const wp = workPoint(hx, hy);
          if (!wp) return;
          // On its way it never sits in a holder: passing over a full bin must not push a part out of it. A gate
          // clips onto the cable drawn under the pointer (else the straight-line test in ops decides).
          const to: Vec2 = [wp.x - d.offset[0], wp.z - d.offset[1]];
          d.to = to;
          d.cable = cableAt(d.id, to, g.touch);
          const cable = d.cable;
          s.apply((b) => (cable ? ops.clipGate(b, d.id, to, cable) : ops.movePart(b, d.id, to, { seat: false })));
          g.invalid ||= partMisfit(bench(), d.id, to);
          liftPart(g, d.id, to);
          break;
        }
        case "leg": {
          const wp = workPoint(hx, hy);
          if (!wp) return;
          s.apply((b) => (d.flying ? ops.moveFlyingLeg(b, d.id, d.leg, [wp.x, wp.z]) : ops.moveSpanLeg(b, d.id, d.leg, [wp.x, wp.z])));
          break;
        }
        case "wireEnd": {
          const wp = workPoint(hx, hy);
          if (!wp) return;
          s.apply((b) => ops.moveWireEnd(b, d.id, d.end, [wp.x, wp.z]));
          break;
        }
        case "wireNew": {
          const h = holeAt(cx, cy);
          const wp = workPoint(cx, cy);
          setUi({ wireDraft: { from: d.from, to: wp ? [wp.x, wp.y, wp.z] : null, target: h && h !== d.from ? h : null } });
          break;
        }
        case "clip": {
          const t = snapTarget(hx, hy, g.touch, { probes: true, exclude: `lead:${d.id}.` });
          near = t.near;
          const wp = planePoint(hx, hy, 0);
          setUi({ snapTarget: t.to });
          s.apply((b) => ops.clipLead(b, d.id, d.end, t.to, wp ? [wp.x, wp.z] : undefined));
          break;
        }
        case "probe": {
          // Probe tips land on leads, holes, clips (even one lying loose) or the other probe's tip.
          const t = snapTarget(hx, hy, g.touch, { leads: true, probes: true, exclude: `probe:${d.color}` });
          near = t.near;
          const wp = planePoint(hx, hy, 0);
          setUi({ snapTarget: t.to });
          s.apply((b) => ops.touchProbe(b, d.color, t.to, wp ? [wp.x, wp.z] : undefined));
          break;
        }
        case "plug": {
          const m = s.bench.meter;
          const wp = planePoint(hx, hy, m ? METER.face : 0) ?? planePoint(hx, hy, 0);
          if (!m || !wp) return;
          let sock = nearestSocket(m, wp.x, wp.z, 10);
          // Passing over the other plug's socket must not knock it out.
          if (sock && m.probes[d.color === "red" ? "black" : "red"].socket === sock) sock = null;
          const desk = planePoint(hx, hy, 0);
          s.apply((b) => ops.plugProbe(b, d.color, sock, desk ? [desk.x, desk.z] : undefined));
          break;
        }
        case "meter": {
          const wp = planePoint(cx, cy, 0);
          if (!wp) return;
          s.apply((b) => ops.moveMeter(b, [wp.x - d.offset[0], wp.z - d.offset[1]]));
          break;
        }
        case "dial": {
          const mode = dialModeAt(cx, cy);
          if (mode) s.apply((b) => ops.setMeterMode(b, mode));
          break;
        }
        case "draw": {
          // The pencil runs from the card's 0 mark to the farthest point the stroke reaches (0.5 cm steps).
          const card = s.bench.parts.find((p) => p.id === d.id);
          if (card?.kind !== "card") return;
          const wp = planePoint(cx, cy, CARD.t);
          if (!wp) return;
          const [lx] = rotateXZ(wp.x - card.pos[0], wp.z - card.pos[1], -card.rot);
          d.reach = Math.max(d.reach, Math.max(0, Math.min(10, Math.round(((lx - CARD.x0) / 10) * 2) / 2)));
          const next = penStroke(d.base, d.reach);
          if (next.length !== card.params.length || next.layers !== card.params.layers) s.apply((b) => ops.setPartParams<"card">(b, d.id, next));
          break;
        }
        case "rotor": {
          const b = s.bench;
          const part = b.parts.find((p) => p.id === d.id);
          if (!part) return;
          const pose = partPose(b, part);
          // A box's knob sits on its front strip: turn round the knob, not the box's middle.
          const c: [number, number] =
            part.kind === "box"
              ? ((([x, z]) => [part.pos[0] + x, part.pos[1] + z] as [number, number])(rotateXZ(0, BOX.d / 2 - BOX.strip / 2, pose.rot)))
              : ops.partCenter(b, part);
          const wp = planePoint(cx, cy, pose.origin[1] + 5);
          if (!wp) return;
          const [lx, lz] = rotateXZ(wp.x - c[0], wp.z - c[1], -pose.rot);
          let a = Math.atan2(lx, -lz); // clockwise from "up"
          a = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75, a));
          const position = Math.round((a / (Math.PI * 1.5) + 0.5) * 100) / 100;
          s.apply((bb) => ops.setPartParams(bb, d.id, { position }));
          break;
        }
        default:
          break;
      }
      feedback(g, hx, hy, near);
      invalidate();
    };

    /** Pans the camera along the desk by (vx, vy) CSS px (edge auto-pan): the desk point under the middle follows. */
    const panBy = (vx: number, vy: number) => {
      if (!controls) return;
      const r = element.getBoundingClientRect();
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      const a = planePoint(mx, my, 0);
      const b = planePoint(mx + vx, my + vy, 0);
      if (!a || !b) return;
      const t = controls.getTarget(new THREE.Vector3(), false);
      void controls.moveTo(t.x + (b.x - a.x), t.y, t.z + (b.z - a.z), false);
      invalidate();
    };

    /** Each frame while something is carried: the item rises into place, and near an edge the view pans toward it. */
    const startTick = () => {
      if (tickFrame) return;
      const tick = () => {
        tickFrame = 0;
        const g = active;
        if (!g || g.done || !carries(g.drag) || !g.last) {
          if (g && !g.done && g.spawn) tickFrame = requestAnimationFrame(tick);
          if (g?.spawn && g.last) g.spawn();
          return;
        }
        const now = performance.now();
        let again = now - g.dragAt < DRAG.liftMs + 40;
        const r = element.getBoundingClientRect();
        const [vx, vy] = edgeVelocity(g.last[0] - r.left, g.last[1] - r.top, r.width, r.height, viewPad.current as Covered);
        if (vx || vy) {
          g.edgeAt ??= now;
          if (now - g.edgeAt > DRAG.edgeDwell) {
            panBy(vx, vy);
            again = true;
          }
        } else g.edgeAt = null;
        if (again) dragMove(g, g.last[0], g.last[1]);
        tickFrame = requestAnimationFrame(tick);
      };
      tickFrame = requestAnimationFrame(tick);
    };
    const stopTick = () => {
      if (tickFrame) cancelAnimationFrame(tickFrame);
      tickFrame = 0;
    };

    /** The desk point (x, z) under a client point, for glides. */
    const deskUnder = (cx: number, cy: number): Vec2 | null => {
      const p = planePoint(cx, cy, 0);
      return p ? [p.x, p.z] : null;
    };

    /** A drag that does not take (or Escape): the item glides back to where it came from, and nothing changes. */
    const glideBack = (g: Gesture) => {
      const d = g.drag;
      const s = store.getState();
      g.done = true;
      clearFeedback();
      stopTick();
      lockCamera(false);
      setUi({ snapTarget: null, dragging: false });
      element.style.cursor = "";
      if (!d || !s.txBase) {
        if (s.txBase) s.cancel();
        invalidate();
        return;
      }
      const base = s.txBase;
      const homeAt = (fallback: Vec2): Vec2 => (g.home ? (deskUnder(g.home[0], g.home[1]) ?? fallback) : fallback);
      if (d.kind === "part") {
        const now = partCenter(d.id) ?? [0, 0];
        const free = d.to ?? now;
        const cur = lifter.cur;
        if (d.spawned) {
          // Back into the tray: it glides to its slot there and is gone.
          const home = homeAt(free);
          lifter.set(d.id, { dx: free[0] - now[0], dz: free[1] - now[1], k: cur.k, h: cur.h });
          lifter.to(d.id, { dx: home[0] - now[0], dz: home[1] - now[1], k: 0.6, h: 0 }, DRAG.glideMs, () => {
            lifter.clear();
            if (store.getState().txBase) store.getState().cancel();
            invalidate();
          });
          return;
        }
        s.cancel();
        const back = partCenter(d.id) ?? free;
        lifter.set(d.id, { dx: free[0] - back[0], dz: free[1] - back[1], k: cur.k, h: cur.h });
        lifter.to(d.id, NO_LIFT, DRAG.glideMs);
        return;
      }
      // Clips, probe tips and plugs glide through the store, then the drag's transaction is dropped.
      const from = g.last ? deskUnder(...hotOf(g, g.last[0], g.last[1])) : null;
      let path: ((t: number) => void) | null = null;
      if (from && d.kind === "clip") {
        const e = base.leads.find((x) => x.id === d.id)?.[d.end];
        let to: Vec2 | null = null;
        if (d.spawned) to = homeAt(from);
        else if (e?.to) {
          const p = anchorPosition(base, e.to);
          to = p ? [p[0], p[2]] : null;
        } else if (e) to = e.pos;
        if (to) {
          const end = to;
          path = (t) => store.getState().apply((b) => ops.clipLead(b, d.id, d.end, null, [from[0] + (end[0] - from[0]) * t, from[1] + (end[1] - from[1]) * t]));
        }
      } else if (from && d.kind === "probe") {
        const at = anchorPosition(base, `probe:${d.color}`);
        if (at) path = (t) => store.getState().apply((b) => ops.touchProbe(b, d.color, null, [from[0] + (at[0] - from[0]) * t, from[1] + (at[2] - from[1]) * t]));
      } else if (from && d.kind === "plug" && base.meter) {
        const pr = base.meter.probes[d.color];
        const at: Vec2 = pr.socket ? (([x, , z]) => [x, z] as Vec2)(socketWorld(base.meter, pr.socket)) : pr.plugPos;
        path = (t) => store.getState().apply((b) => ops.plugProbe(b, d.color, null, [from[0] + (at[0] - from[0]) * t, from[1] + (at[1] - from[1]) * t]));
      }
      if (!path) {
        s.cancel();
        invalidate();
        return;
      }
      animate(DRAG.glideMs, path, () => {
        if (store.getState().txBase) store.getState().cancel();
        invalidate();
      });
    };

    /** A drop that took: the lifted part settles into its place, with a tick under the finger. */
    const settle = (g: Gesture) => {
      const d = g.drag;
      if (!d) return;
      if (d.kind === "part" && lifter.id === d.id) {
        const c = partCenter(d.id);
        const free = d.to;
        const cur = lifter.cur;
        if (c && free) lifter.set(d.id, { dx: free[0] - c[0], dz: free[1] - c[1], k: cur.k, h: cur.h });
        lifter.to(d.id, NO_LIFT, DRAG.settleMs);
      }
      const st = store.getState();
      if (landed(st.bench, { kind: d.kind, id: "id" in d ? d.id : undefined, color: "color" in d ? d.color : undefined }, st.ui.snapTarget)) haptic(g.touch);
    };

    const endDrag = (g: Gesture) => {
      clearFeedback();
      stopTick();
      element.style.cursor = "";
      const d = g.drag;
      const s = store.getState();
      if (!d || g.done) return;
      if (d.kind === "press") {
        s.press(d.id, false);
        return;
      }
      if (d.kind === "wireNew") {
        const draft = s.ui.wireDraft;
        if (draft?.target) {
          s.commit();
          s.addWire(draft.from, draft.target);
          setUi({ wireDraft: null });
        }
        return;
      }
      if (carries(d) && g.invalid) {
        glideBack(g);
        return;
      }
      if (d.kind === "part") {
        // Dropped right on a part of the same kind: the two swap places and wiring (a fresh LED for a dead one).
        const target = ops.swapTarget(s.bench, d.id);
        if (target && !s.locked.includes(target.id)) {
          const from = s.txBase?.parts.find((p) => p.id === d.id)?.pos ?? ops.asideSpot(s.bench, target, [target.pos[0], target.pos[1] + 34], [d.id]);
          s.apply((b) => ops.dropOnto(b, d.id, target.id, from));
        } else if (d.cable && d.to) {
          // A gate dropped on a cable as drawn: on that lead.
          const [to, cable] = [d.to, d.cable];
          s.apply((b) => ops.clipGate(b, d.id, to, cable));
        } else if (d.to) {
          // Dropped on a holder: into the nearest free seat.
          const to = d.to;
          s.apply((b) => ops.movePart(b, d.id, to, { seat: "free" }));
        }
      }
      const before = s.txBase;
      s.commit();
      settle(g);
      setUi({ snapTarget: null, dragging: false });
      // A clip, probe tip or plug put somewhere is done with: no selection bar over the bench under the next thing to grab.
      if (d.kind === "clip" || d.kind === "probe" || d.kind === "plug") s.select(null);
      if (!before) return;
      const b = s.bench;
      switch (d.kind) {
        case "part":
          emit(d.spawned ? { type: "part:add", partId: d.id, kind: b.parts.find((p) => p.id === d.id)!.kind } : { type: "part:move", partId: d.id });
          break;
        case "leg":
          emit({ type: "part:move", partId: d.id });
          break;
        case "clip": {
          const l = b.leads.find((x) => x.id === d.id);
          if (l) emit({ type: "lead:clip", leadId: d.id, end: d.end, to: (d.end === "a" ? l.a : l.b).to });
          break;
        }
        case "probe":
          emit({ type: "meter:probe", probe: d.color, to: b.meter?.probes[d.color].tip.to ?? null });
          break;
        case "plug":
          emit({ type: "meter:plug", probe: d.color, socket: b.meter?.probes[d.color].socket ?? null });
          break;
        case "dial": {
          const mode = b.meter?.mode;
          if (mode && before.meter?.mode !== mode) {
            emit({ type: "meter:mode", mode });
            emit({ type: "input", partId: b.meter!.id, key: "mode", value: mode });
          }
          break;
        }
        case "rotor": {
          const p = b.parts.find((x) => x.id === d.id);
          if (p && p.kind === "trimmer") emit({ type: "input", partId: d.id, key: "position", value: p.params.position });
          break;
        }
        default:
          break;
      }
    };

    // A second tap (or click) on the same part soon after the first frames it; on empty desk, the whole bench.
    let lastTap: { t: number; x: number; y: number; part: string | null } | null = null;
    const doubleTap = (g: Gesture, cx: number, cy: number): boolean => {
      const now = performance.now();
      const p = g.pick;
      const part = p && (p.type === "part" || p.type === "leg" || p.type === "rotor") ? p.id : p?.type === "meter" ? (store.getState().bench.meter?.id ?? null) : p ? "" : null;
      const prev = lastTap;
      lastTap = { t: now, x: cx, y: cy, part };
      if (!prev || now - prev.t > 360 || Math.hypot(prev.x - cx, prev.y - cy) > (g.touch ? 24 : 8) || prev.part !== part || part === "") return false;
      lastTap = null;
      if (!view?.current) return false;
      if (part) view.current.focus([`part:${part}`]);
      else view.current.home(false);
      return true;
    };

    /** Flips a toggle or slide switch (a tap on it, or a short drag on its lever). */
    const flip = (id: string) => {
      const s = store.getState();
      const part = s.bench.parts.find((x) => x.id === id);
      if (part && isThrowSwitch(part.kind)) s.setParams<"slide-switch">(id, { to: (part.params as { to: string }).to === "a" ? "b" : "a" });
    };

    const click = (g: Gesture, cx: number, cy: number) => {
      const s = store.getState();
      const p = g.pick;
      if (!s.ui.armed && s.ui.mode !== "wire" && doubleTap(g, cx, cy)) return;
      if (s.ui.menu) setUi({ menu: null });
      // Placing an armed tray item.
      if (s.ui.armed && !readOnly) {
        if (api.current?.placeAt(s.ui.armed, cx, cy)) return;
      }
      // Second click of a click-click wire.
      if (s.ui.mode === "wire" && !readOnly) {
        const h = holeAt(cx, cy);
        const draft = s.ui.wireDraft;
        if (draft && h && h !== draft.from && (!p || p.type === "part" || p.type === "wire" || p.type === "wireEnd")) {
          s.addWire(draft.from, h);
          setUi({ wireDraft: null });
          return;
        }
      }
      if (!p) {
        if (s.ui.mode === "wire") setUi({ wireDraft: null });
        // A tap on a hole shows its connections (touch has no hover).
        const h = holeAt(cx, cy);
        setUi({ hover: g.touch && h ? `hole:${h}` : s.ui.hover });
        s.select(null);
        return;
      }
      switch (p.type) {
        case "part":
        case "leg":
        case "rotor":
        case "draw":
          s.select({ type: "part", id: p.id });
          break;
        case "setting":
          if (!readOnly) s.setParams(p.id, settingParams(s.bench, p.id, p.key, p.value) as never);
          break;
        case "press":
          s.select({ type: "part", id: p.id });
          break;
        case "flip":
          // Flipping is the whole action: no selection bar popping up over what the switch just turned on.
          if (!readOnly) flip(p.id);
          break;
        case "wire":
        case "wireEnd":
          s.select({ type: "wire", id: p.id });
          break;
        case "clip":
          s.select({ type: "lead", id: p.id });
          break;
        case "meter":
        case "plug":
        case "probe":
          s.select({ type: "meter", id: s.bench.meter?.id ?? "M1" });
          break;
        case "dial": {
          if (readOnly) break;
          const m = s.bench.meter;
          if (m) {
            // A tap on the knob turns it to the position tapped; a tap on its middle, one step on (a long press, one
            // back: below).
            const i = DIAL_MODES.indexOf(m.mode as (typeof DIAL_MODES)[number]);
            s.setMeterMode(dialModeAt(cx, cy) ?? DIAL_MODES[(i + 1) % DIAL_MODES.length]!);
          }
          break;
        }
        case "range":
          // A tap steps the range one up (a long press, one down: below).
          if (!readOnly) s.stepMeter("range", 1);
          break;
        case "dialMode":
          if (!readOnly) s.setMeterMode(p.mode);
          break;
      }
    };

    const openMenu = (g: Gesture, cx: number, cy: number) => {
      const s = store.getState();
      const p = g.pick;
      if (!p || readOnly) return;
      let sel: Selection;
      if (p.type === "part" || p.type === "leg" || p.type === "press" || p.type === "flip" || p.type === "rotor" || p.type === "draw" || p.type === "setting") sel = { type: "part", id: p.id };
      else if (p.type === "wire" || p.type === "wireEnd") sel = { type: "wire", id: p.id };
      else if (p.type === "clip") sel = { type: "lead", id: p.id };
      else sel = { type: "meter", id: s.bench.meter?.id ?? "M1" };
      if (s.txBase) s.cancel();
      s.select(sel);
      const r = element.getBoundingClientRect();
      setUi({ menu: { x: cx - r.left, y: cy - r.top, selection: sel, at: performance.now() }, dragging: false });
    };

    // ---- DOM listeners ---------------------------------------------------------------------------------------

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") {
        if (e.button === 2) {
          const p = hit(e.clientX, e.clientY);
          if (p) {
            e.preventDefault();
            e.stopPropagation();
            lockCamera(true);
            openMenu(newGesture(e, false, p), e.clientX, e.clientY);
            setTimeout(() => lockCamera(false), 0);
          }
        }
        return;
      }
      // Overlay controls (buttons, tray) handle themselves.
      if ((e.target as HTMLElement | null)?.closest?.("[data-bench-ui]")) return;
      if (gesture.current) return; // second finger: leave pinch/zoom to the camera
      // A glide back still running ends now, where it was going.
      finishGlide();
      const touch = e.pointerType !== "mouse";
      const pick = hit(e.clientX, e.clientY, touch);
      const s = store.getState();
      const g = newGesture(e, touch, pick);
      gesture.current = g;
      if (readOnly) {
        // Read-only benches still allow turning the meter dial off? No: only the camera moves.
        if (pick?.type === "press") g.pick = null;
        return;
      }
      const wiring = s.ui.mode === "wire" && (!pick || pick.type === "part" || pick.type === "wire");
      if (wiring) {
        const h = holeAt(e.clientX, e.clientY);
        if (h) {
          g.hole = h;
          lockCamera(true);
          element.setPointerCapture(e.pointerId);
          return;
        }
      }
      if (pick) {
        lockCamera(true);
        element.setPointerCapture(e.pointerId);
        if (pick.type === "press") {
          s.press(pick.id, true);
          g.drag = { kind: "press", id: pick.id };
        }
        g.longPress = window.setTimeout(() => {
          if (gesture.current === g && !g.moved && !g.flipped && pick.type !== "press") {
            // Held on the dial or the RANGE key, the meter steps back; anywhere else the menu opens.
            if (pick.type === "dial" || pick.type === "range") store.getState().stepMeter(pick.type, -1);
            else openMenu(g, g.x0, g.y0);
            gesture.current = null;
            lockCamera(false);
          }
        }, 520);
      }
    };

    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) {
        // No hover x-ray while a part from the tray is in hand: the marks show where it lands.
        if (e.pointerType === "mouse" && !g && !active) scheduleHover(e.clientX, e.clientY);
        return;
      }
      if (g.done) return;
      if (!g.moved) {
        const travel = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
        const slop = g.touch ? DRAG.slopTouch : DRAG.slopMouse;
        // A switch flips on a tap or a short drag of its lever; only a longer drag moves it (when it may move).
        if (g.pick?.type === "flip" && !g.hole && !g.drag && !readOnly) {
          const pinned = store.getState().locked.includes(g.pick.id);
          if (pinned) {
            if (!g.flipped && travel >= slop) {
              g.flipped = true;
              if (g.longPress) clearTimeout(g.longPress);
              flip(g.pick.id);
            }
            return;
          }
          if (travel < DRAG.flipDrag) return;
        }
        if (travel < slop) return;
        g.moved = true;
        if (g.longPress) clearTimeout(g.longPress);
        const s = store.getState();
        if (g.hole && !g.drag) {
          g.drag = { kind: "wireNew", from: g.hole };
          setUi({ wireDraft: { from: g.hole, to: null, target: null } });
        } else if (g.pick && !g.drag) {
          g.drag = beginDrag(g, g.x0, g.y0);
          if (g.drag) {
            s.begin();
            g.dragAt = performance.now();
            const at = itemAt(g.drag);
            if (at) g.off = [at[0] - g.x0, at[1] - g.y0];
            // Picked up: the hand closes and the hover x-ray goes.
            setUi({ dragging: true, menu: null, hover: null });
            if (g.drag.kind !== "dial") s.select(selectionFor(g.pick, s.bench));
            if (carries(g.drag)) {
              element.style.cursor = "grabbing";
              active = g;
              startTick();
            }
          } else {
            lockCamera(false);
          }
        }
      }
      if (g.drag && g.drag.kind !== "press") dragMove(g, e.clientX, e.clientY);
    };

    const onUp = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      gesture.current = null;
      if (active === g) active = null;
      if (g.longPress) clearTimeout(g.longPress);
      if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
      lockCamera(false);
      if (g.done) {
        invalidate();
        return;
      }
      if (g.drag && g.moved) {
        endDrag(g);
      } else if (g.drag?.kind === "press") {
        store.getState().press(g.drag.id, false);
        click(g, e.clientX, e.clientY);
      } else if (!g.moved && !g.flipped) {
        if (g.hole && store.getState().ui.mode === "wire") {
          const s = store.getState();
          const draft = s.ui.wireDraft;
          if (draft && draft.from !== g.hole) {
            s.addWire(draft.from, g.hole);
            setUi({ wireDraft: null });
          } else {
            setUi({ wireDraft: { from: g.hole, to: null, target: null } });
          }
        } else {
          click(g, e.clientX, e.clientY);
        }
      }
      invalidate();
    };

    const onCancel = (e: PointerEvent) => {
      clearFeedback();
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      gesture.current = null;
      if (active === g) active = null;
      stopTick();
      if (g.longPress) clearTimeout(g.longPress);
      const s = store.getState();
      if (g.drag?.kind === "press") s.press(g.drag.id, false);
      element.style.cursor = "";
      lockCamera(false);
      if (carries(g.drag) && !g.done && s.txBase) {
        glideBack(g);
        return;
      }
      if (s.txBase) s.cancel();
      lifter.clear();
      setUi({ dragging: false, snapTarget: null });
    };

    /** Escape puts down what is being dragged: it glides back and nothing changes. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const g = active;
      if (!g || g.done || !carries(g.drag)) return;
      e.preventDefault();
      e.stopPropagation();
      glideBack(g);
    };

    const scheduleHover = (cx: number, cy: number) => {
      if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current);
      hoverFrame.current = requestAnimationFrame(() => {
        hoverFrame.current = null;
        const s = store.getState();
        const p = hit(cx, cy);
        let hover: Anchor | null = null;
        if (!p || p.type === "part" || p.type === "wire") {
          const h = holeAt(cx, cy);
          if (h && (!p || isOverHole(cx, cy, h))) hover = `hole:${h}`;
        }
        if (p?.type === "leg") hover = `pin:${p.id}.${p.leg}`;
        if (p?.type === "wireEnd") hover = `wire:${p.id}.${p.end}`;
        if (s.ui.mode === "wire" && s.ui.wireDraft) {
          // Preview the wire to the hole under the pointer while choosing the second end.
          const h = holeAt(cx, cy);
          const target = h && h !== s.ui.wireDraft.from ? h : null;
          if (target !== s.ui.wireDraft.target) setUi({ wireDraft: { ...s.ui.wireDraft, target } });
        }
        if (hover !== s.ui.hover) setUi({ hover });
        const fixed = p && (p.type === "part" || p.type === "leg") && s.locked.includes(p.id);
        element.style.cursor = p
          ? p.type === "press" || p.type === "flip" || p.type === "dialMode" || p.type === "setting" || p.type === "dial" || p.type === "range"
            ? "pointer"
            : p.type === "draw"
              ? "crosshair"
              : p.type === "wire" || fixed
                ? ""
                : "grab"
          : hover && s.ui.mode === "wire"
            ? "crosshair"
            : "";
        invalidate();
      });
    };
    /** True if the pointer is close to the hole on screen (so hovering a part body does not x-ray). */
    const isOverHole = (cx: number, cy: number, h: string) => {
      const b = bench();
      const g = boardGeometry(b.board!);
      const hi = g.holes.get(h)!;
      const [ox, oz] = boardOrigin(b.board!);
      const s = toScreen([ox + hi.x, BOARD_TOP, oz + hi.z]);
      return Math.hypot(s.x - cx, s.y - cy) < 14 && BOARD_PRINT.holeSize > 0;
    };

    const onLeave = (e: PointerEvent) => {
      // Touch pointers "leave" when lifted; keep the tapped hole's x-ray showing.
      if (e.pointerType !== "mouse") return;
      if (store.getState().ui.hover) setUi({ hover: null });
    };
    const onContext = (e: MouseEvent) => e.preventDefault();

    element.addEventListener("pointerdown", onDown, { capture: true });
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onCancel);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey, { capture: true });

    // ---- API for the overlay -----------------------------------------------------------------------------------
    const placeItem = (item: TrayItem, at: THREE.Vector3): string | null => {
      const s = store.getState();
      if (item.kind === "lead") {
        const color = item.params?.color ?? s.ui.leadColor;
        // End b lands under the pointer, end a rests on the desk a little to the left.
        return s.addLead(color, [at.x - 40, at.z - 6], item.id);
      }
      const kind = item.kind;
      const params = (item.params ?? {}) as never;
      const id = s.addPart(kind, params, { pos: [at.x, at.z] }, item.id);
      // Let it snap into the board, or into a free seat of a holder, if it lands there.
      const part = store.getState().bench.parts.find((p) => p.id === id);
      if (part) store.getState().apply((b) => ops.movePart(b, id, [at.x, at.z], { seat: "free" }));
      return id;
    };
    api.current = {
      startSpawn: (item, e) => {
        if (readOnly) return;
        finishGlide();
        const s = store.getState();
        const touch = e.pointerType !== "mouse";
        // The tray slot it comes from (the native event's currentTarget is React's root by now, not the slot).
        const sr = (e.target as Element | null)?.closest?.("button")?.getBoundingClientRect();
        const g: Gesture = { ...newGesture(e, touch, null), home: sr ? [sr.left + sr.width / 2, sr.top + sr.height / 2] : [e.clientX, e.clientY] };
        let spawned = false;
        let lifting = false;
        active = g;
        /** Takes the item out once its hot point is over the bench (on touch it rises above the finger first). */
        const spawnNow = (): boolean => {
          if (spawned || !g.last || g.done) return spawned;
          const [hx, hy] = touch ? [g.last[0], g.last[1] - DRAG.touchLift * liftT(g)] : g.last;
          if (offBench(hx, hy)) return false;
          const wp = workPoint(hx, hy);
          if (!wp) return false;
          s.begin();
          const id = placeItem(item, wp);
          spawned = true;
          g.spawn = null;
          g.moved = true;
          if (id && item.kind !== "lead") {
            g.drag = { kind: "part", id, offset: [0, 0], spawned: true };
            s.select({ type: "part", id });
          } else if (id) {
            g.drag = { kind: "clip", id, end: "b", spawned: true };
          }
          setUi({ dragging: true, armed: null, hover: null });
          lockCamera(true);
          element.style.cursor = "grabbing";
          if (g.drag) dragMove(g, g.last[0], g.last[1]);
          return true;
        };
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== g.pointerId || g.done) return;
          g.last = [ev.clientX, ev.clientY];
          if (!spawned) {
            const dx = ev.clientX - g.x0;
            const dy = ev.clientY - g.y0;
            if (!lifting) {
              if (Math.hypot(dx, dy) < 6) return;
              // A sideways swipe along the phone's tray strip scrolls it; a take-out goes up, off the strip.
              if (touch && -dy < Math.abs(dx) * 0.6 && offBench(ev.clientX, ev.clientY)) return;
              lifting = true;
              g.dragAt = performance.now();
              g.spawn = spawnNow;
              startTick();
            }
            if (!spawnNow()) return;
          }
          if (g.drag) dragMove(g, ev.clientX, ev.clientY);
        };
        const up = (ev: PointerEvent) => {
          if (ev.pointerId !== g.pointerId) return;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          if (active === g) active = null;
          stopTick();
          g.spawn = null;
          lockCamera(false);
          if (g.done) return;
          clearFeedback();
          element.style.cursor = "";
          const st = store.getState();
          if (!spawned) {
            // A tap arms the item for tap-to-place.
            if (!lifting && ev.type !== "pointercancel") setUi({ armed: st.ui.armed === item ? null : item });
            return;
          }
          if (ev.type === "pointercancel" || g.invalid) {
            glideBack(g);
            return;
          }
          if (g.drag?.kind === "clip") {
            // Bring the other clip of a new lead next to the one just placed.
            const id = g.drag.id;
            st.apply((b) => {
              const l = b.leads.find((x) => x.id === id);
              if (!l || l.a.to) return b;
              const at: [number, number, number] | null = l.b.to ? anchorPosition(b, l.b.to) : [l.b.pos[0], 0, l.b.pos[1]];
              if (!at) return b;
              // Toward the middle of the work area, so the loose clip stays in view (narrow phone views too).
              const [cx, cz] = workCenter(b);
              const dx = cx - at[0];
              const dz = cz - at[2];
              const d = Math.hypot(dx, dz);
              const pos: Vec2 = d > 20 ? [at[0] + (dx / d) * 40, at[2] + (dz / d) * 40 + 18] : [at[0] - 30, at[2] + 45];
              return ops.clipLead(b, id, "a", null, pos);
            });
          }
          if (g.drag?.kind === "part") {
            // A fresh part dropped right on one of its kind takes its place and wiring; the old one moves aside.
            const id = g.drag.id;
            const target = ops.swapTarget(st.bench, id);
            if (target && !st.locked.includes(target.id)) st.apply((b) => ops.dropOnto(b, id, target.id, ops.asideSpot(b, target, [target.pos[0], target.pos[1] + 34], [id])));
            else if (g.drag.to) {
              const to = g.drag.to;
              st.apply((b) => ops.movePart(b, id, to, { seat: "free" }));
            }
          }
          st.commit();
          settle(g);
          if (g.drag?.kind === "part") emit({ type: "part:add", partId: g.drag.id, kind: item.kind as never });
          else if (g.drag?.kind === "clip") emit({ type: "lead:add", leadId: g.drag.id });
          setUi({ dragging: false, snapTarget: null });
          invalidate();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      },
      placeAt: (item, cx, cy) => {
        const wp = workPoint(cx, cy);
        if (!wp) return false;
        const s = store.getState();
        s.begin();
        const id = placeItem(item, wp);
        s.commit();
        setUi({ armed: null });
        if (id) {
          if (item.kind === "lead") emit({ type: "lead:add", leadId: id });
          else {
            emit({ type: "part:add", partId: id, kind: item.kind });
            s.select({ type: "part", id });
          }
        }
        invalidate();
        return true;
      },
      pickAt: (x, y) => hit(x, y),
      deskAt: (x, y) => {
        const r = element.getBoundingClientRect();
        const p = planePoint(x + r.left, y + r.top, 0);
        return p ? [p.x, p.z] : null;
      },
      stats: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }),
      project: (target) => {
        const p = typeof target === "string" ? anchorPosition(bench(), target) : target;
        if (!p) return null;
        const sp = toScreen(p);
        return sp.behind ? null : { x: sp.x, y: sp.y };
      },
      topView: () => {
        if (view?.current) return view.current.home(true);
        if (!controls) return;
        const r = element.getBoundingClientRect();
        const f = fitCamera(bench(), r.width / Math.max(1, r.height), true, { left: viewPad.current.left / r.width, bottom: viewPad.current.bottom / r.height }, 32, store.getState().frame);
        void controls.setLookAt(...f.position, ...f.target, true);
        invalidate();
      },
      resetView: () => {
        if (view?.current) return view.current.home(false);
        if (!controls) return;
        const r = element.getBoundingClientRect();
        const f = fitCamera(bench(), r.width / Math.max(1, r.height), false, { left: viewPad.current.left / r.width, bottom: viewPad.current.bottom / r.height }, 32, store.getState().frame);
        void controls.setLookAt(...f.position, ...f.target, true);
        invalidate();
      },
    };

    return () => {
      element.removeEventListener("pointerdown", onDown, { capture: true });
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onCancel);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey, { capture: true });
      stopTick();
      finishGlide();
      lifter.clear();
      api.current = null;
    };
  }, [element, camera, controls, scene, gl, store, readOnly, invalidate, api, emit, viewPad, view, loupe, marks]);
}

/** Whether an attach point is, or hangs off (clip on a probe tip, tip on a clip ...), something starting with `prefix`. */
function hangsOn(b: BenchState, anchor: string, prefix: string, depth = 0): boolean {
  if (anchor.startsWith(prefix)) return true;
  if (depth > 4) return false;
  const a = parseAnchor(anchor);
  let to: string | null = null;
  if (a?.type === "probe" && b.meter) to = b.meter.probes[a.color].tip.to;
  else if (a?.type === "lead") {
    const l = b.leads.find((x) => x.id === a.lead);
    to = l ? (a.end === "a" ? l.a.to : l.b.to) : null;
  }
  return !!to && hangsOn(b, to, prefix, depth + 1);
}

function selectionFor(p: Pick, b: BenchState) {
  switch (p.type) {
    case "part":
    case "leg":
    case "press":
    case "flip":
    case "rotor":
    case "draw":
    case "setting":
      return { type: "part" as const, id: p.id };
    case "wire":
    case "wireEnd":
      return { type: "wire" as const, id: p.id };
    case "clip":
      return { type: "lead" as const, id: p.id };
    default:
      return { type: "meter" as const, id: b.meter?.id ?? "M1" };
  }
}

/** Keyboard shortcuts on the focused bench. Returns true when the key was handled. */
export function handleBenchKey(e: KeyboardEvent, store: BenchStore, api: InteractionApi | null, readOnly: boolean): boolean {
  const s = store.getState();
  const mod = e.metaKey || e.ctrlKey;
  if (mod && (e.key === "z" || e.key === "Z")) {
    if (readOnly) return false;
    if (e.shiftKey) s.redo();
    else s.undo();
    return true;
  }
  if (mod && (e.key === "y" || e.key === "Y")) {
    if (!readOnly) s.redo();
    return true;
  }
  if (mod) return false;
  const sel = s.ui.selection;
  switch (e.key) {
    case "Escape":
      if (s.txBase) s.cancel();
      s.setUi({ wireDraft: null, armed: null, menu: null, hover: null });
      s.select(null);
      return true;
    case "r":
    case "R":
      if (readOnly) return false;
      s.rotateSelected();
      return true;
    case "Delete":
    case "Backspace":
      if (readOnly) return false;
      s.deleteSelected();
      return true;
    case "w":
    case "W":
      if (readOnly) return false;
      s.setUi({ mode: s.ui.mode === "wire" ? "select" : "wire", wireDraft: null });
      return true;
    case "x":
    case "X":
      s.setUi({ xray: !s.ui.xray });
      return true;
    case "t":
    case "T":
      api?.topView();
      return true;
    case " ":
    case "Enter": {
      if (readOnly || sel?.type !== "part") return false;
      const part = s.bench.parts.find((p) => p.id === sel.id);
      if (!part) return false;
      if (part.kind === "pushbutton") {
        s.press(part.id, e.type === "keydown");
        return true;
      }
      if (isThrowSwitch(part.kind)) {
        if (e.type === "keydown" && !e.repeat) s.setParams<"slide-switch">(part.id, { to: (part.params as { to: string }).to === "a" ? "b" : "a" });
        return true;
      }
      return false;
    }
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown": {
      if (readOnly) return false;
      const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      const dz = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (sel?.type === "meter" && s.bench.meter) {
        // Left and right turn the dial; up and down step the range (the RANGE key).
        s.stepMeter(dz === 0 ? "dial" : "range", dz === 0 ? (dx < 0 ? -1 : 1) : dz < 0 ? 1 : -1);
        return true;
      }
      if (sel?.type !== "part") return false;
      const part = s.bench.parts.find((p) => p.id === sel.id);
      if (!part) return false;
      // A knob (a trimmer, the bench supply's) turns with the arrows.
      const knob = part.kind === "trimmer" || part.kind === "bench-supply";
      if (!knob && s.locked.includes(part.id)) return true;
      if (knob) {
        const position = Math.max(0, Math.min(1, Math.round((part.params.position + dx * 0.05 - dz * 0.05) * 100) / 100));
        s.setParams<"trimmer">(part.id, { position });
        return true;
      }
      const c = ops.partCenter(s.bench, part);
      const onBoard = ops.isOnBoard(s.bench, part);
      const step = onBoard ? 2.54 : 5;
      const next: Vec2 = [c[0] + dx * step, c[1] + dz * step];
      s.apply((b) => ops.movePart(b, part.id, next, { reach: 0.4 }), { type: "part:move", partId: part.id });
      return true;
    }
  }
  return false;
}

/** Footprint size helper for ghosts. */
export function footprintSpan(kind: TrayItem["kind"]): number {
  if (kind === "lead") return 0;
  const fp = footprintOf({ kind, params: partDef(kind).defaults } as never);
  return fp.length;
}
