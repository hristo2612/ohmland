// The junk drawer's tester (Start here, SH2): the lamp loop with a gap between two loose clips, TL2's clip `a` (from
// the resistor) and TL3's clip `b` (from the lamp). An object bridges the gap when one clip bites each of its ends.
import type { LabView } from "@ohmland/lab";

/** The two loose clips of the tester's gap. */
export const GAP = ["TL2.a", "TL3.b"] as const;

/** `id` sits across the gap: one of its ends in each loose clip. */
export const bridged = (lab: LabView, id: string): boolean => lab.joins(id, GAP[0], GAP[1]);
