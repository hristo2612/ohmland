import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { OrderItem as OrderItemT } from "../content/schema";
import { Icon } from "../components/Icon";
import { m } from "../i18n";
import { shuffledIndices } from "../lib/shuffle";
import { plainText } from "../lib/text";
import type { ItemViewProps } from "./types";

/**
 * Put steps in order: drag a row by its handle (mouse or touch), or use the up and down buttons (keyboard). The value
 * is the list of original indices in the order shown.
 */
export function OrderItem({ item, value, onChange, locked, reveal, outcome, announce }: ItemViewProps<number[], OrderItemT>) {
  const initial = useMemo(() => shuffledIndices(item.items.length, item.id, true), [item]);
  const order = value ?? initial;
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; dy: number; startY: number; height: number } | null>(null);

  // Make the shuffled order the answer value from the start, so it can be checked as is.
  useEffect(() => {
    if (!value) onChange(initial);
  }, [value, initial, onChange]);

  const move = (pos: number, delta: number) => {
    const to = pos + delta;
    if (locked || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[pos], next[to]] = [next[to] as number, next[pos] as number];
    onChange(next);
    const label = plainText(item.items[next[to] as number] ?? "");
    announce(m.quiz.order.moved(label, to + 1, next.length));
    requestAnimationFrame(() => {
      const btn = listRef.current?.querySelectorAll<HTMLButtonElement>(`[data-move="${delta < 0 ? "up" : "down"}"]`)[to];
      if (btn && !btn.disabled) btn.focus();
      else listRef.current?.querySelectorAll<HTMLButtonElement>("[data-move]")[to * 2 + (delta < 0 ? 1 : 0)]?.focus();
    });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, pos: number) => {
    if (locked) return;
    const row = (e.currentTarget.closest("[data-order-item]") as HTMLElement | null) ?? e.currentTarget;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: pos, dy: 0, startY: e.clientY, height: row.getBoundingClientRect().height + 8 });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    let dy = e.clientY - drag.startY;
    let from = drag.from;
    let startY = drag.startY;
    // Swap with a neighbour once the row is dragged past half of it.
    if (dy > drag.height / 2 && from < order.length - 1) {
      const next = [...order];
      [next[from], next[from + 1]] = [next[from + 1] as number, next[from] as number];
      onChange(next);
      from += 1;
      startY += drag.height;
      dy -= drag.height;
    } else if (dy < -drag.height / 2 && from > 0) {
      const next = [...order];
      [next[from], next[from - 1]] = [next[from - 1] as number, next[from] as number];
      onChange(next);
      from -= 1;
      startY -= drag.height;
      dy += drag.height;
    }
    setDrag({ ...drag, from, startY, dy });
  };
  const onPointerUp = () => setDrag(null);

  return (
    <div className="order">
      <p className="quiz-instructions">{m.quiz.order.instructions}</p>
      <ol className="order__list" ref={listRef}>
        {order.map((orig, pos) => {
          const html = item.items[orig] ?? "";
          const label = plainText(html);
          const inPlace = orig === pos;
          const state = reveal ? "right" : outcome && !outcome.correct ? (inPlace ? "in-place" : "wrong") : undefined;
          const dragging = drag?.from === pos;
          return (
            <li
              key={orig}
              className="order__item"
              data-order-item
              data-key={orig}
              data-state={state}
              data-dragging={dragging || undefined}
              style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              <span
                className="order__handle"
                aria-hidden="true"
                title={m.quiz.order.grab}
                onPointerDown={(e) => onPointerDown(e, pos)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <Icon name="grip" size={20} strokeWidth={3} />
              </span>
              <span className="order__pos mono" aria-hidden="true">
                {pos + 1}
              </span>
              <span className="order__text" dangerouslySetInnerHTML={{ __html: html }} />
              <span className="order__moves">
                <button type="button" className="icon-btn icon-btn--small" data-move="up" aria-label={m.quiz.order.moveUp(label)} disabled={locked || pos === 0} onClick={() => move(pos, -1)}>
                  <Icon name="chevron-up" size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--small"
                  data-move="down"
                  aria-label={m.quiz.order.moveDown(label)}
                  disabled={locked || pos === order.length - 1}
                  onClick={() => move(pos, 1)}
                >
                  <Icon name="chevron-down" size={18} />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
