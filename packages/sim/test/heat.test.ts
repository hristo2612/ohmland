import { describe, expect, test } from "vitest";
import { createSimulation, ledHeatDim, ledHeatRate, type Netlist } from "../src";
import { allEvents, battery9, led, resistor } from "./circuits";

// Outside heat into parts (input "bodyC"): a soldering iron on a lead warms the body; the station engine in
// packages/bench works out how hot, the simulator does what heat does to the part.

const lamp = (): Netlist => ({ parts: [battery9("B1", "vcc", "gnd", 9.4), resistor("R1", "vcc", "a", 470), led("D1", "a", "gnd")] });

describe("LED: outside heat", () => {
  test("the glow sags as the die warms and comes back as it cools", () => {
    const sim = createSimulation();
    sim.load(lamp());
    const cool = sim.step(1).parts.D1!.glow!;
    expect(cool).toBeGreaterThan(0.8);
    sim.setInput("D1", "bodyC", 95);
    const warm = sim.step(1).parts.D1!;
    expect(warm.glow!).toBeLessThan(cool * 0.75);
    expect(warm.glow!).toBeGreaterThan(cool * 0.55);
    expect(warm.temp).toBeGreaterThan(95);
    expect(warm.extra!.bodyC).toBe(95);
    // Below the damage threshold nothing is lost: cooled down, it glows as before.
    sim.setInput("D1", "bodyC", 25);
    const back = sim.step(1).parts.D1!;
    expect(back.glow!).toBeCloseTo(cool, 2);
    expect(back.extra!.damage).toBe(0);
  });

  test("held very hot, it is damaged and then dies of overheating", () => {
    const sim = createSimulation();
    sim.load(lamp());
    sim.step(0.5);
    sim.setInput("D1", "bodyC", 130);
    const events = [];
    for (let k = 0; k < 40; k++) events.push(...sim.step(0.25).events);
    const damaged = events.find((e) => e.type === "damaged" && e.partId === "D1");
    const died = events.find((e) => e.type === "died" && e.partId === "D1");
    expect(damaged?.data!.cause).toBe("overheat");
    expect(died?.data!.cause).toBe("overheat");
    expect(died!.t).toBeGreaterThan(damaged!.t);
    // Die at about 140 °C: about 1 / ((140 - 105) / 32)^2 seconds.
    expect(died!.t - 0.5).toBeGreaterThan(0.5);
    expect(died!.t - 0.5).toBeLessThan(2);
    const s = sim.snapshot();
    expect(s.parts.D1!.health).toBe("dead");
    expect(s.parts.D1!.glow).toBe(0);
    expect(Math.abs(s.parts.R1!.i)).toBeLessThan(1e-6);
  });

  test("the outside heat survives a rebuild, and a fresh part clears it", () => {
    const sim = createSimulation();
    sim.load(lamp());
    sim.setInput("D1", "bodyC", 80);
    sim.step(0.2);
    sim.load(lamp());
    expect(sim.step(0.2).parts.D1!.extra!.bodyC).toBe(80);
    sim.setInput("D1", "replace", true);
    expect(sim.step(0.2).parts.D1!.extra!.bodyC).toBeUndefined();
  });

  test("the die curves: no loss below 36 °C, a third gone near 91 °C, no damage up to 105 °C", () => {
    expect(ledHeatDim(30)).toBe(1);
    expect(ledHeatDim(91)).toBeCloseTo(2 / 3, 2);
    expect(ledHeatRate(105)).toBe(0);
    expect(ledHeatRate(137)).toBeCloseTo(1, 5);
  });
});

describe("transistor and diode: outside heat", () => {
  test("a transistor cooked to 200 °C fails of overheating", () => {
    const net: Netlist = {
      parts: [battery9(), resistor("RB", "vcc", "b", 47_000), resistor("RC", "vcc", "c", 1000), { id: "Q1", kind: "npn", pins: { c: "c", b: "b", e: "gnd" } }],
    };
    const sim = createSimulation();
    sim.load(net);
    sim.step(0.2);
    sim.setInput("Q1", "bodyC", 210);
    const ev = [];
    for (let k = 0; k < 20; k++) ev.push(...sim.step(0.25).events);
    expect(allEvents([{ t: 0, nodes: {}, parts: {}, events: ev }]).find((e) => e.type === "died" && e.partId === "Q1")?.data!.cause).toBe("overheat");
  });

  test("a diode held above 175 °C fails", () => {
    const net: Netlist = { parts: [battery9(), resistor("R1", "vcc", "a", 1000), { id: "D1", kind: "diode", pins: { anode: "a", cathode: "gnd" }, model: "1N4148" }] };
    const sim = createSimulation();
    sim.load(net);
    sim.setInput("D1", "bodyC", 230);
    const ev = [];
    for (let k = 0; k < 20; k++) ev.push(...sim.step(0.25).events);
    expect(ev.some((e) => e.type === "died" && e.partId === "D1")).toBe(true);
  });
});
