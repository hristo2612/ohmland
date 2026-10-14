import { describe, expect, test } from "vitest";
import { DIGIT_SEGMENTS, SEVENSEG_PINS, digitOf, simulateFor, type Netlist, type PartSpec } from "../src";
import { allEvents, battery9, last, resistor } from "./circuits";

const SEGS = ["a", "b", "c", "d", "e", "f", "g"] as const;

/** Lights the given segments of a display through 1 kΩ each (or straight, with ohms 0). */
function showing(lit: string, common: "cathode" | "anode", opts: { comOhms?: number; segOhms?: number } = {}): Netlist {
  const on = common === "cathode" ? "vcc" : "gnd";
  const parts: PartSpec[] = [battery9(), { id: "DS", kind: "sevenseg", common, pins: { com: "com", ...Object.fromEntries(SEGS.map((s) => [s, `s${s}`])) } }];
  parts.push(opts.comOhms ? resistor("RC", "com", common === "cathode" ? "gnd" : "vcc", opts.comOhms) : { id: "WC", kind: "wire", pins: { a: "com", b: common === "cathode" ? "gnd" : "vcc" } });
  for (const s of SEGS) {
    if (!lit.includes(s)) continue;
    const ohms = opts.segOhms ?? 1000;
    parts.push(ohms > 0 ? resistor(`R${s}`, on, `s${s}`, ohms) : { id: `W${s}`, kind: "wire", pins: { a: on, b: `s${s}` } });
  }
  return { parts };
}

describe("7-segment display", () => {
  test("common cathode and common anode both show the digit their lit segments make", () => {
    for (const d of [7, 1, 8, 4]) {
      const segs = DIGIT_SEGMENTS[d]!;
      for (const common of ["cathode", "anode"] as const) {
        const s = last(simulateFor(showing(segs, common), 0.2, { sampleEvery: 0.1 })).parts.DS!;
        expect(s.extra!.digit, `${d} ${common}`).toBe(String(d));
        expect(s.extra!.lit).toBe(segs);
        // About 7 mA per segment through 1 kΩ from 9 V.
        expect(s.glow).toBeGreaterThan(0.6);
      }
    }
  });

  test("one resistor in the common lead makes a 1 brighter than an 8", () => {
    const glowB = (d: number) => Number(last(simulateFor(showing(DIGIT_SEGMENTS[d]!, "cathode", { comOhms: 1000, segOhms: 0 }), 0.2, { sampleEvery: 0.1 })).parts.DS!.extra!.b);
    expect(glowB(1)).toBeGreaterThan(glowB(8) + 0.15);
  });

  test("a segment straight across 9 V burns out, and the event says which", () => {
    const s = simulateFor(showing("a", "cathode", { segOhms: 0 }), 0.5, { sampleEvery: 0.1 });
    const died = allEvents(s).find((e) => e.type === "died" && e.partId === "DS");
    expect(died?.data!.segment).toBe("a");
    expect(died!.message).toMatch(/^Segment a of the display burned out/);
    expect(last(s).parts.DS!.extra!.dead).toBe("a");
    expect(last(s).parts.DS!.health).not.toBe("dead"); // the other segments are fine
  });

  test("a common-anode display wired as common cathode stays dark", () => {
    const net = showing("abc", "cathode");
    (net.parts[1] as Extract<PartSpec, { kind: "sevenseg" }>).common = "anode";
    const s = last(simulateFor(net, 0.2, { sampleEvery: 0.1 })).parts.DS!;
    expect(s.glow).toBe(0);
    expect(s.extra!.digit).toBe(" ");
  });

  test("pin table and digit decoding", () => {
    expect(SEVENSEG_PINS.indexOf("com") + 1).toBe(3);
    expect(SEVENSEG_PINS.indexOf("dp") + 1).toBe(5);
    expect(digitOf("abcdefg")).toBe("8");
    expect(digitOf("bc")).toBe("1");
    expect(digitOf("g")).toBe("-");
    expect(digitOf("abde")).toBe("");
  });
});
