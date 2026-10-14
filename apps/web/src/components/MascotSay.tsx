import type { ReactNode } from "react";
import { m } from "../i18n";
import { Mascot } from "../mascot/Mascot";
import type { MascotPose } from "../mascot/sprite";

/**
 * The robot in the margin with its line in red pencil. The line is read as part of the page (named for screen
 * readers); the robot itself is decoration.
 */
export function MascotSay({ pose = "idle", size = 64, children, className }: { pose?: MascotPose; size?: number; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `say ${className}` : "say"}>
      <Mascot pose={pose} size={size} />
      <p className="say__bubble">
        <span className="sr-only">{m.mascot.says(m.mascot.name)}: </span>
        {children}
      </p>
    </div>
  );
}
