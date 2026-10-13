import { expect, test, type Page } from "@playwright/test";
import { FIRST_LESSON, FIRST_LESSON_URL, playFirstLesson } from "../first-lesson";
import { firebaseUrl, person, signInWithGoogle, signOut, storedLearner, storedLessons, syncStatus, uidOf, warmUpSignIn } from "./emulators";

/**
 * Accounts against the Auth and Firestore emulators (`pnpm e2e:accounts`). The Auth emulator's sign-in widget stands
 * in for Google's, in the same popup the real sign-in uses.
 */

const levelBadge = (page: Page) => page.locator(".level-chip__badge");
const settings = (page: Page) => page.locator(".account__settings");

test.beforeAll(async ({ browser }) => {
  await warmUpSignIn(browser);
});

test("a guest signs in: the finished lesson syncs, changes follow, offline changes wait, a second device gets it all", async ({ page, browser, request }) => {
  const ada = person("Ada Lovelace");
  const firebaseRequests: string[] = [];
  page.on("request", (r) => {
    if (firebaseUrl(r.url())) firebaseRequests.push(r.url());
  });

  // A guest finishes the first lesson. Nothing goes to Firebase.
  await page.goto(FIRST_LESSON_URL);
  await playFirstLesson(page);
  await page.goto("/learn");
  await page.waitForLoadState("networkidle");
  expect(firebaseRequests).toEqual([]);

  // Signing in to a new account: the guest's progress joins it without a question.
  await page.goto("/account");
  await signInWithGoogle(page, ada);
  await expect(syncStatus(page)).toHaveText("Saved");
  const uid = await uidOf(page);
  expect(await storedLessons(request, uid)).toEqual([FIRST_LESSON]);

  // The header shows it on every page.
  await page.goto("/learn");
  await expect(page.getByRole("link", { name: "Account, signed in. Saved." })).toBeVisible();

  // A change reaches the account a moment later.
  await page.goto("/account");
  await expect(syncStatus(page)).toHaveText("Saved");
  await settings(page).getByRole("button", { name: "Night lab" }).click();
  await expect.poll(async () => ((await storedLearner(request, uid))?.settings as { theme?: string } | undefined)?.theme).toBe("dark");

  // Offline, a change waits on the device and goes as soon as the browser is back.
  await page.context().setOffline(true);
  await expect(syncStatus(page)).toHaveText("Offline");
  await settings(page).getByRole("button", { name: "Light" }).click();
  await page.waitForTimeout(3000);
  await page.context().setOffline(false);
  expect(((await storedLearner(request, uid))?.settings as { theme: string }).theme).toBe("dark");
  await expect(syncStatus(page)).toHaveText("Saved");
  await expect.poll(async () => ((await storedLearner(request, uid))?.settings as { theme?: string } | undefined)?.theme).toBe("light");

  // A second device signs in as Ada: it held nothing, so no question, and it gets the lesson.
  const other = await browser.newContext();
  const second = await other.newPage();
  await signInWithGoogle(second, ada);
  await second.goto("/learn");
  await expect(levelBadge(second)).toHaveText("2");
  // Signing out keeps the device's progress.
  await second.goto("/account");
  await signOut(second);
  await second.goto("/learn");
  await expect(levelBadge(second)).toHaveText("2");
  await expect(second.getByRole("link", { name: "Account", exact: true })).toBeVisible();
  await other.close();

  // Deleting the account removes the cloud copy and the sign-in; this device keeps its progress.
  await page.goto("/account");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("dialog", { name: "Delete your account?" }).getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  expect(await storedLearner(request, uid)).toBeNull();
  await page.goto("/learn");
  await expect(levelBadge(page)).toHaveText("2");
});

test("another account on the same device is asked before anything merges", async ({ page, request }) => {
  const [ana, boris, vera] = [person("Ana Petrova"), person("Boris Ivanov"), person("Vera Georgieva")];
  await page.goto(FIRST_LESSON_URL);
  await playFirstLesson(page);
  await signInWithGoogle(page, ana);
  await signOut(page);

  // Boris on the device that holds Ana's progress: asked, and "Add it to my account" merges it into his.
  await signInWithGoogle(page, boris, { expectQuestion: true });
  await page.getByRole("button", { name: "Add it to my account" }).click();
  await expect(page.getByRole("heading", { level: 2, name: boris.name })).toBeVisible();
  expect(await storedLessons(request, await uidOf(page))).toEqual([FIRST_LESSON]);
  await signOut(page);

  // Vera: asked, and "Use my account's progress" keeps her account empty; the device starts from it.
  await signInWithGoogle(page, vera, { expectQuestion: true });
  await page.getByRole("button", { name: "Use my account's progress" }).click();
  await expect(page.getByRole("heading", { level: 2, name: vera.name })).toBeVisible();
  await expect(syncStatus(page)).toHaveText("Saved");
  expect(await storedLessons(request, await uidOf(page))).toEqual([]);
  await page.goto("/learn");
  await expect(levelBadge(page)).toHaveText("1");
});

test("deleting all progress while signed in clears the account's copy too, and a reload does not bring it back", async ({ page, request }) => {
  await page.goto(FIRST_LESSON_URL);
  await playFirstLesson(page);
  await signInWithGoogle(page, person("Emil Stoyanov"));
  const uid = await uidOf(page);
  expect(await storedLessons(request, uid)).toEqual([FIRST_LESSON]);
  await page.getByRole("button", { name: "Delete all progress" }).click();
  await page.getByRole("dialog", { name: "Delete all progress?" }).getByRole("button", { name: "Delete everything" }).click();
  await expect.poll(() => storedLessons(request, uid)).toEqual([]);
  await page.goto("/learn");
  await expect(page.getByRole("link", { name: "Account, signed in. Saved." })).toBeVisible();
  await expect(levelBadge(page)).toHaveText("1");
  expect(await storedLessons(request, uid)).toEqual([]);
});

test("a change made just before the tab closes still reaches the account", async ({ browser, request }) => {
  const dora = person("Dora Kirova");
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInWithGoogle(page, dora);
  await expect(syncStatus(page)).toHaveText("Saved");
  const uid = await uidOf(page);
  // Well inside the two-second pause: only the keepalive request sent while the page goes away can carry it.
  await settings(page).getByRole("button", { name: "Night lab" }).click();
  await page.close({ runBeforeUnload: true });
  await expect.poll(async () => ((await storedLearner(request, uid))?.settings as { theme?: string } | undefined)?.theme).toBe("dark");
  await context.close();
});

/** Some progress on the device, as a returning learner has (the same record apps/web/scripts/screenshots.mjs seeds). */
async function seed(page: Page) {
  await page.goto("/about");
  await page.evaluate(async () => {
    const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    const state = {
      v: 1,
      lessons: { "sample-first-glow": { at: iso(2), version: 1, firstTry: 3, items: 4, tasks: ["light-it", "measure-resistor"] } },
      inProgress: {},
      achievements: { "first-spark": { at: iso(2) }, "magic-smoke": { at: iso(1) } },
      fried: [{ kind: "led", label: "Red LED", lessonId: "sample-first-glow", at: iso(2) }],
      sandbox: { saved: {} },
      settings: { muted: false, reducedMotion: "system", theme: "system" },
      updatedAt: iso(0),
    };
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("ohmland");
      req.onupgradeneeded = () => req.result.createObjectStore("learner");
      req.onsuccess = () => {
        const tx = req.result.transaction("learner", "readwrite");
        tx.objectStore("learner").put(state, "profile:default");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

test("screenshots of the account page, signed out, asked and signed in", async ({ browser }) => {
  const dir = process.env.OHMLAND_SHOTS;
  test.skip(!dir, "Set OHMLAND_SHOTS=<folder> to take them.");
  const ada = person("Ada Lovelace", "ada@example.com");
  const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;
  let first = true;
  for (const size of ["desktop", "phone"] as const)
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: size === "phone" ? 2 : 1, colorScheme: theme, reducedMotion: "reduce" });
      const page = await context.newPage();
      await seed(page);
      await page.goto("/account");
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
      await page.screenshot({ path: `${dir}/account-signed-out-${size}-${theme}.png`, fullPage: size === "desktop" });
      // The first sign-in makes Ada's account from this device's progress; the others find it there and are asked.
      await signInWithGoogle(page, ada, { expectQuestion: !first });
      if (!first) {
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${dir}/account-ask-${size}-${theme}.png` });
        await page.getByRole("button", { name: "Add it to my account" }).click();
      }
      first = false;
      await expect(syncStatus(page)).toHaveText("Saved");
      await page.screenshot({ path: `${dir}/account-signed-in-${size}-${theme}.png`, fullPage: size === "desktop" });
      await page.goto("/learn");
      await page.locator(".site-header").screenshot({ path: `${dir}/header-signed-in-${size}-${theme}.png` });
      await context.close();
    }
});
