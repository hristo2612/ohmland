import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { completedModules } from "../progress/xp";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";

/** Turns an island piece id into a readable name until the island package provides real names. */
const pieceName = (id: string) => {
  const words = id.replace(/^sample-/, "").split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** What the learner has earned for their island: one piece per lesson, one landmark per module. */
export default function IslePieces({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  if (!ready) return <Skeleton height={160} />;
  const pieces = outline.order.filter((id) => learner.lessons[id] && outline.lessons[id]?.isle).map((id) => outline.lessons[id]!);
  const landmarks = completedModules(learner, outline)
    .map((id) => outline.modules.find((mod) => mod.id === id))
    .filter((mod) => !!mod);
  return (
    <div className="isle-pieces">
      <section>
        <h2 className="isle-pieces__title">{m.isle.piecesTitle}</h2>
        {pieces.length === 0 ? (
          <p className="muted">{m.isle.piecesEmpty}</p>
        ) : (
          <ul className="isle-pieces__list">
            {pieces.map((l) => (
              <li key={l.id}>
                <span className="isle-pieces__icon">
                  <Icon name="isle" size={20} />
                </span>
                <span>
                  <strong>{pieceName(l.isle ?? "")}</strong>
                  <span className="small muted">{m.isle.pieceFrom(l.title)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {landmarks.length > 0 && (
        <section>
          <h2 className="isle-pieces__title">{m.isle.landmarksTitle}</h2>
          <ul className="isle-pieces__list">
            {landmarks.map((mod) => (
              <li key={mod.id}>
                <span className="isle-pieces__icon isle-pieces__icon--landmark">
                  <Icon name="landmark" size={20} />
                </span>
                <span>
                  <strong>{mod.landmark.name}</strong>
                  <span className="small muted">{mod.title}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
