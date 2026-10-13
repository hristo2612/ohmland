import { useState } from "react";
import type { ColorCodeItem as ColorCodeItemT } from "../content/schema";
import { m } from "../i18n";
import { ALL_BAND_COLORS, bandsForOhms, digitOf, MULTIPLIER_EXP, ohmsForBands, type BandColor } from "./colorCode";
import { NumericField } from "./NumericItem";
import { Resistor } from "./Resistor";
import { formatSI } from "./si";
import type { ItemViewProps } from "./types";

type Value = string | (BandColor | null)[];

const MULT = ["1", "10", "100", "1k", "10k", "100k", "1M", "10M", "100M", "1G"];
const multLabel = (c: BandColor) => {
  const e = MULTIPLIER_EXP[c];
  return `\u00d7${e >= 0 ? MULT[e] : e === -1 ? "0.1" : "0.01"}`;
};

/** Read mode: show the bands, type the value. Build mode: pick a band on the resistor, then a colour. */
export function ColorCodeItem(props: ItemViewProps<Value, ColorCodeItemT>) {
  return props.item.mode === "read" ? <ReadMode {...props} /> : <BuildMode {...props} />;
}

function ReadMode({ item, value, onChange, locked, outcome, reveal }: ItemViewProps<Value, ColorCodeItemT>) {
  const bands = bandsForOhms(item.ohms, item.bands) ?? [];
  const names = bands.map((b) => m.bands[b]).join(", ");
  return (
    <div className="colour-code">
      <div className="colour-code__stage">
        <Resistor bands={bands} label={m.quiz.colorCode.resistorLabel(names)} />
      </div>
      <NumericField
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        unit="Ω"
        locked={locked}
        label={m.quiz.colorCode.readLabel}
        state={reveal ? "right" : outcome && !outcome.correct ? "wrong" : undefined}
      />
    </div>
  );
}

function BuildMode({ item, value, onChange, locked, reveal, announce }: ItemViewProps<Value, ColorCodeItemT>) {
  const digits = item.bands === 4 ? 2 : 3;
  const roles = item.bands === 4 ? m.quiz.colorCode.bandRoles4 : m.quiz.colorCode.bandRoles5;
  const fallback: (BandColor | null)[] = [...Array<BandColor | null>(digits + 1).fill(null), "gold"];
  const bands = Array.isArray(value) ? value : fallback;
  const [selected, setSelected] = useState<number>(Math.max(0, bands.findIndex((b) => b === null)));
  const shown = reveal ? (bandsForOhms(item.ohms, item.bands) ?? bands) : bands;
  const current = ohmsForBands(bands.filter((b): b is BandColor => b !== null), item.bands);
  const complete = bands.every((b) => b !== null);
  const role = roles[selected] ?? "";

  const pick = (c: BandColor) => {
    if (locked) return;
    if (selected < digits && digitOf(c) === null) return;
    const next = [...bands];
    next[selected] = c;
    onChange(next);
    announce(`${role}: ${m.bands[c]}`);
    const nextEmpty = next.findIndex((b, i) => b === null && i < digits + 1);
    if (nextEmpty !== -1) setSelected(nextEmpty);
  };

  return (
    <div className="colour-code">
      <p className="colour-code__target">
        <span className="badge badge--accent">{m.quiz.colorCode.buildTarget(formatSI(item.ohms, "Ω"))}</span>
      </p>
      <div className="colour-code__stage">
        <Resistor bands={shown} selected={locked ? null : selected} onSelect={locked ? undefined : setSelected} roles={roles} fixed={[digits + 1]} />
      </div>
      <p className="colour-code__readout" aria-live="polite">
        {complete && current !== null ? m.quiz.colorCode.yourValue(formatSI(current, "Ω")) : m.quiz.colorCode.noValue}
      </p>
      {!locked && (
        <div className="swatches" role="radiogroup" aria-label={m.quiz.colorCode.pickFor(role)}>
          <p className="swatches__label">{role}</p>
          <div className="swatches__grid">
            {ALL_BAND_COLORS.map((c) => {
              const disabled = selected < digits && digitOf(c) === null;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={bands[selected] === c}
                  className="swatch"
                  data-swatch={c}
                  disabled={disabled}
                  title={disabled ? m.quiz.colorCode.notADigit(role) : m.bands[c]}
                  onClick={() => pick(c)}
                >
                  <span className="swatch__chip" style={{ background: `var(--band-${c})` }} aria-hidden="true" />
                  <span className="swatch__name">{m.bands[c]}</span>
                  <span className="swatch__digit mono" aria-hidden="true">
                    {selected < digits ? digitOf(c) : multLabel(c)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
