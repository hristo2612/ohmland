// Blueprint: docs/curriculum/unit-1.md, L14. A battery, a 1 A and a 3 A glass fuse lying loose, three clip leads
// (0.15 Ω each) and the meter. The battery sags under heavy load and partly recovers at rest.
import { defineLab, type LabView } from "@ohmland/lab";
import { readsIn } from "./lib/meter";

/** Two notebook readings across the battery at least 25 s apart, both below its fresh 9.4 V, the later one 0.05 V higher. */
const recovered = (lab: LabView): boolean => {
  const rs = lab.readings("across:B1").filter((r) => r.mode === "dcv" && Number.isFinite(r.si) && r.si < 9.38);
  return rs.some((a, i) => rs.slice(i + 1).some((b) => b.t - a.t >= 25 && b.si >= a.si + 0.05));
};

export default defineLab({
  id: "fuse-guard",
  title: "The part that fails first",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-98,8", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "F1", kind: "fuse", at: "desk:-12,-40", params: { amps: 1 }, label: "1 A fuse" },
      { id: "F2", kind: "fuse", at: "desk:-12,14", params: { amps: 3 }, label: "3 A fuse" },
    ],
    tray: [
      { kind: "lead", params: { color: "red" }, count: 1 },
      { kind: "lead", params: { color: "black" }, count: 1 },
      { kind: "lead", params: { color: "yellow" }, count: 1 },
    ],
    instruments: [{ kind: "meter", at: "desk:120,22", mode: "off" }],
  },
  mascot: {
    start: "Meet the bravest part on the bench. It's built to fail.",
    hint: "Big current? Red lead to 10A, and keep it quick.",
    fried: "The fuse gave its life, exactly as designed. A hero of the Hall.",
    success: "Between one and three amps. Bracketed like a detective.",
  },
  fried: { F1: "1 A fuse across a 9 V battery", F2: "3 A fuse, too much current" },
  // The Bracketed achievement: the 1 A fuse blown, the 3 A fuse alive, and the current in between measured.
  triggers: {
    bracketed: (lab) => lab.task("blow-1a") === "done" && lab.task("measure-big") === "done" && !lab.event("blown", "F2"),
  },
  tasks: [
    {
      id: "blow-1a",
      prompt: "Clip the 1 A fuse straight across the battery with two clip leads. Watch the thin wire inside.",
      goal: (lab) => lab.event("blown", "F1"),
      hints: ["One lead from battery plus to one end of the fuse, the other from its far end to battery minus."],
      highlight: ["F1", "pin:B1.pos", "pin:B1.neg"],
      success: "Snap. The wire melted and left a gap. The fuse gave its life in a fraction of a second.",
    },
    {
      id: "continuity-check",
      prompt: "Set the dial to continuity (the sound-wave symbol). Test the blown fuse, then the 3 A fuse.",
      goal: (lab) => {
        const mem = lab.memory as { open?: boolean; beep?: boolean };
        if (lab.meter?.mode === "continuity") {
          if (lab.across("F1", "either") && lab.meter.value === Infinity && !lab.meter.beep) mem.open = true;
          if (lab.across("F2", "either") && lab.meter.beep) mem.beep = true;
        }
        return !!mem.open && !!mem.beep;
      },
      hints: ["Touch a probe to each metal end cap.", "Unclip the fuse from the battery first: a meter can't test a part that has power on it."],
      highlight: ["F1", "F2"],
      success: "Silence from the blown one, a beep from the good one. That's how you test a fuse in two seconds.",
    },
    {
      id: "measure-big",
      prompt:
        "Measure the current through the 3 A fuse. Red lead into **10A**, dial to **10A**. Make one loop: battery, 3 A fuse, meter, back to battery. Hold it for 3 seconds, then break the loop.",
      goal: (lab) =>
        lab.meter?.red === "a10" &&
        lab.meter.mode === "dca-10a" &&
        lab.inSeries("M1", "F2") &&
        lab.heldFor(3, lab.part("F2")?.health !== "dead" && lab.amps("F2") > 1) &&
        readsIn(lab, 1.4, 2.6),
      hints: [
        "Big currents use the 10A socket, never mA.",
        "One clip lead from battery plus to the fuse. Red probe on the fuse's other end, black probe on battery minus.",
        "Keep it short. The 10A input isn't built for long runs.",
      ],
      highlight: ["socket:a10", "F2"],
      success: "About 2 A. Too much for the 1 A fuse, within the 3 A fuse's rating. Two fuses bracketed the current.",
    },
    {
      id: "battery-check",
      prompt: "Back to DC volts. Measure the battery now, then again after 30 seconds.",
      goal: recovered,
      hints: ["Red lead back into VΩ. Hold the probes on the battery for the first reading, then come back half a minute later."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "It dipped, then crept back up, but not all the way. Heavy current tires a battery. Next lesson shows why.",
      bonus: true,
    },
  ],
  solution: [
    { do: "lead", id: "TL1", from: "B1.pos", to: "F1.a", color: "red" },
    { do: "lead", id: "TL2", from: "F1.b", to: "B1.neg", color: "black" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "blow-1a" },
    { do: "clip", lead: "TL1", end: "a", to: null },
    { do: "clip", lead: "TL2", end: "b", to: null },
    { do: "probe", red: "F1.a", black: "F1.b", mode: "continuity" },
    { do: "wait", seconds: 0.5 },
    { do: "probe", red: "F2.a", black: "F2.b" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "continuity-check" },
    { do: "probe", red: null, black: null },
    { do: "plug", probe: "red", socket: "a10" },
    { do: "dial", mode: "dca-10a", range: "10A" },
    { do: "clip", lead: "TL1", end: "b", to: "F2.a" },
    { do: "clip", lead: "TL1", end: "a", to: "B1.pos" },
    { do: "probe", red: "F2.b", black: "B1.neg" },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "measure-big" },
    { do: "probe", red: null },
    { do: "plug", probe: "red", socket: "vohm" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "wait", seconds: 1 },
    { do: "wait", seconds: 30 },
    { do: "check", task: "battery-check" },
  ],
});
