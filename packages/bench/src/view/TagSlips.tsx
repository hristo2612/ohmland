// Readable tags on a small screen, for both views: a tag's words drawn on the bench are a few pixels tall on a phone,
// so a tag that is spotlit (a beat about it) or selected also shows its text on a paper slip above it, at a size that
// reads. They follow the view without re-rendering, like the other overlays.

import { memo, useEffect, useRef } from "react";
import { useStore } from "zustand";
import type { BenchStore } from "../store";
import type { ScreenPoint } from "./controller";

/** Projects a target to the bench element (CSS px) and tells when the view moves. */
export type SlipProjector = { project(target: string): ScreenPoint | null; onViewChange(cb: () => void): () => void };

const SLIP: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  padding: "2px 8px",
  background: "var(--paper-slip, #FCFAF5)",
  border: "1px solid var(--rule-soft, #D8D0C1)",
  boxShadow: "2px 2px 0 var(--shadow-ink, #E1D9CA)",
  color: "var(--ink, #24221E)",
  font: "600 15px/20px var(--font-serif, Georgia, serif)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  visibility: "hidden",
};

/** The slips: one per tag that is spotlit (`spot`, raw targets such as "part:L3") or selected. Only when `compact`. */
export function TagSlips({ store, spot, compact, projector }: { store: BenchStore; spot: readonly string[] | null; compact: boolean; projector: SlipProjector }) {
  const parts = useStore(store, (s) => s.bench.parts);
  const sel = useStore(store, (s) => s.ui.selection);
  if (!compact) return null;
  const wanted = new Set<string>();
  for (const t of spot ?? []) if (t.startsWith("part:") && !t.includes("/")) wanted.add(t.slice(5));
  if (sel?.type === "part") wanted.add(sel.id);
  const tags = parts.filter((p) => p.kind === "tag" && wanted.has(p.id) && typeof (p.params as { text?: unknown }).text === "string");
  if (!tags.length) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {tags.map((p) => (
        <Slip key={p.id} id={p.id} text={(p.params as { text: string }).text} projector={projector} />
      ))}
    </div>
  );
}

const Slip = memo(function Slip({ id, text, projector }: { id: string; text: string; projector: SlipProjector }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = () => {
      const el = ref.current;
      const p = projector.project(`part:${id}`);
      if (!el) return;
      el.style.visibility = p && p.visible ? "visible" : "hidden";
      if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, calc(-100% - 14px))`;
    };
    place();
    return projector.onViewChange(place);
  }, [projector, id]);
  return (
    <div ref={ref} style={SLIP} data-tag-slip={id}>
      {text}
    </div>
  );
});
