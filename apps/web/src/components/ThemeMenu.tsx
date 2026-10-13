import { useEffect, useId, useRef, useState } from "react";
import { m } from "../i18n";
import { applyPrefs } from "../progress/prefs";
import { useLearner } from "../progress/store";
import type { Settings } from "../progress/types";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

const CHOICES: { id: Settings["theme"]; icon: IconName; label: string }[] = [
  { id: "system", icon: "monitor", label: m.theme.system },
  { id: "light", icon: "sun", label: m.theme.light },
  { id: "dark", icon: "moon", label: m.theme.dark },
];

/** Theme picker: a disclosure button with three radio items. Arrow keys move, Escape closes. */
export function ThemeMenu() {
  const theme = useLearner((s) => s.learner.settings.theme);
  const reducedMotion = useLearner((s) => s.learner.settings.reducedMotion);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, CHOICES.findIndex((c) => c.id === theme));
    items.current[i]?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, theme]);

  const choose = (id: Settings["theme"]) => {
    applyPrefs({ theme: id, reducedMotion });
    void useLearner
      .getState()
      .init()
      .then(() => useLearner.getState().setSettings({ theme: id }));
    setOpen(false);
    button.current?.focus();
  };

  const current = CHOICES.find((c) => c.id === theme) ?? CHOICES[0]!;
  return (
    <div className="theme-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="icon-btn"
        aria-label={`${m.theme.label}: ${current.label}`}
        title={m.theme.label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon name={current.icon} />
      </button>
      {open && (
        <div
          id={menuId}
          className="theme-menu__list"
          role="radiogroup"
          aria-label={m.theme.menu}
          onKeyDown={(e) => {
            const idx = items.current.findIndex((el) => el === document.activeElement);
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              button.current?.focus();
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = (idx + (e.key === "ArrowDown" ? 1 : CHOICES.length - 1)) % CHOICES.length;
              items.current[n]?.focus();
            } else if (e.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          {CHOICES.map((c, i) => (
            <button
              key={c.id}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={c.id === theme}
              tabIndex={c.id === theme ? 0 : -1}
              className="theme-menu__item"
              onClick={() => choose(c.id)}
            >
              <Icon name={c.icon} size={18} />
              <span>{c.label}</span>
              <Icon name="check" size={18} className="theme-menu__check" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
