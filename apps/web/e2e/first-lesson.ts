import { expect, type Page } from "@playwright/test";

export const FIRST_LESSON = "welcome-to-the-bench";
export const FIRST_LESSON_URL = `/learn/basics/${FIRST_LESSON}`;

const primary = (page: Page) => page.locator("[data-primary]");

async function checkAndContinue(page: Page) {
  await primary(page).click(); // Check answer
  await expect(page.locator(".feedback[data-tone=good]")).toBeVisible();
  await primary(page).click(); // Next question / Continue
}

/**
 * Plays the first lesson from its hook to the finale, every quiz item right on the first try. On a first completion
 * the island reveal opens before the finale: it checks the caption names the lesson, then continues.
 */
export async function playFirstLesson(page: Page, opts: { expectReveal?: boolean } = {}) {
  // Hook: make a guess, then find out.
  await page.locator("[data-predict-option]").nth(2).click();
  await primary(page).click();

  // Lab.
  await expect(page.locator("[data-lab-ready]")).toBeVisible();
  await primary(page).click();

  // Four explain cards.
  for (let i = 0; i < 4; i++) await primary(page).click();

  // Quiz: every item right on the first try.
  await page.locator("[data-option]", { hasText: "None of them" }).click();
  await checkAndContinue(page);

  // Match: the left column starts active and moves to the next unpaired item, so pick the partners in order.
  for (const right of ["the flow of charge", "the push that drives the flow", "how hard a path is to flow through", "a complete loop current can flow around"])
    await page.locator("[data-match-right]", { hasText: right }).click();
  await checkAndContinue(page);

  await page.locator("[data-option]", { hasText: "It stays dark" }).click();
  await checkAndContinue(page);

  await page.locator("[data-option]", { hasText: "From the battery's plus terminal" }).click();
  await checkAndContinue(page);

  await page.locator("[data-option]", { hasText: "A 9 V battery" }).click();
  await checkAndContinue(page);

  // Wrap: finish.
  await expect(page.locator("[data-step-type=wrap]")).toBeVisible();
  await primary(page).click();

  if (opts.expectReveal ?? true) {
    // The island reveal: a modal dialog with the new piece's caption and one way on.
    const reveal = page.getByRole("dialog");
    await expect(reveal).toBeVisible();
    await expect(reveal.locator(".reveal__lines")).toContainText("Welcome to the bench");
    await reveal.getByRole("button", { name: "Continue" }).click();
    await expect(reveal).toBeHidden();
  }
  await expect(page.locator("[data-finale]")).toBeVisible();
}
