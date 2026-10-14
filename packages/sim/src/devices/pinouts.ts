// Pin names in pin-number order (pin 1 first) for the multi-pin parts, so a bench can map a DIP socket or a
// display footprint to netlist pin names. Netlists name pins; these tables say where each name sits.

import type { LogicModel } from "../types";

export const TIMER555_PINS = ["gnd", "trig", "out", "reset", "ctrl", "thresh", "dis", "vcc"] as const;

/** Common 10-pin 0.56 inch display: e, d, com, c, dp along the bottom, b, a, com, f, g along the top. */
export const SEVENSEG_PINS = ["e", "d", "com", "c", "dp", "b", "a", "com2", "f", "g"] as const;

/** 7805 in TO-220, legs down, printed face toward you: in, gnd, out. */
export const REGULATOR7805_PINS = ["in", "gnd", "out"] as const;

const QUAD2 = ["a1", "b1", "y1", "a2", "b2", "y2", "gnd", "y3", "a3", "b3", "y4", "a4", "b4", "vcc"] as const;

export const LOGIC_PINOUTS: Record<LogicModel, readonly string[]> = {
  "74HC00": QUAD2,
  "74HC08": QUAD2,
  "74HC32": QUAD2,
  "74HC86": QUAD2,
  // The NOR has its outputs first in each group: not a drop-in swap for the others.
  "74HC02": ["y1", "a1", "b1", "y2", "a2", "b2", "gnd", "a3", "b3", "y3", "a4", "b4", "y4", "vcc"],
  "74HC04": ["a1", "y1", "a2", "y2", "a3", "y3", "gnd", "y4", "a4", "y5", "a5", "y6", "a6", "vcc"],
  "74HC14": ["a1", "y1", "a2", "y2", "a3", "y3", "gnd", "y4", "a4", "y5", "a5", "y6", "a6", "vcc"],
  "74HC27": ["a1", "b1", "a2", "b2", "c2", "y2", "gnd", "y3", "a3", "b3", "c3", "y1", "c1", "vcc"],
  "74HC74": ["clr1", "d1", "clk1", "pre1", "q1", "qn1", "gnd", "qn2", "q2", "pre2", "clk2", "d2", "clr2", "vcc"],
  "74HC393": ["clk1", "clr1", "qa1", "qb1", "qc1", "qd1", "gnd", "qd2", "qc2", "qb2", "qa2", "clr2", "clk2", "vcc"],
  "4026B": ["clk", "inh", "dei", "deo", "co", "f", "g", "vss", "d", "a", "e", "b", "c", "ucs", "rst", "vdd"],
};

/** Lit segments for each digit (the 4026B's shapes: 6 and 9 have their tails). */
export const DIGIT_SEGMENTS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"] as const;

/** The digit a set of lit segments shows ("" when it is no digit). The decimal point is ignored. */
export function digitOf(lit: string): string {
  const key = [..."abcdefg"].filter((s) => lit.includes(s)).join("");
  const k = DIGIT_SEGMENTS.indexOf(key as (typeof DIGIT_SEGMENTS)[number]);
  if (k >= 0) return String(k);
  if (key === "") return " ";
  if (key === "g") return "-";
  // 7 drawn with the f tail, 9 without its tail, 6 without its tail: still readable digits.
  if (key === "abcf") return "7";
  if (key === "abcfg") return "9";
  if (key === "cdefg") return "6";
  return "";
}
