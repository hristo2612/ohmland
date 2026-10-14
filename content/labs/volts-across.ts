// Blueprint: docs/curriculum/unit-1.md, L10, split (docs/curriculum/conversion-guide.md, B3). A bench lesson's lab: its
// tasks are the beats of content/units/basics/voltage-and-ohms-law/volts-across/lesson.yaml, in the same order.
// One idea: push is measured across a part, with the circuit running. The drops adding up moved to share-the-push.
// The lit loop from measure-the-flow, with the meter left in a trap: red lead in mA and the dial on DC mA, as if from
// last time. Probing anything like that blows the meter's fuse.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { readsIn } from "./lib/meter";

/** The fix-it bench: the yellow lead unclipped from the LED and the meter, on volts, put into the gap. */
const METER_IN_GAP: SolutionStep[] = [
  { do: "clip", lead: "L2", end: "b", to: null },
  { do: "probe", red: "R1.b", black: "D1.anode", range: "20V" },
];

const onVolts = (lab: LabView) => lab.meter?.mode === "dcv" && lab.meter.red === "vohm";
/** The probes sit across one of the loop's parts (either way round). */
const acrossAPart = (lab: LabView) => ["B1", "R1", "D1"].some((id) => lab.across(id, "either"));

export default defineLab({
  id: "volts-across",
  title: "Across, not in",
  bench: {
    board: "none",
    // The meter sits in front of the loop, so the bench stacks up a phone screen too.
    frame: ["desk:-104,-104", "desk:92,166"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-74,-36", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-6,-66", params: { ohms: 470, watts: 0.25, actualOhms: 470 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:58,-28", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
    ],
    leads: [
      { id: "L1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "L2", from: "R1.b", to: "D1.anode", color: "yellow" },
      { id: "L3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:4,84", rot: 0, mode: "dca-ma", range: "200mA", red: "ma", black: "com" }],
  },
  mascot: {
    start: "Lamp's lit. Let's measure its push, no cutting.",
    hint: "Red lead still in mA? Move it before you touch anything.",
    fried: "The leftover-lead trap. Happens to everyone. Pop in a new fuse.",
    success: "Push measured, nothing cut.",
  },
  fried: { "meter-fuse": "Meter fuse, 200 mA (red lead left in mA)" },
  tasks: [
    {
      id: "move-the-plug",
      prompt: "Move the red plug from **mA** into **VΩ**.",
      goal: (lab) => lab.meter?.red === "vohm",
      hints: ["Drag the red plug out of mA and drop it on VΩ.", "VΩ is the socket right beside COM."],
      highlight: ["socket:ma", "socket:vohm"],
      success: "Safe now.",
    },
    {
      id: "reset-meter",
      prompt: "Turn the dial to DC volts.",
      goal: onVolts,
      hints: ["Click the V with a straight line on the dial."],
      highlight: ["part:M1"],
      nudges: [{ when: (lab) => lab.meter?.mode === "dcv" && lab.meter.red === "ma", say: "Dial's right. The red plug is back in mA." }],
      success: "Ready for volts.",
    },
    {
      id: "resistor-volts",
      prompt: "Across the resistor: red on the end nearer plus.",
      goal: (lab) => onVolts(lab) && lab.across("R1") && readsIn(lab, 6.9, 7.9),
      hints: ["One probe on each end of the resistor. Nothing gets unclipped.", "Red goes on the end with the red clip lead."],
      highlight: ["pin:R1.a", "pin:R1.b"],
      nudges: [{ when: (lab) => onVolts(lab) && lab.across("R1", "rev"), say: "A minus sign? Swap the probes." }],
      success: "About 7.4 V.",
    },
    {
      id: "led-volts",
      prompt: "Across the LED: red on the long leg.",
      goal: (lab) => onVolts(lab) && lab.across("D1") && readsIn(lab, 1.8, 2.1),
      hints: ["The long leg (anode) has the yellow lead on it."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      nudges: [{ when: (lab) => onVolts(lab) && lab.across("D1", "rev"), say: "A minus sign? Swap the probes." }],
      success: "About 2 V.",
    },
    {
      id: "fix-in-gap",
      prompt: "The lamp died the moment I measured. Fix it.",
      setup: METER_IN_GAP,
      // Broken first (the setup), then lit with the probes across a part.
      goal: (lab) => {
        if (!lab.isLit("D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && lab.isLit("D1") && onVolts(lab) && acrossAPart(lab) && readsIn(lab, 1.5, 9.6);
      },
      hints: ["The meter sits in the gap. Clip the yellow lead back on.", "Then put the probes across a part."],
      highlight: ["L2", "pin:D1.anode"],
      nudges: [{ when: (lab) => lab.isLit("D1") && !acrossAPart(lab), say: "Lit again! Now probe across a part." }],
      success: "Fixed.",
    },
  ],
  solution: [
    { do: "plug", probe: "red", socket: "vohm" },
    { do: "check", task: "move-the-plug" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "check", task: "reset-meter" },
    { do: "probe", red: "R1.a", black: "R1.b" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "resistor-volts" },
    { do: "probe", red: "D1.anode", black: "D1.cathode" },
    { do: "wait", seconds: 0.8 },
    { do: "check", task: "led-volts" },
    ...METER_IN_GAP,
    { do: "clip", lead: "L2", end: "b", to: "D1.anode" },
    { do: "probe", red: "D1.anode", black: "D1.cathode" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-in-gap" },
  ],
});
