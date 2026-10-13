// Lab for lesson `touch-switch` (docs/curriculum/unit-2.md, Lesson 14).
// The lesson 13 circuit with Q1 placed. Netlist pins are noted beside each part; `at` anchors are provisional until
// packages/bench owns BenchState. Tray comments give the ids the goals expect placed parts to get.
// Numbers: 470 kΩ leaves Q1 active (Vce about 5 V); 10 kΩ gives about 0.83 mA of base current, plenty to saturate it
// (Vce under 0.2 V, about 15 mA). The touch pads span 100 kΩ (firm, damp) to 2 MΩ (light, dry). Through R5 and 2 MΩ a
// single transistor passes under 1 mA; a Darlington pair saturates Q1, though Q1's Vce can't fall below about 0.8 V.
// BENCH NEEDS: the fingertip prop, whose pressure and moisture sliders drive T1's `ohms` input via setInput.
// LAB NEEDS: logged readings per base resistor (active-vs-saturated, no-brighter) and glow history (touch-it).
// Damage moments: removing R5 and bridging the pads with a wire puts the battery across Q2's and Q1's base-emitter
// junctions in a row with nothing to limit the current: both die. Robot: "That's what R5 is for. Fingers are never
// zero ohms, but wires are." Fingertips alone are safe at 9 V; one fingertip only.
import { defineLab, type LabView } from "@ohmland/lab";
import { between, closed, extraNum, glow, ohmsOf, placed } from "./lib/goals";

/** Q1's collector-emitter voltage (npn PartState.v is Vce). */
const vce = (lab: LabView): number | undefined => lab.part("Q1")?.v;

export default defineLab({
  id: "touch-switch",
  title: "All the way on",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // pins { a: vcc, b: la } and { anode: la, cathode: lc }
      { id: "R1", kind: "resistor", at: "rail+:10-a10", props: { ohms: 470 }, locked: true },
      { id: "D1", kind: "led", at: "e10-e14", props: { color: "red" }, locked: true },
      // pins { c: lc, b: qb, e: gnd }
      { id: "Q1", kind: "npn", at: "a14", props: { model: "2N3904" } },
      // pins { a: vcc, b: sb }. The base resistor socket joins sb and qb.
      { id: "S1", kind: "pushbutton", at: "rail+:20-a20" },
    ],
    tray: [
      // Base resistors.
      { kind: "resistor", props: { ohms: 470000 }, count: 1 },
      { kind: "resistor", props: { ohms: 10000 }, count: 1 },
      { kind: "resistor", props: { ohms: 4700 }, count: 1 },
      // R5: 10 kΩ, protects the base when the touch pads are used.
      { kind: "resistor", props: { ohms: 10000 }, count: 1 },
      // T1: the touch pads. pins { a: pad1, b: pad2 }. The fingertip prop sets ohms from 100 kΩ to 2 MΩ.
      { kind: "probe-resistance", props: { ohms: 2000000 }, count: 1 },
      // Q2: a second 2N3904 for the Darlington pair.
      { kind: "npn", props: { model: "2N3904" }, count: 1 },
      { kind: "wire", count: 4 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "active-vs-saturated",
      prompt:
        "With 470 kΩ in the base, hold `S1` and measure the voltage from collector to emitter. Then swap to 10 kΩ and measure again.",
      // GOAL: the logged Vce is above 2 V with 470 kΩ and below 0.3 V with 10 kΩ.
      goal: (lab) =>
        closed(lab, "S1") &&
        lab.meter?.mode === "dcv" &&
        between(extraNum(lab, "Q1", "ib"), 0.6e-3, 1.1e-3) &&
        (vce(lab) ?? 9) < 0.3,
      hints: ["Black probe on the emitter, red on the collector."],
      success: "With plenty of base current, `Q1` is fully on, with only about 0.1 V across it. That's saturation.",
    },
    {
      id: "no-brighter",
      prompt: "Swap to 4.7 kΩ to double the base current again. Does the LED get brighter?",
      // GOAL: the collector current with 4.7 kΩ is within 5% of the value with 10 kΩ.
      goal: (lab) => closed(lab, "S1") && (extraNum(lab, "Q1", "ib") ?? 0) > 1.4e-3 && (vce(lab) ?? 9) < 0.3,
      hints: ["Compare the LED with how it looked on 10 kΩ."],
      success: "No change. In saturation the LED and its resistor set the current, not the transistor.",
    },
    {
      id: "touch-it",
      prompt: "Replace the base resistor and the button with the touch pads, in series with `R5`. Touch lightly, then firmly.",
      // GOAL: D1's glow with the touch at 2 MΩ is less than half its glow at 100 kΩ.
      goal: (lab) =>
        placed(lab, "T1") && placed(lab, "R5") && !placed(lab, "Q2") && (ohmsOf(lab, "T1") ?? 0) > 1.5e6 && between(glow(lab, "D1"), 0.05, 0.45),
      hints: ["The fingertip slider sets how firm and damp your touch is."],
      success: "It works, but only with a firm touch. A single transistor's gain isn't quite enough for a light one.",
    },
    {
      id: "darlington",
      prompt: "Add `Q2`: its emitter drives `Q1`'s base, its collector joins `Q1`'s collector, and the touch pads feed `Q2`'s base.",
      // GOAL: with the touch at 2 MΩ, D1's glow is at least 85% of its saturated glow from task 1.
      goal: (lab) => placed(lab, "Q2") && (ohmsOf(lab, "T1") ?? 0) > 1.5e6 && glow(lab, "D1") > 0.73,
      hints: ["`Q2`'s emitter goes into the strip with `Q1`'s base.", "`R5` stays in series with the pads."],
      success: "Feather touch, full light. `Q2`'s gain multiplies `Q1`'s: roughly 200 × 200 = 40,000.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors and the fingertip prop.
  solution: [],
});
