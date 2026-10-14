// Start here, case 12: "The torn blueprint" (docs/curriculum/start-here.md, SH12). A bench lesson (docs/LESSONS.md):
// its tasks are the beats of content/units/start-here/tool-cases/first-glow/lesson.yaml, in the same order.
// One idea: a drawing shows connections, not places.
// A half board with the battery on its rails and two jumpers already in: plus into strip 5, strip 10 back to minus.
// The drawing (battery, 1 kΩ resistor, LED) lost its LED; the learner mends it, then builds it from the tray.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** As drawn: plus, the 1 kΩ resistor, the LED, back to minus. */
const asDrawn = (lab: LabView) => lab.isLit("D1") && lab.seriesLoop(["B1", "R1", "D1"]);
/** Where the LED's legs sit, as one string ("anode:d9 cathode:d10"). */
const ledHoles = (lab: LabView) => {
  const h = lab.benchPart("D1")?.holes ?? {};
  return Object.keys(h)
    .sort()
    .map((k) => `${k}:${h[k]}`)
    .join(" ");
};
/** The solution's LED, where a resumed visit finds it after the build. */
const BUILT_AT = "anode:d9 cathode:d10";
/** In the loop but turned the wrong way: dark, nearly the whole battery across it backwards. */
const backwards = (lab: LabView) => (lab.part("D1")?.v ?? 0) < -1 && (lab.part("D1")?.glow ?? 1) < 0.01;
/** Lit with the wrong resistor from the tray. */
const wrongResistor = (lab: LabView) => lab.isLit("D1") && (lab.seriesLoop(["B1", "R2", "D1"]) || lab.seriesLoop(["B1", "R3", "D1"]));

/** The fix-it bench: the LED turned round in its holes, so its short leg faces plus. */
const LED_BACKWARDS: SolutionStep[] = [{ do: "move", part: "D1", at: "b10", rot: 180 }];

export default defineLab({
  id: "first-glow",
  title: "The torn blueprint",
  bench: {
    board: "half",
    frame: ["desk:-92,-124", "desk:96,32"],
    parts: [
      { id: "B1", kind: "battery", at: "rails", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // The drawing: battery on the left, plus at the top, then the resistor and the LED clockwise. The LED is torn off.
      {
        id: "CARD",
        kind: "schematic",
        at: "desk:-18,-82",
        params: { symbols: [{ kind: "battery", part: "B1" }, { kind: "resistor", part: "R1", text: "1 kΩ" }, { kind: "led", part: "D1" }], torn: 2, title: "Blueprint" },
        locked: true,
        label: "Blueprint",
      },
      // The torn piece, turned so its triangle points back toward plus.
      { id: "PC", kind: "piece", at: "desk:72,-82", params: { symbol: "led", turn: 270 }, label: "Torn piece" },
    ],
    wires: [
      { id: "W1", from: "rail+:5", to: "a5", color: "red" },
      { id: "W2", from: "a10", to: "rail-:10", color: "black" },
    ],
    tray: [
      { id: "R1", kind: "resistor", params: { ohms: 1000 }, count: 1 },
      { id: "R2", kind: "resistor", params: { ohms: 470 }, count: 1 },
      { id: "R3", kind: "resistor", params: { ohms: 10000 }, count: 1 },
      { id: "D1", kind: "led", params: { color: "red", maxmA: 50 }, count: 1 },
    ],
    instruments: [],
  },
  mascot: {
    hint: "Follow one line at a time.",
    fried: "Oof. My lamp skipped its resistor. Spare's in the tray.",
  },
  fried: { led: "Red LED, no resistor on 9 V" },
  tasks: [
    {
      id: "mend-blueprint",
      prompt: "Put the torn piece in the gap, turned the right way.",
      goal: (lab) => lab.drawing("CARD")?.complete === true,
      hints: ["Drag the torn piece onto the gap in the drawing.", "Tap the piece to turn it. The triangle points away from plus."],
      highlight: ["PC", "CARD"],
      nudges: [{ when: (lab) => !!lab.drawing("CARD")?.pieces.some((p) => p.seated && !p.right), say: "In! Now tap it to turn it." }],
      success: "Mended.",
    },
    {
      id: "build-loop",
      prompt: "Build the drawing on the board: the 1 kΩ resistor, then the LED.",
      goal: (lab) => {
        const ok = asDrawn(lab);
        if (ok) lab.shared["built"] = ledHoles(lab);
        return ok;
      },
      hints: [
        "The red wire brings plus to strip 5. The black wire takes strip 10 back to minus.",
        "Resistor from strip 5 to strip 9. LED from strip 9 to strip 10.",
        "The LED's long leg goes in strip 9, toward the resistor.",
      ],
      highlight: ["W1.b", "W2.a"],
      nudges: [
        { when: backwards, say: "Dark? Turn the LED round. Long leg toward plus." },
        { when: wrongResistor, say: "Close! The drawing says 1 kΩ." },
      ],
      success: "It glows!",
    },
    {
      id: "move-it",
      prompt: "Move the LED to another row of its strips. Keep it glowing.",
      goal: (lab) => {
        const before = (lab.shared["built"] as string | undefined) ?? BUILT_AT;
        return asDrawn(lab) && ledHoles(lab) !== before;
      },
      hints: ["Drag the LED up or down its two strips.", "Same two strips, a different row of holes."],
      highlight: ["D1"],
      success: "Still glowing.",
    },
    {
      id: "flip-led",
      prompt: "This board's lamp won't light. Fix it.",
      setup: LED_BACKWARDS,
      goal: (lab) => {
        if (!lab.isLit("D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && asDrawn(lab);
      },
      hints: ["Which leg is the long one?", "Turn the LED round: long leg toward the resistor."],
      highlight: ["D1"],
      nudges: [{ when: backwards, say: "The short leg faces plus. Turn it round." }],
      success: "Fixed.",
    },
    {
      id: "swap-order",
      prompt: "Put the resistor after the LED.",
      goal: (lab) => lab.isLit("D1") && lab.seriesLoop(["B1", "D1", "R1"]),
      hints: ["LED from strip 5 to strip 6, resistor from strip 6 to strip 10."],
      highlight: ["R1", "D1"],
      success: "Same glow.",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "PC", at: "in:CARD" },
    { do: "param", part: "PC", params: { turn: 0 } },
    { do: "param", part: "PC", params: { turn: 90 } },
    { do: "check", task: "mend-blueprint" },
    { do: "place", part: "R1", kind: "resistor", at: "c5", params: { ohms: 1000 } },
    { do: "place", part: "D1", kind: "led", at: "d9", params: { color: "red", maxmA: 50 } },
    { do: "check", task: "build-loop" },
    { do: "move", part: "D1", at: "b9" },
    { do: "check", task: "move-it" },
    ...LED_BACKWARDS,
    { do: "move", part: "D1", at: "b9", rot: 0 },
    { do: "check", task: "flip-led" },
    // The secret, last: LED first (strips 5 and 6), then the resistor (strips 6 to 10).
    { do: "move", part: "D1", at: "e5", rot: 0 },
    { do: "move", part: "R1", at: "c6" },
    { do: "check", task: "swap-order" },
  ],
});
