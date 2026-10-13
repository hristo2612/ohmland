/**
 * The isle's input: completion events in the order they happened, and a seed. The app derives both from the progress
 * record (lessons ordered by their first completion `at`, a module right after its last lesson), so nothing new is
 * stored. Pure, no three.js.
 */
import { LANDMARKS_BY_UNIT, UNITS, isUnit } from "./catalog";
import { fnv1a } from "./math";
import { EN } from "./messages";

export type IsleEvent =
  | { type: "lesson"; unit: string; piece: string; title: string; id: string }
  | { type: "module"; unit: string; landmark: string; title: string; id: string };

/** The isle's seed: a 32-bit FNV-1a hash of the learner's first finished lesson and when it was finished. */
export function seedFrom(firstLessonId: string, firstAtIso: string): number {
  return fnv1a(`${firstAtIso}|${firstLessonId}`) || 1;
}

/** Pieces a made-up unit cycles through, close to what its lessons will really place. */
const MADE_UP_PIECES: Record<string, string[]> = {
  basics: ["meter-kiosk", "test-lead-arch", "resistor", "led-lamp", "battery", "fuse", "pot", "cell-jar", "resistor", "led-lamp", "lemon-tree", "tuft", "header-fence", "moss"],
  switching: ["switch", "pushbutton", "relay", "breadboard-patch", "jumper-arch", "capacitor", "ceramic-cap", "transistor", "phototransistor", "speaker", "diode", "led-lamp", "resistor", "tuft"],
  permanent: ["wire-spool", "header-fence", "heatsink", "resistor", "led-lamp", "diode", "capacitor", "moss", "jumper-arch"],
  chips: ["header-fence", "capacitor", "ceramic-cap", "led-lamp", "resistor", "pushbutton", "transistor", "heatsink", "tuft"],
  beyond: ["wire-spool", "speaker", "capacitor", "transistor", "led-lamp", "heatsink", "phototransistor", "header-fence", "lemon-tree"],
};

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
    const unit = UNITS[c] ?? `unit-${c + 1}`;
    const l = Math.floor(L / C) + (c === 0 ? L % C : 0);
    const m = Math.floor(M / C) + (c === 0 ? M % C : 0);
    const every = m ? Math.max(1, Math.floor(l / m)) : Infinity;
    const pieces = MADE_UP_PIECES[unit] ?? MADE_UP_PIECES.basics!;
    const marks = isUnit(unit) ? LANDMARKS_BY_UNIT[unit] : LANDMARKS_BY_UNIT.basics;
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
