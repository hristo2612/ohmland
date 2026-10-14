import { describe, expect, test } from "vitest";
import { createSimulation, simulateFor, type Netlist } from "../src";
import { allEvents, battery9, led, resistor } from "./circuits";

describe("inductor", () => {
  test("current builds up with time constant L / R, limited in the end only by resistance", () => {
    const net: Netlist = {
      parts: [
        { id: "S", kind: "cell", pins: { pos: "vcc", neg: "gnd" }, emf: 9, internalOhms: 0.001 },
        resistor("R1", "vcc", "a", 90),
        { id: "L1", kind: "inductor", pins: { a: "a", b: "gnd" }, henries: 1, ohms: 10 },
      ],
    };
    const sim = createSimulation();
    sim.load(net);
    const i1 = sim.step(0.01).parts.L1!.i; // one time constant (1 H / 100 Ω)
    expect(i1 / 0.09).toBeGreaterThan(0.62);
    expect(i1 / 0.09).toBeLessThan(0.645);
    const s = sim.step(0.1);
    expect(s.parts.L1!.i).toBeCloseTo(0.09, 4);
    expect(Number(s.parts.L1!.extra!.energy)).toBeCloseTo(0.5 * 1 * 0.09 * 0.09, 5);
  });

  test("two LEDs facing opposite ways across a coil: one lights on press, the other flashes on release", () => {
    const net: Netlist = {
      parts: [
        battery9(),
        { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "p" } },
        resistor("R1", "p", "a", 220),
        { id: "L1", kind: "inductor", pins: { a: "a", b: "gnd" }, henries: 2, ohms: 20 },
        led("D1", "a", "gnd"),
        led("D2", "gnd", "a", "green"),
      ],
    };
    const s = simulateFor(net, 0.6, {
      sampleEvery: 0.005,
      actions: [
        { t: 0.05, id: "S1", key: "pressed", value: true },
        { t: 0.3, id: "S1", key: "pressed", value: false },
      ],
    });
    const at = (t: number) => s.find((x) => Math.abs(x.t - t) < 1e-9)!;
    // On press the coil holds the current back, so D1 lights, then fades as the coil takes over.
    expect(at(0.06).parts.D1!.glow).toBeGreaterThan(0.5);
    expect(at(0.28).parts.D1!.glow).toBeLessThan(0.3);
    // On release the coil keeps its current going round through D2.
    expect(at(0.31).parts.D2!.glow).toBeGreaterThan(0.3);
    expect(at(0.06).parts.D2!.glow).toBe(0);
    // The LED clamps the kick: no spark at the button.
    expect(allEvents(s).some((e) => e.type === "spark")).toBe(false);
  });

  test("a coil straight across a battery is nearly a short: it gets hot", () => {
    const s = simulateFor({ parts: [battery9(), { id: "L1", kind: "inductor", pins: { a: "vcc", b: "gnd" }, henries: 0.01, ohms: 0.4, watts: 1 }] }, 20, { sampleEvery: 1 });
    const coil = s[s.length - 1]!.parts.L1!;
    expect(coil.health).not.toBe("ok");
    expect(coil.temp).toBeGreaterThan(100);
    expect(allEvents(s).some((e) => e.partId === "B1" && e.type === "shorted")).toBe(true);
  });
});
