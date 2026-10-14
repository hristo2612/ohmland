// Blueprint: docs/curriculum/unit-2.md, Lesson 7; conversion: docs/curriculum/conversion-guide.md, C2 lesson 7. The lab
// of a bench lesson (docs/LESSONS.md): content/units/switching/breadboard/breadboard-inside/lesson.yaml.
// One idea: parts with two rows of legs straddle the middle gap. First use of the 830-hole board.
//
// A full board whose rails are split between columns 31 and 33, bridged by two short jumpers. The battery feeds the
// left half; the relay changeover sits on the right half. Relay K1 starts on one side of the gap (rows b and e), so
// each pair of facing legs shares a strip: its coil is shorted and the button does nothing. Straddling the gap (rows e
// and f at column 38) gives every leg its own strip: coil 38 (near end grounded, far end fed by button S1), COM 41 to +,
// NC 43 to the yellow LED, NO 45 to the green one, and the 1N4001 across the coil with its band on the fed end. The
// fix-it pulls the rail bridges, so the right half goes dead.
//
// Measured in the simulator: with K1 off the gap, yellow glows and a press does nothing; straddling, yellow at rest
// and green while S1 is held, the diode about 9 V backwards; with the bridges gone, every LED on the right half dark.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** Every leg of the part sits in a hole, and no two legs share a strip. */
function straddles(lab: LabView, id: string): boolean {
  const p = lab.benchPart(id);
  if (!p) return false;
  const legs = lab.legs(id);
  if (!legs.every((l) => p.holes?.[l])) return false;
  for (let i = 0; i < legs.length; i++) for (let j = i + 1; j < legs.length; j++) if (lab.connected(`${id}.${legs[i]}`, `${id}.${legs[j]}`)) return false;
  return true;
}

/** The relay straddles the gap where the circuit expects it: the coil's two legs on the diode's two strips. */
const inPlace = (lab: LabView) => straddles(lab, "K1") && lab.connected("K1.coil1", "D4.anode") && lab.connected("K1.coil2", "D4.cathode");
const halfDead = (lab: LabView) => !lab.connected("rail+:10", "rail+:50") || !lab.connected("rail-:10", "rail-:50");

/** The fix-it bench: the two jumpers that bridge the split rails are gone, so the right half has no supply. */
const PULL_BRIDGES: SolutionStep[] = [
  { do: "unwire", wire: "W1" },
  { do: "unwire", wire: "W2" },
];

export default defineLab({
  id: "breadboard-inside",
  title: "The full board",
  bench: {
    board: "full",
    splitRails: true,
    frame: ["desk:-80,-28", "desk:56,28"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "e34", params: { cap: "red" }, locked: true, label: "Button S1" },
      // Off the gap on purpose: rows b and e, so each pair of facing legs shares a strip.
      { id: "K1", kind: "relay", at: "b38", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, label: "Relay K1" },
      { id: "D4", kind: "diode", at: "d38-h38", params: { model: "1N4001" }, locked: true, label: "1N4001 diode D4" },
      { id: "R4", kind: "resistor", at: "c43-c48", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R4" },
      { id: "D5", kind: "led", at: "d48", params: { color: "yellow" }, locked: true, label: "Yellow LED D5" },
      { id: "R5", kind: "resistor", at: "a45-a51", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R5" },
      { id: "D6", kind: "led", at: "d51", params: { color: "green" }, locked: true, label: "Green LED D6" },
    ],
    wires: [
      // The bridges over the rails' split.
      { id: "W1", from: "rail+:31", to: "rail+:33", color: "red" },
      { id: "W2", from: "rail-:31", to: "rail-:33", color: "black" },
      { id: "W3", from: "a34", to: "rail+:34", color: "red" },
      { id: "W4", from: "g36", to: "g38", color: "yellow" },
      { id: "W5", from: "a38", to: "rail-:37", color: "black" },
      { id: "W6", from: "a41", to: "rail+:41", color: "red" },
      { id: "W7", from: "a49", to: "rail-:49", color: "black" },
      { id: "W8", from: "a52", to: "rail-:52", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Facing legs need their own strips. The gap splits them.",
    fried: "Oof. That one's for the Hall.",
  },
  fried: { led: "LED on the full board" },
  tasks: [
    {
      id: "dud-press",
      prompt: "Press the button.",
      // A press with the relay still off the gap (or already fixed, by a learner ahead of the robot).
      goal: (lab) => lab.heldFor(0.3, lab.closed("S1")) && (!straddles(lab, "K1") || lab.relayClicked("K1")),
      hints: ["The button is the red one at column 34."],
      highlight: ["S1"],
      success: "Not one click.",
    },
    {
      id: "relay-straddles",
      prompt: "Move the relay so it straddles the middle gap.",
      goal: (lab) => inPlace(lab) && lab.isLit("D5"),
      hints: ["Drag the relay three rows toward the middle gap.", "Its legs go in rows e and f, the coil at column 38."],
      highlight: ["K1", "hole:e38", "hole:f38"],
      nudges: [{ when: (lab) => straddles(lab, "K1") && !inPlace(lab), say: "Across now. Line the coil up with the diode." }],
      success: "Every leg, its own strip.",
    },
    {
      id: "relay-on-board",
      prompt: "Press the button.",
      goal: (lab) => {
        if (!inPlace(lab)) return false;
        if (!lab.closed("S1") && lab.isLit("D5") && !lab.isLit("D6")) lab.memory["rest"] = true;
        if (lab.closed("S1") && lab.isLit("D6") && !lab.isLit("D5") && (lab.part("D4")?.v ?? 0) < -1) lab.memory["held"] = true;
        return lab.memory["rest"] === true && lab.memory["held"] === true;
      },
      hints: ["Hold the red button down and watch the green LED."],
      highlight: ["S1"],
      success: "Click. Green.",
    },
    {
      id: "bus-gap",
      prompt: "Half the board went dark. Fix it.",
      setup: PULL_BRIDGES,
      // Dead first (the setup), then fed again across the split.
      goal: (lab) => {
        if (!lab.isLit("D5") && halfDead(lab)) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && lab.isLit("D5") && !halfDead(lab);
      },
      hints: ["Follow the red stripe. See the break in the middle?", "Bridge each rail across its break with a wire."],
      highlight: ["hole:bp31", "hole:bp33", "hole:bn31", "hole:bn33"],
      nudges: [{ when: (lab) => lab.connected("rail+:10", "rail+:50") && !lab.connected("rail-:10", "rail-:50"), say: "Plus is across. Minus needs a bridge too." }],
      success: "Fixed.",
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "check", task: "dud-press" },
    { do: "move", part: "K1", at: "e38" },
    { do: "check", task: "relay-straddles" },
    { do: "wait", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "relay-on-board" },
    ...PULL_BRIDGES,
    { do: "wait", seconds: 0.3 },
    { do: "wire", id: "W9", from: "rail+:30", to: "rail+:35", color: "red" },
    { do: "wire", id: "W10", from: "rail-:30", to: "rail-:35", color: "black" },
    { do: "check", task: "bus-gap" },
  ],
});
