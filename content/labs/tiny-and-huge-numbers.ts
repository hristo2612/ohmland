// Blueprint: docs/curriculum/unit-1.md, L3, trimmed for a bench lesson (docs/curriculum/conversion-guide.md, B3):
// content/units/basics/resistance/tiny-and-huge-numbers/lesson.yaml walks these tasks in order.
// One idea: a range is the biggest number the meter can show, and OL means go up. The probes start on the 9 V
// battery with the meter off but already on its 2 V range, so turning the dial to volts shows OL at once.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { rangeIs, readsIn, showsOL } from "./lib/meter";

const volts = (lab: LabView) => lab.meter?.mode === "dcv";
const onBattery = (lab: LabView) => volts(lab) && lab.across("B1");
const onCell = (lab: LabView) => volts(lab) && lab.across("X1");
/** On a bigger range than it needs: it fits, with fewer digits. */
const tooBig = (lab: LabView) => rangeIs(lab, "200V") || rangeIs(lab, "600V");

/** The fix-it bench: the AA on the 200 V range, which shows a blunt 1.6. */
const BLUNT: SolutionStep[] = [{ do: "dial", mode: "dcv", range: "200V" }];

export default defineLab({
  id: "tiny-and-huge-numbers",
  title: "Pick the right range",
  bench: {
    board: "none",
    frame: ["desk:-104,-34", "desk:118,58"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-74,4", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // An AA cell lying in a small cradle, end caps showing.
      { id: "X1", kind: "battery", at: "desk:-10,36", params: { size: "aa", chem: "alkaline", emf: 1.58, internalOhms: 0.15, mAh: 2500 }, locked: true, label: "AA cell" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:76,2", mode: "off", range: "2V", probes: { red: "B1.pos", black: "B1.neg" } }],
  },
  mascot: {
    hint: "OL? Nothing's broken. Turn the range up one step.",
  },
  tasks: [
    {
      id: "over-the-limit",
      prompt: "Turn the dial to DC volts.",
      goal: (lab) => onBattery(lab) && rangeIs(lab, "2V") && showsOL(lab),
      hints: ["Tap V on the meter's dial."],
      highlight: ["part:M1/dial"],
      nudges: [{ when: (lab) => volts(lab) && !rangeIs(lab, "2V"), say: "Keep the 2 V range for this one." }],
      success: "OL: over limit.",
    },
    {
      id: "climb-a-range",
      prompt: "Go up one range at a time until you see a number.",
      goal: (lab) => onBattery(lab) && rangeIs(lab, "20V") && readsIn(lab, 9.0, 9.6),
      hints: ["The next range up from 2 V is 20 V."],
      nudges: [
        { when: (lab) => onBattery(lab) && tooBig(lab), say: "It fits. One step lower shows more digits." },
        { when: (lab) => onBattery(lab) && rangeIs(lab, "200mV"), say: "That's smaller still. Go the other way." },
      ],
      success: "20 V: the first range that fits.",
    },
    {
      id: "aa-cell",
      prompt: "Measure the AA cell. Most digits, no OL.",
      goal: (lab) => onCell(lab) && rangeIs(lab, "2V") && readsIn(lab, 1.4, 1.65),
      hints: ["Move both probes to the AA. Red on its bump.", "An AA is about 1.5 V. Which range just fits that?"],
      highlight: ["pin:X1.pos", "pin:X1.neg"],
      nudges: [
        { when: (lab) => onCell(lab) && showsOL(lab), say: "OL. Up one range." },
        { when: (lab) => onCell(lab) && (rangeIs(lab, "20V") || tooBig(lab)), say: "It fits. Can a smaller range fit too?" },
      ],
      success: "1.580 V.",
    },
    {
      id: "fix-aa",
      prompt: "The AA reads a blunt 1.6. Get more digits.",
      setup: BLUNT,
      // Blunt first (the setup), then sharp: a bench that never left 2 V does not count.
      goal: (lab) => {
        if (tooBig(lab)) lab.memory["blunt"] = true;
        return lab.memory["blunt"] === true && onCell(lab) && rangeIs(lab, "2V") && readsIn(lab, 1.4, 1.65);
      },
      hints: ["1.6 fits in a much smaller range.", "Step the range down until just before OL."],
      highlight: ["part:M1/range"],
      nudges: [{ when: (lab) => onCell(lab) && showsOL(lab), say: "Too far down. One step back up." }],
      success: "Fixed.",
    },
    {
      id: "two-hundred",
      prompt: "Try the 200 V range on the 9 V battery.",
      goal: (lab) => onBattery(lab) && rangeIs(lab, "200V") && readsIn(lab, 9.0, 9.6),
      hints: ["Probes back on the 9 V battery, then pick 200 V."],
      success: "9.4: it works, with fewer digits.",
      bonus: true,
    },
  ],
  solution: [
    { do: "dial", mode: "dcv" },
    { do: "check", task: "over-the-limit" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "check", task: "climb-a-range" },
    { do: "probe", red: "X1.pos", black: "X1.neg" },
    { do: "dial", mode: "dcv", range: "2V" },
    { do: "check", task: "aa-cell" },
    ...BLUNT,
    { do: "dial", mode: "dcv", range: "2V" },
    { do: "check", task: "fix-aa" },
    // The secret: back on the 9 V battery, one range too big.
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "dial", mode: "dcv", range: "200V" },
    { do: "check", task: "two-hundred" },
  ],
});
