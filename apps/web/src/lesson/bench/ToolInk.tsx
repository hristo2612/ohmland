/**
 * Instruments drawn on the bench instead of docked beside it (docs/DESIGN-PRINCIPLES.md: the material corrects the
 * learner). Like the ink marks (Annotations.tsx), everything is placed with BenchController.project(), so it reads the
 * same over the 3D and the ink view.
 *
 * - The meter: the bench meter is the instrument (its dial and RANGE key step on the drawing). Over the bench there is
 *   only its reading, large, while its display is off screen or too small to read, and a red pencil ring on the socket
 *   the red lead belongs in when it is in the wrong one.
 * - A continuity table: drawn on its part. Each pair of legs tested gets an arc between them: solid ink labelled with
 *   the positions it beeped in, or dashed with a small cross when it never beeped. Arcs not yet tested in the position
 *   the part is in now are faint, so what is left to probe shows on the part.
 */
import { useEffect, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { isThrowSwitch, partLegs, type PlacedPart } from "@ohmland/bench/core";
import type { PanelConfig } from "../../lab/define";
import type { BenchController, ScreenPoint } from "../../lab/bench-view";
import { socketAdvice } from "../../lab/instruments";
import { continuityArcs, type ContinuityArc } from "../../lab/panels";
import { terminalLabel } from "../../lab/panels-ui";
import type { LabRuntime } from "../../lab/runtime";
import { Icon } from "../../components/Icon";
import { m } from "../../i18n";
import { useSize, useViewTick } from "./Annotations";
import "./tool-ink.css";

type Continuity = Extract<PanelConfig, { kind: "continuity" }>;

/** The continuity table a beat's tool draws on the bench: the tool itself, or the one for the part a pin map names. */
export function continuityFor(panels: readonly PanelConfig[] | undefined, tool: string | null): Continuity | null {
  const cfg = tool ? panels?.find((p) => p.id === tool) : undefined;
  if (!cfg) return null;
  if (cfg.kind === "continuity") return cfg;
  if (cfg.kind === "pin-map") return (panels?.find((p) => p.kind === "continuity" && p.part === cfg.part) as Continuity | undefined) ?? null;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// The meter

/** The display's digits are about 16 mm tall: below this many px per mm they are too small to read on screen. */
const READABLE_PX_PER_MM = 0.85;

/**
 * `act`: the lesson waits for a task on the bench, so a blown mA fuse gets its Replace control at the mA socket (the
 * only one while the meter is the beat's tool; a fuse blown on purpose stays blown through the beat that blew it).
 */
export function MeterInk({ runtime, controllerRef, act }: { runtime: LabRuntime; controllerRef: RefObject<BenchController | null>; act: boolean }) {
  useViewTick(controllerRef);
  const [ref, size] = useSize();
  const meter = useStore(runtime.store, (s) => s.bench.meter);
  const reading = useStore(runtime.store, (s) => (meter ? s.snapshot?.parts[meter.id] : undefined));
  const spares = useStore(runtime.ui, (s) => s.spareFuses);
  const c = controllerRef.current;
  if (!meter) return null;
  const off = meter.mode === "off";
  const display = off ? "" : (reading?.display?.trim() ?? "");
  const unit = off ? "" : (reading?.unit ?? "");
  const at = (t: string): ScreenPoint | null => c?.project(t) ?? null;
  // Readable on screen: the display (about 58 by 30 mm) is on the bench nearly whole, at a size its digits can be read.
  const lcd = at(`part:${meter.id}/display`);
  const com = at("socket:com");
  const vohm = at("socket:vohm");
  const pxPerMm = com && vohm ? Math.hypot(vohm.x - com.x, vohm.y - com.y) / 17 : 0;
  const mx = 22 * pxPerMm;
  const my = 10 * pxPerMm;
  const onScreen = !!lcd && lcd.visible && lcd.x > mx && lcd.y > my && lcd.x < size.w - mx && lcd.y < size.h - my && pxPerMm >= READABLE_PX_PER_MM;
  const advice = off ? null : socketAdvice(meter, (a, b) => runtime.session.view().volts(a, b));
  const ring = advice ? at(`socket:${advice.socket}`) : null;
  const r = Math.max(14, pxPerMm * 7);
  const fuse = act && reading?.extra?.["fuse"] === "blown" ? at("socket:ma") : null;
  return (
    <div className="ti" ref={ref}>
      {fuse?.visible && (
        <button
          type="button"
          className="bl-replace"
          style={{ left: Math.max(64, Math.min(size.w - 64, fuse.x)), top: fuse.y + 72 < size.h - 8 ? fuse.y + 40 : Math.max(8, fuse.y - 84) }}
          data-replace
          disabled={spares === 0}
          onClick={() => runtime.replaceFuse()}
        >
          <Icon name="retry" size={16} />
          {m.lab.meter.replaceFuse}
        </button>
      )}
      {size.w > 0 && ring?.visible && (
        <svg className="ti__svg" width={size.w} height={size.h} aria-hidden="true">
          <g className="ti-ring" data-socket-ring={advice!.socket}>
            <path pathLength={1} d={`M${ring.x + r},${ring.y} A${r},${r * 0.86} 0 1 1 ${ring.x + r * 0.97},${ring.y - r * 0.3}`} />
          </g>
        </svg>
      )}
      {!onScreen && (
        <p className="ti-reading" data-meter-reading={display} aria-hidden="true">
          {off ? (
            <span className="ti-reading__off">{m.lab.meter.off}</span>
          ) : (
            <>
              <span className="ti-reading__value">{display || m.lab.meter.blank}</span>
              <span className="ti-reading__unit">{unit}</span>
            </>
          )}
        </p>
      )}
      <p className="sr-only">
        {`${m.lab.meter.title}: ${off ? m.lab.meter.off : `${m.lab.meter.modes[meter.mode]}, ${display || m.lab.meter.blank} ${unit}`}.`}
        {advice ? ` ${m.lab.meter[advice.why]}` : ""}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Continuity, drawn on the part

/** A side's label on an arc: the slider's A or B, a one-way toggle's on or off, a button at rest or held. */
function sideLabel(part: PlacedPart, side: string): string {
  if (part.kind === "toggle-switch" && (part.params as { throws?: number }).throws === 1) return m.lessonBench.arcs.sides[side === "b" ? "on" : "off"]!;
  return m.lessonBench.arcs.sides[side] ?? side;
}

type Drawn = ContinuityArc & { d: string; apex: { x: number; y: number }; label: { x: number; y: number }; n: { x: number; y: number } };

/** Screen geometry of every arc: a bow between the two legs, bulging off the row of legs toward the front of the part. */
function layout(part: PlacedPart, arcs: ContinuityArc[], at: (leg: string) => ScreenPoint | null): Drawn[] {
  const legs = partLegs(part);
  const pts = legs.map((l) => at(l));
  const shown = pts.filter((p): p is ScreenPoint => !!p && p.visible);
  if (shown.length < 2) return [];
  const cx = shown.reduce((s, p) => s + p.x, 0) / shown.length;
  const cy = shown.reduce((s, p) => s + p.y, 0) / shown.length;
  const out: Drawn[] = [];
  for (const arc of arcs) {
    const p = pts[legs.indexOf(arc.a)];
    const q = pts[legs.indexOf(arc.b)];
    if (!p?.visible || !q?.visible) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Legs in a row (a block's screws, left to right): the front of the part is to the right of the row on screen.
    // Off the row (a square of legs), bulge away from the middle of them.
    let n = { x: -dy / len, y: dx / len };
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const off = (mx - cx) * n.x + (my - cy) * n.y;
    if (off < -2) n = { x: -n.x, y: -n.y };
    const h = Math.min(80, Math.max(16, len * 0.34));
    const apex = { x: mx + n.x * h, y: my + n.y * h };
    out.push({
      ...arc,
      d: `M${p.x},${p.y} Q${mx + n.x * h * 2},${my + n.y * h * 2} ${q.x},${q.y}`,
      apex,
      label: { x: apex.x + n.x * 13, y: apex.y + n.y * 13 },
      n,
    });
  }
  return out;
}

export function ContinuityInk({ runtime, controllerRef, panel }: { runtime: LabRuntime; controllerRef: RefObject<BenchController | null>; panel: Continuity }) {
  useViewTick(controllerRef);
  const [ref, size] = useSize();
  useStore(runtime.ui, (s) => s.panels);
  const part = useStore(runtime.store, (s) => s.bench.parts.find((p) => p.id === panel.part));
  const pressed = useStore(runtime.store, (s) => !!s.ui.pressed[panel.part]);
  const cells = runtime.session.panels[panel.id]?.cells ?? {};
  const now = part ? (isThrowSwitch(part.kind) ? (part.params as { to: string }).to : pressed ? "down" : "up") : null;
  const arcs = part ? continuityArcs(part, cells, now) : [];
  // Each newly logged pair is said once, for screen readers (the drawing is decorative for them).
  const [said, setSaid] = useState("");
  const keys = Object.keys(cells).join("|");
  useEffect(() => {
    const last = Object.keys(cells).pop();
    if (!last || !part) return;
    const [ab] = last.split("@");
    const [a, b] = (ab ?? "").split("|");
    setSaid(m.lab.panels.logged(terminalLabel(part, a!), terminalLabel(part, b!), cells[last] ? m.lab.panels.beep : m.lab.panels.open));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  const c = controllerRef.current;
  if (!part) return null;
  // Silent pairs first, so the ones that beeped are drawn over them.
  const drawn = c ? layout(part, arcs, (leg) => c.project(`pin:${part.id}.${leg}`)).sort((x, y) => Math.sign(x.beeps.length) - Math.sign(y.beeps.length)) : [];
  return (
    <div className="ti" ref={ref} data-continuity={panel.id}>
      {size.w > 0 && (
        <svg className="ti__svg" width={size.w} height={size.h} aria-hidden="true">
          {drawn.map((a) => {
            const beep = a.beeps.length > 0;
            const k = 3.8;
            return (
              <g
                key={`${a.a}|${a.b}|${a.beeps.join("")}`}
                className={`ti-arc${beep ? " ti-arc--beep" : " ti-arc--open"}${a.now ? "" : " ti-arc--faint"}`}
                data-arc={`${a.a}-${a.b}`}
                data-beeps={a.beeps.join(",")}
                data-tested={a.tested.join(",")}
              >
                <path className="ti-arc__line" pathLength={beep ? 1 : undefined} d={a.d} />
                {beep ? (
                  <text className="ti-arc__label" x={a.label.x} y={a.label.y} textAnchor="middle" dominantBaseline="central">
                    {a.beeps.map((s) => sideLabel(part, s)).join(" ")}
                  </text>
                ) : (
                  <path className="ti-arc__cross" d={`M${a.apex.x - k},${a.apex.y - k} L${a.apex.x + k},${a.apex.y + k} M${a.apex.x + k},${a.apex.y - k} L${a.apex.x - k},${a.apex.y + k}`} />
                )}
              </g>
            );
          })}
        </svg>
      )}
      <ul className="sr-only" aria-label={panel.title ?? m.lab.panels.continuity(runtime.built.labels[part.id] ?? part.id)}>
        {arcs.map((a) => (
          <li key={`${a.a}|${a.b}`}>
            {m.lessonBench.arcs.pair(
              terminalLabel(part, a.a),
              terminalLabel(part, a.b),
              a.beeps.map((s) => sideLabel(part, s)),
              a.tested.filter((s) => !a.beeps.includes(s)).map((s) => sideLabel(part, s)),
            )}
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

