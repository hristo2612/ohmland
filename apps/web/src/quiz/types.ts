import type { QuizItem } from "../content/schema";

/** What a check found, in the shape the item views draw. */
export type Outcome = {
  correct: boolean;
  /** Short feedback lines (HTML from content, or plain text from i18n). */
  lines: string[];
  /** The input was not something we could grade (an empty or unreadable number): do not count it as a try. */
  noTry?: boolean;
  /** Choice: option indices to mark wrong. */
  wrong?: number[];
};

/** What the lesson record keeps for each quiz item (answers["item:<id>"]). */
export type ItemRecord = {
  tries: number;
  firstCorrect: boolean;
  correct: boolean;
  /** Finished: answered right, or the learner chose to see the answer. */
  done: boolean;
  gaveUp?: boolean;
  value?: unknown;
};

export type ItemViewProps<V, I extends QuizItem = QuizItem> = {
  item: I;
  value: V | undefined;
  onChange(value: V): void;
  /** No edits allowed (showing feedback, or finished). */
  locked: boolean;
  outcome: Outcome | null;
  /** Show the right answer (after a correct answer or when the learner gave up). */
  reveal: boolean;
  /** Announces a change politely to screen readers. */
  announce(text: string): void;
  /** Runs the step's primary action (Enter in a text field). */
  onSubmit?(): void;
};
