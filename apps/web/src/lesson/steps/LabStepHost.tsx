import { lazy, Suspense } from "react";
import type { LabStep as LabStepT } from "../../content/schema";
import { m } from "../../i18n";
import { StepActions } from "../StepActions";
import { answerKey, type StepProps } from "../types";

/** The lab runtime is heavy (three.js, the simulator worker), so it is always a separate, lazy chunk. */
const LabStep = lazy(() => import("../../lab/LabStep"));

export function LabStepHost({ step, lesson, answers, setAnswer, onNext, onBack }: StepProps<LabStepT>) {
  const key = answerKey.tasks(step.lab);
  const done = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
  return (
    <>
      <div className="step-body step-body--wide">
        <p className="step-eyebrow">
          <span>{m.lesson.stepNames.lab}</span>
        </p>
        <h1 className="step-title sr-only" tabIndex={-1} data-step-heading>
          {m.lesson.labTitle}
        </h1>
        <Suspense fallback={<div className="lab-loading skeleton" role="status" aria-label={m.lab.loading} />}>
          <LabStep labId={step.lab} lessonId={lesson.id} intro={step.intro} done={done} onTaskDone={(id) => setAnswer(key, [...new Set([...done, id])])} />
        </Suspense>
      </div>
      <StepActions onBack={onBack} primary={{ label: m.lab.continue, onClick: onNext }} />
    </>
  );
}
