// Blueprint: docs/curriculum/unit-2.md, Lesson 6 (its last task); a bench lesson (docs/LESSONS.md):
// content/units/switching/relays/the-diode. One idea: a diode across the coil, band toward plus, swallows the kick.
// New: the diode. The coil circuit from coil-kickback (B1, button S1, relay K1 with 0.3 H) and its scope; a 1N4001
// lies on the desk with two clip leads in the tray. Backwards across the coil it does nothing while S1 is held and
// clamps the coil to under a volt when S1 lets go. Forwards it shorts the battery while S1 is held: the fix-it bench.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/**
 * Watches press-and-release cycles of S1 while `ok` holds (the diode is in place). Returns true once a release has
 * happened with no spark, after a press, and `afterOk` held within 0.4 s of letting go.
 */
function cleanRelease(lab: LabView, ok: boolean, afterOk: (since: number) => boolean): boolean {
  const mem = lab.memory as { pressed?: number; released?: number };
  if (!ok) {
    delete mem.pressed;
    delete mem.released;
    return false;
  }
  if (lab.closed("S1")) {
    mem.pressed ??= lab.t;
    delete mem.released;
    return false;
  }
  if (mem.pressed === undefined) return false;
  mem.released ??= lab.t;
  const since = mem.released;
  if (lab.events.some((e) => e.type === "spark" && e.partId === "S1" && e.t >= since - 0.05)) {
    delete mem.pressed;
    return false;
  }
  if (lab.t - since < 0.15) return false;
  const pass = afterOk(since);
  if (!pass && lab.t - since > 0.5) delete mem.pressed;
  return pass;
}

/** The diode across the coil, band (cathode) on the coil's plus end. */
const backwards = (lab: LabView) => lab.joins("D3", "K1.coil2", "K1.coil1", "forward");
const forwards = (lab: LabView) => lab.joins("D3", "K1.coil1", "K1.coil2", "forward");
const clamps = (lab: LabView) => {
  if (lab.part("D3")?.health !== "ok") return false;
  const clicks = lab.events.filter((e) => e.type === "clicked" && e.partId === "K1");
  return cleanRelease(lab, backwards(lab), (since) => clicks.some((e) => e.data?.["to"] === "no") && clicks.some((e) => e.data?.["to"] === "nc" && e.t >= since - 0.05));
};

/** The fix-it bench: the diode turned round, so it sits forwards across the coil. */
const DIODE_FORWARDS: SolutionStep[] = [
  { do: "clip", lead: "TL4", end: "b", to: "D3.anode" },
  { do: "clip", lead: "TL5", end: "a", to: "D3.cathode" },
];

export default defineLab({
  id: "the-diode",
  title: "A one-way valve",
  bench: {
    board: "none",
    frame: ["desk:-150,-70", "desk:110,70"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-112,8", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "desk:66,-40", params: { base: true, cap: "red", tag: "S1" }, locked: true, label: "Button S1" },
      { id: "K1", kind: "relay", at: "desk:-14,-38", params: { base: true, tag: "K1", poles: 1, coilOhms: 540, pullIn: 6.0, dropOut: 1.8, coilHenries: 0.3 }, locked: true, label: "Relay K1" },
      { id: "D3", kind: "diode", at: "desk:40,34", params: { model: "1N4001" }, label: "1N4001 diode" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.a1", color: "red", locked: true },
      { id: "TL2", from: "S1.b1", to: "K1.coil1", color: "yellow", locked: true },
      { id: "TL3", from: "K1.coil2", to: "B1.neg", color: "black", locked: true },
    ],
    tray: [{ kind: "lead", params: { color: "green" }, count: 2 }],
    instruments: [{ kind: "scope", traces: [{ label: "Coil top end", volts: "K1.coil1" }], window: 3, capture: { ms: 2, edge: "off" } }],
  },
  mascot: {
    hint: "Band toward plus: the coil's yellow end.",
    fried: "Forwards, it's a shortcut around the coil. It has to face backwards.",
  },
  fried: { diode: "1N4001, forwards across a relay coil" },
  tasks: [
    {
      id: "diode-clamp",
      prompt: "Clip the diode across the coil, **band** toward the coil's plus end. Press and release S1.",
      goal: clamps,
      hints: ["The yellow lead brings plus to the coil. The band goes there.", "Plain end to the coil's black end. Then press and release."],
      highlight: ["pin:K1.coil1", "pin:K1.coil2"],
      nudges: [{ when: forwards, say: "Band on the black end? That's forwards. Don't press yet!" }],
      success: "Clamped. No spark.",
    },
    {
      id: "fix-forwards",
      prompt: "Stop the battery warming up.",
      setup: DIODE_FORWARDS,
      // Broken first (the diode forwards, as set up), then turned round and clamping a release.
      goal: (lab) => {
        if (forwards(lab)) lab.memory["forwards"] = true;
        return lab.memory["forwards"] === true && clamps(lab);
      },
      hints: ["Which way does the band face? Which end of the coil is plus?", "Swap the diode's two clips. Band toward the yellow end."],
      highlight: ["pin:D3.cathode", "pin:D3.anode"],
      success: "Band toward plus. Cool battery, happy coil.",
    },
  ],
  solution: [
    { do: "lead", id: "TL4", from: "K1.coil1", to: "D3.cathode", color: "green" },
    { do: "lead", id: "TL5", from: "D3.anode", to: "K1.coil2", color: "green" },
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "diode-clamp" },
    ...DIODE_FORWARDS,
    { do: "wait", seconds: 0.3 },
    { do: "clip", lead: "TL4", end: "b", to: "D3.cathode" },
    { do: "clip", lead: "TL5", end: "a", to: "D3.anode" },
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-forwards" },
  ],
});
