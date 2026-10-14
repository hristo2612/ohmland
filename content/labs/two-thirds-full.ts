// Blueprint: docs/curriculum/unit-4.md, CH4. A bench lesson (docs/LESSONS.md):
// content/units/chips/timer-555/two-thirds-full. One idea: the glow ends when the timing capacitor fills to two thirds
// of the supply: pin 6 watches the climb and pin 7 empties the capacitor. New: pin 6 (threshold) and pin 7 (discharge).
//
// CH2's one-shot (content/labs/one-shot.ts has the layout). The scope shows the capacitor (pin 6) and the output (pin
// 3) over 6 s, with dashed lines at a third and two thirds of pin 8. The x-ray adds the high watcher and the drain.
//
// Measured in the simulator: the capacitor climbs from 0 to 6.27 V (two thirds of 9.4 V) in 3.07 s, then pin 7's drain
// switch empties it at once and pin 3 falls. Held low through the whole climb (the secret), the trigger beats the
// threshold: the output stays high until the button is let go. In the fix-it, pin 6's jumper runs to the minus rail,
// so the capacitor climbs toward 9.4 V that pin 6 never sees, and the glow never ends.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { cleanRun, oneShotT, runNear, runsSince } from "./lib/timer555";

const T = (lab: LabView) => oneShotT(lab, "R1", "C1");

/** The fix-it bench: the jumper from pin 6 runs to the minus rail instead of to pin 7 and the capacitor. */
const PIN6_TO_MINUS: SolutionStep[] = [
  { do: "unwire", wire: "W6" },
  { do: "wire", id: "W6", from: "g16", to: "top-:17", color: "yellow" },
];

export default defineLab({
  id: "two-thirds-full",
  title: "Two thirds full",
  // A 555 wakes with its latch at random: let a power-up glow end unseen.
  settle: 5,
  bench: {
    board: "half",
    frame: ["top+:1", "rail-:29"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "U1", kind: "chip", at: "e14", params: { model: "555" }, locked: true, label: "555 timer" },
      { id: "R1", kind: "resistor", at: "h15-h20", params: { ohms: 270_000 }, locked: true, label: "270 kΩ resistor R1" },
      { id: "C1", kind: "electrolytic-cap", at: "j15-top-:16", params: { farads: 10e-6, volts: 16 }, locked: true, label: "10 µF capacitor C1" },
      { id: "R2", kind: "resistor", at: "b15-rail+:15", params: { ohms: 10_000 }, locked: true, label: "10 kΩ pull-up R2" },
      { id: "S1", kind: "pushbutton", at: "e10", params: { cap: "red" }, locked: true, label: "Button S1" },
      { id: "R3", kind: "resistor", at: "b16-b20", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D1", kind: "led", at: "c20", params: { color: "red", maxmA: 20 }, locked: true, label: "Red LED" },
    ],
    wires: [
      { id: "WP", from: "top+:2", to: "rail+:2", color: "red" },
      { id: "WN", from: "top-:3", to: "rail-:3", color: "black" },
      { id: "W1", from: "a14", to: "rail-:14", color: "black" },
      { id: "W2", from: "j14", to: "top+:14", color: "red" },
      { id: "W3", from: "a17", to: "rail+:17", color: "red" },
      { id: "W5", from: "a21", to: "rail-:21", color: "black" },
      { id: "W6", from: "g16", to: "g15", color: "yellow" },
      { id: "W9", from: "j20", to: "top+:20", color: "red" },
      { id: "W7", from: "d12", to: "d15", color: "yellow" },
      { id: "W8", from: "a10", to: "rail-:10", color: "black" },
    ],
    tray: [],
    instruments: [
      {
        kind: "scope",
        traces: [
          { label: "Pin 6", volts: "U1.6" },
          { label: "Pin 3", volts: "U1.3" },
        ],
        levels: [
          { of: "U1.8", fraction: 1 / 3, label: "1/3" },
          { of: "U1.8", fraction: 2 / 3, label: "2/3" },
        ],
        window: 6,
        range: [0, 10],
      },
      { kind: "stopwatch", start: { part: "S1", pressed: true }, stop: { part: "D1", lit: false }, watch: "U1.6" },
    ],
  },
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3, 6, 7] }],
  mascot: {
    hint: "Follow pin 6's trace up to the top dashed line.",
    fried: "That shouldn't happen here. Fresh chip in.",
  },
  tasks: [
    {
      id: "watch-climb",
      prompt: "Tap the button and watch the scope.",
      goal: (lab) => {
        const s = lab.stats("volts:U1.6", 6);
        return !!s && s.max >= 6.0 && s.max <= 6.6 && (lab.volts("U1.6") ?? 9) < 0.3 && !!cleanRun(lab);
      },
      hints: ["Tap the red button, then watch the first trace climb.", "It climbs, then drops to zero all at once."],
      highlight: ["S1"],
      success: "It climbed to two thirds, then emptied at once.",
    },
    {
      id: "xray-threshold",
      prompt: "Look inside, then tap once more.",
      // The watcher fires for an instant (the drain empties the capacitor at once), so the goal asks for a whole glow
      // watched through the x-ray: high, then ended at the 2/3 line.
      goal: (lab) => {
        if (!lab.view("xray:U1")) return false;
        const out = lab.part("U1")?.extra?.["output"];
        if (out === "high" && (lab.volts("U1.6") ?? 0) < 1) lab.memory["climbing"] = true;
        return lab.memory["climbing"] === true && out === "low" && (lab.stats("volts:U1.6", 1)?.max ?? 0) >= 5.8;
      },
      hints: ["Open the x-ray first, then tap.", "Watch the top watcher as the climb meets its line."],
      highlight: ["S1"],
      success: "Pin 6's watcher fired at the 2/3 line.",
    },
    {
      id: "xray-discharge",
      prompt: "Watch what pin 7 does next.",
      // The x-ray panel closes as the beat changes, so this asks what it saw while it was open (its cells keep it).
      goal: (lab) => lab.panel("xray").cells["discharge"] === true && (lab.volts("U1.6") ?? 9) < 0.2,
      hints: ["Open the x-ray and tap again: watch the drain switch."],
      success: "The drain switch closed and emptied it.",
    },
    {
      id: "fix-pin6",
      prompt: "Make the glow end on time again.",
      setup: PIN6_TO_MINUS,
      goal: (lab) => {
        if (!lab.connected("U1.6", "C1.pos")) lab.memory["brokeAt"] = lab.t;
        const at = lab.memory["brokeAt"] as number | undefined;
        if (at === undefined || !lab.connected("U1.6", "C1.pos")) return false;
        return runsSince(lab, at).some((r) => (r.watch ?? 0) < 0.5 && runNear(lab, T(lab), 0.08, r));
      },
      hints: ["Which pin watches the capacitor?", "Move the yellow jumper's end from the minus rail to pin 7's strip, then tap."],
      highlight: ["W6"],
      success: "Three seconds. Pin 6 must see the capacitor.",
    },
    {
      id: "hold-to-stretch",
      prompt: "Hold the button through the whole climb.",
      goal: (lab) => {
        const ex = lab.part("U1")?.extra;
        if (ex?.["trigger"] === true && ex?.["threshold"] === true) lab.memory["both"] = true;
        return lab.memory["both"] === true && lab.presses("S1", 10).some((p) => p.end !== null && p.end - p.start >= 4) && lab.runs().some((r) => r.seconds >= 4);
      },
      hints: ["Hold the button down for five seconds, then let go."],
      success: "A held trigger beats the threshold.",
      bonus: true,
    },
  ],
  solution: [
    { do: "wait", seconds: 3.2 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "watch-climb" },
    { do: "view", name: "xray:U1", on: true },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.3 },
    { do: "check", task: "xray-threshold" },
    { do: "check", task: "xray-discharge" },
    { do: "press", part: "S1", seconds: 5 },
    { do: "wait", seconds: 1 },
    { do: "check", task: "hold-to-stretch" },
    ...PIN6_TO_MINUS,
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 2 },
    { do: "unwire", wire: "W6" },
    { do: "wire", id: "W6", from: "g16", to: "g15", color: "yellow" },
    { do: "wait", seconds: 3.5 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "fix-pin6" },
  ],
});
