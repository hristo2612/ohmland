import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { holeWorld } from "../src/board";
import { anchorPosition, partPose } from "../src/layout";
import * as ops from "../src/ops";
import { PART_KINDS } from "../src/parts";
import type { BenchState, PlacedPart } from "../src/types";
import { fitRect, panBy, screenToWorld, worldToScreen, zoomAt } from "../src/ink/camera";
import { hitTest, nextPoint, navPoints, shapeDistance } from "../src/ink/hit";
import { hasInkKind, PartDrawing } from "../src/ink/kinds";
import { anchorInk, buildModel, dialLabelLocal, targetOwners, targetPoint, toWorld } from "../src/ink/model";
import { lodFor, gridCell } from "../src/ink/view";
import { targetPoint as sharedTargetPoint } from "../src/view/targets";
import { demoBench, glowBench, propsBench, blocksBench } from "../playground/scenes";

const close = (a: readonly number[], b: readonly number[], eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]!) < eps);

describe("ink camera", () => {
  const vp = { w: 1000, h: 600 };
  it("maps desk to screen and back", () => {
    const c = { x: 12, z: -30, s: 7.5 };
    const [px, py] = worldToScreen(c, vp, 40, 10);
    expect(close(screenToWorld(c, vp, px, py), [40, 10])).toBe(true);
    expect(close(worldToScreen(c, vp, 12, -30), [500, 300])).toBe(true);
  });

  it("zooms toward the pointer, keeping the desk point under it", () => {
    const c = { x: 0, z: 0, s: 4 };
    const before = screenToWorld(c, vp, 820, 140);
    const z = zoomAt(c, vp, 820, 140, 1.7);
    expect(z.s).toBeCloseTo(6.8);
    expect(close(screenToWorld(z, vp, 820, 140), before, 1e-9)).toBe(true);
    const p = panBy(z, 30, -12);
    expect(close(worldToScreen(p, vp, ...before), [850, 128], 1e-9)).toBe(true);
  });

  it("fits a rectangle into the free part of the view", () => {
    const pad = { top: 60, right: 20, bottom: 20, left: 220 };
    const c = fitRect([-80, -30, 80, 30], vp, pad);
    const [x0, y0] = worldToScreen(c, vp, -80, -30);
    const [x1, y1] = worldToScreen(c, vp, 80, 30);
    expect(x0).toBeGreaterThanOrEqual(pad.left - 1e-6);
    expect(x1).toBeLessThanOrEqual(vp.w - pad.right + 1e-6);
    expect(y0).toBeGreaterThanOrEqual(pad.top - 1e-6);
    expect(y1).toBeLessThanOrEqual(vp.h - pad.bottom + 1e-6);
    // Centred in what is left.
    expect((x0 + x1) / 2).toBeCloseTo((pad.left + vp.w - pad.right) / 2);
  });

  it("picks a grid cell and a level of detail for the zoom", () => {
    for (const s of [0.7, 2, 5, 13, 40]) {
      const px = gridCell(s) * s;
      expect(px).toBeGreaterThanOrEqual(14);
      expect(px).toBeLessThanOrEqual(28.0001);
    }
    expect(lodFor(1.5)).toBe(0);
    expect(lodFor(3)).toBe(1);
    expect(lodFor(9)).toBe(2);
  });
});

describe("ink model: every lead lands on its true hole or clip point", () => {
  const bench = demoBench();
  const model = buildModel(bench);

  it("projects board pins onto their holes", () => {
    expect(close(anchorInk(model, "pin:R1.a")!, holeWorld(bench.board!, "e10")!)).toBe(true);
    expect(close(anchorInk(model, "pin:K1.no2")!, holeWorld(bench.board!, "f51")!)).toBe(true);
    expect(close(targetPoint(model, "hole:e12")!, holeWorld(bench.board!, "e12")!)).toBe(true);
  });

  it("matches the shared layout for every part's leads, on the desk and on the board", () => {
    for (const b of [demoBench(), glowBench(), propsBench(), blocksBench()]) {
      const m = buildModel(b);
      for (const p of b.parts) {
        const pose = partPose(b, p);
        for (const [leg, pos] of Object.entries(pose.legs)) {
          expect(close(anchorInk(m, `pin:${p.id}.${leg}`)!, [pos[0], pos[2]])).toBe(true);
          expect(close(m.parts.get(p.id)!.legs[leg]!, [pos[0], pos[2]])).toBe(true);
        }
      }
    }
  });

  it("puts probe tips on what they touch and clips on their leads", () => {
    const red = anchorInk(model, "probe:red")!;
    const anode = anchorPosition(bench, "pin:D1.anode")!;
    expect(close(red, [anode[0], anode[2]])).toBe(true);
    const tip = anchorInk(model, "lead:TL1.a")!;
    const pin = anchorPosition(bench, "pin:C1.pos")!;
    expect(Math.hypot(tip[0] - pin[0], tip[1] - pin[2])).toBeLessThan(1.5);
  });

  it("names parts, sub-parts and anchors for project() and focus()", () => {
    const lcd = targetPoint(model, "part:M1/display")!;
    const meter = targetPoint(model, "part:M1")!;
    // The display sits toward the far end of the meter.
    expect(lcd[1]).toBeLessThan(meter[1]);
    expect(targetPoint(model, "D1")).toEqual(targetPoint(model, "part:D1"));
    expect(targetPoint(model, "nothing")).toBeNull();
  });

  it("puts an LED's stress bar mark on the same desk point as the 3D view, behind the LED", () => {
    for (const b of [demoBench(), glowBench()]) {
      const m = buildModel(b);
      const shared = sharedTargetPoint(b, "part:D1/stress")!;
      expect(close(targetPoint(m, "part:D1/stress")!, [shared[0], shared[2]])).toBe(true);
      expect(shared[2]).toBeLessThan(sharedTargetPoint(b, "part:D1")![2]);
    }
  });

  it("works out what a spotlight keeps lit", () => {
    expect([...targetOwners(model, ["pin:R1.a", "hole:e12", "probe:red"])].sort()).toEqual(["M1", "R1", "board"]);
    const props = buildModel(propsBench());
    // A holder brings the part it holds, and the other way round.
    expect([...targetOwners(props, ["H1"])].sort()).toEqual(["H1", "R1"]);
    expect([...targetOwners(props, ["E2"])].sort()).toEqual(["E2", "FC1"]);
  });
});

describe("ink hit testing", () => {
  const bench = demoBench();
  const model = buildModel(bench);
  const pin = (a: string) => anchorInk(model, a)!;

  it("finds bodies, and handles before bodies", () => {
    const r1 = targetPoint(model, "part:R1")!;
    expect(hitTest(model, r1[0], r1[1], 0.5)).toMatchObject({ type: "part", id: "R1" });
    // A probe resting on the LED is on top of it, and grabbed first.
    const led = targetPoint(model, "part:D1")!;
    expect(hitTest(model, led[0], led[1], 0.5)).toMatchObject({ type: "probe", color: "red" });
    // A resistor's lead end is a stretch handle, even inside the reach of its body.
    expect(hitTest(model, ...pin("pin:R1.b"), 0.5)).toMatchObject({ type: "leg", id: "R1", leg: "b" });
    const cap = toWorld(model.parts.get("S1")!.f, 2.54, -1.5 * 2.54);
    expect(hitTest(model, cap[0], cap[1], 0.5)).toMatchObject({ type: "press", id: "S1" });
  });

  it("starts a pencil stroke beside a probe resting on a card, and takes the probe only by its grip", () => {
    const [withCard] = ops.addPart({ ...ops.emptyBench(null), meter: ops.defaultMeter([120, 20]) }, "card", { length: 0, layers: 0, wide: false }, { pos: [-30, 0] }, "P1");
    const card = buildModel(ops.touchProbe(withCard, "red", "pin:P1.p0"));
    const p0 = anchorInk(card, "pin:P1.p0")!;
    // A touch reaches a few millimetres: the tip and the grip are both within it, but the stroke wins on the strip.
    expect(hitTest(card, p0[0] + 1, p0[1], 6)).toEqual({ type: "draw", id: "P1" });
    const pr = card.meter!.probes.red;
    const grip: [number, number] = [pr.tip[0] + (pr.back[0] - pr.tip[0]) * 0.8, pr.tip[1] + (pr.back[1] - pr.tip[1]) * 0.8];
    expect(hitTest(card, grip[0], grip[1], 6)).toMatchObject({ type: "probe", color: "red" });
  });

  it("turns the meter dial and picks its positions", () => {
    const f = model.meter!.f;
    const knob = toWorld(f, 0, 12);
    expect(hitTest(model, knob[0], knob[1], 0.5)).toEqual({ type: "dial" });
    const ohm = toWorld(f, ...dialLabelLocal("ohm"));
    expect(hitTest(model, ohm[0], ohm[1], 0.5)).toEqual({ type: "dialMode", mode: "ohm" });
    const corner = toWorld(f, 30, 70);
    expect(hitTest(model, corner[0], corner[1], 0.5)).toEqual({ type: "meter" });
  });

  it("grabs clips, probes and plugs, and nothing on bare paper", () => {
    const li = model.leads.get("TL1")!;
    const mid: [number, number] = [(li.b.tip[0] + li.b.tail[0]) / 2, (li.b.tip[1] + li.b.tail[1]) / 2];
    expect(hitTest(model, ...mid, 0.5)).toMatchObject({ type: "clip", id: "TL1", end: "b" });
    const plug = model.meter!.probes.black.plug.at;
    expect(hitTest(model, plug[0], plug[1], 0.5)).toEqual({ type: "plug", color: "black" });
    expect(hitTest(model, -400, -400, 2)).toBeNull();
  });

  it("measures distances to shapes", () => {
    expect(shapeDistance({ t: "circle", x: 0, z: 0, r: 2 }, 5, 0)).toBeCloseTo(3);
    expect(shapeDistance({ t: "capsule", ax: 0, az: 0, bx: 10, bz: 0, r: 1 }, 5, 3)).toBeCloseTo(2);
    // Turned a quarter, the box runs down the page: (0, 4) is inside, 1 mm from its side.
    expect(shapeDistance({ t: "box", f: { ox: 0, oz: 0, rot: 90 }, b: [-5, -1, 5, 1] }, 0, 4)).toBeCloseTo(-1, 6);
    expect(shapeDistance({ t: "box", f: { ox: 0, oz: 0, rot: 90 }, b: [-5, -1, 5, 1] }, 4, 0)).toBeCloseTo(3, 6);
  });

  it("hits settings and the pencil card's drawing strip", () => {
    const m = buildModel(propsBench());
    const skin = m.parts.get("P1")!;
    const damp = toWorld(skin.f, -11, 62 / 2 - 9);
    expect(hitTest(m, damp[0], damp[1], 0.5)).toMatchObject({ type: "setting", id: "P1", key: "moisture", value: "damp" });
    const card = m.parts.get("P4")!;
    const strip = toWorld(card.f, -20, 2);
    expect(hitTest(m, strip[0], strip[1], 0.5)).toMatchObject({ type: "draw", id: "P4" });
  });
});

describe("ink keyboard navigation", () => {
  const bench = demoBench();
  const pts = navPoints(bench);
  const at = (a: string) => pts.find((p) => p.id === a)!.pos;
  it("steps hole by hole along rows and columns", () => {
    expect(nextPoint(pts, at("hole:a20"), "right")!.id).toBe("hole:a21");
    expect(nextPoint(pts, at("hole:a20"), "up")!.id).toBe("hole:b20");
    expect(nextPoint(pts, at("hole:b20"), "down")!.id).toBe("hole:a20");
    expect(nextPoint(pts, at("hole:j3"), "left")!.id).toBe("hole:j2");
  });
});

describe("ink registry", () => {
  const variants = (kind: PlacedPart["kind"]): Record<string, unknown>[] => {
    switch (kind) {
      case "battery":
        return [{}, { snap: true }, { size: "aa", chem: "nimh" }, { size: "coin" }, { worn: true }];
      case "relay":
        return [{}, { poles: 1 }, { base: true }, { base: true, poles: 1, mystery: "31402" }, { base: true, poles: 1, mystery: "31402", peek: true }];
      case "pushbutton":
      case "slide-switch":
        return [{}, { base: true, tag: "S1" }];
      case "toggle-switch":
        return [{}, { base: true }, { base: true, throws: 1 }];
      case "trimmer":
        return [{ ohms: 1e4, position: 0.2 }, { ohms: 1e4, position: 0.8, base: true }];
      case "resistor":
        return [{ ohms: 470 }, { ohms: 15, watts: 1 }, { ohms: 15, watts: 5 }, { ohms: 4700, bands: 5, tolerance: 1, actualOhms: 6000 }];
      default:
        return [{}];
    }
  };

  it("draws every part kind, in every variant, without throwing", () => {
    for (const kind of PART_KINDS) {
      for (const params of variants(kind)) {
        const [b, id] = ops.addPart(ops.emptyBench(null), kind, params as never, { pos: [0, 0] });
        const pi = buildModel(b).parts.get(id)!;
        const [x0, z0, x1, z1] = pi.box;
        expect(x1 - x0, kind).toBeGreaterThan(0);
        expect(z1 - z0, kind).toBeGreaterThan(0);
        const svg = renderToStaticMarkup(createElement("svg", null, createElement(PartDrawing, { pi, st: { i: 0, v: 0, p: 0, temp: 25, health: "dead", glow: 0.5 }, pressed: true, minutes: 75 })));
        expect(svg.length, kind).toBeGreaterThan(40);
      }
      expect(hasInkKind(kind), `${kind} has no ink drawing (it falls back to a labelled slip)`).toBe(true);
    }
  });

  it("draws a kind it does not know as a labelled slip", () => {
    const b = ops.emptyBench(null);
    const odd = { id: "Z1", kind: "flux-capacitor", params: {}, pos: [0, 0], rot: 0 } as unknown as PlacedPart;
    const bench: BenchState = { ...b, parts: [odd] };
    // partPose needs a part definition, so the slip is drawn from its box alone.
    expect(() => renderToStaticMarkup(createElement("svg", null, createElement(PartDrawing, { pi: { part: odd, pose: { mount: "desk", origin: [0, 0, 0], rot: 0, legs: {} }, f: { ox: 0, oz: 0, rot: 0 }, mount: "desk", box: [-11, -6, 11, 6], legs: {}, layer: 1 }, st: null, pressed: false, minutes: 0 })))).not.toThrow();
    expect(bench.parts).toHaveLength(1);
  });
});

describe("ink stays free of three.js", () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
  const banned = /^(three|three\/.*|@react-three\/.*|postprocessing)$/;

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
    });
  }

  function resolveLocal(from: string, spec: string): string | null {
    const base = resolve(dirname(from), spec);
    for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
      try {
        if (statSync(c).isFile()) return c;
      } catch {
        // try the next one
      }
    }
    return null;
  }

  it("imports nothing from three, react-three or postprocessing, directly or through shared modules", () => {
    const seen = new Set<string>();
    const queue = files(join(src, "ink"));
    const bad: string[] = [];
    while (queue.length) {
      const f = queue.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      const text = readFileSync(f, "utf8");
      // Type-only imports are erased and cost nothing at run time.
      for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm)) {
        const spec = m[1]!;
        if (banned.test(spec)) bad.push(`${f.slice(src.length)} -> ${spec}`);
        if (spec.startsWith(".")) {
          const r = resolveLocal(f, spec);
          if (r) queue.push(r);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(seen.size).toBeGreaterThan(15);
  });
});
