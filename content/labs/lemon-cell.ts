// Blueprint: docs/curriculum/unit-1.md, L16. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Two different metals, close together, not touching."
//   success "Nine tenths of a volt from fruit. Nature makes batteries too!"
//
// Prop (N12): FC1 is a lemon half on a saucer with two electrode slots. The tray holds two copper-plated coins and two
// galvanized (zinc-plated) strips. Dropping an electrode into a slot inserts it; dragging one electrode onto the other
// makes them touch inside the fruit. Each electrode has a clip point on its exposed end.
// The lab sets FC1's emf and internalOhms from the electrode pair, with pos on the copper electrode:
// - copper and zinc, apart: emf 0.92 (random ±0.03), internalOhms 1,200
// - the same metal twice: emf 0 (±0.005), internalOhms 1,200
// - electrodes touching: emf 0, internalOhms 1
import { defineLab } from "@ohmland/lab";
import { between, glow, meterMode, readsBetween } from "./lib/goals";

export default defineLab({
  id: "lemon-cell",
  title: "A battery from the fruit bowl",
  bench: {
    board: "none",
    parts: [
      // No electrodes yet, so no voltage.
      { id: "FC1", kind: "cell", at: "prop:lemon", props: { emf: 0, internalOhms: 1200, electrodes: "none" } },
      { id: "M1", kind: "multimeter", props: { mode: "dcv", range: "2V", red: "vohm", black: "com" } },
      // Loose at the side, for the bonus task.
      { id: "D1", kind: "led", props: { color: "red", maxmA: 50 } },
    ],
    // Two clip leads for the bonus task. (The coins and zinc strips are lemon-prop electrodes, not netlist parts.)
    tray: [{ kind: "wire", count: 2 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "make-a-cell",
      prompt:
        "Push a copper coin and a zinc strip into the lemon, close together but not touching. Measure between them: red on the copper, black on the zinc.",
      // GOAL: FC1 has copper and zinc, apart, && across(FC1) && meter.value >= 0.80 && meter.value <= 1.00
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 0.8, 1.0),
      hints: ["One metal in each slot.", "The 2V range shows the most digits for under a volt."],
      success: "About 0.9 V from a lemon. You just made a cell.",
    },
    {
      id: "which-is-plus",
      prompt: "Swap the probes: red on the zinc, black on the copper.",
      // GOAL: across(FC1, "rev") && meter.value <= -0.80 && meter.value >= -1.00
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, -1.0, -0.8),
      hints: ["Same two metals, other probes."],
      success: "Negative. So copper is the plus side, and zinc is the minus side.",
    },
    {
      id: "same-metal",
      prompt: "Replace the zinc strip with the second copper coin, and measure again.",
      // GOAL: FC1 has two copper electrodes && |meter.value| < 0.05
      // Interim: a near-zero reading; which electrodes are in the lemon needs the prop state.
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, -0.05, 0.05),
      hints: ["Drag the zinc strip out, then drop the second coin into its slot."],
      success: "Almost nothing. A cell needs two different metals.",
    },
    {
      id: "touching",
      prompt: "Put the zinc strip back, then push the two metals together so they touch inside the lemon.",
      // GOAL: FC1 copper and zinc touching && |meter.value| < 0.05
      // Interim: a near-zero reading; the touching state needs the prop state.
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, -0.05, 0.05),
      hints: ["Drag one electrode onto the other."],
      success: "Zero again. Touching electrodes short the cell out from the inside.",
    },
    {
      id: "one-lemon-led",
      prompt: "Separate the metals. Can one lemon light the red LED? Long leg to copper, short leg to zinc.",
      // GOAL: D1 anode on the copper electrode, cathode on the zinc, part(D1).glow < 0.02
      // Interim: an LED sits forward across about 0.9 V and stays dark.
      goal: (lab) => between(lab.part("D1")?.v ?? Number.NaN, 0.5, 1.0) && glow(lab, "D1") < 0.02,
      hints: ["Two clip leads: copper to the LED's long leg, zinc to its short leg."],
      success: "Not a flicker. 0.9 V is only about half of what a red LED needs. You're going to need more lemons.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
