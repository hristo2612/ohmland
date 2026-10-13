// Shared by the screenshot scripts: browser flags and a learner record written straight into IndexedDB.

/** SwiftShader gives headless Chromium WebGL, so the 3D island draws in screenshots and tests. */
export const WEBGL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

/**
 * Writes a learner record for `origin` (visits it first, since IndexedDB is per origin).
 *   one     the first sample lesson done, the second in progress, some achievements and fried parts
 *   module  both sample lessons done, so the sample module and its landmark are built too
 *   wrap2   the first sample lesson done, the second resumed at its wrap step (finishing it finishes the module)
 */
export async function seedLearner(page, origin, kind = "one") {
  await page.goto(origin + "/404");
  await page.evaluate(async (kind) => {
    // a fixed clock, so the island (seeded by the first lesson's time) looks the same in every run
    const now = Date.parse("2026-10-10T09:30:00.000Z");
    const iso = (d) => new Date(now - d * 86400000).toISOString();
    const lessons = { "sample-first-glow": { at: iso(2), version: 1, firstTry: 3, items: 4, tasks: ["light-it", "measure-resistor"] } };
    if (kind === "module") lessons["sample-read-a-resistor"] = { at: iso(1), version: 1, firstTry: 4, items: 5, tasks: [] };
    const state = {
      v: 1,
      lessons,
      inProgress: kind === "module" ? {} : { "sample-read-a-resistor": { step: kind === "wrap2" ? 3 : 2, answers: {}, at: iso(0), version: 1 } },
      achievements: { "first-spark": { at: iso(2) }, "magic-smoke": { at: iso(1) } },
      fried: [
        { kind: "led", label: "Red LED", lessonId: "sample-first-glow", at: iso(2) },
        { kind: "resistor", label: "470 Ω resistor", lessonId: "sample-first-glow", at: iso(1) },
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
  }, kind);
}
