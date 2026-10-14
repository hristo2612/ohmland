// Blueprint: docs/curriculum/unit-3.md, MP12. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/perfboard/perfboard-debug. One idea: check every connection on the plan, one line at a
// time.
// The robot's spare antenna blinker (lib/blinker.ts), finished and copper side up, clipped to a 9 V battery at its
// + and − pads (A12, I12). Its plan card numbers the sixteen connections. One joint is cold: D2's cathode in C10,
// on line 10 (E10 to C10). A cold joint conducts loosely (a few ohms: the meter still beeps) and opens while the board
// is pressed, so the blinker winks, then quits. The meter's continuity beep needs the battery off; parts never beep
// through (1 kΩ, LEDs and junctions read over range), so a line beeps only through metal. The fix-it: another
// blinker with a solder bridge from Q1's base pad (E3) to its emitter's (E2): Q1 never switches on, D1 stays dark and
// D2 stares.
// Headless replays have no station engine: the solution writes the joints a learner would make (lib/solder.ts).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { GHOSTS, LINKS, goodAt, padsOf, takingTurns } from "./lib/blinker";
import { joint, jointsStep, sound } from "./lib/solder";

const board = (lab: LabView) => lab.solder.board("PB3");
const PADS = padsOf(...GHOSTS.map((g) => g.id));
const blinking = (lab: LabView) => takingTurns(lab, 0.6, 1.3);
const beeping = (lab: LabView) => lab.meter?.mode === "continuity" && !!lab.meter.beep;
/** The pad a probe tip touches on the board: the pad itself, or a leg that goes through it. */
const padAt = (lab: LabView, anchor: string | null): string | null => {
  if (!anchor?.startsWith("pin:")) return null;
  const [id, leg] = anchor.slice(4).split(".");
  if (id === "PB3") return leg ?? null;
  const h = lab.bench.parts.find((p) => p.id === id)?.holes?.[leg ?? ""];
  return h?.startsWith("PB3:") ? h.slice(4) : null;
};
/** Continuity on, one probe tip on each of two pads (either way round). */
const onPads = (lab: LabView, a: string, b: string) => {
  const m = lab.meter;
  if (m?.mode !== "continuity") return false;
  const r = padAt(lab, m.redAt);
  const k = padAt(lab, m.blackAt);
  return (r === a && k === b) || (r === b && k === a);
};
const batteryOn = (lab: LabView) => lab.connected("B1.pos", "PB3.A12") && lab.connected("B1.neg", "PB3.I12");

/** The fix-it bench: another blinker, every joint good but a bridge from Q1's base pad to its emitter's. */
const BRIDGED: SolutionStep[] = [
  { do: "probe", red: null, black: null },
  { do: "dial", mode: "off" },
  { do: "param", part: "PB3", params: { flexed: false, flipped: false } },
  jointsStep("PB3", { ...goodAt(PADS), E3: joint("bridge", { bridgeTo: "E2" }) }),
  { do: "clip", lead: "TL1", end: "b", to: "PB3.A12" },
];

export default defineLab({
  id: "perfboard-debug",
  title: "The winking fault",
  bench: {
    board: "none",
    frame: ["desk:-70,-45", "desk:120,60"],
    parts: [
      {
        id: "PB3",
        kind: "perfboard",
        at: "desk:0,0",
        params: { cols: 12, rows: 9, flipped: true, plan: "PC3", links: LINKS, joints: { ...goodAt(PADS), C10: joint("cold") } } as never,
        locked: true,
        label: "Spare blinker",
      },
      ...GHOSTS.filter((g) => g.id !== "B1").map((g) => ({
        id: g.id,
        kind: g.kind,
        holes: Object.fromEntries(Object.entries(g.legs).map(([leg, pad]) => [leg, `PB3:${pad}`])),
        params: g.kind === "resistor" ? { ohms: ["R1", "R2"].includes(g.id) ? 1000 : 68000 } : g.kind === "led" ? { color: "red", size: 3 } : g.kind === "electrolytic-cap" ? { farads: 10e-6, volts: 16 } : {},
        locked: true,
      })) as never[],
      { id: "PC3", kind: "plan-card", at: "desk:-130,0", params: { title: "Blinker", cols: 12, rows: 9, ghosts: GHOSTS.filter((g) => g.id !== "B1"), lines: LINKS.map((l) => [l.a, l.b]) } as never, locked: true, label: "Plan" },
      { id: "B1", kind: "battery", at: "desk:60,-25", rot: 270, params: { emf: 9.4, internalOhms: 1.7 }, locked: true, label: "9 V battery" },
      { id: "ST1", kind: "solder-station", at: "desk:-95,-80", params: { on: true, setC: 370, iron: "stand", spool: "SD1" }, locked: true, label: "Soldering iron" },
      { id: "SD1", kind: "solder-spool", at: "desk:-40,45", params: { alloy: "lead-free" }, locked: true, label: "Lead-free solder" },
      { id: "BR1", kind: "solder-braid", at: "desk:-5,48", locked: true, label: "Desoldering braid" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "PB3.A12", color: "red" },
      { id: "TL2", from: "B1.neg", to: "PB3.I12", color: "black" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:95,25", mode: "off", tips: { red: "desk:40,40", black: "desk:52,46" } }],
  },
  mascot: {
    hint: "One line at a time. Beep, then the next.",
    fried: "Nothing fried. Just a lazy joint.",
  },
  tasks: [
    {
      id: "power-off",
      prompt: "Unclip the battery's red lead from the board.",
      goal: (lab) => !lab.connected("B1.pos", "PB3.A12"),
      hints: ["Drag the red clip off the board's + pad."],
      highlight: ["TL1"],
      success: "Power off.",
    },
    {
      id: "beep-line-1",
      prompt: "Meter to the beep. Probe the two pads of the plan's line 1.",
      goal: (lab) => onPads(lab, "A12", "A7") && beeping(lab),
      hints: ["Turn the dial to the beep symbol.", "Line 1 joins A12 and A7: a probe on each pad."],
      highlight: ["PC3"],
      nudges: [{ when: (lab) => lab.meter?.mode === "continuity" && batteryOn(lab), say: "Battery off first. Beep only dead circuits." }],
      success: "Beep: joined.",
    },
    {
      id: "find-silent",
      prompt: "Press the board, then beep the lines one by one until one stays silent.",
      goal: (lab) => lab.heldFor(0.5, !!board(lab)?.flexed && onPads(lab, "E10", "C10") && !beeping(lab)),
      hints: ["Turn on the board's flex setting first.", "The lamp that quit was D2. Try the lines round it."],
      highlight: ["PB3"],
      success: "Line 10 went quiet.",
    },
    {
      id: "reheat",
      prompt: "Reheat the grey joint with a touch of solder.",
      goal: (lab) => lab.solder.iron?.at !== "PB3.C10" && sound(lab, "PB3.C10"),
      hints: ["Rest the iron on it, add a touch of solder, lift and hold still."],
      highlight: ["spot:PB3.C10"],
      success: "A volcano now.",
    },
    {
      id: "flex-proof",
      prompt: "Clip the battery back on, flip the board, and press it.",
      goal: (lab) => lab.heldFor(3, batteryOn(lab) && !board(lab)?.flipped && !!board(lab)?.flexed && blinking(lab)),
      hints: ["Red clip back on the + pad.", "Flip the board, then turn on its flex setting."],
      highlight: ["TL1", "PB3"],
      success: "Pressed, still blinking.",
    },
    {
      id: "no-line-no-beep",
      prompt: "Beep two pads that no line joins.",
      goal: (lab) => {
        const m = lab.meter;
        const r = padAt(lab, m?.redAt ?? null);
        const k = padAt(lab, m?.blackAt ?? null);
        return lab.heldFor(0.5, !!m && m.mode === "continuity" && !!r && !!k && r !== k && !lab.connected(`PB3.${r}`, `PB3.${k}`) && !m.beep);
      },
      hints: ["Pick two pads with no line between them on the plan."],
      success: "Silence.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "My last blinker stares with one eye. Fix it.",
      setup: BRIDGED,
      goal: (lab) => {
        if (lab.solder.joint("PB3.E3")?.bridgeTo) lab.memory["bridge"] = true;
        return lab.memory["bridge"] === true && !lab.solder.joint("PB3.E3")?.bridgeTo && sound(lab, "PB3.E3") && blinking(lab);
      },
      hints: ["Battery off, then beep pads the plan doesn't join.", "Found the bridge? Braid on it, iron on the braid."],
      highlight: ["PB3"],
      success: "It blinks.",
    },
  ],
  solution: [
    { do: "clip", lead: "TL1", end: "b", to: null },
    { do: "check", task: "power-off" },
    { do: "probe", red: "PB3.A12", black: "PB3.A7", mode: "continuity" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "beep-line-1" },
    { do: "param", part: "PB3", params: { flexed: true } },
    { do: "probe", red: "PB3.E10", black: "PB3.C10" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "find-silent" },
    { do: "param", part: "ST1", params: { iron: "PB3.C10" } },
    jointsStep("PB3", goodAt(PADS)),
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "reheat" },
    { do: "probe", red: null, black: null },
    { do: "dial", mode: "off" },
    { do: "clip", lead: "TL1", end: "b", to: "PB3.A12" },
    { do: "param", part: "PB3", params: { flipped: false } },
    { do: "wait", seconds: 6 },
    { do: "check", task: "flex-proof" },
    { do: "clip", lead: "TL1", end: "b", to: null },
    { do: "probe", red: "PB3.E5", black: "PB3.E6", mode: "continuity" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "no-line-no-beep" },
    ...BRIDGED,
    { do: "wait", seconds: 1 },
    jointsStep("PB3", goodAt(PADS)),
    { do: "wait", seconds: 5 },
    { do: "check", task: "fix-it" },
  ],
});
