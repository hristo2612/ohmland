// Frame rate of a big isle on this machine's GPU, with the CPU throttled (Chrome DevTools' throttling).
//
//   node scripts/perf.mjs [--lessons 300] [--modules 80] [--units 5] [--throttle 4] [--seconds 6] [--headed]
//                         [--look notebook,classic] [--time night] [--size 1440x900] [--dpr 2] [--turn 6]
//                         [--swiftshader]
//
// Prints the WebGL renderer, then for each look: the frame rate (mean and 95th percentile frame), how many frames
// a second the isle actually drew, the main-thread time of a drawn frame, and the draw calls and triangles.
// --turn measures a teaser turning round at that many degrees a second (it draws every frame in both looks), and
// --swiftshader renders on the CPU (a slow GPU: it shows what each look's drawing costs, not real frame rates).
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
const looks = opt("--look", "notebook,classic").split(",");
const time = opt("--time", "night");
const [W, H] = opt("--size", "1440x900").split("x").map(Number);
const dpr = Number(opt("--dpr", "2"));
const turn = Number(opt("--turn", "0"));
const gpuArgs = args.includes("--swiftshader") ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=metal", "--enable-gpu"];

const server = await createServer({ root: join(pkg, "playground"), logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
await server.listen();
const browser = await chromium.launch({ headless: !args.includes("--headed"), args: [...gpuArgs, "--ignore-gpu-blocklist"] });
let printedGpu = false;
for (const look of looks) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${server.resolvedUrls.local[0]}?l=${L}&m=${M}&u=${U}&seed=7&time=${time}&look=${look}&bare=1${turn ? `&turn=${turn}` : ""}`);
  await page.waitForFunction(() => window.__isle?.ready === true, null, { timeout: 120_000 });
  if (!printedGpu) {
    const gpu = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
    });
    console.log(`GPU: ${gpu}`);
    console.log(`${L} lessons, ${M} modules, ${U} units, ${time}, CPU throttled ${throttle}x, ${W} x ${H} at dpr ${dpr}${turn ? `, a teaser turning ${turn} degrees a second` : ""}`);
    printedGpu = true;
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.__isle.view.stats().drawn);
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
  console.log(
    `${look.padEnd(8)} fps ${(1000 / mean).toFixed(1)} (mean frame ${mean.toFixed(1)} ms, 95th percentile ${p95.toFixed(1)} ms), drew ${((stats.drawn - before) / seconds).toFixed(1)} frames a second, ${stats.workMs.toFixed(2)} ms main thread a drawn frame, ${stats.calls} draw calls, ${stats.triangles} triangles, ${stats.instances} instances in ${stats.pools} pools`,
  );
  await ctx.close();
}
await browser.close();
await server.close();
