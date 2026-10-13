/**
 * The seam between the lesson player and the progress island. The player calls:
 * - prefetch() once the learner has moved past the quiz (never on a lesson's first load), so the island code and
 *   three.js are warm by the time the lesson ends;
 * - prime() inside the learner's tap on "Finish lesson", so the reveal may play sound (browsers only allow audio after
 *   a gesture);
 * - reveal({ before, after, ... }) after the lesson is saved, through revealWithin(), and shows the finale when it
 *   resolves.
 *
 * A reveal that fails, or does not get on screen within REVEAL_TIMEOUT_MS, never blocks the finale. Once it is on
 * screen the player waits for the learner to close it.
 *
 * This module stays tiny: the reveal itself (../isle/reveal.tsx) and the island load on demand.
 */
import type { CourseOutline } from "../content/outline";
import { primeAudio } from "../isle/audio";
import { prefetchIsle } from "../isle/load";
import type { LearnerState } from "../progress/types";

export type IsleRevealInfo = {
  before: LearnerState;
  after: LearnerState;
  outline: CourseOutline;
  muted: boolean;
  /** Aborted when the player stops waiting for the reveal to start: the hook must not open anything after that. */
  signal: AbortSignal;
  /** Called once the reveal is on screen; from then on the player waits until it resolves. */
  onShow(): void;
};

/** What the reveal showed, for the finale's island card; null when nothing was shown. */
export type IsleRevealResult = { title: string; big: boolean } | null;

export type IsleHooks = {
  prefetch(): void;
  prime(): void;
  reveal(info: IsleRevealInfo): Promise<IsleRevealResult>;
};

export const stubIsleHooks: IsleHooks = {
  prefetch() {},
  prime() {},
  reveal: async () => null,
};

const liveHooks: IsleHooks = {
  prefetch() {
    prefetchIsle();
    void import("../isle/reveal").catch(() => undefined);
  },
  prime: primeAudio,
  async reveal(info) {
    const { playReveal } = await import("../isle/reveal");
    return playReveal(info);
  },
};

export function getIsleHooks(): IsleHooks {
  return liveHooks;
}

/** Longest the finale waits for the island's reveal to get on screen. */
export const REVEAL_TIMEOUT_MS = 6000;

/**
 * Runs the reveal for the player: resolves with its result once the learner closes it, or with null at once if it
 * fails, or if it is not on screen within `ms` (it is then told to give up).
 */
export function revealWithin(hooks: IsleHooks, info: Omit<IsleRevealInfo, "signal" | "onShow">, ms = REVEAL_TIMEOUT_MS): Promise<IsleRevealResult> {
  return new Promise((resolve) => {
    const stop = new AbortController();
    let shown = false;
    const timer = setTimeout(() => {
      if (shown) return;
      stop.abort();
      resolve(null);
    }, ms);
    hooks
      .reveal({ ...info, signal: stop.signal, onShow: () => (shown = true) })
      .then(
        (r) => resolve(r ?? null),
        () => resolve(null),
      )
      .finally(() => clearTimeout(timer));
  });
}
