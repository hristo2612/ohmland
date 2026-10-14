// Blueprint: docs/curriculum/unit-4.md, CH1. A bench lesson (docs/LESSONS.md):
// content/units/chips/timer-555/meet-the-chips. One idea: a chip's pins count from the notch, round the chip; the
// 555 takes plus on pin 8 and minus on pin 1.
//
// Half board. A 555 blinker is wired round an empty space across the channel at columns 14 to 17 (pin 1 would sit in
// e14, pins 1 to 4 along row e, 5 to 8 back along row f, pin 8 in f14). This is the astable layout of the alarm
// module (CH7 to CH10): far side, pin 8 to plus, R1 10 kΩ from pin 7 left to column 10 (jumped to plus), R2 68 kΩ from
// pin 7 right to column 20, a jumper from pin 6 to column 20; a short jumper takes column 20 across the channel, where
// C1 10 µF goes to minus and a jumper brings pin 2 over. Near side: pin 1 to minus, pin 4 to plus, R3 1 kΩ from pin 3
// left to the LED. Pin 5 is left free (the usual 10 nF only keeps noise off it, and the simulator has none). The
// learner drops the chip from the tray.
//
// Measured in the simulator: 0.99 Hz (1.44 ÷ (146 kΩ × 10 µF)). Turned round, pin 8 lands on plus (pin 4's hole) and
// pin 1 on nothing: the chip floats at about 4.7 V and the lamp sits dim and steady (about 3 mA). No blink, no harm.
// Pushed onto one side of the channel (the fix-it), every pin shares a strip with the pin facing it: unpowered.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { blinking, seatedRight } from "./lib/timer555";

/** Seated notch left for 2.5 s, and the lamp flashed twice in that time (so a blink from before a move never counts). */
const blinks = (lab: LabView) => lab.heldFor(2.5, seatedRight(lab, "U1"), "seated") && blinking(lab, "D1", 2, 2.5);
const healthy = (lab: LabView) => lab.part("U1")?.health !== "dead";

/** The fix-it bench: the chip pushed down onto the near half, every pin sharing a strip with the pin facing it. */
const ONE_SIDE: SolutionStep[] = [{ do: "move", part: "U1", at: "b14" }];

export default defineLab({
  id: "meet-the-chips",
  title: "Pin 1 by the notch",
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "h15-h10", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "R2", kind: "resistor", at: "g15-g20", params: { ohms: 68_000 }, locked: true, label: "68 kΩ resistor R2" },
      { id: "C1", kind: "electrolytic-cap", at: "b20-rail-:20", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor C1" },
      { id: "R3", kind: "resistor", at: "c16-c12", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", holes: { anode: "b12", cathode: "b11" }, params: { color: "red", maxmA: 20 }, locked: true, label: "Red LED" },
      // The secret: a surface-mount lookalike on the desk. Its feet are half the board's pitch.
      { id: "U9", kind: "chip", at: "desk:62,40", params: { model: "555", package: "soic" }, label: "Tiny 555" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a14", to: "rail-:14", color: "black" },
      { id: "W2", from: "j14", to: "top+:14", color: "red" },
      { id: "W3", from: "a17", to: "rail+:17", color: "red" },
      { id: "W4", from: "d15", to: "d20", color: "yellow" },
      { id: "W5", from: "a11", to: "rail-:11", color: "black" },
      { id: "W6", from: "i16", to: "i20", color: "yellow" },
      { id: "W7", from: "f20", to: "e20", color: "yellow" },
      { id: "W9", from: "j10", to: "top+:10", color: "red" },
    ],
    tray: [{ id: "U1", kind: "chip", params: { model: "555" }, count: 1, label: "555 timer" }],
    instruments: [],
  },
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8] }],
  mascot: {
    hint: "Notch to the left. Pin 1 sits by the dot.",
    fried: "Hot chip. Fresh one in.",
  },
  fried: { chip: "555 timer, wired the wrong way" },
  tasks: [
    {
      id: "drop-the-chip",
      prompt: "Drop the chip across the middle gap, notch to the left.",
      goal: blinks,
      hints: ["Drop it across the middle gap, notch to the left.", "Its legs go in columns 14 to 17, where the wires wait."],
      highlight: ["hole:e14", "hole:e17", "hole:f14", "hole:f17"],
      nudges: [
        { when: (lab) => !!lab.chipSeat("U1")?.turned, say: "Notch to the left, please. Tap it, then Rotate." },
        { when: (lab) => !!lab.chipSeat("U1")?.oneSide, say: "Across the middle gap, one row each side." },
        { when: (lab) => !!lab.chipSeat("U1")?.straddles && !lab.chipSeat("U1")?.turned && lab.chipSeat("U1")?.columns?.[0] !== 14, say: "Slide it until every pin meets a wire." },
      ],
      success: "It blinks!",
    },
    {
      id: "xray-on",
      prompt: "Open the chip's x-ray.",
      goal: (lab) => lab.view("xray:U1") && seatedRight(lab, "U1"),
      hints: ["The x-ray button sits on the panel below the bench."],
      success: "Two rails: plus on pin 8, minus on pin 1.",
    },
    {
      id: "turn-it-round",
      prompt: "Turn the chip round: notch to the right.",
      goal: (lab) => lab.heldFor(2, !!lab.chipSeat("U1")?.turned) && (lab.stats("glow:D1", 1.5)?.span ?? 1) < 0.1 && healthy(lab),
      hints: ["Tap the chip, then Rotate."],
      highlight: ["U1"],
      success: "No blink. Every pin landed in the wrong place.",
    },
    {
      id: "turn-it-back",
      prompt: "Turn it back, notch to the left.",
      goal: blinks,
      hints: ["Tap the chip, then Rotate again."],
      highlight: ["U1"],
      success: "Blinking again.",
    },
    {
      id: "fix-one-side",
      prompt: "Seat the chip across the middle gap again.",
      setup: ONE_SIDE,
      goal: (lab) => {
        if (lab.chipSeat("U1")?.oneSide) lab.memory["broken"] = true;
        return lab.memory["broken"] === true && blinks(lab);
      },
      hints: ["Each pin needs its own strip. Straddle the gap.", "Back where the wires wait: columns 14 to 17."],
      highlight: ["hole:e14", "hole:f14"],
      success: "Blinking. Each pin on its own strip.",
    },
    {
      id: "too-small",
      prompt: "Try the tiny chip on the board.",
      goal: (lab) => lab.bench.rejected.includes("U9"),
      hints: ["Drag the tiny chip from the desk onto the board."],
      success: "It won't go in. Its feet are too close together.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "U1", kind: "chip", at: "e14", params: { model: "555" } },
    { do: "wait", seconds: 3 },
    { do: "check", task: "drop-the-chip" },
    { do: "view", name: "xray:U1", on: true },
    { do: "check", task: "xray-on" },
    { do: "view", name: "xray:U1", on: false },
    { do: "rotate", part: "U1" },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "turn-it-round" },
    { do: "rotate", part: "U1" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "turn-it-back" },
    ...ONE_SIDE,
    { do: "wait", seconds: 1 },
    { do: "move", part: "U1", at: "e14" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "fix-one-side" },
    { do: "move", part: "U9", at: "desk:26,-4" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "too-small" },
  ],
});
