// Blueprint: docs/curriculum/unit-4.md, CH18; a bench lesson (docs/LESSONS.md): content/units/chips/logic/gatekeepers.
// One idea: a gate answers by a fixed rule, a truth table lists its answer for every input, and the chip (not the
// wiring) decides the rule.
// Half board, the logic rail (a 7805 making 5 V on the far rails). U1, a 74HC08, sits at e12 with gates 2 to 4 tied
// to minus. The two keys are slide switches in the far half, each throwing its middle pin between minus (off, 0) and
// 5 V (on, 1): key A (S1, columns 6 to 8) feeds pin 1, key B (S2, columns 22 to 24) feeds pin 2, so no input ever
// floats and both keys stay where they are put. Pin 3 lights lamp D1 through R3. The OR (74HC32) and XOR (74HC86)
// chips wait on the desk in front; all three share one pinout, so they swap in the same holes. The fix-it bench moves
// R3's leg onto pin 6, gate 2's output, whose inputs are tied low.
import { defineLab, type BenchPart, type LabView, type SolutionStep } from "@ohmland/lab";
import { gateChip, logicRail, seen, wire } from "./lib/chip-bench";

const rail = logicRail(2, 29);
const u1 = gateChip({ id: "U1", model: "74HC08", col: 12, board: "half", spare: [2, 3, 4], taken: ["top-:3", "top+:4", "top-:5", "top+:8", "top-:22", "top+:25"], label: "AND chip U1 (74HC08)" });

/** The table is full and lit in exactly these rows ("b,a": A on, B off). */
function rows(lab: LabView, lit: string[]): boolean {
  const t = lab.panel("tt");
  const keys = Object.keys(t.cells);
  return keys.length >= 4 && keys.every((k) => t.cells[k] === lit.includes(k));
}
/** Chip `id` sits in U1's holes, wired as U1 was. */
const inPlace = (lab: LabView, id: string) =>
  lab.connected(`${id}.1`, "S1.com") && lab.connected(`${id}.2`, "S2.com") && lab.connected(`${id}.14`, "VR1.out") && lab.connected(`${id}.7`, "VR1.gnd");
const isOn = (lab: LabView, id: string) => lab.prop(id)?.["to"] === "b";

/** The fix-it bench: the OR chip in, both keys on, but R3's leg on pin 6 (gate 2's answer, its inputs tied low). */
const WRONG_PIN: SolutionStep[] = [
  { do: "move", part: "R3", at: "d17-d20" },
  { do: "flip", part: "S1", to: "b" },
  { do: "flip", part: "S2", to: "b" },
];

export default defineLab({
  id: "gatekeepers",
  title: "Both keys or either",
  bench: {
    board: "half",
    frame: ["hole:j1", "hole:a30", "top+:1", "rail-:30", "desk:0,-44", "desk:0,50"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      ...u1.parts.map((p) => ({ ...p, locked: false }) as BenchPart),
      { id: "S1", kind: "slide-switch", at: "h6", params: { to: "a" }, locked: true, label: "Key A (S1)" },
      { id: "S2", kind: "slide-switch", at: "h22", params: { to: "a" }, locked: true, label: "Key B (S2)" },
      { id: "LA", kind: "tag", at: "desk:-21,-38", params: { text: "A" }, locked: true, label: "Tag A" },
      { id: "LB", kind: "tag", at: "desk:19,-38", params: { text: "B" }, locked: true, label: "Tag B" },
      { id: "R3", kind: "resistor", at: "d14-d20", params: { ohms: 1000 }, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", at: "c20", params: { color: "red" }, locked: true, label: "Gate lamp D1" },
      { id: "U2", kind: "chip", at: "desk:-12,44", params: { model: "74HC32" }, label: "OR chip U2 (74HC32)" },
      { id: "U3", kind: "chip", at: "desk:14,44", params: { model: "74HC86" }, label: "Chip U3 (74HC86)" },
    ],
    wires: [
      ...rail.wires,
      // Key A: down to minus, up to 5 V, middle to pin 1. Key B the same, to pin 2.
      wire("W1", "j6", "top-:5", "black"),
      wire("W2", "j8", "top+:8", "red"),
      wire("W3", "g7", "c12", "yellow"),
      wire("W4", "j22", "top-:22", "black"),
      wire("W5", "j24", "top+:25", "red"),
      wire("W6", "g23", "b13", "blue"),
      wire("W7", "a21", "rail-:21", "black"),
      ...u1.wires,
    ],
    tray: [],
    instruments: [],
  },
  panels: [
    {
      kind: "truth-table",
      id: "tt",
      show: ["and-table", "or-table", "fix-it", "xor-chip"],
      inputs: [
        { part: "S1", label: "A", a: "0", b: "1" },
        { part: "S2", label: "B", a: "0", b: "1" },
      ],
      output: { part: "D1", label: "Lamp" },
    },
  ],
  mascot: {
    hint: "Notch to the left, like every chip.",
    fried: "Backwards chip, hot chip. Notch to the left.",
  },
  fried: { chip: "Gate chip, seated the wrong way round" },
  tasks: [
    {
      id: "key-a",
      prompt: "Turn key **A** on.",
      goal: (lab) => isOn(lab, "S1") && !isOn(lab, "S2") && lab.heldFor(0.5, !lab.isLit("D1")),
      hints: ["Key A is the switch by the A tag. Slide it toward its red wire."],
      highlight: ["S1"],
      success: "Still shut.",
    },
    {
      id: "and-both",
      prompt: "Now turn key **B** on too.",
      goal: (lab) => isOn(lab, "S1") && isOn(lab, "S2") && lab.isLit("D1"),
      hints: ["Both keys slid toward their red wires."],
      highlight: ["S2"],
      success: "Both keys: open.",
    },
    {
      id: "and-table",
      prompt: "Try all four ways of setting the keys.",
      goal: (lab) => inPlace(lab, "U1") && rows(lab, ["b,b"]),
      hints: ["Off-off, on-off, off-on, on-on. One flip at a time."],
      highlight: ["S1", "S2"],
      success: "Lit for one row only: both on.",
    },
    {
      id: "or-chip",
      prompt: "Lift U1 out and seat the OR chip (74HC32) in the same holes, notch left.",
      goal: (lab) => !inPlace(lab, "U1") && inPlace(lab, "U2") && lab.chipSeat("U2")?.pin1 === "left",
      hints: ["Drag U1 off the board onto the desk.", "Drop the 74HC32 where U1 was, notch to the left."],
      highlight: ["U1", "U2"],
      nudges: [{ when: (lab) => lab.chipSeat("U2")?.pin1 === "right", say: "Notch to the left, please." }],
      success: "Same holes, new chip.",
    },
    {
      id: "or-table",
      prompt: "Fill the table again.",
      goal: (lab) => inPlace(lab, "U2") && rows(lab, ["a,b", "b,a", "b,b"]),
      hints: ["All four ways again, one flip at a time."],
      highlight: ["S1", "S2"],
      success: "Lit for three rows: either key.",
    },
    {
      id: "fix-it",
      prompt: "Make the lamp answer the keys again.",
      setup: WRONG_PIN,
      goal: (lab) => seen(lab, "wrong", lab.heldFor(0.5, lab.joins("R3", "U2.6", "D1.anode"), "wrong")) && lab.joins("R3", "U2.3", "D1.anode") && lab.isLit("D1"),
      hints: ["Inputs 1 and 2 answer on pin 3. Where does the resistor start?", "Move R3's leg to pin 3's strip."],
      highlight: ["R3"],
      success: "Pin 3 answers again.",
    },
    {
      id: "xor-chip",
      prompt: "Bonus: try the chip marked 86 and fill the table.",
      goal: (lab) => inPlace(lab, "U3") && rows(lab, ["a,b", "b,a"]),
      hints: ["Swap the 74HC86 in, notch left, then all four ways."],
      highlight: ["U3"],
      success: "One key, not both.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "key-a" },
    { do: "flip", part: "S2", to: "b" },
    { do: "check", task: "and-both" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "and-table" },
    { do: "move", part: "U1", at: "desk:-38,44" },
    { do: "move", part: "U2", at: "e12" },
    { do: "check", task: "or-chip" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "or-table" },
    // The secret: XOR in the same holes.
    { do: "move", part: "U2", at: "desk:-12,44" },
    { do: "move", part: "U3", at: "e12" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S1", to: "a" },
    { do: "wait", seconds: 0.4 },
    // Back to the OR chip, keys down, before the check: the fix-it bench starts from here.
    { do: "move", part: "U3", at: "desk:14,44" },
    { do: "move", part: "U2", at: "e12" },
    { do: "flip", part: "S2", to: "a" },
    { do: "check", task: "xor-chip" },
    ...WRONG_PIN,
    { do: "wait", seconds: 0.6 },
    { do: "move", part: "R3", at: "d14-d20" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-it" },
  ],
});
