import { useEffect, useId, useRef, useState } from "react";
import { onSignInChange, signedIn } from "../account/device";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { ACHIEVEMENTS } from "../progress/achievements";
import { applyPrefs } from "../progress/prefs";
import { useDerived, useLearner, useLearnerReady } from "../progress/useLearner";
import type { Settings } from "../progress/types";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import type { NavId } from "./nav";
import { ProgressBar } from "./ProgressBar";

const THEMES: { id: Settings["theme"]; label: string }[] = [
  { id: "system", label: m.theme.short.system },
  { id: "light", label: m.theme.short.light },
  { id: "dark", label: m.theme.short.dark },
];

/**
 * Your notebook: the level and XP, small and quiet, and behind them the one menu for everything that is not Learn or
 * Isle (parts, achievements, the free bench, the account and the page's theme). In the header it opens from the XP
 * chip; on a phone it is the bottom bar's third tab and opens upwards.
 */
export function NotebookMenu({ outline, place = "header", active }: { outline: CourseOutline; place?: "header" | "bar"; active?: NavId | undefined }) {
  const ready = useLearnerReady(outline);
  const { level, parts } = useDerived(outline);
  const unlocked = useLearner((s) => s.learner.achievements);
  const theme = useLearner((s) => s.learner.settings.theme);
  const reducedMotion = useLearner((s) => s.learner.settings.reducedMotion);
  const status = useLearner((s) => s.sync.status);
  const [signed, setSigned] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const viaKeyboard = useRef(false);

  useEffect(() => {
    setSigned(signedIn());
    return onSignInChange(setSigned);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (viaKeyboard.current) firstLink.current?.focus();
    const onDoc = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (id: Settings["theme"]) => {
    applyPrefs({ theme: id, reducedMotion });
    void useLearner
      .getState()
      .init()
      .then(() => useLearner.getState().setSettings({ theme: id }));
  };

  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const links: { id: NavId; href: string; icon: IconName; label: string; meta?: string }[] = [
    { id: "parts", href: "/parts", icon: "parts", label: m.nav.menu.parts, ...(ready ? { meta: String(parts.length) } : {}) },
    { id: "achievements", href: "/achievements", icon: "trophy", label: m.nav.menu.achievements, ...(ready ? { meta: String(count) } : {}) },
    { id: "bench", href: "/bench", icon: "bench", label: m.nav.menu.bench },
    { id: "account", href: "/account", icon: "user", label: signed ? m.nav.menu.account : m.nav.menu.signIn, ...(signed ? { meta: m.account.status[status] ?? "" } : {}) },
  ];
  const chipLabel = [ready ? m.level.chipLabel(level.level, level.title, level.xp) : m.nav.notebook, signed && m.nav.signedIn(m.account.status[status] ?? "")]
    .filter(Boolean)
    .join(". ");
  const toggle = (keyboard: boolean) => {
    viaKeyboard.current = keyboard;
    setOpen((o) => !o);
  };
  const inside = active === "parts" || active === "achievements" || active === "bench" || active === "account";

  return (
    <div className="nb" ref={wrap}>
      {place === "header" ? (
        <button
          ref={trigger}
          type="button"
          className={ready ? "xp-chip" : "xp-chip xp-chip--loading"}
          aria-label={chipLabel}
          aria-expanded={open}
          aria-controls={panelId}
          data-level={ready ? level.level : undefined}
          onClick={(e) => toggle(e.detail === 0)}
        >
          {ready && (
            <>
              <span className="xp-chip__lvl" aria-hidden="true">
                {m.level.short(level.level)}
              </span>
              <span className="xp-chip__pts" aria-hidden="true">
                {m.common.xp(level.xp)}
              </span>
              <Icon name="chevron-down" size={16} className="xp-chip__more" />
              <span className="xp-chip__bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${level.ratio})` }} />
              </span>
            </>
          )}
          {signed && <span className="sync-dot" data-status={status} aria-hidden="true" />}
        </button>
      ) : (
        <button
          ref={trigger}
          type="button"
          className="bottom-nav__link"
          aria-expanded={open}
          aria-controls={panelId}
          aria-current={inside ? "page" : undefined}
          onClick={(e) => toggle(e.detail === 0)}
        >
          <Icon name="notebook" size={22} />
          <span>{m.nav.notebook}</span>
          {signed && <span className="sync-dot" data-status={status} aria-hidden="true" />}
        </button>
      )}

      {open && (
        <div className="nb__panel" id={panelId}>
          {ready && (
            <div className="nb__level">
              <p className="nb__level-top">
                <span className="nb__level-name">{m.finale.level(level.level, level.title)}</span>
                <span className="nb__level-xp">{m.common.xp(level.xp)}</span>
              </p>
              <ProgressBar value={level.ratio} label={m.level.long(level.level)} valueText={`${level.into} / ${level.span} XP`} />
              <p className="small muted">{m.level.toNext(level.next - level.xp)}</p>
            </div>
          )}
          <ul className="nb__links">
            {links.map((l, i) => (
              <li key={l.id}>
                <a ref={i === 0 ? firstLink : undefined} className="nb__link" href={l.href} aria-current={active === l.id ? "page" : undefined}>
                  <Icon name={l.icon} size={20} />
                  <span>{l.label}</span>
                  {l.meta !== undefined && <span className="nb__link-meta">{l.meta}</span>}
                </a>
              </li>
            ))}
          </ul>
          <div className="nb__theme">
            <p className="kicker" id={`${panelId}-theme`}>
              {m.theme.label}
            </p>
            <div
              className="nb__theme-row"
              role="radiogroup"
              aria-labelledby={`${panelId}-theme`}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const i = Math.max(0, THEMES.findIndex((t) => t.id === theme));
                const next = THEMES[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : THEMES.length - 1)) % THEMES.length]!;
                choose(next.id);
                (e.currentTarget.querySelector(`[data-theme-opt="${next.id}"]`) as HTMLElement | null)?.focus();
              }}
            >
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  tabIndex={theme === t.id ? 0 : -1}
                  data-theme-opt={t.id}
                  className="nb__theme-opt"
                  onClick={() => choose(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
