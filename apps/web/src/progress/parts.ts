import type { CourseOutline } from "../content/outline";
import type { LearnerState } from "./types";

/** The parts bin: the union of `unlocks.parts` of completed lessons, in course order. */
export function partsBin(state: LearnerState, outline: CourseOutline): string[] {
  const out = new Set<string>();
  for (const id of outline.order) if (state.lessons[id]) for (const p of outline.lessons[id]?.parts ?? []) out.add(p);
  // Lessons no longer in the course still count (a renamed or retired lesson keeps its parts).
  for (const id of Object.keys(state.lessons)) for (const p of outline.lessons[id]?.parts ?? []) out.add(p);
  return [...out];
}

/** The lesson that unlocks a part first, in course order. */
export function lessonUnlocking(partId: string, outline: CourseOutline): string | undefined {
  return outline.order.find((id) => outline.lessons[id]?.parts.includes(partId));
}
