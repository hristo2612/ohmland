import { describe, expect, test } from "vitest";
import { createSimulation, simulateFor, type PartSpec } from "../src";
import { allEvents, battery9, last, relayBuzzer, resistor } from "./circuits";

const stiffSource: PartSpec = { id: "S", kind: "cell", pins: { pos: "vcc", neg: "gnd" }, emf: 9, internalOhms: 0.001 };
const rc = (R: number, C: number): PartSpec[] => [
  resistor("R1", "vcc", "c", R),
  { id: "C1", kind: "capacitor", pins: { pos: "c", neg: "gnd" }, farads: C },
];

/** Contact changes per second, from the relay's click counter. */
function clickRate(capFarads: number, seconds: number): number {
  const sim = createSimulation();
  sim.load(relayBuzzer(capFarads));
  sim.step(seconds / 4); // let it settle into its rhythm
  const c0 = Number(sim.snapshot().parts.K1!.extra!.clicks);
  const s = sim.step(seconds);
  return (Number(s.parts.K1!.extra!.clicks) - c0) / seconds;
}

describe("transients", () => {
  test("RC charge reaches 63% at one time constant", () => {
    const s = simulateFor({ parts: [stiffSource, ...rc(1000, 1e-3)] }, 5, { sampleEvery: 0.5 });
    const at1 = s.find((x) => Math.abs(x.t - 1) < 1e-9)!;
    expect(at1.nodes.c! / 9).toBeGreaterThan(0.625);
    expect(at1.nodes.c! / 9).toBeLessThan(0.64);
    expect(last(s).nodes.c! / 9).toBeGreaterThan(0.99);
  });

  test("rebuilding keeps a capacitor's charge, then it discharges along the same curve", () => {
    const sim = createSimulation();
    sim.load({ parts: [stiffSource, ...rc(1000, 1e-3)] });
    const v1 = sim.step(1).nodes.c!;
    // Battery removed: nothing to discharge through, the charge stays.
    sim.load({ parts: rc(1000, 1e-3) });
    expect(sim.step(0.5).nodes.c).toBeCloseTo(v1, 4);
    // A 1 kΩ across it: one time constant later about 37% is left.
    sim.load({ parts: [{ id: "C1", kind: "capacitor", pins: { pos: "c", neg: "gnd" }, farads: 1e-3 }, resistor("R2", "c", "gnd", 1000)] });
    const v2 = sim.step(1).nodes.c!;
    expect(v2 / v1).toBeGreaterThan(0.36);
    expect(v2 / v1).toBeLessThan(0.375);
  });

  test("a relay that switches its own coil buzzes, and a big capacitor slows it to a few hertz", () => {
    const fast = clickRate(0, 0.4) / 2;
    expect(fast).toBeGreaterThan(20);
    expect(fast).toBeLessThan(150);
    const slow = clickRate(1000e-6, 4) / 2;
    expect(slow).toBeGreaterThan(0.3);
    expect(slow).toBeLessThan(5);
  });

  test("clicks are reported as events, merged per snapshot", () => {
    const s = simulateFor(relayBuzzer(0), 0.3, { sampleEvery: 0.1 });
    const clicks = allEvents(s).filter((e) => e.type === "clicked");
    expect(clicks.length).toBeLessThanOrEqual(3);
    expect(Number(clicks[clicks.length - 1]!.data!.count)).toBeGreaterThan(5);
  });

  test("interrupting a relay coil's current gives an inductive kickback", () => {
    const sim = createSimulation();
    sim.load({
      parts: [
        battery9(),
        { id: "S1", kind: "switch", pins: { a: "vcc", b: "ca" }, closed: true },
        { id: "K1", kind: "relay", pins: { coilA: "ca", coilB: "gnd", com: "x", no: "y", nc: "z" }, coilOhms: 540, pullIn: 6.75, dropOut: 2.7 },
      ],
    });
    expect(sim.step(0.05).parts.K1!.closed).toBe(true);
    let minV = 0;
    for (let k = 0; k < 40; k++) {
      if (k === 1) sim.setInput("S1", "closed", false);
      minV = Math.min(minV, sim.step(2e-6).nodes.ca!);
    }
    expect(minV).toBeLessThan(-50);
    expect(sim.step(0.02).parts.K1!.closed).toBe(false);
  });
});
