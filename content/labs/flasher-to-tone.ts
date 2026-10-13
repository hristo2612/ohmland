// Lab for lesson `flasher-to-tone` (docs/curriculum/unit-2.md, Lesson 18).
// The lesson 17 flasher (68 kΩ, 10 µF) plus a speaker driver. Netlist pins are noted beside each part; `at` anchors
// are provisional until packages/bench owns BenchState. Tray comments give the ids the goals expect placed parts to get.
// Instruments: scope with a frequency readout (BENCH NEEDS) and meter.
// Numbers: 1 µF about 10 to 13 Hz, 100 nF about 100 to 125 Hz, 10 nF about 1.0 to 1.3 kHz. The speaker stage draws
// 9 V ÷ (220 + 8) Ω ≈ 39 mA, putting 0.34 W into R7 while on (hence 0.5 W). With R7 bypassed, Q3 tries to pass a few
// hundred mA with most of the 9 V across it: well over its 625 mW rating.
// SIM NEEDS: a speaker audio stream at 48 kHz from sim.onAudio, with a simple acoustic filter (a small cone in free air
// loses bass below about 300 Hz) and a volume limiter; speaker damage above about 0.5 W sustained.
// LAB NEEDS: the oscillation frequency at a node, click transients through SP1, and glow ripple.
// Damage moments: task 5 by design; the battery current is high meanwhile (battery warms).
import { defineLab } from "@ohmland/lab";
import { between, closed, died, glow, placed } from "./lib/goals-switching";

export default defineLab({
  id: "flasher-to-tone",
  title: "Shrink it to a song",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // Power switch. pins { a: vcc, b: vp }
      { id: "S1", kind: "switch", at: "rail+:3-a3", props: { closed: false }, locked: true },
      // The flasher from lesson 17.
      { id: "R1", kind: "resistor", at: "e3-e10", props: { ohms: 1000 }, locked: true },
      { id: "D1", kind: "led", at: "a10-a14", props: { color: "red" }, locked: true },
      { id: "Q1", kind: "npn", at: "e14", props: { model: "2N3904" }, locked: true },
      { id: "R2", kind: "resistor", at: "j3-j30", props: { ohms: 1000 }, locked: true },
      { id: "D2", kind: "led", at: "f30-f34", props: { color: "red" }, locked: true },
      { id: "Q2", kind: "npn", at: "j34", props: { model: "2N3904" }, locked: true },
      { id: "R3", kind: "resistor", at: "c3-c15", props: { ohms: 68000 }, locked: true },
      { id: "R4", kind: "resistor", at: "h3-h35", props: { ohms: 68000 }, locked: true },
      // Cross-coupling capacitors: c1 to b2 and c2 to b1.
      { id: "C1", kind: "capacitor", at: "b14-g35", props: { farads: 0.00001, volts: 16, polarized: true } },
      { id: "C2", kind: "capacitor", at: "g34-b15", props: { farads: 0.00001, volts: 16, polarized: true } },
      // Speaker driver. pins { c: spb, b: q3b, e: gnd } and { a: c2, b: q3b }
      { id: "Q3", kind: "npn", at: "e45", props: { model: "2N3904" }, locked: true },
      { id: "R6", kind: "resistor", at: "i34-i45", props: { ohms: 4700 }, locked: true },
      // pins { a: vp, b: spa }, 0.5 W, and the speaker { a: spa, b: spb }
      { id: "R7", kind: "resistor", at: "d3-d50", props: { ohms: 220, watts: 0.5 }, locked: true },
      { id: "SP1", kind: "speaker", at: "e50-a44", props: { ohms: 8 }, locked: true },
    ],
    tray: [
      // C5 and C6: 1 µF ceramics, marked 105.
      { kind: "capacitor", props: { farads: 1e-6, polarized: false }, count: 2 },
      // C7 and C8: 100 nF ceramics, marked 104.
      { kind: "capacitor", props: { farads: 1e-7, polarized: false }, count: 2 },
      // C9 and C10: 10 nF ceramics, marked 103.
      { kind: "capacitor", props: { farads: 1e-8, polarized: false }, count: 2 },
      // A jumper wire for the optional experiment.
      { kind: "wire", count: 1 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "tick-tock",
      prompt: "Switch on and listen.",
      // GOAL: the speaker produces at least 4 click transients in 2 s (current steps through SP1) while the LEDs alternate.
      goal: (lab) => closed(lab, "S1") && placed(lab, "C1") && placed(lab, "C2") && lab.isLit("D1", 0.5) !== lab.isLit("D2", 0.5),
      hints: ["Listen at the moment the LEDs swap."],
      success: "Tick... tock. The speaker clicks each time `Q3` switches.",
    },
    {
      id: "flutter",
      prompt: "Swap both capacitors for 1 µF.",
      // GOAL: the oscillation frequency at Q2's collector is 6 to 16 Hz.
      goal: (lab) => closed(lab, "S1") && placed(lab, "C5") && placed(lab, "C6") && !placed(lab, "C1") && !placed(lab, "C2"),
      hints: ["Ceramics fit either way round."],
      success: "A rattle. The LEDs flicker too fast to follow, but you can still see them flicker.",
    },
    {
      id: "hum",
      prompt: "Now 100 nF.",
      // GOAL: the frequency is 60 to 160 Hz, and each LED's glow ripple is below 0.1.
      goal: (lab) =>
        closed(lab, "S1") &&
        placed(lab, "C7") &&
        placed(lab, "C8") &&
        between(glow(lab, "D1"), 0.2, 0.85) &&
        between(glow(lab, "D2"), 0.2, 0.85),
      hints: ["Swap both capacitors, one on each side."],
      success: "A low hum, and the LEDs look steadily half lit. Your eyes stopped seeing the blinks somewhere around 50 per second.",
    },
    {
      id: "song",
      prompt: "Now 10 nF.",
      // GOAL: the speaker's tone is 800 to 1,600 Hz.
      goal: (lab) => closed(lab, "S1") && placed(lab, "C9") && placed(lab, "C10") && !placed(lab, "C7") && !placed(lab, "C8"),
      hints: ["The smallest ceramics in the tray, marked 103."],
      success: "A clear tone! A thousand times smaller capacitors, a thousand times higher frequency. Same circuit, new job.",
    },
    {
      id: "no-resistor",
      prompt: "Optional: put a jumper across `R7`, so the speaker has no current limit. Listen for a moment.",
      // GOAL: Q3 died from overheating (it lands in the Hall of Fried Parts).
      goal: (lab) => died(lab, "Q3"),
      hints: ["The jumper goes from one end of `R7` to the other."],
      success:
        "With only the speaker's 8 Ω in the way, `Q3` tried to pass far more current than it's built for, with most of the 9 V across itself. Well past its 0.625 W rating, it cooked. That's why the speaker has a series resistor.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
