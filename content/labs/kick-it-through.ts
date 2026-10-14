// Blueprint: docs/curriculum/unit-2.md, Lessons 10 and 12 (blocking and coupling); conversion:
// docs/curriculum/conversion-guide.md, C2 lesson 12b. The lab of a bench lesson (docs/LESSONS.md):
// content/units/switching/capacitors/kick-it-through/lesson.yaml. One idea: in line, a capacitor passes a change and
// blocks a steady push. New part: the ceramic capacitor.
//
// Station A (rows 12 to 19): R1 (1 kΩ) from the + rail into row 12, the red LED D1 from row 12 to row 13, a yellow
// jumper on to row 17, and a socket in rows 17 and 19 (row 19 jumps to the minus rail), clear of the LED so the
// ceramic stays in sight. A white jumper first bridges the socket, so D1 glows. Station B (rows 30 to 44): button
// S2 puts plus on C2's + leg (row 32); C2's stripe (row 38) feeds R3 (1 kΩ) and the red LED D2. Reset button S3
// (rows 33 and 35, joined to row 32 by a yellow jumper on the far half) empties C2 through R4 (100 Ω, row 35 to row
// 38). The scope watches both of C2's legs.
//
// Measured in the simulator: through the bridged socket D1 glows (about 7 mA); with the 104 ceramic in its place D1
// stays dark, either way round (100 nF through 1 kΩ fills in a fraction of a millisecond). S2 gives one flash of about a quarter of a second, and none on the next press until S3
// empties C2. With the reset jumper gone, S3 does nothing.
import { defineLab, type LabView, type SolutionStep } from "@ohmland/lab";

const socketA = (lab: LabView, id: string) => lab.joins(id, "c17", "c19");
const bridged = (lab: LabView) => lab.connected("c17", "c19");
const flash = (lab: LabView) => lab.part("D2")?.glow ?? 0;
/** C2's voltage (0 when empty). */
const charge = (lab: LabView) => Math.abs(lab.part("C2")?.v ?? 0);
const resetPath = (lab: LabView) => lab.connected("C2.pos", "S3.a1");

/** The fix-it bench: the jumper that joins C2's plus row to the reset button is gone. */
const NO_RESET: SolutionStep[] = [{ do: "unwire", wire: "W6" }];

export default defineLab({
  id: "kick-it-through",
  title: "One flash per press",
  bench: {
    board: "full",
    frame: ["desk:-56,-30", "desk:36,52"],
    parts: [
      { id: "B1", kind: "battery", at: "desk:-116,-46", holes: { pos: "rail+:3", neg: "rail-:3" }, params: { snap: true, emf: 9, internalOhms: 1.5 }, locked: true, label: "9 V battery" },
      // Station A: blocking.
      { id: "R1", kind: "resistor", at: "rail+:12-b12", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R1" },
      { id: "D1", kind: "led", at: "d12", params: { color: "red" }, locked: true, label: "Red LED D1" },
      // Station B: coupling.
      { id: "S2", kind: "pushbutton", at: "e30", params: { cap: "black" }, locked: true, label: "Button S2" },
      { id: "C2", kind: "electrolytic-cap", at: "c32-c38", params: { farads: 100e-6, volts: 16 }, locked: true, label: "100 µF capacitor C2" },
      { id: "R3", kind: "resistor", at: "b38-b43", params: { ohms: 1000 }, locked: true, label: "1 kΩ resistor R3" },
      { id: "D2", kind: "led", at: "d43", params: { color: "red" }, locked: true, label: "Red LED D2" },
      { id: "S3", kind: "pushbutton", at: "e33", params: { cap: "white" }, locked: true, label: "Reset button S3" },
      { id: "R4", kind: "resistor", at: "d35-d38", params: { ohms: 100 }, locked: true, label: "100 Ω resistor R4" },
      // On the desk, ready to meet.
      { id: "CA", kind: "ceramic-cap", at: "desk:-30,44", params: { farads: 100e-9 }, label: "104 ceramic capacitor CA" },
    ],
    wires: [
      { id: "W0", from: "a13", to: "a17", color: "yellow" },
      { id: "W1", from: "a19", to: "rail-:19", color: "black" },
      // Bridges the socket until the ceramic takes its place.
      { id: "W2", from: "e17", to: "e19", color: "white" },
      { id: "W3", from: "a30", to: "rail+:30", color: "red" },
      { id: "W5", from: "a44", to: "rail-:44", color: "black" },
      { id: "W6", from: "g32", to: "g33", color: "yellow" },
    ],
    tray: [],
    instruments: [
      { kind: "scope", traces: [{ label: "C2 + leg", volts: "C2.pos" }, { label: "C2 stripe", volts: "C2.neg" }], window: 4, range: [-1, 10] },
    ],
  },
  mascot: {
    hint: "Watch what happens at the moment something changes.",
    fried: "Oof. That one's for the Hall.",
  },
  tasks: [
    {
      id: "ceramic-blocks",
      prompt: "Swap the white wire for the ceramic. Watch D1.",
      goal: (lab) => lab.heldFor(1, socketA(lab, "CA") && !bridged(lab) && !lab.isLit("D1", 0.02)),
      hints: ["Take the white wire out of rows 17 and 19.", "Then push the ceramic into rows 17 and 19, either way round."],
      highlight: ["wire:W2", "CA"],
      nudges: [{ when: (lab) => socketA(lab, "CA") && bridged(lab), say: "The white wire still bridges it. Take it out." }],
      success: "Dark.",
    },
    {
      id: "one-flash",
      prompt: "Press and hold S2 for three seconds.",
      goal: (lab) => {
        const m = lab.memory as { from?: number };
        if (!lab.closed("S2")) {
          m.from = charge(lab) < 1 ? lab.t : undefined;
          return false;
        }
        if (m.from === undefined || lab.t - m.from < 2) return false;
        const held = lab.t - m.from;
        return lab.history("glow:D2", held).some(([, g]) => g > 0.3) && lab.timeAbove("glow:D2", 0.3, held) < 0.6;
      },
      hints: ["Keep holding, and keep watching D2."],
      highlight: ["S2"],
      success: "A flash, then dark.",
    },
    {
      id: "no-encore",
      prompt: "Press S2 again. Then press the white reset button and try once more.",
      goal: (lab) => {
        const m = lab.memory as { phase?: number; at?: number; peak?: number };
        const press = lab.closed("S2");
        if (press) {
          if (m.at === undefined) {
            m.at = lab.t;
            m.peak = 0;
            if (m.phase === undefined) m.phase = charge(lab) > 5 ? 0 : -1;
          }
          m.peak = Math.max(m.peak ?? 0, flash(lab));
          return m.phase === 2 && (m.peak ?? 0) > 0.3;
        }
        if (m.at !== undefined) {
          // A press just ended.
          if (m.phase === 0 && (m.peak ?? 1) < 0.15) m.phase = 1;
          else if (m.phase === -1) delete m.phase;
          delete m.at;
        }
        if (m.phase === 1 && lab.closed("S3")) m.phase = 2;
        return false;
      },
      hints: ["What's left in C2 after the first press?", "The white button empties C2. Press it, then S2."],
      highlight: ["S3"],
      success: "A fresh change, a fresh flash.",
    },
    {
      id: "fix-reset",
      prompt: "My button flashes once, then never again. Fix it.",
      setup: NO_RESET,
      // Cut off first (the setup), then joined, emptied with S3, and flashing again.
      goal: (lab) => {
        const m = lab.memory as { cut?: boolean; reset?: boolean };
        if (!resetPath(lab)) {
          m.cut = true;
          m.reset = false;
          return false;
        }
        if (!m.cut) return false;
        if (lab.closed("S3") && charge(lab) < 1) m.reset = true;
        return m.reset === true && lab.closed("S2") && flash(lab) > 0.3;
      },
      hints: ["Press the white button. Does C2 empty?", "Pick Wire, then join row 33 to C2's plus row, 32."],
      highlight: ["S3", "hole:g32", "hole:g33"],
      success: "Fixed.",
    },
  ],
  solution: [
    { do: "unwire", wire: "W2" },
    { do: "move", part: "CA", at: "c17-c19" },
    { do: "wait", seconds: 1.5 },
    { do: "check", task: "ceramic-blocks" },
    { do: "press", part: "S2", seconds: 3 },
    { do: "check", task: "one-flash" },
    // "Show me" starts with C2 empty: one press fills it (the flash), then the no-encore press and the reset.
    { do: "press", part: "S2", seconds: 3 },
    { do: "wait", seconds: 0.5 },
    { do: "press", part: "S2", seconds: 1 },
    { do: "press", part: "S3", seconds: 0.6 },
    { do: "press", part: "S2", seconds: 1 },
    { do: "check", task: "no-encore" },
    ...NO_RESET,
    { do: "press", part: "S2", seconds: 1 },
    { do: "wire", id: "W7", from: "h32", to: "h33", color: "yellow" },
    { do: "press", part: "S3", seconds: 0.6 },
    { do: "press", part: "S2", seconds: 1 },
    { do: "check", task: "fix-reset" },
  ],
});
