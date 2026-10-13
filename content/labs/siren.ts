// Lab for lesson `siren` (docs/curriculum/unit-2.md, Lesson 19), the unit's landmark build.
// Board: a full 830-point breadboard with both rail pairs bridged. Two pre-built oscillators, labeled "slow" and
// "fast", plus a speaker driver. Netlist pins are noted beside each part; `at` anchors are provisional until
// packages/bench owns BenchState. Tray comments give the ids the goals expect placed parts to get.
// Instruments: scope with a frequency readout, and meter.
// Numbers: the bridge (two 100 kΩ from both fast bases to the slow collector) should give tones near 1.4 kHz and
// 1.9 kHz. Verify in the simulator and adjust the goal windows. The whole circuit draws about 40 mA.
// LAB NEEDS: tone frequency over time (50 ms windows) for every goal in this lab.
// Damage moments: a plain wire instead of R8 or R9 locks the oscillators into one muddy pitch or stalls the fast one
// (the robot explains). Holding the button for long drains the battery faster.
// Notice: the slow oscillator's LED glows faintly in its "off" half, because a little current now flows into the
// bridge. Small side effects like this are normal when circuits are joined.
import { defineLab } from "@ohmland/lab";
import { closed, happened, placed } from "./lib/goals-switching";

export default defineLab({
  id: "siren",
  title: "The siren button",
  bench: {
    board: "breadboard",
    parts: [
      // Power. pins { pos: vcc, neg: gnd } and the siren button { a: vcc, b: vp }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      { id: "S1", kind: "pushbutton", at: "rail+:2-a2", locked: true },
      // Slow oscillator, as in lesson 17. Q1's collector node is c1.
      { id: "R1", kind: "resistor", at: "e2-e6", props: { ohms: 1000 }, locked: true },
      { id: "D1", kind: "led", at: "a6-a9", props: { color: "red" }, locked: true },
      { id: "Q1", kind: "npn", at: "e9", props: { model: "2N3904" }, locked: true },
      { id: "R2", kind: "resistor", at: "j2-j18", props: { ohms: 1000 }, locked: true },
      { id: "D2", kind: "led", at: "f18-f21", props: { color: "red" }, locked: true },
      { id: "Q2", kind: "npn", at: "j21", props: { model: "2N3904" }, locked: true },
      { id: "R3", kind: "resistor", at: "c2-c10", props: { ohms: 68000 }, locked: true },
      { id: "R4", kind: "resistor", at: "h2-h22", props: { ohms: 68000 }, locked: true },
      { id: "C1", kind: "capacitor", at: "b9-g22", props: { farads: 0.00001, volts: 16, polarized: true } },
      { id: "C2", kind: "capacitor", at: "g21-b10", props: { farads: 0.00001, volts: 16, polarized: true } },
      // Fast oscillator. pins { c: c3, b: b3, e: gnd } and { c: c4, b: b4, e: gnd }, 1 kΩ collector and 68 kΩ base
      // resistors to vp, 10 nF ceramics from c3 to b4 and from c4 to b3.
      { id: "Q3", kind: "npn", at: "e35", props: { model: "2N3904" }, locked: true },
      { id: "Q4", kind: "npn", at: "j45", props: { model: "2N3904" }, locked: true },
      { id: "RC3", kind: "resistor", at: "rail+:35-a35", props: { ohms: 1000 }, locked: true },
      { id: "RC4", kind: "resistor", at: "rail+:45-f45", props: { ohms: 1000 }, locked: true },
      { id: "RB3", kind: "resistor", at: "rail+:36-a36", props: { ohms: 68000 }, locked: true },
      { id: "RB4", kind: "resistor", at: "rail+:46-f46", props: { ohms: 68000 }, locked: true },
      { id: "C3", kind: "capacitor", at: "b35-g46", props: { farads: 1e-8, polarized: false }, locked: true },
      { id: "C4", kind: "capacitor", at: "g45-b36", props: { farads: 1e-8, polarized: false }, locked: true },
      // Driver. pins { c: spb, b: q5b, e: gnd }, R11 { a: c4, b: q5b }, R12 0.5 W { a: vp, b: spa }, SP1 { a: spa, b: spb }
      { id: "Q5", kind: "npn", at: "e55", props: { model: "2N3904" }, locked: true },
      { id: "R11", kind: "resistor", at: "i45-i55", props: { ohms: 4700 }, locked: true },
      { id: "R12", kind: "resistor", at: "rail+:58-a58", props: { ohms: 220, watts: 0.5 }, locked: true },
      { id: "SP1", kind: "speaker", at: "e58-a54", props: { ohms: 8 }, locked: true },
    ],
    tray: [
      // R8 and R9: 100 kΩ, the bridge.
      { kind: "resistor", props: { ohms: 100000 }, count: 2 },
      // R10: 10 kΩ, for the wail filter.
      { kind: "resistor", props: { ohms: 10000 }, count: 1 },
      // C5: 22 µF, 16 V, for the wail filter.
      { kind: "capacitor", props: { farads: 0.000022, volts: 16, polarized: true }, count: 1 },
      // C6 and C7: 1 µF ceramics, for the trill.
      { kind: "capacitor", props: { farads: 1e-6, polarized: false }, count: 2 },
      { kind: "wire", count: 4 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "two-voices",
      prompt: "Hold the siren button. You should see a blink and hear a steady tone.",
      // GOAL: with S1 held, the slow LEDs alternate and the tone stays within 5% of one frequency for 2 s.
      goal: (lab) => closed(lab, "S1") && !placed(lab, "R8") && !placed(lab, "R9") && lab.isLit("D1", 0.5) !== lab.isLit("D2", 0.5),
      hints: ["Keep holding: the slow side takes about a second per blink."],
      success: "Two separate oscillators, ignoring each other. Let's introduce them.",
    },
    {
      id: "bridge",
      prompt: "Connect `R8` from `Q3`'s base to `Q1`'s collector, and `R9` from `Q4`'s base to `Q1`'s collector.",
      // GOAL: the tone alternates between two frequencies whose ratio is 1.15 to 1.8, switching every 0.3 to 0.7 s.
      goal: (lab) =>
        closed(lab, "S1") &&
        placed(lab, "R8") &&
        placed(lab, "R9") &&
        Math.abs(lab.part("R8")?.i ?? 0) > 1e-6 &&
        Math.abs(lab.part("R9")?.i ?? 0) > 1e-6,
      hints: ["Both resistors meet at `Q1`'s collector strip."],
      success:
        "Nee-naw! When `Q1` is off, its high collector pushes extra current into the fast bases: higher pitch. When `Q1` is on, it pulls them down: lower pitch.",
    },
    {
      id: "wail",
      prompt:
        "Make it glide: move the joined end of `R8` and `R9` to an empty strip, connect that strip to `Q1`'s collector through `R10`, and put `C5` from that strip to ground, stripe to ground.",
      // GOAL: the tone's range ratio is at least 1.15, with no jump larger than 5% between successive 50 ms windows.
      goal: (lab) => closed(lab, "S1") && placed(lab, "R10") && placed(lab, "C5") && !happened(lab, "C5", "reversed") && placed(lab, "R8"),
      hints: ["`R10` and `C5` make an RC filter, like the smoothing in the capacitor module."],
      success: "Now it swoops up and down. The capacitor turns sudden steps into slopes.",
    },
    {
      id: "trill",
      prompt: "Bonus: swap the slow oscillator's 10 µF capacitors for 1 µF.",
      // GOAL: the pitch modulation rate is 6 to 16 per second.
      goal: (lab) => closed(lab, "S1") && placed(lab, "C6") && placed(lab, "C7") && !placed(lab, "C1") && !placed(lab, "C2"),
      hints: ["Swap both cross-coupling capacitors on the slow side."],
      success: "A frantic trill. Every knob you've learned in this unit is now a sound design tool.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
