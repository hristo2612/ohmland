// Blueprint: docs/curriculum/unit-2.md, Lesson 18; docs/curriculum/conversion-guide.md, 18 (trimmed).
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/blink-and-beep/flasher-to-tone.
// One idea: shrink the capacitors and the blink speeds up until it is a tone.
//
// Lesson 17's flasher, built (68 kΩ and 10 µF, the capacitors crossing the channel at rows 11 and 12), plus a speaker
// driver on the far half: Q3 in rows 16 to 18 takes its base current from Q2's collector through R6 (4.7 kΩ, row 12
// to row 17), and switches the 8 Ω speaker, fed from the far + rail through R7 (220 Ω, 0.5 W, into row 20). The
// learner swaps the cross-coupling capacitors for smaller and smaller ceramics, marked only with their codes (105,
// 104, 103); the scope shows Q2's collector and reads the speaker's pitch.
//
// Measured in the simulator: 10 µF ticks about 2.4 times a second (two clicks per 0.8 s cycle); 1 µF flutters at
// 10 to 13 Hz; 100 nF hums at 126 to 131 Hz with both LEDs steady; 10 nF sings at 1.26 to 1.29 kHz. One 104 with one
// 103 gives about 220 Hz. Bypassing R7 does not kill Q3, but it settles near 120 °C.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** Capacitors of these values cross over: one from each collector to the other transistor's base. */
function crossedWith(lab: LabView, a: number, b: number): boolean {
  const caps = lab.bench.parts.filter((p) => p.kind === "ceramic-cap" || p.kind === "electrolytic-cap");
  const near = (id: string, f: number) => Math.abs(Number(lab.prop(id)?.["farads"] ?? 0) - f) < f * 0.01;
  const joins = (c: string, base: string, f: number) => caps.some((p) => near(p.id, f) && (p.kind === "electrolytic-cap" ? lab.joins(p.id, c, base, "forward") : lab.joins(p.id, c, base)));
  return (joins("Q1.c", "Q2.b", a) && joins("Q2.c", "Q1.b", b)) || (joins("Q1.c", "Q2.b", b) && joins("Q2.c", "Q1.b", a));
}
const crossed = (lab: LabView, farads: number) => crossedWith(lab, farads, farads);

const hz = (lab: LabView) => lab.toneHz("SP1") ?? 0;
const on = (lab: LabView) => lab.closed("S1");
/** The speaker sits between R7's end (row 20) and Q3's collector. */
const speakerIn = (lab: LabView) =>
  (lab.connected("SP1.a", "R7.b") && lab.connected("SP1.b", "Q3.c")) || (lab.connected("SP1.b", "R7.b") && lab.connected("SP1.a", "Q3.c"));

/** The fix-it bench: the speaker's lead pulled from Q3's collector row into an empty row. */
const LOOSE_LEAD: SolutionStep[] = [{ do: "move", part: "SP1", at: "h20-j24" }];

export default defineLab({
  id: "flasher-to-tone",
  title: "Shrink it to a song",
  bench: {
    board: "full",
    // The flasher and the driver (columns 1 to 21) and the speaker behind the board.
    frame: ["top+:1", "rail-:30", "desk:-40,-72"],
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
      { id: "SP1", kind: "speaker", at: "desk:-40,-58", holes: { a: "h20", b: "h18" }, params: { ohms: 8 }, label: "8 Ω speaker" },
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
      { id: "C5", kind: "ceramic-cap", params: { farads: 1e-6 }, count: 2, label: "Ceramic 105" },
      { id: "C7", kind: "ceramic-cap", params: { farads: 100e-9 }, count: 2, label: "Ceramic 104" },
      { id: "C9", kind: "ceramic-cap", params: { farads: 10e-9 }, count: 2, label: "Ceramic 103" },
    ],
    instruments: [{ kind: "scope", traces: [{ label: "Q2 collector", volts: "Q2.c" }], window: 2, range: [-1, 10], pitch: "SP1" }],
  },
  mascot: {
    start: "Blink, flicker, hum, sing. Same circuit!",
    hint: "Swap both capacitors each time: one on each side.",
    fried: "That transistor sang its last note. Hall of Fried Parts welcomes it.",
  },
  fried: { npn: "2N3904 driving a speaker" },
  tasks: [
    {
      id: "tick-tock",
      prompt: "Slide the power switch on and listen.",
      goal: (lab) => on(lab) && crossed(lab, 10e-6) && lab.blinkPeriod("D1") !== null && lab.periods("i:SP1", 0.02, 4).length >= 2,
      hints: ["The power switch is at the board's left end.", "Listen as the LEDs swap. Turn your sound on."],
      highlight: ["S1"],
      success: "Tick... tock.",
    },
    {
      id: "flutter",
      prompt: "Swap both caps for the 105 beads, crossed the same way.",
      goal: (lab) => on(lab) && crossed(lab, 1e-6) && hz(lab) >= 6 && hz(lab) <= 16,
      hints: ["Ceramics fit either way round.", "Each goes from a collector (strip 12) to the other base (strip 11)."],
      highlight: ["C1", "C2"],
      nudges: [{ when: (lab) => on(lab) && (crossed(lab, 100e-9) || crossed(lab, 10e-9)), say: "Those aren't 105. Check the code on the bead." }],
      success: "A rattle.",
    },
    {
      id: "hum",
      prompt: "Now the 104s.",
      goal: (lab) => on(lab) && crossed(lab, 100e-9) && hz(lab) >= 60 && hz(lab) <= 200 && (lab.stats("glow:D1", 1)?.span ?? 1) < 0.1 && (lab.stats("glow:D2", 1)?.span ?? 1) < 0.1,
      hints: ["Swap both capacitors, one on each side.", "104: 10 and four zeros, 100,000 pF."],
      nudges: [{ when: (lab) => on(lab) && crossed(lab, 10e-9), say: "That's 103, ten times smaller. 104, please." }],
      success: "A low hum.",
    },
    {
      id: "song",
      prompt: "Now the 103s.",
      goal: (lab) => on(lab) && crossed(lab, 10e-9) && hz(lab) >= 800 && hz(lab) <= 1600,
      hints: ["The last beads in the tray. Swap both."],
      success: "A clear tone!",
    },
    {
      id: "fix-speaker",
      prompt: "The speaker is silent. Fix it.",
      setup: LOOSE_LEAD,
      // Loose first (the setup), then back between R7 and Q3, singing.
      goal: (lab) => {
        if (!speakerIn(lab)) lab.memory["loose"] = true;
        return lab.memory["loose"] === true && speakerIn(lab) && on(lab) && hz(lab) >= 800 && hz(lab) <= 1600;
      },
      hints: ["Follow the speaker's two leads to the board.", "One lead belongs in Q3's collector strip, far strip 18."],
      highlight: ["SP1", "pin:Q3.c"],
      success: "It sings again.",
    },
    {
      id: "lopsided",
      prompt: "Mix one 104 with one 103.",
      // Only once it sings: halfway through swapping the 104s for the 103s, the bench is mixed too.
      goal: (lab) => lab.task("song") === "done" && on(lab) && crossedWith(lab, 100e-9, 10e-9) && hz(lab) >= 150 && hz(lab) <= 320,
      hints: ["One 104 on one side, one 103 on the other."],
      success: "A new note, in between.",
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
    ...LOOSE_LEAD,
    { do: "wait", seconds: 0.5 },
    { do: "move", part: "SP1", at: "h20-h18" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "fix-speaker" },
    // The secret: one 104 back on one side.
    { do: "remove", part: "C10" },
    { do: "place", part: "C8", kind: "ceramic-cap", at: "f12-e11", params: { farads: 100e-9 } },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "lopsided" },
  ],
});
