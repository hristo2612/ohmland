/**
 * The lab step: the 3D bench driven by the simulator, with the task list, instruments and mascot beside it (below it
 * on phones, in a sheet that expands). Lazy-loaded by the lesson player; the bench itself (three.js) is a further
 * lazy chunk, so the panels appear first.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { Icon } from "../components/Icon";
import { MascotSay } from "../components/MascotSay";
import { m } from "../i18n";
import { useLearner } from "../progress/store";
import { LabAudio } from "./audio";
import { buildBench } from "./build";
import { isOptional, type LabDefinition, type LabTask } from "./define";
import { ConnectionsPanel, ControlsPanel, MeterPanel, Notebook, ScopePanel } from "./instruments";
import { LabPanels } from "./panels-ui";
import { LoggerPanel, StopwatchPanel, TapperPanel } from "./timing";
import { friedLabel } from "./labels";
import { loadLab } from "./labs";
import { takeSim } from "./prefetch";
import { autoQuality, pickQuality, storeQuality, type Quality } from "./quality";
import { LabRuntime } from "./runtime";
import { BenchBoundary, BenchSkeleton, FriedNotice, plain } from "./shell";
import { TaskList, type HintState } from "./tasks";
import "./lab.css";

const BenchView = lazy(() => import("./BenchView"));

export type LabStepProps = {
  labId: string;
  lessonId: string;
  intro?: string | undefined;
  /** Task ids already done (saved with the lesson's answers). */
  done: string[];
  onTaskDone(taskId: string): void;
};

export default function LabStep(props: LabStepProps) {
  const [lab, setLab] = useState<LabDefinition | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadLab(props.labId)
      .then((l) => alive && setLab(l))
      .catch((err) => {
        console.error(err);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [props.labId]);
  if (failed) return <p className="notice notice--warn">{m.lab.failed}</p>;
  if (!lab) return <div className="lab-loading skeleton" aria-label={m.lab.loading} role="status" />;
  return <LabRunner {...props} lab={lab} />;
}

/** A seed that is the same for a learner every visit (their first finished lesson), for shuffled mystery parts. */
function learnerSeed(): string {
  const lessons = Object.entries(useLearner.getState().learner.lessons);
  if (!lessons.length) return "guest";
  const [id, rec] = lessons.reduce((a, b) => (b[1].at < a[1].at ? b : a));
  return `${id}|${rec.at}`;
}

function LabRunner({ lab, lessonId, intro, done, onTaskDone }: LabStepProps & { lab: LabDefinition }) {
  const built = useMemo(() => buildBench(lab.bench, { seed: learnerSeed() }), [lab]);
  const muted = useLearner((s) => s.learner.settings.muted);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const doneRef = useRef(onTaskDone);
  doneRef.current = onTaskDone;
  const audio = useMemo(() => new LabAudio(() => mutedRef.current), []);
  const [live, setLive] = useState("");

  const runtime = useMemo(
    () =>
      new LabRuntime(lab, built, done, {
        onTaskDone: (t) => {
          doneRef.current(t.id);
          useLearner.getState().labEvent({ type: "task", lessonId, taskId: t.id });
          setLive(m.lab.announceDone(plain(t.prompt)));
        },
        onFried: (card) => {
          useLearner.getState().recordFried(card.kind, card.shownLabel, lessonId, { silent: true });
          setLive(m.lab.fried.title(card.shownLabel));
        },
        onTrigger: (name) => useLearner.getState().labEvent({ type: "trigger", name, lessonId }),
        labelFor: (rec, bench) => friedLabel(rec, bench),
        sound: (kind) => audio.cue(kind),
        audio: (samples) => audio.play(samples),
        relay: (count, pull) => audio.relay(count, pull),
      }),
    // A runtime per lab visit; `done` is read once, at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lab, built],
  );
  useEffect(() => {
    void runtime.start(takeSim());
    return () => {
      runtime.dispose();
      audio.dispose();
    };
  }, [runtime, audio]);

  const ui = useStore(runtime.ui);
  const [quality, setQuality] = useState<Quality>(() => pickQuality());
  const [hints, setHints] = useState<HintState>({});
  const [sheet, setSheet] = useState(false);
  const [benchReady, setBenchReady] = useState(false);
  const current = lab.tasks.find((t) => !isOptional(t) && ui.status[t.id] === "todo") ?? null;
  const required = lab.tasks.filter((t) => !isOptional(t));
  const doneCount = required.filter((t) => ui.status[t.id] === "done").length;
  const allDone = doneCount === required.length;

  const onHint = (t: LabTask) => {
    setHints((h) => ({ ...h, [t.id]: Math.min(t.hints.length, (h[t.id] ?? 0) + 1) }));
    runtime.sayHint(t);
  };
  // Bench hints: a task's highlights pulse once its first hint is open.
  const highlight = current && (hints[current.id] ?? 0) > 0 ? current.highlight : undefined;
  const hasMeter = !!built.bench.meter;
  const toggleQuality = () => {
    const next: Quality = quality === "high" ? "low" : "high";
    setQuality(next);
    storeQuality(next === autoQuality() ? null : next);
  };

  // The notice toast fades by itself.
  const [notice, setNotice] = useState<{ key: number; message: string } | null>(null);
  useEffect(() => {
    if (!ui.notice) return;
    setNotice(ui.notice);
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [ui.notice]);

  return (
    <div className="lab" data-lab-ready data-lab={lab.id} data-sheet={sheet ? "open" : "closed"} data-all-done={allDone || undefined} onPointerDownCapture={() => audio.unlock()} onKeyDownCapture={() => audio.unlock()}>
      <div className="lab__stage" data-bench-ready={benchReady || undefined}>
        <BenchBoundary fallback={<p className="lab__nobench notice notice--warn">{m.lab.noBench}</p>}>
          <Suspense fallback={<BenchSkeleton />}>
            <BenchView
              runtime={runtime}
              tray={built.tray}
              quality={quality}
              readOnly={!!ui.showing}
              highlight={highlight}
              locked={built.locked}
              frame={built.frame}
              onReady={() => setBenchReady(true)}
            />
            {!benchReady && <BenchSkeleton />}
          </Suspense>
        </BenchBoundary>
        {ui.failed && <p className="lab__nobench notice notice--warn">{m.lab.failed}</p>}
        <div className="lab__overlay" aria-live="polite">
          {ui.fried.map((c) => (
            <FriedNotice key={c.key} card={c} onReplace={() => runtime.replacePart(c)} onDismiss={() => runtime.dismissFried(c.key)} />
          ))}
          {notice && (
            <p className="lab-notice" key={notice.key}>
              <Icon name="alert" size={18} />
              <span>{notice.message}</span>
            </p>
          )}
          {ui.showing && (
            <p className="lab-notice lab-notice--info">
              <Icon name="play" size={18} />
              <span>{m.lab.showMeBody}</span>
            </p>
          )}
        </div>
      </div>

      <aside className="lab__panel" aria-label={lab.title}>
        <button type="button" className="lab__grip" aria-expanded={sheet} onClick={() => setSheet((s) => !s)}>
          <span className="lab__grip-bar" aria-hidden="true" />
          <span className="lab__grip-text">
            <span className="lab__grip-title">{current ? plain(current.prompt) : m.lab.allDone}</span>
            <span className="lab__grip-meta small">
              {m.lab.progress(doneCount, required.length)} · {sheet ? m.lab.collapse : m.lab.expand}
            </span>
          </span>
          {hasMeter && <MeterPanel runtime={runtime} compact />}
          <Icon name={sheet ? "chevron-down" : "chevron-up"} size={20} />
        </button>
        <header className="lab__head">
          <div className="lab__titles">
            <h2 className="lab__title">{lab.title}</h2>
            <p className="lab__progress small">
              <span className="lab__meterbar" aria-hidden="true">
                {required.map((t) => (
                  <span key={t.id} data-done={ui.status[t.id] === "done" || undefined} />
                ))}
              </span>
              {m.lab.progress(doneCount, required.length)}
            </p>
          </div>
          <div className="lab__tools" role="group" aria-label={m.lab.tools}>
            <button type="button" className="icon-btn icon-btn--small" title={m.lab.reset} aria-label={m.lab.reset} onClick={() => runtime.reset()} disabled={!!ui.showing}>
              <Icon name="retry" size={18} />
            </button>
            <button type="button" className="btn btn--small btn--tertiary lab__quality" onClick={toggleQuality} title={m.lab.quality} aria-label={`${m.lab.quality}: ${quality === "high" ? m.lab.qualityHigh : m.lab.qualityLow}`}>
              <Icon name="spark" size={16} />
              {quality === "high" ? m.lab.qualityHigh : m.lab.qualityLow}
            </button>
          </div>
        </header>
        <div className="lab__scroll">
          {intro && <div className="lab__intro prose" dangerouslySetInnerHTML={{ __html: intro }} />}
          {ui.mascot?.line && (
            <MascotSay pose={ui.mascot.mood} size={48} className="lab__say">
              {ui.mascot.line}
            </MascotSay>
          )}
          {allDone && <p className="lab__alldone small">{m.lab.allDone}</p>}
          <TaskList runtime={runtime} hints={hints} onHint={onHint} />
          <LabPanels runtime={runtime} />
          <ControlsPanel runtime={runtime} controls={built.controls} />
          {hasMeter && <Notebook runtime={runtime} />}
          <ConnectionsPanel runtime={runtime} />
        </div>
        {(hasMeter || built.scope || built.logger || built.stopwatch || built.tapper) && (
          <div className="lab__dock">
            {built.tapper && <TapperPanel runtime={runtime} config={built.tapper} />}
            {built.stopwatch && <StopwatchPanel runtime={runtime} config={built.stopwatch} />}
            {hasMeter && <MeterPanel runtime={runtime} />}
            {built.scope && <ScopePanel runtime={runtime} config={built.scope} />}
            {built.logger && <LoggerPanel runtime={runtime} config={built.logger} />}
          </div>
        )}
      </aside>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
