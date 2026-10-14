// Unit 1 lab props, top down: the resistor holder, lemon half and electrodes, skin patch, material samples, the
// pencil card, value labels, the reject bin, the colour chart, the desk clock and the display case.

import { BIN, CARD, CHART, CLOCK, ELECTRODE, HOLDER, SAMPLE, SHOWCASE, SKIN, TAG } from "../../dims";
import type { BandColor } from "../../colorCode";
import { useLabels } from "../../labels";
import type { Moisture, Vec2 } from "../../types";
import { segments } from "../draw/segments";
import { BAND_TOKEN } from "../styles";
import { Upright, localLegs, n3, rrect } from "./common";
import { LemonFace } from "./power";
import type { DrawProps, InkRegistry } from "./types";

// Resistor holder ------------------------------------------------------------------------------------------------

function Holder({ pi }: DrawProps<"holder">) {
  const H = HOLDER;
  const L = localLegs(pi);
  return (
    <g>
      <rect x={-H.len / 2 + 1.2} y={-H.d / 2 + 1.5} width={H.len} height={H.d} rx={2.2} className="f-shade" />
      <rect x={-H.len / 2} y={-H.d / 2} width={H.len} height={H.d} rx={2.2} className="f-black" />
      <rect x={-H.len / 2} y={-H.d / 2} width={H.len} height={H.d} rx={2.2} className="ln" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={n3(Math.min(s * H.clipX, s * H.termX))} y={-1.2} width={n3(H.termX - H.clipX)} height={2.4} className="f-brass" />
          <rect x={n3(s * H.clipX - 2.3)} y={-3} width={4.6} height={6} rx={0.6} className="f-brass ln-thin" />
          <path d={`M${n3(s * H.clipX - 1.2)} -2.4V2.4M${n3(s * H.clipX + 1.2)} -2.4V2.4`} className="ln-thin" />
        </g>
      ))}
      {[L.a!, L.b!].map((p, i) => (
        <g key={i}>
          <circle cx={n3(p[0])} cy={n3(p[1])} r={2.8} className="f-brass ln" />
          <circle cx={n3(p[0])} cy={n3(p[1])} r={2} className="f-metal-hi ln-thin" />
          <path d={`M${n3(p[0] - 1.6)} ${n3(p[1] + 0.9)}L${n3(p[0] + 1.6)} ${n3(p[1] - 0.9)}`} className="ln-thin" />
        </g>
      ))}
    </g>
  );
}

// Lemon half and electrodes --------------------------------------------------------------------------------------

function Fruit() {
  return <LemonFace slots />;
}

function Electrode({ pi }: DrawProps<"electrode">) {
  const copper = pi.part.params.metal === "copper";
  if (pi.pose.heldBy) {
    // Standing in a slot, seen edge on from above.
    const w = copper ? ELECTRODE.coin : ELECTRODE.stripW;
    const t = copper ? 2.2 : 1.6;
    return <rect x={-w / 2} y={-t / 2} width={w} height={t} rx={0.6} className={copper ? "f-copper ln" : "f-zinc ln"} />;
  }
  if (copper) {
    const R = ELECTRODE.coin / 2;
    return (
      <g>
        <circle cx={0.6} cy={0.9} r={R} className="f-shade" />
        <circle r={R} className="f-copper" />
        <circle r={R - 1.6} className="ln-soft" />
        <path d={`M${n3(-R * 0.5)} ${n3(-R * 0.55)}A${n3(R * 0.7)} ${n3(R * 0.7)} 0 0 1 ${n3(R * 0.3)} ${n3(-R * 0.72)}`} className="sheen" />
        <circle r={R} className="ln" />
      </g>
    );
  }
  const L = ELECTRODE.stripL;
  const W = ELECTRODE.stripW;
  return (
    <g>
      <rect x={-L / 2 + 0.6} y={-W / 2 + 0.8} width={L} height={W} rx={0.6} className="f-shade" />
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={0.6} className="f-zinc" />
      <path d="M-14 -2l3 1.6l-2 2.2M-2 1.4l3 -2l2.4 1.6M9 -2.4l2 2.2l-2.6 1.4" className="ln-soft" />
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={0.6} className="ln" />
    </g>
  );
}

// Skin patch -----------------------------------------------------------------------------------------------------

const DROPS: Record<Moisture, number> = { dry: 0, damp: 5, wet: 12, salty: 9 };
const DROP_SPOTS: Vec2[] = [[-30, -14], [-18, -2], [-6, -16], [6, -4], [20, -15], [31, -3], [-26, -9], [13, -11], [-12, -1], [26, -17], [0, -12], [-34, -3]];

function Skin({ pi }: DrawProps<"skin">) {
  const labels = useLabels();
  const S = SKIN;
  const L = localLegs(pi);
  const rot = pi.f.rot;
  const m = pi.part.params.moisture;
  const names = labels.settings["skin.moisture"]?.values ?? {};
  const pad = rrect(0, S.padZ, S.w, S.d, 3.6);
  return (
    <g>
      <rect x={-S.baseW / 2 + 1.2} y={-S.baseD / 2 + 1.6} width={S.baseW} height={S.baseD} rx={3} className="f-shade" />
      <rect x={-S.baseW / 2} y={-S.baseD / 2} width={S.baseW} height={S.baseD} rx={3} className="f-wood" />
      <rect x={-S.baseW / 2} y={-S.baseD / 2} width={S.baseW} height={S.baseD} rx={3} className="ln" />
      <path d={pad} className="f-skin" />
      <path d={`M-32 ${S.padZ - 9}c8 -1 18 1 26 0M-4 ${S.padZ + 9}c10 1 20 -1 30 0M-30 ${S.padZ + 4}c6 1 12 0 16 -1`} className="ln-soft s-skin" />
      {DROP_SPOTS.slice(0, DROPS[m]).map(([x, z], i) => (
        <ellipse key={i} cx={x} cy={z} rx={1.3} ry={1} className="f-drop ln-faint" />
      ))}
      {m === "salty" && DROP_SPOTS.slice(0, 8).map(([x, z], i) => <rect key={i} x={x + 3} y={z + 2} width={0.8} height={0.8} className="f-slip ln-thin" />)}
      <path d={pad} className="ln" />
      {[0, 1, 2, 3, 4].map((k) => {
        const p = L[`m${k}`]!;
        return (
          <g key={k}>
            <circle cx={n3(p[0])} cy={n3(p[1])} r={1} className="f-ink2" />
            <Upright x={p[0]} z={p[1] + 5.4} rot={rot} fontSize={3} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print">
              {String(k)}
            </Upright>
          </g>
        );
      })}
      <Upright x={(L.m4?.[0] ?? 20) + 6} z={(L.m4?.[1] ?? S.padZ) + 5.4} rot={rot} fontSize={2.6} textAnchor="middle" dominantBaseline="central" className="print">
        {labels.print.cm}
      </Upright>
      {(["dry", "damp", "wet", "salty"] as const).map((v, i) => {
        const x = (i - 1.5) * 22;
        const z = S.baseD / 2 - 9;
        const on = v === m;
        return (
          <g key={v}>
            <rect x={x - 9.5} y={z - 5} width={19} height={10} rx={1.4} className={on ? "f-blue-wash" : "f-slip"} />
            <rect x={x - 9.5} y={z - 5} width={19} height={10} rx={1.4} className={on ? "sel" : "ln-thin"} />
            <Upright x={x} z={z} rot={rot} fontSize={2.9} fontWeight={700} textAnchor="middle" dominantBaseline="central" className={on ? "t-blue" : "print"}>
              {(names[v] ?? v).toUpperCase()}
            </Upright>
          </g>
        );
      })}
    </g>
  );
}

// Material samples -----------------------------------------------------------------------------------------------

function Sample({ pi }: DrawProps<"sample">) {
  const L = localLegs(pi);
  if (pi.part.params.material === "plastic") {
    const S = SAMPLE;
    const ticks: string[] = [];
    const nums: number[] = [];
    for (let mm = 0; mm <= 140; mm++) {
      const x = -70 + mm;
      const len = mm % 10 === 0 ? 4.5 : mm % 5 === 0 ? 3 : 1.8;
      ticks.push(`M${x} ${-S.rulerW / 2}v${len}`);
      if (mm % 10 === 0) nums.push(mm / 10);
    }
    return (
      <g>
        <rect x={-S.ruler / 2 + 1} y={-S.rulerW / 2 + 1.4} width={S.ruler} height={S.rulerW} rx={1.4} className="f-shade" />
        <rect x={-S.ruler / 2} y={-S.rulerW / 2} width={S.ruler} height={S.rulerW} rx={1.4} className="f-ruler" />
        <path d={ticks.join("")} className="ln-thin lod1" />
        {nums.map((n) => (
          <text key={n} x={-70 + n * 10} y={-S.rulerW / 2 + 7.4} fontSize={2.6} textAnchor="middle" className="print lod1">
            {n}
          </text>
        ))}
        <rect x={-S.ruler / 2} y={-S.rulerW / 2} width={S.ruler} height={S.rulerW} rx={1.4} className="ln" />
        {[L.a!, L.b!].map((p, i) => (
          <circle key={i} cx={n3(p[0])} cy={n3(p[1])} r={1.6} className="ln-faint" strokeDasharray="1 1" />
        ))}
      </g>
    );
  }
  const W = SAMPLE.wire / 2;
  const d = `M${-W} 0C${-W * 0.8} 0.9 ${-W * 0.7} 1.8 ${-W * 0.55} 1.8S${-W * 0.25} -1.2 ${-W * 0.1} -1.2S${W * 0.2} 1.4 ${W * 0.35} 1.4S${W * 0.8} 0 ${W} 0`;
  const w = { ["--w" as string]: `${SAMPLE.wireR * 2}px` };
  return (
    <g>
      <path d={d} className="edge" style={w} />
      <path d={d} className="core" style={{ ...w, stroke: "var(--k-copper)" }} />
      {[L.a!, L.b!].map((p, i) => (
        <circle key={i} cx={n3(p[0])} cy={n3(p[1])} r={1.4} className="ln-faint" strokeDasharray="1 1" />
      ))}
    </g>
  );
}

// Pencil card ----------------------------------------------------------------------------------------------------

function Card({ pi }: DrawProps<"card">) {
  const labels = useLabels();
  const C = CARD;
  const rot = pi.f.rot;
  const len = Math.max(0, Math.min(10, pi.part.params.length)) * 10;
  const layers = Math.max(0, Math.min(4, Math.round(pi.part.params.layers)));
  const width = pi.part.params.wide ? 4 : 2;
  const ticks: string[] = [];
  for (let mm = 0; mm <= 100; mm++) {
    const x = C.x0 + mm;
    const l = mm % 10 === 0 ? 3.6 : mm % 5 === 0 ? 2.4 : 1.4;
    ticks.push(`M${x} 12v${l}`);
  }
  const dots: string[] = [];
  for (let k = 0; k <= 20; k++) dots.push(`M${C.x0 + k * 5} ${C.lineZ - 1.6}v0.01`);
  return (
    <g>
      <rect x={-C.w / 2 + 1} y={-C.d / 2 + 1.4} width={C.w} height={C.d} rx={2} className="f-shade" />
      <rect x={-C.w / 2} y={-C.d / 2} width={C.w} height={C.d} rx={2} className="f-slip" />
      <rect x={-C.w / 2} y={-C.d / 2} width={C.w} height={C.d} rx={2} className="ln" />
      <path d={`M${C.x0} ${C.lineZ}H${C.x0 + 100}`} className="ln-faint" strokeDasharray="2.4 2" />
      <path d={`M${C.x0} ${C.lineZ - 4}l2 -3h-4z`} className="f-blue" />
      <Upright x={C.x0 + 3.2} z={C.lineZ - 7.4} rot={rot} fontSize={2.8} fontWeight={700} dominantBaseline="central" className="t-blue">
        {labels.print.start}
      </Upright>
      {len > 0 && layers > 0 && (
        <path d={`M${C.x0} ${C.lineZ}H${n3(C.x0 + len)}`} strokeWidth={width} strokeLinecap="round" className="s-graphite" style={{ opacity: 0.38 + layers * 0.15 }} />
      )}
      <path d={dots.join("")} className="dots lod2" />
      <path d={`M${C.x0} 12H${C.x0 + 100}`} className="ln-thin" />
      <path d={ticks.join("")} className="ln-thin lod1" />
      {Array.from({ length: 11 }, (_, k) => (
        <Upright key={k} x={C.x0 + k * 10} z={19.6} rot={rot} fontSize={3} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print lod1">
          {String(k)}
        </Upright>
      ))}
      <Upright x={C.x0 + 106} z={19.6} rot={rot} fontSize={2.6} textAnchor="middle" dominantBaseline="central" className="print lod1">
        {labels.print.cm}
      </Upright>
      <Pencil x={-6} z={-C.d / 2 - 8} />
    </g>
  );
}

function Pencil({ x, z }: { x: number; z: number }) {
  const body = `M${x - 42} ${z - 3.2}H${x + 34}L${x + 42} ${z}L${x + 34} ${z + 3.2}H${x - 42}Z`;
  return (
    <g>
      <path d={`M${x - 42} ${z - 3.2}H${x + 34}V${z + 3.2}H${x - 42}Z`} className="f-pencil" />
      <path d={`M${x + 34} ${z - 3.2}L${x + 42} ${z}L${x + 34} ${z + 3.2}Z`} className="f-wood" />
      <path d={`M${x + 39.6} ${z - 0.9}L${x + 42} ${z}L${x + 39.6} ${z + 0.9}Z`} className="f-ink" />
      <rect x={x - 48} y={z - 3.2} width={6} height={6.4} rx={1.4} className="f-eraser" />
      <rect x={x - 43} y={z - 3.4} width={3} height={6.8} className="f-metal ln-thin" />
      <path d={`M${x - 40} ${z - 1}H${x + 34}M${x - 40} ${z + 1}H${x + 34}`} className="ln-soft" />
      <path d={body} className="ln" />
      <rect x={x - 48} y={z - 3.2} width={6} height={6.4} rx={1.4} className="ln" />
    </g>
  );
}

// Value label, reject bin, colour chart --------------------------------------------------------------------------

function Tag({ pi }: DrawProps<"tag">) {
  const rot = pi.f.rot;
  const text = pi.part.params.text;
  return (
    <g>
      <rect x={-TAG.w / 2 + 0.6} y={-TAG.d / 2 + 0.9} width={TAG.w} height={TAG.d} rx={1.2} className="f-shade" />
      <rect x={-TAG.w / 2} y={-TAG.d / 2} width={TAG.w} height={TAG.d} rx={1.2} className="f-slip" />
      <rect x={-TAG.w / 2} y={-TAG.d / 2} width={TAG.w} height={TAG.d} rx={1.2} className="ln" />
      <circle cx={-TAG.w / 2 + 2.2} cy={0} r={1.1} className="f-paper ln-thin" />
      <path d={`M${-TAG.w / 2 + 2.2} -1.1c-2 -2 -5 -2 -6 1s1 4 3 3`} className="core" style={{ ["--w" as string]: "0.45px", stroke: "var(--k-w-red)" }} />
      <Upright x={1.6} z={0.3} rot={rot} fontSize={text.length > 6 ? 4.2 : 5} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink">
        {text}
      </Upright>
    </g>
  );
}

function Bin({ pi }: DrawProps<"bin">) {
  const labels = useLabels();
  const rot = pi.f.rot;
  const text = pi.part.params.label ?? labels.print.rejects;
  return (
    <g>
      <rect x={-BIN.w / 2 + 1.2} y={-BIN.d / 2 + 1.8} width={BIN.w} height={BIN.d} rx={4} className="f-shade" />
      <rect x={-BIN.w / 2} y={-BIN.d / 2} width={BIN.w} height={BIN.d} rx={4} className="f-red" />
      <rect x={-BIN.w / 2 + 1.8} y={-BIN.d / 2 + 1.8} width={BIN.w - 3.6} height={BIN.d - 3.6} rx={3} className="f-red-floor" />
      <rect x={-BIN.w / 2 + 1.8} y={-BIN.d / 2 + 1.8} width={BIN.w - 3.6} height={BIN.d - 3.6} rx={3} className="ln-thin" />
      <rect x={-BIN.w / 2} y={-BIN.d / 2} width={BIN.w} height={BIN.d} rx={4} className="ln" />
      <rect x={-BIN.w * 0.31} y={BIN.d / 2 - 1.2} width={BIN.w * 0.62} height={6.4} rx={0.8} className="f-slip ln-thin" />
      <Upright x={0} z={BIN.d / 2 + 2} rot={rot} fontSize={3.4} fontWeight={700} letterSpacing={0.5} textAnchor="middle" dominantBaseline="central" className="f-ink">
        {text}
      </Upright>
    </g>
  );
}

const CHART_ROWS: { color: BandColor; digit: string; mult: string; tol?: string }[] = [
  { color: "black", digit: "0", mult: "× 1" },
  { color: "brown", digit: "1", mult: "× 10", tol: "± 1%" },
  { color: "red", digit: "2", mult: "× 100", tol: "± 2%" },
  { color: "orange", digit: "3", mult: "× 1 k" },
  { color: "yellow", digit: "4", mult: "× 10 k" },
  { color: "green", digit: "5", mult: "× 100 k" },
  { color: "blue", digit: "6", mult: "× 1 M" },
  { color: "violet", digit: "7", mult: "× 10 M" },
  { color: "grey", digit: "8", mult: "" },
  { color: "white", digit: "9", mult: "" },
  { color: "gold", digit: "", mult: "× 0.1", tol: "± 5%" },
  { color: "silver", digit: "", mult: "× 0.01", tol: "± 10%" },
];

function Chart({ pi }: DrawProps<"chart">) {
  const labels = useLabels();
  const rot = pi.f.rot;
  const W = CHART.w;
  const D = CHART.d;
  const top = -D / 2 + 11.5;
  const rowH = (D - 14) / CHART_ROWS.length;
  const col = { sw: -W / 2 + 5, name: -W / 2 + 15, digit: 8, mult: 27, tol: 42 };
  return (
    <g>
      <rect x={-W / 2 + 4} y={D / 2 - 2} width={W - 8} height={7} rx={1.4} className="f-wood-dark ln-thin" />
      <rect x={-W / 2 + 1} y={-D / 2 + 1.4} width={W} height={D} rx={1.6} className="f-shade" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={1.6} className="f-slip" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={1.6} className="ln" />
      <Upright x={-W / 2 + 5} z={-D / 2 + 4.6} rot={rot} fontSize={3.6} fontWeight={700} dominantBaseline="central" className="f-ink">
        {labels.print.chart}
      </Upright>
      {CHART_ROWS.map((r, i) => (
        <rect key={r.color} x={col.sw - 2.5} y={top + i * rowH + 0.4} width={5} height={rowH - 0.8} rx={0.4} style={{ fill: BAND_TOKEN(r.color) }} className="ln-thin" />
      ))}
      <g className="lod1">
        {[
          [col.digit, labels.print.digit],
          [col.mult, labels.print.multiplier],
          [col.tol, labels.print.tolerance],
        ].map(([x, t]) => (
          <text key={String(x)} x={x as number} y={top - 1.6} fontSize={2.2} fontWeight={600} textAnchor="middle" className="print">
            {t}
          </text>
        ))}
        {CHART_ROWS.map((r, i) => {
          const z = top + i * rowH;
          return (
            <g key={r.color}>
              {i % 2 === 0 && <rect x={-W / 2 + 3} y={z} width={W - 6} height={rowH} className="f-sunk" opacity={0.6} />}
              <text x={col.name} y={z + rowH / 2} fontSize={2.4} dominantBaseline="central" className="f-ink">
                {labels.print.bands[r.color] ?? r.color}
              </text>
              <text x={col.digit} y={z + rowH / 2} fontSize={2.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink">
                {r.digit}
              </text>
              <text x={col.mult} y={z + rowH / 2} fontSize={2.4} textAnchor="middle" dominantBaseline="central" className="f-ink">
                {r.mult}
              </text>
              <text x={col.tol} y={z + rowH / 2} fontSize={2.4} textAnchor="middle" dominantBaseline="central" className="f-ink">
                {r.tol ?? ""}
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
}

// Clock ----------------------------------------------------------------------------------------------------------

function Clock({ pi, minutes }: DrawProps<"clock">) {
  const labels = useLabels();
  const rot = pi.f.rot;
  const h = Math.floor(minutes / 60);
  const mm = Math.floor(minutes % 60);
  const text = `${h}`.padStart(2, " ") + `${mm}`.padStart(2, "0");
  const W = CLOCK.w;
  const D = CLOCK.h;
  const cw = 6.4;
  const ch = 11;
  const gap = 2.2;
  const x0 = -((cw + gap) * 4 + 2) / 2 + 1;
  return (
    <g>
      <rect x={-W / 2 + 1} y={-D / 2 + 1.4} width={W} height={D} rx={4} className="f-shade" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={4} className="f-slip" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={4} className="ln" />
      <rect x={-W / 2 + 3} y={-D / 2 + 4} width={W - 6} height={D - 8} rx={2} className="f-knob" />
      <rect x={-W / 2 + 5} y={-D / 2 + 6} width={W - 10} height={D - 12} rx={1} className="f-lcd" />
      <g className="f-lcd-ink">
        {[...text].map((c, i) => (
          <g key={i} transform={`translate(${n3(x0 + i * (cw + gap) + (i >= 2 ? 2 : 0))} ${n3(-ch / 2 + 0.6)})`}>
            <path d={segments(c, cw, ch, 1.2)} />
          </g>
        ))}
        <rect x={n3(x0 + 2 * (cw + gap) - 0.4)} y={-2.4} width={1.1} height={1.1} />
        <rect x={n3(x0 + 2 * (cw + gap) - 0.6)} y={1.6} width={1.1} height={1.1} />
      </g>
      <Upright x={-W / 2 + 7} z={-D / 2 + 8.4} rot={rot} fontSize={2} fontWeight={700} dominantBaseline="central" className="lcd-label">
        {labels.print.time}
      </Upright>
    </g>
  );
}

// Display case ---------------------------------------------------------------------------------------------------

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out.slice(0, 4);
}

function Showcase({ pi }: DrawProps<"showcase">) {
  const labels = useLabels();
  const rot = pi.f.rot;
  const W = SHOWCASE.w;
  const D = SHOWCASE.d;
  const placard = (x: number, text: string) => (
    <g>
      <rect x={x - 24} y={D / 2 - 15} width={48} height={11} rx={0.8} className="f-slip ln-thin" />
      {wrap(text, 30).map((l, i) => (
        <text key={i} x={x - 22} y={D / 2 - 12.2 + i * 2.6} fontSize={2.1} dominantBaseline="central" className="f-ink">
          {l}
        </text>
      ))}
    </g>
  );
  return (
    <g>
      <rect x={-W / 2 + 1.4} y={-D / 2 + 2} width={W} height={D} rx={2} className="f-shade" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={2} className="f-sunk" />
      <rect x={-52} y={-20} width={46} height={26} rx={2.4} className="f-black-face ln" />
      <Upright x={-29} z={-7} rot={rot} fontSize={3.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        Li-ion
      </Upright>
      <rect x={8} y={-22} width={44} height={28} rx={1.6} className="f-black ln" />
      <circle cx={16} cy={-17} r={2.6} className="f-red ln-thin" />
      <circle cx={44} cy={-17} r={2.6} className="f-black-face ln-thin" />
      <Upright x={30} z={-4} rot={rot} fontSize={4.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        12 V
      </Upright>
      {placard(-29, labels.print.phonePack)}
      {placard(30, labels.print.carBattery)}
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={2} className="f-glass" opacity={0.35} />
      <rect x={-W / 2 + 2.4} y={-D / 2 + 2.4} width={W - 4.8} height={D - 4.8} rx={1.4} className="ln-faint" />
      <path d={`M${-W / 2 + 8} ${-D / 2 + 12}l12 -8M${-W / 2 + 12} ${-D / 2 + 16}l6 -4`} className="sheen" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={2} className="ln" />
      <Upright x={0} z={-D / 2 - 4} rot={rot} fontSize={3.4} fontWeight={700} letterSpacing={0.5} textAnchor="middle" dominantBaseline="central" className="t-red">
        {labels.print.showcase}
      </Upright>
    </g>
  );
}

export const PROPS: InkRegistry = {
  holder: { box: () => [-HOLDER.len / 2, -HOLDER.d / 2, HOLDER.len / 2, HOLDER.d / 2], Draw: Holder, layer: 0 },
  fruit: { box: () => [-30, -30, 30, 30], Draw: Fruit, layer: 0 },
  electrode: {
    box: (p, c) => {
      const copper = p.params.metal === "copper";
      if (c.held) return copper ? [-ELECTRODE.coin / 2, -1.2, ELECTRODE.coin / 2, 1.2] : [-ELECTRODE.stripW / 2, -0.9, ELECTRODE.stripW / 2, 0.9];
      return copper ? [-ELECTRODE.coin / 2, -ELECTRODE.coin / 2, ELECTRODE.coin / 2, ELECTRODE.coin / 2] : [-ELECTRODE.stripL / 2, -ELECTRODE.stripW / 2, ELECTRODE.stripL / 2, ELECTRODE.stripW / 2];
    },
    Draw: Electrode,
  },
  skin: { box: () => [-SKIN.baseW / 2, -SKIN.baseD / 2, SKIN.baseW / 2, SKIN.baseD / 2], Draw: Skin, layer: 0 },
  sample: {
    box: (p) => (p.params.material === "plastic" ? [-SAMPLE.ruler / 2, -SAMPLE.rulerW / 2, SAMPLE.ruler / 2, SAMPLE.rulerW / 2] : [-SAMPLE.wire / 2, -2.4, SAMPLE.wire / 2, 2.6]),
    Draw: Sample,
    layer: 0,
  },
  card: { box: () => [-CARD.w / 2, -CARD.d / 2 - 12, CARD.w / 2, CARD.d / 2], Draw: Card, layer: 0 },
  tag: { box: () => [-TAG.w / 2 - 4, -TAG.d / 2, TAG.w / 2, TAG.d / 2], Draw: Tag },
  bin: { box: () => [-BIN.w / 2, -BIN.d / 2, BIN.w / 2, BIN.d / 2 + 5.2], Draw: Bin, layer: 0 },
  chart: { box: () => [-CHART.w / 2, -CHART.d / 2, CHART.w / 2, CHART.d / 2 + 5], Draw: Chart, layer: 0 },
  clock: { box: () => [-CLOCK.w / 2, -CLOCK.h / 2, CLOCK.w / 2, CLOCK.h / 2], Draw: Clock, layer: 0, clock: true },
  showcase: { box: () => [-SHOWCASE.w / 2, -SHOWCASE.d / 2 - 7, SHOWCASE.w / 2, SHOWCASE.d / 2], Draw: Showcase, layer: 0 },
};

