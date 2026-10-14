import { expect, type Page } from "@playwright/test";
import { atMoment, benchReady, clipTo, flipBlockSwitch, taskDone, unclip } from "./lab";

/** The first lesson of the course, Start here's first case: a bench lesson (format: bench). */
export const FIRST_LESSON = "welcome-to-the-bench";
export const FIRST_LESSON_URL = `/learn/start-here/${FIRST_LESSON}`;

const primary = (page: Page) => page.locator("[data-primary]").first();

/**
 * Plays the first lesson from its start screen to the finale, every check right on the first try. A first completion
 * places an island piece, so the island reveal opens before the finale; it is closed and the finale shown.
 */
export async function playFirstLesson(page: Page, opts: { expectReveal?: boolean } = {}) {
  // The start screen: the mission and one way in.
  await expect(page.locator('.bl[data-phase="start"]')).toBeVisible();
  await primary(page).click();
  await benchReady(page);

  // Switch on: the lamp glows.
  await atMoment(page, "b0", "act");
  await flipBlockSwitch(page, "S1");
  await taskDone(page, "close-the-switch");
  await atMoment(page, "b0", "done");
  await primary(page).click();

  // Guess, then break the loop; mend it.
  await atMoment(page, "b1", "guess");
  await page.locator("[data-guess='2']").click();
  await unclip(page, "TL2", "a");
  await taskDone(page, "break-the-loop");
  await atMoment(page, "b1", "done");
  await primary(page).click();
  await atMoment(page, "b2", "act");
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await taskDone(page, "mend-the-loop");

  // What is this? The switch.
  await atMoment(page, "b3", "act");
  await page.locator("[data-pick]", { hasText: "A switch" }).click();
  await atMoment(page, "b3", "done");
  await primary(page).click();

  // The secret is optional: skip it. The fix-it: the switch is on, the lamp dark.
  await atMoment(page, "secret", "act");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await atMoment(page, "fix0", "act");
  await expect.poll(() => page.evaluate(() => (window.ohmlandLab!.part("D1") as { glow?: number } | null)?.glow ?? 0)).toBeLessThan(0.01);
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await taskDone(page, "fix-switch");

  // Sign the page.
  await atMoment(page, "end", "act");
  await primary(page).click();

  if (opts.expectReveal ?? true) {
    // The island reveal: a modal dialog with one way on.
    const reveal = page.getByRole("dialog");
    await expect(reveal).toBeVisible({ timeout: 20_000 });
    await reveal.getByRole("button", { name: "Continue" }).click();
    await expect(reveal).toBeHidden();
  }
  await expect(page.locator("[data-finale]")).toBeVisible();
}
