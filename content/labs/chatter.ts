// Blueprint: docs/curriculum/unit-4.md, CH22; a bench lesson (docs/LESSONS.md): content/units/chips/logic/chatter.
// One idea: a switch's contacts bounce for a few milliseconds, so one press can give several clock edges; a latch fed
// from a two-way switch takes only the first touch. New: the word "bounce".
// Full board, the logic rail (5 V on the far rails). A bare 4026B (U1, pin 1 at e30) and its display DS1 at 5 V
// (1 kΩ a bar on the carrier) count visitors. S1, a pushbutton with contact bounce, joins 5 V to its strip (column
// 12), which R1 pulls down; the clock wire W1 runs from there to U1's pin 1. U2, a 74HC02 at e16, is wired as CH21's
// latch (pin 1 into pin 5, pin 4 into pin 3); slide switch SW2 (bounce on, h25 to h27) throws 5 V onto pin 2 (a) or
// pin 6 (b), R2 and R3 pulling them down; pin 1 is the latch's output. The timing diagram watches the button's strip
// and the latch's output, and replays a burst of edges in slow motion. The scope's single shot is not used: the
// solution replay cannot arm it, and the diagram shows the same chatter. The fix-it bench moves the a
// throw's wire into an empty strip, so the latch can be set but never cleared.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { count, countAt, digit, gateChip, logicRail, seen, wire } from "./lib/chip-bench";

const rail = logicRail(4, 61);
const taken = ["top-:5", "top+:6", "top+:10", "rail-:12", "rail-:17", "rail-:21", "top+:25", "top+:30", "top-:31", "rail-:31", "rail-:37", "rail-:42"];
const u2 = gateChip({ id: "U2", model: "74HC02", col: 16, board: "full", spare: [], tie: [8, 9, 11, 12], taken, label: "Latch U2 (74HC02)" });
const counter = digit({ chip: "U1", display: "DS1", col: 30, ohms: 1000, board: "full", label: "Counter U1 (4026B)" });

const latched = (lab: LabView) => lab.connected("U1.1", "U2.1");

/** Since the task began (or the wire moved), each round trip of SW2 has added exactly one to the count. */
function oneEach(lab: LabView, trips: number): boolean {
  if (!latched(lab) || !lab.connected("U2.2", "SW2.a")) {
    delete lab.memory["t0"];
    return false;
  }
  const t0 = (lab.memory["t0"] ??= lab.t) as number;
  const c0 = (lab.memory["c0"] ??= count(lab, "U1") ?? 0) as number;
  const done = lab.presses("SW2", lab.t - t0 + 0.01).filter((p) => p.end != null).length;
  const c = count(lab, "U1") ?? 0;
  return done >= trips && (c - c0 + 10) % 10 === done % 10 && lab.prop("SW2")?.["to"] === "a";
}

/** The fix-it bench: the switch's a throw wired into an empty strip, so nothing ever clears the latch. */
const NO_CLEAR: SolutionStep[] = [
  { do: "unwire", wire: "W4" },
  { do: "wire", id: "W4", from: "g25", to: "c14", color: "yellow" },
];

/** Five (or three) round trips of the latch's switch. */
const trips = (n: number): SolutionStep[] =>
  Array.from({ length: n }, () => [
    { do: "flip", part: "SW2", to: "b" } as SolutionStep,
    { do: "wait", seconds: 0.3 } as SolutionStep,
    { do: "flip", part: "SW2", to: "a" } as SolutionStep,
    { do: "wait", seconds: 0.3 } as SolutionStep,
  ]).flat();

export default defineLab({
  id: "chatter",
  title: "One press, many counts",
  bench: {
    board: "full",
    frame: ["hole:j3", "hole:a46", "top+:3", "rail-:46"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      { id: "S1", kind: "pushbutton", at: "e10", params: { cap: "yellow", bounce: 5 }, locked: true, label: "Visitor button S1" },
      { id: "R1", kind: "resistor", at: "a12-rail-:12", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R1" },
      ...u2.parts,
      { id: "SW2", kind: "slide-switch", at: "h25", params: { to: "a", bounce: 5 }, locked: true, label: "Latch switch SW2" },
      { id: "R2", kind: "resistor", at: "a17-rail-:17", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R2" },
      { id: "R3", kind: "resistor", at: "a21-rail-:21", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R3" },
      ...counter.parts,
    ],
    wires: [
      ...rail.wires,
      wire("W2", "j10", "top+:10", "red"),
      // The clock wire: the button's strip to pin 1 of the counter.
      wire("W1", "c12", "b30", "yellow"),
      // The latch: pin 4 into pin 3, pin 1 into pin 5.
      wire("X1", "c18", "d19", "white"),
      wire("X2", "c20", "b16", "white"),
      // The latch's switch: pole to 5 V, a to pin 2, b to pin 6.
      wire("W3", "j26", "top+:25", "red"),
      wire("W4", "g25", "c17", "yellow"),
      wire("W5", "g27", "c21", "blue"),
      ...u2.wires,
      ...counter.wires,
    ],
    tray: [],
    instruments: [],
  },
  panels: [
    {
      kind: "timing",
      id: "td",
      channels: [
        { label: "Button", node: "S1.b1", level: 2.5 },
        { label: "Latch", node: "U2.1" },
      ],
    },
  ],
  mascot: {
    hint: "A slide switch has two throws. The latch needs both.",
    fried: "Something cooked. Buttons only stutter, they never smoke.",
  },
  tasks: [
    {
      id: "bouncy",
      prompt: "Press the button once.",
      // One press, and the count went up by two or more.
      goal: (lab) => {
        const p = lab.presses("S1", 20).at(-1);
        if (!p || p.end == null || lab.t - p.end < 0.2) return false;
        const a = countAt(lab, "U1", p.start - 0.05);
        const b = countAt(lab, "U1", p.end + 0.15);
        return a !== null && b !== null && (b - a + 10) % 10 >= 2;
      },
      hints: ["Press and let go of the yellow button."],
      highlight: ["S1"],
      success: "One press, several counts.",
    },
    {
      id: "catch-bounce",
      prompt: "Press again, then replay it in slow motion on the timing diagram.",
      goal: (lab) => {
        const tv = lab.timing("td");
        return !!tv.burst && (tv.burst.channels["Button"]?.edges.length ?? 0) >= 3 && tv.replays >= 1;
      },
      hints: ["Press the button, then the diagram's replay button."],
      highlight: ["S1"],
      success: "On, off, on, off: the contacts chatter.",
    },
    {
      id: "latch-wire",
      prompt: "Move the clock wire's end from the button's strip to the latch's **pin 1**.",
      goal: latched,
      hints: ["The yellow wire's end at the button. Pin 1 of U2, right by its notch."],
      highlight: ["W1", "U2"],
      success: "The latch drives the clock now.",
    },
    {
      id: "latch-count",
      prompt: "Flip the latch's switch on and off, five times.",
      goal: (lab) => oneEach(lab, 5),
      hints: ["On and off is one round trip: one count.", "Count your flips. Five, back to off."],
      highlight: ["SW2"],
      success: "Five flips, five counts.",
    },
    {
      id: "fix-it",
      prompt: "Make the latch count every flip.",
      setup: NO_CLEAR,
      goal: (lab) => seen(lab, "stuck", lab.heldFor(0.5, !lab.connected("U2.2", "SW2.a"), "stuck")) && oneEach(lab, 3),
      hints: ["A latch needs both throws. What clears this one?", "The yellow wire from the switch belongs in pin 2's strip."],
      highlight: ["W4"],
      success: "One flip, one count.",
    },
    {
      id: "let-go",
      prompt: "Bonus: hold the button, let go, then replay the let-go in slow motion.",
      // The latest burst starts with the button high: a release, and it chatters too. Only once the latch counts, so
      // the replay in beat 2 does not find it by chance.
      goal: (lab) => {
        const tv = lab.timing("td");
        const w = tv.burst?.channels["Button"];
        return latched(lab) && !!w && w.start && w.edges.length >= 2 && tv.replayed === tv.burst!.start;
      },
      hints: ["Hold the yellow button a moment, let go, then replay."],
      highlight: ["S1"],
      success: "Letting go chatters too.",
      bonus: true,
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "bouncy" },
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "wait", seconds: 0.3 },
    { do: "panel", id: "td", value: "replay" },
    { do: "check", task: "catch-bounce" },
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "d16", to: "b30", color: "yellow" },
    { do: "check", task: "latch-wire" },
    { do: "wait", seconds: 0.3 },
    ...trips(5),
    { do: "check", task: "latch-count" },
    // The secret: a let-go, replayed.
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.3 },
    { do: "panel", id: "td", value: "replay" },
    { do: "check", task: "let-go" },
    ...NO_CLEAR,
    { do: "wait", seconds: 0.6 },
    { do: "unwire", wire: "W4" },
    { do: "wire", id: "W4", from: "g25", to: "c17", color: "yellow" },
    { do: "wait", seconds: 0.3 },
    ...trips(3),
    { do: "check", task: "fix-it" },
  ],
});
