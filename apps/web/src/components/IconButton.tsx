import type { AriaAttributes, MouseEvent, Ref } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

export type IconButtonProps = {
  /** Required accessible name: an icon alone never explains itself to a screen reader. */
  label: string;
  icon: IconName;
  variant?: "plain" | "outline" | "soft" | "primary";
  size?: "small" | "regular";
  pressed?: boolean;
  href?: string;
  disabled?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
  onClick?(e: MouseEvent<HTMLElement>): void;
} & Pick<AriaAttributes, "aria-describedby" | "aria-expanded" | "aria-haspopup" | "aria-controls" | "aria-current">;

export function IconButton({ label, icon, variant = "plain", size = "regular", pressed, href, disabled, className, ref, onClick, ...aria }: IconButtonProps) {
  const cls = ["icon-btn", variant !== "plain" && `icon-btn--${variant}`, size === "small" && "icon-btn--small", className].filter(Boolean).join(" ");
  const glyph = <Icon name={icon} size={size === "small" ? 18 : 20} />;
  if (href !== undefined)
    return (
      <a href={href} className={cls} aria-label={label} title={label} onClick={onClick} {...aria}>
        {glyph}
      </a>
    );
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      {...aria}
    >
      {glyph}
    </button>
  );
}
