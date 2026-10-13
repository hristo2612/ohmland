// Blueprint: docs/curriculum/unit-1.md, L16. Half a lemon with two electrode slots, two copper-plated coins and two
// galvanised (zinc) strips beside it. Drop an electrode near a slot to push it in; the lemon's "Metals" setting
// pushes the two together. Copper and zinc apart make a cell of about 0.92 V with copper as plus (packages/bench,
// `fruit`). The tray has a red LED and two clip leads for the bonus.
import { defineLab, type LabView } from "@ohmland/lab";
import { readsIn } from "./lib/meter";

type Metal = "copper" | "zinc";

/** The electrodes in the lemon, with their metals. */
const slots = (lab: LabView): { id: string; metal: Metal }[] =>
  lab.holds("FC1").map((id) => ({ id, metal: (lab.prop(id) as { metal: Metal }).metal }));

/** The copper and the zinc electrode in the lemon, when it holds one of each. */
const pair = (lab: LabView): { cu: string; zn: string } | null => {
  const s = slots(lab);
  const cu = s.find((e) => e.metal === "copper");
  const zn = s.find((e) => e.metal === "zinc");
  return s.length === 2 && cu && zn ? { cu: cu.id, zn: zn.id } : null;
};

const touching = (lab: LabView): boolean => (lab.prop("FC1") as { touching?: boolean }).touching === true;

/** The probes touch the two electrodes in the lemon, either way round. */
const acrossBoth = (lab: LabView): boolean => {
  const s = slots(lab);
  return s.length === 2 && lab.probed(`${s[0]!.id}.tip`, `${s[1]!.id}.tip`, "either");
};

const nearZero = (lab: LabView): boolean => lab.meter?.mode === "dcv" && acrossBoth(lab) && readsIn(lab, -0.05, 0.05);

export default defineLab({
  id: "lemon-cell",
  title: "A battery from the fruit bowl",
  bench: {
    board: "none",
    parts: [
      { id: "FC1", kind: "fruit", at: "desk:-24,-28", locked: true, label: "Lemon" },
      // The little box of metal bits, tipped out in front of the lemon.
      { id: "E1", kind: "electrode", at: "desk:-74,40", params: { metal: "copper" }, label: "Copper coin" },
      { id: "E2", kind: "electrode", at: "desk:-46,52", params: { metal: "copper" }, label: "Copper coin" },
      { id: "E3", kind: "electrode", at: "desk:-4,42", rot: 8, params: { metal: "zinc" }, label: "Zinc strip" },
      { id: "E4", kind: "electrode", at: "desk:40,54", rot: -6, params: { metal: "zinc" }, label: "Zinc strip" },
    ],
    tray: [
      { id: "D1", kind: "led", params: { color: "red", maxmA: 50 }, count: 1, label: "Red LED" },
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "black" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:124,20", mode: "dcv", range: "2V" }],
  },
  mascot: {
    start: "Lunch or laboratory? Today a lemon is both.",
    hint: "Two different metals, close together, not touching.",
    success: "Nine tenths of a volt from fruit. Nature makes batteries too!",
  },
  tasks: [
    {
      id: "make-a-cell",
      prompt: "Push in a copper coin and a zinc strip. Red on copper, black on zinc.",
      goal: (lab) => {
        const p = pair(lab);
        return !!p && !touching(lab) && lab.meter?.mode === "dcv" && lab.probed(`${p.cu}.tip`, `${p.zn}.tip`) && readsIn(lab, 0.8, 1.0);
      },
      hints: ["Drop one metal on each cut in the lemon.", "Keep them apart. 2V shows the most digits."],
      highlight: ["FC1", "E1", "E3"],
      success: "About 0.9 V from a lemon. You made a cell.",
    },
    {
      id: "which-is-plus",
      prompt: "Swap the probes: red on zinc, black on copper.",
      goal: (lab) => {
        const p = pair(lab);
        return !!p && !touching(lab) && lab.meter?.mode === "dcv" && lab.probed(`${p.zn}.tip`, `${p.cu}.tip`) && readsIn(lab, -1.0, -0.8);
      },
      hints: ["Same electrodes, other probes."],
      success: "Negative. Copper is plus, zinc is minus.",
    },
    {
      id: "same-metal",
      prompt: "Swap the zinc for the second copper coin. Measure.",
      goal: (lab) => {
        const s = slots(lab);
        return s.length === 2 && s.every((e) => e.metal === "copper") && nearZero(lab);
      },
      hints: ["Drag the zinc out, then drop the coin in its slot."],
      highlight: ["E2"],
      success: "Almost nothing. A cell needs two different metals.",
    },
    {
      id: "touching",
      prompt: "Zinc back in. Push the metals together. Measure.",
      goal: (lab) => !!pair(lab) && touching(lab) && nearZero(lab),
      hints: ["Click the lemon, then choose Touching.", "Keep the probes on the two electrodes."],
      highlight: ["FC1"],
      success: "Zero again. Touching metals short the cell inside.",
    },
    {
      id: "one-lemon-led",
      prompt: "Metals apart. Can one lemon light the LED?",
      goal: (lab) => {
        const p = pair(lab);
        const led = lab.bench.parts.find((x) => x.kind === "led")?.id;
        return (
          !!p && !!led && !touching(lab) && lab.connected(`${led}.anode`, `${p.cu}.tip`) && lab.connected(`${led}.cathode`, `${p.zn}.tip`) && (lab.part(led)?.glow ?? 0) < 0.02
        );
      },
      hints: ["Two clip leads: long leg to copper, short leg to zinc."],
      success: "Not a flicker. A red LED needs about 2 V. More lemons!",
      bonus: true,
    },
  ],
  solution: [
    { do: "move", part: "E1", at: "in:FC1.left" },
    { do: "move", part: "E3", at: "in:FC1.right" },
    { do: "probe", red: "E1.tip", black: "E3.tip" },
    { do: "check", task: "make-a-cell" },
    { do: "probe", red: "E3.tip", black: "E1.tip" },
    { do: "check", task: "which-is-plus" },
    { do: "move", part: "E3", at: "desk:-4,42" },
    { do: "move", part: "E2", at: "in:FC1.right" },
    { do: "probe", red: "E1.tip", black: "E2.tip" },
    { do: "check", task: "same-metal" },
    { do: "move", part: "E2", at: "desk:-46,52" },
    { do: "move", part: "E3", at: "in:FC1.right" },
    { do: "param", part: "FC1", params: { touching: true } },
    { do: "probe", red: "E1.tip", black: "E3.tip" },
    { do: "check", task: "touching" },
    { do: "param", part: "FC1", params: { touching: false } },
    { do: "place", part: "D1", kind: "led", params: { color: "red", maxmA: 50 }, at: "desk:56,-30" },
    { do: "lead", id: "TL1", from: "D1.anode", to: "E1.tip", color: "red" },
    { do: "lead", id: "TL2", from: "D1.cathode", to: "E3.tip", color: "black" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "one-lemon-led" },
  ],
});
