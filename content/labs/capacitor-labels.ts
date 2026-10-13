// Lab for lesson `capacitor-labels` (docs/curriculum/unit-2.md, Lesson 10).
// Station A: the meter in series (DC mA, 2 mA range) with 10 kΩ and an empty capacitor socket between x and gnd.
// Station B, "the blast box" (a clear lid prop): a switch and an empty socket from bb to gnd, with no resistor.
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState. Tray
// comments give the ids the goals expect placed parts to get.
// BENCH NEEDS: the blast box prop with a vent animation.
// SIM NEEDS: overvoltage against `volts` (a 6.3 V part on 9 V leaks more and more, then dies) and `died` events that
// carry data.cause ("reverse" or "overvoltage"), so the Hall of Fried Parts and `wrong-way-round` can tell them apart.
// Damage moments: task 4 by design. A correctly oriented 6.3 V part in the blast box also fails slowly from overvoltage.
// Notice: real ones do this too, sometimes with a bang and a smelly puff.
import { defineLab, type LabView } from "@ohmland/lab";
import { closed, died, happened, placed } from "./lib/goals";

/** Station A's current, in amps, as the series meter sees it. */
const amps = (lab: LabView): number => Math.abs(lab.part("M1")?.i ?? 1);

export default defineLab({
  id: "capacitor-labels",
  title: "Reading the fine print",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // Station A. pins { a: vcc, b: r }
      { id: "R1", kind: "resistor", at: "rail+:5-a5", props: { ohms: 10000 }, locked: true },
      // Station A meter, in series. pins { com: x, vohm: mv, ma: r, a10: ma10 }. The socket runs from x to gnd.
      { id: "M1", kind: "multimeter", at: "e5-a12", props: { mode: "dca-ma", range: "2mA" }, locked: true },
      // Station B, inside the blast box. pins { a: vcc, b: bb }. The socket runs from bb to gnd.
      { id: "S1", kind: "switch", at: "rail+:40-a40", props: { closed: false }, locked: true },
    ],
    tray: [
      // CA: ceramic, 100 nF, marked "104"
      { kind: "capacitor", props: { farads: 1e-7, polarized: false }, count: 1 },
      // CB: electrolytic, 100 µF, 16 V
      { kind: "capacitor", props: { farads: 1e-4, volts: 16, polarized: true }, count: 1 },
      // CC: electrolytic, 100 µF, 6.3 V
      { kind: "capacitor", props: { farads: 1e-4, volts: 6.3, polarized: true }, count: 1 },
    ],
    // The only meter is M1, wired into station A above.
    instruments: [],
  },
  tasks: [
    {
      id: "ceramic-blocks",
      prompt: "Plug the 104 ceramic into station A. Watch the meter. Then turn it round and try again.",
      // GOAL: in both orientations, |I(M1)| is below 2 µA one second after insertion.
      goal: (lab) => placed(lab, "CA") && amps(lab) < 2e-6,
      hints: ["The meter may twitch at the start. Watch what it settles to."],
      success: "A blip, then nothing. Once it's charged, no steady current gets through. And ceramics don't care which way round they go.",
    },
    {
      id: "electrolytic-right-way",
      prompt: "Now plug in the 100 µF, 16 V electrolytic the right way round: stripe toward ground.",
      // GOAL: the initial current is above 0.5 mA, then falls below 20 µA within 10 s.
      goal: (lab) => placed(lab, "CB") && (lab.part("CB")?.v ?? 0) > 8 && amps(lab) < 20e-6,
      hints: ["The stripe of minus signs marks the leg that goes toward ground."],
      success: "Bigger capacitor, bigger gulp, slower settle. Then it blocks too, apart from a tiny leak.",
    },
    {
      id: "electrolytic-backwards",
      prompt: "Flip the electrolytic so the stripe faces the positive side.",
      // GOAL: after 8 s the current is still above 100 µA, and a `reversed` event fired on CB.
      goal: (lab) => happened(lab, "CB", "reversed") && amps(lab) > 100e-6,
      hints: ["Just watch the meter. Does it settle this time?"],
      success: "It never settles. Backwards, the insulating layer breaks down and the capacitor leaks like a sieve.",
    },
    {
      id: "blast-box",
      prompt: "Optional, and it's loud. Put the 6.3 V capacitor in the blast box backwards and close `S1`.",
      // GOAL: CC died with reason reverse voltage (it lands in the Hall of Fried Parts).
      goal: (lab) => closed(lab, "S1") && happened(lab, "CC", "reversed") && died(lab, "CC"),
      hints: ["There's no resistor in the blast box. That's the point."],
      success: "It heated, bulged and vented. That's why polarity and voltage ratings matter. It's in the Hall of Fried Parts now.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
