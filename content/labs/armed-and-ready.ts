// Blueprint: docs/curriculum/unit-4.md, CH12. A bench lesson (docs/LESSONS.md):
// content/units/chips/alarm/armed-and-ready. One idea: timers in a chain: when one timer's glow ends, its falling edge,
// passed on by a capacitor, starts the next. Nothing new: every part is known; the lesson is the chain.
//
// Full board, the door on the desk to its left (its terminal block toward the board), the battery to its right. Three
// 555s, left to right:
// - U1, the exit delay (columns 10 to 13): GO (S1) dips pin 2 against 10 kΩ; 82 kΩ and 100 µF (time to walk to the
//   door, or on a phone to pan to it); the green lamp on pin
//   3. A 1N4148 (D9) runs from U1's pin 3 to U2's pin 2 (band toward U2): while green is on it holds U2's trigger high.
// - U2, the last chance (columns 28 to 31): the door's loop (plus, the reed, the sensor wire TL1, column 22, 10 kΩ to
//   minus) reaches pin 2 through C2, 0.47 µF, against a 100 kΩ pull-up (CH11's fix); 27 kΩ and 100 µF; the yellow
//   lamp on pin 3. C5, 0.47 µF, runs from pin 3 to column 33, where 100 kΩ keeps it charged; the green wire WT starts
//   there, its far end parked in an empty strip. The learner runs it on to U3's pin 2: the link. (Placing the
//   capacitor itself last would dip U3's pin 2 as the empty capacitor went in, and set off the alarm.)
// - U3, the alarm latch (columns 45 to 48): pin 6 on minus (CH6's latch); pin 2 pulled up by 100 kΩ; pin 4 pulled up
//   by 10 kΩ, with DISARM (S2) to minus and 10 µF to minus (the latch wakes cleared). Pin 3 feeds the voice module's
//   EN (VM1, CH8's singer on a plug-in board), which drives the speaker.
// The tray holds a 270 kΩ for the secret. Both timing capacitors' leakage is set low (50 MΩ), so a long delay stays
// true. U1 and U2 may flash once at switch-on (a 555's latch wakes at random): the lab settles 5 s unseen, and the
// goals count from GO.
//
// Measured in the simulator: green 8.8 s (1.1 × 82 kΩ × 100 µF is 9.0 s), yellow 2.9 s (1.1 × 27 kΩ × 100 µF is
// 2.97 s); with green on, D9 holds U2's pin 2 near 7.4 V and an opening does nothing; U2's falling edge dips U3's pin 2
// to about 1.4 V for some 11 ms, which sets the latch; the module sings near 440 Hz until DISARM. With 270 kΩ yellow
// lasts 29.6 s.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { oneShotT } from "./lib/timer555";

const open = (lab: LabView) => lab.prop("DR1")?.["open"] === true;
const lit = (lab: LabView, id: string) => lab.isLit(id);
/** The alarm is on: the latch's output high, so the module sings. */
const alarm = (lab: LabView) => lab.part("U3")?.extra?.["output"] === "high";
const linked = (lab: LabView) => lab.joins("C5", "U2.3", "U3.2");
/** The rising and falling edges of a 555's output, watched. */
const edges = (lab: LabView, pin: string, since: number) => lab.edges(pin).times.filter(([t]) => t >= since);

/** The fix-it bench: DISARM's jumper slipped from pin 4's strip into pin 2's: pressing it sets the alarm. */
const DISARM_ON_PIN2: SolutionStep[] = [
  { do: "unwire", wire: "WD" },
  { do: "wire", id: "WD", from: "d50", to: "c46", color: "yellow" },
];

export default defineLab({
  id: "armed-and-ready",
  title: "Exit, wait, alarm",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "full",
    frame: ["top+:1", "rail-:63", "desk:-186,0", "desk:128,88"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:114,-6", holes: { pos: "rail+:63", neg: "rail-:63" }, params: { emf: 9.4, internalOhms: 1.7, mAh: 500, snap: true }, locked: true, label: "9 V battery" },
      { id: "DR1", kind: "door", at: "desk:-148,-4", params: { open: false, style: "door", side: "right", tag: "DOOR" }, locked: true, label: "Door with reed switch" },
      // U1: the exit delay.
      { id: "U1", kind: "chip", at: "e10", params: { model: "555" }, locked: true, label: "555 exit delay U1" },
      { id: "S1", kind: "pushbutton", at: "e6", params: { cap: "black" }, locked: true, label: "GO button S1" },
      { id: "R11", kind: "resistor", at: "b11-rail+:11", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up" },
      { id: "R12", kind: "resistor", at: "h11-h16", params: { ohms: 82_000 }, locked: true, label: "82 kΩ resistor R12" },
      { id: "C11", kind: "electrolytic-cap", at: "j11-top-:12", params: { farads: 100e-6, volts: 16, leakOhms: 5e7, tolerance: 5 }, locked: true, label: "100 µF capacitor C11" },
      { id: "R13", kind: "resistor", at: "b12-b16", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "c16", params: { color: "green", maxmA: 20 }, locked: true, label: "Green LED" },
      { id: "D9", kind: "diode", at: "d12-d19", params: { model: "1N4148" }, locked: true, label: "1N4148 diode D9" },
      // U2: the last chance.
      { id: "U2", kind: "chip", at: "e28", params: { model: "555" }, locked: true, label: "555 last chance U2" },
      { id: "R21", kind: "resistor", at: "b29-rail+:29", params: { ohms: 100_000 }, locked: true, label: "100 kΩ pull-up" },
      { id: "R22", kind: "resistor", at: "h29-h34", params: { ohms: 27_000 }, label: "27 kΩ resistor R22" },
      { id: "C21", kind: "electrolytic-cap", at: "j29-top-:30", params: { farads: 100e-6, volts: 16, leakOhms: 5e7, tolerance: 5 }, locked: true, label: "100 µF capacitor C21" },
      { id: "R23", kind: "resistor", at: "c30-c35", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor" },
      { id: "D2", kind: "led", at: "d35", params: { color: "yellow", maxmA: 20 }, locked: true, label: "Yellow LED" },
      { id: "C5", kind: "ceramic-cap", at: "d30-d33", params: { farads: 0.47e-6 }, locked: true, label: "0.47 µF capacitor C5" },
      { id: "R32", kind: "resistor", at: "b33-rail+:33", params: { ohms: 100_000 }, locked: true, label: "100 kΩ resistor" },
      { id: "R1", kind: "resistor", at: "a22-rail-:22", params: { ohms: 10_000 }, locked: true, label: "10 kΩ loop resistor" },
      { id: "C2", kind: "ceramic-cap", at: "d22-d29", params: { farads: 0.47e-6 }, locked: true, label: "0.47 µF capacitor C2" },
      // U3: the alarm latch, and the voice module.
      { id: "U3", kind: "chip", at: "e45", params: { model: "555" }, locked: true, label: "555 alarm latch U3" },
      { id: "R31", kind: "resistor", at: "b46-rail+:46", params: { ohms: 100_000 }, locked: true, label: "100 kΩ pull-up" },
      { id: "R34", kind: "resistor", at: "b48-rail+:48", params: { ohms: 10_000 }, locked: true, label: "10 kΩ reset pull-up" },
      { id: "C34", kind: "electrolytic-cap", at: "a48-rail-:49", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor" },
      { id: "S2", kind: "pushbutton", at: "e50", params: { cap: "red" }, locked: true, label: "DISARM button S2" },
      { id: "VM1", kind: "plug-module", at: "e57", params: { model: "voice" }, locked: true, label: "Voice module VM1" },
      { id: "SP1", kind: "speaker", at: "desk:98,64", holes: { a: "b59", b: "rail-:61" }, params: { ohms: 8 }, locked: true, label: "Speaker" },
    ],
    wires: [
      { id: "WP", from: "top+:4", to: "rail+:4", color: "red" },
      { id: "WN", from: "top-:5", to: "rail-:5", color: "black" },
      // U1.
      { id: "W11", from: "a10", to: "rail-:10", color: "black" },
      { id: "W18", from: "j10", to: "top+:10", color: "red" },
      { id: "W14", from: "a13", to: "rail+:13", color: "red" },
      { id: "W16", from: "g11", to: "g12", color: "yellow" },
      { id: "W1R", from: "j16", to: "top+:16", color: "red" },
      { id: "WG", from: "d8", to: "d11", color: "yellow" },
      { id: "WGN", from: "a6", to: "rail-:6", color: "black" },
      { id: "W1L", from: "a17", to: "rail-:17", color: "black" },
      { id: "W9", from: "c19", to: "c29", color: "orange" },
      // U2.
      { id: "W21", from: "a28", to: "rail-:28", color: "black" },
      { id: "W28", from: "j28", to: "top+:28", color: "red" },
      { id: "W24", from: "a31", to: "rail+:31", color: "red" },
      { id: "W26", from: "g29", to: "g30", color: "yellow" },
      { id: "W2R", from: "j34", to: "top+:34", color: "red" },
      { id: "W2L", from: "a36", to: "rail-:36", color: "black" },
      // The link: from C5's column, its far end parked in an empty strip until the learner runs it to U3's pin 2.
      { id: "WT", from: "a33", to: "a40", color: "green" },
      { id: "W31", from: "a45", to: "rail-:45", color: "black" },
      { id: "W38", from: "j45", to: "top+:45", color: "red" },
      { id: "W36", from: "j47", to: "top-:47", color: "black" },
      { id: "WD", from: "d50", to: "d48", color: "yellow" },
      { id: "WDN", from: "a52", to: "rail-:52", color: "black" },
      { id: "WE", from: "c47", to: "c58", color: "orange" },
      { id: "WMV", from: "a57", to: "rail+:57", color: "red" },
      { id: "WMG", from: "a60", to: "rail-:60", color: "black" },
    ],
    leads: [
      { id: "TL0", from: "DR1.a", to: "rail+:23", color: "red" },
      { id: "TL1", from: "DR1.b", to: "b22", color: "yellow" },
    ],
    tray: [{ id: "R29", kind: "resistor", params: { ohms: 270_000 }, count: 1, label: "270 kΩ resistor" }],
    instruments: [],
    watch: ["U1.3", "U2.3", "U3.3"],
  },
  mascot: {
    hint: "Find where yellow ends. Something must carry that moment.",
    fried: "Loud, but that shouldn't break. Fresh part in.",
  },
  // The 555 map so far (the notebook draws it on the signed-off page).
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7, 4, 5] }],
  tasks: [
    {
      id: "exit-delay",
      prompt: "Press GO, then open the door while the green lamp is on.",
      goal: (lab) => {
        if (lab.closed("S1")) lab.memory["go"] = true;
        if (lab.memory["go"] === true && lit(lab, "D2")) lab.memory["yellow"] = true;
        if (lab.memory["go"] === true && open(lab) && lit(lab, "D1")) lab.memory["opened"] = true;
        return lab.memory["opened"] === true && lab.memory["yellow"] !== true && !lit(lab, "D1") && !lit(lab, "D2");
      },
      hints: ["Tap GO, the black button. Then open the door at once.", "Wait for the green lamp to go out."],
      highlight: ["S1", "part:DR1/leaf"],
      success: "Green ended. Yellow never woke.",
    },
    {
      id: "silent-end",
      prompt: "Shut the door. Open it again now that green is off.",
      goal: (lab) => {
        const since = (lab.memory["since"] ??= lab.t) as number;
        const e = edges(lab, "U2.3", since);
        const fall = e.find(([, d]) => d === 0)?.[0];
        return fall !== undefined && lab.t - fall >= 2 && !alarm(lab);
      },
      hints: ["Shut it, then open it.", "Watch the yellow lamp. Then listen."],
      highlight: ["part:DR1/leaf"],
      success: "Yellow ended. Silence.",
    },
    {
      id: "link-it",
      prompt: "Run the green wire on to the alarm's pin 2.",
      goal: (lab) => linked(lab),
      hints: ["Drag the green wire's loose end to the alarm chip.", "Pin 2 is the second along its near row."],
      highlight: ["wire:WT", "hole:a46"],
      success: "Linked.",
    },
    {
      id: "alarm",
      prompt: "Shut the door, then open it.",
      goal: (lab) => {
        // Yellow's end and the alarm's start at the same moment (a little grace for a door opened mid-sentence).
        const since = ((lab.memory["since"] ??= lab.t) as number) - 3;
        const falls = edges(lab, "U2.3", since).filter(([, d]) => d === 0);
        const rises = edges(lab, "U3.3", since).filter(([, d]) => d === 1);
        return linked(lab) && alarm(lab) && rises.some(([r]) => falls.some(([f]) => Math.abs(r - f) <= 0.2));
      },
      hints: ["Shut, open, then wait for yellow to end."],
      highlight: ["part:DR1/leaf"],
      success: "The alarm sings!",
    },
    {
      id: "disarm",
      prompt: "Press DISARM.",
      goal: (lab) => {
        if (lab.closed("S2")) lab.memory["pressed"] = true;
        return lab.memory["pressed"] === true && !open(lab) && lab.heldFor(1, !alarm(lab));
      },
      hints: ["Shut the door. Then tap DISARM, the red button."],
      highlight: ["S2"],
      nudges: [{ when: (lab) => open(lab), say: "Shut the door first." }],
      success: "Silence.",
    },
    {
      id: "fix-disarm",
      prompt: "Make DISARM stop the alarm again.",
      setup: DISARM_ON_PIN2,
      goal: (lab) => {
        const onPin4 = lab.connected("S2.b1", "U3.4") || lab.connected("S2.a1", "U3.4");
        if (!onPin4) lab.memory["broken"] = true;
        if (lab.memory["broken"] !== true || !onPin4) return false;
        if (lab.closed("S2")) lab.memory["pressed"] = true;
        return lab.memory["pressed"] === true && lab.heldFor(1.5, !lab.closed("S2") && !alarm(lab));
      },
      hints: ["Pin 4 clears. Which strip did DISARM's wire land in?", "Move the yellow wire's end back to pin 4's strip. Then press DISARM."],
      highlight: ["wire:WD"],
      success: "DISARM clears it again. Reset is pin 4.",
    },
    {
      id: "live-delays",
      prompt: "Drop the 270 kΩ onto yellow's 27 kΩ, then time the yellow lamp.",
      goal: (lab) => {
        if (!lab.joins("R29", "U2.7", "top+:34")) return false;
        const since = ((lab.memory["since"] ??= lab.t) as number) - 3;
        const e = edges(lab, "U2.3", since);
        const rise = e.find(([, d]) => d === 1)?.[0];
        const fall = e.find(([t, d]) => d === 0 && rise !== undefined && t > rise)?.[0];
        if (rise === undefined || fall === undefined) return false;
        const T = oneShotT(lab, "R29", "C21");
        return Math.abs(fall - rise - T) <= 0.15 * T;
      },
      hints: ["Swap it in, then shut and open the door. Wait for yellow."],
      success: "Thirty seconds: 270 kΩ × 100 µF.",
      bonus: true,
    },
  ],
  solution: [
    { do: "wait", seconds: 3.6 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "param", part: "DR1", params: { open: true } },
    { do: "wait", seconds: 9.5 },
    { do: "check", task: "exit-delay" },
    { do: "param", part: "DR1", params: { open: false } },
    { do: "wait", seconds: 0.5 },
    { do: "param", part: "DR1", params: { open: true } },
    { do: "wait", seconds: 5.5 },
    { do: "check", task: "silent-end" },
    { do: "unwire", wire: "WT" },
    { do: "wire", id: "WT", from: "a33", to: "a46", color: "green" },
    { do: "check", task: "link-it" },
    // From a fresh bench ("Show me") with the door open, the chain has already run and the alarm sings: clear it.
    { do: "param", part: "DR1", params: { open: false } },
    { do: "press", part: "S2", seconds: 0.2 },
    { do: "wait", seconds: 1 },
    { do: "wait", seconds: 0.5 },
    { do: "param", part: "DR1", params: { open: true } },
    { do: "wait", seconds: 3.6 },
    { do: "check", task: "alarm" },
    { do: "param", part: "DR1", params: { open: false } },
    { do: "press", part: "S2", seconds: 0.2 },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "disarm" },
    ...DISARM_ON_PIN2,
    { do: "wait", seconds: 3.6 },
    { do: "press", part: "S2", seconds: 0.2 },
    { do: "wait", seconds: 0.5 },
    { do: "unwire", wire: "WD" },
    { do: "wire", id: "WD", from: "d50", to: "d48", color: "yellow" },
    { do: "press", part: "S2", seconds: 0.2 },
    { do: "wait", seconds: 2 },
    { do: "check", task: "fix-disarm" },
    { do: "place", part: "R29", kind: "resistor", at: "on:R22", params: { ohms: 270_000 } },
    { do: "param", part: "DR1", params: { open: true } },
    { do: "wait", seconds: 32 },
    { do: "check", task: "live-delays" },
  ],
});
