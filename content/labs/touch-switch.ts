// Blueprint: docs/curriculum/unit-2.md, Lesson 14 (its touch half); docs/curriculum/conversion-guide.md, 14.
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/transistors/touch-switch. Saturation moved to
// all-the-way-on. One idea: two transistors chained multiply their gain, enough for a fingertip.
//
// Lesson 13's circuit with Q1 in place (rows 20 to 22, LED in rows 22 and 23). Where the button was, the touch pads T1
// sit in rows 14 and 16, and R5 (10 kΩ) feeds Q1's base from row 16 (row 21). The fingertip slider sets the pads'
// resistance, from a light dry touch (2 MΩ) to a firm damp one (100 kΩ). Halfway, Q2 comes into play on the far half
// (rows 17 to 19) with two jumpers already in: its emitter to Q1's base (W3), its collector to Q1's collector (W4).
// The learner moves R5's far leg to Q2's base (far row 18): a Darlington pair.
//
// Measured in the simulator: one transistor glows 0.30 at a light touch (0.7 mA) and 0.86 at a firm one (14.5 mA);
// the pair glows 0.84 (13.3 mA) at the lightest touch. If R5 is replaced by a wire, the pads alone still limit the
// base current, but a wire across the pads too puts 9 V straight on the bases.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The touch pads and the base resistor R5 in a row from the + rail to `to` (pads first or R5 first). */
function padsFeed(lab: LabView, to: string): boolean {
  if (!lab.benchPart("T1") || !lab.benchPart("R5")) return false;
  const viaPads = (mid: string) => lab.joins("T1", "B1.pos", mid) && lab.joins("R5", mid, to);
  const viaR5 = (mid: string) => lab.joins("R5", "B1.pos", mid) && lab.joins("T1", mid, to);
  return ["T1.a", "T1.b"].some(viaPads) || ["R5.a", "R5.b"].some(viaR5);
}

const finger = (lab: LabView) => lab.control("finger") ?? 2e6;
const glow = (lab: LabView) => lab.part("D1")?.glow ?? 0;
const light = (lab: LabView) => finger(lab) >= 1.9e6;
/** Q2 joined as a Darlington pair: emitter on Q1's base, collector on Q1's collector, fed by the pads through R5. */
const darlington = (lab: LabView) => lab.connected("Q2.e", "Q1.b") && lab.connected("Q2.c", "Q1.c") && padsFeed(lab, "Q2.b");

/** Q2 comes into play, its emitter and collector already jumped across to Q1. */
const Q2_IN: SolutionStep[] = [
  { do: "place", part: "Q2", kind: "npn", at: "h17" },
  { do: "wire", id: "W3", from: "f17", to: "e21", color: "yellow" },
  { do: "wire", id: "W4", from: "f19", to: "e22", color: "green" },
];

/** The fix-it bench: Q2's emitter jumper lands in row 24, an empty strip, instead of Q1's base row. */
const EMITTER_ASTRAY: SolutionStep[] = [
  { do: "unwire", wire: "W3" },
  { do: "wire", id: "W3", from: "f17", to: "e24", color: "yellow" },
];

export default defineLab({
  id: "touch-switch",
  title: "Fingertip switch",
  bench: {
    board: "full",
    // The circuit (columns 12 to 27) on the left, room for the slider panel on the right.
    frame: ["top+:11", "rail-:40"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "rail+:23-b23", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R1" },
      { id: "D1", kind: "led", at: "d23", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "Q1", kind: "npn", at: "c20", locked: true, label: "Q1 (2N3904)" },
      { id: "T1", kind: "touch-pads", at: "c14", locked: true, label: "Touch pads T1" },
      { id: "R5", kind: "resistor", at: "b16-b21", params: { ohms: 10_000 }, label: "10 kΩ resistor R5" },
    ],
    wires: [
      { id: "W1", from: "a14", to: "rail+:15", color: "red" },
      { id: "W2", from: "a20", to: "rail-:21", color: "black" },
    ],
    tray: [],
    instruments: [],
    controls: [{ id: "finger", label: "Fingertip on the pads", part: "*", key: "ohms", min: 100_000, max: 2_000_000, value: 2_000_000, scale: "log", unit: "Ω" }],
  },
  mascot: {
    start: "Your skin conducts a little. Is a little enough?",
    hint: "Slide the fingertip: right is light, left is firm.",
    fried: "That's what R5 is for. Fingers are never zero ohms, but wires are.",
  },
  fried: { npn: "2N3904, base fed with no resistor" },
  tasks: [
    {
      id: "touch-it",
      prompt: "Touch lightly, then firmly.",
      goal: (lab) => {
        const m = lab.memory as { light?: number; firm?: number };
        if (!padsFeed(lab, "Q1.b") || (lab.benchPart("Q2") && lab.connected("Q2.e", "Q1.b"))) return false;
        if (lab.heldFor(0.4, light(lab), "light")) m.light = glow(lab);
        if (lab.heldFor(0.4, finger(lab) <= 1.1e5, "firm")) m.firm = glow(lab);
        return m.light !== undefined && m.firm !== undefined && m.light < 0.5 * m.firm;
      },
      hints: ["The fingertip slider sets how firm and damp your touch is.", "Try each end of the slider. Pause a moment at each."],
      highlight: ["T1"],
      success: "Firm works. A light touch barely does.",
    },
    {
      id: "feed-q2",
      prompt: "Move R5's far leg to Q2's base.",
      setup: Q2_IN,
      goal: (lab) => lab.connected("Q2.e", "Q1.b") && lab.connected("Q2.c", "Q1.c") && padsFeed(lab, "Q2.b") && !lab.connected("R5.a", "Q1.b") && !lab.connected("R5.b", "Q1.b"),
      hints: ["Drag R5's end out of row 21.", "Drop it in far row 18: Q2's middle leg."],
      highlight: ["pin:R5.b", "pin:Q2.b"],
      nudges: [{ when: (lab) => !padsFeed(lab, "Q1.b") && !padsFeed(lab, "Q2.b") && !!lab.benchPart("R5"), say: "R5's leg goes to Q2's middle leg, far row 18." }],
      success: "Q2 now feeds Q1.",
    },
    {
      id: "darlington",
      prompt: "Touch lightly.",
      goal: (lab) => darlington(lab) && light(lab) && lab.heldFor(0.3, glow(lab) >= 0.75),
      hints: ["Slide the fingertip all the way to light."],
      success: "Feather touch, full light.",
    },
    {
      id: "fix-emitter",
      prompt: "The touch lamp never lights. Fix it.",
      setup: EMITTER_ASTRAY,
      // Q2's emitter off Q1's base first (the setup), then the pair glowing at a light touch.
      goal: (lab) => {
        if (lab.benchPart("Q2") && !lab.connected("Q2.e", "Q1.b")) lab.memory["astray"] = true;
        return lab.memory["astray"] === true && darlington(lab) && light(lab) && lab.heldFor(0.3, glow(lab) >= 0.75);
      },
      hints: ["Follow the yellow jumper from Q2's emitter.", "It must land in Q1's base row, row 21."],
      highlight: ["wire:W3.b"],
      success: "Lit again, by a feather.",
    },
  ],
  solution: [
    { do: "control", id: "finger", value: 2_000_000 },
    { do: "wait", seconds: 0.6 },
    { do: "control", id: "finger", value: 100_000 },
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "touch-it" },
    ...Q2_IN,
    { do: "move", part: "R5", at: "d16-g18" },
    { do: "check", task: "feed-q2" },
    { do: "control", id: "finger", value: 2_000_000 },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "darlington" },
    ...EMITTER_ASTRAY,
    { do: "wait", seconds: 0.5 },
    { do: "unwire", wire: "W3" },
    { do: "wire", id: "W3", from: "f17", to: "e21", color: "yellow" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "fix-emitter" },
  ],
});
