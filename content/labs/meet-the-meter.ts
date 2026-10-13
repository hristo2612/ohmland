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
      prompt: "Black lead into **COM**, red lead into **VΩ**.",
      goal: (lab) => lab.meter?.black === "com" && lab.meter.red === "vohm",
      hints: ["COM means common. Black always goes there.", "VΩ is for volts and ohms. Red goes there."],
      highlight: ["socket:com", "socket:vohm"],
      success: "Leads in. Black in COM, always.",
    },
    {
      id: "set-dial",
      prompt: "Dial to DC volts, **20 V** range.",
      goal: (lab) => lab.meter?.mode === "dcv" && rangeIs(lab, "20V"),
      hints: ["DC volts is the V with a straight line.", "20 V: the smallest range above 9 V."],
      success: "Ready to read up to 20 V.",
    },
    {
      id: "read-battery",
      prompt: "Red probe on the round **+** terminal, black on the six-sided **−**.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B1") && readsIn(lab, 9.0, 9.6),
      hints: ["The terminals are the two snaps on top.", "Both probes must touch metal."],
      highlight: ["pin:B1.pos", "pin:B1.neg"],
      success: "About 9.4 V. A fresh battery.",
      notice: "A bit over 9 V, and steady: the meter draws almost nothing.",
    },
    {
      id: "swap-probes",
      prompt: "Swap the probes. What changes?",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B1", "rev") && readsIn(lab, -9.6, -9.0),
      hints: ["Same terminals, other probes."],
      success: "A minus sign: red is on the lower side. Nothing's broken.",
    },
    {
      id: "tired-battery",
      prompt: "Measure the used battery at the back.",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.across("B2") && readsIn(lab, 7.2, 8.0),
      hints: ["Same as before: red on +, black on −."],
      highlight: ["B2"],
      success: "About 7.6 V. Same label, less left.",
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
