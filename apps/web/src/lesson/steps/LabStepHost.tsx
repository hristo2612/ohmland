import { Suspense } from "react";
import type { LabStep as LabStepT } from "../../content/schema";
import { m } from "../../i18n";
import { LabStepChunk, prefetchLab } from "../../lab/prefetch";
import { StepActions } from "../StepActions";
import { answerKey, type StepProps } from "../types";

/**
 * The lab runtime is heavy (three.js, the simulator worker), so it is always a separate chunk. Usually it is warm by
 * now (the player prefetches it on the step before); it then renders at once.
 */
const LabStep = LabStepChunk.Component;

/**
 * The lab fills the stage between the lesson bar and the action bar. Continue is always available: required tasks
 * guide the learner, they never trap them (a browser without WebGL can still finish the lesson).
 */
export function LabStepHost({ step, lesson, answers, setAnswer, onNext, onBack }: StepProps<LabStepT>) {
  // A lesson resumed at its lab was never warmed: start the step, the lab, the bench and the simulator together
  // rather than one after another. (Idempotent: a warmed lab is not fetched again.)
  prefetchLab(step.lab);
  const key = answerKey.tasks(step.lab);
  const done = Array.isArray(answers[key]) ? (answers[key] as string[]) : [];
  return (
    <>
      <div className="step-body step-body--lab">
        <h1 className="step-title sr-only" tabIndex={-1} data-step-heading>
          {m.lesson.labTitle}
        </h1>
        <Suspense fallback={<div className="lab-loading skeleton" role="status" aria-label={m.lab.loading} />}>
          <LabStep
            labId={step.lab}
            lessonId={lesson.id}
            intro={step.intro}
            done={done}
            onTaskDone={(id) => setAnswer(key, (prev: unknown) => [...new Set([...(Array.isArray(prev) ? (prev as string[]) : []), id])])}
          />
        </Suspense>
      </div>
      <StepActions onBack={onBack} primary={{ label: m.lab.continue, onClick: onNext }} />
    </>
  );
}
