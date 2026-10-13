// Lab for lesson `stairway-light` (docs/curriculum/unit-2.md, Lesson 3).
// Pre-wired by test leads: vcc through R1 and D1 to the pole of SA, and the pole of SB to gnd. All four throws are
// free for the learner. `at` anchors are provisional until packages/bench owns BenchState.
// LAB NEEDS: an auto truth table that logs SA, SB and whether D1 is lit for every combination.
// Damage moments: a lead from vcc straight to a throw that SB grounds shorts the battery (`shorted`, battery warms,
// nothing dies; the robot explains). Bypassing R1 kills D1 (a Unit 1 callback).
// Notice: the stairway computes "same" or "different", the first logic function of the course.
import { defineLab } from "@ohmland/lab";
import { extraStr } from "./lib/goals";

export default defineLab({
  id: "stairway-light",
  title: "Either switch, any time",
  bench: {
    board: "none",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "mat:battery", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // pins { a: vcc, b: r1b }
      { id: "R1", kind: "resistor", at: "mat:r1", props: { ohms: 470 }, locked: true },
      // pins { anode: r1b, cathode: ledk }
      { id: "D1", kind: "led", at: "mat:lamp", props: { color: "red" }, locked: true },
      // Downstairs switch. pins { com: ledk, a: a1, b: a2 }
      { id: "SA", kind: "spdt", at: "mat:downstairs", props: { to: "a" }, locked: true },
      // Upstairs switch. pins { com: gnd, a: b1, b: b2 }
      { id: "SB", kind: "spdt", at: "mat:upstairs", props: { to: "a" }, locked: true },
      // Pre-wired test leads.
      { id: "W1", kind: "wire", at: "B1.pos to R1.a", locked: true },
      { id: "W2", kind: "wire", at: "D1.cathode to SA.com", locked: true },
      { id: "W3", kind: "wire", at: "SB.com to B1.neg", locked: true },
    ],
    // Four test leads for the throws.
    tray: [{ kind: "wire", count: 4 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "series-pair",
      prompt: "Clip one lead from throw `A1` to throw `B1`. Try all four switch combinations and fill in the table.",
      // GOAL: the truth table has all 4 rows, with exactly one row lit.
      goal: (lab) => lab.isLit("D1") && extraStr(lab, "SA", "to") === "a" && extraStr(lab, "SB", "to") === "a",
      hints: ["Only one path exists, and both switches must line up on it.", "Flip one switch at a time."],
      success: "Exactly one combination lights the lamp. That's two switches in series: both must agree on one path.",
    },
    {
      id: "two-travelers",
      prompt: "Add a second lead from `A2` to `B2`. Now try all four combinations again.",
      // GOAL: the table shows 2 lit rows (both switches the same way), and from any state a single flip toggles D1.
      goal: (lab) => lab.isLit("D1") && extraStr(lab, "SA", "to") === "b" && extraStr(lab, "SB", "to") === "b",
      hints: [
        "Each pair of throws gets its own wire. Those two wires are called travelers.",
        "Watch the current's path: it travels along whichever traveler both poles touch.",
      ],
      success: "Any single flip changes the lamp. That's the stairway trick.",
    },
    {
      id: "cross-the-travelers",
      prompt: "Swap the travelers so `A1` goes to `B2` and `A2` goes to `B1`. What changes?",
      // GOAL: the table shows lit rows exactly when the two switches differ.
      goal: (lab) => {
        const a = extraStr(lab, "SA", "to");
        const b = extraStr(lab, "SB", "to");
        return lab.isLit("D1") && a !== undefined && b !== undefined && a !== b;
      },
      hints: ["Predict first, then flip."],
      success: "Still a perfect stairway, but now different means on. Both versions toggle on every flip.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
