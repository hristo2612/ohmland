import { useId, useMemo } from "react";
import type { ChoiceItem as ChoiceItemT } from "../content/schema";
import { Icon } from "../components/Icon";
import { m } from "../i18n";
import { shuffledIndices } from "../lib/shuffle";
import type { ItemViewProps } from "./types";

export function ChoiceItem({ item, value, onChange, locked, outcome, reveal }: ItemViewProps<number[], ChoiceItemT>) {
  const name = useId();
  const multi = item.multi ?? item.options.filter((o) => o.correct).length > 1;
  const order = useMemo(() => (item.shuffle ? shuffledIndices(item.options.length, item.id) : item.options.map((_, i) => i)), [item]);
  const picked = value ?? [];
  const wrong = new Set(outcome?.wrong ?? []);

  const toggle = (i: number) => {
    if (locked) return;
    if (multi) onChange(picked.includes(i) ? picked.filter((p) => p !== i) : [...picked, i]);
    else onChange([i]);
  };

  return (
    <fieldset className="choice" disabled={locked}>
      <legend className="quiz-instructions">{multi ? m.quiz.multi : m.quiz.single}</legend>
      {order.map((i) => {
        const o = item.options[i];
        if (!o) return null;
        const isPicked = picked.includes(i);
        const state = reveal && o.correct ? "right" : wrong.has(i) ? "wrong" : isPicked ? "picked" : "idle";
        const showWhy = (reveal && (isPicked || o.correct)) || wrong.has(i);
        return (
          <label key={i} className="choice__option" data-state={state} data-option>
            <input
              type={multi ? "checkbox" : "radio"}
              name={name}
              className="choice__input"
              checked={isPicked}
              onChange={() => toggle(i)}
            />
            <span className="choice__mark" aria-hidden="true">
              {state === "right" ? <Icon name="check" size={16} strokeWidth={2.5} /> : state === "wrong" ? <Icon name="close" size={16} strokeWidth={2.5} /> : null}
            </span>
            <span className="choice__text">
              <span dangerouslySetInnerHTML={{ __html: o.text }} />
              {showWhy && <span className="choice__why" dangerouslySetInnerHTML={{ __html: o.why }} />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
