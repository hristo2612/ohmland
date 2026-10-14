// Blueprint: docs/curriculum/unit-1.md, L9, trimmed for a bench lesson (docs/curriculum/conversion-guide.md, B3):
// content/units/basics/current-and-leds/measure-the-flow/lesson.yaml walks these tasks in order.
// One idea: to count flow, the meter goes into the loop. A lit loop of battery, 470 Ω and red LED on three clip leads
// (L1 red, L2 yellow, L3 black), the meter beside it, two spare meter fuses and a spare clip lead. The blown fuse is
// the bench's own answer to "never across".
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { rangeIs, readsIn } from "./lib/meter";

const onMa = (lab: LabView) => lab.meter?.red === "ma" && lab.meter.mode === "dca-ma";
/** The meter counts the LED's flow: in series, the LED lit, a sensible reading. */
const counting = (lab: LabView) => lab.inSeries("M1", "D1") && lab.isLit("D1") && readsIn(lab, 14, 17.5);

/** The fix-it bench: the loop closed again and the meter, still on mA, held across the LED. */
const ACROSS_THE_LED: SolutionStep[] = [
  { do: "clip", lead: "L1", end: "a", to: "B1.pos" },
  { do: "probe", red: "D1.anode", black: "D1.cathode" },
];

export default defineLab({
  id: "measure-the-flow",
  title: "Measuring the flow",
  bench: {
    board: "none",
    // The loop and the meter (the lesson frames it clear of the docked meter panel).
    frame: ["desk:-110,-60", "desk:165,70"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-84,6", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-6,-40", params: { ohms: 470, watts: 0.25 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:48,30", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
    ],
    leads: [
      { id: "L1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "L2", from: "R1.b", to: "D1.anode", color: "yellow" },
      { id: "L3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [
      { kind: "fuse", props: { amps: 0.2, forMeter: true }, count: 2 },
      { kind: "lead", params: { color: "green" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:112,20", mode: "off" }],
  },
  mascot: {
    hint: "Break the loop first. The meter fills the gap.",
    fried: "Pop. Every meter owner does that once.",
  },
  fried: { "meter-fuse": "Meter fuse, 200 mA (amps across a battery)" },
  tasks: [
    {
      id: "set-up-amps",
      prompt: "Red lead into **mA**. Dial to DC mA, **200mA** range.",
      goal: (lab) => onMa(lab) && rangeIs(lab, "200mA"),
      hints: ["Drag the red plug into the socket marked mA.", "Unsure of the size? Start on the biggest mA range."],
      highlight: ["socket:ma"],
      success: "Ready to count milliamps.",
    },
    {
      id: "break-and-bridge",
      prompt: "Unclip the red lead from **+**. Bridge the gap with the meter.",
      goal: counting,
      hints: ["The flow must go through the meter.", "Red probe on battery plus, black on the lead's free clip."],
      highlight: ["L1", "pin:B1.pos"],
      nudges: [{ when: (lab) => onMa(lab) && lab.across("D1", "either") && !lab.isLit("D1"), say: "Dark! Across the LED, the meter is a shortcut." }],
      success: "Counting.",
    },
    {
      id: "the-classic",
      prompt: "Still on mA, probe straight across the battery.",
      goal: (lab) => lab.event("meter-fuse", "M1"),
      hints: ["Red probe on battery plus, black probe on minus."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "Pop.",
    },
    {
      id: "fresh-fuse",
      prompt: "Fit a fresh fuse. Measure the LED's flow the right way.",
      goal: (lab) => lab.meter?.fuse === "ok" && counting(lab),
      hints: ["Lift the probes off the battery, then Replace meter fuse.", "In series again: break the loop, bridge it with the meter."],
      nudges: [{ when: (lab) => lab.meter?.fuse === "blown" && lab.inSeries("M1", "D1"), say: "Zero, and dark. The fuse is still blown." }],
      success: "Back in business.",
    },
    {
      id: "fix-across",
      prompt: "The lamp went out when the meter touched it. Fix it.",
      setup: ACROSS_THE_LED,
      // Dark first (the setup), then counting in series: a bench that never went dark does not count.
      goal: (lab) => {
        if (!lab.isLit("D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && counting(lab);
      },
      hints: ["On mA the meter is nearly a wire. It steals the flow.", "Unclip a lead. Put the meter in the gap."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      success: "Fixed.",
    },
    {
      id: "other-side",
      prompt: "Measure between the LED's short leg and **−** too.",
      goal: (lab) => {
        const before = lab.doneAt("break-and-bridge")?.meter?.value ?? 15.7;
        const v = lab.meter?.value;
        return lab.inSeries("M1", "D1") && lab.probed("D1.cathode", "B1.neg", "either") && v !== null && v !== undefined && Math.abs(v - before) <= 0.3;
      },
      hints: ["Clip red back to plus. Unclip black from minus.", "Red probe on black's free clip, black probe on minus."],
      highlight: ["L3", "pin:B1.neg"],
      success: "Same number.",
      bonus: true,
    },
  ],
  solution: [
    { do: "plug", probe: "red", socket: "ma" },
    { do: "dial", mode: "dca-ma", range: "200mA" },
    { do: "check", task: "set-up-amps" },
    { do: "clip", lead: "L1", end: "a", to: null },
    { do: "probe", red: "B1.pos", black: "L1.a" },
    { do: "check", task: "break-and-bridge" },
    { do: "clip", lead: "L1", end: "a", to: "B1.pos" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "the-classic" },
    { do: "probe", red: null, black: null },
    { do: "replaceFuse" },
    { do: "clip", lead: "L1", end: "a", to: null },
    { do: "probe", red: "B1.pos", black: "L1.a" },
    { do: "check", task: "fresh-fuse" },
    ...ACROSS_THE_LED,
    { do: "wait", seconds: 0.3 },
    { do: "clip", lead: "L1", end: "a", to: null },
    { do: "probe", red: "B1.pos", black: "L1.a" },
    { do: "check", task: "fix-across" },
    // The secret: the same count on the far side of the LED.
    { do: "clip", lead: "L1", end: "a", to: "B1.pos" },
    { do: "clip", lead: "L3", end: "b", to: null },
    { do: "probe", red: "L3.b", black: "B1.neg" },
    { do: "check", task: "other-side" },
  ],
});
