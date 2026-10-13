// Blueprint: docs/curriculum/unit-1.md, L18. Four batteries (9 V alkaline, AA alkaline, AA NiMH, 3 V lithium coin),
// a test station (a bay for any battery, + and − terminals, a switchable 100 Ω load) with the meter's probes clipped
// to its terminals, a display case (a phone Li-ion pack and a car battery, with safety notes on placards), and a
// time-lapse rig: a 9 V battery lighting a red LED through 470 Ω (about 15 mA), a desk clock and a speed slider.
// The blueprint's "tap for a safety card" is the placards' printed notes.
import { defineLab, type LabView } from "@ohmland/lab";

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

export default defineLab({
  id: "battery-field-guide",
  title: "A field guide to batteries",
  speed: 1,
  bench: {
    board: "none",
    parts: [
      // The battery shelf, down the left of the bench.
      { id: "B1", kind: "battery", at: "desk:-176,-54", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, label: "9 V alkaline" },
      { id: "X1", kind: "battery", at: "desk:-180,10", params: { size: "aa", chem: "alkaline", emf: 1.58, internalOhms: 0.15, mAh: 2500 }, label: "AA alkaline" },
      { id: "X2", kind: "battery", at: "desk:-180,44", params: { size: "aa", chem: "nimh", emf: 1.32, internalOhms: 0.03, mAh: 2000 }, label: "AA NiMH rechargeable" },
      { id: "X3", kind: "battery", at: "desk:-178,82", params: { size: "coin", emf: 3.2, internalOhms: 15, mAh: 225 }, label: "3 V coin cell" },
      { id: "T1", kind: "station", at: "desk:-60,-34", params: { load: false, loadOhms: 100 }, locked: true, label: "Battery tester" },
      { id: "SC1", kind: "showcase", at: "desk:200,-60", locked: true, label: "Display case" },
      // The time-lapse rig: a 9 V battery, 470 Ω and a red LED, about 15 mA.
      { id: "B5", kind: "battery", at: "desk:72,58", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "Time-lapse battery" },
      { id: "R9", kind: "resistor", at: "desk:128,36", params: { ohms: 470, watts: 0.25 }, locked: true, label: "470 Ω resistor" },
      { id: "D9", kind: "led", at: "desk:182,62", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
      { id: "CK1", kind: "clock", at: "desk:124,-6", locked: true, label: "Clock" },
    ],
    leads: [
      { id: "TL1", from: "B5.pos", to: "R9.a", color: "red" },
      { id: "TL2", from: "R9.b", to: "D9.anode", color: "yellow" },
      { id: "TL3", from: "D9.cathode", to: "B5.neg", color: "black" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:36,-34", rot: -6, mode: "dcv", range: "20V", probes: { red: "T1.a", black: "T1.b" } }],
    controls: [{ id: "lapse", label: "Time-lapse speed", key: "speed", min: 1, max: 3600, value: 1, scale: "log", unit: "×" }],
  },
  notebook: { tags: { rest: (lab) => !loadOn(lab), load: (lab) => loadOn(lab) } },
  mascot: {
    start: "So many batteries. Let's meet the whole family.",
    hint: "Capacity divided by current. That gives you hours.",
    success: "Bench built, lamp lit, lab powered. This island is officially alive.",
  },
  tasks: [
    {
      id: "survey",
      prompt: "Load off. Test each battery in the tester.",
      goal: (lab) => CELLS.every(([id, lo, hi]) => logged(lab, id, "rest").some((r) => r.si >= lo && r.si <= hi)),
      hints: ["Drop a battery on the tester. The last one hops out.", "Hold each reading until the notebook logs it."],
      highlight: ["T1", "B1", "X1", "X2", "X3"],
      success: "Four chemistries, four voltages. NiMH sits lower, by design.",
    },
    {
      id: "load-test",
      prompt: "Load on. Test all four again.",
      goal: (lab) => CELLS.every(([id]) => logged(lab, id, "load").length > 0),
      hints: ["Flip the tester's load switch, then read each one.", "The coin cell keeps creeping down. Give it a few seconds."],
      highlight: ["T1"],
      success: "The AAs barely notice. The coin cell sags about 0.4 V: a sipper, not a gulper.",
    },
    {
      id: "run-time",
      prompt: "500 mAh at 15 mA: how many hours? Then run the time-lapse.",
      goal: (lab) => {
        const h = lab.note("hours");
        const mem = lab.memory as { lit?: boolean };
        if (lab.isLit("D9", 0.3)) mem.lit = true;
        // Played to the end: the rig's LED has faded out after more than a day of simulated time.
        return h !== null && h >= 25 && h <= 40 && !!mem.lit && lab.t > 20 * 3600 && (lab.part("D9")?.glow ?? 1) < 0.05;
      },
      note: { id: "hours", label: "Your estimate", unit: "h" },
      hints: ["mAh divided by mA gives hours.", "Slide the time-lapse speed all the way up. Watch the clock."],
      highlight: ["D9", "CK1"],
      success: "About 33 hours. The time-lapse agrees, give or take.",
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
    { do: "param", part: "T1", params: { load: false } },
    { do: "note", id: "hours", value: "33" },
    { do: "control", id: "lapse", value: 3600 },
    { do: "wait", seconds: 45 },
    { do: "check", task: "run-time" },
  ],
});
