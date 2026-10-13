// Lab for lesson `rc-time-constant` (docs/curriculum/unit-2.md, Lesson 11).
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState.
// Instruments: meter (DC volts across C1), the data logger with plot and cursor, and a stopwatch (BenchConfig only
// lists "meter" today).
// Numbers: τ = 1 kΩ x 1,000 µF = 1 s. Charging on 9.0 V crosses 5.69 V (63.2%) at 1τ; discharging from 9 V crosses
// 3.31 V at 1τ. Two tray pairs give τ near 2.2 s: 2.2 kΩ x 1,000 µF and 4.7 kΩ x 470 µF.
// SIM NEEDS: per-instance capacitor tolerance (±20%) exposed to the lab as the actual value.
// LAB NEEDS: a logger recording a node voltage 20 times a second with plot, cursor readout and per-run reset; numeric
// answer entry checked against the instance τ (R x C actual, plus the source resistance).
// Damage moments: none.
// Notice: the measured τ is close to nominal but not exact, because electrolytics can be 20% off their printed value.
import { defineLab, type LabView } from "@ohmland/lab";
import { allParts, between, extraStr, volts } from "./lib/goals";

/** The charging resistor's value: the resistor carrying the most current right now. */
function chargingOhms(lab: LabView): number | undefined {
  let best: { ohms: number; amps: number } | undefined;
  for (const p of allParts(lab)) {
    const ohms = p.extra?.["ohms"];
    if (typeof ohms === "number" && Math.abs(p.i) > (best?.amps ?? 1e-7)) best = { ohms, amps: Math.abs(p.i) };
  }
  return best?.ohms;
}

/** The timing capacitor's value, from its charge and voltage (the capacitor holding the most charge). */
function timingFarads(lab: LabView): number | undefined {
  let best: { farads: number; charge: number } | undefined;
  for (const p of allParts(lab)) {
    const q = p.extra?.["charge"];
    if (typeof q === "number" && Math.abs(p.v) > 0.5 && Math.abs(q) > (best?.charge ?? 0)) best = { farads: Math.abs(q / p.v), charge: Math.abs(q) };
  }
  return best?.farads;
}

const charging = (lab: LabView): boolean => extraStr(lab, "S1", "to") === "a";

export default defineLab({
  id: "rc-time-constant",
  title: "Counting in taus",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }. EMF fixed at 9.0 V so the prompt's numbers hold.
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // Charge or discharge. pins { com: t, a: vcc, b: gnd }, starting on discharge.
      { id: "S1", kind: "spdt", at: "a5", props: { to: "b" }, locked: true },
      // pins { a: t, b: c }
      { id: "R1", kind: "resistor", at: "e5-e12", props: { ohms: 1000 } },
      // pins { pos: c, neg: gnd }. Instance value ±20% (SIM NEEDS).
      { id: "C1", kind: "capacitor", at: "a12-rail-:12", props: { farads: 0.001, volts: 16, polarized: true } },
    ],
    tray: [
      { kind: "resistor", props: { ohms: 2200 }, count: 1 },
      { kind: "resistor", props: { ohms: 4700 }, count: 1 },
      { kind: "resistor", props: { ohms: 10000 }, count: 1 },
      { kind: "capacitor", props: { farads: 0.00047, volts: 16, polarized: true }, count: 1 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "find-tau",
      prompt:
        "Start with `C1` empty. Slide `S1` to charge and let the logger run. Mark the moment `C1` reaches 5.69 V, which is 63.2% of 9 V. How many seconds did it take?",
      // GOAL: the learner's τ is within 10% of the instance's actual τ (R1 x C1 actual, plus the source resistance).
      goal: (lab) => charging(lab) && (volts(lab, "c") ?? 0) > 5.69 && between(chargingOhms(lab), 950, 1050),
      hints: ["Use the cursor on the plot to find where the curve crosses 5.69 V.", "Measure from the moment you slid the switch."],
      success: "About one second. And 1 kΩ × 1,000 µF = 1 s. That's no coincidence.",
    },
    {
      id: "discharge-tau",
      prompt: "Let it fill completely, then slide `S1` back to discharge. When does it fall to 3.31 V?",
      // GOAL: the learner's discharge τ is within 10% of the actual τ.
      goal: (lab) => !charging(lab) && between(volts(lab, "c"), 0.5, 3.31),
      hints: ["Wait for the curve to flatten out near 9 V before you slide the switch back."],
      success: "The same τ going down: it drops 63% of the way to zero in one tau.",
    },
    {
      id: "ten-times-slower",
      prompt: "Swap `R1` for 10 kΩ. Predict τ, then measure it.",
      // GOAL: the logged τ is within 10% of the actual τ (about 10 s).
      goal: (lab) => charging(lab) && (volts(lab, "c") ?? 0) > 5.69 && between(chargingOhms(lab), 9500, 10500),
      hints: ["Empty `C1` first, so the run starts from 0 V."],
      success: "Ten times the resistance, ten times the time.",
    },
    {
      id: "hit-the-target",
      prompt: "Choose a resistor and a capacitor from the tray so τ is about 2.2 s. Prove it with the logger.",
      // GOAL: the nominal R x C is between 2.1 and 2.3 s, and the logged τ is within 20% of 2.2 s.
      goal: (lab) => {
        const r = chargingOhms(lab);
        const c = timingFarads(lab);
        return charging(lab) && r !== undefined && c !== undefined && between(r * c, 1.76, 2.64);
      },
      hints: ["τ = R × C. Try pairs.", "There are two good answers on this tray."],
      success: "2.2 kΩ × 1,000 µF, or 4.7 kΩ × 470 µF. Different parts, same timing.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
