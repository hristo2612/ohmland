// Blueprint: docs/curriculum/start-here.md, SH5 "Two boxes, one lamp". A bench lesson (docs/LESSONS.md): its tasks are
// the beats of content/units/start-here/push-and-squeeze/the-push/lesson.yaml, in the same order.
// One idea: push drives the flow, and a red LED needs enough of it before it glows.
// Two sealed boxes show only a + and a − post: box A hides one AA cell (1.58 V, the lamp stays dark), box B a 9 V
// battery. The push view stands a hatched hill on each box, as tall as its push.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The lamp's red clip on a box's (or battery's) plus, its black clip on the minus. */
const clippedTo = (lab: LabView, plus: string, minus: string) => lab.connected("TL1.a", plus) && lab.connected("TL3.b", minus);
const onA = (lab: LabView) => clippedTo(lab, "BOXA.t1", "BOXA.t2");
const onB = (lab: LabView) => clippedTo(lab, "BOXB.t1", "BOXB.t2");

/** The fix-it: a reading lamp on box A's one AA cell; box B is gone, and a fresh 9 V battery lies on the desk. */
const READING_LAMP: SolutionStep[] = [
  { do: "remove", part: "B1" },
  { do: "remove", part: "BOXB" },
  { do: "place", part: "B2", kind: "battery", at: "desk:-5,-15", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
  { do: "clip", lead: "TL1", end: "a", to: "BOXA.t1" },
  { do: "clip", lead: "TL3", end: "b", to: "BOXA.t2" },
];

export default defineLab({
  id: "the-push",
  title: "The push",
  bench: {
    board: "none",
    frame: ["desk:-178,-58", "desk:140,92"],
    parts: [
      { id: "BOXA", kind: "box", at: "desk:-120,-10", params: { label: "A", wiring: { "s1.pos": "t1", "s1.neg": "t2" } }, locked: true, label: "Box A" },
      { id: "X1", kind: "battery", at: "in:BOXA.s1", params: { size: "aa", emf: 1.58, internalOhms: 0.15 }, label: "AA cell" },
      { id: "BOXB", kind: "box", at: "desk:0,-10", params: { label: "B", wiring: { "s1.pos": "t1", "s1.neg": "t2" } }, locked: true, label: "Box B" },
      { id: "B1", kind: "battery", at: "in:BOXB.s1", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V battery" },
      // The lamp module: a resistor and the lamp, joined, with a red and a black clip left free.
      { id: "R1", kind: "resistor", at: "desk:105,-35", rot: 90, params: { ohms: 1000, watts: 0.25 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:105,45", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Lamp" },
    ],
    leads: [
      { id: "TL1", from: null, to: "R1.a", color: "red" },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "green" },
      { id: "TL3", from: "D1.cathode", to: null, color: "black" },
    ],
    tray: [],
    instruments: [],
    overlays: { offer: ["push"] },
  },
  mascot: {
    hint: "Red clip to +, black clip to −.",
    fried: "Backwards is just dark. Swap the clips.",
  },
  tasks: [
    {
      id: "box-a-dark",
      prompt: "Clip the lamp to box A: red to +, black to −.",
      goal: (lab) => onA(lab) && lab.heldFor(0.5, (lab.part("D1")?.glow ?? 0) < 0.05),
      hints: ["Red clip on box A's + post, black clip on its − post."],
      highlight: ["pin:BOXA.t1", "pin:BOXA.t2"],
      nudges: [{ when: (lab) => clippedTo(lab, "BOXA.t2", "BOXA.t1"), say: "Red clip to +, black clip to −." }],
      success: "Dark.",
    },
    {
      id: "box-b-lit",
      prompt: "Move both clips to box B.",
      goal: (lab) => onB(lab) && lab.isLit("D1"),
      hints: ["Red clip on box B's +, black on its −."],
      highlight: ["pin:BOXB.t1", "pin:BOXB.t2"],
      nudges: [{ when: (lab) => clippedTo(lab, "BOXB.t2", "BOXB.t1"), say: "Backwards is just dark. Swap the clips." }],
      success: "It glows!",
    },
    {
      id: "push-view",
      prompt: "Switch on the push view.",
      goal: (lab) => lab.view("push"),
      hints: ["Tap Push under the bench."],
      success: "Hills of push.",
    },
    {
      id: "open-boxes",
      prompt: "Open both lids.",
      goal: (lab) => lab.lidOpen("BOXA") && lab.lidOpen("BOXB"),
      hints: ["Tap a box's lid to lift it."],
      highlight: ["BOXA", "BOXB"],
      success: "Batteries!",
    },
    {
      id: "fix-it",
      prompt: "The reading lamp runs on one AA. Make it glow.",
      setup: READING_LAMP,
      goal: (lab) => lab.isLit("D1") && lab.amps("B2") > 0.001,
      hints: ["There's a bigger push on the desk.", "Clip my lamp to the 9 V battery: red to +."],
      highlight: ["B2"],
      nudges: [{ when: (lab) => lab.connected("TL1.a", "B2.neg") && lab.connected("TL3.b", "B2.pos"), say: "Backwards is just dark. Swap the clips." }],
      success: "Fixed. Plenty of push.",
    },
    {
      id: "no-push-here",
      prompt: "Clip both of the lamp's clips onto one post.",
      // Both clips on one piece of metal: no push between them, so no flow, even on the 9 V.
      goal: (lab) => {
        const a = lab.bench.leads.find((l) => l.id === "TL1")?.a.to;
        return !!a && lab.connected("TL1.a", "TL3.b") && !lab.isLit("D1", 0.02);
      },
      hints: ["Try both clips on box B's + post."],
      success: "Dark. No push between them.",
      bonus: true,
    },
  ],
  solution: [
    { do: "clip", lead: "TL1", end: "a", to: "BOXA.t1" },
    { do: "clip", lead: "TL3", end: "b", to: "BOXA.t2" },
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "box-a-dark" },
    { do: "clip", lead: "TL1", end: "a", to: "BOXB.t1" },
    { do: "clip", lead: "TL3", end: "b", to: "BOXB.t2" },
    { do: "check", task: "box-b-lit" },
    { do: "view", name: "push", on: true },
    { do: "check", task: "push-view" },
    { do: "param", part: "BOXA", params: { lid: true } },
    { do: "param", part: "BOXB", params: { lid: true } },
    { do: "check", task: "open-boxes" },
    ...READING_LAMP,
    { do: "clip", lead: "TL1", end: "a", to: "B2.pos" },
    { do: "clip", lead: "TL3", end: "b", to: "B2.neg" },
    { do: "check", task: "fix-it" },
    // The secret last, so the fix-it bench starts from both boxes open.
    { do: "clip", lead: "TL3", end: "b", to: "B2.pos" },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "no-push-here" },
  ],
});
