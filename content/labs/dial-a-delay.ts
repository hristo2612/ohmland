// Blueprint: docs/curriculum/unit-4.md, CH5. A bench lesson (docs/LESSONS.md):
// content/units/chips/timer-555/dial-a-delay. One idea: the glow lasts about 1.1 × R × C. New: the formula.
//
// CH2's one-shot (content/labs/one-shot.ts has the layout) with R made of R1 10 kΩ (pin 7 to column 19) and RV1, a
// 500 kΩ trimmer (its first end in column 19, its wiper in column 20, jumped to plus): R = 10 kΩ + knob × 500 kΩ. C1 is
// an ordinary 10 µF (20%), so every learner's knob lands somewhere different and the stopwatch is the judge. The tray
// holds C2, 22 µF, to drop onto C1 (same kinds swap places).
//
// Measured in the simulator: 0.11 s with the knob at zero, 5.6 s at the top; 22 µF glows 2.2 times longer. In the
// fix-it a jumper shorts R1: turned to zero, pin 7 meets plus with nothing between and the chip dies on its first
// discharge (over 50 mA into pin 7). Lift the jumper first and zero is a safe 0.11 s blink.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { actual, cleanRun, runNear, runsSince } from "./lib/timer555";

/** The knob, as the simulator has it (the bench's trimmer or the slider, whichever moved last). */
const knob = (lab: LabView) => {
  const p = lab.part("RV1")?.extra?.["position"];
  return typeof p === "number" ? p : (lab.control("knob") ?? 0);
};
const ohms = (lab: LabView) => (lab.connected("R1.a", "R1.b") ? 0 : actual(lab, "R1")) + knob(lab) * 500_000;
const T = (lab: LabView, c: string) => Math.log(3) * ohms(lab) * actual(lab, c);
/** The capacitor sits between pins 6 and 7 and minus. */
const timing = (lab: LabView, c: string) => lab.joins(c, "U1.7", "B1.neg");
const alive = (lab: LabView) => lab.part("U1")?.health !== "dead";

/** Knob settings for 2.0 s with the replay's parts (C1 and C2 as the simulator spreads them without a learner seed). */
const KNOB_10 = 0.34;
const KNOB_22 = 0.14;

/** The fix-it bench: a jumper across R1 and the knob halfway, so zero would leave nothing between pin 7 and plus. */
const SHORTED_R1: SolutionStep[] = [
  { do: "wire", id: "W10", from: "i15", to: "g19", color: "yellow" },
  { do: "control", id: "knob", value: 0.5 },
];

export default defineLab({
  id: "dial-a-delay",
  title: "Dial a delay",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R1", kind: "resistor", at: "h15-h19", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "RV1", kind: "trimmer", at: "i19", params: { ohms: 500_000, position: 0.1 }, locked: true, label: "500 kΩ knob RV1" },
      { id: "C1", kind: "electrolytic-cap", at: "j15-top-:16", params: { farads: 10e-6, volts: 16 }, label: "10 µF capacitor C1" },
      { id: "R2", kind: "resistor", at: "b15-rail+:15", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R2" },
      { id: "S1", kind: "pushbutton", at: "e10", params: { cap: "red" }, locked: true, label: "Button S1" },
      { id: "R3", kind: "resistor", at: "b16-b20", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", at: "c20", params: { color: "red", maxmA: 20 }, locked: true, label: "Red LED" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a14", to: "rail-:14", color: "black" },
      { id: "W2", from: "j14", to: "top+:14", color: "red" },
      { id: "W3", from: "a17", to: "rail+:17", color: "red" },
      { id: "W5", from: "a21", to: "rail-:21", color: "black" },
      { id: "W6", from: "g15", to: "g16", color: "yellow" },
      { id: "W9", from: "j20", to: "top+:20", color: "red" },
      { id: "W7", from: "d12", to: "d15", color: "yellow" },
      { id: "W8", from: "a10", to: "rail-:10", color: "black" },
    ],
    tray: [{ id: "C2", kind: "electrolytic-cap", params: { farads: 22e-6, volts: 16 }, count: 1, label: "22 µF capacitor" }],
    instruments: [{ kind: "stopwatch", start: { part: "S1", pressed: true }, stop: { part: "D1", lit: false }, watch: "U1.6" }],
    controls: [{ id: "knob", label: "Knob RV1", part: "RV1", key: "position", min: 0, max: 1, value: 0.1, step: 0.005, unit: "%" }],
    watch: ["U1.3"],
  },
  mascot: {
    hint: "1.1 × R × 10 µF = 2 s. Solve for R.",
    fried: "Pop. Pin 7 met plus with nothing between. Fresh chip in.",
  },
  fried: { chip: "555 timer, pin 7 straight to plus" },
  // The 555 map so far (the notebook draws it on the signed-off page).
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7] }],
  tasks: [
    {
      id: "longer-glow",
      prompt: "Turn the knob up, then tap the button.",
      goal: (lab) => {
        const run = cleanRun(lab);
        return knob(lab) >= 0.3 && !!run && run.seconds >= 1.5 && runNear(lab, T(lab, "C1"), 0.15, run);
      },
      hints: ["Drag the knob round, or use its slider. Then tap.", "A third of the way up is plenty."],
      highlight: ["RV1"],
      success: "A longer glow.",
    },
    {
      id: "bigger-c",
      prompt: "Drop the 22 µF onto the 10 µF, then tap.",
      goal: (lab) => {
        if (!timing(lab, "C2") || timing(lab, "C1")) return false;
        const since = (lab.memory["since"] ??= lab.t) as number;
        const run = cleanRun(lab);
        return !!run && run.start >= since && runNear(lab, T(lab, "C2"), 0.15, run);
      },
      hints: ["Drag the 22 µF from the tray right onto the 10 µF. They swap.", "Then tap the button."],
      highlight: ["C1"],
      success: "About twice as long.",
    },
    {
      id: "two-seconds",
      prompt: "Put the 10 µF back, then set the knob so the glow lasts 2.0 s.",
      goal: (lab) => {
        // A run timed since the 10 µF went back in.
        if (!timing(lab, "C1") || timing(lab, "C2")) {
          delete lab.memory["since"];
          return false;
        }
        const since = (lab.memory["since"] ??= lab.t) as number;
        const run = cleanRun(lab);
        return !!run && run.start >= since && run.seconds >= 1.9 && run.seconds <= 2.1;
      },
      hints: ["Too long? Turn the knob down a little.", "Tap after every turn and read the stopwatch."],
      highlight: ["RV1"],
      nudges: [{ when: (lab) => timing(lab, "C2"), say: "Swap the 10 µF back in first." }],
      success: "Two seconds, made to order.",
    },
    {
      id: "fix-safe",
      prompt: "Make the knob safe at zero, then turn it right down and tap.",
      setup: SHORTED_R1,
      goal: (lab) => {
        if (lab.connected("R1.a", "R1.b")) lab.memory["brokeAt"] = lab.t;
        const at = lab.memory["brokeAt"] as number | undefined;
        if (at === undefined || lab.connected("R1.a", "R1.b") || !alive(lab) || knob(lab) > 0.02) return false;
        // A 0.11 s glow fills the capacitor a little before the stopwatch notes it, so no `fromEmpty` here.
        const t = T(lab, "C1");
        if (runsSince(lab, at).some((r) => runNear(lab, t, 0.3, r))) return true;
        // A blink this short can fall between two frames of a slow screen; pin 3's own edges time it exactly.
        const e = lab.edges("U1.3").times.filter(([x]) => x >= at);
        return e.some(([x, d], i) => d === 1 && e[i + 1]?.[1] === 0 && Math.abs(e[i + 1]![0] - x - t) <= 0.3 * t);
      },
      hints: ["Fix first, turn second.", "A jumper skips R1. Take it out, then turn the knob to zero."],
      highlight: ["W10"],
      success: "A short blink, chip cool. 10 kΩ keeps pin 7 alive.",
    },
    {
      id: "two-seconds-big",
      prompt: "Swap in the 22 µF and dial 2.0 s again.",
      goal: (lab) => {
        const run = cleanRun(lab);
        return timing(lab, "C2") && !timing(lab, "C1") && !!run && run.seconds >= 1.9 && run.seconds <= 2.1;
      },
      hints: ["More C needs less R. Turn the knob down."],
      success: "More C, less R: the same two seconds.",
      bonus: true,
    },
  ],
  solution: [
    { do: "wait", seconds: 3.2 },
    { do: "control", id: "knob", value: 0.4 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3 },
    { do: "check", task: "longer-glow" },
    { do: "place", part: "C2", kind: "electrolytic-cap", at: "on:C1", params: { farads: 22e-6, volts: 16 } },
    { do: "wait", seconds: 7 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 6.5 },
    { do: "check", task: "bigger-c" },
    { do: "control", id: "knob", value: KNOB_22 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "two-seconds-big" },
    { do: "move", part: "C1", at: "on:C2" },
    { do: "control", id: "knob", value: KNOB_10 },
    { do: "wait", seconds: 2 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "two-seconds" },
    ...SHORTED_R1,
    { do: "wait", seconds: 1 },
    { do: "unwire", wire: "W10" },
    { do: "control", id: "knob", value: 0 },
    { do: "wait", seconds: 4 },
    { do: "press", part: "S1", seconds: 0.05 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-safe" },
  ],
});
