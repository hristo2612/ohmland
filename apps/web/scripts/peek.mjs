// Dev helper: screenshot one URL (optionally a clip region) for a quick visual check.
//   node scripts/peek.mjs <url> <out.png> [--w=1440] [--h=900] [--theme=light] [--clip=x,y,w,h] [--scale=2] [--full]
//   [--motion=reduce|no-preference] [--wait=300] [--seed=one|module]
import { chromium } from "@playwright/test";
import { WEBGL_ARGS, seedLearner } from "./seed.mjs";

const [url, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const browser = await chromium.launch({ args: WEBGL_ARGS });
const context = await browser.newContext({
  viewport: { width: Number(opt.w ?? 1440), height: Number(opt.h ?? 900) },
  deviceScaleFactor: Number(opt.scale ?? 1),
  colorScheme: opt.theme ?? "light",
  reducedMotion: opt.motion ?? "reduce",
});
const page = await context.newPage();
page.on("console", (msg) => msg.type() === "error" && console.log("console:", msg.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
if (opt.seed) await seedLearner(page, new URL(url).origin, opt.seed);
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(opt.wait ?? 300));
const clip = opt.clip ? Object.fromEntries(opt.clip.split(",").map((n, i) => [["x", "y", "width", "height"][i], Number(n)])) : undefined;
await page.screenshot({ path: out, clip, fullPage: "full" in opt, animations: "disabled" });
await browser.close();
console.log(out);
