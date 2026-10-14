/**
 * /variants/cables: the cable approaches side by side. Rows are benches (the most cluttered ones the audit found,
 * plus Welcome to the bench), columns are the four styles. Each cell is a live bench, drawn in ink (or 3D, one bench
 * at a time: browsers allow only so many 3D canvases), with its clutter score. A cell opens that bench full size, live
 * and draggable, in that style (?case=lab:task&style=drape&view=ink).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CABLE_STYLES, isCableStyle, type CableStyle } from "@ohmland/bench/core";
import { BenchView } from "@ohmland/bench/view";
import { buildModel, inkClutter } from "@ohmland/bench/ink";
import { m } from "../../i18n";
import { loadLab } from "../../lab/labs";
import type { LabDefinition } from "../../lab/define";
import { CASES, parseCase, type CableCase } from "./cases";
import { variantBench, type Variant } from "./styles";
import "./variants.css";

type View = "ink" | "3d";
const t = m.cableVariants;

function readQuery() {
  const q = new URLSearchParams(window.location.search);
  const view: View = q.get("view") === "3d" ? "3d" : "ink";
  const style = q.get("style");
  return { view, case: q.get("case"), style: isCableStyle(style) ? style : null, row: q.get("row") };
}

function href(params: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return `${window.location.pathname}${s ? `?${s}` : ""}`;
}

/** The labs the page shows, loaded once. */
function useLabs(cases: readonly CableCase[]): Map<string, LabDefinition> | null {
  const [labs, setLabs] = useState<Map<string, LabDefinition> | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([...new Set(cases.map((c) => c.lab))].map(async (id) => [id, await loadLab(id)] as const)).then((all) => {
      if (live) setLabs(new Map(all));
    });
    return () => {
      live = false;
    };
  }, [cases]);
  return labs;
}

type Cell = { variant: Variant; score: ReturnType<typeof inkClutter> };

function cellFor(lab: LabDefinition, c: CableCase, style: CableStyle): Cell {
  const variant = variantBench(style, lab, c.task);
  return { variant, score: inkClutter(buildModel(variant.bench, variant.cableStyle), variant.frame) };
}

export default function CableVariants() {
  const [query] = useState(readQuery);
  const single = query.case ? parseCase(query.case) : null;
  const cases = useMemo(() => (single ? [single] : CASES), [single]);
  const labs = useLabs(cases);
  if (!labs) return <p className="cv-loading" role="status">{t.loading}</p>;
  if (single) return <Single lab={labs.get(single.lab)!} c={single} style={query.style ?? "classic"} view={query.view} />;
  return <Grid labs={labs} view={query.view} row={query.row} />;
}

function Score({ score }: { score: Cell["score"] }) {
  return (
    <span className="cv-score" title={t.detail(score)}>
      {t.score(score.score)}
    </span>
  );
}

/** The size a cell's bench is drawn at before it is scaled down to the cell, so it frames as a desktop bench does. */
const MINI = { w: 960, h: 720 };

/**
 * A bench drawn at desktop size and scaled to fit its cell (the ink view: it frames as on a desktop). The 3D view
 * measures its canvas on screen, so it is drawn at the cell's own size.
 */
function Mini({ children, scaled }: { children: ReactNode; scaled: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [k, setK] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setK(el.clientWidth / MINI.w);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!scaled)
    return (
      <span className="cv-bench" ref={ref}>
        <span className="cv-full">{children}</span>
      </span>
    );
  return (
    <span className="cv-bench" ref={ref}>
      {k > 0 && (
        <span className="cv-mini" style={{ width: MINI.w, height: MINI.h, transform: `scale(${k})` }}>
          {children}
        </span>
      )}
    </span>
  );
}

function Grid({ labs, view, row }: { labs: Map<string, LabDefinition>; view: View; row: string | null }) {
  const cells = useMemo(() => {
    const out = new Map<string, Cell>();
    for (const c of CASES) for (const s of CABLE_STYLES) out.set(`${c.key}|${s}`, cellFor(labs.get(c.lab)!, c, s));
    return out;
  }, [labs]);
  // 3D: one bench at a time (each cell is a WebGL canvas).
  const shown = view === "3d" ? CASES.filter((c) => c.key === (row ?? CASES[0]!.key)) : CASES;
  return (
    <div className="cv">
      <header className="cv-head">
        <div>
          <h1 className="cv-title">{t.title}</h1>
          <p className="cv-lead">{t.lead}</p>
        </div>
        <nav className="cv-toggle" aria-label={t.view}>
          <a href={href({ view: null })} aria-current={view === "ink" ? "true" : undefined}>
            {t.ink}
          </a>
          <a href={href({ view: "3d", row })} aria-current={view === "3d" ? "true" : undefined}>
            {t.threeD}
          </a>
        </nav>
      </header>
      {view === "3d" && (
        <nav className="cv-rows" aria-label={t.bench}>
          <span>{t.only3d}</span>
          {CASES.map((c) => (
            <a key={c.key} href={href({ view: "3d", row: c.key })} aria-current={shown[0]?.key === c.key ? "true" : undefined}>
              {labs.get(c.lab)!.title}
            </a>
          ))}
        </nav>
      )}
      <div className="cv-cols" aria-hidden="true" data-view={view}>
        <span />
        {CABLE_STYLES.map((s) => (
          <span key={s} className="cv-col">
            <b>{t.styles[s]}</b>
            <small>{t.notes[s]}</small>
          </span>
        ))}
      </div>
      {shown.map((c) => (
        <section key={c.key} className="cv-row" data-case={c.key}>
          <h2 className="cv-row-title">
            {labs.get(c.lab)!.title}
            <small>{c.task ?? t.start}</small>
          </h2>
          <div className="cv-cells" data-view={view}>
            {CABLE_STYLES.map((s) => {
              const cell = cells.get(`${c.key}|${s}`)!;
              return (
                <a key={s} className="cv-cell" data-style={s} href={href({ case: c.key, style: s, view: view === "3d" ? "3d" : null })} aria-label={`${labs.get(c.lab)!.title}, ${t.styles[s]}: ${t.open}`}>
                  <span className="cv-cell-head">
                    <b>{t.styles[s]}</b>
                    <Score score={cell.score} />
                  </span>
                  <Mini scaled={view === "ink"}>
                    <BenchView view={view} initial={cell.variant.bench} cableStyle={cell.variant.cableStyle} frame={cell.variant.frame} readOnly quality="low" locked={cell.variant.locked} />
                  </Mini>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Single({ lab, c, style, view }: { lab: LabDefinition; c: CableCase; style: CableStyle; view: View }) {
  const cell = useMemo(() => cellFor(lab, c, style), [lab, c, style]);
  return (
    <div className="cv-single">
      <header className="cv-single-head">
        <a href={href({ view: view === "3d" ? "3d" : null })}>{t.back}</a>
        <b>{lab.title}</b>
        <small>{c.task ?? t.start}</small>
        <nav className="cv-toggle" aria-label={t.bench}>
          {CABLE_STYLES.map((s) => (
            <a key={s} href={href({ case: c.key, style: s, view: view === "3d" ? "3d" : null })} aria-current={s === style ? "true" : undefined}>
              {t.styles[s]}
            </a>
          ))}
        </nav>
        <nav className="cv-toggle" aria-label={t.view}>
          <a href={href({ case: c.key, style })} aria-current={view === "ink" ? "true" : undefined}>
            {t.ink}
          </a>
          <a href={href({ case: c.key, style, view: "3d" })} aria-current={view === "3d" ? "true" : undefined}>
            {t.threeD}
          </a>
        </nav>
        <Score score={cell.score} />
      </header>
      <div className="cv-single-bench" data-bench-ready>
        <BenchView key={`${c.key}|${style}|${view}`} view={view} initial={cell.variant.bench} cableStyle={cell.variant.cableStyle} frame={cell.variant.frame} locked={cell.variant.locked} labels={m.benchUi} />
      </div>
    </div>
  );
}
