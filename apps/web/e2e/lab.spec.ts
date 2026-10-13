import { expect, test } from "@playwright/test";
import { bench, benchReady, clipTo, leadFromTray, project, taskDone } from "./lab";

const primary = (page: import("@playwright/test").Page) => page.locator("[data-primary]");

test("first-glow: wire a loop from the tray, then fry the LED into the Hall of Fried Parts", async ({ page }) => {
  await page.goto("/learn/basics/first-glow");
  await page.locator("[data-predict-option]").nth(1).click();
  await primary(page).click();
  await benchReady(page);

  // Battery plus, resistor, LED, battery minus: three clip leads out of the tray.
  const red = await leadFromTray(page, "Red", "pin:B1.pos");
  await clipTo(page, red, "a", "pin:R1.a");
  const green = await leadFromTray(page, "Green", "pin:R1.b");
  await clipTo(page, green, "a", "pin:D1.anode");
  const black = await leadFromTray(page, "Black", "pin:D1.cathode");
  await clipTo(page, black, "a", "pin:B1.neg");
  await taskDone(page, "build-loop");
  expect(await page.evaluate(() => (window.ohmlandLab!.part("D1") as { glow: number }).glow)).toBeGreaterThan(0.3);
  await expect(page.locator("[data-task=build-loop] .lab-task__xp")).toHaveText("+15 XP");

  // The bonus: take the resistor out of the loop. The LED flashes and dies.
  await clipTo(page, red, "a", "pin:D1.anode");
  const card = page.locator(".fried-card");
  await expect(card).toContainText("Red LED, no resistor on 9 V");
  await expect(card).toContainText("Hall of Fried Parts");
  await taskDone(page, "no-resistor");

  await expect(card.locator("[data-replace]")).toBeVisible();

  // Reset bench: the starting parts, all fresh, and the tasks stay done. (On a phone the tools are in the open sheet.)
  const grip = page.locator(".lab__grip");
  if (await grip.isVisible()) await grip.click();
  await page.getByRole("button", { name: "Reset bench" }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(async () => (await bench(page)).leads.length).toBe(0);
  await expect.poll(() => page.evaluate(() => (window.ohmlandLab!.part("D1") as { health: string } | null)?.health)).toBe("ok");
  await taskDone(page, "build-loop");

  // The Hall of Fried Parts keeps it.
  await page.goto("/achievements");
  await expect(page.getByText("Red LED, no resistor on 9 V").first()).toBeVisible();
});

test("the free-build bench builds, saves and clears", async ({ page }) => {
  await page.goto("/bench");
  await benchReady(page);
  // The starter kit: a battery and clip leads, even with an empty parts bin.
  await expect(page.locator(".ohb-tray .ohb-item")).toHaveCount(4);
  const box = (await page.locator(".ohb-tray .ohb-item", { hasText: "battery" }).first().boundingBox())!;
  const spot = await project(page, [0, 0, 0]);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + ((spot.x - box.x) * i) / 10, box.y + ((spot.y - box.y) * i) / 10);
  await page.mouse.up();
  await expect.poll(async () => (await bench(page)).parts.length).toBe(1);

  await page.getByPlaceholder("My circuit").fill("One battery");
  await page.locator("[data-save]").click();
  await expect(page.locator(".sandbox__build")).toContainText("One battery");

  await page.locator("[data-clear]").click();
  await expect.poll(async () => (await bench(page)).parts.length).toBe(0);
  await page.locator(".sandbox__build").getByRole("button", { name: "Open" }).click();
  await expect.poll(async () => (await bench(page)).parts.length).toBe(1);
});
