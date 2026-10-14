// Screenshots of every moment of the bench lessons (first-glow, how-a-breadboard-works, welcome-to-the-bench),
// played on the real bench like a learner: desktop and phone, light and dark, 3D and ink views.
//
//   pnpm build && node scripts/lesson-shots.mjs                       into ./screenshots-lessons
//   node scripts/lesson-shots.mjs --lessons=first-glow --sizes=desktop --themes=light --views=3d
//   BASE_URL=http://localhost:4321 node scripts/lesson-shots.mjs --out=/tmp/shots
//
// Starts `astro preview` itself unless BASE_URL is set. Chromium runs with SwiftShader so the bench draws.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { WEBGL_ARGS } from "./seed.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const OUT = args.out ?? "screenshots-lessons";
const PORT = Number(args.port ?? 4393);
const LESSONS = (args.lessons ?? "first-glow,how-a-breadboard-works,welcome-to-the-bench").split(",");
const SIZES = (args.sizes ?? "desktop,phone").split(",");
const THEMES = (args.themes ?? "light,dark").split(",");
const VIEWS = (args.views ?? "3d,ink").split(",");
const PARALLEL = Number(args.parallel ?? 3);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const PATHS = { "first-glow": "basics/first-glow", "how-a-breadboard-works": "basics/how-a-breadboard-works", "welcome-to-the-bench": "basics/welcome-to-the-bench" };

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

// ---- Learner moves (the stage installs window.ohmlandLab) -------------------------------------------------------

const project = (page, t) => page.evaluate((x) => window.ohmlandLab.project(x), t);
const benchState = (page) => page.evaluate(() => window.ohmlandLab.bench());
const primary = (page) => page.locator("[data-primary]").first();
const at = (page, key, phase) => page.locator(`.bl[data-moment="${key}"]${phase ? `[data-phase="${phase}"]` : ""}`).waitFor({ timeout: 60_000 });

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 14, from.y + ((to.y - from.y) * i) / 14);
  await page.mouse.up();
  await page.waitForTimeout(250);
}
async function leadFromTray(page, color, anchor) {
  const before = new Set((await benchState(page)).leads.map((l) => l.id));
  const box = await page.locator(".ohb-tray .ohb-item", { hasText: color }).first().boundingBox();
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, await project(page, anchor));
  return (await benchState(page)).leads.find((l) => !before.has(l.id)).id;
}
/** Where to grab one clip of a lead: on its jaws, a few pixels along the lead from the point it holds, so a clip on
 * a neighbouring leg is not picked up instead. */
async function grabPoint(page, lead, end) {
  const l = (await benchState(page)).leads.find((x) => x.id === lead);
  const e = l[end];
  const o = l[end === "a" ? "b" : "a"];
  const p = e.to ? await project(page, e.to) : await project(page, [e.pos[0], 4, e.pos[1]]);
  if (!e.to) return p;
  const q = o.to ? await project(page, o.to) : await project(page, [o.pos[0], 4, o.pos[1]]);
  const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: p.x + ((q.x - p.x) / d) * 5, y: p.y + ((q.y - p.y) / d) * 5 };
}
/** On a phone the LED's legs are a few pixels apart: there the script moves clips through the lab hook instead. */
const fine = (page) => page.viewportSize().width < 600;
async function clipTo(page, lead, end, anchor) {
  if (fine(page)) {
    await page.evaluate((s) => window.ohmlandLab.step(s), { do: "clip", lead, end, to: anchor });
    await page.waitForTimeout(250);
    return;
  }
  await drag(page, await grabPoint(page, lead, end), await project(page, anchor));
}
/** Swaps the clips on two neighbouring points (an LED's legs): one comes off first, as a careful learner would. */
async function swapClips(page, a, b) {
  await unclip(page, b[0], b[1]);
  await clipTo(page, a[0], a[1], b[2]);
  await clipTo(page, b[0], b[1], a[2]);
}
async function unclip(page, lead, end) {
  if (fine(page)) return clipTo(page, lead, end, null);
  const from = await grabPoint(page, lead, end);
  await drag(page, from, { x: from.x + 30, y: from.y + 90 });
}
async function flipBlockSwitch(page, id) {
  const p = (await benchState(page)).parts.find((x) => x.id === id);
  const pt = await project(page, [p.pos[0], 24, p.pos[1] - 5.5]);
  await page.mouse.click(pt.x, pt.y);
}
async function tapHole(page, hole) {
  const p = await project(page, `hole:${hole}`);
  await page.mouse.click(p.x, p.y);
}
/** Waits for the bench and the ink to settle (the camera glides, notes draw themselves). */
const settle = (page, ms = 900) => page.waitForTimeout(ms);

// ---- The lessons -------------------------------------------------------------------------------------------------

async function firstGlow(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page);
  await shot("02-meet");
  await page.locator('[data-tap="D1"]').click();
  await at(page, "b1");
  await settle(page);
  await shot("03-build");
  const red = await leadFromTray(page, "Red", "pin:B1.pos");
  await clipTo(page, red, "a", "pin:R1.a");
  await shot("04-build-one-lead");
  const green = await leadFromTray(page, "Green", "pin:R1.b");
  await clipTo(page, green, "a", "pin:D1.anode");
  const black = await leadFromTray(page, "Black", "pin:D1.cathode");
  await clipTo(page, black, "a", "pin:B1.neg");
  await at(page, "b1", "done");
  await settle(page);
  await shot("05-glow");
  await primary(page).click();
  await at(page, "b2");
  await settle(page);
  await shot("06-popup");
  await page.locator(".bl-slider__range").focus();
  await page.keyboard.press("Home");
  await settle(page, 1500);
  await shot("07-popup-470");
  await primary(page).click();
  await at(page, "b3");
  await settle(page);
  await shot("08-tap-check");
  await page.locator('[data-tap="D1.cathode"]').click();
  await settle(page, 500);
  await shot("09-tap-wrong");
  await page.locator('[data-tap="D1.anode"]').click();
  await at(page, "b3", "done");
  await settle(page);
  await shot("10-anode-rule");
  await primary(page).click();
  await at(page, "b4", "guess");
  await settle(page, 500);
  await shot("11-guess");
  await page.locator("[data-guess='1']").click();
  await settle(page, 1200);
  // A lead from the tray drops its b clip on the first point; the a clip was then moved to the second.
  await swapClips(page, [green, "a", "pin:D1.anode"], [black, "b", "pin:D1.cathode"]);
  await at(page, "b4", "done");
  await settle(page);
  await shot("12-flipped");
  await primary(page).click();
  await at(page, "b5");
  await settle(page, 1200);
  await swapClips(page, [green, "a", "pin:D1.cathode"], [black, "b", "pin:D1.anode"]);
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("13-fixit");
  await page.locator(".bl-clock").click();
  await settle(page, 400);
  await shot("14-fixit-clock");
  await settle(page, 600);
  // The fix-it bench starts from the canonical loop (TL1 to TL3), with the battery's clips swapped.
  await swapClips(page, ["TL2", "b", "pin:D1.anode"], ["TL3", "a", "pin:D1.cathode"]);
  await at(page, "secret");
  await settle(page);
  await shot("15-secret");
  await clipTo(page, "TL2", "a", "pin:R1.a");
  await at(page, "secret", "done");
  await settle(page);
  await shot("16-fried");
  await primary(page).click();
  await at(page, "end");
  await settle(page);
  await shot("17-end");
  await page.locator("[data-notebook-button]").click();
  await settle(page, 600);
  await shot("18-notebook");
  await page.keyboard.press("Escape");
  await finish(page, shot, 19);
}

async function breadboard(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page);
  await shot("02-tap-any-hole");
  await tapHole(page, "c7");
  await at(page, "b0", "done");
  await settle(page);
  await shot("03-hole-name");
  await primary(page).click();
  await at(page, "b1");
  await settle(page);
  await shot("04-xray");
  await tapHole(page, "h9");
  await at(page, "b1", "done");
  await settle(page);
  await shot("05-xray-strip");
  await primary(page).click();
  await at(page, "b2");
  await settle(page);
  await shot("06-game");
  await tapHole(page, "d14");
  await at(page, "b3");
  await settle(page);
  await shot("07-game-two");
  await tapHole(page, "f18");
  await settle(page, 500);
  await shot("08-game-wrong");
  await tapHole(page, "a18");
  await at(page, "b3", "done");
  await settle(page);
  await shot("09-channel-rule");
  await primary(page).click();
  await at(page, "b4");
  await tapHole(page, "bp27");
  await at(page, "b4", "done");
  await settle(page);
  await shot("10-rail-rule");
  await primary(page).click();
  await at(page, "b5");
  await settle(page, 1500);
  await shot("11-led-wrong");
  const d1 = await project(page, "part:D1");
  await page.mouse.click(d1.x, d1.y);
  await page.getByRole("button", { name: "Rotate" }).first().click();
  await at(page, "b5", "done");
  await settle(page);
  await shot("12-led-right");
  await primary(page).click();
  await at(page, "b6");
  await settle(page);
  await shot("13-rails");
  await drag(page, await project(page, "wire:W1.b"), await project(page, "hole:bn26"));
  await at(page, "b6", "done");
  await settle(page);
  await shot("14-rails-done");
  await primary(page).click();
  await at(page, "secret");
  await settle(page);
  await shot("15-secret");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await at(page, "end");
  await settle(page);
  await shot("16-end");
  await finish(page, shot, 17);
}

async function welcome(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page, 1200);
  await shot("02-switch");
  await flipBlockSwitch(page, "S1");
  await at(page, "b0", "done");
  await settle(page);
  await shot("03-glow");
  await primary(page).click();
  await at(page, "b1", "guess");
  await shot("04-guess");
  await page.locator("[data-guess='2']").click();
  await unclip(page, "TL2", "a");
  await at(page, "b1", "done");
  await settle(page);
  await shot("05-dark-rule");
  await primary(page).click();
  await at(page, "b2");
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await at(page, "b3");
  await settle(page);
  await shot("06-what-is-this");
  await page.locator("[data-pick='0']").click();
  await at(page, "b3", "done");
  await settle(page);
  await shot("07-switch-rule");
  await primary(page).click();
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("08-fixit");
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await at(page, "secret");
  await settle(page);
  await shot("09-secret");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await at(page, "end");
  await finish(page, shot, 10);
}

async function finish(page, shot, n) {
  await primary(page).click();
  const reveal = page.getByRole("dialog");
  try {
    await reveal.waitFor({ timeout: 20_000 });
    await settle(page, 2500);
    await shot(`${n}-reveal`);
    await reveal.getByRole("button", { name: "Continue" }).click();
  } catch {
    // No reveal (a replay, or the island did not start in time).
  }
  await page.locator("[data-finale]").waitFor({ timeout: 30_000 });
  await settle(page, 2000);
  await shot(`${n + 1}-finale`);
}

const PLAY = { "first-glow": firstGlow, "how-a-breadboard-works": breadboard, "welcome-to-the-bench": welcome };

async function run(browser, base, lesson, size, theme, view) {
  const context = await browser.newContext({ viewport: VIEWPORTS[size], colorScheme: theme, reducedMotion: "reduce", deviceScaleFactor: 1, hasTouch: size === "phone" });
  await context.addInitScript((v) => {
    try {
      localStorage.setItem("ohmland:bench-view", v);
    } catch {
      // ignore
    }
  }, view);
  const page = await context.newPage();
  const dir = join(OUT, lesson);
  mkdirSync(dir, { recursive: true });
  const shot = async (name) => {
    const file = join(dir, `${name}-${size}-${theme}-${view}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  };
  try {
    await page.goto(`${base}/learn/${PATHS[lesson]}/?time=${theme === "dark" ? "22:00" : "12:00"}`, { waitUntil: "networkidle" });
    await page.mouse.move(5, 5);
    await page.locator("[data-bench-ready]").waitFor({ state: "attached", timeout: 60_000 });
    await settle(page, 800);
    await PLAY[lesson](page, shot);
  } catch (err) {
    console.error(`${lesson} ${size} ${theme} ${view}:`, err.message.split("\n")[0]);
    if (args.debug)
      console.error(
        JSON.stringify(
          await page.evaluate(() => ({
            leads: window.ohmlandLab?.bench().leads.map((l) => `${l.id} a=${l.a.to} b=${l.b.to}`),
            status: window.ohmlandLab?.status(),
            d1: window.ohmlandLab?.part("D1"),
          })),
        ),
      );
    await page.screenshot({ path: join(dir, `zz-failed-${size}-${theme}-${view}.png`) }).catch(() => {});
  }
  await context.close();
}

const server = await startServer();
const browser = await chromium.launch({ args: WEBGL_ARGS });
const jobs = [];
for (const lesson of LESSONS) for (const size of SIZES) for (const theme of THEMES) for (const view of VIEWS) jobs.push([lesson, size, theme, view]);
const queue = [...jobs];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (queue.length) {
      const [lesson, size, theme, view] = queue.shift();
      await run(browser, server.url, lesson, size, theme, view);
    }
  }),
);
await browser.close();
server.stop();
