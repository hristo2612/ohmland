// Blueprint: docs/curriculum/unit-1.md, L2. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Black in COM, red in VΩ. Then the dial."
//   success "9.4 volts. That battery is ready for anything."
// Lab exit (needs runtime support): when the learner presses Continue, the meter dial animates to OFF and the mascot
//   says "Dial to OFF. Real meters thank you with longer battery life." (habit building, no task).
import { defineLab } from "@ohmland/lab";
import { blackIn, meterMode, meterRange, reading, readsBetween, redIn } from "./lib/goals";

export default defineLab({
  id: "meet-the-meter",
  title: "Meet your multimeter",
  bench: {
    board: "none",
    parts: [
      // Standing upright, terminals up.
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      // A scuffed "used" battery, set aside for the bonus task.
      { id: "B2", kind: "battery", props: { emf: 7.6, internalOhms: 6, mAh: 500 } },
      // Both leads lying unplugged next to it.
      { id: "M1", kind: "multimeter", props: { mode: "off", red: "none", black: "none" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "plug-in",
      prompt: "Plug the black lead into **COM** and the red lead into **VΩ**.",
      // GOAL: meter.black == "com" && meter.red == "vohm"
      goal: (lab) => blackIn(lab, "com") && redIn(lab, "vohm"),
      hints: ["COM is short for common. It's where black always goes.", "VΩ is the socket for volts and ohms. The red plug goes there."],
      success: "Leads in. Black in COM is a habit for life.",
    },
    {
      id: "set-dial",
      prompt: "Turn the dial to DC volts, on the 20 V range.",
      // GOAL: meter.mode == "dcv" && meter.range == "20V"
      goal: (lab) => meterMode(lab) === "dcv" && meterRange(lab) === "20V",
      hints: ["DC volts is the V with a straight line.", "Pick 20, the smallest range bigger than 9 V."],
      success: "Ready to read up to 20 V.",
    },
    {
      id: "read-battery",
      prompt: "Touch the red probe to the battery's small round terminal (+) and the black probe to the larger six-sided terminal (−).",
      // GOAL: across(B1) && meter.value >= 9.0 && meter.value <= 9.6
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 9.0, 9.6),
      hints: ["The two snaps on top are the terminals. Plus is the smaller, round one.", "Both probes must touch metal at the same time."],
      // NOTICE: the reading is a bit over 9 V, and it barely changes, because the meter draws almost no current.
      success: "About 9.4 V. That battery is fresh.",
    },
    {
      id: "swap-probes",
      prompt: "Now swap: red on minus, black on plus. What changes?",
      // GOAL: across(B1, "rev") && meter.value <= -9.0
      goal: (lab) => meterMode(lab) === "dcv" && reading(lab) <= -9.0,
      hints: ["Same terminals, other probes."],
      success: "A minus sign. The meter isn't broken. It's telling you the red probe is on the lower side.",
    },
    {
      id: "tired-battery",
      prompt: "There's a used battery at the back of the bench. Measure it too.",
      // GOAL: across(B2) && meter.value >= 7.2 && meter.value <= 8.0
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 7.2, 8.0),
      hints: ["Same setup as before: red on the round terminal, black on the six-sided one."],
      success: "About 7.6 V. Same label, less left in it.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
