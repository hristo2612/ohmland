// Blueprint: docs/curriculum/unit-1.md, L1. A reference lab for the lab API (docs/LABS.md).
import { defineLab } from "@ohmland/lab";

export default defineLab({
  id: "welcome-to-the-bench",
  title: "Welcome to the bench",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-72,2", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // A big toggle switch on a small wooden block, wired between com and b, so "on" is thrown to b.
      { id: "S1", kind: "toggle-switch", at: "desk:-6,-42", params: { base: true, to: "a" }, locked: true, label: "Switch" },
      { id: "R1", kind: "resistor", at: "desk:62,-4", rot: -90, params: { ohms: 1500, watts: 0.25 }, locked: true, label: "1.5 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:16,44", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.com", color: "red" },
      { id: "TL2", from: "S1.b", to: "R1.a", color: "yellow" },
      { id: "TL3", from: "R1.b", to: "D1.anode", color: "green" },
      { id: "TL4", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    // One spare clip lead.
    tray: [{ kind: "lead", params: { color: "blue" }, count: 1 }],
    instruments: [],
  },
  mascot: {
    start: "Welcome! My face runs on fumes. Let's get this bench working.",
    hint: "Look for a gap. Light only flows around a full loop.",
    success: "A glow! That's the first light on this island in ages.",
    exit: "One loop, one light. The island already looks brighter.",
  },
  tasks: [
    {
      id: "close-the-switch",
      prompt: "Flip the switch and watch the LED.",
      goal: (lab) => lab.closed("S1") && lab.isLit("D1"),
      hints: ["The switch is the lever on the wooden block. Click or tap it."],
      highlight: ["S1"],
      success: "It glows. Current is flowing all the way around the loop.",
      notice: "The light comes on the instant the switch closes, with no delay.",
    },
    {
      id: "break-the-loop",
      prompt: "Keep the switch on. Now unclip any one lead, anywhere in the loop.",
      goal: (lab) => lab.closed("S1") && lab.bench.detachedLeadEnds >= 1 && lab.loopOpen("D1"),
      hints: ["Drag one end of any clip lead off its part and drop it on the desk.", "Pick a lead far from the LED, then watch the LED."],
      highlight: ["TL1"],
      success: "Dark. One gap anywhere stops the flow everywhere.",
      notice: "The gap does not have to be next to the LED. Compare that with your guess.",
    },
    {
      id: "mend-the-loop",
      prompt: "Clip the lead back on so the LED lights again.",
      goal: (lab) => lab.isLit("D1"),
      hints: ["Every part needs a lead on both of its ends.", "Drag the loose clip back onto the metal it came from."],
      success: "Loop complete, light back on. You just repaired your first circuit.",
    },
    {
      id: "swap-battery-leads",
      prompt: "Curious? Swap the two leads on the battery's terminals.",
      goal: (lab) => lab.closed("S1") && (lab.part("D1")?.v ?? 0) < -1 && (lab.part("D1")?.glow ?? 1) < 0.01,
      hints: ["Unclip both battery leads and clip each onto the other terminal."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "Nothing lights, and nothing breaks. The LED only lets current through one way. More on that in module 3.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "b" },
    { do: "check", task: "close-the-switch" },
    { do: "clip", lead: "TL2", end: "a", to: null },
    { do: "check", task: "break-the-loop" },
    { do: "clip", lead: "TL2", end: "a", to: "S1.b" },
    { do: "check", task: "mend-the-loop" },
    { do: "clip", lead: "TL1", end: "a", to: "B1.neg" },
    { do: "clip", lead: "TL4", end: "b", to: "B1.pos" },
    { do: "check", task: "swap-battery-leads" },
  ],
});
