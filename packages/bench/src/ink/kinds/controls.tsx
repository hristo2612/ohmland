// Parts you work with your fingers, and the ones that switch by themselves: trimmer, slide and toggle switches (and
// the big toggle on its wooden block), pushbutton, the relay with its visible changeover contacts, and the fuse.

import { PITCH as P } from "../../board";
import { FUSE, PUSHBUTTON, RELAY, SLIDE, TOGGLE, TOGGLE_BASE, TRIMMER } from "../../dims";
import type { Vec2 } from "../../types";
import { useDefs } from "../draw/shared";
import { BLOCK } from "../../dims";
import { BigButton, BigKnob, BigSlider, RelayTop, TerminalBlock, blockBox, isBlock, relayArmature } from "./blocks";
import { HoleDot, Lead, Upright, health, localLegs, n3 } from "./common";
import type { DrawProps, InkRegistry } from "./types";

function Trimmer({ pi }: DrawProps<"trimmer">) {
  if (pi.part.params.base) {
    return (
      <TerminalBlock pi={pi} plateW={26}>
        <BigKnob position={pi.part.params.position ?? 0.5} />
      </TerminalBlock>
    );
  }
  const cx = pi.mount === "board" ? P : 0;
  const s = TRIMMER.size;
  const angle = ((pi.part.params.position ?? 0.5) - 0.5) * 270;
  const r = TRIMMER.rotorDia / 2;
  return (
    <g>
      <rect x={n3(cx - s / 2)} y={-s / 2} width={s} height={s} rx={0.7} className="f-trimmer" />
      <rect x={n3(cx - s / 2)} y={-s / 2} width={s} height={s} rx={0.7} className="ln" />
      <g className="actuator" style={{ transform: `translate(${n3(cx)}px,0px) rotate(${n3(angle)}deg)` }}>
        <circle r={n3(r)} className="f-slip" />
        <path d={`M${n3(-r * 0.7)} 0H${n3(r * 0.7)}M0 ${n3(-r * 0.7)}V${n3(r * 0.7)}`} className="ln-thin" />
        <path d={`M0 ${n3(-r - 0.1)}l-0.75 1.2h1.5z`} className="f-ink" />
        <circle r={n3(r)} className="ln" />
      </g>
    </g>
  );
}

function SlideSwitch({ pi }: DrawProps<"slide-switch">) {
  if (pi.part.params.base) {
    return (
      <TerminalBlock pi={pi}>
        <BigSlider to={pi.part.params.to} />
      </TerminalBlock>
    );
  }
  const cx = pi.mount === "board" ? P : 0;
  const S = SLIDE;
  const kx = pi.part.params.to === "a" ? -S.throw / 2 : S.throw / 2;
  const slot = S.throw + 2.2;
  return (
    <g>
      <rect x={n3(cx - S.len / 2)} y={-S.wid / 2} width={S.len} height={S.wid} rx={0.4} className="f-metal" />
      <rect x={n3(cx - slot / 2)} y={-1.15} width={n3(slot)} height={2.3} rx={0.3} className="f-black" />
      <rect x={n3(cx - S.len / 2)} y={-S.wid / 2} width={S.len} height={S.wid} rx={0.4} className="ln" />
      <g className="actuator" style={{ transform: `translate(${n3(cx + kx)}px,0px)` }}>
        <rect x={-1.1} y={-1.45} width={2.2} height={2.9} rx={0.35} className="f-black-face" />
        <path d="M-0.5 -0.9V0.9M0.5 -0.9V0.9" className="ln-soft" />
        <rect x={-1.1} y={-1.45} width={2.2} height={2.9} rx={0.35} className="ln" />
      </g>
    </g>
  );
}

function Lever({ x, z, to, len, w, tip }: { x: number; z: number; to: number; len: number; w: number; tip: number }) {
  // The lever leans toward the side the common contact joins (thrown to b leans +x), as in the 3D view.
  const L = to * len;
  return (
    <g className="actuator" style={{ transform: `translate(${n3(x)}px,${n3(z)}px)` }}>
      <path d={`M0 0L${n3(L)} 0`} className="edge" style={{ ["--w" as string]: `${w}px` }} />
      <path d={`M0 0L${n3(L)} 0`} className="core" style={{ ["--w" as string]: `${w}px`, stroke: "var(--k-metal-hi)" }} />
      <circle cx={n3(L)} cy={0} r={tip} className="f-metal-hi ln" />
    </g>
  );
}

function ToggleSwitch({ pi }: DrawProps<"toggle-switch">) {
  const rot = pi.f.rot;
  const toB = pi.part.params.to === "b";
  if (pi.part.params.base) {
    const B = TOGGLE_BASE;
    const L = localLegs(pi);
    const tag = pi.part.params.tag;
    return (
      <g>
        <rect x={-B.w / 2 + 1} y={-B.d / 2 + 1.3} width={B.w} height={B.d} rx={2.4} className="f-shade" />
        <rect x={-B.w / 2} y={-B.d / 2} width={B.w} height={B.d} rx={2.4} className="f-wood" />
        <path d={`M${-B.w / 2 + 3} -9C-8 -10 6 -8 ${B.w / 2 - 3} -9.6M${-B.w / 2 + 4} 3C-4 2 9 4 ${B.w / 2 - 4} 2.6M${-B.w / 2 + 3} 12.4C-6 11.6 8 13 ${B.w / 2 - 3} 12`} className="ln-soft" />
        <rect x={-B.w / 2} y={-B.d / 2} width={B.w} height={B.d} rx={2.4} className="ln" />
        <rect x={-15.5} y={B.switchZ - 6.2} width={31} height={12.4} rx={1.4} className="f-black" />
        <Upright x={-11.6} z={B.switchZ} rot={rot} fontSize={3} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light" opacity={toB ? 0.45 : 1}>
          OFF
        </Upright>
        <Upright x={11.6} z={B.switchZ} rot={rot} fontSize={3} fontWeight={700} textAnchor="middle" dominantBaseline="central" className="print-light" opacity={toB ? 1 : 0.45}>
          ON
        </Upright>
        <circle cx={0} cy={B.switchZ} r={3.6} className="f-metal ln" />
        <Lever x={0} z={B.switchZ} to={toB ? 1 : -1} len={6.4} w={2.4} tip={1.8} />
        {Object.values(L).map(([x, z]) => (
          <g key={x}>
            <circle cx={n3(x)} cy={n3(z)} r={3.2} className="f-brass ln" />
            <path d={`M${n3(x - 1.9)} ${n3(z + 1.1)}L${n3(x + 1.9)} ${n3(z - 1.1)}`} className="ln-thin" />
          </g>
        ))}
        {tag && (
          <Upright x={-B.w / 2 + 2.6} z={-B.d / 2 + 3} rot={rot} fontSize={3} fontWeight={700} dominantBaseline="central" className="print-light">
            {tag}
          </Upright>
        )}
      </g>
    );
  }
  const T = TOGGLE;
  const cx = pi.mount === "board" ? 2 * P : 0;
  return (
    <g>
      <rect x={n3(cx - T.len / 2)} y={-T.wid / 2} width={T.len} height={T.wid} rx={0.6} className="f-black" />
      <rect x={n3(cx - T.len / 2)} y={-T.wid / 2} width={T.len} height={T.wid} rx={0.6} className="ln" />
      <circle cx={n3(cx)} cy={0} r={T.bushingDia / 2} className="f-metal ln" />
      <Lever x={cx} z={0} to={toB ? 1 : -1} len={5} w={1.5} tip={1.25} />
    </g>
  );
}

const CAP_FILL: Record<string, string> = {
  black: "var(--k-black-face)",
  red: "var(--k-led-red)",
  blue: "var(--k-led-blue)",
  yellow: "var(--k-led-yellow)",
  white: "var(--k-slip)",
};

function Pushbutton({ pi, pressed }: DrawProps<"pushbutton">) {
  if (pi.part.params.base) {
    return (
      <TerminalBlock pi={pi} plateW={22}>
        <BigButton cap={CAP_FILL[pi.part.params.cap ?? "black"] ?? CAP_FILL.black!} pressed={pressed} />
      </TerminalBlock>
    );
  }
  const board = pi.mount === "board";
  const cx = board ? P : 0;
  const cz = board ? -1.5 * P : 0;
  const B = PUSHBUTTON;
  const h = B.body / 2;
  const L = localLegs(pi);
  const cap = CAP_FILL[pi.part.params.cap ?? "black"] ?? CAP_FILL.black!;
  const r = B.capDia / 2 + 0.25;
  return (
    <g>
      {(["a1", "b1", "a2", "b2"] as const).map((leg) => {
        const p = L[leg]!;
        const edge: Vec2 = [p[0], p[1] > cz ? cz + h - 0.3 : cz - h + 0.3];
        return <Lead key={leg} a={edge} b={p} hole={board ? "b" : undefined} />;
      })}
      <rect x={cx - h} y={cz - h} width={B.body} height={B.body} rx={0.5} className="f-black" />
      <rect x={cx - h + 0.55} y={cz - h + 0.55} width={B.body - 1.1} height={B.body - 1.1} rx={0.3} className="f-metal" />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <circle key={`${sx}${sz}`} cx={cx + sx * 2.05} cy={cz + sz * 2.05} r={0.36} className="f-metal-hi ln-thin" />))}
      <rect x={cx - h} y={cz - h} width={B.body} height={B.body} rx={0.5} className="ln" />
      <g className="actuator" style={{ transform: `translate(${n3(cx)}px,${n3(cz)}px) scale(${pressed ? 0.86 : 1})` }}>
        {pressed && <circle r={n3(r + 0.45)} className="f-ink" opacity={0.3} />}
        <circle r={n3(r)} style={{ fill: cap }} />
        {!pressed && <path d={`M${n3(-r * 0.55)} ${n3(-r * 0.45)}A${n3(r * 0.7)} ${n3(r * 0.7)} 0 0 1 ${n3(r * 0.35)} ${n3(-r * 0.62)}`} className="sheen" />}
        <circle r={n3(r)} className="ln" />
      </g>
    </g>
  );
}

function Relay({ pi, st }: DrawProps<"relay">) {
  const params = pi.part.params;
  const poles = params.poles === 1 ? 1 : 2;
  const opaque = !!params.mystery && !params.peek;
  if (params.base) {
    return (
      <TerminalBlock pi={pi}>
        <RelayTop arm={relayArmature(st)} poles={poles} opaque={opaque} dead={health(st) === "dead"} rot={pi.f.rot} />
      </TerminalBlock>
    );
  }
  const board = pi.mount === "board";
  // Footprint frame: coil1 at the origin on the board; centred on the desk.
  const ox = board ? 0 : -3.5 * P;
  const oz = board ? 0 : 1.5 * P;
  const R = RELAY;
  const cx = ox + 3.5 * P;
  const cz = oz - 1.5 * P;
  const arm = relayArmature(st);
  const dead = health(st) === "dead";
  // One changeover per row of pins (com at 3 pitches, nc at 5, no at 7). The blade pivots over com and rests on the
  // NC contact; pulled in, it swings across to NO.
  const pole = (row: 0 | 1) => {
    const z0 = oz + (row === 0 ? 0 : -3 * P);
    const inward = row === 0 ? -1 : 1;
    const zLine = z0 + inward * 2.2;
    const pivot: Vec2 = [ox + 3 * P, zLine];
    const nc: Vec2 = [ox + 6 * P, zLine - inward * 1.3];
    const no: Vec2 = [ox + 6 * P, zLine + inward * 1.3];
    const tip: Vec2 = [nc[0] + (no[0] - nc[0]) * arm, nc[1] + (no[1] - nc[1]) * arm];
    const ncPin: Vec2 = [ox + 5 * P, z0];
    const noPin: Vec2 = [ox + 7 * P, z0];
    return (
      <g key={row}>
        <path d={`M${n3(nc[0])} ${n3(nc[1])}L${n3(ncPin[0] + 0.6)} ${n3(ncPin[1] + inward * 0.6)}M${n3(no[0])} ${n3(no[1])}L${n3(noPin[0] - 0.6)} ${n3(noPin[1] + inward * 0.6)}`} className="ln-faint" />
        <path d={`M${n3(pivot[0])} ${n3(z0 + inward * 0.6)}V${n3(pivot[1])}`} className="ln-faint" />
        <circle cx={n3(nc[0] + 0.35)} cy={n3(nc[1])} r={0.42} className="f-metal ln-thin" />
        <circle cx={n3(no[0] + 0.35)} cy={n3(no[1])} r={0.42} className="f-metal ln-thin" />
        <path d={`M${n3(pivot[0])} ${n3(pivot[1])}L${n3(tip[0])} ${n3(tip[1])}`} className="edge" style={{ ["--w" as string]: "0.55px" }} />
        <path d={`M${n3(pivot[0])} ${n3(pivot[1])}L${n3(tip[0])} ${n3(tip[1])}`} className="core" style={{ ["--w" as string]: "0.55px", stroke: "var(--k-copper)" }} />
        <circle cx={n3(pivot[0])} cy={n3(pivot[1])} r={0.5} className="f-ink" />
      </g>
    );
  };
  const coilX0 = ox - 0.4;
  const coilX1 = ox + 2 * P + 0.4;
  const winds: number[] = [];
  for (let x = coilX0 + 0.6; x < coilX1 - 0.3; x += 0.75) winds.push(x);
  const armX = coilX1 + 0.5 + (1 - arm) * 0.9;
  return (
    <g>
      <rect x={n3(cx - R.len / 2)} y={n3(cz - R.wid / 2)} width={R.len} height={R.wid} rx={0.8} className="f-relay" />
      <rect x={n3(coilX0)} y={n3(cz - 2.4)} width={n3(coilX1 - coilX0)} height={4.8} rx={0.5} className="f-copper" />
      {winds.map((x) => (
        <path key={x} d={`M${n3(x)} ${n3(cz - 2.3)}V${n3(cz + 2.3)}`} className="ln-soft" />
      ))}
      <rect x={n3(coilX0)} y={n3(cz - 2.4)} width={n3(coilX1 - coilX0)} height={4.8} rx={0.5} className="ln-thin" />
      <rect x={n3(armX)} y={n3(cz - 3.3)} width={0.9} height={6.6} rx={0.3} className="f-metal ln-thin" />
      {pole(0)}
      {poles === 2 && pole(1)}
      {opaque && <rect x={n3(cx - R.len / 2)} y={n3(cz - R.wid / 2)} width={R.len} height={R.wid} rx={0.8} className="f-black" />}
      {dead && <rect x={n3(coilX0)} y={n3(cz - 2.4)} width={n3(coilX1 - coilX0)} height={4.8} className="f-scorch" opacity={0.7} />}
      <rect x={n3(cx - R.len / 2)} y={n3(cz - R.wid / 2)} width={R.len} height={R.wid} rx={0.8} className="ln" />
    </g>
  );
}

function Fuse({ pi, st }: DrawProps<"fuse">) {
  const id = useDefs();
  const blown = health(st) === "dead" || st?.extra?.["blown"] === true;
  const board = pi.mount === "board";
  const k = board ? 1 : 1.3;
  const c = board ? 2 * P : 0;
  const len = FUSE.len * k;
  const dia = FUSE.dia * k;
  const cap = FUSE.capLen * k;
  const rot = pi.f.rot;
  const L = localLegs(pi);
  const glass = { x: n3(c - len / 2 + cap - 0.2), w: n3(len - cap * 2 + 0.4) };
  const wire = blown
    ? `M${n3(c - len / 2 + cap)} 0Q${n3(c - len * 0.15)} ${n3(-dia * 0.2)} ${n3(c - len * 0.06)} ${n3(dia * 0.08)}M${n3(c + len * 0.07)} ${n3(-dia * 0.06)}Q${n3(c + len * 0.18)} ${n3(dia * 0.22)} ${n3(c + len / 2 - cap)} 0`
    : `M${n3(c - len / 2 + cap)} 0C${n3(c - len * 0.12)} ${n3(-dia * 0.28)} ${n3(c + len * 0.12)} ${n3(dia * 0.28)} ${n3(c + len / 2 - cap)} 0`;
  return (
    <g>
      {!board && (
        <>
          <rect x={-17.5} y={-6} width={35} height={12} rx={1.6} className="f-sunk" />
          <rect x={-17.5} y={-6} width={35} height={12} rx={1.6} className="ln-thin" />
          {[L.a!, L.b!].map((p, i) => (
            <g key={i}>
              <Lead a={[p[0] < 0 ? c - len / 2 + 0.6 : c + len / 2 - 0.6, 0]} b={p} />
              <circle cx={n3(p[0])} cy={n3(p[1])} r={1.9} className="f-metal ln" />
            </g>
          ))}
        </>
      )}
      {board &&
        [0, 4 * P].map((x) => (
          <g key={x}>
            <rect x={x - 0.75} y={n3(-dia / 2 - 0.55)} width={1.5} height={n3(dia + 1.1)} rx={0.3} className="f-metal ln-thin" />
            <HoleDot at={[x, 0]} />
          </g>
        ))}
      <rect x={glass.x} y={n3(-dia / 2)} width={glass.w} height={n3(dia)} className="f-glass" />
      {blown && <ellipse cx={n3(c)} cy={0} rx={n3(len * 0.18)} ry={n3(dia * 0.42)} fill={`url(#${id}-smudge)`} />}
      <path d={wire} className="ln-thin" />
      <rect x={glass.x} y={n3(-dia / 2)} width={glass.w} height={n3(dia)} className="ln-thin" />
      {[c - len / 2, c + len / 2 - cap].map((x) => (
        <rect key={x} x={n3(x)} y={n3(-dia / 2 - 0.1)} width={n3(cap)} height={n3(dia + 0.2)} rx={0.5} className="f-metal ln" />
      ))}
      <Upright x={c - len / 2 + cap / 2} z={0.05} rot={rot} fontSize={board ? 1.3 : 2} fontWeight={600} textAnchor="middle" dominantBaseline="central" className="print lod2">
        {`${pi.part.params.amps}A`}
      </Upright>
    </g>
  );
}

function DpdtSwitch({ pi }: DrawProps<"dpdt-switch">) {
  return (
    <TerminalBlock pi={pi}>
      <BigSlider to={pi.part.params.to} length={30} />
    </TerminalBlock>
  );
}

const BLOCK_Z = BLOCK.deviceZ;

export const CONTROLS: InkRegistry = {
  trimmer: {
    box: (p, c) => {
      if (isBlock(p)) return blockBox(p);
      const h = TRIMMER.size / 2;
      return c.mount === "board" ? [P - h, -h, P + h, h] : [-h, -h, h, h];
    },
    actuator: (p, c) => (isBlock(p) ? { type: "rotor", x: 0, z: BLOCK_Z, r: 7.5 } : { type: "rotor", x: c.mount === "board" ? P : 0, z: 0, r: TRIMMER.rotorDia / 2 + 0.6 }),
    Draw: Trimmer,
  },
  "slide-switch": {
    box: (p, c) => (isBlock(p) ? blockBox(p) : c.mount === "board" ? [P - SLIDE.len / 2, -SLIDE.wid / 2, P + SLIDE.len / 2, SLIDE.wid / 2] : [-SLIDE.len / 2, -SLIDE.wid / 2, SLIDE.len / 2, SLIDE.wid / 2]),
    actuator: (p, c) => (isBlock(p) ? { type: "flip", x: 0, z: BLOCK_Z, r: 12 } : { type: "flip", x: c.mount === "board" ? P : 0, z: 0, r: SLIDE.len / 2 }),
    Draw: SlideSwitch,
  },
  "toggle-switch": {
    box: (p, c) => {
      if (p.params.base) return [-TOGGLE_BASE.w / 2, -TOGGLE_BASE.d / 2, TOGGLE_BASE.w / 2, TOGGLE_BASE.d / 2];
      const cx = c.mount === "board" ? 2 * P : 0;
      return [cx - TOGGLE.len / 2, -TOGGLE.wid / 2, cx + TOGGLE.len / 2, TOGGLE.wid / 2];
    },
    actuator: (p, c) =>
      p.params.base ? { type: "flip", x: 0, z: TOGGLE_BASE.switchZ, r: 9.5 } : { type: "flip", x: c.mount === "board" ? 2 * P : 0, z: 0, r: TOGGLE.bushingDia / 2 + 2 },
    Draw: ToggleSwitch,
    layer: 0,
  },
  pushbutton: {
    box: (p, c) => {
      if (isBlock(p)) return blockBox(p);
      const h = PUSHBUTTON.body / 2;
      return c.mount === "board" ? [P - h, -1.5 * P - h, P + h, -1.5 * P + h] : [-h, -h, h, h];
    },
    actuator: (p, c) =>
      isBlock(p) ? { type: "press", x: 0, z: BLOCK_Z, r: 7 } : { type: "press", x: c.mount === "board" ? P : 0, z: c.mount === "board" ? -1.5 * P : 0, r: PUSHBUTTON.capDia / 2 + 0.9 },
    Draw: Pushbutton,
  },
  relay: {
    box: (p, c) => {
      if (isBlock(p)) return blockBox(p);
      const hx = RELAY.len / 2;
      const hz = RELAY.wid / 2;
      return c.mount === "board" ? [3.5 * P - hx, -1.5 * P - hz, 3.5 * P + hx, -1.5 * P + hz] : [-hx, -hz, hx, hz];
    },
    Draw: Relay,
  },
  "dpdt-switch": { box: (p) => blockBox(p), actuator: () => ({ type: "flip", x: 0, z: BLOCK_Z, r: 14 }), Draw: DpdtSwitch, layer: 0 },
  fuse: {
    box: (_p, c) => (c.mount === "board" ? [2 * P - FUSE.len / 2, -FUSE.dia / 2 - 0.6, 2 * P + FUSE.len / 2, FUSE.dia / 2 + 0.6] : [-17.5, -6, 17.5, 6]),
    Draw: Fuse,
  },
};
