/**
 * Keys for buttons: big on-screen keys for the lab's pushbuttons, each also bound to a keyboard key (held while the
 * key is down, so two players can share one keyboard), and a pin that keeps a button held down for touch screens,
 * where holding one finger on a key while doing something else is hard.
 */
import { useId } from "react";
import { useStore } from "zustand";
import { m } from "../i18n";
import type { PanelConfig } from "./define";
import type { LabRuntime } from "./runtime";
import "./chip-panels.css";

export function KeysPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "keys" }> }) {
  useStore(runtime.ui, (s) => s.panels);
  const id = useId();
  return (
    <section className="instrument panel chip-panel ky" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.chips.keys}
        </h3>
      </header>
      <p className="small muted panel__help">{m.lab.chips.keysHelp}</p>
      <div className="ky__row">
        {cfg.buttons.map((b) => {
          const how = runtime.heldBy(b.part);
          const down = how !== null;
          const press = () => runtime.holdButton(b.part, "touch");
          const lift = () => {
            if (runtime.heldBy(b.part) === "touch") runtime.releaseButton(b.part);
          };
          return (
            <div key={b.part} className="ky__key" data-down={down || undefined} data-pinned={how === "pin" || undefined}>
              <button
                type="button"
                className="ky__cap"
                aria-pressed={down}
                aria-keyshortcuts={b.key === " " ? "Space" : b.key}
                data-key-part={b.part}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  press();
                }}
                onPointerUp={lift}
                onPointerCancel={lift}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    press();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter") lift();
                }}
              >
                <span className="ky__label">{b.label}</span>
                <kbd className="ky__kbd">{m.lab.chips.keyName(b.key)}</kbd>
              </button>
              <button
                type="button"
                className="ky__pin small"
                aria-pressed={how === "pin"}
                onClick={() => (how === "pin" ? runtime.releaseButton(b.part) : runtime.holdButton(b.part, "pin"))}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="ky__pinicon">
                  <path d="M6 2h4l-.6 4 2.6 2.4V10H4V8.4L6.6 6 6 2zM8 10v4.5" />
                </svg>
                {how === "pin" ? m.lab.chips.unpin : m.lab.chips.pinDown}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
