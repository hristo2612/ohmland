// Edge watch: watched nodes are compared with a threshold after every accepted solver step, so crossings between
// two snapshots are counted and timed (see WatchSpec in ../types.ts). Digital edges land on breakpoints followed by
// a 1 ns settle step, so a logic output's edge is timed to within a nanosecond; an analog crossing is interpolated
// between the two solver points around it.

import type { EdgeLog, WatchSpec } from "../types";

/** Most crossings one snapshot carries per watched node; the rest are only counted. */
export const EDGE_LOG_MAX = 4000;

type Item = {
  id: string;
  /** Unknown index of the node (-1: the reference), or null when the netlist has no such node. */
  node: number | null;
  of: number | null;
  level: number | undefined;
  fraction: number;
  hysteresis: number | undefined;
  high: boolean | null;
  lastT: number;
  lastV: number;
  thr: number;
  rises: number;
  falls: number;
  log: [number, 0 | 1][];
  dropped: number;
};

const volt = (x: Float64Array, k: number | null): number => (k === null || k < 0 ? 0 : x[k]!);

export class EdgeWatch {
  private readonly items: Item[] = [];
  /** Unknowns of the named nodes, for the default threshold (a share of the highest node voltage). */
  private readonly named: number[];
  private readonly needsMax: boolean;

  constructor(specs: readonly WatchSpec[], indexOf: (name: string) => number | undefined, named: number[], prev: EdgeWatch | null) {
    this.named = named;
    const seen = new Set<string>();
    for (const s of specs) {
      if (!s || typeof s.id !== "string" || seen.has(s.id) || typeof s.node !== "string") continue;
      seen.add(s.id);
      const node = indexOf(s.node);
      const of = s.of !== undefined ? indexOf(s.of) : undefined;
      const old = prev?.items.find((x) => x.id === s.id);
      this.items.push({
        id: s.id,
        node: node === undefined ? null : node,
        of: of === undefined ? null : of,
        level: Number.isFinite(s.level) ? s.level : undefined,
        fraction: Number.isFinite(s.fraction) ? (s.fraction as number) : 0.5,
        hysteresis: Number.isFinite(s.hysteresis) ? Math.max(0, s.hysteresis as number) : undefined,
        // The level carries over a rebuild, so editing the circuit does not count an edge.
        high: old?.high ?? null,
        lastT: old?.lastT ?? 0,
        lastV: old?.lastV ?? 0,
        thr: old?.thr ?? 0,
        rises: 0,
        falls: 0,
        log: [],
        dropped: 0,
      });
    }
    // A missing `of` node falls back to the highest node voltage too.
    this.needsMax = this.items.some((it) => it.level === undefined && it.of === null);
  }

  get size(): number {
    return this.items.length;
  }

  private threshold(it: Item, x: Float64Array, max: number): number {
    if (it.level !== undefined) return it.level;
    if (it.of !== null) return it.fraction * volt(x, it.of);
    return it.fraction * max;
  }

  private maxNamed(x: Float64Array): number {
    let m = 0;
    for (const k of this.named) if (x[k]! > m) m = x[k]!;
    return m;
  }

  /** After every accepted step: count and time the crossings. */
  accept(t: number, x: Float64Array): void {
    const max = this.needsMax ? this.maxNamed(x) : 0;
    for (const it of this.items) {
      if (it.node === null) continue;
      const v = volt(x, it.node);
      const thr = this.threshold(it, x, max);
      it.thr = thr;
      if (it.high === null) {
        it.high = v > thr;
        it.lastT = t;
        it.lastV = v;
        continue;
      }
      const band = it.hysteresis ?? Math.max(0.005, 0.02 * Math.abs(thr));
      let dir: 0 | 1 | -1 = -1;
      if (!it.high && v > thr + band) dir = 1;
      else if (it.high && v < thr - band) dir = 0;
      if (dir !== -1) {
        // Where the straight line between the two solver points meets the threshold.
        const dv = v - it.lastV;
        let tc = t;
        if ((it.lastV - thr) * (v - thr) <= 0 && Math.abs(dv) > 1e-15) tc = it.lastT + ((thr - it.lastV) / dv) * (t - it.lastT);
        tc = Math.min(t, Math.max(it.lastT, tc));
        it.high = dir === 1;
        if (dir === 1) it.rises++;
        else it.falls++;
        if (it.log.length < EDGE_LOG_MAX) it.log.push([tc, dir]);
        else it.dropped++;
      }
      it.lastT = t;
      it.lastV = v;
    }
  }

  /** The crossings since the last drain (one entry per watched node that exists), and starts counting afresh. */
  drain(t: number, x: Float64Array): Record<string, EdgeLog> {
    const out: Record<string, EdgeLog> = {};
    const max = this.needsMax ? this.maxNamed(x) : 0;
    for (const it of this.items) {
      if (it.node === null) continue;
      if (it.high === null) {
        // Nothing stepped yet: the level as it stands, no edge.
        it.thr = this.threshold(it, x, max);
        it.lastV = volt(x, it.node);
        it.lastT = t;
        it.high = it.lastV > it.thr;
      }
      const e: EdgeLog = { rises: it.rises, falls: it.falls, high: it.high, log: it.log, level: it.thr };
      if (it.dropped) e.dropped = it.dropped;
      out[it.id] = e;
      it.rises = 0;
      it.falls = 0;
      it.log = [];
      it.dropped = 0;
    }
    return out;
  }
}

/** Adds a later drain to an earlier one (crossings in order, counts summed, the newer level). */
export function mergeEdges(into: Map<string, EdgeLog>, add: Record<string, EdgeLog>): void {
  for (const [id, e] of Object.entries(add)) {
    const prev = into.get(id);
    if (!prev) {
      into.set(id, { ...e, log: [...e.log] });
      continue;
    }
    prev.rises += e.rises;
    prev.falls += e.falls;
    prev.high = e.high;
    prev.level = e.level;
    const room = Math.max(0, EDGE_LOG_MAX - prev.log.length);
    if (e.log.length > room) prev.dropped = (prev.dropped ?? 0) + e.log.length - room;
    prev.log.push(...e.log.slice(0, room));
    if (e.dropped) prev.dropped = (prev.dropped ?? 0) + e.dropped;
  }
}
