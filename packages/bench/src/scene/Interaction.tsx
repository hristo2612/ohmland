// Pointer, touch and keyboard handling for the bench. One controller per <Bench>; it raycasts the hit proxies,
// drives drags through the store (inside an undo transaction) and leaves empty-space drags to the camera.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { CameraControls as CameraControlsImpl } from "@react-three/drei";
import { parseAnchor } from "../anchors";
import { BOARD_PRINT, boardGeometry, boardOrigin, nearestHole } from "../board";
import { BOARD_TOP } from "../dims";
import { DIAL_MODES, METER, anchorPosition, clipTargets, fitCamera, meterLocalToWorld, nearestSocket, partPose, workCenter } from "../layout";
import { CARD } from "../dims";
import * as ops from "../ops";
import { penStroke, settingParams } from "../ops";
import { canMountOnBoard, footprintOf, isThrowSwitch, partDef, rotateXZ } from "../parts";
import type { BenchStore } from "../store";
import type { Anchor, BenchAction, BenchState, MeterMode, Selection, TrayItem, Vec2 } from "../types";
import { PICK_LAYER, pickOf, type Pick } from "./pick";

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
};

type Drag =
  | { kind: "part"; id: string; offset: Vec2; spawned?: boolean }
  | { kind: "leg"; id: string; leg: string; flying: boolean }
  | { kind: "wireEnd"; id: string; end: "a" | "b" }
  | { kind: "wireNew"; from: string }
  | { kind: "clip"; id: string; end: "a" | "b" }
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
};

const UP = new THREE.Vector3(0, 1, 0);

export function useInteraction({
  store,
  element,
  readOnly,
  api,
  emit,
  viewPad,
}: {
  store: BenchStore;
  element: HTMLElement | null;
  readOnly: boolean;
  api: React.MutableRefObject<InteractionApi | null>;
  emit: (a: BenchAction) => void;
  /** Pixels covered by overlay panels, so camera fits avoid them. */
  viewPad: React.MutableRefObject<{ left: number; bottom: number }>;
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
      dial: 2,
      part: 1,
      wire: 1,
      meter: 0,
    };
    const hit = (cx: number, cy: number): Pick | null => {
      rc.setFromCamera(ndc(cx, cy), camera);
      const hits = rc.intersectObjects(scene.children, true);
      let best: Pick | null = null;
      let bestScore = -Infinity;
      const nearest = hits[0]?.distance ?? 0;
      for (const h of hits) {
        const p = pickOf(h.object);
        if (!p) continue;
        // Prefer handles, but only among things close to the nearest hit (do not reach through a whole part).
        const score = PRIORITY[p.type] * 100 - (h.distance - nearest);
        if (h.distance - nearest > 40) break;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      return best;
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
    /** Nearest attach point to the pointer in screen space. */
    const snapTarget = (cx: number, cy: number, touch: boolean, opts: { probes?: boolean; leads?: boolean; exclude?: string }): Anchor | null => {
      const b = bench();
      const targets = clipTargets(b, { holes: true, probes: opts.probes, leads: opts.leads }).filter(
        // Never onto something that already hangs off the thing being dragged (a probe touching this clip, say).
        (t) => !opts.exclude || !(t.kind === "probe" || t.kind === "lead") || !hangsOn(b, t.anchor, opts.exclude),
      );
      const radius = touch ? 40 : 26;
      let best: Anchor | null = null;
      let bestD = radius;
      for (const t of targets) {
        if (opts.exclude && t.anchor.startsWith(opts.exclude)) continue;
        const s = toScreen(t.pos);
        if (s.behind) continue;
        // Leads and wire ends win over the hole underneath them.
        const bonus = t.kind === "hole" ? 0 : 9;
        const d = Math.hypot(s.x - cx, s.y - cy) - bonus;
        if (d < bestD) {
          bestD = d;
          best = t.anchor;
        }
      }
      return best;
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

    const beginDrag = (g: Gesture, cx: number, cy: number): Drag | null => {
      const p = g.pick;
      if (!p) return null;
      const b = bench();
      const locked = store.getState().locked;
      switch (p.type) {
        case "part":
        case "press":
        case "flip":
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
        case "setting":
          return null;
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
      }
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

    const dragMove = (g: Gesture, cx: number, cy: number) => {
      const d = g.drag!;
      const s = store.getState();
      switch (d.kind) {
        case "part": {
          const wp = workPoint(cx, cy);
          if (!wp) return;
          s.apply((b) => ops.movePart(b, d.id, [wp.x - d.offset[0], wp.z - d.offset[1]]));
          break;
        }
        case "leg": {
          const wp = workPoint(cx, cy);
          if (!wp) return;
          s.apply((b) => (d.flying ? ops.moveFlyingLeg(b, d.id, d.leg, [wp.x, wp.z]) : ops.moveSpanLeg(b, d.id, d.leg, [wp.x, wp.z])));
          break;
        }
        case "wireEnd": {
          const wp = workPoint(cx, cy);
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
          const t = snapTarget(cx, cy, g.touch, { probes: true, exclude: `lead:${d.id}.` });
          const wp = planePoint(cx, cy, 0);
          setUi({ snapTarget: t });
          s.apply((b) => ops.clipLead(b, d.id, d.end, t, wp ? [wp.x, wp.z] : undefined));
          break;
        }
        case "probe": {
          // Probe tips land on leads, holes, clips (even one lying loose) or the other probe's tip.
          const t = snapTarget(cx, cy, g.touch, { leads: true, probes: true, exclude: `probe:${d.color}` });
          const wp = planePoint(cx, cy, 0);
          setUi({ snapTarget: t });
          s.apply((b) => ops.touchProbe(b, d.color, t, wp ? [wp.x, wp.z] : undefined));
          break;
        }
        case "plug": {
          const m = s.bench.meter;
          const wp = planePoint(cx, cy, m ? METER.face : 0) ?? planePoint(cx, cy, 0);
          if (!m || !wp) return;
          let sock = nearestSocket(m, wp.x, wp.z, 10);
          // Passing over the other plug's socket must not knock it out.
          if (sock && m.probes[d.color === "red" ? "black" : "red"].socket === sock) sock = null;
          const desk = planePoint(cx, cy, 0);
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
          const c = ops.partCenter(b, part);
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
      invalidate();
    };

    const endDrag = (g: Gesture) => {
      const d = g.drag;
      const s = store.getState();
      if (!d) return;
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
      if (d.kind === "part") {
        // Dropped right on a part of the same kind: the two swap places and wiring (a fresh LED for a dead one).
        const target = ops.swapTarget(s.bench, d.id);
        if (target && !s.locked.includes(target.id)) {
          const from = s.txBase?.parts.find((p) => p.id === d.id)?.pos ?? ([target.pos[0], target.pos[1] + 34] as Vec2);
          s.apply((b) => ops.dropOnto(b, d.id, target.id, from));
        }
      }
      const before = s.txBase;
      s.commit();
      setUi({ snapTarget: null, dragging: false });
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

    const click = (g: Gesture, cx: number, cy: number) => {
      const s = store.getState();
      const p = g.pick;
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
        case "flip": {
          if (readOnly) break;
          const part = s.bench.parts.find((x) => x.id === p.id);
          if (part && isThrowSwitch(part.kind)) {
            s.setParams<"slide-switch">(p.id, { to: (part.params as { to: string }).to === "a" ? "b" : "a" });
          }
          // Flipping is the whole action: no selection bar popping up over what the switch just turned on.
          break;
        }
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
            const i = DIAL_MODES.indexOf(m.mode as (typeof DIAL_MODES)[number]);
            s.setMeterMode(DIAL_MODES[(i + 1) % DIAL_MODES.length]!);
          }
          break;
        }
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
            openMenu({ pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, pick: p, drag: null, moved: false, touch: false, longPress: null, hole: null }, e.clientX, e.clientY);
            setTimeout(() => lockCamera(false), 0);
          }
        }
        return;
      }
      // Overlay controls (buttons, tray) handle themselves.
      if ((e.target as HTMLElement | null)?.closest?.("[data-bench-ui]")) return;
      if (gesture.current) return; // second finger: leave pinch/zoom to the camera
      const touch = e.pointerType !== "mouse";
      const pick = hit(e.clientX, e.clientY);
      const s = store.getState();
      const g: Gesture = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, pick, drag: null, moved: false, touch, longPress: null, hole: null };
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
          if (gesture.current === g && !g.moved && pick.type !== "press") {
            openMenu(g, g.x0, g.y0);
            gesture.current = null;
            lockCamera(false);
          }
        }, 520);
      }
    };

    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) {
        if (e.pointerType === "mouse" && !g) scheduleHover(e.clientX, e.clientY);
        return;
      }
      if (!g.moved) {
        if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < (g.touch ? 8 : 4)) return;
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
            setUi({ dragging: true, menu: null });
            if (g.drag.kind !== "dial") s.select(selectionFor(g.pick, s.bench));
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
      if (g.longPress) clearTimeout(g.longPress);
      if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
      lockCamera(false);
      if (g.drag && g.moved) {
        endDrag(g);
      } else if (g.drag?.kind === "press") {
        store.getState().press(g.drag.id, false);
        click(g, e.clientX, e.clientY);
      } else if (!g.moved) {
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
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      gesture.current = null;
      if (g.longPress) clearTimeout(g.longPress);
      const s = store.getState();
      if (g.drag?.kind === "press") s.press(g.drag.id, false);
      if (s.txBase) s.cancel();
      setUi({ dragging: false, snapTarget: null });
      lockCamera(false);
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
        element.style.cursor = p
          ? p.type === "press" || p.type === "flip" || p.type === "dialMode" || p.type === "setting"
            ? "pointer"
            : p.type === "draw"
              ? "crosshair"
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
      // Let it snap into the board, or into a holder, if it lands there.
      const part = store.getState().bench.parts.find((p) => p.id === id);
      if (part) store.getState().apply((b) => ops.movePart(b, id, [at.x, at.z]));
      return id;
    };
    api.current = {
      startSpawn: (item, e) => {
        if (readOnly) return;
        const s = store.getState();
        const g: Gesture = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, pick: null, drag: null, moved: false, touch: e.pointerType !== "mouse", longPress: null, hole: null };
        let spawned = false;
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== g.pointerId) return;
          if (!spawned) {
            if (Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) < 6) return;
            const r = element.getBoundingClientRect();
            if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
            const wp = workPoint(ev.clientX, ev.clientY);
            if (!wp) return;
            s.begin();
            const id = placeItem(item, wp);
            spawned = true;
            g.moved = true;
            if (id && item.kind !== "lead") {
              g.drag = { kind: "part", id, offset: [0, 0], spawned: true };
              s.select({ type: "part", id });
            } else if (id) {
              g.drag = { kind: "clip", id, end: "b" };
            }
            setUi({ dragging: true, armed: null });
            lockCamera(true);
          }
          if (g.drag) dragMove(g, ev.clientX, ev.clientY);
        };
        const up = (ev: PointerEvent) => {
          if (ev.pointerId !== g.pointerId) return;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          lockCamera(false);
          const st = store.getState();
          if (!spawned) {
            // A tap arms the item for tap-to-place.
            setUi({ armed: st.ui.armed === item ? null : item });
            return;
          }
          const r = element.getBoundingClientRect();
          const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
          if (!inside || ev.type === "pointercancel") st.cancel();
          else {
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
              if (target && !st.locked.includes(target.id)) st.apply((b) => ops.dropOnto(b, id, target.id, [target.pos[0], target.pos[1] + 34]));
            }
            st.commit();
            if (g.drag?.kind === "part") emit({ type: "part:add", partId: g.drag.id, kind: item.kind as never });
            else if (g.drag?.kind === "clip") emit({ type: "lead:add", leadId: g.drag.id });
          }
          setUi({ dragging: false });
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
        if (!controls) return;
        const r = element.getBoundingClientRect();
        const f = fitCamera(bench(), r.width / Math.max(1, r.height), true, { left: viewPad.current.left / r.width, bottom: viewPad.current.bottom / r.height }, 32, store.getState().frame);
        void controls.setLookAt(...f.position, ...f.target, true);
        invalidate();
      },
      resetView: () => {
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
      api.current = null;
    };
  }, [element, camera, controls, scene, gl, store, readOnly, invalidate, api, emit, viewPad]);
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
      if (sel?.type === "meter" && s.bench.meter && dz === 0) {
        const i = DIAL_MODES.indexOf(s.bench.meter.mode as (typeof DIAL_MODES)[number]);
        s.setMeterMode(DIAL_MODES[(i + dx + DIAL_MODES.length) % DIAL_MODES.length]!);
        return true;
      }
      if (sel?.type !== "part") return false;
      const part = s.bench.parts.find((p) => p.id === sel.id);
      if (!part) return false;
      if (part.kind !== "trimmer" && s.locked.includes(part.id)) return true;
      if (part.kind === "trimmer") {
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
