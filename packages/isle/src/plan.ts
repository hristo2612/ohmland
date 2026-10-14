/**
 * The isle plan: a pure function of a seed and the learner's completion events, in order. Nothing is stored: the same
 * events always build the same isle, on any device. Its trigonometry comes from math.ts (plain double arithmetic), so
 * no CPU or engine can move a cell; a test keeps Math.sin, cos, atan2 and hypot out of this file.
 *
 * - A lesson places one piece: the one the lesson names, or else one from a weighted deck that never repeats the
 *   previous piece.
 * - A module grows a land chunk on the rim (a golden-angle spiral, so the board grows forever), builds its landmark
 *   (or raises it a tier when it is already there), and raises the oldest landmark that can still grow.
 * - Each unit is its own floating board. The unit of the learner's first event is the main island; every other unit
 *   gets its own island in the order it was first reached, joined to the main one by a ribbon cable bridge.
 *
 * Every item keeps its history (the event at which it appeared and at which it reached each tier), so the isle at any
 * earlier moment is a filter, and a reveal knows exactly what the latest events brought.
 */
import { DECK, DOCK, footOf, isPiece, landmarkFor, tiersOf, unitOf, variantsOf } from "./catalog";
import type { IsleEvent } from "./events";
import { cos, fnv1a, hypot, rng, sin } from "./math";

export type Story = { at: number; type: "lesson" | "module" | "start"; title: string; ref: string };
export type IsleItem = {
  id: number;
  island: number;
  kind: string;
  /** Cell position on its island. */
  x: number;
  z: number;
  /** Quarter turns about the vertical axis; the item's front (+z) faces its nearest trace. */
  rot: number;
  /** Look variant (colour, bands...). */
  v: number;
  /** Footprint radius in cells. */
  foot: number;
  landmark: boolean;
  /** The event index at which tier i was reached; tiers[0] is when the item appeared (-1: before any lesson). */
  tiers: number[];
  /** Which lesson or module brought each tier. */
  story: Story[];
};
export type LandCell = { x: number; z: number; at: number };
/** A copper trace: ring 0 is a spoke from the central plaza, ring k >= 1 the k-th octagonal bus around it. */
export type Trace = { ring: number; pts: [number, number][] };
/** A round via plaza: the central one (ring -1) or one where a spoke crosses ring k. */
export type Plaza = { x: number; z: number; r: number; ring: number };
export type IslandPlan = {
  id: number;
  unit: string;
  /** The event index at which the island appeared (-1 for the main island). */
  at: number;
  /** World offset of the island's centre. */
  x: number;
  y: number;
  z: number;
  /** The island this one's bridge leads to (-1 for the main island). */
  link: number;
  cells: LandCell[];
  traces: Trace[];
  plazas: Plaza[];
};
export type IslePlan = { seed: number; events: IsleEvent[]; islands: IslandPlan[]; items: IsleItem[] };

export const RING = 11;
export const PLAZA_R = 1.75;
const PLOT0 = 6.6;
const GOLDEN = 2.399963229728653;
const DIRS: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const N4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** A numeric cell key, for coordinates within +-4096. */
export const key = (x: number, z: number): number => (x + 4096) * 8192 + (z + 4096);
export const unkey = (k: number): [number, number] => [Math.floor(k / 8192) - 4096, (k % 8192) - 4096];

/** A ring bus shows once the board reaches a little past it. */
export const ringOpen = (ring: number, landRadius: number): boolean => ring <= 0 || ring * RING < landRadius - 1.5;
/** The board's radius, as if it were a disc of its area. */
export const radiusOf = (cells: number): number => Math.sqrt(cells / Math.PI);

/** Every cell a trace or plaza covers, with its ring (0 spokes, k rings, -1 plazas). Diagonal steps cover both corners. */
export function roadCells(traces: Trace[], plazas: Plaza[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of traces) {
    for (let i = 1; i < t.pts.length; i++) {
      const [ax, az] = t.pts[i - 1]!;
      const [bx, bz] = t.pts[i]!;
      const sx = Math.sign(bx - ax);
      const sz = Math.sign(bz - az);
      const n = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
      for (let s = 0; s <= n; s++) {
        const x = ax + sx * s;
        const z = az + sz * s;
        if (!out.has(key(x, z))) out.set(key(x, z), t.ring);
        if (sx && sz && s < n) {
          if (!out.has(key(x + sx, z))) out.set(key(x + sx, z), t.ring);
          if (!out.has(key(x, z + sz))) out.set(key(x, z + sz), t.ring);
        }
      }
    }
  }
  for (const p of plazas) disc(p.x, p.z, p.r + 0.35, (x, z) => out.set(key(x, z), -1));
  return out;
}

/** Calls fn for every cell of the disc of radius rad round (cx, cz). */
export function disc(cx: number, cz: number, rad: number, fn: (x: number, z: number) => void): void {
  const R = Math.ceil(rad);
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (dx * dx + dz * dz <= rad * rad + 0.3) fn(cx + dx, cz + dz);
}

/** The cells an item stands on. */
export function footCells(it: Pick<IsleItem, "x" | "z" | "foot">): [number, number][] {
  const out: [number, number][] = [];
  disc(it.x, it.z, it.foot, (x, z) => out.push([x, z]));
  return out;
}

/** The tier an item has after event k (-1: not there yet). */
export function tierAt(it: IsleItem, k: number): number {
  let t = -1;
  for (let i = 0; i < it.tiers.length; i++) if (it.tiers[i]! <= k) t = i;
  return t;
}

/**
 * Which way an item at (x, z) faces, in quarter turns (0: +z, 1: +x). Fronts only ever face +z or +x, the two sides the
 * isometric camera sees, so a part shows its face (a meter's dial, a capacitor's stripe): towards the trace at
 * (tx, tz) when it lies that way, else side-on to it.
 */
function facing(x: number, z: number, tx: number, tz: number): number {
  const dx = tx - x;
  const dz = tz - z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 1 : 0;
  return dz >= 0 ? 0 : 1;
}

class Isle {
  readonly plan: IslandPlan;
  readonly land = new Map<number, LandCell>();
  list: LandCell[] = [];
  readonly taken = new Map<number, number>();
  readonly roads: Map<number, number>;
  readonly r: () => number;
  lessons = 0;
  modules = 0;
  lastKind = "";
  readonly landmarks: IsleItem[] = [];
  private grown = 0;
  private readonly phase: number;

  constructor(id: number, unit: string, at: number, seed: number) {
    this.r = rng((Math.imul(seed, 7919) + Math.imul(id + 1, 104729) + 13) >>> 0);
    const r = this.r;
    this.phase = r() * 6;
    const traces: Trace[] = [];
    // four spokes leave the central plaza at right angles, with 45 degree jogs like real traces
    const base = Math.floor(r() * 8);
    const spokes: [number, number][][] = [];
    for (let i = 0; i < 4; i++) {
      const d0 = (base + i * 2) % 8;
      const [ux, uz] = DIRS[d0]!;
      const pts: [number, number][] = [[0, 0]];
      let px = 0;
      let pz = 0;
      let side = r() < 0.5 ? 1 : -1;
      let len = 0;
      let first = true;
      while (len < 140) {
        const run = (first ? 5 : 3) + Math.floor(r() * 6);
        first = false;
        px += ux * run;
        pz += uz * run;
        pts.push([px, pz]);
        len += run;
        const jog = 1 + Math.floor(r() * 2);
        const [jx, jz] = DIRS[(d0 + side + 8) % 8]!;
        px += jx * jog;
        pz += jz * jog;
        pts.push([px, pz]);
        len += jog;
        side = -side;
      }
      traces.push({ ring: 0, pts });
      spokes.push(pts);
    }
    // octagonal ring buses, every RING cells, each corner chamfered by its own amount
    for (let k = 1; k <= 12; k++) {
      const R = k * RING;
      const c = [0, 1, 2, 3].map(() => Math.round(R * (0.28 + r() * 0.24)));
      const [ne, nw, sw, se] = c as [number, number, number, number];
      const pts: [number, number][] = [
        [R, -R + se],
        [R, R - ne],
        [R - ne, R],
        [-R + nw, R],
        [-R, R - nw],
        [-R, -R + sw],
        [-R + sw, -R],
        [R - se, -R],
        [R, -R + se],
      ];
      traces.push({ ring: k, pts });
    }
    // a via plaza where each spoke first crosses each ring
    const plazas: Plaza[] = [{ x: 0, z: 0, r: PLAZA_R, ring: -1 }];
    const ringCells = roadCells(traces.filter((t) => t.ring > 0), []);
    for (const pts of spokes) {
      const seen = new Set<number>();
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1]!;
        const [bx, bz] = pts[i]!;
        const sx = Math.sign(bx - ax);
        const sz = Math.sign(bz - az);
        const n = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
        for (let s = 0; s < n; s++) {
          const x = ax + sx * s;
          const z = az + sz * s;
          const ring = ringCells.get(key(x, z));
          if (ring !== undefined && !seen.has(ring)) {
            seen.add(ring);
            plazas.push({ x, z, r: 1, ring });
          }
        }
      }
    }
    this.roads = roadCells(traces, plazas);
    this.plan = { id, unit, at, x: 0, y: 0, z: 0, link: id === 0 ? -1 : 0, cells: [], traces, plazas };
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) if (hypot(x, z) <= PLOT0) this.addCell(x, z, at);
  }

  get id(): number {
    return this.plan.id;
  }
  addCell(x: number, z: number, at: number): boolean {
    const k = key(x, z);
    if (this.land.has(k)) return false;
    const c = { x, z, at };
    this.land.set(k, c);
    this.list.push(c);
    return true;
  }
  radius(): number {
    return radiusOf(this.land.size);
  }
  blocked(x: number, z: number): boolean {
    const k = key(x, z);
    return this.taken.has(k) || this.roads.has(k);
  }
  /** Free for an item of radius rad: on land (unless `anywhere`), off traces, plazas and other items. */
  free(x: number, z: number, rad: number, anywhere = false): boolean {
    const R = Math.ceil(rad);
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dz * dz > rad * rad + 0.3) continue;
        if (this.blocked(x + dx, z + dz)) return false;
        if (!anywhere && !this.land.has(key(x + dx, z + dz))) return false;
      }
    return true;
  }
  claim(x: number, z: number, rad: number, id: number): void {
    disc(x, z, rad, (cx, cz) => this.taken.set(key(cx, cz), id));
  }
  /** Makes sure the land under a disc exists, arriving at `at`. */
  ensure(x: number, z: number, rad: number, at: number): void {
    disc(x, z, rad, (cx, cz) => this.addCell(cx, cz, at));
  }
  /**
   * Joins the land under a disc to the board: a causeway three cells wide, straight back towards the plaza, until it
   * meets land outside the disc. A landmark built past the rim never floats on its own.
   */
  connect(x: number, z: number, rad: number, at: number): void {
    const d = hypot(x, z);
    if (d === 0) return;
    for (let s = 0; s <= d; s += 0.5) {
      const cx = Math.round(x - (x / d) * s);
      const cz = Math.round(z - (z / d) * s);
      if (this.land.has(key(cx, cz)) && hypot(cx - x, cz - z) > rad) return;
      disc(cx, cz, 1.2, (a, b) => this.addCell(a, b, at));
    }
  }
  /** A new chunk on the rim, grown as a blob from where the next turn of the golden-angle spiral points. */
  grow(at: number, n: number): void {
    const a = this.grown++ * GOLDEN + this.phase;
    const ca = cos(a);
    const sa = sin(a);
    let d = 0;
    while (this.land.has(key(Math.round(ca * d), Math.round(sa * d)))) d += 0.5;
    const sx = Math.round(ca * (d + 1.5));
    const sz = Math.round(sa * (d + 1.5));
    const front: [number, number, number][] = [[sx, sz, 0]];
    const seen = new Set<number>([key(sx, sz)]);
    let added = 0;
    while (front.length && added < n) {
      let bi = 0;
      for (let i = 1; i < front.length; i++) if (front[i]![2] < front[bi]![2]) bi = i;
      const [x, z] = front.splice(bi, 1)[0]!;
      if (this.addCell(x, z, at)) added++;
      for (const [dx, dz] of N4) {
        const nx = x + dx;
        const nz = z + dz;
        const kk = key(nx, nz);
        if (seen.has(kk) || this.land.has(kk)) continue;
        seen.add(kk);
        front.push([nx, nz, hypot(nx - sx, nz - sz) + this.r() * 1.6]);
      }
    }
    // no gap between the blob and the board
    for (let i = 0; i <= Math.ceil(d) + 2; i++) this.addCell(Math.round(ca * i), Math.round(sa * i), at);
  }
  /** The nearest trace or plaza cell within R cells of (x, z), with its distance, or null. */
  roadNear(x: number, z: number, R: number): [number, number, number] | null {
    let best: [number, number, number] | null = null;
    for (let dx = -R; dx <= R; dx++)
      for (let dz = -R; dz <= R; dz++) {
        const d = hypot(dx, dz);
        if (d <= R && (!best || d < best[2]) && this.roads.has(key(x + dx, z + dz))) best = [x + dx, z + dz, d];
      }
    return best;
  }
}

/**
 * The isle for a seed and the learner's events. Pure and deterministic: the same input gives the same plan on every
 * device, and appending events never moves anything already placed on the main island.
 */
export function makeIsle(seed: number, events: IsleEvent[]): IslePlan {
  const isles: Isle[] = [];
  const items: IsleItem[] = [];
  let nextId = 0;

  const place = (isl: Isle, kind: string, x: number, z: number, rot: number, story: Story, landmark: boolean): IsleItem => {
    const foot = footOf(kind);
    const it: IsleItem = {
      id: nextId++,
      island: isl.id,
      kind,
      x,
      z,
      rot,
      v: Math.floor(isl.r() * variantsOf(kind)),
      foot,
      landmark,
      tiers: [story.at],
      story: [story],
    };
    items.push(it);
    isl.claim(x, z, foot, it.id);
    return it;
  };
  const upgrade = (it: IsleItem, story: Story): void => {
    it.tiers.push(story.at);
    it.story.push(story);
  };

  /**
   * A plot for something of radius rad facing a trace, nearest the centre with a little jitter. With `anywhere` the
   * plot may stand past the rim: the caller then grows the land under it, so landmarks stay close round the plaza.
   */
  const plot = (isl: Isle, rad: number, minD: number, anywhere: boolean): [number, number, number] | null => {
    const cand: [number, number, number][] = [];
    if (anywhere) {
      const R = Math.ceil(isl.radius() + 7);
      for (let x = -R; x <= R; x++)
        for (let z = -R; z <= R; z++) {
          const d = hypot(x, z);
          if (d >= minD && d <= R) cand.push([x, z, d + isl.r() * 2.5 + (isl.land.has(key(x, z)) ? 0 : 4)]);
        }
    } else
      for (const c of isl.list) {
        const d = hypot(c.x, c.z);
        if (d >= minD) cand.push([c.x, c.z, d + isl.r() * 2.5]);
      }
    cand.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
    const reach = Math.ceil(rad + 2);
    for (const [x, z] of cand) {
      if (!isl.free(x, z, rad, anywhere)) continue;
      const road = isl.roadNear(x, z, reach);
      if (!road || road[2] < rad + 0.4 || road[2] > rad + 1.9) continue;
      return [x, z, facing(x, z, road[0], road[1])];
    }
    return null;
  };

  /** A spot for a piece: close to a trace (components sit by their tracks), off everything else; grows land if full. */
  const spot = (isl: Isle, rad: number, at: number): [number, number] => {
    const want = rad + 1.2;
    for (let attempt = 0; attempt < 4; attempt++) {
      let best: [number, number] | null = null;
      let bs = Infinity;
      for (let i = 0; i < 56; i++) {
        const c = isl.list[Math.floor(isl.r() * isl.list.length)]!;
        if (!isl.free(c.x, c.z, rad)) continue;
        const road = isl.roadNear(c.x, c.z, 4);
        const rd = road ? road[2] : 6;
        const s = Math.abs(rd - want) * 0.9 + hypot(c.x, c.z) * 0.07 + isl.r() * 2.2;
        if (s < bs) {
          bs = s;
          best = [c.x, c.z];
        }
      }
      if (best) return best;
      // a full scan before the land grows: a lesson grows it only when there is truly no room
      for (const c of isl.list) if (isl.free(c.x, c.z, rad)) return [c.x, c.z];
      isl.grow(at, 18);
    }
    for (;;) {
      isl.grow(at, 30);
      for (const c of isl.list.slice(-60)) if (isl.free(c.x, c.z, rad)) return [c.x, c.z];
    }
  };

  const facingRoad = (isl: Isle, x: number, z: number): number => {
    const road = isl.roadNear(x, z, 4);
    return road ? facing(x, z, road[0], road[1]) : Math.floor(isl.r() * 2);
  };

  const newLandmark = (isl: Isle, kind: string, story: Story): IsleItem => {
    const rad = footOf(kind);
    let p = plot(isl, rad, PLAZA_R + rad + 1, true);
    for (let i = 0; !p && i < 6; i++) {
      isl.grow(story.at, 40);
      p = plot(isl, rad, PLAZA_R + rad + 1, true);
    }
    if (!p) {
      const [x, z] = spot(isl, rad, story.at);
      p = [x, z, facingRoad(isl, x, z)];
    }
    isl.ensure(p[0], p[1], rad + 0.9, story.at);
    isl.connect(p[0], p[1], rad + 0.9, story.at);
    const it = place(isl, kind, p[0], p[1], p[2], story, true);
    isl.landmarks.push(it);
    return it;
  };

  /** The island of a unit (by its catalog id, so a unit's old id finds the same island), raised when first reached. */
  const isleFor = (id: string, at: number): Isle => {
    const unit = unitOf(id);
    let isl = isles.find((i) => i.plan.unit === unit);
    if (!isl) {
      isl = new Isle(isles.length, unit, isles.length === 0 ? -1 : at, seed);
      isles.push(isl);
    }
    return isl;
  };

  // The main island is the unit the learner started in: it never changes, whatever units come later.
  const main = isleFor(events[0]?.unit ?? "basics", -1);

  // Before any lesson: the robot's charging dock by the plaza, and a few tufts on the plot. Fixed by the seed.
  {
    const start: Story = { at: -1, type: "start", title: "", ref: "" };
    const p = plot(main, footOf(DOCK), PLAZA_R + 1.2, false);
    if (p) place(main, DOCK, p[0], p[1], p[2], start, false);
    for (const kind of ["tuft", "tuft", "moss", "tuft"]) {
      const [x, z] = spot(main, footOf(kind), -1);
      place(main, kind, x, z, Math.floor(main.r() * 4), start, false);
    }
  }

  events.forEach((e, at) => {
    const isl = isleFor(e.unit, at);
    if (e.type === "lesson") {
      isl.lessons++;
      let kind = e.piece;
      if (!isPiece(kind)) {
        const deck = DECK.filter((d) => d.kind !== isl.lastKind);
        const total = deck.reduce((s, d) => s + d.w, 0);
        let pick = isl.r() * total;
        kind = deck[0]!.kind;
        for (const d of deck) {
          pick -= d.w;
          if (pick <= 0) {
            kind = d.kind;
            break;
          }
        }
      }
      isl.lastKind = kind;
      const [x, z] = spot(isl, footOf(kind), at);
      place(isl, kind, x, z, facingRoad(isl, x, z), { at, type: "lesson", title: e.title, ref: e.id }, false);
      return;
    }

    // a module: the land grows, its landmark is built (or rises), and the oldest landmark that can still grow rises
    const n = isl.modules++;
    const story: Story = { at, type: "module", title: e.title, ref: e.id };
    isl.grow(at, 30);
    const kind = landmarkFor(e.unit, e.landmark, n);
    const again = isl.landmarks.find((it) => it.kind === kind && it.tiers.length < tiersOf(kind));
    if (again) upgrade(again, story);
    else newLandmark(isl, kind, story);
    const ready = isl.landmarks.filter((it) => it.tiers.length < tiersOf(it.kind) && it.tiers[it.tiers.length - 1]! < at);
    ready.sort((a, b) => a.tiers[a.tiers.length - 1]! - b.tiers[b.tiers.length - 1]! || a.id - b.id);
    if (ready[0]) upgrade(ready[0], story);
  });

  // Satellite islands sit round the main one, past its rim, each joined to it by a bridge.
  const R0 = isles[0]!.radius() + 2;
  const placed: IslandPlan[] = [];
  for (const isl of isles) {
    isl.plan.cells = [...isl.land.values()];
    if (isl.id === 0) continue;
    const i = isl.id;
    const a = Math.PI * 0.75 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.95;
    const ri = isl.radius();
    let d = R0 + ri + 9;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = Math.round(cos(a) * d);
      z = Math.round(sin(a) * d);
      const clash = placed.some((o) => hypot(o.x - x, o.z - z) < ri + radiusOf(o.cells.length) + 6);
      if (!clash) break;
      d += 3;
    }
    isl.plan.x = x;
    isl.plan.z = z;
    isl.plan.y = i % 2 ? 2 : -2;
    placed.push(isl.plan);
  }
  return { seed, events, islands: isles.map((i) => i.plan), items };
}

/** A short fingerprint of everything a learner would see, for determinism checks. */
export function planHash(plan: IslePlan): string {
  const s = JSON.stringify({ seed: plan.seed, islands: plan.islands, items: plan.items });
  const a = fnv1a(s);
  const b = fnv1a(`${s.length}|${s.slice(s.length >> 1)}|${a}`);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
