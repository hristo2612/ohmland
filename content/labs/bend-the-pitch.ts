// Blueprint: docs/curriculum/unit-4.md, CH10. A bench lesson (docs/LESSONS.md): content/units/chips/alarm/bend-the-pitch.
// One idea: pin 5 is the 2/3 line itself: drive it higher and the capacitor must climb further, so the note drops;
// drive it lower and the note rises. New: pin 5 (control). The x-ray draws the ladder of three equal resistors and the
// 555 map is complete.
//
// The alarm module's astable layout (content/labs/meet-the-chips.ts has it) as a singer: R1 10 kΩ, R2 30 kΩ (pin 7 to
// the timing node in column 20), C1 47 nF, pin 3 driving the speaker through 100 Ω and 100 µF (about 437 Hz with pin 5
// free). A pitch knob stands on the right: R5 1 kΩ from plus, RV2 10 kΩ, R6 1 kΩ to minus; the wire WK from RV2's wiper
// is parked in an empty strip. The scope shows pin 5's volts with a pitch readout.
//
// Measured in the simulator: with pin 5 free it sits at 6.2 V (two thirds) and the note at 434 Hz; on the knob, pin 5
// runs from about 1.9 V to 8.1 V (the chip's ladder loads the knob's 0.8 to 8.6 V) and the note from about 815 Hz
// down to 275 Hz. In the fix-it the wire sits in pin 4's strip, which is tied to plus: the knob does nothing.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const hz = (lab: LabView) => lab.toneHz("SP1") ?? 0;
const onPin5 = (lab: LabView) => lab.connected("RV2.wiper", "U1.5");
/** The pitch's span over the last `seconds`, ignoring silence. */
const span = (lab: LabView, seconds: number) => {
  const tones = lab.toneHistory(seconds).map(([, f]) => f).filter((f) => f > 0);
  return tones.length ? Math.max(...tones) - Math.min(...tones) : 0;
};

/** The fix-it bench: the knob's wire in pin 4's strip instead of pin 5's. */
const ON_PIN4: SolutionStep[] = [
  { do: "unwire", wire: "WK" },
  { do: "wire", id: "WK", from: "g26", to: "c17", color: "green" },
];

export default defineLab({
  id: "bend-the-pitch",
  title: "Bend the note",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R1", kind: "resistor", at: "g15-g10", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "R2", kind: "resistor", at: "h15-h20", params: { ohms: 30_000 }, locked: true, label: "30 kΩ resistor R2" },
      { id: "C1", kind: "ceramic-cap", at: "b20-rail-:20", params: { farads: 47e-9 }, locked: true, label: "47 nF capacitor C1" },
      { id: "R3", kind: "resistor", at: "c16-c12", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R3" },
      { id: "C3", kind: "electrolytic-cap", at: "b12-b10", params: { farads: 100e-6, volts: 16 }, locked: true, label: "100 µF capacitor C3" },
      { id: "SP1", kind: "speaker", at: "desk:-62,60", holes: { a: "a10", b: "rail-:9" }, params: { ohms: 8 }, locked: true, label: "Speaker" },
      // Knob up turns the wiper toward the plus end: pin 5 up.
      { id: "R5", kind: "resistor", at: "top+:27-i27", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R5" },
      { id: "RV2", kind: "trimmer", at: "h25", params: { ohms: 10_000, position: 0.5 }, locked: true, label: "10 kΩ pitch knob RV2" },
      { id: "R6", kind: "resistor", at: "i25-top-:25", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R6" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a14", to: "rail-:14", color: "black" },
      { id: "W2", from: "j14", to: "top+:14", color: "red" },
      { id: "W3", from: "a17", to: "rail+:17", color: "red" },
      { id: "W4", from: "d15", to: "d20", color: "yellow" },
      { id: "W6", from: "i16", to: "i20", color: "yellow" },
      { id: "W7", from: "f20", to: "e20", color: "yellow" },
      { id: "W9", from: "j10", to: "top+:10", color: "red" },
      { id: "WK", from: "g26", to: "g22", color: "green" },
    ],
    tray: [],
    instruments: [{ kind: "scope", traces: [{ label: "Pin 5", volts: "U1.5" }], pitch: "SP1", window: 4, range: [0, 10] }],
    controls: [{ id: "knob", label: "Pitch knob RV2", part: "RV2", key: "position", min: 0, max: 1, value: 0.5, step: 0.005, unit: "%" }],
  },
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7, 4, 5] }],
  mascot: {
    hint: "Pin 5 is the control pin. Count from the notch.",
    fried: "That shouldn't happen here. Fresh chip in.",
  },
  tasks: [
    {
      id: "bend-it",
      prompt: "Plug the knob's green wire into pin 5's strip, then turn the knob.",
      goal: (lab) => onPin5(lab) && span(lab, 10) >= 200,
      hints: ["Drag the green wire's loose end to pin 5's strip.", "Pin 5 is the far row's right end. Then turn the knob."],
      highlight: ["wire:WK", "hole:g17"],
      success: "The note bends.",
    },
    {
      id: "up-is-down",
      prompt: "Turn pin 5 up, past 7.5 V.",
      goal: (lab) => onPin5(lab) && (lab.volts("U1.5") ?? 0) >= 7.4 && hz(lab) > 0 && hz(lab) <= 340,
      hints: ["Watch pin 5's trace climb as you turn.", "Turn the knob all the way up."],
      highlight: ["RV2"],
      success: "Lower! Pin 5 up, note down.",
    },
    {
      id: "full-map",
      prompt: "Look inside the chip.",
      goal: (lab) => lab.view("xray:U1"),
      hints: ["Open the x-ray."],
      success: "Three equal resistors make both lines.",
    },
    {
      id: "fix-knob-wire",
      prompt: "Make the pitch knob bend the note again.",
      setup: ON_PIN4,
      goal: (lab) => {
        if (!onPin5(lab)) lab.memory["brokeAt"] = lab.t;
        const at = lab.memory["brokeAt"] as number | undefined;
        return at !== undefined && onPin5(lab) && span(lab, Math.min(10, lab.t - at)) >= 200;
      },
      hints: ["Pin 4 resets. Which pin controls?", "Move the green wire's end from pin 4's strip to pin 5's. Then turn."],
      highlight: ["wire:WK"],
      success: "It bends. Pin 4 clears; pin 5 bends.",
    },
    {
      id: "warble",
      prompt: "Wiggle the knob back and forth, fast.",
      goal: (lab) => {
        if (!onPin5(lab)) return false;
        const tones = lab.toneHistory(4).map(([, f]) => f).filter((f) => f > 0);
        if (tones.length < 4) return false;
        const lo = Math.min(...tones);
        const hi = Math.max(...tones);
        if (hi - lo < 100) return false;
        const mid = (lo + hi) / 2;
        let crossings = 0;
        for (let k = 1; k < tones.length; k++) if ((tones[k - 1]! - mid) * (tones[k]! - mid) < 0) crossings++;
        return crossings >= 4;
      },
      hints: ["Turn it up and down, again and again."],
      success: "A siren! Pin 5 wiggled, the note wailed.",
      bonus: true,
    },
  ],
  solution: [
    { do: "unwire", wire: "WK" },
    { do: "wire", id: "WK", from: "g26", to: "g17", color: "green" },
    { do: "control", id: "knob", value: 0.1 },
    { do: "wait", seconds: 1 },
    { do: "control", id: "knob", value: 0.7 },
    { do: "wait", seconds: 1 },
    { do: "check", task: "bend-it" },
    { do: "control", id: "knob", value: 1 },
    { do: "wait", seconds: 1 },
    { do: "check", task: "up-is-down" },
    { do: "view", name: "xray:U1", on: true },
    { do: "check", task: "full-map" },
    ...ON_PIN4,
    { do: "control", id: "knob", value: 0.1 },
    { do: "wait", seconds: 1 },
    { do: "unwire", wire: "WK" },
    { do: "wire", id: "WK", from: "g26", to: "g17", color: "green" },
    { do: "control", id: "knob", value: 0.9 },
    { do: "wait", seconds: 1 },
    { do: "control", id: "knob", value: 0.1 },
    { do: "wait", seconds: 1 },
    { do: "check", task: "fix-knob-wire" },
    { do: "control", id: "knob", value: 0.9 },
    { do: "control", id: "knob", value: 0.1 },
    { do: "control", id: "knob", value: 0.9 },
    { do: "control", id: "knob", value: 0.1 },
    { do: "control", id: "knob", value: 0.9 },
    { do: "control", id: "knob", value: 0.1 },
    { do: "control", id: "knob", value: 0.9 },
    { do: "check", task: "warble" },
  ],
});
