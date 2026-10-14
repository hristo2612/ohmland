// The striped flow styles in ink (docs/BENCH-VIEWS.md, "Overlays"), inside every clip lead, jumper and part lead that
// carries current, in the flow tint: barber stripes and chevrons as shapes laid along the path as the lead draws it
// (one `d` per conductor per frame), dashes and pulses as dash patterns on that path (one offset per layer per frame).
// No React work while they move; they stand still under reduced motion. The tracer's run lays the same units along
// the loop in red on the flow tint, up to its head, and ends in a red disc with a light cross at a gap.

import { memo, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { Snapshot } from "@ohmland/sim";
import { DOT_MIN_AMPS, ELECTRON_SLOWDOWN, dotSpeed, flowMap, traceLoop, unitSpacing, type FlowStyle, type Trace } from "../../flow";
import { stillMotion } from "../../motion";
import type { BenchStore } from "../../store";
import type { Vec2 } from "../../types";
import { anchorInk, leadPolyline, type InkModel, type LeadInk } from "../model";
import { INK, n3 } from "../frame";

type Striped = Exclude<FlowStyle, "dots">;

const n2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------------------------------------------
// Paths as polylines: sampled from the path data the view draws, so units follow whatever shape a lead takes.

type Poly = { xs: Float64Array; ys: Float64Array; acc: Float64Array; L: number };

function polyOf(pts: Vec2[]): Poly {
  const n = pts.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const acc = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = pts[i]![0];
    ys[i] = pts[i]![1];
    if (i) acc[i] = acc[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!);
  }
  return { xs, ys, acc, L: n ? acc[n - 1]! : 0 };
}

const P = { x: 0, y: 0, nx: 0, ny: 0 };

/** The point `s` mm along the polyline and its left-hand normal (clamped to the ends). */
function at(pl: Poly, s: number): typeof P {
  const n = pl.acc.length;
  if (n < 2) {
    P.x = pl.xs[0] ?? 0;
    P.y = pl.ys[0] ?? 0;
    P.nx = 0;
    P.ny = -1;
    return P;
  }
  const d = Math.max(0, Math.min(pl.L, s));
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (pl.acc[m]! < d) lo = m;
    else hi = m;
  }
  const seg = pl.acc[hi]! - pl.acc[lo]!;
  const k = seg > 0 ? (d - pl.acc[lo]!) / seg : 0;
  const dx = pl.xs[hi]! - pl.xs[lo]!;
  const dy = pl.ys[hi]! - pl.ys[lo]!;
  const l = Math.hypot(dx, dy) || 1;
  P.x = pl.xs[lo]! + dx * k;
  P.y = pl.ys[lo]! + dy * k;
  P.nx = dy / l;
  P.ny = -dx / l;
  return P;
}

/** "x y" of the point `s` along, `lat` mm to its left. */
function pt(pl: Poly, s: number, lat: number): string {
  const p = at(pl, s);
  return `${n2(p.x + p.nx * lat)} ${n2(p.y + p.ny * lat)}`;
}

let probe: SVGPathElement | null = null;
const sampled = new Map<string, Vec2[]>();

/** Points every half millimetre along SVG path data, measured by the browser; `fallback` where it cannot. */
function samplePath(d: string, fallback: () => Vec2[]): Vec2[] {
  const hit = sampled.get(d);
  if (hit) return hit;
  let pts: Vec2[] | null = null;
  try {
    if (typeof document !== "undefined") {
      probe ??= document.createElementNS("http://www.w3.org/2000/svg", "path");
      probe.setAttribute("d", d);
      const L = probe.getTotalLength();
      if (L > 0) {
        const n = Math.max(8, Math.min(600, Math.ceil(L / 0.5)));
        pts = [];
        for (let i = 0; i <= n; i++) {
          const p = probe.getPointAtLength((L * i) / n);
          pts.push([p.x, p.y]);
        }
      }
    }
  } catch {
    pts = null;
  }
  pts ??= fallback();
  if (sampled.size > 600) sampled.clear();
  sampled.set(d, pts);
  return pts;
}

// ---------------------------------------------------------------------------------------------------------------
// Unit shapes, as path data. `x` is how far the units have travelled (0 to the spacing `S`), `dir` the way they go
// along the path (+1 from its start, -1 toward it), `half` half the lane's width (mm). Unit k sits at x + S/2 + kS.

type Lay = { pl: Poly; x: number; S: number; dir: number; half: number; from?: number; to?: number };

function centres({ pl, x, S, from = 0, to = pl.L }: Lay, reach: number): number[] {
  const out: number[] = [];
  const k0 = Math.floor((from - reach - x - S / 2) / S);
  for (let k = k0; ; k++) {
    const c = x + S / 2 + k * S;
    if (c - reach > to) break;
    if (c + reach >= from && c >= from - 0.01 && c <= to + 0.01) out.push(c);
    if (out.length > 400) break;
  }
  return out;
}

/** Diagonal stripes across the lane, `share` of each unit wide (from `lo` to `hi` of it, along the motion). */
function barberD(l: Lay, lo = 0, hi = 1): string {
  const { pl, S, dir, half } = l;
  const w = 0.46 * S;
  const sk = 2 * half * 0.95;
  let d = "";
  for (const c of centres(l, w + sk)) {
    // From the back of the stripe to its front, along the motion.
    const b = c + dir * (-w / 2 + w * lo);
    const f = c + dir * (-w / 2 + w * hi);
    d += `M${pt(pl, b + sk / 2, half)}L${pt(pl, f + sk / 2, half)}L${pt(pl, f - sk / 2, -half)}L${pt(pl, b - sk / 2, -half)}Z`;
  }
  return d;
}

/** Arrowheads across the lane, pointing along the motion, arms swept back toward the edges. */
function chevronD(l: Lay, scale = 1): string {
  const { pl, dir, half } = l;
  const W = half * 0.88 * scale;
  const k = half * 1.35 * scale;
  const t = Math.max(0.5, half * 1.0) * scale;
  let d = "";
  for (const c of centres(l, k + t)) {
    const o = (s: number) => c + dir * s;
    d += `M${pt(pl, o(-k + t / 2), W)}L${pt(pl, o(t / 2), 0)}L${pt(pl, o(-k + t / 2), -W)}L${pt(pl, o(-k - t / 2), -W)}L${pt(pl, o(-t / 2), 0)}L${pt(pl, o(-k - t / 2), W)}Z`;
  }
  return d;
}

/** Short bars along the lane (`len` mm, centred on each unit), `lat` mm either side of its middle. */
function barsD(l: Lay, len: number, lat: number): string {
  const { pl } = l;
  let d = "";
  for (const c of centres(l, len)) d += `M${pt(pl, c - len / 2, lat)}L${pt(pl, c + len / 2, lat)}L${pt(pl, c + len / 2, -lat)}L${pt(pl, c - len / 2, -lat)}Z`;
  return d;
}

// ---------------------------------------------------------------------------------------------------------------
// Flow

type Ride = { key: string; d: string; amps: number; half: number; pts: () => Vec2[] };

const pathOf = (pts: Vec2[]) => pts.map((p, i) => `${i ? "L" : "M"}${n3(p[0])} ${n3(p[1])}`).join("");

/** A clip lead from jaws to jaws: clip, the cable as the view draws it, clip (the tracer runs through the clips). */
function leadD(li: LeadInk): string {
  const p = li.path.trim();
  const body = p.startsWith("M") ? p.slice(1) : null;
  if (!body) return pathOf(leadPolyline(li));
  return `M${n3(li.a.tip[0])} ${n3(li.a.tip[1])}L${body}L${n3(li.b.tip[0])} ${n3(li.b.tip[1])}`;
}

/** Every conductor that can carry current, as drawn, with the current along it from the snapshot. */
function rides(model: InkModel, s: Snapshot | null): Ride[] {
  const f = flowMap(model.bench, s);
  const out: Ride[] = [];
  for (const li of model.leads.values()) {
    if (!li.a.attached && !li.b.attached) continue;
    // Inside the cable itself, as the lead draws it (not over the clips' boots).
    out.push({ key: `lead:${li.lead.id}`, d: li.path, amps: f.leads[li.lead.id] ?? 0, half: INK.cableW / 2, pts: () => leadPolyline(li).slice(1, -1) });
  }
  for (const wi of model.wires.values()) {
    const d = `M${n3(wi.a[0])} ${n3(wi.a[1])}Q${n3(wi.ctrl[0])} ${n3(wi.ctrl[1])} ${n3(wi.b[0])} ${n3(wi.b[1])}`;
    out.push({ key: `wire:${wi.wire.id}`, d, amps: f.wires[wi.wire.id] ?? 0, half: INK.jumperW / 2, pts: () => [wi.a, wi.b] });
  }
  for (const p of f.parts) {
    const pi = model.parts.get(p.id);
    const a = pi?.legs[p.from];
    const b = pi?.legs[p.to];
    if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) < 1) continue;
    out.push({ key: `part:${p.id}:${p.from}`, d: pathOf([a, b]), amps: p.amps, half: 0.5, pts: () => [a, b] });
  }
  return out;
}

const live = (r: Ride) => Math.abs(r.amps) >= DOT_MIN_AMPS;

/** Dash patterns on each unit: class, length (mm), width (share of the lane), opacity, and where it ends (mm ahead of the unit's centre). */
function layersOf(style: "dashes" | "pulses", S: number): { cls: string; len: number; w: number; op: number; at: number }[] {
  if (style === "dashes") {
    const h = Math.min(3.2, 0.4 * S);
    const t = Math.min(2.2, 0.28 * S);
    // `at`: where each dash ends, from the unit's centre along the motion.
    return [
      { cls: "fl-core", len: t, w: 0.2, op: 0.6, at: -h / 2 },
      { cls: "fl-rim", len: h + 0.5, w: 0.66, op: 1, at: h / 2 + 0.25 },
      { cls: "fl-core", len: h, w: 0.44, op: 1, at: h / 2 },
    ];
  }
  // A crisp band across the cable, and soft round-ended glows reaching back behind it.
  return [
    { cls: "fl-glow", len: 2.8, w: 0.8, op: 0.18, at: -0.6 },
    { cls: "fl-glow", len: 1.2, w: 0.8, op: 0.38, at: -0.2 },
    { cls: "fl-rim", len: 0.2, w: 0.94, op: 0.5, at: 0.75 },
    { cls: "fl-core", len: 0.75, w: 0.94, op: 1, at: 0.3 },
  ];
}

export const InkFlowStripes = memo(function InkFlowStripes({ model, store, electrons, style }: { model: InkModel; store: BenchStore; electrons: boolean; style: Striped }) {
  // Re-rendered only when the set of conductors carrying current changes, not per snapshot.
  const liveKey = useStore(store, (s) => rides(model, s.snapshot).filter(live).map((r) => r.key).join("|"));
  const list = useMemo(() => {
    const keys = new Set(liveKey.split("|"));
    return rides(model, store.getState().snapshot).filter((r) => keys.has(r.key));
  }, [model, liveKey, store]);
  const still = useMemo(() => stillMotion(), []);
  const shaped = style === "barber" || style === "chevrons";
  const polys = useMemo(() => new Map(shaped ? list.map((r) => [r.key, polyOf(samplePath(r.d, r.pts))]) : []), [list, shaped]);
  const els = useRef(new Map<string, (SVGPathElement | null)[]>());
  const amps = useRef(new Map<string, number>());
  const travel = useRef(new Map<string, number>());
  const dirs = useRef(new Map<string, number>());
  const spacing = useRef(new Map<string, number>());

  useEffect(() => {
    const paint = (r: Ride, dt: number) => {
      const i = amps.current.get(r.key) ?? 0;
      const v = Math.sign(i) * dotSpeed(i) * (electrons ? -ELECTRON_SLOWDOWN : 1);
      const S = unitSpacing(style, i, still);
      const x = still ? 0 : ((((travel.current.get(r.key) ?? 0) + v * dt) % S) + S) % S;
      travel.current.set(r.key, x);
      const dir = v ? Math.sign(v) : (dirs.current.get(r.key) ?? 1);
      dirs.current.set(r.key, dir);
      const el = els.current.get(r.key);
      if (!el) return;
      if (style === "barber" || style === "chevrons") {
        const pl = polys.get(r.key);
        if (!pl) return;
        const l: Lay = { pl, x, S, dir, half: r.half };
        if (style === "chevrons") el[0]?.setAttribute("d", chevronD(l));
        else if (still) {
          // Standing still: each stripe bright at its front, faint behind, so the way it goes still reads.
          el[0]?.setAttribute("d", barberD(l, 0.42, 1));
          el[1]?.setAttribute("d", barberD(l, 0, 0.42));
        } else el[0]?.setAttribute("d", barberD(l));
        return;
      }
      const layers = layersOf(style, S);
      const respace = spacing.current.get(r.key) !== S;
      spacing.current.set(r.key, S);
      layers.forEach((ly, k) => {
        const e = el[k];
        if (!e) return;
        if (respace) e.setAttribute("stroke-dasharray", `${n2(ly.len)} ${n2(Math.max(0.01, S - ly.len))}`);
        // The dash ends `at` mm ahead of the unit's centre along the motion; its start is where the pattern begins.
        const end = x + S / 2 + dir * ly.at;
        const start = dir > 0 ? end - ly.len : end;
        e.setAttribute("stroke-dashoffset", String(n2(-start)));
      });
    };
    const update = (s: Snapshot | null) => {
      for (const r of rides(model, s)) amps.current.set(r.key, r.amps);
      if (still) for (const r of list) paint(r, 0);
    };
    update(store.getState().snapshot);
    const off = store.subscribe((s, prev) => s.snapshot !== prev.snapshot && update(s.snapshot));
    if (still) return off;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const r of list) paint(r, dt);
      raf = requestAnimationFrame(frame);
    };
    for (const r of list) paint(r, 0);
    raf = requestAnimationFrame(frame);
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [model, store, list, polys, style, electrons, still]);

  const keep = (key: string, i: number) => (el: SVGPathElement | null) => {
    const arr = els.current.get(key) ?? [];
    arr[i] = el;
    els.current.set(key, arr);
  };
  useEffect(() => {
    const keys = new Set(list.map((r) => r.key));
    for (const k of [...els.current.keys()]) if (!keys.has(k)) els.current.delete(k);
    spacing.current.clear();
  }, [list, style]);
  return (
    <g className="ov" data-overlay="flow" data-style={style}>
      {list.map((r) =>
        style === "barber" || style === "chevrons" ? (
          <g key={r.key}>
            <path ref={keep(r.key, 0)} className="fl-fill" />
            {style === "barber" && still && <path ref={keep(r.key, 1)} className="fl-fill" opacity={0.45} />}
          </g>
        ) : (
          <g key={r.key}>
            {layersOf(style, 8).map((ly, i) => (
              <path key={i} ref={keep(r.key, i)} d={r.d} className={ly.cls} strokeWidth={n3(2 * r.half * ly.w)} opacity={ly.op} />
            ))}
          </g>
        ),
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// The tracer's run

/** The loop as one polyline from the terminal: each lead as the view draws it, straight through parts and metal. */
function tracePolyline(model: InkModel, t: Trace): Vec2[] {
  const pts: Vec2[] = [];
  const add = (p: Vec2) => {
    const q = pts[pts.length - 1];
    if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05) pts.push(p);
  };
  for (const s of t.steps) {
    if (s.kind === "lead") {
      const li = model.leads.get(s.id);
      if (!li) continue;
      const line = samplePath(leadD(li), () => leadPolyline(li));
      for (const p of s.from === "a" ? line : [...line].reverse()) add(p);
    } else {
      add([s.a[0], s.a[2]]);
      add([s.b[0], s.b[2]]);
    }
  }
  return pts;
}

/** Each style's run: the units it leaves behind and the one at its head (path data up to `head` mm). */
function runShapes(style: Striped, pl: Poly, head: number, half: number): { units: string; front: string } {
  const S = style === "pulses" ? 7 : unitSpacing(style, 1e-3);
  const l: Lay = { pl, x: 0, S, dir: 1, half, from: 0, to: head };
  const tip: Lay = { pl, x: head - S / 2, S, dir: 1, half, from: head - 0.01, to: head + 0.01 };
  if (style === "barber") return { units: barberD(l), front: "" };
  if (style === "chevrons") return { units: chevronD(l), front: head > 1 ? chevronD(tip, 1.35) : "" };
  if (style === "dashes") return { units: barsD(l, 2.6, half * 0.42), front: head > 1 ? barsD({ ...tip, x: head - S / 2 - 1.6 }, 3.2, half * 0.62) : "" };
  return { units: barsD(l, 1.0, half * 0.96), front: head > 1 ? barsD({ ...tip, x: head - S / 2 - 0.9 }, 1.8, half * 1.3) : "" };
}

export const InkTraceRun = memo(function InkTraceRun({ model, store, from, at, style }: { model: InkModel; store: BenchStore; from: string; at: number; style: Striped }) {
  const pressed = useStore(store, (s) => s.ui.pressed);
  const trace = useMemo(() => traceLoop(model.bench, from, { pressed, snapshot: store.getState().snapshot }), [model, from, pressed, store]);
  const pts = useMemo(() => tracePolyline(model, trace), [model, trace]);
  const pl = useMemo(() => polyOf(pts), [pts]);
  const half = INK.cableW / 2;
  const lane = useRef<SVGPathElement | null>(null);
  const units = useRef<SVGPathElement | null>(null);
  const front = useRef<SVGPathElement | null>(null);
  const end = useRef<SVGGElement | null>(null);
  const dur = Math.max(1200, Math.min(3600, trace.steps.length * 320));
  useEffect(() => {
    const show = (k: number) => {
      const head = pl.L * (1 - Math.pow(1 - k, 2)) + (k >= 1 ? 1 : 0);
      const sh = runShapes(style, pl, head, half);
      lane.current?.setAttribute("stroke-dashoffset", String(n2(pl.L - head)));
      units.current?.setAttribute("d", sh.units);
      front.current?.setAttribute("d", k >= 1 ? "" : sh.front);
      if (end.current) end.current.style.opacity = k >= 1 ? "1" : "0";
    };
    if (stillMotion()) {
      show(1);
      return;
    }
    let raf = 0;
    const frame = () => {
      const k = Math.max(0, Math.min(1, (performance.now() - at) / dur));
      show(k);
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [pl, at, dur, style, half]);
  if (pts.length < 2) return null;
  const gapAt = (trace.gap ? anchorInk(model, trace.gap) : null) ?? pts[pts.length - 1]!;
  const home = pts[0]!;
  // A thin lane of the flow tint down the middle, joining the run's pulses.
  const laneW = style === "pulses" ? 2 * half * 0.22 : 0;
  return (
    <g className="ov" data-overlay="trace" data-style={style} data-closed={trace.closed ? "1" : "0"}>
      {laneW > 0 && <path ref={lane} d={pathOf(pts)} className="fl-lane" strokeWidth={n3(laneW)} strokeDasharray={`${n3(pl.L)} ${n3(pl.L + 2)}`} strokeDashoffset={n3(pl.L)} />}
      <path ref={units} className="fl-run" />
      <path ref={front} className="fl-head" />
      <g ref={end} style={{ opacity: 0 }}>
        {trace.closed ? (
          <g>
            <circle cx={n3(home[0])} cy={n3(home[1])} r={3.1} className="fl-home-halo" strokeWidth={2.4} />
            <circle cx={n3(home[0])} cy={n3(home[1])} r={3.1} className="fl-home" strokeWidth={1.3} />
          </g>
        ) : (
          <g>
            <circle cx={n3(gapAt[0])} cy={n3(gapAt[1])} r={3.4} className="fl-stop" />
            <path d={`M${n3(gapAt[0] - 1.5)} ${n3(gapAt[1] - 1.5)}l3 3M${n3(gapAt[0] + 1.5)} ${n3(gapAt[1] - 1.5)}l-3 3`} className="fl-stop-x" strokeWidth={0.85} />
          </g>
        )}
      </g>
    </g>
  );
});
