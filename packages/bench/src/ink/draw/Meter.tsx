// The multimeter, top down at true size: a seven-segment LCD fed by the simulator, the rotary dial with its
// positions, four sockets, banana plugs, cables and probes.

import { memo } from "react";
import { useStore } from "zustand";
import { useLabels, type BenchLabels } from "../../labels";
import { DIAL_MODES, METER, METER_RANGES, meterRange, rangeText } from "../../layout";
import type { BenchStore } from "../../store";
import type { MeterMode, MeterSocket, MeterState } from "../../types";
import { INK, dialLabelLocal, frameTransform, type MeterInk, type ProbeInk } from "../model";
import { WIRE_TOKEN } from "../styles";
import { n3 } from "./shared";
import { lcdCells, segments } from "./segments";

const LCD = METER.lcd;

function Lcd({ display, unit, mode, on, beep, range }: { display: string; unit: string; mode: MeterMode; on: boolean; beep: boolean; range: string | null }) {
  const cells = lcdCells(display);
  const n = Math.max(4, cells.length);
  const h = 16;
  const w = 8.6;
  const gap = 2.6;
  const right = LCD.x1 - 4.6;
  const top = LCD.z0 + 4.4;
  const x0 = right - n * w - (n - 1) * gap;
  const ac = mode === "acv";
  const annun = mode === "off" ? "" : ac ? "AC" : mode === "ohm" || mode === "continuity" || mode === "diode" ? "" : "DC";
  return (
    <g>
      <rect x={LCD.x0 - 2.4} y={LCD.z0 - 2.4} width={LCD.x1 - LCD.x0 + 4.8} height={LCD.z1 - LCD.z0 + 4.8} rx={2.2} className="f-knob" />
      <rect x={LCD.x0} y={LCD.z0} width={LCD.x1 - LCD.x0} height={LCD.z1 - LCD.z0} rx={0.8} className={on ? "f-lcd" : "f-lcd-off"} />
      {on && (
        <g className="f-lcd-ink">
          {Array.from({ length: n }, (_, i) => {
            const cell = cells[i - (n - cells.length)] ?? { ch: " ", dot: false };
            const x = x0 + i * (w + gap);
            return (
              <g key={i} transform={`translate(${n3(x)} ${n3(top)})`}>
                <path d={segments(cell.ch, w, h, 1.7)} />
                {cell.dot && <rect x={w + gap / 2 - 0.9} y={h - 1.7} width={1.8} height={1.8} />}
              </g>
            );
          })}
          <text x={LCD.x1 - 2.2} y={LCD.z1 - 2.4} fontSize={5} fontWeight={600} textAnchor="end">
            {unit}
          </text>
          <text x={LCD.x0 + 2.4} y={LCD.z1 - 2.6} fontSize={3.2} fontWeight={600}>
            {annun}
          </text>
          {range && (
            <text x={LCD.x0 + 2.4} y={LCD.z0 + 5.2} fontSize={3.2} fontWeight={600} data-meter-range={range}>
              {rangeText(range)}
            </text>
          )}
          {beep && (
            <path d={`M${LCD.x0 + 12} ${LCD.z1 - 4}a1.6 1.6 0 0 1 0 -2.4M${LCD.x0 + 13.6} ${LCD.z1 - 2.4}a3.2 3.2 0 0 0 0 -5.6`} fill="none" style={{ stroke: "var(--k-lcd-ink)" }} strokeWidth={0.5} />
          )}
        </g>
      )}
    </g>
  );
}

const LiveLcd = memo(function LiveLcd({ store, id, mode, range }: { store: BenchStore; id: string; mode: MeterMode; range: string | null }) {
  const display = useStore(store, (s) => (mode === "off" ? "" : (s.snapshot?.parts[id]?.display ?? "")));
  const unit = useStore(store, (s) => (mode === "off" ? "" : (s.snapshot?.parts[id]?.unit ?? "")));
  const beep = useStore(store, (s) => s.snapshot?.parts[id]?.extra?.["beep"] === true);
  return <Lcd display={display} unit={unit} mode={mode} on={mode !== "off"} beep={beep} range={range} />;
});

/** The RANGE key: a tap steps the range up, a long press down (interaction.ts); the display shows where it is. */
function RangeKey({ range }: { range: string | null }) {
  const labels = useLabels();
  const k = METER.rangeKey;
  const name = `${labels.meterRange}: ${range === null || range === "auto" ? labels.meterAuto : rangeText(range)}`;
  return (
    <g data-kb="range" tabIndex={0} role="button" aria-label={name}>
      <rect x={k.x - k.w / 2 + 0.6} y={k.z - k.d / 2 + 0.8} width={k.w} height={k.d} rx={1.8} className="f-shade" />
      <rect x={k.x - k.w / 2} y={k.z - k.d / 2} width={k.w} height={k.d} rx={1.8} className="f-slip" />
      <rect x={k.x - k.w / 2} y={k.z - k.d / 2} width={k.w} height={k.d} rx={1.8} className="ln" />
      <text x={k.x} y={k.z + 0.1} fontSize={2.7} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print">
        RANGE
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Dial.

function DialGlyph({ mode, x, z }: { mode: MeterMode; x: number; z: number }) {
  const t = (s: string, dx = 0) => (
    <text x={n3(x + dx)} y={n3(z)} fontSize={4.1} fontWeight={600} textAnchor="middle" dominantBaseline="central">
      {s}
    </text>
  );
  const pen = { fill: "none", stroke: "currentColor", strokeWidth: 0.55, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (mode) {
    case "off":
      return t("OFF");
    case "dcv":
      return (
        <g>
          {t("V", -1.6)}
          <path d={`M${n3(x + 0.6)} ${n3(z - 1.2)}h3.4M${n3(x + 0.6)} ${n3(z + 0.4)}h0.9M${n3(x + 1.85)} ${n3(z + 0.4)}h0.9M${n3(x + 3.1)} ${n3(z + 0.4)}h0.9`} {...pen} />
        </g>
      );
    case "acv":
      return (
        <g>
          {t("V", -1.6)}
          <path d={`M${n3(x + 0.6)} ${n3(z)}q0.9 -1.6 1.8 0t1.8 0`} {...pen} />
        </g>
      );
    case "ohm":
      return t("Ω");
    case "continuity":
      return <path d={`M${n3(x - 2)} ${n3(z + 1.4)}v-2.8M${n3(x - 0.6)} ${n3(z - 1.6)}a2 2 0 0 1 0 3.2M${n3(x + 0.8)} ${n3(z - 2.6)}a3.4 3.4 0 0 1 0 5.2`} {...pen} />;
    case "diode":
      return <path d={`M${n3(x - 2.4)} ${n3(z)}h1M${n3(x - 1.4)} ${n3(z - 1.6)}v3.2l2.6 -1.6z M${n3(x + 1.2)} ${n3(z - 1.6)}v3.2M${n3(x + 1.2)} ${n3(z)}h1.2`} {...pen} />;
    case "dca-10a":
      return t("10A");
    case "dca-ma":
      return t("mA");
  }
}

function Dial({ mode, name }: { mode: MeterMode; name: string }) {
  const labels = useLabels();
  const i = Math.max(0, DIAL_MODES.indexOf(mode as (typeof DIAL_MODES)[number]));
  const angle = (i * 360) / DIAL_MODES.length;
  const K = METER.dial.knob;
  const cz = METER.dial.z;
  return (
    <g>
      <circle cx={0} cy={cz} r={METER.dial.labels - 4.6} className="ln-faint" />
      {DIAL_MODES.map((m, j) => {
        const [x, z] = dialLabelLocal(j);
        const a = (j * 2 * Math.PI) / DIAL_MODES.length;
        const r0 = METER.dial.labels - 6;
        const r1 = METER.dial.labels - 3.6;
        return (
          <g key={m} style={{ color: m === mode ? "var(--k-ink)" : "var(--k-ink-3)", fill: "currentColor" }} aria-label={labels.meterModes[m]}>
            <path d={`M${n3(Math.sin(a) * r0)} ${n3(cz - Math.cos(a) * r0)}L${n3(Math.sin(a) * r1)} ${n3(cz - Math.cos(a) * r1)}`} className={m === mode ? "ln" : "ln-faint"} />
            <DialGlyph mode={m} x={x} z={z} />
          </g>
        );
      })}
      <circle cx={0.8} cy={cz + 1.2} r={K} className="f-shade" />
      <g className="dial-knob" style={{ transform: `translate(0px,${cz}px) rotate(${angle}deg)` }} data-kb="dial" tabIndex={0} role="slider" aria-label={name} aria-valuetext={labels.meterModes[mode]} aria-valuenow={i} aria-valuemin={0} aria-valuemax={DIAL_MODES.length - 1}>
        <circle r={K} className="f-knob" />
        <rect x={-4.4} y={-K + 0.6} width={8.8} height={2 * K - 1.2} rx={4.4} className="f-black-face" />
        <path d={`M0 ${-K + 1.6}V-4.5`} className="core" style={{ ["--w" as string]: "1.6px", stroke: "var(--k-slip)" }} />
        <path d={`M-2 ${-K + 3.4}L0 ${-K + 0.8}L2 ${-K + 3.4}Z`} className="f-slip" />
        <circle r={K} className="ln" />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Sockets, plugs, probes.

const SOCKET_TEXT: Record<MeterSocket, string> = { a10: "10A", ma: "mA", com: "COM", vohm: "VΩ" };

function Sockets() {
  const z = METER.sockets.z;
  const r = METER.sockets.dia / 2;
  return (
    <g>
      {(Object.keys(METER.sockets.xs) as MeterSocket[]).map((s) => {
        const x = METER.sockets.xs[s];
        return (
          <g key={s}>
            <circle cx={x} cy={z} r={r} style={{ fill: s === "com" ? "var(--k-w-black)" : "var(--k-w-red)" }} />
            <circle cx={x} cy={z} r={r - 1.5} className="f-black-face" />
            <circle cx={x} cy={z} r={1.3} className="f-hole-in" />
            <circle cx={x} cy={z} r={r} className="ln" />
            <text x={x} y={z - r - 1.8} fontSize={3.3} fontWeight={600} textAnchor="middle" className="print">
              {SOCKET_TEXT[s]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Probe({ p, held, name }: { p: ProbeInk; held: boolean; name: string }) {
  const ang = (Math.atan2(p.dir[1], p.dir[0]) * 180) / Math.PI;
  const col = WIRE_TOKEN(p.color);
  const L = p.len;
  const short = L < 40;
  const T = short ? 5 : INK.probeTip;
  const grips = short ? [12, 16, 20] : [20, 25, 30, 35, 40];
  // Held on something, the probe stands nearly upright: from above it is short and see-through, so it never hides
  // what it touches.
  const g = short ? 0.75 : 1;
  return (
    <g transform={`translate(${n3(p.tip[0])} ${n3(p.tip[1])}) rotate(${n3(ang)}) scale(1 ${g})`} opacity={short ? 0.7 : 1} data-kb={`probe:${p.color}`} tabIndex={0} role="button" aria-label={name}>
      <path d={`M0 0H${T + 0.5}`} className="edge" style={{ ["--w" as string]: "0.8px" }} />
      <path d={`M0 0H${T + 0.5}`} className="core" style={{ ["--w" as string]: "0.8px", stroke: "var(--k-metal-hi)" }} />
      <path d={`M${T} -4.2Q${T + 1.6} -4.2 ${T + 2.4} -2.6L${T + 3.2} -2.6H${L - 6}Q${L} -2.6 ${L} 0Q${L} 2.6 ${L - 6} 2.6H${T + 3.2}L${T + 2.4} 2.6Q${T + 1.6} 4.2 ${T} 4.2Z`} style={{ fill: col }} />
      {grips.map((x) => (
        <path key={x} d={`M${T + x} -2.6V2.6`} className="ln-soft" />
      ))}
      <path d={`M${T} -4.2Q${T + 1.6} -4.2 ${T + 2.4} -2.6L${T + 3.2} -2.6H${L - 6}Q${L} -2.6 ${L} 0Q${L} 2.6 ${L - 6} 2.6H${T + 3.2}L${T + 2.4} 2.6Q${T + 1.6} 4.2 ${T} 4.2Z`} className={held ? "snap" : "ln"} strokeDasharray={held ? "3 3" : undefined} />
    </g>
  );
}

function Plug({ p, name }: { p: ProbeInk; name: string }) {
  const col = WIRE_TOKEN(p.color);
  if (p.plug.inSocket) {
    const [x, z] = p.plug.at;
    return (
      <g data-kb={`plug:${p.color}`} tabIndex={0} role="button" aria-label={name}>
        <circle cx={n3(x)} cy={n3(z)} r={INK.plugR} style={{ fill: col }} />
        <circle cx={n3(x)} cy={n3(z)} r={INK.plugR - 1.6} className="ln-soft" />
        <circle cx={n3(x)} cy={n3(z)} r={INK.plugR} className="ln" />
      </g>
    );
  }
  const ang = (Math.atan2(p.plug.dir[1], p.plug.dir[0]) * 180) / Math.PI;
  const L = INK.plugLen;
  return (
    <g transform={`translate(${n3(p.plug.at[0])} ${n3(p.plug.at[1])}) rotate(${n3(ang)})`} data-kb={`plug:${p.color}`} tabIndex={0} role="button" aria-label={name}>
      <path d="M0 0H7" className="edge" style={{ ["--w" as string]: "1.4px" }} />
      <path d="M0 0H7" className="core" style={{ ["--w" as string]: "1.4px", stroke: "var(--k-metal-hi)" }} />
      <rect x={6} y={-2.8} width={L - 6} height={5.6} rx={2} style={{ fill: col }} />
      <rect x={6} y={-2.8} width={L - 6} height={5.6} rx={2} className="ln" />
    </g>
  );
}

export const MeterBody = memo(function MeterBody({ mi, store, name }: { mi: MeterInk; store: BenchStore; name: string }) {
  const m: MeterState = mi.meter;
  const W = METER.width / 2;
  const H = METER.length / 2;
  return (
    <g transform={frameTransform(mi.f)} data-own={m.id} role="group" aria-label={name}>
      <rect x={-W + 1.6} y={-H + 2.2} width={METER.width} height={METER.length} rx={9} className="f-shade" />
      <rect x={-W} y={-H} width={METER.width} height={METER.length} rx={9} className="f-meter-rim" />
      <rect x={-W + 3.4} y={-H + 3.4} width={METER.width - 6.8} height={METER.length - 6.8} rx={6.4} className="f-meter" />
      <rect x={-W + 3.4} y={-H + 3.4} width={METER.width - 6.8} height={METER.length - 6.8} rx={6.4} className="ln-thin" />
      <rect x={-W} y={-H} width={METER.width} height={METER.length} rx={9} className="ln" />
      <LiveLcd store={store} id={m.id} mode={m.mode} range={METER_RANGES[m.mode] ? meterRange(m) : null} />
      <RangeKey range={METER_RANGES[m.mode] ? meterRange(m) : null} />
      <Dial mode={m.mode} name={name} />
      <Sockets />
    </g>
  );
});

export const MeterLeads = memo(function MeterLeads({ mi, held, labels }: { mi: MeterInk; held: "red" | "black" | null; labels: BenchLabels }) {
  return (
    <g data-own={mi.meter.id}>
      {(["black", "red"] as const).map((c) => {
        const p = mi.probes[c];
        const w = { ["--w" as string]: `${INK.probeCableW}px` };
        return (
          <g key={c}>
            <path d={p.cable} className="edge" style={w} />
            <path d={p.cable} className="core" style={{ ...w, stroke: WIRE_TOKEN(c) }} />
            <Plug p={p} name={`${labels.colors[c]} plug${mi.meter.probes[c].socket ? `, ${SOCKET_TEXT[mi.meter.probes[c].socket!]}` : ""}`} />
            <Probe p={p} held={held === c} name={`${labels.colors[c]} probe`} />
          </g>
        );
      })}
    </g>
  );
});


