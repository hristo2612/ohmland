import { FRIED_CAP, type FriedPart, type InProgress, type LearnerState, type LessonRecord, type SavedBench, type Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = { muted: false, reducedMotion: "system", theme: "system" };
const EPOCH = new Date(0).toISOString();

export function emptyLearner(now: string = EPOCH): LearnerState {
  return {
    v: 1,
    lessons: {},
    inProgress: {},
    achievements: {},
    fried: [],
    sandbox: { saved: {} },
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: now,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown, fallback: string): string => (typeof x === "string" ? x : fallback);
const num = (x: unknown, fallback: number): number => (typeof x === "number" && Number.isFinite(x) ? x : fallback);
const isoOr = (x: unknown, fallback: string): string => (typeof x === "string" && !Number.isNaN(Date.parse(x)) ? x : fallback);

function lessonRecord(x: unknown): LessonRecord | null {
  if (!isObj(x) || typeof x.at !== "string" || Number.isNaN(Date.parse(x.at))) return null;
  return {
    at: x.at,
    version: Math.max(1, Math.round(num(x.version, 1))),
    firstTry: Math.max(0, Math.round(num(x.firstTry, 0))),
    items: Math.max(0, Math.round(num(x.items, 0))),
    tasks: Array.isArray(x.tasks) ? [...new Set(x.tasks.filter((t): t is string => typeof t === "string"))] : [],
  };
}

function inProgress(x: unknown): InProgress | null {
  if (!isObj(x)) return null;
  const out: InProgress = {
    step: Math.max(0, Math.round(num(x.step, 0))),
    answers: isObj(x.answers) ? { ...x.answers } : {},
    at: isoOr(x.at, EPOCH),
  };
  if (typeof x.version === "number") out.version = x.version;
  return out;
}

function fried(x: unknown): FriedPart | null {
  if (!isObj(x) || typeof x.kind !== "string" || typeof x.at !== "string") return null;
  return { kind: x.kind, label: str(x.label, x.kind), lessonId: typeof x.lessonId === "string" ? x.lessonId : null, at: x.at };
}

function settings(x: unknown): Settings {
  const s = isObj(x) ? x : {};
  return {
    muted: typeof s.muted === "boolean" ? s.muted : DEFAULT_SETTINGS.muted,
    reducedMotion: s.reducedMotion === "on" || s.reducedMotion === "off" ? s.reducedMotion : "system",
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : "system",
  };
}

function record<T>(x: unknown, each: (v: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(x)) return out;
  for (const [k, v] of Object.entries(x)) {
    const r = each(v);
    if (r !== null) out[k] = r;
  }
  return out;
}

/**
 * Turns anything (a stored record, an imported file) into a valid LearnerState, dropping what does not fit rather
 * than failing. Returns null for something that is clearly not a learner record.
 */
export function normalizeLearner(raw: unknown): LearnerState | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  const friedList = Array.isArray(raw.fried) ? raw.fried.map(fried).filter((f): f is FriedPart => f !== null) : [];
  return {
    v: 1,
    lessons: record(raw.lessons, lessonRecord),
    inProgress: record(raw.inProgress, inProgress),
    achievements: record(raw.achievements, (a) => (isObj(a) && typeof a.at === "string" ? { at: a.at } : null)),
    fried: friedList.slice(-FRIED_CAP),
    sandbox: {
      saved: record(isObj(raw.sandbox) ? raw.sandbox.saved : null, (b): SavedBench | null =>
        isObj(b) && typeof b.name === "string" ? { name: b.name, bench: b.bench ?? null, at: isoOr(b.at, EPOCH) } : null,
      ),
    },
    settings: settings(raw.settings),
    updatedAt: isoOr(raw.updatedAt, EPOCH),
  };
}
