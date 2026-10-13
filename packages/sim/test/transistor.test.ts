import { describe, expect, test } from "vitest";
import { createSimulation, simulateFor } from "../src";
import { battery9, last, led, ledAstable, resistor, risingCrossings } from "./circuits";

describe("2N3904", () => {
  test("a 10 kΩ base resistor saturates the transistor driving an LED", () => {
    const s = last(
      simulateFor(
        {
          parts: [
            battery9(),
            resistor("RB", "vcc", "b", 10000),
            { id: "Q1", kind: "npn", pins: { c: "k", b: "b", e: "gnd" } },
            resistor("RL", "vcc", "a", 470),
            led("D1", "a", "k"),
          ],
        },
        0.1,
      ),
    );
    const q = s.parts.Q1!;
    expect(q.extra!.region).toBe("saturation");
    expect(q.v).toBeGreaterThan(0.05);
    expect(q.v).toBeLessThan(0.2);
    expect(s.parts.D1!.i).toBeGreaterThan(0.014);
    expect(s.parts.D1!.i).toBeLessThan(0.0155);
  });

  test("in the active region the current gain is 150 to 300", () => {
    const s = last(
      simulateFor(
        {
          parts: [
            battery9(),
            resistor("RB", "vcc", "b", 100000),
            { id: "Q1", kind: "npn", pins: { c: "vcc", b: "b", e: "e" } },
            led("D1", "e", "x"),
            resistor("RE", "x", "gnd", 100),
          ],
        },
        0.1,
      ),
    );
    expect(s.parts.Q1!.extra!.region).toBe("active");
    const beta = Number(s.parts.Q1!.extra!.beta);
    expect(beta).toBeGreaterThan(150);
    expect(beta).toBeLessThan(300);
  });

  test("each transistor has its own gain, fixed by its id", () => {
    const parts = (id: string) => [
      battery9(),
      resistor("RB", "vcc", "b", 680e3),
      { id, kind: "npn" as const, pins: { c: "c", b: "b", e: "gnd" } },
      resistor("RC", "vcc", "c", 100),
    ];
    const beta = (id: string) => Number(last(simulateFor({ parts: parts(id) }, 0.05)).parts[id]!.extra!.beta);
    const betas = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"].map(beta);
    expect(Math.min(...betas)).toBeGreaterThan(120);
    expect(Math.max(...betas)).toBeLessThan(300);
    expect(Math.max(...betas) - Math.min(...betas)).toBeGreaterThan(15);
    expect(beta("Q1")).toBe(betas[0]);
  });

  test("a phototransistor passes about 2 mA in full light, a trickle in the dark, and almost nothing reversed", () => {
    const circuit = (c: string, e: string, light: number) => ({
      parts: [battery9(), resistor("R1", "vcc", "p", 1000), { id: "PT", kind: "phototransistor" as const, pins: { c, e }, light }, resistor("R2", "q", "gnd", 100)],
    });
    const i = (c: string, e: string, light: number) => last(simulateFor(circuit(c, e, light), 0.1)).parts.R2!.i;
    expect(i("p", "q", 1)).toBeGreaterThan(1.8e-3);
    expect(i("p", "q", 1)).toBeLessThan(2.3e-3);
    expect(i("p", "q", 0)).toBeLessThan(1e-6);
    const rev = simulateFor(circuit("q", "p", 1), 0.2, { sampleEvery: 0.1 });
    expect(Math.abs(last(rev).parts.R2!.i)).toBeLessThan(5e-5);
    expect(rev.flatMap((x) => x.events).some((e) => e.type === "reversed")).toBe(true);
  });

  test("the LED astable blinks with half periods near 0.69 R C", () => {
    const R = 47e3;
    const C = 10e-6;
    const s = simulateFor(ledAstable(R, C), 4, { sampleEvery: 0.002 });
    const c1: [number, number][] = s.map((x) => [x.t, x.nodes.c1!]);
    const rises = risingCrossings(c1, 4.5).filter((t) => t > 0.5);
    expect(rises.length).toBeGreaterThanOrEqual(4);
    const period = (rises[rises.length - 1]! - rises[0]!) / (rises.length - 1);
    const half = period / 2;
    expect(Math.abs(half / (0.69 * R * C) - 1)).toBeLessThan(0.25);
    // The LEDs take turns (with a brief overlap while each coupling capacitor recharges through the other LED).
    const lit = s.filter((x) => x.t > 1).map((x) => [x.parts.D1!.glow! > 0.5, x.parts.D2!.glow! > 0.5]);
    expect(lit.filter(([a, b]) => a && !b).length).toBeGreaterThan(lit.length * 0.3);
    expect(lit.filter(([a, b]) => !a && b).length).toBeGreaterThan(lit.length * 0.3);
    expect(lit.filter(([a, b]) => a && b).length).toBeLessThan(lit.length * 0.2);
  });

  test("performance: one simulated second of the astable takes well under a second", () => {
    const sim = createSimulation();
    sim.load(ledAstable());
    sim.step(0.2);
    const t0 = performance.now();
    for (let k = 0; k < 30; k++) sim.step(1 / 30);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(250);
  });
});
