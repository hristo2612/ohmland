// Blueprint: docs/curriculum/unit-4.md, CH9. A bench lesson (docs/LESSONS.md): content/units/chips/alarm/short-and-sweet.
// One idea: the capacitor fills through R1 and R2 but empties through R2 alone, so the flash is always the longer part;
// a diode across R2 lets it fill past R2, and the flash gets short. New: the words "duty cycle". The 1N4148 is a known
// part (a diode) in a small glass body.
//
// The alarm module's astable layout (content/labs/meet-the-chips.ts has it), its R2 a 4.7 kΩ resistor (pin 7 to column
// 18) in series with RV1, a 100 kΩ trimmer (its first end in column 18, its wiper in column 19, the timing node). C1 10 µF on the
// near side of column 19, the lamp on pin 3. The scope watches pin 3 with a duty readout (pin 3 is watched, so the
// times are exact). The tray holds D2, a 1N4148, whose default four-hole span reaches from pin 7 to the node.
//
// Measured in the simulator: without the diode, duty 76% at the bottom of the knob down to 53% at the top, never 50%;
// with it, high about 0.08 s (a little over 0.693 × R1 × C: the diode's drop) and duty about 10% at the top, 25% near
// 30% of the knob, 50% near 7%. Across R1 with its band toward plus (the fix-it) the diode never conducts.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const knob = (lab: LabView) => {
  const p = lab.part("RV1")?.extra?.["position"];
  return typeof p === "number" ? p : (lab.control("knob") ?? 0);
};
/** Duty of pin 3 over the latest whole cycles (exact: pin 3 is watched), and how many cycles that took. */
const duty = (lab: LabView) => lab.duty("volts:U1.3", undefined, 6);
const across = (lab: LabView) => lab.joins("D2", "U1.7", "U1.6", "forward");

/** Knob settings for the replay's parts. */
const KNOB_UNDER_25 = 0.6;
const KNOB_EVEN = 0.07;

/** The under-25% beat starts with the knob near the bottom: an even blink to shorten. */
const KNOB_LOW: SolutionStep[] = [{ do: "control", id: "knob", value: 0.05 }];

/** The fix-it bench: the diode across R1, band toward plus, where it never conducts; the knob back up. */
const ACROSS_R1: SolutionStep[] = [
  { do: "move", part: "D2", at: "i15-i10" },
  { do: "control", id: "knob", value: 0.6 },
];

/** Duty over cycles since `key` was noted in the task's memory (first time `cond` held), or null. */
function dutySince(lab: LabView, key: string, cond: boolean) {
  if (!cond) {
    delete lab.memory[key];
    return null;
  }
  const at = (lab.memory[key] ??= lab.t) as number;
  return lab.t - at > 0.5 ? lab.duty("volts:U1.3", undefined, lab.t - at) : null;
}

export default defineLab({
  id: "short-and-sweet",
  title: "Short flash, long gap",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R1", kind: "resistor", at: "h15-h10", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "R2", kind: "resistor", at: "g15-g18", params: { ohms: 4700 }, locked: true, label: "4.7 kΩ resistor R2" },
      { id: "RV1", kind: "trimmer", at: "h18", params: { ohms: 100_000, position: 0 }, locked: true, label: "100 kΩ knob RV1" },
      { id: "C1", kind: "electrolytic-cap", at: "b19-rail-:19", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor C1" },
      { id: "R3", kind: "resistor", at: "c16-c12", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", holes: { anode: "b12", cathode: "b11" }, params: { color: "red", maxmA: 20 }, locked: true, label: "Red LED" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a14", to: "rail-:14", color: "black" },
      { id: "W2", from: "j14", to: "top+:14", color: "red" },
      { id: "W3", from: "a17", to: "rail+:17", color: "red" },
      { id: "W4", from: "d15", to: "d19", color: "yellow" },
      { id: "W5", from: "a11", to: "rail-:11", color: "black" },
      { id: "W6", from: "i16", to: "i19", color: "yellow" },
      { id: "W7", from: "f19", to: "e19", color: "yellow" },
      { id: "W9", from: "j10", to: "top+:10", color: "red" },
    ],
    tray: [{ id: "D2", kind: "diode", params: { model: "1N4148" }, count: 1, label: "1N4148 diode" }],
    instruments: [{ kind: "scope", traces: [{ label: "Pin 3", volts: "U1.3" }], duty: true, window: 4, range: [0, 10] }],
    controls: [{ id: "knob", label: "Knob RV1", part: "RV1", key: "position", min: 0, max: 1, value: 0, step: 0.005, unit: "%" }],
    watch: ["U1.3"],
  },
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7, 4] }],
  mascot: {
    hint: "The band marks the end toward pin 6.",
    fried: "That shouldn't happen here. Fresh part in.",
  },
  tasks: [
    {
      id: "try-the-knob",
      prompt: "Turn the knob through its whole range.",
      goal: (lab) => {
        const m = lab.memory;
        const k = knob(lab);
        m["lo"] = Math.min((m["lo"] as number | undefined) ?? k, k);
        m["hi"] = Math.max((m["hi"] as number | undefined) ?? k, k);
        const d = duty(lab);
        if (d && d.duty <= 0.5) m["low"] = true;
        return (m["hi"] as number) - (m["lo"] as number) >= 0.6 && m["low"] !== true && !!d && d.cycles >= 2;
      },
      hints: ["Drag the knob all the way round, or use its slider.", "Watch the duty: it never drops under a half."],
      highlight: ["RV1"],
      success: "Faster or slower, but always on more than half the time.",
    },
    {
      id: "diode-in",
      prompt: "Clip the small diode across R2, band toward pin 6.",
      goal: (lab) => (dutySince(lab, "in", across(lab))?.duty ?? 1) < 0.45,
      hints: ["Plain end in pin 7's strip, band toward pin 6.", "Band end in column 19, where the jumpers from pin 6 meet."],
      highlight: ["hole:j15", "hole:j19"],
      nudges: [{ when: (lab) => lab.joins("D2", "U1.6", "U1.7", "forward"), say: "Flip it round. Band toward pin 6." }],
      success: "Short flashes, long gaps.",
    },
    {
      id: "under-25",
      prompt: "Get the duty cycle under 25%.",
      setup: KNOB_LOW,
      goal: (lab) => {
        const d = duty(lab);
        return across(lab) && !!d && d.cycles >= 3 && d.duty < 0.25;
      },
      hints: ["Turn the knob up: a longer gap."],
      highlight: ["RV1"],
      success: "Under a quarter of the time on.",
    },
    {
      id: "fix-diode",
      prompt: "Make the diode shorten the flash.",
      setup: ACROSS_R1,
      goal: (lab) => {
        if (!across(lab)) lab.memory["broken"] = true;
        const d = dutySince(lab, "in", across(lab));
        return lab.memory["broken"] === true && !!d && d.cycles >= 2 && d.duty < 0.4;
      },
      hints: ["Which resistor should the diode skip?", "Across R2's ends, band toward pin 6."],
      highlight: ["D2"],
      success: "Short flashes. Across R2, band to pin 6.",
    },
    {
      id: "even-blink",
      prompt: "With the diode in, make an even blink.",
      goal: (lab) => {
        const d = dutySince(lab, "in", across(lab));
        return !!d && d.cycles >= 3 && d.duty >= 0.47 && d.duty <= 0.53;
      },
      hints: ["Turn the knob nearly to the bottom, little by little."],
      success: "Half on, half off. R2 just over R1.",
      bonus: true,
    },
  ],
  solution: [
    { do: "wait", seconds: 2 },
    { do: "control", id: "knob", value: 1 },
    { do: "wait", seconds: 6 },
    { do: "check", task: "try-the-knob" },
    // A fresh bench ("Show me") starts with the knob where the lab starts it: turn it to the top again.
    { do: "control", id: "knob", value: 1 },
    { do: "place", part: "D2", kind: "diode", at: "j15-j19", params: { model: "1N4148" } },
    { do: "wait", seconds: 3 },
    { do: "check", task: "diode-in" },
    ...KNOB_LOW,
    { do: "wait", seconds: 2 },
    { do: "control", id: "knob", value: KNOB_UNDER_25 },
    { do: "wait", seconds: 4 },
    { do: "check", task: "under-25" },
    ...ACROSS_R1,
    { do: "wait", seconds: 2 },
    { do: "move", part: "D2", at: "j15-j19" },
    { do: "wait", seconds: 4 },
    { do: "check", task: "fix-diode" },
    { do: "control", id: "knob", value: KNOB_EVEN },
    { do: "wait", seconds: 3 },
    { do: "check", task: "even-blink" },
  ],
});
