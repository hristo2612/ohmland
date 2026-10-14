// Blueprint: docs/curriculum/unit-4.md, CH16 (wave 2); a bench lesson (docs/LESSONS.md):
// content/units/chips/counters/reaction-race. One idea: block the clock and the count stops: a latch that holds the
// counter's inhibit pin high freezes it, so the digit shows only the time between GO and STOP. New: "inhibit". Full
// board, 9.4 V, the far rails joined to the near ones. Without the plug-in digit modules three digits and three 555s do
// not fit on one board, so this race counts tenths of a second on one digit (a 10 Hz clock): U1 (e5) is the get-ready
// one-shot: START (S1) dips its trigger and it runs about 3 s (270 kΩ, 10 µF); its pin 3 lights the red WAIT lamp D1
// while high and, sinking, the green GO lamp D2 while low. Its falling edge (GO) kicks U2's reset low through C3 (0.47
// µF; R5 and R6 hold that reset at 7.8 V). U2 (e21) is a latch (threshold on minus): STOP (S2) sets it, its pin 3 goes
// high. U3 (e31) is the clock: 10 kΩ, 68 kΩ, 1 µF, about 9.9 Hz. U4, a 4026B (e40) with its display DS1, counts it;
// RESET (S3) clears it. START is yellow, STOP red, RESET white; the keys card names them. The inhibit wire W9 starts on
// minus; the learner moves it to U2's pin 3. The timing parts carry no spread (exact values), so the solution's rounds
// land the same every time. The fix-it bench puts the inhibit wire on U2's pin 2, which idles high: the digit never
// moves.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { count, countAt, digit, seen, wire } from "./lib/chip-bench";

const counter = digit({ chip: "U4", display: "DS1", col: 40, ohms: 3300, board: "full", inh: false, rst: false, label: "Counter U4 (4026B)" });
const gated = (lab: LabView) => lab.connected("U4.2", "U2.3");

/** The moment the last GO came: U1's output falling after its wait. Null before any. */
function goAt(lab: LabView): number | null {
  const h = lab.history("logic:U1.3", 40);
  for (let k = h.length - 1; k > 0; k--) if (h[k - 1]![1] === 1 && h[k]![1] === 0) return h[k]![0];
  return null;
}
/** The STOP press after the last GO, or null. */
function stopAfterGo(lab: LabView) {
  const go = goAt(lab);
  if (go === null) return null;
  const p = lab.presses("S2", 40).filter((s) => s.start > go).at(-1);
  return p ? { go, stop: p.start } : null;
}
/** A round with the digit frozen for a second and a half since STOP; the count it shows. */
function frozenAt(lab: LabView): number | null {
  const r = stopAfterGo(lab);
  if (!r || lab.t - r.stop < 1.5) return null;
  return lab.values("count:U4", lab.t - r.stop - 0.2).length === 1 ? count(lab, "U4") : null;
}

/** The fix-it bench: the inhibit wire on U2's pin 2 (the trigger, held high by its pull-up) instead of pin 3. */
const ON_TRIGGER: SolutionStep[] = [
  { do: "unwire", wire: "W9" },
  { do: "wire", id: "W9", from: "a41", to: "d22", color: "white" },
];

/** One round: START, wait `wait` seconds from the press, STOP. */
const round = (wait: number): SolutionStep[] => [
  { do: "press", part: "S3", seconds: 0.3 },
  { do: "press", part: "S1", seconds: 0.3 },
  { do: "wait", seconds: wait - 0.55 },
  { do: "press", part: "S2", seconds: 0.3 },
  { do: "wait", seconds: 1.8 },
];

export default defineLab({
  id: "reaction-race",
  title: "Reaction race",
  bench: {
    board: "full",
    frame: ["hole:j3", "hole:a60", "top+:3", "rail-:60"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // U1: the get-ready one-shot, its START button and the two lamps.
      { id: "U1", kind: "chip", at: "e5", params: { model: "555" }, locked: true, label: "Get-ready timer U1 (555)" },
      { id: "R1", kind: "resistor", at: "b6-rail+:6", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R1" },
      { id: "R2", kind: "resistor", at: "top+:6-h6", params: { ohms: 270_000, tolerance: 0 }, locked: true, label: "270 kΩ resistor R2" },
      { id: "C1", kind: "electrolytic-cap", at: "g7-top-:7", params: { farads: 10e-6, volts: 16, actualFarads: 10e-6 }, locked: true, label: "10 µF capacitor C1" },
      { id: "S1", kind: "pushbutton", at: "e10", params: { cap: "yellow" }, locked: true, label: "START button S1" },
      { id: "R3", kind: "resistor", at: "c7-c14", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", at: "d14", params: { color: "red" }, locked: true, label: "WAIT lamp D1" },
      { id: "R4", kind: "resistor", at: "rail+:17-b17", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R4" },
      { id: "D2", kind: "led", at: "c17", params: { color: "green" }, locked: true, label: "GO lamp D2" },
      // U2: the STOP latch and its reset network.
      { id: "C3", kind: "ceramic-cap", at: "c19-d24", params: { farads: 0.47e-6 }, locked: true, label: "0.47 µF capacitor C3" },
      { id: "U2", kind: "chip", at: "e21", params: { model: "555" }, locked: true, label: "STOP latch U2 (555)" },
      { id: "R7", kind: "resistor", at: "b22-rail+:22", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R7" },
      { id: "R5", kind: "resistor", at: "b24-rail+:24", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R5" },
      { id: "R6", kind: "resistor", at: "a24-rail-:25", params: { ohms: 47_000 }, locked: true, label: "47 kΩ resistor R6" },
      { id: "S2", kind: "pushbutton", at: "e26", params: { cap: "red" }, locked: true, label: "STOP button S2" },
      // U3: the 10 Hz clock.
      { id: "U3", kind: "chip", at: "e31", params: { model: "555" }, locked: true, label: "Clock U3 (555)" },
      { id: "R8", kind: "resistor", at: "top+:33-h32", params: { ohms: 10_000, tolerance: 0 }, locked: true, label: "10 kΩ resistor R8" },
      { id: "R9", kind: "resistor", at: "g32-g36", params: { ohms: 68_000, tolerance: 0 }, locked: true, label: "68 kΩ resistor R9" },
      { id: "C4", kind: "electrolytic-cap", at: "b32-rail-:33", params: { farads: 1e-6, volts: 16, actualFarads: 1e-6 }, locked: true, label: "1 µF capacitor C4" },
      // U4: the counter, its reset pull-down and RESET.
      ...counter.parts,
      { id: "R10", kind: "resistor", at: "i41-top-:41", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R10" },
      { id: "S3", kind: "pushbutton", at: "e57", params: { cap: "white" }, locked: true, label: "RESET button S3" },
    ],
    wires: [
      wire("W1", "top+:61", "rail+:61", "red"),
      wire("W2", "top-:60", "rail-:60", "black"),
      // U1: supply, reset high, discharge to threshold, START, lamps.
      wire("W3", "a5", "rail-:5", "black"),
      wire("W4", "j5", "top+:5", "red"),
      wire("W5", "a8", "rail+:7", "red"),
      wire("W6", "i6", "i7", "yellow"),
      wire("W7", "c6", "c10", "green"),
      wire("W8", "a12", "rail-:12", "black"),
      wire("W10", "a15", "rail-:15", "black"),
      wire("W11", "d18", "d7", "green"),
      // GO's kick: U1's pin 3 to C3.
      wire("W12", "b7", "a19", "orange"),
      // U2: supply, threshold on minus, STOP.
      wire("W13", "a21", "rail-:21", "black"),
      wire("W14", "j21", "top+:21", "red"),
      wire("W15", "j23", "top-:23", "black"),
      wire("W16", "c22", "c26", "red"),
      wire("W17", "a28", "rail-:28", "black"),
      // U3: supply, reset high, threshold to trigger, threshold to R9; its output clocks U4.
      wire("W18", "a31", "rail-:31", "black"),
      wire("W19", "j31", "top+:31", "red"),
      wire("W20", "a34", "rail+:34", "red"),
      wire("W21", "d32", "g33", "yellow"),
      wire("W22", "i33", "i36", "yellow"),
      wire("W23", "c33", "b40", "orange"),
      // U4: the inhibit wire on minus for now; RESET to plus and the reset pin.
      wire("W9", "a41", "rail-:41", "white"),
      wire("W24", "j57", "top+:57", "red"),
      wire("W25", "h59", "h41", "blue"),
      ...counter.wires,
    ],
    tray: [],
    instruments: [],
  },
  panels: [
    {
      kind: "keys",
      id: "keys",
      buttons: [
        { part: "S1", key: "s", label: "START" },
        { part: "S2", key: " ", label: "STOP" },
        { part: "S3", key: "r", label: "RESET" },
      ],
    },
  ],
  mascot: {
    hint: "Inhibit high freezes the count. Who should hold it high?",
    fried: "Something cooked. Your fingers are fine, though.",
  },
  tasks: [
    {
      id: "no-brakes",
      prompt: "Press START, wait for green, then hit STOP.",
      goal: (lab) => {
        const r = stopAfterGo(lab);
        return !!r && lab.t - r.stop >= 0.8 && lab.values("count:U4", 0.6).length >= 2;
      },
      hints: ["START is green, STOP is red. Wait for the green lamp first."],
      highlight: ["S1", "S2"],
      success: "STOP pressed, and it keeps counting.",
    },
    {
      id: "inhibit-wire",
      prompt: "Move the white inhibit wire's end from minus to the latch's **pin 3** (U2).",
      goal: gated,
      hints: ["U2's pin 3 goes high when you hit STOP.", "The white wire's other end sits in the minus rail by the counter."],
      highlight: ["W9", "U2"],
      success: "The latch holds the gate now.",
    },
    {
      id: "frozen",
      prompt: "Race again: RESET, START, then STOP on green.",
      goal: (lab) => {
        if (!gated(lab)) return false;
        const c = frozenAt(lab);
        return c !== null && c >= 1;
      },
      hints: ["RESET first, then START.", "Hit STOP as soon as the green lamp lights."],
      highlight: ["S1", "S2", "S3"],
      success: "Frozen at your time.",
    },
    {
      id: "fix-it",
      prompt: "Make the race count again.",
      setup: ON_TRIGGER,
      goal: (lab) => {
        if (!seen(lab, "high", lab.heldFor(0.5, lab.connected("U4.2", "U2.2"), "high"))) return false;
        if (!gated(lab)) return false;
        const c = frozenAt(lab);
        return c !== null && c >= 1;
      },
      hints: ["Pin 2 sits high all the time. Which latch pin goes high on STOP?", "Move the white wire's end to pin 3, then race."],
      highlight: ["W9"],
      success: "Counting and freezing again.",
    },
    {
      id: "quick-hands",
      prompt: "Bonus: stop the digit on 1.",
      // A round that started from 0 at GO and froze on 1: STOP within about 0.1 to 0.2 s of green.
      goal: (lab) => {
        const r = stopAfterGo(lab);
        return gated(lab) && !!r && countAt(lab, "U4", r.go - 0.05) === 0 && frozenAt(lab) === 1;
      },
      hints: ["RESET, START, and pounce on the green."],
      highlight: ["S2"],
      success: "Quick hands!",
      bonus: true,
    },
  ],
  solution: [
    // A round with the inhibit still on minus: STOP does nothing to the count.
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "wait", seconds: 3.1 },
    { do: "press", part: "S2", seconds: 0.3 },
    { do: "wait", seconds: 0.9 },
    { do: "check", task: "no-brakes" },
    { do: "unwire", wire: "W9" },
    { do: "wire", id: "W9", from: "a41", to: "d23", color: "white" },
    { do: "check", task: "inhibit-wire" },
    ...round(3.3),
    { do: "check", task: "frozen" },
    // The secret: STOP about 0.12 s after green (this one-shot runs about 3.08 s: the capacitor leaks a little).
    ...round(3.2),
    { do: "check", task: "quick-hands" },
    ...ON_TRIGGER,
    { do: "wait", seconds: 0.8 },
    { do: "unwire", wire: "W9" },
    { do: "wire", id: "W9", from: "a41", to: "d23", color: "white" },
    ...round(3.3),
    { do: "check", task: "fix-it" },
  ],
});
