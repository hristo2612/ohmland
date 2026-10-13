// Blueprint: docs/curriculum/unit-2.md, Lesson 2. A DPDT slide switch on a block with six numbered terminals, wired
// inside in an order shuffled for each learner. The continuity table logs every pair the learner probes in each
// slider position; the pin map takes their verdict (and counts wrong tries, for the pin-sleuth achievement); the
// symbol builder takes the drawing. Once the map is right, "Peek inside" prints what each terminal is.
import { defineLab, type LabView } from "@ohmland/lab";

/** Beeping pairs logged with the slider at a and at b. */
const beeps = (lab: LabView, state: "a" | "b") => Object.entries(lab.panel("pairs").cells).filter(([k, v]) => v && k.endsWith(`@${state}`)).length;

export default defineLab({
  id: "mystery-switch",
  title: "The mystery switch",
  bench: {
    board: "none",
    parts: [{ id: "SW", kind: "dpdt-switch", at: "desk:-40,-6", params: { to: "a", mystery: "shuffle" }, locked: true, label: "Mystery switch" }],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:112,-26", rot: -22, mode: "continuity" }],
  },
  panels: [
    { kind: "continuity", id: "pairs", part: "SW", title: "Continuity log" },
    {
      kind: "pin-map",
      id: "legs",
      part: "SW",
      show: ["name-the-legs"],
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
    start: "Fifteen pairs. We have time. We have beeps.",
    hint: "Keep one probe still and walk the other one along.",
    success: "No label? No problem. Patterns don't lie.",
    exit: "Cracked by beeps alone. A detective would be proud.",
  },
  tasks: [
    {
      id: "map-pairs",
      prompt: "Probe every terminal pair, in both slider positions. The log fills itself.",
      goal: (lab) => beeps(lab, "a") >= 2 && beeps(lab, "b") >= 2,
      hints: [
        "Keep one probe on terminal 1; walk the other across 2 to 6.",
        "Each pair once per position. Click the slider to switch.",
      ],
      highlight: ["SW"],
      success: "A complete map: two pairs beep in each position.",
    },
    {
      id: "name-the-legs",
      prompt: "Give each terminal a role in the pin map, then check.",
      goal: (lab) => lab.panel("legs").correct,
      hints: [
        "A pole beeps in both positions, each time with a different partner.",
        "Two groups never beep together: two poles, each with two throws.",
      ],
      success: "Two poles, two throws each: a DPDT, cracked by beeps alone.",
      notice: "Peek inside now if you like: the terminals print what they are.",
    },
    {
      id: "draw-it",
      prompt: "Build its symbol: two changeover switches, joined by a dashed line.",
      goal: (lab) => lab.panel("drawing").correct,
      hints: ["The dashed line means mechanically linked, electrically separate."],
      success: "Engineers around the world will read that drawing the same way.",
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
    { do: "panel", id: "drawing", value: { slots: ["spdt", "spdt"], linked: true } },
    { do: "check", task: "draw-it" },
  ],
});
