// Lab for lesson `smoothing-and-coupling` (docs/curriculum/unit-2.md, Lesson 12).
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState. Tray
// comments give the ids the goals expect placed parts to get.
// Instruments: meter, scope and an auto-tapper (LAB NEEDS: toggles a pushbutton's `pressed` input at a set rate,
// default 4 per second). BenchConfig only lists "meter" today.
// LAB NEEDS: glow history (ripple, mean, time above a level, peak per press) for every goal in this lab.
// Damage moments: none planned. C2 in backwards gives a `reversed` warning; it leaks but survives at this current.
// Notice: the scope on both plates of C2 shows them jump together at the press, then the lower plate sags back.
import { defineLab } from "@ohmland/lab";
import { closed, glow, placed } from "./lib/goals-switching";

export default defineLab({
  id: "smoothing-and-coupling",
  title: "Smooth it, kick it through",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // Station A (smoothing). pins { a: vcc, b: s0 }, driven by the auto-tapper.
      { id: "S1", kind: "pushbutton", at: "rail+:5-a5", locked: true },
      // pins { a: s0, b: s }
      { id: "R1", kind: "resistor", at: "e5-e10", props: { ohms: 100 }, locked: true },
      // pins { a: s, b: l1 } and { anode: l1, cathode: gnd }
      { id: "R2", kind: "resistor", at: "a10-a16", props: { ohms: 1000 }, locked: true },
      { id: "D1", kind: "led", at: "e16-rail-:16", props: { color: "red" }, locked: true },
      // Station B (coupling). pins { a: vcc, b: p }
      { id: "S2", kind: "pushbutton", at: "rail+:35-a35", locked: true },
      // pins { pos: p, neg: q }
      { id: "C2", kind: "capacitor", at: "e35-e40", props: { farads: 0.0001, volts: 16, polarized: true } },
      // pins { a: q, b: l2 } and { anode: l2, cathode: gnd }
      { id: "R3", kind: "resistor", at: "a40-a46", props: { ohms: 1000 }, locked: true },
      { id: "D2", kind: "led", at: "e46-rail-:46", props: { color: "red" }, locked: true },
      // Reset: empties C2 through R4. pins { a: p, b: rr } and { a: rr, b: q }
      { id: "S3", kind: "pushbutton", at: "f35-f50", locked: true },
      { id: "R4", kind: "resistor", at: "j50-j40", props: { ohms: 100 }, locked: true },
    ],
    tray: [
      // C1: 470 µF, 16 V
      { kind: "capacitor", props: { farads: 0.00047, volts: 16, polarized: true }, count: 1 },
      // C3: 47 µF, 16 V, for the optional comparison
      { kind: "capacitor", props: { farads: 0.000047, volts: 16, polarized: true }, count: 1 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "flicker",
      prompt: "Turn on the auto-tapper for `S1`. Watch `D1`.",
      // GOAL: with the tapper on and no capacitor at node s, D1's glow ripple (max minus min over 1 s) is above 0.6.
      goal: (lab) => !placed(lab, "C1") && !placed(lab, "C3") && closed(lab, "S1") && glow(lab, "D1") > 0.6,
      hints: ["The tapper presses the button for you, four times a second."],
      success: "On, off, on, off. That's what a choppy supply looks like.",
    },
    {
      id: "smooth-it",
      prompt: "Add the 470 µF capacitor from the resistor's output to ground, stripe to ground.",
      // GOAL: with the tapper on, D1's glow ripple is below 0.25 and its mean glow above 0.2 over 2 s.
      goal: (lab) => placed(lab, "C1") && !closed(lab, "S1") && glow(lab, "D1") > 0.2,
      hints: ["The capacitor goes across the supply, not in line with it."],
      success:
        "Steady light from a stuttering source. The capacitor fills during each tap and feeds the LED in between. Try the 47 µF too: a small tank empties fast, so the flicker comes back.",
    },
    {
      id: "one-flash",
      prompt: "Station B: press and hold `S2` for three seconds.",
      // GOAL: while S2 is held for at least 2 s, D2's glow is above 0.3 for less than 0.6 s in total.
      goal: (lab) => closed(lab, "S2") && glow(lab, "D2") < 0.05 && (lab.part("C2")?.v ?? 0) > 5,
      hints: ["Keep holding, and keep watching."],
      success: "A flash, then darkness, even though you're still pressing.",
    },
    {
      id: "no-encore",
      prompt: "Let go and press `S2` again. Then press reset (`S3`) and try once more.",
      // GOAL: a second press without reset peaks below 0.15; after S3, the next S2 press peaks above 0.3.
      goal: (lab) => closed(lab, "S2") && glow(lab, "D2") > 0.3,
      hints: ["What's left in `C2` after the first press?"],
      success: "The capacitor only passes a change. Already charged, there's no change left to pass, until you empty it.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors and the auto-tapper.
  solution: [],
});
