// Blueprint: docs/curriculum/unit-2.md, Lesson 1; a bench lesson (docs/LESSONS.md):
// content/units/switching/switches/switch-anatomy. One idea: a switch's pole moves between its throws.
// A slide switch S2 and an on/off toggle S1 on wooden blocks, and the meter. The continuity tables fill in by
// themselves as the learner probes each pair of terminals in each position. The fix-it round brings a two-lamp
// selector into play with the battery's lead on a throw instead of the pole.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const filled = (lab: LabView, id: string) => {
  const p = lab.panel(id);
  return p.size > 0 && Object.keys(p.cells).length >= p.size;
};

/**
 * The fix-it bench: a selector (battery plus to S2, each throw to one LED, both LEDs back through R1), with the plus
 * lead on throw a instead of the pole. The meter's probes come off first: no continuity tests on a live circuit.
 */
const SELECTOR_ON_A_THROW: SolutionStep[] = [
  { do: "probe", red: null, black: null, mode: "off" },
  { do: "flip", part: "S2", to: "a" },
  { do: "place", part: "B1", kind: "battery", at: "desk:-118,44", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
  { do: "place", part: "D1", kind: "led", at: "desk:-10,52", rot: 180, params: { color: "green" } },
  { do: "place", part: "D2", kind: "led", at: "desk:30,52", rot: 180, params: { color: "yellow" } },
  { do: "place", part: "R1", kind: "resistor", at: "desk:-56,74", params: { ohms: 1000 } },
  { do: "lead", id: "TL1", from: "B1.pos", to: "S2.a", color: "red" },
  { do: "lead", id: "TL2", from: "S2.a", to: "D1.anode", color: "green" },
  { do: "lead", id: "TL3", from: "S2.b", to: "D2.anode", color: "yellow" },
  { do: "lead", id: "TL4", from: "D1.cathode", to: "R1.b", color: "black" },
  { do: "lead", id: "TL5", from: "D2.cathode", to: "R1.b", color: "black" },
  { do: "lead", id: "TL6", from: "R1.a", to: "B1.neg", color: "black" },
];

export default defineLab({
  id: "switch-anatomy",
  title: "Poles and throws",
  bench: {
    board: "none",
    frame: ["desk:-140,-40", "desk:150,90"],
    parts: [
      { id: "S1", kind: "toggle-switch", at: "desk:-110,-8", params: { base: true, throws: 1, to: "a", tag: "S1" }, locked: true, label: "On/off switch S1" },
      { id: "S2", kind: "slide-switch", at: "desk:-30,-8", params: { base: true, to: "a", tag: "S2" }, locked: true, label: "Slide switch S2" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:104,-14", rot: -18, mode: "off" }],
  },
  panels: [
    { kind: "continuity", id: "s2", part: "S2", show: ["find-the-pole"] },
    { kind: "continuity", id: "s1", part: "S1", show: ["one-throw"] },
  ],
  mascot: {
    hint: "Both probe tips on two screws of one switch, then look at the meter.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "beep-test",
      prompt: "Dial to **Beep**. Touch the probe tips together.",
      goal: (lab) => lab.meter?.mode === "continuity" && lab.meter.beep === true && lab.connected("probe:red", "probe:black"),
      hints: ["Beep is the dial setting with the little sound-wave symbol.", "Drag one probe tip onto the other."],
      success: "Beep. A path!",
    },
    {
      id: "find-the-pole",
      prompt: "Probe every pair of **S2**'s three screws, in both positions.",
      goal: (lab) => filled(lab, "s2"),
      hints: ["Only three pairs: left-middle, middle-right, left-right.", "Slide S2 by clicking its knob. Then probe all three again."],
      highlight: ["S2"],
      nudges: [{ when: (lab) => lab.meter?.mode !== "continuity", say: "Dial back to Beep first." }],
      success: "Every pair, both ways.",
    },
    {
      id: "fix-selector",
      prompt: "Make the slider pick either lamp.",
      setup: SELECTOR_ON_A_THROW,
      // Broken first (green stuck on), then each lamp lit alone in its own position with plus on the pole.
      goal: (lab) => {
        const green = lab.isLit("D1");
        const yellow = lab.isLit("D2");
        if (!lab.connected("B1.pos", "S2.com")) {
          if (green) lab.memory["stuck"] = true;
          return false;
        }
        if (lab.memory["stuck"] !== true) return false;
        if (green && !yellow && !lab.closed("S2")) lab.memory["a"] = true;
        if (yellow && !green && lab.closed("S2")) lab.memory["b"] = true;
        return lab.memory["a"] === true && lab.memory["b"] === true;
      },
      hints: ["Follow the red lead from the battery. Where does it land?", "Plus belongs on the pole: S2's middle screw. Then slide."],
      highlight: ["TL1", "pin:S2.com"],
      success: "Either lamp, at a slide.",
    },
    {
      id: "one-throw",
      prompt: "Probe S1's two screws, both ways.",
      goal: (lab) => filled(lab, "s1"),
      hints: ["Red on one S1 screw, black on the other. Then flip S1."],
      highlight: ["S1"],
      success: "One throw: on or off.",
      bonus: true,
    },
  ],
  solution: [
    { do: "dial", mode: "continuity" },
    { do: "probe", red: "probe:black" },
    { do: "check", task: "beep-test" },
    { do: "probe", red: "S2.a", black: "S2.com" },
    { do: "probe", red: "S2.com", black: "S2.b" },
    { do: "probe", red: "S2.a", black: "S2.b" },
    { do: "flip", part: "S2", to: "b" },
    { do: "probe", red: "S2.a", black: "S2.com" },
    { do: "probe", red: "S2.com", black: "S2.b" },
    { do: "probe", red: "S2.a", black: "S2.b" },
    { do: "check", task: "find-the-pole" },
    // The secret, before the fix-it bench comes into play.
    { do: "probe", red: "S1.com", black: "S1.b" },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "one-throw" },
    ...SELECTOR_ON_A_THROW,
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL1", end: "b", to: "S2.com" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "S2", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-selector" },
  ],
});
