import type { CSSProperties } from "react";

/** A loading placeholder that keeps the space of what is coming, so nothing jumps when it arrives. */
export function Skeleton({ width, height, shape = "block", className }: { width?: CSSProperties["width"]; height?: CSSProperties["height"]; shape?: "block" | "text" | "circle"; className?: string }) {
  const cls = ["skeleton", shape !== "block" && `skeleton--${shape}`, className].filter(Boolean).join(" ");
  return <span className={cls} style={{ width, height }} aria-hidden="true" />;
}
