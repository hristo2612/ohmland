/**
 * The robot's antenna blinker on perfboard (docs/curriculum/unit-3.md, MP11 and MP12): Unit 2's twin blinker
 * (content/labs/twin-flasher.ts) laid out on a 12 by 9 pad-per-hole board, with the robot's insulated wire links
 * already underneath. Seen from the top (rows A to I from the far edge, columns 1 to 12 from the left):
 *
 * - Q1 and Q2 (2N3904, flat face toward you: E, B, C) in E2 to E4 and E8 to E10;
 * - the red LEDs D1 and D2 in C3 and C4, C9 and C10 (long leg left);
 * - the 1 kΩ collector resistors R1 (A1 to A5) and R2 (A7 to A11), the 68 kΩ base resistors R3 (G1 to G5) and R4
 *   (G7 to G11);
 * - the 10 µF capacitors C1 (+ in I3, stripe in I4) and C2 (+ in I8, stripe in I9);
 * - the battery's snap leads in A12 (+) and I12 (−).
 *
 * Every connection is a link between two of those pads (the plan's numbered lines), so a pad joins its leg to its
 * links only once it is soldered. From plus, each 1 kΩ feeds an LED into a collector; each 68 kΩ feeds a base; C1 runs
 * from Q1's collector to Q2's base, C2 from Q2's collector to Q1's base; the emitters go to minus.
 */
import type { LabView } from "@ohmland/lab";
import { joint, type JointRecord } from "./solder";

export type Ghost = { id: string; kind: string; legs: Record<string, string>; params?: Record<string, unknown> };

export const GHOSTS: Ghost[] = [
  { id: "Q1", kind: "npn", legs: { e: "E2", b: "E3", c: "E4" } },
  { id: "Q2", kind: "npn", legs: { e: "E8", b: "E9", c: "E10" } },
  { id: "D1", kind: "led", legs: { anode: "C3", cathode: "C4" } },
  { id: "D2", kind: "led", legs: { anode: "C9", cathode: "C10" } },
  { id: "R1", kind: "resistor", legs: { a: "A1", b: "A5" } },
  { id: "R2", kind: "resistor", legs: { a: "A7", b: "A11" } },
  { id: "R3", kind: "resistor", legs: { a: "G1", b: "G5" } },
  { id: "R4", kind: "resistor", legs: { a: "G7", b: "G11" } },
  { id: "C1", kind: "electrolytic-cap", legs: { pos: "I3", neg: "I4" } },
  { id: "C2", kind: "electrolytic-cap", legs: { pos: "I8", neg: "I9" } },
  { id: "B1", kind: "battery", legs: { pos: "A12", neg: "I12" } },
];

/** The links underneath, one per plan line, net by net. */
export const LINES: [string, string][] = [
  // + : the battery, both collector resistors, both base resistors
  ["A12", "A7"],
  ["A7", "A1"],
  ["A1", "G1"],
  ["G1", "G7"],
  // − : the battery and both emitters
  ["I12", "E8"],
  ["E8", "E2"],
  // Q1's collector, D1's cathode, C1's +
  ["E4", "C4"],
  ["E4", "I3"],
  // R1 to D1's anode
  ["A5", "C3"],
  // Q2's collector, D2's cathode, C2's +
  ["E10", "C10"],
  ["E10", "I8"],
  // R2 to D2's anode
  ["A11", "C9"],
  // Q1's base, R3, C2's stripe
  ["E3", "G5"],
  ["G5", "I9"],
  // Q2's base, R4, C1's stripe
  ["E9", "G11"],
  ["G11", "I4"],
];

export const LINKS = LINES.map(([a, b], i) => ({ id: `L${i + 1}`, a, b, insulated: true }));

/** The pads a part's legs go through, as the plan has them. */
export const padsOf = (...ids: string[]): string[] => GHOSTS.filter((g) => ids.includes(g.id)).flatMap((g) => Object.values(g.legs));

/** Good joints at these pads, as records for a `jointsStep`. */
export const goodAt = (pads: string[]): Record<string, JointRecord> => Object.fromEntries(pads.map((p) => [p, joint("good")]));

export const BATCH_ONE = ["Q1", "Q2", "D1", "D2"];
export const BATCH_TWO = ["R1", "R2", "R3", "R4"];
export const BATCH_THREE = ["C1", "C2"];

/** Each part's legs are in its ghost's pads on this board. */
export function onGhosts(lab: LabView, board: string, ids: string[]): boolean {
  const legs = lab.solder.board(board)?.legs ?? [];
  return GHOSTS.filter((g) => ids.includes(g.id)).every((g) => Object.entries(g.legs).every(([leg, pad]) => legs.some((l) => l.part === g.id && l.leg === leg && l.pad === pad)));
}

/** Every pad of these parts has a good joint. */
export function goodJoints(lab: LabView, board: string, ids: string[]): boolean {
  const joints = lab.solder.board(board)?.joints ?? {};
  return padsOf(...ids).every((p) => joints[p] === "good");
}

/** Pads of these parts whose joints have set but are not good. */
export function badJoints(lab: LabView, board: string, ids: string[]): string[] {
  const joints = lab.solder.board(board)?.joints ?? {};
  return padsOf(...ids).filter((p) => joints[p] && joints[p] !== "good");
}

/** The two LEDs blink with a steady period in [lo, hi] seconds, taking turns (lit together under 20% of the time). */
export function takingTurns(lab: LabView, lo: number, hi: number): boolean {
  const p1 = lab.blinkPeriod("D1");
  const p2 = lab.blinkPeriod("D2");
  if (p1 === null || p2 === null || p1 < lo || p1 > hi || p2 < lo || p2 > hi) return false;
  const a = lab.history("glow:D1", 2 * hi);
  const b = new Map(lab.history("glow:D2", 2 * hi));
  let either = 0;
  let both = 0;
  for (const [t, g1] of a) {
    const g2 = b.get(t) ?? 0;
    if (g1 > 0.4 || g2 > 0.4) either++;
    if (g1 > 0.4 && g2 > 0.4) both++;
  }
  return either > 0 && both / either < 0.2;
}
