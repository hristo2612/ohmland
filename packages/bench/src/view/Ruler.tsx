// The breadboard's row letters and strip numbers pinned to the edge of the bench, for both views, while the view is
// so close that the board's own printed ones are out of sight (a phone working at a reading scale): a sticky ink
// ruler, so "row 20" or "a hole on row c" can still be found. Placed through the view's projection of the holes.

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { boardGeometry } from "../board";
import type { BenchStore } from "../store";
import type { ScreenPoint } from "./controller";

type Projector = { project(target: string): ScreenPoint | null; onViewChange(cb: () => void): () => void };

const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;

/** A label pinned to the left or the top edge, `at` px along that edge. */
export type RulerMark = { text: string; edge: "left" | "top"; at: number };

/**
 * The marks to pin, or none while the board's own labels show. `at(hole)` is a hole's screen point; `w` and `h` the
 * bench's size. Rows run along the screen's longer axis of the board as it is seen (a quarter-turned 3D view stands
 * the board on end): letters go down the left edge for rows that run across, else along the top.
 */
export function rulerMarks(cols: number, at: (hole: string) => ScreenPoint | null, w: number, h: number): RulerMark[] {
  const inside = (p: { x: number; y: number } | null) => !!p && p.x >= 0 && p.y >= 0 && p.x <= w && p.y <= h;
  const a1 = at("a1");
  const a2 = at("a2");
  const b1 = at("b1");
  if (!a1 || !a2 || !b1) return [];
  const col = { x: a2.x - a1.x, y: a2.y - a1.y };
  const row = { x: b1.x - a1.x, y: b1.y - a1.y };
  // Only once holes are far enough apart for a label beside each row: zoomed out, the board's own print serves.
  if (Math.hypot(row.x, row.y) < 17) return [];
  // Where the board prints its labels: a step past the first and last strip, and past rows a and j.
  const step = (p: ScreenPoint | null, d: { x: number; y: number }, k: number) => (p ? { x: p.x + d.x * k, y: p.y + d.y * k } : null);
  const letters = ROWS.flatMap((r) => [step(at(`${r}1`), col, -1.4), step(at(`${r}${cols}`), col, 1.4)]);
  const printed = Array.from({ length: cols }, (_, i) => i + 1).filter((c) => c === 1 || c % 5 === 0);
  const numbers = printed.flatMap((c) => [step(at(`a${c}`), row, -1.6), step(at(`j${c}`), row, 1.6)]);
  const across = Math.abs(col.x) >= Math.abs(col.y);
  const out: RulerMark[] = [];
  const holesSeen = (r: string) => {
    const seen: ScreenPoint[] = [];
    for (let c = 1; c <= cols; c++) {
      const p = at(`${r}${c}`);
      if (p && inside(p)) seen.push(p);
    }
    return seen;
  };
  if (!letters.some(inside)) {
    for (const r of ROWS) {
      const seen = holesSeen(r);
      if (!seen.length) continue;
      const p = seen.reduce((m, q) => (across ? (q.x < m.x ? q : m) : q.y < m.y ? q : m));
      out.push(across ? { text: r, edge: "left", at: p.y } : { text: r, edge: "top", at: p.x });
    }
  }
  if (!numbers.some(inside)) {
    for (const c of printed) {
      const seen = ROWS.map((r) => at(`${r}${c}`)).filter((p): p is ScreenPoint => !!p && inside(p));
      if (!seen.length) continue;
      const p = seen.reduce((m, q) => (across ? (q.y < m.y ? q : m) : q.x < m.x ? q : m));
      out.push(across ? { text: String(c), edge: "top", at: p.x } : { text: String(c), edge: "left", at: p.y });
    }
  }
  return out;
}

const MARK: React.CSSProperties = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  minWidth: 18,
  padding: "0 4px",
  textAlign: "center",
  background: "var(--paper-slip, #FCFAF5)",
  border: "1px solid var(--rule-soft, #D8D0C1)",
  borderRadius: 3,
  color: "var(--ink-2, #4A453D)",
  font: "600 12px/16px var(--font-serif, Georgia, serif)",
  pointerEvents: "none",
};

/**
 * The ruler: letters down the left edge and strip numbers along the top (or the other way round on a board seen end
 * on), each beside its row or strip, shown only while the board's own labels are out of view. `top`: px the view's
 * own chrome takes at the top edge (the numbers sit below it).
 */
export function BoardRuler({ store, projector, size, top = 0 }: { store: BenchStore; projector: Projector; size: { w: number; h: number }; top?: number }) {
  const board = useStore(store, (s) => s.bench.board);
  const [marks, setMarks] = useState<RulerMark[]>([]);
  useEffect(() => {
    if (!board) {
      setMarks([]);
      return;
    }
    const cols = boardGeometry(board).cols;
    let raf = 0;
    const work = () => {
      raf = 0;
      const next = rulerMarks(cols, (hole) => projector.project(`hole:${hole}`), size.w, size.h);
      setMarks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    work();
    const off = projector.onViewChange(() => {
      if (!raf) raf = requestAnimationFrame(work);
    });
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [board, projector, size.w, size.h]);
  if (!marks.length) return null;
  return (
    <div className="ohb-ruler" data-ruler="" aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {marks.map((m) => (
        <span key={m.text} style={{ ...MARK, left: m.edge === "left" ? 14 : m.at, top: m.edge === "top" ? top + 12 : m.at }}>
          {m.text}
        </span>
      ))}
    </div>
  );
}
