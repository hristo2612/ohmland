// The home framing both views share: what of the bench a lab's frame brings into view. Pure, no renderer.

/** Desk rectangle [x0, z0, x1, z1] in mm. */
export type DeskRect = [number, number, number, number];

/**
 * A lab's frame grown to take in whole the parts that reach into it (`parts`: their desk rectangles), as long as each
 * grows it by no more than about a third (`grow`): a part that only pokes out (a battery at the edge, drawn larger
 * than life in ink) comes in; one the lab left mostly outside its frame stays out. A phone passes a looser `grow`:
 * its narrow view would otherwise cut such a part in half at the edge.
 */
export function frameWithParts(frame: Readonly<DeskRect>, parts: readonly Readonly<DeskRect>[], grow = 1.35): DeskRect {
  const w = frame[2] - frame[0];
  const h = frame[3] - frame[1];
  let r: DeskRect = [...frame];
  for (const b of parts) {
    if (!(b[0] < frame[2] && b[2] > frame[0] && b[1] < frame[3] && b[3] > frame[1])) continue;
    const u: DeskRect = [Math.min(r[0], b[0]), Math.min(r[1], b[1]), Math.max(r[2], b[2]), Math.max(r[3], b[3])];
    if (u[2] - u[0] <= w * grow && u[3] - u[1] <= h * grow) r = u;
  }
  return r;
}
