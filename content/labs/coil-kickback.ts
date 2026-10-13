// Blueprint: docs/curriculum/unit-2.md, Lesson 6. Button S1 feeds the relay's coil from B1 (desk modules and clip
// leads). The coil has 0.3 H, so letting go of S1 with nothing across the coil drives the button's opening contacts
// to about 300 V: they arc (a `spark` event, a little wear) and the coil's top end dives to about -290 V. The scope's
// single shot catches it at a fast time base. Then a red LED, and finally a 1N4001 diode, go across the coil
// backwards and catch the current instead: the LED blips, the diode clamps the coil to under a volt.
import { defineLab, type LabView } from "@ohmland/lab";

/**
 * Watches press-and-release cycles of S1 while `ok` holds (the catcher is in place). Returns true once a release has
 * happened with no spark, after a press during which `heldOk` held, and `afterOk` held within 0.4 s of letting go.
 */
function cleanRelease(lab: LabView, ok: boolean, heldOk: boolean, afterOk: (since: number) => boolean): boolean {
  const mem = lab.memory as { pressed?: number; heldOk?: boolean; released?: number };
  if (!ok) {
    delete mem.pressed;
    delete mem.released;
    return false;
  }
  if (lab.closed("S1")) {
    mem.pressed ??= lab.t;
    mem.heldOk = (mem.heldOk ?? true) && heldOk;
    delete mem.released;
    return false;
  }
  if (mem.pressed === undefined) return false;
  mem.released ??= lab.t;
  const since = mem.released;
  if (lab.events.some((e) => e.type === "spark" && e.partId === "S1" && e.t >= since - 0.05)) {
    delete mem.pressed;
    return false;
  }
  if (lab.t - since < 0.15) return false;
  const pass = !!mem.heldOk && afterOk(since);
  if (!pass && lab.t - since > 0.5) {
    delete mem.pressed;
    delete mem.heldOk;
  }
  return pass;
}

const across = (lab: LabView, id: string) => lab.joins(id, "K1.coil2", "K1.coil1", "forward");

export default defineLab({
  id: "coil-kickback",
  title: "The coil kicks back",
  bench: {
    board: "none",
    parts: [
      { id: "B1", kind: "battery", at: "desk:-120,8", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "desk:-60,-38", params: { base: true, cap: "red", tag: "S1" }, locked: true, label: "Button S1" },
      { id: "K1", kind: "relay", at: "desk:6,-36", params: { base: true, tag: "K1", poles: 1, coilOhms: 540, pullIn: 6.0, dropOut: 1.8, coilHenries: 0.3 }, locked: true, label: "Relay K1" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.a1", color: "red", locked: true },
      { id: "TL2", from: "S1.b1", to: "K1.coil1", color: "yellow", locked: true },
      { id: "TL3", from: "K1.coil2", to: "B1.neg", color: "black", locked: true },
    ],
    tray: [
      { id: "D2", kind: "led", params: { color: "red" }, count: 1, label: "Red LED" },
      { id: "D3", kind: "diode", params: { model: "1N4001" }, count: 1, label: "1N4001 diode" },
      { kind: "lead", params: { color: "green" }, count: 2 },
    ],
    instruments: [{ kind: "scope", traces: [{ label: "Coil top end", volts: "K1.coil1" }], window: 3, capture: { ms: 2, edge: "off" } }],
  },
  mascot: {
    start: "A coil has a stubborn streak. Let's catch it in the act.",
    hint: "Arm the single shot, then let go of the button.",
    success: "That spark was the coil saying not so fast!",
    fried: "Forwards, it's a shortcut around the coil. It has to face backwards.",
    exit: "Band toward positive. Say it with me.",
  },
  fried: { led: "Red LED, forwards across a relay coil", diode: "1N4001, forwards across a relay coil" },
  tasks: [
    {
      id: "watch-the-spike",
      prompt: "Press **Single shot** on the scope, then press and release S1. Watch the scope at the moment you let go.",
      goal: (lab) => lab.events.some((e) => e.type === "spark" && e.partId === "S1" && Number(e.data?.["volts"] ?? 0) >= 59),
      hints: ["The single shot waits for you to let go of the button, then records 2 ms of it.", "The spike lasts only a few microseconds. Look at the far left of the screen."],
      highlight: ["S1"],
      success: "Hundreds of volts, pointing the wrong way, from a 9 V battery. And a spark jumped across the button's contacts.",
      notice: "Each spark wears the contacts a little. Real switches age this way.",
    },
    {
      id: "led-catcher",
      prompt: "Put the red LED across the coil, backwards: its **short leg** (cathode) on the coil's top end, its **long leg** (anode) on the coil's other end. Press and release again.",
      goal: (lab) =>
        cleanRelease(lab, across(lab, "D2") && !lab.died("D2"), (lab.part("D2")?.glow ?? 0) < 0.05, (since) =>
          lab.history("glow:D2", lab.t - since + 0.02).some(([, g]) => g > 0.1),
        ),
      hints: ["Backwards means the long leg goes to the end that's at minus when the button is pressed.", "Watch the LED at the moment you let go."],
      highlight: ["pin:K1.coil1", "pin:K1.coil2"],
      success: "The LED flashes when you let go, lit by current the coil pushed after the battery left. Your spike is gone.",
      notice: "Energy stored in the coil's magnetic field lit the LED.",
      mascot: { success: "The LED glowed with leftover magnetism. Spooky, right?" },
    },
    {
      id: "diode-clamp",
      prompt: "Swap the LED for the 1N4001 diode, its **band** (cathode) toward the coil's top end. Press and release again.",
      goal: (lab) => {
        if (lab.part("D3")?.health !== "ok") return false;
        const clicks = lab.events.filter((e) => e.type === "clicked" && e.partId === "K1");
        return cleanRelease(lab, across(lab, "D3") && !across(lab, "D2"), true, (since) => clicks.some((e) => e.data?.["to"] === "no") && clicks.some((e) => e.data?.["to"] === "nc" && e.t >= since - 0.05));
      },
      hints: ["The band marks the cathode. It goes to the side that's positive while the button is pressed."],
      highlight: ["pin:K1.coil1"],
      success: "Clamped to under a volt. This diode lives across almost every relay coil in the world.",
      mascot: { success: "Backwards diode, happy coil." },
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 0.5 },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "watch-the-spike" },
    { do: "place", part: "D2", kind: "led", at: "desk:62,30", params: { color: "red" } },
    { do: "lead", id: "TL4", from: "K1.coil1", to: "D2.cathode", color: "green" },
    { do: "lead", id: "TL5", from: "D2.anode", to: "K1.coil2", color: "green" },
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "led-catcher" },
    { do: "place", part: "D3", kind: "diode", at: "desk:62,52", params: { model: "1N4001" } },
    { do: "clip", lead: "TL4", end: "b", to: "D3.cathode" },
    { do: "clip", lead: "TL5", end: "a", to: "D3.anode" },
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "diode-clamp" },
  ],
});
