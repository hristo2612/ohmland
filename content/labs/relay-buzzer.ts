// Blueprint: docs/curriculum/unit-2.md, Lesson 8; conversion: docs/curriculum/conversion-guide.md, C2 lesson 8. The lab
// of a bench lesson (docs/LESSONS.md): content/units/switching/breadboard/relay-buzzer/lesson.yaml.
// One idea: a relay fed through its own NC contact switches itself on and off. (The capacitor that slows it is the
// next lesson, tame-the-buzz.)
//
// The changeover from lesson 7, rebuilt with a power switch: the battery snap feeds slide switch S2 at the left end,
// whose output (row 3) feeds the near + rail. Relay K1 straddles the channel at row 11 (coil 11, COM 14, NC 16, NO 18);
// its far coil pin goes to the far minus rail, and a 1N4001 across the coil (band on the near coil strip) catches the
// kickback. NC feeds the yellow LED, NO the green one. Button S1 (rows 7 and 9) feeds the coil; one wire from NC to
// the coil makes the relay buzz.
//
// Measured in the simulator: about 83 buzzes a second (166 clicks), yellow near 0.75 and green near 0.69 (they swap
// too fast to see); the contacts wear out after about 18 s of buzzing. Fed from NO instead, it never clicks.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const powered = (lab: LabView) => lab.closed("S2");

/** Buzzing: the coil fed from NC, dozens of clicks a second, both LEDs half lit. */
function buzzing(lab: LabView): boolean {
  if (!powered(lab) || !lab.connected("K1.nc1", "K1.coil1") || lab.count("clicked", "K1", 1) < 40) return false;
  const y = lab.stats("glow:D2", 0.5);
  const g = lab.stats("glow:D3", 0.5);
  return !!y && !!g && y.mean > 0.15 && y.mean < 0.85 && g.mean > 0.15 && g.mean < 0.85;
}
const fromNo = (lab: LabView) => lab.connected("K1.no1", "K1.coil1");

/** The fix-it bench: the feed wire lands on NO (row 18) instead of NC, and the power is on. */
const FEED_FROM_NO: SolutionStep[] = [
  { do: "unwire", wire: "W9" },
  { do: "wire", id: "W9", from: "a18", to: "a11", color: "green" },
  { do: "flip", part: "S2", to: "b" },
];

export default defineLab({
  id: "relay-buzzer",
  title: "It buzzes itself",
  bench: {
    board: "full",
    frame: ["desk:-104,-30", "desk:-6,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S2", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Power switch S2" },
      { id: "K1", kind: "relay", at: "e11", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "D1", kind: "diode", at: "h11-d11", params: { model: "1N4001" }, locked: true, label: "1N4001 diode D1" },
      { id: "R2", kind: "resistor", at: "c16-c20", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "d20", params: { color: "yellow" }, locked: true, label: "Yellow LED D2" },
      { id: "R3", kind: "resistor", at: "b18-b24", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R3" },
      { id: "D3", kind: "led", at: "d24", params: { color: "green" }, locked: true, label: "Green LED D3" },
      { id: "S1", kind: "pushbutton", at: "e7", params: { cap: "black" }, label: "Button S1" },
    ],
    wires: [
      { id: "W1", from: "a3", to: "rail+:3", color: "red" },
      { id: "W2", from: "rail-:6", to: "top-:6", color: "black" },
      { id: "W3", from: "j11", to: "top-:11", color: "black" },
      { id: "W4", from: "a14", to: "rail+:13", color: "red" },
      { id: "W5", from: "a21", to: "rail-:21", color: "black" },
      { id: "W6", from: "a25", to: "rail-:25", color: "black" },
      { id: "W7", from: "a7", to: "rail+:7", color: "red" },
      { id: "W8", from: "c9", to: "c11", color: "yellow" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "The coil can take its power from the relay's own NC contact.",
    fried: "It buzzed itself to bits. Real relays do that too.",
  },
  fried: { relay: "Relay: contacts worn out by buzzing" },
  tasks: [
    {
      id: "polite-click",
      prompt: "Power on with S2. Press S1, then let go.",
      goal: (lab) => {
        if (!powered(lab)) return false;
        if (lab.closed("S1") && lab.closed("K1") && lab.isLit("D3")) lab.memory["in"] = true;
        return lab.memory["in"] === true && !lab.closed("S1") && !lab.closed("K1") && lab.isLit("D2");
      },
      hints: ["Slide S2, the switch at the far left, to on.", "Then press the black button S1 and let go."],
      highlight: ["S2", "S1"],
      nudges: [{ when: (lab) => lab.closed("S1") && !powered(lab), say: "No power yet. Slide S2 on first." }],
      success: "Click in, click out.",
    },
    {
      id: "move-one-wire",
      prompt: "Run a wire from NC, row 16, to the coil, row 11.",
      goal: buzzing,
      hints: ["One wire: row 16 to row 11, this side of the gap.", "Nothing? Check S2 is still on."],
      highlight: ["pin:K1.nc1", "pin:K1.coil1"],
      nudges: [{ when: (lab) => fromNo(lab) && !lab.connected("K1.nc1", "K1.coil1"), say: "That's NO, row 18. NC is row 16." }],
      success: "It buzzes!",
    },
    {
      id: "switch-off",
      prompt: "Switch off with S2.",
      goal: (lab) => !powered(lab) && lab.count("clicked", "K1") >= 40,
      hints: ["Slide S2 back to off."],
      highlight: ["S2"],
      success: "Quiet again.",
    },
    {
      id: "fix-the-feed",
      prompt: "The power's on, but my buzzer just sits there. Fix it.",
      setup: FEED_FROM_NO,
      // Silent with the power on first (the setup), then buzzing.
      goal: (lab) => {
        if (powered(lab) && lab.count("clicked", "K1", 1) === 0) lab.memory["silent"] = true;
        return lab.memory["silent"] === true && buzzing(lab);
      },
      hints: ["Follow the green wire from the coil. Which contact does it reach?", "NO is open at rest. Move the wire to NC, row 16."],
      highlight: ["wire:W9", "pin:K1.nc1"],
      success: "Fixed.",
    },
  ],
  solution: [
    { do: "flip", part: "S2", to: "b" },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "polite-click" },
    { do: "wire", id: "W9", from: "a16", to: "a11", color: "green" },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "move-one-wire" },
    { do: "flip", part: "S2", to: "a" },
    { do: "check", task: "switch-off" },
    ...FEED_FROM_NO,
    { do: "wait", seconds: 0.6 },
    { do: "unwire", wire: "W9" },
    { do: "wire", id: "W9", from: "a16", to: "a11", color: "green" },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "fix-the-feed" },
  ],
});
