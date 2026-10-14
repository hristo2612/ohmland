// Blueprint: docs/curriculum/unit-2.md, Lesson 15 (its first half); docs/curriculum/conversion-guide.md, 15.
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/transistors/delay-timer. Tuning the delay with a
// trimmer moved to tune-the-timer. One idea: a load that drains the timing capacitor ruins the timer; a transistor
// buffer fixes it.
//
// Start switch S1 (the slide switch at the left end) feeds the near + rail. R1 (1 kΩ) runs from the rail into row 10,
// where C1 (1,000 µF) bends down to the minus rail. Reset button S2 (rows 10 and 12) empties C1 through R3 (100 Ω).
// Relay K1 straddles the channel at row 20 (coil 20, COM 23, NO 27), with its far coil pin on the far minus rail and
// a 1N4001 across the coil. NO feeds R2 and the green LED. At the start the yellow jumper W6 joins C1's row straight
// to the coil (row 10 to row 20). Two jumpers already wait for Q1: W7 from C1's row to row 21 (the base) and W8 from
// the + rail to row 22 (the collector). The learner pulls W6 and plugs Q1 into rows 20 to 22, emitter on the coil.
// The stopwatch starts when S1 is switched on and stops when the relay pulls in; it notes C1's voltage at the start,
// so a run without a reset shows up.
//
// Measured in the simulator: without Q1, C1 sticks at 3.16 V and K1 never clicks; with Q1 the relay clicks 1.47 s
// after switching on from an empty C1. Settled, C1 sits at 8.86 V and the emitter at 8.12 V (0.74 V lower). With
// S1 off, the coil drains C1 through Q1 within a second or so; switched off and on at once, the relay never lets go.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** Q1 as an emitter follower: base on C1, emitter on the coil, collector on the + rail. */
const follower = (lab: LabView) => lab.connected("Q1.b", "C1.pos") && lab.connected("Q1.e", "K1.coil1") && lab.connected("Q1.c", "K1.com1");
/** C1 joined straight to the coil, as on the first try. */
const bypassed = (lab: LabView) => lab.connected("C1.pos", "K1.coil1");
const clicked = (lab: LabView) => lab.events.some((e) => e.type === "clicked" && e.partId === "K1" && e.data?.["to"] === "no");

/** The fix-it bench: the yellow jumper back in, C1 straight to the coil again, with Q1 still in place. */
const JUMPER_BACK: SolutionStep[] = [{ do: "wire", id: "W6", from: "a10", to: "a20", color: "yellow" }];

export default defineLab({
  id: "delay-timer",
  title: "Wait for it",
  bench: {
    board: "full",
    // The timer, from the start switch (column 1) to the green LED (column 33).
    frame: ["top+:1", "rail-:35"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "a2", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "slide-switch", at: "b1", params: { to: "a" }, locked: true, label: "Start switch S1" },
      { id: "R1", kind: "resistor", at: "rail+:10-b10", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "C1", kind: "electrolytic-cap", at: "c10-rail-:11", params: { farads: 1000e-6, volts: 16 }, locked: true, label: "1,000 µF capacitor C1" },
      { id: "S2", kind: "pushbutton", at: "e10", params: { cap: "white" }, locked: true, label: "Reset button S2" },
      { id: "R3", kind: "resistor", at: "b12-rail-:13", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R3" },
      { id: "K1", kind: "relay", at: "e20", params: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "D1", kind: "diode", at: "h20-d20", params: { model: "1N4001" }, locked: true, label: "1N4001 diode D1" },
      { id: "R2", kind: "resistor", at: "c27-c32", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "d32", params: { color: "green" }, locked: true, label: "Green LED D2" },
    ],
    wires: [
      { id: "W1", from: "a3", to: "rail+:3", color: "red" },
      { id: "W2", from: "rail-:4", to: "top-:4", color: "black" },
      { id: "W3", from: "j20", to: "top-:21", color: "black" },
      { id: "W4", from: "a23", to: "rail+:23", color: "red" },
      { id: "W5", from: "a33", to: "rail-:33", color: "black" },
      // The first try: C1 straight to the coil.
      { id: "W6", from: "a10", to: "a20", color: "yellow" },
      // Waiting for Q1: its base row to C1, its collector row to plus.
      { id: "W7", from: "d10", to: "a21", color: "white" },
      { id: "W8", from: "a22", to: "rail+:22", color: "red" },
    ],
    tray: [{ id: "Q1", kind: "npn", count: 1, label: "2N3904" }],
    instruments: [
      { kind: "stopwatch", start: { part: "S1", to: "b" }, stop: { part: "K1", contact: "no" }, watch: "C1.pos" },
      { kind: "meter", at: "desk:-178,22", rot: 16, mode: "dcv", tips: { red: "desk:-52,48", black: "desk:-40,54" } },
    ],
  },
  mascot: {
    start: "You know how to make time. Let's make a timer.",
    hint: "Reset C1 before each run.",
    fried: "Straight from the supply into the base: nothing limited the current.",
  },
  fried: { npn: "2N3904, base wired straight to the supply" },
  tasks: [
    {
      id: "no-click",
      prompt: "Switch on S1 and wait.",
      goal: (lab) => {
        const v = lab.volts("C1.pos") ?? 0;
        return lab.heldFor(8, lab.closed("S1")) && bypassed(lab) && v >= 2.8 && v <= 3.5 && !clicked(lab);
      },
      hints: ["Slide S1, at the board's left end. Then wait a few seconds."],
      highlight: ["S1"],
      success: "Ten seconds. Not a peep.",
    },
    {
      id: "buffer-in",
      prompt: "Pull the yellow jumper. Plug Q1 into rows 20 to 22.",
      goal: (lab) => !bypassed(lab) && follower(lab) && lab.isLit("D2"),
      hints: ["Drag the yellow jumper off the board.", "Q1 in rows 20 to 22, flat face toward you.", "Keep S1 on."],
      highlight: ["wire:W6.b", "hole:c20", "hole:c21", "hole:c22"],
      nudges: [{ when: (lab) => !bypassed(lab) && follower(lab) && !lab.closed("S1"), say: "Now switch S1 on." }],
      success: "Click!",
    },
    {
      id: "add-q1",
      prompt: "Time a fair run: S1 off, reset, then on.",
      goal: (lab) => follower(lab) && !bypassed(lab) && lab.runs().some((r) => (r.watch ?? 9) < 0.5 && r.seconds >= 0.9 && r.seconds <= 2.2) && lab.isLit("D2"),
      hints: ["Slide S1 off. Press S2 to empty C1.", "Then slide S1 on and watch the stopwatch."],
      highlight: ["S1", "S2"],
      nudges: [{ when: (lab) => { const r = lab.runs().at(-1); return !!r && (r.watch ?? 0) > 0.5; }, say: "C1 wasn't empty. Press reset while S1 is off." }],
      success: "Click, after about a second and a half.",
      notice: "The emitter follows C1, about 0.7 V below it.",
    },
    {
      id: "fix-bypass",
      prompt: "The timer never clicks. Fix it.",
      setup: JUMPER_BACK,
      // Bypassed first (the setup), then the follower alone feeding the coil, and a click.
      goal: (lab) => {
        if (bypassed(lab)) lab.memory["bypassed"] = true;
        return lab.memory["bypassed"] === true && !bypassed(lab) && follower(lab) && lab.isLit("D2");
      },
      hints: ["Is anything feeding the coil straight from C1?", "Q1 must carry the coil alone. Pull the yellow jumper."],
      highlight: ["wire:W6.b"],
      success: "Click. Q1 carries the coil again.",
    },
    {
      id: "impatient-restart",
      prompt: "Switch S1 off, then straight back on, without pressing reset.",
      goal: (lab) => {
        const last = lab.runs().at(-1);
        return !!last && (last.watch ?? 0) > 1.5 && last.seconds < 1.3;
      },
      hints: ["Be quick: off and straight back on.", "Don't press reset this time."],
      success: "Barely a wait: C1 was still full.",
      bonus: true,
    },
  ],
  solution: [
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 8.5 },
    { do: "check", task: "no-click" },
    { do: "unwire", wire: "W6" },
    { do: "place", part: "Q1", kind: "npn", at: "c20" },
    { do: "wait", seconds: 2 },
    { do: "check", task: "buffer-in" },
    { do: "flip", part: "S1", to: "a" },
    { do: "press", part: "S2", seconds: 0.6 },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 2.5 },
    { do: "check", task: "add-q1" },
    ...JUMPER_BACK,
    { do: "wait", seconds: 3 },
    { do: "unwire", wire: "W6" },
    { do: "wait", seconds: 2 },
    { do: "check", task: "fix-bypass" },
    // The secret: off and straight back on, with C1 still full.
    { do: "wait", seconds: 3 },
    { do: "flip", part: "S1", to: "a" },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "impatient-restart" },
  ],
});
