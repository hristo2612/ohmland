// Pure BenchState transformations: placing, snapping, rotating, wiring and clipping.
// The store wraps these with undo/redo; labs can call them directly to script a solution.

import { parseAnchor } from "./anchors";
import { PITCH, boardGeometry, boardOrigin, holeAtOffset, holeWorld, nearestHole } from "./board";
import { anchorPosition, gateSpot, isOnBoard, partPose } from "./layout";
import { chargeable, rub, settle } from "./static";
import { canMountOnBoard, defaultParams, footprintOf, isFlying, partDef, rotateXZ } from "./parts";
import { heldOf, holderOf, popSpot, seatFits, seatNear, seatPose, seatsOf } from "./seats";
import type {
  Anchor,
  BenchPartKind,
  BenchState,
  HoleId,
  LeadColor,
  LeadEnd,
  MeterSocket,
  PartParamsMap,
  PlacedPart,
  ProbeColor,
  TestLead,
  Vec2,
  Wire,
  WireColor,
} from "./types";

export function emptyBench(board: BenchState["board"] = { kind: "bb830" }): BenchState {
  return { v: 1, board, parts: [], wires: [], leads: [], meter: null };
}

/** Smallest unused id with this prefix: R1, R2, ... */
export function nextId(bench: BenchState, prefix: string): string {
  const used = new Set<string>([
    ...bench.parts.map((p) => p.id),
    ...bench.wires.map((w) => w.id),
    ...bench.leads.map((l) => l.id),
    ...(bench.meter ? [bench.meter.id] : []),
  ]);
  for (let i = 1; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

/** Whether an id is already used by a part, wire, lead or the meter. */
export function nextIdTaken(bench: BenchState, id: string): boolean {
  return bench.parts.some((p) => p.id === id) || bench.wires.some((w) => w.id === id) || bench.leads.some((l) => l.id === id) || bench.meter?.id === id;
}

/** Holes in use, mapped to who uses them ("R1.a", "W2.b"). */
export function occupiedHoles(bench: BenchState, except?: { part?: string; wire?: string; leg?: string }): Map<HoleId, string> {
  const out = new Map<HoleId, string>();
  for (const p of bench.parts) {
    for (const [leg, h] of Object.entries(p.holes ?? {})) {
      if (!h) continue;
      if (except?.part === p.id && (except.leg === undefined || except.leg === leg)) continue;
      out.set(h, `${p.id}.${leg}`);
    }
  }
  for (const w of bench.wires) {
    for (const end of ["a", "b"] as const) {
      if (except?.wire === w.id && (except.leg === undefined || except.leg === end)) continue;
      out.set(w[end], `${w.id}.${end}`);
    }
  }
  return out;
}

/** Footprint offsets in pitches after rotation, plus the footprint's bounding centre. */
function rotatedFootprint(kind: BenchPartKind, params: unknown, rot: number, span?: number) {
  const fp = footprintOf({ kind, params } as PlacedPart, span);
  const legs = fp.map((f) => {
    const [x, z] = rotateXZ(f.dx, f.dz, rot);
    return { leg: f.leg, dx: Math.round(x), dz: Math.round(z) };
  });
  const xs = legs.map((l) => l.dx);
  const zs = legs.map((l) => l.dz);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return { legs, cx, cz };
}

/**
 * Find holes for a part whose footprint centre should be near `center` (desk mm). Tries the closest grid spots
 * first and returns null when no spot within `reach` pitches has every lead on a free hole.
 */
export function fitOnBoard(
  bench: BenchState,
  kind: BenchPartKind,
  params: unknown,
  rot: number,
  center: Vec2,
  opts: { exceptId?: string; span?: number; reach?: number } = {},
): Record<string, HoleId> | null {
  if (!bench.board) return null;
  const geom = boardGeometry(bench.board);
  const [ox, oz] = boardOrigin(bench.board);
  const { legs, cx, cz } = rotatedFootprint(kind, params, rot, opts.span);
  if (!legs.length) return null;
  const occupied = occupiedHoles(bench, opts.exceptId ? { part: opts.exceptId } : undefined);
  const want0x = center[0] - cx * PITCH - ox;
  const want0z = center[1] - cz * PITCH - oz;
  const reach = (opts.reach ?? 1.6) * PITCH;
  const candidates: { id: HoleId; d: number }[] = [];
  for (const h of geom.holes.values()) {
    const d = Math.hypot(h.x - want0x, h.z - want0z);
    if (d <= reach) candidates.push({ id: h.id, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const c of candidates) {
    const holes: Record<string, HoleId> = {};
    let ok = true;
    for (const l of legs) {
      const h = holeAtOffset(geom, c.id, l.dx, l.dz);
      if (!h || occupied.has(h)) {
        ok = false;
        break;
      }
      holes[l.leg] = h;
    }
    if (ok) return holes;
  }
  return null;
}

/** Centre of a part's footprint on the desk (board parts) or its body position (desk parts). */
export function partCenter(bench: BenchState, part: PlacedPart): Vec2 {
  if (isOnBoard(bench, part)) {
    const pts = Object.values(part.holes ?? {})
      .map((h) => (h ? holeWorld(bench.board!, h) : null))
      .filter((p): p is [number, number] => !!p);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  }
  return part.pos;
}

function currentSpan(bench: BenchState, part: PlacedPart): number | undefined {
  const def = partDef(part.kind);
  if (!def.span) return undefined;
  if (isOnBoard(bench, part)) return Math.round(partPose(bench, part).span ?? def.span.default);
  // Off the board: the part's natural lead spacing (a big electrolytic's legs are two holes apart).
  const fp = footprintOf(part);
  const natural = fp.length >= 2 ? Math.round(Math.hypot(fp[1]!.dx - fp[0]!.dx, fp[1]!.dz - fp[0]!.dz)) : def.span.default;
  return natural || def.span.default;
}

function replacePart(bench: BenchState, part: PlacedPart): BenchState {
  return { ...bench, parts: bench.parts.map((p) => (p.id === part.id ? part : p)) };
}

export type Placement = { pos: Vec2; rot?: number; holes?: Record<string, HoleId> };

export function addPart<K extends BenchPartKind>(
  bench: BenchState,
  kind: K,
  params: Partial<PartParamsMap[K]> | undefined,
  at: Placement,
  id?: string,
): [BenchState, string] {
  const pid = id ?? nextId(bench, partDef(kind).prefix);
  const part = {
    id: pid,
    kind,
    params: { ...defaultParams(kind), ...(params ?? {}) },
    pos: at.pos,
    rot: at.rot ?? 0,
    ...(at.holes ? { holes: at.holes } : {}),
  } as PlacedPart;
  return [{ ...bench, parts: [...bench.parts, part] }, pid];
}

/**
 * Move a part so its footprint centre is near `to`. Dropped on a holder (resistor clips, a lemon's slot, a test
 * station, a bin) it goes into the nearest seat that fits; on the board it snaps into the nearest free holes;
 * otherwise (or when nothing fits) it lies on the desk.
 */
export function movePart(bench: BenchState, id: string, to: Vec2, opts: { rot?: number; reach?: number; seat?: boolean } = {}): BenchState {
  let part = bench.parts.find((p) => p.id === id);
  if (!part) return bench;
  const nose = (partDef(part.kind) as { nose?: string }).nose;
  if (nose) return moveNose(bench, part, nose, to, opts.rot);
  // The static toy: moving a balloon, a comb or a plastic spoon over the scarf rubs it; a balloon sticks to a wall
  // (or falls from it) and keeps away from another charged balloon.
  if (chargeable(part)) {
    bench = rub(bench, id, to);
    part = bench.parts.find((p) => p.id === id)!;
  }
  if (part.kind === "balloon") to = settle(bench, id, to);
  // A gate clips onto the clip lead it is dropped on, or lies on the desk.
  if (part.kind === "gate") return clipGate(bench, id, to);
  if (opts.seat !== false) {
    const near = seatNear(bench, part, to);
    if (near) {
      const cur = holderOf(bench, id);
      if (cur && cur.holder.id === near.holder.id && cur.seat.name === near.seat.name) return bench;
      return seatPart(bench, id, near.holder.id, near.seat.name);
    }
  }
  const free = holderOf(bench, id) ? unseat(bench, id) : bench;
  const rot = opts.rot ?? part.rot;
  if (canMountOnBoard(part) && free.board) {
    const span = currentSpan(free, part);
    const holes = fitOnBoard(free, part.kind, part.params, rot, to, { exceptId: id, span, reach: opts.reach });
    if (holes) {
      const moved = { ...part, rot, holes, pos: to } as PlacedPart;
      // A holder in the board (an IC socket) keeps what it holds.
      return syncHeld(replacePart(free, { ...moved, pos: partCenter({ ...free, parts: [moved] }, moved) } as PlacedPart), id);
    }
  }
  const { holes: _h, ...rest } = part;
  const flyingHoles = isFlying(part) ? { holes: part.holes } : {};
  return syncHeld(replacePart(free, { ...rest, ...flyingHoles, pos: to, rot } as PlacedPart), id);
}

/**
 * Moves a part whose tip is one of its flying leads (the logic probe): over a free hole the tip drops into it and the
 * body follows the tip; elsewhere it lies on the desk. Its other flying leads stay where they are.
 */
function moveNose(bench: BenchState, part: PlacedPart, nose: string, to: Vec2, rot?: number): BenchState {
  const holes = { ...(part.holes ?? {}) };
  const ends = { ...(part.ends ?? {}) };
  delete ends[nose];
  const hole = bench.board ? nearestHole(bench.board, to[0], to[1]) : null;
  const occupied = occupiedHoles(bench, { part: part.id, leg: nose });
  let pos: Vec2 = to;
  if (hole && !occupied.has(hole)) {
    holes[nose] = hole;
    pos = holeWorld(bench.board!, hole)!;
  } else delete holes[nose];
  return replacePart(bench, { ...part, holes, ends, pos, rot: rot ?? part.rot } as PlacedPart);
}

// Gates -------------------------------------------------------------------------------------------------------------

/** How close (mm) to a lead's line a gate must be dropped to clip onto it. */
export const GATE_REACH = 14;

/** The clip lead nearest a desk point (measured to the straight line between its clips), within `reach` mm. */
export function leadNear(bench: BenchState, to: Vec2, reach = GATE_REACH): { lead: string; at: number } | null {
  let best: { lead: string; at: number; d: number } | null = null;
  for (const l of bench.leads) {
    const a = anchorPosition(bench, `lead:${l.id}.a`);
    const b = anchorPosition(bench, `lead:${l.id}.b`);
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len2 = dx * dx + dz * dz;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((to[0] - a[0]) * dx + (to[1] - a[2]) * dz) / len2));
    const d = Math.hypot(a[0] + dx * t - to[0], a[2] + dz * t - to[1]);
    if (d <= reach && (!best || d < best.d)) best = { lead: l.id, at: Math.round(Math.max(0.15, Math.min(0.85, t)) * 100) / 100, d };
  }
  return best ? { lead: best.lead, at: best.at } : null;
}

/** Puts a gate on the lead nearest `to` (or on `lead`, `at` of the way along), or on the desk when none is near. */
export function clipGate(bench: BenchState, id: string, to: Vec2 | null, lead?: { lead: string; at?: number }): BenchState {
  const gate = bench.parts.find((p) => p.id === id);
  if (gate?.kind !== "gate") return bench;
  const near = lead ? (bench.leads.some((l) => l.id === lead.lead) ? { lead: lead.lead, at: lead.at ?? 0.5 } : null) : to ? leadNear(bench, to) : null;
  const { on: _on, at: _at, ...rest } = gate.params;
  if (!near) return replacePart(bench, { ...gate, params: rest, pos: to ?? gate.pos } as PlacedPart);
  const moved = { ...gate, params: { ...rest, on: near.lead, at: near.at } } as PlacedPart;
  const spot = gateSpot({ ...bench, parts: [moved] }, moved);
  return replacePart(bench, { ...moved, pos: spot ? [spot.origin[0], spot.origin[2]] : (to ?? gate.pos) } as PlacedPart);
}

// Holders ---------------------------------------------------------------------------------------------------------

/** Takes a part out of whatever holds it; it stays where it is. */
export function unseat(bench: BenchState, id: string): BenchState {
  const h = holderOf(bench, id);
  if (!h) return bench;
  const held = { ...heldOf(h.holder) };
  delete held[h.seat.name];
  return replacePart(bench, { ...h.holder, params: { ...h.holder.params, held } } as PlacedPart);
}

/**
 * Puts a part in a holder's seat: `seatName`, else the first free seat that fits, else the first that fits. Whoever
 * sat there before is pushed out onto the desk in front of the holder.
 */
export function seatPart(bench: BenchState, id: string, holderId: string, seatName?: string): BenchState {
  let b = unseat(bench, id);
  const part = b.parts.find((p) => p.id === id);
  let holder = b.parts.find((p) => p.id === holderId);
  if (!part || !holder || part.id === holder.id) return bench;
  const seats = seatsOf(holder).filter((s) => seatFits(s, part));
  const held = { ...heldOf(holder) };
  const seat = (seatName ? seats.find((s) => s.name === seatName) : seats.find((s) => !held[s.name])) ?? seats[0];
  if (!seat) return bench;
  const prev = held[seat.name];
  held[seat.name] = id;
  holder = { ...holder, params: { ...holder.params, held } } as PlacedPart;
  b = replacePart(b, holder);
  if (prev && prev !== id) {
    const out = b.parts.find((p) => p.id === prev);
    if (out) b = replacePart(b, { ...out, pos: popSpot(holder, seatsOf(holder).indexOf(seat)), rot: holder.rot } as PlacedPart);
  }
  return syncHeld(b, holder.id);
}

/** Keeps the stored position of every part in a holder in step with its seat (after the holder moves or changes). */
export function syncHeld(bench: BenchState, holderId: string): BenchState {
  const holder = bench.parts.find((p) => p.id === holderId);
  if (!holder) return bench;
  const held = heldOf(holder);
  let b = bench;
  for (const seat of seatsOf(holder)) {
    const id = held[seat.name];
    const part = id ? b.parts.find((p) => p.id === id) : undefined;
    if (!part) continue;
    const sp = seatPose(holder, seat, part, b);
    const { holes: _h, ...rest } = part;
    const pos: Vec2 = [sp.origin[0], sp.origin[2]];
    if (!part.holes && part.pos[0] === pos[0] && part.pos[1] === pos[1] && part.rot === sp.rot) continue;
    b = replacePart(b, { ...rest, pos, rot: sp.rot } as PlacedPart);
  }
  return b;
}

/**
 * Swaps two parts: each takes the other's place (desk spot, seat or holes) and the clips and probe tips on its leads.
 * Dropping a fresh battery or LED onto an old one this way keeps the circuit wired.
 */
export function swapParts(bench: BenchState, aId: string, bId: string): BenchState {
  const pa = bench.parts.find((p) => p.id === aId);
  const pb = bench.parts.find((p) => p.id === bId);
  if (!pa || !pb || aId === bId) return bench;
  const placeAs = (p: PlacedPart, from: PlacedPart): PlacedPart => {
    const { holes: _h, ...rest } = p;
    return { ...rest, pos: from.pos, rot: from.rot, ...(from.holes ? { holes: from.holes } : {}) } as PlacedPart;
  };
  const other = (id: string) => (id === aId ? bId : id === bId ? aId : id);
  let b: BenchState = {
    ...bench,
    parts: bench.parts.map((p) => {
      let q = p.id === aId ? placeAs(pa, pb) : p.id === bId ? placeAs(pb, pa) : p;
      const held = heldOf(q);
      if (Object.values(held).some((v) => v === aId || v === bId)) {
        q = { ...q, params: { ...q.params, held: Object.fromEntries(Object.entries(held).map(([k, v]) => [k, v ? other(v) : v])) } } as PlacedPart;
      }
      return q;
    }),
  };
  const fix = (end: LeadEnd): LeadEnd => {
    const a = end.to ? parseAnchor(end.to) : null;
    if (a?.type !== "pin" || (a.part !== aId && a.part !== bId)) return end;
    return { ...end, to: `pin:${other(a.part)}.${a.leg}` };
  };
  b = { ...b, leads: b.leads.map((l) => ({ ...l, a: fix(l.a), b: fix(l.b) })) };
  if (b.meter) {
    const m = b.meter;
    b = { ...b, meter: { ...m, probes: { red: { ...m.probes.red, tip: fix(m.probes.red.tip) }, black: { ...m.probes.black, tip: fix(m.probes.black.tip) } } } };
  }
  return b;
}

/** `id` was dragged here from `from` and dropped on `targetId`: it takes the target's place and wiring, the target goes to `from`. */
export function dropOnto(bench: BenchState, id: string, targetId: string, from: Vec2): BenchState {
  const b = unseat(bench, id);
  const part = b.parts.find((p) => p.id === id);
  if (!part) return bench;
  const { holes: _h, ...rest } = part;
  return swapParts(replacePart(b, { ...rest, pos: from } as PlacedPart), id, targetId);
}

/** A part of the same kind lying under `id` (within `reach` mm), that dropping `id` there would swap with. */
export function swapTarget(bench: BenchState, id: string, reach = 9): PlacedPart | null {
  const part = bench.parts.find((p) => p.id === id);
  if (!part || isOnBoard(bench, part)) return null;
  let best: PlacedPart | null = null;
  let bestD = reach;
  for (const p of bench.parts) {
    if (p.id === id || p.kind !== part.kind || isOnBoard(bench, p)) continue;
    const d = Math.hypot(p.pos[0] - part.pos[0], p.pos[1] - part.pos[1]);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Rotate a part a quarter turn about its centre. On the board, keeps it seated or leaves it unchanged. */
export function rotatePart(bench: BenchState, id: string, step = 90): BenchState {
  const part = bench.parts.find((p) => p.id === id);
  // A torn piece of a drawing turns its symbol, the same as tapping it, in or out of the card's gap.
  if (part?.kind === "piece") return setPartParams(bench, id, { turn: ((((part.params.turn ?? 0) + step) % 360) + 360) % 360 } as never);
  if (!part) return bench;
  const seated = holderOf(bench, id);
  if (seated) {
    // A seat may let its part turn round in it (a chip in its socket); otherwise a seated part keeps its turn.
    if (!seated.seat.turn) return bench;
    return syncHeld(setPartParams(bench, seated.holder.id, seated.seat.turn() as never), seated.holder.id);
  }
  if (seatsOf(part).length) return syncHeld(replacePart(bench, { ...part, rot: (((part.rot + step) % 360) + 360) % 360 } as PlacedPart), id);
  const center = partCenter(bench, part);
  if (isOnBoard(bench, part)) {
    const pose = partPose(bench, part);
    const span = currentSpan(bench, part);
    // A DIP across the channel cannot stand sideways: a quarter turn that does not fit tries a half turn.
    const turns = (partDef(part.kind) as { turnsRound?: boolean }).turnsRound ? [step, step * 2] : [step];
    for (const t of turns) {
      const rot = (((Math.round(pose.rot / 90) * 90 + t) % 360) + 360) % 360;
      const holes = fitOnBoard(bench, part.kind, part.params, rot, center, { exceptId: id, span, reach: 1.1 });
      if (holes) return syncHeld(replacePart(bench, { ...part, rot, holes } as PlacedPart), id);
    }
    return bench;
  }
  return replacePart(bench, { ...part, rot: (((part.rot + step) % 360) + 360) % 360 } as PlacedPart);
}

/**
 * Stretch a two-lead axial part by moving one lead to the free hole nearest `to`, keeping the lead spacing
 * within the part's span limits (3 to 8 holes for a resistor).
 */
export function moveSpanLeg(bench: BenchState, id: string, leg: string, to: Vec2): BenchState {
  const part = bench.parts.find((p) => p.id === id);
  const def = part ? partDef(part.kind) : null;
  if (!part || !def?.span || !bench.board || !isOnBoard(bench, part)) return bench;
  const other = def.span.legs[0] === leg ? def.span.legs[1] : def.span.legs[0];
  const fixed = holeWorld(bench.board, part.holes![other]!)!;
  const occupied = occupiedHoles(bench, { part: id });
  const geom = boardGeometry(bench.board);
  const [ox, oz] = boardOrigin(bench.board);
  let best: HoleId | null = null;
  let bestD = Infinity;
  for (const h of geom.holes.values()) {
    if (occupied.has(h.id)) continue;
    const hx = ox + h.x;
    const hz = oz + h.z;
    const span = Math.hypot(hx - fixed[0], hz - fixed[1]) / PITCH;
    if (span < def.span.min - 0.01 || span > def.span.max + 0.01) continue;
    const d = Math.hypot(hx - to[0], hz - to[1]);
    if (d < bestD) {
      bestD = d;
      best = h.id;
    }
  }
  if (!best || bestD > PITCH * 12) return bench;
  const holes = { ...part.holes, [leg]: best };
  return replacePart(bench, { ...part, holes } as PlacedPart);
}

/** Put a flexible lead (battery snap, speaker wire) into the free hole nearest `to`, or let it lie on the desk. */
export function moveFlyingLeg(bench: BenchState, id: string, leg: string, to: Vec2): BenchState {
  const part = bench.parts.find((p) => p.id === id);
  if (!part || !isFlying(part)) return bench;
  const hole = bench.board ? nearestHole(bench.board, to[0], to[1]) : null;
  const occupied = occupiedHoles(bench, { part: id, leg });
  const holes = { ...(part.holes ?? {}) };
  const ends = { ...(part.ends ?? {}) };
  if (hole && !occupied.has(hole)) {
    holes[leg] = hole;
  } else {
    delete holes[leg];
    ends[leg] = to;
  }
  return replacePart(bench, { ...part, holes, ends } as PlacedPart);
}

/** Drop every clip and probe attached to anchors that match `gone`, leaving them where they were. */
function detach(bench: BenchState, gone: (a: Anchor) => boolean): BenchState {
  const fix = (end: LeadEnd): LeadEnd => {
    if (!end.to || !gone(end.to)) return end;
    const p = anchorPosition(bench, end.to);
    return { to: null, pos: p ? [p[0], p[2] + 6] : end.pos };
  };
  const leads = bench.leads.map((l) => ({ ...l, a: fix(l.a), b: fix(l.b) }));
  let meter = bench.meter;
  if (meter) {
    meter = {
      ...meter,
      probes: {
        red: { ...meter.probes.red, tip: fix(meter.probes.red.tip) },
        black: { ...meter.probes.black, tip: fix(meter.probes.black.tip) },
      },
    };
  }
  return { ...bench, leads, meter };
}

export function removePart(bench: BenchState, id: string): BenchState {
  const detached = detach(unseat(bench, id), (a) => a.startsWith(`pin:${id}.`));
  return { ...detached, parts: detached.parts.filter((p) => p.id !== id) };
}

export function setPartParams<K extends BenchPartKind>(bench: BenchState, id: string, params: Partial<PartParamsMap[K]>): BenchState {
  const part = bench.parts.find((p) => p.id === id);
  if (!part) return bench;
  // A box's knob turns the trimmer inside it.
  const knob = part.kind === "box" ? (params as { position?: number }).position : undefined;
  let next = replacePart(bench, { ...part, params: { ...part.params, ...params } } as PlacedPart);
  if (knob !== undefined) {
    const trimmer = boxTrimmer(next, id);
    if (trimmer) next = replacePart(next, { ...trimmer, params: { ...trimmer.params, position: knob } } as PlacedPart);
  }
  return seatsOf(part).length ? syncHeld(next, id) : next;
}

/** The trimmer inside a box (the one its knob turns), if any. */
export function boxTrimmer(bench: BenchState, boxId: string): PlacedPart | null {
  const box = bench.parts.find((p) => p.id === boxId);
  if (!box) return null;
  for (const held of Object.values(heldOf(box))) {
    const p = held ? bench.parts.find((x) => x.id === held) : undefined;
    if (p?.kind === "trimmer") return p;
  }
  return null;
}

/** The params a setting change sets: the value, plus whatever the setting brings along (see SettingDef.also). */
export function settingParams(bench: BenchState, id: string, key: string, value: string | number | boolean): Record<string, unknown> {
  const part = bench.parts.find((p) => p.id === id);
  const def = part ? (partDef(part.kind).settings ?? []).find((s) => s.key === key) : undefined;
  return { [key]: value, ...(part && def?.also ? def.also(value, part.params as Record<string, unknown>) : {}) };
}

/** The params a part's one-shot action sets (the pencil card's eraser), or null when it has no such action. */
export function actionParams(bench: BenchState, id: string, action: string): Record<string, unknown> | null {
  const part = bench.parts.find((p) => p.id === id);
  const def = part ? (partDef(part.kind).actions ?? []).find((a) => a.id === action) : undefined;
  return part && def ? def.apply(part.params as Record<string, unknown>) : null;
}

/**
 * A pencil stroke along a card from its 0 mark to `reach` cm. On a clean card it draws a line (1 cm at least); a
 * stroke that covers the whole line shades it again (up to 4 layers) and may extend it; a shorter one changes nothing.
 */
export function penStroke(base: { length: number; layers: number }, reach: number): { length: number; layers: number } {
  if (reach < 0.5) return base;
  if (base.layers <= 0 || base.length <= 0) return { length: Math.max(1, reach), layers: 1 };
  if (reach >= base.length - 0.25) return { length: Math.max(base.length, reach), layers: Math.min(4, base.layers + 1) };
  return base;
}

// Wires -----------------------------------------------------------------------------------------------------------

export function addWire(bench: BenchState, a: HoleId, b: HoleId, color: WireColor, id?: string): [BenchState, string | null] {
  if (!bench.board || a === b) return [bench, null];
  const geom = boardGeometry(bench.board);
  if (!geom.holes.has(a) || !geom.holes.has(b)) return [bench, null];
  const occ = occupiedHoles(bench);
  if (occ.has(a) || occ.has(b)) return [bench, null];
  const wid = id ?? nextId(bench, "W");
  const wire: Wire = { id: wid, a, b, color };
  return [{ ...bench, wires: [...bench.wires, wire] }, wid];
}

export function moveWireEnd(bench: BenchState, id: string, end: "a" | "b", to: Vec2): BenchState {
  const w = bench.wires.find((x) => x.id === id);
  if (!w || !bench.board) return bench;
  const hole = nearestHole(bench.board, to[0], to[1]);
  if (!hole) return bench;
  const occ = occupiedHoles(bench, { wire: id, leg: end });
  if (occ.has(hole) || hole === (end === "a" ? w.b : w.a)) return bench;
  return { ...bench, wires: bench.wires.map((x) => (x.id === id ? { ...x, [end]: hole } : x)) };
}

export function removeWire(bench: BenchState, id: string): BenchState {
  const detached = detach(bench, (a) => a.startsWith(`wire:${id}.`));
  return { ...detached, wires: detached.wires.filter((w) => w.id !== id) };
}

export function setWireColor(bench: BenchState, id: string, color: WireColor): BenchState {
  return { ...bench, wires: bench.wires.map((w) => (w.id === id ? { ...w, color } : w)) };
}

// Test leads ----------------------------------------------------------------------------------------------------

export function addLead(bench: BenchState, color: LeadColor, at: Vec2, id?: string): [BenchState, string] {
  const lid = id ?? nextId(bench, "TL");
  const lead: TestLead = {
    id: lid,
    color,
    a: { to: null, pos: [at[0] - 40, at[1]] },
    b: { to: null, pos: [at[0] + 40, at[1] + 6] },
  };
  return [{ ...bench, leads: [...bench.leads, lead] }, lid];
}

/** Clip a lead end onto an anchor (or drop it on the desk with `to: null`). */
export function clipLead(bench: BenchState, id: string, end: "a" | "b", to: Anchor | null, pos?: Vec2): BenchState {
  return {
    ...bench,
    leads: bench.leads.map((l) => {
      if (l.id !== id) return l;
      const cur = end === "a" ? l.a : l.b;
      // A lead cannot clip onto itself.
      const self = to && (to === `lead:${id}.a` || to === `lead:${id}.b`);
      const next: LeadEnd = { to: self ? null : to, pos: pos ?? cur.pos };
      return end === "a" ? { ...l, a: next } : { ...l, b: next };
    }),
  };
}

export function removeLead(bench: BenchState, id: string): BenchState {
  const detached = detach(bench, (a) => a.startsWith(`lead:${id}.`));
  // Gates on it drop onto the desk where they were.
  const parts = detached.parts.map((p) => {
    if (p.kind !== "gate" || p.params.on !== id) return p;
    const { on: _on, at: _at, ...rest } = p.params;
    return { ...p, params: rest } as PlacedPart;
  });
  return { ...detached, parts, leads: detached.leads.filter((l) => l.id !== id) };
}

export function setLeadColor(bench: BenchState, id: string, color: LeadColor): BenchState {
  return { ...bench, leads: bench.leads.map((l) => (l.id === id ? { ...l, color } : l)) };
}

// Meter ----------------------------------------------------------------------------------------------------------

export function defaultMeter(pos: Vec2 = [175, 20], rot = 0): NonNullable<BenchState["meter"]> {
  return {
    id: "M1",
    pos,
    rot,
    mode: "off",
    probes: {
      red: { socket: "vohm", plugPos: [pos[0] + 30, pos[1] + 100], tip: { to: null, pos: [pos[0] - 60, pos[1] + 70] } },
      black: { socket: "com", plugPos: [pos[0] + 10, pos[1] + 100], tip: { to: null, pos: [pos[0] - 75, pos[1] + 58] } },
    },
  };
}

export function setMeterMode(bench: BenchState, mode: NonNullable<BenchState["meter"]>["mode"]): BenchState {
  return bench.meter ? { ...bench, meter: { ...bench.meter, mode } } : bench;
}

export function plugProbe(bench: BenchState, color: ProbeColor, socket: MeterSocket | null, plugPos?: Vec2): BenchState {
  const m = bench.meter;
  if (!m) return bench;
  const other = color === "red" ? "black" : "red";
  // One plug per socket: a plug already there is pushed out next to the meter.
  const probes = { ...m.probes };
  if (socket && probes[other].socket === socket) {
    probes[other] = { ...probes[other], socket: null, plugPos: [m.pos[0] + 48, m.pos[1] + 70] };
  }
  probes[color] = { ...probes[color], socket, plugPos: plugPos ?? probes[color].plugPos };
  return { ...bench, meter: { ...m, probes } };
}

export function touchProbe(bench: BenchState, color: ProbeColor, to: Anchor | null, pos?: Vec2): BenchState {
  const m = bench.meter;
  if (!m) return bench;
  const self = to === `probe:${color}`;
  const probes = { ...m.probes, [color]: { ...m.probes[color], tip: { to: self ? null : to, pos: pos ?? m.probes[color].tip.pos } } };
  return { ...bench, meter: { ...m, probes } };
}

export function moveMeter(bench: BenchState, pos: Vec2, rot?: number): BenchState {
  const m = bench.meter;
  if (!m) return bench;
  const dx = pos[0] - m.pos[0];
  const dz = pos[1] - m.pos[1];
  const shift = (p: Vec2): Vec2 => [p[0] + dx, p[1] + dz];
  // Plugs in sockets follow the meter; loose plugs and probes stay where they are.
  return { ...bench, meter: { ...m, pos, rot: rot ?? m.rot, probes: { red: { ...m.probes.red, plugPos: shift(m.probes.red.plugPos) }, black: { ...m.probes.black, plugPos: shift(m.probes.black.plugPos) } } } };
}

/** Everything attached to a hole or lead, for x-ray hover and lab hints. */
export function describeAnchor(bench: BenchState, anchor: Anchor): string {
  const a = parseAnchor(anchor);
  if (!a) return anchor;
  switch (a.type) {
    case "hole":
      return a.hole.toUpperCase();
    case "pin":
      return `${a.part} ${a.leg}`;
    default:
      return anchor;
  }
}

export { isOnBoard, partPose };
