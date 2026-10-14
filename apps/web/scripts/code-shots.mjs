// Screenshots of the microcontroller board's tools in the bench lesson player (the dev page /dev/code-drawer, on the
// mcu-demo lab), played like a learner: the code drawer's blocks (a palette block carried, one dragged, blocks
// edited), the text view, a mistake Upload refuses (in the text and on its block), the serial monitor, and the
// millis() readout before and after the day-49 jump. Desktop and phone.
//
//   pnpm dev, then BASE_URL=http://localhost:4321 node scripts/code-shots.mjs      into ./screenshots-code
//   node scripts/code-shots.mjs --sizes=phone --views=ink --themes=dark --out=/tmp/shots
//
// The page exists only under `astro dev`, so BASE_URL must point at a dev server.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { WEBGL_ARGS } from "./seed.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const OUT = args.out ?? "screenshots-code";
const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const SIZES = (args.sizes ?? "desktop,phone").split(",");
const THEMES = (args.themes ?? "light").split(",");
const VIEWS = (args.views ?? "3d").split(",");
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

const BLINK_TYPO = `void setup() {
  pinMode(13, OUTPUT);
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(7, HIGH);
  delay(1000);
  digitalwrite(7, LOW);
  delay(1000);
}
`;
const HELLO = `void setup() {
  Serial.begin(9600);
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(7, HIGH);
  Serial.println("on");
  delay(1000);
  digitalWrite(7, LOW);
  Serial.println("off");
  delay(1000);
}
`;

const settle = (page, ms = 900) => page.waitForTimeout(ms);
const at = (page, key, phase) => page.locator(`.bl[data-moment="${key}"]${phase ? `[data-phase="${phase}"]` : ""}`).waitFor({ timeout: 60_000 });
const loopBody = '.cb-stmt[data-type="loop"] > .cb-body > .cb-list';

/** Picks a palette block up with a tap and puts it in the loop's slot `n` (0 is above its first block). */
async function tapIn(page, entry, n) {
  await page.locator(`[data-palette="${entry}"]`).click();
  await page.locator(`${loopBody} > .cb-gap`).nth(n).locator(".cb-gap__put").click();
  await settle(page, 300);
}

/** Drags a palette block by pointer into the loop's slot `n`; `mid` takes a picture halfway, over the slot. */
async function dragIn(page, entry, n, mid) {
  const from = await page.locator(`[data-palette="${entry}"]`).boundingBox();
  const gap = await page.locator(`${loopBody} > .cb-gap`).nth(n).boundingBox();
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const b = { x: gap.x + 40, y: gap.y + gap.height / 2 };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 16, a.y + ((b.y - a.y) * i) / 16);
  await settle(page, 200);
  if (mid) await mid();
  await page.mouse.up();
  await settle(page, 300);
}

/** Puts a whole program into the text view (select all, then the new text, as a paste would). */
async function typeProgram(page, text) {
  await page.locator(".code-text .cm-content").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.insertText(text);
  await settle(page, 300);
}

async function play(page, shot, size) {
  await page.locator("[data-primary]").first().click();
  await at(page, "b0");
  await page.locator("[data-code-drawer]").waitFor();
  await settle(page, 1500);
  await shot("01-blocks");
  await page.locator("[data-code-upload]").click();
  // The upload moment (0.6 s), the lamp, then the lesson moves on by itself: catch the drawer before it does.
  await page.locator(".code-drawer__note--ok").waitFor();
  await shot("02-uploaded");

  // Beat 2: the palette. Turn pin 13 into pin 7, then add a wait, a LOW and another wait.
  await at(page, "b1");
  await page.locator("[data-code-drawer]").waitFor();
  await settle(page, 1200);
  const pin = page.locator(`${loopBody} .cb-stmt[data-type="digitalWrite"] input.cb-blank--number`).first();
  await pin.fill("7");
  await pin.press("Enter");
  await page.locator('[data-palette="delay(1000);"]').click();
  await settle(page, 400);
  await shot("03-carry");
  await page.locator(`${loopBody} > .cb-gap`).nth(1).locator(".cb-gap__put").click();
  await settle(page, 300);
  if (size === "desktop") await dragIn(page, "digitalWrite(7, LOW);", 2, () => shot("04-drag"));
  else await tapIn(page, "digitalWrite(7, LOW);", 2);
  await tapIn(page, "delay(1000);", 3);
  await settle(page, 400);
  await shot("05-blocks-edited");

  // The text view, beside the blocks on a desktop, in their place on a phone.
  await page.locator("[data-code-view-toggle]").click();
  await page.locator(".code-text .cm-content").waitFor();
  await settle(page, 800);
  await shot("06-text");
  await typeProgram(page, BLINK_TYPO);
  await page.locator("[data-code-upload]").click();
  await page.locator("[data-code-error]").waitFor();
  await settle(page, 500);
  await shot("07-error");
  if (size === "phone") {
    await page.locator("[data-code-view-toggle]").click();
    await settle(page, 600);
    await shot("08-error-blocks");
    await page.locator("[data-code-view-toggle]").click();
    await page.locator(".code-text .cm-content").waitFor();
  }
  await typeProgram(page, HELLO);
  await page.locator("[data-code-upload]").click();

  // The blink is the beat's goal; the lesson moves on to the serial monitor.
  await at(page, "b2");
  await page.locator("[data-serial]").waitFor();
  await settle(page, 4500);
  await shot("09-serial");
  await page.locator("[data-primary]").first().click();
  await at(page, "b3");
  await page.locator("[data-millis]").waitFor();
  await settle(page, 1500);
  await shot("10-millis");
  await page.locator("[data-millis-jump]").click();
  await settle(page, 2500);
  await shot("11-millis-day-49");
  await settle(page, 8000);
  await shot("12-millis-wrapped");
}

async function run(browser, size, theme, view) {
  const context = await browser.newContext({ viewport: VIEWPORTS[size], colorScheme: theme, reducedMotion: "reduce", deviceScaleFactor: 1, hasTouch: size === "phone" });
  await context.addInitScript((v) => {
    try {
      localStorage.setItem("ohmland:bench-view", v);
    } catch {
      // ignore
    }
  }, view);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`${size}: page error:`, e.message));
  mkdirSync(OUT, { recursive: true });
  const shot = async (name) => {
    const file = join(OUT, `${name}-${size}-${theme}-${view}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  };
  try {
    await page.goto(`${BASE}/dev/code-drawer`, { waitUntil: "networkidle" });
    await page.mouse.move(5, 5);
    await page.locator("[data-bench-ready]").waitFor({ state: "attached", timeout: 90_000 });
    await settle(page, 800);
    await play(page, shot, size);
  } catch (err) {
    console.error(`${size} ${theme} ${view}:`, err.message.split("\n")[0]);
    await page.screenshot({ path: join(OUT, `zz-failed-${size}-${theme}-${view}.png`) }).catch(() => {});
  }
  await context.close();
}

const browser = await chromium.launch({ args: WEBGL_ARGS });
for (const size of SIZES) for (const theme of THEMES) for (const view of VIEWS) await run(browser, size, theme, view);
await browser.close();
