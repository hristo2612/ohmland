import { describe, expect, it } from "vitest";
import { LOGIC_PINOUTS, REGULATOR7805_PINS, SEVENSEG_PINS, TIMER555_PINS, simulateFor, type PartSpec } from "@ohmland/sim";
import { CHIP_MODELS, CHIP_PINOUTS, REGULATOR_LEGS, SEVENSEG_LEGS, chipLeg, socketPinFor } from "../src/chips";
import { anchorPosition, partPose, rejectedParts } from "../src/layout";
import { benchToNetlist } from "../src/netlist";
import * as ops from "../src/ops";
import { partDef, perches } from "../src/parts";
import { logicProbeReading } from "../src/probe";
import type { BenchState, PlacedPart } from "../src/types";
import { BOARD_TOP } from "../src/dims";
import { chipsBench, dipHoles } from "../playground/scenes";

const spec = <K extends PartSpec["kind"]>(specs: PartSpec[], id: string, kind: K) => {
  const s = specs.find((p) => p.id === id);
  expect(s?.kind, id).toBe(kind);
  return s as Extract<PartSpec, { kind: K }>;
};

const part = (id: string, kind: PlacedPart["kind"], params: Record<string, unknown>, holes?: Record<string, string>, rot = 0): PlacedPart =>
  ({ id, kind, params, pos: [0, 0], rot, ...(holes ? { holes } : {}) }) as PlacedPart;

/** A board with a 9 V battery's snap in the near rails. */
function powered(): BenchState {
  const b = ops.emptyBench({ kind: "bb830" });
  b.parts.push(part("B1", "battery", { snap: true, emf: 9.4 }, { pos: "bp3", neg: "bn3" }));
  return b;
}

describe("chip pin tables", () => {
  it("match the simulator's, pin 1 first", () => {
    for (const m of CHIP_MODELS) {
      if (m === "555" || m === "555-cmos") expect(CHIP_PINOUTS[m]).toEqual([...TIMER555_PINS]);
      else expect(CHIP_PINOUTS[m], m).toEqual([...LOGIC_PINOUTS[m]]);
    }
    expect([...SEVENSEG_LEGS]).toEqual([...SEVENSEG_PINS]);
    expect([...REGULATOR_LEGS]).toEqual([...REGULATOR7805_PINS]);
  });

  it("names pins by function, and numbers by number", () => {
    expect(chipLeg("555", "trig")).toBe("2");
    expect(chipLeg("555", "VCC")).toBe("8");
    expect(chipLeg("4026B", "co")).toBe("5");
    expect(chipLeg("74HC02", "y1")).toBe("1");
    expect(chipLeg("74HC00", "y1")).toBe("3");
    expect(chipLeg("555", "9")).toBeNull();
    expect(chipLeg("555", "nope")).toBeNull();
  });
});

describe("chips on the board", () => {
  it("seats a DIP across the channel and maps its pins by number", () => {
    let b = powered();
    let id: string;
    [b, id] = ops.addPart(b, "chip", { model: "555" }, { pos: [-200, 0] });
    // Drop it over the channel: its footprint centre lands between rows e and f.
    b = ops.movePart(b, id, [(21.5 - 32) * 2.54, 0]);
    expect(b.parts.find((p) => p.id === id)!.holes).toEqual(dipHoles(8, 20));
    const { netlist, nodeOf } = benchToNetlist(b);
    const u = spec(netlist.parts, id, "timer555");
    expect(u.pins.gnd).toBe(nodeOf("hole:a20"));
    expect(u.pins.trig).toBe(nodeOf("hole:a21"));
    expect(u.pins.out).toBe(nodeOf("hole:a22"));
    expect(u.pins.reset).toBe(nodeOf("hole:a23"));
    expect(u.pins.ctrl).toBe(nodeOf("hole:j23"));
    expect(u.pins.thresh).toBe(nodeOf("hole:j22"));
    expect(u.pins.dis).toBe(nodeOf("hole:j21"));
    expect(u.pins.vcc).toBe(nodeOf("hole:j20"));
    expect(u.cmos).toBeUndefined();
  });

  it("turned round in the same holes, the simulator sees every pin moved", () => {
    let b = powered();
    let id: string;
    [b, id] = ops.addPart(b, "chip", { model: "555-cmos" }, { pos: [0, 0] });
    b = ops.movePart(b, id, [(21.5 - 32) * 2.54, 0]);
    // A quarter turn cannot stand across the channel: R turns it round.
    b = ops.rotatePart(b, id);
    const chip = b.parts.find((p) => p.id === id)!;
    expect(chip.rot).toBe(180);
    // Pin 1 is now at the far right end, pin 8 below it.
    expect(chip.holes?.["1"]).toBe("f23");
    expect(chip.holes?.["8"]).toBe("e23");
    expect(new Set(Object.values(chip.holes!))).toEqual(new Set(Object.values(dipHoles(8, 20))));
    const { netlist, nodeOf } = benchToNetlist(b);
    const u = spec(netlist.parts, id, "timer555");
    expect(u.cmos).toBe(true);
    expect(u.pins.gnd).toBe(nodeOf("hole:j23"));
    expect(u.pins.vcc).toBe(nodeOf("hole:a23"));
    expect(u.pins.reset).toBe(nodeOf("hole:j20"));
    expect(u.pins.ctrl).toBe(nodeOf("hole:a20"));
  });

  it("feeds a 74HC chip turned round its supply backwards, and the simulator damages it", () => {
    // Wired for a chip the right way round: pin 7 (ground) at e16 to minus, pin 14 (supply) at f10 to plus.
    const wire = (b: BenchState) => {
      b.wires.push({ id: "W1", a: "a16", b: "bn16", color: "black" }, { id: "W2", a: "j10", b: "tp10", color: "red" }, { id: "W3", a: "tp58", b: "bp58", color: "red" });
      return b;
    };
    const forward = wire(powered());
    forward.parts.push(part("U1", "chip", { model: "74HC00" }, dipHoles(14, 10)));
    forward.parts.push(part("B2", "battery-pack", { cells: 3 }, { pos: "tp21", neg: "bn21" }));
    forward.parts = forward.parts.filter((p) => p.id !== "B1");
    const ok = simulateFor(benchToNetlist(forward).netlist, 0.3, { sampleEvery: 0.1 });
    expect(ok.flatMap((s) => s.events).filter((e) => e.partId === "U1" && (e.type === "died" || e.type === "damaged"))).toEqual([]);

    const back = structuredClone(forward);
    back.parts = back.parts.map((p) => (p.id === "U1" ? ops.rotatePart({ ...back, parts: [p] }, "U1").parts[0]! : p));
    const u = back.parts.find((p) => p.id === "U1")!;
    expect(u.holes?.["7"]).toBe("f10");
    expect(u.holes?.["14"]).toBe("e16");
    const { netlist } = benchToNetlist(back);
    const s = simulateFor(netlist, 1, { sampleEvery: 0.1 });
    const hurt = s.flatMap((x) => x.events).filter((e) => e.partId === "U1" && (e.type === "died" || e.type === "damaged"));
    expect(hurt.length).toBeGreaterThan(0);
    expect(hurt[0]!.data?.["cause"]).toBe("reverse");
  });

  it("answers to pin names in anchors and in the netlist", () => {
    const b = powered();
    b.parts.push(part("U1", "chip", { model: "555" }, dipHoles(8, 20)));
    const { nodeOf } = benchToNetlist(b);
    expect(nodeOf("pin:U1.trig")).toBe(nodeOf("pin:U1.2"));
    expect(nodeOf("pin:U1.vcc")).toBe(nodeOf("hole:j20"));
    expect(anchorPosition(b, "pin:U1.out")).toEqual(anchorPosition(b, "pin:U1.3"));
    // A clip on a pin named by its function lands on that pin.
    b.leads.push({ id: "TL1", color: "red", a: { to: "pin:U1.reset", pos: [0, 0] }, b: { to: null, pos: [0, 0] } });
    const n = benchToNetlist(b, { leadOhms: 0 });
    expect(n.warnings.filter((w) => w.startsWith("clip-missing"))).toEqual([]);
    expect(n.nodeOf("lead:TL1.b")).toBe(n.nodeOf("hole:a23"));
  });

  it("refuses to seat a surface mount chip: it lies askew on top of the board", () => {
    let b = powered();
    let id: string;
    [b, id] = ops.addPart(b, "chip", { model: "74HC08", package: "soic" }, { pos: [-200, 0] });
    b = ops.movePart(b, id, [10, -8]);
    const chip = b.parts.find((p) => p.id === id)!;
    expect(chip.holes).toBeUndefined();
    expect(perches(chip)).toBe(true);
    expect(rejectedParts(b)).toEqual([id]);
    const pose = partPose(b, chip);
    expect(pose.mount).toBe("desk");
    expect(pose.origin[1]).toBe(BOARD_TOP);
    expect(pose.rot).not.toBe(0);
    // Off the board it is just a part on the desk.
    b = ops.movePart(b, id, [-200, 90]);
    expect(rejectedParts(b)).toEqual([]);
  });
});

describe("IC sockets", () => {
  it("joins a seated chip's pins to the socket's, and turning the chip turns it round", () => {
    let b = powered();
    b.parts.push(part("XU1", "ic-socket", { pins: 8 }, dipHoles(8, 30)));
    b.parts.push(part("U1", "chip", { model: "555" }, undefined));
    b = ops.seatPart(b, "U1", "XU1");
    let n = benchToNetlist(b);
    let u = spec(n.netlist.parts, "U1", "timer555");
    expect(u.pins.gnd).toBe(n.nodeOf("hole:a30"));
    expect(u.pins.vcc).toBe(n.nodeOf("hole:j30"));
    // The chip sits on the socket, pin 1 over the socket's pin 1.
    const sock1 = anchorPosition(b, "pin:XU1.1")!;
    const pin1 = anchorPosition(b, "pin:U1.1")!;
    expect(pin1[0]).toBeCloseTo(sock1[0]);
    expect(pin1[2]).toBeCloseTo(sock1[2]);
    expect(pin1[1]).toBeGreaterThan(BOARD_TOP + 2);

    b = ops.rotatePart(b, "U1");
    expect((b.parts.find((p) => p.id === "XU1")!.params as { turned?: boolean }).turned).toBe(true);
    n = benchToNetlist(b);
    u = spec(n.netlist.parts, "U1", "timer555");
    expect(u.pins.gnd).toBe(n.nodeOf("hole:j33"));
    expect(u.pins.vcc).toBe(n.nodeOf("hole:a33"));
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((k) => socketPinFor(k, 8, 8, true))).toEqual([5, 6, 7, 8, 1, 2, 3, 4]);
    // A small chip in a big socket sits at the pin-1 end.
    expect([1, 4, 5, 8].map((k) => socketPinFor(k, 8, 16, false))).toEqual([1, 4, 13, 16]);
  });

  it("keeps out what does not fit", () => {
    let b = powered();
    b.parts.push(part("XU1", "ic-socket", { pins: 8 }, dipHoles(8, 30)));
    b.parts.push(part("U1", "chip", { model: "4026B" }));
    b.parts.push(part("U2", "chip", { model: "555", package: "soic" }));
    b = ops.seatPart(ops.seatPart(b, "U1", "XU1"), "U2", "XU1");
    expect((b.parts.find((p) => p.id === "XU1")!.params as { held?: object }).held ?? {}).toEqual({});
  });
});

describe("7-segment display", () => {
  const holes = { e: "c14", d: "c15", com: "c16", c: "c17", dp: "c18", g: "g14", f: "g15", com2: "g16", a: "g17", b: "g18" };

  it("straddles the channel in rows c and g, pins named by segment", () => {
    let b = powered();
    let id: string;
    [b, id] = ops.addPart(b, "sevenseg", { common: "cathode" }, { pos: [-200, 0] });
    b = ops.movePart(b, id, [(16 - 32) * 2.54, 0]);
    expect(b.parts.find((p) => p.id === id)!.holes).toEqual(holes);
    const { netlist, nodeOf } = benchToNetlist(b);
    const d = spec(netlist.parts, id, "sevenseg");
    expect(d.common).toBe("cathode");
    for (const [leg, hole] of Object.entries(holes)) expect(d.pins[leg as keyof typeof d.pins], leg).toBe(nodeOf(`hole:${hole}`));
    expect(nodeOf(`pin:${id}.3`)).toBe(nodeOf(`pin:${id}.com`));
  });

  it("on its carrier puts a resistor in front of each segment, and lights a 1", () => {
    const b = powered();
    b.parts.push(part("DS1", "sevenseg", { common: "cathode", carrier: true, segmentOhms: 1000 }, holes));
    // Common to minus, b and c to plus.
    b.wires.push({ id: "W1", a: "a16", b: "bn16", color: "black" }, { id: "W2", a: "j18", b: "tp18", color: "red" }, { id: "W3", a: "a17", b: "bp17", color: "red" }, { id: "W4", a: "tp58", b: "bp58", color: "red" });
    const { netlist, nodeOf } = benchToNetlist(b);
    const d = spec(netlist.parts, "DS1", "sevenseg");
    const r = spec(netlist.parts, "DS1:Rb", "resistor");
    expect(r.ohms).toBe(1000);
    expect(r.pins.a).toBe(nodeOf("hole:j18"));
    expect(d.pins.b).toBe(r.pins.b);
    expect(d.pins.com).toBe(nodeOf("hole:a16"));
    const s = simulateFor(netlist, 0.2, { sampleEvery: 0.2 }).at(-1)!;
    expect(s.parts["DS1"]!.extra?.["lit"]).toBe("bc");
    expect(s.parts["DS1"]!.extra?.["digit"]).toBe("1");
  });
});

describe("DIP switch, regulator, packs and the bench supply", () => {
  it("makes each DIP switch position a switch from pin k to pin 2n + 1 - k", () => {
    const b = powered();
    b.parts.push(part("DIP1", "dip-switch", { positions: 8, s1: true, s8: true, bounce: 3 }, dipHoles(16, 10)));
    b.parts.push(part("DIP2", "dip-switch", { positions: 4, s2: true }, dipHoles(8, 30)));
    const { netlist, nodeOf } = benchToNetlist(b);
    const s1 = spec(netlist.parts, "DIP1:1", "switch");
    expect(s1.pins.a).toBe(nodeOf("hole:a10"));
    expect(s1.pins.b).toBe(nodeOf("hole:j10"));
    expect(s1.closed).toBe(true);
    expect(s1.bounce).toBe(3);
    expect(spec(netlist.parts, "DIP1:3", "switch").closed).toBe(false);
    const s8 = spec(netlist.parts, "DIP1:8", "switch");
    expect([s8.pins.a, s8.pins.b]).toEqual([nodeOf("hole:a17"), nodeOf("hole:j17")]);
    expect(netlist.parts.filter((p) => p.id.startsWith("DIP2:"))).toHaveLength(4);
    const d2 = spec(netlist.parts, "DIP2:2", "switch");
    expect([d2.pins.a, d2.pins.b, d2.closed]).toEqual([nodeOf("hole:a31"), nodeOf("hole:j31"), true]);
    // Each slider is a spot to click that flips its own switch.
    const spots = partDef("dip-switch").hotspots!({ positions: 8, s1: true }, "board");
    expect(spots).toHaveLength(8);
    expect(spots[0]!.pick).toEqual({ type: "setting", key: "s1", value: false });
    expect(spots[2]!.pick).toEqual({ type: "setting", key: "s3", value: true });
    expect(spots[2]!.at[0]).toBeCloseTo(2 * 2.54);
  });

  it("maps the 7805's legs in, gnd, out from the left, and its heat sink", () => {
    let b = powered();
    let id: string;
    [b, id] = ops.addPart(b, "regulator7805", { heatsink: true }, { pos: [-200, 0] });
    b = ops.movePart(b, id, [(41 - 32) * 2.54, -5.5 * 2.54]);
    expect(b.parts.find((p) => p.id === id)!.holes).toEqual({ in: "j40", gnd: "j41", out: "j42" });
    const { netlist, nodeOf } = benchToNetlist(b);
    const r = spec(netlist.parts, id, "regulator7805");
    expect(r.pins).toEqual({ in: nodeOf("hole:f40"), gnd: nodeOf("hole:f41"), out: nodeOf("hole:f42") });
    expect(r.heatsink).toBe(true);
  });

  it("makes AA packs and the bench supply sources, and grounds the first one", () => {
    const b = ops.emptyBench({ kind: "bb830" });
    b.parts.push(part("B1", "battery-pack", { cells: 4 }, { pos: "bp3", neg: "bn3" }));
    b.parts.push(part("PS1", "bench-supply", { position: 0.5, max: 12 }));
    const { netlist, nodeOf, warnings } = benchToNetlist(b);
    expect(warnings.filter((w) => w.startsWith("no-ground"))).toEqual([]);
    expect(nodeOf("hole:bn10")).toBe("gnd");
    const pack = spec(netlist.parts, "B1", "battery");
    expect(pack.emf).toBeCloseTo(6.2);
    expect(pack.internalOhms).toBeCloseTo(0.6);
    expect(spec(netlist.parts, "PS1", "battery").emf).toBe(6);
  });

  it("passes contact bounce through, per part or for every contact", () => {
    const b = powered();
    b.parts.push(part("S1", "pushbutton", { bounce: true }, { a1: "e24", b1: "e26", a2: "f24", b2: "f26" }));
    b.parts.push(part("S2", "slide-switch", { to: "a" }, { a: "a40", com: "a41", b: "a42" }));
    expect(spec(benchToNetlist(b).netlist.parts, "S1", "pushbutton").bounce).toBe(true);
    expect(spec(benchToNetlist(b).netlist.parts, "S2", "spdt").bounce).toBeUndefined();
    expect(spec(benchToNetlist(b, { bounce: 4 }).netlist.parts, "S2", "spdt").bounce).toBe(4);
    expect(spec(benchToNetlist(b, { bounce: 4 }).netlist.parts, "S1", "pushbutton").bounce).toBe(true);
  });
});

describe("logic probe", () => {
  it("drops its tip into the hole under it and reads the node there", () => {
    let b = powered();
    b.parts.push(part("R1", "resistor", { ohms: 1000 }, { a: "bp20", b: "a20" }));
    let id: string;
    [b, id] = ops.addPart(b, "logic-probe", {}, { pos: [-200, 60] });
    // Over the board the tip finds the nearest free hole; the pen follows it.
    b = ops.movePart(b, id, [(20 - 32) * 2.54 + 0.6, 2.5 * 2.54 - 0.4]);
    const lp = b.parts.find((p) => p.id === id)!;
    expect(lp.holes?.["tip"]).toBe("d20");
    expect(lp.pos[0]).toBeCloseTo((20 - 32) * 2.54);
    b = ops.moveFlyingLeg(b, id, "vcc", [(30 - 32) * 2.54, 7.5 * 2.54]);
    b = ops.moveFlyingLeg(b, id, "gnd", [(30 - 32) * 2.54, 8.5 * 2.54]);
    const { nodeOf } = benchToNetlist(b);
    expect(nodeOf(`pin:${id}.tip`)).toBe(nodeOf("hole:a20"));
    const nodes = { gnd: 0, bp: 9.4, "20a-e": 9.4 };
    expect(logicProbeReading(b, nodes, id)).toMatchObject({ powered: true, level: "H" });
    expect(logicProbeReading(b, { ...nodes, "20a-e": 0.4 }, id).level).toBe("L");
    expect(logicProbeReading(b, { ...nodes, "20a-e": 4.7 }, id).level).toBeNull();
    // Unpowered: dark, whatever the tip touches.
    expect(logicProbeReading(b, { gnd: 0, "20a-e": 9 }, id)).toMatchObject({ powered: false, level: null });
    // Lifted off the board, the tip comes out of its hole.
    b = ops.movePart(b, id, [-200, 60]);
    expect(b.parts.find((p) => p.id === id)!.holes?.["tip"]).toBeUndefined();
  });
});

describe("the counting demo", () => {
  it("blinks its LED and counts on the display", () => {
    const b = chipsBench();
    const { netlist, warnings } = benchToNetlist(b);
    expect(warnings).toEqual([]);
    const samples = simulateFor({ ...netlist, seed: "demo" }, 4, { sampleEvery: 0.05 });
    const glows = samples.map((s) => s.parts["D1"]!.glow ?? 0);
    expect(Math.max(...glows)).toBeGreaterThan(0.5);
    expect(Math.min(...glows.slice(10))).toBeLessThan(0.1);
    const digits = samples.map((s) => String(s.parts["DS1"]!.extra?.["digit"] ?? ""));
    for (const d of digits.slice(20)) expect("0123456789 ").toContain(d);
    expect(new Set(digits.slice(20).filter((d) => /\d/.test(d))).size).toBeGreaterThanOrEqual(3);
    expect(samples.flatMap((s) => s.events).filter((e) => e.type === "died" || e.type === "damaged")).toEqual([]);
  });
});
