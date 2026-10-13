/**
 * XP is derived, never stored (docs/ARCHITECTURE.md): per completed lesson 30 + 10 per first-try quiz item + 15 per
 * lab task, plus 100 per completed module, plus each unlocked achievement's XP.
 */
import type { CourseOutline } from "../content/outline";
import type { LearnerState, LessonRecord } from "./types";

export const XP = { lesson: 30, firstTry: 10, task: 15, module: 100 } as const;

export const lessonXp = (r: Pick<LessonRecord, "firstTry" | "tasks">): number => XP.lesson + XP.firstTry * r.firstTry + XP.task * r.tasks.length;

/** Modules whose every lesson is complete, in course order. */
export function completedModules(state: LearnerState, outline: CourseOutline): string[] {
  return outline.modules.filter((mod) => mod.lessons.length > 0 && mod.lessons.every((id) => state.lessons[id])).map((mod) => mod.id);
}

export type XpBreakdown = { lessons: number; modules: number; achievements: number; total: number };

export function xpBreakdown(state: LearnerState, outline: CourseOutline, achievementXp: (id: string) => number = () => 0): XpBreakdown {
  const lessons = Object.values(state.lessons).reduce((sum, r) => sum + lessonXp(r), 0);
  const modules = completedModules(state, outline).length * XP.module;
  const achievements = Object.keys(state.achievements).reduce((sum, id) => sum + achievementXp(id), 0);
  return { lessons, modules, achievements, total: lessons + modules + achievements };
}
