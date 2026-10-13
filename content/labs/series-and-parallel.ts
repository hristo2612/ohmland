// Blueprint: docs/curriculum/unit-1.md, L12. A battery, two 1 kΩ resistors and a 3.3 kΩ one lying loose, five clip
// leads in the tray, and the meter on Ω, 20k.
import { defineLab, type LabView } from "@ohmland/lab";
import { near, siIn, taggedAll } from "./lib/meter";

/** The probes sit on the two free ends of R1 and R2 linked end to end. */
const acrossChain = (lab: LabView, ids: string[]): boolean => {
  const c = lab.chain(ids);
  return !!c && lab.probed(c.ends[0], c.ends[1], "either");
};

/** The probes sit across two resistors side by side. */
const acrossPair = (lab: LabView, a: string, b: string): boolean => lab.parallel(a, b) && lab.probed(`${a}.a`, `${a}.b`, "either");

/** A logged battery current (in series with B1, on a mA range) with this tag, in mA, in [lo, hi]. */
const loggedCurrent = (lab: LabView, tag: string, lo: number, hi: number): boolean =>
  taggedAll(lab, "series:B1", tag).some((r) => r.mode === "dca-ma" && r.si * 1000 >= lo && r.si * 1000 <= hi);

export default defineLab({
  id: "series-and-parallel",
  title: "End to end, side by side",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-104,10", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-14,-34", params: { ohms: 1000, watts: 0.25, actualOhms: 1000 }, label: "1 kΩ resistor" },
      { id: "R2", kind: "resistor", at: "desk:-14,6", params: { ohms: 1000, watts: 0.25, actualOhms: 990 }, label: "1 kΩ resistor" },
      { id: "R3", kind: "resistor", at: "desk:60,46", params: { ohms: 3300, watts: 0.25, actualOhms: 3300 }, label: "3.3 kΩ resistor" },
    ],
    tray: [
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "black" }, count: 1 },
      { kind: "lead", params: { color: "yellow" }, count: 1 },
      { kind: "lead", params: { color: "green" }, count: 1 },
      { kind: "lead", params: { color: "blue" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:142,20", mode: "ohm", range: "20k" }],
  },
  notebook: {
    tags: {
      "pair-series": (lab) => lab.chain(["R1", "R2"]) !== null,
      "pair-parallel": (lab) => lab.parallel("R1", "R2"),
    },
  },
  mascot: {
    start: "Two resistors, two ways to team up. Place your bets.",
    hint: "Side by side? The total is smaller than the smaller one.",
    success: "Half! You called it. More paths, less resistance.",
  },
  tasks: [
    {
      id: "series-ohms",
      prompt: "Clip R1 and R2 end to end. Measure from one free end to the other.",
      goal: (lab) => lab.meter?.mode === "ohm" && acrossChain(lab, ["R1", "R2"]) && siIn(lab, 1900, 2100),
      hints: ["One clip lead joins an end of R1 to an end of R2.", "Then a probe on each of the two ends left over."],
      highlight: ["R1", "R2"],
      success: "About 2 kΩ. End to end, resistances add.",
    },
    {
      id: "parallel-ohms",
      prompt: "Now put them side by side: join the two left ends together, and the two right ends together. Measure across the pair.",
      goal: (lab) => lab.meter?.mode === "ohm" && acrossPair(lab, "R1", "R2") && siIn(lab, 470, 530),
      hints: ["Two clip leads: one joins the left ends, one joins the right ends.", "Try the 2k range for more digits."],
      highlight: ["pin:R1.a", "pin:R2.a", "pin:R1.b", "pin:R2.b"],
      success: "About 500 Ω. Two equal paths, half the resistance.",
    },
    {
      id: "predict-mixed",
      prompt: "Swap R2 for the 3.3 kΩ resistor, still side by side with R1. Predict the total first, then measure.",
      goal: (lab) => near(lab.note("prediction"), 767, 0.05) && lab.meter?.mode === "ohm" && acrossPair(lab, "R1", "R3") && siIn(lab, 730, 800),
      note: { id: "prediction", label: "Your prediction for 1 kΩ and 3.3 kΩ side by side", unit: "Ω" },
      hints: ["Product over sum: (1 × 3.3) ÷ (1 + 3.3), in kilohms.", "It must be less than 1 kΩ."],
      highlight: ["R3"],
      success: "About 767 Ω, less than either resistor alone.",
    },
    {
      id: "four-times",
      prompt:
        "Put R1 and R2 back. Measure the battery current with the pair in series, then with the pair in parallel. Use the 20mA range.",
      goal: (lab) => loggedCurrent(lab, "pair-series", 4.3, 5.0) && loggedCurrent(lab, "pair-parallel", 17.0, 19.5),
      hints: [
        "Red lead into mA. The meter goes in series: battery plus to the red probe, black probe to the resistors, and the far end back to battery minus.",
        "Hold each reading steady so the notebook logs it, then rewire the pair the other way.",
      ],
      success: "About 4.7 mA, then about 18.4 mA: roughly four times as much. Half the resistance in each step, twice over.",
    },
  ],
  solution: [
    { do: "lead", id: "TL1", from: "R1.b", to: "R2.a", color: "yellow" },
    { do: "probe", red: "R1.a", black: "R2.b" },
    { do: "check", task: "series-ohms" },
    { do: "clip", lead: "TL1", end: "b", to: "R2.b" },
    { do: "lead", id: "TL2", from: "R1.a", to: "R2.a", color: "green" },
    { do: "probe", red: "R1.a", black: "R1.b", range: "2k" },
    { do: "check", task: "parallel-ohms" },
    { do: "note", id: "prediction", value: "767" },
    { do: "clip", lead: "TL1", end: "b", to: "R3.b" },
    { do: "clip", lead: "TL2", end: "b", to: "R3.a" },
    { do: "check", task: "predict-mixed" },
    // Series: R1 then R2, back to battery minus, with the meter between battery plus and R1.
    { do: "clip", lead: "TL1", end: "b", to: "R2.a" },
    { do: "clip", lead: "TL2", end: "a", to: "R2.b" },
    { do: "clip", lead: "TL2", end: "b", to: "B1.neg" },
    { do: "probe", red: null, black: null },
    { do: "plug", probe: "red", socket: "ma" },
    { do: "dial", mode: "dca-ma", range: "20mA" },
    { do: "probe", red: "B1.pos", black: "R1.a" },
    { do: "wait", seconds: 0.8 },
    // Parallel: join the left ends and the right ends.
    { do: "lead", id: "TL3", from: "R1.a", to: "R2.a", color: "blue" },
    { do: "clip", lead: "TL1", end: "b", to: "R2.b" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "four-times" },
  ],
});
