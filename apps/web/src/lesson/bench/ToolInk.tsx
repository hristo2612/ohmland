/**
 * Instruments drawn on the bench instead of docked beside it (docs/DESIGN-PRINCIPLES.md: the material corrects the
 * learner). Like the ink marks (Annotations.tsx), everything is placed with BenchController.project(), so it reads the
 * same over the 3D and the ink view.
 *
 * - The meter: the bench meter is the instrument (its dial and RANGE key step on the drawing). Over the bench there is
 *   only its reading, large, while its display is off screen or too small to read, and a red pencil ring on the socket
 *   the red lead belongs in when it is in the wrong one.
 * - A continuity table: drawn on its part (ContinuityArcs.tsx). Each pair of legs tested gets an arc between them:
 *   solid ink labelled with the positions it beeped in, or dashed with a small cross when it never beeped. Arcs not
 *   yet tested in the position the part is in now are faint, so what is left to probe shows on the part.
 */
import { useEffect, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { isThrowSwitch } from "@ohmland/bench/core";
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

