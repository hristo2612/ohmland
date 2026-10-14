/**
 * Instruments drawn on the bench instead of docked beside it (docs/DESIGN-PRINCIPLES.md: the material corrects the
 * learner). Like the ink marks (Annotations.tsx), everything is placed with BenchController.project(), so it reads the
 * same over the 3D and the ink view.
 *
 * - The meter: the bench meter is the instrument (its dial and RANGE key step on the drawing). Over the bench there is
 *   a red pencil ring on the socket the red lead belongs in when it is in the wrong one, and, only while part of the
 *   meter is out of view (a beat framed close on what it measures), a slip that stands in for that part: the reading,
 *   large, for the display; a key that steps like the dial; a key that steps like RANGE.
 * - A continuity table: drawn on its part (ContinuityArcs.tsx). Each pair of legs tested gets an arc between them:
 *   solid ink labelled with the positions it beeped in, or dashed with a small cross when it never beeped. Arcs not
 *   yet tested in the position the part is in now are faint, so what is left to probe shows on the part.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useStore } from "zustand";
import { METER_RANGES, isThrowSwitch, meterRange, rangeText } from "@ohmland/bench/core";
import type { PanelConfig } from "../../lab/define";
import type { BenchController, ScreenPoint } from "../../lab/bench-view";
import { socketAdvice } from "../../lab/instruments";
import { continuityArcs } from "../../lab/panels";
import type { LabRuntime } from "../../lab/runtime";
import { Icon } from "../../components/Icon";
import { m } from "../../i18n";
import { useSize, useViewTick } from "./Annotations";
import { ArcMarks, arcLayout, legLabel, pairSaid } from "./ContinuityArcs";
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
/** Below this many px per mm the dial's knob and the RANGE key (touch areas larger than drawn) are too small to tap. */
const TAPPABLE_PX_PER_MM = 0.9;
/** A long press steps a meter key back, as the bench's dial and RANGE key do. */
const LONG_PRESS_MS = 520;

/**
 * `act`: the lesson waits for a task on the bench, so a blown mA fuse gets its Replace control at the mA socket (the
 * only one while the meter is the beat's tool; a fuse blown on purpose stays blown through the beat that blew it).
 */
export function MeterInk({ runtime, controllerRef, act, readOnly }: { runtime: LabRuntime; controllerRef: RefObject<BenchController | null>; act: boolean; readOnly: boolean }) {
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
  // Scale from two sockets 17 mm apart, and whether a spot is on the bench with this much room round it.
  const com = at("socket:com");
  const vohm = at("socket:vohm");
  const k = com && vohm ? Math.hypot(vohm.x - com.x, vohm.y - com.y) / 17 : 0;
  const inView = (p: ScreenPoint | null, mx: number, my: number) => !!p && p.visible && p.x > mx && p.y > my && p.x < size.w - mx && p.y < size.h - my;
  // The display (about 58 by 30 mm) nearly whole, its digits big enough to read; the dial's knob and the RANGE key
  // whole, big enough to tap. What is not, the slip over the bench stands in for: the number, a dial key, a RANGE key.
  const displayShown = inView(at(`part:${meter.id}/display`), 22 * k, 10 * k) && k >= READABLE_PX_PER_MM;
  const dialShown = inView(at(`part:${meter.id}/dial`), 12 * k, 12 * k) && k >= TAPPABLE_PX_PER_MM;
  const ranged = !!METER_RANGES[meter.mode];
  const rangeShown = !ranged || (inView(at(`part:${meter.id}/range`), 7 * k, 3 * k) && k >= TAPPABLE_PX_PER_MM);
  const step = (what: "dial" | "range", dir: 1 | -1) => !readOnly && runtime.store.getState().stepMeter(what, dir);
  const advice = off ? null : socketAdvice(meter, (a, b) => runtime.session.view().volts(a, b));
  const ring = advice ? at(`socket:${advice.socket}`) : null;
  const r = Math.max(14, k * 7);
  // A blown fuse is replaced at the mA socket, or from the slip while the socket is out of view.
  const blown = act && reading?.extra?.["fuse"] === "blown";
  const fuse = blown ? at("socket:ma") : null;
  const fuseShown = !!fuse && inView(fuse, 24, 24);
  const replace = (style?: CSSProperties) => (
    <button type="button" className="bl-replace" style={style} data-replace disabled={spares === 0} onClick={() => runtime.replaceFuse()}>
      <Icon name="retry" size={16} />
      {m.lab.meter.replaceFuse}
    </button>
  );
  return (
    <div className="ti" ref={ref}>
      {fuse && fuseShown && replace({ left: Math.max(64, Math.min(size.w - 64, fuse.x)), top: fuse.y + 72 < size.h - 8 ? fuse.y + 40 : Math.max(8, fuse.y - 84) })}
      {size.w > 0 && ring?.visible && (
        <svg className="ti__svg" width={size.w} height={size.h} aria-hidden="true">
          <g className="ti-ring" data-socket-ring={advice!.socket}>
            <path pathLength={1} d={`M${ring.x + r},${ring.y} A${r},${r * 0.86} 0 1 1 ${ring.x + r * 0.97},${ring.y - r * 0.3}`} />
          </g>
        </svg>
      )}
      {size.w > 0 && (!displayShown || !dialShown || !rangeShown || (blown && !fuseShown)) && (
        <div className="ti-slip" role="group" aria-label={m.lab.meter.title} data-meter-slip>
          {blown && !fuseShown && replace()}
          {!dialShown && (
            <StepKey name={m.lessonBench.meterKeys.dial(m.lab.meter.modes[meter.mode] ?? meter.mode)} data="dial" onStep={(dir) => step("dial", dir)}>
              {m.lab.meter.short[meter.mode]}
            </StepKey>
          )}
          {!displayShown && (
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
          {!rangeShown && (
            <StepKey name={m.lessonBench.meterKeys.range(meterRange(meter) === "auto" ? m.benchUi.meterAuto : rangeText(meterRange(meter)))} data="range" onStep={(dir) => step("range", dir)}>
              {rangeText(meterRange(meter))}
            </StepKey>
          )}
        </div>
      )}
      <p className="sr-only">
        {`${m.lab.meter.title}: ${off ? m.lab.meter.off : `${m.lab.meter.modes[meter.mode]}, ${display || m.lab.meter.blank} ${unit}`}.`}
        {advice ? ` ${m.lab.meter[advice.why]}` : ""}
      </p>
    </div>
  );
}

/** A meter key on the slip: a tap steps it on, a long press (or an arrow down) steps it back, as on the bench. */
function StepKey({ name, data, onStep, children }: { name: string; data: string; onStep(dir: 1 | -1): void; children: ReactNode }) {
  const held = useRef<{ timer: number; fired: boolean } | null>(null);
  const release = () => {
    if (held.current) window.clearTimeout(held.current.timer);
  };
  return (
    <button
      type="button"
      className="ti-key"
      aria-label={name}
      title={m.lessonBench.meterKeys.how}
      data-meter-key={data}
      onPointerDown={() => {
        const h = { timer: 0, fired: false };
        h.timer = window.setTimeout(() => {
          h.fired = true;
          onStep(-1);
        }, LONG_PRESS_MS);
        held.current = h;
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        const fired = held.current?.fired;
        held.current = null;
        if (!fired) onStep(1);
      }}
      onKeyDown={(e) => {
        const dir = e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : 0;
        if (!dir) return;
        e.preventDefault();
        onStep(dir);
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Continuity, drawn on the part

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
    setSaid(m.lab.panels.logged(legLabel(part, a!), legLabel(part, b!), cells[last] ? m.lab.panels.beep : m.lab.panels.open));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  const c = controllerRef.current;
  if (!part) return null;
  const drawn = c ? arcLayout(part, arcs, (leg) => c.project(`pin:${part.id}.${leg}`)) : [];
  return (
    <div className="ti" ref={ref} data-continuity={panel.id}>
      {size.w > 0 && (
        <svg className="ti__svg" width={size.w} height={size.h} aria-hidden="true">
          <ArcMarks part={part} drawn={drawn} />
        </svg>
      )}
      <ul className="sr-only" aria-label={panel.title ?? m.lab.panels.continuity(runtime.built.labels[part.id] ?? part.id)}>
        {arcs.map((a) => (
          <li key={`${a.a}|${a.b}`}>{pairSaid(part, a)}</li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

