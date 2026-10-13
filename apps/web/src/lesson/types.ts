import type { LessonData } from "../content/load";
import type { CourseOutline } from "../content/outline";
import type { Step } from "../content/schema";
import type { PartIconKind } from "../parts/kinds";

export type Answers = Record<string, unknown>;

export type PartInfo = { id: string; name: string; icon: PartIconKind };

/** Everything the lesson page passes to the player island. */
export type PlayerProps = {
  lesson: LessonData;
  outline: CourseOutline;
  /** Parts mentioned by this lesson (hook visuals, unlocks), by id. */
  parts: Record<string, PartInfo>;
  module: { id: string; title: string; landmark: { id: string; name: string } };
  next: { title: string; href: string } | null;
  mapHref: string;
};

export type StepProps<S extends Step = Step> = {
  step: S;
  index: number;
  lesson: LessonData;
  parts: Record<string, PartInfo>;
  answers: Answers;
  /** Stores an answer; pass a function to derive it from the previous value. */
  setAnswer(key: string, value: unknown): void;
  onNext(): void;
  onBack: (() => void) | undefined;
  announce(text: string): void;
};

export const answerKey = {
  predict: (step: number) => `predict:${step}`,
  card: (step: number) => `card:${step}`,
  quizIndex: (step: number) => `quiz:${step}`,
  item: (id: string) => `item:${id}`,
  tasks: (lab: string) => `tasks:${lab}`,
};
