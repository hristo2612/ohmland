/**
 * Everything island, behind loadIsle() (./load.ts): the isle's planner and renderer entry, the app's events and
 * messages, and small helpers the island views share. Never import this module statically.
 */
import type { IsleMessages, IslePlan, IsleView } from "@ohmland/isle";

export { madeUp, makeIsle, mountIsle } from "@ohmland/isle";
export { isleCounts, isleEvents, revealRange } from "../progress/isleEvents";
export { isleMessages } from "./messages";

/** Loads three.js (the renderer's bulk) without creating anything; mountIsle() then only fetches the small rest. */
export const warmRenderer = (): Promise<void> => import("three").then(() => undefined);

/** Stops drawing while the tab is hidden. Returns the cleanup. */
export function pauseWhenHidden(view: IsleView): () => void {
  const sync = () => (document.hidden ? view.pause() : view.resume());
  document.addEventListener("visibilitychange", sync);
  if (document.hidden) view.pause();
  return () => document.removeEventListener("visibilitychange", sync);
}

export type IsleEntry = { key: string; name: string; detail: string };

/**
 * A text list of what the learner has placed, newest last, in the same words as the tap labels. The canvas is hidden
 * from assistive tech, so this list is its text alternative.
 */
export function describeIsle(plan: IslePlan, msg: IsleMessages): IsleEntry[] {
  return plan.items
    .filter((it) => it.story.some((s) => s.type !== "start"))
    .map((it) => {
      const tier = it.tiers.length - 1;
      const n = msg.names[it.kind];
      const name = Array.isArray(n) ? (n[Math.min(tier, n.length - 1)] ?? it.kind) : (n ?? it.kind);
      const s = it.story[tier];
      const detail = s?.type === "lesson" ? msg.placedBy(s.title) : s?.type === "module" ? (tier > 0 ? msg.raisedBy(s.title) : msg.builtBy(s.title)) : "";
      return { key: String(it.id), name, detail };
    });
}
