import { describe, expect, test } from "vitest";
import { createSimulation, formatReading, simulateFor, type PartSpec } from "../src";
import { allEvents, battery9, last, led, meter, resistor } from "./circuits";

const read = (parts: PartSpec[], seconds = 0.5) => last(simulateFor({ parts }, seconds)).parts.M1!;

describe("multimeter", () => {
  test("in series on the mA socket it reads the current, minus a little burden", () => {
    const without = last(simulateFor({ parts: [battery9(), resistor("R1", "vcc", "a", 470), led("D1", "a", "gnd")] }, 0.5)).parts.D1!.i;
    const m = read([battery9(), resistor("R1", "vcc", "a", 470), led("D1", "a", "m"), meter("M1", { com: "gnd", ma: "m" }, "dca-ma")]);
    expect(m.unit).toBe("mA");
    expect(m.extra!.range).toBe("20mA");
    const shown = Number(m.display);
    expect(shown).toBeCloseTo(m.i * 1000, 1);
    expect(shown / 1000).toBeLessThan(without);
    expect(shown / 1000).toBeGreaterThan(without * 0.97);
  });

  test("as a voltmeter (10 MΩ) it barely loads a 100 kΩ divider", () => {
    const parts = [
      { id: "S", kind: "cell", pins: { pos: "vcc", neg: "gnd" }, emf: 9, internalOhms: 0.001 } as PartSpec,
      resistor("R1", "vcc", "mid", 100e3),
      resistor("R2", "mid", "gnd", 100e3),
    ];
    const m = read([...parts, meter("M1", { com: "gnd", vohm: "mid" }, "dcv")]);
    expect(m.unit).toBe("V");
    expect(m.display).toMatch(/^4\.4[6-9]$/);
    expect(Math.abs(Number(m.display) / 4.5 - 1)).toBeLessThan(0.006);
  });

  test("reversed probes show a minus sign", () => {
    const m = read([battery9(), meter("M1", { com: "vcc", vohm: "gnd" }, "dcv")]);
    expect(m.display!.startsWith("-")).toBe(true);
    expect(Number(m.display)).toBeLessThan(-8.9);
  });

  test("ohms: auto-ranges onto a resistor, and shows OL for an open circuit", () => {
    const at = (ohms: number) => read([resistor("R1", "p", "gnd", ohms), meter("M1", { com: "gnd", vohm: "p" }, "ohm")]);
    expect([at(470).display, at(470).unit]).toEqual(["0.470", "kΩ"]);
    expect([at(4700).display, at(4700).unit]).toEqual(["4.70", "kΩ"]);
    expect([at(100).display, at(100).unit]).toEqual(["100.0", "Ω"]);
    const open = read([meter("M1", { com: "gnd", vohm: "p" }, "ohm")]);
    expect(open.display).toBe("OL");
  });

  test("a manual range shows OL when the value is too big for it", () => {
    const m = read([battery9(), { ...meter("M1", { com: "gnd", vohm: "vcc" }, "dcv"), range: "2V" } as PartSpec]);
    expect(m.display).toBe("OL");
    expect(m.extra!.range).toBe("2V");
  });

  test("measuring volts with the red lead in the mA socket blows the meter fuse", () => {
    const sim = createSimulation();
    sim.load({ parts: [battery9(), meter("M1", { com: "gnd", ma: "vcc" }, "dcv")] });
    const s = sim.step(0.3);
    const ev = s.events.find((e) => e.type === "meter-fuse");
    expect(ev).toBeDefined();
    expect(ev!.message).toMatch(/VΩ/);
    expect(s.parts.M1!.extra!.fuse).toBe("blown");
    // With the fuse blown the mA range reads nothing, even when wired correctly ...
    sim.load({ parts: [battery9(), resistor("R1", "vcc", "m", 1000), { ...meter("M1", { com: "gnd", ma: "m" }, "dca-ma") }] });
    expect(Number(sim.step(0.3).parts.M1!.display)).toBe(0);
    // ... until a new fuse goes in.
    sim.setInput("M1", "replaceFuse", true);
    const fixed = sim.step(0.3).parts.M1!;
    expect(fixed.extra!.fuse).toBe("ok");
    expect(Number(fixed.display)).toBeGreaterThan(8.5);
  });

  test("continuity beeps on a wire but not through 1 kΩ", () => {
    const wire = read([{ id: "W", kind: "wire", pins: { a: "p", b: "gnd" } }, meter("M1", { com: "gnd", vohm: "p" }, "continuity")]);
    expect(wire.extra!.beep).toBe(true);
    const r = read([resistor("R1", "p", "gnd", 1000), meter("M1", { com: "gnd", vohm: "p" }, "continuity")]);
    expect(r.extra!.beep).toBe(false);
  });

  test("diode test shows the forward drop, and OL when reversed", () => {
    const d = (anode: string, cathode: string) =>
      read([{ id: "D1", kind: "diode", pins: { anode, cathode }, model: "1N4148" }, meter("M1", { com: "gnd", vohm: "p" }, "diode")]);
    const fwd = Number(d("p", "gnd").display);
    expect(fwd).toBeGreaterThan(0.5);
    expect(fwd).toBeLessThan(0.7);
    expect(d("gnd", "p").display).toBe("OL");
  });

  test("the 10 A socket measures a battery's short-circuit current", () => {
    const s = simulateFor({ parts: [battery9("B1", "vcc", "gnd", 9.5), meter("M1", { com: "gnd", a10: "vcc" }, "dca-10a")] }, 1);
    const m = last(s).parts.M1!;
    expect(m.unit).toBe("A");
    expect(Number(m.display)).toBeGreaterThan(1.5);
    expect(Number(m.display)).toBeLessThan(2.5);
    expect(allEvents(s).some((e) => e.type === "shorted")).toBe(true);
  });

  test("display formatting follows 1999 counts", () => {
    const r20 = { label: "20V", fs: 20, dec: 2, scale: 1, unit: "V" };
    expect(formatReading(9.123, r20)).toBe("9.12");
    expect(formatReading(-0.4249, r20)).toBe("-0.42");
    expect(formatReading(19.99, r20)).toBe("19.99");
    expect(formatReading(19.996, r20)).toBe("OL");
    expect(formatReading(-0.001, r20)).toBe("0.00");
  });
});
