// Blueprint: docs/curriculum/unit-2.md, Lesson 4; a bench lesson (docs/LESSONS.md):
// content/units/switching/relays/meet-the-relay. One idea: a coil's magnet moves a switch, and the coil never touches
// the contacts. A single-changeover relay on a block with five numbered terminals, wired inside in an order shuffled
// for each learner (black cover, nothing printed). The battery's plus already runs to the button; a clip from the
// button's other side and one from battery minus lie ready. The pin map takes the learner's verdict and counts wrong
// tries; once right, "Peek inside" swaps in the clear cover and prints the names. The fix-it round brings a lamp into
// play on the wrong contact.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The meter's probes are on these two terminals (as wired inside), either way round. */
const probing = (lab: LabView, a: string, b: string) =>
  (lab.connected("probe:red", `wired:K1.${a}`) && lab.connected("probe:black", `wired:K1.${b}`)) ||
  (lab.connected("probe:red", `wired:K1.${b}`) && lab.connected("probe:black", `wired:K1.${a}`));
const peeked = (lab: LabView) => (lab.benchPart("K1")?.params as { peek?: boolean } | undefined)?.peek === true;
const pressed = (lab: LabView) => lab.part("S1")?.extra?.["pressed"] === true;

/** The fix-it bench: the relay peeked open and a lamp fed from COM through NC, so pressing puts it out. */
const LAMP_ON_NC: SolutionStep[] = [
  { do: "probe", red: null, black: null, mode: "off" },
  { do: "param", part: "K1", params: { peek: true } },
  { do: "place", part: "R2", kind: "resistor", at: "desk:40,46", params: { ohms: 1000 } },
  { do: "place", part: "D2", kind: "led", at: "desk:92,40", rot: 180, params: { color: "green" } },
  { do: "lead", id: "TL4", from: "B1.pos", to: "wired:K1.com1", color: "red" },
  { do: "lead", id: "TL5", from: "wired:K1.nc1", to: "R2.a", color: "green" },
  { do: "lead", id: "TL6", from: "R2.b", to: "D2.anode", color: "green" },
  { do: "lead", id: "TL7", from: "D2.cathode", to: "B1.neg", color: "black" },
];

export default defineLab({
  id: "meet-the-relay",
  title: "Flipped by a magnet",
  bench: {
    board: "none",
    frame: ["desk:-140,-60", "desk:160,70"],
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
    tray: [],
    instruments: [{ kind: "meter", at: "desk:118,-24", rot: -18, mode: "off" }],
  },
  panels: [
    {
      kind: "pin-map",
      id: "legs",
      part: "K1",
      show: ["name-the-legs", "peek-relay"],
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
    hint: "At rest, COM hugs NC. Powered, it switches partners.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "find-the-coil",
      prompt: "Dial to ohms. The pair reading a few hundred ohms is the coil.",
      goal: (lab) => lab.meter?.mode === "ohm" && probing(lab, "coil1", "coil2") && lab.meterReads(540, { tol: 0.1, unit: "Ω" }),
      hints: ["Contacts read about 0 Ω or OL. The coil reads in between.", "Five terminals make ten pairs. Sweep them."],
      highlight: ["K1"],
      success: "About 540 Ω.",
    },
    {
      id: "find-com-nc",
      prompt: "Dial to continuity. With the relay resting, which pair beeps?",
      goal: (lab) => lab.meter?.mode === "continuity" && lab.meter.beep === true && !lab.closed("K1") && probing(lab, "com1", "nc1"),
      hints: ["Leave the two coil terminals out of it.", "Only one pair beeps while nothing powers the coil."],
      highlight: ["K1"],
      nudges: [{ when: (lab) => lab.meter?.mode === "ohm", say: "Beep mode for this one." }],
      success: "One pair joined at rest.",
    },
    {
      id: "energize",
      prompt: "Clip the yellow and black leads to the coil. Hold **S1**.",
      goal: (lab) => lab.event("clicked", "K1"),
      hints: ["Yellow on one coil terminal, black on the other.", "Then press and hold the red button. Listen."],
      highlight: ["TL2", "TL3", "S1"],
      success: "Click!",
    },
    {
      id: "name-the-legs",
      prompt: "Name every terminal in the pin map, then check.",
      goal: (lab) => lab.panel("legs").correct,
      hints: ["COM beeps with NC at rest, and with NO while S1 is held."],
      success: "Coil, COM, NC and NO.",
    },
    {
      id: "fix-lamp-no",
      prompt: "Make pressing S1 light the lamp.",
      setup: LAMP_ON_NC,
      // Broken first (lit at rest, as set up), then dark at rest and lit while the relay is pulled in.
      goal: (lab) => {
        const lit = lab.isLit("D2");
        if (lit && !pressed(lab)) lab.memory["onAtRest"] = true;
        if (lab.memory["onAtRest"] !== true || !lab.connected("wired:K1.no1", "R2.a")) return false;
        if (lab.heldFor(0.3, !lit && !pressed(lab), "dark")) lab.memory["darkAtRest"] = true;
        if (lab.heldFor(0.2, lit && lab.closed("K1"), "lit")) lab.memory["litPressed"] = true;
        return lab.memory["darkAtRest"] === true && lab.memory["litPressed"] === true;
      },
      hints: ["The lamp should wait for the click. Which contact closes then?", "Move the green clip from NC to NO."],
      highlight: ["TL5"],
      success: "Dark at rest, lit on the click.",
    },
    {
      id: "peek-relay",
      prompt: "Peek inside, then press S1.",
      goal: (lab) => {
        if (!peeked(lab)) return false;
        const since = (lab.memory["since"] ??= lab.t) as number;
        return lab.events.some((e) => e.type === "clicked" && e.partId === "K1" && e.t >= since);
      },
      hints: ["Peek inside sits under the pin map, once it's right."],
      success: "The armature swings.",
      bonus: true,
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
    { do: "probe", red: "wired:K1.coil1", black: "wired:K1.coil2", mode: "ohm" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "find-the-coil" },
    { do: "probe", red: "wired:K1.com1", black: "wired:K1.nc1", mode: "continuity" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "find-com-nc" },
    { do: "clip", lead: "TL2", end: "b", to: "wired:K1.coil1" },
    { do: "clip", lead: "TL3", end: "b", to: "wired:K1.coil2" },
    { do: "press", part: "S1", seconds: 1 },
    { do: "check", task: "energize" },
    { do: "panel", id: "legs", value: { coil1: "coil", coil2: "coil", com1: "com", nc1: "nc", no1: "no" } },
    { do: "check", task: "name-the-legs" },
    // The secret: peek, then click it again.
    { do: "param", part: "K1", params: { peek: true } },
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "check", task: "peek-relay" },
    ...LAMP_ON_NC,
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL5", end: "a", to: "wired:K1.no1" },
    { do: "wait", seconds: 0.5 },
    { do: "press", part: "S1", seconds: 1 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-lamp-no" },
  ],
});
