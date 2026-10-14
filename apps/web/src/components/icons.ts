/**
 * Ohmland's icon set, drawn like the notebook's other ink: stroke icons on a 24 px grid, currentColor at a 1.75 stroke
 * with round caps and joins, square corners. Each entry is the inner markup of the <svg>. Add new icons on the same
 * grid and stroke so the set stays consistent.
 */
const c = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const p = (d: string) => `<path d="${d}"/>`;
const r = (x: number, y: number, w: number, h: number, rx: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;

export const ICONS = {
  // Navigation
  learn: p("M3 5.6c3-.9 6-.5 9 1.3 3-1.8 6-2.2 9-1.3v12.8c-3-.9-6-.5-9 1.3-3-1.8-6-2.2-9-1.3z") + p("M12 6.9v12.8"),
  isle: p("M2.8 10.2 12 6.6l9.2 3.6L12 13.8z") + p("M2.8 10.2 7.6 16.6 12 20.6l4.4-4 4.8-6.4") + p("M12 6.6V3.2"),
  bench: p("M3 6.5h18v11H3z") + p("M3 12h18") + p("M7 9.2h.01M10.3 9.2h.01M13.7 9.2h.01M17 9.2h.01M7 14.8h.01M10.3 14.8h.01M13.7 14.8h.01M17 14.8h.01"),
  parts: p("M4 4h16v16H4z") + p("M4 12h16") + p("M10 8h4M10 16h4"),
  trophy: c(12, 9.5, 6) + c(12, 9.5, 2.4) + p("M8.6 14.4 7.2 21l4.8-2.4 4.8 2.4-1.4-6.6"),
  user: c(12, 8, 4) + p("M4.5 20.5c1-3.6 3.9-5.6 7.5-5.6s6.5 2 7.5 5.6"),
  notebook: p("M6 3.5h12.5v17H6z") + p("M9 3.5v17") + p("M3.5 7h4M3.5 12h4M3.5 17h4") + p("M12 8h4"),
  home: p("M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5z"),

  // Actions and arrows
  close: p("M6.5 6.5l11 11M17.5 6.5l-11 11"),
  check: p("M4.8 12.6l4.4 4.4 10-10"),
  plus: p("M12 5v14M5 12h14"),
  minus: p("M5 12h14"),
  "arrow-right": p("M5 12h13.5M13 6l6 6-6 6"),
  "arrow-left": p("M19 12H5.5M11 6l-6 6 6 6"),
  "chevron-right": p("M9.5 6l6 6-6 6"),
  "chevron-left": p("M15 6l-6 6 6 6"),
  "chevron-down": p("M6 9l6 6 6-6"),
  "chevron-up": p("M6 15l6-6 6 6"),
  play: p("M8 5.6v12.8L18.2 12z"),
  retry: p("M4.6 13a7.6 7.6 0 1 0 2.2-6.4L4.6 8.8") + p("M4.6 4.2v4.6h4.6"),
  download: p("M12 4v11M7 10l5 5 5-5M5 20h14"),
  upload: p("M12 15V4M7 9l5-5 5 5M5 20h14"),
  trash: p("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"),
  external: p("M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"),
  grip: p("M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"),
  lock: p("M5.8 10.8h12.4v9.4H5.8z") + p("M8.6 10.8V8a3.4 3.4 0 0 1 6.8 0v2.8") + p("M12 14.6v2"),

  // Status
  info: c(12, 12, 9) + p("M12 11v5.5M12 7.8h.01"),
  alert: c(12, 12, 8.5) + p("M12 7.6v5.2M12 16.3v.1"),
  "check-circle": c(12, 12, 9) + p("M8 12.5l2.8 2.8L16.5 9.5"),
  "x-circle": c(12, 12, 9) + p("M9 9l6 6M15 9l-6 6"),
  hint: p("M8.2 13.6V9.4a3.8 3.8 0 0 1 7.6 0v4.2") + p("M6.6 13.6h10.8") + p("M10.2 13.6v7M13.8 13.6v5") + p("M12 2.2v1.4M4.6 5.4l1 .9M19.4 5.4l-1 .9"),
  clock: c(12, 12, 8.5) + p("M12 7.4V12l3 2"),
  star: p("M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z"),
  flag: p("M5 21V4M5 4h11l-2 4 2 4H5"),

  // Theme and sound
  sun: c(12, 12, 4) + p("M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"),
  moon: p("M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z"),
  monitor: p("M3 4.5h18v11.5H3z") + p("M8 20h8M12 16v4"),
  settings: p("M4 7h9M17 7h3M4 17h3M11 17h9") + c(15, 7, 2) + c(9, 17, 2),
  "sound-on": p("M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5z") + p("M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"),
  "sound-off": p("M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5z") + p("M16 9.5l5 5M21 9.5l-5 5"),
  cloud: p("M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.6a4.5 4.5 0 0 1-.5 9.9H7z"),
  "cloud-off": p("M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 1.6-2.7M11 4.6A6 6 0 0 1 18 8.6a4.5 4.5 0 0 1 2.4 7.9") + p("M3.5 3.5l17 17"),
  "cloud-check": p("M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.6a4.5 4.5 0 0 1-.5 9.9H7z") + p("M9.2 13.4l2 2 3.8-3.9"),
  "sign-out": p("M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8") + p("M10 12h10M16.5 8.5 20 12l-3.5 3.5"),

  // Sign-in providers, drawn in the house style (a letter G, and a code branch for the code host).
  google: p("M18.4 7.2A8 8 0 1 0 20 12h-7.5"),
  github: c(7, 5.5, 2) + c(7, 18.5, 2) + c(17, 7.5, 2) + p("M7 7.5v9M17 9.5v.5a4 4 0 0 1-4 4h-2a4 4 0 0 0-4 2.5"),
  device: p("M4.5 6a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v9h-15V6z") + p("M2.5 18.5h19"),

  // Achievements and lesson things
  spark: p("M12 3.5c.7 4 3 6.3 7 7-4 .7-6.3 3-7 7-.7-4-3-6.3-7-7 4-.7 6.3-3 7-7z") + p("M19 3.5v3M17.5 5h3"),
  bolt: p("M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8z"),
  flame: p("M12 3c.6 3.4 5.2 5.4 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2.5 1.3-4.2 2.5-5.2.3 2 1.2 3.2 2.6 3.8C11.5 9.4 10.8 6.4 12 3z"),
  smoke: p("M8 20.5c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5M12.5 20.5c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5-1.5-3 0-4.5M17 20.5c-1.5-1.5-1.5-3 0-4.5s1.5-3 0-4.5"),
  target: c(12, 12, 9) + c(12, 12, 5) + p("M12 12h.01"),
  landmark: p("M10 3h4l1 4H9l1-4z") + p("M9.2 7 7.5 20.5h9L14.8 7") + p("M8.6 12h6.8M8 16.5h8") + p("M4 20.5h16"),
  wrench: p("M14.7 6.3a4 4 0 0 0-5.4 5.1l-5.8 5.8a1.8 1.8 0 0 0 2.5 2.6l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.3-.4-.4-2.3 2.4-2.4z"),
  book: p("M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5v-14z") + p("M5 18.5A1.5 1.5 0 0 0 6.5 20H19"),
  box: p("M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z") + p("M3.5 7.5 12 12l8.5-4.5M12 12v9"),
  led: p("M8 14V9.5a4 4 0 0 1 8 0V14") + p("M6.5 14h11") + p("M10 14v7M14 14v4.5") + p("M4 5l1.5 1M20 5l-1.5 1M12 2v1.3"),
  fuse: r(3, 8.5, 18, 7, 3.5) + p("M6.5 12c1.8-2.4 3.7 2.4 5.5 0s3.7 2.4 5.5 0"),
  rule: p("M3 8.5h18v7H3z") + p("M7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v2"),
  shield: p("M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6L12 3z") + p("M9 12l2 2 4-4"),
  tools: p("M4.5 19.5 10 14M14 10l5.5-5.5") + p("M13.5 4.5l6 6M4 4l3.5 1L9 8.5 8.5 9l-3.5-1.5L4 4z") + p("M15 13l5 5-2 2-5-5"),
  cursor: p("M6 3.5 18.5 11l-5.5 1.5L10.5 18 6 3.5z"),
} as const;

export type IconName = keyof typeof ICONS;
