import { useRef, type KeyboardEvent } from "react";
import type { HotspotItem as HotspotItemT } from "../content/schema";
import { m } from "../i18n";
import { FIGURES } from "./figures/figures";
import type { ItemViewProps } from "./types";

/**
 * Tap the right spot on a figure. The regions form a radio group: Tab reaches the group, arrow keys move between
 * regions, Space or Enter selects.
 */
export function HotspotItem({ item, value, onChange, locked, reveal, outcome, announce }: ItemViewProps<string, HotspotItemT>) {
  const fig = FIGURES[item.figure];
  const labels = m.figures[item.figure].regions;
  const ids = Object.keys(fig.regions);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const answers = Array.isArray(item.answer) ? item.answer : [item.answer];
  const focusIndex = Math.max(0, value ? ids.indexOf(value) : 0);

  const select = (id: string) => {
    if (locked) return;
    onChange(id);
    announce(m.quiz.hotspot.picked(labels[id] ?? id));
  };

  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : ids.length - 1)) % ids.length;
      refs.current[next]?.focus();
      const id = ids[next];
      if (id) select(id);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const id = ids[i];
      if (id) select(id);
    }
  };

  return (
    <div className="hotspot">
      <p className="quiz-instructions">{m.quiz.hotspot.instructions}</p>
      <div className="hotspot__stage">
        <svg className="hotspot__figure" viewBox={fig.viewBox} role="radiogroup" aria-label={m.figures[item.figure].label}>
          <g aria-hidden="true">{fig.art}</g>
          {ids.map((id, i) => {
            const picked = value === id;
            const state = reveal && answers.includes(id) ? "right" : outcome && !outcome.correct && picked ? "wrong" : picked ? "picked" : undefined;
            return (
              <g
                key={id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className="hotspot__region"
                role="radio"
                aria-checked={picked}
                aria-label={labels[id] ?? id}
                aria-disabled={locked || undefined}
                tabIndex={i === focusIndex ? 0 : -1}
                data-region={id}
                data-state={state}
                onClick={() => select(id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {fig.regions[id]}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="hotspot__picked small" aria-hidden="true">
        {value ? m.quiz.hotspot.picked(labels[value] ?? value) : " "}
      </p>
    </div>
  );
}
