// Blueprint: docs/curriculum/unit-3.md, MP3. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/soldering/first-joint. One idea: heat the work, and let the hot work melt the solder.
// The station at lead-free's working heat (370 °C) and two bare 22 AWG wires whose stripped ends cross: the crossing
// is the splice spot HW1.b (with HW2.b). A scrap pair crosses at HW3.b for the secret. From the joint model
// (packages/bench src/solder/joint.ts): the crossed pair passes the melt 2 to 3 s after the tip lands; solder fed at
// the hot work wets both wires in a second or two; a bead carried on the tip loses its flux and balls up cold.
// Headless replays have no station engine: the solution writes the joints a learner would make (lib/solder.ts).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { joint, setAs, sound, spliceStep } from "./lib/solder";

const JOINT = "HW1.b";
const iron = (lab: LabView) => lab.solder.iron;
const stripped = { mm: 10, notch: 22, scale: "solid", clean: true, nicked: false, slipped: false, cutStrands: 0, twisted: false };

/** The fix-it bench: the joint made with the tip on one wire only, so the solder never wetted the other: cold. */
const LET_GO: SolutionStep[] = [spliceStep("HW1", "b", "HW2.b", joint("cold", { kind: "crossed" })), { do: "param", part: "ST1", params: { iron: "stand" } }];

export default defineLab({
  id: "first-joint",
  title: "The loose ends",
  bench: {
    board: "none",
    frame: ["desk:-135,-60", "desk:100,70"],
    parts: [
      { id: "ST1", kind: "solder-station", at: "desk:-60,-25", params: { on: true, setC: 370, iron: "stand", spool: "SD1" }, locked: true, label: "Soldering iron" },
      { id: "SD1", kind: "solder-spool", at: "desk:-95,45", params: { alloy: "lead-free" }, locked: true, label: "Lead-free solder" },
      // The two wires: HW1 lies left to right, HW2 front to back; their stripped ends cross at (40, 10).
      { id: "HW1", kind: "hookup-wire", at: "desk:15,10", params: { color: "red", awg: 22, len: 50, ends: { b: stripped } } as never, locked: true, label: "Red wire" },
      { id: "HW2", kind: "hookup-wire", at: "desk:40,35", rot: 90, params: { color: "black", awg: 22, len: 50, ends: { b: stripped } } as never, locked: true, label: "Black wire" },
      // Scrap wires for the secret, crossing at (85, -30).
      { id: "HW3", kind: "hookup-wire", at: "desk:65,-30", params: { color: "white", awg: 22, len: 40, ends: { b: stripped } } as never, locked: true, label: "Scrap wire" },
      { id: "HW4", kind: "hookup-wire", at: "desk:85,-10", rot: 90, params: { color: "white", awg: 22, len: 40, ends: { b: stripped } } as never, locked: true, label: "Scrap wire" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Iron on both wires. Solder on the hot wires.",
    fried: "Nothing fried. Practice is free here.",
  },
  tasks: [
    {
      id: "heat-the-work",
      prompt: "Rest the iron's tip on the crossing.",
      goal: (lab) => iron(lab)?.at === JOINT,
      hints: ["Drag the iron by its grip and drop the tip where the wires cross.", "It rests there by itself."],
      highlight: ["spot:ST1.grip", `spot:${JOINT}`],
      success: "Resting on the work.",
    },
    {
      id: "feed-the-joint",
      prompt: "Touch the solder to the hot wires, beside the tip.",
      goal: (lab) => {
        const j = lab.solder.joint(JOINT);
        return !!j && j.fedAt === "work" && j.wetted >= 0.8;
      },
      hints: ["Drag the solder's end onto the crossing and hold.", "Touch the wires, not the iron."],
      highlight: ["spot:SD1.end", `spot:${JOINT}`],
      nudges: [{ when: (lab) => iron(lab)?.at !== JOINT, say: "Iron first. Rest it on the crossing." }],
      success: "It flows round both wires.",
    },
    {
      id: "let-it-set",
      prompt: "Lift the solder, then the iron. Let it set.",
      goal: (lab) => iron(lab)?.at !== JOINT && setAs(lab, JOINT, "good", "too-much", "too-little", "burnt"),
      hints: ["Let go of the solder first.", "Then lift the iron back to its stand, and hold still."],
      highlight: [`spot:${JOINT}`],
      nudges: [{ when: (lab) => iron(lab)?.at !== JOINT && setAs(lab, JOINT, "cold", "disturbed"), say: "Dull and grainy. Heat it again, add a touch." }],
      success: "Set. One piece of metal now.",
    },
    {
      id: "carry-on-tip",
      prompt: "Melt solder on the tip, then dab it on the cold scrap wires.",
      goal: (lab) => {
        const j = lab.solder.joint("HW3.b");
        return !!j && j.fedAt === "tip" && j.state === "set" && j.verdict === "cold";
      },
      hints: ["Iron in the stand: touch solder to the tip.", "Then drop the tip on the scrap crossing."],
      success: "A dull ball. It won't hold.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "This joint let go of one wire. Fix it.",
      setup: LET_GO,
      goal: (lab) => {
        if (setAs(lab, JOINT, "cold")) lab.memory["cold"] = true;
        return lab.memory["cold"] === true && iron(lab)?.at !== JOINT && sound(lab, JOINT);
      },
      hints: ["Rest the iron on both wires.", "Add a touch of fresh solder, then lift and hold still."],
      highlight: [`spot:${JOINT}`],
      success: "Both wires bonded.",
    },
  ],
  solution: [
    { do: "param", part: "ST1", params: { iron: JOINT } },
    { do: "check", task: "heat-the-work" },
    spliceStep("HW1", "b", "HW2.b", joint("good", { kind: "crossed" })),
    { do: "check", task: "feed-the-joint" },
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "let-it-set" },
    spliceStep("HW3", "b", "HW4.b", joint("cold", { kind: "crossed", fedAt: "tip" })),
    { do: "check", task: "carry-on-tip" },
    ...LET_GO,
    { do: "param", part: "ST1", params: { iron: JOINT } },
    spliceStep("HW1", "b", "HW2.b", joint("good", { kind: "crossed" })),
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "fix-it" },
  ],
});
