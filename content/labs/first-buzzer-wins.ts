// Blueprint: docs/curriculum/unit-4.md, CH23 (wave 2); a bench lesson (docs/LESSONS.md):
// content/units/chips/arcade/first-buzzer-wins. One idea: feed the winner's output back to every player's input
// through OR gates, and the first press locks the others out. Nothing new to name; the CMOS 555 gets a note.
// Full board, the logic rail (5 V on the far rails). Buzzers S1 (yours, key A) and S2 (mine, key L) pull their nodes
// P1 and P2 down from 10 kΩ pull-ups. U3, a 74HC32 at e20: gate 1 takes P1 and the block line (pins 1, 2; answer on 3
// to U1's trigger), gate 2 takes P2 and the block line (pins 4, 5; answer on 6 to U2's trigger), gate 3 takes both
// latches' outputs (pins 9, 10) and answers on pin 8: the block. Pins 2 and 5 are joined by L1, and W1 holds them on
// minus until the learner moves it to pin 8. U1 (e30) and U2 (e42) are CMOS 555s used as latches (threshold on
// minus), each lighting its own lamp; their resets share a RESET line pulled up by R9, with S9 to minus and 1 µF for a
// clean power-up. There is no robot player yet (it would need a scripted actor), so the learner presses both
// buzzers, or plays with a friend on one keyboard. The timing diagram replays a win in slow motion.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { gateChip, logicRail, seen, wire } from "./lib/chip-bench";

const rail = logicRail(4, 61);
const taken = ["top-:5", "top+:6", "top+:12", "top+:16", "top+:30", "top-:32", "top+:42", "top-:45", "top+:34"];
const u3 = gateChip({ id: "U3", model: "74HC32", col: 20, board: "full", spare: [4], taken, label: "OR chip U3 (74HC32)" });

const lit = (lab: LabView, a: boolean, b: boolean) => lab.isLit("D1") === a && lab.isLit("D2") === b;
const blocked = (lab: LabView) => lab.connected("U3.2", "U3.8") && lab.connected("U3.5", "U3.8");
/** After both lamps were dark (a reset), `first` was pressed, then `second` while the first lamp was lit, and only
 * the first lamp stayed lit for a second. */
function won(lab: LabView, first: "S1" | "S2", key: string): boolean {
  const mine = first === "S1" ? "D1" : "D2";
  const second = first === "S1" ? "S2" : "S1";
  if (!seen(lab, `${key}-reset`, lit(lab, false, false))) return false;
  if (!seen(lab, `${key}-late`, lab.closed(second) && lab.isLit(mine))) return false;
  return lab.heldFor(1, first === "S1" ? lit(lab, true, false) : lit(lab, false, true), key);
}

/** The fix-it bench: the block reaches pin 2 only; pin 5 sits on minus. */
const HALF_BLOCK: SolutionStep[] = [
  { do: "unwire", wire: "L1" },
  { do: "wire", id: "L1", from: "c24", to: "rail-:24", color: "black" },
  { do: "press", part: "S9", seconds: 0.3 },
];

export default defineLab({
  id: "first-buzzer-wins",
  title: "First buzzer wins",
  bench: {
    board: "full",
    frame: ["hole:j8", "hole:a50", "top+:8", "rail-:50"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      // Buzzers: each pulls its node down from a pull-up.
      { id: "S1", kind: "pushbutton", at: "e10", params: { cap: "yellow" }, locked: true, label: "Your buzzer S1" },
      { id: "R1", kind: "resistor", at: "i12-top+:12", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R1" },
      { id: "S2", kind: "pushbutton", at: "e14", params: { cap: "blue" }, locked: true, label: "My buzzer S2" },
      { id: "R2", kind: "resistor", at: "i16-top+:16", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R2" },
      ...u3.parts,
      // The latches.
      { id: "U1", kind: "chip", at: "e30", params: { model: "555-cmos" }, locked: true, label: "Your latch U1 (CMOS 555)" },
      { id: "R3", kind: "resistor", at: "b32-b36", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", at: "c36", params: { color: "yellow" }, locked: true, label: "Your lamp D1" },
      { id: "U2", kind: "chip", at: "e42", params: { model: "555-cmos" }, locked: true, label: "My latch U2 (CMOS 555)" },
      { id: "R4", kind: "resistor", at: "b44-b48", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R4" },
      { id: "D2", kind: "led", at: "c48", params: { color: "blue" }, locked: true, label: "My lamp D2" },
      // The RESET line: pulled up, S9 to minus, 1 µF for a clean start.
      { id: "R9", kind: "resistor", at: "c33-top+:34", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R9" },
      { id: "S9", kind: "pushbutton", at: "e38", params: { cap: "red" }, locked: true, label: "RESET button S9" },
      { id: "C7", kind: "electrolytic-cap", at: "b45-rail-:46", params: { farads: 1e-6, volts: 16 }, locked: true, label: "1 µF capacitor C7" },
    ],
    wires: [
      ...rail.wires,
      wire("W2", "a10", "rail-:10", "black"),
      wire("W3", "a14", "rail-:15", "black"),
      // P1 into gate 1, P2 into gate 2; the block line (pins 2 and 5) on minus for now.
      wire("W4", "c12", "b20", "yellow"),
      wire("W5", "c16", "b23", "blue"),
      wire("L1", "c21", "c24", "white"),
      wire("W1", "b21", "rail-:21", "white"),
      // Gate answers into the triggers; the latches' outputs into gate 3.
      wire("W6", "d22", "d31", "yellow"),
      wire("W7", "d25", "d43", "blue"),
      wire("W8", "d32", "g25", "yellow"),
      wire("W9", "c44", "g24", "blue"),
      // The latches: supply, threshold on minus.
      wire("W10", "j30", "top+:30", "red"),
      wire("W11", "a30", "rail-:30", "black"),
      wire("W12", "j32", "top-:32", "black"),
      wire("W13", "j42", "top+:42", "red"),
      wire("W14", "a42", "rail-:42", "black"),
      wire("W15", "j44", "top-:45", "black"),
      // Lamps to minus; the RESET line between the two resets, and S9.
      wire("W16", "a37", "rail-:37", "black"),
      wire("W17", "a49", "rail-:49", "black"),
      wire("W18", "d33", "d45", "red"),
      wire("W19", "a38", "rail-:39", "black"),
      wire("W20", "c40", "b33", "red"),
      ...u3.wires,
    ],
    tray: [],
    instruments: [],
    watch: ["U3.8", "U1.3", "U2.3"],
  },
  panels: [
    {
      kind: "keys",
      id: "keys",
      buttons: [
        { part: "S1", key: "a", label: "You" },
        { part: "S2", key: "l", label: "Me" },
        { part: "S9", key: "r", label: "Reset" },
      ],
    },
    {
      kind: "timing",
      id: "td",
      show: ["slow-motion"],
      title: "A win",
      channels: [
        { label: "You", node: "S1.b1", level: 2.5 },
        { label: "Me", node: "S2.b1", level: 2.5 },
        { label: "Your lamp", node: "U1.3" },
        { label: "My lamp", node: "U2.3" },
        { label: "Block", node: "U3.8" },
      ],
    },
  ],
  mascot: {
    hint: "The block must reach every player's OR.",
    fried: "Something cooked. Quiz night is over.",
  },
  tasks: [
    {
      id: "both-win",
      prompt: "Press your buzzer (A), then mine (L).",
      goal: (lab) => lit(lab, true, true),
      hints: ["Use the keys card, or A then L on a keyboard."],
      highlight: ["S1", "S2"],
      success: "Both lamps. Everyone won.",
    },
    {
      id: "block-line",
      prompt: "Press RESET, then move the white wire's end from minus to pin 8.",
      goal: blocked,
      hints: ["Pin 8 is gate 3's answer: the block.", "The white wire sits in the near minus rail. Drag that end to pin 8's strip."],
      highlight: ["W1"],
      success: "The winner now feeds every OR.",
    },
    {
      id: "you-win",
      prompt: "RESET, then race: your buzzer first, then mine.",
      goal: (lab) => blocked(lab) && won(lab, "S1", "you"),
      hints: ["Reset first: both lamps dark.", "A, then L."],
      highlight: ["S1", "S2", "S9"],
      success: "Your lamp only. Mine is locked out.",
    },
    {
      id: "robot-wins",
      prompt: "RESET, and this time press mine first.",
      goal: (lab) => blocked(lab) && won(lab, "S2", "me"),
      hints: ["Reset, then L before A."],
      highlight: ["S1", "S2", "S9"],
      success: "My lamp only.",
    },
    {
      id: "fix-it",
      prompt: "Make sure my buzzer is locked out once you win.",
      setup: HALF_BLOCK,
      goal: (lab) => seen(lab, "half", lab.heldFor(0.5, !lab.connected("U3.5", "U3.8"), "half")) && blocked(lab) && won(lab, "S1", "fix"),
      hints: ["Does my OR see the block?", "Pin 5 belongs on the block line, joined to pin 2. Then reset and race."],
      highlight: ["L1"],
      success: "Every player needs the block.",
    },
    {
      id: "slow-motion",
      prompt: "Bonus: win a round, then replay it in slow motion.",
      // A burst in which a lamp output rises and then the block rises.
      goal: (lab) => {
        const tv = lab.timing("td");
        const b = tv.burst;
        if (!b || tv.replayed !== b.start) return false;
        const up = (label: string) => b.channels[label]?.edges.find((e) => e[1] === 1)?.[0];
        const win = up("Your lamp") ?? up("My lamp");
        const block = up("Block");
        return win !== undefined && block !== undefined && block >= win;
      },
      hints: ["Reset, press one buzzer, then press the replay button."],
      highlight: ["U3"],
      success: "The block comes a tenth of a microsecond after the win.",
      bonus: true,
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "press", part: "S2", seconds: 0.3 },
    { do: "check", task: "both-win" },
    { do: "press", part: "S9", seconds: 0.3 },
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "b21", to: "h26", color: "white" },
    { do: "check", task: "block-line" },
    { do: "press", part: "S9", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "press", part: "S2", seconds: 0.3 },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "you-win" },
    { do: "press", part: "S9", seconds: 0.3 },
    { do: "press", part: "S2", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "robot-wins" },
    // The secret: a win, replayed.
    { do: "press", part: "S9", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "wait", seconds: 0.3 },
    { do: "panel", id: "td", value: "replay" },
    { do: "check", task: "slow-motion" },
    ...HALF_BLOCK,
    { do: "wait", seconds: 0.6 },
    { do: "unwire", wire: "L1" },
    { do: "wire", id: "L1", from: "c21", to: "c24", color: "white" },
    { do: "press", part: "S9", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.3 },
    { do: "press", part: "S2", seconds: 0.3 },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "fix-it" },
  ],
});
