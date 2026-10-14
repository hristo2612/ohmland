import { expect, test, type Page } from "@playwright/test";
import { atMoment, bench, benchReady, clipTo, flipBlockSwitch, project, taskDone } from "./lab";

type Point = { x: number; y: number };

/**
 * A finger drag, as real touch events (the bench sees pointerType "touch"). `before` runs with the finger still down
 * at the end point and may return a point to slide the finger on to before it lifts (a learner reading the loupe).
 */
async function touchDrag(page: Page, from: Point, to: Point, before?: () => Promise<Point | void>, lifting?: () => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  const at = (p: Point) => [{ x: Math.round(p.x), y: Math.round(p.y) }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(from) });
  for (let i = 1; i <= 16; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / 16, y: from.y + ((to.y - from.y) * i) / 16 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(p) });
  }
  await page.waitForTimeout(200);
  const next = await before?.();
  if (next) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(next) });
    await page.waitForTimeout(200);
  }
  await lifting?.();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);
  await cdp.detach();
}

/** The point nearest a clip's tip where a finger picks that clip up (clips on two legs side by side overlap). */
async function onClip(page: Page, lead: string, end: "a" | "b"): Promise<Point> {
  const tip = await project(page, `lead:${lead}.${end}`);
  const found = await page.evaluate(
    ({ tip, lead, end }) => {
      let best: { x: number; y: number } | null = null;
      for (let r = 4; r <= 40 && !best; r += 4)
        for (let a = 0; a < 16 && !best; a++) {
          const x = tip.x + r * Math.cos((a / 16) * Math.PI * 2);
          const y = tip.y + r * Math.sin((a / 16) * Math.PI * 2);
          const p = window.ohmlandLab!.pickAt!(x, y) as { type?: string; id?: string; end?: string } | null;
          if (p?.type === "clip" && p.id === lead && p.end === end) best = { x, y };
        }
      return best;
    },
    { tip, lead, end },
  );
  if (!found) throw new Error(`No grip on ${lead}.${end}`);
  return found;
}

test("a phone frames the lamp's legs to aim at, and a finger clips a lead onto the long leg through the loupe", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch, on a phone");
  await page.goto("/learn/start-here/welcome-to-the-bench");
  await page.locator("[data-primary]").first().click();
  await benchReady(page);

  // To the beat that breaks the loop: switch on, find the gap, guess.
  await atMoment(page, "b0", "act");
  await flipBlockSwitch(page, "S1");
  await taskDone(page, "close-the-switch");
  await atMoment(page, "b1", "act");
  await page.locator('[data-tap="B1.neg"]').click();
  await atMoment(page, "b1", "done");
  await page.locator("[data-primary]").first().click();
  await atMoment(page, "b2", "act");
  await clipTo(page, "TL1", "a", "pin:B1.pos");
  await taskDone(page, "find-the-gap");
  await atMoment(page, "b2", "done");
  await page.locator("[data-primary]").first().click();
  await atMoment(page, "b3", "guess");
  await page.locator("[data-guess='2']").click();
  await atMoment(page, "b3", "act");
  await page.waitForTimeout(600);

  // The whole job stays in view: the lamp and the far end of the lead the hint points at (its battery clip).
  for (const t of ["part:D1", "lead:TL4.b"]) expect((await page.evaluate((x) => window.ohmlandLab!.project(x), t))).not.toBeNull();

  // Unclip the green lead from the long leg: drop it on the empty desk.
  const grab = await onClip(page, "TL3", "b");
  await touchDrag(page, grab, { x: grab.x - 60, y: grab.y + 110 });
  expect((await bench(page)).leads.find((l) => l.id === "TL3")?.b.to).toBeNull();
  await taskDone(page, "break-the-loop");
  await atMoment(page, "b3", "done");
  await page.locator("[data-primary]").first().click();
  await atMoment(page, "b4", "act");
  await page.waitForTimeout(600);

  // Clip it back, the finger landing 6 px off the long leg toward the short one. The loupe names where it would land
  // before the finger lifts; a learner who reads "short leg" there slides back toward the long leg.
  const a = await project(page, "pin:D1.anode");
  const k = await project(page, "pin:D1.cathode");
  const d = Math.hypot(k.x - a.x, k.y - a.y) || 1;
  const drop = { x: a.x + ((k.x - a.x) / d) * 6, y: a.y + ((k.y - a.y) / d) * 6 };
  const loose = await onClip(page, "TL3", "b");
  await touchDrag(page, loose, drop, async () => {
    await expect(page.locator("[data-loupe]")).toBeVisible();
    const name = (await page.locator("[data-loupe-name]").textContent()) ?? "";
    return name.includes("long leg") ? undefined : { x: a.x - ((k.x - a.x) / d) * 3, y: a.y - ((k.y - a.y) / d) * 3 };
  }, () => expect(page.locator("[data-loupe-name]")).toContainText("long leg"));
  await expect(page.locator("[data-loupe]")).toHaveCount(0);
  expect((await bench(page)).leads.find((l) => l.id === "TL3")?.b.to).toBe("pin:D1.anode");
  await taskDone(page, "mend-the-loop");
});
