// Blueprint: docs/curriculum/unit-1.md, L12, split (docs/curriculum/conversion-guide.md, B3), now "Side by side". A
// bench lesson's lab: its tasks are the beats of
// content/units/basics/voltage-and-ohms-law/series-and-parallel/lesson.yaml, in the same order.
// One idea: side by side, the total is less than the smallest. End to end moved to end-to-end.
// Half-size board, the battery's snap leads in the near rails, the meter behind the board so its probes lean away from
// the parts. R1 (1 kΩ) stands in strips 10 and 14 with the meter, on ohms, across it (row e). R2 (1 kΩ) waits on the
// desk; a 3.3 kΩ and a 1 MΩ resistor wait in the tray. Later the power comes in: a black jumper takes strip 18 to minus
// and the meter counts the flow by bridging strips 14 and 18.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { near, readsIn, siIn } from "./lib/meter";

const PARTS = {
  R1: { ohms: 1000, watts: 0.25, actualOhms: 1000 },
  R2: { ohms: 1000, watts: 0.25, actualOhms: 990 },
  R3: { ohms: 3300, watts: 0.25, actualOhms: 3300 },
  R4: { ohms: 1000000, watts: 0.25, actualOhms: 1000000 },
} as const;

/** Power comes in: the 3.3 kΩ back on the desk, red jumper plus to strip 10, black jumper strip 18 to minus, meter on mA. */
const POWER_ON: SolutionStep[] = [
  { do: "move", part: "R3", at: "desk:18,56" },
  { do: "probe", black: "e18" },
  { do: "probe", red: "e14" },
  { do: "plug", probe: "red", socket: "ma" },
  { do: "dial", mode: "dca-ma", range: "20mA" },
  { do: "wire", id: "W1", from: "rail+:9", to: "a10", color: "red" },
  { do: "wire", id: "W2", from: "a18", to: "rail-:17", color: "black" },
];

/** The fix-it bench: power off, the meter on ohms, and Sam's "side by side" pair actually end to end. */
const SAMS_PAIR: SolutionStep[] = [
  { do: "unwire", wire: "W1" },
  { do: "unwire", wire: "W2" },
  { do: "plug", probe: "red", socket: "vohm" },
  { do: "dial", mode: "ohm", range: "20k" },
  { do: "move", part: "R2", at: "d14" },
  { do: "probe", red: "e10" },
];

/** The probes sit across two resistors side by side. */
const acrossPair = (lab: LabView, a: string, b: string): boolean => lab.parallel(a, b) && lab.probed(`${a}.a`, `${a}.b`, "either");
const counting = (lab: LabView) => lab.meter?.mode === "dca-ma" && lab.meter.red === "ma";
const onOhms = (lab: LabView) => lab.meter?.mode === "ohm";

export default defineLab({
  id: "series-and-parallel",
  title: "Side by side",
  bench: {
    board: "half",
    frame: ["desk:-62,-186", "desk:62,66"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "c10", params: PARTS.R1, locked: true, label: "1 kΩ resistor" },
      { id: "R2", kind: "resistor", at: "desk:18,42", params: PARTS.R2, label: "1 kΩ resistor" },
    ],
    tray: [
      { id: "R3", kind: "resistor", params: PARTS.R3, label: "3.3 kΩ resistor", count: 1 },
      { id: "R4", kind: "resistor", params: PARTS.R4, label: "1 MΩ resistor", count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:4,-108", rot: 0, mode: "ohm", range: "20k", probes: { red: "e10", black: "e14" } }],
  },
  mascot: {
    start: "Two resistors, side by side. More squeeze, or less?",
    hint: "Side by side: both legs share strips with R1's legs.",
    fried: "Oof. That one's for the Hall.",
    success: "Side by side, less squeeze.",
  },
  tasks: [
    {
      id: "parallel-ohms",
      prompt: "Put R2 beside R1, in the same two strips.",
      goal: (lab) => onOhms(lab) && acrossPair(lab, "R1", "R2") && siIn(lab, 470, 530),
      hints: ["Drag R2 onto the board: one leg in strip 10, one in strip 14.", "Any free row will do."],
      highlight: ["R2", "hole:d10", "hole:d14"],
      nudges: [{ when: (lab) => lab.chain(["R1", "R2"]) !== null, say: "That's end to end. Side by side, please." }],
      success: "About 500 Ω.",
    },
    {
      id: "predict-pair",
      prompt: "Predict 1 kΩ beside 3.3 kΩ.",
      goal: (lab) => near(lab.note("prediction"), 767, 0.05),
      note: { id: "prediction", label: "1 kΩ beside 3.3 kΩ", unit: "Ω" },
      hints: ["Less than 1 kΩ, for sure.", "Multiply them, then divide by their sum."],
      success: "Prediction noted.",
    },
    {
      id: "predict-mixed",
      prompt: "Swap R2 for the 3.3 kΩ, side by side with R1. Measure.",
      // The prediction was checked on the beat before (a resumed lesson no longer has it).
      goal: (lab) => onOhms(lab) && acrossPair(lab, "R1", "R3") && siIn(lab, 730, 800),
      hints: ["Drop the 3.3 kΩ resistor right onto R2.", "It takes R2's two holes."],
      highlight: ["R2"],
      nudges: [{ when: (lab) => lab.parallel("R1", "R2") && lab.parallel("R1", "R3"), say: "Three paths now. Take R2 out." }],
      success: "About 767 Ω.",
    },
    {
      id: "add-a-branch",
      prompt: "Power on. Add R2 beside R1 again and watch the flow.",
      setup: POWER_ON,
      goal: (lab) => lab.parallel("R1", "R2") && counting(lab) && readsIn(lab, 17, 19.5),
      hints: ["Drag R2 back beside R1: strips 10 and 14."],
      highlight: ["R2", "hole:d10", "hole:d14"],
      success: "About 18.4 mA.",
    },
    {
      id: "fix-sams-pair",
      prompt: "Sam's side-by-side pair reads 2 kΩ. Fix it.",
      setup: SAMS_PAIR,
      // Broken first (the setup), then truly side by side, measured across.
      goal: (lab) => {
        if (lab.chain(["R1", "R2"]) !== null) lab.memory["series"] = true;
        return lab.memory["series"] === true && onOhms(lab) && acrossPair(lab, "R1", "R2") && siIn(lab, 470, 530);
      },
      hints: ["Sam's pair is end to end. Both of R2's legs must share R1's strips.", "Then the black probe goes in strip 14."],
      highlight: ["R2", "probe:black"],
      nudges: [{ when: (lab) => lab.parallel("R1", "R2") && onOhms(lab) && lab.meter?.value === Infinity, say: "OL? Move the black probe to strip 14." }],
      success: "Fixed.",
    },
    {
      id: "smallest-wins",
      prompt: "Put the 1 MΩ resistor beside R1 too.",
      goal: (lab) => lab.parallel("R1", "R4") && counting(lab) && readsIn(lab, 1, 19.9),
      hints: ["Strips 10 and 14 again, any free row."],
      success: "The flow barely moved.",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "R2", at: "d10" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "parallel-ohms" },
    { do: "note", id: "prediction", value: "767" },
    { do: "check", task: "predict-pair" },
    { do: "move", part: "R2", at: "desk:18,42" },
    { do: "place", part: "R3", kind: "resistor", params: PARTS.R3, at: "d10" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "predict-mixed" },
    ...POWER_ON,
    { do: "move", part: "R2", at: "d10" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "add-a-branch" },
    ...SAMS_PAIR,
    { do: "wait", seconds: 0.3 },
    { do: "move", part: "R2", at: "d10" },
    { do: "probe", black: "e14" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-sams-pair" },
    // The secret, on the powered bench: power back on, the pair side by side, then the 1 MΩ beside them.
    { do: "probe", black: "e18" },
    { do: "probe", red: "e14" },
    { do: "plug", probe: "red", socket: "ma" },
    { do: "dial", mode: "dca-ma", range: "20mA" },
    { do: "wire", id: "W1", from: "rail+:9", to: "a10", color: "red" },
    { do: "wire", id: "W2", from: "a18", to: "rail-:17", color: "black" },
    { do: "place", part: "R4", kind: "resistor", params: PARTS.R4, at: "b10" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "smallest-wins" },
  ],
});
