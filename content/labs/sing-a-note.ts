// Blueprint: docs/curriculum/unit-4.md, CH8. A bench lesson (docs/LESSONS.md): content/units/chips/alarm/sing-a-note.
// One idea: R1, R2 and C set the pitch: about 1.44 ÷ ((R1 + 2 × R2) × C). New: the formula.
//
// The alarm module's astable layout (content/labs/meet-the-chips.ts has it), its R2 a 10 kΩ resistor (pin 7 to column
// 19) in series with RV1, a 50 kΩ trimmer (its first end in column 19, its wiper in column 20, the timing node): 10 kΩ
// + knob × 50 kΩ in all. C1 is 47 nF ("473") on the near side of column 20. Pin 3 drives the speaker through R3 100 Ω
// and C3 100 µF
// (plus toward pin 3). The scope shows pin 3 with a pitch readout. The tray holds C4, 4.7 nF ("472"), to drop onto C1.
//
// Measured in the simulator: 1,000 to 1,050 Hz with the knob at zero (the formula gives 1,021 Hz; ceramics spread by
// up to 9%), about 236 Hz at the top; 440 Hz near 40% of the knob; 4.7 nF sings ten times higher.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { actual } from "./lib/timer555";

const knob = (lab: LabView) => {
  const p = lab.part("RV1")?.extra?.["position"];
  return typeof p === "number" ? p : (lab.control("knob") ?? 0);
};
const hz = (lab: LabView) => lab.toneHz("SP1") ?? 0;
const timing = (lab: LabView, c: string) => lab.joins(c, "U1.6", "B1.neg");
/** The pitch has stayed within `tol` Hz of `f` for a second. */
const holds = (lab: LabView, f: number, tol: number) => lab.heldFor(1, Math.abs(hz(lab) - f) <= tol);

/** Knob settings for 440 Hz and 880 Hz with the replay's parts (ceramics spread by id without a learner seed). */
const KNOB_440 = 0.4;
const KNOB_880 = 0.05;

/** The fix-it bench: the 4.7 nF where the 47 nF belongs. */
const SMALL_C: SolutionStep[] = [{ do: "move", part: "C4", at: "on:C1" }];

export default defineLab({
  id: "sing-a-note",
  title: "Tune to A",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R1", kind: "resistor", at: "h15-h10", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "R2", kind: "resistor", at: "g15-g19", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R2" },
      { id: "RV1", kind: "trimmer", at: "h19", params: { ohms: 50_000, position: 0.6 }, locked: true, label: "50 kΩ knob RV1" },
      { id: "C1", kind: "ceramic-cap", at: "b20-rail-:20", params: { farads: 47e-9 }, label: "47 nF capacitor C1" },
      { id: "R3", kind: "resistor", at: "c16-c12", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R3" },
      { id: "C3", kind: "electrolytic-cap", at: "b12-b10", params: { farads: 100e-6, volts: 16 }, locked: true, label: "100 µF capacitor C3" },
      { id: "SP1", kind: "speaker", at: "desk:-62,60", holes: { a: "a10", b: "rail-:9" }, params: { ohms: 8 }, locked: true, label: "Speaker" },
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
    ],
    tray: [{ id: "C4", kind: "ceramic-cap", params: { farads: 4.7e-9 }, count: 1, label: "4.7 nF capacitor" }],
    instruments: [{ kind: "scope", traces: [{ label: "Pin 3", volts: "U1.3" }], pitch: "SP1", window: 2, range: [0, 10] }],
    controls: [{ id: "knob", label: "Knob RV1", part: "RV1", key: "position", min: 0, max: 1, value: 0.6, step: 0.002, unit: "%" }],
  },
  mascot: {
    hint: "Turn slowly. The readout catches up.",
    fried: "My voice box overheated. Keep the 100 Ω in.",
  },
  // The 555 map so far (the notebook draws it on the signed-off page).
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7, 4] }],
  tasks: [
    {
      id: "slide-the-note",
      prompt: "Turn the knob slowly and listen.",
      goal: (lab) => {
        const tones = lab.toneHistory(10).map(([, f]) => f).filter((f) => f > 0);
        return tones.length > 0 && Math.max(...tones) - Math.min(...tones) >= 300;
      },
      hints: ["Drag the knob round, or use its slider.", "Turn it all the way one way, then the other."],
      highlight: ["RV1"],
      success: "The note slides.",
    },
    {
      id: "tenth-c",
      prompt: "Drop the 4.7 nF onto the 47 nF.",
      goal: (lab) => {
        if (timing(lab, "C1") && hz(lab) > 0) lab.memory["before"] = hz(lab);
        const before = lab.memory["before"] as number | undefined;
        return timing(lab, "C4") && !timing(lab, "C1") && before !== undefined && hz(lab) >= 5 * before;
      },
      hints: ["Drag the 4.7 nF from the tray right onto the 47 nF. They swap."],
      highlight: ["C1"],
      success: "Ten times higher. A squeak!",
    },
    {
      id: "back-to-47",
      prompt: "Put the 47 nF back, then turn the knob all the way down.",
      goal: (lab) => timing(lab, "C1") && !timing(lab, "C4") && knob(lab) <= 0.02 && hz(lab) > 800 && hz(lab) < 1250,
      hints: ["Drop the 47 nF back onto the 4.7 nF.", "Then turn the knob right down to zero."],
      highlight: ["RV1"],
      success: "About 1,000 Hz.",
    },
    {
      id: "tune-a",
      prompt: "Tune the note to A: 440 Hz.",
      goal: (lab) => timing(lab, "C1") && holds(lab, 440, 9),
      hints: ["Too high? Turn toward more ohms.", "Small turns. Let the readout settle."],
      highlight: ["RV1"],
      success: "440 Hz: the note A.",
    },
    {
      id: "fix-squeak",
      prompt: "Stop the squeak: give my lighthouse its own note back.",
      setup: SMALL_C,
      // The knob stays wherever the learner left it (the secret's 880 Hz, say), so the goal asks for the pitch the
      // formula gives for the 47 nF at that knob.
      goal: (lab) => {
        if (!timing(lab, "C1")) lab.memory["broken"] = true;
        const want = 1.44 / ((actual(lab, "R1") + 2 * (actual(lab, "R2") + knob(lab) * 50_000)) * actual(lab, "C1"));
        return lab.memory["broken"] === true && timing(lab, "C1") && !timing(lab, "C4") && Math.abs(hz(lab) - want) <= 0.1 * want;
      },
      hints: ["Which code means 47 nF?", "472 is 4.7 nF. Swap the 473 back in."],
      highlight: ["C4"],
      success: "Back to its note. 472 is 4.7 nF; 473 is 47.",
    },
    {
      id: "octave",
      prompt: "Find the A one octave up: 880 Hz.",
      goal: (lab) => timing(lab, "C1") && holds(lab, 880, 18),
      hints: ["Double the pitch. Turn toward fewer ohms."],
      success: "880 Hz. Double the pitch, an octave.",
      bonus: true,
    },
  ],
  solution: [
    { do: "control", id: "knob", value: 0.9 },
    { do: "wait", seconds: 1 },
    { do: "control", id: "knob", value: 0.2 },
    { do: "wait", seconds: 1 },
    { do: "check", task: "slide-the-note" },
    { do: "place", part: "C4", kind: "ceramic-cap", at: "on:C1", params: { farads: 4.7e-9 } },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "tenth-c" },
    { do: "move", part: "C1", at: "on:C4" },
    { do: "control", id: "knob", value: 0 },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "back-to-47" },
    { do: "control", id: "knob", value: KNOB_440 },
    { do: "wait", seconds: 2 },
    { do: "check", task: "tune-a" },
    ...SMALL_C,
    { do: "wait", seconds: 1 },
    { do: "move", part: "C1", at: "on:C4" },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "fix-squeak" },
    { do: "control", id: "knob", value: KNOB_880 },
    { do: "wait", seconds: 2 },
    { do: "check", task: "octave" },
  ],
});

