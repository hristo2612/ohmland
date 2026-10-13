/**
 * The free-build bench (/bench): the lab runtime with no tasks. The tray holds the learner's unlocked parts, the meter
 * and scope come with their parts, builds save to the learner record, and "Start fresh" clears the bench.
 */
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { defaultMeter, emptyBench, partDef, type BenchState } from "@ohmland/bench/core";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { MascotSay } from "../components/MascotSay";
import { toast } from "../components/toast-store";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { partsBin } from "../progress/parts";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { LabAudio } from "./audio";
import type { BuiltBench } from "./build";
import type { LabDefinition, ScopeConfig } from "./define";
import { ConnectionsPanel, MeterPanel, Notebook, ScopePanel } from "./instruments";
import { friedLabel } from "./labels";
import { takeSim } from "./prefetch";
import { autoQuality, pickQuality, storeQuality, type Quality } from "./quality";
import { LabRuntime } from "./runtime";
import { sandboxKit } from "./sandbox-parts";
import { BenchBoundary, BenchSkeleton, FriedNotice } from "./shell";
import "./lab.css";

const BenchView = lazy(() => import("./BenchView"));

const SANDBOX: LabDefinition = {
  id: "sandbox",
  title: "",
  bench: { board: "none", parts: [], tray: [], instruments: [] },
  tasks: [],
  solution: [],
};

/** A fresh bench: the bare desk or a breadboard, with the meter when the learner has one. */
function freshBench(board: boolean, meter: boolean): BenchState {
  const b = emptyBench(board ? { kind: "bb830" } : null);
  if (meter) b.meter = defaultMeter(board ? [150, 4] : [120, 0], -12);
  return b;
}

export default function Sandbox({ outline, firstHref }: { outline: CourseOutline; firstHref: string }) {
  const ready = useLearnerReady(outline);
  if (!ready) return <div className="sandbox-loading skeleton" role="status" aria-label={m.lab.loading} />;
  return <SandboxBench outline={outline} firstHref={firstHref} />;
}

function SandboxBench({ outline, firstHref }: { outline: CourseOutline; firstHref: string }) {
  const learner = useLearner((s) => s.learner);
  const kit = useMemo(() => sandboxKit(partsBin(learner, outline)), [learner, outline]);
  const mutedRef = useRef(learner.settings.muted);
  mutedRef.current = learner.settings.muted;
  const audio = useMemo(() => new LabAudio(() => mutedRef.current), []);
  const runtime = useMemo(() => {
    const built: BuiltBench = {
      bench: freshBench(false, kit.meter),
      locked: [],
      tray: kit.tray,
      meter: kit.meter ? { kind: "meter" } : null,
      scope: null,
      logger: null,
      stopwatch: null,
      tapper: null,
      controls: [],
      nodes: {},
      labels: {},
      inputs: [],
      spareFuses: null,
      warnings: [],
    };
    return new LabRuntime(SANDBOX, built, [], {
      onFried: (card) => useLearner.getState().recordFried(card.kind, card.shownLabel, null, { silent: true }),
      onTrigger: (name) => useLearner.getState().labEvent({ type: "trigger", name, lessonId: null }),
      labelFor: (rec, bench) => friedLabel(rec, bench),
      sound: (kind) => audio.cue(kind),
      audio: (samples) => audio.play(samples),
    });
    // One runtime per visit; the kit only shapes the starting bench.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void runtime.start(takeSim());
    return () => {
      runtime.dispose();
      audio.dispose();
    };
  }, [runtime, audio]);

  const ui = useStore(runtime.ui);
  const bench = useStore(runtime.store, (s) => s.bench);
  const [quality, setQuality] = useState<Quality>(() => pickQuality());
  const [benchReady, setBenchReady] = useState(false);
  const [name, setName] = useState("");
  const [scopePart, setScopePart] = useState<string>("");
  const nameId = useId();
  const saved = Object.entries(learner.sandbox.saved).sort((a, b) => b[1].at.localeCompare(a[1].at));

  const start = (board: boolean) => {
    runtime.loadBench(freshBench(board, kit.meter && !!bench.meter));
    toast({ title: m.bench.clearDone, icon: "check", duration: 2500 });
  };
  const save = () => {
    const n = name.trim() || m.bench.defaultName(saved.length + 1);
    useLearner.getState().saveBench(n, runtime.store.getState().bench);
    setName("");
    toast({ title: m.bench.saved(n), icon: "check", duration: 3000 });
  };
  const open = (id: string) => {
    const b = learner.sandbox.saved[id];
    if (!b) return;
    runtime.loadBench(b.bench as BenchState);
    toast({ title: m.bench.openDone(b.name), icon: "check", duration: 3000 });
  };
  const toggleMeter = () => {
    runtime.store.getState().apply((b) => ({ ...b, meter: b.meter ? null : defaultMeter(b.board ? [150, 4] : [120, 0], -12) }));
  };
  const toggleQuality = () => {
    const next: Quality = quality === "high" ? "low" : "high";
    setQuality(next);
    storeQuality(next === autoQuality() ? null : next);
  };

  // The scope watches one part: its current and the voltage across it.
  const scopeChoices = bench.parts.filter((p) => partDef(p.kind).legs.length === 2);
  const watched = scopeChoices.find((p) => p.id === scopePart) ?? scopeChoices.find((p) => p.kind === "led") ?? scopeChoices[0];
  const watchedId = watched?.id;
  const watchedKind = watched?.kind;
  const scope = useMemo<ScopeConfig | null>(() => {
    if (!kit.scope || !watchedId || !watchedKind) return null;
    const [a, b] = partDef(watchedKind).legs;
    return {
      kind: "scope",
      window: 5,
      traces: [
        { label: m.bench.scopeAmps(watchedId), amps: watchedId },
        { label: m.bench.scopeVolts(watchedId), volts: `${watchedId}.${a}`, ref: `${watchedId}.${b}` },
      ],
    };
  }, [kit.scope, watchedId, watchedKind]);

  return (
    <div className="lab sandbox" data-lab-ready data-lab="sandbox" onPointerDownCapture={() => audio.unlock()} onKeyDownCapture={() => audio.unlock()}>
      <div className="lab__stage" data-bench-ready={benchReady || undefined}>
        <BenchBoundary fallback={<p className="lab__nobench notice notice--warn">{m.lab.noBench}</p>}>
          <Suspense fallback={<BenchSkeleton />}>
            <BenchView runtime={runtime} tray={kit.tray} quality={quality} onReady={() => setBenchReady(true)} />
            {!benchReady && <BenchSkeleton />}
          </Suspense>
        </BenchBoundary>
        <div className="lab__overlay" aria-live="polite">
          {ui.fried.map((c) => (
            <FriedNotice key={c.key} card={c} onReplace={() => runtime.replacePart(c)} onDismiss={() => runtime.dismissFried(c.key)} />
          ))}
          {ui.notice && (
            <p className="lab-notice" key={ui.notice.key}>
              <Icon name="alert" size={18} />
              <span>{ui.notice.message}</span>
            </p>
          )}
        </div>
      </div>

      <aside className="lab__panel" aria-label={m.bench.title}>
        <header className="lab__head">
          <div className="lab__titles">
            <h2 className="lab__title">{m.bench.title}</h2>
            <p className="lab__progress small">{m.bench.short}</p>
          </div>
          <div className="lab__tools" role="group" aria-label={m.lab.tools}>
            <button type="button" className="btn btn--small btn--tertiary lab__quality" onClick={toggleQuality} aria-label={`${m.lab.quality}: ${quality === "high" ? m.lab.qualityHigh : m.lab.qualityLow}`}>
              <Icon name="spark" size={16} />
              {quality === "high" ? m.lab.qualityHigh : m.lab.qualityLow}
            </button>
          </div>
        </header>
        <div className="lab__scroll">
          {kit.empty && (
            <MascotSay pose="thinking" size={48} className="lab__say">
              <strong>{m.bench.emptyTitle}.</strong> {m.bench.emptyBody}{" "}
              <a href={firstHref}>{m.bench.start}</a>
            </MascotSay>
          )}

          <section className="instrument sandbox__fresh">
            <header className="instrument__head">
              <h3 className="instrument__title">{m.bench.fresh}</h3>
            </header>
            <div className="sandbox__row">
              <Button size="small" icon="retry" onClick={() => start(!!bench.board)} data-clear>
                {m.bench.clear}
              </Button>
              {kit.board && (
                <Button size="small" variant="soft" icon="tools" onClick={() => start(!bench.board)}>
                  {bench.board ? m.bench.toDesk : m.bench.toBoard}
                </Button>
              )}
              {kit.meter && (
                <Button size="small" variant="soft" icon="target" onClick={toggleMeter} aria-pressed={!!bench.meter}>
                  {bench.meter ? m.bench.meterOff : m.bench.meterOn}
                </Button>
              )}
            </div>
          </section>

          <section className="instrument sandbox__saves">
            <header className="instrument__head">
              <h3 className="instrument__title">{m.bench.builds}</h3>
            </header>
            <form
              className="sandbox__row"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label htmlFor={nameId} className="sr-only">
                {m.bench.nameLabel}
              </label>
              <input id={nameId} className="input sandbox__name" value={name} placeholder={m.bench.namePlaceholder} onChange={(e) => setName(e.target.value)} maxLength={40} />
              <Button size="small" variant="primary" icon="download" type="submit" data-save>
                {m.bench.save}
              </Button>
            </form>
            {saved.length === 0 ? (
              <p className="small muted">{m.bench.buildsEmpty}</p>
            ) : (
              <ul className="sandbox__list">
                {saved.map(([id, b]) => (
                  <li key={id} className="sandbox__build">
                    <span className="sandbox__build-name">
                      {b.name}
                      <span className="small muted">{m.bench.savedAt(m.common.date(b.at))}</span>
                    </span>
                    <Button size="small" variant="soft" onClick={() => open(id)}>
                      {m.bench.open}
                    </Button>
                    <button type="button" className="icon-btn icon-btn--small" aria-label={m.bench.removeLabel(b.name)} title={m.bench.remove} onClick={() => useLearner.getState().deleteBench(id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {bench.meter && <Notebook runtime={runtime} />}
          <ConnectionsPanel runtime={runtime} />
        </div>
        {(bench.meter || scope) && (
          <div className="lab__dock">
            {bench.meter && <MeterPanel runtime={runtime} />}
            {scope && (
              <>
                <label className="sandbox__watch small">
                  <span>{m.bench.scopeWatch}</span>
                  <select className="select select--small" value={watched?.id ?? ""} onChange={(e) => setScopePart(e.target.value)}>
                    {scopeChoices.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id}
                      </option>
                    ))}
                  </select>
                </label>
                <ScopePanel runtime={runtime} config={scope} />
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
