/**
 * The shape of a bench lesson as the player walks it: a flat list of moments (the beats, then the fix-it benches, the
 * secret's offer and the sign-off), plus the pure bookkeeping around them: what is graded, what the learner has
 * earned, which rules they have found. No React, no DOM: flow.test.ts covers it.
 */
import type { BenchLessonData } from "../../content/load";
import type { Beat, BeatNote } from "../../content/schema";

export type MomentAction = "next" | "meet" | "task" | "tap" | "pick" | "number" | "popup" | "finish";

export type Moment = {
  /** Stable within a lesson version: b0, b1 ... fix0 ... secret, end. Saved answers key on it. */
  key: string;
  kind: "beat" | "fix" | "secret" | "end";
  say: string;
  action: MomentAction;
  /** The beat this moment plays (beat moments). */
  beat?: Beat;
  /** The lab task that ends it (do beats, fix-it benches, the secret). */
  task?: string;
  /** The part a meet beat names. */
  part?: string;
  /** The one instrument or panel the moment shows (a beat's, the fix-it round's or the secret's `tool`). */
  tool?: string;
  /** The parts in play (a beat's or the secret's `spot`). */
  spot?: string[];
  /** Unit 5: what the beat's code drawer offers (its palette) and starts from (its program). */
  code?: { palette?: string[]; program?: string };
  /** The terminal the loop tracer runs from once the moment's action is done (or as it begins, with no action). */
  trace?: string;
  done?: string;
  note?: BeatNote;
  rule?: string;
  /** Fix-it benches: which one of how many, the round's opening line, and the optional clock's length. */
  fix?: { index: number; count: number; intro: string; timer: number };
};

/** One graded check's record. `first` is settled by the first try; `done` once it is right (or revealed). */
export type CheckRecord = { first: boolean; done: boolean; at?: string };

export const answerKeys = {
  check: (key: string) => `check:${key}`,
  guess: (key: string) => `guess:${key}`,
  tasks: (lab: string) => `tasks:${lab}`,
  /** The fix-it clock: seconds the learner took, when they raced it. */
  clock: "fixit:clock",
} as const;

export type Answers = Record<string, unknown>;

export function momentsOf(lesson: BenchLessonData): Moment[] {
  const out: Moment[] = [];
  lesson.beats.forEach((beat, i) => {
    const m: Moment = { key: `b${i}`, kind: "beat", say: beat.say, action: actionOf(beat), beat };
    if (beat.do) m.task = beat.do;
    if (beat.meet) m.part = beat.meet;
    if (beat.tool) m.tool = beat.tool;
    if (beat.spot) m.spot = beat.spot;
    if (beat.palette || beat.program) m.code = { ...(beat.palette ? { palette: beat.palette } : {}), ...(beat.program ? { program: beat.program } : {}) };
    if (beat.trace) m.trace = beat.trace;
    if (beat.done) m.done = beat.done;
    if (beat.note) m.note = beat.note;
    if (beat.rule) m.rule = beat.rule;
    out.push(m);
  });
  // The secret is offered once the required beats are done, then the fix-it round closes the lesson.
  if (lesson.secret) {
    const s = lesson.secret;
    const m: Moment = { key: "secret", kind: "secret", say: s.say, action: "task", task: s.task };
    if (s.done) m.done = s.done;
    if (s.note) m.note = s.note;
    if (s.rule) m.rule = s.rule;
    if (s.tool) m.tool = s.tool;
    if (s.spot) m.spot = s.spot;
    out.push(m);
  }
  const fixit = lesson.fixit;
  fixit?.tasks.forEach((t, i) => {
    const m: Moment = {
      key: `fix${i}`,
      kind: "fix",
      say: t.say ?? fixit.say,
      action: "task",
      task: t.task,
      fix: { index: i, count: fixit.tasks.length, intro: fixit.say, timer: fixit.timer },
    };
    if (fixit.tool) m.tool = fixit.tool;
    out.push(m);
  });
  out.push({ key: "end", kind: "end", say: lesson.end.say, action: "finish" });
  return out;
}

function actionOf(b: Beat): MomentAction {
  if (b.meet) return "meet";
  if (b.do) return "task";
  if (b.tap) return "tap";
  if (b.pick) return "pick";
  if (b.number) return "number";
  if (b.popup) return "popup";
  return "next";
}

/** Whether a moment's check counts for first-try XP (like a quiz item). */
export function isGraded(m: Moment): boolean {
  const b = m.beat;
  if (!b) return false;
  if (b.tap) return b.tap.answer !== undefined || b.tap.joinedTo !== undefined;
  if (b.pick) return b.pick.answer !== undefined;
  return !!b.number;
}

/** Whether finishing a moment shows something to read (then the learner taps Next); otherwise the lesson moves on. */
export function hasDiscovery(m: Moment): boolean {
  // A meet beat's note is the part's name, written when the beat starts, not a discovery.
  return !!(m.done || m.rule || (m.note && m.action !== "meet"));
}

export const checkOf = (answers: Answers, key: string): CheckRecord | undefined => answers[answerKeys.check(key)] as CheckRecord | undefined;

export const tasksOf = (answers: Answers, lab: string): string[] => {
  const v = answers[answerKeys.tasks(lab)];
  return Array.isArray(v) ? (v as string[]) : [];
};

/** What the lesson is worth so far, in the shape the progress store records (XP rules in docs/ARCHITECTURE.md). */
export function scoreOf(lesson: BenchLessonData, moments: readonly Moment[], answers: Answers): { firstTry: number; items: number; tasks: string[] } {
  let items = 0;
  let firstTry = 0;
  for (const m of moments) {
    if (!isGraded(m)) continue;
    items++;
    if (checkOf(answers, m.key)?.first) firstTry++;
  }
  return { firstTry, items, tasks: tasksOf(answers, lesson.lab) };
}

/** Records a try at a graded or ungraded check: the first try settles `first`; a right one marks it done. */
export function recordTry(prev: CheckRecord | undefined, right: boolean, at?: string): CheckRecord {
  const rec: CheckRecord = { first: prev ? prev.first : right, done: !!prev?.done || right };
  const where = right ? at : prev?.at;
  if (where !== undefined) rec.at = where;
  return rec;
}

/** Whether a moment is finished, from the saved answers and the tasks done. */
export function isMomentDone(m: Moment, answers: Answers, tasks: readonly string[]): boolean {
  if (m.task) return tasks.includes(m.task);
  if (m.action === "tap" || m.action === "pick" || m.action === "number") return !!checkOf(answers, m.key)?.done;
  return false;
}

/**
 * The rules found: those of moments before `index` (all finished), the current one's once it is done (a beat with
 * nothing to do stamps its rule as it begins), plus the secret's once its task is done.
 */
export function rulesFound(moments: readonly Moment[], index: number, tasks: readonly string[], currentDone: boolean): string[] {
  const out: string[] = [];
  moments.forEach((m, i) => {
    if (!m.rule) return;
    const done = m.kind === "secret" ? !!m.task && tasks.includes(m.task) : i < index || (i === index && (currentDone || m.action === "next"));
    if (done) out.push(m.rule);
  });
  return out;
}

/**
 * Progress for the robot's eyes, 0..1. With objectives, the eyes fill in equal steps as each objective (and the
 * fix-it round) finishes; without them, moment by moment. The secret never counts: it is a bonus.
 */
export function progressOf(moments: readonly Moment[], index: number, currentDone: boolean): number {
  const finished = (i: number) => i < index || (i === index && currentDone);
  const counted = moments.filter((m) => m.kind !== "secret" && m.kind !== "end");
  const starts = counted.filter((m) => m.beat?.objective);
  if (!starts.length) {
    const total = Math.max(1, counted.length);
    return Math.min(1, counted.filter((m) => finished(moments.indexOf(m))).length / total);
  }
  // Each objective ends at the beat before the next one starts; the fix-it round is one more step.
  const beats = moments.filter((m) => m.kind === "beat");
  const groups: number[] = [];
  beats.forEach((m, i) => {
    if (m.beat?.objective || i === 0) groups.push(i);
  });
  const ends = groups.map((_, g) => (g + 1 < groups.length ? groups[g + 1]! - 1 : beats.length - 1));
  const fixes = moments.filter((m) => m.kind === "fix");
  const steps = ends.length + (fixes.length ? 1 : 0);
  let done = ends.filter((e) => finished(moments.indexOf(beats[e]!))).length;
  if (fixes.length && finished(moments.indexOf(fixes[fixes.length - 1]!))) done++;
  return Math.min(1, done / steps);
}

/** Fills a note's placeholders: {hole} is the hole the learner tapped. */
export function noteText(text: string, tapped: string | undefined): string {
  return text.replace(/\{hole\}/g, tapped ? holeName(tapped) : "");
}

/** "hole:c7" or "c7" -> "c7"; rail holes read as "+ rail" or "- rail". */
export function holeName(anchor: string): string {
  const id = anchor.replace(/^hole:/, "");
  const m = /^(tp|tn|bp|bn)(\d+)$/.exec(id);
  if (!m) return id;
  return m[1]!.endsWith("p") ? `+${m[2]}` : `-${m[2]}`;
}
