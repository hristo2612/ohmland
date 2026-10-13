// Blueprint: docs/curriculum/unit-1.md, L11. A battery and an empty resistor holder whose second clip is wired to
// battery minus; five resistors in the tray (each with its own real value); the meter goes in series between battery
// plus and the holder. The blueprint's four-row table is the notebook's readings plus four entries for I × R.
import { defineLab, type LabView } from "@ohmland/lab";
import { latest, near, readsIn, si } from "./lib/meter";

/** The four table rows: resistor id and nominal kΩ. */
const ROWS: [id: string, kOhms: number][] = [
  ["R1", 1],
  ["R2", 1.5],
  ["R3", 2.2],
  ["R4", 3.3],
];

/** The tray's resistors, each with its own real value. */
const PARTS: Record<string, { ohms: number; watts: number; actualOhms: number }> = {
  R1: { ohms: 1000, watts: 0.25, actualOhms: 1010 },
  R2: { ohms: 1500, watts: 0.25, actualOhms: 1490 },
  R3: { ohms: 2200, watts: 0.25, actualOhms: 2210 },
  R4: { ohms: 3300, watts: 0.25, actualOhms: 3280 },
  R5: { ohms: 4700, watts: 0.25, actualOhms: 4680 },
};

/** The latest logged current through a resistor, in mA (NaN when there is none). */
const mA = (lab: LabView, id: string): number => {
  const r = latest(lab, `series:${id}`);
  return r && r.mode === "dca-ma" ? si(r) * 1000 : Number.NaN;
};

/** The logged battery voltage. */
const battery = (lab: LabView): number => {
  const r = lab.readings("across:B1").filter((x) => x.mode === "dcv").at(-1);
  return si(r);
};

/** The learner's I × R for each row is within `tol` of the logged current times the nominal resistance. */
const products = (lab: LabView, tol: number): boolean =>
  ROWS.every(([id, k], i) => near(lab.note(`p${i + 1}`), mA(lab, id) * k, tol));

export default defineLab({
  id: "find-the-law",
  title: "Find the law yourself",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-92,8", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // An empty resistor holder: two clips, H1.a and H1.b.
      { id: "H1", kind: "holder", at: "desk:-4,-38", locked: true, label: "Resistor holder" },
    ],
    leads: [{ id: "TL1", from: "H1.b", to: "B1.neg", color: "black" }],
    tray: [
      ...Object.entries(PARTS).map(([id, params]) => ({ id, kind: "resistor" as const, params, count: 1 })),
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "yellow" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:120,24", mode: "off" }],
  },
  mascot: {
    start: "Measure first, formula later. Let's find a law.",
    hint: "Multiply mA by kΩ. What number keeps turning up?",
    success: "You just rediscovered Ohm's law. With your own data!",
  },
  // The Lawmaker achievement: every product within 5% of the battery, and the 4.7 kΩ prediction within 5% of the measurement.
  triggers: {
    lawmaker: (lab) => {
      const v = battery(lab);
      return (
        lab.task("spot-the-pattern") === "done" &&
        lab.task("predict-and-test") === "done" &&
        ROWS.every(([id, k]) => near(mA(lab, id) * k, v, 0.05)) &&
        near(lab.note("prediction"), mA(lab, "R5"), 0.05)
      );
    },
  },
  tasks: [
    {
      id: "battery-first",
      prompt: "Start by measuring the battery on DC volts. The notebook logs it.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B1") && Number.isFinite(battery(lab)) && readsIn(lab, 9.0, 9.6),
      hints: ["Red on the battery's round terminal, black on the six-sided one, on the 20 V range.", "Hold the probes still until the reading lands in the notebook."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "Battery voltage logged. Keep that number in mind.",
    },
    {
      id: "fill-the-table",
      prompt:
        "Switch to current (red lead in **mA**, **20mA** range) and put the meter in series: battery plus to red probe, black probe to the holder. Then clip in each resistor in turn: 1 kΩ, 1.5 kΩ, 2.2 kΩ, 3.3 kΩ.",
      goal: (lab) => ROWS.every(([id]) => Number.isFinite(mA(lab, id))),
      hints: [
        "One loop: battery plus, meter, holder, back to minus.",
        "Reading zero? Check the red lead is in mA.",
        "Swap resistors by dragging a new one onto the holder. Hold each reading steady so the notebook logs it.",
      ],
      highlight: ["pin:B1.pos", "pin:H1.a", "H1"],
      success: "Four rows of real data. Now look closely.",
    },
    {
      id: "spot-the-pattern",
      prompt: "For each row, multiply the current in mA by the resistance in kΩ. Type the four answers.",
      goal: (lab) => products(lab, 0.02),
      note: [
        { id: "p1", label: "1 kΩ row: I × R", unit: "V" },
        { id: "p2", label: "1.5 kΩ row: I × R", unit: "V" },
        { id: "p3", label: "2.2 kΩ row: I × R", unit: "V" },
        { id: "p4", label: "3.3 kΩ row: I × R", unit: "V" },
      ],
      hints: ["First row: about 9.2 × 1.", "Compare your answers with the battery voltage."],
      success: "All four land close to your battery voltage. That's not a coincidence. That's a law.",
    },
    {
      id: "predict-and-test",
      prompt: "Here's a 4.7 kΩ resistor. Predict its current first, then clip it in and measure.",
      goal: (lab) => {
        const p = lab.note("prediction");
        return near(p, battery(lab) / 4.7, 0.1) && near(mA(lab, "R5"), p ?? Number.NaN, 0.05);
      },
      note: { id: "prediction", label: "Your prediction for 4.7 kΩ", unit: "mA" },
      hints: ["Volts divided by kilohms gives milliamps.", "Then drop the 4.7 kΩ resistor onto the holder and hold the reading steady."],
      success: "Predicted, then confirmed. That's what a law of physics is for.",
    },
  ],
  solution: [
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "battery-first" },
    { do: "probe", red: null, black: null },
    { do: "plug", probe: "red", socket: "ma" },
    { do: "dial", mode: "dca-ma", range: "20mA" },
    { do: "probe", red: "B1.pos", black: "H1.a" },
    ...ROWS.flatMap(([id]) => [
      { do: "place" as const, part: id, kind: "resistor" as const, params: PARTS[id], at: "in:H1" },
      { do: "wait" as const, seconds: 0.8 },
    ]),
    { do: "check", task: "fill-the-table" },
    { do: "note", id: "p1", value: "9.19" },
    { do: "note", id: "p2", value: "9.38" },
    { do: "note", id: "p3", value: "9.31" },
    { do: "note", id: "p4", value: "9.41" },
    { do: "check", task: "spot-the-pattern" },
    { do: "note", id: "prediction", value: "2.0" },
    { do: "place", part: "R5", kind: "resistor", params: PARTS.R5, at: "in:H1" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "predict-and-test" },
  ],
});
