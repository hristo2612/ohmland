// Blueprint: docs/curriculum/unit-1.md, L3. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "OL? Nothing's broken. Turn the dial up one step."
//   success "Kilo, mega, milli, micro. You speak fluent meter now."
import { defineLab } from "@ohmland/lab";
import { meterMode, meterRange, readsBetween, showsOL } from "./lib/goals";

export default defineLab({
  id: "tiny-and-huge-numbers",
  title: "Tiny numbers, huge numbers",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      // An AA cell lying in a small cradle with exposed end caps.
      { id: "X1", kind: "battery", props: { emf: 1.58, internalOhms: 0.15, mAh: 2500 } },
      // Lying loose with both leads exposed.
      { id: "R1", kind: "resistor", props: { ohms: 470, watts: 0.25, actualOhms: 466 } },
      { id: "M1", kind: "multimeter", props: { mode: "off", red: "vohm", black: "com" } },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "over-the-limit",
      prompt: "Set DC volts to the **2 V** range and measure the 9 V battery.",
      // GOAL: meter.mode == "dcv" && meter.range == "2V" && across(B1) && meter.display == "OL"
      goal: (lab) => meterMode(lab) === "dcv" && meterRange(lab) === "2V" && showsOL(lab),
      hints: ["Red on the round terminal, black on the six-sided one."],
      success: "OL means over limit. 9 V is too big for a 2 V range. The meter is fine.",
    },
    {
      id: "climb-a-range",
      prompt: "Turn up one range at a time. Stop at the first range that shows a real number.",
      // GOAL: meter.range == "20V" && across(B1) && meter.value >= 9.0 && meter.value <= 9.6
      goal: (lab) => meterMode(lab) === "dcv" && meterRange(lab) === "20V" && readsBetween(lab, 9.0, 9.6),
      hints: ["The next range up from 2 V is 20 V."],
      // NOTICE: on 200 V the same battery shows only one decimal place.
      success: "20 V is the smallest range above 9 V, so it gives you the most useful digits.",
    },
    {
      id: "aa-cell",
      prompt: "Now measure the AA cell. Find the range that shows the most digits without OL.",
      // GOAL: meter.range == "2V" && across(X1) && meter.value >= 1.40 && meter.value <= 1.65
      goal: (lab) => meterMode(lab) === "dcv" && meterRange(lab) === "2V" && readsBetween(lab, 1.4, 1.65),
      hints: ["An AA cell is about 1.5 V.", "The smallest range bigger than 1.5 V wins."],
      success: "About 1.58 V. That's also 1,580 millivolts, if you like big numbers.",
    },
    {
      // NOTEBOOK task (N2): the learner types the value in plain ohms; it is checked against the sim.
      id: "kilo-ohms",
      prompt:
        "Turn the dial to **Ω, 2k range** and touch the probes to the resistor's two wire ends. The screen is in kilohms. Type the value in plain ohms into your notebook.",
      // GOAL: meter.mode == "ohm" && meter.range == "2k" && across(R1) && note("ohms") >= 455 && note("ohms") <= 480
      goal: (lab) => meterMode(lab) === "ohm" && meterRange(lab) === "2k" && readsBetween(lab, 0.455, 0.48),
      hints: ["k means a thousand.", "0.466 thousand ohms is 466 ohms."],
      // NOTICE: resistors don't care which probe is which, so either way round works.
      success: "466 Ω. Same resistor, two ways to write it: 0.466 kΩ or 466 Ω.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
