// Visual review: screenshots of every page and every lesson step, light and dark, desktop and phone.
//
//   pnpm build && pnpm shots                      all pages and steps into ./screenshots-review
//   pnpm shots -- --out=screenshots --curated     the curated set committed under apps/web/screenshots
//   pnpm shots -- --only=landing,learn --full     a subset, full-page
//
// Starts `astro preview` itself unless BASE_URL is set. Chromium runs with SwiftShader so the 3D island draws; the
// island's clock is pinned (day in light shots, night in dark ones) and seeded learners use a fixed date, so the
// islands look the same in every run. Subsets for --only also include landing-live, lesson, lesson2, reveal-module.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { WEBGL_ARGS, seedLearner } from "./seed.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const OUT = args.out ?? "screenshots-review";
const PORT = Number(args.port ?? 4391);
const ONLY = args.only ? new Set(args.only.split(",")) : null;
const FULL = args.full === "true";
const CURATED = args.curated === "true";
const THEMES = (args.themes ?? "light,dark").split(",");
const SIZES = (args.sizes ?? "desktop,phone").split(",");
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

// [name, path, learner record]: "one" (a lesson done, one in progress), "module" (a module done) or none (new visitor)
const PAGES = [
  ["landing", "/"],
  ["learn", "/learn", "one"],
  ["learn-new", "/learn"],
  ["isle", "/isle", "module"],
  ["isle-empty", "/isle"],
  ["bench", "/bench", "one"],
  ["parts", "/parts", "one"],
  ["achievements", "/achievements", "one"],
  ["account", "/account", "one"],
  ["about", "/about"],
  ["404", "/no-such-page"],
];

/** The set committed under apps/web/screenshots (names without the step numbers). */
const CURATED_SET = new Set([
  "landing-desktop-light",
  "landing-desktop-dark",
  "landing-live-phone-light",
  "learn-desktop-light",
  "learn-phone-dark",
  "lesson-hook-desktop-light",
  "lesson-hook-phone-dark",
  "lesson-lab-desktop-light",
  "lesson-explain-widget-desktop-dark",
  "lesson-quiz-right-desktop-light",
  "lesson-quiz-numeric-prefix-desktop-light",
  "lesson-quiz-order-phone-light",
  "lesson-wrap-desktop-light",
  "lesson-finale-desktop-light",
  "lesson-finale-desktop-dark",
  "lesson-finale-phone-light",
  "lesson2-colour-built-desktop-light",
  "lesson2-match-one-phone-dark",
  "lesson2-hotspot-right-desktop-light",
  "parts-desktop-light",
  "parts-drawer-phone-dark",
  "achievements-desktop-light",
  "achievements-phone-dark",
  "isle-desktop-light",
  "isle-phone-dark",
  "isle-label-desktop-dark",
  "isle-empty-desktop-light",
  "isle-empty-phone-dark",
  "lesson-reveal-desktop-light",
  "lesson-reveal-phone-dark",
  "reveal-module-desktop-dark",
  "reveal-module-phone-light",
  "bench-desktop-light",
  "account-desktop-light",
  "about-desktop-dark",
  "404-desktop-light",
]);
const cleanName = (name) => name.replace(/^(lesson2?)-\d\d-/, "$1-");

async function startServer() {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL, stop: () => {} };
  const child = spawn("npx", ["astro", "preview", "--port", String(PORT), "--ignore-lock"], { stdio: "pipe", detached: true });
  const url = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) break;
    } catch {
      await new Promise((res) => setTimeout(res, 250));
    }
  }
  return { url, stop: () => process.kill(-child.pid) };
}

async function newPage(browser, size, theme, reducedMotion = "reduce") {
  const context = await browser.newContext({
    viewport: VIEWPORTS[size],
    deviceScaleFactor: size === "phone" ? 2 : 1,
    colorScheme: theme,
    reducedMotion,
  });
  return { context, page: await context.newPage() };
}

const shot = async (page, name) => {
  if (CURATED) {
    if (!CURATED_SET.has(cleanName(name))) return;
    name = cleanName(name);
  }
  const file = join(OUT, `${name}.png`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage: FULL, animations: "disabled" });
  console.log(file);
};

/** The island follows the clock; screenshots pin it to day in the light theme and night in the dark one. */
const clock = (theme) => (theme === "dark" ? "22:00" : "12:00");
const withClock = (path, theme) => `${path}${path.includes("?") ? "&" : "?"}time=${clock(theme)}`;

/** Waits until a 3D island on the page has drawn (or given up), so screenshots never catch it loading. */
async function islandSettled(page) {
  await page
    .waitForFunction(() => {
      const isle = document.querySelector(".isle-screen");
      if (isle) return isle.getAttribute("data-status") !== "loading";
      const card = document.querySelector(".isle-card__frame");
      return !card || card.hasAttribute("data-live");
    }, null, { timeout: 20000 })
    .catch(() => undefined);
  await page.waitForTimeout(600);
}

async function pages(browser, url) {
  for (const [name, path, record] of PAGES) {
    if (ONLY && !ONLY.has(name)) continue;
    for (const size of SIZES)
      for (const theme of THEMES) {
        const { context, page } = await newPage(browser, size, theme);
        if (record) await seedLearner(page, url, record);
        await page.goto(url + withClock(path, theme), { waitUntil: "networkidle" });
        await islandSettled(page);
        await shot(page, `${name}-${size}-${theme}`);
        if (name === "isle") {
          // tap the module's landmark (where the seeded island puts it) for its label
          const [x, y] = size === "phone" ? [160, 290] : [650, 190];
          await page.mouse.click(x, y);
          await page.waitForTimeout(500);
          await shot(page, `isle-label-${size}-${theme}`);
        }
        if (name === "parts") {
          const first = page.locator(".part-tile:not(.part-tile--locked)").first();
          if (await first.count()) {
            await first.click();
            await page.waitForTimeout(400);
            await shot(page, `parts-drawer-${size}-${theme}`);
          }
        }
        await context.close();
      }
  }
}

/** The landing hero once its live island has faded in over the poster (motion allowed, unlike the other shots). */
async function landingLive(browser, url) {
  if (ONLY && !ONLY.has("landing-live")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      const { context, page } = await newPage(browser, size, theme, "no-preference");
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForSelector(".isle-frame--hero[data-live]", { timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      await shot(page, `landing-live-${size}-${theme}`);
      await context.close();
    }
}

/** Plays the first sample lesson, capturing each step (and quiz feedback). */
async function lesson(browser, url) {
  if (ONLY && !ONLY.has("lesson")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      const { context, page } = await newPage(browser, size, theme);
      let n = 0;
      const step = async (label) => {
        n++;
        await shot(page, `lesson-${String(n).padStart(2, "0")}-${label}-${size}-${theme}`);
      };
      await page.goto(`${url}${withClock("/learn/basics/sample-first-glow", theme)}`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-step-type]");
      await step("hook");
      await page.locator("[data-predict-option]").nth(2).click();
      await step("hook-predicted");
      await page.locator("[data-primary]").click();
      await page.waitForSelector("[data-step-type=lab]");
      await page.waitForSelector("[data-lab-ready]");
      await step("lab");
      await page.locator("[data-primary]").click();
      await page.waitForSelector("[data-step-type=explain]");
      await step("explain");
      for (let i = 0; i < 3; i++) {
        await page.locator("[data-primary]").click();
        await page.waitForTimeout(150);
        if (i === 0) await step("explain-widget");
      }
      await page.waitForSelector("[data-step-type=quiz]");
      // Choice: pick the right one.
      await page.locator("[data-option]").filter({ hasText: "limit the current" }).click();
      await step("quiz-choice");
      await page.locator("[data-primary]").click();
      await step("quiz-right");
      await page.locator("[data-primary]").click();
      // Multi choice: one wrong first.
      await page.locator("[data-option]").filter({ hasText: "longer wires" }).click();
      await page.locator("[data-primary]").click();
      await step("quiz-wrong");
      await page.locator("[data-primary]").click();
      await page.locator("[data-option]").filter({ hasText: "longer wires" }).click();
      await page.locator("[data-option]").filter({ hasText: "bigger resistor" }).click();
      await page.locator("[data-option]").filter({ hasText: "lower voltage" }).click();
      await page.locator("[data-primary]").click();
      await page.locator("[data-primary]").click();
      // Numeric: a prefix slip, then right.
      await page.locator("[data-numeric-input]").fill("0.0149");
      await page.locator("[data-primary]").click();
      await step("quiz-numeric-prefix");
      await page.locator("[data-primary]").click();
      await page.locator("[data-numeric-input]").fill("15 mA");
      await page.locator("[data-primary]").click();
      await page.locator("[data-primary]").click();
      // Order: shown shuffled; screenshot and solve via the keyboard buttons.
      await step("quiz-order");
      await solveOrder(page);
      await page.locator("[data-primary]").click();
      await page.locator("[data-primary]").click();
      await page.waitForSelector("[data-step-type=wrap]");
      await step("wrap");
      await page.locator("[data-primary]").click();
      await revealShown(page);
      await step("reveal");
      await page.locator("[data-reveal-continue]").click();
      await page.waitForSelector("[data-finale]");
      await page.waitForTimeout(1600);
      await step("finale");
      await context.close();
    }
}

/** Waits for the island reveal to land: its caption is in and Continue is showing. */
async function revealShown(page) {
  await page.waitForSelector("[data-reveal]");
  await page.waitForSelector("[data-reveal-continue]", { state: "visible", timeout: 20000 });
  await page.waitForFunction(() => document.querySelector("[data-reveal]")?.getAttribute("data-status") !== "loading", null, { timeout: 20000 });
  await page.waitForTimeout(800);
}

/** Finishes the second sample lesson (resumed at its wrap step), which finishes the module: the landmark reveal. */
async function moduleReveal(browser, url) {
  if (ONLY && !ONLY.has("reveal-module")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      const { context, page } = await newPage(browser, size, theme);
      await seedLearner(page, url, "wrap2");
      await page.goto(`${url}${withClock("/learn/basics/sample-read-a-resistor", theme)}`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-step-type=wrap]");
      await page.locator("[data-primary]").click();
      await revealShown(page);
      await shot(page, `reveal-module-${size}-${theme}`);
      await context.close();
    }
}

/** Uses the order item's data-correct-index hints (test-only attribute) to sort via the move buttons. */
export async function solveOrder(page) {
  for (let guard = 0; guard < 40; guard++) {
    const idx = await page.locator("[data-order-item]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-key"))));
    const wrong = idx.findIndex((v, i) => v !== i);
    if (wrong === -1) return;
    const from = idx.indexOf(wrong);
    await page.locator("[data-order-item]").nth(from).locator("[data-move=up]").click();
  }
}

async function lesson2(browser, url) {
  if (ONLY && !ONLY.has("lesson2")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      const { context, page } = await newPage(browser, size, theme);
      await page.goto(`${url}/learn/basics/sample-read-a-resistor`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-step-type]");
      await shot(page, `lesson2-01-hook-${size}-${theme}`);
      await page.locator("[data-primary]").click();
      await shot(page, `lesson2-02-explain-${size}-${theme}`);
      for (let i = 0; i < 3; i++) await page.locator("[data-primary]").click();
      await page.waitForSelector("[data-step-type=quiz]");
      await shot(page, `lesson2-03-colour-read-${size}-${theme}`);
      await page.locator("[data-numeric-input]").fill("4k7");
      await page.locator("[data-primary]").click();
      await page.locator("[data-primary]").click();
      await shot(page, `lesson2-04-colour-build-${size}-${theme}`);
      for (const [band, colour] of [[0, "red"], [1, "red"], [2, "brown"]]) {
        await page.locator(`[data-band="${band}"]`).click();
        await page.locator(`[data-swatch="${colour}"]`).click();
      }
      await shot(page, `lesson2-05-colour-built-${size}-${theme}`);
      await page.locator("[data-primary]").click();
      await page.locator("[data-primary]").click();
      await shot(page, `lesson2-06-match-${size}-${theme}`);
      await page.locator("[data-match-left]").nth(0).click();
      await page.locator("[data-match-right]").filter({ hasText: /^1$/ }).click();
      await shot(page, `lesson2-07-match-one-${size}-${theme}`);
      for (const [l, r] of [[1, "2"], [2, "4"], [3, "7"]]) {
        await page.locator("[data-match-left]").nth(l).click();
        await page.locator("[data-match-right]").filter({ hasText: new RegExp(`^${r}$`) }).click();
      }
      await page.locator("[data-primary]").click();
      await page.locator("[data-primary]").click();
      await shot(page, `lesson2-08-hotspot-${size}-${theme}`);
      await page.locator('[data-region="com"]').click();
      await page.locator("[data-primary]").click();
      await shot(page, `lesson2-09-hotspot-right-${size}-${theme}`);
      await page.locator("[data-primary]").click();
      await shot(page, `lesson2-10-hotspot-led-${size}-${theme}`);
      await context.close();
    }
}

const server = await startServer();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: WEBGL_ARGS });
try {
  await pages(browser, server.url);
  await landingLive(browser, server.url);
  await lesson(browser, server.url);
  await moduleReveal(browser, server.url);
  await lesson2(browser, server.url);
} finally {
  await browser.close();
  server.stop();
}
