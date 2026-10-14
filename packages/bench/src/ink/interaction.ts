// Pointer, touch and wheel handling for the ink view. The same gestures as the 3D bench, through the same store
// actions and bench ops, so labs, goals and solutions behave the same in either view. Empty-paper drags pan, the wheel
// and two fingers zoom.

import { parseAnchor } from "../anchors";
import { boardGeometry, boardOrigin } from "../board";
import { CARD } from "../dims";
import { DIAL_MODES, METER, anchorPosition, nearestSocket, workCenter } from "../layout";
import * as ops from "../ops";
import { isThrowSwitch, rotateXZ } from "../parts";
import type { BenchStore } from "../store";
import type { Anchor, BenchAction, BenchState, MeterMode, Selection, TrayItem, Vec2 } from "../types";
import { toLocal } from "./frame";
import { holeNear, hitTest, snapTarget } from "./hit";
import { actuatorFrame, type InkModel, type InkPick, leadPoint } from "./model";
import type { InkView } from "./view";
import type { BenchLabels } from "../labels";
import { TOUCH_SNAP, dragName, type LoupeFeed } from "../view/Loupe";

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
  | { kind: "clip"; id: string; end: "a" | "b" }
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
  const hit = (cx: number, cy: number, touch = false): InkPick | null => {
    const [x, z] = world(cx, cy);
    return hitTest(ctx.model(), x, z, reach(touch));
  };
  const holeAt = (cx: number, cy: number, px = 9): string | null => {
    const b = bench();
    if (!b.board) return null;
    const [x, z] = world(cx, cy);
    return holeNear(b, x, z, Math.max(1.6, px / view.cam.s));
  };
  const snap = (cx: number, cy: number, touch: boolean, opts: { probes?: boolean; leads?: boolean; exclude?: string }): Anchor | null => {
    const b = bench();
    const model = ctx.model();
    const targets = collectTargets(b, model, opts).filter((t) => !opts.exclude || !(t.kind === "probe" || t.kind === "lead") || !hangsOn(b, t.anchor, opts.exclude));
    return snapTarget(b, toClient, cx, cy, touch ? TOUCH_SNAP : 26, opts, targets);
  };
  const partCenter = (id: string): Vec2 | null => {
    const b = bench();
    const p = b.parts.find((x) => x.id === id);
    return p ? ops.partCenter(b, p) : null;
  };

  const capture = (id: number) => {
    try {
      element.setPointerCapture(id);
    } catch {
      // Not an active pointer (a synthetic event): the drag still works while the pointer stays over the bench.
    }
  };

  let gesture: Gesture | null = null;
  let pinch: Pinch | null = null;
  const pointers = new Map<number, [number, number]>();
  let hoverFrame = 0;

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

  const dragMove = (g: Gesture, cx: number, cy: number) => {
    const d = g.drag!;
    const s = store.getState();
    const [x, z] = world(cx, cy);
    switch (d.kind) {
      case "pan": {
        const [lx, ly] = local(cx, cy);
        view.set({ s: view.cam.s, x: view.cam.x - (lx - d.last[0]) / view.cam.s, z: view.cam.z - (ly - d.last[1]) / view.cam.s }, true);
        d.last = [lx, ly];
        return;
      }
      case "part": {
        // On its way it never sits in a holder: passing over a full bin must not push a part out of it. A gate clips
        // onto the cable drawn under it (else the straight-line test in ops decides).
        const to: Vec2 = [x - d.offset[0], z - d.offset[1]];
        d.to = to;
        d.cable = cableAt(d.id, to[0], to[1], g.touch);
        const cable = d.cable;
        s.apply((b) => (cable ? ops.clipGate(b, d.id, to, cable) : ops.movePart(b, d.id, to, { seat: false })));
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
        const t = snap(cx, cy, g.touch, { probes: true, exclude: `lead:${d.id}.` });
        setUi({ snapTarget: t });
        s.apply((b) => ops.clipLead(b, d.id, d.end, t, [x, z]));
        break;
      }
      case "probe": {
        // Probe tips land on leads, holes, clips (even one lying loose) or the other probe's tip.
        const t = snap(cx, cy, g.touch, { leads: true, probes: true, exclude: `probe:${d.color}` });
        setUi({ snapTarget: t });
        s.apply((b) => ops.touchProbe(b, d.color, t, [x, z]));
        break;
      }
      case "plug": {
        const m = s.bench.meter;
        if (!m) return;
        let sock = nearestSocket(m, x, z, 10);
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
    // A finger hides what it touches: the loupe shows it, and names where a drop would land.
    if (g.touch && ctx.loupe && (d.kind === "clip" || d.kind === "probe" || d.kind === "part" || d.kind === "leg" || d.kind === "wireEnd")) {
      const [lx, ly] = local(cx, cy);
      const st = store.getState();
      ctx.loupe.feed.set({ x: lx, y: ly, name: dragName(st.bench, d as Parameters<typeof dragName>[1], st.ui.snapTarget, ctx.loupe.labels()) });
    }
  };

  const endDrag = (g: Gesture) => {
    ctx.loupe?.feed.set(null);
    const d = g.drag;
    const s = store.getState();
    if (!d || d.kind === "pan") return;
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
    if (d.kind === "part") {
      // Dropped right on a part of the same kind: the two swap places and wiring (a fresh LED for a dead one).
      const target = ops.swapTarget(s.bench, d.id);
      if (target && !s.locked.includes(target.id)) {
        const from = s.txBase?.parts.find((p) => p.id === d.id)?.pos ?? ([target.pos[0], target.pos[1] + 34] as Vec2);
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
      case "flip": {
        if (ro) break;
        const part = s.bench.parts.find((x) => x.id === p.id);
        // Flipping is the whole action: no selection bar popping up over what the switch just turned on.
        if (part && isThrowSwitch(part.kind)) s.setParams<"slide-switch">(p.id, { to: (part.params as { to: string }).to === "a" ? "b" : "a" });
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
        if (ro) break;
        const m = s.bench.meter;
        if (m) {
          const i = DIAL_MODES.indexOf(m.mode as (typeof DIAL_MODES)[number]);
          s.setMeterMode(DIAL_MODES[(i + 1) % DIAL_MODES.length]!);
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
        gesture = null;
        ctx.loupe?.feed.set(null);
        setUi({ dragging: false, snapTarget: null });
        startPinch();
      }
      return;
    }
    if (gesture) return;
    if (e.pointerType === "mouse" && e.button !== 0) {
      if (e.button === 2) {
        const p = hit(e.clientX, e.clientY);
        if (p) {
          e.preventDefault();
          openMenu({ pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, pick: p, drag: null, moved: false, touch: false, longPress: null, hole: null, button: 2 }, e.clientX, e.clientY);
          return;
        }
      }
      // Right or middle drag on paper pans.
      gesture = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, pick: null, drag: { kind: "pan", last: local(e.clientX, e.clientY) }, moved: false, touch: false, longPress: null, hole: null, button: e.button };
      capture(e.pointerId);
      return;
    }
    const pick = hit(e.clientX, e.clientY, touch);
    const s = store.getState();
    const g: Gesture = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, pick, drag: null, moved: false, touch, longPress: null, hole: null, button: 0 };
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
        if (gesture === g && !g.moved && pick.type !== "press") {
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
      if (e.pointerType === "mouse" && !g) scheduleHover(e.clientX, e.clientY);
      return;
    }
    if (!g.moved) {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < (g.touch ? 8 : 4)) return;
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
          setUi({ dragging: true, menu: null });
          if (g.drag.kind !== "dial" && g.drag.kind !== "draw") s.select(selectionFor(g.pick, s.bench));
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
    if (g.longPress) clearTimeout(g.longPress);
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
    if (g.button !== 0) return;
    if (g.drag && g.moved) {
      endDrag(g);
    } else if (g.drag?.kind === "press") {
      store.getState().press(g.drag.id, false);
      click(g, e.clientX, e.clientY);
    } else if (!g.moved) {
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
    ctx.loupe?.feed.set(null);
    pointers.delete(e.pointerId);
    if (pinch && pinch.ids.includes(e.pointerId)) pinch = null;
    const g = gesture;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture = null;
    if (g.longPress) clearTimeout(g.longPress);
    const s = store.getState();
    if (g.drag?.kind === "press") s.press(g.drag.id, false);
    if (s.txBase) s.cancel();
    setUi({ dragging: false, snapTarget: null });
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
      element.style.cursor = p
        ? p.type === "press" || p.type === "flip" || p.type === "dialMode" || p.type === "setting" || p.type === "dial"
          ? "pointer"
          : p.type === "draw"
            ? "crosshair"
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
      const s = store.getState();
      const g: Gesture = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, pick: null, drag: null, moved: false, touch: e.pointerType !== "mouse", longPress: null, hole: null, button: 0 };
      let spawned = false;
      const inside = (ev: PointerEvent) => {
        const r = element.getBoundingClientRect();
        return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      };
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== g.pointerId) return;
        if (!spawned) {
          if (Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) < 6 || !inside(ev)) return;
          // Not over the tray itself.
          if ((document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest?.("[data-ink-ui]")) return;
          s.begin();
          const id = placeItem(item, world(ev.clientX, ev.clientY));
          spawned = true;
          g.moved = true;
          if (id && item.kind !== "lead") {
            g.drag = { kind: "part", id, offset: [0, 0], spawned: true };
            s.select({ type: "part", id });
          } else if (id) g.drag = { kind: "clip", id, end: "b" };
          setUi({ dragging: true, armed: null });
        }
        if (g.drag) dragMove(g, ev.clientX, ev.clientY);
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== g.pointerId) return;
        ctx.loupe?.feed.set(null);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        const st = store.getState();
        if (!spawned) {
          // A tap arms the item for tap-to-place.
          setUi({ armed: st.ui.armed === item ? null : item });
          return;
        }
        if (!inside(ev) || ev.type === "pointercancel") st.cancel();
        else {
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
            if (target && !st.locked.includes(target.id)) st.apply((b) => ops.dropOnto(b, id, target.id, [target.pos[0], target.pos[1] + 34]));
          }
          st.commit();
          if (g.drag?.kind === "part") emit({ type: "part:add", partId: g.drag.id, kind: item.kind as never });
          else if (g.drag?.kind === "clip") emit({ type: "lead:add", leadId: g.drag.id });
        }
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
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
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
