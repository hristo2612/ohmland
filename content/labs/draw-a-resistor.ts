// Blueprint: docs/curriculum/unit-1.md, L5. A white card with a soft pencil: drag along the card to draw a line from
// its 0 mark (again to shade it darker); the selection bar sets length, layers and width, and erases. Probe points sit
// every 0.5 cm along the line. Resistance between two points: 2 kΩ of contacts plus 20 kΩ per cm, divided by the
// layers, halved again when wide (packages/bench, `card`). The blueprint's ±3% drift is left out.
import { defineLab, type LabView } from "@ohmland/lab";
import { siIn } from "./lib/meter";

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

export default defineLab({
  id: "draw-a-resistor",
  title: "Draw a resistor",
  bench: {
    board: "none",
    parts: [{ id: "P1", kind: "card", at: "desk:-30,0", params: { length: 0, layers: 0, wide: false }, locked: true, label: "Pencil card" }],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:110,12", mode: "ohm", range: "200k" }],
  },
  mascot: {
    start: "Grab the pencil. Today we draw electronics.",
    hint: "Too high? Make it shorter, or shade it darker.",
    success: "You drew a working resistor. Art class meets physics.",
  },
  tasks: [
    {
      id: "first-line",
      prompt: "Draw a **5 cm** line with one pass. Put a probe on each end and measure it.",
      goal: (lab) => card(lab).length === 5 && card(lab).layers === 1 && atEnds(lab) && siIn(lab, 80_000, 125_000),
      hints: [
        "Drag across the card to draw. The ruler shows centimetres.",
        "Probes snap onto the line.",
        "You can also click the card and pick the line length in the bar at the bottom of the bench.",
      ],
      highlight: ["P1"],
      success: "About 100 kΩ. A pencil line really is a resistor.",
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
      success: "About half. Half the length, half the resistance.",
    },
    {
      id: "go-darker",
      prompt: "Shade over the whole line once more, then measure end to end again.",
      goal: (lab) => card(lab).layers >= 2 && atEnds(lab) && ohms(lab) < 0.65 * firstReading(lab),
      hints: ["Drag along the whole line again, from the start to past its end.", "Or click the card and choose 2 layers."],
      success: "More graphite gives the current more room, so the resistance drops.",
    },
    {
      id: "hit-target",
      prompt: "Your turn to design. Make a line that measures **50 kΩ**, give or take 10%.",
      goal: (lab) => onLine(lab) !== null && siIn(lab, 45_000, 55_000),
      hints: ["Shorter lines resist less.", "A second layer roughly halves the resistance.", "Try 5 cm with two layers, or 2.5 cm with one."],
      success: "Right on target. You just designed a resistor.",
    },
    {
      id: "slide-along",
      prompt: "Keep one probe at the start and slowly drag the other along the line.",
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
      hints: ["Leave one probe on the 0 mark. Move the other a centimetre at a time and watch the number."],
      success: "A resistor with a sliding contact is called a potentiometer. You'll use real ones in the next unit.",
      bonus: true,
    },
  ],
  solution: [
    { do: "param", part: "P1", params: { length: 5 } },
    { do: "probe", red: "P1.p0", black: "P1.p10" },
    { do: "check", task: "first-line" },
    { do: "probe", black: "P1.p5" },
    { do: "check", task: "half-way" },
    { do: "param", part: "P1", params: { layers: 2 } },
    { do: "probe", black: "P1.p10" },
    { do: "check", task: "go-darker" },
    // Two layers over 5 cm is about 52 kΩ already; a fresh 2.5 cm line of one layer works too.
    { do: "check", task: "hit-target" },
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
