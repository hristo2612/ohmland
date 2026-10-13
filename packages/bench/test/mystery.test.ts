import { describe, expect, it } from "vitest";
import type { PartSpec } from "@ohmland/sim";
import { benchToNetlist } from "../src/netlist";
import { partLegs, physicalLeg, shuffleFor, terminalNumber, wiredAs } from "../src/parts";
import type { BenchState, PlacedPart } from "../src/types";

const bench = (parts: PlacedPart[]): BenchState => ({ v: 1, board: null, parts, wires: [], leads: [], meter: null });

const relay = (mystery?: string): PlacedPart => ({
  id: "K1",
  kind: "relay",
  params: { base: true, poles: 1, coilOhms: 540, pullIn: 6, dropOut: 1.8, ...(mystery ? { mystery } : {}) },
  pos: [0, 0],
  rot: 0,
});

describe("mystery parts", () => {
  it("wires each terminal as the leg its permutation names, and inverts consistently", () => {
    // Terminal 1 (coil1's place) is wired as nc1, terminal 3 (com1's place) as coil1, and so on.
    const k = relay("31402");
    expect(partLegs(k)).toEqual(["coil1", "coil2", "com1", "nc1", "no1"]);
    expect(wiredAs(k, "coil1")).toBe("nc1");
    expect(physicalLeg(k, "nc1")).toBe("coil1");
    for (const leg of partLegs(k)) expect(physicalLeg(k, wiredAs(k, leg))).toBe(leg);
    expect(terminalNumber(k, "com1")).toBe(3);

    const { netlist, nodeOf } = benchToNetlist(bench([k]));
    const spec = netlist.parts.find((p) => p.id === "K1") as Extract<PartSpec, { kind: "relay" }>;
    // The simulator's coil is on whichever terminals carry coil1 and coil2.
    expect(spec.pins.coilA).toBe(nodeOf(`pin:K1.${physicalLeg(k, "coil1")}`));
    expect(spec.pins.nc).toBe(nodeOf("pin:K1.coil1"));
    // A single-pole relay is one simulator relay at its own coil resistance.
    expect(netlist.parts.filter((p) => p.kind === "relay")).toHaveLength(1);
    expect(spec.coilOhms).toBe(540);
  });

  it("ignores a malformed permutation and never shuffles to the identity", () => {
    expect(wiredAs(relay("0123"), "coil1")).toBe("coil1");
    expect(wiredAs(relay("00123"), "coil2")).toBe("coil2");
    for (const seed of ["", "a", "learner|2026-01-01", "x:K1"]) {
      const p = shuffleFor(seed, 6);
      expect([...p].sort().join("")).toBe("012345");
      expect(p).not.toBe("012345");
      expect(shuffleFor(seed, 6)).toBe(p);
    }
  });
});
