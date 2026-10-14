// Blueprint: docs/curriculum/start-here.md, SH7 "The tired battery". A bench lesson (docs/LESSONS.md): its tasks are
// the beats of content/units/start-here/push-and-squeeze/pocket-power/lesson.yaml, in the same order.
// One idea: a battery is a chemical pump that runs down as its chemicals are used.
// The lamp runs on a battery at 8% of its 500 mAh. At about 7.5 mA that lasts hours, so the time-lapse runs it down:
// dark after about 17 simulated hours (17 s at 3600 times). Then the safety shelf: what may come to the bench and what
// never does, sorted into two trays (the blueprint's pop-up card, done hands-on on the bench).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** A fresh battery comes out beside the tired one, and time runs at its normal pace again. */
const FRESH: SolutionStep[] = [
  { do: "control", id: "speed", value: 1 },
  { do: "place", part: "B2", kind: "battery", at: "desk:-150,-72", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
];

/** The shelf: two trays, a coin cell and four paper tags for things that never come to the bench. */
const SHELF: SolutionStep[] = [
  { do: "control", id: "speed", value: 1 },
  { do: "place", part: "SAFE", kind: "bin", at: "desk:100,-50", params: { style: "tray", label: "BENCH-SAFE" } },
  { do: "place", part: "OFF", kind: "bin", at: "desk:100,62", params: { style: "tray", label: "HANDS-OFF" } },
  { do: "place", part: "CC1", kind: "battery", at: "desk:-5,-45", params: { size: "coin", chem: "lithium", emf: 3, internalOhms: 15 } },
  { do: "place", part: "L1", kind: "tag", at: "desk:-5,-15", params: { text: "wall socket" } },
  { do: "place", part: "L2", kind: "tag", at: "desk:-5,15", params: { text: "car battery" } },
  { do: "place", part: "L3", kind: "tag", at: "desk:-5,45", params: { text: "phone battery" } },
  { do: "place", part: "L4", kind: "tag", at: "desk:-5,75", params: { text: "camera flash" } },
];

/** The fix-it: a torch whose battery is nearly flat (the fresh one lies beside it). */
const FLAT_TORCH: SolutionStep[] = [
  { do: "control", id: "speed", value: 1 },
  { do: "place", part: "B3", kind: "battery", at: "desk:-150,78", params: { emf: 9.4, internalOhms: 1.7, mAh: 500, charge: 0.002 } },
  { do: "clip", lead: "TL1", end: "a", to: "B3.pos" },
  { do: "clip", lead: "TL3", end: "b", to: "B3.neg" },
];

const SAFE = ["XA", "B1", "CC1"];
const OFF = ["L1", "L2", "L3", "L4"];
/** Each thing on the shelf, the line it says when it lands in the wrong tray. */
const WRONG: Record<string, string> = {
  L1: "Wall power: 230 V or 120 V. It can kill.",
  L2: "Only 12 V, but a huge flow into a short.",
  L3: "Lithium. It can burn if damaged.",
  L4: "A flash holds about 300 V, even switched off.",
  XA: "An AA is 1.5 V. Bench-safe.",
  B1: "A 9 V battery is bench-safe.",
  CC1: "Bench-safe. Never let small children have one.",
};
const inWrongTray = (lab: LabView, id: string) => lab.heldBy(id) === (SAFE.includes(id) ? "OFF" : "SAFE");

const speed = (lab: LabView) => lab.control("speed") ?? 1;

export default defineLab({
  id: "pocket-power",
  title: "Pocket power",
  bench: {
    board: "none",
    frame: ["desk:-172,-112", "desk:170,120"],
    parts: [
      // Yesterday's battery: 8% left.
      { id: "B1", kind: "battery", at: "desk:-115,10", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500, charge: 0.08 }, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-55,-30", rot: 90, params: { ohms: 1000, watts: 0.25 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:-55,50", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Lamp" },
      { id: "CK1", kind: "clock", at: "desk:-95,-85", locked: true, label: "Clock" },
      // An AA cell, cut open when tapped.
      { id: "XA", kind: "battery", at: "desk:-5,-88", params: { size: "aa", emf: 1.58, internalOhms: 0.15, xray: false }, label: "AA cell" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "green" },
      { id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
    controls: [{ id: "speed", label: "Time speed", key: "speed", min: 1, max: 3600, value: 1, scale: "log", unit: "×" }],
    overlays: { push: true, offer: ["push"] },
  },
  mascot: {
    hint: "Watch the push hill while time flies.",
    fried: "Nothing burned. It just ran out.",
  },
  tasks: [
    {
      id: "fast-forward",
      prompt: "Speed up time and watch the lamp.",
      goal: (lab) => (lab.charge("B1") ?? 1) < 0.02 && (lab.part("D1")?.glow ?? 1) < 0.05,
      hints: ["Slide the time speed all the way up.", "Then wait. The clock counts the hours."],
      nudges: [{ when: (lab) => speed(lab) > 1.5 && speed(lab) < 1000 && (lab.charge("B1") ?? 1) > 0.02, say: "Faster! Slide time all the way up." }],
      success: "Dark. The battery ran down.",
    },
    {
      id: "peek-inside",
      prompt: "Tap the AA cell to cut it open.",
      goal: (lab) => lab.view("xray:XA"),
      hints: ["Tap the AA cell."],
      highlight: ["XA"],
      success: "A peek inside.",
    },
    {
      id: "fresh-battery",
      prompt: "Fit a fresh battery.",
      setup: FRESH,
      goal: (lab) => lab.seriesLoop(["B2", "R1", "D1"]) && lab.isLit("D1", 0.3),
      hints: ["Drop the fresh battery right on the old one.", "Or move both clips onto the fresh battery: red to +."],
      highlight: ["B2"],
      success: "Bright again.",
    },
    {
      id: "sort-the-shelf",
      prompt: "Sort the shelf: bench-safe or hands-off.",
      setup: SHELF,
      goal: (lab) => SAFE.every((id) => lab.heldBy(id) === "SAFE") && OFF.every((id) => lab.heldBy(id) === "OFF"),
      hints: ["Small cells are bench-safe. Wall power and big or lithium packs are not.", "Drag each one into a tray."],
      highlight: ["SAFE", "OFF"],
      nudges: Object.entries(WRONG).map(([id, say]) => ({ when: (lab: LabView) => inWrongTray(lab, id), say })),
      success: "Shelf sorted.",
    },
    {
      id: "fix-it",
      prompt: "The torch is dim. Fix it.",
      setup: FLAT_TORCH,
      // Dim first (the setup's flat battery), then bright on the fresh one.
      goal: (lab) => {
        if (!lab.isLit("D1", 0.3)) lab.memory["dim"] = true;
        return lab.memory["dim"] === true && lab.isLit("D1", 0.3) && lab.amps("B2") > 0.001;
      },
      hints: ["Push view shows the tired one.", "Swap the flat battery for the fresh one."],
      highlight: ["B2"],
      success: "Fresh push.",
    },
    {
      id: "no-flow-no-drain",
      prompt: "Unclip the lamp, then speed up time.",
      // Ten simulated hours on the time-lapse with the loop open: the battery keeps its charge.
      goal: (lab) => {
        const soc = lab.charge("B2");
        if (soc === null || speed(lab) < 1000 || !lab.loopOpen("D1")) {
          delete lab.memory["from"];
          return false;
        }
        const from = lab.memory["from"] as { t: number; soc: number } | undefined;
        if (!from) {
          lab.memory["from"] = { t: lab.t, soc };
          return false;
        }
        return lab.t - from.t >= 10 * 3600 && from.soc - soc < 0.01;
      },
      hints: ["Unclip one lead, then slide time all the way up."],
      success: "The push barely moved.",
      bonus: true,
    },
  ],
  solution: [
    { do: "control", id: "speed", value: 3600 },
    { do: "wait", seconds: 18 },
    { do: "check", task: "fast-forward" },
    { do: "control", id: "speed", value: 1 },
    { do: "param", part: "XA", params: { xray: true } },
    { do: "check", task: "peek-inside" },
    ...FRESH,
    { do: "move", part: "B2", at: "on:B1" },
    { do: "check", task: "fresh-battery" },
    ...SHELF,
    { do: "move", part: "XA", at: "in:SAFE" },
    { do: "move", part: "B1", at: "in:SAFE" },
    { do: "move", part: "CC1", at: "in:SAFE" },
    { do: "move", part: "L1", at: "in:OFF" },
    { do: "move", part: "L2", at: "in:OFF" },
    { do: "move", part: "L3", at: "in:OFF" },
    { do: "move", part: "L4", at: "in:OFF" },
    { do: "check", task: "sort-the-shelf" },
    ...FLAT_TORCH,
    { do: "move", part: "B2", at: "on:B3" },
    { do: "check", task: "fix-it" },
    // The secret last, so the fix-it bench starts from the sorted shelf.
    { do: "clip", lead: "TL3", end: "a", to: null },
    { do: "control", id: "speed", value: 3600 },
    { do: "wait", seconds: 11 },
    { do: "check", task: "no-flow-no-drain" },
  ],
});
