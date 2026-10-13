import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

export type BadgeTone = "neutral" | "accent" | "good" | "bad" | "info" | "solid" | "outline";

export function Badge({ tone = "neutral", icon, className, children }: { tone?: BadgeTone; icon?: IconName; className?: string; children: ReactNode }) {
  const cls = ["badge", tone !== "neutral" && `badge--${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      {icon && <Icon name={icon} size={14} strokeWidth={2} />}
      {children}
    </span>
  );
}
