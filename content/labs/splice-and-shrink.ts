// Blueprint: docs/curriculum/unit-3.md, MP7. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/wires-and-power/splice-and-shrink. One idea: heat-shrink goes on the wire before the joint
// is made.
// Two pairs of 22 AWG wires lengthen the robot's battery leads: each pair's far ends are held in little boards (the
// battery's pads on the left, the blinker's on the right), and their stripped near ends meet end to end in the middle,
// red at (0, -12) and black at (0, 12). A spare spliced pair with free ends lies in front, for the secret and the
// fix-it. 2:1 tubes: T2 and T4 (3.2 mm), T3 (6.4 mm), T6 (3.2 mm, a spare); a heat gun, off.
// From the bench (packages/bench src/solder/ops.ts, shrink.ts): a tube slides onto a wire only past a free end, so once
// both ends of a splice are held (in a hole or in a joint) nothing gets on; the gun's air is about 170 °C 20 mm from
// the nozzle and shrinks a 3.2 mm tube to half in a second or two; held closer than about 8 mm (over 215 °C for 1.5 s)
// the tube splits. A shrunk 3.2 mm tube grips a splice; a 6.4 mm one shrinks only to 3.2 mm and stays loose.
// Headless replays have no station engine: the solution writes the joints and sets the shrink a learner's gun gives.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { joint, sound, spliceStep } from "./lib/solder";

const RED = "HW1.b";
const BLACK = "HW3.b";
const SPARE = "HW5.b";
const tube = (lab: LabView, id: string) => lab.solder.tube(id);
const near = (lab: LabView, id: string, at: [number, number], mm: number) => {
  const p = lab.bench.parts.find((x) => x.id === id);
  return !!p && Math.hypot(p.pos[0] - at[0], p.pos[1] - at[1]) < mm;
};
const shrunkOver = (lab: LabView, id: string, splice: string) => {
  const t = tube(lab, id);
  return !!t && t.over === splice && t.shrink >= 0.9 && !t.split;
};
const stripped = { mm: 10, notch: 22, scale: "solid", clean: true, nicked: false, slipped: false, cutStrands: 0, twisted: false };
const SPLICE = joint("good", { kind: "splice" });

/** The fix-it bench: the big tube off the spare splice, and T5 shrunk over it too hot: split. */
const SPLIT: SolutionStep[] = [
  { do: "param", part: "T3", params: { on: null, shrink: 0 } as never },
  { do: "move", part: "T3", at: "desk:75,-45" },
  { do: "param", part: "HG1", params: { on: false } },
  { do: "place", part: "T5", kind: "heat-shrink", at: "desk:0,45", params: { size: 3.2, on: "HW5", at: 60, shrink: 1, split: true } as never },
];

export default defineLab({
  id: "splice-and-shrink",
  title: "The short snap",
  bench: {
    board: "none",
    frame: ["desk:-130,-105", "desk:135,75"],
    parts: [
      { id: "ST1", kind: "solder-station", at: "desk:-60,-75", params: { on: true, setC: 370, iron: "stand", spool: "SD1" }, locked: true, label: "Soldering iron" },
      { id: "SD1", kind: "solder-spool", at: "desk:-110,40", params: { alloy: "lead-free" }, locked: true, label: "Lead-free solder" },
      // The battery's pads (left) and the blinker's pads (right): little boards holding the pairs' far ends.
      { id: "PB1", kind: "perfboard", at: "desk:-70,0", params: { cols: 6, rows: 2 }, locked: true, label: "Battery pads" },
      { id: "PB2", kind: "perfboard", at: "desk:70,0", params: { cols: 6, rows: 2 }, locked: true, label: "Blinker pads" },
      { id: "HW1", kind: "hookup-wire", at: "desk:-30,-12", holes: { a: "PB1:A3" }, params: { color: "red", awg: 22, len: 60, ends: { b: stripped } } as never, locked: true, label: "Red lead" },
      { id: "HW2", kind: "hookup-wire", at: "desk:31,-12", holes: { b: "PB2:A3" }, params: { color: "red", awg: 22, len: 60, ends: { a: stripped } } as never, locked: true, label: "Red extension" },
      { id: "HW3", kind: "hookup-wire", at: "desk:-30,12", holes: { a: "PB1:B3" }, params: { color: "black", awg: 22, len: 60, ends: { b: stripped } } as never, locked: true, label: "Black lead" },
      { id: "HW4", kind: "hookup-wire", at: "desk:31,12", holes: { b: "PB2:B3" }, params: { color: "black", awg: 22, len: 60, ends: { a: stripped } } as never, locked: true, label: "Black extension" },
      // A spare splice with both ends free, in front.
      { id: "HW5", kind: "hookup-wire", at: "desk:-30,45", params: { color: "white", awg: 22, len: 60, ends: { b: stripped }, joints: { b: { ...SPLICE, with: "HW6.a" } } } as never, locked: true, label: "Spare wire" },
      { id: "HW6", kind: "hookup-wire", at: "desk:31,45", params: { color: "white", awg: 22, len: 60, ends: { a: stripped } } as never, locked: true, label: "Spare wire" },
      { id: "T2", kind: "heat-shrink", at: "desk:45,-45", params: { size: 3.2 }, label: "Heat-shrink" },
      { id: "T4", kind: "heat-shrink", at: "desk:60,-55", params: { size: 3.2 }, label: "Heat-shrink" },
      { id: "T3", kind: "heat-shrink", at: "desk:75,-45", params: { size: 6.4 }, label: "Big heat-shrink" },
      { id: "T6", kind: "heat-shrink", at: "desk:90,-55", params: { size: 3.2 }, label: "Heat-shrink" },
      { id: "HG1", kind: "heat-gun", at: "desk:115,40", params: { on: false }, label: "Heat gun" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Tube on the wire before the joint.",
    fried: "Nothing fried. Tubes are cheap.",
  },
  tasks: [
    {
      id: "red-splice",
      prompt: "Solder the red ends together.",
      goal: (lab) => lab.solder.iron?.at !== RED && sound(lab, RED),
      hints: ["Rest the iron where the red ends meet, then feed solder there.", "Lift the solder, then the iron, and hold still."],
      highlight: [`spot:${RED}`],
      success: "Spliced.",
    },
    {
      id: "tube-blocked",
      prompt: "Slide a heat-shrink tube over the red joint.",
      // Dropped by the red joint, it stays on the desk: both ends of the red wire are held now.
      goal: (lab) => sound(lab, RED) && ["T2", "T4", "T6"].some((t) => !tube(lab, t)?.on && near(lab, t, [0, -12], 25)),
      hints: ["Drag a thin black tube onto the red joint."],
      highlight: ["T2", `spot:${RED}`],
      success: "It won't go on.",
    },
    {
      id: "black-tube",
      prompt: "Slide a tube onto a black wire first, away from its end.",
      goal: (lab) => ["T2", "T4", "T6"].some((t) => ["HW3", "HW4"].includes(tube(lab, t)?.on ?? "")),
      hints: ["Drag a tube onto a black wire's free end.", "Then slide it back, away from the joint."],
      highlight: ["T4", "HW3.b"],
      nudges: [{ when: (lab) => sound(lab, BLACK), say: "Too late for that pair. Tap Show me." }],
      success: "Tube on, parked.",
    },
    {
      id: "black-splice",
      prompt: "Now solder the black ends together.",
      goal: (lab) => lab.solder.iron?.at !== BLACK && sound(lab, BLACK) && ["T2", "T4", "T6"].some((t) => ["HW3", "HW4"].includes(tube(lab, t)?.on ?? "")),
      hints: ["Iron where the black ends meet, then the solder.", "Lift the solder, then the iron."],
      highlight: [`spot:${BLACK}`],
      success: "Spliced, tube waiting.",
    },
    {
      id: "shrink-black",
      prompt: "Slide the tube over the black joint and shrink it with the heat gun.",
      goal: (lab) => ["T2", "T4", "T6"].some((t) => shrunkOver(lab, t, BLACK)),
      hints: ["Slide the tube along until it covers the joint.", "Gun on, its nozzle a hand's width away. Keep it moving."],
      highlight: ["HG1"],
      nudges: [{ when: (lab) => ["T2", "T4", "T6"].some((t) => !!tube(lab, t)?.split), say: "Split! Too close. A new tube, gentler heat." }],
      success: "Snug and sealed.",
    },
    {
      id: "too-big",
      prompt: "Shrink the big tube over the spare splice.",
      goal: (lab) => shrunkOver(lab, "T3", SPARE) && !tube(lab, "T3")?.grip,
      hints: ["The spare's ends are free: slide the big tube on and over its joint.", "Then the gun."],
      success: "Shrunk, but it still slides about.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "This tube split. Redo it, gently.",
      setup: SPLIT,
      goal: (lab) => {
        if (tube(lab, "T5")?.split && tube(lab, "T5")?.over === SPARE) lab.memory["split"] = true;
        return lab.memory["split"] === true && tube(lab, "T5")?.over !== SPARE && ["T2", "T4", "T6"].some((t) => shrunkOver(lab, t, SPARE) && !!tube(lab, t)?.grip);
      },
      hints: ["Slide the split tube off past a free end.", "A new tube on, over the joint, and the gun a hand's width away."],
      highlight: ["T5", "HG1"],
      success: "Snug, no split.",
    },
  ],
  solution: [
    { do: "param", part: "ST1", params: { iron: RED } },
    spliceStep("HW1", "b", "HW2.a", SPLICE),
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "red-splice" },
    { do: "move", part: "T2", at: "desk:2,-8" },
    { do: "check", task: "tube-blocked" },
    { do: "param", part: "T4", params: { on: "HW4", at: 40 } as never },
    { do: "check", task: "black-tube" },
    { do: "param", part: "ST1", params: { iron: BLACK } },
    spliceStep("HW3", "b", "HW4.a", SPLICE),
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "black-splice" },
    // Slid along onto the joint (end a of HW4 is the joint), then shrunk by the gun's air.
    { do: "param", part: "T4", params: { at: 2 } as never },
    { do: "param", part: "T4", params: { shrink: 1 } as never },
    { do: "check", task: "shrink-black" },
    { do: "param", part: "T3", params: { on: "HW5", at: 60, shrink: 1 } as never },
    { do: "check", task: "too-big" },
    ...SPLIT,
    { do: "param", part: "T5", params: { on: null } as never },
    { do: "move", part: "T5", at: "desk:20,80" },
    { do: "param", part: "T6", params: { on: "HW5", at: 60, shrink: 1 } as never },
    { do: "check", task: "fix-it" },
  ],
});
