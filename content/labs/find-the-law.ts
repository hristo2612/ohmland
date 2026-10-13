// Blueprint: docs/curriculum/unit-1.md, L11. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Multiply mA by kΩ. What number keeps turning up?"
//   success "You just rediscovered Ohm's law. With your own data!"
// Notebook (N2): a four-row table with R (kΩ) and I (mA), filled automatically from stable readings, and an empty
//   "I × R" column for the learner.
// Achievement trigger (N16): when spot-the-pattern and predict-and-test are done with all four logged I × R products
//   within 5% of the logged battery voltage and the 4.7 kΩ prediction within 5% of the measured current, the lab
//   emits "lawmaker" (see apps/web/src/progress/achievements.ts).
// Expected (20mA range, about 10 Ω burden): 9.20 mA, 6.26 mA, 4.23 mA, 2.86 mA; 4.7 kΩ about 2.0 mA.
// Fried moments: none (probing the battery on mA by mistake blows the meter fuse as usual, N9).
import { defineLab } from "@ohmland/lab";
import { meterMode, meterRange, readsBetween } from "./lib/goals";

export default defineLab({
  id: "find-the-law",
  title: "Find the law yourself",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      // An empty resistor holder (two clips, H.a and H.b), with H.b wired to battery minus.
      { id: "L1", kind: "wire", at: "slot:H.b|B1.neg" },
      { id: "M1", kind: "multimeter", props: { mode: "off", red: "vohm", black: "com" } },
    ],
    tray: [
      { kind: "resistor", props: { ohms: 1000, watts: 0.25, actualOhms: 1010 }, count: 1 },
      { kind: "resistor", props: { ohms: 1500, watts: 0.25, actualOhms: 1490 }, count: 1 },
      { kind: "resistor", props: { ohms: 2200, watts: 0.25, actualOhms: 2210 }, count: 1 },
      { kind: "resistor", props: { ohms: 3300, watts: 0.25, actualOhms: 3280 }, count: 1 },
      // Appears for task predict-and-test.
      { kind: "resistor", props: { ohms: 4700, watts: 0.25, actualOhms: 4680 }, count: 1 },
      { kind: "wire", count: 2 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "battery-first",
      prompt: "Start by measuring the battery on DC volts. The notebook logs it.",
      // GOAL: across(B1) && logged("battery") && meter.value >= 9.0 && meter.value <= 9.6
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 9.0, 9.6),
      hints: ["DC volts, 20V range. Red on plus, black on minus."],
      success: "Battery voltage logged. Keep that number in mind.",
    },
    {
      id: "fill-the-table",
      prompt:
        "Switch to current (red lead in **mA**, **20mA** range) and put the meter in series: battery plus to red probe, black probe to the holder. Then clip in each resistor in turn: 1 kΩ, 1.5 kΩ, 2.2 kΩ, 3.3 kΩ.",
      // GOAL: four logged series current readings, one per resistor
      // Interim: the last row, the 3.3 kΩ current on the 20mA range.
      goal: (lab) => meterMode(lab) === "dca-ma" && meterRange(lab) === "20mA" && readsBetween(lab, 2.7, 3.0),
      hints: [
        "One loop: battery plus, meter, holder, back to minus.",
        "Reading zero? Check the red lead is in mA.",
        "Swap resistors by dragging a new one onto the holder.",
      ],
      success: "Four rows of real data. Now look closely.",
    },
    {
      // NOTEBOOK task (N2).
      id: "spot-the-pattern",
      prompt: "For each row, multiply the current in mA by the resistance in kΩ. Type the four answers.",
      // GOAL: each note within 2% of the logged I × nominal R for its row
      // Interim: needs the lab notebook, which LabView does not have yet.
      goal: () => false,
      hints: ["First row: about 9.2 × 1.", "Compare your answers with the battery voltage."],
      success: "All four land close to your battery voltage. That's not a coincidence. That's a law.",
    },
    {
      // NOTEBOOK task (N2).
      id: "predict-and-test",
      prompt: "Here's a 4.7 kΩ resistor. Predict its current first, then clip it in and measure.",
      // GOAL: note("prediction") within 10% of the logged battery voltage ÷ 4.7, then a measured reading within 5% of
      //   the prediction
      // Interim: the measured 4.7 kΩ current only; the prediction needs the notebook.
      goal: (lab) => meterMode(lab) === "dca-ma" && readsBetween(lab, 1.9, 2.1),
      hints: ["Volts divided by kilohms gives milliamps."],
      success: "Predicted, then confirmed. That's what a law of physics is for.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
