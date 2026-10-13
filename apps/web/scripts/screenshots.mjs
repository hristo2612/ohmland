// Visual review: screenshots of every page and every lesson step, light and dark, desktop and phone.
//
//   pnpm build && pnpm shots                      all pages and steps into ./screenshots-review
//   pnpm shots -- --out=screenshots --curated     the small set committed under apps/web/screenshots
//   pnpm shots -- --only=landing,learn --full     a subset, full-page
//
// Starts `astro preview` itself unless BASE_URL is set.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

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

const PAGES = [
  ["landing", "/"],
  ["learn", "/learn"],
  ["isle", "/isle"],
  ["bench", "/bench"],
  ["parts", "/parts"],
  ["achievements", "/achievements"],
  ["account", "/account"],
  ["about", "/about"],
  ["404", "/no-such-page"],
];

const CURATED_PAGES = new Set(["landing", "learn", "parts", "achievements"]);

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
  const file = join(OUT, `${name}.png`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage: FULL, animations: "disabled" });
  console.log(file);
};

/** Seeds some progress so pages show a returning learner (used for map, parts, achievements). */
async function seed(page, url) {
  await page.goto(url);
  await page.evaluate(async () => {
    const now = Date.now();
    const iso = (d) => new Date(now - d * 86400000).toISOString();
    const state = {
      v: 1,
      lessons: { "sample-first-glow": { at: iso(2), version: 1, firstTry: 3, items: 4, tasks: ["light-it", "measure-resistor"] } },
      inProgress: { "sample-read-a-resistor": { step: 2, answers: {}, at: iso(0) } },
      achievements: { "first-spark": { at: iso(2) }, "magic-smoke": { at: iso(1) } },
      fried: [
        { kind: "led", label: "Red LED", lessonId: "sample-first-glow", at: iso(2) },
        { kind: "resistor", label: "470 Ω resistor", lessonId: "sample-first-glow", at: iso(1) },
        { kind: "led", label: "Red LED", lessonId: null, at: iso(0) },
      ],
      sandbox: { saved: {} },
      settings: { muted: false, reducedMotion: "system", theme: "system" },
      updatedAt: iso(0),
    };
    await new Promise((resolve, reject) => {
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

async function pages(browser, url) {
  for (const [name, path] of PAGES) {
    if (ONLY && !ONLY.has(name)) continue;
    if (CURATED && !CURATED_PAGES.has(name)) continue;
    for (const size of SIZES)
      for (const theme of THEMES) {
        const { context, page } = await newPage(browser, size, theme);
        if (["learn", "parts", "achievements", "isle", "bench", "account"].includes(name)) await seed(page, url);
        await page.goto(url + path, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        await shot(page, `${name}-${size}-${theme}`);
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

/** Plays the first sample lesson, capturing each step (and quiz feedback). */
async function lesson(browser, url) {
  if (ONLY && !ONLY.has("lesson")) return;
  for (const size of SIZES)
    for (const theme of THEMES) {
      if (CURATED && !(size === "desktop" || theme === "light")) continue;
      const { context, page } = await newPage(browser, size, theme);
      let n = 0;
      const step = async (label) => {
        n++;
        if (CURATED && !["hook", "quiz-right", "quiz-numeric-prefix", "explain", "finale"].includes(label)) return;
        await shot(page, `lesson-${String(n).padStart(2, "0")}-${label}-${size}-${theme}`);
      };
      await page.goto(`${url}/learn/basics/sample-first-glow`, { waitUntil: "networkidle" });
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
      await page.waitForSelector("[data-finale]");
      await page.waitForTimeout(1600);
      await step("finale");
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
const browser = await chromium.launch();
try {
  await pages(browser, server.url);
  await lesson(browser, server.url);
  await lesson2(browser, server.url);
} finally {
  await browser.close();
  server.stop();
}
