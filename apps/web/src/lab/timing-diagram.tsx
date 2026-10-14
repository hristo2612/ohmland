/**
 * The timing diagram: channels drawn as high and low ink lines over a window of time, every edge exact (node channels
 * come from the simulator's edge watch). Live, it scrolls calmly over the last few seconds. The latest burst of edges
 * (a press's bounce, a counter's ripple) can be replayed in slow motion: the window zooms to the burst and a blue
 * playhead writes it out over four seconds, with a scrubber for the keyboard and a mark on any state shorter than a
 * microsecond.
 *
 * TimingDiagram is pure (props in, SVG out); TimingPanel connects it to the session.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { m } from "../i18n";
import { prefersReducedMotion } from "../progress/prefs";
import type { PanelConfig, TimingChannel } from "./define";
import type { LabRuntime } from "./runtime";
import { formatSpan, slowFactor, traceShape, windowFromSamples, windowOf, type Burst, type ChannelWindow, type Glitch } from "./signals";
import { watchKey } from "./watch";
import "./chip-panels.css";

const W = 400;
const LABEL_W = 64;
const ROW = 34;
const TOP = 8;
const SWING = 16;
/** Seconds a slow-motion replay takes, whatever the burst's length. */
export const REPLAY_SECONDS = 4;

export type DiagramChannel = { label: string; window: ChannelWindow };

/** A tick label: the time from the origin in the step's unit, with only the decimals the step needs ("−1.5 s", "20 ns"). */
export function formatTick(t: number, step: number): string {
  const units: [number, string][] = [
    [1, "s"],
    [1e-3, "ms"],
    [1e-6, "µs"],
    [1e-9, "ns"],
  ];
  const [scale, unit] = units.find(([u]) => step >= u * 0.999) ?? units[units.length - 1]!;
  const s = step / scale;
  const decimals = s >= 1 ? 0 : s >= 0.1 ? 1 : 2;
  const v = t / scale;
  return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(decimals)} ${unit}`;
}

/** Nice tick spacing for a span: 1, 2 or 5 times a power of ten, about four ticks. */
export function tickStep(span: number): number {
  const raw = span / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

export type TimingDiagramProps = {
  channels: DiagramChannel[];
  t0: number;
  t1: number;
  /** Where times on the axis count from (the burst's start; "now" for a live window). */
  origin: number;
  /** A blue playhead (seconds); everything after it is drawn faint, as if not yet written. */
  playhead?: number | null;
  glitches?: Glitch[];
};

/** A timing diagram: one row per channel, a time axis under them. */
export function TimingDiagram({ channels, t0, t1, origin, playhead = null, glitches = [] }: TimingDiagramProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const h = TOP + channels.length * ROW + 24;
  const span = t1 - t0 || 1;
  const x = (t: number) => LABEL_W + ((t - t0) / span) * (W - LABEL_W - 8);
  const step = tickStep(span);
  const ticks: number[] = [];
  for (let k = Math.ceil((t0 - origin) / step); origin + k * step <= t1 + 1e-15; k++) ticks.push(origin + k * step);
  const px = playhead === null ? null : x(Math.min(t1, Math.max(t0, playhead)));
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="td-svg" aria-hidden="true">
      <defs>
        <pattern id={`td-busy${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V5" className="td-hatch" />
        </pattern>
        {px !== null && (
          <clipPath id={`td-written${uid}`}>
            <rect x={0} y={0} width={px} height={h} />
          </clipPath>
        )}
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <path d={`M${x(t)} ${TOP - 2}V${h - 22}`} className="td-grid" />
          <text x={x(t)} y={h - 8} className="td-tick" textAnchor="middle">
            {Math.abs(t - origin) < step / 1000 ? "0" : formatTick(t - origin, step)}
          </text>
        </g>
      ))}
      {channels.map((c, i) => {
        const y0 = TOP + i * ROW;
        const yH = y0 + 6;
        const yL = yH + SWING;
        const shape = traceShape(c.window, t0, t1, 3 / (W - LABEL_W));
        const sx = (f: number) => LABEL_W + f * (W - LABEL_W - 8);
        const d = [
          ...shape.runs.map((r) => `M${sx(r.x0)} ${r.high ? yH : yL}H${sx(r.x1)}`),
          ...shape.edges.map((e) => `M${sx(e)} ${yH}V${yL}`),
        ].join("");
        const trace = (
          <>
            <path d={d} className="td-trace" />
            {shape.busy.map(([a, b], k) => (
              <rect key={k} x={sx(a)} y={yH} width={Math.max(1, sx(b) - sx(a))} height={SWING} className="td-busy" fill={`url(#td-busy${uid})`} />
            ))}
          </>
        );
        return (
          <g key={c.label} className="td-row">
            <text x={4} y={yL - 2} className="td-label">
              {c.label}
            </text>
            <path d={`M${LABEL_W} ${yL + 6}H${W - 8}`} className="td-base" />
            {px === null ? (
              trace
            ) : (
              <>
                <g className="td-faint">{trace}</g>
                <g clipPath={`url(#td-written${uid})`}>{trace}</g>
              </>
            )}
          </g>
        );
      })}
      {glitches.map((g, k) => {
        const row = channels.findIndex((c) => c.label === g.channel);
        if (row < 0) return null;
        const gx = x(g.t + g.width / 2);
        const y = TOP + row * ROW + 2;
        return <path key={k} d={`M${gx - 4} ${y - 4}L${gx + 4} ${y - 4}L${gx} ${y + 2}Z`} className="td-glitch" />;
      })}
      {px !== null && <path d={`M${px} ${TOP - 4}V${h - 20}`} className="td-playhead" />}
    </svg>
  );
}

/** The channels' levels at a time, as a sentence ("START low, U1.3 high"). */
export function levelsAt(channels: DiagramChannel[], t: number): string {
  return channels
    .map((c) => {
      let high = c.window.start;
      for (const [te, d] of c.window.edges) {
        if (te > t) break;
        high = d === 1;
      }
      return `${c.label} ${high ? m.lab.chips.levels.H : m.lab.chips.levels.L}`;
    })
    .join(", ");
}

/** A channel's window from the session: a watched node's exact edges, else the snapshots (LEDs, buttons, unwatched nodes). */
function channelWindow(runtime: LabRuntime, c: TimingChannel, t0: number, t1: number): ChannelWindow {
  const s = runtime.session;
  if ("node" in c) {
    const tr = s.tracks.get(watchKey(s.bench, s.net.netlist, runtime.built.nodes, c.node, c.level));
    if (tr) return windowOf(tr, t0, t1);
    const view = s.view();
    const pts = view.history(`volts:${c.node}`, t1 - t0 + 1);
    const lvl = c.level ?? Math.max(0.5, ...pts.map(([, v]) => v)) / 2;
    return windowFromSamples(pts, t0, t1, lvl);
  }
  const view = s.view();
  const kind = view.benchPart(c.part)?.kind;
  const src = kind === "led" ? `glow:${c.part}` : `closed:${c.part}`;
  return windowFromSamples(view.history(src, t1 - t0 + 1), t0, t1, kind === "led" ? 0.1 : 0.5);
}

export function TimingPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "timing" }> }) {
  useStore(runtime.ui, (s) => s.panels);
  const id = useId();
  const span = cfg.window ?? 2;
  const tv = runtime.session.timingViews[cfg.id];
  const burst = tv?.burst ?? null;
  // Replay: the burst being replayed and when the replay started (performance.now()).
  const [replay, setReplay] = useState<{ burst: Burst; at: number } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [frame, setFrame] = useState(0);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const raf = useRef(0);

  // Live: redraw about ten times a second. Replay: every frame until the playhead reaches the end.
  useEffect(() => {
    let last = 0;
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick);
      if (replay && scrub === null) {
        setFrame(now);
        if (now - replay.at > REPLAY_SECONDS * 1000 + 200) cancelAnimationFrame(raf.current);
        return;
      }
      if (!replay && now - last > 100) {
        last = now;
        setFrame(now);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [replay, scrub]);

  const now = runtime.session.snapshot?.t ?? 0;
  let t0: number;
  let t1: number;
  let origin: number;
  let playhead: number | null = null;
  let glitches: Glitch[] = [];
  if (replay) {
    const b = replay.burst;
    const bspan = Math.max(b.end - b.start, 1e-9);
    const pad = bspan * 0.12;
    t0 = b.start - pad;
    t1 = b.end + pad;
    origin = b.start;
    const progress = reduced ? 1 : Math.min(1, (frame - replay.at) / (REPLAY_SECONDS * 1000));
    playhead = scrub ?? t0 + (t1 - t0) * Math.max(0, progress);
    glitches = b.glitches;
  } else {
    t1 = now;
    t0 = now - span;
    origin = now;
  }
  const channels: DiagramChannel[] = cfg.channels.slice(0, 8).map((c) => ({ label: c.label, window: channelWindow(runtime, c, t0, t1) }));
  const start = () => {
    if (!burst) return;
    runtime.replayTiming(cfg.id);
    setScrub(null);
    setReplay({ burst, at: performance.now() });
  };
  const live = () => {
    setReplay(null);
    setScrub(null);
  };
  const bspan = replay ? replay.burst.end - replay.burst.start : burst ? burst.end - burst.start : 0;
  const factor = replay ? slowFactor(t1 - t0, REPLAY_SECONDS) : 0;
  const summary = replay
    ? m.lab.chips.stateSay(formatSpan((playhead ?? t0) - origin), levelsAt(channels, playhead ?? t0))
    : channels.map((c) => m.lab.chips.channelSay(c.label, c.window.edges.length ? c.window.edges[c.window.edges.length - 1]![1] === 1 : c.window.start, c.window.edges.length)).join(" ");
  return (
    <section className="instrument panel chip-panel td" aria-labelledby={`${id}-t`} data-panel={cfg.id} data-replay={replay ? "on" : undefined}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.chips.timing}
        </h3>
        <span className="instrument__tag">{replay ? m.lab.chips.burstTag(formatSpan(bspan)) : m.lab.chips.windowTag(span)}</span>
      </header>
      <div className="td__sheet" role="img" aria-label={summary}>
        <TimingDiagram channels={channels} t0={t0} t1={t1} origin={origin} playhead={playhead} glitches={glitches} />
      </div>
      {replay && (
        <>
          <p className="td__stretch small">{m.lab.chips.stretch(formatSpan(t1 - t0), factor.toLocaleString("en"))}</p>
          <label className="td__scrub small">
            <span className="sr-only">{m.lab.chips.playhead}</span>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round((((playhead ?? t0) - t0) / (t1 - t0)) * 1000)}
              aria-valuetext={summary}
              onChange={(e) => setScrub(t0 + ((t1 - t0) * Number(e.target.value)) / 1000)}
            />
          </label>
          {glitches.length > 0 && (
            <ul className="td__glitches small">
              {glitches.slice(0, 4).map((g, k) => (
                <li key={k}>
                  <span className="td__glitch-mark" aria-hidden="true" />
                  {m.lab.chips.glitchSay(g.channel, formatSpan(g.width))}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="panel__actions">
        {replay ? (
          <>
            <button type="button" className="btn btn--small btn--primary" onClick={start} disabled={!burst}>
              {m.lab.chips.replay}
            </button>
            <button type="button" className="btn btn--small btn--tertiary" onClick={live}>
              {m.lab.chips.backLive}
            </button>
          </>
        ) : burst ? (
          <>
            <button type="button" className="btn btn--small btn--soft" onClick={start} data-timing-replay>
              {m.lab.chips.slow}
            </button>
            <span className="small muted">{m.lab.chips.burstTag(formatSpan(bspan))}</span>
          </>
        ) : (
          <span className="small muted">{m.lab.chips.waiting}</span>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {replay && glitches.length ? glitches.map((g) => m.lab.chips.glitchSay(g.channel, formatSpan(g.width))).join(" ") : ""}
      </p>
    </section>
  );
}
