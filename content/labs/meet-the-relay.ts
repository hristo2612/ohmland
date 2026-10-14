// Blueprint: docs/curriculum/unit-2.md, Lesson 4. A single-changeover relay on a block with five numbered terminals,
// wired inside in an order shuffled for each learner (black cover, nothing printed). The battery's plus already runs
// to the button; a clip from the button's other side and one from battery minus lie ready. The pin map takes the
// learner's verdict and counts wrong tries; once right, "Peek inside" swaps in the clear cover and prints the names.
import { defineLab, type LabView } from "@ohmland/lab";

/** The meter's probes are on these two terminals (as wired inside), either way round. */
const probing = (lab: LabView, a: string, b: string) =>
  (lab.connected("probe:red", `wired:K1.${a}`) && lab.connected("probe:black", `wired:K1.${b}`)) ||
  (lab.connected("probe:red", `wired:K1.${b}`) && lab.connected("probe:black", `wired:K1.${a}`));

export default defineLab({
  id: "meet-the-relay",
  title: "A switch flipped by a magnet",
  bench: {
    board: "none",
    parts: [
      { id: "K1", kind: "relay", at: "desk:-20,-30", params: { base: true, tag: "K1", poles: 1, mystery: "shuffle", coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Mystery relay" },
      { id: "B1", kind: "battery", at: "desk:-118,20", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "desk:-48,40", params: { base: true, cap: "red", tag: "S1" }, locked: true, label: "Button S1" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.a1", color: "red" },
      { id: "TL2", from: "S1.b1", to: null, color: "yellow" },
      { id: "TL3", from: "B1.neg", to: null, color: "black" },
    ],
    tray: [{ kind: "lead", params: { color: "green" }, count: 2 }],
    instruments: [{ kind: "meter", at: "desk:128,-24", rot: -22, mode: "off" }],
  },
  panels: [
    {
      kind: "pin-map",
      id: "legs",
      part: "K1",
      show: ["energize"],
      peek: true,
      roles: [
        { id: "coil", label: "Coil", legs: ["coil1", "coil2"] },
        { id: "com", label: "COM", legs: ["com1"] },
        { id: "nc", label: "NC (closed at rest)", legs: ["nc1"] },
        { id: "no", label: "NO (open at rest)", legs: ["no1"] },
      ],
    },
  ],
  mascot: {
    start: "Five legs, no labels. Let's find out who is who.",
    hint: "At rest, COM hugs NC. Energized, it switches partners.",
    success: "Hear that click? That's a magnet doing your job.",
    exit: "Two worlds, one box, zero shared wires.",
  },
  tasks: [
    {
      id: "find-the-coil",
      prompt: "Ohms, 2 kΩ range. The pair reading a few hundred is the coil.",
      goal: (lab) => lab.meter?.mode === "ohm" && probing(lab, "coil1", "coil2") && lab.meterReads(540, { tol: 0.1, unit: "Ω" }),
      hints: [
        "Contacts read 0 Ω or OL. The coil reads in between.",
        "Five terminals make only ten pairs. Sweep them all.",
      ],
      highlight: ["K1"],
      success: "About 540 Ω. That's a long coil of very thin copper.",
      notice: "The coil reads the same either way round.",
    },
    {
      id: "find-com-nc",
      prompt: "Switch to continuity. With the relay resting, which pair beeps?",
      goal: (lab) => lab.meter?.mode === "continuity" && lab.meter.beep && !lab.closed("K1") && probing(lab, "com1", "nc1"),
      hints: ["Leave the coil terminals out of it.", "Only one pair beeps while nothing powers the coil."],
      success: "One pair is joined at rest: normally closed and common.",
    },
    {
      id: "energize",
      prompt:
        "Clip yellow and black to the coil. Hold S1, then fill the pin map.",
      goal: (lab) => lab.event("clicked", "K1") && lab.panel("legs").correct,
      hints: ["Listen for the click.", "COM beeps with one partner at rest, another while S1 is held."],
      highlight: ["S1"],
      success: "A changeover switch, flipped by electricity. The coil never touches the contacts.",
      notice: "Coil and contacts never beep together. That makes relays useful.",
    },
    {
      id: "clean-map",
      prompt: "Bonus: get the pin map right on your first try.",
      goal: (lab) => lab.panel("legs").correct && lab.panel("legs").wrong === 0,
      hints: ["Find all five first: coil, COM and NC at rest, then NO."],
      success: "First try. You read that relay like a datasheet.",
      trigger: "pin-map-perfect",
      bonus: true,
    },
  ],
  solution: [
    { do: "probe", red: "wired:K1.coil1", black: "wired:K1.coil2", mode: "ohm", range: "2k" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "find-the-coil" },
    { do: "probe", red: "wired:K1.com1", black: "wired:K1.nc1", mode: "continuity" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "find-com-nc" },
    { do: "clip", lead: "TL2", end: "b", to: "wired:K1.coil1" },
    { do: "clip", lead: "TL3", end: "b", to: "wired:K1.coil2" },
    { do: "probe", red: "wired:K1.com1", black: "wired:K1.no1" },
    { do: "press", part: "S1", seconds: 1 },
    { do: "panel", id: "legs", value: { coil1: "coil", coil2: "coil", com1: "com", nc1: "nc", no1: "no" } },
    { do: "check", task: "energize" },
  ],
});
