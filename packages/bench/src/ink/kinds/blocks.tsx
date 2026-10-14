// Desk modules: a part on a small wooden block with brass screw terminals along its front edge (base relay, slide
// switch, DPDT switch, pushbutton, panel pot). Terminal names are printed under the screws; a mystery part shows only
// numbers until someone peeks inside.

import type { ReactNode } from "react";
import type { PartState } from "@ohmland/sim";
import { BLOCK, blockWidth } from "../../dims";
import { partLegs, terminalNumber, wiredAs } from "../../parts";
import type { PlacedPart } from "../../types";
import { Upright, localLegs, n3 } from "./common";
import type { Box } from "../frame";
import type { DrawProps } from "./types";

export const isBlock = (part: PlacedPart): boolean => part.kind === "dpdt-switch" || !!(part.params as { base?: boolean }).base;

export function blockBox(part: PlacedPart): Box {
  const w = blockWidth(partLegs(part).length);
  return [-w / 2, -BLOCK.d / 2, w / 2, BLOCK.d / 2];
}

const RELAY_NAMES: Record<string, string> = { coil1: "COIL", coil2: "COIL", com1: "COM", nc1: "NC", no1: "NO", com2: "COM", nc2: "NC", no2: "NO" };
const DPDT_NAMES: Record<string, string> = { a1: "T1", com1: "P1", b1: "T1", a2: "T2", com2: "P2", b2: "T2" };

/** What is printed under each terminal: names, or numbers for a mystery part (with what each is once peeked). */
export function terminalNames(part: PlacedPart): Record<string, string> {
  const names = part.kind === "relay" ? RELAY_NAMES : part.kind === "dpdt-switch" ? DPDT_NAMES : null;
  const out: Record<string, string> = {};
  const mystery = !!(part.params as { mystery?: string }).mystery;
  if (!names) return out;
  if (part.kind === "dpdt-switch" && !mystery) return out;
  for (const leg of partLegs(part)) {
    const num = terminalNumber(part, leg);
    if (num === null) out[leg] = names[leg] ?? "";
    else out[leg] = (part.params as { peek?: boolean }).peek ? `${num} ${names[wiredAs(part, leg)] ?? ""}`.trim() : String(num);
  }
  return out;
}

/** The block, its screws and printed names; `children` sit on the top plate, centred over the back half. */
export function TerminalBlock({ pi, plateW, children }: { pi: DrawProps["pi"]; plateW?: number; children?: ReactNode }) {
  const legs = partLegs(pi.part);
  const w = blockWidth(legs.length);
  const L = localLegs(pi);
  const names = terminalNames(pi.part);
  const rot = pi.f.rot;
  const tag = (pi.part.params as { tag?: string }).tag;
  const pw = plateW ?? Math.min(w - 8, Math.max(26, w * 0.6));
  const longest = Math.max(1, ...Object.values(names).map((s) => s.length));
  return (
    <g>
      <rect x={-w / 2 + 1} y={-BLOCK.d / 2 + 1.3} width={w} height={BLOCK.d} rx={2.4} className="f-shade" />
      <rect x={-w / 2} y={-BLOCK.d / 2} width={w} height={BLOCK.d} rx={2.4} className="f-wood" />
      <path d={`M${n3(-w / 2 + 3)} -10.4C-8 -11.4 6 -9.4 ${n3(w / 2 - 3)} -11M${n3(-w / 2 + 4)} 3.2C-4 2.2 9 4.2 ${n3(w / 2 - 4)} 2.8`} className="ln-soft" />
      <rect x={-w / 2} y={-BLOCK.d / 2} width={w} height={BLOCK.d} rx={2.4} className="ln" />
      <rect x={n3(-pw / 2)} y={BLOCK.deviceZ - 7.5} width={n3(pw)} height={15} rx={1.4} className="f-black" />
      {legs.map((leg) => {
        const p = L[leg];
        if (!p) return null;
        return (
          <g key={leg}>
            <rect x={n3(p[0] - 3.5)} y={n3(p[1] - 3)} width={7} height={6} rx={0.6} className="f-brass" />
            <circle cx={n3(p[0])} cy={n3(p[1])} r={2.2} className="f-brass ln" />
            <path d={`M${n3(p[0] - 1.6)} ${n3(p[1] + 0.8)}L${n3(p[0] + 1.6)} ${n3(p[1] - 0.8)}`} className="ln-thin" />
            {names[leg] && (
              <Upright x={p[0]} z={p[1] + 4.9} rot={rot} fontSize={longest > 6 ? 1.6 : longest > 3 ? 1.9 : 2.3} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
                {names[leg]}
              </Upright>
            )}
          </g>
        );
      })}
      {tag && (
        <Upright x={-w / 2 + 2.6} z={-BLOCK.d / 2 + 3} rot={rot} fontSize={3} fontWeight={700} dominantBaseline="central" className="print-light">
          {tag}
        </Upright>
      )}
      <g transform={`translate(0 ${BLOCK.deviceZ})`}>{children}</g>
    </g>
  );
}

/** A chunky slide switch for a block: a chrome plate with a slot and a knob that slides to a or b. */
export function BigSlider({ to, length = 24 }: { to: string; length?: number }) {
  const t = length * 0.22;
  return (
    <g>
      <rect x={n3(-(length + 6) / 2)} y={-5} width={length + 6} height={10} rx={1} className="f-metal-hi ln" />
      <rect x={n3(-(length * 0.44 + 6.4) / 2)} y={-1.6} width={n3(length * 0.44 + 6.4)} height={3.2} rx={0.6} className="f-black" />
      <g className="actuator" style={{ transform: `translate(${n3(to === "a" ? -t : t)}px,0px)` }}>
        <rect x={-3.1} y={-2.3} width={6.2} height={4.6} rx={1} className="f-black-face ln" />
        <path d="M-1.6 -1.7V1.7M0 -1.7V1.7M1.6 -1.7V1.7" className="ln-soft" />
      </g>
    </g>
  );
}

/** A big round momentary button. */
export function BigButton({ cap, pressed }: { cap: string; pressed: boolean }) {
  return (
    <g>
      <circle r={8.4} className="f-metal-hi ln" />
      <g className="actuator" style={{ transform: `scale(${pressed ? 0.88 : 1})` }}>
        {pressed && <circle r={6.5} className="f-ink" opacity={0.25} />}
        <circle r={5.8} style={{ fill: cap }} />
        {!pressed && <path d="M-3.4 -2.6A4 4 0 0 1 1.4 -4.2" className="sheen" />}
        <circle r={5.8} className="ln" />
      </g>
    </g>
  );
}

/** A panel pot: a knob with a pointer over a printed scale, turning with the wiper position (0 to 1). */
export function BigKnob({ position }: { position: number }) {
  const ticks: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = ((-0.75 + (i / 10) * 1.5) * Math.PI) - Math.PI / 2;
    const r0 = i % 5 === 0 ? 7.6 : 8.1;
    ticks.push(`M${n3(Math.cos(a) * r0)} ${n3(Math.sin(a) * r0)}L${n3(Math.cos(a) * 9.3)} ${n3(Math.sin(a) * 9.3)}`);
  }
  const angle = (position - 0.5) * 270;
  return (
    <g>
      <path d={ticks.join("")} className="s-print" strokeWidth={0.45} strokeLinecap="round" />
      <g className="actuator" style={{ transform: `rotate(${n3(angle)}deg)` }}>
        <circle r={6.4} className="f-black-face ln" />
        <circle r={5.4} className="ln-soft" />
        <path d="M0 -5.6V-2.2" className="core" style={{ ["--w" as string]: "0.9px", stroke: "var(--k-slip)" }} />
      </g>
    </g>
  );
}

/** Armature position 0 (released, COM on NC) to 1 (pulled in, COM on NO). */
export function relayArmature(st: PartState | null): number {
  const a = st?.extra?.["armature"];
  if (typeof a === "number") return Math.max(0, Math.min(1, a));
  return st?.closed ? 1 : 0;
}

/**
 * A relay seen from above through its clear cover, centred on the origin, 20 x 10 mm: the coil on the left, the
 * armature beside it, and one changeover blade per pole that rests on NC and swings to NO when pulled in. A mystery
 * relay's cover is opaque.
 */
export function RelayTop({ arm, poles, opaque, dead, rot }: { arm: number; poles: 1 | 2; opaque: boolean; dead: boolean; rot: number }) {
  const W = 20.4;
  const D = 10;
  if (opaque) {
    return (
      <g>
        <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.8} className="f-black" />
        <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.8} className="ln" />
        <Upright x={0} z={0} rot={rot} fontSize={5} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
          ?
        </Upright>
      </g>
    );
  }
  const coilX0 = -W / 2 + 0.9;
  const coilX1 = coilX0 + 6.2;
  const winds: number[] = [];
  for (let x = coilX0 + 0.6; x < coilX1 - 0.3; x += 0.75) winds.push(x);
  const armX = coilX1 + 0.5 + (1 - arm) * 0.9;
  const pole = (z: number, k: number) => {
    const pivot: [number, number] = [-0.8, z];
    const nc: [number, number] = [6.6, z - 1.3 * k];
    const no: [number, number] = [6.6, z + 1.3 * k];
    const tip: [number, number] = [nc[0] + (no[0] - nc[0]) * arm, nc[1] + (no[1] - nc[1]) * arm];
    return (
      <g key={z}>
        <circle cx={nc[0] + 0.35} cy={nc[1]} r={0.42} className="f-metal ln-thin" />
        <circle cx={no[0] + 0.35} cy={no[1]} r={0.42} className="f-metal ln-thin" />
        <path d={`M${pivot[0]} ${pivot[1]}L${n3(tip[0])} ${n3(tip[1])}`} className="edge" style={{ ["--w" as string]: "0.55px" }} />
        <path d={`M${pivot[0]} ${pivot[1]}L${n3(tip[0])} ${n3(tip[1])}`} className="core" style={{ ["--w" as string]: "0.55px", stroke: "var(--k-copper)" }} />
        <circle cx={pivot[0]} cy={pivot[1]} r={0.5} className="f-ink" />
      </g>
    );
  };
  return (
    <g>
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.8} className="f-relay" />
      <rect x={coilX0} y={-2.4} width={coilX1 - coilX0} height={4.8} rx={0.5} className="f-copper" />
      {winds.map((x) => (
        <path key={x} d={`M${n3(x)} -2.3V2.3`} className="ln-soft" />
      ))}
      <rect x={coilX0} y={-2.4} width={coilX1 - coilX0} height={4.8} rx={0.5} className="ln-thin" />
      <rect x={n3(armX)} y={-3.3} width={0.9} height={6.6} rx={0.3} className="f-metal ln-thin" />
      {poles === 2 ? [pole(2.6, -1), pole(-2.6, 1)] : pole(0, 1)}
      {dead && <rect x={coilX0} y={-2.4} width={coilX1 - coilX0} height={4.8} className="f-scorch" opacity={0.7} />}
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.8} className="ln" />
    </g>
  );
}
