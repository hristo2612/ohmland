/**
 * The local-first learner store. One zustand store per page, shared by every island. It loads the record from
 * IndexedDB (or memory), applies changes immutably, saves after each change, tells other tabs, and offers the
 * ProgressSync seam for accounts.
 */
import { create } from "zustand";
import type { CourseOutline } from "../content/outline";
import { emptyOutline } from "../content/outline";
import { m } from "../i18n";
import { toast } from "../components/toast-store";
import { evaluateAchievements, type Achievement, type LabEvent } from "./achievements";
import { totalXp } from "./derive";
import { levelProgress, type LevelProgress } from "./levels";
import { mergeLearners } from "./merge";
import { partsBin } from "./parts";
import { applyPrefs } from "./prefs";
import { emptyLearner, normalizeLearner } from "./state";
import { memoryStorage, openStorage, type LearnerStorage, type Persistence } from "./storage";
import type { ProgressSync, SyncStatus } from "./sync";
import { FRIED_CAP, type InProgress, type LearnerState, type LessonRecord, type Settings } from "./types";
import { completedModules, XP } from "./xp";

export type Completion = {
  lessonId: string;
  before: LearnerState;
  after: LearnerState;
  xpBefore: number;
  xpAfter: number;
  levelBefore: LevelProgress;
  levelAfter: LevelProgress;
  gained: {
    lesson: number;
    firstTry: number;
    tasks: number;
    modules: string[];
    achievements: Achievement[];
    total: number;
  };
  newParts: string[];
  replay: boolean;
};

export type CompleteInput = { lessonId: string; version: number; firstTry: number; items: number; tasks: string[] };

type Status = "idle" | "loading" | "ready";

export type LearnerStoreState = {
  status: Status;
  persistence: Persistence | null;
  learner: LearnerState;
  outline: CourseOutline;
  sync: { status: SyncStatus; label: string | null };
  init(outline?: CourseOutline): Promise<void>;
  saveProgress(lessonId: string, entry: Omit<InProgress, "at">): void;
  clearProgress(lessonId: string): void;
  completeLesson(input: CompleteInput): Completion;
  recordFried(kind: string, label: string, lessonId: string | null): { earned: Achievement[] };
  setSettings(patch: Partial<Settings>): void;
  exportJson(): string;
  importJson(text: string): Promise<boolean>;
  reset(): Promise<void>;
  attachSync(sync: ProgressSync): Promise<void>;
};

const nowIso = () => new Date().toISOString();

let storage: LearnerStorage | null = null;
let initPromise: Promise<void> | null = null;
let saving: Promise<unknown> = Promise.resolve();
let channel: BroadcastChannel | null = null;
let activeSync: ProgressSync | null = null;
const TAB_ID = Math.random().toString(36).slice(2);

function persist(state: LearnerState) {
  const s = storage;
  if (!s) return;
  saving = saving.then(() => s.save(state)).catch(() => undefined);
  void saving.then(() => channel?.postMessage({ from: TAB_ID, type: "changed" }));
  if (activeSync) {
    const sync = activeSync;
    useLearner.setState({ sync: { status: "syncing", label: sync.label } });
    void sync
      .push(state)
      .then(() => useLearner.setState({ sync: { status: "synced", label: sync.label } }))
      .catch(() => useLearner.setState({ sync: { status: "error", label: sync.label } }));
  }
}

function mergeOutline(a: CourseOutline, b: CourseOutline): CourseOutline {
  if (!a.order.length) return b;
  if (!b.order.length) return a;
  return b.order.length >= a.order.length ? b : a;
}

export const useLearner = create<LearnerStoreState>((set, get) => {
  /** Applies a change: stamps updatedAt, stores it in memory, saves it. */
  const commit = (next: LearnerState) => {
    const stamped = { ...next, updatedAt: nowIso() };
    set({ learner: stamped });
    persist(stamped);
    return stamped;
  };

  return {
    status: "idle",
    persistence: null,
    learner: emptyLearner(),
    outline: emptyOutline(),
    sync: { status: "local", label: null },

    init(outline) {
      if (outline) set({ outline: mergeOutline(get().outline, outline) });
      if (initPromise) return initPromise;
      set({ status: "loading" });
      initPromise = (async () => {
        storage = await openStorage();
        let loaded: LearnerState | null = null;
        try {
          loaded = await storage.load();
        } catch {
          storage = memoryStorage();
        }
        const learner = loaded ?? emptyLearner(nowIso());
        set({ learner, status: "ready", persistence: storage.kind });
        try {
          applyPrefs(learner.settings);
        } catch {
          // No document (tests): nothing to apply.
        }
        if (typeof BroadcastChannel !== "undefined") {
          channel = new BroadcastChannel("ohmland-learner");
          channel.onmessage = async (e: MessageEvent<{ from: string; type: string }>) => {
            if (e.data?.from === TAB_ID || !storage) return;
            const fresh = await storage.load().catch(() => null);
            if (fresh) {
              set({ learner: fresh });
              applyPrefs(fresh.settings);
            }
          };
        }
      })();
      return initPromise;
    },

    saveProgress(lessonId, entry) {
      const { learner } = get();
      commit({ ...learner, inProgress: { ...learner.inProgress, [lessonId]: { ...entry, at: nowIso() } } });
    },

    clearProgress(lessonId) {
      const { learner } = get();
      if (!learner.inProgress[lessonId]) return;
      const inProgress = { ...learner.inProgress };
      delete inProgress[lessonId];
      commit({ ...learner, inProgress });
    },

    completeLesson(input) {
      const { learner: before, outline } = get();
      const at = nowIso();
      const prev = before.lessons[input.lessonId];
      const record: LessonRecord = prev
        ? {
            at: prev.at,
            version: Math.max(prev.version, input.version),
            firstTry: Math.max(prev.firstTry, input.firstTry),
            items: Math.max(prev.items, input.items),
            tasks: [...new Set([...prev.tasks, ...input.tasks])].sort(),
          }
        : { at, version: input.version, firstTry: input.firstTry, items: input.items, tasks: [...new Set(input.tasks)].sort() };
      const inProgress = { ...before.inProgress };
      delete inProgress[input.lessonId];
      let after: LearnerState = { ...before, lessons: { ...before.lessons, [input.lessonId]: record }, inProgress };
      const events: LabEvent[] = [{ type: "lesson-complete", lessonId: input.lessonId, firstTry: input.firstTry, items: input.items }];
      const evaluated = evaluateAchievements({ state: after, outline, events }, at);
      after = commit(evaluated.state);

      const xpBefore = totalXp(before, outline);
      const xpAfter = totalXp(after, outline);
      const modulesBefore = new Set(completedModules(before, outline));
      const partsBefore = new Set(partsBin(before, outline));
      return {
        lessonId: input.lessonId,
        before,
        after,
        xpBefore,
        xpAfter,
        levelBefore: levelProgress(xpBefore),
        levelAfter: levelProgress(xpAfter),
        gained: {
          lesson: prev ? 0 : XP.lesson,
          firstTry: XP.firstTry * (record.firstTry - (prev?.firstTry ?? 0)),
          tasks: XP.task * (record.tasks.length - (prev?.tasks.length ?? 0)),
          modules: completedModules(after, outline).filter((id) => !modulesBefore.has(id)),
          achievements: evaluated.earned,
          total: xpAfter - xpBefore,
        },
        newParts: partsBin(after, outline).filter((p) => !partsBefore.has(p)),
        replay: !!prev,
      };
    },

    recordFried(kind, label, lessonId) {
      const { learner, outline } = get();
      const at = nowIso();
      const fried = [...learner.fried, { kind, label, lessonId, at }].slice(-FRIED_CAP);
      const events: LabEvent[] = [{ type: "fried", kind, lessonId }];
      const evaluated = evaluateAchievements({ state: { ...learner, fried }, outline, events }, at);
      commit(evaluated.state);
      toast({ title: m.fried.toastTitle(label), body: m.mascot.fried(label), tone: "fried", mascot: "oops" });
      for (const a of evaluated.earned) toast({ title: m.achievements.toast(a.title), body: a.description, tone: "good", icon: a.icon });
      return { earned: evaluated.earned };
    },

    setSettings(patch) {
      const { learner } = get();
      const settings = { ...learner.settings, ...patch };
      applyPrefs(settings);
      commit({ ...learner, settings });
    },

    exportJson() {
      return JSON.stringify({ app: "ohmland", exportedAt: nowIso(), learner: get().learner }, null, 2);
    },

    async importJson(text) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return false;
      }
      const raw = typeof parsed === "object" && parsed !== null && "learner" in parsed ? (parsed as { learner: unknown }).learner : parsed;
      const incoming = normalizeLearner(raw);
      if (!incoming) return false;
      const merged = mergeLearners(get().learner, incoming);
      applyPrefs(merged.settings);
      commit(merged);
      return true;
    },

    async reset() {
      const fresh = emptyLearner(nowIso());
      fresh.settings = { ...get().learner.settings };
      await storage?.clear().catch(() => undefined);
      commit(fresh);
    },

    async attachSync(sync) {
      activeSync = sync;
      set({ sync: { status: "syncing", label: sync.label } });
      try {
        const remote = await sync.pull();
        const merged = remote ? mergeLearners(get().learner, remote) : get().learner;
        commit(merged);
        sync.subscribe?.((incoming) => {
          const next = mergeLearners(get().learner, incoming);
          set({ learner: next });
          void storage?.save(next);
        });
      } catch {
        set({ sync: { status: "error", label: sync.label } });
      }
    },
  };
});

/** Waits for pending writes (used before navigating away from a lesson). */
export const flushSaves = () => saving;
