/// <reference types="node" />
// The soldering flow driven like a learner in both views (mouse, touch, keyboard), with screenshots into
// ../screenshots. Run with `pnpm --filter @ohmland/bench shots:solder`.

import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../screenshots");
mkdirSync(OUT, { recursive: true });

type Joint = { phase: string; tempC: number; volume: number; verdict: string | null };
type SolderWindow = Window & {
  __ready?: boolean;
  __bench: {
    getState: () => {
      bench: { parts: { id: string; kind: string; params: Record<string, unknown> }[] };
      station: { iron: { tipC: number }; joints: Record<string, Joint>; feed: string | null; heatView: boolean; quickMode: boolean } | null;
      snapshot: { parts: Record<string, { glow?: number }> } | null;
    };
    setState: (s: Record<string, unknown>) => void;
  };
  __controller: { current: { project: (a: string) => { x: number; y: number; visible: boolean } | null } };
};

type View = "ink" | "3d";

async function open(page: Page, view: View, query: string) {
  await page.goto(`/?view=${view}&panel=0&toggle=0&${query}`);
  await page.waitForFunction(() => (window as unknown as SolderWindow).__ready === true, null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(view === "3d" ? 1200 : 400);
}

const root = (view: View) => (view === "ink" ? ".ohi-root" : ".ohb-root");

/** Page coordinates of a target (anchors, `spot:` included) in the shown view. */
async function at(page: Page, view: View, target: string): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(
    ({ target, sel }) => {
      const w = window as unknown as SolderWindow;
      const r = document.querySelector(sel)!.getBoundingClientRect();
      const s = w.__controller.current.project(target);
      return s ? { x: s.x + r.left, y: s.y + r.top } : null;
    },
    { target, sel: root(view) },
  );
  if (!p) throw new Error(`cannot project ${target}`);
  return p;
}

const station = (page: Page) => page.evaluate(() => (window as unknown as SolderWindow).__bench.getState().station);
const record = (page: Page, board: string, pad: string) =>
  page.evaluate(
    ({ board, pad }) => {
      const b = (window as unknown as SolderWindow).__bench.getState().bench.parts.find((p) => p.id === board);
      return ((b?.params.joints as Record<string, { verdict: string }> | undefined) ?? {})[pad] ?? null;
    },
    { board, pad },
  );

async function shot(page: Page, name: string) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  try {
    execFileSync("magick", [path, "-strip", "-define", "png:compression-level=9", path]);
  } catch {
    // ImageMagick is optional.
  }
}

/** Drag the iron by its handle and rest its tip on a spot. */
async function ironTo(page: Page, view: View, spot: string) {
  const grip = await at(page, view, "spot:ST1.grip");
  const to = await at(page, view, `spot:${spot}`);
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
}

/** Solder the joint at a pad the way the lesson teaches it: heat the work, feed the hot work, lift, let it set. */
async function solderPad(page: Page, view: View, spot: string, opts: { feedMs?: number; snap?: string } = {}) {
  await ironTo(page, view, spot);
  await page.waitForFunction((s) => ((window as unknown as SolderWindow).__bench.getState().station?.joints[s]?.tempC ?? 0) > 235, spot, { timeout: 15_000 });
  const end = await at(page, view, "spot:SD1.end");
  const to = await at(page, view, `spot:${spot}`);
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  await page.mouse.move(to.x + 3, to.y - 3, { steps: 12 });
  await page.waitForTimeout(opts.feedMs ?? 1100);
  if (opts.snap) await shot(page, opts.snap);
  await page.mouse.up();
  await page.waitForTimeout(250);
  await ironTo(page, view, "ST1.stand");
  await page.waitForFunction(
    ({ s }) => {
      const st = (window as unknown as SolderWindow).__bench.getState();
      const dot = s.lastIndexOf(".");
      const b = st.bench.parts.find((p) => p.id === s.slice(0, dot));
      return !!((b?.params.joints as Record<string, unknown> | undefined) ?? {})[s.slice(dot + 1)] && st.station?.joints[s]?.phase !== "molten";
    },
    { s: spot },
    { timeout: 15_000 },
  );
}

for (const view of ["ink", "3d"] as const) {
  test.describe(`${view}: desktop`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("the bench at a glance", async ({ page }) => {
      await open(page, view, "scene=solder&joints=some");
      await shot(page, `solder-${view}-desktop`);
      await open(page, view, "scene=solder&top=1&joints=none");
      await shot(page, `solder-${view}-plan`);
    });

    test("solder a joint by hand: iron rests, solder fed, a good joint lights the lamp", async ({ page }) => {
      await open(page, view, "scene=solder&joints=none&heat=1");
      await solderPad(page, view, "PB1.A1", { snap: `solder-${view}-feeding` });
      for (const pad of ["A3", "C7"]) await solderPad(page, view, `PB1.${pad}`);
      await solderPad(page, view, "PB1.F8");
      for (const pad of ["A1", "A3", "C7", "F8"]) expect((await record(page, "PB1", pad))?.verdict).toBe("good");
      // The lamp lights through the joints: flip the board back to see it.
      await page.evaluate(() => {
        const w = window as unknown as SolderWindow;
        const s = w.__bench.getState() as unknown as { setParams: (id: string, p: Record<string, unknown>) => void };
        s.setParams("PB1", { flipped: false });
      });
      // A warm LED is a little dim; give it a moment to cool.
      await page.waitForTimeout(3000);
      const glow = await page.evaluate(() => (window as unknown as SolderWindow).__bench.getState().snapshot?.parts.D1?.glow ?? 0);
      expect(glow).toBeGreaterThan(0.5);
      await shot(page, `solder-${view}-lit`);
    });

    test("magnifier and tug", async ({ page }) => {
      await open(page, view, "scene=solder&joints=some");
      const p = await at(page, view, "spot:PB1.D3");
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(300);
      await expect(page.locator(".ohs-mag")).toBeVisible();
      await shot(page, `solder-${view}-magnifier`);
    });

    test("heat runs up a lead: the clip saves the lamp", async ({ page }) => {
      await open(page, view, "scene=heatsink&heat=1");
      await page.waitForTimeout(6000);
      await shot(page, `solder-${view}-heatsink`);
    });

    test("wire, heat-shrink and power from the wall", async ({ page }) => {
      await open(page, view, "scene=wires");
      await page.waitForTimeout(1500);
      await shot(page, `solder-${view}-wires`);
    });
  });

  test.describe(`${view}: phone`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("quick mode: press and hold a joint", async ({ page }) => {
      await open(page, view, "scene=solder&joints=none&quick=1");
      const p = await at(page, view, "spot:PB1.A1");
      // Hold for a few seconds with a touch: the iron rests, solder feeds once the work is hot.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
      await page.waitForFunction(() => ((window as unknown as SolderWindow).__bench.getState().station?.joints["PB1.A1"]?.volume ?? 0) > 1.5, null, { timeout: 15_000 });
      await shot(page, `solder-${view}-phone-quick`);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForFunction(() => {
        const b = (window as unknown as SolderWindow).__bench.getState().bench.parts.find((x) => x.id === "PB1");
        return !!((b?.params.joints as Record<string, unknown> | undefined) ?? {}).A1;
      }, null, { timeout: 15_000 });
      expect((await record(page, "PB1", "A1"))?.verdict).toBe("good");
      await shot(page, `solder-${view}-phone`);
    });
  });
}

test.describe("keyboard", () => {
  test.use({ viewport: { width: 1200, height: 800 } });

  test("Tab to a joint, I rests the iron, hold S to feed, I lifts it", async ({ page }) => {
    await open(page, "ink", "scene=solder&joints=none");
    await page.locator('[data-spot="PB1.A1"]').focus();
    await page.keyboard.press("i");
    await page.waitForFunction(() => ((window as unknown as SolderWindow).__bench.getState().station?.joints["PB1.A1"]?.tempC ?? 0) > 235, null, { timeout: 15_000 });
    await page.keyboard.down("s");
    await page.waitForTimeout(1100);
    await page.keyboard.up("s");
    await page.waitForTimeout(200);
    await page.keyboard.press("i");
    await page.waitForFunction(() => {
      const b = (window as unknown as SolderWindow).__bench.getState().bench.parts.find((x) => x.id === "PB1");
      return !!((b?.params.joints as Record<string, unknown> | undefined) ?? {}).A1;
    }, null, { timeout: 15_000 });
    expect((await record(page, "PB1", "A1"))?.verdict).toBe("good");
    expect((await station(page))?.joints).toBeTruthy();
  });
});
