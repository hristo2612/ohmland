// Things that make or use power on the desk: 9 V, AA and coin cells, the battery tester, the lemon cell, the cup of
// water and the speaker.

import { AA, BATTERY, COIN, CUP, LEMON, STATION } from "../../dims";
import { useLabels } from "../../labels";
import type { PlacedPartOf, Vec2 } from "../../types";
import { useDefs } from "../draw/shared";
import { Upright, health, localLegs, n3, rrect } from "./common";
import type { DrawProps, InkRegistry, ShapeCtx } from "./types";

// ---------------------------------------------------------------------------------------------------------------
// 9 V battery. On the desk it is drawn standing, front on, terminals on top at their true clip points and the body
// below them (the way the notebook draws it). Seated in the tester's bay it is seen from straight above.

const W9 = BATTERY.wid / 2;
const T9 = BATTERY.termSpacing / 2;

function NineVolt({ pi, st }: DrawProps<"battery">) {
  const id = useDefs();
  const labels = useLabels();
  const snap = !!pi.part.params.snap;
  const hp = health(st);
  // Laid on its back in a box: seen from above it shows its front, terminals at the back.
  if (pi.pose.lie) return <g transform={`translate(0 ${-(BATTERY.len - 0.9)})`}>{NineVoltFront({ pi, st, id, labels, snap, hp })}</g>;
  if (pi.pose.heldBy) {
    const D = BATTERY.thick / 2;
    return (
      <g>
        <rect x={-W9} y={-D} width={W9 * 2} height={D * 2} rx={2.4} className="f-batt-label" />
        <rect x={-W9 + 1.4} y={-D + 1.4} width={W9 * 2 - 2.8} height={D * 2 - 2.8} rx={1.6} className="f-black" />
        <rect x={-W9} y={-D} width={W9 * 2} height={D * 2} rx={2.4} className="ln" />
        <circle cx={-T9} cy={0} r={2.6} className="f-metal-hi ln" />
        <path d={`M${T9 - 3.4} 0L${T9 - 1.7} -2.9H${T9 + 1.7}L${T9 + 3.4} 0L${T9 + 1.7} 2.9H${T9 - 1.7}Z`} className="f-metal ln" />
        <Upright x={-T9} z={5.6} rot={0} fontSize={3.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
          +
        </Upright>
        <Upright x={T9} z={5.6} rot={0} fontSize={3.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
          {"−"}
        </Upright>
      </g>
    );
  }
  return NineVoltFront({ pi, st, id, labels, snap, hp });
}

/** The 9 V battery front on: terminals at the top (at their clip points), the body below. */
function NineVoltFront({ pi, id, labels, snap, hp }: { pi: DrawProps<"battery">["pi"]; st: DrawProps<"battery">["st"]; id: string; labels: ReturnType<typeof useLabels>; snap: boolean; hp: string }) {
  const top = 3;
  const bottom = BATTERY.len;
  const band0 = 16;
  const band1 = 29;
  const depth = pi.pose.lie ? 0 : 4.5;
  return (
    <g>
      <ellipse cx={2} cy={bottom + 1.6} rx={W9 + 6} ry={2.2} className="f-shade" opacity={0.7} />
      <path d={`M${W9} ${top}L${W9 + depth} ${top - 3.4}V${bottom - 3.4}L${W9} ${bottom}Z`} className="f-slip" />
      <path d={`M${W9} ${top}L${W9 + depth} ${top - 3.4}V${bottom - 3.4}L${W9} ${bottom}Z`} fill={`url(#${id}-hatch)`} />
      <path d={`M${-W9} ${top}L${-W9 + depth} ${top - 3.4}H${W9 + depth}L${W9} ${top}Z`} className="f-slip" />
      <rect x={-W9} y={top} width={W9 * 2} height={bottom - top} rx={0.8} className="f-slip" />
      <rect x={-W9} y={band0} width={W9 * 2} height={band1 - band0} className="f-batt-label" />
      <rect x={-W9} y={band1} width={W9 * 2} height={bottom - band1} fill={`url(#${id}-hatch-big)`} />
      {pi.part.params.worn && <path d={`M-9 33l5 -1.6M-2 40l7 -2.4M3 21l6 -1M-11 44l4 1.2`} className="ln-faint" />}
      <path d={`M${-W9} ${band0}H${W9}M${-W9} ${band1}H${W9}`} className="ln-thin" />
      <path d={`M${W9} ${top}L${W9 + depth} ${top - 3.4}V${bottom - 3.4}L${W9} ${bottom}M${-W9} ${top}L${-W9 + depth} ${top - 3.4}H${W9 + depth}`} className="ln" />
      <rect x={-W9} y={top} width={W9 * 2} height={bottom - top} rx={0.8} className="ln" />
      <Upright x={0} z={(band0 + band1) / 2} rot={0} fontSize={8} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="t-batt">
        9V
      </Upright>
      <Upright x={-T9} z={9.5} rot={0} fontSize={7} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink">
        +
      </Upright>
      <Upright x={T9} z={9.5} rot={0} fontSize={7} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink">
        {"−"}
      </Upright>
      {pi.part.params.worn && (
        <Upright x={0} z={39.5} rot={-6} fontSize={6} textAnchor="middle" dominantBaseline="central" className="ohi-hand t-red">
          {labels.print.used}
        </Upright>
      )}
      {snap ? (
        <>
          <rect x={-W9 + 1} y={-3.4} width={W9 * 2 - 2} height={6.2} rx={2.2} className="f-black" />
          <circle cx={-T9} cy={-0.3} r={2.4} className="f-black-face ln-thin" />
          <circle cx={T9} cy={-0.3} r={2.4} className="f-black-face ln-thin" />
          <rect x={-W9 + 1} y={-3.4} width={W9 * 2 - 2} height={6.2} rx={2.2} className="ln" />
        </>
      ) : (
        <>
          <path d={`M${-T9 - 2.4} ${top}V-0.6H${-T9 + 2.4}V${top}`} className="f-metal-hi ln" />
          <ellipse cx={-T9} cy={-0.6} rx={2.4} ry={0.9} className="f-metal-hi ln-thin" />
          <path d={`M${T9 - 3.6} ${top}L${T9 - 2.6} -1.6H${T9 + 2.6}L${T9 + 3.6} ${top}Z`} className="f-metal ln" />
          <path d={`M${T9 - 1.4} -1.6V${top - 0.4}M${T9 + 1.4} -1.6V${top - 0.4}`} className="ln-thin" />
        </>
      )}
      {(hp === "hot" || hp === "smoking") && <rect x={-W9} y={top} width={W9 * 2} height={bottom - top} rx={0.8} className="f-scorch" opacity={hp === "hot" ? 0.12 : 0.3} />}
    </g>
  );
}

const CHEM: Record<string, { wrap: string; band: string; volts: string }> = {
  alkaline: { wrap: "var(--k-aa-alkaline)", band: "var(--k-battery-label)", volts: "1.5V" },
  nimh: { wrap: "var(--k-aa-nimh)", band: "var(--k-slip)", volts: "1.2V" },
  lithium: { wrap: "var(--k-aa-lithium)", band: "var(--k-metal-hi)", volts: "1.5V" },
};

function AaCell({ pi }: DrawProps<"battery">) {
  const c = CHEM[pi.part.params.chem ?? "alkaline"] ?? CHEM.alkaline!;
  const R = AA.dia / 2;
  const x0 = -AA.len / 2;
  const x1 = AA.len / 2 - 1.5;
  const rot = pi.f.rot;
  if (pi.part.params.xray) return <AaCutaway held={!!pi.pose.heldBy} />;
  return (
    <g>
      {!pi.pose.heldBy && [-15, 15].map((x) => <rect key={x} x={x - 3} y={-R - 1.2} width={6} height={AA.dia + 2.4} rx={1.2} className="f-black ln-thin" />)}
      <rect x={n3(x0)} y={-R} width={n3(x1 - x0)} height={AA.dia} rx={1.4} style={{ fill: c.wrap }} />
      <rect x={n3(x1 - 13)} y={-R} width={9} height={AA.dia} style={{ fill: c.band }} />
      <path d={`M${n3(x0 + 3)} ${n3(-R * 0.55)}H${n3(x1 - 15)}`} className="sheen" opacity={0.5} />
      <rect x={n3(x1 - 1.4)} y={n3(-R + 0.6)} width={1.6} height={n3(AA.dia - 1.2)} rx={0.6} className="f-metal-hi ln-thin" />
      <rect x={n3(x1)} y={-2.9} width={1.6} height={5.8} rx={0.6} className="f-metal-hi ln" />
      <rect x={n3(x0 - 0.2)} y={n3(-R + 0.8)} width={1} height={n3(AA.dia - 1.6)} rx={0.4} className="f-metal ln-thin" />
      <rect x={n3(x0)} y={-R} width={n3(x1 - x0)} height={AA.dia} rx={1.4} className="ln" />
      <Upright x={-6} z={0} rot={rot === 180 ? 180 : 0} fontSize={4.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        {c.volts}
      </Upright>
      <Upright x={x1 - 8.5} z={0} rot={0} fontSize={5} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink">
        +
      </Upright>
    </g>
  );
}

/**
 * An AA cell cut open along its length: the steel can, a dark ring of manganese dioxide (the + side's chemical), a thin
 * separator, the grey zinc paste in the middle (the − side's), and the brass pin that collects from it.
 */
function AaCutaway({ held }: { held: boolean }) {
  const defs = useDefs();
  const R = AA.dia / 2;
  const x0 = -AA.len / 2;
  const x1 = AA.len / 2 - 1.5;
  const can = 0.7;
  const ring = 3.1;
  const sep = 0.7;
  const core = R - can - ring - sep;
  const xs = x0 + 2.2;
  const xe = x1 - 2.4;
  return (
    <g>
      {!held && [-15, 15].map((x) => <rect key={x} x={x - 3} y={-R - 1.2} width={6} height={AA.dia + 2.4} rx={1.2} className="f-black ln-thin" />)}
      <rect x={n3(x0)} y={-R} width={n3(x1 - x0)} height={AA.dia} rx={1.4} className="f-metal" />
      <rect x={n3(xs)} y={n3(-R + can)} width={n3(xe - xs)} height={n3(AA.dia - 2 * can)} rx={0.8} className="f-mno2" />
      <rect x={n3(xs + ring * 0.6)} y={n3(-core - sep)} width={n3(xe - xs - ring * 1.2)} height={n3(2 * (core + sep))} rx={0.8} className="f-sep" />
      <rect x={n3(xs + ring * 0.6 + sep)} y={n3(-core)} width={n3(xe - xs - ring * 1.2 - 2 * sep)} height={n3(2 * core)} rx={0.6} className="f-zinc-gel" />
      <rect x={n3(xs + ring * 0.6 + sep)} y={n3(-core)} width={n3(xe - xs - ring * 1.2 - 2 * sep)} height={n3(2 * core)} rx={0.6} fill={`url(#${defs}-speckle)`} />
      <path d={`M${n3(xs + 3)} ${n3(-R + can + 1.2)}l1 1.4M${n3(xs + 11)} ${n3(R - can - 1.6)}l1.2 -1M${n3(xs + 20)} ${n3(-R + can + 1)}l1 1.2M${n3(xs + 30)} ${n3(R - can - 1.4)}l1 -1.2M${n3(xs + 38)} ${n3(-R + can + 1.1)}l1 1.2`} className="s-slip" strokeWidth={0.3} />
      <rect x={n3(x0 - 0.4)} y={-0.45} width={n3((xe - x0) * 0.62)} height={0.9} rx={0.45} className="f-brass ln-thin" />
      <rect x={n3(x1 - 1.4)} y={n3(-R + 0.6)} width={1.6} height={n3(AA.dia - 1.2)} rx={0.6} className="f-metal-hi ln-thin" />
      <rect x={n3(x1)} y={-2.9} width={1.6} height={5.8} rx={0.6} className="f-metal-hi ln" />
      <rect x={n3(x0)} y={-R} width={n3(x1 - x0)} height={AA.dia} rx={1.4} className="ln" />
      <path d={`M${n3(xs)} ${n3(-R + can)}H${n3(xe)}M${n3(xs)} ${n3(R - can)}H${n3(xe)}`} className="ln-thin" />
      <text x={n3(x1 - 5)} y={0.3} fontSize={4.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        +
      </text>
    </g>
  );
}

function CoinCell() {
  const R = COIN.dia / 2;
  const H = COIN.holder / 2;
  return (
    <g>
      {[-1, 1].map((s) => (
        <rect key={s} x={s > 0 ? COIN.tab - 5 : -COIN.tab - 2} y={-2.25} width={7} height={4.5} rx={0.6} className="f-metal ln-thin" />
      ))}
      <rect x={-H} y={-H + 1} width={COIN.holder} height={COIN.holder - 2} rx={3} className="f-black ln" />
      <circle r={R} className="f-metal-hi" />
      <circle r={R - 1.2} className="ln-soft" />
      <circle r={R} className="ln" />
      <text x={-3} y={0.4} fontSize={3.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink3">
        CR2032
      </text>
      <rect x={-1} y={-2.5} width={14} height={5} rx={1} className="f-metal ln-thin" />
      <text x={7.5} y={0.2} fontSize={4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink">
        +
      </text>
    </g>
  );
}

function Battery(p: DrawProps<"battery">) {
  const size = p.pi.part.params.size ?? "9v";
  if (size === "aa") return <AaCell {...p} />;
  if (size === "coin") return <CoinCell />;
  return <NineVolt {...p} />;
}

function batteryBox(part: PlacedPartOf<"battery">, c: ShapeCtx): [number, number, number, number] {
  const size = part.params.size ?? "9v";
  if (size === "aa") return [-AA.len / 2 - 0.4, -AA.dia / 2 - 1.2, AA.len / 2 + 0.4, AA.dia / 2 + 1.2];
  if (size === "coin") return [-COIN.tab - 2, -COIN.holder / 2 + 1, COIN.tab + 2, COIN.holder / 2 - 1];
  if (c.lie) return [-W9, -BATTERY.len + 0.9 - 3.4, W9, 0.9];
  if (c.held) return [-W9, -BATTERY.thick / 2, W9, BATTERY.thick / 2];
  return [-W9, -3.4, W9 + 4.5, BATTERY.len];
}

// ---------------------------------------------------------------------------------------------------------------
// Battery tester.

function Station({ pi }: DrawProps<"station">) {
  const labels = useLabels();
  const S = STATION;
  const on = !!pi.part.params.load;
  const rot = pi.f.rot;
  const L = localLegs(pi);
  return (
    <g>
      <rect x={-S.w / 2 + 1.4} y={-S.d / 2 + 1.8} width={S.w} height={S.d} rx={4} className="f-shade" />
      <rect x={-S.w / 2} y={-S.d / 2} width={S.w} height={S.d} rx={4} className="f-station" />
      <rect x={-S.w / 2} y={-S.d / 2} width={S.w} height={S.d} rx={4} className="ln" />
      <Upright x={0} z={-S.d / 2 + 4.6} rot={rot} fontSize={3.4} fontWeight={700} letterSpacing={0.5} textAnchor="middle" dominantBaseline="central" className="print">
        {labels.print.tester}
      </Upright>
      <rect x={-28} y={S.bayZ - 16} width={56} height={32} rx={3} className="f-sunk" />
      <rect x={-28} y={S.bayZ - 16} width={56} height={32} rx={3} className="ln-faint" strokeDasharray="2.4 2" />
      {[-1, 1].map((s) => {
        const p = (s < 0 ? L.a : L.b) ?? ([s * S.postX, S.postZ] as Vec2);
        return (
          <g key={s}>
            <path d={`M${n3(p[0])} ${n3(p[1])}Q${n3(p[0])} ${n3(p[1] - 10)} ${n3(p[0] - s * 6)} ${n3(p[1] - 20)}`} className="edge" style={{ ["--w" as string]: "1.1px" }} />
            <path d={`M${n3(p[0])} ${n3(p[1])}Q${n3(p[0])} ${n3(p[1] - 10)} ${n3(p[0] - s * 6)} ${n3(p[1] - 20)}`} className="core" style={{ ["--w" as string]: "1.1px", stroke: "var(--k-brass)" }} />
            <circle cx={n3(p[0])} cy={n3(p[1])} r={4.8} style={{ fill: s < 0 ? "var(--k-w-red)" : "var(--k-w-black)" }} />
            <circle cx={n3(p[0])} cy={n3(p[1])} r={4.8} className="ln" />
            <circle cx={n3(p[0])} cy={n3(p[1])} r={2.3} className="f-brass ln-thin" />
            <Upright x={p[0] + s * 1} z={p[1] + 9} rot={rot} fontSize={5.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className={s < 0 ? "t-red" : "f-ink"}>
              {s < 0 ? "+" : "−"}
            </Upright>
          </g>
        );
      })}
      <g>
        <rect x={-8} y={S.d / 2 - 23.4} width={16} height={2.8} rx={1} className="f-body ln-thin" />
        {[-4, -1.5, 1, 5].map((x, i) => (
          <rect key={i} x={x - 0.5} y={S.d / 2 - 23.4} width={1} height={2.8} style={{ fill: `var(--k-b-${["brown", "black", "brown", "gold"][i]})` }} />
        ))}
      </g>
      <rect x={-9} y={S.d / 2 - 17.5} width={18} height={11} rx={1.4} className="f-black ln" />
      <rect x={-7} y={on ? S.d / 2 - 16.5 : S.d / 2 - 12.5} width={14} height={4.8} rx={1} className={on ? "f-red ln-thin" : "f-black-face ln-thin"} />
      <Upright x={0} z={S.d / 2 - 3.2} rot={rot} fontSize={3} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print">
        {labels.print.load}
      </Upright>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Lemon halves, the cup of water, the speaker.

/** Half a lemon, cut face up: rind, segments, and two slots when it takes electrodes. */
export function LemonFace({ slots }: { slots: boolean }) {
  const R = LEMON.dia / 2;
  const seg: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10 + 0.2;
    seg.push(`M${n3(Math.cos(a) * 3)} ${n3(Math.sin(a) * 3)}L${n3(Math.cos(a) * (R - 4.2))} ${n3(Math.sin(a) * (R - 4.2))}`);
  }
  return (
    <g>
      <circle cx={1.4} cy={2} r={R} className="f-shade" />
      <circle r={R} className="f-lemon" />
      <circle r={R - 1.6} className="f-lemon-face" />
      <path d={seg.join("")} className="ln-soft" style={{ stroke: "var(--k-lemon-dark)", opacity: 0.9 }} />
      <circle r={3} className="f-lemon" opacity={0.7} />
      <circle r={R - 1.6} className="ln-faint" />
      <circle r={R} className="ln" />
      {slots && [-11, 11].map((x) => <rect key={x} x={x - 6} y={-0.9} width={12} height={1.8} rx={0.6} className="f-lemon-dark" />)}
    </g>
  );
}

function Lemon({ pi }: DrawProps<"lemon">) {
  const L = localLegs(pi);
  return (
    <g>
      <LemonFace slots={false} />
      <rect x={n3(L.pos![0] - 0.7)} y={-LEMON.stripW / 2} width={1.4} height={LEMON.stripW} rx={0.3} className="f-copper ln" />
      <rect x={n3(L.neg![0] - 0.7)} y={-LEMON.stripW / 2} width={1.4} height={LEMON.stripW} rx={0.3} className="f-zinc ln" />
    </g>
  );
}

function Cup({ pi }: DrawProps<"cup">) {
  const labels = useLabels();
  const R = CUP.dia / 2;
  const L = localLegs(pi);
  const rot = pi.f.rot;
  // Salt grains: a salty cup, or the pinches stirred in.
  const grains = pi.part.params.water === "salty" ? 5 : Math.min(5, (pi.part.params.salt ?? 0) * 2);
  return (
    <g>
      <circle cx={1.4} cy={2} r={R} className="f-shade" />
      <circle r={R} className="f-glass" />
      <circle r={R - 3.2} className="f-water" />
      <path d={`M${-R * 0.55} -6Q${-R * 0.3} -9 ${-R * 0.05} -6T${R * 0.45} -6M${-R * 0.4} 9Q${-R * 0.15} 6 ${R * 0.1} 9T${R * 0.55} 9`} className="ln-soft s-water" />
      {([[-14, -14], [8, -18], [16, 12], [-6, 16], [-20, 6]] as Vec2[]).slice(0, grains).map(([x, z], i) => <rect key={i} x={x} y={z} width={0.9} height={0.9} className="f-slip ln-thin" />)}
      <circle r={R - 3.2} className="ln-faint" />
      <circle r={R} className="ln" />
      {[L.a!, L.b!].map((p, i) => (
        <rect key={i} x={n3(p[0] - 1.1)} y={n3(p[1] - 5)} width={2.2} height={10} rx={0.4} className="f-copper ln" />
      ))}
      <Upright x={0} z={R - 8} rot={rot} fontSize={3.4} fontWeight={700} letterSpacing={0.6} textAnchor="middle" dominantBaseline="central" className="print">
        {labels.water[pi.part.params.water]}
      </Upright>
    </g>
  );
}

function Speaker({ pi, st }: DrawProps<"speaker">) {
  const R = (pi.part.params.size ?? 40) / 2;
  const hp = health(st);
  return (
    <g>
      <circle cx={1.2} cy={1.6} r={R} className="f-shade" />
      <circle r={R} className="f-speaker" />
      <circle r={R * 0.86} className="f-cone" />
      {[0.78, 0.62, 0.46].map((k) => (
        <circle key={k} r={R * k} className="ln-soft s-slip" />
      ))}
      <circle r={R * 0.28} className="f-black-face" />
      {[45, 135, 225, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return <circle key={a} cx={n3(Math.cos(r) * R * 0.93)} cy={n3(Math.sin(r) * R * 0.93)} r={1.1} className="f-paper ln-thin" />;
      })}
      {hp === "dead" && <path d={`M${n3(-R * 0.5)} ${n3(-R * 0.1)}l${n3(R * 0.2)} ${n3(R * 0.12)}l${n3(R * 0.1)} ${n3(-R * 0.14)}l${n3(R * 0.18)} ${n3(R * 0.1)}`} className="crack" />}
      <circle r={R} className="ln" />
      <circle r={R * 0.86} className="ln-thin" />
      <rect x={-5} y={n3(R - 1)} width={10} height={3.4} rx={0.8} className="f-black ln-thin" />
    </g>
  );
}

export const POWER: InkRegistry = {
  battery: { box: batteryBox, Draw: Battery },
  station: { box: () => [-STATION.w / 2, -STATION.d / 2, STATION.w / 2, STATION.d / 2], Draw: Station, layer: 0 },
  lemon: { box: () => [-LEMON.dia / 2, -LEMON.dia / 2, LEMON.dia / 2, LEMON.dia / 2], Draw: Lemon, layer: 0 },
  cup: { box: () => [-CUP.dia / 2, -CUP.dia / 2, CUP.dia / 2, CUP.dia / 2], Draw: Cup, layer: 0 },
  speaker: {
    box: (p) => {
      const r = (p.params.size ?? 40) / 2;
      return [-r, -r, r, r + 2.4];
    },
    Draw: Speaker,
  },
};

export { rrect };
