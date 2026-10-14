// Start here, case 9: "The prefix padlock" (docs/curriculum/start-here.md, SH9). A bench lesson (docs/LESSONS.md): its
// tasks are the beats of content/units/start-here/tool-cases/milli-and-kilo/lesson.yaml, in the same order.
// One idea: a prefix moves the decimal point three places. k is a thousand, m is a thousandth.
// The lamp loop runs with a gate in number mode on the lead into the lamp (it reads 0.007552 A, or 7.55 mA) and a tag
// on its resistor ("1 kΩ"). The parts cabinet is locked by a three-wheel padlock whose clues are three tags on the desk.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** The padlock's answers, and the three faces each wheel turns through (a tap turns it to the next). */
const WHEELS = ["4,700 Ω", "0.02 A", "9,000 mV"];
const FACES = [
  ["47 Ω", "470 Ω", "4,700 Ω"],
  ["0.2 A", "0.02 A", "0.002 A"],
  ["90 mV", "900 mV", "9,000 mV"],
];

/** What wheel `i` (0, 1, 2) of the cabinet's padlock shows now (its `wheel1` ... param), or null before its first turn. */
const wheel = (lab: LabView, i: number): string | null => {
  const at = lab.prop("CAB")?.[`wheel${i + 1}`];
  return typeof at === "number" ? (FACES[i]![at % 3] ?? null) : null;
};
/** The step that turns wheel `i` to its answer (a learner taps it round, a face at a time). */
const turn = (i: number): SolutionStep[] => [{ do: "param", part: "CAB", params: { [`wheel${i + 1}`]: FACES[i]!.indexOf(WHEELS[i]!) } }];

/** The fix-it bench: a parts tray labelled 4,700 Ω with the wrong tag (470 Ω) filed in it. */
const WRONG_TAG: SolutionStep[] = [
  { do: "place", part: "BN1", kind: "bin", at: "desk:62,118", params: { style: "tray", label: "4,700 Ω" } },
  { do: "place", part: "L6", kind: "tag", at: "in:BN1", params: { text: "470 Ω" } },
];

export default defineLab({
  id: "milli-and-kilo",
  title: "The prefix padlock",
  bench: {
    board: "none",
    frame: ["desk:-236,-96", "desk:150,172"],
    parts: [
      // The lamp loop, lit from the start: 7.55 mA through the 1 kΩ resistor and the red LED.
      { id: "B1", kind: "battery", at: "desk:-206,4", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 volt battery" },
      { id: "R1", kind: "resistor", at: "desk:-142,-48", params: { ohms: 1000, watts: 0.25 }, locked: true, label: "1 kilohm resistor" },
      { id: "D1", kind: "led", at: "desk:-92,22", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Red LED" },
      { id: "L0", kind: "tag", at: "desk:-142,-24", params: { text: "1 kΩ" }, locked: true, label: "1 kilohm tag" },
      // A gate on the lead into the lamp, showing the flow as a number.
      { id: "G1", kind: "gate", at: "lead:TL2", params: { mode: "number", unit: "A" }, locked: true, label: "Gate" },
      // The parts cabinet and its padlock's three clues.
      { id: "CAB", kind: "box", at: "desk:62,-42", params: { style: "cabinet", lock: { wheels: WHEELS, set: [false, false, false], faces: FACES } }, locked: true, label: "Parts cabinet" },
      { id: "L1", kind: "tag", at: "desk:20,40", params: { text: "4.7 kΩ" }, label: "4.7 kilohm tag" },
      { id: "L2", kind: "tag", at: "desk:62,40", params: { text: "20 mA" }, label: "20 milliamp tag" },
      { id: "L3", kind: "tag", at: "desk:104,40", params: { text: "9 V" }, label: "9 volt tag" },
      // Inside the cabinet: parts for the last case, and a tag with a capital M.
      { id: "L4", kind: "tag", at: "in:CAB.s1", params: { text: "2.2 MΩ" }, label: "2.2 megohm tag" },
      { id: "R5", kind: "resistor", at: "in:CAB.s3", params: { ohms: 1000 }, label: "1 kilohm resistor" },
      { id: "D5", kind: "led", at: "in:CAB.s5", params: { color: "red" }, label: "Red LED" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
      { id: "TL2", from: "R1.b", to: "D1.anode", color: "green" },
      { id: "TL3", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Three places, every time.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "tap-the-a",
      prompt: "Tap the A on the gate's flag.",
      goal: (lab) => lab.gateUnit("G1") === "mA",
      hints: ["The A sits at the right end of the gate's paper flag.", "Tap that A once."],
      highlight: ["G1"],
      success: "7.55 mA.",
    },
    {
      id: "tap-the-k",
      prompt: "Tap the resistor's tag.",
      goal: (lab) => lab.tagShown("L0") === "1,000 Ω",
      hints: ["The little paper tag in front of the resistor.", "Tap it once."],
      highlight: ["L0"],
      success: "1,000 Ω.",
    },
    ...[0, 1, 2].map((i) => ({
      id: `wheel-${["one", "two", "three"][i]}`,
      prompt: `Turn wheel ${i + 1} until it shows ${["4.7 kΩ", "20 mA", "9 V"][i]} without its prefix.`,
      // The wheel itself is the check: the beat ends when it shows the right face.
      goal: (lab: LabView) => wheel(lab, i) === WHEELS[i],
      hints: [["k means times a thousand.", "Tap the wheel until it reads 4,700 Ω."], ["m means a thousandth. Three places left.", "Tap the wheel until it reads 0.02 A."], ["A volt is a thousand millivolts.", "Tap the wheel until it reads 9,000 mV."]][i]!,
      highlight: [`part:CAB/wheel${i + 1}`],
      success: "Click.",
    })),
    {
      id: "open-padlock",
      prompt: "All three wheels are set. Lift the cabinet's lid.",
      goal: (lab) => lab.lidOpen("CAB"),
      hints: ["Tap the cabinet's lid."],
      highlight: ["CAB"],
      success: "Open!",
    },
    {
      id: "fix-it",
      prompt: "The tray says 4,700 Ω. File the right tag in it.",
      setup: WRONG_TAG,
      goal: (lab) => {
        const held = lab.holds("BN1");
        return held.includes("L1") && !held.includes("L6");
      },
      hints: ["Tap a tag to see it without its prefix.", "Take the 470 Ω tag out. Drop the 4.7 kΩ tag in."],
      highlight: ["BN1", "L1"],
      success: "Filed right.",
    },
    {
      id: "mega",
      prompt: "Find the tag with a capital M.",
      goal: (lab) => lab.tagShown("L4") === "2,200,000 Ω",
      hints: ["It is inside the cabinet. Tap it."],
      highlight: ["L4"],
      success: "2,200,000 Ω.",
      bonus: true,
    },
  ],
  solution: [
    { do: "param", part: "G1", params: { unit: "mA" } },
    { do: "check", task: "tap-the-a" },
    { do: "param", part: "L0", params: { alt: true } },
    { do: "check", task: "tap-the-k" },
    ...turn(0),
    { do: "check", task: "wheel-one" },
    ...turn(1),
    { do: "check", task: "wheel-two" },
    ...turn(2),
    { do: "check", task: "wheel-three" },
    { do: "param", part: "CAB", params: { lid: true } },
    { do: "check", task: "open-padlock" },
    // The secret: the 2.2 MΩ tag inside the cabinet.
    { do: "param", part: "L4", params: { alt: true } },
    { do: "check", task: "mega" },
    ...WRONG_TAG,
    { do: "move", part: "L6", at: "desk:150,118" },
    { do: "move", part: "L1", at: "in:BN1" },
    { do: "check", task: "fix-it" },
  ],
});
