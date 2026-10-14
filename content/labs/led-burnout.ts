// Blueprint: docs/curriculum/unit-1.md, L8, trimmed for a bench lesson and moved onto the half breadboard
// (docs/curriculum/conversion-guide.md, B3; foundations-options.md 3.1): led-burnout/lesson.yaml walks these tasks.
// One idea: less squeeze means more flow, and past its limit an LED dies for good. The battery's snap leads sit in the
// rails; a red jumper brings plus to strip 6, the resistor bridges strips 6 and 10, the LED stands in strips 10 and 11
// (long leg in 10) and a black jumper takes strip 11 back to minus. A stress bar over each LED shows its current as a
// share of its 50 mA maximum. Swapping a resistor means pulling the old one out and pushing the new one into c6 to c10.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The resistors bridging strip 6 (from plus) and strip 10 (the LED's long leg). */
const bridging = (lab: LabView) => lab.bench.parts.filter((p) => p.kind === "resistor" && lab.joins(p.id, "a6", "a10")).map((p) => p.id);
/** Nominal ohms of the one resistor in the loop, or null (none, or two side by side). */
const loopOhms = (lab: LabView): number | null => {
  const ids = bridging(lab);
  return ids.length === 1 ? ((lab.prop(ids[0]!) as { ohms?: number }).ohms ?? null) : null;
};
const leds = (lab: LabView) => lab.bench.parts.filter((p) => p.kind === "led").map((p) => p.id);
/** The LED standing in strips 10 and 11, long leg in 10 (the lamp's place). */
const inPlace = (lab: LabView, id: string) => lab.connected(`${id}.anode`, "a10") && lab.connected(`${id}.cathode`, "a11");
const glow = (lab: LabView, id: string) => lab.part(id)?.glow ?? 0;
const twoAtOnce = (lab: LabView) => bridging(lab).length > 1;

/** The fix-it bench: a fresh lamp running on 150 Ω, right at its limit. */
const AT_THE_LIMIT: SolutionStep[] = [
  { do: "move", part: "R1", at: "desk:-30,46" },
  { do: "move", part: "R3", at: "c6-c10" },
];

export default defineLab({
  id: "led-burnout",
  title: "How bright is too bright?",
  bench: {
    board: "half",
    frame: ["desk:-50,-34", "desk:60,54"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "c6-c10", params: { ohms: 1500, watts: 0.25 }, label: "1.5 kΩ resistor" },
      { id: "D1", kind: "led", at: "e10", params: { color: "red", maxmA: 50 }, label: "Red LED" },
    ],
    wires: [
      { id: "W1", from: "rail+:6", to: "a6", color: "red" },
      { id: "W2", from: "a11", to: "rail-:11", color: "black" },
    ],
    tray: [
      { id: "R2", kind: "resistor", params: { ohms: 470, watts: 0.25 }, count: 1 },
      { id: "R3", kind: "resistor", params: { ohms: 150, watts: 0.25 }, count: 1 },
      { id: "R4", kind: "resistor", params: { ohms: 15, watts: 0.25 }, count: 1 },
      { id: "D2", kind: "led", params: { color: "red", maxmA: 50 }, count: 3, label: "Spare LED" },
    ],
    // A stress bar over every LED: its current as a share of its maximum.
    instruments: [{ kind: "inspect", show: "stress", parts: ["led"] }],
  },
  mascot: {
    hint: "Less resistance, more current. Watch the stress bar.",
    fried: "Poor little LED. It gave everything it had.",
  },
  fried: (f) => (f.kind === "led" ? (loopOhms(f.lab) === 15 ? "Red LED, 15 Ω on 9 V" : "Red LED, too much current") : undefined),
  tasks: [
    {
      id: "brighter",
      prompt: "Swap the 1.5 kΩ resistor for the **470 Ω** one.",
      goal: (lab) => loopOhms(lab) === 470 && lab.isLit("D1") && glow(lab, "D1") > 0.5,
      hints: ["Pull the 1.5 kΩ out onto the desk.", "Push the 470 Ω from the tray into the same holes."],
      highlight: ["R1"],
      nudges: [{ when: twoAtOnce, say: "Two side by side. Pull the old one out." }],
      success: "Brighter.",
    },
    {
      id: "brighter-still",
      prompt: "Now **150 Ω**. Watch the stress bar above the LED.",
      goal: (lab) => loopOhms(lab) === 150 && glow(lab, "D1") > 0.8 && lab.part("D1")?.health !== "dead",
      hints: ["Swap the 470 Ω for the 150 Ω, same holes."],
      nudges: [{ when: twoAtOnce, say: "Two side by side. Pull the old one out." }],
      success: "Dazzling.",
    },
    {
      id: "too-far",
      prompt: "Go on. Try **15 Ω**.",
      goal: (lab) => lab.fried("led"),
      hints: ["Swap in the 15 Ω. Watch closely."],
      success: "Flash, then nothing.",
    },
    {
      id: "no-comeback",
      prompt: "Put 1.5 kΩ back. Does the LED recover? Then fit a fresh one.",
      goal: (lab) => {
        const safe = loopOhms(lab) === 1500;
        // The dead LED, still in its place, stays dark behind a safe resistor.
        if (safe && lab.part("D1")?.health === "dead" && inPlace(lab, "D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && safe && leds(lab).some((id) => lab.isLit(id) && inPlace(lab, id));
      },
      hints: ["The 1.5 kΩ back in c6 to c10. Look at the LED.", "Swap the dead LED for a spare. Long leg in 10."],
      highlight: ["D1"],
      nudges: [{ when: (lab) => loopOhms(lab) === 1500 && leds(lab).some((id) => id !== "D1" && (lab.part(id)?.v ?? 0) < -1), say: "Dark? Turn the new LED around." }],
      success: "Dead LEDs stay dead.",
    },
    {
      id: "brightest-survivor",
      prompt: "Fit the resistor for the brightest LED that survives.",
      // The bench answers: 15 Ω cooks the fresh LED, 470 Ω lives but is not the brightest, 150 Ω is.
      goal: (lab) => loopOhms(lab) === 150 && leds(lab).some((id) => inPlace(lab, id) && lab.isLit(id)),
      hints: ["Not the one that cooked it.", "Of the two that lived, which was brighter?"],
      highlight: ["R2", "R3"],
      nudges: [
        { when: (lab) => loopOhms(lab) === 470 && leds(lab).some((id) => inPlace(lab, id) && lab.isLit(id)), say: "It lives. Did another one live, brighter?" },
        { when: twoAtOnce, say: "Two side by side. Pull the old one out." },
      ],
      success: "Bright, and alive.",
    },
    {
      id: "fix-hot-lamp",
      prompt: "This lamp runs right at its limit. Calm it down.",
      setup: AT_THE_LIMIT,
      // Hot first (the setup), then a calm, lit lamp on 470 Ω: a bench that was never hot does not count.
      goal: (lab) => {
        if (loopOhms(lab) === 150) lab.memory["hot"] = true;
        const lamp = leds(lab).find((id) => inPlace(lab, id) && lab.isLit(id));
        return lab.memory["hot"] === true && loopOhms(lab) === 470 && !!lamp && (lab.part(lamp)?.i ?? 1) < 0.025;
      },
      hints: ["The stress bar is red. Less current, please.", "The 470 Ω is the sensible one."],
      highlight: ["R3"],
      nudges: [{ when: twoAtOnce, say: "Two side by side. Pull the old one out." }],
      success: "Fixed.",
    },
  ],
  solution: [
    { do: "move", part: "R1", at: "desk:-30,46" },
    { do: "place", part: "R2", kind: "resistor", params: { ohms: 470, watts: 0.25 }, at: "c6-c10" },
    { do: "check", task: "brighter" },
    { do: "move", part: "R2", at: "desk:-10,46" },
    { do: "place", part: "R3", kind: "resistor", params: { ohms: 150, watts: 0.25 }, at: "c6-c10" },
    { do: "check", task: "brighter-still" },
    { do: "move", part: "R3", at: "desk:10,46" },
    { do: "place", part: "R4", kind: "resistor", params: { ohms: 15, watts: 0.25 }, at: "c6-c10" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "too-far" },
    { do: "move", part: "R4", at: "desk:30,46" },
    { do: "move", part: "R1", at: "c6-c10" },
    { do: "wait", seconds: 1.2 },
    // The dead LED goes on the desk in front of the board, out of the way.
    { do: "move", part: "D1", at: "desk:52,44" },
    { do: "place", part: "D2", kind: "led", params: { color: "red", maxmA: 50 }, at: "e10" },
    { do: "check", task: "no-comeback" },
    { do: "move", part: "R1", at: "desk:-30,46" },
    { do: "move", part: "R3", at: "c6-c10" },
    { do: "check", task: "brightest-survivor" },
    ...AT_THE_LIMIT,
    { do: "move", part: "R3", at: "desk:10,46" },
    { do: "move", part: "R2", at: "c6-c10" },
    { do: "check", task: "fix-hot-lamp" },
  ],
});
