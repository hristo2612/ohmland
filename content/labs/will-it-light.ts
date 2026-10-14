// Blueprint: docs/curriculum/start-here.md, SH2 "The junk drawer". A bench lesson (docs/LESSONS.md): its tasks are the
// beats of content/units/start-here/first-cases/will-it-light/lesson.yaml, in the same order.
// One idea: conductors let flow through, insulators stop it.
// The lamp loop has a gap between two loose clips; everyday objects from the drawer stand in for the missing lead.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { bridged } from "./lib/junk";

/** Across the gap: a clip on each end of an object (TL2's loose clip on `a`, TL3's on `b`). */
const across = (id: string): SolutionStep[] => [
  { do: "clip", lead: "TL2", end: "a", to: `${id}.a` },
  { do: "clip", lead: "TL3", end: "b", to: `${id}.b` },
];

/** The two sorting trays come out as the robot names the two kinds. */
const NAME_THE_TRAYS: SolutionStep[] = [
  { do: "place", part: "YES", kind: "bin", at: "desk:-72,165", params: { style: "tray", label: "CONDUCTORS" } },
  { do: "place", part: "NO", kind: "bin", at: "desk:72,165", params: { style: "tray", label: "INSULATORS" } },
];

/** The fix-it: a coated paper clip across the gap, one clip biting its plastic coating. */
const COATED_CLIP: SolutionStep[] = [
  { do: "place", part: "PC1", kind: "sample", at: "desk:0,45", params: { material: "clip" } },
  { do: "clip", lead: "TL2", end: "a", to: "coat:PC1" },
  { do: "clip", lead: "TL3", end: "b", to: "PC1.b" },
];

const CONDUCTORS = ["CN1", "F1"];
const INSULATORS = ["E1", "MB1", "WS1"];
const ALL = [...CONDUCTORS, ...INSULATORS];

/** Objects the learner has tested across the gap during the sort (shared, so the nudges can read it). */
const tested = (lab: LabView): Record<string, boolean> => ((lab.shared["tested"] ??= {}) as Record<string, boolean>);
const wrongTray = (lab: LabView) => lab.holds("YES").some((id) => !CONDUCTORS.includes(id) && id !== "K1") || lab.holds("NO").some((id) => !INSULATORS.includes(id) && id !== "SP1");
const sorted = (lab: LabView) => {
  const yes = lab.holds("YES");
  const no = lab.holds("NO");
  return [...CONDUCTORS, "K1"].every((id) => yes.includes(id)) && [...INSULATORS, "SP1"].every((id) => no.includes(id));
};

/** Broken first (the setup), then lit through the clip: a bench that never went dark does not count. */
const relit = (lab: LabView) => {
  if (!lab.isLit("D1")) lab.memory["dark"] = true;
  return lab.memory["dark"] === true && lab.isLit("D1") && lab.amps("PC1") > 0.001;
};

export default defineLab({
  id: "will-it-light",
  title: "Will it light?",
  bench: {
    board: "none",
    frame: ["desk:-185,-175", "desk:185,220"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:0,-125", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "R1", kind: "resistor", at: "desk:-50,-70", rot: 90, params: { ohms: 1000, watts: 0.25 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:50,-70", rot: 180, params: { color: "red", maxmA: 50 }, locked: true, label: "Lamp" },
      // The junk drawer, either side of the tester.
      { id: "K1", kind: "sample", at: "desk:-135,-70", params: { material: "key" }, label: "Key" },
      { id: "SP1", kind: "sample", at: "desk:-135,-20", params: { material: "spoon" }, label: "Plastic spoon" },
      { id: "CN1", kind: "sample", at: "desk:-150,30", params: { material: "coin" }, label: "Coin" },
      { id: "E1", kind: "sample", at: "desk:-120,75", params: { material: "eraser" }, label: "Eraser" },
      { id: "F1", kind: "sample", at: "desk:135,-70", params: { material: "foil" }, label: "Foil" },
      { id: "MB1", kind: "sample", at: "desk:150,-20", params: { material: "marble" }, label: "Glass marble" },
      { id: "WS1", kind: "sample", at: "desk:130,30", params: { material: "wood" }, label: "Wooden stick" },
      { id: "P1", kind: "sample", at: "desk:130,75", params: { material: "pencil" }, label: "Pencil lead" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "R1.a", color: "red" },
      // The gap: TL2's clip a and TL3's clip b lie loose on the desk.
      { id: "TL2", from: null, to: "R1.b", color: "yellow" },
      { id: "TL3", from: "D1.anode", to: null, color: "green" },
      { id: "TL4", from: "D1.cathode", to: "B1.neg", color: "black" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Clip one jaw on each end.",
    fried: "Oof. That lamp skipped its resistor. Fresh one in.",
  },
  tasks: [
    {
      id: "try-the-key",
      prompt: "Clip the key across the gap.",
      goal: (lab) => lab.isLit("D1") && lab.amps("K1") > 0.001,
      hints: ["One jaw on each end of the key."],
      highlight: ["K1", "lead:TL2.a", "lead:TL3.b"],
      success: "It glows!",
    },
    {
      id: "try-the-spoon",
      prompt: "Swap the key for the plastic spoon.",
      goal: (lab) => lab.heldFor(0.5, bridged(lab, "SP1") && lab.loopOpen("D1")),
      hints: ["Move both jaws from the key to the spoon's ends."],
      highlight: ["SP1"],
      success: "Dark.",
    },
    {
      id: "name-the-trays",
      prompt: "Drop the key and the spoon in their trays.",
      setup: NAME_THE_TRAYS,
      goal: (lab) => lab.heldBy("K1") === "YES" && lab.heldBy("SP1") === "NO",
      hints: ["The key lit the lamp: conductors.", "Drag each one onto its tray."],
      highlight: ["YES", "NO"],
      nudges: [{ when: (lab) => lab.heldBy("K1") === "NO" || lab.heldBy("SP1") === "YES", say: "The key lit my lamp. The spoon didn't." }],
      success: "Filed.",
    },
    {
      id: "sort-the-drawer",
      prompt: "Test the rest across the gap, then drop each in its tray.",
      goal: (lab) => {
        const t = tested(lab);
        for (const id of ALL) if (bridged(lab, id)) t[id] = true;
        return sorted(lab) && ALL.every((id) => t[id]);
      },
      hints: ["Not sure? Test first, then sort.", "Clip it across the gap. Lit? Conductors. Dark? Insulators."],
      nudges: [
        { when: wrongTray, say: "One's in the wrong tray. Test it across the gap." },
        { when: (lab) => sorted(lab) && !ALL.every((id) => tested(lab)[id]), say: "All sorted! Now test each one across the gap." },
      ],
      success: "Drawer sorted.",
    },
    {
      id: "fix-it",
      prompt: "The paper clip is coated. Make it work.",
      setup: COATED_CLIP,
      goal: relit,
      hints: ["Find the shiny end.", "Move the clip off the coating onto a bare end."],
      highlight: ["PC1"],
      success: "Bare metal conducts. Fixed.",
    },
    {
      id: "pencil-lead",
      prompt: "Clip the pencil lead across the gap.",
      goal: (lab) => lab.isLit("D1") && lab.amps("P1") > 0.001,
      hints: ["One jaw on each end of the pencil lead."],
      success: "It glows!",
      bonus: true,
    },
  ],
  solution: [
    ...across("K1"),
    { do: "check", task: "try-the-key" },
    ...across("SP1"),
    { do: "wait", seconds: 0.6 },
    { do: "check", task: "try-the-spoon" },
    ...NAME_THE_TRAYS,
    { do: "clip", lead: "TL2", end: "a", to: null },
    { do: "clip", lead: "TL3", end: "b", to: null },
    { do: "move", part: "K1", at: "in:YES" },
    { do: "move", part: "SP1", at: "in:NO" },
    { do: "check", task: "name-the-trays" },
    ...across("CN1"),
    { do: "move", part: "CN1", at: "in:YES" },
    ...across("F1"),
    { do: "move", part: "F1", at: "in:YES" },
    ...across("E1"),
    { do: "move", part: "E1", at: "in:NO" },
    ...across("MB1"),
    { do: "move", part: "MB1", at: "in:NO" },
    ...across("WS1"),
    { do: "move", part: "WS1", at: "in:NO" },
    { do: "check", task: "sort-the-drawer" },
    ...COATED_CLIP,
    { do: "clip", lead: "TL2", end: "a", to: "PC1.a" },
    { do: "check", task: "fix-it" },
    // The secret last, so the fix-it bench starts from the sorted drawer.
    ...across("P1"),
    { do: "check", task: "pencil-lead" },
  ],
});
