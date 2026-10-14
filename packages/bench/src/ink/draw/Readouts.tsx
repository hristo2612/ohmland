// Lab readouts over parts, as small paper tags: an LED's stress bar (its current as a share of its maximum) and a
// part's temperature with a touch-feel word. They follow the camera without re-rendering and read the store.

import { memo, useCallback } from "react";
import { useStore } from "zustand";
import type { BenchStore, BenchStoreState, InspectSpec } from "../../store";
import type { BenchState, PlacedPart } from "../../types";
import type { InkLabels } from "../labels";
import { partBounds, type InkModel } from "../model";
import { useFollow } from "../Overlay";
import type { InkView } from "../view";
import { STRESS_MARK, stressPoint } from "../../view/targets";

function covered(bench: BenchState, spec: InspectSpec): PlacedPart[] {
  return bench.parts.filter((p) => spec.parts.includes(p.id) || spec.parts.includes(p.kind));
}

const stressOf = (s: BenchStoreState, id: string) => {
  const v = s.snapshot?.parts[id]?.extra?.["stress"];
  return typeof v === "number" ? v : 0;
};

function feel(temp: number): "cool" | "warm" | "hot" | "ouch" {
  return temp < 35 ? "cool" : temp < 50 ? "warm" : temp < 70 ? "hot" : "ouch";
}

/** Above the part, centred. */
function useAbove(view: InkView, model: InkModel, id: string) {
  const subscribe = useCallback((cb: () => void) => view.onChange(cb), [view]);
  return useFollow(subscribe, () => {
    const pi = model.parts.get(id);
    if (!pi) return null;
    const r = partBounds(pi);
    const [x, y] = view.toScreen((r[0] + r[2]) / 2, r[1]);
    return { x, y };
  });
}

/** At the stress bar's own mark (part:D1/stress), the same desk point as in 3D. */
function useStressMark(view: InkView, model: InkModel, id: string) {
  const subscribe = useCallback((cb: () => void) => view.onChange(cb), [view]);
  return useFollow(subscribe, () => {
    const pi = model.parts.get(id);
    if (!pi) return null;
    const [px, , pz] = stressPoint(model.bench, pi.part);
    const [x, y] = view.toScreen(px, pz);
    return { x, y };
  });
}

const Stress = memo(function Stress({ store, model, view, id, spotted }: { store: BenchStore; model: InkModel; view: InkView; id: string; spotted: boolean }) {
  const level = useStore(store, (s) => Math.round(Math.min(1, stressOf(s, id)) * 40) / 40);
  const dead = useStore(store, (s) => s.snapshot?.parts[id]?.health === "dead");
  const ref = useStressMark(view, model, id);
  const tone = dead ? "dead" : level >= 0.9 ? "high" : level >= 0.5 ? "mid" : "low";
  return (
    <div ref={ref} className="ohi-readout ohi-stress" data-tone={tone} data-spot={spotted || undefined} aria-hidden="true">
      <i style={{ width: `${(dead ? 1 : level) * 100}%` }} />
      <b style={{ left: "50%" }} />
      <b style={{ left: "90%" }} />
    </div>
  );
});

const Heat = memo(function Heat({ store, model, view, id, labels }: { store: BenchStore; model: InkModel; view: InkView; id: string; labels: InkLabels }) {
  const temp = useStore(store, (s) => Math.round(s.snapshot?.parts[id]?.temp ?? 25));
  const ref = useAbove(view, model, id);
  const f = feel(temp);
  return (
    <div ref={ref} className="ohi-readout ohi-heat" data-feel={f}>
      {`${temp} °C `}
      <em>{labels.heat[f]}</em>
    </div>
  );
});

export function Readouts({ store, model, view, labels, spot, compact }: { store: BenchStore; model: InkModel; view: InkView; labels: InkLabels; spot: readonly string[] | null; compact: boolean }) {
  const inspect = useStore(store, (s) => s.inspect);
  if (!inspect.length) return null;
  return (
    <div className="ohi-readouts" data-compact={compact || undefined} aria-hidden="false">
      {inspect.flatMap((spec) =>
        covered(model.bench, spec).map((p) =>
          spec.show === "stress" ? (
            <Stress key={`s:${p.id}`} store={store} model={model} view={view} id={p.id} spotted={!!spot?.includes(`part:${p.id}/${STRESS_MARK}`)} />
          ) : (
            <Heat key={`h:${p.id}`} store={store} model={model} view={view} id={p.id} labels={labels} />
          ),
        ),
      )}
    </div>
  );
}
