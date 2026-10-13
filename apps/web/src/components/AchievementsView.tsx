import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { MascotSay } from "./MascotSay";
import { PartIcon } from "../parts/PartIcon";
import type { PartIconKind } from "../parts/kinds";
import { ACHIEVEMENTS } from "../progress/achievements";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";
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

/** The achievements grid. */
export function AchievementGrid({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const unlocked = useLearner((s) => s.learner.achievements);
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  return (
    <section className="ach" aria-labelledby="ach-title">
      <div className="ach__head">
        <h2 id="ach-title">{m.achievements.gridTitle}</h2>
        <p className="small muted tabular">{ready ? m.achievements.unlockedCount(count, ACHIEVEMENTS.length) : " "}</p>
      </div>
      <ul className="ach__grid">
        {ACHIEVEMENTS.map((a) => {
          const got = ready ? unlocked[a.id] : undefined;
          const secret = a.hidden && !got;
          return (
            <li key={a.id} className="ach-card" data-state={got ? "unlocked" : "locked"}>
              <span className="ach-card__icon" aria-hidden="true">
                <Icon name={secret ? "lock" : a.icon} size={26} />
              </span>
              <div className="ach-card__text">
                <h3 className="ach-card__title">{secret ? m.achievements.hiddenTitle : a.title}</h3>
                <p className="small muted">{secret ? m.achievements.hiddenBody : a.description}</p>
                <p className="ach-card__meta small">
                  {got ? (
                    <span className="ach-card__date">
                      <Icon name="check-circle" size={16} />
                      {m.achievements.unlockedOn(m.common.date(got.at))}
                    </span>
                  ) : (
                    <span className="muted">{m.achievements.locked}</span>
                  )}
                  <Badge tone={got ? "accent" : "outline"}>{m.common.plusXp(a.xp)}</Badge>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The Hall of Fried Parts: a shelf of burned-out parts, newest first, each with a little plaque. */
export function HallOfFriedParts({ outline, firstLabHref }: { outline: CourseOutline; firstLabHref: string }) {
  const ready = useLearnerReady(outline);
  const fried = useLearner((s) => s.learner.fried);
  const list = [...fried].reverse();
  return (
    <section className="hall" aria-labelledby="hall-title">
      <div className="hall__head">
        <div>
          <h2 id="hall-title">{m.achievements.hall.title}</h2>
          <p className="muted">{m.achievements.hall.lead}</p>
        </div>
        {ready && list.length > 0 && <Badge tone="solid" icon="flame">{m.achievements.hall.count(list.length)}</Badge>}
      </div>
      {!ready ? (
        <Skeleton height={220} />
      ) : list.length === 0 ? (
        <div className="empty hall__empty">
          <MascotSay pose="oops" size={96}>
            {m.achievements.hall.emptyBody}
          </MascotSay>
          <h3>{m.achievements.hall.emptyTitle}</h3>
          <Button href={firstLabHref} variant="secondary" icon="flame">
            {m.achievements.hall.emptyCta}
          </Button>
        </div>
      ) : (
        <div className="shelf">
          <ul className="shelf__row">
            {list.map((f, i) => {
              const lesson = f.lessonId ? outline.lessons[f.lessonId] : undefined;
              return (
                <li key={`${f.kind}-${f.at}`} className="shelf__item" style={{ ["--i" as string]: i % 7 }}>
                  <span className="shelf__part">
                    <PartIcon kind={FRIED_ICON[f.kind] ?? "resistor"} size={72} state="burned" />
                  </span>
                  <span className="shelf__plaque">
                    <span className="shelf__label">{f.label}</span>
                    <span className="shelf__date mono">{m.common.date(f.at)}</span>
                    <span className="shelf__where">{lesson ? m.achievements.hall.inLesson(lesson.title) : m.achievements.hall.inSandbox}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
