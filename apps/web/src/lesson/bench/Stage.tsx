/**
 * The bench of a bench lesson: the lab runtime (simulator worker, task goals), the bench itself through the
 * bench-view adapter, and the lesson's layers over it (ink marks, tap targets, the pop-up card). A lazy chunk: the
 * lesson's first screen never waits for it, and three.js arrives with the bench chunk after that.
 *
 * The player (BenchLesson.tsx) owns the flow. It tells the stage which task may complete right now (`gate`; the
 * secret bonus is always armed), and the stage reports tasks, fried parts, nudges and taps back.
 */
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useStore } from "zustand";
import { PRINTED_KINDS, boardGeometry, isOnBoard, trayCoverOf, trayLeft, type BenchState } from "@ohmland/bench/core";
import { DrawingSlip } from "@ohmland/bench/view";
import { isOptional, type LabDefinition, type LabTask, type SolutionStep } from "../../lab/define";
import { m } from "../../i18n";
import { Icon } from "../../components/Icon";
import { useLearner } from "../../progress/store";
import { prefersReducedMotion } from "../../progress/prefs";
import { LabAudio } from "../../lab/audio";
import { buildBench, type SimInput } from "../../lab/build";
import { BenchSurfaceChunk, type BenchController, type BenchViewKind } from "../../lab/bench-view";
import { ConnectionsPanel, ControlsPanel, ScopePanel, ViewsPanel } from "../../lab/instruments";
import { LabPanels } from "../../lab/panels-ui";
import { LoggerPanel, StopwatchPanel, TapperPanel } from "../../lab/timing";
import { friedLabel } from "../../lab/labels";
import { loadedLab, loadLab } from "../../lab/labs";
import { takeSim } from "../../lab/prefetch";
import { pickQuality } from "../../lab/quality";
import { LabRuntime, type FriedCard } from "../../lab/runtime";
import { applyStep } from "../../lab/steps";
import { legPin, partChip, pinNumber } from "../../lab/chips";
import { resolveAttach } from "../../lab/anchors";
import { Annotations, useSize, useViewTick } from "./Annotations";
import { holeName, type PinName } from "./flow";
import { allHoles, choiceScale, namedParts, resolveAnchor, wholeTargets, type Mark } from "./marks";
import { ResistorSlider } from "./ResistorSlider";
import { ContinuityInk, MeterInk, continuityFor } from "./ToolInk";
import { CoachMark } from "./CoachMark";
import { coachAnchors, firstMove } from "./coach";
import type { Popup } from "../../content/schema";
import type { LabLines } from "../../content/variants";
import type { CodeBeat } from "../../lab/code/CodeDrawer";
import "../../lab/lab.css";

const Surface = BenchSurfaceChunk.Component;
/** The microcontroller board's tools (code drawer, serial monitor, millis): a chunk of their own, for labs with a board. */
const CodeTools = lazy(() => import("../../lab/code/CodeTools"));

/** A simulator warning (a short, a part running hot): what happened and to which part, for the lesson to draw. */
export type StageNotice = { type: string; partId: string; cause?: string };

export type StageCheck = { kind: "targets"; targets: string[] } | { kind: "meet"; part: string } | { kind: "holes"; hover?: boolean } | null;

/** What the player may ask of the bench once it is up. */
export type StageApi = {
  lab: LabDefinition;
  runtime: LabRuntime;
  task(id: string): LabTask | undefined;
  /** Puts the bench where this task starts (the solution's state at the previous check) and applies its setup. */
  applySetup(taskId: string): void;
  /** Applies bench steps on top of the bench as it is now (a check's `then`), the way a setup's are applied. */
  applySteps(steps: readonly SolutionStep[]): void;
  showMe(taskId: string): void;
  skip(taskIds: string[]): void;
  replace(card: FriedCard): void;
  /** A name for a bench anchor, for screen readers and the notebook. */
  labelOf(anchor: string): string;
  /** A short name to write on the bench ("cathode, the short leg", "1.5 kΩ resistor"). */
  /** The learner's name for an anchor; a chip's pin by the words `named` gives it ("pin 2, trigger"). */
  nameOf(anchor: string, named?: readonly PinName[]): string;
  /** A hole id for what the learner typed ("c7", "+21"), or null. */
  holeFor(text: string): string | null;
  /** Lets go of whatever the bench has selected (a new beat starts clean). */
  calm(): void;
  /** Runs the loop tracer from a terminal (lab shorthand, "B1.neg"), or clears its ink with null. */
  trace(from: string | null): void;
};

export type StageProps = {
  labId: string;
  lessonId: string;
  view: BenchViewKind;
  /** Tasks already done when the stage mounts (resume). */
  done: string[];
  /** The task the lesson is waiting for (others cannot complete). */
  gate: string | null;
  /** The secret bonus task: always armed. */
  secret: string | null;
  readOnly: boolean;
  /** Whether the tray of parts and leads is out (only while a task may need it). */
  trayOpen: boolean;
  /** Parts in play: spotlit and framed. */
  spot: string[] | null;
  /** Anchors to frame without a spotlight (a breadboard corner for a hole check). */
  frame: string[] | null;
  /**
   * Hands-on work: a beat's bench task ("beat") or a fix-it bench ("fix"). While its task is open, its parts in play
   * (and on a phone a beat's working parts, the lab's `highlight`) are framed whole, no closer than a reading scale.
   */
  hands?: "beat" | "fix" | null;
  /** The robot's line for the moment: hands-on framing keeps every part it names in view. */
  line?: string;
  xray: boolean;
  /** Hint highlights of the current task. */
  hintHighlight: string[] | undefined;
  marks: Mark[];
  /** Parts that died while the learner works on this beat, each with its Replace control on the bench beside it. */
  replace: { card: FriedCard; at: string }[];
  onReplace(card: FriedCard): void;
  check: StageCheck;
  popup: Popup | null;
  /** The one instrument or panel the beat needs ("meter", "scope", "logger", "stopwatch", "tapper", "controls", "views"
   * or a lab panel id). Null: the panel the lab ties to the current task, if any. */
  tool: string | null;
  /** Unit 5: the beat's code drawer palette and starting program (with `tool: code`). */
  code?: CodeBeat | null;
  /** The task whose first move the coach mark draws on the bench (a `do` beat's), or null. */
  coach?: string | null;
  /** A try-out copy: nothing goes to the learner's record (no fried parts, achievements or lab events). */
  trial?: boolean;
  /** The lesson's own words for the lab's tasks, in place of the lab's (a try-out voice). */
  labLines?: LabLines | undefined;
  keyboardOpen: boolean;
  onApi(api: StageApi | null): void;
  onBenchReady(): void;
  onBenchFailed(): void;
  onTaskDone(id: string): void;
  onFried(card: FriedCard): void;
  onNudge(line: string): void;
  onNotice(notice: StageNotice): void;
  onTap(anchor: string): void;
  onPopupDone(): void;
};

/** Catches a bench that cannot start (no WebGL). */
class Boundary extends Component<{ children: ReactNode; onError(): void }, { error: boolean }> {
  override state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  override componentDidCatch(err: unknown) {
    console.error(err);
    this.props.onError();
  }
  override render() {
    return this.state.error ? <p className="bl-bench-note">{m.lessonBench.noBench}</p> : this.props.children;
  }
}

export default function Stage(props: StageProps) {
  const [lab, setLab] = useState<LabDefinition | null>(() => loadedLab(props.labId));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadLab(props.labId)
      .then((l) => alive && setLab(l))
      .catch((err) => {
        console.error(err);
        if (alive) {
          setFailed(true);
          props.onBenchFailed();
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.labId]);
  const worded = useMemo(() => lab && withLines(lab, props.labLines), [lab, props.labLines]);
  if (failed) return <p className="bl-bench-note">{m.lessonBench.failed}</p>;
  if (!worded) return <StageSkeleton />;
  return <StageRunner {...props} lab={worded} />;
}

/** The lab with a lesson's own words for its tasks: hints, nudges (in the lab's order) and success lines. */
function withLines(lab: LabDefinition, lines: LabLines | undefined): LabDefinition {
  if (!lines) return lab;
  return {
    ...lab,
    tasks: lab.tasks.map((t) => {
      const w = lines[t.id];
      if (!w) return t;
      const nudges = t.nudges?.map((n, i) => ({ ...n, say: w.nudges?.[i] ?? n.say }));
      return { ...t, ...(w.hints ? { hints: w.hints } : {}), ...(w.success ? { success: w.success } : {}), ...(nudges ? { nudges } : {}) };
    }),
  };
}

export function StageSkeleton() {
  return (
    <div className="bl-skeleton" role="status" aria-label={m.lessonBench.loading}>
      <span className="bl-skeleton__line" aria-hidden="true" />
    </div>
  );
}

const NUDGE_HOLD = 0.8;
/** Reading scales for hands-on framing: CSS px between neighbouring breadboard holes on a phone and on a desktop. */
const READ_PHONE = 20;
const READ_DESK = 32;
/** The docked drawing slip on a phone: its width, and the room it takes at the top of the bench (framing keeps clear). */
const SLIP_WIDTH = 150;
const SLIP_TOP = 146;

function StageRunner(props: StageProps & { lab: LabDefinition }) {
  const { lab, lessonId } = props;
  const cb = useRef(props);
  cb.current = props;
  const gate = useRef({ task: props.gate, secret: props.secret });
  gate.current = { task: props.gate, secret: props.secret };

  // The lab as the lesson runs it: a task's goal only counts while the lesson waits for it (or it is the secret).
  // A bonus task that fires an achievement trigger stays armed the whole lesson, so a clean run can still earn it.
  const gated = useMemo<LabDefinition>(
    () => ({
      ...lab,
      tasks: lab.tasks.map((t) => {
        const always = isOptional(t) && !!t.trigger;
        return { ...t, goal: (v) => (always || t.id === gate.current.task || t.id === gate.current.secret) && t.goal(v) };
      }),
    }),
    [lab],
  );
  const built = useMemo(() => buildBench(lab.bench, { seed: learnerSeed() }), [lab]);
  const muted = useLearner((s) => s.learner.settings.muted);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const audio = useMemo(() => new LabAudio(() => mutedRef.current), []);

  const runtime = useMemo(
    () =>
      new LabRuntime(gated, built, props.done, {
        onTaskDone: (t) => {
          if (!props.trial) useLearner.getState().labEvent({ type: "task", lessonId, taskId: t.id });
          cb.current.onTaskDone(t.id);
        },
        onFried: (card) => {
          if (!props.trial) useLearner.getState().recordFried(card.kind, card.shownLabel, lessonId, { silent: true });
          cb.current.onFried(card);
        },
        onTrigger: (name) => {
          if (!props.trial) useLearner.getState().labEvent({ type: "trigger", name, lessonId });
        },
        onTick: () => tickNudges(),
        labelFor: (rec, bench) => friedLabel(rec, bench),
        sound: (kind) => audio.cue(kind),
        audio: (samples) => audio.play(samples),
        relay: (count, pull) => audio.relay(count, pull),
      }),
    // One runtime per visit; `done` is read once, at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gated, built],
  );

  // Nudges: the current task's typical mistakes, said once the bench has shown one for a moment.
  // `quiet`: the learner's action count when a setup put a broken bench down. Until they act, its nudges keep quiet:
  // the broken bench itself matches them, and saying one then would give the fix away.
  const nudge = useRef<{ task: string | null; since: number | null; said: string | null; at: number; quiet: number | null }>({ task: null, since: null, said: null, at: 0, quiet: null });
  function tickNudges() {
    const n = nudge.current;
    if (++n.at % 6) return;
    if (n.quiet !== null) {
      if (runtime.actions === n.quiet) return;
      n.quiet = null;
    }
    const task = gate.current.task ? lab.tasks.find((t) => t.id === gate.current.task) : undefined;
    if (!task?.nudges?.length || runtime.session.status[task.id] === "done") return;
    if (n.task !== task.id) Object.assign(n, { task: task.id, since: null, said: null });
    const view = runtime.session.view();
    const hit = task.nudges.find((x) => {
      try {
        return x.when(view);
      } catch {
        return false;
      }
    });
    if (!hit) {
      n.since = null;
      n.said = null;
      return;
    }
    if (n.since === null) n.since = view.t;
    if (n.said !== hit.say && view.t - n.since >= NUDGE_HOLD) {
      n.said = hit.say;
      cb.current.onNudge(hit.say);
    }
  }

  useEffect(() => {
    void runtime.start(takeSim());
    return () => {
      runtime.dispose();
      audio.dispose();
    };
  }, [runtime, audio]);

  const ui = useStore(runtime.ui);
  const bench = useStore(runtime.store, (s) => s.bench);

  // Simulator warnings (a short, a part running hot): the lesson draws a short note on the part, never the long words.
  useEffect(() => {
    if (ui.notice) cb.current.onNotice({ type: ui.notice.type, partId: ui.notice.partId, ...(ui.notice.cause ? { cause: ui.notice.cause } : {}) });
  }, [ui.notice]);

  // X-ray of the breadboard's strips.
  useEffect(() => {
    runtime.store.getState().setUi({ xray: props.xray });
  }, [runtime, props.xray]);

  const controllerRef = useRef<BenchController | null>(null);

  const api = useMemo<StageApi>(() => {
    /**
     * Puts `base` with `steps` applied on the bench (a task's setup, a check's `then`): their inputs after `before`, so
     * they win; their views and overlays (flow dots, push, x-ray) and controls (time back to normal speed); the loop
     * tracer last, on the bench as it now is. A setup starts the circuit fresh; a check's steps carry on from the bench
     * as it is (a charged capacitor stays charged). Neither can be undone.
     */
    const loadSteps = (base: BenchState, steps: readonly SolutionStep[], before: SimInput[], fresh: boolean) => {
      let b = base;
      const inputs = [...before];
      const views: { name: "flow" | "electrons" | "push" | "xray"; on: boolean }[] = [];
      const controls: { id: string; value: number }[] = [];
      let trace: string | null | undefined;
      for (const step of steps) {
        const e = applyStep(b, step);
        b = e.bench;
        for (const { after: _after, ...i } of e.inputs) inputs.push(i);
        if (e.view) views.push(e.view);
        if (e.control) controls.push(e.control);
        if (e.trace !== undefined) trace = e.trace;
      }
      if (fresh) runtime.loadBench(b);
      else runtime.store.getState().load(b);
      for (const i of inputs) runtime.setInput(i.id, i.key, i.value);
      for (const c of controls) runtime.setControl(c.id, c.value);
      for (const v of views) runtime.setView(v.name, v.on);
      if (trace !== undefined) runtime.trace(trace);
    };
    return {
      lab,
      runtime,
      task: (id) => lab.tasks.find((t) => t.id === id),
      applySetup(taskId) {
        const task = lab.tasks.find((t) => t.id === taskId);
        if (!task?.setup?.length) return;
        const start = runtime.checkpoint(taskId);
        // The setup's own inputs (a meter's mode or range, a switch) go after the checkpoint's, so they win.
        loadSteps(start?.bench ?? runtime.store.getState().bench, task.setup, start?.inputs ?? [], true);
        Object.assign(nudge.current, { quiet: runtime.actions, since: null, said: null });
      },
      applySteps(steps) {
        if (steps.length) loadSteps(runtime.store.getState().bench, steps, [], false);
      },
      showMe(taskId) {
        void runtime.showMe(taskId);
      },
      skip(ids) {
        for (const id of ids) runtime.skip(id);
      },
      replace(card) {
        runtime.replacePart(card);
      },
      labelOf(anchor) {
        const b = runtime.store.getState().bench;
        const raw = resolveAnchor(b, anchor) ?? anchor;
        const [kind, rest = ""] = raw.split(":") as [string, string?];
        if (kind === "hole") return holeName(rest);
        const [id = "", leg] = rest.split(".");
        const [partId = "", mark] = id.split("/");
        const name = built.labels[partId] ?? b.parts.find((p) => p.id === partId)?.kind ?? partId;
        if (kind === "part") return mark ? `${name}: ${markNameOf(b, partId, mark)}` : name;
        const legName = leg ? legNameOf(b, id, leg) : "";
        return legName ? `${name}: ${legName}` : name;
      },
      calm() {
        const st = runtime.store.getState();
        if (st.ui.selection || st.ui.menu) st.setUi({ selection: null, menu: null });
      },
      trace(from) {
        if (from === null) return runtime.trace(null);
        const a = resolveAttach(runtime.store.getState().bench, from);
        if (a) runtime.trace(a);
      },
      nameOf(anchor, named = []) {
        const b = runtime.store.getState().bench;
        const raw = resolveAnchor(b, anchor) ?? anchor;
        const [kind, rest = ""] = raw.split(":") as [string, string?];
        if (kind === "hole") return holeName(rest);
        const [id = "", leg] = rest.split(".");
        if (leg) return chipPinName(b, id, leg, named) ?? legNameOf(b, id, leg);
        const [partId = "", mark] = id.split("/");
        if (mark) return markNameOf(b, partId, mark);
        // Written mid-sentence: an ordinary first word loses its capital ("Red LED" -> "red LED"); units, symbols
        // and part numbers stay as they are ("4.7 kΩ tag", "2.2 MΩ", "NE555").
        return (built.labels[id] ?? id).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
      },
      holeFor(text) {
        const b = runtime.store.getState().bench;
        if (!b.board) return null;
        const t = text.trim().toLowerCase().replace(/\s+/g, "");
        const rail = /^([+-])(\d+)$/.exec(t);
        const id = rail ? `${rail[1] === "+" ? "bp" : "bn"}${rail[2]}` : t;
        return boardGeometry(b.board).holes.has(id) ? id : null;
      },
    };
  }, [lab, runtime, built]);
  useEffect(() => {
    cb.current.onApi(api);
    return () => cb.current.onApi(null);
  }, [api]);

  // The tray shows only while a task may need it, and only with something left in it. It is decided as a beat begins
  // and kept for the whole beat: every change reframes the bench, which must never happen under the learner's hand.
  const trayHas = () => {
    const b = runtime.store.getState().bench;
    return built.tray.some((item) => trayLeft(item, b) !== 0);
  };
  const [trayShown, setTrayShown] = useState(false);
  useEffect(() => {
    setTrayShown(props.trayOpen && trayHas());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.trayOpen, props.gate]);
  const [quality] = useState(() => pickQuality());
  const [benchReady, setBenchReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const readOnly = props.readOnly || !!ui.showing;

  // Frame and spotlight the parts in play (a whole-bench view when none are named), in the part of the bench the
  // docked tool leaves free. On a phone the bench is small, so a beat about one part brings that part close.
  const tool = props.tool ?? defaultTool(lab, props.gate);
  // A continuity table is drawn on its part, and stays there until the beat ends (its discovery reads off the arcs).
  const arcsNow = continuityFor(lab.panels, tool);
  const beatKey = props.code?.key ?? null;
  const arcsKept = useRef<{ beat: string | null; id: string } | null>(null);
  if (arcsNow) arcsKept.current = { beat: beatKey, id: arcsNow.id };
  const arcs = arcsNow ?? (arcsKept.current?.beat === beatKey ? continuityFor(lab.panels, arcsKept.current.id) : null);
  const spotKey = (props.spot ?? []).join(",");
  // A tap check on a chip's or display's pins: the spotlit part prints no pin numbers, which would answer it.
  const quietPins = props.check?.kind === "targets" && props.check.targets.some((t) => printsPins(bench, t));
  // Arcs need the part close: it is framed (at a reading scale while the hands work on it).
  const toolFrame = arcs ? [`part:${arcs.part}`] : [];
  const frameKey = [...(props.frame ?? []), ...toolFrame].join(",");
  // The docked tool's size: when it comes, goes or changes size the bench is framed again.
  const [dockKey, setDockKey] = useState("");
  // The parts tray, when it shows: the docked tool sits above its strip (a phone) or beside its column, never on it.
  const [stageW, setStageW] = useState(0);
  const cover = trayShown && !readOnly ? trayCoverOf(props.view, built.tray.length, stageW) : { left: 0, bottom: 0 };
  const trayKey = `${cover.left},${cover.bottom}`;
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !benchReady) return;
    const measure = () => {
      setStageW(stage.clientWidth);
      setDockKey(insetKey(dockInset(stage)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    const dock = stage.querySelector(":scope > .bl-tool");
    if (dock) ro.observe(dock);
    return () => ro.disconnect();
  }, [tool, benchReady, trayKey]);
  /** Where the hands last worked on a phone: a beat that names no parts picks up there. */
  const lastHands = useRef<string[] | null>(null);
  /** On a phone, the drawing being built from, docked as a slip above the bench while the board is framed close. */
  const [drawing, setDrawing] = useState<string | null>(null);
  // With the coach mark, a phone frames the beat's first move (where the ghost draws) rather than the task's highlight.
  const coachAt = useMemo(() => (props.coach ? coachAnchors(firstMove(runtime.lab, props.coach, runtime.store.getState().bench)) : []), [props.coach, runtime]);
  useEffect(() => {
    const c = controllerRef.current;
    const stage = stageRef.current;
    if (!c || !stage || !benchReady) return;
    const b = runtime.store.getState().bench;
    const resolve = (list: readonly string[] | null | undefined) => (list ?? []).map((s) => resolveAnchor(b, s)).filter((x): x is string => !!x);
    const spotted = resolve(props.spot);
    let framed = [...spotted, ...resolve(props.frame), ...toolFrame];
    c.spotlight(spotted.length ? spotted : null, quietPins ? { pins: false } : undefined);
    const inset: { top?: number; bottom?: number; right?: number } = dockInset(stage);
    const box = stage.getBoundingClientRect();
    const w = box.width - (inset.right ?? 0);
    const free = Math.max(0, Math.min(w, box.height - (inset.bottom ?? 0)));
    const phone = w < 640;
    // Hands-on work, while its task is open (once done, the discovery is framed as any beat's): the parts in play,
    // every part the robot's line names and, on a phone, the task's working parts (its hint highlight, a lead whole)
    // are all kept in view, no closer than a reading scale (holes about READ_PHONE px apart on a phone). What does
    // not fit at that scale is fitted, and the touch loupe does the aiming. A phone beat that names nothing keeps the
    // view where the hands already are.
    const working = !!props.hands && !!props.gate;
    let read: number | undefined;
    let slip: string | null = null;
    if (working) {
      const named = namedParts(props.line ?? "", b, built.labels).map((id) => `part:${id}`);
      const beat = props.hands === "beat";
      // A fix-it's hint highlight is its answer, and its line names the symptom: they never steer the view.
      // With the coach mark, the beat's first move (where the ghost draws) rather than the task's highlight.
      if (phone && beat) framed = [...framed, ...wholeTargets(b, coachAt.length ? coachAt : lab.tasks.find((t) => t.id === props.gate)?.highlight)];
      if ((phone && beat) || framed.length) framed = [...framed, ...named];
      // Probing: the probes' tips are what the hands move, so they stay in view with what they will touch.
      if (framed.length && tool === "meter" && b.meter) framed = [...framed, "probe:red", "probe:black"];
      framed = [...new Set(framed)];
      read = phone ? READ_PHONE : READ_DESK;
      if (phone && !framed.length && beat && lastHands.current?.length) framed = lastHands.current;
      // Nothing named on a phone: the circuit on the board, whole (a whole breadboard would be too small to touch).
      if (phone && !framed.length && b.board) framed = [...b.parts.filter((p) => isOnBoard(b, p)).map((p) => `part:${p.id}`), ...b.wires.map((x) => `wire:${x.id}`)];
      if (phone && beat && framed.length) lastHands.current = framed;
    }
    // Working from a drawing: on a phone the drawing does not fit beside the parts at a usable scale, so while other
    // parts are framed it is docked as a slip above the bench (framing keeps clear of it). A beat about the drawing
    // alone frames the drawing itself.
    const card = phone ? b.parts.find((p) => p.kind === "schematic") : undefined;
    const onCard = (t: string) => t === `part:${card?.id}` || b.parts.some((p) => p.kind === "piece" && t === `part:${p.id}`);
    if (card && framed.some((t) => !onCard(t))) {
      framed = framed.filter((t) => !onCard(t));
      slip = card.id;
      inset.top = SLIP_TOP;
    }
    setDrawing(slip);
    // A part in play keeps some bench around it: close enough to tell its legs apart and tap them, never a lone
    // close-up (both views frame at least about 24 mm of bench). A phone is narrow, so a smaller share of it goes to
    // the margin, and one big printed prop (a colour chart, a pencil card) fills the bench so its print can be read; a
    // value tag is small and reads with the usual margin.
    const one = spotted.length === 1 && framed.length === 1 ? b.parts.find((p) => `part:${p.id}` === spotted[0]) : undefined;
    const close = phone && !!one && PRINTED_KINDS.has(one.kind) && one.kind !== "tag";
    // Several parts in play are their own context: a modest margin keeps them close.
    const padding = close ? 8 : Math.round(free * (framed.length > 1 ? 0.06 : phone ? 0.12 : 0.3));
    // On a phone, work across several parts comes only as close as its choices need (neighbouring holes, or the
    // closest terminals of two different parts, about READ_PHONE px apart), and takes in the lab's whole view when
    // that is close enough. Work on one part (a gate's button, a box's lid) is simply framed.
    const near = phone && working && framed.length ? choiceScale(b, framed, READ_PHONE) : 0;
    c.focus(framed, framed.length ? { padding, inset, ...(read ? { read } : {}), ...(near > 0 ? { near, withHome: true } : {}) } : { inset });
    // What the bench frames and what the line names, for tests and screenshot checks.
    stage.dataset.framed = framed.join(" ");
    stage.dataset.named = namedParts(props.line ?? "", b, built.labels).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotKey, frameKey, runtime, benchReady, dockKey, quietPins, props.hands, props.gate, props.line, tool, coachAt]);

  return (
    <div
      ref={stageRef}
      className="bl-stage"
      style={{ "--bl-tray-left": `${cover.left}px`, "--bl-tray-bottom": `${cover.bottom}px` } as CSSProperties}
      data-bench-ready={benchReady || undefined}
      data-lab-ready
      data-lab={lab.id}
      onPointerDownCapture={() => audio.unlock()}
      onKeyDownCapture={() => audio.unlock()}
    >
      <Boundary onError={() => cb.current.onBenchFailed()}>
        <Suspense fallback={<StageSkeleton />}>
          <Surface
            view={props.view}
            runtime={runtime}
            tray={readOnly || !trayShown ? [] : built.tray}
            quality={quality}
            readOnly={readOnly}
            highlight={props.hintHighlight}
            locked={built.locked}
            frame={built.frame}
            controllerRef={controllerRef}
            onReady={() => {
              setBenchReady(true);
              cb.current.onBenchReady();
            }}
          />
          {!benchReady && <StageSkeleton />}
        </Suspense>
      </Boundary>
      {benchReady && (
        <div className="bl-overlay">
          {drawing && (
            <div className="bl-drawing" data-drawing={drawing}>
              <DrawingSlip bench={bench} id={drawing} width={SLIP_WIDTH} title={built.labels[drawing]} />
            </div>
          )}
          <Annotations controllerRef={controllerRef} bench={bench} marks={props.marks} />
          {props.coach && !readOnly && <CoachMark controllerRef={controllerRef} runtime={runtime} bench={bench} task={props.coach} />}
          {/* The meter's fuse has its own Replace on the docked meter. */}
          <ReplaceLayer controllerRef={controllerRef} bench={bench} items={props.replace.filter((r) => !(r.card.kind === "meter-fuse" && tool === "meter"))} onReplace={(c) => cb.current.onReplace(c)} />
          <TapLayer controllerRef={controllerRef} bench={bench} check={props.check} labelOf={api.labelOf} onTap={(a) => cb.current.onTap(a)} />
          {tool === "meter" && built.bench.meter && <MeterInk runtime={runtime} controllerRef={controllerRef} act={!!props.gate && !readOnly} readOnly={readOnly} />}
          {arcs && <ContinuityInk runtime={runtime} controllerRef={controllerRef} panel={arcs} />}
          {props.popup && (
            <PopupCard controllerRef={controllerRef} bench={bench} at={props.popup.at} title={m.lessonBench.popup.resistorTitle}>
              <ResistorSlider runtime={runtime} props={props.popup.props} onDone={() => cb.current.onPopupDone()} />
            </PopupCard>
          )}
        </div>
      )}
      <ToolDock runtime={runtime} built={built} tool={tool} code={props.code ?? null} />
      {props.keyboardOpen && (
        <div className="bl-keyboard">
          <p className="bl-keyboard__hint">{m.lessonBench.keyboardHint}</p>
          <ConnectionsPanel runtime={runtime} />
        </div>
      )}
    </div>
  );
}

/** A leg's name for the learner, by the kind of part it belongs to (a diode's band end, a transistor's base). */
function legNameOf(bench: BenchState, partId: string, leg: string): string {
  const kind = bench.parts.find((p) => p.id === partId)?.kind;
  return (kind ? m.lessonBench.legsByKind[kind]?.[leg] : undefined) ?? m.lessonBench.legs[leg] ?? leg;
}

/** A chip's pin for the learner: "pin 2", or "pin 2, trigger" once the lesson has named it with one of its words. */
function chipPinName(bench: BenchState, partId: string, leg: string, named: readonly PinName[]): string | null {
  const info = partChip(bench.parts.find((p) => p.id === partId));
  const n = info ? legPin(info, leg) : null;
  if (!info || !n) return null;
  const word = named.find((x) => x.part === partId && x.pin === n && pinNumber(info, x.word) === n)?.word;
  return word ? m.lessonBench.pinNamed(n, word) : m.lessonBench.pinNumbered(n);
}

/** Whether an anchor is a pin of a part that prints its pin numbers (a chip, a seven-segment display). */
function printsPins(bench: BenchState, anchor: string): boolean {
  const pin = /^pin:([^.]+)\./.exec(resolveAnchor(bench, anchor) ?? "");
  const kind = pin ? bench.parts.find((p) => p.id === pin[1])?.kind : undefined;
  return kind === "chip" || kind === "sevenseg";
}

/** A mark's name for the learner (part:M1/dial, part:CAB/wheel1, part:SD1/R1): its own name, else its id. */
function markNameOf(bench: BenchState, partId: string, mark: string): string {
  if (bench.parts.find((p) => p.id === partId)?.kind === "schematic") return m.lessonBench.markSymbol(mark);
  const wheel = /^wheel(\d+)$/.exec(mark);
  if (wheel) return m.lessonBench.markWheel(Number(wheel[1]));
  return m.lessonBench.marks[mark] ?? mark;
}

/** A seed that is the same for a learner every visit (their first finished lesson), for shuffled mystery parts. */
function learnerSeed(): string {
  const lessons = Object.entries(useLearner.getState().learner.lessons);
  if (!lessons.length) return "guest";
  const [id, rec] = lessons.reduce((a, b) => (b[1].at < a[1].at ? b : a));
  return `${id}|${rec.at}`;
}

/**
 * The part of the bench the docked tool covers, as a focus inset: along the bottom on a phone (the dock spans the
 * width), else beside it on the right when that leaves more of the bench in view. Rounded to 16 px, so a tool that
 * grows by a line does not move the bench under the learner's hand.
 */
function dockInset(stage: HTMLElement): { bottom?: number; right?: number } {
  const dock = stage.querySelector<HTMLElement>(":scope > .bl-tool");
  if (!dock) return {};
  const s = stage.getBoundingClientRect();
  const d = dock.getBoundingClientRect();
  const GAP = 8;
  const step = (v: number) => Math.ceil(Math.max(0, v) / 16) * 16;
  const bottom = step(s.bottom - d.top + GAP);
  const right = step(s.right - d.left + GAP);
  const beside = (s.width - right) * s.height;
  const above = s.width * (s.height - bottom);
  return s.width - right >= 320 && beside > above ? { right } : { bottom };
}
const insetKey = (i: { bottom?: number; right?: number }) => `${i.bottom ?? 0},${i.right ?? 0}`;

/** The panel a lab ties to a task (`show`), when the beat names no tool. */
function defaultTool(lab: LabDefinition, task: string | null): string | null {
  if (!task) return null;
  return lab.panels?.find((p) => p.show?.includes(task))?.id ?? null;
}

/**
 * One instrument at a time, only when the beat needs it: a slip on the bench's lower edge. The meter and a continuity
 * table have none: they are drawn on the bench (ToolInk.tsx).
 */
function ToolDock({ runtime, built, tool, code }: { runtime: LabRuntime; built: ReturnType<typeof buildBench>; tool: string | null; code: CodeBeat | null }) {
  if (!tool || tool === "meter" || continuityFor(runtime.lab.panels, tool)?.id === tool) return null;
  let body: ReactNode = null;
  if (tool === "scope" && built.scope) body = <ScopePanel runtime={runtime} config={built.scope} />;
  else if (tool === "logger" && built.logger) body = <LoggerPanel runtime={runtime} config={built.logger} />;
  else if (tool === "stopwatch" && built.stopwatch) body = <StopwatchPanel runtime={runtime} config={built.stopwatch} />;
  else if (tool === "tapper" && built.tapper) body = <TapperPanel runtime={runtime} config={built.tapper} />;
  else if (tool === "controls" && built.controls.length) body = <ControlsPanel runtime={runtime} controls={built.controls} />;
  else if (tool === "views" && built.overlays?.offer?.length) body = <ViewsPanel runtime={runtime} offer={built.overlays.offer} />;
  else if (runtime.lab.panels?.some((p) => p.id === tool)) body = <LabPanels runtime={runtime} only={tool} />;
  else if ((tool === "code" || tool === "serial" || tool === "millis") && built.bench.parts.some((p) => p.kind === "mcu-board"))
    body = (
      <Suspense fallback={null}>
        <CodeTools runtime={runtime} tool={tool} beat={code} />
      </Suspense>
    );
  if (!body) return null;
  return (
    <div className="bl-tool" data-tool={tool}>
      {body}
    </div>
  );
}

/** The interactive layer of a check: tap targets on parts and leads, or the whole board for hole taps. */
function TapLayer({
  controllerRef,
  bench,
  check,
  labelOf,
  onTap,
}: {
  controllerRef: RefObject<BenchController | null>;
  bench: import("@ohmland/bench/core").BenchState;
  check: StageCheck;
  labelOf(anchor: string): string;
  onTap(anchor: string): void;
}) {
  useViewTick(controllerRef);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const c = controllerRef.current;
  if (!check || !c) return null;

  const pointOf = (s: string) => {
    const a = resolveAnchor(bench, s);
    const p = a ? c.project(a) : null;
    return p && p.visible ? p : null;
  };

  if (check.kind === "holes") {
    const nearest = (x: number, y: number): { id: string; x: number; y: number } | null => {
      let best: { id: string; x: number; y: number } | null = null;
      let bestD = 22;
      for (const h of allHoles(bench)) {
        const p = c.project(`hole:${h}`);
        if (!p || !p.visible) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          bestD = d;
          best = { id: h, x: p.x, y: p.y };
        }
      }
      return best;
    };
    const local = (e: React.PointerEvent | React.MouseEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const near = hover ? nearest(hover.x, hover.y) : null;
    return (
      <div
        className="bl-holes"
        data-hole-layer
        onPointerMove={(e) => e.pointerType === "mouse" && setHover(local(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const p = local(e);
          const h = nearest(p.x, p.y);
          if (h) onTap(`hole:${h.id}`);
        }}
      >
        {near && <span className="bl-holes__hover" style={{ left: near.x, top: near.y }} aria-hidden="true" />}
      </div>
    );
  }

  const targets = check.kind === "meet" ? [check.part] : check.targets;
  const placed = spread(
    targets.flatMap((t) => {
      const p = pointOf(t);
      // A whole part gets a wide target; a leg or a mark on a part (part:M1/dial) a round one on its spot.
      return p ? [{ id: t, x: p.x, y: p.y, big: check.kind === "meet" || !/[./]/.test(t) }] : [];
    }),
  );
  return (
    <>
      <svg className="bl-leaders" aria-hidden="true">
        {placed.map((t) => (t.moved ? <line key={t.id} x1={t.x} y1={t.y} x2={t.ax} y2={t.ay} /> : null))}
      </svg>
      {placed.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`bl-target${t.big ? " bl-target--part" : ""}`}
          style={{ left: t.x, top: t.y }}
          aria-label={m.lessonBench.tapHere(labelOf(t.id))}
          data-tap={t.id}
          onClick={() => onTap(t.id)}
        />
      ))}
    </>
  );
}

/** A fried part's Replace control, on the bench just under the part (kept inside the bench), not in the margin. */
function ReplaceLayer({
  controllerRef,
  bench,
  items,
  onReplace,
}: {
  controllerRef: RefObject<BenchController | null>;
  bench: import("@ohmland/bench/core").BenchState;
  items: { card: FriedCard; at: string }[];
  onReplace(card: FriedCard): void;
}) {
  useViewTick(controllerRef);
  const [ref, size] = useSize();
  const c = controllerRef.current;
  return (
    <div className="bl-replace-host" ref={ref}>
      {c &&
        size.w > 0 &&
        items.map(({ card, at }) => {
          const a = resolveAnchor(bench, at);
          const p = a ? c.project(a) : null;
          if (!p || !p.visible) return null;
          const left = Math.max(64, Math.min(size.w - 64, p.x));
          const top = p.y + 72 < size.h - 8 ? p.y + 40 : Math.max(8, p.y - 84);
          return (
            <button key={card.key} type="button" className="bl-replace" style={{ left, top }} data-replace aria-label={m.lessonBench.replaceLabel(card.shownLabel.replace(/^[A-Z](?=[a-z])/, (x) => x.toLowerCase()))} onClick={() => onReplace(card)}>
              <Icon name="retry" size={16} />
              {card.kind === "meter-fuse" ? m.lab.meter.replaceFuse : m.lessonBench.replace}
            </button>
          );
        })}
    </div>
  );
}

/**
 * Tap targets that would overlap (two legs of one LED a few pixels apart) are pushed apart along the line between
 * them, keeping a thin leader line back to the true point, so each can be told apart and tapped.
 */
function spread(pts: { id: string; x: number; y: number; big: boolean }[]) {
  const out = pts.map((p) => ({ ...p, ax: p.x, ay: p.y, moved: false }));
  const MIN = 56;
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        if (d < 0.5) {
          dx = 0;
          dy = 1;
          d = 1;
        }
        const push = (MIN - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        a.moved = b.moved = true;
      }
  }
  return out;
}

/** The lesson's one pop-up card, taped to a part, kept inside the bench. */
function PopupCard({
  controllerRef,
  bench,
  at,
  title,
  children,
}: {
  controllerRef: RefObject<BenchController | null>;
  bench: import("@ohmland/bench/core").BenchState;
  at: string;
  title: string;
  children: ReactNode;
}) {
  useViewTick(controllerRef);
  const [ref, size] = useSize();
  const card = useRef<HTMLDivElement>(null);
  const a = resolveAnchor(bench, at);
  const p = a ? controllerRef.current?.project(a) : null;
  const w = card.current?.offsetWidth ?? 300;
  const h = card.current?.offsetHeight ?? 260;
  let left = 16;
  let top = 16;
  if (p && size.w) {
    left = Math.max(12, Math.min(size.w - w - 12, p.x - w * 0.35));
    // Below the part when there is room, else above it.
    top = p.y + 40 + h < size.h ? p.y + 40 : Math.max(12, p.y - h - 40);
  }
  const reduced = prefersReducedMotion();
  return (
    <div className="bl-popup-host" ref={ref}>
      <section ref={card} className={`bl-popup${reduced ? "" : " bl-popup--in"}`} style={{ left, top }} aria-label={title} data-popup>
        <span className="bl-popup__tape" aria-hidden="true" />
        <h2 className="bl-popup__title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
