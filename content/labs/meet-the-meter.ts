// Start here, case 8: "The black box" (docs/curriculum/start-here.md, SH8). A bench lesson (docs/LESSONS.md): its
// tasks are the beats of content/units/start-here/tool-cases/meet-the-meter/lesson.yaml, in the same order.
// One idea: the meter turns push into a number, in volts, and its sign says which side is plus.
// A sealed box with two plain brass terminals hides a fresh 9 V battery, plus wired to the right terminal (t2).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { rangeIs, readsIn } from "./lib/meter";

/** Both probe tips on the box's two terminals (either way round). */
const onBox = (lab: LabView) => lab.probed("BX.t1", "BX.t2", "either");
/** A steady fresh-battery reading on the volts dial, of either sign. */
const fresh = (lab: LabView) => lab.meter?.mode === "dcv" && (readsIn(lab, 9.0, 9.6) || readsIn(lab, -9.6, -9.0));

/** The fix-it bench: the probes on the battery, but the dial left on the mA part (it counts flow, so it reads 0). */
const DIAL_ON_MA: SolutionStep[] = [
  { do: "probe", red: "BX.t2", black: "BX.t1" },
  { do: "dial", mode: "dca-ma", range: "200mA" },
];

export default defineLab({
  id: "meet-the-meter",
  title: "The black box",
  bench: {
    board: "none",
    frame: ["desk:-120,-62", "desk:110,84"],
    parts: [
      // The black box: two identical brass posts; inside, the battery's plus goes to the right one.
      { id: "BX", kind: "box", at: "desk:-58,10", params: { marks: "plain", wiring: { "s1.pos": "t2", "s1.neg": "t1" } }, locked: true, label: "Black box" },
      { id: "B1", kind: "battery", at: "in:BX.s1", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // A scuffed, used battery at the back, for the secret.
      { id: "B2", kind: "battery", at: "desk:-96,-50", params: { emf: 7.6, internalOhms: 6, mAh: 500, worn: true }, locked: true, label: "Tired 9 V battery" },
    ],
    tray: [],
    // Both leads lying unplugged next to the meter.
    instruments: [{ kind: "meter", at: "desk:62,10", mode: "off", red: null, black: null }],
  },
  mascot: {
    hint: "Black in COM. Red in VΩ. Then the dial.",
    fried: "Pop. The meter's fuse saved it. Fresh fuse in.",
  },
  tasks: [
    {
      id: "plug-in",
      prompt: "Black lead into COM, red lead into VΩ.",
      goal: (lab) => lab.meter?.black === "com" && lab.meter.red === "vohm",
      hints: ["Drag the black plug into the socket marked COM.", "The red plug goes in VΩ, the socket for volts."],
      highlight: ["socket:com", "socket:vohm"],
      nudges: [{ when: (lab) => lab.meter?.red === "com" || lab.meter?.black === "vohm", say: "Swap them. Black lives in COM." }],
      success: "Leads in.",
    },
    {
      id: "set-dial",
      prompt: "Turn the dial to 20 in the V part.",
      goal: (lab) => lab.meter?.mode === "dcv" && rangeIs(lab, "20V"),
      hints: ["The V part of the dial has 200m, 2, 20 and 200.", "Turn the dial to the 20 next to the V."],
      highlight: ["M1"],
      success: "Ready for up to 20 V.",
    },
    {
      id: "read-battery",
      prompt: "Touch one probe tip to each brass terminal.",
      goal: (lab) => onBox(lab) && fresh(lab),
      hints: ["Both probe tips on the brass, at once.", "One tip on each terminal of the box."],
      highlight: ["pin:BX.t1", "pin:BX.t2"],
      success: "About 9.4 V.",
    },
    {
      id: "swap-probes",
      prompt: "Swap the red and black probes.",
      // The sign flips: the other sign from the first reading (on a resumed visit, a minus).
      goal: (lab) => {
        if (!onBox(lab) || !fresh(lab)) return false;
        const first = lab.doneAt("read-battery")?.meter?.si;
        const v = lab.meter?.value ?? 0;
        return typeof first === "number" && first !== 0 ? Math.sign(v) === -Math.sign(first) : v < 0;
      },
      hints: ["Move the red tip to the other terminal, and the black tip too."],
      highlight: ["pin:BX.t1", "pin:BX.t2"],
      success: "The sign flipped.",
    },
    {
      id: "open-the-box",
      prompt: "Lift the box's lid.",
      goal: (lab) => lab.lidOpen("BX"),
      hints: ["Tap the box's lid."],
      highlight: ["BX"],
      success: "A 9 V battery.",
    },
    {
      id: "fix-it",
      prompt: "The meter reads zero on a fresh battery. Fix it.",
      setup: DIAL_ON_MA,
      // Broken first (the setup), then a fresh reading in volts across the battery.
      goal: (lab) => {
        if (lab.meter?.mode !== "dcv") lab.memory["broken"] = true;
        return lab.memory["broken"] === true && onBox(lab) && fresh(lab);
      },
      hints: ["Which letter on the dial means push?", "Turn the dial back to 20 in the V part."],
      highlight: ["M1"],
      success: "9.4 V again.",
    },
    {
      id: "tired-battery",
      prompt: "Measure the tired battery at the back.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.probed("B2.pos", "B2.neg", "either") && (readsIn(lab, 7.2, 8.0) || readsIn(lab, -8.0, -7.2)),
      hints: ["Same as the box: a tip on each snap."],
      highlight: ["B2"],
      success: "About 7.6 V.",
      bonus: true,
    },
  ],
  solution: [
    { do: "plug", probe: "black", socket: "com" },
    { do: "plug", probe: "red", socket: "vohm" },
    { do: "check", task: "plug-in" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "check", task: "set-dial" },
    { do: "probe", red: "BX.t2", black: "BX.t1" },
    { do: "check", task: "read-battery" },
    { do: "probe", red: "BX.t1", black: "BX.t2" },
    { do: "check", task: "swap-probes" },
    { do: "param", part: "BX", params: { lid: true } },
    { do: "check", task: "open-the-box" },
    // The secret: the tired battery at the back.
    { do: "probe", red: "B2.pos", black: "B2.neg" },
    { do: "check", task: "tired-battery" },
    ...DIAL_ON_MA,
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "check", task: "fix-it" },
  ],
});
