// Blueprint: docs/curriculum/unit-4.md, CH2. A bench lesson (docs/LESSONS.md): content/units/chips/timer-555/one-shot.
// One idea: a dip on pin 2 starts one glow of fixed length on pin 3, however long the tap. New: pin 2 (trigger) and
// pin 3 (output), the way in and the way out.
//
// The timer module's one-shot layout (CH2 to CH5): half board, the 555 across the channel at columns 14 to 17 (pin 1
// in e14, pin 8 in f14). Far side: pin 8 to plus, R1 270 kΩ from pin 7 to column 20 (a jumper takes it to plus), C1
// 10 µF from pin 7 to minus, a short jumper joining pin 6 to pin 7. Near side: pin 1 to minus, R2 10 kΩ pulling pin 2
// up to plus, button S1 (columns 10 and 12, a jumper to pin 2) taking it to minus, pin 4 to plus, R3 1 kΩ and the LED
// on pin 3. Pin 5 is left free (its usual 10 nF only keeps noise off; the simulator has none). The stopwatch starts on
// a press and stops as the lamp goes out.
//
// Measured in the simulator: 3.07 s a glow (1.1 × R × C is 2.97 s; this R1 and C1 sit a little high, and the 10 µF's
// 10 MΩ leakage adds about 2%), the same for a 1 s hold; pin 3 sits about 1.5 V under the supply, so the lamp carries
// about 6 mA.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { cleanRun, fromEmpty, lastRun, oneShotT, runNear, runsSince } from "./lib/timer555";

const T = (lab: LabView) => oneShotT(lab, "R1", "C1");

/** The fix-it bench: the lamp's resistor moved from pin 3's strip to pin 1's, so both ends of the lamp sit on minus. */
const LAMP_ON_PIN1: SolutionStep[] = [{ do: "move", part: "R3", at: "b14-b20" }];

export default defineLab({
  id: "one-shot",
  title: "One tap, one glow",
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R1", kind: "resistor", at: "h15-h20", params: { ohms: 270_000 }, locked: true, label: "270 kΩ resistor R1" },
      { id: "C1", kind: "electrolytic-cap", at: "j15-top-:16", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor C1" },
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
    tray: [],
    // `watch` notes the capacitor's volts as a run starts: a tap during a glow (or the chip's power-up glow) starts a
    // run on a part-filled capacitor, and goals leave those runs out.
    instruments: [{ kind: "stopwatch", start: { part: "S1", pressed: true }, stop: { part: "D1", lit: false }, watch: "U1.6" }],
  },
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3] }],
  mascot: {
    hint: "Watch the stopwatch. Tap, then let go.",
    fried: "Pin 3 hit a rail head on. Fresh chip in.",
  },
  tasks: [
    {
      id: "one-glow",
      prompt: "Tap the button once and time the glow.",
      goal: (lab) => runNear(lab, T(lab), 0.08, cleanRun(lab)),
      hints: ["Tap the red button once, then let go.", "The stopwatch starts on your tap and stops when the lamp goes out."],
      highlight: ["S1"],
      success: "About three seconds.",
    },
    {
      id: "hold-one-second",
      prompt: "Hold the button for about one second, then let go.",
      goal: (lab) => {
        // A press of 0.6 to 2 s, and the run that began with it as long as a tap's.
        const held = lab.presses("S1", 12).filter((p) => p.end !== null && p.end - p.start >= 0.6 && p.end - p.start <= 2.0);
        return held.some((p) => lab.runs().some((r) => Math.abs(r.start - p.start) < 0.05 && fromEmpty(r) && runNear(lab, T(lab), 0.08, r)));
      },
      hints: ["Hold for about one second, then let go.", "Count one, then let go. Watch the stopwatch."],
      highlight: ["S1"],
      nudges: [{ when: (lab) => !!lastRun(lab) && lab.presses("S1", 6).some((p) => p.end !== null && p.end - p.start < 0.4), say: "Hold it a little longer this time." }],
      success: "Three seconds again.",
    },
    {
      id: "xray-trigger",
      prompt: "Open the x-ray, then tap the button.",
      goal: (lab) => {
        if (lab.view("xray:U1") && lab.part("U1")?.extra?.["trigger"] === true) lab.memory["seen"] = true;
        return lab.memory["seen"] === true;
      },
      hints: ["Look inside first, then tap the button.", "Watch pin 2 dip under the lower line."],
      highlight: ["S1"],
      success: "Pin 2 dipped, the switch inside flipped, pin 3 went high.",
    },
    {
      id: "fix-lamp",
      prompt: "Make the second lamp light again.",
      setup: LAMP_ON_PIN1,
      goal: (lab) => {
        // Broken first (the setup), then fixed, then a press that lights the lamp.
        if (!lab.joins("R3", "U1.3", "D1.anode")) lab.memory["brokeAt"] = lab.t;
        const at = lab.memory["brokeAt"] as number | undefined;
        return at !== undefined && lab.joins("R3", "U1.3", "D1.anode") && runsSince(lab, at).some((r) => r.seconds > 1);
      },
      hints: ["Which pin is the output?", "Move R3's left end into pin 3's strip, then tap."],
      highlight: ["R3", "hole:b16"],
      success: "It glows. Lamps hang on pin 3.",
    },
    {
      id: "double-tap",
      prompt: "Tap twice, fast, inside one glow.",
      goal: (lab) => {
        // Two presses that began while the output was already high, and a run of the usual length.
        const runs = lab.runs();
        const r = runs[runs.length - 1];
        if (!r) return false;
        const inside = lab.presses("S1", 12).filter((p) => p.start > r.start + 0.05 && p.start < r.stop);
        return inside.length >= 1 && runNear(lab, T(lab), 0.08, r);
      },
      hints: ["Tap, then tap again while the lamp still glows."],
      success: "Still one glow. Taps mid-glow are ignored.",
      bonus: true,
    },
  ],
  solution: [
    // The chip may wake with its lamp on (a 555's latch starts at random): let that glow end first.
    { do: "wait", seconds: 3.2 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.4 },
    { do: "check", task: "one-glow" },
    { do: "press", part: "S1", seconds: 1.0 },
    { do: "wait", seconds: 2.6 },
    { do: "check", task: "hold-one-second" },
    { do: "view", name: "xray:U1", on: true },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "check", task: "xray-trigger" },
    { do: "wait", seconds: 3 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 0.4 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3 },
    { do: "check", task: "double-tap" },
    ...LAMP_ON_PIN1,
    { do: "wait", seconds: 1 },
    { do: "move", part: "R3", at: "b16-b20" },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.4 },
    { do: "check", task: "fix-lamp" },
  ],
});
