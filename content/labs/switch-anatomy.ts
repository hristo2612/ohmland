// Blueprint: docs/curriculum/unit-2.md, Lesson 1. Four switches on wooden blocks with screw terminals, and the meter
// on continuity. Continuity tables fill in by themselves as the learner probes each pair of terminals in each
// position; a tags panel takes the learner's verdict on the two pushbuttons (which look identical).
import { defineLab, type LabView } from "@ohmland/lab";

const filled = (lab: LabView, id: string) => {
  const p = lab.panel(id);
  return p.size > 0 && Object.keys(p.cells).length >= p.size;
};

export default defineLab({
  id: "switch-anatomy",
  title: "What's inside a switch",
  bench: {
    board: "none",
    frame: ["desk:-134,-34", "desk:172,30"],
    parts: [
      { id: "S1", kind: "toggle-switch", at: "desk:-108,-8", params: { base: true, throws: 1, to: "a", tag: "S1" }, locked: true, label: "On/off switch S1" },
      { id: "S2", kind: "slide-switch", at: "desk:-50,-8", params: { base: true, to: "a", tag: "S2" }, locked: true, label: "Slide switch S2" },
      { id: "S3", kind: "pushbutton", at: "desk:2,-8", params: { base: true, tag: "S3" }, locked: true, label: "Button S3" },
      { id: "S4", kind: "pushbutton", at: "desk:46,-8", params: { base: true, normallyClosed: true, tag: "S4" }, locked: true, label: "Button S4" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:128,-28", rot: -24, mode: "off" }],
  },
  panels: [
    { kind: "continuity", id: "s1", part: "S1", show: ["beep-test"] },
    { kind: "continuity", id: "s2", part: "S2", show: ["find-the-pole"] },
    { kind: "continuity", id: "s3", part: "S3", show: ["press-and-hold"] },
    { kind: "continuity", id: "s4", part: "S4", show: ["press-and-hold"] },
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
    start: "Beep means yes. Silence means no. Switches can't lie to the beeper.",
    hint: "Touch both probe tips to two terminals of the same switch, then look at the meter.",
    success: "Another switch cracked. Keep poking.",
    exit: "Poles, throws, open, closed. You can read any switch now.",
  },
  tasks: [
    {
      id: "beep-test",
      prompt:
        "Dial to **Beep**. Touch the tips together, then probe **S1** both ways.",
      goal: (lab) => {
        const m = lab.meter;
        if (m?.mode === "continuity" && m.beep && lab.bench.meter?.probes.red.tip.to && lab.connected("probe:red", "probe:black")) lab.memory["joined"] = true;
        return lab.memory["joined"] === true && filled(lab, "s1");
      },
      hints: [
        "Beep is the dial setting with the sound-wave symbol.",
        "Red on one S1 screw, black on the other. Then flip S1.",
      ],
      highlight: ["S1"],
      success: "Beep: a path with almost no resistance. OL: no path at all.",
      notice: "A switch is just a gap you can close.",
    },
    {
      id: "find-the-pole",
      prompt: "Probe every pair of **S2**'s three terminals, in both positions.",
      goal: (lab) => filled(lab, "s2"),
      hints: ["Only three pairs: left-middle, middle-right, left-right.", "Which terminal is part of every beep? That one is special."],
      highlight: ["S2"],
      success: "The middle terminal is the pole. It always joins exactly one throw.",
      notice: "SPDT means one pole, two throws.",
      mascot: { success: "The middle leg is usually the boss." },
    },
    {
      id: "press-and-hold",
      prompt:
        "Probe **S3** and **S4** released, then held. Label each in the panel.",
      goal: (lab) => filled(lab, "s3") && filled(lab, "s4") && lab.panel("buttons").correct,
      hints: [
        "Keep the pointer down on a button, or hold Space.",
        "Normally means untouched. Which one beeps untouched?",
      ],
      highlight: ["S3", "S4"],
      success: "S3 joins only while pressed. S4 is joined until pressed.",
      notice: "Momentary switches return by themselves. The toggle stays put.",
      mascot: { hint: "Press, hold, probe. Patience is a tool too." },
    },
  ],
  solution: [
    { do: "dial", mode: "continuity" },
    { do: "probe", red: "S1.com", black: "S1.com" },
    { do: "probe", red: "S1.com", black: "S1.b" },
    { do: "flip", part: "S1", to: "b" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "beep-test" },
    { do: "probe", red: "S2.a", black: "S2.com" },
    { do: "probe", red: "S2.com", black: "S2.b" },
    { do: "probe", red: "S2.a", black: "S2.b" },
    { do: "flip", part: "S2", to: "b" },
    { do: "probe", red: "S2.a", black: "S2.com" },
    { do: "probe", red: "S2.com", black: "S2.b" },
    { do: "probe", red: "S2.a", black: "S2.b" },
    { do: "check", task: "find-the-pole" },
    { do: "probe", red: "S3.a1", black: "S3.b1" },
    { do: "press", part: "S3", seconds: 1 },
    { do: "probe", red: "S4.a1", black: "S4.b1" },
    { do: "press", part: "S4", seconds: 1 },
    { do: "panel", id: "buttons", value: { S3: "no", S4: "nc" } },
    { do: "check", task: "press-and-hold" },
  ],
});
