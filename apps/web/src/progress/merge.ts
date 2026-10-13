/**
 * Merging two learner records (this device and the cloud, or an imported file). Rules (docs/ARCHITECTURE.md):
 * earliest `at` per lesson, union of tasks, max firstTry, union of achievements (earliest `at`), union of fried parts by
 * (kind, at), newest settings. Merge is commutative and idempotent, so syncing twice changes nothing.
 */
import { FRIED_CAP, type FriedPart, type InProgress, type LearnerState, type LessonRecord, type SavedBench } from "./types";

const earliest = (a: string, b: string) => (a <= b ? a : b);
const latest = (a: string, b: string) => (a >= b ? a : b);

function mergeLesson(a: LessonRecord, b: LessonRecord): LessonRecord {
  return {
    at: earliest(a.at, b.at),
    version: Math.max(a.version, b.version),
    firstTry: Math.max(a.firstTry, b.firstTry),
    items: Math.max(a.items, b.items),
    tasks: [...new Set([...a.tasks, ...b.tasks])].sort(),
  };
}

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k] as T, v) : v;
  return out;
}

/** A deterministic winner for two values that tie on every rule, so merge(a, b) equals merge(b, a). */
const tieBreak = <T>(a: T, b: T): T => (JSON.stringify(a) >= JSON.stringify(b) ? a : b);

/** The newer in-progress entry wins; on a tie, the one further along. */
function pickProgress(a: InProgress, b: InProgress): InProgress {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  if (a.step !== b.step) return a.step > b.step ? a : b;
  return tieBreak(a, b);
}

function pickBench(a: SavedBench, b: SavedBench): SavedBench {
  return a.at !== b.at ? (a.at > b.at ? a : b) : tieBreak(a, b);
}

export function mergeFried(a: readonly FriedPart[], b: readonly FriedPart[]): FriedPart[] {
  const seen = new Map<string, FriedPart>();
  for (const f of [...a, ...b]) {
    const key = `${f.kind}\u0000${f.at}`;
    const prev = seen.get(key);
    seen.set(key, prev ? tieBreak(prev, f) : f);
  }
  return [...seen.values()].sort((x, y) => (x.at === y.at ? x.kind.localeCompare(y.kind) : x.at.localeCompare(y.at))).slice(-FRIED_CAP);
}

export function mergeLearners(local: LearnerState, remote: LearnerState): LearnerState {
  const newer =
    remote.updatedAt !== local.updatedAt ? (remote.updatedAt > local.updatedAt ? remote : local) : tieBreak(local, remote);
  return {
    v: 1,
    lessons: mergeRecords(local.lessons, remote.lessons, mergeLesson),
    inProgress: mergeRecords(local.inProgress, remote.inProgress, pickProgress),
    achievements: mergeRecords(local.achievements, remote.achievements, (x, y) => ({ at: earliest(x.at, y.at) })),
    fried: mergeFried(local.fried, remote.fried),
    sandbox: { saved: mergeRecords(local.sandbox.saved, remote.sandbox.saved, pickBench) },
    settings: { ...newer.settings },
    updatedAt: latest(local.updatedAt, remote.updatedAt),
  };
}
