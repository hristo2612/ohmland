// Blueprint: docs/curriculum/unit-2.md, Lesson 13. R1 (470 Ω) runs from the + rail into row 23; the red LED's long leg
// is in row 23 and its short leg in row 22. Q1 goes in rows 20 to 22 (E B C, flat face toward you), with row 20
// jumped to the minus rail. Button S1 (rows 14 and 16) gives row 16 plus; the base resistor bridges row 16 to Q1's
// base in row 21. The meter starts on its milliamp sockets for measuring the base and collector currents in series.
//
// Measured in the simulator: with 470 kΩ the base gets about 17.7 µA and the LED about 3.4 mA (this Q1's gain is
// about 190); with 220 kΩ about 38 µA and 7 mA, about twice. A plain jumper to the base kills Q1 at once.
import { defineLab, type LabView } from "@ohmland/lab";

/** The resistor in the base socket (from row 16 to Q1's base), as its marked value, or null. */
function baseOhms(lab: LabView): number | null {
  for (const p of lab.bench.parts) if (p.kind === "resistor" && lab.joins(p.id, "S1.b1", "Q1.b")) return Number(lab.prop(p.id)?.["ohms"]);
  return null;
}

const ic = (lab: LabView) => lab.amps("Q1");

export default defineLab({
  id: "meet-the-transistor",
  title: "A tiny current in charge",
  bench: {
    board: "full",
    frame: ["desk:-92,-30", "desk:-6,74"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:23-b23", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R1" },
      { id: "D1", kind: "led", at: "d23", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "S1", kind: "pushbutton", at: "e14", params: { cap: "red" }, locked: true, label: "Button S1" },
    ],
    wires: [
      { id: "W1", from: "a14", to: "rail+:15", color: "red" },
      { id: "W2", from: "a20", to: "rail-:21", color: "black" },
    ],
    tray: [
      { id: "Q1", kind: "npn", count: 1, label: "2N3904" },
      { id: "R2", kind: "resistor", params: { ohms: 1_000_000 }, count: 1, label: "1 MΩ" },
      { id: "R3", kind: "resistor", params: { ohms: 470_000 }, count: 1, label: "470 kΩ" },
      { id: "R4", kind: "resistor", params: { ohms: 220_000 }, count: 1, label: "220 kΩ" },
    ],
    instruments: [{ kind: "meter", at: "desk:-40,76", rot: 0, mode: "dca-ma", range: "200uA", red: "ma", black: "com" }],
  },
  mascot: {
    start: "Tiny trickle, big river. I love this part.",
    hint: "E, B, C. Flat face, friendly face.",
    success: "A trickle in the base, a stream through the LED.",
    fried: "That transistor gave its life for science. Hall of Fried Parts, row two.",
    exit: "Base current in, collector current out, about two hundred times bigger.",
  },
  fried: { npn: "2N3904, base with no resistor" },
  tasks: [
    {
      id: "place-q1",
      prompt: "Place **Q1** with its flat face toward you: its legs are E, B, C from left to right. Put E in row 20, B in row 21 and C in row 22, the LED's short-leg row.",
      goal: (lab) => lab.connected("Q1.c", "D1.cathode") && lab.connected("Q1.e", "B1.neg") && lab.connected("Q1.b", "c21"),
      hints: ["Hover a leg to see its name.", "Flat face toward you, legs pointing down: the emitter is on the left. Drop it on row 20 near the channel."],
      highlight: ["hole:c20", "hole:c21", "hole:c22"],
      success: "Correct way round. A backwards transistor sort of works, badly, which is the worst kind of bug.",
    },
    {
      id: "small-steers-big",
      prompt: "Put the **470 kΩ** resistor in the base socket: from row 16 (the button's strip) to row 21 (the base). Press S1.",
      goal: (lab) => {
        if (baseOhms(lab) !== 470_000) return false;
        if (lab.closed("S1") && (lab.part("D1")?.glow ?? 0) > 0.15) lab.memory["on"] = true;
        if (!lab.closed("S1") && (lab.part("D1")?.glow ?? 1) < 0.02) lab.memory["off"] = true;
        if (lab.closed("S1") && lab.part("Q1")?.extra?.["region"] === "active") {
          lab.shared["ic470"] = ic(lab);
          lab.shared["beta470"] = lab.actual("Q1", "beta");
        }
        return lab.memory["on"] === true && lab.memory["off"] === true;
      },
      hints: ["Bend the resistor's legs to reach from row 16 to row 21.", "Hold the button down and watch the LED."],
      highlight: ["hole:b16", "hole:b21"],
      success: "A trickle into the base, a real current through the LED.",
    },
    {
      id: "measure-gain",
      prompt: "Measure the base current, then the collector current, and type their ratio: the gain.",
      note: { id: "beta", label: "Gain (collector ÷ base)", unit: "" },
      goal: (lab) => {
        if (lab.closed("S1") && baseOhms(lab) === 470_000 && lab.part("Q1")?.extra?.["region"] === "active") {
          lab.shared["ic470"] = ic(lab);
          lab.shared["beta470"] = lab.actual("Q1", "beta");
        }
        const beta = lab.shared["beta470"];
        const x = lab.note("beta");
        return typeof beta === "number" && x !== null && Math.abs(x - beta) <= beta * 0.1;
      },
      hints: [
        "Break the base path: move one end of the resistor to an empty row, then bridge the gap with the meter's probes. Use the 200 µA range and hold S1.",
        "Then do the same in the collector path, between R1 and the LED, on the 20 mA range.",
      ],
      success: "Your transistor multiplies base current by about β. Every 2N3904 is a little different.",
    },
    {
      id: "double-it",
      prompt: "Swap the base resistor for **220 kΩ**. Predict the collector current first, then press S1 and see.",
      goal: (lab) => {
        const was = lab.shared["ic470"];
        return baseOhms(lab) === 220_000 && lab.closed("S1") && typeof was === "number" && ic(lab) / was >= 1.7 && ic(lab) / was <= 2.4;
      },
      hints: ["About twice the base current. What does that do to the collector current?"],
      success: "About twice the base current, about twice the collector current.",
    },
    {
      id: "no-resistor",
      prompt: "Optional experiment: remove the base resistor and put a plain jumper from row 16 to the base. Press S1 once.",
      goal: (lab) => lab.died("Q1"),
      hints: ["A plain jumper from the button's strip to the base strip, with the Wire tool."],
      success: "The base-emitter junction is like a diode. With no resistor, it took amps from the battery and burned out in a blink.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "Q1", kind: "npn", at: "c20" },
    { do: "check", task: "place-q1" },
    { do: "place", part: "R3", kind: "resistor", at: "b16-b21", params: { ohms: 470_000 } },
    { do: "press", part: "S1", seconds: 1 },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "small-steers-big" },
    { do: "press", part: "S1", seconds: 1 },
    { do: "note", id: "beta", value: "190" },
    { do: "check", task: "measure-gain" },
    { do: "remove", part: "R3" },
    { do: "place", part: "R4", kind: "resistor", at: "b16-b21", params: { ohms: 220_000 } },
    { do: "press", part: "S1", seconds: 1 },
    { do: "check", task: "double-it" },
  ],
});
