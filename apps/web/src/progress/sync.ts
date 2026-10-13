/**
 * The seam for cloud sync. Today nothing implements it: guests and everyone else keep progress on the device.
 * The Firebase account module (src/account, lazy) will provide a ProgressSync for signed-in learners, and the store
 * will merge (merge.ts) on sign-in and push after every change.
 */
import type { LearnerState } from "./types";

export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

export interface ProgressSync {
  /** A label for the account, for the account page ("ada@example.com"). */
  readonly label: string;
  /** The cloud copy, or null when this account has none yet. */
  pull(): Promise<LearnerState | null>;
  /** Replace the cloud copy with this (already merged) record. */
  push(state: LearnerState): Promise<void>;
  /** Optional live updates from other devices. Returns an unsubscribe function. */
  subscribe?(onRemote: (state: LearnerState) => void): () => void;
  /** Sign out and stop syncing. */
  disconnect(): Promise<void>;
}
