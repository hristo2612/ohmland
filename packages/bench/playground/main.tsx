import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Health, PartState, Snapshot } from "@ohmland/sim";
import { type BenchController, BenchView, type BenchViewKind, DEFAULT_GALLERY, PartGallery, PartPreview, benchToNetlist, createBenchStore, emptyBench, type BenchAction, type BenchState, type Quality } from "../src";
import { FULL_TRAY, clipBench, demoBench, glowBench, smokeBench } from "./scenes";

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
    case "glow":
      return glowBench();
    case "glow0":
      return glowBench(false);
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
  for (const p of bench.parts) {
    const s: PartState = { i: 0, v: 0, p: 0, temp: 25, health: m.health[p.id] ?? "ok", glow: m.glow[p.id] ?? 0 };
    if (p.kind === "relay") s.closed = m.closed;
    parts[p.id] = s;
  }
  if (bench.meter) parts[bench.meter.id] = { i: 0, v: 0, p: 0, temp: 25, health: "ok", display: m.display, unit: m.unit };
  return { t: 0, nodes: {}, parts, events: [] };
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

const viewButton: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "0 12px",
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  font: "500 14px Literata, Georgia, serif",
  color: "#24221E",
};

function BenchApp() {
  const [store] = useState(() => createBenchStore(initialBench()));
  const controller = useRef<BenchController | null>(null);
  // Both views draw the same store: switching keeps the bench, the undo history and the snapshot.
  const [view, setView] = useState<BenchViewKind>(q.get("view") === "ink" ? "ink" : "3d");
  useEffect(() => {
    const focus = q.get("focus");
    const spot = q.get("spot");
    if (!focus && !spot) return;
    const t = setTimeout(() => {
      if (focus) controller.current?.focus(focus === "all" ? [] : focus.split(","), { instant: true });
      if (spot) controller.current?.spotlight(spot.split(","));
    }, 50);
    return () => clearTimeout(t);
  }, []);
  // Handles for the Playwright scripts.
  useEffect(() => {
    Object.assign(window, { __bench: store, __controller: controller });
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
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <BenchView
        view={view}
        store={store}
        tray={q.get("tray") === "0" ? [] : FULL_TRAY}
        snapshot={snapshot}
        quality={quality}
        readOnly={q.get("ro") === "1"}
        highlight={highlight}
        camera={camera}
        onAction={onAction}
        onReady={markReady}
        controllerRef={controller}
      />
      {showPanel && <MockPanel bench={bench} mock={mock} setMock={setMock} log={log} />}
      {q.get("toggle") !== "0" && (
        <div
          role="group"
          aria-label="View"
          style={{ position: "absolute", left: "50%", top: 12, transform: "translateX(-50%)", display: "flex", background: "#FCFAF5", border: "1px solid #D8D0C1", boxShadow: "2px 2px 0 #E1D9CA", borderRadius: 2, zIndex: 2 }}
        >
          {(["3d", "ink"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} style={{ ...viewButton, background: view === v ? "#E1E6F4" : undefined, color: view === v ? "#1F3C9A" : viewButton.color }} onClick={() => setView(v)}>
              {v === "3d" ? "3D" : "Ink"}
            </button>
          ))}
        </div>
      )}
      {showPanel && (
        <nav style={{ position: "absolute", right: 120, top: 26, display: "flex", gap: 10, font: "600 12px Inter, Arial", zIndex: 2 }}>
          <a href="?scene=demo">Demo</a>
          <a href="?scene=clips">Clip leads</a>
          <a href="?scene=glow">First glow</a>
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
    const items = row !== null ? [DEFAULT_GALLERY[Number(row)]!] : rows ? DEFAULT_GALLERY.slice(rows[0], (rows[1] ?? rows[0]!) + 1) : DEFAULT_GALLERY;
    const focus = q.get("focus");
    return <PartGallery onReady={markReady} view={view} items={items} focus={focus === null ? undefined : Number(focus)} quality={quality} />;
  }
  if (mode === "preview") return <PreviewApp />;
  return <BenchApp />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
