// Lab for lesson `delay-timer` (docs/curriculum/unit-2.md, Lesson 15).
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState. Tray
// comments give the ids the goals expect placed parts to get.
// Instruments: meter and a stopwatch (LAB NEEDS: starts on the S1 switch event, stops on the K1 pull-in event).
// Numbers: with the coil fed straight from C1, the 1 kΩ and the 540 Ω coil divide 9 V to 3.16 V, so it never clicks.
// With Q1 as an emitter follower the relay clicks when C1 reaches about 6.7 V: t = τ x ln(9 / 2.3), about 1.36 τ.
// P1 starts at position 0 (0 Ω), so τ = 1 s and the delay is about 1.4 s. Five seconds needs τ near 3.67 s, so P1
// near 2.7 kΩ (position about 0.27); 4.5 to 5.5 s means positions from about 0.23 to 0.30.
// LAB NEEDS: numeric entry for the no-click reading; run timing for every task.
// Damage moments: wiring Q1's base directly to v (bypassing R1 and P1) puts the battery across the base-emitter
// junction and the coil: Q1 overheats and dies. Wiring P1 across its two ends gives a fixed 10 kΩ with no adjustment
// (robot hint).
// Notice: the emitter follows the capacitor about 0.7 V below it, and the relay clicks when the emitter reaches pull-in.
import { defineLab } from "@ohmland/lab";
import { between, closed, extraNum, placed, pullIns, volts } from "./lib/goals";

export default defineLab({
  id: "delay-timer",
  title: "Wait for it",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // "Start" switch. pins { a: vcc, b: v }
      { id: "S1", kind: "switch", at: "rail+:3-a3", props: { closed: false }, locked: true },
      // pins { a: v, b: t }
      { id: "R1", kind: "resistor", at: "e3-e8", props: { ohms: 1000 }, locked: true },
      // Trimmer used as a variable resistor. pins { a: t, wiper: bnode, b: bnode }
      { id: "P1", kind: "pot", at: "a8", props: { ohms: 10000, position: 0 }, locked: true },
      // pins { pos: bnode, neg: gnd }
      { id: "C1", kind: "capacitor", at: "a12-rail-:12", props: { farads: 0.001, volts: 16, polarized: true }, locked: true },
      // "Reset" button and its resistor. pins { a: bnode, b: rs } and { a: rs, b: gnd }
      { id: "S2", kind: "pushbutton", at: "c12-c16", locked: true },
      { id: "R3", kind: "resistor", at: "e16-rail-:16", props: { ohms: 100 }, locked: true },
      // pins { coilA: k1a, coilB: gnd, com: v, no: kno, nc: knc }
      { id: "K1", kind: "relay", at: "e25", props: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true },
      // Protection diode. pins { anode: gnd, cathode: k1a }
      { id: "D1", kind: "diode", at: "rail-:24-a24", props: { model: "1N4001" }, locked: true },
      // pins { a: kno, b: g } and { anode: g, cathode: gnd }
      { id: "R2", kind: "resistor", at: "j27-j33", props: { ohms: 470 }, locked: true },
      { id: "D2", kind: "led", at: "f33-rail-:33", props: { color: "green" }, locked: true },
      // The starting jumper: C1's + strip (bnode) straight to the coil (k1a), with no transistor yet.
      { id: "W1", kind: "wire", at: "d12-d24" },
    ],
    tray: [
      // Q1: 2N3904
      { kind: "npn", props: { model: "2N3904" }, count: 1 },
      { kind: "wire", count: 4 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "no-click",
      prompt: "Press reset, then switch on `S1`. Wait ten seconds. Measure `C1`'s voltage.",
      // GOAL: after at least 8 s with S1 closed, C1 sits between 2.8 and 3.5 V and K1 never closed; the learner
      // enters the reading.
      goal: (lab) => closed(lab, "S1") && between(volts(lab, "bnode"), 2.8, 3.5) && pullIns(lab, "K1").length === 0 && lab.meter?.mode === "dcv",
      hints: ["Meter across `C1`, red probe on the + leg."],
      success:
        "Stuck near 3.2 V. The coil drains current as fast as the 1 kΩ supplies it. Together they form a divider, and 3.2 V is far below the 6 V the relay needs.",
    },
    {
      id: "add-q1",
      prompt:
        "Remove the jumper. Put `Q1` in: base to `C1`'s + strip, collector to the switched supply `v`, emitter to the coil. Reset, then switch on.",
      // GOAL: K1 closes 0.9 to 2.2 s after S1 closes, and D2 lights.
      goal: (lab) => placed(lab, "Q1") && !placed(lab, "W1") && closed(lab, "K1") && lab.isLit("D2"),
      hints: ["The coil now hangs from the emitter.", "Reset `C1` before each run."],
      success: "Click! The capacitor only has to feed the base, a tiny current. The transistor feeds the coil from the battery.",
    },
    {
      id: "five-seconds",
      prompt: "Turn the trimmer to set a delay of 5 seconds. Reset between tries.",
      // GOAL: three consecutive runs measure 4.5 to 5.5 s.
      goal: (lab) => placed(lab, "Q1") && between(extraNum(lab, "P1", "position"), 0.23, 0.3) && pullIns(lab, "K1").length >= 3,
      hints: ["More resistance, longer delay.", "τ = R × C. You need about 3.6 s of τ. What R does that mean with 1,000 µF?"],
      success: "Five seconds, on demand. That's a timer.",
    },
    {
      id: "impatient-restart",
      prompt: "Switch `S1` off, then straight back on, without pressing reset. Time it.",
      // GOAL: a run without reset measures less than 70% of the previous run.
      goal: (lab) => placed(lab, "Q1") && closed(lab, "S1") && closed(lab, "K1") && pullIns(lab, "K1").length >= 4,
      hints: ["Be quick: while the power is off, the coil slowly drains `C1` through `Q1`."],
      success: "Much shorter: `C1` still had charge left over. Real timers need a way to empty their capacitor, like your reset button.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
