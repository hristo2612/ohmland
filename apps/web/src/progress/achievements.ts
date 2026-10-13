/**
 * Achievements: a registry of pure checks over the learner record (plus the latest lab events). Unlocking one stores
 * only its id and time; titles, descriptions and XP live here and in i18n, so they can change without migrations.
 */
import type { CourseOutline } from "../content/outline";
import type { IconName } from "../components/icons";
import { m } from "../i18n";
import { completedModules } from "./xp";
import { partsBin } from "./parts";
import type { AchievementId, LearnerState } from "./types";

/** Things that happen in a lab that a check may care about. The lab runtime emits them; the store forwards them. */
export type LabEvent =
  | { type: "fried"; kind: string; lessonId: string | null }
  | { type: "task"; lessonId: string; taskId: string }
  | { type: "lesson-complete"; lessonId: string; firstTry: number; items: number };

export type AchievementContext = { state: LearnerState; outline: CourseOutline; events: readonly LabEvent[] };

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  icon: IconName;
  xp: number;
  /** Hidden achievements show as a mystery until unlocked. */
  hidden?: boolean;
  check(ctx: AchievementContext): boolean;
};

const lessonsDone = (s: LearnerState) => Object.keys(s.lessons).length;
const tasksDone = (s: LearnerState) => Object.values(s.lessons).reduce((n, l) => n + l.tasks.length, 0);
const friedOf = (s: LearnerState, kinds?: string[]) => s.fried.filter((f) => !kinds || kinds.includes(f.kind)).length;
const rulesCollected = (s: LearnerState, o: CourseOutline) =>
  Object.keys(s.lessons).reduce((n, id) => n + (o.lessons[id]?.rules ?? 0), 0);

const t = m.achievements.items;

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-spark", ...t["first-spark"], icon: "spark", xp: 20, check: ({ state }) => lessonsDone(state) >= 1 },
  {
    id: "clean-sweep",
    ...t["clean-sweep"],
    icon: "target",
    xp: 25,
    check: ({ state }) => Object.values(state.lessons).some((l) => l.items > 0 && l.firstTry >= l.items),
  },
  { id: "warmed-up", ...t["warmed-up"], icon: "bolt", xp: 30, check: ({ state }) => lessonsDone(state) >= 5 },
  {
    id: "landmark",
    ...t.landmark,
    icon: "landmark",
    xp: 30,
    check: ({ state, outline }) => completedModules(state, outline).length >= 1,
  },
  { id: "bench-hand", ...t["bench-hand"], icon: "wrench", xp: 25, check: ({ state }) => tasksDone(state) >= 5 },
  { id: "rulebook", ...t.rulebook, icon: "book", xp: 20, check: ({ state, outline }) => rulesCollected(state, outline) >= 10 },
  { id: "collector", ...t.collector, icon: "box", xp: 25, check: ({ state, outline }) => partsBin(state, outline).length >= 10 },
  { id: "magic-smoke", ...t["magic-smoke"], icon: "smoke", xp: 15, check: ({ state }) => friedOf(state) >= 1 },
  { id: "smoke-signals", ...t["smoke-signals"], icon: "flame", xp: 20, hidden: true, check: ({ state }) => friedOf(state) >= 5 },
  { id: "tiny-graves", ...t["tiny-graves"], icon: "led", xp: 15, hidden: true, check: ({ state }) => friedOf(state, ["led"]) >= 3 },
  {
    id: "fuse-whisperer",
    ...t["fuse-whisperer"],
    icon: "fuse",
    xp: 15,
    hidden: true,
    check: ({ state }) => friedOf(state, ["fuse", "meter-fuse"]) >= 1,
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

/** XP of an unlocked achievement (0 for an id that no longer exists). */
export const achievementXp = (id: string): number => BY_ID.get(id)?.xp ?? 0;

/** The achievements newly earned in this context: not yet in the record and passing their check. */
export function newlyEarned(ctx: AchievementContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !ctx.state.achievements[a.id] && a.check(ctx));
}

/** Returns the record with any newly earned achievements added at `now`, and which ones they were. */
export function evaluateAchievements(ctx: AchievementContext, now: string): { state: LearnerState; earned: Achievement[] } {
  const earned = newlyEarned(ctx);
  if (!earned.length) return { state: ctx.state, earned };
  const achievements = { ...ctx.state.achievements };
  for (const a of earned) achievements[a.id] = { at: now };
  return { state: { ...ctx.state, achievements }, earned };
}
