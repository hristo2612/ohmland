// Blueprint: docs/curriculum/unit-2.md, Lesson 2; a bench lesson (docs/LESSONS.md):
// content/units/switching/switches/mystery-switch. One idea: test every pair in every position, and the pattern names
// the legs. A DPDT slide switch on a block with six numbered terminals, wired inside in an order shuffled for each
// learner. The continuity log fills in as the learner probes pairs in each slider position; the pin map takes their
// verdict (and counts wrong tries, for the pin-sleuth achievement); once it is right, "Peek inside" prints what each
// terminal is. The symbol builder is the secret. The fix-it round brings a lamp into play clipped to two throws.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** Beeping pairs logged with the slider at a and at b. */
const beeps = (lab: LabView, state: "a" | "b") => Object.entries(lab.panel("pairs").cells).filter(([k, v]) => v && k.endsWith(`@${state}`)).length;

/**
 * The fix-it bench: the switch peeked open (its terminals print what they are) and a lamp loop clipped across the two
 * throws of pole A, which never join. The meter goes off first: no continuity tests on a live circuit.
 */
const LAMP_ON_TWO_THROWS: SolutionStep[] = [
  { do: "probe", red: null, black: null, mode: "off" },
  { do: "param", part: "SW", params: { peek: true } },
  { do: "flip", part: "SW", to: "a" },
  { do: "place", part: "B1", kind: "battery", at: "desk:-118,40", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
  { do: "place", part: "R1", kind: "resistor", at: "desk:-60,64", params: { ohms: 1000 } },
  { do: "place", part: "D1", kind: "led", at: "desk:0,64", rot: 180, params: { color: "red" } },
  { do: "lead", id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
  { do: "lead", id: "TL2", from: "R1.b", to: "D1.anode", color: "green" },
  { do: "lead", id: "TL3", from: "D1.cathode", to: "wired:SW.a1", color: "yellow" },
  { do: "lead", id: "TL4", from: "wired:SW.b1", to: "B1.neg", color: "black" },
];

export default defineLab({
  id: "mystery-switch",
  title: "The mystery switch",
  bench: {
    board: "none",
    frame: ["desk:-140,-40", "desk:150,84"],
    parts: [{ id: "SW", kind: "dpdt-switch", at: "desk:-40,-6", params: { to: "a", mystery: "shuffle" }, locked: true, label: "Mystery switch" }],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:104,-14", rot: -18, mode: "continuity" }],
  },
  panels: [
    { kind: "continuity", id: "pairs", part: "SW", title: "Continuity log", show: ["map-pairs"] },
    {
      kind: "pin-map",
      id: "legs",
      part: "SW",
      show: ["name-the-legs", "peek-inside"],
      peek: true,
      roles: [
        { id: "pole-a", label: "Pole A", legs: ["com1"] },
        { id: "throw-a", label: "Throw of pole A", legs: ["a1", "b1"] },
        { id: "pole-b", label: "Pole B", legs: ["com2"] },
        { id: "throw-b", label: "Throw of pole B", legs: ["a2", "b2"] },
      ],
      swap: [
        ["pole-a", "throw-a"],
        ["pole-b", "throw-b"],
      ],
    },
    { kind: "symbol", id: "drawing", show: ["draw-it"], answer: { slots: ["spdt", "spdt"], linked: true } },
  ],
  mascot: {
    hint: "Keep one probe still and walk the other one along.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "map-pairs",
      prompt: "Probe every terminal pair, in both slider positions. The log fills itself.",
      goal: (lab) => beeps(lab, "a") >= 2 && beeps(lab, "b") >= 2,
      hints: ["Keep one probe on terminal 1; walk the other across 2 to 6.", "Each pair once per position. Click the slider to switch."],
      highlight: ["SW"],
      success: "Two pairs beep in each position.",
    },
    {
      id: "name-the-legs",
      prompt: "Give each terminal a role in the pin map, then check.",
      goal: (lab) => lab.panel("legs").correct,
      hints: ["A pole beeps in both positions, each time with a new partner.", "Two groups never beep together: two poles, two throws each."],
      success: "Two poles, two throws each.",
    },
    {
      id: "peek-inside",
      prompt: "Peek inside the switch.",
      goal: (lab) => (lab.benchPart("SW")?.params as { peek?: boolean } | undefined)?.peek === true,
      hints: ["The Peek inside button sits under the pin map."],
      success: "Just as the beeps said.",
    },
    {
      id: "fix-lamp",
      prompt: "Make the slider switch the lamp on and off.",
      setup: LAMP_ON_TWO_THROWS,
      // Broken first (dark either way), then lit in one slider position, then dark after sliding to the other.
      // (Each state must hold a moment: an LED's glow takes a blink to fade after a slide.)
      goal: (lab) => {
        const lit = lab.isLit("D1");
        const pos = lab.closed("SW") ? "b" : "a";
        if (lab.memory["dark"] !== true) {
          if (!lit) lab.memory["dark"] = true;
          return false;
        }
        if (lab.heldFor(0.3, lit, `lit-${pos}`)) lab.memory["litAt"] = pos;
        const litAt = lab.memory["litAt"];
        return litAt !== undefined && lab.heldFor(0.3, !lit && pos !== litAt, "dark-other");
      },
      hints: ["Two throws never join. One clip belongs on a pole.", "Move the yellow clip to P1. Then slide."],
      highlight: ["TL3", "TL4"],
      success: "On, off. Pole and throw, working together.",
    },
    {
      id: "draw-it",
      prompt: "Build its symbol: two changeover switches, joined by a dashed line.",
      goal: (lab) => lab.panel("drawing").correct,
      hints: ["The dashed line means moved together, wired apart."],
      success: "Engineers everywhere will read that drawing the same way.",
      bonus: true,
    },
    {
      id: "clean-map",
      prompt: "Bonus: get the pin map right on your first try.",
      goal: (lab) => lab.panel("legs").correct && lab.panel("legs").wrong === 0,
      hints: ["Fill the whole log before you check: every pair, both positions."],
      success: "First try, no guessing. That's how a pin sleuth works.",
      trigger: "pin-map-perfect",
      bonus: true,
    },
  ],
  solution: [
    // Sweep from each pole's terminal: the solution knows the hidden wiring ("wired:"), a learner finds it by beeps.
    { do: "probe", red: "wired:SW.com1", black: "wired:SW.a1" },
    { do: "probe", red: "wired:SW.com1", black: "wired:SW.b1" },
    { do: "probe", red: "wired:SW.com2", black: "wired:SW.a2" },
    { do: "probe", red: "wired:SW.com2", black: "wired:SW.b2" },
    { do: "probe", red: "wired:SW.com1", black: "wired:SW.com2" },
    { do: "flip", part: "SW", to: "b" },
    { do: "probe", red: "wired:SW.com1", black: "wired:SW.b1" },
    { do: "probe", red: "wired:SW.com1", black: "wired:SW.a1" },
    { do: "probe", red: "wired:SW.com2", black: "wired:SW.b2" },
    { do: "probe", red: "wired:SW.com2", black: "wired:SW.a2" },
    { do: "check", task: "map-pairs" },
    { do: "panel", id: "legs", value: { com1: "pole-a", a1: "throw-a", b1: "throw-a", com2: "pole-b", a2: "throw-b", b2: "throw-b" } },
    { do: "check", task: "name-the-legs" },
    { do: "param", part: "SW", params: { peek: true } },
    { do: "check", task: "peek-inside" },
    // The secret, before the fix-it bench comes into play.
    { do: "panel", id: "drawing", value: { slots: ["spdt", "spdt"], linked: true } },
    { do: "check", task: "draw-it" },
    ...LAMP_ON_TWO_THROWS,
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL4", end: "a", to: "wired:SW.com1" },
    { do: "wait", seconds: 0.4 },
    { do: "flip", part: "SW", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-lamp" },
  ],
});
