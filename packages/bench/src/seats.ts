// Holders and their seats: which part sits in which holder, where it sits, and finding a free seat near a point.
// Pure: shared by ops (seating on drop), layout (poses) and the netlist (contacts).

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

/** World position (mm, y up) and turn of a part in a seat. */
export function seatPose(holder: PlacedPart, seat: SeatDef, held: PlacedPart): { origin: Vec3; rot: number } {
  const p = seat.place(held);
  const [rx, rz] = rotateXZ(p.at[0], p.at[2], holder.rot);
  return { origin: [holder.pos[0] + rx, p.at[1], holder.pos[1] + rz], rot: (((holder.rot + (p.rot ?? 0)) % 360) + 360) % 360 };
}

/** The nearest seat that accepts `part` within `reach` mm of a desk point (a full seat only when nothing else is free). */
export function seatNear(bench: BenchState, part: PlacedPart, to: Vec2, reach = SEAT_REACH): { holder: PlacedPart; seat: SeatDef } | null {
  let best: { holder: PlacedPart; seat: SeatDef; d: number } | null = null;
  for (const h of bench.parts) {
    if (h.id === part.id) continue;
    // A holder cannot go into a part it holds.
    if (Object.values(heldOf(part)).includes(h.id)) continue;
    const held = heldOf(h);
    for (const seat of seatsOf(h)) {
      if (!seat.accepts.includes(part.kind)) continue;
      const pose = seatPose(h, seat, part);
      const taken = held[seat.name] && held[seat.name] !== part.id;
      const d = Math.hypot(pose.origin[0] - to[0], pose.origin[2] - to[1]) + (taken ? reach * 0.75 : 0);
      if (d <= reach * (taken ? 1.75 : 1) && (!best || d < best.d)) best = { holder: h, seat, d };
    }
  }
  return best ? { holder: best.holder, seat: best.seat } : null;
}

/** Desk spot a part is pushed out to when another one takes its seat: in front of the holder. */
export function popSpot(holder: PlacedPart, index: number): Vec2 {
  const [rx, rz] = rotateXZ(-18 + index * 12, 34, holder.rot);
  return [holder.pos[0] + rx, holder.pos[1] + rz];
}
