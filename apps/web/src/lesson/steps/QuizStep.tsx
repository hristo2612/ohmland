import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { QuizItem, QuizStep as QuizStepT } from "../../content/schema";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { Mascot } from "../../mascot/Mascot";
import { m } from "../../i18n";
import { ChoiceItem } from "../../quiz/ChoiceItem";
import { ColorCodeItem } from "../../quiz/ColorCodeItem";
import { canCheck } from "../../quiz/grade";
import { correctValue, evaluate } from "../../quiz/evaluate";
import { HotspotItem } from "../../quiz/HotspotItem";
import { MatchItem } from "../../quiz/MatchItem";
import { NumericField } from "../../quiz/NumericItem";
import { OrderItem } from "../../quiz/OrderItem";
import type { ItemRecord, Outcome } from "../../quiz/types";
import { StepActions, type Action } from "../StepActions";
import { answerKey, type StepProps } from "../types";
import "../../quiz/quiz.css";

const EMPTY: ItemRecord = { tries: 0, firstCorrect: false, correct: false, done: false };

function recordOf(v: unknown): ItemRecord {
  return typeof v === "object" && v !== null && "tries" in v ? { ...EMPTY, ...(v as ItemRecord) } : EMPTY;
}

/** The quiz: one question at a time. The first try counts for XP; retries are always allowed, with feedback. */
export function QuizStep({ step, index, answers, setAnswer, onNext, onBack, announce }: StepProps<QuizStepT>) {
  const qKey = answerKey.quizIndex(index);
  const n = step.items.length;
  const qi = Math.min(n - 1, Math.max(0, typeof answers[qKey] === "number" ? (answers[qKey] as number) : 0));
  const item = step.items[qi];
  if (!item) return null;

  const advance = () => {
    if (qi < n - 1) setAnswer(qKey, qi + 1);
    else onNext();
  };
  const back = qi > 0 ? () => setAnswer(qKey, qi - 1) : onBack;

  return (
    <QuizItemPanel
      key={item.id}
      item={item}
      position={qi}
      count={n}
      records={step.items.map((it) => recordOf(answers[answerKey.item(it.id)]))}
      record={recordOf(answers[answerKey.item(item.id)])}
      save={(r) => setAnswer(answerKey.item(item.id), r)}
      onDone={advance}
      onBack={back}
      announce={announce}
    />
  );
}

type PanelProps = {
  item: QuizItem;
  position: number;
  count: number;
  records: ItemRecord[];
  record: ItemRecord;
  save(r: ItemRecord): void;
  onDone(): void;
  onBack: (() => void) | undefined;
  announce(text: string): void;
};

function QuizItemPanel({ item, position, count, records, record, save, onDone, onBack, announce }: PanelProps) {
  const [value, setValue] = useState<unknown>(record.value);
  const [outcome, setOutcome] = useState<Outcome | null>(record.done ? { correct: record.correct, lines: [] } : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // A new question takes focus when the previous one handed it over (keyboard users land on the question).
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus();
  }, []);

  const done = record.done;
  const wrongShowing = !done && !!outcome && !outcome.correct;
  const locked = done || wrongShowing;
  const reveal = done;

  useEffect(() => {
    if (outcome && !done) feedbackRef.current?.focus({ preventScroll: false });
  }, [outcome, done]);

  const onChange = useCallback((v: unknown) => {
    setValue(v);
    setNotice(null);
  }, []);

  const check = () => {
    if (done || wrongShowing || !canCheck(item, value)) return;
    const o = evaluate(item, value);
    if (o.noTry) {
      setNotice(o.lines[0] ?? null);
      return;
    }
    const tries = record.tries + 1;
    if (o.correct) {
      save({ ...record, tries, firstCorrect: record.tries === 0, correct: true, done: true, value });
      announce(m.quiz.correct);
    } else {
      save({ ...record, tries, value });
      announce(`${m.quiz.incorrect} ${o.lines.join(" ")}`);
    }
    setOutcome(o);
  };

  const retry = () => {
    setOutcome(null);
    setShowHint(false);
    // Hand focus back to the answer controls so the next try starts where it happens.
    requestAnimationFrame(() => {
      const target = itemRef.current?.querySelector<HTMLElement>(
        "input:not([disabled]):not([type=hidden]), button:not([disabled]), [tabindex='0']",
      );
      target?.focus();
    });
  };

  const giveUp = () => {
    const answer = correctValue(item);
    setValue(answer);
    save({ ...record, done: true, gaveUp: true, correct: false, value: answer });
    setOutcome({ correct: false, lines: [] });
  };

  /** Enter in a text field runs whatever the primary button would do right now. */
  const submit = () => (done ? onDone() : wrongShowing ? retry() : check());
  const viewProps = { value, onChange, locked, outcome: done ? null : outcome, reveal, announce, onSubmit: submit };
  let view: ReactNode;
  switch (item.type) {
    case "choice":
      view = <ChoiceItem item={item} {...viewProps} value={value as number[] | undefined} />;
      break;
    case "numeric":
      view = (
        <NumericField
          value={value as string | undefined}
          onChange={onChange}
          unit={item.unit}
          locked={locked}
          state={done ? (record.gaveUp ? undefined : "right") : wrongShowing ? "wrong" : undefined}
          onSubmit={submit}
        />
      );
      break;
    case "order":
      view = <OrderItem item={item} {...viewProps} value={value as number[] | undefined} />;
      break;
    case "match":
      view = <MatchItem item={item} {...viewProps} value={value as Record<number, number> | undefined} />;
      break;
    case "color-code":
      view = <ColorCodeItem item={item} {...viewProps} value={value as string | undefined} />;
      break;
    case "hotspot":
      view = <HotspotItem item={item} {...viewProps} value={value as string | undefined} />;
      break;
  }

  const last = position === count - 1;
  let primary: Action;
  let secondary: Action | undefined;
  if (done) primary = { label: last ? m.quiz.finishQuiz : m.quiz.next, onClick: onDone };
  else if (wrongShowing) {
    primary = { label: m.quiz.tryAgain, onClick: retry, icon: "retry" };
    if (record.tries >= 2) secondary = { label: m.quiz.showAnswer, onClick: giveUp };
  } else primary = { label: m.quiz.check, onClick: check, disabled: !canCheck(item, value), icon: "check" };

  const rightLine = m.mascot.right[item.id.length % m.mascot.right.length] ?? m.quiz.correct;

  return (
    <>
      <div className="step-body quiz" data-item-type={item.type}>
        <div className="quiz__head">
          <p className="step-eyebrow">
            <span>{m.lesson.quizTitle}</span>
          </p>
          <ol className="dots" aria-label={m.quiz.questionOf(position + 1, count)}>
            {records.map((r, i) => (
              <li
                key={i}
                className="dots__dot"
                data-state={i === position ? "current" : r.done ? (r.firstCorrect ? "right" : "done") : "todo"}
              />
            ))}
          </ol>
        </div>
        <h1
          ref={headingRef}
          className="step-title step-title--question"
          tabIndex={-1}
          data-step-heading
          dangerouslySetInnerHTML={{ __html: item.prompt }}
        />

        <div className="quiz__item" ref={itemRef}>
          {view}
        </div>

        {notice && (
          <p className="quiz__notice" role="status">
            <Icon name="info" size={18} />
            {notice}
          </p>
        )}

        <div className="feedback-slot" aria-live="polite">
          {(done || wrongShowing) && (
            <div className="feedback" data-tone={done ? (record.gaveUp ? "info" : "good") : "bad"} tabIndex={-1} ref={feedbackRef}>
              <div className="feedback__verdict">
                <span className="feedback__icon">
                  <Icon name={done ? (record.gaveUp ? "info" : "check") : "close"} size={18} strokeWidth={2.5} />
                </span>
                <span>{done ? (record.gaveUp ? m.quiz.answerShown : m.quiz.correct) : m.quiz.incorrect}</span>
                {done && record.firstCorrect && (
                  <Badge tone="accent" icon="star">
                    {m.quiz.firstTry}
                  </Badge>
                )}
                {done && !record.firstCorrect && !record.gaveUp && <span className="feedback__tries small">{m.quiz.answeredAfter(record.tries)}</span>}
              </div>
              {!done && outcome?.lines.map((l, i) => <p key={i} className="feedback__line" dangerouslySetInnerHTML={{ __html: l }} />)}
              {!done && outcome?.lines.length === 0 && <p className="feedback__line">{m.mascot.wrong}</p>}
              {!done && item.hint && (
                <div className="feedback__hint">
                  {showHint ? (
                    <p>
                      <strong>{m.quiz.hintLabel}: </strong>
                      <span dangerouslySetInnerHTML={{ __html: item.hint }} />
                    </p>
                  ) : (
                    <button type="button" className="btn btn--small btn--tertiary" onClick={() => setShowHint(true)}>
                      <Icon name="hint" size={16} />
                      {m.quiz.hint}
                    </button>
                  )}
                </div>
              )}
              {done && (
                <div className="feedback__explain">
                  {!record.gaveUp && <Mascot pose="happy" size={48} />}
                  <div>
                    {!record.gaveUp && <p className="feedback__cheer">{rightLine}</p>}
                    <div className="prose" dangerouslySetInnerHTML={{ __html: item.explain }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <StepActions onBack={onBack} primary={primary} secondary={secondary} />
    </>
  );
}
