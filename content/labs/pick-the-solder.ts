// Blueprint: docs/curriculum/unit-3.md, MP2. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/soldering/pick-the-solder. One idea: each solder melts at its own temperature, so the tip
// is set well above it.
// The station on at 150 °C with two spools: tin-lead 63/37 (SD1, melts at 183 °C) and lead-free SAC305 (SD2, 217 to
// 220 °C). The spool in use is the station's `spool`; tapping the lead-free spool in the lesson makes it the one in
// use. Solder touched to the tip melts once the tip is past its melting point (the station notes the tip's
// temperature when each spool first melts).
// Headless replays have no station engine, so nothing melts on the tip there: the solution melts each solder into a
// joint on a pair of scrap wires instead, which the melt goals also accept (a joint of that alloy has set).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { joint, spliceStep, type Alloy } from "./lib/solder";

const iron = (lab: LabView) => lab.solder.iron;
const ALLOY: Record<string, Alloy> = { SD1: "leaded", SD2: "lead-free" };

/** The spool's solder has melted: on the tip, or into a joint somewhere on the bench. */
const melted = (lab: LabView, spool: string): boolean => {
  if (lab.solder.spool(spool)?.melted) return true;
  return lab.bench.parts.some((p) => p.kind === "hookup-wire" && Object.values(p.params.joints ?? {}).some((j) => j?.alloy === ALLOY[spool] && j.verdict !== null));
};
const inUse = (lab: LabView) => (lab.prop("ST1") as { spool?: string } | null)?.spool ?? "SD1";
const workingHeat = (lab: LabView) => {
  const i = iron(lab);
  return !!i && i.on && i.setC >= 350 && i.setC <= 380;
};

/** Scrap wires for the replay's melts: two stripped ends crossed on the desk, off to one side. */
const SCRAP: SolutionStep[] = [
  { do: "place", part: "HW8", kind: "hookup-wire", at: "desk:60,70", params: { color: "red", awg: 22, len: 60, ends: { b: { mm: 10, notch: 22, scale: "solid", clean: true, nicked: false, slipped: false, cutStrands: 0, twisted: false } } } as never },
  { do: "place", part: "HW9", kind: "hookup-wire", at: "desk:90,100", rot: 90, params: { color: "black", awg: 22, len: 60, ends: { b: { mm: 10, notch: 22, scale: "solid", clean: true, nicked: false, slipped: false, cutStrands: 0, twisted: false } } } as never },
];

/** The fix-it bench: lead-free in use, the dial left at 200 °C. */
const TOO_COOL: SolutionStep[] = [{ do: "param", part: "ST1", params: { setC: 200, spool: "SD2" } }];

export default defineLab({
  id: "pick-the-solder",
  title: "Two spools",
  bench: {
    board: "none",
    frame: ["desk:-95,-50", "desk:105,75"],
    parts: [
      { id: "ST1", kind: "solder-station", at: "desk:-10,-10", params: { on: true, setC: 150, iron: "stand", spool: "SD1" }, locked: true, label: "Soldering iron" },
      { id: "SD1", kind: "solder-spool", at: "desk:-40,55", params: { alloy: "leaded" }, locked: true, label: "Tin-lead solder" },
      { id: "SD2", kind: "solder-spool", at: "desk:40,55", params: { alloy: "lead-free" }, locked: true, label: "Lead-free solder" },
    ],
    tray: [],
    instruments: [],
  },
  mascot: {
    hint: "Hold the solder on the tip, and turn up the heat.",
    fried: "Nothing to fry. Solder just melts.",
  },
  tasks: [
    {
      id: "dial-200",
      prompt: "Turn the dial up to 200 °C.",
      goal: (lab) => {
        const i = iron(lab);
        return !!i && i.setC >= 190 && i.setC <= 210;
      },
      hints: ["Tap the right side of the dial: 10 °C a tap.", "Watch the number on the display."],
      highlight: ["spot:ST1.dial"],
      success: "200 °C.",
    },
    {
      id: "melt-leaded",
      prompt: "Touch the solder's end to the tip.",
      goal: (lab) => melted(lab, "SD1"),
      hints: ["Drag the loose end of the solder onto the iron's tip, and hold.", "Give it a second once it touches."],
      highlight: ["spot:SD1.end", "spot:ST1.tip"],
      success: "It melts.",
    },
    {
      id: "melt-lead-free",
      prompt: "Touch lead-free to the tip. Turn up the heat until it melts.",
      goal: (lab) => inUse(lab) === "SD2" && melted(lab, "SD2"),
      hints: ["Still solid? Turn the dial up 10 °C at a time.", "Touch the tip again after each turn."],
      highlight: ["spot:SD2.end", "spot:ST1.dial"],
      nudges: [{ when: (lab) => inUse(lab) === "SD2" && (iron(lab)?.setC ?? 0) < 220, say: "Still solid? Turn the dial up a little." }],
      success: "Lead-free melts, but later.",
    },
    {
      id: "set-working",
      prompt: "Set the dial to lead-free's working heat, 370 °C.",
      goal: (lab) => inUse(lab) === "SD2" && workingHeat(lab),
      hints: ["Tap the dial's right side until it reads 370.", "Lead-free works at 350 to 380 °C."],
      highlight: ["spot:ST1.dial"],
      success: "Working heat.",
    },
    {
      id: "full-heat",
      prompt: "Turn the dial all the way up.",
      goal: (lab) => (iron(lab)?.setC ?? 0) >= 450,
      hints: ["Keep tapping the dial's right side."],
      success: "450 °C. The top of the dial.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "Lead-free won't melt at this setting. Fix it.",
      setup: TOO_COOL,
      goal: (lab) => {
        if ((iron(lab)?.setC ?? 0) < 220) lab.memory["cool"] = true;
        return lab.memory["cool"] === true && inUse(lab) === "SD2" && workingHeat(lab);
      },
      hints: ["Read the dial. Where does lead-free melt?", "Set it to 370 °C, well above the melt."],
      highlight: ["spot:ST1.dial"],
      success: "Hot enough to work.",
    },
  ],
  solution: [
    { do: "param", part: "ST1", params: { setC: 200 } },
    { do: "check", task: "dial-200" },
    ...SCRAP,
    spliceStep("HW8", "b", "HW9.b", joint("good", { alloy: "leaded", kind: "crossed" })),
    { do: "check", task: "melt-leaded" },
    // The lesson's tap on the lead-free spool makes it the one in use.
    { do: "param", part: "ST1", params: { spool: "SD2" } },
    { do: "param", part: "ST1", params: { setC: 230 } },
    spliceStep("HW8", "b", "HW9.b", joint("good", { alloy: "lead-free", kind: "crossed" })),
    { do: "check", task: "melt-lead-free" },
    { do: "param", part: "ST1", params: { setC: 370 } },
    { do: "check", task: "set-working" },
    { do: "param", part: "ST1", params: { setC: 450 } },
    { do: "check", task: "full-heat" },
    ...TOO_COOL,
    { do: "param", part: "ST1", params: { setC: 370 } },
    { do: "check", task: "fix-it" },
  ],
});
