// Blueprint: docs/curriculum/unit-2.md, Lesson 1 (its third task); a bench lesson (docs/LESSONS.md):
// content/units/switching/switches/two-buttons. One idea: a normally open button joins while pressed; a normally
// closed one breaks while pressed. Two identical-looking buttons on blocks and the meter on continuity. Each button's
// table fills in as the learner probes it released and held; the tags panel takes the verdict. The fix-it round
// brings a doorbell lamp into play wired through the wrong button.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const filled = (lab: LabView, id: string) => {
  const p = lab.panel(id);
  return p.size > 0 && Object.keys(p.cells).length >= p.size;
};
const pressed = (lab: LabView, id: string) => lab.part(id)?.extra?.["pressed"] === true;

/** The fix-it bench: a doorbell lamp (battery, resistor, LED) wired through S4, the normally closed button. */
const LAMP_ON_NC: SolutionStep[] = [
  { do: "probe", red: null, black: null, mode: "off" },
  { do: "place", part: "B1", kind: "battery", at: "desk:-104,34", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 } },
  { do: "place", part: "R1", kind: "resistor", at: "desk:-34,62", params: { ohms: 1000 } },
  { do: "place", part: "D1", kind: "led", at: "desk:18,58", rot: 180, params: { color: "yellow" } },
  { do: "lead", id: "TL1", from: "B1.pos", to: "S4.a1", color: "red" },
  { do: "lead", id: "TL2", from: "S4.b1", to: "R1.a", color: "yellow" },
  { do: "lead", id: "TL3", from: "R1.b", to: "D1.anode", color: "green" },
  { do: "lead", id: "TL4", from: "D1.cathode", to: "B1.neg", color: "black" },
];

export default defineLab({
  id: "two-buttons",
  title: "Press or release",
  bench: {
    board: "none",
    frame: ["desk:-140,-40", "desk:150,84"],
    parts: [
      { id: "S3", kind: "pushbutton", at: "desk:-70,-30", params: { base: true, tag: "S3" }, locked: true, label: "Button S3" },
      { id: "S4", kind: "pushbutton", at: "desk:-10,-30", params: { base: true, normallyClosed: true, tag: "S4" }, locked: true, label: "Button S4" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:104,-14", rot: -18, mode: "continuity" }],
  },
  panels: [
    { kind: "continuity", id: "s3", part: "S3", show: ["probe-s3"] },
    { kind: "continuity", id: "s4", part: "S4", show: ["probe-s4"] },
    {
      kind: "tags",
      id: "buttons",
      show: ["press-and-hold"],
      items: [
        { id: "S3", label: "Button S3" },
        { id: "S4", label: "Button S4" },
      ],
      options: [
        { id: "no", label: "Normally open" },
        { id: "nc", label: "Normally closed" },
      ],
      answer: { S3: "no", S4: "nc" },
    },
  ],
  mascot: {
    hint: "Normally means untouched. Which one beeps untouched?",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "probe-s3",
      prompt: "Probe **S3**'s two screws. Then hold it down and probe again.",
      goal: (lab) => filled(lab, "s3"),
      hints: ["Red on one S3 screw, black on the other.", "Keep the pointer down on the button, or hold Space."],
      highlight: ["S3"],
      success: "Released and held, both logged.",
    },
    {
      id: "probe-s4",
      prompt: "Now **S4**: released, then held.",
      goal: (lab) => filled(lab, "s4"),
      hints: ["Move both tips to S4's screws.", "Keep the pointer down on the button, or hold Space."],
      highlight: ["S4"],
      success: "Released and held, both logged.",
    },
    {
      id: "press-and-hold",
      prompt: "Tag each button: normally open or normally closed.",
      goal: (lab) => lab.panel("buttons").correct,
      hints: ["Normally means untouched. Which one beeps untouched?"],
      success: "S3 joins while pressed. S4 breaks while pressed.",
    },
    {
      id: "fix-doorbell",
      prompt: "Make the lamp light only while a button is pressed.",
      setup: LAMP_ON_NC,
      // Broken first (lit at rest), then dark at rest and lit while S3 is held.
      goal: (lab) => {
        const lit = lab.isLit("D1");
        const anyPressed = pressed(lab, "S3") || pressed(lab, "S4");
        if (lit && !anyPressed) lab.memory["onAtRest"] = true;
        if (lab.memory["onAtRest"] !== true) return false;
        if (!lab.connected("S3.a1", "B1.pos") && !lab.connected("S3.b1", "B1.pos")) return false;
        if (!lit && !anyPressed) lab.memory["darkAtRest"] = true;
        if (lit && pressed(lab, "S3")) lab.memory["litPressed"] = true;
        return lab.memory["darkAtRest"] === true && lab.memory["litPressed"] === true && !(lit && !anyPressed);
      },
      hints: ["A doorbell joins only while pressed. Which button does that?", "Move both clips from S4 to S3. Then press."],
      highlight: ["S3", "S4"],
      success: "Dark until pressed. A proper doorbell.",
    },
  ],
  solution: [
    { do: "probe", red: "S3.a1", black: "S3.b1" },
    { do: "press", part: "S3", seconds: 1 },
    { do: "check", task: "probe-s3" },
    { do: "probe", red: "S4.a1", black: "S4.b1" },
    { do: "press", part: "S4", seconds: 1 },
    { do: "check", task: "probe-s4" },
    { do: "panel", id: "buttons", value: { S3: "no", S4: "nc" } },
    { do: "check", task: "press-and-hold" },
    ...LAMP_ON_NC,
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL1", end: "b", to: "S3.a1" },
    { do: "clip", lead: "TL2", end: "a", to: "S3.b1" },
    { do: "wait", seconds: 0.4 },
    { do: "press", part: "S3", seconds: 1 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-doorbell" },
  ],
});
