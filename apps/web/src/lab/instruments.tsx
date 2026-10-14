/**
 * Instrument panels beside the bench: a large meter readout that mirrors the 3D LCD (with the dial and range settable
 * from here), the scope, sliders for lab controls, the notebook of logged readings, and a connections panel that
 * lets keyboard users clip leads and probes without dragging.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { DIAL_MODES, partLegs, terminalNumber, type MeterMode, type MeterSocket } from "@ohmland/bench/core";
import { Icon } from "../components/Icon";
import { m } from "../i18n";
import type { ControlConfig, OverlayName, Reading, ScopeConfig, ScopeLevel, ScopeTrace } from "./define";
import type { LabRuntime } from "./runtime";
import { formatSpan } from "./signals";

const RANGES: Partial<Record<MeterMode, string[]>> = {
  dcv: ["200mV", "2V", "20V", "200V", "600V"],
  acv: ["2V", "20V", "200V", "600V"],
  ohm: ["200", "2k", "20k", "200k", "2M", "20M"],
  "dca-ma": ["200uA", "2mA", "20mA", "200mA"],
  "dca-10a": ["10A"],
};

/** "200uA" -> "200 µA", "2k" -> "2 kΩ", "20V" -> "20 V". */
export function rangeLabel(r: string): string {
  const mm = /^(\d+)(u|m|k|M)?(V|A)?$/.exec(r);
  if (!mm) return r;
  const prefix = mm[2] === "u" ? "µ" : mm[2] ?? "";
  return `${mm[1]} ${prefix}${mm[3] ?? "Ω"}`;
}

export function MeterPanel({ runtime, compact = false }: { runtime: LabRuntime; compact?: boolean }) {
  const meter = useStore(runtime.store, (s) => s.bench.meter);
  const state = useStore(runtime.store, (s) => (meter ? s.snapshot?.parts[meter.id] : undefined));
  const spares = useStore(runtime.ui, (s) => s.spareFuses);
  const dialId = useId();
  if (!meter) return null;
  const off = meter.mode === "off";
  const display = off ? "" : state?.display?.trim() ?? "";
  const unit = off ? "" : state?.unit ?? "";
  const fuseBlown = state?.extra?.["fuse"] === "blown";
  const range = meter.range ?? "auto";
  const ranges = RANGES[meter.mode] ?? [];
  const red = meter.probes.red.socket;
  const black = meter.probes.black.socket;
  const name = (s: MeterSocket | null) => (s ? m.lab.meter.socketNames[s] ?? s : m.lab.meter.unplugged);
  const current = meter.mode === "dca-ma" || meter.mode === "dca-10a";
  // Current needs the red lead in a current socket, but not with the probes across a voltage (a battery's
  // terminals): moved there, the meter would short it and blow its fuse. Then the dial is what to change.
  const needSocket = current && red !== (meter.mode === "dca-10a" ? "a10" : "ma");
  const tips = [meter.probes.red.tip.to, meter.probes.black.tip.to];
  const across = needSocket && !!tips[0] && !!tips[1] && Math.abs(runtime.session.view().volts(tips[0]!, tips[1]!) ?? 0) > 0.3;
  const warn = !current && (red === "ma" || red === "a10") ? m.lab.meter.wrongSocket : across ? m.lab.meter.acrossVoltage : needSocket ? m.lab.meter.needCurrentSocket : null;
  const probesFree = !meter.probes.red.tip.to && !meter.probes.black.tip.to;
  const over = /OL/.test(display);

  if (compact) {
    return (
      <div className="meter-mini" aria-label={m.lab.meter.title}>
        <span className="meter-mini__mode">{m.lab.meter.short[meter.mode]}</span>
        <span className="meter-mini__value mono">{display || m.lab.meter.blank}</span>
        <span className="meter-mini__unit">{unit}</span>
      </div>
    );
  }

  return (
    <section className="instrument meter-panel" aria-labelledby={`${dialId}-t`}>
      <header className="instrument__head">
        <h3 id={`${dialId}-t`} className="instrument__title">
          {m.lab.meter.title}
        </h3>
        <span className="instrument__tag">{m.lab.meter.modes[meter.mode]}</span>
      </header>
      <div className="lcd" data-off={off || undefined} role="img" aria-label={display ? `${display} ${unit}` : m.lab.meter.off} data-meter-display={display}>
        {off ? (
          <span className="lcd__off">{m.lab.meter.off}</span>
        ) : (
          <>
            <span className="lcd__value mono">{display || m.lab.meter.blank}</span>
            <span className="lcd__unit">{unit}</span>
          </>
        )}
        {state?.extra?.["beep"] === true && <span className="lcd__beep">{m.lab.meter.beep}</span>}
      </div>
      <p className="meter-panel__explain">{m.lab.meter.explain[meter.mode]}</p>
      <p className="meter-panel__sockets small">{m.lab.meter.sockets(name(red), name(black))}</p>
      {warn && (
        <p className="meter-panel__warn small" role="note">
          <Icon name="alert" size={16} />
          {warn}
        </p>
      )}
      {!off && probesFree && !warn && <p className="meter-panel__hint small">{m.lab.meter.probesFree}</p>}
      {!off && over && <p className="meter-panel__hint small">{m.lab.meter.over}</p>}
      {fuseBlown && (
        <div className="meter-panel__fuse" role="alert">
          <p className="small">{m.lab.meter.fuseBlown}</p>
          <button type="button" className="btn btn--small btn--secondary" onClick={() => runtime.replaceFuse()} disabled={spares === 0}>
            <Icon name="fuse" size={16} />
            {m.lab.meter.replaceFuse}
          </button>
          {spares !== null && <span className="small muted">{m.lab.meter.sparesLeft(spares)}</span>}
        </div>
      )}
      <div className="meter-panel__controls">
        <div className="dial" role="radiogroup" aria-label={m.lab.meter.dial}>
          {DIAL_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={meter.mode === mode}
              className="dial__pos"
              title={m.lab.meter.modes[mode]}
              aria-label={m.lab.meter.modes[mode]}
              onClick={() => runtime.setMeterMode(mode)}
            >
              {m.lab.meter.short[mode]}
            </button>
          ))}
        </div>
        {ranges.length > 0 && (
          <label className="meter-panel__range small">
            <span>{m.lab.meter.range}</span>
            <select className="select" value={ranges.includes(range) ? range : "auto"} onChange={(e) => runtime.setMeterRange(e.target.value)}>
              <option value="auto">{m.lab.meter.auto}</option>
              {ranges.map((r) => (
                <option key={r} value={r}>
                  {rangeLabel(r)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Scope

type Series = { label: string; unit: string; points: [number, number][] };

function readTrace(runtime: LabRuntime, trace: ScopeTrace, seconds: number): Series {
  const view = runtime.session.view();
  if ("volts" in trace) {
    const pts = view.history(`volts:${trace.volts}`, seconds);
    if (trace.ref) {
      const ref = new Map(view.history(`volts:${trace.ref}`, seconds));
      return { label: trace.label, unit: "V", points: pts.map(([t, v]) => [t, v - (ref.get(t) ?? 0)]) };
    }
    return { label: trace.label, unit: "V", points: pts };
  }
  if ("amps" in trace) return { label: trace.label, unit: "mA", points: view.history(`i:${trace.amps}`, seconds).map(([t, v]) => [t, v * 1000]) };
  return { label: trace.label, unit: "%", points: view.history(`glow:${trace.glow}`, seconds).map(([t, v]) => [t, v * 100]) };
}

const TRACE_TOKENS = ["--scope-a", "--scope-b"];

/** "1.24 kHz", "440 Hz", "12.1 Hz". */
export function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz >= 100 ? Math.round(hz) : hz.toFixed(1)} Hz`;
}

export function ScopePanel({ runtime, config }: { runtime: LabRuntime; config: ScopeConfig }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [latest, setLatest] = useState<string[]>([]);
  const [pitch, setPitch] = useState<string>("");
  const [duty, setDuty] = useState<string>("");
  const capture = useStore(runtime.ui, (s) => s.capture);
  const seconds = config.window ?? 5;
  const id = useId();
  const shot = capture?.state === "done" ? capture : null;
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return;
      last = now;
      const c = canvas.current;
      if (!c) return;
      if (config.pitch) {
        const hz = runtime.session.view().toneHz(config.pitch);
        setPitch(hz ? m.lab.pitch(formatHz(hz)) : m.lab.silent);
      }
      if (shot) {
        // A single shot: times in seconds after the switch, drawn across the capture window.
        const span = (config.capture?.ms ?? 2) / 1000;
        const series: Series[] = shot.series.map((s) => ({ label: s.label, unit: "V", points: s.points.map(([t, v]) => [t - span, v] as [number, number]) }));
        paint(c, series, span, config.range);
        setLatest(series.map((_, i) => {
          const lo = Math.min(...shot.series[i]!.points.map((p) => p[1]));
          return Number.isFinite(lo) ? m.lab.capture.min(`${lo.toFixed(Math.abs(lo) < 10 ? 2 : 0)} V`) : "";
        }));
        return;
      }
      const series = config.traces.slice(0, 2).map((t) => readTrace(runtime, t, seconds));
      const view = runtime.session.view();
      paint(c, series, seconds, config.range, levelLines(view, config.levels));
      if (config.duty !== undefined && config.duty !== false) {
        const tr = config.traces[config.duty === true ? 0 : config.duty];
        const d = tr && "volts" in tr ? view.duty(`volts:${tr.volts}`) : null;
        setDuty(d ? m.lab.chips.duty(formatSpan(d.high), formatSpan(d.low), Math.round(d.duty * 100)) : m.lab.chips.dutyWaiting);
      }
      setLatest(series.map((s) => {
        const v = s.points[s.points.length - 1]?.[1];
        return v === undefined ? "" : `${v.toFixed(Math.abs(v) < 10 ? 2 : 1)} ${s.unit}`;
      }));
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [runtime, config, paused, seconds, shot]);
  return (
    <section className="instrument scope-panel" aria-labelledby={`${id}-t`}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {m.lab.scope.title}
        </h3>
        <span className="instrument__tag">{shot ? m.lab.capture.span(config.capture?.ms ?? 2) : m.lab.scope.window(seconds)}</span>
        {!shot && (
          <button type="button" className="btn btn--small btn--tertiary" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            <Icon name={paused ? "play" : "minus"} size={16} />
            {paused ? m.lab.scope.resume : m.lab.scope.pause}
          </button>
        )}
      </header>
      <canvas ref={canvas} className="scope-panel__screen" role="img" aria-label={m.lab.scope.label} data-scope data-capture={capture?.state} />
      <ul className="scope-panel__legend small">
        {config.traces.slice(0, 2).map((t, i) => (
          <li key={i} data-trace={i}>
            <span className="scope-panel__swatch" aria-hidden="true" />
            {t.label}
            <span className="mono">{latest[i] ?? ""}</span>
          </li>
        ))}
        {config.pitch && (
          <li data-pitch>
            <span className="mono">{pitch}</span>
          </li>
        )}
        {config.levels?.length ? (
          <li data-levels>
            <span className="scope-panel__swatch scope-panel__swatch--ref" aria-hidden="true" />
            {config.levels.map((l) => l.label ?? ("fraction" in l ? fractionLabel(l.fraction) : `${l.volts} V`)).join(", ")}
          </li>
        ) : null}
      </ul>
      {config.duty !== undefined && config.duty !== false && (
        <p className="scope-panel__duty small mono" data-duty>
          {duty}
        </p>
      )}
      {config.capture && (
        <div className="scope-panel__shot">
          {capture?.state === "armed" ? (
            <button type="button" className="btn btn--small btn--soft" aria-pressed="true" onClick={() => runtime.armCapture(false)} data-capture-arm>
              <Icon name="target" size={16} />
              {m.lab.capture.armed}
            </button>
          ) : capture?.state === "running" ? (
            <span className="small muted">{m.lab.capture.running}</span>
          ) : shot ? (
            <>
              <button type="button" className="btn btn--small btn--soft" onClick={() => runtime.armCapture(true)} data-capture-arm>
                <Icon name="target" size={16} />
                {m.lab.capture.arm}
              </button>
              <button type="button" className="btn btn--small btn--tertiary" onClick={() => runtime.armCapture(false)}>
                {m.lab.capture.live}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--small btn--soft" onClick={() => runtime.armCapture(true)} data-capture-arm>
              <Icon name="target" size={16} />
              {m.lab.capture.arm}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** "2/3" for 0.667, "1/3" for 0.333, "1/2" for 0.5, else a percentage. */
export function fractionLabel(f: number): string {
  for (const d of [2, 3, 4, 5]) for (let n = 1; n < d; n++) if (Math.abs(f - n / d) < 0.005) return `${n}/${d}`;
  return `${Math.round(f * 100)}%`;
}

/** The scope's reference lines now: their volts and labels. */
export function levelLines(view: { volts(node: string, ref?: string): number | undefined }, levels: ScopeLevel[] | undefined): { v: number; label: string }[] {
  const out: { v: number; label: string }[] = [];
  for (const l of levels ?? []) {
    if ("volts" in l) out.push({ v: l.volts, label: l.label ?? `${l.volts} V` });
    else {
      const of = view.volts(l.of, l.ref);
      if (of !== undefined) out.push({ v: of * l.fraction, label: l.label ?? fractionLabel(l.fraction) });
    }
  }
  return out;
}

function paint(c: HTMLCanvasElement, series: Series[], seconds: number, fixed?: [number, number], levels: { v: number; label: string }[] = []) {
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
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color("--scope-bg");
  ctx.fillRect(0, 0, w, h);
  // Grid: 10 divisions across, 4 down.
  ctx.strokeStyle = color("--scope-grid");
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const x = Math.round((i * w) / 10) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let j = 1; j < 4; j++) {
    const y = Math.round((j * h) / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const tEnd = Math.max(0, ...series.map((s) => s.points[s.points.length - 1]?.[0] ?? 0));
  // Set inside the loop below (a callback, so TypeScript cannot follow it).
  let scale0 = null as [number, number] | null;
  series.forEach((s, i) => {
    if (s.points.length < 2) return;
    let lo = fixed?.[0] ?? Infinity;
    let hi = fixed?.[1] ?? -Infinity;
    if (!fixed) {
      for (const [, v] of s.points) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      // The first trace's scale holds its reference lines too.
      if (i === 0) for (const l of levels) {
        lo = Math.min(lo, l.v);
        hi = Math.max(hi, l.v);
      }
      if (lo > 0) lo = 0;
      if (hi - lo < 1e-6) hi = lo + 1;
      const pad = (hi - lo) * 0.08;
      hi += pad;
      lo -= pad * (lo < 0 ? 1 : 0);
    }
    if (i === 0) scale0 = [lo, hi];
    ctx.strokeStyle = color(TRACE_TOKENS[i] ?? "--scope-a");
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    s.points.forEach(([t, v], k) => {
      const x = ((t - (tEnd - seconds)) / seconds) * w;
      const y = h - 4 - ((v - lo) / (hi - lo)) * (h - 8);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  if (scale0 && levels.length) {
    // Dashed reference lines (the 1/3 and 2/3 lines) on the first trace's scale, each labelled at the left on a patch
    // of screen, over the traces so they never run through the label.
    const [lo, hi] = scale0;
    ctx.save();
    ctx.strokeStyle = color("--scope-b");
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.font = `11px ${css.getPropertyValue("--font-mono").trim() || "monospace"}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const l of levels) {
      const y = Math.round(h - 4 - ((l.v - lo) / (hi - lo)) * (h - 8)) + 0.5;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      const text = `${l.label} ${l.v.toFixed(2)} V`;
      ctx.globalAlpha = 1;
      ctx.fillStyle = color("--scope-bg");
      ctx.fillRect(4, y - 8, ctx.measureText(text).width + 8, 16);
      ctx.fillStyle = color("--scope-b");
      ctx.fillText(text, 8, y);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Views: the overlays a lab offers (flow dots, electrons, push), as toggles

export function ViewsPanel({ runtime, offer }: { runtime: LabRuntime; offer: readonly OverlayName[] }) {
  const views = useStore(runtime.ui, (s) => s.views);
  if (!offer.length) return null;
  const on = (name: OverlayName) => (name === "push" ? views.push : name === "electrons" ? views.flow === "electrons" : views.flow !== "off");
  return (
    <section className="instrument views-panel">
      <header className="instrument__head">
        <h3 className="instrument__title">{m.lab.views.title}</h3>
      </header>
      <div className="views-panel__row" role="group" aria-label={m.lab.views.title}>
        {offer.map((name) => (
          <button key={name} type="button" className="btn btn--small btn--tertiary" aria-pressed={on(name)} onClick={() => runtime.setView(name, !on(name))}>
            {m.lab.views[name]}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Controls (sliders bound to simulator inputs)

export function ControlsPanel({ runtime, controls }: { runtime: LabRuntime; controls: ControlConfig[] }) {
  const values = useStore(runtime.ui, (s) => s.controls);
  if (!controls.length) return null;
  return (
    <section className="instrument controls-panel">
      <header className="instrument__head">
        <h3 className="instrument__title">{m.lab.controls.title}</h3>
      </header>
      {controls.map((c) => {
        if (c.key === "proximity") return <HandControl key={c.id} runtime={runtime} c={c} value={values[c.id] ?? c.value} />;
        const log = c.scale === "log";
        const v = values[c.id] ?? c.value;
        const toSlider = (x: number) => (log ? Math.log10(x) : x);
        const fromSlider = (x: number) => (log ? 10 ** x : x);
        return (
          <label key={c.id} className="control">
            <span className="control__label">
              {c.label}
              <span className="mono">{formatControl(v, c)}</span>
            </span>
            <input
              type="range"
              min={toSlider(c.min)}
              max={toSlider(c.max)}
              step={log ? 0.01 : c.step ?? (c.max - c.min) / 100}
              value={toSlider(v)}
              onChange={(e) => runtime.setControl(c.id, Number(fromSlider(Number(e.target.value)).toPrecision(4)))}
            />
          </label>
        );
      })}
    </section>
  );
}

/**
 * The hand: a slider drawn as an ink hand moving toward the chip (proximity 0 far, 1 touching close), which makes a
 * floating input pick up hum. The range input underneath is the real control (keyboard, screen readers).
 */
function HandControl({ runtime, c, value }: { runtime: LabRuntime; c: ControlConfig; value: number }) {
  const span = c.max - c.min || 1;
  const f = Math.min(1, Math.max(0, (value - c.min) / span));
  const pct = Math.round(f * 100);
  const handX = 8 + f * 150;
  return (
    <label className="control hand-control" data-control={c.id}>
      <span className="control__label">
        {c.label}
        <span className="small muted">{f < 0.05 ? m.lab.chips.handFar : f > 0.8 ? m.lab.chips.handNear : `${pct}%`}</span>
      </span>
      <svg viewBox="0 0 240 64" className="hand-control__art" aria-hidden="true">
        <path d="M196 14h36v36h-36zM196 32a6 6 0 0 0 0 0" className="hand-control__chip" />
        <path d="M196 26a6 6 0 0 1 0 12" className="hand-control__notch" />
        {[0, 1, 2].map((k) => (
          <path key={k} d={`M${202 + k * 12} 14v-8M${202 + k * 12} 50v8`} className="hand-control__leg" />
        ))}
        <g transform={`translate(${handX} 8)`} className="hand-control__hand">
          <path d="M4 30c0-8 2-14 6-16l1-11c0-3 5-3 5 0v10l1-12c0-3 5-3 5 0v12l1-10c0-3 5-3 5 0v11l1-7c0-3 5-3 5 0l-1 15c0 9-5 17-14 17h-4C8 39 4 36 4 30z" />
        </g>
        {f > 0.5 && <path d={`M${handX + 44} 26q6 6 0 12M${handX + 50} 22q9 10 0 20`} className="hand-control__hum" style={{ opacity: (f - 0.5) * 2 }} />}
      </svg>
      <input
        type="range"
        min={c.min}
        max={c.max}
        step={c.step ?? span / 100}
        value={value}
        aria-valuetext={m.lab.chips.handSay(pct)}
        onChange={(e) => runtime.setControl(c.id, Number(e.target.value))}
      />
    </label>
  );
}

function formatControl(v: number, c: ControlConfig): string {
  if (c.unit === "%") return `${Math.round(v * 100)} %`;
  if (c.unit === "Ω") return v >= 1e6 ? `${(v / 1e6).toPrecision(3)} MΩ` : v >= 1e3 ? `${(v / 1e3).toPrecision(3)} kΩ` : `${v.toPrecision(3)} Ω`;
  return `${Number(v.toPrecision(3))}${c.unit ? ` ${c.unit}` : ""}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Notebook

export function readingWhere(r: Reading): string {
  for (const t of r.tags) {
    if (t.startsWith("across:")) return m.lab.notebook.across(t.slice(7));
    if (t.startsWith("rev:")) return m.lab.notebook.reversed(t.slice(4));
    if (t.startsWith("series:")) return m.lab.notebook.series(t.slice(7));
  }
  return "";
}

export function Notebook({ runtime }: { runtime: LabRuntime }) {
  const readings = useStore(runtime.ui, (s) => s.readings);
  const [live, setLive] = useState("");
  const last = readings[readings.length - 1];
  useEffect(() => {
    if (last) setLive(`${last.display} ${last.unit ?? ""} ${readingWhere(last)}`);
  }, [last]);
  return (
    <section className="instrument notebook">
      <header className="instrument__head">
        <h3 className="instrument__title">{m.lab.notebook.title}</h3>
      </header>
      {readings.length === 0 ? (
        <p className="small muted">{m.lab.notebook.empty}</p>
      ) : (
        <ol className="notebook__list" reversed>
          {readings
            .slice(-6)
            .reverse()
            .map((r) => (
              <li key={r.t} className="notebook__row">
                <span className="mono">
                  {r.display} {r.unit}
                </span>
                <span className="small muted">{readingWhere(r)}</span>
              </li>
            ))}
        </ol>
      )}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Connections: every clip and probe as a pair of selects (a keyboard path for what the bench does by dragging).

export function ConnectionsPanel({ runtime }: { runtime: LabRuntime }) {
  const bench = useStore(runtime.store, (s) => s.bench);
  const id = useId();
  const options = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (const p of bench.parts)
      for (const leg of partLegs(p)) {
        // A mystery part's terminals are known only by their numbers.
        const n = terminalNumber(p, leg);
        out.push({ value: `pin:${p.id}.${leg}`, label: `${p.id} ${n !== null ? m.lab.terminal(n) : m.lab.legs[leg] ?? leg}` });
      }
    return out;
  }, [bench.parts]);
  if (!bench.leads.length && !bench.meter) return null;
  const s = runtime.store.getState();
  const pick = (value: string | null, onChange: (v: string | null) => void, label: string) => (
    <label className="conn__end">
      <span className="sr-only">{label}</span>
      <select className="select select--small" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{m.lab.connections.free}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <details className="instrument connections">
      <summary className="instrument__title" id={`${id}-t`}>
        {m.lab.connections.title}
      </summary>
      <p className="small muted">{m.lab.connections.lead}</p>
      <ul className="conn__list" aria-labelledby={`${id}-t`}>
        {bench.leads.map((l) => (
          <li key={l.id} className="conn">
            <span className="conn__name" data-color={l.color}>
              {m.lab.connections.lead_(l.id, m.benchUi.testLead)}
            </span>
            {pick(l.a.to, (v) => s.clipLead(l.id, "a", v), m.lab.connections.endA(l.id))}
            {pick(l.b.to, (v) => s.clipLead(l.id, "b", v), m.lab.connections.endB(l.id))}
          </li>
        ))}
        {bench.meter &&
          (["red", "black"] as const).map((c) => (
            <li key={c} className="conn">
              <span className="conn__name" data-color={c}>
                {m.lab.connections.probe(c)}
              </span>
              {pick(bench.meter!.probes[c].tip.to, (v) => s.touchProbe(c, v), m.lab.connections.probe(c))}
              <label className="conn__end">
                <span className="sr-only">{m.lab.connections.plug(c)}</span>
                <select className="select select--small" value={bench.meter!.probes[c].socket ?? ""} onChange={(e) => s.plugProbe(c, (e.target.value || null) as MeterSocket | null)}>
                  <option value="">{m.lab.meter.unplugged}</option>
                  {(["com", "vohm", "ma", "a10"] as const).map((k) => (
                    <option key={k} value={k}>
                      {m.lab.meter.socketNames[k]}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
      </ul>
    </details>
  );
}
