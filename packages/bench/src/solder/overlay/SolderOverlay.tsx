// The solder overlay: the station's clock, and the hands-on part of soldering, drawn over either view through its
// project() (docs/BENCH-VIEWS.md), so the iron, the solder, the spots, the magnifier and the heat view work and look
// the same in 3D and in ink. Renders nothing on a bench without solder kinds.
//
// One hand is enough: drag the iron by its handle and drop the tip on a joint, and it rests there; then drag the
// spool's free end to the joint and hold to feed. Quick mode: press and hold a joint. Keyboard: Tab between spots;
// I rests or lifts the iron, hold S to feed, T tugs, M (or Enter) opens the magnifier, H the heat view, W wipes the
// tip, Q quick mode (then hold Enter or Space on a joint).

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { useStore } from "zustand";
import { useLabels } from "../../labels";
import type { BenchStore } from "../../store";
import type { BenchState, PlacedPartOf, Vec2 } from "../../types";
import type { ScreenPoint } from "../../view/controller";
import { ALLOYS } from "../alloys";
import { WORK, type JointLook } from "../joint";
import { addLink, bendLeg } from "../ops";
import { padMetal, parsePerfHole } from "../perfboard";
import { spotAnchor } from "../../anchors";
import { createStation, feedAt, holdIron, layBraid, magnify, placeIron, quickPress, readJoint, spoolOf, stationOf, stepStation, tug, wipe, type StationState } from "../station";
import { ironPose, stationSpots, type Spot } from "../spots";
import { HatchDefs, HeldIron, JointSide, SolderWire, heatBand } from "./draw";
import { SOLDER_CSS } from "./styles";

export type SolderViewApi = {
  /** Element-relative CSS px of a target (any anchor, `spot:<id>` included). */
  project(target: string): ScreenPoint | null;
  onViewChange(cb: () => void): () => void;
  /** The desk point (mm) under an element-relative CSS px point. */
  desk(x: number, y: number): Vec2 | null;
};

const SOLDER_KINDS = new Set(["solder-station", "solder-spool", "solder-braid", "perfboard", "heat-sink-clip", "hookup-wire", "heat-shrink", "heat-gun"]);

/** True when the bench has anything the station engine runs. */
export function hasSolderWork(bench: BenchState): boolean {
  return bench.parts.some((p) => SOLDER_KINDS.has(p.kind));
}

/** What the views need to redraw when the station changes (rounded, so idle stations do not re-render). */
export function stationKey(st: StationState | null): string {
  if (!st) return "";
  let k = `${Math.round(st.iron.tipC)}|${st.held ? 1 : 0}|${st.feed ?? ""}|${st.quick ?? ""}|${st.braid ?? ""}|${st.heatView ? 1 : 0}|${st.quickMode ? 1 : 0}|${st.iron.tinning}|${Math.round(st.iron.bead * 10)}`;
  for (const [id, j] of Object.entries(st.joints)) k += `;${id}:${Math.round(j.tempC / 2)}:${Math.round(j.volume * 20)}:${j.phase}:${Math.round(j.wetted * 20)}:${j.bridgeTo ?? ""}`;
  for (const [id, h] of Object.entries(st.heat)) k += `;h${id}:${Math.round(h.peakC / 2)}`;
  for (const [id, t] of Object.entries(st.tubes)) k += `;t${id}:${Math.round(t.tempC / 3)}:${Math.round(t.shrink * 20)}`;
  for (const s of st.scorch) k += `;s${Math.round(s.amount * 10)}`;
  return k + `|${st.viewed.length}|${Object.keys(st.tugs).length}`;
}

type Drag =
  | { tool: "iron"; id: number; x: number; y: number; near: string | null }
  | { tool: "solder"; id: number; x: number; y: number; near: string | null }
  | { tool: "braid"; id: number; x: number; y: number; near: string | null }
  | { tool: "spot"; id: number; spot: string; x0: number; y0: number; x: number; y: number; tugged: boolean }
  | { tool: "bend" | "link"; id: number; from: string; x: number; y: number; near: string | null };

type Mode = "none" | "bend" | "link";

/** What the drag handlers read from a pointer event (React's or the window's). */
type PointerLike = { pointerId: number; clientX: number; clientY: number; stopPropagation(): void };

export type SolderOverlayProps = {
  store: BenchStore;
  view: SolderViewApi;
  compact: boolean;
  readOnly?: boolean;
  /** The tray covers the bottom of the bench on phones. */
  tray?: boolean;
};

export function SolderOverlay(props: SolderOverlayProps) {
  const bench = useStore(props.store, (s) => s.bench);
  if (!hasSolderWork(bench)) return null;
  return <SolderLayer {...props} />;
}

const near2 = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function SolderLayer({ store, view, compact, readOnly = false, tray = false }: SolderOverlayProps) {
  const labels = useLabels();
  const L = labels.solder;
  const hatchId = `ohs${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const bench = useStore(store, (s) => s.bench);
  const key = useStore(store, (s) => stationKey(s.station));
  const station = useMemo(() => store.getState().station, [store, key]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Redraw when the camera moves (at most once a frame).
  const [, setFrame] = useState(0);
  useEffect(() => {
    let raf = 0;
    const off = view.onViewChange(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setFrame((n) => n + 1);
      });
    });
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [view]);

  // The station's clock: the simulator's time when it runs (time-lapse cools the iron), else the wall clock.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastSimT: number | null = null;
    let simSeen = -1e9;
    let lastKey = "";
    // The newest state, and the last one handed to the store (steps between visible changes stay here).
    let latest: StationState | null = null;
    let published: StationState | null = null;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = store.getState();
      const wall = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      const t = s.snapshot?.t;
      let dt = wall;
      if (s.stationClock !== "wall" && t !== undefined) {
        if (lastSimT !== null && t !== lastSimT) {
          dt = Math.min(600, Math.max(0, t - lastSimT));
          simSeen = now;
        } else if (s.stationClock === "sim" || now - simSeen < 400) dt = 0;
        lastSimT = t;
      }
      if (!(dt > 0)) return;
      // Someone else changed the station (the learner's hand, a lab step): carry on from theirs.
      const st = (s.station !== published ? s.station : latest) ?? createStation(s.bench);
      const r = stepStation(s.bench, st, dt);
      latest = r.station;
      const k = stationKey(r.station);
      // Tell the views only when something visible changed.
      if (k !== lastKey || r.bench !== s.bench || !s.station) {
        lastKey = k;
        published = r.station;
        store.setState({ station: r.station });
      }
      if (r.bench !== s.bench) s.apply(() => r.bench);
      for (const i of r.inputs) s.emit({ type: "input", partId: i.id, key: i.key, value: i.value });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [store]);

  const act = useCallback(
    (f: (b: BenchState, s: StationState) => { bench: BenchState; station: StationState }) => {
      const s = store.getState();
      const r = f(s.bench, s.station ?? createStation(s.bench));
      store.setState({ station: r.station });
      if (r.bench !== s.bench) s.apply(() => r.bench);
    },
    [store],
  );
  const setSt = useCallback(
    (f: (s: StationState) => StationState) => {
      const s = store.getState();
      store.setState({ station: f(s.station ?? createStation(s.bench)) });
    },
    [store],
  );

  const spots = useMemo(() => stationSpots(bench), [bench]);
  const st = stationOf(bench);
  const spool = spoolOf(bench);
  const braid = bench.parts.find((p) => p.kind === "solder-braid");
  const flipped = bench.parts.filter((p): p is PlacedPartOf<"perfboard"> => p.kind === "perfboard" && !!p.params.flipped);
  const [drag, setDragState] = useState<Drag | null>(null);
  // The drag in progress, for the window listeners below: they outlive the render that started it.
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [mag, setMag] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("none");
  const [said, setSaid] = useState("");
  const R = compact ? 44 : 34;

  // Where each spot is on screen now.
  const proj = (target: string) => {
    const p = view.project(target);
    return p && p.visible ? p : null;
  };
  const metalPads = useMemo(() => {
    const out = new Set<string>();
    for (const b of flipped) {
      for (const pad of padMetal(bench, b).keys()) out.add(`${b.id}.${pad}`);
      for (const pad of Object.keys(b.params.joints ?? {})) out.add(`${b.id}.${pad}`);
    }
    return out;
  }, [bench, flipped]);
  const shown = spots.filter((s) => s.kind !== "pad" || metalPads.has(s.id) || mode !== "none" || !!drag);
  const placed = shown.map((s) => ({ s, p: proj(spotAnchor(s.id)) })).filter((x): x is { s: Spot; p: ScreenPoint } => !!x.p);

  const nearest = (x: number, y: number, ok: (s: Spot) => boolean, extra: { id: string; p: ScreenPoint | null }[] = []): string | null => {
    let best: string | null = null;
    let bd = R;
    for (const { s, p } of placed) {
      if (!ok(s)) continue;
      const d = near2(p, { x, y });
      if (d < bd) {
        bd = d;
        best = s.id;
      }
    }
    for (const e of extra) {
      if (!e.p) continue;
      const d = near2(e.p, { x, y });
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return best;
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const tipTarget = st ? `${st.id}.tip` : null;

  // ---- Pointer handling -----------------------------------------------------------------------------------------

  // A drag is followed on the window, not on the element it began on: the iron's grip disappears from under the
  // pointer as soon as the iron is lifted (the drawn iron follows the hand instead), which ends its pointer capture,
  // so a drop on the bare desk lands on the view's canvas. Listening in the capture phase also keeps the views from
  // seeing a drag that belongs to the overlay.
  const live = useRef<{ move(e: PointerLike): void; up(e: PointerLike): void } | null>(null);
  const unlisten = useRef<(() => void) | null>(null);
  const listen = () => {
    if (unlisten.current) return;
    const move = (e: PointerEvent) => live.current?.move(e);
    const up = (e: PointerEvent) => live.current?.up(e);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    unlisten.current = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      unlisten.current = null;
    };
  };
  useEffect(() => () => unlisten.current?.(), []);

  const begin = (e: RPointerEvent, d: Drag) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag(d);
    listen();
  };
  const onMove = (e: PointerLike) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.id) return;
    e.stopPropagation();
    const { x, y } = local(e);
    if (drag.tool === "iron") {
      setDrag({ ...drag, x, y, near: nearest(x, y, () => true) });
    } else if (drag.tool === "solder") {
      const n = nearest(x, y, (s) => !!s.work, tipTarget ? [{ id: "tip", p: proj(spotAnchor(tipTarget)) }] : []);
      if (n !== drag.near) setSt((s) => feedAt(s, n));
      setDrag({ ...drag, x, y, near: n });
    } else if (drag.tool === "braid") {
      const n = nearest(x, y, (s) => !!s.work);
      if (n !== drag.near) setSt((s) => layBraid(s, n));
      setDrag({ ...drag, x, y, near: n });
    } else if (drag.tool === "spot") {
      if (!drag.tugged && Math.hypot(x - drag.x0, y - drag.y0) > 22) {
        const s0 = store.getState();
        const r = tug(s0.bench, s0.station ?? createStation(s0.bench), drag.spot);
        store.setState({ station: r.station });
        setSaid(L.tug[r.result]);
        setDrag({ ...drag, x, y, tugged: true });
      }
    } else {
      const board = drag.from.slice(0, drag.from.lastIndexOf("."));
      setDrag({ ...drag, x, y, near: nearest(x, y, (s) => s.kind === "pad" && s.host === board && s.id !== drag.from) });
    }
  };
  const onUp = (e: PointerLike) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.id) return;
    e.stopPropagation();
    const { x, y } = local(e);
    if (drag.tool === "iron") {
      const target = nearest(x, y, () => true);
      if (target) act((b, s) => placeIron(b, s, target));
      else {
        const at = view.desk(x, y);
        act((b, s) => placeIron(b, s, "desk", at ?? undefined));
      }
    } else if (drag.tool === "solder") {
      setSt((s) => feedAt(s, null));
    } else if (drag.tool === "spot") {
      if (store.getState().station?.quick) act((b, s) => quickPress(b, s, null));
      else if (!drag.tugged) openMag(drag.spot);
    } else if (drag.tool === "bend" || drag.tool === "link") {
      const to = drag.near;
      if (to) {
        const board = drag.from.slice(0, drag.from.lastIndexOf("."));
        const fromPad = drag.from.slice(drag.from.lastIndexOf(".") + 1);
        const toPad = to.slice(to.lastIndexOf(".") + 1);
        store.getState().apply((b) => {
          if (drag.tool === "link") return addLink(b, board, fromPad, toPad)[0];
          // Bend the first leg that comes through the pad it was dragged from.
          for (const p of b.parts) for (const [leg, h] of Object.entries(p.holes ?? {})) {
            const q = parsePerfHole(h);
            if (q?.board === board && q.pad === fromPad) return bendLeg(b, p.id, leg, toPad);
          }
          return b;
        });
      }
    }
    setDrag(null);
    unlisten.current?.();
  };
  live.current = { move: onMove, up: onUp };

  const openMag = (spot: string) => {
    const r = readJoint(store.getState().bench, store.getState().station, spot);
    if (!r || r.phase === "bare") {
      setMag(null);
      return;
    }
    setMag(spot);
    setSt((s) => magnify(s, spot));
  };

  // ---- Keyboard ---------------------------------------------------------------------------------------------------

  const ironAt = st?.params.iron ?? "stand";
  const onSpotKey = (spot: Spot, e: KeyboardEvent, down: boolean) => {
    if (readOnly) return;
    const k = e.key.toLowerCase();
    let handled = true;
    if (down && e.repeat && (k === "s" || k === " " || k === "enter")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (k === "i" && down) act((b, s) => placeIron(b, s, ironAt === spot.id ? "stand" : spot.id));
    else if (k === "s") setSt((s) => feedAt(s, down ? (spot.work ? spot.id : null) : null));
    else if (k === "t" && down) {
      const s0 = store.getState();
      const r = tug(s0.bench, s0.station ?? createStation(s0.bench), spot.id);
      store.setState({ station: r.station });
      setSaid(L.tug[r.result]);
    } else if ((k === "m" || ((k === "enter" || k === " ") && !station?.quickMode)) && down) openMag(spot.id);
    else if ((k === "enter" || k === " ") && station?.quickMode && spot.work) act((b, s) => quickPress(b, s, down ? spot.id : null));
    else if (k === "escape" && down) setMag(null);
    else handled = onToolKey(k, down);
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onToolKey = (k: string, down: boolean): boolean => {
    if (!down) return false;
    if (k === "h") setSt((s) => ({ ...s, heatView: !s.heatView }));
    else if (k === "q") setSt((s) => ({ ...s, quickMode: !s.quickMode }));
    else if (k === "w") setSt(wipe);
    else return false;
    return true;
  };

  // Announce what a joint does as it changes (molten, set, its shape once looked at).
  const phases = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!station) return;
    for (const [id, j] of Object.entries(station.joints)) {
      const was = phases.current[id];
      if (was && was !== j.phase) setSaid(`${L.spot(id)}: ${L.phase[j.phase]}`);
      phases.current[id] = j.phase;
    }
  }, [station, L]);

  if (!station) return null;

  // ---- What to draw ------------------------------------------------------------------------------------------------

  const pose = ironPose(bench);
  const grip = st && !station.held ? proj(spotAnchor(`${st.id}.grip`)) : null;
  const spoolEnd = spool ? proj(spotAnchor(`${spool.id}.end`)) : null;
  const braidEnd = braid ? proj(spotAnchor(`${braid.id}.end`)) : null;
  const tipC = station.iron.tipC;
  const hot = tipC > 60;
  const hintSpots = new Set<string>();
  if (drag?.tool === "iron" || drag?.tool === "solder" || drag?.tool === "braid" || drag?.tool === "bend" || drag?.tool === "link") {
    if (drag.near) hintSpots.add(drag.near);
  }
  // While a tool is in the hand, the places it can go show as faint rings near it (not the whole board at once).
  const candidates = drag
    ? placed.filter(
        ({ s, p }) =>
          (drag.tool === "iron" ? true : drag.tool === "solder" || drag.tool === "braid" ? !!s.work : drag.tool === "bend" || drag.tool === "link" ? s.kind === "pad" : false) &&
          (s.kind !== "pad" || metalPads.has(s.id) || drag.tool === "bend" || drag.tool === "link" || near2(p, drag) < 90),
      )
    : [];
  const quickSpot = station.quick ? placed.find(({ s }) => s.id === station.quick) : null;
  const quickJoint = station.quick ? station.joints[station.quick] : undefined;
  const magRead = mag ? readJoint(bench, station, mag) : null;

  // Heat view: hatching over everything warm.
  const heat: { x: number; y: number; r: number; c: number; label?: string }[] = [];
  if (station.heatView) {
    const tp = st ? proj(spotAnchor(`${st.id}.tip`)) : null;
    if (tp && pose) heat.push({ x: tp.x, y: tp.y, r: compact ? 16 : 13, c: tipC, label: `${Math.round(tipC)}` });
    for (const [id, j] of Object.entries(station.joints)) {
      const p = proj(spotAnchor(id));
      if (p && j.tempC > 45) heat.push({ x: p.x, y: p.y, r: 11, c: j.tempC });
    }
    for (const [id, net] of Object.entries(station.heat)) {
      const body = proj(`part:${id}`);
      if (body) heat.push({ x: body.x, y: body.y, r: 14, c: net.bodyC, label: net.bodyC > 45 ? `${Math.round(net.bodyC)}` : undefined });
    }
  }

  // Flux smoke over molten joints.
  const smoke: { x: number; y: number; key: string }[] = [];
  for (const [id, j] of Object.entries(station.joints)) {
    if (j.phase !== "molten" || j.flux < 0.05 || j.tempC < 200) continue;
    const p = proj(spotAnchor(id));
    if (p) smoke.push({ x: p.x, y: p.y, key: id });
  }

  const ironLen = compact ? 116 : 150;
  const showDock = !!st || flipped.length > 0;
  const styleAt = (p: { x: number; y: number }): CSSProperties => ({ left: p.x, top: p.y });

  return (
    <div
      ref={rootRef}
      className={`ohs-root${compact ? " ohs-compact" : ""}${tray ? "" : " ohs-notray"}`}
      // Both views leave pointer events from their own chrome alone.
      data-ink-ui=""
      data-bench-ui=""
      onKeyDown={(e) => {
        if (onToolKey(e.key.toLowerCase(), true)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <style>{SOLDER_CSS}</style>
      <svg className="ohs-svg" aria-hidden="true">
        <HatchDefs id={hatchId} />
        {heat.map((h, i) => {
          const band = heatBand(h.c);
          if (!band) return null;
          return (
            <g key={i}>
              <circle cx={h.x} cy={h.y} r={h.r} fill={`url(#${hatchId}-h${band})`} className="ohs-heat" />
              {h.label && (
                <text x={h.x + h.r + 4} y={h.y - h.r + 4} className="ohs-heat-num">
                  {h.label} {L.degrees}
                </text>
              )}
            </g>
          );
        })}
        {smoke.map((s) => (
          <g key={s.key} transform={`translate(${s.x} ${s.y - 6})`}>
            {[0, 1, 2].map((k) => (
              <path key={k} d={`M${k * 4 - 4} 0c-4 -6 4 -10 0 -16s4 -9 0 -14`} className="ohs-smoke ohs-smoke-anim" />
            ))}
          </g>
        ))}
        {candidates.map(({ s, p }) => (
          <circle key={s.id} cx={p.x} cy={p.y} r={hintSpots.has(s.id) ? 9 : 6} className={`ohs-ring${hintSpots.has(s.id) ? " is-near" : ""}`} />
        ))}
        {quickSpot && quickJoint && (
          <circle
            cx={quickSpot.p.x}
            cy={quickSpot.p.y}
            r={13}
            className="ohs-fill-ring"
            strokeDasharray={`${2 * Math.PI * 13}`}
            strokeDashoffset={2 * Math.PI * 13 * (1 - Math.min(1, quickJoint.volume / WORK[quickJoint.kind].ideal))}
            transform={`rotate(-90 ${quickSpot.p.x} ${quickSpot.p.y})`}
          />
        )}
        {(drag?.tool === "bend" || drag?.tool === "link") &&
          (() => {
            const a = proj(spotAnchor(drag.from));
            return a ? <path d={`M${a.x} ${a.y}L${drag.x} ${drag.y}`} className="ohs-ring is-near" /> : null;
          })()}
        {drag?.tool === "solder" && spoolEnd && <SolderWire a={[spoolEnd.x, spoolEnd.y]} b={[drag.x, drag.y]} />}
        {drag?.tool === "iron" && (
          <g transform={`translate(${drag.x} ${drag.y})`}>
            <HeldIron len={ironLen} />
          </g>
        )}
      </svg>

      {/* Spots: focusable, named, with the keys above. */}
      {!readOnly &&
        placed.map(({ s, p }) => {
          const r = s.work ? readJoint(bench, station, s.id) : null;
          const what = r ? `, ${L.phase[r.phase]}${r.phase === "set" && station.viewed.includes(s.id) ? `, ${L.shape[r.look.shape]}` : ""}` : "";
          const here = ironAt === s.id ? `, ${L.iron}` : "";
          return (
            <button
              key={s.id}
              type="button"
              className="ohs-hit is-spot"
              style={styleAt(p)}
              aria-label={`${L.spot(s.id)}${what}${here}`}
              data-spot={s.id}
              onPointerDown={(e) => {
                const { x, y } = local(e);
                // Hit areas overlap on a small board: the spot nearest the finger wins, not the one drawn last.
                const id = nearest(x, y, (q) => q.kind === s.kind) ?? s.id;
                const spot = placed.find((q) => q.s.id === id)?.s ?? s;
                if (mode !== "none" && spot.kind === "pad") {
                  begin(e, { tool: mode, id: e.pointerId, from: spot.id, x, y, near: null });
                  return;
                }
                if (station.quickMode && spot.work) act((b, st2) => quickPress(b, st2, spot.id));
                begin(e, { tool: "spot", id: e.pointerId, spot: spot.id, x0: x, y0: y, x, y, tugged: false });
              }}
              onKeyDown={(e) => onSpotKey(s, e, true)}
              onKeyUp={(e) => onSpotKey(s, e, false)}
            />
          );
        })}

      {/* The tools, where they are drawn: the iron's handle, the spool's free end, the braid's end. */}
      {!readOnly && grip && (
        <button
          type="button"
          className="ohs-hit is-tool"
          style={styleAt(grip)}
          aria-label={`${L.iron}, ${Math.round(tipC)} ${L.degrees}. ${L.ironHint}`}
          data-tool="iron"
          onPointerDown={(e) => {
            const { x, y } = local(e);
            setSt(holdIron);
            begin(e, { tool: "iron", id: e.pointerId, x, y, near: null });
          }}
        />
      )}
      {!readOnly && spoolEnd && (
        <button
          type="button"
          className="ohs-hit is-tool"
          style={styleAt(spoolEnd)}
          aria-label={`${L.solder}, ${ALLOYS[spool!.params.alloy].label}. ${L.feedHint}`}
          data-tool="solder"
          onPointerDown={(e) => {
            const { x, y } = local(e);
            begin(e, { tool: "solder", id: e.pointerId, x, y, near: null });
          }}
        />
      )}
      {!readOnly && braidEnd && (
        <button
          type="button"
          className="ohs-hit is-tool"
          style={styleAt(braidEnd)}
          aria-label={L.braid}
          data-tool="braid"
          onPointerDown={(e) => {
            const { x, y } = local(e);
            begin(e, { tool: "braid", id: e.pointerId, x, y, near: null });
          }}
        />
      )}

      {showDock && (
        <div className="ohs-slip ohs-dock" role="toolbar" aria-label={labels.partName["solder-station"]}>
          {st && (
            <span className="ohs-temp" data-hot={hot ? "1" : "0"} aria-live="off">
              <small>{L.tip}</small>
              <b>
                {Math.round(tipC)} {L.degrees}
              </b>
            </span>
          )}
          {st && <span className="ohs-sep" />}
          <button type="button" className="ohs-btn" aria-pressed={station.heatView} aria-keyshortcuts="H" onClick={() => setSt((s) => ({ ...s, heatView: !s.heatView }))}>
            {L.heatView}
          </button>
          {st && (
            <button type="button" className="ohs-btn" aria-pressed={station.quickMode} aria-keyshortcuts="Q" title={L.quickHint} onClick={() => setSt((s) => ({ ...s, quickMode: !s.quickMode }))}>
              {L.quick}
            </button>
          )}
          {flipped.length > 0 && !readOnly && (
            <>
              <span className="ohs-sep" />
              <button type="button" className="ohs-btn" aria-pressed={mode === "bend"} onClick={() => setMode((m) => (m === "bend" ? "none" : "bend"))}>
                {L.bend}
              </button>
              <button type="button" className="ohs-btn" aria-pressed={mode === "link"} onClick={() => setMode((m) => (m === "link" ? "none" : "link"))}>
                {L.link}
              </button>
            </>
          )}
        </div>
      )}

      {mag && magRead && (
        <div className="ohs-slip ohs-mag" role="dialog" aria-label={`${L.magnifier}: ${L.spot(mag)}`}>
          <h3>
            <span>{L.spot(mag)}</span>
            <button type="button" className="ohs-x" aria-label={L.close} onClick={() => setMag(null)}>
              ×
            </button>
          </h3>
          <JointSide look={magRead.look as JointLook} lead={!mag.includes("HW")} />
          <p>
            {magRead.phase === "molten"
              ? L.phase.molten
              : magRead.look.finish === "bright" || magRead.look.finish === "satin"
                ? `${L.shape[magRead.look.shape]}, ${L.finish[magRead.look.finish]}`
                : L.shape[magRead.look.shape]}
          </p>
        </div>
      )}
      <div className="ohs-say" aria-live="polite">
        {said}
      </div>
    </div>
  );
}
