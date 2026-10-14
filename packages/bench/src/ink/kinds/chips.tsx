// Unit 4 parts in ink: DIP chips (notch, pin-1 dot, printed number or a taped label, warmth and burns), the surface
// mount lookalike lying askew on top of the board, IC sockets, the 7-segment display (bare or on its carrier board),
// the 7805 standing in the board or lying on its back, the DIP switch, the logic probe with its lamps, AA battery
// packs and the bench supply. Pin numbers (and the display's segment letters) show up close or in a spotlight
// (class `pinno`).

import type { ReactNode } from "react";
import type { PartState } from "@ohmland/sim";
import { PITCH as P } from "../../board";
import {
  CARRIER,
  CHIP_PRINT,
  DIP,
  DIPSW,
  DISPLAY,
  PACK,
  PROBE,
  PROBE_PROFILE,
  SEGMENTS,
  SEGMENT_SHAPES,
  SEVENSEG_LEGS,
  SOCKET,
  SOIC,
  SUPPLY,
  TO220,
  chipPinCount,
  dipFootprint,
  soicFeet,
  supplyVolts,
  type Segment,
} from "../../chips";
import { useLabels } from "../../labels";
import type { DipKey, PlacedPartOf, Vec2 } from "../../types";
import { LED_TOKEN } from "../styles";
import { HoleDot, Lead, Scorch, Upright, health, localLegs, n3, rrect } from "./common";
import type { DrawProps, InkRegistry, ShapeCtx } from "./types";

/** Warmth 0..1 from a part's temperature: nothing below 45 degrees, full above 125. */
function warmth(st: PartState | null): number {
  if (!st || st.health === "dead") return 0;
  return Math.max(0, Math.min(1, ((st.temp ?? 25) - 45) / 80));
}

/**
 * Wavy heat lines rising off a warm body (graphite, more of them as it heats), up the page whatever the part's turn.
 * The body is `len` by `w` in its frame, centred on (cx, cz). Smoke takes over once it smokes.
 */
function HeatLines({ cx, cz, len, w, rot, heat, st }: { cx: number; cz: number; len: number; w: number; rot: number; heat: number; st: PartState | null }) {
  if (heat < 0.12 || st?.health === "smoking" || st?.health === "dead") return null;
  const n = heat > 0.66 ? 3 : heat > 0.33 ? 2 : 1;
  const across = Math.abs(Math.round(rot / 90)) % 2 === 1;
  const hw = (across ? w : len) / 2;
  const top = cz - (across ? len : w) / 2;
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = cx - hw + (2 * hw * (i + 1)) / (n + 1);
    out.push(<path key={i} d={`M${n3(x)} ${n3(top - 0.6)}c-0.9 -0.8 0.9 -1.6 0 -2.4s0.9 -1.6 0 -2.4`} className="ln-faint" />);
  }
  return (
    <g opacity={0.5 + heat * 0.5} transform={rot ? `rotate(${n3(rot)} ${n3(cx)} ${n3(cz)})` : undefined}>
      {out}
    </g>
  );
}

/** A warm tint over a body (a hot chip or regulator). */
function Warm({ d, heat }: { d: string; heat: number }) {
  if (heat < 0.05) return null;
  return <path d={d} className="f-warm" opacity={Math.min(0.6, heat * 0.65)} />;
}

/** Small print of a pin's number or name: only up close or in a spotlight. */
function PinNo({ x, z, rot, children, size = 0.95 }: { x: number; z: number; rot: number; children: ReactNode; size?: number }) {
  return (
    <Upright x={x} z={z} rot={rot} fontSize={size} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="pinno">
      {children}
    </Upright>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// DIP chips.

/** Where a DIP chip's drawing starts: pin 1 on the board or in a socket, the body's centre on the desk. */
function dipOrigin(n: number, c: { mount: string; held: boolean }): Vec2 {
  if (c.mount === "board" || c.held) return [0, 0];
  return [-((n / 2 - 1) / 2) * P, 1.5 * P];
}

function dipBox(n: number, len: number, c: ShapeCtx): [number, number, number, number] {
  const [ox, oz] = dipOrigin(n, c);
  const cx = ox + ((n / 2 - 1) / 2) * P;
  const cz = oz - 1.5 * P;
  return [cx - len / 2 - 0.4, cz - 1.5 * P - 0.7, cx + len / 2 + 0.4, cz + 1.5 * P + 0.7];
}

/** DIP legs from the body to the holes, seen from above. */
function DipLegs({ n, ox, oz, bodyW, holes }: { n: number; ox: number; oz: number; bodyW: number; holes: boolean }) {
  const cz = oz - 1.5 * P;
  return (
    <g>
      {dipFootprint(n).map((f) => {
        const x = ox + f.dx * P;
        const zr = oz + f.dz * P;
        const s = f.dz === 0 ? 1 : -1;
        const zs = cz + (s * bodyW) / 2;
        const zm = zr - s * 0.55;
        const y0 = Math.min(zs, zm);
        return (
          <g key={f.leg}>
            <rect x={n3(x - 0.62)} y={n3(y0)} width={1.24} height={n3(Math.abs(zm - zs))} className="f-metal ln-thin" />
            <rect x={n3(x - 0.27)} y={n3(Math.min(zm, zr))} width={0.54} height={n3(Math.abs(zr - zm))} className="f-metal" />
            {holes && <HoleDot at={[x, zr]} />}
          </g>
        );
      })}
    </g>
  );
}

function Chip(props: DrawProps<"chip">) {
  const { pi, st } = props;
  const pp = pi.part.params;
  if (pp.package === "soic") return <Soic {...props} />;
  const model = pp.model ?? "555";
  const n = chipPinCount(model);
  const len = DIP.len[n] ?? 9.4;
  const held = !!pi.pose.heldBy;
  const [ox, oz] = dipOrigin(n, { mount: pi.mount, held });
  const cx = ox + ((n / 2 - 1) / 2) * P;
  const cz = oz - 1.5 * P;
  const w = DIP.w;
  const x0 = cx - len / 2;
  const hp = health(st);
  const heat = warmth(st);
  const rot = pi.f.rot;
  const body = rrect(cx, cz, len, w, 0.5);
  const print = CHIP_PRINT[model];
  const size = Math.min(n === 8 ? 1.6 : 1.85, ((len - 2.6) / Math.max(4, print.length)) * 1.6);
  return (
    <g>
      <DipLegs n={n} ox={ox} oz={oz} bodyW={w} holes={pi.mount === "board"} />
      <path d={body} className="f-black" />
      <Warm d={body} heat={heat} />
      {/* The notch at the pin-1 end, and the dimple by pin 1. */}
      <path d={`M${n3(x0)} ${n3(cz - 0.95)}A0.95 0.95 0 0 1 ${n3(x0)} ${n3(cz + 0.95)}Z`} className="f-black-face ln-thin" />
      <circle cx={n3(x0 + 1.25)} cy={n3(cz + w / 2 - 1.25)} r={0.5} className="f-black-face ln-thin" />
      {pp.hidden ? (
        <g transform={`rotate(-2.5 ${n3(cx + 0.4)} ${n3(cz)})`}>
          <rect x={n3(cx + 0.4 - Math.min(len * 0.31, 5.5))} y={n3(cz - w * 0.43)} width={n3(Math.min(len * 0.62, 11))} height={n3(w * 0.86)} className="f-tape ln-thin" />
          <text x={n3(cx + 0.4)} y={n3(cz + 0.15)} fontSize={2.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="hand f-ink">
            {pp.label ?? "?"}
          </text>
        </g>
      ) : (
        // Printed along the body: upside down when the chip is turned round, as on a real one.
        <text x={n3(cx + 0.45)} y={n3(cz - 0.25)} fontSize={n3(size)} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light">
          {print}
        </text>
      )}
      <Scorch d={body} hp={hp} crack={`M${n3(cx - len * 0.2)} ${n3(cz - w * 0.4)}l1.1 1.6l-0.4 1.2l1.4 1.5l-0.3 1.1`} />
      <HeatLines cx={cx} cz={cz} len={len} w={w} rot={rot} heat={heat} st={st} />
      {dipFootprint(n).map((f) => (
        <PinNo key={f.leg} x={ox + f.dx * P} z={cz + (f.dz === 0 ? 1 : -1) * (w / 2 - 0.8)} rot={rot}>
          {f.leg}
        </PinNo>
      ))}
    </g>
  );
}

/** The surface mount lookalike: a small body on feet 1.27 mm apart. Over the board it lies askew, lifted off it. */
function Soic({ pi, st }: DrawProps<"chip">) {
  const pp = pi.part.params;
  const model = pp.model ?? "555";
  const n = chipPinCount(model);
  const len = SOIC.len[n] ?? 4.9;
  const perched = pi.pose.origin[1] > 0;
  const body = rrect(0, 0, len, SOIC.w, 0.3);
  const feet = soicFeet(n);
  return (
    <g>
      {/* Lifted: its shadow falls a little away from it. */}
      {perched && <path d={rrect(0.9, 1.1, len + 1.4, SOIC.feet + 0.6, 0.6)} className="f-shade" opacity={0.85} />}
      {Object.entries(feet).map(([leg, [x, , z]]) => (
        <rect key={leg} x={n3(x - 0.21)} y={n3(z > 0 ? SOIC.w / 2 - 0.1 : -SOIC.feet / 2)} width={0.42} height={n3(SOIC.feet / 2 - SOIC.w / 2 + 0.1)} className="f-metal ln-thin" />
      ))}
      <path d={body} className="f-black" />
      <path d={`M${n3(-len / 2 + 0.2)} ${n3(SOIC.w / 2 - 0.35)}H${n3(len / 2 - 0.2)}`} className="ln-soft" />
      <circle cx={n3(-len / 2 + 0.7)} cy={n3(SOIC.w / 2 - 0.95)} r={0.3} className="f-black-face" />
      {pp.hidden ? (
        <rect x={n3(-len * 0.3)} y={n3(-SOIC.w * 0.4)} width={n3(len * 0.6)} height={n3(SOIC.w * 0.8)} className="f-tape ln-thin" />
      ) : (
        <text x={0} y={-0.15} fontSize={n3(Math.min(0.9, (len - 1) / Math.max(4, CHIP_PRINT[model].length) * 1.6))} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light">
          {CHIP_PRINT[model]}
        </text>
      )}
      <Scorch d={body} hp={health(st)} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// IC socket.

function Socket({ pi }: DrawProps<"ic-socket">) {
  const n = pi.part.params.pins ?? 8;
  const len = (n / 2 - 1) * P + 2.4;
  const [ox, oz] = dipOrigin(n, { mount: pi.mount, held: false });
  const cx = ox + ((n / 2 - 1) / 2) * P;
  const cz = oz - 1.5 * P;
  const W = SOCKET.w;
  const inner = rrect(cx, cz, len - 2 * SOCKET.end, W - 5.4, 0.3);
  const outer = rrect(cx, cz, len, W, 0.5);
  const x0 = cx - len / 2;
  return (
    <g>
      <path d={`${outer}${inner}`} fillRule="evenodd" className="f-black-face" />
      <path d={outer} className="ln" />
      <path d={inner} className="ln-thin" />
      <path d={`M${n3(x0)} ${n3(cz - 1.1)}A1.1 1.1 0 0 1 ${n3(x0)} ${n3(cz + 1.1)}Z`} className="f-black ln-thin" />
      {dipFootprint(n).map((f) => {
        const x = ox + f.dx * P;
        const z = oz + f.dz * P;
        return (
          <g key={f.leg}>
            <rect x={n3(x - 0.5)} y={n3(z - 0.65)} width={1} height={1.3} rx={0.2} className="f-black" />
            {pi.mount === "board" ? <HoleDot at={[x, z]} /> : <circle cx={n3(x)} cy={n3(z)} r={0.3} className="f-brass" />}
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// DIP switch.

function DipSwitch({ pi }: DrawProps<"dip-switch">) {
  const pp = pi.part.params;
  const labels = useLabels();
  const n = pp.positions ?? 8;
  const pins = n * 2;
  const len = n * P + 0.4;
  const [ox, oz] = dipOrigin(pins, { mount: pi.mount, held: false });
  const cx = ox + ((n - 1) / 2) * P;
  const cz = oz - 1.5 * P;
  const W = DIPSW.w;
  const rot = pi.f.rot;
  const body = rrect(cx, cz, len, W, 0.5);
  const slot = DIPSW.slot;
  const knob = DIPSW.knob + 0.2;
  const travel = slot / 2 - knob / 2 - 0.15;
  return (
    <g>
      <DipLegs n={pins} ox={ox} oz={oz} bodyW={W} holes={pi.mount === "board"} />
      <path d={body} className="f-dipsw" />
      <path d={body} className="ln" />
      <Upright x={cx - len / 2 + 1.7} z={cz - W / 2 + 1.05} rot={rot} fontSize={1.15} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        {labels.print.on}
      </Upright>
      <path d={`M${n3(cx - len / 2 + 3.1)} ${n3(cz - W / 2 + 1.05)}h1.8m-0.6 -0.45l0.6 0.45l-0.6 0.45`} className="s-print" strokeWidth={0.18} />
      {Array.from({ length: n }, (_, k) => {
        const x = ox + k * P;
        const on = !!pp[`s${k + 1}` as DipKey];
        const kz = cz + (on ? -travel : travel);
        const tag = pp.tags?.[k];
        return (
          <g key={k}>
            <rect x={n3(x - 0.65)} y={n3(cz - slot / 2)} width={1.3} height={n3(slot)} rx={0.2} className="f-black" />
            <g className="actuator" style={{ transform: `translate(0px,${n3(kz - cz)}px)` }}>
              <rect x={n3(x - 0.55)} y={n3(cz - knob / 2)} width={1.1} height={n3(knob)} rx={0.25} className="f-slip ln-thin" />
            </g>
            {/* Under each slider its number, or the name a lab tagged it with. */}
            <Upright x={x} z={cz + W / 2 - 1.0} rot={rot} fontSize={tag ? 1.2 : 1.05} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
              {tag ?? String(k + 1)}
            </Upright>
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 7-segment display.

const segPath = (s: Segment, dx: number, dz: number): string =>
  SEGMENT_SHAPES[s].map(([x, z], i) => `${i ? "L" : "M"}${n3(x + dx)} ${n3(z + dz)}`).join("") + "Z";

/** Segment glows 0..1 from a display's state (dead segments stay dark). */
export function segmentGlows(st: PartState | null): Record<Segment, number> {
  const x = st?.extra ?? {};
  const dead = typeof x["dead"] === "string" ? (x["dead"] as string) : "";
  const out = {} as Record<Segment, number>;
  for (const s of SEGMENTS) out[s] = st?.health === "dead" || dead.includes(s) ? 0 : Math.max(0, Math.min(1, Number(x[s] ?? 0)));
  return out;
}

/** The display's frame origin and face centre: pin 1 on the board, the body centre on the desk. */
function displayCentre(mount: string): Vec2 {
  return mount === "board" ? [2 * P, -3 * P] : [0, 0];
}

function SevenSeg({ pi, st }: DrawProps<"sevenseg">) {
  const pp = pi.part.params;
  const color = pp.color ?? "red";
  const [cx, cz] = displayCentre(pi.mount);
  const rot = pi.f.rot;
  const glows = segmentGlows(st);
  const x = st?.extra ?? {};
  const dead = typeof x["dead"] === "string" ? (x["dead"] as string) : "";
  const body = rrect(cx, cz, DISPLAY.w, DISPLAY.d, 0.6);
  const face = rrect(cx, cz, DISPLAY.w - 1.2, DISPLAY.d - 1.2, 0.3);
  return (
    <g>
      {pp.carrier && <Carrier cx={cx} cz={cz} ohms={pp.segmentOhms ?? 3300} rot={rot} />}
      <path d={body} className="f-seg-body" />
      <path d={face} className="f-seg-face" />
      {SEGMENTS.map((s) => {
        const g = glows[s];
        const d = segPath(s, cx, cz);
        if (g < 0.02) return <path key={s} d={d} className={dead.includes(s) || st?.health === "dead" ? "f-dead" : "f-seg-off"} />;
        return (
          <g key={s}>
            <path d={d} style={{ fill: "none", stroke: LED_TOKEN(color, "glow"), strokeWidth: 1.6, strokeLinejoin: "round", opacity: Math.min(0.85, 0.2 + g * 0.6) }} />
            <path d={d} style={{ fill: LED_TOKEN(color, "lit") }} opacity={0.45 + g * 0.55} />
          </g>
        );
      })}
      <path d={body} className="ln" />
      <Scorch d={face} hp={health(st)} />
      {/* Pins hide under the body: their names show up close. */}
      {SEVENSEG_LEGS.map((leg, i) => {
        const px = cx - 2 * P + (i < 5 ? i : 9 - i) * P;
        const pz = cz + (i < 5 ? 3 : -3) * P;
        return (
          <g key={leg} className="pinno">
            <circle cx={n3(px)} cy={n3(pz)} r={0.45} className="f-metal ln-thin" />
            <PinNo x={px} z={pz + (i < 5 ? -1.2 : 1.2)} rot={rot} size={0.9}>
              {leg === "com2" ? "com" : leg}
            </PinNo>
          </g>
        );
      })}
    </g>
  );
}

/** The display's carrier board: green, a resistor beside each segment pin, letters in its silkscreen. */
function Carrier({ cx, cz, ohms, rot }: { cx: number; cz: number; ohms: number; rot: number }) {
  const code = ohms >= 10 ? `${Math.round(ohms / 10 ** (Math.floor(Math.log10(ohms)) - 1))}${Math.floor(Math.log10(ohms)) - 1}` : String(ohms);
  const side = (sx: number, letters: string[]) =>
    letters.map((l, i) => {
      const x = cx + sx * (CARRIER.w / 2 - 2.1);
      const z = cz - CARRIER.d / 2 + 3.2 + i * 4.9;
      return (
        <g key={l}>
          <rect x={n3(x - 0.9)} y={n3(z - 1.9)} width={1.8} height={3.8} rx={0.15} className="f-metal" />
          <rect x={n3(x - 0.9)} y={n3(z - 1.35)} width={1.8} height={2.7} className="f-black" />
          <Upright x={x} z={z} rot={rot + 90} fontSize={0.85} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light">
            {code}
          </Upright>
          <Upright x={x - sx * 1.9} z={z} rot={rot} fontSize={1.0} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light lod2">
            {l}
          </Upright>
        </g>
      );
    });
  const pcb = rrect(cx, cz, CARRIER.w, CARRIER.d, 0.8);
  return (
    <g>
      <path d={pcb} className="f-pcb" />
      <path d={rrect(cx, cz, CARRIER.w - 1, CARRIER.d - 1, 0.5)} className="s-print" strokeWidth={0.12} opacity={0.6} />
      {side(-1, ["e", "d", "c", "dp"])}
      {side(1, ["a", "b", "f", "g"])}
      <path d={pcb} className="ln" />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 7805.

function Regulator({ pi, st }: DrawProps<"regulator7805">) {
  const T = TO220;
  const rot = pi.f.rot;
  const hp = health(st);
  const heat = warmth(st);
  const sink = !!pi.part.params.heatsink;
  if (pi.mount !== "board") {
    // Lying on its back: the printed face up, the tab and its hole away from you, the legs toward you.
    const L = localLegs(pi);
    const bz1 = 3.6;
    const bz0 = bz1 - T.bodyH;
    const tz0 = bz0 - T.tabH;
    const body = rrect(0, (bz0 + bz1) / 2, T.w, T.bodyH, 0.4);
    return (
      <g>
        {sink && <path d={rrect(0, (tz0 + bz1) / 2, T.sink.w, bz1 - tz0 + 2, 0.8)} className="f-metal ln" />}
        {["in", "gnd", "out"].map((leg) => {
          const p = L[leg];
          return p ? <Lead key={leg} a={[p[0], bz1]} b={p} /> : null;
        })}
        <path d={`M${n3(-T.w / 2)} ${n3(bz0)}V${n3(tz0 + 0.8)}L${n3(-T.w / 2 + 0.8)} ${n3(tz0)}H${n3(T.w / 2 - 0.8)}L${n3(T.w / 2)} ${n3(tz0 + 0.8)}V${n3(bz0)}Z`} className="f-metal ln" />
        <circle cx={0} cy={n3(tz0 + 2.8)} r={n3(T.hole / 2)} className="f-paper ln-thin" />
        <path d={body} className="f-black" />
        <Warm d={body} heat={heat} />
        <path d={body} className="ln" />
        <Upright x={0} z={(bz0 + bz1) / 2 - 1.1} rot={rot} fontSize={2.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
          7805
        </Upright>
        <Upright x={0} z={(bz0 + bz1) / 2 + 1.9} rot={rot} fontSize={1.5} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print-light">
          +5V
        </Upright>
        <Scorch d={body} hp={hp} />
        {(["in", "gnd", "out"] as const).map((leg, i) => (
          <PinNo key={leg} x={(i - 1) * P} z={bz1 + 1.4} rot={rot} size={0.85}>
            {leg}
          </PinNo>
        ))}
      </g>
    );
  }
  // Standing in the board, seen from above: the body over its legs, the metal tab behind it.
  const cx = P;
  const zFront = -0.3 + (T.bodyD - T.tabD) / 2;
  const zBack = zFront - (T.bodyD - T.tabD);
  const zTab = zBack - T.tabD;
  const body = `M${n3(cx - T.w / 2)} ${n3(zBack)}H${n3(cx + T.w / 2)}V${n3(zFront)}H${n3(cx - T.w / 2)}Z`;
  return (
    <g>
      {sink && (
        <g>
          <rect x={n3(cx - T.sink.w / 2)} y={n3(zTab - 1.6)} width={T.sink.w} height={1.6} className="f-metal ln-thin" />
          {Array.from({ length: T.sink.fins }, (_, i) => {
            const x = cx - T.sink.w / 2 + 0.6 + (i * (T.sink.w - 1.2)) / (T.sink.fins - 1);
            return <rect key={i} x={n3(x - 0.45)} y={n3(zTab - 1.6 - T.sink.d)} width={0.9} height={T.sink.d} className="f-metal ln-thin" />;
          })}
        </g>
      )}
      {[0, P, 2 * P].map((x) => (
        <HoleDot key={x} at={[x, 0]} />
      ))}
      <rect x={n3(cx - T.w / 2)} y={n3(zTab)} width={T.w} height={T.tabD} className="f-metal ln-thin" />
      <path d={body} className="f-black" />
      <Warm d={body} heat={heat} />
      <path d={body} className="ln" />
      <Upright x={cx} z={(zBack + zFront) / 2} rot={rot} fontSize={2.1} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        7805
      </Upright>
      <Scorch d={body} hp={hp} />
      <HeatLines cx={cx} cz={(zTab - (sink ? T.sink.d + 1.6 : 0) + zFront) / 2} len={T.w} w={zFront - zTab + (sink ? T.sink.d + 1.6 : 0)} rot={rot} heat={heat} st={st} />
      {(["in", "gnd", "out"] as const).map((leg, i) => (
        <PinNo key={leg} x={i * P} z={zFront + 1.3} rot={rot} size={0.85}>
          {leg}
        </PinNo>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Logic probe.

/**
 * Foreshortening of the pen in ink while its tip is in a hole and it leans back toward you. Steeper in 3D, but drawn
 * a little longer here so its lamps stay apart (teaching scale: the tip is still exactly on its hole).
 */
const LEAN = 0.62;

/** Where the logic probe's leads leave its tail, in its frame. */
export function probeInkExits(probing: boolean): Record<"vcc" | "gnd", { at: Vec2; dir: Vec2 }> {
  const z = (PROBE.len + 8) * (probing ? LEAN : 1);
  return { vcc: { at: [-0.9, z], dir: [-0.15, 1] }, gnd: { at: [0.9, z], dir: [0.15, 1] } };
}

/** The pen's outline from its profile, seen from above, foreshortened by `k`. */
function penPath(k: number, upTo = PROBE_PROFILE.length): string {
  const pts = PROBE_PROFILE.slice(0, upTo);
  const right = pts.map(([r, z]) => `${n3(r)} ${n3(z * k)}`);
  const left = [...pts].reverse().map(([r, z]) => `${n3(-r)} ${n3(z * k)}`);
  return `M${right.join("L")}L${left.join("L")}Z`;
}

function LogicProbe({ pi, st }: DrawProps<"logic-probe">) {
  const labels = useLabels();
  const probing = !!pi.ends?.["tip"]?.inHole;
  const k = probing ? LEAN : 1;
  const R = PROBE.dia / 2;
  const z = (v: number) => n3(v * k);
  const x = st?.extra ?? {};
  const powered = !!x["powered"];
  const level = String(x["level"] ?? "");
  const pulse = !!x["pulse"];
  const nz = PROBE.needle;
  const body = penPath(k);
  const lamps: [boolean, string, number][] = [
    [powered && level === "H", labels.print.hi ?? "HI", PROBE.lamps],
    [powered && level === "L", labels.print.lo ?? "LO", PROBE.lamps + PROBE.lamp],
    [powered && pulse, labels.print.pulse ?? "PULSE", PROBE.lamps + 2 * PROBE.lamp],
  ];
  return (
    <g>
      {!probing && <path d={rrect(1.2, (PROBE.len + nz) / 2 + 1.5, PROBE.dia + 1, PROBE.len - nz + 6, 4)} className="f-shade" opacity={0.6} />}
      <path d={`M0 0L0 ${z(nz)}`} className="lead" />
      <path d={body} className="f-probe" />
      <path d={penPath(k, 6)} className="f-black" />
      {/* The lamps in a dark strip, each named beside it on the barrel. */}
      <rect x={-3.3} y={z(PROBE.lamps - 3)} width={3.2} height={n3((2 * PROBE.lamp + 6) * k)} rx={0.8} className="f-black-face" />
      {lamps.map(([on, name, at]) => (
        <g key={name}>
          {on && <circle cx={-1.7} cy={z(at)} r={2.3} className="f-amber-glow" />}
          <circle cx={-1.7} cy={z(at)} r={1.1} className={on ? "f-amber ln-thin" : "f-lamp-off ln-thin"} />
          <Upright x={0.4} z={at * k} rot={pi.f.rot} fontSize={1.3} fontWeight={700} dominantBaseline="central" className="print">
            {name}
          </Upright>
        </g>
      ))}
      <path d={body} className="ln" />
      {probing && <HoleDot at={[0, 0]} />}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// AA battery pack.

/** Where a pack's leads leave its near end, in its frame. */
export function packInkExits(): Record<"pos" | "neg", { at: Vec2; dir: Vec2 }> {
  const d = PACK.cellLen / 2 + PACK.end;
  return { pos: { at: [-5, d + 0.4], dir: [-0.1, 1] }, neg: { at: [5, d + 0.4], dir: [0.1, 1] } };
}

function Pack({ pi }: DrawProps<"battery-pack">) {
  const cells = pi.part.params.cells ?? 3;
  const w = cells * PACK.cell + 2 * PACK.wall;
  const d = PACK.cellLen + 2 * PACK.end;
  const rot = pi.f.rot;
  // The nominal voltage, as printed on a holder (1.5 V a cell).
  const volts = `${cells * 1.5}V`;
  return (
    <g>
      <rect x={n3(-w / 2 + 1)} y={n3(-d / 2 + 1.3)} width={n3(w)} height={n3(d)} rx={1.6} className="f-shade" />
      <rect x={n3(-w / 2)} y={n3(-d / 2)} width={n3(w)} height={n3(d)} rx={1.6} className="f-black" />
      {Array.from({ length: cells }, (_, i) => {
        const x = -w / 2 + PACK.wall + PACK.cell / 2 + i * PACK.cell;
        const up = i % 2 === 0;
        const r = PACK.cell / 2 - 0.4;
        return (
          <g key={i}>
            <rect x={n3(x - r)} y={n3(-PACK.cellLen / 2)} width={n3(r * 2)} height={PACK.cellLen} rx={1.4} style={{ fill: "var(--k-aa-alkaline)" }} />
            <rect x={n3(x - r)} y={n3(up ? PACK.cellLen / 2 - 14 : -PACK.cellLen / 2 + 5)} width={n3(r * 2)} height={9} style={{ fill: "var(--k-battery-label)" }} />
            <rect x={n3(x - r)} y={n3(-PACK.cellLen / 2)} width={n3(r * 2)} height={PACK.cellLen} rx={1.4} className="ln-thin" />
            <rect x={n3(x - 2.6)} y={n3(up ? PACK.cellLen / 2 - 0.4 : -PACK.cellLen / 2 - 1)} width={5.2} height={1.4} rx={0.5} className="f-metal-hi ln-thin" />
            <Upright x={x} z={up ? PACK.cellLen / 2 - 20 : -PACK.cellLen / 2 + 20} rot={rot} fontSize={4.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
              {up ? "+" : "−"}
            </Upright>
          </g>
        );
      })}
      <rect x={n3(-w / 2)} y={n3(-d / 2)} width={n3(w)} height={n3(d)} rx={1.6} className="ln" />
      <Upright x={0} z={d / 2 - 2.4} rot={rot} fontSize={2.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        {volts}
      </Upright>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Bench supply.

function Supply({ pi }: DrawProps<"bench-supply">) {
  const S = SUPPLY;
  const rot = pi.f.rot;
  const pp = pi.part.params;
  const volts = supplyVolts(pp);
  const angle = ((pp.position ?? 0.5) - 0.5) * 270;
  const L = localLegs(pi);
  return (
    <g>
      <rect x={-S.w / 2 + 1.2} y={-S.d / 2 + 1.6} width={S.w} height={S.d} rx={3} className="f-shade" />
      <rect x={-S.w / 2} y={-S.d / 2} width={S.w} height={S.d} rx={3} className="f-meter" />
      <rect x={-S.w / 2 + 4} y={-12} width={S.w - 8} height={44} rx={1.5} className="f-black-face" />
      <rect x={-S.w / 2} y={-S.d / 2} width={S.w} height={S.d} rx={3} className="ln" />
      <rect x={S.lcdX - 18} y={S.lcdZ - 7} width={36} height={14} rx={1.2} className="f-black" />
      <rect x={S.lcdX - 16} y={S.lcdZ - 5.5} width={32} height={11} rx={0.6} className="f-lcd" />
      <Upright x={S.lcdX + 8} z={S.lcdZ + 0.4} rot={rot} fontSize={7.5} fontWeight={700} textAnchor="end" dominantBaseline="central" className="f-lcd-ink" style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', Menlo, monospace)" }}>
        {volts.toFixed(1)}
      </Upright>
      <Upright x={S.lcdX + 12} z={S.lcdZ + 1.4} rot={rot} fontSize={4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="f-lcd-ink">
        V
      </Upright>
      <Upright x={22} z={S.lcdZ} rot={rot} fontSize={3.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print">
        0–12 V
      </Upright>
      {Array.from({ length: 13 }, (_, i) => {
        const a = ((-135 + i * 22.5) * Math.PI) / 180;
        const r0 = S.knobR + 1.6;
        const r1 = r0 + (i % 6 === 0 ? 2.4 : 1.4);
        return <path key={i} d={`M${n3(Math.sin(a) * r0)} ${n3(-Math.cos(a) * r0)}L${n3(Math.sin(a) * r1)} ${n3(-Math.cos(a) * r1)}`} className="s-print" strokeWidth={0.35} />;
      })}
      <g className="actuator" style={{ transform: `rotate(${n3(angle)}deg)` }}>
        <circle r={S.knobR} className="f-knob ln" />
        <path d={`M0 ${-S.knobR + 1.2}V-3`} className="s-print" strokeWidth={0.9} strokeLinecap="round" />
      </g>
      {(["pos", "neg"] as const).map((leg) => {
        const p = L[leg];
        if (!p) return null;
        return (
          <g key={leg}>
            <circle cx={n3(p[0])} cy={n3(p[1])} r={4.2} className={leg === "pos" ? "f-red ln" : "f-black ln"} />
            <circle cx={n3(p[0])} cy={n3(p[1])} r={1.2} className="f-brass ln-thin" />
            <Upright x={p[0] + (leg === "pos" ? -8.5 : 8.5)} z={p[1]} rot={rot} fontSize={4.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
              {leg === "pos" ? "+" : "−"}
            </Upright>
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Registry.

const chipLen = (p: PlacedPartOf<"chip">) => DIP.len[chipPinCount(p.params.model ?? "555")] ?? 9.4;

export const CHIPS: InkRegistry = {
  chip: {
    box: (p, c) => {
      if (p.params.package === "soic") {
        const len = SOIC.len[chipPinCount(p.params.model ?? "555")] ?? 4.9;
        return [-len / 2 - 0.3, -SOIC.feet / 2 - 0.2, len / 2 + 0.3, SOIC.feet / 2 + 0.2];
      }
      return dipBox(chipPinCount(p.params.model ?? "555"), chipLen(p), c);
    },
    Draw: Chip,
  },
  "ic-socket": {
    box: (p, c) => dipBox(p.params.pins ?? 8, ((p.params.pins ?? 8) / 2 - 1) * P + 2.4, c),
    Draw: Socket,
  },
  "dip-switch": {
    box: (p, c) => dipBox((p.params.positions ?? 8) * 2, (p.params.positions ?? 8) * P + 0.4, c),
    Draw: DipSwitch,
  },
  sevenseg: {
    box: (p, c) => {
      const [cx, cz] = displayCentre(c.mount);
      const w = p.params.carrier ? CARRIER.w : DISPLAY.w;
      const d = p.params.carrier ? CARRIER.d : DISPLAY.d;
      return [cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2];
    },
    Draw: SevenSeg,
  },
  regulator7805: {
    box: (p, c) => {
      const T = TO220;
      const sink = p.params.heatsink ? T.sink.d + 1.6 : 0;
      if (c.mount !== "board") return [-(p.params.heatsink ? T.sink.w : T.w) / 2, 3.6 - T.bodyH - T.tabH - (p.params.heatsink ? 2 : 0), (p.params.heatsink ? T.sink.w : T.w) / 2, 16];
      return [P - (p.params.heatsink ? T.sink.w : T.w) / 2, -0.3 - (T.bodyD - T.tabD) / 2 - T.tabD - sink, P + (p.params.heatsink ? T.sink.w : T.w) / 2, 1.6];
    },
    Draw: Regulator,
  },
  "logic-probe": {
    box: (p) => {
      const k = p.holes?.["tip"] ? LEAN : 1;
      return [-PROBE.dia / 2, 0, PROBE.dia / 2, (PROBE.len + 8) * k];
    },
    Draw: LogicProbe,
  },
  "battery-pack": {
    box: (p) => {
      const cells = p.params.cells ?? 3;
      const w = cells * PACK.cell + 2 * PACK.wall;
      const d = PACK.cellLen + 2 * PACK.end;
      return [-w / 2, -d / 2, w / 2, d / 2];
    },
    Draw: Pack,
  },
  "bench-supply": {
    box: () => [-SUPPLY.w / 2, -SUPPLY.d / 2, SUPPLY.w / 2, SUPPLY.d / 2],
    actuator: () => ({ type: "rotor", x: 0, z: 0, r: SUPPLY.knobR + 1 }),
    Draw: Supply,
    layer: 0,
  },
};
