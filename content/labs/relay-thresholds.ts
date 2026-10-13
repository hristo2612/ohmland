// Blueprint: docs/curriculum/unit-2.md, Lesson 5. Desk modules: battery B1 drives the relay's coil through button S1;
// battery B2 is for the LED side, which the learner wires as a changeover. Then the 1 kΩ panel pot P1 replaces the
// button as a voltage divider on B1, and the meter across the coil catches the pull-in and drop-out voltages.
//
// In the simulator the coil (540 Ω) pulls in near the knob's 85% mark (about 6.0 V) and lets go near 25% (about
// 1.8 V). Each relay's thresholds are spread a few percent; goals compare against this relay's own values.
import { defineLab, type LabView } from "@ohmland/lab";

/** The coil is fed from the pot's wiper, with the pot across B1. */
const potFeedsCoil = (lab: LabView) =>
  (lab.connected("P1.wiper", "K1.coil1") || lab.connected("P1.wiper", "K1.coil2")) &&
  (lab.joins("P1", "B1.pos", "B1.neg") || (lab.connected("P1.a", "B1.pos") && lab.connected("P1.b", "B1.neg")) || (lab.connected("P1.a", "B1.neg") && lab.connected("P1.b", "B1.pos")));

const within = (x: number | null, want: number | undefined, tol: number) => x !== null && want !== undefined && Math.abs(x - want) <= tol;

export default defineLab({
  id: "relay-thresholds",
  title: "Click in, click out",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-126,-20", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "Coil battery B1" },
      { id: "S1", kind: "pushbutton", at: "desk:-74,-52", params: { base: true, cap: "red", tag: "S1" }, locked: true, label: "Button S1" },
      { id: "K1", kind: "relay", at: "desk:-8,-40", params: { base: true, tag: "K1", poles: 1, coilOhms: 540, pullIn: 6.0, dropOut: 1.8 }, locked: true, label: "Relay K1" },
      { id: "P1", kind: "trimmer", at: "desk:-74,22", params: { base: true, tag: "P1", ohms: 1000, position: 0 }, locked: true, label: "Knob P1, 1 kΩ" },
      { id: "B2", kind: "battery", at: "desk:6,40", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "LED battery B2" },
      { id: "R2", kind: "resistor", at: "desk:62,-10", params: { ohms: 470 }, label: "470 Ω resistor R2" },
      { id: "D2", kind: "led", at: "desk:104,-14", rot: 180, params: { color: "yellow" }, label: "Yellow LED D2" },
      { id: "R3", kind: "resistor", at: "desk:62,24", params: { ohms: 470 }, label: "470 Ω resistor R3" },
      { id: "D3", kind: "led", at: "desk:104,20", rot: 180, params: { color: "green" }, label: "Green LED D3" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.a1", color: "red" },
      { id: "TL2", from: "S1.b1", to: "K1.coil1", color: "yellow" },
      { id: "TL3", from: "K1.coil2", to: "B1.neg", color: "black" },
    ],
    tray: [
      { kind: "lead", params: { color: "red" }, count: 2 },
      { kind: "lead", params: { color: "green" }, count: 3 },
      { kind: "lead", params: { color: "black" }, count: 3 },
    ],
    instruments: [{ kind: "meter", at: "desk:176,-20", rot: -22, mode: "dcv" }],
    controls: [{ id: "knob", label: "Knob P1", part: "P1", key: "position", min: 0, max: 1, value: 0, step: 0.005, unit: "%" }],
  },
  mascot: {
    start: "Two batteries, one magnet. No wires between them.",
    hint: "Turn slowly. The click is sneaky.",
    success: "Starting is hard. Staying is easy. Relays and I agree.",
    exit: "Pull-in, drop-out, and a gap between them. That gap keeps relays calm.",
  },
  fried: { led: "LED on the relay's contacts" },
  tasks: [
    {
      id: "changeover",
      prompt: "Using only **B2**: yellow at rest, green while you hold **S1**.",
      goal: (lab) => {
        if (!lab.connected("K1.com1", "B2.pos") || lab.connected("B2.pos", "B1.pos") || lab.connected("B2.neg", "B1.neg")) return false;
        if (!lab.closed("S1") && lab.isLit("D2") && !lab.isLit("D3")) lab.memory["rest"] = true;
        if (lab.closed("S1") && lab.isLit("D3") && !lab.isLit("D2")) lab.memory["held"] = true;
        return lab.memory["rest"] === true && lab.memory["held"] === true;
      },
      hints: [
        "COM to B2's plus; each contact feeds one LED via its resistor.",
        "Both LEDs return to B2's minus terminal. Long legs toward the resistors.",
      ],
      highlight: ["pin:K1.com1", "pin:K1.nc1", "pin:K1.no1", "B2"],
      success: "The relay picks which LED gets B2's power. B2 never touches B1.",
      notice: "Two separate batteries, one magnetic link.",
    },
    {
      id: "find-pull-in",
      prompt:
        "Feed the coil from knob **P1**. Turn up until it clicks.",
      note: { id: "pullin", label: "Pull-in voltage", unit: "V" },
      goal: (lab) => potFeedsCoil(lab) && lab.count("clicked", "K1") > 0 && lab.events.some((e) => e.type === "clicked" && e.partId === "K1" && e.data?.["to"] === "no") && within(lab.note("pullin"), lab.actual("K1", "pullIn"), 0.3),
      hints: ["P1's outer screws to B1, its middle screw to the coil.", "Meter across the coil. Turn slowly: the click is sudden.", "Write down the reading the moment you hear the click."],
      highlight: ["P1", "pin:K1.coil1"],
      success: "That's pull-in. Below it, the magnet can't move the armature.",
    },
    {
      id: "find-drop-out",
      prompt: "Now turn the knob down slowly. When does the relay let go?",
      note: { id: "dropout", label: "Drop-out voltage", unit: "V" },
      goal: (lab) => potFeedsCoil(lab) && lab.events.some((e) => e.type === "clicked" && e.partId === "K1" && e.data?.["to"] === "nc") && within(lab.note("dropout"), lab.actual("K1", "dropOut"), 0.3),
      hints: ["It holds on much longer than you'd expect. Keep going."],
      success: "Pull-in about 6 V, drop-out under 2 V. Starting takes more push.",
      notice: "That gap is hysteresis: it stops chatter near a threshold.",
    },
  ],
  solution: [
    { do: "lead", id: "TL4", from: "B2.pos", to: "K1.com1", color: "red" },
    { do: "lead", id: "TL5", from: "K1.nc1", to: "R2.a", color: "green" },
    { do: "lead", id: "TL6", from: "R2.b", to: "D2.anode", color: "green" },
    { do: "lead", id: "TL7", from: "K1.no1", to: "R3.a", color: "green" },
    { do: "lead", id: "TL8", from: "R3.b", to: "D3.anode", color: "black" },
    { do: "lead", id: "TL9", from: "D2.cathode", to: "B2.neg", color: "black" },
    { do: "lead", id: "TL10", from: "D3.cathode", to: "B2.neg", color: "black" },
    { do: "wait", seconds: 0.3 },
    { do: "press", part: "S1", seconds: 0.8 },
    { do: "check", task: "changeover" },
    { do: "clip", lead: "TL2", end: "a", to: "P1.wiper" },
    { do: "lead", id: "TL11", from: "B1.pos", to: "P1.b", color: "red" },
    { do: "clip", lead: "TL3", end: "b", to: "P1.a" },
    { do: "lead", id: "TL12", from: "K1.coil2", to: "B1.neg", color: "black" },
    { do: "probe", red: "K1.coil1", black: "K1.coil2" },
    { do: "control", id: "knob", value: 0.6 },
    { do: "control", id: "knob", value: 0.75 },
    { do: "control", id: "knob", value: 0.8 },
    { do: "control", id: "knob", value: 0.83 },
    { do: "control", id: "knob", value: 0.86 },
    { do: "control", id: "knob", value: 0.9 },
    { do: "note", id: "pullin", value: "6.0" },
    { do: "check", task: "find-pull-in" },
    { do: "control", id: "knob", value: 0.5 },
    { do: "control", id: "knob", value: 0.35 },
    { do: "control", id: "knob", value: 0.3 },
    { do: "control", id: "knob", value: 0.27 },
    { do: "control", id: "knob", value: 0.24 },
    { do: "control", id: "knob", value: 0.2 },
    { do: "note", id: "dropout", value: "1.8" },
    { do: "check", task: "find-drop-out" },
  ],
});
