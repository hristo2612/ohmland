/** Lab notebook entries: what the learner types, read in the entry's unit ("15 mA" in a mA box is 15). */
import { isParseError, parseQuantity, parseUnitSuffix, PREFIX_FACTOR } from "../quiz/si";

/** The typed value in the note's unit, or null when it is not a number. */
export function parseNote(input: string | number, unit?: string): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const q = parseQuantity(input);
  if (isParseError(q)) return null;
  if (!unit) return q.value;
  if (q.prefix === null && q.base === null) return q.number;
  const u = parseUnitSuffix(unit);
  const factor = u ? PREFIX_FACTOR[u.prefix] : 1;
  return Number((q.value / factor).toPrecision(12));
}
