// Blueprint: docs/curriculum/unit-3.md, MP11. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/perfboard/pocket-blinker. One idea: build in small batches and check each one before the
// next.
// The robot's antenna blinker (lib/blinker.ts): Unit 2's twin blinker on a 12 by 9 perfboard whose wire links are
// already underneath, its plan's ghosts drawn on the board. The parts lie in front of it in three batches:
// transistors and LEDs, the four resistors, the two capacitors; then the battery's snap leads. Each batch goes on its
// ghosts from the top, the board is flipped, and every leg is soldered (quick mode: press and hold a joint) and
// checked: a part joins its links only through a good joint. From the simulator: the finished board blinks about
// every 0.84 s, the LEDs taking turns, as the breadboard one did (1.4 x 68 kΩ x 10 µF is about 0.95 s nominal).
// Headless replays have no station engine: the solution writes the joints a learner would make (lib/solder.ts).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { BATCH_ONE, BATCH_THREE, BATCH_TWO, GHOSTS, LINKS, badJoints, goodAt, goodJoints, onGhosts, padsOf, takingTurns } from "./lib/blinker";
import { jointsStep } from "./lib/solder";

const board = (lab: LabView) => lab.solder.board("PB2");
const ALL = [...BATCH_ONE, ...BATCH_TWO, ...BATCH_THREE, "B1"];
const blinking = (lab: LabView) => takingTurns(lab, 0.6, 1.3);
const reheat = { when: (lab: LabView) => badJoints(lab, "PB2", ALL).length > 0, say: "Not a volcano? Reheat it now." };

/** Put a part's legs in its ghost's pads (solution steps; a learner drags it there). */
const onGhost = (id: string, at: string): SolutionStep => ({ do: "move", part: id, at, holes: Object.fromEntries(Object.entries(GHOSTS.find((g) => g.id === id)!.legs).map(([leg, pad]) => [leg, `PB2:${pad}`])) });
const flip = (flipped: boolean): SolutionStep => ({ do: "param", part: "PB2", params: { flipped } });

/** The fix-it bench: one leg never soldered, Q2's base. */
const MISSED: SolutionStep[] = [{ do: "param", part: "PB2", params: { flexed: false } }, jointsStep("PB2", goodAt(padsOf(...ALL).filter((p) => p !== "E9"))), flip(true)];

export default defineLab({
  id: "pocket-blinker",
  title: "The antenna blinker",
  bench: {
    board: "none",
    frame: ["desk:-55,-30", "desk:80,75"],
    parts: [
      { id: "PB2", kind: "perfboard", at: "desk:0,0", params: { cols: 12, rows: 9, plan: "PC2", links: LINKS } as never, locked: true, label: "Perfboard" },
      { id: "PC2", kind: "plan-card", at: "desk:-125,10", params: { title: "Blinker", cols: 12, rows: 9, ghosts: GHOSTS, lines: LINKS.map((l) => [l.a, l.b]) } as never, locked: true, label: "Plan" },
      { id: "ST1", kind: "solder-station", at: "desk:165,-30", params: { on: true, setC: 370, iron: "stand", spool: "SD1" }, locked: true, label: "Soldering iron" },
      { id: "SD1", kind: "solder-spool", at: "desk:120,45", params: { alloy: "lead-free" }, locked: true, label: "Lead-free solder" },
      // Batch one, front left: the transistors and the LEDs.
      { id: "Q1", kind: "npn", at: "desk:-40,38", label: "Q1 (2N3904)" },
      { id: "Q2", kind: "npn", at: "desk:-26,38", label: "Q2 (2N3904)" },
      { id: "D1", kind: "led", at: "desk:-10,38", params: { color: "red", size: 3 }, label: "Red LED D1" },
      { id: "D2", kind: "led", at: "desk:4,38", params: { color: "red", size: 3 }, label: "Red LED D2" },
      // Batch two, in front: the resistors.
      { id: "R1", kind: "resistor", at: "desk:-38,58", params: { ohms: 1000 }, label: "1 kΩ" },
      { id: "R2", kind: "resistor", at: "desk:-12,58", params: { ohms: 1000 }, label: "1 kΩ" },
      { id: "R3", kind: "resistor", at: "desk:14,58", params: { ohms: 68000 }, label: "68 kΩ" },
      { id: "R4", kind: "resistor", at: "desk:40,58", params: { ohms: 68000 }, label: "68 kΩ" },
      // Batch three, front right: the capacitors. Then the battery on its snap leads.
      { id: "C1", kind: "electrolytic-cap", at: "desk:26,36", params: { farads: 10e-6, volts: 16 }, label: "10 µF" },
      { id: "C2", kind: "electrolytic-cap", at: "desk:40,36", params: { farads: 10e-6, volts: 16 }, label: "10 µF" },
      { id: "B1", kind: "battery", at: "desk:62,8", params: { snap: true, emf: 9.4, internalOhms: 1.7 }, label: "9 V battery" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Follow the plan's ghosts, one batch at a time.",
    fried: "Ouch. Check its stripe against the plan.",
  },
  fried: { "electrolytic-cap": "10 µF capacitor, in backwards", led: "3 mm red LED in the blinker" },
  tasks: [
    {
      id: "place-one",
      prompt: "Put the two transistors and the two LEDs on their ghosts.",
      goal: (lab) => !board(lab)?.flipped && onGhosts(lab, "PB2", BATCH_ONE),
      hints: ["Flat faces toward you, as the ghosts show.", "The LEDs' long legs go on the left."],
      highlight: ["Q1", "Q2", "D1", "D2"],
      success: "Batch one in.",
    },
    {
      id: "solder-one",
      prompt: "Flip the board and solder those ten legs. Check each one.",
      goal: (lab) => goodJoints(lab, "PB2", BATCH_ONE),
      hints: ["Tap Quick, then press and hold a joint until its ring fills.", "Tap a joint to look at it. Only volcanoes pass."],
      highlight: ["PB2"],
      nudges: [reheat],
      success: "Ten good joints.",
    },
    {
      id: "batch-two",
      prompt: "Batch two: the four resistors. Place, flip, solder, check.",
      goal: (lab) => onGhosts(lab, "PB2", BATCH_TWO) && goodJoints(lab, "PB2", BATCH_TWO),
      hints: ["Flip the board back to place them.", "1 kΩ on the top row, 68 kΩ lower down."],
      highlight: ["R1", "R2", "R3", "R4"],
      nudges: [reheat],
      success: "Batch two done.",
    },
    {
      id: "batch-three",
      prompt: "Batch three: the capacitors, stripes as drawn.",
      goal: (lab) => onGhosts(lab, "PB2", BATCH_THREE) && goodJoints(lab, "PB2", BATCH_THREE),
      hints: ["Stripe on the right, as the ghosts show.", "Flip, solder, check."],
      highlight: ["C1", "C2"],
      nudges: [reheat],
      success: "Batch three done.",
    },
    {
      id: "it-blinks",
      prompt: "Battery leads in their pads and soldered. Then flip it back.",
      goal: (lab) => onGhosts(lab, "PB2", ["B1"]) && goodJoints(lab, "PB2", ["B1"]) && !board(lab)?.flipped && blinking(lab),
      hints: ["Red lead in the + pad, black in the − pad.", "Solder both, then flip the board back to watch."],
      highlight: ["B1"],
      nudges: [reheat],
      success: "It blinks!",
    },
    {
      id: "flex-test",
      prompt: "Press the board while it blinks.",
      goal: (lab) => lab.heldFor(2, !!board(lab)?.flexed && blinking(lab)),
      hints: ["Tap the board and turn on its flex setting."],
      success: "Still blinking.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "My spare blinker won't start. Fix it.",
      setup: MISSED,
      goal: (lab) => {
        if (!board(lab)?.joints["E9"]) lab.memory["missed"] = true;
        return lab.memory["missed"] === true && goodJoints(lab, "PB2", ALL) && blinking(lab);
      },
      hints: ["Look at every joint. Is one leg bare?", "Solder it, then flip the board back."],
      highlight: ["PB2"],
      success: "It blinks.",
    },
  ],
  solution: [
    ...BATCH_ONE.map((id) => onGhost(id, "desk:0,0")),
    { do: "check", task: "place-one" },
    flip(true),
    jointsStep("PB2", goodAt(padsOf(...BATCH_ONE))),
    { do: "check", task: "solder-one" },
    flip(false),
    ...BATCH_TWO.map((id) => onGhost(id, "desk:0,0")),
    flip(true),
    jointsStep("PB2", goodAt(padsOf(...BATCH_ONE, ...BATCH_TWO))),
    { do: "check", task: "batch-two" },
    flip(false),
    ...BATCH_THREE.map((id) => onGhost(id, "desk:0,0")),
    flip(true),
    jointsStep("PB2", goodAt(padsOf(...BATCH_ONE, ...BATCH_TWO, ...BATCH_THREE))),
    { do: "check", task: "batch-three" },
    flip(false),
    onGhost("B1", "desk:62,8"),
    flip(true),
    jointsStep("PB2", goodAt(padsOf(...ALL))),
    flip(false),
    { do: "wait", seconds: 5 },
    { do: "check", task: "it-blinks" },
    { do: "param", part: "PB2", params: { flexed: true } },
    { do: "wait", seconds: 3 },
    { do: "check", task: "flex-test" },
    ...MISSED,
    { do: "wait", seconds: 1 },
    jointsStep("PB2", goodAt(padsOf(...ALL))),
    flip(false),
    { do: "wait", seconds: 5 },
    { do: "check", task: "fix-it" },
  ],
});
