/**
 * Lab panels, the UI half: worksheets beside the tasks (continuity and truth tables that fill themselves, a pin map,
 * tags, a hole hunt and a symbol builder). Every control is a real button or select, so the keyboard path and touch
 * work the same. State lives in the session (panels.ts); answers go through the runtime.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useStore } from "zustand";
import { boardGeometry, partLegs, terminalNumber, type PlacedPart } from "@ohmland/bench/core";
import { Icon } from "../components/Icon";
import { m } from "../i18n";
import type { PanelConfig, PanelState, SymbolKind } from "./define";
import { cellKey, holeNet, isThrowInput, legPairs, partStates, truthCell, truthComplete, truthInput, truthOutputs, truthRows } from "./panels";
import { HistogramPanel } from "./histogram";
import { KeysPanel } from "./keys";
import { ChartPanel, ReadingsPanel } from "./slips";
import { TimingPanel } from "./timing-diagram";
import { XrayPanel } from "./xray";
import type { LabRuntime } from "./runtime";
import "./panels.css";

/** A terminal's name in a panel: its number on a mystery part, else where it sits (left, middle, right). */
export function terminalLabel(part: PlacedPart, leg: string): string {
  const n = terminalNumber(part, leg);
  if (n !== null) return String(n);
  const legs = partLegs(part);
  return m.lab.terminalAt[legs.length]?.[legs.indexOf(leg)] ?? leg;
}

function usePanel(runtime: LabRuntime, id: string): PanelState {
  useStore(runtime.ui, (s) => s.panels);
  return runtime.session.panels[id] ?? { cells: {}, size: 0, answer: null, submissions: 0, wrong: 0, correct: false };
}

function Verdict({ state }: { state: PanelState }) {
  if (!state.submissions) return null;
  return (
    <p className="panel__verdict small" data-ok={state.correct || undefined} role="status">
      <Icon name={state.correct ? "check" : "alert"} size={16} />
      <span>{state.correct ? m.lab.panels.right : m.lab.panels.wrong}</span>
      <span className="muted">{m.lab.panels.tries(state.submissions, state.wrong)}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function ContinuityPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "continuity" }> }) {
  const state = usePanel(runtime, cfg.id);
  const part = useStore(runtime.store, (s) => s.bench.parts.find((p) => p.id === cfg.part));
  const id = useId();
  const [said, setSaid] = useState("");
  const pairs = useMemo(() => (part ? legPairs(part) : []), [part]);
  const keys = Object.keys(state.cells).join("|");
  useEffect(() => {
    const last = Object.keys(state.cells).pop();
    if (!last || !part) return;
    const [ab] = last.split("@");
    const [a, b] = (ab ?? "").split("|");
    setSaid(m.lab.panels.logged(terminalLabel(part, a!), terminalLabel(part, b!), state.cells[last] ? m.lab.panels.beep : m.lab.panels.open));
    // Announce each newly logged pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  if (!part) return null;
  const states = partStates(part);
  const name = runtime.built.labels[part.id] ?? part.id;
  const mark = (v: boolean | undefined) => (v === undefined ? "?" : v ? "●" : "○");
  const word = (v: boolean | undefined) => (v === undefined ? m.lab.panels.untested : v ? m.lab.panels.beep : m.lab.panels.open);
  const legs = partLegs(part);
  return (
    <section className="instrument panel" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.panels.continuity(name)}
        </h3>
        <button type="button" className="btn btn--small btn--tertiary" onClick={() => runtime.clearPanel(cfg.id)}>
          {m.lab.panels.clear}
        </button>
      </header>
      <p className="small muted panel__help">{m.lab.panels.continuityHelp}</p>
      {pairs.length <= 3 ? (
        <table className="panel__table">
          <thead>
            <tr>
              <th scope="col">{m.lab.panels.pair}</th>
              {states.map((st) => (
                <th key={st} scope="col">
                  {m.lab.panels.states[st]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pairs.map(([a, b]) => (
              <tr key={`${a}${b}`}>
                <th scope="row">
                  {terminalLabel(part, a)} + {terminalLabel(part, b)}
                </th>
                {states.map((st) => {
                  const v = state.cells[cellKey(a, b, st)];
                  return (
                    <td key={st} data-beep={v === true || undefined} data-open={v === false || undefined}>
                      <span aria-hidden="true">{mark(v)}</span>
                      <span className="panel__word">{word(v)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="panel__matrices">
          {states.map((st) => (
            <table key={st} className="panel__matrix" aria-label={m.lab.panels.matrixLabel(m.lab.panels.states[st] ?? st)}>
              <caption className="small">{m.lab.panels.states[st]}</caption>
              <thead>
                <tr>
                  <td />
                  {legs.slice(1).map((l) => (
                    <th key={l} scope="col">
                      {terminalLabel(part, l)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {legs.slice(0, -1).map((a, i) => (
                  <tr key={a}>
                    <th scope="row">{terminalLabel(part, a)}</th>
                    {legs.slice(1).map((b, j) => {
                      if (j < i) return <td key={b} className="panel__blank" />;
                      const v = state.cells[cellKey(a, b, st)];
                      return (
                        <td
                          key={b}
                          data-beep={v === true || undefined}
                          data-open={v === false || undefined}
                          aria-label={m.lab.panels.cellLabel(terminalLabel(part, a), terminalLabel(part, b), m.lab.panels.states[st] ?? st, word(v))}
                        >
                          {mark(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function TruthTablePanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "truth-table" }> }) {
  const state = usePanel(runtime, cfg.id);
  // The row the inputs are on now is marked live, so the table answers as the keys move.
  useStore(runtime.store, (s) => s.snapshot);
  const id = useId();
  const [said, setSaid] = useState("");
  const rows = useMemo(() => truthRows(cfg), [cfg]);
  const outs = truthOutputs(cfg);
  const view = runtime.session.view();
  const now = cfg.inputs.map((inp) => truthInput(inp, view));
  const nowRow = now.every((v) => v !== null) ? now.join(",") : null;
  const complete = truthComplete(cfg, state);
  const inputWord = (i: number, v: string) => {
    const inp = cfg.inputs[i]!;
    if (isThrowInput(inp)) return v === "a" ? inp.a : inp.b;
    return v === "1" ? inp.high ?? "1" : inp.low ?? "0";
  };
  const outLabel = (k: number) => {
    const o = outs[k]!;
    return o.label ?? ("node" in o ? o.node : m.lab.panels.lamp);
  };
  const outWord = (k: number, v: boolean) => ("node" in outs[k]! ? (v ? "1" : "0") : v ? m.lab.panels.on : m.lab.panels.off);
  const keys = Object.keys(state.cells).join("|");
  useEffect(() => {
    const last = Object.keys(state.cells).pop();
    if (!last) return;
    const [row = "", k = "0"] = last.split("#");
    const vals = row.split(",");
    setSaid(`${vals.map((v, i) => `${cfg.inputs[i]?.label ?? ""} ${inputWord(i, v)}`).join(", ")}: ${outLabel(Number(k))} ${outWord(Number(k), state.cells[last]!)}`);
    // Announce each newly logged row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  const title = cfg.title ?? (cfg.mystery && !complete ? m.lab.chips.mystery : m.lab.panels.truth);
  return (
    <section className="instrument panel tt" aria-labelledby={`${id}-t`} data-panel={cfg.id} data-complete={complete || undefined}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {title}
        </h3>
      </header>
      <p className="small muted panel__help">{cfg.inputs.every(isThrowInput) ? m.lab.panels.truthHelp : m.lab.panels.truthHelpAny}</p>
      <table className="panel__table">
        <thead>
          <tr>
            {cfg.inputs.map((inp, i) => (
              <th key={i} scope="col">
                {inp.label}
              </th>
            ))}
            {outs.map((_, k) => (
              <th key={`o${k}`} scope="col" className="tt__out">
                {outLabel(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const vals = row.split(",");
            const here = row === nowRow;
            return (
              <tr key={row} data-now={here || undefined}>
                {vals.map((v, i) => (
                  <td key={i} className="mono">
                    {inputWord(i, v)}
                  </td>
                ))}
                {outs.map((_, k) => {
                  const v = state.cells[truthCell(row, k)];
                  return (
                    <td key={`o${k}`} className="tt__out" data-lit={v === true || undefined} data-open={v === false || undefined}>
                      {v === undefined ? <span className="muted">?</span> : outWord(k, v)}
                      {here && <span className="sr-only"> ({m.lab.chips.now})</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {cfg.name && (complete || !cfg.mystery) && <p className="tt__name">{m.lab.chips.itIs(cfg.name)}</p>}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function PinMapPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "pin-map" }> }) {
  const state = usePanel(runtime, cfg.id);
  const part = useStore(runtime.store, (s) => s.bench.parts.find((p) => p.id === cfg.part));
  const id = useId();
  const [answer, setAnswer] = useState<Record<string, string>>({});
  if (!part) return null;
  const legs = partLegs(part);
  const name = runtime.built.labels[part.id] ?? part.id;
  const complete = legs.every((l) => answer[l]);
  const peeked = !!(part.params as { peek?: boolean }).peek;
  return (
    <section className="instrument panel" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.panels.pinMap(name)}
        </h3>
      </header>
      <p className="small muted panel__help">{m.lab.panels.pinMapHelp}</p>
      <div className="panel__pins">
        {legs.map((leg) => (
          <label key={leg} className="panel__pin">
            <span className="panel__pin-n mono">{terminalLabel(part, leg)}</span>
            <select className="select select--small" value={answer[leg] ?? ""} onChange={(e) => setAnswer((a) => ({ ...a, [leg]: e.target.value }))}>
              <option value="">{m.lab.panels.choose}</option>
              {cfg.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="panel__actions">
        <button type="button" className="btn btn--small btn--primary" disabled={!complete} onClick={() => runtime.answerPanel(cfg.id, answer)} data-panel-check>
          {m.lab.panels.check}
        </button>
        {cfg.peek && state.correct && (
          <button type="button" className="btn btn--small btn--soft" onClick={() => runtime.peek(part.id)} disabled={peeked}>
            <Icon name="info" size={16} />
            {m.lab.panels.peek}
          </button>
        )}
      </div>
      {peeked && <p className="small muted">{m.lab.panels.peeked}</p>}
      <Verdict state={state} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function TagsPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "tags" }> }) {
  const state = usePanel(runtime, cfg.id);
  const id = useId();
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const complete = cfg.items.every((it) => answer[it.id]);
  return (
    <section className="instrument panel" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.panels.tags}
        </h3>
      </header>
      {cfg.items.map((it) => (
        <fieldset key={it.id} className="panel__tag">
          <legend className="small">{it.label}</legend>
          <div className="panel__seg" role="radiogroup" aria-label={it.label}>
            {cfg.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={answer[it.id] === o.id}
                className="panel__segbtn"
                onClick={() => setAnswer((a) => ({ ...a, [it.id]: o.id }))}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="panel__actions">
        <button type="button" className="btn btn--small btn--primary" disabled={!complete} onClick={() => runtime.answerPanel(cfg.id, answer)} data-panel-check>
          {m.lab.panels.check}
        </button>
      </div>
      <Verdict state={state} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------

const FAR = ["j", "i", "h", "g", "f"];
const NEAR = ["e", "d", "c", "b", "a"];

function HoleHuntPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "hole-hunt" }> }) {
  const state = usePanel(runtime, cfg.id);
  const board = useStore(runtime.store, (s) => s.bench.board);
  const id = useId();
  const [picked, setPicked] = useState<string[]>([cfg.start]);
  if (!board) return null;
  const geom = boardGeometry(board);
  const cols: number[] = [];
  for (let c = cfg.cols[0]; c <= cfg.cols[1]; c++) cols.push(c);
  const toggle = (h: string) => setPicked((p) => (h === cfg.start ? p : p.includes(h) ? p.filter((x) => x !== h) : [...p, h]));
  const right = state.correct ? holeNet(runtime.session.bench, cfg.start) : [];
  const cell = (row: string, c: number) => {
    const h = `${row}${c}`;
    if (!geom.holes.has(h)) return <span key={h} />;
    const on = picked.includes(h);
    return (
      <button
        key={h}
        type="button"
        className="hunt__hole"
        aria-pressed={on}
        aria-label={m.lab.panels.hole(h, on)}
        data-start={h === cfg.start || undefined}
        data-right={right.includes(h) || undefined}
        onClick={() => toggle(h)}
      />
    );
  };
  return (
    <section className="instrument panel" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.panels.huntTitle}
        </h3>
      </header>
      <p className="small muted panel__help">{m.lab.panels.huntHelp(cfg.start.toUpperCase())}</p>
      <div className="hunt" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span />
        {cols.map((c) => (
          <span key={c} className="hunt__col small mono">
            {c}
          </span>
        ))}
        {FAR.map((row) => [
          <span key={`l${row}`} className="hunt__row small mono">
            {row}
          </span>,
          ...cols.map((c) => cell(row, c)),
        ])}
        <span className="hunt__channel small" style={{ gridColumn: `1 / span ${cols.length + 1}` }}>
          {m.lab.panels.channel}
        </span>
        {NEAR.map((row) => [
          <span key={`l${row}`} className="hunt__row small mono">
            {row}
          </span>,
          ...cols.map((c) => cell(row, c)),
        ])}
      </div>
      <div className="panel__actions">
        <button type="button" className="btn btn--small btn--primary" onClick={() => runtime.answerPanel(cfg.id, picked)} data-panel-check>
          {m.lab.panels.check}
        </button>
      </div>
      <Verdict state={state} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------

/** Our own small switch symbols: a hinged lever at the pole, resting near a throw. */
function SymbolGlyph({ kind, x }: { kind: SymbolKind; x: number }) {
  if (kind === "none") return <rect x={x + 6} y={14} width={44} height={36} rx={4} className="sym__empty" />;
  return (
    <g transform={`translate(${x},0)`} className="sym__line">
      <circle cx={10} cy={44} r={2.6} />
      <path d="M2 44h5.4" />
      {kind === "button" ? (
        <>
          <circle cx={46} cy={44} r={2.6} />
          <path d="M48.6 44H56M12 36h32M28 36v-12M22 24h12" />
        </>
      ) : (
        <>
          <path d="M12.3 42.6L44 30" />
          <circle cx={46} cy={30} r={2.6} />
          <path d="M48.6 30H56" />
          {kind === "spdt" && (
            <>
              <circle cx={46} cy={50} r={2.6} />
              <path d="M48.6 50H56" />
            </>
          )}
        </>
      )}
    </g>
  );
}

function SymbolPanel({ runtime, cfg }: { runtime: LabRuntime; cfg: Extract<PanelConfig, { kind: "symbol" }> }) {
  const state = usePanel(runtime, cfg.id);
  const id = useId();
  const [slots, setSlots] = useState<[SymbolKind, SymbolKind]>(["none", "none"]);
  const [linked, setLinked] = useState(false);
  const kinds: SymbolKind[] = ["none", "spst", "spdt", "button"];
  return (
    <section className="instrument panel" aria-labelledby={`${id}-t`} data-panel={cfg.id}>
      <header className="instrument__head">
        <h3 id={`${id}-t`} className="instrument__title">
          {cfg.title ?? m.lab.panels.symbolTitle}
        </h3>
      </header>
      <p className="small muted panel__help">{m.lab.panels.symbolHelp}</p>
      <div className="sym">
        <svg viewBox="0 0 132 64" className="sym__canvas" role="img" aria-label={m.lab.panels.symbolPreview}>
          <SymbolGlyph kind={slots[0]} x={4} />
          <SymbolGlyph kind={slots[1]} x={72} />
          {linked && <path d="M30 37H98" className="sym__link" />}
        </svg>
        <div className="sym__controls">
          {[0, 1].map((i) => (
            <label key={i} className="sym__slot small">
              <span>{m.lab.panels.slot(i + 1)}</span>
              <select className="select select--small" value={slots[i]} onChange={(e) => setSlots((s) => (i === 0 ? [e.target.value as SymbolKind, s[1]] : [s[0], e.target.value as SymbolKind]))}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {m.lab.panels.symbols[k]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="sym__check small">
            <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
            {m.lab.panels.linked}
          </label>
        </div>
      </div>
      <div className="panel__actions">
        <button type="button" className="btn btn--small btn--primary" onClick={() => runtime.answerPanel(cfg.id, { slots, linked })} data-panel-check>
          {m.lab.panels.check}
        </button>
      </div>
      <Verdict state={state} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------

/** Every panel the lab declares, in order. */
/** The lab's panels for the current task. `only` shows just that panel (a bench lesson shows one tool at a time). */
export function LabPanels({ runtime, only }: { runtime: LabRuntime; only?: string }) {
  const status = useStore(runtime.ui, (s) => s.status);
  const tasks = runtime.lab.tasks;
  // The first required task still to do: panels for it (and for tasks already reached) show.
  const current = tasks.find((t) => !t.optional && !t.bonus && status[t.id] === "todo")?.id;
  const reached = (id: string) => status[id] !== "todo" || id === current || !!tasks.find((t) => t.id === id && (t.optional || t.bonus));
  const panels = (runtime.lab.panels ?? []).filter((p) => (only ? p.id === only : !p.show || p.show.some(reached)));
  if (!panels.length) return null;
  return (
    <>
      {panels.map((cfg) => {
        switch (cfg.kind) {
          case "continuity":
            return <ContinuityPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "truth-table":
            return <TruthTablePanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "pin-map":
            return <PinMapPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "tags":
            return <TagsPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "hole-hunt":
            return <HoleHuntPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "symbol":
            return <SymbolPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "xray":
            return <XrayPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "timing":
            return <TimingPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "histogram":
            return <HistogramPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "keys":
            return <KeysPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
          case "chart":
            return <ChartPanel key={cfg.id} cfg={cfg} />;
          case "readings":
            return <ReadingsPanel key={cfg.id} runtime={runtime} cfg={cfg} />;
        }
      })}
    </>
  );
}
