// Frame rate of a big isle on this machine's GPU, with the CPU throttled (Chrome DevTools' throttling).
//
//   node scripts/perf.mjs [--lessons 300] [--modules 80] [--units 5] [--throttle 4] [--seconds 6] [--headed]
//
// Prints the WebGL renderer, the frame rate (mean and 5th percentile) and the isle's draw calls and triangles.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const L = opt("--lessons", "300");
const M = opt("--modules", "80");
const U = opt("--units", "5");
const throttle = Number(opt("--throttle", "4"));
const seconds = Number(opt("--seconds", "6"));

const server = await createServer({ root: join(pkg, "playground"), logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
await server.listen();
const browser = await chromium.launch({ headless: !args.includes("--headed"), args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`${server.resolvedUrls.local[0]}?l=${L}&m=${M}&u=${U}&seed=7&time=night&bare=1`);
await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 120_000 });
const gpu = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
await page.waitForTimeout(1500);
const frames = await page.evaluate(
  (ms) =>
    new Promise((done) => {
      const out = [];
      let last = performance.now();
      const end = last + ms;
      const tick = (now) => {
        out.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick);
        else done(out);
      };
      requestAnimationFrame(tick);
    }),
  seconds * 1000,
);
const stats = await page.evaluate(() => window.__isle.view.stats());
frames.sort((a, b) => a - b);
const mean = frames.reduce((s, x) => s + x, 0) / frames.length;
const p95 = frames[Math.floor(frames.length * 0.95)];
console.log(`GPU: ${gpu}`);
console.log(`${L} lessons, ${M} modules, ${U} units, CPU throttled ${throttle}x, dpr 2, 1440 x 900`);
console.log(`fps ${(1000 / mean).toFixed(1)} (mean frame ${mean.toFixed(1)} ms, 95th percentile ${p95.toFixed(1)} ms)`);
console.log(`draw calls ${stats.calls}, triangles ${stats.triangles}, instances ${stats.instances} in ${stats.pools} pools`);
await browser.close();
await server.close();
