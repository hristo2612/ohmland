/**
 * The dice histogram: every roll tallied as pencil bars, with the band a fair die's counts stay inside (about 19
 * times in 20). One die shows its faces; two dice their sums, or all 36 pairs as a grid. The auto-roller presses the
 * ROLL button for the learner, and a thousand rolls are sampled from one recorded lap of the running dice.
 *
 * HistogramChart and PairGrid are pure; HistogramPanel connects them to the session.
 */
import { useId, useState } from "react";
import { useStore } from "zustand";
import { m } from "../i18n";
import type { PanelConfig } from "./define";
import type { LabRuntime } from "./runtime";
import { fairBand, sumChance, tallyOf, type Tally } from "./signals";
import "./chip-panels.css";

const W = 400;
const H = 190;
const PAD = { l: 34, r: 8, t: 16, b: 30 };

export type Bar = { label: string; count: number; lo: number; hi: number };

/** The bars to draw: faces 1 to 6 (and blank faces, if any) for one die; sums 2 to 12 for two. */
export function barsOf(tally: Tally, dice: number): Bar[] {
  const n = tally.rolls;
  if (dice === 1) {
    const out: Bar[] = [];
    if (tally.faces["0"]) out.push({ label: "0", count: tally.faces["0"], lo: 0, hi: 0 });
    for (let f = 1; f <= 6; f++) {
      const b = fairBand(n, 1 / 6);
      out.push({ label: String(f), count: tally.faces[String(f)] ?? 0, lo: b.lo, hi: b.hi });
    }
    return out;
  }
  return Array.from({ length: 11 }, (_, k) => {
    const sum = k + 2;
    const b = fairBand(n, sumChance(sum));
    return { label: String(sum), count: tally.sums[String(sum)] ?? 0, lo: b.lo, hi: b.hi };
  });
}

/** Bars outside their fair band (with enough rolls to tell: an expected count of at least 5 per bar). */
export function unfairBars(bars: Bar[], rolls: number, dice: number): Bar[] {
  const minP = dice === 1 ? 1 / 6 : 1 / 36;
  if (rolls * minP < 5) return [];
  return bars.filter((b) => b.hi > 0 && (b.count < b.lo || b.count > b.hi));
}

/** Pencil bars with each bar's fair band shaded behind it. */
export function HistogramChart({ bars }: { bars: Bar[] }) {
  // A round top for the axis, just above the tallest bar or band (or 4).
  const top = Math.max(4, ...bars.map((b) => Math.max(b.count, b.hi)));
  const p = 10 ** Math.floor(Math.log10(top));
  const max = [1, 1.2, 1.6, 2, 3, 4, 5, 6, 8, 10].map((f) => Math.round(f * p)).find((v) => v >= top) ?? 10 * p;
  const step = (W - PAD.l - PAD.r) / bars.length;
  const bw = Math.min(34, step * 0.62);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const ticks = [0, max / 2, max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="hg-svg" aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <path d={`M${PAD.l} ${y(t)}H${W - PAD.r}`} className="hg-grid" />
          <text x={PAD.l - 6} y={y(t) + 4} className="hg-tick" textAnchor="end">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = PAD.l + step * (i + 0.5);
        const out = b.hi > 0 && (b.count < b.lo || b.count > b.hi);
        return (
          <g key={b.label} className="hg-bar" data-out={out || undefined}>
            {b.hi > 0 && <rect x={cx - step * 0.46} y={y(b.hi)} width={step * 0.92} height={Math.max(1, y(b.lo) - y(b.hi))} className="hg-band" />}
            <rect x={cx - bw / 2} y={y(b.count)} width={bw} height={Math.max(0, H - PAD.b - y(b.count))} className="hg-fill" />
            {b.count > 0 && (
              <text x={cx} y={y(b.count) - 4} className="hg-count" textAnchor="middle">
                {b.count}
              </text>
            )}
            <text x={cx} y={H - PAD.b + 18} className="hg-face" textAnchor="middle">
              {m.lab.chips.faceLabel(b.label)}
            </text>
          </g>
        );
      })}
      <path d={`M${PAD.l} ${H - PAD.b}H${W - PAD.r}`} className="hg-axis" />
    </svg>
  );
}

/** All 36 pairs of two dice as a grid: die one across, die two down, each cell's count (red pencil outside the band). */
export function PairGrid({ tally }: { tally: Tally }) {
  const band = fairBand(tally.rolls, 1 / 36);
  const enough = tally.rolls / 36 >= 5;
  const cell = 34;
  const x0 = 40;
  const y0 = 22;
  return (
    <svg viewBox={`0 0 ${x0 + cell * 6 + 8} ${y0 + cell * 6 + 8}`} className="hg-svg hg-pairs" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((a) => (
        <text key={`a${a}`} x={x0 + cell * (a - 0.5)} y={y0 - 8} className="hg-face" textAnchor="middle">
          {a}
        </text>
      ))}
      {[1, 2, 3, 4, 5, 6].map((b) => (
        <text key={`b${b}`} x={x0 - 10} y={y0 + cell * (b - 0.5) + 4} className="hg-face" textAnchor="end">
          {b}
        </text>
      ))}
      {[1, 2, 3, 4, 5, 6].flatMap((a) =>
        [1, 2, 3, 4, 5, 6].map((b) => {
          const n = tally.pairs[`${a}-${b}`] ?? 0;
          const out = enough && (n < band.lo || n > band.hi);
          return (
            <g key={`${a}-${b}`} data-out={out || undefined} className="hg-cell">
              <rect x={x0 + cell * (a - 1)} y={y0 + cell * (b - 1)} width={cell} height={cell} className="hg-cellbox" style={{ opacity: tally.rolls ? 0.15 + 0.85 * Math.min(1, n / Math.max(1, band.hi)) : 0.15 }} />
              <text x={x0 + cell * (a - 0.5)} y={y0 + cell * (b - 0.5) + 4} className="hg-count" textAnchor="middle">
                {n || ""}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}

const CHOICES = [10, 100, 1000];

export function HistogramPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "histogram" }> }) {
  useStore(runtime.ui, (s) => s.panels);
  const id = useId();
  const st = runtime.session.rolls[cfg.id];
  const list = st?.list ?? [];
  const tally = tallyOf(list);
  const dice = cfg.dice.length || 1;
  const [view, setView] = useState<"bars" | "pairs">("bars");
  const [times, setTimes] = useState(cfg.rolls && CHOICES.includes(cfg.rolls) ? cfg.rolls : 100);
  const bars = barsOf(tally, dice);
  const out = unfairBars(bars, tally.rolls, dice);
  const rolling = !!st?.roller;
  const fast = runtime.rollingFast === cfg.id;
  const go = () => {
    // A thousand rolls one by one would take a quarter of an hour: sample them from a recorded lap instead.
    if (times >= 500 && !cfg.read) void runtime.fastRolls(cfg.id, times);
    else runtime.roll(cfg.id, times);
  };
  const enough = tally.rolls * (dice === 1 ? 1 / 6 : 1 / 36) >= 5;
  const verdict = !enough ? m.lab.chips.tooFew : out.length ? m.lab.chips.fairOut(out.map((b) => m.lab.chips.faceLabel(b.label)).join(", ")) : m.lab.chips.fairAll;
  const label = bars.map((b) => m.lab.chips.barSay(m.lab.chips.faceLabel(b.label), b.count, Math.round(b.lo), Math.round(b.hi))).join("; ");
  return (
    <section className="instrument panel chip-panel hg" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.chips.dice}
        </h3>
        <span className="instrument__tag" data-rolls={tally.rolls}>
          {m.lab.chips.rollsTag(tally.rolls)}
        </span>
      </header>
      {dice > 1 && (
        <div className="panel__seg" role="radiogroup" aria-label={m.lab.chips.dice}>
          {(["bars", "pairs"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className="panel__segbtn" onClick={() => setView(v)}>
              {v === "bars" ? m.lab.chips.sumsTitle : m.lab.chips.pairsTitle}
            </button>
          ))}
        </div>
      )}
      {tally.rolls === 0 ? (
        <p className="small muted">{m.lab.chips.noRolls}</p>
      ) : (
        <div className="hg__sheet" role="img" aria-label={label}>
          {view === "pairs" && dice > 1 ? <PairGrid tally={tally} /> : <HistogramChart bars={bars} />}
        </div>
      )}
      {tally.rolls > 0 && (
        <p className="small hg__verdict" data-out={out.length ? true : undefined}>
          <span className="hg__swatch" aria-hidden="true" />
          {m.lab.chips.fairBand}: {verdict}
        </p>
      )}
      {st && st.sampled > 0 && <p className="small muted">{m.lab.chips.sampled(st.sampled.toLocaleString("en"))}</p>}
      <div className="panel__actions">
        {rolling || fast ? (
          <>
            <span className="small" role="status">
              {fast ? m.lab.chips.sampling : m.lab.chips.rolling(st?.roller?.left ?? 0)}
            </span>
            {rolling && (
              <button type="button" className="btn btn--small btn--tertiary" onClick={() => runtime.roll(cfg.id, 0)}>
                {m.lab.chips.stop}
              </button>
            )}
          </>
        ) : (
          <>
            <label className="small hg__times">
              <span className="sr-only">{m.lab.chips.rollFor}</span>
              <select className="select select--small" value={times} onChange={(e) => setTimes(Number(e.target.value))}>
                {CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {m.lab.chips.times(n.toLocaleString("en"))}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn--small btn--primary" onClick={go} data-roll>
              {m.lab.chips.rollFor}
            </button>
            {tally.rolls > 0 && (
              <button type="button" className="btn btn--small btn--tertiary" onClick={() => runtime.clearRolls(cfg.id)}>
                {m.lab.chips.clear}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
