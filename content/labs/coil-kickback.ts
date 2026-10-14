// Blueprint: docs/curriculum/unit-2.md, Lesson 6; a bench lesson (docs/LESSONS.md):
// content/units/switching/relays/coil-kickback. One idea: cutting a coil's flow makes a big backwards spike. New: the
// scope. Button S1 feeds the relay's coil from B1 (desk modules and clip leads). The coil has 0.3 H, so letting go of
// S1 with nothing across the coil drives the button's opening contacts to about 300 V: they arc (a `spark` event, a
// little wear) and the coil's top end dives to about -290 V. The scope's single shot catches it at a fast time base.
// Then a red LED goes across the coil backwards and catches the current instead: it blips on release. The diode that
// does this job for real moved to the-diode.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

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
const ledCatches = (lab: LabView) =>
  cleanRelease(lab, across(lab, "D2") && !lab.died("D2"), (lab.part("D2")?.glow ?? 0) < 0.05, (since) => lab.history("glow:D2", lab.t - since + 0.02).some(([, g]) => g > 0.1));

/** The fix-it bench: the LED catcher's anode clip has come off the coil. */
const LOOSE_CATCHER: SolutionStep[] = [{ do: "clip", lead: "TL5", end: "b", to: null }];

export default defineLab({
  id: "coil-kickback",
  title: "The coil kicks back",
  bench: {
    board: "none",
    frame: ["desk:-150,-70", "desk:110,70"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-112,8", rot: 270, params: { emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      { id: "S1", kind: "pushbutton", at: "desk:66,-40", params: { base: true, cap: "red", tag: "S1" }, locked: true, label: "Button S1" },
      { id: "K1", kind: "relay", at: "desk:-14,-38", params: { base: true, tag: "K1", poles: 1, coilOhms: 540, pullIn: 6.0, dropOut: 1.8, coilHenries: 0.3 }, locked: true, label: "Relay K1" },
    ],
    leads: [
      { id: "TL1", from: "B1.pos", to: "S1.a1", color: "red", locked: true },
      { id: "TL2", from: "S1.b1", to: "K1.coil1", color: "yellow", locked: true },
      { id: "TL3", from: "K1.coil2", to: "B1.neg", color: "black", locked: true },
    ],
    tray: [
      { id: "D2", kind: "led", params: { color: "red" }, count: 1, label: "Red LED" },
      { kind: "lead", params: { color: "green" }, count: 2 },
    ],
    instruments: [{ kind: "scope", traces: [{ label: "Coil top end", volts: "K1.coil1" }], window: 3, capture: { ms: 2, edge: "off" } }],
  },
  mascot: {
    hint: "Arm the single shot, then let go of the button.",
    fried: "Forwards, it's a shortcut around the coil. It has to face backwards.",
  },
  fried: { led: "Red LED, forwards across a relay coil" },
  tasks: [
    {
      id: "watch-the-spike",
      prompt: "Press **Arm** on the scope, then press and release S1.",
      goal: (lab) => lab.events.some((e) => e.type === "spark" && e.partId === "S1" && Number(e.data?.["volts"] ?? 0) >= 59),
      hints: ["Arm waits for you to let go, then records 2 ms.", "The spike lasts a blink: look at the far left."],
      highlight: ["S1"],
      success: "Hundreds of volts, backwards!",
    },
    {
      id: "led-catcher",
      prompt: "Put the red LED across the coil, backwards. Press and release again.",
      goal: ledCatches,
      hints: ["Short leg on the coil's top end (yellow), long leg on the other.", "Watch the LED at the moment you let go."],
      highlight: ["pin:K1.coil1", "pin:K1.coil2"],
      nudges: [{ when: (lab) => lab.joins("D2", "K1.coil1", "K1.coil2", "forward"), say: "Careful: forwards, it shorts the battery. Flip it." }],
      success: "A blink on release.",
    },
    {
      id: "fix-catcher",
      prompt: "Catch the spike again.",
      setup: LOOSE_CATCHER,
      // Broken first (the catcher hanging off, as set up), then a clean release with the LED blinking.
      goal: (lab) => {
        if (!across(lab, "D2")) lab.memory["loose"] = true;
        return lab.memory["loose"] === true && ledCatches(lab);
      },
      hints: ["Is the LED really across the coil? Follow both its clips.", "Clip the loose green lead back onto the coil's other end."],
      highlight: ["TL5"],
      success: "Caught again. No spark.",
    },
  ],
  solution: [
    { do: "press", part: "S1", seconds: 0.5 },
    { do: "wait", seconds: 0.3 },
    { do: "check", task: "watch-the-spike" },
    { do: "place", part: "D2", kind: "led", at: "desk:40,34", params: { color: "red" } },
    { do: "lead", id: "TL4", from: "K1.coil1", to: "D2.cathode", color: "green" },
    { do: "lead", id: "TL5", from: "D2.anode", to: "K1.coil2", color: "green" },
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "led-catcher" },
    ...LOOSE_CATCHER,
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.4 },
    { do: "clip", lead: "TL5", end: "b", to: "K1.coil2" },
    { do: "press", part: "S1", seconds: 0.6 },
    { do: "wait", seconds: 0.4 },
    { do: "check", task: "fix-catcher" },
  ],
});
