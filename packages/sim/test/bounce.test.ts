import { describe, expect, test } from "vitest";
import { createSimulation, type InputValue, type Netlist } from "../src";
import { battery9, resistor } from "./circuits";

const button = (bounce?: InputValue): Netlist => ({
  parts: [battery9(), resistor("R1", "vcc", "a", 1000), { id: "S1", kind: "pushbutton", pins: { a: "a", b: "gnd" }, ...(bounce === undefined ? {} : { bounce: bounce as boolean }) }],
});

/** Times (after the actuation) at which the contact changed, sampled every 5 µs for 15 ms. */
function flips(net: Netlist, id: string, key: "pressed" | "to", value: InputValue, read: (s: ReturnType<ReturnType<typeof createSimulation>["step"]>) => boolean, sim = createSimulation()): number[] {
  if (sim.time === 0) {
    sim.load(net);
    sim.step(0.01);
  }
  const t0 = sim.time;
  sim.setInput(id, key, value);
  let state = read(sim.snapshot());
  const out: number[] = [0];
  for (let k = 0; k < 3000; k++) {
    const s = sim.step(5e-6);
    const now = read(s);
    if (now !== state) {
      out.push(s.t - t0);
      state = now;
    }
  }
  return out;
}

describe("contact bounce", () => {
  const closed = (s: { parts: Record<string, { closed?: boolean }> }) => s.parts.S1!.closed === true;

  test("without bounce a button makes and breaks once", () => {
    expect(flips(button(), "S1", "pressed", true, closed)).toEqual([0]);
  });

  test("with bounce it chatters for 1 to 5 ms on make, ends closed, and less on break", () => {
    const sim = createSimulation();
    const make = flips(button(true), "S1", "pressed", true, closed, sim);
    expect(make.length).toBeGreaterThanOrEqual(7); // the first touch, then at least three rebounds
    expect(make.length % 2).toBe(1); // ends in the new state
    expect(make[make.length - 1]!).toBeGreaterThan(0.8e-3);
    expect(make[make.length - 1]!).toBeLessThan(5.1e-3);
    expect(sim.snapshot().parts.S1!.closed).toBe(true);
    const brk = flips(button(true), "S1", "pressed", false, closed, sim);
    expect(brk.length).toBeGreaterThanOrEqual(3);
    expect(brk.length).toBeLessThan(make.length);
    expect(sim.snapshot().parts.S1!.closed).toBe(false);
  });

  test("chatter is seeded: the same run repeats, the next press differs, a number caps its length", () => {
    const a = flips(button(true), "S1", "pressed", true, closed);
    const b = flips(button(true), "S1", "pressed", true, closed);
    expect(a).toEqual(b);
    const sim = createSimulation();
    const first = flips(button(true), "S1", "pressed", true, closed, sim);
    flips(button(true), "S1", "pressed", false, closed, sim);
    const second = flips(button(true), "S1", "pressed", true, closed, sim);
    expect(second).not.toEqual(first);
    const short = flips(button(1), "S1", "pressed", true, closed);
    expect(short[short.length - 1]!).toBeLessThan(1.05e-3);
  });

  test("bounce can be switched on live", () => {
    const sim = createSimulation();
    sim.load(button());
    sim.step(0.01);
    sim.setInput("S1", "bounce", true);
    expect(flips(button(), "S1", "pressed", true, closed, sim).length).toBeGreaterThan(3);
  });

  test("a changeover switch leaves its old throw cleanly and only chatters on the new one", () => {
    const net: Netlist = {
      parts: [
        battery9(),
        { id: "SW", kind: "spdt", pins: { com: "vcc", a: "a", b: "b" }, to: "a", bounce: true },
        resistor("RA", "a", "gnd", 1000),
        resistor("RB", "b", "gnd", 1000),
      ],
    };
    const sim = createSimulation();
    sim.load(net);
    sim.step(0.01);
    const aHigh: boolean[] = [];
    const bFlips = flips(net, "SW", "to", "b", (s) => {
      aHigh.push(s.nodes.a! > 4.5);
      return s.nodes.b! > 4.5;
    }, sim);
    // The old throw opens at once and never recloses.
    expect(aHigh.slice(1).every((v) => !v)).toBe(true);
    // The pole travels for a moment, then chatters on b and ends there.
    expect(bFlips[1]!).toBeGreaterThan(0.4e-3);
    expect(bFlips.length).toBeGreaterThanOrEqual(7);
    expect(bFlips.length % 2).toBe(0);
  });
});
