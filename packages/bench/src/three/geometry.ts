// Geometry builders shared by the part models.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Vec3 } from "../types";

const gcache = new Map<string, THREE.BufferGeometry>();

/** Cache a geometry by key (geometries are shared and never disposed while the page lives). */
export function memoGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = gcache.get(key) as T | undefined;
  if (!g) {
    g = make();
    g.name = key;
    gcache.set(key, g);
  }
  return g;
}

export const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** A path through points with rounded corners (radius r), as a CurvePath. */
export function roundedPath(points: Vec3[], r: number): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const pts = points.map(v3);
  if (pts.length < 2) return path;
  let cur = pts[0]!.clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const prev = pts[i - 1]!;
    const next = pts[i + 1]!;
    const dIn = p.clone().sub(prev);
    const dOut = next.clone().sub(p);
    const rr = Math.min(r, dIn.length() * 0.49, dOut.length() * 0.49);
    dIn.normalize();
    dOut.normalize();
    const a = p.clone().addScaledVector(dIn, -rr);
    const b = p.clone().addScaledVector(dOut, rr);
    if (a.distanceTo(cur) > 1e-4) path.add(new THREE.LineCurve3(cur, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    cur = b;
  }
  const last = pts[pts.length - 1]!;
  if (last.distanceTo(cur) > 1e-4) path.add(new THREE.LineCurve3(cur, last));
  return path;
}

/** Tube along a polyline with rounded bends; segments scale with length. */
export function bentTube(points: Vec3[], radius: number, bend = 0.8, radial = 8): THREE.TubeGeometry {
  const path = roundedPath(points, bend);
  const len = path.getLength();
  const segs = Math.max(8, Math.min(160, Math.round(len * 2.2) + points.length * 6));
  return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, segs, radius, radial, false);
}

/** Smooth tube through points (Catmull-Rom). */
export function smoothTube(points: THREE.Vector3[], radius: number, radial = 10, perMm = 0.7): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
  const segs = Math.max(12, Math.min(260, Math.round(curve.getLength() * perMm)));
  return new THREE.TubeGeometry(curve, segs, radius, radial, false);
}

/** Lathe around +y from (radius, y) pairs, listed bottom to top. */
export function latheY(profile: [number, number][], segments = 32, phiStart = 0, phiLength = Math.PI * 2): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)),
    segments,
    phiStart,
    phiLength,
  );
}

export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h);
  s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** Flat rounded rectangle in the x-z plane facing +y, UVs 0..1 across it. */
export function roundedRectPlane(w: number, d: number, r: number, seg = 6): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, d, r), seg);
  // Shape lies in x-y; map y -> -z so it faces +y after rotation.
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position!;
  const uv = g.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, 1 - (pos.getZ(i) + d / 2) / d);
  }
  return g;
}

/** Solid slab: rounded rectangle footprint w x d, extruded from y0 to y1 with a small bevel on top. */
export function roundedSlab(w: number, d: number, h: number, r: number, bevel = 0.4, curveSeg = 6): THREE.BufferGeometry {
  const b = Math.min(bevel, h / 3, r * 0.9);
  const shape = roundedRectShape(w - b * 2, d - b * 2, Math.max(0.01, r - b));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, h - b * 2),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: curveSeg,
  });
  // Extrusion runs along +z; turn it so it runs along +y and starts at y = 0.
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  g.computeVertexNormals();
  return g;
}

export function roundedBox(w: number, h: number, d: number, r: number, seg = 3): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}

/**
 * Vertical walls around a closed outline (x, z points), from y0 to y1, with u running along the outline
 * (0..1 over its length) and v from bottom to top. Used for printed wraps (battery jacket).
 */
export function wallsAround(outline: [number, number][], y0: number, y1: number): THREE.BufferGeometry {
  const n = outline.length;
  const lengths = [0];
  for (let i = 1; i <= n; i++) {
    const a = outline[i - 1]!;
    const b = outline[i % n]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[n]!;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = outline[i % n]!;
    pos.push(p[0], y0, p[1], p[0], y1, p[1]);
    const u = lengths[i]! / total;
    uv.push(u, 0, u, 1);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    // Outline is counter-clockwise seen from above (x right, z toward viewer means clockwise in x-z): pick winding
    // so faces point outward for an outline listed clockwise when viewed from +y.
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Outline of a rounded rectangle in the x-z plane, centred, as points. Order: down the left side, along the near
 * side (+z) from left to right, up the right side, back along the far side; so u in wallsAround reads left to right
 * on the near face.
 */
export function roundedRectOutline(w: number, d: number, r: number, seg = 6): [number, number][] {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [-w / 2 + r, d / 2 - r, Math.PI],
    [w / 2 - r, d / 2 - r, Math.PI / 2],
    [w / 2 - r, -d / 2 + r, 0],
    [-w / 2 + r, -d / 2 + r, -Math.PI / 2],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 - (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** Arc length position (0..1) of the near face's left and right edges in roundedRectOutline, for texture layout. */
export function roundedRectNearFace(w: number, d: number, r: number): { u0: number; u1: number; perimeter: number } {
  const arc = (Math.PI / 2) * r;
  const sideZ = d - 2 * r;
  const sideX = w - 2 * r;
  const perimeter = 2 * sideX + 2 * sideZ + 4 * arc;
  // The outline starts on the left side at the start of the near-left arc, so the near face begins one arc later.
  const u0 = arc / perimeter;
  const u1 = (arc + sideX) / perimeter;
  return { u0, u1, perimeter };
}

/** Floor height under a point: the board top over the board, else the desk. */
export type FloorFn = (x: number, z: number) => number;

/**
 * Points along a flexible cable from `a` (leaving in direction `aDir`) to `b` (arriving against `bDir`, i.e. bDir
 * points from b back along the cable). The cable sags under gravity when it has slack and rests on the floor.
 */
export function cablePoints(
  a: THREE.Vector3,
  aDir: THREE.Vector3,
  b: THREE.Vector3,
  bDir: THREE.Vector3,
  length: number,
  radius: number,
  floor: FloorFn,
  n = 40,
): THREE.Vector3[] {
  const dist = a.distanceTo(b);
  const slack = Math.max(0, length - dist);
  const t0 = Math.min(Math.max(dist * 0.3, 10), 70) + slack * 0.12;
  const c1 = a.clone().addScaledVector(aDir.clone().normalize(), t0);
  const c2 = b.clone().addScaledVector(bDir.clone().normalize(), t0);
  const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
  const sag = Math.min(Math.sqrt(slack * Math.max(dist, 20)) * 0.55, 160);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const w = Math.sin(Math.PI * t);
    p.y -= sag * w * w;
    // Spread a lying cable sideways a little so it does not look like a ruler.
    const fl = floor(p.x, p.z) + radius;
    if (p.y < fl) p.y = fl;
    pts.push(p);
  }
  // Keep the ends exact.
  pts[0] = a.clone();
  pts[n] = b.clone();
  return pts;
}

/**
 * A hanging cable by position-based relaxation: a chain of fixed total length between two ends, pulled down by
 * gravity, kept off the floor, and leaving each end along its direction for a short stiff stretch.
 * Deterministic (no state between calls), so it can be rebuilt whenever an end moves.
 */
export function ropePoints(
  a: THREE.Vector3,
  aDir: THREE.Vector3,
  b: THREE.Vector3,
  bDir: THREE.Vector3,
  length: number,
  radius: number,
  floor: FloorFn,
  stiff = 2,
  bend = 0.18,
): THREE.Vector3[] {
  const dist = a.distanceTo(b);
  const L = Math.max(length, dist * 1.01 + 2);
  const n = Math.max(14, Math.min(56, Math.round(L / 9)));
  const seg = L / n;
  const ad = aDir.clone().normalize();
  const bd = bDir.clone().normalize();
  // Start from the bezier guess so the relaxation settles quickly.
  const init = cablePoints(a, ad, b, bd, L, radius, floor, n);
  const pts = init.map((p) => p.clone());
  const fixed = new Set<number>();
  for (let k = 0; k <= stiff; k++) {
    pts[k] = a.clone().addScaledVector(ad, seg * k);
    pts[n - k] = b.clone().addScaledVector(bd, seg * k);
    fixed.add(k);
    fixed.add(n - k);
  }
  const g = Math.max(0.15, seg * 0.08);
  const tmp = new THREE.Vector3();
  // Cables are stiffer near their ends (strain reliefs, plugs): less sag and more bending resistance there.
  const near = (i: number) => {
    const t = Math.min(1, Math.min(i, n - i) / Math.max(2, n * 0.22));
    return t * t * (3 - 2 * t);
  };
  const weight = Array.from({ length: n + 1 }, (_, i) => near(i));
  for (let it = 0; it < 160; it++) {
    for (let i = 0; i <= n; i++) if (!fixed.has(i)) pts[i]!.y -= g * (0.25 + 0.75 * weight[i]!);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) {
        const p = pts[i]!;
        const q = pts[i + 1]!;
        tmp.subVectors(q, p);
        const d = tmp.length() || 1e-6;
        const diff = (d - seg) / d;
        const fp = fixed.has(i);
        const fq = fixed.has(i + 1);
        if (fp && fq) continue;
        if (fp) q.addScaledVector(tmp, -diff);
        else if (fq) p.addScaledVector(tmp, diff);
        else {
          p.addScaledVector(tmp, diff * 0.5);
          q.addScaledVector(tmp, -diff * 0.5);
        }
      }
      // Near the ends, keep the cable straightening out of its end direction (no kink after a plug or boot).
      for (let i = 2; i <= n - 2; i++) {
        if (fixed.has(i)) continue;
        const k = 0.45 * (1 - weight[i]!);
        if (k < 0.01) continue;
        const p = pts[i]!;
        if (i < n / 2) tmp.copy(pts[i - 1]!).multiplyScalar(2).sub(pts[i - 2]!);
        else tmp.copy(pts[i + 1]!).multiplyScalar(2).sub(pts[i + 2]!);
        p.lerp(tmp, k);
      }
      // Bending stiffness: pull each point toward the midpoint of its neighbours.
      for (let i = 1; i < n; i++) {
        if (fixed.has(i)) continue;
        const p = pts[i]!;
        tmp.addVectors(pts[i - 1]!, pts[i + 1]!).multiplyScalar(0.5).sub(p);
        p.addScaledVector(tmp, Math.min(0.5, bend + (1 - weight[i]!) * 0.3));
      }
      for (let i = 0; i <= n; i++) {
        if (fixed.has(i)) continue;
        const p = pts[i]!;
        const f = floor(p.x, p.z) + radius;
        if (p.y < f) p.y = f;
      }
    }
  }
  return pts;
}
