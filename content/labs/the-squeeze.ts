// Blueprint: docs/curriculum/start-here.md, SH6 "The stubborn knob". A bench lesson (docs/LESSONS.md): its tasks are
// the beats of content/units/start-here/push-and-squeeze/the-squeeze/lesson.yaml, in the same order.
// One idea: squeeze holds back the flow, and squeeze anywhere slows the whole loop. New part: the resistor.
// The knob box hides a 10 kΩ trimmer (wiper and one end) in series with a fixed 470 Ω, so the loop never has less
// than 470 Ω: about 16 mA with the knob down, about 0.7 mA with it all the way up.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** Where the knob is turned to, 0 (no squeeze) to 1 (all of it). */
const knob = (lab: LabView) => Number((lab.prop("KT") as { position?: number } | undefined)?.position ?? 0);

/** The lead a gate is clipped round touches this attach point. */
const gateBy = (lab: LabView, gate: string, at: string) => {
  const on = (lab.prop(gate) as { on?: string } | undefined)?.on;
  const l = on ? lab.bench.leads.find((x) => x.id === on) : undefined;
  return !!l && (l.a.to === `pin:${at}` || l.b.to === `pin:${at}`);
};
/** One gate on the lead into the knob box, the other on the lead out of it. */
const aroundBox = (lab: LabView) => (gateBy(lab, "G1", "KB.t1") && gateBy(lab, "G2", "KB.t2")) || (gateBy(lab, "G2", "KB.t1") && gateBy(lab, "G1", "KB.t2"));

/** Battery, these parts and the lamp in one loop, in any order. */
const loopOf = (lab: LabView, parts: string[]) => {
  const orders = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
  return orders([...parts, "D1"]).some((o) => lab.seriesLoop(["B1", ...o]));
};

/** Swap the knob box for a resistor: the red lead's far clip and the green lead's near clip move onto it. */
const swapIn = (id: string): SolutionStep[] => [
  { do: "clip", lead: "TL1", end: "b", to: `${id}.a` },
  { do: "clip", lead: "TL2", end: "a", to: `${id}.b` },
];
/** The fix-it bench: the reading lamp on the big squeeze alone. */
const TOO_DIM: SolutionStep[] = swapIn("RB");

/** Two counting gates come out onto the desk, one below each lead. */
const GATES: SolutionStep[] = [
  { do: "place", part: "G1", kind: "gate", at: "desk:-75,45" },
  { do: "place", part: "G2", kind: "gate", at: "desk:75,60" },
];

export default defineLab({
  id: "the-squeeze",
  title: "The squeeze",
  bench: {
    board: "none",
    frame: ["desk:-165,-80", "desk:150,118"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-120,0", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // The knob box: s1 holds the trimmer (its a end on the + post, its wiper joined to the resistor), s2 the 470 Ω.
      { id: "KB", kind: "box", at: "desk:0,-35", params: { knob: true, wiring: { "s1.a": "t1", "s1.wiper": "j1", "s2.a": "j1", "s2.b": "t2" } }, locked: true, label: "Knob box" },
      { id: "KT", kind: "trimmer", at: "in:KB.s1", params: { ohms: 10000, position: 0, base: true }, label: "Knob part" },
      { id: "KR", kind: "resistor", at: "in:KB.s2", params: { ohms: 470, watts: 0.25 }, label: "Resistor" },
      { id: "D1", kind: "led", at: "desk:110,30", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Lamp" },
      // Two resistors on the desk, with tags.
      { id: "RS", kind: "resistor", at: "desk:-40,85", params: { ohms: 470, watts: 0.25 }, label: "Small squeeze" },
      { id: "L1", kind: "tag", at: "desk:-40,103", params: { text: "small squeeze" }, locked: true, label: "Tag" },
      { id: "RB", kind: "resistor", at: "desk:45,85", params: { ohms: 10000, watts: 0.25 }, label: "Big squeeze" },
      { id: "L2", kind: "tag", at: "desk:45,103", params: { text: "big squeeze" }, locked: true, label: "Tag" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "KB.t1", color: "red" },
      { id: "TL2", from: "KB.t2", to: "D1.anode", color: "green" },
      { id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
    overlays: { flow: "current" },
  },
  mascot: {
    hint: "Gates clip on the leads either side.",
    fried: "Oof. My lamp skipped its squeeze. Fresh one in.",
  },
  tasks: [
    {
      id: "turn-the-knob",
      prompt: "Turn the box's knob up.",
      goal: (lab) => {
        const glow = lab.part("D1")?.glow ?? 0;
        lab.memory["max"] = Math.max(Number(lab.memory["max"] ?? 0), glow);
        return knob(lab) >= 0.8 && Number(lab.memory["max"]) - glow >= 0.3;
      },
      hints: ["Drag the black knob round to the right."],
      highlight: ["KB"],
      success: "Dimmer, and slower.",
    },
    {
      id: "gates-on",
      prompt: "Clip a gate on each side of the box.",
      setup: GATES,
      goal: (lab) => aroundBox(lab) && lab.gate("G1") > 1e-4 && lab.gate("G2") > 1e-4,
      hints: ["One gate on the lead in, one on the lead out.", "Drag a gate onto the red lead, the other onto the green."],
      highlight: ["TL1", "TL2"],
      success: "Both tick.",
    },
    {
      id: "both-gates",
      prompt: "Turn the knob again and watch both gates.",
      goal: (lab) => {
        if (!aroundBox(lab)) return false;
        const k = knob(lab);
        lab.memory["lo"] = Math.min(Number(lab.memory["lo"] ?? k), k);
        lab.memory["hi"] = Math.max(Number(lab.memory["hi"] ?? k), k);
        const g1 = lab.gate("G1");
        const g2 = lab.gate("G2");
        return Number(lab.memory["hi"]) - Number(lab.memory["lo"]) >= 0.3 && g1 > 1e-4 && Math.abs(g1 - g2) <= 0.01 * Math.max(g1, g2);
      },
      hints: ["Turn the knob a good way, either way."],
      highlight: ["KB"],
      success: "Both change at once.",
    },
    {
      id: "open-the-box",
      prompt: "Open the knob box.",
      goal: (lab) => lab.lidOpen("KB"),
      hints: ["Tap the box's lid."],
      highlight: ["KB"],
      success: "Two parts inside.",
    },
    {
      id: "big-squeeze",
      prompt: "Swap the knob box for the big squeeze.",
      goal: (lab) => loopOf(lab, ["RB"]) && lab.isLit("D1", 0.02),
      hints: ["Unclip the box, clip in the big squeeze.", "Red lead's clip on one end, green lead's on the other."],
      highlight: ["RB"],
      success: "Dim.",
    },
    {
      id: "fix-it",
      prompt: "Too dim to read by. Fix it.",
      setup: TOO_DIM,
      goal: (lab) => loopOf(lab, ["RS"]) && lab.isLit("D1", 0.4),
      hints: ["Which squeeze makes it bright?", "Swap the big squeeze for the small one."],
      highlight: ["RS"],
      success: "Bright. Small squeeze, bright lamp.",
    },
    {
      id: "squeeze-after",
      prompt: "Move the big squeeze to the other side of the lamp.",
      // After the lamp, between its short leg and the battery's minus: the same squeeze, the same dim glow.
      goal: (lab) => lab.seriesLoop(["B1", "D1", "RB"]) && lab.isLit("D1", 0.2),
      hints: ["Red lead straight to the lamp. Then the big squeeze between the lamp and minus."],
      success: "Just as dim.",
      bonus: true,
    },
  ],
  solution: [
    { do: "param", part: "KB", params: { position: 0.9 } },
    { do: "check", task: "turn-the-knob" },
    ...GATES,
    { do: "move", part: "G1", at: "lead:TL1" },
    { do: "move", part: "G2", at: "lead:TL2" },
    { do: "check", task: "gates-on" },
    { do: "param", part: "KB", params: { position: 0.4 } },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "both-gates" },
    { do: "param", part: "KB", params: { lid: true } },
    { do: "check", task: "open-the-box" },
    ...swapIn("RB"),
    { do: "check", task: "big-squeeze" },
    ...TOO_DIM,
    ...swapIn("RS"),
    { do: "check", task: "fix-it" },
    // The secret last, so the fix-it bench starts from the big squeeze alone: the lamp first, then the big squeeze.
    // (The minus side first: the lamp never sits straight across the battery.)
    { do: "clip", lead: "TL3", end: "a", to: "RB.b" },
    { do: "clip", lead: "TL2", end: "a", to: "D1.cathode" },
    { do: "clip", lead: "TL2", end: "b", to: "RB.a" },
    { do: "clip", lead: "TL1", end: "b", to: "D1.anode" },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "squeeze-after" },
  ],
});
