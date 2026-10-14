/**
 * Ink drawings of parts on a 64 px grid: 2 px graphite outlines with coloured-pencil fills (the --sk-* tokens). Used
 * by the parts bin, lesson hooks, the finale and the Hall of Fried Parts (with `burned`). A locked part is a dashed
 * pencil outline, not yet coloured in.
 */
import type { ReactNode } from "react";
import type { PartIconKind } from "./kinds";
import "./parts.css";

const LEGS = (xs: number[], y0: number, y1: number | number[]) =>
  xs.map((x, i) => <path key={x} className="pi-ln" d={`M${x} ${y0}V${Array.isArray(y1) ? y1[i] : y1}`} />);

const DRAW: Record<PartIconKind, () => ReactNode> = {
  battery: () => (
    <>
      <path className="pi-f pi-sunk" d="M46 17l4 3v38l-4 2z" />
      <rect className="pi-f pi-slip" x="16" y="15" width="30" height="45" rx="2" />
      <rect className="pi-batt-label" x="16" y="28" width="30" height="13" />
      <path className="pi-thin" d="M16 28h30M16 41h30" />
      <rect className="pi-ln" x="16" y="15" width="30" height="45" rx="2" />
      <text className="pi-tx" x="31" y="38" textAnchor="middle">9V</text>
      <rect className="pi-f pi-slip" x="20" y="9" width="8" height="6" rx="1" />
      <path className="pi-f pi-slip" d="M34 15v-4l2.5-2h5l2.5 2v4" />
    </>
  ),
  cell: () => (
    <>
      <rect className="pi-f pi-copper" x="22" y="8" width="5" height="26" />
      <rect className="pi-f pi-metal" x="37" y="8" width="5" height="26" />
      <path className="pi-f pi-lemon" d="M9 38c0-10 10-16 23-16s23 6 23 16-10 16-23 16S9 48 9 38z" />
      <path className="pi-ln" d="M9 38c-3 0-4-2-4-3M55 38c3 0 4 2 4 3" />
      <path className="pi-shine" d="M18 33c2-3 6-5 10-5" />
    </>
  ),
  resistor: () => (
    <>
      <path className="pi-ln" d="M4 32h12M48 32h12" />
      <rect className="pi-f pi-body" x="15" y="23" width="34" height="18" rx="9" />
      <rect className="pi-band-yellow" x="21" y="23.5" width="3.5" height="17" />
      <rect className="pi-band-violet" x="27" y="23.5" width="3.5" height="17" />
      <rect className="pi-band-brown" x="33" y="23.5" width="3.5" height="17" />
      <rect className="pi-band-gold" x="41" y="23.5" width="3" height="17" />
      <rect className="pi-ln" x="15" y="23" width="34" height="18" rx="9" />
    </>
  ),
  led: () => (
    <>
      {LEGS([27, 37], 47, [61, 56])}
      <path className="pi-f pi-led" d="M21 44V24a11 11 0 0 1 22 0v20z" />
      <rect className="pi-f pi-led" x="18" y="43" width="28" height="5" rx="1" />
      <path className="pi-shine" d="M25.5 25a7 7 0 0 1 4.5-6" />
    </>
  ),
  multimeter: () => (
    <>
      <rect className="pi-f pi-meter" x="14" y="4" width="36" height="56" rx="4" />
      <rect className="pi-f pi-lcd" x="19" y="9" width="26" height="12" rx="1" />
      <text className="pi-tx pi-tx--lcd" x="32" y="18.5" textAnchor="middle">9.12</text>
      <circle className="pi-f pi-slip" cx="32" cy="35" r="8" />
      <path className="pi-ln" d="M32 35l4-5" />
      <circle className="pi-f pi-ink" cx="23" cy="51" r="2.6" />
      <circle className="pi-f pi-ink" cx="32" cy="51" r="2.6" />
      <circle className="pi-f pi-red" cx="41" cy="51" r="2.6" />
    </>
  ),
  "test-leads": () => (
    <>
      <path className="pi-wire-edge" d="M12 60c4-12 12-9 16-20" />
      <path className="pi-wire pi-wire--black" d="M12 60c4-12 12-9 16-20" />
      <path className="pi-wire-edge" d="M52 60c-4-12-12-9-16-20" />
      <path className="pi-wire pi-wire--red" d="M52 60c-4-12-12-9-16-20" />
      <path className="pi-f pi-chip" d="M28 41l-6-20 4.5-1.4 6 20z" />
      <path className="pi-f pi-red" d="M36 41l6-20-4.5-1.4-6 20z" />
      <path className="pi-ln" d="M22 21l-3.5-13M42 21l3.5-13" />
    </>
  ),
  breadboard: () => (
    <>
      <rect className="pi-f pi-board" x="6" y="8" width="52" height="48" rx="2" />
      <path className="pi-rail-pos" d="M10 13h44" />
      <path className="pi-rail-neg" d="M10 51h44" />
      <rect className="pi-sunk" x="7" y="30.5" width="50" height="3" />
      {[18, 22, 26, 38, 42, 46].map((y) => [13, 19, 25, 31, 37, 43, 49].map((x) => <rect key={`${x}-${y}`} className="pi-hole" x={x - 1.2} y={y - 1.2} width="2.4" height="2.4" />))}
      <rect className="pi-ln" x="6" y="8" width="52" height="48" rx="2" />
    </>
  ),
  "jumper-wire": () => (
    <>
      <path className="pi-wire-edge" d="M10 50c4-26 18-32 30-21" />
      <path className="pi-wire pi-wire--red" d="M10 50c4-26 18-32 30-21" />
      <path className="pi-wire-edge" d="M17 55c10-19 26-21 35-8" />
      <path className="pi-wire pi-wire--black" d="M17 55c10-19 26-21 35-8" />
      <path className="pi-wire-edge" d="M8 39c10-6 20-19 39-23" />
      <path className="pi-wire pi-wire--yellow" d="M8 39c10-6 20-19 39-23" />
      <path className="pi-ln" d="M10 50v8M52 47v8M40 29l4-4" />
    </>
  ),
  pushbutton: () => (
    <>
      {LEGS([19, 45], 48, 59)}
      <path className="pi-ln" d="M19 16V7M45 16V7" />
      <rect className="pi-f pi-chip" x="13" y="16" width="38" height="32" rx="2" />
      <circle className="pi-f pi-red" cx="32" cy="32" r="10" />
      <path className="pi-shine" d="M26 29a7 7 0 0 1 4-4" />
    </>
  ),
  switch: () => (
    <>
      {LEGS([22, 32, 42], 44, 58)}
      <rect className="pi-f pi-metal" x="12" y="26" width="40" height="18" rx="1" />
      <rect className="pi-f pi-chip" x="17" y="17" width="12" height="11" rx="1" />
      <path className="pi-thin" d="M16 35h32" />
    </>
  ),
  fuse: () => (
    <>
      <rect className="pi-f pi-slip" x="14" y="23" width="36" height="18" rx="2" />
      <path className="pi-ln pi-ln--thin" d="M18 32c3-5 5 5 8 0s5 5 8 0 5 5 8 0 3 4 4 2" />
      <rect className="pi-f pi-metal" x="6" y="21" width="11" height="22" rx="2" />
      <rect className="pi-f pi-metal" x="47" y="21" width="11" height="22" rx="2" />
    </>
  ),
  capacitor: () => (
    <>
      {LEGS([27, 37], 51, [61, 57])}
      <rect className="pi-f pi-cap" x="19" y="9" width="26" height="43" rx="3" />
      <rect className="pi-stripe" x="36" y="10" width="6" height="41" />
      <path className="pi-minus" d="M39 17v3M39 27v3M39 37v3" />
      <rect className="pi-ln" x="19" y="9" width="26" height="43" rx="3" />
      <path className="pi-thin" d="M19 15h26" />
    </>
  ),
  pot: () => (
    <>
      {LEGS([21, 32, 43], 50, 60)}
      <rect className="pi-f pi-cap" x="11" y="12" width="42" height="38" rx="2" />
      <circle className="pi-f pi-slip" cx="32" cy="31" r="12" />
      <path className="pi-ln" d="M27 36l10-10" />
    </>
  ),
  relay: () => (
    <>
      {LEGS([17, 27, 37, 47], 52, 60)}
      <rect className="pi-f pi-chip" x="10" y="10" width="44" height="42" rx="2" />
      <path className="pi-paper-ln" d="M17 32c2-6 4 6 6 0s4 6 6 0 4 6 6 0" />
      <path className="pi-paper-ln" d="M40 27l6-4M40 27v10" />
      <path className="pi-paper-ln pi-ln--thin" d="M17 19h14" />
    </>
  ),
  transistor: () => (
    <>
      {LEGS([24, 32, 40], 43, 60)}
      <path className="pi-f pi-chip" d="M18 43V25a14 14 0 0 1 28 0v18z" />
      <path className="pi-shine pi-shine--soft" d="M23 25a9 9 0 0 1 6-8" />
    </>
  ),
  phototransistor: () => (
    <>
      {LEGS([27, 37], 47, [61, 57])}
      <path className="pi-f pi-slip" d="M21 44V24a11 11 0 0 1 22 0v20z" />
      <rect className="pi-f pi-slip" x="18" y="43" width="28" height="5" rx="1" />
      <rect className="pi-f pi-chip" x="28" y="29" width="8" height="8" />
      <path className="pi-ray" d="M52 6l-7 7M47 13h-3.5M45 13v-3.5M58 13l-7 7M53 20h-3.5M51 20v-3.5" />
    </>
  ),
  diode: () => (
    <>
      <path className="pi-ln" d="M4 32h14M46 32h14" />
      <rect className="pi-f pi-chip" x="17" y="24" width="30" height="16" rx="2" />
      <rect className="pi-f pi-metal" x="38" y="24" width="5" height="16" />
    </>
  ),
  speaker: () => (
    <>
      <circle className="pi-f pi-chip" cx="30" cy="32" r="24" />
      <circle className="pi-f pi-metal" cx="30" cy="32" r="16" />
      <circle className="pi-f pi-chip" cx="30" cy="32" r="6" />
      <path className="pi-ray" d="M57 22c3 6 3 14 0 20M61 17c5 9 5 21 0 30" />
    </>
  ),
  // A DIP chip from above: pins along both long sides, the notch and the pin 1 dot at the left end, print on top.
  chip: () => (
    <>
      {[17, 27, 37, 47].map((x) => (
        <g key={x}>
          <rect className="pi-f pi-metal" x={x - 2.5} y="9" width="5" height="8" rx="0.5" />
          <rect className="pi-f pi-metal" x={x - 2.5} y="47" width="5" height="8" rx="0.5" />
        </g>
      ))}
      <rect className="pi-f pi-chip" x="8" y="16" width="48" height="32" rx="2" />
      <path className="pi-f pi-sunk" d="M8 28a4 4 0 0 1 0 8z" />
      <circle className="pi-f pi-slip" cx="14.5" cy="42" r="1.6" />
      <path className="pi-paper-ln" d="M22 28.5h22M22 35.5h14" />
    </>
  ),
  // A seven-segment display: a dark face with an 8 and its point lit, pins top and bottom.
  "seven-segment": () => (
    <>
      {LEGS([22, 32, 42], 4, 9)}
      {LEGS([22, 32, 42], 55, 60)}
      <rect className="pi-f pi-chip" x="13" y="9" width="38" height="46" rx="2" />
      <path className="pi-seg" d={`${seg(24, 15, 40, 15)}${seg(41, 16, 41, 31)}${seg(41, 33, 41, 48)}${seg(24, 49, 40, 49)}${seg(23, 33, 23, 48)}${seg(23, 16, 23, 31)}${seg(24, 32, 40, 32)}`} />
      <circle className="pi-seg" cx="46" cy="49" r="1.8" />
    </>
  ),
};

/** A segment of a seven-segment digit: a slim lozenge from (x0, y0) to (x1, y1), along x or along y. */
function seg(x0: number, y0: number, x1: number, y1: number): string {
  const w = 1.6;
  if (y0 === y1) return `M${x0} ${y0}l${w} ${-w}H${x1 - w}l${w} ${w}l${-w} ${w}H${x0 + w}z`;
  return `M${x0} ${y0}l${w} ${w}V${y1 - w}l${-w} ${w}l${-w} ${-w}V${y0 + w}z`;
}

/** Scorch, a crack and a wisp of smoke, for the Hall of Fried Parts. */
function Scorch() {
  return (
    <g className="part-icon__scorch">
      <ellipse className="pi-char" cx="33" cy="31" rx="10" ry="7" />
      <path className="pi-ln pi-ln--thin" d="M30 22l4 6-3 4 4 6" />
      <path className="pi-smoke" d="M38 16c-3-4 3-6 0-10s2-5 0-8" />
      <path className="pi-smoke" d="M29 17c-2-3 2-5 0-8" />
    </g>
  );
}

export type PartIconProps = {
  kind: PartIconKind;
  size?: number;
  state?: "normal" | "locked" | "burned";
  label?: string;
  className?: string;
};

export function PartIcon({ kind, size = 64, state = "normal", label, className }: PartIconProps) {
  const cls = ["part-icon", state !== "normal" && `part-icon--${state}`, className].filter(Boolean).join(" ");
  return (
    <svg className={cls} viewBox="0 0 64 64" width={size} height={size} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}>
      <g className="part-icon__art">{DRAW[kind]()}</g>
      {state === "burned" && <Scorch />}
    </svg>
  );
}
