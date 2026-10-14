// Blueprint: docs/curriculum/unit-2.md, Lesson 12 (its first half); conversion: docs/curriculum/conversion-guide.md,
// C2 lesson 12. The lab of a bench lesson (docs/LESSONS.md):
// content/units/switching/capacitors/smoothing-and-coupling/lesson.yaml. One idea: a capacitor across a choppy supply
// smooths it. (Coupling and blocking are the next lesson, kick-it-through.)
//
// Button S1 (rows 5 and 7), worked by the auto-tapper four times a second, feeds R1 (100 Ω) into row 11, then R2
// (1 kΩ) and the red LED D1. A black jumper grounds row 13, so an electrolytic dropped in with its long leg in row 11
// and its stripe in row 13 sits across the supply. Both capacitors lie on the desk by the board. The fix-it puts the
// 470 µF one hole short: its stripe in row 12, which goes nowhere.
//
// Measured in the simulator: tapping makes D1 swing between about 0.06 and 0.70; with 470 µF across the supply it
// holds between 0.66 and 0.69; with 47 µF it swings from 0.34 to 0.70 again; with the stripe in row 12 it flickers as
// if the capacitor were not there.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** An electrolytic of this value (any, if not given) sits across station A's supply: + on row 11, stripe on minus. */
const smoothing = (lab: LabView, farads?: number) =>
  lab.bench.parts.some((p) => p.kind === "electrolytic-cap" && (farads === undefined || Math.abs(p.params.farads - farads) < farads * 0.01) && lab.joins(p.id, "R1.b", "B1.neg", "forward"));
const ripple = (lab: LabView, seconds = 2) => lab.stats("glow:D1", seconds);

/** The fix-it bench: the 470 µF one hole short, its stripe in row 12, which reaches nothing. */
const ONE_HOLE_SHORT: SolutionStep[] = [{ do: "move", part: "C1", at: "d11-d12" }];

export default defineLab({
  id: "smoothing-and-coupling",
  title: "Smooth it",
  bench: {
    board: "full",
    frame: ["desk:-100,-30", "desk:-28,48"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "e5", params: { cap: "yellow" }, locked: true, label: "Tapped button S1" },
      { id: "R1", kind: "resistor", at: "c7-c11", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R1" },
      { id: "R2", kind: "resistor", at: "b11-b16", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R2" },
      { id: "D1", kind: "led", at: "d16", params: { color: "red" }, locked: true, label: "Red LED D1" },
      // On the desk by the board.
      { id: "C1", kind: "electrolytic-cap", at: "desk:-80,40", params: { farads: 470e-6, volts: 16 }, label: "470 µF capacitor C1" },
      { id: "C3", kind: "electrolytic-cap", at: "desk:-56,40", params: { farads: 47e-6, volts: 16 }, label: "47 µF capacitor C3" },
    ],
    wires: [
      { id: "W1", from: "a5", to: "rail+:5", color: "red" },
      { id: "W2", from: "a17", to: "rail-:17", color: "black" },
      // Row 13 to minus: where a capacitor's stripe lands.
      { id: "W3", from: "a13", to: "rail-:13", color: "black" },
    ],
    tray: [],
    instruments: [{ kind: "tapper", part: "S1", hz: 4 }],
  },
  mascot: {
    hint: "Across the supply: long leg in row 11, stripe to minus.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "flicker",
      prompt: "Start the auto-tapper. Watch D1.",
      goal: (lab) => lab.tapping("S1") && !smoothing(lab) && (ripple(lab, 1)?.span ?? 0) > 0.6,
      hints: ["Press Start tapping, in the panel under the bench."],
      success: "On, off, on, off.",
    },
    {
      id: "smooth-it",
      prompt: "Push the 470 µF in: long leg in row 11, stripe in row 13.",
      goal: (lab) => {
        const s = ripple(lab);
        return lab.tapping("S1") && smoothing(lab, 470e-6) && !!s && s.span < 0.25 && s.mean > 0.2;
      },
      hints: ["It goes across the supply: row 11 to the minus row.", "Long leg in row 11, stripe in row 13. Keep tapping."],
      highlight: ["C1", "hole:d11", "hole:d13"],
      nudges: [{ when: (lab) => !lab.tapping("S1"), say: "Keep the tapper on, so we can see." }],
      success: "Steady.",
    },
    {
      id: "fix-one-hole",
      prompt: "Still flickering. Fix it.",
      setup: ONE_HOLE_SHORT,
      // Short of minus first (the setup), then across the supply and steady.
      goal: (lab) => {
        if (!smoothing(lab)) lab.memory["short"] = true;
        const s = ripple(lab);
        return lab.memory["short"] === true && lab.tapping("S1") && smoothing(lab, 470e-6) && !!s && s.span < 0.25 && s.mean > 0.2;
      },
      hints: ["Follow the stripe. Is its row joined to minus?", "Move the striped leg to row 13."],
      highlight: ["pin:C1.neg", "hole:d13"],
      success: "Fixed.",
    },
    {
      id: "too-small",
      prompt: "Try the 47 µF instead of the 470 µF.",
      goal: (lab) => lab.tapping("S1") && smoothing(lab, 47e-6) && !smoothing(lab, 470e-6) && (ripple(lab)?.span ?? 0) > 0.25,
      hints: ["Swap the big capacitor for the small one, same way round."],
      highlight: ["C3"],
      success: "Flicker again.",
      bonus: true,
    },
  ],
  solution: [
    { do: "tapper", on: true },
    { do: "wait", seconds: 2 },
    { do: "check", task: "flicker" },
    // "Show me" starts the circuit afresh with the tapper off: each task's steps switch it on again.
    { do: "tapper", on: true },
    { do: "move", part: "C1", at: "d11-d13" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "smooth-it" },
    ...ONE_HOLE_SHORT,
    { do: "tapper", on: true },
    { do: "wait", seconds: 1 },
    { do: "move", part: "C1", at: "d11-d13" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "fix-one-hole" },
    // The secret.
    { do: "move", part: "C1", at: "desk:-80,40" },
    { do: "move", part: "C3", at: "d11-d13" },
    { do: "wait", seconds: 3 },
    { do: "check", task: "too-small" },
  ],
});
