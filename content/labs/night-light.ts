// Blueprint: docs/curriculum/unit-2.md, Lesson 16. The desk lamp slider sets the light on every phototransistor.
// Station A (rows 5 to 11): PT1 from the + rail (row 6, collector) to row 5, R1 (1 kΩ) to the red LED. Station B
// (rows 28 to 37): Q1 in rows 30 to 32 switches the yellow LED (R2 470 Ω from the rail). Its base (row 31) is fed
// from the far + rail through R3 (4.7 kΩ) and trimmer P1 (on the far half, wiper in far row 31, which a short jumper
// joins to the base). The learner plugs PT2 in rows 30 and 31: emitter on Q1's grounded emitter row, collector on the
// base row, so light steals Q1's base current.
//
// Measured in the simulator: D1 goes from about 0.15 in the dark to about 0.5 in bright light; with the trimmer at 50%
// the yellow lamp switches near light 0.12; between about 20% and 35% it is on at 0.18 and off at 0.32.
import { defineLab, type LabView } from "@ohmland/lab";

const light = (lab: LabView) => lab.control("lamp") ?? 0.3;
const glow = (lab: LabView, id: string) => lab.part(id)?.glow ?? 0;

/** Remembers an LED's glow once the lamp has stayed at a level (within `tol`) for a moment; keyed by the trimmer too. */
function at(lab: LabView, key: string, level: number, tol: number, id: string): number | undefined {
  const m = lab.memory as Record<string, { trim: number; glow: number } | undefined>;
  const trim = lab.control("trim") ?? 0.5;
  if (lab.heldFor(0.4, Math.abs(light(lab) - level) <= tol, key)) m[key] = { trim, glow: glow(lab, id) };
  const r = m[key];
  return r && r.trim === trim ? r.glow : undefined;
}

export default defineLab({
  id: "night-light",
  title: "Lights on at dusk",
  bench: {
    board: "full",
    frame: ["desk:-92,-30", "desk:30,32"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      // Station A.
      { id: "PT1", kind: "phototransistor", at: "c5", locked: true, label: "Phototransistor PT1" },
      { id: "R1", kind: "resistor", at: "b5-b10", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "D1", kind: "led", at: "d10", params: { color: "red" }, locked: true, label: "Red LED D1" },
      // Station B.
      { id: "Q1", kind: "npn", at: "c30", locked: true, label: "Q1 (2N3904)" },
      { id: "D2", kind: "led", at: "d33", rot: 180, params: { color: "yellow" }, locked: true, label: "Yellow lamp D2" },
      { id: "R2", kind: "resistor", at: "rail+:33-b33", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "R3", kind: "resistor", at: "top+:29-i29", params: { ohms: 4700 }, locked: true, label: "4.7 kΩ resistor R3" },
      { id: "P1", kind: "trimmer", at: "h29", params: { ohms: 50_000, position: 0.5 }, locked: true, label: "50 kΩ trimmer P1" },
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
      { id: "trim", label: "Trimmer P1", part: "P1", key: "position", min: 0, max: 1, value: 0.5, step: 0.01, unit: "%" },
    ],
  },
  mascot: {
    start: "Street lamps notice the dark by themselves. Let's teach this one.",
    hint: "Light steals the base current. Sneaky but effective.",
    success: "Dusk detected. Lamp deployed.",
    exit: "Turn the trimmer, change the sunset.",
  },
  tasks: [
    {
      id: "follow-the-light",
      prompt: "At station A, slide the desk lamp from dark (about 10%) to full bright, and watch the red LED.",
      goal: (lab) => {
        const dark = at(lab, "dark", 0.1, 0.03, "D1");
        const bright = at(lab, "bright", 1, 0.03, "D1");
        return dark !== undefined && bright !== undefined && bright - dark > 0.3;
      },
      hints: ["The desk lamp slider is with the controls. Pause a moment at each end."],
      highlight: ["PT1"],
      success: "More light, more current. The phototransistor is a light-operated valve.",
    },
    {
      id: "flip-it",
      prompt:
        "At station B, Q1's base is fed through the trimmer. Plug **PT2** in rows 30 and 31: its **collector** in the base row (31), its emitter in Q1's emitter row (30). Then make it dark, then bright.",
      goal: (lab) => {
        if (!lab.joins("PT2", "Q1.e", "Q1.b", "forward")) return false;
        const dark = at(lab, "dark", 0.03, 0.03, "D2");
        const bright = at(lab, "bright", 0.9, 0.1, "D2");
        return dark !== undefined && bright !== undefined && dark > 0.6 && bright < 0.05;
      },
      hints: [
        "On this phototransistor the collector is the leg on the flat side of its rim. Check the part's info card.",
        "In the light, PT2 steals Q1's base current.",
      ],
      highlight: ["hole:b30", "hole:b31"],
      success: "Dark: Q1's base gets its current, and the lamp shines. Light: PT2 drains that current to ground first.",
    },
    {
      id: "set-dusk",
      prompt: "Turn the trimmer so the lamp comes on as the light drops below about **25%**: on at 18%, off at 32%.",
      goal: (lab) => {
        const dusk = at(lab, "dusk", 0.18, 0.015, "D2");
        const day = at(lab, "day", 0.32, 0.015, "D2");
        return lab.joins("PT2", "Q1.e", "Q1.b", "forward") && dusk !== undefined && day !== undefined && dusk > 0.5 && day < 0.1;
      },
      hints: ["Less base resistance feeds Q1 more current, so it takes more light to steal it all.", "Try the lamp at 18% and at 32% after each turn of the trimmer."],
      highlight: ["P1"],
      success: "Your lamp now has a sense of when dusk is.",
      notice: "Near the threshold the lamp glows dimly instead of snapping on. Unit 4 cures that with hysteresis, just like the relay's.",
    },
  ],
  solution: [
    { do: "control", id: "lamp", value: 0.1 },
    { do: "wait", seconds: 0.5 },
    { do: "control", id: "lamp", value: 1 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "follow-the-light" },
    { do: "place", part: "PT2", kind: "phototransistor", at: "b30" },
    { do: "control", id: "lamp", value: 0.02 },
    { do: "wait", seconds: 0.5 },
    { do: "control", id: "lamp", value: 0.9 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "flip-it" },
    { do: "control", id: "trim", value: 0.25 },
    { do: "control", id: "lamp", value: 0.18 },
    { do: "wait", seconds: 0.5 },
    { do: "control", id: "lamp", value: 0.32 },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "set-dusk" },
  ],
});
