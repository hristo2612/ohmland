// Blueprint: docs/curriculum/unit-2.md, Lesson 3; a bench lesson (docs/LESSONS.md):
// content/units/switching/switches/stairway-light. One idea: with two travellers, either switch toggles the lamp.
// Two SPDT toggles on blocks: battery plus, R1 and the LED run to switch A's pole; switch B's pole runs back to battery
// minus. The learner joins the four throws with two clip leads (the travellers), and a truth table logs every
// combination of the two switches with the lamp, starting again after each rewire. Switches in series (one traveller)
// moved to both-switches.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The truth table is full and lit in exactly these rows ("a,a" = both thrown to their first throw). */
function litRows(lab: LabView, rows: string[]): boolean {
  const t = lab.panel("truth");
  const keys = Object.keys(t.cells);
  if (keys.length < 4) return false;
  return keys.every((k) => t.cells[k] === rows.includes(k));
}
const straight = (lab: LabView) => lab.connected("SA.a", "SB.a") && lab.connected("SA.b", "SB.b");
const crossed = (lab: LabView) => lab.connected("SA.a", "SB.b") && lab.connected("SA.b", "SB.a");

/** The fix-it bench: one traveller unclipped at both ends, lying on the desk. */
const ONE_TRAVELLER: SolutionStep[] = [
  { do: "clip", lead: "TL6", end: "a", to: null },
  { do: "clip", lead: "TL6", end: "b", to: null },
];

export default defineLab({
  id: "stairway-light",
  title: "Either switch",
  bench: {
    board: "none",
    frame: ["desk:-140,-70", "desk:170,66"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-118,6", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-52,-44", params: { ohms: 470 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:14,-50", rot: 180, params: { color: "red" }, locked: true, label: "Red LED (the lamp)" },
      { id: "SA", kind: "toggle-switch", at: "desk:-36,32", params: { base: true, to: "a", tag: "A" }, locked: true, label: "Downstairs switch A" },
      { id: "SB", kind: "toggle-switch", at: "desk:58,32", params: { base: true, to: "a", tag: "B" }, locked: true, label: "Upstairs switch B" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red", locked: true },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "yellow", locked: true },
      { id: "TL3", from: "D1.cathode", to: "SA.com", color: "green", locked: true },
      { id: "TL4", from: "SB.com", to: "B1.neg", color: "black", locked: true },
    ],
    tray: [
      { kind: "lead", params: { color: "blue" }, count: 1 },
      { kind: "lead", params: { color: "white" }, count: 1 },
    ],
    instruments: [],
  },
  panels: [
    {
      kind: "truth-table",
      id: "truth",
      show: ["two-travelers", "cross-the-travelers", "fix-traveler"],
      inputs: [
        { part: "SA", label: "Switch A", a: "A1", b: "A2" },
        { part: "SB", label: "Switch B", a: "B1", b: "B2" },
      ],
      output: { part: "D1" },
    },
  ],
  mascot: {
    hint: "Flip one switch at a time and watch which row fills in.",
    fried: "That LED lost its resistor somewhere. Check the clips.",
  },
  fried: { led: "Red LED, bypassed resistor in the stairway light" },
  tasks: [
    {
      id: "wire-travelers",
      prompt: "Clip **A1** to **B1** and **A2** to **B2**.",
      goal: straight,
      hints: ["Each pair of throws gets its own lead: the travellers.", "Left screw to left screw, right screw to right screw."],
      highlight: ["pin:SA.a", "pin:SB.a", "pin:SA.b", "pin:SB.b"],
      nudges: [{ when: crossed, say: "Crossed already? Straight first: A1 to B1." }],
      success: "Two roads.",
    },
    {
      id: "two-travelers",
      prompt: "Try all four switch combinations.",
      goal: (lab) => straight(lab) && litRows(lab, ["a,a", "b,b"]),
      hints: ["Flip one switch at a time until all four rows fill.", "The lamp follows whichever traveller both poles touch."],
      highlight: ["SA", "SB"],
      success: "Any single flip changes the lamp.",
    },
    {
      id: "cross-the-travelers",
      prompt: "Cross the travellers at B: **A1** to **B2**, **A2** to **B1**.",
      goal: (lab) => crossed(lab) && litRows(lab, ["a,b", "b,a"]),
      hints: ["Move only the two clips on switch B. Then flip through all four."],
      highlight: ["pin:SB.a", "pin:SB.b"],
      success: "Still a stairway, but now different means on.",
    },
    {
      id: "fix-traveler",
      prompt: "Make either switch work, every time.",
      setup: ONE_TRAVELLER,
      // Broken first (one traveller, as set up), then a full table that toggles on every flip.
      goal: (lab) => {
        if (!straight(lab) && !crossed(lab)) lab.memory["one"] = true;
        return lab.memory["one"] === true && (litRows(lab, ["a,a", "b,b"]) || litRows(lab, ["a,b", "b,a"]));
      },
      hints: ["A stairway needs two roads between the switches.", "Clip the loose lead back: A2 to B1."],
      highlight: ["TL6"],
      success: "Both roads back. Every flip works.",
    },
  ],
  solution: [
    { do: "lead", id: "TL5", from: "SA.a", to: "SB.a", color: "blue" },
    { do: "lead", id: "TL6", from: "SA.b", to: "SB.b", color: "white" },
    { do: "check", task: "wire-travelers" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "two-travelers" },
    { do: "clip", lead: "TL5", end: "b", to: "SB.b" },
    { do: "clip", lead: "TL6", end: "b", to: "SB.a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "cross-the-travelers" },
    ...ONE_TRAVELLER,
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL6", end: "a", to: "SA.b" },
    { do: "clip", lead: "TL6", end: "b", to: "SB.a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-traveler" },
  ],
});
