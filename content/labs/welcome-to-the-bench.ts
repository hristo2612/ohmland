// Blueprint: docs/curriculum/unit-1.md, L1. Conventions and interim helpers: ./lib/goals.ts.
// Mascot (needs a lab field): hint "Look for a gap. Light only flows around a full loop."
//   success "A glow! That's the first light on this island in ages."
import { defineLab } from "@ohmland/lab";

export default defineLab({
  id: "welcome-to-the-bench",
  title: "Welcome to the bench",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", props: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
      // A large slide switch on a small wooden base.
      { id: "S1", kind: "switch", props: { closed: false } },
      { id: "R1", kind: "resistor", props: { ohms: 1500, watts: 0.25 } },
      { id: "D1", kind: "led", props: { color: "red", maxmA: 50 } },
      // Four clip leads, already attached.
      { id: "L1", kind: "wire", at: "B1.pos|S1.a" },
      { id: "L2", kind: "wire", at: "S1.b|R1.a" },
      { id: "L3", kind: "wire", at: "R1.b|D1.anode" },
      { id: "L4", kind: "wire", at: "D1.cathode|B1.neg" },
    ],
    // One spare clip lead.
    tray: [{ kind: "wire", count: 1 }],
    instruments: [],
  },
  tasks: [
    {
      id: "close-the-switch",
      prompt: "Flip the switch and watch the LED.",
      // GOAL: part(S1).closed && isLit(D1)
      goal: (lab) => lab.part("S1")?.closed === true && lab.isLit("D1", 0.1),
      hints: ["The switch is the slider on the wooden block. Click or tap it."],
      // NOTICE: the light comes on instantly, with no delay.
      success: "It glows. Current is flowing all the way around the loop.",
    },
    {
      id: "break-the-loop",
      prompt: "Keep the switch on. Now unclip any one lead, anywhere in the loop.",
      // GOAL: part(S1).closed && bench.detachedLeadEnds >= 1 && part(D1).i < 1e-6
      goal: (lab) => lab.part("S1")?.closed === true && Math.abs(lab.part("D1")?.i ?? 1) < 1e-6,
      hints: ["Drag one end of any clip lead off its part.", "Pick a lead far from the LED, then watch the LED."],
      // NOTICE: the gap does not have to be next to the LED. Compare with your prediction.
      success: "Dark. One gap anywhere stops the flow everywhere.",
    },
    {
      id: "mend-the-loop",
      prompt: "Clip the lead back on so the LED lights again.",
      // GOAL: task break-the-loop done, then isLit(D1)
      goal: (lab) => lab.isLit("D1", 0.1),
      hints: ["Every part needs a lead on both of its ends."],
      success: "Loop complete, light back on. You just repaired your first circuit.",
    },
    {
      id: "swap-battery-leads",
      prompt: "Curious? Swap the two leads on the battery's terminals.",
      // GOAL: part(S1).closed && part(D1).v < -1 && part(D1).glow == 0
      goal: (lab) => lab.part("S1")?.closed === true && (lab.part("D1")?.v ?? 0) < -1 && (lab.part("D1")?.glow ?? 1) === 0,
      hints: ["Unclip both battery leads and clip each onto the other terminal."],
      success: "Nothing lights, and nothing breaks. The LED only lets current through one way. More on that in module 3.",
      optional: true,
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench owns BenchState.
  solution: [],
});
