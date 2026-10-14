/**
 * The isle's input: completion events in the order they happened, and a seed. The app derives both from the progress
 * record (lessons ordered by their first completion `at`, a module right after its last lesson), so nothing new is
 * stored. Pure, no three.js.
 */
import { LANDMARKS_BY_UNIT } from "./catalog";
import { fnv1a } from "./math";
import { EN } from "./messages";

export type IsleEvent =
  | { type: "lesson"; unit: string; piece: string; title: string; id: string }
  | { type: "module"; unit: string; landmark: string; title: string; id: string };

/** The isle's seed: a 32-bit FNV-1a hash of the learner's first finished lesson and when it was finished. */
export function seedFrom(firstLessonId: string, firstAtIso: string): number {
  return fnv1a(`${firstAtIso}|${firstLessonId}`) || 1;
}

/**
 * What a made-up history visits, unit by unit: the pieces each cycles through and the landmarks its modules build,
 * close to what its lessons really place. Frozen on purpose: the landing hero's posters and the plan's golden
 * fingerprint are made-up isles, so a new unit is appended here (never inserted) and a landmark that later moves to
 * another unit in the catalog (meter-tower, now in Start here) keeps its made-up place.
 */
const MADE_UP: { unit: string; pieces: string[]; landmarks: string[] }[] = [
  {
    unit: "basics",
    pieces: ["meter-kiosk", "test-lead-arch", "resistor", "led-lamp", "battery", "fuse", "pot", "cell-jar", "resistor", "led-lamp", "lemon-tree", "tuft", "header-fence", "moss"],
    landmarks: ["meter-tower", "resistor-hall", "lighthouse", "observatory", "power-station", "lemon-grove"],
  },
  {
    unit: "switching",
    pieces: ["switch", "pushbutton", "relay", "breadboard-patch", "jumper-arch", "capacitor", "ceramic-cap", "transistor", "phototransistor", "speaker", "diode", "led-lamp", "resistor", "tuft"],
    landmarks: [...LANDMARKS_BY_UNIT.switching],
  },
  { unit: "permanent", pieces: ["wire-spool", "header-fence", "heatsink", "resistor", "led-lamp", "diode", "capacitor", "moss", "jumper-arch"], landmarks: [...LANDMARKS_BY_UNIT.permanent] },
  { unit: "chips", pieces: ["header-fence", "capacitor", "ceramic-cap", "led-lamp", "resistor", "pushbutton", "transistor", "heatsink", "tuft"], landmarks: [...LANDMARKS_BY_UNIT.chips] },
  { unit: "beyond", pieces: ["wire-spool", "speaker", "capacitor", "transistor", "led-lamp", "heatsink", "phototransistor", "header-fence", "lemon-tree"], landmarks: [...LANDMARKS_BY_UNIT.beyond] },
  {
    unit: "start-here",
    pieces: ["led-lamp", "test-lead-arch", "capacitor", "wire-spool", "battery", "pot", "cell-jar", "meter-kiosk", "header-fence", "breadboard-patch", "resistor", "jumper-arch"],
    landmarks: [...LANDMARKS_BY_UNIT["start-here"]],
  },
];

/**
 * A made-up history of `lessons` lessons and `modules` modules spread over `units` units, for previews and the
 * playground: each unit its own run of lessons, a module after every few. Every seventh lesson names no piece, so the
 * fallback deck is exercised too.
 */
export function madeUp(lessons: number, modules: number, units: number): IsleEvent[] {
  const L = Math.max(0, Math.floor(lessons));
  const M = Math.max(0, Math.floor(modules));
  const C = Math.max(1, Math.floor(units));
  const out: IsleEvent[] = [];
  let lessonNo = 0;
  let moduleNo = 0;
  for (let c = 0; c < C; c++) {
    const plan = MADE_UP[c];
    const unit = plan?.unit ?? `unit-${c + 1}`;
    const l = Math.floor(L / C) + (c === 0 ? L % C : 0);
    const m = Math.floor(M / C) + (c === 0 ? M % C : 0);
    const every = m ? Math.max(1, Math.floor(l / m)) : Infinity;
    const pieces = (plan ?? MADE_UP[0]!).pieces;
    const marks = (plan ?? MADE_UP[0]!).landmarks;
    let mods = 0;
    const addModule = () => {
      const landmark = marks[mods % marks.length]!;
      mods++;
      moduleNo++;
      out.push({ type: "module", unit, landmark, title: EN.madeUpModule(moduleNo), id: `${unit}-m${mods}` });
    };
    for (let i = 1; i <= l; i++) {
      lessonNo++;
      const piece = lessonNo % 7 === 0 ? "" : pieces[(i - 1) % pieces.length]!;
      out.push({ type: "lesson", unit, piece, title: EN.madeUpLesson(lessonNo), id: `${unit}-l${i}` });
      if (i % every === 0 && mods < m) addModule();
    }
    while (mods < m) addModule();
  }
  return out;
}
