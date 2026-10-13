// Lab for lesson `coil-kickback` (docs/curriculum/unit-2.md, Lesson 6).
// `at` anchors are provisional until packages/bench owns BenchState.
// Instruments: meter and a 2-channel oscilloscope (BENCH NEEDS: single-shot trigger, time base down to 100 µs per
// division). Scope channel 1 clips to k1a, its ground clip to gnd, trigger on the falling edge. BenchConfig only lists
// "meter" today.
// The coil is set to 0.3 H so the lesson's numbers hold (0.3 H, 17 mA stopped in 10 µs is about 500 V).
// SIM NEEDS: a contact arc model so opening a coil circuit with no clamp gives a bounded spike (breakdown about
// 300 V) with a new `spark` event and contact wear; LED perception that shows a sub-millisecond 15 mA pulse as a blip.
// Damage moments: the LED or diode fitted forwards puts the battery straight across it when S1 is pressed. The LED
// dies at once; the diode heats and the battery reports `shorted`. Robot: "Forwards, it's a shortcut around the coil.
// It has to face backwards."
import { defineLab } from "@ohmland/lab";
import { closed, glow, placed, pullIns, releases } from "./lib/goals";

export default defineLab({
  id: "coil-kickback",
  title: "The coil kicks back",
  bench: {
    board: "none",
    parts: [
      // pins { pos: vcc, neg: gnd }
      { id: "B1", kind: "battery", at: "mat:battery", props: { emf: 9, internalOhms: 1.5 }, locked: true },
      // pins { a: vcc, b: k1a }
      { id: "S1", kind: "pushbutton", at: "mat:button", locked: true },
      // pins { coilA: k1a, coilB: gnd, com: vcc, no: kno, nc: knc }
      {
        id: "K1",
        kind: "relay",
        at: "mat:relay",
        props: { coilOhms: 540, pullIn: 6.0, dropOut: 1.8, coilHenries: 0.3 },
        locked: true,
      },
    ],
    tray: [
      // D2: the LED catcher.
      { kind: "led", props: { color: "red" }, count: 1 },
      // D3: the protection diode.
      { kind: "diode", props: { model: "1N4001" }, count: 1 },
      { kind: "wire", count: 2 },
    ],
    instruments: ["meter"],
  },
  tasks: [
    {
      id: "watch-the-spike",
      prompt: "Press and release `S1` a few times, and watch the scope at the moment you let go.",
      // GOAL: a release was captured with min V(k1a) below -50 V, and a `spark` event fired on S1.
      goal: (lab) => releases(lab, "K1").length > 0 && !placed(lab, "D2") && !placed(lab, "D3"),
      hints: ["Set the trigger to catch the falling edge.", "The spike is very short. Use the fastest time base."],
      success:
        "Hundreds of volts, pointing the wrong way, from a 9 V battery. And a spark jumped across the button's contacts. They wear a little every time.",
    },
    {
      id: "led-catcher",
      prompt:
        "Put the red LED across the coil, backwards: its cathode on the coil's top end, its anode on ground. Press and release again.",
      // GOAL: D2 dark while S1 is held (glow < 0.05), D2 blips on release (peak glow > 0.1), and the scope minimum
      // stays above -5 V.
      goal: (lab) =>
        placed(lab, "D2") &&
        lab.part("D2")?.health !== "dead" &&
        releases(lab, "K1").length > 0 &&
        (closed(lab, "S1") ? glow(lab, "D2") < 0.05 : true),
      hints: ["Backwards means the LED's long leg goes to ground.", "Watch the LED at the moment you let go."],
      success:
        "The LED flashes as you let go, lit by current the coil pushed after the battery left. Your spike is gone, spent in the LED.",
    },
    {
      id: "diode-clamp",
      prompt: "Swap the LED for the 1N4001 diode, band toward the coil's positive end.",
      // GOAL: after a release, min V(k1a) >= -1.2 V with no `spark` event on that release, and K1 still clicks in and out.
      goal: (lab) =>
        placed(lab, "D3") &&
        !placed(lab, "D2") &&
        lab.part("D3")?.health === "ok" &&
        pullIns(lab, "K1").length > 0 &&
        releases(lab, "K1").length > 0 &&
        (closed(lab, "S1") ? (lab.part("D3")?.v ?? 0) < -1 : true),
      hints: ["The band marks the cathode. It goes to the side that's positive while the button is pressed."],
      success: "Clamped to under a volt. This diode lives across almost every relay coil in the world.",
    },
  ],
  // TODO(solution): bench actions that solve every task, once packages/bench defines anchors.
  solution: [],
});
