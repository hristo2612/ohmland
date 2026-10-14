/**
 * The gallery: chosen pieces and landmarks side by side on one small board, drawn by the real renderer, for looking at
 * their models (the screenshots script's --gallery). The board is made up here, not planned: nothing else is placed.
 *
 * Query parameters:
 * - kinds: a comma list. `kind` shows every variant of a piece or every tier of a landmark, `kind@2` one variant,
 *   `kind:1` one tier. `|` starts a new row.
 * - time (day | dusk | night), look (notebook | classic), paper (grid | plain | clear), zoom.
 */
import { footOf, isLandmark, isPiece, tiersOf, variantsOf } from "../src/catalog";
import { mountIsle, type IsleItem, type IslePlan, type LandCell, type Look, type Paper, type Story, type Trace } from "../src/index";
import { PLAZA_R, disc, key } from "../src/plan";

const q = new URLSearchParams(location.search);
const look: Look = q.get("look") === "classic" ? "classic" : "notebook";
const paper: Paper = q.get("paper") === "plain" ? "plain" : q.get("paper") === "clear" ? "clear" : "grid";
const time = (() => {
  const d = new Date();
  const t = q.get("time") ?? "day";
  d.setHours(t === "night" ? 23 : t === "dusk" ? 19 : 13, t === "dusk" ? 30 : 0, 0, 0);
  return d;
})();
document.body.classList.toggle("night", q.get("time") === "night");
document.body.classList.toggle("classic", look === "classic");

type Entry = { kind: string; v: number; tier: number };

/** The entries of one row, from its part of `kinds`. */
function parseRow(s: string): Entry[] {
  const out: Entry[] = [];
  for (const raw of s.split(",").map((x) => x.trim()).filter(Boolean)) {
    const [kind, sel] = raw.split(/[@:]/) as [string, string | undefined];
    if (isLandmark(kind)) {
      const n = tiersOf(kind);
      const tiers = sel === undefined ? [...Array(n).keys()] : [Math.min(n - 1, Number(sel) || 0)];
      for (const tier of tiers) out.push({ kind, v: 0, tier });
    } else {
      const n = isPiece(kind) ? variantsOf(kind) : 1;
      const vs = sel === undefined ? [...Array(n).keys()] : [Number(sel) || 0];
      for (const v of vs) out.push({ kind, v, tier: 0 });
    }
  }
  return out;
}

// a row wraps after `cols` entries
const cols = Math.max(1, Number(q.get("cols")) || 4);
const rows = (q.get("kinds") ?? "iron-stand,solder-spool,regulator")
  .split("|")
  .map(parseRow)
  .flatMap((row) => Array.from({ length: Math.ceil(row.length / cols) }, (_, i) => row.slice(i * cols, (i + 1) * cols)));
const all = rows.flat();
const maxFoot = Math.max(1, ...all.map((e) => footOf(e.kind)));
// items run along the screen's horizontal (+x, -z), rows down the screen (+x, +z)
const stepOf = (row: Entry[]) => {
  const f = Math.max(1, ...row.map((e) => footOf(e.kind)));
  return Math.ceil((2 * f + (row.some((e) => isLandmark(e.kind)) ? 3.5 : 1.6)) / Math.SQRT2);
};
const rowStep = Math.ceil((2 * maxFoot + 4) / Math.SQRT2);

const start: Story = { at: -1, type: "start", title: "", ref: "" };
const items: IsleItem[] = [];
const cells = new Map<number, LandCell>();
const traces: Trace[] = [];
const land = (x: number, z: number, r: number) => disc(x, z, r, (cx, cz) => cells.set(key(cx, cz), { x: cx, z: cz, at: -1 }));
land(0, 0, PLAZA_R + 1.5);
rows.forEach((row, r) => {
  const ox = r * rowStep;
  const oz = r * rowStep;
  const step = stepOf(row);
  let px = 0;
  let pz = 0;
  row.forEach((e, i) => {
    const x = ox + (i + 1) * step;
    const z = oz - (i + 1) * step;
    const landmark = isLandmark(e.kind);
    const foot = footOf(e.kind);
    items.push({
      id: items.length,
      island: 0,
      kind: e.kind,
      x,
      z,
      rot: 0,
      v: e.v,
      foot,
      landmark,
      tiers: Array(e.tier + 1).fill(-1),
      story: Array(e.tier + 1).fill(start),
    });
    land(x, z, foot + 1.6);
    // a strip of board back to the one before, so the row is one board
    for (let k = 0; k <= 8; k++) land(px + ((x - px) * k) / 8, pz + ((z - pz) * k) / 8, Math.max(1.5, foot));
    px = x;
    pz = z;
  });
  // a copper trace in front of the row
  const off = Math.ceil(maxFoot + 1);
  traces.push({ ring: 0, pts: [[ox + off, oz + off - step], [ox + row.length * step + off, oz - row.length * step + off]] });
});

const plan: IslePlan = {
  seed: 1,
  events: [],
  islands: [{ id: 0, unit: "gallery", at: -1, x: 0, y: 0, z: 0, link: -1, cells: [...cells.values()], traces, plazas: [{ x: 0, z: 0, r: PLAZA_R, ring: -1 }] }],
  items,
};

document.getElementById("names")!.textContent = rows
  .map((row) => row.map((e) => (isLandmark(e.kind) ? `${e.kind} tier ${e.tier}` : variantsOf(e.kind) > 1 ? `${e.kind} v${e.v}` : e.kind)).join(", "))
  .join(" / ");

declare global {
  interface Window {
    __gallery?: { ready: boolean };
  }
}

// framed on the parts alone (no keel, shadow or robot) unless frame=isle
const frame = q.get("frame") === "isle" ? "isle" : "parts";
const view = await mountIsle(document.getElementById("isle")!, plan, { interactive: true, quality: "high", look, paper, muted: true, reducedMotion: true, time, frame });
const zoom = Number(q.get("zoom"));
if (zoom) view.setZoom(zoom);
window.__gallery = { ready: false };
requestAnimationFrame(() => requestAnimationFrame(() => window.__gallery && (window.__gallery.ready = true)));
