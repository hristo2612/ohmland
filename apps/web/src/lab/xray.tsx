/**
 * The chip x-ray and the 555 map. Ink drawings of a chip seen from above, notch left (pin 1 bottom left, counting
 * round anticlockwise), with what is inside:
 *
 * - a 555: only the blocks of the pins named so far (the rails, the low and high watchers with their 1/3 and 2/3
 *   lines, the latch, the output stage, the drain switch, the reset line, the ladder of three equal resistors), live
 *   from the chip's state when the x-ray is open, or still on the notebook's 555 map;
 * - a gate chip: which gate is which, wired to its pins, each pin's level live.
 *
 * The drawings are pure (props in, SVG out); XrayPanel connects them to the bench.
 */
import { useEffect, useId, useMemo } from "react";
import { useStore } from "zustand";
import { m } from "../i18n";
import { blocks555, chipInfo, dipPosition, gatesOf, latchNamed, live555, mapComplete, partChip, pinCode, specChip, type ChipInfo, type Gate, type Level, type Live555 } from "./chips";
import type { PanelConfig } from "./define";
import type { LabRuntime } from "./runtime";
import "./chip-panels.css";

const W = 400;
/** The drawing's height: tags above and below the body. */
const H = 396;
const BODY = { x0: 32, x1: 368, y0: 72, y1: 322 };
const NOTCH_R = 12;

/** "9.40 V", "0.12 V". */
export const fmtV = (v: number | undefined): string => (v === undefined || !Number.isFinite(v) ? "–" : `${Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1)} V`);

/** Pin x positions for a DIP with `count` pins (one row). */
function pinX(count: number): (slot: number) => number {
  const per = count / 2;
  const step = (BODY.x1 - BODY.x0) / per;
  return (slot) => BODY.x0 + step / 2 + slot * step;
}

type Tag = { name?: string | undefined; value?: string | undefined; level?: Level | undefined; dim?: boolean | undefined };

/** The chip outline with its notch, pin 1 dot and printed name, the legs and the numbered tags. */
function Outline({ count, label, tags, printRight = false }: { count: number; label?: string | undefined; tags: (n: number) => Tag; printRight?: boolean }) {
  const x = pinX(count);
  const mid = (BODY.y0 + BODY.y1) / 2;
  const body = `M${BODY.x0} ${BODY.y0}H${BODY.x1}V${BODY.y1}H${BODY.x0}V${mid + NOTCH_R}A${NOTCH_R} ${NOTCH_R} 0 0 0 ${BODY.x0} ${mid - NOTCH_R}Z`;
  const pins = Array.from({ length: count }, (_, k) => k + 1);
  return (
    <g>
      <path d={body} className="xr-body" />
      <circle cx={BODY.x0 + 13} cy={BODY.y1 - 13} r={4} className="xr-dot" />
      {label && (
        <text x={printRight ? BODY.x1 - 12 : BODY.x0 + NOTCH_R + 8} y={mid + 5} className="xr-print" textAnchor={printRight ? "end" : "start"}>
          {label}
        </text>
      )}
      {pins.map((n) => {
        const { side, slot } = dipPosition(n, count);
        const px = x(slot);
        const top = side === "top";
        const t = tags(n);
        const cy = top ? 42 : BODY.y1 + 30;
        return (
          <g key={n} className="xr-pin" data-dim={t.dim || undefined} data-level={t.level}>
            <rect x={px - 6} y={top ? BODY.y0 - 16 : BODY.y1} width={12} height={16} className="xr-leg" />
            <circle cx={px} cy={cy} r={12} className="xr-tag" />
            <text x={px} y={cy + 4.5} className="xr-num" textAnchor="middle">
              {n}
            </text>
            {t.value && (
              <text x={px + 16} y={cy + 4.5} className="xr-volts">
                {t.value}
              </text>
            )}
            {t.name && (
              <text x={px} y={top ? 18 : BODY.y1 + 66} className="xr-name" textAnchor="middle">
                {t.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The 555

/** A resistor zigzag from (x, y0) down to (x, y1). */
function zigzag(x: number, y0: number, y1: number): string {
  const lead = (y1 - y0) * 0.18;
  const a = y0 + lead;
  const b = y1 - lead;
  const n = 6;
  let d = `M${x} ${y0}V${a}`;
  for (let i = 0; i < n; i++) d += `L${x + (i % 2 ? -6 : 6)} ${a + ((i + 0.5) * (b - a)) / n}`;
  return `${d}L${x} ${b}V${y1}`;
}

/** A horizontal line from x0 to x1 at y that hops over vertical wires at `over`. */
function hopLine(x0: number, x1: number, y: number, over: number[]): string {
  const dir = Math.sign(x1 - x0) || 1;
  const hops = over.filter((h) => (h - x0) * dir > 6 && (x1 - h) * dir > 6).sort((a, b) => (a - b) * dir);
  let d = `M${x0} ${y}`;
  for (const h of hops) d += `H${h - 5 * dir}A5 5 0 0 ${dir > 0 ? 1 : 0} ${h + 5 * dir} ${y}`;
  return `${d}H${x1}`;
}

/** A watcher: a box asking whether its pin is past its line ("2.10 < 3.13 V"), amber while it fires. */
function Watcher({ x, y, label, pinV, lineV, low, fires, live }: { x: number; y: number; label: string; pinV: number | undefined; lineV: number | undefined; low: boolean; fires: boolean; live: boolean }) {
  const rel = pinV === undefined || lineV === undefined ? (low ? "<" : ">") : pinV < lineV ? "<" : ">";
  return (
    <g className="xr-watch" data-fires={fires || undefined}>
      <rect x={x - 50} y={y - 22} width={100} height={44} rx={7} className="xr-box" />
      <text x={x} y={y - 4} className="xr-label" textAnchor="middle">
        {label}
      </text>
      <text x={x} y={y + 14} className="xr-small" textAnchor="middle">
        {live ? `${fmtV(pinV).replace(" V", "")} ${rel} ${fmtV(lineV)}` : low ? `< ${m.lab.chips.third}` : `> ${m.lab.chips.twoThirds}`}
      </text>
    </g>
  );
}

/** Where the 555's blocks sit (top band under pins 8 to 5, middle band, bottom band over pins 1 to 4). */
const L = {
  plusBar: 102,
  minusBar: 294,
  pivot: 100,
  contact: 132,
  term: 148,
  high: 126,
  latch: { x0: 150, x1: 272, y0: 178, y1: 218 },
  buffer: [236, 260] as const,
  low: 270,
  ladder: { x: 354, top: 92, bottom: 304 },
  tap2: 163,
  tap1: 233,
  resetX: 318,
  resetY: 300,
};

export type Chip555Props = {
  /** Pins named so far: only their blocks are drawn. Pin numbers always show; names only for named pins. */
  pins: readonly number[];
  /** The chip now (the x-ray), or null for the still map. */
  live?: Live555 | null;
  label?: string;
};

/** The inside of a 555, as far as the pins named so far go. */
export function Chip555Drawing({ pins, live = null, label = "555" }: Chip555Props) {
  const has = blocks555(pins);
  const x = pinX(8);
  const [c1, c2, c3, c4] = [x(0), x(1), x(2), x(3)];
  const named = latchNamed(pins);
  const v = (n: number) => live?.pins[n];
  const on = !!live?.latch;
  const lad = L.ladder;
  const latch = L.latch;
  const latchMid = (latch.y0 + latch.y1) / 2;
  const tag = (n: number): Tag => {
    const known = pins.includes(n);
    return { name: known ? m.lab.chips.pins555[n - 1] : undefined, value: known && live ? fmtV(v(n)) : undefined, dim: !known };
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="xr-svg" role="img" aria-hidden="true">
      <defs>
        <marker id="xr-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L8 4L0 8Z" className="xr-headfill" />
        </marker>
      </defs>
      <Outline count={8} label={label} tags={tag} />
      {has.has("rails") && (
        <g className="xr-rails">
          <path d={`M${c1} ${BODY.y0}V${L.plusBar}M${c1 - 26} ${L.plusBar}H${c1 + 26}`} className="xr-rail" />
          <text x={c1} y={L.plusBar + 20} className="xr-label" textAnchor="middle">
            {m.lab.chips.plusRail}
          </text>
          <path d={`M${c1} ${BODY.y1}V${L.minusBar}M${c1 - 26} ${L.minusBar}H${c1 + 26}`} className="xr-rail" />
          <text x={c1} y={L.minusBar - 10} className="xr-label" textAnchor="middle">
            {m.lab.chips.minusRail}
          </text>
        </g>
      )}
      {has.has("latch") && (
        <g className="xr-latch" data-on={on || undefined}>
          <rect x={latch.x0} y={latch.y0} width={latch.x1 - latch.x0} height={latch.y1 - latch.y0} rx={8} className="xr-box" />
          <circle cx={latch.x0 + 22} cy={latchMid} r={9} className="xr-lamp" />
          <text x={latch.x0 + 40} y={latchMid + 5} className="xr-label">
            {named ? m.lab.chips.latch : ""}
            {named && live ? ": " : ""}
            {live ? (on ? m.lab.chips.on : m.lab.chips.off) : ""}
          </text>
        </g>
      )}
      {has.has("drain") && (
        <g className="xr-drain" data-closed={!!live?.discharge || undefined}>
          <path d={`M${c2} ${BODY.y0}V${L.pivot}`} className="xr-wire" />
          <circle cx={c2} cy={L.pivot} r={2.6} className="xr-joint" />
          <path d={live?.discharge ? `M${c2} ${L.pivot}V${L.contact - 2}` : `M${c2} ${L.pivot}L${c2 + 14} ${L.contact - 6}`} className="xr-blade" />
          <circle cx={c2} cy={L.contact} r={2.6} className="xr-joint" />
          <circle cx={c2} cy={L.term} r={7} className="xr-term" />
          <path d={`M${c2} ${L.contact}V${L.term - 7}M${c2 - 3.5} ${L.term}H${c2 + 3.5}`} className="xr-wire" />
          <text x={c2 - 14} y={(L.pivot + L.contact) / 2 + 5} className="xr-label" textAnchor="end">
            {m.lab.chips.drain}
          </text>
          {has.has("latch") && <path d={`M${latch.x0 + 14} ${latch.y0}L${c2 + 7} ${(L.pivot + L.contact) / 2}`} className="xr-ctl" />}
        </g>
      )}
      {has.has("high") && (
        <g data-fires={!!live?.threshold || undefined} className="xr-flow">
          <path d={`M${c3} ${BODY.y0}V${L.high - 22}`} className="xr-wire" />
          <Watcher x={c3} y={L.high} label={m.lab.chips.high} pinV={v(6)} lineV={live?.upper} low={false} fires={!!live?.threshold} live={!!live} />
          {has.has("latch") && <path d={`M${c3} ${L.high + 22}V${latch.y0 - 2}`} className="xr-arrow" markerEnd="url(#xr-head)" />}
          {!has.has("ladder") && (
            <g>
              <path d={`M${c3 + 50} ${L.high}H${c3 + 68}`} className="xr-line" />
              <text x={c3 + 72} y={L.high + 4} className="xr-small">
                {m.lab.chips.twoThirds}
              </text>
            </g>
          )}
        </g>
      )}
      {has.has("low") && (
        <g data-fires={!!live?.trigger || undefined} className="xr-flow">
          <path d={`M${c2} ${BODY.y1}V${L.low + 22}`} className="xr-wire" />
          <Watcher x={c2} y={L.low} label={m.lab.chips.low} pinV={v(2)} lineV={live?.lower} low fires={!!live?.trigger} live={!!live} />
          {has.has("latch") && <path d={`M${c2} ${L.low - 22}V${latch.y1 + 2}`} className="xr-arrow" markerEnd="url(#xr-head)" />}
          {!has.has("ladder") && (
            <g>
              <path d={`M${c2 + 50} ${L.low}H${c2 + 66}`} className="xr-line" />
              <text x={c2 + 70} y={L.low + 4} className="xr-small">
                {m.lab.chips.third}
              </text>
            </g>
          )}
        </g>
      )}
      {has.has("output") && (
        <g className="xr-out" data-level={live?.output}>
          {has.has("latch") && <path d={`M${c3} ${latch.y1}V${L.buffer[0]}`} className="xr-wire" />}
          <path d={`M${c3 - 13} ${L.buffer[0]}H${c3 + 13}L${c3} ${L.buffer[1]}Z`} className="xr-buffer" />
          <path d={`M${c3} ${L.buffer[1]}V${BODY.y1}`} className="xr-wire" />
          <text x={c3 + 18} y={L.buffer[0] + 12} className="xr-label">
            {m.lab.chips.output}
          </text>
          {live && (
            <text x={c3 + 18} y={L.buffer[0] + 30} className="xr-small">
              {m.lab.chips.outLevel[live.output]}
            </text>
          )}
        </g>
      )}
      {has.has("reset") && (
        <g className="xr-reset" data-fires={!!live?.reset || undefined}>
          <path d={`M${c4} ${BODY.y1}V${L.resetY}H${L.resetX}V${latchMid}H${latch.x1 + 2}`} className="xr-wire xr-reset-line" markerEnd="url(#xr-head)" />
          <text x={L.resetX - 6} y={L.resetY - 4} className="xr-label" textAnchor="end">
            {m.lab.chips.reset}
          </text>
        </g>
      )}
      {has.has("ladder") && (
        <g className="xr-ladder">
          <circle cx={lad.x} cy={lad.top - 8} r={7} className="xr-term" />
          <path d={`M${lad.x - 3.5} ${lad.top - 8}H${lad.x + 3.5}M${lad.x} ${lad.top - 11.5}V${lad.top - 4.5}`} className="xr-wire" />
          <path d={zigzag(lad.x, lad.top - 1, L.tap2) + zigzag(lad.x, L.tap2, L.tap1) + zigzag(lad.x, L.tap1, lad.bottom)} className="xr-wire" />
          <circle cx={lad.x} cy={lad.bottom + 8} r={7} className="xr-term" />
          <path d={`M${lad.x - 3.5} ${lad.bottom + 8}H${lad.x + 3.5}`} className="xr-wire" />
          {/* The 2/3 tap is pin 5; the high watcher's line joins it. */}
          <path d={`M${c4} ${BODY.y0}V${L.tap2}H${lad.x}`} className="xr-wire" />
          <circle cx={lad.x} cy={L.tap2} r={2.6} className="xr-joint" />
          {has.has("high") && (
            <>
              <path d={`M${c3 + 50} ${L.high}H${c4}`} className="xr-wire" />
              <circle cx={c4} cy={L.high} r={2.6} className="xr-joint" />
            </>
          )}
          <text x={c4 - 6} y={L.tap2 - 6} className="xr-small" textAnchor="end">
            {m.lab.chips.twoThirds}
          </text>
          <circle cx={lad.x} cy={L.tap1} r={2.6} className="xr-joint" />
          {has.has("low") && (
            <path
              d={`${hopLine(lad.x, c2 + 62, L.tap1, [...(has.has("reset") ? [L.resetX] : []), ...(has.has("output") && has.has("latch") ? [c3] : [])])}V${L.low}H${c2 + 50}`}
              className="xr-wire"
            />
          )}
          <text x={lad.x - 10} y={L.tap1 + 17} className="xr-small" textAnchor="end">
            {m.lab.chips.third}
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * What a screen reader hears about the 555 now: one short sentence per block drawn. With `volts: false`, only what
 * changes in steps (watchers, latch, output, drain, reset), for a live region that speaks when something happens.
 */
export function say555(pins: readonly number[], live: Live555 | null, volts = true): string {
  const has = blocks555(pins);
  if (!live) return "";
  if (!live.powered) return m.lab.chips.asleep;
  const s = m.lab.chips.say;
  const out: string[] = [];
  if (!volts) {
    if (has.has("low") && live.trigger) out.push(s.lowFires);
    if (has.has("high") && live.threshold) out.push(s.highFires);
    if (has.has("latch")) out.push(s.latch(latchNamed(pins), live.latch));
    if (has.has("output")) out.push(s.outputIs(m.lab.chips.outLevel[live.output] ?? live.output));
    if (has.has("drain")) out.push(s.drain(live.discharge));
    if (has.has("reset") && live.reset) out.push(s.reset(true));
    return out.join(" ");
  }
  if (has.has("rails")) out.push(s.rails(fmtV(live.supply)));
  if (has.has("low")) out.push(s.low(fmtV(live.pins[2]), fmtV(live.lower), live.trigger));
  if (has.has("high")) out.push(s.high(fmtV(live.pins[6]), fmtV(live.upper), live.threshold));
  if (has.has("latch")) out.push(s.latch(latchNamed(pins), live.latch));
  if (has.has("output")) out.push(s.output(m.lab.chips.outLevel[live.output] ?? live.output, fmtV(live.pins[3])));
  if (has.has("drain")) out.push(s.drain(live.discharge));
  if (has.has("reset")) out.push(s.reset(live.reset));
  if (has.has("ladder")) out.push(s.ladder(fmtV(live.pins[5])));
  return out.join(" ");
}

/** The notebook's 555 map: the pins named so far, their blocks, and a stamp once all eight are named. */
export function Chip555Map({ pins }: { pins: readonly number[] }) {
  const done = mapComplete(pins);
  return (
    <figure className="xr-map" aria-label={m.lab.chips.mapLabel(new Set(pins).size)}>
      <Chip555Drawing pins={pins} />
      {done && (
        <span className="xr-stamp" aria-hidden="true">
          {m.lab.chips.mapDone}
        </span>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Gate chips

/** A gate's body path: AND, OR (and XOR), or a NOT triangle, pointing right, `w` by `h`, at its top left. */
function gateBody(kind: Gate["kind"], x: number, y: number, w: number, h: number): string {
  if (kind === "and" || kind === "nand") return `M${x} ${y}H${x + w / 2}A${w / 2} ${h / 2} 0 0 1 ${x + w / 2} ${y + h}H${x}Z`;
  if (kind === "not") return `M${x} ${y}L${x + w} ${y + h / 2}L${x} ${y + h}Z`;
  // OR, NOR, XOR: a curved back and a pointed front.
  return `M${x} ${y}Q${x + w * 0.55} ${y} ${x + w} ${y + h / 2}Q${x + w * 0.55} ${y + h} ${x} ${y + h}Q${x + w * 0.3} ${y + h / 2} ${x} ${y}Z`;
}

const inverted = (k: Gate["kind"]) => k === "nand" || k === "nor" || k === "not";

/** One gate drawn between its pins, inputs routed so no wires cross. */
function GateGlyph({ gate, count, levels, hidden }: { gate: Gate; count: number; levels: Record<number, Level | undefined>; hidden: boolean }) {
  const x = pinX(count);
  const pos = (n: number) => {
    const p = dipPosition(n, count);
    return { x: x(p.slot), top: p.side === "top" };
  };
  const ins = gate.inputs.map((n) => ({ n, ...pos(n) }));
  const out = { n: gate.output, ...pos(gate.output) };
  const allTop = [...ins, out].every((p) => p.top);
  const allBottom = [...ins, out].every((p) => !p.top);
  const cy = allTop ? BODY.y0 + 52 : allBottom ? BODY.y1 - 56 : (BODY.y0 + BODY.y1) / 2;
  const right = out.x > Math.max(...ins.map((p) => p.x)) - 1e-6 || out.x > ins.reduce((a, p) => a + p.x, 0) / ins.length;
  const bw = 32;
  const bh = 12 + 9 * ins.length;
  const nearest = right ? Math.max(...ins.map((p) => p.x)) : Math.min(...ins.map((p) => p.x));
  const bx = right ? Math.min(nearest + 9, out.x - bw - 10) : Math.max(nearest - 9 - bw, out.x + 10);
  const by = cy - bh / 2;
  // Stubs top to bottom: inputs from the top row take the upper stubs, from the bottom row the lower ones. Within a
  // row the input farthest from the output takes the stub farthest from its pins, so no two wires cross.
  const stubY = (k: number) => by + ((k + 1) * bh) / (ins.length + 1);
  const far = (a: (typeof ins)[number], b: (typeof ins)[number]) => (right ? a.x - b.x : b.x - a.x);
  const tops = ins.filter((p) => p.top).sort((a, b) => -far(a, b));
  const bottoms = ins.filter((p) => !p.top).sort(far);
  const ys = [...tops, ...bottoms].map((p, k) => ({ p, y: stubY(k) }));
  // A top input in the same column as a bottom one jogs aside, so the two never read as one wire.
  const jog = (p: (typeof ins)[number]) => (p.top && ins.some((q) => !q.top && Math.abs(q.x - p.x) < 1) ? (right ? 6 : -6) : 0);
  const faceX = right ? bx : bx + bw;
  const tipX = right ? bx + bw + (inverted(gate.kind) ? 7 : 0) : bx - (inverted(gate.kind) ? 7 : 0);
  const body = gateBody(gate.kind, 0, 0, bw, bh);
  const lv = (n: number) => levels[n];
  return (
    <g className="xr-gate" data-out={lv(out.n)}>
      {ys.map(({ p, y }) => {
        const j = jog(p);
        const d = j ? `M${p.x} ${BODY.y0}V${BODY.y0 + 14}H${p.x + j}V${y}H${faceX}` : `M${p.x} ${p.top ? BODY.y0 : BODY.y1}V${y}H${faceX}`;
        return <path key={p.n} d={d} className="xr-wire" data-level={lv(p.n)} />;
      })}
      <path d={`M${tipX} ${cy}H${out.x}V${out.top ? BODY.y0 : BODY.y1}`} className="xr-wire" data-level={lv(out.n)} />
      <g transform={right ? `translate(${bx} ${by})` : `translate(${bx + bw} ${by}) scale(-1 1)`}>
        <path d={body} className="xr-gatebody" />
        {gate.kind === "xor" && <path d={`M-5 0Q${bw * 0.3 - 5} ${bh / 2} -5 ${bh}`} className="xr-wire" />}
        {inverted(gate.kind) && <circle cx={bw + 3.5} cy={bh / 2} r={3.5} className="xr-bubble" />}
        {hidden && (
          <text x={bw * 0.38} y={bh / 2 + 5} className="xr-label" textAnchor="middle" transform={right ? undefined : `translate(${bw * 0.76} 0) scale(-1 1)`}>
            ?
          </text>
        )}
      </g>
      {!hidden && (
        <text x={bx + bw / 2} y={allTop ? by + bh + 14 : by - 6} className="xr-small" textAnchor="middle">
          {m.lab.chips.gates[gate.kind]}
        </text>
      )}
    </g>
  );
}

export type LogicDrawingProps = { info: ChipInfo; levels: Record<number, Level | undefined>; label?: string; hidden?: boolean };

/** A gate chip's pinout: its gates between their pins, each pin's level (amber when high). */
export function LogicChipDrawing({ info, levels, label, hidden = false }: LogicDrawingProps) {
  const count = info.pins.length;
  const gates = gatesOf(info);
  const x = pinX(count);
  const vcc = info.pins.indexOf(info.vcc) + 1;
  const gnd = info.pins.indexOf(info.gnd) + 1;
  const supply = (n: number, plus: boolean) => {
    const p = dipPosition(n, count);
    const px = x(p.slot);
    const y = p.side === "top" ? BODY.y0 : BODY.y1;
    const y2 = p.side === "top" ? y + 18 : y - 18;
    return (
      <g key={n}>
        <path d={`M${px} ${y}V${y2}`} className="xr-rail" />
        <text x={px} y={p.side === "top" ? y2 + 14 : y2 - 6} className="xr-label" textAnchor="middle">
          {plus ? "+" : "−"}
        </text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="xr-svg" role="img" aria-hidden="true">
      <Outline count={count} label={label ?? info.model} tags={(n) => ({ name: pinCode(info, n), level: levels[n] })} printRight />
      {supply(vcc, true)}
      {supply(gnd, false)}
      {gates.length ? (
        gates.map((g) => <GateGlyph key={g.n} gate={g} count={count} levels={levels} hidden={hidden} />)
      ) : (
        <text x={W / 2} y={(BODY.y0 + BODY.y1) / 2 + 5} className="xr-label" textAnchor="middle">
          {info.model}
        </text>
      )}
    </svg>
  );
}

/** What a screen reader hears about a gate chip: its supply pins, each gate, and the pins that are high. */
export function sayLogic(info: ChipInfo, levels: Record<number, Level | undefined>, hidden = false): string {
  const c = m.lab.chips;
  const out = [c.supplyPins(info.pins.indexOf(info.vcc) + 1, info.pins.indexOf(info.gnd) + 1)];
  for (const g of gatesOf(info)) out.push(c.gateSay(g.n, hidden ? "?" : c.gates[g.kind] ?? g.kind, g.inputs.join(", "), String(g.output)));
  const lv = Object.entries(levels).filter(([, l]) => l && l !== "Z");
  if (lv.length) out.push(lv.map(([n, l]) => c.pinLevel(Number(n), pinCode(info, Number(n)), c.levels[l!] ?? l!)).join(", ") + ".");
  return out.join(" ");
}

/** Each pin's level from a logic chip's snapshot `extra` (`H`, `L`, `X`, `Z`; an oscillating output reads `X`). */
export function logicLevels(info: ChipInfo, extra: Record<string, unknown> | undefined): Record<number, Level | undefined> {
  const out: Record<number, Level | undefined> = {};
  info.pins.forEach((name, i) => {
    const x = extra?.[name];
    if (typeof x === "string") out[i + 1] = x === "H" || x === "L" || x === "Z" ? x : "X";
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The panel

/** The chip x-ray beside the bench: closed, a button to look inside; open, the live drawing and its spoken summary. */
export function XrayPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "xray" }> }) {
  useStore(runtime.ui, (s) => s.panels);
  const snapshot = useStore(runtime.store, (s) => s.snapshot);
  const part = useStore(runtime.store, (s) => s.bench.parts.find((p) => p.id === cfg.part));
  const id = useId();
  const view = `xray:${cfg.part}`;
  const open = runtime.session.views.has(view);
  // Closing the panel (the beat moves on) closes the x-ray.
  useEffect(() => () => runtime.setView(view, false), [runtime, view]);
  const netlist = runtime.session.net.netlist;
  const info = useMemo(() => partChip(part) ?? specChip(netlist.parts.find((p) => p.id === cfg.part)) ?? chipInfo("555"), [part, netlist, cfg.part]);
  const extra = snapshot?.parts[cfg.part]?.extra;
  const pins = cfg.pins ?? [1, 2, 3, 4, 5, 6, 7, 8];
  const live = info?.sim === "timer555" ? live555(netlist, snapshot?.nodes, extra, cfg.part) : null;
  const levels = info && info.sim === "logic" ? logicLevels(info, extra) : {};
  const name = runtime.built.labels[cfg.part] ?? cfg.part;
  // The drawing's label carries the volts; the live region speaks only when a block changes state.
  const summary = !open || !info ? "" : info.sim === "timer555" ? say555(pins, live) : sayLogic(info, levels);
  const changes = open && info?.sim === "timer555" ? say555(pins, live, false) : "";
  return (
    <section className="instrument panel chip-panel xr" aria-labelledby={`${id}-t`} data-panel={cfg.id} data-open={open || undefined}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.chips.xrayTitle(name)}
        </h3>
        {open && (
          <button type="button" className="btn btn--small btn--tertiary" onClick={() => runtime.setView(view, false)}>
            {m.lab.chips.close}
          </button>
        )}
      </header>
      {!open ? (
        <div className="xr__closed">
          <button type="button" className="btn btn--small btn--primary" onClick={() => runtime.setView(view, true)} data-xray-open>
            {m.lab.chips.look}
          </button>
          <span className="small muted">{m.lab.chips.closedHelp}</span>
        </div>
      ) : info?.sim === "timer555" ? (
        <div className="xr__sheet" data-xray={cfg.part} role="img" aria-label={summary}>
          <Chip555Drawing pins={pins} live={live} label={info.model === "555-cmos" ? "555 C" : "555"} />
          {live && !live.powered && <p className="small muted xr__asleep">{m.lab.chips.asleep}</p>}
        </div>
      ) : info ? (
        <div className="xr__sheet" data-xray={cfg.part} role="img" aria-label={summary}>
          <LogicChipDrawing info={info} levels={levels} />
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {changes}
      </p>
    </section>
  );
}
