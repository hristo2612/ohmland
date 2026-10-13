// Blueprint: docs/curriculum/unit-1.md, L12. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Side by side? The total is smaller than the smaller one."
//   success "Half! You called it. More paths, less resistance."
import { defineLab } from "@ohmland/lab";
import { baseReading, between, meterMode, meterRange, readsBetween } from "./lib/goals";

export default defineLab({
  id: "series-and-parallel",
  title: "End to end, side by side",
  bench: {
    board: "none",
    parts: [
      // Loose.
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      { id: "R1", kind: "resistor", props: { ohms: 1000, watts: 0.25, actualOhms: 1000 } },
      { id: "R2", kind: "resistor", props: { ohms: 1000, watts: 0.25, actualOhms: 990 } },
      { id: "R3", kind: "resistor", props: { ohms: 3300, watts: 0.25, actualOhms: 3300 } },
      { id: "M1", kind: "multimeter", props: { mode: "ohm", range: "20k", red: "vohm", black: "com" } },
    ],
    tray: [{ kind: "wire", count: 5 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "series-ohms",
      prompt: "Clip R1 and R2 end to end. Measure from one free end to the other.",
      // GOAL: R1 and R2 share exactly one node, probes on the two free ends, reading 1.90 to 2.10 kΩ
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 1_900, 2_100),
      hints: ["One clip lead joins an end of R1 to an end of R2.", "Then one probe on each of the two ends left over."],
      success: "About 2 kΩ. End to end, resistances add.",
    },
    {
      id: "parallel-ohms",
      prompt: "Now put them side by side: join the two left ends together, and the two right ends together. Measure across the pair.",
      // GOAL: R1 and R2 in parallel, probes across the pair, reading 0.47 to 0.53 kΩ
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 470, 530),
      hints: ["Two clip leads: one joins the left ends, one joins the right ends.", "Try the 2k range for more digits."],
      success: "About 500 Ω. Two equal paths, half the resistance.",
    },
    {
      // NOTEBOOK task (N2).
      id: "predict-mixed",
      prompt: "Swap R2 for the 3.3 kΩ resistor, still side by side with R1. Predict the total first, then measure.",
      // GOAL: note("prediction") within 5% of 767 Ω, then measured R1 ∥ R3 between 730 Ω and 800 Ω
      // Interim: the measurement only; the prediction needs the notebook.
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 730, 800),
      hints: ["Product over sum: (1 × 3.3) ÷ (1 + 3.3), in kilohms.", "It must be less than 1 kΩ."],
      success: "About 767 Ω, less than either resistor alone.",
    },
    {
      id: "four-times",
      prompt:
        "Put R1 and R2 back. Measure the battery current with the pair in series, then with the pair in parallel. Use the 20mA range.",
      // GOAL: a logged series current of 4.3 to 5.0 mA and a logged parallel current of 17.0 to 19.5 mA
      // Interim: the parallel reading, which comes second.
      goal: (lab) => meterMode(lab) === "dca-ma" && meterRange(lab) === "20mA" && readsBetween(lab, 17, 19.5),
      hints: ["Red lead into mA, then put the meter in the loop between the battery and the pair."],
      success: "About 4.7 mA, then about 18.4 mA: roughly four times as much. Half the resistance in each step, twice over.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
