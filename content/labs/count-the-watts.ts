// Split from watts-and-heat (docs/curriculum/conversion-guide.md, B3 13a). The lab of a bench lesson
// (docs/LESSONS.md): content/units/basics/power-and-heat/count-the-watts. One idea: power is push times flow, in watts.
// A load holder clipped across the battery (0.15 Ω per clip lead), with the meter's probes clipped onto its two
// terminals, so whatever resistor drops in is measured at once. A temperature readout floats over every resistor.
// From the simulator: 1 kΩ takes 9.38 V and 9.4 mA (89 mW); 15 Ω about 8.0 V and 0.53 A (4.2 W, the battery sags);
// 33 Ω about 8.7 V and 0.26 A (2.3 W, about half); 6.8 Ω about 6.2 V and 0.91 A (5.6 W).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { readsIn } from "./lib/meter";

/** The resistor id in the holder, or null. */
const inHolder = (lab: LabView): string | null => lab.holds("H1")[0] ?? null;

/** The meter's live reading across a resistor (DC volts; the probes stay on the holder), or NaN. */
const volts = (lab: LabView, id: string): number => {
  const v = lab.meter?.value;
  return lab.meter?.mode === "dcv" && lab.across(id, "either") && typeof v === "number" && Number.isFinite(v) ? Math.abs(v) : Number.NaN;
};

/** The watts the resistor in the holder is turning into heat. */
const watts = (lab: LabView): number => {
  const id = inHolder(lab);
  return id ? Math.abs(lab.part(id)?.p ?? 0) : 0;
};

const PARTS = {
  R1: { ohms: 1000, watts: 0.25 },
  R5: { ohms: 15, watts: 5 },
  R6: { ohms: 33, watts: 5 },
  R7: { ohms: 6.8, watts: 5 },
} as const;

/** The fix-it bench: the 15 Ω heater in the holder, a 33 Ω and a 6.8 Ω power resistor in front of it. */
const TWO_CHOICES: SolutionStep[] = [
  { do: "place", part: "R6", kind: "resistor", params: PARTS.R6, at: "desk:-55,50" },
  { do: "place", part: "R7", kind: "resistor", params: PARTS.R7, at: "desk:15,50" },
];

export default defineLab({
  id: "count-the-watts",
  title: "Count the watts",
  bench: {
    board: "none",
    frame: ["desk:-140,-85", "desk:135,80"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-100,8", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "H1", kind: "holder", at: "desk:-20,-30", locked: true, label: "Load holder" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "H1.a", color: "red" },
      { id: "TL2", from: "H1.b", to: "B1.neg", color: "black" },
    ],
    tray: [
      { id: "R1", kind: "resistor", params: PARTS.R1, count: 1, label: "1 kΩ, 1/4 W" },
      { id: "R5", kind: "resistor", params: PARTS.R5, count: 1, label: "15 Ω, 5 W" },
    ],
    instruments: [
      { kind: "meter", at: "desk:85,-25", mode: "dcv", range: "20V", probes: { red: "H1.a", black: "H1.b" } },
      // Each resistor's temperature, with a touch-feel word: cool, warm, hot, ouch.
      { kind: "inspect", show: "heat", parts: ["resistor"] },
    ],
  },
  mascot: {
    hint: "Power is push times flow. Got both numbers?",
    fried: "Smells like learning. That one's for the Hall.",
  },
  tasks: [
    {
      id: "hold-1k",
      prompt: "Drop the 1 kΩ resistor into the holder.",
      goal: (lab) => inHolder(lab) === "R1" && lab.across("R1", "either") && readsIn(lab, 9.2, 9.5),
      hints: ["Drag the 1 kΩ resistor from the tray onto the holder's clips."],
      highlight: ["H1"],
      success: "9.4 V across it.",
    },
    {
      id: "cool-one",
      prompt: "P = V × I. Type its power in mW.",
      goal: (lab) => {
        const mW = lab.note("mW");
        return inHolder(lab) === "R1" && mW !== null && mW >= 80 && mW <= 95;
      },
      note: { id: "mW", label: "Power in the 1 kΩ", unit: "mW" },
      hints: ["The flow is 9.4 mA. Multiply it by the 9.4 V.", "9.4 × 9.4 is about 88."],
      success: "About 88 mW.",
    },
    {
      id: "hold-hot",
      prompt: "Swap in the 15 Ω, 5 W resistor.",
      goal: (lab) => inHolder(lab) === "R5" && lab.across("R5", "either") && readsIn(lab, 7.6, 8.4),
      hints: ["Drop the big 15 Ω resistor onto the holder. The 1 kΩ hops out."],
      highlight: ["H1"],
      success: "About 8 V across it.",
    },
    {
      id: "power-it",
      prompt: "8.0 V and 0.53 A. Type its power in W.",
      goal: (lab) => {
        const v = volts(lab, "R5");
        const w = lab.note("W");
        return inHolder(lab) === "R5" && Number.isFinite(v) && w !== null && Math.abs(w - (v * v) / 15) <= ((v * v) / 15) * 0.1;
      },
      note: { id: "W", label: "Power in the 15 Ω", unit: "W" },
      hints: ["Push times flow: 8.0 V × 0.53 A.", "About 4.2. Answer in W."],
      success: "About 4.2 W.",
    },
    {
      id: "halve-it",
      prompt: "Halve the heater's watts.",
      setup: TWO_CHOICES,
      // The 15 Ω heater first (the setup), then about half its watts: a bench that never ran hot does not count.
      goal: (lab) => {
        if (inHolder(lab) === "R5") lab.memory["hot"] = true;
        const w = watts(lab);
        return lab.memory["hot"] === true && inHolder(lab) === "R6" && w >= 1.8 && w <= 2.8;
      },
      hints: ["More squeeze means less flow, and less flow means fewer watts.", "Swap in the 33 Ω: about twice the squeeze of 15 Ω."],
      highlight: ["R6", "H1"],
      nudges: [{ when: (lab) => inHolder(lab) === "R7", say: "Hotter! Less squeeze lets more flow through." }],
      success: "About half the watts.",
    },
  ],
  solution: [
    { do: "place", part: "R1", kind: "resistor", params: PARTS.R1, at: "in:H1" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "hold-1k" },
    { do: "note", id: "mW", value: "88" },
    { do: "check", task: "cool-one" },
    { do: "place", part: "R5", kind: "resistor", params: PARTS.R5, at: "in:H1" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "hold-hot" },
    { do: "note", id: "W", value: "4.2" },
    { do: "check", task: "power-it" },
    ...TWO_CHOICES,
    { do: "wait", seconds: 0.5 },
    { do: "move", part: "R6", at: "in:H1" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "halve-it" },
  ],
});
