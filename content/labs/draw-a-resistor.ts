// Blueprint: docs/curriculum/unit-1.md, L5, trimmed for a bench lesson (docs/curriculum/conversion-guide.md, B3):
// content/units/basics/resistance/draw-a-resistor/lesson.yaml walks these tasks in order.
// One idea: a line's shape sets its squeeze (longer more, thicker or wider less). A white card with a soft pencil: drag
// along the card to draw a line from its 0 mark (again to shade it darker); the selection bar sets length, layers and
// width, and erases. Probe points sit every 0.5 cm along the line; the probe tips start on the desk below the card,
// out of the pencil's way.
// Resistance between two points: 2 kΩ of contacts plus 20 kΩ per cm, divided by the layers, halved again when wide
// (packages/bench, `card`). The blueprint's ±3% drift is left out.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { showsOL, siIn } from "./lib/meter";

type Card = { length: number; layers: number; wide?: boolean };
const card = (lab: LabView) => lab.prop("P1") as Card;

/** The probe point (0 to 20, every 0.5 cm) a probe touches on the card, or null. */
const point = (at: string | null | undefined): number | null => {
  const m = /^pin:P1\.p(\d+)$/.exec(at ?? "");
  return m ? Number(m[1]) : null;
};

/** Both probes on the drawn line, at two different points: [red, black] point indices. */
const onLine = (lab: LabView): [number, number] | null => {
  const a = point(lab.meter?.redAt);
  const b = point(lab.meter?.blackAt);
  const end = Math.round(card(lab).length * 2);
  if (a === null || b === null || a === b || card(lab).layers < 1 || a > end || b > end) return null;
  return [a, b];
};

/** One probe on each end of the line. */
const atEnds = (lab: LabView): boolean => {
  const p = onLine(lab);
  const end = Math.round(card(lab).length * 2);
  return !!p && Math.min(...p) === 0 && Math.max(...p) === end;
};

/** Centimetres between the probes on the line. */
const apart = (lab: LabView): number | null => {
  const p = onLine(lab);
  return p ? Math.abs(p[0] - p[1]) / 2 : null;
};

/** The first line's end-to-end reading in ohms (as measured, or the expected 102 kΩ after a reload). */
const firstReading = (lab: LabView): number => lab.doneAt("first-line")?.meter?.si ?? 102_000;

const ohms = (lab: LabView): number => (lab.meter?.value !== null && Number.isFinite(lab.meter?.value ?? NaN) ? lab.meter?.si ?? NaN : NaN);

/** The fix-it bench: one probe slipped off the end of the line onto bare card (7 cm), so the meter reads OL. */
const OFF_THE_LINE: SolutionStep[] = [{ do: "probe", black: "P1.p14" }];

export default defineLab({
  id: "draw-a-resistor",
  title: "Draw a resistor",
  bench: {
    board: "none",
    frame: ["desk:-110,-40", "desk:150,50"],
    parts: [{ id: "P1", kind: "card", at: "desk:-30,0", params: { length: 0, layers: 0, wide: false }, locked: true, label: "Pencil card" }],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:110,12", mode: "ohm", range: "200k", tips: { red: "desk:-76,50", black: "desk:-50,52" } }],
  },
  mascot: {
    hint: "Too high? Make it shorter, or shade it darker.",
  },
  tasks: [
    {
      id: "draw-line",
      prompt: "Draw a line from 0 to 5 cm, in one pass.",
      goal: (lab) => card(lab).length === 5 && card(lab).layers === 1,
      hints: ["Drag along the card from the 0 mark to 5 cm.", "Or tap the card and pick 5 cm."],
      highlight: ["P1"],
      nudges: [{ when: (lab) => card(lab).layers === 1 && card(lab).length !== 5, say: "Close. Erase it and stop at 5 cm." }],
      success: "Nice line.",
    },
    {
      id: "first-line",
      prompt: "Probe both ends of the line.",
      goal: (lab) => card(lab).length === 5 && card(lab).layers === 1 && atEnds(lab) && siIn(lab, 80_000, 125_000),
      hints: ["One probe tip on the 0 mark, one on the 5 cm mark.", "The tips snap onto the line."],
      highlight: ["pin:P1.p0", "pin:P1.p10"],
      success: "About 100 kΩ.",
    },
    {
      id: "half-way",
      prompt: "Slide one probe to the middle of the line.",
      goal: (lab) => {
        const d = apart(lab);
        const r = ohms(lab) / firstReading(lab);
        return d !== null && d >= 2 && d <= 3 && r >= 0.4 && r <= 0.62;
      },
      hints: ["The middle of a 5 cm line is the 2.5 cm mark."],
      highlight: ["pin:P1.p5"],
      success: "About half.",
    },
    {
      id: "go-darker",
      prompt: "Shade the whole line again. Measure end to end.",
      goal: (lab) => card(lab).layers >= 2 && atEnds(lab) && ohms(lab) < 0.65 * firstReading(lab),
      hints: ["Drag along the line again, or tap the card and pick 2 layers.", "Then put the probe back on the 5 cm mark."],
      nudges: [{ when: (lab) => card(lab).layers >= 2 && !atEnds(lab), say: "Darker. Now probe it end to end." }],
      success: "Lower.",
    },
    {
      id: "hit-target",
      prompt: "Make the meter read 30 kΩ, within 10%.",
      goal: (lab) => onLine(lab) !== null && siIn(lab, 27_000, 33_000),
      hints: ["Shorter squeezes less. So does darker.", "Try the probes 3 cm apart on two layers."],
      success: "On target.",
    },
    {
      id: "fix-line",
      prompt: "The line reads OL. Get a number.",
      setup: OFF_THE_LINE,
      // OL first (the setup), then a reading on the line: a bench that never showed OL does not count.
      goal: (lab) => {
        if (showsOL(lab)) lab.memory["ol"] = true;
        return lab.memory["ol"] === true && onLine(lab) !== null && Number.isFinite(ohms(lab));
      },
      hints: ["Follow each probe. Is it on the graphite?", "A probe past the line's end touches bare card."],
      highlight: ["probe:black"],
      success: "Fixed.",
    },
    {
      id: "slide-along",
      prompt: "One probe at the start. Slowly drag the other along.",
      // Four or more stops along the line, each further out with a higher reading than the last.
      goal: (lab) => {
        const mem = lab.memory as { at?: { k: number; since: number }; seq?: { k: number; v: number }[] };
        const p = onLine(lab);
        const v = ohms(lab);
        if (!p || Math.min(...p) !== 0 || !Number.isFinite(v)) return (mem.seq?.length ?? 0) >= 4;
        const k = Math.max(...p);
        if (!mem.at || mem.at.k !== k) mem.at = { k, since: lab.t };
        else if (lab.t - mem.at.since >= 0.3) {
          const seq = (mem.seq ??= []);
          const last = seq[seq.length - 1];
          if (!last || last.k !== k) {
            if (!last || (k > last.k && v > last.v)) seq.push({ k, v });
            else mem.seq = [{ k, v }];
          }
        }
        return (mem.seq?.length ?? 0) >= 4;
      },
      hints: ["Move it a centimetre at a time. Watch the number."],
      success: "A resistor with a sliding contact.",
      bonus: true,
    },
  ],
  solution: [
    { do: "param", part: "P1", params: { length: 5 } },
    { do: "check", task: "draw-line" },
    { do: "probe", red: "P1.p0", black: "P1.p10" },
    { do: "check", task: "first-line" },
    { do: "probe", black: "P1.p5" },
    { do: "check", task: "half-way" },
    { do: "param", part: "P1", params: { layers: 2 } },
    { do: "probe", black: "P1.p10" },
    { do: "check", task: "go-darker" },
    // Two layers, 3 cm apart: 2 kΩ + 3 × 10 kΩ = 32 kΩ.
    { do: "probe", black: "P1.p6" },
    { do: "check", task: "hit-target" },
    ...OFF_THE_LINE,
    { do: "probe", black: "P1.p10" },
    { do: "check", task: "fix-line" },
    // The secret: slide the black probe out from the start, a centimetre at a time.
    { do: "probe", black: "P1.p2" },
    { do: "wait", seconds: 0.4 },
    { do: "probe", black: "P1.p4" },
    { do: "wait", seconds: 0.4 },
    { do: "probe", black: "P1.p6" },
    { do: "wait", seconds: 0.4 },
    { do: "probe", black: "P1.p8" },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "slide-along" },
  ],
});
