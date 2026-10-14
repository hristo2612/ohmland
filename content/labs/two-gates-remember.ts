// Blueprint: docs/curriculum/unit-4.md, CH21; a bench lesson (docs/LESSONS.md):
// content/units/chips/logic/two-gates-remember. One idea: two NOR gates fed back into each other hold whichever
// state they were last pushed into, even with the switch gone. New: the word "feedback"; "latch" gets its third
// period.
// Full board, the logic rail (5 V on the far rails). U1, a 74HC02 at e16: gate 1 answers on pin 1 from pins 2 and 3,
// gate 2 on pin 4 from pins 5 and 6. Slide switch SW1 (h9 to h11) has its pole on 5 V and throws to pin 2 (a) and
// pin 6 (b); R1 and R2 pull those pins down. W1 (pin 3) and W2 (pin 5) start on minus. U2, a 74HC08, is two locked
// lamp drivers (each gate's inputs joined): pin 1 lights D1, pin 4 lights D2, so the latch carries no lamp current.
// The fix-it bench puts W2 back on minus: only one side is fed back.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { gateChip, logicRail, seen, wire } from "./lib/chip-bench";

const rail = logicRail(4, 61);
const taken = ["top-:5", "top+:6", "top+:10", "rail-:17", "rail-:21", "rail-:18", "rail-:19", "rail-:41", "rail-:45"];
const u1 = gateChip({ id: "U1", model: "74HC02", col: 16, board: "full", spare: [], tie: [8, 9, 11, 12], taken, label: "NOR chip U1 (74HC02)" });
const u2 = gateChip({ id: "U2", model: "74HC08", col: 30, board: "full", spare: [3, 4], taken, label: "Lamp drivers U2 (74HC08)" });

const inBoard = (lab: LabView) => lab.connected("SW1.com", "VR1.out");
const crossed = (lab: LabView) => lab.connected("U1.1", "U1.5") && lab.connected("U1.4", "U1.3");
const one = (lab: LabView) => lab.isLit("D1") !== lab.isLit("D2");

/** Remembers which lamp was lit while the switch was in; true once the same lamp has stayed lit (alone) for two
 * seconds with the switch out. */
function keeps(lab: LabView): boolean {
  if (inBoard(lab)) {
    if (one(lab)) lab.memory["last"] = lab.isLit("D1") ? "D1" : "D2";
    return false;
  }
  const last = lab.memory["last"] as string | undefined;
  return !!last && lab.heldFor(2, one(lab) && lab.isLit(last), "kept");
}

/** The fix-it bench: W2 back on minus, so gate 2 does not hear gate 1. */
const ONE_SIDE: SolutionStep[] = [
  { do: "unwire", wire: "W2" },
  { do: "wire", id: "W2", from: "b20", to: "rail-:19", color: "white" },
];

export default defineLab({
  id: "two-gates-remember",
  title: "Two gates that remember",
  bench: {
    board: "full",
    frame: ["hole:j3", "hole:a47", "top+:3", "rail-:47"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      { id: "SW1", kind: "slide-switch", at: "h9", params: { to: "a" }, label: "Switch SW1" },
      { id: "R1", kind: "resistor", at: "a17-rail-:17", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R1" },
      { id: "R2", kind: "resistor", at: "a21-rail-:21", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R2" },
      ...u1.parts,
      ...u2.parts,
      { id: "R3", kind: "resistor", at: "b32-b40", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "R4", kind: "resistor", at: "c35-c44", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R4" },
      { id: "D1", kind: "led", at: "d40", params: { color: "red" }, locked: true, label: "Lamp D1 (gate 1)" },
      { id: "D2", kind: "led", at: "d44", params: { color: "green" }, locked: true, label: "Lamp D2 (gate 2)" },
    ],
    wires: [
      ...rail.wires,
      // The switch: pole to 5 V, throw a to pin 2, throw b to pin 6.
      wire("W3", "j10", "top+:10", "red"),
      wire("W4", "g9", "c17", "yellow"),
      wire("W5", "g11", "c21", "blue"),
      // The spare inputs: pin 3 and pin 5 on minus for now.
      wire("W1", "b18", "rail-:18", "white"),
      wire("W2", "b20", "rail-:19", "white"),
      // Lamp drivers: pin 1 into U2's gate 1, pin 4 into its gate 2, each pair of inputs joined.
      wire("W6", "c16", "c30", "orange"),
      wire("W7", "d30", "d31", "orange"),
      wire("W8", "c19", "c33", "green"),
      wire("W9", "d33", "d34", "green"),
      wire("W10", "a41", "rail-:41", "black"),
      wire("W11", "a45", "rail-:45", "black"),
      ...u1.wires,
      ...u2.wires,
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Each output goes to the other gate's spare input.",
    fried: "Something cooked. Memories should not smoke.",
  },
  tasks: [
    {
      id: "swap",
      prompt: "Flip the switch one way, then the other.",
      goal: (lab) => {
        const to = lab.prop("SW1")?.["to"];
        const d1 = lab.isLit("D1");
        const d2 = lab.isLit("D2");
        return seen(lab, "a", to === "a" && d2 && !d1) && seen(lab, "b", to === "b" && d1 && !d2);
      },
      hints: ["Slide SW1 across and back."],
      highlight: ["SW1"],
      success: "The lamps swap.",
    },
    {
      id: "forgets",
      prompt: "Pull the switch out of the board.",
      goal: (lab) => !inBoard(lab) && lab.heldFor(0.5, lab.isLit("D1") && lab.isLit("D2")),
      hints: ["Drag SW1 off the board onto the desk."],
      highlight: ["SW1"],
      success: "Both lamps on. It forgot.",
    },
    {
      id: "cross-wires",
      prompt: "Cross the white wires: pin 3 to pin 4, pin 5 to pin 1.",
      goal: crossed,
      hints: ["Move W1's rail end into pin 4's strip, and W2's into pin 1's.", "Pin 1 to pin 5, pin 4 to pin 3."],
      highlight: ["W1", "W2"],
      success: "Each answer feeds the other gate.",
    },
    {
      id: "remembers",
      prompt: "Put the switch back, flip it, then pull it out again.",
      goal: (lab) => crossed(lab) && keeps(lab),
      hints: ["Flip first, then lift it out.", "Watch which lamp is lit as the switch leaves."],
      highlight: ["SW1"],
      success: "It stayed. A memory.",
    },
    {
      id: "fix-it",
      prompt: "Make the memory hold either way.",
      setup: ONE_SIDE,
      goal: (lab) => seen(lab, "one", lab.heldFor(0.5, !crossed(lab), "one")) && crossed(lab) && keeps(lab),
      hints: ["Is every output fed across?", "W2 belongs in pin 1's strip. Then flip and lift to test."],
      highlight: ["W2"],
      success: "It holds either way.",
    },
    {
      id: "both-set",
      prompt: "Bonus: jumper both inputs, pin 2 and pin 6, to plus at once.",
      goal: (lab) => lab.logic("U1.2") === "H" && lab.logic("U1.6") === "H" && lab.heldFor(0.5, !lab.isLit("D1") && !lab.isLit("D2"), "dark"),
      hints: ["Two short wires from the 5 V rail: one into pin 2's strip, one into pin 6's."],
      highlight: ["U1"],
      success: "Both dark. No memory there.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "SW1", to: "b" },
    { do: "wait", seconds: 0.3 },
    { do: "flip", part: "SW1", to: "a" },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "swap" },
    { do: "move", part: "SW1", at: "desk:-34,44" },
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "forgets" },
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "b18", to: "d19", color: "white" },
    { do: "unwire", wire: "W2" },
    { do: "wire", id: "W2", from: "b20", to: "d16", color: "white" },
    { do: "check", task: "cross-wires" },
    { do: "move", part: "SW1", at: "h9" },
    { do: "flip", part: "SW1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "move", part: "SW1", at: "desk:-34,44" },
    { do: "wait", seconds: 2.4 },
    { do: "check", task: "remembers" },
    // The secret: both inputs high.
    { do: "wire", id: "W12", from: "b17", to: "top+:17", color: "red" },
    { do: "wire", id: "W13", from: "b21", to: "top+:21", color: "red" },
    { do: "wait", seconds: 0.8 },
    // The jumpers out again (and the switch back) before the check: the fix-it bench starts from here.
    { do: "unwire", wire: "W12" },
    { do: "unwire", wire: "W13" },
    { do: "move", part: "SW1", at: "h9" },
    { do: "check", task: "both-set" },
    ...ONE_SIDE,
    { do: "wait", seconds: 0.6 },
    { do: "unwire", wire: "W2" },
    { do: "wire", id: "W2", from: "b20", to: "d16", color: "white" },
    { do: "flip", part: "SW1", to: "a" },
    { do: "wait", seconds: 0.4 },
    { do: "move", part: "SW1", at: "desk:-34,44" },
    { do: "wait", seconds: 2.4 },
    { do: "check", task: "fix-it" },
  ],
});
