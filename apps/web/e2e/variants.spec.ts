import { expect, test } from "@playwright/test";

test("the cable variants page draws every bench in every style, and opens one live", async ({ page }) => {
  await page.goto("/variants/cables");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const rows = page.locator(".cv-row");
  await expect(rows).toHaveCount(7);
  await expect(page.locator(".cv-cell")).toHaveCount(28);
  // Each cell is a live ink bench with its cables drawn.
  await expect(page.locator(".cv-cell svg").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.locator(".cv-cell svg").count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(28);
  const scores = await page.locator(".cv-score").allTextContents();
  expect(scores).toHaveLength(28);

  // A cell opens that bench full size in its style.
  await page.locator('.cv-row[data-case="welcome-to-the-bench"] .cv-cell[data-style="taped"]').click();
  await expect(page).toHaveURL(/case=welcome-to-the-bench&style=taped/);
  await expect(page.locator(".cv-single-bench svg").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.cv-single-head [aria-current="true"]', { hasText: "B. Taped down" })).toBeVisible();
});
