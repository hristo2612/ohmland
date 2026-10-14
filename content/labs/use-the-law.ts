// Blueprint: docs/curriculum/unit-1.md, L11, the second half of the split (docs/curriculum/conversion-guide.md, B3).
// A bench lesson's lab: its tasks are the beats of content/units/basics/voltage-and-ohms-law/use-the-law/lesson.yaml,
// in the same order (the sums themselves are the lesson's number checks).
// One idea: turn the law round to choose a resistor. A battery, an empty resistor holder and a red LED in one loop,
// with the meter already in series (on 20 mA, between battery plus and the holder). Four resistors in the tray.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { readsIn } from "./lib/meter";

/** The tray's resistors: a wild guess, the right pick, a dangerous one and the secret's. */
const PARTS = {
  R1: { ohms: 4700, watts: 0.25, actualOhms: 4700 },
  R2: { ohms: 470, watts: 0.25, actualOhms: 470 },
  R3: { ohms: 47, watts: 0.25, actualOhms: 47 },
  R4: { ohms: 10000, watts: 0.25, actualOhms: 10000 },
} as const;
const LABELS = { R1: "4.7 kΩ resistor", R2: "470 Ω resistor", R3: "47 Ω resistor", R4: "10 kΩ resistor" } as const;

/** The fix-it bench: the 47 Ω resistor in the holder instead of the 470 Ω one. */
const WRONG_PICK: SolutionStep[] = [{ do: "place", part: "R3", kind: "resistor", params: PARTS.R3, at: "in:H1" }];

const holds = (lab: LabView, id: string) => lab.heldBy(id) === "H1";
const counting = (lab: LabView) => lab.meter?.mode === "dca-ma" && lab.meter.red === "ma";

export default defineLab({
  id: "use-the-law",
  title: "Predict, then pick",
  bench: {
    board: "none",
    // The meter sits in front of the loop, so the bench stacks up a phone screen too.
    frame: ["desk:-104,-104", "desk:92,166"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-74,-36", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "H1", kind: "holder", at: "desk:0,-66", locked: true, label: "Resistor holder" },
      { id: "D1", kind: "led", at: "desk:58,-28", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
    ],
    leads: [
      { id: "TL1", from: "H1.b", to: "D1.anode", color: "yellow" },
      { id: "TL2", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: (Object.keys(PARTS) as (keyof typeof PARTS)[]).map((id) => ({ id, kind: "resistor" as const, params: PARTS[id], label: LABELS[id], count: 1 })),
    instruments: [{ kind: "meter", at: "desk:4,84", rot: 0, mode: "dca-ma", range: "20mA", red: "ma", black: "com", probes: { red: "B1.pos", black: "H1.a" } }],
  },
  mascot: {
    start: "My LED wants 15 mA. Which resistor? Let's not guess.",
    hint: "Volts divided by milliamps gives kilohms.",
    fried: "Pop. Too little squeeze, too much flow.",
    success: "Calculate, pick, prove.",
  },
  fried: { led: "Red LED, 47 Ω on 9 V" },
  tasks: [
    {
      id: "wild-guess",
      prompt: "Drop the 4.7 kΩ resistor in the holder.",
      goal: (lab) => holds(lab, "R1") && counting(lab) && readsIn(lab, 1.4, 1.8),
      hints: ["Drag the 4.7 kΩ resistor from the tray onto the holder."],
      highlight: ["H1"],
      success: "About 1.6 mA.",
    },
    {
      id: "pick-and-prove",
      prompt: "Drop the nearest real value in. The meter should read about 15 mA.",
      goal: (lab) => holds(lab, "R2") && lab.isLit("D1") && counting(lab) && readsIn(lab, 14, 16),
      hints: ["You worked out about 467 Ω. Which tray resistor is closest?", "The 470 Ω one."],
      highlight: ["H1"],
      nudges: [
        { when: (lab) => holds(lab, "R1"), say: "Still the dim one. Try another." },
        { when: (lab) => holds(lab, "R3"), say: "OL! Far too much flow. Pull it out!" },
        { when: (lab) => holds(lab, "R4"), say: "Even dimmer. Nearer 467 Ω, please." },
      ],
      success: "About 15 mA.",
    },
    {
      id: "fix-wrong-pick",
      prompt: "I picked 47 Ω this time. Fix it before it pops.",
      setup: WRONG_PICK,
      // Broken first (the setup), then the 470 Ω back in the holder and about 15 mA again.
      goal: (lab) => {
        if (holds(lab, "R3")) lab.memory["wrong"] = true;
        return lab.memory["wrong"] === true && holds(lab, "R2") && lab.isLit("D1") && counting(lab) && readsIn(lab, 14, 16);
      },
      hints: ["The meter reads OL: far over 20 mA.", "Swap in the 470 Ω resistor."],
      highlight: ["H1", "R2"],
      success: "Fixed.",
    },
    {
      id: "ten-k",
      prompt: "Predict the current through 10 kΩ, then drop it in.",
      goal: (lab) => holds(lab, "R4") && counting(lab) && readsIn(lab, 0.6, 0.9),
      hints: ["About 7.4 V ÷ 10 kΩ."],
      success: "Under 1 mA.",
      bonus: true,
    },
  ],
  solution: [
    { do: "place", part: "R1", kind: "resistor", params: PARTS.R1, at: "in:H1" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "wild-guess" },
    { do: "place", part: "R2", kind: "resistor", params: PARTS.R2, at: "in:H1" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "pick-and-prove" },
    ...WRONG_PICK,
    { do: "wait", seconds: 0.5 },
    { do: "move", part: "R2", at: "in:H1" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-wrong-pick" },
    { do: "place", part: "R4", kind: "resistor", params: PARTS.R4, at: "in:H1" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "ten-k" },
  ],
});
