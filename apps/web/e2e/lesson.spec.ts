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
  await expect(page).toHaveURL(/\/learn\/basics\/sample-first-glow/);

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

  // The island reveal: a modal dialog with the new piece's caption and one way on.
  const reveal = page.getByRole("dialog");
  await expect(reveal).toBeVisible();
  await expect(reveal.locator(".reveal__lines")).toContainText("Make an LED glow");
  await reveal.getByRole("button", { name: "Continue" }).click();
  await expect(reveal).toBeHidden();

  // Finale: 30 for the lesson + 4 first tries x 10 + "First spark" (20) + "Clean sweep" (25) = 115 XP.
  const finale = page.locator("[data-finale]");
  await expect(finale).toBeVisible();
  await expect(finale.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  await expect(page.locator(".finale__xp")).toHaveText("+115 XP");

  // The XP survives a reload: the header chip on the course map shows level 2.
  await page.goto("/learn");
  await expect(page.locator(".level-chip__badge")).toHaveText("2");
});

test("a lesson's first load carries no three.js", async ({ page }) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (res) => {
    if (res.request().resourceType() === "script") scripts.push(res.text().catch(() => ""));
  });
  await page.goto("/learn/basics/sample-first-glow", { waitUntil: "networkidle" });
  await expect(page.locator("[data-step-type=hook]")).toBeVisible();
  const bodies = await Promise.all(scripts);
  expect(bodies.length).toBeGreaterThan(0);
  // three.js names its renderer in its source, and so does the island
  expect(bodies.filter((js) => js.includes("WebGLRenderer"))).toHaveLength(0);
});
