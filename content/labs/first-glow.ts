// Blueprint: docs/curriculum/unit-1.md, L7. The reference lab of a bench lesson (docs/LESSONS.md): its tasks are the
// beats of content/units/basics/current-and-leds/first-glow/lesson.yaml, in the same order.
// One idea: an LED works one way round (long leg toward plus), and it needs a resistor.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** Battery, resistor and LED in one loop, in either order. */
const loop = (lab: LabView) => lab.seriesLoop(["B1", "R1", "D1"]) || lab.seriesLoop(["B1", "D1", "R1"]);
const lit = (lab: LabView) => lab.isLit("D1") && loop(lab);
/** In the loop but facing the wrong way: nearly the whole battery sits across it backwards. */
const backwards = (lab: LabView) => loop(lab) && (lab.part("D1")?.v ?? 0) < -1 && (lab.part("D1")?.glow ?? 1) < 0.01;
const shorted = (lab: LabView) => lab.count("shorted", undefined, 1) > 0;

/** The fix-it bench: the battery's two clips swapped, so the LED faces the wrong way round the loop. */
const SWAP_BATTERY: SolutionStep[] = [
  { do: "clip", lead: "TL1", end: "a", to: "B1.neg" },
  { do: "clip", lead: "TL3", end: "b", to: "B1.pos" },
];

export default defineLab({
  id: "first-glow",
  title: "Your first glow",
  bench: {
    board: "none",
    parts: [
      // Loose and unconnected.
      { id: "B1", kind: "battery", at: "desk:-74,6", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:0,-20", params: { ohms: 1500, watts: 0.25 }, locked: true, label: "1.5 kΩ resistor" },
      // 5 mm, longer anode lead, flat spot on the cathode side of the rim.
      { id: "D1", kind: "led", at: "desk:58,12", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
    ],
    tray: [
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "green" }, count: 1 },
      { kind: "lead", params: { color: "black" }, count: 1 },
    ],
    instruments: [],
  },
  mascot: {
    hint: "Long leg toward plus. Flat side toward minus.",
    fried: "Pop. No resistor, no mercy.",
  },
  fried: { led: "Red LED, no resistor on 9 V" },
  tasks: [
    {
      id: "build-loop",
      prompt: "Clip a loop: plus, resistor, LED, back to minus.",
      goal: lit,
      hints: [
        "Drag a clip lead from the tray. Clip each end to bare metal.",
        "Plus to the resistor, resistor to the LED, LED back to minus.",
        "The LED's long leg faces plus. Its flat side faces minus.",
      ],
      highlight: ["pin:B1.pos", "pin:R1.a", "pin:R1.b", "pin:D1.anode", "pin:D1.cathode", "pin:B1.neg"],
      nudges: [
        { when: backwards, say: "Dark? Turn the LED around. Long leg to plus." },
        { when: shorted, say: "Whoa. That's plus straight to minus." },
      ],
      success: "It glows!",
    },
    {
      id: "flip-led",
      prompt: "Swap the LED's legs.",
      goal: backwards,
      hints: ["Move the two clips on the LED to the other legs."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      success: "Dark, and not broken.",
      notice: "Almost the whole 9 V sits across it backwards. The resistor keeps the current tiny.",
    },
    {
      id: "flip-back",
      prompt: "Make it glow again.",
      goal: lit,
      hints: ["Swap the LED's two clips again."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      success: "Glowing again.",
    },
    {
      id: "fix-reversed",
      prompt: "Something's off. Make it glow.",
      setup: SWAP_BATTERY,
      // Broken first (the setup), then fixed: a bench that is already lit does not count.
      goal: (lab) => {
        if (!lab.isLit("D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && lit(lab);
      },
      hints: ["Follow the loop from plus. Which leg does it reach first?", "The long leg must face plus. Swap the LED's clips."],
      highlight: ["pin:B1.pos", "pin:D1.anode"],
      nudges: [{ when: shorted, say: "Whoa. That's plus straight to minus." }],
      success: "Fixed.",
    },
    {
      id: "no-resistor",
      prompt: "Leave the resistor out.",
      goal: (lab) => lab.fried("led"),
      hints: ["Clip the LED straight across the battery, no resistor in the loop."],
      success: "Far too much current.",
      bonus: true,
    },
  ],
  solution: [
    { do: "lead", id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
    { do: "lead", id: "TL2", from: "R1.b", to: "D1.anode", color: "green" },
    { do: "lead", id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    { do: "check", task: "build-loop" },
    { do: "clip", lead: "TL2", end: "b", to: "D1.cathode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.anode" },
    { do: "check", task: "flip-led" },
    { do: "clip", lead: "TL2", end: "b", to: "D1.anode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.cathode" },
    { do: "check", task: "flip-back" },
    ...SWAP_BATTERY,
    { do: "clip", lead: "TL2", end: "b", to: "D1.cathode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.anode" },
    { do: "check", task: "fix-reversed" },
    // The secret: move the clip from the resistor's far end onto its near end, so the LED sits straight across the
    // battery.
    { do: "clip", lead: "TL2", end: "a", to: "R1.a" },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "no-resistor" },
  ],
});
