import { useEffect, useRef, useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IsleArt } from "../components/IsleArt";
import { ProgressBar } from "../components/ProgressBar";
import { m } from "../i18n";
import { Mascot } from "../mascot/Mascot";
import { PartIcon } from "../parts/PartIcon";
import { prefersReducedMotion } from "../progress/prefs";
import type { Completion } from "../progress/store";
import { XP } from "../progress/xp";
import type { PartInfo, PlayerProps } from "./types";

/** Counts from 0 to `to` with an ease-out, or jumps straight there under reduced motion. */
function useCountUp(to: number, ms: number, delay: number): number {
  const [n, setN] = useState(() => (prefersReducedMotion() ? to : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setN(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay]);
  return n;
}

type FinaleProps = {
  completion: Completion;
  lesson: PlayerProps["lesson"];
  parts: Record<string, PartInfo>;
  module: PlayerProps["module"];
  next: PlayerProps["next"];
  mapHref: string;
  firstTry: number;
  items: number;
};

export function Finale({ completion, lesson, parts, module, next, mapHref, firstTry, items }: FinaleProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const reduced = prefersReducedMotion();
  const { gained, levelBefore, levelAfter } = completion;
  const xp = useCountUp(gained.total, 1200, 450);
  const levelUp = levelAfter.level > levelBefore.level;
  const [filled, setFilled] = useState(reduced);

  useEffect(() => {
    heading.current?.focus();
    if (reduced) return;
    const t = setTimeout(() => setFilled(true), 700);
    return () => clearTimeout(t);
  }, [reduced]);

  const achievementXp = gained.achievements.reduce((s, a) => s + a.xp, 0);
  const lines: { label: string; xp: number }[] = [];
  if (gained.lesson) lines.push({ label: m.finale.breakdown.lesson, xp: gained.lesson });
  if (gained.firstTry) lines.push({ label: completion.replay ? m.finale.breakdown.replay : m.finale.breakdown.firstTry(firstTry, items), xp: gained.firstTry });
  if (gained.tasks) lines.push({ label: m.finale.breakdown.tasks(gained.tasks / XP.task), xp: gained.tasks });
  for (const _ of gained.modules) lines.push({ label: m.finale.breakdown.module(module.title), xp: XP.module });
  if (achievementXp) lines.push({ label: m.finale.breakdown.achievements, xp: achievementXp });

  const barFrom = levelUp ? 0 : levelBefore.ratio;
  const barTo = filled ? levelAfter.ratio : barFrom;
  const newParts = completion.newParts.map((id) => parts[id]).filter((p): p is PartInfo => !!p);

  return (
    <>
    <section className="finale" data-finale aria-labelledby="finale-title">
      <div className="finale__hero">
        {!reduced && (
          <div className="sparks" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="sparks__spark" style={{ ["--a" as string]: `${(i * 360) / 14}deg`, ["--d" as string]: `${i % 3}` }} />
            ))}
          </div>
        )}
        <Mascot pose="celebrate" size={128} />
        <p className="step-eyebrow">{lesson.title}</p>
        <h1 id="finale-title" className="finale__title" ref={heading} tabIndex={-1}>
          {completion.replay ? m.finale.titleReplay : m.finale.title}
        </h1>
        {completion.replay && <p className="muted small">{m.finale.replayNote}</p>}
      </div>

      <div className="finale__grid">
        <div className="finale-card finale-card--xp">
          <p className="finale-card__label">{m.finale.xpEarned}</p>
          <p className="finale__xp mono" aria-live="off" data-xp={gained.total}>
            {m.common.plusXp(xp)}
          </p>
          <span className="sr-only">{m.common.plusXp(gained.total)}</span>
          {lines.length > 0 && (
            <ul className="finale__lines">
              {lines.map((l, i) => (
                <li key={i} style={{ ["--i" as string]: i }}>
                  <span>{l.label}</span>
                  <span className="mono">{m.common.plusXp(l.xp)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="finale__level">
            <div className="finale__level-row">
              <span className="finale__level-badge mono">{levelAfter.level}</span>
              <div>
                <p className="finale__level-title">{m.finale.level(levelAfter.level, levelAfter.title)}</p>
                <p className="small muted">{m.finale.toNext(levelAfter.next - levelAfter.xp, levelAfter.level + 1)}</p>
              </div>
            </div>
            <ProgressBar value={barTo} from={barFrom} label={m.finale.level(levelAfter.level, levelAfter.title)} valueText={`${levelAfter.into} / ${levelAfter.span} XP`} size="thick" />
            {levelUp && (
              <p className="finale__levelup" role="status">
                <Icon name="star" size={18} />
                {m.finale.levelUp(levelAfter.level)}
              </p>
            )}
          </div>
        </div>

        <div className="finale__side">
          {newParts.length > 0 && (
            <div className="finale-card">
              <p className="finale-card__label">{m.finale.partsTitle}</p>
              <ul className="finale__parts">
                {newParts.map((p, i) => (
                  <li key={p.id} style={{ ["--i" as string]: i }}>
                    <span className="finale__part-icon">
                      <PartIcon kind={p.icon} size={48} />
                    </span>
                    <span>{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gained.achievements.length > 0 && (
            <div className="finale-card">
              <p className="finale-card__label">{m.finale.achievementsTitle}</p>
              <ul className="finale__achievements">
                {gained.achievements.map((a) => (
                  <li key={a.id}>
                    <span className="finale__ach-icon">
                      <Icon name={a.icon} size={22} />
                    </span>
                    <span>
                      <strong>{a.title}</strong>
                      <span className="small muted">{a.description}</span>
                    </span>
                    <Badge tone="accent">{m.common.plusXp(a.xp)}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a className="finale-card finale-isle" href="/isle">
            <IsleArt className="finale-isle__art" />
            <div>
              <p className="finale-card__label">{m.finale.isleTitle}</p>
              <p className="small muted">{m.finale.isleBodyGeneric}</p>
              <span className="finale-isle__cta">
                {m.finale.isleCta}
                <Icon name="arrow-right" size={16} />
              </span>
            </div>
          </a>
        </div>
      </div>

    </section>
      <div className="step-actions">
        <div className="step-actions__inner">
          <div className="step-actions__start">
            {next && (
              <Button variant="tertiary" href={mapHref} icon="learn">
                {m.finale.toMap}
              </Button>
            )}
          </div>
          <div className="step-actions__end">
            {next ? (
              <Button variant="primary" size="large" href={next.href} iconEnd="arrow-right" data-primary>
                {m.finale.next}
              </Button>
            ) : (
              <Button variant="primary" size="large" href={mapHref} iconEnd="arrow-right" data-primary>
                {m.finale.toMap}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
