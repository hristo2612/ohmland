// Blueprint: docs/curriculum/unit-1.md, L6. Five loose resistors whose bands show their nominal values, each with its
// own real value (one out of tolerance), a colour chart, five value labels to drag next to them and a reject bin.
import { defineLab, type LabView } from "@ohmland/lab";
import { rangeIs, readsIn } from "./lib/meter";

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

// Where the resistors lie, tipped out of the bag (desk mm).
const AT: Record<string, [number, number]> = { R1: [-150, -12], R2: [-92, 8], R3: [-36, -14], R4: [20, 6], R5: [76, -12] };

export default defineLab({
  id: "reading-the-stripes",
  title: "Reading the stripes",
  bench: {
    board: "none",
    parts: [
      { id: "R1", kind: "resistor", at: `desk:${AT.R1}`, rot: 8, params: { ohms: 15, watts: 0.25, actualOhms: 15.2 }, label: "15 Ω resistor" },
      { id: "R2", kind: "resistor", at: `desk:${AT.R2}`, rot: -10, params: { ohms: 150, watts: 0.25, actualOhms: 148 }, label: "150 Ω resistor" },
      { id: "R3", kind: "resistor", at: `desk:${AT.R3}`, rot: 4, params: { ohms: 470, watts: 0.25, actualOhms: 466 }, label: "470 Ω resistor" },
      { id: "R4", kind: "resistor", at: `desk:${AT.R4}`, rot: -6, params: { ohms: 1500, watts: 0.25, actualOhms: 1520 }, label: "1.5 kΩ resistor" },
      // Out of tolerance (+11.8%); its body is very slightly darkened.
      { id: "R5", kind: "resistor", at: `desk:${AT.R5}`, rot: 12, params: { ohms: 2200, watts: 0.25, actualOhms: 2460 }, label: "2.2 kΩ resistor" },
      { id: "CH1", kind: "chart", at: "desk:-60,-92", locked: true, label: "Colour chart" },
      { id: "BIN1", kind: "bin", at: "desk:86,-86", locked: true, label: "Reject bin" },
      // The value labels, shuffled along the front.
      { id: "L3", kind: "tag", at: "desk:-148,58", params: { text: "470 Ω" } },
      { id: "L5", kind: "tag", at: "desk:-110,64", params: { text: "2.2 kΩ" } },
      { id: "L1", kind: "tag", at: "desk:-72,58", params: { text: "15 Ω" } },
      { id: "L4", kind: "tag", at: "desk:-34,64", params: { text: "1.5 kΩ" } },
      { id: "L2", kind: "tag", at: "desk:4,58", params: { text: "150 Ω" } },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:176,22", mode: "ohm", range: "2k" }],
  },
  mascot: {
    start: "Stripes, not numbers. Let's crack the code.",
    hint: "Gold stripe on the right. Then read from the left.",
    success: "You caught the liar. Nothing gets past you now.",
  },
  tasks: [
    {
      id: "decode-yellow",
      prompt: "Find the resistor with **yellow, violet, brown** stripes. Use the colour chart to decode it, and type its value in ohms.",
      goal: (lab) => {
        const v = lab.note("value");
        return v !== null && Math.abs(v - 470) < 0.5;
      },
      note: { id: "value", label: "Yellow, violet, brown", unit: "Ω" },
      hints: ["The first two stripes are digits: yellow is 4, violet is 7.", "The third stripe is how many zeros to add. Brown is 1."],
      highlight: ["R3", "CH1"],
      success: "4, 7 and one zero: 470 Ω.",
    },
    {
      id: "measure-it",
      prompt: "Now measure it on the 2k range. Is it exactly 470 Ω?",
      goal: (lab) => lab.meter?.mode === "ohm" && rangeIs(lab, "2k") && lab.across("R3", "either") && readsIn(lab, 0.447, 0.493),
      hints: ["A probe on each wire end of the yellow, violet, brown resistor."],
      highlight: ["pin:R3.a", "pin:R3.b"],
      success: "Close, not exact. The gold stripe promises within 5%, and this one is well inside that.",
    },
    {
      id: "probe-tips",
      prompt: "Switch to the 200 range and touch the two probe tips together. What does a 'zero' read?",
      goal: (lab) => lab.meter?.mode === "ohm" && rangeIs(lab, "200") && lab.connected("red", "black") && readsIn(lab, 0.1, 0.4),
      hints: ["Drag one probe's tip onto the other's."],
      success: "About 0.2 Ω. That's the meter's own leads. It only matters when you measure tiny resistances.",
      notice: "The 15 Ω resistor will read about 0.2 Ω high for this reason.",
    },
    {
      id: "sort-the-bag",
      prompt: "Read and measure the other four, then drag the right value label onto each resistor.",
      goal: (lab) => LABELS.every(([l, r]) => labelled(lab, l, r)),
      hints: ["Read the stripes first, then confirm with the meter.", "Brown, green, red is 1, 5 and two zeros.", "Drop each label right next to its resistor."],
      highlight: ["L1", "L2", "L3", "L4", "L5"],
      success: "Five for five. Stripes and meter agree.",
    },
    {
      id: "find-the-liar",
      prompt: "One resistor measures outside its 5% tolerance. Find it and drop it in the reject bin.",
      goal: (lab) => {
        const held = lab.holds("BIN1");
        return held.length === 1 && held[0] === "R5";
      },
      hints: ["Work out 5% above and below each value.", "2.2 kΩ plus 5% is 2.31 kΩ."],
      highlight: ["BIN1"],
      success: "Caught it. 2.46 kΩ is more than 5% above 2.2 kΩ. That one was probably overheated at some point.",
    },
  ],
  solution: [
    { do: "note", id: "value", value: "470" },
    { do: "check", task: "decode-yellow" },
    { do: "probe", red: "R3.a", black: "R3.b" },
    { do: "check", task: "measure-it" },
    { do: "dial", mode: "ohm", range: "200" },
    { do: "probe", red: "black" },
    { do: "check", task: "probe-tips" },
    { do: "probe", red: "R5.a", black: "R5.b", range: "20k" },
    ...LABELS.map(([l, r]) => ({ do: "move" as const, part: l, at: `desk:${AT[r]![0]},${AT[r]![1] + 18}` })),
    { do: "check", task: "sort-the-bag" },
    { do: "move", part: "R5", at: "in:BIN1" },
    { do: "check", task: "find-the-liar" },
  ],
});
