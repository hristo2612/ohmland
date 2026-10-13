/** The light course structure the course map island receives (no lesson bodies). */
import type { Course } from "./load";

export type MapLesson = { id: string; title: string; summary: string; minutes: number; href: string };
export type MapModule = { id: string; title: string; summary: string; landmark: { id: string; name: string }; lessons: MapLesson[] };
export type MapUnit = { id: string; number: number; title: string; summary: string; modules: MapModule[] };
export type MapUpcoming = { id: string; number: number; title: string; summary: string };

export function mapOf(course: Course): { units: MapUnit[]; upcoming: MapUpcoming[] } {
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
        lessons: mod.lessons.map((l) => ({ id: l.id, title: l.title, summary: l.summary, minutes: l.minutes, href: l.href })),
      })),
    })),
    upcoming: course.upcoming,
  };
}
