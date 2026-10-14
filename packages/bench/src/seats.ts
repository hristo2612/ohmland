// Holders and their seats: which part sits in which holder, where it sits, and finding a free seat near a point.
// Pure: shared by ops (seating on drop), layout (poses) and the netlist (contacts).

import { boardGeometry, holeWorld } from "./board";
import { partDef, rotateXZ, type SeatDef } from "./parts";
import type { BenchState, Held, PlacedPart, Vec2, Vec3 } from "./types";

/** How close (mm) a dropped part must land to a seat to drop into it. */
export const SEAT_REACH = 16;

/** The seats of a part (none for most kinds). */
export function seatsOf(part: PlacedPart): SeatDef[] {
  const d = partDef(part.kind) as { seats?: (p: unknown) => SeatDef[] };
  return d.seats ? d.seats(part.params) : [];
}

/** Who sits where in a holder. */
export function heldOf(part: PlacedPart): Held {
  return ((part.params as { held?: Held }).held ?? {}) as Held;
}

/** The holder and seat a part sits in, or null. */
export function holderOf(bench: BenchState, partId: string): { holder: PlacedPart; seat: SeatDef } | null {
  for (const h of bench.parts) {
    if (h.id === partId) continue;
    const held = heldOf(h);
    for (const [name, id] of Object.entries(held)) {
      if (id !== partId) continue;
      const seat = seatsOf(h).find((s) => s.name === name);
      if (seat) return { holder: h, seat };
    }
  }
  return null;
}

/** Whether a part fits a seat (its kind, then the seat's own test). */
export function seatFits(seat: SeatDef, part: PlacedPart): boolean {
  return seat.accepts.includes(part.kind) && (!seat.fits || seat.fits(part));
}

/**
 * Centre of a holder that stands in the board (an IC socket): the middle of the holes its leads are in. Null for a
 * holder on the desk.
 */
function boardCentre(bench: BenchState | undefined, holder: PlacedPart): Vec2 | null {
  if (!bench?.board || !holder.holes) return null;
  const geom = boardGeometry(bench.board);
  const pts = Object.values(holder.holes)
    .filter((h): h is string => !!h && geom.holes.has(h))
    .map((h) => holeWorld(bench.board!, h)!);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
}

/**
 * World position (mm, y up) and turn of a part in a seat, and whether it lies on its back (see SeatDef.place). Pass the
 * bench for holders that can stand in the board, so the seat follows the holes rather than the holder's stored
 * position.
 */
export function seatPose(holder: PlacedPart, seat: SeatDef, held: PlacedPart, bench?: BenchState): { origin: Vec3; rot: number; lie?: boolean } {
  const centre = boardCentre(bench, holder);
  const p = seat.place(held, { board: !!centre });
  const [rx, rz] = rotateXZ(p.at[0], p.at[2], holder.rot);
  const base = centre ?? holder.pos;
  const out: { origin: Vec3; rot: number; lie?: boolean } = { origin: [base[0] + rx, p.at[1], base[1] + rz], rot: (((holder.rot + (p.rot ?? 0)) % 360) + 360) % 360 };
  if (p.lie) out.lie = true;
  return out;
}

/** The leads a seat joins: a held part's lead -> the holder's lead it touches. */
export function seatJoins(seat: SeatDef, held: PlacedPart): Readonly<Record<string, string>> {
  const j = seat.joins;
  return typeof j === "function" ? j(held) : (j ?? {});
}

/**
 * The nearest seat that accepts `part` within `reach` mm of a desk point (a full seat only when nothing else is free).
 * `freeOnly`: never a seat another part sits in (a drop by hand never pushes a part out).
 */
export function seatNear(bench: BenchState, part: PlacedPart, to: Vec2, reach = SEAT_REACH, freeOnly = false): { holder: PlacedPart; seat: SeatDef } | null {
  let best: { holder: PlacedPart; seat: SeatDef; d: number } | null = null;
  for (const h of bench.parts) {
    if (h.id === part.id) continue;
    // A holder cannot go into a part it holds.
    if (Object.values(heldOf(part)).includes(h.id)) continue;
    const held = heldOf(h);
    for (const seat of seatsOf(h)) {
      if (!seatFits(seat, part)) continue;
      const pose = seatPose(h, seat, part, bench);
      const taken = held[seat.name] && held[seat.name] !== part.id;
      if (taken && freeOnly) continue;
      const d = Math.hypot(pose.origin[0] - to[0], pose.origin[2] - to[1]) + (taken ? reach * 0.75 : 0);
      if (d <= reach * (taken ? 1.75 : 1) && (!best || d < best.d)) best = { holder: h, seat, d };
    }
  }
  return best ? { holder: best.holder, seat: best.seat } : null;
}

/**
 * Parts out of sight inside a closed box (the box's lid is shut): the views draw nothing of them and no clip, probe or
 * pointer can reach them. They still conduct.
 */
export function hiddenParts(bench: BenchState): Set<string> {
  const out = new Set<string>();
  for (const p of bench.parts) {
    if (p.kind !== "box" || p.params.lid) continue;
    for (const id of Object.values(heldOf(p))) if (id) out.add(id);
  }
  return out;
}

/** Desk spot a part is pushed out to when another one takes its seat: in front of the holder. */
export function popSpot(holder: PlacedPart, index: number): Vec2 {
  const [rx, rz] = rotateXZ(-18 + index * 12, 34, holder.rot);
  return [holder.pos[0] + rx, holder.pos[1] + rz];
}
