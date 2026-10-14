// Blueprint: docs/curriculum/unit-1.md, L4 (the water half), split into its own bench lesson
// (docs/curriculum/conversion-guide.md, B3, 4b): content/units/basics/resistance/salt-and-water/lesson.yaml.
// One idea: pure water barely conducts; what is dissolved in it does. Three cups (distilled, tap, salty) on the Ω
// setting, the probes starting in the distilled one. The cup's "Add salt" stirs in a pinch: each one adds a parallel
// 7.5 kΩ (packages/bench, `cup`), so the tap water drops from 40 kΩ to about 6.3 kΩ with one pinch.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { latest, rangeIs, showsOL, siIn } from "./lib/meter";

const CUPS = ["WC1", "WC2", "WC3"] as const;
const ohms = (lab: LabView) => lab.meter?.mode === "ohm";
/** The probes dip into this cup. */
const inCup = (id: string) => (lab: LabView) => lab.across(id, "either");
/** A logged reading of this cup that is a real number (not OL). */
const loggedValue = (lab: LabView, tag: string) => {
  const r = latest(lab, tag);
  return r && Number.isFinite(r.value) ? r : undefined;
};
const salt = (lab: LabView, id: string) => (lab.prop(id) as { salt?: number } | undefined)?.salt ?? 0;

/** The fix-it bench: the probes in the salty cup with the meter on its 200 Ω range, which reads OL. */
const TOO_SMALL: SolutionStep[] = [
  { do: "probe", red: "WC3.a", black: "WC3.b" },
  { do: "dial", mode: "ohm", range: "200" },
];

export default defineLab({
  id: "salt-and-water",
  title: "The three cups",
  bench: {
    board: "none",
    frame: ["desk:-120,-60", "desk:140,46"],
    parts: [
      { id: "WC1", kind: "cup", at: "desk:-90,-14", params: { water: "distilled", ohms: 1_200_000 }, locked: true, label: "Distilled water" },
      { id: "WC2", kind: "cup", at: "desk:-20,-14", params: { water: "tap", ohms: 40_000 }, locked: true, label: "Tap water" },
      { id: "WC3", kind: "cup", at: "desk:50,-14", params: { water: "salty", ohms: 1_500 }, locked: true, label: "Salty water" },
    ],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:126,10", mode: "ohm", range: "2M", probes: { red: "WC1.a", black: "WC1.b" } }],
  },
  notebook: { tags: { "cup-distilled": inCup("WC1"), "cup-tap": inCup("WC2"), "cup-salty": inCup("WC3") } },
  mascot: {
    hint: "Dip both probes in one cup. Hold still until it logs.",
  },
  tasks: [
    {
      id: "three-cups",
      prompt: "Measure all three cups: distilled, tap and salty.",
      goal: (lab) => !!loggedValue(lab, "cup-distilled") && !!loggedValue(lab, "cup-tap") && !!loggedValue(lab, "cup-salty"),
      hints: ["Move both probes into the next cup. Hold still until it logs.", "Salty water reads low. Try the 2k range."],
      highlight: ["WC1", "WC2", "WC3"],
      nudges: [{ when: (lab) => ohms(lab) && showsOL(lab) && CUPS.some((c) => lab.across(c, "either")), say: "OL? Step the range up." }],
      success: "Pure water barely conducts.",
    },
    {
      id: "pinch-of-salt",
      prompt: "Probe the tap water. Add a pinch of salt.",
      goal: (lab) => salt(lab, "WC2") >= 1 && ohms(lab) && lab.across("WC2", "either") && siIn(lab, 0, 20_000),
      hints: ["Tap the tap water's cup, then Add salt.", "Probes in the tap water to see it."],
      highlight: ["WC2"],
      nudges: [{ when: (lab) => salt(lab, "WC1") + salt(lab, "WC3") > 0 && salt(lab, "WC2") === 0, say: "Salt the tap water this time." }],
      success: "Way down.",
    },
    {
      id: "fix-salty",
      prompt: "The salty cup reads OL. Get a number.",
      setup: TOO_SMALL,
      // OL first (the setup), then a number in the salty cup: a bench that never showed OL does not count.
      goal: (lab) => {
        if (showsOL(lab)) lab.memory["ol"] = true;
        return lab.memory["ol"] === true && ohms(lab) && lab.across("WC3", "either") && siIn(lab, 0, 1e7);
      },
      hints: ["OL on 200: it's over 200 Ω.", "One range up is 2k."],
      highlight: ["part:M1/dial"],
      success: "Fixed.",
    },
  ],
  solution: [
    { do: "wait", seconds: 1 },
    { do: "probe", red: "WC2.a", black: "WC2.b", range: "200k" },
    { do: "wait", seconds: 1 },
    { do: "probe", red: "WC3.a", black: "WC3.b", range: "2k" },
    { do: "wait", seconds: 1 },
    { do: "check", task: "three-cups" },
    { do: "probe", red: "WC2.a", black: "WC2.b", range: "20k" },
    { do: "action", part: "WC2", action: "salt" },
    { do: "check", task: "pinch-of-salt" },
    ...TOO_SMALL,
    { do: "dial", mode: "ohm", range: "2k" },
    { do: "check", task: "fix-salty" },
  ],
});
