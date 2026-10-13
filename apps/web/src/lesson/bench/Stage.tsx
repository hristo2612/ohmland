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
import { boardGeometry } from "@ohmland/bench/core";
import type { LabDefinition, LabTask } from "../../lab/define";
import { m } from "../../i18n";
import { useLearner } from "../../progress/store";
import { prefersReducedMotion } from "../../progress/prefs";
import { LabAudio } from "../../lab/audio";
import { buildBench } from "../../lab/build";
import { BenchSurfaceChunk, type BenchController, type BenchViewKind } from "../../lab/bench-view";
import { ConnectionsPanel } from "../../lab/instruments";
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
  /** A hole id for what the learner typed ("c7", "+21"), or null. */
  holeFor(text: string): string | null;
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
  /** Parts in play: spotlit. */
  spot: string[] | null;
  xray: boolean;
  /** Hint highlights of the current task. */
  hintHighlight: string[] | undefined;
  marks: Mark[];
  check: StageCheck;
  popup: Popup | null;
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
  const built = useMemo(() => buildBench(lab.bench), [lab]);
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

  // Spotlight and frame the parts in play.
  const spotKey = (props.spot ?? []).join(",");
  useEffect(() => {
    const c = controllerRef.current;
    if (!c) return;
    const raw = (props.spot ?? []).map((s) => resolveAnchor(runtime.store.getState().bench, s)).filter((x): x is string => !!x);
    c.spotlight(raw.length ? raw.map((a) => a.replace(/^part:/, "")) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotKey, runtime]);

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

  const [quality] = useState(() => pickQuality());
  const [benchReady, setBenchReady] = useState(false);
  const readOnly = props.readOnly || !!ui.showing;

  return (
    <div className="bl-stage" data-bench-ready={benchReady || undefined} data-lab-ready data-lab={lab.id} onPointerDownCapture={() => audio.unlock()} onKeyDownCapture={() => audio.unlock()}>
      <Boundary onError={() => cb.current.onBenchFailed()}>
        <Suspense fallback={<StageSkeleton />}>
          <Surface
            view={props.view}
            runtime={runtime}
            tray={readOnly ? [] : built.tray}
            quality={quality}
            readOnly={readOnly}
            highlight={props.hintHighlight}
            locked={built.locked}
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
      {props.keyboardOpen && (
        <div className="bl-keyboard">
          <p className="bl-keyboard__hint">{m.lessonBench.keyboardHint}</p>
          <ConnectionsPanel runtime={runtime} />
        </div>
      )}
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
  return (
    <>
      {targets.map((t) => {
        const p = pointOf(t);
        if (!p) return null;
        const big = check.kind === "meet" || !t.includes(".");
        return (
          <button
            key={t}
            type="button"
            className={`bl-target${big ? " bl-target--part" : ""}`}
            style={{ left: p.x, top: p.y }}
            aria-label={m.lessonBench.tapHere(labelOf(t))}
            data-tap={t}
            onClick={() => onTap(t)}
          />
        );
      })}
    </>
  );
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
