// Blueprint: docs/curriculum/unit-3.md, MP8. The lab of a bench lesson (docs/LESSONS.md):
// content/units/permanent/wires-and-power/bench-supply. One idea: an adapter's label shows its plus, and plus must
// meet plus.
// The robot's lamp on a half board: 1 kΩ from the + rail to a red LED, and a jumper from its cathode to the − rail. A
// barrel-jack board J1 lies on the desk, its two pins free
// (tip: the centre contact; sleeve). Wall adapters behind the board, their plugs loose: AD1 "9 V 1 A" regulated,
// centre plus; AD3 "9 V 500 mA" regulated, centre minus; AD2 "9 V AC" for the secret, with its own jack J2. Mains is
// never modelled: each adapter is a `supply` between its jack's pins (packages/sim README, "Supply").
// From the simulator: AD1 reads 9.0 V on its pins and lights the lamp at about 7 mA. With centre minus on the rails
// the LED and 1 kΩ just stay dark (the LED blocks, unharmed). The blueprint's electrolytic across the rails is left
// out: the simulator kills a 100 µF part reversed on a 9 V regulated supply within a quarter of a second, before any
// warming shows. AD2's sine swings to about ±12.7 V on the scope, and a DC meter reads about 0.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const into = (lab: LabView, id: string) => lab.solder.adapter(id)?.into ?? null;
/** The jack sits in the near rails, centre pin on +. */
const plusToPlus = (lab: LabView) => lab.connected("J1.tip", "rail+:1") && lab.connected("J1.sleeve", "rail-:1");
const backwards = (lab: LabView) => lab.connected("J1.tip", "rail-:1") && lab.connected("J1.sleeve", "rail+:1");

/** The fix-it bench: the jack in the rails as before, but the centre-minus adapter plugged into it. */
const WRONG_ADAPTER: SolutionStep[] = [
  { do: "probe", red: null, black: null },
  { do: "dial", mode: "off" },
  { do: "param", part: "AD1", params: { into: null } as never },
  { do: "param", part: "AD3", params: { into: "J1" } },
];

export default defineLab({
  id: "bench-supply",
  title: "The flat batteries",
  bench: {
    board: "half",
    frame: ["desk:-215,-140", "desk:125,105"],
    parts: [
      { id: "R1", kind: "resistor", at: "rail+:10-c10", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor" },
      { id: "D1", kind: "led", at: "d10", params: { color: "red" }, locked: true, label: "Lamp" },
      { id: "J1", kind: "barrel-jack", at: "desk:-75,55", label: "Barrel jack" },
      // The adapters stand behind the board, their plugs lying loose in front of them.
      { id: "AD1", kind: "wall-adapter", at: "desk:-75,-110", params: { volts: 9, amps: 1, type: "regulated", centre: "plus" }, locked: true, label: "9 V adapter, centre plus" },
      { id: "AD3", kind: "wall-adapter", at: "desk:-140,-110", params: { volts: 9, amps: 0.5, type: "regulated", centre: "minus" }, locked: true, label: "9 V adapter, centre minus" },
      { id: "AD2", kind: "wall-adapter", at: "desk:95,-110", params: { volts: 9, amps: 1, type: "ac" }, locked: true, label: "9 V AC adapter" },
      { id: "J2", kind: "barrel-jack", at: "desk:95,0", label: "Spare jack" },
    ],
    wires: [{ id: "W1", from: "a11", to: "rail-:11", color: "black" }],
    tray: [],
    instruments: [
      { kind: "meter", at: "desk:-165,50", mode: "off", tips: { red: "desk:-55,85", black: "desk:-45,92" } },
      { kind: "scope", traces: [{ label: "J2", volts: "J2.tip", ref: "J2.sleeve" }], window: 0.5, range: [-15, 15] },
    ],
  },
  mascot: {
    hint: "Red probe on plus reads positive.",
    fried: "Ouch. Swap in a fresh one.",
  },
  tasks: [
    {
      id: "plug-in",
      prompt: "Push the 9 V adapter's plug into the jack.",
      goal: (lab) => into(lab, "AD1") === "J1",
      hints: ["Drag the plug at the end of the left adapter's cord.", "Drop it on the jack's round socket."],
      highlight: ["AD1", "J1"],
      success: "Plugged in.",
    },
    {
      id: "find-plus",
      prompt: "Dial to 20 V DC and touch a probe to each pin. Which reads positive?",
      goal: (lab) => lab.meter?.mode === "dcv" && lab.probed("J1.tip", "J1.sleeve") && (lab.meter.value ?? 0) >= 8.5,
      hints: ["Turn the dial to V DC, 20.", "A probe on each pin. A minus sign? Swap them."],
      highlight: ["J1"],
      nudges: [{ when: (lab) => lab.meter?.mode === "dcv" && lab.probed("J1.sleeve", "J1.tip") && (lab.meter.value ?? 0) < -8, say: "Minus nine. Swap the probes." }],
      success: "Plus nine, red on the centre pin.",
    },
    {
      id: "plug-in-right",
      prompt: "Put the jack into the near rails, centre pin on the + rail.",
      goal: (lab) => into(lab, "AD1") === "J1" && plusToPlus(lab) && lab.isLit("D1"),
      hints: ["Drag the jack onto the board, its pins in the two near rails.", "The centre pin goes on the red + rail."],
      highlight: ["J1", "rail+:3"],
      nudges: [{ when: backwards, say: "Backwards! Turn the jack round." }],
      success: "The lamp glows.",
    },
    {
      id: "ac-wave",
      prompt: "Plug the AC adapter into the spare jack and look at the scope.",
      goal: (lab) => {
        if (into(lab, "AD2") !== "J2") return false;
        const v = lab.volts("J2.tip", "J2.sleeve") ?? 0;
        const m = lab.memory as { hi?: number; lo?: number };
        m.hi = Math.max(m.hi ?? 0, v);
        m.lo = Math.min(m.lo ?? 0, v);
        return m.hi > 8 && m.lo < -8;
      },
      hints: ["Drag the right adapter's plug onto the spare jack."],
      success: "It swings both ways.",
      bonus: true,
    },
    {
      id: "fix-it",
      prompt: "The lamp is dark again. Fix it.",
      setup: WRONG_ADAPTER,
      goal: (lab) => {
        if (into(lab, "AD3") === "J1") lab.memory["wrong"] = true;
        return lab.memory["wrong"] === true && into(lab, "AD1") === "J1" && into(lab, "AD3") !== "J1" && lab.isLit("D1");
      },
      hints: ["Read the labels. Which adapter is centre minus?", "Unplug it, and plug in the centre-plus one."],
      highlight: ["AD3", "AD1"],
      success: "Glowing again.",
    },
  ],
  solution: [
    { do: "param", part: "AD1", params: { into: "J1" } },
    { do: "check", task: "plug-in" },
    { do: "probe", red: "J1.tip", black: "J1.sleeve", mode: "dcv", range: "20V" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "find-plus" },
    { do: "probe", red: null, black: null },
    { do: "move", part: "J1", at: "rail+:3" },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "plug-in-right" },
    { do: "param", part: "AD2", params: { into: "J2" } },
    { do: "wait", seconds: 0.2 },
    { do: "check", task: "ac-wave" },
    ...WRONG_ADAPTER,
    { do: "wait", seconds: 1 },
    { do: "param", part: "AD3", params: { into: null } as never },
    { do: "param", part: "AD1", params: { into: "J1" } },
    { do: "wait", seconds: 0.5 },
    { do: "check", task: "fix-it" },
  ],
});
