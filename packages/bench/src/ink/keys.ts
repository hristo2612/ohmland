// Keyboard for the ink view. The same shortcuts as the 3D bench (arrows move the selected part, R rotates, Delete
// removes, Space flips or presses, W wire mode, X x-ray, Ctrl+Z undo), plus a cursor that walks between holes, leads
// and sockets with the arrow keys, so everything a pointer can do has a keyboard path: pick up a clip, probe or plug
// with Enter, walk it to its new place and put it down with Enter; start and finish a wire; place a tray item.

import { parseAnchor } from "../anchors";
import { boardGeometry, boardOrigin, parseHole } from "../board";
import type { BenchLabels } from "../labels";
import type { InkLabels } from "./labels";
import { DIAL_MODES, METER, socketWorld } from "../layout";
import { connectivity } from "../netlist";
import * as ops from "../ops";
import { isThrowSwitch, partLegs } from "../parts";
import type { BenchStore } from "../store";
import type { Anchor, BenchState, MeterSocket, ProbeColor, TrayItem, Vec2 } from "../types";
import { nextPoint, type NavPoint } from "./hit";
import type { InkApi } from "./interaction";
import { anchorInk, type InkModel } from "./model";
import type { InkView } from "./view";

export type Carry =
  | { kind: "clip"; id: string; end: "a" | "b" }
  | { kind: "probe"; color: ProbeColor }
  | { kind: "plug"; color: ProbeColor };

/** Where the keyboard cursor is, and what it carries. Rendered as a dashed ring; kept outside the shared store. */
export type KeyState = { cursor: { anchor: Anchor | null; pos: Vec2 } | null; carry: Carry | null };

export class KeyCursor {
  state: KeyState = { cursor: null, carry: null };
  private subs = new Set<() => void>();
  subscribe = (cb: () => void) => {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  };
  get = () => this.state;
  set(patch: Partial<KeyState>) {
    this.state = { ...this.state, ...patch };
    for (const cb of this.subs) cb();
  }
}

export type KeyEnv = {
  store: BenchStore;
  view: InkView;
  model: () => InkModel;
  api: () => InkApi | null;
  keys: KeyCursor;
  labels: InkLabels;
  readOnly: boolean;
  /** Read a sentence out to screen readers (a polite live region). */
  announce: (text: string) => void;
  /** Put focus on the cursor element. */
  focusCursor: () => void;
  /** Frame the work area again. */
  fit: () => void;
};

/** A spoken name for an attach point: "Hole E12", "R1 lead a", "Red probe". */
export function anchorName(bench: BenchState, a: Anchor, labels: BenchLabels): string {
  const p = parseAnchor(a);
  if (!p) return a;
  switch (p.type) {
    case "hole":
      return labels.hole(p.hole);
    case "pin": {
      const part = bench.parts.find((x) => x.id === p.part);
      return part ? `${p.part} ${labels.partName[part.kind] ?? part.kind}, ${p.leg}` : `${p.part} ${p.leg}`;
    }
    case "wire":
      return `${labels.wire} ${p.wire}, ${p.end}`;
    case "lead":
      return `${labels.testLead} ${p.lead}, ${p.end}`;
    case "probe":
      return `${labels.colors[p.color]} probe`;
    case "socket":
      return p.socket.toUpperCase();
  }
}

/** What a hole or lead is joined to by metal, for the screen reader ("joined to D1 cathode, W2"). */
export function joinedText(bench: BenchState, a: Anchor, labels: BenchLabels): string {
  const conn = connectivity(bench);
  const others = conn
    .members(a)
    .filter((m) => m !== a && !m.startsWith("hole:") && !m.startsWith("socket:"))
    .map((m) => anchorName(bench, m, labels));
  return others.length ? others.join("; ") : "";
}

/** Points the cursor visits for what it carries. */
function points(model: InkModel, carry: Carry | null, wire: boolean): NavPoint[] {
  const b = model.bench;
  const out: NavPoint[] = [];
  if (carry?.kind === "plug") {
    if (b.meter) for (const s of Object.keys(METER.sockets.xs) as MeterSocket[]) {
      const [x, , z] = socketWorld(b.meter, s);
      out.push({ id: `socket:${s}`, pos: [x, z] });
    }
    return out;
  }
  if (b.board) {
    const g = boardGeometry(b.board);
    const [ox, oz] = boardOrigin(b.board);
    for (const h of g.holes.values()) out.push({ id: `hole:${h.id}`, pos: [ox + h.x, oz + h.z] });
  }
  if (wire) return out;
  for (const pi of model.parts.values()) for (const [leg, p] of Object.entries(pi.legs)) out.push({ id: `pin:${pi.part.id}.${leg}`, pos: p });
  for (const wi of model.wires.values()) {
    out.push({ id: `wire:${wi.wire.id}.a`, pos: wi.a });
    out.push({ id: `wire:${wi.wire.id}.b`, pos: wi.b });
  }
  if (carry && model.meter) {
    for (const c of ["red", "black"] as const) if (!(carry.kind === "probe" && carry.color === c)) out.push({ id: `probe:${c}`, pos: model.meter.probes[c].tip });
  }
  if (carry?.kind === "probe") for (const li of model.leads.values()) for (const end of ["a", "b"] as const) out.push({ id: `lead:${li.lead.id}.${end}`, pos: li[end].tip });
  // Never onto itself.
  const self = carry?.kind === "clip" ? `lead:${carry.id}.` : carry?.kind === "probe" ? `probe:${carry.color}` : null;
  return self ? out.filter((p) => !p.id.startsWith(self)) : out;
}

function describe(env: KeyEnv, a: Anchor | null, pos: Vec2): string {
  const b = env.store.getState().bench;
  if (!a) return `${Math.round(pos[0])}, ${Math.round(pos[1])}`;
  const name = anchorName(b, a, env.labels);
  const joined = joinedText(b, a, env.labels);
  return joined ? `${name}. ${joined}` : name;
}

/** Start the cursor (at an anchor, the selection, or the middle of the work area). */
export function startCursor(env: KeyEnv, at?: Anchor | null) {
  const model = env.model();
  const st = env.keys.get();
  if (st.cursor && !at) return;
  let pos: Vec2 | null = at ? anchorInk(model, at) : null;
  let anchor: Anchor | null = at ?? null;
  if (!pos) {
    const pts = points(model, st.carry, env.store.getState().ui.mode === "wire");
    const c = model.bench.board ? boardOrigin(model.bench.board) : ([(model.work[0] + model.work[2]) / 2, (model.work[1] + model.work[3]) / 2] as Vec2);
    let best: NavPoint | null = null;
    let bestD = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.pos[0] - c[0], p.pos[1] - c[1]);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    pos = best ? best.pos : c;
    anchor = best ? best.id : null;
  }
  env.keys.set({ cursor: { anchor, pos } });
  if (anchor?.startsWith("hole:") || anchor?.startsWith("pin:")) env.store.getState().setUi({ hover: anchor });
  env.announce(describe(env, anchor, pos));
}

function moveCursor(env: KeyEnv, dir: "left" | "right" | "up" | "down", fine: boolean) {
  const st = env.keys.get();
  if (!st.cursor) {
    startCursor(env);
    return;
  }
  const model = env.model();
  const pts = points(model, st.carry, env.store.getState().ui.mode === "wire");
  const next = nextPoint(pts, st.cursor.pos, dir);
  let cursor: KeyState["cursor"];
  if (next && Math.hypot(next.pos[0] - st.cursor.pos[0], next.pos[1] - st.cursor.pos[1]) < 60) cursor = { anchor: next.id, pos: next.pos };
  else {
    // Nothing that way: walk over the desk (for placing parts off the board).
    const step = fine ? 2 : 10;
    const [dx, dz] = dir === "left" ? [-step, 0] : dir === "right" ? [step, 0] : dir === "up" ? [0, -step] : [0, step];
    cursor = { anchor: null, pos: [st.cursor.pos[0] + dx, st.cursor.pos[1] + dz] };
  }
  env.keys.set({ cursor });
  const hover = cursor.anchor && (cursor.anchor.startsWith("hole:") || cursor.anchor.startsWith("pin:") || cursor.anchor.startsWith("wire:")) ? cursor.anchor : null;
  env.store.getState().setUi({ hover });
  // Keep the cursor in view.
  const [sx, sy] = env.view.toScreen(cursor.pos[0], cursor.pos[1]);
  const m = 48;
  if (sx < m || sy < m || sx > env.view.vp.w - m || sy > env.view.vp.h - m) env.view.glide({ ...env.view.cam, x: cursor.pos[0], z: cursor.pos[1] }, 220);
  const s = env.store.getState();
  if (s.ui.mode === "wire" && s.ui.wireDraft) {
    const h = cursor.anchor?.startsWith("hole:") ? cursor.anchor.slice(5) : null;
    s.setUi({ wireDraft: { ...s.ui.wireDraft, target: h && h !== s.ui.wireDraft.from ? h : null } });
  }
  env.announce(describe(env, cursor.anchor, cursor.pos));
}

/** Pick something up to carry with the cursor. */
export function pickUp(env: KeyEnv, carry: Carry) {
  if (env.readOnly) return;
  const b = env.store.getState().bench;
  let at: Anchor | null = null;
  if (carry.kind === "clip") at = b.leads.find((l) => l.id === carry.id)?.[carry.end].to ?? null;
  else if (carry.kind === "probe") at = b.meter?.probes[carry.color].tip.to ?? null;
  else if (carry.kind === "plug") {
    const s = b.meter?.probes[carry.color].socket;
    at = s ? `socket:${s}` : null;
  }
  env.keys.set({ carry, cursor: null });
  startCursor(env, at);
  env.focusCursor();
}

function drop(env: KeyEnv, onto: Anchor | null) {
  const { carry, cursor } = env.keys.get();
  const s = env.store.getState();
  if (!carry) return;
  const pos: Vec2 = cursor ? [cursor.pos[0], cursor.pos[1] + 8] : [0, 0];
  if (carry.kind === "clip") s.clipLead(carry.id, carry.end, onto && !onto.startsWith("socket:") ? onto : null, pos);
  else if (carry.kind === "probe") s.touchProbe(carry.color, onto && !onto.startsWith("socket:") ? onto : null, pos);
  else if (carry.kind === "plug") {
    const sock = onto?.startsWith("socket:") ? (onto.slice(7) as MeterSocket) : null;
    s.plugProbe(carry.color, sock, sock ? undefined : pos);
  }
  env.keys.set({ carry: null });
  env.announce(onto ? `${env.labels.keyDropped}: ${anchorName(s.bench, onto, env.labels)}` : env.labels.keyLoose);
}

/** Handle a key on the bench. Returns true when it was used. `kb` is the focused element's role ("part:R1" ...). */
export function handleInkKey(e: KeyboardEvent, env: KeyEnv, kb: string | null): boolean {
  const s = env.store.getState();
  const ro = env.readOnly;
  const mod = e.metaKey || e.ctrlKey;
  const down = e.type === "keydown";
  if (mod && (e.key === "z" || e.key === "Z")) {
    if (ro || !down) return false;
    if (e.shiftKey) s.redo();
    else s.undo();
    return true;
  }
  if (mod && (e.key === "y" || e.key === "Y")) {
    if (!ro && down) s.redo();
    return true;
  }
  if (mod) return false;
  const st = env.keys.get();
  const onCursor = kb === "cursor";
  const arrow = e.key === "ArrowLeft" ? "left" : e.key === "ArrowRight" ? "right" : e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : null;

  // Space and Enter are used on key up too (a held pushbutton).
  if (!down) {
    if ((e.key === " " || e.key === "Enter") && s.ui.selection?.type === "part") {
      const part = s.bench.parts.find((p) => p.id === s.ui.selection!.id);
      if (part?.kind === "pushbutton") {
        s.press(part.id, false);
        return true;
      }
    }
    return false;
  }

  switch (e.key) {
    case "Escape":
      if (s.txBase) s.cancel();
      if (st.carry || st.cursor) env.keys.set({ carry: null, cursor: null });
      s.setUi({ wireDraft: null, armed: null, menu: null, hover: null });
      s.select(null);
      return true;
    case "w":
    case "W":
      if (ro || !s.bench.board) return false;
      s.setUi({ mode: s.ui.mode === "wire" ? "select" : "wire", wireDraft: null });
      env.announce(s.ui.mode === "wire" ? env.labels.select : env.labels.wireHint);
      return true;
    case "x":
    case "X":
      if (!s.bench.board) return false;
      s.setUi({ xray: !s.ui.xray });
      return true;
    case "+":
    case "=":
      env.view.zoomAt(env.view.vp.w / 2, env.view.vp.h / 2, 1.25);
      return true;
    case "-":
    case "_":
      env.view.zoomAt(env.view.vp.w / 2, env.view.vp.h / 2, 0.8);
      return true;
    case "0":
      env.fit();
      return true;
  }

  // The cursor: walk, then act where it stands.
  if (onCursor || st.carry) {
    if (arrow) {
      moveCursor(env, arrow, e.shiftKey);
      return true;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (e.repeat) return true;
      const at = st.cursor?.anchor ?? null;
      if (st.carry) {
        drop(env, at);
        return true;
      }
      if (ro) return true;
      if (s.ui.mode === "wire" && at?.startsWith("hole:")) {
        const h = at.slice(5);
        const draft = s.ui.wireDraft;
        if (draft && draft.from !== h) {
          s.addWire(draft.from, h);
          s.setUi({ wireDraft: null });
        } else s.setUi({ wireDraft: { from: h, to: null, target: null } });
        return true;
      }
      if (s.ui.armed && st.cursor) {
        env.api()?.placeAtWorld(s.ui.armed, st.cursor.pos);
        return true;
      }
      const pin = at ? parseAnchor(at) : null;
      if (pin?.type === "pin") s.select({ type: "part", id: pin.part });
      return true;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && st.carry) {
      drop(env, null);
      return true;
    }
  }

  // Things with their own keys.
  if (kb?.startsWith("clip:") || kb?.startsWith("probe:") || kb?.startsWith("plug:")) {
    if (e.key === "Enter" || e.key === " ") {
      if (kb.startsWith("clip:")) {
        const a = parseAnchor(`lead:${kb.slice(5)}`);
        if (a?.type === "lead") pickUp(env, { kind: "clip", id: a.lead, end: a.end });
      } else if (kb.startsWith("probe:")) pickUp(env, { kind: "probe", color: kb.slice(6) as ProbeColor });
      else pickUp(env, { kind: "plug", color: kb.slice(5) as ProbeColor });
      return true;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && kb.startsWith("clip:") && !ro) {
      const a = parseAnchor(`lead:${kb.slice(5)}`);
      if (a?.type === "lead") s.clipLead(a.lead, a.end, null);
      return true;
    }
  }
  if (kb === "dial" && (arrow === "left" || arrow === "right" || e.key === "Enter" || e.key === " ") && s.bench.meter && !ro) {
    const i = DIAL_MODES.indexOf(s.bench.meter.mode as (typeof DIAL_MODES)[number]);
    const dx = arrow === "left" ? -1 : 1;
    const mode = DIAL_MODES[(i + dx + DIAL_MODES.length) % DIAL_MODES.length]!;
    s.setMeterMode(mode);
    env.announce(env.labels.meterModes[mode]);
    return true;
  }

  const sel = s.ui.selection;
  switch (e.key) {
    case "r":
    case "R":
      if (ro) return false;
      s.rotateSelected();
      return true;
    case "Delete":
    case "Backspace":
      if (ro) return false;
      s.deleteSelected();
      return true;
    case " ":
    case "Enter": {
      if (ro || sel?.type !== "part") return false;
      const part = s.bench.parts.find((p) => p.id === sel.id);
      if (!part) return false;
      if (part.kind === "pushbutton") {
        if (!e.repeat) s.press(part.id, true);
        return true;
      }
      if (isThrowSwitch(part.kind)) {
        if (!e.repeat) s.setParams<"slide-switch">(part.id, { to: (part.params as { to: string }).to === "a" ? "b" : "a" });
        return true;
      }
      return false;
    }
  }
  if (arrow) {
    if (ro) return false;
    const dx = arrow === "left" ? -1 : arrow === "right" ? 1 : 0;
    const dz = arrow === "up" ? -1 : arrow === "down" ? 1 : 0;
    if ((sel?.type === "meter" || kb === "meter") && s.bench.meter && dz === 0) {
      const i = DIAL_MODES.indexOf(s.bench.meter.mode as (typeof DIAL_MODES)[number]);
      s.setMeterMode(DIAL_MODES[(i + dx + DIAL_MODES.length) % DIAL_MODES.length]!);
      return true;
    }
    if (sel?.type !== "part") {
      // Nothing selected: the arrows walk the cursor.
      env.focusCursor();
      moveCursor(env, arrow, e.shiftKey);
      return true;
    }
    const part = s.bench.parts.find((p) => p.id === sel.id);
    if (!part) return false;
    if (part.kind !== "trimmer" && s.locked.includes(part.id)) return true;
    if (part.kind === "trimmer") {
      const position = Math.max(0, Math.min(1, Math.round((part.params.position + dx * 0.05 - dz * 0.05) * 100) / 100));
      s.setParams<"trimmer">(part.id, { position });
      return true;
    }
    const c = ops.partCenter(s.bench, part);
    const step = ops.isOnBoard(s.bench, part) ? 2.54 : 5;
    s.apply((b) => ops.movePart(b, part.id, [c[0] + dx * step, c[1] + dz * step], { reach: 0.4 }), { type: "part:move", partId: part.id });
    return true;
  }
  return false;
}

/** A sentence naming a part for screen readers: "R1, resistor, 1.5 kΩ, in holes e10 and e14". */
export function partName(bench: BenchState, id: string, labels: InkLabels, detail: (part: BenchState["parts"][number]) => string | undefined): string {
  const part = bench.parts.find((p) => p.id === id);
  if (!part) return id;
  const bits = [part.id, labels.partName[part.kind] ?? part.kind];
  const d = detail(part);
  if (d) bits.push(d);
  const holes = partLegs(part)
    .map((l) => part.holes?.[l])
    .filter((h): h is string => !!h && !!parseHole(h));
  if (holes.length) bits.push(`${labels.keyInHoles} ${holes.join(", ")}`);
  return bits.join(", ");
}

export type { TrayItem };
