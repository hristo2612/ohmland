// Cable routing on the desk plane for the drape, taped and tidy styles (src/cables/style.ts). Pure and deterministic:
// both views call it whenever the bench changes (never per frame) with the clip ends and part outlines as they draw
// them, and draw the cable along the points it returns, from one clip's tail to the other's. Nothing here moves a
// clip, an anchor or a part.

import type { Vec2 } from "../types";
import type { CableStyle } from "./style";
import {
  add,
  boundsOf,
  cross,
  cubic,
  dist,
  dot,
  inConvex,
  inRect,
  lerp,
  norm,
  perp,
  polyLength,
  resample,
  rot,
  scale,
  segInside,
  sub,
  type Rect,
} from "./geom";

export type RouteEnd = {
  /** The jaws (or a probe's tip, a plug's pin). */
  tip: Vec2;
  /** Unit direction from the jaws toward the tail. */
  dir: Vec2;
  /** Where the cable leaves the clip. */
  tail: Vec2;
  attached: boolean;
};

export type RouteCable = {
  id: string;
  a: RouteEnd;
  b: RouteEnd;
  /** Bodies this cable may lie over (a probe's cord over the meter it plugs into). */
  pass?: readonly string[];
  /** Its ends may turn any way (a probe's cord: the probe and plug are not clips on a grid). */
  free?: boolean;
};

/** A part body (convex outline on the desk) that cables go round. */
export type RouteObstacle = { id: string; poly: Vec2[] };

/** Clear space kept between a cable and a part body (mm). */
const MARGIN = 3;
/** The gap parallel cables keep (mm). */
const GAP = 4.2;
/** The taped style's grid (mm). */
const GRID = 4.5;
/** Corner radius of a taped run (mm). */
const CORNER = 4.5;

type Prepared = { id: string; poly: Vec2[]; grown: Vec2[]; box: Rect };

function prepare(obstacles: readonly RouteObstacle[], margin: number): Prepared[] {
  return obstacles.map((o) => {
    const grown = grow(o.poly, margin);
    return { id: o.id, poly: o.poly, grown, box: boundsOf(grown, 0) };
  });
}

/** A convex polygon pushed out by `k` mm: each edge moves out along its normal, corners meet again. */
function grow(poly: readonly Vec2[], k: number): Vec2[] {
  const n = poly.length;
  if (n < 3) return poly.map((p) => [p[0], p[1]] as Vec2);
  let area = 0;
  for (let i = 0; i < n; i++) area += cross(poly[i]!, poly[(i + 1) % n]!);
  const w = area >= 0 ? -1 : 1;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i + n - 1) % n]!;
    const p = poly[i]!;
    const next = poly[(i + 1) % n]!;
    const n1 = scale(perp(norm(sub(p, prev))), w);
    const n2 = scale(perp(norm(sub(next, p))), w);
    const m = norm(add(n1, n2));
    const c = Math.max(0.35, dot(m, n1));
    out.push(add(p, scale(m, k / c)));
  }
  return out;
}

/** How far a polyline runs inside the obstacles it may not cross. */
function blockedLength(pts: readonly Vec2[], obs: readonly Prepared[], skip: ReadonlySet<string>, useGrown = true): number {
  let s = 0;
  const bb = boundsOf(pts, 0);
  for (const o of obs) {
    if (skip.has(o.id)) continue;
    if (o.box[0] > bb[2] || o.box[2] < bb[0] || o.box[1] > bb[3] || o.box[3] < bb[1]) continue;
    const poly = useGrown ? o.grown : o.poly;
    for (let i = 1; i < pts.length; i++) s += segInside(poly, pts[i - 1]!, pts[i]!);
  }
  return s;
}

const inside = (o: Prepared, p: Vec2) => inRect(p, o.box) && inConvex(o.grown, p);

type Exit = { at: Vec2; run: number; stuck: Set<string> };

/**
 * Where a cable leaving a clip's tail clears the bodies it starts over (a clip on a terminal along a block's edge),
 * carrying straight on out of the clip. A body it cannot clear within a few centimetres it may cross (`stuck`).
 */
function exitOf(e: RouteEnd, obs: readonly Prepared[], lead = 3): Exit {
  const over = obs.filter((o) => inside(o, e.tail));
  if (!over.length) return { at: add(e.tail, scale(e.dir, lead)), run: lead, stuck: new Set() };
  for (let k = 1; k <= 40; k++) {
    const p = add(e.tail, scale(e.dir, k));
    if (over.every((o) => !inside(o, p))) return { at: add(p, scale(e.dir, 1.5)), run: k + 1.5, stuck: new Set() };
  }
  return { at: add(e.tail, scale(e.dir, lead)), run: lead, stuck: new Set(over.map((o) => o.id)) };
}

/** The part of a polyline after its first `a` mm and before its last `b` mm. */
function trim(pts: readonly Vec2[], a: number, b: number): Vec2[] {
  const total = polyLength(pts);
  if (a + b >= total - 0.5) return [];
  const out: Vec2[] = [];
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) run += dist(pts[i - 1]!, pts[i]!);
    if (run >= a && run <= total - b) out.push(pts[i]!);
  }
  return out;
}

const dedupe = (pts: readonly Vec2[]): Vec2[] => pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]!) > 0.5);

// ---------------------------------------------------------------------------------------------------------------
// Clip headings.

export type ClipSite = {
  /** `${cableId}.${end}`. */
  key: string;
  /** The anchor the clip bites (its jaws are here). */
  at: Vec2;
  /** Where the cable is going: the other end's anchor or loose clip. */
  toward: Vec2;
  /** Straight out of the part at this pin (along its lead, off its terminal), or null (a hole, a board strip). */
  out: Vec2 | null;
};

const AXES: Vec2[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const angleOf = (v: Vec2) => Math.atan2(v[1], v[0]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** How far a clip may turn from straight out of its part toward its cable (radians). */
const MAX_TURN = Math.acos(0.5);
/** Clips on anchors closer than this fan out together (an LED's two legs). */
const NEAR = 5;

/**
 * Which way each clip lies, from its jaws toward its tail, for a style: out of the part it bites and toward where its
 * cable goes, never back across the part. Clips on one terminal (or on terminals side by side) fan out evenly; taped
 * clips lie along the grid.
 */
export function clipHeadings(style: Exclude<CableStyle, "classic">, sites: readonly ClipSite[]): Map<string, Vec2> {
  const base = new Map<string, Vec2>();
  const toOf = (s: ClipSite): Vec2 => (dist(s.toward, s.at) > 1 ? norm(sub(s.toward, s.at)) : s.out ?? [0, 1]);
  for (const s of sites) {
    const to = toOf(s);
    let h = s.out ? norm(add(scale(s.out, style === "tidy" ? 0.5 : 0.8), to)) : to;
    if (s.out && dot(h, s.out) < Math.cos(MAX_TURN)) {
      // Never lie back across the part: turn no further from its lead than MAX_TURN.
      const side = Math.sign(cross(s.out, h)) || 1;
      h = rot(s.out, side * MAX_TURN);
    }
    if (style === "taped") h = snapAxis(s.out, to);
    base.set(s.key, h);
  }
  // Groups of clips biting the same spot or spots side by side.
  const parent = sites.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) if (dist(sites[i]!.at, sites[j]!.at) < NEAR) parent[find(i)] = find(j);
  const groups = new Map<number, ClipSite[]>();
  sites.forEach((s, i) => {
    const k = find(i);
    const g = groups.get(k);
    if (g) g.push(s);
    else groups.set(k, [s]);
  });
  const out = new Map(base);
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sum = g.reduce<Vec2>((acc, s) => add(acc, base.get(s.key)!), [0, 0]);
    const m = Math.hypot(sum[0], sum[1]) > 0.01 ? norm(sum) : base.get(g[0]!.key)!;
    const c = g.reduce<Vec2>((acc, s) => add(acc, scale(s.at, 1 / g.length)), [0, 0]);
    // Across the fan in the order the cables leave (the jaws are a few millimetres apart at most; the cables would
    // otherwise cross further out), then by where each clip bites.
    const ordered = [...g].sort((p, q) => {
      const ap = wrap(angleOf(toOf(p)) - angleOf(m));
      const aq = wrap(angleOf(toOf(q)) - angleOf(m));
      if (Math.abs(ap - aq) > 0.05) return ap - aq;
      const sp = cross(m, sub(p.at, c));
      const sq = cross(m, sub(q.at, c));
      return sp - sq || (p.key < q.key ? -1 : 1);
    });
    const outs = g.map((s) => s.out).filter((o): o is Vec2 => !!o);
    const mo = outs.length ? norm(outs.reduce<Vec2>((acc, o) => add(acc, o), [0, 0])) : null;
    if (style === "taped") {
      // Each clip on its own grid direction (never back across the part), the ones nearest the fan's heading first.
      const pull = g.reduce<Vec2>((acc, s) => add(acc, toOf(s)), [0, 0]);
      const free = AXES.filter((a) => !mo || dot(a, mo) > -0.2).sort((a, b) => dot(b, m) + 0.3 * dot(b, pull) - (dot(a, m) + 0.3 * dot(a, pull)));
      const pick = free.slice(0, ordered.length).sort((a, b) => wrap(angleOf(a) - angleOf(m)) - wrap(angleOf(b) - angleOf(m)));
      ordered.forEach((s, i) => out.set(s.key, pick[i] ?? base.get(s.key)!));
      continue;
    }
    const spread = Math.min(0.5, 1.5 / ordered.length);
    ordered.forEach((s, i) => out.set(s.key, rot(m, (i - (ordered.length - 1) / 2) * spread)));
  }
  return out;
}

/** The grid direction for a taped clip: straight out of its part, unless that is diagonal; then toward its cable. */
function snapAxis(out: Vec2 | null, to: Vec2): Vec2 {
  let best = AXES[0]!;
  let score = -Infinity;
  for (const a of AXES) {
    if (out && dot(a, out) < 0.3) continue;
    const s = (out ? 1.2 * dot(a, out) : 0) + 0.8 * dot(a, to);
    if (s > score) {
      score = s;
      best = a;
    }
  }
  return score === -Infinity ? (out ? nearestAxis(out) : nearestAxis(to)) : best;
}

function nearestAxis(v: Vec2): Vec2 {
  let best = AXES[0]!;
  for (const a of AXES) if (dot(a, v) > dot(best, v)) best = a;
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// Routing.

export type RouteOptions = {
  /** The middle of the work (tidy arcs bow away from it). */
  center?: Vec2;
};

/** Routes every cable for a style. Returns each cable's points from clip a's tail to clip b's. */
export function routeCables(style: Exclude<CableStyle, "classic">, cables: readonly RouteCable[], obstacles: readonly RouteObstacle[], opts: RouteOptions = {}): Map<string, Vec2[]> {
  const obs = prepare(obstacles, MARGIN);
  const out = new Map<string, Vec2[]>();
  if (style === "taped") return routeTaped(cables, obs);
  for (const c of cables) {
    const own = c.pass?.length ? obs.filter((o) => !c.pass!.includes(o.id)) : obs;
    out.set(c.id, style === "tidy" ? arcRoute(c, own, opts.center ?? [0, 0]) : drapeRoute(c, own));
  }
  if (style === "drape") keepApart(cables, out);
  return out;
}

// ---- Drape -----------------------------------------------------------------------------------------------------

/** The natural curve out of both clips, with a little slack hanging toward the viewer (down the page). */
function hangCurve(a: Vec2, da: Vec2, b: Vec2, db: Vec2, slack: number): Vec2[] {
  const d = dist(a, b);
  const k = Math.min(42, Math.max(6, d * 0.34));
  const drop = slack * d;
  const c1: Vec2 = [a[0] + da[0] * k, a[1] + da[1] * k + drop];
  const c2: Vec2 = [b[0] + db[0] * k, b[1] + db[1] * k + drop];
  return cubic(a, c1, c2, b, Math.max(12, Math.min(40, Math.round(d / 4))));
}

function drapeRoute(c: RouteCable, obs: readonly Prepared[]): Vec2[] {
  const a = c.a.tail;
  const b = c.b.tail;
  const d = dist(a, b);
  const ea = exitOf(c.a, obs);
  const eb = exitOf(c.b, obs);
  const skip = new Set([...ea.stuck, ...eb.stuck]);
  // Slack grows with distance: a short lead runs nearly straight, a long one hangs.
  const slack = Math.min(0.07, 0.02 + d / 4000);
  for (const k of [slack, 0]) {
    const curve = hangCurve(a, c.a.dir, b, c.b.dir, k);
    if (blockedLength(trim(curve, ea.run, eb.run), obs, skip) < 0.5) return curve;
  }
  return roundAbout(c, ea, eb, obs, skip) ?? hangCurve(a, c.a.dir, b, c.b.dir, slack);
}

/** Round the bodies in the way: the shortest path between their grown corners, then smoothed. */
function roundAbout(c: RouteCable, ea: Exit, eb: Exit, obs: readonly Prepared[], skip: ReadonlySet<string>): Vec2[] | null {
  const via = visibilityPath(ea.at, eb.at, obs, skip);
  if (!via) return null;
  const pts = smoothThrough(dedupe([c.a.tail, ...via, c.b.tail]), c.a.dir, c.b.dir);
  return pushOut(pts, obs, skip);
}

/** Shortest path from p to q round the grown obstacles (not those in `skip`), through their corners. */
function visibilityPath(p: Vec2, q: Vec2, obs: readonly Prepared[], skip: ReadonlySet<string>): Vec2[] | null {
  const live = obs.filter((o) => !skip.has(o.id));
  const clear = (u: Vec2, v: Vec2) => {
    for (const o of live) {
      if (Math.max(u[0], v[0]) < o.box[0] || Math.min(u[0], v[0]) > o.box[2] || Math.max(u[1], v[1]) < o.box[1] || Math.min(u[1], v[1]) > o.box[3]) continue;
      if (segInside(o.grown, u, v) > 0.05) return false;
    }
    return true;
  };
  if (clear(p, q)) return [p, q];
  const nodes: Vec2[] = [p, q];
  for (const o of live) for (const v of grow(o.poly, MARGIN + 0.6)) if (!live.some((x) => x !== o && inRect(v, x.box) && inConvex(x.grown, v))) nodes.push(v);
  const n = nodes.length;
  const best = new Array<number>(n).fill(Infinity);
  const from = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  best[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && best[i]! < Infinity && (u < 0 || best[i]! < best[u]!)) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const w = dist(nodes[u]!, nodes[v]!);
      if (best[u]! + w >= best[v]!) continue;
      if (!clear(nodes[u]!, nodes[v]!)) continue;
      best[v] = best[u]! + w;
      from[v] = u;
    }
  }
  if (best[1] === Infinity) return null;
  const path: Vec2[] = [];
  for (let i = 1; i >= 0; i = from[i]!) {
    path.push(nodes[i]!);
    if (i === 0) break;
  }
  return path.reverse();
}

/** A smooth curve through points (centripetal Catmull-Rom), leaving the first along `da` and the last along `db`. */
function smoothThrough(pts: readonly Vec2[], da: Vec2, db: Vec2): Vec2[] {
  const P: Vec2[] = [add(pts[0]!, scale(da, -10)), ...pts, add(pts[pts.length - 1]!, scale(db, -10))];
  const out: Vec2[] = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1]!;
    const p1 = P[i]!;
    const p2 = P[i + 1]!;
    const p3 = P[i + 2]!;
    const seg = dist(p1, p2);
    const n = Math.max(3, Math.round(seg / 3));
    for (let k = 0; k < n; k++) out.push(catmull(p0, p1, p2, p3, k / n));
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

function catmull(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t01 = Math.pow(Math.max(dist(p0, p1), 1e-3), 0.5);
  const t12 = Math.pow(Math.max(dist(p1, p2), 1e-3), 0.5);
  const t23 = Math.pow(Math.max(dist(p2, p3), 1e-3), 0.5);
  const m1 = scale(add(sub(p2, p1), scale(sub(scale(sub(p1, p0), 1 / t01), scale(sub(p2, p0), 1 / (t01 + t12))), t12)), 1);
  const m2 = scale(add(sub(p2, p1), scale(sub(scale(sub(p3, p2), 1 / t23), scale(sub(p3, p1), 1 / (t12 + t23))), t12)), 1);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return [h00 * p1[0] + h10 * m1[0] + h01 * p2[0] + h11 * m2[0], h00 * p1[1] + h10 * m1[1] + h01 * p2[1] + h11 * m2[1]];
}

/** Points that cut a corner into a body move back out to its edge (the clip ends never move). */
function pushOut(pts: Vec2[], obs: readonly Prepared[], skip: ReadonlySet<string>): Vec2[] {
  const out = pts.map((p) => [p[0], p[1]] as Vec2);
  for (let i = 1; i < out.length - 1; i++) {
    for (const o of obs) {
      if (skip.has(o.id)) continue;
      const p = out[i]!;
      if (!inRect(p, o.box) || !inConvex(o.poly, p)) continue;
      out[i] = nearestOnEdge(o.grown, p);
    }
  }
  return out;
}

function nearestOnEdge(poly: readonly Vec2[], p: Vec2): Vec2 {
  let best: Vec2 = poly[0]!;
  let bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
    const q = lerp(a, b, t);
    const d = dist(p, q);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/**
 * Parallel runs keep a constant gap: where two cables run side by side closer than GAP, push them apart (more in
 * the middle of a run, never at the clips), then let each cable relax smooth again.
 */
function keepApart(cables: readonly RouteCable[], routes: Map<string, Vec2[]>) {
  const ids = cables.map((c) => c.id).filter((id) => routes.has(id));
  if (ids.length < 2) return;
  const ends = new Map(cables.map((c) => [c.id, [c.a.tip, c.b.tip, c.a.tail, c.b.tail]]));
  const pts = new Map(ids.map((id) => [id, resample(routes.get(id)!, 2.5)]));
  for (let it = 0; it < 6; it++) {
    const pushes = new Map(ids.map((id) => [id, pts.get(id)!.map(() => [0, 0] as Vec2)]));
    const boxes = new Map(ids.map((id) => [id, boundsOf(pts.get(id)!, GAP)]));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const bi = boxes.get(ids[i]!)!;
        const bj = boxes.get(ids[j]!)!;
        if (bi[0] > bj[2] || bj[0] > bi[2] || bi[1] > bj[3] || bj[1] > bi[3]) continue;
        const P = pts.get(ids[i]!)!;
        const Q = pts.get(ids[j]!)!;
        const shared = ends.get(ids[i]!)!.filter((e) => ends.get(ids[j]!)!.some((f) => dist(e, f) < 3));
        for (let k = 1; k < P.length - 1; k++) {
          const p = P[k]!;
          if (p[0] < bj[0] || p[0] > bj[2] || p[1] < bj[1] || p[1] > bj[3]) continue;
          if (shared.some((s) => dist(s, p) < 14)) continue;
          let bq = -1;
          let bd = GAP;
          for (let m = 1; m < Q.length - 1; m++) {
            const q = Q[m]!;
            if (Math.abs(q[0] - p[0]) > GAP || Math.abs(q[1] - p[1]) > GAP) continue;
            const d = dist(p, q);
            if (d < bd) {
              bd = d;
              bq = m;
            }
          }
          if (bq < 0) continue;
          const q = Q[bq]!;
          if (shared.some((s) => dist(s, q) < 14)) continue;
          const tp = norm(sub(P[k + 1]!, P[k - 1]!));
          const tq = norm(sub(Q[bq + 1]!, Q[bq - 1]!));
          // Only runs side by side: a plain crossing stays a crossing.
          if (Math.abs(dot(tp, tq)) < 0.8) continue;
          let n = perp(tp);
          if (dot(n, sub(p, q)) < 0) n = scale(n, -1);
          const amt = (GAP - bd) / 2;
          const fp = Math.min(1, k / 4, (P.length - 1 - k) / 4);
          const fq = Math.min(1, bq / 4, (Q.length - 1 - bq) / 4);
          const pp = pushes.get(ids[i]!)![k]!;
          pp[0] += n[0] * amt * fp;
          pp[1] += n[1] * amt * fp;
          const qq = pushes.get(ids[j]!)![bq]!;
          qq[0] -= n[0] * amt * fq;
          qq[1] -= n[1] * amt * fq;
        }
      }
    }
    for (const id of ids) {
      const P = pts.get(id)!;
      const push = pushes.get(id)!;
      const moved = P.map((p, k) => (k === 0 || k === P.length - 1 ? p : ([p[0] + push[k]![0], p[1] + push[k]![1]] as Vec2)));
      // Relax: each inner point toward its neighbours' middle, a little.
      const relaxed = moved.map((p, k) => (k === 0 || k === moved.length - 1 ? p : lerp(p, lerp(moved[k - 1]!, moved[k + 1]!, 0.5), 0.3)));
      pts.set(id, relaxed);
    }
  }
  for (const id of ids) routes.set(id, pts.get(id)!);
}

// ---- Tidy ------------------------------------------------------------------------------------------------------

/** A short gentle arc between two clips' tails, bowing away from the middle of the work (no bodies in the way). */
export function arcPoints(c: RouteCable, center: Vec2, n?: number, bowK = 0.1): Vec2[] {
  const a = c.a.tail;
  const b = c.b.tail;
  const d = dist(a, b);
  const mid = lerp(a, b, 0.5);
  let nn = perp(norm(sub(b, a)));
  if (dot(nn, sub(mid, center)) < 0) nn = scale(nn, -1);
  const bow = Math.min(9, d * bowK);
  const k = Math.min(30, Math.max(5, d * 0.28));
  const c1 = add(add(a, scale(c.a.dir, k)), scale(nn, bow * 1.33));
  const c2 = add(add(b, scale(c.b.dir, k)), scale(nn, bow * 1.33));
  return cubic(a, c1, c2, b, n ?? Math.max(12, Math.min(36, Math.round(d / 4))));
}

/** A short gentle arc between the clips, bowing away from the middle of the work. */
function arcRoute(c: RouteCable, obs: readonly Prepared[], center: Vec2): Vec2[] {
  const a = c.a.tail;
  const b = c.b.tail;
  const d = dist(a, b);
  const mid = lerp(a, b, 0.5);
  let n = perp(norm(sub(b, a)));
  if (dot(n, sub(mid, center)) < 0) n = scale(n, -1);
  const ea = exitOf(c.a, obs);
  const eb = exitOf(c.b, obs);
  const skip = new Set([...ea.stuck, ...eb.stuck]);
  for (const bowK of [0.1, 0.04]) {
    const curve = arcPoints(c, center, undefined, bowK);
    if (blockedLength(trim(curve, ea.run, eb.run), obs, skip) < 0.5) return curve;
  }
  return roundAbout(c, ea, eb, obs, skip) ?? cubic(a, add(a, scale(c.a.dir, d * 0.28)), add(b, scale(c.b.dir, d * 0.28)), b, 24);
}

// ---- Taped -----------------------------------------------------------------------------------------------------

type Grid = { xs: number[]; zs: number[]; blocked: Uint8Array; soft: Map<number, string[]> };

/** Straight runs on a grid with rounded corners. Short cables first; each later cable avoids the runs already laid. */
function routeTaped(cables: readonly RouteCable[], obs: readonly Prepared[]): Map<string, Vec2[]> {
  const out = new Map<string, Vec2[]>();
  if (!cables.length) return out;
  const own = (c: RouteCable) => (c.pass?.length ? obs.filter((o) => !c.pass!.includes(o.id)) : obs);
  const exits = new Map(cables.map((c) => [c.id, { a: exitOf(c.a, own(c)), b: exitOf(c.b, own(c)) }]));
  const special: Vec2[] = [];
  for (const c of cables) special.push(c.a.tail, c.b.tail, exits.get(c.id)!.a.at, exits.get(c.id)!.b.at);
  const pts: Vec2[] = [...special];
  for (const o of obs) pts.push(...o.grown);
  const bb = boundsOf(pts, 24);
  const lines = (lo: number, hi: number, keep: number[]) => {
    const want = [...new Set(keep.map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q);
    const reg: number[] = [];
    for (let v = Math.floor(lo / GRID) * GRID; v <= hi; v += GRID) if (!want.some((w) => Math.abs(w - v) < GRID * 0.45)) reg.push(v);
    return [...want, ...reg].sort((p, q) => p - q);
  };
  const xs = lines(bb[0], bb[2], special.map((p) => p[0]));
  const zs = lines(bb[1], bb[3], special.map((p) => p[1]));
  const W = xs.length;
  const H = zs.length;
  const blocked = new Uint8Array(W * H);
  // Which obstacles each node is inside (a cable may run inside the ones it starts or ends in).
  const soft = new Map<number, string[]>();
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const p: Vec2 = [xs[i]!, zs[j]!];
      for (const o of obs) {
        if (!inRect(p, o.box) || !inConvex(o.grown, p)) continue;
        const k = j * W + i;
        blocked[k] = 1;
        const s = soft.get(k);
        if (s) s.push(o.id);
        else soft.set(k, [o.id]);
      }
    }
  }
  const grid: Grid = { xs, zs, blocked, soft };
  // Edges already used: by axis (0 along x, 1 along z), and nodes cables pass through.
  const usedEdge = new Map<number, number>();
  const usedNode = new Map<number, number>();
  const order = [...cables].sort((p, q) => {
    const dp = Math.abs(p.a.tail[0] - p.b.tail[0]) + Math.abs(p.a.tail[1] - p.b.tail[1]);
    const dq = Math.abs(q.a.tail[0] - q.b.tail[0]) + Math.abs(q.a.tail[1] - q.b.tail[1]);
    return dp - dq || (p.id < q.id ? -1 : 1);
  });
  for (const c of order) {
    const ex = exits.get(c.id)!;
    const pa = ex.a.at;
    const pb = ex.b.at;
    const skip = new Set([...ex.a.stuck, ...ex.b.stuck, ...(c.pass ?? [])]);
    const path = gridPath(grid, pa, pb, c.free ? -1 : axisOf(c.a.dir), c.free ? -1 : axisOf(scale(c.b.dir, -1)), skip, usedEdge, usedNode);
    if (!path) {
      out.set(c.id, hangCurve(c.a.tail, c.a.dir, c.b.tail, c.b.dir, 0));
      continue;
    }
    // Mark the run so later cables keep off it.
    for (let k = 1; k < path.length; k++) {
      const [i0, j0] = path[k - 1]!;
      const [i1, j1] = path[k]!;
      usedEdge.set(edgeKey(W, i0, j0, i1, j1), j0 === j1 ? 0 : 1);
      usedNode.set(j1 * W + i1, j0 === j1 ? 0 : 1);
    }
    usedNode.set(path[0]![1] * W + path[0]![0], 2);
    const corners = simplify([c.a.tail, ...path.map(([i, j]) => [xs[i]!, zs[j]!] as Vec2), c.b.tail]);
    out.set(c.id, roundCorners(corners, CORNER));
  }
  return out;
}

const edgeKey = (W: number, i0: number, j0: number, i1: number, j1: number) => {
  const a = j0 * W + i0;
  const b = j1 * W + i1;
  return a < b ? a * 1e6 + b : b * 1e6 + a;
};

/** 0..3: +x, +z, -x, -z. */
function axisOf(v: Vec2): number {
  if (Math.abs(v[0]) >= Math.abs(v[1])) return v[0] >= 0 ? 0 : 2;
  return v[1] >= 0 ? 1 : 3;
}
const STEP: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function nearestIndex(lines: readonly number[], v: number): number {
  let best = 0;
  for (let i = 1; i < lines.length; i++) if (Math.abs(lines[i]! - v) < Math.abs(lines[best]! - v)) best = i;
  return best;
}

/**
 * A* on the grid from the node at `p` to the node at `q`, leaving along `startDir` and arriving along `endDir` (-1: any
 * way).
 * Costs: length, a bend penalty, crossing another run, and running on another run (all but forbidden).
 */
function gridPath(g: Grid, p: Vec2, q: Vec2, startDir: number, endDir: number, skip: ReadonlySet<string>, usedEdge: Map<number, number>, usedNode: Map<number, number>): [number, number][] | null {
  const W = g.xs.length;
  const H = g.zs.length;
  const si = nearestIndex(g.xs, p[0]);
  const sj = nearestIndex(g.zs, p[1]);
  const ti = nearestIndex(g.xs, q[0]);
  const tj = nearestIndex(g.zs, q[1]);
  const passable = (k: number) => {
    if (!g.blocked[k]) return true;
    const ids = g.soft.get(k);
    return !!ids && ids.every((id) => skip.has(id));
  };
  const N = W * H * 4;
  const cost = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  // A binary heap of states by estimated cost, in typed arrays (no garbage per step).
  let cap = 1024;
  let hf = new Float64Array(cap);
  let hs = new Int32Array(cap);
  let size = 0;
  const pushH = (f: number, st: number) => {
    if (size === cap) {
      cap *= 2;
      const nf = new Float64Array(cap);
      nf.set(hf);
      hf = nf;
      const ns = new Int32Array(cap);
      ns.set(hs);
      hs = ns;
    }
    let i = size++;
    while (i > 0) {
      const pi = (i - 1) >> 1;
      if (hf[pi]! <= f) break;
      hf[i] = hf[pi]!;
      hs[i] = hs[pi]!;
      i = pi;
    }
    hf[i] = f;
    hs[i] = st;
  };
  let topF = 0;
  const popH = (): number => {
    const st = hs[0]!;
    topF = hf[0]!;
    size--;
    if (size > 0) {
      const f = hf[size]!;
      const x = hs[size]!;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= size) break;
        const r = l + 1;
        const m = r < size && hf[r]! < hf[l]! ? r : l;
        if (hf[m]! >= f) break;
        hf[i] = hf[m]!;
        hs[i] = hs[m]!;
        i = m;
      }
      hf[i] = f;
      hs[i] = x;
    }
    return st;
  };
  const h = (i: number, j: number) => Math.abs(g.xs[i]! - g.xs[ti]!) + Math.abs(g.zs[j]! - g.zs[tj]!);
  for (const d of startDir < 0 ? [0, 1, 2, 3] : [startDir]) {
    const s0 = (sj * W + si) * 4 + d;
    cost[s0] = 0;
    pushH(h(si, sj), s0);
  }
  const BEND = 7;
  let goal = -1;
  let iter = 0;
  while (size > 0 && iter++ < 400000) {
    const s = popH();
    const f = topF;
    const c0 = cost[s]!;
    if (f - h(((s >> 2) % W), Math.floor((s >> 2) / W)) > c0 + 1e-6) continue;
    const node = s >> 2;
    const dir = s & 3;
    const i = node % W;
    const j = Math.floor(node / W);
    if (i === ti && j === tj) {
      goal = s;
      if (endDir < 0 || dir === endDir) break;
      // Arriving along the wrong axis: a bend at the very end, paid for below.
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (dir + 2) % 4) continue;
      const [di, dj] = STEP[nd]!;
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nk = nj * W + ni;
      if (!passable(nk)) continue;
      const len = Math.abs(g.xs[ni]! - g.xs[i]!) + Math.abs(g.zs[nj]! - g.zs[j]!);
      let step = len * (g.blocked[nk] ? 2.5 : 1);
      if (nd !== dir) step += BEND;
      const ek = edgeKey(W, i, j, ni, nj);
      if (usedEdge.has(ek)) step += 400;
      const un = usedNode.get(nk);
      if (un !== undefined) step += un === 2 ? 120 : (un === (nd & 1 ? 1 : 0) ? 60 : 22);
      if (ni === ti && nj === tj && endDir >= 0 && nd !== endDir) step += BEND * 2;
      const ns = nk * 4 + nd;
      const nc = c0 + step;
      if (nc < cost[ns]!) {
        cost[ns] = nc;
        prev[ns] = s;
        pushH(nc + h(ni, nj), ns);
      }
    }
  }
  if (goal < 0) {
    let best = Infinity;
    for (let d = 0; d < 4; d++) {
      const s = (tj * W + ti) * 4 + d;
      if (cost[s]! < best) {
        best = cost[s]!;
        goal = s;
      }
    }
    if (goal < 0 || best === Infinity) return null;
  }
  const path: [number, number][] = [];
  for (let s = goal; s >= 0; s = prev[s]!) {
    const node = s >> 2;
    const pt: [number, number] = [node % W, Math.floor(node / W)];
    const last = path[path.length - 1];
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) path.push(pt);
  }
  return path.reverse();
}

/** Drops points in the middle of straight runs. */
function simplify(pts: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    if (out.length && dist(out[out.length - 1]!, p) < 0.05) continue;
    while (out.length >= 2) {
      const a = out[out.length - 2]!;
      const b = out[out.length - 1]!;
      if (Math.abs(cross(sub(b, a), sub(p, b))) < 1e-6 && dot(sub(b, a), sub(p, b)) >= 0) out.pop();
      else break;
    }
    out.push(p);
  }
  return out;
}

/** Rounds each corner of a polyline with a quarter arc of radius up to `r` (less where the runs are short). */
export function roundCorners(pts: readonly Vec2[], r: number): Vec2[] {
  if (pts.length < 3) return pts.map((p) => [p[0], p[1]] as Vec2);
  const out: Vec2[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const la = dist(a, b);
    const lc = dist(b, c);
    const rr = Math.min(r, la / 2, lc / 2);
    if (rr < 0.3) {
      out.push(b);
      continue;
    }
    const p = add(b, scale(norm(sub(a, b)), rr));
    const q = add(b, scale(norm(sub(c, b)), rr));
    // A quadratic through the corner is close enough to a quarter arc at this size.
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const u = 1 - t;
      out.push([u * u * p[0] + 2 * u * t * b[0] + t * t * q[0], u * u * p[1] + 2 * u * t * b[1] + t * t * q[1]]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

export { polyLength };
