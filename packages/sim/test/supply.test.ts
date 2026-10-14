import { describe, expect, test } from "vitest";
import { simulateFor, type Netlist, type PartSpec, type Snapshot } from "../src";
import { allEvents, led, resistor } from "./circuits";

type SupplySpec = Extract<PartSpec, { kind: "supply" }>;

const supply = (opts: Partial<SupplySpec> & { emf: number }, pos = "vp", neg = "gnd"): SupplySpec => ({ id: "AD1", kind: "supply", pins: { pos, neg }, ...opts });

const AD1 = { emf: 9, regulated: true, amps: 1 } as const;
const AD2 = { emf: 9, ac: true } as const;
const AD4 = { emf: 13, ohms: 8, filterFarads: 400e-6, rippleHz: 100 } as const;

const after = (s: Snapshot[], t: number) => s.filter((x) => x.t >= t);
const span = (s: Snapshot[], node: string) => {
  const v = s.map((x) => x.nodes[node]!);
  const min = Math.min(...v);
  const max = Math.max(...v);
  return { min, max, pp: max - min, mean: v.reduce((a, b) => a + b, 0) / v.length };
};

describe("supply: regulated DC", () => {
  test("a 9 V 1 A adapter gives 9.0 V at 20 mA", () => {
    const s = simulateFor({ parts: [supply(AD1), resistor("RL", "vp", "gnd", 450)] }, 0.2, { sampleEvery: 0.01 });
    const v = span(after(s, 0.05), "vp");
    expect(Math.abs(v.mean - 9)).toBeLessThan(0.1);
    expect(v.pp).toBeLessThan(0.01);
    expect(s.at(-1)!.parts.AD1!.extra!.limiting).toBe(false);
    // Delivering 20 mA: negative i, as for a battery.
    expect(s.at(-1)!.parts.AD1!.i).toBeLessThan(-0.019);
  });

  test("past its limit it sags; into a short it folds back and warns", () => {
    // 7 Ω wants 1.3 A: the limit holds about an amp and the output sags.
    const over = simulateFor({ parts: [supply(AD1), resistor("RL", "vp", "gnd", 7, 50)] }, 1, { sampleEvery: 0.05 });
    const last = over.at(-1)!;
    expect(-last.parts.AD1!.i).toBeGreaterThan(0.8);
    expect(-last.parts.AD1!.i).toBeLessThan(1.15);
    expect(last.nodes.vp!).toBeLessThan(8);
    expect(last.parts.AD1!.extra!.limiting).toBe(true);
    const short = simulateFor({ parts: [supply(AD1), resistor("RL", "vp", "gnd", 0.05, 50)] }, 2, { sampleEvery: 0.05 });
    const i = -short.at(-1)!.parts.AD1!.i;
    expect(i).toBeGreaterThan(0.2);
    expect(i).toBeLessThan(0.4);
    expect(allEvents(short).some((e) => e.type === "warning" && e.data!.cause === "current-limit")).toBe(true);
  });
});

describe("supply: AC", () => {
  test("9 V AC swings past 12 V both ways; a DC meter reads about 0, an AC meter about 9 V", () => {
    const net: Netlist = {
      parts: [
        supply(AD2),
        resistor("RL", "vp", "gnd", 10_000),
        { id: "M1", kind: "multimeter", pins: { com: "gnd", vohm: "vp", ma: "M1.ma", a10: "M1.a10" }, mode: "dcv" },
        { id: "M2", kind: "multimeter", pins: { com: "gnd", vohm: "vp", ma: "M2.ma", a10: "M2.a10" }, mode: "acv" },
      ],
    };
    const s = simulateFor(net, 0.5, { sampleEvery: 0.0005 });
    const v = span(after(s, 0.1), "vp");
    expect(v.max).toBeGreaterThan(12);
    expect(v.min).toBeLessThan(-12);
    const end = s.at(-1)!;
    expect(Math.abs(Number(end.parts.M1!.extra!.value))).toBeLessThan(0.3);
    expect(Number(end.parts.M2!.extra!.value)).toBeGreaterThan(8.7);
    expect(Number(end.parts.M2!.extra!.value)).toBeLessThan(9.3);
  });
});

describe("supply: unregulated DC with ripple (AD4)", () => {
  const run = (load: number) => after(simulateFor({ parts: [supply(AD4), resistor("RL", "vp", "gnd", load, 5)] }, 1, { sampleEvery: 0.0005 }), 0.5);

  test("about 12.8 V with half a volt of lumps at 20 mA", () => {
    const v = span(run(640), "vp");
    expect(v.mean).toBeGreaterThan(12.6);
    expect(v.mean).toBeLessThan(13);
    expect(v.pp).toBeGreaterThan(0.4);
    expect(v.pp).toBeLessThan(0.6);
  });

  test("about 12 V with about 3 V of lumps at 125 mA, troughs above 10 V", () => {
    const v = span(run(96), "vp");
    expect(v.mean).toBeGreaterThan(11.6);
    expect(v.mean).toBeLessThan(12.4);
    expect(v.pp).toBeGreaterThan(2.6);
    expect(v.pp).toBeLessThan(3.4);
    expect(v.min).toBeGreaterThan(10);
  });

  test("the lumps come 100 times a second", () => {
    const s = run(96);
    // Rising crossings of the mean.
    const v = span(s, "vp");
    let ups = 0;
    for (let k = 1; k < s.length; k++) if (s[k - 1]!.nodes.vp! < v.mean && s[k]!.nodes.vp! >= v.mean) ups++;
    expect(ups).toBeGreaterThanOrEqual(49);
    expect(ups).toBeLessThanOrEqual(51);
  });

  test("a 7805 behind it gives a flat 5 V with the lamp", () => {
    const net: Netlist = {
      parts: [
        supply(AD4, "in", "gnd"),
        { id: "C2", kind: "capacitor", pins: { pos: "in", neg: "gnd" }, farads: 0.33e-6 },
        { id: "U1", kind: "regulator7805", pins: { in: "in", gnd: "gnd", out: "out" } },
        { id: "C3", kind: "capacitor", pins: { pos: "out", neg: "gnd" }, farads: 0.1e-6 },
        resistor("R5", "out", "l", 220),
        led("D5", "l", "gnd"),
      ],
    };
    const s = after(simulateFor(net, 1, { sampleEvery: 0.0005 }), 0.5);
    const out = span(s, "out");
    expect(out.mean).toBeGreaterThan(4.9);
    expect(out.mean).toBeLessThan(5.1);
    expect(out.pp).toBeLessThan(0.01);
    expect(span(s, "in").pp).toBeGreaterThan(0.3);
  });

  test("a big load on the 7805 heats it past 55 °C within a minute", () => {
    const net: Netlist = {
      parts: [supply(AD4, "in", "gnd"), { id: "U1", kind: "regulator7805", pins: { in: "in", gnd: "gnd", out: "out" } }, resistor("RL", "out", "gnd", 47, 1)],
    };
    const s = simulateFor(net, 60, { sampleEvery: 1 });
    expect(s.at(-1)!.parts.U1!.temp).toBeGreaterThan(55);
  });
});

describe("supply: plugged in backwards (centre minus into a centre-plus circuit)", () => {
  test("the electrolytic across the rails is reversed and wears; the LED with 1 kΩ stays dark and unharmed", () => {
    // The adapter's + reaches the circuit's minus rail.
    const net: Netlist = {
      parts: [
        supply({ emf: 9, regulated: true, amps: 0.5 }, "gnd", "vp"),
        resistor("R1", "vp", "a", 1000),
        led("D1", "a", "gnd"),
        { id: "C1", kind: "capacitor", pins: { pos: "vp", neg: "gnd" }, farads: 100e-6, volts: 16, polarized: true },
      ],
    };
    const s = simulateFor(net, 120, { sampleEvery: 0.25 });
    const ev = allEvents(s);
    const rev = ev.find((e) => e.type === "reversed" && e.partId === "C1");
    expect(rev).toBeTruthy();
    expect(rev!.t).toBeLessThan(1);
    const dmg = ev.find((e) => e.type === "damaged" && e.partId === "C1");
    expect(dmg).toBeTruthy();
    const died = ev.find((e) => e.type === "died" && e.partId === "C1");
    if (died) expect(died.t).toBeGreaterThan(dmg!.t);
    expect(ev.some((e) => e.partId === "D1" && (e.type === "died" || e.type === "damaged"))).toBe(false);
    expect(s.at(-1)!.parts.D1!.glow ?? 0).toBeLessThan(0.02);
  });
});
