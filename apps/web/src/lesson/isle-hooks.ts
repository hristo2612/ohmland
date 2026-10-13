/**
 * The seam between the lesson player and the progress island (packages/isle). The player calls:
 * - prefetch() once the quiz starts, so the island code is warm by the end of the lesson;
 * - prime() inside the learner's tap on "Finish lesson", so audio may start (browsers only allow it after a gesture);
 * - reveal({ before, after, muted }) after the lesson is saved, and shows the finale when it resolves.
 * A reveal that fails or hangs never blocks the finale (the player races it against a timeout).
 *
 * Today this is a stub. When the island lands, getIsleHooks() will lazy-import it.
 */
import type { LearnerState } from "../progress/types";

export type IsleRevealInfo = { before: LearnerState; after: LearnerState; muted: boolean };

export type IsleHooks = {
  prefetch(): void;
  prime(): void;
  reveal(info: IsleRevealInfo): Promise<void>;
};

export const stubIsleHooks: IsleHooks = {
  prefetch() {},
  prime() {},
  reveal: async () => {},
};

export function getIsleHooks(): IsleHooks {
  return stubIsleHooks;
}

/** Longest the finale waits for the island's reveal. */
export const REVEAL_TIMEOUT_MS = 6000;
