/** The light course structure the course map island receives (no lesson bodies). */
import type { PartIconKind } from "../parts/kinds";
import type { Course } from "./load";

/** `icon` is the part drawing of the lesson's opening scene, when it has one: the map shows it instead of words. */
export type MapLesson = { id: string; title: string; summary: string; minutes: number; steps: number; href: string; icon?: PartIconKind | undefined };
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
          const hook = l.steps[0];
          const part = hook?.type === "hook" && hook.visual?.kind === "part" ? hook.visual.part : undefined;
          return { id: l.id, title: l.title, summary: l.summary, minutes: l.minutes, steps: l.steps.length, href: l.href, icon: part ? icons.get(part) : undefined };
        }),
      })),
    })),
    upcoming: course.upcoming,
  };
}
