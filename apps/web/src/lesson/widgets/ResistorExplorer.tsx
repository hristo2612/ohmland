import { useId, useState } from "react";
import { m } from "../../i18n";
import { bandsForOhms } from "../../quiz/colorCode";
import { Resistor } from "../../quiz/Resistor";
import { formatSI } from "../../quiz/si";
import type { WidgetProps } from "./registry";
import "./widgets.css";

const VALUES = [10, 47, 100, 220, 330, 470, 680, 1000, 2200, 4700, 10000, 47000, 100000, 1000000];

/** Pick a common value and watch the bands change. */
export default function ResistorExplorer({ props }: WidgetProps) {
  const id = useId();
  const start = typeof props.ohms === "number" ? props.ohms : 4700;
  const [i, setI] = useState(Math.max(0, VALUES.indexOf(start)));
  const ohms = VALUES[i] ?? 4700;
  const bands = bandsForOhms(ohms, 4) ?? [];
  const names = bands.slice(0, 3).map((b) => m.bands[b]).join(", ");
  return (
    <div className="widget explorer">
      <p className="widget__title">{m.widgets.resistorExplorer.title}</p>
      <Resistor bands={bands} className="explorer__resistor" />
      <p className="explorer__bands small" aria-live="polite">
        {m.widgets.resistorExplorer.reads(names)}
      </p>
      <label className="slider" htmlFor={id}>
        <span className="slider__label">{m.widgets.resistorExplorer.value}</span>
        <output className="slider__value mono" htmlFor={id}>
          {formatSI(ohms, "Ω")}
        </output>
        <input id={id} type="range" min={0} max={VALUES.length - 1} step={1} value={i} aria-valuetext={formatSI(ohms, "Ω")} onChange={(e) => setI(Number(e.target.value))} />
      </label>
    </div>
  );
}
