// A circuit drawing on the bench (a `schematic` card), as a paper slip a host can dock beside the bench: while a phone
// is framed close on the breadboard to build from the drawing, the drawing stays legible. Drawn from the same symbols
// and slots as both views draw the card, the torn piece in its gap once it is in. No three.js, no ink renderer.

import { schematicSlot } from "../parts";
import { SCHEM } from "../dims";
import { heldOf } from "../seats";
import { slotTurn, symbolInk, tornOutline } from "../symbols";
import type { BenchState, SymbolKind } from "../types";

const n3 = (v: number) => Math.round(v * 1000) / 1000;

function SymbolMark({ kind, x, z, turn, text, k }: { kind: SymbolKind; x: number; z: number; turn: number; text?: string; k: number }) {
  const s = symbolInk(kind);
  const side = Math.abs(Math.sin((turn * Math.PI) / 180)) > 0.5;
  return (
    <g>
      <g transform={`translate(${n3(x)} ${n3(z)}) rotate(${n3(turn)})`}>
        {s.fill && <path d={s.fill} fill="currentColor" stroke="none" />}
        <path d={s.stroke} fill="none" />
        {s.thin && <path d={s.thin} fill="none" strokeWidth={0.6 / k} />}
      </g>
      {text && (
        // Print that reads at the slip's size, whatever the card's.
        <text x={n3(x + (side ? 9 : 0))} y={n3(z + (side ? 0 : -8.5))} fontSize={n3(12 / k)} fontWeight={600} textAnchor={side ? "start" : "middle"} dominantBaseline="central" fill="currentColor" stroke="none">
          {text}
        </text>
      )}
    </g>
  );
}

/** The drawing on the card `id`, `width` CSS px wide (its height follows the card's shape). */
export function DrawingSlip({ bench, id, width = 168, title }: { bench: BenchState; id: string; width?: number; title?: string }) {
  const card = bench.parts.find((p) => p.id === id);
  if (card?.kind !== "schematic") return null;
  const p = card.params;
  const n = p.symbols.length;
  const k = width / SCHEM.w;
  const height = SCHEM.d * k;
  const W = SCHEM.loopW / 2;
  const D = SCHEM.loopD / 2;
  const z0 = 4;
  const slots = p.symbols.map((_, i) => schematicSlot(n, i));
  const held = heldOf(card)["torn"];
  const piece = held ? bench.parts.find((x) => x.id === held && x.kind === "piece") : undefined;
  // The loop, broken where each symbol sits (the symbols' own leads close the gaps).
  const corners: [number, number][] = [
    [-W, z0 - D],
    [W, z0 - D],
    [W, z0 + D],
    [-W, z0 + D],
  ];
  const sides: string[] = [];
  corners.forEach((a, c) => {
    const b = corners[(c + 1) % 4]!;
    const along = a[0] === b[0] ? 1 : 0;
    const dir = Math.sign(b[along]! - a[along]!);
    const cuts = slots
      .filter(([x, z]) => (along ? Math.abs(x - a[0]) < 0.01 && (z - a[1]) * (z - b[1]) < 0 : Math.abs(z - a[1]) < 0.01 && (x - a[0]) * (x - b[0]) < 0))
      .map(([x, z]) => (along ? z : x))
      .sort((u, v) => (u - v) * dir);
    let cur = a[along]!;
    for (const cut of [...cuts, null]) {
      const stop = cut === null ? b[along]! : cut - dir * 12;
      sides.push(along ? `M${a[0]} ${n3(cur)}V${n3(stop)}` : `M${n3(cur)} ${a[1]}H${n3(stop)}`);
      if (cut !== null) cur = cut + dir * 12;
    }
  });
  const torn = p.torn !== undefined ? slots[p.torn] : undefined;
  return (
    <figure className="ohb-drawing-slip" data-drawing-slip={id} aria-label={title ?? p.title ?? id} style={{ margin: 0, width, color: "var(--ink, #24221E)" }}>
      <svg width={width} height={height} viewBox={`${-SCHEM.w / 2} ${-SCHEM.d / 2} ${SCHEM.w} ${SCHEM.d}`} aria-hidden="true" style={{ display: "block" }}>
        <g stroke="currentColor" strokeWidth={n3(1.4 / k)} strokeLinecap="round" strokeLinejoin="round">
          {p.title && (
            <text x={-SCHEM.w / 2 + 5} y={-SCHEM.d / 2 + 7} fontSize={n3(11 / k)} fontWeight={600} fill="currentColor" stroke="none" dominantBaseline="central">
              {p.title}
            </text>
          )}
          <path d={sides.join("")} fill="none" />
          {p.symbols.map((sym, i) => (i === p.torn ? null : <SymbolMark key={i} kind={sym.kind} x={slots[i]![0]} z={slots[i]![1]} turn={slotTurn(n, i)} text={sym.text} k={k} />))}
          {torn &&
            (piece?.kind === "piece" ? (
              <SymbolMark kind={piece.params.symbol} x={torn[0]} z={torn[1]} turn={piece.params.turn ?? 0} k={k} />
            ) : (
              <path
                d={`${tornOutline(torn[0], torn[1], SCHEM.piece)
                  .map(([x, z], i) => `${i ? "L" : "M"}${n3(x)} ${n3(z)}`)
                  .join("")}Z`}
                fill="none"
                strokeDasharray={`${n3(3 / k)} ${n3(3 / k)}`}
                opacity={0.6}
              />
            ))}
        </g>
      </svg>
    </figure>
  );
}
