// Blueprint: docs/curriculum/unit-2.md, Lesson 18. Lesson 17's flasher, built (68 kΩ and 10 µF, the capacitors
// crossing the channel at rows 11 and 12), plus a speaker driver on the far half: Q3 in rows 16 to 18 takes its base
// current from Q2's collector through R6 (4.7 kΩ, row 12 to row 17), and switches the 8 Ω speaker, fed from the far
// + rail through R7 (220 Ω, 0.5 W, into row 20). The learner swaps the cross-coupling capacitors for smaller and
// smaller ceramics; the scope shows Q2's collector and reads the speaker's pitch.
//
// Measured in the simulator: 10 µF ticks about 2.4 times a second; 1 µF flutters near 12 Hz; 100 nF hums near
// 120 Hz with both LEDs steady; 10 nF sings near 1.2 kHz.
import { defineLab, type LabView } from "@ohmland/lab";

/** Capacitors of this value cross over: one from each collector to the other transistor's base. */
function crossed(lab: LabView, farads: number): boolean {
  const caps = lab.bench.parts.filter((p) => (p.kind === "ceramic-cap" || p.kind === "electrolytic-cap") && Math.abs(p.params.farads - farads) < farads * 0.01);
  const joins = (c: string, b: string) => caps.some((p) => (p.kind === "electrolytic-cap" ? lab.joins(p.id, c, b, "forward") : lab.joins(p.id, c, b)));
  return joins("Q1.c", "Q2.b") && joins("Q2.c", "Q1.b");
}

const hz = (lab: LabView) => lab.toneHz("SP1") ?? 0;
const on = (lab: LabView) => lab.closed("S1");

export default defineLab({
  id: "flasher-to-tone",
  title: "Shrink it to a song",
  bench: {
    board: "full",
    frame: ["desk:-108,-80", "desk:0,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Power switch" },
      // The flasher.
      { id: "Q1", kind: "npn", at: "d10", locked: true, label: "Q1 (2N3904)" },
      { id: "D1", kind: "led", at: "c13", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "R1", kind: "resistor", at: "rail+:13-b13", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "R3", kind: "resistor", at: "rail+:11-b11", params: { ohms: 68000 }, locked: true, label: "68 kΩ resistor R3" },
      { id: "Q2", kind: "npn", at: "g10", locked: true, label: "Q2 (2N3904)" },
      { id: "D2", kind: "led", at: "h13", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D2" },
      { id: "R2", kind: "resistor", at: "top+:13-i13", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R2" },
      { id: "R4", kind: "resistor", at: "top+:11-i11", params: { ohms: 68000 }, locked: true, label: "68 kΩ resistor R4" },
      { id: "C1", kind: "electrolytic-cap", at: "e12-f11", params: { farads: 10e-6, volts: 16 }, label: "10 µF capacitor C1" },
      { id: "C2", kind: "electrolytic-cap", at: "f12-e11", params: { farads: 10e-6, volts: 16 }, label: "10 µF capacitor C2" },
      // The speaker driver.
      { id: "Q3", kind: "npn", at: "g16", locked: true, label: "Q3 (2N3904)" },
      { id: "R6", kind: "resistor", at: "j12-j17", params: { ohms: 4700 }, locked: true, label: "4.7 kΩ resistor R6" },
      { id: "R7", kind: "resistor", at: "top+:21-i20", params: { ohms: 220, watts: 0.5 }, locked: true, label: "220 Ω resistor R7, 0.5 W" },
      { id: "SP1", kind: "speaker", at: "desk:-40,-58", holes: { a: "h20", b: "h18" }, params: { ohms: 8 }, locked: true, label: "8 Ω speaker" },
    ],
    wires: [
      { id: "W1", from: "a3", to: "rail+:3", color: "red" },
      { id: "W2", from: "rail+:5", to: "top+:5", color: "red" },
      { id: "W3", from: "rail-:6", to: "top-:6", color: "black" },
      { id: "W4", from: "a10", to: "rail-:10", color: "black" },
      { id: "W5", from: "j10", to: "top-:10", color: "black" },
      { id: "W6", from: "i16", to: "top-:16", color: "black" },
    ],
    tray: [
      { id: "C5", kind: "ceramic-cap", params: { farads: 1e-6 }, count: 2, label: "1 µF (105)" },
      { id: "C7", kind: "ceramic-cap", params: { farads: 100e-9 }, count: 2, label: "100 nF (104)" },
      { id: "C9", kind: "ceramic-cap", params: { farads: 10e-9 }, count: 2, label: "10 nF (103)" },
    ],
    instruments: [{ kind: "scope", traces: [{ label: "Q2 collector", volts: "Q2.c" }], window: 2, range: [-1, 10], pitch: "SP1" }],
  },
  mascot: {
    start: "Blink, flicker, hum, sing. Same circuit!",
    hint: "Swap both capacitors each time: one on each side.",
    success: "Smaller capacitors, faster flips.",
    fried: "That transistor sang its last note. Hall of Fried Parts welcomes it.",
    exit: "A thousand times smaller, a thousand times higher. You made it sing.",
  },
  fried: { npn: "2N3904 driving a speaker with no resistor" },
  tasks: [
    {
      id: "tick-tock",
      prompt: "Slide the power switch on and listen.",
      goal: (lab) => on(lab) && crossed(lab, 10e-6) && lab.blinkPeriod("D1") !== null && lab.periods("i:SP1", 0.02, 4).length >= 2,
      hints: ["Listen at the moment the LEDs swap. Turn your sound on."],
      success: "Tick... tock. The speaker clicks each time Q3 switches.",
    },
    {
      id: "flutter",
      prompt: "Swap both capacitors for the **1 µF** ceramics (marked 105), crossing over just like the old ones.",
      goal: (lab) => on(lab) && crossed(lab, 1e-6) && hz(lab) >= 6 && hz(lab) <= 16,
      hints: ["Ceramics fit either way round.", "Each one bends from a collector (row 12) across the channel to the other base (row 11)."],
      success: "A rattle. The LEDs flicker too fast to follow, but you can still see them flicker.",
    },
    {
      id: "hum",
      prompt: "Now **100 nF** (marked 104).",
      goal: (lab) => on(lab) && crossed(lab, 100e-9) && hz(lab) >= 60 && hz(lab) <= 160 && (lab.stats("glow:D1", 1)?.span ?? 1) < 0.1 && (lab.stats("glow:D2", 1)?.span ?? 1) < 0.1,
      hints: ["Swap both capacitors, one on each side."],
      success: "A low hum, and the LEDs look steadily half lit. Your eyes stopped seeing the blinks somewhere around 50 per second.",
    },
    {
      id: "song",
      prompt: "Now **10 nF** (marked 103).",
      goal: (lab) => on(lab) && crossed(lab, 10e-9) && hz(lab) >= 800 && hz(lab) <= 1600,
      hints: ["The smallest ceramics in the tray."],
      success: "A clear tone! A thousand times smaller capacitors, a thousand times higher frequency. Same circuit, new job.",
    },
    {
      id: "no-resistor",
      prompt: "Optional: put a jumper across **R7**, so the speaker has no current limit. Listen for a moment.",
      goal: (lab) => lab.died("Q3"),
      hints: ["Use the Wire tool: one end in R7's rail hole's neighbour on the + rail, the other in row 20."],
      success:
        "With only the speaker's 8 Ω in the way, Q3 tried to pass hundreds of milliamps with most of the 9 V across itself: far past its 0.625 W rating. It cooked. That's why the speaker has a series resistor.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "tick-tock" },
    { do: "remove", part: "C1" },
    { do: "remove", part: "C2" },
    { do: "place", part: "C5", kind: "ceramic-cap", at: "e12-f11", params: { farads: 1e-6 } },
    { do: "place", part: "C6", kind: "ceramic-cap", at: "f12-e11", params: { farads: 1e-6 } },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "flutter" },
    { do: "remove", part: "C5" },
    { do: "remove", part: "C6" },
    { do: "place", part: "C7", kind: "ceramic-cap", at: "e12-f11", params: { farads: 100e-9 } },
    { do: "place", part: "C8", kind: "ceramic-cap", at: "f12-e11", params: { farads: 100e-9 } },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "hum" },
    { do: "remove", part: "C7" },
    { do: "remove", part: "C8" },
    { do: "place", part: "C9", kind: "ceramic-cap", at: "e12-f11", params: { farads: 10e-9 } },
    { do: "place", part: "C10", kind: "ceramic-cap", at: "f12-e11", params: { farads: 10e-9 } },
    { do: "wait", seconds: 1 },
    { do: "check", task: "song" },
  ],
});
