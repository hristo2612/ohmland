import { describe, expect, test } from "vitest";
import { simulateFor, type LedColor } from "../src";
import { allEvents, battery9, last, led, resistor } from "./circuits";

describe("DC operating points", () => {
  test("voltage divider", () => {
    const s = last(
      simulateFor(
        {
          parts: [
            { id: "B1", kind: "battery", pins: { pos: "vcc", neg: "gnd" }, emf: 9, internalOhms: 0.5 },
            resistor("R1", "vcc", "mid", 1000),
            resistor("R2", "mid", "gnd", 2000),
          ],
        },
        0.1,
      ),
    );
    expect(s.nodes.mid).toBeCloseTo((9 * 2000) / 3000.5, 2);
    expect(s.parts.R1!.i).toBeCloseTo(9 / 3000.5, 5);
    expect(s.parts.R2!.p).toBeCloseTo(s.nodes.mid! ** 2 / 2000, 6);
  });

  test("red LED with 470 Ω on 9 V: about 15 mA at about 1.95 V", () => {
    const s = last(simulateFor({ parts: [battery9(), resistor("R1", "vcc", "a", 470), led("D1", "a", "gnd")] }, 0.5));
    const d = s.parts.D1!;
    expect(d.i).toBeGreaterThan(0.014);
    expect(d.i).toBeLessThan(0.016);
    expect(d.v).toBeGreaterThan(1.9);
    expect(d.v).toBeLessThan(2.0);
    expect(d.glow!).toBeGreaterThan(0.8);
    expect(d.glow!).toBeLessThan(0.9);
    expect(d.health).toBe("ok");
  });

  test.each([
    ["red", 2.0],
    ["orange", 2.05],
    ["yellow", 2.1],
    ["green", 2.2],
    ["blue", 3.1],
    ["white", 3.1],
  ] as [LedColor, number][])("%s LED drops about %f V at 20 mA", (color, vf) => {
    // 10 Ω from an ideal-ish source set for exactly 20 mA if Vf is right; 0.6 mA error means about 10 mV.
    const s = last(
      simulateFor(
        {
          parts: [
            { id: "S", kind: "cell", pins: { pos: "p", neg: "gnd" }, emf: vf + 0.2, internalOhms: 0.001 },
            resistor("R1", "p", "a", 10),
            led("D1", "a", "gnd", color),
          ],
        },
        0.1,
      ),
    );
    expect(Math.abs(s.parts.D1!.i - 0.02)).toBeLessThan(0.0006);
  });

  test("an LED straight across a 9 V battery dies in a blink", () => {
    const s = simulateFor({ parts: [battery9(), led("D1", "vcc", "gnd")] }, 0.2, { sampleEvery: 0.01 });
    const died = allEvents(s).find((e) => e.type === "died");
    expect(died).toBeDefined();
    expect(died!.t).toBeLessThan(0.05);
    expect(died!.message).toMatch(/resistor/);
    expect(allEvents(s).some((e) => e.type === "damaged")).toBe(false);
    const d = last(s).parts.D1!;
    expect(d.health).toBe("dead");
    expect(d.glow).toBe(0);
    expect(Math.abs(d.i)).toBeLessThan(1e-6);
  });

  test("four fruit cells light an LED faintly but visibly", () => {
    const cells = [0, 1, 2, 3].map((k) => ({
      id: `F${k}`,
      kind: "cell" as const,
      pins: { pos: `n${k + 1}`, neg: k === 0 ? "gnd" : `n${k}` },
      emf: 0.9,
      internalOhms: 1000,
    }));
    const s = last(simulateFor({ parts: [...cells, led("D1", "n4", "gnd")] }, 0.3));
    expect(s.parts.D1!.i).toBeGreaterThan(0.0003);
    expect(s.parts.D1!.i).toBeLessThan(0.0007);
    expect(s.parts.D1!.glow!).toBeGreaterThan(0.15);
    expect(s.parts.D1!.glow!).toBeLessThan(0.4);
  });

  test("a reversed LED stays dark and reports it", () => {
    const s = simulateFor({ parts: [battery9(), resistor("R1", "vcc", "a", 470), led("D1", "gnd", "a")] }, 0.3);
    expect(last(s).parts.D1!.glow).toBe(0);
    expect(Math.abs(last(s).parts.D1!.i)).toBeLessThan(1e-4);
    expect(allEvents(s).some((e) => e.type === "reversed")).toBe(true);
  });

  test("a shorted 9 V battery sags to about 2 A, heats, and partly recovers", () => {
    const short = { parts: [battery9("B1", "vcc", "gnd", 9.5), resistor("W", "vcc", "gnd", 0.05, 50)] };
    const s = simulateFor(short, 3, { sampleEvery: 0.5 });
    const out = (k: number) => Number(s[k]!.parts.B1!.extra!.out);
    expect(out(0)).toBeGreaterThan(out(5));
    expect(out(5)).toBeGreaterThan(1.5);
    expect(out(5)).toBeLessThan(2.2);
    expect(allEvents(s).some((e) => e.type === "shorted")).toBe(true);
    expect(last(s).parts.B1!.temp).toBeGreaterThan(27);
  });

  test("wires merge nodes and report their current", () => {
    const s = last(
      simulateFor(
        { parts: [battery9(), { id: "W1", kind: "wire", pins: { a: "vcc", b: "x" } }, resistor("R1", "x", "gnd", 900)] },
        0.1,
      ),
    );
    expect(s.nodes.x).toBeCloseTo(s.nodes.vcc!, 9);
    expect(s.parts.W1!.i).toBeCloseTo(s.parts.R1!.i, 9);
  });
});
