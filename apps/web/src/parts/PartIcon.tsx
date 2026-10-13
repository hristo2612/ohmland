/**
 * Flat 2D drawings of parts, on a 64 px grid, coloured with tokens. Used by the parts bin, lesson hooks, the finale
 * and the Hall of Fried Parts (with `burned`). A 3D PartPreview from packages/bench will sit next to these later.
 */
import type { CSSProperties, ReactNode } from "react";
import type { PartIconKind } from "./kinds";
import "./parts.css";

const f = (token: string): CSSProperties => ({ fill: `var(${token})` });
const s = (token: string, width = 2): CSSProperties => ({ stroke: `var(${token})`, strokeWidth: width, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" });

function Leads({ ys = 32, x0 = 3, x1 = 61 }: { ys?: number; x0?: number; x1?: number }) {
  return <path d={`M${x0} ${ys}H${x1}`} style={s("--lead", 2.5)} />;
}

const DRAW: Record<PartIconKind, () => ReactNode> = {
  battery: () => (
    <>
      <rect x="20" y="14" width="24" height="44" rx="4" style={f("--chip")} />
      <rect x="20" y="14" width="24" height="15" rx="4" style={f("--copper")} />
      <rect x="20" y="25" width="24" height="4" style={f("--copper")} />
      <rect x="23" y="17" width="3" height="38" rx="1.5" style={f("--highlight")} />
      <path d="M33 34l-5 9h4l-1 7 6-10h-4l2-6z" style={f("--glow")} />
      <rect x="24" y="8" width="7" height="6" rx="1.5" style={f("--solder")} />
      <path d="M35 8h6l1.5 3-1.5 3h-6l-1.5-3z" style={f("--solder-lo")} />
    </>
  ),
  cell: () => (
    <>
      <ellipse cx="32" cy="38" rx="24" ry="17" style={f("--band-yellow")} />
      <ellipse cx="25" cy="32" rx="9" ry="5" style={f("--highlight")} />
      <path d="M8 38c-3-1-4-3-3-5M56 38c3 1 4 3 3 5" style={s("--band-yellow", 4)} />
      <rect x="22" y="10" width="5" height="24" rx="1" style={f("--trace")} />
      <rect x="37" y="10" width="5" height="24" rx="1" style={f("--solder")} />
    </>
  ),
  resistor: () => (
    <>
      <Leads />
      <rect x="16" y="23" width="32" height="18" rx="9" style={f("--resistor-body")} />
      <rect x="19" y="25" width="26" height="4" rx="2" style={f("--resistor-body-hi")} />
      <rect x="21" y="23" width="3.5" height="18" style={f("--band-yellow")} />
      <rect x="27" y="23" width="3.5" height="18" style={f("--band-violet")} />
      <rect x="33" y="23" width="3.5" height="18" style={f("--band-brown")} />
      <rect x="41" y="23" width="3.5" height="18" style={f("--band-gold")} />
    </>
  ),
  led: () => (
    <>
      <path d="M27 44v16M37 44v11" style={s("--lead", 2.5)} />
      <path d="M21 44V24a11 11 0 0 1 22 0v20z" style={f("--led-red")} />
      <path d="M25 25a7 7 0 0 1 6-7" style={s("--led-red-hi", 3)} />
      <path d="M18 42h26v4H18z" style={f("--led-red")} />
      <path d="M41 42h3v4h-3z" style={f("--char")} opacity={0.25} />
      <circle cx="32" cy="30" r="4" style={f("--led-red-hi")} opacity={0.6} />
    </>
  ),
  multimeter: () => (
    <>
      <rect x="13" y="4" width="38" height="56" rx="7" style={f("--meter-body")} />
      <rect x="17" y="8" width="30" height="48" rx="4" style={f("--meter-face")} />
      <rect x="20" y="11" width="24" height="11" rx="2" style={f("--lcd")} />
      <path d="M24 19v-5h3M30 19v-5M34 14h3v5h-3M40 14v5" style={s("--lcd-ink", 1.4)} />
      <circle cx="32" cy="34" r="8" style={f("--chip-hi")} />
      <circle cx="32" cy="34" r="5.5" style={f("--chip")} />
      <path d="M32 34l3.5-4" style={s("--solder", 2)} />
      <circle cx="23" cy="50" r="2.6" style={f("--chip")} />
      <circle cx="32" cy="50" r="2.6" style={f("--chip")} />
      <circle cx="41" cy="50" r="2.6" style={f("--wire-red")} />
      <circle cx="41" cy="50" r="1.2" style={f("--chip")} />
    </>
  ),
  "test-leads": () => (
    <>
      <path d="M14 58c4-10 12-8 16-18" style={s("--wire-black", 3)} />
      <path d="M50 58c-4-10-12-8-16-18" style={s("--wire-red", 3)} />
      <path d="M27 42l-6-20 4-1 6 20z" style={f("--wire-black")} />
      <path d="M37 42l6-20-4-1-6 20z" style={f("--wire-red")} />
      <path d="M21 22l-3-14 2-.5 4 14z" style={f("--solder")} />
      <path d="M43 22l3-14-2-.5-4 14z" style={f("--solder")} />
    </>
  ),
  breadboard: () => (
    <>
      <rect x="6" y="8" width="52" height="48" rx="4" style={f("--plastic")} />
      <rect x="6" y="8" width="52" height="48" rx="4" style={s("--plastic-lo", 1.5)} />
      <path d="M10 13h44" style={s("--wire-red", 1.5)} />
      <path d="M10 51h44" style={s("--led-blue", 1.5)} />
      <rect x="8" y="30.5" width="48" height="3" style={f("--plastic-lo")} />
      {[17, 21, 25, 38, 42, 46].map((y) =>
        [12, 18, 24, 30, 36, 42, 48, 54].map((x) => <rect key={`${x}-${y}`} x={x - 1.2} y={y - 1.2} width="2.4" height="2.4" rx="0.6" style={f("--chip-hi")} />),
      )}
    </>
  ),
  "jumper-wire": () => (
    <>
      <path d="M10 48c4-28 18-34 30-22" style={s("--wire-red", 3.5)} />
      <path d="M16 54c10-20 26-22 36-8" style={s("--wire-black", 3.5)} />
      <path d="M8 40c10-6 20-20 40-24" style={s("--led-blue", 3.5)} />
      <rect x="8" y="47" width="4" height="9" rx="1" style={f("--solder")} />
      <rect x="38" y="20" width="4" height="9" rx="1" transform="rotate(-40 40 24)" style={f("--solder")} />
      <rect x="50" y="42" width="4" height="9" rx="1" style={f("--solder")} />
    </>
  ),
  pushbutton: () => (
    <>
      <path d="M18 46v12M46 46v12M18 18V8M46 18V8" style={s("--lead", 2.5)} />
      <rect x="14" y="16" width="36" height="32" rx="3" style={f("--chip")} />
      <rect x="14" y="16" width="36" height="5" rx="2" style={f("--chip-hi")} />
      <circle cx="32" cy="32" r="10" style={f("--wire-red")} />
      <circle cx="29" cy="29" r="4" style={f("--led-red-hi")} opacity={0.5} />
    </>
  ),
  switch: () => (
    <>
      <path d="M22 44v14M32 44v14M42 44v14" style={s("--lead", 2.5)} />
      <rect x="12" y="24" width="40" height="20" rx="2" style={f("--solder")} />
      <rect x="12" y="24" width="40" height="5" rx="2" style={f("--lead-hi")} />
      <rect x="18" y="16" width="12" height="12" rx="2" style={f("--chip")} />
      <rect x="20" y="18" width="3" height="8" rx="1" style={f("--chip-hi")} />
    </>
  ),
  fuse: () => (
    <>
      <rect x="10" y="22" width="44" height="20" rx="10" style={f("--cloud-lo")} opacity={0.75} />
      <path d="M18 32c3-5 5 5 8 0s5 5 8 0 5 5 8 0" style={s("--lead", 1.6)} />
      <rect x="6" y="21" width="12" height="22" rx="3" style={f("--solder")} />
      <rect x="46" y="21" width="12" height="22" rx="3" style={f("--solder")} />
      <rect x="8" y="24" width="8" height="3" rx="1.5" style={f("--lead-hi")} />
      <rect x="48" y="24" width="8" height="3" rx="1.5" style={f("--lead-hi")} />
    </>
  ),
  capacitor: () => (
    <>
      <path d="M27 50v10M37 50v7" style={s("--lead", 2.5)} />
      <rect x="18" y="8" width="28" height="44" rx="6" style={f("--cap-blue")} />
      <rect x="36" y="8" width="6" height="44" style={f("--silk")} opacity={0.8} />
      <path d="M38 14v4M38 22v4M38 30v4M38 38v4" style={s("--cap-blue-lo", 2)} />
      <rect x="21" y="11" width="4" height="38" rx="2" style={f("--cap-blue-hi")} />
      <rect x="18" y="8" width="28" height="6" rx="3" style={f("--solder")} />
    </>
  ),
  pot: () => (
    <>
      <path d="M20 48v12M32 48v12M44 48v12" style={s("--lead", 2.5)} />
      <rect x="12" y="12" width="40" height="38" rx="5" style={f("--cap-blue")} />
      <rect x="12" y="12" width="40" height="6" rx="3" style={f("--cap-blue-hi")} />
      <circle cx="32" cy="31" r="12" style={f("--plastic")} />
      <path d="M26 37l12-12" style={s("--chip", 3)} />
    </>
  ),
  relay: () => (
    <>
      <path d="M17 50v9M27 50v9M37 50v9M47 50v9" style={s("--lead", 2.5)} />
      <rect x="10" y="10" width="44" height="42" rx="4" style={f("--chip")} />
      <rect x="10" y="10" width="44" height="7" rx="3" style={f("--chip-hi")} />
      <path d="M18 34c2-6 4 6 6 0s4 6 6 0 4 6 6 0" style={s("--trace", 2)} />
      <path d="M40 28l6-4M40 28v10" style={s("--solder", 2)} />
      <rect x="16" y="22" width="16" height="3" rx="1.5" style={f("--chip-hi")} />
    </>
  ),
  transistor: () => (
    <>
      <path d="M24 42v18M32 42v18M40 42v18" style={s("--lead", 2.5)} />
      <path d="M18 42V24a14 14 0 0 1 28 0v18z" style={f("--chip")} />
      <path d="M18 42h28" style={s("--chip-hi", 2)} />
      <path d="M22 24a10 10 0 0 1 8-10" style={s("--chip-hi", 3)} />
    </>
  ),
  phototransistor: () => (
    <>
      <path d="M27 44v16M37 44v12" style={s("--lead", 2.5)} />
      <path d="M21 44V24a11 11 0 0 1 22 0v20z" style={f("--cloud-lo")} opacity={0.85} />
      <rect x="28" y="30" width="8" height="8" rx="1" style={f("--chip")} />
      <path d="M25 25a7 7 0 0 1 6-7" style={s("--cloud", 3)} />
      <path d="M18 42h26v4H18z" style={f("--cloud-lo")} />
      <path d="M50 8l-6 6M56 14l-6 6" style={s("--glow", 2.5)} />
    </>
  ),
  diode: () => (
    <>
      <Leads />
      <rect x="18" y="24" width="28" height="16" rx="3" style={f("--chip")} />
      <rect x="20" y="26" width="24" height="3" rx="1.5" style={f("--chip-hi")} />
      <rect x="38" y="24" width="4" height="16" style={f("--solder")} />
    </>
  ),
  speaker: () => (
    <>
      <circle cx="32" cy="32" r="26" style={f("--chip")} />
      <circle cx="32" cy="32" r="21" style={f("--chip-hi")} />
      <circle cx="32" cy="32" r="16" style={f("--chip")} />
      <circle cx="32" cy="32" r="7" style={f("--solder")} />
      <circle cx="30" cy="30" r="2.5" style={f("--lead-hi")} />
    </>
  ),
};

/** Char marks and a wisp of smoke for the Hall of Fried Parts. */
function Scorch() {
  return (
    <g className="part-icon__scorch">
      <ellipse cx="34" cy="30" rx="11" ry="8" style={f("--char")} opacity={0.55} />
      <ellipse cx="26" cy="38" rx="6" ry="4" style={f("--char-lo")} opacity={0.5} />
      <path d="M38 22c-3-4 3-6 0-10s2-6 0-9" style={s("--ash", 2.5)} opacity={0.8} />
      <path d="M30 20c-2-3 2-5 0-8" style={s("--ash", 2)} opacity={0.6} />
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
