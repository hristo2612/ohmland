/**
 * The mascot as 32x32 pixel art, drawn by code so every pose stays on-model: a rounded cream head with a dark visor
 * and two amber LED eyes, a short antenna with a glowing tip, a compact body with a copper chest plate, stubby arms
 * and a little thruster. Colours are palette indices; the component maps them to --bot-* tokens.
 */

export const SIZE = 32;

export const PALETTE = [
  "transparent",
  "--bot-outline",
  "--bot-cream",
  "--bot-cream-hi",
  "--bot-cream-lo",
  "--bot-visor",
  "--bot-visor-hi",
  "--bot-led",
  "--bot-led-hi",
  "--bot-copper",
  "--bot-copper-hi",
  "--bot-copper-lo",
  "--bot-metal",
  "--bot-flame",
  "--bot-flame-hi",
  "--bot-sweat",
] as const;

const O = 1, CREAM = 2, CREAM_HI = 3, CREAM_LO = 4, VISOR = 5, VISOR_HI = 6, LED = 7, LED_HI = 8;
const COPPER = 9, COPPER_HI = 10, COPPER_LO = 11, METAL = 12, FLAME = 13, FLAME_HI = 14, SWEAT = 15;

export type MascotPose = "idle" | "happy" | "thinking" | "oops" | "celebrate";
export const POSES: readonly MascotPose[] = ["idle", "happy", "thinking", "oops", "celebrate"];

export type Grid = Uint8Array;
export type Layers = {
  /** Body, outlined. */
  body: Grid;
  /** Eyes and mouth (drawn on the visor). */
  face: Grid;
  /** Closed eyes for a blink, when the pose has one. */
  blink: Grid | null;
  /** Thruster flame (no outline, flickers). */
  flame: Grid;
  /** Sparkles and other effects (no outline). */
  fx: Grid;
};

const grid = () => new Uint8Array(SIZE * SIZE);
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const put = (g: Grid, x: number, y: number, c: number) => {
  if (inside(x, y)) g[y * SIZE + x] = c;
};
const at = (g: Grid, x: number, y: number) => (inside(x, y) ? (g[y * SIZE + x] ?? 0) : 0);

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, c);
}

/** A filled rectangle with its corners cut by `r` pixels (a pixel-art rounded rectangle). */
function roundRect(g: Grid, x0: number, y0: number, x1: number, y1: number, r: number, c: number) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = Math.max(x0 + r - x, x - (x1 - r), 0);
      const dy = Math.max(y0 + r - y, y - (y1 - r), 0);
      if (dx + dy <= r) put(g, x, y, c);
    }
}

function pixels(g: Grid, list: [number, number][], c: number) {
  for (const [x, y] of list) put(g, x, y, c);
}

const mirror = (list: [number, number][]): [number, number][] => list.map(([x, y]) => [SIZE - 1 - x, y]);

/** Adds a one-pixel outline around everything drawn (4-neighbours), for the chunky pixel-art edge. */
function outline(g: Grid) {
  const out = g.slice();
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (at(g, x, y) !== 0) continue;
      if (at(g, x - 1, y) || at(g, x + 1, y) || at(g, x, y - 1) || at(g, x, y + 1)) out[y * SIZE + x] = O;
    }
  return out;
}

function sparkle(g: Grid, x: number, y: number, c: number) {
  pixels(g, [[x, y - 1], [x - 1, y], [x, y], [x + 1, y], [x, y + 1]], c);
}

function drawBody(pose: MascotPose): Grid {
  const g = grid();
  // Antenna: a short metal stem with a glowing tip.
  rect(g, 15, 4, 16, 6, METAL);
  rect(g, 14, 1, 17, 3, LED);
  put(g, 14, 1, 0);
  put(g, 17, 1, 0);
  put(g, 14, 3, 0);
  put(g, 17, 3, 0);
  put(g, 15, 1, LED_HI);
  put(g, 15, 2, LED_HI);
  put(g, 16, 1, LED_HI);

  // Head: a rounded cream square with soft shading.
  roundRect(g, 7, 7, 24, 19, 2, CREAM);
  rect(g, 9, 7, 18, 7, CREAM_HI);
  put(g, 8, 8, CREAM_HI);
  rect(g, 24, 9, 24, 17, CREAM_LO);
  rect(g, 9, 19, 22, 19, CREAM_LO);
  put(g, 23, 18, CREAM_LO);

  // Side bolts (ears).
  rect(g, 5, 12, 6, 14, COPPER);
  put(g, 5, 12, COPPER_HI);
  rect(g, 25, 12, 26, 14, COPPER);
  put(g, 26, 14, COPPER_LO);

  // Visor.
  roundRect(g, 9, 9, 22, 16, 1, VISOR);
  rect(g, 10, 9, 14, 9, VISOR_HI);
  put(g, 9, 10, VISOR_HI);

  // Neck and body.
  rect(g, 13, 20, 18, 20, METAL);
  roundRect(g, 10, 21, 21, 27, 1, CREAM);
  rect(g, 11, 21, 17, 21, CREAM_HI);
  rect(g, 21, 22, 21, 26, CREAM_LO);
  rect(g, 11, 27, 20, 27, CREAM_LO);

  // Copper chest plate with a tiny status light.
  rect(g, 13, 22, 18, 25, COPPER);
  rect(g, 13, 22, 17, 22, COPPER_HI);
  rect(g, 14, 25, 18, 25, COPPER_LO);
  put(g, 18, 23, COPPER_LO);
  put(g, 14, 23, LED);
  put(g, 15, 23, LED_HI);

  // Thruster nozzle.
  rect(g, 13, 28, 18, 28, METAL);

  // Arms.
  if (pose === "celebrate") {
    const arm: [number, number][] = [[8, 22], [8, 21], [7, 21], [7, 20], [6, 20], [6, 19], [5, 19], [5, 18], [4, 18], [4, 17]];
    pixels(g, arm, CREAM);
    pixels(g, mirror(arm), CREAM);
    pixels(g, [[3, 16], [4, 16], [3, 17]], CREAM_HI);
    pixels(g, mirror([[3, 16], [4, 16], [3, 17]]), CREAM_HI);
  } else if (pose === "thinking") {
    rect(g, 7, 22, 8, 25, CREAM);
    put(g, 7, 25, CREAM_LO);
    // Right hand up at the chin.
    rect(g, 23, 20, 24, 23, CREAM);
    put(g, 24, 23, CREAM_LO);
  } else {
    rect(g, 7, 22, 8, 25, CREAM);
    put(g, 7, 22, CREAM_HI);
    put(g, 8, 25, CREAM_LO);
    rect(g, 23, 22, 24, 25, CREAM);
    put(g, 24, 25, CREAM_LO);
  }

  // Thought bubbles and the sweat drop are part of the outlined body.
  if (pose === "thinking") {
    put(g, 27, 8, CREAM);
    rect(g, 28, 4, 29, 5, CREAM);
  }
  if (pose === "oops") {
    pixels(g, [[28, 6], [27, 7], [28, 7], [27, 8], [28, 8]], SWEAT);
  }
  return outline(g);
}

function drawFace(pose: MascotPose): { face: Grid; blink: Grid | null } {
  const face = grid();
  let blink: Grid | null = null;
  const eye = (x: number, y: number) => {
    rect(face, x, y, x + 1, y + 1, LED);
    put(face, x, y, LED_HI);
  };
  switch (pose) {
    case "idle": {
      eye(11, 12);
      eye(19, 12);
      blink = grid();
      rect(blink, 11, 13, 12, 13, LED);
      rect(blink, 19, 13, 20, 13, LED);
      break;
    }
    case "happy":
    case "celebrate": {
      const arc: [number, number][] = [[10, 13], [11, 12], [12, 12], [13, 13]];
      pixels(face, arc, LED);
      pixels(face, arc.map(([x, y]) => [x + 8, y] as [number, number]), LED);
      if (pose === "celebrate") {
        rect(face, 14, 14, 17, 15, LED);
        put(face, 15, 14, LED_HI);
        put(face, 16, 14, LED_HI);
        put(face, 13, 14, LED);
        put(face, 18, 14, LED);
      } else {
        pixels(face, [[13, 14], [14, 15], [15, 15], [16, 15], [17, 15], [18, 14]], LED);
      }
      break;
    }
    case "thinking": {
      eye(12, 11);
      eye(20, 11);
      pixels(face, [[15, 15], [16, 15], [17, 15]], LED);
      break;
    }
    case "oops": {
      eye(11, 13);
      eye(19, 13);
      // Worried brows, inner ends raised.
      pixels(face, [[10, 12], [11, 11], [12, 11]], LED);
      pixels(face, [[19, 11], [20, 11], [21, 12]], LED);
      pixels(face, [[15, 15], [16, 15]], LED);
      break;
    }
  }
  return { face, blink };
}

function drawFlame(pose: MascotPose): Grid {
  const g = grid();
  rect(g, 14, 29, 17, 29, FLAME);
  rect(g, 15, 29, 16, 29, FLAME_HI);
  rect(g, 15, 30, 16, 30, FLAME);
  if (pose === "celebrate") {
    rect(g, 15, 30, 16, 30, FLAME_HI);
    rect(g, 15, 31, 16, 31, FLAME);
  }
  return g;
}

function drawFx(pose: MascotPose): Grid {
  const g = grid();
  if (pose === "celebrate") {
    sparkle(g, 3, 6, LED_HI);
    sparkle(g, 28, 4, LED);
    sparkle(g, 29, 18, LED_HI);
    put(g, 1, 12, LED);
  }
  if (pose === "happy") {
    sparkle(g, 28, 5, LED_HI);
  }
  return g;
}

const cache = new Map<MascotPose, Layers>();

export function mascotLayers(pose: MascotPose): Layers {
  const hit = cache.get(pose);
  if (hit) return hit;
  const { face, blink } = drawFace(pose);
  const layers: Layers = { body: drawBody(pose), face, blink, flame: drawFlame(pose), fx: drawFx(pose) };
  cache.set(pose, layers);
  return layers;
}

/** One path per colour: each horizontal run of a colour becomes a 1-pixel-high rectangle in its path. */
export function toPaths(g: Grid): { token: string; d: string }[] {
  const byColour = new Map<number, string>();
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      const c = g[y * SIZE + x] ?? 0;
      if (c === 0) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < SIZE && g[y * SIZE + x + w] === c) w++;
      byColour.set(c, `${byColour.get(c) ?? ""}M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  }
  return [...byColour].map(([c, d]) => ({ token: PALETTE[c] ?? PALETTE[1], d }));
}
