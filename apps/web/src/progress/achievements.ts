/**
 * Achievements: a registry of pure checks over the learner record (plus the latest lab events). Unlocking one stores
 * only its id and time; titles, descriptions and XP live here and in i18n, so they can change without migrations.
 *
 * Every lesson, task, bonus and trigger a check names is also declared as data in its `refs`, and
 * achievements.test.ts proves each one exists in the course and can be reached, so a renamed task or a split lesson
 * fails the tests instead of quietly making an achievement impossible.
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

/** A lab task as an achievement names it: the lesson whose lab runs it, and the task's id in that lab. */
export type TaskRef = readonly [lessonId: string, taskId: string];

/** What a check names in the course, as data (achievements.test.ts checks each against the lessons and labs). */
export type AchievementRefs = {
  /** Units whose lessons or modules the check counts. */
  units?: readonly string[];
  /** Lessons the check needs finished with every graded check right first time (so each needs at least one). */
  lessons?: readonly string[];
  /** Lab tasks the check needs: each one its lesson can complete (a beat's task, the fix-it, the secret). */
  tasks?: readonly TaskRef[];
  /** Bonus tasks the check counts: each optional and offered by its lesson. With `units`, every bonus they offer. */
  bonus?: readonly TaskRef[];
  /** Triggers the check reads from lab events, besides `labEvent`: each fired by a lab or by the runtime. */
  triggers?: readonly string[];
};

export type Achievement = {
  id: AchievementId;
  title: string;
  /** What earns it. A function when it counts the course (how many lessons a unit has). */
  description: string | ((outline: CourseOutline) => string);
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
  /** Everything `check` names in the course. */
  refs?: AchievementRefs;
  check(ctx: AchievementContext): boolean;
};

/** An achievement as the learner sees it once earned: its description worked out for this course. */
export type EarnedAchievement = Omit<Achievement, "description"> & { description: string };

/** An achievement's description for this course. */
export const describeAchievement = (a: Achievement, outline: CourseOutline): string =>
  typeof a.description === "function" ? a.description(outline) : a.description;

const lessonsDone = (s: LearnerState) => Object.keys(s.lessons).length;
const tasksDone = (s: LearnerState) => Object.values(s.lessons).reduce((n, l) => n + l.tasks.length, 0);
const friedOf = (s: LearnerState, kinds?: string[]) => s.fried.filter((f) => !kinds || kinds.includes(f.kind)).length;
const rulesCollected = (s: LearnerState, o: CourseOutline) =>
  Object.keys(s.lessons).reduce((n, id) => n + (o.lessons[id]?.rules ?? 0), 0);

/** A lab task recorded for a lesson (tasks are stored when the lesson is finished). */
const hasTask = (s: LearnerState, lessonId: string, taskId: string) => !!s.lessons[lessonId]?.tasks.includes(taskId);
const perfectLesson = (s: LearnerState, lessonId: string) => {
  const l = s.lessons[lessonId];
  return !!l && l.items > 0 && l.firstTry >= l.items;
};
const fired = (events: readonly LabEvent[], name: string, lessonId?: string) =>
  events.some((e) => e.type === "trigger" && e.name === name && (lessonId === undefined || e.lessonId === lessonId));
const unitModules = (o: CourseOutline, unit: string) => o.modules.filter((mod) => mod.unit === unit);
const unitLessons = (o: CourseOutline, unit: string) => unitModules(o, unit).flatMap((mod) => mod.lessons);
/** Every lesson of a unit finished (none when the unit has no lessons yet). */
const unitDone = (s: LearnerState, o: CourseOutline, unit: string) => {
  const ids = unitLessons(o, unit);
  return ids.length > 0 && ids.every((id) => !!s.lessons[id]);
};

/** Every one of these lab tasks done: the check and its refs from one list. */
const allTasks = (...tasks: TaskRef[]): Pick<Achievement, "refs" | "check"> => ({
  refs: { tasks },
  check: ({ state }) => tasks.every(([lessonId, taskId]) => hasTask(state, lessonId, taskId)),
});

/**
 * The secrets of Basics (each bench lesson's `secret`) as lessonId and taskId. The test keeps it complete: a Basics
 * lesson that offers a bonus not listed here fails it. The lessons that moved to Start here took theirs along.
 */
const BASICS_SECRETS: readonly TaskRef[] = [
  ["tiny-and-huge-numbers", "two-hundred"],
  ["what-resists", "double-spacing"],
  ["draw-a-resistor", "slide-along"],
  ["reading-the-stripes", "tiny-gold"],
  ["the-liar", "probe-tips"],
  ["measure-the-flow", "other-side"],
  ["share-the-push", "blue-led"],
  ["use-the-law", "ten-k"],
  ["end-to-end", "swap-in-3k3"],
  ["series-and-parallel", "smallest-wins"],
  ["watts-and-heat", "one-watt-too"],
  ["big-current", "battery-check"],
  ["inside-the-battery", "watch-it-sag"],
  ["lemon-cell", "one-lemon-led"],
  ["stack-the-cells", "why-no-resistor"],
];
/** Curious mind asks for about half of them. */
const CURIOUS_GOAL = Math.ceil(BASICS_SECRETS.length / 2);

const t = m.achievements.items;

// Unit 2: Switching (docs/curriculum/unit-2.md, section 5) ----------------------------------------------------------

/** Part kinds that can be fried in Unit 2's labs. */
const UNIT_2_FRIED = ["relay", "capacitor", "npn", "diode", "speaker", "phototransistor", "led", "resistor"];
/** The two lessons with a pin map to fill in, each with a `clean-map` bonus that fires "pin-map-perfect". */
const PIN_MAPS = ["mystery-switch", "meet-the-relay"];

const UNIT_2: readonly Achievement[] = [
  { id: "either-way", ...t["either-way"], icon: "led", xp: 50, ...allTasks(["stairway-light", "two-travelers"], ["stairway-light", "cross-the-travelers"]) },
  {
    id: "pin-sleuth",
    ...t["pin-sleuth"],
    icon: "target",
    xp: 75,
    // Both pin maps right with no wrong submission: each lab's bonus task `clean-map` (which fires "pin-map-perfect"),
    // done now (a lab event) or saved with a finished lesson. One lab alone is not enough, so no `labEvent`.
    refs: { tasks: PIN_MAPS.map((lessonId) => [lessonId, "clean-map"] as const), triggers: ["pin-map-perfect"] },
    check: ({ state, events }) =>
      PIN_MAPS.every(
        (lessonId) =>
          hasTask(state, lessonId, "clean-map") ||
          fired(events, "pin-map-perfect", lessonId) ||
          events.some((e) => e.type === "task" && e.lessonId === lessonId && e.taskId === "clean-map"),
      ),
  },
  {
    id: "first-click",
    ...t["first-click"],
    icon: "sound-on",
    xp: 25,
    // The runtime fires "relay-clicked" on the first `clicked` event from any relay, in any lab or the sandbox
    // (apps/web/src/lab/session.ts, BUILT_IN_TRIGGERS). The check is a proxy for records from before that.
    labEvent: "relay-clicked",
    ...allTasks(["meet-the-relay", "energize"]),
  },
  {
    id: "spark-catcher",
    ...t["spark-catcher"],
    icon: "spark",
    xp: 50,
    // The kickback spike is seen in coil-kickback; the diode that clamps it got its own lesson, the-diode.
    ...allTasks(["coil-kickback", "watch-the-spike"], ["the-diode", "diode-clamp"]),
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
    // lab or the sandbox (BUILT_IN_TRIGGERS). The check is a proxy: capacitor-labels' secret, `blast-box`.
    labEvent: "capacitor-reversed-died",
    ...allTasks(["capacitor-labels", "blast-box"]),
  },
  {
    id: "tau-tamer",
    ...t["tau-tamer"],
    icon: "clock",
    xp: 75,
    // rc-time-constant fires "tau-within-5-percent" once every τ the learner typed (find-tau, discharge-tau,
    // ten-times-slower and the hit-the-target fix-it) is within 5% of the circuit's own, from its parts' actual
    // values; the tasks themselves accept 10% and 20%.
    labEvent: "tau-within-5-percent",
    check: () => false,
  },
  { id: "feather-touch", ...t["feather-touch"], icon: "cursor", xp: 50, ...allTasks(["touch-switch", "darlington"]) },
  {
    id: "five-second-club",
    ...t["five-second-club"],
    icon: "clock",
    xp: 75,
    // tune-the-timer fires "five-seconds-tight" once `five-seconds` is done and the stopwatch's last three runs from an
    // empty capacitor all land within 4.75 to 5.25 s; the task itself accepts 4.5 to 5.5 s.
    labEvent: "five-seconds-tight",
    check: () => false,
  },
  {
    id: "night-shift",
    ...t["night-shift"],
    icon: "moon",
    xp: 50,
    // The blueprint's sandbox challenge card `dusk-patrol` (unit-2.md, section 8) needs a light control the free bench
    // does not have yet. Until it does, the night-light lesson's fix-it is the same feat: on below about 20% light,
    // off above about 30%.
    ...allTasks(["night-light", "set-dusk"]),
  },
  {
    id: "tuning-fork",
    ...t["tuning-fork"],
    icon: "star",
    xp: 75,
    // The runtime fires "speaker-concert-a" when any lab or sandbox circuit holds a speaker tone between 418 and
    // 462 Hz for 2 s (BUILT_IN_TRIGGERS, from the audio stream's pitch). No lesson's tone lands there, so it is the
    // free bench's challenge (unit-2.md, section 8): a two-transistor flasher with 100 nF beads and about 20 kΩ in
    // each base (two 10 kΩ, or a 10 kΩ and the trimmer) sings near 430 Hz.
    labEvent: "speaker-concert-a",
    check: () => false,
  },
  { id: "wailer", ...t.wailer, icon: "sound-on", xp: 100, ...allTasks(["siren", "wail"]) },
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
    title: t["two-islands"].title,
    description: (o) => t["two-islands"].description(unitLessons(o, "switching").length),
    icon: "isle",
    xp: 100,
    refs: { units: ["switching"] },
    check: ({ state, outline }) => unitDone(state, outline, "switching"),
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
  { id: "first-reading", ...t["first-reading"], icon: "bolt", xp: 25, ...allTasks(["meet-the-meter", "read-battery"]) },
  {
    id: "stripe-sharp",
    ...t["stripe-sharp"],
    icon: "star",
    xp: 50,
    refs: { lessons: ["reading-the-stripes"] },
    check: ({ state }) => perfectLesson(state, "reading-the-stripes"),
  },
  { id: "glow-getter", ...t["glow-getter"], icon: "led", xp: 25, ...allTasks(["first-glow", "build-loop"]) },
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
    // find-the-law fires "lawmaker" (a lab `triggers` entry) once spot-the-pattern and predict-and-test are done, the
    // four I × R rows logged in first-row and fill-the-table are each within 5% of the logged battery voltage, and the
    // predict-4k7 prediction is within 5% of the current measured through the 4.7 kΩ.
    labEvent: "lawmaker",
    check: () => false,
  },
  {
    id: "smoke-tester",
    ...t["smoke-tester"],
    icon: "flame",
    xp: 50,
    hidden: true,
    // cook-one smokes and burns out a 1/4 W resistor; one-watt-too (the secret) is the smoke event on the 1 W one.
    // Tasks accumulate, so the two may come from different visits, as the blueprint allows.
    ...allTasks(["watts-and-heat", "cook-one"], ["watts-and-heat", "one-watt-too"]),
  },
  {
    id: "bracketed",
    ...t.bracketed,
    icon: "fuse",
    xp: 50,
    // Two lessons bracket one current. fuse-guard's blow-1a shows it is over 1 A. big-current fires "bracketed" (a lab
    // `triggers` entry) once measure-big is done with no blown event on its 3 A fuse F2 in that visit: under 3 A, and
    // measured. Not a `labEvent`, because the trigger alone is not enough: blow-1a must be on record first.
    refs: { tasks: [["fuse-guard", "blow-1a"], ["big-current", "measure-big"]], triggers: ["bracketed"] },
    check: ({ state, events }) => hasTask(state, "fuse-guard", "blow-1a") && fired(events, "bracketed"),
  },
  { id: "sour-power", ...t["sour-power"], icon: "spark", xp: 50, ...allTasks(["stack-the-cells", "light-it"]) },
  {
    id: "upside-down",
    ...t["upside-down"],
    icon: "retry",
    xp: 25,
    hidden: true,
    // stack-the-cells fires "upside-down" (a lab `triggers` entry) once the notebook logs a reading across four cells
    // in series with exactly one turned round, between 1.5 and 2.0 V (about 1.9 V alone, about 1.6 V lighting the LED).
    labEvent: "upside-down",
    check: () => false,
  },
  {
    id: "curious-mind",
    title: t["curious-mind"].title,
    description: t["curious-mind"].description(CURIOUS_GOAL),
    icon: "star",
    xp: 50,
    refs: { units: ["basics"], bonus: BASICS_SECRETS },
    check: ({ state }) => BASICS_SECRETS.filter(([lessonId, taskId]) => hasTask(state, lessonId, taskId)).length >= CURIOUS_GOAL,
  },
  {
    id: "spotless-module",
    ...t["spotless-module"],
    icon: "target",
    xp: 50,
    refs: { units: ["basics"] },
    check: ({ state, outline }) => unitModules(outline, "basics").some((mod) => mod.lessons.every((id) => perfectLesson(state, id))),
  },
  {
    id: "island-founder",
    title: t["island-founder"].title,
    description: (o) => t["island-founder"].description(unitLessons(o, "basics").length),
    icon: "landmark",
    xp: 100,
    refs: { units: ["basics"] },
    check: ({ state, outline }) => unitDone(state, outline, "basics"),
  },
  ...UNIT_2,
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

/** XP of an unlocked achievement (0 for an id that no longer exists). */
export const achievementXp = (id: string): number => BY_ID.get(id)?.xp ?? 0;

/** The achievements newly earned in this context: not yet in the record and passing their check. */
export function newlyEarned(ctx: AchievementContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !ctx.state.achievements[a.id] && (a.check(ctx) || (!!a.labEvent && fired(ctx.events, a.labEvent))));
}

/** Returns the record with any newly earned achievements added at `now`, and which ones they were. */
export function evaluateAchievements(ctx: AchievementContext, now: string): { state: LearnerState; earned: EarnedAchievement[] } {
  const earned = newlyEarned(ctx).map((a) => ({ ...a, description: describeAchievement(a, ctx.outline) }));
  if (!earned.length) return { state: ctx.state, earned };
  const achievements = { ...ctx.state.achievements };
  for (const a of earned) achievements[a.id] = { at: now };
  return { state: { ...ctx.state, achievements }, earned };
}
