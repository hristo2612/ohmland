import { ICONS, type IconName } from "./icons";

export type IconProps = { name: IconName; size?: number; className?: string; strokeWidth?: number };

/** A decorative stroke icon. Meaning always comes from the text or accessible name of the control around it. */
export function Icon({ name, size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
