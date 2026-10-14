import { expect, test, type Page } from "@playwright/test";
import { atMoment, bench, benchReady, clipTo, drag, flipBlockSwitch, project, taskDone, unclip } from "./lab";

const primary = (page: Page) => page.locator("[data-primary]").first();
const glow = (page: Page) => page.evaluate(() => (window.ohmlandLab!.part("D1") as { glow?: number } | null)?.glow ?? 0);
const narrow = (page: Page) => (page.viewportSize()?.width ?? 1000) < 600;
const step = (page: Page, s: unknown) => page.evaluate((x) => window.ohmlandLab!.step!(x), s);

/** Opens a bench lesson and taps its start button. */
async function start(page: Page, path: string) {
  await page.goto(path);
  await primary(page).click();
  await benchReady(page);
}

/** The middle of two anchors on screen (where to drop an LED so its legs land in both holes). */
async function between(page: Page, a: string, b: string) {
  const p = await project(page, a);
  const q = await project(page, b);
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

/** Drags a tray item (by its text) onto a point on the bench. */
async function fromTray(page: Page, text: string, to: { x: number; y: number }) {
  const box = (await page.locator(".ohb-tray .ohb-item, .ohi-tray .ohi-item", { hasText: text }).first().boundingBox())!;
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, to);
}

test("first-glow: mend the torn drawing, build it on the board, see the drawing stay, fix the bench", async ({ page }) => {
  await start(page, "/learn/start-here/first-glow");

  // The torn piece into its gap, then tapped round until the triangle points away from plus.
  await atMoment(page, "b0", "act");
  if (narrow(page)) await step(page, { do: "move", part: "PC", at: "in:CARD" });
  else await drag(page, await project(page, "part:PC"), await project(page, "part:CARD/D1"));
  await expect.poll(() => page.evaluate(() => (window.ohmlandLab!.bench() as { parts: { id: string; params: { held?: unknown } }[] }).parts.find((p) => p.id === "CARD")?.params.held)).toBeTruthy();
  for (let i = 0; i < 4 && (await page.evaluate(() => window.ohmlandLab!.status()["mend-blueprint"])) !== "done"; i++) {
    const p = await project(page, "part:PC");
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(300);
  }
  await taskDone(page, "mend-blueprint");
  await atMoment(page, "b0", "done");
  await primary(page).click();

  // Build it from the tray: the 1 kΩ from strip 5 to strip 9, the LED from strip 9 to strip 10.
  await atMoment(page, "b1", "act");
  // The tray slides in as the beat begins and the bench reframes around it: let it settle before aiming.
  await page.waitForTimeout(800);
  if (narrow(page)) {
    await step(page, { do: "place", part: "R1", kind: "resistor", at: "c5", params: { ohms: 1000 } });
    await step(page, { do: "place", part: "D1", kind: "led", at: "d9", params: { color: "red", maxmA: 50 } });
  } else {
    await fromTray(page, "1 kΩ", await project(page, "hole:c7"));
    await fromTray(page, "LED", await between(page, "hole:d9", "hole:d10"));
  }
  await taskDone(page, "build-loop");
  expect(await glow(page)).toBeGreaterThan(0.3);
  await atMoment(page, "b1", "done");
  await expect(page.locator(".ann--note .ann__text", { hasText: "each line: a connection" })).toBeVisible();
  await primary(page).click();

  // Show me the part for the zigzag: the LED names itself, the resistor is right.
  await atMoment(page, "b2", "act");
  await page.locator('[data-tap="D1"]').click();
  await expect(page.locator(".bl-line")).toContainText("LED");
  await page.locator('[data-tap="R1"]').click();

  // Guess, then move the LED along its strips: still lit, and the drawing stays.
  await atMoment(page, "b3", "guess");
  await page.locator("[data-guess='1']").click();
  await step(page, { do: "move", part: "D1", at: "b9" });
  await taskDone(page, "move-it");
  await expect(page.locator(".bl-guess")).toContainText("Called it.");
  await expect(page.locator(".bl-stamped")).toContainText("A drawing shows connections, not places.");
  await primary(page).click();
  await atMoment(page, "b4", "act");
  await page.locator("[data-pick]", { hasText: "Connections" }).click();

  // Skip the secret. The fix-it: the LED turned round, dark. Turn it back.
  await atMoment(page, "secret", "act");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await atMoment(page, "fix0", "act");
  await expect.poll(() => glow(page)).toBeLessThan(0.01);
  // A learner looks before they fix: the round only counts a bench it has seen broken.
  await page.waitForTimeout(1000);
  await step(page, { do: "move", part: "D1", at: "b9", rot: 0 });
  await taskDone(page, "flip-led");

  // Sign the page: the island grows, the finale counts 4 lab tasks.
  await atMoment(page, "end", "act");
  await primary(page).click();
  const reveal = page.getByRole("dialog");
  await expect(reveal).toBeVisible({ timeout: 20_000 });
  await reveal.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-finale]")).toBeVisible();
  await expect(page.locator("[data-finale]")).toContainText("4 lab tasks");
});

test("welcome-to-the-bench: find the gap with the tracer, break and mend the loop, name it, fix the bench", async ({ page }) => {
  await start(page, "/learn/start-here/welcome-to-the-bench");
  await atMoment(page, "b0", "act");
  await flipBlockSwitch(page, "S1");
  await taskDone(page, "close-the-switch");
  // Switched on and still dark: the red clip bites the battery's plastic wrapper.
  expect(await glow(page)).toBeLessThan(0.01);

  // A wrong tap names what was tapped; the minus snap runs the tracer, which stops at the wrapper.
  await atMoment(page, "b1", "act");
  await page.locator('[data-tap="B1.pos"]').click();
  await page.locator('[data-tap="B1.neg"]').click();
  await atMoment(page, "b1", "done");
  await primary(page).click();
  await atMoment(page, "b2", "act");
  await clipTo(page, "TL1", "a", "pin:B1.pos");
  await taskDone(page, "find-the-gap");
  await expect.poll(() => glow(page)).toBeGreaterThan(0.3);
  await atMoment(page, "b2", "done");
  await primary(page).click();

  await atMoment(page, "b3", "guess");
  await page.locator("[data-guess='2']").click();
  await unclip(page, "TL2", "a");
  await taskDone(page, "break-the-loop");
  await expect(page.locator(".bl-guess")).toContainText("Called it.");
  await primary(page).click();
  await atMoment(page, "b4", "act");
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await taskDone(page, "mend-the-loop");

  // What is this, all the way round? A pick about the whole bench.
  await atMoment(page, "b5", "act");
  await page.locator("[data-pick]", { hasText: "a loop" }).click();

  await atMoment(page, "secret", "act");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await atMoment(page, "fix0", "act");
  // The broken bench first: the switch is on, the lamp is dark (the yellow clip bites the switch's wooden block).
  await expect.poll(() => glow(page)).toBeLessThan(0.01);
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await taskDone(page, "fix-it");
  await atMoment(page, "end", "act");
});

test("the bench view switches between 3D and ink mid-lesson and keeps the bench", async ({ page }) => {
  await start(page, "/learn/start-here/welcome-to-the-bench");
  await atMoment(page, "b0", "act");
  await flipBlockSwitch(page, "S1");
  await taskDone(page, "close-the-switch");
  const other = (await page.evaluate(() => window.ohmlandLab!.view!())) === "ink" ? "3D" : "Ink";
  await page.getByRole("radio", { name: other }).click();
  await expect.poll(() => page.evaluate(() => window.ohmlandLab?.view?.())).toBe(other === "3D" ? "3d" : "ink");
  // Same bench, drawn the other way: the switch is still on, the lamp still dark (the red clip is still on the battery's
  // wrapper), and the ink still lands on the parts.
  const parts = (await bench(page)).parts as unknown as { id: string; params: { to?: string } }[];
  expect(parts.find((p) => p.id === "S1")?.params.to).toBe("b");
  expect((await bench(page)).leads.find((l) => l.id === "TL1")?.a.to).toBe("pin:B1.wrap");
  await expect.poll(() => glow(page)).toBeLessThan(0.01);
  await expect.poll(() => page.evaluate(() => window.ohmlandLab!.project("part:D1"))).not.toBeNull();
  // The choice is remembered for the next lesson.
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("ohmland:bench-view"))).toBe(other === "3D" ? "3d" : "ink");
});

test("the free-build bench builds, saves and clears", async ({ page }) => {
  await page.goto("/bench");
  await benchReady(page);
  // The starter kit is already out on a new learner's desk: a battery and three clip leads, no tray. Nothing to clear
  // or save yet.
  const start = await bench(page);
  expect(start.parts.map((p) => p.id)).toEqual(["B1"]);
  expect(start.leads).toHaveLength(3);
  await expect(page.locator(".ohb-tray")).toHaveCount(0);
  await expect(page.locator("[data-clear], [data-save]")).toHaveCount(0);

  const batteryAt = async () => (await bench(page)).parts.find((p) => p.id === "B1")?.pos.join(",");
  const home = await batteryAt();
  await drag(page, await project(page, "part:B1"), await project(page, [-20, 0, 40]));
  await expect.poll(batteryAt).not.toBe(home);
  const moved = await batteryAt();

  await page.getByPlaceholder("My circuit").fill("Moved battery");
  await page.locator("[data-save]").click();
  await expect(page.locator(".sandbox__build")).toContainText("Moved battery");

  await page.locator("[data-clear]").click();
  await expect.poll(batteryAt).toBe(home);
  await expect(page.locator("[data-clear]")).toHaveCount(0);
  await page.locator(".sandbox__build").getByRole("button", { name: "Open" }).click();
  await expect.poll(batteryAt).toBe(moved);
});
