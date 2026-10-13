import { describe, expect, test } from "vitest";
import { createSimulation, simulateFor, type Netlist } from "../src";
import { allEvents, battery9, last, resistor } from "./circuits";

/** A fuse fed from a stiff source with the load chosen so the current is k times the fuse rating. */
function fuseAt(k: number, amps = 1, id = "F1"): Netlist {
  const fuseOhms = 0.1 / amps;
  const emf = 2;
  return {
    parts: [
      { id: "S", kind: "cell", pins: { pos: "p", neg: "gnd" }, emf, internalOhms: 0.001 },
      { id, kind: "fuse", pins: { a: "p", b: "x" }, amps },
      resistor("RL", "x", "gnd", emf / (k * amps) - fuseOhms - 0.001, 1000),
    ],
  };
}

const blowTime = (n: Netlist, seconds: number, every = 0.001) =>
  allEvents(simulateFor(n, seconds, { sampleEvery: every })).find((e) => e.type === "blown")?.t;

describe("fuses", () => {
  test("never open at their rating", () => {
    expect(blowTime(fuseAt(1), 60, 0.5)).toBeUndefined();
  });

  test("open in about 1 to 5 s at twice the rating", () => {
    for (const id of ["F1", "fuse-b", "fuse-c"]) {
      const t = blowTime(fuseAt(2, 1, id), 10, 0.01);
      expect(t).toBeGreaterThan(1);
      expect(t).toBeLessThan(5);
    }
  });

  test("open within milliseconds at ten times the rating", () => {
    const t = blowTime(fuseAt(10, 0.5), 1, 0.0005);
    expect(t).toBeDefined();
    expect(t!).toBeLessThan(0.02);
  });

  test("a blown fuse is an open circuit that stays open", () => {
    const s = simulateFor(fuseAt(10, 0.5), 0.5, { sampleEvery: 0.05 });
    const f = last(s).parts.F1!;
    expect(f.health).toBe("dead");
    expect(f.closed).toBe(false);
    expect(Math.abs(f.i)).toBeLessThan(1e-6);
  });
});

describe("overheating", () => {
  test("a 15 Ω resistor across a 9 V battery gets hot, smokes, then burns open", () => {
    const s = simulateFor({ parts: [battery9(), resistor("R1", "vcc", "gnd", 15)] }, 10, { sampleEvery: 0.25 });
    const ev = allEvents(s);
    const smoke = ev.find((e) => e.type === "smoke")!;
    const died = ev.find((e) => e.type === "died")!;
    expect(smoke.t).toBeGreaterThan(0.3);
    expect(smoke.t).toBeLessThan(3);
    expect(died.t).toBeGreaterThan(smoke.t);
    expect(died.t).toBeLessThan(10);
    expect(s.find((x) => x.t >= 0.5)!.parts.R1!.health).toBe("hot");
    expect(last(s).parts.R1!.health).toBe("dead");
  });

  test("a quarter watt resistor at its rating stays below smoking", () => {
    // 0.25 W in 100 Ω: 5 V across it.
    const s = simulateFor(
      { parts: [{ id: "S", kind: "cell", pins: { pos: "p", neg: "gnd" }, emf: 5, internalOhms: 0.001 }, resistor("R1", "p", "gnd", 100)] },
      30,
      { sampleEvery: 1 },
    );
    expect(last(s).parts.R1!.temp).toBeGreaterThan(70);
    expect(last(s).parts.R1!.temp).toBeLessThan(100);
    expect(allEvents(s)).toHaveLength(0);
  });

  test("a reversed electrolytic leaks, gets damaged, then fails", () => {
    const s = simulateFor(
      {
        parts: [
          battery9(),
          resistor("R1", "vcc", "x", 10000),
          { id: "C1", kind: "capacitor", pins: { pos: "gnd", neg: "x" }, farads: 100e-6, polarized: true },
        ],
      },
      20,
      { sampleEvery: 0.5 },
    );
    const types = allEvents(s).map((e) => e.type);
    expect(types).toEqual(["reversed", "damaged", "died"]);
    expect(allEvents(s).every((e) => e.data?.cause === "reverse")).toBe(true);
    expect(Math.abs(s[2]!.parts.C1!.i)).toBeGreaterThan(1e-4);
  });

  test("damage survives a rebuild, and 'replace' fits a fresh part", () => {
    const sim = createSimulation();
    const n: Netlist = { parts: [battery9(), { id: "D1", kind: "led", pins: { anode: "vcc", cathode: "gnd" }, color: "red" }] };
    sim.load(n);
    sim.step(0.1);
    sim.load({ parts: [battery9(), resistor("R1", "vcc", "a", 470), { id: "D1", kind: "led", pins: { anode: "a", cathode: "gnd" }, color: "red" }] });
    expect(sim.step(0.2).parts.D1!.health).toBe("dead");
    sim.setInput("D1", "replace", true);
    const s = sim.step(0.2);
    expect(s.parts.D1!.health).toBe("ok");
    expect(s.parts.D1!.glow!).toBeGreaterThan(0.8);
  });
});
