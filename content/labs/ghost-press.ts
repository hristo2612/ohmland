// Blueprint: docs/curriculum/unit-4.md, CH3. A bench lesson (docs/LESSONS.md):
// content/units/chips/timer-555/ghost-press. One idea: an input joined to nothing floats and picks up hum; a pull-up
// resistor holds it high until the button pulls it low. New: the word "pull-up".
//
// CH2's one-shot (content/labs/one-shot.ts has the layout), with the 10 kΩ pull-up R2 free to lift out. A hand slider
// brings an ink hand toward the chip (the simulator's `proximity`: a floating input follows 50 Hz mains hum). The scope
// watches pin 2 against a dashed line at a third of the supply. The tray holds a spare 10 kΩ (in case the pull-up is
// deleted) and R5, 1 MΩ, for the secret.
//
// Measured in the simulator: pin 2 floating with the hand close swings across the whole supply and keeps the lamp lit;
// with 10 kΩ (or even 1 MΩ) to plus it sits at 9.4 V, hand or no hand. Pulled to minus instead (the fix-it), the
// trigger never lets go and the lamp never goes out.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { cleanRun, oneShotT, runNear, runsSince } from "./lib/timer555";

/** A resistor from the tray or the bench sits between pin 2 and plus. */
const pullUp = (lab: LabView, id: string) => lab.joins(id, "U1.2", "B1.pos");
const anyPull = (lab: LabView) => ["R2", "R5", "R6"].some((id) => lab.joins(id, "U1.2", "B1.pos") || lab.joins(id, "U1.2", "B1.neg"));
const hand = (lab: LabView) => lab.control("hand") ?? 0;
const dark = (lab: LabView) => (lab.part("D1")?.glow ?? 1) < 0.05;

/** The fix-it bench: the pull-up's lower end moved from the plus rail to the minus rail, so pin 2 is held low. */
const PULL_DOWN: SolutionStep[] = [{ do: "move", part: "R2", at: "b15-rail-:15" }];

export default defineLab({
  id: "ghost-press",
  title: "The ghost press",
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
      { id: "R2", kind: "resistor", at: "b15-rail+:15", params: { ohms: 10_000 }, label: "10 kΩ pull-up R2" },
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
      { id: "W6", from: "g15", to: "g16", color: "yellow" },
      { id: "W9", from: "j20", to: "top+:20", color: "red" },
      { id: "W7", from: "d12", to: "d15", color: "yellow" },
      { id: "W8", from: "a10", to: "rail-:10", color: "black" },
    ],
    tray: [
      { id: "R6", kind: "resistor", params: { ohms: 10_000 }, count: 1, label: "10 kΩ resistor" },
      { id: "R5", kind: "resistor", params: { ohms: 1_000_000 }, count: 1, label: "1 MΩ resistor" },
    ],
    instruments: [
      { kind: "scope", traces: [{ label: "Pin 2", volts: "U1.2" }], levels: [{ of: "U1.8", fraction: 1 / 3, label: "1/3" }], window: 2, range: [0, 10] },
      { kind: "stopwatch", start: { part: "S1", pressed: true }, stop: { part: "D1", lit: false }, watch: "U1.6" },
    ],
    controls: [{ id: "hand", label: "Hand", key: "proximity", part: "U1", min: 0, max: 1, value: 0, step: 0.01, unit: "%" }],
  },
  mascot: {
    hint: "A pin needs something holding it. Plus, through a resistor.",
    fried: "Nothing should break here. Fresh part in.",
  },
  // The 555 map so far (the notebook draws it on the signed-off page).
  panels: [{ kind: "xray", id: "xray", part: "U1", pins: [1, 8, 2, 3] }],
  tasks: [
    {
      id: "ghost",
      prompt: "Lift the 10 kΩ off pin 2, then bring your hand close to the chip.",
      goal: (lab) => !anyPull(lab) && hand(lab) >= 0.5 && lab.presses("S1", 4).length === 0 && lab.timeAbove("glow:D1", 0.3, 4) > 0.2,
      hints: ["Drag the 10 kΩ by pin 2 off the board, onto the desk.", "Then slide the hand right up to the chip."],
      highlight: ["R2"],
      nudges: [{ when: (lab) => !anyPull(lab) && hand(lab) < 0.3, say: "Now bring your hand close." }],
      success: "It lit with nobody pressing!",
    },
    {
      id: "hum",
      prompt: "Watch pin 2 on the scope.",
      goal: (lab) => !anyPull(lab) && (lab.stats("volts:U1.2", 2)?.span ?? 0) >= 3,
      hints: ["Keep your hand close. Watch the trace jump across the line."],
      nudges: [{ when: (lab) => hand(lab) < 0.3, say: "Bring your hand back close." }],
      success: "It wanders across the line with every wave of hum.",
    },
    {
      id: "pull-up-back",
      prompt: "Put the 10 kΩ back, from pin 2's strip to the plus rail. Keep your hand close.",
      goal: (lab) => (pullUp(lab, "R2") || pullUp(lab, "R6")) && lab.heldFor(3, hand(lab) >= 0.5 && dark(lab)),
      hints: ["One leg in pin 2's strip, one in the plus rail.", "Keep the hand close: the lamp should stay dark."],
      highlight: ["hole:b15", "hole:rail+:15"],
      nudges: [{ when: (lab) => lab.joins("R2", "U1.2", "B1.neg") || lab.joins("R6", "U1.2", "B1.neg"), say: "That's the minus rail. A pull-up reaches plus." }],
      success: "Flat at 9.4 V. The ghost is gone.",
    },
    {
      id: "clean-tap",
      prompt: "Now press the button.",
      goal: (lab) => {
        const since = (lab.memory["since"] ??= lab.t) as number;
        const run = cleanRun(lab);
        return !!run && run.start >= since && runNear(lab, oneShotT(lab, "R1", "C1"), 0.08, run);
      },
      hints: ["Tap the red button once."],
      highlight: ["S1"],
      success: "One clean glow.",
    },
    {
      id: "fix-pull-up",
      prompt: "Make the lamp go out, and light only when pressed.",
      setup: PULL_DOWN,
      goal: (lab) => {
        if (!pullUp(lab, "R2") && !pullUp(lab, "R6")) lab.memory["brokeAt"] = lab.t;
        const at = lab.memory["brokeAt"] as number | undefined;
        return at !== undefined && (pullUp(lab, "R2") || pullUp(lab, "R6")) && runsSince(lab, at).some((r) => r.seconds > 1 && (r.watch ?? 0) < 0.5);
      },
      hints: ["Which rail should a pull-up reach?", "Move R2's lower leg to the plus rail, then tap the button."],
      highlight: ["R2"],
      success: "Dark until pressed. A pull-up goes to plus.",
    },
    {
      id: "weak-pull",
      prompt: "Swap the 1 MΩ in for the 10 kΩ, then bring your hand close.",
      goal: (lab) => pullUp(lab, "R5") && !pullUp(lab, "R2") && !pullUp(lab, "R6") && lab.heldFor(3, hand(lab) >= 0.8 && dark(lab)),
      hints: ["Lift the 10 kΩ out and put the 1 MΩ in its holes."],
      success: "Still steady. Even a weak pull beats the hum.",
      bonus: true,
    },
  ],
  solution: [
    { do: "wait", seconds: 3.2 },
    { do: "move", part: "R2", at: "desk:30,46" },
    { do: "control", id: "hand", value: 0.9 },
    { do: "wait", seconds: 2 },
    { do: "check", task: "ghost" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "hum" },
    { do: "move", part: "R2", at: "b15-rail+:15" },
    { do: "wait", seconds: 6.5 },
    { do: "check", task: "pull-up-back" },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.6 },
    { do: "check", task: "clean-tap" },
    ...PULL_DOWN,
    { do: "wait", seconds: 2 },
    { do: "move", part: "R2", at: "b15-rail+:15" },
    { do: "wait", seconds: 3.5 },
    { do: "press", part: "S1", seconds: 0.2 },
    { do: "wait", seconds: 3.6 },
    { do: "check", task: "fix-pull-up" },
    { do: "move", part: "R2", at: "desk:30,46" },
    { do: "place", part: "R5", kind: "resistor", at: "b15-rail+:15", params: { ohms: 1_000_000 } },
    { do: "control", id: "hand", value: 0.9 },
    { do: "wait", seconds: 6.5 },
    { do: "check", task: "weak-pull" },
  ],
});
