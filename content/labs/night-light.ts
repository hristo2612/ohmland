// Blueprint: docs/curriculum/unit-2.md, Lesson 16; docs/curriculum/conversion-guide.md, 16 (trimmed).
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/blink-and-beep/night-light.
// One idea: a light sensor that steals a transistor's base flow makes a lamp that lights in the dark.
//
// The desk lamp slider sets the light on every phototransistor. Station A (rows 5 to 11): PT1 from the + rail (row 6,
// collector) to row 5, R1 (1 kΩ) to the red LED. Station B (rows 28 to 37): Q1 in rows 30 to 32 switches the yellow
// lamp D2 (R2 470 Ω from the rail). Its base (row 31) is fed from the far + rail through R3 (4.7 kΩ) and trimmer P1
// (on the far half, wiper in far row 30, which the yellow jumper W5 joins to the base row). The learner plugs PT2 in
// rows 30 and 31: emitter on Q1's grounded emitter row, collector on the base row, so light steals the base current.
// The trimmer starts near its stop (90%), so the lamp only wakes in near darkness; the fix-it round sets dusk.
//
// Measured in the simulator: D1 glows 0.15 at light 0.1 and 0.5 in full light (dark at 0). With PT2 in, the lamp
// switches off near light 0.07 with the trimmer at 90%, near 0.13 at 50% and near 0.23 at 25% (on at 0.18, off at
// 0.25 and above). PT2 in backwards barely conducts, so the lamp stays on in any light.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const light = (lab: LabView) => lab.control("lamp") ?? 0.3;
const glow = (lab: LabView, id: string) => lab.part(id)?.glow ?? 0;
const trim = (lab: LabView) => Number(lab.prop("P1")?.["position"] ?? 0.9);
/** PT2 across Q1's base and emitter, collector on the base. */
const pt2In = (lab: LabView) => lab.joins("PT2", "Q1.e", "Q1.b", "forward");
const pt2Backwards = (lab: LabView) => !!lab.benchPart("PT2") && lab.joins("PT2", "Q1.b", "Q1.e", "forward");

/** Remembers an LED's glow once the lamp has stayed at a level (within `tol`) for a moment; keyed by the trimmer too. */
function at(lab: LabView, key: string, level: number, tol: number, id: string): number | undefined {
  const m = lab.memory as Record<string, { trim: number; glow: number } | undefined>;
  if (lab.heldFor(0.4, Math.abs(light(lab) - level) <= tol, key)) m[key] = { trim: trim(lab), glow: glow(lab, id) };
  const r = m[key];
  return r && Math.abs(r.trim - trim(lab)) < 0.005 ? r.glow : undefined;
}

/** The fix-it bench: the trimmer back near its stop, so the lamp only wakes in pitch dark. */
const LATE_DUSK: SolutionStep[] = [{ do: "param", part: "P1", params: { position: 0.9 } }];

export default defineLab({
  id: "night-light",
  title: "Lights on at dusk",
  bench: {
    board: "full",
    frame: ["desk:-96,-30", "desk:24,30"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      // Station A.
      { id: "PT1", kind: "phototransistor", at: "c5", locked: true, label: "Phototransistor PT1" },
      { id: "R1", kind: "resistor", at: "b5-b10", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "D1", kind: "led", at: "d10", params: { color: "red" }, locked: true, label: "Red LED D1" },
      // Station B.
      { id: "Q1", kind: "npn", at: "c30", locked: true, label: "Q1 (2N3904)" },
      { id: "D2", kind: "led", at: "d33", rot: 180, params: { color: "yellow" }, locked: true, label: "Yellow lamp D2" },
      { id: "R2", kind: "resistor", at: "rail+:33-b33", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "R3", kind: "resistor", at: "top+:29-i29", params: { ohms: 4700 }, locked: true, label: "4.7 kΩ resistor R3" },
      { id: "P1", kind: "trimmer", at: "h29", params: { ohms: 50_000, position: 0.9 }, locked: true, label: "50 kΩ trimmer P1" },
    ],
    wires: [
      { id: "W1", from: "a6", to: "rail+:6", color: "red" },
      { id: "W2", from: "a11", to: "rail-:11", color: "black" },
      { id: "W3", from: "rail+:4", to: "top+:4", color: "red" },
      { id: "W4", from: "a30", to: "rail-:30", color: "black" },
      { id: "W5", from: "f30", to: "e31", color: "yellow" },
    ],
    tray: [{ id: "PT2", kind: "phototransistor", count: 1, label: "Phototransistor" }],
    instruments: [],
    controls: [
      { id: "lamp", label: "Desk lamp", part: "*", key: "light", min: 0, max: 1, value: 0.3, step: 0.01, unit: "%" },
      { id: "trim", label: "Trimmer P1", part: "P1", key: "position", min: 0, max: 1, value: 0.9, step: 0.01, unit: "%" },
    ],
  },
  mascot: {
    start: "Street lamps notice the dark by themselves. Let's teach this one.",
    hint: "Light steals the base current. Sneaky but effective.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "follow-the-light",
      prompt: "Station A: slide the lamp from dark to bright. Watch the LED.",
      goal: (lab) => {
        const dark = at(lab, "dark", 0.1, 0.06, "D1");
        const bright = at(lab, "bright", 1, 0.05, "D1");
        return dark !== undefined && bright !== undefined && bright - dark > 0.3;
      },
      hints: ["The lamp slider is under the bench. Pause at each end."],
      highlight: ["PT1"],
      success: "More light, more current.",
    },
    {
      id: "plug-pt2",
      prompt: "Plug PT2 into rows 30 and 31.",
      goal: pt2In,
      hints: ["PT2 is in the tray. Its legs go in b30 and b31.", "Its collector goes in row 31, Q1's base row."],
      highlight: ["hole:b30", "hole:b31"],
      nudges: [{ when: pt2Backwards, say: "Backwards, it barely conducts. Turn it round." }],
      success: "Across Q1's base.",
    },
    {
      id: "flip-it",
      prompt: "Dark, then bright. Watch the yellow lamp.",
      goal: (lab) => {
        if (!pt2In(lab)) return false;
        const dark = at(lab, "dark", 0.02, 0.03, "D2");
        const bright = at(lab, "bright", 0.9, 0.1, "D2");
        return dark !== undefined && bright !== undefined && dark > 0.6 && bright < 0.05;
      },
      hints: ["Slide the lamp all the way down, then all the way up.", "In the light, PT2 steals Q1's base current."],
      highlight: ["D2"],
      success: "Dark: lamp on. Light: lamp off.",
    },
    {
      id: "set-dusk",
      prompt: "Trim it so the lamp comes on below about 25% light.",
      setup: LATE_DUSK,
      goal: (lab) => {
        if (trim(lab) > 0.6) lab.memory["late"] = true;
        const dusk = at(lab, "dusk", 0.18, 0.015, "D2");
        const day = at(lab, "day", 0.32, 0.015, "D2");
        return lab.memory["late"] === true && pt2In(lab) && dusk !== undefined && day !== undefined && dusk > 0.5 && day < 0.1;
      },
      hints: ["Less trimmer resistance feeds Q1 more. More light is then needed to steal it.", "After each turn, try the lamp at 18% (on) and 32% (off)."],
      highlight: ["P1"],
      success: "Your lamp now knows when dusk is.",
      notice: "Near the threshold it glows dimly. Unit 4 cures that.",
    },
  ],
  solution: [
    { do: "control", id: "lamp", value: 0.1 },
    { do: "wait", seconds: 0.5 },
    { do: "control", id: "lamp", value: 1 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "follow-the-light" },
    { do: "place", part: "PT2", kind: "phototransistor", at: "b30" },
    { do: "check", task: "plug-pt2" },
    { do: "control", id: "lamp", value: 0.02 },
    { do: "wait", seconds: 0.5 },
    { do: "control", id: "lamp", value: 0.9 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "flip-it" },
    ...LATE_DUSK,
    { do: "param", part: "P1", params: { position: 0.25 } },
    { do: "control", id: "lamp", value: 0.18 },
    { do: "wait", seconds: 0.5 },
    { do: "control", id: "lamp", value: 0.32 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "set-dusk" },
  ],
});
