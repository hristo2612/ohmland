// Blueprint: docs/curriculum/unit-2.md, Lesson 5; a bench lesson (docs/LESSONS.md):
// content/units/switching/relays/relay-thresholds. One idea: a relay pulls in at one push and lets go at a much lower
// one. Desk modules: the 1 kΩ panel knob P1 sits across battery B1 as a voltage divider and its wiper feeds the relay's
// coil; the meter is already across the coil. A green lamp on the NO contact shows when the relay is pulled in. The
// changeover (a second battery, two lamps) moved to relay-chooser.
//
// In the simulator the coil (540 Ω) pulls in near the knob's 85% mark and lets go near 25%. Each relay's thresholds
// are spread a few percent by its id: this K1 pulls in at 6.11 V and lets go at 1.75 V. Goals compare against the
// relay's own values (lab.actual).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The coil is fed from the pot's wiper, with the pot across B1. */
const potFeedsCoil = (lab: LabView) =>
  (lab.connected("P1.wiper", "K1.coil1") || lab.connected("P1.wiper", "K1.coil2")) &&
  ((lab.connected("P1.a", "B1.pos") && lab.connected("P1.b", "B1.neg")) || (lab.connected("P1.a", "B1.neg") && lab.connected("P1.b", "B1.pos")));
const clickedTo = (lab: LabView, to: "no" | "nc") => lab.events.some((e) => e.type === "clicked" && e.partId === "K1" && e.data?.["to"] === to);
const within = (x: number | null, want: number | undefined, tol: number) => x !== null && want !== undefined && Math.abs(x - want) <= tol;

/** The fix-it bench: the coil's lead moved from the wiper to the knob's minus end, so the coil never gets a push. */
const COIL_ON_THE_END: SolutionStep[] = [{ do: "clip", lead: "TL3", end: "a", to: "P1.a" }];

export default defineLab({
  id: "relay-thresholds",
  title: "Click in, click out",
  bench: {
    board: "none",
    frame: ["desk:-150,-70", "desk:200,70"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-140,20", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "P1", kind: "trimmer", at: "desk:-80,-40", params: { base: true, tag: "P1", ohms: 1000, position: 0 }, locked: true, label: "Knob P1, 1 kΩ" },
      { id: "K1", kind: "relay", at: "desk:10,-40", params: { base: true, tag: "K1", poles: 1, coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "R2", kind: "resistor", at: "desk:40,40", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor" },
      { id: "D2", kind: "led", at: "desk:95,40", rot: 180, params: { color: "green" }, locked: true, label: "Green LED" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "P1.b", color: "red" },
      { id: "TL2", from: "P1.a", to: "B1.neg", color: "black" },
      { id: "TL3", from: "P1.wiper", to: "K1.coil1", color: "yellow" },
      { id: "TL4", from: "K1.coil2", to: "B1.neg", color: "black" },
      { id: "TL5", from: "B1.pos", to: "K1.com1", color: "red" },
      { id: "TL6", from: "K1.no1", to: "R2.a", color: "green" },
      { id: "TL7", from: "R2.b", to: "D2.anode", color: "green" },
      { id: "TL8", from: "D2.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:170,-10", rot: -18, mode: "dcv", probes: { red: "K1.coil1", black: "K1.coil2" } }],
    controls: [{ id: "knob", label: "Knob P1", part: "P1", key: "position", min: 0, max: 1, value: 0, step: 0.005, unit: "%" }],
  },
  mascot: {
    hint: "Turn slowly. The click is sneaky.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "find-pull-in",
      prompt: "Turn the knob up slowly until the relay clicks. What did the meter read?",
      note: { id: "pullin", label: "Pull-in", unit: "V" },
      goal: (lab) => potFeedsCoil(lab) && clickedTo(lab, "no") && within(lab.note("pullin"), lab.actual("K1", "pullIn"), 0.3),
      hints: ["The meter reads the coil's push. Watch it as you turn.", "Write down the reading the moment you hear the click."],
      highlight: ["P1"],
      success: "That's pull-in.",
    },
    {
      id: "find-drop-out",
      prompt: "Now turn the knob down slowly. When does the relay let go?",
      note: { id: "dropout", label: "Drop-out", unit: "V" },
      goal: (lab) => potFeedsCoil(lab) && clickedTo(lab, "nc") && within(lab.note("dropout"), lab.actual("K1", "dropOut"), 0.3),
      hints: ["It holds on much longer than you'd expect. Keep going.", "Read the meter the moment the green lamp goes out."],
      highlight: ["P1"],
      success: "That's drop-out.",
    },
    {
      id: "fix-wiper",
      prompt: "Make the knob click the relay again.",
      setup: COIL_ON_THE_END,
      // Broken first (the coil on the knob's end, as set up), then a click with the wiper feeding the coil.
      goal: (lab) => {
        if (!lab.connected("P1.wiper", "K1.coil1")) lab.memory["broken"] = true;
        if (lab.memory["broken"] !== true) return false;
        const since = (lab.memory["since"] ??= lab.t) as number;
        return potFeedsCoil(lab) && lab.events.some((e) => e.type === "clicked" && e.partId === "K1" && e.data?.["to"] === "no" && e.t >= since);
      },
      hints: ["The knob's middle screw is the wiper: the part that moves.", "Clip the yellow lead to P1's middle screw. Then turn up."],
      highlight: ["TL3", "pin:P1.wiper"],
      success: "Click. The wiper does the turning.",
    },
  ],
  solution: [
    { do: "control", id: "knob", value: 0.6 },
    { do: "control", id: "knob", value: 0.75 },
    { do: "control", id: "knob", value: 0.8 },
    { do: "control", id: "knob", value: 0.83 },
    { do: "control", id: "knob", value: 0.86 },
    { do: "control", id: "knob", value: 0.9 },
    { do: "note", id: "pullin", value: "6.1" },
    { do: "check", task: "find-pull-in" },
    // "Show me" starts with the relay let go: pull it in, then turn down slowly.
    { do: "control", id: "knob", value: 0.9 },
    { do: "wait", seconds: 0.4 },
    { do: "control", id: "knob", value: 0.5 },
    { do: "control", id: "knob", value: 0.35 },
    { do: "control", id: "knob", value: 0.3 },
    { do: "control", id: "knob", value: 0.27 },
    { do: "control", id: "knob", value: 0.24 },
    { do: "control", id: "knob", value: 0.2 },
    { do: "note", id: "dropout", value: "1.7" },
    { do: "check", task: "find-drop-out" },
    ...COIL_ON_THE_END,
    { do: "control", id: "knob", value: 0.9 },
    { do: "wait", seconds: 0.4 },
    { do: "control", id: "knob", value: 0 },
    { do: "clip", lead: "TL3", end: "a", to: "P1.wiper" },
    { do: "control", id: "knob", value: 0.6 },
    { do: "control", id: "knob", value: 0.9 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-wiper" },
  ],
});
