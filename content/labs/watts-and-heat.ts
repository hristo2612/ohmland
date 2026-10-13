// Blueprint: docs/curriculum/unit-1.md, L13. A load holder clipped straight across the battery (0.15 Ω per clip lead),
// five resistors in the tray (1 kΩ, two 15 Ω 1/4 W, a 15 Ω 1 W and a 15 Ω 5 W ceramic), the meter on DC volts and a
// temperature readout with a touch-feel word over every resistor. The battery sags under heavy load.
import { defineLab, type LabView } from "@ohmland/lab";
import { latest, near, si } from "./lib/meter";

/** The resistor id in the holder, or null. */
const inHolder = (lab: LabView): string | null => lab.holds("H1")[0] ?? null;

/** The latest logged voltage across a resistor (DC volts). */
const volts = (lab: LabView, id: string): number => {
  const r = latest(lab, `across:${id}`) ?? latest(lab, `rev:${id}`);
  return r && r.mode === "dcv" ? Math.abs(si(r)) : Number.NaN;
};

const PARTS = {
  R1: { ohms: 1000, watts: 0.25 },
  R2: { ohms: 15, watts: 0.25 },
  R3: { ohms: 15, watts: 0.25 },
  R4: { ohms: 15, watts: 1 },
  R5: { ohms: 15, watts: 5 },
} as const;

export default defineLab({
  id: "watts-and-heat",
  title: "Watts and warm resistors",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-100,8", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // The load holder: two clips joined to the battery's terminals by clip leads.
      { id: "H1", kind: "holder", at: "desk:-6,-36", locked: true, label: "Load holder" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "H1.a", color: "red" },
      { id: "TL2", from: "H1.b", to: "B1.neg", color: "black" },
    ],
    tray: [
      { id: "R1", kind: "resistor", params: PARTS.R1, count: 1, label: "1 kΩ, 1/4 W" },
      { id: "R2", kind: "resistor", params: PARTS.R2, count: 1, label: "15 Ω, 1/4 W" },
      { id: "R3", kind: "resistor", params: PARTS.R3, count: 1, label: "15 Ω, 1/4 W" },
      { id: "R4", kind: "resistor", params: PARTS.R4, count: 1, label: "15 Ω, 1 W" },
      { id: "R5", kind: "resistor", params: PARTS.R5, count: 1, label: "15 Ω, 5 W" },
    ],
    instruments: [
      { kind: "meter", at: "desk:128,24", mode: "dcv", range: "20V" },
      // Each resistor's temperature, with a touch-feel word: cool, warm, hot, ouch.
      { kind: "inspect", show: "heat", parts: ["resistor"] },
    ],
  },
  mascot: {
    start: "Everything that carries current gets a little warm. Let's push that.",
    hint: "Power is volts times amps. Got both numbers?",
    fried: "Smells like learning. That one's going in the Hall.",
    success: "Rated for five watts, handling four and a half. Cutting it close!",
  },
  fried: (f) => (f.partId === "R2" || f.partId === "R3" ? "15 Ω, 1/4 W resistor across 9 V" : f.partId === "R4" ? "15 Ω, 1 W resistor across 9 V" : undefined),
  tasks: [
    {
      id: "cool-one",
      prompt: "Holder: 1 kΩ. Measure its volts. Type P = V × I, in mW.",
      goal: (lab) => {
        const mW = lab.note("mW");
        return inHolder(lab) === "R1" && Number.isFinite(volts(lab, "R1")) && mW !== null && mW >= 80 && mW <= 95;
      },
      note: { id: "mW", label: "Power in the 1 kΩ resistor", unit: "mW" },
      hints: ["I = V ÷ R: 9.4 V ÷ 1,000 Ω ≈ 0.0094 A.", "P = 9.4 × 0.0094 ≈ 0.088 W. In mW?"],
      highlight: ["H1"],
      success: "About 88 mW. Barely warm. A 1/4 W part handles 250 mW.",
    },
    {
      id: "cook-one",
      prompt: "Swap in a 15 Ω, 1/4 W resistor. Watch closely.",
      goal: (lab) => lab.died("R2") || lab.died("R3"),
      hints: ["Drop a 15 Ω, 1/4 W resistor onto the clips."],
      highlight: ["H1"],
      success: "Smoke, then a break. About 18 times its rating.",
    },
    {
      id: "power-it",
      prompt: "Now the 15 Ω, **5 W** one. Measure. Type its power in W.",
      goal: (lab) => {
        const v = volts(lab, "R5");
        return inHolder(lab) === "R5" && !lab.died("R5") && near(lab.note("W"), (v * v) / 15, 0.1);
      },
      note: { id: "W", label: "Power in the 5 W resistor", unit: "W" },
      hints: ["P = V² ÷ R.", "About 8.2 × 8.2 ÷ 15."],
      highlight: ["H1"],
      success: "Around 4.5 W, all of it heat.",
    },
    {
      id: "survive-ten",
      prompt: "Leave it 10 seconds. Does it survive?",
      goal: (lab) => lab.heldFor(10, inHolder(lab) === "R5" && lab.part("R5")?.health !== "dead"),
      hints: ["Just wait, and watch its temperature."],
      success: "Hot, but alive. 4.5 W is within its 5 W rating.",
      notice: "The battery's voltage crept down as it worked. Lesson 15 explains why.",
    },
    {
      id: "one-watt-too",
      prompt: "Curious? Try the 1 W version.",
      goal: (lab) => lab.event("smoke", "R4"),
      hints: ["Drop the 15 Ω, 1 W resistor on. Give it a while."],
      success: "Better, but still smoking. 4.5 W is too much for 1 W.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "R1", kind: "resistor", params: PARTS.R1, at: "in:H1" },
    { do: "probe", red: "R1.a", black: "R1.b" },
    { do: "wait", seconds: 0.8 },
    { do: "note", id: "mW", value: "88" },
    { do: "check", task: "cool-one" },
    { do: "place", part: "R2", kind: "resistor", params: PARTS.R2, at: "in:H1" },
    { do: "wait", seconds: 6 },
    { do: "check", task: "cook-one" },
    { do: "place", part: "R5", kind: "resistor", params: PARTS.R5, at: "in:H1" },
    { do: "probe", red: "R5.a", black: "R5.b" },
    { do: "wait", seconds: 0.8 },
    { do: "note", id: "W", value: "4.5" },
    { do: "check", task: "power-it" },
    { do: "wait", seconds: 10 },
    { do: "check", task: "survive-ten" },
    { do: "place", part: "R4", kind: "resistor", params: PARTS.R4, at: "in:H1" },
    { do: "wait", seconds: 25 },
    { do: "check", task: "one-watt-too" },
  ],
});
