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
  /**
   * TODO trigger: the lab event (not emitted yet) that should unlock this achievement once the lab runtime reports it.
   * Until then `check` is a proxy over the learner record, or always false when no fair proxy exists.
   */
  labEvent?: string;
  check(ctx: AchievementContext): boolean;
};

const lessonsDone = (s: LearnerState) => Object.keys(s.lessons).length;
const tasksDone = (s: LearnerState) => Object.values(s.lessons).reduce((n, l) => n + l.tasks.length, 0);
const friedOf = (s: LearnerState, kinds?: string[]) => s.fried.filter((f) => !kinds || kinds.includes(f.kind)).length;
const rulesCollected = (s: LearnerState, o: CourseOutline) =>
  Object.keys(s.lessons).reduce((n, id) => n + (o.lessons[id]?.rules ?? 0), 0);

const t = m.achievements.items;

// Unit 2: Switching (docs/curriculum/unit-2.md, section 5) ----------------------------------------------------------

/** Lab task ids recorded for a lesson (stored when the lesson completes). */
const tasksOf = (s: LearnerState, lessonId: string): string[] => s.lessons[lessonId]?.tasks ?? [];
const didTasks = (s: LearnerState, lessonId: string, ...taskIds: string[]) => taskIds.every((id) => tasksOf(s, lessonId).includes(id));
/** Part kinds that can be fried in Unit 2's labs. */
const UNIT_2_FRIED = ["relay", "capacitor", "npn", "diode", "speaker", "phototransistor", "led", "resistor"];

const UNIT_2: readonly Achievement[] = [
  {
    id: "either-way",
    ...t["either-way"],
    icon: "led",
    xp: 50,
    check: ({ state }) => didTasks(state, "stairway-light", "two-travelers", "cross-the-travelers"),
  },
  {
    id: "pin-sleuth",
    ...t["pin-sleuth"],
    icon: "target",
    xp: 75,
    // TODO(lab-event): mystery-switch `name-the-legs` and meet-the-relay `energize`, each with zero wrong pin-map
    // submissions. Needs the pin-map panel to count submissions; no fair proxy until then.
    labEvent: "pin-map-perfect",
    check: () => false,
  },
  {
    id: "first-click",
    ...t["first-click"],
    icon: "sound-on",
    xp: 25,
    // TODO(lab-event): the first `clicked` event from any relay, in any lab or the sandbox. Proxy: meet-the-relay's
    // `energize` task, whose goal needs a click.
    labEvent: "relay-clicked",
    check: ({ state }) => didTasks(state, "meet-the-relay", "energize"),
  },
  {
    id: "spark-catcher",
    ...t["spark-catcher"],
    icon: "spark",
    xp: 50,
    check: ({ state }) => didTasks(state, "coil-kickback", "watch-the-spike", "diode-clamp"),
  },
  {
    id: "buzzed-to-bits",
    ...t["buzzed-to-bits"],
    icon: "smoke",
    xp: 25,
    hidden: true,
    // TODO(lab-event): a `died` event on a relay with data.cause "worn". Proxy: any fried relay (in Unit 2 the only
    // planned relay death is worn contacts).
    labEvent: "relay-worn-out",
    check: ({ state }) => friedOf(state, ["relay"]) >= 1,
  },
  {
    id: "wrong-way-round",
    ...t["wrong-way-round"],
    icon: "alert",
    xp: 25,
    hidden: true,
    // TODO(lab-event): a `died` event on a polarized capacitor with data.cause "reverse", in any lab or the sandbox.
    // Proxy: capacitor-labels' `blast-box` task, whose goal is exactly that.
    labEvent: "capacitor-reversed-died",
    check: ({ state }) => didTasks(state, "capacitor-labels", "blast-box"),
  },
  {
    id: "tau-tamer",
    ...t["tau-tamer"],
    icon: "clock",
    xp: 75,
    // TODO(lab-event): all four rc-time-constant tasks, each submitted τ within 5% of the instance's actual τ. Needs
    // numeric entry checked against instance values; the tasks alone only ask for 10% and 20%.
    labEvent: "tau-within-5-percent",
    check: () => false,
  },
  {
    id: "feather-touch",
    ...t["feather-touch"],
    icon: "cursor",
    xp: 50,
    check: ({ state }) => didTasks(state, "touch-switch", "darlington"),
  },
  {
    id: "five-second-club",
    ...t["five-second-club"],
    icon: "clock",
    xp: 75,
    // TODO(lab-event): in delay-timer's `five-seconds` task, three consecutive runs measure 4.75 to 5.25 s. Needs run
    // timing; the task itself accepts 4.5 to 5.5 s.
    labEvent: "five-seconds-tight",
    check: () => false,
  },
  {
    id: "night-shift",
    ...t["night-shift"],
    icon: "moon",
    xp: 50,
    // TODO(lab-event): the sandbox challenge card `dusk-patrol` is passed (blueprint section 8). Needs challenge cards.
    labEvent: "challenge-dusk-patrol",
    check: () => false,
  },
  {
    id: "tuning-fork",
    ...t["tuning-fork"],
    icon: "star",
    xp: 75,
    // TODO(lab-event): any lab or sandbox circuit holds a speaker tone between 418 and 462 Hz for at least 2 s. Needs
    // the frequency readout.
    labEvent: "speaker-concert-a",
    check: () => false,
  },
  {
    id: "wailer",
    ...t.wailer,
    icon: "sound-on",
    xp: 100,
    check: ({ state }) => didTasks(state, "siren", "wail"),
  },
  {
    id: "smoke-shelf",
    ...t["smoke-shelf"],
    icon: "flame",
    xp: 50,
    hidden: true,
    check: ({ state }) => {
      const kinds = new Set(state.fried.map((f) => f.kind).filter((k) => UNIT_2_FRIED.includes(k)));
      return kinds.size >= 5 && ["relay", "capacitor", "npn"].some((k) => kinds.has(k));
    },
  },
  {
    id: "two-islands",
    ...t["two-islands"],
    icon: "isle",
    xp: 100,
    check: ({ state, outline }) => {
      const ids = Object.values(outline.lessons)
        .filter((l) => l.unit === "switching")
        .map((l) => l.id);
      return ids.length > 0 && ids.every((id) => !!state.lessons[id]);
    },
  },
];

// -------------------------------------------------------------------------------------------------------------------

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
  ...UNIT_2,
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
