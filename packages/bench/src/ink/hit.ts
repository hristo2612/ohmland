// Hit testing, snapping and keyboard navigation for the ink view. Pure: desk millimetres in, picks out.

import { PITCH, boardGeometry, boardOrigin } from "../board";
import { clipTargets, type ClipTarget } from "../layout";
import type { Anchor, BenchState, Vec2 } from "../types";
import { PRIORITY, toLocal, type HitItem, type InkModel, type InkPick, type Shape } from "./model";

/** Distance from a point to a shape's edge (0 or less inside), in mm. */
export function shapeDistance(s: Shape, x: number, z: number): number {
  switch (s.t) {
    case "circle":
      return Math.hypot(x - s.x, z - s.z) - s.r;
    case "capsule": {
      const vx = s.bx - s.ax;
      const vz = s.bz - s.az;
      const l2 = vx * vx + vz * vz;
      const t = l2 ? Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / l2)) : 0;
      return Math.hypot(x - (s.ax + vx * t), z - (s.az + vz * t)) - s.r;
    }
    case "box": {
      const [lx, lz] = toLocal(s.f, x, z);
      const [x0, z0, x1, z1] = s.b;
      const dx = Math.max(x0 - lx, 0, lx - x1);
      const dz = Math.max(z0 - lz, 0, lz - z1);
      if (dx === 0 && dz === 0) return -Math.min(lx - x0, x1 - lx, lz - z0, z1 - lz);
      return Math.hypot(dx, dz);
    }
  }
}

/**
 * What the pointer would grab at a desk point. `tol` is the reach in mm (a few screen pixels, more for touch).
 * Among everything within reach, handles beat bodies; then the closest; then whatever is drawn on top.
 */
export function hitTest(model: InkModel, x: number, z: number, tol: number): InkPick | null {
  let best: HitItem | null = null;
  let bestKey = -Infinity;
  for (const h of model.hits) {
    const d = shapeDistance(h.shape, x, z);
    if (d > tol) continue;
    // Inside counts as distance 0; a handle a little way off still beats the body under the pointer.
    const key = PRIORITY[h.pick.type] * 1000 - Math.max(0, d) * 10 + h.order * 1e-3;
    if (key > bestKey) {
      bestKey = key;
      best = h;
    }
  }
  return best?.pick ?? null;
}

/** The hole nearest a desk point, within `maxDist` mm. */
export function holeNear(bench: BenchState, x: number, z: number, maxDist: number): string | null {
  if (!bench.board) return null;
  const g = boardGeometry(bench.board);
  const [ox, oz] = boardOrigin(bench.board);
  const lx = x - ox;
  const lz = z - oz;
  if (Math.abs(lx) > g.width / 2 + maxDist || Math.abs(lz) > g.depth / 2 + maxDist) return null;
  let best: string | null = null;
  let bestD = maxDist;
  const mid = (g.cols + 1) / 2;
  const c0 = Math.round(lx / PITCH + mid);
  for (let col = c0 - 1; col <= c0 + 1; col++) {
    for (const row of ROW_IDS) {
      const h = g.holes.get(`${row}${col}`);
      if (!h) continue;
      const d = Math.hypot(h.x - lx, h.z - lz);
      if (d < bestD) {
        bestD = d;
        best = h.id;
      }
    }
  }
  return best;
}

const ROW_IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "tp", "tn", "bp", "bn"];

export type SnapOptions = { probes?: boolean; leads?: boolean; exclude?: string };

/**
 * The attach point nearest the pointer for a dragged clip or probe tip. Distances are in screen pixels (through
 * `toScreen`), so the reach is the same at every zoom; leads and wire ends win over the hole under them.
 */
export function snapTarget(
  bench: BenchState,
  toScreen: (x: number, z: number) => [number, number],
  px: number,
  py: number,
  radius: number,
  opts: SnapOptions,
  targets: ClipTarget[] = clipTargets(bench, { holes: true, probes: opts.probes, leads: opts.leads }),
): Anchor | null {
  let best: Anchor | null = null;
  let bestD = radius;
  for (const t of targets) {
    if (opts.exclude && t.anchor.startsWith(opts.exclude)) continue;
    const [sx, sy] = toScreen(t.pos[0], t.pos[2]);
    const bonus = t.kind === "hole" ? 0 : 9;
    const d = Math.hypot(sx - px, sy - py) - bonus;
    if (d < bestD) {
      bestD = d;
      best = t.anchor;
    }
  }
  return best;
}

export type NavPoint = { id: string; pos: Vec2 };

/**
 * Spatial keyboard navigation: from `from`, the nearest point in the arrow's direction. Points straight ahead win over
 * points off to the side, so on the breadboard the arrows step hole by hole along rows and columns.
 */
export function nextPoint(points: readonly NavPoint[], from: Vec2, dir: "left" | "right" | "up" | "down"): NavPoint | null {
  const [ux, uz] = dir === "left" ? [-1, 0] : dir === "right" ? [1, 0] : dir === "up" ? [0, -1] : [0, 1];
  let best: NavPoint | null = null;
  let bestScore = Infinity;
  for (const p of points) {
    const dx = p.pos[0] - from[0];
    const dz = p.pos[1] - from[1];
    const ahead = dx * ux + dz * uz;
    if (ahead < 0.3) continue;
    const side = Math.abs(dx * uz - dz * ux);
    // Stay within a 60 degree cone, then prefer the closest, with sideways distance counting three times.
    if (side > ahead * 1.8) continue;
    const score = ahead + side * 3;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** Every point the keyboard cursor can visit: holes, part leads and jumper ends. */
export function navPoints(bench: BenchState): NavPoint[] {
  return clipTargets(bench, { holes: true, probes: false, leads: false }).map((t) => ({ id: t.anchor, pos: [t.pos[0], t.pos[2]] }));
}
