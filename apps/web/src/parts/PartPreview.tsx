import { m } from "../i18n";
import type { PartIconKind } from "./kinds";
import { PartIcon } from "./PartIcon";

/**
 * The slot where a part's 3D model will spin (from packages/bench, loaded lazily). For now it shows the 2D drawing
 * on a little stage, with a note that the 3D view is coming.
 */
export function PartPreview({ kind, name, locked = false }: { kind: PartIconKind; name: string; locked?: boolean }) {
  return (
    <figure className="part-preview" data-part-preview={kind}>
      <div className="part-preview__stage">
        <div className="part-preview__glow" aria-hidden="true" />
        <PartIcon kind={kind} size={160} state={locked ? "locked" : "normal"} label={name} />
      </div>
      <figcaption className="small muted">{m.parts.preview}</figcaption>
    </figure>
  );
}
