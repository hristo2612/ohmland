// Blueprint: docs/curriculum/unit-1.md, L6. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Gold stripe on the right. Then read from the left."
//   success "You caught the liar. Nothing gets past you now."
//
// Props (N15): a colour chart card (always visible), five draggable value labels (15 Ω, 150 Ω, 470 Ω, 1.5 kΩ,
// 2.2 kΩ) and a small parts bin for rejects. Bands render from each resistor's nominal `ohms` (N6).
import { defineLab } from "@ohmland/lab";
import { baseReading, between, meterMode, meterRange, readsBetween } from "./lib/goals";

export default defineLab({
  id: "reading-the-stripes",
  title: "Reading the stripes",
  bench: {
    board: "none",
    parts: [
      // Five loose resistors, not connected to anything.
      { id: "R1", kind: "resistor", props: { ohms: 15, watts: 0.25, actualOhms: 15.2 } }, // brown, green, black, gold
      { id: "R2", kind: "resistor", props: { ohms: 150, watts: 0.25, actualOhms: 148 } }, // brown, green, brown, gold
      { id: "R3", kind: "resistor", props: { ohms: 470, watts: 0.25, actualOhms: 466 } }, // yellow, violet, brown, gold
      { id: "R4", kind: "resistor", props: { ohms: 1500, watts: 0.25, actualOhms: 1520 } }, // brown, green, red, gold
      // Out of tolerance (+11.8%); its body is very slightly darkened.
      { id: "R5", kind: "resistor", props: { ohms: 2200, watts: 0.25, actualOhms: 2460 } }, // red, red, red, gold
      { id: "M1", kind: "multimeter", props: { mode: "ohm", range: "2k", red: "vohm", black: "com" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      // NOTEBOOK task (N2).
      id: "decode-yellow",
      prompt: "Find the resistor with **yellow, violet, brown** stripes. Use the colour chart to decode it, and type its value in ohms.",
      // GOAL: note("value") == 470
      // Interim: needs the lab notebook, which LabView does not have yet.
      goal: () => false,
      hints: ["The first two stripes are digits: yellow is 4, violet is 7.", "The third stripe is how many zeros to add. Brown is 1."],
      success: "4, 7 and one zero: 470 Ω.",
    },
    {
      id: "measure-it",
      prompt: "Now measure it on the 2k range. Is it exactly 470 Ω?",
      // GOAL: meter.mode == "ohm" && across(R3) && meter.value >= 0.447 && meter.value <= 0.493
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 447, 493),
      hints: ["Touch one probe to each wire end of the yellow, violet, brown resistor."],
      success: "Close, not exact. The gold stripe promises within 5%, and this one is well inside that.",
    },
    {
      id: "probe-tips",
      prompt: "Switch to the 200 range and touch the two probe tips together. What does a 'zero' read?",
      // GOAL: meter.range == "200" && probes shorted && meter.value >= 0.1 && meter.value <= 0.4
      goal: (lab) => meterMode(lab) === "ohm" && meterRange(lab) === "200" && readsBetween(lab, 0.1, 0.4),
      hints: ["Press the two metal tips against each other."],
      // NOTICE: the 15 Ω resistor will read about 0.2 Ω high for this reason.
      success: "About 0.2 Ω. That's the meter's own leads. It only matters when you measure tiny resistances.",
    },
    {
      id: "sort-the-bag",
      prompt: "Read and measure the other four, then drag the right value label onto each resistor.",
      // GOAL: labels 15 Ω, 150 Ω, 470 Ω, 1.5 kΩ and 2.2 kΩ placed on R1 to R5 respectively
      // Interim: needs the value-label props (N15), which LabView does not report yet.
      goal: () => false,
      hints: ["Read the stripes first, then confirm with the meter.", "Brown, green, red is 1, 5 and two zeros."],
      success: "Five for five. Stripes and meter agree.",
    },
    {
      id: "find-the-liar",
      prompt: "One resistor measures outside its 5% tolerance. Find it and drop it in the reject bin.",
      // GOAL: R5 in the reject bin, and no other resistor in the bin
      // Interim: needs the reject bin prop (N15), which LabView does not report yet.
      goal: () => false,
      hints: ["Work out 5% above and below each value.", "2.2 kΩ plus 5% is 2.31 kΩ."],
      success: "Caught it. 2.46 kΩ is more than 5% above 2.2 kΩ. That one was probably overheated at some point.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
