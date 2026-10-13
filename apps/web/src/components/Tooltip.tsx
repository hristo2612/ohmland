import { cloneElement, useEffect, useId, useState, type ReactElement } from "react";

/**
 * A short text tip shown on hover and keyboard focus, and dismissed with Escape. The trigger gets aria-describedby,
 * so the tip is announced; it must never hold the only copy of important information.
 */
export function Tooltip({ text, placement = "above", children }: { text: string; placement?: "above" | "below"; children: ReactElement<Record<string, unknown>> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <span
      className="tooltip-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span role="tooltip" id={id} className={placement === "below" ? "tooltip tooltip--below" : "tooltip"} data-open={open}>
        {text}
      </span>
    </span>
  );
}
