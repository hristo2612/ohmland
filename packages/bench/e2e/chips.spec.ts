/// <reference types="node" />
// Unit 4 parts in both views: the 3D gallery rows, every part on one bench (3D and ink), the counting demo run by
// the real simulator (a 555 blinking an LED and clocking a 4026B into a 7-segment display), close-ups with pin
// numbers, and two interaction checks (a chip turned round, a DIP switch flipped).
//   BENCH_PORT=5471 pnpm exec playwright test -c e2e/playwright.config.ts chips

import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../screenshots");
mkdirSync(OUT, { recursive: true });

type BenchWindow = Window & {
  __ready?: boolean;
  __bench: { getState: () => { bench: { parts: { id: string; kind: string; rot: number; holes?: Record<string, string>; params: Record<string, unknown> }[] } } };
  __controller: {
    current: {
      project: (a: string) => { x: number; y: number; visible: boolean } | null;
      focus: (t: string[], o?: { instant?: boolean }) => void;
      spotlight: (t: string[] | null) => void;
      /** The active view's own controller (in 3D it also projects world points). */
      inner: () => { project: (a: string | [number, number, number]) => { x: number; y: number; visible: boolean } | null };
    };
  };
};

async function open(page: Page, query: string, settle = 1600, tray = false) {
  await page.goto(`/?panel=0&toggle=0&${tray ? "" : "tray=0&"}${query}`);
  await page.waitForFunction(() => (window as unknown as BenchWindow).__ready === true, null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
}

/** Save a screenshot; quantised with ImageMagick when it is there (3D) or just recompressed (ink). */
async function shot(page: Page, name: string, quantise = true) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  try {
    if (quantise) execFileSync("magick", [path, "-strip", "-dither", "None", "-colors", "256", "-define", "png:compression-level=9", `PNG8:${path}`]);
    else execFileSync("magick", [path, "-strip", "-define", "png:compression-level=9", path]);
  } catch {
    // ImageMagick is optional.
  }
  return statSync(path).size;
}

const LOOK = "segs=DS1:abcdg;DS2:bc.&temp=U2:150,U3:95,VR1:105&health=U2:smoking&probe=LP1:H";
const DEMO = "scene=chips&sim=1&simAt=4.3&simrun=0";

test.describe("Unit 4 parts", () => {
  test("3D gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "mode=gallery&rows=6-9", 2600);
    expect(await shot(page, "chips-gallery")).toBeLessThan(500_000);
  });

  // Close-ups from the gallery rows (6 chips, 7 sockets, displays and DIP switches, 8 the 7805, 1N4148 and the probe,
  // 9 packs and the supply), framed by `focus` (the item's index in its row).
  for (const [name, query] of [
    ["chips-555", "row=6&focus=0"],
    ["chips-burnt", "row=6&focus=6"],
    ["chips-carrier", "row=7&focus=4"],
    ["chips-dip-switch", "row=7&focus=5"],
    ["chips-heatsink", "row=8&focus=1"],
    ["chips-probe", "row=8&focus=3"],
    ["chips-supply", "row=9&focus=2"],
  ] as const) {
    test(`3D close-up: ${name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await open(page, `mode=gallery&${query}`, 2400);
      expect(await shot(page, name)).toBeLessThan(500_000);
    });
  }

  test("every part on one bench, 3D", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, `scene=chipparts&${LOOK}`, 3000);
    expect(await shot(page, "chips-parts-3d")).toBeLessThan(600_000);
  });

  test("every part on one bench, ink", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, `scene=chipparts&view=ink&${LOOK}`);
    expect(await shot(page, "chips-parts-ink", false)).toBeLessThan(600_000);
  });

  test("the counting demo, 3D", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, DEMO, 3000);
    expect(await shot(page, "chips-demo-3d")).toBeLessThan(600_000);
  });

  test("the counting demo, ink", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, `${DEMO}&view=ink`);
    expect(await shot(page, "chips-demo-ink", false)).toBeLessThan(600_000);
  });

  test("close-up with pin numbers, ink", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await open(page, `${DEMO}&view=ink&focus=part:U1,part:U2,part:DS1&spot=part:U1,part:DS1`);
    expect(await shot(page, "chips-pins-ink", false)).toBeLessThan(600_000);
  });

  test("the chip tray, both views", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=chips&view=ink", 1200, true);
    expect(await shot(page, "chips-tray-ink", false)).toBeLessThan(600_000);
    await open(page, "scene=chips", 2500, true);
    expect(await shot(page, "chips-tray-3d")).toBeLessThan(600_000);
  });

  test("close-up with pin numbers, 3D", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await open(page, `${DEMO}&focus=part:U1&spot=part:U1`, 3000);
    expect(await shot(page, "chips-pins-3d")).toBeLessThan(600_000);
  });
});

test.describe("Unit 4 interaction", () => {
  test("R turns a chip round on the board; a DIP switch slider flips its switch", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const view of ["ink", "3d"]) {
      await open(page, `scene=chipparts&view=${view}`, view === "3d" ? 2500 : 400);
      const u3 = await page.evaluate(() => (window as unknown as BenchWindow).__controller.current.project("part:U3"));
      expect(u3?.visible).toBe(true);
      await page.mouse.click(u3!.x, u3!.y);
      const sel = await page.evaluate(() => (window as unknown as { __bench: { getState: () => { ui: { selection: { id: string } | null } } } }).__bench.getState().ui.selection);
      expect(sel?.id, view).toBe("U3");
      await page.focus(view === "3d" ? ".ohb-root" : ".ohi-root");
      await page.keyboard.press("r");
      const chip = await page.evaluate(() => (window as unknown as BenchWindow).__bench.getState().bench.parts.find((p) => p.id === "U3")!);
      expect(chip.rot, view).toBe(180);
      expect(chip.holes?.["1"], view).toBe("f32");
      // DIP1's switch 4 (off) sits on top of the body over pin 4's column (e53), midway between the rows.
      const slider = await page.evaluate((v) => {
        const c = (window as unknown as BenchWindow).__controller.current;
        if (v === "3d") return c.inner().project([(53 - 32) * 2.54, 8.5 + 5, 0]);
        const p4 = c.project("pin:DIP1.4")!;
        const p13 = c.project("pin:DIP1.13")!;
        return { x: (p4.x + p13.x) / 2, y: (p4.y + p13.y) / 2, visible: true };
      }, view);
      await page.mouse.click(slider!.x, slider!.y);
      const dip = await page.evaluate(() => (window as unknown as BenchWindow).__bench.getState().bench.parts.find((p) => p.id === "DIP1")!);
      expect(dip.params["s4"], view).toBe(true);
    }
  });
});
