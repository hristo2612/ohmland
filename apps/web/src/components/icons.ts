/**
 * Ohmland's icon set: stroke icons on a 24 px grid, drawn with currentColor at a 1.75 stroke with round caps and joins.
 * Each entry is the inner markup of the <svg>. Add new icons on the same grid and stroke so the set stays consistent.
 */
const c = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const p = (d: string) => `<path d="${d}"/>`;
const r = (x: number, y: number, w: number, h: number, rx: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

export const ICONS = {
  // Navigation
  learn: p("M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5l-6-2z") + p("M9 4.5v13M15 6.5v13"),
  isle: p("M3 10.5h18l-3 4.5H6l-3-4.5z") + p("M9 15l1.2 4M12 15v5.5M15 15l-1 3") + p("M7.5 10.5V7h4v3.5") + p("M16 10.5V5M14.5 5h3"),
  bench: r(3, 5, 18, 14, 2.5) + p("M3 12h18") + p("M7 8.5h.01M10.3 8.5h.01M13.7 8.5h.01M17 8.5h.01M7 15.5h.01M10.3 15.5h.01M13.7 15.5h.01M17 15.5h.01"),
  parts: r(6.5, 6.5, 11, 11, 1.5) + p("M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"),
  trophy:
    p("M8 4h8v5.5a4 4 0 0 1-8 0V4z") +
    p("M8 6H5.5a2.5 2.5 0 0 0 2.9 3.9M16 6h2.5a2.5 2.5 0 0 1-2.9 3.9") +
    p("M12 13.5V17M8.5 20.5h7M9.5 17h5l.5 3.5h-6l.5-3.5z"),
  user: c(12, 8.5, 4) + p("M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"),
  home: p("M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5z"),

  // Actions and arrows
  close: p("M6 6l12 12M18 6 6 18"),
  check: p("M5 12.5l4.5 4.5L19 7.5"),
  plus: p("M12 5v14M5 12h14"),
  minus: p("M5 12h14"),
  "arrow-right": p("M5 12h14M13 6l6 6-6 6"),
  "arrow-left": p("M19 12H5M11 6l-6 6 6 6"),
  "chevron-right": p("M9 6l6 6-6 6"),
  "chevron-left": p("M15 6l-6 6 6 6"),
  "chevron-down": p("M6 9l6 6 6-6"),
  "chevron-up": p("M6 15l6-6 6 6"),
  play: p("M8 5.5v13l10.5-6.5L8 5.5z"),
  retry: p("M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5") + p("M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"),
  download: p("M12 4v11M7 10l5 5 5-5M5 20h14"),
  upload: p("M12 15V4M7 9l5-5 5 5M5 20h14"),
  trash: p("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"),
  external: p("M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"),
  grip: p("M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"),
  lock: r(5, 11, 14, 10, 2) + p("M8 11V8a4 4 0 0 1 8 0v3"),

  // Status
  info: c(12, 12, 9) + p("M12 11v5.5M12 7.8h.01"),
  alert: p("M12 3.5 2.5 20h19L12 3.5z") + p("M12 10v4.5M12 17.4h.01"),
  "check-circle": c(12, 12, 9) + p("M8 12.5l2.8 2.8L16.5 9.5"),
  "x-circle": c(12, 12, 9) + p("M9 9l6 6M15 9l-6 6"),
  hint: p("M9 18h6M10 21h4") + p("M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"),
  clock: c(12, 12, 9) + p("M12 7v5l3 2"),
  star: p("M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z"),
  flag: p("M5 21V4M5 4h11l-2 4 2 4H5"),

  // Theme and sound
  sun: c(12, 12, 4) + p("M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"),
  moon: p("M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"),
  monitor: r(3, 4, 18, 12, 2) + p("M8 20h8M12 16v4"),
  "sound-on": p("M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5z") + p("M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"),
  "sound-off": p("M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5z") + p("M16 9.5l5 5M21 9.5l-5 5"),
  cloud: p("M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.6a4.5 4.5 0 0 1-.5 9.9H7z"),
  device: p("M4.5 6a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v9h-15V6z") + p("M2.5 18.5h19"),

  // Achievements and lesson things
  spark: p("M12 3.5c.7 4 3 6.3 7 7-4 .7-6.3 3-7 7-.7-4-3-6.3-7-7 4-.7 6.3-3 7-7z") + p("M19 3.5v3M17.5 5h3"),
  bolt: p("M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8z"),
  flame: p("M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-4-2.9-6.2-4-10.5-1.8 1.4-3 3.6-3 6-1-.5-2-1.6-2.5-3C7.6 9.6 5.5 12 5.5 15a6.5 6.5 0 0 0 6.5 6.5z"),
  smoke: p("M8 20.5c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5M12.5 20.5c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5-1.5-3 0-4.5M17 20.5c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5"),
  target: c(12, 12, 9) + c(12, 12, 5) + p("M12 12h.01"),
  landmark: p("M10 3h4l1 4H9l1-4z") + p("M9.2 7 7.5 20.5h9L14.8 7") + p("M8.6 12h6.8M8 16.5h8") + p("M4 20.5h16"),
  wrench: p("M14.7 6.3a4 4 0 0 0-5.4 5.1l-5.8 5.8a1.8 1.8 0 0 0 2.5 2.6l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.3-.4-.4-2.3 2.4-2.4z"),
  book: p("M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5v-14z") + p("M5 18.5A1.5 1.5 0 0 0 6.5 20H19"),
  box: p("M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z") + p("M3.5 7.5 12 12l8.5-4.5M12 12v9"),
  led: p("M8 14V9.5a4 4 0 0 1 8 0V14") + p("M6.5 14h11") + p("M10 14v7M14 14v4.5") + p("M4 5l1.5 1M20 5l-1.5 1M12 2v1.3"),
  fuse: r(3, 8.5, 18, 7, 3.5) + p("M6.5 12c1.8-2.4 3.7 2.4 5.5 0s3.7 2.4 5.5 0"),
  rule: r(5, 3, 14, 18, 2) + p("M8.5 8h7M8.5 12h7M8.5 16h4"),
  shield: p("M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6L12 3z") + p("M9 12l2 2 4-4"),
  tools: p("M4.5 19.5 10 14M14 10l5.5-5.5") + p("M13.5 4.5l6 6M4 4l3.5 1L9 8.5 8.5 9l-3.5-1.5L4 4z") + p("M15 13l5 5-2 2-5-5"),
  cursor: p("M6 3.5 18.5 11l-5.5 1.5L10.5 18 6 3.5z"),
} as const;

export type IconName = keyof typeof ICONS;
