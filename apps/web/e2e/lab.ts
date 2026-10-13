import { expect, type Page } from "@playwright/test";

/**
 * Helpers that drive the 3D bench like a learner: they ask the page where things are on screen (window.ohmlandLab,
 * a hook the lab step installs) and then click and drag with the mouse.
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

/** Screen point of a bench anchor ("pin:S1.b") or a world point [x, y, z] in millimetres. */
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
}

/** Waits for a lab task to show as done in the task list. */
export async function taskDone(page: Page, id: string) {
  await expect(page.locator(`[data-task="${id}"]`)).toHaveAttribute("data-state", "done", { timeout: 10_000 });
}

/** Flips a toggle switch on its wooden block by clicking the lever. */
export async function flipBlockSwitch(page: Page, id: string) {
  const part = (await bench(page)).parts.find((p) => p.id === id)!;
  // The lever stands about 24 mm above the desk, 5.5 mm behind the block's centre.
  await page.mouse.click(...xy(await project(page, [part.pos[0], 24, part.pos[1] - 5.5])));
}

/** Drags one clip of a test lead off whatever it holds and drops it on the desk, a little toward the viewer. */
export async function unclip(page: Page, lead: string, end: "a" | "b") {
  const l = (await bench(page)).leads.find((x) => x.id === lead)!;
  const from = await project(page, l[end].to!);
  await drag(page, { x: from.x + 8, y: from.y + 2 }, { x: from.x + 40, y: from.y + 110 });
}

/** Drags a clip of a test lead (attached or lying loose) onto an anchor. */
export async function clipTo(page: Page, lead: string, end: "a" | "b", anchor: string) {
  const l = (await bench(page)).leads.find((x) => x.id === lead)!;
  const e = l[end];
  const from = e.to ? await project(page, e.to) : await project(page, [e.pos[0], 4, e.pos[1]]);
  await drag(page, from, await project(page, anchor));
}

/** Drags a clip lead out of the tray so its first clip lands on `anchor`. Returns the new lead's id. */
export async function leadFromTray(page: Page, color: string, anchor: string): Promise<string> {
  const before = new Set((await bench(page)).leads.map((l) => l.id));
  const box = (await page.locator(".ohb-tray .ohb-item", { hasText: color }).first().boundingBox())!;
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, await project(page, anchor));
  const id = (await bench(page)).leads.find((l) => !before.has(l.id))?.id;
  if (!id) throw new Error(`No ${color} lead came out of the tray`);
  return id;
}

/** welcome-to-the-bench: flip the switch, unclip a lead, clip it back. */
export async function playWelcomeLab(page: Page) {
  await benchReady(page);
  await flipBlockSwitch(page, "S1");
  await taskDone(page, "close-the-switch");
  await unclip(page, "TL2", "a");
  await taskDone(page, "break-the-loop");
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await taskDone(page, "mend-the-loop");
}

const xy = (p: Point): [number, number] => [p.x, p.y];
