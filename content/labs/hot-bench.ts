// Blueprint: docs/curriculum/unit-3.md, MP1. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/soldering/hot-bench. One idea: the tip burns at once and stays hot for minutes after
// switch-off, so the iron lives in its stand.
// The solder station alone (off, dial at 330 °C, the iron in its stand), a desk clock and a time-lapse slider. From
// the station engine (packages/bench src/solder/iron.ts): about 20 s from cold to 330 °C; switched off it is still
// above 200 °C a minute later and under 50 °C after about 7 minutes; a tip left on the desk scorches the paper after
// 2 s, then the iron slides home. Headless replays have no station engine, so the tip reads its set point while on
// and room temperature while off; every goal below holds either way.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const iron = (lab: LabView) => lab.solder.iron;

/** The fix-it bench: the station left on, the iron lying out on the stand's sponge instead of in its holder. */
const LEFT_OUT: SolutionStep[] = [{ do: "param", part: "ST1", params: { on: true, iron: "ST1.sponge" } }];

export default defineLab({
  id: "hot-bench",
  title: "The hot end",
  bench: {
    board: "none",
    frame: ["desk:-90,-50", "desk:120,45"],
    parts: [
      { id: "ST1", kind: "solder-station", at: "desk:-10,0", params: { on: false, setC: 330, iron: "stand" }, locked: true, label: "Soldering iron" },
      { id: "CK1", kind: "clock", at: "desk:95,-10", locked: true, label: "Clock" },
    ],
    tray: [],
    instruments: [],
    controls: [{ id: "lapse", label: "Time-lapse speed", key: "speed", min: 1, max: 120, value: 1, scale: "log", unit: "×" }],
  },
  mascot: {
    hint: "Hot end: the shiny tip. Cool end: the grip.",
    fried: "Nothing fried. Only the desk got toasted.",
  },
  tasks: [
    {
      id: "switch-on",
      prompt: "Switch the station on and let the tip heat up.",
      goal: (lab) => {
        const i = iron(lab);
        return !!i && i.on && i.tipC >= i.setC - 10;
      },
      hints: ["The power switch is on the station's front.", "Then wait: the tip takes about 20 seconds."],
      highlight: ["spot:ST1.power"],
      success: "Up to heat.",
    },
    {
      id: "park-it",
      prompt: "Lift the iron by its grip, then put it down.",
      // Out of the stand at least once (in the hand, on the desk, on a spot), then home again.
      goal: (lab) => {
        const i = iron(lab);
        if (!i) return false;
        if (!i.inStand) lab.memory["out"] = true;
        return lab.memory["out"] === true && i.inStand;
      },
      hints: ["Drag the iron by its green grip.", "Drop it back into the coil of its stand."],
      highlight: ["spot:ST1.grip"],
      nudges: [{ when: (lab) => !!iron(lab)?.at, say: "Not there. Back in the stand, please." }],
      success: "Home again.",
    },
    {
      id: "cool-down",
      prompt: "Switch off, then speed up time until the tip is cool.",
      goal: (lab) => {
        const i = iron(lab);
        return !!i && !i.on && i.tipC < 50;
      },
      hints: ["The same switch turns it off.", "Slide the time-lapse up and watch the tip's number."],
      highlight: ["spot:ST1.power"],
      nudges: [{ when: (lab) => !!iron(lab) && !iron(lab)!.on && lab.control("lapse") <= 1.5, say: "Still hot. Speed up time." }],
      success: "Cool at last. That took minutes.",
    },
    {
      id: "wipe-tip",
      prompt: "Clean the tip in the brass wool.",
      goal: (lab) => iron(lab)?.at === "ST1.wool",
      hints: ["Drop the tip into the gold cup on the stand."],
      success: "Shiny again.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "The iron is lying out, still on. Make it safe.",
      setup: LEFT_OUT,
      goal: (lab) => {
        const i = iron(lab);
        if (!i) return false;
        if (!i.inStand) lab.memory["out"] = true;
        return lab.memory["out"] === true && i.inStand && !i.on;
      },
      hints: ["Lift it into its stand.", "Then switch the station off."],
      highlight: ["spot:ST1.grip", "spot:ST1.power"],
      success: "Safe.",
    },
  ],
  solution: [
    { do: "param", part: "ST1", params: { on: true } },
    { do: "check", task: "switch-on" },
    { do: "param", part: "ST1", params: { iron: "desk" } },
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "check", task: "park-it" },
    { do: "param", part: "ST1", params: { on: false } },
    { do: "control", id: "lapse", value: 120 },
    { do: "wait", seconds: 1 },
    { do: "control", id: "lapse", value: 1 },
    { do: "check", task: "cool-down" },
    { do: "param", part: "ST1", params: { iron: "ST1.wool" } },
    { do: "check", task: "wipe-tip" },
    ...LEFT_OUT,
    { do: "param", part: "ST1", params: { iron: "stand" } },
    { do: "param", part: "ST1", params: { on: false } },
    { do: "check", task: "fix-it" },
  ],
});
