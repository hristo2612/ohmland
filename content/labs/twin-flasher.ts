// Lab for lesson `twin-flasher` (docs/curriculum/unit-2.md, Lesson 17).
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState. Tray
// comments give the ids the goals expect placed parts to get.
// Instruments: meter and a 2-channel scope with slow motion (BenchConfig only lists "meter" today).
// Numbers: 68 kΩ x 10 µF gives a half period of about 0.69 RC = 0.47 s (0.94 s a cycle) on paper; with the LEDs the
// collector swings about 7.3 V, so about 0.63 RC = 0.43 s a half. 22 µF roughly doubles it.
// SIM NEEDS: 2N3904 base-emitter reverse breakdown starting near 7 V (rating 6 V) that clips the negative base swing
// softly with no damage at microamps; a transient solver handling 10 µs to 10 ms steps.
// LAB NEEDS: blink period and overlap from glow history (cross-couple, slow-it-down); scope capture (look-inside).
// Damage moments: a capacitor wired to its own transistor's base instead of crossing over stops the oscillation (one
// LED stuck on). Swapping the 1 kΩ and 68 kΩ positions starves the LEDs and stalls the flasher. Electrolytics in
// backwards give a `reversed` warning but survive at these currents.
import { defineLab } from "@ohmland/lab";
import { closed, glow, placed, volts } from "./lib/goals-switching";

export default defineLab({
  id: "twin-flasher",
  title: "The twin blinker",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // Power switch. pins { a: vcc, b: vp }
      { id: "S1", kind: "switch", at: "rail+:3-a3", props: { closed: false }, locked: true },
      // Left half. pins { a: vp, b: a1 }, { anode: a1, cathode: c1 }, { c: c1, b: b1, e: gnd }
      { id: "R1", kind: "resistor", at: "e3-e10", props: { ohms: 1000 }, locked: true },
      { id: "D1", kind: "led", at: "a10-a14", props: { color: "red" }, locked: true },
      { id: "Q1", kind: "npn", at: "e14", props: { model: "2N3904" }, locked: true },
      // Right half. pins { a: vp, b: a2 }, { anode: a2, cathode: c2 }, { c: c2, b: b2, e: gnd }
      { id: "R2", kind: "resistor", at: "j3-j30", props: { ohms: 1000 }, locked: true },
      { id: "D2", kind: "led", at: "f30-f34", props: { color: "red" }, locked: true },
      { id: "Q2", kind: "npn", at: "j34", props: { model: "2N3904" }, locked: true },
    ],
    tray: [
      // R3 and R4: 68 kΩ base resistors (vp to b1, vp to b2).
      { kind: "resistor", props: { ohms: 68000 }, count: 2 },
      // C1 and C2: 10 µF, 16 V (c1 to b2, c2 to b1, + leg on the collector).
      { kind: "capacitor", props: { farads: 0.00001, volts: 16, polarized: true }, count: 2 },
      // C3 and C4: 22 µF, 16 V, for slow-it-down.
      { kind: "capacitor", props: { farads: 0.000022, volts: 16, polarized: true }, count: 2 },
      { kind: "wire", count: 4 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "bases-up",
      prompt: "Add a 68 kΩ resistor from the supply to each transistor's base. Switch on.",
      // GOAL: both LEDs glow above 0.5 and stay steady (ripple below 0.05).
      goal: (lab) => closed(lab, "S1") && !placed(lab, "C1") && !placed(lab, "C2") && glow(lab, "D1") > 0.5 && glow(lab, "D2") > 0.5,
      hints: ["Each 68 kΩ runs from the switched supply strip to one base."],
      success: "Two independent switches, both on. Nothing interesting yet. Let's make them talk.",
    },
    {
      id: "cross-couple",
      prompt:
        "Add a 10 µF capacitor from `Q1`'s collector to `Q2`'s base, and another from `Q2`'s collector to `Q1`'s base. The + leg goes to the collector.",
      // GOAL: D1 and D2 each blink with a period of 0.6 to 1.3 s, and their lit times overlap less than 20%.
      goal: (lab) => closed(lab, "S1") && placed(lab, "C1") && placed(lab, "C2") && lab.isLit("D1", 0.5) !== lab.isLit("D2", 0.5),
      hints: ["Each capacitor crosses over: a collector on one side, the other base on the other.", "Stripe (negative) toward the base."],
      success: "They take turns! No moving parts, no wear, no clicks.",
    },
    {
      id: "look-inside",
      prompt: "Set the scope to slow motion. Channel 1 on `Q2`'s base, channel 2 on `Q1`'s collector.",
      // GOAL: the scope has captured Q2's base going below -4 V at least once.
      goal: (lab) => placed(lab, "C1") && placed(lab, "C2") && (volts(lab, "b2") ?? 0) < -4,
      hints: ["The scope's ground clip stays on the minus rail."],
      success:
        "`Q2`'s base dives far below zero, then climbs back along a familiar curve. When it reaches about 0.7 V, `Q2` switches on.",
    },
    {
      id: "slow-it-down",
      prompt: "Swap both capacitors for 22 µF. Predict the new period, then check.",
      // GOAL: the blink period is 1.3 to 2.9 s.
      goal: (lab) =>
        closed(lab, "S1") &&
        placed(lab, "C3") &&
        placed(lab, "C4") &&
        !placed(lab, "C1") &&
        !placed(lab, "C2") &&
        lab.isLit("D1", 0.5) !== lab.isLit("D2", 0.5),
      hints: ["Same places, same way round: + leg to the collector."],
      success: "About twice the capacitance, about twice the period. Same rule as every RC circuit.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
