/**
 * Theme and motion preferences on the <html> element. The learner record is the source of truth; a tiny mirror in
 * localStorage lets the inline head script (HEAD_SCRIPT) apply them before the first paint, so nothing flashes.
 */
import type { Settings } from "./types";

export const THEME_KEY = "ohmland:theme";
export const MOTION_KEY = "ohmland:motion";

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Applies theme and motion to the document and mirrors them for the next page load. */
export function applyPrefs(s: Pick<Settings, "theme" | "reducedMotion">, root: HTMLElement = document.documentElement): void {
  if (s.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  const reduce = s.reducedMotion === "on" || (s.reducedMotion === "system" && systemReducedMotion());
  root.dataset.motion = reduce ? "reduce" : "full";
  const st = storage();
  try {
    if (s.theme === "system") st?.removeItem(THEME_KEY);
    else st?.setItem(THEME_KEY, s.theme);
    if (s.reducedMotion === "system") st?.removeItem(MOTION_KEY);
    else st?.setItem(MOTION_KEY, s.reducedMotion);
  } catch {
    // The page already shows the choice; it just will not survive a reload.
  }
}

export function systemReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Whether motion should be reduced right now (reads the attribute the head script and applyPrefs keep current). */
export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.motion === "reduce";
}

/**
 * Runs inline in <head> before anything paints. Tiny and ES5 on purpose. It also keeps data-motion in step with the
 * system setting while the learner has not chosen one.
 */
export const HEAD_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var m=localStorage.getItem("${MOTION_KEY}")}catch(e){}var q=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)");function s(){d.setAttribute("data-motion",m==="on"||(m!=="off"&&q&&q.matches)?"reduce":"full")}s();if(q&&q.addEventListener)q.addEventListener("change",function(){try{m=localStorage.getItem("${MOTION_KEY}")}catch(e){}s()})})();`;
