import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "soft" | "tertiary" | "danger";
export type ButtonSize = "small" | "regular" | "large";

type Base = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconEnd?: IconName;
  block?: boolean;
  wrap?: boolean;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = Base &
  (
    | ({ href?: undefined; ref?: Ref<HTMLButtonElement> } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">)
    | ({ href: string; ref?: Ref<HTMLAnchorElement> } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">)
  );

/** Class list for a button, so Astro pages can style a plain link as a button without React. */
export function buttonClass(variant: ButtonVariant = "secondary", opts: { size?: ButtonSize; block?: boolean; wrap?: boolean; extra?: string | undefined } = {}) {
  return ["btn", `btn--${variant}`, opts.size && opts.size !== "regular" && `btn--${opts.size}`, opts.block && "btn--block", opts.wrap && "btn--wrap", opts.extra]
    .filter(Boolean)
    .join(" ");
}

/**
 * One primary action per view: primary is a decision, secondary is the default. Renders a link when given `href`.
 */
export function Button({ variant = "secondary", size = "regular", icon, iconEnd, block, wrap, className, children, ...rest }: ButtonProps) {
  const cls = buttonClass(variant, { size, block: !!block, wrap: !!wrap, extra: className });
  const iconSize = size === "large" ? 20 : 18;
  const inner = (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      <span>{children}</span>
      {iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </>
  );
  if (typeof rest.href === "string") {
    const { ref, ...a } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: Ref<HTMLAnchorElement> };
    return (
      <a ref={ref} {...a} className={cls}>
        {inner}
      </a>
    );
  }
  const { ref, ...b } = rest as ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> };
  return (
    <button ref={ref} type="button" {...b} className={cls}>
      {inner}
    </button>
  );
}
