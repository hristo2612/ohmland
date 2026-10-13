/**
 * The live lab: owns the bench store, the simulator worker and a LabSession, and keeps them in step.
 *
 * - Every committed bench change rebuilds the netlist and reloads the simulator (state carries over by part id).
 * - Bench "input" actions (switches, buttons, the dial) go to sim.setInput.
 * - Each snapshot goes to the bench (glow, smoke, the meter's LCD) and to the session, which checks task goals.
 * - Finished tasks, fried parts and achievement triggers come back as UI state and callbacks.
 *
 * No three.js here: the 3D view (BenchView) loads separately and attaches to `store`.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import { createBenchStore, type BenchAction, type BenchState, type BenchStore, type MeterMode } from "@ohmland/bench/core";
import type { InputKey, InputValue, Netlist, SimClient, SimEvent } from "@ohmland/sim";
import type { BuiltBench, SimInput } from "./build";
import { isOptional, type LabDefinition, type LabTask, type Reading, type TaskStatus } from "./define";
import { parseNote } from "./notes";
import { LabSession, type FriedRecord } from "./session";
import { applyStep, solutionSegments } from "./steps";
import { createToneMeter } from "./tone";

export type MascotMood = "idle" | "happy" | "thinking" | "oops" | "celebrate";

export type FriedCard = FriedRecord & { key: number; shownLabel: string; replaced: boolean };

export type RuntimeUi = {
  ready: boolean;
  failed: boolean;
  status: Record<string, TaskStatus>;
  /** Task ids finished in this visit, for the success animation. */
  fresh: string[];
  readings: Reading[];
  fried: FriedCard[];
  mascot: { line: string; mood: MascotMood } | null;
  notice: { key: number; message: string } | null;
  /** A task being shown by "Show me". */
  showing: string | null;
  spareFuses: number | null;
  controls: Record<string, number>;
  /** How far the simulator runs behind real time, 0..1. */
  lag: number;
};

export type RuntimeHooks = {
  onTaskDone?: (task: LabTask) => void;
  onFried?: (card: FriedCard) => void;
  onTrigger?: (name: string) => void;
  /** Called for every snapshot the bench shows (scope, tests). */
  onTick?: () => void;
  /** Turn a fried part into a Hall label when the lab gives none. */
  labelFor: (rec: FriedRecord, bench: BenchState) => string;
  /** A short sound for an event (muted handling is the caller's). */
  sound?: (kind: "success" | "bonus" | "fried" | "click") => void;
  /** Audio samples from the speakers. */
  audio?: (samples: Float32Array, rate: number) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMPTY: Netlist = { parts: [] };

export class LabRuntime {
  readonly lab: LabDefinition;
  readonly built: BuiltBench;
  readonly store: BenchStore;
  readonly session: LabSession;
  readonly ui: StoreApi<RuntimeUi>;
  private sim: SimClient | null = null;
  private hooks: RuntimeHooks;
  private unsub: (() => void)[] = [];
  private gen = 0;
  private fresh = false;
  private disposed = false;
  private cardKey = 1;
  private audioOff: (() => void) | null = null;
  private tone = createToneMeter();
  private noteSpecs = new Map<string, { unit?: string }>();
  /** Simulated seconds per real second (1, or more for a time-lapse). */
  private speed = 1;

  constructor(lab: LabDefinition, built: BuiltBench, done: readonly string[], hooks: RuntimeHooks) {
    this.lab = lab;
    this.built = built;
    this.hooks = hooks;
    this.session = new LabSession(lab, built, done);
    for (const t of lab.tasks) for (const n of t.note ? (Array.isArray(t.note) ? t.note : [t.note]) : []) this.noteSpecs.set(n.id, n.unit ? { unit: n.unit } : {});
    // Resuming with tasks already done: start from the solution's checkpoint for the next task, when there is one.
    const cur = this.session.current();
    const start = done.length && cur ? this.checkpoint(cur.id) : null;
    this.store = createBenchStore(start?.bench ?? built.bench);
    if (start) this.session.setBench(start.bench);
    // Readouts over parts and the room lights live in the bench store; the speed control sets the run speed.
    this.speed = lab.speed ?? 1;
    const patch: { inspect?: NonNullable<BuiltBench["inspect"]>; ambient?: number } = {};
    if (built.inspect?.length) patch.inspect = built.inspect;
    for (const c of built.controls) {
      if (c.key === "speed") this.speed = c.value;
      if (c.key === "room") patch.ambient = c.value;
    }
    if (Object.keys(patch).length) this.store.setState(patch);
    this.ui = createStore<RuntimeUi>()(() => ({
      ready: false,
      failed: false,
      status: { ...this.session.status },
      fresh: [],
      readings: [],
      fried: [],
      mascot: lab.mascot?.start ? { line: lab.mascot.start, mood: "happy" } : null,
      notice: null,
      showing: null,
      spareFuses: built.spareFuses,
      controls: { ...this.session.controls },
      lag: 0,
    }));
    this.startInputs = start ? [...built.inputs, ...start.inputs] : built.inputs;
  }

  private startInputs: SimInput[];

  /** Connects the simulator. Pass a client that is already starting (prefetched) or a factory. */
  async start(sim: Promise<SimClient>): Promise<void> {
    let client: SimClient;
    try {
      client = await sim;
    } catch (err) {
      console.error(err);
      this.ui.setState({ failed: true });
      return;
    }
    if (this.disposed) {
      client.dispose();
      return;
    }
    this.sim = client;
    this.unsub.push(client.onSnapshot((s) => this.tick(s)));
    this.unsub.push(
      // A drag changes the bench inside an open transaction and commits by closing it: rebuild once it is closed and
      // the bench differs from the one the simulator runs.
      this.store.subscribe((s) => {
        if (!s.txBase && s.bench !== this.session.bench) this.benchChanged(s.bench);
      }),
    );
    client.load(this.session.net.netlist);
    for (const i of this.startInputs) client.setInput(i.id, i.key, i.value);
    this.syncAudio(this.session.bench);
    client.run({ speed: this.speed });
    this.ui.setState({ ready: true });
    const onVis = () => {
      if (!this.sim) return;
      if (document.hidden) this.sim.pause();
      else this.sim.run({ speed: this.speed });
    };
    document.addEventListener("visibilitychange", onVis);
    this.unsub.push(() => document.removeEventListener("visibilitychange", onVis));
  }

  dispose(): void {
    this.disposed = true;
    for (const u of this.unsub.splice(0)) u();
    this.audioOff?.();
    this.sim?.dispose();
    this.sim = null;
  }

  /** The <Bench onAction> handler: simulator inputs from switches, buttons and the dial. */
  readonly onAction = (a: BenchAction): void => {
    if (a.type === "input") {
      this.sim?.setInput(a.partId, a.key, a.value);
      if (a.key === "pressed" || a.key === "to") this.hooks.sound?.("click");
    }
  };

  private benchChanged(bench: BenchState): void {
    const net = this.session.setBench(bench);
    this.session.synced = false;
    const gen = ++this.gen;
    if (this.fresh) {
      // A reset or a "Show me": start the circuit from scratch (no carried-over damage or charge).
      this.sim?.load(EMPTY);
      this.session.resetCircuit();
      this.fresh = false;
    }
    this.sim?.load(net.netlist);
    this.syncAudio(bench);
    void this.sim?.snapshot().then(() => {
      if (gen === this.gen) this.session.synced = true;
    });
  }

  /** Listen to the speakers only while there is one on the bench. */
  private syncAudio(bench: BenchState): void {
    const has = bench.parts.some((p) => p.kind === "speaker");
    if (has && !this.audioOff && this.sim) {
      this.audioOff = this.sim.onAudio((samples, rate) => {
        this.session.tone = this.tone.push(samples, rate);
        this.hooks.audio?.(samples, rate);
      });
    } else if (!has && this.audioOff) {
      this.audioOff();
      this.audioOff = null;
      this.session.tone = null;
    }
  }

  private tick(s: Parameters<LabSession["ingest"]>[0]): void {
    this.store.setState({ snapshot: s });
    const u = this.session.ingest(s);
    const patch: Partial<RuntimeUi> = {};
    if (Math.abs((s.lag ?? 0) - this.ui.getState().lag) > 0.05) patch.lag = s.lag ?? 0;
    if (u.completed.length) {
      patch.status = { ...this.session.status };
      patch.fresh = [...this.ui.getState().fresh, ...u.completed.map((t) => t.id)];
      for (const t of u.completed) this.hooks.onTaskDone?.(t);
      const last = u.completed[u.completed.length - 1]!;
      const all = this.session.requiredDone();
      const line = last.mascot?.success ?? (all ? this.lab.mascot?.exit ?? this.lab.mascot?.success : this.lab.mascot?.success);
      patch.mascot = line ? { line, mood: "celebrate" } : this.ui.getState().mascot;
      this.hooks.sound?.(u.completed.some((t) => !isOptional(t)) ? "success" : "bonus");
    }
    if (u.fried.length) {
      const cards = u.fried.map((rec) => {
        const card: FriedCard = { ...rec, key: this.cardKey++, shownLabel: rec.label ?? this.hooks.labelFor(rec, this.session.bench), replaced: false };
        this.hooks.onFried?.(card);
        return card;
      });
      patch.fried = [...this.ui.getState().fried.filter((c) => !c.replaced), ...cards].slice(-3);
      const cur = this.session.current();
      const line = cur?.mascot?.fried ?? this.lab.mascot?.fried;
      patch.mascot = { line: line ?? "", mood: "oops" };
      if (!line) patch.mascot = null;
      this.hooks.sound?.("fried");
    }
    if (u.captured.length) patch.readings = [...this.session.readings];
    if (u.notices.length) patch.notice = { key: this.cardKey++, message: noticeText(u.notices[u.notices.length - 1]!) };
    for (const name of u.triggers) this.hooks.onTrigger?.(name);
    if (Object.keys(patch).length) this.ui.setState(patch);
    this.hooks.onTick?.();
  }

  // ---- Learner actions from the panels --------------------------------------------------------------------

  setMeterMode(mode: MeterMode): void {
    this.store.getState().setMeterMode(mode);
  }

  setMeterRange(range: string): void {
    const m = this.store.getState().bench.meter;
    if (!m) return;
    this.store.getState().apply((b) => (b.meter ? { ...b, meter: { ...b.meter, range } } : b));
    this.sim?.setInput(m.id, "range", range);
  }

  setInput(id: string, key: InputKey, value: InputValue): void {
    this.sim?.setInput(id, key, value);
  }

  replacePart(card: FriedCard): void {
    if (card.kind === "meter-fuse") this.replaceFuse();
    else {
      this.sim?.setInput(card.partId, "replace", true);
      if (this.session.bench.parts.find((p) => p.id === card.partId)?.kind === "relay") this.sim?.setInput(`${card.partId}:2`, "replace", true);
      this.session.revive(card.partId);
    }
    this.ui.setState({ fried: this.ui.getState().fried.filter((c) => c.key !== card.key) });
  }

  replaceFuse(): void {
    const m = this.session.bench.meter;
    const spares = this.ui.getState().spareFuses;
    if (!m || spares === 0) return;
    this.sim?.setInput(m.id, "replaceFuse", true);
    this.session.revive(`${m.id}:fuse`);
    this.ui.setState({
      spareFuses: spares === null ? null : spares - 1,
      fried: this.ui.getState().fried.filter((c) => c.kind !== "meter-fuse"),
    });
  }

  dismissFried(key: number): void {
    this.ui.setState({ fried: this.ui.getState().fried.filter((c) => c.key !== key) });
  }

  skip(taskId: string): void {
    this.session.skip(taskId);
    this.ui.setState({ status: { ...this.session.status } });
  }

  setNote(id: string, text: string): number | null {
    const v = text.trim() === "" ? null : parseNote(text, this.noteSpecs.get(id)?.unit);
    this.session.setNote(id, v);
    return v;
  }

  setControl(id: string, value: number): void {
    const c = this.built.controls.find((x) => x.id === id);
    if (!c) return;
    this.session.setControl(id, value);
    if (c.key === "speed") {
      // run() with a new speed while running just changes the speed.
      this.speed = value;
      this.sim?.run({ speed: value });
    } else if (c.key === "room") this.store.setState({ ambient: value });
    else if (c.part !== undefined) this.sim?.setInput(c.part, c.key, value);
    this.ui.setState({ controls: { ...this.session.controls } });
  }

  sayHint(task: LabTask): void {
    const line = task.mascot?.hint ?? this.lab.mascot?.hint;
    if (line) this.ui.setState({ mascot: { line, mood: "thinking" } });
  }

  /** Puts a whole bench on the table with fresh parts (the sandbox's clear and open). */
  loadBench(bench: BenchState): void {
    this.loadFresh(bench, []);
    this.ui.setState({ fried: [], notice: null, readings: [] });
  }

  /** Back to the lab's starting bench with fresh parts. Task progress stays. */
  reset(): void {
    this.loadFresh(this.built.bench, this.built.inputs);
    this.ui.setState({ fried: [], notice: null });
  }

  private loadFresh(bench: BenchState, inputs: SimInput[]): void {
    this.fresh = true;
    this.store.getState().load(bench);
    // load() does not count as a change when the bench is the same object; force the rebuild.
    if (this.fresh) this.benchChanged(bench);
    for (const i of inputs) this.sim?.setInput(i.id, i.key, i.value);
  }

  /** The bench (and inputs) after replaying the solution up to where `taskId`'s own steps begin. */
  checkpoint(taskId: string): { bench: BenchState; inputs: SimInput[] } | null {
    const seg = solutionSegments(this.lab.solution).get(taskId);
    if (!seg) return null;
    let bench = this.built.bench;
    const inputs: SimInput[] = [];
    for (let i = 0; i < seg.start; i++) {
      const e = applyStep(bench, this.lab.solution[i]!);
      bench = e.bench;
      for (const inp of e.inputs) if (!inp.after) inputs.push(inp);
    }
    return { bench, inputs };
  }

  canShow(taskId: string): boolean {
    const seg = solutionSegments(this.lab.solution).get(taskId);
    return !!seg && seg.end > seg.start;
  }

  /** "Show me": rewind to the task's checkpoint, then play its solution steps on the bench, one by one. */
  async showMe(taskId: string): Promise<void> {
    const seg = solutionSegments(this.lab.solution).get(taskId);
    const start = this.checkpoint(taskId);
    if (!seg || !start || this.ui.getState().showing) return;
    this.ui.setState({ showing: taskId, fried: [] });
    this.loadFresh(start.bench, [...this.built.inputs, ...start.inputs]);
    await sleep(700);
    for (let i = seg.start; i < seg.end && !this.disposed; i++) {
      const step = this.lab.solution[i]!;
      const e = applyStep(this.store.getState().bench, step);
      if (e.bench !== this.store.getState().bench) this.store.getState().apply(() => e.bench);
      for (const inp of e.inputs) {
        if (inp.after) setTimeout(() => this.sim?.setInput(inp.id, inp.key, inp.value), inp.after * 1000);
        else this.sim?.setInput(inp.id, inp.key, inp.value);
      }
      if (e.note) this.session.setNote(e.note.id, parseNote(e.note.value, this.noteSpecs.get(e.note.id)?.unit));
      if (e.control) this.setControl(e.control.id, e.control.value);
      await sleep(step.do === "wait" ? step.seconds * 1000 : 850);
    }
    this.ui.setState({ showing: null });
  }
}

function noticeText(e: SimEvent): string {
  return e.message;
}
