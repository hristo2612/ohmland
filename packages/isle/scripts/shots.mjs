// Screenshots of the playground at several isle sizes, day and night, desktop and phone, plus a contact sheet.
//
//   node scripts/shots.mjs [--out dir] [--only name] [--small] [--perf]
//
// Starts the playground with Vite, drives headless Chromium (WebGL through SwiftShader), saves one PNG per shot and
// contact-sheet.png in the output folder (default: screenshots/). --small saves reduced copies (for committing),
// --perf also reports draw calls and triangles for a 300-lesson isle.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..");
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const out = resolve(pkg, opt("--out", "screenshots"));
const only = opt("--only", "");
const small = args.includes("--small");
const perf = args.includes("--perf");
const zoom = opt("--zoom", "");
const query = opt("--query", "");
const timesArg = opt("--times", "day,night");
const viewsArg = opt("--views", "desktop,phone");
mkdirSync(out, { recursive: true });

const SIZES = [
  { name: "01-first-lesson", l: 1, m: 0, u: 1, caption: "1 lesson" },
  { name: "02-early", l: 6, m: 2, u: 1, caption: "6 lessons, 2 modules" },
  { name: "03-growing", l: 20, m: 6, u: 1, caption: "20 lessons, 6 modules" },
  { name: "04-two-units", l: 35, m: 12, u: 2, caption: "35 lessons, 12 modules, 2 units" },
  { name: "05-archipelago", l: 120, m: 30, u: 5, caption: "120 lessons, 30 modules, 5 units" },
];
const TIMES = timesArg.split(",");
const VIEWS = [
  { name: "desktop", width: 1440, height: 900, dpr: 1 },
  { name: "phone", width: 390, height: 844, dpr: 2 },
].filter((v) => viewsArg.split(",").includes(v.name));

const server = await createServer({ root: join(pkg, "playground"), logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function shoot(view, size, time) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.dpr });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}?l=${size.l}&m=${size.m}&u=${size.u}&seed=7&time=${time}&bare=1${zoom ? `&zoom=${zoom}` : ""}${query ? `&${query}` : ""}`);
  await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  const file = join(out, `${size.name}-${time}-${view.name}.png`);
  const png = await page.screenshot({ type: "png" });
  writeFileSync(file, png);
  const stats = await page.evaluate(() => window.__isle.view.stats());
  if (small) {
    const w = view.name === "desktop" ? 960 : 390;
    const reduced = await page.evaluate(
      async ({ src, w }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = w;
        c.height = Math.round((img.height * w) / img.width);
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL("image/png");
      },
      { src: `data:image/png;base64,${png.toString("base64")}`, w },
    );
    writeFileSync(file.replace(/\.png$/, "-small.png"), Buffer.from(reduced.split(",")[1], "base64"));
  }
  await ctx.close();
  if (errors.length) console.warn(`  errors in ${size.name}:`, errors.slice(0, 3));
  return { file, stats };
}

const shots = [];
for (const size of SIZES) {
  if (only && !size.name.includes(only)) continue;
  for (const time of TIMES)
    for (const view of VIEWS) {
      const r = await shoot(view, size, time);
      shots.push({ ...r, size, time, view });
      console.log(`${size.name} ${time} ${view.name}: ${r.stats.calls} calls, ${(r.stats.triangles / 1000).toFixed(1)}k triangles, ${r.stats.instances} instances in ${r.stats.pools} pools`);
    }
}

// --reveal: frames of a lesson reveal and a module reveal, and the caption each one returns
if (args.includes("--reveal")) {
  for (const kind of ["lesson", "module"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${base}?l=6&m=2&u=1&seed=7&time=${opt("--time", "day")}&bare=1`);
    await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 120_000 });
    await page.waitForTimeout(800);
    await page.evaluate((k) => {
      window.__revealDone = null;
      void window.__isle.reveal(k).then((info) => (window.__revealDone = info));
    }, kind);
    const t0 = Date.now();
    for (const [i, ms] of [600, 1500, 2300, 3200].entries()) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      writeFileSync(join(out, `reveal-${kind}-${i + 1}.png`), await page.screenshot({ type: "png" }));
    }
    await page.waitForFunction(() => window.__revealDone !== null, null, { timeout: 60_000 });
    await page.waitForTimeout(400);
    writeFileSync(join(out, `reveal-${kind}-5.png`), await page.screenshot({ type: "png" }));
    console.log(`reveal ${kind}: ${JSON.stringify(await page.evaluate(() => window.__revealDone))} in ${Date.now() - t0} ms`);
    await ctx.close();
  }
}

if (args.includes("--robot")) {
  for (const night of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${base}robot.html${night ? "?night=1" : ""}`);
    await page.waitForFunction(() => window.__robotReady === true, null, { timeout: 60_000 });
    await page.waitForTimeout(300);
    writeFileSync(join(out, `robot-${night ? "night" : "day"}.png`), await page.screenshot({ type: "png" }));
    await ctx.close();
  }
  console.log("robot shots saved");
}

if (perf) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(`${base}?l=300&m=80&u=5&seed=7&time=night&bare=1`);
  await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 180_000 });
  const ready = Date.now() - t0;
  await page.waitForTimeout(3000);
  const stats = await page.evaluate(() => window.__isle.view.stats());
  writeFileSync(join(out, "perf-300.png"), await page.screenshot({ type: "png" }));
  console.log(`300 lessons, 80 modules, 5 units: ready in ${ready} ms, ${JSON.stringify(stats)}`);
  await ctx.close();
}

// The contact sheet: every shot in a grid, desktop shots in one band, phone shots in another.
if (shots.length > 1) {
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const items = shots.map((s) => ({
    src: `data:image/png;base64,${readFileSync(s.file).toString("base64")}`,
    caption: `${s.size.caption}, ${s.time}`,
    phone: s.view.name === "phone",
  }));
  const sheet = await page.evaluate(async (items) => {
    const load = (src) => new Promise((r) => {
      const i = new Image();
      i.onload = () => r(i);
      i.src = src;
    });
    const imgs = await Promise.all(items.map((x) => load(x.src)));
    const desk = items.map((x, i) => ({ ...x, img: imgs[i] })).filter((x) => !x.phone);
    const phone = items.map((x, i) => ({ ...x, img: imgs[i] })).filter((x) => x.phone);
    const dw = 480;
    const dh = 300;
    const pw = 150;
    const ph = 325;
    const pad = 12;
    const cap = 22;
    const cols = 4;
    const drows = Math.ceil(desk.length / cols);
    const pcols = Math.min(10, phone.length);
    const prows = Math.ceil(phone.length / pcols);
    const W = Math.max(cols * (dw + pad) + pad, pcols * (pw + pad) + pad);
    const H = pad + drows * (dh + cap + pad) + prows * (ph + cap + pad) + 40;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#F7F5EF";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#1F2430";
    g.font = "600 18px system-ui, sans-serif";
    g.fillText("Ohmland isle: sizes, day and night, desktop 1440 x 900 and phone 390 x 844", pad, 26);
    g.font = "13px system-ui, sans-serif";
    let y = 40;
    desk.forEach((x, i) => {
      const cx = pad + (i % cols) * (dw + pad);
      const cy = y + Math.floor(i / cols) * (dh + cap + pad);
      g.drawImage(x.img, cx, cy + cap, dw, dh);
      g.fillStyle = "#3A4150";
      g.fillText(x.caption, cx, cy + 15);
    });
    y += drows * (dh + cap + pad);
    phone.forEach((x, i) => {
      const cx = pad + (i % pcols) * (pw + pad);
      const cy = y + Math.floor(i / pcols) * (ph + cap + pad);
      g.drawImage(x.img, cx, cy + cap, pw, ph);
      g.fillStyle = "#3A4150";
      g.font = "11px system-ui, sans-serif";
      g.fillText(x.caption.replace(", ", " "), cx, cy + 15, pw);
    });
    return c.toDataURL("image/png");
  }, items);
  writeFileSync(join(out, "contact-sheet.png"), Buffer.from(sheet.split(",")[1], "base64"));
  console.log(`contact sheet: ${join(out, "contact-sheet.png")}`);
}

await browser.close();
await server.close();
