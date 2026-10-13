import { useMemo, type ReactNode } from "react";
import type { MapUnit, MapUpcoming } from "../content/map";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { lessonStates, type LessonState } from "../progress/derive";
import { emptyLearner } from "../progress/state";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { ProgressBar } from "./ProgressBar";
import { Tooltip } from "./Tooltip";
import "./course-map.css";

/** Locked lessons still open (locks suggest an order, they are not walls); a tooltip says why it is locked. */
function LessonLink({ state, href, children }: { state: LessonState; href: string; children: ReactNode }) {
  const link = (
    <a className="lesson-card" href={href} data-state={state}>
      {children}
    </a>
  );
  return state === "locked" ? (
    <Tooltip text={m.map.lockedHint} placement="below">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

const NODE_ICON: Record<LessonState, IconName> = { done: "check", current: "play", open: "arrow-right", locked: "lock" };
const GUEST = emptyLearner();

/**
 * The course map: units as sections, modules as groups that end in a landmark, lessons as a path of nodes.
 * The server renders a new learner's map; once the record loads, the real states fill in.
 */
export default function CourseMap({ units, upcoming, outline }: { units: MapUnit[]; upcoming: MapUpcoming[]; outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const states = useMemo(() => lessonStates(ready ? learner : GUEST, outline), [ready, learner, outline]);
  const inProgress = ready ? learner.inProgress : {};
  let lessonNumber = 0;

  return (
    <div className="course-map" data-ready={ready || undefined}>
      {units.map((u) => {
        const ids = u.modules.flatMap((mod) => mod.lessons.map((l) => l.id));
        const done = ids.filter((id) => states[id] === "done").length;
        return (
          <section key={u.id} className="unit" aria-labelledby={`unit-${u.id}`}>
            <header className="unit__head">
              <span className="unit__num" aria-hidden="true">
                {u.number}
              </span>
              <div className="unit__text">
                <p className="eyebrow">{m.map.unit(u.number)}</p>
                <h2 id={`unit-${u.id}`}>{u.title}</h2>
                <p className="muted">{u.summary}</p>
              </div>
              <div className="unit__progress">
                <p className="small muted tabular">{m.map.progress(done, ids.length)}</p>
                <ProgressBar value={ids.length ? done / ids.length : 0} label={m.map.progress(done, ids.length)} size="thin" />
              </div>
            </header>

            {u.modules.map((mod) => {
              const built = mod.lessons.every((l) => states[l.id] === "done");
              return (
                <div key={mod.id} className="module">
                  <div className="module__head">
                    <h3>{mod.title}</h3>
                    <p className="small muted">{mod.summary}</p>
                  </div>
                  <ol className="path">
                    {mod.lessons.map((l, i) => {
                      lessonNumber += 1;
                      const state = states[l.id] ?? "locked";
                      const resuming = !!inProgress[l.id] && state !== "done";
                      const node = (
                        <span className="path__node" data-state={state} aria-hidden="true">
                          {state === "open" ? <span className="mono">{lessonNumber}</span> : <Icon name={NODE_ICON[state]} size={state === "current" ? 24 : 20} strokeWidth={2.25} />}
                        </span>
                      );
                      return (
                        <li key={l.id} className="path__step" data-state={state} style={{ ["--i" as string]: i }}>
                          {node}
                          <LessonLink state={state} href={l.href}>
                            <span className="lesson-card__meta small">
                              <span className="sr-only">{m.map.state[state]}: </span>
                              {m.map.lessonMeta(l.minutes)}
                              {state !== "locked" && state !== "open" && (
                                <Badge tone={state === "done" ? "good" : "accent"}>{m.map.state[state]}</Badge>
                              )}
                            </span>
                            <span className="lesson-card__title">{l.title}</span>
                            <span className="lesson-card__summary small">{l.summary}</span>
                            {state === "current" && (
                              <span className="lesson-card__cta">
                                <span className="btn btn--primary">
                                  {resuming ? m.map.continue : m.map.start}
                                  <Icon name="arrow-right" size={18} />
                                </span>
                              </span>
                            )}
                          </LessonLink>
                        </li>
                      );
                    })}
                    <li className="path__step path__step--landmark" data-state={built ? "done" : "locked"}>
                      <span className="path__node path__node--landmark" aria-hidden="true">
                        <Icon name="landmark" size={22} />
                      </span>
                      <div className="landmark-card">
                        <span className="eyebrow">{m.map.landmark}</span>
                        <span className="landmark-card__text">{built ? m.map.landmarkBuilt(mod.landmark.name) : m.map.landmarkBuilds(mod.landmark.name)}</span>
                      </div>
                    </li>
                  </ol>
                </div>
              );
            })}
          </section>
        );
      })}

      {upcoming.length > 0 && (
        <section className="upcoming" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="sr-only">
            {m.map.comingSoon}
          </h2>
          <ol className="upcoming__list">
            {upcoming.map((u) => (
              <li key={u.id} className="upcoming__unit">
                <span className="unit__num unit__num--soon" aria-hidden="true">
                  {u.number}
                </span>
                <div>
                  <p className="eyebrow eyebrow--muted">{m.map.unit(u.number)}</p>
                  <h3>{u.title}</h3>
                  <p className="small muted">{u.summary}</p>
                </div>
                <Badge icon="clock">{m.map.comingSoon}</Badge>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
