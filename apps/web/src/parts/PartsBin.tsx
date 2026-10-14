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

/** The parts bin: every part as a pasted slip, yours coloured in, the rest a dashed outline. A tap opens its facts. */
export default function PartsBin({ parts, outline }: { parts: PartFile[]; outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const unlocked = useMemo(() => new Set(partsBin(ready ? learner : GUEST, outline)), [ready, learner, outline]);
  const [open, setOpen] = useState<PartFile | null>(null);

  const openUnlocked = open ? unlocked.has(open.id) : false;
  const openFrom = open ? lessonUnlocking(open.id, outline) : undefined;
  const openLesson = openFrom ? outline.lessons[openFrom] : undefined;

  return (
    <div className="parts-bin">
      <p className="sr-only" aria-live="polite">
        {m.parts.unlocked(unlocked.size, parts.length)}
      </p>
      <ul className="parts-grid">
        {parts.map((p) => {
          const isOpen = unlocked.has(p.id);
          const from = lessonUnlocking(p.id, outline);
          return (
            <li key={p.id}>
              <button
                type="button"
                className={isOpen ? "part-slip" : "part-slip part-slip--locked"}
                onClick={() => setOpen(p)}
                aria-label={isOpen ? m.parts.details(p.name) : `${m.parts.lockedPart}: ${p.name}`}
                data-part={p.id}
              >
                <span className="part-slip__art">
                  <PartIcon kind={p.icon} size={80} state={isOpen ? "normal" : "locked"} />
                </span>
                <span className="part-slip__name">{p.name}</span>
                {!isOpen && (
                  <span className="part-slip__meta">
                    <Icon name="lock" size={14} />
                    {from ? m.parts.unlocksIn(outline.lessons[from]?.title ?? "") : m.parts.unlocksLater}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
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
