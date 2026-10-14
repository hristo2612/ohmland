// Blueprint: docs/curriculum/unit-4.md, CH7. A bench lesson (docs/LESSONS.md):
// content/units/chips/alarm/blink-forever. One idea: join pin 2 to the capacitor and the 555 triggers itself every
// time it empties: it blinks forever. New: the word "astable".
//
// The alarm module's astable layout (content/labs/meet-the-chips.ts has it): R1 10 kΩ, R2 68 kΩ and C1 10 µF, the
// capacitor on the near side of column 20, joined across the channel to pin 6. Pin 2's jumper W4 starts parked on the
// plus rail; the learner moves its end onto the capacitor's strip. The scope watches pin 6 against the 1/3 and 2/3
// lines. The tray holds C3, 22 µF, to drop onto C1.
//
// Measured in the simulator: a period of 1.03 s (0.97 Hz; 1.44 ÷ (146 kΩ × 10 µF) is 0.99 Hz, this C1 is a little
// over 10 µF), high 0.56 s and low 0.48 s, the capacitor swinging between 3.1 and 6.3 V; 22 µF blinks 2.1 times
// slower; the first flash after switch-on is longer (0.88 s, from empty). In the fix-it the jumper across the channel
// has slipped three strips: pin 6 no longer sees the capacitor, the trigger holds the latch set and the lamp glows
// without a blink. Parked back on plus (the secret), it finishes its flash and rests.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { actual } from "./lib/timer555";

const astable = (lab: LabView) => lab.connected("U1.2", "U1.6");
/** Mean seconds between flashes over the last `seconds`, or null. */
const period = (lab: LabView, seconds = 6) => {
  const p = lab.periods("glow:D1", 0.3, seconds);
  return p.length ? p.reduce((a, b) => a + b, 0) / p.length : null;
};
/** The capacitor between pin 6's node and minus. */
const timing = (lab: LabView, c: string) => lab.joins(c, "U1.6", "B1.neg");

/**
 * The fix-it bench: the 10 µF back in, and the short jumper across the channel slipped to column 23, so pin 6 and the
 * capacitor part.
 */
const SLIPPED: SolutionStep[] = [
  { do: "move", part: "C1", at: "on:C3" },
  { do: "unwire", wire: "W7" },
  { do: "wire", id: "W7", from: "f20", to: "e23", color: "yellow" },
];

export default defineLab({
  id: "blink-forever",
  title: "It never rests",
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R1", kind: "resistor", at: "h15-h10", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "R2", kind: "resistor", at: "g15-g20", params: { ohms: 68_000 }, locked: true, label: "68 kΩ resistor R2" },
      { id: "C1", kind: "electrolytic-cap", at: "b20-rail-:20", params: { farads: 10e-6, volts: 16 }, label: "10 µF capacitor C1" },
      { id: "R3", kind: "resistor", at: "c16-c12", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", holes: { anode: "b12", cathode: "b11" }, params: { color: "red", maxmA: 20 }, locked: true, label: "Red LED" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a14", to: "rail-:14", color: "black" },
      { id: "W2", from: "j14", to: "top+:14", color: "red" },
      { id: "W3", from: "a17", to: "rail+:17", color: "red" },
      { id: "W4", from: "d15", to: "rail+:15", color: "yellow" },
      { id: "W5", from: "a11", to: "rail-:11", color: "black" },
      { id: "W6", from: "i16", to: "i20", color: "yellow" },
      { id: "W7", from: "f20", to: "e20", color: "yellow" },
      { id: "W9", from: "j10", to: "top+:10", color: "red" },
    ],
    tray: [{ id: "C3", kind: "electrolytic-cap", params: { farads: 22e-6, volts: 16 }, count: 1, label: "22 µF capacitor" }],
    instruments: [
      {
        kind: "scope",
        traces: [{ label: "Pin 6", volts: "U1.6" }],
        levels: [
          { of: "U1.8", fraction: 1 / 3, label: "1/3" },
          { of: "U1.8", fraction: 2 / 3, label: "2/3" },
        ],
        window: 4,
        range: [0, 10],
      },
    ],
    watch: ["U1.3"],
  },
  mascot: {
    hint: "Pin 2 must sit on the capacitor's strip.",
    fried: "That shouldn't happen here. Fresh chip in.",
  },
  tasks: [
    {
      id: "blink-forever",
      prompt: "Move pin 2's jumper from the plus rail onto the capacitor's strip.",
      goal: (lab) => astable(lab) && lab.periods("glow:D1", 0.3, 4).length >= 2,
      hints: ["Drag the yellow jumper's end off the plus rail.", "Drop it in column 20, where the capacitor stands."],
      highlight: ["wire:W4"],
      success: "It blinks by itself!",
    },
    {
      id: "swing",
      prompt: "Watch the capacitor on the scope.",
      goal: (lab) => {
        const s = lab.stats("volts:U1.6", 4);
        return astable(lab) && !!s && s.min >= 2.8 && s.min <= 3.5 && s.max >= 5.9 && s.max <= 6.6;
      },
      hints: ["Watch the trace bounce between the two dashed lines."],
      success: "Up to two thirds, down to one third, again and again.",
    },
    {
      id: "bigger-c",
      prompt: "Drop the 22 µF onto the 10 µF.",
      goal: (lab) => {
        const p = period(lab, 10);
        const want = Math.LN2 * (actual(lab, "R1") + 2 * actual(lab, "R2")) * actual(lab, "C3");
        return timing(lab, "C3") && !timing(lab, "C1") && p !== null && lab.periods("glow:D1", 0.3, 10).length >= 2 && Math.abs(p - want) <= 0.15 * want;
      },
      hints: ["Drag the 22 µF from the tray right onto the 10 µF. They swap."],
      highlight: ["C1"],
      success: "Half as fast. Bigger C, slower blink.",
    },
    {
      id: "fix-slipped",
      prompt: "Make the lamp blink again.",
      setup: SLIPPED,
      goal: (lab) => {
        // Broken first (the setup), then flashes counted only since the last moment it was broken.
        if (!astable(lab)) lab.memory["brokeAt"] = lab.t;
        const at = lab.memory["brokeAt"] as number | undefined;
        if (at === undefined || !astable(lab)) return false;
        const p = lab.periods("glow:D1", 0.3, lab.t - at);
        return p.length >= 2 && p.slice(-2).every((x) => x > 0.6 && x < 1.6);
      },
      hints: ["Follow pin 6 to the capacitor. Where does the path break?", "The short jumper across the gap missed column 20. Move its end back."],
      highlight: ["wire:W7"],
      success: "Blinking. Pin 6 sees the capacitor again.",
    },
    {
      id: "rest",
      prompt: "Park pin 2's jumper back on the plus rail.",
      goal: (lab) => {
        if (astable(lab)) lab.memory["was"] = true;
        return lab.memory["was"] === true && !astable(lab) && lab.connected("U1.2", "B1.pos") && lab.heldFor(2, (lab.part("D1")?.glow ?? 1) < 0.05);
      },
      hints: ["Drag the yellow jumper's end from the capacitor's strip back to the plus rail."],
      success: "It finished its blink, then rested.",
      bonus: true,
    },
  ],
  solution: [
    { do: "unwire", wire: "W4" },
    { do: "wire", id: "W4", from: "d15", to: "d20", color: "yellow" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "blink-forever" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "swing" },
    { do: "place", part: "C3", kind: "electrolytic-cap", at: "on:C1", params: { farads: 22e-6, volts: 16 } },
    { do: "wait", seconds: 8 },
    { do: "check", task: "bigger-c" },
    ...SLIPPED,
    { do: "wait", seconds: 1 },
    { do: "unwire", wire: "W7" },
    { do: "wire", id: "W7", from: "f20", to: "e20", color: "yellow" },
    { do: "wait", seconds: 7 },
    { do: "check", task: "fix-slipped" },
    { do: "unwire", wire: "W4" },
    { do: "wire", id: "W4", from: "d15", to: "rail+:15", color: "yellow" },
    { do: "wait", seconds: 4.5 },
    { do: "check", task: "rest" },
  ],
});
