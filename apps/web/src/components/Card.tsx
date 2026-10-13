import type { ElementType, HTMLAttributes, ReactNode } from "react";

export type CardProps = {
  as?: ElementType;
  raised?: boolean;
  flat?: boolean;
  interactive?: boolean;
  padding?: "tight" | "regular" | "loose";
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

export function Card({ as: Tag = "div", raised, flat, interactive, padding = "regular", className, children, ...rest }: CardProps) {
  const cls = [
    "card",
    raised && "card--raised",
    flat && "card--flat",
    interactive && "card--interactive",
    padding !== "regular" && `card--${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
