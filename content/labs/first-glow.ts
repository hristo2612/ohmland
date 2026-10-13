// Blueprint: docs/curriculum/unit-1.md, L7. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Long leg toward plus. Flat side toward minus."
//   fried "Oof. No resistor, no mercy. There's a spare in the tray."
//   success "It glows! You built that loop from scratch."
// Fried moment (optional): an LED clipped straight across the battery with no resistor dies.
//   Hall entry: kind "led", label "Red LED, no resistor on 9 V". The spare LED lets the learner carry on.
// Needs: a live schematic panel generated from the bench (N7), and an LED reverse model with no damage at 9.4 V
//   reverse through 1.5 kΩ.
import { defineLab } from "@ohmland/lab";
import { amps } from "./lib/goals";

export default defineLab({
  id: "first-glow",
  title: "Your first glow",
  bench: {
    board: "none",
    parts: [
      // Loose and unconnected.
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      { id: "R1", kind: "resistor", props: { ohms: 1500, watts: 0.25 } },
      // 5 mm, longer anode lead, flat spot on the cathode side of the rim.
      { id: "D1", kind: "led", props: { color: "red", maxmA: 50 } },
    ],
    tray: [
      { kind: "wire", props: { color: "red" }, count: 1 },
      { kind: "wire", props: { color: "black" }, count: 1 },
      { kind: "wire", props: { color: "green" }, count: 1 },
      { kind: "wire", props: { color: "yellow" }, count: 1 },
      { kind: "led", props: { color: "red", maxmA: 50 }, count: 1 },
    ],
    instruments: [],
  },
  tasks: [
    {
      id: "build-loop",
      prompt:
        "Use clip leads to make one loop: battery plus, then the resistor, then the LED, then back to battery minus. The LED's **longer leg** faces the plus side.",
      // GOAL: isLit(D1) and the loop contains exactly B1, R1 and D1 in series
      // Interim: the LED glows and carries the same current as the resistor.
      goal: (lab) => lab.isLit("D1", 0.1) && amps(lab, "R1") > 0 && Math.abs(amps(lab, "R1") - amps(lab, "D1")) < 1e-4,
      hints: [
        "Plus, resistor, LED, minus. Each clip lead joins two neighbours.",
        "The resistor's ends are identical. The LED's are not: longer leg toward plus.",
        "See the flat edge on the LED's rim? That side goes toward minus.",
      ],
      success: "Your loop, your light. Nicely done.",
    },
    {
      id: "flip-led",
      prompt: "Turn the LED around by swapping its two legs.",
      // GOAL: part(D1).v < -1 && part(D1).glow == 0, with the loop otherwise intact
      goal: (lab) => (lab.part("D1")?.v ?? 0) < -1 && (lab.part("D1")?.glow ?? 1) === 0,
      hints: ["Unclip both of the LED's legs and clip each lead onto the other leg."],
      // NOTICE: almost the whole battery voltage now sits across the LED backwards. The resistor keeps any current
      // tiny, so a short reverse test like this is harmless, though datasheets say to stay under about 5 V in reverse.
      success: "Dark, and no harm done. An LED only lets current through in one direction.",
    },
    {
      id: "swap-order",
      prompt: "Turn the LED back. Now move the resistor to the other side, between the LED's short leg and battery minus.",
      // GOAL: isLit(D1) and topology B1.pos to D1.anode, D1.cathode to R1, R1 to B1.neg
      // Interim: lit and in series, as in build-loop; the order check needs bench topology.
      goal: (lab) => lab.isLit("D1", 0.1) && amps(lab, "R1") > 0 && Math.abs(amps(lab, "R1") - amps(lab, "D1")) < 1e-4,
      hints: ["Battery plus goes straight to the LED's long leg now. The resistor closes the loop on the minus side."],
      success: "Same glow. In a single loop, the order of the parts doesn't matter.",
    },
    {
      id: "match-symbols",
      prompt: "Tap a symbol in the schematic panel, then the matching part on the bench. Do all three.",
      // GOAL: the battery, resistor and LED symbols each matched to their part
      // Interim: needs the live schematic panel (N7).
      goal: () => false,
      hints: ["The zigzag is the resistor. The triangle with arrows is the LED."],
      success: "That's a schematic: the same circuit, drawn with symbols.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
