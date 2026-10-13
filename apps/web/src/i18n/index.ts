/**
 * The active message set. There is one language today; a translation adds a module shaped like en.ts and picks it
 * here (per build, or per page later).
 */
import { en, type Messages } from "./en";

export const m: Messages = en;
export const lang = "en";
export type { Messages };
