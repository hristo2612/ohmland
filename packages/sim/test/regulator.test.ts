import { describe, expect, test } from "vitest";
import { simulateFor, type Netlist } from "../src";
import { allEvents, last, resistor } from "./circuits";

const reg = (emf: number, load: number, opts: { heatsink?: boolean; internalOhms?: number } = {}): Netlist => ({
  parts: [
    { id: "P", kind: "cell", pins: { pos: "vin", neg: "gnd" }, emf, internalOhms: opts.internalOhms ?? 0.05 },
    { id: "U1", kind: "regulator7805", pins: { in: "vin", gnd: "gnd", out: "vout" }, heatsink: opts.heatsink === true },
    ...(load > 0 ? [resistor("RL", "vout", "gnd", load, 50)] : []),
  ],
});

describe("7805 regulator", () => {
  test("the output follows the input about 2 V below it, then locks at 5 V", () => {
    const vout = (emf: number) => last(simulateFor(reg(emf, 100), 0.05)).nodes.vout!;
    expect(vout(4)).toBeGreaterThan(1.9);
    expect(vout(4)).toBeLessThan(2.2);
    expect(vout(6)).toBeGreaterThan(3.9);
    expect(vout(6)).toBeLessThan(4.2);
    for (const emf of [7.5, 9, 12, 20]) {
      expect(Math.abs(vout(emf) - 5)).toBeLessThan(0.1);
    }
    expect(last(simulateFor(reg(6, 100), 0.05)).parts.U1!.extra!.dropout).toBe(true);
    expect(last(simulateFor(reg(9, 100), 0.05)).parts.U1!.extra!.dropout).toBe(false);
  });

  test("it holds 5 V from no load to an amp, drawing a few milliamps itself", () => {
    const idle = last(simulateFor(reg(9, 0), 0.05));
    expect(-idle.parts.P!.i).toBeGreaterThan(3e-3);
    expect(-idle.parts.P!.i).toBeLessThan(6e-3);
    const amp = last(simulateFor(reg(9, 5), 0.05));
    expect(Math.abs(amp.nodes.vout! - idle.nodes.vout!)).toBeLessThan(0.1);
    expect(amp.parts.U1!.i).toBeGreaterThan(0.95);
    // (9 - 5) V x 1 A is about 4 W of heat.
    expect(amp.parts.U1!.p).toBeGreaterThan(3.8);
    expect(amp.parts.U1!.p).toBeLessThan(4.4);
  });

  test("4 W without a heat sink heats it to thermal shutdown; with one it runs warm", () => {
    const bare = simulateFor(reg(9, 5), 60, { sampleEvery: 1 });
    const warn = allEvents(bare).find((e) => e.type === "warning");
    expect(warn?.data!.cause).toBe("thermal-shutdown");
    expect(warn!.t).toBeGreaterThan(5);
    expect(warn!.t).toBeLessThan(40);
    // In shutdown it cycles: the average output sags.
    expect(Math.min(...bare.filter((s) => s.t > warn!.t).map((s) => s.nodes.vout!))).toBeLessThan(4);
    const sunk = simulateFor(reg(9, 5, { heatsink: true }), 60, { sampleEvery: 1 });
    expect(allEvents(sunk).some((e) => e.type === "warning")).toBe(false);
    expect(last(sunk).parts.U1!.temp).toBeGreaterThan(60);
    expect(last(sunk).parts.U1!.temp).toBeLessThan(120);
  });

  test("a shorted output is current limited, then thermal protection takes over", () => {
    const s = simulateFor(reg(9, 0.01), 2, { sampleEvery: 0.01 });
    const first = s[0]!;
    expect(first.parts.U1!.i).toBeGreaterThan(1.8);
    expect(first.parts.U1!.i).toBeLessThan(2.4);
    expect(first.parts.U1!.extra!.limiting).toBe(true);
    expect(allEvents(s).some((e) => e.type === "warning" && e.data!.cause === "thermal-shutdown")).toBe(true);
    expect(last(s).parts.U1!.health).not.toBe("dead");
  });

  test("left cycling in thermal shutdown it eventually fails; 40 V in or a backwards part kills it", () => {
    const cooked = simulateFor(reg(9, 0.01), 200, { sampleEvery: 5 });
    expect(allEvents(cooked).find((e) => e.type === "died")?.data!.cause).toBe("overheat");
    const over = simulateFor(reg(40, 100), 1, { sampleEvery: 0.1 });
    expect(allEvents(over).find((e) => e.type === "died")?.data!.cause).toBe("overvoltage");
    const back: Netlist = {
      parts: [{ id: "P", kind: "battery", pins: { pos: "gnd2", neg: "vin" }, emf: 9, internalOhms: 1.7 }, { id: "W", kind: "wire", pins: { a: "gnd2", b: "gnd" } }, { id: "U1", kind: "regulator7805", pins: { in: "vin", gnd: "gnd", out: "vout" } }, resistor("RL", "vout", "gnd", 100)],
    };
    const rev = simulateFor(back, 1, { sampleEvery: 0.1 });
    expect(allEvents(rev).find((e) => e.type === "died" && e.partId === "U1")?.data!.cause).toBe("reverse");
  });
});
