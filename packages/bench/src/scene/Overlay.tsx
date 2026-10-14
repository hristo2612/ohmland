// DOM controls over the 3D view: toolbar, tray, selection bar, context menu and hover status.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { chipDetail } from "../chips";
import { formatFarads, formatOhms } from "../colorCode";
import { useLabels } from "../labels";
import { partShownName, type BenchLabels } from "../labels";
import { DIAL_MODES } from "../layout";
import * as ops from "../ops";
import { isThrowSwitch, partDef } from "../parts";
import { useBench, useBenchStore } from "../store";
import { trayLeft } from "../tray";
import type { LeadColor, MeterMode, PlacedPart, TrayItem, WireColor } from "../types";
import { LED_HEX, WIRE_HEX } from "../three/materials";
import { PartIcon, ToolIcon } from "./icons";
import type { InteractionApi } from "./Interaction";
import { COMPACT_WIDTH, NARROW_TRAY, trayCoverOf } from "../view/tray-cover";

// Quiet, notebook-style chrome: pasted paper slips with hairline rules, ink icons, blue ink for what the learner has
// switched on. Colours and type come from the page's notebook tokens when it has them (fallbacks are the light page).
const CSS = `
.ohb-root:focus-visible{box-shadow:inset 0 0 0 2px var(--focus,#1F3C9A)}
.ohb-readouts{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.ohb-stress{position:absolute;left:0;top:0;width:120px;height:14px;background:var(--paper-slip,#FCFAF5);border:1px solid var(--rule-soft,#D8D0C1);box-shadow:2px 2px 0 var(--shadow-ink,#E1D9CA)}
.ohb-stress i{position:absolute;left:0;top:0;bottom:0;background:var(--sk-band-green,#3C8B4A)}
.ohb-stress[data-tone="mid"] i{background:var(--sk-band-orange,#E07B24)}
.ohb-stress[data-tone="high"] i{background:var(--sk-band-red,#C9372A)}
.ohb-stress[data-tone="dead"] i{background:var(--ink-3,#6B655B)}
.ohb-stress b{position:absolute;top:0;bottom:0;width:1px;background:var(--ink,#24221E)}
.ohb-readouts[data-compact] .ohb-stress{width:64px;height:10px}
.ohb-stress[data-spot]{outline:2px solid var(--red,#B23A1C);outline-offset:5px;border-radius:2px}
.ohb-root[data-dark] .ohb-stress i{background:var(--sk-band-green,#4FA35D)}
.ohb-root[data-dark] .ohb-stress[data-tone="mid"] i{background:var(--sk-band-orange,#EB8F3A)}
.ohb-root[data-dark] .ohb-stress[data-tone="high"] i{background:var(--sk-band-red,#E0584A)}
.ohb-root[data-dark] .ohb-stress[data-tone="dead"] i{background:var(--ink-3,#9A9488)}
.ohb-root[data-dark] .ohb-stress b{background:var(--ink,#ECE6DA)}
.ohb-ui{position:absolute;inset:0;pointer-events:none;font:400 14px/20px var(--font-serif,"Literata",Georgia,"Times New Roman",serif);color:var(--ink,#24221E)}
.ohb-panel{pointer-events:auto;background:var(--paper-slip,#FCFAF5);border:1px solid var(--rule-soft,#D8D0C1);border-radius:2px;box-shadow:2px 2px 0 var(--shadow-ink,#E1D9CA)}
.ohb-row{display:flex;gap:2px;align-items:center;padding:2px}
.ohb-btn{all:unset;box-sizing:border-box;cursor:pointer;min-width:44px;height:44px;padding:0 10px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--ink-2,#57524A);font:inherit;white-space:nowrap}
.ohb-btn:hover{color:var(--ink,#24221E);background:var(--paper-sunk,#EEE8DC)}
.ohb-btn:focus-visible{outline:2px solid var(--focus,#1F3C9A);outline-offset:-2px}
.ohb-btn[aria-pressed=true]{background:var(--blue-wash,#E1E6F4);color:var(--blue,#1F3C9A)}
.ohb-btn:disabled{opacity:.35;cursor:default;background:none}
.ohb-sep{width:1px;height:24px;background:var(--rule-soft,#D8D0C1);margin:0 2px}
.ohb-sw{all:unset;cursor:pointer;width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(36,34,30,.35);margin:11px 4px}
.ohb-sw[aria-pressed=true]{box-shadow:inset 0 0 0 1px rgba(36,34,30,.35),0 0 0 2px var(--paper-slip,#FCFAF5),0 0 0 3.5px var(--blue,#1F3C9A)}
.ohb-sw:focus-visible{outline:2px solid var(--focus,#1F3C9A);outline-offset:3px}
.ohb-tray{position:absolute;left:12px;top:12px;max-height:calc(100% - 24px);width:112px;display:flex;flex-direction:column;overflow:hidden}
.ohb-tray.ohb-wide{width:208px}
.ohb-tray h2{margin:8px 10px 2px;font-weight:600;font-size:12px;line-height:16px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#6B655B)}
.ohb-tray-list{overflow:auto;padding:2px 4px 4px;display:grid;grid-template-columns:1fr;gap:2px}
.ohb-wide .ohb-tray-list{grid-template-columns:1fr 1fr}
.ohb-item{all:unset;box-sizing:border-box;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:2px;min-height:64px;padding:6px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;text-align:center;font-size:14px;line-height:18px;overflow-wrap:break-word;hyphens:auto;-webkit-hyphens:auto;color:var(--ink,#24221E)}
.ohb-item:hover{background:var(--paper-sunk,#EEE8DC)}
.ohb-item[aria-pressed=true]{background:var(--blue-wash,#E1E6F4);box-shadow:inset 0 0 0 1.5px var(--blue,#1F3C9A)}
.ohb-item:focus-visible{outline:2px solid var(--focus,#1F3C9A);outline-offset:-2px}
.ohb-item:disabled{opacity:.4;cursor:default;background:none}
.ohb-item small{font-size:13px;line-height:16px;color:var(--ink-3,#6B655B)}
.ohb-item svg{color:var(--ink-2,#57524A)}
.ohb-tools{position:absolute;top:12px;left:136px}
.ohb-tools.ohb-wide-tray{left:232px}
.ohb-view{position:absolute;top:12px;right:12px}
.ohb-sel{position:absolute;bottom:calc(14px + var(--ohb-inset-bottom,0px));left:calc((100% - var(--ohb-inset-right,0px)) / 2);transform:translateX(-50%);max-width:calc(100% - 24px - var(--ohb-inset-right,0px))}
.ohb-sel .ohb-name{padding:0 8px 0 12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.ohb-menu{position:absolute;min-width:180px;padding:2px;display:flex;flex-direction:column}
.ohb-menu .ohb-btn{justify-content:flex-start}
.ohb-status{position:absolute;left:136px;bottom:14px;padding:2px 8px;font-size:14px;color:var(--ink-2,#57524A);background:var(--paper,#F6F2E9)}
.ohb-status.ohb-wide-tray{left:232px}
.ohb-hint{position:absolute;top:66px;left:50%;transform:translateX(-50%);padding:6px 12px;color:var(--ink-2,#57524A);white-space:nowrap}
.ohb-select{all:unset;height:36px;padding:0 10px;border-radius:2px;background:var(--paper-sunk,#EEE8DC);font:inherit;cursor:pointer}
.ohb-seg{display:inline-flex;gap:2px;padding:2px;border-radius:2px;background:var(--paper-sunk,#EEE8DC)}
.ohb-chip{min-width:44px;padding:0 9px;font-size:14px}
.ohb-sel .ohb-row{flex-wrap:wrap;justify-content:center}
.ohb-compact .ohb-tray{left:8px;right:8px;top:auto;bottom:8px;width:auto;height:76px}
.ohb-compact .ohb-tray h2{display:none}
.ohb-compact .ohb-tray-list{display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:4px}
.ohb-compact .ohb-item{min-width:72px;min-height:0;font-size:13px;line-height:16px}
.ohb-compact .ohb-tools{left:8px;top:8px}
.ohb-compact .ohb-view{right:8px;top:8px}
.ohb-compact .ohb-sel{bottom:calc(92px + var(--ohb-inset-bottom,0px))}
.ohb-compact .ohb-status{left:8px;bottom:92px}
.ohb-compact .ohb-hint{top:60px;white-space:normal;width:calc(100% - 32px);text-align:center}
.ohb-compact .ohb-tools .ohb-label,.ohb-compact .ohb-sel .ohb-label{display:none}
.ohb-notray .ohb-tools,.ohb-notray .ohb-status{left:12px}
.ohb-compact.ohb-notray .ohb-sel{bottom:14px}
@media (prefers-reduced-motion:no-preference){.ohb-panel{animation:ohb-in .16s cubic-bezier(.2,.7,.2,1)}}
@keyframes ohb-in{from{opacity:0;transform:translateY(2px)}}
.ohb-sel{animation-name:ohb-in-sel}
@keyframes ohb-in-sel{from{opacity:0;transform:translate(-50%,2px)}}
.ohb-hint{animation-name:ohb-in-sel}
`;

const WIRE_COLORS: WireColor[] = ["red", "black", "blue", "green", "yellow", "orange", "white", "purple"];

/** Width (CSS px) the tray covers on the left of a wide bench, so camera framing can avoid it. */
export function trayCover(items: number, compact: boolean): { left: number; bottom: number } {
  return trayCoverOf("3d", items, compact ? 1 : COMPACT_WIDTH);
}
const LEAD_COLORS: LeadColor[] = ["red", "black", "green", "yellow", "blue", "white"];

export function itemLabel(item: TrayItem, labels: BenchLabels): { name: string; detail?: string } {
  if (item.kind === "lead") return { name: item.label ?? labels.testLead, detail: item.params?.color ? labels.colors[item.params.color] : undefined };
  const name = item.label ?? labels.partName[item.kind];
  const p = (item.params ?? {}) as Record<string, unknown>;
  let detail: string | undefined;
  if (item.kind === "resistor" && typeof p.ohms === "number") detail = formatOhms(p.ohms);
  else if (item.kind === "trimmer" && typeof p.ohms === "number") detail = formatOhms(p.ohms);
  else if ((item.kind === "ceramic-cap" || item.kind === "electrolytic-cap") && typeof p.farads === "number") detail = formatFarads(p.farads);
  else if (item.kind === "led" && typeof p.color === "string") detail = labels.colors[p.color as WireColor] ?? String(p.color);
  else if (item.kind === "fuse" && typeof p.amps === "number") detail = `${p.amps} A`;
  else if (item.kind === "cup" && typeof p.water === "string") detail = labels.water[p.water as "tap"];
  else detail = chipDetail(item.kind, p);
  return { name: item.label ? item.label : name, detail: item.label ? undefined : detail };
}

function partTitle(part: PlacedPart, labels: BenchLabels, names: Readonly<Record<string, string>>): string {
  const p = part.params as Record<string, unknown>;
  const detail =
    part.kind === "resistor" ? formatOhms(p.ohms as number) : part.kind === "ceramic-cap" || part.kind === "electrolytic-cap" ? formatFarads(p.farads as number) : chipDetail(part.kind, p);
  return `${part.id} · ${partShownName(part, detail, names, labels.partName[part.kind])}`;
}

function Btn({ label, icon, onClick, pressed, disabled, compact, onPointerDown, onPointerUp }: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
}) {
  return (
    <button
      type="button"
      className="ohb-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {icon}
      {!compact && <span className="ohb-label">{label}</span>}
    </button>
  );
}


export function Overlay({
  tray,
  readOnly,
  compact,
  api,
  size,
  controller,
}: {
  tray: TrayItem[];
  readOnly: boolean;
  compact: boolean;
  api: React.MutableRefObject<InteractionApi | null>;
  /** Container size in pixels. */
  size: { w: number; h: number };
  /** The bench's controller (view changes, home view). */
  controller?: { onViewChange(cb: () => void): () => void; atHome(): boolean };
}) {
  const labels = useLabels();
  const store = useBenchStore();
  const ui = useBench((s) => s.ui);
  const bench = useBench((s) => s.bench);
  const canUndo = useBench((s) => s.past.length > 0);
  const canRedo = useBench((s) => s.future.length > 0);
  const s = store.getState();
  const sel = ui.selection;
  const selPart = sel?.type === "part" ? bench.parts.find((p) => p.id === sel.id) : undefined;
  const names = useBench((s) => s.names);
  const selWire = sel?.type === "wire" ? bench.wires.find((w) => w.id === sel.id) : undefined;
  const selLead = sel?.type === "lead" ? bench.leads.find((l) => l.id === sel.id) : undefined;
  // The tray steps aside once everything in it has been placed.
  const left = (item: TrayItem) => trayLeft(item, bench);
  const showTray = !readOnly && tray.length > 0 && tray.some((item) => left(item) !== 0);
  const wideTray = tray.length > NARROW_TRAY && !compact;
  // "Reset view" shows only once the learner has moved the camera away from the framing of the work area.
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (!controller) return;
    let frame = 0;
    const check = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setMoved(!controller.atHome());
      });
    };
    const off = controller.onViewChange(check);
    return () => {
      off();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [controller]);

  const hoverText = useMemo(() => {
    if (!ui.hover?.startsWith("hole:")) return null;
    return labels.hole(ui.hover.slice(5));
  }, [ui.hover, labels]);

  const actions = (inMenu: boolean) => {
    const out: ReactNode[] = [];
    const close = () => inMenu && s.setUi({ menu: null });
    // The finger that opened a menu by long-press lifts right after; ignore that release as a choice.
    const fresh = () => inMenu && !!ui.menu && performance.now() - ui.menu.at < 400;
    if (selPart) {
      if (isThrowSwitch(selPart.kind)) {
        out.push(
          <Btn key="flip" label={labels.toggle} icon={<ToolIcon name="flip" />} compact={compact && !inMenu} onClick={() => {
            if (fresh()) return;
            s.setParams<"slide-switch">(selPart.id, { to: (selPart.params as { to: string }).to === "a" ? "b" : "a" });
            close();
          }} />,
        );
      }
      if (selPart.kind === "pushbutton") {
        out.push(<Btn key="press" label={labels.press} icon={<ToolIcon name="press" />} compact={compact && !inMenu} onPointerDown={() => s.press(selPart.id, true)} onPointerUp={() => s.press(selPart.id, false)} />);
      }
      // Prop settings (moisture, a test load, a pencil line) and one-shot actions (erase).
      const def = partDef(selPart.kind);
      // Settings a part shows only in some labs (contact bounce) say so with `when`.
      for (const st of (def.settings ?? []).filter((x) => !x.when || x.when(selPart.params as Record<string, unknown>))) {
        const text = labels.settings[`${selPart.kind}.${st.key}`];
        const cur = (selPart.params as Record<string, unknown>)[st.key];
        const name = (v: string | number | boolean) => text?.values?.[String(v)] ?? `${v}${text?.unit ? ` ${text.unit}` : ""}`;
        const set = (v: string | number | boolean) => {
          if (fresh()) return;
          s.setParams(selPart.id, ops.settingParams(s.bench, selPart.id, st.key, v) as never);
        };
        if (st.values.length > 5) {
          out.push(
            <select key={`set:${st.key}`} className="ohb-select" aria-label={text?.label ?? st.key} value={String(cur)} onChange={(e) => set(st.values.find((v) => String(v) === e.target.value) ?? e.target.value)}>
              {!st.values.some((v) => String(v) === String(cur)) && <option value={String(cur)}>{name(cur as string)}</option>}
              {st.values.map((v) => (
                <option key={String(v)} value={String(v)}>
                  {name(v)}
                </option>
              ))}
            </select>,
          );
        } else {
          out.push(
            <span key={`set:${st.key}`} role="group" aria-label={text?.label ?? st.key} className="ohb-seg">
              {st.values.map((v) => (
                <button key={String(v)} type="button" className="ohb-btn ohb-chip" aria-pressed={cur === v} onClick={() => set(v)}>
                  {name(v)}
                </button>
              ))}
            </span>,
          );
        }
      }
      for (const a of def.actions ?? []) {
        out.push(
          <button key={`act:${a.id}`} type="button" className="ohb-btn ohb-chip" onClick={() => {
            if (fresh()) return;
            s.apply((b) => ops.runAction(b, selPart.id, a.id));
            close();
          }}>
            {labels.actions[`${selPart.kind}.${a.id}`] ?? a.id}
          </button>,
        );
      }
      if (!s.locked.includes(selPart.id)) out.push(<Btn key="rot" label={labels.rotate} icon={<ToolIcon name="rotate" />} compact={compact && !inMenu} onClick={() => { if (fresh()) return; s.rotatePart(selPart.id); close(); }} />);
    }
    if (sel?.type === "meter" && bench.meter && !inMenu) {
      out.push(
        <select key="dial" className="ohb-select" aria-label={labels.meter} value={bench.meter.mode} onChange={(e) => s.setMeterMode(e.target.value as MeterMode)}>
          {DIAL_MODES.map((m) => (
            <option key={m} value={m}>
              {labels.meterModes[m]}
            </option>
          ))}
        </select>,
      );
    }
    // On a phone the swatches would wrap into a panel over the bench; there they live in the long-press menu.
    if (selWire && (!compact || inMenu)) {
      out.push(
        <span key="wc" role="group" aria-label={labels.wireColor} style={{ display: "inline-flex", flexWrap: "wrap" }}>
          {WIRE_COLORS.map((c) => (
            <button key={c} type="button" className="ohb-sw" aria-label={labels.colors[c]} aria-pressed={selWire.color === c} style={{ background: WIRE_HEX[c] }} onClick={() => { if (fresh()) return; s.apply((b) => ({ ...b, wires: b.wires.map((w) => (w.id === selWire.id ? { ...w, color: c } : w)) })); close(); }} />
          ))}
        </span>,
      );
    }
    if (selLead && (!compact || inMenu)) {
      out.push(
        <span key="lc" role="group" aria-label={labels.leadColor} style={{ display: "inline-flex", flexWrap: "wrap" }}>
          {LEAD_COLORS.map((c) => (
            <button key={c} type="button" className="ohb-sw" aria-label={labels.colors[c]} aria-pressed={selLead.color === c} style={{ background: WIRE_HEX[c] }} onClick={() => { if (fresh()) return; s.apply((b) => ({ ...b, leads: b.leads.map((l) => (l.id === selLead.id ? { ...l, color: c } : l)) })); close(); }} />
          ))}
        </span>,
      );
    }
    if (sel && sel.type !== "meter" && !(sel.type === "part" && s.locked.includes(sel.id))) {
      out.push(<Btn key="del" label={labels.delete} icon={<ToolIcon name="delete" />} compact={compact && !inMenu} onClick={() => { if (fresh()) return; s.deleteSelected(); close(); }} />);
    }
    return out;
  };

  // Tools appear only where they mean something: wiring and x-ray on a breadboard, undo once there is history.
  const tools: ReactNode[] = [];
  if (bench.board && !readOnly) {
    tools.push(<Btn key="wire" label={labels.wire} icon={<ToolIcon name="wire" />} pressed={ui.mode === "wire"} compact={compact} onClick={() => s.setUi({ mode: ui.mode === "wire" ? "select" : "wire", wireDraft: null })} />);
    if (ui.mode === "wire")
      for (const c of WIRE_COLORS.slice(0, compact ? 4 : 8))
        tools.push(<button key={`sw-${c}`} type="button" className="ohb-sw" aria-label={`${labels.wireColor}: ${labels.colors[c]}`} aria-pressed={ui.wireColor === c} style={{ background: WIRE_HEX[c] }} onClick={() => s.setUi({ wireColor: c })} />);
  }
  if (bench.board) tools.push(<Btn key="xray" label={labels.xray} icon={<ToolIcon name="xray" />} pressed={ui.xray} compact={compact} onClick={() => s.setUi({ xray: !ui.xray })} />);
  const history = !readOnly && (canUndo || canRedo);

  const selName = selPart ? partTitle(selPart, labels, names) : selWire ? `${selWire.id} · ${labels.colors[selWire.color]}` : selLead ? `${selLead.id} · ${labels.testLead}` : sel?.type === "meter" ? labels.meter : "";

  return (
    <div className={`ohb-ui${compact ? " ohb-compact" : ""}${showTray ? "" : " ohb-notray"}`} data-bench-ui="">
      <style>{CSS}</style>
      {showTray && (
        <div className={`ohb-panel ohb-tray${wideTray ? " ohb-wide" : ""}`} role="list" aria-label={labels.tray}>
          <h2>{labels.tray}</h2>
          <div className="ohb-tray-list">
            {tray.map((item, i) => {
              const { name, detail } = itemLabel(item, labels);
              const remaining = left(item);
              const ledColor = item.kind === "led" ? String((item.params as { color?: string } | undefined)?.color ?? "red") : null;
              const color = item.kind === "lead" ? WIRE_HEX[item.params?.color ?? "red"] : ledColor ? LED_HEX[ledColor]?.lens : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  role="listitem"
                  className="ohb-item"
                  aria-pressed={ui.armed === item}
                  aria-label={[name, detail].filter(Boolean).join(", ")}
                  title={labels.trayHint}
                  disabled={remaining === 0}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    api.current?.startSpawn(item, e.nativeEvent);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      s.setUi({ armed: ui.armed === item ? null : item });
                    }
                  }}
                >
                  <PartIcon kind={item.kind} color={color} />
                  <span>{name}</span>
                  {detail && <small>{detail}</small>}
                  {remaining !== undefined && remaining > 1 && <small>× {remaining}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {(tools.length > 0 || history) && (
        <div className={`ohb-panel ohb-tools${wideTray && showTray ? " ohb-wide-tray" : ""}`}>
          <div className="ohb-row">
            {tools}
            {tools.length > 0 && history && <span className="ohb-sep" />}
            {history && (
              <>
                <Btn label={labels.undo} icon={<ToolIcon name="undo" />} compact onClick={() => s.undo()} disabled={!canUndo} />
                <Btn label={labels.redo} icon={<ToolIcon name="redo" />} compact onClick={() => s.redo()} disabled={!canRedo} />
              </>
            )}
          </div>
        </div>
      )}
      {moved && (
        <div className="ohb-panel ohb-view">
          <div className="ohb-row">
            <Btn label={labels.resetView} icon={<ToolIcon name="reset" />} compact onClick={() => api.current?.resetView()} />
          </div>
        </div>
      )}
      {ui.mode === "wire" && !readOnly && <div className="ohb-panel ohb-hint">{labels.wireHint}</div>}
      {ui.armed && !readOnly && <div className="ohb-panel ohb-hint">{labels.trayHint}</div>}
      {sel && !ui.dragging && !ui.menu && (
        <div className="ohb-panel ohb-sel">
          <div className="ohb-row">
            <span className="ohb-name">{selName}</span>
            {!readOnly && actions(false)}
          </div>
        </div>
      )}
      {ui.menu && !readOnly && (
        <div className="ohb-panel ohb-menu" style={menuStyle(ui.menu.x, ui.menu.y, size.w, size.h)} role="menu">
          {actions(true)}
          <Btn label={labels.cancel} icon={<span style={{ width: 20 }} />} onClick={() => performance.now() - ui.menu!.at > 400 && s.setUi({ menu: null })} />
        </div>
      )}
      {hoverText && !compact && <div className={`ohb-status${wideTray && showTray ? " ohb-wide-tray" : ""}`}>{hoverText}</div>}
    </div>
  );
}

/** Open the menu beside the pointer (not under the finger), kept inside the bench. */
function menuStyle(x: number, y: number, w: number, h: number): CSSProperties {
  const mw = 200;
  const mh = 200;
  const left = x + 18 + mw > w ? Math.max(8, x - 18 - mw) : x + 18;
  const top = Math.min(Math.max(8, y - mh / 2), Math.max(8, h - mh - 8));
  return { left, top };
}
