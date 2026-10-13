import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

/**
 * The Firebase emulators as the account specs use them: the Auth emulator's sign-in widget stands in for Google, and
 * documents are read past the rules with the Firestore emulator's owner token.
 */
const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"}`;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const DOCUMENTS = `${FIRESTORE}/v1/projects/ohmland/databases/(default)/documents`;
const OWNER = { Authorization: "Bearer owner" };

/** True for any request to the emulators or to Google's Firebase hosts. */
export const firebaseUrl = (url: string) => url.includes(AUTH_HOST) || url.includes(FIRESTORE.slice(7)) || /googleapis\.com|firebaseapp\.com/.test(url);

export type Person = { email: string; name: string };
/** A made-up learner with an email no other test uses (or `email`, for screenshots). */
export const person = (name: string, email?: string): Person => ({ name, email: email ?? `${name.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@example.com` });

/**
 * "Continue with Google" on /account, then the Auth emulator's widget in the popup: a new account with this email and
 * name, or the existing one. Waits until the page shows the signed-in card, or the "progress from before" question.
 */
export async function signInWithGoogle(page: Page, who: Person, { expectQuestion = false } = {}) {
  if (!new URL(page.url()).pathname.startsWith("/account")) await page.goto("/account");
  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(button).toBeEnabled();
  const [popup] = await Promise.all([page.waitForEvent("popup"), button.click()]);
  await popup.waitForLoadState("domcontentloaded");
  // The widget hands the result to the page's auth iframe, which the click only just started loading (it fetches Google's
  // iframe library from apis.google.com, sometimes slowly). A person takes a few seconds to choose an account; the test
  // waits until the iframe is ready instead.
  await expect
    .poll(
      async () => {
        const relay = page.frames().find((f) => f.url().includes("/emulator/auth/iframe"));
        return relay ? relay.evaluate(() => (window as unknown as { parentContainer: unknown }).parentContainer != null).catch(() => false) : false;
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  const existing = popup.locator(".js-reuse-account", { hasText: who.email });
  if (await existing.count()) await existing.click();
  else {
    await popup.locator("#add-account-button").click();
    await popup.locator("#email-input").fill(who.email);
    await popup.locator("#display-name-input").fill(who.name);
    await popup.locator("#sign-in").click();
  }
  if (expectQuestion) await expect(page.getByRole("dialog", { name: "Progress from before" })).toBeVisible();
  else await expect(page.getByRole("heading", { level: 2, name: who.name })).toBeVisible();
}

/**
 * In a freshly launched test browser, the auth iframe that the first sign-in popup opens never finishes loading Google's
 * iframe library (seen with Playwright's Chromium and the emulator, where the popup and the iframe share a site). Every
 * later popup in that browser is fine, so the specs make one throwaway attempt first. Real sign-ins are not affected.
 */
export async function warmUpSignIn(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/account");
  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(button).toBeEnabled();
  const [popup] = await Promise.all([page.waitForEvent("popup"), button.click()]);
  await page.waitForTimeout(2000);
  await popup.close();
  await context.close();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
}

/** The sync status the account page shows: Saved, Saving, Offline, Not saved yet. */
export const syncStatus = (page: Page) => page.locator("[data-sync-status]");

/** The signed-in user's id, from the session Firebase keeps in localStorage. */
export const uidOf = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("firebase:authUser:"));
    return key ? ((JSON.parse(localStorage.getItem(key) ?? "{}") as { uid?: string }).uid ?? "") : "";
  });

type Value = Record<string, unknown>;
const plain = (v: Value): unknown => {
  if ("mapValue" in v) return Object.fromEntries(Object.entries((v.mapValue as { fields?: Record<string, Value> }).fields ?? {}).map(([k, x]) => [k, plain(x)]));
  if ("arrayValue" in v) return ((v.arrayValue as { values?: Value[] }).values ?? []).map(plain);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("nullValue" in v) return null;
  return Object.values(v)[0];
};

/** learners/{uid} as stored, read past the rules, or null when there is none. */
export async function storedLearner(request: APIRequestContext, uid: string): Promise<Record<string, unknown> | null> {
  const res = await request.get(`${DOCUMENTS}/learners/${uid}`, { headers: OWNER });
  if (res.status() === 404) return null;
  expect(res.status()).toBe(200);
  const d = (await res.json()) as { fields?: Record<string, Value> };
  return plain({ mapValue: { fields: d.fields ?? {} } }) as Record<string, unknown>;
}

/** The lesson ids stored in the account. */
export const storedLessons = async (request: APIRequestContext, uid: string) =>
  Object.keys(((await storedLearner(request, uid))?.lessons as Record<string, string> | undefined) ?? {}).sort();
