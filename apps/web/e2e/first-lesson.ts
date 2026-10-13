import { expect, type Page } from "@playwright/test";

export const FIRST_LESSON = "sample-first-glow";
export const FIRST_LESSON_URL = `/learn/basics/${FIRST_LESSON}`;

const primary = (page: Page) => page.locator("[data-primary]");

async function checkAndContinue(page: Page) {
  await primary(page).click(); // Check answer
  await expect(page.locator(".feedback[data-tone=good]")).toBeVisible();
  await primary(page).click(); // Next question / Continue
}

/** Plays the first sample lesson from its hook to the finale, every quiz item right on the first try. */
export async function playFirstLesson(page: Page) {
  // Hook: make a guess, then find out.
  await page.locator("[data-predict-option]").nth(2).click();
  await primary(page).click();

  // Lab (placeholder until the bench lands).
  await expect(page.locator("[data-lab-ready]")).toBeVisible();
  await primary(page).click();

  // Three explain cards.
  for (let i = 0; i < 3; i++) await primary(page).click();

  // Quiz: every item right on the first try.
  await page.locator("[data-option]", { hasText: "To limit the current" }).click();
  await checkAndContinue(page);

  await page.locator("[data-option]", { hasText: "bigger resistor" }).click();
  await page.locator("[data-option]", { hasText: "lower voltage" }).click();
  await checkAndContinue(page);

  await page.locator("[data-numeric-input]").fill("15 mA");
  await checkAndContinue(page);

  // Order: sort with the move-up buttons (data-key is each step's place in the right order).
  for (let guard = 0; guard < 30; guard++) {
    const keys = await page.locator("[data-order-item]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-key"))));
    const firstWrong = keys.findIndex((k, i) => k !== i);
    if (firstWrong === -1) break;
    await page.locator("[data-order-item]").nth(keys.indexOf(firstWrong)).locator("[data-move=up]").click();
  }
  await checkAndContinue(page);

  // Wrap: finish.
  await expect(page.locator("[data-step-type=wrap]")).toBeVisible();
  await primary(page).click();
  await expect(page.locator("[data-finale]")).toBeVisible();
}
