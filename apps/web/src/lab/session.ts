/**
 * A lab session: the part of the runtime that has no DOM and no simulator of its own. It is fed the bench and each
 * snapshot, keeps the event log, the recent history and the notebook, checks task goals in order (optional tasks all
 * the time), spots fried parts and fires achievement triggers. The lab step and the headless replay both drive one.
 */
import { advanceGates, benchToNetlist, type BenchNetlist, type BenchState, type GateCounts } from "@ohmland/bench/core";
import type { SimEvent, Snapshot } from "@ohmland/sim";
import type { BuiltBench, SimInput } from "./build";
import { isOptional, type LabDefinition, type LabTask, type LabView, type LabViews, type OverlayName, type PanelState, type Reading, type StopwatchRun, type TaskStatus, type TriggerSpec } from "./define";
import { emptyPanel, panelSize, solutionAnswer, submitPanel, updateAutoPanel, wiringKey, type AutoMemory } from "./panels";
import { createLabView, hallKind, readingTags } from "./view";

export type FriedRecord = { partId: string; kind: string; event: SimEvent; label: string | undefined };

export type SessionUpdate = {
  /** Tasks finished by this snapshot, in order. */
  completed: LabTask[];
  fried: FriedRecord[];
  captured: Reading[];
  triggers: string[];
  /** Events in this snapshot that the learner should hear about (warnings, shorts). */
  notices: SimEvent[];
  /** Inputs the session wants sent to the simulator (the auto-tapper's presses). */
  inputs: SimInput[];
  /** A panel or instrument changed (re-render the panels). */
  panels: boolean;
};

const kindOf = (lab: LabView, partId: string) => lab.benchPart(partId.replace(/:\d+$/, ""))?.kind;
const died = (lab: LabView, kinds: string[], cause: string) =>
  lab.events.some((e) => e.type === "died" && e.data?.["cause"] === cause && kinds.includes(kindOf(lab, e.partId) ?? ""));

/**
 * Achievement triggers the runtime fires in any lab (and the sandbox), for achievements whose `labEvent` is about
 * what happened rather than a particular lab.
 */
export const BUILT_IN_TRIGGERS: Record<string, (lab: LabView) => boolean> = {
  "relay-clicked": (lab) => lab.events.some((e) => e.type === "clicked" && kindOf(lab, e.partId) === "relay"),
  "relay-worn-out": (lab) => died(lab, ["relay"], "worn"),
  "capacitor-reversed-died": (lab) => died(lab, ["electrolytic-cap", "ceramic-cap"], "reverse"),
  "speaker-concert-a": (lab) => {
    const speakers = lab.bench.parts.filter((p) => p.kind === "speaker").map((p) => p.id);
    const hz = speakers.map((id) => lab.toneHz(id)).find((x) => x !== null) ?? null;
    return lab.heldFor(2, hz !== null && hz >= 418 && hz <= 462, "concert-a");
  },
};

const HISTORY_SECONDS = 20;
const MAX_RUNS = 30;
const STABLE_SECONDS = 0.6;
const MAX_READINGS = 60;
const MAX_EVENTS = 2000;

export class LabSession {
  readonly lab: LabDefinition;
  readonly built: BuiltBench;
  status: Record<string, TaskStatus> = {};
  notes: Record<string, number | null> = {};
  controls: Record<string, number> = {};
  readings: Reading[] = [];
  events: SimEvent[] = [];
  history: Snapshot[] = [];
  snapshot: Snapshot | null = null;
  bench: BenchState;
  /** The netlist the simulator runs (clip leads have resistance). */
  net: BenchNetlist;
  /** Metal connectivity for topology checks (clip leads are ideal conductors). */
  topo: BenchNetlist;
  /** False between a bench change and the first snapshot of the new circuit; goals wait for it. */
  synced = true;
  tone: number | null = null;
  /** Pitch over the last 60 ms, from the audio stream (for the tone history). */
  toneQuick: number | null = null;
  toneLog: [number, number][] = [];
  panels: Record<string, PanelState> = {};
  runs: StopwatchRun[] = [];
  loggerT0: number | null = null;
  tapper: { part: string; hz: number; on: boolean; next: number; pressed: boolean } | null = null;
  private panelMem = new Map<string, { last: AutoMemory }>();
  private wiring = "";
  private timing: { start: number; watch?: number } | null = null;
  private trig = new Map<string, boolean>();
  /** The views and overlays that are on (the runtime mirrors the bench store's here). */
  views: LabViews = { flow: "off", push: false, xray: false, trace: null };
  /** Dots each gate has counted. */
  gates: GateCounts = {};
  /** When each task was done in this visit, with the meter as it read then (LabView.doneAt). */
  doneAt: Record<string, { t: number; meter: LabView["meter"] }> = {};
  private memory = new Map<string, Record<string, unknown>>();
  private shared: Record<string, unknown> = {};
  private fired = new Set<string>();
  private pendingTriggers: string[] = [];
  private dead = new Set<string>();
  private stable: { key: string; since: number; value: number; logged: boolean } | null = null;
  private goalErrors = new Set<string>();

  constructor(lab: LabDefinition, built: BuiltBench, done: readonly string[] = []) {
    this.lab = lab;
    this.built = built;
    for (const t of lab.tasks) this.status[t.id] = done.includes(t.id) ? "done" : "todo";
    for (const c of built.controls) this.controls[c.id] = c.value;
    this.bench = built.bench;
    this.net = benchToNetlist(this.bench);
    this.topo = benchToNetlist(this.bench, { leadOhms: 0 });
    this.wiring = wiringKey(this.bench);
    for (const p of lab.panels ?? []) this.panels[p.id] = emptyPanel(panelSize(p, this.bench));
    if (built.tapper) this.tapper = { part: built.tapper.part, hz: built.tapper.hz ?? 4, on: false, next: 0, pressed: false };
    const o = lab.bench.overlays;
    if (o) this.views = { ...this.views, flow: o.flow ?? "off", push: !!o.push };
  }

  /** Switches a view or overlay on or off (from a toggle, the store, or a solution step). */
  setView(name: OverlayName | "xray", on: boolean): void {
    const v = this.views;
    if (name === "push") this.views = { ...v, push: on };
    else if (name === "xray") this.views = { ...v, xray: on };
    else if (name === "electrons") this.views = { ...v, flow: on ? "electrons" : v.flow === "electrons" ? "current" : v.flow };
    else this.views = { ...v, flow: on ? (v.flow === "off" ? "current" : v.flow) : "off" };
  }

  /** The loop tracer started from a terminal (or was cleared). */
  setTrace(from: string | null): void {
    this.views = { ...this.views, trace: from };
  }

  /** The bench changed: rebuild the netlists. Returns the netlist for the simulator. */
  setBench(bench: BenchState): BenchNetlist {
    this.bench = bench;
    this.net = benchToNetlist(bench);
    this.topo = benchToNetlist(bench, { leadOhms: 0 });
    this.stable = null;
    // A truth table belongs to one wiring: rewire and it starts again.
    const w = wiringKey(bench);
    if (w !== this.wiring) {
      this.wiring = w;
      for (const p of this.lab.panels ?? []) if (p.kind === "truth-table") this.panels[p.id] = emptyPanel(panelSize(p, bench));
    }
    for (const p of this.lab.panels ?? []) if (p.kind === "continuity") this.panels[p.id] = { ...(this.panels[p.id] ?? emptyPanel()), size: panelSize(p, bench) };
    return this.net;
  }

  /** The learner (or a solution) answers a panel. Returns the new state. */
  answer(panelId: string, value: unknown, fromSolution = false): PanelState | null {
    const cfg = this.lab.panels?.find((p) => p.id === panelId);
    if (!cfg) return null;
    const v = fromSolution ? solutionAnswer(cfg, value, this.bench) : value;
    this.panels[panelId] = submitPanel(cfg, this.panels[panelId] ?? emptyPanel(), v, this.bench);
    return this.panels[panelId]!;
  }

  /** Clears an auto panel (the learner's "Clear" button). */
  clearPanel(panelId: string): void {
    const cfg = this.lab.panels?.find((p) => p.id === panelId);
    if (cfg) this.panels[panelId] = emptyPanel(panelSize(cfg, this.bench));
  }

  /** Switches the auto-tapper on or off. */
  setTapper(on: boolean): void {
    if (!this.tapper) return;
    this.tapper = { ...this.tapper, on, next: this.snapshot?.t ?? 0 };
  }

  /** Starts a new logger run now. */
  startLogger(): void {
    this.loggerT0 = this.snapshot?.t ?? 0;
  }

  /** The first required task still to do, or null when all are done. */
  current(): LabTask | null {
    return this.lab.tasks.find((t) => !isOptional(t) && this.status[t.id] === "todo") ?? null;
  }

  requiredDone(): boolean {
    return this.current() === null;
  }

  skip(taskId: string): void {
    if (this.status[taskId] === "todo") this.status[taskId] = "skipped";
  }

  /** A fresh part replaced a dead one: it may fry again. */
  revive(partId: string): void {
    this.dead.delete(partId);
  }

  /** Forget the circuit's past (after a bench reset): events, history and per-task scratch space. */
  resetCircuit(): void {
    this.events = [];
    this.history = [];
    this.snapshot = null;
    this.memory.clear();
    this.dead.clear();
    this.stable = null;
    this.toneLog = [];
    this.timing = null;
    this.loggerT0 = null;
    this.gates = {};
    this.trig.clear();
    if (this.tapper) this.tapper = { ...this.tapper, on: false, pressed: false };
  }

  view(memoryKey?: string): LabView {
    const memory = memoryKey ? this.memoryFor(memoryKey) : {};
    return createLabView({
      bench: this.bench,
      net: this.topo,
      simNet: this.net,
      snapshot: this.snapshot,
      events: this.events,
      history: this.history,
      readings: this.readings,
      notes: this.notes,
      controls: this.controls,
      memory,
      shared: this.shared,
      status: this.status,
      nodes: this.built.nodes,
      tone: this.tone,
      toneLog: this.toneLog,
      panels: this.panels,
      runs: this.runs,
      loggerStart: this.loggerT0,
      tapping: this.tapper?.on ? this.tapper.part : null,
      onTrigger: (name) => this.pendingTriggers.push(name),
      doneAt: this.doneAt,
      views: this.views,
      gates: this.gates,
    });
  }

  private memoryFor(key: string): Record<string, unknown> {
    let m = this.memory.get(key);
    if (!m) this.memory.set(key, (m = {}));
    return m;
  }

  setNote(id: string, value: number | null): void {
    this.notes[id] = value;
  }

  setControl(id: string, value: number): void {
    this.controls[id] = value;
  }

  /** Feed one snapshot. Returns what happened. */
  ingest(s: Snapshot): SessionUpdate {
    const update: SessionUpdate = { completed: [], fried: [], captured: [], triggers: [], notices: [], inputs: [], panels: false };
    this.snapshot = s;
    if (s.events.length) {
      this.events.push(...s.events);
      if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    const prevT = this.history[this.history.length - 1]?.t;
    this.history.push(s);
    while (this.history.length && this.history[0]!.t < s.t - HISTORY_SECONDS) this.history.shift();
    // Gates count the dots that ride past them.
    if (this.bench.parts.some((p) => p.kind === "gate")) this.gates = advanceGates(this.gates, this.bench, s, prevT === undefined ? 0 : s.t - prevT);

    // Fried parts.
    for (const e of s.events) {
      if (e.type === "warning" || e.type === "shorted") update.notices.push(e);
      if (e.type !== "died" && e.type !== "blown" && e.type !== "meter-fuse") continue;
      const id = e.type === "meter-fuse" ? `${e.partId}:fuse` : e.partId.replace(/:\d+$/, "");
      if (this.dead.has(id)) continue;
      this.dead.add(id);
      const part = this.bench.parts.find((p) => p.id === id);
      const kind = e.type === "meter-fuse" ? "meter-fuse" : hallKind(part, id);
      update.fried.push({ partId: id, kind, event: e, label: this.friedLabel(id, kind, e) });
    }

    const view = this.view();
    this.captureReading(view, update);
    this.toneLog.push([s.t, this.toneQuick ?? 0]);
    while (this.toneLog.length && this.toneLog[0]![0] < s.t - HISTORY_SECONDS) this.toneLog.shift();
    this.instruments(view, s, update);
    for (const p of this.lab.panels ?? []) {
      if (p.kind !== "continuity" && p.kind !== "truth-table") continue;
      let mem = this.panelMem.get(p.id);
      if (!mem) this.panelMem.set(p.id, (mem = { last: null }));
      const before = this.panels[p.id] ?? emptyPanel(panelSize(p, this.bench));
      const after = updateAutoPanel(p, before, view, mem);
      if (after !== before) {
        this.panels[p.id] = after;
        update.panels = true;
      }
    }

    if (this.synced) {
      // The current required task, then every optional one still open.
      const cur = this.current();
      const check = (t: LabTask) => {
        const v = this.view(t.id);
        let ok = false;
        try {
          ok = !!t.goal(v);
        } catch (err) {
          if (!this.goalErrors.has(t.id)) {
            this.goalErrors.add(t.id);
            console.warn(`[lab ${this.lab.id}] goal of "${t.id}" threw`, err);
          }
        }
        if (ok) {
          this.status[t.id] = "done";
          this.doneAt[t.id] = { t: s.t, meter: v.meter };
          update.completed.push(t);
          if (t.trigger) this.pendingTriggers.push(t.trigger);
        }
      };
      if (cur) check(cur);
      for (const t of this.lab.tasks) if (isOptional(t) && this.status[t.id] === "todo") check(t);
      const triggerView = this.view("__triggers");
      for (const [name, when] of [...Object.entries(BUILT_IN_TRIGGERS), ...Object.entries(this.lab.triggers ?? {})]) {
        if (this.fired.has(name)) continue;
        try {
          if (when(triggerView)) this.pendingTriggers.push(name);
        } catch {
          // A broken trigger never blocks the lab.
        }
      }
    }
    for (const name of this.pendingTriggers.splice(0)) {
      if (this.fired.has(name)) continue;
      this.fired.add(name);
      update.triggers.push(name);
    }
    return update;
  }

  /** Whether a trigger holds in this snapshot (a contact trigger: the relay moved that way in this snapshot). */
  private holds(t: TriggerSpec, s: Snapshot): boolean {
    if ("to" in t) return (this.bench.parts.find((p) => p.id === t.part)?.params as { to?: string } | undefined)?.to === t.to;
    if ("pressed" in t) return (s.parts[t.part]?.extra?.["pressed"] === true) === t.pressed;
    return s.parts[t.part]?.extra?.["contact"] === t.contact;
  }

  /** True when a trigger has just begun to hold (an edge since the previous snapshot). */
  private edge(key: string, t: TriggerSpec, s: Snapshot): boolean {
    const now = this.holds(t, s);
    const was = this.trig.get(key) ?? now;
    this.trig.set(key, now);
    return (now && !was) || ("contact" in t && s.events.some((e) => e.type === "clicked" && e.partId === t.part && e.data?.["to"] === t.contact) && !was);
  }

  /** The stopwatch, the logger's start and the auto-tapper. */
  private instruments(view: LabView, s: Snapshot, update: SessionUpdate): void {
    const sw = this.built.stopwatch;
    if (sw) {
      const started = this.edge("sw-start", sw.start, s);
      // The stop condition counts whenever it holds during a run: a relay that never let go stops a restart at once.
      const stopped = this.holds(sw.stop, s);
      if (started && !this.timing) {
        // The switch moved since the previous snapshot: start from then (exact in a replay, within a frame live).
        const prev = this.history[this.history.length - 2]?.t ?? s.t;
        const w = sw.watch ? view.volts(sw.watch) : undefined;
        this.timing = { start: prev, ...(w !== undefined ? { watch: w } : {}) };
        update.panels = true;
      }
      if (this.timing && stopped) {
        // A relay's click carries its own time; a fast restart can start and stop within one snapshot.
        const st = sw.stop;
        const clicks = "contact" in st ? s.events.filter((e) => e.type === "clicked" && e.partId === st.part && e.data?.["to"] === st.contact).map((e) => e.t) : [];
        const at = clicks.length ? Math.max(...clicks) : started ? this.timing.start : s.t;
        const stop = Math.max(this.timing.start, at);
        const run: StopwatchRun = { start: this.timing.start, stop, seconds: stop - this.timing.start, ...(this.timing.watch !== undefined ? { watch: this.timing.watch } : {}) };
        this.runs = [...this.runs, run].slice(-MAX_RUNS);
        this.timing = null;
        update.panels = true;
      } else if (this.timing && !("contact" in sw.start) && !this.holds(sw.start, s)) {
        // Switching the start condition off again abandons a run that never finished.
        this.timing = null;
        update.panels = true;
      }
    }
    const lg = this.built.logger;
    const starts = lg?.start ? (Array.isArray(lg.start) ? lg.start : [lg.start]) : [];
    let begun = false;
    starts.forEach((st, i) => {
      if (this.edge(`logger${i}`, st, s)) begun = true;
    });
    if (begun) {
      this.loggerT0 = s.t;
      update.panels = true;
    }
    const tp = this.tapper;
    if (tp?.on && s.t >= tp.next - 1e-9) {
      const pressed = !tp.pressed;
      this.tapper = { ...tp, pressed, next: Math.max(tp.next + 1 / (2 * tp.hz), s.t) };
      update.inputs.push({ id: tp.part, key: "pressed", value: pressed });
    } else if (tp && !tp.on && tp.pressed) {
      this.tapper = { ...tp, pressed: false };
      update.inputs.push({ id: tp.part, key: "pressed", value: false });
    }
  }

  /** A running stopwatch's start time, for the display. */
  get timingSince(): number | null {
    return this.timing?.start ?? null;
  }

  private friedLabel(partId: string, kind: string, event: SimEvent): string | undefined {
    const f = this.lab.fried;
    if (typeof f === "function") {
      try {
        const out = f({ partId, kind, event, lab: this.view() });
        if (out) return out;
      } catch {
        // Fall back to the part's own label.
      }
    } else if (f) {
      const byId = f[partId] ?? f[kind];
      if (byId) return byId;
    }
    return this.built.labels[partId];
  }

  private captureReading(view: LabView, update: SessionUpdate): void {
    const m = view.meter;
    const b = this.bench.meter;
    if (!m || !b || m.mode === "off" || m.display === null || m.value === null || (!b.probes.red.tip.to && !b.probes.black.tip.to)) {
      this.stable = null;
      return;
    }
    const key = `${m.mode}|${m.range ?? ""}|${b.probes.red.tip.to ?? ""}|${b.probes.black.tip.to ?? ""}`;
    const t = view.t;
    const close = this.stable && this.stable.key === key && (m.value === this.stable.value || (Number.isFinite(m.value) && Math.abs(m.value - this.stable.value) <= Math.abs(this.stable.value) * 0.004 + 0.0015));
    if (!close) {
      this.stable = { key, since: t, value: m.value, logged: false };
      return;
    }
    if (this.stable!.logged || t - this.stable!.since < STABLE_SECONDS) return;
    this.stable!.logged = true;
    const tags = readingTags(view);
    for (const [tag, when] of Object.entries(this.lab.notebook?.tags ?? {})) {
      try {
        if (when(view)) tags.push(tag);
      } catch {
        // Ignore a broken tag.
      }
    }
    const r: Reading = { t, mode: m.mode, range: m.range, display: m.display, unit: m.unit, value: m.value, si: m.si ?? m.value, tags };
    this.readings.push(r);
    if (this.readings.length > MAX_READINGS) this.readings.shift();
    update.captured.push(r);
  }
}
