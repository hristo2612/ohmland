import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECK, LANDMARKS, PIECES, isLandmark, isPiece, tiersOf } from "../src/catalog";
import { madeUp, seedFrom, type IsleEvent } from "../src/events";
import { EN } from "../src/messages";
import { atan2, cos, hypot, rng, sin } from "../src/math";
import { footCells, key, makeIsle, planHash, roadCells } from "../src/plan";

const run = (L: number, M: number, U = 1, seed = 7) => makeIsle(seed, madeUp(L, M, U));

describe("the isle plan", () => {
  it("is a pure function of the seed and the events", () => {
    expect(planHash(run(40, 10, 2))).toBe(planHash(run(40, 10, 2)));
    expect(planHash(run(40, 10, 2, 8))).not.toBe(planHash(run(40, 10, 2)));
  });

  it("matches the golden fingerprint for a fixed input", () => {
    // If this changes, every learner's isle changes. Only update it on purpose.
    expect(planHash(run(35, 12, 2, 20261013))).toBe("a198df23773eb91b");
  });

  it("never moves what is already placed when events are appended", () => {
    const events = madeUp(60, 15, 1);
    const before = makeIsle(11, events.slice(0, 30));
    const after = makeIsle(11, events);
    for (const it of before.items) {
      const same = after.items[it.id]!;
      expect([same.kind, same.x, same.z, same.rot, same.v, same.tiers[0]]).toEqual([it.kind, it.x, it.z, it.rot, it.v, it.tiers[0]]);
    }
  });

  it("places one piece per lesson and one landmark or rise per module, an island per unit", () => {
    const plan = run(120, 30, 5);
    const lessons = plan.items.filter((i) => i.story[0]!.type === "lesson");
    expect(lessons).toHaveLength(120);
    expect(lessons.every((i) => isPiece(i.kind))).toBe(true);
    expect(plan.items.filter((i) => i.landmark).every((i) => isLandmark(i.kind))).toBe(true);
    expect(plan.islands.map((i) => i.unit)).toEqual(["basics", "switching", "permanent", "chips", "beyond"]);
  });

  it("gives Start here its own island, with the spark gap, the pump house and the meter tower", () => {
    const lesson = (id: string): IsleEvent => ({ type: "lesson", unit: "start-here", piece: "led-lamp", title: "", id });
    const module = (landmark: string): IsleEvent => ({ type: "module", unit: "start-here", landmark, title: "", id: landmark });
    const events = [lesson("a"), module("spark-gap"), lesson("b"), module("pump-house"), lesson("c"), module("meter-tower")];
    const plan = makeIsle(5, [...events, { type: "lesson", unit: "basics", piece: "resistor", title: "", id: "d" }]);
    expect(plan.islands.map((i) => i.unit)).toEqual(["start-here", "basics"]);
    const marks = plan.items.filter((i) => i.landmark && i.island === 0).map((i) => i.kind);
    expect(marks).toEqual(["spark-gap", "pump-house", "meter-tower"]);
    expect(marks.every(isLandmark)).toBe(true);
  });

  it("deals the fallback deck without the same piece twice in a row", () => {
    const events: IsleEvent[] = Array.from({ length: 200 }, (_, i) => ({ type: "lesson", unit: "basics", piece: "", title: "", id: `l${i}` }));
    const placed = makeIsle(3, events).items.filter((i) => i.story[0]!.type === "lesson");
    for (let i = 1; i < placed.length; i++) expect(placed[i]!.kind).not.toBe(placed[i - 1]!.kind);
    expect(new Set(placed.map((p) => p.kind)).size).toBeGreaterThan(DECK.length / 2);
  });

  it("keeps every isle that names none of the kinds added since Unit 3 to 5 were drawn", () => {
    // Known and unknown pieces, unknown landmarks (the fallback rotation) and an unknown unit, over every older unit;
    // one module on each later island, so their landmarks never rise. Pinned before the new kinds were added.
    const pieces = ["resistor", "", "led-lamp", "nope", "capacitor", "wire-spool", "", "heatsink", "relay", "header-fence"];
    const events: IsleEvent[] = [];
    ["basics", "switching", "permanent", "chips", "beyond", "unit-x"].forEach((unit, u) => {
      const modules = ["basics", "switching", "unit-x"].includes(unit) ? 3 : 1;
      for (let m = 0; m < modules; m++) {
        for (let i = 0; i < 5; i++) events.push({ type: "lesson", unit, piece: pieces[(i * 3 + u + m) % pieces.length]!, title: `L${u}.${m}.${i}`, id: `${unit}-${m}-${i}` });
        const landmark = m === 1 && unit === "switching" ? "relay-clocktower" : `mystery-${m}`;
        events.push({ type: "module", unit, landmark, title: `M${u}.${m}`, id: `${unit}-m${m}` });
      }
    });
    expect(planHash(makeIsle(424242, events))).toBe("6bf0a82e2d8d8447");
  });

  it("builds Unit 3's island under either of its ids", () => {
    const at = (unit: string): IsleEvent[] => [
      { type: "lesson", unit: "basics", piece: "resistor", title: "", id: "a" },
      { type: "lesson", unit, piece: "iron-stand", title: "", id: "b" },
      { type: "module", unit, landmark: "nope", title: "", id: "c" },
    ];
    const plan = makeIsle(9, at("making-it-permanent"));
    expect(plan.islands.map((i) => i.unit)).toEqual(["basics", "permanent"]);
    expect(planHash(plan)).toBe(planHash(makeIsle(9, at("permanent"))));
    expect(plan.items.find((i) => i.landmark)?.kind).toBe("solder-forge");
  });

  it("names every piece, and every tier of every landmark", () => {
    for (const kind of [...PIECES, ...LANDMARKS]) {
      const name = EN.names[kind];
      expect(name, kind).toBeDefined();
      if (isLandmark(kind) && tiersOf(kind) > 1) expect(Array.isArray(name) ? name.length : 1, kind).toBe(tiersOf(kind));
    }
  });

  it("never puts two things on the same ground, nor anything on a trace or off the board", () => {
    const plan = run(300, 80, 5);
    for (const isl of plan.islands) {
      const land = new Set(isl.cells.map((c) => key(c.x, c.z)));
      const roads = roadCells(isl.traces, isl.plazas);
      const used = new Map<number, number>();
      for (const it of plan.items.filter((i) => i.island === isl.id)) {
        for (const [x, z] of footCells(it)) {
          const k = key(x, z);
          expect(used.get(k), `${it.kind} ${it.id} overlaps ${used.get(k)}`).toBeUndefined();
          used.set(k, it.id);
          expect(land.has(k), `${it.kind} ${it.id} stands on land`).toBe(true);
          expect(roads.has(k), `${it.kind} ${it.id} is off the traces`).toBe(false);
        }
      }
    }
  });

  it("plans 300 lessons, 80 modules and 5 units in under a second", () => {
    const t0 = performance.now();
    const plan = run(300, 80, 5);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(plan.items.length).toBeGreaterThan(300);
  });

  it("seeds from the first lesson", () => {
    expect(seedFrom("meet-the-meter", "2026-10-01T09:00:00.000Z")).toBe(seedFrom("meet-the-meter", "2026-10-01T09:00:00.000Z"));
    expect(seedFrom("meet-the-meter", "2026-10-01T09:00:00.000Z")).not.toBe(seedFrom("meet-the-meter", "2026-10-02T09:00:00.000Z"));
  });

  it("keeps three.js out of the package entry and the planner (the renderer loads on demand)", () => {
    for (const file of ["index.ts", "plan.ts", "events.ts", "catalog.ts", "math.ts", "messages.ts"]) {
      const src = readFileSync(join(import.meta.dirname, "../src", file), "utf8");
      const eager = [...src.matchAll(/^(?:import|export) (?!type )[^;]*?from "([^"]+)"/gm)].map((m) => m[1]!);
      expect(eager.filter((m) => m === "three" || m.startsWith("three/") || m.includes("render")), file).toEqual([]);
    }
  });

  it("keeps the engine's approximated Math out of the planner", () => {
    const approximated = /Math\.(sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)\b|\*\*/;
    for (const file of ["plan.ts", "events.ts", "catalog.ts", "math.ts"]) {
      const lines = readFileSync(join(import.meta.dirname, "../src", file), "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
      expect(lines.filter((l) => approximated.test(l)), file).toEqual([]);
    }
  });
});

describe("the planner's trigonometry", () => {
  it("stays within one unit in the last place of the engine's Math", () => {
    const r = rng(2026);
    const ulp = (x: number) => Math.max(Number.MIN_VALUE, Math.abs(x) * Number.EPSILON);
    for (let i = 0; i < 20_000; i++) {
      const a = (r() - 0.5) * (i % 10 === 0 ? 40_000 : 40);
      const x = (r() - 0.5) * 800;
      const z = (r() - 0.5) * 800;
      expect(Math.abs(sin(a) - Math.sin(a)) <= ulp(Math.sin(a)), `sin(${a})`).toBe(true);
      expect(Math.abs(cos(a) - Math.cos(a)) <= ulp(Math.cos(a)), `cos(${a})`).toBe(true);
      expect(Math.abs(atan2(z, x) - Math.atan2(z, x)) <= ulp(Math.atan2(z, x)), `atan2(${z}, ${x})`).toBe(true);
      expect(Math.abs(hypot(x, z) - Math.hypot(x, z)) <= ulp(Math.hypot(x, z)), `hypot(${x}, ${z})`).toBe(true);
    }
  });

  it("keeps the special cases", () => {
    expect([sin(0), cos(0), atan2(0, 1), atan2(1, 0), atan2(0, -1), hypot(3, 4), hypot(0, 0)]).toEqual([0, 1, 0, Math.PI / 2, Math.PI, 5, 0]);
    expect([sin(Infinity), cos(NaN), atan2(NaN, 1)].every(Number.isNaN)).toBe(true);
  });
});
