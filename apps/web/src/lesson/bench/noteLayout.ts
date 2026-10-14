/**
 * Where the ink notes go over the bench (Annotations.tsx draws them). Pure geometry in screen px: a note's line of
 * handwriting is placed beside the point it is about, in the spot that covers the least of the bench (parts, the
 * breadboard's holes, the bench's own slips and panels) and none of the other notes, and its arrow ends on the part's
 * outline (a drawing's lines, not the empty paper inside them).
 */

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Pt = { x: number; y: number };

/** A note to place: the point it is about, the outline of the whole part when it is about a part, its text size. */
/**
 * A note to place: the point it is about, the outline of the whole part when it is about a part, and the part's named
 * marks when it has them (a drawing's symbols sit on its lines: the arrow ends on the nearest), its text size.
 */
export type NoteIn = { id: string; p: Pt; target: Rect | null; marks?: Pt[] | undefined; w: number; h: number; prev?: number | undefined };

export type NoteOut = {
  id: string;
  /** Text anchor point (the baseline) and alignment. */
  tx: number;
  ty: number;
  anchor: "start" | "end";
  box: Rect;
  /** The candidate spot taken, for the next frame's hysteresis. */
  candidate: number;
  path: string;
  headPath: string;
};

const area = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const overlap = (a: Rect, b: Rect): number => area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
export const inside = (r: Rect, p: Pt) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;

/** The bounding rectangle of some points, grown by `pad` px; null for none. */
export function rectOf(points: readonly Pt[], pad: number): Rect | null {
  if (!points.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** Where the segment from `s` (outside `r`) towards `p` (inside it) crosses the rectangle's edge. */
export function edgeHit(r: Rect, s: Pt, p: Pt): Pt {
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  // The line enters the rectangle where it is inside both its column and its row: the later of the two entries.
  const tx = dx > 0 ? (r.x0 - s.x) / dx : dx < 0 ? (r.x1 - s.x) / dx : -Infinity;
  const ty = dy > 0 ? (r.y0 - s.y) / dy : dy < 0 ? (r.y1 - s.y) / dy : -Infinity;
  const t = Math.min(1, Math.max(tx, ty, 0));
  return { x: s.x + dx * t, y: s.y + dy * t };
}

/** The spots tried around a point: above and below, to the right and the left, a little further out each time. */
function candidates(n: NoteIn): { tx: number; ty: number; anchor: "start" | "end" }[] {
  const out: { tx: number; ty: number; anchor: "start" | "end" }[] = [];
  for (const dy of [-72, 78, -112, 118, -160, 164, -220, 224]) {
    out.push({ tx: n.p.x + 40, ty: n.p.y + dy, anchor: "start" });
    out.push({ tx: n.p.x - 40, ty: n.p.y + dy, anchor: "end" });
  }
  // Beside the whole part, level with the point.
  const t = n.target;
  if (t) {
    out.push({ tx: t.x1 + 32, ty: n.p.y + 7, anchor: "start" });
    out.push({ tx: t.x0 - 32, ty: n.p.y + 7, anchor: "end" });
  }
  return out;
}

/**
 * Places each note in turn (earlier notes are obstacles for later ones). `view` is the overlay's size; text keeps 12 px
 * from its sides. A note keeps last frame's spot (`prev`) unless another is clearly better, so the camera's glide never
 * makes notes jump about.
 */
export function placeNotes(notes: readonly NoteIn[], obstacles: readonly Rect[], view: { w: number; h: number }): NoteOut[] {
  const placed: NoteOut[] = [];
  for (const n of notes) {
    let best: { score: number; out: NoteOut } | null = null;
    const spots = candidates(n);
    for (let i = 0; i < spots.length; i++) {
      const c = spots[i]!;
      const w = Math.min(n.w, view.w - 24);
      let x0 = c.anchor === "start" ? c.tx : c.tx - w;
      const shiftX = Math.max(12 - x0, Math.min(0, view.w - 12 - (x0 + w)));
      x0 += shiftX;
      const ty = Math.max(n.h + 2, Math.min(view.h - 14, c.ty));
      const box: Rect = { x0: x0 - 4, y0: ty - n.h, x1: x0 + w + 4, y1: ty + 8 };
      const a = area(box) || 1;
      let covered = 0;
      for (const o of obstacles) covered += overlap(box, o);
      let notes = 0;
      for (const q of placed) notes += overlap(box, q.box);
      const moved = Math.abs(shiftX) + Math.abs(ty - c.ty);
      const cx = (box.x0 + box.x1) / 2;
      const cy = (box.y0 + box.y1) / 2;
      const score =
        4 * Math.min(1.5, covered / a) +
        12 * (notes / a) +
        (inside(box, n.p) ? 3 : 0) +
        0.5 * (Math.hypot(cx - n.p.x, cy - n.p.y) / 100) +
        (moved > 24 ? 0.4 : 0) -
        (i === n.prev ? 0.35 : 0);
      if (best && score >= best.score) continue;
      const anchor: "start" | "end" = c.anchor;
      const tx = anchor === "start" ? x0 : x0 + w;
      best = { score, out: { id: n.id, tx, ty, anchor, box, candidate: i, ...arrow(n, { tx, ty, anchor, w }) } };
    }
    if (best) placed.push(best.out);
  }
  return placed;
}

/** A hand-drawn arrow from under (or over) the start of the line of text to the point, or to the part's outline. */
function arrow(n: NoteIn, t: { tx: number; ty: number; anchor: "start" | "end"; w: number }): { path: string; headPath: string } {
  const toRight = t.anchor === "start";
  const above = t.ty < n.p.y;
  const lead = Math.min(26, t.w / 3);
  const sx = toRight ? t.tx + lead : t.tx - lead;
  const sy = above ? t.ty + 10 : t.ty - n.h - 4;
  // A drawing is pointed at on its nearest symbol (its lines run through them); another big part on its outline; a
  // small one, or a leg or a hole, at the point.
  const big = n.target && n.target.x1 - n.target.x0 > 72 && n.target.y1 - n.target.y0 > 48 ? n.target : null;
  const s = { x: sx, y: sy };
  const nearest = n.marks?.length ? n.marks.reduce((a, b) => (Math.hypot(b.x - sx, b.y - sy) < Math.hypot(a.x - sx, a.y - sy) ? b : a)) : null;
  const aim = nearest ?? (big && !inside(big, s) && inside(big, n.p) ? edgeHit(big, s, n.p) : n.p);
  const dx = aim.x - sx;
  const dy = aim.y - sy;
  const len = Math.hypot(dx, dy) || 1;
  const stop = aim === n.p || aim === nearest ? 9 : 2;
  const ex = aim.x - (dx / len) * stop;
  const ey = aim.y - (dy / len) * stop;
  const bow = Math.min(22, len / 4);
  const cx = (sx + ex) / 2 + (dy / len) * bow * (toRight ? 1 : -1);
  const cy = (sy + ey) / 2 - (dx / len) * bow * (toRight ? 1 : -1);
  const angle = Math.atan2(ey - cy, ex - cx);
  const head = (a: number) => `${ex - Math.cos(angle + a) * 10},${ey - Math.sin(angle + a) * 10}`;
  return { path: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, headPath: `M${head(0.45)} L${ex},${ey} L${head(-0.45)}` };
}
