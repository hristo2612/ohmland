import { useEffect, useState } from "react";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { useLearner } from "../progress/store";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { LevelChip } from "./LevelChip";
import { ThemeMenu } from "./ThemeMenu";

const NOTICE_KEY = "ohmland:memory-notice";

/** Right side of the header: level chip, theme menu, account. Also shows the "not saving" notice when storage is blocked. */
export default function HeaderTools({ outline, accountActive = false }: { outline: CourseOutline; accountActive?: boolean }) {
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
        <LevelChip outline={outline} />
        <ThemeMenu />
        <IconButton label={m.nav.account} icon="user" href="/account" className="header-tools__account" aria-current={accountActive ? "page" : undefined} />
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
