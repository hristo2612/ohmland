// Blueprint: docs/curriculum/unit-4.md, CH17, as narrowed by docs/curriculum/unit-3.md 8.2 (the 7805 is taught in
// Unit 3's steady-five): a bench lesson (docs/LESSONS.md), content/units/chips/logic/five-volts-exactly. One idea: a
// logic input reads high near plus and low near minus; left floating it reads noise, so a resistor ties it down. Half
// board. The logic rail: VR1 (7805) at the left end turns the battery's 9.4 V into 5 V on the far rails. U1, a 74HC08,
// has gate 4's inputs (pins 13 and 12) joined: a gate that copies its input onto pin 11, which lights D1 through 1 kΩ.
// Its other inputs are tied to minus. Trimmer RV1 across the 5 V rail feeds the input through the knob's wire W1.
// Everything in play sits in the far half. The learner sweeps the knob, pulls the wire out (the input floats and
// follows a hand's hum: the Knob and Hand sliders), then ties the input down with the 10 kΩ waiting on the shelf. Spare
// chip U9 sits on 5 V for the secret (moved to 9 V it dies). The fix-it bench lifts the pull-down's far end into an
// empty strip.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { gateChip, logicRail, seen, wire } from "./lib/chip-bench";

const rail = logicRail(2, 29);
const u1 = gateChip({ id: "U1", model: "74HC08", col: 12, board: "half", spare: [1, 2, 3], taken: ["top+:9", "top-:7", "top+:4", "top-:3", "top-:21"], label: "Gate chip U1 (74HC08)" });
const u9 = gateChip({ id: "U9", model: "74HC08", col: 23, board: "half", spare: [], taken: ["rail-:29", "rail-:21"], label: "Spare chip U9 (74HC08)" });
const input = (lab: LabView) => lab.volts("U1.13") ?? 0;
const pulledDown = (lab: LabView) => lab.joins("R4", "U1.13", "U1.7");
const hand = (lab: LabView) => (lab.control("hand") ?? 0) >= 0.6;

/** The fix-it bench: the pull-down's far leg lifted from the minus rail into an empty strip, a hand near the chip. */
const LIFTED: SolutionStep[] = [
  { do: "move", part: "R4", at: "i13-i10" },
  { do: "control", id: "hand", value: 0.9 },
];

export default defineLab({
  id: "five-volts-exactly",
  title: "High, low or floating",
  bench: {
    board: "half",
    frame: ["hole:j1", "hole:a30", "top+:1", "rail-:30"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      ...rail.parts,
      { id: "RV1", kind: "trimmer", at: "h7", params: { ohms: 10_000, position: 0.5 }, locked: true, label: "Knob RV1 (10 kΩ trimmer)" },
      ...u1.parts,
      { id: "R3", kind: "resistor", at: "i15-i20", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", at: "h20", params: { color: "red" }, locked: true, label: "Lamp D1" },
      ...u9.parts,
      // The pull-down waits on the shelf behind the board.
      { id: "R4", kind: "resistor", at: "shelf", params: { ohms: 10_000 }, label: "10 kΩ resistor R4" },
    ],
    wires: [
      ...rail.wires,
      wire("W3", "j7", "top-:7", "black"),
      wire("W4", "j9", "top+:9", "red"),
      // Gate 4's inputs joined: pin 13 and pin 12.
      wire("W2", "g13", "g14", "yellow"),
      // The knob's wire: wiper to the input.
      wire("W1", "g8", "h13", "yellow"),
      wire("W5", "j21", "top-:21", "black"),
      ...u1.wires,
      ...u9.wires,
    ],
    tray: [],
    instruments: [],
    controls: [
      { id: "knob", label: "Knob", part: "RV1", key: "position", min: 0, max: 1, value: 0.5, step: 0.01, unit: "%" },
      { id: "hand", label: "Hand", part: "U1", key: "proximity", min: 0, max: 1, value: 0 },
    ],
    watch: ["U1.11"],
  },
  mascot: {
    hint: "All the way up is the plus rail. All the way down is minus.",
    fried: "That chip took 9 V. Logic lives on the 5 V rail.",
  },
  fried: { U9: "74HC08, fed 9 V" },
  tasks: [
    {
      id: "knob-high",
      prompt: "Turn the **Knob** all the way up.",
      goal: (lab) => input(lab) >= 4.5 && lab.isLit("D1"),
      hints: ["Drag the Knob slider to the right end."],
      highlight: ["RV1"],
      success: "Near 5 V: high. The lamp lights.",
    },
    {
      id: "knob-low",
      prompt: "Turn the **Knob** all the way down.",
      goal: (lab) => input(lab) <= 0.5 && !lab.isLit("D1"),
      hints: ["Drag the Knob slider to the left end."],
      highlight: ["RV1"],
      success: "Near 0 V: low. Dark.",
    },
    {
      id: "float-input",
      prompt: "Pull out the knob's yellow wire.",
      goal: (lab) => !lab.connected("U1.13", "RV1.wiper"),
      hints: ["Pick up the wire from the knob to pin 13 and delete it, or drag an end into an empty strip."],
      highlight: ["W1"],
      success: "Nothing holds pin 1 now.",
    },
    {
      id: "hand-hum",
      prompt: "Slide the **Hand** close to the chip.",
      goal: (lab) => hand(lab) && lab.edges("U1.11", 1).rises >= 10,
      hints: ["Drag the Hand slider most of the way up."],
      highlight: ["U1"],
      success: "It flickers with the hum from my hand.",
    },
    {
      id: "pull-down",
      prompt: "Put the 10 kΩ resistor from pin 13's strip to the minus rail.",
      goal: (lab) => pulledDown(lab) && hand(lab) && lab.heldFor(2, !lab.isLit("D1") && lab.logic("U1.13") === "L"),
      hints: ["One leg in pin 13's strip, the other in the minus rail just above it.", "Keep the Hand close: it should stay dark."],
      highlight: ["U1"],
      nudges: [{ when: (lab) => lab.joins("R4", "U1.13", "U1.14"), say: "That ties it high. Minus, please." }],
      success: "Steady dark, even with my hand close.",
    },
    {
      id: "fix-it",
      prompt: "Stop the lamp flickering.",
      setup: LIFTED,
      goal: (lab) => seen(lab, "lifted", lab.heldFor(0.5, !pulledDown(lab), "lifted")) && pulledDown(lab) && lab.heldFor(2, hand(lab) && !lab.isLit("D1")),
      hints: ["Where does the resistor's far leg end?", "Move that leg into the minus rail."],
      highlight: ["R4"],
      success: "Tied down again.",
    },
    {
      id: "fry-a-gate",
      prompt: "Bonus: move the spare chip's plus wire to the 9 V rail.",
      goal: (lab) => lab.died("U9"),
      hints: ["The red wire from U9's pin 14 goes to the 5 V rail. The near plus rail is 9 V."],
      highlight: ["U9-vcc"],
      success: "Pop. 74HC chips are made for 2 to 6 V.",
      bonus: true,
    },
  ],
  solution: [
    { do: "control", id: "knob", value: 1 },
    { do: "check", task: "knob-high" },
    { do: "control", id: "knob", value: 0 },
    { do: "check", task: "knob-low" },
    { do: "unwire", wire: "W1" },
    { do: "check", task: "float-input" },
    { do: "control", id: "hand", value: 0.9 },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "hand-hum" },
    // "Show me" starts from the lab's sliders: the hand comes close again first.
    { do: "control", id: "hand", value: 0.9 },
    { do: "move", part: "R4", at: "i13-top-:13" },
    { do: "wait", seconds: 2.4 },
    { do: "check", task: "pull-down" },
    // The secret: the spare chip on 9.4 V.
    { do: "unwire", wire: "U9-vcc" },
    { do: "wire", id: "U9-vcc", from: "j23", to: "rail+:23", color: "red" },
    { do: "wait", seconds: 1 },
    // Back on 5 V before the check: the fix-it bench starts from the bench here (a fresh, unburnt U9).
    { do: "unwire", wire: "U9-vcc" },
    { do: "wire", id: "U9-vcc", from: "j23", to: "top+:23", color: "red" },
    { do: "check", task: "fry-a-gate" },
    ...LIFTED,
    { do: "wait", seconds: 1 },
    { do: "move", part: "R4", at: "i13-top-:13" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "fix-it" },
  ],
});
