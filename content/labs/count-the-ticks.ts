// Blueprint: docs/curriculum/unit-4.md, CH14; a bench lesson (docs/LESSONS.md):
// content/units/chips/counters/count-the-ticks. One idea: a counter steps once per rising edge on its clock pin, and a
// steady blinker makes a clock.
// Full board, 9.4 V, the far rails joined to the near ones at the right end. Left: U2, a 555 blinker (10 kΩ, 68 kΩ,
// 10 µF, about 0.99 Hz) with a red lamp on pin 3. S1 "TAP" joins plus to the tap strip (column 17), which R4 pulls
// down; the yellow clock wire W2 runs from the tap strip to U1's pin 1. U1, a 4026B, drives display DS1 (3.3 kΩ a bar
// on its carrier, about 2 mA). Its reset (pin 15) has R1 pulling it down and S2 "RESET" to plus. The learner taps,
// holds, then moves the clock wire onto the blinker's pin 3. The secret swaps the 10 µF for 0.1 µF (about 99 Hz:
// every bar looks lit). The fix-it bench adds a jumper from pin 15 to plus: stuck at 0.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { count, countAt, digit, seen, stepsUp, went, wire } from "./lib/chip-bench";

const counter = digit({ chip: "U1", display: "DS1", col: 27, ohms: 3300, board: "full", rst: false, label: "Counter U1 (4026B)" });
const clocked = (lab: LabView) => lab.connected("U2.3", "U1.1");

/** The fix-it bench: a jumper holds reset (pin 15) high. */
const STUCK: SolutionStep[] = [{ do: "wire", id: "W9", from: "j28", to: "top+:28", color: "red" }];

export default defineLab({
  id: "count-the-ticks",
  title: "One tick, one step",
  bench: {
    board: "full",
    frame: ["hole:j4", "hole:a43", "top+:4", "rail-:43"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // The blinker: U2 with pin 1 at e5.
      { id: "U2", kind: "chip", at: "e5", params: { model: "555" }, locked: true, label: "Blinker U2 (555)" },
      { id: "R5", kind: "resistor", at: "top+:6-h6", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R5" },
      { id: "R6", kind: "resistor", at: "g6-g10", params: { ohms: 68_000 }, locked: true, label: "68 kΩ resistor R6" },
      { id: "C1", kind: "electrolytic-cap", at: "b6-rail-:6", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor C1" },
      { id: "R3", kind: "resistor", at: "c7-c11", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", at: "d11", params: { color: "red" }, locked: true, label: "Blinker lamp D1" },
      // The TAP button and its pull-down.
      { id: "S1", kind: "pushbutton", at: "e15", params: { cap: "yellow" }, locked: true, label: "TAP button S1" },
      { id: "R4", kind: "resistor", at: "b17-rail-:18", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R4" },
      // RESET: S2 to plus, R1 pulling pin 15 down.
      { id: "S2", kind: "pushbutton", at: "e21", params: { cap: "red" }, locked: true, label: "RESET button S2" },
      { id: "R1", kind: "resistor", at: "i28-top-:29", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R1" },
      ...counter.parts,
    ],
    wires: [
      wire("W1", "top+:61", "rail+:61", "red"),
      wire("W3", "top-:60", "rail-:60", "black"),
      // The blinker's supply, reset, trigger to threshold, threshold to R6, lamp to minus.
      wire("W4", "a5", "rail-:5", "black"),
      wire("W5", "j5", "top+:5", "red"),
      wire("W6", "a8", "rail+:9", "red"),
      wire("W7", "d6", "g7", "yellow"),
      wire("W8", "i7", "i10", "yellow"),
      wire("W10", "a12", "rail-:12", "black"),
      // TAP to plus; RESET to plus and to pin 15.
      wire("W11", "a15", "rail+:15", "red"),
      wire("W12", "j21", "top+:21", "red"),
      wire("W13", "h23", "h28", "orange"),
      // The clock wire: from the tap strip to pin 1.
      wire("W2", "c17", "b27", "yellow"),
      ...counter.wires,
    ],
    tray: [{ id: "C5", kind: "electrolytic-cap", params: { farads: 0.1e-6, volts: 50 }, count: 1, label: "0.1 µF capacitor" }],
    instruments: [],
    watch: ["U2.3"],
  },
  mascot: {
    hint: "Pin 1 is the clock input. Count from the notch.",
    fried: "Something cooked. Counters are patient, but not that patient.",
  },
  tasks: [
    {
      id: "tap-count",
      prompt: "Tap **S1** a few times.",
      goal: (lab) => lab.presses("S1", 30).length >= 3 && stepsUp(lab, "U1", 30) >= 3,
      hints: ["Press and let go, three times."],
      highlight: ["S1"],
      success: "One tap, one step.",
    },
    {
      id: "hold-once",
      prompt: "Hold **S1** down for a couple of seconds.",
      // One step as the button goes down, then nothing for two seconds of holding.
      goal: (lab) => {
        const sp = lab.presses("S1", 30).at(-1);
        if (!sp || (sp.end ?? lab.t) - sp.start < 2) return false;
        const before = countAt(lab, "U1", sp.start - 0.05);
        const after = countAt(lab, "U1", sp.start + 0.3);
        const held = lab.history("count:U1", 30).filter(([t]) => t >= sp.start + 0.3 && t <= sp.start + 2);
        return before !== null && after === (before + 1) % 10 && held.length > 0 && held.every(([, v]) => v === after);
      },
      hints: ["Press S1 and keep it down. Count to three."],
      highlight: ["S1"],
      success: "One step, however long the hold.",
    },
    {
      id: "clock-in",
      prompt: "Move the yellow clock wire from the tap strip to the blinker's **pin 3**.",
      goal: (lab) => clocked(lab) && lab.heldFor(2.2, clocked(lab), "on") && stepsUp(lab, "U1", 2.5) >= 2,
      hints: ["Drag the end in the button's strip to the strip of U2's pin 3.", "Pin 3 is the blinker's output. Its strip holds the lamp's resistor."],
      highlight: ["W2", "U2"],
      nudges: [{ when: (lab) => lab.connected("W2.a", "U2.2"), say: "That's pin 2. Pin 3 is one over." }],
      success: "A step with every flash.",
    },
    {
      id: "roll-nine",
      prompt: "Watch the count pass 9.",
      goal: (lab) => {
        const t0 = (lab.memory["t0"] ??= lab.t) as number;
        return went(lab, "U1", 9, 0, lab.t - t0 + 0.01);
      },
      hints: ["About one step a second. Wait for 9."],
      highlight: ["DS1"],
      success: "9 rolls over to 0.",
    },
    {
      id: "reset-zero",
      prompt: "Hold **RESET** (S2).",
      goal: (lab) => lab.heldFor(1, lab.closed("S2") && count(lab, "U1") === 0),
      hints: ["Keep the red button down for a second."],
      highlight: ["S2"],
      success: "Back to 0, and it stays there.",
    },
    {
      id: "fix-it",
      prompt: "Make the counter count again.",
      setup: STUCK,
      goal: (lab) => {
        const broken = seen(lab, "stuck", lab.heldFor(0.6, lab.logic("U1.15") === "H" && !lab.closed("S2"), "high"));
        if (broken && lab.logic("U1.15") === "L") lab.memory["freed"] ??= lab.t;
        const freed = lab.memory["freed"] as number | undefined;
        return broken && freed !== undefined && lab.logic("U1.15") === "L" && lab.values("count:U1", lab.t - freed + 0.01).length >= 2;
      },
      hints: ["What holds reset high?", "Pull out the red jumper on pin 15's strip."],
      highlight: ["W9"],
      success: "Counting again.",
    },
    {
      id: "blur",
      prompt: "Bonus: swap the blinker's 10 µF for the 0.1 µF.",
      // About 99 Hz: every bar is lit part of the time, so the display looks like an 8.
      goal: (lab) => {
        const d = lab.duty("volts:U2.3");
        const x = lab.part("DS1")?.extra ?? {};
        return !!d && d.period < 0.02 && ["a", "b", "c", "d", "e", "f", "g"].every((s) => Number(x[s] ?? 0) > 0.15);
      },
      hints: ["Drop the 0.1 µF capacitor right onto C1. They swap."],
      highlight: ["C1"],
      success: "Too fast to read.",
      bonus: true,
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "check", task: "tap-count" },
    { do: "press", part: "S1", seconds: 2.5 },
    { do: "check", task: "hold-once" },
    { do: "unwire", wire: "W2" },
    { do: "wire", id: "W2", from: "b7", to: "b27", color: "yellow" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "clock-in" },
    { do: "wait", seconds: 10.5 },
    { do: "check", task: "roll-nine" },
    { do: "set", part: "S2", key: "pressed", value: true },
    { do: "wait", seconds: 1.4 },
    { do: "set", part: "S2", key: "pressed", value: false },
    { do: "check", task: "reset-zero" },
    // The secret: a hundred times faster.
    { do: "place", part: "C5", kind: "electrolytic-cap", at: "on:C1", params: { farads: 0.1e-6, volts: 50 } },
    { do: "wait", seconds: 1.5 },
    // Back to 10 µF before the check: the fix-it bench starts from the bench here.
    { do: "place", part: "C1", kind: "electrolytic-cap", at: "on:C5", params: { farads: 10e-6, volts: 16 } },
    { do: "check", task: "blur" },
    ...STUCK,
    { do: "wait", seconds: 1 },
    { do: "unwire", wire: "W9" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "fix-it" },
  ],
});
