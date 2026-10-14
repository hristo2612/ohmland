/// <reference types="node" />
// The microcontroller board in the 3D and ink views: its clip points agree in both, then screenshots in
// ../screenshots (mcu-3d.png, mcu-ink.png, mcu-ink-dark.png).

import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../screenshots");
mkdirSync(OUT, { recursive: true });

type ScreenPoint = { x: number; y: number; visible: boolean };
type W = Window & { __ready?: boolean; __controller: { current: { project: (a: string) => ScreenPoint | null } } };

async function open(page: Page, query: string, settle = 1500) {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => (window as unknown as W).__ready === true, null, { timeout: 30_000 });
  await page.waitForTimeout(settle);
}

async function shot(page: Page, name: string) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  try {
    execFileSync("magick", [path, "-strip", "-dither", "None", "-colors", "256", "-define", "png:compression-level=9", `PNG8:${path}`]);
  } catch {
    // ImageMagick is optional.
  }
}

const project = (page: Page, a: string) => page.evaluate((x) => (window as unknown as W).__controller.current.project(x), a);

const FOCUS = "focus=part:U1,part:D1";

test("the board in 3D: lamps lit, header sockets where the clips are", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await open(page, `scene=mcu&panel=0&tray=0&toggle=0&glow=0.8&lamp=0.85&${FOCUS}`, 2200);
  const p7 = await project(page, "pin:U1.d7");
  const p0 = await project(page, "pin:U1.d0");
  expect(p7?.visible).toBe(true);
  // Pin 0 is to the right of pin 7 (the far header counts down from 13 to 0, left to right).
  expect(p0!.x).toBeGreaterThan(p7!.x);
  await shot(page, "mcu-3d");
  await open(page, "scene=mcu&panel=0&tray=0&toggle=0&glow=0.8&lamp=0.85&focus=part:U1", 2200);
  await shot(page, "mcu-3d-close");
});

test("the board in ink: the same layout, true size", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await open(page, `scene=mcu&view=ink&panel=0&tray=0&toggle=0&glow=0.8&lamp=0.85&${FOCUS}`, 1400);
  const p7 = await project(page, "pin:U1.d7");
  const a5 = await project(page, "pin:U1.a5");
  expect(p7?.visible).toBe(true);
  // A5 is on the near edge, below the far header.
  expect(a5!.y).toBeGreaterThan(p7!.y);
  await shot(page, "mcu-ink");
  await open(page, "scene=mcu&view=ink&panel=0&tray=0&toggle=0&glow=0.8&lamp=0.85&focus=part:U1", 1400);
  await shot(page, "mcu-ink-close");
  await open(page, `scene=mcu&view=ink&panel=0&tray=0&toggle=0&glow=0.8&lamp=0.85&theme=dark&${FOCUS}`, 1400);
  await shot(page, "mcu-ink-dark");
});
