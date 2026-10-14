// Unit 4's door guard in ink: a door (or a window) drawn in plan, the way an architect draws one: the wall cut through,
// the leaf hinged on the right with the faint arc it swings along, the magnet on its free edge and the reed switch on
// the left jamb, wired to a small terminal block for clip leads. And plug-in modules: a small green board over a
// header row, its pins named, its name printed large.

import { MODULE_PINS, MODULE_PRINT, doorBox, doorDims, doorMarks, leafLine, moduleBox, moduleLegs } from "../../alarm";
import { PITCH as P } from "../../board";
import type { Vec2 } from "../../types";
import { HoleDot, Upright, localLegs, n3, rrect } from "./common";
import type { DrawProps, InkRegistry } from "./types";

// ---------------------------------------------------------------------------------------------------------------
// The door.

function Door({ pi }: DrawProps<"door">) {
  const pp = pi.part.params;
  const style = pp.style ?? "door";
  const D = doorDims(style, pp.side);
  const s = D.s;
  const b = D.base;
  const rot = pi.f.rot;
  const { hinge, tip } = leafLine(pp, pp.open);
  const shut = leafLine(pp, false).tip;
  const wide = leafLine(pp, true).tip;
  const marks = doorMarks(pp);
  const L = localLegs(pi);
  const a = Math.atan2(tip[1] - hinge[1], tip[0] - hinge[0]);
  // The leaf as a slim rectangle along hinge to tip, on the wall's front face.
  const leafPath = (() => {
    const t = style === "window" ? 1.6 : D.leafT;
    // Thickness toward the front (+z) of the shut leaf.
    const nx = s * Math.sin(a) * t;
    const nz = -s * Math.cos(a) * t;
    const p: Vec2[] = [hinge, tip, [tip[0] + nx, tip[1] + nz], [hinge[0] + nx, hinge[1] + nz]];
    return `M${p.map((q) => `${n3(q[0])} ${n3(q[1])}`).join("L")}Z`;
  })();
  const r = D.leaf;
  const arc = `M${n3(shut[0])} ${n3(shut[1])}A${n3(r)} ${n3(r)} 0 0 ${s > 0 ? 0 : 1} ${n3(wide[0])} ${n3(wide[1])}`;
  const mg = marks.magnet;
  const deg = (a * 180) / Math.PI;
  return (
    <g>
      {/* The base plank. */}
      <rect x={n3(b.x0 + 1)} y={n3(b.z0 + 1.3)} width={n3(b.x1 - b.x0)} height={n3(b.z1 - b.z0)} rx={1.4} className="f-shade" />
      <rect x={n3(b.x0)} y={n3(b.z0)} width={n3(b.x1 - b.x0)} height={n3(b.z1 - b.z0)} rx={1.4} className="f-wood" />
      <rect x={n3(b.x0)} y={n3(b.z0)} width={n3(b.x1 - b.x0)} height={n3(b.z1 - b.z0)} rx={1.4} className="ln-soft" />
      {/* The wall, cut through either side of the opening. */}
      {([-1, 1] as const).map((s) => (
        <g key={s}>
          <rect x={n3(s < 0 ? -D.w / 2 - 2 : D.w / 2 - D.jamb)} y={n3(-D.t / 2)} width={n3(D.jamb + 2)} height={n3(D.t)} className="f-wall" />
          <rect x={n3(s < 0 ? -D.w / 2 - 2 : D.w / 2 - D.jamb)} y={n3(-D.t / 2)} width={n3(D.jamb + 2)} height={n3(D.t)} className="ln" />
        </g>
      ))}
      {/* A window keeps a sill across the opening; a door's threshold is a faint line. */}
      {style === "window" ? (
        <rect x={n3(-D.w / 2 + D.jamb)} y={n3(-D.t / 2)} width={n3(D.w - 2 * D.jamb)} height={n3(D.t)} className="f-glass ln-thin" />
      ) : (
        <path d={`M${n3(-D.w / 2 + D.jamb)} 0H${n3(D.w / 2 - D.jamb)}`} className="ln-faint" />
      )}
      {/* The swing, then the leaf and its magnet. */}
      <path d={arc} className="ln-faint" strokeDasharray="1.6 1.4" fill="none" />
      <path d={leafPath} className={style === "window" ? "f-glass" : "f-wood-dark"} />
      <path d={leafPath} className="ln" />
      <g transform={`translate(${n3(mg[0])} ${n3(mg[2])}) rotate(${n3(deg)})`}>
        <rect x={-4.6} y={-1.4} width={9.2} height={2.8} rx={0.5} className="f-paper" />
        <rect x={-4.6} y={-1.4} width={3} height={2.8} rx={0.5} className="f-red" />
        <rect x={-4.6} y={-1.4} width={9.2} height={2.8} rx={0.5} className="ln-thin" />
      </g>
      {/* The reed switch on the right jamb: a white case with a glass capsule. */}
      <rect x={n3(marks.reed[0] - 2)} y={n3(marks.reed[2] - 1.7)} width={4} height={6.6} rx={0.6} className="f-paper" />
      <rect x={n3(marks.reed[0] - 0.7)} y={n3(marks.reed[2] - 0.6)} width={1.4} height={4.4} rx={0.6} className="f-glass ln-thin" />
      <rect x={n3(marks.reed[0] - 2)} y={n3(marks.reed[2] - 1.7)} width={4} height={6.6} rx={0.6} className="ln-thin" />
      {/* Its wires to the terminal block. */}
      {(["a", "b"] as const).map((leg, i) => {
        const p = L[leg];
        if (!p) return null;
        return <path key={leg} d={`M${n3(marks.reed[0] - s * (0.8 - i * 0.8))} ${n3(marks.reed[2] + 4.6)}C${n3(marks.reed[0] - s * 3)} ${n3(p[1] + 3)} ${n3(p[0] + s * 2)} ${n3(p[1] + 3)} ${n3(p[0])} ${n3(p[1])}`} className="ln-thin" fill="none" />;
      })}
      <path d={rrect(D.block.x, D.block.z, D.block.w, D.block.d, 1.2)} className="f-black" />
      <path d={rrect(D.block.x, D.block.z, D.block.w, D.block.d, 1.2)} className="ln" />
      {(["a", "b"] as const).map((leg) => {
        const p = L[leg];
        if (!p) return null;
        return (
          <g key={leg}>
            <circle cx={n3(p[0])} cy={n3(p[1])} r={2.1} className="f-brass ln" />
            <path d={`M${n3(p[0] - 1.5)} ${n3(p[1] + 0.7)}L${n3(p[0] + 1.5)} ${n3(p[1] - 0.7)}`} className="ln-thin" />
          </g>
        );
      })}
      <Upright x={D.block.x} z={D.block.z + D.block.d / 2 - 2} rot={rot} fontSize={2.4} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
        REED
      </Upright>
      {pp.tag && (
        <Upright x={0} z={b.z1 - 2.6} rot={rot} fontSize={3.2} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
          {pp.tag}
        </Upright>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Plug-in modules.

function PlugModule({ pi }: DrawProps<"plug-module">) {
  const model = pi.part.params.model ?? "voice";
  const legs = moduleLegs(model);
  const shift = pi.mount === "desk" ? -((legs.length - 1) * P) / 2 : 0;
  const [x0, z0, x1, z1] = moduleBox(model);
  const rot = pi.f.rot;
  const pins = MODULE_PINS[model];
  return (
    <g transform={shift ? `translate(${n3(shift)} 0)` : undefined}>
      <rect x={n3(x0 + 1)} y={n3(z0 + 1.4)} width={n3(x1 - x0)} height={n3(z1 - z0)} rx={1} className="f-shade" />
      <rect x={n3(x0)} y={n3(z0)} width={n3(x1 - x0)} height={n3(z1 - z0)} rx={1} className="f-pcb" />
      <rect x={n3(x0)} y={n3(z0)} width={n3(x1 - x0)} height={n3(z1 - z0)} rx={1} className="ln" />
      {pins.map((p, i) => (
        <g key={p.leg}>
          <circle cx={n3(i * P)} cy={0} r={0.95} className="f-gold ln-thin" />
          {pi.mount === "board" && <HoleDot at={[i * P, 0]} />}
          <Upright x={i * P} z={-2.6} rot={rot} fontSize={1.25} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light">
            {p.print}
          </Upright>
        </g>
      ))}
      {/* The singer on board: its 555 and its 100 µF. */}
      <rect x={n3((x0 + x1) / 2 - 4.8)} y={n3(z0 + 1.6)} width={6.4} height={4.8} rx={0.4} className="f-black ln-thin" />
      <circle cx={n3(x1 - 3)} cy={n3(z0 + 4)} r={1.8} className="f-blue ln-thin" />
      <Upright x={(x0 + x1) / 2} z={-6.6} rot={rot} fontSize={2.3} fontWeight={800} textAnchor="middle" dominantBaseline="central" className="print-light">
        {MODULE_PRINT[model]}
      </Upright>
    </g>
  );
}

export const ALARM_INK: InkRegistry = {
  door: { box: (p) => doorBox(p.params), Draw: Door, layer: 0 },
  "plug-module": {
    box: (p, c) => {
      const [x0, z0, x1, z1] = moduleBox(p.params.model);
      const shift = c.mount === "desk" ? -((moduleLegs(p.params.model).length - 1) * P) / 2 : 0;
      return [x0 + shift, z0, x1 + shift, z1];
    },
    Draw: PlugModule,
  },
};

