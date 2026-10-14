// Start here props, top down: the counting gate, sealed boxes and the parts cabinet, the schematic card and its torn
// piece, and the static toy (a balloon, a wool scarf, paper bits, a comb, a strip of wall).

import { useContext } from "react";
import { useStore } from "zustand";
import { BOX, CABINET, GATE, PADLOCK, SCHEM, STATIC } from "../../dims";
import { formatGate, gateAmps, tagText, unitRate } from "../../flow";
import { lifting } from "../../static";
import { useLabels } from "../../labels";
import { padlockFaces, schematicSlot } from "../../parts";
import { BenchStoreContext, type BenchStore, type BenchStoreState } from "../../store";
import { slotTurn, symbolInk, tornOutline } from "../../symbols";
import type { PartParamsMap, SymbolKind } from "../../types";
import { Upright, localLegs, n3, rrect } from "./common";
import type { DrawProps, InkRegistry } from "./types";

// Symbols ----------------------------------------------------------------------------------------------------------

/** A circuit symbol in ink, centred on (x, z), turned `turn` degrees, `scale` times its 24 mm frame. */
export function InkSymbol({ kind, x = 0, z = 0, turn = 0, scale = 1, text }: { kind: SymbolKind; x?: number; z?: number; turn?: number; scale?: number; text?: string }) {
  const s = symbolInk(kind);
  const tr = `translate(${n3(x)} ${n3(z)}) rotate(${n3(turn)}) scale(${n3(scale)})`;
  return (
    <g>
      <g transform={tr}>
        {s.fill && <path d={s.fill} className="f-ink" />}
        <path d={s.stroke} className="ln" />
        {s.thin && <path d={s.thin} className="ln-thin" />}
      </g>
      {text && (
        <Upright x={x + (Math.abs(Math.sin((turn * Math.PI) / 180)) > 0.5 ? 9 * scale : 0)} z={z + (Math.abs(Math.sin((turn * Math.PI) / 180)) > 0.5 ? 0 : -8 * scale)} rot={0} fontSize={3.6 * scale} fontWeight={600} textAnchor={Math.abs(Math.sin((turn * Math.PI) / 180)) > 0.5 ? "start" : "middle"} dominantBaseline="central" className="f-ink">
          {text}
        </Upright>
      )}
    </g>
  );
}

// Gate -------------------------------------------------------------------------------------------------------------

/** The gate's counter: ticks (with a rate bar) or the current, read live from the store when there is one. */
function GateFlag({ id, params, store }: { id: string; params: PartParamsMap["gate"]; store: BenchStore | null }) {
  // Whole ticks only, so the flag redraws as each dot goes by and not 30 times a second.
  const ticks = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => Math.floor(s.gates?.[id] ?? 0));
  const amps = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => (s.bench ? Math.round(Math.abs(gateAmps(s.bench, s.snapshot ?? null, id)) * 1e6) / 1e6 : 0));
  // The rate bar counts the units the flow is drawn in (dots, stripes, dashes, bands, arrowheads).
  const style = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => s.overlay?.flowStyle ?? "dots");
  const W = GATE.flagW;
  const H = GATE.flagH;
  const z0 = -GATE.lift - H / 2;
  const number = params.mode === "number";
  const unit = params.unit === "mA" ? "mA" : "A";
  // The rate bar: dots per second, full at 4 a second.
  const rate = Math.min(1, unitRate(amps, style) / 4);
  const reading = formatGate(amps, unit);
  const value = reading.slice(0, reading.lastIndexOf(" "));
  return (
    <g>
      <path d={`M0 ${-GATE.ring / 2 - 0.4}V${n3(z0 + H)}`} className="ln-thin" />
      <rect x={-W / 2 + 0.6} y={z0 + 0.8} width={W} height={H} rx={1} className="f-shade" />
      <rect x={-W / 2} y={z0} width={W} height={H} rx={1} className="f-slip" />
      <rect x={-W / 2} y={z0} width={W} height={H} rx={1} className="ln" />
      {number ? (
        <>
          <text x={-W / 2 + 2} y={z0 + H / 2 + 0.3} fontSize={5} fontWeight={700} dominantBaseline="central" className="f-ink">
            {value}
          </text>
          <rect x={W / 2 - 10} y={z0 + 2.4} width={8.4} height={H - 4.8} rx={1.2} className="f-blue-wash" />
          <rect x={W / 2 - 10} y={z0 + 2.4} width={8.4} height={H - 4.8} rx={1.2} className="ln-thin" />
          <text x={W / 2 - 5.8} y={z0 + H / 2 + 0.3} fontSize={4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="t-blue">
            {unit}
          </text>
        </>
      ) : (
        <>
          <text x={-W / 2 + 2.2} y={z0 + H * 0.42} fontSize={6} fontWeight={700} dominantBaseline="central" className="f-ink">
            {String(ticks)}
          </text>
          <circle cx={n3(W / 2 - 4.6)} cy={n3(z0 + H * 0.42)} r={1.6} className="f-slip ln" />
          <rect x={-W / 2 + 2.2} y={z0 + H - 3.2} width={W - 4.4} height={1.6} rx={0.6} className="f-sunk" />
          {rate > 0 && <rect x={-W / 2 + 2.2} y={z0 + H - 3.2} width={n3((W - 4.4) * rate)} height={1.6} rx={0.6} className="f-ink2" />}
        </>
      )}
    </g>
  );
}

/** A store-shaped stand-in for drawings rendered outside a bench (the tray, tests). */
const NULL_STORE = { getState: () => ({}), subscribe: () => () => {}, getInitialState: () => ({}), setState: () => {} } as unknown as BenchStore;

function Gate({ pi }: DrawProps<"gate">) {
  const store = useContext(BenchStoreContext);
  const on = pi.along !== undefined;
  const turn = pi.along ?? 0;
  const R = GATE.ring / 2;
  const L = GATE.len / 2;
  return (
    <g>
      {/* The collar round the cable (or lying on the desk). */}
      <g transform={`rotate(${n3(turn)})`}>
        <rect x={-L + 0.5} y={-R + 0.8} width={GATE.len} height={GATE.ring} rx={1.2} className="f-shade" opacity={on ? 0 : 1} />
        <rect x={-L} y={-R} width={GATE.len} height={GATE.ring} rx={1.2} className="f-slip" />
        <path d={`M${-L + 2} ${-R}V${R}M${L - 2} ${-R}V${R}`} className="ln-thin" />
        <rect x={-L} y={-R} width={GATE.len} height={GATE.ring} rx={1.2} className="ln" />
      </g>
      <GateFlag id={pi.part.id} params={pi.part.params} store={store} />
    </g>
  );
}

// Sealed box and cabinet -------------------------------------------------------------------------------------------

function boxDims(p: PartParamsMap["box"]) {
  const cab = p.style === "cabinet";
  return { W: cab ? CABINET.w : BOX.w, D: cab ? CABINET.d : BOX.d, strip: cab ? CABINET.strip : BOX.strip, cab };
}

/** A screw post on the box's front strip, with its mark beside it. */
function Post({ at, mark }: { at: [number, number]; mark: "+" | "−" | null }) {
  return (
    <g>
      <circle cx={n3(at[0])} cy={n3(at[1])} r={3.4} className="f-brass ln" />
      <circle cx={n3(at[0])} cy={n3(at[1])} r={2.2} className="f-metal-hi ln-thin" />
      <path d={`M${n3(at[0] - 1.6)} ${n3(at[1] + 0.9)}L${n3(at[0] + 1.6)} ${n3(at[1] - 0.9)}`} className="ln-thin" />
      {mark && (
        <text x={n3(at[0] + (mark === "+" ? -6.4 : 6.4))} y={n3(at[1] + 0.2)} fontSize={6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className={mark === "+" ? "t-red" : "f-ink"}>
          {mark}
        </text>
      )}
    </g>
  );
}

function Box({ pi }: DrawProps<"box">) {
  const labels = useLabels();
  const p = pi.part.params;
  const { W, D, strip, cab } = boxDims(p);
  const L = localLegs(pi);
  const open = !!p.lid;
  const rot = pi.f.rot;
  const zs = D / 2 - strip;
  const lidD = D - strip;
  const lock = !open && cab && p.lock ? p.lock : null;
  return (
    <g>
      <rect x={-W / 2 + 1.4} y={-D / 2 + 2} width={W} height={D} rx={2.4} className="f-shade" />
      {open && (
        // The lid, swung up and back: its underside, foreshortened, behind the box.
        <g>
          <path d={`M${-W / 2} ${-D / 2}L${-W / 2 + 4} ${n3(-D / 2 - lidD * 0.32)}H${W / 2 - 4}L${W / 2} ${-D / 2}Z`} className="f-cardboard-dark" />
          <path d={`M${-W / 2} ${-D / 2}L${-W / 2 + 4} ${n3(-D / 2 - lidD * 0.32)}H${W / 2 - 4}L${W / 2} ${-D / 2}Z`} className="ln" />
        </g>
      )}
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={2.4} className="f-cardboard" />
      {open ? (
        <>
          {/* Inside: the floor and the walls' top edges. */}
          <rect x={-W / 2 + 2.6} y={-D / 2 + 2.6} width={W - 5.2} height={lidD - 2.6} rx={1.2} className="f-sunk" />
          <rect x={-W / 2 + 2.6} y={-D / 2 + 2.6} width={W - 5.2} height={lidD - 2.6} rx={1.2} className="ln-thin" />
        </>
      ) : (
        <>
          <rect x={-W / 2 + 1.6} y={-D / 2 + 1.6} width={W - 3.2} height={lidD - 1.6} rx={1.6} className="f-cardboard" />
          <path d={`M${-W / 2 + 6} ${-D / 2 + 3.6}H${W / 2 - 6}`} className="ln-soft" />
          <path d={`M-7 ${n3(zs - 1.2)}q7 -3 14 0`} className="ln-thin" />
          {(p.label || cab) && (
            <Upright x={0} z={(-D / 2 + zs) / 2} rot={rot} fontSize={cab ? 9 : 18} fontWeight={700} letterSpacing={cab ? 1.4 : 0} textAnchor="middle" dominantBaseline="central" className="f-ink">
              {p.label ?? labels.print.cabinet}
            </Upright>
          )}
        </>
      )}
      {/* The front strip, where the terminals (and the knob, or the padlock) are. */}
      <rect x={-W / 2} y={n3(zs)} width={W} height={strip} rx={1.4} className="f-cardboard-dark" />
      <path d={`M${-W / 2} ${n3(zs)}H${W / 2}`} className="ln" />
      <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={2.4} className="ln" />
      {!cab && L.t1 && <Post at={L.t1} mark={p.marks === "plain" ? null : "+"} />}
      {!cab && L.t2 && <Post at={L.t2} mark={p.marks === "plain" ? null : "−"} />}
      {p.knob && <BoxKnob z={zs + strip / 2} pi={pi} />}
      {lock && <Padlock z={zs + strip / 2} shown={padlockFaces(p)} />}
      {p.tag && <BoxTag x={W / 2 + 8} z={D / 2 - 6} text={tagText(p.tag, p.tagAlt)} rot={rot} />}
    </g>
  );
}

function BoxKnob({ z, pi }: { z: number; pi: DrawProps<"box">["pi"] }) {
  const store = useContext(BenchStoreContext);
  const position = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => {
    for (const id of Object.values(pi.part.params.held ?? {})) {
      const t = s.bench?.parts.find((x) => x.id === id);
      if (t?.kind === "trimmer") return t.params.position;
    }
    return 0.5;
  });
  const a = (position - 0.5) * 270;
  const R = BOX.knob;
  return (
    <g>
      {[-135, -67.5, 0, 67.5, 135].map((t) => (
        <path key={t} d={`M0 ${-R - 1.4}v-1.6`} transform={`translate(0 ${n3(z)}) rotate(${t})`} className="ln-thin" />
      ))}
      <circle cx={0.5} cy={n3(z + 0.7)} r={R} className="f-shade" />
      <circle cx={0} cy={n3(z)} r={R} className="f-knob" />
      <circle cx={0} cy={n3(z)} r={R - 1.6} className="ln-soft s-slip" />
      <path d={`M0 ${n3(z)}V${n3(z - R + 1.2)}`} transform={`rotate(${n3(a)} 0 ${n3(z)})`} className="s-slip" strokeWidth={1.1} strokeLinecap="round" />
      <circle cx={0} cy={n3(z)} r={R} className="ln" />
    </g>
  );
}

/** The padlock on the cabinet's front strip: each wheel shows its face (or its answer once set), "?" before. */
function Padlock({ z, shown }: { z: number; shown: (string | null)[] }) {
  const n = shown.length;
  const w = PADLOCK.wheel;
  const h = 12;
  return (
    <g>
      <path d={`M-12 ${n3(z - h / 2)}v-7a12 9 0 0 1 24 0v7`} className="ln" strokeWidth={2.4} />
      <rect x={n3((-n * w) / 2 - 3.5)} y={n3(z - h / 2 - 2)} width={n * w + 7} height={h + 4} rx={2.4} className="f-brass" />
      <rect x={n3((-n * w) / 2 - 3.5)} y={n3(z - h / 2 - 2)} width={n * w + 7} height={h + 4} rx={2.4} className="ln" />
      {shown.map((label, i) => {
        const x = (i - (n - 1) / 2) * w;
        const set = label !== null;
        return (
          <g key={i}>
            <rect x={n3(x - w / 2 + 1)} y={n3(z - h / 2)} width={w - 2} height={h} rx={1.2} className={set ? "f-slip" : "f-sunk"} />
            <path d={`M${n3(x - w / 2 + 1)} ${n3(z - h / 2 + 2)}h${w - 2}M${n3(x - w / 2 + 1)} ${n3(z + h / 2 - 2)}h${w - 2}`} className="ln-soft" />
            <rect x={n3(x - w / 2 + 1)} y={n3(z - h / 2)} width={w - 2} height={h} rx={1.2} className="ln-thin" />
            <text x={n3(x)} y={n3(z + 0.3)} fontSize={set ? 3.6 : 6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className={set ? "f-ink" : "print"}>
              {label ?? "?"}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function BoxTag({ x, z, text, rot }: { x: number; z: number; text: string; rot: number }) {
  const w = Math.max(20, text.length * 2.9 + 6);
  return (
    <g>
      <path d={`M${n3(x - 10)} ${n3(z - 3)}c2 -3 5 -4 ${n3(w / 2 - 6)} -1`} className="ln-thin" />
      <rect x={n3(x - w / 2 + 0.6)} y={n3(z - 5.4)} width={n3(w)} height={11} rx={1.2} className="f-shade" />
      <rect x={n3(x - w / 2)} y={n3(z - 6)} width={n3(w)} height={11} rx={1.2} className="f-slip" />
      <rect x={n3(x - w / 2)} y={n3(z - 6)} width={n3(w)} height={11} rx={1.2} className="ln" />
      <Upright x={x} z={z - 0.5} rot={rot} fontSize={4.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-ink">
        {text}
      </Upright>
    </g>
  );
}

// Schematic card and its torn piece --------------------------------------------------------------------------------

/** A torn edge: a ragged square outline of side `s` centred on (x, z). */
function torn(x: number, z: number, s: number): string {
  return `${tornOutline(x, z, s)
    .map(([px, pz], i) => `${i ? "L" : "M"}${n3(px)} ${n3(pz)}`)
    .join("")}Z`;
}

function Schematic({ pi }: DrawProps<"schematic">) {
  const p = pi.part.params;
  const n = p.symbols.length;
  const W = SCHEM.loopW / 2;
  const D = SCHEM.loopD / 2;
  const z0 = 4;
  const rot = pi.f.rot;
  const tornAt = p.torn !== undefined ? schematicSlot(n, p.torn) : null;
  const P = SCHEM.piece / 2;
  // The loop's corners, then each side broken where a symbol sits (the symbol's own leads close the gap).
  const sides: string[] = [];
  const corners: [number, number][] = [
    [-W, z0 - D],
    [W, z0 - D],
    [W, z0 + D],
    [-W, z0 + D],
  ];
  const segs: [[number, number], [number, number]][] = corners.map((c, i) => [c, corners[(i + 1) % 4]!]);
  const slots = p.symbols.map((_, i) => schematicSlot(n, i));
  for (const [a, b] of segs) {
    // Cut out each symbol's 24 mm on this side.
    const cuts = slots
      .filter(([x, z]) => (a[0] === b[0] ? Math.abs(x - a[0]) < 0.01 && z > Math.min(a[1], b[1]) && z < Math.max(a[1], b[1]) : Math.abs(z - a[1]) < 0.01 && x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0])))
      .map(([x, z]) => (a[0] === b[0] ? z : x));
    const along = a[0] === b[0] ? 1 : 0;
    const from = a[along]!;
    const to = b[along]!;
    const dir = Math.sign(to - from);
    let cur = from;
    const sorted = cuts.sort((u, v) => (u - v) * dir);
    for (const c of sorted) {
      const stop = c - dir * 12;
      sides.push(along ? `M${a[0]} ${n3(cur)}V${n3(stop)}` : `M${n3(cur)} ${a[1]}H${n3(stop)}`);
      cur = c + dir * 12;
    }
    sides.push(along ? `M${a[0]} ${n3(cur)}V${n3(to)}` : `M${n3(cur)} ${a[1]}H${n3(to)}`);
  }
  return (
    <g>
      <rect x={-SCHEM.w / 2 + 1} y={-SCHEM.d / 2 + 1.4} width={SCHEM.w} height={SCHEM.d} rx={1.6} className="f-shade" />
      <rect x={-SCHEM.w / 2} y={-SCHEM.d / 2} width={SCHEM.w} height={SCHEM.d} rx={1.6} className="f-slip" />
      <rect x={-SCHEM.w / 2} y={-SCHEM.d / 2} width={SCHEM.w} height={SCHEM.d} rx={1.6} className="ln" />
      {p.title && (
        <Upright x={-SCHEM.w / 2 + 5} z={-SCHEM.d / 2 + 5.4} rot={rot} fontSize={3.4} fontWeight={600} dominantBaseline="central" className="print">
          {p.title}
        </Upright>
      )}
      <path d={sides.join("")} className="ln" />
      {p.symbols.map((sym, i) =>
        i === p.torn ? null : <InkSymbol key={i} kind={sym.kind} x={slots[i]![0]} z={slots[i]![1]} turn={slotTurn(n, i)} text={sym.text} />,
      )}
      {tornAt && (
        <g>
          <path d={torn(tornAt[0], tornAt[1], SCHEM.piece)} className="f-sunk" />
          <path d={torn(tornAt[0], tornAt[1], SCHEM.piece)} className="ln-faint" strokeDasharray="1.4 1.2" />
          <path d={`M${n3(tornAt[0] - P - 2)} ${n3(tornAt[1])}h1.6M${n3(tornAt[0] + P + 0.4)} ${n3(tornAt[1])}h1.6`} className="ln-faint" />
        </g>
      )}
    </g>
  );
}

function Piece({ pi }: DrawProps<"piece">) {
  const p = pi.part.params;
  const s = SCHEM.piece;
  return (
    <g>
      {!pi.pose.heldBy && <path d={torn(0.7, 1, s)} className="f-shade" />}
      <path d={torn(0, 0, s)} className="f-slip" />
      <InkSymbol kind={p.symbol} turn={p.turn ?? 0} />
      <path d={torn(0, 0, s)} className="ln" />
    </g>
  );
}

// Static toy -------------------------------------------------------------------------------------------------------

/** Charge marks: minus signs (or plus signs for a positive charge) scattered over a patch, one per mark. */
export function ChargeMarks({ q, spots }: { q: number; spots: [number, number][] }) {
  const n = Math.min(spots.length, Math.round(Math.abs(q)));
  if (!n) return null;
  const plus = q > 0;
  const d = spots
    .slice(0, n)
    .map(([x, z]) => `M${n3(x - 1.6)} ${n3(z)}h3.2${plus ? `M${n3(x)} ${n3(z - 1.6)}v3.2` : ""}`)
    .join("");
  return (
    <g>
      <path d={d} className="s-slip" strokeWidth={1.4} strokeLinecap="round" />
      <path d={d} className="s-ink" strokeWidth={0.6} strokeLinecap="round" />
    </g>
  );
}

const BALLOON_MARKS: [number, number][] = [
  [-6, -6],
  [5, -8],
  [-1, -1],
  [8, 1],
  [-8, 4],
  [2, 6],
  [-3, 11],
  [7, 10],
];

function Balloon({ pi }: DrawProps<"balloon">) {
  const R = STATIC.balloon / 2;
  const c = pi.part.params.color ?? "red";
  return (
    <g>
      <ellipse cx={1.4} cy={2} rx={R} ry={R * 1.15} className="f-shade" />
      <path d={`M0 ${n3(R * 1.15)}c-3 5 3 8 -1 13`} className="ln-thin" />
      <path d={`M-1.6 ${n3(R * 1.15 + 0.4)}h3.2l-1.6 -2z`} className={`f-balloon-${c}`} />
      <ellipse cx={0} cy={0} rx={R} ry={R * 1.15} className={`f-balloon-${c}`} />
      <path d={`M${n3(-R * 0.55)} ${n3(-R * 0.5)}a${n3(R * 0.7)} ${n3(R * 0.8)} 0 0 1 ${n3(R * 0.5)} ${n3(-R * 0.35)}`} className="sheen" />
      <ellipse cx={0} cy={0} rx={R} ry={R * 1.15} className="ln" />
      <ChargeMarks q={pi.part.params.charge ?? 0} spots={BALLOON_MARKS} />
    </g>
  );
}

const SCARF_MARKS: [number, number][] = [
  [-40, -2],
  [-28, 6],
  [-14, -4],
  [0, 4],
  [14, -3],
  [28, 5],
  [40, -2],
  [-34, 2],
];

function Scarf({ pi }: DrawProps<"scarf">) {
  const W = STATIC.scarfW / 2;
  const D = STATIC.scarfD / 2;
  const fringe: string[] = [];
  for (let x = -W + 3; x <= W - 3; x += 4) fringe.push(`M${x} ${D}v4`);
  return (
    <g>
      <rect x={-W + 1} y={-D + 1.4} width={STATIC.scarfW} height={STATIC.scarfD} rx={3} className="f-shade" />
      <rect x={-W} y={-D} width={STATIC.scarfW} height={STATIC.scarfD} rx={3} className="f-wool" />
      <path d={`M${-W} ${-D + 9}H${W}M${-W} ${D - 9}H${W}`} className="ln-soft s-slip" strokeWidth={2} />
      <path d={fringe.join("")} className="ln-thin" />
      <rect x={-W} y={-D} width={STATIC.scarfW} height={STATIC.scarfD} rx={3} className="ln" />
      <ChargeMarks q={pi.part.params.charge ?? 0} spots={SCARF_MARKS} />
    </g>
  );
}

const BITS: [number, number, number][] = [
  [-9, -6, 20],
  [3, -9, -15],
  [10, 1, 40],
  [-4, 5, -30],
  [-12, 6, 10],
  [6, 9, 70],
  [0, -1, 5],
];

function Paper({ pi }: DrawProps<"paper">) {
  // Charge nearby pulls the bits up: drawn hopping toward what pulls them, with a little lift line each.
  const store = useContext(BenchStoreContext);
  const pull = useStore(store ?? NULL_STORE, (s: Partial<BenchStoreState>) => {
    const id = s.bench ? lifting(s.bench, pi.part.id) : null;
    const p = id ? s.bench!.parts.find((x) => x.id === id) : null;
    return p ? `${n3(p.pos[0] - pi.f.ox)},${n3(p.pos[1] - pi.f.oz)}` : "";
  });
  const [px, pz] = pull ? pull.split(",").map(Number) : [0, 0];
  const k = pull ? 0.55 : 0;
  return (
    <g>
      {BITS.map(([x0, z0, r], i) => {
        const x = x0 + (px! - x0) * k * (0.7 + (i % 3) * 0.15);
        const z = z0 + (pz! - z0) * k * (0.7 + (i % 3) * 0.15);
        return (
          <g key={i}>
            {pull && <path d={`M${n3(x0)} ${n3(z0)}L${n3(x0 + (x - x0) * 0.6)} ${n3(z0 + (z - z0) * 0.6)}`} className="ln-faint" strokeDasharray="0.8 0.8" />}
            <g transform={`translate(${n3(x)} ${n3(z)}) rotate(${r})`}>
              <path d="M-2.6 -1.8L2.4 -2.2L2.8 1.6L-2.2 2.2Z" className="f-slip" />
              <path d="M-2.6 -1.8L2.4 -2.2L2.8 1.6L-2.2 2.2Z" className="ln-thin" />
            </g>
          </g>
        );
      })}
    </g>
  );
}

function Comb({ pi }: DrawProps<"comb">) {
  const W = STATIC.combW / 2;
  const teeth: string[] = [];
  for (let x = -W + 2; x <= W - 2; x += 2.2) teeth.push(`M${n3(x)} -1V${STATIC.combD / 2}`);
  return (
    <g>
      <rect x={-W} y={-STATIC.combD / 2} width={STATIC.combW} height={4.4} rx={1.4} className="f-black" />
      <path d={teeth.join("")} className="ln" />
      <rect x={-W} y={-STATIC.combD / 2} width={STATIC.combW} height={4.4} rx={1.4} className="ln" />
      <ChargeMarks q={pi.part.params.charge ?? 0} spots={[-28, -20, -12, -4, 4, 12, 20, 28].map((x) => [x, -STATIC.combD / 2 - 3] as [number, number])} />
    </g>
  );
}

function Wall() {
  const W = STATIC.wallW / 2;
  const D = STATIC.wallD / 2;
  return (
    <g>
      <rect x={-W} y={-D} width={STATIC.wallW} height={STATIC.wallD} className="f-wall" />
      <path d={`M${-W} ${-D + 3}H${W}M${-W} ${D - 3}H${W}`} className="ln-thin s-wall" />
      <rect x={-W} y={-D} width={STATIC.wallW} height={STATIC.wallD} className="ln" />
    </g>
  );
}

export const START: InkRegistry = {
  gate: { box: () => [-GATE.flagW / 2, -GATE.lift - GATE.flagH / 2, GATE.flagW / 2, GATE.ring / 2], Draw: Gate },
  box: {
    box: (p) => {
      const { W, D } = boxDims(p.params);
      return [-W / 2, p.params.lid ? -D / 2 - (D - BOX.strip) * 0.32 : -D / 2, W / 2 + (p.params.tag ? 22 : 0), D / 2];
    },
    actuator: (p) => (p.params.knob ? { type: "rotor", x: 0, z: BOX.d / 2 - BOX.strip / 2, r: BOX.knob + 1 } : null),
    Draw: Box,
    layer: 0,
  },
  schematic: { box: () => [-SCHEM.w / 2, -SCHEM.d / 2, SCHEM.w / 2, SCHEM.d / 2], Draw: Schematic, layer: 0 },
  piece: { box: () => [-SCHEM.piece / 2, -SCHEM.piece / 2, SCHEM.piece / 2, SCHEM.piece / 2], Draw: Piece },
  balloon: { box: () => [-STATIC.balloon / 2, -STATIC.balloon * 0.58, STATIC.balloon / 2, STATIC.balloon * 0.58 + 13], Draw: Balloon },
  scarf: { box: () => [-STATIC.scarfW / 2, -STATIC.scarfD / 2, STATIC.scarfW / 2, STATIC.scarfD / 2 + 4], Draw: Scarf, layer: 0 },
  paper: { box: () => [-STATIC.paper / 2, -STATIC.paper / 2, STATIC.paper / 2, STATIC.paper / 2], Draw: Paper, layer: 0 },
  comb: { box: () => [-STATIC.combW / 2, -STATIC.combD / 2, STATIC.combW / 2, STATIC.combD / 2], Draw: Comb },
  wall: { box: () => [-STATIC.wallW / 2, -STATIC.wallD / 2, STATIC.wallW / 2, STATIC.wallD / 2], Draw: Wall, layer: 0 },
};

export { rrect };
