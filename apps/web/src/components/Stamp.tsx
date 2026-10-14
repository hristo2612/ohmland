import { useId } from "react";
import { ICONS, type IconName } from "./icons";

export type StampProps = {
  icon: IconName;
  /** Text pressed around the ring, upper case (keep it under about 24 characters). */
  ring?: string;
  /** earned: red pencil, pressed in. todo: a dashed ring, still waiting. */
  state?: "earned" | "todo";
  size?: number;
  /** A stamp is never quite straight: a small tilt in degrees. */
  tilt?: number;
  /** Presses in once when it first appears (off under reduced motion). */
  press?: boolean;
  /** An accessible name; without one the stamp is decoration. */
  label?: string;
  className?: string;
};

/** A rubber stamp: a double ring, an icon in the middle and, when earned, words around the edge. */
export function Stamp({ icon, ring, state = "earned", size = 96, tilt = 0, press = false, label, className }: StampProps) {
  const id = `stamp-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const cls = ["stamp", state === "todo" && "stamp--todo", press && "stamp--press", className].filter(Boolean).join(" ");
  const text = state === "earned" ? ring : undefined;
  return (
    <svg
      className={cls}
      viewBox="0 0 96 96"
      width={size}
      height={size}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    >
      <circle className="stamp__ring" cx="48" cy="48" r="44" strokeWidth="4" />
      <circle className="stamp__ring-in" cx="48" cy="48" r={text ? 31 : 37} strokeWidth="1.5" />
      {text && (
        <>
          <path id={id} d="M48 48m-37.5 0a37.5 37.5 0 1 1 75 0a37.5 37.5 0 1 1-75 0" fill="none" />
          <text className="stamp__text" fontSize="9.5" dy="3.2">
            <textPath href={`#${id}`} startOffset="25%" textAnchor="middle">
              {text}
            </textPath>
          </text>
        </>
      )}
      <g
        className="stamp__ic"
        transform={text ? "translate(33 33) scale(1.25)" : "translate(28 28) scale(1.6667)"}
        strokeWidth={text ? 1.9 : 1.6}
        dangerouslySetInnerHTML={{ __html: ICONS[icon] }}
      />
    </svg>
  );
}
