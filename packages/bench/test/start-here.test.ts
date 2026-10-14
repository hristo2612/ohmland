// The Start here props and overlays, pure: gates, sealed boxes, insulated spots, everyday objects, the tracer, push.

import { describe, expect, it } from "vitest";
import { createSimulation, type Snapshot } from "@ohmland/sim";
import { advanceGates, dotRate, dotSpeed, expandPrefix, flowMap, formatGate, gateAmps, hatchSpacing, pushMap, tagText, traceLoop } from "../src/flow";
import { anchorPosition, clipTargets } from "../src/layout";
import { benchToNetlist } from "../src/netlist";
import { addPart, emptyBench, movePart, removeLead, seatPart, setPartParams } from "../src/ops";
import { conducts, materialOhms, partDef } from "../src/parts";
import { hiddenParts, holderOf } from "../src/seats";
import { APART_MM, MAX_MARKS, apart, lifting, stuckTo } from "../src/static";
import { STATIC } from "../src/dims";
import { targetPoint } from "../src/view/targets";
import { buildModel, targetPoint as inkPoint } from "../src/ink/model";
import { schematicSlot } from "../src/parts";
import { createBenchStore } from "../src/store";
import type { BenchState, PlacedPart, SampleMaterial } from "../src/types";

const part = (id: string, kind: PlacedPart["kind"], params: Record<string, unknown>, pos: [number, number] = [0, 0], rot = 0): PlacedPart =>
  ({ id, kind, params, pos, rot }) as PlacedPart;
const lead = (id: string, a: string | null, b: string | null, apos: [number, number] = [0, 0], bpos: [number, number] = [0, 0]) => ({
  id,
  color: "red" as const,
  a: { to: a, pos: apos },
  b: { to: b, pos: bpos },
});

/** The standard Start here lamp loop on the desk: B1, S1 (on), R1 1 kΩ, D1, four clip leads. */
function lampLoop(firstClip = "pin:B1.pos"): BenchState {
  return {
    ...emptyBench(null),
    parts: [
      part("B1", "battery", { emf: 9.4, internalOhms: 1.7, mAh: 500 }, [-80, 0], 270),
      part("S1", "toggle-switch", { base: true, to: "b" }, [-10, -40]),
      part("R1", "resistor", { ohms: 1000 }, [50, -10]),
      part("D1", "led", { color: "red", maxmA: 50 }, [40, 40]),
    ],
    leads: [lead("TL1", firstClip, "pin:S1.com"), lead("TL2", "pin:S1.b", "pin:R1.a"), lead("TL3", "pin:R1.b", "pin:D1.anode"), lead("TL4", "pin:D1.cathode", "pin:B1.neg")],
  };
}

function run(bench: BenchState, seconds = 0.6): Snapshot {
  const sim = createSimulation();
  sim.load(benchToNetlist(bench).netlist);
  return sim.step(seconds);
}

describe("insulated spots: a clip on plastic or wood joins nothing", () => {
  it("a clip on the battery's wrapper leaves the loop open; on the snap it closes", () => {
    const open = lampLoop("pin:B1.wrap");
    const net = benchToNetlist(open);
    expect(net.warnings.filter((w) => w.startsWith("clip-missing"))).toEqual([]);
    expect(net.nodeOf("lead:TL1.a")).not.toBe(net.nodeOf("pin:B1.pos"));
    expect(run(open).parts.D1!.glow ?? 0).toBeLessThan(0.01);
    expect(run(lampLoop()).parts.D1!.glow ?? 0).toBeGreaterThan(0.5);
  });

  it("spots have a place a clip can reach, on the battery, the switch's block and the coated clip", () => {
    const b: BenchState = { ...lampLoop(), parts: [...lampLoop().parts, part("PC1", "sample", { material: "clip" }, [0, 80])] };
    const targets = clipTargets(b).map((t) => t.anchor);
    for (const a of ["pin:B1.wrap", "pin:S1.base", "pin:PC1.coat"]) {
      expect(targets).toContain(a);
      expect(anchorPosition(b, a)).not.toBeNull();
    }
    // A toggle switch on the board has no wooden block, so no spot.
    expect(partDef("toggle-switch").spots?.({ to: "a" })).toEqual({});
  });

  it("the coated paper clip conducts only between its bare ends", () => {
    const b: BenchState = {
      ...emptyBench(null),
      parts: [part("B1", "battery", { emf: 9.4 }, [-80, 0]), part("R1", "resistor", { ohms: 1000 }, [0, -40]), part("D1", "led", { color: "red", maxmA: 50 }, [40, 30]), part("PC1", "sample", { material: "clip" }, [0, 40])],
      leads: [lead("TL1", "pin:B1.pos", "pin:R1.a"), lead("TL2", "pin:R1.b", "pin:PC1.a"), lead("TL3", "pin:PC1.coat", "pin:D1.anode"), lead("TL4", "pin:D1.cathode", "pin:B1.neg")],
    };
    expect(run(b).parts.D1!.glow ?? 0).toBeLessThan(0.01);
    const fixed = { ...b, leads: b.leads.map((l) => (l.id === "TL3" ? lead("TL3", "pin:PC1.b", "pin:D1.anode") : l)) };
    const s = run(fixed);
    expect(s.parts.D1!.glow ?? 0).toBeGreaterThan(0.5);
    expect(Math.abs(s.parts.PC1!.i)).toBeGreaterThan(1e-3);
  });
});

describe("everyday objects", () => {
  it("metals and graphite conduct; plastic, rubber, glass, wood and string do not", () => {
    const yes: SampleMaterial[] = ["key", "coin", "foil", "pencil", "clip", "copper"];
    const no: SampleMaterial[] = ["spoon", "eraser", "marble", "wood", "string", "plastic"];
    for (const m of yes) expect(conducts(m)).toBe(true);
    for (const m of no) expect(conducts(m)).toBe(false);
    expect(materialOhms("pencil")).toBe(5);
    expect(materialOhms("foil")).toBe(0.01);
  });

  it("bridging the lamp's gap: the key lights it, the spoon leaves it dark, the pencil lead lights it too", () => {
    const withSample = (material: SampleMaterial): BenchState => ({
      ...emptyBench(null),
      parts: [part("B1", "battery", { emf: 9.4, internalOhms: 1.7 }, [-80, 0]), part("R1", "resistor", { ohms: 1000 }, [0, -40]), part("D1", "led", { color: "red", maxmA: 50 }, [40, 30]), part("K1", "sample", { material }, [0, 60])],
      leads: [lead("TL1", "pin:B1.pos", "pin:R1.a"), lead("TL2", "pin:R1.b", "pin:K1.a"), lead("TL3", "pin:K1.b", "pin:D1.anode"), lead("TL4", "pin:D1.cathode", "pin:B1.neg")],
    });
    expect(run(withSample("key")).parts.D1!.glow ?? 0).toBeGreaterThan(0.5);
    expect(run(withSample("spoon")).parts.D1!.glow ?? 0).toBeLessThan(0.01);
    expect(run(withSample("pencil")).parts.D1!.glow ?? 0).toBeGreaterThan(0.5);
  });

  it("sorting trays take objects; a drawer takes only its own kind", () => {
    let b: BenchState = {
      ...emptyBench(null),
      parts: [part("YES", "bin", { style: "tray" }, [0, 0]), part("DR", "bin", { style: "drawer", face: "resistor" }, [200, 0]), part("K1", "sample", { material: "key" }, [0, 100]), part("D1", "led", { color: "red" }, [200, 100]), part("R1", "resistor", { ohms: 1000 }, [150, 100])],
    };
    b = movePart(b, "K1", [-48, -4]);
    expect(holderOf(b, "K1")?.holder.id).toBe("YES");
    // Dropped anywhere on the tray, even on a filed object, a part takes the nearest free seat.
    b = { ...b, parts: [...b.parts, part("CN1", "sample", { material: "coin" }, [0, 140])] };
    b = movePart(b, "CN1", [-44, 20]);
    expect([holderOf(b, "K1")?.holder.id, holderOf(b, "CN1")?.holder.id]).toEqual(["YES", "YES"]);
    b = movePart(b, "D1", [180, -4]);
    expect(holderOf(b, "D1")).toBeNull();
    b = movePart(b, "R1", [180, -4]);
    expect(holderOf(b, "R1")?.holder.id).toBe("DR");
  });

  it("a part dragged out of a bin over a full seat leaves the part in it alone", () => {
    let b: BenchState = { ...emptyBench(null), parts: [part("BIN", "bin", {}, [0, 0]), part("R2", "resistor", { ohms: 470 }, [0, 80]), part("R5", "resistor", { ohms: 1000 }, [40, 80])] };
    b = seatPart(seatPart(b, "R2", "BIN", "s2"), "R5", "BIN", "s3");
    // On its way (as a drag moves it), right over R5's seat, then off to the desk; dropped there by hand.
    for (const to of [[-12, 4], [0, 0], [4, 30], [10, 80]] as [number, number][]) b = movePart(b, "R2", to, { seat: false });
    b = movePart(b, "R2", [10, 80], { seat: "free" });
    expect(holderOf(b, "R2")).toBeNull();
    expect(holderOf(b, "R5")?.seat.name).toBe("s3");
    // Dropped right on R5's seat by hand, it takes a free one, never R5's.
    b = movePart(b, "R2", [0, 0], { seat: "free" });
    expect(holderOf(b, "R5")?.seat.name).toBe("s3");
    expect(holderOf(b, "R2")?.seat.name).not.toBe("s3");
  });
});

describe("a battery's starting charge", () => {
  it("maps `charge` onto the simulator's state of charge", () => {
    const b: BenchState = { ...lampLoop(), parts: lampLoop().parts.map((p) => (p.id === "B1" ? ({ ...p, params: { ...p.params, charge: 0.08 } } as PlacedPart) : p)) };
    const spec = benchToNetlist(b).netlist.parts.find((p) => p.id === "B1");
    expect(spec).toMatchObject({ kind: "battery", soc: 0.08 });
    expect(Number(run(b, 0.2).parts.B1!.extra!.soc)).toBeCloseTo(0.08, 3);
    expect(benchToNetlist(lampLoop()).netlist.parts.find((p) => p.id === "B1")).not.toHaveProperty("soc");
  });
});

describe("sealed boxes", () => {
  const boxBench = (lid = false): BenchState => {
    let b: BenchState = {
      ...emptyBench(null),
      parts: [
        part("BOXB", "box", { lid, label: "B", wiring: { "s1.pos": "t1", "s1.neg": "t2" } }, [0, 0]),
        part("B1", "battery", { emf: 9.4 }, [0, 0]),
        part("R1", "resistor", { ohms: 1000 }, [100, -40]),
        part("D1", "led", { color: "red", maxmA: 50 }, [120, 30]),
      ],
      leads: [lead("TL1", "pin:BOXB.t1", "pin:R1.a"), lead("TL2", "pin:R1.b", "pin:D1.anode"), lead("TL3", "pin:D1.cathode", "pin:BOXB.t2")],
    };
    b = seatPart(b, "B1", "BOXB", "s1");
    return b;
  };

  it("hides what is inside while the lid is shut, and nothing can clip onto it", () => {
    const shut = boxBench();
    expect([...hiddenParts(shut)]).toEqual(["B1"]);
    expect(clipTargets(shut).some((t) => t.anchor.startsWith("pin:B1."))).toBe(false);
    expect(clipTargets(shut).map((t) => t.anchor)).toContain("pin:BOXB.t1");
    const open = setPartParams(shut, "BOXB", { lid: true });
    expect(hiddenParts(open).size).toBe(0);
    expect(clipTargets(open).some((t) => t.anchor === "pin:B1.pos")).toBe(true);
  });

  it("its terminals are wired to the battery inside: the lamp lights through the box", () => {
    const b = boxBench();
    const { nodeOf } = benchToNetlist(b, { leadOhms: 0 });
    expect(nodeOf("pin:BOXB.t1")).toBe(nodeOf("pin:B1.pos"));
    expect(nodeOf("pin:BOXB.t2")).toBe(nodeOf("pin:B1.neg"));
    expect(run(b).parts.D1!.glow ?? 0).toBeGreaterThan(0.5);
    // The push view shows the box's own push as a hill.
    expect(pushMap(b, run(b)).hills.BOXB).toBeGreaterThan(9);
  });

  it("a knob box: the knob turns the trimmer inside, and junctions join parts inside", () => {
    let b: BenchState = {
      ...emptyBench(null),
      parts: [
        part("KB", "box", { knob: true, wiring: { "s1.a": "t1", "s1.wiper": "j1", "s2.a": "j1", "s2.b": "t2" } }, [0, 0]),
        part("RV1", "trimmer", { ohms: 10_000, position: 0, base: true }, [0, 0]),
        part("R9", "resistor", { ohms: 470 }, [0, 0]),
      ],
    };
    b = seatPart(seatPart(b, "RV1", "KB", "s1"), "R9", "KB", "s2");
    const { nodeOf } = benchToNetlist(b, { leadOhms: 0 });
    expect(nodeOf("pin:RV1.wiper")).toBe(nodeOf("pin:R9.a"));
    expect(nodeOf("pin:R9.b")).toBe(nodeOf("pin:KB.t2"));
    b = setPartParams(b, "KB", { position: 0.8 } as never);
    expect((b.parts.find((p) => p.id === "RV1")!.params as { position: number }).position).toBe(0.8);
  });
});

describe("gates", () => {
  it("clip onto the lead they are dropped on, and read its current", () => {
    let b = lampLoop();
    [b] = addPart(b, "gate", {}, { pos: [0, 200] }, "G1");
    const a = anchorPosition(b, "lead:TL3.a")!;
    const c = anchorPosition(b, "lead:TL3.b")!;
    b = movePart(b, "G1", [(a[0] + c[0]) / 2 + 3, (a[2] + c[2]) / 2]);
    const g = b.parts.find((p) => p.id === "G1")!;
    expect(g.params).toMatchObject({ on: "TL3" });
    const s = run(b);
    expect(Math.abs(gateAmps(b, s, "G1"))).toBeGreaterThan(7e-3);
    // Dropped on bare desk it lets go.
    const off = movePart(b, "G1", [0, 300]);
    expect(off.parts.find((p) => p.id === "G1")!.params).not.toHaveProperty("on");
    expect(gateAmps(off, s, "G1")).toBe(0);
    // Removing the lead drops the gate.
    expect(removeLead(b, "TL3").parts.find((p) => p.id === "G1")!.params).not.toHaveProperty("on");
  });

  it("count the dots that pass: two gates on one loop agree, a slower current counts slower", () => {
    let b = lampLoop();
    [b] = addPart(b, "gate", { on: "TL3", at: 0.5 }, { pos: [0, 0] }, "G1");
    [b] = addPart(b, "gate", { on: "TL4", at: 0.5 }, { pos: [0, 0] }, "G2");
    const s = run(b);
    let counts = {};
    for (let k = 0; k < 30; k++) counts = advanceGates(counts, b, s, 1 / 30);
    const c = counts as Record<string, number>;
    expect(c.G1).toBeCloseTo(c.G2!, 6);
    expect(c.G1).toBeCloseTo(dotRate(7.5e-3), 0);
    // A gate clipped on later starts both counts again, so the two read the same number.
    let one = lampLoop();
    [one] = addPart(one, "gate", { on: "TL3", at: 0.5 }, { pos: [0, 0] }, "G1");
    let late: Record<string, number> = {};
    for (let k = 0; k < 30; k++) late = advanceGates(late, one, s, 1 / 30);
    expect(late.G1).toBeGreaterThan(1);
    for (let k = 0; k < 30; k++) late = advanceGates(late, b, s, 1 / 30);
    expect(late.G1).toBeCloseTo(late.G2!, 6);
    expect(late.G1).toBeCloseTo(c.G1!, 6);
    expect(dotSpeed(0.7e-3)).toBeLessThan(dotSpeed(16e-3) / 2.5);
    expect(dotSpeed(0)).toBe(0);
    expect(dotSpeed(10)).toBe(40);
  });

  it("the store counts as snapshots arrive", () => {
    let b = lampLoop();
    [b] = addPart(b, "gate", { on: "TL3", at: 0.5 }, { pos: [0, 0] }, "G1");
    const store = createBenchStore(b);
    const sim = createSimulation();
    sim.load(benchToNetlist(b).netlist);
    for (let k = 0; k < 60; k++) store.setState({ snapshot: sim.step(1 / 30) });
    expect(store.getState().gates.G1).toBeGreaterThan(dotRate(7e-3) * 1.8);
    expect(store.getState().gates.G1).toBeLessThan(dotRate(8e-3) * 2.1);
  });

  it("write their reading in A or mA", () => {
    expect(formatGate(0.0075, "A")).toBe("0.0075 A");
    expect(formatGate(0.0075, "mA")).toBe("7.5 mA");
    expect(formatGate(-0.0161, "mA")).toBe("16.1 mA");
  });
});

describe("flow", () => {
  it("every lead of a series loop carries the same current, and the battery's runs minus to plus inside", () => {
    const b = lampLoop();
    const f = flowMap(b, run(b));
    const values = Object.values(f.leads);
    expect(values).toHaveLength(4);
    for (const v of values) expect(v).toBeCloseTo(values[0]!, 6);
    const bat = f.parts.find((p) => p.id === "B1")!;
    expect(bat.amps).toBeLessThan(0); // pos to neg through the part is negative while it delivers
    const sw = f.parts.find((p) => p.id === "S1")!;
    expect([sw.from, sw.to]).toEqual(["com", "b"]);
  });

  it("works out a jumper's current from the parts on one side of it", () => {
    const b: BenchState = {
      ...emptyBench({ kind: "bb400" }),
      parts: [
        part("B1", "battery", { snap: true, emf: 9.4 }, [-120, 0], 0),
        part("R1", "resistor", { ohms: 1000 }, [0, 0]),
        part("D1", "led", { color: "red" }, [0, 0]),
      ],
      wires: [{ id: "W1", a: "a9", b: "bn9", color: "black" }],
    };
    b.parts[0] = { ...b.parts[0]!, holes: { pos: "bp2", neg: "bn2" } } as PlacedPart;
    b.parts[1] = { ...b.parts[1]!, holes: { a: "bp4", b: "c4" } } as PlacedPart;
    b.parts[2] = { ...b.parts[2]!, holes: { anode: "e4", cathode: "e9" } } as PlacedPart;
    const s = run(b);
    const f = flowMap(b, s);
    // Current flows from the LED's strip (a side, a9) down to the minus rail (b side).
    expect(f.wires.W1).toBeCloseTo(s.parts.D1!.i, 6);
    expect(f.wires.W1!).toBeGreaterThan(7e-3);
  });
});

describe("push", () => {
  it("hatches leads by their volts and draws each battery's push as a hill", () => {
    const b = lampLoop();
    const p = pushMap(b, run(b));
    expect(p.hills.B1).toBeGreaterThan(9);
    // TL1 sits at the battery's plus, TL4 at its minus.
    expect(p.leads.TL1![0]).toBeGreaterThan(9);
    expect(p.leads.TL4![1]).toBeLessThan(0.01);
    expect(hatchSpacing(9)).toBeLessThan(hatchSpacing(1.5));
    expect(hatchSpacing(0)).toBe(Infinity);
  });
});

describe("the loop tracer", () => {
  it("runs from the minus snap all the way round and stops one clip short at the wrapper", () => {
    const t = traceLoop(lampLoop("pin:B1.wrap"), "pin:B1.neg");
    expect(t.closed).toBe(false);
    expect(t.gap).toBe("pin:B1.wrap");
    expect(t.parts).toEqual(["D1", "R1", "S1"]);
    expect(t.leads).toEqual(["TL4", "TL3", "TL2", "TL1"]);
  });

  it("closes the loop once the clip is on the snap, and stops at an open switch", () => {
    const t = traceLoop(lampLoop(), "pin:B1.neg");
    expect(t.closed).toBe(true);
    expect(t.parts).toEqual(["D1", "R1", "S1", "B1"]);
    const off = setPartParams(lampLoop(), "S1", { to: "a" } as never);
    const u = traceLoop(off, "pin:B1.neg");
    expect(u.closed).toBe(false);
    expect(u.gap).toBe("pin:S1.b");
  });

  it("stops at a loose clip and at the wooden block", () => {
    const loose = { ...lampLoop(), leads: lampLoop().leads.map((l) => (l.id === "TL2" ? lead("TL2", null, "pin:R1.a", [-20, 30]) : l)) };
    expect(traceLoop(loose, "pin:B1.neg").gap).toBe("lead:TL2.a");
    const block = { ...lampLoop(), leads: lampLoop().leads.map((l) => (l.id === "TL2" ? lead("TL2", "pin:S1.base", "pin:R1.a") : l)) };
    expect(traceLoop(block, "pin:B1.neg").gap).toBe("pin:S1.base");
  });
});

describe("tags", () => {
  it("write a value out without its prefix", () => {
    expect(expandPrefix("10 kΩ")).toBe("10,000 Ω");
    expect(expandPrefix("4.7 kΩ")).toBe("4,700 Ω");
    expect(expandPrefix("20 mA")).toBe("0.02 A");
    expect(expandPrefix("2.2 MΩ")).toBe("2,200,000 Ω");
    expect(expandPrefix("9 V")).toBe("9 V");
    expect(tagText("470 Ω", true)).toBe("470 Ω");
    expect(tagText("1 kΩ", false)).toBe("1 kΩ");
  });
});

describe("the static toy", () => {
  const toy = (): BenchState => ({
    ...emptyBench(null),
    parts: [
      part("SF1", "scarf", {}, [0, 100]),
      part("BL1", "balloon", {}, [-30, 100]),
      part("BL2", "balloon", {}, [140, 0]),
      part("WL1", "wall", {}, [0, -100]),
      part("PB1", "paper", {}, [100, 100]),
      part("MS1", "sample", { material: "metal-spoon" }, [20, 100]),
      part("CB1", "comb", {}, [-200, 0]),
    ],
  });
  const q = (b: BenchState, id: string) => (b.parts.find((p) => p.id === id)!.params as { charge?: number }).charge ?? 0;

  it("rubbing on the scarf moves charge onto a balloon (minus) and leaves the scarf plus; metal keeps none", () => {
    let b = toy();
    for (let k = 0; k < 8; k++) b = movePart(b, "BL1", [k % 2 ? -30 : 30, 100]);
    expect(q(b, "BL1")).toBeLessThan(-MAX_MARKS + 0.01);
    expect(q(b, "SF1")).toBeCloseTo(-q(b, "BL1"), 6);
    for (let k = 0; k < 8; k++) b = movePart(b, "MS1", [k % 2 ? -20 : 20, 100]);
    expect(q(b, "MS1")).toBe(0);
    // Moving it off the scarf does not rub it.
    const before = q(b, "BL1");
    b = movePart(b, "BL1", [-30, 0]);
    expect(q(b, "BL1")).toBe(before);
  });

  it("a charged balloon lifts the paper bits and sticks to the wall; an uncharged one falls off it", () => {
    let b = toy();
    for (let k = 0; k < 4; k++) b = movePart(b, "BL1", [k % 2 ? -30 : 30, 100]);
    expect(lifting(b, "PB1")).toBeNull();
    b = movePart(b, "BL1", [100, 80]);
    expect(lifting(b, "PB1")).toBe("BL1");
    const face = -100 + STATIC.wallD / 2 + STATIC.balloon / 2;
    b = movePart(b, "BL1", [0, face + 2]);
    expect(stuckTo(b, "BL1")).toBe("WL1");
    b = movePart(b, "BL2", [40, face + 2]);
    expect(stuckTo(b, "BL2")).toBeNull();
    expect(b.parts.find((p) => p.id === "BL2")!.pos[1]).toBeGreaterThan(face + 20);
  });

  it("two charged balloons push each other apart", () => {
    let b = toy();
    for (const id of ["BL1", "BL2"]) {
      b = movePart(b, id, [0, 100]);
      for (let k = 0; k < 6; k++) b = movePart(b, id, [k % 2 ? -30 : 30, 100]);
      b = movePart(b, id, id === "BL1" ? [-100, 0] : [-90, 0]);
    }
    expect(apart(b, "BL1", "BL2")).toBeGreaterThanOrEqual(APART_MM);
  });
});

describe("marks: named spots on a part, for taps and notes in both views", () => {
  it("a drawing's symbols, a box's lid and knob, a lead of a part", () => {
    const b: BenchState = {
      ...emptyBench(null),
      parts: [
        part("SD1", "schematic", { symbols: [{ kind: "battery", part: "B1" }, { kind: "resistor", part: "R1" }, { kind: "led", part: "D1" }] }, [40, 60]),
        part("KB", "box", { knob: true }, [-100, 0]),
        part("R1", "resistor", { ohms: 1000 }, [100, -50]),
      ],
    };
    const [x, z] = schematicSlot(3, 1);
    const p = targetPoint(b, "part:SD1/R1")!;
    expect([p[0], p[2]]).toEqual([40 + x, 60 + z]);
    // The ink view puts the mark at the same desk point.
    const q = inkPoint(buildModel(b), "part:SD1/R1")!;
    expect(q[0]).toBeCloseTo(p[0], 6);
    expect(q[1]).toBeCloseTo(p[2], 6);
    expect(targetPoint(b, "part:KB/knob")).not.toBeNull();
    expect(targetPoint(b, "part:KB/nothing")).toBeNull();
    expect(targetPoint(b, "part:R1/a")).toEqual(anchorPosition(b, "pin:R1.a"));
  });
});
