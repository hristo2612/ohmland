/**
 * The lab step. For now a placeholder panel: it loads the lab definition, shows a sketch of the bench and the
 * tasks, and lets the learner continue. In dev builds it adds tools to mark tasks done and fry a part, so the rest
 * of the flow (task XP, the Hall of Fried Parts) can be exercised before the bench and simulator land.
 */
import { useEffect, useState } from "react";
import { Badge } from "../components/Badge";
import { Icon } from "../components/Icon";
import { MascotSay } from "../components/MascotSay";
import { blockMd } from "../content/markdown";
import { m } from "../i18n";
import { PartIcon } from "../parts/PartIcon";
import type { PartIconKind } from "../parts/kinds";
import { useLearner } from "../progress/store";
import type { LabDefinition } from "./define";
import { loadLab } from "./labs";
import "./lab.css";

export type LabStepProps = {
  labId: string;
  lessonId: string;
  intro?: string | undefined;
  done: string[];
  onTaskDone(taskId: string): void;
};

const KIND_ICON: Partial<Record<string, PartIconKind>> = {
  battery: "battery",
  resistor: "resistor",
  led: "led",
  switch: "switch",
  pushbutton: "pushbutton",
  fuse: "fuse",
  capacitor: "capacitor",
  pot: "pot",
  relay: "relay",
  npn: "transistor",
  phototransistor: "phototransistor",
  diode: "diode",
  speaker: "speaker",
  multimeter: "multimeter",
  cell: "cell",
  wire: "jumper-wire",
};

export default function LabStep({ labId, lessonId, intro, done, onTaskDone }: LabStepProps) {
  const [lab, setLab] = useState<LabDefinition | null>(null);
  const [failed, setFailed] = useState(false);
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    loadLab(labId)
      .then((l) => alive && setLab(l))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [labId]);

  if (failed) return <p className="notice notice--warn">{m.lab.failed}</p>;
  if (!lab) return <div className="lab-loading skeleton" aria-label={m.lab.loading} role="status" />;

  const kinds = [...new Set([...lab.bench.parts.map((p) => p.kind), ...lab.bench.tray.map((t) => t.kind)])];
  const icons = kinds.map((k) => KIND_ICON[k]).filter((k): k is PartIconKind => !!k);
  if (lab.bench.instruments.includes("meter")) icons.push("multimeter");

  return (
    <div className="lab" data-lab-ready>
      <div className="lab__bench" aria-hidden="true">
        <div className="lab__board">
          <div className="lab__rail lab__rail--plus" />
          <div className="lab__holes" />
          <div className="lab__rail lab__rail--minus" />
        </div>
        <div className="lab__tray">
          {icons.map((k) => (
            <span key={k} className="lab__tray-slot">
              <PartIcon kind={k} size={52} />
            </span>
          ))}
        </div>
        <div className="lab__soon">
          <Badge tone="solid" icon="tools">
            {m.lab.soonEyebrow}
          </Badge>
        </div>
      </div>

      <div className="lab__side">
        <div className="lab__intro">
          <h2 className="lab__title">{m.lab.soonTitle}</h2>
          <p className="muted">{m.lab.soonBody}</p>
          {intro && <div className="prose" dangerouslySetInnerHTML={{ __html: intro }} />}
        </div>

        <h3 className="lab__tasks-title">{m.lab.tasksTitle}</h3>
        <ol className="lab__tasks">
          {lab.tasks.map((t, i) => {
            const isDone = done.includes(t.id);
            return (
              <li key={t.id} className="lab-task" data-done={isDone || undefined}>
                <span className="lab-task__num mono" aria-hidden="true">
                  {isDone ? <Icon name="check" size={16} strokeWidth={2.5} /> : i + 1}
                </span>
                <div className="lab-task__body">
                  <div className="prose" dangerouslySetInnerHTML={{ __html: blockMd(t.prompt) }} />
                  <span className="sr-only">{isDone ? m.lab.taskDone : m.lab.taskTodo}</span>
                  {isDone && <div className="lab-task__success prose" dangerouslySetInnerHTML={{ __html: blockMd(t.success) }} />}
                  {t.hints.length > 0 && (
                    <details
                      className="lab-task__hints"
                      open={!!openHints[t.id]}
                      onToggle={(e) => setOpenHints((h) => ({ ...h, [t.id]: (e.target as HTMLDetailsElement).open }))}
                    >
                      <summary>
                        <Icon name="hint" size={16} />
                        {m.lab.hintsTitle}
                      </summary>
                      <ol>
                        {t.hints.map((h, hi) => (
                          <li key={hi} dangerouslySetInnerHTML={{ __html: blockMd(h) }} />
                        ))}
                      </ol>
                    </details>
                  )}
                  {import.meta.env.DEV && !isDone && (
                    <button type="button" className="btn btn--small btn--soft lab-task__dev" onClick={() => onTaskDone(t.id)}>
                      <Icon name="check" size={16} />
                      {m.lab.markDone} ({m.dev.label})
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <MascotSay pose="idle" size={64} className="lab__say">
          {m.mascot.labHint}
        </MascotSay>

        {import.meta.env.DEV && (
          <div className="lab__dev">
            <p className="small muted">{m.lab.devTools}</p>
            <button type="button" className="btn btn--small btn--secondary" onClick={() => useLearner.getState().recordFried("led", m.lab.friedLabel, lessonId)}>
              <Icon name="flame" size={16} />
              {m.lab.fryLed} ({m.dev.label})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
