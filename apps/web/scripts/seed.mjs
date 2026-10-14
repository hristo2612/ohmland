// Shared by the screenshot scripts: browser flags and a learner record written straight into IndexedDB.

/** SwiftShader gives headless Chromium WebGL, so the 3D island draws in screenshots and tests. */
export const WEBGL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

/** The first module of the course (Your meter): its lessons in order, and the step index of the last one's wrap. */
export const MODULE_ONE = ["how-a-breadboard-works", "welcome-to-the-bench", "meet-the-meter", "tiny-and-huge-numbers"];
export const MODULE_ONE_WRAP = 4;

/**
 * Writes a learner record for `origin` (visits it first, since IndexedDB is per origin).
 *   one     the first lesson done, the second (a bench lesson) in progress at its second beat, some achievements
 *           and fried parts
 *   module  the whole first module done, so its landmark (the Meter Tower) is built too
 *   wrap    one lesson short of the first module: its last lesson resumes at the wrap step, and finishing it builds
 *           the module's landmark
 */
export async function seedLearner(page, origin, kind = "one") {
  await page.goto(origin + "/404");
  await page.evaluate(
    async ({ kind, lessonIds, wrapStep }) => {
      // a fixed clock, so the island (seeded by the first lesson's time) looks the same in every run
      const now = Date.parse("2026-10-10T09:30:00.000Z");
      const iso = (d) => new Date(now - d * 86400000).toISOString();
      const [zero, first, second, third] = lessonIds;
      const lessons = { [zero]: { at: iso(4), version: 1, firstTry: 3, items: 3, tasks: ["fix-led", "rail-slide"] } };
      if (kind !== "one") lessons[first] = { at: iso(3), version: 2, firstTry: 1, items: 1, tasks: ["close-the-switch", "break-the-loop", "mend-the-loop", "fix-switch"] };
      if (kind !== "one") lessons[second] = { at: iso(2), version: 1, firstTry: 4, items: 6, tasks: ["plug-in", "set-dial", "read-battery", "swap-probes"] };
      if (kind === "module") lessons[third] = { at: iso(1), version: 1, firstTry: 5, items: 6, tasks: ["over-the-limit", "climb-a-range", "aa-cell", "kilo-ohms"] };
      const inProgress =
        kind === "one" ? { [first]: { step: 2, answers: {}, at: iso(0), version: 2 } } : kind === "wrap" ? { [third]: { step: wrapStep, answers: {}, at: iso(0), version: 1 } } : {};
      const state = {
        v: 1,
        lessons,
        inProgress,
        achievements: { "first-spark": { at: iso(3) }, "clean-sweep": { at: iso(3) }, "magic-smoke": { at: iso(1) } },
        fried: [
          { kind: "led", label: "Red LED, no resistor on 9 V", lessonId: null, at: iso(2) },
          { kind: "resistor", label: "15 Ω, 1/4 W resistor across 9 V", lessonId: null, at: iso(1) },
          { kind: "led", label: "Red LED", lessonId: null, at: iso(0) },
        ],
        sandbox: { saved: {} },
        settings: { muted: false, reducedMotion: "system", theme: "system" },
        updatedAt: iso(0),
      };
      await new Promise((resolve, reject) => {
        const req = indexedDB.open("ohmland");
        req.onupgradeneeded = () => req.result.createObjectStore("learner");
        req.onsuccess = () => {
          const tx = req.result.transaction("learner", "readwrite");
          tx.objectStore("learner").put(state, "profile:default");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { kind, lessonIds: MODULE_ONE, wrapStep: MODULE_ONE_WRAP },
  );
}
