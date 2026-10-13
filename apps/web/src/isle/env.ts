/** Small browser checks the island views share. Tiny on purpose: these load with the page, the island does not. */

/** Whether the page shows the dark theme (the learner's choice, else the system's). */
export function isDarkTheme(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t === "dark";
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Calls back when the theme changes (a choice in the theme menu or a system switch). Returns the cleanup. */
export function onThemeChange(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  mq?.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq?.removeEventListener("change", cb);
  };
}

/** The learner asked the browser to save data: keep stills instead of loading the 3D island for decoration. */
export function savesData(): boolean {
  return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
}

/** Runs `fn` when the browser is idle (or soon, where idle callbacks are missing). Returns the cancel. */
export function whenIdle(fn: () => void, timeout = 1500): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}

/** Calls back once `el` comes near the viewport. Returns the cleanup. */
export function whenVisible(el: Element, fn: () => void, margin = "200px"): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fn();
    },
    { rootMargin: margin },
  );
  io.observe(el);
  return () => io.disconnect();
}

/** A clock override from `?time=HH:MM`, for previews and screenshots of day and night. */
export function timeFromQuery(): Date | undefined {
  const raw = new URLSearchParams(location.search).get("time");
  const hit = raw && /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!hit) return undefined;
  const d = new Date();
  d.setHours(Number(hit[1]), Number(hit[2]), 0, 0);
  return d;
}

/** The `time` mount option when the page has a `?time=` override, else nothing (the isle follows the clock). */
export function timeOption(): { time: Date } | Record<string, never> {
  const time = timeFromQuery();
  return time ? { time } : {};
}

/** Noon or midnight today, for islands that follow the theme rather than the clock. */
export function themeTime(dark: boolean): Date {
  const d = new Date();
  d.setHours(dark ? 23 : 12, 0, 0, 0);
  return d;
}
