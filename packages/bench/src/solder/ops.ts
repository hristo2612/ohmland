// Pure BenchState operations for the Unit 3 kinds. ../ops.ts calls into these from movePart and moveFlyingLeg, so
// both views place parts through perfboard holes, snap clips onto leads and slide tubes onto wires the same way.

import { partPose } from "../layout";
import { footprintOf, rotateXZ } from "../parts";
import type { BenchState, PlacedPart, PlacedPartOf, Vec2 } from "../types";
import { PERF, fitOnPerf, hasPad, nearestPad, onBoard, padWorld, parsePerfHole, perfHole, perfMount, type PerfLink } from "./perfboard";
import { jackSocket, leadLine, splices } from "./spots";
import { stripWire, type StripScale } from "./strip";
import { jointElectric } from "./joint";

const replacePart = (bench: BenchState, part: PlacedPart): BenchState => ({ ...bench, parts: bench.parts.map((p) => (p.id === part.id ? part : p)) });
const find = (bench: BenchState, id: string) => bench.parts.find((p) => p.id === id);

/** A perfboard, copper side down, under a desk point (parts go in from the top). */
export function perfUnder(bench: BenchState, to: Vec2, exceptId?: string): PlacedPartOf<"perfboard"> | null {
  for (const p of bench.parts) {
    if (p.kind !== "perfboard" || p.id === exceptId) continue;
    if (onBoard(p, to[0], to[1], 2)) return p;
  }
  return null;
}

/** True when a part is soldered in (a sound joint at one of its pads): it no longer lifts out. */
export function solderedIn(bench: BenchState, part: PlacedPart): boolean {
  const board = perfMount(bench, part);
  if (!board) return false;
  return Object.values(part.holes ?? {}).some((h) => {
    const q = parsePerfHole(h);
    const rec = q ? board.params.joints?.[q.pad] : undefined;
    return !!rec && !jointElectric({ ...rec, phase: "set" }).open && rec.verdict !== "cold";
  });
}

/** Footprint in pitches after a turn (as the breadboard does it). */
function turned(part: PlacedPart, rot: number): { leg: string; dx: number; dz: number }[] {
  return footprintOf(part).map((f) => {
    const [x, z] = rotateXZ(f.dx, f.dz, rot);
    return { leg: f.leg, dx: Math.round(x), dz: Math.round(z) };
  });
}

/**
 * Try to put a part through a perfboard's holes near `to`. Returns the moved part, or null when there is no board
 * under the point (or nothing fits).
 */
export function placeOnPerf(bench: BenchState, part: PlacedPart, to: Vec2, rot: number, reach?: number): PlacedPart | null {
  const board = perfUnder(bench, to, part.id);
  if (!board || board.params.flipped) return null;
  // Rows count down the page and columns to the right in the board's frame; a turned board turns the footprint.
  const holes = fitOnPerf(bench, board, turned(part, rot - board.rot), to, part.id, reach);
  if (!holes) return null;
  return { ...part, rot, holes, pos: to } as PlacedPart;
}

/** The centre of a part's legs on a perfboard (desk mm), or null when it is not on one. */
export function perfCenter(bench: BenchState, part: PlacedPart): Vec2 | null {
  if (!perfMount(bench, part)) return null;
  const legs = Object.values(partPose(bench, part).legs);
  if (!legs.length) return null;
  const xs = legs.map((p) => p[0]);
  const zs = legs.map((p) => p[2]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/** Clean up a board's bends that name legs no longer through its holes. */
export function tidyBends(bench: BenchState): BenchState {
  let b = bench;
  for (const board of bench.parts) {
    if (board.kind !== "perfboard" || !board.params.bends) continue;
    const bends: Record<string, string> = {};
    let changed = false;
    for (const [key, pad] of Object.entries(board.params.bends)) {
      const dot = key.lastIndexOf(".");
      const p = find(b, key.slice(0, dot));
      const h = p?.holes?.[key.slice(dot + 1)];
      if (pad && parsePerfHole(h)?.board === board.id) bends[key] = pad;
      else changed = true;
    }
    if (changed) b = replacePart(b, { ...board, params: { ...board.params, bends } } as PlacedPart);
  }
  return b;
}

// ---------------------------------------------------------------------------------------------------------------
// Underneath: bending legs and wire links.

/** Bend a leg along the underside to another pad (or straighten it with `pad` null or its own pad). */
export function bendLeg(bench: BenchState, partId: string, leg: string, pad: string | null): BenchState {
  const part = find(bench, partId);
  const q = parsePerfHole(part?.holes?.[leg]);
  const board = q ? find(bench, q.board) : undefined;
  if (!part || !q || !board || board.kind !== "perfboard") return bench;
  const bends = { ...(board.params.bends ?? {}) };
  const key = `${partId}.${leg}`;
  if (!pad || pad === q.pad || !hasPad(board.params, pad)) delete bends[key];
  else bends[key] = pad;
  return replacePart(bench, { ...board, params: { ...board.params, bends } });
}

/** Add a wire link from pad to pad underneath (bare unless insulated). */
export function addLink(bench: BenchState, boardId: string, a: string, b: string, insulated = false): [BenchState, string | null] {
  const board = find(bench, boardId);
  if (!board || board.kind !== "perfboard" || a === b || !hasPad(board.params, a) || !hasPad(board.params, b)) return [bench, null];
  const links = board.params.links ?? [];
  let n = links.length + 1;
  while (links.some((l) => l.id === `L${n}`)) n++;
  const link: PerfLink = { id: `L${n}`, a, b, ...(insulated ? { insulated: true, color: "blue" as const } : {}) };
  return [replacePart(bench, { ...board, params: { ...board.params, links: [...links, link] } }), link.id];
}

export function removeLink(bench: BenchState, boardId: string, linkId: string): BenchState {
  const board = find(bench, boardId);
  if (!board || board.kind !== "perfboard") return bench;
  return replacePart(bench, { ...board, params: { ...board.params, links: (board.params.links ?? []).filter((l) => l.id !== linkId) } });
}

// ---------------------------------------------------------------------------------------------------------------
// Clips on leads, tubes on wires, plugs in jacks: they snap as they are dragged.

const CLIP_REACH = 7;

/** A heat-sink clip dragged to `to`: it grips the nearest lead within reach, else lies on the desk. */
export function moveClip(bench: BenchState, clip: PlacedPartOf<"heat-sink-clip">, to: Vec2): BenchState {
  let best: { on: string; mm: number; d: number } | null = null;
  for (const p of bench.parts) {
    if (p.id === clip.id || p.kind === "heat-sink-clip") continue;
    if (!["led", "npn", "diode", "electrolytic-cap", "ceramic-cap", "phototransistor", "resistor"].includes(p.kind)) continue;
    for (const leg of Object.keys(partPose(bench, p).legs)) {
      const line = leadLine(bench, p, leg);
      if (!line) continue;
      const ax = line.end[0] - line.start[0];
      const az = line.end[2] - line.start[2];
      const L2 = ax * ax + az * az || 1;
      const k = Math.max(0, Math.min(1, ((to[0] - line.start[0]) * ax + (to[1] - line.start[2]) * az) / L2));
      const px = line.start[0] + ax * k;
      const pz = line.start[2] + az * k;
      const d = Math.hypot(to[0] - px, to[1] - pz);
      if (d < CLIP_REACH && (!best || d < best.d)) best = { on: `${p.id}.${leg}`, mm: Math.round(k * line.len * 2) / 2, d };
    }
  }
  if (best) return replacePart(bench, { ...clip, pos: to, params: { ...clip.params, on: best.on, mm: Math.max(1, best.mm) } });
  return replacePart(bench, { ...clip, pos: to, params: { ...clip.params, on: null } });
}

/** Both ends of a wire are held (in holes, or soldered into a splice): nothing can slide on. */
export function wireCaptive(bench: BenchState, wire: PlacedPartOf<"hookup-wire">): boolean {
  const held = (end: "a" | "b") => {
    if (wire.holes?.[end]) return true;
    if (wire.params.joints?.[end]) return true;
    for (const p of bench.parts) {
      if (p.kind !== "hookup-wire" || p.id === wire.id) continue;
      for (const e of ["a", "b"] as const) if (p.params.joints?.[e]?.with === `${wire.id}.${end}`) return true;
    }
    return false;
  };
  return held("a") && held("b");
}

/** A tube dragged to `to`: it slides along the wire it is on, onto a wire with a free end, or lies on the desk. */
export function moveTube(bench: BenchState, tube: PlacedPartOf<"heat-shrink">, to: Vec2): BenchState {
  let best: { wire: string; at: number; d: number } | null = null;
  for (const p of bench.parts) {
    if (p.kind !== "hookup-wire") continue;
    const pose = partPose(bench, p);
    const a = pose.ends?.a?.pos;
    const b = pose.ends?.b?.pos;
    if (!a || !b) continue;
    const ax = b[0] - a[0];
    const az = b[2] - a[2];
    const L2 = ax * ax + az * az || 1;
    const k = Math.max(0, Math.min(1, ((to[0] - a[0]) * ax + (to[1] - a[2]) * az) / L2));
    const d = Math.hypot(to[0] - (a[0] + ax * k), to[1] - (a[2] + az * k));
    if (d < 6 && (!best || d < best.d)) best = { wire: p.id, at: Math.round(k * Math.sqrt(L2)), d };
  }
  if (best) {
    const wire = find(bench, best.wire) as PlacedPartOf<"hookup-wire">;
    // Already on it: slide along. Onto a new wire: only over a free end.
    if (tube.params.on === best.wire || !wireCaptive(bench, wire)) return replacePart(bench, { ...tube, pos: to, params: { ...tube.params, on: best.wire, at: best.at } });
  }
  // Off its wire only past a free end; otherwise it stays on, at the nearest point.
  if (tube.params.on) {
    const wire = find(bench, tube.params.on);
    if (wire?.kind === "hookup-wire" && wireCaptive(bench, wire)) return bench;
  }
  return replacePart(bench, { ...tube, pos: to, params: { ...tube.params, on: null } });
}

/** An adapter's barrel plug dragged to `to`: into the nearest jack's socket within reach, else on the desk. */
export function movePlug(bench: BenchState, adapter: PlacedPartOf<"wall-adapter">, to: Vec2): BenchState {
  let best: { id: string; d: number } | null = null;
  for (const j of bench.parts) {
    if (j.kind !== "barrel-jack") continue;
    const s = jackSocket(bench, j);
    const d = Math.hypot(s[0] - to[0], s[2] - to[1]);
    if (d < 12 && (!best || d < best.d)) best = { id: j.id, d };
  }
  const ends = { ...(adapter.ends ?? {}), plug: to };
  if (best) {
    const s = jackSocket(bench, find(bench, best.id)!);
    return replacePart(bench, { ...adapter, ends: { ...ends, plug: [s[0], s[2]] }, params: { ...adapter.params, into: best.id } });
  }
  return replacePart(bench, { ...adapter, ends, params: { ...adapter.params, into: null } });
}

/** A flying lead end (a battery snap, a hookup wire end) into the nearest perfboard hole, from the top. */
export function flyingToPerf(bench: BenchState, part: PlacedPart, leg: string, to: Vec2): BenchState | null {
  const board = perfUnder(bench, to);
  if (!board || board.params.flipped) return null;
  const pad = nearestPad(board, to[0], to[1]);
  if (!pad) return null;
  const used = bench.parts.some((p) => Object.entries(p.holes ?? {}).some(([l, h]) => h === perfHole(board.id, pad) && !(p.id === part.id && l === leg)));
  if (used) return null;
  const holes = { ...(part.holes ?? {}), [leg]: perfHole(board.id, pad) };
  return replacePart(bench, { ...part, holes } as PlacedPart);
}

// ---------------------------------------------------------------------------------------------------------------
// Wire ends: strip, snip, twist.

const STRIP_REACH = 26;

/** The stripper strips the hookup wire end nearest its jaws (within reach) with its notch, scale and jaw stop. */
export function stripNearest(bench: BenchState, stripperId: string): BenchState {
  const ws = find(bench, stripperId);
  if (!ws || ws.kind !== "wire-stripper") return bench;
  const jaw = rotateXZ(-50, 0, ws.rot);
  const at: Vec2 = [ws.pos[0] + jaw[0], ws.pos[1] + jaw[1]];
  let best: { wire: PlacedPartOf<"hookup-wire">; end: "a" | "b"; d: number } | null = null;
  for (const p of bench.parts) {
    if (p.kind !== "hookup-wire") continue;
    const pose = partPose(bench, p);
    for (const end of ["a", "b"] as const) {
      const e = pose.ends?.[end];
      if (!e || e.inHole) continue;
      const d = Math.min(Math.hypot(e.pos[0] - at[0], e.pos[2] - at[1]), Math.hypot(e.pos[0] - ws.pos[0], e.pos[2] - ws.pos[1]));
      if (d < STRIP_REACH && (!best || d < best.d)) best = { wire: p, end, d };
    }
  }
  if (!best) return bench;
  return stripEnd(bench, best.wire.id, best.end, ws.params.notch, ws.params.scale, ws.params.stopMm);
}

/** Strip a wire end at a notch. A nicked or slipped try is kept in `tries`. */
export function stripEnd(bench: BenchState, wireId: string, end: "a" | "b", notch: number, scale: StripScale, stopMm = 10): BenchState {
  const w = find(bench, wireId);
  if (!w || w.kind !== "hookup-wire") return bench;
  const res = stripWire({ awg: w.params.awg, stranded: !!w.params.stranded }, notch, scale, stopMm);
  const ends = { ...(w.params.ends ?? {}), [end]: res };
  const tries = [...(w.params.tries ?? []), { notch, scale, clean: res.clean, nicked: res.nicked, slipped: res.slipped, cutStrands: res.cutStrands }];
  return replacePart(bench, { ...w, params: { ...w.params, ends, tries } });
}

/** Snip off an end (the stripped or nicked bit goes; the wire is a little shorter). */
export function snipEnd(bench: BenchState, wireId: string, end: "a" | "b"): BenchState {
  const w = find(bench, wireId);
  if (!w || w.kind !== "hookup-wire") return bench;
  const cut = w.params.ends?.[end]?.mm ?? 0;
  const ends = { ...(w.params.ends ?? {}) };
  delete ends[end];
  const joints = { ...(w.params.joints ?? {}) };
  delete joints[end];
  return replacePart(bench, { ...w, params: { ...w.params, ends, joints, len: Math.max(20, w.params.len - cut - 2) } });
}

/** Twist the stripped strands of a stranded wire's ends. */
export function twistEnds(bench: BenchState, wireId: string): BenchState {
  const w = find(bench, wireId);
  if (!w || w.kind !== "hookup-wire" || !w.params.stranded) return bench;
  const ends = { ...(w.params.ends ?? {}) };
  for (const e of ["a", "b"] as const) if (ends[e] && ends[e]!.mm > 0) ends[e] = { ...ends[e]!, twisted: true };
  return replacePart(bench, { ...w, params: { ...w.params, ends } });
}

/** The splice a wire end is part of, if any. */
export function spliceOf(bench: BenchState, wireId: string, end: "a" | "b"): string | null {
  const s = splices(bench).find((x) => (x.a.wire.id === wireId && x.a.end === end) || (x.b.wire.id === wireId && x.b.end === end));
  return s?.id ?? null;
}

export { PERF, padWorld };
