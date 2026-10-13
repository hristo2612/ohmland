// Lab for lesson `meet-the-transistor` (docs/curriculum/unit-2.md, Lesson 13).
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState. Tray
// comments give the ids the goals expect placed parts to get. A base resistor socket joins strips sb and qb.
// Instruments: meter (DC mA, 200 µA and 20 mA ranges).
// Numbers: 9 V through 470 kΩ gives about 17.8 µA of base current; through 220 kΩ about 38 µA. With β near 200 the
// LED gets about 3.6 mA and 7.6 mA, both short of saturation (about 15 mA through 470 Ω).
// SIM NEEDS: per-instance β 150 to 250 exposed to the lab; reverse-mode β 1 to 5 with a `reversed` event; near-instant
// death with an unlimited base current.
// LAB NEEDS: numeric answer entry checked against the instance Ic ÷ Ib (measure-gain).
// Damage moments: task 5 by design. Q1 with C and E swapped gives a dim LED (reverse β about 3) and a `reversed` event.
import { defineLab } from "@ohmland/lab";
import { between, closed, died, extraNum, happened, placed } from "./lib/goals";

export default defineLab({
  id: "meet-the-transistor",
  title: "A tiny current in charge",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // pins { a: vcc, b: la }
      { id: "R1", kind: "resistor", at: "rail+:10-a10", props: { ohms: 470 }, locked: true },
      // pins { anode: la, cathode: lc }
      { id: "D1", kind: "led", at: "e10-e14", props: { color: "red" }, locked: true },
      // pins { a: vcc, b: sb }
      { id: "S1", kind: "pushbutton", at: "rail+:20-a20", locked: true },
    ],
    tray: [
      // Q1: 2N3904. Target pins { c: lc, b: qb, e: gnd }
      { kind: "npn", props: { model: "2N3904" }, count: 1 },
      // Base resistors for the socket between sb and qb.
      { kind: "resistor", props: { ohms: 1000000 }, count: 1 },
      { kind: "resistor", props: { ohms: 470000 }, count: 1 },
      { kind: "resistor", props: { ohms: 220000 }, count: 1 },
      { kind: "wire", count: 4 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "place-q1",
      prompt:
        "Place `Q1` with its flat face toward you. Its legs are E, B, C from left to right. Put C in the LED's strip, B in the base strip and E on ground.",
      // GOAL: Q1's pins land on lc, qb and gnd respectively.
      goal: (lab) => placed(lab, "Q1") && !happened(lab, "Q1", "reversed") && extraNum(lab, "Q1", "vbc") !== undefined,
      hints: ["Hover over a leg to see its name.", "Flat face toward you, legs pointing down: the emitter is on the left."],
      success: "Correct way round. A backwards transistor sort of works, badly, which is the worst kind of bug.",
    },
    {
      id: "small-steers-big",
      prompt: "Put the 470 kΩ resistor in the base socket. Press `S1`.",
      // GOAL: D1 glow is above 0.15 with S1 held and below 0.02 with it released.
      goal: (lab) => closed(lab, "S1") && lab.isLit("D1", 0.15) && between(extraNum(lab, "Q1", "ib"), 12e-6, 24e-6),
      hints: ["The base resistor bridges the gap between the button's strip and the base strip."],
      success: "A trickle into the base, and a real current through the LED.",
    },
    {
      id: "measure-gain",
      prompt: "Measure the base current, then the collector current. Divide them to get the gain.",
      // GOAL: the learner's β entry is within 10% of the instance's Ic ÷ Ib at that operating point.
      goal: (lab) => closed(lab, "S1") && lab.meter?.mode === "dca-ma" && (extraNum(lab, "Q1", "beta") ?? 0) > 50,
      hints: [
        "Break the base path and put the meter in series, on the 200 µA range.",
        "Then do the same in the collector path, on the 20 mA range.",
      ],
      success: "Your transistor multiplies base current by about β. Every 2N3904 is a little different.",
    },
    {
      id: "double-it",
      prompt: "Swap to 220 kΩ. Predict the collector current first, then measure it.",
      // GOAL: the collector current with 220 kΩ is 1.7 to 2.4 times the value with 470 kΩ.
      goal: (lab) => closed(lab, "S1") && between(extraNum(lab, "Q1", "ib"), 30e-6, 46e-6) && lab.isLit("D1"),
      hints: ["About twice the base current. What does that do to the collector current?"],
      success: "About twice the base current, about twice the collector current.",
    },
    {
      id: "no-resistor",
      prompt: "Optional experiment: remove the base resistor and jumper `S1` straight to the base. Press once.",
      // GOAL: Q1 died (it lands in the Hall of Fried Parts).
      goal: (lab) => died(lab, "Q1"),
      hints: ["A plain jumper from the button's strip to the base strip."],
      success: "The base-emitter junction is like a diode. With no resistor, it took amps from the battery and burned out in a blink.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
