// Blueprint: docs/curriculum/unit-1.md, L17. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Zinc to copper at every link. Copper to copper cancels out."
//   success "My face! It's glowing! Fruit-powered and fabulous."
// Story beat (needs runtime support): during light-it, the robot's LED face brightens in sync with D1.
// Achievement trigger (N16): four cells in series with exactly one reversed and a logged reading between 1.6 and
//   2.0 V emits "upside-down" (see apps/web/src/progress/achievements.ts).
// Expected: two cells about 1.83 V; four cells about 3.65 V unloaded; total internal resistance about 4.8 kΩ; LED
//   current about 0.4 mA, glow about 0.05; stack voltage with the LED connected about 1.7 V.
// Fried moments: none possible. Four cells can't push more than about 0.8 mA, even into a short.
// Needs: the fruit cell prop (N12) and room-lights dimming so a faint glow (0.02 to 0.1) is clearly visible (N13).
import { defineLab } from "@ohmland/lab";
import { glow, meterMode, reading, readsBetween } from "./lib/goals";

export default defineLab({
  id: "stack-the-cells",
  title: "Stack the cells",
  bench: {
    board: "none",
    parts: [
      // Four lemon cells, each with a copper and a zinc electrode (pos is the copper). Seeded within emf 0.90 to 0.94
      // and internalOhms 1,000 to 1,400.
      { id: "FC1", kind: "cell", at: "prop:lemon-1", props: { emf: 0.92, internalOhms: 1200 } },
      { id: "FC2", kind: "cell", at: "prop:lemon-2", props: { emf: 0.91, internalOhms: 1100 } },
      { id: "FC3", kind: "cell", at: "prop:lemon-3", props: { emf: 0.93, internalOhms: 1300 } },
      { id: "FC4", kind: "cell", at: "prop:lemon-4", props: { emf: 0.9, internalOhms: 1200 } },
      // Loose.
      { id: "D1", kind: "led", props: { color: "red", maxmA: 50 } },
      { id: "M1", kind: "multimeter", props: { mode: "dcv", range: "2V", red: "vohm", black: "com" } },
    ],
    tray: [{ kind: "wire", count: 5 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "two-in-series",
      prompt: "Link two cells: clip the zinc of one to the copper of the next. Measure from the free copper to the free zinc.",
      // GOAL: FC1 and FC2 in series, aiding; probes across the free ends; reading 1.70 to 1.95 V
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 1.7, 1.95),
      hints: ["One clip lead: zinc of the first lemon to copper of the second.", "Red probe on the free copper, black on the free zinc."],
      success: "About 1.8 V. In series, cell voltages add up.",
    },
    {
      id: "wrong-way",
      prompt: "Now link the same two cells copper to copper, and measure across the free ends.",
      // GOAL: two cells in series, opposing; |meter.value| < 0.1
      // Interim: a near-zero reading; the opposing link needs bench topology.
      goal: (lab) => meterMode(lab) === "dcv" && Math.abs(reading(lab)) < 0.1,
      hints: ["Move the link so it joins the two coppers. The probes go on the two zincs."],
      success: "Almost nothing. Back to back, the two cells cancel each other out.",
    },
    {
      id: "four-stack",
      prompt: "Build a chain of all four, zinc to copper at every link. Measure the whole stack.",
      // GOAL: FC1 to FC4 in series, aiding; probes across the free ends; reading 3.4 to 3.8 V
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 3.4, 3.8),
      hints: ["3.6 V is over the 2V range. Step up to 20V.", "Every link joins a zinc to the next copper."],
      success: "About 3.6 V. Enough to light a red LED.",
    },
    {
      id: "light-it",
      prompt:
        "Connect the LED across the stack: long leg to the free copper, short leg to the free zinc. Dim the room lights if you need to.",
      // GOAL: D1 forward-connected across the four-cell stack, part(D1).glow > 0.02 && part(D1).i > 0.0002
      goal: (lab) => glow(lab, "D1") > 0.02 && (lab.part("D1")?.i ?? 0) > 0.0002,
      hints: ["Long leg toward copper, the plus end of the stack.", "It will be faint. Try the room-lights switch."],
      success: "A glow from fruit! Faint, but completely yours.",
    },
    {
      id: "why-no-resistor",
      prompt: "Keep the LED lit and measure across the stack again.",
      // GOAL: reading 1.5 to 2.0 V across the stack with D1 connected and lit
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 1.5, 2.0) && glow(lab, "D1") > 0.02,
      hints: ["Probes on the free copper and the free zinc, with the LED still connected."],
      success:
        "From 3.6 V down to about 1.7 V. The lemons' internal resistance swallows the rest and keeps the current under half a milliamp. That's why no resistor was needed.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
