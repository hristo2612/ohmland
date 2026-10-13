/**
 * @ohmland/isle: the learner's floating circuit-board island.
 *
 * Planning is pure and has no three.js in it, so a page can compute the plan (and its numbers) without loading the
 * renderer. mountIsle() imports the renderer, and three.js with it, on demand.
 */
import type { IslePlan } from "./plan";
import type { IsleView, MountOptions } from "./render/view";

export type { IsleEvent } from "./events";
export { madeUp, seedFrom } from "./events";
export type { IsleItem, IslePlan, IslandPlan, LandCell, Plaza, Story, Trace } from "./plan";
export { makeIsle, planHash, tierAt } from "./plan";
export { DECK, LANDMARKS, LANDMARKS_BY_UNIT, PIECES, UNITS, isLandmark, isPiece } from "./catalog";
export type { IsleMessages } from "./messages";
export { EN as ISLE_EN } from "./messages";
export type { IsleInset, IsleLabel, IsleStats, IsleView, MountOptions, RevealInfo } from "./render/view";
export { isleAudio, primeAudio } from "./audio";

const renderer = () => import("./render/view");

/** Fetches the renderer and three.js without drawing anything, so a mountIsle() that follows starts at once. */
export async function preloadIsle(): Promise<void> {
  await renderer();
}

/** Draws a plan into `el` (a sized container). Loads three.js on first use. */
export async function mountIsle(el: HTMLElement, plan: IslePlan, opts: MountOptions): Promise<IsleView> {
  const { createIsleView } = await renderer();
  return createIsleView(el, plan, opts);
}
