// Radial parts: LEDs (flat rim on the cathode side), the phototransistor, the TO-92 transistor with labelled legs,
// ceramic discs and electrolytic cans (stripe on the minus side). On the board they stand on their holes, seen from
// above; on the desk they lie on their side, drawn larger than life, leads pointing +x.

import { PITCH as P } from "../../board";
import { CERAMIC, LED, NPN, electrolyticSize } from "../../dims";
import { ceramicCode } from "../../colorCode";
import type { PartParamsMap, Vec2 } from "../../types";
import { useDefs } from "../draw/shared";
import { LED_TOKEN } from "../styles";
import { Lead, Scorch, Upright, health, localLegs, n3 } from "./common";
import type { DrawProps, InkRegistry, ShapeCtx } from "./types";

/** Bodies of small radial parts lying on the desk are drawn this much larger than life. */
export const DESK_SCALE = 1.6;

type LedShape = { c: Vec2; rim: string; dome: string; inner: string; sheen: string; crack: string };

function ledShape(size: 3 | 5, mount: "board" | "desk"): LedShape {
  const d = LED[size];
  if (mount === "board") {
    const c = P / 2;
    const R = d.rim / 2;
    const cut = R - d.flat;
    const zc = Math.sqrt(R * R - cut * cut);
    const r = d.dome / 2;
    return {
      c: [c, 0],
      rim: `M${n3(c + cut)} ${n3(-zc)}A${n3(R)} ${n3(R)} 0 1 0 ${n3(c + cut)} ${n3(zc)}Z`,
      dome: `M${n3(c - r)} 0A${n3(r)} ${n3(r)} 0 1 0 ${n3(c + r)} 0A${n3(r)} ${n3(r)} 0 1 0 ${n3(c - r)} 0Z`,
      // The leadframe seen through the lens: a thin post (anode) and the wide anvil (cathode).
      inner: `M${n3(c - 1.15)} ${n3(-0.5)}V${n3(0.5)}M${n3(c + 0.5)} ${n3(-1)}L${n3(c + 1.45)} ${n3(-0.3)}V${n3(1)}H${n3(c + 0.5)}Z`,
      sheen: `M${n3(c - r * 0.6)} ${n3(-r * 0.56)}A${n3(r * 0.84)} ${n3(r * 0.84)} 0 0 1 ${n3(c + r * 0.24)} ${n3(-r * 0.8)}`,
      crack: `M${n3(c - 1)} ${n3(-1.8)}l0.7 1.1l-0.6 0.9l0.9 1.2`,
    };
  }
  const k = DESK_SCALE;
  const rimH = d.rimH * k;
  const R = (d.rim / 2) * k;
  const r = (d.dome / 2) * k;
  const len = (d.height - d.rimH) * k;
  const tip = -rimH - len;
  const flat = d.flat * k;
  return {
    c: [-rimH - len * 0.45, 0],
    rim: `M${n3(-rimH)} ${n3(-R)}H0V${n3(R - flat)}H${n3(-rimH)}Z`,
    dome: `M${n3(-rimH)} ${n3(-r)}H${n3(tip + r)}A${n3(r)} ${n3(r)} 0 0 0 ${n3(tip + r)} ${n3(r)}H${n3(-rimH)}Z`,
    inner: `M${n3(-rimH)} ${n3(-P / 2)}H${n3(-rimH - len * 0.42)}M${n3(-rimH)} ${n3(P / 2)}H${n3(-rimH - len * 0.2)}L${n3(-rimH - len * 0.38)} ${n3(P / 2 - 1.2)}V${n3(P / 2 + 1.4)}L${n3(-rimH - len * 0.2)} ${n3(P / 2 + 0.6)}`,
    sheen: `M${n3(-rimH - len * 0.12)} ${n3(-r * 0.62)}H${n3(tip + r * 0.9)}`,
    crack: `M${n3(tip + r * 0.9)} ${n3(-r * 0.7)}l1.6 1.8l-1.3 1.3l2 1.8`,
  };
}

/** Where an LED's light comes from (part frame) and how far its rim reaches. */
export function ledLightLocal(size: 3 | 5, mount: "board" | "desk"): { c: Vec2; rim: number; reach: number } {
  const d = LED[size];
  if (mount === "board") return { c: [P / 2, 0], rim: d.rim / 2, reach: 9 };
  const s = ledShape(size, mount);
  return { c: s.c, rim: (d.rim / 2) * DESK_SCALE, reach: 20 };
}

function Led({ pi, st }: DrawProps<"led">) {
  const id = useDefs();
  const size = pi.part.params.size ?? 5;
  const p = ledShape(size, pi.mount);
  const L = localLegs(pi);
  const dead = health(st) === "dead";
  const glow = dead ? 0 : Math.max(0, Math.min(1, st?.glow ?? 0));
  const color = pi.part.params.color;
  const clear = pi.part.params.lens === "clear";
  const fill = dead ? "var(--k-dead)" : LED_TOKEN(color, "led");
  return (
    <g>
      {pi.mount === "desk" && (
        <>
          <Lead a={[0, -P / 2]} b={L.anode!} />
          <Lead a={[0, P / 2]} b={L.cathode!} />
        </>
      )}
      <path d={p.rim} style={{ fill }} />
      <path d={p.dome} style={{ fill }} opacity={clear ? 0.7 : 0.92} />
      {glow > 0.02 && <path d={p.dome} style={{ fill: LED_TOKEN(color, "lit") }} opacity={Math.min(1, 0.3 + glow)} />}
      {glow > 0.02 && <circle cx={n3(p.c[0])} cy={0} r={pi.mount === "board" ? 1.25 : 2.6} style={{ fill: "var(--k-glow-core)" }} opacity={Math.min(0.95, glow * 1.1)} />}
      <path d={p.inner} className="ln-soft" />
      {!dead && <path d={p.sheen} className="sheen" />}
      {dead && <path d={p.dome} fill={`url(#${id}-hatch)`} />}
      {dead && <path d={p.crack} className="crack" />}
      <path d={p.dome} className="ln" />
      <path d={p.rim} className="ln" />
      {pi.mount === "board" && (
        <>
          <circle cx={0} cy={0} r={0.4} className="f-ink" opacity={0.4} />
          <circle cx={P} cy={0} r={0.4} className="f-ink" opacity={0.4} />
        </>
      )}
    </g>
  );
}

function Phototransistor({ pi }: DrawProps<"phototransistor">) {
  const size = pi.part.params.size ?? 5;
  const p = ledShape(size, pi.mount);
  const L = localLegs(pi);
  const die = pi.mount === "board" ? 0.9 : 1.6;
  return (
    <g>
      {pi.mount === "desk" && (
        <>
          <Lead a={[0, -P / 2]} b={L.e!} />
          <Lead a={[0, P / 2]} b={L.c!} />
        </>
      )}
      <path d={p.rim} className="f-photo" />
      <path d={p.dome} className="f-photo" opacity={0.92} />
      <rect x={n3(p.c[0] - die / 2)} y={n3(-die / 2)} width={die} height={die} className="f-black" />
      <path d={p.inner} className="ln-soft" />
      <path d={p.sheen} className="sheen" />
      <path d={p.dome} className="ln" />
      <path d={p.rim} className="ln" />
      {pi.mount === "board" && (
        <>
          <circle cx={0} cy={0} r={0.4} className="f-ink" opacity={0.4} />
          <circle cx={P} cy={0} r={0.4} className="f-ink" opacity={0.4} />
        </>
      )}
    </g>
  );
}

function Npn({ pi, st }: DrawProps<"npn">) {
  const id = useDefs();
  const dead = health(st) === "dead";
  const rot = pi.f.rot;
  if (pi.mount === "board") {
    const R = NPN.dia / 2;
    const flat = 0.9;
    const x = Math.sqrt(R * R - flat * flat);
    const d = `M${n3(P - x)} ${flat}A${R} ${R} 0 1 1 ${n3(P + x)} ${flat}Z`;
    return (
      <g>
        <path d={d} className="f-black" />
        {dead && <path d={d} fill={`url(#${id}-hatch)`} />}
        <path d={d} className="ln" />
        {(["e", "b", "c"] as const).map((leg, i) => (
          <Upright key={leg} x={i * P} z={2.7} rot={rot} fontSize={1.55} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print lod1">
            {leg.toUpperCase()}
          </Upright>
        ))}
      </g>
    );
  }
  const L = localLegs(pi);
  const k = DESK_SCALE;
  const len = NPN.height * k;
  const w = NPN.dia * k;
  const d = `M0 ${n3(-w / 2)}H${n3(-len + w * 0.3)}Q${n3(-len)} ${n3(-w / 2)} ${n3(-len)} ${n3(-w * 0.2)}V${n3(w * 0.2)}Q${n3(-len)} ${n3(w / 2)} ${n3(-len + w * 0.3)} ${n3(w / 2)}H0Z`;
  return (
    <g>
      {(["c", "b", "e"] as const).map((leg) => {
        const end = L[leg]!;
        return <Lead key={leg} a={[0, end[1]]} b={end} />;
      })}
      <path d={d} className="f-black" />
      <rect x={n3(-len + 0.9)} y={n3(-w / 2 + 0.8)} width={n3(len - 1.4)} height={n3(w - 1.6)} rx={0.5} className="f-black-face" />
      {dead && <path d={d} fill={`url(#${id}-hatch)`} />}
      <path d={d} className="ln" />
      {(["c", "b", "e"] as const).map((leg) => (
        <Upright key={leg} x={-1.7} z={L[leg]![1]} rot={rot} fontSize={1.9} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light lod1">
          {leg.toUpperCase()}
        </Upright>
      ))}
    </g>
  );
}

function CeramicCap({ pi, st }: DrawProps<"ceramic-cap">) {
  const id = useDefs();
  const code = ceramicCode(pi.part.params.farads);
  const dead = health(st) === "dead";
  const rot = pi.f.rot;
  if (pi.mount === "board") {
    // Legs bend out (or in) to holes `span` apart; the disc stands between them.
    const span = (pi.span ?? 2) * P;
    const c = span / 2;
    const w = 6.2;
    const h = 3.0;
    return (
      <g>
        {span / 2 > w / 2 - 0.6 && (
          <>
            <Lead a={[0, 0]} b={[c - 1.6, 0]} hole="a" />
            <Lead a={[c + 1.6, 0]} b={[span, 0]} hole="b" />
          </>
        )}
        <rect x={n3(c - w / 2)} y={-h / 2} width={w} height={h} rx={h / 2} className="f-ceramic" />
        {dead && <rect x={n3(c - w / 2)} y={-h / 2} width={w} height={h} rx={h / 2} fill={`url(#${id}-hatch)`} />}
        <rect x={n3(c - w / 2)} y={-h / 2} width={w} height={h} rx={h / 2} className="ln" />
        <Upright x={c} z={0.05} rot={rot} fontSize={1.5} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light lod2">
          {code}
        </Upright>
      </g>
    );
  }
  const L = localLegs(pi);
  const R = (CERAMIC.dia / 2) * DESK_SCALE;
  return (
    <g>
      <Lead a={[-R * 0.4, -1.1]} b={L.a!} />
      <Lead a={[-R * 0.4, 1.1]} b={L.b!} />
      <circle cx={n3(-R)} cy={0} r={n3(R)} className="f-ceramic" />
      {dead && <circle cx={n3(-R)} cy={0} r={n3(R)} fill={`url(#${id}-hatch)`} />}
      <circle cx={n3(-R)} cy={0} r={n3(R)} className="ln" />
      <Upright x={-R} z={0.1} rot={rot} fontSize={2.5} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light lod1">
        {code}
      </Upright>
    </g>
  );
}

function ElectrolyticCap({ pi, st }: DrawProps<"electrolytic-cap">) {
  const id = useDefs();
  const s = electrolyticSize(pi.part.params.farads, pi.part.params.volts);
  const hp = health(st);
  const rot = pi.f.rot;
  if (pi.mount === "board") {
    // Legs bend out to holes `span` apart; past the can's edge they show.
    const span = (pi.span ?? s.pitch) * P;
    const c = span / 2;
    const R = s.d / 2;
    const ri = R - Math.max(0.9, s.d * 0.12);
    // The stripe on the sleeve marks the minus lead (+x, toward `neg`).
    const a0 = (-55 * Math.PI) / 180;
    const a1 = (55 * Math.PI) / 180;
    const pt = (r: number, a: number) => `${n3(c + Math.cos(a) * r)} ${n3(Math.sin(a) * r)}`;
    const stripe = `M${pt(R, a0)}A${R} ${R} 0 0 1 ${pt(R, a1)}L${pt(ri, a1)}A${n3(ri)} ${n3(ri)} 0 0 0 ${pt(ri, a0)}Z`;
    const bulge = hp === "smoking";
    const burst = hp === "dead";
    const v = ri * 0.62;
    return (
      <g>
        {c > R - 0.4 && (
          <>
            <Lead a={[0, 0]} b={[c - R + 0.6, 0]} hole="a" />
            <Lead a={[c + R - 0.6, 0]} b={[span, 0]} hole="b" />
          </>
        )}
        <circle cx={n3(c)} cy={0} r={n3(R)} className="f-elco" />
        <path d={stripe} className="f-elco-stripe" />
        <circle cx={n3(c)} cy={0} r={n3(ri)} className={burst ? "f-scorch" : "f-metal"} />
        {bulge && <circle cx={n3(c - ri * 0.25)} cy={n3(-ri * 0.25)} r={n3(ri * 0.45)} className="f-metal-hi" />}
        {burst ? (
          <path d={`M${n3(c)} ${n3(-v)}L${n3(c + v * 0.3)} ${n3(-v * 0.3)}L${n3(c + v)} 0L${n3(c + v * 0.3)} ${n3(v * 0.3)}L${n3(c)} ${n3(v)}L${n3(c - v * 0.3)} ${n3(v * 0.3)}L${n3(c - v)} 0L${n3(c - v * 0.3)} ${n3(-v * 0.3)}Z`} className="f-metal ln-thin" />
        ) : (
          <path d={`M${n3(c - v)} 0H${n3(c + v)}M${n3(c)} ${n3(-v)}V${n3(v)}`} className={bulge ? "ln-thin" : "ln-soft"} />
        )}
        {burst && <circle cx={n3(c)} cy={0} r={n3(R)} fill={`url(#${id}-hatch)`} />}
        <circle cx={n3(c)} cy={0} r={n3(ri)} className="ln-thin" />
        <circle cx={n3(c)} cy={0} r={n3(R)} className="ln" />
      </g>
    );
  }
  const L = localLegs(pi);
  const k = 1.4;
  const len = s.h * k;
  const w = s.d * k;
  const body = `M0 ${n3(-w / 2)}H${n3(-len + 1.4)}Q${n3(-len)} ${n3(-w / 2)} ${n3(-len)} ${n3(-w / 2 + 1.4)}V${n3(w / 2 - 1.4)}Q${n3(-len)} ${n3(w / 2)} ${n3(-len + 1.4)} ${n3(w / 2)}H0Z`;
  const minus: number[] = [];
  for (let x = -len + 3.5; x < -2; x += 4.2) minus.push(x);
  return (
    <g>
      <Lead a={[0, L.pos![1] * 0.6]} b={L.pos!} />
      <Lead a={[0, L.neg![1] * 0.6]} b={L.neg!} />
      <path d={body} className="f-elco" />
      <rect x={n3(-len + 0.6)} y={n3(w * 0.14)} width={n3(len - 1.2)} height={n3(w * 0.34)} className="f-elco-stripe" />
      {minus.map((x) => (
        <Upright key={x} x={x} z={w * 0.31} rot={rot} fontSize={2.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="lod1 t-elco">
          {"−"}
        </Upright>
      ))}
      <rect x={n3(-len)} y={n3(-w / 2 + 0.8)} width={1.3} height={n3(w - 1.6)} className={hp === "dead" ? "f-scorch" : "f-metal"} />
      <rect x={-1.2} y={n3(-w / 2 + 0.5)} width={1.2} height={n3(w - 1)} className="f-black" />
      <path d={`M${n3(-len + 2)} ${n3(-w * 0.32)}H-2`} className="sheen" opacity={0.35} />
      <Scorch d={body} hp={hp} crack={`M${n3(-len + 1)} ${n3(-w * 0.3)}l2 1.6l-1.4 1.6l2.2 1.4`} />
      <path d={body} className="ln" />
    </g>
  );
}

/** Two copper touch pads: interleaved gold fingers on a little green board held up on two pins. */
function TouchPads({ pi }: DrawProps<"touch-pads">) {
  const L = localLegs(pi);
  const a = L.a!;
  const b = L.b!;
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2 + 1.8;
  const S = 11;
  const D = 9.2;
  const m = 1.1;
  const fingers: string[] = [];
  const n = 5;
  const step = (S - 2 * m) / (2 * n);
  for (let i = 0; i < 2 * n; i++) {
    const x = cx - S / 2 + m + i * step + step * 0.18;
    const top = i % 2 === 0;
    fingers.push(`M${n3(x)} ${n3(top ? cz - D / 2 + m : cz - D / 2 + m + 1.4)}h${n3(step * 0.64)}v${n3(D - 2 * m - 1.4)}h${n3(-step * 0.64)}z`);
  }
  return (
    <g>
      {pi.mount === "board" && (
        <>
          <circle cx={n3(a[0])} cy={n3(a[1])} r={0.4} className="f-ink" opacity={0.4} />
          <circle cx={n3(b[0])} cy={n3(b[1])} r={0.4} className="f-ink" opacity={0.4} />
        </>
      )}
      <rect x={n3(cx - S / 2)} y={n3(cz - D / 2)} width={S} height={D} rx={0.6} className="f-pcb" />
      <rect x={n3(cx - S / 2 + m)} y={n3(cz - D / 2 + m)} width={n3(S - 2 * m)} height={0.8} className="f-gold" />
      <rect x={n3(cx - S / 2 + m)} y={n3(cz + D / 2 - m - 0.8)} width={n3(S - 2 * m)} height={0.8} className="f-gold" />
      <path d={fingers.join("")} className="f-gold" />
      <rect x={n3(cx - S / 2)} y={n3(cz - D / 2)} width={S} height={D} rx={0.6} className="ln" />
    </g>
  );
}

function ledBox(params: { size?: 3 | 5 }, c: ShapeCtx): [number, number, number, number] {
  const d = LED[params.size ?? 5];
  if (c.mount === "board") return [P / 2 - d.rim / 2, -d.rim / 2, P / 2 + d.rim / 2, d.rim / 2];
  const len = (d.height - d.rimH) * DESK_SCALE + d.rimH * DESK_SCALE;
  return [-len, (-d.rim / 2) * DESK_SCALE, 0, (d.rim / 2) * DESK_SCALE];
}

export const RADIAL: InkRegistry = {
  "touch-pads": { box: (_p, c) => (c.mount === "board" ? [P - 5.5, -2.8, P + 5.5, 6.4] : [-5.5, -2.8, 5.5, 6.4]), Draw: TouchPads },
  led: { box: (p, c) => ledBox(p.params, c), Draw: Led },
  phototransistor: { box: (p, c) => ledBox(p.params, c), Draw: Phototransistor },
  npn: {
    box: (_p, c) => (c.mount === "board" ? [P - NPN.dia / 2, -NPN.dia / 2, P + NPN.dia / 2, NPN.dia / 2 + 1] : [-NPN.height * DESK_SCALE, (-NPN.dia / 2) * DESK_SCALE, 0, (NPN.dia / 2) * DESK_SCALE]),
    Draw: Npn,
  },
  "ceramic-cap": {
    box: (_p, c) => {
      if (c.mount !== "board") return [-CERAMIC.dia * DESK_SCALE, (-CERAMIC.dia / 2) * DESK_SCALE, 0, (CERAMIC.dia / 2) * DESK_SCALE];
      const k = ((c.span ?? 2) * P) / 2;
      return [Math.min(0, k - 3.1), -1.5, Math.max((c.span ?? 2) * P, k + 3.1), 1.5];
    },
    Draw: CeramicCap,
  },
  "electrolytic-cap": {
    box: (p, c) => {
      const s = electrolyticSize((p.params as PartParamsMap["electrolytic-cap"]).farads, (p.params as PartParamsMap["electrolytic-cap"]).volts);
      if (c.mount === "board") {
        const span = (c.span ?? s.pitch) * P;
        const cx = span / 2;
        return [Math.min(0, cx - s.d / 2), -s.d / 2, Math.max(span, cx + s.d / 2), s.d / 2];
      }
      return [-s.h * 1.4, (-s.d / 2) * 1.4, 0, (s.d / 2) * 1.4];
    },
    Draw: ElectrolyticCap,
  },
};
