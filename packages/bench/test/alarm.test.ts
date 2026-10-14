import { describe, expect, it } from "vitest";
import { createSimulation } from "@ohmland/sim";
import { doorBox, doorMarks, doorTerminals, leafLine } from "../src/alarm";
import { anchorPosition } from "../src/layout";
import { benchToNetlist } from "../src/netlist";
import * as ops from "../src/ops";
import { partDef } from "../src/parts";
import type { BenchState, PlacedPart } from "../src/types";

const part = (id: string, kind: PlacedPart["kind"], params: Record<string, unknown>, holes?: Record<string, string>, pos: [number, number] = [0, 0]): PlacedPart =>
  ({ id, kind, params, pos, rot: 0, ...(holes ? { holes } : {}) }) as PlacedPart;

function powered(): BenchState {
  const b = ops.emptyBench({ kind: "bb400" });
  b.parts.push(part("B1", "battery", { snap: true, emf: 9.4 }, { pos: "bp1", neg: "bn1" }));
  return b;
}

describe("the door", () => {
  it("is a reed switch: closed while the leaf (and its magnet) is shut, open while the door is open", () => {
    for (const open of [false, true]) {
      const b = powered();
      b.parts.push(part("DR1", "door", { open }, undefined, [0, 60]));
      const { netlist } = benchToNetlist(b);
      const sw = netlist.parts.find((p) => p.id === "DR1");
      expect(sw).toMatchObject({ kind: "switch", closed: !open });
    }
  });

  it("swings its leaf toward you, and its magnet leaves the reed when open", () => {
    const shut = leafLine({ style: "door" }, false);
    const open = leafLine({ style: "door" }, true);
    expect(open.hinge).toEqual(shut.hinge);
    expect(open.tip[1]).toBeGreaterThan(40);
    const m0 = doorMarks({ open: false });
    const m1 = doorMarks({ open: true });
    expect(Math.hypot(m0.magnet[0] - m0.reed[0], m0.magnet[2] - m0.reed[2])).toBeLessThan(8);
    expect(Math.hypot(m1.magnet[0] - m1.reed[0], m1.magnet[2] - m1.reed[2])).toBeGreaterThan(40);
    // The outline grows to hold the open leaf.
    expect(doorBox({ open: true })[3]).toBeGreaterThan(doorBox({ open: false })[3]);
    // Mirrored, for a door on the board's left: the block (and the reed) on the right, the magnet still meeting it.
    expect(doorTerminals({}).a[0]).toBeLessThan(0);
    expect(doorTerminals({ side: "right" }).a[0]).toBeGreaterThan(0);
    const r = doorMarks({ open: false, side: "right" });
    expect(r.reed[0]).toBeGreaterThan(0);
    expect(Math.hypot(r.magnet[0] - r.reed[0], r.magnet[2] - r.reed[2])).toBeLessThan(8);
    expect(leafLine({ side: "right" }, true).tip[1]).toBeGreaterThan(40);
  });

  it("puts its terminals where clip leads bite, and a click on the leaf opens or shuts it", () => {
    const b = powered();
    b.parts.push(part("DR1", "door", { open: false, style: "window" }, undefined, [0, 60]));
    const t = doorTerminals({ style: "window" });
    const a = anchorPosition(b, "pin:DR1.a")!;
    expect(a[0]).toBeCloseTo(t.a[0], 6);
    expect(a[2]).toBeCloseTo(60 + t.a[2], 6);
    const hot = partDef("door").hotspots!({ open: false }, "desk");
    expect(hot[0]!.pick).toEqual({ type: "setting", key: "open", value: true });
    const opened = ops.setPartParams(b, "DR1", ops.settingParams(b, "DR1", "open", true) as never);
    expect((opened.parts.find((p) => p.id === "DR1")!.params as { open?: boolean }).open).toBe(true);
  });
});

describe("the voice module", () => {
  /** The module on the board, plus to its first pin, minus to its last, a speaker from OUT to minus, EN as given. */
  function singer(en: "plus" | "minus" | "free"): BenchState {
    const b = powered();
    b.parts.push(part("VM1", "plug-module", { model: "voice" }, { vcc: "e10", en: "e11", out: "e12", gnd: "e13" }));
    b.parts.push(part("SP1", "speaker", { ohms: 8 }, { a: "a12", b: "bn14" }, [0, 50]));
    b.wires.push({ id: "W1", a: "a10", b: "bp9", color: "red" }, { id: "W2", a: "a13", b: "bn13", color: "black" });
    if (en === "plus") b.wires.push({ id: "W3", a: "a11", b: "bp11", color: "yellow" });
    if (en === "minus") b.wires.push({ id: "W3", a: "a11", b: "bn11", color: "yellow" });
    return b;
  }

  /** Rising crossings of the 555's output per second, over the last half of `seconds`. */
  function pitch(b: BenchState, seconds = 0.2): number {
    const sim = createSimulation();
    sim.load({ ...benchToNetlist(b).netlist, watch: [{ id: "q", node: "VM1#q", level: 4 }] });
    sim.step(seconds / 2);
    let rises = 0;
    const steps = 20;
    for (let k = 0; k < steps; k++) rises += sim.step(seconds / 2 / steps).edges?.["q"]?.rises ?? 0;
    return rises / (seconds / 2);
  }

  it("sings near 440 Hz while EN is high (10 kΩ, 30 kΩ, 47 nF)", () => {
    const f = pitch(singer("plus"));
    // 1.44 ÷ ((10 kΩ + 2 × 30 kΩ) × 47 nF) = 437.7 Hz.
    expect(f).toBeGreaterThan(400);
    expect(f).toBeLessThan(470);
  });

  it("is silent with EN low or left free (a 100 kΩ inside holds it low)", () => {
    expect(pitch(singer("minus"))).toBe(0);
    expect(pitch(singer("free"))).toBe(0);
  });
});
