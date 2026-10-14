/**
 * Two paper slips for the tool dock: the resistor colour code as real text (it never shrinks with the bench), and a
 * table of readings that writes itself from the numbers the learner types, with a column that grows for multiplying.
 */
import { useId } from "react";
import { useStore } from "zustand";
import { DIGIT_COLORS } from "@ohmland/bench/core";
import { m } from "../i18n";
import type { PanelConfig } from "./define";
import type { LabRuntime } from "./runtime";
import "./slips.css";

/** Gold and silver: what they do in third place (divide) and on the right (the tolerance). */
const METALS = [
  { color: "gold", third: "÷10", right: "±5%" },
  { color: "silver", third: "÷100", right: "±10%" },
] as const;

export function ChartPanel({ cfg }: { cfg: Extract<PanelConfig, { kind: "chart" }> }) {
  const id = useId();
  const t = m.lab.panels;
  return (
    <section className="instrument panel slip-chart" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? t.chart}
        </h3>
      </header>
      <ul className="slip-chart__grid">
        {DIGIT_COLORS.map((color, digit) => (
          <li key={color} className="slip-chart__cell" aria-label={t.chartDigit(t.bands[color] ?? color, digit)}>
            <span className="slip-chart__swatch" data-band={color} aria-hidden="true" />
            <span className="slip-chart__n" aria-hidden="true">
              {digit}
            </span>
            <span className="slip-chart__name" aria-hidden="true">
              {t.bands[color] ?? color}
            </span>
          </li>
        ))}
        {METALS.map((mt) => (
          <li key={mt.color} className="slip-chart__cell slip-chart__cell--metal" aria-label={t.chartMetal(t.bands[mt.color] ?? mt.color, mt.third, mt.right)}>
            <span className="slip-chart__swatch" data-band={mt.color} aria-hidden="true" />
            <span className="slip-chart__n" aria-hidden="true">
              {mt.third}
            </span>
            <span className="slip-chart__name" aria-hidden="true">
              {t.bands[mt.color] ?? mt.color}
            </span>
          </li>
        ))}
      </ul>
      <p className="small muted slip-chart__key">{t.chartKey}</p>
    </section>
  );
}

/** A number as the slip writes it: three significant figures, no trailing zeros. */
const show = (x: number) => String(Number(x.toPrecision(3)));

export function ReadingsPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "readings" }> }) {
  const id = useId();
  const t = m.lab.panels;
  useStore(runtime.ui, (s) => s.panels);
  const status = useStore(runtime.ui, (s) => s.status);
  const state = runtime.session.panels[cfg.id];
  const notes = runtime.session.notes;
  // The product column grows once the multiplying task is the current one (or done).
  const current = runtime.lab.tasks.find((x) => !x.optional && !x.bonus && status[x.id] === "todo")?.id;
  const grown = status[cfg.multiply] !== "todo" || current === cfg.multiply;
  return (
    <section className="instrument panel slip-readings" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? t.readings}
        </h3>
      </header>
      <table className="panel__table slip-readings__table">
        <thead>
          <tr>
            <th scope="col">{cfg.heads[0]}</th>
            <th scope="col">{cfg.heads[1]}</th>
            {grown && <th scope="col">{cfg.heads[2]}</th>}
          </tr>
        </thead>
        <tbody>
          {cfg.rows.map((row, i) => {
            const v = notes[row.note];
            const has = typeof v === "number" && Number.isFinite(v);
            const done = !!state?.cells[`r${i + 1}`];
            return (
              <tr key={row.note}>
                <th scope="row">{row.label}</th>
                <td className="slip-readings__n">{has ? show(v) : <span className="muted">{t.notYet}</span>}</td>
                {grown && (
                  <td className="slip-readings__n">
                    {done ? (
                      has ? (
                        <span className="slip-readings__product">{show(v * row.by)}</span>
                      ) : (
                        <span className="muted">{t.notYet}</span>
                      )
                    ) : (
                      <button type="button" className="btn btn--small btn--secondary slip-readings__times" onClick={() => runtime.answerPanel(cfg.id, { row: i + 1 })} aria-label={t.multiplyRow(row.label)} data-row={i + 1}>
                        {t.multiply}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
