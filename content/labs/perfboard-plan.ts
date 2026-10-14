// Blueprint: docs/curriculum/unit-3.md, MP10. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/perfboard/perfboard-plan. One idea: flip the board over and left becomes right: the
// underside is a mirror of the plan.
// A 10 by 6 pad-per-hole perfboard, top side up, in tack mode (legs that meet at a pad conduct without solder; the
// robot solders them later). Its plan card: the lamp's parts as ghosts, seen from the top: R1 1 kΩ from A2 to A6, the
// red LED's long leg in C2 and short leg in C3 (on the left), the battery's snap leads in A7 (+) and F3 (−); and three
// lines underneath: A6 to A7, A2 to C2, C3 to F3. Flipped over, column c shows where column 11 - c was, so the LED's
// legs appear on the right. A bent leg joins its own pad to the pad it lies on. From the simulator: lit, the lamp
// draws about 7.5 mA ((9.4 V - 1.9 V) / 1 kΩ).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const board = (lab: LabView) => lab.solder.board("PB1");
const ON_PLAN = { "B1.pos": "A6", "R1.a": "C2", "D1.cathode": "F3" };

/** The fix-it bench: the robot read the plan from underneath and bent the resistor's leg to the mirrored pad. */
const MIRROR_SLIP: SolutionStep[] = [{ do: "param", part: "PB1", params: { flipped: true, bends: { ...ON_PLAN, "R1.a": "C9" } } as never }];

export default defineLab({
  id: "perfboard-plan",
  title: "The mirror board",
  bench: {
    board: "none",
    frame: ["desk:-140,-50", "desk:100,55"],
    parts: [
      { id: "PB1", kind: "perfboard", at: "desk:20,0", params: { cols: 10, rows: 6, tack: true, plan: "PC1" }, locked: true, label: "Perfboard" },
      {
        id: "PC1",
        kind: "plan-card",
        at: "desk:-72,0",
        params: {
          title: "Lamp",
          cols: 10,
          rows: 6,
          ghosts: [
            { id: "R1", kind: "resistor", legs: { a: "A2", b: "A6" } },
            { id: "D1", kind: "led", legs: { anode: "C2", cathode: "C3" } },
            { id: "B1", kind: "battery", legs: { pos: "A7", neg: "F3" } },
          ],
          lines: [
            ["A6", "A7"],
            ["A2", "C2"],
            ["C3", "F3"],
          ],
        } as never,
        locked: true,
        label: "Plan",
      },
      { id: "R1", kind: "resistor", at: "desk:15,32", params: { ohms: 1000 }, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "desk:45,28", params: { color: "red" }, label: "Red LED" },
      { id: "B1", kind: "battery", at: "desk:80,5", params: { snap: true, emf: 9.4, internalOhms: 1.7 }, label: "9 V battery" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Flipped over, left and right swap.",
    fried: "Whoa, a shortcut under the board. Uncross those.",
  },
  tasks: [
    {
      id: "place-parts",
      prompt: "Put the resistor, the LED and the battery's leads on their ghosts.",
      goal: (lab) => {
        const b = lab.solder.board("PB1");
        if (!b || b.flipped) return false;
        const at = (part: string, leg: string, pad: string) => b.legs.some((l) => l.part === part && l.leg === leg && l.pad === pad);
        return at("R1", "a", "A2") && at("R1", "b", "A6") && at("D1", "anode", "C2") && at("D1", "cathode", "C3") && at("B1", "pos", "A7") && at("B1", "neg", "F3");
      },
      hints: ["Drag each part onto its ghost. The LED's long leg goes where the plan marks +.", "Drag each battery lead's end into its pad."],
      highlight: ["PB1"],
      success: "All on their ghosts.",
    },
    {
      id: "flip-it",
      prompt: "Flip the board over.",
      goal: (lab) => !!board(lab)?.flipped,
      hints: ["Tap the board, then its flip setting."],
      highlight: ["PB1"],
      success: "Copper side up.",
    },
    {
      id: "route-it",
      prompt: "Bend the legs underneath so they meet, like the plan's lines.",
      goal: (lab) => !!board(lab)?.flipped && !!board(lab)?.matchesPlan("PC1") && lab.isLit("D1"),
      hints: ["Tap Bend, then drag from a leg's pad to the pad it should meet.", "The plan is drawn from the top. Underneath, left is right."],
      highlight: ["PB1", "PC1"],
      nudges: [{ when: (lab) => (board(lab)?.crossings ?? 0) > 0, say: "Two bare legs cross. Uncross them." }],
      success: "Joined.",
    },
    {
      id: "see-glow",
      prompt: "Flip the board back and look at the lamp.",
      goal: (lab) => !board(lab)?.flipped && lab.isLit("D1"),
      hints: ["Tap the board, then its flip setting."],
      highlight: ["PB1"],
      success: "Lit!",
    },
    {
      id: "cross-legs",
      prompt: "Bend one bare leg across another.",
      goal: (lab) => (board(lab)?.crossings ?? 0) > 0,
      hints: ["Copper side up, bend a leg so it lies over another leg."],
      success: "A short.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "My second lamp board is dark. Fix it.",
      setup: MIRROR_SLIP,
      goal: (lab) => {
        if (!lab.isLit("D1")) lab.memory["dark"] = true;
        return lab.memory["dark"] === true && !!board(lab)?.matchesPlan("PC1") && lab.isLit("D1");
      },
      hints: ["Which leg doesn't meet its line? Compare with the plan.", "Remember: underneath, left is right."],
      highlight: ["PB1", "PC1"],
      success: "Lit again.",
    },
  ],
  solution: [
    { do: "move", part: "R1", at: "desk:0,0", holes: { a: "PB1:A2", b: "PB1:A6" } },
    { do: "move", part: "D1", at: "desk:0,0", holes: { anode: "PB1:C2", cathode: "PB1:C3" } },
    { do: "move", part: "B1", at: "desk:80,5", holes: { pos: "PB1:A7", neg: "PB1:F3" } },
    { do: "check", task: "place-parts" },
    { do: "param", part: "PB1", params: { flipped: true } },
    { do: "check", task: "flip-it" },
    { do: "param", part: "PB1", params: { bends: ON_PLAN } as never },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "route-it" },
    { do: "param", part: "PB1", params: { flipped: false } },
    { do: "check", task: "see-glow" },
    { do: "param", part: "PB1", params: { flipped: true, bends: { ...ON_PLAN, "D1.cathode": "A1" } } as never },
    { do: "check", task: "cross-legs" },
    ...MIRROR_SLIP,
    { do: "wait", seconds: 0.3 },
    { do: "param", part: "PB1", params: { bends: ON_PLAN } as never },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "fix-it" },
  ],
});
