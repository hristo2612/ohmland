// Split from battery-field-guide (docs/curriculum/conversion-guide.md, B3 18b). The lab of a bench lesson
// (docs/LESSONS.md): content/units/basics/cells-and-batteries/how-long. One idea: a battery's hours are roughly its
// capacity divided by the flow. A night lamp (a 500 mAh 9 V battery, 470 Ω and a red LED, about 16 mA), a desk clock
// showing simulated time and a time-lapse speed slider (up to 3,600 times, an hour a second).
// From the simulator: 470 Ω starts at 16.1 mA and holds a steady glow to about 31 hours (500 ÷ 16 ≈ 31), then fades:
// half its glow near 37 hours, dark near 40. 150 Ω draws 48 mA and fades out after about 11 hours (500 ÷ 48 ≈ 10).
import { defineLab, type SolutionStep } from "@ohmland/lab";

const HOUR = 3600;

/** The fix-it bench: a fresh battery, and a 150 Ω resistor in the lamp instead of the 470 Ω one. */
const GREEDY_LAMP: SolutionStep[] = [
  { do: "replace", part: "B1" },
  { do: "place", part: "R2", kind: "resistor", params: { ohms: 150, watts: 0.5 }, at: "on:R1" },
  { do: "move", part: "R1", at: "desk:10,46" },
];

export default defineLab({
  id: "how-long",
  title: "How long will it last?",
  speed: 1,
  bench: {
    board: "none",
    frame: ["desk:-130,-75", "desk:115,55"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-74,6", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery, 500 mAh" },
      { id: "R1", kind: "resistor", at: "desk:0,-20", params: { ohms: 470, watts: 0.25 }, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:58,12", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
      { id: "CK1", kind: "clock", at: "desk:-4,-62", locked: true, label: "Clock" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "yellow" },
      { id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
    controls: [{ id: "lapse", label: "Time-lapse speed", key: "speed", min: 1, max: 3600, value: 1, scale: "log", unit: "×" }],
  },
  mascot: {
    hint: "Capacity divided by flow. That gives you hours.",
  },
  tasks: [
    {
      id: "run-time",
      prompt: "500 mAh at 16 mA: how many hours?",
      goal: (lab) => {
        const h = lab.note("hours");
        return h !== null && h >= 28 && h <= 36;
      },
      note: { id: "hours", label: "Your estimate", unit: "h" },
      hints: ["Divide the capacity by the flow: 500 ÷ 16.", "A bit over 31."],
      success: "About 31 hours, on paper.",
    },
    {
      id: "time-lapse",
      prompt: "Time-lapse all the way up. When the lamp fades, slide it back.",
      // Lit at first, then dimmed out more than 20 simulated hours later, and back at (about) real time.
      goal: (lab) => {
        const mem = lab.memory as { litAt?: number };
        if (mem.litAt === undefined && lab.isLit("D1", 0.3)) mem.litAt = lab.t;
        return mem.litAt !== undefined && lab.t - mem.litAt > 20 * HOUR && (lab.part("D1")?.glow ?? 1) < 0.2 && (lab.control("lapse") ?? 1) <= 2;
      },
      hints: ["Slide the time-lapse speed all the way up. Watch the clock.", "Faded? Slide the speed back down to 1."],
      highlight: ["CK1", "D1"],
      nudges: [{ when: (lab) => (lab.part("D1")?.glow ?? 1) < 0.2 && (lab.control("lapse") ?? 1) > 2, say: "Faded. Slide the time-lapse back down." }],
      success: "Steady for about 31 hours, then it faded.",
    },
    {
      id: "fix-ten",
      prompt: "This lamp lasts about 10 hours. Make it last 30.",
      setup: GREEDY_LAMP,
      // The greedy 48 mA lamp first (the setup), then one that sips 16 mA or less and still glows.
      goal: (lab) => {
        if (lab.isLit("D1") && lab.amps("D1") > 0.03) lab.memory["greedy"] = true;
        const i = lab.amps("D1");
        return lab.memory["greedy"] === true && lab.isLit("D1", 0.3) && i >= 0.004 && i <= 0.0168;
      },
      hints: ["30 hours from 500 mAh: about 16 mA at most.", "Swap the 470 Ω resistor back in: drop it on the 150 Ω."],
      highlight: ["R1", "R2"],
      success: "16 mA. About 31 hours.",
    },
  ],
  solution: [
    { do: "note", id: "hours", value: "31" },
    { do: "check", task: "run-time" },
    { do: "control", id: "lapse", value: 3600 },
    { do: "wait", seconds: 42 },
    { do: "control", id: "lapse", value: 1 },
    { do: "check", task: "time-lapse" },
    ...GREEDY_LAMP,
    { do: "wait", seconds: 1 },
    { do: "move", part: "R1", at: "on:R2" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "fix-ten" },
  ],
});
