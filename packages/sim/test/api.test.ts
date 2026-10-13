import { describe, expect, test } from "vitest";
import { attachSimHost, createSimClient, createSimulation, SAMPLE_RATE, simulateFor, type Snapshot, type WorkerLike } from "../src";
import { audioAstable, battery9, led, resistor } from "./circuits";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rc = { parts: [battery9(), resistor("R1", "vcc", "c", 1000), { id: "C1", kind: "capacitor" as const, pins: { pos: "c", neg: "gnd" }, farads: 1e-3 }] };

describe("API", () => {
  test("run() follows wall time x speed with about 30 snapshots a second", async () => {
    const sim = createSimulation();
    sim.load(rc);
    const snaps: Snapshot[] = [];
    sim.onSnapshot((s) => snaps.push(s));
    sim.run({ speed: 2 });
    await wait(500);
    sim.pause();
    expect(snaps.length).toBeGreaterThan(10);
    expect(snaps.length).toBeLessThan(20);
    expect(sim.time).toBeGreaterThan(0.8);
    expect(sim.time).toBeLessThan(1.2);
    expect(snaps[snaps.length - 1]!.lag).toBe(0);
    sim.dispose();
  });

  test("an overloaded run reports lag instead of freezing", async () => {
    const sim = createSimulation({ budgetMs: 2 });
    sim.load(audioAstable());
    const snaps: Snapshot[] = [];
    sim.onSnapshot((s) => snaps.push(s));
    sim.run({ speed: 50 });
    await wait(400);
    sim.pause();
    expect(snaps.length).toBeGreaterThan(5);
    expect(snaps[snaps.length - 1]!.lag!).toBeGreaterThan(0.5);
    sim.dispose();
  });

  test("the worker client speaks the same API over a message port", async () => {
    const ch = new MessageChannel();
    attachSimHost(ch.port2 as unknown as WorkerLike);
    const client = await createSimClient({ worker: ch.port1 as unknown as WorkerLike });
    client.load(rc);
    const s = await client.step(1);
    expect(s.t).toBeCloseTo(1, 9);
    expect(s.nodes.c! / s.nodes.vcc!).toBeGreaterThan(0.62);
    const got: Snapshot[] = [];
    client.onSnapshot((x) => got.push(x));
    client.setInput("R1", "ohms", 100);
    client.run({ speed: 1 });
    await wait(250);
    client.pause();
    expect(got.length).toBeGreaterThan(3);
    expect(client.time).toBeGreaterThan(1.1);
    client.dispose();
    ch.port2.close();
  });

  test("a speaker produces a 44.1 kHz audio stream", () => {
    const sim = createSimulation();
    sim.load(audioAstable());
    let n = 0;
    let peak = 0;
    let rate = 0;
    sim.onAudio((samples, sampleRate) => {
      rate = sampleRate;
      n += samples.length;
      for (const v of samples) peak = Math.max(peak, Math.abs(v));
    });
    sim.step(0.1);
    expect(rate).toBe(SAMPLE_RATE);
    expect(Math.abs(n - 0.1 * SAMPLE_RATE)).toBeLessThan(2);
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
  });

  test("simulateFor applies scheduled inputs", () => {
    const s = simulateFor(
      { parts: [battery9(), { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "x" } }, resistor("R1", "x", "a", 470), led("D1", "a", "gnd")] },
      0.4,
      { sampleEvery: 0.1, actions: [{ t: 0.2, id: "S1", key: "pressed", value: true }] },
    );
    expect(s.map((x) => Math.round(x.t * 10))).toEqual([1, 2, 3, 4]);
    expect(s[1]!.parts.D1!.glow).toBeLessThan(0.01);
    expect(s[3]!.parts.D1!.glow!).toBeGreaterThan(0.8);
  });

  test("time-lapse: run({ speed: 3600 }) drains a battery about an hour per wall second without lagging", async () => {
    const sim = createSimulation();
    sim.load({
      parts: [
        { id: "B1", kind: "battery", pins: { pos: "vcc", neg: "gnd" }, emf: 9.4, internalOhms: 1.7, mAh: 500 },
        resistor("R1", "vcc", "a", 470),
        led("D1", "a", "gnd"),
      ],
    });
    const snaps: Snapshot[] = [];
    sim.onSnapshot((s) => snaps.push(s));
    sim.run({ speed: 3600 });
    await wait(300);
    sim.pause();
    expect(sim.time).toBeGreaterThan(600);
    const s = snaps[snaps.length - 1]!;
    expect(s.lag).toBeLessThan(0.2);
    // About 15 mA from 500 mAh: 3% an hour.
    const soc = Number(s.parts.B1!.extra!.soc);
    expect(1 - soc).toBeCloseTo((0.0155 * s.t) / 1800, 2);
    sim.dispose();
  });

  test("live inputs survive a rebuild unless the netlist changes them", () => {
    const sim = createSimulation();
    const parts = [battery9(), { id: "S1", kind: "switch" as const, pins: { a: "vcc", b: "x" }, closed: false }, resistor("R1", "x", "a", 470), led("D1", "a", "gnd")];
    sim.load({ parts });
    sim.setInput("S1", "closed", true);
    sim.load({ parts: [...parts, resistor("R9", "vcc", "gnd", 1e6)] });
    expect(sim.step(0.1).parts.S1!.closed).toBe(true);
  });
});
