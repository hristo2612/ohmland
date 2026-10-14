// Blueprint: docs/curriculum/unit-2.md, Lesson 15 (its second half); docs/curriculum/conversion-guide.md, 15b.
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/transistors/tune-the-timer.
// One idea: more resistance in the RC means a longer delay, and a trimmer sets it.
//
// delay-timer's finished timer (content/labs/delay-timer.ts: C1 in row 10, reset S2, Q1 as an emitter follower
// feeding relay K1), with a trimmer in C1's feed: R1 (1 kΩ) runs from the + rail into row 5, the trimmer P1 (10 kΩ)
// sits in rows 5 to 7 (end a in row 5, wiper in row 6, end b in row 7), and the blue jumper W9 joins the wiper's row
// to C1's row 10. Wiper and one end make a variable resistor: 1 kΩ at the knob's zero, 11 kΩ at its stop. The learner
// turns the knob on the board (drag it round, or select it and use the arrow keys).
//
// Measured in the simulator: the relay clicks 1.47 s after switching on from an empty C1 with the knob at 0, 3.0 s at
// 10%, 4.5 s at 20%, 5.00 s at 23%, 5.3 s at 25% and 18.4 s at 100% (this C1 is a little over 1,000 µF). With W9 on
// end b instead of the wiper, the track is always the full 10 kΩ: about 15 s, whatever the knob says.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The stopwatch's last `n` runs, each started from an empty capacitor, all within [lo, hi] seconds. */
function lastRuns(lab: LabView, n: number, lo: number, hi: number): boolean {
  const runs = lab.runs().slice(-n);
  return runs.length >= n && runs.every((r) => (r.watch ?? 9) < 0.5 && r.seconds >= lo && r.seconds <= hi);
}

const knob = (lab: LabView) => Number(lab.prop("P1")?.["position"] ?? 0);
/** C1 is fed through the wiper, not through end b. */
const viaWiper = (lab: LabView) => lab.connected("C1.pos", "P1.wiper") && !lab.connected("C1.pos", "P1.b");

/** The fix-it bench: the blue jumper moved from the wiper's row to end b's row, so the knob does nothing. */
const ON_THE_END: SolutionStep[] = [
  { do: "unwire", wire: "W9" },
  { do: "wire", id: "W9", from: "a7", to: "a10", color: "blue" },
];

/** One timing run from an empty C1: switch off, reset, switch on, wait. */
const run = (seconds: number): SolutionStep[] => [
  { do: "flip", part: "S1", to: "a" },
  { do: "press", part: "S2", seconds: 0.6 },
  { do: "flip", part: "S1", to: "b" },
  { do: "wait", seconds },
];

export default defineLab({
  id: "tune-the-timer",
  title: "Tune it to five",
  bench: {
    board: "full",
    // The timer, from the start switch (column 1) to the green LED (column 33).
    frame: ["top+:1", "rail-:35"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Start switch S1" },
      { id: "R1", kind: "resistor", at: "rail+:5-b5", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "P1", kind: "trimmer", at: "c5", params: { ohms: 10_000, position: 0 }, locked: true, label: "10 kΩ trimmer P1" },
      { id: "C1", kind: "electrolytic-cap", at: "c10-rail-:11", params: { farads: 1000e-6, volts: 16 }, locked: true, label: "1,000 µF capacitor C1" },
      { id: "S2", kind: "pushbutton", at: "e10", params: { cap: "white" }, locked: true, label: "Reset button S2" },
      { id: "R3", kind: "resistor", at: "b12-rail-:13", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R3" },
      { id: "Q1", kind: "npn", at: "c20", locked: true, label: "Q1 (2N3904)" },
      { id: "K1", kind: "relay", at: "e20", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "D1", kind: "diode", at: "h20-d20", params: { model: "1N4001" }, locked: true, label: "1N4001 diode D1" },
      { id: "R2", kind: "resistor", at: "c27-c32", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "d32", params: { color: "green" }, locked: true, label: "Green LED D2" },
    ],
    wires: [
      { id: "W1", from: "a3", to: "rail+:3", color: "red" },
      { id: "W2", from: "rail-:4", to: "top-:4", color: "black" },
      { id: "W3", from: "j20", to: "top-:21", color: "black" },
      { id: "W4", from: "a23", to: "rail+:23", color: "red" },
      { id: "W5", from: "a33", to: "rail-:33", color: "black" },
      { id: "W7", from: "d10", to: "a21", color: "white" },
      { id: "W8", from: "a22", to: "rail+:22", color: "red" },
      // The wiper's row to C1's row.
      { id: "W9", from: "a6", to: "a10", color: "blue" },
    ],
    tray: [],
    instruments: [{ kind: "stopwatch", start: { part: "S1", to: "b" }, stop: { part: "K1", contact: "no" }, watch: "C1.pos" }],
  },
  mascot: {
    start: "My timer clicks too soon. Let's tune it.",
    hint: "More resistance, longer delay. Reset C1 before each run.",
    fried: "Oof. That one's for the Hall.",
  },
  triggers: {
    // Three runs in a row within 5% of five seconds (the five-second-club achievement).
    "five-seconds-tight": (lab) => lab.task("five-seconds") === "done" && lastRuns(lab, 3, 4.75, 5.25),
  },
  tasks: [
    {
      id: "longer-delay",
      prompt: "Turn the trimmer up a little, then time a run.",
      goal: (lab) => viaWiper(lab) && knob(lab) >= 0.08 && lastRuns(lab, 1, 2, 30),
      hints: ["Drag round the trimmer's knob, or select it and press the arrow keys.", "S1 off, press reset, S1 on."],
      highlight: ["P1"],
      nudges: [{ when: (lab) => { const r = lab.runs().at(-1); return !!r && (r.watch ?? 0) > 0.5; }, say: "C1 wasn't empty. Press reset while S1 is off." }],
      success: "A longer wait.",
    },
    {
      id: "five-seconds",
      prompt: "Trim to 5 s: three runs in a row, each within 0.5 s.",
      goal: (lab) => viaWiper(lab) && lastRuns(lab, 3, 4.5, 5.5),
      hints: ["Under 5 s? Turn it up. Over? Turn it down.", "A quarter of the way round is close."],
      highlight: ["P1"],
      nudges: [{ when: (lab) => { const r = lab.runs().at(-1); return !!r && (r.watch ?? 0) > 0.5; }, say: "C1 wasn't empty. Press reset while S1 is off." }],
      success: "Five seconds, on demand.",
    },
    {
      id: "fix-wiper",
      prompt: "The knob does nothing. Fix it.",
      setup: ON_THE_END,
      // On end b first (the setup), then through the wiper again.
      goal: (lab) => {
        if (lab.connected("C1.pos", "P1.b")) lab.memory["end"] = true;
        return lab.memory["end"] === true && viaWiper(lab);
      },
      hints: ["Follow the blue jumper to the trimmer. Which leg?", "The wiper is the middle leg, row 6."],
      highlight: ["wire:W9.a", "pin:P1.wiper"],
      success: "The knob works again.",
    },
  ],
  solution: [
    { do: "param", part: "P1", params: { position: 0.15 } },
    ...run(4.5),
    { do: "check", task: "longer-delay" },
    { do: "param", part: "P1", params: { position: 0.23 } },
    ...run(5.8),
    ...run(5.8),
    ...run(5.8),
    { do: "check", task: "five-seconds" },
    ...ON_THE_END,
    { do: "unwire", wire: "W9" },
    { do: "wire", id: "W9", from: "a6", to: "a10", color: "blue" },
    { do: "check", task: "fix-wiper" },
  ],
});
