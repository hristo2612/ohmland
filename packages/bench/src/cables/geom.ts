// Small plane geometry for cable routing and clutter scoring, on the desk plane (x, z in mm). Pure.

import type { Vec2 } from "../types";

export type Rect = [number, number, number, number];

export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function norm(v: Vec2): Vec2 {
  const l = Math.hypot(v[0], v[1]);
  return l < 1e-9 ? [1, 0] : [v[0] / l, v[1] / l];
}

export const rot = (v: Vec2, a: number): Vec2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
export const perp = (v: Vec2): Vec2 => [-v[1], v[0]];

export function polyLength(pts: readonly Vec2[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1]!, pts[i]!);
  return s;
}

/** Proper intersection of segments ab and cd (touching at an end counts). */
export function segHit(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(c, a), s) / den;
  const u = cross(sub(c, a), r) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

export function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}

/** Every point where two polylines cross. */
export function polyHits(p: readonly Vec2[], q: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  const bp = boundsOf(p, 0);
  const bq = boundsOf(q, 0);
  if (!rectsMeet(bp, bq)) return out;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    for (let j = 1; j < q.length; j++) {
      const h = segHit(a, b, q[j - 1]!, q[j]!);
      if (h && !out.some((o) => dist(o, h) < 0.3)) out.push(h);
    }
  }
  return out;
}

export function boundsOf(pts: readonly Vec2[], pad = 0): Rect {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [x0 - pad, z0 - pad, x1 + pad, z1 + pad];
}

export const rectsMeet = (a: Rect, b: Rect) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
export const inRect = (p: Vec2, r: Rect, pad = 0) => p[0] >= r[0] - pad && p[0] <= r[2] + pad && p[1] >= r[1] - pad && p[1] <= r[3] + pad;

/** A convex polygon (any winding) contains p. */
export function inConvex(poly: readonly Vec2[], p: Vec2): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const c = cross(sub(b, a), sub(p, a));
    if (Math.abs(c) < 1e-9) continue;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Length of segment ab inside a convex polygon. */
export function segInside(poly: readonly Vec2[], a: Vec2, b: Vec2): number {
  // Clip the segment against each edge (Cyrus-Beck).
  let t0 = 0;
  let t1 = 1;
  const d = sub(b, a);
  const n = poly.length;
  // Winding: positive area means counter-clockwise in (x, z).
  let area = 0;
  for (let i = 0; i < n; i++) area += cross(poly[i]!, poly[(i + 1) % n]!);
  const w = area >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % n]!;
    const e = sub(q, p);
    // Inward normal.
    const nn: Vec2 = w > 0 ? [-e[1], e[0]] : [e[1], -e[0]];
    const num = dot(nn, sub(a, p));
    const den = dot(nn, d);
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return 0;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return 0;
  }
  return Math.max(0, t1 - t0) * Math.hypot(d[0], d[1]);
}

export function polyInside(poly: readonly Vec2[], pts: readonly Vec2[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += segInside(poly, pts[i - 1]!, pts[i]!);
  return s;
}

/** Two convex polygons overlap (separating axis test), each shrunk by `inset` mm first. */
export function convexOverlap(p: readonly Vec2[], q: readonly Vec2[], inset = 0): boolean {
  const P = inset ? shrink(p, inset) : p;
  const Q = inset ? shrink(q, inset) : q;
  for (const poly of [P, Q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const ax: Vec2 = [-(b[1] - a[1]), b[0] - a[0]];
      let pmin = Infinity;
      let pmax = -Infinity;
      for (const v of P) {
        const d = dot(v, ax);
        pmin = Math.min(pmin, d);
        pmax = Math.max(pmax, d);
      }
      let qmin = Infinity;
      let qmax = -Infinity;
      for (const v of Q) {
        const d = dot(v, ax);
        qmin = Math.min(qmin, d);
        qmax = Math.max(qmax, d);
      }
      if (pmax <= qmin || qmax <= pmin) return false;
    }
  }
  return true;
}

/** A convex polygon moved inward (negative: outward) by `k` mm, by its centroid (good enough for boxes). */
export function shrink(poly: readonly Vec2[], k: number): Vec2[] {
  const c = centroid(poly);
  return poly.map((p) => {
    const v = sub(p, c);
    const l = Math.hypot(v[0], v[1]) || 1;
    const f = Math.max(0, (l - k * Math.SQRT2) / l);
    return [c[0] + v[0] * f, c[1] + v[1] * f] as Vec2;
  });
}

export function centroid(poly: readonly Vec2[]): Vec2 {
  let x = 0;
  let z = 0;
  for (const p of poly) {
    x += p[0];
    z += p[1];
  }
  return [x / poly.length, z / poly.length];
}

/** Resample a polyline to points about `step` mm apart (ends kept). */
export function resample(pts: readonly Vec2[], step: number): Vec2[] {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]] as Vec2);
  const total = polyLength(pts);
  const n = Math.max(2, Math.ceil(total / step));
  const out: Vec2[] = [];
  let seg = 1;
  let acc = 0;
  for (let k = 0; k <= n; k++) {
    const want = (k / n) * total;
    while (seg < pts.length - 1 && acc + dist(pts[seg - 1]!, pts[seg]!) < want) {
      acc += dist(pts[seg - 1]!, pts[seg]!);
      seg++;
    }
    const a = pts[seg - 1]!;
    const b = pts[seg]!;
    const l = dist(a, b);
    out.push(l > 0 ? lerp(a, b, Math.min(1, (want - acc) / l)) : [a[0], a[1]]);
  }
  out[0] = [pts[0]![0], pts[0]![1]];
  out[out.length - 1] = [pts[pts.length - 1]![0], pts[pts.length - 1]![1]];
  return out;
}

/** A point `t` of the way along a polyline by length, and the heading there. */
export function along(pts: readonly Vec2[], t: number): { at: Vec2; dir: Vec2 } {
  const total = polyLength(pts);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = dist(a, b);
    if (want <= l || i === pts.length - 1) {
      const k = l > 0 ? Math.min(1, want / l) : 0;
      return { at: lerp(a, b, k), dir: norm(sub(b, a)) };
    }
    want -= l;
  }
  const p = pts[0] ?? [0, 0];
  return { at: [p[0], p[1]], dir: [1, 0] };
}

/** Cubic bezier sampled into n + 1 points. */
export function cubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, n = 24): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    out.push([w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0], w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1]]);
  }
  return out;
}

const f2 = (n: number) => Math.round(n * 100) / 100;

/** SVG path data through a polyline. */
export function svgPath(pts: readonly Vec2[]): string {
  if (!pts.length) return "";
  let d = `M${f2(pts[0]![0])} ${f2(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${f2(pts[i]![0])} ${f2(pts[i]![1])}`;
  return d;
}
