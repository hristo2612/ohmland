// Drag and drop, shared by both views (docs/BENCH-VIEWS.md, "Drag and drop"): how near a drop snaps, how big a grab
// area is, how a picked-up part lifts and settles, where a drop would land (the marks DragMarks draws), edge auto-pan
// and the haptic tick. Pure, no React and no three.js: each view feeds it its own projection and applies a part's
// lift to its own drawing.

import { parseAnchor } from "../anchors";
import { boardGeometry, boardOrigin } from "../board";
import type { BenchLabels } from "../labels";
import { canMountOnBoard } from "../parts";
import { holderOf } from "../seats";
import type { Anchor, BenchState, Vec2 } from "../types";
import { holeShort, loupeName, spanName, TOUCH_SNAP } from "./Loupe";

export const DRAG = {
  /** CSS px: with a mouse, a clip, probe tip, plug or part snaps to a drop point this near (a magnet). */
  mouseSnap: 12,
  /** CSS px: the same for a finger (the loupe shows it). */
  touchSnap: TOUCH_SNAP,
  /** CSS px: invisible hit padding round small things, when nothing is right under the pointer (44 px targets). */
  grabTouch: 22,
  grabMouse: 14,
  /** CSS px a dragged item rides above the finger, so the finger does not hide it. */
  touchLift: 44,
  /** CSS px of travel before a press becomes a drag. */
  slopMouse: 4,
  slopTouch: 7,
  /** A press on a switch that travels less than this (CSS px) flips it, as a tap does. */
  flipDrag: 28,
  /** Motion (ms): picking up, settling into place, gliding back from a drop that does not take. */
  liftMs: 120,
  settleMs: 150,
  glideMs: 260,
  /** How much bigger a lifted part is drawn. */
  liftScale: 1.06,
  /** Edge auto-pan: the band (CSS px) along the bench's edges, the top speed (px a frame) and the wait before it starts. */
  edge: 36,
  edgeSpeed: 10,
  edgeDwell: 160,
  /** CSS px: other drop points this near the dragged tip glow softly. */
  near: 64,
} as const;

export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** A small tick under the finger where the device has one (a drop that took). */
export function haptic(touch: boolean): void {
  if (!touch || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(8);
  } catch {
    // No vibration here.
  }
}

/** A tiny external store (the loupe's pattern): views set it, an overlay reads it with useSyncExternalStore. */
export type Feed<T> = { get(): T | null; set(v: T | null): void; subscribe(cb: () => void): () => void };

export function createFeed<T>(same: (a: T, b: T) => boolean = (a, b) => a === b): Feed<T> {
  let state: T | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      if (next === state || (next !== null && state !== null && same(next, state))) return;
      state = next;
      for (const cb of [...listeners]) cb();
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

// ---- Where a drop would land -------------------------------------------------------------------------------------

/** A point in CSS px relative to the bench element. */
export type Pt = { x: number; y: number };

/**
 * What DragMarks draws while something is dragged: the drop points it would use (a part's legs on their holes, the
 * terminal a clip would bite) glowing in blue ink, other drop points near it more faintly, a quiet cross where a drop
 * would not take, and the target's name in ink beside it. CSS px relative to the bench element.
 */
export type DragMarksState = {
  ghosts: Pt[];
  near: Pt[];
  cross: Pt | null;
  name: { text: string; at: Pt } | null;
  /** Where the dragged item's hot point is (the loupe's centre on touch). */
  hot: Pt | null;
  /** Radius (CSS px) of a drop point's ring: smaller when the holes are close together on screen. */
  r: number;
};

/** A drop point's ring radius for holes `pitchPx` apart on screen: inside its own hole's share, 3.5 to 7 px. */
export const ringFor = (pitchPx: number) => Math.max(3.5, Math.min(7, pitchPx * 0.42));

export function sameMarks(a: DragMarksState, b: DragMarksState): boolean {
  const pts = (p: Pt[], q: Pt[]) => p.length === q.length && p.every((v, i) => Math.abs(v.x - q[i]!.x) < 0.5 && Math.abs(v.y - q[i]!.y) < 0.5);
  const pt = (p: Pt | null, q: Pt | null) => (!p || !q ? p === q : Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5);
  return pts(a.ghosts, b.ghosts) && pts(a.near, b.near) && pt(a.cross, b.cross) && pt(a.hot, b.hot) && a.name?.text === b.name?.text && pt(a.name?.at ?? null, b.name?.at ?? null) && Math.abs(a.r - b.r) < 0.2;
}

/** The drag a view is running, as far as the marks care. */
export type DragKind = { kind: string; id?: string; leg?: string; end?: "a" | "b"; color?: "red" | "black" };

/**
 * The marks for a drag, from the bench as it is now (mid-drag, a part already sits in the holes it would drop into;
 * a clip or probe's snap point is `snap`). `project` maps an anchor to CSS px (null off screen). `invalid`: the drop
 * would not take where the hot point is (a part over the board where it does not fit, the tray).
 */
export function dragMarks(
  bench: BenchState,
  drag: DragKind,
  opts: { snap: Anchor | null; hot: Pt; invalid: boolean; near?: Pt[]; project: (anchor: Anchor) => Pt | null; labels: BenchLabels; r?: number },
): DragMarksState {
  const { project, labels, hot } = opts;
  const out: DragMarksState = { ghosts: [], near: [], cross: null, name: null, hot, r: opts.r ?? 7 };
  if (opts.invalid) {
    out.cross = hot;
    return out;
  }
  const add = (a: Anchor) => {
    const p = project(a);
    if (p) out.ghosts.push(p);
    return p;
  };
  switch (drag.kind) {
    case "part": {
      const part = bench.parts.find((p) => p.id === drag.id);
      const holes = [...new Set(Object.values(part?.holes ?? {}).filter((h): h is string => !!h))];
      for (const h of holes) add(`hole:${h}`);
      const text = spanName(part?.holes, labels);
      if (text && out.ghosts.length) out.name = { text, at: topmost(out.ghosts) };
      break;
    }
    case "leg": {
      const h = bench.parts.find((p) => p.id === drag.id)?.holes?.[drag.leg ?? ""];
      const p = h ? add(`hole:${h}`) : null;
      if (p && h) out.name = { text: holeShort(h), at: p };
      break;
    }
    case "wireEnd": {
      const w = bench.wires.find((x) => x.id === drag.id);
      const h = w && drag.end ? w[drag.end] : null;
      const p = h ? add(`hole:${h}`) : null;
      if (p && h) out.name = { text: holeShort(h), at: p };
      break;
    }
    case "clip":
    case "probe": {
      if (opts.snap) {
        const p = add(opts.snap);
        if (p) out.name = { text: loupeName(bench, opts.snap, labels), at: p };
      }
      out.near = (opts.near ?? []).filter((n) => !out.ghosts.some((g) => Math.hypot(g.x - n.x, g.y - n.y) < 4));
      break;
    }
    case "plug": {
      const s = drag.color ? bench.meter?.probes[drag.color].socket : null;
      if (s) {
        const p = add(`socket:${s}`);
        if (p) out.name = { text: socketName(s), at: p };
      }
      break;
    }
  }
  return out;
}

const SOCKET_NAMES: Record<string, string> = { com: "COM", vohm: "VΩ", ma: "mA", a10: "10A" };
const socketName = (s: string) => SOCKET_NAMES[s] ?? s.toUpperCase();

const topmost = (pts: Pt[]) => pts.reduce((a, b) => (b.y < a.y ? b : a));

/** Whether an anchor names a breadboard hole (holes do not glow as "near" targets: there are too many). */
export const isHole = (a: Anchor) => parseAnchor(a)?.type === "hole";

/**
 * A part dragged over the breadboard (desk point `at`) that fits no free holes there: a drop would not take (it would
 * lie on top of the board), so the marks show a cross and a drop glides it back.
 */
export function partMisfit(bench: BenchState, id: string, at: Vec2): boolean {
  const part = bench.parts.find((p) => p.id === id);
  if (!part || !bench.board || !canMountOnBoard(part)) return false;
  if (Object.values(part.holes ?? {}).some(Boolean) || holderOf(bench, id)) return false;
  const g = boardGeometry(bench.board);
  const [ox, oz] = boardOrigin(bench.board);
  return Math.abs(at[0] - ox) <= g.width / 2 && Math.abs(at[1] - oz) <= g.depth / 2;
}

/** Whether a drop landed on something: a part in holes or a seat, a clip or tip on a point, a plug in a socket. */
export function landed(bench: BenchState, drag: DragKind, snap: Anchor | null): boolean {
  switch (drag.kind) {
    case "part": {
      const part = bench.parts.find((p) => p.id === drag.id);
      return !!part && (Object.values(part.holes ?? {}).some(Boolean) || !!holderOf(bench, part.id));
    }
    case "clip":
    case "probe":
      return !!snap;
    case "plug":
      return !!(drag.color && bench.meter?.probes[drag.color].socket);
    case "leg":
    case "wireEnd":
      return true;
    default:
      return false;
  }
}

// ---- A part lifted off the bench --------------------------------------------------------------------------------

/**
 * How a dragged part is drawn off its place in the bench state: offset `dx`, `dz` (desk mm) from where the state puts
 * it, drawn `k` times its size and lifted `h` (0 to 1: the shadow and, in 3D, a few mm up).
 */
export type Lift = { dx: number; dz: number; k: number; h: number };

export const NO_LIFT: Lift = { dx: 0, dz: 0, k: 1, h: 0 };

const lerpLift = (a: Lift, b: Lift, t: number): Lift => ({ dx: a.dx + (b.dx - a.dx) * t, dz: a.dz + (b.dz - a.dz) * t, k: a.k + (b.k - a.k) * t, h: a.h + (b.h - a.h) * t });

/**
 * Animates one part's lift and hands each step to the view (`apply(id, lift)`; null puts it back as the state draws
 * it). `to` eases there over `ms` (at once under reduced motion); `set` jumps.
 */
export class LiftAnimator {
  id: string | null = null;
  cur: Lift = NO_LIFT;
  private anim: { from: Lift; to: Lift; t0: number; ms: number; done?: () => void } | null = null;
  private raf = 0;
  constructor(private apply: (id: string, lift: Lift | null) => void) {}

  set(id: string, lift: Lift): void {
    if (this.id && this.id !== id) this.clear();
    this.id = id;
    this.stop();
    this.cur = lift;
    this.apply(id, lift);
  }

  to(id: string, lift: Lift, ms: number, done?: () => void): void {
    if (this.id && this.id !== id) this.clear();
    this.id = id;
    const prev = this.anim;
    this.stop();
    prev?.done?.();
    if (ms <= 0 || reducedMotion() || typeof requestAnimationFrame !== "function") {
      this.cur = lift;
      this.apply(id, isRest(lift) ? null : lift);
      if (isRest(lift)) this.id = null;
      done?.();
      return;
    }
    this.anim = { from: { ...this.cur }, to: lift, t0: performance.now(), ms, done };
    const step = () => {
      const a = this.anim;
      if (!a || !this.id) return;
      const t = Math.min(1, (performance.now() - a.t0) / a.ms);
      this.cur = lerpLift(a.from, a.to, easeOut(t));
      const id = this.id;
      if (t >= 1) {
        this.anim = null;
        this.raf = 0;
        this.apply(id, isRest(this.cur) ? null : this.cur);
        if (isRest(this.cur)) this.id = null;
        a.done?.();
        return;
      }
      this.apply(id, this.cur);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Whether a glide or settle is still running. */
  get busy(): boolean {
    return !!this.anim;
  }

  /** Finish what is running at once (its end state and its callback). */
  finish(): void {
    const a = this.anim;
    if (!a || !this.id) return;
    this.stop();
    this.cur = a.to;
    const id = this.id;
    this.apply(id, isRest(a.to) ? null : a.to);
    if (isRest(a.to)) this.id = null;
    a.done?.();
  }

  clear(): void {
    this.stop();
    if (this.id) this.apply(this.id, null);
    this.id = null;
    this.cur = NO_LIFT;
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.anim = null;
  }
}

const isRest = (l: Lift) => Math.abs(l.dx) < 1e-3 && Math.abs(l.dz) < 1e-3 && Math.abs(l.k - 1) < 1e-4 && l.h < 1e-3;

// ---- Edge auto-pan ---------------------------------------------------------------------------------------------

/** The edges a tray or panel covers (CSS px from each edge): no auto-pan there, a drop there goes back. */
export type Covered = { left?: number; right?: number; top?: number; bottom?: number };

/**
 * How fast (CSS px a frame) to pan while a drag holds the pointer near the bench's edge: toward that edge, faster the
 * nearer. Edges a tray covers do not pan (dragging onto the tray takes a part back).
 */
export function edgeVelocity(x: number, y: number, w: number, h: number, covered: Covered = {}): [number, number] {
  const e = DRAG.edge;
  const v = (d: number) => (d < e ? DRAG.edgeSpeed * Math.min(1, (e - Math.max(0, d)) / e) ** 2 : 0);
  const vx = covered.right ? 0 : v(w - x);
  const vxl = covered.left ? 0 : v(x);
  const vy = covered.bottom ? 0 : v(h - y);
  const vyt = covered.top ? 0 : v(y);
  return [vx - vxl, vy - vyt];
}
