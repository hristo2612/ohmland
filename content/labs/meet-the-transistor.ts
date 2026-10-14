// Blueprint: docs/curriculum/unit-2.md, Lesson 13 (its first half); docs/curriculum/conversion-guide.md, 13.
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/transistors/meet-the-transistor.
// One idea: a trickle into the base lets a big flow through. Measuring the gain moved to count-the-gain.
//
// R1 (470 Ω) runs from the + rail into row 23; the red LED's long leg is in row 23 and its short leg in row 22. Q1
// goes in rows 20 to 22 (E B C, flat face toward you), with row 20 jumped to the minus rail. Button S1 (rows 14 and
// 16) gives row 16 plus; the base resistor R3 (470 kΩ) already bridges row 16 to Q1's base in row 21.
//
// Measured in the simulator: pressing S1 sends 17.7 µA into the base and 3.6 mA through the LED (this Q1's gain is
// about 205). Q1 in backwards (C and E swapped) lights the LED faintly, about 0.17 mA. A plain jumper past R3 kills
// Q1 at once.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The resistor from row 16 to Q1's base, as its marked value, or null. */
function baseOhms(lab: LabView): number | null {
  for (const p of lab.bench.parts) if (p.kind === "resistor" && lab.joins(p.id, "c16", "Q1.b")) return Number(lab.prop(p.id)?.["ohms"]);
  return null;
}

/** Q1 sits the right way round: collector on the LED, emitter on minus, base on the base resistor's row. */
const placedRight = (lab: LabView) => lab.connected("Q1.c", "D1.cathode") && lab.connected("Q1.e", "B1.neg") && lab.connected("Q1.b", "c21");
/** Q1 in rows 20 to 22 but turned round: collector on minus, emitter on the LED. */
const backwards = (lab: LabView) => lab.connected("Q1.e", "D1.cathode") && lab.connected("Q1.c", "B1.neg");
const glow = (lab: LabView) => lab.part("D1")?.glow ?? 0;

/** The fix-it bench: Q1 back in its rows but turned round, flat face away. */
const Q1_BACKWARDS: SolutionStep[] = [
  { do: "remove", part: "Q1" },
  { do: "place", part: "Q1", kind: "npn", at: "c22", rot: 180 },
];

export default defineLab({
  id: "meet-the-transistor",
  title: "A tiny current in charge",
  bench: {
    board: "full",
    // The circuit's columns, 12 to 27.
    frame: ["top+:12", "rail-:27"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:23-b23", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R1" },
      { id: "D1", kind: "led", at: "d23", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "S1", kind: "pushbutton", at: "e14", params: { cap: "red" }, locked: true, label: "Button S1" },
      { id: "R3", kind: "resistor", at: "b16-b21", params: { ohms: 470_000 }, label: "470 kΩ base resistor R3" },
    ],
    wires: [
      { id: "W1", from: "a14", to: "rail+:15", color: "red" },
      { id: "W2", from: "a20", to: "rail-:21", color: "black" },
    ],
    tray: [{ id: "Q1", kind: "npn", params: { model: "2N3904" }, count: 1, label: "Transistor" }],
    instruments: [],
  },
  mascot: {
    start: "Tiny trickle, big river. I love this part.",
    hint: "E, B, C. Flat face, friendly face.",
    fried: "That transistor gave its life for science.",
  },
  fried: { npn: "2N3904, base with no resistor" },
  tasks: [
    {
      id: "place-q1",
      prompt: "Place Q1, flat face toward you, legs in strips 20, 21, 22.",
      goal: placedRight,
      hints: ["Hover a leg to see its name.", "Flat face toward you: E, B, C from left to right."],
      highlight: ["hole:c20", "hole:c21", "hole:c22"],
      nudges: [{ when: backwards, say: "Backwards. Flat face toward you, please." }],
      success: "Right way round.",
    },
    {
      id: "small-steers-big",
      prompt: "Press S1.",
      goal: (lab) => {
        if (baseOhms(lab) !== 470_000 || !placedRight(lab)) return false;
        if (lab.closed("S1") && glow(lab) > 0.15) lab.memory["on"] = true;
        if (!lab.closed("S1") && glow(lab) < 0.02) lab.memory["off"] = true;
        return lab.memory["on"] === true && lab.memory["off"] === true;
      },
      hints: ["Press the red button, then let go. Watch the LED."],
      highlight: ["S1"],
      success: "A trickle in, a real current out.",
    },
    {
      id: "fix-backwards",
      prompt: "The LED is dim. Fix it.",
      setup: Q1_BACKWARDS,
      // Backwards first (the setup), then right way round and bright while S1 is held.
      goal: (lab) => {
        if (backwards(lab)) lab.memory["backwards"] = true;
        return lab.memory["backwards"] === true && placedRight(lab) && lab.closed("S1") && glow(lab) > 0.3;
      },
      hints: ["Which way does Q1's flat face point?", "Flat face toward you: E in strip 20, C in strip 22."],
      highlight: ["Q1"],
      nudges: [{ when: (lab) => backwards(lab) && lab.closed("S1"), say: "Dim. Something's backwards here." }],
      success: "Bright again.",
    },
    {
      id: "no-resistor",
      prompt: "Jumper straight past the base resistor. Press S1.",
      goal: (lab) => lab.died("Q1"),
      hints: ["Draw a wire from strip 16 to strip 21, beside R3. Then press S1."],
      success: "Nothing held the base flow back.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "Q1", kind: "npn", at: "c20" },
    { do: "check", task: "place-q1" },
    { do: "press", part: "S1", seconds: 1 },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "small-steers-big" },
    ...Q1_BACKWARDS,
    { do: "press", part: "S1", seconds: 0.5 },
    { do: "remove", part: "Q1" },
    { do: "place", part: "Q1", kind: "npn", at: "c20" },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "fix-backwards" },
    // The secret: a jumper beside R3 feeds the base straight from plus.
    { do: "wire", id: "W3", from: "a16", to: "a21", color: "yellow" },
    { do: "press", part: "S1", seconds: 0.5 },
    { do: "check", task: "no-resistor" },
  ],
});
