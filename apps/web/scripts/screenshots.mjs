// Visual review: screenshots of every page and every lesson step, light and dark, desktop and phone.
//
//   pnpm build && pnpm shots                      all pages and steps into ./screenshots-review
//   pnpm shots -- --out=screenshots --curated     the curated set committed under apps/web/screenshots
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

/** The set committed under apps/web/screenshots (names without the step numbers). */
const CURATED_SET = new Set([
  "landing-desktop-light",
  "landing-desktop-dark",
  "landing-phone-light",
  "learn-desktop-light",
  "learn-phone-dark",
  "lesson-hook-desktop-light",
  "lesson-hook-phone-dark",
  "lesson-lab-desktop-light",
  "lesson2-explain-widget-desktop-dark",
  "lesson-quiz-right-desktop-light",
  "lesson2-numeric-prefix-desktop-light",
  "lesson2-order-phone-light",
  "lesson-wrap-desktop-light",
  "lesson-finale-desktop-light",
  "lesson-finale-desktop-dark",
  "lesson-finale-phone-light",
  "lesson2-colour-built-desktop-light",
  "lesson-quiz-match-one-phone-dark",
  "lesson2-hotspot-right-desktop-light",
  "parts-desktop-light",
  "parts-drawer-phone-dark",
  "achievements-desktop-light",
  "achievements-phone-dark",
  "isle-desktop-dark",
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

/** Seeds some progress so pages show a returning learner (used for map, parts, achievements). */
async function seed(page, url) {
  await page.goto(url);
  await page.evaluate(async () => {
    const now = Date.now();
    const iso = (d) => new Date(now - d * 86400000).toISOString();
    const state = {
      v: 1,
      lessons: {
        "welcome-to-the-bench": { at: iso(3), version: 1, firstTry: 5, items: 5, tasks: ["close-the-switch", "break-the-loop", "mend-the-loop"] },
        "meet-the-meter": { at: iso(2), version: 1, firstTry: 4, items: 6, tasks: ["plug-in", "set-dial", "read-battery", "swap-probes"] },
      },
      inProgress: { "tiny-and-huge-numbers": { step: 2, answers: {}, at: iso(0) } },
      achievements: { "first-spark": { at: iso(3) }, "clean-sweep": { at: iso(3) }, "first-reading": { at: iso(2) }, "magic-smoke": { at: iso(1) } },
      fried: [
        { kind: "led", label: "Red LED, no resistor on 9 V", lessonId: null, at: iso(1) },
        { kind: "resistor", label: "15 Ω, 1/4 W resistor across 9 V", lessonId: null, at: iso(1) },
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

/** Plays the first lesson of the course, capturing each step (and quiz feedback). */
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
      const primary = () => page.locator("[data-primary]").click();
      await page.goto(`${url}/learn/basics/welcome-to-the-bench`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-step-type]");
      await step("hook");
      await page.locator("[data-predict-option]").nth(2).click();
      await step("hook-predicted");
      await primary();
      await page.waitForSelector("[data-step-type=lab]");
      await page.waitForSelector("[data-lab-ready]");
      await step("lab");
      await primary();
      await page.waitForSelector("[data-step-type=explain]");
      await step("explain");
      for (let i = 0; i < 4; i++) {
        await primary();
        await page.waitForTimeout(150);
        if (i === 2) await step("explain-last");
      }
      await page.waitForSelector("[data-step-type=quiz]");
      // Choice: pick the right one.
      await page.locator("[data-option]").filter({ hasText: "None of them" }).click();
      await step("quiz-choice");
      await primary();
      await step("quiz-right");
      await primary();
      // Match: pair one, then the rest in order.
      await step("quiz-match");
      const rights = ["the flow of charge", "the push that drives the flow", "how hard a path is to flow through", "a complete loop current can flow around"];
      await page.locator("[data-match-right]").filter({ hasText: rights[0] }).click();
      await step("quiz-match-one");
      for (const r of rights.slice(1)) await page.locator("[data-match-right]").filter({ hasText: r }).click();
      await primary();
      await primary();
      // Choice: one wrong first, then right.
      await page.locator("[data-option]").filter({ hasText: "It glows dimly" }).click();
      await primary();
      await step("quiz-wrong");
      await primary();
      await page.locator("[data-option]").filter({ hasText: "It stays dark" }).click();
      await primary();
      await primary();
      await page.locator("[data-option]").filter({ hasText: "From the battery's plus terminal" }).click();
      await primary();
      await primary();
      await page.locator("[data-option]").filter({ hasText: "A 9 V battery" }).click();
      await primary();
      await primary();
      await page.waitForSelector("[data-step-type=wrap]");
      await step("wrap");
      await primary();
      await page.waitForSelector("[data-finale]");
      await page.waitForTimeout(1600);
      await step("finale");
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

      // Hotspot and order (Your first glow).
      await toQuiz(page, url, "first-glow", 4);
      await shot(page, `lesson2-06-hotspot-${size}-${theme}`);
      await page.locator('[data-region="cathode"]').click();
      await primary();
      await shot(page, `lesson2-07-hotspot-right-${size}-${theme}`);
      await primary();
      await page.locator("[data-option]").filter({ hasText: "It goes dark" }).click();
      await primary();
      await primary();
      await shot(page, `lesson2-08-order-${size}-${theme}`);
      await solveOrder(page);
      await primary();
      await shot(page, `lesson2-09-order-right-${size}-${theme}`);
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
