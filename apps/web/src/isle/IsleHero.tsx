/**
 * The landing page's island: a still poster first (rendered from this very island, day or night by theme), then,
 * once the frame is on screen and the browser is idle, the live 3D island fades in over it and sways gently. No
 * controls, no sound. Under reduced motion or data saving the poster is the whole show, since a still isle needs no
 * three.js. The island is made up (madeUp), the same for everyone.
 */
import { useEffect, useRef, useState } from "react";
import type { IsleView } from "@ohmland/isle";
import { prefersReducedMotion } from "../progress/prefs";
import { isDarkTheme, onThemeChange, savesData, themeTime, whenIdle, whenVisible } from "./env";
import { loadIsle } from "./load";
import "./isle-frames.css";

/** The demo island: its seed and how much of a course it shows. scripts/isle-poster.mjs renders the posters from it. */
export const HERO = { seed: 20261013, lessons: 13, modules: 4 } as const;

export default function IsleHero({ label }: { label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = frame.current;
    const host = live.current;
    if (!el || !host) return;
    // `?isle-still` draws the live island without motion: that is how the posters are made
    const still = new URLSearchParams(location.search).has("isle-still");
    if (!still && (prefersReducedMotion() || savesData())) return;
    let cancelled = false;
    let view: IsleView | null = null;
    const cleanups: (() => void)[] = [];
    const start = async () => {
      try {
        const rt = await loadIsle();
        if (cancelled) return;
        const plan = rt.makeIsle(HERO.seed, rt.madeUp(HERO.lessons, HERO.modules, 1));
        const v = await rt.mountIsle(host, plan, {
          interactive: false,
          quality: "low",
          muted: true,
          reducedMotion: still,
          time: themeTime(isDarkTheme()),
          messages: rt.isleMessages(),
        });
        if (cancelled) {
          v.dispose();
          return;
        }
        view = v;
        cleanups.push(rt.pauseWhenHidden(v), onThemeChange(() => v.setTime(themeTime(isDarkTheme()))));
        // fade in once the first frame is on the canvas
        requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && setShown(true)));
      } catch {
        // the poster stays
      }
    };
    cleanups.push(whenVisible(el, () => cleanups.push(whenIdle(() => void start()))));
    return () => {
      cancelled = true;
      for (const c of cleanups) c();
      view?.dispose();
    };
  }, []);

  return (
    <div className="isle-frame isle-frame--hero" ref={frame} role="img" aria-label={label} data-live={shown || undefined}>
      <div className="isle-frame__live" ref={live} aria-hidden="true" />
    </div>
  );
}
