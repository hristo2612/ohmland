import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { PartIcon } from "../parts/PartIcon";
import type { PartIconKind } from "../parts/kinds";
import { ACHIEVEMENTS, describeAchievement, stampsToShow } from "../progress/achievements";
import { resumeTarget } from "../progress/derive";
import { useDerived, useLearner, useLearnerReady } from "../progress/useLearner";
import { Button } from "./Button";
import { MascotSay } from "./MascotSay";
import { ProgressBar } from "./ProgressBar";
import { Skeleton } from "./Skeleton";
import { Stamp } from "./Stamp";
import "./achievements.css";

const FRIED_ICON: Record<string, PartIconKind> = {
  led: "led",
  resistor: "resistor",
  fuse: "fuse",
  "meter-fuse": "fuse",
  battery: "battery",
  cell: "cell",
  capacitor: "capacitor",
  npn: "transistor",
  phototransistor: "phototransistor",
  diode: "diode",
  speaker: "speaker",
  relay: "relay",
  pot: "pot",
  switch: "switch",
  pushbutton: "pushbutton",
  multimeter: "multimeter",
};
/** Stamps and taped parts sit a little crooked, the way a hand puts them down. */
const TILTS = [-6, 4, -2, 7, -5, 3, -8, 5];

/** Your level, in one line: the level, the XP in blue, the way to the next. */
export function LevelLine({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const { level } = useDerived(outline);
  if (!ready) return <Skeleton height={56} className="level-line" />;
  return (
    <div className="level-line">
      <p className="level-line__top">
        <span className="level-line__name">{m.finale.level(level.level, level.title)}</span>
        <span className="level-line__xp">{m.common.xp(level.xp)}</span>
      </p>
      <ProgressBar value={level.ratio} label={m.level.long(level.level)} valueText={`${level.into} / ${level.span} XP`} />
      <p className="small muted">{m.level.toNext(level.next - level.xp)}</p>
    </div>
  );
}

/**
 * The achievements: the stamps you have, pressed in red, then the next three still to earn as dashed rings, each with
 * a short line on how (a later unit's shows its title only). Secrets stay out of sight until they are earned.
 */
export function AchievementGrid({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const count = ACHIEVEMENTS.filter((a) => learner.achievements[a.id]).length;
  const target = resumeTarget(learner, outline);
  const current = target ? outline.lessons[target]?.unit : outline.units[outline.units.length - 1]?.id;
  const { earned, next } = stampsToShow(learner, outline, current);
  return (
    <section className="ach" aria-labelledby="ach-title">
      <div className="ach__head">
        <h2 id="ach-title">{m.achievements.gridTitle}</h2>
        <p className="small muted">{ready ? m.achievements.unlockedCount(count, ACHIEVEMENTS.length) : " "}</p>
      </div>
      {ready && (
        <ul className="stamps">
          {earned.map((a, i) => {
            const got = learner.achievements[a.id]!;
            return (
              <li key={a.id} className="stamps__item" data-state="earned">
                <Stamp icon={a.icon} state="earned" ring={m.achievements.stampRing(m.common.date(got.at))} tilt={TILTS[i % TILTS.length]} size={96} />
                <h3 className="stamps__title">
                  {a.title}
                  <span className="sr-only">, {m.achievements.unlockedOn(m.common.date(got.at))}</span>
                </h3>
              </li>
            );
          })}
          {next.map(({ a, later }) => (
            <li key={a.id} className="stamps__item" data-state="todo">
              <Stamp icon={a.icon} state="todo" tilt={0} size={96} />
              <h3 className="stamps__title">
                {a.title}
                <span className="sr-only">, {m.achievements.locked}</span>
              </h3>
              {!later && <p className="stamps__how">{describeAchievement(a, outline)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The Hall of Fried Parts: every part you burned out, taped into the notebook with its date and where it happened. */
export function HallOfFriedParts({ outline, firstLabHref }: { outline: CourseOutline; firstLabHref: string }) {
  const ready = useLearnerReady(outline);
  const fried = useLearner((s) => s.learner.fried);
  const list = [...fried].reverse();
  return (
    <section className="hall" aria-labelledby="hall-title">
      <div className="ach__head">
        <h2 id="hall-title">{m.achievements.hall.title}</h2>
        {ready && list.length > 0 && <p className="small muted">{m.achievements.hall.count(list.length)}</p>}
      </div>
      {!ready ? (
        <Skeleton height={220} />
      ) : list.length === 0 ? (
        <div className="hall__empty">
          <MascotSay pose="oops" size={96}>
            {m.achievements.hall.emptyBody}
          </MascotSay>
          <Button href={firstLabHref} variant="secondary">
            {m.achievements.hall.emptyCta}
          </Button>
        </div>
      ) : (
        <ul className="taped">
          {list.map((f, i) => {
            const lesson = f.lessonId ? outline.lessons[f.lessonId] : undefined;
            return (
              <li key={`${f.kind}-${f.at}`} className="taped__item" style={{ ["--tilt" as string]: `${TILTS[i % TILTS.length]! / 4}deg` }}>
                <span className="tape" aria-hidden="true" />
                <PartIcon kind={FRIED_ICON[f.kind] ?? "resistor"} size={72} state="burned" />
                <span className="taped__label">{f.label}</span>
                <span className="taped__where">
                  {m.common.date(f.at)} · {lesson ? m.achievements.hall.inLesson(lesson.title) : m.achievements.hall.inSandbox}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
