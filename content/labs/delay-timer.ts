// Blueprint: docs/curriculum/unit-2.md, Lesson 15. Start switch S1 (the slide switch at the left end) feeds the near +
// rail. R1 (1 kΩ) runs from the rail into row 11; trimmer P1 (10 kΩ, rows 11 to 13) is a variable resistor from row
// 11 to its wiper in row 12, where C1 (1,000 µF) bends down to the minus rail. Reset button S2 (rows 12 and 14) empties
// C1 through R3 (100 Ω). Relay K1 straddles the channel at row 20 (coil 20, COM 23, NO 27), with its far coil pin on
// the far minus rail and a 1N4001 across the coil. NO feeds R2 and the green LED. At the start a jumper joins C1's +
// row straight to the coil (row 12 to row 20); the learner swaps it for Q1 in rows 20 to 22: emitter on the coil,
// base jumped back to row 12, collector jumped to the + rail. The stopwatch starts when S1 is switched on and stops
// when the relay pulls in; it notes C1's voltage at the start, so a run without a reset shows up.
//
// Measured in the simulator: without Q1, C1 sticks at 3.16 V and K1 never clicks; with Q1 and the trimmer at 0 the
// relay clicks after about 1.45 s; 5 s needs the trimmer near 23% (this C1 is a little over 1,000 µF).
import { defineLab, type LabView } from "@ohmland/lab";

/** The stopwatch's last `n` runs, each started from an empty capacitor, all within [lo, hi] seconds. */
function lastRuns(lab: LabView, n: number, lo: number, hi: number): boolean {
  const runs = lab.runs().slice(-n);
  return runs.length >= n && runs.every((r) => (r.watch ?? 9) < 0.5 && r.seconds >= lo && r.seconds <= hi);
}

const follower = (lab: LabView) => lab.connected("Q1.b", "C1.pos") && lab.connected("Q1.e", "K1.coil1") && lab.connected("Q1.c", "K1.com1");

export default defineLab({
  id: "delay-timer",
  title: "Wait for it",
  bench: {
    board: "full",
    frame: ["desk:-104,-30", "desk:14,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Start switch S1" },
      { id: "R1", kind: "resistor", at: "rail+:11-b11", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "P1", kind: "trimmer", at: "c11", params: { ohms: 10_000, position: 0 }, locked: true, label: "10 kΩ trimmer P1" },
      { id: "C1", kind: "electrolytic-cap", at: "b12-rail-:13", params: { farads: 1000e-6, volts: 16 }, locked: true, label: "1,000 µF capacitor C1" },
      { id: "S2", kind: "pushbutton", at: "e12", params: { cap: "white" }, locked: true, label: "Reset button S2" },
      { id: "R3", kind: "resistor", at: "b14-rail-:15", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R3" },
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
      // The first try: C1 straight to the coil.
      { id: "W6", from: "a12", to: "a20", color: "yellow" },
    ],
    tray: [{ id: "Q1", kind: "npn", count: 1, label: "2N3904" }],
    instruments: [
      { kind: "stopwatch", start: { part: "S1", to: "b" }, stop: { part: "K1", contact: "no" }, watch: "C1.pos" },
      { kind: "meter", at: "desk:-178,22", rot: 16, mode: "dcv", tips: { red: "desk:-52,48", black: "desk:-40,54" } },
    ],
    controls: [{ id: "trim", label: "Trimmer P1", part: "P1", key: "position", min: 0, max: 1, value: 0, step: 0.005, unit: "%" }],
  },
  mascot: {
    start: "You know how to make time. Let's make a timer.",
    hint: "Reset C1 before each run.",
    success: "Wait for it... wait for it... click!",
    fried: "Straight from the supply into the base: nothing limited the current.",
    exit: "Five seconds. I counted. Twice.",
  },
  fried: { npn: "2N3904, base wired straight to the supply" },
  triggers: {
    // Three runs in a row within 5% of five seconds.
    "five-seconds-tight": (lab) => lab.task("five-seconds") === "done" && lastRuns(lab, 3, 4.75, 5.25),
  },
  tasks: [
    {
      id: "no-click",
      prompt: "Press reset (S2), then switch on S1. Wait ten seconds. Measure C1's voltage and note it.",
      note: { id: "stuck", label: "C1's voltage", unit: "V" },
      goal: (lab) => {
        const v = lab.volts("C1.pos") ?? 0;
        const x = lab.note("stuck");
        return lab.heldFor(8, lab.closed("S1")) && v >= 2.8 && v <= 3.5 && !lab.events.some((e) => e.type === "clicked" && e.partId === "K1" && e.data?.["to"] === "no") && x !== null && Math.abs(x - v) <= 0.2;
      },
      hints: ["Meter on DC volts, red probe on C1's + leg, black on its striped leg."],
      highlight: ["C1"],
      success: "Stuck near 3.2 V. The coil drains current as fast as the 1 kΩ supplies it: together they form a divider, and 3.2 V is far below the 6 V the relay needs.",
    },
    {
      id: "add-q1",
      prompt:
        "Switch off and remove the yellow jumper. Put **Q1** in rows 20 to 22 (flat face toward you): emitter on the coil's row 20, then jump its base (row 21) to C1's + row (row 12) and its collector (row 22) to the + rail. Reset, then switch on.",
      goal: (lab) => !lab.connected("C1.pos", "K1.coil1") && follower(lab) && lab.runs().some((r) => r.seconds >= 0.9 && r.seconds <= 2.2) && lab.isLit("D2"),
      hints: ["The coil now hangs from the emitter.", "Reset C1 before each run: press S2 while S1 is off."],
      highlight: ["hole:c20", "hole:c21", "hole:c22"],
      success: "Click! The capacitor only has to feed the base, a tiny current. The transistor feeds the coil from the battery.",
      notice: "The emitter follows the capacitor about 0.7 V below it, and the relay clicks when the emitter reaches pull-in.",
      mascot: { success: "The transistor carries the coil so the capacitor doesn't have to." },
    },
    {
      id: "five-seconds",
      prompt: "Turn the trimmer to set a delay of **5 seconds**. Reset between tries: three runs in a row must land within half a second.",
      goal: (lab) => follower(lab) && lastRuns(lab, 3, 4.5, 5.5),
      hints: ["More resistance, longer delay.", "τ = R × C. You need about 3.7 s of τ: with 1,000 µF, that's about 3.7 kΩ in all."],
      highlight: ["P1"],
      success: "Five seconds, on demand. That's a timer.",
    },
    {
      id: "impatient-restart",
      prompt: "Switch S1 off, then straight back on, without pressing reset. Time it.",
      goal: (lab) => {
        const runs = lab.runs();
        const last = runs[runs.length - 1];
        const prev = runs[runs.length - 2];
        return !!last && !!prev && (last.watch ?? 0) > 1 && last.seconds < 0.7 * prev.seconds;
      },
      hints: ["Be quick: while the power is off, the coil slowly drains C1 through Q1.", "Off and straight back on, within a quarter of a second."],
      success: "Much shorter, maybe no wait at all: C1 still had charge left, enough to hold the relay in. Real timers need a way to empty their capacitor, like your reset button.",
    },
  ],
  solution: [
    { do: "press", part: "S2", seconds: 0.4 },
    { do: "flip", part: "S1", to: "b" },
    { do: "probe", red: "C1.pos", black: "C1.neg" },
    { do: "wait", seconds: 8.5 },
    { do: "note", id: "stuck", value: "3.16" },
    { do: "check", task: "no-click" },
    { do: "flip", part: "S1", to: "a" },
    { do: "unwire", wire: "W6" },
    { do: "place", part: "Q1", kind: "npn", at: "c20" },
    { do: "wire", id: "W7", from: "a21", to: "a12", color: "yellow" },
    { do: "wire", id: "W8", from: "a22", to: "rail+:22", color: "red" },
    { do: "press", part: "S2", seconds: 0.6 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "add-q1" },
    { do: "control", id: "trim", value: 0.23 },
    { do: "flip", part: "S1", to: "a" },
    { do: "press", part: "S2", seconds: 0.6 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 5.8 },
    { do: "flip", part: "S1", to: "a" },
    { do: "press", part: "S2", seconds: 0.6 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 5.8 },
    { do: "flip", part: "S1", to: "a" },
    { do: "press", part: "S2", seconds: 0.6 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 5.8 },
    { do: "check", task: "five-seconds" },
    { do: "flip", part: "S1", to: "a" },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 5 },
    { do: "check", task: "impatient-restart" },
  ],
});
