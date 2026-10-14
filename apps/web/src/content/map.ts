/** The light course structure the course map island receives (no lesson bodies). */
import type { PartIconKind } from "../parts/kinds";
import type { Course } from "./load";

/**
 * `icon` is a part drawing for the lesson (its opening scene's part, else the first part it unlocks): the map shows it
 * instead of words. `steps` counts what the player steps through (steps, or a bench lesson's beats); `bench` lessons
 * save their place one ahead (0 before the bench opens).
 */
export type MapLesson = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  steps: number;
  bench: boolean;
  href: string;
  icon?: PartIconKind | undefined;
};
export type MapModule = { id: string; title: string; summary: string; landmark: { id: string; name: string }; lessons: MapLesson[] };
export type MapUnit = { id: string; number: number; title: string; summary: string; modules: MapModule[] };
export type MapUpcoming = { id: string; number: number; title: string; summary: string };

export function mapOf(course: Course): { units: MapUnit[]; upcoming: MapUpcoming[] } {
  const icons = new Map(course.parts.map((p) => [p.id, p.icon]));
  return {
    units: course.units.map((u) => ({
      id: u.id,
      number: u.number,
      title: u.title,
      summary: u.summary,
      modules: u.modules.map((mod) => ({
        id: mod.id,
        title: mod.title,
        summary: mod.summary,
        landmark: mod.landmark,
        lessons: mod.lessons.map((l) => {
          const bench = "format" in l && l.format === "bench";
          const hook = "steps" in l ? l.steps[0] : undefined;
          const shown = hook?.type === "hook" && hook.visual?.kind === "part" ? hook.visual.part : undefined;
          const part = shown ?? l.unlocks.parts[0];
          const steps = "steps" in l ? l.steps.length : l.beats.length;
          return { id: l.id, title: l.title, summary: l.summary, minutes: l.minutes, steps, bench, href: l.href, icon: part ? icons.get(part) : undefined };
        }),
      })),
    })),
    upcoming: course.upcoming,
  };
}
