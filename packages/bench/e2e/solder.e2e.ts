/// <reference types="node" />
// The soldering flow driven like a learner in both views, in four paths: a first lamp board with a mouse, the braid,
// a phone with a finger, and the keyboard alone. Screenshots go into ../screenshots. The station's physics is covered
// by test/solder-*.test.ts; these check that the overlay's hands-on part works. Run with
// `pnpm --filter @ohmland/bench shots:solder`.

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

const record = (page: Page, board: string, pad: string) =>
  page.evaluate(
    ({ board, pad }) => {
      const b = (window as unknown as SolderWindow).__bench.getState().bench.parts.find((p) => p.id === board);
      return ((b?.params.joints as Record<string, { verdict: string }> | undefined) ?? {})[pad] ?? null;
    },
    { board, pad },
  );

/** Save a screenshot: 3D shots quantised to 256 colours (as the other bench shots), flat ink drawings as they are. */
async function shot(page: Page, name: string) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  try {
    if (name.includes("-3d-")) execFileSync("magick", [path, "-strip", "-dither", "None", "-colors", "256", "-define", "png:compression-level=9", `PNG8:${path}`]);
    else execFileSync("magick", [path, "-strip", "-define", "png:compression-level=9", path]);
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
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(opts.feedMs ?? 1100);
  if (opts.snap) await shot(page, opts.snap);
  await page.mouse.up();
  await page.waitForTimeout(250);
  await ironTo(page, view, "ST1.stand");
  await waitSet(page, spot);
}

/** Wait until the joint at a spot has set and gone into the bench. */
async function waitSet(page: Page, spot: string) {
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

/** Where the iron is now ("stand", a spot or "desk"), the braid's joint, and the scorch marks on the desk. */
const looks = (page: Page) =>
  page.evaluate(() => {
    const st = (window as unknown as SolderWindow).__bench.getState();
    const station = st.station as unknown as { braid?: string | null; scorch?: unknown[]; iron: { bead?: number } } | null;
    return {
      iron: String(st.bench.parts.find((p) => p.id === "ST1")?.params.iron ?? "stand"),
      braid: station?.braid ?? null,
      scorch: (station?.scorch ?? []).length,
      bead: station?.iron.bead ?? 0,
    };
  });

/** A drag that ends with a finger lifted (CDP touch) or a mouse button let go, holding `holdMs` at the end. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, touch: boolean, holdMs = 0) {
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= 12; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 }] });
    if (holdMs) await page.waitForTimeout(holdMs);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 14 });
    if (holdMs) await page.waitForTimeout(holdMs);
    await page.mouse.up();
  }
  await page.waitForTimeout(250);
}

/**
 * Put the iron down on the bare desk behind the station, where no spot is under the pointer (the drop must still land
 * once the grip under the hand has gone: f1bce9f): it scorches the paper, then slides home.
 */
async function dropOnDesk(page: Page, view: View, touch: boolean) {
  const grip = await at(page, view, "spot:ST1.grip");
  const stand = await at(page, view, "spot:ST1.stand");
  await swipe(page, grip, { x: stand.x - 40, y: stand.y - 130 }, touch);
  expect((await looks(page)).iron).toBe("desk");
  await page.waitForFunction(() => (window as unknown as SolderWindow).__bench.getState().bench.parts.find((p) => p.id === "ST1")?.params.iron === "stand", null, { timeout: 15_000 });
  expect((await looks(page)).scorch).toBeGreaterThan(0);
}

/**
 * Lay the braid on a joint, then pick its end up again and put it down on the bare desk: it comes off the joint
 * (2fa87f4), so fresh solder stays where it is fed.
 */
async function braidOnAndOff(page: Page, view: View, spot: string, touch: boolean) {
  const end = await at(page, view, "spot:BR1.end");
  await swipe(page, end, await at(page, view, `spot:${spot}`), touch);
  expect((await looks(page)).braid).toBe(spot);
  await swipe(page, end, { x: end.x + 30, y: end.y + 80 }, touch);
  expect((await looks(page)).braid).toBeNull();
}

// 1. The learner's first joints, both views, with a mouse: tin the tip, solder four pads (the lamp lights), look at a
//    joint under the magnifier, and put the iron down on the desk.
test("tin the tip, solder a lamp board and look at a joint, in both views", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const view of ["ink", "3d"] as const) {
    await open(page, view, "scene=solder&joints=some");
    await shot(page, `solder-${view}-desktop`);
    const p = await at(page, view, "spot:PB1.D3");
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(300);
    await expect(page.locator(".ohs-mag")).toBeVisible();
    await shot(page, `solder-${view}-magnifier`);
    await open(page, view, "scene=solder&top=1&joints=none");
    await shot(page, `solder-${view}-plan`);
    await open(page, view, "scene=solder&joints=none&heat=1");
    // Solder on the tip in its stand tins it.
    await swipe(page, await at(page, view, "spot:SD1.end"), await at(page, view, "spot:ST1.tip"), false, 600);
    expect((await looks(page)).bead).toBeGreaterThan(0);
    // Wiped in the brass wool, the tip keeps its coat but carries no bead to the work.
    await ironTo(page, view, "ST1.wool");
    expect((await looks(page)).bead).toBe(0);
    await solderPad(page, view, "PB1.A1", { snap: `solder-${view}-feeding` });
    for (const pad of ["A3", "C7", "F8"]) await solderPad(page, view, `PB1.${pad}`);
    for (const pad of ["A1", "A3", "C7", "F8"]) expect((await record(page, "PB1", pad))?.verdict).toBe("good");
    await dropOnDesk(page, view, false);
    // The lamp lights through the joints: flip the board back to see it (a warm LED is a little dim at first).
    await page.evaluate(() => {
      const s = (window as unknown as SolderWindow).__bench.getState() as unknown as { setParams: (id: string, p: Record<string, unknown>) => void };
      s.setParams("PB1", { flipped: false });
    });
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => (window as unknown as SolderWindow).__bench.getState().snapshot?.parts.D1?.glow ?? 0)).toBeGreaterThan(0.5);
    await shot(page, `solder-${view}-lit`);
  }
});

// 2. Too much solder, both views: the braid wicks a ball away, then comes off the joint so a touch of fresh solder
//    stays. Plus the other Unit 3 benches at a glance.
test("wick a ball with the braid, lift the braid, add a touch, in both views", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const view of ["ink", "3d"] as const) {
    await open(page, view, "scene=solder&joints=some");
    // A3 is a ball: braid on it, the iron on the braid for a second.
    const end = await at(page, view, "spot:BR1.end");
    await swipe(page, end, await at(page, view, "spot:PB1.A3"), false);
    await ironTo(page, view, "PB1.A3");
    await page.waitForTimeout(1000);
    await ironTo(page, view, "ST1.stand");
    await waitSet(page, "PB1.A3");
    expect(["good", "too-little"]).toContain((await record(page, "PB1", "A3"))?.verdict);
    // Lifted off, fresh solder stays on the joint.
    await swipe(page, end, { x: end.x + 30, y: end.y + 80 }, false);
    expect((await looks(page)).braid).toBeNull();
    await solderPad(page, view, "PB1.A3", { feedMs: 300 });
    expect((await record(page, "PB1", "A3"))?.verdict).toBe("good");
    await open(page, view, "scene=heatsink&heat=1");
    await page.waitForTimeout(6000);
    await shot(page, `solder-${view}-heatsink`);
    await open(page, view, "scene=wires");
    await page.waitForTimeout(1500);
    await shot(page, `solder-${view}-wires`);
  }
});

// 3. A phone, both views, with a finger: quick mode solders a joint by pressing and holding it; the iron put down on
//    the bare desk lands there; the braid laid on a joint and dragged away comes off.
test("on a phone, a finger solders in quick mode, puts the iron down and lifts the braid, in both views", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  for (const view of ["ink", "3d"] as const) {
    // A lesson frames the board on a phone; quick mode needs only the joint.
    await open(page, view, "scene=solder&joints=none&quick=1&focus=part:PB1");
    const p = await at(page, view, "spot:PB1.A1");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
    await page.waitForFunction(() => ((window as unknown as SolderWindow).__bench.getState().station?.joints["PB1.A1"]?.volume ?? 0) > 1.5, null, { timeout: 15_000 });
    await shot(page, `solder-${view}-phone-quick`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await waitSet(page, "PB1.A1");
    expect((await record(page, "PB1", "A1"))?.verdict).toBe("good");
    await shot(page, `solder-${view}-phone`);
    await open(page, view, "scene=solder&joints=some&focus=part:ST1");
    await dropOnDesk(page, view, true);
    await open(page, view, "scene=solder&joints=some&focus=part:PB1,part:BR1");
    await braidOnAndOff(page, view, "PB1.A3", true);
  }
  await context.close();
});

// 4. The keyboard alone: Tab to a joint, I rests the iron, hold S to feed, I lifts it.
test("with the keyboard, Tab to a joint, I rests the iron, hold S to feed, I lifts it", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page, "ink", "scene=solder&joints=none");
  await page.locator('[data-spot="PB1.A1"]').focus();
  await page.keyboard.press("i");
  await page.waitForFunction(() => ((window as unknown as SolderWindow).__bench.getState().station?.joints["PB1.A1"]?.tempC ?? 0) > 235, null, { timeout: 15_000 });
  await page.keyboard.down("s");
  await page.waitForTimeout(1100);
  await page.keyboard.up("s");
  await page.waitForTimeout(200);
  await page.keyboard.press("i");
  await waitSet(page, "PB1.A1");
  expect((await record(page, "PB1", "A1"))?.verdict).toBe("good");
});
