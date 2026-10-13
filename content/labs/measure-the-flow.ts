// Blueprint: docs/curriculum/unit-1.md, L9. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Break the loop first. The meter fills the gap."
//   fried "Pop. Every meter owner does that once. Spare fuse in the tray."
//   success "Same reading on both sides. Current isn't used up."
// Fried moment (required, task the-classic): Hall entry kind "meter-fuse", label "Meter fuse, 200 mA (amps across a
//   battery)".
// Expected: about 15.7 mA on the 200mA range.
// Needs (N9): a meter fuse that stays blown, the meter-fuse event, and a bench action to fit a spare (sim input
//   "replaceFuse").
import { defineLab } from "@ohmland/lab";
import { happened, meterInSeriesWith, meterMode, meterRange, readsBetween, redIn } from "./lib/goals";

export default defineLab({
  id: "measure-the-flow",
  title: "Measuring the flow",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      { id: "R1", kind: "resistor", props: { ohms: 470, watts: 0.25 } },
      { id: "D1", kind: "led", props: { color: "red", maxmA: 50 } },
      { id: "L1", kind: "wire", at: "B1.pos|R1.a" },
      { id: "L2", kind: "wire", at: "R1.b|D1.anode" },
      { id: "L3", kind: "wire", at: "D1.cathode|B1.neg" },
      { id: "M1", kind: "multimeter", props: { mode: "off", red: "vohm", black: "com" } },
    ],
    tray: [
      // Two spare 200 mA fuses for the meter's mA input (fitted with the "replaceFuse" input, not placed on the bench).
      { kind: "fuse", props: { amps: 0.2, forMeter: true }, count: 2 },
      { kind: "wire", count: 1 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "set-up-amps",
      prompt: "Set the meter up for current: red lead into **mA**, dial to DC mA, **200mA** range.",
      // GOAL: meter.red == "ma" && meter.mode == "dca-ma" && meter.range == "200mA"
      goal: (lab) => redIn(lab, "ma") && meterMode(lab) === "dca-ma" && meterRange(lab) === "200mA",
      hints: ["The mA socket is for small currents.", "Not sure how big a current is? Start on the biggest mA range."],
      success: "Ready to count milliamps.",
    },
    {
      id: "break-and-bridge",
      prompt:
        "Unclip lead L1 from the battery's plus terminal. Then close the gap with the meter: red probe on battery plus, black probe on the lead's free clip.",
      // GOAL: inSeries(M1, D1) && isLit(D1) && meter.value >= 14 && meter.value <= 17.5
      goal: (lab) => meterInSeriesWith(lab, "D1") && lab.isLit("D1", 0.1) && readsBetween(lab, 14, 17.5),
      hints: ["The current has to go through the meter, so the meter fills the gap.", "Red toward the battery's plus, black toward the resistor."],
      success: "About 15.7 mA, flowing right through your meter.",
    },
    {
      id: "other-side",
      prompt: "Restore L1, then measure again on the far side of the LED: between its short leg and battery minus.",
      // GOAL: inSeries(M1, D1) with the meter between D1.cathode and B1.neg, and |meter.value - break-and-bridge value| <= 0.3
      // Interim: in series and reading the same range as before; where the meter sits needs bench topology.
      goal: (lab) => meterInSeriesWith(lab, "D1") && lab.isLit("D1", 0.1) && readsBetween(lab, 14, 17.5),
      hints: ["Unclip L3 from the battery's minus terminal and let the meter fill that gap instead."],
      success: "Same number. The LED doesn't use up current: everything that goes in comes out.",
    },
    {
      id: "the-classic",
      prompt:
        "Now the mistake every beginner makes once. Restore the loop. Keep the meter on mA and touch the probes straight across the battery.",
      // GOAL: event("meter-fuse", "M1")
      goal: (lab) => happened(lab, "meter-fuse", "M1"),
      hints: ["Red probe on the battery's plus terminal, black probe on minus."],
      success: "Pop. Nothing limited the current, it shot past 3 A, and the meter's 200 mA fuse blew to save the meter.",
    },
    {
      id: "fresh-fuse",
      prompt: "Open the meter's back, fit a fresh fuse from the tray, and measure the LED current again, the right way.",
      // GOAL: meter fuse replaced, then inSeries(M1, D1) && meter.value >= 14 && meter.value <= 17.5
      // Interim: the fuse blew earlier and the meter now reads the LED current in series again.
      goal: (lab) => happened(lab, "meter-fuse", "M1") && meterInSeriesWith(lab, "D1") && readsBetween(lab, 14, 17.5),
      hints: ["Drag a spare fuse from the tray onto the meter.", "Then break the loop and put the meter in the gap, as before."],
      success: "Back in business. Current meters go in series, never across.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
