import { expect, test } from "@playwright/test";
import { FIRST_LESSON_URL, playFirstLesson } from "./first-lesson";

test("a guest finishes the first lesson and sees XP on the signed-off page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start learning" }).first().click();
  await expect(page).toHaveURL(new RegExp(FIRST_LESSON_URL));

  await playFirstLesson(page);

  // 30 for the lesson + 3 checks first try x 10 + 2 bench tasks x 15, plus "First spark" (20) and "Clean sweep" (25)
  // = 135 XP.
  const finale = page.locator("[data-finale]");
  await expect(finale.getByRole("heading", { name: "How a breadboard works, done" })).toBeVisible();
  await expect(page.locator(".finale__xp")).toHaveText("+135 XP");

  // The XP survives a reload: the header chip on the course map shows level 2.
  await page.goto("/learn");
  await expect(page.locator(".level-chip__badge")).toHaveText("2");
});

test("a lesson's first load carries no three.js", async ({ page }) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (res) => {
    if (res.request().resourceType() === "script") scripts.push(res.text().catch(() => ""));
  });
  await page.goto("/learn/basics/first-glow", { waitUntil: "networkidle" });
  // The start screen is up and ready to tap; the bench loads after the learner's first gesture.
  await expect(page.locator('.bl[data-phase="start"] [data-primary]')).toBeVisible();
  const bodies = await Promise.all(scripts);
  expect(bodies.length).toBeGreaterThan(0);
  // three.js names its renderer in its source, and so does the island
  expect(bodies.filter((js) => js.includes("WebGLRenderer"))).toHaveLength(0);
});

test("a guest's pages never load Firebase", async ({ page }) => {
  const bodies: Promise<string>[] = [];
  const firebaseRequests: string[] = [];
  page.on("request", (r) => {
    if (/googleapis\.com|firebaseapp\.com|firebase/i.test(r.url())) firebaseRequests.push(r.url());
  });
  page.on("response", (r) => {
    if (r.url().endsWith(".js")) bodies.push(r.text().catch(() => ""));
  });
  for (const path of [FIRST_LESSON_URL, "/learn", "/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(firebaseRequests).toEqual([]);
  // The Auth and Firestore SDKs name their endpoints; no script a guest loads may contain them.
  const scripts = await Promise.all(bodies);
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.filter((s) => s.includes("identitytoolkit.googleapis.com") || s.includes("firestore.googleapis.com"))).toEqual([]);
});
