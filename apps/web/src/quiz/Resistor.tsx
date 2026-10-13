/**
 * A through-hole resistor in SVG with real colour bands. In build mode each band is a button: pick a band, then a
 * colour. Band colours are tokens (--band-*).
 */
import type { KeyboardEvent } from "react";
import { m } from "../i18n";
import type { BandColor } from "./colorCode";

const f = (token: string) => ({ fill: `var(${token})` });

export type ResistorProps = {
  bands: readonly (BandColor | null)[];
  /** Index of the band being edited (build mode). */
  selected?: number | null;
  onSelect?(index: number): void;
  /** Names of each band's role, for accessible names in build mode. */
  roles?: readonly string[];
  /** Bands that cannot be edited (the fixed tolerance band). */
  fixed?: readonly number[];
  label?: string;
  className?: string;
};

export function Resistor({ bands, selected = null, onSelect, roles = [], fixed = [], label, className }: ResistorProps) {
  const n = bands.length;
  // Digit bands sit together; the tolerance band stands a little apart.
  const step = n >= 5 ? 32 : 40;
  const xs = bands.map((_, i) => (i === n - 1 ? 264 : 112 + i * step));
  const interactive = !!onSelect;
  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(i);
    }
  };
  return (
    <svg className={className ? `resistor ${className}` : "resistor"} viewBox="0 0 400 120" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": !interactive })}>
      <path d="M8 60H392" style={{ stroke: "var(--lead)", strokeWidth: 6, strokeLinecap: "round" }} />
      <path d="M8 58H392" style={{ stroke: "var(--lead-hi)", strokeWidth: 1.5, strokeLinecap: "round" }} />
      <path
        d="M92 30c0-9 7-14 16-14h22c8 0 12 6 22 6h96c10 0 14-6 22-6h22c9 0 16 5 16 14v60c0 9-7 14-16 14h-22c-8 0-12-6-22-6h-96c-10 0-14 6-22 6h-22c-9 0-16-5-16-14z"
        style={f("--resistor-body")}
      />
      <path d="M100 30c0-6 5-8 10-8h20c8 0 12 6 22 6h96c10 0 14-6 22-6h20c5 0 10 2 10 8v4H100z" style={f("--resistor-body-hi")} />
      <path d="M92 84h216v6c0 9-7 14-16 14h-22c-8 0-12-6-22-6h-96c-10 0-14 6-22 6h-22c-9 0-16-5-16-14z" style={f("--resistor-body-lo")} opacity={0.6} />
      {bands.map((b, i) => {
        const x = xs[i] as number;
        const top = i === 0 || i === n - 1 ? 18 : 24;
        const h = i === 0 || i === n - 1 ? 84 : 72;
        const editable = interactive && !fixed.includes(i);
        const rect = (
          <>
            <rect x={x} y={top} width={20} height={h} rx={2} style={f(b ? `--band-${b}` : "--surface-sunk")} className={b ? undefined : "resistor__empty"} />
            <rect x={x + 3} y={top + 4} width={4} height={h - 8} rx={2} style={f("--highlight")} opacity={b ? 0.6 : 0} />
            {selected === i && <rect x={x - 5} y={top - 7} width={30} height={h + 14} rx={6} className="resistor__ring" />}
          </>
        );
        if (!editable) return <g key={i}>{rect}</g>;
        return (
          <g
            key={i}
            className="resistor__band"
            role="button"
            tabIndex={0}
            data-band={i}
            aria-pressed={selected === i}
            aria-label={`${roles[i] ?? ""}: ${b ? m.bands[b] : "?"}`}
            onClick={() => onSelect?.(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <rect x={x - 8} y={4} width={36} height={112} fill="transparent" />
            {rect}
          </g>
        );
      })}
    </svg>
  );
}
