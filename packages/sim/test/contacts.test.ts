import { describe, expect, test } from "vitest";
import { createSimulation, simulateFor, type PartSpec, type SimEvent } from "../src";
import { allEvents, battery9, resistor } from "./circuits";

/** Lesson `coil-kickback`: a pushbutton feeds a relay coil; optionally something across the coil. */
function kickback(across?: PartSpec): { minV: number; events: SimEvent[]; peakGlow: number } {
  const sim = createSimulation();
  const parts: PartSpec[] = [
    battery9("B1", "vcc", "gnd", 9),
    { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "k1a" }, pressed: true },
    { id: "K1", kind: "relay", pins: { coilA: "k1a", coilB: "gnd", com: "vcc", no: "kno", nc: "knc" }, coilOhms: 540, pullIn: 6, dropOut: 1.8 },
  ];
  if (across) parts.push(across);
  sim.load({ parts });
  sim.step(0.1);
  sim.setInput("S1", "pressed", false);
  let minV = 0;
  let peakGlow = 0;
  const events: SimEvent[] = [];
  for (let k = 0; k < 400; k++) {
    const s = sim.step(k < 50 ? 1e-6 : 5e-6);
    minV = Math.min(minV, s.nodes.k1a!);
    events.push(...s.events);
  }
  // What a 30 Hz bench sees afterwards.
  for (let k = 0; k < 3; k++) {
    const s = sim.step(1 / 30);
    peakGlow = Math.max(peakGlow, s.parts.D2?.glow ?? 0);
    events.push(...s.events);
  }
  return { minV, events, peakGlow };
}

describe("switches and contacts", () => {
  test("a normally closed pushbutton opens while pressed, and a DPDT moves both poles together", () => {
    const sim = createSimulation();
    sim.load({
      parts: [
        battery9(),
        { id: "S4", kind: "pushbutton", pins: { a: "vcc", b: "x" }, normallyClosed: true },
        resistor("R1", "x", "gnd", 1000),
        { id: "SW", kind: "dpdt", pins: { com1: "vcc", a1: "p1", b1: "q1", com2: "gnd", a2: "p2", b2: "q2" }, to: "a" },
        resistor("RP", "p1", "p2", 1000),
        resistor("RQ", "q1", "q2", 1000),
      ],
    });
    let s = sim.step(0.01);
    expect(s.parts.S4!.closed).toBe(true);
    expect(s.nodes.x).toBeGreaterThan(8);
    expect(s.parts.RP!.i).toBeGreaterThan(0.008);
    expect(Math.abs(s.parts.RQ!.i)).toBeLessThan(1e-6);
    sim.setInput("S4", "pressed", true);
    sim.setInput("SW", "to", "b");
    s = sim.step(0.01);
    expect(s.parts.S4!.closed).toBe(false);
    expect(s.parts.S4!.extra!.pressed).toBe(true);
    expect(s.nodes.x).toBeLessThan(0.01);
    expect(Math.abs(s.parts.RP!.i)).toBeLessThan(1e-6);
    expect(s.parts.RQ!.i).toBeGreaterThan(0.008);
    expect(s.parts.SW!.extra!.to).toBe("b");
  });

  test("releasing a button that feeds a relay coil sparks near 300 V; a diode across the coil stops it", () => {
    const bare = kickback();
    expect(bare.minV).toBeLessThan(-250);
    expect(bare.minV).toBeGreaterThan(-320);
    const spark = bare.events.find((e) => e.type === "spark");
    expect(spark?.partId).toBe("S1");
    const diode = kickback({ id: "D3", kind: "diode", pins: { anode: "gnd", cathode: "k1a" }, model: "1N4001" });
    expect(diode.minV).toBeGreaterThan(-1.2);
    expect(diode.events.some((e) => e.type === "spark")).toBe(false);
    expect(diode.events.some((e) => e.type === "clicked" && e.data?.to === "nc")).toBe(true);
  });

  test("an LED backwards across the coil catches the kickback, and the sub-millisecond flash still shows", () => {
    const { minV, events, peakGlow } = kickback({ id: "D2", kind: "led", pins: { anode: "gnd", cathode: "k1a" }, color: "red" });
    expect(minV).toBeGreaterThan(-5);
    expect(events.some((e) => e.type === "spark")).toBe(false);
    // Seen in the 30 Hz snapshots that follow, although the pulse itself lasts well under a millisecond.
    expect(peakGlow).toBeGreaterThan(0.1);
    expect(peakGlow).toBeLessThan(0.4);
  });

  test("a relay that buzzes for about 20 s wears its contacts out; its armature moves over the operate time", () => {
    // Lesson `relay-buzzer`: the coil is fed through the relay's own NC contact, with a protection diode.
    const parts: PartSpec[] = [
      { id: "B1", kind: "battery", pins: { pos: "vcc", neg: "gnd" }, emf: 9, internalOhms: 1.5 },
      { id: "K1", kind: "relay", pins: { coilA: "k1a", coilB: "gnd", com: "vcc", no: "kno", nc: "k1a" }, coilOhms: 540, pullIn: 6, dropOut: 1.8 },
      { id: "D1", kind: "diode", pins: { anode: "gnd", cathode: "k1a" }, model: "1N4001" },
      resistor("R3", "kno", "g", 470),
      { id: "D3", kind: "led", pins: { anode: "g", cathode: "gnd" }, color: "green" },
    ];
    const s = simulateFor({ parts }, 30, { sampleEvery: 0.5 });
    const died = allEvents(s).find((e) => e.type === "died");
    expect(died?.partId).toBe("K1");
    expect(died?.data?.cause).toBe("worn");
    expect(died!.t).toBeGreaterThan(12);
    expect(died!.t).toBeLessThan(30);
    expect(s[s.length - 1]!.parts.K1!.health).toBe("dead");

    const sim = createSimulation();
    sim.load({
      parts: [
        battery9(),
        { id: "S1", kind: "switch", pins: { a: "vcc", b: "ca" }, closed: false },
        { id: "K1", kind: "relay", pins: { coilA: "ca", coilB: "gnd", com: "x", no: "y", nc: "z" }, coilOhms: 540, pullIn: 6.75, dropOut: 2.7 },
      ],
    });
    const k1 = sim.step(0.01).parts.K1!.extra!;
    expect(Math.abs(Number(k1.pullIn) / 6.75 - 1)).toBeLessThanOrEqual(0.05);
    expect(k1.pullIn).not.toBe(6.75);
    sim.setInput("S1", "closed", true);
    const arm = [0, 0, 0, 0, 0, 0].map(() => Number(sim.step(0.001).parts.K1!.extra!.armature));
    expect(arm.some((a) => a > 0.05 && a < 0.95)).toBe(true);
    expect(Number(sim.step(0.02).parts.K1!.extra!.armature)).toBe(1);
  });
});
