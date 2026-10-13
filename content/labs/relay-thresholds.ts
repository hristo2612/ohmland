// Lab for lesson `relay-thresholds` (docs/curriculum/unit-2.md, Lesson 5).
// B1 drives the coil side, B2 the LED side; the two circuits never share a wire. `at` anchors are provisional until
// packages/bench owns BenchState.
// SIM NEEDS: per-instance spread of pullIn and dropOut (about ±5%), exposed to the lab as the instance values.
// LAB NEEDS: numeric answer entry checked against the instance pullIn and dropOut (find-pull-in, find-drop-out).
// Damage moments: none planned.
// Notice: the gap between the two numbers is hysteresis. It stops the relay chattering when the voltage wobbles near
// one threshold.
import { defineLab } from "@ohmland/lab";
import { between, closed, eventsOf, pullIns } from "./lib/goals";

export default defineLab({
  id: "relay-thresholds",
  title: "Click in, click out",
  bench: {
    board: "none",
    parts: [
      // Coil side. pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "mat:battery-1", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // LED side. pins { pos: v2, neg: g2 }
      { id: "B2", kind: "battery", at: "mat:battery-2", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // pins { coilA: k1a, coilB: gnd, com: kc, no: kno, nc: knc }
      { id: "K1", kind: "relay", at: "mat:relay", props: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true },
      // pins { a: vcc, b: k1a }
      { id: "S1", kind: "pushbutton", at: "mat:button" },
      // Placed but not clipped to anything yet.
      { id: "R2", kind: "resistor", at: "mat:r2", props: { ohms: 470 } },
      { id: "D2", kind: "led", at: "mat:d2", props: { color: "yellow" } },
      { id: "R3", kind: "resistor", at: "mat:r3", props: { ohms: 470 } },
      { id: "D3", kind: "led", at: "mat:d3", props: { color: "green" } },
    ],
    tray: [
      { kind: "wire", count: 8 },
      // P1, a 1 kΩ panel knob.
      { kind: "pot", props: { ohms: 1000, position: 0 }, count: 1 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "changeover",
      prompt: "Using only battery `B2`, make the yellow LED light while the relay rests and the green LED light while you hold `S1`.",
      // GOAL: kc is connected to v2; with S1 released D2 is lit and D3 dark; with S1 held D3 is lit and D2 dark.
      goal: (lab) => pullIns(lab, "K1").length > 0 && closed(lab, "K1") && lab.isLit("D3") && !lab.isLit("D2"),
      hints: [
        "COM gets `B2`'s positive terminal. Each throw feeds one LED through its own resistor.",
        "Both LEDs return to `B2`'s negative terminal.",
      ],
      success: "The relay chooses which LED gets `B2`'s power, and `B2` never touches `B1`. Two separate batteries, one magnetic link.",
    },
    {
      id: "find-pull-in",
      prompt:
        "Swap `S1` for the knob `P1`, wired as a voltage divider: ends to `B1`, middle to the coil. Put the meter across the coil. Turn the knob up slowly until the relay clicks. What did the meter read?",
      // GOAL: the learner's entry is within ±0.3 V of the instance pullIn, and a `clicked` event occurred.
      goal: (lab) => closed(lab, "K1") && lab.meter?.mode === "dcv" && between(lab.meter.value ?? undefined, 5.7, 6.3),
      hints: ["Turn in small steps. The click is sudden.", "Write down the reading the moment you hear the click."],
      success: "That's the pull-in voltage. Below it, the magnet is too weak to move the armature.",
    },
    {
      id: "find-drop-out",
      prompt: "Now turn the knob down slowly. When does the relay let go?",
      // GOAL: the learner's entry is within ±0.3 V of the instance dropOut.
      goal: (lab) =>
        eventsOf(lab, "K1", "clicked").at(-1)?.data?.["contact"] === "nc" &&
        lab.meter?.mode === "dcv" &&
        between(lab.meter.value ?? undefined, 1.5, 2.1),
      hints: ["It holds on much longer than you'd expect. Keep going."],
      success: "Pull-in about 6 V, drop-out under 2 V. Starting takes a lot more push than staying.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
