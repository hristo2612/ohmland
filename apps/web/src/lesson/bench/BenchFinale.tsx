/**
 * The end of a bench lesson: the notebook page, signed off, beside the margin's tally. The robot's eyes are fully lit,
 * the XP is written in blue ink line by line, and the island card links to what the lesson placed. Quiet on purpose:
 * one primary action (the next lesson).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BenchLessonData } from "../../content/load";
import { m } from "../../i18n";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { PartIcon } from "../../parts/PartIcon";
import { prefersReducedMotion } from "../../progress/prefs";
import type { Completion } from "../../progress/store";
import { XP } from "../../progress/xp";
import type { IsleRevealResult } from "../isle-hooks";
import type { PartInfo, PlayerProps } from "../types";
import { Robot } from "./Robot";

type Props = {
  lesson: BenchLessonData;
  completion: Completion;
  parts: Record<string, PartInfo>;
  module: PlayerProps["module"];
  next: PlayerProps["next"];
  mapHref: string;
  isle: IsleRevealResult;
  firstTry: number;
  items: number;
  page: ReactNode;
};

export function BenchFinale({ lesson, completion, parts, module, next, mapHref, isle, firstTry, items, page }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const reduced = prefersReducedMotion();
  const [shown, setShown] = useState(reduced ? 99 : 0);
  const { gained, levelBefore, levelAfter } = completion;

  useEffect(() => {
    heading.current?.focus();
    if (reduced) return;
    const t = window.setInterval(() => setShown((n) => n + 1), 220);
    return () => window.clearInterval(t);
  }, [reduced]);

  const lines: { label: string; xp: number }[] = [];
  if (gained.lesson) lines.push({ label: m.finale.breakdown.lesson, xp: gained.lesson });
  if (gained.tasks) lines.push({ label: m.finale.breakdown.tasks(gained.tasks / XP.task), xp: gained.tasks });
  if (gained.firstTry) lines.push({ label: completion.replay ? m.finale.breakdown.replay : m.finale.breakdown.firstTry(firstTry, items), xp: gained.firstTry });
  for (const _ of gained.modules) lines.push({ label: m.finale.breakdown.module(module.title), xp: XP.module });
  for (const a of gained.achievements) lines.push({ label: a.title, xp: a.xp });
  const levelUp = levelAfter.level > levelBefore.level;
  const newParts = completion.newParts.map((id) => parts[id]).filter((p): p is PartInfo => !!p);

  return (
    <div className="bl bl--finale" data-finale>
      <header className="bl-bar">
        <IconButton label={m.lesson.close} icon="close" href={mapHref} />
        <p className="bl-bar__title">{lesson.title}</p>
      </header>
      <main id="main" className="bl-main bl-main--finale">
        <aside className="bl-margin bl-margin--finale" aria-labelledby="finale-title">
          <Robot lit={1} mood="happy" size={112} label={m.lessonBench.robot(1)} />
          <p className="bl-line">{lesson.end.say}</p>
          <h1 id="finale-title" className="bl-finale__title" ref={heading} tabIndex={-1}>
            {completion.replay ? m.lessonBench.finale.replay : m.lessonBench.finale.title(lesson.title)}
          </h1>
          <ol className="bl-tally" aria-label={m.finale.xpEarned}>
            {lines.map((l, i) => (
              <li key={i} data-shown={i < shown || undefined}>
                <span>{l.label}</span>
                <b>{m.common.plusXp(l.xp)}</b>
              </li>
            ))}
          </ol>
          <p className="bl-tally__sum" data-shown={lines.length < shown || undefined}>
            <span>{m.lessonBench.finale.total}</span>
            <b className="finale__xp" data-xp={gained.total}>
              {m.common.plusXp(gained.total)}
            </b>
          </p>
          <div className="bl-level">
            <p className="bl-level__t">
              {m.finale.level(levelAfter.level, levelAfter.title)}
              <small>{m.finale.toNext(levelAfter.next - levelAfter.xp, levelAfter.level + 1)}</small>
            </p>
            {levelUp && (
              <span className="bl-stamp bl-stamp--level" role="img" aria-label={m.finale.levelUp(levelAfter.level)}>
                <span>{m.lessonBench.finale.levelUp}</span>
              </span>
            )}
            <span className="bl-level__bar" aria-hidden="true">
              <span style={{ width: `${Math.round(levelAfter.ratio * 100)}%` }} />
            </span>
          </div>
          <div className="bl-finale__cta">
            {next ? (
              <a className="btn btn--primary btn--large" href={next.href} data-primary>
                {m.finale.next}
                <Icon name="arrow-right" size={20} />
              </a>
            ) : (
              <a className="btn btn--primary btn--large" href={mapHref} data-primary>
                {m.lessonBench.finale.toMap}
              </a>
            )}
            {next && (
              <>
                <p className="bl-finale__next">{m.finale.nextTitle(next.title)}</p>
                <a className="bl-link" href={mapHref}>
                  {m.lessonBench.finale.toMap}
                </a>
              </>
            )}
          </div>
        </aside>
        <section className="bl-finale__page" aria-label={m.lessonBench.notebook}>
          {page}
          <div className="bl-finale__slips">
            {newParts.map((p) => (
              <div key={p.id} className="bl-slip">
                <span className="bl-kicker">{m.lessonBench.page.parts}</span>
                <span className="bl-slip__row">
                  <PartIcon kind={p.icon} size={40} />
                  <b>{p.name}</b>
                </span>
              </div>
            ))}
            {!completion.replay && (
              <a className="bl-slip bl-slip--isle" href="/isle">
                <span className="bl-kicker bl-kicker--red">{m.lessonBench.finale.isle}</span>
                <b>{isle ? (isle.big ? m.finale.isleLandmark(isle.title) : m.finale.isleBody(isle.title)) : m.finale.isleBodyGeneric}</b>
                <span className="bl-link">
                  {m.lessonBench.finale.isleBody}
                  <Icon name="arrow-right" size={16} />
                </span>
              </a>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
