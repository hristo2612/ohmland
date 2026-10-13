/** The learner record (docs/ARCHITECTURE.md, "Learner progress"). XP, levels and the parts bin are derived from it. */
export type LessonId = string;
export type AchievementId = string;

export type LessonRecord = {
  /** ISO time of first completion. */
  at: string;
  /** Lesson version completed. */
  version: number;
  /** Quiz items right on the first try. */
  firstTry: number;
  /** Quiz items total. */
  items: number;
  /** Lab task ids completed. */
  tasks: string[];
};

export type InProgress = { step: number; answers: Record<string, unknown>; at: string; version?: number };

export type FriedPart = { kind: string; label: string; lessonId: string | null; at: string };

export type Settings = {
  muted: boolean;
  reducedMotion: "system" | "on" | "off";
  theme: "system" | "light" | "dark";
};

export type SavedBench = { name: string; bench: unknown; at: string };

export type LearnerState = {
  v: 1;
  lessons: Record<LessonId, LessonRecord>;
  inProgress: Record<LessonId, InProgress>;
  achievements: Record<AchievementId, { at: string }>;
  /** The Hall of Fried Parts, oldest first, capped at FRIED_CAP. */
  fried: FriedPart[];
  sandbox: { saved: Record<string, SavedBench> };
  settings: Settings;
  updatedAt: string;
};

export const FRIED_CAP = 500;
