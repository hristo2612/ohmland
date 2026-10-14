// Blueprint: docs/curriculum/unit-4.md, CH11. A bench lesson (docs/LESSONS.md):
// content/units/chips/alarm/door-left-open. One idea: a trigger held low keeps a 555 on for as long as it is held; a
// capacitor in the line turns a held low into a short dip, so the timer ends on time. New: the reed switch.
//
// Half board and a door on the desk in front of it. The door's reed switch (closed while the magnet on the shut leaf
// is near) sits in the loop: plus, the reed, the sensor wire TL1, the loop strip (column 17), R1 10 kΩ to minus. Jumper
// W2 joins the loop to pin 2, which also has R2 100 kΩ up to plus. The 555 is CH2's one-shot as a "last chance"
// timer: R3 27 kΩ and C1 100 µF (its leakage set low, 50 MΩ, so the long delay is true), the yellow lamp on pin 3. The
// tray holds C2, 0.47 µF ("474"), to take W2's place.
//
// Measured in the simulator: door left open with W2, pin 2 sits at 0.85 V and the lamp never goes out; through C2,
// pin 2 dips to 0.85 V and climbs back past 3.1 V in about 16 ms, and the lamp lasts 3.0 s (1.1 × 27 kΩ × 100 µF is
// 2.97 s). Shutting the door pushes pin 2 briefly above the supply; the trigger ignores rising edges, unharmed.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { oneShotT } from "./lib/timer555";

const open = (lab: LabView, id: string) => lab.prop(id)?.["open"] === true;
const lit = (lab: LabView) => lab.isLit("D1");
const capIn = (lab: LabView) => lab.joins("C2", "c17", "U1.2") && !lab.connected("c17", "U1.2");

/** The fix-it bench: a window joins the door, its reed wired beside the door's (in parallel), so one shut hides the other. */
const SIDE_BY_SIDE: SolutionStep[] = [
  { do: "param", part: "DR1", params: { open: false } },
  { do: "place", part: "WN1", kind: "door", at: "desk:104,62", params: { style: "window", tag: "WINDOW" } },
  { do: "lead", id: "TL3", from: "WN1.a", to: "DR1.a", color: "red" },
  { do: "lead", id: "TL4", from: "WN1.b", to: "DR1.b", color: "yellow" },
];

export default defineLab({
  id: "door-left-open",
  title: "The door left open",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:30", "desk:142,8"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "DR1", kind: "door", at: "desk:104,-4", params: { open: false, style: "door", tag: "DOOR" }, locked: true, label: "Door with reed switch" },
      { id: "U1", kind: "chip", at: "e18", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R3", kind: "resistor", at: "h19-h24", params: { ohms: 27_000 }, locked: true, label: "27 kΩ resistor R3" },
      { id: "C1", kind: "electrolytic-cap", at: "j19-top-:20", params: { farads: 100e-6, volts: 16, leakOhms: 5e7, tolerance: 5 }, locked: true, label: "100 µF capacitor C1" },
      { id: "R2", kind: "resistor", at: "b19-rail+:19", params: { ohms: 100_000 }, locked: true, label: "100 kΩ pull-up R2" },
      { id: "R1", kind: "resistor", at: "b17-rail-:17", params: { ohms: 10_000 }, locked: true, label: "10 kΩ resistor R1" },
      { id: "R4", kind: "resistor", at: "b20-b24", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R4" },
      { id: "D1", kind: "led", at: "c24", params: { color: "yellow", maxmA: 20 }, locked: true, label: "Yellow LED" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a18", to: "rail-:19", color: "black" },
      { id: "W2", from: "d17", to: "d19", color: "yellow" },
      { id: "WA", from: "j18", to: "top+:19", color: "red" },
      { id: "W3", from: "a21", to: "rail+:21", color: "red" },
      { id: "W5", from: "a25", to: "rail-:25", color: "black" },
      { id: "W6", from: "g19", to: "g20", color: "yellow" },
      { id: "W9", from: "j24", to: "top+:25", color: "red" },
    ],
    leads: [
      { id: "TL0", from: "DR1.a", to: "rail+:29", color: "red" },
      { id: "TL1", from: "DR1.b", to: "a17", color: "yellow" },
    ],
    tray: [{ id: "C2", kind: "ceramic-cap", params: { farads: 0.47e-6 }, count: 1, label: "0.47 µF capacitor" }],
    instruments: [],
    watch: ["U1.3"],
  },
  mascot: {
    hint: "The capacitor goes between the loop and pin 2.",
    fried: "That shouldn't happen here. Fresh part in.",
  },
  // The 555 map so far (the notebook draws it on the signed-off page).
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7, 4, 5] }],
  tasks: [
    {
      id: "door-opens",
      prompt: "Open the door.",
      goal: (lab) => open(lab, "DR1") && lit(lab),
      hints: ["Click the door to swing it open."],
      highlight: ["DR1"],
      success: "The lamp lit.",
    },
    {
      id: "stuck-on",
      prompt: "Leave the door open and wait.",
      goal: (lab) => lab.heldFor(6, open(lab, "DR1") && lit(lab)),
      hints: ["Leave it open. Count to six."],
      nudges: [{ when: (lab) => !open(lab, "DR1"), say: "Leave it open this time." }],
      success: "Still lit. It never ends.",
    },
    {
      id: "door-shut",
      prompt: "Shut the door.",
      goal: (lab) => !open(lab, "DR1"),
      hints: ["Click the door to swing it shut."],
      highlight: ["DR1"],
      success: "Shut.",
    },
    {
      id: "cap-in",
      prompt: "Swap the yellow jumper for the 0.47 µF capacitor.",
      goal: (lab) => !open(lab, "DR1") && capIn(lab),
      hints: ["Take the yellow jumper out of the loop's strip and pin 2's.", "Put the 0.47 µF in its two holes."],
      highlight: ["wire:W2"],
      nudges: [{ when: (lab) => open(lab, "DR1"), say: "Shut the door first." }],
      success: "In line.",
    },
    {
      id: "dip-it",
      prompt: "Open the door again, and leave it open.",
      goal: (lab) => {
        if (!capIn(lab)) return false;
        // The last moment the door was seen shut: the opening comes after it (the bench may see the opening a frame
        // or two after the chip has already fired).
        if (!open(lab, "DR1")) {
          lab.memory["shutAt"] = lab.t;
          return false;
        }
        const at = lab.memory["shutAt"] as number | undefined;
        if (at === undefined) return false;
        // Lit after the opening, then out again while the door is still open, on time.
        const times = lab.edges("U1.3").times.filter(([t]) => t >= at - 0.05);
        const rise = times.find(([, d]) => d === 1)?.[0];
        const fall = times.find(([t, d]) => d === 0 && rise !== undefined && t > rise)?.[0];
        if (rise === undefined || fall === undefined) return false;
        const T = oneShotT(lab, "R3", "C1");
        return Math.abs(fall - rise - T) <= 0.15 * T && !lit(lab);
      },
      hints: ["Open it, then wait. Watch the lamp."],
      highlight: ["DR1"],
      success: "Out after three seconds, door still open.",
    },
    {
      id: "fix-window",
      prompt: "Make opening the window light the lamp too.",
      setup: SIDE_BY_SIDE,
      goal: (lab) => {
        const ch = lab.chain(["DR1", "WN1"]);
        const inSeries = !!ch && (lab.connected(ch.ends[0], "B1.pos") || lab.connected(ch.ends[1], "B1.pos")) && (lab.connected(ch.ends[0], "c17") || lab.connected(ch.ends[1], "c17"));
        if (!inSeries) lab.memory["brokeAt"] = lab.t;
        const at = lab.memory["brokeAt"] as number | undefined;
        if (at === undefined || !inSeries) return false;
        if (open(lab, "WN1") && !open(lab, "DR1") && lit(lab)) lab.memory["lit"] = true;
        return lab.memory["lit"] === true;
      },
      hints: ["Both switches must sit in one line.", "Plus to the door, the door to the window, the window to the loop."],
      highlight: ["TL3", "TL4"],
      success: "In series: any opening counts.",
    },
    {
      id: "cut-wire",
      prompt: "Shut the door, then unclip the sensor wire.",
      goal: (lab) => !open(lab, "DR1") && !lab.connected("DR1.b", "c17") && lab.heldFor(0.5, lit(lab)),
      hints: ["Drag the yellow clip lead's clip off the board."],
      success: "A cut wire counts as an open door.",
      bonus: true,
    },
  ],
  solution: [
    { do: "param", part: "DR1", params: { open: true } },
    { do: "wait", seconds: 1 },
    { do: "check", task: "door-opens" },
    { do: "wait", seconds: 6.5 },
    { do: "check", task: "stuck-on" },
    { do: "param", part: "DR1", params: { open: false } },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "door-shut" },
    { do: "unwire", wire: "W2" },
    { do: "place", part: "C2", kind: "ceramic-cap", at: "d17-d19", params: { farads: 0.47e-6 } },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "cap-in" },
    { do: "param", part: "DR1", params: { open: true } },
    { do: "wait", seconds: 4 },
    { do: "check", task: "dip-it" },
    ...SIDE_BY_SIDE,
    { do: "wait", seconds: 3.5 },
    // In series: plus, the door, the window, the loop.
    { do: "clip", lead: "TL1", end: "b", to: null },
    { do: "clip", lead: "TL3", end: "b", to: "DR1.b" },
    { do: "clip", lead: "TL4", end: "b", to: "a17" },
    { do: "wait", seconds: 1 },
    { do: "param", part: "WN1", params: { open: true } },
    { do: "wait", seconds: 1 },
    { do: "check", task: "fix-window" },
    { do: "param", part: "WN1", params: { open: false } },
    { do: "wait", seconds: 3.5 },
    { do: "clip", lead: "TL4", end: "b", to: null },
    { do: "wait", seconds: 1 },
    { do: "check", task: "cut-wire" },
  ],
});
