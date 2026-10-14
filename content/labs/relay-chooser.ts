// Blueprint: docs/curriculum/unit-2.md, Lesson 5 (its first task); a bench lesson (docs/LESSONS.md):
// content/units/switching/relays/relay-chooser. One idea: a relay chooses which lamp a second battery feeds.
// Desk modules: battery B1 drives the relay's coil through button S1 (wired). Battery B2 feeds the lamp side: its plus
// runs through R2 (one resistor serves both lamps, since only one is ever on) and each LED's minus leg runs back to B2.
// The learner wires the changeover: R2 to COM, NC to the yellow LED, NO to the green one. Then B1 comes off the coil to
// show that the lamp side never needed it.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const pressed = (lab: LabView) => lab.part("S1")?.extra?.["pressed"] === true;
/** The two batteries share no metal at either terminal. */
const apart = (lab: LabView) =>
  !lab.connected("B2.pos", "B1.pos") && !lab.connected("B2.pos", "B1.neg") && !lab.connected("B2.neg", "B1.pos") && !lab.connected("B2.neg", "B1.neg");

/** The fix-it bench: the coil's minus lead clipped back on, and the NC and NO leads swapped. */
const SWAPPED_CONTACTS: SolutionStep[] = [
  { do: "clip", lead: "TL3", end: "b", to: "B1.neg" },
  { do: "clip", lead: "TL9", end: "a", to: "K1.no1" },
  { do: "clip", lead: "TL10", end: "a", to: "K1.nc1" },
];

export default defineLab({
  id: "relay-chooser",
  title: "Yellow or green",
  bench: {
    board: "none",
    frame: ["desk:-150,-70", "desk:140,70"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-126,-20", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "Coil battery B1" },
      { id: "S1", kind: "pushbutton", at: "desk:-74,-52", params: { base: true, cap: "red", tag: "S1" }, locked: true, label: "Button S1" },
      { id: "K1", kind: "relay", at: "desk:-8,-40", params: { base: true, tag: "K1", poles: 1, coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "B2", kind: "battery", at: "desk:-40,40", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "Lamp battery B2" },
      { id: "R2", kind: "resistor", at: "desk:16,22", params: { ohms: 470 }, locked: true, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "desk:96,-16", rot: 180, params: { color: "yellow" }, locked: true, label: "Yellow LED D2" },
      { id: "D3", kind: "led", at: "desk:96,22", rot: 180, params: { color: "green" }, locked: true, label: "Green LED D3" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.a1", color: "red" },
      { id: "TL2", from: "S1.b1", to: "K1.coil1", color: "yellow" },
      { id: "TL3", from: "K1.coil2", to: "B1.neg", color: "black" },
      { id: "TL4", from: "B2.pos", to: "R2.a", color: "red" },
      { id: "TL5", from: "D2.cathode", to: "B2.neg", color: "black" },
      { id: "TL6", from: "D3.cathode", to: "B2.neg", color: "black" },
    ],
    tray: [{ kind: "lead", params: { color: "green" }, count: 3 }],
    instruments: [],
  },
  mascot: {
    hint: "COM is the chooser. NC feeds one lamp, NO the other.",
    fried: "Oof. That LED met a battery with no resistor.",
  },
  fried: { led: "LED on the relay's contacts, no resistor" },
  tasks: [
    {
      id: "changeover",
      prompt: "Using only **B2**: yellow at rest, green while you hold **S1**.",
      goal: (lab) => {
        if (!apart(lab) || !lab.connected("K1.com1", "R2.b")) return false;
        if (lab.heldFor(0.2, !pressed(lab) && lab.isLit("D2") && !lab.isLit("D3"), "rest")) lab.memory["rest"] = true;
        if (lab.heldFor(0.2, lab.closed("K1") && lab.isLit("D3") && !lab.isLit("D2"), "held")) lab.memory["held"] = true;
        return lab.memory["rest"] === true && lab.memory["held"] === true;
      },
      hints: ["R2's free end to COM. Then NC to one lamp, NO to the other.", "Yellow's long leg on NC, green's long leg on NO. Then press."],
      highlight: ["pin:K1.com1", "pin:K1.nc1", "pin:K1.no1", "pin:R2.b"],
      nudges: [{ when: (lab) => !apart(lab), say: "Careful: B2 must not touch B1. Two worlds." }],
      success: "The relay picks the lamp.",
    },
    {
      id: "cut-the-coil",
      prompt: "Unclip the coil's lead from B1's minus.",
      goal: (lab) => !lab.connected("K1.coil2", "B1.neg") && lab.heldFor(0.3, lab.isLit("D2"), "still"),
      hints: ["Drag the black clip off B1's minus terminal."],
      highlight: ["TL3"],
      success: "Yellow stays on.",
    },
    {
      id: "fix-green",
      prompt: "Yellow at rest, green on the click.",
      setup: SWAPPED_CONTACTS,
      // Broken first (green at rest, as set up), then yellow at rest and green while the relay is pulled in.
      goal: (lab) => {
        if (lab.isLit("D3") && !pressed(lab)) lab.memory["greenAtRest"] = true;
        if (lab.memory["greenAtRest"] !== true || !apart(lab)) return false;
        if (lab.heldFor(0.3, !pressed(lab) && lab.isLit("D2") && !lab.isLit("D3"), "rest")) lab.memory["rest"] = true;
        if (lab.heldFor(0.2, lab.closed("K1") && lab.isLit("D3") && !lab.isLit("D2"), "held")) lab.memory["held"] = true;
        return lab.memory["rest"] === true && lab.memory["held"] === true;
      },
      hints: ["At rest, COM touches NC. Which lamp hangs on NC now?", "Swap the two lamp clips on NC and NO."],
      highlight: ["pin:K1.nc1", "pin:K1.no1"],
      success: "Yellow at rest, green on the click.",
    },
  ],
  solution: [
    { do: "lead", id: "TL7", from: "R2.b", to: "K1.com1", color: "green" },
    { do: "lead", id: "TL9", from: "K1.nc1", to: "D2.anode", color: "green" },
    { do: "lead", id: "TL10", from: "K1.no1", to: "D3.anode", color: "green" },
    { do: "wait", seconds: 0.5 },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "changeover" },
    { do: "clip", lead: "TL3", end: "b", to: null },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "cut-the-coil" },
    ...SWAPPED_CONTACTS,
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL9", end: "a", to: "K1.nc1" },
    { do: "clip", lead: "TL10", end: "a", to: "K1.no1" },
    { do: "wait", seconds: 0.5 },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "fix-green" },
  ],
});
