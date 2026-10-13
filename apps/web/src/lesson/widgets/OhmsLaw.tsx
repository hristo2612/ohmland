import { useId, useState } from "react";
import { m } from "../../i18n";
import { formatSI } from "../../quiz/si";
import type { WidgetProps } from "./registry";
import "./widgets.css";

const OHMS = [100, 150, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700, 10000];

/** Ohm's law with two sliders and a live current readout, plus a little LED that brightens with the current. */
export default function OhmsLaw({ props }: WidgetProps) {
  const id = useId();
  const startOhms = typeof props.ohms === "number" ? props.ohms : 470;
  const [volts, setVolts] = useState(typeof props.volts === "number" ? props.volts : 7);
  const [ri, setRi] = useState(Math.max(0, OHMS.indexOf(startOhms)));
  const ohms = OHMS[ri] ?? 470;
  const amps = volts / ohms;
  const mA = amps * 1000;
  const glow = Math.min(1, mA / 20);
  const note = mA < 2 ? m.widgets.ohmsLaw.ledDim : mA <= 20 ? m.widgets.ohmsLaw.ledSafe : m.widgets.ohmsLaw.ledHot;
  const tone = mA > 20 ? "hot" : mA < 2 ? "dim" : "ok";

  return (
    <div className="widget ohms">
      <p className="widget__title">{m.widgets.ohmsLaw.title}</p>
      <div className="ohms__grid">
        <div className="ohms__controls">
          <label className="slider" htmlFor={`${id}-v`}>
            <span className="slider__label">{m.widgets.ohmsLaw.voltage}</span>
            <output className="slider__value mono" htmlFor={`${id}-v`}>
              {formatSI(volts, "V")}
            </output>
            <input id={`${id}-v`} type="range" min={0} max={12} step={0.5} value={volts} onChange={(e) => setVolts(Number(e.target.value))} />
          </label>
          <label className="slider" htmlFor={`${id}-r`}>
            <span className="slider__label">{m.widgets.ohmsLaw.resistance}</span>
            <output className="slider__value mono" htmlFor={`${id}-r`}>
              {formatSI(ohms, "Ω")}
            </output>
            <input
              id={`${id}-r`}
              type="range"
              min={0}
              max={OHMS.length - 1}
              step={1}
              value={ri}
              aria-valuetext={formatSI(ohms, "Ω")}
              onChange={(e) => setRi(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="ohms__readout" data-tone={tone}>
          <div className="ohms__led" aria-hidden="true">
            <span className="ohms__halo" style={{ opacity: glow }} />
            <svg viewBox="0 0 40 56" width="40" height="56">
              <path d="M14 40v14M26 40v10" style={{ stroke: "var(--lead)", strokeWidth: 2.5, strokeLinecap: "round" }} />
              <path d="M8 40V20a12 12 0 0 1 24 0v20z" style={{ fill: "var(--led-red)", opacity: 0.35 + glow * 0.65 }} />
              <path d="M5 38h30v4H5z" style={{ fill: "var(--led-red)" }} />
            </svg>
          </div>
          <div>
            <span className="ohms__label">{m.widgets.ohmsLaw.current}</span>
            <output className="ohms__value mono" aria-live="polite">
              {formatSI(amps, "A")}
            </output>
            <span className="ohms__formula mono">{m.widgets.ohmsLaw.formula}</span>
            <p className="ohms__note small">{note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
