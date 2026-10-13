// Lab for lesson `relay-buzzer` (docs/curriculum/unit-2.md, Lesson 8).
// The learner's changeover from lesson 7, rebuilt by the lab with a power switch. Netlist pins are noted beside each
// part; `at` anchors are provisional until packages/bench owns BenchState. Tray comments give the ids the goals expect.
// Instruments: meter and scope (BenchConfig only lists "meter" today).
// Expected timing (sim relay: operate 5 ms, release 3 ms): with 1,000 µF across the coil it holds for about
// 0.54 s x ln(9 / 1.8) = 0.87 s; with R4 (100 Ω) in the feed, about 0.65 s hold plus 0.1 s refill; with 470 µF and
// R4, about 0.37 s in all.
// SIM NEEDS: an audible buzz synthesized from click events above about 30 per second; contact wear per spark and per
// surge, so buzzing for about 20 s in total kills the relay (`died`, data.cause "worn", contacts stuck open; Hall of
// Fried Parts label "relay: contacts worn out by buzzing").
// Damage moments: the buzzing relay wears out (robot: "It buzzed itself to bits. Real relays do that too. New one on
// the bench."). C1 in backwards sees about -8 V: `reversed`, then it heats and vents after a few seconds (`died`).
import { defineLab } from "@ohmland/lab";
import { between, closed, eventsOf, glow, mostInWindow, placed, ticksWithin } from "./lib/goals";

export default defineLab({
  id: "relay-buzzer",
  title: "A relay that switches itself",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // Power switch. pins { a: vcc, b: vsw }
      { id: "S2", kind: "switch", at: "rail+:3-a3", props: { closed: false }, locked: true },
      // pins { coilA: k1a, coilB: gnd, com: vsw, no: kno, nc: knc }
      { id: "K1", kind: "relay", at: "e10", props: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true },
      // Protection diode. pins { anode: gnd, cathode: k1a }
      { id: "D1", kind: "diode", at: "rail-:12-a12", props: { model: "1N4001" }, locked: true },
      // pins { a: knc, b: y } and { anode: y, cathode: gnd }
      { id: "R2", kind: "resistor", at: "j11-j20", props: { ohms: 470 }, locked: true },
      { id: "D2", kind: "led", at: "f20-rail-:20", props: { color: "yellow" }, locked: true },
      // pins { a: kno, b: g } and { anode: g, cathode: gnd }
      { id: "R3", kind: "resistor", at: "j13-j25", props: { ohms: 470 }, locked: true },
      { id: "D3", kind: "led", at: "f25-rail-:25", props: { color: "green" }, locked: true },
      // The coil's feed for now, to be replaced by a jumper from NC. pins { a: vsw, b: k1a }
      { id: "S1", kind: "pushbutton", at: "c3-c12" },
    ],
    tray: [
      // C1: 1,000 µF, 16 V
      { kind: "capacitor", props: { farads: 0.001, volts: 16, polarized: true }, count: 1 },
      // C2: 470 µF, 16 V
      { kind: "capacitor", props: { farads: 0.00047, volts: 16, polarized: true }, count: 1 },
      // R4: 100 Ω
      { kind: "resistor", props: { ohms: 100 }, count: 1 },
      { kind: "wire", count: 6 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "move-one-wire",
      prompt: "Remove `S1` and feed the coil from the relay's NC contact instead. Then turn on `S2`.",
      // GOAL: with S2 closed, at least 40 K1 `clicked` events within some 1 s window, and D2 and D3 both read glow
      // 0.15 to 0.85.
      goal: (lab) =>
        closed(lab, "S2") &&
        mostInWindow(
          eventsOf(lab, "K1", "clicked").map((e) => e.t),
          1,
        ) >= 40 &&
        between(glow(lab, "D2"), 0.15, 0.85) &&
        between(glow(lab, "D3"), 0.15, 0.85),
      hints: ["One jumper from the NC strip to the coil's top strip does it.", "If nothing happens, check that the coil still has its ground."],
      success:
        "It buzzes! Each time it pulls in, it cuts its own power. Each time it lets go, the power returns. Both LEDs look half lit because they swap too fast to see. Turn `S2` off soon: the contacts are sparking and wearing.",
    },
    {
      id: "tame-it",
      prompt:
        "Add the 1,000 µF capacitor across the coil: the + leg on the coil's top strip, the - leg (the striped side) to ground. Turn on `S2`.",
      // GOAL: K1 toggles with a full period of 0.5 to 1.4 s for at least 3 cycles.
      goal: (lab) => placed(lab, "C1") && ticksWithin(lab, "K1", 3, 0.5, 1.4),
      hints: ["The stripe on the capacitor's sleeve marks its negative leg.", "The longer leg is positive."],
      success:
        "Tick, tock. The capacitor keeps the coil powered after the contact opens, so the relay stays in for most of a second.",
    },
    {
      id: "soften-the-surge",
      prompt:
        "Every time NC closes, the empty capacitor gulps a big surge through the contacts. Put the 100 Ω resistor between NC and the coil to soften it.",
      // GOAL: R4 is in series between knc and k1a, the K1 period is 0.4 to 1.3 s, and the yellow LED glows above 0.3
      // for at least 50 ms in each cycle.
      goal: (lab) => placed(lab, "R4") && placed(lab, "C1") && ticksWithin(lab, "K1", 3, 0.4, 1.3),
      hints: ["NC to `R4`, `R4` to the coil's top strip. Remove the direct jumper."],
      success: "Gentler on the contacts. And now the yellow LED gets a real blink while the capacitor refills.",
    },
    {
      id: "faster-ticks",
      prompt: "Swap in the 470 µF capacitor. Predict first: faster or slower?",
      // GOAL: the K1 period is 0.2 to 0.7 s.
      goal: (lab) => placed(lab, "C2") && !placed(lab, "C1") && ticksWithin(lab, "K1", 3, 0.2, 0.7),
      hints: ["Same spot, same way round: stripe to ground."],
      success: "About half the capacitance, about half the hold time.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
