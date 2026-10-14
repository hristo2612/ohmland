import { useMemo } from "react";
import type { MapModule, MapUnit, MapUpcoming } from "../content/map";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { PartIcon } from "../parts/PartIcon";
import { lessonStates, resumeTarget, type LessonState } from "../progress/derive";
import { emptyLearner } from "../progress/state";
import type { LearnerState } from "../progress/types";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { Icon } from "./Icon";
import { IsleArt } from "./IsleArt";
import { Stamp } from "./Stamp";
import { Tick } from "./Tick";
import "./course-map.css";

const GUEST = emptyLearner();
/** Stamps are pressed by hand, never quite straight. */
const TILTS = [-8, 6, -4, 9, -6, 4];

type Ctx = { states: Record<string, LessonState>; current: string | undefined; learner: LearnerState };

/** One lesson line in a chapter: a pencil box (ticked when done), its number, its title and its length. */
function Entry({ lesson, n, ctx }: { lesson: MapModule["lessons"][number]; n: number; ctx: Ctx }) {
  const state = ctx.states[lesson.id] ?? "locked";
  const now = lesson.id === ctx.current;
  return (
    <li className="entry" data-state={state} data-now={now || undefined}>
      <Tick done={state === "done"} locked={state === "locked"} />
      <span className="entry__num">{n}</span>
      <a className="entry__title" href={lesson.href}>
        {lesson.title}
        <span className="sr-only">, {m.map.state[state]}</span>
      </a>
      <span className="entry__lead" aria-hidden="true" />
      {now ? (
        <span className="entry__now" aria-hidden="true">
          {m.map.now}
        </span>
      ) : (
        <span className="entry__meta">{m.map.lessonMeta(lesson.minutes)}</span>
      )}
    </li>
  );
}

/** A chapter (a module) folded into one ruled line: open for the chapter you are in, ticked and stamped once built. */
function Chapter({ mod, n, first, ctx, open }: { mod: MapModule; n: number; first: number; ctx: Ctx; open: boolean }) {
  const built = mod.lessons.every((l) => ctx.states[l.id] === "done");
  return (
    <details className="fold" open={open} data-built={built || undefined}>
      <summary>
        <Tick done={built} />
        <span className="fold__t">
          <span className="fold__k">{m.map.chapter(n)}</span>
          <span className="fold__name">{mod.title}</span>
        </span>
        <span className="fold__meta">
          <span className="fold__long">{m.common.lessons(mod.lessons.length)}</span>
          {built && <Stamp icon="landmark" size={36} tilt={TILTS[(n - 1) % TILTS.length]} label={m.map.landmarkBuilt(mod.landmark.name)} className="fold__stamp" />}
          <Icon name="chevron-right" size={20} className="fold__chev" />
        </span>
      </summary>
      <ol className="entries">
        {mod.lessons.map((l, i) => (
          <Entry key={l.id} lesson={l} n={first + i} ctx={ctx} />
        ))}
      </ol>
    </details>
  );
}

/** The chapters of a unit, with lesson numbers running through the unit. */
function Chapters({ unit, ctx, openId }: { unit: MapUnit; ctx: Ctx; openId?: string | undefined }) {
  let first = 1;
  return (
    <div className="folds">
      {unit.modules.map((mod, i) => {
        const start = first;
        first += mod.lessons.length;
        return <Chapter key={mod.id} mod={mod} n={i + 1} first={start} ctx={ctx} open={mod.id === openId} />;
      })}
    </div>
  );
}

/**
 * The course map, as a notebook's contents page. The unit you are in leads: its title, how far along it you are, the
 * lesson to do next (large, with the one button on the page) and a sketch of its island, landmarks drawn as you build
 * them. Its chapters follow as quiet ruled lines; the rest of the course folds up below. The server renders a new
 * learner's map; once the record loads, the real states fill in.
 */
export default function CourseMap({ units, upcoming, outline }: { units: MapUnit[]; upcoming: MapUpcoming[]; outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const stored = useLearner((s) => s.learner);
  const learner = ready ? stored : GUEST;
  const states = useMemo(() => lessonStates(learner, outline), [learner, outline]);
  const current = resumeTarget(learner, outline);
  const ctx: Ctx = { states, current, learner };

  const unit = units.find((u) => u.modules.some((mod) => mod.lessons.some((l) => l.id === current))) ?? units[units.length - 1];
  if (!unit) return null;
  const mod = unit.modules.find((x) => x.lessons.some((l) => l.id === current));
  const lessons = unit.modules.flatMap((x) => x.lessons);
  const lesson = lessons.find((l) => l.id === current);
  const done = lessons.filter((l) => states[l.id] === "done").length;
  const progress = current ? learner.inProgress[current] : undefined;
  const resuming = !!progress && !!lesson;
  const chapterNo = mod ? unit.modules.indexOf(mod) + 1 : 0;

  // Module boundaries, as ticks on the progress line.
  const ticks: number[] = [];
  unit.modules.reduce((acc, x) => {
    const at = acc + x.lessons.length;
    if (at < lessons.length) ticks.push(at / lessons.length);
    return at;
  }, 0);
  const landmarks = unit.modules.map((x) => ({
    name: x.landmark.name,
    built: x.lessons.every((l) => states[l.id] === "done"),
    current: x === mod,
  }));
  const others = units.filter((u) => u !== unit);

  return (
    <div className="sheet map" data-ready={ready || undefined}>
      <div className="sheet__margin map__margin" aria-hidden="true">
        <span className="kicker">{m.map.unitWord}</span>
        <span className="map__n">{unit.number}</span>
      </div>

      <div className="sheet__main map__main">
        <header className="map__intro">
          <p className="kicker map__kicker">{m.map.unit(unit.number)}</p>
          <h1>{unit.title}</h1>
          <p className="lead">{unit.summary}</p>
          <div className="progress-line">
            <span className="nowrap">
              <b>{done}</b> {m.map.ofLessons(lessons.length)}
            </span>
            <span
              className="progress-line__track"
              role="progressbar"
              aria-label={m.map.progress(done, lessons.length)}
              aria-valuemin={0}
              aria-valuemax={lessons.length}
              aria-valuenow={done}
            >
              <span style={{ transform: `scaleX(${lessons.length ? done / lessons.length : 0})` }} />
              {ticks.map((t) => (
                <i key={t} style={{ left: `${t * 100}%` }} />
              ))}
            </span>
          </div>
        </header>

        {lesson && mod ? (
          <section className="now" aria-labelledby="now-title" data-now>
            <p className="now__here" aria-hidden="true">
              {m.map.youAreHere}
              <svg className="mark mark--blue write" viewBox="0 0 44 28">
                <path pathLength={1} d="M2 8C14 4 28 8 40 18" />
                <path pathLength={1} d="M30 18.5 40.5 18.5 37 9" />
              </svg>
            </p>
            <div className="now__text">
              <p className="kicker">{m.map.chapterOf(chapterNo, mod.title)}</p>
              <h2 id="now-title" className="now__title">
                {lesson.title}
              </h2>
              <p className="now__meta">
                {resuming && <b>{m.map.step(Math.min(lesson.steps, (progress?.step ?? 0) + 1), lesson.steps)}</b>}
                {resuming && " · "}
                {m.map.lessonMeta(lesson.minutes)}
              </p>
              <a className="btn btn--primary btn--large now__go" href={lesson.href}>
                {resuming ? m.map.continue : m.map.start}
                <Icon name="arrow-right" size={20} />
              </a>
            </div>
            {lesson.icon && <PartIcon kind={lesson.icon} size={112} className="now__art" />}
          </section>
        ) : (
          <p className="now now--done">{m.map.allDone}</p>
        )}

        <figure className="map__isle">
          <div className="map__isle-art">
            <IsleArt
              landmarks={landmarks}
              note={mod ? m.map.building(mod.landmark.name) : undefined}
              label={m.map.isleLabel(landmarks.filter((x) => x.built).length, landmarks.length)}
            />
          </div>
          <figcaption>
            <a className="btn btn--tertiary" href="/isle">
              {m.map.isleLink}
              <Icon name="arrow-right" size={18} />
            </a>
          </figcaption>
        </figure>

        <section className="map__chapters" aria-label={unit.title}>
          <Chapters unit={unit} ctx={ctx} openId={mod?.id} />
        </section>

        {(others.length > 0 || upcoming.length > 0) && (
          <section className="map__units" aria-labelledby="map-units">
            <h2 id="map-units" className="kicker">
              {m.map.otherUnits}
            </h2>
            <div className="folds">
              {others.map((u) => {
                const all = u.modules.flatMap((x) => x.lessons);
                const d = all.filter((l) => states[l.id] === "done").length;
                return (
                  <details key={u.id} className="fold fold--unit">
                    <summary>
                      <span className="unit-n">{u.number}</span>
                      <span className="fold__t">
                        <span className="fold__name">{u.title}</span>
                      </span>
                      <span className="fold__meta">
                        <span>{d > 0 ? m.map.progress(d, all.length) : m.common.lessons(all.length)}</span>
                        <Icon name="chevron-right" size={20} className="fold__chev" />
                      </span>
                    </summary>
                    <div className="fold__body">
                      <Chapters unit={u} ctx={ctx} />
                    </div>
                  </details>
                );
              })}
              {upcoming.map((u) => (
                <div key={u.id} className="fold fold--soon">
                  <div className="fold__row">
                    <span className="unit-n unit-n--soon">{u.number}</span>
                    <span className="fold__t">
                      <span className="fold__name">{u.title}</span>
                    </span>
                    <span className="fold__meta">{m.map.comingLater}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
