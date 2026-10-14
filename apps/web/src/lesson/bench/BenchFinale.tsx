/**
 * The end of a bench lesson, in two beats. First the robot's last line (the heading) and the notebook page, signed off
 * with its stamp; then, under it, the tally writes itself in blue ink line by line, the level and the one primary action
 * (the next lesson). The new parts and the island's new piece are slips after that. Quiet on purpose.
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

/** The tally waits this many of its 220 ms steps: the signed page and its stamp come first. */
const PAGE_FIRST = 4;

export function BenchFinale({ lesson, completion, parts, module, next, mapHref, isle, firstTry, items, page }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const reduced = prefersReducedMotion();
  const [shown, setShown] = useState(reduced ? 99 : 0);
  const { gained, levelBefore, levelAfter } = completion;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (reduced) return;
    const t = window.setInterval(() => setShown((n) => (n > 99 ? n : n + 1)), 220);
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
  // The second beat: tally lines one by one, then the sum, then the level and the way on.
  const step = shown - PAGE_FIRST;
  const tallyOn = step >= 0;
  const restOn = step > lines.length;

  return (
    <div className="bl bl--finale" data-finale>
      <header className="bl-bar">
        <IconButton label={m.lesson.close} icon="close" href={mapHref} />
        <p className="bl-bar__title">{lesson.title}</p>
      </header>
      <main id="main" className="bl-finale">
        <div className="bl-finale__lead">
          <Robot lit={1} mood="happy" size={112} label={m.lessonBench.robot(1)} />
          {completion.replay && <p className="bl-kicker">{m.lessonBench.finale.replay}</p>}
          {/* The robot's last line is the heading: the lesson's title is already on the bar and the page. */}
          <h1 id="finale-title" className="bl-line bl-finale__title" ref={heading} tabIndex={-1}>
            {lesson.end.say}
          </h1>
        </div>
        <section className="bl-finale__page" aria-label={m.lessonBench.notebook}>
          {page}
        </section>
        <div className="bl-finale__tally" data-shown={tallyOn || undefined}>
          <ol className="bl-tally" aria-label={m.finale.xpEarned}>
            {lines.map((l, i) => (
              <li key={i} data-shown={i < step || undefined}>
                <span>{l.label}</span>
                <b>{m.common.plusXp(l.xp)}</b>
              </li>
            ))}
          </ol>
          <p className="bl-tally__sum" data-shown={lines.length < step || undefined}>
            <span>{m.lessonBench.finale.total}</span>
            <b className="finale__xp" data-xp={gained.total}>
              {m.common.plusXp(gained.total)}
            </b>
          </p>
          <div className="bl-finale__rest" data-shown={restOn || undefined}>
            <div className="bl-level">
              <div className="bl-level__row">
                {levelUp && (
                  <span className="bl-stamp bl-stamp--level" role="img" aria-label={m.finale.levelUp(levelAfter.level)}>
                    <span>{m.lessonBench.finale.levelUp}</span>
                  </span>
                )}
                <p className="bl-level__t">
                  {m.finale.level(levelAfter.level, levelAfter.title)}
                  <small>{m.finale.toNext(levelAfter.next - levelAfter.xp, levelAfter.level + 1)}</small>
                </p>
              </div>
              <span className="bl-level__bar" aria-hidden="true">
                <span style={{ width: `${Math.round(levelAfter.ratio * 100)}%` }} />
              </span>
            </div>
            <div className="bl-finale__cta">
              {next ? (
                <>
                  <a className="btn btn--primary btn--large" href={next.href} data-primary>
                    {m.finale.next}
                    <Icon name="arrow-right" size={20} />
                  </a>
                  <p className="bl-finale__next">{m.finale.nextTitle(next.title)}</p>
                </>
              ) : (
                <a className="btn btn--primary btn--large" href={mapHref} data-primary>
                  {m.lessonBench.finale.toMap}
                </a>
              )}
            </div>
          </div>
        </div>
        {(newParts.length > 0 || !completion.replay) && (
          <div className="bl-finale__slips" data-shown={restOn || undefined}>
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
        )}
      </main>
    </div>
  );
}
