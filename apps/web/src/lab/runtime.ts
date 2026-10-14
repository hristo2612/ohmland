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
import type { InputKey, InputValue, Netlist, SimClient, SimEvent, Snapshot } from "@ohmland/sim";
import type { Diagnostic } from "@ohmland/code";
import { controlTargets, type BuiltBench, type SimInput } from "./build";
import { isOptional, isPanelView, type LabDefinition, type LabTask, type LabViews, type OverlayName, type PanelViewName, type Reading, type TaskStatus } from "./define";
import { boardPart, DAY_49, flashed, uploadError, uploadTo } from "./mcu";
import { parseNote } from "./notes";
import { LabSession, type FriedRecord } from "./session";
import { seededRandom } from "./signals";
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
  /** Bumped whenever a panel, the stopwatch, the logger or the tapper changes (panels re-render on it). */
  panels: number;
  /** The scope's single shot: armed and waiting, capturing, or a finished capture. */
  capture: Capture | null;
  /** The views and overlays that are on (flow dots, push, x-ray, the tracer). */
  views: LabViews;
  /** Bumped whenever a board's program, serial output or code drawer changes (the code tools re-render on it). */
  code: number;
};

/** A single-shot scope capture: times in seconds from the trigger, one series per trace. */
export type Capture = { state: "armed" | "running" | "done"; at: number; series: { label: string; points: [number, number][] }[] };

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
  /** Relay contacts moved `count` times in the last snapshot (toward NO if `pull`): clicks, or a buzz when fast. */
  relay?: (count: number, pull: boolean) => void;
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
  /** Settles in progress (the lab's `settle`): their snapshots are not shown or judged. */
  private settling = 0;
  /** Buttons held from the keys panel or the keyboard: by a key, a finger on the on-screen key, or pinned down. */
  private held = new Map<string, "key" | "touch" | "pin">();
  /** A histogram the fast roller is working on. */
  private fastRolling: string | null = null;

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
    // Overlays the lab starts with; the store and the session stay in step from here on.
    if (built.overlays) this.store.getState().setOverlay({ flow: built.overlays.flow, push: built.overlays.push });
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
      panels: 0,
      capture: null,
      views: { ...this.session.views },
      code: this.session.mcu.version,
    }));
    this.store.subscribe((s, prev) => {
      if (s.overlay === prev.overlay && s.ui.xray === prev.ui.xray) return;
      this.session.views = { flow: s.overlay.flow, push: s.overlay.push, xray: s.ui.xray, trace: s.overlay.trace?.from ?? null };
      this.ui.setState({ views: { ...this.session.views } });
    });
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
    if (this.lab.settle) await this.settle();
    else client.run({ speed: this.speed });
    if (this.disposed) return;
    this.ui.setState({ ready: true });
    const onVis = () => {
      if (!this.sim) return;
      if (document.hidden) this.sim.pause();
      else this.sim.run({ speed: this.speed });
    };
    document.addEventListener("visibilitychange", onVis);
    this.unsub.push(() => document.removeEventListener("visibilitychange", onVis));
    this.bindKeys();
  }

  /** Keyboard keys bound to buttons by the lab's keys panels: held while the key is down, all through the lab. */
  private bindKeys(): void {
    const buttons = (this.lab.panels ?? []).flatMap((p) => (p.kind === "keys" ? p.buttons : []));
    if (!buttons.length || typeof window === "undefined") return;
    const find = (e: KeyboardEvent) => buttons.find((b) => b.key.toLowerCase() === e.key.toLowerCase());
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      const b = find(e);
      if (!b || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      e.preventDefault();
      if (!e.repeat && !this.held.has(b.part)) this.holdButton(b.part, "key");
    };
    const up = (e: KeyboardEvent) => {
      const b = find(e);
      if (b && this.held.get(b.part) === "key") this.releaseButton(b.part);
    };
    // Letting go of everything when the window loses focus: a key released elsewhere never sends keyup here.
    const blur = () => {
      for (const [part, how] of this.held) if (how === "key") this.releaseButton(part);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    this.unsub.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    });
  }

  /** Holds a pushbutton down (a key, a finger, or pinned by a tap) until released. */
  holdButton(part: string, how: "key" | "touch" | "pin"): void {
    const was = this.held.has(part);
    this.held.set(part, how);
    if (!was) {
      this.sim?.setInput(part, "pressed", true);
      this.hooks.sound?.("click");
    }
    this.bumpPanels();
  }

  releaseButton(part: string): void {
    if (!this.held.delete(part)) return;
    this.sim?.setInput(part, "pressed", false);
    this.bumpPanels();
  }

  /** How a button is being held from the keys panel, if it is. */
  heldBy(part: string): "key" | "touch" | "pin" | null {
    return this.held.get(part) ?? null;
  }

  /** The learner starts a slow-motion replay of a timing diagram's latest burst. */
  replayTiming(panelId: string): void {
    this.session.replayTiming(panelId);
    this.bumpPanels();
  }

  /** Rolls a histogram's dice `times` times by pressing its button (0 stops the roller). */
  roll(panelId: string, times?: number): void {
    this.session.startRolls(panelId, times);
    this.bumpPanels();
  }

  clearRolls(panelId: string): void {
    this.session.clearRolls(panelId);
    this.bumpPanels();
  }

  get rollingFast(): string | null {
    return this.fastRolling;
  }

  /**
   * Many rolls quickly: holds the button, records 20 ms of the running dice finely (their pips' currents every 20 µs),
   * lets go, and draws `times` release moments from the recording. Exact for dice clocked faster than a few hundred
   * hertz (the arcade's 4.8 kHz laps all 36 pairs in 7.5 ms). A slow die rolls one by one instead.
   */
  async fastRolls(panelId: string, times = 1000): Promise<void> {
    const cfg = this.lab.panels?.find((p) => p.id === panelId);
    const sim = this.sim;
    if (!cfg || cfg.kind !== "histogram" || !sim || this.fastRolling) return;
    if (cfg.read) {
      this.roll(panelId, times);
      return;
    }
    this.fastRolling = panelId;
    this.bumpPanels();
    sim.pause();
    sim.setInput(cfg.button, "pressed", true);
    await sim.step(0.05);
    const lit = (snap: Snapshot, id: string) => snap.parts[id]?.health !== "dead" && Math.abs(snap.parts[id]?.i ?? 0) > 2e-4;
    const samples: number[][] = [];
    let changes = 0;
    for (let k = 0; k < 1000 && !this.disposed; k++) {
      const snap = await sim.step(2e-5);
      const faces = cfg.dice.map((pips) => pips.filter((id) => lit(snap, id)).length);
      const prev = samples[samples.length - 1];
      if (prev && prev.join() !== faces.join()) changes++;
      samples.push(faces);
    }
    sim.setInput(cfg.button, "pressed", false);
    await sim.step(cfg.settle ?? 0.3);
    if (this.disposed) return;
    this.fastRolling = null;
    if (changes < 12) {
      // Not running fast enough to sample: roll for real.
      this.roll(panelId, Math.min(times, 100));
    } else {
      const rng = seededRandom(`${panelId}:fast:${this.session.rolls[panelId]?.list.length ?? 0}`);
      this.session.addRolls(panelId, Array.from({ length: times }, () => samples[Math.floor(rng() * samples.length)]!), true);
      this.bumpPanels();
    }
    if (!document.hidden) sim.run({ speed: this.speed });
  }

  dispose(): void {
    this.disposed = true;
    for (const u of this.unsub.splice(0)) u();
    this.audioOff?.();
    this.sim?.dispose();
    this.sim = null;
  }

  /** How many actions the learner has taken on the bench (a lesson holds a fix-it's nudges until the first). */
  actions = 0;

  /** The <Bench onAction> handler: simulator inputs from switches, buttons and the dial. */
  readonly onAction = (a: BenchAction): void => {
    this.actions++;
    // The board refusing a part (a surface-mount chip on holes), however the bench names that action.
    const any = a as { type: string; partId?: unknown };
    if (/refus|reject/.test(any.type) && typeof any.partId === "string") {
      this.session.noteRejected(any.partId);
      this.bumpPanels();
    }
    if (a.type === "input") {
      if (this.ui.getState().capture?.state === "armed" && (a.key === "pressed" || a.key === "to") && this.edgeMatches(a.value)) {
        void this.captureAround({ id: a.partId, key: a.key, value: a.value });
      } else this.sim?.setInput(a.partId, a.key, a.value);
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
    this.syncCode();
    // Sliders that drive every part of a kind (the desk lamp) reach parts placed since.
    for (const c of this.built.controls) if (c.part === "*") for (const id of controlTargets(bench, c)) this.sim?.setInput(id, c.key, this.session.controls[c.id] ?? c.value);
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
        this.session.toneQuick = this.tone.quick();
        this.hooks.audio?.(samples, rate);
      });
    } else if (!has && this.audioOff) {
      this.audioOff();
      this.audioOff = null;
      this.session.tone = null;
      this.session.toneQuick = null;
    }
  }

  private tick(s: Parameters<LabSession["ingest"]>[0]): void {
    if (this.settling) return;
    this.store.setState({ snapshot: s });
    // The solder overlay runs the station on the simulator's clock; goals read it through lab.solder.
    this.session.station = this.store.getState().station;
    const u = this.session.ingest(s);
    for (const inp of u.inputs) this.sim?.setInput(inp.id, inp.key, inp.value);
    if (this.hooks.relay) {
      for (const e of s.events) {
        if (e.type !== "clicked" || e.partId.includes(":")) continue;
        if (this.session.bench.parts.find((p) => p.id === e.partId)?.kind !== "relay") continue;
        this.hooks.relay(Number(e.data?.["count"] ?? 1), e.data?.["to"] === "no");
      }
    }
    const patch: Partial<RuntimeUi> = {};
    if (u.panels) patch.panels = this.ui.getState().panels + 1;
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
    if (this.session.mcu.version !== this.ui.getState().code) patch.code = this.session.mcu.version;
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
    else {
      for (const target of controlTargets(this.session.bench, c)) {
        // A knob's position lives on the bench too, so the 3D knob turns with the slider.
        if (c.key === "position" && this.store.getState().bench.parts.some((p) => p.id === target)) this.store.getState().setParams(target, { position: value });
        else this.sim?.setInput(target, c.key, value);
      }
    }
    this.ui.setState({ controls: { ...this.session.controls } });
  }

  // ---- Panels and instruments ------------------------------------------------------------------------------

  private bumpPanels(): void {
    this.ui.setState({ panels: this.ui.getState().panels + 1 });
  }

  /** The learner submits a panel answer. */
  answerPanel(id: string, value: unknown): void {
    this.session.answer(id, value);
    this.bumpPanels();
  }

  clearPanel(id: string): void {
    this.session.clearPanel(id);
    this.bumpPanels();
  }

  /** Look inside a mystery part (a clear cover, its terminals named). */
  peek(partId: string): void {
    const p = this.store.getState().bench.parts.find((x) => x.id === partId);
    if (p) this.store.getState().apply((b) => ({ ...b, parts: b.parts.map((x) => (x.id === partId ? ({ ...x, params: { ...x.params, peek: true } } as typeof x) : x)) }));
  }

  setTapper(on: boolean): void {
    this.session.setTapper(on);
    this.bumpPanels();
  }

  /**
   * Switches an overlay or the board's x-ray on or off (the toggles, a lesson, "Show me"), or opens and closes a chip's
   * x-ray panel ("xray:U1"). Goals read them with `lab.view(name)`.
   */
  setView(name: OverlayName | "xray" | PanelViewName, on: boolean): void {
    if (isPanelView(name)) {
      if (this.session.panelViews.has(name) === on) return;
      this.session.setView(name, on);
      this.bumpPanels();
      return;
    }
    const st = this.store.getState();
    if (name === "xray") st.setUi({ xray: on });
    else if (name === "push") st.setOverlay({ push: on });
    else if (name === "electrons") st.setOverlay({ flow: on ? "electrons" : st.overlay.flow === "electrons" ? "current" : st.overlay.flow });
    else st.setOverlay({ flow: on ? (st.overlay.flow === "off" ? "current" : st.overlay.flow) : "off" });
  }

  // ---- The code drawer (Unit 5) ---------------------------------------------------------------------------

  private syncCode(): void {
    const v = this.session.mcu.version;
    if (v !== this.ui.getState().code) this.ui.setState({ code: v });
  }

  /**
   * Upload: a program with a mistake is refused (the mistake is returned and noted for `lab.code`), else it goes to the
   * board, which restarts and runs it from `setup()`. The drawer plays its short upload moment before calling this.
   */
  upload(board: string, source: string): Diagnostic | null {
    const error = uploadError(source);
    this.session.noteUpload(board, source, error);
    if (!error) {
      // An upload is not a bench edit: undo and redo move parts and leads, the board keeps the program it was given.
      const st = this.store.getState();
      const bench = uploadTo(st.bench, board, source);
      const upload = boardPart(bench, board)?.params.upload ?? 0;
      const keep = (b: BenchState) => flashed(b, board, source, upload);
      this.store.setState({ bench, past: st.past.map(keep), future: st.future.map(keep) });
    }
    this.syncCode();
    return error;
  }

  /** The program in a board's code drawer changed (it reaches the board only on Upload). */
  setDraft(board: string, source: string): void {
    this.session.setDraft(board, source);
  }

  private beatPrograms = new Set<string>();

  /**
   * A lesson beat's starting program goes into the drawer once per visit, the first time that beat's drawer opens
   * (the learner's edits after that are theirs). Returns whether it did.
   */
  beatProgram(beatKey: string, board: string, source: string): boolean {
    if (this.beatPrograms.has(beatKey)) return false;
    this.beatPrograms.add(beatKey);
    this.setDraft(board, source);
    return true;
  }

  /** The code drawer switched between its blocks and its text (`lab.view("code:text")`). */
  setCodeView(board: string, view: "blocks" | "text"): void {
    this.session.setCodeView(board, view);
    this.bumpPanels();
  }

  /** Sets a board's clock so `millis()` reads `ms` now (default: nine seconds before it wraps, the day-49 jump). */
  jumpMillis(board: string, ms = DAY_49): void {
    this.sim?.setInput(board, "millis", ms);
  }

  /** Runs the loop tracer from an anchor ("pin:B1.neg"), or clears its ink with null. */
  trace(from: string | null): void {
    this.store.getState().trace(from);
  }

  startLogger(): void {
    this.session.startLogger();
    this.bumpPanels();
  }

  /** Whether a switch action is the edge the single shot waits for: "on" is a press or a throw to b, "off" the reverse. */
  private edgeMatches(value: InputValue): boolean {
    const edge = this.built.scope?.capture?.edge;
    if (!edge) return true;
    const on = value === true || value === "b";
    return edge === "on" ? on : !on;
  }

  /** Arms the scope's single shot (or disarms it, or clears a finished capture). */
  armCapture(on: boolean): void {
    this.ui.setState({ capture: on ? { state: "armed", at: 0, series: [] } : null });
  }

  /**
   * Single shot: pause the live run, apply the learner's switch action, step the simulator finely through the next
   * few milliseconds (sub-microsecond steps at first, for a coil's kickback), then carry on in real time.
   */
  private async captureAround(input: { id: string; key: InputKey; value: InputValue }): Promise<void> {
    const sim = this.sim;
    const scope = this.built.scope;
    if (!sim || !scope?.capture) {
      this.sim?.setInput(input.id, input.key, input.value);
      return;
    }
    this.ui.setState({ capture: { state: "running", at: 0, series: [] } });
    sim.pause();
    const t0 = (await sim.snapshot()).t;
    sim.setInput(input.id, input.key, input.value);
    const total = scope.capture.ms / 1000;
    const steps: number[] = [];
    for (let i = 0; i < 40; i++) steps.push(total / 4000);
    for (let i = 0; i < 36; i++) steps.push(total / 400);
    let done = 40 * (total / 4000) + 36 * (total / 400);
    while (done < total - 1e-12) {
      const dt = Math.min(total / 80, total - done);
      steps.push(dt);
      done += dt;
    }
    const series = scope.traces.slice(0, 2).map((tr) => ({ label: tr.label, points: [] as [number, number][] }));
    const sample = (snap: Snapshot) => {
      const view = this.session.view();
      scope.traces.slice(0, 2).forEach((tr, k) => {
        let v: number | undefined;
        if ("volts" in tr) {
          const a = view.volts(tr.volts, tr.ref);
          v = a;
        } else if ("amps" in tr) v = (snap.parts[tr.amps]?.i ?? 0) * 1000;
        else v = (snap.parts[tr.glow]?.glow ?? 0) * 100;
        if (v !== undefined) series[k]!.points.push([snap.t - t0, v]);
      });
    };
    for (const dt of steps) {
      if (this.disposed) return;
      sample(await sim.step(dt));
    }
    this.ui.setState({ capture: { state: "done", at: t0, series } });
    this.session.capture = { at: t0, series };
    if (!this.disposed && !document.hidden) sim.run({ speed: this.lab.speed ?? 1 });
  }

  sayHint(task: LabTask): void {
    const line = task.mascot?.hint ?? this.lab.mascot?.hint;
    if (line) this.ui.setState({ mascot: { line, mood: "thinking" } });
  }

  /** Puts a whole bench on the table with fresh parts (the sandbox's clear and open). */
  loadBench(bench: BenchState): void {
    void this.loadFresh(bench, []);
    this.ui.setState({ fried: [], notice: null, readings: [] });
  }

  /** Back to the lab's starting bench with fresh parts. Task progress stays. */
  reset(): void {
    void this.loadFresh(this.built.bench, this.built.inputs);
    this.ui.setState({ fried: [], notice: null });
  }

  /** Resolves once the fresh circuit has settled (the lab's `settle`; at once without one). */
  private loadFresh(bench: BenchState, inputs: SimInput[]): Promise<void> {
    this.fresh = true;
    this.store.getState().load(bench);
    // load() does not count as a change when the bench is the same object; force the rebuild.
    if (this.fresh) this.benchChanged(bench);
    for (const i of inputs) this.sim?.setInput(i.id, i.key, i.value);
    return this.settle();
  }

  /**
   * Runs the circuit unseen for the lab's `settle` seconds, then on in real time: a 555 that woke with its latch set
   * has finished its glow before the learner sees the bench. Starts after the caller's own inputs (a setup's), so
   * they settle too. Nothing it passes through is shown or judged.
   */
  private async settle(): Promise<void> {
    const secs = this.lab.settle;
    const sim = this.sim;
    if (!secs || !sim) return;
    this.settling++;
    try {
      await Promise.resolve();
      if (this.disposed) return;
      sim.pause();
      await sim.step(secs);
    } finally {
      this.settling--;
      if (!this.disposed && !this.settling && !document.hidden) sim.run({ speed: this.speed });
    }
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
      // A delayed input (a timed press's release) has happened by the next step: keep its final value, undelayed.
      for (const { after: _after, ...inp } of e.inputs) inputs.push(inp);
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
    await this.loadFresh(start.bench, [...this.built.inputs, ...start.inputs]);
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
      if (e.panel) {
        this.session.answer(e.panel.id, e.panel.value, true);
        this.bumpPanels();
      }
      if (e.tapper !== undefined) this.setTapper(e.tapper);
      if (e.view) this.setView(e.view.name, e.view.on);
      if (e.panelView) this.setView(e.panelView.name, e.panelView.on);
      if (e.roll) this.roll(e.roll.id, e.roll.times);
      if (e.trace !== undefined) this.trace(e.trace);
      if (e.code) {
        this.session.noteUpload(e.code.part, e.code.source, e.code.error);
        this.syncCode();
      }
      // At least the step's own simulated time (a long press must end before the next step), and a beat to watch.
      await sleep(step.do === "wait" ? step.seconds * 1000 : Math.max(850, e.wait * 1000));
    }
    this.ui.setState({ showing: null });
  }
}

function noticeText(e: SimEvent): string {
  return e.message;
}
