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
  | { type: "lesson-complete"; lessonId: string; firstTry: number; items: number }
  /** A named trigger fired by a lab (a task's `trigger`, a lab's `triggers`, or a built-in runtime trigger). */
  | { type: "trigger"; name: string; lessonId: string | null };

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
   * A named trigger that unlocks this achievement when a lab fires it (blueprint N16), in addition to `check`. Labs
   * fire triggers through a task's `trigger`, the lab's `triggers`, or the runtime's built-in ones (see
   * apps/web/src/lab/session.ts, BUILT_IN_TRIGGERS).
   */
  labEvent?: string;
  check(ctx: AchievementContext): boolean;
};

const lessonsDone = (s: LearnerState) => Object.keys(s.lessons).length;
const tasksDone = (s: LearnerState) => Object.values(s.lessons).reduce((n, l) => n + l.tasks.length, 0);
const friedOf = (s: LearnerState, kinds?: string[]) => s.fried.filter((f) => !kinds || kinds.includes(f.kind)).length;
const rulesCollected = (s: LearnerState, o: CourseOutline) =>
  Object.keys(s.lessons).reduce((n, id) => n + (o.lessons[id]?.rules ?? 0), 0);

const hasTask = (s: LearnerState, lessonId: string, taskId: string) => !!s.lessons[lessonId]?.tasks.includes(taskId);
const perfectLesson = (s: LearnerState, lessonId: string) => {
  const l = s.lessons[lessonId];
  return !!l && l.items > 0 && l.firstTry >= l.items;
};
const unitModules = (o: CourseOutline, unit: string) => o.modules.filter((mod) => mod.unit === unit);

/** The optional bonus tasks of Unit 1, as lessonId/taskId (docs/curriculum/unit-1.md, section 12). */
const BASICS_BONUS_TASKS = [
  "welcome-to-the-bench/swap-battery-leads",
  "meet-the-meter/tired-battery",
  "what-resists/extremes",
  "draw-a-resistor/slide-along",
  "first-glow/no-resistor",
  "watts-and-heat/one-watt-too",
  "fuse-guard/battery-check",
  "inside-the-battery/watch-it-sag",
  "lemon-cell/one-lemon-led",
  "stack-the-cells/why-no-resistor",
];
const bonusTasksDone = (s: LearnerState, list: readonly string[]) =>
  list.filter((key) => {
    const [lessonId = "", taskId = ""] = key.split("/");
    return hasTask(s, lessonId, taskId);
  }).length;

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
    // Both pin maps right with no wrong submission: each lab's bonus task `clean-map` (which fires "pin-map-perfect"),
    // done now (a lab event) or saved with a finished lesson. One lab alone is not enough, so no `labEvent`.
    check: ({ state, events }) => {
      const perfect = (lessonId: string) =>
        didTasks(state, lessonId, "clean-map") ||
        events.some(
          (e) =>
            (e.type === "trigger" && e.name === "pin-map-perfect" && e.lessonId === lessonId) ||
            (e.type === "task" && e.lessonId === lessonId && e.taskId === "clean-map"),
        );
      return perfect("mystery-switch") && perfect("meet-the-relay");
    },
  },
  {
    id: "first-click",
    ...t["first-click"],
    icon: "sound-on",
    xp: 25,
    // The runtime fires "relay-clicked" on the first `clicked` event from any relay, in any lab or the sandbox
    // (apps/web/src/lab/session.ts, BUILT_IN_TRIGGERS). The check is a proxy for records from before that.
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
    // The runtime fires "relay-worn-out" on a `died` event on a relay with data.cause "worn" (BUILT_IN_TRIGGERS).
    // The check is a proxy for records from before that: any fried relay.
    labEvent: "relay-worn-out",
    check: ({ state }) => friedOf(state, ["relay"]) >= 1,
  },
  {
    id: "wrong-way-round",
    ...t["wrong-way-round"],
    icon: "alert",
    xp: 25,
    hidden: true,
    // The runtime fires "capacitor-reversed-died" on a `died` event on a capacitor with data.cause "reverse", in any
    // lab or the sandbox (BUILT_IN_TRIGGERS). The check is a proxy: capacitor-labels' `blast-box` task.
    labEvent: "capacitor-reversed-died",
    check: ({ state }) => didTasks(state, "capacitor-labels", "blast-box"),
  },
  {
    id: "tau-tamer",
    ...t["tau-tamer"],
    icon: "clock",
    xp: 75,
    // rc-time-constant fires "tau-within-5-percent" once all four τ the learner typed are within 5% of the circuit's
    // own (its parts' actual values); the tasks themselves accept 10% and 20%.
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
    // delay-timer fires "five-seconds-tight" when its stopwatch's last three runs from an empty capacitor all land
    // within 4.75 to 5.25 s; the task itself accepts 4.5 to 5.5 s.
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
    // The runtime fires "speaker-concert-a" when any lab or sandbox circuit holds a speaker tone between 418 and
    // 462 Hz for 2 s (BUILT_IN_TRIGGERS, from the audio stream's pitch).
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

  // Unit 1: Basics (docs/curriculum/unit-1.md, section 10). The blueprint's "into-the-hall" (burn out your first
  // part) is the same check as "magic-smoke" above, so it is not repeated. Its "clean-sweep" (a whole module right
  // first time) is "spotless-module" here, because "clean-sweep" already means a single perfect lesson.
  {
    id: "first-reading",
    ...t["first-reading"],
    icon: "bolt",
    xp: 25,
    check: ({ state }) => hasTask(state, "meet-the-meter", "read-battery"),
  },
  { id: "stripe-sharp", ...t["stripe-sharp"], icon: "star", xp: 50, check: ({ state }) => perfectLesson(state, "reading-the-stripes") },
  { id: "glow-getter", ...t["glow-getter"], icon: "led", xp: 25, check: ({ state }) => hasTask(state, "first-glow", "build-loop") },
  {
    id: "meter-bites-back",
    ...t["meter-bites-back"],
    icon: "fuse",
    xp: 25,
    hidden: true,
    check: ({ state }) => friedOf(state, ["meter-fuse"]) >= 1,
  },
  {
    id: "curator",
    ...t.curator,
    icon: "trophy",
    xp: 75,
    hidden: true,
    check: ({ state }) => ["led", "resistor", "fuse", "meter-fuse"].every((kind) => friedOf(state, [kind]) >= 1),
  },
  {
    id: "lawmaker",
    ...t.lawmaker,
    icon: "book",
    xp: 75,
    // Unlocks when find-the-law fires "lawmaker" (a lab `triggers` entry, docs/LABS.md): spot-the-pattern and
    // predict-and-test done, all four logged I × R products within 5% of the logged battery voltage, and the 4.7 kΩ
    // prediction within 5% of the measured current. The lab still has to declare that trigger.
    labEvent: "lawmaker",
    check: () => false,
  },
  {
    id: "smoke-tester",
    ...t["smoke-tester"],
    icon: "flame",
    xp: 50,
    hidden: true,
    // cook-one smokes and burns out a 1/4 W resistor; one-watt-too is the smoke event on the 1 W one. Tasks
    // accumulate, so the two may come from different sessions, as the blueprint allows.
    check: ({ state }) => hasTask(state, "watts-and-heat", "cook-one") && hasTask(state, "watts-and-heat", "one-watt-too"),
  },
  {
    id: "bracketed",
    ...t.bracketed,
    icon: "fuse",
    xp: 50,
    // Unlocks when fuse-guard fires "bracketed" (a lab `triggers` entry): blow-1a and measure-big done with no blown
    // event on the 3 A fuse in that visit.
    labEvent: "bracketed",
    check: () => false,
  },
  { id: "sour-power", ...t["sour-power"], icon: "spark", xp: 50, check: ({ state }) => hasTask(state, "stack-the-cells", "light-it") },
  {
    id: "upside-down",
    ...t["upside-down"],
    icon: "retry",
    xp: 25,
    hidden: true,
    // Unlocks when stack-the-cells fires "upside-down" (a lab `triggers` entry, docs/LABS.md): four cells in series
    // with exactly one reversed and a logged reading between 1.6 and 2.0 V. The lab still has to declare that trigger.
    labEvent: "upside-down",
    check: () => false,
  },
  {
    id: "curious-mind",
    ...t["curious-mind"],
    icon: "star",
    xp: 50,
    check: ({ state }) => bonusTasksDone(state, BASICS_BONUS_TASKS) >= 8,
  },
  {
    id: "spotless-module",
    ...t["spotless-module"],
    icon: "target",
    xp: 50,
    check: ({ state, outline }) => unitModules(outline, "basics").some((mod) => mod.lessons.every((id) => perfectLesson(state, id))),
  },
  {
    id: "island-founder",
    ...t["island-founder"],
    icon: "landmark",
    xp: 100,
    check: ({ state, outline }) => {
      const ids = unitModules(outline, "basics").flatMap((mod) => mod.lessons);
      return ids.length > 0 && ids.every((id) => !!state.lessons[id]);
    },
  },
  ...UNIT_2,
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

/** XP of an unlocked achievement (0 for an id that no longer exists). */
export const achievementXp = (id: string): number => BY_ID.get(id)?.xp ?? 0;

/** The achievements newly earned in this context: not yet in the record and passing their check. */
export function newlyEarned(ctx: AchievementContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !ctx.state.achievements[a.id] && (a.check(ctx) || triggered(ctx, a.labEvent)));
}

/** Whether a lab fired this achievement's trigger in the events being evaluated. */
function triggered(ctx: AchievementContext, name: string | undefined): boolean {
  return !!name && ctx.events.some((e) => e.type === "trigger" && e.name === name);
}

/** Returns the record with any newly earned achievements added at `now`, and which ones they were. */
export function evaluateAchievements(ctx: AchievementContext, now: string): { state: LearnerState; earned: Achievement[] } {
  const earned = newlyEarned(ctx);
  if (!earned.length) return { state: ctx.state, earned };
  const achievements = { ...ctx.state.achievements };
  for (const a of earned) achievements[a.id] = { at: now };
  return { state: { ...ctx.state, achievements }, earned };
}
