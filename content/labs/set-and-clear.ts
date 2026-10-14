// Blueprint: docs/curriculum/unit-4.md, CH6. A bench lesson (docs/LESSONS.md):
// content/units/chips/timer-555/set-and-clear. One idea: with pin 6 tied to minus and no timing parts, the 555
// remembers: a dip on pin 2 sets it, a low on pin 4 clears it, and reset beats everything. New: pin 4 (reset) and the
// word "latch" for the switch inside.
//
// Half board, the 555 across the channel at columns 14 to 17. Far side: pin 8 to plus, pin 6 to minus, pins 7 and 5
// free. Near side: SET (S1, columns 8 and 10) dips pin 2 against R2's 10 kΩ pull-up; CLEAR (S2, columns 19 and 21)
// pulls pin 4 low against R4's 10 kΩ; R3 1 kΩ and the LED hang off pin 3 to the left of the chip. A keys panel holds
// both buttons at once (and pins one down on a touch screen). The battery is free to unplug for the secret.
//
// Measured in the simulator: SET lights the lamp for good; CLEAR (pin 4 under 0.7 V) puts it out and wins while both
// are held. Unplugged and plugged back, the latch wakes set or clear at random (60% set). With pin 6 on plus (the
// fix-it) the threshold clears the latch the moment SET lets go.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const lit = (lab: LabView) => lab.isLit("D1");
const dark = (lab: LabView) => (lab.part("D1")?.glow ?? 1) < 0.05;
const powered = (lab: LabView) => lab.part("U1")?.extra?.["powered"] === true;

/** The fix-it bench: pin 6's jumper moved from the minus rail to the plus rail. */
const PIN6_TO_PLUS: SolutionStep[] = [
  { do: "unwire", wire: "W6" },
  { do: "wire", id: "W6", from: "j16", to: "top+:16", color: "red" },
];

export default defineLab({
  id: "set-and-clear",
  title: "Set and clear",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "S1", kind: "pushbutton", at: "e8", params: { cap: "black" }, locked: true, label: "SET button S1" },
      { id: "R2", kind: "resistor", at: "b15-rail+:15", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R2" },
      { id: "R3", kind: "resistor", at: "c16-c12", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", holes: { anode: "b12", cathode: "b11" }, params: { color: "red", maxmA: 20 }, locked: true, label: "Red LED" },
      { id: "R4", kind: "resistor", at: "c17-rail+:17", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R4" },
      { id: "S2", kind: "pushbutton", at: "e19", params: { cap: "red" }, locked: true, label: "CLEAR button S2" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a14", to: "rail-:14", color: "black" },
      { id: "W2", from: "j14", to: "top+:14", color: "red" },
      { id: "W5", from: "a11", to: "rail-:11", color: "black" },
      { id: "W6", from: "j16", to: "top-:16", color: "black" },
      { id: "W7", from: "d10", to: "d15", color: "yellow" },
      { id: "W8", from: "a8", to: "rail-:8", color: "black" },
      { id: "W10", from: "d17", to: "d19", color: "yellow" },
      { id: "W11", from: "a21", to: "rail-:21", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  panels: [
    { kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7, 4] },
    { kind: "keys", id: "keys", buttons: [{ part: "S1", key: "s", label: "SET" }, { part: "S2", key: "c", label: "CLEAR" }] },
  ],
  mascot: {
    hint: "SET dips pin 2. CLEAR pulls pin 4 low.",
    fried: "That shouldn't happen here. Fresh chip in.",
  },
  tasks: [
    {
      id: "stays-on",
      prompt: "Press SET, let go, and wait.",
      goal: (lab) => {
        if (lab.closed("S1")) lab.memory["pressed"] = true;
        return lab.memory["pressed"] === true && lab.heldFor(4, !lab.closed("S1") && lit(lab));
      },
      hints: ["Tap the black SET button once, then wait."],
      highlight: ["S1"],
      success: "Still on. Nothing tells it to stop.",
    },
    {
      id: "clear-it",
      prompt: "Press CLEAR.",
      goal: (lab) => {
        if (lab.closed("S2")) lab.memory["pressed"] = true;
        return lab.memory["pressed"] === true && lab.heldFor(0.5, dark(lab));
      },
      hints: ["Tap the red CLEAR button."],
      highlight: ["S2"],
      success: "Dark again.",
    },
    {
      id: "xray-latch",
      prompt: "Look inside, then press SET and then CLEAR.",
      goal: (lab) => {
        if (!lab.view("xray:U1")) return false;
        const latch = lab.part("U1")?.extra?.["latch"] === true;
        if (latch) lab.memory["set"] = true;
        return lab.memory["set"] === true && !latch && dark(lab);
      },
      hints: ["Open the x-ray first.", "SET, watch the switch inside flip on. Then CLEAR."],
      success: "On, it stayed on, then off. It remembers.",
    },
    {
      id: "reset-wins",
      prompt: "Hold both buttons at once.",
      goal: (lab) => lab.heldFor(1, lab.closed("S1") && lab.closed("S2") && dark(lab)),
      hints: ["Use the keys: hold SET and CLEAR together.", "On a touch screen, pin one key down, then press the other."],
      success: "Dark. CLEAR wins.",
    },
    {
      id: "fix-pin6",
      prompt: "Make the lamp stay on after SET.",
      setup: PIN6_TO_PLUS,
      goal: (lab) => {
        if (!lab.connected("U1.6", "B1.neg")) lab.memory["broken"] = true;
        if (lab.closed("S1")) lab.memory["pressed"] = lab.t;
        return lab.memory["broken"] === true && lab.connected("U1.6", "B1.neg") && lab.memory["pressed"] !== undefined && lab.heldFor(3, !lab.closed("S1") && lit(lab));
      },
      hints: ["Where should pin 6 sit so it never clears?", "Move pin 6's jumper from the plus rail to the minus rail. Then SET."],
      highlight: ["W6"],
      success: "It stays on. Pin 6 high had cleared it at once.",
    },
    {
      id: "power-back",
      prompt: "SET it, then pull the battery's red lead out of the board and plug it back.",
      goal: (lab) => {
        const m = lab.memory;
        if (powered(lab) && lit(lab)) m["was"] = true;
        if (m["was"] === true && !powered(lab)) m["off"] = true;
        return m["off"] === true && powered(lab);
      },
      hints: ["Drag the red lead's end off the rail, then back in."],
      success: "Back on or not? A coin toss.",
      bonus: true,
    },
  ],
  solution: [
    { do: "press", part: "S2", seconds: 0.2 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 4.5 },
    { do: "check", task: "stays-on" },
    { do: "press", part: "S2", seconds: 0.2 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "clear-it" },
    { do: "view", name: "xray:U1", on: true },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "press", part: "S2", seconds: 0.2 },
    { do: "check", task: "xray-latch" },
    { do: "set", part: "S1", key: "pressed", value: true },
    { do: "set", part: "S2", key: "pressed", value: true },
    { do: "wait", seconds: 1.5 },
    { do: "set", part: "S1", key: "pressed", value: false },
    { do: "set", part: "S2", key: "pressed", value: false },
    { do: "check", task: "reset-wins" },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 0.5 },
    { do: "move", part: "B1", at: "desk:-90,30" },
    { do: "wait", seconds: 0.5 },
    { do: "move", part: "B1", at: "rails" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "power-back" },
    ...PIN6_TO_PLUS,
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 1 },
    { do: "unwire", wire: "W6" },
    { do: "wire", id: "W6", from: "j16", to: "top-:16", color: "black" },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "fix-pin6" },
  ],
});
