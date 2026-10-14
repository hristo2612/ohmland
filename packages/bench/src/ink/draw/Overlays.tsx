// The teaching overlays in ink (docs/BENCH-VIEWS.md, "Overlays"): flow dots riding the leads and parts, push hatching
// along the leads with a hill by each battery and sealed box, and the loop tracer's red pencil line. They read the
// shared overlay state and simulator snapshot from the store; motion runs outside React (one attribute per path per
// frame), and stops under reduced motion.

import { memo, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { Snapshot } from "@ohmland/sim";
import { DOT_MIN_AMPS, DOT_SPACING, ELECTRON_SLOWDOWN, boxNets, dotSpeed, flowMap, hatchSpacing, hillShare, pushMap, traceLoop, type Trace } from "../../flow";
import { WIRE_TOKEN } from "../styles";
import type { BenchStore } from "../../store";
import type { Vec2 } from "../../types";
import { anchorInk, leadPolyline, partBounds, type InkModel } from "../model";
import { n3 } from "../frame";
import { stillMotion } from "../../motion";
import { InkFlowStripes, InkTraceRun } from "./FlowStripes";

const reducedMotion = stillMotion;

const pathOf = (pts: Vec2[]) => pts.map((p, i) => `${i ? "L" : "M"}${n3(p[0])} ${n3(p[1])}`).join("");

function lengthOf(pts: Vec2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return L;
}

function quad(a: Vec2, c: Vec2, b: Vec2, n = 12): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** Every conductor the flow can ride, as drawn: clip leads, jumpers and the stretches through parts. */
type Conductor = { key: string; pts: Vec2[]; d: string; /** The cable alone (no clips), for hatching. */ cable: string };

function conductors(model: InkModel): Map<string, Conductor> {
  const out = new Map<string, Conductor>();
  for (const li of model.leads.values()) {
    if (!li.a.attached && !li.b.attached) continue;
    const pts = leadPolyline(li);
    out.set(`lead:${li.lead.id}`, { key: `lead:${li.lead.id}`, pts, d: pathOf(pts), cable: pathOf(pts.slice(1, -1)) });
  }
  for (const wi of model.wires.values()) {
    const pts = quad(wi.a, wi.ctrl, wi.b);
    out.set(`wire:${wi.wire.id}`, { key: `wire:${wi.wire.id}`, pts, d: pathOf(pts), cable: pathOf(pts) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Flow dots

type Rider = { key: string; d: string; amps: number };

function riders(model: InkModel, s: Snapshot | null): Rider[] {
  const f = flowMap(model.bench, s);
  const conds = conductors(model);
  const out: Rider[] = [];
  for (const [id, amps] of Object.entries(f.leads)) {
    const c = conds.get(`lead:${id}`);
    if (c) out.push({ key: c.key, d: c.d, amps });
  }
  for (const [id, amps] of Object.entries(f.wires)) {
    const c = conds.get(`wire:${id}`);
    if (c) out.push({ key: c.key, d: c.d, amps });
  }
  for (const p of f.parts) {
    const pi = model.parts.get(p.id);
    const a = pi?.legs[p.from];
    const b = pi?.legs[p.to];
    if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) < 1) continue;
    out.push({ key: `part:${p.id}:${p.from}`, d: pathOf([a, b]), amps: p.amps });
  }
  return out;
}

const FlowDots = memo(function FlowDots({ model, store, electrons }: { model: InkModel; store: BenchStore; electrons: boolean }) {
  // Which conductors carry anything (re-rendered only when that set or the bench changes, not per snapshot).
  const liveKey = useStore(store, (s) =>
    riders(model, s.snapshot)
      .filter((r) => Math.abs(r.amps) >= DOT_MIN_AMPS)
      .map((r) => r.key)
      .join("|"),
  );
  const list = useMemo(() => riders(model, store.getState().snapshot).filter((r) => liveKey.split("|").includes(r.key)), [model, liveKey, store]);
  const refs = useRef(new Map<string, SVGPathElement[]>());
  const speeds = useRef(new Map<string, number>());
  const travel = useRef(new Map<string, number>());
  useEffect(() => {
    const update = (s: Snapshot | null) => {
      for (const r of riders(model, s)) speeds.current.set(r.key, Math.sign(r.amps) * dotSpeed(r.amps));
    };
    update(store.getState().snapshot);
    return store.subscribe((s, prev) => s.snapshot !== prev.snapshot && update(s.snapshot));
  }, [store, model]);
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const [key, els] of refs.current) {
        const v = (speeds.current.get(key) ?? 0) * (electrons ? -ELECTRON_SLOWDOWN : 1);
        const x = ((travel.current.get(key) ?? 0) + v * dt) % (DOT_SPACING * 1000);
        travel.current.set(key, x);
        for (const el of els) el.setAttribute("stroke-dashoffset", String(Math.round(-x * 1000) / 1000));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [electrons]);
  const keep = (key: string, i: number) => (el: SVGPathElement | null) => {
    const arr = refs.current.get(key) ?? [];
    if (el) arr[i] = el;
    refs.current.set(key, arr);
  };
  useEffect(() => {
    // Forget paths that are gone.
    const live = new Set(list.map((r) => r.key));
    for (const k of [...refs.current.keys()]) if (!live.has(k)) refs.current.delete(k);
  }, [list]);
  return (
    <g className="ov" data-overlay="flow">
      {list.map((r) =>
        electrons ? (
          <g key={r.key}>
            <path ref={keep(r.key, 0)} d={r.d} className="flow-e-halo" strokeWidth={1.3} strokeDasharray={`2.2 ${DOT_SPACING - 2.2}`} />
            <path ref={keep(r.key, 1)} d={r.d} className="flow-e" strokeWidth={0.42} strokeDasharray={`1.5 ${DOT_SPACING - 1.5}`} strokeDashoffset={-0.35} />
          </g>
        ) : (
          <g key={r.key}>
            <path ref={keep(r.key, 0)} d={r.d} className="flow-halo" strokeWidth={2.2} strokeDasharray={`0 ${DOT_SPACING}`} />
            <path ref={keep(r.key, 1)} d={r.d} className="flow-dot" strokeWidth={1.25} strokeDasharray={`0 ${DOT_SPACING}`} />
          </g>
        ),
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Push

const Push = memo(function Push({ model, store, defs }: { model: InkModel; store: BenchStore; defs: string }) {
  // Redraw when a voltage moves by a tenth of a volt, not on every snapshot.
  const key = useStore(store, (s) => {
    const p = pushMap(model.bench, s.snapshot);
    return JSON.stringify([Object.entries(p.leads).map(([k, v]) => [k, Math.round(((v[0] + v[1]) / 2) * 10)]), Object.entries(p.wires).map(([k, v]) => [k, Math.round(v * 10)]), Object.entries(p.hills).map(([k, v]) => [k, Math.round(v * 10)])]);
  });
  const p = useMemo(() => pushMap(model.bench, store.getState().snapshot), [model, store, key]);
  const conds = useMemo(() => conductors(model), [model]);
  return (
    <g className="ov" data-overlay="push">
      {Object.entries(p.leads).map(([id, [va, vb]]) => {
        const c = conds.get(`lead:${id}`);
        const sp = hatchSpacing((va + vb) / 2);
        if (!c || !Number.isFinite(sp)) return null;
        return <path key={id} d={c.cable} className="push-hatch" strokeWidth={6.2} strokeDasharray={`0.5 ${n3(sp - 0.5)}`} />;
      })}
      {Object.entries(p.wires).map(([id, v]) => {
        const c = conds.get(`wire:${id}`);
        const sp = hatchSpacing(v) / 2;
        if (!c || !Number.isFinite(sp)) return null;
        return <path key={id} d={c.cable} className="push-hatch" strokeWidth={3.4} strokeDasharray={`0.32 ${n3(sp - 0.32)}`} />;
      })}
      {Object.entries(p.hills).map(([id, volts]) => {
        const pi = model.parts.get(id);
        if (!pi || volts < 0.15) return null;
        const r = partBounds(pi);
        // A shut box carries its hill on its lid; an open one, like a battery, stands it beside itself.
        const box = pi.part.kind === "box" && !pi.part.params.lid;
        const share = hillShare(volts);
        // A box carries its hill on its lid; a battery has it standing beside it.
        const w = box ? 46 : 24;
        const cx = box ? (r[0] + r[2]) / 2 : r[2] + 4 + w / 2;
        const base = box ? r[3] - 17 : r[3] - 2;
        const h = 2 + share * (box ? 34 : 30);
        const d = `M${n3(cx - w / 2)} ${n3(base)}C${n3(cx - w * 0.28)} ${n3(base)} ${n3(cx - w * 0.2)} ${n3(base - h)} ${n3(cx)} ${n3(base - h)}S${n3(cx + w * 0.28)} ${n3(base)} ${n3(cx + w / 2)} ${n3(base)}Z`;
        return (
          <g key={id} data-hill={id}>
            <path d={d} className="push-hill" />
            <path d={d} fill={`url(#${defs}-push)`} />
            <path d={`M${n3(cx - w / 2 - 2)} ${n3(base)}H${n3(cx + w / 2 + 2)}`} className="trace-mark" strokeWidth={1.2} />
          </g>
        );
      })}
    </g>
  );
});

// ---------------------------------------------------------------------------------------------------------------
// The loop tracer

/** A polyline moved `d` mm to its left (so the red pencil runs beside a cable, readable on any colour). */
function offsetLine(pts: Vec2[], d: number): Vec2[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] + ((b[1] - a[1]) / l) * d, p[1] - ((b[0] - a[0]) / l) * d] as Vec2;
  });
}

function tracePoints(model: InkModel, t: Trace): Vec2[] {
  const pts: Vec2[] = [];
  const add = (p: Vec2) => {
    const q = pts[pts.length - 1];
    if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05) pts.push(p);
  };
  for (const s of t.steps) {
    if (s.kind === "lead") {
      const li = model.leads.get(s.id);
      if (!li) continue;
      const line = leadPolyline(li, 28);
      for (const p of s.from === "a" ? line : [...line].reverse()) add(p);
    } else {
      add([s.a[0], s.a[2]]);
      add([s.b[0], s.b[2]]);
    }
  }
  return pts;
}

const Tracer = memo(function Tracer({ model, store, from, at }: { model: InkModel; store: BenchStore; from: string; at: number }) {
  const pressed = useStore(store, (s) => s.ui.pressed);
  const trace = useMemo(() => traceLoop(model.bench, from, { pressed, snapshot: store.getState().snapshot }), [model, from, pressed, store]);
  const pts = useMemo(() => offsetLine(tracePoints(model, trace), 2.4), [model, trace]);
  const L = useMemo(() => lengthOf(pts), [pts]);
  const line = useRef<SVGPathElement | null>(null);
  const end = useRef<SVGGElement | null>(null);
  const dur = Math.max(1200, Math.min(3600, trace.steps.length * 320));
  useEffect(() => {
    const el = line.current;
    const mark = end.current;
    if (!el) return;
    const show = (k: number) => {
      el.setAttribute("stroke-dashoffset", String(n3(L * (1 - k))));
      if (mark) mark.style.opacity = k >= 1 ? "1" : "0";
    };
    if (reducedMotion()) {
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
  }, [L, at, dur]);
  if (pts.length < 2) return null;
  const gapAt = (trace.gap ? anchorInk(model, trace.gap) : null) ?? pts[pts.length - 1]!;
  return (
    <g className="ov" data-overlay="trace" data-closed={trace.closed ? "1" : "0"}>
      <path ref={line} d={pathOf(pts)} className="trace" strokeWidth={0.95} strokeDasharray={`${n3(L)} ${n3(L)}`} strokeDashoffset={n3(L)} />
      <g ref={end} style={{ opacity: 0 }}>
        {trace.closed ? (
          <circle cx={n3(pts[0]![0])} cy={n3(pts[0]![1])} r={2.6} className="trace-mark" />
        ) : (
          <g>
            <circle cx={n3(gapAt[0])} cy={n3(gapAt[1])} r={3.4} className="trace-mark" />
            <path d={`M${n3(gapAt[0] - 2.2)} ${n3(gapAt[1] - 2.2)}l4.4 4.4M${n3(gapAt[0] + 2.2)} ${n3(gapAt[1] - 2.2)}l-4.4 4.4`} className="trace-mark" />
          </g>
        )}
      </g>
    </g>
  );
});

/** A sealed box's inside wiring, once its lid is open: each terminal to the leads of the parts inside. */
export const BoxWires = memo(function BoxWires({ model }: { model: InkModel }) {
  const lines: { key: string; d: string; color: string }[] = [];
  for (const pi of model.parts.values()) {
    if (pi.part.kind !== "box" || !pi.part.params.lid) continue;
    const nets = boxNets(model.bench, pi.part);
    for (const [net, pts] of nets) {
      const color = net === "t1" ? "red" : net === "t2" ? "black" : "yellow";
      pts.slice(1).forEach((p, i) => {
        const a = pts[0]!;
        const mid: Vec2 = [(a[0] + p[0]) / 2, Math.max(a[2], p[2]) + 4];
        lines.push({ key: `${pi.part.id}:${net}:${i}`, d: `M${n3(a[0])} ${n3(a[2])}Q${n3(mid[0])} ${n3(mid[1])} ${n3(p[0])} ${n3(p[2])}`, color });
      });
    }
  }
  if (!lines.length) return null;
  const w = { ["--w" as string]: "1.1px" };
  return (
    <g className="ov">
      {lines.map((l) => (
        <g key={l.key}>
          <path d={l.d} className="edge" style={w} />
          <path d={l.d} className="core" style={{ ...w, stroke: WIRE_TOKEN(l.color) }} />
        </g>
      ))}
    </g>
  );
});

/** Push hatching, drawn under the leads so it shades either side of each cable. */
export function InkPush({ model, store, defs }: { model: InkModel; store: BenchStore; defs: string }) {
  const on = useStore(store, (s) => s.overlay.push);
  return on ? <Push model={model} store={store} defs={defs} /> : null;
}

/** Flow dots and the tracer, drawn over the leads. */
export function InkOverlays({ model, store }: { model: InkModel; store: BenchStore }) {
  const flow = useStore(store, (s) => s.overlay.flow);
  const style = useStore(store, (s) => s.overlay.flowStyle);
  const trace = useStore(store, (s) => s.overlay.trace);
  return (
    <g>
      {flow !== "off" &&
        (style === "dots" ? <FlowDots model={model} store={store} electrons={flow === "electrons"} /> : <InkFlowStripes model={model} store={store} electrons={flow === "electrons"} style={style} />)}
      {trace &&
        (style === "dots" ? (
          <Tracer model={model} store={store} from={trace.from} at={trace.at} />
        ) : (
          <InkTraceRun key={`${trace.from}@${trace.at}`} model={model} store={store} from={trace.from} at={trace.at} style={style} />
        ))}
    </g>
  );
}
