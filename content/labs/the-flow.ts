// Blueprint: docs/curriculum/start-here.md, SH4 "The counting gates". A bench lesson (docs/LESSONS.md): its tasks are
// the beats of content/units/start-here/first-cases/the-flow/lesson.yaml, in the same order.
// One idea: flow goes all the way round, the same everywhere. The lamp uses none of it up.
// Flow dots ride the loop; gates clipped round a lead count the dots that pass (lab.gate reads the lead's current).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The fix-it: the lamp on, a gate on the red lead, and a blue lead clipped straight across the lamp. */
const SHORTCUT: SolutionStep[] = [
  { do: "lead", id: "TLX", from: "D1.anode", to: "D1.cathode", color: "blue" },
  { do: "move", part: "G1", at: "lead:TL1" },
  { do: "flip", part: "S1", to: "b" },
];

/** The lead a gate is clipped round, if any. */
const leadOf = (lab: LabView, gate: string) => {
  const on = (lab.prop(gate) as { on?: string } | undefined)?.on;
  return on ? lab.bench.leads.find((l) => l.id === on) : undefined;
};
/** A gate sits on a lead whose clip holds `pin` (a lamp leg). */
const gateAt = (lab: LabView, gate: string, pin: string) => {
  const l = leadOf(lab, gate);
  return !!l && (l.a.to === `pin:${pin}` || l.b.to === `pin:${pin}`);
};
/** One gate on the lead into the lamp, the other on the lead out of it. */
const bothSides = (lab: LabView) =>
  (gateAt(lab, "G1", "D1.anode") && gateAt(lab, "G2", "D1.cathode")) || (gateAt(lab, "G2", "D1.anode") && gateAt(lab, "G1", "D1.cathode"));

/** Broken first (the setup), then lit: a bench that never went dark does not count. */
const relit = (lab: LabView) => {
  if (!lab.isLit("D1")) lab.memory["dark"] = true;
  return lab.memory["dark"] === true && lab.isLit("D1");
};

export default defineLab({
  id: "the-flow",
  title: "The flow",
  bench: {
    board: "none",
    frame: ["desk:-112,-62", "desk:84,58"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-72,2", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "toggle-switch", at: "desk:-6,-42", params: { base: true, to: "a" }, locked: true, label: "Switch" },
      { id: "R1", kind: "resistor", at: "desk:62,-4", rot: -90, params: { ohms: 1000, watts: 0.25 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:16,44", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Lamp" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.com", color: "red" },
      { id: "TL2", from: "S1.b", to: "R1.a", color: "yellow" },
      { id: "TL3", from: "R1.b", to: "D1.anode", color: "green" },
      { id: "TL4", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    // Two counting gates: the first one placed is G1, the second G2.
    tray: [{ id: "G1", kind: "gate", count: 2, label: "Gate" }],
    instruments: [],
    overlays: { flow: "current", offer: ["flow", "electrons"] },
  },
  mascot: {
    hint: "Gates clip onto a lead, like a clip.",
    fried: "Oof. Too much flow for my lamp. Fresh one in.",
  },
  tasks: [
    {
      id: "see-the-flow",
      prompt: "Switch the lamp on.",
      goal: (lab) => lab.closed("S1") && lab.isLit("D1"),
      hints: ["The lever on the wooden block."],
      highlight: ["S1"],
      success: "It glows.",
    },
    {
      id: "first-gate",
      prompt: "Clip a gate onto the lead going into the lamp.",
      goal: (lab) => lab.gate("G1") > 0.001 || lab.gate("G2") > 0.001,
      hints: ["Drag the gate onto the lead going into the lamp."],
      highlight: ["TL3"],
      nudges: [{ when: (lab) => !lab.closed("S1"), say: "Keep the switch on, so it has flow to count." }],
      success: "Tick, tick, tick.",
    },
    {
      id: "same-both-sides",
      prompt: "Clip the second gate onto the lead coming out of the lamp.",
      goal: (lab) =>
        bothSides(lab) && lab.gate("G1") > 0.001 && lab.gate("G2") > 0.001 && Math.abs(lab.gate("G1") - lab.gate("G2")) < 1e-5 && (lab.stats("gate:G2", 0.5)?.min ?? 0) > 0.001,
      hints: ["Gate two: the lead coming out.", "One gate on the green lead, one on the black."],
      highlight: ["TL3", "TL4"],
      success: "Same ticks.",
    },
    {
      id: "stop-it",
      prompt: "Make the flow stop.",
      goal: (lab) => lab.loopOpen("D1") && lab.amps("TL3") < 1e-6 && lab.amps("TL4") < 1e-6,
      hints: ["Flip the switch off."],
      highlight: ["S1"],
      success: "Stopped everywhere at once.",
    },
    {
      id: "fix-it",
      prompt: "The gate ticks, but the lamp is dark. Find the shortcut.",
      setup: SHORTCUT,
      goal: relit,
      hints: ["Follow the dots. Where do they skip the lamp?", "Unclip the blue lead from the lamp."],
      highlight: ["TLX"],
      success: "Fixed. A shortcut steals the flow.",
    },
    {
      id: "show-electrons",
      prompt: "Light the lamp and show the dots as electrons.",
      goal: (lab) => lab.heldFor(2, lab.view("electrons") && lab.isLit("D1")),
      hints: ["Tap Electrons under the bench."],
      success: "Electrons crawl the other way.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "b" },
    { do: "check", task: "see-the-flow" },
    { do: "place", part: "G1", kind: "gate", at: "lead:TL3" },
    { do: "check", task: "first-gate" },
    { do: "place", part: "G2", kind: "gate", at: "lead:TL4" },
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "same-both-sides" },
    { do: "flip", part: "S1", to: "a" },
    { do: "check", task: "stop-it" },
    ...SHORTCUT,
    { do: "clip", lead: "TLX", end: "a", to: null },
    { do: "check", task: "fix-it" },
    // The secret last, so the fix-it bench starts from the gates in place and the switch off.
    { do: "view", name: "electrons", on: true },
    { do: "wait", seconds: 2.2 },
    { do: "check", task: "show-electrons" },
  ],
});
