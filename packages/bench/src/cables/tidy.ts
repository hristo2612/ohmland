// The tidy layout pass (cable style "tidy"): nudges where desk parts and loose clips start, within a lab's intent, so
// the loop reads clockwise from the battery at the left, leads are short and nothing crosses. Pure and deterministic.
//
// It only ever changes where a desk part sits (and turns a small two-legged part by quarter turns) and where a loose
// clip lies. It never changes what is clipped to what, never touches the board, a part in a holder or a box, a part
// on flying leads, furniture (a drawing card, a box, a chart) or a part the lab keeps in place (`fixed`).

import { parseAnchor } from "../anchors";
import { BATTERY, BLOCK, CUP, HOLDER, LEMON, OBJECT, SKIN, STATION, TOGGLE_BASE, blockWidth, AA, COIN } from "../dims";
import { anchorPosition, isOnBoard, partPose, workCenter } from "../layout";
import { isFlying, partDef, partLegs, rotateXZ } from "../parts";
import { hiddenParts, holderOf } from "../seats";
import { perfMount } from "../solder/perfboard";
import type { BenchState, PlacedPart, TestLead, Vec2 } from "../types";
import { centroid, convexOverlap, dist, inRect, shrink, type Rect } from "./geom";
import { clutter, type ClutterBody, type ClutterCable, type ClutterScene } from "./clutter";
import { arcPoints, clipHeadings, type ClipSite } from "./route";

export type TidyOptions = {
  /** Part ids the lab keeps exactly where it put them. */
  fixed?: readonly string[];
  /** A part's outline in its own frame, [x0, z0, x1, z1] mm (default: an estimate from its kind and leads). */
  footprint?: (part: PlacedPart) => Rect | null;
  /** The lab's frame: parts stay inside it. */
  frame?: Rect | null;
  /**
   * How cluttered a bench looks as the view really draws it (lower is clearer). The pass lays the bench out a few
   * ways and keeps the clearest; without it, its own sketch of the drawing judges.
   */
  judge?: (bench: BenchState) => number;
};

/** Things that are where they are for a reason: drawings, boxes, charts, trays, the static toy, soldering tools. */
const FURNITURE = new Set<string>([
  "box",
  "schematic",
  "piece",
  "card",
  "chart",
  "clock",
  "showcase",
  "bin",
  "tag",
  "wall",
  "scarf",
  "paper",
  "balloon",
  "comb",
  "perfboard",
  "plan-card",
  "solder-station",
  "solder-spool",
  "solder-braid",
  "heat-gun",
  "wire-stripper",
  "heat-shrink",
  "heat-sink-clip",
  "wall-adapter",
  "barrel-jack",
  "mcu-board",
  "gate",
]);

/** Small two-legged parts that may turn by quarter turns. */
const TURNABLE = new Set<string>(["resistor", "diode", "led", "fuse", "ceramic-cap", "electrolytic-cap"]);

/** Supplies: where the loop starts. */
const SUPPLIES = new Set<string>(["battery", "lemon", "battery-pack", "bench-supply", "station"]);

/** How far a part may move from where the lab put it (mm). */
const REACH = 60;

/** An estimate of a part's outline in its frame: its kind's body, and its leads. */
export function estimateFootprint(part: PlacedPart): Rect {
  const p = part.params as Record<string, unknown>;
  const k = part.kind;
  if (k === "battery") {
    const size = (p["size"] as string | undefined) ?? "9v";
    if (size === "aa") return [-AA.len / 2, -AA.dia / 2 - 1, AA.len / 2, AA.dia / 2 + 1];
    if (size === "coin") return [-COIN.tab - 2, -COIN.holder / 2, COIN.tab + 2, COIN.holder / 2];
    return [-BATTERY.wid / 2, -3.4, BATTERY.wid / 2 + 4.5, BATTERY.len];
  }
  if (k === "toggle-switch" && p["base"]) return [-TOGGLE_BASE.w / 2, -TOGGLE_BASE.d / 2, TOGGLE_BASE.w / 2, TOGGLE_BASE.d / 2];
  if (p["base"] || k === "dpdt-switch") {
    const w = blockWidth(partLegs(part).length);
    return [-w / 2, -BLOCK.d / 2, w / 2, BLOCK.d / 2];
  }
  if (k === "holder") return [-HOLDER.len / 2, -HOLDER.d / 2, HOLDER.len / 2, HOLDER.d / 2];
  if (k === "station") return [-STATION.w / 2, -STATION.d / 2, STATION.w / 2, STATION.d / 2];
  if (k === "cup") return [-CUP.dia / 2, -CUP.dia / 2, CUP.dia / 2, CUP.dia / 2];
  if (k === "lemon" || k === "fruit") return [-LEMON.dia / 2, -LEMON.dia / 2, LEMON.dia / 2, LEMON.dia / 2];
  if (k === "skin") return [-SKIN.baseW / 2, -SKIN.baseD / 2, SKIN.baseW / 2, SKIN.baseD / 2];
  if (k === "sample") {
    const m = p["material"] as keyof typeof OBJECT | undefined;
    const o = m && OBJECT[m];
    if (o) return [-o.len / 2, -o.w / 2 - 2, o.len / 2, o.w / 2 + 2];
  }
  // Anything else: round its leads, at least a small body.
  const local = (partDef(part.kind).deskLegs as (pp: unknown) => Record<string, [number, number, number]>)(part.params);
  let r: Rect = [-6, -6, 6, 6];
  for (const [x, , z] of Object.values(local)) r = [Math.min(r[0], x - 2), Math.min(r[1], z - 2), Math.max(r[2], x + 2), Math.max(r[3], z + 2)];
  return r;
}

function bodyOf(bench: BenchState, part: PlacedPart, footprint: (p: PlacedPart) => Rect | null): Vec2[] | null {
  const f = footprint(part);
  if (!f) return null;
  const pose = partPose(bench, part);
  return (
    [
      [f[0], f[1]],
      [f[2], f[1]],
      [f[2], f[3]],
      [f[0], f[3]],
    ] as Vec2[]
  ).map(([x, z]) => {
    const [rx, rz] = rotateXZ(x, z, pose.rot);
    return [pose.origin[0] + rx, pose.origin[2] + rz] as Vec2;
  });
}

function ownersOf(bench: BenchState, to: string | null): string[] {
  const a = to ? parseAnchor(to) : null;
  if (a?.type !== "pin") return [];
  const seat = holderOf(bench, a.part);
  return seat ? [a.part, seat.holder.id] : [a.part];
}

/** Clip length in the sketch (the ink view's). */
const CLIP = 21;

/**
 * The bench as the tidy style would draw it, roughly: part outlines, clips out of their parts (fanned as the views
 * fan them), short arcs between the clips. Scored with the same clutter measure as the views.
 */
function sketch(bench: BenchState, ctx: Ctx): ClutterScene {
  const hidden = hiddenParts(bench);
  const bodies: ClutterBody[] = [];
  const polys = new Map<string, Vec2[]>();
  for (const p of bench.parts) {
    if (hidden.has(p.id) || p.kind === "gate" || isOnBoard(bench, p) || perfMount(bench, p) || holderOf(bench, p.id)) continue;
    const poly = bodyOf(bench, p, ctx.footprint);
    if (!poly) continue;
    polys.set(p.id, poly);
    const held = (p.params as { held?: Record<string, string | undefined> }).held;
    bodies.push({ id: p.id, poly, solid: true, family: held ? (Object.values(held).filter(Boolean) as string[]) : [] });
  }
  const spot = (e: TestLead["a"]): Vec2 => {
    const q = e.to ? anchorPosition(bench, e.to) : null;
    return q ? [q[0], q[2]] : e.pos;
  };
  const sites: ClipSite[] = [];
  for (const l of bench.leads) {
    for (const end of ["a", "b"] as const) {
      const e = l[end];
      if (!e.to || e.to.startsWith("probe:")) continue;
      const at = spot(e);
      const owner = ownersOf(bench, e.to);
      const poly = polys.get(owner[1] ?? owner[0] ?? "");
      const c = poly ? centroid(poly) : null;
      const out: Vec2 | null = c && dist(c, at) > 1 ? [(at[0] - c[0]) / dist(c, at), (at[1] - c[1]) / dist(c, at)] : null;
      sites.push({ key: `${l.id}.${end}`, at, toward: spot(end === "a" ? l.b : l.a), out });
    }
  }
  const heads = clipHeadings("tidy", sites);
  const center = ctx.center;
  const cables: ClutterCable[] = bench.leads.map((l) => {
    const end = (end: "a" | "b") => {
      const e = l[end];
      const at = spot(e);
      const other = spot(end === "a" ? l.b : l.a);
      const h = heads.get(`${l.id}.${end}`) ?? (dist(other, at) > 1 ? ([(other[0] - at[0]) / dist(other, at), (other[1] - at[1]) / dist(other, at)] as Vec2) : ([1, 0] as Vec2));
      const tip: Vec2 = e.to ? [at[0] - h[0] * 1.2, at[1] - h[1] * 1.2] : at;
      return { tip, dir: h, tail: [tip[0] + h[0] * CLIP, tip[1] + h[1] * CLIP] as Vec2, attached: !!e.to, owners: ownersOf(bench, e.to) };
    };
    const a = end("a");
    const b = end("b");
    return { id: l.id, a, b, cable: arcPoints({ id: l.id, a, b }, center, 10) };
  });
  const frame: Rect = ctx.frame ?? [-1e5, -1e5, 1e5, 1e5];
  return { cables, bodies, frame };
}

/** The parts round the loop from a supply's plus terminal, in order (null when there is no supply on the desk). */
function loopOrder(bench: BenchState): string[] | null {
  const supply = bench.parts.find((p) => SUPPLIES.has(p.kind) && !isOnBoard(bench, p));
  if (!supply) return null;
  const order = [supply.id];
  let cur = { part: supply.id, leg: supply.kind === "station" ? "a" : "pos" };
  const used = new Set<string>();
  const leadAt = (pin: string) => bench.leads.find((l) => !used.has(l.id) && (l.a.to === pin || l.b.to === pin));
  for (let step = 0; step < 24; step++) {
    const here = `pin:${cur.part}.${cur.leg}`;
    const lead = leadAt(here);
    if (!lead) break;
    used.add(lead.id);
    const other = lead.a.to === here ? lead.b.to : lead.a.to;
    const a = other ? parseAnchor(other) : null;
    if (a?.type !== "pin" || a.part === supply.id) break;
    if (!order.includes(a.part)) order.push(a.part);
    const part = bench.parts.find((p) => p.id === a.part);
    // Out through another terminal that has a lead on it.
    const next = part && partLegs(part).find((leg) => leg !== a.leg && leadAt(`pin:${part.id}.${leg}`));
    if (!part || !next) break;
    cur = { part: part.id, leg: next };
  }
  return order.length >= 3 ? order : null;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type Ctx = {
  footprint: (p: PlacedPart) => Rect | null;
  frame: Rect | null;
  center: Vec2;
  home: Map<string, { pos: Vec2; rot: number }>;
  homeEnds: Map<string, Vec2>;
  moving: Set<string>;
  loop: string[] | null;
};

/** How untidy a bench is, for the layout search (lower is tidier). */
function cost(bench: BenchState, ctx: Ctx): number {
  const scene = sketch(bench, ctx);
  let c = clutter(scene).raw * 10;
  // Room for clips between moved parts.
  const bodies = scene.bodies;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!;
      const b = bodies[j]!;
      if (!ctx.moving.has(a.id) && !ctx.moving.has(b.id)) continue;
      if (a.family.includes(b.id) || b.family.includes(a.id)) continue;
      if (convexOverlap(shrink(a.poly, -8), b.poly)) c += 60;
    }
  }
  // Stay near where the lab put things, and inside its frame.
  for (const p of bench.parts) {
    const h = ctx.home.get(p.id);
    if (!h) continue;
    const d = dist(p.pos, h.pos);
    c += 0.012 * d * d + (p.rot !== h.rot ? 12 : 0);
    if (ctx.frame) {
      for (const q of bodyOf(bench, p, ctx.footprint) ?? []) {
        if (inRect(q, ctx.frame)) continue;
        const dx = Math.max(ctx.frame[0] - q[0], 0, q[0] - ctx.frame[2]);
        const dz = Math.max(ctx.frame[1] - q[1], 0, q[1] - ctx.frame[3]);
        c += 4 * Math.hypot(dx, dz);
      }
    }
  }
  for (const l of bench.leads) {
    for (const end of ["a", "b"] as const) {
      const home = ctx.homeEnds.get(`${l.id}.${end}`);
      if (!home) continue;
      const e = l[end];
      c += 0.01 * dist(e.pos, home) ** 2;
      // A loose clip lies a lead's length from its other end, not bunched up beside it.
      const other = end === "a" ? l.b : l.a;
      const op = other.to ? anchorPosition(bench, other.to) : null;
      const o: Vec2 = op ? [op[0], op[2]] : other.pos;
      c += 0.4 * Math.abs(dist(e.pos, o) - 60);
    }
  }
  // The loop reads clockwise from the supply, which sits at its left.
  if (ctx.loop) {
    const centres = ctx.loop.map((id) => {
      const p = bench.parts.find((x) => x.id === id)!;
      const poly = bodyOf(bench, p, ctx.footprint);
      return poly ? centroid(poly) : p.pos;
    });
    const mid = centroid(centres);
    const ang = centres.map((q) => Math.atan2(q[1] - mid[1], q[0] - mid[0]));
    for (let i = 0; i < ang.length; i++) if (wrapAngle(ang[(i + 1) % ang.length]! - ang[i]!) < 0) c += 30;
    const left = Math.min(...centres.map((q) => q[0]));
    c += 1.5 * Math.max(0, centres[0]![0] - left - 10);
  }
  return c;
}

/** Desk parts the pass may move. */
function movableParts(bench: BenchState, fixed: ReadonlySet<string>): PlacedPart[] {
  const hidden = hiddenParts(bench);
  return bench.parts.filter(
    (p) =>
      !fixed.has(p.id) &&
      !FURNITURE.has(p.kind) &&
      !hidden.has(p.id) &&
      partLegs(p).length > 0 &&
      !isOnBoard(bench, p) &&
      !holderOf(bench, p.id) &&
      !perfMount(bench, p) &&
      !isFlying(p),
  );
}

const withPart = (bench: BenchState, id: string, pos: Vec2, rot: number): BenchState => ({ ...bench, parts: bench.parts.map((p) => (p.id === id ? { ...p, pos, rot } : p)) });
const withEnd = (bench: BenchState, id: string, end: "a" | "b", pos: Vec2): BenchState => ({ ...bench, leads: bench.leads.map((l) => (l.id === id ? { ...l, [end]: { ...l[end], pos } } : l)) });

/** Nudges parts and loose clips a step at a time while the bench gets tidier (a few rounds, smaller steps). */
function refine(bench: BenchState, parts: readonly PlacedPart[], ends: readonly { id: string; end: "a" | "b" }[], ctx: Ctx, steps: readonly number[]): BenchState {
  let cur = bench;
  let best = cost(cur, ctx);
  for (const step of steps) {
    for (let pass = 0; pass < 2; pass++) {
      let improved = false;
      for (const p0 of parts) {
        const p = cur.parts.find((x) => x.id === p0.id)!;
        const home = ctx.home.get(p.id)!;
        const rots = TURNABLE.has(p.kind) ? [p.rot, p.rot + 90, p.rot + 180, p.rot - 90] : [p.rot];
        for (const rot of rots) {
          for (const dx of [-step, 0, step]) {
            for (const dz of [-step, 0, step]) {
              if (!dx && !dz && rot === p.rot) continue;
              const pos: Vec2 = [p.pos[0] + dx, p.pos[1] + dz];
              if (dist(pos, home.pos) > REACH) continue;
              const next = withPart(cur, p.id, pos, rot);
              const c = cost(next, ctx);
              if (c < best - 0.5) {
                best = c;
                cur = next;
                improved = true;
              }
            }
          }
        }
      }
      for (const e of ends) {
        const l = cur.leads.find((x) => x.id === e.id)!;
        const pos0 = l[e.end].pos;
        const home = ctx.homeEnds.get(`${e.id}.${e.end}`)!;
        for (const dx of [-step * 2, -step, 0, step, step * 2]) {
          for (const dz of [-step * 2, -step, 0, step, step * 2]) {
            if (!dx && !dz) continue;
            const pos: Vec2 = [pos0[0] + dx, pos0[1] + dz];
            if (dist(pos, home) > REACH) continue;
            const next = withEnd(cur, e.id, e.end, pos);
            const c = cost(next, ctx);
            if (c < best - 0.5) {
              best = c;
              cur = next;
              improved = true;
            }
          }
        }
      }
      if (!improved) break;
    }
  }
  return cur;
}

/**
 * The loop laid round a rounded rectangle, clockwise from the supply at its left: the parts keep the loop's order,
 * spread evenly along the top, the right and the bottom, centred where the lab had them. Small two-legged parts turn
 * to face their neighbours. Parts the pass may not move keep their place (and their slot).
 */
function aroundTheLoop(bench: BenchState, loop: readonly string[], movable: ReadonlySet<string>, ctx: Ctx): BenchState {
  const parts = loop.map((id) => bench.parts.find((p) => p.id === id)!);
  const n = parts.length;
  const at = parts.map((p) => p.pos);
  const cx0 = at.reduce((s, q) => s + q[0], 0) / n;
  const cz0 = at.reduce((s, q) => s + q[1], 0) / n;
  const xs = at.map((q) => q[0]);
  const zs = at.map((q) => q[1]);
  // Room for each part and its clips round the loop.
  const sizes = parts.map((p) => {
    const f = ctx.footprint(p) ?? [-10, -10, 10, 10];
    return Math.max(f[2] - f[0], f[3] - f[1]);
  });
  const perimeter = sizes.reduce((s, w) => s + w + 46, 0);
  let a = Math.max(60, (Math.max(...xs) - Math.min(...xs)) / 2, perimeter / 7);
  let b = Math.max(42, (Math.max(...zs) - Math.min(...zs)) / 2, perimeter / 11);
  let cx = cx0;
  let cz = cz0;
  // The supply stays where it is if it may not move: the loop is built round it.
  if (!movable.has(parts[0]!.id)) {
    cx = parts[0]!.pos[0] + a;
    cz = parts[0]!.pos[1];
  }
  if (ctx.frame) {
    const f = ctx.frame;
    a = Math.min(a, Math.max(40, (f[2] - f[0]) / 2 - 36));
    b = Math.min(b, Math.max(30, (f[3] - f[1]) / 2 - 30));
    cx = Math.min(Math.max(cx, f[0] + a + 30), f[2] - a - 30);
    cz = Math.min(Math.max(cz, f[1] + b + 26), f[3] - b - 26);
  }
  let out = bench;
  const slots: Vec2[] = parts.map((_, i) => {
    // Clockwise on the page (z grows down the page), from the left.
    const t = Math.PI + (i * 2 * Math.PI) / n;
    const x = Math.cos(t);
    const z = Math.sin(t);
    // Square the ellipse off a little, so parts on the top and bottom line up.
    const sz = Math.abs(z) > 0.55 ? Math.sign(z) : z / 0.55;
    const sx = Math.abs(x) > 0.55 ? Math.sign(x) * Math.max(Math.abs(x), 0.85) : x;
    return [Math.round(cx + a * sx), Math.round(cz + b * sz)];
  });
  parts.forEach((p, i) => {
    if (!movable.has(p.id)) return;
    out = withPart(out, p.id, slots[i]!, p.rot);
  });
  // Two-legged parts face the parts before and after them in the loop.
  parts.forEach((p, i) => {
    if (!movable.has(p.id) || !TURNABLE.has(p.kind)) return;
    const prev = slots[(i + n - 1) % n]!;
    const next = slots[(i + 1) % n]!;
    let best = p.rot;
    let bestD = Infinity;
    for (const rot of [p.rot, p.rot + 90, p.rot + 180, p.rot - 90]) {
      const b2 = withPart(out, p.id, slots[i]!, rot);
      const part = b2.parts.find((x) => x.id === p.id)!;
      const legs = partPose(b2, part).legs;
      // The leg with a lead from the previous part should face it, the other leg the next part.
      const names = partLegs(part);
      const fromPrev = names.find((leg) => b2.leads.some((l) => [l.a.to, l.b.to].includes(`pin:${p.id}.${leg}`) && [l.a.to, l.b.to].some((t) => t?.startsWith(`pin:${loop[(i + n - 1) % n]}.`))));
      const inLeg = fromPrev ?? names[0]!;
      const outLeg = names.find((leg) => leg !== inLeg) ?? names[1]!;
      const li = legs[inLeg];
      const lo = legs[outLeg];
      if (!li || !lo) continue;
      const d = dist([li[0], li[2]], prev) + dist([lo[0], lo[2]], next);
      if (d < bestD - 0.5) {
        bestD = d;
        best = rot;
      }
    }
    out = withPart(out, p.id, slots[i]!, best);
  });
  return out;
}

/** How cluttered a layout looks, without the pull toward where the lab put things. */
function clutterOnly(bench: BenchState, ctx: Ctx): number {
  return cost(bench, { ...ctx, home: new Map(), homeEnds: new Map() });
}

/**
 * Lays a bench out tidily (see the top of this file). Returns the same bench object when nothing moved.
 */
export function tidyBench(bench: BenchState, opts: TidyOptions = {}): BenchState {
  const fixed = new Set(opts.fixed ?? []);
  const parts = movableParts(bench, fixed).sort((a, b) => (a.id < b.id ? -1 : 1));
  const ends: { id: string; end: "a" | "b" }[] = [];
  for (const l of [...bench.leads].sort((a, b) => (a.id < b.id ? -1 : 1))) for (const end of ["a", "b"] as const) if (!l[end].to) ends.push({ id: l.id, end });
  if (!parts.length && !ends.length) return bench;
  const ctx: Ctx = {
    footprint: opts.footprint ?? estimateFootprint,
    frame: opts.frame ?? null,
    home: new Map(parts.map((p) => [p.id, { pos: p.pos, rot: p.rot }])),
    homeEnds: new Map(ends.map((e) => [`${e.id}.${e.end}`, bench.leads.find((l) => l.id === e.id)![e.end].pos])),
    moving: new Set(parts.map((p) => p.id)),
    loop: loopOrder(bench),
    center: workCenter(bench),
  };
  // Nudged from where the lab put things.
  const nudged = refine(bench, parts, ends, ctx, [20, 10]);
  if (!ctx.loop) return opts.judge && opts.judge(nudged) >= opts.judge(bench) ? bench : nudged;
  // Or the loop laid out clockwise first, then nudged from there; whichever reads more clearly.
  const movable = new Set(parts.map((p) => p.id));
  const laid = aroundTheLoop(bench, ctx.loop, movable, ctx);
  const ctx2: Ctx = { ...ctx, home: new Map(parts.map((p) => [p.id, { pos: laid.parts.find((x) => x.id === p.id)!.pos, rot: laid.parts.find((x) => x.id === p.id)!.rot }])) };
  const looped = refine(laid, parts, ends, ctx2, [10, 5]);
  const judge = opts.judge ?? ((b: BenchState) => clutterOnly(b, ctx));
  // The clearest of the three; moving things must earn its keep.
  const scored = [
    { b: bench, c: judge(bench) },
    { b: nudged, c: judge(nudged) + 2 },
    { b: looped, c: judge(looped) + 4 },
  ];
  return scored.reduce((best, x) => (x.c < best.c ? x : best)).b;
}
