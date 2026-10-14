// Blueprint: docs/curriculum/unit-4.md, CH15; a bench lesson (docs/LESSONS.md):
// content/units/chips/counters/carry-the-one. One idea: a counter's carry out rises as it rolls from 9 to 0, so it can
// clock the next digit. Full board, 9.4 V. Bare chips (the plug-in digit modules do not exist yet): the tens counter U2
// (pin 1 at e4) with its display DS2 at columns 15 to 19, the ones display DS1 at 25 to 29 with its counter U1 (pin 1
// at e33) to its right, and U3, a 555 clock at e46 (10 kΩ, 68 kΩ, 1 µF, about 9.9 Hz), clocking U1. Both resets and
// inhibits sit on minus. The tens clock wire W3 starts on the minus rail; the learner moves it to the ones' carry out
// (U1 pin 5). The secret swaps the 1 µF for 0.1 µF: the ones blur, the tens tick as fast as the ones did. The fix-it
// bench puts the tens clock on the clock line.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { count, digit, seen, wire } from "./lib/chip-bench";

const tens = digit({ chip: "U2", display: "DS2", col: 4, dcol: 15, ohms: 3300, board: "full", label: "Tens counter U2 (4026B)" });
const ones = digit({ chip: "U1", display: "DS1", col: 33, dcol: 25, ohms: 3300, board: "full", label: "Ones counter U1 (4026B)" });
const carried = (lab: LabView) => lab.connected("U2.1", "U1.5");
/** Both counters are at these values now. */
const at = (lab: LabView, t: number, o: number) => count(lab, "U2") === t && count(lab, "U1") === o;

/** The fix-it bench: the tens clock wire on the clock line beside the ones'. */
const RACING: SolutionStep[] = [
  { do: "unwire", wire: "W3" },
  { do: "wire", id: "W3", from: "b4", to: "a48", color: "yellow" },
];

export default defineLab({
  id: "carry-the-one",
  title: "Carry the one",
  bench: {
    board: "full",
    frame: ["hole:j3", "hole:a52", "top+:3", "rail-:52"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...tens.parts,
      ...ones.parts,
      // The clock: U3 with pin 1 at e44.
      { id: "U3", kind: "chip", at: "e46", params: { model: "555" }, locked: true, label: "Clock U3 (555)" },
      { id: "R5", kind: "resistor", at: "top+:47-h47", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R5" },
      { id: "R6", kind: "resistor", at: "g47-g51", params: { ohms: 68_000 }, locked: true, label: "68 kΩ resistor R6" },
      { id: "C1", kind: "electrolytic-cap", at: "b47-rail-:47", params: { farads: 1e-6, volts: 16 }, label: "1 µF capacitor C1" },
      // The secret's faster capacitor waits on the shelf.
      { id: "C5", kind: "electrolytic-cap", at: "shelf", params: { farads: 0.1e-6, volts: 50 }, label: "0.1 µF capacitor C5" },
    ],
    wires: [
      wire("W1", "top+:61", "rail+:61", "red"),
      wire("W4", "top-:60", "rail-:60", "black"),
      wire("W5", "a46", "rail-:46", "black"),
      wire("W6", "j46", "top+:46", "red"),
      wire("W7", "a49", "rail+:49", "red"),
      wire("W8", "d47", "g48", "yellow"),
      wire("W9", "i48", "i51", "yellow"),
      // The clock line to the ones' pin 1; the tens' pin 1 parked on minus.
      wire("W2", "c48", "b33", "orange"),
      wire("W3", "b4", "rail-:4", "yellow"),
      ...tens.wires,
      ...ones.wires,
    ],
    tray: [],
    instruments: [],
    watch: ["U3.3"],
  },
  mascot: {
    hint: "CO is pin 5 of the ones chip, U1.",
    fried: "Something cooked. Carries should never smoke.",
  },
  tasks: [
    {
      id: "carry-in",
      prompt: "Move the yellow wire from minus to the ones' **pin 5** (carry out).",
      goal: (lab) => {
        if (!carried(lab)) return false;
        const t0 = (lab.memory["t0"] ??= lab.t) as number;
        return lab.values("count:U2", lab.t - t0 + 0.01).length >= 2;
      },
      hints: ["The yellow wire's far end sits in the minus rail. Drag it.", "Pin 5 of U1, the ones chip. Count from the notch."],
      highlight: ["W3", "U1"],
      nudges: [{ when: (lab) => lab.connected("U2.1", "U1.1"), say: "That's the ones' clock pin. Carry out is pin 5." }],
      success: "The tens step as the ones roll over.",
    },
    {
      id: "nineteen-twenty",
      prompt: "Watch the count go from 19 to 20.",
      goal: (lab) => seen(lab, "19", at(lab, 1, 9)) && at(lab, 2, 0),
      hints: ["It counts about ten a second. Wait for 19."],
      highlight: ["DS1", "DS2"],
      success: "19, then 20.",
    },
    {
      id: "roll-99",
      prompt: "Watch 99 tick over.",
      goal: (lab) => seen(lab, "99", at(lab, 9, 9)) && at(lab, 0, 0),
      hints: ["About ten seconds a lap. Keep watching."],
      highlight: ["DS1", "DS2"],
      success: "99, then 00.",
    },
    {
      id: "fix-it",
      prompt: "Make the tens count tens again.",
      setup: RACING,
      goal: (lab) => {
        const broken = seen(lab, "racing", lab.heldFor(0.6, lab.connected("U2.1", "U3.3"), "racing"));
        if (!broken || !carried(lab)) return false;
        const t0 = (lab.memory["fixed"] ??= lab.t) as number;
        return lab.values("count:U2", lab.t - t0 + 0.01).length >= 2;
      },
      hints: ["What should clock the tens?", "Move the yellow wire from the clock line to the ones' pin 5."],
      highlight: ["W3"],
      success: "The tens tick only on the carry.",
    },
    {
      id: "divide-by-ten",
      prompt: "Bonus: swap the clock's 1 µF for the 0.1 µF.",
      // About 99 Hz: the ones blur, the tens step about ten times a second.
      goal: (lab) => {
        const d = lab.duty("volts:U3.3");
        return carried(lab) && !!d && d.period < 0.02 && lab.values("count:U2", 1.2).length >= 6;
      },
      hints: ["Drop the 0.1 µF capacitor right onto C1. They swap."],
      highlight: ["C1"],
      success: "The ones blur. The tens took over their pace.",
      bonus: true,
    },
  ],
  solution: [
    { do: "unwire", wire: "W3" },
    { do: "wire", id: "W3", from: "b4", to: "a37", color: "yellow" },
    { do: "wait", seconds: 1.4 },
    { do: "check", task: "carry-in" },
    { do: "wait", seconds: 11 },
    { do: "check", task: "nineteen-twenty" },
    { do: "wait", seconds: 11 },
    { do: "check", task: "roll-99" },
    // The secret: ten times faster.
    { do: "move", part: "C5", at: "on:C1" },
    { do: "wait", seconds: 1.6 },
    // Back to 1 µF before the check: the fix-it bench starts from the bench here.
    { do: "move", part: "C1", at: "on:C5" },
    { do: "check", task: "divide-by-ten" },
    ...RACING,
    { do: "wait", seconds: 1 },
    { do: "unwire", wire: "W3" },
    { do: "wire", id: "W3", from: "b4", to: "a37", color: "yellow" },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "fix-it" },
  ],
});
