/** The lab's task list: the current task large, with hints, notebook entries, "Show me" and skipping for bonuses. */
import { useId, useState } from "react";
import { useStore } from "zustand";
import { Icon } from "../components/Icon";
import { blockMd } from "../content/markdown";
import { m } from "../i18n";
import { XP } from "../progress/xp";
import { isOptional, type LabTask, type NoteSpec } from "./define";
import type { LabRuntime } from "./runtime";

export type HintState = Record<string, number>;

const notesOf = (t: LabTask): NoteSpec[] => (t.note ? (Array.isArray(t.note) ? t.note : [t.note]) : []);

export function TaskList({ runtime, hints, onHint }: { runtime: LabRuntime; hints: HintState; onHint(task: LabTask): void }) {
  const status = useStore(runtime.ui, (s) => s.status);
  const fresh = useStore(runtime.ui, (s) => s.fresh);
  const showing = useStore(runtime.ui, (s) => s.showing);
  const tasks = runtime.lab.tasks;
  const required = tasks.filter((t) => !isOptional(t));
  const current = required.find((t) => status[t.id] === "todo");
  return (
    <ol className="lab-tasks" aria-label={m.lab.taskList}>
      {tasks.map((t) => {
        const st = status[t.id] ?? "todo";
        const optional = isOptional(t);
        const isCurrent = t === current;
        const upcoming = !optional && st === "todo" && !isCurrent;
        const n = required.indexOf(t) + 1;
        return (
          <li
            key={t.id}
            className="lab-task"
            data-task={t.id}
            data-state={st}
            data-current={isCurrent || undefined}
            data-fresh={fresh.includes(t.id) || undefined}
            data-optional={optional || undefined}
            data-upcoming={upcoming || undefined}
          >
            <span className="lab-task__badge mono" aria-hidden="true">
              {st === "done" ? <Icon name="check" size={16} strokeWidth={2.5} /> : optional ? <Icon name="star" size={15} /> : n}
            </span>
            <div className="lab-task__body">
              {optional && <span className="lab-task__eyebrow">{m.lab.bonus}</span>}
              {isCurrent && <span className="lab-task__eyebrow">{m.lab.taskCurrent}</span>}
              <div className="lab-task__prompt prose" dangerouslySetInnerHTML={{ __html: blockMd(t.prompt) }} />
              <span className="sr-only">{st === "done" ? m.lab.taskDone : st === "skipped" ? m.lab.taskSkipped : m.lab.taskTodo}</span>
              {st === "done" && (
                <div className="lab-task__success">
                  <div className="prose" dangerouslySetInnerHTML={{ __html: blockMd(t.success) }} />
                  <span className="lab-task__xp mono">{m.lab.xp(XP.task)}</span>
                  {t.notice && (
                    <p className="lab-task__notice small">
                      <strong>{m.lab.notice}.</strong> <span dangerouslySetInnerHTML={{ __html: blockMd(t.notice).replace(/^<p>|<\/p>$/g, "") }} />
                    </p>
                  )}
                </div>
              )}
              {st === "todo" && (isCurrent || optional) && (
                <TaskTools task={t} runtime={runtime} shown={hints[t.id] ?? 0} onHint={() => onHint(t)} showing={showing === t.id} busy={!!showing} optional={optional} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TaskTools({ task, runtime, shown, onHint, showing, busy, optional }: { task: LabTask; runtime: LabRuntime; shown: number; onHint(): void; showing: boolean; busy: boolean; optional: boolean }) {
  const allHints = shown >= task.hints.length;
  const canShow = runtime.canShow(task.id);
  return (
    <div className="lab-task__tools">
      {notesOf(task).map((n) => (
        <NoteField key={n.id} spec={n} runtime={runtime} />
      ))}
      {shown > 0 && (
        <ol className="lab-task__hints" aria-label={m.lab.hintCount(shown, task.hints.length)}>
          {task.hints.slice(0, shown).map((h, i) => (
            <li key={i} className="lab-task__hint" dangerouslySetInnerHTML={{ __html: blockMd(h) }} />
          ))}
        </ol>
      )}
      <div className="lab-task__buttons">
        {!allHints && (
          <button type="button" className="btn btn--small btn--soft" onClick={onHint} data-hint>
            <Icon name="hint" size={16} />
            {shown === 0 ? m.lab.hint : m.lab.nextHint}
          </button>
        )}
        {allHints && canShow && (
          <button type="button" className="btn btn--small btn--soft" onClick={() => void runtime.showMe(task.id)} disabled={busy} aria-busy={showing || undefined} data-show-me>
            <Icon name="play" size={16} />
            {showing ? m.lab.showing : m.lab.showMe}
          </button>
        )}
        {optional && (
          <button type="button" className="btn btn--small btn--tertiary" onClick={() => runtime.skip(task.id)}>
            {m.lab.skip}
          </button>
        )}
      </div>
    </div>
  );
}

function NoteField({ spec, runtime }: { spec: NoteSpec; runtime: LabRuntime }) {
  const id = useId();
  const [text, setText] = useState("");
  const [state, setState] = useState<"empty" | "ok" | "bad">("empty");
  return (
    <div className="note-field">
      <label htmlFor={id} className="note-field__label small">
        <Icon name="book" size={15} />
        {spec.label}
      </label>
      <div className="note-field__row">
        <input
          id={id}
          className="input note-field__input mono"
          inputMode="decimal"
          autoComplete="off"
          placeholder={m.lab.notePlaceholder}
          value={text}
          aria-invalid={state === "bad" || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const v = runtime.setNote(spec.id, e.target.value);
            setState(e.target.value.trim() === "" ? "empty" : v === null ? "bad" : "ok");
          }}
        />
        {spec.unit && <span className="note-field__unit">{spec.unit}</span>}
      </div>
      {state === "bad" && <p className="small note-field__bad">{m.lab.noteBad}</p>}
    </div>
  );
}
