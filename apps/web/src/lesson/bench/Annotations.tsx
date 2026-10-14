/**
 * The ink layer over the bench: notes that draw themselves onto parts, names, ticks, pencil rings and x-ray strip
 * outlines. Everything is placed with BenchController.project(), so it follows the camera and looks the same over the
 * 3D and the ink view. Decorative for assistive tech: the margin's live region says what the ink says.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type RefObject } from "react";
import { PRINTED_KINDS, boardGeometry, partLegs, partMarks, type BenchState } from "@ohmland/bench/core";
import type { BenchController, ScreenPoint } from "../../lab/bench-view";
import { resolveAnchor, stripHoles, type Mark } from "./marks";
import { placeNotes, rectOf, type NoteOut, type Pt, type Rect } from "./noteLayout";

type Size = { w: number; h: number };

/** Re-renders whenever the bench view moves (camera, layout, bench edits). */
export function useViewTick(controllerRef: RefObject<BenchController | null>): number {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let off: (() => void) | null = null;
    let raf = 0;
    const attach = () => {
      const c = controllerRef.current;
      if (!c) {
        raf = requestAnimationFrame(attach);
        return;
      }
      off = c.onViewChange(bump);
      bump();
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      off?.();
    };
  }, [controllerRef]);
  return tick;
}

export function useSize(): [RefObject<HTMLDivElement | null>, Size] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** The meter's named spots (`part:M1/<spot>`): with its middle, they outline it on screen. */
const METER_SPOTS = ["display", "dial", "com", "vohm", "ma", "a10"] as const;

/**
 * What a note must not cover, on screen: every part (its middle, legs and marks, grown a little), the meter, the
 * breadboard (its corner holes) and the bench's own slips and panels (tools, tray, a docked instrument). Also each
 * part's outline by id, so an arrow about a whole part can end on it.
 */
function benchObstacles(bench: BenchState, c: BenchController, host: HTMLElement | null): { rects: Rect[]; parts: Map<string, { rect: Rect; marks?: Pt[] }> } {
  const at = (a: string): Pt | null => {
    const p = c.project(a);
    return p && p.visible ? p : null;
  };
  const rects: Rect[] = [];
  const parts = new Map<string, { rect: Rect; marks?: Pt[] }>();
  const keep = (id: string, anchors: string[], pad: number, symbols?: string[]) => {
    const tight = rectOf(anchors.map(at).filter((p): p is Pt => !!p), 0);
    if (!tight) return;
    // A part's body reaches past its legs and marks, the more so the closer the camera: grow with its size on screen.
    const grow = Math.max(pad, 0.12 * Math.max(tight.x1 - tight.x0, tight.y1 - tight.y0));
    const r = { x0: tight.x0 - grow, y0: tight.y0 - grow, x1: tight.x1 + grow, y1: tight.y1 + grow };
    rects.push(r);
    // A drawing's marks are its symbols, and its lines run through them: an arrow about the drawing ends on one.
    const marks = symbols?.map(at).filter((p): p is Pt => !!p);
    parts.set(id, marks?.length ? { rect: r, marks } : { rect: r });
  };
  for (const p of bench.parts) {
    const marks = Object.keys(partMarks(p)).map((k) => `part:${p.id}/${k}`);
    // A printed prop's paper reaches well past its marks.
    keep(p.id, [`part:${p.id}`, ...partLegs(p).map((l) => `pin:${p.id}.${l}`), ...marks], PRINTED_KINDS.has(p.kind) ? 88 : 18, p.kind === "schematic" ? marks : undefined);
  }
  if (bench.meter) keep(bench.meter.id, [`part:${bench.meter.id}`, ...METER_SPOTS.map((s) => `part:${bench.meter!.id}/${s}`)], 24);
  if (bench.board) {
    const holes = [...boardGeometry(bench.board).holes.values()];
    const corner = (f: (h: (typeof holes)[number]) => number) => holes.reduce((a, b) => (f(b) < f(a) ? b : a));
    const ends = [corner((h) => h.x + h.z), corner((h) => -h.x - h.z), corner((h) => h.x - h.z), corner((h) => h.z - h.x)];
    const r = rectOf(ends.map((h) => at(`hole:${h.id}`)).filter((p): p is Pt => !!p), 22);
    if (r) rects.push(r);
  }
  // The bench's slips and panels, and the lesson's own (a docked tool, the pop-up card, a Replace control).
  const stage = host?.closest(".bl-stage");
  const origin = host?.getBoundingClientRect();
  if (stage && origin) {
    for (const el of stage.querySelectorAll<HTMLElement>(".ohi-slip, .ohb-panel, .bl-tool, .bl-popup, .bl-replace")) {
      const b = el.getBoundingClientRect();
      if (b.width && b.height) rects.push({ x0: b.left - origin.left - 6, y0: b.top - origin.top - 6, x1: b.right - origin.left + 6, y1: b.bottom - origin.top + 6 });
    }
  }
  return { rects, parts };
}

/** The part a mark is about, when it is about a whole part ("part:CARD", not "part:CARD/D1" or a leg). */
const wholePart = (anchor: string | null): string | null => (anchor && /^part:[^/.]+$/.test(anchor) ? anchor.slice(5) : null);

/** A stadium (rounded bar) around the segment a-b. */
function stadium(a: ScreenPoint, b: ScreenPoint, r: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  return `M${a.x + nx},${a.y + ny} L${b.x + nx},${b.y + ny} A${r},${r} 0 0 1 ${b.x - nx},${b.y - ny} L${a.x - nx},${a.y - ny} A${r},${r} 0 0 1 ${a.x + nx},${a.y + ny} Z`;
}

export function Annotations({ controllerRef, bench, marks }: { controllerRef: RefObject<BenchController | null>; bench: BenchState; marks: Mark[] }) {
  useViewTick(controllerRef);
  const [ref, size] = useSize();
  const c = controllerRef.current;
  /** Last frame's spot per note, so a note stays put while the camera glides. */
  const spots = useRef(new Map<string, number>());
  const at = (s: string): ScreenPoint | null => {
    const a = resolveAnchor(bench, s);
    const p = a && c ? c.project(a) : null;
    return p && p.visible ? p : null;
  };

  // The notes and names, laid out together: the live ones first (they avoid the bench and each other), then the faded
  // ones (only their dot shows, but they fade out from where they were).
  const written = marks.filter((mk) => (mk.kind === "note" || mk.kind === "label") && at(mk.at)).sort((a, b) => Number(!!a.faded) - Number(!!b.faded));
  let layout = new Map<string, NoteOut>();
  if (c && size.w > 0 && written.length) {
    const fontPx = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches ? 18 : 21;
    const { rects, parts } = benchObstacles(bench, c, ref.current);
    const placed = placeNotes(
      written.map((mk) => {
        const whole = parts.get(wholePart(resolveAnchor(bench, mk.at)) ?? "");
        return {
          id: mk.id,
          p: at(mk.at)!,
          target: whole?.rect ?? null,
          marks: whole?.marks,
          w: (mk.text ?? "").length * fontPx * 0.5 + 8,
          h: Math.round(fontPx * 1.15),
          prev: spots.current.get(mk.id),
        };
      }),
      rects,
      size,
    );
    layout = new Map(placed.map((n) => [n.id, n]));
    spots.current = new Map(placed.map((n) => [n.id, n.candidate]));
  }

  return (
    <div className="bl-ink" ref={ref} aria-hidden="true">
      {size.w > 0 && c && (
        <svg className="bl-ink__svg" width={size.w} height={size.h}>
          {marks.map((mk) => {
            if (mk.kind === "strip") {
              const holes = stripHoles(bench, mk.at)
                .map((h) => at(`hole:${h}`))
                .filter((p): p is ScreenPoint => !!p);
              if (holes.length < 2) return null;
              let a = holes[0]!;
              let b = holes[1]!;
              let best = -1;
              for (const p of holes)
                for (const q of holes) {
                  const d = Math.hypot(p.x - q.x, p.y - q.y);
                  if (d > best) {
                    best = d;
                    a = p;
                    b = q;
                  }
                }
              return (
                <g key={mk.id} className={`ann ann--strip ann--${mk.tone}`}>
                  <path className="ann__path" pathLength={1} d={stadium(a, b, 9)} />
                </g>
              );
            }
            const p = at(mk.at);
            if (!p) return null;
            if (mk.kind === "tick")
              return (
                <g key={mk.id} className={`ann ann--tick ann--${mk.tone}`} transform={`translate(${p.x + 10},${p.y - 16})`}>
                  <path className="ann__path" pathLength={1} d="M-8,1 L-3,7 L9,-8" />
                </g>
              );
            if (mk.kind === "ring") {
              // A whole part gets a loose pencil loop; a leg or a hole a small ring.
              const whole = (resolveAnchor(bench, mk.at) ?? "").startsWith("part:");
              const rx = whole ? 52 : 15;
              const ry = whole ? 34 : 11;
              return (
                <g key={mk.id} className={`ann ann--ring ann--${mk.tone}`}>
                  <path className="ann__path" pathLength={1} d={`M${p.x + rx},${p.y} A${rx},${ry} 0 1 1 ${p.x + rx * 0.97},${p.y - ry * 0.3}`} />
                </g>
              );
            }
            const text = mk.text ?? "";
            const pl = layout.get(mk.id);
            if (!pl) return null;
            return (
              <g key={mk.id} className={`ann ann--${mk.kind} ann--${mk.tone}${mk.faded ? " ann--faded" : ""}`}>
                <path className="ann__path" pathLength={1} d={pl.path} />
                <path className="ann__path ann__head" pathLength={1} d={pl.headPath} />
                <text className="ann__text" x={pl.tx} y={pl.ty} textAnchor={pl.anchor}>
                  {text}
                </text>
                <circle className="ann__dot" cx={p.x} cy={p.y} r={3.5} />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
