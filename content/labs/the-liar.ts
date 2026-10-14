// Blueprint: docs/curriculum/unit-1.md, L6 (the meter half), split into its own bench lesson
// (docs/curriculum/conversion-guide.md, B3, 6b): content/units/basics/resistance/the-liar/lesson.yaml.
// One idea: a real value sits close to its label, within its tolerance. Five labelled resistors, each with its own
// real value (the 1.5 kΩ a close 1.56 kΩ, the 2.2 kΩ out of tolerance at 2.46 kΩ, its body very slightly darkened), a
// reject bin and the meter on Ω, 2k range, its probe tips loose in front.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { rangeIs, readsIn } from "./lib/meter";

// Where the resistors lie (desk mm), left of the meter's panel; each label sits just in front.
const AT: Record<string, [number, number]> = { R1: [-112, -6], R2: [-76, 10], R3: [-40, -8], R4: [-4, 8], R5: [32, -6] };
const by = (r: string) => `desk:${AT[r]![0]},${AT[r]![1] + 18}`;
const binned = (lab: LabView) => lab.holds("BIN1");
const onlyTheLiar = (lab: LabView) => {
  const held = binned(lab);
  return held.length === 1 && held[0] === "R5";
};

/** The fix-it bench: the liar back on the desk, and a good resistor (150 Ω) in the bin instead. */
const GOOD_ONE_BINNED: SolutionStep[] = [
  { do: "move", part: "R5", at: `desk:${AT.R5![0]},${AT.R5![1]}` },
  // Out of the bin it still stands the bin's way round: lay it flat again.
  { do: "rotate", part: "R5" },
  { do: "move", part: "R2", at: "in:BIN1" },
];

export default defineLab({
  id: "the-liar",
  title: "The liar",
  bench: {
    board: "none",
    // The resistors and the bin on the left; the meter on the right, where its panel docks over it.
    frame: ["desk:-132,-100", "desk:150,62"],
    parts: [
      { id: "R1", kind: "resistor", at: `desk:${AT.R1}`, rot: 8, params: { ohms: 15, watts: 0.25, actualOhms: 15.2 }, label: "15 Ω resistor" },
      { id: "R2", kind: "resistor", at: `desk:${AT.R2}`, rot: -10, params: { ohms: 150, watts: 0.25, actualOhms: 148 }, label: "150 Ω resistor" },
      { id: "R3", kind: "resistor", at: `desk:${AT.R3}`, rot: 4, params: { ohms: 470, watts: 0.25, actualOhms: 466 }, label: "470 Ω resistor" },
      // 4% high: close to its limit, still inside 5%.
      { id: "R4", kind: "resistor", at: `desk:${AT.R4}`, rot: -6, params: { ohms: 1500, watts: 0.25, actualOhms: 1560 }, label: "1.5 kΩ resistor" },
      // Out of tolerance (+11.8%); its body is very slightly darkened.
      { id: "R5", kind: "resistor", at: `desk:${AT.R5}`, rot: 12, params: { ohms: 2200, watts: 0.25, actualOhms: 2460 }, label: "2.2 kΩ resistor" },
      { id: "BIN1", kind: "bin", at: "desk:-40,-72", locked: true, label: "Reject bin" },
      { id: "L1", kind: "tag", at: by("R1"), params: { text: "15 Ω" }, locked: true },
      { id: "L2", kind: "tag", at: by("R2"), params: { text: "150 Ω" }, locked: true },
      { id: "L3", kind: "tag", at: by("R3"), params: { text: "470 Ω" }, locked: true },
      { id: "L4", kind: "tag", at: by("R4"), params: { text: "1.5 kΩ" }, locked: true },
      { id: "L5", kind: "tag", at: by("R5"), params: { text: "2.2 kΩ" }, locked: true },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:140,10", mode: "ohm", range: "2k", tips: { red: "desk:-54,50", black: "desk:-26,52" } }],
  },
  mascot: {
    hint: "Within 5% of the label is fine. Further is a liar.",
  },
  tasks: [
    {
      id: "measure-it",
      prompt: "Measure the 470 Ω on the 2k range. Exactly 470?",
      goal: (lab) => lab.meter?.mode === "ohm" && rangeIs(lab, "2k") && lab.across("R3", "either") && readsIn(lab, 0.447, 0.493),
      hints: ["A probe tip on each wire end of the 470 Ω.", "Yellow, violet, brown: that's the 470 Ω."],
      highlight: ["pin:R3.a", "pin:R3.b"],
      success: "466 Ω.",
    },
    {
      id: "find-the-liar",
      prompt: "One is outside its 5%. Measure them all. Bin the liar.",
      goal: onlyTheLiar,
      hints: ["5% of 2.2 kΩ is 110 Ω: from 2.09 to 2.31 kΩ.", "OL on 2k? Over 2 kΩ. Step up to 20k."],
      highlight: ["BIN1"],
      nudges: [{ when: (lab) => binned(lab).some((id) => id !== "R5"), say: "That one's within 5%. Take it back out." }],
      success: "Caught it.",
    },
    {
      id: "rescue",
      prompt: "A good resistor is in the bin, and the liar is out. Fix it.",
      setup: GOOD_ONE_BINNED,
      // Wrong first (the setup), then only the liar in the bin: a bench that was never wrong does not count.
      goal: (lab) => {
        if (binned(lab).includes("R2")) lab.memory["wrong"] = true;
        return lab.memory["wrong"] === true && onlyTheLiar(lab);
      },
      hints: ["Measure the one in the bin. Within 5%?", "Good ones go on the desk. The liar goes in the bin."],
      highlight: ["BIN1"],
      success: "Rescued.",
    },
    {
      id: "probe-tips",
      prompt: "200 range. Touch the probe tips together.",
      goal: (lab) => lab.meter?.mode === "ohm" && rangeIs(lab, "200") && lab.connected("red", "black") && readsIn(lab, 0.1, 0.4),
      hints: ["Pick the 200 range, then drag one tip onto the other."],
      success: "About 0.2 Ω: the meter's own leads.",
      notice: "So the 15 Ω resistor reads about 0.2 Ω high.",
      bonus: true,
    },
  ],
  solution: [
    { do: "probe", red: "R3.a", black: "R3.b" },
    { do: "check", task: "measure-it" },
    { do: "probe", red: "R5.a", black: "R5.b", range: "20k" },
    { do: "move", part: "R5", at: "in:BIN1" },
    { do: "check", task: "find-the-liar" },
    ...GOOD_ONE_BINNED,
    { do: "move", part: "R2", at: `desk:${AT.R2![0]},${AT.R2![1]}` },
    { do: "move", part: "R5", at: "in:BIN1" },
    { do: "check", task: "rescue" },
    // The secret: the leads themselves.
    { do: "dial", mode: "ohm", range: "200" },
    { do: "probe", red: "black" },
    { do: "check", task: "probe-tips" },
  ],
});
