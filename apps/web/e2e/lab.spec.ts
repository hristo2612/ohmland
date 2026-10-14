import { expect, test, type Page } from "@playwright/test";
import { atMoment, bench, benchReady, clipTo, flipBlockSwitch, leadFromTray, project, swapClips, taskDone, unclip } from "./lab";

const primary = (page: Page) => page.locator("[data-primary]").first();
const glow = (page: Page) => page.evaluate(() => (window.ohmlandLab!.part("D1") as { glow?: number } | null)?.glow ?? 0);

/** Opens a bench lesson and taps its start button. */
async function start(page: Page, path: string) {
  await page.goto(path);
  await primary(page).click();
  await benchReady(page);
}

test("first-glow: wire a loop, find the long leg, fry the LED for the Hall, fix the bench", async ({ page }) => {
  await start(page, "/learn/basics/first-glow");

  // This is an LED: tap it.
  await atMoment(page, "b0", "act");
  await page.locator('[data-tap="D1"]').click();

  // Battery plus, resistor, LED, battery minus: three clip leads out of the tray.
  await atMoment(page, "b1", "act");
  const red = await leadFromTray(page, "Red", "pin:B1.pos");
  await clipTo(page, red, "a", "pin:R1.a");
  const green = await leadFromTray(page, "Green", "pin:R1.b");
  await clipTo(page, green, "a", "pin:D1.anode");
  const black = await leadFromTray(page, "Black", "pin:D1.cathode");
  await clipTo(page, black, "a", "pin:B1.neg");
  await taskDone(page, "build-loop");
  expect(await page.evaluate(() => (window.ohmlandLab!.part("D1") as { glow: number }).glow)).toBeGreaterThan(0.3);
  // The discovery: a note drawn onto the resistor.
  await atMoment(page, "b1", "done");
  await expect(page.locator(".ann--note .ann__text")).toContainText("holds it to about 5 mA");
  await primary(page).click();

  // The pop-up card, then a check on the bench: the short leg names itself, the long one is right.
  await atMoment(page, "b2", "act");
  await primary(page).click();
  await atMoment(page, "b3", "act");
  await page.locator('[data-tap="D1.cathode"]').click();
  await expect(page.locator(".bl-line")).toContainText("short leg");
  await page.locator('[data-tap="D1.anode"]').click();
  await atMoment(page, "b3", "done");
  await expect(page.locator(".bl-stamped")).toContainText("LED: long leg to plus.");
  await primary(page).click();

  // Guess, then swap the LED's legs: dark, and not broken. Then back.
  await atMoment(page, "b4", "guess");
  await page.locator("[data-guess='1']").click();
  await swapClips(page, [green, "a", "pin:D1.anode"], [black, "b", "pin:D1.cathode"]);
  await taskDone(page, "flip-led");
  await atMoment(page, "b4", "done");
  await primary(page).click();
  await atMoment(page, "b5", "act");
  await swapClips(page, [green, "a", "pin:D1.cathode"], [black, "b", "pin:D1.anode"]);
  await taskDone(page, "flip-back");

  // The secret: leave the resistor out. The LED flashes and dies, into the Hall of Fried Parts.
  await atMoment(page, "secret", "act");
  await clipTo(page, green, "b", "pin:R1.a");
  await taskDone(page, "no-resistor");
  await expect(page.locator(".bl-fried")).toContainText("Hall of Fried Parts");
  await primary(page).click();

  // The fix-it round: a fresh bench with the battery's clips swapped. Turn the LED round.
  await atMoment(page, "fix0", "act");
  await expect.poll(async () => (await bench(page)).leads.length).toBe(3);
  await expect.poll(() => glow(page)).toBeLessThan(0.01);
  await swapClips(page, ["TL2", "b", "pin:D1.anode"], ["TL3", "a", "pin:D1.cathode"]);
  await taskDone(page, "fix-reversed");

  // Sign the page: the finale counts 5 tasks and no first-try check (the first tap was the short leg).
  await atMoment(page, "end", "act");
  await primary(page).click();
  const reveal = page.getByRole("dialog");
  await expect(reveal).toBeVisible({ timeout: 20_000 });
  await reveal.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-finale]")).toBeVisible();
  await expect(page.locator(".bl-tally")).toContainText("5 lab tasks");
  await expect(page.locator(".bl-page")).toContainText("Red LED, no resistor on 9 V");

  // The Hall of Fried Parts keeps it.
  await page.goto("/achievements");
  await expect(page.getByText("Red LED, no resistor on 9 V").first()).toBeVisible();
});

test("welcome-to-the-bench: switch, break and mend the loop, name the switch, fix the bench", async ({ page }) => {
  await start(page, "/learn/basics/welcome-to-the-bench");
  await atMoment(page, "b0", "act");
  await flipBlockSwitch(page, "S1");
  await taskDone(page, "close-the-switch");
  await atMoment(page, "b0", "done");
  await primary(page).click();

  await atMoment(page, "b1", "guess");
  await page.locator("[data-guess='2']").click();
  await unclip(page, "TL2", "a");
  await taskDone(page, "break-the-loop");
  await expect(page.locator(".bl-guess")).toContainText("Called it.");
  await primary(page).click();
  await atMoment(page, "b2", "act");
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await taskDone(page, "mend-the-loop");

  // What is this? A pick about the part on the bench.
  await atMoment(page, "b3", "act");
  await page.locator("[data-pick]", { hasText: "A switch" }).click();
  await atMoment(page, "b3", "done");
  await primary(page).click();

  await atMoment(page, "secret", "act");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await atMoment(page, "fix0", "act");
  // The broken bench first: the switch is on, the lamp is dark.
  await expect.poll(() => glow(page)).toBeLessThan(0.01);
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await taskDone(page, "fix-switch");
  await atMoment(page, "end", "act");
});

test("the bench view switches between 3D and ink mid-lesson and keeps the bench", async ({ page }) => {
  await start(page, "/learn/basics/first-glow");
  await page.locator('[data-tap="D1"]').click();
  await atMoment(page, "b1", "act");
  const red = await leadFromTray(page, "Red", "pin:B1.pos");
  const other = (await page.evaluate(() => window.ohmlandLab!.view!())) === "ink" ? "3D" : "Ink";
  await page.getByRole("radio", { name: other }).click();
  await expect.poll(() => page.evaluate(() => window.ohmlandLab?.view?.())).toBe(other === "3D" ? "3d" : "ink");
  // Same bench, drawn the other way: the lead is still there, and the ink still lands on the parts.
  expect((await bench(page)).leads.map((l) => l.id)).toContain(red);
  await expect.poll(() => page.evaluate(() => window.ohmlandLab!.project("part:D1"))).not.toBeNull();
  // The choice is remembered for the next lesson.
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("ohmland:bench-view"))).toBe(other === "3D" ? "3d" : "ink");
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
