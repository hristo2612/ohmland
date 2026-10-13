// Lab for lesson `meet-the-relay` (docs/curriculum/unit-2.md, Lesson 4).
// The relay wears a mystery skin: five legs labeled 1 to 5, leg-to-node order shuffled per learner. `at` anchors are
// provisional until packages/bench owns BenchState.
// BENCH NEEDS: mystery mode with a seeded pin shuffle; relay x-ray and exploded views; a click sound on `clicked`
// (softer on release).
// LAB NEEDS: a pin-tagging panel (coil A/B, COM, NO, NC) that counts wrong submissions for `pin-sleuth`.
// Damage moment: clipping the battery across COM and NC (closed at rest) shorts it: `shorted`, battery warms, and the
// robot explains that those two legs are joined inside, so that was a wire across the battery.
// Notice: the coil and the contacts never beep with each other. That separation is why relays are so useful.
import { defineLab } from "@ohmland/lab";
import { beeping, closed, pullIns } from "./lib/goals";

export default defineLab({
  id: "meet-the-relay",
  title: "A switch flipped by a magnet",
  bench: {
    board: "none",
    parts: [
      // pins { coilA: k1a, coilB: k1b, com: kc, no: kno, nc: knc }
      { id: "K1", kind: "relay", at: "mat:relay", props: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true },
      // pins { pos: vcc, neg: gnd }. Its negative lead starts parked.
      { id: "B1", kind: "battery", at: "mat:battery", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // pins { a: vcc, b: sw }. The lead from `sw` starts parked.
      { id: "S1", kind: "pushbutton", at: "mat:button", locked: true },
    ],
    // Two test leads.
    tray: [{ kind: "wire", count: 2 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "find-the-coil",
      prompt: "Set the meter to the 2 kΩ range and measure between pairs of legs. One pair reads a few hundred ohms. Tag it as the coil.",
      // GOAL: the coil legs are tagged correctly.
      goal: (lab) => lab.meter?.mode === "ohm" && (lab.meterReads(0.54, { tol: 0.05 }) || lab.meterReads(540, { tol: 0.05 })),
      hints: [
        "Contacts read either almost 0 Ω or OL. The coil is a long, thin wire, so it reads somewhere in between.",
        "Five legs make only ten pairs. Sweep them all.",
      ],
      success: "About 540 Ω. That's a long coil of very thin copper. Notice it reads the same either way round.",
    },
    {
      id: "find-com-nc",
      prompt: "Switch to continuity. With the relay resting, which pair beeps?",
      // GOAL: the learner tags the beeping pair as "COM + NC (order unknown)".
      goal: (lab) => beeping(lab) && !closed(lab, "K1"),
      hints: ["Leave the coil legs out of it."],
      success:
        "One pair is already connected at rest. That's the normally closed contact and the common. Which one is which? We need the magnet.",
    },
    {
      id: "energize",
      prompt: "Clip the leads so `S1` connects the battery to the coil. Hold the button and probe again.",
      // GOAL: a K1 `clicked` event was seen, and the final pin map (coil A and B, COM, NO, NC) was submitted correctly.
      goal: (lab) => pullIns(lab, "K1").length > 0,
      hints: [
        "Listen for the click.",
        "COM is the leg that beeps with one partner at rest and a different partner while you hold the button.",
      ],
      success:
        "A double-throw switch inside a box, flipped by electricity. Nothing on the coil side ever touches the contact side.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors and panels.
  solution: [],
});
