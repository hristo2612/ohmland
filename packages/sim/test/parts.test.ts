import { describe, expect, test } from "vitest";
import { createSimulation, simulateFor, type Netlist, type PartSpec } from "../src";
import { allEvents, battery9, last, led, meter, resistor } from "./circuits";

const bag = (n: number, extra: Partial<Extract<PartSpec, { kind: "resistor" }>> = {}): PartSpec[] =>
  Array.from({ length: n }, (_, k) => ({ id: `R${k}`, kind: "resistor", pins: { a: `n${k}`, b: "gnd" }, ohms: 1000, ...extra }) as PartSpec);

const actual = (n: Netlist) => {
  const s = last(simulateFor(n, 0.001));
  return n.parts.map((p) => Number(s.parts[p.id]!.extra!.actualOhms));
};

describe("part spreads", () => {
  test("resistors get a fixed actual value inside their tolerance; a lab can force one out of spec", () => {
    const a = actual({ parts: bag(40) });
    expect(Math.min(...a)).toBeGreaterThan(955);
    expect(Math.max(...a)).toBeLessThan(1045);
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(20);
    // Same ids, same values; another netlist seed, another bag.
    expect(actual({ parts: bag(40) })).toEqual(a);
    expect(actual({ parts: bag(40), seed: "learner-7" })).not.toEqual(a);
    // Lesson `reading-the-stripes`: a 2.2 kΩ part (bands) that really measures 2.46 kΩ.
    const liar: PartSpec = { id: "R5", kind: "resistor", pins: { a: "p", b: "gnd" }, ohms: 2200, actualOhms: 2460 };
    const s = last(simulateFor({ parts: [liar, meter("M1", { com: "gnd", vohm: "p" }, "ohm")] }, 0.5));
    expect(s.parts.R5!.extra!.nominalOhms).toBe(2200);
    expect([s.parts.M1!.display, s.parts.M1!.unit]).toEqual(["2.46", "kΩ"]);
  });

  test("an electrolytic's value is within 20%, it has a little ESR, and over-voltage kills it with a cause", () => {
    const sim = createSimulation();
    sim.load({
      parts: [
        battery9(),
        { id: "S1", kind: "switch", pins: { a: "vcc", b: "c" }, closed: true },
        { id: "C1", kind: "capacitor", pins: { pos: "c", neg: "gnd" }, farads: 1000e-6, polarized: true, volts: 16 },
        { id: "S2", kind: "pushbutton", pins: { a: "c", b: "gnd" } },
      ],
    });
    const c1 = sim.step(1).parts.C1!.extra!;
    expect(Math.abs(Number(c1.actualFarads) / 1000e-6 - 1)).toBeLessThan(0.2);
    expect(Number(c1.esr)).toBeGreaterThan(0.05);
    // Dump it through a 0.05 Ω button: the ESR keeps the surge finite.
    sim.setInput("S1", "closed", false);
    sim.setInput("S2", "pressed", true);
    const surge = Math.abs(sim.step(1e-6).parts.S2!.i);
    expect(surge).toBeGreaterThan(10);
    expect(surge).toBeLessThan(100);

    const s = simulateFor(
      { parts: [battery9(), { id: "C2", kind: "capacitor", pins: { pos: "vcc", neg: "gnd" }, farads: 100e-6, polarized: true, volts: 6.3 }] },
      10,
      { sampleEvery: 0.25 },
    );
    const ev = allEvents(s).filter((e) => e.partId === "C2");
    expect(ev.map((e) => e.type)).toEqual(["damaged", "died"]);
    expect(ev.every((e) => e.data?.cause === "overvoltage")).toBe(true);
  });
});

describe("damage", () => {
  test("a speaker cooks above its rating, and a 1N4001 across a battery heats while the battery reports a short", () => {
    const sp = (r: number): Netlist => ({
      parts: [battery9(), resistor("R1", "vcc", "a", r, 10), { id: "SP", kind: "speaker", pins: { a: "a", b: "gnd" }, ohms: 8 }],
    });
    const hard = allEvents(simulateFor(sp(0.1), 10, { sampleEvery: 0.5 }));
    expect(hard.find((e) => e.type === "died" && e.partId === "SP")?.data?.cause).toBe("overpower");
    expect(allEvents(simulateFor(sp(100), 10, { sampleEvery: 0.5 })).filter((e) => e.partId === "SP")).toHaveLength(0);

    const s = simulateFor(
      { parts: [battery9(), { id: "D1", kind: "diode", pins: { anode: "vcc", cathode: "gnd" }, model: "1N4001" }] },
      3,
      { sampleEvery: 0.1 },
    );
    expect(allEvents(s).some((e) => e.type === "shorted" && e.partId === "B1")).toBe(true);
    expect(["hot", "smoking"]).toContain(last(s).parts.D1!.health);
  });
});

describe("leads, LEDs and batteries", () => {
  test("a wire with ohms is a real resistance (clip leads)", () => {
    const s = last(
      simulateFor({ parts: [battery9(), { id: "L1", kind: "wire", pins: { a: "vcc", b: "x" }, ohms: 0.15 }, resistor("R1", "x", "gnd", 2, 10)] }, 0.05),
    );
    expect(s.parts.L1!.i).toBeGreaterThan(1);
    expect(s.parts.L1!.v).toBeCloseTo(s.parts.L1!.i * 0.15, 6);
  });

  test("an LED switched at 100 Hz looks steadily, partly lit", () => {
    const sim = createSimulation();
    sim.load({ parts: [battery9(), { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "x" } }, resistor("R1", "x", "a", 470), led("D1", "a", "gnd")] });
    const glows: number[] = [];
    for (let k = 0; k < 120; k++) {
      sim.setInput("S1", "pressed", k % 2 === 0);
      const s = sim.step(0.005);
      if (k >= 40 && k % 7 === 0) glows.push(s.parts.D1!.glow!);
    }
    expect(Math.min(...glows)).toBeGreaterThan(0.55);
    expect(Math.max(...glows)).toBeLessThan(0.8);
  });

  test("battery sag: about 9.2 V on 100 Ω; at 0.55 A a further 0.1 to 0.3 V over 20 s, mostly back within 30 s", () => {
    const parts = (closed: boolean, ohms: number): PartSpec[] => [
      { id: "B1", kind: "battery", pins: { pos: "vcc", neg: "gnd" }, emf: 9.4, internalOhms: 1.7 },
      resistor("RL", "vcc", "x", ohms, 10),
      { id: "S1", kind: "switch", pins: { a: "x", b: "gnd" }, closed },
    ];
    const light = createSimulation();
    light.load({ parts: parts(true, 100) });
    expect(light.step(1).parts.B1!.v).toBeGreaterThan(9.1);
    const sim = createSimulation();
    sim.load({ parts: parts(true, 15.4) });
    // Read straight away, half an amp barely polarises it: close to emf minus I times the internal resistance.
    expect(sim.step(0.3).parts.B1!.v).toBeGreaterThan(8.25);
    const v1 = sim.step(0.7).parts.B1!.v;
    const v20 = sim.step(19).parts.B1!.v;
    expect(v1 - v20).toBeGreaterThan(0.1);
    expect(v1 - v20).toBeLessThan(0.3);
    sim.setInput("S1", "closed", false);
    const rest0 = sim.step(0.01).parts.B1!.v;
    const rest30 = sim.step(30).parts.B1!.v;
    const rested = sim.step(300).parts.B1!.v;
    expect((rest30 - rest0) / (rested - rest0)).toBeGreaterThan(0.6);
  });
});
