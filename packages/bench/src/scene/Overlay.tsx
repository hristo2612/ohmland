// DOM controls over the 3D view: toolbar, tray, selection bar, context menu and hover status.

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { formatFarads, formatOhms } from "../colorCode";
import { useLabels } from "../labels";
import type { BenchLabels } from "../labels";
import { DIAL_MODES } from "../layout";
import * as ops from "../ops";
import { isThrowSwitch, partDef } from "../parts";
import { useBench, useBenchStore } from "../store";
import type { LeadColor, MeterMode, PlacedPart, TrayItem, WireColor } from "../types";
import { LED_HEX, WIRE_HEX } from "../three/materials";
import { PartIcon, ToolIcon } from "./icons";
import type { InteractionApi } from "./Interaction";

const CSS = `
.ohb-root:focus-visible{box-shadow:inset 0 0 0 3px var(--ohb-focus,#2f7df6)}
.ohb-ui{position:absolute;inset:0;pointer-events:none;font:500 13px/1.25 Inter,"Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--ohb-fg,#2b2620)}
.ohb-panel{pointer-events:auto;background:var(--ohb-panel,rgba(255,251,244,.92));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(60,45,30,.12);border-radius:14px;box-shadow:0 6px 24px rgba(60,40,20,.14),0 1px 2px rgba(60,40,20,.12)}
.ohb-row{display:flex;gap:4px;align-items:center;padding:4px}
.ohb-btn{all:unset;box-sizing:border-box;cursor:pointer;min-width:44px;height:44px;padding:0 10px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:inherit;font-weight:600}
.ohb-btn:hover{background:rgba(60,45,30,.07)}
.ohb-btn:focus-visible{outline:2px solid var(--ohb-focus,#2f7df6);outline-offset:1px}
.ohb-btn[aria-pressed=true]{background:var(--ohb-accent-soft,rgba(255,138,31,.18));color:var(--ohb-accent-fg,#a34b00)}
.ohb-btn:disabled{opacity:.35;cursor:default}
.ohb-sep{width:1px;height:28px;background:rgba(60,45,30,.14);margin:0 2px}
.ohb-sw{all:unset;cursor:pointer;width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(0,0,0,.25);margin:9px 3px}
.ohb-sw[aria-pressed=true]{box-shadow:0 0 0 2px var(--ohb-fg,#2b2620)}
.ohb-sw:focus-visible{outline:2px solid var(--ohb-focus,#2f7df6);outline-offset:2px}
.ohb-tray{position:absolute;left:10px;top:10px;bottom:10px;width:186px;display:flex;flex-direction:column;overflow:hidden}
.ohb-tray h2{margin:10px 12px 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(43,38,32,.6)}
.ohb-tray-list{overflow:auto;padding:4px 6px 8px;display:grid;grid-template-columns:1fr 1fr;gap:4px}
.ohb-item{all:unset;box-sizing:border-box;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;border-radius:10px;min-height:64px;padding:6px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;font-size:10.5px;line-height:1.12;overflow-wrap:anywhere;color:rgba(43,38,32,.86)}
.ohb-item:hover{background:rgba(60,45,30,.07)}
.ohb-item[aria-pressed=true]{background:var(--ohb-accent-soft,rgba(255,138,31,.2));outline:2px solid var(--ohb-accent,#ff8a1f)}
.ohb-item:focus-visible{outline:2px solid var(--ohb-focus,#2f7df6)}
.ohb-item small{opacity:.6}
.ohb-tools{position:absolute;top:10px;left:206px}
.ohb-view{position:absolute;top:10px;right:10px}
.ohb-sel{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);max-width:calc(100% - 24px)}
.ohb-sel .ohb-name{padding:0 10px 0 12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.ohb-menu{position:absolute;min-width:180px;padding:4px;display:flex;flex-direction:column}
.ohb-menu .ohb-btn{justify-content:flex-start}
.ohb-status{position:absolute;left:206px;bottom:14px;padding:6px 10px;font-size:12px;font-weight:600}
.ohb-hint{position:absolute;top:66px;left:50%;transform:translateX(-50%);padding:7px 12px;font-size:12.5px;white-space:nowrap}
.ohb-select{all:unset;height:36px;padding:0 10px;border-radius:9px;background:rgba(60,45,30,.06);font-weight:600;cursor:pointer}
.ohb-seg{display:inline-flex;gap:2px;padding:2px;border-radius:12px;background:rgba(60,45,30,.06)}
.ohb-chip{min-width:44px;padding:0 9px;font-size:12.5px}
.ohb-sel .ohb-row{flex-wrap:wrap;justify-content:center}
.ohb-compact .ohb-tray{left:8px;right:8px;top:auto;bottom:8px;width:auto;height:92px}
.ohb-compact .ohb-tray h2{display:none}
.ohb-compact .ohb-tray-list{display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:6px}
.ohb-compact .ohb-item{min-width:70px}
.ohb-compact .ohb-tools{left:8px;top:8px}
.ohb-compact .ohb-view{right:8px;top:8px}
.ohb-compact .ohb-sel{bottom:108px}
.ohb-compact .ohb-status{left:8px;bottom:108px}
.ohb-compact .ohb-hint{top:62px;white-space:normal;width:calc(100% - 32px);text-align:center}
.ohb-compact .ohb-tools .ohb-label,.ohb-compact .ohb-sel .ohb-label{display:none}
.ohb-notray .ohb-tools,.ohb-notray .ohb-status{left:10px}
`;

const WIRE_COLORS: WireColor[] = ["red", "black", "blue", "green", "yellow", "orange", "white", "purple"];
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
  return { name: item.label ? item.label : name, detail: item.label ? undefined : detail };
}

function partTitle(part: PlacedPart, labels: BenchLabels): string {
  const base = labels.partName[part.kind];
  const p = part.params as Record<string, unknown>;
  if (part.kind === "resistor") return `${part.id} · ${formatOhms(p.ohms as number)}`;
  if (part.kind === "ceramic-cap" || part.kind === "electrolytic-cap") return `${part.id} · ${formatFarads(p.farads as number)}`;
  return `${part.id} · ${base}`;
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
}: {
  tray: TrayItem[];
  readOnly: boolean;
  compact: boolean;
  api: React.MutableRefObject<InteractionApi | null>;
  /** Container size in pixels. */
  size: { w: number; h: number };
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
  const selWire = sel?.type === "wire" ? bench.wires.find((w) => w.id === sel.id) : undefined;
  const selLead = sel?.type === "lead" ? bench.leads.find((l) => l.id === sel.id) : undefined;
  const showTray = !readOnly && tray.length > 0;
  const placed = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of bench.parts) m.set(p.kind, (m.get(p.kind) ?? 0) + 1);
    m.set("lead", bench.leads.length);
    return m;
  }, [bench]);

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
      for (const st of def.settings ?? []) {
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
            const p = ops.actionParams(s.bench, selPart.id, a.id);
            if (p) s.setParams(selPart.id, p as never);
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

  const selName = selPart ? partTitle(selPart, labels) : selWire ? `${selWire.id} · ${labels.colors[selWire.color]}` : selLead ? `${selLead.id} · ${labels.testLead}` : sel?.type === "meter" ? labels.meter : "";

  return (
    <div className={`ohb-ui${compact ? " ohb-compact" : ""}${showTray ? "" : " ohb-notray"}`} data-bench-ui="">
      <style>{CSS}</style>
      {showTray && (
        <div className="ohb-panel ohb-tray" role="list" aria-label={labels.tray}>
          <h2>{labels.tray}</h2>
          <div className="ohb-tray-list">
            {tray.map((item, i) => {
              const { name, detail } = itemLabel(item, labels);
              const left = item.count === undefined ? undefined : Math.max(0, item.count - (placed.get(item.kind) ?? 0));
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
                  disabled={left === 0}
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
                  {left !== undefined && <small>× {left}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="ohb-panel ohb-tools">
        <div className="ohb-row">
          {/* Wiring and x-ray only mean something on a breadboard. */}
          {!readOnly && bench.board && (
            <>
              <Btn label={labels.select} icon={<ToolIcon name="select" />} pressed={ui.mode === "select"} compact={compact} onClick={() => s.setUi({ mode: "select", wireDraft: null })} />
              <Btn label={labels.wire} icon={<ToolIcon name="wire" />} pressed={ui.mode === "wire"} compact={compact} onClick={() => s.setUi({ mode: "wire", wireDraft: null })} />
              {ui.mode === "wire" &&
                WIRE_COLORS.slice(0, compact ? 4 : 8).map((c) => (
                  <button key={c} type="button" className="ohb-sw" aria-label={`${labels.wireColor}: ${labels.colors[c]}`} aria-pressed={ui.wireColor === c} style={{ background: WIRE_HEX[c] }} onClick={() => s.setUi({ wireColor: c })} />
                ))}
              <span className="ohb-sep" />
            </>
          )}
          {bench.board && <Btn label={labels.xray} icon={<ToolIcon name="xray" />} pressed={ui.xray} compact={compact} onClick={() => s.setUi({ xray: !ui.xray })} />}
          {!readOnly && (
            <>
              {bench.board && <span className="ohb-sep" />}
              <Btn label={labels.undo} icon={<ToolIcon name="undo" />} compact onClick={() => s.undo()} disabled={!canUndo} />
              <Btn label={labels.redo} icon={<ToolIcon name="redo" />} compact onClick={() => s.redo()} disabled={!canRedo} />
            </>
          )}
        </div>
      </div>
      <div className="ohb-panel ohb-view">
        <div className="ohb-row">
          <Btn label={labels.topView} icon={<ToolIcon name="top" />} compact onClick={() => api.current?.topView()} />
          <Btn label={labels.resetView} icon={<ToolIcon name="reset" />} compact onClick={() => api.current?.resetView()} />
        </div>
      </div>
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
      {hoverText && !compact && <div className="ohb-panel ohb-status">{hoverText}</div>}
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
