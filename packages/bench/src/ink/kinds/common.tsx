// Small pieces shared by the part drawings: leads, hole dots, burn marks, upright text, resistor bodies.

import type { ReactNode, SVGProps } from "react";
import type { PartState } from "@ohmland/sim";
import type { Vec2 } from "../../types";
import { n3, toLocal } from "../frame";
import type { PartInk } from "../model";
import { useDefs } from "../draw/shared";

export { n3 };

export const health = (st: PartState | null) => st?.health ?? "ok";

/** Leads in the part's own frame. */
export function localLegs(pi: PartInk): Record<string, Vec2> {
  const out: Record<string, Vec2> = {};
  for (const [leg, p] of Object.entries(pi.legs)) out[leg] = toLocal(pi.f, p[0], p[1]);
  return out;
}

/** A tinned lead from a to b, with a dot where it goes into a breadboard hole. */
export function Lead({ a, b, hole }: { a: Vec2; b: Vec2; hole?: "a" | "b" | "both" }) {
  return (
    <>
      <path d={`M${n3(a[0])} ${n3(a[1])}L${n3(b[0])} ${n3(b[1])}`} className="lead" />
      {(hole === "a" || hole === "both") && <HoleDot at={a} />}
      {(hole === "b" || hole === "both") && <HoleDot at={b} />}
    </>
  );
}

export function HoleDot({ at }: { at: Vec2 }) {
  return <circle cx={n3(at[0])} cy={n3(at[1])} r={0.62} className="f-metal ln-thin" />;
}

/** Burn marks over a body: a scorch tint by health, hatching and a crack when dead. */
export function Scorch({ d, hp, crack }: { d: string; hp: string; crack?: string }) {
  const id = useDefs();
  if (hp === "ok") return null;
  const amt = hp === "dead" ? 0.78 : hp === "smoking" ? 0.5 : 0.2;
  return (
    <>
      <path d={d} className="f-scorch" opacity={amt} />
      {hp === "dead" && <path d={d} fill={`url(#${id}-hatch)`} />}
      {hp === "dead" && crack && <path d={crack} className="crack" />}
    </>
  );
}

/** Text that stays upright however its part is turned (pass the part's turn). */
export function Upright({ x, z, rot, children, ...rest }: { x: number; z: number; rot: number; children: ReactNode } & SVGProps<SVGTextElement>) {
  return (
    <text transform={rot ? `translate(${n3(x)} ${n3(z)}) rotate(${n3(rot)})` : `translate(${n3(x)} ${n3(z)})`} {...rest}>
      {children}
    </text>
  );
}

/** A rounded rectangle path centred on (cx, cz). */
export function rrect(cx: number, cz: number, w: number, h: number, r: number): string {
  const x0 = cx - w / 2;
  const z0 = cz - h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  return `M${n3(x0 + rr)} ${n3(z0)}H${n3(x0 + w - rr)}A${n3(rr)} ${n3(rr)} 0 0 1 ${n3(x0 + w)} ${n3(z0 + rr)}V${n3(z0 + h - rr)}A${n3(rr)} ${n3(rr)} 0 0 1 ${n3(x0 + w - rr)} ${n3(z0 + h)}H${n3(x0 + rr)}A${n3(rr)} ${n3(rr)} 0 0 1 ${n3(x0)} ${n3(z0 + h - rr)}V${n3(z0 + rr)}A${n3(rr)} ${n3(rr)} 0 0 1 ${n3(x0 + rr)} ${n3(z0)}Z`;
}

/** A filled shape with its ink outline on top. */
export function Inked({ d, fill, className, style, line = "ln" }: { d: string; fill?: string; className?: string; style?: React.CSSProperties; line?: string }) {
  return (
    <>
      <path d={d} className={className} style={fill ? { fill, ...style } : style} />
      <path d={d} className={line} />
    </>
  );
}

/** Resistor body: fat ends, slimmer middle. Centred on the origin. */
export function dogbone(len: number, dia: number): string {
  const h = dia / 2;
  const n = h * 0.78;
  const cap = len * 0.24;
  const x0 = -len / 2;
  const x1 = len / 2;
  const r = n3;
  return [
    `M${r(x0 + cap)} ${r(-h)}`,
    `C${r(x0 + cap * 0.1)} ${r(-h)} ${r(x0)} ${r(-h * 0.7)} ${r(x0)} 0`,
    `C${r(x0)} ${r(h * 0.7)} ${r(x0 + cap * 0.1)} ${r(h)} ${r(x0 + cap)} ${r(h)}`,
    `C${r(x0 + cap * 1.35)} ${r(h)} ${r(x0 + cap * 1.4)} ${r(n)} ${r(x0 + cap * 1.75)} ${r(n)}`,
    `H${r(x1 - cap * 1.75)}`,
    `C${r(x1 - cap * 1.4)} ${r(n)} ${r(x1 - cap * 1.35)} ${r(h)} ${r(x1 - cap)} ${r(h)}`,
    `C${r(x1 - cap * 0.1)} ${r(h)} ${r(x1)} ${r(h * 0.7)} ${r(x1)} 0`,
    `C${r(x1)} ${r(-h * 0.7)} ${r(x1 - cap * 0.1)} ${r(-h)} ${r(x1 - cap)} ${r(-h)}`,
    `C${r(x1 - cap * 1.35)} ${r(-h)} ${r(x1 - cap * 1.4)} ${r(-n)} ${r(x1 - cap * 1.75)} ${r(-n)}`,
    `H${r(x0 + cap * 1.75)}`,
    `C${r(x0 + cap * 1.4)} ${r(-n)} ${r(x0 + cap * 1.35)} ${r(-h)} ${r(x0 + cap)} ${r(-h)}Z`,
  ].join("");
}
