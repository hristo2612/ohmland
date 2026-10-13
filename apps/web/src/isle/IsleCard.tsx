/**
 * The course map's island card: the learner's own island, small and live, linking to /isle. It loads when the card
 * comes into view; until then (and if 3D is unavailable) the sky holds its place.
 */
import { useEffect, useRef, useState } from "react";
import type { IsleView } from "@ohmland/isle";
import { Icon } from "../components/Icon";
import { Skeleton } from "../components/Skeleton";
import type { CourseOutline } from "../content/outline";
import { m } from "../i18n";
import { prefersReducedMotion } from "../progress/prefs";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { completedModules } from "../progress/xp";
import { timeOption, whenVisible } from "./env";
import { loadIsle } from "./load";
import "./isle-frames.css";

type Runtime = Awaited<ReturnType<typeof loadIsle>>;

export default function IsleCard({ outline }: { outline: CourseOutline }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const frame = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const view = useRef<IsleView | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const shownKey = useRef("");
  const [shown, setShown] = useState(false);

  const lessons = outline.order.filter((id) => learner.lessons[id]).length;
  const modules = completedModules(learner, outline).length;

  useEffect(() => {
    const el = frame.current;
    const host = live.current;
    if (!ready || !el || !host) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    const start = async () => {
      try {
        const rt = await loadIsle();
        if (cancelled) return;
        runtime.current = rt;
        const { seed, events } = rt.isleEvents(useLearner.getState().learner, outline);
        const v = await rt.mountIsle(host, rt.makeIsle(seed, events), {
          interactive: false,
          quality: "low",
          muted: true,
          reducedMotion: prefersReducedMotion(),
          messages: rt.isleMessages(outline),
          ...timeOption(),
        });
        if (cancelled) {
          v.dispose();
          return;
        }
        view.current = v;
        shownKey.current = `${seed}:${events.length}`;
        cleanups.push(rt.pauseWhenHidden(v), () => v.dispose());
        requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && setShown(true)));
      } catch {
        // the sky stays; the card still links to the island
      }
    };
    cleanups.push(whenVisible(el, () => void start()));
    return () => {
      cancelled = true;
      for (const c of cleanups) c();
      view.current = null;
    };
  }, [ready, outline]);

  // Progress from another tab redraws the island.
  useEffect(() => {
    const v = view.current;
    const rt = runtime.current;
    if (!v || !rt) return;
    const { seed, events } = rt.isleEvents(learner, outline);
    const key = `${seed}:${events.length}`;
    if (key === shownKey.current) return;
    shownKey.current = key;
    v.update(rt.makeIsle(seed, events));
  }, [learner, outline]);

  return (
    <a className="isle-card card card--raised card--interactive" href="/isle">
      <div className="isle-frame isle-card__frame" ref={frame} data-live={shown || undefined}>
        <div className="isle-frame__live" ref={live} aria-hidden="true" />
      </div>
      <span className="isle-card__text">
        <span className="eyebrow">{m.map.isleTitle}</span>
        {ready ? <span className="small muted">{m.isle.cardCounts(lessons, modules)}</span> : <Skeleton shape="text" width="80%" />}
        <span className="isle-card__link">
          {m.map.isleLink}
          <Icon name="arrow-right" size={16} />
        </span>
      </span>
    </a>
  );
}
