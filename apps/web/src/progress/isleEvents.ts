/**
 * The island's input, derived from the learner record (docs/ARCHITECTURE.md, "Island"): one event per finished lesson,
 * ordered by first completion time (ties in course order), each module's event right after the lesson that finished
 * it, and a seed from the first lesson the learner finished. Pure; nothing about the island is stored.
 *
 * Lesson pieces and module landmarks pass through as the content names them. Ids the isle does not know fall back to
 * its planner (a piece from the deck, the unit's next landmark), so a typo never breaks the island.
 */
import { seedFrom, type IsleEvent } from "@ohmland/isle";
import type { CourseOutline, OutlineModule } from "../content/outline";
import type { LearnerState } from "./types";

export type IsleInput = { seed: number; events: IsleEvent[] };

/** The seed of an island before any lesson: the bare starting plot every new learner sees. */
export const START_SEED = seedFrom("start", "");

const timeOf = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

export function isleEvents(state: LearnerState, outline: CourseOutline): IsleInput {
  const rank = new Map(outline.order.map((id, i) => [id, i]));
  const done = Object.entries(state.lessons)
    .map(([id, r]) => ({ id, at: r.at, t: timeOf(r.at), rank: rank.get(id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.t - b.t || a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const first = done[0];
  const seed = first ? seedFrom(first.id, first.at) : START_SEED;

  const modulesOf = new Map<string, OutlineModule[]>();
  for (const mod of outline.modules)
    for (const id of mod.lessons) {
      const list = modulesOf.get(id);
      if (list) list.push(mod);
      else modulesOf.set(id, [mod]);
    }

  const seen = new Set<string>();
  const events: IsleEvent[] = [];
  for (const d of done) {
    seen.add(d.id);
    // a lesson that is no longer in the course places nothing (its unit and piece are unknown)
    const lesson = outline.lessons[d.id];
    if (!lesson) continue;
    events.push({ type: "lesson", unit: lesson.unit, piece: lesson.isle ?? "", title: lesson.title, id: lesson.id });
    for (const mod of modulesOf.get(d.id) ?? [])
      if (mod.lessons.length > 0 && mod.lessons.every((id) => seen.has(id)))
        events.push({ type: "module", unit: mod.unit, landmark: mod.landmark.id, title: mod.title, id: mod.id });
  }
  return { seed, events };
}

/** Counts for headers and cards. */
export function isleCounts(events: IsleEvent[]): { lessons: number; modules: number } {
  let lessons = 0;
  let modules = 0;
  for (const e of events) if (e.type === "lesson") lessons++;
  else modules++;
  return { lessons, modules };
}

/**
 * What a reveal shows when the record changes from `before` to `after`: the events of `after` from `from + 1` to `to`
 * (indices, -1 meaning "before any event"), or null when nothing new arrived. New events usually come last; when an
 * older record arrives late (a clock running behind on another device) everything after the shared start is shown.
 */
export function revealRange(before: IsleEvent[], after: IsleEvent[]): { from: number; to: number } | null {
  let k = 0;
  while (k < before.length && k < after.length && before[k]!.type === after[k]!.type && before[k]!.id === after[k]!.id) k++;
  if (k >= after.length) return null;
  return { from: k - 1, to: after.length - 1 };
}
