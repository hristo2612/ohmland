/// <reference types="node" />
// Drives the playground in headless Chromium: one interaction check, then the screenshots in ../screenshots.

import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../screenshots");
mkdirSync(OUT, { recursive: true });

type ScreenPoint = { x: number; y: number; visible: boolean };
type BenchWindow = Window & {
  __ready?: boolean;
  __bench: { getState: () => { bench: { parts: { id: string; kind: string; holes?: Record<string, string> }[]; wires: unknown[] } } };
  /** The BenchView's controller hub (the playground's bench fills the page, so element px are page px). */
  __controller: {
    current: {
      project: (a: string) => ScreenPoint | null;
      onViewChange: (cb: () => void) => () => void;
      focus: (t: string[], o?: { padding?: number; instant?: boolean }) => void;
      spotlight: (t: string[] | null) => void;
    };
  };
};

async function open(page: Page, query: string, settle = 1400) {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => (window as unknown as BenchWindow).__ready === true, null, { timeout: 30_000 });
  await page.waitForTimeout(settle);
}

/** Save a screenshot, then quantise it with ImageMagick when available to keep the file small (undithered: the dithered quantiser shifts the paper colour). */
async function shot(page: Page, name: string) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  try {
    execFileSync("magick", [path, "-strip", "-dither", "None", "-colors", "256", "-define", "png:compression-level=9", `PNG8:${path}`]);
  } catch {
    // ImageMagick is optional.
  }
  return statSync(path).size;
}

const project = (page: Page, anchor: string) =>
  page.evaluate((a) => (window as unknown as BenchWindow).__controller.current.project(a), anchor);

test("drag from the tray, wire two holes, undo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "scene=empty&panel=0", 600);
  const item = page.locator(".ohb-item").first();
  const box = (await item.boundingBox())!;
  const target = (await project(page, "hole:e22"))!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 14 });
  await page.mouse.up();
  const parts = await page.evaluate(() => (window as unknown as BenchWindow).__bench.getState().bench.parts);
  expect(parts).toHaveLength(1);
  expect(parts[0]!.kind).toBe("resistor");
  expect(Object.values(parts[0]!.holes ?? {})).toHaveLength(2);

  await page.getByRole("button", { name: "Wire", exact: true }).click();
  const a = (await project(page, "hole:a30"))!;
  const b = (await project(page, "hole:bp31"))!;
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  let wires = await page.evaluate(() => (window as unknown as BenchWindow).__bench.getState().bench.wires);
  expect(wires).toHaveLength(1);
  await page.keyboard.press("Control+z");
  wires = await page.evaluate(() => (window as unknown as BenchWindow).__bench.getState().bench.wires);
  expect(wires).toHaveLength(0);
});

test("the 3D controller projects, frames and spotlights", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page, "scene=glow&panel=0&tray=0&toggle=0&glow=0.75", 600);
  const r = await project(page, "part:R1");
  expect(r?.visible).toBe(true);
  expect(r!.x).toBeGreaterThan(0);
  expect(r!.x).toBeLessThan(1200);
  // Off-screen points say so.
  const far = await page.evaluate(() => (window as unknown as { __controller: { current: { inner(): { project(p: number[]): ScreenPoint | null } } } }).__controller.current.inner().project([4000, 0, 0]));
  expect(far?.visible ?? false).toBe(false);
  const span = async () => {
    const a = (await project(page, "pin:R1.a"))!;
    const b = (await project(page, "pin:R1.b"))!;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const before = await span();
  // focus() moves the camera, and onViewChange hears it.
  const changes = await page.evaluate(async () => {
    const c = (window as unknown as BenchWindow).__controller.current;
    let n = 0;
    const off = c.onViewChange(() => n++);
    c.focus(["part:R1"], { instant: true });
    await new Promise((r) => setTimeout(r, 400));
    off();
    return n;
  });
  expect(changes).toBeGreaterThan(0);
  expect(await span()).toBeGreaterThan(before * 2.5);
  // The meter-less bench has no display spot; an unknown target projects to nothing.
  expect(await project(page, "part:M1/display")).toBeNull();
  expect(await project(page, "part:nope")).toBeNull();
  await page.evaluate(() => (window as unknown as BenchWindow).__controller.current.spotlight(["part:R1"]));
  await page.waitForTimeout(700);
  expect(await shot(page, "focus-resistor")).toBeLessThan(400_000);
});

test("switching views keeps the bench", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await open(page, "scene=glow&panel=0", 400);
  const parts = () => page.evaluate(() => (window as unknown as BenchWindow).__bench.getState().bench.parts.length);
  const n = await parts();
  await page.getByRole("button", { name: "Ink", exact: true }).click();
  await expect(page.locator(".ohb-ink")).toBeVisible();
  expect(await parts()).toBe(n);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  expect(await parts()).toBe(n);
});

test.describe("screenshots", () => {
  test("desktop bench", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "panel=0&toggle=0&glow=0.85");
    expect(await shot(page, "bench-desktop")).toBeLessThan(400_000);
  });

  test("phone bench", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await open(page, "panel=0&toggle=0&glow=0.85&select=D1");
    expect(await shot(page, "bench-phone")).toBeLessThan(400_000);
    await ctx.close();
  });

  test("phone, first glow", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await open(page, "scene=glow&panel=0&toggle=0&glow=0.75&tray=0");
    expect(await shot(page, "glow-phone")).toBeLessThan(400_000);
    await ctx.close();
  });

  test("first glow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=glow&panel=0&toggle=0&tray=0&glow=0.75");
    expect(await shot(page, "first-glow")).toBeLessThan(400_000);
  });

  test("spotlight on the LED", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=glow&panel=0&toggle=0&tray=0&glow=0.75&spot=part:D1,part:R1", 1600);
    expect(await shot(page, "spotlight")).toBeLessThan(400_000);
  });

  test("x-ray hover", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "panel=0&tray=0&toggle=0&glow=0.85&hover=hole:bp40&cam=52,92,104&target=38,6,0");
    expect(await shot(page, "xray-hover")).toBeLessThan(400_000);
  });

  test("smoking resistor", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=smoke&panel=0&tray=0&toggle=0&glow=0&health=R1:smoking,D1:dead,R2:dead&cam=-14,74,96&target=-8,14,4", 3500);
    expect(await shot(page, "smoking-resistor")).toBeLessThan(400_000);
  });

  test("LED lit and dead", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await open(page, "mode=gallery&row=1&cam=-72,60,96&target=-75,16,0");
    expect(await shot(page, "led-lit-dead")).toBeLessThan(400_000);
  });

  test("resistor bands", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await open(page, "mode=gallery&row=0&cam=-73,38,64&target=-75,9,0");
    expect(await shot(page, "resistor-bands")).toBeLessThan(400_000);
  });

  test("meter face", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, "panel=0&tray=0&toggle=0&display=-0.42&unit=V&cam=165,190,105&target=160,28,-4");
    expect(await shot(page, "meter-face")).toBeLessThan(400_000);
  });

  test("parts gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "mode=gallery&rows=0-3", 2200);
    expect(await shot(page, "gallery")).toBeLessThan(400_000);
  });

  test("clip leads without a board", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=clips&panel=0&toggle=0&glow=0.75&display=1.08&unit=k%CE%A9");
    expect(await shot(page, "clip-leads")).toBeLessThan(400_000);
  });

  test("lab props on the desk", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=props&panel=0&tray=0&toggle=0");
    expect(await shot(page, "lab-props")).toBeLessThan(400_000);
  });

  test("props gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "mode=gallery&rows=4-5");
    expect(await shot(page, "gallery-props")).toBeLessThan(400_000);
  });
});
