// Blueprint: docs/curriculum/unit-4.md, CH20; a bench lesson (docs/LESSONS.md): content/units/chips/logic/chord-lock.
// One idea: to check a key is not pressed, flip its pull: a key to minus with a pull-up reads high when untouched, so
// "none of these" becomes one more AND. Nothing new to name.
// Full board, the logic rail (5 V on the far rails). Four keys are pushbuttons straddling the channel: one side of
// each goes to 5 V through its red jumper (WA to WD), the other is its input strip, pulled down by R1 to R4 (far half,
// to the minus rail). U1, a 74HC08: gate 1 takes A and B (pins 1, 2; answer on 3), gate 2 takes C and D (pins 4, 5;
// answer on 6), gate 3 takes pin 3 on pin 9 and, through W1, 5 V on pin 10, so at first only A and B count. Pin 8
// lights the castle-gate lamp D1 (green, through R5). Gate 4 is tied to minus. The lamp stands in for the relay and
// door of the blueprint: the idea is the logic, and Unit 2 already taught the relay. The keys panel holds keys down.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { gateChip, logicRail, seen, wire } from "./lib/chip-bench";

const rail = logicRail(4, 61);
const u1 = gateChip({ id: "U1", model: "74HC08", col: 30, board: "full", spare: [4], taken: ["top-:5", "top+:6", "top+:10", "top+:13", "top+:18", "top+:22", "top+:34", "top-:43"], label: "AND chip U1 (74HC08)" });

const held = (lab: LabView, ...ids: string[]) => ["S1", "S2", "S3", "S4"].every((s) => lab.closed(s) === ids.includes(s));
/** Key `s` (its jumper side) goes to minus and its input strip is pulled up to 5 V by `r`. */
const flipped = (lab: LabView, s: string, r: string, pin: string) => lab.connected(`${s}.a1`, "VR1.gnd") && lab.joins(r, pin, "VR1.out");
const shut = (lab: LabView) => !lab.isLit("D1");

/** The fix-it bench: D's pull-up fitted, but its key still goes to 5 V. */
const D_HALF: SolutionStep[] = [
  { do: "unwire", wire: "WD" },
  { do: "wire", id: "WD", from: "j22", to: "top+:22", color: "red" },
];

export default defineLab({
  id: "chord-lock",
  title: "Chord lock",
  bench: {
    board: "full",
    frame: ["hole:j8", "hole:a46", "top+:8", "rail-:46"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      { id: "S1", kind: "pushbutton", at: "e10", params: { cap: "yellow" }, locked: true, label: "Key A (S1)" },
      { id: "S2", kind: "pushbutton", at: "e14", params: { cap: "yellow" }, locked: true, label: "Key B (S2)" },
      { id: "S3", kind: "pushbutton", at: "e18", params: { cap: "red" }, locked: true, label: "Key C (S3)" },
      { id: "S4", kind: "pushbutton", at: "e22", params: { cap: "red" }, locked: true, label: "Key D (S4)" },
      { id: "R1", kind: "resistor", at: "i12-top-:12", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R1" },
      { id: "R2", kind: "resistor", at: "i16-top-:16", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-down R2" },
      { id: "R3", kind: "resistor", at: "i20-top-:21", params: { ohms: 10_000 }, label: "10 kΩ resistor R3 (key C)" },
      { id: "R4", kind: "resistor", at: "i24-top-:24", params: { ohms: 10_000 }, label: "10 kΩ resistor R4 (key D)" },
      ...u1.parts,
      { id: "R5", kind: "resistor", at: "h36-h42", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R5" },
      { id: "D1", kind: "led", at: "g42", params: { color: "green" }, locked: true, label: "Castle gate lamp D1" },
    ],
    wires: [
      ...rail.wires,
      // Each key's jumper side to 5 V.
      wire("WA", "j10", "top+:10", "red"),
      wire("WB", "j14", "top+:13", "red"),
      wire("WC", "j18", "top+:18", "red"),
      wire("WD", "j22", "top+:22", "red"),
      // Each input strip to its pin.
      wire("W2", "d12", "d30", "yellow"),
      wire("W3", "c16", "c31", "yellow"),
      wire("W4", "b20", "b33", "orange"),
      wire("W5", "a24", "a34", "orange"),
      // Gate 3: pin 3 into pin 9; pin 10 to 5 V for now.
      wire("W6", "c32", "h35", "green"),
      wire("W1", "i34", "top+:34", "white"),
      wire("W7", "j43", "top-:43", "black"),
      ...u1.wires,
    ],
    tray: [],
    instruments: [],
  },
  panels: [
    {
      kind: "keys",
      id: "keys",
      buttons: [
        { part: "S1", key: "a", label: "A" },
        { part: "S2", key: "b", label: "B" },
        { part: "S3", key: "c", label: "C" },
        { part: "S4", key: "d", label: "D" },
      ],
    },
  ],
  mascot: {
    hint: "A flipped key idles high and presses low.",
    fried: "Something cooked. Locks should never smoke.",
  },
  tasks: [
    {
      id: "mash-opens",
      prompt: "Hold all four keys at once.",
      goal: (lab) => held(lab, "S1", "S2", "S3", "S4") && lab.isLit("D1"),
      hints: ["Pin down all four keys on the keys card, or hold A, B, C and D on a keyboard."],
      highlight: ["S1", "S2", "S3", "S4"],
      success: "Mash everything and it opens.",
    },
    {
      id: "flip-c",
      prompt: "Flip key C: move R3's leg from minus to plus, and C's red wire from plus to minus.",
      goal: (lab) => flipped(lab, "S3", "R3", "U1.4"),
      hints: ["R3's far leg sits in the minus rail. The plus rail is right next to it.", "C's red jumper goes to plus. Move its end to minus."],
      highlight: ["R3", "WC"],
      success: "C now idles high and presses low.",
    },
    {
      id: "flip-d",
      prompt: "Flip key D the same way.",
      goal: (lab) => flipped(lab, "S4", "R4", "U1.5"),
      hints: ["R4's leg to plus, D's red jumper to minus."],
      highlight: ["R4", "WD"],
      success: "D flipped too.",
    },
    {
      id: "link",
      prompt: "Move pin 10's white wire from plus to pin 6.",
      goal: (lab) => lab.connected("U1.6", "U1.10"),
      hints: ["Pin 6 is gate 2's answer: C and D both untouched."],
      highlight: ["W1"],
      success: "Now C and D count too.",
    },
    {
      id: "mash-shut",
      prompt: "Hold all four keys again.",
      goal: (lab) => lab.heldFor(1, held(lab, "S1", "S2", "S3", "S4") && shut(lab)),
      hints: ["All four, held together."],
      highlight: ["S1", "S2", "S3", "S4"],
      success: "Shut. C or D held keeps it locked.",
    },
    {
      id: "chord-opens",
      prompt: "Hold only **A** and **B**.",
      goal: (lab) => lab.heldFor(0.3, held(lab, "S1", "S2") && lab.isLit("D1")),
      hints: ["Let go of C and D."],
      highlight: ["S1", "S2"],
      success: "Open. Only the right chord.",
    },
    {
      id: "fix-it",
      prompt: "Make D lock the gate again.",
      setup: D_HALF,
      goal: (lab) =>
        seen(lab, "half", lab.heldFor(0.5, lab.connected("S4.a1", "VR1.out") && lab.joins("R4", "U1.5", "VR1.out"), "half")) && flipped(lab, "S4", "R4", "U1.5"),
      hints: ["A pull-up key must press toward minus.", "Move D's red jumper from plus to minus."],
      highlight: ["WD"],
      success: "D pressed: locked.",
    },
    {
      id: "re-key",
      prompt: "Bonus: make D a key the chord needs, then open the lock with A, B and D.",
      goal: (lab) =>
        lab.joins("R4", "U1.5", "VR1.gnd") && lab.connected("S4.a1", "VR1.out") && lab.heldFor(0.3, held(lab, "S1", "S2", "S4") && lab.isLit("D1"), "abd"),
      hints: ["Flip D back: R4's leg to minus, its red jumper to plus.", "Gate 2 then needs D held and C up."],
      highlight: ["R4", "WD"],
      success: "A new chord: A, B and D.",
      bonus: true,
    },
  ],
  solution: [
    { do: "set", part: "S1", key: "pressed", value: true },
    { do: "set", part: "S2", key: "pressed", value: true },
    { do: "set", part: "S3", key: "pressed", value: true },
    { do: "set", part: "S4", key: "pressed", value: true },
    { do: "check", task: "mash-opens" },
    { do: "set", part: "S1", key: "pressed", value: false },
    { do: "set", part: "S2", key: "pressed", value: false },
    { do: "set", part: "S3", key: "pressed", value: false },
    { do: "set", part: "S4", key: "pressed", value: false },
    { do: "move", part: "R3", at: "i20-top+:21" },
    { do: "unwire", wire: "WC" },
    { do: "wire", id: "WC", from: "j18", to: "top-:18", color: "red" },
    { do: "check", task: "flip-c" },
    { do: "move", part: "R4", at: "i24-top+:24" },
    { do: "unwire", wire: "WD" },
    { do: "wire", id: "WD", from: "j22", to: "top-:22", color: "red" },
    { do: "check", task: "flip-d" },
    { do: "unwire", wire: "W1" },
    { do: "wire", id: "W1", from: "i34", to: "d35", color: "white" },
    { do: "check", task: "link" },
    { do: "set", part: "S1", key: "pressed", value: true },
    { do: "set", part: "S2", key: "pressed", value: true },
    { do: "set", part: "S3", key: "pressed", value: true },
    { do: "set", part: "S4", key: "pressed", value: true },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "mash-shut" },
    { do: "set", part: "S3", key: "pressed", value: false },
    { do: "set", part: "S4", key: "pressed", value: false },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "chord-opens" },
    // The secret: D back to a pull-down key, and the chord A, B, D.
    { do: "move", part: "R4", at: "i24-top-:24" },
    { do: "unwire", wire: "WD" },
    { do: "wire", id: "WD", from: "j22", to: "top+:22", color: "red" },
    { do: "set", part: "S4", key: "pressed", value: true },
    { do: "wait", seconds: 0.5 },
    // Back to the flipped D, all keys up, before the check: the fix-it bench starts from here.
    { do: "set", part: "S1", key: "pressed", value: false },
    { do: "set", part: "S2", key: "pressed", value: false },
    { do: "set", part: "S4", key: "pressed", value: false },
    { do: "unwire", wire: "WD" },
    { do: "wire", id: "WD", from: "j22", to: "top-:22", color: "red" },
    { do: "move", part: "R4", at: "i24-top+:24" },
    { do: "check", task: "re-key" },
    ...D_HALF,
    { do: "wait", seconds: 0.6 },
    { do: "unwire", wire: "WD" },
    { do: "wire", id: "WD", from: "j22", to: "top-:22", color: "red" },
    { do: "check", task: "fix-it" },
  ],
});
