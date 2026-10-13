/**
 * Where the learner record lives on this device: IndexedDB through idb-keyval, or memory when the browser refuses
 * storage (some private windows, blocked site data). The UI shows a notice in the memory case.
 */
import { createStore, del, get, set, type UseStore } from "idb-keyval";
import { normalizeLearner } from "./state";
import type { LearnerState } from "./types";

export type Persistence = "idb" | "memory";

export interface LearnerStorage {
  readonly kind: Persistence;
  load(): Promise<LearnerState | null>;
  save(state: LearnerState): Promise<void>;
  clear(): Promise<void>;
}

const DB = "ohmland";
const STORE = "learner";
/** One record per profile. There is a single profile for now. */
export const PROFILE_KEY = "profile:default";

export function memoryStorage(initial: LearnerState | null = null): LearnerStorage {
  let value = initial ? structuredClone(initial) : null;
  return {
    kind: "memory",
    load: async () => (value ? structuredClone(value) : null),
    save: async (s) => {
      value = structuredClone(s);
    },
    clear: async () => {
      value = null;
    },
  };
}

function idbStorage(store: UseStore): LearnerStorage {
  return {
    kind: "idb",
    load: async () => normalizeLearner(await get(PROFILE_KEY, store)),
    save: (s) => set(PROFILE_KEY, s, store),
    clear: () => del(PROFILE_KEY, store),
  };
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("storage timeout")), ms))]);

/** Opens IndexedDB and proves it works with a read, falling back to memory if anything throws or hangs. */
export async function openStorage(): Promise<LearnerStorage> {
  try {
    if (typeof indexedDB === "undefined") return memoryStorage();
    const store = createStore(DB, STORE);
    await withTimeout(get("probe", store), 3000);
    return idbStorage(store);
  } catch {
    return memoryStorage();
  }
}
