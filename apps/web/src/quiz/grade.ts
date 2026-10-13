/**
 * Grading for every quiz item type, as pure functions over the item and the learner's answer. The numeric and
 * colour-code maths live in si.ts and colorCode.ts.
 */
import type { ChoiceItem, ColorCodeItem, HotspotItem, MatchItem, NumericItem, QuizItem } from "../content/schema";
import { ohmsForBands, sameOhms, type BandColor } from "./colorCode";
import { gradeNumeric, type NumericGrade } from "./si";

export type ChoiceGrade = { correct: boolean; wrongPicks: number[]; missed: number };

export function gradeChoice(item: Pick<ChoiceItem, "options">, picked: readonly number[]): ChoiceGrade {
  const set = new Set(picked);
  const wrongPicks = picked.filter((i) => !item.options[i]?.correct);
  const missed = item.options.filter((o, i) => o.correct && !set.has(i)).length;
  return { correct: wrongPicks.length === 0 && missed === 0 && picked.length > 0, wrongPicks, missed };
}

/** `order` lists the original indices in the order the learner placed them. */
export function gradeOrder(order: readonly number[]): { correct: boolean; inPlace: number } {
  const inPlace = order.filter((v, i) => v === i).length;
  return { correct: inPlace === order.length, inPlace };
}

/** `pairs` maps a left index to the right index chosen for it (both are indices into item.pairs). */
export function gradeMatch(item: Pick<MatchItem, "pairs">, pairs: Readonly<Record<number, number>>): { correct: boolean; right: number; complete: boolean } {
  const n = item.pairs.length;
  let right = 0;
  for (let i = 0; i < n; i++) if (pairs[i] === i) right++;
  const complete = Object.keys(pairs).length === n;
  return { correct: right === n, right, complete };
}

export function gradeColorRead(item: Pick<ColorCodeItem, "ohms">, input: string): NumericGrade {
  return gradeNumeric(input, { answer: item.ohms, unit: "Ω", tolerance: 0.5 });
}

export function gradeColorBuild(item: Pick<ColorCodeItem, "ohms" | "bands">, bands: readonly (BandColor | null)[]): { correct: boolean; value: number | null } {
  if (bands.some((b) => b === null)) return { correct: false, value: null };
  const value = ohmsForBands(bands as BandColor[], item.bands);
  return { correct: sameOhms(value, item.ohms), value };
}

export function gradeHotspot(item: Pick<HotspotItem, "answer">, region: string | null): boolean {
  if (!region) return false;
  return Array.isArray(item.answer) ? item.answer.includes(region) : item.answer === region;
}

export function gradeNumericItem(item: Pick<NumericItem, "answer" | "unit" | "tolerance">, input: string): NumericGrade {
  return gradeNumeric(input, item);
}

/** Whether an answer value is complete enough to check. */
export function canCheck(item: QuizItem, value: unknown): boolean {
  switch (item.type) {
    case "choice":
      return Array.isArray(value) && value.length > 0;
    case "numeric":
      return typeof value === "string" && value.trim() !== "";
    case "order":
      return Array.isArray(value);
    case "match":
      return typeof value === "object" && value !== null && Object.keys(value).length === item.pairs.length;
    case "color-code":
      return item.mode === "read" ? typeof value === "string" && value.trim() !== "" : Array.isArray(value) && value.every((b) => b !== null);
    case "hotspot":
      return typeof value === "string";
  }
}
