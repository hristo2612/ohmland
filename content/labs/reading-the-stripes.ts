// Blueprint: docs/curriculum/unit-1.md, L6, split for a bench lesson (docs/curriculum/conversion-guide.md, B3): this is
// the kept half (the code), content/units/basics/resistance/reading-the-stripes/lesson.yaml; measuring and the
// tolerance moved to the-liar. One idea: two digit stripes, then the number of zeros.
//
// One resistor at a time, big enough to read on a phone, and the colour code is a slip in the tool dock (a lab panel
// of real text), never a desk card that shrinks. The resistors wait at stations along the desk, 100 mm apart, and each
// beat frames one: the first to decode (and to tap its stripes), then two that each have three labels to choose from,
// the right one dropped just under it, and at the end a pair whose labels are swapped (the fix-it). The camera glides
// from station to station. 1 W resistors: the same colour code on a bigger body.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

/** A station at x: the resistor, the spot just under it where its label goes, and three places for labels to choose from. */
const station = (x: number) => ({
  resistor: `desk:${x},-12`,
  under: `desk:${x},2`,
  choice: [`desk:${x - 14},24`, `desk:${x + 14},24`, `desk:${x},40`],
});
const DECODE = station(0);
const ONE = station(100);
const TWO = station(200);
/** The fix-it pair, one above the other, each label under the other one's resistor. */
const PAIR = { top: "desk:300,-30", topLabel: "desk:300,-16", bottom: "desk:300,14", bottomLabel: "desk:300,28" };

/** Every value label on the bench. */
const TAGS = ["L1", "L2", "L4", "L5", "L6", "L7", "L8", "L9"];
/** A label sits just under a resistor: within 22 mm of it, and nearer to it than any other label. */
const labelled = (lab: LabView, label: string, resistor: string): boolean => {
  const d = lab.distance(label, resistor);
  return d < 22 && TAGS.every((t) => t === label || lab.distance(t, resistor) > d);
};
/** Some label other than the right one sits under the resistor. */
const wrongLabel = (lab: LabView, right: string, resistor: string): boolean => TAGS.some((t) => t !== right && labelled(lab, t, resistor));

const W = { watts: 1 };

/** The fix-it bench: the pair's labels swapped (as they lie from the start; put back if the learner moved them). */
const SWAPPED: SolutionStep[] = [
  { do: "move", part: "L9", at: PAIR.topLabel },
  { do: "move", part: "L8", at: PAIR.bottomLabel },
];
/** The secret: one more resistor out of the bag, at a station of its own, with gold in third place (4.7 Ω). */
const TINY: SolutionStep[] = [{ do: "place", part: "R6", kind: "resistor", at: "desk:-100,-12", params: { ohms: 4.7, ...W } }];

export default defineLab({
  id: "reading-the-stripes",
  title: "Reading the stripes",
  bench: {
    board: "none",
    // The first station: the whole bench a moment without a spot shows.
    frame: ["desk:-30,-28", "desk:30,48"],
    parts: [
      { id: "R3", kind: "resistor", at: DECODE.resistor, params: { ohms: 470, ...W }, label: "Resistor" },
      // The second station: 150 Ω and three labels that differ only in their zeros.
      { id: "R2", kind: "resistor", at: ONE.resistor, params: { ohms: 150, ...W }, label: "Resistor" },
      { id: "L4", kind: "tag", at: ONE.choice[0]!, params: { text: "1.5 kΩ" } },
      { id: "L2", kind: "tag", at: ONE.choice[1]!, params: { text: "150 Ω" } },
      { id: "L1", kind: "tag", at: ONE.choice[2]!, params: { text: "15 Ω" } },
      // The third: 2.2 kΩ.
      { id: "R5", kind: "resistor", at: TWO.resistor, params: { ohms: 2200, ...W }, label: "Resistor" },
      { id: "L6", kind: "tag", at: TWO.choice[0]!, params: { text: "220 Ω" } },
      { id: "L7", kind: "tag", at: TWO.choice[1]!, params: { text: "22 kΩ" } },
      { id: "L5", kind: "tag", at: TWO.choice[2]!, params: { text: "2.2 kΩ" } },
      // The fix-it pair: 15 Ω over 1.5 kΩ, their labels swapped.
      { id: "R1", kind: "resistor", at: PAIR.top, params: { ohms: 15, ...W }, label: "Resistor" },
      { id: "L9", kind: "tag", at: PAIR.topLabel, params: { text: "1.5 kΩ" } },
      { id: "R4", kind: "resistor", at: PAIR.bottom, params: { ohms: 1500, ...W }, label: "Resistor" },
      { id: "L8", kind: "tag", at: PAIR.bottomLabel, params: { text: "15 Ω" } },
    ],
    tray: [],
    instruments: [],
  },
  panels: [{ kind: "chart", id: "chart" }],
  mascot: {
    hint: "Gold stripe on the right. Then read from the left.",
  },
  tasks: [
    {
      id: "decode-yellow",
      prompt: "Read this resistor's stripes with the chart. Type the ohms.",
      goal: (lab) => {
        const v = lab.note("value");
        return v !== null && Math.abs(v - 470) < 0.5;
      },
      note: { id: "value", label: "This one", unit: "Ω" },
      hints: ["Start at the end away from gold. Two digits first.", "The third stripe counts zeros. Brown is 1."],
      highlight: ["R3"],
      success: "470 Ω.",
    },
    {
      id: "label-one",
      prompt: "Read the next one. Drop its label just under it.",
      goal: (lab) => labelled(lab, "L2", "R2"),
      hints: ["Brown, green: 1 and 5. Then count the zeros.", "Brown in third place: one zero."],
      highlight: ["R2"],
      nudges: [{ when: (lab) => wrongLabel(lab, "L2", "R2"), say: "Count the zeros on the third stripe again." }],
      success: "150 Ω.",
    },
    {
      id: "label-two",
      prompt: "And this one: drop its label just under it.",
      goal: (lab) => labelled(lab, "L5", "R5"),
      hints: ["Red, red: 2 and 2. Then count the zeros.", "Red in third place: two zeros. 2,200 Ω."],
      highlight: ["R5"],
      nudges: [{ when: (lab) => wrongLabel(lab, "L5", "R5"), say: "How many zeros does the third stripe give?" }],
      success: "2.2 kΩ.",
    },
    {
      id: "fix-labels",
      prompt: "Two labels disagree with their stripes. Fix them.",
      setup: SWAPPED,
      // Wrong first (the setup), then right again: a bench that was never wrong does not count.
      goal: (lab) => {
        const right = labelled(lab, "L8", "R1") && labelled(lab, "L9", "R4");
        if (!right) lab.memory["wrong"] = true;
        return lab.memory["wrong"] === true && right;
      },
      hints: ["Same first two stripes. Read the third.", "Black adds no zeros: 15 Ω. Red adds two: 1,500 Ω."],
      highlight: ["L8", "L9"],
      success: "Fixed.",
    },
    {
      id: "tiny-gold",
      prompt: "Yellow, violet, gold: gold in third place. How many ohms?",
      setup: TINY,
      goal: (lab) => {
        const v = lab.note("gold");
        return v !== null && Math.abs(v - 4.7) < 0.05;
      },
      note: { id: "gold", label: "This one", unit: "Ω" },
      hints: ["Gold in third place means divide by ten.", "47 divided by 10."],
      highlight: ["R6"],
      success: "4.7 Ω.",
      bonus: true,
    },
  ],
  solution: [
    { do: "note", id: "value", value: "470" },
    { do: "check", task: "decode-yellow" },
    { do: "move", part: "L2", at: ONE.under },
    { do: "check", task: "label-one" },
    { do: "move", part: "L5", at: TWO.under },
    { do: "check", task: "label-two" },
    // The secret, offered before the fix-it: the tiny one comes out of the bag.
    ...TINY,
    { do: "note", id: "gold", value: "4.7" },
    { do: "check", task: "tiny-gold" },
    ...SWAPPED,
    { do: "move", part: "L8", at: "desk:330,-8" },
    { do: "move", part: "L9", at: PAIR.bottomLabel },
    { do: "move", part: "L8", at: PAIR.topLabel },
    { do: "check", task: "fix-labels" },
  ],
});
