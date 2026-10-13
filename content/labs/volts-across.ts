// Blueprint: docs/curriculum/unit-1.md, L10. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Red lead still in mA? Move it before you touch anything."
//   fried "The leftover-lead trap. Happens to everyone. Spare fuse in the tray."
//   success "7.4 plus 2.0 makes 9.4. The loop balances its books."
// Fried moment (optional): probing anything while the meter is still on mA blows its fuse. Hall entry kind
//   "meter-fuse", label "Meter fuse, 200 mA (red lead left in mA)". The spare fuse lets the learner carry on.
// Expected: battery 9.37 V under load; resistor about 7.4 V; LED about 1.95 V.
import { defineLab } from "@ohmland/lab";
import { meterMode, meterRange, readsBetween, redIn } from "./lib/goals";

export default defineLab({
  id: "volts-across",
  title: "Across, not in",
  bench: {
    board: "none",
    parts: [
      // Wired as a loop and lit, as in measure-the-flow.
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      { id: "R1", kind: "resistor", props: { ohms: 470, watts: 0.25 } },
      { id: "D1", kind: "led", props: { color: "red", maxmA: 50 } },
      { id: "L1", kind: "wire", at: "B1.pos|R1.a" },
      { id: "L2", kind: "wire", at: "R1.b|D1.anode" },
      { id: "L3", kind: "wire", at: "D1.cathode|B1.neg" },
      // The meter starts in a trap: red lead in mA, dial on DC mA 200mA, as if left from last time.
      { id: "M1", kind: "multimeter", props: { mode: "dca-ma", range: "200mA", red: "ma", black: "com" } },
    ],
    tray: [{ kind: "fuse", props: { amps: 0.2, forMeter: true }, count: 1 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "reset-meter",
      prompt: "The meter is still set up for current. Make it ready for volts: red lead into **VΩ**, dial to DC V, **20V** range.",
      // GOAL: meter.red == "vohm" && meter.mode == "dcv" && meter.range == "20V"
      goal: (lab) => redIn(lab, "vohm") && meterMode(lab) === "dcv" && meterRange(lab) === "20V",
      hints: ["Check where the red lead is plugged in right now.", "VΩ socket first, then the V with a straight line."],
      success: "Good habit. A meter left on amps is the number one way to blow its fuse.",
    },
    {
      id: "battery-volts",
      prompt: "With the LED lit, measure across the battery: red on plus, black on minus.",
      // GOAL: across(B1) && meter.value >= 9.0 && meter.value <= 9.6
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 9.0, 9.6),
      hints: ["Touch the probes to the battery's two terminals while the loop stays connected."],
      success: "About 9.4 V, measured while the battery is working.",
    },
    {
      id: "resistor-volts",
      prompt: "Now measure across the resistor: a probe on each end, red on the end nearer battery plus.",
      // GOAL: across(R1) && meter.value >= 6.9 && meter.value <= 7.9
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 6.9, 7.9),
      hints: ["Leave the circuit connected. Just touch the probes to the resistor's two wire ends."],
      success: "About 7.4 V. The resistor takes most of the push.",
    },
    {
      id: "led-volts",
      prompt: "And across the LED: red on the long leg, black on the short leg. Try the 2V range for extra digits.",
      // GOAL: across(D1) && meter.value >= 1.80 && meter.value <= 2.10
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 1.8, 2.1),
      hints: ["The long leg is the anode, nearer the resistor."],
      success: "About 1.95 V. That's the LED's forward voltage.",
    },
    {
      // NOTEBOOK task (N2).
      id: "add-them-up",
      prompt: "Add your resistor and LED readings and type the total.",
      // GOAL: |note("sum") - (logged R1 + logged D1)| <= 0.05 && |note("sum") - logged B1| <= 0.15
      // Interim: needs the lab notebook, which LabView does not have yet.
      goal: () => false,
      hints: ["About 7.4 plus about 2.0.", "Compare your total with the battery reading."],
      success: "The two drops add up to the battery voltage. The push is shared out around the loop.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
