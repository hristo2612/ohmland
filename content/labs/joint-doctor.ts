// Blueprint: docs/curriculum/unit-3.md, MP4. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/soldering/joint-doctor. One idea: a joint's shape tells you what went wrong, and the fix.
// The robot's lamp board, copper side up: a battery behind it into A2 and A8 on the far edge, 1 kΩ from D2 to D6 and
// a red LED in D7 and D8, joined underneath by a link (A2 to D2) and two bent legs (R1.b to D7, D1.cathode to A8).
// Its six joints: A2 and D7 good (volcanoes), D2 cold (a dull lump), D6 too much (a ball), A8 too little (a thin
// ring), D8 bridged to D7. The bridge shorts the LED, so the lamp is dark until every joint is healed; the others still
// conduct (a cold joint loosely, opening while the board is flexed). The LED is on the top side: flip the board over
// to see it. Desoldering braid wicks extra solder when the iron rests on it over a joint (about a second is enough; a
// longer rest takes it all, and a little fresh solder puts it right). The fix-it: the battery joint at A8 turns cold,
// and the lamp flickers when the board flexes.
// The work area holds the board, the stand and the grip of an iron resting on the board (it leans back toward its
// stand, about 75 mm), the solder's end and the braid; the station's dial and the battery sit off its edges (the ink
// view draws a battery larger than life, so it stays well behind the board).
// Headless replays have no station engine: the solution writes the joints a learner would make (lib/solder.ts).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { joint, jointsStep, setAs, sound, type JointRecord } from "./lib/solder";

const iron = (lab: LabView) => lab.solder.iron;
const board = (lab: LabView) => lab.solder.board("PB1");
const PADS = ["A2", "D2", "D6", "D7", "D8", "A8"];

const HEALTHY: Record<string, JointRecord> = Object.fromEntries(PADS.map((p) => [p, joint("good")]));
const SICK: Record<string, JointRecord> = {
  ...HEALTHY,
  D2: joint("cold"),
  D6: joint("too-much"),
  A8: joint("too-little"),
  D8: joint("bridge", { bridgeTo: "D7" }),
};

/** The fix-it bench: the lamp seen from the top, every joint healthy but the battery's, which has gone cold. */
const FLICKER: SolutionStep[] = [jointsStep("PB1", { ...HEALTHY, A8: joint("cold") }), { do: "param", part: "PB1", params: { flexed: false, flipped: false } }];

export default defineLab({
  id: "joint-doctor",
  title: "The joint doctor",
  bench: {
    board: "none",
    frame: ["desk:-55,-60", "desk:105,65"],
    parts: [
      { id: "ST1", kind: "solder-station", at: "desk:-60,-20", params: { on: true, setC: 370, iron: "stand", spool: "SD1" }, locked: true, label: "Soldering iron" },
      // The spool lies in front of the board, the braid beside it.
      { id: "SD1", kind: "solder-spool", at: "desk:-10,45", params: { alloy: "lead-free" }, locked: true, label: "Lead-free solder" },
      { id: "BR1", kind: "solder-braid", at: "desk:88,10", locked: true, label: "Desoldering braid" },
      // The lamp board, copper side up: its parts stand in it from the top, only their legs show.
      {
        id: "PB1",
        kind: "perfboard",
        at: "desk:45,-10",
        params: { cols: 10, rows: 6, flipped: true, joints: SICK, bends: { "R1.b": "D7", "D1.cathode": "A8" }, links: [{ id: "L1", a: "A2", b: "D2" }] } as never,
        locked: true,
        label: "Lamp board",
      },
      { id: "B1", kind: "battery", at: "desk:90,-80", holes: { pos: "PB1:A2", neg: "PB1:A8" }, params: { snap: true, emf: 9.4, internalOhms: 1.7 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", holes: { a: "PB1:D2", b: "PB1:D6" }, params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", holes: { anode: "PB1:D7", cathode: "PB1:D8" }, params: { color: "red" }, locked: true, label: "Lamp" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Healthy joints look like little volcanoes.",
    fried: "Nothing fried. Just lumpy metal.",
  },
  tasks: [
    {
      id: "heal-cold",
      prompt: "Reheat the cold joint with a touch of fresh solder.",
      goal: (lab) => iron(lab)?.at !== "PB1.D2" && setAs(lab, "PB1.D2", "good"),
      hints: ["Rest the iron on the grey lump, then touch the solder to it.", "A short touch. Then lift the iron and hold still."],
      highlight: ["spot:PB1.D2"],
      nudges: [{ when: (lab) => iron(lab)?.at !== "PB1.D2" && setAs(lab, "PB1.D2", "too-much", "bridge"), say: "Too much. The braid can fix that later." }],
      success: "A volcano now.",
    },
    {
      id: "wick-the-ball",
      prompt: "Lay the braid on the ball and rest the iron on the braid.",
      goal: (lab) => iron(lab)?.at !== "PB1.D6" && setAs(lab, "PB1.D6", "good"),
      hints: ["Drag the braid's end onto the ball.", "Rest the iron on it for a second, then lift."],
      highlight: ["spot:BR1.end", "spot:PB1.D6"],
      nudges: [{ when: (lab) => setAs(lab, "PB1.D6", "too-little"), say: "Too much gone. Move the braid off, add a touch." }],
      success: "The braid drank the extra.",
    },
    {
      id: "heal-rest",
      prompt: "Heal the thin ring and the bridge.",
      goal: (lab) => iron(lab)?.at === null && setAs(lab, "PB1.A8", "good") && setAs(lab, "PB1.D8", "good") && !lab.solder.joint("PB1.D8")?.bridgeTo,
      hints: ["Thin ring: heat it and add solder.", "Bridge: braid on it, iron on the braid."],
      highlight: ["spot:PB1.A8", "spot:PB1.D8"],
      success: "Every patient healthy.",
    },
    {
      id: "see-it",
      prompt: "Flip the board over and look at the lamp.",
      goal: (lab) => !board(lab)?.flipped && lab.isLit("D1"),
      hints: ["Tap the board, then its flip setting."],
      highlight: ["PB1"],
      success: "Lit!",
    },
    {
      id: "make-cold",
      prompt: "Make a cold joint on purpose on an empty pad.",
      goal: (lab) => Object.entries(board(lab)?.joints ?? {}).some(([pad, v]) => !PADS.includes(pad) && v === "cold"),
      hints: ["Flip the board copper side up. Rest the iron on an empty pad, touch the solder, lift at once."],
      success: "Cold, on purpose.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "The lamp flickers when the board flexes. Fix it.",
      setup: FLICKER,
      goal: (lab) => {
        if (setAs(lab, "PB1.A8", "cold")) lab.memory["cold"] = true;
        return lab.memory["cold"] === true && sound(lab, "PB1.A8") && lab.heldFor(1.5, !!board(lab)?.flexed && lab.isLit("D1"));
      },
      hints: ["Flex the board from its settings and watch the lamp.", "Flip it, find the grey joint and reheat it. Then flex again."],
      highlight: ["PB1"],
      success: "Steady light, flexed or not.",
    },
  ],
  solution: [
    { do: "param", part: "ST1", params: { iron: "PB1.D2" } },
    jointsStep("PB1", { ...SICK, D2: joint("good") }),
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "heal-cold" },
    { do: "param", part: "ST1", params: { iron: "PB1.D6" } },
    jointsStep("PB1", { ...SICK, D2: joint("good"), D6: joint("good") }),
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "wick-the-ball" },
    jointsStep("PB1", HEALTHY),
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "heal-rest" },
    { do: "param", part: "PB1", params: { flipped: false } },
    { do: "check", task: "see-it" },
    { do: "param", part: "PB1", params: { flipped: true } },
    jointsStep("PB1", { ...HEALTHY, E3: joint("cold") }),
    { do: "check", task: "make-cold" },
    ...FLICKER,
    { do: "param", part: "PB1", params: { flexed: true } },
    { do: "wait", seconds: 0.5 },
    jointsStep("PB1", HEALTHY),
    { do: "wait", seconds: 2 },
    { do: "check", task: "fix-it" },
  ],
});
