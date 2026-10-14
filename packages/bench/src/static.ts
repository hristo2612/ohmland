// The static toy (docs/curriculum/start-here.md, SH3): a small, pure, deterministic model of charge, kept apart from
// the circuit simulator. Charge lives on the bench (each toy's `charge` param, in marks: one mark is one minus sign
// drawn on it), so both views draw it and labs read it with `lab.static(id)`.
//
// - Rubbing a balloon, a comb or a plastic spoon on the wool scarf moves charge onto it (it gains minus marks, the
//   scarf as many plus marks). Metal held in your hand keeps none: the charge runs off through you.
// - A charged thing pulls on neutral paper bits (they hop up to it) and on a wall (a charged balloon sticks to it;
//   an uncharged one falls back to the desk).
// - Two charged balloons push each other apart.

import { STATIC } from "./dims";
import { rotateXZ } from "./parts";
import type { BenchState, PlacedPart, Vec2 } from "./types";

/** Most marks a rubbed thing takes. */
export const MAX_MARKS = 8;
/** Millimetres of rubbing per mark. */
export const RUB_MM = 18;
/** Marks needed to pull paper bits or hold a balloon on a wall. */
export const PULL_MARKS = 2;
/** How near (mm) a charged thing must be to lift paper bits. */
export const PULL_REACH = 42;
/** Closest two charged balloons let each other come (mm, centre to centre), and more the more charge. */
export const APART_MM = 44;

/** Things that can be rubbed on the scarf. */
export function chargeable(p: PlacedPart): boolean {
  if (p.kind === "balloon" || p.kind === "comb") return true;
  return p.kind === "sample" && (p.params.material === "spoon" || p.params.material === "metal-spoon" || p.params.material === "plastic");
}

/** Metal in your hand: rubbed, it keeps no charge. */
export function drains(p: PlacedPart): boolean {
  return p.kind === "sample" && p.params.material === "metal-spoon";
}

/** A thing's charge in marks: negative is minus marks (electrons gained), positive plus marks (the scarf). */
export function charge(p: PlacedPart | undefined): number {
  return (p?.params as { charge?: number } | undefined)?.charge ?? 0;
}

const within = (p: PlacedPart, at: Vec2, w: number, d: number, pad = 0): boolean => {
  const [lx, lz] = rotateXZ(at[0] - p.pos[0], at[1] - p.pos[1], -p.rot);
  return Math.abs(lx) <= w / 2 + pad && Math.abs(lz) <= d / 2 + pad;
};

const setCharge = (b: BenchState, id: string, q: number): BenchState => ({
  ...b,
  parts: b.parts.map((p) => (p.id === id ? ({ ...p, params: { ...p.params, charge: Math.round(q * 100) / 100 } } as PlacedPart) : p)),
});

/**
 * A chargeable thing moved from where it lay to `to`: over the scarf, that rubs it. Returns the bench with the new
 * charges (the move itself is the caller's).
 */
export function rub(bench: BenchState, id: string, to: Vec2): BenchState {
  const part = bench.parts.find((p) => p.id === id);
  if (!part || !chargeable(part)) return bench;
  const scarf = bench.parts.find((p) => p.kind === "scarf" && within(p, to, STATIC.scarfW, STATIC.scarfD) && within(p, part.pos, STATIC.scarfW, STATIC.scarfD));
  if (!scarf) return bench;
  const d = Math.hypot(to[0] - part.pos[0], to[1] - part.pos[1]);
  if (d < 0.5) return bench;
  if (drains(part)) return charge(part) ? setCharge(bench, id, 0) : bench;
  const before = charge(part);
  const after = Math.max(-MAX_MARKS, before - d / RUB_MM);
  return setCharge(setCharge(bench, id, after), scarf.id, charge(scarf) + (before - after));
}

/** The wall a charged balloon is stuck to (touching its face), or null. */
export function stuckTo(bench: BenchState, id: string): string | null {
  const b = bench.parts.find((p) => p.id === id);
  if (b?.kind !== "balloon" || Math.abs(charge(b)) < PULL_MARKS) return null;
  for (const w of bench.parts) if (w.kind === "wall" && touchesWall(w, b.pos)) return w.id;
  return null;
}

/** A balloon at `at` is against this wall's face (in front of it, within a few mm). */
function touchesWall(wall: PlacedPart, at: Vec2): boolean {
  const [lx, lz] = rotateXZ(at[0] - wall.pos[0], at[1] - wall.pos[1], -wall.rot);
  const face = STATIC.wallD / 2 + STATIC.balloon / 2;
  return Math.abs(lx) <= STATIC.wallW / 2 && lz >= face - 8 && lz <= face + 6;
}

/**
 * Where a balloon comes to rest when dropped at `to`: against a wall it sticks if charged, otherwise it falls back to
 * the desk in front; near another charged balloon it is pushed away.
 */
export function settle(bench: BenchState, id: string, to: Vec2): Vec2 {
  const b = bench.parts.find((p) => p.id === id);
  if (b?.kind !== "balloon") return to;
  let at: Vec2 = to;
  for (const w of bench.parts) {
    if (w.kind !== "wall" || !touchesWall(w, at)) continue;
    const [lx] = rotateXZ(at[0] - w.pos[0], at[1] - w.pos[1], -w.rot);
    const face = STATIC.wallD / 2 + STATIC.balloon / 2 + (Math.abs(charge(b)) >= PULL_MARKS ? 0 : 34);
    const [rx, rz] = rotateXZ(lx, face, w.rot);
    at = [w.pos[0] + rx, w.pos[1] + rz];
  }
  if (Math.abs(charge(b)) >= PULL_MARKS) {
    for (const o of bench.parts) {
      if (o.id === id || o.kind !== "balloon" || Math.abs(charge(o)) < PULL_MARKS) continue;
      const dx = at[0] - o.pos[0];
      const dz = at[1] - o.pos[1];
      const d = Math.hypot(dx, dz);
      const min = APART_MM + 2 * Math.sqrt(Math.abs(charge(b) * charge(o)));
      if (d < min) {
        const ux = d > 0.1 ? dx / d : 1;
        const uz = d > 0.1 ? dz / d : 0;
        at = [o.pos[0] + ux * min, o.pos[1] + uz * min];
      }
    }
  }
  return at;
}

/** The charged thing pulling a heap of paper bits up to it (the nearest within reach), or null. */
export function lifting(bench: BenchState, paperId: string): string | null {
  const paper = bench.parts.find((p) => p.id === paperId);
  if (paper?.kind !== "paper") return null;
  let best: { id: string; d: number } | null = null;
  for (const p of bench.parts) {
    if (!chargeable(p) || Math.abs(charge(p)) < PULL_MARKS) continue;
    const d = Math.hypot(p.pos[0] - paper.pos[0], p.pos[1] - paper.pos[1]);
    if (d <= PULL_REACH && (!best || d < best.d)) best = { id: p.id, d };
  }
  return best?.id ?? null;
}

/** Centre to centre distance between two balloons (mm), or Infinity. */
export function apart(bench: BenchState, a: string, b: string): number {
  const pa = bench.parts.find((p) => p.id === a);
  const pb = bench.parts.find((p) => p.id === b);
  return pa && pb ? Math.hypot(pa.pos[0] - pb.pos[0], pa.pos[1] - pb.pos[1]) : Infinity;
}
