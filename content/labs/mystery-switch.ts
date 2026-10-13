// Lab for lesson `mystery-switch` (docs/curriculum/unit-2.md, Lesson 2).
// A DPDT slide switch in a "mystery" skin, built as two SPDT parts that share one actuator. Legs are labeled 1 to 6
// by position only. `at` anchors are provisional until packages/bench owns BenchState.
// SIM NEEDS: gang SA and SB on one actuator, or replace both with a single `dpdt` part (com1, a1, b1, com2, a2, b2).
// BENCH NEEDS: mystery mode that hides pin labels and shuffles the leg-to-node mapping with a per-learner seed.
// LAB NEEDS: an auto-log of probe pairs and results (map-pairs), a pin-map form that counts wrong submissions for the
// `pin-sleuth` achievement (name-the-legs), and a small symbol canvas (draw-it).
import { defineLab } from "@ohmland/lab";
import { beeping, extraStr } from "./lib/goals-switching";

export default defineLab({
  id: "mystery-switch",
  title: "The mystery switch",
  bench: {
    board: "none",
    parts: [
      // First pole. pins { com: x2, a: x1, b: x3 }
      { id: "SA", kind: "spdt", at: "mat:mystery", props: { to: "a" }, locked: true },
      // Second pole, same actuator. pins { com: x5, a: x4, b: x6 }
      { id: "SB", kind: "spdt", at: "mat:mystery", props: { to: "a" }, locked: true },
    ],
    tray: [],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "map-pairs",
      prompt: "Test pin pairs in both slider positions. Record each pair that beeps.",
      // GOAL: the learner's continuity log covers every pair that ever beeps, in both slider positions.
      goal: (lab) => beeping(lab) && extraStr(lab, "SA", "to") === "b",
      hints: [
        "Keep one probe on pin 1 and walk the other across pins 2 to 6. Then move on to pin 2.",
        "You only need to check each pair once per position.",
      ],
      success: "That's a complete map. Now for the detective part.",
    },
    {
      id: "name-the-legs",
      prompt: "Label each leg as pole A, pole B or a throw. Then pair each throw with its pole.",
      // GOAL: the submitted pin map matches the hidden (seeded) map. Wrong submissions are allowed and counted.
      // TODO(lab-panel): needs the pin-map form; nothing on the bench can show this yet.
      goal: () => false,
      hints: [
        "A pole beeps in both positions, each time with a different partner.",
        "There are two groups that never talk to each other. That means two poles.",
      ],
      success: "Two poles, two throws each, one actuator. A DPDT, cracked by beeps alone.",
    },
    {
      id: "draw-it",
      prompt: "Build the schematic symbol: drag two SPDT symbols onto the canvas and join their poles with a dashed line.",
      // GOAL: the symbol canvas holds two SPDT symbols linked by the "ganged" dashed line.
      // TODO(lab-panel): needs the symbol canvas.
      goal: () => false,
      hints: ["The dashed line means mechanically linked, electrically separate."],
      success: "Engineers around the world will read that drawing the same way.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors and panels.
  solution: [],
});
