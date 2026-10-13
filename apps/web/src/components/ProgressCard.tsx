import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { useDerived, useLearnerReady } from "../progress/useLearner";
import { ProgressBar } from "./ProgressBar";
import { Skeleton } from "./Skeleton";
import "./course-map.css";

/** Level, XP and the way to the next level, for the course map and achievements pages. */
export default function ProgressCard({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const d = useDerived(outline);
  const { level } = d;
  return (
    <div className="progress-card card card--raised">
      <p className="eyebrow">{m.achievements.levelCard.title}</p>
      {ready ? (
        <>
          <div className="progress-card__row">
            <span className="progress-card__badge mono" aria-hidden="true">
              {level.level}
            </span>
            <div>
              <p className="progress-card__title">{level.title}</p>
              <p className="small muted tabular">{m.level.total(level.xp)}</p>
            </div>
          </div>
          <ProgressBar value={level.ratio} label={m.level.long(level.level)} valueText={`${level.into} / ${level.span} XP`} />
          <p className="small muted tabular">{m.level.toNext(level.next - level.xp)}</p>
          <dl className="progress-card__stats">
            <div>
              <dt className="small muted">{m.stats.lessons}</dt>
              <dd className="mono">{d.lessonsDone}</dd>
            </div>
            <div>
              <dt className="small muted">{m.stats.parts}</dt>
              <dd className="mono">{d.parts.length}</dd>
            </div>
          </dl>
        </>
      ) : (
        <div className="progress-card__loading" aria-hidden="true">
          <Skeleton height={48} />
          <Skeleton height={8} />
          <Skeleton height={40} />
        </div>
      )}
    </div>
  );
}
