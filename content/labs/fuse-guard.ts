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
      prompt: "Clip the 1 A fuse straight across the battery. Watch the wire.",
      goal: (lab) => lab.event("blown", "F1"),
      hints: ["Two clip leads: battery plus to one end, the other end to minus."],
      highlight: ["F1", "pin:B1.pos", "pin:B1.neg"],
      success: "Snap. The wire melted in a fraction of a second.",
    },
    {
      id: "continuity-check",
      prompt: "Dial to continuity. Test the blown fuse, then the 3 A one.",
      goal: (lab) => {
        const mem = lab.memory as { open?: boolean; beep?: boolean };
        if (lab.meter?.mode === "continuity") {
          if (lab.across("F1", "either") && lab.meter.value === Infinity && !lab.meter.beep) mem.open = true;
          if (lab.across("F2", "either") && lab.meter.beep) mem.beep = true;
        }
        return !!mem.open && !!mem.beep;
      },
      hints: ["A probe on each metal end cap.", "Unclip the fuse from the battery first. Powered parts can't be tested."],
      highlight: ["F1", "F2"],
      success: "Silence from the blown one, a beep from the good one.",
    },
    {
      id: "measure-big",
      prompt: "On **10A**, loop battery, 3 A fuse and meter. Hold 3 seconds.",
      goal: (lab) =>
        lab.meter?.red === "a10" &&
        lab.meter.mode === "dca-10a" &&
        lab.inSeries("M1", "F2") &&
        lab.heldFor(3, lab.part("F2")?.health !== "dead" && lab.amps("F2") > 1) &&
        readsIn(lab, 1.4, 2.6),
      hints: [
        "Red lead in the 10A socket, dial on 10A. Never mA.",
        "Clip battery plus to the fuse. Red probe on its other end, black on minus.",
        "Keep it short, then break the loop.",
      ],
      highlight: ["socket:a10", "F2"],
      success: "About 2 A. Too much for 1 A, fine for 3 A. Bracketed.",
    },
    {
      id: "battery-check",
      prompt: "DC volts. Measure the battery now, and again in 30 seconds.",
      goal: recovered,
      hints: ["Red lead back into VΩ. Read once, then wait half a minute."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "It dipped, then crept back, not all the way. Next lesson shows why.",
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
