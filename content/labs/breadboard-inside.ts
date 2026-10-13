// Lab for lesson `breadboard-inside` (docs/curriculum/unit-2.md, Lesson 7).
// Board: an 830-point breadboard (63 rows x 2 sides x 5 holes, plus 4 rails), in a variant whose rails are split at
// row 32. Anchors use holes ("a12") and rail points ("rail+:5"); a two-leg part spans "from-to". All anchors are
// provisional until packages/bench owns BenchState. Tray comments give the ids the goals expect placed parts to get.
// BENCH NEEDS: an x-ray toggle showing the clips, hover highlight of a hole's whole net, the split-rail board variant,
// and a relay footprint that straddles the channel.
// LAB NEEDS: an x-ray hole picker that checks the learner's selection (xray-hunt).
// Damage moments: a relay placed along a strip instead of across the channel shorts COM, NC and NO together (both
// LEDs on) and may join the coil straight to plus. A part bridging the + and - rails directly gives `shorted`.
// Notice: the length of the path through strips doesn't matter. The strips have almost no resistance.
import { defineLab } from "@ohmland/lab";
import { closed, pullIns } from "./lib/goals";

export default defineLab({
  id: "breadboard-inside",
  title: "X-ray the breadboard",
  bench: {
    board: "breadboard",
    parts: [
      // pins { pos: vcc, neg: gnd }, clipped to the top-left rails with two short jumpers.
      { id: "B1", kind: "battery", at: "rails", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      { id: "W1", kind: "wire", at: "B1.pos-rail+:1", locked: true },
      { id: "W2", kind: "wire", at: "B1.neg-rail-:1", locked: true },
      // Station A: a correct reference circuit (lit).
      { id: "R1", kind: "resistor", at: "rail+:5-a5", props: { ohms: 470 }, locked: true },
      { id: "D1", kind: "led", at: "e5-e6", props: { color: "red" }, locked: true },
      { id: "W3", kind: "wire", at: "a6-rail-:6", locked: true },
      // Station B: the LED has both legs in strip 20 (anode 20b, cathode 20d), so it is shorted and dark.
      { id: "R2", kind: "resistor", at: "rail+:20-a20", props: { ohms: 470 }, locked: true },
      { id: "D2", kind: "led", at: "b20-d20", props: { color: "red" } },
      { id: "W4", kind: "wire", at: "e21-rail-:21", locked: true },
      // Station C: lower half, fed only by the lower rails, which are cut off at row 32.
      { id: "R3", kind: "resistor", at: "rail+:45-a45", props: { ohms: 470 }, locked: true },
      { id: "D3", kind: "led", at: "c45-c47", props: { color: "red" }, locked: true },
      { id: "W5", kind: "wire", at: "a47-rail-:47", locked: true },
    ],
    tray: [
      // Jumper wires in red, blue, green and yellow.
      { kind: "wire", count: 12 },
      // K1: a relay in a breadboard footprint. pins { coilA, coilB, com, no, nc }
      { kind: "relay", props: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, count: 1 },
      // S1
      { kind: "pushbutton", count: 1 },
      // D4
      { kind: "diode", props: { model: "1N4001" }, count: 1 },
      // R4 and R5
      { kind: "resistor", props: { ohms: 470 }, count: 2 },
      // D5
      { kind: "led", props: { color: "yellow" }, count: 1 },
      // D6
      { kind: "led", props: { color: "green" }, count: 1 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "xray-hunt",
      prompt: "Switch on x-ray. Tap hole 12a, then tap every hole you think is connected to it. Check your guess.",
      // GOAL: the learner's selection equals the true net of 12a (12a to 12e).
      // TODO(lab-panel): needs the x-ray hole picker.
      goal: () => false,
      hints: ["Look at the metal clip under row 12 on this side of the channel.", "The channel down the middle is a wall."],
      success: "Five holes per clip, and the clip stops at the channel.",
    },
    {
      id: "fix-dark-led",
      prompt: "The LED at station B is dark. Fix it by moving one leg.",
      // GOAL: D2 is lit, with its anode and cathode in different nets.
      goal: (lab) => lab.isLit("D2"),
      hints: [
        "Both of `D2`'s legs are in row 20. What does that clip do to them?",
        "Move the cathode to row 21, where the jumper to the minus rail starts.",
      ],
      success: "Both legs in one strip means the strip shorts the LED. Every part needs its legs in different strips.",
    },
    {
      id: "bus-gap",
      prompt: "Station C is dead. The meter will tell you why.",
      // GOAL: two jumpers bridge the rail gap at row 32 (red to red, blue to blue), and D3 lights.
      goal: (lab) => lab.isLit("D3"),
      hints: [
        "Measure the voltage between the plus and minus rails at row 10, then at row 50.",
        "Some boards split each rail halfway. Look for a gap in the printed stripe.",
      ],
      success: "Split rails are a classic trap. A bridge jumper, and the lower half wakes up.",
    },
    {
      id: "relay-on-board",
      prompt:
        "Rebuild the relay changeover on the board, with one battery: COM to plus, the yellow LED on NC, the green LED on NO, the button feeding the coil, and the diode across the coil.",
      // GOAL: K1 straddles the channel (no two relay pins in one net), D5 is lit at rest, D6 is lit while S1 is held,
      // and D4's band faces the coil's positive end.
      goal: (lab) =>
        pullIns(lab, "K1").length > 0 &&
        closed(lab, "K1") &&
        lab.isLit("D6") &&
        !lab.isLit("D5") &&
        lab.part("D4")?.health === "ok" &&
        (lab.part("D4")?.v ?? 0) < -1,
      hints: [
        "The relay's pins sit on both sides of the channel, so each pin gets its own strip.",
        "Build it from the schematic one wire at a time, ticking off each connection.",
      ],
      success: "Your first proper breadboard build. Neat, solid and ready to be modified.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
