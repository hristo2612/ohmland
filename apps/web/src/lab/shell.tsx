/** Pieces shared by the lab step and the free-build bench: the bench's error boundary, its skeleton, the fried card. */
import { Component, type ReactNode } from "react";
import { Icon } from "../components/Icon";
import { MascotSay } from "../components/MascotSay";
import { m } from "../i18n";
import type { FriedCard } from "./runtime";

/** Catches a 3D view that cannot start (no WebGL) and shows a calm notice instead. */
export class BenchBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { error: boolean }> {
  override state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  override componentDidCatch(err: unknown) {
    console.error(err);
  }
  override render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

export function BenchSkeleton() {
  return (
    <div className="lab__skeleton" role="status" aria-label={m.lab.loadingBench}>
      <span className="lab__spinner" aria-hidden="true" />
      <span className="small">{m.lab.loadingBench}</span>
    </div>
  );
}

export function FriedNotice({ card, onReplace, onDismiss }: { card: FriedCard; onReplace(): void; onDismiss(): void }) {
  return (
    <div className="fried-card" role="status" data-fried={card.partId}>
      <MascotSay pose="oops" size={40} className="fried-card__say">
        <strong className="fried-card__title">{m.lab.fried.title(card.shownLabel)}</strong>
        <span className="fried-card__hall">{m.lab.fried.hall}</span>
      </MascotSay>
      <p className="fried-card__why small">{card.event.message}</p>
      <div className="fried-card__actions">
        <button type="button" className="btn btn--small btn--secondary" onClick={onReplace} data-replace>
          <Icon name="retry" size={16} />
          {card.kind === "meter-fuse" ? m.lab.meter.replaceFuse : m.lab.fried.replace}
        </button>
        <button type="button" className="btn btn--small btn--tertiary" onClick={onDismiss}>
          {m.lab.fried.dismiss}
        </button>
      </div>
    </div>
  );
}

/** Markdown prompt as one line of plain text. */
export function plain(md: string): string {
  return md.replace(/\*\*|`|\*/g, "").replace(/\s+/g, " ").trim();
}
