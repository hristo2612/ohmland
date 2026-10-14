// Blueprint: docs/curriculum/unit-4.md, CH25; a bench lesson (docs/LESSONS.md): content/units/chips/arcade/roll-a-six.
// One idea: wire a pattern back to the clear pin and the counter starts over the moment it reaches that number, so
// it counts from 0 to one less. Nothing new to name.
// Full board, the logic rail. CH24's clock (a CMOS 555 at e8, about 0.69 Hz, always on here) and its 74HC393 (U2 at
// e22) with four lamps in a row (8 on the left), hung straight on the outputs. The clear pin (2) keeps its pull-down
// R1 and a free jumper W20 parked in an empty strip. U4, a 74HC08 at e14, offers gate 1 (pins 1 and 2 in, 3 out) with
// its other gates tied off. The learner jumpers QD, then QC, to clear, then wires QC and QB into the AND and its
// answer to clear: 0 to 5. The timing diagram replays the clear: the 6 lives for nanoseconds. The fix-it bench feeds
// the AND from QA instead of QB (counts 0 to 4). Departure from the blueprint: the lamps hang on the 393's outputs
// although QB to QD also feed the clear; a lamp's 3 mA moves a 74HC output about 0.15 V, nowhere near a threshold.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { gateChip, logicRail, seen, wire } from "./lib/chip-bench";

const rail = logicRail(4, 61);
const u4 = gateChip({ id: "U4", model: "74HC08", col: 14, board: "full", spare: [2, 3, 4], taken: ["top-:5", "top+:6", "top+:7", "top+:9", "top+:12", "top+:22", "top-:23", "top-:24"], label: "AND chip U4 (74HC08)" });

/** One lamp: a 1 kΩ from column `col` to `col + 3`, then a red LED (anode `col + 3`) whose cathode goes to minus. */
function lamp(id: string, r: string, col: number, label: string) {
  return {
    parts: [
      { id: r, kind: "resistor" as const, at: `b${col}-b${col + 3}`, params: { ohms: 1000 }, locked: true, label: `1 kΩ resistor ${r}` },
      { id, kind: "led" as const, at: `c${col + 3}`, params: { color: "red" as const }, locked: true, label },
    ],
    wire: wire(`K${id}`, `a${col + 4}`, `rail-:${col + 4 === 50 ? 49 : col + 4}`, "black"),
  };
}
const lamps = [lamp("D4", "R14", 31, "Lamp 8 (D4)"), lamp("D3", "R13", 36, "Lamp 4 (D3)"), lamp("D2", "R12", 41, "Lamp 2 (D2)"), lamp("D1", "R11", 46, "Lamp 1 (D1)")];

/** Since `key` was first true, the counter has made at least `n` steps and never shown `top` or more. */
function below(lab: LabView, key: string, cond: boolean, top: number, n: number): boolean {
  if (!cond) {
    delete lab.memory[key];
    return false;
  }
  const t0 = (lab.memory[key] ??= lab.t) as number;
  const v = lab.values("count:U2", lab.t - t0 + 0.01);
  return v.length >= n && v.every((c) => c < top) && v.includes(top - 1);
}
const andOf = (lab: LabView, a: string, b: string) =>
  ((lab.connected(a, "U4.1") && lab.connected(b, "U4.2")) || (lab.connected(a, "U4.2") && lab.connected(b, "U4.1"))) && lab.connected("U4.3", "U2.2");

/** The fix-it bench: the AND's second input on QA (lamp 1) instead of QB (lamp 2). */
const FIVE: SolutionStep[] = [
  { do: "unwire", wire: "A2" },
  { do: "wire", id: "A2", from: "c24", to: "c15", color: "blue" },
];

export default defineLab({
  id: "roll-a-six",
  title: "Stop at six",
  bench: {
    board: "full",
    frame: ["hole:j3", "hole:a52", "top+:3", "rail-:52"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      { id: "U1", kind: "chip", at: "e8", params: { model: "555-cmos" }, locked: true, label: "Clock U1 (CMOS 555)" },
      { id: "R5", kind: "resistor", at: "top+:9-h9", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R5" },
      { id: "R6", kind: "resistor", at: "g9-g13", params: { ohms: 100_000 }, locked: true, label: "100 kΩ resistor R6" },
      { id: "C1", kind: "electrolytic-cap", at: "b9-rail-:9", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor C1" },
      { id: "R7", kind: "resistor", at: "b10-b12", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R7" },
      { id: "D0", kind: "led", at: "c12", params: { color: "yellow" }, locked: true, label: "Clock lamp D0" },
      ...u4.parts,
      { id: "R1", kind: "resistor", at: "a23-rail-:23", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R1" },
      { id: "U2", kind: "chip", at: "e22", params: { model: "74HC393" }, locked: true, label: "Counter U2 (74HC393)" },
      ...lamps.flatMap((l) => l.parts),
    ],
    wires: [
      ...rail.wires,
      wire("W2", "j8", "top+:7", "red"),
      wire("W3", "a8", "rail-:7", "black"),
      wire("W4", "d9", "g10", "yellow"),
      wire("W5", "i10", "i13", "yellow"),
      wire("W6", "a13", "rail-:13", "black"),
      // The clock's reset (pin 4) held high: it always runs here.
      wire("W7", "d11", "top+:12", "red"),
      wire("W10", "j22", "top+:22", "red"),
      wire("W11", "a28", "rail-:28", "black"),
      wire("W12", "j23", "top-:23", "black"),
      wire("W13", "j24", "top-:24", "black"),
      wire("W1", "a10", "b22", "orange"),
      wire("Q4", "d27", "d31", "yellow"),
      wire("Q3", "c26", "d36", "yellow"),
      wire("Q2", "b25", "d41", "yellow"),
      wire("Q1", "a24", "d46", "yellow"),
      // The free jumper: one end in the clear pin's strip, the other parked in an empty strip.
      wire("W20", "c23", "c21", "white"),
      ...lamps.map((l) => l.wire),
      ...u4.wires,
    ],
    tray: [],
    instruments: [],
    controls: [{ id: "speed", label: "Speed", key: "speed", min: 1, max: 8, value: 1, step: 1, unit: "×" }],
  },
  panels: [
    {
      kind: "timing",
      id: "td",
      show: ["glitch"],
      title: "At the clear",
      channels: [
        // The clock and lamp 1 change on every tick: left out of burst finding, so a burst is a carry or a clear.
        { label: "Clock", node: "U2.1", burst: false },
        { label: "Lamp 1", node: "U2.3", burst: false },
        { label: "Lamp 2", node: "U2.4" },
        { label: "Lamp 4", node: "U2.5" },
        { label: "Clear", node: "U2.2" },
      ],
    },
  ],
  mascot: {
    hint: "Which lamps are lit at the count you want to skip?",
    fried: "Something cooked. Dice should never smoke.",
  },
  tasks: [
    {
      id: "stop-at-8",
      prompt: "Jumper lamp 8's pin (QD, pin 6) to the clear pin (pin 2).",
      goal: (lab) => below(lab, "t8", lab.connected("U2.6", "U2.2"), 8, 9),
      hints: ["Move the white jumper's loose end into pin 6's strip.", "Then watch, or speed it up: it never reaches 8."],
      highlight: ["W20"],
      success: "0 to 7, then 0.",
    },
    {
      id: "stop-at-4",
      prompt: "Now move it to lamp 4's pin (QC, pin 5).",
      goal: (lab) => below(lab, "t4", lab.connected("U2.5", "U2.2") && !lab.connected("U2.6", "U2.2"), 4, 5),
      hints: ["Pin 5 is next door to pin 6."],
      highlight: ["W20"],
      success: "0 to 3, then 0.",
    },
    {
      id: "stop-at-6",
      prompt: "Wire lamp 4's pin and lamp 2's pin into the AND (pins 1 and 2), and its answer (pin 3) to clear.",
      goal: (lab) => below(lab, "t6", andOf(lab, "U2.5", "U2.4") && !lab.connected("U2.5", "U2.2"), 6, 7),
      hints: ["QC is pin 5, QB pin 4. Their strips are the yellow wires' starts.", "Then move the white jumper from QC to the AND's pin 3."],
      highlight: ["U4", "W20"],
      success: "0 to 5. Six faces.",
    },
    {
      id: "fix-it",
      prompt: "Give the die all six faces.",
      setup: FIVE,
      goal: (lab) => seen(lab, "five", lab.heldFor(0.5, andOf(lab, "U2.5", "U2.3"), "five")) && below(lab, "t6", andOf(lab, "U2.5", "U2.4"), 6, 7),
      hints: ["4 + 1 is 5. Six is 4 + 2.", "Move the blue wire from lamp 1's pin to lamp 2's."],
      highlight: ["A2"],
      success: "Six faces again.",
    },
    {
      id: "glitch",
      prompt: "Bonus: replay a clear in slow motion.",
      // Remembers every burst with a glitch in it (a clear); done once one of them is replayed.
      goal: (lab) => {
        const tv = lab.timing("td");
        const seenAt = (lab.memory["g"] ??= []) as number[];
        if (tv.burst && tv.burst.glitches.length > 0 && !seenAt.includes(tv.burst.start)) seenAt.push(tv.burst.start);
        return tv.replayed !== null && seenAt.includes(tv.replayed);
      },
      hints: ["Wait for the count to jump from 5 to 0, then replay."],
      highlight: ["U2"],
      success: "A 6 for a few nanoseconds.",
      bonus: true,
    },
  ],
  solution: [
    { do: "control", id: "speed", value: 8 },
    { do: "unwire", wire: "W20" },
    { do: "wire", id: "W20", from: "c23", to: "a27", color: "white" },
    { do: "wait", seconds: 2.6 },
    { do: "check", task: "stop-at-8" },
    { do: "unwire", wire: "W20" },
    { do: "wire", id: "W20", from: "c23", to: "a26", color: "white" },
    { do: "wait", seconds: 1.8 },
    { do: "check", task: "stop-at-4" },
    { do: "wire", id: "A1", from: "b26", to: "d14", color: "blue" },
    { do: "wire", id: "A2", from: "c25", to: "c15", color: "blue" },
    { do: "unwire", wire: "W20" },
    { do: "wire", id: "W20", from: "c23", to: "d16", color: "white" },
    { do: "wait", seconds: 2.4 },
    { do: "check", task: "stop-at-6" },
    // The secret: a clear, replayed (at real speed a clear comes every 8.7 s; replay every second for a while).
    { do: "control", id: "speed", value: 1 },
    ...Array.from({ length: 10 }, () => [{ do: "wait", seconds: 0.75 } as SolutionStep, { do: "panel", id: "td", value: "replay" } as SolutionStep]).flat(),
    { do: "check", task: "glitch" },
    ...FIVE,
    { do: "control", id: "speed", value: 8 },
    { do: "wait", seconds: 1.5 },
    { do: "unwire", wire: "A2" },
    { do: "wire", id: "A2", from: "c25", to: "c15", color: "blue" },
    { do: "wait", seconds: 2.4 },
    { do: "check", task: "fix-it" },
  ],
});
