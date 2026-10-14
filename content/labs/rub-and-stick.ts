// Blueprint: docs/curriculum/start-here.md, SH3 "The clingy balloon" (wave 2). A bench lesson (docs/LESSONS.md): its
// tasks are the beats of content/units/start-here/first-cases/rub-and-stick/lesson.yaml, in the same order.
// One idea: rubbing moves charge; on an insulator it sits still. That is static.
// The static toy is its own small model (packages/bench/src/static.ts), not the circuit simulator: charge is counted
// in marks drawn on things (minus on the balloon, plus on the wool scarf).
import { defineLab, type SolutionStep } from "@ohmland/lab";

/** The fix-it: the robot rubbed the metal spoon on the scarf and holds it over the paper bits. Nothing hops. */
const METAL_SPOON: SolutionStep[] = [
  { do: "rub", part: "MS1", on: "SF1" },
  { do: "move", part: "MS1", at: "desk:75,5" },
];

export default defineLab({
  id: "rub-and-stick",
  title: "Rub and stick",
  bench: {
    board: "none",
    frame: ["desk:-150,-150", "desk:200,140"],
    parts: [
      { id: "WL1", kind: "wall", at: "desk:0,-100", locked: true, label: "Wall" },
      // The mystery: a balloon someone rubbed earlier, stuck to the wall's face.
      { id: "BL0", kind: "balloon", at: "desk:-45,-78", params: { color: "yellow", charge: -6 }, label: "Yellow balloon" },
      { id: "BL1", kind: "balloon", at: "desk:-95,15", params: { color: "red" }, label: "Red balloon" },
      { id: "SF1", kind: "scarf", at: "desk:-80,90", locked: true, label: "Wool scarf" },
      { id: "PB1", kind: "paper", at: "desk:75,40", locked: true, label: "Paper bits" },
      { id: "CB1", kind: "comb", at: "desk:95,115", label: "Plastic comb" },
      { id: "MS1", kind: "sample", at: "desk:160,60", params: { material: "metal-spoon" }, label: "Metal spoon" },
      // For the secret: a second balloon.
      { id: "BL2", kind: "balloon", at: "desk:140,-45", params: { color: "blue" }, label: "Blue balloon" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "More rubs, more charge.",
    fried: "Nothing can break here.",
  },
  tasks: [
    {
      id: "rub-it",
      prompt: "Rub the red balloon on the scarf.",
      goal: (lab) => lab.static("BL1") <= -3,
      hints: ["Drag it back and forth across the wool."],
      highlight: ["BL1", "SF1"],
      success: "Minus marks!",
    },
    {
      id: "paper-hop",
      prompt: "Hold the balloon over the paper bits.",
      goal: (lab) => lab.lifted("PB1") === "BL1",
      hints: ["Drag the balloon right next to the paper bits."],
      highlight: ["PB1"],
      nudges: [{ when: (lab) => lab.static("BL1") > -2, say: "It lost its charge. Rub it again." }],
      success: "They hop!",
    },
    {
      id: "stick-it",
      prompt: "Put the balloon against the wall.",
      goal: (lab) => lab.heldFor(1, lab.stuck("BL1")),
      hints: ["Drop it right against the wall, beside the yellow one."],
      highlight: ["WL1"],
      nudges: [{ when: (lab) => lab.static("BL1") > -2, say: "Rub it on the scarf first." }],
      success: "It sticks.",
    },
    {
      id: "fix-it",
      prompt: "The metal spoon kept no charge. Make the paper bits hop.",
      setup: METAL_SPOON,
      goal: (lab) => {
        const by = lab.lifted("PB1");
        return by !== null && by !== "MS1";
      },
      hints: ["Plastic holds charge. Metal lets it go.", "Rub the plastic comb on the scarf, then hold it by the paper."],
      highlight: ["CB1", "SF1"],
      success: "Hop! Plastic keeps its charge.",
    },
    {
      id: "two-balloons",
      prompt: "Rub both balloons and hang them side by side.",
      goal: (lab) => lab.static("BL1") <= -2 && lab.static("BL2") <= -2 && lab.apart("BL1", "BL2") < 90,
      hints: ["Rub the blue one too, then drop it right beside the red one."],
      highlight: ["BL2"],
      success: "They push apart!",
      bonus: true,
    },
  ],
  solution: [
    { do: "rub", part: "BL1", on: "SF1" },
    { do: "check", task: "rub-it" },
    { do: "move", part: "BL1", at: "desk:75,20" },
    { do: "check", task: "paper-hop" },
    { do: "move", part: "BL1", at: "desk:20,-78" },
    { do: "wait", seconds: 1.2 },
    { do: "check", task: "stick-it" },
    ...METAL_SPOON,
    { do: "rub", part: "CB1", on: "SF1" },
    { do: "move", part: "CB1", at: "desk:75,70" },
    { do: "check", task: "fix-it" },
    // The secret last, so the fix-it bench starts from the balloon on the wall.
    { do: "rub", part: "BL2", on: "SF1" },
    { do: "move", part: "BL2", at: "desk:40,-78" },
    { do: "check", task: "two-balloons" },
  ],
});
