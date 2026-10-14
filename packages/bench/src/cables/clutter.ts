// How cluttered a bench's cables look, seen from above: crossings, cables over parts and clips, parts on top of each
// other, cables much longer than the gap they bridge, cables running out of the frame. Pure. The cable variants page
// shows it beside each bench; a lower score reads more clearly.

import type { Vec2 } from "../types";
import { boundsOf, convexOverlap, dist, inRect, polyHits, polyInside, polyLength, segDist, segInside, shrink, type Rect } from "./geom";

export type ClutterEnd = {
  /** The jaws (a clip) or the tip (a probe). */
  tip: Vec2;
  /** Where the cable leaves the clip or probe body. */
  tail: Vec2;
  attached: boolean;
  /** Body ids this end belongs to (the part it bites, its holder, the board, the meter): its cable may cross them. */
  owners: string[];
};

export type ClutterCable = { id: string; a: ClutterEnd; b: ClutterEnd; /** Tail to tail. */ cable: Vec2[] };

export type ClutterBody = {
  id: string;
  /** Outline on the desk (convex). */
  poly: Vec2[];
  /** Counts for part-on-part overlap (a desk part or the meter, not something sitting in a holder). */
  solid: boolean;
  /** Ids this body belongs with (a holder and what it holds), never counted as overlapping each other. */
  family: string[];
};

export type ClutterScene = { cables: ClutterCable[]; bodies: ClutterBody[]; frame: Rect };

export type Clutter = {
  /** Cable crossing cable (not where two clips share a terminal). */
  crossings: number;
  /** A cable crossing another lead's clip. */
  overClips: number;
  /** A cable (or clip body) lying across a part it is not clipped to, or looping back over its own. */
  overParts: number;
  /** Desk parts lying on top of each other. */
  overlaps: number;
  /** Mean of drawn length over straight distance, for leads clipped at both ends. */
  stretch: number;
  /** Cables (or loose clips) reaching outside the frame. */
  outside: number;
  /** One number: lower is tidier. */
  score: number;
  /** The same before rounding, for searches. */
  raw: number;
};

const CLIP_HALF = 2.6;

export function clutter(scene: ClutterScene): Clutter {
  const { cables, bodies } = scene;
  let crossings = 0;
  let overClips = 0;
  let overParts = 0;
  let overlaps = 0;
  let stretchSum = 0;
  let stretchN = 0;
  let stretchPenalty = 0;
  let outside = 0;
  let outsideMm = 0;

  const shared = (p: ClutterCable, q: ClutterCable): Vec2[] => {
    const out: Vec2[] = [];
    for (const e of [p.a, p.b]) for (const f of [q.a, q.b]) if (e.attached && f.attached && dist(e.tip, f.tip) < 3) out.push(e.tip);
    return out;
  };

  for (let i = 0; i < cables.length; i++) {
    const p = cables[i]!;
    for (let j = i + 1; j < cables.length; j++) {
      const q = cables[j]!;
      const near = shared(p, q);
      for (const h of polyHits(p.cable, q.cable)) if (!near.some((s) => dist(s, h) < 10)) crossings++;
    }
    // Over another lead's clips.
    for (let j = 0; j < cables.length; j++) {
      if (j === i) continue;
      const q = cables[j]!;
      const near = shared(p, q);
      for (const e of [q.a, q.b]) {
        let hit = false;
        for (const pt of p.cable) {
          if (near.some((s) => dist(s, pt) < 12)) continue;
          if (segDist(pt, e.tip, e.tail) < CLIP_HALF) {
            hit = true;
            break;
          }
        }
        if (!hit && polyHits(p.cable, [e.tip, e.tail]).some((h) => !near.some((s) => dist(s, h) < 12))) hit = true;
        if (hit) overClips++;
      }
    }
    // Over parts.
    const own = new Set([...p.a.owners, ...p.b.owners]);
    for (const b of bodies) {
      const poly = shrink(b.poly, 0.5);
      const mine = own.has(b.id) || b.family.some((f) => own.has(f));
      const inside = polyInside(poly, p.cable);
      if (mine ? inside > 12 : inside > 2) {
        overParts++;
        continue;
      }
      if (mine) continue;
      // A clip body lying across a part it does not bite.
      for (const e of [p.a, p.b]) if (segInside(poly, e.tip, e.tail) > 4) overParts++;
    }
    // Stretch.
    if (p.a.attached && p.b.attached) {
      const drawn = dist(p.a.tip, p.a.tail) + polyLength(p.cable) + dist(p.b.tail, p.b.tip);
      const r = drawn / Math.max(dist(p.a.tip, p.b.tip), 40);
      stretchSum += r;
      stretchN++;
      stretchPenalty += Math.max(0, r - 1.6);
    }
    // Out of the frame.
    let worst = 0;
    for (const pt of [p.a.tip, p.a.tail, ...p.cable, p.b.tail, p.b.tip]) {
      if (inRect(pt, scene.frame)) continue;
      const dx = Math.max(scene.frame[0] - pt[0], 0, pt[0] - scene.frame[2]);
      const dz = Math.max(scene.frame[1] - pt[1], 0, pt[1] - scene.frame[3]);
      worst = Math.max(worst, Math.hypot(dx, dz));
    }
    if (worst > 3) {
      outside++;
      outsideMm += Math.min(worst, 60);
    }
  }

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    if (!a.solid) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      if (!b.solid) continue;
      if (a.family.includes(b.id) || b.family.includes(a.id)) continue;
      if (convexOverlap(a.poly, b.poly, 1)) overlaps++;
    }
  }

  const stretch = stretchN ? stretchSum / stretchN : 1;
  const raw = 10 * crossings + 4 * overClips + 6 * overParts + 8 * overlaps + 4 * stretchPenalty + 3 * outside + outsideMm / 10;
  return { crossings, overClips, overParts, overlaps, stretch: Math.round(stretch * 100) / 100, outside, score: Math.round(raw), raw };
}

/** The frame a bench is seen in: a lab's frame grown to take in every body, or everything that is drawn. */
export function sceneFrame(bodies: readonly ClutterBody[], frame: Rect | null, extra: Vec2[] = []): Rect {
  const pts: Vec2[] = [...extra];
  for (const b of bodies) pts.push(...b.poly);
  if (frame) pts.push([frame[0], frame[1]], [frame[2], frame[3]]);
  const r = pts.length ? boundsOf(pts, 4) : ([-110, -60, 110, 60] as Rect);
  return r;
}
