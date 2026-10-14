import { useId } from "react";
import type { MascotPose } from "./sprite";
import "./mascot.css";

export type { MascotPose } from "./sprite";

export type MascotProps = {
  pose?: MascotPose;
  /** Rendered height in px; the robot is three quarters as wide. */
  size?: number;
  /** Kept for callers; the robot no longer moves on its own (motion only explains a change). */
  animate?: boolean;
  /** An accessible name. Without one the mascot is decoration and hidden from screen readers. */
  label?: string;
  className?: string;
};

/** The drawing's own box: everything below is in these units. */
const W = 112;
const H = 152;

function Eyes({ pose }: { pose: MascotPose }) {
  if (pose === "happy" || pose === "celebrate")
    return (
      <g className="mascot__eyes mascot__eyes--arc">
        <path d="M37.5 62q5.5-8 11 0" />
        <path d="M63.5 62q5.5-8 11 0" />
      </g>
    );
  if (pose === "oops")
    return (
      <g className="mascot__eyes">
        <circle cx="43" cy="63" r="4" />
        <circle cx="69" cy="63" r="4" />
        <path className="mascot__brow" d="M35.5 56L48 50M76.5 56L64 50" />
      </g>
    );
  if (pose === "thinking")
    return (
      <g className="mascot__eyes">
        <circle cx="47" cy="55" r="4.2" />
        <circle cx="73" cy="55" r="4.2" />
      </g>
    );
  return (
    <g className="mascot__eyes">
      <circle cx="43" cy="59" r="4.6" />
      <circle cx="69" cy="59" r="4.6" />
    </g>
  );
}

/**
 * The Ohmland robot, drawn in ink like everything else in the notebook: 2 px outlines at every size (1.5 px when it is
 * small), hatched side faces, a graphite visor and amber eyes.
 */
export function Mascot({ pose = "idle", size = 64, label, className }: MascotProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hatch = `mh-${id}`;
  const copper = `mc-${id}`;
  const small = size < 48;
  const width = Math.round((size * W) / H);
  const cls = ["mascot", `mascot--${pose}`, small && "mascot--small", className].filter(Boolean).join(" ");
  const shade = small ? undefined : `url(#${hatch})`;
  return (
    <svg
      className={cls}
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      height={size}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    >
      {!small && (
        <defs>
          <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0V5" className="mascot__hatch" />
          </pattern>
          <pattern id={copper} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <path d="M0 0V4" className="mascot__hatch-copper" />
          </pattern>
        </defs>
      )}
      <ellipse className="mascot__shadow" cx="58" cy="143" rx="27" ry="4.5" />
      {!small && <circle className="mascot__halo" cx="62" cy="10" r="8.5" />}
      {pose === "celebrate" && <path className="mascot__rays" d="M62 -6V-13M47 1l-6-5M77 1l6-5" />}
      <path className="mascot__line" d="M62 29.5V14.5" />
      <circle className="mascot__tip" cx="62" cy="10" r="4.6" />
      {/* arms */}
      <path className="mascot__ink" d="M27 95h7v21h-7z" />
      <path className="mascot__ink" d="M84.5 93.5h7v20h-7z" />
      {shade && <path d="M84.5 93.5h7v20h-7z" fill={shade} />}
      {/* neck and body */}
      <path className="mascot__ink" d="M52 84h20v8H52z" />
      <path className="mascot__ink" d="M78 91l7.5-5.5v35L78 126z" />
      {shade && <path d="M78 91l7.5-5.5v35L78 126z" fill={shade} />}
      <path className="mascot__ink" d="M34 91h44v35H34z" />
      <path className="mascot__plate" d="M43 98h26v19H43z" />
      {!small && <path d="M43 98h26v19H43z" fill={`url(#${copper})`} />}
      <path className="mascot__plate-edge" d="M43 98h26v19H43z" />
      {/* head */}
      <path className="mascot__ink" d="M24 34l12-9h64l-12 9z" />
      <path className="mascot__ink" d="M88 34l12-9v51l-12 9z" />
      {shade && <path d="M88 34l12-9v51l-12 9z" fill={shade} />}
      <path className="mascot__ink" d="M24 34h64v51H24z" />
      <rect className="mascot__visor" x="30" y="43" width="52" height="32" rx="3" />
      <Eyes pose={pose} />
    </svg>
  );
}
