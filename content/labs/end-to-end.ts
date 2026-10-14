// Blueprint: docs/curriculum/unit-1.md, L12, the first half of the split (docs/curriculum/conversion-guide.md, B3).
// A bench lesson's lab: its tasks are the beats of content/units/basics/voltage-and-ohms-law/end-to-end/lesson.yaml, in
// the same order. One idea: in series, squeezes add.
// Half-size board, the battery's snap leads in the near rails, the meter behind the board so its probes lean away from
// the parts. R1 (1 kΩ) stands in strips 10 and 14; the meter, on ohms, already probes strips 10 and 18 (row e), so it
// reads OL until R2 bridges the gap. Then the power comes in, a black jumper takes strip 22 to minus, and the meter
// (set for current with its probes lifted, so the dial and sockets show) counts the flow by bridging strips 18 and 22.
// A 3.3 kΩ resistor waits in the tray for the secret.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { readsIn, siIn } from "./lib/meter";

const R1 = { ohms: 1000, watts: 0.25, actualOhms: 1000 };
const R2 = { ohms: 1000, watts: 0.25, actualOhms: 990 };
const R3 = { ohms: 3300, watts: 0.25, actualOhms: 3300 };

/** Power comes in: both probes lifted off the board, red jumper plus to strip 10, black jumper strip 22 to minus. */
const POWER_ON: SolutionStep[] = [
  { do: "probe", red: null, black: null },
  { do: "wire", id: "W1", from: "rail+:9", to: "a10", color: "red" },
  { do: "wire", id: "W2", from: "a22", to: "rail-:23", color: "black" },
];

/** The fix-it bench: a yellow jumper across R2's two strips. */
const SHORTED_R2: SolutionStep[] = [{ do: "wire", id: "W3", from: "a14", to: "a18", color: "yellow" }];

/** The probes sit on the two free ends of the chain of resistors. */
const acrossChain = (lab: LabView, ids: string[]): boolean => {
  const c = lab.chain(ids);
  return !!c && lab.probed(c.ends[0], c.ends[1], "either");
};
const counting = (lab: LabView) => lab.meter?.mode === "dca-ma" && lab.meter.red === "ma";
const series = (lab: LabView) => lab.chain(["R1", "R2"]) !== null && !lab.connected("R2.a", "R2.b");

export default defineLab({
  id: "end-to-end",
  title: "End to end",
  bench: {
    board: "half",
    frame: ["desk:-62,-186", "desk:62,62"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "c10", params: R1, locked: true, label: "1 kΩ resistor" },
      { id: "R2", kind: "resistor", at: "desk:18,42", params: R2, label: "1 kΩ resistor" },
    ],
    tray: [{ id: "R3", kind: "resistor", params: R3, label: "3.3 kΩ resistor", count: 1 }],
    instruments: [{ kind: "meter", at: "desk:4,-108", rot: 0, mode: "ohm", range: "20k", probes: { red: "e18", black: "e10" } }],
  },
  mascot: {
    start: "Two resistors, nose to tail. More squeeze, or less?",
    hint: "End to end: one leg of each shares a strip.",
    fried: "Oof. That one's for the Hall.",
    success: "End to end, squeezes add.",
  },
  tasks: [
    {
      id: "series-ohms",
      prompt: "Bridge the gap with R2: strip 14 to strip 18.",
      goal: (lab) => lab.meter?.mode === "ohm" && acrossChain(lab, ["R1", "R2"]) && siIn(lab, 1900, 2100),
      hints: ["Drag R2 onto the board. One leg in strip 14, one in strip 18.", "Strip 14 already holds R1's right leg."],
      highlight: ["R2", "hole:d14", "hole:d18"],
      nudges: [{ when: (lab) => lab.parallel("R1", "R2"), say: "That's side by side. Nose to tail, please." }],
      success: "About 2 kΩ.",
    },
    {
      id: "meter-on-ma",
      prompt: "Power on. Set the meter for flow: red plug in **mA**, dial on **mA**.",
      setup: POWER_ON,
      goal: counting,
      hints: ["Drag the red plug from VΩ into mA.", "Then the dial: click mA."],
      highlight: ["socket:vohm", "socket:ma"],
      nudges: [{ when: (lab) => lab.meter?.mode === "dca-ma" && lab.meter.red === "vohm", say: "Dial's right. Now the red plug, into mA." }],
      success: "Ready to count.",
    },
    {
      id: "series-current",
      prompt: "Bridge the gap with the meter: red probe in strip 18, black in strip 22.",
      goal: (lab) => series(lab) && counting(lab) && lab.meterInSeriesWith("R1") && readsIn(lab, 4.3, 5.0),
      hints: ["The gap is between strips 18 and 22.", "Red probe in strip 18, black probe in strip 22."],
      highlight: ["probe:red", "probe:black", "hole:e18", "hole:e22"],
      nudges: [{ when: (lab) => counting(lab) && (lab.meter?.value ?? 0) < -0.1, say: "A minus sign? Swap the probes." }],
      success: "About 4.7 mA.",
    },
    {
      id: "fix-shorted",
      prompt: "These two should pass 4.7 mA. Mine pass 9.3. Fix it.",
      setup: SHORTED_R2,
      // Broken first (the setup), then the pair back in series, about 4.7 mA.
      goal: (lab) => {
        if (lab.connected("R2.a", "R2.b")) lab.memory["short"] = true;
        return lab.memory["short"] === true && series(lab) && counting(lab) && readsIn(lab, 4.3, 5.0);
      },
      hints: ["Something lets the flow skip R2.", "Take the yellow jumper out."],
      highlight: ["W3"],
      success: "Fixed.",
    },
    {
      id: "swap-in-3k3",
      prompt: "Swap R2 for the 3.3 kΩ resistor.",
      goal: (lab) => lab.chain(["R1", "R3"]) !== null && counting(lab) && readsIn(lab, 2.0, 2.4),
      hints: ["Drop the 3.3 kΩ resistor right onto R2."],
      success: "About 2.2 mA.",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "R2", at: "d14" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "series-ohms" },
    ...POWER_ON,
    { do: "plug", probe: "red", socket: "ma" },
    { do: "dial", mode: "dca-ma" },
    { do: "check", task: "meter-on-ma" },
    { do: "probe", red: "e18", black: "e22" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "series-current" },
    ...SHORTED_R2,
    { do: "wait", seconds: 0.3 },
    { do: "unwire", wire: "W3" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-shorted" },
    // The secret: the 3.3 kΩ dropped onto R2 takes its place.
    { do: "place", part: "R3", kind: "resistor", params: R3, at: "on:R2" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "swap-in-3k3" },
  ],
});
