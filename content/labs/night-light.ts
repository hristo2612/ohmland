// Lab for lesson `night-light` (docs/curriculum/unit-2.md, Lesson 16).
// Netlist pins are noted beside each part; `at` anchors are provisional until packages/bench owns BenchState. Tray
// comments give the ids the goals expect placed parts to get.
// BENCH NEEDS: a desk lamp and shade prop whose slider drives the `light` input (0 pitch dark, 0.3 room light, 1 bright
// lamp) of every phototransistor on the bench.
// Numbers (sim phototransistor: about 2 mA x light): at station B, R3 + P1 feed Q1's base with (9 - 0.65) V ÷ (4.7 kΩ +
// P1). P1 starts at position 0.5 (25 kΩ, about 0.28 mA), so the lamp switches near light 0.14. For set-dusk (on at
// 0.18, off at 0.32) the feed must sit between about 0.37 and 0.64 mA: P1 positions from about 0.17 to 0.35.
// Damage moments: PT2 in backwards does nothing (`reversed` warning, no damage at this current).
// Notice: near the threshold the lamp glows dimly instead of snapping on. Unit 4 cures that with hysteresis, just
// like the relay's.
import { defineLab } from "@ohmland/lab";
import { between, extraNum, glow, happened, placed } from "./lib/goals";

export default defineLab({
  id: "night-light",
  title: "Lights on at dusk",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // Station A. pins { c: vcc, e: pe }, then { a: pe, b: la } and { anode: la, cathode: gnd }
      { id: "PT1", kind: "phototransistor", at: "rail+:5-a5", props: { light: 0.3 }, locked: true },
      { id: "R1", kind: "resistor", at: "e5-e10", props: { ohms: 1000 }, locked: true },
      { id: "D1", kind: "led", at: "a10-rail-:10", props: { color: "red" }, locked: true },
      // Station B. pins { a: vcc, b: la2 } and { anode: la2, cathode: lc2 }
      { id: "R2", kind: "resistor", at: "rail+:30-a30", props: { ohms: 470 }, locked: true },
      { id: "D2", kind: "led", at: "e30-e34", props: { color: "yellow" }, locked: true },
      // pins { c: lc2, b: qb, e: gnd }
      { id: "Q1", kind: "npn", at: "a34", props: { model: "2N3904" }, locked: true },
      // The base feed. pins { a: vcc, b: pb } and the trimmer { a: pb, wiper: qb, b: qb }
      { id: "R3", kind: "resistor", at: "rail+:40-a40", props: { ohms: 4700 }, locked: true },
      { id: "P1", kind: "pot", at: "e40", props: { ohms: 50000, position: 0.5 }, locked: true },
    ],
    tray: [
      // PT2: target pins { c: qb, e: gnd }
      { kind: "phototransistor", props: { light: 0.3 }, count: 1 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "follow-the-light",
      prompt: "At station A, slide the light from dark to bright.",
      // GOAL: D1's glow at light 1.0 exceeds its glow at light 0.1 by more than 0.3.
      goal: (lab) => (extraNum(lab, "PT1", "light") ?? 0) >= 0.95 && glow(lab, "D1") > 0.44,
      hints: ["The lamp's slider sets how much light falls on the bench."],
      success: "More light, more current. The phototransistor is a light-operated valve.",
    },
    {
      id: "flip-it",
      prompt:
        "At station B, `Q1`'s base is fed through the trimmer. Plug `PT2` in from `Q1`'s base strip to ground, collector to the base strip. Then make it dark, then bright.",
      // GOAL: D2's glow is above 0.6 at light 0.05 and below 0.05 at light 0.8.
      goal: (lab) =>
        placed(lab, "PT2") && !happened(lab, "PT2", "reversed") && (extraNum(lab, "PT2", "light") ?? 0) >= 0.8 && glow(lab, "D2") < 0.05,
      hints: [
        "On many phototransistors the collector is the shorter leg, by the flat side. Check the part's info card.",
        "In the light, `PT2` steals `Q1`'s base current.",
      ],
      success: "Dark: `Q1`'s base gets its current, and the lamp shines. Light: `PT2` drains that current to ground first.",
    },
    {
      id: "set-dusk",
      prompt: "Turn the trimmer so the lamp comes on as the light drops below about 0.25.",
      // GOAL: D2's glow is above 0.5 at light 0.18 and below 0.1 at light 0.32.
      goal: (lab) => placed(lab, "PT2") && between(extraNum(lab, "P1", "position"), 0.17, 0.35),
      hints: ["Less base resistance feeds `Q1` more current, so it takes more light to steal it all."],
      success: "Your lamp now has a sense of when dusk is.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors and the lamp prop.
  solution: [],
});
