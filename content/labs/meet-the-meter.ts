// Blueprint: docs/curriculum/unit-1.md, L2. A battery to measure, a tired one for the bonus, and a meter with its
// leads unplugged. The blueprint's exit animation (the dial turning to OFF on Continue) is the mascot's exit line.
import { defineLab } from "@ohmland/lab";
import { rangeIs, readsIn } from "./lib/meter";

export default defineLab({
  id: "meet-the-meter",
  title: "Meet your multimeter",
  bench: {
    board: "none",
    parts: [
      // Standing upright, terminals up.
      { id: "B1", kind: "battery", at: "desk:-34,8", params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true, label: "9 V battery" },
      // A scuffed, used battery set aside at the back for the bonus task.
      { id: "B2", kind: "battery", at: "desk:-96,-46", params: { emf: 7.6, internalOhms: 6, mAh: 500, worn: true }, locked: true, label: "Used 9 V battery" },
    ],
    tray: [],
    // Both leads lying unplugged next to the meter.
    instruments: [{ kind: "meter", at: "desk:62,2", mode: "off", red: null, black: null }],
  },
  mascot: {
    start: "Meet my favourite tool. It sees what we can't.",
    hint: "Black in COM, red in VΩ. Then the dial.",
    success: "9.4 volts. That battery is ready for anything.",
    exit: "Dial to OFF. Real meters thank you with longer battery life.",
  },
  tasks: [
    {
      id: "plug-in",
      prompt: "Plug the black lead into **COM** and the red lead into **VΩ**.",
      goal: (lab) => lab.meter?.black === "com" && lab.meter.red === "vohm",
      hints: ["COM is short for common. It's where black always goes.", "VΩ is the socket for volts and ohms. The red plug goes there."],
      highlight: ["socket:com", "socket:vohm"],
      success: "Leads in. Black in COM is a habit for life.",
    },
    {
      id: "set-dial",
      prompt: "Turn the dial to DC volts, on the 20 V range.",
      goal: (lab) => lab.meter?.mode === "dcv" && rangeIs(lab, "20V"),
      hints: ["DC volts is the V with a straight line.", "Pick 20, the smallest range bigger than 9 V."],
      success: "Ready to read up to 20 V.",
    },
    {
      id: "read-battery",
      prompt: "Touch the red probe to the battery's small round terminal (+) and the black probe to the larger six-sided terminal (−).",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B1") && readsIn(lab, 9.0, 9.6),
      hints: ["The two snaps on top are the terminals. Plus is the smaller, round one.", "Both probes must touch metal at the same time."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "About 9.4 V. That battery is fresh.",
      notice: "The reading is a bit over 9 V, and it barely changes, because the meter draws almost no current.",
    },
    {
      id: "swap-probes",
      prompt: "Now swap: red on minus, black on plus. What changes?",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B1", "rev") && readsIn(lab, -9.6, -9.0),
      hints: ["Same terminals, other probes."],
      success: "A minus sign. The meter isn't broken. It's telling you the red probe is on the lower side.",
    },
    {
      id: "tired-battery",
      prompt: "There's a used battery at the back of the bench. Measure it too.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B2") && readsIn(lab, 7.2, 8.0),
      hints: ["Same setup as before: red on the round terminal, black on the six-sided one."],
      highlight: ["B2"],
      success: "About 7.6 V. Same label, less left in it.",
      bonus: true,
    },
  ],
  solution: [
    { do: "plug", probe: "black", socket: "com" },
    { do: "plug", probe: "red", socket: "vohm" },
    { do: "check", task: "plug-in" },
    { do: "dial", mode: "dcv", range: "20V" },
    { do: "check", task: "set-dial" },
    { do: "probe", red: "B1.pos", black: "B1.neg" },
    { do: "check", task: "read-battery" },
    { do: "probe", red: "B1.neg", black: "B1.pos" },
    { do: "check", task: "swap-probes" },
    { do: "probe", red: "B2.pos", black: "B2.neg" },
    { do: "check", task: "tired-battery" },
  ],
});
