// Blueprint: docs/curriculum/unit-2.md, Lesson 13 (its measuring half); docs/curriculum/conversion-guide.md, 13b.
// A bench lesson's lab (docs/LESSONS.md): content/units/switching/transistors/count-the-gain.
// One idea: the collector flow is about β times the base flow.
//
// Lesson 13's circuit with Q1 in place and the button gone, so the base is always fed. Two jumpers come off the
// + rail and serve as test links: the green one (W4, rail to row 25) feeds the LED through R1 (470 Ω, row 25 to row
// 23); the yellow one (W3, rail to row 16) feeds the base through R3 (470 kΩ, row 16 to the base in row 21). Pull a
// link and bridge the gap with the meter's probes (red on the rail, black on the row) to read that path's current.
// The collector comes first: in 3D the probes then lean over the empty board left of the circuit while R3 is swapped.
// The meter ranges by itself.
//
// Measured in the simulator: the collector takes 3.63 mA and the base 17.7 µA, a gain of about 205 (this Q1's β at
// that current); with 220 kΩ the base takes 37 µA and the collector 7.8 mA, about twice as much. With the probes
// around a link that is still in, the meter reads 0.0 µA: the wire carries the flow.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The resistor from row 16 to Q1's base (whichever one the learner put there), or null. */
const baseResistor = (lab: LabView): string | null => lab.bench.parts.find((p) => p.kind === "resistor" && lab.joins(p.id, "c16", "Q1.b"))?.id ?? null;

/** The marked value of the base resistor, or null. */
function baseOhms(lab: LabView): number | null {
  const id = baseResistor(lab);
  return id ? Number(lab.prop(id)?.["ohms"]) : null;
}

/** The meter carries this part's current and the reading has settled. */
const reading = (lab: LabView, part: string, key: string) => lab.heldFor(0.6, lab.meterInSeriesWith(part) && (lab.meter?.si ?? 0) > 1e-6, key);

/** A link is out: nothing joins the + rail to its row but the meter. */
const linkOut = (lab: LabView, row: string) => !lab.connected("B1.pos", row);

/** The probes sit on both sides of a link that is still in: the wire carries the flow, the meter sees almost none. */
const aroundLink = (lab: LabView, row: string) => lab.connected("probe:red", "B1.pos") && lab.connected("probe:black", row) && lab.connected("B1.pos", row);

/** The green link back in and the probes free, so the LED is fed again for the base reading. */
const GREEN_BACK: SolutionStep[] = [
  { do: "wire", id: "W4", from: "a25", to: "rail+:25", color: "green" },
  { do: "probe", red: null, black: null },
];

/** The fix-it bench: the yellow link back in, with the probes still on both sides of it. */
const LINK_LEFT_IN: SolutionStep[] = [{ do: "wire", id: "W3", from: "a16", to: "rail+:16", color: "yellow" }];

export default defineLab({
  id: "count-the-gain",
  title: "Count the gain",
  bench: {
    board: "full",
    // The circuit (columns 12 to 27) on the left, room on the right for the meter's panel, and the loose probe tips in
    // front. The meter itself sits off to the left; its panel shows the reading.
    frame: ["top+:11", "rail-:40", "desk:-40,40"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "b25-b23", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R1" },
      { id: "D1", kind: "led", at: "d23", rot: 180, params: { color: "red" }, locked: true, label: "Red LED D1" },
      { id: "Q1", kind: "npn", at: "c20", locked: true, label: "Q1 (2N3904)" },
      { id: "R3", kind: "resistor", at: "b16-b21", params: { ohms: 470_000 }, label: "470 kΩ base resistor R3" },
    ],
    wires: [
      { id: "W2", from: "a20", to: "rail-:21", color: "black" },
      // The two test links.
      { id: "W3", from: "a16", to: "rail+:16", color: "yellow" },
      { id: "W4", from: "a25", to: "rail+:25", color: "green" },
    ],
    tray: [{ id: "R4", kind: "resistor", params: { ohms: 220_000 }, count: 1, label: "220 kΩ" }],
    instruments: [{ kind: "meter", at: "desk:-178,22", rot: 16, mode: "dca-ma", red: "ma", black: "com", tips: { red: "desk:-46,36", black: "desk:-36,37" } }],
  },
  mascot: {
    start: "How much bigger is the river? Let's count.",
    hint: "Pull a link. Red probe on the rail, black on the row.",
    fried: "Oof. That one's for the Hall.",
  },
  fried: { npn: "2N3904, base with no resistor" },
  tasks: [
    {
      id: "measure-collector",
      prompt: "Pull the green link. Bridge the gap with the probes.",
      goal: (lab) => {
        if (baseOhms(lab) !== 470_000 || linkOut(lab, "c16") || !linkOut(lab, "c25") || !reading(lab, "D1", "collector")) return false;
        lab.shared["ic"] = lab.meter?.si ?? 0;
        return true;
      },
      hints: ["Drag the green wire off the board.", "Red probe on the + rail, black probe on strip 25."],
      highlight: ["wire:W4.b", "hole:a25"],
      nudges: [
        { when: (lab) => aroundLink(lab, "c25"), say: "Pull the link first, so the flow goes through the meter." },
        { when: (lab) => linkOut(lab, "c25") && !lab.meter?.redAt && !lab.meter?.blackAt, say: "Link's out, LED's dark. Now bridge the gap." },
      ],
      success: "About 3.6 mA through the LED.",
    },
    {
      id: "measure-base",
      prompt: "Pull the yellow link. Probe its gap.",
      setup: GREEN_BACK,
      goal: (lab) => {
        const r = baseResistor(lab);
        if (!r || !linkOut(lab, "c16") || linkOut(lab, "c25") || baseOhms(lab) !== 470_000 || !reading(lab, r, "base")) return false;
        lab.shared["ib"] = lab.meter?.si ?? 0;
        return true;
      },
      hints: ["Pull the yellow wire. Red on the rail, black on strip 16."],
      highlight: ["wire:W3.b", "hole:a16"],
      nudges: [{ when: (lab) => aroundLink(lab, "c16"), say: "Pull the yellow link first, so the flow uses the meter." }],
      success: "About 18 µA into the base.",
    },
    {
      id: "measure-gain",
      prompt: "Divide collector flow by base flow. Type the gain.",
      note: { id: "beta", label: "Gain (collector ÷ base)", unit: "" },
      goal: (lab) => {
        const x = lab.note("beta");
        if (x === null) return false;
        const ib = lab.shared["ib"];
        const ic = lab.shared["ic"];
        const measured = typeof ib === "number" && typeof ic === "number" && ib > 0 ? ic / ib : null;
        const q = lab.part("Q1")?.extra;
        const live = q?.["region"] === "active" ? Number(q["beta"]) : null;
        return [measured, live].some((b) => b !== null && Math.abs(x - b) <= b * 0.1);
      },
      hints: ["3.6 mA is 3,600 µA. Divide by 17.7 µA.", "Same units first, then divide."],
      success: "Your Q1 multiplies its base flow by about 200.",
    },
    {
      id: "double-it",
      prompt: "Swap in 220 kΩ: twice the base flow.",
      goal: (lab) => {
        const was = lab.shared["ic"];
        const ic = lab.amps("Q1");
        const ratio = typeof was === "number" && was > 0 ? ic / was : ic / 0.0036;
        return baseOhms(lab) === 220_000 && ratio >= 1.7 && ratio <= 2.4;
      },
      hints: ["Pull R3 out. Bend the 220 kΩ from strip 16 to strip 21."],
      highlight: ["hole:b16", "hole:b21"],
      success: "About twice the base flow, about twice the collector flow.",
    },
    {
      id: "fix-link",
      prompt: "The base meter reads zero. Fix it.",
      setup: LINK_LEFT_IN,
      // Probed around a link that is still in first (the setup), then the link out and the meter in series.
      goal: (lab) => {
        if (aroundLink(lab, "c16")) lab.memory["around"] = true;
        const r = baseResistor(lab);
        return lab.memory["around"] === true && linkOut(lab, "c16") && !!r && reading(lab, r, "fixed");
      },
      hints: ["Where can the flow go besides the meter?", "Pull the yellow link. Then all the flow uses the meter."],
      highlight: ["wire:W3"],
      success: "Reading again. A current meter needs the gap to itself.",
    },
  ],
  solution: [
    { do: "unwire", wire: "W4" },
    { do: "probe", red: "rail+:25", black: "a25" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "measure-collector" },
    ...GREEN_BACK,
    { do: "unwire", wire: "W3" },
    { do: "probe", red: "rail+:16", black: "a16" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "measure-base" },
    { do: "note", id: "beta", value: "203" },
    { do: "check", task: "measure-gain" },
    { do: "remove", part: "R3" },
    { do: "place", part: "R4", kind: "resistor", at: "b16-b21", params: { ohms: 220_000 } },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "double-it" },
    ...LINK_LEFT_IN,
    { do: "wait", seconds: 0.5 },
    { do: "unwire", wire: "W3" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "fix-link" },
  ],
});
