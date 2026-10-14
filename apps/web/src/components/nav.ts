import { m } from "../i18n";
import type { IconName } from "./icons";

/** Every page that can be "the current page". Only Learn and Isle are in the main navigation; the rest live in the notebook menu. */
export type NavId = "learn" | "isle" | "bench" | "parts" | "achievements" | "account";

export const NAV: { id: NavId; href: string; icon: IconName; label: string }[] = [
  { id: "learn", href: "/learn", icon: "learn", label: m.nav.learn },
  { id: "isle", href: "/isle", icon: "isle", label: m.nav.isle },
];
