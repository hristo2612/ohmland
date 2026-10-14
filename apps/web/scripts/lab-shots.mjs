// Curated screenshots of the lab runtime: the two reference labs, the meter, the scope, a fried part, the loading
// state and the free-build bench, desktop and phone, light and dark. Each is quantised to stay well under 400 KB.
//
//   pnpm build && node scripts/lab-shots.mjs                 into ./screenshots (lab-*.png and two page shots)
//   BASE_URL=http://localhost:4321 node scripts/lab-shots.mjs --out=/tmp/shots
//   SWIFTSHADER=1 node scripts/lab-shots.mjs                 software WebGL (CI, Linux)
//
// Starts `astro preview` itself unless BASE_URL is set. Needs a build with the labs (pnpm build).
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const OUT = args.out ?? "screenshots";
const ONLY = args.only ? new Set(args.only.split(",")) : null;
const PORT = Number(args.port ?? 4392);
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const CONTENT = fileURLToPath(new URL("../../../content/units", import.meta.url));

async function startServer() {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL, stop: () => {} };
  const child = spawn("npx", ["astro", "preview", "--port", String(PORT), "--ignore-lock"], { stdio: "pipe", detached: true });
  const url = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { url, stop: () => process.kill(-child.pid) };
}

function quantise(path) {
  try {
    execFileSync("magick", [path, "-strip", "-dither", "FloydSteinberg", "-colors", "256", "-define", "png:compression-level=9", `PNG8:${path}`]);
  } catch {
    // ImageMagick is optional.
  }
  return statSync(path).size;
}

// ---- Page helpers (the lab installs window.ohmlandLab) --------------------------------------------------------

const project = (page, t) => page.evaluate((x) => window.ohmlandLab.project(x), t);
const benchState = (page) => page.evaluate(() => window.ohmlandLab.bench());

/**
 * Opens a lesson at its lab. A stepper lesson: make the guess, then Continue to the lab step. A bench lesson: tap the
 * start button, then play the first beat when it only names a part (a meet beat), so the bench is
 * ready for work.
 */
async function openLab(page, base, lesson, option = 0) {
  await page.goto(`${base}/learn/${lesson}/`);
  if (await page.locator('.bl[data-phase="start"]').count()) {
    await page.locator("[data-primary]").click();
    await page.locator("[data-bench-ready]").waitFor({ timeout: 60_000 });
    const meet = page.locator('.bl[data-action="meet"] [data-tap]');
    if (await meet.count()) await meet.first().click();
    await page.waitForTimeout(1200);
    return;
  }
  const opt = page.locator("[data-predict-option]");
  if (await opt.count()) await opt.nth(option).click();
  await page.locator("[data-primary]").click();
  await page.locator("[data-bench-ready]").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(600);
}
async function flipBlockSwitch(page, id) {
  const p = (await benchState(page)).parts.find((x) => x.id === id);
  const at = (await page.evaluate(() => window.ohmlandLab.view?.() ?? "3d")) === "ink" ? await project(page, `part:${id}`) : await project(page, [p.pos[0], 24, p.pos[1] - 5.5]);
  await page.mouse.click(at.x, at.y);
}
/**
 * The torn blueprint (first-glow): mends the drawing and builds it on the breadboard through the lab hook, so the bench
 * shows a lit LED on the board beside its drawing.
 */
async function buildFirstGlow(page) {
  const step = (s) => page.evaluate((x) => window.ohmlandLab.step(x), s);
  await step({ do: "move", part: "PC", at: "in:CARD" });
  await step({ do: "param", part: "PC", params: { turn: 90 } });
  await page.locator('.bl[data-moment="b0"][data-phase="done"]').waitFor();
  await page.locator("[data-primary]").click();
  await page.locator('.bl[data-moment="b1"]').waitFor();
  await step({ do: "place", part: "R1", kind: "resistor", at: "c5", params: { ohms: 1000 } });
  await step({ do: "place", part: "D1", kind: "led", at: "d9", params: { color: "red", maxmA: 50 } });
  await page.mouse.click(5, 300); // deselect
  await page.waitForTimeout(1200);
}
const deselect = async (page) => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
};

/** A learner with every lesson done (the whole parts bin), plus saved builds. */
async function seedLearner(page, base, saved = {}) {
  const lessons = [];
  for (const u of readdirSync(CONTENT)) for (const mo of readdirSync(join(CONTENT, u), { withFileTypes: true })) if (mo.isDirectory()) for (const l of readdirSync(join(CONTENT, u, mo.name), { withFileTypes: true })) if (l.isDirectory()) lessons.push(l.name);
  await page.goto(`${base}/about/`);
  await page.evaluate(
    async ({ ids, saved }) => {
      const at = new Date().toISOString();
      const rec = { v: 1, lessons: Object.fromEntries(ids.map((id) => [id, { at, version: 1, firstTry: 0, items: 0, tasks: [] }])), inProgress: {}, achievements: {}, fried: [], sandbox: { saved }, settings: { muted: true, reducedMotion: "system", theme: "system" }, updatedAt: at };
      await new Promise((resolve, reject) => {
        const open = indexedDB.open("ohmland");
        open.onupgradeneeded = () => open.result.createObjectStore("learner");
        open.onsuccess = () => {
          const tx = open.result.transaction("learner", "readwrite");
          tx.objectStore("learner").put(rec, "profile:default");
          tx.oncomplete = () => resolve(null);
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    },
    { ids: lessons, saved },
  );
}

/** An RC circuit on the desk: battery, switch, 1 kΩ and 1,000 µF (τ = 1 s), with the meter across the capacitor. */
function rcBuild(meter = true) {
  const end = (to) => ({ to, pos: [0, 0] });
  return {
    name: "RC charge",
    at: new Date().toISOString(),
    bench: {
      v: 1,
      board: null,
      parts: [
        { id: "B1", kind: "battery", params: { snap: false, emf: 9.5, internalOhms: 1.7, mAh: 500 }, pos: [-82, 8], rot: 270 },
        { id: "S1", kind: "toggle-switch", params: { to: "a", base: true }, pos: [-12, -42], rot: 0 },
        { id: "R1", kind: "resistor", params: { ohms: 1000, bands: 4, watts: 0.25, tolerance: 5 }, pos: [56, -8], rot: -90 },
        { id: "C1", kind: "electrolytic-cap", params: { farads: 0.001, volts: 16 }, pos: [6, 46], rot: 180 },
      ],
      wires: [],
      leads: [
        { id: "TL1", color: "red", a: end("pin:B1.pos"), b: end("pin:S1.com") },
        { id: "TL2", color: "yellow", a: end("pin:S1.b"), b: end("pin:R1.a") },
        { id: "TL3", color: "green", a: end("pin:R1.b"), b: end("pin:C1.pos") },
        { id: "TL4", color: "black", a: end("pin:C1.neg"), b: end("pin:B1.neg") },
      ],
      meter: !meter ? null : {
        id: "M1",
        pos: [150, 4],
        rot: -14,
        mode: "dcv",
        probes: {
          red: { socket: "vohm", plugPos: [180, 104], tip: end("pin:C1.pos") },
          black: { socket: "com", plugPos: [160, 104], tip: end("pin:C1.neg") },
        },
      },
    },
  };
}

// ---- Shots ------------------------------------------------------------------------------------------------------

const SHOTS = [
  ["lesson-lab-desktop-light", DESKTOP, "light", async (page, base) => openLab(page, base, "start-here/welcome-to-the-bench", 2)],
  ["lab-desktop-light", DESKTOP, "light", async (page, base) => {
    await openLab(page, base, "start-here/welcome-to-the-bench", 2);
    await flipBlockSwitch(page, "S1");
    await page.waitForTimeout(1500);
  }],
  ["lab-phone-light", PHONE, "light", async (page, base) => {
    await openLab(page, base, "start-here/welcome-to-the-bench", 2);
    await flipBlockSwitch(page, "S1");
    await page.waitForTimeout(1500);
  }],
  ["lab-desktop-dark", DESKTOP, "dark", async (page, base) => {
    await openLab(page, base, "start-here/first-glow");
    await buildFirstGlow(page);
  }],
  ["lab-phone-dark", PHONE, "dark", async (page, base) => {
    await openLab(page, base, "start-here/first-glow");
    await buildFirstGlow(page);
    await page.waitForTimeout(500);
  }],
  ["lab-loading-desktop-dark", DESKTOP, "dark", async (page, base) => {
    // the bench chunks never arrive, so the lesson's loading state stays on screen
    await page.route(/(Stage|BenchSurface)\.[\w-]+\.js$/, () => {});
    await page.goto(`${base}/learn/start-here/welcome-to-the-bench/`);
    await page.locator("[data-primary]").click();
    await page.locator(".bl-skeleton").waitFor();
    await page.waitForTimeout(600);
  }],
  ["lab-fried-desktop-light", DESKTOP, "light", async (page, base) => {
    // One LED, too much current: the 1.5 kΩ pulled out and the 15 Ω pushed into its holes, so the LED burns out.
    await openLab(page, base, "basics/led-burnout");
    await page.evaluate(() => {
      window.ohmlandLab.step({ do: "move", part: "R1", at: "desk:-30,46" });
      window.ohmlandLab.step({ do: "place", part: "R4", kind: "resistor", params: { ohms: 15, watts: 0.25 }, at: "c6-c10" });
    });
    await deselect(page);
    await page.waitForTimeout(1500);
  }],
  ["lab-meter-desktop-light", DESKTOP, "light", async (page, base) => {
    await openLab(page, base, "basics/volts-across");
    await page.locator(".connections summary").click();
    await page.locator(".conn").filter({ hasText: "Red probe" }).locator("select").nth(1).selectOption("vohm");
    await page.getByRole("radio", { name: "DC volts" }).click();
    await page.locator(".conn").filter({ hasText: "Red probe" }).locator("select").nth(0).selectOption("pin:R1.a");
    await page.locator(".conn").filter({ hasText: "Black probe" }).locator("select").nth(0).selectOption("pin:R1.b");
    await page.locator(".connections summary").click();
    await page.waitForTimeout(2000);
  }],
  ["lab-scope-desktop-dark", DESKTOP, "dark", async (page, base) => {
    await seedLearner(page, base, { demo: rcBuild(false) });
    await page.goto(`${base}/bench/`);
    await page.locator("[data-bench-ready]").waitFor({ timeout: 60_000 });
    await page.locator(".sandbox__build").getByRole("button", { name: "Open" }).click();
    await page.waitForTimeout(800);
    await page.locator(".sandbox__watch select").selectOption("C1");
    await flipBlockSwitch(page, "S1");
    await page.waitForTimeout(3200);
    await deselect(page);
  }],
  ["bench-desktop-light", DESKTOP, "light", async (page, base) => {
    await seedLearner(page, base, { demo: rcBuild() });
    await page.goto(`${base}/bench/`);
    await page.locator("[data-bench-ready]").waitFor({ timeout: 60_000 });
    await page.locator(".sandbox__build").getByRole("button", { name: "Open" }).click();
    await page.waitForTimeout(1000);
  }],
];

const server = await startServer();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: process.env.SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [] });
try {
  for (const [name, viewport, theme, run] of SHOTS) {
    if (ONLY && !ONLY.has(name)) continue;
    const ctx = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: viewport === PHONE ? 2 : 1, hasTouch: viewport === PHONE, isMobile: viewport === PHONE });
    // Sharp graphics for the record, whatever the machine's WebGL renderer is.
    await ctx.addInitScript(() => localStorage.setItem("ohmland:bench-quality", "high"));
    const page = await ctx.newPage();
    await run(page, server.url);
    const path = join(OUT, `${name}.png`);
    await page.screenshot({ path });
    console.log(`${name}: ${Math.round(quantise(path) / 1024)} KB`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.stop();
}
