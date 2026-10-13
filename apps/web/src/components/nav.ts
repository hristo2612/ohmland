import { m } from "../i18n";
import type { IconName } from "./icons";

export type NavId = "learn" | "isle" | "bench" | "parts" | "achievements" | "account";

export const NAV: { id: NavId; href: string; icon: IconName; label: string; short: string }[] = [
  { id: "learn", href: "/learn", icon: "learn", label: m.nav.learn, short: m.nav.learn },
  { id: "isle", href: "/isle", icon: "isle", label: m.nav.isle, short: m.nav.isle },
  { id: "bench", href: "/bench", icon: "bench", label: m.nav.bench, short: m.nav.bench },
  { id: "parts", href: "/parts", icon: "parts", label: m.nav.parts, short: m.nav.parts },
  { id: "achievements", href: "/achievements", icon: "trophy", label: m.nav.achievements, short: m.nav.achievementsShort },
  { id: "account", href: "/account", icon: "user", label: m.nav.account, short: m.nav.account },
];
