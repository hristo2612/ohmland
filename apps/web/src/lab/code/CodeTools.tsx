/**
 * The microcontroller board's tools for the lesson dock, one at a time: the code drawer (`tool: code`), the serial
 * monitor (`tool: serial`) and the millis() readout with its day-49 jump (`tool: millis`). A lazy chunk: only labs
 * with a board load it, and only once a beat shows one of them.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { useStore } from "zustand";
import { m } from "../../i18n";
import { drawerBoard, serialView } from "../mcu";
import type { LabRuntime } from "../runtime";
import { CodeDrawer, type CodeBeat } from "./CodeDrawer";
import "./code.css";

export type CodeToolName = "code" | "serial" | "millis";
export type { CodeBeat };

export const CODE_TOOLS: readonly CodeToolName[] = ["code", "serial", "millis"];

export default function CodeTools({ runtime, tool, beat }: { runtime: LabRuntime; tool: CodeToolName; beat: CodeBeat | null }) {
  const board = drawerBoard(runtime.lab);
  if (!board) return null;
  if (tool === "code") return <CodeDrawer runtime={runtime} board={board} beat={beat} />;
  if (tool === "serial") return <SerialMonitor runtime={runtime} board={board} />;
  return <MillisReadout runtime={runtime} board={board} />;
}

/** While a tool is open, `lab.view("<name>:<board>")` is true. */
function useOpenView(runtime: LabRuntime, name: `serial:${string}` | `millis:${string}`) {
  useEffect(() => {
    runtime.setView(name, true);
    return () => runtime.setView(name, false);
  }, [runtime, name]);
}

/** What the board printed since its last upload, newest at the bottom, with the simulated time of each line. */
export function SerialMonitor({ runtime, board }: { runtime: LabRuntime; board: string }) {
  useStore(runtime.ui, (s) => s.code);
  useOpenView(runtime, `serial:${board}`);
  const s = serialView(runtime.session.snapshot, runtime.session.mcu.boards[board], board);
  const partial = s.partial;
  const list = useRef<HTMLOListElement>(null);
  const stuck = useRef(true);
  // Keep the newest line in view, unless the learner scrolled up to read.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  });
  const empty = !s.lines.length && !partial;
  return (
    <section className="instrument serial-monitor" aria-label={m.lab.serial.label} data-serial>
      <header className="instrument__head">
        <h3 className="instrument__title">{m.lab.serial.title}</h3>
      </header>
      {empty ? (
        <p className="serial-monitor__empty">{m.lab.serial.empty}</p>
      ) : (
        <ol
          ref={list}
          className="serial-monitor__lines"
          role="log"
          onScroll={(e) => {
            const el = e.currentTarget;
            stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
          }}
        >
          {s.lines.map((text, i) => (
            <li key={i}>
              <span className="serial-monitor__t">{m.lab.serial.at(s.times[i] ?? 0)}</span>
              <span className="serial-monitor__text">{text || " "}</span>
            </li>
          ))}
          {partial && (
            <li className="serial-monitor__partial">
              <span className="serial-monitor__t" />
              <span className="serial-monitor__text">{partial}</span>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

const grouped = new Intl.NumberFormat("en");

/** The board's clock, live, and the jump to nine seconds before day 49's wrap. */
export function MillisReadout({ runtime, board }: { runtime: LabRuntime; board: string }) {
  const ms = useStore(runtime.store, (s) => s.snapshot?.parts[board]?.extra?.["millis"]);
  useStore(runtime.ui, (s) => s.code);
  useOpenView(runtime, `millis:${board}`);
  const wraps = runtime.session.mcu.boards[board]?.wraps ?? 0;
  const n = typeof ms === "number" ? ms : 0;
  const days = Math.floor(n / 86_400_000);
  const hours = Math.floor((n % 86_400_000) / 3_600_000);
  return (
    <section className="instrument millis-readout" aria-label={m.lab.millis.label} data-millis>
      <header className="instrument__head">
        <h3 className="instrument__title mono">{m.lab.millis.title}</h3>
      </header>
      <p className="millis-readout__value" aria-live="off">
        {grouped.format(n)}
      </p>
      <p className="millis-readout__sub">
        {m.lab.millis.since} · {days ? m.lab.millis.days(days, hours) : m.lab.millis.seconds(Math.floor(n / 1000))}
        {wraps > 0 && <span className="millis-readout__wrapped"> · {m.lab.millis.wrapped}</span>}
      </p>
      <button type="button" className="btn btn--small btn--tertiary millis-readout__jump" data-millis-jump onClick={() => runtime.jumpMillis(board)}>
        {m.lab.millis.jump}
      </button>
    </section>
  );
}
