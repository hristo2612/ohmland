/**
 * A compact, serialisable view of the course that client islands receive as props: enough to derive XP, levels,
 * the parts bin, achievements and course-map states from a LearnerState, without shipping lesson bodies.
 */
export type OutlineLesson = {
  id: string;
  title: string;
  href: string;
  unit: string;
  module: string;
  minutes: number;
  /** Parts bin ids unlocked on completion. */
  parts: string[];
  /** Island piece placed on completion. */
  isle?: string | undefined;
  /** Rule cards in the wrap step. */
  rules: number;
};

export type OutlineModule = {
  id: string;
  unit: string;
  title: string;
  landmark: { id: string; name: string };
  lessons: string[];
};

export type OutlineUnit = { id: string; number: number; title: string; modules: string[] };

export type CourseOutline = {
  units: OutlineUnit[];
  modules: OutlineModule[];
  lessons: Record<string, OutlineLesson>;
  /** Every lesson id in course order. */
  order: string[];
};

export const emptyOutline = (): CourseOutline => ({ units: [], modules: [], lessons: {}, order: [] });
