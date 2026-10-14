// Blueprint: docs/curriculum/unit-4.md, CH24; a bench lesson (docs/LESSONS.md):
// content/units/chips/arcade/count-in-binary. One idea: four lamps count to 15 when each is worth double the one
// before: binary. New: the binary counter chip (74HC393) and the word "binary".
// Full board, the logic rail (5 V on the far rails). U1, a CMOS 555 at e8, ticks about 0.69 Hz (10 kΩ, 100 kΩ,
// 10 µF) with its own lamp D0; slide switch SW1 holds its reset (pin 4) low until switched on. U2, a 74HC393 at e22:
// counter one's clock (pin 1) on the clock wire W1, its clear (pin 2) pulled down by R1 with RESET (S1) to 5 V, its
// outputs QA to QD on pins 3 to 6 (columns 24 to 27); counter two's clock and clear are tied to minus. Each output
// runs on a yellow wire to its own lamp (1 kΩ and a red LED, about 3 mA), in a row with the 8 on the left: the
// outputs feed nothing else, so the lamps hang on them directly. A speed slider fast-forwards a lap of 16. The
// timing diagram (the secret) replays a tick: the count changes as the clock falls. The fix-it bench puts the clock
// wire on the clear pin.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { count, logicRail, seen, went, wire } from "./lib/chip-bench";

const rail = logicRail(4, 61);
const steps16 = (lab: LabView, seconds: number) => {
  const v = lab.values("count:U2", seconds);
  let n = 0;
  for (let k = 1; k < v.length; k++) if (v[k] === (v[k - 1]! + 1) % 16) n++;
  return n;
};
const on = (lab: LabView) => lab.prop("SW1")?.["to"] === "b";

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
const lamps = [lamp("D4", "R14", 31, "Lamp D4 (left)"), lamp("D3", "R13", 36, "Lamp D3"), lamp("D2", "R12", 41, "Lamp D2"), lamp("D1", "R11", 46, "Lamp D1 (right)")];

/** The fix-it bench: the clock wire in the clear pin's strip. */
const ON_CLEAR: SolutionStep[] = [
  { do: "unwire", wire: "W1" },
  { do: "wire", id: "W1", from: "a10", to: "d23", color: "orange" },
];

export default defineLab({
  id: "count-in-binary",
  title: "Count in lamps",
  bench: {
    board: "full",
    frame: ["hole:j3", "hole:a52", "top+:3", "rail-:52"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      // The clock: a CMOS 555 at e8.
      { id: "U1", kind: "chip", at: "e8", params: { model: "555-cmos" }, locked: true, label: "Clock U1 (CMOS 555)" },
      { id: "R5", kind: "resistor", at: "top+:9-h9", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R5" },
      { id: "R6", kind: "resistor", at: "g9-g13", params: { ohms: 100_000 }, locked: true, label: "100 kΩ resistor R6" },
      { id: "C1", kind: "electrolytic-cap", at: "b9-rail-:9", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor C1" },
      { id: "R7", kind: "resistor", at: "b10-b12", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R7" },
      { id: "D0", kind: "led", at: "c12", params: { color: "yellow" }, locked: true, label: "Clock lamp D0" },
      { id: "SW1", kind: "slide-switch", at: "h18", params: { to: "a" }, locked: true, label: "Clock switch SW1" },
      { id: "S1", kind: "pushbutton", at: "e14", params: { cap: "red" }, locked: true, label: "RESET button S1" },
      { id: "R1", kind: "resistor", at: "a23-rail-:23", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R1" },
      { id: "U2", kind: "chip", at: "e22", params: { model: "74HC393" }, locked: true, label: "Counter U2 (74HC393)" },
      ...lamps.flatMap((l) => l.parts),
    ],
    wires: [
      ...rail.wires,
      // The clock's supply, threshold to trigger, its lamp.
      wire("W2", "j8", "top+:7", "red"),
      wire("W3", "a8", "rail-:7", "black"),
      wire("W4", "d9", "g10", "yellow"),
      wire("W5", "i10", "i13", "yellow"),
      wire("W6", "a13", "rail-:13", "black"),
      // The clock switch: off holds reset (pin 4) low, on lets it run.
      wire("W7", "j18", "top-:18", "black"),
      wire("W8", "j20", "top+:21", "red"),
      wire("W9", "g19", "c11", "green"),
      // The counter: supply, counter two tied off, RESET to the clear pin.
      wire("W10", "j22", "top+:22", "red"),
      wire("W11", "a28", "rail-:28", "black"),
      wire("W12", "j23", "top-:23", "black"),
      wire("W13", "j24", "top-:24", "black"),
      wire("W14", "j14", "top+:13", "red"),
      wire("W15", "c16", "c23", "red"),
      // The clock wire, and the four outputs to their lamps (QD to the left lamp, QA to the right).
      wire("W1", "a10", "b22", "orange"),
      wire("Q4", "d27", "d31", "yellow"),
      wire("Q3", "c26", "d36", "yellow"),
      wire("Q2", "b25", "d41", "yellow"),
      wire("Q1", "a24", "d46", "yellow"),
      ...lamps.map((l) => l.wire),
    ],
    tray: [],
    instruments: [],
    controls: [{ id: "speed", label: "Speed", key: "speed", min: 1, max: 8, value: 1, step: 1, unit: "×" }],
  },
  panels: [
    {
      kind: "tags",
      id: "worth",
      show: ["worth"],
      title: "Worth",
      items: [
        { id: "D4", label: "Left lamp" },
        { id: "D3", label: "Second lamp" },
        { id: "D2", label: "Third lamp" },
        { id: "D1", label: "Right lamp" },
      ],
      options: [
        { id: "1", label: "1" },
        { id: "2", label: "2" },
        { id: "4", label: "4" },
        { id: "8", label: "8" },
      ],
      answer: { D4: "8", D3: "4", D2: "2", D1: "1" },
    },
    {
      kind: "timing",
      id: "td",
      show: ["on-the-fall"],
      title: "One tick",
      channels: [
        { label: "Clock", node: "U2.1" },
        { label: "Right lamp", node: "U2.3" },
        { label: "Third lamp", node: "U2.4" },
      ],
    },
  ],
  mascot: {
    hint: "Add up the worths of the lit lamps.",
    fried: "Something cooked. Lamps count, chips relax.",
  },
  tasks: [
    {
      id: "count-on",
      prompt: "Switch on the clock (SW1).",
      goal: (lab) => on(lab) && steps16(lab, 30) >= 3,
      hints: ["Slide SW1 toward its red wire."],
      highlight: ["SW1"],
      success: "The lamps start counting.",
    },
    {
      id: "after-two",
      prompt: "Watch the right two lamps.",
      goal: (lab) => {
        const t0 = (lab.memory["t0"] ??= lab.t) as number;
        return went(lab, "U2", 2, 3, lab.t - t0 + 0.01);
      },
      hints: ["Wait for the third lamp alone, then one more tick."],
      highlight: ["D1", "D2"],
      success: "Both of them: 1 and 2 make 3.",
    },
    {
      id: "worth",
      prompt: "Tag each lamp with its worth.",
      goal: (lab) => lab.panel("worth").correct,
      hints: ["The right lamp changes fastest. It is worth 1.", "Each lamp to the left is worth double."],
      highlight: ["D1", "D2", "D3", "D4"],
      success: "1, 2, 4, 8 from the right.",
    },
    {
      id: "roll-over",
      prompt: "Watch all four lamps light, then the next tick. The speed slider helps.",
      goal: (lab) => {
        const t0 = (lab.memory["t0"] ??= lab.t) as number;
        return went(lab, "U2", 15, 0, lab.t - t0 + 0.01);
      },
      hints: ["Slide the speed up and watch for all four."],
      highlight: ["D1", "D2", "D3", "D4"],
      success: "15 rolls over to 0.",
    },
    {
      id: "fix-it",
      prompt: "Make the counter count up again.",
      setup: ON_CLEAR,
      goal: (lab) => {
        if (!seen(lab, "clear", lab.heldFor(0.5, lab.connected("U1.3", "U2.2"), "clear"))) return false;
        if (!lab.connected("U1.3", "U2.1") || lab.connected("U1.3", "U2.2")) return false;
        const t0 = (lab.memory["fixed"] ??= lab.t) as number;
        return steps16(lab, lab.t - t0 + 0.01) >= 2;
      },
      hints: ["Pin 2 clears. Which pin clocks?", "Move the orange wire's end to pin 1's strip."],
      highlight: ["W1"],
      success: "Pin 1 clocks counter one.",
    },
    {
      id: "on-the-fall",
      prompt: "Bonus: replay one tick in slow motion.",
      // The latest burst begins with the clock falling, then the count moves.
      goal: (lab) => {
        const tv = lab.timing("td");
        const c = tv.burst?.channels["Clock"];
        return !!c && c.edges.length > 0 && c.edges[0]![1] === 0 && tv.replayed === tv.burst!.start;
      },
      hints: ["Wait for a tick, then press the replay button."],
      highlight: ["U2"],
      success: "It steps as the clock falls.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "SW1", to: "b" },
    { do: "wait", seconds: 5 },
    { do: "check", task: "count-on" },
    { do: "control", id: "speed", value: 8 },
    { do: "wait", seconds: 3 },
    { do: "check", task: "after-two" },
    { do: "control", id: "speed", value: 1 },
    { do: "panel", id: "worth", value: { D4: "8", D3: "4", D2: "2", D1: "1" } },
    { do: "check", task: "worth" },
    { do: "control", id: "speed", value: 8 },
    { do: "wait", seconds: 3.2 },
    { do: "check", task: "roll-over" },
    { do: "control", id: "speed", value: 1 },
    // The secret: a tick, replayed.
    { do: "wait", seconds: 1.6 },
    { do: "panel", id: "td", value: "replay" },
    { do: "check", task: "on-the-fall" },
    ...ON_CLEAR,
    { do: "wait", seconds: 2 },
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "a10", to: "b22", color: "orange" },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "fix-it" },
  ],
});
