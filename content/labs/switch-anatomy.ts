// Lab for lesson `switch-anatomy` (docs/curriculum/unit-2.md, Lesson 1).
// Board none: the parts sit on the mat. Netlist pins and nodes from the blueprint are noted beside each part; `at`
// anchors are provisional until packages/bench owns BenchState.
// BENCH NEEDS: a "peek inside" toggle that makes switch bodies translucent and shows the moving contact strip.
// LAB NEEDS: a continuity table panel (find-the-pole) and a labeling panel (press-and-hold).
// Damage moments: none in this lab.
import { defineLab } from "@ohmland/lab";
import { beeping, closed, extraStr } from "./lib/goals-switching";

export default defineLab({
  id: "switch-anatomy",
  title: "What's inside a switch",
  bench: {
    board: "none",
    // The bench meter (M1, pins { com: p1, vohm: p2, ma: m_ma, a10: m_a10 }) starts in continuity mode with its probe
    // tips parked. BenchConfig cannot set an instrument's starting mode yet.
    parts: [
      // SPST toggle. pins { a: s1a, b: s1b }
      { id: "S1", kind: "switch", at: "mat:1", props: { closed: false }, locked: true },
      // SPDT slide switch. pins { com: s2c, a: s2a, b: s2b }
      { id: "S2", kind: "spdt", at: "mat:2", props: { to: "a" }, locked: true },
      // Normally open pushbutton. pins { a: s3a, b: s3b }
      { id: "S3", kind: "pushbutton", at: "mat:3", locked: true },
      // Normally closed pushbutton. pins { a: s4a, b: s4b }. SIM NEEDS: pushbutton `normallyClosed` (default false).
      { id: "S4", kind: "pushbutton", at: "mat:4", props: { normallyClosed: true }, locked: true },
    ],
    // Two spare test leads.
    tray: [{ kind: "wire", count: 2 }],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "beep-test",
      prompt: "Set the meter to continuity and touch the two probe tips together. Then probe the toggle switch `S1` in both positions.",
      // GOAL: M1 showed the continuity beep at least once with the probes joined, and S1 was probed in both states
      // (one reading OL, one beep).
      goal: (lab) => beeping(lab) && closed(lab, "S1"),
      hints: ["The continuity mode has a little sound-wave symbol on the dial.", "Flip `S1` by clicking its lever, then probe again."],
      success: "Beep means there's a path with almost no resistance. OL means no path at all. A switch is just a gap you can close.",
    },
    {
      id: "find-the-pole",
      prompt: "The slide switch `S2` has three legs. Probe every pair in both slider positions and fill in the table.",
      // GOAL: the continuity table (3 pairs x 2 positions) is complete and correct: the middle leg beeps with one
      // outer leg in each position, and the outer pair never beeps.
      goal: (lab) => beeping(lab) && extraStr(lab, "S2", "to") === "b",
      hints: ["There are only three pairs: left-middle, middle-right and left-right.", "Which leg is part of every beep? That one is special."],
      success: "The middle leg is the pole. It always connects to one throw or the other, never both and never neither. SPDT means one pole, two throws.",
    },
    {
      id: "press-and-hold",
      prompt: "Two pushbuttons look identical. Probe each one, first released, then while you hold it down.",
      // GOAL: S3 and S4 each probed released and held, and the learner tagged S3 "normally open" and S4 "normally
      // closed" in the labeling panel.
      goal: (lab) => beeping(lab) && closed(lab, "S3"),
      hints: [
        "Hold a button by pressing and keeping the pointer down, or with Space on the keyboard.",
        "Normally means when nobody touches it.",
      ],
      success:
        "`S3` connects only while pressed. `S4` is connected until you press it. Both spring back when you let go, while the toggle stays put.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors and probe actions.
  solution: [],
});
