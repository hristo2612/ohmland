// Blueprint: docs/curriculum/unit-3.md, MP5. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/soldering/cook-an-led. One idea: heat runs along a lead into a part; a metal clip on the lead
// carries it away. The unit's planned fried moment: the first LED cooks under the iron.
// A 3 mm red LED lying on the desk, lit from the battery through 470 Ω (about 16 mA), the station at 370 °C. The iron
// rests on the anode leg at its mark, 12 mm from the body (the leg is 14 mm long as drawn). From the station's lead
// heat model and the simulator's LED die (packages/bench README "The joint and heat models"): at 330 °C the glow
// sags by a third at 12 to 18 s and the LED dies at 25 to 35 s, about 20% sooner at 370 °C; a copper clip between the
// mark and the body keeps it bright past two minutes; a steel clip only delays it.
// Headless replays have no station engine, so no heat reaches the LED there: the solution warms its body with the
// simulator's own `bodyC` input instead, as the station would.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { clipBetween } from "./lib/solder";

const ironOnLeg = (lab: LabView) => lab.solder.iron?.at === "D1.anode";
const glow = (lab: LabView) => lab.part("D1")?.glow ?? 0;

/** The fix-it bench: a fresh LED, and the copper clip on the far side of the iron's mark, where it cannot help. */
const WRONG_SIDE: SolutionStep[] = [
  { do: "param", part: "ST1", params: { iron: "stand" } },
  { do: "replace", part: "D1" },
  { do: "param", part: "HS2", params: { on: null } as never },
  { do: "move", part: "HS2", at: "desk:95,-20" },
  { do: "param", part: "HS1", params: { on: "D1.anode", mm: 13.5 } },
];

export default defineLab({
  id: "cook-an-led",
  title: "Too hot to glow",
  bench: {
    board: "none",
    frame: ["desk:-150,-60", "desk:105,70"],
    parts: [
      { id: "ST1", kind: "solder-station", at: "desk:-95,-25", params: { on: true, setC: 370, iron: "stand" }, locked: true, label: "Soldering iron" },
      { id: "B1", kind: "battery", at: "desk:-40,50", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:15,62", params: { ohms: 470 }, locked: true, label: "470 Ω resistor" },
      { id: "D1", kind: "led", at: "desk:30,5", params: { color: "red", size: 3, maxmA: 20 }, locked: true, label: "Antenna lamp" },
      { id: "HS1", kind: "heat-sink-clip", at: "desk:70,30", params: { metal: "copper" }, label: "Copper clip" },
      { id: "HS2", kind: "heat-sink-clip", at: "desk:95,-20", params: { metal: "steel" }, label: "Steel clip" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "yellow" },
      { id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "The clip goes between the iron and the body.",
    fried: "Oof. Cooked from the inside.",
  },
  fried: { D1: "3 mm red LED, cooked by the iron" },
  tasks: [
    {
      id: "cook-it",
      prompt: "Rest the iron on the lamp's leg, and keep it there.",
      goal: (lab) => {
        if (ironOnLeg(lab)) lab.memory["on"] = true;
        return lab.memory["on"] === true && lab.died("D1");
      },
      hints: ["Drop the iron's tip on the lamp's long leg.", "Keep it there. Watch the glow."],
      highlight: ["spot:D1.anode"],
      nudges: [{ when: (lab) => lab.memory["on"] === true && !ironOnLeg(lab) && !lab.died("D1"), say: "Keep the iron there. Watch the lamp." }],
      success: "Cooked.",
    },
    {
      id: "fresh-lamp",
      prompt: "Lift the iron, let the leg cool, then replace the lamp.",
      // The leg stays above 105 °C for about 20 s after the iron leaves: a lamp replaced sooner cooks too.
      goal: (lab) => !ironOnLeg(lab) && lab.isLit("D1"),
      hints: ["Drag the iron back to its stand.", "Wait a little, then tap Replace part."],
      highlight: ["spot:ST1.grip"],
      nudges: [
        { when: (lab) => ironOnLeg(lab), say: "Lift the iron first." },
        { when: (lab) => !ironOnLeg(lab) && lab.part("D1")?.health === "dead", say: "Still hot. Wait a moment, then replace it." },
      ],
      success: "Fresh and glowing.",
    },
    {
      id: "clip-on",
      prompt: "Clip the heat sink on the lamp's leg, near the body.",
      goal: (lab) => lab.isLit("D1") && clipBetween(lab, "HS1", "D1.anode"),
      hints: ["Drag the copper clip onto the long leg.", "Close to the lamp, between it and the iron's mark."],
      highlight: ["HS1", "pin:D1.anode"],
      nudges: [{ when: (lab) => lab.solder.clip("HS1")?.on === "D1.anode" && !clipBetween(lab, "HS1", "D1.anode"), say: "Closer to the lamp's body." }],
      success: "Clipped on.",
    },
    {
      id: "survive-30",
      prompt: "Rest the iron on the leg again, for 30 seconds.",
      goal: (lab) => lab.heldFor(30, ironOnLeg(lab) && clipBetween(lab, "HS1", "D1.anode") && lab.isLit("D1", 0.5)),
      hints: ["Same spot on the leg as before.", "Keep it there and count to 30."],
      highlight: ["spot:D1.anode"],
      success: "Thirty seconds, still bright.",
    },
    {
      id: "steel-clip",
      prompt: "Swap the copper clip for the steel one and heat the leg again.",
      goal: (lab) => {
        const steel = clipBetween(lab, "HS2", "D1.anode") && lab.solder.clip("HS1")?.on !== "D1.anode";
        return steel && ironOnLeg(lab) && (glow(lab) < 0.45 || lab.part("D1")?.health === "dead");
      },
      hints: ["Pull the copper clip off. Put the steel clip in its place.", "Rest the iron on the leg and watch."],
      success: "Steel let it cook.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "The heat sink isn't helping. Fix it.",
      setup: WRONG_SIDE,
      goal: (lab) => {
        const c = lab.solder.clip("HS1");
        if (c?.on === "D1.anode" && (c.mm ?? 0) >= 12) lab.memory["wrong"] = true;
        return lab.memory["wrong"] === true && lab.heldFor(25, ironOnLeg(lab) && clipBetween(lab, "HS1", "D1.anode") && lab.isLit("D1", 0.5));
      },
      hints: ["Is the clip between the iron and the lamp?", "Slide it up the leg, close to the body. Then heat again."],
      highlight: ["HS1"],
      success: "Kept its cool.",
    },
  ],
  solution: [
    { do: "param", part: "ST1", params: { iron: "D1.anode" } },
    // The station warms the die through the leg; here the simulator hears it straight away.
    { do: "set", part: "D1", key: "bodyC", value: 160 },
    { do: "wait", seconds: 2 },
    { do: "check", task: "cook-it" },
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "replace", part: "D1" },
    { do: "check", task: "fresh-lamp" },
    { do: "param", part: "HS1", params: { on: "D1.anode", mm: 5 } },
    { do: "check", task: "clip-on" },
    { do: "param", part: "ST1", params: { iron: "D1.anode" } },
    { do: "set", part: "D1", key: "bodyC", value: 45 },
    { do: "wait", seconds: 31 },
    { do: "check", task: "survive-30" },
    { do: "param", part: "HS1", params: { on: null } as never },
    { do: "move", part: "HS1", at: "desk:70,30" },
    { do: "param", part: "HS2", params: { on: "D1.anode", mm: 5 } },
    { do: "set", part: "D1", key: "bodyC", value: 130 },
    { do: "wait", seconds: 3 },
    { do: "check", task: "steel-clip" },
    ...WRONG_SIDE,
    { do: "param", part: "HS1", params: { on: "D1.anode", mm: 5 } },
    { do: "param", part: "ST1", params: { iron: "D1.anode" } },
    { do: "set", part: "D1", key: "bodyC", value: 45 },
    { do: "wait", seconds: 26 },
    { do: "check", task: "fix-it" },
  ],
});
