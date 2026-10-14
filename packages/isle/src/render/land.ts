/**
 * The floating boards. Every island's land is one mesh: a top of matte solder mask, copper traces and via plazas,
 * silkscreen outlines and reference designators round each part, and edges in layers (a copper line, cream and tan
 * fibreglass with an inner copper layer, the bottom mask), then a rocky keel that deepens towards the middle so any
 * outline floats like a rough cone, with insulated wire ends dangling from it. Also here: ribbon cable bridges and
 * clouds. Noise comes from integer hashes, so the board looks the same on every device.
 */
import * as THREE from "three";
import { REF } from "../catalog";
import { hash2 } from "../math";
import { PLAZA_R, footCells, key, radiusOf, ringOpen, roadCells, tierAt, type IslandPlan, type IsleItem } from "../plan";
import { PAL, Q, glyph, type Built, type Col, type Shape } from "./kit";
import type { Grade } from "./look";

/** The land's colours as sRGB hex, drawn as they are (classic) or through a look's grade. */
const LAND = {
  mask: PAL.mask,
  mask2: PAL.mask2,
  maskDark: PAL.maskDark,
  copper: PAL.copper,
  copperDark: PAL.copperDark,
  gold: PAL.gold,
  silk: PAL.silk,
  hole: PAL.hole,
  dot: "#4FB27A",
  fr4: PAL.fr4,
  fr4b: PAL.fr4b,
  rock: "#9A8B7D",
  rock2: "#86786C",
  rock3: "#73675D",
  ore: "#C9853F",
  moss: PAL.moss,
  moss2: PAL.moss2,
  mossHi: "#A9D65C",
  flowerA: "#FFFFFF",
  flowerB: "#F7D63A",
  wireRed: PAL.red,
  wireBlack: "#34343A",
  wireYellow: PAL.yellow,
  wireBlue: PAL.blue,
  wireGreen: PAL.green,
} as const;
export type LandPalette = Record<keyof typeof LAND, THREE.Color> & { wires: THREE.Color[]; top: THREE.Color[] };

/** The land's colours for a look (null: as they are). */
export function landPalette(grade: Grade | null): LandPalette {
  const p = {} as Record<keyof typeof LAND, THREE.Color>;
  for (const [k, hex] of Object.entries(LAND) as [keyof typeof LAND, string][]) p[k] = grade ? grade(hex, new THREE.Color()) : new THREE.Color(hex);
  return {
    ...p,
    wires: [p.wireRed, p.wireBlack, p.wireYellow, p.wireBlue, p.wireRed, p.wireGreen],
    // the board bitmap's colours, indexed by its values (NONE, DOT, SILK, TRACE, PAD, HOLE)
    top: [p.mask, p.dot, p.silk, p.copper, p.gold, p.hole],
  };
}
const CLASSIC = landPalette(null);

export type CellInfo = { x: number; z: number; at: number; depth: number; rim: number };
export type LandInfo = { cells: Map<number, CellInfo>; radius: number };

const N4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Which cells an island has after event k, how far each is from the rim, and how deep its keel goes. */
export function landAt(isl: IslandPlan, k: number): LandInfo {
  const cells = new Map<number, CellInfo>();
  for (const c of isl.cells) if (c.at <= k) cells.set(key(c.x, c.z), { x: c.x, z: c.z, at: c.at, depth: 0, rim: 0 });
  const queue: number[] = [];
  const dist = new Map<number, number>();
  for (const [kk, c] of cells)
    if (N4.some(([dx, dz]) => !cells.has(key(c.x + dx, c.z + dz)))) {
      dist.set(kk, 0);
      queue.push(kk);
    }
  for (let i = 0; i < queue.length; i++) {
    const kk = queue[i]!;
    const c = cells.get(kk)!;
    for (const [dx, dz] of N4) {
      const nk = key(c.x + dx, c.z + dz);
      if (cells.has(nk) && !dist.has(nk)) {
        dist.set(nk, dist.get(kk)! + 1);
        queue.push(nk);
      }
    }
  }
  for (const [kk, c] of cells) {
    c.rim = dist.get(kk) ?? 0;
    c.depth = 2.125 + Math.round(Math.min(40, c.rim * 1.2) + hash2(c.x, c.z, 3) * 1.6);
  }
  return { cells, radius: radiusOf(cells.size) };
}

// ---------------------------------------------------------------------------------------------------------------
// The board's top: a bitmap at 1/8 of a cell, painted with traces, plazas, pads and silkscreen, then extruded.

const NONE = 0;
const DOT = 1;
const SILK = 2;
const TRACE = 3;
const PAD = 4;
const HOLE = 5;
const HEIGHT = [0, 0.012, 0.016, 0.0625, 0.0625, 0.02];

export class Board {
  readonly u0: number;
  readonly w0: number;
  readonly W: number;
  readonly D: number;
  readonly bits: Uint8Array;
  constructor(
    readonly land: Map<number, CellInfo>,
    bounds: { x0: number; x1: number; z0: number; z1: number },
  ) {
    this.u0 = (bounds.x0 - 1) * 8;
    this.w0 = (bounds.z0 - 1) * 8;
    this.W = (bounds.x1 - bounds.x0 + 3) * 8;
    this.D = (bounds.z1 - bounds.z0 + 3) * 8;
    this.bits = new Uint8Array(this.W * this.D);
  }
  /** The value at sub-cell (u, w), 0 off the bitmap or off the land. */
  at(u: number, w: number): number {
    const i = u - this.u0;
    const j = w - this.w0;
    if (i < 0 || j < 0 || i >= this.W || j >= this.D) return NONE;
    return this.bits[i + j * this.W]!;
  }
  private onLand(u: number, w: number): boolean {
    return this.land.has(key(Math.floor(u / 8), Math.floor(w / 8)));
  }
  set(u: number, w: number, v: number, only?: (old: number) => boolean): void {
    const i = u - this.u0;
    const j = w - this.w0;
    if (i < 0 || j < 0 || i >= this.W || j >= this.D) return;
    if (!this.onLand(u, w)) return;
    const idx = i + j * this.W;
    if (only && !only(this.bits[idx]!)) return;
    this.bits[idx] = v;
  }
  /** A straight trace of width wd (cells) between two points in cell units. */
  segment(ax: number, az: number, bx: number, bz: number, wd: number, v: number, only?: (old: number) => boolean): void {
    const r = wd / 2;
    const ua = Math.max(this.u0, Math.floor((Math.min(ax, bx) - r + 0.5) * 8) - 1);
    const ub = Math.min(this.u0 + this.W - 1, Math.ceil((Math.max(ax, bx) + r + 0.5) * 8) + 1);
    const wa = Math.max(this.w0, Math.floor((Math.min(az, bz) - r + 0.5) * 8) - 1);
    const wb = Math.min(this.w0 + this.D - 1, Math.ceil((Math.max(az, bz) + r + 0.5) * 8) + 1);
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    for (let u = ua; u <= ub; u++)
      for (let w = wa; w <= wb; w++) {
        const px = (u + 0.5) / 8 - 0.5;
        const pz = (w + 0.5) / 8 - 0.5;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
        const ex = ax + dx * t - px;
        const ez = az + dz * t - pz;
        if (ex * ex + ez * ez <= r * r + 1e-6) this.set(u, w, v, only);
      }
  }
  disc(cx: number, cz: number, r: number, v: number, only?: (old: number) => boolean): void {
    const ua = Math.floor((cx - r + 0.5) * 8) - 1;
    const ub = Math.ceil((cx + r + 0.5) * 8) + 1;
    const wa = Math.floor((cz - r + 0.5) * 8) - 1;
    const wb = Math.ceil((cz + r + 0.5) * 8) + 1;
    for (let u = ua; u <= ub; u++)
      for (let w = wa; w <= wb; w++) {
        const px = (u + 0.5) / 8 - 0.5 - cx;
        const pz = (w + 0.5) / 8 - 0.5 - cz;
        if (px * px + pz * pz <= r * r) this.set(u, w, v, only);
      }
  }
  /** A rectangle outline one sub-cell thick round [x0, x1] x [z0, z1] (cell units). */
  outline(x0: number, x1: number, z0: number, z1: number, v: number, only?: (old: number) => boolean): void {
    const ua = Math.round((x0 + 0.5) * 8);
    const ub = Math.round((x1 + 0.5) * 8) - 1;
    const wa = Math.round((z0 + 0.5) * 8);
    const wb = Math.round((z1 + 0.5) * 8) - 1;
    for (let u = ua; u <= ub; u++) {
      this.set(u, wa, v, only);
      this.set(u, wb, v, only);
    }
    for (let w = wa; w <= wb; w++) {
      this.set(ua, w, v, only);
      this.set(ub, w, v, only);
    }
  }
  /** Pixel text whose top-left sub-cell is (u, w), reading along +x. */
  text(s: string, u: number, w: number, v: number, only?: (old: number) => boolean): void {
    for (let i = 0; i < s.length; i++) {
      const g = glyph(s[i]!);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r]![c] === "1") this.set(u + i * 4 + c, w + r, v, only);
    }
  }
}

const silkOk = (old: number) => old === NONE || old === DOT;
const notCopper = (old: number) => old !== PAD && old !== HOLE;

/** Rotates a local point by rot quarter turns (the same turn as rotation.y = rot * pi / 2). */
export function turn(x: number, z: number, rot: number): [number, number] {
  switch (rot & 3) {
    case 1:
      return [z, -x];
    case 2:
      return [-x, -z];
    case 3:
      return [-z, x];
    default:
      return [x, z];
  }
}

/** Reference designators for every part of a plan, numbered per prefix in the order they were placed. */
export function designators(items: IsleItem[]): Map<number, string> {
  const n = new Map<string, number>();
  const out = new Map<number, string>();
  for (const it of items) {
    const p = it.landmark ? "U" : REF[it.kind];
    if (!p) continue;
    const k = `${it.island}:${p}`;
    const i = (n.get(k) ?? 0) + 1;
    n.set(k, i);
    out.set(it.id, `${p}${i}`);
  }
  return out;
}

/**
 * Paints the board of an island after event k: traces and plazas (clipped to the land, ring buses once the board
 * reaches them), stray vias, and for each item its pads, silkscreen outline, reference designator and a short trace to
 * the nearest road. `marks` limits the item marks to those items (for a reveal's springing actors).
 */
export function paintBoard(
  isl: IslandPlan,
  land: LandInfo,
  items: { it: IsleItem; built: Built }[],
  refs: Map<number, string>,
  traces = true,
): Board {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const c of land.cells.values()) {
    x0 = Math.min(x0, c.x);
    x1 = Math.max(x1, c.x);
    z0 = Math.min(z0, c.z);
    z1 = Math.max(z1, c.z);
  }
  if (!Number.isFinite(x0)) x0 = x1 = z0 = z1 = 0;
  const b = new Board(land.cells, { x0, x1, z0, z1 });
  const roads = roadCells(isl.traces, isl.plazas);
  const taken = new Map<number, number>();
  for (const { it } of items) for (const [x, z] of footCells(it)) taken.set(key(x, z), it.id);

  if (traces) {
    // faint dots on the mask, every other cell corner, and a few stray vias
    for (const c of land.cells.values()) {
      if ((c.x & 1) === 0 && (c.z & 1) === 0) b.set(c.x * 8, c.z * 8, DOT);
      const kk = key(c.x, c.z);
      if (!roads.has(kk) && !taken.has(kk) && hash2(c.x, c.z, 11) > 0.955) {
        const ox = (Math.floor(hash2(c.x, c.z, 12) * 5) - 2) / 8;
        const oz = (Math.floor(hash2(c.x, c.z, 13) * 5) - 2) / 8;
        b.disc(c.x + ox, c.z + oz, 0.25, TRACE);
        b.disc(c.x + ox, c.z + oz, 0.09, HOLE);
      }
    }
    for (const t of isl.traces) {
      if (!ringOpen(t.ring, land.radius)) continue;
      const wd = t.ring === 0 ? 0.625 : 0.5;
      for (let i = 1; i < t.pts.length; i++) {
        const [ax, az] = t.pts[i - 1]!;
        const [bx, bz] = t.pts[i]!;
        b.segment(ax, az, bx, bz, wd, TRACE);
      }
    }
    for (const p of isl.plazas) {
      if (p.ring >= 0 && !ringOpen(p.ring, land.radius)) continue;
      if (p.ring < 0) {
        // the central plaza: a big via, gold with a copper ring, its drill hole in the middle, and stitching vias round it
        b.disc(p.x, p.z, PLAZA_R, PAD);
        b.disc(p.x, p.z, PLAZA_R - 0.5, TRACE);
        b.disc(p.x, p.z, PLAZA_R - 0.75, PAD);
        b.disc(p.x, p.z, 0.4, HOLE);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const vx = p.x + Math.cos(a) * (PLAZA_R + 0.45);
          const vz = p.z + Math.sin(a) * (PLAZA_R + 0.45);
          b.disc(vx, vz, 0.22, TRACE, (old) => old !== PAD);
          b.disc(vx, vz, 0.08, HOLE, (old) => old !== PAD);
        }
      } else {
        b.disc(p.x, p.z, p.r, PAD);
        b.disc(p.x, p.z, p.r * 0.62, TRACE);
        b.disc(p.x, p.z, p.r * 0.3, HOLE);
      }
    }
  }

  for (const { it, built } of items) {
    const ref = refs.get(it.id);
    // a thin trace from the part's first pad to the nearest road, when the way is clear
    if (built.pads.length && !it.landmark) {
      const [px, pz] = turn(built.pads[0]![0], built.pads[0]![1], it.rot);
      const ax = it.x + px;
      const az = it.z + pz;
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let dx = -3; dx <= 3; dx++)
        for (let dz = -3; dz <= 3; dz++) {
          const d = Math.abs(dx) + Math.abs(dz);
          if (d < bd && roads.has(key(it.x + dx, it.z + dz))) {
            bd = d;
            best = [it.x + dx, it.z + dz];
          }
        }
      if (best) {
        const clear = (x: number, z: number) => {
          const t = taken.get(key(x, z));
          return (t === undefined || t === it.id) && land.cells.has(key(x, z));
        };
        let ok = true;
        for (let x = Math.min(Math.round(ax), best[0]); x <= Math.max(Math.round(ax), best[0]); x++) if (!clear(x, Math.round(az))) ok = false;
        for (let z = Math.min(Math.round(az), best[1]); z <= Math.max(Math.round(az), best[1]); z++) if (!clear(best[0], z)) ok = false;
        if (ok) {
          b.segment(ax, az, best[0], az, 0.25, TRACE, notCopper);
          b.segment(best[0], az, best[0], best[1], 0.25, TRACE, notCopper);
        }
      }
    }
    for (const [lx, lz] of built.pads) {
      const [px, pz] = turn(lx, lz, it.rot);
      b.disc(it.x + px, it.z + pz, 0.19, PAD);
    }
    if (built.outline) {
      let [hw, hd] = built.outline;
      if (it.rot & 1) [hw, hd] = [hd, hw];
      b.outline(it.x - hw, it.x + hw, it.z - hd, it.z + hd, SILK, silkOk);
      if (ref) {
        const u = Math.round((it.x - hw + 0.5) * 8);
        const w = Math.round((it.z + hd + 0.5) * 8) + 2;
        b.text(ref, u, w, SILK, silkOk);
      }
    }
  }
  return b;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry.

class Quads {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  v = 0;
  quad(p: number[], c: THREE.Color, shade = 1): void {
    const r = Math.min(255, Math.round(c.r * shade * 255));
    const g = Math.min(255, Math.round(c.g * shade * 255));
    const b = Math.min(255, Math.round(c.b * shade * 255));
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
      this.col.push(r, g, b);
    }
    this.idx.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    this.v += 4;
  }
  /** An axis-aligned box's visible faces (no bottom). */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: THREE.Color): void {
    this.quad([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], c, 1);
    this.quad([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], c, 0.96);
    this.quad([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], c, 0.9);
    this.quad([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], c, 1);
    this.quad([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], c, 0.88);
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Uint8Array(this.col), 3, true));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Where the side of a cell changes material, from the top down. */
const LAYERS = [0, -0.125, -0.5, -0.625, -1.0, -1.125];
function sideColor(L: LandPalette, y: number, x: number, z: number): THREE.Color {
  if (y > -0.125) return L.copper;
  if (y > -0.5) return L.fr4;
  if (y > -0.625) return L.copperDark;
  if (y > -1.0) return L.fr4b;
  if (y > -1.125) return L.maskDark;
  const band = Math.floor(-1.125 - y + hash2(x, z, 5) * 0.6);
  if (band > 1 && hash2(x * 7 + band, z * 3 - band, 9) > 0.992) return L.ore;
  return band > 6 ? (band % 2 ? L.rock3 : L.rock2) : band % 2 ? L.rock : L.rock2;
}
/** Splits [lo, hi] at the layer lines and at every unit below the board. */
function bands(lo: number, hi: number): [number, number][] {
  const cuts = new Set<number>(LAYERS);
  for (let y = -2.125; y > lo; y -= 1) cuts.add(y);
  const ys = [...cuts].filter((y) => y < hi && y > lo).sort((a, b) => b - a);
  const out: [number, number][] = [];
  let top = hi;
  for (const y of ys) {
    out.push([y, top]);
    top = y;
  }
  out.push([lo, top]);
  return out;
}

/**
 * The mesh for the cells in `only` (all when null): their tops, the board bitmap over them, their sides (only what no
 * neighbour covers), moss on the rim and wires hanging from the keel. Positions are local to the island.
 */
export function landMesh(
  land: LandInfo,
  board: Board | null,
  only: Set<number> | null,
  L: LandPalette = CLASSIC,
): { top: THREE.BufferGeometry; sides: THREE.BufferGeometry } {
  const q = new Quads();
  const qs = new Quads();
  const all = land.cells;
  for (const [kk, c] of all) {
    if (only && !only.has(kk)) continue;
    const x0 = c.x - 0.5;
    const x1 = c.x + 0.5;
    const z0 = c.z - 0.5;
    const z1 = c.z + 0.5;
    const b = -c.depth;
    const tone = ((c.x + c.z) & 1 ? L.mask : L.mask2).clone().multiplyScalar(1 - hash2(c.x, c.z, 1) * 0.035);
    q.quad([x0, 0, z1, x1, 0, z1, x1, 0, z0, x0, 0, z0], tone, 1);
    for (const [dx, dz] of N4) {
      const n = all.get(key(c.x + dx, c.z + dz));
      let lo = b;
      let hi = 0;
      if (n) {
        if (b >= -n.depth) continue;
        hi = -n.depth;
        lo = b;
      }
      const shade = dx === 1 ? 0.96 : dx === -1 ? 0.9 : dz === 1 ? 1 : 0.88;
      for (const [y0, y1] of bands(lo, hi)) {
        const cc = sideColor(L, (y0 + y1) / 2, c.x, c.z);
        if (dx === 1) qs.quad([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], cc, shade);
        else if (dx === -1) qs.quad([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], cc, shade);
        else if (dz === 1) qs.quad([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], cc, shade);
        else qs.quad([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], cc, shade);
      }
    }
    const open = N4.filter(([dx, dz]) => !all.has(key(c.x + dx, c.z + dz)));
    // moss cushions creeping over the rim, with strands down the edge
    if (open.length && hash2(c.x, c.z, 21) < 0.42) {
      const [dx, dz] = open[Math.floor(hash2(c.x, c.z, 22) * open.length)]!;
      const snap8 = (v: number) => Math.round(v * 8) / 8;
      const w = 0.375 + Math.floor(hash2(c.x, c.z, 23) * 4) * 0.125;
      const cx = c.x + dx * 0.25 + (dz ? snap8((hash2(c.x, c.z, 24) - 0.5) * 0.5) : 0);
      const cz = c.z + dz * 0.25 + (dx ? snap8((hash2(c.x, c.z, 25) - 0.5) * 0.5) : 0);
      const mc = hash2(c.x, c.z, 26) > 0.5 ? L.moss : L.moss2;
      const hw = dx ? 0.25 : w / 2;
      const hd = dz ? 0.25 : w / 2;
      q.box(cx - hw, cx + hw, 0, 0.125, cz - hd, cz + hd, mc);
      // a softer bump on top, and now and then a tiny flower
      const bw = Math.max(0.0625, hw - 0.125);
      const bd = Math.max(0.0625, hd - 0.125);
      q.box(cx - bw, cx + bw, 0.125, 0.25, cz - bd, cz + bd, L.mossHi);
      const f = hash2(c.x, c.z, 28);
      if (f > 0.82) q.box(cx - 0.0625, cx + 0.0625, 0.25, 0.375, cz - 0.0625, cz + 0.0625, f > 0.91 ? L.flowerA : L.flowerB);
      // now and then a strand hangs a little way down the edge, right under the cushion
      if (hash2(c.x, c.z, 27) > 0.55) {
        const len = 0.25 + Math.floor(hash2(c.x, c.z, 29) * 3) * 0.125;
        const ox = dx ? c.x + dx * 0.5 + (dx > 0 ? 0 : -0.125) : cx - 0.0625;
        const oz = dz ? c.z + dz * 0.5 + (dz > 0 ? 0 : -0.125) : cz - 0.0625;
        q.box(ox, ox + 0.125, -len, 0.125, oz, oz + 0.125, mc);
      }
    }
    // insulated wire ends dangling from the keel, stripped copper at the tip
    const r = hash2(c.x + 9, c.z - 4, 31);
    if (r > 0.9 && c.rim <= 3) {
      const len = 1 + Math.floor(hash2(c.x, c.z, 32) * 6) * 0.5;
      const wc = L.wires[Math.floor(hash2(c.x, c.z, 33) * L.wires.length)]!;
      const wx = c.x + (hash2(c.x, c.z, 34) - 0.5) * 0.5;
      const wz = c.z + (hash2(c.x, c.z, 35) - 0.5) * 0.5;
      const kink = hash2(c.x, c.z, 36) > 0.5 ? 0.125 : -0.125;
      const mid = b - len * 0.55;
      q.box(wx - 0.0625, wx + 0.0625, mid, b, wz - 0.0625, wz + 0.0625, wc);
      q.box(wx - 0.0625 + kink, wx + 0.0625 + kink, b - len, mid + 0.125, wz - 0.0625, wz + 0.0625, wc);
      q.box(wx - 0.0625 + kink, wx + 0.0625 + kink, b - len - 0.1875, b - len, wz - 0.0625, wz + 0.0625, L.copper);
    }
  }
  if (board) extrude(q, board, all, only, L);
  return { top: q.geometry(), sides: qs.geometry() };
}

/**
 * The board bitmap as geometry over the given cells: runs of equal sub-cells merged into rectangles across the whole
 * island, with the thin copper edges on the two sides the camera faces (+x and +z).
 */
function extrude(q: Quads, b: Board, all: Map<number, CellInfo>, only: Set<number> | null, L: LandPalette): void {
  const S = 1 / 8;
  const h = (u: number, w: number) => HEIGHT[b.at(u, w)]!;
  const inSet = (u: number, w: number) => {
    const k = key(Math.floor(u / 8), Math.floor(w / 8));
    return all.has(k) && (!only || only.has(k));
  };
  type R = { u0: number; u1: number; w0: number; w1: number; v: number };
  const rects: R[] = [];
  let open = new Map<number, R>();
  const uEnd = b.u0 + b.W;
  const row = new Uint8Array(b.W);
  for (let w = b.w0; w < b.w0 + b.D; w++) {
    for (let u = b.u0; u < uEnd; u++) row[u - b.u0] = inSet(u, w) ? b.at(u, w) : NONE;
    const next = new Map<number, R>();
    let u = b.u0;
    while (u < uEnd) {
      const v = row[u - b.u0]!;
      let e = u + 1;
      while (e < uEnd && row[e - b.u0] === v) e++;
      if (v !== NONE) {
        const k = ((u - b.u0) * 4096 + (e - b.u0)) * 8 + v;
        const prev = open.get(k);
        if (prev) {
          prev.w1 = w + 1;
          next.set(k, prev);
        } else {
          const nr = { u0: u, u1: e, w0: w, w1: w + 1, v };
          rects.push(nr);
          next.set(k, nr);
        }
      }
      u = e;
    }
    open = next;
  }
  for (const rc of rects) {
    const y = HEIGHT[rc.v]!;
    const col = L.top[rc.v]!;
    const xa = rc.u0 * S - 0.5;
    const xb = rc.u1 * S - 0.5;
    const za = rc.w0 * S - 0.5;
    const zb = rc.w1 * S - 0.5;
    q.quad([xa, y, zb, xb, y, zb, xb, y, za, xa, y, za], col, 1);
    if (y < 0.03) continue;
    const side = rc.v === HOLE ? L.hole : L.copperDark;
    // along the +x and +z edges, runs of sub-cells whose neighbour is lower
    const edge = (n: number, nb: (i: number) => number, emit: (i0: number, i1: number, lo: number) => void) => {
      let i = 0;
      while (i < n) {
        const lo = nb(i);
        if (lo >= y) {
          i++;
          continue;
        }
        let j = i + 1;
        while (j < n && nb(j) === lo) j++;
        emit(i, j, lo);
        i = j;
      }
    };
    const nu = rc.u1 - rc.u0;
    const nw = rc.w1 - rc.w0;
    edge(nw, (i) => h(rc.u1, rc.w0 + i), (i0, i1, lo) => q.quad([xb, lo, (rc.w0 + i1) * S - 0.5, xb, lo, (rc.w0 + i0) * S - 0.5, xb, y, (rc.w0 + i0) * S - 0.5, xb, y, (rc.w0 + i1) * S - 0.5], side, 0.95));
    edge(nu, (i) => h(rc.u0 + i, rc.w1), (i0, i1, lo) => q.quad([(rc.u0 + i0) * S - 0.5, lo, zb, (rc.u0 + i1) * S - 0.5, lo, zb, (rc.u0 + i1) * S - 0.5, y, zb, (rc.u0 + i0) * S - 0.5, y, zb], side, 0.88));
  }
}

/**
 * A ribbon cable bridge from (0, 0, 0) to (dx, dy, dz): a flat grey ribbon with a red edge stripe, sagging between two
 * connectors, with a red and a black wire as handrails on pin-header posts.
 */
export function bridge(s: Shape, dx: number, dy: number, dz: number): void {
  const len = Math.hypot(dx, dz);
  const n = Math.max(2, Math.ceil(len / 0.25));
  const alongX = Math.abs(dx) > Math.abs(dz);
  const sag = Math.min(2.2, 0.6 + len * 0.08);
  const across = (o: number): [number, number] => (alongX ? [0, o] : [o, 0]);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = dx * t;
    const z = dz * t;
    const y = dy * t - Math.sin(Math.PI * t) * sag;
    const w = alongX ? 0.25 : 1.0;
    const d = alongX ? 1.0 : 0.25;
    s.box(w, Q, d, i % 2 ? "#BFC3C9" : "#B3B8BF", x, y - Q, z);
    const [ex, ez] = across(0.4375);
    s.box(alongX ? 0.25 : Q, Q, alongX ? Q : 0.25, "red", x + ex, y - Q + 0.01, z + ez);
    if (i % 4 === 0)
      for (const o of [-0.5, 0.5]) {
        const [ox, oz] = across(o);
        const ry = dy * t - Math.sin(Math.PI * t) * (sag * 0.92) + 0.625;
        s.box(Q, Q, Q, o < 0 ? "black" : "red", x + ox, ry, z + oz);
      }
  }
  // connectors and posts at both ends
  for (const [x, y, z] of [
    [0, 0, 0],
    [dx, dy, dz],
  ] as const) {
    s.box(alongX ? 0.5 : 1.375, 0.5, alongX ? 1.375 : 0.5, "black", x, y - 0.125, z);
    s.box(alongX ? 0.25 : 0.5, Q, alongX ? 0.5 : 0.25, "charcoal", x, y + 0.375, z);
    for (const o of [-0.5, 0.5]) {
      const [ox, oz] = across(o);
      s.box(0.25, 0.75, 0.25, "black", x + ox, y, z + oz);
      s.box(Q, 0.25, Q, "gold", x + ox, y + 0.75, z + oz);
    }
  }
}

export function cloud(s: Shape, v: number): void {
  const k = 1 + (v % 3) * 0.25;
  const white: Col = "#FFFFFF";
  const shade: Col = "#E8EEF4";
  s.box(3.5 * k, 0.75, 2.25 * k, shade, 0, 0, 0);
  s.box(3.0 * k, 0.875, 2.0 * k, white, 0.25, 0.5, 0.125);
  s.box(1.75 * k, 0.875, 1.5 * k, white, 0.5 * k, 1.25, 0);
  s.box(1.5 * k, 0.75, 1.25 * k, white, -1.25 * k, 0.75, 0.25 * k);
}

/** Items of an island present after event k (and not held back for a reveal), with their built geometry info. */
export function itemsOn(island: number, items: IsleItem[], k: number, hold: Set<number>): IsleItem[] {
  return items.filter((it) => it.island === island && tierAt(it, k) >= 0 && !hold.has(it.id));
}
