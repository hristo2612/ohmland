import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = { id: string; label: ReactNode; panel: ReactNode };

/**
 * Accessible tabs (WAI-ARIA tabs pattern): arrow keys move between tabs with automatic activation, Home and End jump,
 * only the selected tab is in the Tab order.
 */
export function Tabs({ items, value, onChange, label }: { items: TabItem[]; value: string; onChange(id: string): void; label: string }) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, items.findIndex((t) => t.id === value));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    const item = items[next];
    if (!item) return;
    onChange(item.id);
    refs.current[next]?.focus();
  };

  const current = items[index];
  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={label}>
        {items.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            className="tabs__tab"
            aria-selected={i === index}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={onKey}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current && (
        <div className="tabs__panel" role="tabpanel" id={`${base}-panel-${current.id}`} aria-labelledby={`${base}-tab-${current.id}`} tabIndex={0}>
          {current.panel}
        </div>
      )}
    </div>
  );
}
