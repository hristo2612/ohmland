// Blueprint: docs/curriculum/unit-3.md, MP6. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/wires-and-power/strip-the-wire. One idea: match the stripper's notch to the wire's gauge.
// A length of red 22 AWG solid hookup wire with its end b in the stripper's jaws, and a 22 AWG stranded wire beside
// it for the secret. The stripper's notches run 30 to 16 AWG on a solid and a stranded scale; its jaw stop takes
// 10 mm off. From the strip model (packages/bench src/solder/strip.ts): on 22 AWG solid (0.64 mm copper) the 26 notch
// (0.40 mm) nicks the copper, the 18 notch (1.02 mm) only stretches the jacket, the 22 notch strips it clean.
// The stripper strips the wire end nearest its jaws (within 26 mm) with the notch and scale it is set to.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const end = (lab: LabView) => lab.solder.strip("HW1", "b");
const tried = (lab: LabView, notch: number, what: "nicked" | "slipped") => (lab.solder.strip("HW1", "b")?.tries ?? []).some((t) => t.notch === notch && t[what]);
const clean22 = (lab: LabView) => {
  const e = end(lab);
  return !!e && e.clean && e.notch === 22 && e.scale === "solid";
};

/** The fix-it bench: the stripper back at the red wire's end, set to 26, and the end stripped again: nicked. */
const NICKED: SolutionStep[] = [
  { do: "move", part: "WS1", at: "desk:10,-10" },
  { do: "param", part: "WS1", params: { notch: 26, scale: "solid" } },
  { do: "action", part: "WS1", action: "strip" },
];

export default defineLab({
  id: "strip-the-wire",
  title: "Bare ends",
  bench: {
    board: "none",
    frame: ["desk:-120,-45", "desk:60,45"],
    parts: [
      // The red wire's end b lies in the stripper's jaws, 50 mm left of its middle.
      { id: "HW1", kind: "hookup-wire", at: "desk:-80,-10", params: { color: "red", awg: 22, len: 80 }, locked: true, label: "22 AWG solid wire" },
      { id: "WS1", kind: "wire-stripper", at: "desk:10,-10", params: { notch: 26, scale: "solid", stopMm: 10 }, label: "Wire stripper" },
      // The stranded wire's end lies 38 mm in front of the jaws: out of reach until the stripper moves to it.
      { id: "HW2", kind: "hookup-wire", at: "desk:-80,28", params: { color: "black", awg: 22, len: 80, stranded: true }, locked: true, label: "22 AWG stranded wire" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "The wire's label names the notch.",
    fried: "Just wire. Nothing fried.",
  },
  tasks: [
    {
      id: "nick-it",
      prompt: "Strip the red wire's end with the stripper set to 26.",
      goal: (lab) => tried(lab, 26, "nicked"),
      hints: ["Tap the stripper, then Strip.", "The red wire's end is already in its jaws."],
      highlight: ["WS1"],
      success: "Stripped, but the copper is nicked.",
    },
    {
      id: "slip-it",
      prompt: "Now set the stripper to 18 and strip again.",
      goal: (lab) => tried(lab, 18, "slipped"),
      hints: ["Tap the stripper and pick 18, then Strip."],
      highlight: ["WS1"],
      success: "It just slips.",
    },
    {
      id: "clean-strip",
      prompt: "Strip the red wire at 22, on the solid scale.",
      goal: clean22,
      hints: ["The wire is 22 AWG solid.", "Pick 22 on the solid scale, then Strip."],
      highlight: ["WS1"],
      nudges: [{ when: (lab) => end(lab)?.notch === 22 && end(lab)?.scale === "stranded", say: "That's the stranded scale. This wire is solid." }],
      success: "Clean copper, no mark.",
    },
    {
      id: "twist-strands",
      prompt: "Strip the stranded wire at 22 on its own scale, then twist it.",
      goal: (lab) => {
        const e = lab.solder.strip("HW2", "b");
        return !!e && e.clean && !!e.twisted;
      },
      hints: ["Move the stripper so its jaws reach the black wire's end.", "Stranded scale, 22, Strip. Then twist the wire."],
      success: "Strands twisted tight.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "This end is nicked. It will snap. Strip it again.",
      setup: NICKED,
      goal: (lab) => {
        if (end(lab)?.nicked) lab.memory["nicked"] = true;
        return lab.memory["nicked"] === true && clean22(lab);
      },
      hints: ["Which notch matches 22 AWG solid?", "Set 22 on the solid scale, then Strip."],
      highlight: ["WS1"],
      success: "Clean again.",
    },
  ],
  solution: [
    { do: "action", part: "WS1", action: "strip" },
    { do: "check", task: "nick-it" },
    { do: "param", part: "WS1", params: { notch: 18 } },
    { do: "action", part: "WS1", action: "strip" },
    { do: "check", task: "slip-it" },
    { do: "param", part: "WS1", params: { notch: 22 } },
    { do: "action", part: "WS1", action: "strip" },
    { do: "check", task: "clean-strip" },
    // The secret: the stripper's jaws to the stranded wire's end, its stranded scale, then twist.
    { do: "move", part: "WS1", at: "desk:10,28" },
    { do: "param", part: "WS1", params: { scale: "stranded", notch: 22 } },
    { do: "action", part: "WS1", action: "strip" },
    { do: "action", part: "HW2", action: "twist" },
    { do: "check", task: "twist-strands" },
    ...NICKED,
    { do: "param", part: "WS1", params: { notch: 22 } },
    { do: "action", part: "WS1", action: "strip" },
    { do: "check", task: "fix-it" },
  ],
});
