import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { Icon } from "./Icon";
import { NAV, type NavId } from "./nav";
import { NotebookMenu } from "./NotebookMenu";

/** The phone's bottom bar: Learn, Isle and your notebook (which opens the menu upwards). */
export default function BottomNav({ outline, active }: { outline: CourseOutline; active?: NavId | undefined }) {
  return (
    <nav className="bottom-nav" aria-label={m.nav.label}>
      <ul className="bottom-nav__list">
        {NAV.map((n) => (
          <li key={n.id}>
            <a href={n.href} className="bottom-nav__link" aria-current={active === n.id ? "page" : undefined}>
              <Icon name={n.icon} size={22} />
              <span>{n.label}</span>
            </a>
          </li>
        ))}
        <li>
          <NotebookMenu outline={outline} place="bar" active={active} />
        </li>
      </ul>
    </nav>
  );
}
