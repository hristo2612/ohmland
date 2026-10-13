// Renders the landing hero's posters from the live island itself (src/isle/IsleHero.tsx), day and night, so the
// still and the 3D island that fades in over it match. Run after changing the hero island or the isle's look:
//
//   pnpm build && node scripts/isle-poster.mjs        writes public/isle/hero-{day,night}.webp (1200 px) and
//                                                      hero-{day,night}-640.webp, and the tiny blurred copies that
//                                                      src/styles/tokens.css inlines (--isle-poster-blur)
//
// Needs cwebp (libwebp). Starts `astro preview` itself unless BASE_URL is set.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { WEBGL_ARGS } from "./seed.mjs";

const PORT = 4393;
const OUT = "public/isle";
const TOKENS = "src/styles/tokens.css";
// The hero frame at 600 x 500 CSS pixels, drawn at 2x.
const WIDTH = 600;

async function startServer() {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL, stop: () => {} };
  const child = spawn("npx", ["astro", "preview", "--port", String(PORT), "--ignore-lock"], { stdio: "pipe", detached: true });
  const url = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return { url, stop: () => process.kill(-child.pid) };
}

const server = await startServer();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: WEBGL_ARGS });
const blurs = {};
try {
  for (const [name, scheme] of [["day", "light"], ["night", "dark"]]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto(`${server.url}/?isle-still`, { waitUntil: "networkidle" });
    // size the frame exactly, whatever the page layout does
    await page.addStyleTag({ content: `.isle-frame--hero { width: ${WIDTH}px !important; max-width: none !important; border: 0 !important; border-radius: 0 !important; }` });
    await page.waitForSelector(".isle-frame--hero[data-live]", { timeout: 30000 });
    await page.waitForTimeout(800);
    const png = join(OUT, `hero-${name}.png`);
    await page.locator(".isle-frame--hero .isle-frame__live").screenshot({ path: png });
    const webp = join(OUT, `hero-${name}.webp`);
    const small = join(OUT, `hero-${name}-640.webp`);
    const tiny = join(OUT, `hero-${name}-tiny.webp`);
    execFileSync("cwebp", ["-quiet", "-q", "80", "-m", "6", png, "-o", webp]);
    execFileSync("cwebp", ["-quiet", "-q", "80", "-m", "6", "-resize", "640", "0", png, "-o", small]);
    execFileSync("cwebp", ["-quiet", "-q", "50", "-m", "6", "-resize", "32", "0", png, "-o", tiny]);
    blurs[name] = readFileSync(tiny).toString("base64");
    rmSync(png);
    rmSync(tiny);
    for (const f of [webp, small]) console.log(`${f} ${(statSync(f).size / 1024).toFixed(0)} KB`);
    await context.close();
  }
  // the blurred copies are inlined, one per theme block (the night one twice: system dark and chosen dark)
  let tokens = readFileSync(TOKENS, "utf8");
  for (const name of ["day", "night"]) {
    const line = new RegExp(`(--isle-poster: url\\("/isle/hero-${name}\\.webp"\\);\\n(\\s*)--isle-poster-small: [^\\n]*\\n\\s*)--isle-poster-blur: [^\\n]*`, "g");
    tokens = tokens.replace(line, (_, head) => `${head}--isle-poster-blur: url("data:image/webp;base64,${blurs[name]}");`);
  }
  writeFileSync(TOKENS, tokens);
  console.log(`${TOKENS}: --isle-poster-blur updated`);
} finally {
  await browser.close();
  server.stop();
}
