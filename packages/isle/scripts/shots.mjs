// Screenshots of the playground at several isle sizes, in each look and time, desktop and phone, plus a contact sheet.
//
//   node scripts/shots.mjs [--out dir] [--only name] [--variants notebook:day,notebook:night,classic:day]
//                          [--views desktop,phone] [--small] [--zoom 3] [--query only=switching]
//                          [--reveal] [--look notebook] [--time day] [--robot] [--perf] [--gallery all|name;name=kinds]
//
// Starts the playground with Vite and drives headless Chromium (WebGL through SwiftShader). Saves one PNG per shot
// (<size>-<look>-<time>-<view>.png), contact-sheet.png and a compact contact-sheet.jpg in the output folder (default:
// screenshots/out, not committed). --small also saves reduced copies, --reveal frames of a lesson and a module reveal
// in --look at --time, --robot the robot on its own in both looks, --perf the draw calls and triangles of a 300-lesson
// isle in --look (its frame rate needs a GPU: scripts/perf.mjs). --gallery shoots pieces and landmarks up close instead
// (gallery-<name>-<look>-<time>.png): "all" for every preset below, or presets and "name=kinds" sets joined by ";".
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
const out = resolve(pkg, opt("--out", "screenshots/out"));
const only = opt("--only", "");
const small = args.includes("--small");
const perf = args.includes("--perf");
const zoom = opt("--zoom", "");
const query = opt("--query", "");
const variantsArg = opt("--variants", "notebook:day,notebook:night,classic:day");
const viewsArg = opt("--views", "desktop,phone");
const look = opt("--look", "notebook");
mkdirSync(out, { recursive: true });

const SIZES = [
  { name: "01-first-lesson", l: 1, m: 0, u: 1, caption: "1 lesson" },
  { name: "02-twelve", l: 12, m: 4, u: 1, caption: "12 lessons, 4 modules" },
  { name: "03-forty", l: 40, m: 12, u: 2, caption: "40 lessons, 12 modules, 2 units" },
  { name: "04-archipelago", l: 120, m: 30, u: 5, caption: "120 lessons, 30 modules, 5 units" },
];
const VARIANTS = variantsArg.split(",").map((v) => {
  const [lk, time] = v.split(":");
  return { look: lk, time: time ?? "day" };
});
const VIEWS = [
  { name: "desktop", width: 1440, height: 900, dpr: 1 },
  { name: "phone", width: 390, height: 844, dpr: 2 },
].filter((v) => viewsArg.split(",").includes(v.name));

const server = await createServer({ root: join(pkg, "playground"), logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function shoot(view, size, { look, time }) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.dpr });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}?l=${size.l}&m=${size.m}&u=${size.u}&seed=7&time=${time}&look=${look}&bare=1${zoom ? `&zoom=${zoom}` : ""}${query ? `&${query}` : ""}`);
  await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  const file = join(out, `${size.name}-${look}-${time}-${view.name}.png`);
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

// --gallery: pieces and landmarks side by side on a small board (playground/gallery.html), every variant and tier,
// in each --variants look and time (default notebook day and night). A preset name or "name=kinds;name=kinds".
const GALLERY = {
  "start-here": "spark-gap|pump-house",
  permanent: "iron-stand,solder-spool,regulator",
  chips: "chip-block,reed-gate,seven-seg|logic-chip,dice-block",
  beyond: "coil-bolt,magnet,antenna,mcu-board",
  "solder-forge": "solder-forge",
  "cable-pylon": "cable-pylon",
  "perfboard-pier": "perfboard-pier",
  "timer-factory": "timer-factory",
  "alarm-lighthouse": "alarm-lighthouse",
  "counter-billboard": "counter-billboard",
  "logic-castle": "logic-castle",
  "dice-arcade": "dice-arcade",
  "coil-windmill": "coil-windmill",
  "radio-mast": "radio-mast",
  "microcontroller-hq": "microcontroller-hq",
  "led-sundial": "led-sundial",
};
const galleryArg = opt("--gallery", "");
if (galleryArg) {
  const sets =
    galleryArg === "all"
      ? Object.entries(GALLERY)
      : galleryArg.split(";").map((s) => (s.includes("=") ? s.split("=") : [s, GALLERY[s] ?? s]));
  const variants = args.includes("--variants") ? VARIANTS : [{ look: "notebook", time: "day" }, { look: "notebook", time: "night" }];
  for (const [name, kinds] of sets)
    for (const { look: lk, time } of variants) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(`${base}gallery.html?kinds=${encodeURIComponent(kinds)}&time=${time}&look=${lk}${zoom ? `&zoom=${zoom}` : ""}`);
      await page.waitForFunction(() => window.__gallery?.ready === true, null, { timeout: 120_000 });
      await page.waitForTimeout(600);
      const file = join(out, `gallery-${name}-${lk}-${time}.png`);
      writeFileSync(file, await page.screenshot({ type: "png" }));
      console.log(`${file}${errors.length ? `  errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
      await ctx.close();
    }
  await browser.close();
  await server.close();
  process.exit(0);
}

const shots = [];
for (const size of SIZES) {
  if (only && !size.name.includes(only)) continue;
  for (const view of VIEWS)
    for (const variant of VARIANTS) {
      const r = await shoot(view, size, variant);
      shots.push({ ...r, size, ...variant, view });
      console.log(
        `${size.name} ${variant.look} ${variant.time} ${view.name}: ${r.stats.calls} calls, ${(r.stats.triangles / 1000).toFixed(1)}k triangles, ${r.stats.instances} instances in ${r.stats.pools} pools`,
      );
    }
}

// --reveal: frames of a lesson reveal and a module reveal, and the caption each one returns
if (args.includes("--reveal")) {
  for (const kind of ["lesson", "module"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${base}?l=6&m=2&u=1&seed=7&time=${opt("--time", "day")}&look=${look}&bare=1`);
    await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 120_000 });
    await page.waitForTimeout(800);
    await page.evaluate((k) => {
      window.__revealDone = null;
      void window.__isle.reveal(k).then((info) => (window.__revealDone = info));
    }, kind);
    const t0 = Date.now();
    // the notebook's reveal is shorter
    const at = look === "classic" ? [600, 1500, 2300, 3200] : [400, 900, 1400, 2000];
    for (const [i, ms] of at.entries()) {
      await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
      writeFileSync(join(out, `reveal-${look}-${kind}-${i + 1}.png`), await page.screenshot({ type: "png" }));
    }
    await page.waitForFunction(() => window.__revealDone !== null, null, { timeout: 60_000 });
    await page.waitForTimeout(400);
    writeFileSync(join(out, `reveal-${look}-${kind}-5.png`), await page.screenshot({ type: "png" }));
    console.log(`reveal ${kind}: ${JSON.stringify(await page.evaluate(() => window.__revealDone))} in ${Date.now() - t0} ms`);
    await ctx.close();
  }
}

if (args.includes("--robot")) {
  for (const lk of ["notebook", "classic"])
    for (const night of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(`${base}robot.html?look=${lk}${night ? "&night=1" : ""}`);
      await page.waitForFunction(() => window.__robotReady === true, null, { timeout: 60_000 });
      await page.waitForTimeout(300);
      writeFileSync(join(out, `robot-${lk}-${night ? "night" : "day"}.png`), await page.screenshot({ type: "png" }));
      await ctx.close();
    }
  console.log("robot shots saved");
}

if (perf) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(`${base}?l=300&m=80&u=5&seed=7&time=night&look=${look}&bare=1`);
  await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 180_000 });
  const ready = Date.now() - t0;
  await page.waitForTimeout(3000);
  const stats = await page.evaluate(() => window.__isle.view.stats());
  writeFileSync(join(out, `perf-300-${look}.png`), await page.screenshot({ type: "png" }));
  console.log(`300 lessons, 80 modules, 5 units, ${look}: ready in ${ready} ms, ${JSON.stringify(stats)}`);
  await ctx.close();
}

// The contact sheet: every shot in a grid, desktop shots in one band (a row per size, a column per look and time),
// phone shots in another.
if (shots.length > 1) {
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const items = shots.map((s) => ({
    src: `data:image/png;base64,${readFileSync(s.file).toString("base64")}`,
    caption: `${s.size.caption}, ${s.look} ${s.time}`,
    phone: s.view.name === "phone",
  }));
  const cols = Math.max(1, Math.min(4, VARIANTS.length));
  const sheet = await page.evaluate(async ({ items, cols }) => {
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
    const drows = Math.ceil(desk.length / cols);
    const pcols = Math.max(1, Math.min(12, phone.length));
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
    g.fillText("Ohmland isle: sizes, looks and times, desktop 1440 x 900 and phone 390 x 844", pad, 26);
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
    // a compact copy too, about 1600 pixels wide
    const k = Math.min(1, 1600 / W);
    const j = document.createElement("canvas");
    j.width = Math.round(W * k);
    j.height = Math.round(H * k);
    const jg = j.getContext("2d");
    jg.imageSmoothingQuality = "high";
    jg.drawImage(c, 0, 0, j.width, j.height);
    return { png: c.toDataURL("image/png"), jpg: j.toDataURL("image/jpeg", 0.84) };
  }, { items, cols });
  writeFileSync(join(out, "contact-sheet.png"), Buffer.from(sheet.png.split(",")[1], "base64"));
  writeFileSync(join(out, "contact-sheet.jpg"), Buffer.from(sheet.jpg.split(",")[1], "base64"));
  console.log(`contact sheet: ${join(out, "contact-sheet.png")} and .jpg`);
}

await browser.close();
await server.close();
