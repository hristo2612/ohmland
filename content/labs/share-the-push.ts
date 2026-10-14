// Blueprint: docs/curriculum/unit-1.md, L10, the second half of the split (docs/curriculum/conversion-guide.md, B3).
// A bench lesson's lab: its tasks are the beats of
// content/units/basics/voltage-and-ohms-law/share-the-push/lesson.yaml, in the same order.
// One idea: around a loop, the parts share the battery's push. The lit loop from volts-across, the meter already set
// for volts, and a blue LED in the tray for the secret.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { latest, readsIn, si } from "./lib/meter";

/** The fix-it bench: a stray clip lead from the resistor straight to battery minus, skipping the LED, and the probes across the resistor. */
const STRAY_LEAD: SolutionStep[] = [
  { do: "lead", id: "L4", from: "R1.b", to: "B1.neg", color: "green" },
  { do: "probe", red: "R1.a", black: "R1.b" },
];

const onVolts = (lab: LabView) => lab.meter?.mode === "dcv" && lab.meter.red === "vohm";
/** The latest logged reading with this tag, else the volts across the two points now. */
const logged = (lab: LabView, tag: string, plus: string, minus: string): number => {
  const r = si(latest(lab, tag));
  return Number.isFinite(r) ? r : (lab.volts(plus, minus) ?? Number.NaN);
};
const reversed = (lab: LabView, id: string) => onVolts(lab) && lab.across(id, "rev");

export default defineLab({
  id: "share-the-push",
  title: "The shared push",
  bench: {
    board: "none",
    // The meter sits in front of the loop, so the bench stacks up a phone screen too.
    frame: ["desk:-104,-104", "desk:92,166"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-74,-36", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-6,-66", params: { ohms: 470, watts: 0.25, actualOhms: 470 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:58,-28", rot: 180, params: { color: "red", maxmA: 50 }, label: "Red LED" },
    ],
    leads: [
      { id: "L1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "L2", from: "R1.b", to: "D1.anode", color: "yellow" },
      { id: "L3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [{ id: "D2", kind: "led", params: { color: "blue", maxmA: 50 }, label: "Blue LED", count: 1 }],
    instruments: [{ kind: "meter", at: "desk:4,84", rot: 0, mode: "dcv", range: "20V", red: "vohm", black: "com" }],
  },
  mascot: {
    start: "One battery, two parts. Who gets how much push?",
    hint: "One probe on each side of the part. Red toward plus.",
    fried: "Oof. That one's for the Hall.",
    success: "Every volt accounted for.",
  },
  tasks: [
    {
      id: "battery-volts",
      prompt: "LED lit. Measure across the battery.",
      goal: (lab) => onVolts(lab) && lab.across("B1") && readsIn(lab, 9.0, 9.6),
      hints: ["Red on plus, black on minus. Nothing gets unclipped."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      nudges: [{ when: (lab) => reversed(lab, "B1"), say: "A minus sign? Swap the probes." }],
      success: "About 9.4 V.",
    },
    {
      id: "resistor-share",
      prompt: "Across the resistor: red on the end nearer plus.",
      goal: (lab) => onVolts(lab) && lab.across("R1") && readsIn(lab, 6.9, 7.9),
      hints: ["The end with the red clip lead is nearer plus."],
      highlight: ["pin:R1.a", "pin:R1.b"],
      nudges: [{ when: (lab) => reversed(lab, "R1"), say: "A minus sign? Swap the probes." }],
      success: "About 7.4 V.",
    },
    {
      id: "led-share",
      prompt: "Across the LED: red on the long leg.",
      goal: (lab) => onVolts(lab) && lab.across("D1") && readsIn(lab, 1.8, 2.1),
      hints: ["The long leg (anode) has the yellow lead on it."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      nudges: [{ when: (lab) => reversed(lab, "D1"), say: "A minus sign? Swap the probes." }],
      success: "About 2 V.",
    },
    {
      id: "add-them-up",
      prompt: "Add the resistor and LED readings. Type the total.",
      goal: (lab) => {
        const sum = lab.note("sum");
        // The readings logged on the beats before; a resumed lesson has none, so the bench's own drops stand in.
        const r = logged(lab, "across:R1", "R1.a", "R1.b");
        const d = logged(lab, "across:D1", "D1.anode", "D1.cathode");
        const b = logged(lab, "across:B1", "B1.pos", "B1.neg");
        return sum !== null && Math.abs(sum - (r + d)) <= 0.05 && Math.abs(sum - b) <= 0.15;
      },
      note: { id: "sum", label: "Resistor + LED", unit: "V" },
      hints: ["About 7.4 plus about 2.0."],
      success: "The drops add up to the battery.",
    },
    {
      id: "fix-stray-lead",
      prompt: "The resistor gets the whole push, the LED none. Fix it.",
      setup: STRAY_LEAD,
      // Broken first (the setup), then lit again.
      goal: (lab) => {
        if (!lab.isLit("D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && lab.isLit("D1");
      },
      hints: ["Follow the green lead. Where does the flow go?", "It skips the LED. Unclip it."],
      highlight: ["L4"],
      success: "Fixed.",
    },
    {
      id: "blue-led",
      prompt: "Swap in the blue LED and measure across it.",
      // Dropped onto the red LED, the blue one takes its clips and the probes.
      goal: (lab) => lab.isLit("D2") && onVolts(lab) && lab.across("D2", "either") && Math.abs(lab.meter?.value ?? 0) >= 2.7 && Math.abs(lab.meter?.value ?? 0) <= 3.3,
      hints: ["Drop the blue LED right onto the red one."],
      success: "Blue takes about 3 V.",
      bonus: true,
    },
  ],
  solution: [
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "battery-volts" },
    { do: "probe", red: "R1.a", black: "R1.b" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "resistor-share" },
    { do: "probe", red: "D1.anode", black: "D1.cathode" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "led-share" },
    { do: "note", id: "sum", value: "9.37" },
    { do: "check", task: "add-them-up" },
    ...STRAY_LEAD,
    { do: "clip", lead: "L4", end: "b", to: null },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "fix-stray-lead" },
    // The secret: the probes back on the LED, then the blue one dropped onto it.
    { do: "probe", red: "D1.anode", black: "D1.cathode" },
    { do: "place", part: "D2", kind: "led", params: { color: "blue", maxmA: 50 }, at: "on:D1" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "blue-led" },
  ],
});
