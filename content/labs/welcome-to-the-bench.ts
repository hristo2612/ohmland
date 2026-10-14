// Blueprint: docs/curriculum/start-here.md, SH1 "The dark lamp". A bench lesson (docs/LESSONS.md): its tasks are the
// beats of the lesson's lesson.yaml, in the same order.
// One idea: flow needs a closed loop, with metal touching metal all the way round.
// The case: the lamp's red lead bites the battery's plastic wrapper, not its metal snap. The tracer, run from the
// minus snap, inks the loop lead by lead and stops one clip short.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The fix-it bench: the yellow lead's clip bites the switch's wooden block instead of its screw terminal. */
const ON_THE_WOOD: SolutionStep[] = [{ do: "clip", lead: "TL2", end: "a", to: "base:S1" }];

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
    frame: ["desk:-112,-60", "desk:84,58"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-72,2", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // A big toggle switch on a small wooden block, wired between com and b, so "on" is thrown to b.
      { id: "S1", kind: "toggle-switch", at: "desk:-6,-42", params: { base: true, to: "a" }, locked: true, label: "Switch" },
      { id: "R1", kind: "resistor", at: "desk:62,-4", rot: -90, params: { ohms: 1000, watts: 0.25 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:16,44", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Lamp" },
    ],
    leads: [
      // The case's gap: this clip bites the plastic wrapper beside the + snap, which joins nothing.
      { id: "TL1", from: "wrap:B1", to: "S1.com", color: "red" },
      { id: "TL2", from: "S1.b", to: "R1.a", color: "yellow" },
      { id: "TL3", from: "R1.b", to: "D1.anode", color: "green" },
      { id: "TL4", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Follow the ink. Where does it stop?",
    fried: "Oh no, too much flow burned a part out. Move the last clip back, then tap Replace.",
  },
  tasks: [
    {
      id: "close-the-switch",
      prompt: "Flip the switch on.",
      goal: (lab) => lab.closed("S1"),
      hints: ["The switch is the wooden block with OFF and ON printed on it. Tap or drag its lever over to ON."],
      highlight: ["S1"],
      success: "Click. The switch is on, but the lamp is still dark.",
    },
    {
      id: "find-the-gap",
      prompt: "Move the red clip from the plastic onto the metal snap.",
      goal: (lab) => lab.closed("S1") && lab.isLit("D1"),
      hints: ["The red clip sits on the battery's plastic wrapper. Drag it onto the round metal stud, the plus (+) snap."],
      highlight: ["TL1", "pin:B1.pos"],
      nudges: [{ when: (lab) => !lab.closed("S1"), say: "Flip the switch back to ON: the loop is open there too." }],
      success: "It glows!",
    },
    {
      id: "break-the-loop",
      prompt: "Keep the switch on. Unclip any one lead.",
      goal: (lab) => lab.closed("S1") && lab.bench.detachedLeadEnds >= 1 && lab.loopOpen("D1"),
      hints: ["Drag the black clip off the lamp's leg and drop it on the empty desk."],
      highlight: ["TL4"],
      nudges: [{ when: (lab) => !lab.closed("S1") && lab.bench.detachedLeadEnds === 0, say: "Flip the switch back to ON, so a clip is the only gap." }],
      success: "Dark.",
    },
    {
      id: "mend-the-loop",
      prompt: "Clip the lead back on.",
      // Every clip back on metal (a loose clip still lying there would be a fresh break).
      goal: (lab) => lab.bench.detachedLeadEnds === 0 && lab.isLit("D1"),
      hints: ["Find the clip lying loose on the desk, and drag it back onto the metal it came from."],
      success: "The light is back, because the loop is closed again.",
    },
    {
      id: "fix-it",
      prompt: "The switch is on, but no light. Fix it.",
      setup: ON_THE_WOOD,
      goal: relit,
      hints: ["Follow the wires round the loop, clip by clip. One clip bites wood instead of metal.", "Move the yellow clip off the wooden block and onto the metal screw beside the lever."],
      highlight: ["TL2", "S1"],
      success: "Fixed! Wood is a gap too, because it carries no flow.",
    },
    {
      id: "swap-battery-leads",
      prompt: "Swap the two clips on the battery.",
      // The whole battery across the lamp backwards: a closed loop, facing the wrong way.
      goal: (lab) => lab.closed("S1") && (lab.part("D1")?.v ?? 0) < -1 && (lab.part("D1")?.glow ?? 1) < 0.01,
      hints: ["Take both clips off the battery, then clip each one onto the other snap."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "Dark, and nothing broke.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "b" },
    { do: "check", task: "close-the-switch" },
    { do: "trace", from: "B1.neg" },
    { do: "clip", lead: "TL1", end: "a", to: "B1.pos" },
    { do: "check", task: "find-the-gap" },
    { do: "clip", lead: "TL4", end: "b", to: null },
    { do: "check", task: "break-the-loop" },
    { do: "clip", lead: "TL4", end: "b", to: "B1.neg" },
    { do: "check", task: "mend-the-loop" },
    ...ON_THE_WOOD,
    { do: "clip", lead: "TL2", end: "a", to: "S1.b" },
    { do: "check", task: "fix-it" },
    // The secret last, so the fix-it bench starts from the mended loop.
    { do: "clip", lead: "TL1", end: "a", to: "B1.neg" },
    { do: "clip", lead: "TL4", end: "b", to: "B1.pos" },
    { do: "check", task: "swap-battery-leads" },
  ],
});
