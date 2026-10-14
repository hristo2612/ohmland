/**
 * Instruments drawn on the bench instead of docked beside it (docs/DESIGN-PRINCIPLES.md: the material corrects the
 * learner). Like the ink marks (Annotations.tsx), everything is placed with BenchController.project(), so it reads the
 * same over the 3D and the ink view.
 *
 * - The meter: the bench meter is the instrument (its dial and RANGE key step on the drawing). Over the bench there is
 *   only its reading, large, while its display is off screen or too small to read, and a red pencil ring on the socket
 *   the red lead belongs in when it is in the wrong one.
 */
import type { RefObject } from "react";
import { useStore } from "zustand";
import type { BenchController, ScreenPoint } from "../../lab/bench-view";
import { socketAdvice } from "../../lab/instruments";
import type { LabRuntime } from "../../lab/runtime";
import { m } from "../../i18n";
import { useSize, useViewTick } from "./Annotations";
import "./tool-ink.css";

// ---------------------------------------------------------------------------------------------------------------
// The meter

/** The display's digits are about 16 mm tall: below this many px per mm they are too small to read on screen. */
const READABLE_PX_PER_MM = 0.85;

export function MeterInk({ runtime, controllerRef }: { runtime: LabRuntime; controllerRef: RefObject<BenchController | null> }) {
  useViewTick(controllerRef);
  const [ref, size] = useSize();
  const meter = useStore(runtime.store, (s) => s.bench.meter);
  const reading = useStore(runtime.store, (s) => (meter ? s.snapshot?.parts[meter.id] : undefined));
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
  return (
    <div className="ti" ref={ref}>
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
