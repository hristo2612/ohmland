import { useMemo, useState } from "react";
import type { CourseOutline } from "../content/outline";
import type { PartFile } from "../content/schema";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { Tabs } from "../components/Tabs";
import { m } from "../i18n";
import { lessonUnlocking, partsBin } from "../progress/parts";
import { emptyLearner } from "../progress/state";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { PartIcon } from "./PartIcon";
import { PartPreview } from "./PartPreview";

const GUEST = emptyLearner();

/** The parts bin: every part, unlocked ones in colour, locked ones as silhouettes, with a details drawer. */
export default function PartsBin({ parts, outline }: { parts: PartFile[]; outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const unlocked = useMemo(() => new Set(partsBin(ready ? learner : GUEST, outline)), [ready, learner, outline]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<PartFile | null>(null);
  const shown = filter === "unlocked" ? parts.filter((p) => unlocked.has(p.id)) : parts;

  const grid = (
    <ul className="parts-grid">
      {shown.map((p) => {
        const isOpen = unlocked.has(p.id);
        const from = lessonUnlocking(p.id, outline);
        return (
          <li key={p.id}>
            <button
              type="button"
              className={isOpen ? "part-tile" : "part-tile part-tile--locked"}
              onClick={() => setOpen(p)}
              aria-label={isOpen ? m.parts.details(p.name) : `${m.parts.lockedPart}: ${p.name}`}
            >
              <span className="part-tile__art">
                <PartIcon kind={p.icon} size={72} state={isOpen ? "normal" : "locked"} />
              </span>
              <span className="part-tile__name">{p.name}</span>
              <span className="part-tile__meta small">
                {isOpen ? (
                  p.blurb
                ) : (
                  <>
                    <Icon name="lock" size={14} />
                    {from ? m.parts.unlocksIn(outline.lessons[from]?.title ?? "") : m.parts.unlocksLater}
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const openUnlocked = open ? unlocked.has(open.id) : false;
  const openFrom = open ? lessonUnlocking(open.id, outline) : undefined;
  const openLesson = openFrom ? outline.lessons[openFrom] : undefined;

  return (
    <div className="parts-bin">
      <div className="parts-bin__bar">
        <p className="small muted tabular" aria-live="polite">
          {m.parts.unlocked(unlocked.size, parts.length)}
        </p>
      </div>
      <Tabs
        label={m.parts.title}
        value={filter}
        onChange={setFilter}
        items={[
          { id: "all", label: m.parts.filterAll, panel: grid },
          { id: "unlocked", label: m.parts.filterUnlocked, panel: grid },
        ]}
      />
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
            {!openUnlocked && (
              <Badge icon="lock" tone="outline">
                {m.parts.locked}
              </Badge>
            )}
            <h3 className="part-detail__facts-title">{m.parts.keyFacts}</h3>
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
