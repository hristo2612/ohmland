// Blueprint: docs/curriculum/unit-2.md, Lesson 14 (its saturation half); docs/curriculum/conversion-guide.md, 14a.
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/transistors/all-the-way-on.
// One idea: with enough base flow a transistor is fully on, and more changes nothing.
//
// Lesson 13's circuit with Q1 in place (rows 20 to 22, LED in rows 22 and 23, button S1 in rows 14 and 16) and a
// 470 kΩ already in the base socket (row 16 to row 21). The learner reads Q1's collector-emitter voltage with S1
// held, then swaps in 10 kΩ and 4.7 kΩ.
//
// Measured in the simulator: 470 kΩ leaves Q1 half on, 5.5 V across it and 3.6 mA (LED glow 0.59); 10 kΩ turns it
// fully on, 0.11 V and 14.8 mA (glow 0.86); 4.7 kΩ gives 0.09 V and the same 14.8 mA. 1 MΩ: 6.5 V, 1.6 mA, glow 0.43.
// Half on Q1 dissipates about 20 mW and fully on about 2 mW; neither gets warm to the touch.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The resistor from row 16 to Q1's base (whichever one the learner put there), or null. */
const baseResistor = (lab: LabView): string | null => lab.bench.parts.find((p) => p.kind === "resistor" && lab.joins(p.id, "c16", "Q1.b"))?.id ?? null;
function baseOhms(lab: LabView): number | null {
  const id = baseResistor(lab);
  return id ? Number(lab.prop(id)?.["ohms"]) : null;
}

/** Q1's collector-emitter voltage. */
const vce = (lab: LabView) => lab.part("Q1")?.v ?? 9;
const glow = (lab: LabView) => lab.part("D1")?.glow ?? 0;
/** The meter on DC volts, red on the collector, black on the emitter. */
const meterOnCE = (lab: LabView) => lab.meter?.mode === "dcv" && lab.connected("probe:red", "Q1.c") && lab.connected("probe:black", "Q1.e");
/** S1 held with the meter across Q1, for a moment. */
const reading = (lab: LabView, key: string) => lab.heldFor(0.4, lab.closed("S1") && meterOnCE(lab), key);

/** The fix-it bench: a 1 MΩ in the base socket, so Q1 only half turns on. */
const ONE_MEG: SolutionStep[] = [
  { do: "remove", part: "R4" },
  { do: "place", part: "R6", kind: "resistor", at: "b16-b21", params: { ohms: 1_000_000 } },
];

export default defineLab({
  id: "all-the-way-on",
  title: "All the way on",
  bench: {
    board: "full",
    // The circuit (columns 12 to 27) on the left, room for the tool panel on the right, the loose probe tips in front.
    frame: ["top+:11", "rail-:40", "desk:-40,40"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:23-b23", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R1" },
      { id: "D1", kind: "led", at: "d23", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "Q1", kind: "npn", at: "c20", locked: true, label: "Q1 (2N3904)" },
      { id: "S1", kind: "pushbutton", at: "e14", params: { cap: "red" }, locked: true, label: "Button S1" },
      { id: "R2", kind: "resistor", at: "b16-b21", params: { ohms: 470_000 }, label: "470 kΩ base resistor R2" },
    ],
    wires: [
      { id: "W1", from: "a14", to: "rail+:15", color: "red" },
      { id: "W2", from: "a20", to: "rail-:21", color: "black" },
    ],
    tray: [
      { id: "R3", kind: "resistor", params: { ohms: 10_000 }, count: 1, label: "10 kΩ" },
      { id: "R4", kind: "resistor", params: { ohms: 4700 }, count: 1, label: "4.7 kΩ" },
    ],
    instruments: [{ kind: "meter", at: "desk:-178,22", rot: 16, mode: "dcv", tips: { red: "desk:-46,36", black: "desk:-36,37" } }],
  },
  mascot: {
    start: "All the way on, or all the way off. No dithering.",
    hint: "Black probe on the emitter, red on the collector.",
    fried: "Oof. That one's for the Hall.",
  },
  fried: { npn: "2N3904, base fed with no resistor" },
  tasks: [
    {
      id: "half-on",
      prompt: "Probe Q1, red on C and black on E. Hold S1.",
      goal: (lab) => baseOhms(lab) === 470_000 && reading(lab, "half") && vce(lab) > 2,
      hints: ["Red probe on row 22, black probe on row 20.", "Then hold the red button down."],
      highlight: ["pin:Q1.c", "pin:Q1.e"],
      nudges: [{ when: (lab) => meterOnCE(lab) && !lab.closed("S1"), say: "Now hold S1 down while you read." }],
      success: "Half on: about 5.5 V across it.",
    },
    {
      id: "active-vs-saturated",
      prompt: "Swap in 10 kΩ. Hold S1 and read again.",
      goal: (lab) => {
        if (baseOhms(lab) !== 10_000 || !reading(lab, "full") || vce(lab) >= 0.3) return false;
        lab.shared["ic10k"] = lab.amps("Q1");
        return true;
      },
      hints: ["Pull out the 470 kΩ. Bend the 10 kΩ from row 16 to row 21.", "Keep the probes on C and E, and hold S1."],
      highlight: ["hole:b16", "hole:b21"],
      success: "Fully on: about 0.1 V across it.",
    },
    {
      id: "no-brighter",
      prompt: "Swap to 4.7 kΩ: double the base current. Brighter?",
      goal: (lab) => {
        const was = lab.shared["ic10k"];
        const ic = lab.amps("Q1");
        const same = typeof was === "number" ? Math.abs(ic - was) <= was * 0.05 : ic > 0.014 && ic < 0.016;
        return baseOhms(lab) === 4700 && lab.closed("S1") && same;
      },
      hints: ["Swap the 10 kΩ for the 4.7 kΩ. Hold S1 and compare."],
      highlight: ["hole:b16", "hole:b21"],
      success: "No change. The LED's resistor sets the current now.",
    },
    {
      id: "fix-half-on",
      prompt: "The lamp switch only glows dimly. Fix it.",
      setup: ONE_MEG,
      // Half on first (the setup), then fully on while S1 is held.
      goal: (lab) => {
        if (lab.closed("S1") && vce(lab) > 2) lab.memory["half"] = true;
        if (baseOhms(lab) === 1_000_000) lab.memory["half"] = true;
        return lab.memory["half"] === true && lab.closed("S1") && vce(lab) < 0.3 && glow(lab) > 0.75;
      },
      hints: ["Probe Q1 with S1 held. Half on, or fully on?", "More base flow: a smaller base resistor."],
      highlight: ["hole:b16", "hole:b21"],
      success: "Fully on. Bright, and cool.",
    },
  ],
  solution: [
    { do: "probe", red: "Q1.c", black: "Q1.e" },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "half-on" },
    { do: "remove", part: "R2" },
    { do: "place", part: "R3", kind: "resistor", at: "b16-b21", params: { ohms: 10_000 } },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "active-vs-saturated" },
    { do: "remove", part: "R3" },
    { do: "place", part: "R4", kind: "resistor", at: "b16-b21", params: { ohms: 4700 } },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "no-brighter" },
    ...ONE_MEG,
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "remove", part: "R6" },
    { do: "place", part: "R3", kind: "resistor", at: "b16-b21", params: { ohms: 10_000 } },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "fix-half-on" },
  ],
});
