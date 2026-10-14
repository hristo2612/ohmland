// Cable styles: the routes between clips, the tidy layout pass and lead colours by convention (src/cables).
import { describe, expect, it } from "vitest";
import { conventionColours } from "../src/cables/colours";
import { clutter } from "../src/cables/clutter";
import { polyInside } from "../src/cables/geom";
import { clipHeadings, routeCables, type RouteCable } from "../src/cables/route";
import { tidyBench } from "../src/cables/tidy";
import { inkClutter } from "../src/ink/clutter";
import { buildModel } from "../src/ink/model";
import { anchorPosition } from "../src/layout";
import { benchToNetlist } from "../src/netlist";
import * as ops from "../src/ops";
import type { BenchState, Vec2 } from "../src/types";

/** A battery, a switch block, a resistor and an LED on the desk, wired in a loop that crosses itself. */
function tangled(): BenchState {
  let b = ops.emptyBench(null);
  [b] = ops.addPart(b, "battery", {}, { pos: [-90, 0], rot: 270 }, "B1");
  [b] = ops.addPart(b, "toggle-switch", { base: true }, { pos: [40, 45] }, "S1");
  [b] = ops.addPart(b, "resistor", { ohms: 1000 }, { pos: [-10, 50] }, "R1");
  [b] = ops.addPart(b, "led", { color: "red" }, { pos: [50, -40], rot: 180 }, "D1");
  [b] = ops.addPart(b, "schematic", {}, { pos: [0, -110] }, "SD1");
  const lead = (from: string, to: string | null, id: string) => {
    [b] = ops.addLead(b, "red", [0, 60], id);
    b = ops.clipLead(b, id, "a", from);
    if (to) b = ops.clipLead(b, id, "b", to);
  };
  lead("pin:B1.pos", "pin:S1.com", "TL1");
  lead("pin:S1.b", "pin:D1.anode", "TL2");
  lead("pin:D1.cathode", "pin:R1.a", "TL3");
  lead("pin:R1.b", "pin:B1.neg", "TL4");
  lead("pin:R1.b", null, "TL5");
  return b;
}

const wiring = (b: BenchState) => b.leads.map((l) => [l.id, l.a.to, l.b.to]);

describe("tidy layout pass", () => {
  it("is deterministic and never changes what is connected to what", () => {
    const before = tangled();
    const once = tidyBench(before, { fixed: ["R1"] });
    const twice = tidyBench(before, { fixed: ["R1"] });
    expect(twice).toEqual(once);
    expect(wiring(once)).toEqual(wiring(before));
    expect(benchToNetlist(once).netlist).toEqual(benchToNetlist(before).netlist);
    // Every clip still bites the same metal, wherever its part now sits.
    for (const l of once.leads) for (const e of [l.a, l.b]) if (e.to) expect(anchorPosition(once, e.to)).not.toBeNull();
  });

  it("leaves furniture and parts the lab keeps in place where they are", () => {
    const before = tangled();
    const after = tidyBench(before, { fixed: ["R1"] });
    for (const id of ["R1", "SD1"]) expect(after.parts.find((p) => p.id === id)).toEqual(before.parts.find((p) => p.id === id));
  });

  it("untangles a loop that crosses itself", () => {
    const before = tangled();
    const judge = (b: BenchState) => inkClutter(buildModel(b, "tidy")).raw;
    const after = tidyBench(before, { judge });
    const was = inkClutter(buildModel(before, "tidy"));
    const now = inkClutter(buildModel(after, "tidy"));
    expect(now.crossings).toBeLessThan(was.crossings);
    expect(now.score).toBeLessThan(was.score);
  });
});

describe("cable routes", () => {
  const end = (tip: Vec2, dir: Vec2) => ({ tip, dir, tail: [tip[0] + dir[0] * 21, tip[1] + dir[1] * 21] as Vec2, attached: true });
  const cable: RouteCable = { id: "C1", a: end([-100, 0], [1, 0]), b: end([100, 0], [-1, 0]) };
  const block = { id: "X", poly: [[-20, -20], [20, -20], [20, 20], [-20, 20]] as Vec2[] };

  it("goes round a body in the way, the same way every time", () => {
    for (const style of ["drape", "tidy", "taped"] as const) {
      const r = routeCables(style, [cable], [block]).get("C1")!;
      expect(polyInside(block.poly, r), style).toBeLessThan(0.5);
      expect(routeCables(style, [cable], [block]).get("C1")).toEqual(r);
    }
  });

  it("lays taped runs along the grid", () => {
    const r = routeCables("taped", [{ ...cable, b: end([60, 70], [0, -1]) }], [block]).get("C1")!;
    let straight = 0;
    let total = 0;
    for (let i = 1; i < r.length; i++) {
      const dx = Math.abs(r[i]![0] - r[i - 1]![0]);
      const dz = Math.abs(r[i]![1] - r[i - 1]![1]);
      total += Math.hypot(dx, dz);
      if (dx < 0.01 || dz < 0.01) straight += Math.hypot(dx, dz);
    }
    expect(straight / total).toBeGreaterThan(0.85);
  });

  it("fans clips on one terminal out evenly, never back across the part", () => {
    const out: Vec2 = [0, 1];
    const sites = [-60, 0, 60].map((x, i) => ({ key: `L${i}.a`, at: [0, 0] as Vec2, toward: [x, 80] as Vec2, out }));
    const h = clipHeadings("drape", sites);
    const angles = sites.map((s) => Math.atan2(h.get(s.key)![1], h.get(s.key)![0]));
    // Left to right in the order their cables leave, evenly spaced.
    expect(angles[0]).toBeGreaterThan(angles[1]!);
    expect(angles[1]).toBeGreaterThan(angles[2]!);
    expect(angles[0]! - angles[1]!).toBeCloseTo(angles[1]! - angles[2]!, 5);
    for (const s of sites) expect(h.get(s.key)![1]).toBeGreaterThan(0);
  });
});

describe("clutter and colours", () => {
  it("counts a crossing and a lead across a part", () => {
    const e = (tip: Vec2) => ({ tip, tail: tip, attached: true, owners: [] });
    const c = clutter({
      cables: [
        { id: "A", a: e([-50, 0]), b: e([50, 0]), cable: [[-50, 0], [50, 0]] },
        { id: "B", a: e([0, -50]), b: e([0, 50]), cable: [[0, -50], [0, 50]] },
      ],
      bodies: [{ id: "P", poly: [[20, -5], [30, -5], [30, 5], [20, 5]], solid: true, family: [] }],
      frame: [-100, -100, 100, 100],
    });
    expect(c.crossings).toBe(1);
    expect(c.overParts).toBe(1);
  });

  it("makes the lead on plus red and the one on minus black, where the lab did not choose", () => {
    const b = tangled();
    const out = conventionColours(b, new Set(["TL1", "TL2", "TL4"]));
    const color = (id: string) => out.leads.find((l) => l.id === id)!.color;
    expect([color("TL1"), color("TL4")]).toEqual(["red", "black"]);
    expect(["red", "black"]).not.toContain(color("TL2"));
    expect(color("TL3")).toBe(b.leads.find((l) => l.id === "TL3")!.color);
  });
});
