// Blueprint: docs/curriculum/unit-1.md, L4. A skin patch (moisture tabs, probe marks 1 cm apart, probe pressure),
// three cups of water, a bare copper wire and a plastic ruler, all measured on the Ω setting. The skin's resistance
// is two contact resistances plus the skin between the marks (packages/bench, `skin`). The blueprint's ±4% drift
// once a second is left out: steady readings let the notebook log them.
import { defineLab, type LabView } from "@ohmland/lab";
import { latest, rangeIs, readsIn, showsOL, si, siIn } from "./lib/meter";

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

/** The probes dip into this cup (or touch both ends of this sample). */
const on = (id: string) => (lab: LabView) => lab.across(id, "either");

/** A logged reading with this tag that is a real number (not OL). */
const loggedValue = (lab: LabView, tag: string) => {
  const r = latest(lab, tag);
  return r && Number.isFinite(r.value) ? r : undefined;
};

export default defineLab({
  id: "what-resists",
  title: "What resists?",
  bench: {
    board: "none",
    parts: [
      { id: "P1", kind: "skin", at: "desk:-100,-44", params: { moisture: "dry", pressure: "light" }, locked: true, label: "Skin patch" },
      { id: "P2", kind: "cup", at: "desk:6,-58", params: { water: "distilled", ohms: 1_200_000 }, locked: true, label: "Distilled water" },
      { id: "P3", kind: "cup", at: "desk:74,-58", params: { water: "tap", ohms: 40_000 }, locked: true, label: "Tap water" },
      { id: "P4", kind: "cup", at: "desk:142,-58", params: { water: "salty", ohms: 1_500 }, locked: true, label: "Salty water" },
      { id: "P5", kind: "sample", at: "desk:-104,40", params: { material: "copper" }, locked: true, label: "Copper wire" },
      { id: "P6", kind: "sample", at: "desk:-6,74", params: { material: "plastic" }, locked: true, label: "Plastic ruler" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:154,58", mode: "off" }],
  },
  notebook: {
    tags: {
      ...SKIN_TAGS,
      "cup-distilled": on("P2"),
      "cup-tap": on("P3"),
      "cup-salty": on("P4"),
      "copper-wire": on("P5"),
      ruler: on("P6"),
    },
  },
  mascot: {
    start: "Everything resists a little. Let's find out who resists a lot.",
    hint: "OL just means bigger than this range. Step the dial up.",
    success: "Distilled water, terrible conductor. Salty water, much better. Science!",
  },
  tasks: [
    {
      id: "dry-skin",
      prompt: "Set the dial to Ω, **200k** range. Touch both probes to the dry skin, 2 cm apart.",
      goal: (lab) => lab.meter?.mode === "ohm" && skin(lab).moisture === "dry" && spacing(lab) === 2 && rangeIs(lab, "2M") && readsIn(lab, 0.3, 1.9),
      hints: ["OL on 200k? The skin is over 200 kΩ. Step up a range.", "The 2M range goes up to just under 2 MΩ."],
      highlight: ["pin:P1.m0", "pin:P1.m2"],
      success: "Hundreds of kilohms. Dry skin is a pretty poor conductor.",
    },
    {
      id: "wet-skin",
      prompt: "Tap **Wet** to moisten the skin and measure again, same spacing.",
      goal: (lab) => lab.meter?.mode === "ohm" && skin(lab).moisture === "wet" && spacing(lab) === 2 && !showsOL(lab) && siIn(lab, 0, 100_000),
      hints: ["The tabs along the front of the skin patch set how wet it is.", "Wet skin reads much lower. A smaller range gives more digits."],
      highlight: ["P1"],
      success: "Tens of kilohms. Water where the probes touch lets current in far more easily.",
    },
    {
      id: "double-spacing",
      prompt: "Keep the skin wet and the pressure the same. Measure at 2 cm, then at 4 cm. Does the reading double?",
      goal: (lab) =>
        ["light", "firm"].some((p) => !!loggedValue(lab, `skin:wet:2cm:${p}`) && !!loggedValue(lab, `skin:wet:4cm:${p}`)),
      hints: ["Hold each reading steady for a moment so it lands in the notebook.", "Move both probes to the 4 cm marks, or one probe to the far mark."],
      highlight: ["pin:P1.m0", "pin:P1.m4"],
      success:
        "It went up, but nowhere near double. Most of the resistance is where the probes touch the skin, and that part didn't change.",
      notice: "Contact resistance dominates. The distance between the probes is only a small part.",
    },
    {
      id: "three-cups",
      prompt: "Measure all three cups of water: distilled, tap and salty.",
      goal: (lab) => !!loggedValue(lab, "cup-distilled") && !!loggedValue(lab, "cup-tap") && !!loggedValue(lab, "cup-salty"),
      hints: ["Dip both probes into a cup. Hold them still until the reading lands in the notebook.", "Distilled water may need the 2M range.", "Salty water reads low. Try 2k."],
      highlight: ["P2", "P3", "P4"],
      success: "Pure water barely conducts. It's what's dissolved in it that carries the current.",
    },
    {
      id: "extremes",
      prompt: "Last two: the copper wire and the plastic ruler.",
      goal: (lab) => {
        const copper = loggedValue(lab, "copper-wire");
        const ruler = latest(lab, "ruler");
        return !!copper && si(copper) < 1 && !!ruler && ruler.range === "2M" && ruler.value === Infinity;
      },
      hints: ["Copper reads best on the 200 range.", "Plastic needs the biggest range, and even that won't be enough."],
      highlight: ["P5", "P6"],
      success:
        "Copper: next to nothing (most of that is your probe leads). Plastic: OL on every range. A conductor and an insulator.",
      bonus: true,
    },
  ],
  solution: [
    { do: "dial", mode: "ohm", range: "200k" },
    { do: "probe", red: "P1.m0", black: "P1.m2" },
    { do: "dial", mode: "ohm", range: "2M" },
    { do: "check", task: "dry-skin" },
    { do: "param", part: "P1", params: { moisture: "wet" } },
    { do: "check", task: "wet-skin" },
    { do: "dial", mode: "ohm", range: "200k" },
    { do: "wait", seconds: 1 },
    { do: "probe", black: "P1.m4" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "double-spacing" },
    { do: "probe", red: "P2.a", black: "P2.b", range: "2M" },
    { do: "wait", seconds: 1 },
    { do: "probe", red: "P3.a", black: "P3.b", range: "200k" },
    { do: "wait", seconds: 1 },
    { do: "probe", red: "P4.a", black: "P4.b", range: "2k" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "three-cups" },
    { do: "probe", red: "P5.a", black: "P5.b", range: "200" },
    { do: "wait", seconds: 1 },
    { do: "probe", red: "P6.a", black: "P6.b", range: "2M" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "extremes" },
  ],
});
