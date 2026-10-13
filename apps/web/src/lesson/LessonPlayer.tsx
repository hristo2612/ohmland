/**
 * The lesson player: a focused, full-screen flow of steps (hook, lab, explain, quiz, wrap) and the finale.
 * Progress is saved after every change and resumed on return. Keyboard: Enter runs the step's primary action when
 * focus is not in a control; focus moves to each step's heading so screen readers hear where they are.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { m } from "../i18n";
import { IconButton } from "../components/IconButton";
import { toast } from "../components/toast-store";
import { prefetchLab } from "../lab/prefetch";
import { flushSaves, useLearner, type Completion } from "../progress/store";
import { useLearnerReady } from "../progress/useLearner";
import type { ItemRecord } from "../quiz/types";
import { Finale } from "./Finale";
import { getIsleHooks, revealWithin, type IsleRevealResult } from "./isle-hooks";
import { ExplainStep } from "./steps/ExplainStep";
import { HookStep } from "./steps/HookStep";
import { LabStepHost } from "./steps/LabStepHost";
import { QuizStep } from "./steps/QuizStep";
import { WrapStep } from "./steps/WrapStep";
import { answerKey, type Answers, type PlayerProps } from "./types";
import "./lesson.css";

const INTERACTIVE = "input, textarea, select, button, a[href], [role=radio], [role=button], [role=tab], [contenteditable=true], summary";

export default function LessonPlayer(props: PlayerProps) {
  const { lesson, outline, parts, module, next, mapHref } = props;
  const ready = useLearnerReady(outline);
  const muted = useLearner((s) => s.learner.settings.muted);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [restored, setRestored] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [isle, setIsle] = useState<IsleRevealResult>(null);
  const [live, setLive] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const lastStep = useRef(0);
  const hooks = useMemo(() => getIsleHooks(), []);
  const steps = lesson.steps;
  const current = steps[step];

  // Resume from the saved in-progress record once the store has loaded.
  useEffect(() => {
    if (!ready || restored) return;
    const saved = useLearner.getState().learner.inProgress[lesson.id];
    if (saved && (saved.version === undefined || saved.version === lesson.version) && saved.step > 0 && saved.step < steps.length) {
      lastStep.current = saved.step;
      setStep(saved.step);
      setAnswers(saved.answers);
      toast({ title: m.lesson.resumed, icon: "play", duration: 3500 });
    }
    setRestored(true);
  }, [ready, restored, lesson.id, lesson.version, steps.length]);

  // Save after every change (only once restored, so a fresh visit never overwrites saved progress).
  useEffect(() => {
    if (!restored || completion) return;
    if (step === 0 && Object.keys(answers).length === 0) return;
    useLearner.getState().saveProgress(lesson.id, { step, answers, version: lesson.version });
  }, [step, answers, restored, completion, lesson.id, lesson.version]);

  // Move focus to the new step's heading.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const h = stageRef.current?.querySelector<HTMLElement>("[data-step-heading], #finale-title");
    h?.focus({ preventScroll: true });
    stageRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [step, completion]);

  // Warm the island once the learner moves on from the quiz (the last quiz step, or the step before the wrap in a
  // lesson without one). Only a step reached in this visit counts, so resuming a lesson never fetches it on load, and
  // a lesson already finished has nothing new to reveal.
  const afterQuiz = useMemo(() => {
    const last = steps.reduce((k, s, i) => (s.type === "quiz" ? i : k), -1);
    return last >= 0 ? last + 1 : steps.length - 1;
  }, [steps]);
  useEffect(() => {
    const from = lastStep.current;
    lastStep.current = step;
    if (step > from && step >= afterQuiz && !useLearner.getState().learner.lessons[lesson.id]) hooks.prefetch();
  }, [step, afterQuiz, hooks, lesson.id]);

  // Warm the lab (its code, the 3D bench chunk and the simulator worker) while the learner reads the step before it:
  // on their first tap or key there, or after a few seconds, never as part of the page's first load.
  useEffect(() => {
    const next = steps[step + 1];
    if (next?.type !== "lab") return;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      prefetchLab(next.lab);
    };
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("keydown", go, opts);
    const timer = window.setTimeout(go, 4000);
    return () => {
      done = true;
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      window.clearTimeout(timer);
    };
  }, [step, steps]);

  // Enter runs the primary action when focus is not in a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body && t.closest(INTERACTIVE)) return;
      const primary = document.querySelector<HTMLButtonElement | HTMLAnchorElement>("[data-primary]");
      if (primary && !(primary as HTMLButtonElement).disabled) {
        e.preventDefault();
        primary.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const announce = useCallback((text: string) => {
    setLive("");
    requestAnimationFrame(() => setLive(text));
  }, []);

  const setAnswer = useCallback(
    (key: string, value: unknown) => setAnswers((a) => ({ ...a, [key]: typeof value === "function" ? (value as (prev: unknown) => unknown)(a[key]) : value })),
    [],
  );
  const goTo = (i: number) => setStep(Math.max(0, Math.min(steps.length - 1, i)));

  const score = useMemo(() => {
    let firstTry = 0;
    let items = 0;
    const tasks: string[] = [];
    for (const s of steps) {
      if (s.type === "quiz")
        for (const it of s.items) {
          items++;
          const r = answers[answerKey.item(it.id)] as ItemRecord | undefined;
          if (r?.firstCorrect) firstTry++;
        }
      if (s.type === "lab") {
        const done = answers[answerKey.tasks(s.lab)];
        if (Array.isArray(done)) tasks.push(...(done as string[]));
      }
    }
    return { firstTry, items, tasks };
  }, [answers, steps]);

  const finish = async () => {
    if (finishing) return;
    if (!muted) hooks.prime();
    setFinishing(true);
    await useLearner.getState().init(outline);
    const result = useLearner.getState().completeLesson({ lessonId: lesson.id, version: lesson.version, ...score });
    await flushSaves();
    // a first finish reveals what the lesson added to the island; a replay adds nothing
    if (!result.replay) setIsle(await revealWithin(hooks, { before: result.before, after: result.after, outline, muted }));
    setCompletion(result);
    setFinishing(false);
  };

  const stepProps = {
    index: step,
    lesson,
    parts,
    answers,
    setAnswer,
    onNext: () => goTo(step + 1),
    onBack: step > 0 ? () => goTo(step - 1) : undefined,
    announce,
  };

  let body: ReactNode = null;
  if (completion) {
    body = <Finale completion={completion} lesson={lesson} parts={parts} module={module} next={next} mapHref={mapHref} firstTry={score.firstTry} items={score.items} isle={isle} />;
  } else if (current) {
    switch (current.type) {
      case "hook":
        body = <HookStep key={step} step={current} {...stepProps} />;
        break;
      case "lab":
        body = <LabStepHost key={step} step={current} {...stepProps} />;
        break;
      case "explain":
        body = <ExplainStep key={step} step={current} {...stepProps} />;
        break;
      case "quiz":
        body = <QuizStep key={step} step={current} {...stepProps} />;
        break;
      case "wrap":
        body = <WrapStep key={step} step={current} {...stepProps} finishing={finishing} onFinish={finish} />;
        break;
    }
  }

  const stepType = completion ? "finale" : current?.type;
  return (
    <div className="lesson" data-step-type={stepType}>
      <header className="lesson-bar">
        <div className="lesson-bar__inner">
          <IconButton label={m.lesson.close} icon="close" href={mapHref} variant="outline" />
          <div
            className="steps-bar"
            role="progressbar"
            aria-label={lesson.title}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={completion ? steps.length : step + 1}
            aria-valuetext={completion ? m.lesson.stepNames.finale : m.lesson.progress(step + 1, steps.length)}
          >
            {steps.map((s, i) => (
              <span key={i} className="steps-bar__seg" data-state={completion || i < step ? "done" : i === step ? "current" : "todo"} title={m.lesson.stepNames[s.type]} />
            ))}
          </div>
          <span className="lesson-bar__count mono" aria-hidden="true">
            {completion ? steps.length : step + 1}/{steps.length}
          </span>
        </div>
      </header>
      <main id="main" className="lesson-stage" ref={stageRef}>
        <div className="lesson-step" key={completion ? "finale" : step}>
          {body}
        </div>
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </div>
    </div>
  );
}
