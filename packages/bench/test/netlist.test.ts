import { describe, expect, it } from "vitest";
import type { PartSpec } from "@ohmland/sim";
import { benchToNetlist } from "../src/netlist";
import type { BenchState, MeterState, PlacedPart, TestLead } from "../src/types";

const empty = (board: BenchState["board"] = { kind: "bb830" }): BenchState => ({
  v: 1,
  board,
  parts: [],
  wires: [],
  leads: [],
  meter: null,
});

const resistor = (id: string, a: string | null, b: string | null, ohms = 470): PlacedPart => ({
  id,
  kind: "resistor",
  params: { ohms },
  pos: [0, 0],
  rot: 0,
  ...(a && b ? { holes: { a, b } } : {}),
});

const led = (id: string, anode: string, cathode: string): PlacedPart => ({
  id,
  kind: "led",
  params: { color: "red" },
  pos: [0, 0],
  rot: 0,
  holes: { anode, cathode },
});

const battery = (id = "B1", holes?: { pos: string; neg: string }): PlacedPart => ({
  id,
  kind: "battery",
  params: { snap: !!holes },
  pos: [-120, 0],
  rot: 0,
  ...(holes ? { holes } : {}),
});

const lead = (id: string, a: string | null, b: string | null): TestLead => ({
  id,
  color: "red",
  a: { to: a, pos: [0, 0] },
  b: { to: b, pos: [0, 0] },
});

const meter = (over: Partial<MeterState> = {}): MeterState => ({
  id: "M1",
  pos: [150, 0],
  rot: 0,
  mode: "dcv",
  probes: {
    red: { socket: "vohm", plugPos: [0, 0], tip: { to: null, pos: [0, 0] } },
    black: { socket: "com", plugPos: [0, 0], tip: { to: null, pos: [0, 0] } },
  },
  ...over,
});

const spec = <K extends PartSpec["kind"]>(specs: PartSpec[], id: string, kind: K) => {
  const s = specs.find((p) => p.id === id);
  expect(s?.kind).toBe(kind);
  return s as Extract<PartSpec, { kind: K }>;
};

describe("benchToNetlist: breadboard strips", () => {
  it("joins the five holes of a strip and keeps neighbouring columns apart", () => {
    const bench = empty();
    bench.parts.push(resistor("R1", "a10", "a14"), resistor("R2", "e14", "e18"), resistor("R3", "c18", "c22"));
    const { netlist, nodeOf } = benchToNetlist(bench);
    const r1 = spec(netlist.parts, "R1", "resistor");
    const r2 = spec(netlist.parts, "R2", "resistor");
    const r3 = spec(netlist.parts, "R3", "resistor");
    expect(r1.pins.b).toBe(r2.pins.a); // a14 and e14 share a strip
    expect(r2.pins.b).toBe(r3.pins.a); // e18 and c18 too
    expect(r1.pins.a).not.toBe(r1.pins.b);
    expect(nodeOf("hole:b10")).toBe(r1.pins.a);
    expect(nodeOf("hole:a11")).not.toBe(r1.pins.a);
  });

  it("isolates the two halves across the centre channel", () => {
    const bench = empty();
    bench.parts.push(resistor("R1", "a5", "a9"), resistor("R2", "f5", "f9"));
    const { nodeOf } = benchToNetlist(bench);
    expect(nodeOf("pin:R1.a")).not.toBe(nodeOf("pin:R2.a"));
    expect(nodeOf("hole:e5")).toBe(nodeOf("pin:R1.a"));
    expect(nodeOf("hole:f5")).toBe(nodeOf("hole:j5"));
    expect(nodeOf("hole:e5")).not.toBe(nodeOf("hole:f5"));
  });

  it("shorts an LED whose leads sit in the same strip", () => {
    const bench = empty();
    bench.parts.push(led("D1", "c7", "d7"));
    const d1 = spec(benchToNetlist(bench).netlist.parts, "D1", "led");
    expect(d1.pins.anode).toBe(d1.pins.cathode);
  });

  it("runs a power rail the whole length of the board, separate from its neighbour", () => {
    const bench = empty();
    bench.parts.push(resistor("R1", "tp3", "j3"), resistor("R2", "tp61", "j61"), resistor("R3", "tn9", "j9"));
    const { nodeOf } = benchToNetlist(bench);
    expect(nodeOf("pin:R1.a")).toBe(nodeOf("pin:R2.a"));
    expect(nodeOf("pin:R1.a")).not.toBe(nodeOf("pin:R3.a"));
    expect(nodeOf("hole:tp3")).toBe("tp");
    expect(nodeOf("hole:bn3")).not.toBe(nodeOf("hole:tn3"));
  });

  it("breaks split rails in the middle", () => {
    const bench = empty({ kind: "bb830", splitRails: true });
    const { nodeOf } = benchToNetlist(bench);
    expect(nodeOf("hole:bp3")).toBe(nodeOf("hole:bp31"));
    expect(nodeOf("hole:bp31")).not.toBe(nodeOf("hole:bp33"));
  });

  it("joins holes with jumper wires", () => {
    const bench = empty();
    bench.parts.push(resistor("R1", "a20", "a24"));
    bench.wires.push({ id: "W1", a: "b24", b: "bp25", color: "red" });
    const { nodeOf } = benchToNetlist(bench);
    expect(nodeOf("pin:R1.b")).toBe(nodeOf("hole:bp57"));
    expect(nodeOf("wire:W1.a")).toBe(nodeOf("wire:W1.b"));
  });

  it("supports the half-size board", () => {
    const bench = empty({ kind: "bb400" });
    bench.parts.push(resistor("R1", "a1", "a5"), resistor("R2", "a30", "e26"));
    const { nodeOf, warnings } = benchToNetlist(bench);
    expect(warnings.filter((w) => w.startsWith("hole"))).toEqual([]);
    expect(nodeOf("hole:e1")).toBe(nodeOf("pin:R1.a"));
    expect(nodeOf("hole:e30")).toBe(nodeOf("pin:R2.a"));
  });

  it("warns about missing and shared holes", () => {
    const bench = empty({ kind: "bb400" });
    bench.parts.push(resistor("R1", "a40", "a44"), resistor("R2", "c3", "c7"), resistor("R3", "c7", "c11"));
    const { warnings } = benchToNetlist(bench);
    expect(warnings.some((w) => w.startsWith("hole-missing: R1.a"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("hole-shared: c7"))).toBe(true);
  });
});

describe("benchToNetlist: parts", () => {
  it("names the first battery's minus terminal gnd and gives loose leads their own nodes", () => {
    const bench = empty(null);
    bench.parts.push(battery(), resistor("R1", null, null), resistor("R2", null, null));
    const { netlist } = benchToNetlist(bench);
    const b1 = spec(netlist.parts, "B1", "battery");
    expect(b1.pins.neg).toBe("gnd");
    const nodes = netlist.parts.flatMap((p) => Object.values(p.pins));
    expect(new Set(nodes).size).toBe(nodes.length);
  });

  it("joins the pushbutton legs that face each other across the channel", () => {
    const bench = empty();
    bench.parts.push({
      id: "S1",
      kind: "pushbutton",
      params: {},
      pos: [0, 0],
      rot: 0,
      holes: { a1: "e10", b1: "e12", a2: "f10", b2: "f12" },
    });
    const { netlist, nodeOf } = benchToNetlist(bench);
    const s1 = spec(netlist.parts, "S1", "pushbutton");
    expect(s1.pins.a).toBe(nodeOf("hole:j10"));
    expect(s1.pins.a).toBe(nodeOf("hole:a10"));
    expect(s1.pins.b).toBe(nodeOf("hole:a12"));
    expect(s1.pins.a).not.toBe(s1.pins.b);
  });

  it("splits a DPDT relay into two changeover contacts sharing the coil", () => {
    const bench = empty();
    bench.parts.push({
      id: "K1",
      kind: "relay",
      params: { coilOhms: 540 },
      pos: [0, 0],
      rot: 0,
      holes: { coil1: "e20", com1: "e23", nc1: "e25", no1: "e27", coil2: "f20", com2: "f23", nc2: "f25", no2: "f27" },
    });
    const { netlist } = benchToNetlist(bench);
    const k1 = spec(netlist.parts, "K1", "relay");
    const k2 = spec(netlist.parts, "K1:2", "relay");
    expect(k1.pins.coilA).toBe(k2.pins.coilA);
    expect(k1.pins.coilB).toBe(k2.pins.coilB);
    expect(k1.pins.com).not.toBe(k2.pins.com);
    expect(k1.coilOhms).toBe(1080);
  });

  it("maps switch position, trimmer position and water type", () => {
    const bench = empty(null);
    bench.parts.push(
      { id: "S1", kind: "slide-switch", params: { to: "b" }, pos: [0, 0], rot: 0 },
      { id: "RV1", kind: "trimmer", params: { ohms: 10000, position: 0.25 }, pos: [0, 0], rot: 0 },
      { id: "WC1", kind: "cup", params: { water: "salty" }, pos: [0, 0], rot: 0 },
    );
    const { netlist } = benchToNetlist(bench);
    expect(spec(netlist.parts, "S1", "spdt").to).toBe("b");
    expect(spec(netlist.parts, "RV1", "pot").position).toBe(0.25);
    expect(spec(netlist.parts, "WC1", "probe-resistance").ohms).toBe(1200);
  });
});

/** Clip leads as ideal conductors, so both clips of a lead share one node. */
const IDEAL = { leadOhms: 0 };

describe("benchToNetlist: clips", () => {
  it("gives each clip lead a small resistance by default", () => {
    const bench = empty(null);
    bench.parts.push(battery(), resistor("R1", null, null));
    bench.leads.push(lead("TL1", "pin:B1.pos", "pin:R1.a"), lead("TL2", "pin:R1.b", "pin:B1.neg"));
    const { netlist, nodeOf } = benchToNetlist(bench);
    const w = spec(netlist.parts, "TL1", "wire");
    expect(w.ohms).toBe(0.15);
    expect(w.pins.a).toBe(nodeOf("pin:B1.pos"));
    expect(w.pins.b).toBe(nodeOf("pin:R1.a"));
    expect(nodeOf("pin:R1.a")).not.toBe(nodeOf("pin:B1.pos"));
  });

  it("connects parts with alligator leads, without a board", () => {
    const bench = empty(null);
    bench.parts.push(battery(), resistor("R1", null, null), led("D1", "x", "y"));
    delete bench.parts[2]!.holes;
    bench.leads.push(lead("TL1", "pin:B1.pos", "pin:R1.a"), lead("TL2", "pin:R1.b", "pin:D1.anode"), lead("TL3", "pin:D1.cathode", "pin:B1.neg"));
    const { netlist, nodeOf } = benchToNetlist(bench, IDEAL);
    const r1 = spec(netlist.parts, "R1", "resistor");
    const d1 = spec(netlist.parts, "D1", "led");
    expect(r1.pins.a).toBe(nodeOf("pin:B1.pos"));
    expect(r1.pins.b).toBe(d1.pins.anode);
    expect(d1.pins.cathode).toBe("gnd");
  });

  it("chains clips through a hole and onto a wire end", () => {
    const bench = empty();
    bench.parts.push(battery(), resistor("R1", "a10", "a14"));
    bench.wires.push({ id: "W1", a: "c14", b: "c30", color: "yellow" });
    bench.leads.push(lead("TL1", "pin:B1.pos", "hole:e10"), lead("TL2", "wire:W1.b", "pin:B1.neg"));
    const { nodeOf } = benchToNetlist(bench, IDEAL);
    expect(nodeOf("pin:R1.a")).toBe(nodeOf("pin:B1.pos"));
    expect(nodeOf("pin:R1.b")).toBe("gnd");
  });

  it("leaves an unclipped lead end floating and warns about clips to nothing", () => {
    const bench = empty(null);
    bench.parts.push(battery());
    bench.leads.push(lead("TL1", "pin:B1.pos", null), lead("TL2", "pin:R9.a", null));
    const { nodeOf, warnings } = benchToNetlist(bench, IDEAL);
    expect(nodeOf("lead:TL1.b")).toBe(nodeOf("pin:B1.pos"));
    expect(nodeOf("lead:TL2.a")).not.toBe(nodeOf("pin:B1.pos"));
    expect(warnings.some((w) => w.startsWith("clip-missing: lead:TL2.a"))).toBe(true);
  });

  it("joins battery snap leads pushed into the rails", () => {
    const bench = empty();
    bench.parts.push(battery("B1", { pos: "tp3", neg: "tn3" }), resistor("R1", "tp40", "j40"));
    const { nodeOf } = benchToNetlist(bench);
    expect(nodeOf("pin:R1.a")).toBe(nodeOf("pin:B1.pos"));
    expect(nodeOf("hole:tn51")).toBe("gnd");
  });
});

describe("benchToNetlist: multimeter", () => {
  it("maps COM and VΩ to whatever the probe tips touch", () => {
    const bench = empty(null);
    bench.parts.push(battery());
    bench.meter = meter();
    bench.meter.probes.red.tip.to = "pin:B1.pos";
    bench.meter.probes.black.tip.to = "pin:B1.neg";
    const { netlist, nodeOf } = benchToNetlist(bench);
    const m = spec(netlist.parts, "M1", "multimeter");
    expect(m.mode).toBe("dcv");
    expect(m.pins.vohm).toBe(nodeOf("pin:B1.pos"));
    expect(m.pins.com).toBe("gnd");
    // Empty sockets float on their own nodes.
    expect(new Set([m.pins.ma, m.pins.a10, m.pins.vohm, m.pins.com]).size).toBe(4);
  });

  it("follows the red plug into the mA socket", () => {
    const bench = empty();
    bench.parts.push(battery(), resistor("R1", "a10", "a14"));
    bench.meter = meter({ mode: "dca-ma" });
    bench.meter.probes.red.socket = "ma";
    bench.meter.probes.red.tip.to = "hole:c14";
    bench.meter.probes.black.tip.to = "pin:B1.neg";
    const { netlist, nodeOf } = benchToNetlist(bench);
    const m = spec(netlist.parts, "M1", "multimeter");
    expect(m.pins.ma).toBe(nodeOf("pin:R1.b"));
    expect(m.pins.vohm).not.toBe(m.pins.ma);
    expect(m.pins.com).toBe("gnd");
  });

  it("ties a socket to nothing when its plug is out, and lets a clip grab a probe tip", () => {
    const bench = empty(null);
    bench.parts.push(battery());
    bench.meter = meter();
    bench.meter.probes.black.socket = null;
    bench.meter.probes.black.tip.to = "pin:B1.neg";
    bench.leads.push(lead("TL1", "probe:red", "pin:B1.pos"));
    const { netlist, nodeOf } = benchToNetlist(bench, IDEAL);
    const m = spec(netlist.parts, "M1", "multimeter");
    expect(m.pins.com).not.toBe("gnd");
    expect(m.pins.vohm).toBe(nodeOf("pin:B1.pos"));
  });
});
