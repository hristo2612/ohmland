// Blueprint: docs/curriculum/unit-1.md, L5. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Too high? Make it shorter, or shade it darker."
//   success "You drew a working resistor. Art class meets physics."
//
// Prop (N5): a pencil card, a white card and a soft pencil. The learner draws a straight line by dragging (length 1 to
// 10 cm, snapping to 0.5 cm), can shade over it again (layers 1 to 4) and pick a width (narrow 2 mm or wide 4 mm). An
// eraser clears the card. Probe tips snap to any point on the line.
// P1 sits between the two probe points: ohms = 2 kΩ (contacts) + 20 kΩ per cm of probe separation ÷ layers, halved
// again if wide, with ±3% drift. Examples: narrow, 1 layer, 5 cm: 102 kΩ; 2.5 cm: 52 kΩ; 2 layers, 5 cm: 52 kΩ.
import { defineLab } from "@ohmland/lab";
import { baseReading, between, meterMode } from "./lib/goals";

export default defineLab({
  id: "draw-a-resistor",
  title: "Draw a resistor",
  bench: {
    board: "none",
    parts: [
      // No line drawn yet, so the card is an open circuit.
      { id: "P1", kind: "probe-resistance", at: "prop:pencil-card", props: { ohms: 1e13, length: 0, layers: 0, width: "narrow" } },
      { id: "M1", kind: "multimeter", props: { mode: "ohm", range: "200k", red: "vohm", black: "com" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "first-line",
      prompt: "Draw a **5 cm** line with one pass. Put a probe on each end and measure it.",
      // GOAL: prop(card).length == 5 && prop(card).layers == 1 && probes at both ends && reading between 80 kΩ and 125 kΩ
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 80_000, 125_000),
      hints: ["Drag across the card to draw. The ruler shows centimetres.", "Probes snap onto the line."],
      success: "About 100 kΩ. A pencil line really is a resistor.",
    },
    {
      id: "half-way",
      prompt: "Slide one probe to the middle of the line.",
      // GOAL: probe separation 2.0 to 3.0 cm && reading between 0.40 and 0.62 of the first-line reading
      // Interim: 0.40 to 0.62 of a typical 102 kΩ first line.
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 41_000, 63_000),
      hints: ["The middle of a 5 cm line is the 2.5 cm mark."],
      success: "About half. Half the length, half the resistance.",
    },
    {
      id: "go-darker",
      prompt: "Shade over the whole line once more, then measure end to end again.",
      // GOAL: prop(card).layers >= 2 && probes at both ends && reading < 0.65 × the first-line reading
      // Interim: under 0.65 of a typical 102 kΩ first line.
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 1_000, 66_000),
      hints: ["Drag along the same line again to add a second layer."],
      success: "More graphite gives the current more room, so the resistance drops.",
    },
    {
      id: "hit-target",
      prompt: "Your turn to design. Make a line that measures **50 kΩ**, give or take 10%.",
      // GOAL: reading between 45 kΩ and 55 kΩ, probes on the line
      goal: (lab) => meterMode(lab) === "ohm" && between(baseReading(lab), 45_000, 55_000),
      hints: ["Shorter lines resist less.", "A second layer roughly halves the resistance.", "Try 5 cm with two layers, or 2.5 cm with one."],
      success: "Right on target. You just designed a resistor.",
    },
    {
      id: "slide-along",
      prompt: "Keep one probe at the start and slowly drag the other along the line.",
      // GOAL: the moving probe passed through at least 4 positions, with the reading rising each time
      // Interim: needs a history of probe positions and readings, which LabView does not keep yet.
      goal: () => false,
      hints: ["Move the probe a centimetre at a time and watch the number."],
      success: "A resistor with a sliding contact is called a potentiometer. You'll use real ones in the next unit.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
