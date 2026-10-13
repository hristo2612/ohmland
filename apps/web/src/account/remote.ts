/**
 * The learner's cloud document, learners/{uid}: which parts of the learner record sync, and how they are packed.
 *
 * Firestore rules cannot loop over a map or a list, so a map of maps can only be counted, never checked entry by entry.
 * To let firestore.rules check every byte, each entry is packed into one short string, and the rules match all of a
 * collection's strings at once (joined) against a pattern and a size cap:
 *
 *   lessons       { "<lessonId>": "<at>|<version>|<firstTry>|<items>|<task>,<task>" }     at most 2000, 256,000 chars
 *   achievements  { "<achievementId>": "<at>" }                                          at most 500
 *   fried         [ "<at>|<kind>|<lessonId or empty>|<label>" ]                          at most 500, oldest first
 *   sandbox       { "<saveId>": "<JSON of { name, at, bench }>" }                        at most 50, 256,000 chars
 *   settings      { muted, reducedMotion, theme }
 *   updatedAt     "<at>"
 *
 * `inProgress` never leaves the device: half-done answers change on every step (a write each time), hold arbitrary
 * values the rules could not check, and resuming a ten-minute lesson on another device is worth little. A lesson
 * finished anywhere syncs; a lesson half done stays where it was started.
 *
 * Whatever does not fit the caps or the id patterns stays on the device only (it is never refused as a whole).
 */
import { normalizeLearner } from "../progress/state";
import type { FriedPart, LearnerState, LessonRecord, SavedBench, Settings } from "../progress/types";

export type RemoteDoc = {
  v: 1;
  lessons: Record<string, string>;
  achievements: Record<string, string>;
  fried: string[];
  sandbox: Record<string, string>;
  settings: Settings;
  updatedAt: string;
};

/** The caps firestore.rules enforces. Keep both in step. */
export const CAPS = {
  lessons: 2000,
  lessonChars: 256_000,
  achievements: 500,
  fried: 500,
  label: 80,
  sandbox: 50,
  sandboxChars: 256_000,
} as const;

/** The id patterns firestore.rules enforces. */
export const PATTERNS = {
  id: /^[a-z0-9][a-z0-9-]{0,79}$/,
  task: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  kind: /^[a-z0-9][a-z0-9-]{0,39}$/,
  saveId: /^[A-Za-z0-9_-]{1,64}$/,
  iso: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/,
} as const;

const EPOCH = new Date(0).toISOString();

/** A time as the rules accept it (Date#toISOString), or null when it is not a time at all. */
export function isoTime(x: string): string | null {
  if (PATTERNS.iso.test(x)) return x;
  const t = Date.parse(x);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const year = d.getUTCFullYear();
  return year >= 0 && year <= 9999 ? d.toISOString() : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));
const byKey = <T>(entries: [string, T][]): Record<string, T> => Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
/** Characters of a list of strings joined by one separator, as the rules measure them. */
const joinedLength = (values: string[]) => values.reduce((n, v) => n + v.length, 0) + Math.max(0, values.length - 1);

function packLesson(r: LessonRecord, at: string): string {
  const tasks = [...new Set(r.tasks.filter((t) => PATTERNS.task.test(t)))].sort();
  return [at, clamp(r.version, 1, 9999), clamp(r.firstTry, 0, 999), clamp(r.items, 0, 999), tasks.join(",")].join("|");
}

/** Up to `max` code points, so a cut never splits a character. */
const codePoints = (s: string, max: number) => Array.from(s).slice(0, max).join("");

function packFried(f: FriedPart): string | null {
  const at = isoTime(f.at);
  if (!at || !PATTERNS.kind.test(f.kind)) return null;
  const lessonId = f.lessonId && PATTERNS.id.test(f.lessonId) ? f.lessonId : "";
  const label = codePoints(f.label.replace(/[|\r\n]+/g, " ").trim(), CAPS.label) || f.kind;
  return [at, f.kind, lessonId, label].join("|");
}

function packBench(b: SavedBench): string | null {
  try {
    return JSON.stringify({ name: b.name, at: isoTime(b.at) ?? EPOCH, bench: b.bench ?? null });
  } catch {
    return null;
  }
}

/** The cloud document for a learner record. Deterministic (keys sorted), so two equal records pack to equal documents. */
export function toRemote(s: LearnerState): RemoteDoc {
  const lessons = Object.entries(s.lessons)
    .filter(([id]) => PATTERNS.id.test(id))
    .map(([id, r]) => ({ id, r, at: isoTime(r.at) }))
    .filter((x): x is { id: string; r: LessonRecord; at: string } => x.at !== null)
    .sort((a, b) => (a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1))
    .slice(0, CAPS.lessons)
    .map(({ id, r, at }) => [id, packLesson(r, at)] as [string, string]);
  // The earliest lessons are kept when the packed list is too long (it never is for a real learner).
  while (lessons.length && joinedLength(lessons.map(([, v]) => v)) > CAPS.lessonChars) lessons.pop();

  const achievements = Object.entries(s.achievements)
    .filter(([id]) => PATTERNS.id.test(id))
    .map(([id, a]) => [id, isoTime(a.at)] as [string, string | null])
    .filter((x): x is [string, string] => x[1] !== null)
    .sort(([, a], [, b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, CAPS.achievements);

  const fried = s.fried
    .map(packFried)
    .filter((f): f is string => f !== null)
    .slice(-CAPS.fried);

  const sandbox: [string, string][] = [];
  let chars = 0;
  const saves = Object.entries(s.sandbox.saved)
    .filter(([id]) => PATTERNS.saveId.test(id))
    .sort(([, a], [, b]) => (a.at === b.at ? 0 : a.at > b.at ? -1 : 1));
  for (const [id, save] of saves) {
    if (sandbox.length >= CAPS.sandbox) break;
    const packed = packBench(save);
    // The newest benches go first; one that would break the cap stays on the device, and smaller older ones may follow.
    // The rules measure the benches joined by newlines, so each one after the first costs one more character.
    const cost = packed === null ? Infinity : packed.length + (sandbox.length ? 1 : 0);
    if (packed === null || chars + cost > CAPS.sandboxChars) continue;
    chars += cost;
    sandbox.push([id, packed]);
  }

  return {
    v: 1,
    lessons: byKey(lessons),
    achievements: byKey(achievements),
    fried,
    sandbox: byKey(sandbox),
    settings: { muted: s.settings.muted, reducedMotion: s.settings.reducedMotion, theme: s.settings.theme },
    updatedAt: isoTime(s.updatedAt) ?? EPOCH,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const strings = (x: unknown): [string, string][] => (isObj(x) ? Object.entries(x).filter((e): e is [string, string] => typeof e[1] === "string") : []);

function unpackLesson(packed: string): LessonRecord | null {
  const [at, version, firstTry, items, tasks] = packed.split("|");
  if (!at || version === undefined || firstTry === undefined || items === undefined) return null;
  return { at, version: Number(version), firstTry: Number(firstTry), items: Number(items), tasks: tasks ? tasks.split(",") : [] };
}

function unpackFried(packed: string): FriedPart | null {
  const [at, kind, lessonId, ...label] = packed.split("|");
  if (!at || !kind) return null;
  return { at, kind, lessonId: lessonId || null, label: label.join("|") || kind };
}

function unpackBench(packed: string): SavedBench | null {
  try {
    const b: unknown = JSON.parse(packed);
    return isObj(b) && typeof b.name === "string" ? { name: b.name, at: typeof b.at === "string" ? b.at : EPOCH, bench: b.bench ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * A learner record from the cloud document, or null when there is none (or it is not one of ours). Anything malformed
 * inside is dropped, never trusted: normalizeLearner checks the result like any record read from outside.
 */
export function fromRemote(raw: unknown): LearnerState | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  const lessons: Record<string, LessonRecord> = {};
  for (const [id, packed] of strings(raw.lessons)) {
    const r = unpackLesson(packed);
    if (r) lessons[id] = r;
  }
  const achievements: Record<string, { at: string }> = {};
  for (const [id, at] of strings(raw.achievements)) achievements[id] = { at };
  const fried = (Array.isArray(raw.fried) ? raw.fried : [])
    .map((f) => (typeof f === "string" ? unpackFried(f) : null))
    .filter((f): f is FriedPart => f !== null);
  const saved: Record<string, SavedBench> = {};
  for (const [id, packed] of strings(raw.sandbox)) {
    const b = unpackBench(packed);
    if (b) saved[id] = b;
  }
  return normalizeLearner({
    v: 1,
    lessons,
    inProgress: {},
    achievements,
    fried,
    sandbox: { saved },
    settings: raw.settings,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : EPOCH,
  });
}

/**
 * What a record holds for the cloud, as text to compare: the packed document without its time. Two records with the
 * same fingerprint need no write between them (a step answered mid-lesson changes only inProgress and the time).
 */
export function fingerprint(s: LearnerState): string {
  return JSON.stringify({ ...toRemote(s), updatedAt: "" });
}

/** True when a record holds anything worth keeping: a lesson, an achievement, a fried part or a saved bench. */
export function hasProgress(s: LearnerState): boolean {
  return Object.keys(s.lessons).length > 0 || Object.keys(s.achievements).length > 0 || s.fried.length > 0 || Object.keys(s.sandbox.saved).length > 0;
}
