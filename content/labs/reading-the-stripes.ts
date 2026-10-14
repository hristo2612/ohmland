// Blueprint: docs/curriculum/unit-1.md, L6, split for a bench lesson (docs/curriculum/conversion-guide.md, B3): this is
// the kept half (the code), content/units/basics/resistance/reading-the-stripes/lesson.yaml; measuring and the
// tolerance moved to the-liar. One idea: two digit stripes, then the number of zeros. Five loose resistors whose
// bands show their values, a colour chart and five value labels to drag next to them; no meter, stripes only.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** Each value label and the resistor it belongs to. */
const LABELS: [label: string, resistor: string][] = [
  ["L1", "R1"],
  ["L2", "R2"],
  ["L3", "R3"],
  ["L4", "R4"],
  ["L5", "R5"],
];
const RESISTORS = LABELS.map(([, r]) => r);

/** A label sits by a resistor: within 30 mm of it, and nearer to it than to any other resistor. */
const labelled = (lab: LabView, label: string, resistor: string): boolean => {
  const d = lab.distance(label, resistor);
  return d < 30 && RESISTORS.every((r) => r === resistor || lab.distance(label, r) > d);
};
const sorted = (lab: LabView) => LABELS.every(([l, r]) => labelled(lab, l, r));

// Where the resistors lie, tipped out of the bag (desk mm).
const AT: Record<string, [number, number]> = { R1: [-104, -6], R2: [-64, 10], R3: [-16, -8], R4: [32, 8], R5: [80, -6] };
/** Each label's place just in front of its resistor. */
const by = (r: string) => `desk:${AT[r]![0]},${AT[r]![1] + 18}`;

/** The fix-it bench: the 470 Ω and 150 Ω labels swapped. */
const SWAPPED: SolutionStep[] = [
  { do: "move", part: "L3", at: by("R2") },
  { do: "move", part: "L2", at: by("R3") },
];
/** The secret: one more resistor comes out of the bag, with gold in third place (4.7 Ω). */
const TINY: SolutionStep[] = [{ do: "place", part: "R6", kind: "resistor", at: "desk:40,-74", params: { ohms: 4.7, watts: 0.25 } }];

export default defineLab({
  id: "reading-the-stripes",
  title: "Reading the stripes",
  bench: {
    board: "none",
    frame: ["desk:-124,-104", "desk:104,64"],
    parts: [
      { id: "R1", kind: "resistor", at: `desk:${AT.R1}`, rot: 8, params: { ohms: 15, watts: 0.25 }, label: "Resistor" },
      { id: "R2", kind: "resistor", at: `desk:${AT.R2}`, rot: -10, params: { ohms: 150, watts: 0.25 }, label: "Resistor" },
      { id: "R3", kind: "resistor", at: `desk:${AT.R3}`, rot: 4, params: { ohms: 470, watts: 0.25 }, label: "Resistor" },
      { id: "R4", kind: "resistor", at: `desk:${AT.R4}`, rot: -6, params: { ohms: 1500, watts: 0.25 }, label: "Resistor" },
      { id: "R5", kind: "resistor", at: `desk:${AT.R5}`, rot: 12, params: { ohms: 2200, watts: 0.25 }, label: "Resistor" },
      { id: "CH1", kind: "chart", at: "desk:-80,-86", locked: true, label: "Colour chart" },
      // The value labels, shuffled along the front.
      { id: "L3", kind: "tag", at: "desk:-100,46", params: { text: "470 Ω" } },
      { id: "L5", kind: "tag", at: "desk:-62,52", params: { text: "2.2 kΩ" } },
      { id: "L1", kind: "tag", at: "desk:-24,46", params: { text: "15 Ω" } },
      { id: "L4", kind: "tag", at: "desk:14,52", params: { text: "1.5 kΩ" } },
      { id: "L2", kind: "tag", at: "desk:52,46", params: { text: "150 Ω" } },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Gold stripe on the right. Then read from the left.",
  },
  tasks: [
    {
      id: "decode-yellow",
      prompt: "Decode **yellow, violet, brown** with the chart. Type the ohms.",
      goal: (lab) => {
        const v = lab.note("value");
        return v !== null && Math.abs(v - 470) < 0.5;
      },
      note: { id: "value", label: "Yellow, violet, brown", unit: "Ω" },
      hints: ["First two stripes are digits: yellow 4, violet 7.", "The third stripe counts zeros. Brown is 1."],
      highlight: ["R3", "CH1"],
      success: "470 Ω.",
    },
    {
      id: "sort-the-bag",
      prompt: "Read the other four. Label each one.",
      goal: sorted,
      hints: ["Brown, green, red: 1, 5 and two zeros.", "Drop each label right next to its resistor."],
      highlight: ["L1", "L2", "L3", "L4", "L5"],
      success: "Five for five.",
    },
    {
      id: "fix-labels",
      prompt: "Two labels disagree with their stripes. Fix them.",
      setup: SWAPPED,
      // Wrong first (the setup), then right again: a bench that was never wrong does not count.
      goal: (lab) => {
        if (!sorted(lab)) lab.memory["wrong"] = true;
        return lab.memory["wrong"] === true && sorted(lab);
      },
      hints: ["Read each stripe again. Which label doesn't match?", "Yellow, violet, brown is 470 Ω. Brown, green, brown is 150 Ω."],
      highlight: ["L2", "L3"],
      success: "Fixed.",
    },
    {
      id: "tiny-gold",
      prompt: "Yellow, violet, gold: gold in third place. How many ohms?",
      setup: TINY,
      goal: (lab) => {
        const v = lab.note("gold");
        return v !== null && Math.abs(v - 4.7) < 0.05;
      },
      note: { id: "gold", label: "Yellow, violet, gold", unit: "Ω" },
      hints: ["Gold in third place means divide by ten.", "47 divided by 10."],
      highlight: ["R6", "CH1"],
      success: "4.7 Ω.",
      bonus: true,
    },
  ],
  solution: [
    { do: "note", id: "value", value: "470" },
    { do: "check", task: "decode-yellow" },
    ...LABELS.map(([l, r]) => ({ do: "move" as const, part: l, at: by(r) })),
    { do: "check", task: "sort-the-bag" },
    ...SWAPPED,
    { do: "move", part: "L3", at: by("R3") },
    { do: "move", part: "L2", at: by("R2") },
    { do: "check", task: "fix-labels" },
    // The secret: its bench starts from the sorted bag, with one more resistor out.
    ...TINY,
    { do: "note", id: "gold", value: "4.7" },
    { do: "check", task: "tiny-gold" },
  ],
});
