import { useEffect, useRef } from "react";
import type { ExplainStep as ExplainStepT } from "../../content/schema";
import { MascotSay } from "../../components/MascotSay";
import { m } from "../../i18n";
import { StepActions } from "../StepActions";
import { answerKey, type StepProps } from "../types";
import { Widget } from "../widgets/registry";

/** Explanation cards, one at a time, each short enough for a phone screen. */
export function ExplainStep({ step, index, answers, setAnswer, onNext, onBack, announce }: StepProps<ExplainStepT>) {
  const key = answerKey.card(index);
  const n = step.cards.length;
  const card = Math.min(n - 1, Math.max(0, typeof answers[key] === "number" ? (answers[key] as number) : 0));
  const c = step.cards[card];
  const titleRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [card]);

  if (!c) return null;
  const go = (to: number) => {
    setAnswer(key, to);
    announce(m.lesson.cardOf(to + 1, n));
  };
  const last = card === n - 1;

  return (
    <>
      <div className="step-body">
        <div className="explain__head">
          <p className="step-eyebrow">
            <span>{m.lesson.stepNames.explain}</span>
          </p>
          <ol className="dots" aria-label={m.lesson.cardOf(card + 1, n)}>
            {step.cards.map((_, i) => (
              <li key={i} className="dots__dot" data-state={i < card ? "done" : i === card ? "current" : "todo"} />
            ))}
          </ol>
        </div>
        <div className="explain-deck" data-remaining={Math.min(2, n - card - 1)}>
        <article className="explain-card" key={card} aria-roledescription={m.lesson.cardRole}>
          <h1 className="step-title" ref={titleRef} tabIndex={-1} data-step-heading>
            {c.title}
          </h1>
          <div className="prose step-prose" dangerouslySetInnerHTML={{ __html: c.body }} />
          {c.widget && <Widget kind={c.widget.kind} props={c.widget.props} />}
          {c.mascot && (
            <MascotSay pose="happy" className="explain-card__say">
              {c.mascot}
            </MascotSay>
          )}
        </article>
        </div>
      </div>
      <StepActions
        onBack={card > 0 ? () => go(card - 1) : onBack}
        primary={last ? { label: m.lesson.continue, onClick: onNext } : { label: m.lesson.next, onClick: () => go(card + 1) }}
      />
    </>
  );
}
