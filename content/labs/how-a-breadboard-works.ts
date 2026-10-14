// Start here, case 10: "The secret wiring" (docs/curriculum/start-here.md, SH10). A bench lesson (docs/LESSONS.md): its
// tasks are the beats of content/units/start-here/tool-cases/how-a-breadboard-works/lesson.yaml, in the same order.
// The blueprint calls it holes-that-hold-hands; it keeps its first id so finished lessons and island pieces stay.
// One idea: hidden metal strips join the holes: strips of five, long rails, and a gap down the middle.
// Half-size board: 30 numbered strips a to e and f to j, rails in groups of five (columns 1-5, 7-11, 13-17 ...).
// The lamp is in from the start, standing wrong: both of the LED's legs in strip 10, so the strip skips it.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The ends of the black jumper W1. */
const w1Ends = (lab: LabView): string[] => {
  const w = lab.bench.wires.find((x) => x.id === "W1");
  return w ? [w.a, w.b] : [];
};
/** The minus-rail end of the black jumper, as a column number. */
function minusEnd(lab: LabView): number | null {
  const end = w1Ends(lab).find((h) => /^bn\d+$/.test(h));
  return end ? Number(end.slice(2)) : null;
}
const onPlusRail = (lab: LabView) => w1Ends(lab).some((h) => /^bp\d+$/.test(h));
/** The LED lit, each of its legs in its own strip. */
const mended = (lab: LabView) => lab.isLit("D1") && !lab.connected("D1.anode", "D1.cathode");

/** The fix-it bench: the black jumper's rail end moved to the plus rail, so the LED's short leg sits at plus too. */
const WIRE_ON_PLUS: SolutionStep[] = [
  { do: "unwire", wire: "W1" },
  { do: "wire", id: "W1", from: "a11", to: "rail+:11", color: "black" },
];

export default defineLab({
  id: "how-a-breadboard-works",
  title: "The secret wiring",
  bench: {
    board: "half",
    // The board fills the view; the battery's snap leads come in from the left.
    frame: ["desk:-46,-30", "desk:46,30"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:10-b10", params: { ohms: 1000 }, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "d10", rot: 270, params: { color: "red", maxmA: 50 }, label: "Red LED" },
    ],
    wires: [{ id: "W1", from: "a11", to: "rail-:11", color: "black" }],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Same number, same side: joined.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "xray-on",
      prompt: "Switch on X-ray.",
      goal: (lab) => lab.view("xray"),
      hints: ["X-ray is a button in the bench's toolbar.", "Tap X-ray once."],
      success: "Metal strips!",
    },
    {
      id: "fix-led",
      prompt: "Give each of the LED's legs its own strip.",
      goal: mended,
      hints: ["Tap the LED, then turn it with Rotate.", "Long leg in strip 10, with the resistor. Short leg in strip 11."],
      highlight: ["D1", "hole:c11"],
      nudges: [{ when: (lab) => (lab.part("D1")?.v ?? 0) < -1, say: "Close. Long leg toward the resistor." }],
      success: "It glows.",
    },
    {
      id: "rail-slide",
      prompt: "Slide the black wire's rail end far along the blue rail.",
      goal: (lab) => {
        const col = minusEnd(lab);
        return lab.isLit("D1") && col !== null && Math.abs(col - 11) >= 6;
      },
      hints: ["Drag the end of the black wire that sits in the rail.", "Drop it in the outer rail, by the blue stripe, far to the right."],
      highlight: ["wire:W1.b"],
      nudges: [{ when: onPlusRail, say: "That's the plus rail. Try the blue one." }],
      success: "Still glowing.",
    },
    {
      id: "fix-it",
      prompt: "The second lamp is dark. Fix it.",
      setup: WIRE_ON_PLUS,
      // Broken first (the setup), then lit with the black wire back on the minus rail.
      goal: (lab) => {
        if (!lab.isLit("D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && mended(lab) && minusEnd(lab) !== null;
      },
      hints: ["Which stripe is minus?", "Move the black wire's rail end to the rail by the blue stripe."],
      highlight: ["wire:W1.b"],
      success: "Fixed.",
    },
    {
      id: "short-the-rails",
      prompt: "Join plus and minus with a wire.",
      goal: (lab) => lab.event("shorted", "B1"),
      hints: ["Put a wire from the red rail straight to the blue rail."],
      success: "Whoa. A short. The battery gets hot.",
      bonus: true,
    },
  ],
  solution: [
    { do: "view", name: "xray", on: true },
    { do: "check", task: "xray-on" },
    { do: "rotate", part: "D1" },
    { do: "check", task: "fix-led" },
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "a11", to: "rail-:26", color: "black" },
    { do: "check", task: "rail-slide" },
    ...WIRE_ON_PLUS,
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "a11", to: "rail-:11", color: "black" },
    { do: "check", task: "fix-it" },
    // The secret, last: a wire from plus straight to minus.
    { do: "wire", id: "W2", from: "rail+:20", to: "rail-:21", color: "red" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "short-the-rails" },
  ],
});
