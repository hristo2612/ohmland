import { expect, type Page } from "@playwright/test";

/**
 * Helpers that drive the bench like a learner: they ask the page where things are on screen (window.ohmlandLab,
 * a hook the bench installs) and then click and drag with the mouse. Bench lessons add the moment helpers below.
 */

type Point = { x: number; y: number };
type LeadEnd = { to: string | null; pos: [number, number] };
type Bench = {
  parts: { id: string; pos: [number, number] }[];
  leads: { id: string; a: LeadEnd; b: LeadEnd }[];
};

export async function benchReady(page: Page) {
  await expect(page.locator("[data-lab-ready]")).toBeVisible();
  await expect(page.locator("[data-bench-ready]")).toBeAttached({ timeout: 30_000 });
}

/** Screen point of a bench anchor ("pin:S1.b", "part:D1", "hole:c7") or a world point [x, y, z] in millimetres. */
export async function project(page: Page, target: string | [number, number, number]): Promise<Point> {
  const p = await page.evaluate((t) => window.ohmlandLab?.project(t as never) ?? null, target);
  if (!p) throw new Error(`Nothing on screen at ${JSON.stringify(target)}`);
  return p;
}

export const bench = (page: Page) => page.evaluate(() => window.ohmlandLab!.bench() as unknown) as Promise<Bench>;

export async function drag(page: Page, from: Point, to: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 14, from.y + ((to.y - from.y) * i) / 14);
  await page.mouse.up();
  await page.waitForTimeout(150);
}

/** Waits for a lab task to be done (the runtime's own status, the same for every lesson format). */
export async function taskDone(page: Page, id: string) {
  await expect.poll(() => page.evaluate((t) => window.ohmlandLab?.status()[t] ?? null, id), { timeout: 15_000 }).toBe("done");
}

/** Flips a toggle switch on its wooden block by clicking the lever. */
export async function flipBlockSwitch(page: Page, id: string) {
  const part = (await bench(page)).parts.find((p) => p.id === id)!;
  // The lever stands about 24 mm above the desk, 5.5 mm behind the block's centre.
  await page.mouse.click(...xy(await project(page, [part.pos[0], 24, part.pos[1] - 5.5])));
}

/** On a narrow screen an LED's legs are a few pixels apart: there clips move through the lab hook, as a solution step. */
const fine = (page: Page) => (page.viewportSize()?.width ?? 1000) < 600;

/** Where to grab one clip of a lead: on its jaws, a few pixels along the lead, so a clip on the next leg stays put. */
async function grabPoint(page: Page, lead: string, end: "a" | "b"): Promise<Point> {
  const l = (await bench(page)).leads.find((x) => x.id === lead)!;
  const e = l[end];
  const o = l[end === "a" ? "b" : "a"];
  const p = e.to ? await project(page, e.to) : await project(page, [e.pos[0], 4, e.pos[1]]);
  if (!e.to) return p;
  const q = o.to ? await project(page, o.to) : await project(page, [o.pos[0], 4, o.pos[1]]);
  const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: p.x + ((q.x - p.x) / d) * 5, y: p.y + ((q.y - p.y) / d) * 5 };
}

/** Drags one clip of a test lead off whatever it holds and drops it on the desk. */
export async function unclip(page: Page, lead: string, end: "a" | "b") {
  if (fine(page)) return stepOnBench(page, { do: "clip", lead, end, to: null });
  const from = await grabPoint(page, lead, end);
  await drag(page, from, { x: from.x + 30, y: from.y + 90 });
}

/** Drags a clip of a test lead (attached or lying loose) onto an anchor. */
export async function clipTo(page: Page, lead: string, end: "a" | "b", anchor: string) {
  if (fine(page)) return stepOnBench(page, { do: "clip", lead, end, to: anchor });
  await drag(page, await grabPoint(page, lead, end), await project(page, anchor));
}

/** Swaps the clips on two neighbouring points (an LED's legs): one comes off first, as a careful learner would. */
export async function swapClips(page: Page, a: [string, "a" | "b", string], b: [string, "a" | "b", string]) {
  await unclip(page, b[0], b[1]);
  await clipTo(page, a[0], a[1], b[2]);
  await clipTo(page, b[0], b[1], a[2]);
}

async function stepOnBench(page: Page, step: unknown) {
  await page.evaluate((s) => window.ohmlandLab!.step!(s), step);
  await page.waitForTimeout(150);
}

/** Drags a clip lead out of the tray so its b clip lands on `anchor`. Returns the new lead's id. */
export async function leadFromTray(page: Page, color: string, anchor: string): Promise<string> {
  const before = new Set((await bench(page)).leads.map((l) => l.id));
  const box = (await page.locator(".ohb-tray .ohb-item", { hasText: color }).first().boundingBox())!;
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, await project(page, anchor));
  const id = (await bench(page)).leads.find((l) => !before.has(l.id))?.id;
  if (!id) throw new Error(`No ${color} lead came out of the tray`);
  return id;
}

// ---- Bench lessons --------------------------------------------------------------------------------------------------

/** Waits for a moment of a bench lesson ("b0" ... "fix0", "secret", "end"), optionally in a phase. */
export async function atMoment(page: Page, key: string, phase?: "guess" | "act" | "done") {
  await expect(page.locator(`.bl[data-moment="${key}"]${phase ? `[data-phase="${phase}"]` : ""}`)).toBeAttached({ timeout: 20_000 });
}

/** Taps a breadboard hole on the bench (the lesson's hole layer picks the nearest one). */
export async function tapHole(page: Page, hole: string) {
  await page.mouse.click(...xy(await project(page, `hole:${hole}`)));
}

const xy = (p: Point): [number, number] => [p.x, p.y];
