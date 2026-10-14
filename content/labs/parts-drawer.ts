// Start here, case 11: "The mixed-up drawer" (docs/curriculum/start-here.md, SH11). A bench lesson (docs/LESSONS.md):
// its tasks are the beats of content/units/start-here/tool-cases/parts-drawer/lesson.yaml, in the same order.
// One idea: a symbol draws what a part does. Four drawers show only symbols; each takes only its own kind of part.
// The tester: a battery, a resistor and the lamp D9 in a loop with a gap between two free clips (TL2.b and TL3.a),
// where a part is tried out before it is filed.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** A part sits across the tester's gap (either way round). */
const inGap = (lab: LabView, id: string) => lab.joins(id, "TL2.b", "TL3.a");
const lampLit = (lab: LabView) => lab.isLit("D9", 0.02);
const DRAWER_OF = { S2: "DRS", D1: "DRL", RB: "DRR" } as const;

/**
 * The fix-it bench: the switch and resistor drawers' symbol cards swapped, so both parts sit in the wrong drawer (the
 * push button, filed or not, back on the desk).
 */
const CARDS_SWAPPED: SolutionStep[] = [
  { do: "move", part: "PB1", at: "desk:150,14" },
  { do: "param", part: "DRS", params: { face: "resistor" } },
  { do: "param", part: "DRR", params: { face: "switch" } },
];
/** The drawer that shows this symbol now. */
const drawerWith = (lab: LabView, face: string) => ["DRB", "DRS", "DRR", "DRL"].find((d) => (lab.prop(d) as { face?: string } | null)?.face === face);

export default defineLab({
  id: "parts-drawer",
  title: "The mixed-up drawer",
  bench: {
    board: "none",
    frame: ["desk:-196,-100", "desk:196,170"],
    parts: [
      // Four drawers at the back, a symbol on each front.
      { id: "DRB", kind: "bin", at: "desk:-120,-64", params: { style: "drawer", face: "battery" }, locked: true, label: "Battery drawer" },
      { id: "DRS", kind: "bin", at: "desk:-40,-64", params: { style: "drawer", face: "switch" }, locked: true, label: "Switch drawer" },
      { id: "DRR", kind: "bin", at: "desk:40,-64", params: { style: "drawer", face: "resistor" }, locked: true, label: "Resistor drawer" },
      { id: "DRL", kind: "bin", at: "desk:120,-64", params: { style: "drawer", face: "led" }, locked: true, label: "LED drawer" },
      // The loose parts to sort.
      { id: "B2", kind: "battery", at: "desk:-140,14", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V battery" },
      { id: "S2", kind: "toggle-switch", at: "desk:-70,14", params: { base: true, throws: 1, to: "a" }, label: "Switch" },
      { id: "RB", kind: "resistor", at: "desk:20,14", params: { ohms: 10000, watts: 0.25 }, label: "10 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:80,14", rot: 180, params: { color: "red", maxmA: 50 }, label: "Red LED" },
      { id: "PB1", kind: "pushbutton", at: "desk:150,14", params: { base: true }, label: "Push button" },
      // The tester at the front: its gap is the two loose clips, TL2.b (40, 66) and TL3.a (-40, 60).
      { id: "B1", kind: "battery", at: "desk:0,140", rot: 90, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "Tester battery" },
      { id: "R1", kind: "resistor", at: "desk:92,108", rot: 90, params: { ohms: 1000, watts: 0.25 }, locked: true, label: "1 kΩ resistor" },
      { id: "D9", kind: "led", at: "desk:-92,108", params: { color: "red", maxmA: 50 }, locked: true, label: "My lamp" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "TL2", from: "R1.b", to: null, color: "yellow" },
      { id: "TL3", from: null, to: "D9.anode", color: "green" },
      { id: "TL4", from: "D9.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Test it first. Its job tells the drawer.",
    fried: "Oof. Too much push for my lamp. Fresh one in.",
  },
  tasks: [
    {
      id: "file-battery",
      prompt: "Drop the battery in the drawer with the battery's symbol.",
      goal: (lab) => lab.heldBy("B2") === "DRB",
      hints: ["Drag the loose 9 V battery onto the first drawer."],
      highlight: ["B2", "DRB"],
      success: "Filed.",
    },
    {
      id: "test-switch",
      prompt: "Clip the switch into the gap and flip it.",
      // Seen both lit and dark while the switch sits in the gap.
      goal: (lab) => {
        if (!inGap(lab, "S2")) return false;
        if (lampLit(lab)) lab.memory["lit"] = true;
        else lab.memory["dark"] = true;
        return lab.memory["lit"] === true && lab.memory["dark"] === true;
      },
      hints: ["One loose clip on each screw of the switch.", "Then flip the switch's lever."],
      highlight: ["TL2.b", "TL3.a", "S2"],
      success: "On, off.",
    },
    {
      id: "led-both-ways",
      prompt: "Clip the LED into the gap, then turn it round.",
      goal: (lab) => {
        if (!inGap(lab, "D1")) return false;
        if (lampLit(lab) && lab.isLit("D1")) lab.memory["forward"] = true;
        if ((lab.part("D1")?.v ?? 0) < -1 && !lampLit(lab)) lab.memory["backward"] = true;
        return lab.memory["forward"] === true && lab.memory["backward"] === true;
      },
      hints: ["One clip on each leg of the LED.", "Then swap the two clips over."],
      highlight: ["TL2.b", "TL3.a", "D1"],
      success: "One way only.",
    },
    {
      id: "test-resistor",
      prompt: "Clip the resistor into the gap.",
      goal: (lab) => inGap(lab, "RB") && (lab.part("D9")?.i ?? 0) > 1e-4,
      hints: ["One clip on each end of the resistor."],
      highlight: ["TL2.b", "TL3.a", "RB"],
      success: "Dimmer.",
    },
    {
      id: "file-all",
      prompt: "File the switch, the LED and the resistor.",
      goal: (lab) => Object.entries(DRAWER_OF).every(([part, drawer]) => lab.heldBy(part) === drawer),
      hints: ["Match each part's job to its picture.", "Drag each part onto its drawer."],
      highlight: ["DRS", "DRR", "DRL"],
      success: "All filed.",
    },
    {
      id: "fix-it",
      prompt: "Someone filed two parts wrong. Fix it.",
      setup: CARDS_SWAPPED,
      goal: (lab) => {
        const sw = drawerWith(lab, "switch");
        const r = drawerWith(lab, "resistor");
        const right = !!sw && !!r && lab.heldBy("S2") === sw && lab.heldBy("RB") === r;
        if (!right) lab.memory["wrong"] = true;
        return lab.memory["wrong"] === true && right;
      },
      hints: ["Which picture squeezes?", "Swap the switch and the resistor."],
      highlight: ["S2", "RB"],
      success: "Both filed right.",
    },
    {
      id: "button-drawer",
      prompt: "File the push button.",
      goal: (lab) => {
        const sw = drawerWith(lab, "switch");
        return !!sw && lab.heldBy("PB1") === sw;
      },
      hints: ["A button opens and closes a gap too."],
      highlight: ["PB1"],
      success: "The switch drawer.",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "B2", at: "in:DRB" },
    { do: "check", task: "file-battery" },
    { do: "clip", lead: "TL2", end: "b", to: "S2.com" },
    { do: "clip", lead: "TL3", end: "a", to: "S2.b" },
    { do: "flip", part: "S2", to: "b" },
    { do: "check", task: "test-switch" },
    { do: "clip", lead: "TL2", end: "b", to: "D1.anode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.cathode" },
    { do: "clip", lead: "TL2", end: "b", to: "D1.cathode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.anode" },
    { do: "check", task: "led-both-ways" },
    { do: "clip", lead: "TL2", end: "b", to: "RB.a" },
    { do: "clip", lead: "TL3", end: "a", to: "RB.b" },
    { do: "check", task: "test-resistor" },
    { do: "clip", lead: "TL2", end: "b", to: null },
    { do: "clip", lead: "TL3", end: "a", to: null },
    { do: "move", part: "S2", at: "in:DRS" },
    { do: "move", part: "D1", at: "in:DRL" },
    { do: "move", part: "RB", at: "in:DRR" },
    { do: "check", task: "file-all" },
    // The secret: the push button goes in the drawer with the switch's picture.
    { do: "move", part: "PB1", at: "in:DRS" },
    { do: "check", task: "button-drawer" },
    ...CARDS_SWAPPED,
    { do: "move", part: "S2", at: "in:DRR" },
    { do: "move", part: "RB", at: "in:DRS" },
    { do: "check", task: "fix-it" },
  ],
});
