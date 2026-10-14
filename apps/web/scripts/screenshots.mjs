// Visual review: screenshots of every page and every lesson step, light and dark, desktop and phone.
//
//   pnpm build && pnpm shots                      all pages and steps into ./screenshots-review
//   pnpm shots -- --out=screenshots --curated     the curated set committed under apps/web/screenshots
//   pnpm shots -- --only=landing,learn --full     a subset, full-page
//
// Starts `astro preview` itself unless BASE_URL is set. Chromium runs with SwiftShader so the 3D island draws; the
// island's clock is pinned (day in light shots, night in dark ones) and seeded learners use a fixed date, so the
// islands look the same in every run. Besides the page names, --only takes landing-live, lesson, lesson2, reveal-module.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { MODULE_ONE, WEBGL_ARGS, seedLearner } from "./seed.mjs";

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

// [name, path, learner record]: "one" (a lesson done, one in progress), "module" (the first module done) or none
// (a new visitor). See seed.mjs.
const PAGES = [
  ["landing", "/"],
  ["learn", "/learn", "one"],
  ["learn-module", "/learn", "module"],
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

/**
 * The set committed under apps/web/screenshots (names without the step numbers). Lab shots (lab-*, lesson-lab-*,
 * bench-*) come from scripts/lab-shots.mjs, signed-in account shots from the accounts end-to-end run.
 */
const CURATED_SET = new Set([
  "landing-desktop-light",
  "landing-desktop-dark",
  "landing-paint-desktop-dark",
  "landing-live-desktop-dark",
  "landing-live-phone-light",
  "learn-desktop-light",
  "learn-phone-dark",
  "learn-module-phone-light",
  "lesson-hook-desktop-light",
  "lesson-hook-phone-dark",
  "lesson-quiz-right-desktop-light",
  "lesson-quiz-match-one-phone-dark",
  "lesson-wrap-desktop-light",
  "lesson-reveal-desktop-light",
  "lesson-reveal-phone-dark",
  "lesson-finale-desktop-light",
  "lesson-finale-desktop-dark",
  "lesson-finale-phone-light",
  "lesson2-explain-widget-desktop-dark",
  "lesson2-numeric-prefix-desktop-light",
  "lesson2-colour-built-desktop-light",
  "lesson2-hotspot-right-desktop-light",
  "lesson2-order-phone-light",
  "reveal-module-desktop-dark",
  "reveal-module-phone-light",
  "isle-desktop-light",
  "isle-phone-dark",
  "isle-label-desktop-dark",
  "isle-empty-desktop-light",
  "isle-empty-phone-dark",
  "parts-desktop-light",
  "parts-drawer-phone-dark",
  "achievements-desktop-light",
  "achievements-phone-dark",
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

const wanted = (name) => !CURATED || CURATED_SET.has(cleanName(name));

const shot = async (page, name) => {
  if (!wanted(name)) return;
  if (CURATED) name = cleanName(name);
  const file = join(OUT, `${name}.png`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage: FULL, animations: "disabled" });
  if (CURATED) quantise(file);
  console.log(file);
};

/** Keeps a committed screenshot small (well under 400 KB): 256 colours. ImageMagick is optional. */
function quantise(path) {
  try {
    execFileSync("magick", [path, "-strip", "-dither", "FloydSteinberg", "-colors", "256", "-define", "png:compression-level=9", `PNG8:${path}`]);
  } catch {
    // left as it is
  }
}

/** The island follows the clock; screenshots pin it to day in the light theme and night in the dark one. */
const clock = (theme) => (theme === "dark" ? "22:00" : "12:00");
const withClock = (path, theme) => `${path}${path.includes("?") ? "&" : "?"}time=${clock(theme)}`;

/** Waits until every 3D island on the page has drawn (or given up), so screenshots never catch one loading. */
async function islandSettled(page) {
  await page
    .waitForFunction(
      () => {
        const screen = document.querySelector(".isle-screen");
        if (screen && screen.getAttribute("data-status") === "loading") return false;
        const card = document.querySelector(".isle-card__frame");
        return !card || card.hasAttribute("data-live");
      },
      null,
      { timeout: 20000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(600);
}

/** Waits for the island reveal to land: its caption is in and Continue is showing. */
async function revealShown(page) {
  await page.waitForSelector("[data-reveal]");
  await page.waitForSelector("[data-reveal-continue]", { state: "visible", timeout: 20000 });
  await page.waitForFunction(() => document.querySelector("[data-reveal]")?.getAttribute("data-status") !== "loading", null, { timeout: 20000 });
  await page.waitForTimeout(800);
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
        // the built module's landmark line, mid-screen
        if (name === "learn-module") await page.locator(".landmark-card").first().evaluate((el) => el.scrollIntoView({ block: "center" }));
        await shot(page, `${name}-${size}-${theme}`);
        if (name === "isle" && wanted(`isle-label-${size}-${theme}`)) {
          // tap the module's landmark (where the seeded island puts it) for its label
          const [x, y] = size === "phone" ? [212, 300] : [760, 150];
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

/**
 * The landing hero at first paint (HTML and CSS only: what shows before any script runs) and once its live island
 * has faded in over the poster (motion allowed, unlike the other shots).
 */
async function landingLive(browser, url) {
  if (ONLY && !ONLY.has("landing-live")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      if (wanted(`landing-paint-${size}-${theme}`)) {
        const { context, page } = await newPage(browser, size, theme, "no-preference");
        await page.route(/\.js$/, (r) => r.abort());
        await page.goto(url, { waitUntil: "load" });
        await shot(page, `landing-paint-${size}-${theme}`);
        await context.close();
      }
      if (wanted(`landing-live-${size}-${theme}`)) {
        const { context, page } = await newPage(browser, size, theme, "no-preference");
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForSelector(".isle-frame--hero [data-live], .isle-frame--hero[data-live]", { timeout: 20000 }).catch(() => undefined);
        await page.waitForTimeout(1500);
        await shot(page, `landing-live-${size}-${theme}`);
        await context.close();
      }
    }
}

/**
 * The first lessons are bench lessons now: scripts/lesson-shots.mjs plays every moment of the three reference lessons
 * (start, beats, checks, the secret, the fix-it, the notebook, the reveal and the signed-off page). The stepper's own
 * steps are still covered by lesson2 below and the module reveal.
 */
async function lesson() {
  if (ONLY && !ONLY.has("lesson")) return;
  console.log("lesson: bench lessons are shot by scripts/lesson-shots.mjs");
}

/** Finishes the first module's last lesson (resumed at its wrap step), which builds the module's landmark. */
async function moduleReveal(browser, url) {
  if (ONLY && !ONLY.has("reveal-module")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      if (!wanted(`reveal-module-${size}-${theme}`)) continue;
      const { context, page } = await newPage(browser, size, theme);
      await seedLearner(page, url, "wrap");
      await page.goto(`${url}${withClock(`/learn/basics/${MODULE_ONE[2]}`, theme)}`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-step-type=wrap]");
      await page.locator("[data-primary]").click();
      await revealShown(page);
      await shot(page, `reveal-module-${size}-${theme}`);
      await context.close();
    }
}

/** Uses the order item's data-key hints (each step's place in the right order) to sort via the move buttons. */
export async function solveOrder(page) {
  for (let guard = 0; guard < 40; guard++) {
    const idx = await page.locator("[data-order-item]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-key"))));
    const wrong = idx.findIndex((v, i) => v !== i);
    if (wrong === -1) return;
    const from = idx.indexOf(wrong);
    await page.locator("[data-order-item]").nth(from).locator("[data-move=up]").click();
  }
}

/** Opens a lesson and clicks through its hook (making a guess when it asks for one) and lab, to the first card. */
async function toExplain(page, url, id) {
  await page.goto(`${url}/learn/basics/${id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-step-type]");
  const guess = page.locator("[data-predict-option]");
  if (await guess.count()) await guess.first().click();
  await page.locator("[data-primary]").click();
  await page.waitForSelector("[data-lab-ready]");
  await page.locator("[data-primary]").click();
  await page.waitForSelector("[data-step-type=explain]");
}

/** Opens a lesson and clicks through to its quiz. */
async function toQuiz(page, url, id, cards) {
  await toExplain(page, url, id);
  for (let i = 0; i < cards; i++) await page.locator("[data-primary]").click();
  await page.waitForSelector("[data-step-type=quiz]");
}

/** A tour of the other step and question types, in the real lessons that use them. */
async function lesson2(browser, url) {
  if (ONLY && !ONLY.has("lesson2")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      const { context, page } = await newPage(browser, size, theme);
      const primary = () => page.locator("[data-primary]").click();

      // An explain card with a widget (Find the law yourself).
      await toExplain(page, url, "find-the-law");
      await page.waitForTimeout(300);
      await shot(page, `lesson2-01-explain-widget-${size}-${theme}`);

      // Numeric: a prefix slip (Tiny numbers, huge numbers).
      await toQuiz(page, url, "tiny-and-huge-numbers", 4);
      await page.locator("[data-numeric-input]").fill("0.047");
      await primary();
      await shot(page, `lesson2-02-numeric-prefix-${size}-${theme}`);

      // Colour code, read and build (Reading the stripes).
      await toQuiz(page, url, "reading-the-stripes", 3);
      await shot(page, `lesson2-03-colour-read-${size}-${theme}`);
      await page.locator("[data-numeric-input]").fill("4k7");
      await primary();
      await primary();
      await shot(page, `lesson2-04-colour-build-${size}-${theme}`);
      for (const [band, colour] of [[0, "orange"], [1, "orange"], [2, "brown"]]) {
        await page.locator(`[data-band="${band}"]`).click();
        await page.locator(`[data-swatch="${colour}"]`).click();
      }
      await shot(page, `lesson2-05-colour-built-${size}-${theme}`);

      // Hotspot and order lived in Your first glow's quiz; it is a bench lesson now (checks on the bench instead).
      await context.close();
    }
}

const server = await startServer();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: WEBGL_ARGS });
try {
  await pages(browser, server.url);
  await landingLive(browser, server.url);
  await lesson();
  await moduleReveal(browser, server.url);
  await lesson2(browser, server.url);
} finally {
  await browser.close();
  server.stop();
}
