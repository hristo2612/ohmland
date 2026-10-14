import { useEffect, useState } from "react";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { useDerived, useLearner, useLearnerReady } from "../progress/useLearner";
import { Icon } from "./Icon";
import type { NavId } from "./nav";
import { NotebookMenu } from "./NotebookMenu";

const NOTICE_KEY = "ohmland:memory-notice";

/** The level as a handwritten tally, for a phone's header (the bottom bar holds the menu there). */
function XpTally({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const { level } = useDerived(outline);
  if (!ready) return <span className="xp-tally" aria-hidden="true" />;
  return (
    <span className="xp-tally" data-level={level.level}>
      <span className="sr-only">{m.level.chipLabel(level.level, level.title, level.xp)}</span>
      <span aria-hidden="true">{m.level.short(level.level)}</span>
      <span className="xp-tally__pts" aria-hidden="true">
        {m.common.xp(level.xp)}
      </span>
    </span>
  );
}

/** Right side of the header: your notebook (level, XP and the menu). Also shows the "not saving" notice when storage is blocked. */
export default function HeaderTools({ outline, active }: { outline: CourseOutline; active?: NavId | undefined }) {
  const persistence = useLearner((s) => s.persistence);
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(NOTICE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(NOTICE_KEY, "1");
    } catch {
      // Nothing to remember it in.
    }
  };
  return (
    <>
      <div className="header-tools">
        <NotebookMenu outline={outline} place="header" active={active} />
        <XpTally outline={outline} />
      </div>
      {persistence === "memory" && !dismissed && (
        <div className="memory-notice notice notice--warn" role="status">
          <Icon name="alert" size={20} />
          <div>
            <p className="notice__title">{m.persistence.memoryTitle}</p>
            <p>{m.persistence.memoryBody}</p>
          </div>
          <button type="button" className="btn btn--small btn--secondary" onClick={dismiss}>
            {m.persistence.dismiss}
          </button>
        </div>
      )}
    </>
  );
}
