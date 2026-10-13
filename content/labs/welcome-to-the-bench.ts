// Blueprint: docs/curriculum/unit-1.md, L1. A reference lab of a bench lesson (docs/LESSONS.md): its tasks are the
// beats of content/units/basics/your-meter/welcome-to-the-bench/lesson.yaml, in the same order.
// One idea: current only flows around a complete loop.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The fix-it bench: the yellow lead moved to the switch's spare terminal, so "on" no longer closes the loop. */
const WRONG_TERMINAL: SolutionStep[] = [{ do: "clip", lead: "TL2", end: "a", to: "S1.a" }];

/** Broken first (a setup or a learner's change), then lit: a bench that never went dark does not count. */
const relit = (lab: LabView) => {
  if (!lab.isLit("D1")) lab.memory["dark"] = true;
  return lab.memory["dark"] === true && lab.isLit("D1");
};

export default defineLab({
  id: "welcome-to-the-bench",
  title: "Welcome to the bench",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-72,2", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // A big toggle switch on a small wooden block, wired between com and b, so "on" is thrown to b.
      { id: "S1", kind: "toggle-switch", at: "desk:-6,-42", params: { base: true, to: "a" }, locked: true, label: "Switch" },
      { id: "R1", kind: "resistor", at: "desk:62,-4", rot: -90, params: { ohms: 1500, watts: 0.25 }, locked: true, label: "1.5 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:16,44", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.com", color: "red" },
      { id: "TL2", from: "S1.b", to: "R1.a", color: "yellow" },
      { id: "TL3", from: "R1.b", to: "D1.anode", color: "green" },
      { id: "TL4", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Look for a gap. Light only flows around a full loop.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "close-the-switch",
      prompt: "Flip the switch on.",
      goal: (lab) => lab.closed("S1") && lab.isLit("D1"),
      hints: ["The switch is the lever on the wooden block. Click or tap it."],
      highlight: ["S1"],
      success: "It glows.",
    },
    {
      id: "break-the-loop",
      prompt: "Keep the switch on. Unclip any one lead.",
      goal: (lab) => lab.closed("S1") && lab.bench.detachedLeadEnds >= 1 && lab.loopOpen("D1"),
      hints: ["Drag one end of any clip lead off its part and drop it on the desk.", "Pick a lead far from the LED."],
      highlight: ["TL1"],
      nudges: [{ when: (lab) => !lab.closed("S1") && lab.bench.detachedLeadEnds === 0, say: "Keep the switch on for this one." }],
      success: "Dark.",
    },
    {
      id: "mend-the-loop",
      prompt: "Clip the lead back on.",
      goal: (lab) => lab.isLit("D1"),
      hints: ["Every part needs a lead on both of its ends.", "Drag the loose clip back onto the metal it came from."],
      success: "Light's back.",
    },
    {
      id: "fix-switch",
      prompt: "The switch is on, but no light. Fix it.",
      setup: WRONG_TERMINAL,
      goal: relit,
      hints: ["Follow the yellow lead to the switch.", "The switch joins its middle terminal to the side it leans toward."],
      highlight: ["TL2", "S1"],
      success: "Fixed.",
    },
    {
      id: "swap-battery-leads",
      prompt: "Swap the two clips on the battery.",
      // The whole battery across the LED backwards: a complete loop, facing the wrong way.
      goal: (lab) => (lab.part("D1")?.v ?? 0) < -1 && (lab.part("D1")?.glow ?? 1) < 0.01,
      hints: ["Unclip both battery leads and clip each onto the other terminal."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "Nothing lights, and nothing breaks.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "b" },
    { do: "check", task: "close-the-switch" },
    { do: "clip", lead: "TL2", end: "a", to: null },
    { do: "check", task: "break-the-loop" },
    { do: "clip", lead: "TL2", end: "a", to: "S1.b" },
    { do: "check", task: "mend-the-loop" },
    ...WRONG_TERMINAL,
    { do: "clip", lead: "TL2", end: "a", to: "S1.b" },
    { do: "check", task: "fix-switch" },
    { do: "clip", lead: "TL1", end: "a", to: "B1.neg" },
    { do: "clip", lead: "TL4", end: "b", to: "B1.pos" },
    { do: "check", task: "swap-battery-leads" },
  ],
});
