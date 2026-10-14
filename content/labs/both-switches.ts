// Blueprint: docs/curriculum/unit-2.md, Lesson 3 (its first task); a bench lesson (docs/LESSONS.md):
// content/units/switching/switches/both-switches. One idea: two switches in series light the lamp only when both are
// on. Two on/off toggles on blocks: battery plus, R1 and the LED run to switch A; switch B runs back to battery minus.
// The learner joins A to B with one clip lead, and a truth table logs every combination of the two switches with the
// lamp, starting again after each rewire.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The truth table is full and lit in exactly these rows ("b,b" = both on). */
function litRows(lab: LabView, rows: string[]): boolean {
  const t = lab.panel("truth");
  const keys = Object.keys(t.cells);
  if (keys.length < 4) return false;
  return keys.every((k) => t.cells[k] === rows.includes(k));
}

/** The fix-it bench: the two switches side by side (each joined to the other at both ends), so either one lights it. */
const SIDE_BY_SIDE: SolutionStep[] = [
  { do: "flip", part: "SA", to: "a" },
  { do: "flip", part: "SB", to: "a" },
  { do: "clip", lead: "TL5", end: "b", to: "SB.b" },
  { do: "lead", id: "TL6", from: "SA.com", to: "SB.com", color: "white" },
];

export default defineLab({
  id: "both-switches",
  title: "Both must agree",
  bench: {
    board: "none",
    frame: ["desk:-140,-70", "desk:170,66"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-128,36", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-52,-44", params: { ohms: 470 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:24,-30", rot: -90, params: { color: "red" }, locked: true, label: "Red LED (the lamp)" },
      { id: "SA", kind: "toggle-switch", at: "desk:-26,32", params: { base: true, throws: 1, to: "a", tag: "A" }, locked: true, label: "Switch A" },
      { id: "SB", kind: "toggle-switch", at: "desk:58,32", params: { base: true, throws: 1, to: "a", tag: "B" }, locked: true, label: "Switch B" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red", locked: true },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "yellow", locked: true },
      { id: "TL3", from: "D1.cathode", to: "SA.com", color: "green", locked: true },
      { id: "TL4", from: "SB.b", to: "B1.neg", color: "black", locked: true },
    ],
    tray: [{ kind: "lead", params: { color: "blue" }, count: 2 }],
    instruments: [],
  },
  panels: [
    {
      kind: "truth-table",
      id: "truth",
      show: ["series-pair", "fix-safety"],
      inputs: [
        { part: "SA", label: "Switch A", a: "off", b: "on" },
        { part: "SB", label: "Switch B", a: "off", b: "on" },
      ],
      output: { part: "D1" },
    },
  ],
  mascot: {
    hint: "Flip one switch at a time and watch which row fills in.",
    fried: "That LED lost its resistor somewhere. Check the clips.",
  },
  fried: { led: "Red LED, bypassed resistor" },
  tasks: [
    {
      id: "link-ab",
      prompt: "Clip a lead from **A**'s free screw to **B**'s.",
      goal: (lab) => lab.connected("SA.b", "SB.com"),
      hints: ["Drag a blue lead from the tray. One clip on each free screw."],
      highlight: ["pin:SA.b", "pin:SB.com"],
      success: "Joined.",
    },
    {
      id: "series-pair",
      prompt: "Try all four switch combinations.",
      goal: (lab) => litRows(lab, ["b,b"]),
      hints: ["Flip one switch at a time until all four rows fill."],
      highlight: ["SA", "SB"],
      success: "One row in four.",
    },
    {
      id: "fix-safety",
      prompt: "Make the lamp need both switches.",
      setup: SIDE_BY_SIDE,
      // Broken first (side by side, as set up), then a full table lit only with both on.
      goal: (lab) => {
        if (lab.parallel("SA", "SB")) lab.memory["oneWorks"] = true;
        return lab.memory["oneWorks"] === true && litRows(lab, ["b,b"]);
      },
      hints: ["Side by side, either switch makes a path. Make one road.", "Unclip the extra lead. Then A's free screw to B's."],
      highlight: ["TL5", "TL6"],
      success: "Both, or nothing. Safe.",
    },
    {
      id: "either-one",
      prompt: "Wire the two switches side by side. Try all four combinations.",
      goal: (lab) => lab.parallel("SA", "SB") && litRows(lab, ["a,b", "b,a", "b,b"]),
      hints: ["Join A's two screws to B's two screws: two leads."],
      success: "Either one does it.",
      bonus: true,
    },
  ],
  solution: [
    { do: "lead", id: "TL5", from: "SA.b", to: "SB.com", color: "blue" },
    { do: "check", task: "link-ab" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "series-pair" },
    ...SIDE_BY_SIDE,
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL6", end: "b", to: null },
    { do: "clip", lead: "TL6", end: "a", to: null },
    { do: "clip", lead: "TL5", end: "b", to: "SB.com" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-safety" },
    // The secret (offered before the fix-it; played last here, so the fix-it bench starts from the series pair).
    { do: "clip", lead: "TL5", end: "b", to: "SB.b" },
    { do: "clip", lead: "TL6", end: "a", to: "SA.com" },
    { do: "clip", lead: "TL6", end: "b", to: "SB.com" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SA", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SB", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "either-one" },
  ],
});
