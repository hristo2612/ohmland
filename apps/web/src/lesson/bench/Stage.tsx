/**
 * The bench of a bench lesson: the lab runtime (simulator worker, task goals), the bench itself through the
 * bench-view adapter, and the lesson's layers over it (ink marks, tap targets, the pop-up card). A lazy chunk: the
 * lesson's first screen never waits for it, and three.js arrives with the bench chunk after that.
 *
 * The player (BenchLesson.tsx) owns the flow. It tells the stage which task may complete right now (`gate`; the
 * secret bonus is always armed), and the stage reports tasks, fried parts, nudges and taps back.
 */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useStore } from "zustand";
import { boardGeometry, trayLeft } from "@ohmland/bench/core";
import type { LabDefinition, LabTask } from "../../lab/define";
import { m } from "../../i18n";
import { useLearner } from "../../progress/store";
import { prefersReducedMotion } from "../../progress/prefs";
import { LabAudio } from "../../lab/audio";
import { buildBench } from "../../lab/build";
import { BenchSurfaceChunk, type BenchController, type BenchViewKind } from "../../lab/bench-view";
import { ConnectionsPanel, ControlsPanel, MeterPanel, ScopePanel } from "../../lab/instruments";
import { LabPanels } from "../../lab/panels-ui";
import { LoggerPanel, StopwatchPanel, TapperPanel } from "../../lab/timing";
import { friedLabel } from "../../lab/labels";
import { loadedLab, loadLab } from "../../lab/labs";
import { takeSim } from "../../lab/prefetch";
import { pickQuality } from "../../lab/quality";
import { LabRuntime, type FriedCard } from "../../lab/runtime";
import { applyStep } from "../../lab/steps";
import { Annotations, useSize, useViewTick } from "./Annotations";
import { holeName } from "./flow";
import { allHoles, resolveAnchor, type Mark } from "./marks";
import { ResistorSlider } from "./ResistorSlider";
import type { Popup } from "../../content/schema";
import "../../lab/lab.css";

const Surface = BenchSurfaceChunk.Component;

export type StageCheck = { kind: "targets"; targets: string[] } | { kind: "meet"; part: string } | { kind: "holes"; hover?: boolean } | null;

/** What the player may ask of the bench once it is up. */
export type StageApi = {
  lab: LabDefinition;
  runtime: LabRuntime;
  task(id: string): LabTask | undefined;
  /** Puts the bench where this task starts (the solution's state at the previous check) and applies its setup. */
  applySetup(taskId: string): void;
  showMe(taskId: string): void;
  skip(taskIds: string[]): void;
  replace(card: FriedCard): void;
  /** A name for a bench anchor, for screen readers and the notebook. */
  labelOf(anchor: string): string;
  /** A short name to write on the bench ("cathode, the short leg", "1.5 kΩ resistor"). */
  nameOf(anchor: string): string;
  /** A hole id for what the learner typed ("c7", "+21"), or null. */
  holeFor(text: string): string | null;
  /** Lets go of whatever the bench has selected (a new beat starts clean). */
  calm(): void;
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
  /** Parts in play: spotlit. */
  spot: string[] | null;
  xray: boolean;
  /** Hint highlights of the current task. */
  hintHighlight: string[] | undefined;
  marks: Mark[];
  check: StageCheck;
  popup: Popup | null;
  /** The one instrument or panel the beat needs ("meter", "scope", "logger", "stopwatch", "tapper", "controls" or a
   * lab panel id). Null: the panel the lab ties to the current task, if any. */
  tool: string | null;
  keyboardOpen: boolean;
  onApi(api: StageApi | null): void;
  onBenchReady(): void;
  onBenchFailed(): void;
  onTaskDone(id: string): void;
  onFried(card: FriedCard): void;
  onNudge(line: string): void;
  onNotice(text: string): void;
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
  if (failed) return <p className="bl-bench-note">{m.lessonBench.failed}</p>;
  if (!lab) return <StageSkeleton />;
  return <StageRunner {...props} lab={lab} />;
}

export function StageSkeleton() {
  return (
    <div className="bl-skeleton" role="status" aria-label={m.lessonBench.loading}>
      <span className="bl-skeleton__line" aria-hidden="true" />
    </div>
  );
}

const NUDGE_HOLD = 0.8;

function StageRunner(props: StageProps & { lab: LabDefinition }) {
  const { lab, lessonId } = props;
  const cb = useRef(props);
  cb.current = props;
  const gate = useRef({ task: props.gate, secret: props.secret });
  gate.current = { task: props.gate, secret: props.secret };

  // The lab as the lesson runs it: a task's goal only counts while the lesson waits for it (or it is the secret).
  const gated = useMemo<LabDefinition>(
    () => ({
      ...lab,
      tasks: lab.tasks.map((t) => ({ ...t, goal: (v) => (t.id === gate.current.task || t.id === gate.current.secret) && t.goal(v) })),
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
          useLearner.getState().labEvent({ type: "task", lessonId, taskId: t.id });
          cb.current.onTaskDone(t.id);
        },
        onFried: (card) => {
          useLearner.getState().recordFried(card.kind, card.shownLabel, lessonId, { silent: true });
          cb.current.onFried(card);
        },
        onTrigger: (name) => useLearner.getState().labEvent({ type: "trigger", name, lessonId }),
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
  const nudge = useRef<{ task: string | null; since: number | null; said: string | null; at: number }>({ task: null, since: null, said: null, at: 0 });
  function tickNudges() {
    const n = nudge.current;
    if (++n.at % 6) return;
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

  // Simulator notices (a short, a warning): the margin says them.
  useEffect(() => {
    if (ui.notice) cb.current.onNotice(ui.notice.message);
  }, [ui.notice]);

  // X-ray of the breadboard's strips.
  useEffect(() => {
    runtime.store.getState().setUi({ xray: props.xray });
  }, [runtime, props.xray]);

  const controllerRef = useRef<BenchController | null>(null);

  const api = useMemo<StageApi>(
    () => ({
      lab,
      runtime,
      task: (id) => lab.tasks.find((t) => t.id === id),
      applySetup(taskId) {
        const task = lab.tasks.find((t) => t.id === taskId);
        if (!task?.setup?.length) return;
        const start = runtime.checkpoint(taskId);
        let b = start?.bench ?? runtime.store.getState().bench;
        for (const step of task.setup) b = applyStep(b, step).bench;
        runtime.loadBench(b);
        for (const i of start?.inputs ?? []) runtime.setInput(i.id, i.key, i.value);
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
        const name = built.labels[id] ?? b.parts.find((p) => p.id === id)?.kind ?? id;
        if (kind === "part") return name;
        const legName = leg ? (m.lessonBench.legs[leg] ?? leg) : "";
        return legName ? `${name}: ${legName}` : name;
      },
      calm() {
        const st = runtime.store.getState();
        if (st.ui.selection || st.ui.menu) st.setUi({ selection: null, menu: null });
      },
      nameOf(anchor) {
        const b = runtime.store.getState().bench;
        const raw = resolveAnchor(b, anchor) ?? anchor;
        const [kind, rest = ""] = raw.split(":") as [string, string?];
        if (kind === "hole") return holeName(rest);
        const [id = "", leg] = rest.split(".");
        if (leg) return m.lessonBench.legs[leg] ?? leg;
        return (built.labels[id] ?? id).toLowerCase();
      },
      holeFor(text) {
        const b = runtime.store.getState().bench;
        if (!b.board) return null;
        const t = text.trim().toLowerCase().replace(/\s+/g, "");
        const rail = /^([+-])(\d+)$/.exec(t);
        const id = rail ? `${rail[1] === "+" ? "bp" : "bn"}${rail[2]}` : t;
        return boardGeometry(b.board).holes.has(id) ? id : null;
      },
    }),
    [lab, runtime, built],
  );
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

  // Frame and spotlight the parts in play (a whole-bench view when none are named). On a phone the bench is small, so
  // a beat about one part brings that part close.
  const spotKey = (props.spot ?? []).join(",");
  useEffect(() => {
    const c = controllerRef.current;
    if (!c || !benchReady) return;
    const b = runtime.store.getState().bench;
    const raw = (props.spot ?? []).map((s) => resolveAnchor(b, s)).filter((x): x is string => !!x);
    c.spotlight(raw.length ? raw : null);
    // A part in play keeps some bench around it: close enough to tell its legs apart, never a lone close-up.
    const box = stageRef.current?.getBoundingClientRect();
    c.focus(raw, raw.length && box ? { padding: Math.round(Math.min(box.width, box.height) * 0.26) } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotKey, runtime, benchReady]);

  return (
    <div ref={stageRef} className="bl-stage" data-bench-ready={benchReady || undefined} data-lab-ready data-lab={lab.id} onPointerDownCapture={() => audio.unlock()} onKeyDownCapture={() => audio.unlock()}>
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
          <Annotations controllerRef={controllerRef} bench={bench} marks={props.marks} />
          <TapLayer controllerRef={controllerRef} bench={bench} check={props.check} labelOf={api.labelOf} onTap={(a) => cb.current.onTap(a)} />
          {props.popup && (
            <PopupCard controllerRef={controllerRef} bench={bench} at={props.popup.at} title={m.lessonBench.popup.resistorTitle}>
              <ResistorSlider runtime={runtime} props={props.popup.props} onDone={() => cb.current.onPopupDone()} />
            </PopupCard>
          )}
        </div>
      )}
      <ToolDock runtime={runtime} built={built} tool={props.tool ?? defaultTool(lab, props.gate)} />
      {props.keyboardOpen && (
        <div className="bl-keyboard">
          <p className="bl-keyboard__hint">{m.lessonBench.keyboardHint}</p>
          <ConnectionsPanel runtime={runtime} />
        </div>
      )}
    </div>
  );
}

/** A seed that is the same for a learner every visit (their first finished lesson), for shuffled mystery parts. */
function learnerSeed(): string {
  const lessons = Object.entries(useLearner.getState().learner.lessons);
  if (!lessons.length) return "guest";
  const [id, rec] = lessons.reduce((a, b) => (b[1].at < a[1].at ? b : a));
  return `${id}|${rec.at}`;
}

/** The panel a lab ties to a task (`show`), when the beat names no tool. */
function defaultTool(lab: LabDefinition, task: string | null): string | null {
  if (!task) return null;
  return lab.panels?.find((p) => p.show?.includes(task))?.id ?? null;
}

/** One instrument at a time, only when the beat needs it: a slip on the bench's lower edge. */
function ToolDock({ runtime, built, tool }: { runtime: LabRuntime; built: ReturnType<typeof buildBench>; tool: string | null }) {
  if (!tool) return null;
  let body: ReactNode = null;
  if (tool === "meter" && built.bench.meter) body = <MeterPanel runtime={runtime} />;
  else if (tool === "scope" && built.scope) body = <ScopePanel runtime={runtime} config={built.scope} />;
  else if (tool === "logger" && built.logger) body = <LoggerPanel runtime={runtime} config={built.logger} />;
  else if (tool === "stopwatch" && built.stopwatch) body = <StopwatchPanel runtime={runtime} config={built.stopwatch} />;
  else if (tool === "tapper" && built.tapper) body = <TapperPanel runtime={runtime} config={built.tapper} />;
  else if (tool === "controls" && built.controls.length) body = <ControlsPanel runtime={runtime} controls={built.controls} />;
  else if (runtime.lab.panels?.some((p) => p.id === tool)) body = <LabPanels runtime={runtime} only={tool} />;
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
      return p ? [{ id: t, x: p.x, y: p.y, big: check.kind === "meet" || !t.includes(".") }] : [];
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
