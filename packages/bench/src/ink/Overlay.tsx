// The ink view's chrome: quiet paper slips that appear only when needed. The parts tray (small ink drawings), a
// couple of tools, a selection bar with the selected thing's actions, the context menu and a one-line hint.

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useStore } from "zustand";
import { chipDetail } from "../chips";
import { formatFarads, formatOhms } from "../colorCode";
import { DIAL_MODES } from "../layout";
import * as ops from "../ops";
import { isThrowSwitch, partDef } from "../parts";
import { trayLeft } from "../tray";
import type { BenchStore } from "../store";
import type { LeadColor, MeterMode, PlacedPart, TrayItem, WireColor } from "../types";
import { rectOfPoints } from "./camera";
import { INK, boxCorners, frameTransform, n3 } from "./frame";
import { InkIcon, type InkIconName } from "./icons";
import type { InkApi } from "./interaction";
import type { InkLabels } from "./labels";
import { partShownName } from "../labels";
import { PartDrawing } from "./kinds";
import { buildModel, type PartInk } from "./model";
import { WIRE_TOKEN } from "./styles";

const WIRE_COLORS: WireColor[] = ["red", "black", "blue", "green", "yellow", "orange", "white", "purple"];
const LEAD_COLORS: LeadColor[] = ["red", "black", "green", "yellow", "blue", "white"];

export function itemLabel(item: TrayItem, labels: InkLabels): { name: string; detail?: string } {
  if (item.kind === "lead") return { name: item.label ?? labels.testLead, detail: item.params?.color ? labels.colors[item.params.color] : undefined };
  const p = (item.params ?? {}) as Record<string, unknown>;
  let detail: string | undefined;
  if ((item.kind === "resistor" || item.kind === "trimmer") && typeof p.ohms === "number") detail = formatOhms(p.ohms);
  else if ((item.kind === "ceramic-cap" || item.kind === "electrolytic-cap") && typeof p.farads === "number") detail = formatFarads(p.farads);
  else if (item.kind === "led" && typeof p.color === "string") detail = labels.colors[p.color as WireColor] ?? String(p.color);
  else if (item.kind === "fuse" && typeof p.amps === "number") detail = `${p.amps} A`;
  else if (item.kind === "cup" && typeof p.water === "string") detail = labels.water[p.water as "tap"];
  else detail = chipDetail(item.kind, p);
  if (item.label) return { name: item.label };
  return { name: labels.partName[item.kind] ?? item.kind, detail };
}

/** A one-line description of a part (selection bar, screen readers). */
export function partDetail(part: PlacedPart): string | undefined {
  const p = part.params as Record<string, unknown>;
  if ((part.kind === "resistor" || part.kind === "trimmer") && typeof p.ohms === "number") return formatOhms(p.ohms);
  if ((part.kind === "ceramic-cap" || part.kind === "electrolytic-cap") && typeof p.farads === "number") return formatFarads(p.farads);
  if (part.kind === "fuse" && typeof p.amps === "number") return `${p.amps} A`;
  // A chip is named by what is printed on it (a taped one by its tape); packs and the supply by their volts.
  return chipDetail(part.kind, p);
}

// ---------------------------------------------------------------------------------------------------------------
// Tray drawings: the part as it lies on the desk, scaled into a small box.

const trayCache = new Map<string, { pi: PartInk; vb: string } | null>();

function trayInk(item: TrayItem): { pi: PartInk; vb: string } | null {
  const key = JSON.stringify([item.kind, item.params ?? {}]);
  if (trayCache.has(key)) return trayCache.get(key)!;
  let out: { pi: PartInk; vb: string } | null = null;
  if (item.kind !== "lead") {
    const [b, id] = ops.addPart(ops.emptyBench(null), item.kind, (item.params ?? {}) as never, { pos: [0, 0] });
    const pi = buildModel(b).parts.get(id)!;
    const r = rectOfPoints([...boxCorners(pi.f, pi.box), ...Object.values(pi.legs)], 1.5)!;
    out = { pi, vb: `${n3(r[0])} ${n3(r[1])} ${n3(r[2] - r[0])} ${n3(r[3] - r[1])}` };
  }
  trayCache.set(key, out);
  return out;
}

const TrayPicture = memo(function TrayPicture({ item }: { item: TrayItem }) {
  if (item.kind === "lead") {
    const c = WIRE_TOKEN(item.params?.color ?? "red");
    const w = { ["--w" as string]: `${INK.cableW}px`, ["--px" as string]: "0.35" };
    return (
      <svg viewBox="-4 -14 64 28" aria-hidden="true" className="ohi-svg-mini" style={w}>
        <path d="M10 2C22 14 34 -12 46 2" className="edge" />
        <path d="M10 2C22 14 34 -12 46 2" className="core" style={{ stroke: c }} />
        <g transform="translate(-6 2)">
          <rect x={0} y={-2.6} width={7.5} height={5.2} className="f-metal ln" />
          <rect x={7.5} y={-2.6} width={9} height={5.2} rx={1.4} style={{ fill: c }} className="ln" />
        </g>
        <g transform="translate(62 2) rotate(180)">
          <rect x={0} y={-2.6} width={7.5} height={5.2} className="f-metal ln" />
          <rect x={7.5} y={-2.6} width={9} height={5.2} rx={1.4} style={{ fill: c }} className="ln" />
        </g>
      </svg>
    );
  }
  const t = trayInk(item);
  if (!t) return null;
  return (
    <svg viewBox={t.vb} aria-hidden="true" preserveAspectRatio="xMidYMid meet" style={{ ["--px" as string]: "0.3" }}>
      <g transform={frameTransform(t.pi.f)}>
        <PartDrawing pi={t.pi} st={null} pressed={false} minutes={0} />
      </g>
    </svg>
  );
});

// ---------------------------------------------------------------------------------------------------------------

function Btn({ label, icon, onClick, pressed, disabled, showLabel, onPointerDown, onPointerUp }: {
  label: string;
  icon: InkIconName;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
}) {
  return (
    <button
      type="button"
      className="ohi-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <InkIcon name={icon} />
      {showLabel && <span className="ohi-label">{label}</span>}
    </button>
  );
}

export type OverlayProps = {
  store: BenchStore;
  labels: InkLabels;
  tray: TrayItem[];
  readOnly: boolean;
  compact: boolean;
  api: React.MutableRefObject<InkApi | null>;
  size: { w: number; h: number };
  /** The view has moved away from its fit (show the "show everything" button). */
  moved: boolean;
  onFit: () => void;
  /** A tray item was armed from the keyboard: put the cursor on the bench. */
  onArmKey: () => void;
};

export function InkOverlay({ store, labels, tray, readOnly, compact, api, size, moved, onFit, onArmKey }: OverlayProps) {
  const ui = useStore(store, (s) => s.ui);
  const bench = useStore(store, (s) => s.bench);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const locked = useStore(store, (s) => s.locked);
  const names = useStore(store, (s) => s.names);
  const s = store.getState();
  const sel = ui.selection;
  const selPart = sel?.type === "part" ? bench.parts.find((p) => p.id === sel.id) : undefined;
  const selWire = sel?.type === "wire" ? bench.wires.find((w) => w.id === sel.id) : undefined;
  const selLead = sel?.type === "lead" ? bench.leads.find((l) => l.id === sel.id) : undefined;
  // What is left of each item, counted as the 3D view counts it (leads by colour, parts by kind and params).
  // Items that are used up leave the tray (fewer things to look at).
  const items = useMemo(() => tray.map((item) => ({ item, left: trayLeft(item, bench) })).filter((x) => x.left !== 0), [tray, bench]);
  const showTray = !readOnly && items.length > 0;

  const actions = (inMenu: boolean) => {
    const out: ReactNode[] = [];
    const close = () => inMenu && s.setUi({ menu: null });
    // The finger that opened a menu by long-press lifts right after; ignore that release as a choice.
    const fresh = () => inMenu && !!ui.menu && performance.now() - ui.menu.at < 400;
    const label = !compact || inMenu;
    if (selPart) {
      if (isThrowSwitch(selPart.kind)) {
        out.push(
          <Btn key="flip" label={labels.toggle} icon="flip" showLabel={label} onClick={() => {
            if (fresh()) return;
            s.setParams<"slide-switch">(selPart.id, { to: (selPart.params as { to: string }).to === "a" ? "b" : "a" });
            close();
          }} />,
        );
      }
      if (selPart.kind === "pushbutton") {
        out.push(<Btn key="press" label={labels.press} icon="press" showLabel={label} onPointerDown={() => s.press(selPart.id, true)} onPointerUp={() => s.press(selPart.id, false)} />);
      }
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
            <select key={`set:${st.key}`} className="ohi-select" aria-label={text?.label ?? st.key} value={String(cur)} onChange={(e) => set(st.values.find((v) => String(v) === e.target.value) ?? e.target.value)}>
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
            <span key={`set:${st.key}`} role="group" aria-label={text?.label ?? st.key} className="ohi-seg">
              {st.values.map((v) => (
                <button key={String(v)} type="button" className="ohi-btn ohi-chip" aria-pressed={cur === v} onClick={() => set(v)}>
                  {name(v)}
                </button>
              ))}
            </span>,
          );
        }
      }
      for (const a of def.actions ?? []) {
        out.push(
          <button key={`act:${a.id}`} type="button" className="ohi-btn ohi-chip" onClick={() => {
            if (fresh()) return;
            s.apply((b) => ops.runAction(b, selPart.id, a.id));
            close();
          }}>
            {labels.actions[`${selPart.kind}.${a.id}`] ?? a.id}
          </button>,
        );
      }
      if (!locked.includes(selPart.id)) out.push(<Btn key="rot" label={labels.rotate} icon="rotate" showLabel={label} onClick={() => { if (fresh()) return; s.rotatePart(selPart.id); close(); }} />);
    }
    if (sel?.type === "meter" && bench.meter && !inMenu) {
      out.push(
        <select key="dial" className="ohi-select" aria-label={labels.meter} value={bench.meter.mode} onChange={(e) => s.setMeterMode(e.target.value as MeterMode)}>
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
            <button key={c} type="button" className="ohi-sw" aria-label={labels.colors[c]} aria-pressed={selWire.color === c} style={{ background: WIRE_TOKEN(c) }} onClick={() => { if (fresh()) return; s.apply((b) => ops.setWireColor(b, selWire.id, c)); close(); }} />
          ))}
        </span>,
      );
    }
    if (selLead && (!compact || inMenu)) {
      out.push(
        <span key="lc" role="group" aria-label={labels.leadColor} style={{ display: "inline-flex", flexWrap: "wrap" }}>
          {LEAD_COLORS.map((c) => (
            <button key={c} type="button" className="ohi-sw" aria-label={labels.colors[c]} aria-pressed={selLead.color === c} style={{ background: WIRE_TOKEN(c) }} onClick={() => { if (fresh()) return; s.apply((b) => ops.setLeadColor(b, selLead.id, c)); close(); }} />
          ))}
        </span>,
      );
    }
    if (sel && sel.type !== "meter" && !(sel.type === "part" && locked.includes(sel.id))) {
      out.push(<Btn key="del" label={labels.delete} icon="delete" showLabel={label} onClick={() => { if (fresh()) return; s.deleteSelected(); close(); }} />);
    }
    return out;
  };

  const selName = selPart
    ? `${selPart.id} · ${partShownName(selPart, partDetail(selPart), names, labels.partName[selPart.kind])}`
    : selWire
      ? `${selWire.id} · ${labels.colors[selWire.color]}`
      : selLead
        ? `${selLead.id} · ${labels.testLead}`
        : sel?.type === "meter"
          ? labels.meter
          : "";
  const selActions = sel && !readOnly ? actions(false) : [];

  return (
    <div className={`ohi-ui${compact ? " ohi-compact" : ""}${showTray ? "" : " ohi-notray"}`} data-ink-ui="" style={{ pointerEvents: "none" }}>
      {showTray && (
        <div className="ohi-slip ohi-tray" role="list" aria-label={labels.tray}>
          <h2>{labels.tray}</h2>
          <div className="ohi-tray-list">
            {items.map(({ item, left }, i) => {
              const { name, detail } = itemLabel(item, labels);
              return (
                <button
                  key={i}
                  type="button"
                  role="listitem"
                  className="ohi-item"
                  aria-pressed={ui.armed === item}
                  aria-label={[name, detail, left !== undefined ? `× ${left}` : undefined].filter(Boolean).join(", ")}
                  title={labels.trayHint}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    api.current?.startSpawn(item, e.nativeEvent);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const arm = ui.armed === item ? null : item;
                      s.setUi({ armed: arm });
                      if (arm) onArmKey();
                    }
                  }}
                >
                  <TrayPicture item={item} />
                  <span>{name}</span>
                  {detail && <small>{detail}</small>}
                  {left !== undefined && left > 1 && <small>{`× ${left}`}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {((!readOnly && (bench.board || canUndo || canRedo)) || bench.board) && (
        <div className="ohi-slip ohi-tools">
          <div className="ohi-row">
            {/* Wiring and x-ray only mean something on a breadboard. */}
            {!readOnly && bench.board && (
              <>
                <Btn label={labels.wire} icon="wire" pressed={ui.mode === "wire"} showLabel={!compact} onClick={() => s.setUi({ mode: ui.mode === "wire" ? "select" : "wire", wireDraft: null })} />
                {ui.mode === "wire" &&
                  WIRE_COLORS.slice(0, compact ? 4 : 8).map((c) => (
                    <button key={c} type="button" className="ohi-sw" aria-label={`${labels.wireColor}: ${labels.colors[c]}`} aria-pressed={ui.wireColor === c} style={{ background: WIRE_TOKEN(c) }} onClick={() => s.setUi({ wireColor: c })} />
                  ))}
              </>
            )}
            {bench.board && <Btn label={labels.xray} icon="xray" pressed={ui.xray} showLabel={!compact} onClick={() => s.setUi({ xray: !ui.xray })} />}
            {!readOnly && (canUndo || canRedo) && (
              <>
                {bench.board && <span className="ohi-sep" />}
                <Btn label={labels.undo} icon="undo" onClick={() => s.undo()} disabled={!canUndo} />
                <Btn label={labels.redo} icon="redo" onClick={() => s.redo()} disabled={!canRedo} />
              </>
            )}
          </div>
        </div>
      )}
      {/* Zoom is the wheel, a pinch or + and -; the one button comes back only once the view has wandered. */}
      {moved && (
        <div className="ohi-slip ohi-view">
          <div className="ohi-row">
            <Btn label={labels.fit} icon="fit" onClick={onFit} />
          </div>
        </div>
      )}
      {ui.mode === "wire" && !readOnly && <div className="ohi-hint">{labels.wireHint}</div>}
      {ui.armed && !readOnly && <div className="ohi-hint">{labels.trayHint}</div>}
      {sel && !ui.dragging && !ui.menu && (selActions.length > 0 || !compact) && (
        <div className="ohi-slip ohi-sel">
          <div className="ohi-row">
            <span className="ohi-name">{selName}</span>
            {selActions}
          </div>
        </div>
      )}
      {ui.menu && !readOnly && (
        <div className="ohi-slip ohi-menu" style={menuStyle(ui.menu.x, ui.menu.y, size.w, size.h)} role="menu">
          {actions(true)}
          <button type="button" className="ohi-btn" onClick={() => performance.now() - ui.menu!.at > 400 && s.setUi({ menu: null })}>
            {labels.cancel}
          </button>
        </div>
      )}
    </div>
  );
}

/** Open the menu beside the pointer (not under the finger), kept inside the bench. */
function menuStyle(x: number, y: number, w: number, h: number): CSSProperties {
  const mw = 200;
  const mh = 220;
  const left = x + 18 + mw > w ? Math.max(8, x - 18 - mw) : x + 18;
  const top = Math.min(Math.max(8, y - mh / 2), Math.max(8, h - mh - 8));
  return { left, top };
}

/** Floats a DOM element over a desk point, following the camera without re-rendering React. */
export function useFollow(subscribe: (cb: () => void) => () => void, place: () => { x: number; y: number } | null) {
  const ref = useRef<HTMLDivElement | null>(null);
  const placeRef = useRef(place);
  placeRef.current = place;
  const [, force] = useState(0);
  useEffect(() => {
    const run = () => {
      const el = ref.current;
      if (!el) return;
      const p = placeRef.current();
      if (!p) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    };
    run();
    const off = subscribe(run);
    force((n) => n + 1);
    return off;
  }, [subscribe]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = placeRef.current();
    if (!p) el.style.display = "none";
    else {
      el.style.display = "";
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    }
  });
  return ref;
}
