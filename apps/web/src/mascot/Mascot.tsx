import { mascotLayers, toPaths, type Grid, type MascotPose } from "./sprite";
import "./mascot.css";

export type MascotProps = {
  pose?: MascotPose;
  /** Rendered size in px. Multiples of 32 keep every pixel whole. */
  size?: number;
  /** Gentle hover bob and thruster flicker (off under reduced motion). */
  animate?: boolean;
  /** An accessible name. Without one the mascot is decoration and hidden from screen readers. */
  label?: string;
  className?: string;
};

function Layer({ grid, className }: { grid: Grid; className?: string }) {
  return (
    <g className={className}>
      {toPaths(grid).map(({ token, d }) => (
        <path key={token} d={d} style={{ fill: `var(${token})` }} />
      ))}
    </g>
  );
}

/** The mascot, crisp at any multiple of 32 px. */
export function Mascot({ pose = "idle", size = 64, animate = true, label, className }: MascotProps) {
  const layers = mascotLayers(pose);
  const cls = ["mascot", `mascot--${pose}`, animate && "mascot--animate", className].filter(Boolean).join(" ");
  return (
    <svg
      className={cls}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    >
      <g className="mascot__hover">
        <Layer grid={layers.flame} className="mascot__flame" />
        <Layer grid={layers.body} />
        <Layer grid={layers.face} className={layers.blink ? "mascot__eyes" : undefined} />
        {layers.blink && <Layer grid={layers.blink} className="mascot__blink" />}
      </g>
      <Layer grid={layers.fx} className="mascot__fx" />
    </svg>
  );
}
