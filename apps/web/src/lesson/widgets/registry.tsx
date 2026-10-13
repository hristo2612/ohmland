import { lazy, Suspense, type ComponentType } from "react";
import { Skeleton } from "../../components/Skeleton";
import { m } from "../../i18n";
import type { WidgetKind } from "./kinds";

export type WidgetProps = { props: Record<string, unknown> };

/** Each widget is its own lazy chunk; an explain card that has none loads nothing extra. */
const WIDGETS: Record<WidgetKind, ComponentType<WidgetProps>> = {
  "ohms-law": lazy(() => import("./OhmsLaw")),
  "resistor-explorer": lazy(() => import("./ResistorExplorer")),
};

export function Widget({ kind, props }: { kind: WidgetKind; props: Record<string, unknown> }) {
  const W = WIDGETS[kind];
  return (
    <Suspense
      fallback={
        <div className="widget widget--loading" role="status" aria-label={m.widgets.loading}>
          <Skeleton height={180} />
        </div>
      }
    >
      <W props={props} />
    </Suspense>
  );
}
