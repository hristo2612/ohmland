/**
 * The flow try-out (/variants/flow, hidden): four benches drawn with each way of showing the flow, side by side, live.
 * Each row runs one simulator in this thread and hands its snapshots to every bench in the row, so the columns differ
 * only in how the flow is drawn (and what a gate counts as one unit). Controls: 3D or ink, current or electrons,
 * moving or still (reduced motion), close up or the whole bench, and running the tracer again.
 *
 * URL: `view=ink`, `electrons=1`, `still=1`, `frame=whole`, `only=<style>` (one style, its four benches large),
 * `pick=<style>` (the style a phone shows) and `big=<row>:<style>` (one bench open large). 3D benches are drawn only
 * for the rows most on screen (a page holds about sixteen WebGL contexts).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FLOW_STYLES, benchToNetlist, createBenchStore, previewStill, type BenchStore, type FlowStyle } from "@ohmland/bench/core";
import { BenchView, type BenchController } from "@ohmland/bench/view";
import { createSimulation, type Simulation, type Snapshot } from "@ohmland/sim";
import { m } from "../i18n";
import { loadRows, type FlowRow, type RowId } from "./flow-rows";
import "./flow-variants.css";

type View = "3d" | "ink";
const t = m.flowVariants;

/** One simulator per row; every bench in the row draws its snapshots. */
class RowSim {
  private sim: Simulation;
  private stores = new Set<BenchStore>();
  snapshot: Snapshot;
  constructor(row: FlowRow) {
    this.sim = createSimulation();
    this.sim.load(benchToNetlist(row.built.bench).netlist);
    for (const i of row.built.inputs) this.sim.setInput(i.id, i.key, i.value);
    this.snapshot = this.sim.step(0.6);
  }
  attach(store: BenchStore): () => void {
    this.stores.add(store);
    store.setState({ snapshot: this.snapshot });
    return () => {
      this.stores.delete(store);
    };
  }
  tick(dt: number): void {
    if (!this.stores.size) return;
    this.snapshot = this.sim.step(dt);
    for (const s of this.stores) s.setState({ snapshot: this.snapshot });
  }
  dispose(): void {
    this.sim.dispose();
  }
}

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setOn(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return on;
}

/** How much of an element is on screen (0 to 1), reported as it scrolls. */
function useVisible<T extends Element>(report: (share: number) => void): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const cb = useRef(report);
  cb.current = report;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => cb.current(e?.isIntersecting ? e.intersectionRatio : 0), { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** A page holds about sixteen WebGL contexts: the 3D benches of at most this many on-screen benches are drawn. */
const MAX_3D = 15;

const isStyle = (s: string | null): s is FlowStyle => !!s && (FLOW_STYLES as readonly string[]).includes(s);

function Cell({ row, sim, style, view, electrons, framing, traceAt, mounted, onOpen, big = false }: { row: FlowRow; sim: RowSim; style: FlowStyle; view: View; electrons: boolean; framing: "close" | "whole"; traceAt: number; mounted: boolean; onOpen?: () => void; big?: boolean }) {
  const store = useMemo(() => {
    const s = createBenchStore(row.built.bench);
    s.getState().setOverlay({ flowStyle: style });
    return s;
  }, [row, style]);
  useEffect(() => store.getState().setOverlay({ flow: electrons ? "electrons" : "current" }), [store, electrons]);
  useEffect(() => sim.attach(store), [sim, store]);
  useEffect(() => {
    if (row.trace) store.getState().trace(row.trace);
  }, [store, row.trace, traceAt]);
  const ctrl = useRef<BenchController | null>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (!ready) return;
    ctrl.current?.focus(framing === "close" ? row.close : [], { instant: true, padding: big ? 24 : 6 });
  }, [ready, framing, row.close, big, view]);
  const label = t.enlarge(t.styles[style].name, t.rows[row.id].name);
  return (
    <div className="fv-cell" data-style={style} data-row={row.id}>
      {mounted && <BenchView view={view} store={store} readOnly frame={row.built.frame} quality="high" controllerRef={ctrl} onReady={() => setReady(true)} />}
      {onOpen && <button type="button" className="fv-cell__open" aria-label={label} onClick={onOpen} />}
    </div>
  );
}

function Row({ row, sim, styles, view, electrons, framing, traceAt, mounted, onVisible, onOpen }: { row: FlowRow; sim: RowSim; styles: FlowStyle[]; view: View; electrons: boolean; framing: "close" | "whole"; traceAt: number; mounted: boolean; onVisible: (row: RowId, share: number) => void; onOpen: (row: RowId, style: FlowStyle) => void }) {
  const ref = useVisible<HTMLDivElement>((share) => onVisible(row.id, share));
  return (
    <section className="fv-row" ref={ref} aria-labelledby={`fv-row-${row.id}`}>
      <header className="fv-row__head">
        <h2 id={`fv-row-${row.id}`}>{t.rows[row.id].name}</h2>
        <p>{t.rows[row.id].line}</p>
      </header>
      <div className="fv-row__cells" style={{ ["--cols" as string]: styles.length }}>
        {styles.map((style) => (
          <Cell key={`${style}:${view}`} row={row} sim={sim} style={style} view={view} electrons={electrons} framing={framing} traceAt={traceAt} mounted={mounted} onOpen={() => onOpen(row.id, style)} />
        ))}
      </div>
    </section>
  );
}

/** A small specimen of a style, for the column heads: a cable with its units standing still. */
function Specimen({ style }: { style: FlowStyle }) {
  const units = [8, 22, 36, 50];
  return (
    <svg className="fv-spec" viewBox="0 0 60 10" aria-hidden="true">
      <path d="M2 5H58" className="fv-spec__cable" />
      {style === "dots" && units.map((x) => <circle key={x} cx={x} cy={5} r={1.6} className="fv-spec__dot" />)}
      {style === "barber" && units.map((x) => <path key={x} d={`M${x - 3} 8.2L${x + 1} 1.8H${x + 5}L${x + 1} 8.2Z`} className="fv-spec__unit" />)}
      {style === "dashes" && units.map((x) => <path key={x} d={`M${x - 4} 5H${x + 4}`} className="fv-spec__dash" />)}
      {style === "pulses" && units.map((x, i) => <rect key={x} x={x - 1 + i * 0.6} y={2} width={2.4} height={6} className="fv-spec__unit" />)}
      {style === "chevrons" && units.map((x) => <path key={x} d={`M${x - 2} 2L${x + 2} 5L${x - 2} 8`} className="fv-spec__chev" />)}
    </svg>
  );
}

export default function FlowVariants() {
  const q = useMemo(() => new URLSearchParams(typeof location === "undefined" ? "" : location.search), []);
  const [view, setView] = useState<View>(q.get("view") === "ink" ? "ink" : "3d");
  const [electrons, setElectrons] = useState(q.get("electrons") === "1");
  const [still, setStill] = useState(q.get("still") === "1");
  const [framing, setFraming] = useState<"close" | "whole">(q.get("frame") === "whole" ? "whole" : "close");
  const only = isStyle(q.get("only")) ? (q.get("only") as FlowStyle) : null;
  const [pick, setPick] = useState<FlowStyle>(isStyle(q.get("pick")) ? (q.get("pick") as FlowStyle) : (only ?? "barber"));
  const [traceAt, setTraceAt] = useState(0);
  const [open, setOpen] = useState<{ row: RowId; style: FlowStyle } | null>(() => {
    const [row, style] = (q.get("big") ?? "").split(":");
    return row && isStyle(style ?? null) ? { row: row as RowId, style: style as FlowStyle } : null;
  });
  const phone = useMedia("(max-width: 720px)");
  const [rows, setRows] = useState<FlowRow[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadRows().then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, []);
  const sims = useMemo(() => new Map((rows ?? []).map((r) => [r.id, new RowSim(r)])), [rows]);
  useEffect(() => () => sims.forEach((s) => s.dispose()), [sims]);
  // One clock for every row's simulator.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (dt > 0) sims.forEach((s) => s.tick(dt));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sims]);
  useEffect(() => () => previewStill(null), []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  // Before the benches below render: they read it as they mount (and remount when it changes).
  previewStill(still);

  const styles: FlowStyle[] = phone ? [pick] : only ? [only] : [...FLOW_STYLES];
  // Ink is cheap. A 3D bench needs a WebGL context: draw the rows most on screen, and none behind the large view.
  const [shares, setShares] = useState<Partial<Record<RowId, number>>>({});
  const onVisible = (id: RowId, share: number) => setShares((s) => (s[id] === share ? s : { ...s, [id]: share }));
  const drawn = new Set<RowId>(
    view === "ink"
      ? (rows ?? []).map((r) => r.id)
      : open
        ? []
        : (Object.entries(shares) as [RowId, number][])
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, Math.max(1, Math.floor(MAX_3D / styles.length)))
            .map(([k]) => k),
  );
  const openRow = open && rows?.find((r) => r.id === open.row);
  const seg = <T extends string>(label: string, value: T, set: (v: T) => void, options: [T, string][]) => (
    <div className="fv-seg" role="group" aria-label={label}>
      <span className="fv-seg__label">{label}</span>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}>
          {text}
        </button>
      ))}
    </div>
  );
  return (
    <div className="fv" data-view={view} data-still={still ? "1" : "0"} data-only={only ?? undefined}>
      <div className="fv-bar" role="toolbar" aria-label={t.controls}>
        {seg(t.view.label, view, setView, [
          ["3d", t.view["3d"]],
          ["ink", t.view.ink],
        ])}
        {seg(t.flow.label, electrons ? "electrons" : "current", (v) => setElectrons(v === "electrons"), [
          ["current", t.flow.current],
          ["electrons", t.flow.electrons],
        ])}
        {seg(t.motion.label, still ? "still" : "moving", (v) => setStill(v === "still"), [
          ["moving", t.motion.moving],
          ["still", t.motion.still],
        ])}
        {seg(t.framing.label, framing, setFraming, [
          ["close", t.framing.close],
          ["whole", t.framing.whole],
        ])}
        <button type="button" className="btn btn--secondary btn--small" onClick={() => setTraceAt((n) => n + 1)}>
          {t.trace}
        </button>
      </div>
      {phone && !only && (
        <div className="fv-pick" role="group" aria-label={t.pick}>
          {FLOW_STYLES.map((s) => (
            <button key={s} type="button" aria-pressed={pick === s} onClick={() => setPick(s)}>
              <Specimen style={s} />
              <span>{t.styles[s].name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="fv-heads" style={{ ["--cols" as string]: styles.length }}>
        {styles.map((s) => (
          <div key={s} className="fv-head">
            <Specimen style={s} />
            <h2>{t.styles[s].name}</h2>
            <p>{t.styles[s].line}</p>
          </div>
        ))}
      </div>
      {rows && (
        <div className="fv-rows" key={still ? "still" : "moving"}>
          {rows.map((row) => (
            <Row key={row.id} row={row} sim={sims.get(row.id)!} styles={styles} view={view} electrons={electrons} framing={framing} traceAt={traceAt} mounted={drawn.has(row.id)} onVisible={onVisible} onOpen={(r, s) => setOpen({ row: r, style: s })} />
          ))}
        </div>
      )}
      {open && openRow && (
        <div className="fv-big" role="dialog" aria-modal="true" aria-label={`${t.styles[open.style].name}, ${t.rows[open.row].name}`}>
          <div className="fv-big__bar">
            <span>
              {t.styles[open.style].name}: {t.rows[open.row].name}
            </span>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => setOpen(null)}>
              {t.shut}
            </button>
          </div>
          <Cell key={`${open.style}:${view}:${still}`} row={openRow} sim={sims.get(openRow.id)!} style={open.style} view={view} electrons={electrons} framing={framing} traceAt={traceAt} mounted big />
        </div>
      )}
    </div>
  );
}
