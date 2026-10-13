/**
 * The pop-up card's one widget so far: swap the resistor's value with a slider and watch the LED on the bench. The
 * bench part really changes (its colour bands too), the simulator recomputes, and the card reads the current through
 * the LED. Closing the card puts the lab's own resistor back.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "zustand";
import { benchOps, formatOhms } from "@ohmland/bench/core";
import { m } from "../../i18n";
import type { LabRuntime } from "../../lab/runtime";

type Props = { runtime: LabRuntime; props: Record<string, unknown>; onDone(): void };

export function ResistorSlider({ runtime, props, onDone }: Props) {
  const part = typeof props["part"] === "string" ? props["part"] : "R1";
  const led = typeof props["led"] === "string" ? props["led"] : "D1";
  const values = Array.isArray(props["values"]) ? (props["values"] as number[]).filter((v) => typeof v === "number" && v > 0) : [470, 1000, 1500, 4700];
  const original = useRef<number | null>(null);
  const start = () => {
    const p = runtime.store.getState().bench.parts.find((x) => x.id === part);
    const ohms = p && p.kind === "resistor" ? p.params.ohms : values[0]!;
    if (original.current === null) original.current = ohms;
    const i = values.indexOf(ohms);
    return i >= 0 ? i : 0;
  };
  const [index, setIndex] = useState(start);
  const id = useId();
  const mA = useStore(runtime.store, (s) => Math.abs(s.snapshot?.parts[led]?.i ?? 0) * 1000);

  const set = (i: number) => {
    setIndex(i);
    runtime.store.getState().apply((b) => benchOps.setPartParams(b, part, { ohms: values[i]! }));
  };

  // Closing the card puts the lab's resistor back.
  useEffect(
    () => () => {
      const o = original.current;
      if (o !== null) runtime.store.getState().apply((b) => benchOps.setPartParams(b, part, { ohms: o }));
    },
    [runtime, part],
  );

  return (
    <div className="bl-slider">
      <p className="bl-slider__read">
        <output htmlFor={id} className="bl-slider__ma" aria-live="polite">
          {mA.toFixed(mA < 10 ? 1 : 0)} mA
        </output>
        <span className="bl-slider__unit">{m.lessonBench.popup.through}</span>
      </p>
      <label className="bl-slider__label" htmlFor={id}>
        {m.lessonBench.popup.resistor}: <strong>{formatOhms(values[index]!)}</strong>
      </label>
      <input
        id={id}
        className="bl-slider__range"
        type="range"
        min={0}
        max={values.length - 1}
        step={1}
        value={index}
        aria-valuetext={formatOhms(values[index]!)}
        onChange={(e) => set(Number(e.target.value))}
      />
      <ol className="bl-slider__stops" aria-hidden="true">
        {values.map((v, i) => (
          <li key={v} data-on={i === index || undefined}>
            {formatOhms(v)}
          </li>
        ))}
      </ol>
      <p className="bl-slider__caption">{m.lessonBench.popup.caption}</p>
      <button type="button" className="btn btn--primary" data-primary onClick={onDone}>
        {m.lessonBench.popup.done}
      </button>
    </div>
  );
}
