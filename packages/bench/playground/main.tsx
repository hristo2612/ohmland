import { StrictMode, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Health, PartState, Snapshot } from "@ohmland/sim";
// No three.js up front: BenchView loads each renderer on demand, so `?view=ink` never fetches three.js, and the
// galleries load their 3D code when opened.
import { benchToNetlist, createBenchStore, emptyBench, type BenchAction, type BenchState, type InspectSpec, type Quality } from "../src/core";
import { BenchView, type BenchController, type BenchViewKind } from "../src/view";
import { CHIP_TRAY, FULL_TRAY, blocksBench, boxesBench, chipPartsBench, chipsBench, clipBench, demoBench, drawerBench, glowBench, lampBench, mcuBench, modulesBench, propsBench, smokeBench, staticBench, symbolsBench, tiredBench } from "./scenes";

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
// The night page: the bench reads the notebook tokens (index.html defines both themes).
if (q.get("theme") === "dark") document.documentElement.dataset.theme = "dark";

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
    case "props":
      return propsBench();
    case "modules":
      return modulesBench();
    case "blocks":
      return blocksBench();
    case "chips":
      return chipsBench();
    case "chipparts":
      return chipPartsBench();
    // Start here: `lamp` (wrap=1 clips TL1 to the wrapper, gates=1 adds two gates, off=1), `junk`, `boxes`
    // (open=1), `tired`, `symbols`, `static`.
    case "lamp":
      return lampBench({ wrap: q.get("wrap") === "1", gates: q.get("gates") === "1", off: q.get("off") === "1" });
    case "junk":
      return drawerBench();
    case "boxes":
      return boxesBench(q.get("open") === "1");
    case "tired":
      return tiredBench();
    case "symbols":
      return symbolsBench();
    case "static":
      return staticBench();
    case "mcu":
      return mcuBench();
    default:
      return demoBench();
  }
}

/**
 * Unit 4 look in the mock: `segs=DS1:abcdg.;DS2:bc` lights segments ("." is the dot), `temp=U2:140` warms a part,
 * `probe=LP1:H` feeds a logic probe (H, L or X).
 */
function chipMock(bench: BenchState, parts: Record<string, PartState>): Record<string, number> {
  const nodes: Record<string, number> = { gnd: 0 };
  for (const pair of (q.get("segs") ?? "").split(";").filter(Boolean)) {
    const [id, lit = ""] = pair.split(":");
    const s = id ? parts[id] : undefined;
    if (!s) continue;
    const extra: Record<string, number | string> = { lit: lit.replace(".", "") };
    for (const seg of ["a", "b", "c", "d", "e", "f", "g"]) extra[seg] = lit.includes(seg) ? 0.85 : 0;
    extra["dp"] = lit.includes(".") ? 0.85 : 0;
    s.extra = extra;
    s.glow = lit ? 0.85 : 0;
  }
  for (const p of bench.parts) if ((p.kind === "chip" || p.kind === "regulator7805") && parts[p.id]) parts[p.id]!.extra = { ...(parts[p.id]!.extra ?? {}), powered: true };
  for (const pair of (q.get("temp") ?? "").split(",").filter(Boolean)) {
    const [id, t] = pair.split(":");
    if (id && parts[id]) parts[id]!.temp = Number(t);
  }
  const probe = q.get("probe");
  if (probe) {
    const [id, level] = probe.split(":");
    const { nodeOf } = benchToNetlist(bench);
    nodes[nodeOf(`pin:${id}.vcc`)] = 5;
    nodes[nodeOf(`pin:${id}.gnd`)] = 0;
    nodes[nodeOf(`pin:${id}.tip`)] = level === "H" ? 4.9 : level === "L" ? 0.1 : 2.5;
  }
  return nodes;
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
    // A microcontroller board's lamps: L (pin 13, `lamp=`) and ON.
    if (p.kind === "mcu-board") s.extra = { L: Number(q.get("lamp") ?? 0.8), ON: Number(q.get("on") ?? 0.75) };
    parts[p.id] = s;
  }
  if (bench.meter) parts[bench.meter.id] = { i: 0, v: 0, p: 0, temp: 25, health: "ok", display: m.display, unit: m.unit };
  const nodes = chipMock(bench, parts);
  // `t` (simulated seconds) runs the desk clock.
  return { t: Number(q.get("t") ?? 0), nodes, parts, events: [] };
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

type Shown = BenchViewKind | "split";

/**
 * `sim=1`: run the real simulator in this thread instead of the mock snapshot (flow dots, gates and push need real
 * currents). `speed=` runs it faster. Overlays: `flow=current|electrons`, `push=1`, `trace=pin:B1.neg`. `simAt=4.3` runs
 * that many simulated seconds before the first frame (instead of half a second); `simrun=0` then holds it there.
 */
function useLiveSim(store: ReturnType<typeof createBenchStore>, on: boolean) {
  useEffect(() => {
    if (!on) return;
    let stop = false;
    let raf = 0;
    void import("@ohmland/sim").then(({ createSimulation }) => {
      if (stop) return;
      const sim = createSimulation();
      const speed = Number(q.get("speed") ?? 1);
      let bench = store.getState().bench;
      sim.load(benchToNetlist(bench).netlist);
      const unsub = store.subscribe((s) => {
        if (s.txBase || s.bench === bench) return;
        bench = s.bench;
        sim.load(benchToNetlist(bench).netlist);
      });
      const offAct = store.subscribe((s, prev) => {
        // Switch flips and button presses reach the simulator as they do in a lab.
        if (s.ui.pressed !== prev.ui.pressed) for (const [id, v] of Object.entries(s.ui.pressed)) sim.setInput(id, "pressed", v);
      });
      const frame = () => {
        if (stop) return;
        store.setState({ snapshot: sim.step((1 / 30) * speed, { speed }) });
        raf = requestAnimationFrame(frame);
      };
      // Settle first, so screenshots show a running circuit.
      store.setState({ snapshot: sim.step(Number(q.get("simAt") ?? 0.5)) });
      if (q.get("simrun") !== "0") raf = requestAnimationFrame(frame);
      cleanup = () => {
        unsub();
        offAct();
        sim.dispose();
      };
    });
    let cleanup = () => {};
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [store, on]);
}

function BenchApp() {
  const [store] = useState(() => createBenchStore(initialBench()));
  const live = q.get("sim") === "1";
  useLiveSim(store, live);
  useEffect(() => {
    const flow = q.get("flow");
    if (flow === "current" || flow === "electrons") store.getState().setOverlay({ flow });
    if (q.get("push") === "1") store.getState().setOverlay({ push: true });
    const trace = q.get("trace");
    if (trace) setTimeout(() => store.getState().trace(trace), Number(q.get("traceAt") ?? 300));
  }, [store]);
  const controller = useRef<BenchController | null>(null);
  const second = useRef<BenchController | null>(null);
  // Both views draw the same store: switching keeps the bench, the undo history and the snapshot. "Both" shows them
  // side by side on that one store.
  const [view, setView] = useState<Shown>(q.get("view") === "ink" ? "ink" : q.get("view") === "split" ? "split" : "3d");
  useEffect(() => {
    // Lab instruments over the bench and the room lights, for screenshots.
    const ambient = q.get("ambient");
    const inspect = q.get("inspect");
    const patch: { ambient?: number; inspect?: InspectSpec[] } = {};
    if (ambient) patch.ambient = Number(ambient);
    if (inspect)
      patch.inspect = inspect.split(";").map((x) => {
        const [show, ids] = x.split(":");
        return { show: show === "heat" ? "heat" : "stress", parts: (ids ?? "").split(",") };
      });
    store.setState(patch);
  }, [store]);
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
  // Handles for the Playwright scripts (in split view `__controller` is the 3D side, `__second` the ink side).
  useEffect(() => {
    Object.assign(window, { __bench: store, __controller: controller, __second: second });
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
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {(view === "split" ? (["3d", "ink"] as const) : [view]).map((v, i) => (
          <div key={v} style={{ position: "relative", flex: 1, minWidth: 0, borderLeft: i ? "1px solid #D8D0C1" : undefined }}>
            <BenchView
              view={v}
              store={store}
              tray={q.get("tray") === "0" ? [] : (q.get("scene") ?? "").startsWith("chip") ? CHIP_TRAY : FULL_TRAY}
              snapshot={live ? undefined : snapshot}
              quality={quality}
              readOnly={q.get("ro") === "1"}
              highlight={highlight}
              camera={camera}
              onAction={onAction}
              onReady={i === 0 ? markReady : undefined}
              controllerRef={i === 0 ? controller : second}
            />
          </div>
        ))}
      </div>
      {showPanel && <MockPanel bench={bench} mock={mock} setMock={setMock} log={log} />}
      {q.get("toggle") !== "0" && (
        <div
          role="group"
          aria-label="View"
          style={{ position: "absolute", left: "50%", top: 12, transform: "translateX(-50%)", display: "flex", background: "#FCFAF5", border: "1px solid #D8D0C1", boxShadow: "2px 2px 0 #E1D9CA", borderRadius: 2, zIndex: 2 }}
        >
          {(["3d", "ink", "split"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} style={{ ...viewButton, background: view === v ? "#E1E6F4" : undefined, color: view === v ? "#1F3C9A" : viewButton.color }} onClick={() => setView(v)}>
              {v === "3d" ? "3D" : v === "ink" ? "Ink" : "Both"}
            </button>
          ))}
        </div>
      )}
      {showPanel && (
        <nav style={{ position: "absolute", right: 120, top: 26, display: "flex", gap: 10, font: "600 12px Inter, Arial", zIndex: 2 }}>
          <a href="?scene=demo">Demo</a>
          <a href="?scene=clips">Clip leads</a>
          <a href="?scene=glow">First glow</a>
          <a href="?scene=props">Props</a>
          <a href="?scene=modules">Modules</a>
          <a href="?scene=lamp&gates=1&sim=1&flow=current">Start here</a>
          <a href="?scene=chips&sim=1">Chips</a>
          <a href="?scene=chipparts">Chip parts</a>
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
