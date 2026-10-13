// Lab for lesson `capacitor-fill-fade` (docs/curriculum/unit-2.md, Lesson 9).
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState.
// Instruments: meter (DC volts across C1) and the data logger (LAB NEEDS: voltage against time plot).
// Expected: with S1 held, C1 settles near 5.4 V (1 kΩ feed against the 1 kΩ + LED load), filling with a time
// constant of about 0.5 s. Through R3 (100 Ω) it empties with τ = 0.1 s.
// BENCH NEEDS: a "lift lead" action that pulls one leg out of its hole without removing the part; a fill gauge ring on
// capacitor bodies that tracks voltage against the rating.
// Damage moment: removing R2 dumps the full capacitor straight into D1: a bright flash and D1 `died`.
// Notice: while it fills, current flows in the wires on both sides of the capacitor, yet nothing crosses the insulator.
import { defineLab } from "@ohmland/lab";
import { between, closed, glow, volts } from "./lib/goals";

export default defineLab({
  id: "capacitor-fill-fade",
  title: "Fill it, watch it fade",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // "Fill" button. pins { a: vcc, b: f }
      { id: "S1", kind: "pushbutton", at: "rail+:5-a5", locked: true },
      // pins { a: f, b: c }
      { id: "R1", kind: "resistor", at: "e5-e10", props: { ohms: 1000 }, locked: true },
      // pins { pos: c, neg: gnd }
      { id: "C1", kind: "capacitor", at: "a10-rail-:10", props: { farads: 0.001, volts: 16, polarized: true } },
      // pins { a: c, b: l }
      { id: "R2", kind: "resistor", at: "c10-c16", props: { ohms: 1000 } },
      // pins { anode: l, cathode: gnd }
      { id: "D1", kind: "led", at: "e16-rail-:16", props: { color: "red" }, locked: true },
      // "Empty" button. pins { a: c, b: e }
      { id: "S2", kind: "pushbutton", at: "f10-f22", locked: true },
      // pins { a: e, b: gnd }
      { id: "R3", kind: "resistor", at: "j22-rail-:22", props: { ohms: 100 }, locked: true },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "fill",
      prompt: "Hold the fill button for five seconds. Watch the LED and the meter.",
      // GOAL: D1 glow rises from below 0.05 to above 0.5, taking more than 0.5 s to go from 10% to 90% of its final
      // glow, and C1 settles at 5.0 to 5.8 V.
      goal: (lab) => closed(lab, "S1") && glow(lab, "D1") > 0.5 && between(volts(lab, "c"), 5.0, 5.8),
      hints: ["Keep holding. It's slower than you think."],
      success: "The light crept up as the capacitor filled. Notice the meter: fast at first, then slower and slower.",
    },
    {
      id: "fade",
      prompt: "Let go and watch.",
      // GOAL: after the release, D1 glow falls below 0.1 between 1 and 8 s later.
      goal: (lab) => !closed(lab, "S1") && glow(lab, "D1") < 0.1 && between(volts(lab, "c"), 1.0, 2.2),
      hints: ["Fill it first, then let go and keep watching the LED."],
      success: "The capacitor is powering the LED by itself, and running out gently.",
    },
    {
      id: "dump",
      prompt: "Fill it again, then press the empty button.",
      // GOAL: D1 glow below 0.05 within 0.3 s of pressing S2, and C1 below 0.5 V.
      goal: (lab) => closed(lab, "S2") && glow(lab, "D1") < 0.05 && (volts(lab, "c") ?? 9) < 0.5,
      hints: ["Fill it until the LED is bright, then press the second button."],
      success: "Through just 100 Ω, the charge rushes out almost at once.",
    },
    {
      id: "lift-a-leg",
      prompt: "Lift the capacitor's negative leg out of the ground strip. Then fill and release again.",
      // GOAL: with C1's negative leg floating, D1 goes dark within 0.15 s of releasing S1.
      // Stand-in: while S1 is held and D1 lit, C1 holds no voltage, because its floating plate follows the other one.
      goal: (lab) => closed(lab, "S1") && lab.isLit("D1") && Math.abs(lab.part("C1")?.v ?? 9) < 0.5,
      hints: ["Use the lift tool on the striped leg."],
      success:
        "No fade at all. A capacitor with one plate disconnected can't hold anything: the charge on one plate needs a matching opposite charge on the other, and that needs a path.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors and the lift action.
  solution: [],
});
