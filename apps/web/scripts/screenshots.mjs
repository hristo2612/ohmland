// Visual review: screenshots of every page, light and dark, desktop and phone, with a bench lesson at its start and
// resumed at a beat. scripts/lesson-shots.mjs plays every moment of the reference bench lessons.
//
//   pnpm build && pnpm shots                      all pages into ./screenshots-review
//   pnpm shots -- --out=screenshots --curated     the curated set committed under apps/web/screenshots
//   pnpm shots -- --only=landing,learn --full     a subset, full-page
//
// Starts `astro preview` itself unless BASE_URL is set. Chromium runs with SwiftShader so the 3D island draws; the
// island's clock is pinned (day in light shots, night in dark ones) and seeded learners use a fixed date, so the
// islands look the same in every run. Besides the page names, --only takes landing-lit, menu, lesson, reveal-module.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { SEED_MODULE, WEBGL_ARGS, seedLearner } from "./seed.mjs";

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
 * The set committed under apps/web/screenshots. Lab shots (lab-*, lesson-lab-*) come from scripts/lab-shots.mjs, bench
 * lesson and code drawer shots (bench-lesson-*, code-*) are picked from scripts/lesson-shots.mjs and
 * scripts/code-shots.mjs, signed-in account shots come from the accounts end-to-end run.
 */
const CURATED_SET = new Set([
  "landing-desktop-light",
  "landing-desktop-dark",
  "landing-phone-light",
  "landing-paint-desktop-dark",
  "landing-lit-desktop-light",
  "landing-lit-phone-dark",
  "landing-full-desktop-light",
  "menu-desktop-light",
  "menu-phone-dark",
  "learn-desktop-light",
  "learn-desktop-dark",
  "learn-phone-dark",
  "learn-new-desktop-light",
  "learn-module-phone-light",
  "reveal-module-desktop-dark",
  "reveal-module-phone-light",
  "isle-desktop-light",
  "isle-phone-dark",
  "isle-label-desktop-dark",
  "isle-empty-desktop-light",
  "isle-empty-phone-dark",
  "bench-desktop-light",
  "parts-desktop-light",
  "parts-desktop-dark",
  "parts-drawer-phone-dark",
  "achievements-desktop-light",
  "achievements-phone-dark",
  "account-desktop-light",
  "account-phone-dark",
  "about-desktop-dark",
  "about-phone-light",
  "404-desktop-light",
  "404-phone-dark",
]);

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

async function newPage(browser, size, theme, reducedMotion = "reduce", touch = false) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[size],
    deviceScaleFactor: size === "phone" ? 2 : 1,
    colorScheme: theme,
    reducedMotion,
    hasTouch: touch,
    isMobile: touch,
  });
  return { context, page: await context.newPage() };
}

const wanted = (name) => !CURATED || CURATED_SET.has(name);

const shot = async (page, name) => {
  if (!wanted(name)) return;
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
        const card = document.querySelector(".isle-card");
        return !card || card.getAttribute("data-status") !== "waiting";
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
        // the chapters, with the built module stamped
        if (name === "learn-module") await page.locator(".map__chapters").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
        await shot(page, `${name}-${size}-${theme}`);
        if (name === "isle" && wanted(`isle-label-${size}-${theme}`)) {
          // tap the module's landmark, the Meter Tower (where the seeded island puts it), for its label
          const [x, y] = size === "phone" ? [142, 400] : [640, 410];
          await page.mouse.click(x, y);
          await page.waitForTimeout(500);
          await shot(page, `isle-label-${size}-${theme}`);
        }
        if (name === "parts") {
          const first = page.locator("button.part-slip").first();
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
 * The landing at first paint (HTML and CSS only: what shows before any script runs), with its loop closed (the switch
 * pointed at on a desktop; on a touch screen it closes by itself), and the whole page. Also the notebook menu.
 */
async function landingLit(browser, url) {
  if (ONLY && !ONLY.has("landing-lit")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      if (wanted(`landing-paint-${size}-${theme}`)) {
        const { context, page } = await newPage(browser, size, theme);
        await page.route(/\.js$/, (r) => r.abort());
        await page.goto(url, { waitUntil: "load" });
        await shot(page, `landing-paint-${size}-${theme}`);
        await context.close();
      }
      if (wanted(`landing-lit-${size}-${theme}`)) {
        const { context, page } = await newPage(browser, size, theme, "reduce", size === "phone");
        await page.goto(url, { waitUntil: "networkidle" });
        if (size === "phone") await page.waitForSelector("[data-stage].is-lit");
        else await page.locator("[data-switch]").hover();
        await page.waitForTimeout(400);
        await shot(page, `landing-lit-${size}-${theme}`);
        await context.close();
      }
      if (wanted(`landing-full-${size}-${theme}`)) {
        const { context, page } = await newPage(browser, size, theme);
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(OUT, `landing-full-${size}-${theme}.png`), fullPage: true, animations: "disabled" });
        if (CURATED) quantise(join(OUT, `landing-full-${size}-${theme}.png`));
        console.log(join(OUT, `landing-full-${size}-${theme}.png`));
        await context.close();
      }
    }
}

/** The notebook menu, open: from the header chip on a desktop, from the bottom bar on a phone. */
async function menu(browser, url) {
  if (ONLY && !ONLY.has("menu")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      if (!wanted(`menu-${size}-${theme}`)) continue;
      const { context, page } = await newPage(browser, size, theme);
      await seedLearner(page, url, "one");
      await page.goto(url + "/learn", { waitUntil: "networkidle" });
      await page.locator(size === "phone" ? ".bottom-nav button[aria-expanded]" : ".xp-chip").click();
      await page.waitForSelector(".nb__panel");
      await shot(page, `menu-${size}-${theme}`);
      await context.close();
    }
}

/**
 * A bench lesson, the page every lesson uses: the course's first lesson at its start screen (the bench warms by itself
 * behind the mission), and the seeded learner's lesson in progress, resumed at its beat with the bench up.
 */
async function lesson(browser, url) {
  if (ONLY && !ONLY.has("lesson")) return;
  const resumed = SEED_MODULE.lessons[1].id;
  for (const size of SIZES)
    for (const theme of THEMES)
      for (const [name, record, path] of [
        ["lesson-start", null, null],
        ["lesson-resumed", "one", `/learn/${SEED_MODULE.unit}/${resumed}`],
      ]) {
        if (!wanted(`${name}-${size}-${theme}`)) continue;
        const { context, page } = await newPage(browser, size, theme);
        if (record) await seedLearner(page, url, record);
        // A new visitor's first lesson is where the landing's switch leads.
        if (!path) await page.goto(url, { waitUntil: "networkidle" });
        await page.goto(url + (path ?? (await page.locator("[data-switch]").getAttribute("href"))), { waitUntil: "networkidle" });
        await page.waitForSelector("[data-bench-ready]", { state: "attached", timeout: 30000 });
        await page.waitForTimeout(600);
        await shot(page, `${name}-${size}-${theme}`);
        await context.close();
      }
}

/** Finishes the seeded module's last lesson (resumed at its sign-off), which builds the module's landmark. */
async function moduleReveal(browser, url) {
  if (ONLY && !ONLY.has("reveal-module")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      if (!wanted(`reveal-module-${size}-${theme}`)) continue;
      const { context, page } = await newPage(browser, size, theme);
      await seedLearner(page, url, "wrap");
      const last = SEED_MODULE.lessons[SEED_MODULE.lessons.length - 1].id;
      await page.goto(`${url}${withClock(`/learn/${SEED_MODULE.unit}/${last}`, theme)}`, { waitUntil: "networkidle" });
      await page.waitForSelector('.bl[data-moment="end"]');
      await page.locator("[data-primary]").click();
      await revealShown(page);
      await shot(page, `reveal-module-${size}-${theme}`);
      await context.close();
    }
}

const server = await startServer();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: WEBGL_ARGS });
try {
  await pages(browser, server.url);
  await landingLit(browser, server.url);
  await menu(browser, server.url);
  await lesson(browser, server.url);
  await moduleReveal(browser, server.url);
} finally {
  await browser.close();
  server.stop();
}
