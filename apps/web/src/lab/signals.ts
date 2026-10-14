/**
 * Signals over time, the pure half: high stretches and duty cycles from sampled histories or exact edges, the edge
 * log the session keeps for watched nodes (Netlist.watch), what a timing diagram draws in a window, bursts of edges
 * (bounce, a counter's ripple) and the states shorter than a microsecond inside them, button presses, and the dice
 * tally with its "fair" band. No DOM, no simulator.
 */
import type { EdgeLog } from "@ohmland/sim";

export type Sample = [number, number];
export type Edge = [number, 0 | 1];

/** A stretch of time a signal spent high (or a button spent closed). `end` is null while it lasts. */
export type Spell = { start: number; end: number | null };

/** High and low time of the latest whole cycles, their sum and the share spent high. */
export type Duty = { high: number; low: number; period: number; duty: number; cycles: number };

/** Where the straight line between two samples meets a level. */
function cross(a: Sample, b: Sample, level: number): number {
  const dv = b[1] - a[1];
  return Math.abs(dv) < 1e-15 ? b[0] : a[0] + ((level - a[1]) / dv) * (b[0] - a[0]);
}

/** Rising and falling crossings of a level in sampled points, interpolated, oldest first. */
export function edgesOf(points: readonly Sample[], level: number): Edge[] {
  const out: Edge[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a[1] < level && b[1] >= level) out.push([cross(a, b, level), 1]);
    else if (a[1] >= level && b[1] < level) out.push([cross(a, b, level), 0]);
  }
  return out;
}

/** Halfway between the lowest and highest sample (null for a flat signal). */
export function midLevel(points: readonly Sample[]): number | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [, v] of points) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return hi - lo > 1e-6 ? (lo + hi) / 2 : null;
}

/** High stretches from a list of edges; a stretch that has not ended has `end: null`. */
export function spellsFromEdges(edges: readonly Edge[], highAtStart = false, startAt = -Infinity): Spell[] {
  const out: Spell[] = [];
  let open: number | null = highAtStart ? startAt : null;
  for (const [t, d] of edges) {
    if (d === 1 && open === null) open = t;
    else if (d === 0 && open !== null) {
      out.push({ start: open, end: t });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: null });
  return out;
}

/** Lengths of the complete high stretches (a rise, then a fall), oldest first. */
export function widthsOf(edges: readonly Edge[]): number[] {
  const out: number[] = [];
  let up: number | null = null;
  for (const [t, d] of edges) {
    if (d === 1) up = t;
    else if (up !== null) {
      out.push(t - up);
      up = null;
    }
  }
  return out;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
};

/** The duty cycle of the latest whole cycles (rise to rise), medians of up to the last `cycles`. Null without two rises and a fall. */
export function dutyOf(edges: readonly Edge[], cycles = 5): Duty | null {
  const highs: number[] = [];
  const periods: number[] = [];
  let lastRise: number | null = null;
  let up: number | null = null;
  let highOfCycle: number | null = null;
  for (const [t, d] of edges) {
    if (d === 1) {
      if (lastRise !== null && highOfCycle !== null) {
        periods.push(t - lastRise);
        highs.push(highOfCycle);
      }
      lastRise = t;
      up = t;
      highOfCycle = null;
    } else if (up !== null) {
      highOfCycle = t - up;
      up = null;
    }
  }
  if (!periods.length) return null;
  const p = median(periods.slice(-cycles));
  const h = median(highs.slice(-cycles));
  return { high: h, low: p - h, period: p, duty: p > 0 ? h / p : 0, cycles: periods.length };
}

/** Values of a sampled source with repeats removed: the counts a counter went through, in order. */
export function distinctRun(points: readonly Sample[]): number[] {
  const out: number[] = [];
  for (const [, v] of points) if (out[out.length - 1] !== v) out.push(v);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The edge log of a watched node

/** How many crossings each watched node keeps (the slow-motion replay looks back through them). */
export const TRACK_MAX = 6000;

/**
 * The crossings of one watched node, as the session receives them snapshot by snapshot: a ring of the latest edges,
 * the level now, and running totals.
 */
export class EdgeTrack {
  edges: Edge[] = [];
  high = false;
  level = 0;
  rises = 0;
  falls = 0;
  /** Crossings the simulator could not list (an oscillation): counted, not timed. */
  dropped = 0;
  /** When the track began (the level before the first kept edge is known from here). */
  since: number;
  /** The level before the oldest kept edge. */
  private before = false;

  constructor(t: number, high = false) {
    this.since = t;
    this.high = high;
    this.before = high;
  }

  push(log: EdgeLog): void {
    for (const e of log.log) this.edges.push(e);
    this.rises += log.rises;
    this.falls += log.falls;
    this.dropped += log.dropped ?? 0;
    this.high = log.high;
    this.level = log.level;
    if (this.edges.length > TRACK_MAX) {
      const cut = this.edges.length - TRACK_MAX;
      // The level before the new oldest edge is the one the last dropped edge set.
      this.before = this.edges[cut - 1]![1] === 1;
      this.since = this.edges[cut - 1]![0];
      this.edges.splice(0, cut);
    }
  }

  /** Edges at or after `t`, oldest first. */
  after(t: number): Edge[] {
    let lo = 0;
    let hi = this.edges.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.edges[mid]![0] < t) lo = mid + 1;
      else hi = mid;
    }
    return this.edges.slice(lo);
  }

  /** Edges between `t0` and `t1`. */
  between(t0: number, t1: number): Edge[] {
    return this.after(t0).filter(([t]) => t <= t1);
  }

  /** Whether the node was high at time `t` (as far as the kept edges tell). */
  levelAt(t: number): boolean {
    let level = this.before;
    for (const [te, d] of this.edges) {
      if (te > t) break;
      level = d === 1;
    }
    return level;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// What a timing diagram draws

/** A channel in a window: its level at the window's start and every edge inside it. */
export type ChannelWindow = { start: boolean; edges: Edge[] };

/** A digital channel over [t0, t1]. */
export function windowOf(track: EdgeTrack, t0: number, t1: number): ChannelWindow {
  return { start: track.levelAt(t0), edges: track.between(t0, t1) };
}

/** A channel from sampled values (LEDs, buttons), treated as high when at or above `level`. */
export function windowFromSamples(points: readonly Sample[], t0: number, t1: number, level = 0.5): ChannelWindow {
  let start = false;
  const edges: Edge[] = [];
  let prev: boolean | null = null;
  for (const [t, v] of points) {
    const h = v >= level;
    if (t <= t0) {
      start = h;
      prev = h;
      continue;
    }
    if (t > t1) break;
    if (prev === null) {
      start = h;
      prev = h;
      continue;
    }
    if (h !== prev) edges.push([t, h ? 1 : 0]);
    prev = h;
  }
  return { start, edges };
}

/**
 * A digital channel across a window, in fractions of its width (x 0..1): the flat runs and their level, the edges,
 * and busy stretches where edges come closer than `minGap` (a fast clock is drawn as a band, not a smear of lines).
 */
export type TraceShape = { runs: { x0: number; x1: number; high: boolean }[]; edges: number[]; busy: [number, number][] };

export function traceShape(w: ChannelWindow, t0: number, t1: number, minGap = 0.004): TraceShape {
  const span = t1 - t0 || 1;
  const x = (t: number) => Math.min(1, Math.max(0, (t - t0) / span));
  const runs: TraceShape["runs"] = [];
  const edges: number[] = [];
  const busy: [number, number][] = [];
  let high = w.start;
  let from = 0;
  const es = w.edges;
  let i = 0;
  while (i < es.length) {
    const xi = x(es[i]![0]);
    // A run of three or more edges each closer than minGap to the next: one busy stretch.
    let j = i;
    while (j + 1 < es.length && x(es[j + 1]![0]) - x(es[j]![0]) < minGap) j++;
    if (j - i >= 2) {
      const xe = x(es[j]![0]);
      if (xi > from) runs.push({ x0: from, x1: xi, high });
      busy.push([xi, xe]);
      high = es[j]![1] === 1;
      from = xe;
      i = j + 1;
      continue;
    }
    if (xi > from) runs.push({ x0: from, x1: xi, high });
    if ((es[i]![1] === 1) !== high) edges.push(xi);
    high = es[i]![1] === 1;
    from = xi;
    i++;
  }
  if (from < 1) runs.push({ x0: from, x1: 1, high });
  return { runs, edges, busy };
}

// ---------------------------------------------------------------------------------------------------------------
// Bursts and glitches

/** A short state: a high (or low) that lasted under `max` seconds, on one channel. */
export type Glitch = { channel: string; t: number; width: number; high: boolean };

/** One burst of edges across the channels: from the first edge to the last, with a quiet gap either side. */
export type Burst = {
  start: number;
  end: number;
  /** Each channel's level just before the burst and its edges inside it. */
  channels: Record<string, ChannelWindow>;
  /** States shorter than a microsecond inside it. */
  glitches: Glitch[];
  /** The combined state after each edge: the channels' levels (1 high), oldest first. */
  states: { t: number; levels: Record<string, 0 | 1> }[];
};

export const GLITCH_MAX = 1e-6;

/** States shorter than `max` seconds inside a channel's edges. */
export function glitchesOf(channel: string, edges: readonly Edge[], max = GLITCH_MAX): Glitch[] {
  const out: Glitch[] = [];
  for (let k = 1; k < edges.length; k++) {
    const w = edges[k]![0] - edges[k - 1]![0];
    if (w < max) out.push({ channel, t: edges[k - 1]![0], width: w, high: edges[k - 1]![1] === 1 });
  }
  return out;
}

/**
 * The latest complete burst across some tracks: two or more edges each within `quiet` seconds of the previous one,
 * the last of them at least `quiet` before `now`, cut to `maxSpan`. A lone edge (a button let go) is not a burst.
 * Null when nothing has happened yet (or the only burst is still going on).
 */
export function lastBurst(tracks: Record<string, EdgeTrack>, now: number, quiet = 0.02, maxSpan = 0.25): Burst | null {
  const all: { t: number; ch: string; d: 0 | 1 }[] = [];
  const horizon = now - Math.max(2, maxSpan * 4);
  for (const [ch, tr] of Object.entries(tracks)) for (const [t, d] of tr.after(horizon)) all.push({ t, ch, d });
  if (!all.length) return null;
  all.sort((a, b) => a.t - b.t);
  // Walk back run by run from the newest edge; skip a run still going on and lone edges.
  let end = all.length - 1;
  let start = end;
  for (;;) {
    start = end;
    while (start > 0 && all[start]!.t - all[start - 1]!.t < quiet) start--;
    const done = now - all[end]!.t >= quiet;
    if (done && end > start) break;
    end = start - 1;
    if (end < 0) return null;
  }
  let t0 = all[start]!.t;
  const t1 = all[end]!.t;
  if (t1 - t0 > maxSpan) t0 = t1 - maxSpan;
  const channels: Record<string, ChannelWindow> = {};
  for (const [ch, tr] of Object.entries(tracks)) channels[ch] = { start: tr.levelAt(t0 - 1e-15), edges: tr.between(t0, t1) };
  const glitches = Object.entries(channels).flatMap(([ch, w]) => glitchesOf(ch, w.edges));
  const levels: Record<string, 0 | 1> = Object.fromEntries(Object.entries(channels).map(([ch, w]) => [ch, w.start ? 1 : 0]));
  const states: Burst["states"] = [];
  const merged = Object.entries(channels)
    .flatMap(([ch, w]) => w.edges.map(([t, d]) => ({ t, ch, d })))
    .sort((a, b) => a.t - b.t);
  for (const e of merged) {
    levels[e.ch] = e.d;
    states.push({ t: e.t, levels: { ...levels } });
  }
  return { start: t0, end: t1, channels, glitches, states };
}

/** A friendly span for a stretch of time: "4.2 ms", "31 ns", "1.20 s". */
export function formatSpan(s: number): string {
  const a = Math.abs(s);
  const fmt = (v: number, unit: string) => `${v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${unit}`;
  if (a >= 1) return fmt(s, "s");
  if (a >= 1e-3) return fmt(s * 1e3, "ms");
  if (a >= 1e-6) return fmt(s * 1e6, "µs");
  return fmt(s * 1e9, "ns");
}

/** How many times slower a replay of `span` seconds over `seconds` is, rounded to a friendly number. */
export function slowFactor(span: number, seconds: number): number {
  const f = seconds / Math.max(span, 1e-15);
  const p = 10 ** Math.floor(Math.log10(f));
  return Math.round(f / p) * p;
}

// ---------------------------------------------------------------------------------------------------------------
// Presses

/** Spells where a sampled boolean source (1 closed, 0 open) was on. */
export function pressesOf(points: readonly Sample[]): Spell[] {
  return spellsFromEdges(
    edgesOf(points, 0.5).map(([t, d]) => {
      // Booleans step between samples: put the edge at the first sample of the new state.
      const next = points.find(([pt]) => pt >= t);
      return [next ? next[0] : t, d] as Edge;
    }),
    (points[0]?.[1] ?? 0) >= 0.5,
    points[0]?.[0] ?? 0,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Dice

/** A die face from its pips' states: the number of pips lit (0 for a blank face). */
export function faceOf(lit: readonly boolean[]): number {
  return lit.filter(Boolean).length;
}

export type Tally = {
  rolls: number;
  /** One die: counts by face ("1" to "6", and "0" for a blank face). Two dice: by pair "3-5" and by sum "8". */
  faces: Record<string, number>;
  pairs: Record<string, number>;
  sums: Record<string, number>;
};

export function tallyOf(rolls: readonly (readonly number[])[]): Tally {
  const out: Tally = { rolls: rolls.length, faces: {}, pairs: {}, sums: {} };
  const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
  for (const r of rolls) {
    if (r.length === 1) inc(out.faces, String(r[0]));
    else {
      inc(out.pairs, r.join("-"));
      inc(out.sums, String(r.reduce((a, b) => a + b, 0)));
      for (const f of r) inc(out.faces, String(f));
    }
  }
  return out;
}

/**
 * The band a fair count stays inside about 19 times in 20: the expected count n x p, plus or minus two standard
 * deviations of a binomial count.
 */
export function fairBand(n: number, p: number): { expected: number; lo: number; hi: number } {
  const e = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  return { expected: e, lo: Math.max(0, e - 2 * sd), hi: e + 2 * sd };
}

/** Chance of each sum of two fair dice (2 to 12). */
export const sumChance = (s: number): number => (s < 2 || s > 12 ? 0 : (6 - Math.abs(s - 7)) / 36);

/** A small seeded random number generator (mulberry32), for human-like holds that repeat in a replay. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
