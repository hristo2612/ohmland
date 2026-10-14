// Split from fuse-guard (docs/curriculum/conversion-guide.md, B3 14b). The lab of a bench lesson (docs/LESSONS.md):
// content/units/basics/power-and-heat/big-current. One idea: big flow goes through the meter's 10A socket, briefly.
// A battery with a clip lead already on its plus, a 3 A glass fuse and the meter (red in VΩ, dial off). From the
// simulator: battery, 3 A fuse and meter on 10A read about 1.9 A (a moment near 2.5 A, then the battery sags), and the
// fuse holds. With the red plug left in VΩ on the 10A setting the meter reads 0.00, nothing flows and nothing blows.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";
import { readsIn } from "./lib/meter";

/** The meter on 10A, red in the 10A socket, carrying the fuse's flow, reading a big current. */
const measuring = (lab: LabView): boolean =>
  lab.meter?.red === "a10" && lab.meter.mode === "dca-10a" && lab.inSeries("M1", "F2") && readsIn(lab, 1.4, 2.6);

/** Two notebook readings across the battery at least 25 s apart, both below its fresh 9.4 V, the later one 0.05 V higher. */
const recovered = (lab: LabView): boolean => {
  const rs = lab.readings("across:B1").filter((r) => r.mode === "dcv" && Number.isFinite(r.si) && r.si < 9.38);
  return rs.some((a, i) => rs.slice(i + 1).some((b) => b.t - a.t >= 25 && b.si >= a.si + 0.05));
};

/** The fix-it bench: the same loop on the 10A setting, but the red plug back in VΩ. */
const PLUG_IN_VOHM: SolutionStep[] = [{ do: "plug", probe: "red", socket: "vohm" }];

export default defineLab({
  id: "big-current",
  title: "The 10 A socket",
  bench: {
    board: "none",
    frame: ["desk:-140,-85", "desk:135,80"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-95,15", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      { id: "F2", kind: "fuse", at: "desk:-15,-20", params: { amps: 3 }, locked: true, label: "3 A fuse" },
    ],
    leads: [{ id: "TL1", from: "B1.pos", to: "F2.a", color: "red" }],
    tray: [],
    instruments: [{ kind: "meter", at: "desk:85,-25", mode: "off", tips: { red: "desk:30,45", black: "desk:-20,60" } }],
  },
  mascot: {
    hint: "Big flow: red in 10A, dial on 10A, and keep it quick.",
    fried: "Pop. The meter's little fuse saved it. Spare's in the drawer.",
  },
  // The Bracketed achievement: the 1 A fuse blew in fuse-guard; here the 3 A fuse carries the flow in between, measured.
  triggers: {
    bracketed: (lab) => lab.task("measure-big") === "done" && !lab.event("blown", "F2"),
  },
  tasks: [
    {
      id: "plug-10a",
      prompt: "Plug the red lead into the 10A socket.",
      goal: (lab) => lab.meter?.red === "a10",
      hints: ["Drag the red plug out of VΩ and drop it on the socket marked 10A."],
      highlight: ["socket:a10"],
      nudges: [{ when: (lab) => lab.meter?.red === "ma", say: "That's mA: small flows only. Try 10A." }],
      success: "Red in 10A.",
    },
    {
      id: "dial-10a",
      prompt: "Turn the dial to 10A.",
      goal: (lab) => lab.meter?.mode === "dca-10a",
      hints: ["Click the dial's 10A position."],
      success: "Dial on 10A.",
    },
    {
      id: "measure-big",
      prompt: "Red probe on the fuse's free end, black on minus. Hold three seconds.",
      goal: (lab) => measuring(lab) && lab.heldFor(3, lab.part("F2")?.health !== "dead" && lab.amps("F2") > 1),
      hints: ["The red probe goes on the fuse's free end cap.", "The black probe goes on the battery's minus. Keep it short."],
      highlight: ["F2", "pin:B1.neg"],
      success: "About 1.9 A.",
    },
    {
      id: "fix-zero",
      prompt: "The meter reads zero on 10A. Fix it.",
      setup: PLUG_IN_VOHM,
      // Broken first (the setup), then a real reading: a meter that never read zero does not count.
      goal: (lab) => {
        if (lab.meter?.red !== "a10") lab.memory["zero"] = true;
        return lab.memory["zero"] === true && measuring(lab);
      },
      hints: ["Look where the red plug is. The dial says 10A.", "Move the red plug to the 10A socket."],
      highlight: ["socket:a10"],
      success: "Reading again.",
    },
    {
      id: "battery-check",
      prompt: "Red back in VΩ, dial to 20 V. Read the battery, then again in 30 seconds.",
      goal: recovered,
      hints: ["Red plug back in VΩ, dial to 20V DC.", "Probes on the battery. Read once, then wait half a minute."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "It dipped, then crept back.",
      bonus: true,
    },
  ],
  solution: [
    { do: "plug", probe: "red", socket: "a10" },
    { do: "check", task: "plug-10a" },
    { do: "dial", mode: "dca-10a", range: "10A" },
    { do: "check", task: "dial-10a" },
    { do: "probe", red: "F2.b", black: "B1.neg" },
    { do: "wait", seconds: 3.5 },
    { do: "check", task: "measure-big" },
    ...PLUG_IN_VOHM,
    { do: "wait", seconds: 1 },
    { do: "plug", probe: "red", socket: "a10" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-zero" },
    { do: "probe", red: null, black: null },
    { do: "plug", probe: "red", socket: "vohm" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "wait", seconds: 1 },
    { do: "wait", seconds: 30 },
    { do: "check", task: "battery-check" },
  ],
});
