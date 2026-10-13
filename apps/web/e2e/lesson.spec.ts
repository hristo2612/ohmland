import { expect, test, type Page } from "@playwright/test";

const primary = (page: Page) => page.locator("[data-primary]");

async function checkAndContinue(page: Page) {
  await primary(page).click(); // Check answer
  await expect(page.locator(".feedback[data-tone=good]")).toBeVisible();
  await primary(page).click(); // Next question / Continue
}

test("a guest finishes the first lesson and sees XP on the finale", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start learning" }).first().click();
  await expect(page).toHaveURL(/\/learn\/basics\/welcome-to-the-bench/);

  // Hook: make a guess, then find out.
  await page.locator("[data-predict-option]").nth(2).click();
  await primary(page).click();

  // Lab (placeholder until the bench lands).
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

  // The island reveal: a modal dialog with the new piece's caption and one way on.
  const reveal = page.getByRole("dialog");
  await expect(reveal).toBeVisible();
  await expect(reveal.locator(".reveal__lines")).toContainText("Welcome to the bench");
  await reveal.getByRole("button", { name: "Continue" }).click();
  await expect(reveal).toBeHidden();

  // Finale: 30 for the lesson + 5 first tries x 10 + "First spark" (20) + "Clean sweep" (25) = 125 XP.
  const finale = page.locator("[data-finale]");
  await expect(finale).toBeVisible();
  await expect(finale.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  await expect(page.locator(".finale__xp")).toHaveText("+125 XP");

  // The XP survives a reload: the header chip on the course map shows level 2.
  await page.goto("/learn");
  await expect(page.locator(".level-chip__badge")).toHaveText("2");
});

test("a lesson's first load carries no three.js", async ({ page }) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (res) => {
    if (res.request().resourceType() === "script") scripts.push(res.text().catch(() => ""));
  });
  await page.goto("/learn/basics/welcome-to-the-bench", { waitUntil: "networkidle" });
  await expect(page.locator("[data-step-type=hook]")).toBeVisible();
  const bodies = await Promise.all(scripts);
  expect(bodies.length).toBeGreaterThan(0);
  // three.js names its renderer in its source, and so does the island
  expect(bodies.filter((js) => js.includes("WebGLRenderer"))).toHaveLength(0);
});
