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
export type { IsleLabel, IsleStats, IsleView, MountOptions, RevealInfo } from "./render/view";

/** Draws a plan into `el` (a sized container). Loads three.js on first use. */
export async function mountIsle(el: HTMLElement, plan: IslePlan, opts: MountOptions): Promise<IsleView> {
  const { createIsleView } = await import("./render/view");
  return createIsleView(el, plan, opts);
}
