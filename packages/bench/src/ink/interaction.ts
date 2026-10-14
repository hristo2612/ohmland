// Pointer, touch and wheel handling for the ink view. The same gestures as the 3D bench, through the same store
// actions and bench ops, so labs, goals and solutions behave the same in either view. Empty-paper drags pan, the wheel
// and two fingers zoom. Drag and drop feel and feedback (lift, marks, magnet, glide back, edge pan) are shared with the
// 3D view through view/drag.ts.

import { parseAnchor } from "../anchors";
import { PITCH, boardGeometry, boardOrigin } from "../board";
import { CARD } from "../dims";
import { DIAL_MODES, METER, anchorPosition, nearestSocket, socketWorld, workCenter } from "../layout";
import * as ops from "../ops";
import { isThrowSwitch, rotateXZ } from "../parts";
import type { BenchStore } from "../store";
import type { Anchor, BenchAction, BenchState, MeterMode, Selection, TrayItem, Vec2 } from "../types";
import { toLocal } from "./frame";
import { holeNear, hitTest, snapTarget } from "./hit";
import { actuatorFrame, type InkModel, type InkPick, leadPoint, targetPoint } from "./model";
import type { InkView } from "./view";
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

export type InkApi = {
  /** Start dragging a tray item from a DOM pointer event. */
  startSpawn: (item: TrayItem, e: PointerEvent) => void;
  /** Place an armed tray item at a client point (tap to place). */
  placeAt: (item: TrayItem, clientX: number, clientY: number) => boolean;
  /** Place a tray item at a desk point (keyboard placement). */
  placeAtWorld: (item: TrayItem, at: Vec2) => string | null;
  /** What the pointer would grab at a client point. */
  pickAt: (clientX: number, clientY: number) => InkPick | null;
};

type Drag =
  /**
   * `to`: where the part was last dragged (it goes into a holder's seat only when dropped there). `cable`: for a gate,
   * the lead drawn under it there.
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
  | { kind: "draw"; id: string; base: { length: number; layers: number }; reach: number }
  | { kind: "pan"; last: [number, number] };

type Gesture = {
  pointerId: number;
  x0: number;
  y0: number;
  pick: InkPick | null;
  drag: Drag | null;
  moved: boolean;
  touch: boolean;
  longPress: number | null;
  /** Wire start chosen by this press (click-click wiring). */
  hole: string | null;
  button: number;
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

type Pinch = { ids: [number, number]; d0: number; mid0: [number, number]; cam0: { x: number; z: number; s: number } };

export type InkInteractionCtx = {
  element: HTMLElement;
  store: BenchStore;
  view: InkView;
  model: () => InkModel;
  readOnly: () => boolean;
  emit: (a: BenchAction) => void;
  /** The touch loupe (view/Loupe.tsx): fed while a finger drags, cleared when it lifts. */
  loupe?: { feed: LoupeFeed; labels: () => BenchLabels };
  /** Where a drag would land (view/DragMarks.tsx): fed while something is dragged. */
  marks?: Feed<DragMarksState>;
  /** Draws a part off its place in the state while it is lifted, or as the state draws it (null). */
  lift?: (id: string, lift: Lift | null) => void;
  /** The edges the chrome covers (the tray): no edge auto-pan there. */
  covered?: () => Covered;
};

/** Whether an attach point is, or hangs off (a clip on a probe tip, a tip on a clip ...), something starting with `prefix`. */
export function hangsOn(b: BenchState, anchor: string, prefix: string, depth = 0): boolean {
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

export function selectionFor(p: InkPick, b: BenchState): Selection {
  switch (p.type) {
    case "part":
    case "leg":
    case "press":
    case "flip":
    case "rotor":
    case "draw":
    case "setting":
      return { type: "part", id: p.id };
    case "wire":
    case "wireEnd":
      return { type: "wire", id: p.id };
    case "clip":
      return { type: "lead", id: p.id };
    default:
      return { type: "meter", id: b.meter?.id ?? "M1" };
  }
}

/** The dial position under a desk point, or null near the knob's centre. */
export function dialModeAt(b: BenchState, x: number, z: number): MeterMode | null {
  const m = b.meter;
  if (!m) return null;
  const [lx, lz] = toLocal({ ox: m.pos[0], oz: m.pos[1], rot: m.rot }, x, z);
  const dz = lz - METER.dial.z;
  if (Math.hypot(lx, dz) < 3) return null;
  let a = Math.atan2(lx, -dz);
  if (a < 0) a += Math.PI * 2;
  return DIAL_MODES[Math.round(a / ((Math.PI * 2) / DIAL_MODES.length)) % DIAL_MODES.length]!;
}

/** Drags that carry something to a new place (they lift, show where they land, glide back, pan at the edge). */
const carries = (d: Drag | null): boolean =>
  !!d && (d.kind === "part" || d.kind === "leg" || d.kind === "wireEnd" || d.kind === "clip" || d.kind === "probe" || d.kind === "plug" || d.kind === "meter" || d.kind === "wireNew");

/** Drags a finger lifts above itself (small things it would hide; not the meter, a dial or a knob). */
const rises = (d: Drag | null): boolean => !!d && carries(d) && d.kind !== "meter" && d.kind !== "wireNew";

/** Wire up the DOM listeners. Returns the API for the chrome and a cleanup. */
export function attachInteraction(ctx: InkInteractionCtx): { api: InkApi; detach: () => void } {
  const { element, store, view, emit } = ctx;
  const bench = () => store.getState().bench;
  const setUi = store.getState().setUi;
  // The bench's page position, read at most every 100 ms (reading it forces a layout).
  let rect: DOMRect | null = null;
  let rectAt = 0;
  const box = () => {
    const now = performance.now();
    if (!rect || now - rectAt > 100) {
      rect = element.getBoundingClientRect();
      rectAt = now;
    }
    return rect;
  };
  const local = (cx: number, cy: number): [number, number] => {
    const r = box();
    return [cx - r.left, cy - r.top];
  };
  const world = (cx: number, cy: number): Vec2 => view.toWorld(...local(cx, cy));
  const toClient = (x: number, z: number): [number, number] => {
    const r = box();
    const [sx, sy] = view.toScreen(x, z);
    return [sx + r.left, sy + r.top];
  };
  const reach = (touch: boolean) => (touch ? 11 : 4) / view.cam.s;
  const pad = (touch: boolean) => (touch ? DRAG.grabTouch : DRAG.grabMouse) / view.cam.s;
  const hit = (cx: number, cy: number, touch = false): InkPick | null => {
    const [x, z] = world(cx, cy);
    return hitTest(ctx.model(), x, z, reach(touch), pad(touch));
  };
  const holeAt = (cx: number, cy: number, px = 9): string | null => {
    const b = bench();
    if (!b.board) return null;
    const [x, z] = world(cx, cy);
    return holeNear(b, x, z, Math.max(1.6, px / view.cam.s));
  };
  /** The drop point nearest the hot point (a magnet), and the other drop points near it that glow. */
  const snap = (cx: number, cy: number, touch: boolean, opts: { probes?: boolean; leads?: boolean; exclude?: string }): { to: Anchor | null; near: Pt[] } => {
    const b = bench();
    const model = ctx.model();
    const targets = collectTargets(b, model, opts).filter((t) => !opts.exclude || !(t.kind === "probe" || t.kind === "lead") || !hangsOn(b, t.anchor, opts.exclude));
    const to = snapTarget(b, toClient, cx, cy, touch ? DRAG.touchSnap : DRAG.mouseSnap, opts, targets);
    const near: Pt[] = [];
    const r = box();
    for (const t of targets) {
      if (t.anchor === to || isHole(t.anchor) || (opts.exclude && t.anchor.startsWith(opts.exclude))) continue;
      const [sx, sy] = toClient(t.pos[0], t.pos[2]);
      if (Math.hypot(sx - cx, sy - cy) < DRAG.near) near.push({ x: sx - r.left, y: sy - r.top });
    }
    return { to, near: near.slice(0, 8) };
  };
  const partCenter = (id: string): Vec2 | null => {
    const b = bench();
    const p = b.parts.find((x) => x.id === id);
    return p ? ops.partCenter(b, p) : null;
  };
  /** A client point the bench does not take a drop at: off the bench, or over its chrome (the tray, the toolbar). */
  const offBench = (cx: number, cy: number): boolean => {
    const r = box();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return true;
    return !!(document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest?.("[data-ink-ui]");
  };

  const capture = (id: number) => {
    try {
      element.setPointerCapture(id);
    } catch {
      // Not an active pointer (a synthetic event): the drag still works while the pointer stays over the bench.
    }
  };

  let gesture: Gesture | null = null;
  /** The drag in hand, from the bench or from the tray (Escape, the edge pan and the rise act on it). */
  let active: Gesture | null = null;
  let pinch: Pinch | null = null;
  const pointers = new Map<number, [number, number]>();
  let hoverFrame = 0;
  let tickFrame = 0;
  /** A glide back running through the store (a clip or probe going home): finished at once by the next press. */
  let glide: { frame: number; end: () => void } | null = null;
  const lifter = new LiftAnimator((id, l) => ctx.lift?.(id, l));

  const newGesture = (e: { pointerId: number; clientX: number; clientY: number }, touch: boolean, pick: InkPick | null, button = 0): Gesture => ({
    pointerId: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    pick,
    drag: null,
    moved: false,
    touch,
    longPress: null,
    hole: null,
    button,
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
    if (reducedMotion() || typeof requestAnimationFrame !== "function") {
      step(1);
      end();
      return;
    }
    const t0 = performance.now();
    const g = { frame: 0, end };
    const frame = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      step(easeOut(t));
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

  const beginDrag = (g: Gesture): Drag | null => {
    const p = g.pick;
    if (!p) return null;
    const b = bench();
    const locked = store.getState().locked;
    switch (p.type) {
      case "part":
      case "press":
      case "flip":
      case "setting": {
        if (p.type === "press") return { kind: "press", id: p.id };
        if (locked.includes(p.id)) return null;
        const c = partCenter(p.id);
        if (!c) return null;
        const [x, z] = world(g.x0, g.y0);
        return { kind: "part", id: p.id, offset: [x - c[0], z - c[1]] };
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
        if (!b.meter) return null;
        const [x, z] = world(g.x0, g.y0);
        return { kind: "meter", offset: [x - b.meter.pos[0], z - b.meter.pos[1]] };
      }
      case "dial":
      case "dialMode":
        return { kind: "dial" };
    }
  };

  /** Where the dragged thing is drawn now (client px), so a grab keeps its hold on it instead of jumping to the pointer. */
  const itemAt = (d: Drag): [number, number] | null => {
    const m = ctx.model();
    let p: Vec2 | null = null;
    if (d.kind === "clip") p = m.leads.get(d.id)?.[d.end].tip ?? null;
    else if (d.kind === "probe") p = m.meter?.probes[d.color].tip ?? null;
    else if (d.kind === "wireEnd") p = m.wires.get(d.id)?.[d.end] ?? null;
    else if (d.kind === "leg") {
      const pi = m.parts.get(d.id);
      p = (d.flying ? pi?.ends?.[d.leg]?.pos : pi?.legs[d.leg]) ?? null;
    }
    return p ? toClient(p[0], p[1]) : null;
  };

  /**
   * For a gate: the clip lead whose cable, as drawn here, passes nearest a desk point, and how far along it (the cable
   * bows well off the line between its clips, so the straight-line test in ops picks the wrong lead mid-span).
   */
  const cableAt = (id: string, x: number, z: number, touch: boolean): { lead: string; at: number } | null => {
    if (store.getState().bench.parts.find((p) => p.id === id)?.kind !== "gate") return null;
    const reach = (touch ? 30 : 20) / view.cam.s;
    let best: { lead: string; at: number } | null = null;
    let bestD = reach;
    for (const li of ctx.model().leads.values()) {
      for (let i = 2; i <= 38; i++) {
        const t = i / 40;
        const p = leadPoint(li, t).at;
        const d = Math.hypot(p[0] - x, p[1] - z);
        if (d < bestD) {
          bestD = d;
          best = { lead: li.lead.id, at: Math.round(Math.max(0.15, Math.min(0.85, t)) * 100) / 100 };
        }
      }
    }
    return best;
  };

  /** Draws a dragged part where the pointer holds it, off the place the state gives it (a magnet near it, with a mouse). */
  const liftPart = (g: Gesture, id: string, to: Vec2) => {
    const c = partCenter(id) ?? to;
    let dx = to[0] - c[0];
    let dz = to[1] - c[1];
    if (!g.touch && Math.hypot(dx, dz) * view.cam.s < DRAG.mouseSnap) dx = dz = 0;
    const t = liftT(g);
    lifter.set(id, { dx, dz, k: 1 + (DRAG.liftScale - 1) * t, h: t });
  };

  /** Feeds the marks (and the loupe, on touch) for the drag at hot point (hx, hy). */
  const feedback = (g: Gesture, hx: number, hy: number, near: Pt[] = []) => {
    const d = g.drag;
    if (!d) return;
    const st = store.getState();
    const [lx, ly] = local(hx, hy);
    if (ctx.marks && ctx.loupe && carries(d) && d.kind !== "meter" && d.kind !== "wireNew") {
      const m = ctx.model();
      const r = box();
      const marks = dragMarks(st.bench, { kind: d.kind, id: "id" in d ? d.id : undefined, leg: d.kind === "leg" ? d.leg : undefined, end: "end" in d ? d.end : undefined, color: "color" in d ? d.color : undefined }, {
        snap: st.ui.snapTarget,
        hot: { x: lx, y: ly },
        invalid: g.invalid,
        near,
        labels: ctx.loupe.labels(),
        r: ringFor(PITCH * view.cam.s),
        project: (a) => {
          const p = targetPoint(m, a);
          if (!p) return null;
          const [sx, sy] = toClient(p[0], p[1]);
          return { x: sx - r.left, y: sy - r.top };
        },
      });
      // Under a finger the loupe names the drop point.
      if (g.touch) marks.name = null;
      ctx.marks.set(marks);
    }
    // A finger hides what it touches: the loupe shows it, and names where a drop would land.
    if (g.touch && ctx.loupe && (d.kind === "clip" || d.kind === "probe" || d.kind === "part" || d.kind === "leg" || d.kind === "wireEnd")) {
      ctx.loupe.feed.set({ x: lx, y: ly, name: dragName(st.bench, d as Parameters<typeof dragName>[1], st.ui.snapTarget, ctx.loupe.labels()) });
    }
  };

  const clearFeedback = () => {
    ctx.loupe?.feed.set(null);
    ctx.marks?.set(null);
  };

  const dragMove = (g: Gesture, cx: number, cy: number) => {
    const d = g.drag!;
    g.last = [cx, cy];
    if (g.done) return;
    const s = store.getState();
    if (d.kind === "pan") {
      const [lx, ly] = local(cx, cy);
      view.set({ s: view.cam.s, x: view.cam.x - (lx - d.last[0]) / view.cam.s, z: view.cam.z - (ly - d.last[1]) / view.cam.s }, true);
      d.last = [lx, ly];
      return;
    }
    const [hx, hy] = hotOf(g, cx, cy);
    const [x, z] = world(hx, hy);
    let near: Pt[] = [];
    g.invalid = carries(d) && d.kind !== "wireNew" && offBench(hx, hy);
    switch (d.kind) {
      case "part": {
        // On its way it never sits in a holder: passing over a full bin must not push a part out of it. A gate clips
        // onto the cable drawn under it (else the straight-line test in ops decides).
        const to: Vec2 = [x - d.offset[0], z - d.offset[1]];
        d.to = to;
        d.cable = cableAt(d.id, to[0], to[1], g.touch);
        const cable = d.cable;
        s.apply((b) => (cable ? ops.clipGate(b, d.id, to, cable) : ops.movePart(b, d.id, to, { seat: false })));
        g.invalid ||= partMisfit(bench(), d.id, to);
        liftPart(g, d.id, to);
        break;
      }
      case "leg":
        s.apply((b) => (d.flying ? ops.moveFlyingLeg(b, d.id, d.leg, [x, z]) : ops.moveSpanLeg(b, d.id, d.leg, [x, z])));
        break;
      case "wireEnd":
        s.apply((b) => ops.moveWireEnd(b, d.id, d.end, [x, z]));
        break;
      case "wireNew": {
        const h = holeAt(cx, cy);
        setUi({ wireDraft: { from: d.from, to: [x, 0, z], target: h && h !== d.from ? h : null } });
        break;
      }
      case "clip": {
        const t = snap(hx, hy, g.touch, { probes: true, exclude: `lead:${d.id}.` });
        near = t.near;
        setUi({ snapTarget: t.to });
        s.apply((b) => ops.clipLead(b, d.id, d.end, t.to, [x, z]));
        break;
      }
      case "probe": {
        // Probe tips land on leads, holes, clips (even one lying loose) or the other probe's tip.
        const t = snap(hx, hy, g.touch, { leads: true, probes: true, exclude: `probe:${d.color}` });
        near = t.near;
        setUi({ snapTarget: t.to });
        s.apply((b) => ops.touchProbe(b, d.color, t.to, [x, z]));
        break;
      }
      case "plug": {
        const m = s.bench.meter;
        if (!m) return;
        let sock = nearestSocket(m, x, z, Math.max(10, (g.touch ? DRAG.touchSnap : DRAG.mouseSnap) / view.cam.s));
        // Passing over the other plug's socket must not knock it out.
        if (sock && m.probes[d.color === "red" ? "black" : "red"].socket === sock) sock = null;
        s.apply((b) => ops.plugProbe(b, d.color, sock, [x, z]));
        break;
      }
      case "meter":
        s.apply((b) => ops.moveMeter(b, [x - d.offset[0], z - d.offset[1]]));
        break;
      case "dial": {
        const mode = dialModeAt(s.bench, x, z);
        if (mode) s.apply((b) => ops.setMeterMode(b, mode));
        break;
      }
      case "rotor": {
        const pi = ctx.model().parts.get(d.id);
        if (!pi) return;
        const c = actuatorFrame(pi);
        const [lx, lz] = toLocal(pi.f, x, z);
        let a = Math.atan2(lx - c[0], -(lz - c[1]));
        a = Math.max(-Math.PI * 0.75, Math.min(Math.PI * 0.75, a));
        const position = Math.round((a / (Math.PI * 1.5) + 0.5) * 100) / 100;
        s.apply((bb) => ops.setPartParams(bb, d.id, { position }));
        break;
      }
      case "draw": {
        // The pencil runs from the card's 0 mark to the farthest point the stroke reaches (0.5 cm steps).
        const card = s.bench.parts.find((p) => p.id === d.id);
        if (card?.kind !== "card") return;
        const [lx] = rotateXZ(x - card.pos[0], z - card.pos[1], -card.rot);
        d.reach = Math.max(d.reach, Math.max(0, Math.min(10, Math.round(((lx - CARD.x0) / 10) * 2) / 2)));
        const next = ops.penStroke(d.base, d.reach);
        if (next.length !== card.params.length || next.layers !== card.params.layers) s.apply((b) => ops.setPartParams<"card">(b, d.id, next));
        break;
      }
      default:
        break;
    }
    feedback(g, hx, hy, near);
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
      const [lx, ly] = local(g.last[0], g.last[1]);
      const [vx, vy] = edgeVelocity(lx, ly, view.vp.w, view.vp.h, ctx.covered?.() ?? {});
      if (vx || vy) {
        g.edgeAt ??= now;
        if (now - g.edgeAt > DRAG.edgeDwell) {
          const s = view.cam.s;
          view.set({ s, x: view.cam.x + vx / s, z: view.cam.z + vy / s }, true);
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

  /** A drag that does not take (or Escape): the item glides back to where it came from, and nothing changes. */
  const glideBack = (g: Gesture) => {
    const d = g.drag;
    const s = store.getState();
    g.done = true;
    clearFeedback();
    stopTick();
    setUi({ snapTarget: null, dragging: false });
    element.style.cursor = "";
    if (!d || !s.txBase) {
      if (s.txBase) s.cancel();
      return;
    }
    const base = s.txBase;
    if (d.kind === "part") {
      const now = partCenter(d.id) ?? [0, 0];
      const free = d.to ?? now;
      const cur = lifter.cur;
      if (d.spawned) {
        // Back into the tray: it glides to its slot there and is gone.
        const home = g.home ? world(g.home[0], g.home[1]) : free;
        lifter.set(d.id, { dx: free[0] - now[0], dz: free[1] - now[1], k: cur.k, h: cur.h });
        lifter.to(d.id, { dx: home[0] - now[0], dz: home[1] - now[1], k: 0.6, h: 0 }, DRAG.glideMs, () => {
          lifter.clear();
          if (store.getState().txBase) store.getState().cancel();
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
    const from = g.last ? world(...hotOf(g, g.last[0], g.last[1])) : null;
    const home = (p: Vec2): Vec2 => (g.home ? world(g.home[0], g.home[1]) : p);
    let path: ((t: number) => void) | null = null;
    if (from && d.kind === "clip") {
      const e = base.leads.find((x) => x.id === d.id)?.[d.end];
      let to: Vec2 | null = null;
      if (d.spawned) to = home(from);
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
      return;
    }
    animate(DRAG.glideMs, path, () => {
      if (store.getState().txBase) store.getState().cancel();
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
    if (!d || d.kind === "pan" || g.done) return;
    if (d.kind === "press") {
      s.press(d.id, false);
      return;
    }
    if (d.kind === "wireNew") {
      const draft = s.ui.wireDraft;
      if (draft?.target) s.addWire(draft.from, draft.target);
      setUi({ wireDraft: null });
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

  /** Flips a toggle or slide switch (a tap on it, or a short drag on its lever). */
  const flip = (id: string) => {
    const s = store.getState();
    const part = s.bench.parts.find((x) => x.id === id);
    if (part && isThrowSwitch(part.kind)) s.setParams<"slide-switch">(id, { to: (part.params as { to: string }).to === "a" ? "b" : "a" });
  };

  const click = (g: Gesture, cx: number, cy: number) => {
    const s = store.getState();
    const p = g.pick;
    const ro = ctx.readOnly();
    if (s.ui.menu) setUi({ menu: null });
    if (s.ui.armed && !ro && api.placeAt(s.ui.armed, cx, cy)) return;
    // Second click of a click-click wire.
    if (s.ui.mode === "wire" && !ro) {
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
      setUi({ hover: g.touch && h ? `hole:${h}` : g.touch ? null : s.ui.hover });
      s.select(null);
      return;
    }
    switch (p.type) {
      case "part":
      case "leg":
      case "rotor":
      case "draw":
      case "press":
        s.select({ type: "part", id: p.id });
        break;
      case "setting":
        if (!ro) s.setParams(p.id, ops.settingParams(s.bench, p.id, p.key, p.value) as never);
        break;
      case "flip":
        // Flipping is the whole action: no selection bar popping up over what the switch just turned on.
        if (!ro) flip(p.id);
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
        if (ro) break;
        const m = s.bench.meter;
        if (m) {
          // A tap on the knob turns it to the position tapped; a tap on its middle, one step on.
          const [x, z] = world(cx, cy);
          const at = dialModeAt(s.bench, x, z);
          const i = DIAL_MODES.indexOf(m.mode as (typeof DIAL_MODES)[number]);
          s.setMeterMode(at ?? DIAL_MODES[(i + 1) % DIAL_MODES.length]!);
        }
        break;
      }
      case "dialMode":
        if (!ro) s.setMeterMode(p.mode);
        break;
    }
  };

  const openMenu = (g: Gesture, cx: number, cy: number) => {
    const s = store.getState();
    const p = g.pick;
    if (!p || ctx.readOnly()) return;
    const sel = selectionFor(p, s.bench);
    if (s.txBase) s.cancel();
    s.select(sel);
    const [x, y] = local(cx, cy);
    setUi({ menu: { x, y, selection: sel, at: performance.now() }, dragging: false });
  };

  // ---- DOM listeners ----------------------------------------------------------------------------------------

  const startPinch = () => {
    const ids = [...pointers.keys()].slice(0, 2) as [number, number];
    const a = pointers.get(ids[0])!;
    const b = pointers.get(ids[1])!;
    pinch = { ids, d0: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), mid0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cam0: { ...view.cam } };
  };

  const onDown = (e: PointerEvent) => {
    rect = null;
    // Overlay controls (buttons, tray) handle themselves.
    if ((e.target as HTMLElement | null)?.closest?.("[data-ink-ui]")) return;
    const touch = e.pointerType !== "mouse";
    pointers.set(e.pointerId, local(e.clientX, e.clientY));
    if (pointers.size === 2 && touch) {
      // A second finger: unless something is already being dragged, the two fingers pan and zoom.
      const g = gesture;
      if (!g || !g.moved || g.drag?.kind === "pan") {
        if (g?.longPress) clearTimeout(g.longPress);
        if (g?.drag?.kind === "press") store.getState().press(g.drag.id, false);
        if (store.getState().txBase) store.getState().cancel();
        lifter.clear();
        gesture = null;
        active = null;
        clearFeedback();
        setUi({ dragging: false, snapTarget: null });
        startPinch();
      }
      return;
    }
    if (gesture) return;
    // A glide back still running ends now, where it was going.
    finishGlide();
    if (e.pointerType === "mouse" && e.button !== 0) {
      if (e.button === 2) {
        const p = hit(e.clientX, e.clientY);
        if (p) {
          e.preventDefault();
          openMenu(newGesture(e, false, p, 2), e.clientX, e.clientY);
          return;
        }
      }
      // Right or middle drag on paper pans.
      gesture = { ...newGesture(e, false, null, e.button), drag: { kind: "pan", last: local(e.clientX, e.clientY) } };
      capture(e.pointerId);
      return;
    }
    const pick = hit(e.clientX, e.clientY, touch);
    const s = store.getState();
    const g = newGesture(e, touch, pick);
    gesture = g;
    capture(e.pointerId);
    if (ctx.readOnly()) {
      g.pick = null;
      return;
    }
    const wiring = s.ui.mode === "wire" && (!pick || pick.type === "part" || pick.type === "wire");
    if (wiring) {
      const h = holeAt(e.clientX, e.clientY);
      if (h) {
        g.hole = h;
        return;
      }
    }
    if (pick) {
      if (pick.type === "press") {
        s.press(pick.id, true);
        g.drag = { kind: "press", id: pick.id };
      }
      g.longPress = window.setTimeout(() => {
        if (gesture === g && !g.moved && !g.flipped && pick.type !== "press") {
          openMenu(g, g.x0, g.y0);
          gesture = null;
        }
      }, 520);
    }
  };

  const onMove = (e: PointerEvent) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, local(e.clientX, e.clientY));
    if (pinch && pinch.ids.includes(e.pointerId)) {
      const a = pointers.get(pinch.ids[0]);
      const b = pointers.get(pinch.ids[1]);
      if (!a || !b) return;
      const d = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const c0 = pinch.cam0;
      const s = Math.min(60, Math.max(0.6, (c0.s * d) / pinch.d0));
      // The desk point under the first midpoint follows the fingers.
      const wx = (pinch.mid0[0] - view.vp.w / 2) / c0.s + c0.x;
      const wz = (pinch.mid0[1] - view.vp.h / 2) / c0.s + c0.z;
      view.set({ s, x: wx - (mid[0] - view.vp.w / 2) / s, z: wz - (mid[1] - view.vp.h / 2) / s }, true);
      return;
    }
    const g = gesture;
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
      if (g.pick?.type === "flip" && !g.hole && !g.drag) {
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
      if (g.drag?.kind === "pan") {
        // Already panning (right or middle button).
      } else if (g.hole && !g.drag) {
        g.drag = { kind: "wireNew", from: g.hole };
        setUi({ wireDraft: { from: g.hole, to: null, target: null } });
      } else if (g.pick && !g.drag) {
        g.drag = beginDrag(g);
        if (g.drag) {
          s.begin();
          g.dragAt = performance.now();
          const at = itemAt(g.drag);
          if (at) g.off = [at[0] - g.x0, at[1] - g.y0];
          // Picked up: the hand closes and the hover x-ray goes.
          setUi({ dragging: true, menu: null, hover: null });
          if (g.drag.kind !== "dial" && g.drag.kind !== "draw") s.select(selectionFor(g.pick, s.bench));
          if (carries(g.drag)) {
            element.style.cursor = "grabbing";
            active = g;
            startTick();
          }
        } else {
          g.drag = { kind: "pan", last: local(g.x0, g.y0) };
        }
      } else if (!g.drag) {
        g.drag = { kind: "pan", last: local(g.x0, g.y0) };
      }
    }
    if (g.drag && g.drag.kind !== "press") dragMove(g, e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pinch && pinch.ids.includes(e.pointerId)) {
      pinch = null;
      return;
    }
    const g = gesture;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture = null;
    if (active === g) active = null;
    if (g.longPress) clearTimeout(g.longPress);
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
    if (g.button !== 0) return;
    if (g.done) return;
    if (g.drag && g.moved) {
      endDrag(g);
    } else if (g.drag?.kind === "press") {
      store.getState().press(g.drag.id, false);
      click(g, e.clientX, e.clientY);
    } else if (!g.moved && !g.flipped) {
      const s = store.getState();
      if (g.hole && s.ui.mode === "wire") {
        const draft = s.ui.wireDraft;
        if (draft && draft.from !== g.hole) {
          s.addWire(draft.from, g.hole);
          setUi({ wireDraft: null });
        } else setUi({ wireDraft: { from: g.hole, to: null, target: null } });
      } else click(g, e.clientX, e.clientY);
    }
  };

  const onCancel = (e: PointerEvent) => {
    clearFeedback();
    pointers.delete(e.pointerId);
    if (pinch && pinch.ids.includes(e.pointerId)) pinch = null;
    const g = gesture;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture = null;
    if (active === g) active = null;
    stopTick();
    if (g.longPress) clearTimeout(g.longPress);
    const s = store.getState();
    if (g.drag?.kind === "press") s.press(g.drag.id, false);
    element.style.cursor = "";
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
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      const s = store.getState();
      const p = hit(cx, cy);
      let hover: Anchor | null = null;
      if (!p || p.type === "part" || p.type === "wire" || p.type === "meter") {
        const h = holeAt(cx, cy, 7);
        if (h) hover = `hole:${h}`;
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
        ? p.type === "press" || p.type === "flip" || p.type === "dialMode" || p.type === "setting" || p.type === "dial"
          ? "pointer"
          : p.type === "draw"
            ? "crosshair"
            : p.type === "wire" || fixed
              ? ""
              : "grab"
        : hover && s.ui.mode === "wire"
          ? "crosshair"
          : "";
    });
  };

  const onLeave = (e: PointerEvent) => {
    // Touch pointers "leave" when lifted; keep the tapped hole's x-ray showing.
    if (e.pointerType !== "mouse") return;
    if (store.getState().ui.hover) setUi({ hover: null });
  };
  const onContext = (e: MouseEvent) => e.preventDefault();
  const onWheel = (e: WheelEvent) => {
    if ((e.target as HTMLElement | null)?.closest?.("[data-ink-ui]")) return;
    e.preventDefault();
    const [x, y] = local(e.clientX, e.clientY);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    // Trackpads send small steps (and ctrl for a pinch); wheels send big ones. Either way, zoom toward the pointer.
    const k = e.ctrlKey ? 0.01 : 0.0022;
    view.zoomAt(x, y, Math.exp(-dy * k));
  };

  element.addEventListener("pointerdown", onDown, { capture: true });
  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onCancel);
  element.addEventListener("pointerleave", onLeave);
  element.addEventListener("contextmenu", onContext);
  element.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey, { capture: true });

  // ---- API for the chrome ----------------------------------------------------------------------------------

  const placeItem = (item: TrayItem, at: Vec2): string | null => {
    const s = store.getState();
    if (item.kind === "lead") {
      const color = item.params?.color ?? s.ui.leadColor;
      // End b lands under the pointer, end a rests on the desk a little to the left.
      return s.addLead(color, [at[0] - 40, at[1] - 6], item.id);
    }
    const id = s.addPart(item.kind, (item.params ?? {}) as never, { pos: at }, item.id);
    // Let it snap into the board, or into a free seat of a holder, if it lands there.
    store.getState().apply((b) => ops.movePart(b, id, at, { seat: "free" }));
    return id;
  };

  const api: InkApi = {
    startSpawn: (item, e) => {
      if (ctx.readOnly()) return;
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
        s.begin();
        const id = placeItem(item, world(hx, hy));
        spawned = true;
        g.spawn = null;
        g.moved = true;
        if (id && item.kind !== "lead") {
          g.drag = { kind: "part", id, offset: [0, 0], spawned: true };
          s.select({ type: "part", id });
        } else if (id) g.drag = { kind: "clip", id, end: "b", spawned: true };
        setUi({ dragging: true, armed: null, hover: null });
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
          // Bring the other clip of a new lead next to the one just placed, toward the middle of the work area.
          const id = g.drag.id;
          st.apply((b) => {
            const l = b.leads.find((x) => x.id === id);
            if (!l || l.a.to) return b;
            const at = l.b.to ? anchorPosition(b, l.b.to) : ([l.b.pos[0], 0, l.b.pos[1]] as [number, number, number]);
            if (!at) return b;
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
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    placeAt: (item, cx, cy) => {
      api.placeAtWorld(item, world(cx, cy));
      return true;
    },
    placeAtWorld: (item, at) => {
      const s = store.getState();
      s.begin();
      const id = placeItem(item, at);
      s.commit();
      setUi({ armed: null });
      if (id) {
        if (item.kind === "lead") emit({ type: "lead:add", leadId: id });
        else {
          emit({ type: "part:add", partId: id, kind: item.kind });
          s.select({ type: "part", id });
        }
      }
      return id;
    },
    pickAt: (x, y) => hit(x, y),
  };

  return {
    api,
    detach: () => {
      element.removeEventListener("pointerdown", onDown, { capture: true });
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onCancel);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("contextmenu", onContext);
      element.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey, { capture: true });
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      stopTick();
      finishGlide();
      lifter.clear();
    },
  };
}

/** Attach points for a dragged clip or probe, as the ink view draws them (probe tips and clips where they are drawn). */
function collectTargets(b: BenchState, model: InkModel, opts: { probes?: boolean; leads?: boolean }) {
  const out: { anchor: Anchor; pos: [number, number, number]; kind: "pin" | "hole" | "wire" | "probe" | "lead" }[] = [];
  for (const pi of model.parts.values()) for (const [leg, p] of Object.entries(pi.legs)) out.push({ anchor: `pin:${pi.part.id}.${leg}`, pos: [p[0], 0, p[1]], kind: "pin" });
  for (const wi of model.wires.values()) {
    out.push({ anchor: `wire:${wi.wire.id}.a`, pos: [wi.a[0], 0, wi.a[1]], kind: "wire" });
    out.push({ anchor: `wire:${wi.wire.id}.b`, pos: [wi.b[0], 0, wi.b[1]], kind: "wire" });
  }
  if (b.board) {
    for (const p of holePositions(b)) out.push(p);
  }
  if (opts.probes && model.meter) for (const c of ["red", "black"] as const) out.push({ anchor: `probe:${c}`, pos: [model.meter.probes[c].tip[0], 0, model.meter.probes[c].tip[1]], kind: "probe" });
  if (opts.leads) for (const li of model.leads.values()) for (const end of ["a", "b"] as const) out.push({ anchor: `lead:${li.lead.id}.${end}`, pos: [li[end].tip[0], 0, li[end].tip[1]], kind: "lead" });
  return out;
}

const holeCache = new WeakMap<object, { anchor: Anchor; pos: [number, number, number]; kind: "hole" }[]>();
function holePositions(b: BenchState) {
  const key = b.board!;
  let hit = holeCache.get(key);
  if (!hit) {
    hit = [];
    const g = boardGeometry(key);
    const [ox, oz] = boardOrigin(key);
    for (const h of g.holes.values()) hit.push({ anchor: `hole:${h.id}`, pos: [ox + h.x, 0, oz + h.z], kind: "hole" });
    holeCache.set(key, hit);
  }
  return hit;
}
