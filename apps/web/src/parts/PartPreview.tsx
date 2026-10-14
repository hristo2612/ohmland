import type { PartIconKind } from "./kinds";
import { PartIcon } from "./PartIcon";

/**
 * The slot where a part's 3D model will spin (from packages/bench, loaded lazily). For now it shows the ink drawing,
 * large, between two pencil rules.
 */
export function PartPreview({ kind, name, locked = false }: { kind: PartIconKind; name: string; locked?: boolean }) {
  return (
    <figure className="part-preview" data-part-preview={kind}>
      <PartIcon kind={kind} size={160} state={locked ? "locked" : "normal"} label={name} />
    </figure>
  );
}
