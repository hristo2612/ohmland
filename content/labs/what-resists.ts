// Blueprint: docs/curriculum/unit-1.md, L4, split for a bench lesson (docs/curriculum/conversion-guide.md, B3): this is
// the skin half, content/units/basics/resistance/what-resists/lesson.yaml; the cups moved to salt-and-water.
// One idea: the Ω setting measures squeeze, even your skin's. A skin patch (moisture tabs, probe marks 1 cm apart,
// probe pressure) with the probes already on the 0 and 2 cm marks and the meter off but set to its 2M range. The
// skin's resistance is two contact resistances plus the skin between the marks (packages/bench, `skin`).
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { latest, rangeIs, readsIn, showsOL, siIn } from "./lib/meter";

/** The skin mark index a probe touches (m0 to m4), or null. */
const mark = (at: string | null | undefined): number | null => {
  const m = /^pin:P1\.m(\d)$/.exec(at ?? "");
  return m ? Number(m[1]) : null;
};

/** Centimetres between the two probes on the skin, or null when they are not both on it. */
const spacing = (lab: LabView): number | null => {
  const a = mark(lab.meter?.redAt);
  const b = mark(lab.meter?.blackAt);
  return a === null || b === null || a === b ? null : Math.abs(a - b);
};

const skin = (lab: LabView) => lab.prop("P1") as { moisture: string; pressure: string };
const ohms = (lab: LabView) => lab.meter?.mode === "ohm";

/** Notebook tags such as "skin:wet:2cm:light": what the skin was like and how far apart the probes were. */
const SKIN_TAGS = Object.fromEntries(
  ["dry", "damp", "wet", "salty"].flatMap((moisture) =>
    [1, 2, 3, 4].flatMap((cm) =>
      ["light", "firm"].map((pressure) => [
        `skin:${moisture}:${cm}cm:${pressure}`,
        (lab: LabView) => spacing(lab) === cm && skin(lab).moisture === moisture && skin(lab).pressure === pressure,
      ]),
    ),
  ),
);

/** A logged reading with this tag that is a real number (not OL). */
const loggedValue = (lab: LabView, tag: string) => {
  const r = latest(lab, tag);
  return r && Number.isFinite(r.value) ? r : undefined;
};

/** The fix-it bench: dry skin again, on the 200k range, where it reads OL. */
const TOO_SMALL: SolutionStep[] = [
  { do: "param", part: "P1", params: { moisture: "dry" } },
  { do: "dial", mode: "ohm", range: "200k" },
];

export default defineLab({
  id: "what-resists",
  title: "What resists?",
  bench: {
    board: "none",
    frame: ["desk:-150,-60", "desk:110,40"],
    parts: [{ id: "P1", kind: "skin", at: "desk:-70,-10", params: { moisture: "dry", pressure: "light" }, locked: true, label: "Skin patch" }],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:70,4", mode: "off", range: "2M", probes: { red: "P1.m0", black: "P1.m2" } }],
  },
  notebook: { tags: SKIN_TAGS },
  mascot: {
    hint: "OL just means bigger than this range. Step the range up.",
  },
  tasks: [
    {
      id: "dry-skin",
      prompt: "Turn the dial to Ω.",
      goal: (lab) => ohms(lab) && skin(lab).moisture === "dry" && spacing(lab) === 2 && rangeIs(lab, "2M") && readsIn(lab, 0.3, 1.9),
      hints: ["Ω is on the dial, between V and the beeper.", "Keep the probes on the 0 and 2 cm marks."],
      highlight: ["part:M1/dial"],
      nudges: [{ when: (lab) => ohms(lab) && showsOL(lab), say: "OL? Step the range up to 2M." }],
      success: "Almost a million ohms.",
    },
    {
      id: "wet-skin",
      prompt: "Tap Wet on the patch. Measure again, same spacing.",
      goal: (lab) => ohms(lab) && skin(lab).moisture === "wet" && spacing(lab) === 2 && siIn(lab, 0, 100_000),
      hints: ["The tabs on the patch set how wet it is.", "A smaller range shows more digits."],
      highlight: ["P1"],
      nudges: [{ when: (lab) => ohms(lab) && spacing(lab) !== 2 && skin(lab).moisture === "wet", say: "Keep the probes 2 cm apart." }],
      success: "Tens of kilohms.",
    },
    {
      id: "fix-dry",
      prompt: "Dry skin reads OL. Get a number.",
      setup: TOO_SMALL,
      // OL first (the setup), then a number on dry skin: a bench that never showed OL does not count.
      goal: (lab) => {
        if (showsOL(lab)) lab.memory["ol"] = true;
        return lab.memory["ol"] === true && ohms(lab) && skin(lab).moisture === "dry" && spacing(lab) !== null && readsIn(lab, 0, 1e9);
      },
      hints: ["OL: the skin is over 200 kΩ.", "Step the range up one at a time."],
      highlight: ["part:M1/dial"],
      success: "Fixed.",
    },
    {
      id: "double-spacing",
      prompt: "Wet skin: measure at 2 cm, then at 4 cm. Double?",
      goal: (lab) => ["light", "firm"].some((p) => !!loggedValue(lab, `skin:wet:2cm:${p}`) && !!loggedValue(lab, `skin:wet:4cm:${p}`)),
      hints: ["Hold each reading still until the notebook logs it.", "Move one probe to the 4 cm mark."],
      highlight: ["pin:P1.m0", "pin:P1.m4"],
      success: "Up, but nowhere near double.",
      notice: "Most of it is where the probes touch.",
      bonus: true,
    },
  ],
  solution: [
    { do: "dial", mode: "ohm" },
    { do: "check", task: "dry-skin" },
    { do: "param", part: "P1", params: { moisture: "wet" } },
    { do: "dial", mode: "ohm", range: "200k" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "wet-skin" },
    ...TOO_SMALL,
    { do: "dial", mode: "ohm", range: "2M" },
    { do: "check", task: "fix-dry" },
    // The secret: wet skin at 2 cm, then 4 cm.
    { do: "param", part: "P1", params: { moisture: "wet" } },
    { do: "dial", mode: "ohm", range: "200k" },
    { do: "wait", seconds: 1 },
    { do: "probe", black: "P1.m4" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "double-spacing" },
  ],
});
