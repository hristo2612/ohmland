import type { CourseOutline } from "../content/outline";
import type { PartFile } from "../content/schema";
import { m } from "../i18n";
import { PartIcon } from "../parts/PartIcon";
import { partsBin } from "../progress/parts";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

/** The parts the learner can use on the free-build bench (their unlocked parts). */
export default function BenchParts({ parts, outline, firstHref }: { parts: PartFile[]; outline: CourseOutline; firstHref: string }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  if (!ready) return <Skeleton height={120} />;
  const owned = new Set(partsBin(learner, outline));
  const list = parts.filter((p) => owned.has(p.id));
  if (!list.length)
    return (
      <div className="bench-parts bench-parts--empty">
        <p className="muted">{m.bench.partsEmpty}</p>
        <Button href={firstHref} variant="primary" iconEnd="arrow-right">
          {m.bench.start}
        </Button>
      </div>
    );
  return (
    <ul className="bench-parts">
      {list.map((p) => (
        <li key={p.id}>
          <span className="bench-parts__slot">
            <PartIcon kind={p.icon} size={56} />
          </span>
          <span className="small">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}
