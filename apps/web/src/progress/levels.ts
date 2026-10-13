import { m } from "../i18n";

/** Total XP needed to reach level L: 0, 100, 300, 600, 1000 ... (docs/ARCHITECTURE.md). */
export const xpForLevel = (level: number): number => 50 * level * (level - 1);

/** The level a total XP puts you at (1 or more). */
export function levelForXp(xp: number): number {
  if (!(xp > 0)) return 1;
  // Solve 50 L (L - 1) <= xp for the largest whole L, then correct for float error.
  let level = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return Math.max(1, level);
}

/** The title for a level. Levels past the last title keep the last one. */
export function levelTitle(level: number): string {
  const titles = m.levels.titles;
  return titles[Math.min(Math.max(level, 1), titles.length) - 1] ?? titles[0] ?? "";
}

export type LevelProgress = {
  level: number;
  title: string;
  xp: number;
  /** XP at which this level started. */
  floor: number;
  /** XP needed for the next level. */
  next: number;
  /** XP earned inside this level. */
  into: number;
  /** XP this level spans. */
  span: number;
  /** 0..1 through the level. */
  ratio: number;
};

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - floor;
  const into = Math.max(0, xp - floor);
  return { level, title: levelTitle(level), xp, floor, next, into, span, ratio: span > 0 ? Math.min(1, into / span) : 0 };
}
