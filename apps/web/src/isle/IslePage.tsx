/**
 * The /isle page: the learner's island, full screen on the notebook's own paper. The page shows at once with a loading line; the island
 * code (and three.js) loads after hydration. Drag to turn, pinch or scroll to zoom, tap a piece for its label (the hint
 * names only the first and last; pinching is found by hand). A new learner sees the bare starting plot and the way to
 * their first lesson.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { IsleLabel, IsleView } from "@ohmland/isle";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { IsleArt } from "../components/IsleArt";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { resumeTarget } from "../progress/derive";
import { prefersReducedMotion } from "../progress/prefs";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { completedModules } from "../progress/xp";
import { onThemeChange, pageTime } from "./env";
import { loadIsle } from "./load";
import type { IsleEntry } from "./runtime";
import "./isle-page.css";

type Status = "loading" | "ready" | "failed";
type Runtime = Awaited<ReturnType<typeof loadIsle>>;

/** Zoom steps for the buttons; 1 frames the whole isle. */
const ZOOMS = [0.6, 0.8, 1, 1.4, 2, 2.8, 4];
const ONE = ZOOMS.indexOf(1);
/** Half the label bubble's widest size plus a margin, to keep it on screen. */
const BUBBLE_HALF = 150;
/** Open paper kept between the island and the new learner's line under it, in CSS pixels. */
const START_GAP = 16;

export default function IslePage({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const muted = learner.settings.muted;
  const stage = useRef<HTMLDivElement>(null);
  const startLine = useRef<HTMLDivElement>(null);
  const view = useRef<IsleView | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const shownKey = useRef("");
  const [status, setStatus] = useState<Status>("loading");
  const [label, setLabel] = useState<IsleLabel | null>(null);
  const [zoom, setZoom] = useState(ONE);
  const [entries, setEntries] = useState<IsleEntry[]>([]);
  const [touched, setTouched] = useState(false);

  const lessons = outline.order.filter((id) => learner.lessons[id]).length;
  const modules = completedModules(learner, outline).length;
  const empty = ready && lessons === 0;

  // A new learner's line sits under the island: the island frames itself in the paper above it.
  const insetNow = () => {
    const el = stage.current;
    const line = startLine.current;
    if (!el || !line) return { bottom: 0 };
    return { bottom: Math.max(0, el.getBoundingClientRect().bottom - line.getBoundingClientRect().top + START_GAP) };
  };

  // Mount once the learner record is in.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      try {
        const rt = await loadIsle();
        const el = stage.current;
        if (cancelled || !el) return;
        runtime.current = rt;
        const { seed, events } = rt.isleEvents(useLearner.getState().learner, outline);
        const plan = rt.makeIsle(seed, events);
        const messages = rt.isleMessages(outline);
        setEntries(rt.describeIsle(plan, messages));
        const v = await rt.mountIsle(el, plan, {
          interactive: true,
          quality: "high",
          muted: useLearner.getState().learner.settings.muted,
          reducedMotion: prefersReducedMotion(),
          messages,
          onPick: setLabel,
          inset: insetNow(),
          // the page's own grid paper shows through, and night follows the page's theme
          paper: "clear",
          time: pageTime(),
        });
        if (cancelled) {
          v.dispose();
          return;
        }
        view.current = v;
        shownKey.current = `${seed}:${events.length}`;
        const stopPausing = rt.pauseWhenHidden(v);
        const stopTheme = onThemeChange(() => v.setTime(pageTime()));
        cleanup = () => {
          stopPausing();
          stopTheme();
          v.dispose();
          view.current = null;
        };
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [ready, outline]);

  // Progress made in another tab shows up here too.
  useEffect(() => {
    const v = view.current;
    const rt = runtime.current;
    if (!v || !rt) return;
    const { seed, events } = rt.isleEvents(learner, outline);
    const key = `${seed}:${events.length}`;
    if (key === shownKey.current) return;
    shownKey.current = key;
    const plan = rt.makeIsle(seed, events);
    v.update(plan);
    setEntries(rt.describeIsle(plan, rt.isleMessages(outline)));
  }, [learner, outline]);

  useEffect(() => view.current?.setMuted(muted), [muted]);

  useEffect(() => {
    if (status !== "ready") return;
    view.current?.setInset(insetNow());
    const line = startLine.current;
    if (!line) return;
    const ro = new ResizeObserver(() => view.current?.setInset(insetNow()));
    ro.observe(line);
    return () => ro.disconnect();
  }, [empty, status]);

  // A closed label stays closed while the camera moves; only a new tap opens one again.
  const closeLabel = () => {
    view.current?.clearPick();
    setLabel(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && label) closeLabel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [label]);

  const zoomTo = (i: number) => {
    const k = Math.max(0, Math.min(ZOOMS.length - 1, i));
    setZoom(k);
    view.current?.setZoom(ZOOMS[k]!);
  };

  const target = resumeTarget(learner, outline) ?? outline.order[0];
  const targetHref = (target && outline.lessons[target]?.href) || "/learn";
  const started = Object.keys(learner.inProgress).some((id) => outline.lessons[id]);
  // The bubble stays on screen; its arrow still points at what was tapped.
  const width = stage.current?.clientWidth ?? 0;
  const left = label ? Math.max(BUBBLE_HALF, Math.min(label.x, width - BUBBLE_HALF)) : 0;
  const arrow = label ? Math.max(-BUBBLE_HALF + 30, Math.min(BUBBLE_HALF - 30, label.x - left)) : 0;
  const below = !!label && label.y < 170;

  return (
    <div className="isle-screen" data-status={status}>
      <header className="isle-bar">
        <div className="isle-bar__group isle-bar__group--title">
          <IconButton label={m.isle.close} icon="arrow-left" href="/learn" />
          <div className="isle-bar__title">
            <h1>{m.isle.title}</h1>
            {ready && !empty && <p className="isle-bar__counts">{m.isle.counts(lessons, modules)}</p>}
          </div>
        </div>
        <div className="isle-bar__group isle-bar__tools">
          <IconButton label={m.isle.zoomOut} icon="minus" onClick={() => zoomTo(zoom - 1)} disabled={status !== "ready" || zoom === 0} />
          <IconButton label={m.isle.zoomIn} icon="plus" onClick={() => zoomTo(zoom + 1)} disabled={status !== "ready" || zoom === ZOOMS.length - 1} />
          <span className="isle-bar__sep" aria-hidden="true" />
          <IconButton
            label={m.isle.sound}
            icon={muted ? "sound-off" : "sound-on"}
            pressed={!muted}
            onClick={() => useLearner.getState().setSettings({ muted: !muted })}
            disabled={!ready}
          />
        </div>
      </header>

      <main id="main" className="isle-stage" tabIndex={-1}>
        <div className="isle-stage__canvas" ref={stage} onPointerDown={() => setTouched(true)} />

        {status === "loading" && (
          <p className="isle-stage__loading" role="status">
            {m.isle.loading}
          </p>
        )}

        {status === "failed" && (
          <div className="isle-card-float isle-card-float--center card card--raised">
            <IsleArt className="isle-card-float__art" />
            <h2 className="isle-card-float__title">{m.isle.failedTitle}</h2>
            <p className="muted">{m.isle.failedBody}</p>
            {entries.length > 0 && (
              <ul className="isle-card-float__list" aria-label={m.isle.listTitle}>
                {entries.map((e) => (
                  <li key={e.key}>
                    <strong>{e.name}</strong>
                    {e.detail && <span className="small muted">{e.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {label && status === "ready" && (
          <div className="isle-bubble" data-below={below || undefined} style={{ "--x": `${left}px`, "--y": `${label.y}px`, "--arrow": `${arrow}px` } as CSSProperties}>
            <div className="isle-bubble__text">
              <strong className="isle-bubble__title">{label.title}</strong>
              {label.detail && <span className="isle-bubble__detail">{label.detail}</span>}
            </div>
            <IconButton label={m.isle.bubbleClose} icon="close" size="small" onClick={closeLabel} />
          </div>
        )}

        {empty && status !== "failed" && (
          <div className="isle-start" ref={startLine} data-isle-empty>
            <p>{m.isle.emptyBody}</p>
            <Button variant="primary" href={targetHref} iconEnd="arrow-right">
              {started ? m.isle.emptyContinue : m.isle.emptyStart}
            </Button>
          </div>
        )}

        {!empty && status === "ready" && !touched && <p className="isle-hint">{m.isle.hint}</p>}
      </main>

      <div className="sr-only" role="status" aria-live="polite">
        {label ? [label.title, label.detail].filter(Boolean).join(". ") : ""}
      </div>
      {entries.length > 0 && status !== "failed" && (
        <section className="sr-only" aria-labelledby="isle-list-title">
          <h2 id="isle-list-title">{m.isle.listTitle}</h2>
          <ul>
            {entries.map((e) => (
              <li key={e.key}>
                {e.name}
                {e.detail ? `. ${e.detail}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
