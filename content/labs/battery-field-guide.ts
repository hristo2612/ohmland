// Blueprint: docs/curriculum/unit-1.md, L18, the kept half after the split (docs/curriculum/conversion-guide.md, B3 18).
// The lab of a bench lesson (docs/LESSONS.md): content/units/basics/cells-and-batteries/battery-field-guide.
// One idea: some batteries hold their push under a heavy load and some sag, so match the battery to the job. Run time
// moved to how-long. Four batteries (9 V alkaline, AA alkaline, AA NiMH, 3 V lithium coin), a test station (a bay for
// any battery, + and − terminals, a switchable 100 Ω load) with the meter's probes clipped to its terminals, and a
// display case (a phone Li-ion pack and a car battery, with safety notes on placards). From the simulator, at rest
// and then loaded: 9 V 9.40 V and 9.23 V, AA 1.58 V and 1.58 V, NiMH 1.32 V and 1.32 V, coin 3.20 V and about 2.7 V.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const CELLS: [id: string, lo: number, hi: number][] = [
  ["B1", 9.0, 9.6],
  ["X1", 1.5, 1.65],
  ["X2", 1.25, 1.4],
  ["X3", 3.0, 3.3],
];

const loadOn = (lab: LabView): boolean => (lab.prop("T1") as { load?: boolean }).load === true;

/** Logged readings of a battery sitting in the test station, with the load off ("rest") or on ("load"). */
const logged = (lab: LabView, id: string, tag: "rest" | "load") =>
  lab.readings(`across:${id}`).filter((r) => r.mode === "dcv" && r.tags.includes(tag) && Number.isFinite(r.si));

/** The fix-it bench: the coin cell in the tester with the load on, the other three back on the shelf. */
const COIN_UNDER_LOAD: SolutionStep[] = [
  { do: "param", part: "T1", params: { load: true } },
  { do: "move", part: "X3", at: "in:T1" },
  { do: "move", part: "B1", at: "desk:-168,-58" },
  { do: "move", part: "X1", at: "desk:-172,-14" },
  { do: "move", part: "X2", at: "desk:-172,16" },
];

export default defineLab({
  id: "battery-field-guide",
  title: "Sippers and gulpers",
  bench: {
    board: "none",
    frame: ["desk:-200,-80", "desk:210,70"],
    parts: [
      // The battery shelf, down the left of the bench.
      { id: "B1", kind: "battery", at: "desk:-168,-58", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V alkaline" },
      { id: "X1", kind: "battery", at: "desk:-172,-14", params: { size: "aa", chem: "alkaline", emf: 1.58, internalOhms: 0.15, mAh: 2500 }, label: "AA alkaline" },
      { id: "X2", kind: "battery", at: "desk:-172,16", params: { size: "aa", chem: "nimh", emf: 1.32, internalOhms: 0.03, mAh: 2000 }, label: "AA NiMH rechargeable" },
      { id: "X3", kind: "battery", at: "desk:-170,48", params: { size: "coin", emf: 3.2, internalOhms: 15, mAh: 225 }, label: "3 V coin cell" },
      { id: "T1", kind: "station", at: "desk:-72,-46", params: { load: false, loadOhms: 100 }, locked: true, label: "Battery tester" },
      { id: "SC1", kind: "showcase", at: "desk:150,-30", locked: true, label: "Display case" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:30,-20", mode: "dcv", range: "20V", probes: { red: "T1.a", black: "T1.b" } }],
  },
  notebook: { tags: { rest: (lab) => !loadOn(lab), load: (lab) => loadOn(lab) } },
  mascot: {
    hint: "Read it at rest, then read it working.",
  },
  tasks: [
    {
      id: "survey",
      prompt: "Load off. Test each battery in the tester.",
      goal: (lab) => CELLS.every(([id, lo, hi]) => logged(lab, id, "rest").some((r) => r.si >= lo && r.si <= hi)),
      hints: ["Drop a battery on the tester. The last one hops out.", "Hold each reading until the notebook logs it."],
      highlight: ["T1", "B1", "X1", "X2", "X3"],
      success: "Four batteries, four pushes.",
    },
    {
      id: "load-test",
      prompt: "Load on. Test all four again.",
      goal: (lab) => CELLS.every(([id]) => logged(lab, id, "load").length > 0),
      hints: ["Flip the tester's load switch, then read each one.", "The coin cell keeps creeping down. Give it a few seconds."],
      highlight: ["T1"],
      success: "The AAs barely notice. The coin cell sags.",
    },
    {
      id: "pick-a-gulper",
      prompt: "The load drags the coin cell down. Pick a gulper.",
      setup: COIN_UNDER_LOAD,
      // The coin cell sagging under the load first (the setup), then a battery that holds its push.
      goal: (lab) => {
        const held = lab.holds("T1")[0];
        if (held === "X3" && loadOn(lab)) lab.memory["sag"] = true;
        const v = lab.meter?.value;
        return lab.memory["sag"] === true && loadOn(lab) && (held === "X1" || held === "X2") && typeof v === "number" && v >= 1.2 && v <= 1.7;
      },
      hints: ["Which ones barely noticed the load?", "Drop an AA cell on the tester. Keep the load on."],
      highlight: ["X1", "X2"],
      nudges: [{ when: (lab) => lab.holds("T1")[0] === "B1" && loadOn(lab), say: "Better. But the AAs were the real gulpers." }],
      success: "Steady under load.",
    },
  ],
  solution: [
    ...CELLS.flatMap(([id]) => [
      { do: "move" as const, part: id, at: "in:T1" },
      { do: "wait" as const, seconds: 1 },
    ]),
    { do: "check", task: "survey" },
    { do: "param", part: "T1", params: { load: true } },
    ...CELLS.flatMap(([id]) => [
      { do: "move" as const, part: id, at: "in:T1" },
      { do: "wait" as const, seconds: id === "X3" ? 10 : 1.5 },
    ]),
    { do: "check", task: "load-test" },
    ...COIN_UNDER_LOAD,
    { do: "wait", seconds: 1 },
    { do: "move", part: "X1", at: "in:T1" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "pick-a-gulper" },
  ],
});
