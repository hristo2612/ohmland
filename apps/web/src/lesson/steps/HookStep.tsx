import { useId } from "react";
import type { HookStep as HookStepT } from "../../content/schema";
import { Icon } from "../../components/Icon";
import { MascotSay } from "../../components/MascotSay";
import { m } from "../../i18n";
import { plainText } from "../../lib/text";
import { PartIcon } from "../../parts/PartIcon";
import { StepActions } from "../StepActions";
import { answerKey, type StepProps } from "../types";

/** The scene-setter: a picture, a few lines, and an optional ungraded guess. */
export function HookStep({ step, index, lesson, parts, answers, setAnswer, onNext, onBack, announce }: StepProps<HookStepT>) {
  const groupId = useId();
  const key = answerKey.predict(index);
  const chosen = typeof answers[key] === "number" ? (answers[key] as number) : null;
  const visual = step.visual;
  const part = visual?.kind === "part" ? parts[visual.part] : undefined;

  const choose = (i: number) => {
    setAnswer(key, i);
    const option = step.predict?.options[i];
    if (option) announce(m.lesson.predictChosen(plainText(option)));
  };

  return (
    <>
      <div className="step-body step-body--split">
        <div className="hook__copy">
          <p className="step-eyebrow">
            <span>{m.lesson.stepNames.hook}</span>
            <span aria-hidden="true">·</span>
            <span>{m.common.minutes(lesson.minutes)}</span>
          </p>
          <h1 className="step-title" tabIndex={-1} data-step-heading>
            {step.title ?? lesson.title}
          </h1>
          <div className="prose step-prose" dangerouslySetInnerHTML={{ __html: step.body }} />

          {step.predict && (
            <fieldset className="predict" aria-describedby={`${groupId}-note`}>
              <legend className="predict__title">
                <Icon name="hint" size={18} />
                {m.lesson.predictTitle}
              </legend>
              <p className="predict__prompt" dangerouslySetInnerHTML={{ __html: step.predict.prompt }} />
              <div className="predict__options">
                {step.predict.options.map((o, i) => (
                  <label key={i} className="predict__option" data-predict-option data-picked={chosen === i || undefined}>
                    <input type="radio" name={groupId} className="sr-only" checked={chosen === i} onChange={() => choose(i)} />
                    <span className="predict__letter mono" aria-hidden="true">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: o }} />
                  </label>
                ))}
              </div>
              <p id={`${groupId}-note`} className="predict__note small">
                {m.lesson.predictNote}
              </p>
            </fieldset>
          )}
        </div>

        <div className="hook__visual">
          <div className="hook__stage" aria-hidden={!visual || visual.kind !== "image"}>
            <div className="hook__glow" />
            {part && <PartIcon kind={part.icon} size={192} label={part.name} />}
            {visual?.kind === "image" && <img src={visual.src} alt={visual.alt} className="hook__image" />}
          </div>
          <MascotSay pose={chosen !== null ? "happy" : "thinking"} className="hook__say">
            {step.mascot ?? m.mascot.hook}
          </MascotSay>
        </div>
      </div>

      <StepActions
        onBack={onBack}
        primary={
          step.predict
            ? { label: m.lesson.findOut, onClick: onNext, disabled: chosen === null }
            : { label: m.lesson.continue, onClick: onNext }
        }
        secondary={step.predict && chosen === null ? { label: m.lesson.skipPredict, onClick: onNext } : undefined}
      />
    </>
  );
}
