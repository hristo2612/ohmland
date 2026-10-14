// Blueprint: docs/curriculum/unit-1.md, L14, the kept half after the split (docs/curriculum/conversion-guide.md, B3 14).
// The lab of a bench lesson (docs/LESSONS.md): content/units/basics/power-and-heat/fuse-guard.
// One idea: a fuse melts on purpose to save the rest, and the continuity beep shows the gap it leaves.
// A battery, a 1 A and a 3 A glass fuse lying loose, two clip leads (0.15 Ω each) and the meter. From the simulator:
// a fuse straight across the battery first sees about 4 A, then about 1.9 A as the battery sags; the 1 A fuse blows
// in a blink, a 10 A fuse just sits there while the battery heats up. The big-current measurement moved to big-current.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** A fuse sits straight across the battery, one end on each terminal. */
const acrossBattery = (lab: LabView, id: string): boolean => lab.joins(id, "B1.pos", "B1.neg");

/** The fix-it bench: someone fitted a 10 A fuse straight across the battery. It never blows; the battery cooks. */
const TEN_AMP: SolutionStep[] = [
  { do: "probe", red: null, black: null },
  { do: "dial", mode: "off" },
  { do: "place", part: "F3", kind: "fuse", params: { amps: 10 }, at: "desk:-15,5" },
  { do: "clip", lead: "TL1", end: "a", to: "B1.pos" },
  { do: "clip", lead: "TL1", end: "b", to: "F3.a" },
  { do: "clip", lead: "TL2", end: "a", to: "F3.b" },
  { do: "clip", lead: "TL2", end: "b", to: "B1.neg" },
];

export default defineLab({
  id: "fuse-guard",
  title: "The weak link",
  bench: {
    board: "none",
    frame: ["desk:-140,-85", "desk:135,80"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-95,15", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "F1", kind: "fuse", at: "desk:-15,-25", params: { amps: 1 }, label: "1 A fuse" },
      { id: "F2", kind: "fuse", at: "desk:-15,35", params: { amps: 3 }, label: "3 A fuse" },
    ],
    tray: [
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "black" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:85,-25", mode: "off", tips: { red: "desk:0,62", black: "desk:18,68" } }],
  },
  mascot: {
    hint: "A fuse is a wire or a gap. Nothing in between.",
    fried: "The fuse gave its life, exactly as designed.",
  },
  fried: { F1: "1 A fuse across a 9 V battery", F2: "3 A fuse, too much current" },
  tasks: [
    {
      id: "blow-1a",
      prompt: "Clip the 1 A fuse straight across the battery.",
      goal: (lab) => lab.event("blown", "F1"),
      hints: ["Two clip leads: battery plus to one end of the fuse.", "The fuse's other end to battery minus."],
      highlight: ["F1", "pin:B1.pos", "pin:B1.neg"],
      nudges: [{ when: (lab) => acrossBattery(lab, "F2"), say: "That's the 3 A one. Try the 1 A fuse." }],
      success: "Snap.",
    },
    {
      id: "continuity-check",
      prompt: "Dial to the beep. Probe the blown fuse, then the 3 A one.",
      goal: (lab) => {
        const mem = lab.memory as { open?: boolean; beep?: boolean };
        if (lab.meter?.mode === "continuity") {
          if (lab.across("F1", "either") && lab.meter.value === Infinity && !lab.meter.beep) mem.open = true;
          if (lab.across("F2", "either") && lab.meter.beep) mem.beep = true;
        }
        return !!mem.open && !!mem.beep;
      },
      hints: ["Turn the dial to the beep symbol.", "A probe on each metal end cap: the blown fuse, then the good one."],
      highlight: ["F1", "F2"],
      success: "Silence, then a beep.",
    },
    {
      id: "fix-short",
      prompt: "Something here is hot. Fix it.",
      setup: TEN_AMP,
      // The 10 A fuse across the battery first (the setup), then the 1 A fuse in its place, blown by the short.
      goal: (lab) => {
        if (acrossBattery(lab, "F3")) lab.memory["short"] = true;
        return lab.memory["short"] === true && !acrossBattery(lab, "F3") && acrossBattery(lab, "F1") && !lab.closed("F1");
      },
      hints: ["A fuse only helps if the fault's flow can melt it.", "Drop the 1 A fuse onto the 10 A one: they swap."],
      highlight: ["F1", "F3"],
      nudges: [
        { when: (lab) => acrossBattery(lab, "F2"), say: "Still holding. 3 A is too big for this short." },
        {
          when: (lab) => lab.memory["short"] === true && !acrossBattery(lab, "F3") && !acrossBattery(lab, "F1") && !acrossBattery(lab, "F2"),
          say: "Short gone. Now fit a fuse that would stop one.",
        },
      ],
      success: "Snap. Short stopped.",
    },
  ],
  solution: [
    { do: "lead", id: "TL1", from: "B1.pos", to: "F1.a", color: "red" },
    { do: "lead", id: "TL2", from: "F1.b", to: "B1.neg", color: "black" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "blow-1a" },
    { do: "probe", red: "F1.a", black: "F1.b", mode: "continuity" },
    { do: "wait", seconds: 0.5 },
    { do: "probe", red: "F2.a", black: "F2.b" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "continuity-check" },
    ...TEN_AMP,
    { do: "wait", seconds: 1 },
    { do: "move", part: "F1", at: "on:F3" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-short" },
  ],
});
