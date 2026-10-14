// Blueprint: docs/curriculum/unit-1.md, L11, split (docs/curriculum/conversion-guide.md, B3). A bench lesson's lab: its
// tasks are the beats of content/units/basics/voltage-and-ohms-law/find-the-law/lesson.yaml, in the same order.
// One idea: V = I × R, found in your own data and proved by one prediction. Turning the law round moved to use-the-law.
// A battery and an empty resistor holder whose second clip is wired to battery minus; four resistors in the tray (each
// with its own real value); the meter goes in series between battery plus and the holder. The 4.7 kΩ resistor comes
// into play for the prediction.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { latest, near, readsIn, si } from "./lib/meter";

/** The four table rows: resistor id and nominal kΩ. */
const ROWS: [id: string, kOhms: number][] = [
  ["R1", 1],
  ["R2", 1.5],
  ["R3", 2.2],
  ["R4", 3.3],
];

/** The resistors, each with its own real value. */
const PARTS: Record<string, { ohms: number; watts: number; actualOhms: number }> = {
  R1: { ohms: 1000, watts: 0.25, actualOhms: 1010 },
  R2: { ohms: 1500, watts: 0.25, actualOhms: 1490 },
  R3: { ohms: 2200, watts: 0.25, actualOhms: 2210 },
  R4: { ohms: 3300, watts: 0.25, actualOhms: 3280 },
  R5: { ohms: 4700, watts: 0.25, actualOhms: 4680 },
};

/** The 4.7 kΩ resistor comes into play on the desk, beside the holder, once the table is done. */
const FIFTH_RESISTOR: SolutionStep[] = [{ do: "place", part: "R5", kind: "resistor", params: PARTS.R5, at: "desk:56,-30" }];

/** The fix-it bench: the 2.2 kΩ resistor back in the holder, and the red plug in VΩ while the dial stays on mA. */
const RED_IN_VOHM: SolutionStep[] = [
  { do: "move", part: "R3", at: "in:H1" },
  { do: "plug", probe: "red", socket: "vohm" },
];

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

/** On mA, in series, but the red plug sits in VΩ: the meter reads nothing. */
const plugInVohm = (lab: LabView) => lab.meter?.mode === "dca-ma" && lab.meter.red === "vohm" && lab.meter.redAt !== null && lab.meter.blackAt !== null;

export default defineLab({
  id: "find-the-law",
  title: "Find the law yourself",
  bench: {
    board: "none",
    // The meter sits in front of the loop, so the bench stacks up a phone screen too.
    frame: ["desk:-104,-104", "desk:92,166"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-74,-36", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // An empty resistor holder: two clips, H1.a and H1.b.
      { id: "H1", kind: "holder", at: "desk:0,-66", locked: true, label: "Resistor holder" },
    ],
    leads: [{ id: "TL1", from: "H1.b", to: "B1.neg", color: "black" }],
    tray: ROWS.map(([id, k]) => ({ id, kind: "resistor" as const, params: PARTS[id]!, label: `${k} kΩ resistor`, count: 1 })),
    instruments: [{ kind: "meter", at: "desk:4,84", rot: 0, mode: "off" }],
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
      prompt: "First, measure the battery on DC volts.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B1") && Number.isFinite(battery(lab)) && readsIn(lab, 9.0, 9.6),
      hints: ["Dial to V, 20. Red probe on +, black on −.", "Hold still until the reading settles."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      nudges: [{ when: (lab) => lab.meter?.mode === "dcv" && lab.across("B1", "rev"), say: "A minus sign? Swap the probes." }],
      success: "Battery logged.",
    },
    {
      id: "first-row",
      prompt: "Meter on **mA**, in series. Drop the 1 kΩ in the holder, then type mA × kΩ.",
      // Each row's product is typed while its reading is on the display, so nothing has to be remembered.
      goal: (lab) => Number.isFinite(mA(lab, "R1")) && near(lab.note("p1"), mA(lab, "R1"), 0.02),
      note: { id: "p1", label: "1 kΩ: mA × kΩ", unit: "V" },
      hints: ["Red plug in mA, dial on mA, probes on plus and holder.", "Then type the meter's mA times 1."],
      highlight: ["pin:B1.pos", "pin:H1.a", "H1"],
      nudges: [{ when: plugInVohm, say: "Reading zero? The red plug belongs in mA." }],
      success: "First row.",
    },
    {
      id: "fill-the-table",
      prompt: "Now 1.5, 2.2 and 3.3 kΩ, one at a time. Type mA × kΩ for each.",
      goal: (lab) => ROWS.every(([id]) => Number.isFinite(mA(lab, id))) && products(lab, 0.02),
      note: [
        { id: "p2", label: "1.5 kΩ: mA × kΩ", unit: "V" },
        { id: "p3", label: "2.2 kΩ: mA × kΩ", unit: "V" },
        { id: "p4", label: "3.3 kΩ: mA × kΩ", unit: "V" },
      ],
      hints: ["Drop each resistor onto the holder. The last one pops out.", "Multiply the meter's mA by the resistor's kΩ."],
      highlight: ["H1"],
      nudges: [{ when: plugInVohm, say: "Reading zero? The red plug belongs in mA." }],
      success: "Four rows of real data.",
    },
    {
      id: "spot-the-pattern",
      prompt: "Look at your four answers. What number keeps turning up?",
      goal: (lab) => products(lab, 0.02) && near(lab.note("pattern"), battery(lab), 0.03),
      note: { id: "pattern", label: "Every row lands near", unit: "V" },
      hints: ["Your four answers are all about the same.", "Compare them with the battery's push."],
      success: "All four land near your battery.",
    },
    {
      id: "predict-4k7",
      prompt: "Predict the current through 4.7 kΩ.",
      setup: FIFTH_RESISTOR,
      goal: (lab) => near(lab.note("prediction"), battery(lab) / 4.7, 0.1),
      note: { id: "prediction", label: "4.7 kΩ: my prediction", unit: "mA" },
      hints: ["Volts divided by kilohms gives milliamps.", "About 9.4 ÷ 4.7."],
      success: "Prediction noted.",
    },
    {
      id: "predict-and-test",
      prompt: "Drop the 4.7 kΩ in the holder. Was your prediction right?",
      goal: (lab) => {
        const p = lab.note("prediction");
        return near(p, battery(lab) / 4.7, 0.1) && near(mA(lab, "R5"), p ?? Number.NaN, 0.05);
      },
      hints: ["Drop the 4.7 kΩ resistor onto the holder.", "Hold the reading steady for a moment."],
      highlight: ["R5", "H1"],
      success: "Predicted, then confirmed.",
    },
    {
      id: "fix-red-plug",
      prompt: "Row three reads zero now. Fix it.",
      setup: RED_IN_VOHM,
      // Broken first (the setup), then the 2.2 kΩ row reads its current again.
      goal: (lab) => {
        if (plugInVohm(lab)) lab.memory["zero"] = true;
        return lab.memory["zero"] === true && lab.meter?.red === "ma" && lab.heldBy("R3") === "H1" && readsIn(lab, 4.0, 4.5);
      },
      hints: ["The dial is on mA. Where is the red plug?", "Current only flows through the mA socket."],
      highlight: ["socket:vohm", "socket:ma"],
      success: "Fixed.",
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
    { do: "place", part: "R1", kind: "resistor", params: PARTS.R1, at: "in:H1" },
    { do: "wait", seconds: 0.8 },
    { do: "note", id: "p1", value: "9.19" },
    { do: "check", task: "first-row" },
    ...ROWS.slice(1).flatMap(([id]) => [
      { do: "place" as const, part: id, kind: "resistor" as const, params: PARTS[id], at: "in:H1" },
      { do: "wait" as const, seconds: 0.8 },
    ]),
    { do: "note", id: "p2", value: "9.38" },
    { do: "note", id: "p3", value: "9.31" },
    { do: "note", id: "p4", value: "9.41" },
    { do: "check", task: "fill-the-table" },
    { do: "note", id: "pattern", value: "9.4" },
    { do: "check", task: "spot-the-pattern" },
    ...FIFTH_RESISTOR,
    { do: "note", id: "prediction", value: "2.0" },
    { do: "check", task: "predict-4k7" },
    { do: "move", part: "R5", at: "in:H1" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "predict-and-test" },
    ...RED_IN_VOHM,
    { do: "wait", seconds: 0.3 },
    { do: "plug", probe: "red", socket: "ma" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-red-plug" },
  ],
});
