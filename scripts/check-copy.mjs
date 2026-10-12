// Fails if an em dash (U+2014) appears in source, content or docs.
// Project rule: use a colon, comma, parentheses or a new sentence instead.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["apps", "packages", "content", "docs", "README.md", "CONTRIBUTING.md"];
const EXT = new Set([".ts", ".tsx", ".astro", ".md", ".mdx", ".yaml", ".yml", ".json", ".css", ".html", ".mjs", ".js"]);
const SKIP = new Set(["node_modules", "dist", ".astro", "coverage", "test-results", "playwright-report"]);
const EM = "—";
const hits = [];

function walk(p) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) if (!SKIP.has(name)) walk(join(p, name));
  } else if (EXT.has(extname(p)) || p.endsWith(".md")) {
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      if (line.includes(EM)) hits.push(`${p}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
}
ROOTS.forEach(walk);
if (hits.length) {
  console.error(`Em dash found (use a colon, comma, parentheses or a new sentence):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log("copy check: ok");
