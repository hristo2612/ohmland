/**
 * The learner's notebook page for a bench lesson. It fills itself in from what happened: the rules found, guesses
 * against results, checks and how they went, the fix-it round, parts that went to the Hall. Opened from the margin
 * at any time; at the end it is the signed-off summary with a "checked" stamp.
 */
import type { ReactNode } from "react";
import type { BenchLessonData } from "../../content/load";
import { m } from "../../i18n";
import { answerKeys, checkOf, isGraded, type Answers, type Moment } from "./flow";

type Props = {
  lesson: BenchLessonData;
  moments: readonly Moment[];
  answers: Answers;
  /** Moments finished so far (index of the current one). */
  reached: number;
  rules: string[];
  fried: string[];
  signed?: boolean;
  /** The fix-it benches fixed. */
  fixed: number;
  /** What the lab's panels write onto the signed-off page (NotebookFigures: the 555 map so far). */
  figures?: ReactNode;
};

const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function NotebookPage({ lesson, moments, answers, reached, rules, fried, signed, fixed, figures }: Props) {
  const t = m.lessonBench.page;
  const guesses = moments
    .slice(0, reached)
    .filter((mo) => mo.beat?.guess && typeof answers[answerKeys.guess(mo.key)] === "number")
    .map((mo) => {
      const g = mo.beat!.guess!;
      const picked = g.options[answers[answerKeys.guess(mo.key)] as number] ?? "";
      return { key: mo.key, picked, right: g.answer, ok: g.answer === undefined || g.answer === picked, done: mo.done };
    });
  const checks = moments
    .filter((mo) => isGraded(mo))
    .map((mo) => ({ key: mo.key, say: mo.say, rec: checkOf(answers, mo.key) }))
    .filter((c) => c.rec?.done);
  const fixCount = lesson.fixit?.tasks.length ?? 0;
  const clock = answers[answerKeys.clock];

  return (
    <article className={`bl-page${signed ? " bl-page--signed" : ""}`} aria-label={t.title(lesson.index + 1, lesson.title)}>
      <header className="bl-page__head">
        <h2 className="bl-page__title">{t.title(lesson.index + 1, lesson.title)}</h2>
        <span className="bl-page__date">{today()}</span>
      </header>

      <section className="bl-page__sec">
        <h3 className="bl-kicker">{t.rules}</h3>
        {rules.length ? (
          <ul className="bl-page__rules">
            {rules.map((r) => (
              <li key={r}>
                <span className="bl-tick" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="bl-page__empty">{t.noRules}</p>
        )}
      </section>

      {figures}

      {guesses.length > 0 && (
        <section className="bl-page__sec">
          <h3 className="bl-kicker">{t.guesses}</h3>
          <table className="bl-page__table">
            <thead>
              <tr>
                <th scope="col">{t.guess}</th>
                <th scope="col">{t.result}</th>
              </tr>
            </thead>
            <tbody>
              {guesses.map((g) => (
                <tr key={g.key}>
                  <td className={`bl-hand bl-hand--blue${g.ok ? "" : " bl-struck"}`}>{g.picked}</td>
                  <td>
                    {g.right ?? g.done ?? ""}
                    {g.ok && <span className="bl-tick bl-tick--inline" aria-label={m.lessonBench.called} role="img" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {checks.length > 0 && (
        <section className="bl-page__sec">
          <h3 className="bl-kicker">{t.checks}</h3>
          <ul className="bl-page__checks">
            {checks.map((c) => (
              <li key={c.key}>
                <span>{c.say}</span>
                <span className={`bl-hand ${c.rec?.first ? "bl-hand--blue" : "bl-hand--muted"}`}>{c.rec?.first ? t.firstTry : t.later}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fixCount > 0 && fixed > 0 && (
        <section className="bl-page__sec">
          <h3 className="bl-kicker">{t.fixit}</h3>
          <p>
            {t.fixed(fixed, fixCount)}
            {typeof clock === "number" && <span className="bl-hand bl-hand--blue"> {m.lessonBench.fixit.beat(clock)}</span>}
          </p>
        </section>
      )}

      {fried.length > 0 && (
        <section className="bl-page__sec">
          <h3 className="bl-kicker bl-kicker--red">{t.hall}</h3>
          <ul className="bl-page__hall">
            {fried.map((f, i) => (
              <li key={`${f}-${i}`}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {signed && (
        <p className="bl-stamp bl-stamp--checked" aria-hidden="true">
          <span>{t.signed}</span>
          <small>{today()}</small>
        </p>
      )}
    </article>
  );
}
