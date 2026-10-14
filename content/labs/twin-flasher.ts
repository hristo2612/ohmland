// Blueprint: docs/curriculum/unit-2.md, Lesson 17; docs/curriculum/conversion-guide.md, 17 (trimmed).
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/blink-and-beep/twin-flasher.
// One idea: two transistors cross-coupled by capacitors take turns forever.
//
// Layout: the battery snap feeds a slide switch at the left end (com in row 2, b in row 3); row 3 jumps to
// the near + rail, which is bridged to the far + rail, so both rails carry the switched supply. Q1 sits on the near
// half (E B C in rows 10 to 12, flat face toward you) and Q2 faces it on the far half, in the same rows. Each
// collector has its LED (rows 12 and 13) and a 1 kΩ from its + rail. The learner adds the 68 kΩ base resistors
// (rail to row 11, both halves) and then the two 10 µF capacitors, which cross the channel: + on one collector,
// stripe on the other transistor's base.
//
// Measured in the simulator: 10 µF blinks every 0.83 s (each LED lit about half the time); 22 µF every 1.87 s; Q2's
// base dives to about -6.8 V. With one capacitor out, both LEDs just stay on.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const isCap = (lab: LabView, id: string, farads?: number) => {
  const p = lab.benchPart(id);
  return p?.kind === "electrolytic-cap" && (farads === undefined || Math.abs(p.params.farads - farads) < farads * 0.01);
};
/** Electrolytics with + on `c` and the stripe on `b`, of this many farads (any, if not given). */
const crossing = (lab: LabView, c: string, b: string, farads?: number) => lab.bench.parts.some((p) => isCap(lab, p.id, farads) && lab.joins(p.id, c, b, "forward"));

/** Both capacitors cross over, each + on a collector and stripe on the other base. */
const crossed = (lab: LabView, farads?: number) => crossing(lab, "Q1.c", "Q2.b", farads) && crossing(lab, "Q2.c", "Q1.b", farads);

/** Both LEDs steadily lit over the last second. */
const bothOn = (lab: LabView) => {
  const a = lab.stats("glow:D1", 1);
  const b = lab.stats("glow:D2", 1);
  return !!a && !!b && a.min > 0.5 && b.min > 0.5 && a.span < 0.05 && b.span < 0.05;
};

/** The two LEDs blink with a steady period in [lo, hi] seconds, taking turns (lit together under 20% of the time). */
function takingTurns(lab: LabView, lo: number, hi: number): boolean {
  const p1 = lab.blinkPeriod("D1");
  const p2 = lab.blinkPeriod("D2");
  if (p1 === null || p2 === null || p1 < lo || p1 > hi || p2 < lo || p2 > hi) return false;
  const a = lab.history("glow:D1", 2 * hi);
  const b = new Map(lab.history("glow:D2", 2 * hi));
  let either = 0;
  let both = 0;
  for (const [t, g1] of a) {
    const g2 = b.get(t) ?? 0;
    if (g1 > 0.4 || g2 > 0.4) either++;
    if (g1 > 0.4 && g2 > 0.4) both++;
  }
  return either > 0 && both / either < 0.2;
}

/** The fix-it bench: the finished flasher, power on, blinking just under once a second. Too fast for the tower. */
const POWER_ON: SolutionStep[] = [{ do: "flip", part: "S1", to: "b" }];

export default defineLab({
  id: "twin-flasher",
  title: "The twin blinker",
  bench: {
    board: "full",
    // The battery, the switch and the flasher at the left end of the board.
    frame: ["desk:-108,-30", "desk:-28,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Power switch" },
      // Left half, near side: Q1 with flat face toward you, its LED and collector resistor.
      { id: "Q1", kind: "npn", at: "d10", locked: true, label: "Q1 (2N3904)" },
      { id: "D1", kind: "led", at: "c13", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "R1", kind: "resistor", at: "rail+:13-b13", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      // Right half, far side: Q2 facing Q1 across the channel.
      { id: "Q2", kind: "npn", at: "g10", locked: true, label: "Q2 (2N3904)" },
      { id: "D2", kind: "led", at: "h13", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D2" },
      { id: "R2", kind: "resistor", at: "top+:13-i13", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R2" },
    ],
    wires: [
      { id: "W1", from: "a3", to: "rail+:3", color: "red" },
      { id: "W2", from: "rail+:5", to: "top+:5", color: "red" },
      { id: "W3", from: "rail-:6", to: "top-:6", color: "black" },
      { id: "W4", from: "a10", to: "rail-:10", color: "black" },
      { id: "W5", from: "j10", to: "top-:10", color: "black" },
    ],
    tray: [
      { id: "R3", kind: "resistor", params: { ohms: 68000 }, count: 2, label: "68 kΩ" },
      { id: "C1", kind: "electrolytic-cap", params: { farads: 10e-6, volts: 16 }, count: 2, label: "10 µF" },
      { id: "C3", kind: "electrolytic-cap", params: { farads: 22e-6, volts: 16 }, count: 2, label: "22 µF" },
    ],
    instruments: [
      { kind: "scope", traces: [{ label: "Q2 base", volts: "Q2.b" }, { label: "Q1 collector", volts: "Q1.c" }], window: 4, range: [-8, 10] },
    ],
  },
  mascot: {
    start: "Two switches, side by side. Let's make them take turns.",
    hint: "Each capacitor crosses over: one collector to the other base.",
    fried: "Ouch. Swap in a fresh one and check which way round it goes.",
  },
  fried: { led: "Red LED in the twin blinker", npn: "2N3904 in the twin blinker", "electrolytic-cap": "Capacitor in the twin blinker" },
  tasks: [
    {
      id: "bases-up",
      prompt: "Feed each base from the + rail through 68 kΩ. Power on.",
      goal: (lab) => lab.closed("S1") && !crossed(lab) && bothOn(lab),
      hints: ["Both bases are in row 11: one near half, one far half.", "The power switch is at the board's left end."],
      highlight: ["pin:Q1.b", "pin:Q2.b", "S1"],
      success: "Two switches, both on.",
    },
    {
      id: "cross-couple",
      prompt: "Add two 10 µF caps: each collector to the other base.",
      goal: (lab) => lab.closed("S1") && crossed(lab, 10e-6) && takingTurns(lab, 0.6, 1.3),
      hints: ["Each cap crosses the channel: + leg on a collector, row 12.", "Stripe on the other transistor's base, row 11."],
      highlight: ["pin:Q1.c", "pin:Q2.b", "pin:Q2.c", "pin:Q1.b"],
      success: "They take turns!",
    },
    {
      id: "look-inside",
      prompt: "Watch the scope: yellow is Q2's base. How low does it go?",
      goal: (lab) => crossed(lab) && (lab.stats("volts:Q2.b", 6)?.min ?? 0) < -4,
      hints: ["Watch yellow just after blue drops. 0 V is the minus rail."],
      success: "Below zero, then back up to 0.7 V.",
    },
    {
      id: "slow-it-down",
      prompt: "The tower blinks too fast. About 2 s, please.",
      setup: POWER_ON,
      goal: (lab) => {
        if (crossed(lab, 10e-6)) lab.memory["fast"] = true;
        return lab.memory["fast"] === true && lab.closed("S1") && crossed(lab, 22e-6) && takingTurns(lab, 1.3, 2.9);
      },
      hints: ["A bigger capacitor fills more slowly.", "Swap both, same way round: + on a collector."],
      highlight: ["pin:Q1.c", "pin:Q2.c"],
      success: "Twice the capacitance, twice the period.",
    },
    {
      id: "one-cap",
      prompt: "Pull one capacitor out.",
      // Only once the flasher has run: half-built, one capacitor in, the LEDs stare too.
      goal: (lab) => lab.task("cross-couple") === "done" && lab.closed("S1") && crossing(lab, "Q1.c", "Q2.b") !== crossing(lab, "Q2.c", "Q1.b") && bothOn(lab),
      hints: ["Lift either capacitor off the board."],
      success: "Both just stare. No kick, no turns.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "R3", kind: "resistor", at: "rail+:11-b11", params: { ohms: 68000 } },
    { do: "place", part: "R4", kind: "resistor", at: "top+:11-i11", params: { ohms: 68000 } },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "bases-up" },
    { do: "place", part: "C1", kind: "electrolytic-cap", at: "e12-f11", params: { farads: 10e-6, volts: 16 } },
    { do: "place", part: "C2", kind: "electrolytic-cap", at: "f12-e11", params: { farads: 10e-6, volts: 16 } },
    { do: "wait", seconds: 5 },
    { do: "check", task: "cross-couple" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "look-inside" },
    ...POWER_ON,
    { do: "wait", seconds: 1 },
    { do: "remove", part: "C1" },
    { do: "remove", part: "C2" },
    { do: "place", part: "C3", kind: "electrolytic-cap", at: "e12-f11", params: { farads: 22e-6, volts: 16 } },
    { do: "place", part: "C4", kind: "electrolytic-cap", at: "f12-e11", params: { farads: 22e-6, volts: 16 } },
    { do: "wait", seconds: 9 },
    { do: "check", task: "slow-it-down" },
    // The secret: one capacitor out, and both LEDs stop taking turns.
    { do: "remove", part: "C4" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "one-cap" },
  ],
});
