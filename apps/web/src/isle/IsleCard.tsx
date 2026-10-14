/**
 * The course map's island: the learner's own island, live, standing on the page's own grid paper (`paper: "clear"`).
 * It loads when it comes into view; until then the paper is simply empty, and where 3D is unavailable the ink sketch
 * (IsleArt) stands in, its landmarks drawn as they are built.
 */
import { useEffect, useRef, useState } from "react";
import type { IsleView } from "@ohmland/isle";
import { IsleArt, type IsleArtLandmark } from "../components/IsleArt";
import type { CourseOutline } from "../content/outline";
import { prefersReducedMotion } from "../progress/prefs";
import { useLearner, useLearnerReady } from "../progress/useLearner";
import { onThemeChange, pageTime, whenVisible } from "./env";
import { loadIsle } from "./load";

type Runtime = Awaited<ReturnType<typeof loadIsle>>;

export default function IsleCard({ outline, label, landmarks }: { outline: CourseOutline; label: string; landmarks: IsleArtLandmark[] }) {
  const ready = useLearnerReady(outline);
  const learner = useLearner((s) => s.learner);
  const live = useRef<HTMLDivElement>(null);
  const view = useRef<IsleView | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const shownKey = useRef("");
  const [status, setStatus] = useState<"waiting" | "shown" | "failed">("waiting");

  useEffect(() => {
    const host = live.current;
    if (!ready || !host) return;
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
          paper: "clear",
          reducedMotion: prefersReducedMotion(),
          messages: rt.isleMessages(outline),
          time: pageTime(),
        });
        if (cancelled) {
          v.dispose();
          return;
        }
        view.current = v;
        shownKey.current = `${seed}:${events.length}`;
        cleanups.push(rt.pauseWhenHidden(v), onThemeChange(() => v.setTime(pageTime())), () => v.dispose());
        requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && setStatus("shown")));
      } catch {
        if (!cancelled) setStatus("failed");
      }
    };
    cleanups.push(whenVisible(host, () => void start()));
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
    <a className="isle-card" href="/isle" aria-label={label} data-status={status}>
      {status === "failed" ? <IsleArt landmarks={landmarks} /> : <div className="isle-card__live" ref={live} aria-hidden="true" />}
    </a>
  );
}
