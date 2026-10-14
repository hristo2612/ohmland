// Screenshots of every moment of the bench lessons (Start here: welcome-to-the-bench and the Tool cases), played on the
// real bench like a learner: desktop and phone, light and dark, 3D and ink views. Moves too fine for a phone (or a drag
// that misses on a crowded bench) are played through the lab hook, so a run always reaches the end.
//
//   pnpm build && node scripts/lesson-shots.mjs                       into ./screenshots-lessons
//   node scripts/lesson-shots.mjs --lessons=first-glow --sizes=desktop --themes=light --views=3d
//   BASE_URL=http://localhost:4321 node scripts/lesson-shots.mjs --out=/tmp/shots
//
// Starts `astro preview` itself unless BASE_URL is set. Chromium runs with SwiftShader so the bench draws.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { WEBGL_ARGS } from "./seed.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const OUT = args.out ?? "screenshots-lessons";
const PATHS = {
  "welcome-to-the-bench": "start-here/welcome-to-the-bench",
  "meet-the-meter": "start-here/meet-the-meter",
  "milli-and-kilo": "start-here/milli-and-kilo",
  "how-a-breadboard-works": "start-here/how-a-breadboard-works",
  "parts-drawer": "start-here/parts-drawer",
  "first-glow": "start-here/first-glow",
};
const PORT = Number(args.port ?? 4393);
const LESSONS = (args.lessons ?? Object.keys(PATHS).join(",")).split(",");
const SIZES = (args.sizes ?? "desktop,phone").split(",");
const THEMES = (args.themes ?? "light,dark").split(",");
const VIEWS = (args.views ?? "3d,ink").split(",");
const PARALLEL = Number(args.parallel ?? 3);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

async function startServer() {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL, stop: () => {} };
  const child = spawn("npx", ["astro", "preview", "--port", String(PORT), "--ignore-lock"], { stdio: "pipe", detached: true });
  const url = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { url, stop: () => process.kill(-child.pid) };
}

// ---- Learner moves (the stage installs window.ohmlandLab) -------------------------------------------------------

const project = (page, t) => page.evaluate((x) => window.ohmlandLab.project(x), t);
const benchState = (page) => page.evaluate(() => window.ohmlandLab.bench());
const primary = (page) => page.locator("[data-primary]").first();
const at = (page, key, phase) => page.locator(`.bl[data-moment="${key}"]${phase ? `[data-phase="${phase}"]` : ""}`).waitFor({ timeout: 60_000 });

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 14, from.y + ((to.y - from.y) * i) / 14);
  await page.mouse.up();
  await page.waitForTimeout(250);
}
async function leadFromTray(page, color, anchor) {
  const before = new Set((await benchState(page)).leads.map((l) => l.id));
  const box = await page.locator(".ohb-tray .ohb-item, .ohi-tray .ohi-item", { hasText: color }).first().boundingBox();
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, await project(page, anchor));
  return (await benchState(page)).leads.find((l) => !before.has(l.id)).id;
}
/** Where to grab one clip of a lead: on its jaws, a few pixels along the lead from the point it holds, so a clip on
 * a neighbouring leg is not picked up instead. */
async function grabPoint(page, lead, end) {
  const l = (await benchState(page)).leads.find((x) => x.id === lead);
  const e = l[end];
  const o = l[end === "a" ? "b" : "a"];
  const p = await project(page, e.to ?? `lead:${lead}.${end}`);
  if (!e.to) return p;
  const q = await project(page, o.to ?? `lead:${lead}.${end === "a" ? "b" : "a"}`);
  const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: p.x + ((q.x - p.x) / d) * 5, y: p.y + ((q.y - p.y) / d) * 5 };
}
/** On a phone the LED's legs are a few pixels apart: there the script moves clips through the lab hook instead. */
const fine = (page) => page.viewportSize().width < 600;
async function clipTo(page, lead, end, anchor) {
  if (fine(page)) {
    await page.evaluate((s) => window.ohmlandLab.step(s), { do: "clip", lead, end, to: anchor });
    await page.waitForTimeout(250);
    return;
  }
  await drag(page, await grabPoint(page, lead, end), await project(page, anchor));
}
/** Swaps the clips on two neighbouring points (an LED's legs): one comes off first, as a careful learner would. */
async function swapClips(page, a, b) {
  await unclip(page, b[0], b[1]);
  await clipTo(page, a[0], a[1], b[2]);
  await clipTo(page, b[0], b[1], a[2]);
}
async function unclip(page, lead, end) {
  if (fine(page)) return clipTo(page, lead, end, null);
  const from = await grabPoint(page, lead, end);
  await drag(page, from, { x: from.x + 30, y: from.y + 90 });
}
const inkView = (page) => page.evaluate(() => window.ohmlandLab.view?.() === "ink");
async function flipBlockSwitch(page, id) {
  const p = (await benchState(page)).parts.find((x) => x.id === id);
  const pt = (await inkView(page)) ? await project(page, `part:${id}`) : await project(page, [p.pos[0], 24, p.pos[1] - 5.5]);
  await page.mouse.click(pt.x, pt.y);
}
/** Picks the LED up by its dome (above its legs on screen) and turns it with the bench's Rotate button. */
async function rotateLed(page) {
  if (fine(page)) {
    await page.evaluate(() => window.ohmlandLab.step({ do: "rotate", part: "D1" }));
    return;
  }
  if (await inkView(page)) {
    const d = await project(page, "part:D1");
    await page.mouse.click(d.x, d.y);
  } else {
    const a = await project(page, "pin:D1.anode");
    const k = await project(page, "pin:D1.cathode");
    const x = (a.x + k.x) / 2;
    let y = (a.y + k.y) / 2;
    for (let dy = 0; dy <= 90; dy += 3) {
      const hit = await page.evaluate(([px, py]) => JSON.stringify(window.ohmlandLab.pickAt(px, py) ?? null), [x, y - dy]);
      if (hit.includes('"D1"')) {
        y -= dy;
        break;
      }
    }
    await page.mouse.click(x, y);
  }
  await page.getByRole("button", { name: "Rotate" }).first().click();
}
async function tapHole(page, hole) {
  const p = await project(page, `hole:${hole}`);
  await page.mouse.click(p.x, p.y);
}
/** Waits for the bench and the ink to settle (the camera glides, notes draw themselves). */
const settle = (page, ms = 900) => page.waitForTimeout(ms);

// ---- The lessons -------------------------------------------------------------------------------------------------

/** A solution step through the lab hook (for moves too fine for a phone, or not a learner's to make). */
async function step(page, s) {
  await page.evaluate((x) => window.ohmlandLab.step(x), s);
  await page.waitForTimeout(250);
}
async function clickTarget(page, target) {
  const p = await project(page, target);
  await page.mouse.click(p.x, p.y);
}
/** Drags a part by its body onto a target (a drawer, a seat, a hole). On a phone the lab hook moves it to `at`. */
async function movePart(page, part, target, at) {
  if (fine(page)) return step(page, { do: "move", part, at });
  await drag(page, await project(page, `part:${part}`), await project(page, target));
}
/** Waits for a task; when the learner's move did not land (a drag on a crowded bench), plays the solution step. */
async function doneOr(page, task, fallback) {
  try {
    await page.waitForFunction((t) => window.ohmlandLab.status()[t] === "done", task, { timeout: 4000 });
  } catch {
    console.warn(`  ${task}: the move did not land, playing it through the lab hook`);
    for (const s of fallback) await step(page, s);
    await page.waitForFunction((t) => window.ohmlandLab.status()[t] === "done", task, { timeout: 8000 });
  }
}
/** A tap on the meter's dial or RANGE key: on the bench, or on the slip's key while that part of the meter is out of view. */
async function meterTap(page, what) {
  const key = page.locator(`[data-meter-key="${what}"]`);
  if (await key.count()) await key.click();
  else await clickTarget(page, `part:M1/${what}`);
}
/**
 * Turns the meter's dial and steps its range on the bench itself, as a learner does: each tap on the dial turns it one
 * detent, each tap on RANGE steps the range up. When a tap does not land (a probe lying over the dial), the lab hook.
 */
async function dialTo(page, mode, range) {
  const meter = () => page.evaluate(() => window.ohmlandLab.bench().meter);
  for (let i = 0; i < 8 && (await meter()).mode !== mode; i++) {
    await meterTap(page, "dial");
    await page.waitForTimeout(200);
  }
  for (let i = 0; range && i < 8 && (await meter()).range !== range; i++) {
    await meterTap(page, "range");
    await page.waitForTimeout(200);
  }
  const m = await meter();
  if (m.mode !== mode || (range && m.range !== range)) {
    console.warn(`  dial ${mode} ${range ?? ""}: the taps did not land, playing it through the lab hook`);
    await step(page, { do: "dial", mode, ...(range ? { range } : {}) });
  }
}
/** Touches the probe tips to two points (through the lab hook: a tip is a thin target right by its lead's plug). */
const probe = (page, red, black) => step(page, { do: "probe", red, black });

async function meetTheMeter(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page, 1200);
  await shot("02-meter");
  await step(page, { do: "plug", probe: "black", socket: "com" });
  await step(page, { do: "plug", probe: "red", socket: "vohm" });
  await at(page, "b0", "done");
  await settle(page);
  await shot("03-plugged");
  await primary(page).click();
  await at(page, "b1");
  await settle(page);
  await shot("04-dial");
  await dialTo(page, "dcv", "20V");
  await at(page, "b1", "done");
  await settle(page);
  await shot("05-dial-note");
  await primary(page).click();
  await at(page, "b2");
  await settle(page);
  await shot("06-which-letter");
  await page.locator("[data-pick='0']").click();
  await settle(page, 500);
  await shot("07-which-letter-wrong");
  await page.locator("[data-pick='1']").click();
  await at(page, "b3", "guess");
  await settle(page);
  await shot("08-guess");
  await page.locator("[data-guess='2']").click();
  await settle(page, 600);
  await probe(page, "BX.t2", "BX.t1");
  await doneOr(page, "read-battery", [{ do: "probe", red: "BX.t2", black: "BX.t1" }]);
  await at(page, "b3", "done");
  await settle(page);
  await shot("09-reading");
  await primary(page).click();
  await at(page, "b4");
  await probe(page, "BX.t1", "BX.t2");
  await doneOr(page, "swap-probes", [{ do: "probe", red: "BX.t1", black: "BX.t2" }]);
  await at(page, "b4", "done");
  await settle(page);
  await shot("10-minus-rule");
  await primary(page).click();
  await at(page, "b5");
  await settle(page);
  await shot("11-tap-plus");
  await page.locator('[data-tap="BX.t1"]').click();
  await settle(page, 500);
  await shot("12-tap-plus-wrong");
  await page.locator('[data-tap="BX.t2"]').click();
  await at(page, "b6");
  await settle(page);
  await shot("13-open");
  await clickTarget(page, "part:BX/lid");
  await doneOr(page, "open-the-box", [{ do: "param", part: "BX", params: { lid: true } }]);
  await at(page, "b6", "done");
  await settle(page);
  await shot("14-opened");
  await primary(page).click();
  await at(page, "b7");
  await settle(page);
  await shot("15-what-is-this");
  await page.locator("[data-pick='0']").click();
  await at(page, "secret");
  await settle(page);
  await shot("16-secret");
  await probe(page, "B2.pos", "B2.neg");
  await doneOr(page, "tired-battery", [{ do: "probe", red: "B2.pos", black: "B2.neg" }]);
  await at(page, "secret", "done");
  await settle(page);
  await shot("17-secret-found");
  await primary(page).click();
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("18-fixit");
  await dialTo(page, "dcv", "20V");
  await at(page, "end");
  await settle(page);
  await shot("19-end");
  await finish(page, shot, 20);
}

async function milliAndKilo(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page, 1200);
  await shot("02-gate");
  await clickTarget(page, "part:G1/unit");
  await doneOr(page, "tap-the-a", [{ do: "param", part: "G1", params: { unit: "mA" } }]);
  await at(page, "b0", "done");
  await settle(page);
  await shot("03-milli");
  await primary(page).click();
  await at(page, "b1");
  await settle(page);
  await shot("04-tag");
  await clickTarget(page, "part:L0/text");
  await doneOr(page, "tap-the-k", [{ do: "param", part: "L0", params: { alt: true } }]);
  await at(page, "b1", "done");
  await settle(page);
  await shot("05-kilo-rule");
  await primary(page).click();
  await at(page, "b2");
  await settle(page);
  await shot("06-show-me-milli");
  await page.locator('[data-tap="L1"]').click();
  await settle(page, 500);
  await shot("07-show-me-milli-wrong");
  await page.locator('[data-tap="L2"]').click();
  await at(page, "b3");
  await settle(page);
  await shot("08-wheel-one");
  await page.locator("[data-pick='1']").click();
  await settle(page, 500);
  await shot("09-wheel-one-wrong");
  await page.locator("[data-pick='2']").click();
  await at(page, "b4");
  await settle(page);
  await shot("10-wheel-two");
  await page.locator("[data-pick='1']").click();
  await at(page, "b5");
  await settle(page);
  await page.locator("[data-pick='2']").click();
  await at(page, "b6");
  await settle(page, 1200);
  await shot("11-padlock-set");
  await clickTarget(page, "part:CAB/lid");
  await doneOr(page, "open-padlock", [{ do: "param", part: "CAB", params: { lid: true } }]);
  await at(page, "b6", "done");
  await settle(page);
  await shot("12-cabinet-open");
  await primary(page).click();
  await at(page, "b7");
  await settle(page);
  await shot("13-what-does-k-mean");
  await page.locator("[data-pick='0']").click();
  await at(page, "secret");
  await settle(page);
  await shot("14-secret");
  await clickTarget(page, "part:L4/text");
  await doneOr(page, "mega", [{ do: "param", part: "L4", params: { alt: true } }]);
  await at(page, "secret", "done");
  await settle(page);
  await shot("15-mega");
  await primary(page).click();
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("16-fixit");
  await step(page, { do: "move", part: "L6", at: "desk:-206,96" });
  await movePart(page, "L1", "part:BN1", "in:BN1");
  await doneOr(page, "fix-it", [{ do: "move", part: "L1", at: "in:BN1" }]);
  await at(page, "end");
  await settle(page);
  await shot("17-end");
  await finish(page, shot, 18);
}

async function breadboard(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page, 1200);
  await shot("02-xray-button");
  await page.getByRole("button", { name: "X-ray" }).first().click();
  await at(page, "b0", "done");
  await settle(page);
  await shot("03-strips");
  await primary(page).click();
  await at(page, "b1");
  await settle(page);
  await tapHole(page, "c7");
  await at(page, "b1", "done");
  await settle(page);
  await shot("04-holds-hands");
  await primary(page).click();
  await at(page, "b2");
  await settle(page);
  await shot("05-why-dark");
  await page.locator("[data-pick='0']").click();
  await at(page, "b3");
  await settle(page, 1200);
  await shot("06-move-the-leg");
  await rotateLed(page);
  await doneOr(page, "fix-led", [{ do: "rotate", part: "D1" }]);
  await at(page, "b3", "done");
  await settle(page);
  await shot("07-glows-rule");
  await primary(page).click();
  await at(page, "b4");
  await settle(page);
  await shot("08-rail");
  if (fine(page)) {
    await step(page, { do: "unwire", wire: "W1" });
    await step(page, { do: "wire", id: "W1", from: "a11", to: "rail-:26", color: "black" });
  } else await drag(page, await project(page, "wire:W1.b"), await project(page, "hole:bn26"));
  await doneOr(page, "rail-slide", [{ do: "unwire", wire: "W1" }, { do: "wire", id: "W1", from: "a11", to: "rail-:26", color: "black" }]);
  await at(page, "b4", "done");
  await settle(page);
  await shot("09-rail-note");
  await primary(page).click();
  await at(page, "b5");
  await settle(page);
  await shot("10-game");
  await tapHole(page, "d14");
  await at(page, "b6");
  await settle(page);
  await tapHole(page, "f18");
  await settle(page, 500);
  await shot("11-game-wrong");
  await tapHole(page, "a18");
  await at(page, "b7");
  await settle(page);
  await tapHole(page, "bp27");
  await at(page, "secret");
  await settle(page);
  await shot("13-secret");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("14-fixit");
  if (fine(page)) {
    await step(page, { do: "unwire", wire: "W1" });
    await step(page, { do: "wire", id: "W1", from: "a11", to: "rail-:11", color: "black" });
  } else await drag(page, await project(page, "wire:W1.b"), await project(page, "hole:bn10"));
  await doneOr(page, "fix-it", [{ do: "unwire", wire: "W1" }, { do: "wire", id: "W1", from: "a11", to: "rail-:11", color: "black" }]);
  await at(page, "end");
  await settle(page);
  await shot("15-end");
  await finish(page, shot, 16);
}

async function partsDrawer(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page, 1200);
  await shot("02-battery");
  await movePart(page, "B2", "part:DRB", "in:DRB");
  await doneOr(page, "file-battery", [{ do: "move", part: "B2", at: "in:DRB" }]);
  await at(page, "b0", "done");
  await settle(page);
  await shot("03-battery-filed");
  await primary(page).click();
  await at(page, "b1");
  await settle(page);
  await shot("04-switch");
  await clipTo(page, "TL2", "b", "pin:S2.com");
  await clipTo(page, "TL3", "a", "pin:S2.b");
  await settle(page, 600);
  await shot("05-switch-in-gap");
  await step(page, { do: "flip", part: "S2", to: "b" });
  await doneOr(page, "test-switch", [{ do: "clip", lead: "TL2", end: "b", to: "S2.com" }, { do: "clip", lead: "TL3", end: "a", to: "S2.b" }, { do: "flip", part: "S2", to: "a" }, { do: "flip", part: "S2", to: "b" }]);
  await at(page, "b1", "done");
  await settle(page);
  await shot("06-switch-note");
  await primary(page).click();
  await at(page, "b2");
  await settle(page);
  await clipTo(page, "TL2", "b", "pin:D1.anode");
  await clipTo(page, "TL3", "a", "pin:D1.cathode");
  await settle(page, 600);
  await shot("07-led-lit");
  await step(page, { do: "clip", lead: "TL2", end: "b", to: "D1.cathode" });
  await step(page, { do: "clip", lead: "TL3", end: "a", to: "D1.anode" });
  await doneOr(page, "led-both-ways", [
    { do: "clip", lead: "TL2", end: "b", to: "D1.anode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.cathode" },
    { do: "clip", lead: "TL2", end: "b", to: "D1.cathode" },
    { do: "clip", lead: "TL3", end: "a", to: "D1.anode" },
  ]);
  await at(page, "b2", "done");
  await settle(page);
  await shot("08-led-rule");
  await primary(page).click();
  await at(page, "b3");
  await settle(page);
  await shot("09-triangle");
  await primary(page).click();
  await at(page, "b4");
  await settle(page);
  await clipTo(page, "TL2", "b", "pin:RB.a");
  await clipTo(page, "TL3", "a", "pin:RB.b");
  await doneOr(page, "test-resistor", [{ do: "clip", lead: "TL2", end: "b", to: "RB.a" }, { do: "clip", lead: "TL3", end: "a", to: "RB.b" }]);
  await at(page, "b4", "done");
  await settle(page);
  await shot("10-resistor-dim");
  await primary(page).click();
  await at(page, "b5");
  await settle(page);
  await shot("11-file-them");
  await step(page, { do: "clip", lead: "TL2", end: "b", to: null });
  await step(page, { do: "clip", lead: "TL3", end: "a", to: null });
  // A wrong drawer first: the resistor will not go in with the switch.
  await movePart(page, "RB", "part:DRS", "in:DRS");
  await settle(page, 600);
  await shot("12-wrong-drawer");
  await movePart(page, "RB", "part:DRR", "in:DRR");
  await movePart(page, "S2", "part:DRS", "in:DRS");
  await movePart(page, "D1", "part:DRL", "in:DRL");
  await doneOr(page, "file-all", [
    { do: "move", part: "S2", at: "in:DRS" },
    { do: "move", part: "D1", at: "in:DRL" },
    { do: "move", part: "RB", at: "in:DRR" },
  ]);
  await at(page, "b6");
  await settle(page);
  await shot("13-show-me-led-symbol");
  await page.locator('[data-tap="part:DRB/face"]').click();
  await settle(page, 500);
  await shot("14-show-me-wrong");
  await page.locator('[data-tap="part:DRL/face"]').click();
  await at(page, "b7");
  await settle(page);
  await shot("15-what-is-this");
  await page.locator("[data-pick='0']").click();
  await at(page, "secret");
  await settle(page);
  await shot("16-secret");
  await movePart(page, "PB1", "part:DRS", "in:DRS");
  await doneOr(page, "button-drawer", [{ do: "move", part: "PB1", at: "in:DRS" }]);
  await at(page, "secret", "done");
  await settle(page);
  await shot("17-secret-found");
  await primary(page).click();
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("18-fixit");
  await movePart(page, "S2", "part:DRR", "in:DRR");
  await movePart(page, "RB", "part:DRS", "in:DRS");
  await doneOr(page, "fix-it", [{ do: "move", part: "S2", at: "in:DRR" }, { do: "move", part: "RB", at: "in:DRS" }]);
  await at(page, "end");
  await settle(page);
  await shot("19-end");
  await finish(page, shot, 20);
}

/**
 * Drags a tray item (by its visible text) onto the board, centred on the given holes (two for an LED, so each leg lands
 * in one); on a phone the lab hook places it.
 */
async function fromTray(page, text, holes, place) {
  if (fine(page)) return step(page, place);
  const box = await page.locator(".ohb-tray .ohb-item, .ohi-tray .ohi-item", { hasText: text }).first().boundingBox();
  const pts = await Promise.all(holes.map((h) => project(page, `hole:${h}`)));
  const to = { x: pts.reduce((n, p) => n + p.x, 0) / pts.length, y: pts.reduce((n, p) => n + p.y, 0) / pts.length };
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, to);
}

async function firstGlow(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page, 1200);
  await shot("02-torn");
  await movePart(page, "PC", "part:CARD/D1", "in:CARD");
  await settle(page, 600);
  await shot("03-piece-in");
  for (let i = 0; i < 2; i++) {
    await clickTarget(page, "part:PC");
    await settle(page, 300);
  }
  await doneOr(page, "mend-blueprint", [{ do: "move", part: "PC", at: "in:CARD" }, { do: "param", part: "PC", params: { turn: 90 } }]);
  await at(page, "b0", "done");
  await settle(page);
  await shot("04-mended");
  await primary(page).click();
  await at(page, "b1");
  await settle(page, 1200);
  await shot("05-build");
  await fromTray(page, "1 kΩ", ["c7"], { do: "place", part: "R1", kind: "resistor", at: "c5", params: { ohms: 1000 } });
  await settle(page, 600);
  await shot("06-resistor-in");
  await fromTray(page, "LED", ["d9", "d10"], { do: "place", part: "D1", kind: "led", at: "d9", params: { color: "red", maxmA: 50 } });
  await doneOr(page, "build-loop", [
    { do: "remove", part: "R1" },
    { do: "remove", part: "D1" },
    { do: "place", part: "R1", kind: "resistor", at: "c5", params: { ohms: 1000 } },
    { do: "place", part: "D1", kind: "led", at: "d9", params: { color: "red", maxmA: 50 } },
  ]);
  await at(page, "b1", "done");
  await settle(page);
  await shot("07-glow");
  await primary(page).click();
  await at(page, "b2");
  await settle(page);
  await shot("08-zigzag");
  await page.locator('[data-tap="D1"]').click();
  await settle(page, 500);
  await shot("09-zigzag-wrong");
  await page.locator('[data-tap="R1"]').click();
  await at(page, "b3", "guess");
  await settle(page);
  await shot("10-guess");
  await page.locator("[data-guess='1']").click();
  await settle(page, 600);
  await step(page, { do: "move", part: "D1", at: "b9" });
  await doneOr(page, "move-it", [{ do: "move", part: "D1", at: "b9" }]);
  await at(page, "b3", "done");
  await settle(page);
  await shot("11-drawing-stayed");
  await primary(page).click();
  await at(page, "b4");
  await settle(page);
  await shot("12-what-does-it-show");
  await page.locator("[data-pick='0']").click();
  await at(page, "secret");
  await settle(page);
  await shot("13-secret");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("14-fixit");
  await step(page, { do: "move", part: "D1", at: "b9", rot: 0 });
  await doneOr(page, "flip-led", [{ do: "move", part: "D1", at: "b9", rot: 0 }]);
  await at(page, "end");
  await settle(page);
  await shot("15-end");
  await page.locator("[data-notebook-button]").click();
  await settle(page, 600);
  await shot("16-notebook");
  await page.keyboard.press("Escape");
  await finish(page, shot, 17);
}

async function welcome(page, shot) {
  await shot("01-start");
  await primary(page).click();
  await at(page, "b0");
  await settle(page, 1200);
  await shot("02-switch");
  await flipBlockSwitch(page, "S1");
  await at(page, "b1");
  await settle(page);
  await shot("03-still-dark");
  await page.locator('[data-tap="B1.neg"]').click();
  await at(page, "b1", "done");
  await settle(page, 1500);
  await shot("04-tracer-gap");
  await primary(page).click();
  await at(page, "b2");
  await clipTo(page, "TL1", "a", "pin:B1.pos");
  await at(page, "b2", "done");
  await settle(page, 1500);
  await shot("05-loop-rule");
  await primary(page).click();
  await at(page, "b3", "guess");
  await shot("06-guess");
  await page.locator("[data-guess='2']").click();
  await unclip(page, "TL2", "a");
  await at(page, "b3", "done");
  await settle(page);
  await shot("07-dark");
  await primary(page).click();
  await at(page, "b4");
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await at(page, "b5");
  await settle(page);
  await shot("08-what-is-this");
  await page.locator("[data-pick='0']").click();
  await at(page, "secret");
  await settle(page);
  await shot("09-secret");
  await page.locator(".bl-link", { hasText: "Skip" }).click();
  await at(page, "fix0");
  await settle(page, 1500);
  await shot("10-fixit");
  await page.waitForFunction(() => (window.ohmlandLab.part("D1")?.glow ?? 0) < 0.01);
  await clipTo(page, "TL2", "a", "pin:S1.b");
  await at(page, "end");
  await finish(page, shot, 11);
}

async function finish(page, shot, n) {
  await primary(page).click();
  const reveal = page.getByRole("dialog");
  try {
    await reveal.waitFor({ timeout: 20_000 });
    await settle(page, 2500);
    await shot(`${n}-reveal`);
    await reveal.getByRole("button", { name: "Continue" }).click();
  } catch {
    // No reveal (a replay, or the island did not start in time).
  }
  await page.locator("[data-finale]").waitFor({ timeout: 30_000 });
  await settle(page, 2000);
  await shot(`${n + 1}-finale`);
}

const PLAY = {
  "welcome-to-the-bench": welcome,
  "meet-the-meter": meetTheMeter,
  "milli-and-kilo": milliAndKilo,
  "how-a-breadboard-works": breadboard,
  "parts-drawer": partsDrawer,
  "first-glow": firstGlow,
};

async function run(browser, base, lesson, size, theme, view) {
  const context = await browser.newContext({ viewport: VIEWPORTS[size], colorScheme: theme, reducedMotion: "reduce", deviceScaleFactor: 1, hasTouch: size === "phone" });
  await context.addInitScript((v) => {
    try {
      localStorage.setItem("ohmland:bench-view", v);
    } catch {
      // ignore
    }
  }, view);
  const page = await context.newPage();
  const dir = join(OUT, lesson);
  mkdirSync(dir, { recursive: true });
  const shot = async (name) => {
    const file = join(dir, `${name}-${size}-${theme}-${view}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  };
  try {
    await page.goto(`${base}/learn/${PATHS[lesson]}/?time=${theme === "dark" ? "22:00" : "12:00"}`, { waitUntil: "networkidle" });
    await page.mouse.move(5, 5);
    await page.locator("[data-bench-ready]").waitFor({ state: "attached", timeout: 60_000 });
    await settle(page, 800);
    await PLAY[lesson](page, shot);
  } catch (err) {
    console.error(`${lesson} ${size} ${theme} ${view}:`, err.message.split("\n")[0]);
    if (args.debug)
      console.error(
        JSON.stringify(
          await page.evaluate(() => ({
            leads: window.ohmlandLab?.bench().leads.map((l) => `${l.id} a=${l.a.to} b=${l.b.to}`),
            status: window.ohmlandLab?.status(),
            d1: window.ohmlandLab?.part("D1"),
          })),
        ),
      );
    await page.screenshot({ path: join(dir, `zz-failed-${size}-${theme}-${view}.png`) }).catch(() => {});
  }
  await context.close();
}

const server = await startServer();
const browser = await chromium.launch({ args: WEBGL_ARGS });
const jobs = [];
for (const lesson of LESSONS) for (const size of SIZES) for (const theme of THEMES) for (const view of VIEWS) jobs.push([lesson, size, theme, view]);
const queue = [...jobs];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (queue.length) {
      const [lesson, size, theme, view] = queue.shift();
      await run(browser, server.url, lesson, size, theme, view);
    }
  }),
);
await browser.close();
server.stop();
