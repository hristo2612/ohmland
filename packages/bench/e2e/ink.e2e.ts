/// <reference types="node" />
// Drives the 2D ink view in headless Chromium like a learner (mouse, touch, keyboard), then takes its screenshots
// into ../screenshots. Run with `pnpm --filter @ohmland/bench shots:ink`.

import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../screenshots");
mkdirSync(OUT, { recursive: true });

type Part = { id: string; kind: string; holes?: Record<string, string>; params: Record<string, unknown> };
type InkWindow = Window & {
  __ready?: boolean;
  __bench: {
    getState: () => {
      bench: { parts: Part[]; wires: unknown[]; leads: { id: string; a: { to: string | null }; b: { to: string | null } }[]; meter: { mode: string; probes: Record<string, { tip: { to: string | null }; socket: string | null }> } | null };
      ui: { xray: boolean; pressed: Record<string, boolean>; selection: { type: string; id: string } | null };
    };
  };
  __ink: { current: { project: (a: string) => { x: number; y: number; visible: boolean } | null; camera: () => { s: number }; focus: (t: string[], o?: { instant?: boolean }) => void } };
};

async function open(page: Page, query: string) {
  await page.goto(`/?view=ink&panel=0&${query}`);
  await page.waitForFunction(() => (window as unknown as InkWindow).__ready === true, null, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

const state = (page: Page) => page.evaluate(() => (window as unknown as InkWindow).__bench.getState().bench);
const uiState = (page: Page) => page.evaluate(() => (window as unknown as InkWindow).__bench.getState().ui);

/** Page coordinates of an anchor: project() answers relative to the bench element. */
async function at(page: Page, anchor: string): Promise<{ x: number; y: number }> {
  const p = await page.evaluate((a) => {
    const w = window as unknown as InkWindow;
    const r = document.querySelector(".ohi-root")!.getBoundingClientRect();
    const s = w.__ink.current.project(a);
    return s ? { x: s.x + r.left, y: s.y + r.top } : null;
  }, anchor);
  if (!p) throw new Error(`cannot project ${anchor}`);
  return p;
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

/** Save a screenshot. Flat ink drawings compress well as they are; a 256-colour palette would tint the paper. */
async function shot(page: Page, name: string) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  try {
    execFileSync("magick", [path, "-strip", "-define", "png:compression-level=9", path]);
  } catch {
    // ImageMagick is optional.
  }
  return statSync(path).size;
}

test.describe("interaction", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("place a resistor and an LED, wire, undo and redo", async ({ page }) => {
    await open(page, "scene=empty");
    const item = page.locator(".ohi-item").first();
    const box = (await item.boundingBox())!;
    await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, await at(page, "hole:e22"));
    let parts = await state(page).then((b) => b.parts);
    expect(parts).toHaveLength(1);
    expect(parts[0]!.kind).toBe("resistor");
    expect(Object.values(parts[0]!.holes ?? {})).toHaveLength(2);

    // Tap to arm, tap to place: the red LED.
    await page.getByRole("listitem", { name: /^LED, Red/ }).click();
    const target = await at(page, "hole:e30");
    await page.mouse.click(target.x, target.y);
    parts = await state(page).then((b) => b.parts);
    const led = parts.find((p) => p.kind === "led")!;
    expect(Object.values(led.holes ?? {}).sort()).toEqual(expect.arrayContaining([expect.stringMatching(/^[a-e]3[01]$/)]));

    // Stretch the resistor's b lead two holes further.
    const r = parts.find((p) => p.kind === "resistor")!;
    const bHole = r.holes!.b!;
    const col = Number(bHole.slice(1));
    await drag(page, await at(page, `hole:${bHole}`), await at(page, `hole:${bHole[0]}${col + 2}`));
    const stretched = (await state(page)).parts.find((p) => p.id === r.id)!;
    expect(stretched.holes!.b).toBe(`${bHole[0]}${col + 2}`);

    await page.getByRole("button", { name: "Wire", exact: true }).click();
    const a = await at(page, "hole:a40");
    const b = await at(page, "hole:bp41");
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
    expect((await state(page)).wires).toHaveLength(1);
    await page.keyboard.press("Control+z");
    expect((await state(page)).wires).toHaveLength(0);
    await page.keyboard.press("Control+Shift+z");
    expect((await state(page)).wires).toHaveLength(1);
  });

  test("unclip and clip a test lead, move a probe, turn the dial", async ({ page }) => {
    await open(page, "scene=glow&tray=0");
    // Pull the black clip off the LED's cathode onto bare desk, then put it back.
    const clip = await at(page, "lead:TL3.a");
    await drag(page, clip, { x: clip.x + 60, y: clip.y + 140 });
    let leads = (await state(page)).leads;
    expect(leads.find((l) => l.id === "TL3")!.a.to).toBeNull();
    await drag(page, await at(page, "lead:TL3.a"), await at(page, "pin:D1.cathode"));
    leads = (await state(page)).leads;
    expect(leads.find((l) => l.id === "TL3")!.a.to).toBe("pin:D1.cathode");

    await open(page, "tray=0");
    await page.evaluate(() => (window as unknown as InkWindow).__ink.current.focus(["R1", "D1"], { instant: true }));
    await page.waitForTimeout(100);
    await drag(page, await at(page, "probe:red"), await at(page, "pin:R1.a"));
    expect((await state(page)).meter!.probes.red!.tip.to).toBe("pin:R1.a");

    await page.evaluate(() => (window as unknown as InkWindow).__ink.current.focus(["part:M1/dialFace"], { instant: true }));
    await page.waitForTimeout(100);
    const knob = await at(page, "part:M1/dial");
    await page.mouse.click(knob.x, knob.y);
    expect((await state(page)).meter!.mode).toBe("acv");
  });

  test("flip a switch, press a button, set a moisture tab", async ({ page }) => {
    await open(page, "scene=blocks&tray=0");
    const flip = await page.evaluate(() => {
      const w = window as unknown as InkWindow;
      const r = document.querySelector(".ohi-root")!.getBoundingClientRect();
      const p = w.__ink.current.project("part:S1");
      return { x: p!.x + r.left, y: p!.y + r.top - 5.5 * w.__ink.current.camera().s };
    });
    const before = (await state(page)).parts.find((p) => p.id === "S1")!.params.to;
    await page.mouse.click(flip.x, flip.y);
    expect((await state(page)).parts.find((p) => p.id === "S1")!.params.to).not.toBe(before);

    const button = await page.evaluate(() => {
      const w = window as unknown as InkWindow;
      const r = document.querySelector(".ohi-root")!.getBoundingClientRect();
      const p = w.__ink.current.project("part:S3");
      return { x: p!.x + r.left, y: p!.y + r.top - 5.5 * w.__ink.current.camera().s };
    });
    await page.mouse.move(button.x, button.y);
    await page.mouse.down();
    expect((await uiState(page)).pressed.S3).toBe(true);
    await page.mouse.up();
    expect((await uiState(page)).pressed.S3).toBe(false);

    await open(page, "scene=props&tray=0");
    await page.evaluate(() => (window as unknown as InkWindow).__ink.current.focus(["P1"], { instant: true }));
    await page.waitForTimeout(100);
    await page.getByText("DRY", { exact: true }).click();
    expect((await state(page)).parts.find((p) => p.id === "P1")!.params.moisture).toBe("dry");
  });

  test("keyboard: x-ray, walk the cursor, carry a clip to a new lead", async ({ page }) => {
    await open(page, "scene=glow&tray=0");
    await page.locator(".ohi-root").focus();
    await page.keyboard.press("x");
    // No board in this scene: x-ray stays off.
    expect((await uiState(page)).xray).toBe(false);
    await page.locator('[data-kb="clip:TL2.b"]').focus();
    await page.keyboard.press("Enter");
    // The cursor starts on the LED's anode; the cathode is just above it on the page.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    const leads = (await state(page)).leads;
    expect(leads.find((l) => l.id === "TL2")!.b.to).toBe("pin:D1.cathode");
    await page.keyboard.press("Control+z");
    expect((await state(page)).leads.find((l) => l.id === "TL2")!.b.to).toBe("pin:D1.anode");

    await open(page, "tray=0");
    await page.locator(".ohi-root").focus();
    await page.keyboard.press("x");
    expect((await uiState(page)).xray).toBe(true);
    await page.locator('[data-kb="part:R1"]').focus();
    expect((await uiState(page)).selection).toEqual({ type: "part", id: "R1" });
    await page.keyboard.press("ArrowRight");
    const r1 = (await state(page)).parts.find((p) => p.id === "R1")!;
    expect(r1.holes).toEqual({ a: "e11", b: "e15" });
  });

  test("touch: two fingers zoom, one finger pans", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await open(page, "tray=0");
    const s0 = await page.evaluate(() => (window as unknown as InkWindow).__ink.current.camera().s);
    await page.evaluate(async () => {
      const el = document.querySelector(".ohi-root")!;
      const fire = (type: string, id: number, x: number, y: number) =>
        el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
      fire("pointerdown", 1, 150, 300);
      fire("pointerdown", 2, 240, 300);
      for (let i = 1; i <= 10; i++) {
        fire("pointermove", 1, 150 - i * 6, 300);
        fire("pointermove", 2, 240 + i * 6, 300);
        await new Promise((r) => requestAnimationFrame(r));
      }
      fire("pointerup", 1, 90, 300);
      fire("pointerup", 2, 300, 300);
    });
    const s1 = await page.evaluate(() => (window as unknown as InkWindow).__ink.current.camera().s);
    expect(s1 / s0).toBeGreaterThan(1.8);
    await ctx.close();
  });
});

test.describe("screenshots", () => {
  test("desktop light and dark", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "glow=0.85");
    expect(await shot(page, "ink-desktop")).toBeLessThan(500_000);
    await open(page, "glow=0.85&theme=dark");
    expect(await shot(page, "ink-desktop-dark")).toBeLessThan(500_000);
  });

  test("phone light and dark", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await open(page, "glow=0.85&select=D1");
    expect(await shot(page, "ink-phone")).toBeLessThan(500_000);
    await open(page, "glow=0.85&theme=dark&scene=glow&tray=0");
    expect(await shot(page, "ink-phone-dark")).toBeLessThan(500_000);
    await ctx.close();
  });

  test("first glow on the desk", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=glow&tray=0&glow=0.8");
    expect(await shot(page, "ink-glow")).toBeLessThan(500_000);
  });

  test("x-ray", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "tray=0&glow=0.85&xray=1&hover=hole:c14&focus=board");
    expect(await shot(page, "ink-xray")).toBeLessThan(500_000);
  });

  test("a fried LED and a smoking resistor", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=smoke&tray=0&glow=0&health=R1:smoking,D1:dead,R2:dead&focus=R1,D1,R2");
    expect(await shot(page, "ink-fried")).toBeLessThan(500_000);
  });

  test("meter close-up", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, "tray=0&display=-0.42&unit=V&focus=M1");
    expect(await shot(page, "ink-meter")).toBeLessThan(500_000);
  });

  test("spotlight", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "tray=0&glow=0.85&focus=R1,D1&spot=R1");
    expect(await shot(page, "ink-spotlight")).toBeLessThan(500_000);
  });

  test("lab props and desk modules", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "scene=props&tray=0&t=5400&inspect=heat:R5");
    expect(await shot(page, "ink-props")).toBeLessThan(500_000);
    await open(page, "scene=blocks&tray=0&closed=1");
    expect(await shot(page, "ink-blocks")).toBeLessThan(500_000);
  });

  test("3D and ink side by side", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?view=split&panel=0&tray=0&glow=0.85&scene=glow");
    await page.waitForFunction(() => (window as unknown as InkWindow).__ready === true, null, { timeout: 30_000 });
    await page.waitForTimeout(2500);
    expect(await shot(page, "ink-split")).toBeLessThan(600_000);
  });
});
