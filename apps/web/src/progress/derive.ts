/** Everything the UI shows that is derived from the learner record: XP, level, parts, course-map states. */
import type { CourseOutline } from "../content/outline";
import { achievementXp } from "./achievements";
import { levelProgress, type LevelProgress } from "./levels";
import { partsBin } from "./parts";
import type { LearnerState } from "./types";
import { completedModules, xpBreakdown, type XpBreakdown } from "./xp";

export type Derived = {
  xp: XpBreakdown;
  level: LevelProgress;
  parts: string[];
  modulesDone: string[];
  lessonsDone: number;
};

export function derive(state: LearnerState, outline: CourseOutline): Derived {
  const xp = xpBreakdown(state, outline, achievementXp);
  return {
    xp,
    level: levelProgress(xp.total),
    parts: partsBin(state, outline),
    modulesDone: completedModules(state, outline),
    lessonsDone: Object.keys(state.lessons).length,
  };
}

export const totalXp = (state: LearnerState, outline: CourseOutline): number => xpBreakdown(state, outline, achievementXp).total;

export type LessonState = "done" | "current" | "open" | "locked";

/** The course's on-ramp. A learner who has finished a lesson in any later unit came in past it. */
const ON_RAMP = "start-here";

/** Whether a lesson is in the on-ramp and the learner has moved past it: open to them, never their current lesson. */
function passedOnRamp(state: LearnerState, outline: CourseOutline): (id: string) => boolean {
  const past = Object.keys(state.lessons).some((id) => {
    const unit = outline.lessons[id]?.unit;
    return unit !== undefined && unit !== ON_RAMP;
  });
  return (id) => past && outline.lessons[id]?.unit === ON_RAMP;
}

/** The learner's current lesson: the first one not done in course order, skipping an on-ramp they moved past. */
export function currentLesson(state: LearnerState, outline: CourseOutline): string | undefined {
  const passed = passedOnRamp(state, outline);
  return outline.order.find((id) => !state.lessons[id] && !passed(id));
}

/**
 * Course-map states. The current lesson is the first one not done in course order, except that Start here never holds
 * it for a learner who has finished a lesson in a later unit: its lessons left undone are open to them. A lesson whose
 * predecessor is done is open; everything after the current lesson that is not reachable yet is locked. Locks are a
 * suggestion of order, not a wall: a locked lesson's page still works.
 */
export function lessonStates(state: LearnerState, outline: CourseOutline): Record<string, LessonState> {
  const out: Record<string, LessonState> = {};
  const current = currentLesson(state, outline);
  const passed = passedOnRamp(state, outline);
  outline.order.forEach((id, i) => {
    if (state.lessons[id]) out[id] = "done";
    else if (id === current) out[id] = "current";
    else if (passed(id)) out[id] = "open";
    else if (i > 0 && state.lessons[outline.order[i - 1] as string]) out[id] = "open";
    else if (state.inProgress[id]) out[id] = "open";
    else out[id] = "locked";
  });
  return out;
}

/** Where "Continue" should go: the lesson in progress most recently touched, else the current lesson. */
export function resumeTarget(state: LearnerState, outline: CourseOutline): string | undefined {
  const touched = Object.entries(state.inProgress)
    .filter(([id]) => outline.lessons[id] && !state.lessons[id])
    .sort((a, b) => b[1].at.localeCompare(a[1].at))[0];
  if (touched) return touched[0];
  return currentLesson(state, outline);
}
