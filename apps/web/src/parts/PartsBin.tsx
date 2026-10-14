import { useMemo, useState } from "react";
import type { CourseOutline } from "../content/outline";
import type { PartFile } from "../content/schema";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { m } from "../i18n";
import { lessonUnlocking, partsBin } from "../progress/parts";
import { emptyLearner } from "../progress/state";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { PartIcon } from "./PartIcon";
import { PartPreview } from "./PartPreview";

const GUEST = emptyLearner();

/**
 * The parts bin: your parts as large pasted slips, then one slip for the part that comes next and the lesson that
 * brings it, then the rest as small unlabelled pencil outlines. A tap opens a part's facts (and, for one not yet yours,
 * where it unlocks).
 */
export default function PartsBin({ parts, outline }: { parts: PartFile[]; outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const unlocked = useMemo(() => new Set(partsBin(ready ? learner : GUEST, outline)), [ready, learner, outline]);
  const [open, setOpen] = useState<PartFile | null>(null);
  const owned = parts.filter((p) => unlocked.has(p.id));
  const later = parts.filter((p) => !unlocked.has(p.id));
  // The next part: the locked one whose lesson comes first in the course.
  const rank = (p: PartFile) => {
    const from = lessonUnlocking(p.id, outline);
    return from ? outline.order.indexOf(from) : Infinity;
  };
  const next = later.reduce<PartFile | undefined>((best, p) => (rank(p) < (best ? rank(best) : Infinity) ? p : best), undefined);
  const nextLesson = next ? outline.lessons[lessonUnlocking(next.id, outline) ?? ""] : undefined;
  const rest = nextLesson ? later.filter((p) => p !== next) : later;

  const openUnlocked = open ? unlocked.has(open.id) : false;
  const openFrom = open ? lessonUnlocking(open.id, outline) : undefined;
  const openLesson = openFrom ? outline.lessons[openFrom] : undefined;

  return (
    <div className="parts-bin">
      <p className="sr-only" aria-live="polite">
        {m.parts.unlocked(unlocked.size, parts.length)}
      </p>
      <ul className="parts-grid">
        {owned.map((p) => (
          <li key={p.id}>
            <button type="button" className="part-slip" onClick={() => setOpen(p)} aria-label={m.parts.details(p.name)} data-part={p.id}>
              <span className="part-slip__art">
                <PartIcon kind={p.icon} size={88} />
              </span>
              <span className="part-slip__name">{p.name}</span>
            </button>
          </li>
        ))}
        {next && nextLesson && (
          <li>
            <a className="part-slip part-slip--next" href={nextLesson.href} data-part-next={next.id}>
              <span className="part-slip__art">
                <PartIcon kind={next.icon} size={88} state="locked" />
              </span>
              <span className="kicker">{m.parts.next}</span>
              <span className="part-slip__name">{next.name}</span>
              <span className="part-slip__meta">
                {m.parts.inLesson(nextLesson.title)}
                <Icon name="arrow-right" size={14} />
              </span>
            </a>
          </li>
        )}
      </ul>
      {rest.length > 0 && (
        <section className="parts-later" aria-labelledby="parts-later-title">
          <h2 className="kicker" id="parts-later-title">
            {m.parts.later(rest.length)}
          </h2>
          <ul className="parts-later__grid">
            {rest.map((p) => (
              <li key={p.id}>
                <button type="button" className="part-ghost" onClick={() => setOpen(p)} aria-label={`${m.parts.lockedPart}: ${p.name}`} title={p.name} data-part={p.id}>
                  <PartIcon kind={p.icon} size={48} state="locked" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        variant="sheet"
        title={open?.name ?? ""}
        description={open ? (openUnlocked ? open.blurb : openLesson ? m.parts.unlocksIn(openLesson.title) : m.parts.unlocksLater) : undefined}
      >
        {open && (
          <div className="part-detail">
            <PartPreview kind={open.icon} locked={!openUnlocked} name={open.name} />
            <h3 className="kicker">{m.parts.keyFacts}</h3>
            <ul className="facts">
              {open.facts.map((f, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: f }} />
              ))}
            </ul>
            {openLesson && (
              <Button href={openLesson.href} variant={openUnlocked ? "secondary" : "primary"} iconEnd="arrow-right">
                {m.parts.openLesson}
              </Button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
