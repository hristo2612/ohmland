/**
 * The coach mark: as a `do` beat starts, and again after a few seconds with nothing changed on the bench, an ink ghost
 * draws the first move of the beat's task (coach.ts) and fades. Something to carry gets a dotted path with an arrowhead
 * from where it is to where it goes, the meter's dial an arc to the setting, a tap or a press a pulsing ring. Placed with
 * BenchController.project(), so it is the same over the 3D and the ink view. Decorative: the robot's line says it.
 */
import { useEffect, useId, useState, type RefObject } from "react";
import type { BenchState } from "@ohmland/bench/core";
import type { BenchController } from "../../lab/bench-view";
import type { LabRuntime } from "../../lab/runtime";
import { useSize, useViewTick } from "./Annotations";
import { firstMove, type CoachMove } from "./coach";
import { resolveAnchor } from "./marks";

/** After the camera has glided to the beat's parts. */
const FIRST_AT = 700;
/** Quiet time (nothing changed on the bench) before the move is drawn again, and how often in all per beat. */
const IDLE = 6000;
const TIMES = 3;
/** How long one drawing stays: the stroke (--dur-draw), the hold, the fade (bench-lesson.css). */
const LIFE = 2700;

type Pt = { x: number; y: number };
/** A point on screen, and whether it is in view (the ghost is only drawn where the learner can see it). */
type At = (s: string) => (Pt & { on: boolean }) | null;

export function CoachMark({ controllerRef, runtime, bench, task }: { controllerRef: RefObject<BenchController | null>; runtime: LabRuntime; bench: BenchState; task: string }) {
  useViewTick(controllerRef);
  const [ref, size] = useSize();
  const mask = `coach${useId().replace(/\W/g, "")}`;
  const [shown, setShown] = useState<{ move: CoachMove; n: number } | null>(null);

  useEffect(() => {
    let n = 0;
    let seen = runtime.store.getState().bench;
    let quietSince = Date.now();
    let off = 0;
    const draw = () => {
      const now = runtime.store.getState().bench;
      const move = firstMove(runtime.lab, task, now, (c) => runtime.session.view().control(c));
      if (!move) return;
      n++;
      setShown({ move, n });
      window.clearTimeout(off);
      off = window.setTimeout(() => setShown(null), LIFE);
    };
    const first = window.setTimeout(draw, FIRST_AT);
    const watch = window.setInterval(() => {
      const now = runtime.store.getState().bench;
      if (now !== seen) {
        seen = now;
        quietSince = Date.now();
      } else if (n < TIMES && Date.now() - quietSince >= IDLE) {
        quietSince = Date.now();
        draw();
      }
    }, 500);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(off);
      window.clearInterval(watch);
      setShown(null);
    };
  }, [runtime, task]);

  const c = controllerRef.current;
  const at: At = (s) => {
    const p = c?.project(resolveAnchor(bench, s) ?? s);
    return p ? { x: p.x, y: p.y, on: p.visible } : null;
  };
  const host = ref.current;
  const shape = shown && c && size.w ? drawing(shown.move, bench, at, host) : null;
  return (
    <div className="bl-coach-host" ref={ref} aria-hidden="true">
      {shape && (
        <svg className="bl-coach" key={shown!.n} width={size.w} height={size.h}>
          {shape.line && (
            <>
              <mask id={mask} maskUnits="userSpaceOnUse">
                <path className="bl-coach__reveal" d={shape.line} pathLength={1} />
              </mask>
              <path className="bl-coach__halo" d={shape.line} mask={`url(#${mask})`} />
              <path className="bl-coach__line" d={shape.line} mask={`url(#${mask})`} />
              <circle className="bl-coach__start" cx={shape.start.x} cy={shape.start.y} r={7} />
              <path className="bl-coach__head bl-coach__head--halo" d={shape.head} />
              <path className="bl-coach__head" d={shape.head} />
            </>
          )}
          {shape.ring && (
            <g className="bl-coach__ring">
              <circle className="bl-coach__halo" cx={shape.ring.x} cy={shape.ring.y} r={shape.ring.r} />
              <circle cx={shape.ring.x} cy={shape.ring.y} r={shape.ring.r} />
              <circle className="bl-coach__pulse" cx={shape.ring.x} cy={shape.ring.y} r={shape.ring.r} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

type Shape = { line?: string; start: Pt; head?: string; ring?: Pt & { r: number } };

/** The ink for a move, in screen px; null when the points it needs are not in view. */
function drawing(move: CoachMove, bench: BenchState, at: At, host: HTMLElement | null): Shape | null {
  const seen = (p: ReturnType<At>) => (p?.on ? p : null);
  switch (move.kind) {
    case "press": {
      const p = seen(at(move.at));
      return p ? { start: p, ring: { ...p, r: /[./]/.test(move.at) ? 20 : 28 } } : null;
    }
    case "path": {
      const a = move.from === "tray" ? trayPoint(host) : seen(at(move.from));
      const b = move.to ? seen(at(move.to)) : a && pulled(a, move.from, bench, at);
      if (!a || !b) return b ? { start: b, ring: { ...b, r: 20 } } : null;
      // Where it goes is ringed too: a short carry is easy to miss.
      return { ...hop(a, b), ...(move.to ? { ring: { ...b, r: 14 } } : {}) };
    }
    case "dial": {
      const m = (s: string) => at(`part:${move.meter}/${s}`);
      const [mid, top, left, right] = [m("dial"), m("display"), m("a10"), m("vohm")];
      if (!mid?.on || !top || !left || !right) return null;
      // The meter's own axes on screen, per mm: across (10 A socket to VΩ, 51 mm) and along (display to dial, 60 mm).
      const ex = { x: (right.x - left.x) / 51, y: (right.y - left.y) / 51 };
      const ez = { x: (mid.x - top.x) / 60, y: (mid.y - top.y) / 60 };
      let turn = (((move.to - move.from) % 8) + 8) % 8;
      if (turn > 4) turn -= 8;
      // Between the knob (15 mm) and the printed settings (24 mm), clockwise from the top.
      return arc((deg) => {
        const r = (deg * Math.PI) / 180;
        return { x: mid.x + 20 * (ex.x * Math.sin(r) - ez.x * Math.cos(r)), y: mid.y + 20 * (ex.y * Math.sin(r) - ez.y * Math.cos(r)) };
      }, move.from * 45, (move.from + turn) * 45);
    }
    case "turn": {
      const p = seen(at(move.at));
      if (!p) return null;
      return arc((deg) => ({ x: p.x + 30 * Math.sin((deg * Math.PI) / 180), y: p.y - 30 * Math.cos((deg * Math.PI) / 180) }), -135 + 270 * move.from, -135 + 270 * move.to);
    }
  }
}

/** Where a pulled-off clip or wire goes: on along the lead, past the end that lets go (or up, out of the board). */
function pulled(a: Pt, from: string, bench: BenchState, at: At): Pt {
  const lead = /^lead:([^.]+)\.(a|b)$/.exec(from);
  const other = lead && bench.leads.some((l) => l.id === lead[1]) ? at(`lead:${lead[1]}.${lead[2] === "a" ? "b" : "a"}`) : null;
  const dx = other ? a.x - other.x : 0;
  const dy = other ? a.y - other.y : -1;
  const len = Math.hypot(dx, dy) || 1;
  return { x: a.x + (dx / len) * 88, y: a.y + (dy / len) * 88 };
}

/** The middle of the parts tray, for a part that comes from it. */
function trayPoint(host: HTMLElement | null): Pt | null {
  const tray = host?.closest(".bl-stage")?.querySelector(".ohb-tray, .ohi-tray");
  const box = host?.getBoundingClientRect();
  const t = tray?.getBoundingClientRect();
  return t && box && t.width ? { x: t.left + t.width / 2 - box.left, y: t.top + t.height / 2 - box.top } : null;
}

/** A carry from a to b: a curve that lifts up the screen (a short carry lifts more, so it still reads as one). */
function hop(a: Pt, b: Pt): Shape {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) [nx, ny] = [-nx, -ny];
  const lift = Math.max(len * 0.3, 72);
  const ctl = { x: (a.x + b.x) / 2 + nx * lift, y: (a.y + b.y) / 2 + ny * lift };
  return { line: `M${a.x},${a.y} Q${ctl.x},${ctl.y} ${b.x},${b.y}`, start: a, head: arrowHead(ctl, b) };
}

/** An arc through `point(deg)` from one angle to another, sampled every few degrees, with an arrowhead at the end. */
function arc(point: (deg: number) => Pt, from: number, to: number): Shape {
  const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 5));
  const pts = Array.from({ length: steps + 1 }, (_, i) => point(from + ((to - from) * i) / steps));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return { line, start: pts[0]!, head: arrowHead(pts[pts.length - 2]!, pts[pts.length - 1]!) };
}

/** Two short strokes at `tip`, opening back toward `from`. */
function arrowHead(from: Pt, tip: Pt): string {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const wing = (s: number) => `${tip.x - 13 * Math.cos(a + s)},${tip.y - 13 * Math.sin(a + s)}`;
  return `M${wing(0.5)} L${tip.x},${tip.y} L${wing(-0.5)}`;
}
