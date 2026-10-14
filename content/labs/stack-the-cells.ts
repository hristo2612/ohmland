// Blueprint: docs/curriculum/unit-1.md, L17, trimmed (docs/curriculum/conversion-guide.md, B3 17). The lab of a bench
// lesson (docs/LESSONS.md): content/units/basics/cells-and-batteries/stack-the-cells. One idea: cells chained plus to
// minus add their push. Four lemon cells in a row (copper on the left of each, zinc on the right), a loose red LED,
// five clip leads, the meter on DC volts (20V, so the whole stack fits without a range change) and a room-lights
// slider so a faint glow shows.
// From the simulator: two cells 1.83 V, back to back about 0 V, four 3.66 V; the LED across four glows faintly
// (0.4 mA) and pulls the stack down to 1.70 V; with one cell of four turned round the stack reads 1.86 V alone,
// 1.59 V with the LED on it, and the LED is ten times dimmer.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { readsIn } from "./lib/meter";

const CELLS = ["FC1", "FC2", "FC3", "FC4"];
const pairs = CELLS.flatMap((a, i) => CELLS.slice(i + 1).map((b) => [a, b]));

/** Some cells linked in one chain, all the same way round (aiding), with the red probe on its plus end and black on its minus. */
const stackProbed = (lab: LabView, ids: string[]): boolean => {
  const c = lab.chain(ids);
  return !!c && c.flipped.length === 0 && lab.probed(c.ends[0], c.ends[1]);
};

/** Four cells in series with exactly one turned round, the probes across the whole chain. */
const upsideDown = (lab: LabView): boolean => {
  const c = lab.chain(CELLS);
  return !!c && c.flipped.length === 1 && lab.probed(c.ends[0], c.ends[1], "either");
};

/** The LED across all four cells, all aiding, long leg on the plus end, glowing. */
const fruitLamp = (lab: LabView, glow: number): boolean => {
  const c = lab.chain(CELLS);
  return (
    !!c &&
    c.flipped.length === 0 &&
    lab.connected("D1.anode", c.ends[0]) &&
    lab.connected("D1.cathode", c.ends[1]) &&
    (lab.part("D1")?.glow ?? 0) > glow &&
    lab.amps("D1") > 0.0002
  );
};

/** The fix-it bench: the lit fruit lamp with the third cell turned round, and the probes lifted. */
const ONE_REVERSED: SolutionStep[] = [
  { do: "probe", red: null, black: null },
  { do: "clip", lead: "TL2", end: "b", to: "FC3.neg" },
  { do: "clip", lead: "TL3", end: "a", to: "FC3.pos" },
];

export default defineLab({
  id: "stack-the-cells",
  title: "Stack the cells",
  bench: {
    board: "none",
    frame: ["desk:-205,-70", "desk:180,80"],
    parts: [
      { id: "FC1", kind: "lemon", at: "desk:-170,-26", params: { emf: 0.92, internalOhms: 1200 }, locked: true, label: "Lemon cell 1" },
      { id: "FC2", kind: "lemon", at: "desk:-100,-26", params: { emf: 0.91, internalOhms: 1050 }, locked: true, label: "Lemon cell 2" },
      { id: "FC3", kind: "lemon", at: "desk:-30,-26", params: { emf: 0.93, internalOhms: 1350 }, locked: true, label: "Lemon cell 3" },
      { id: "FC4", kind: "lemon", at: "desk:40,-26", params: { emf: 0.9, internalOhms: 1150 }, locked: true, label: "Lemon cell 4" },
      { id: "D1", kind: "led", at: "desk:-60,52", rot: 90, params: { color: "red", maxmA: 50 }, label: "Red LED" },
    ],
    tray: [
      { kind: "lead", params: { color: "yellow" }, count: 1 },
      { kind: "lead", params: { color: "green" }, count: 1 },
      { kind: "lead", params: { color: "blue" }, count: 1 },
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "black" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:128,6", mode: "dcv", range: "20V", tips: { red: "desk:-10,58", black: "desk:10,64" } }],
    controls: [{ id: "room", label: "Room lights", key: "room", min: 0.1, max: 1, value: 1, step: 0.05, unit: "%" }],
  },
  notebook: { tags: { "upside-down": upsideDown } },
  // The Upside down achievement: one cell of four turned round, and the stack measured (about 1.9 V on its own, about
  // 1.6 V with the LED drawing from it).
  triggers: {
    "upside-down": (lab) => lab.readings("upside-down").some((r) => Math.abs(r.si) >= 1.5 && Math.abs(r.si) <= 2.0),
  },
  mascot: {
    hint: "Zinc to copper at every link. Copper to copper cancels out.",
  },
  tasks: [
    {
      id: "two-in-series",
      prompt: "Clip one cell's zinc to the next one's copper. Measure across both.",
      goal: (lab) => lab.meter?.mode === "dcv" && pairs.some((p) => stackProbed(lab, p)) && readsIn(lab, 1.7, 1.95),
      hints: ["Copper is the reddish strip, zinc the grey one.", "Red on the free copper, black on the free zinc."],
      highlight: ["pin:FC1.neg", "pin:FC2.pos"],
      success: "About 1.8 V.",
    },
    {
      id: "wrong-way",
      prompt: "Now link them copper to copper. Measure the free ends.",
      goal: (lab) =>
        lab.meter?.mode === "dcv" &&
        pairs.some((p) => {
          const c = lab.chain(p);
          return !!c && c.flipped.length === 1 && lab.probed(c.ends[0], c.ends[1], "either");
        }) &&
        readsIn(lab, -0.1, 0.1),
      hints: ["Move one clip from a zinc to that cell's copper.", "Then probe the two free zinc strips."],
      success: "Almost nothing.",
    },
    {
      id: "four-stack",
      prompt: "Chain all four, zinc to copper. Measure the stack.",
      goal: (lab) => lab.meter?.mode === "dcv" && stackProbed(lab, CELLS) && readsIn(lab, 3.4, 3.8),
      hints: ["Every link joins a zinc to the next copper.", "Red on the first copper, black on the last zinc."],
      highlight: ["FC1", "FC2", "FC3", "FC4"],
      success: "About 3.6 V.",
    },
    {
      id: "light-it",
      prompt: "LED across the stack: long leg to copper. Dim the lights.",
      goal: (lab) => fruitLamp(lab, 0.02),
      hints: ["Long leg toward copper, the plus end of the stack.", "It will be faint. Try the room-lights slider."],
      highlight: ["pin:D1.anode", "pin:D1.cathode"],
      success: "A glow from fruit!",
    },
    {
      id: "why-no-resistor",
      prompt: "LED still lit, measure the stack again.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.isLit("D1", 0.02) && stackProbed(lab, CELLS) && readsIn(lab, 1.5, 2.0),
      hints: ["Probes on the free copper and the free zinc."],
      success: "Down to about 1.7 V. The lemons' own resistance holds the flow back.",
      bonus: true,
    },
    {
      id: "one-reversed",
      prompt: "My fruit lamp went dim. Fix it.",
      setup: ONE_REVERSED,
      // A cell turned round first (the setup), then the whole chain aiding and the lamp glowing properly again.
      goal: (lab) => {
        const c = lab.chain(CELLS);
        if (c && c.flipped.length === 1) lab.memory["rebel"] = true;
        return lab.memory["rebel"] === true && fruitLamp(lab, 0.12);
      },
      hints: ["Follow the chain. Every link should join a zinc to a copper.", "One cell is linked copper to copper. Turn its clips round."],
      highlight: ["FC3"],
      success: "Bright again. Every cell pushing the same way.",
    },
  ],
  solution: [
    { do: "lead", id: "TL1", from: "FC1.neg", to: "FC2.pos", color: "yellow" },
    { do: "probe", red: "FC1.pos", black: "FC2.neg" },
    { do: "check", task: "two-in-series" },
    { do: "clip", lead: "TL1", end: "a", to: "FC1.pos" },
    { do: "probe", red: "FC1.neg", black: "FC2.neg" },
    { do: "check", task: "wrong-way" },
    { do: "clip", lead: "TL1", end: "a", to: "FC1.neg" },
    { do: "lead", id: "TL2", from: "FC2.neg", to: "FC3.pos", color: "green" },
    { do: "lead", id: "TL3", from: "FC3.neg", to: "FC4.pos", color: "blue" },
    { do: "probe", red: "FC1.pos", black: "FC4.neg" },
    { do: "check", task: "four-stack" },
    { do: "lead", id: "TL4", from: "D1.anode", to: "FC1.pos", color: "red" },
    { do: "lead", id: "TL5", from: "D1.cathode", to: "FC4.neg", color: "black" },
    { do: "control", id: "room", value: 0.3 },
    { do: "wait", seconds: 1 },
    { do: "check", task: "light-it" },
    ...ONE_REVERSED,
    // Measure the stack with the rebel in it (the Upside down achievement), then turn the cell back round.
    { do: "probe", red: "FC1.pos", black: "FC4.neg" },
    { do: "wait", seconds: 1 },
    { do: "clip", lead: "TL2", end: "b", to: "FC3.pos" },
    { do: "clip", lead: "TL3", end: "a", to: "FC3.neg" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "one-reversed" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "why-no-resistor" },
  ],
});
