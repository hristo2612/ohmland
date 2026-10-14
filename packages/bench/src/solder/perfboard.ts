// Perfboard: a board of holes 2.54 mm apart, each with its own copper pad underneath, joined to nothing until you
// join it. Pure geometry and connectivity, shared by the layout, the netlist, ops and both renderers.
//
// Pads are named by row letter and column number ("A1" at the far left corner seen from the top, "F10" at the near
// right). Parts go in from the top with their legs through holes; their `holes` name the board and pad
// ("PB1:B4"). Flipped over (`flipped`), the board shows its copper side: left becomes right, so column c is seen
// where column cols + 1 - c was; rows stay. Underneath, legs can be bent along to another pad (`bends`), bare or
// insulated wire links run pad to pad (`links`), and each pad's joint (`joints`) decides what touches what.

import { PITCH } from "../board";
import type { Anchor, BenchState, PlacedPart, PlacedPartOf, Vec2, Vec3, WireColor } from "../types";
import { jointElectric, type Joint, type Verdict } from "./joint";

export const PERF = {
  pitch: PITCH,
  /** Board edge beyond the outer holes (mm). */
  margin: 3.2,
  thick: 1.6,
  /** The board rests on little feet: its top surface is this high above the desk. */
  top: 4.6,
  pad: 1.9,
  hole: 1.0,
};

export const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A joint as the bench keeps it once it has set: what the look, the meter and a tug read. */
export type JointRecord = Pick<Joint, "kind" | "alloy" | "volume" | "wetted" | "peakC" | "moved" | "fedAt" | "bridgeTo" | "lifted" | "coldTouch" | "flux"> & {
  verdict: Verdict | null;
};

export type PerfLink = { id: string; a: string; b: string; insulated?: boolean; color?: WireColor };

export type PerfParams = PlacedPartOf<"perfboard">["params"];

export function padName(col: number, row: number): string {
  return `${ROW_LETTERS[row - 1] ?? "?"}${col}`;
}

export function parsePad(name: string): { col: number; row: number } | null {
  const m = /^([A-Z])(\d{1,2})$/.exec(name);
  if (!m) return null;
  return { row: ROW_LETTERS.indexOf(m[1]!) + 1, col: Number(m[2]) };
}

export function padsOf(p: { cols: number; rows: number }): string[] {
  const out: string[] = [];
  for (let r = 1; r <= p.rows; r++) for (let c = 1; c <= p.cols; c++) out.push(padName(c, r));
  return out;
}

export function hasPad(p: { cols: number; rows: number }, pad: string): boolean {
  const q = parsePad(pad);
  return !!q && q.col >= 1 && q.col <= p.cols && q.row >= 1 && q.row <= p.rows;
}

/** Board size (mm): width along the columns, depth along the rows. */
export function perfSize(p: { cols: number; rows: number }): { w: number; d: number } {
  return { w: (p.cols - 1) * PERF.pitch + 2 * PERF.margin, d: (p.rows - 1) * PERF.pitch + 2 * PERF.margin };
}

/** A pad's place in the board's frame, as seen from above now (mirrored left to right when flipped). */
export function padLocal(p: { cols: number; rows: number; flipped?: boolean }, pad: string, flipped = !!p.flipped): Vec2 | null {
  const q = parsePad(pad);
  if (!q) return null;
  const x = (q.col - (p.cols + 1) / 2) * PERF.pitch;
  const z = (q.row - (p.rows + 1) / 2) * PERF.pitch;
  return [flipped ? -x : x, z];
}

function rot2(x: number, z: number, rot: number): Vec2 {
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c + z * s, -x * s + z * c];
}

/** A pad on the desk (mm), as seen from above now. */
export function padWorld(board: PlacedPart, pad: string, flipped?: boolean): Vec3 | null {
  if (board.kind !== "perfboard") return null;
  const l = padLocal(board.params, pad, flipped ?? !!board.params.flipped);
  if (!l) return null;
  const [x, z] = rot2(l[0], l[1], board.rot);
  return [board.pos[0] + x, PERF.top, board.pos[1] + z];
}

/** "PB1:B4" for a leg through pad B4 of board PB1. */
export const perfHole = (board: string, pad: string) => `${board}:${pad}`;

export function parsePerfHole(h: string | undefined): { board: string; pad: string } | null {
  if (!h) return null;
  const i = h.indexOf(":");
  if (i <= 0) return null;
  return { board: h.slice(0, i), pad: h.slice(i + 1) };
}

/** The perfboard a part's legs go through (every footprint leg in a hole of the same board), or null. */
export function perfMount(bench: BenchState, part: PlacedPart): PlacedPartOf<"perfboard"> | null {
  const holes = Object.values(part.holes ?? {});
  if (!holes.length) return null;
  const first = parsePerfHole(holes[0]);
  if (!first) return null;
  const board = bench.parts.find((p) => p.id === first.board);
  if (!board || board.kind !== "perfboard") return null;
  return board;
}

/** The pad nearest a desk point on a board (as seen from above now), within `maxDist` mm. */
export function nearestPad(board: PlacedPart, x: number, z: number, maxDist = PERF.pitch * 0.75): string | null {
  if (board.kind !== "perfboard") return null;
  let best: string | null = null;
  let bestD = maxDist;
  for (const pad of padsOf(board.params)) {
    const w = padWorld(board, pad)!;
    const d = Math.hypot(w[0] - x, w[2] - z);
    if (d < bestD) {
      bestD = d;
      best = pad;
    }
  }
  return best;
}

/** The pad at a whole number of pitches from another (in the board's own top-view frame), if it exists. */
export function padAtOffset(p: { cols: number; rows: number }, from: string, dc: number, dr: number): string | null {
  const q = parsePad(from);
  if (!q) return null;
  const col = q.col + dc;
  const row = q.row + dr;
  return col >= 1 && col <= p.cols && row >= 1 && row <= p.rows ? padName(col, row) : null;
}

/** The four pads around one. */
export function padNeighbours(p: { cols: number; rows: number }, pad: string): string[] {
  return [padAtOffset(p, pad, 1, 0), padAtOffset(p, pad, -1, 0), padAtOffset(p, pad, 0, 1), padAtOffset(p, pad, 0, -1)].filter((x): x is string => !!x);
}

/** True when a desk point lies on the board. */
export function onBoard(board: PlacedPart, x: number, z: number, grow = 0): boolean {
  if (board.kind !== "perfboard") return false;
  const [lx, lz] = rot2(x - board.pos[0], z - board.pos[1], -board.rot);
  const { w, d } = perfSize(board.params);
  return Math.abs(lx) <= w / 2 + grow && Math.abs(lz) <= d / 2 + grow;
}

// ---------------------------------------------------------------------------------------------------------------
// What touches what at each pad.

/** An anchor for an underside wire link (one conductor from end to end). */
export const linkAnchor = (board: string, link: string): Anchor => `perf:${board}/${link}`;

export type PadMetal = {
  /** Legs through the pad's hole, legs bent onto it, link ends: everything solder there would join. */
  members: Anchor[];
  /** Legs through the hole (from the top). */
  legs: { part: string; leg: string }[];
};

/** Everything metal at each pad of a board. */
export function padMetal(bench: BenchState, board: PlacedPartOf<"perfboard">): Map<string, PadMetal> {
  const out = new Map<string, PadMetal>();
  const at = (pad: string) => {
    let m = out.get(pad);
    if (!m) {
      m = { members: [], legs: [] };
      out.set(pad, m);
    }
    return m;
  };
  for (const p of bench.parts) {
    for (const [leg, h] of Object.entries(p.holes ?? {})) {
      const q = parsePerfHole(h);
      if (!q || q.board !== board.id || !hasPad(board.params, q.pad)) continue;
      const m = at(q.pad);
      m.members.push(`pin:${p.id}.${leg}`);
      m.legs.push({ part: p.id, leg });
    }
  }
  for (const [key, pad] of Object.entries(board.params.bends ?? {})) {
    if (!pad || !hasPad(board.params, pad)) continue;
    const dot = key.lastIndexOf(".");
    if (dot <= 0) continue;
    const anchor = `pin:${key}`;
    const m = at(pad);
    if (!m.members.includes(anchor)) m.members.push(anchor);
  }
  for (const l of board.params.links ?? []) {
    for (const end of [l.a, l.b]) if (hasPad(board.params, end)) at(end).members.push(linkAnchor(board.id, l.id));
  }
  return out;
}

/** Where a leg through a pad ends up underneath: bent to another pad, or straight (its own pad). */
export function legEnd(board: PlacedPartOf<"perfboard">, part: string, leg: string, own: string): string {
  return board.params.bends?.[`${part}.${leg}`] ?? own;
}

type Seg = { a: Vec2; b: Vec2; who: Anchor };

function segsCross(s: Seg, t: Seg): boolean {
  const d = (p: Vec2, q: Vec2, r: Vec2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const same = (p: Vec2, q: Vec2) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
  // Sharing an end is meeting at a pad, not crossing.
  if (same(s.a, t.a) || same(s.a, t.b) || same(s.b, t.a) || same(s.b, t.b)) return false;
  const d1 = d(t.a, t.b, s.a);
  const d2 = d(t.a, t.b, s.b);
  const d3 = d(s.a, s.b, t.a);
  const d4 = d(s.a, s.b, t.b);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

/** Bare legs and bare links lying across each other underneath (each pair touches: a short). */
export function crossings(bench: BenchState, board: PlacedPartOf<"perfboard">): [Anchor, Anchor][] {
  const segs: Seg[] = [];
  const loc = (pad: string) => padLocal(board.params, pad, false);
  for (const p of bench.parts) {
    for (const [leg, h] of Object.entries(p.holes ?? {})) {
      const q = parsePerfHole(h);
      if (!q || q.board !== board.id) continue;
      const to = board.params.bends?.[`${p.id}.${leg}`];
      const a = loc(q.pad);
      const b = to ? loc(to) : null;
      if (a && b && to !== q.pad) segs.push({ a, b, who: `pin:${p.id}.${leg}` });
    }
  }
  for (const l of board.params.links ?? []) {
    if (l.insulated) continue;
    const a = loc(l.a);
    const b = loc(l.b);
    if (a && b) segs.push({ a, b, who: linkAnchor(board.id, l.id) });
  }
  const out: [Anchor, Anchor][] = [];
  for (let i = 0; i < segs.length; i++) for (let k = i + 1; k < segs.length; k++) if (segsCross(segs[i]!, segs[k]!)) out.push([segs[i]!.who, segs[k]!.who]);
  return out;
}

/** The pad's own anchor (a pad is a lead of the board). */
export const padAnchor = (board: string, pad: string): Anchor => `pin:${board}.${pad}`;

/**
 * Metal contacts the board makes: a sound joint joins its pad and everything at it, a bridge joins two pads, bare
 * crossings touch, and in tack mode legs that meet at a pad conduct without solder. Cold, disturbed and thin joints
 * are not metal: the netlist gives them a resistance (`perfJointWires`).
 */
export function perfContacts(bench: BenchState, board: PlacedPartOf<"perfboard">): [Anchor, Anchor][] {
  const out: [Anchor, Anchor][] = [];
  const joints = board.params.joints ?? {};
  const metal = padMetal(bench, board);
  for (const [pad, m] of metal) {
    const rec = joints[pad];
    const e = rec ? jointElectric({ ...rec, phase: "set" }) : null;
    const sound = !!e && !e.open && !e.intermittent;
    const own = padAnchor(board.id, pad);
    if (sound || (!rec && board.params.tack && m.members.length >= 1)) for (const a of m.members) out.push([own, a]);
  }
  // A bridge's blob covers the neighbour pad and whatever comes through it.
  for (const [pad, rec] of Object.entries(joints)) {
    if (!rec?.bridgeTo || !hasPad(board.params, rec.bridgeTo)) continue;
    const e = jointElectric({ ...rec, phase: "set" });
    if (e.open) continue;
    const other = padAnchor(board.id, rec.bridgeTo);
    out.push([padAnchor(board.id, pad), other]);
    for (const a of metal.get(rec.bridgeTo)?.members ?? []) out.push([other, a]);
  }
  out.push(...crossings(bench, board));
  return out;
}

/** Joints that conduct only loosely (cold, disturbed, thin): a resistance from the pad to each thing at it. */
export function perfJointWires(bench: BenchState, board: PlacedPartOf<"perfboard">): { id: string; a: Anchor; b: Anchor; ohms: number }[] {
  const out: { id: string; a: Anchor; b: Anchor; ohms: number }[] = [];
  const joints = board.params.joints ?? {};
  for (const [pad, m] of padMetal(bench, board)) {
    const rec = joints[pad];
    if (!rec) continue;
    const e = jointElectric({ ...rec, phase: "set" });
    if (e.open || !e.intermittent || board.params.flexed) continue;
    m.members.forEach((a, k) => out.push({ id: `${board.id}:J${pad}:${k}`, a: padAnchor(board.id, pad), b: a, ohms: e.ohms }));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Placing parts through the holes.

/** Free holes for a part whose footprint (in pitches, rotated) has its centre near `center`, or null. */
export function fitOnPerf(
  bench: BenchState,
  board: PlacedPartOf<"perfboard">,
  fp: { leg: string; dx: number; dz: number }[],
  center: Vec2,
  exceptId?: string,
  reach = 1.6,
): Record<string, string> | null {
  if (!fp.length || board.params.flipped) return null;
  const used = new Set<string>();
  for (const p of bench.parts) {
    if (p.id === exceptId) continue;
    for (const h of Object.values(p.holes ?? {})) {
      const q = parsePerfHole(h);
      if (q?.board === board.id) used.add(q.pad);
    }
  }
  const xs = fp.map((f) => f.dx);
  const zs = fp.map((f) => f.dz);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  // Into the board's frame (top view).
  const [lx, lz] = rot2(center[0] - board.pos[0], center[1] - board.pos[1], -board.rot);
  const want: Vec2 = [lx - cx * PERF.pitch, lz - cz * PERF.pitch];
  const cands: { pad: string; d: number }[] = [];
  for (const pad of padsOf(board.params)) {
    const l = padLocal(board.params, pad, false)!;
    const d = Math.hypot(l[0] - want[0], l[1] - want[1]);
    if (d <= reach * PERF.pitch) cands.push({ pad, d });
  }
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands) {
    const holes: Record<string, string> = {};
    let ok = true;
    for (const f of fp) {
      const pad = padAtOffset(board.params, c.pad, f.dx, f.dz);
      if (!pad || used.has(pad)) {
        ok = false;
        break;
      }
      holes[f.leg] = perfHole(board.id, pad);
    }
    if (ok) return holes;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// The plan card: what a finished board should look like.

export type PlanGhost = { id: string; kind: PlacedPart["kind"]; legs: Record<string, string>; params?: Record<string, unknown> };

/** Pads joined by metal on the board right now (each connection as a sorted pair), for comparing with a plan. */
export function joinedPads(bench: BenchState, board: PlacedPartOf<"perfboard">, groupOf: (a: Anchor) => string): Set<string> {
  const byGroup = new Map<string, string[]>();
  for (const pad of padsOf(board.params)) {
    const g = groupOf(padAnchor(board.id, pad));
    const list = byGroup.get(g) ?? [];
    list.push(pad);
    byGroup.set(g, list);
  }
  const out = new Set<string>();
  for (const pads of byGroup.values()) {
    if (pads.length < 2) continue;
    for (let i = 0; i < pads.length; i++) for (let k = i + 1; k < pads.length; k++) out.add([pads[i]!, pads[k]!].sort().join("-"));
  }
  return out;
}

/** True when every ghost on the plan has a part of its kind with the same legs in the same holes. */
export function ghostsFilled(bench: BenchState, board: PlacedPartOf<"perfboard">, ghosts: readonly PlanGhost[]): boolean {
  return ghosts.every((g) =>
    bench.parts.some((p) => p.kind === g.kind && Object.entries(g.legs).every(([leg, pad]) => p.holes?.[leg] === perfHole(board.id, pad))),
  );
}
