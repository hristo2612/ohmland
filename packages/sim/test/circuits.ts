// Small netlist builders shared by the golden tests.

import type { LedColor, Netlist, PartSpec, Snapshot } from "../src";

export const battery9 = (id = "B1", pos = "vcc", neg = "gnd", emf = 9): PartSpec => ({
  id,
  kind: "battery",
  pins: { pos, neg },
  emf,
  internalOhms: 1.7,
});

export const resistor = (id: string, a: string, b: string, ohms: number, watts?: number): PartSpec =>
  watts === undefined ? { id, kind: "resistor", pins: { a, b }, ohms } : { id, kind: "resistor", pins: { a, b }, ohms, watts };

export const led = (id: string, anode: string, cathode: string, color: LedColor = "red"): PartSpec => ({
  id,
  kind: "led",
  pins: { anode, cathode },
  color,
});

export const meter = (id: string, pins: { com: string; vohm?: string; ma?: string; a10?: string }, mode: Extract<PartSpec, { kind: "multimeter" }>["mode"]): PartSpec => ({
  id,
  kind: "multimeter",
  pins: { com: pins.com, vohm: pins.vohm ?? `${id}.vohm`, ma: pins.ma ?? `${id}.ma`, a10: pins.a10 ?? `${id}.a10` },
  mode,
});

/** Classic two-transistor astable with LED collector loads: each half period is about 0.69 R C. */
export function ledAstable(R = 47e3, C = 10e-6): Netlist {
  return {
    parts: [
      battery9(),
      resistor("RL1", "vcc", "l1", 470),
      led("D1", "l1", "c1"),
      resistor("RL2", "vcc", "l2", 470),
      led("D2", "l2", "c2"),
      resistor("RB1", "vcc", "b1", R),
      resistor("RB2", "vcc", "b2", R),
      { id: "C1", kind: "capacitor", pins: { pos: "c1", neg: "b2" }, farads: C, polarized: true, volts: 16 },
      { id: "C2", kind: "capacitor", pins: { pos: "c2", neg: "b1" }, farads: C, polarized: true, volts: 16 },
      { id: "Q1", kind: "npn", pins: { c: "c1", b: "b1", e: "gnd" } },
      { id: "Q2", kind: "npn", pins: { c: "c2", b: "b2", e: "gnd" } },
    ],
  };
}

/** Relay whose coil is fed through its own NC contact: it buzzes. An optional capacitor across the coil slows it. */
export function relayBuzzer(capFarads = 0): Netlist {
  const parts: PartSpec[] = [
    battery9(),
    { id: "S1", kind: "pushbutton", pins: { a: "vcc", b: "com" }, pressed: true },
    {
      id: "K1",
      kind: "relay",
      pins: { coilA: "nc", coilB: "gnd", com: "com", no: "no", nc: "nc" },
      coilOhms: 540,
      pullIn: 6.75,
      dropOut: 2.7,
    },
  ];
  if (capFarads > 0) parts.push({ id: "C1", kind: "capacitor", pins: { pos: "nc", neg: "gnd" }, farads: capFarads, polarized: true, volts: 16 });
  return { parts };
}

/** Audio-rate astable driving a speaker through an emitter follower and a 100 Ω resistor. */
export function audioAstable(): Netlist {
  return {
    parts: [
      battery9(),
      resistor("RL1", "vcc", "c1", 4700),
      resistor("RL2", "vcc", "c2", 4700),
      resistor("RB1", "vcc", "b1", 47000),
      resistor("RB2", "vcc", "b2", 47000),
      { id: "C1", kind: "capacitor", pins: { pos: "c1", neg: "b2" }, farads: 10e-9 },
      { id: "C2", kind: "capacitor", pins: { pos: "c2", neg: "b1" }, farads: 10e-9 },
      { id: "Q1", kind: "npn", pins: { c: "c1", b: "b1", e: "gnd" } },
      { id: "Q2", kind: "npn", pins: { c: "c2", b: "b2", e: "gnd" } },
      resistor("R3", "c2", "b3", 10000),
      { id: "Q3", kind: "npn", pins: { c: "vcc", b: "b3", e: "e3" } },
      resistor("R4", "e3", "sp", 100),
      { id: "SP", kind: "speaker", pins: { a: "sp", b: "gnd" }, ohms: 8 },
    ],
  };
}

export const last = (s: Snapshot[]): Snapshot => s[s.length - 1]!;

export const allEvents = (s: Snapshot[]) => s.flatMap((x) => x.events);

/** Times at which a sampled value crosses a level going up. */
export function risingCrossings(samples: [number, number][], level: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < samples.length; k++) {
    const [t0, v0] = samples[k - 1]!;
    const [t1, v1] = samples[k]!;
    if (v0 < level && v1 >= level) out.push(t0 + ((level - v0) / (v1 - v0)) * (t1 - t0));
  }
  return out;
}
