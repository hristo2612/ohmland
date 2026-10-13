/**
 * The seam for cloud sync. Guests keep progress on the device only. For a signed-in learner, the account module
 * (src/account, loaded lazily) attaches a ProgressSync to the store (store.attachSync): the store pulls the cloud copy,
 * merges it with the device's (merge.ts), keeps the result, hands it to push(), and from then on hands every change to
 * push(). When and how a record reaches the cloud (debounced, queued while offline, merged with the cloud copy before
 * each write) is the implementation's business; it reports how that is going through onStatus().
 */
import type { LearnerState } from "./types";

/**
 * local: not syncing (a guest, or signed in but not connected yet). syncing: a change is on its way. synced: the cloud
 * has everything. offline: changes wait on the device until the browser is back online. error: the cloud could not be
 * reached or refused a write; it is tried again later.
 */
export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

export interface ProgressSync {
  /** A label for the account, for the account page and the header ("Ada Lovelace"). */
  readonly label: string;
  /** The cloud copy, or null when this account has none yet. Rejects when the cloud cannot be reached. */
  pull(): Promise<LearnerState | null>;
  /** The newest record on the device. Never throws; failures show in onStatus and are retried. */
  push(state: LearnerState): void;
  /** Sends whatever is waiting now (a page that is being hidden). Never rejects. */
  flush(): Promise<void>;
  /** Replaces the cloud copy with this record, without merging (deleting all progress while signed in). */
  replace(state: LearnerState): Promise<void>;
  /** Sync status changes. Returns an unsubscribe function. */
  onStatus(cb: (status: SyncStatus) => void): () => void;
  /** Records the cloud held that this device did not have yet (found while writing). Returns an unsubscribe function. */
  subscribe?(onRemote: (state: LearnerState) => void): () => void;
  /** Stops syncing: timers and listeners. It does not sign out. */
  disconnect(): void;
}
