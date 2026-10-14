/**
 * The code drawer: the board's program as ink blocks, and (from lesson 14) as text beside them, one program with two
 * views. Editing either redraws the other through the program's tree. One primary action: Upload. A program with a
 * mistake is refused at once, the mistake shown as line:column and a plain sentence; a good one plays a short upload,
 * then the board restarts and runs it.
 *
 * The drawer keeps nothing of its own: the program in it lives in the lab session (the runtime's draft), so it
 * survives the drawer closing between beats, and goals can read it (`lab.code(board)`).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import type { BlockProgram, Program } from "@ohmland/code";
import { m } from "../../i18n";
import { prefersReducedMotion } from "../../progress/prefs";
import { boardPart } from "../mcu";
import type { LabRuntime } from "../runtime";
import { blockAt, lineOf, paletteItem, readProgram, textOf, type PaletteItem } from "./blocks";
import { BlocksView } from "./BlocksView";
import "./code.css";

const TextView = lazy(() => import("./TextView"));

/** What a lesson beat asks of the drawer: the blocks its palette offers, a program to start from. */
export type CodeBeat = { key: string; palette?: string[]; program?: string };

/** How long the upload moment lasts (the progress line in code.css draws over the same time). */
const UPLOAD_MS = 600;

export function CodeDrawer({ runtime, board, beat }: { runtime: LabRuntime; board: string; beat: CodeBeat | null }) {
  const config = runtime.lab.bench.code;
  const textOffered = config?.text !== false;
  // The draft as the session holds it: it changes here only when something else put a program in (a setup, "Show
  // me"); a board printing (which also bumps the code counter) leaves it, and the drawer, alone.
  const held = useStore(runtime.ui, () => runtime.session.mcu.codes[board]?.source ?? null);
  const onBoard = useStore(runtime.store, (s) => boardPart(s.bench, board)?.params.program ?? null);
  const draft = () => runtime.session.mcu.code(board, runtime.session.bench).source;

  const [source, setSource] = useState(draft);
  const current = useRef(source);
  current.current = source;
  const [view, setView] = useState<"blocks" | "text">(() => (textOffered ? runtime.session.mcu.code(board, runtime.session.bench).view : "blocks"));
  const [showError, setShowError] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading">("idle");
  const [lit, setLit] = useState<number | null>(null);
  const [live, setLive] = useState("");
  const wide = useWide();

  const edit = (next: string) => {
    setSource(next);
    runtime.setDraft(board, next);
  };

  // The program changed somewhere else (a setup or "Show me" uploaded one): show it.
  useEffect(() => {
    if (held !== null && held !== current.current) setSource(held);
  }, [held]);

  // A beat's starting program, once per beat.
  useEffect(() => {
    if (beat?.program !== undefined && runtime.beatProgram(beat.key, board, beat.program)) setSource(beat.program);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat?.key]);

  const reading = useMemo(() => readProgram(source), [source]);
  const good = useRef<{ blocks: BlockProgram; ast: Program | null } | null>(null);
  if (reading.blocks) good.current = { blocks: reading.blocks, ast: reading.ast };
  const shown = good.current;
  const frozen = !reading.blocks;

  // A mistake shows from the Upload that found it until it is fixed, following the program as it changes.
  const error = showError ? reading.error : null;
  useEffect(() => {
    if (!reading.error) setShowError(false);
  }, [reading.error]);
  const errorId = error && reading.ast ? blockAt(reading.ast, error.line, error.col) : null;

  // In a lesson the beat decides (a beat without a palette offers none); a lab on its own offers its own palette.
  const entries = beat ? (beat.palette ?? []) : (config?.palette ?? []);
  const palette = useMemo(() => entries.map(paletteItem).filter((p): p is PaletteItem => !!p), [entries.join("\n")]);

  const lines = useMemo(() => source.split("\n"), [source]);
  const lineText = (id: number | undefined) => {
    const n = lineOf(reading.ast, id);
    return n ? m.lab.code.line(n, lines[n - 1]?.trim() ?? "") : "";
  };

  const setOpen = (v: "blocks" | "text") => {
    setView(v);
    runtime.setCodeView(board, v);
  };
  // Leaving the drawer closes its text for `lab.view("code:text")`; coming back opens it again.
  useEffect(() => {
    if (view === "text") runtime.setCodeView(board, "text");
    return () => {
      if (runtime.session.panelViews.has("code:text")) runtime.session.setView("code:text", false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = () => {
    if (phase === "uploading") return;
    const sent = source;
    if (reading.error) {
      runtime.upload(board, sent);
      setShowError(true);
      setLive(`${m.lab.code.refused} ${m.lab.code.at(reading.error.line, reading.error.col)} ${reading.error.message}`);
      return;
    }
    setShowError(false);
    setPhase("uploading");
    setLive(m.lab.code.uploading);
    window.setTimeout(() => {
      runtime.upload(board, sent);
      setPhase("idle");
      setLive(m.lab.code.uploaded);
    }, UPLOAD_MS);
  };

  const split = view === "text" && wide;
  const onBlocks = (next: BlockProgram) => {
    const text = textOf(next);
    if (text !== null && text !== source) edit(text);
  };
  const running = phase === "idle" && !error && onBoard !== null && onBoard === source;
  const changed = onBoard !== null && onBoard !== source;

  const blocks = shown ? (
    <div className="code-drawer__blocks">
      {frozen && <p className="code-drawer__frozen">{m.lab.code.frozen}</p>}
      <BlocksView
        blocks={shown.blocks}
        frozen={frozen}
        palette={palette}
        errorId={errorId}
        litId={lit}
        lineText={lineText}
        onChange={onBlocks}
        onLight={setLit}
        announce={setLive}
      />
    </div>
  ) : (
    <div className="code-drawer__blocks">
      <p className="code-drawer__frozen">{m.lab.code.frozen}</p>
    </div>
  );

  const text = (
    <div className="code-drawer__text">
      <Suspense fallback={<p className="code-drawer__loading">{m.lab.code.loadingText}</p>}>
        <TextView
          source={source}
          onChange={(s) => {
            edit(s);
          }}
          error={error}
          lit={lineOf(reading.ast, lit ?? undefined)}
          onCursor={(line, col) => setLit(blockAt(reading.ast, line, col))}
        />
      </Suspense>
    </div>
  );

  return (
    <section className={`instrument code-drawer${split ? " code-drawer--split" : ""}`} aria-label={m.lab.code.label} data-code-drawer data-view={view}>
      <header className="instrument__head code-drawer__head">
        <h3 className="instrument__title">{m.lab.code.title}</h3>
        {textOffered && (
          <button type="button" className="btn btn--small btn--tertiary code-drawer__toggle" aria-pressed={view === "text"} data-code-view-toggle onClick={() => setOpen(view === "text" ? "blocks" : "text")}>
            {m.lab.code.text}
          </button>
        )}
        <button type="button" className="btn btn--small code-drawer__upload" data-code-upload data-changed={changed || undefined} disabled={phase === "uploading"} onClick={upload}>
          {m.lab.code.upload}
          {changed && <span className="code-drawer__dot" aria-label={m.lab.code.changed} />}
        </button>
      </header>
      {phase === "uploading" && <span className={`code-drawer__bar${prefersReducedMotion() ? " code-drawer__bar--still" : ""}`} aria-hidden="true" />}

      <div className="code-drawer__views">
        {(view === "blocks" || split) && blocks}
        {view === "text" && text}
      </div>

      <footer className="code-drawer__status">
        {error ? (
          <p className="code-drawer__error" role="alert" data-code-error>
            <b>{m.lab.code.at(error.line, error.col)}</b> {error.message}
          </p>
        ) : phase === "uploading" ? (
          <p className="code-drawer__note">{m.lab.code.uploading}</p>
        ) : running ? (
          <p className="code-drawer__note code-drawer__note--ok">{m.lab.code.uploaded}</p>
        ) : null}
      </footer>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </section>
  );
}

/** Wide enough to show the text beside the blocks. */
function useWide(): boolean {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}
