import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { useDerived, useLearnerReady } from "../progress/useLearner";
import { Skeleton } from "./Skeleton";

/** The XP and level chip in the header. Links to achievements. */
export function LevelChip({ outline, compact = false }: { outline: CourseOutline; compact?: boolean }) {
  const ready = useLearnerReady(outline);
  const { level } = useDerived(outline);
  if (!ready)
    return (
      <span className="level-chip level-chip--loading" aria-hidden="true">
        <Skeleton shape="circle" width={28} height={28} />
        {!compact && <Skeleton width={72} height={12} />}
      </span>
    );
  return (
    <a className={compact ? "level-chip level-chip--compact" : "level-chip"} href="/achievements" aria-label={m.level.chipLabel(level.level, level.title, level.xp)}>
      <span className="level-chip__badge tabular" aria-hidden="true">
        {level.level}
      </span>
      {!compact && (
        <span className="level-chip__text" aria-hidden="true">
          <span className="level-chip__title">{level.title}</span>
          <span className="level-chip__bar">
            <span className="level-chip__fill" style={{ transform: `scaleX(${level.ratio})` }} />
          </span>
        </span>
      )}
      <span className="level-chip__xp tabular" aria-hidden="true">
        {m.common.xp(level.xp)}
      </span>
    </a>
  );
}
