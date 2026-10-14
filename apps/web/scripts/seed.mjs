// Shared by the screenshot scripts: browser flags and a learner record written straight into IndexedDB.

/** SwiftShader gives headless Chromium WebGL, so the 3D island draws in screenshots and tests. */
export const WEBGL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

/**
 * The module the seeded learners work through: Start here's Tool cases, which builds the Meter Tower. Its bench lessons
 * in order (version and lab tasks, as a finished record keeps them), and the step its last lesson's sign-off is at
 * (first-glow: five beats, the secret and one fix-it bench come first; a saved step is the moment's index plus 1).
 */
export const SEED_MODULE = {
  unit: "start-here",
  lessons: [
    { id: "meet-the-meter", version: 3, firstTry: 2, items: 3, tasks: ["plug-in", "set-dial", "read-battery", "swap-probes", "open-the-box", "fix-it"] },
    { id: "milli-and-kilo", version: 2, firstTry: 2, items: 2, tasks: ["tap-the-a", "tap-the-k", "wheel-one", "wheel-two", "wheel-three", "open-padlock", "fix-it"] },
    { id: "how-a-breadboard-works", version: 2, firstTry: 3, items: 4, tasks: ["xray-on", "fix-led", "rail-slide", "fix-it"] },
    { id: "parts-drawer", version: 1, firstTry: 2, items: 2, tasks: ["file-battery", "test-switch", "led-both-ways", "test-resistor", "file-all", "fix-it"] },
    { id: "first-glow", version: 3, firstTry: 2, items: 2, tasks: ["mend-blueprint", "build-loop", "move-it", "flip-led"] },
  ],
  endStep: 8,
};

/**
 * Writes a learner record for `origin` (visits it first, since IndexedDB is per origin).
 *   one     the module's first lesson done, the second (a bench lesson) in progress at its second beat, some
 *           achievements and fried parts
 *   module  the whole module done, so its landmark (the Meter Tower) is built too
 *   wrap    one lesson short of the module: its last lesson resumes at its sign-off, and finishing it builds the
 *           module's landmark
 */
export async function seedLearner(page, origin, kind = "one") {
  await page.goto(origin + "/404");
  await page.evaluate(
    async ({ kind, lessons: lessons_, endStep }) => {
      // a fixed clock, so the island (seeded by the first lesson's time) looks the same in every run
      const now = Date.parse("2026-10-10T09:30:00.000Z");
      const iso = (d) => new Date(now - d * 86400000).toISOString();
      const last = lessons_.length - 1;
      const done = kind === "one" ? lessons_.slice(0, 1) : kind === "wrap" ? lessons_.slice(0, last) : lessons_;
      const lessons = Object.fromEntries(done.map((l, i) => [l.id, { at: iso(done.length - i), version: l.version, firstTry: l.firstTry, items: l.items, tasks: l.tasks }]));
      const resume = (l, step) => ({ [l.id]: { step, answers: {}, at: iso(0), version: l.version } });
      const inProgress = kind === "one" ? resume(lessons_[1], 2) : kind === "wrap" ? resume(lessons_[last], endStep) : {};
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
    { kind, lessons: SEED_MODULE.lessons, endStep: SEED_MODULE.endStep },
  );
}
