/**
 * The ink layer over the bench: notes that draw themselves onto parts, names, ticks, pencil rings and x-ray strip
 * outlines. Everything is placed with BenchController.project(), so it follows the camera and looks the same over the
 * 3D and the ink view. Decorative for assistive tech: the margin's live region says what the ink says.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type RefObject } from "react";
import type { BenchState } from "@ohmland/bench/core";
import type { BenchController, ScreenPoint } from "../../lab/bench-view";
import { resolveAnchor, stripHoles, type Mark } from "./marks";

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

/** Where to write a note for a point: beside it, toward the roomier side, with a curved arrow back to it. */
function notePlacement(p: ScreenPoint, size: Size, text: string) {
  const width = Math.min(size.w - 24, text.length * 10.5 + 8);
  const toRight = p.x < size.w * 0.56;
  const up = p.y > 132 || p.y > size.h - 96;
  let tx = p.x + (toRight ? 44 : -44);
  const ty = Math.max(28, Math.min(size.h - 14, p.y + (up ? -72 : 78)));
  if (toRight) tx = Math.max(12, Math.min(tx, size.w - 12 - width));
  else tx = Math.min(size.w - 12, Math.max(tx, 12 + width));
  // The arrow leaves from under the start of the line and lands just short of the point.
  const sx = toRight ? tx + Math.min(26, width / 3) : tx - Math.min(26, width / 3);
  const sy = up ? ty + 10 : ty - 26;
  const dx = p.x - sx;
  const dy = p.y - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ex = p.x - (dx / len) * 9;
  const ey = p.y - (dy / len) * 9;
  // A hand-drawn bow: the control point leans sideways off the straight line.
  const cx = (sx + ex) / 2 + (dy / len) * 22 * (toRight ? 1 : -1);
  const cy = (sy + ey) / 2 - (dx / len) * 22 * (toRight ? 1 : -1);
  const angle = Math.atan2(ey - cy, ex - cx);
  const head = (a: number) => `${ex - Math.cos(angle + a) * 10},${ey - Math.sin(angle + a) * 10}`;
  return {
    tx,
    ty,
    anchor: toRight ? ("start" as const) : ("end" as const),
    path: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`,
    headPath: `M${head(0.45)} L${ex},${ey} L${head(-0.45)}`,
  };
}

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
  const at = (s: string): ScreenPoint | null => {
    const a = resolveAnchor(bench, s);
    const p = a && c ? c.project(a) : null;
    return p && p.visible ? p : null;
  };

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
            const pl = notePlacement(p, size, text);
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
