// Axial parts: resistors (1/4 W with colour bands, 1 W bigger, 5 W ceramic block) and diodes.

import { PITCH as P } from "../../board";
import { DIODE, RESISTOR, RESISTOR_1W, RESISTOR_5W } from "../../dims";
import { resistorBands } from "../../colorCode";
import type { PartParamsMap } from "../../types";
import { useDefs } from "../draw/shared";
import { BAND_TOKEN } from "../styles";
import { Lead, Scorch, Upright, dogbone, health, localLegs, n3, rrect } from "./common";
import type { DrawProps, InkRegistry, ShapeCtx } from "./types";

/** Body size by power rating and mount: small parts on the desk are drawn larger than life. */
export function resistorSize(params: PartParamsMap["resistor"], c: Pick<ShapeCtx, "mount">): { len: number; dia: number; block: boolean } {
  const w = params.watts ?? 0.25;
  if (c.mount === "desk" && w >= 2) return { len: RESISTOR_5W.len, dia: RESISTOR_5W.w, block: true };
  if (c.mount === "desk" && w >= 0.75) return { len: RESISTOR_1W.len * 1.35, dia: RESISTOR_1W.dia * 1.3, block: false };
  if (c.mount === "desk") return { len: RESISTOR.len * 2, dia: RESISTOR.dia * 2, block: false };
  return { len: RESISTOR.len * 1.06, dia: RESISTOR.dia * 1.1, block: false };
}

export function diodeSize(c: Pick<ShapeCtx, "mount">): { len: number; dia: number } {
  return c.mount === "desk" ? { len: DIODE.len * 1.9, dia: DIODE.dia * 1.8 } : { len: DIODE.len * 1.06, dia: DIODE.dia * 1.1 };
}

const BANDS4 = [0.16, 0.31, 0.46, 0.8];
const BANDS5 = [0.13, 0.26, 0.39, 0.52, 0.8];

/** The real value lies outside the tolerance (a part overheated once): the body is a little darker. */
const offSpec = (p: PartParamsMap["resistor"]) => p.actualOhms !== undefined && Math.abs(p.actualOhms - p.ohms) > (p.ohms * (p.tolerance ?? 5)) / 100;

function powerPrint(ohms: number, watts: number): string {
  const v = ohms >= 1000 ? `${Number((ohms / 1000).toPrecision(3))}K` : `${Number(ohms.toPrecision(3))}R`;
  return `${Math.round(watts)}W ${v}J`;
}

function Resistor({ pi, st }: DrawProps<"resistor">) {
  const id = useDefs();
  const board = pi.mount === "board";
  const { len, dia, block } = resistorSize(pi.part.params, pi);
  const L = localLegs(pi);
  const a = L.a!;
  const b = L.b!;
  const c = board ? ((pi.span ?? 4) * P) / 2 : 0;
  const hp = health(st);
  const params = pi.part.params;
  if (block) {
    const body = rrect(0, 0, len, dia, 1.2);
    return (
      <g>
        <Lead a={a} b={[-len / 2 + 0.4, 0]} />
        <Lead a={[len / 2 - 0.4, 0]} b={b} />
        <path d={body} className="f-slip" />
        <path d={body} fill={`url(#${id}-speckle)`} />
        <Upright x={0} z={0.2} rot={0} fontSize={3.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print">
          {powerPrint(params.ohms, params.watts ?? 5)}
        </Upright>
        <Scorch d={body} hp={hp} crack={`M-4 -3.4l2 2.6l-1.4 1.6l2.4 2.6`} />
        <path d={body} className="ln" />
      </g>
    );
  }
  const n = params.bands ?? 4;
  let bands: string[] = [];
  try {
    bands = resistorBands(params.ohms, n, params.tolerance ?? (n === 5 ? 1 : 5));
  } catch {
    bands = [];
  }
  const xs = n === 5 ? BANDS5 : BANDS4;
  const bw = len * 0.085;
  const body = dogbone(len, dia);
  const clip = `${id}-r-${pi.part.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return (
    <g>
      <Lead a={a} b={[c - len / 2 + 0.2, 0]} hole={board ? "a" : undefined} />
      <Lead a={[c + len / 2 - 0.2, 0]} b={b} hole={board ? "b" : undefined} />
      <g transform={`translate(${n3(c)} 0)`}>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
        <path d={body} className={n === 5 ? "f-body-metal" : "f-body"} />
        {offSpec(params) && <path d={body} style={{ fill: "var(--k-b-brown)" }} opacity={0.28} />}
        <g clipPath={`url(#${clip})`}>
          {bands.map((color, i) => (
            <rect key={i} x={n3(-len / 2 + len * xs[i]! - bw / 2)} y={n3(-dia)} width={n3(bw)} height={n3(dia * 2)} style={{ fill: BAND_TOKEN(color) }} />
          ))}
        </g>
        <path d={`M${n3(-len * 0.27)} ${n3(-dia * 0.26)}Q0 ${n3(-dia * 0.34)} ${n3(len * 0.27)} ${n3(-dia * 0.26)}`} className="sheen" />
        <Scorch d={body} hp={hp} crack={`M${n3(-len * 0.08)} ${n3(-dia * 0.4)}l${n3(len * 0.06)} ${n3(dia * 0.3)}l${n3(-len * 0.04)} ${n3(dia * 0.2)}l${n3(len * 0.07)} ${n3(dia * 0.28)}`} />
        <path d={body} className="ln" />
      </g>
    </g>
  );
}

function Diode({ pi, st }: DrawProps<"diode">) {
  const board = pi.mount === "board";
  const { len, dia } = diodeSize(pi);
  const L = localLegs(pi);
  const c = board ? ((pi.span ?? 4) * P) / 2 : 0;
  const r = dia * 0.42;
  const body = `M${n3(-len / 2 + r)} ${n3(-dia / 2)}H${n3(len / 2 - r)}A${n3(r)} ${n3(dia / 2)} 0 0 1 ${n3(len / 2 - r)} ${n3(dia / 2)}H${n3(-len / 2 + r)}A${n3(r)} ${n3(dia / 2)} 0 0 1 ${n3(-len / 2 + r)} ${n3(-dia / 2)}Z`;
  const hp = health(st);
  const glass = pi.part.params.model === "1N4148";
  return (
    <g>
      <Lead a={L.anode!} b={[c - len / 2 + 0.2, 0]} hole={board ? "a" : undefined} />
      <Lead a={[c + len / 2 - 0.2, 0]} b={L.cathode!} hole={board ? "b" : undefined} />
      <g transform={`translate(${n3(c)} 0)`}>
        <path d={body} className={glass ? "f-glass-amber" : "f-black"} />
        {/* The band marks the cathode. */}
        <rect x={n3(len * 0.24)} y={n3(-dia / 2)} width={n3(len * 0.12)} height={n3(dia)} className={glass ? "f-black" : "f-metal-hi"} />
        <path d={`M${n3(-len * 0.3)} ${n3(-dia * 0.24)}H${n3(len * 0.18)}`} className="sheen" opacity={0.35} />
        <Scorch d={body} hp={hp === "hot" ? "ok" : hp} crack={`M${n3(-len * 0.1)} ${n3(-dia * 0.4)}l1 1.2l-0.8 1.1l1.2 1`} />
        <path d={body} className="ln" />
      </g>
    </g>
  );
}

export const AXIAL: InkRegistry = {
  resistor: {
    box: (part, c) => {
      const { len, dia } = resistorSize(part.params, c);
      const k = c.mount === "board" ? ((c.span ?? 4) * P) / 2 : 0;
      return [k - len / 2, -dia / 2, k + len / 2, dia / 2];
    },
    Draw: Resistor,
  },
  diode: {
    box: (_part, c) => {
      const { len, dia } = diodeSize(c);
      const k = c.mount === "board" ? ((c.span ?? 4) * P) / 2 : 0;
      return [k - len / 2, -dia / 2, k + len / 2, dia / 2];
    },
    Draw: Diode,
  },
};
