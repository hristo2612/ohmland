import { StrictMode, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Health, PartState, Snapshot } from "@ohmland/sim";
// The pure half only: `?view=ink` must not load three.js at all (the 3D view and the galleries load on demand).
import { benchToNetlist, createBenchStore, emptyBench, type BenchAction, type BenchState, type InspectSpec, type Quality } from "../src/core";
import { BenchInk, type BenchController, type InkController } from "../src/ink";
import { FULL_TRAY, blocksBench, clipBench, demoBench, glowBench, propsBench, smokeBench } from "./scenes";

const Bench = lazy(() => import("../src").then((m) => ({ default: m.Bench })));
type GalleryProps = { view?: { position: [number, number, number]; target: [number, number, number] }; rows?: number[]; row: string | null; focus: string | null };
const GalleryApp = lazy(() =>
  import("../src").then((m) => ({
    default: ({ view, rows, row, focus }: GalleryProps) => {
      const all = m.DEFAULT_GALLERY;
      const items = row !== null ? [all[Number(row)]!] : rows ? all.slice(rows[0], (rows[1] ?? rows[0]!) + 1) : all;
      return <m.PartGallery onReady={markReady} view={view} items={items} focus={focus === null ? undefined : Number(focus)} quality={quality} />;
    },
  })),
);
const PartPreview = lazy(() => import("../src").then((m) => ({ default: m.PartPreview })));

const q = new URLSearchParams(location.search);
const num3 = (s: string | null) => (s ? (s.split(",").map(Number) as [number, number, number]) : undefined);
const markReady = () => ((window as unknown as { __ready: boolean }).__ready = true);
const quality: Quality = q.get("q") === "low" ? "low" : "high";

function initialBench(): BenchState {
  switch (q.get("scene")) {
    case "empty":
      return emptyBench({ kind: "bb830" });
    case "half":
      return emptyBench({ kind: "bb400" });
    case "clips":
      return clipBench();
    case "smoke":
      return smokeBench();
    case "props":
      return propsBench();
    case "glow":
      return glowBench();
    case "blocks":
      return blocksBench();
    default:
      return demoBench();
  }
}

type Mock = {
  glow: Record<string, number>;
  health: Record<string, Health>;
  display: string;
  unit: string;
  closed: boolean;
};

function initialMock(): Mock {
  const health: Record<string, Health> = {};
  for (const pair of (q.get("health") ?? "").split(",").filter(Boolean)) {
    const [id, h] = pair.split(":");
    if (id && h) health[id] = h as Health;
  }
  return {
    glow: { D1: Number(q.get("glow") ?? 0.85) },
    health,
    display: q.get("display") ?? "1.92",
    unit: q.get("unit") ?? "V",
    closed: q.get("closed") === "1",
  };
}

function toSnapshot(bench: BenchState, m: Mock): Snapshot {
  const parts: Record<string, PartState> = {};
  const temps: Record<string, number> = { hot: 58, smoking: 96, dead: 140 };
  for (const p of bench.parts) {
    const health = m.health[p.id] ?? "ok";
    const s: PartState = { i: 0, v: 0, p: 0, temp: temps[health] ?? 31, health, glow: m.glow[p.id] ?? 0 };
    if (p.kind === "relay") {
      s.closed = m.closed;
      s.extra = { armature: m.closed ? 1 : 0 };
    }
    if (p.kind === "led") s.extra = { stress: Math.min(1.2, (m.glow[p.id] ?? 0) * 0.7) };
    parts[p.id] = s;
  }
  if (bench.meter) parts[bench.meter.id] = { i: 0, v: 0, p: 0, temp: 25, health: "ok", display: m.display, unit: m.unit };
  return { t: Number(q.get("t") ?? 0), nodes: {}, parts, events: [] };
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: 66,
  width: 250,
  maxHeight: "calc(100% - 140px)",
  overflow: "auto",
  background: "rgba(255,251,244,.95)",
  border: "1px solid rgba(60,45,30,.12)",
  borderRadius: 14,
  padding: "10px 12px",
  font: "500 12.5px/1.35 Inter, Helvetica, Arial, sans-serif",
  boxShadow: "0 6px 24px rgba(60,40,20,.14)",
  zIndex: 2,
};

function MockPanel({ bench, mock, setMock, log }: { bench: BenchState; mock: Mock; setMock: (m: Mock) => void; log: string[] }) {
  const leds = bench.parts.filter((p) => p.kind === "led");
  const net = useMemo(() => benchToNetlist(bench), [bench]);
  return (
    <div style={panelStyle}>
      <strong style={{ fontSize: 13 }}>Mock snapshot</strong>
      {leds.map((p) => (
        <label key={p.id} style={{ display: "block", marginTop: 8 }}>
          {p.id} glow {(mock.glow[p.id] ?? 0).toFixed(2)}
          <input type="range" min={0} max={1} step={0.01} value={mock.glow[p.id] ?? 0} style={{ width: "100%" }} onChange={(e) => setMock({ ...mock, glow: { ...mock.glow, [p.id]: Number(e.target.value) } })} />
        </label>
      ))}
      <div style={{ marginTop: 8 }}>Health</div>
      {bench.parts.map((p) => (
        <label key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 3 }}>
          <span>
            {p.id} <small style={{ opacity: 0.6 }}>{p.kind}</small>
          </span>
          <select value={mock.health[p.id] ?? "ok"} onChange={(e) => setMock({ ...mock, health: { ...mock.health, [p.id]: e.target.value as Health } })}>
            {["ok", "hot", "smoking", "dead"].map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
      ))}
      <label style={{ display: "block", marginTop: 8 }}>
        Meter display <input value={mock.display} onChange={(e) => setMock({ ...mock, display: e.target.value })} style={{ width: 70 }} /> unit{" "}
        <input value={mock.unit} onChange={(e) => setMock({ ...mock, unit: e.target.value })} style={{ width: 40 }} />
      </label>
      <label style={{ display: "block", marginTop: 8 }}>
        <input type="checkbox" checked={mock.closed} onChange={(e) => setMock({ ...mock, closed: e.target.checked })} /> Relay closed
      </label>
      <details style={{ marginTop: 10 }}>
        <summary>Netlist ({net.netlist.parts.length} parts)</summary>
        <pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>
          {net.netlist.parts.map((p) => `${p.id} ${p.kind} ${Object.entries(p.pins).map(([k, v]) => `${k}=${v}`).join(" ")}`).join("\n")}
          {net.warnings.length ? `\n\n${net.warnings.join("\n")}` : ""}
        </pre>
      </details>
      <details style={{ marginTop: 6 }}>
        <summary>Actions</summary>
        <pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{log.slice(-14).join("\n")}</pre>
      </details>
    </div>
  );
}

type View = "3d" | "ink" | "split";

function BenchApp() {
  const [store] = useState(() => createBenchStore(initialBench()));
  const controller = useRef<BenchController | null>(null);
  const ink = useRef<BenchController | null>(null);
  const [view, setView] = useState<View>(() => (q.get("view") === "ink" ? "ink" : q.get("view") === "split" ? "split" : "3d"));
  // Handles for the Playwright scripts.
  useEffect(() => {
    Object.assign(window, { __bench: store, __controller: controller, __ink: ink });
  }, [store]);
  useEffect(() => {
    const ambient = q.get("ambient");
    const inspect = q.get("inspect");
    const patch: { ambient?: number; inspect?: InspectSpec[] } = {};
    if (ambient) patch.ambient = Number(ambient);
    if (inspect) patch.inspect = inspect.split(";").map((x) => {
      const [show, ids] = x.split(":");
      return { show: show === "heat" ? "heat" : "stress", parts: (ids ?? "").split(",") };
    });
    store.setState(patch);
  }, [store]);
  const [bench, setBench] = useState(() => store.getState().bench);
  const [mock, setMock] = useState(initialMock);
  const [log, setLog] = useState<string[]>([]);
  const snapshot = useMemo(() => toSnapshot(bench, mock), [bench, mock]);
  useEffect(() => store.subscribe((s) => setBench(s.bench)), [store]);
  useEffect(() => {
    const hover = q.get("hover");
    const select = q.get("select");
    const ui = store.getState().ui;
    store.setState({
      ui: {
        ...ui,
        hover: hover ?? ui.hover,
        xray: q.get("xray") === "1",
        mode: q.get("wire") === "1" ? "wire" : ui.mode,
        selection: select
          ? select === "M1"
            ? { type: "meter", id: "M1" }
            : select.startsWith("W")
              ? { type: "wire", id: select }
              : select.startsWith("TL")
                ? { type: "lead", id: select }
                : { type: "part", id: select }
          : null,
      },
    });
  }, [store]);
  const onAction = (a: BenchAction) => setLog((l) => [...l, JSON.stringify(a)]);
  const camera = q.get("cam") ? { position: num3(q.get("cam"))!, target: num3(q.get("target")) ?? ([0, 0, 0] as [number, number, number]) } : undefined;
  const highlight = q.get("hint")?.split(",");
  const showPanel = q.get("panel") !== "0";
  const tray = q.get("tray") === "0" ? [] : FULL_TRAY;
  const common = { store, tray, snapshot, quality, readOnly: q.get("ro") === "1", highlight, onAction };
  // Screenshot helpers for the ink view: a spotlight and a framing, once it is drawn.
  const inkReady = () => {
    const c = ink.current as InkController | null;
    const spot = q.get("spot");
    const focus = q.get("focus");
    if (c && focus) c.focus(focus.split(","), { instant: true });
    if (c && spot) c.spotlight(spot.split(","));
    markReady();
  };
  const pane = (v: "3d" | "ink", half: boolean) =>
    v === "3d" ? (
      <div key="3d" style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <Suspense fallback={null}>
          <Bench {...common} camera={camera} onReady={half ? undefined : markReady} controllerRef={controller as never} />
        </Suspense>
      </div>
    ) : (
      <div key="ink" style={{ position: "relative", flex: 1, minWidth: 0, borderLeft: half ? "1px solid #d8d0c1" : undefined }}>
        <BenchInk {...common} onReady={inkReady} controllerRef={ink} />
      </div>
    );
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex" }}>
      {view === "split" ? [pane("3d", true), pane("ink", true)] : pane(view, false)}
      {showPanel && <MockPanel bench={bench} mock={mock} setMock={setMock} log={log} />}
      {showPanel && (
        <nav style={{ position: "absolute", right: 120, top: 26, display: "flex", gap: 10, font: "600 12px Inter, Arial", zIndex: 2, alignItems: "center" }}>
          <span role="group" aria-label="View" style={{ display: "inline-flex", border: "1px solid #3d3a34", borderRadius: 2, overflow: "hidden" }}>
            {(["3d", "ink", "split"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} style={{ font: "inherit", border: 0, padding: "4px 9px", cursor: "pointer", background: view === v ? "#24221e" : "#fcfaf5", color: view === v ? "#f6f2e9" : "#24221e" }}>
                {v === "3d" ? "3D" : v === "ink" ? "Ink" : "Both"}
              </button>
            ))}
          </span>
          <a href="?scene=demo">Demo</a>
          <a href="?scene=glow">Glow</a>
          <a href="?scene=clips">Clip leads</a>
          <a href="?scene=props">Props</a>
          <a href="?scene=blocks">Blocks</a>
          <a href="?scene=empty">Empty</a>
          <a href="?mode=gallery">Gallery</a>
          <a href="?mode=preview">Preview</a>
        </nav>
      )}
    </div>
  );
}

function PreviewApp() {
  const kinds = ["resistor", "led", "multimeter", "relay", "battery", "electrolytic-cap"] as const;
  useEffect(() => {
    const t = setTimeout(markReady, 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, padding: 12, height: "100%", overflow: "auto" }}>
      {kinds.map((k) => (
        <div key={k} style={{ height: 300, borderRadius: 14, overflow: "hidden", background: "#f4ede2" }}>
          <PartPreview kind={k} background="#f4ede2" state={k === "led" ? { i: 0.015, v: 1.9, p: 0.03, temp: 30, health: "ok", glow: 0.8 } : null} quality={quality} />
        </div>
      ))}
    </div>
  );
}

function App() {
  const mode = q.get("mode");
  if (mode === "gallery") {
    const view = q.get("cam") ? { position: num3(q.get("cam"))!, target: num3(q.get("target")) ?? ([0, 0, 0] as [number, number, number]) } : undefined;
    // row=2 shows one row; rows=0-3 shows a range.
    const row = q.get("row");
    const rows = q.get("rows")?.split("-").map(Number);
    const focus = q.get("focus");
    return (
      <Suspense fallback={null}>
        <GalleryApp view={view} rows={rows} row={row} focus={focus} />
      </Suspense>
    );
  }
  if (mode === "preview")
    return (
      <Suspense fallback={null}>
        <PreviewApp />
      </Suspense>
    );
  return <BenchApp />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
