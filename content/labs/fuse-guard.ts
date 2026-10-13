// Blueprint: docs/curriculum/unit-1.md, L14. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Big current? Red lead to 10A, and keep it quick."
//   fried "The fuse gave its life, exactly as designed. A hero of the Hall."
//   success "Between one and three amps. Bracketed like a detective."
// Fried moment (required, task blow-1a): Hall entry kind "fuse", label "1 A fuse across a 9 V battery". If the learner
//   leaves the 10A input loaded for more than 10 s, the meter shows a heat warning (N9); no damage in normal mode.
// Achievement trigger: "bracketed" needs blow-1a and measure-big with no blown event on F2 in the same lab session.
// Expected: F1 across the battery sees several amps and blows within about 0.3 s. With F2, the 10A input (about
//   0.05 Ω) and two leads in the loop, the current starts above 3 A and settles at about 1.6 to 2.4 A within 2 s as
//   the battery sags. F2 survives several seconds at that level.
// Needs: clip leads of 0.15 Ω each (N3), 10A input heating and warning (N9), battery sag and recovery (N10). Fuse
//   model: fast-acting I²t curve, rated current carried indefinitely, about 1 to 5 s at 2 times rating, under 0.3 s
//   at 4 times, ±10% random spread per fuse; cold resistance about 0.1 Ω (1 A) and 0.03 Ω (3 A).
import { defineLab } from "@ohmland/lab";
import { amps, happened, meterInSeriesWith, meterMode, readsBetween, redIn, showsOL } from "./lib/goals";

export default defineLab({
  id: "fuse-guard",
  title: "The part that fails first",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      // Glass fuses, both loose. F1: end caps marked 1A, a green dot. F2: marked 3A, a red dot.
      { id: "F1", kind: "fuse", props: { amps: 1 } },
      { id: "F2", kind: "fuse", props: { amps: 3 } },
      { id: "M1", kind: "multimeter", props: { mode: "off", red: "vohm", black: "com" } },
    ],
    tray: [{ kind: "wire", count: 3 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "blow-1a",
      prompt: "Clip the 1 A fuse straight across the battery with two clip leads. Watch the thin wire inside.",
      // GOAL: event("blown", "F1")
      goal: (lab) => happened(lab, "blown", "F1") || lab.part("F1")?.health === "dead",
      hints: ["One clip lead from battery plus to one end cap, another from the other end cap to battery minus."],
      success: "Snap. The wire melted and left a gap. The fuse gave its life in a fraction of a second.",
    },
    {
      id: "continuity-check",
      prompt: "Set the dial to continuity (the sound-wave symbol). Test the blown fuse, then the 3 A fuse.",
      // GOAL: meter.mode == "continuity", across(F1) showing OL with no beep, and across(F2) with a beep
      // Interim: on continuity, with F1 blown, the meter shows a low reading (the good fuse, tested last).
      goal: (lab) => meterMode(lab) === "continuity" && happened(lab, "blown", "F1") && !showsOL(lab) && readsBetween(lab, 0, 30),
      hints: ["Touch a probe to each metal end cap."],
      success: "Silence from the blown one, a beep from the good one. That's how you test a fuse in two seconds.",
    },
    {
      id: "measure-big",
      prompt:
        "Measure the current through the 3 A fuse. Red lead into **10A**, dial to **10A**. Make one loop: battery, 3 A fuse, meter, back to battery. Hold it for 3 seconds, then break the loop.",
      // GOAL: meter.red == "a10" && meter.mode == "dca-10a" && inSeries(M1, F2)
      //   && heldFor(3, part(F2).health != "dead" && |part(F2).i| > 1), with a logged reading between 1.4 and 2.6 A
      // Interim: everything except the 3 s hold and the logged reading.
      goal: (lab) =>
        redIn(lab, "a10") &&
        meterMode(lab) === "dca-10a" &&
        meterInSeriesWith(lab, "F2") &&
        lab.part("F2")?.health !== "dead" &&
        amps(lab, "F2") > 1 &&
        readsBetween(lab, 1.4, 2.6),
      hints: ["Big currents use the 10A socket, never mA.", "Keep it short. The 10A input isn't built for long runs."],
      success: "About 2 A. Too much for the 1 A fuse, within the 3 A fuse's rating. Two fuses bracketed the current.",
    },
    {
      id: "battery-check",
      prompt: "Back to DC volts. Measure the battery now, then again after 30 seconds.",
      // GOAL: two logged readings across B1, both below the starting value, the second at least 0.05 V higher
      // Interim: one reading below the battery's fresh 9.4 V; the pair needs the notebook.
      goal: (lab) => meterMode(lab) === "dcv" && readsBetween(lab, 8, 9.35),
      hints: ["Red lead back in VΩ, dial to DC volts, 20V range.", "Probes on the battery terminals, nothing else connected."],
      success: "It dipped, then crept back up, but not all the way. Heavy current tires a battery. Next lesson shows why.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
