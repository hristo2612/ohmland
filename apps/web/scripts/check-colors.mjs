// Fails when a raw colour (hex, rgb(), hsl(), oklch() ...) appears in apps/web/src outside src/styles/tokens.css,
// or a raw duration appears in a stylesheet. Design values live in tokens.css only.
// Also checks that tokens.css keeps its two dark-theme blocks identical, and that every var(--name) read without a
// fallback names a custom property that is defined somewhere (a token, or a local one a component sets), so a renamed
// or misspelt token never fails silently.
// A line can opt out with the comment `design-values: allow` (use sparingly, say why).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const TOKENS = join(SRC, "styles", "tokens.css");
const EXT = new Set([".css", ".ts", ".tsx", ".astro", ".mjs", ".js"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro"]);

// A hex colour: # followed by 3, 4, 6 or 8 hex digits, not part of a longer word (so "#main" or "&#39;" never match).
const HEX = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const FN = /(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\(/gi;
const DURATION = /(?<![\w.-])\d*\.?\d+m?s(?![\w-])/g;
const ALLOW = "design-values: allow";

const problems = [];
/** Custom properties defined anywhere (tokens, component CSS, inline styles), and every fallback-free read of one. */
const defined = new Set();
const reads = [];
const DEFINE = [/(--[\w-]+)\s*:/g, /["'`](--[\w-]+)["'`]/g];
const READ = /var\(\s*(--[\w-]+)\s*\)/g;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.has(extname(p)) && p !== TOKENS) check(p);
  }
}

/** Removes comments so prose in comments ("#1", "rgb") is never flagged. Keeps line breaks for line numbers. */
function stripComments(text, ext) {
  const keepLines = (m) => m.replace(/[^\n]/g, " ");
  let t = text.replace(/\/\*[\s\S]*?\*\//g, keepLines);
  if (ext !== ".css") t = t.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, pre) => pre + keepLines(m.slice(pre.length)));
  return t;
}

function collectTokens(file, text) {
  for (const re of DEFINE) for (const m of text.matchAll(re)) defined.add(m[1]);
  text.split("\n").forEach((line, i) => {
    // a var() that is itself another var()'s fallback only runs when the outer one is missing
    for (const m of line.matchAll(READ)) if (!/,\s*$/.test(line.slice(0, m.index))) reads.push({ name: m[1], where: `${relative(ROOT, file)}:${i + 1}` });
  });
}

function check(file) {
  const ext = extname(file);
  const raw = readFileSync(file, "utf8");
  const text = stripComments(raw, ext);
  collectTokens(file, text);
  const rawLines = raw.split("\n");
  const lines = text.split("\n");
  // Durations are only checked in stylesheets and Astro <style> blocks; scripts may use numbers for timing logic.
  let inStyle = ext === ".css";
  lines.forEach((line, i) => {
    if (ext === ".astro") {
      if (/<style[\s>]/.test(line)) inStyle = true;
      if (/<\/style>/.test(line)) {
        inStyle = false;
        return;
      }
    }
    if (rawLines[i]?.includes(ALLOW)) return;
    const where = `${relative(ROOT, file)}:${i + 1}`;
    for (const m of line.matchAll(HEX)) problems.push(`${where}: raw colour ${m[0]}`);
    for (const m of line.matchAll(FN)) problems.push(`${where}: raw colour function ${m[0]}...)`);
    if (inStyle) for (const m of line.matchAll(DURATION)) if (!/^0+(\.0+)?m?s$/.test(m[0])) problems.push(`${where}: raw duration ${m[0]}`);
  });
}

function checkDarkBlocks() {
  const css = readFileSync(TOKENS, "utf8");
  const body = (re) => {
    const m = re.exec(css);
    if (!m) return null;
    let depth = 0;
    let start = css.indexOf("{", m.index + m[0].length - 1);
    for (let i = start; i < css.length; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}" && --depth === 0) return css.slice(start + 1, i).replace(/\s+/g, " ").trim();
    }
    return null;
  };
  const media = body(/:root:not\(\[data-theme="light"\]\)\s*{/g);
  const chosen = body(/:root\[data-theme="dark"\]\s*{/g);
  if (!media || !chosen) problems.push("src/styles/tokens.css: could not find both dark-theme blocks");
  else if (media !== chosen) problems.push("src/styles/tokens.css: the two dark-theme blocks differ (keep them identical)");
}

walk(SRC);
collectTokens(TOKENS, stripComments(readFileSync(TOKENS, "utf8"), ".css"));
checkDarkBlocks();
for (const r of reads) if (!defined.has(r.name)) problems.push(`${r.where}: var(${r.name}) is not defined anywhere (a renamed token?)`);
if (problems.length) {
  console.error(`Design values belong in src/styles/tokens.css:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("design values check: ok");
