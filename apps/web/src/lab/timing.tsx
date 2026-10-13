/**
 * Timing instruments for the dock: the data logger (a plot since the run started, with a cursor that reads off time
 * and voltage), the stopwatch (starts and stops by itself on switch and relay events) and the auto-tapper.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "zustand";
import { Icon } from "../components/Icon";
import { m } from "../i18n";
import type { LoggerConfig, StopwatchConfig, TapperConfig } from "./define";
import type { LabRuntime } from "./runtime";
import "./panels.css";

const fmt = (v: number) => (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1));

/** Value of a sampled series at time t (linear between samples). */
function at(points: [number, number][], t: number): number | null {
  if (!points.length) return null;
  if (t <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]!;
    if (t1 >= t) {
      const [t0, v0] = points[i - 1]!;
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1]![1];
}

export function LoggerPanel({ runtime, config }: { runtime: LabRuntime; config: LoggerConfig }) {
  useStore(runtime.ui, (s) => s.panels);
  const canvas = useRef<HTMLCanvasElement>(null);
  const id = useId();
  const [cursor, setCursor] = useState(1);
  const [read, setRead] = useState<string[]>([]);
  const span = config.seconds ?? 12;
  const t0 = runtime.session.loggerT0;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 66) return;
      last = now;
      const c = canvas.current;
      const start = runtime.session.loggerT0;
      if (!c) return;
      const view = runtime.session.view();
      const series = config.traces.slice(0, 2).map((tr) => {
        const src = "volts" in tr ? `volts:${tr.volts}` : "amps" in tr ? `i:${tr.amps}` : `glow:${tr.glow}`;
        const pts = start === null ? [] : view.history(src, 20).filter(([t]) => t >= start - 1e-9).map(([t, v]) => [t - start, v] as [number, number]);
        return pts;
      });
      paintLogger(c, series, span, cursorRef.current, config.range ?? [0, 10]);
      setRead(series.map((pts, i) => {
        const v = at(pts, cursorRef.current);
        const unit = "volts" in config.traces[i]! ? "V" : "";
        return v === null ? "" : `${fmt(v)} ${unit}`.trim();
      }));
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [runtime, config, span]);

  const moveTo = (clientX: number) => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    setCursor(Math.max(0, Math.min(span, ((clientX - r.left) / r.width) * span)));
  };
  return (
    <section className="instrument logger" aria-labelledby={`${id}-t`}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {m.lab.logger.title}
        </h3>
        <button type="button" className="btn btn--small btn--tertiary" onClick={() => runtime.startLogger()}>
          <Icon name="retry" size={16} />
          {m.lab.logger.start}
        </button>
      </header>
      <canvas
        ref={canvas}
        className="logger__screen"
        role="slider"
        tabIndex={0}
        aria-label={m.lab.logger.cursorLabel}
        aria-valuemin={0}
        aria-valuemax={span}
        aria-valuenow={Number(cursor.toFixed(2))}
        aria-valuetext={m.lab.logger.cursor(cursor.toFixed(2), read[0] ?? "")}
        data-logger
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons) moveTo(e.clientX);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.5 : 0.02;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") setCursor((c) => Math.min(span, c + step));
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setCursor((c) => Math.max(0, c - step));
          else return;
          e.preventDefault();
        }}
      />
      <p className="logger__read small mono" aria-live="off">
        {t0 === null ? m.lab.logger.waiting : m.lab.logger.cursor(cursor.toFixed(2), read.filter(Boolean).join(", "))}
      </p>
    </section>
  );
}

function paintLogger(c: HTMLCanvasElement, series: [number, number][][], span: number, cursor: number, range: [number, number]) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth;
  const h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const css = getComputedStyle(c);
  const color = (name: string) => css.getPropertyValue(name).trim();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = color("--scope-bg");
  ctx.fillRect(0, 0, w, h);
  const [lo, hi] = range;
  const x = (t: number) => (t / span) * w;
  const y = (v: number) => h - 14 - ((v - lo) / (hi - lo)) * (h - 22);
  ctx.strokeStyle = color("--scope-grid");
  ctx.fillStyle = color("--scope-grid");
  ctx.lineWidth = 1;
  ctx.font = "10px sans-serif";
  for (let s = 1; s < span; s++) {
    const gx = Math.round(x(s)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h - 12);
    ctx.stroke();
  }
  for (let v = Math.ceil(lo); v <= hi; v += hi - lo > 12 ? 5 : 1) {
    const gy = Math.round(y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }
  ["--scope-a", "--scope-b"].forEach((tok, i) => {
    const pts = series[i];
    if (!pts || pts.length < 2) return;
    ctx.strokeStyle = color(tok);
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([t, v], k) => (k ? ctx.lineTo(x(t), y(v)) : ctx.moveTo(x(t), y(v))));
    ctx.stroke();
  });
  ctx.strokeStyle = color("--scope-b");
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(Math.round(x(cursor)) + 0.5, 0);
  ctx.lineTo(Math.round(x(cursor)) + 0.5, h);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function StopwatchPanel({ runtime }: { runtime: LabRuntime; config: StopwatchConfig }) {
  useStore(runtime.ui, (s) => s.panels);
  const id = useId();
  const [, tick] = useState(0);
  const since = runtime.session.timingSince;
  useEffect(() => {
    if (since === null) return;
    const t = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [since]);
  const now = runtime.session.snapshot?.t ?? 0;
  const runs = runtime.session.runs;
  const shown = since !== null ? now - since : runs[runs.length - 1]?.seconds ?? 0;
  return (
    <section className="instrument stopwatch" aria-labelledby={`${id}-t`}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {m.lab.stopwatch.title}
        </h3>
        <span className="instrument__tag">{since !== null ? m.lab.stopwatch.running : m.lab.stopwatch.idle}</span>
      </header>
      <div className="watch__time mono" role="timer" aria-live="off" data-stopwatch={shown.toFixed(2)}>
        {shown.toFixed(2)} s
      </div>
      {runs.length ? (
        <>
          <span className="small muted">{m.lab.stopwatch.last}</span>
          <ol className="watch__runs small mono" aria-live="polite">
            {runs.slice(-6).map((r) => (
              <li key={r.start}>{m.lab.stopwatch.run(r.seconds.toFixed(2))}</li>
            ))}
          </ol>
        </>
      ) : (
        <p className="small muted">{m.lab.stopwatch.none}</p>
      )}
    </section>
  );
}

export function TapperPanel({ runtime, config }: { runtime: LabRuntime; config: TapperConfig }) {
  useStore(runtime.ui, (s) => s.panels);
  const id = useId();
  const on = !!runtime.session.tapper?.on;
  return (
    <section className="instrument tapper" aria-labelledby={`${id}-t`}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {m.lab.tapper.title}: {runtime.built.labels[config.part] ?? config.part}
        </h3>
        <span className="instrument__tag">{on ? m.lab.tapper.on : m.lab.tapper.off}</span>
      </header>
      <div className="tapper__row">
        <span className="tapper__dot" data-on={on || undefined} aria-hidden="true" />
        <button type="button" className="btn btn--small btn--soft" aria-pressed={on} onClick={() => runtime.setTapper(!on)} data-tapper>
          <Icon name={on ? "minus" : "play"} size={16} />
          {on ? m.lab.tapper.stop : m.lab.tapper.start}
        </button>
        <span className="small muted">{m.lab.tapper.rate(config.hz ?? 4)}</span>
      </div>
    </section>
  );
}
