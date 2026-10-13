// Blueprint: docs/curriculum/unit-2.md, Lesson 17. A two-transistor astable on the breadboard.
//
// Layout: the battery snap feeds a slide switch at the left end (com in column 2, b in column 3); column 3 jumps to
// the near + rail, which is bridged to the far + rail, so both rails carry the switched supply. Q1 sits on the near
// half (E B C in columns 10 to 12, flat face toward you) and Q2 faces it on the far half, in the same columns. Each
// collector has its LED (columns 12 and 13) and a 1 kΩ from its + rail. The learner adds the 68 kΩ base resistors
// (rail to column 11, both halves) and then the two 10 µF capacitors, which cross the channel: + on one collector,
// stripe on the other transistor's base.
//
// Measured in the simulator: 10 µF blinks every 0.84 s (each LED lit about half the time); 22 µF every 1.8 s; Q2's
// base dives to about -6.5 V.
import { defineLab, type LabView } from "@ohmland/lab";

/** Electrolytics with + on `c` and the stripe on `b`, of this many farads (any, if not given). */
const crossing = (lab: LabView, c: string, b: string, farads?: number) =>
  lab.bench.parts.some(
    (p) => p.kind === "electrolytic-cap" && (farads === undefined || Math.abs(p.params.farads - farads) < farads * 0.01) && lab.joins(p.id, c, b, "forward"),
  );

/** Both capacitors cross over, each + on a collector and stripe on the other base. */
const crossed = (lab: LabView, farads?: number) => crossing(lab, "Q1.c", "Q2.b", farads) && crossing(lab, "Q2.c", "Q1.b", farads);

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

export default defineLab({
  id: "twin-flasher",
  title: "The twin blinker",
  bench: {
    board: "full",
    // The battery, the switch and the flasher at the left end of the board.
    frame: ["desk:-140,-30", "desk:0,32"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-118,6", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
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
    success: "Your turn, my turn, forever.",
    fried: "Ouch. Swap in a fresh one and check which way round it goes.",
    exit: "No clicks, no wear. These lamps will outlive me.",
  },
  fried: { led: "Red LED in the twin blinker", npn: "2N3904 in the twin blinker" },
  tasks: [
    {
      id: "bases-up",
      prompt: "Add a 68 kΩ resistor from the + rail to each transistor's base (the middle leg). Then slide the power switch on.",
      goal: (lab) => {
        if (!lab.closed("S1") || crossed(lab)) return false;
        const a = lab.stats("glow:D1", 1);
        const b = lab.stats("glow:D2", 1);
        return !!a && !!b && a.min > 0.5 && b.min > 0.5 && a.span < 0.05 && b.span < 0.05;
      },
      hints: [
        "Q1's base is column 11 on the near half; Q2's base is column 11 on the far half. Each needs its own 68 kΩ from the + rail beside it.",
        "Then slide the switch at the left end of the board toward the board's middle.",
      ],
      highlight: ["pin:Q1.b", "pin:Q2.b", "S1"],
      success: "Two independent switches, both on. Nothing interesting yet. Let's make them talk.",
    },
    {
      id: "cross-couple",
      prompt:
        "Add a 10 µF capacitor from Q1's collector to Q2's base, and another from Q2's collector to Q1's base. The **+ leg goes to the collector**, the striped leg to the base.",
      goal: (lab) => lab.closed("S1") && crossed(lab, 10e-6) && takingTurns(lab, 0.6, 1.3),
      hints: [
        "Each capacitor crosses the channel: a collector on one side, the other transistor's base on the other.",
        "Stripe (negative) toward the base. Bend the legs to reach: put the + leg in column 12 on one half and the stripe in column 11 on the other half.",
      ],
      highlight: ["pin:Q1.c", "pin:Q2.b", "pin:Q2.c", "pin:Q1.b"],
      success: "They take turns! No moving parts, no wear, no clicks.",
      notice: "Look at the period: just under a second. 1.4 × 68 kΩ × 10 µF says 0.95 s, and real flashers run a little fast.",
    },
    {
      id: "look-inside",
      prompt: "Watch the scope. The yellow trace is Q2's base, the blue one Q1's collector. How low does Q2's base go?",
      goal: (lab) => crossed(lab) && (lab.stats("volts:Q2.b", 6)?.min ?? 0) < -4,
      hints: ["Watch the yellow trace just after the blue one drops. The scope's 0 V line is the - rail."],
      success: "Q2's base dives far below zero, then climbs back along a familiar curve. When it reaches about 0.7 V, Q2 switches on.",
      notice: "Below zero is fine: the capacitor still holds its charge while its other plate is yanked down.",
      mascot: { success: "Below zero volts. Don't worry, it's relative." },
    },
    {
      id: "slow-it-down",
      prompt: "Swap both capacitors for 22 µF. Predict the new period, then check.",
      goal: (lab) => lab.closed("S1") && crossed(lab, 22e-6) && takingTurns(lab, 1.3, 2.9),
      hints: ["Same places, same way round: the + leg to a collector, the stripe to the other base.", "Give it a few blinks to settle."],
      success: "About twice the capacitance, about twice the period. Same rule as every RC circuit.",
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
    { do: "remove", part: "C1" },
    { do: "remove", part: "C2" },
    { do: "place", part: "C3", kind: "electrolytic-cap", at: "e12-f11", params: { farads: 22e-6, volts: 16 } },
    { do: "place", part: "C4", kind: "electrolytic-cap", at: "f12-e11", params: { farads: 22e-6, volts: 16 } },
    { do: "wait", seconds: 9 },
    { do: "check", task: "slow-it-down" },
  ],
});
