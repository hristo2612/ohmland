// The microcontroller board seen from above, at true size: the same layout as the 3D model (src/mcuBoard.ts). Header
// sockets sit exactly on the board's clip points; their names are printed beside them, the L and ON lamps glow from
// the board's simulator state.

import { MCU_BOARD as B, MCU_HEADERS, MCU_PIN_LABEL, MCU_TITLES, mcuLabelSize, mcuLabelZ, mcuLamps } from "../../mcuBoard";
import { PITCH } from "../../board";
import { useDefs } from "../draw/shared";
import { Upright, localLegs, n3, rrect } from "./common";
import type { DrawProps, InkRegistry } from "./types";

const PCB = "var(--k-pcb)";

function Lamp({ x, z, glow, color, rot }: { x: number; z: number; glow: number; color: "orange" | "green"; rot: number }) {
  const defs = useDefs();
  void rot;
  return (
    <g>
      {glow > 0.02 && <circle cx={x} cy={z} r={n3(2.4 + glow * 4)} fill={`url(#${defs}-glow-${color})`} opacity={Math.min(1, 0.35 + glow * 0.75)} />}
      <rect x={x - 0.95} y={z - 0.6} width={1.9} height={1.2} rx={0.25} style={{ fill: glow > 0.02 ? `var(--k-lit-${color})` : `var(--k-led-${color})` }} />
      <rect x={x - 0.95} y={z - 0.6} width={1.9} height={1.2} rx={0.25} className="ln-thin" />
    </g>
  );
}

function McuBoard({ pi, st }: DrawProps<"mcu-board">) {
  const rot = pi.f.rot;
  const L = localLegs(pi);
  const { L: lampL, ON: lampOn } = mcuLamps(st?.extra);
  const dead = st?.health === "dead";
  const t = (x: number, z: number, text: string, size: number, cls = "print-light", anchor: "middle" | "start" = "middle", weight = 700) => (
    <Upright x={x} z={z} rot={rot} fontSize={size} fontWeight={weight} textAnchor={anchor} dominantBaseline="central" className={cls}>
      {text}
    </Upright>
  );
  const c = B.chip;
  const chipPins: string[] = [];
  for (let k = 0; k < 8; k++) {
    const o = -3.5 * 1.14 + k * 1.14;
    chipPins.push(
      `M${n3(c.x + o)} ${n3(c.z - c.size / 2)}V${n3(c.z - c.size / 2 - 1)}`,
      `M${n3(c.x + o)} ${n3(c.z + c.size / 2)}V${n3(c.z + c.size / 2 + 1)}`,
      `M${n3(c.x - c.size / 2)} ${n3(c.z + o)}H${n3(c.x - c.size / 2 - 1)}`,
      `M${n3(c.x + c.size / 2)} ${n3(c.z + o)}H${n3(c.x + c.size / 2 + 1)}`,
    );
  }
  const j = B.jack;
  const u = B.usb;
  return (
    <g>
      {/* Shadow, board, mounting holes. */}
      <path d={rrect(1.2, 1.6, B.w, B.d, B.corner)} className="f-shade" />
      <path d={rrect(0, 0, B.w, B.d, B.corner)} style={{ fill: PCB }} />
      <path d={rrect(0, 0, B.w - 2.4, B.d - 2.4, B.corner - 0.8)} className="s-print" strokeWidth={0.25} opacity={0.5} />
      {B.holes.map(([x, z], k) => (
        <g key={k}>
          <circle cx={x} cy={z} r={2.4} className="f-gold" />
          <circle cx={x} cy={z} r={1.5} className="f-paper ln-thin" />
        </g>
      ))}
      {/* USB-C socket and barrel jack, on the left edge. */}
      <rect x={u.x - u.w / 2} y={u.z - u.d / 2} width={u.w} height={u.d} rx={1.4} className="f-metal-hi ln" />
      <rect x={u.x - u.w / 2 + 0.6} y={u.z - u.d * 0.32} width={1.2} height={u.d * 0.64} rx={0.5} className="f-black" />
      <rect x={j.x - j.w / 2} y={j.z - j.d / 2} width={j.w} height={j.d} rx={0.8} className="f-black ln" />
      <path d={`M${n3(j.x - j.w / 2 + 2.5)} ${n3(j.z - 2.6)}V${n3(j.z + 2.6)}`} className="ln-soft" />
      {/* Reset button. */}
      <rect x={B.reset.x - 3} y={B.reset.z - 3} width={6} height={6} rx={0.6} className="f-metal ln" />
      <circle cx={B.reset.x} cy={B.reset.z} r={1.8} className="f-slip ln-thin" />
      {/* Chip, crystal, regulator. */}
      <path d={chipPins.join("")} className="ln-thin" />
      <rect x={c.x - c.size / 2} y={c.z - c.size / 2} width={c.size} height={c.size} rx={0.4} className={dead ? "f-dead ln" : "f-black ln"} />
      <circle cx={c.x - c.size / 2 + 1.3} cy={c.z - c.size / 2 + 1.3} r={0.55} className="f-black-face" />
      <ellipse cx={B.crystal.x} cy={B.crystal.z} rx={B.crystal.w / 2} ry={B.crystal.d / 2} className="f-metal-hi ln-thin" />
      <rect x={B.regulator.x - B.regulator.w / 2} y={B.regulator.z - B.regulator.d / 2} width={B.regulator.w} height={B.regulator.d} rx={0.3} className="f-black ln-thin" />
      {/* Header sockets, on the clip points. */}
      {MCU_HEADERS.map((g, k) => {
        const len = g.legs.length * PITCH;
        const x0 = g.x0 - PITCH / 2;
        return (
          <g key={k}>
            <rect x={n3(x0)} y={g.z - B.headerW / 2} width={n3(len)} height={B.headerW} rx={0.3} className="f-black" />
            <rect x={n3(x0)} y={g.z - B.headerW / 2} width={n3(len)} height={B.headerW} rx={0.3} className="ln-thin" />
            {g.legs.map((leg) => {
              const p = L[leg];
              if (!p) return null;
              return <rect key={leg} x={n3(p[0] - 0.55)} y={n3(p[1] - 0.55)} width={1.1} height={1.1} className="f-metal-hi" />;
            })}
            {g.legs.map((leg) => {
              const p = L[leg];
              if (!p) return null;
              const label = MCU_PIN_LABEL[leg];
              return <g key={`t${leg}`}>{t(p[0], mcuLabelZ(p[1]), label, mcuLabelSize(label))}</g>;
            })}
          </g>
        );
      })}
      {t(L.d0?.[0] ?? 0, mcuLabelZ(B.topZ) + 1.6, "RX", 1.0)}
      {t(L.d1?.[0] ?? 0, mcuLabelZ(B.topZ) + 1.6, "TX", 1.0)}
      {MCU_TITLES.map((x) => <g key={x.text}>{t(x.x, x.z, x.text, 1.45, "print-light", "middle", 800)}</g>)}
      {t(B.reset.x, B.reset.z + 4.6, "RESET", 1.3)}
      {t(u.x + 7.4, u.z, "USB", 1.3)}
      {t(j.x + 11.6, j.z - 2.6, "7-12V", 1.25)}
      {t(B.lampL.x - 2.6, B.lampL.z, "L", 1.6, "print-light", "middle", 800)}
      {t(B.lampOn.x - 3.4, B.lampOn.z, "ON", 1.6, "print-light", "middle", 800)}
      {t(16.2, -4.5, "ohmland", 1.9, "print-light", "start", 800)}
      {t(16.2, -1.6, "5 V BOARD", 1.2, "print-light", "start", 600)}
      <Lamp x={B.lampL.x} z={B.lampL.z} glow={dead ? 0 : lampL} color="orange" rot={rot} />
      <Lamp x={B.lampOn.x} z={B.lampOn.z} glow={lampOn} color="green" rot={rot} />
      <path d={rrect(0, 0, B.w, B.d, B.corner)} className="ln" />
    </g>
  );
}

export const MCU: InkRegistry = {
  "mcu-board": {
    box: () => [-B.w / 2 - 2.2, -B.d / 2, B.w / 2, B.d / 2],
    Draw: McuBoard,
    layer: 0,
  },
};
