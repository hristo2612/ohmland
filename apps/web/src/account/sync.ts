/**
 * The ProgressSync for a signed-in learner (progress/sync.ts), over one Firestore document, learners/{uid}.
 *
 * - Every change goes through the queue (queue.ts): sent once changes pause for about two seconds, kept and retried
 *   when offline or when a write fails.
 * - Each write reads the cloud copy and merges it in first (mergeLearners, in a transaction), so a lesson finished on
 *   another device is never overwritten. When the cloud held something this device lacked, the store hears about it.
 * - A change the cloud already has (a step answered mid-lesson only touches inProgress, which never syncs) costs nothing.
 * - A page that is being hidden sends what waits at once; a page that is going away sends it with a keepalive request.
 */
import { mergeLearners } from "../progress/merge";
import type { ProgressSync, SyncStatus } from "../progress/sync";
import type { LearnerState } from "../progress/types";
import { replacePending, setReplacePending } from "./device";
import { createPushQueue, SYNC_DELAY_MS } from "./queue";
import { fingerprint, fromRemote, toRemote, type RemoteDoc } from "./remote";

/** The cloud side, as sync needs it (Firestore through firebase.ts in the browser, a fake in tests). */
export type LearnerDocs = {
  read(uid: string): Promise<unknown>;
  write(uid: string, d: RemoteDoc): Promise<void>;
  update(uid: string, next: (stored: unknown) => RemoteDoc | null): Promise<void>;
  beacon(uid: string, d: RemoteDoc): boolean;
};

export type FirestoreSyncOptions = {
  uid: string;
  label: string;
  docs: LearnerDocs;
  /** The document as already read (the sign-in read it to decide whether to ask), so the first pull costs nothing. */
  prefetched?: { raw: unknown };
  delayMs?: number;
  /** Errors that mean "the network is down" rather than "refused". */
  isNetworkError?: (e: unknown) => boolean;
};

export function createFirestoreSync({ uid, label, docs, prefetched, delayMs = SYNC_DELAY_MS, isNetworkError }: FirestoreSyncOptions): ProgressSync {
  const statusListeners = new Set<(s: SyncStatus) => void>();
  const remoteListeners = new Set<(s: LearnerState) => void>();
  /** The cloud copy as last read or written, and its fingerprint. */
  let known: { state: LearnerState | null; print: string | null } = { state: null, print: null };
  const learn = (state: LearnerState | null) => {
    known = { state, print: state ? fingerprint(state) : null };
  };
  let initial = prefetched;
  /**
   * Set by replace() until a write lands: the device's record is the truth (all progress was deleted), so pulls see no
   * cloud copy and writes replace it instead of merging with it, which would bring everything back. Offline, it waits like
   * any change, and it is kept across pages (device.ts) so a reload cannot undo it either.
   */
  let replacing = replacePending(uid);
  const setReplacing = (on: boolean) => {
    replacing = on;
    setReplacePending(on ? uid : null);
  };
  const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

  const queue = createPushQueue<LearnerState>({
    delayMs,
    isOnline: online,
    ...(isNetworkError ? { isNetworkError } : {}),
    onStatus: (s) => {
      for (const l of statusListeners) l(s);
    },
    async send(state) {
      if (replacing) {
        await docs.write(uid, toRemote(state));
        setReplacing(false);
        learn(state);
        return;
      }
      let merged = state;
      await docs.update(uid, (stored) => {
        const cloud = fromRemote(stored);
        merged = cloud ? mergeLearners(state, cloud) : state;
        // Nothing to write when the merge adds nothing to the cloud copy.
        return cloud && fingerprint(merged) === fingerprint(cloud) ? null : toRemote(merged);
      });
      learn(merged);
      if (fingerprint(state) !== known.print) for (const l of remoteListeners) l(merged);
    },
  });

  const onOnline = () => void queue.network(true);
  const onOffline = () => void queue.network(false);
  const onHidden = () => {
    if (document.visibilityState === "hidden") void queue.flush();
  };
  /** The page is going away: what has not reached the cloud goes with a keepalive request, merged with the last known copy. */
  const onPageHide = () => {
    const unsent = queue.unsent();
    if (!unsent) return;
    docs.beacon(uid, toRemote(known.state && !replacing ? mergeLearners(unsent, known.state) : unsent));
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHidden);
  }

  return {
    label,
    async pull() {
      if (replacing) return null;
      const raw = initial ? initial.raw : await docs.read(uid);
      initial = undefined;
      const state = fromRemote(raw);
      learn(state);
      return state;
    },
    push(state) {
      if (!replacing && known.print !== null && fingerprint(state) === known.print) queue.skip();
      else queue.schedule(state);
    },
    flush: () => queue.flush(),
    async replace(state) {
      setReplacing(true);
      queue.schedule(state);
      await queue.flush();
    },
    onStatus(cb) {
      statusListeners.add(cb);
      if (!online()) cb("offline");
      return () => statusListeners.delete(cb);
    },
    subscribe(cb) {
      remoteListeners.add(cb);
      return () => remoteListeners.delete(cb);
    },
    disconnect() {
      queue.cancel();
      statusListeners.clear();
      remoteListeners.clear();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
        window.removeEventListener("pagehide", onPageHide);
        document.removeEventListener("visibilitychange", onHidden);
      }
    },
  };
}
