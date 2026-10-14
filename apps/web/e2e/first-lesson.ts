import { expect, type Page } from "@playwright/test";
import { atMoment, benchReady, drag, project, taskDone, tapHole } from "./lab";

/** The first lesson of the course: a bench lesson (format: bench). */
export const FIRST_LESSON = "how-a-breadboard-works";
export const FIRST_LESSON_URL = `/learn/basics/${FIRST_LESSON}`;

const primary = (page: Page) => page.locator("[data-primary]").first();
const narrow = (page: Page) => (page.viewportSize()?.width ?? 1000) < 600;

/** Turns the breadboard's LED a quarter turn: pick it up by its dome, then the bench's Rotate button. */
async function rotateLed(page: Page) {
  if (narrow(page)) {
    await page.evaluate(() => window.ohmlandLab!.step!({ do: "rotate", part: "D1" }));
    return;
  }
  const a = await project(page, "pin:D1.anode");
  const k = await project(page, "pin:D1.cathode");
  await page.mouse.click((a.x + k.x) / 2, (a.y + k.y) / 2 - 36);
  await page.getByRole("button", { name: "Rotate" }).first().click();
}

/** Slides the black jumper's rail end far along the minus rail. */
async function slideRailEnd(page: Page) {
  if (narrow(page)) {
    await page.evaluate(() => {
      window.ohmlandLab!.step!({ do: "unwire", wire: "W1" });
      window.ohmlandLab!.step!({ do: "wire", id: "W1", from: "a11", to: "rail-:26", color: "black" });
    });
    return;
  }
  await drag(page, await project(page, "wire:W1.b"), await project(page, "hole:bn26"));
}

/**
 * Plays the first lesson from its start screen to the finale, every check right on the first try. A first completion
 * finishes the Start here module too, so the island reveal opens before the finale; it is closed and the finale shown.
 */
export async function playFirstLesson(page: Page, opts: { expectReveal?: boolean } = {}) {
  // The start screen: the mission and one way in.
  await expect(page.locator('.bl[data-phase="start"]')).toBeVisible();
  await primary(page).click();
  await benchReady(page);

  // Meet the board: any hole has a name. Then the x-ray.
  await atMoment(page, "b0", "act");
  await tapHole(page, "c7");
  await atMoment(page, "b0", "done");
  await primary(page).click();
  await atMoment(page, "b1", "act");
  await tapHole(page, "h9");
  await atMoment(page, "b1", "done");
  await primary(page).click();

  // The game: three holes, each joined to the marked one, right the first time.
  await atMoment(page, "b2", "act");
  await tapHole(page, "d14");
  await atMoment(page, "b3", "act");
  await tapHole(page, "a18");
  await atMoment(page, "b4", "act");
  await tapHole(page, "bp27");
  await atMoment(page, "b4", "done");
  await primary(page).click();

  // The LED with both legs in one strip, then the rail.
  await atMoment(page, "b5", "act");
  await rotateLed(page);
  await taskDone(page, "fix-led");
  await atMoment(page, "b5", "done");
  await primary(page).click();
  await atMoment(page, "b6", "act");
  await slideRailEnd(page);
  await taskDone(page, "rail-slide");
  await atMoment(page, "b6", "done");
  await primary(page).click();

  // The secret is optional: skip it. Then sign the page.
  await atMoment(page, "secret", "act");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
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
