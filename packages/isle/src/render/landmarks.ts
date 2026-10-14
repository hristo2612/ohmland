/**
 * Landmarks: the big builds a module brings, grown from electronic parts into buildings. Most rise through tiers as
 * later modules are finished on their island. Local coordinates as for pieces: standing on y = 0, front facing +z.
 */
import { Q, type Built, type Col, type Shape } from "./kit";
import { die, sevenSeg } from "./pieces";

const done = (s: Shape, top: number, outline: [number, number] | null): Built => ({ top, lights: s.lights, smoke: s.smoke, pads: s.pads, outline });

function door(s: Shape, x: number, z: number, w = 0.5, h = 0.875, col: Col = "charcoal"): void {
  s.box(w + Q, h + Q / 2, Q, "#5A4A3A", x, 0, z);
  s.box(w, h, Q, col, x, 0, z + Q / 2);
}

function plinth(s: Shape, w: number, d: number, col: Col = "#C9C2B4"): void {
  s.box(w, 0.125, d, col, 0, 0, 0);
}

/** A beacon on a mast tip: a red light that shows at night. */
function beacon(s: Shape, x: number, y: number, z: number, col: Col = "ledRed"): void {
  s.box(0.25, 0.25, 0.25, col, x, y, z, { glow: true, day: "#B9443A" });
  s.light(x, y + 0.12, z, col, 1.6);
}

function probe(s: Shape, x: number, z: number, y: number, h: number, col: Col): void {
  s.box(Q, 0.5, Q, "silver", x, y + h, z);
  s.box(0.25, h, 0.25, col, x, y, z);
  s.box(0.375, Q, 0.375, col, x, y + h - 0.25, z);
}

/** An insulator post: a stack of white ceramic sheds round a cream core, standing on y; returns its top. */
function ceramicStack(s: Shape, x: number, z: number, y: number, sheds: number): number {
  for (let i = 0; i < sheds; i++) {
    s.cyl(0.25, 0.125, "cream", x, y + i * 0.25, z);
    s.cyl(0.375, 0.125, "white", x, y + i * 0.25 + 0.125, z);
  }
  return y + sheds * 0.25;
}

/**
 * A copper horn rising from (x0, y0) and curving outwards (sx: which way) to x0 + sx * spread at y0 + h, drawn in rows
 * of 1/8, each row wide enough to meet the next, so the curve stays one unbroken rod.
 */
function horn(s: Shape, x0: number, y0: number, h: number, spread: number, sx: number): void {
  const rows = Math.round(h / Q);
  const at = (j: number) => x0 + sx * spread * (j / rows) ** 2;
  for (let j = 0; j < rows; j++) {
    const a = at(j);
    const b = at(j + 1);
    const lo = Math.min(a, b) - Q;
    const hi = Math.max(a, b) + Q;
    s.box(hi - lo, Q, 0.25, "copper", (lo + hi) / 2, y0 + j * Q, 0);
  }
}

/** A small spark across a gap from x0 to x1 at height y: a jagged bolt of light, white hot in the middle. */
function spark(s: Shape, x0: number, x1: number, y: number, size = 1.8): void {
  const n = Math.max(2, Math.round((x1 - x0) / Q));
  const zig = [0, 1, 2, 1, 0, 1, 2, 3, 2, 1];
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * Q;
    const mid = Math.abs(i + 0.5 - n / 2) < 1;
    s.box(Q, mid ? 0.25 : Q, Q, mid ? "ledWhite" : "#BFE0FF", x, y + zig[i % zig.length]! * (Q / 2) - (mid ? Q / 2 : 0), 0, { glow: true, day: mid ? "#E6F2FF" : "#9CC9F2" });
  }
  s.light((x0 + x1) / 2, y + 0.125, 0, "ledBlue", size);
}

function sparkGap(s: Shape, t: number): Built {
  const tall = t >= 1;
  plinth(s, 3.0, tall ? 2.5 : 2.0);
  // the two insulator posts on their footings: red for plus, black for minus
  const px = 0.75;
  let top = 0;
  for (const sx of [-1, 1]) {
    const c: Col = sx > 0 ? "red" : "ink";
    s.box(0.75, 0.25, 0.75, c, sx * px, 0.125, 0);
    // its feed cable runs back across the plinth
    s.box(Q, Q, 0.625, c, sx * px, 0.125, -0.6875);
    top = ceramicStack(s, sx * px, 0, 0.375, tall ? 6 : 4);
    s.box(0.5, Q, 0.5, "copperDark", sx * px, top, 0);
  }
  // the horns rise from the inner edge of each post and curve apart: the gap is narrowest at the bottom
  const y0 = top + Q;
  const hh = tall ? 2.375 : 1.75;
  const spread = tall ? 1.0 : 0.875;
  const hx = 0.5;
  for (const sx of [-1, 1]) horn(s, sx * hx, y0, hh, spread, sx);
  spark(s, -hx + Q, hx - Q, y0 + 0.25);
  if (tall) {
    // a second, fainter spark higher up, where the gap is wider (the arc climbs, as on a Jacob's ladder)
    const yy = y0 + 1.125;
    const gx = hx + spread * (1.125 / hh) ** 2;
    spark(s, -gx + Q, gx - Q, yy, 1.4);
    // the control hut at the back, a window on the gap, a beacon on its mast
    s.box(1.125, 0.75, 0.625, "cream", 0.875, 0.125, -0.875);
    s.roof(1.25, 0.75, 0.25, "charcoal", 0.875, 0.875, -0.875, 2);
    s.window(0.25, 0.25, 1.125, 0.375, -0.5625);
    s.window(0.25, 0.25, 1.4375 + Q / 2, 0.375, -0.875, 1);
    s.box(Q, 1.125, Q, "steel", 0.375, 1.0, -1.0625);
    beacon(s, 0.375, 2.125, -1.0625);
  }
  return done(s, y0 + hh + 0.25, tall ? [1.625, 1.375] : [1.625, 1.125]);
}

/** A glowing marble (a charge going round): a rounded amber bead three voxels across, its bottom at y. */
function marble(s: Shape, x: number, y: number, z: number): void {
  const o = { glow: true, day: "#F5B93E" } as const;
  s.box(0.375, 0.25, 0.25, "amber", x, y + 0.0625, z, o);
  s.box(0.25, 0.375, 0.25, "amber", x, y, z, o);
  s.box(0.25, 0.25, 0.375, "amber", x, y + 0.0625, z, o);
  s.light(x, y + 0.2, z, "amber", 1.0);
}

/**
 * A marble run along corners in (x, z), sloping evenly down from y0 to y1: two silver rails on copper sleepers in
 * short steps, with steel posts under the corners. Returns the top of the rails every quarter, for marbles.
 */
function marbleRun(s: Shape, pts: [number, number][], y0: number, y1: number): [number, number, number][] {
  const legs = pts.slice(1).map((p, i) => [pts[i]!, p] as const);
  const len = legs.reduce((a, [p, q]) => a + Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]), 0);
  const yAt = (r: number) => y0 + (y1 - y0) * (r / len);
  const out: [number, number, number][] = [];
  let run = 0;
  for (const [[ax, az], [bx, bz]] of legs) {
    const l = Math.abs(bx - ax) + Math.abs(bz - az);
    const n = Math.round(l / 0.25);
    const alongX = bx !== ax;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const x = ax + (bx - ax) * k;
      const z = az + (bz - az) * k;
      const y = yAt(run + l * k);
      for (const o of [-0.125, 0.125]) {
        if (alongX) s.box(0.375, Q, Q, "silver", x, y, z + o);
        else s.box(Q, Q, 0.375, "silver", x + o, y, z);
      }
      if (i % 2 === 0) s.box(alongX ? Q : 0.5, Q / 2, alongX ? 0.5 : Q, "copperDark", x, y - Q / 2, z);
      out.push([x, y + Q, z]);
    }
    run += l;
  }
  // the corners, and posts under them
  run = 0;
  pts.forEach(([x, z], i) => {
    if (i > 0) run += Math.abs(x - pts[i - 1]![0]) + Math.abs(z - pts[i - 1]![1]);
    if (i === 0 || i === pts.length - 1) return;
    const y = yAt(run);
    s.box(0.375, Q, 0.375, "silver", x, y, z);
    s.box(Q, y - 0.1875, Q, "steel", x, 0.125, z);
  });
  return out;
}

/** A pixel ring standing in the xy plane at depth z: centre (x, yc), radius R to the middle of a rail t thick. */
function hoop(s: Shape, x: number, yc: number, z: number, R: number, t: number, col: Col, depth: number): void {
  const n = Math.ceil((R + t / 2) / Q);
  for (let j = -n; j < n; j++) {
    const y = (j + 0.5) * Q;
    let run0: number | null = null;
    for (let i = -n; i <= n; i++) {
      const d = Math.hypot((i + 0.5) * Q, y);
      const inside = i < n && d >= R - t / 2 && d <= R + t / 2;
      if (inside && run0 === null) run0 = i;
      if (!inside && run0 !== null) {
        const w = (i - run0) * Q;
        s.box(w, Q, depth, col, x + run0 * Q + w / 2, yc + j * Q, z);
        run0 = null;
      }
    }
  }
}

function pumpHouse(s: Shape, t: number): Built {
  const tall = t >= 1;
  plinth(s, 3.75, 2.75);
  // the pump's tower is a 9 V battery: black, a blue label, the snap terminals on its roof
  const bx = -0.875;
  const bz = -0.5;
  const w = 1.25;
  const d = 0.875;
  const H = tall ? 3.0 : 2.25;
  s.box(w, H * 0.4, d, "black", bx, 0.125, bz);
  s.box(w, Q / 2, d, "silver", bx, 0.125 + H * 0.4, bz);
  s.box(w, H * 0.6 - 0.1875, d, "blue", bx, 0.1875 + H * 0.4, bz);
  s.box(w, Q, d, "charcoal", bx, H, bz);
  s.text("9V", "white", bx, H - 0.125, bz + d / 2 + Q / 4, 1);
  s.box(0.375, 0.125, 0.375, "silver", bx - 0.3125, H + Q, bz);
  s.box(0.25, 0.125, 0.25, "steel", bx - 0.3125, H + 0.25, bz);
  s.cyl(0.125, 0.25, "silver", bx + 0.3125, H + Q, bz);
  // the pump house at its foot
  const hz = 0.4375;
  s.box(1.25, 0.75, 1.0, "cream", -1.0, 0.125, hz);
  s.roof(1.5, 1.25, 0.375, "copper", -1.0, 0.875, hz, 2);
  door(s, tall ? -1.25 : -1.0, hz + 0.5 + Q / 2, 0.375, 0.625);
  if (tall) {
    s.window(0.25, 0.25, -0.6875, 0.375, hz + 0.5 + Q / 2);
    s.window(0.375, 0.25, -1.625 - Q / 2, 0.375, hz, -1);
    for (const y of [1.5, 2.25]) s.window(0.25, 0.375, bx - w / 2 - Q / 2, y, bz, -1);
  }
  // the lift beside the battery: a steel shaft with the marbles riding up the slot in its face, the head on top
  const lx = 0.0;
  s.box(0.5, H, 0.5, "steel", lx, 0.125, bz);
  s.box(0.25, H - 0.125, Q, "charcoal", lx, 0.125, bz + 0.25);
  s.box(0.625, 0.25, 0.625, "steel", lx, H + 0.125, bz);
  s.xdisc(0.25, Q, "copper", lx + 0.3125 + Q / 2, H + 0.25, bz);
  const lifted = tall ? [0.625, 1.375, 2.125] : [0.625, 1.375];
  for (const y of lifted) marble(s, lx, y, bz + 0.375);
  // the run: out along the back, round the front and home to the foot of the lift
  const path: [number, number][] = [
    [lx + 0.25, bz],
    [1.5, bz],
    [1.5, 0.875],
    [lx, 0.875],
    [lx, bz + 0.5],
  ];
  const bed = marbleRun(s, path, H - 0.25, 0.375);
  for (const i of tall ? [2, 8, 17] : [3, 11]) {
    const p = bed[i];
    if (p) marble(s, p[0], p[1], p[2]);
  }
  let top = H + 0.5;
  if (tall) {
    // a loop the loop on the front run, a marble at its top
    const p = bed.find(([x, , z]) => z === 0.875 && Math.abs(x - 0.75) < 0.2);
    if (p) {
      const R = 0.5;
      hoop(s, p[0], p[1] + R, p[2], R, Q, "silver", 0.375);
      marble(s, p[0], p[1] + 2 * R - 0.4375, p[2]);
    }
    top = H + 0.6;
  }
  return done(s, top, [2.0, 1.5]);
}

function meterTower(s: Shape, t: number): Built {
  plinth(s, 3.25, 2.25);
  const w = 2.25;
  const d = 1.25;
  const H = t === 0 ? 2.5 : t === 1 ? 3.5 : 4.25;
  const z = d / 2;
  s.box(w, H, d, "yellow", 0, 0.125, 0);
  s.box(w - 0.375, H - 0.375, Q, "charcoal", 0, 0.3125, z);
  // the display along the top, with big digits
  const ly = 0.125 + H - 1.125;
  s.box(w - 0.75, 0.75, Q, "lcdLit", 0, ly, z + Q / 2, { glow: true, day: "lcd" });
  s.text(t === 0 ? "1.5" : t === 1 ? "9.0" : "4.7K", "ink", 0, ly + 0.6875, z + Q, t === 2 ? 0.75 : 1);
  s.light(0, ly + 0.4, z + 0.3, "lcdLit", 2);
  // the dial and its pointer
  const dy = ly - 0.75;
  s.vdisc(0.5, Q, "black", 0, dy, z + Q / 2);
  s.box(Q, 0.375, Q, "white", 0, dy, z + Q);
  for (const [x, y] of [[-0.625, dy + 0.375], [0.625, dy + 0.375], [-0.75, dy], [0.75, dy]] as const) s.box(Q, Q, Q / 2, "white", x, y, z + Q / 2);
  door(s, 0, z + Q, 0.625, 0.875);
  // sockets either side of the door
  s.box(0.25, 0.25, Q, "red", 0.75, 0.5, z + Q / 2);
  s.box(0.25, 0.25, Q, "ink", -0.75, 0.5, z + Q / 2);
  for (const sx of [-1, 1]) for (let y = 0.75; y < H - 0.5; y += 0.875) s.window(0.375, 0.5, sx * (w / 2 + Q / 2), y, 0, sx as 1 | -1);
  s.box(w + 0.125, Q, d + 0.125, "#E0A92A", 0, 0.125 + H, 0);
  let top = 0.25 + H;
  if (t >= 1) {
    // the probes stand on the roof as spires, their leads looping down to the sockets
    probe(s, -0.625, 0, top, 1.25, "black");
    probe(s, 0.625, 0, top, 1.5, "red");
    for (const [x, c] of [[-0.75, "ink"], [0.75, "red"]] as const) {
      s.box(Q, top - 0.5, Q, c, x * 1.5, 0.5, z - Q);
      s.box(0.5, Q, Q, c, x * 1.25, 0.5, z);
    }
    top += 2;
  }
  if (t >= 2) {
    // an observation deck on top of the tower, with a beacon
    s.box(1.5, Q, 1.25, "copper", 0, 0.25 + H, 0);
    s.box(1.0, 0.75, 0.875, "cream", 0, 0.375 + H, 0);
    s.window(0.625, 0.375, 0, 0.6 + H, 0.4375);
    s.box(1.25, Q, 1.0, "copper", 0, 1.125 + H, 0);
    beacon(s, 0, 1.25 + H, 0);
    for (const sx of [-1, 1]) {
      s.box(0.125, 1.25, 0.125, "steel", sx * 1.375, 0.125, z + 0.375);
      s.box(0.375, 0.25, 0.375, "warm", sx * 1.375, 1.375, z + 0.375, { glow: true, day: "#E8D6A8" });
      s.light(sx * 1.375, 1.5, z + 0.375, "warm", 1.6);
    }
    top = Math.max(top, H + 1.6);
  }
  return done(s, top, [1.75, 1.25]);
}

const HALL_BANDS: Col[][] = [
  ["brown", "black", "red", "#D4A93C"],
  ["yellow", "violet", "orange", "#D4A93C"],
];

/** A resistor lying along x as a building: segments of [colour, radius] from x0, axis at yc. */
function bigResistor(s: Shape, len: number, R: number, yc: number, bands: Col[], z = 0): void {
  const n = Math.round(len / 0.25);
  const at = [1, Math.round(n * 0.35), Math.round(n * 0.55), n - 2];
  for (let i = 0; i < n; i++) {
    const end = i < 2 || i >= n - 2;
    const band = at.indexOf(i);
    s.xdisc(end ? R + 0.125 : R, 0.25, band >= 0 ? bands[band]! : "beige", -len / 2 + (i + 0.5) * 0.25, yc, z);
  }
}

function resistorHall(s: Shape, t: number): Built {
  plinth(s, 5.25, 2.5, "#CFC8B8");
  const yc = 1.0;
  bigResistor(s, 4.0, 0.875, yc, HALL_BANDS[0]!);
  // leads become columns into the board
  for (const sx of [-1, 1]) {
    s.box(0.5, 0.25, 0.25, "silver", sx * 2.25, yc - 0.125, 0);
    s.box(0.25, yc + 0.125, 0.25, "silver", sx * 2.375, 0, 0);
    s.pads.push([sx * 2.375, 0]);
  }
  door(s, 0, 0.75, 0.625, 0.75);
  for (const x of [-1.25, -0.75, 0.75, 1.25]) s.window(0.25, 0.375, x, 0.875, 0.875);
  let top = yc + 1.1;
  if (t >= 1) {
    bigResistor(s, 2.5, 0.5, yc + 1.375, HALL_BANDS[1]!, -0.125);
    for (const sx of [-1, 1]) s.box(0.25, 0.375, 0.25, "silver", sx * 1.125, yc + 0.75, -0.125);
    for (const sx of [-1, 1]) {
      s.box(Q, 1.5, Q, "steel", sx * 2.0, 0.125, 1.0);
      s.box(0.25, 0.25, 0.25, "warm", sx * 2.0, 1.625, 1.0, { glow: true, day: "#E8D6A8" });
      s.light(sx * 2.0, 1.75, 1.0, "warm", 1.5);
    }
    top = yc + 2.0;
  }
  return done(s, top, [2.625, 1.25]);
}

function lighthouse(s: Shape, t: number): Built {
  const H = t === 0 ? 2.25 : t === 1 ? 3.5 : 4.5;
  s.cyl(1.25, 0.375, "#BDB5A6", 0, 0, 0);
  s.cyl(1.125, Q, "#D6CFC2", 0, 0.375, 0);
  // the tower: white with red bands
  const bands = Math.round(H / 0.5);
  for (let i = 0; i < bands; i++) s.cyl(i < 2 ? 0.75 : 0.625, 0.5, i % 2 ? "red" : "white", 0, 0.5 + i * 0.5, 0);
  door(s, 0, 0.75, 0.375, 0.625);
  for (let y = 1.5; y < H; y += 1.25) s.window(0.25, 0.375, 0, y, 0.6875);
  const y0 = 0.5 + bands * 0.5;
  // gallery, then the lens: a giant LED, flange, body and dome
  s.cyl(0.875, Q, "copper", 0, y0, 0);
  if (t >= 1) for (const [x, z] of [[-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]] as const) s.box(Q, 0.25, Q, "steel", x, y0 + Q, z);
  const lit: Col = t === 0 ? "ledRed" : "ledWhite";
  const day: Col = t === 0 ? "#D9473A" : "#D5E3EA";
  s.cyl(0.625, Q, lit, 0, y0 + Q, 0, { glow: true, day });
  s.cyl(0.5, 0.625, lit, 0, y0 + 0.25, 0, { glow: true, day });
  s.cyl(0.375, 0.125, lit, 0, y0 + 0.875, 0, { glow: true, day });
  s.box(0.375, Q, 0.375, lit, 0, y0 + 1.0, 0, { glow: true, day });
  s.light(0, y0 + 0.6, 0, lit, t === 0 ? 3 : 4.5);
  if (t >= 2) {
    // the anode and cathode legs as buttresses, and the keeper's cottage
    for (const sx of [-1, 1]) {
      s.box(0.25, 2.5, 0.25, "silver", sx * 1.0, 0.375, -0.25);
      s.box(0.25, 0.25, 0.5, "silver", sx * 1.0, 2.75, -0.375);
      s.box(0.25, Q, 0.25, "silver", sx * 0.75, 2.75, -0.5);
    }
    s.box(1.25, 0.875, 1.0, "cream", 1.375, 0.375, 0.875);
    s.roof(1.5, 1.25, 0.5, "copper", 1.375, 1.25, 0.875, 2);
    s.window(0.25, 0.25, 1.375, 0.75, 1.375);
  }
  return done(s, y0 + 1.25, [1.5, 1.5]);
}

function observatory(s: Shape, t: number): Built {
  s.cyl(1.5, 0.25, "#C9C2B4", 0, 0, 0);
  s.cyl(1.25, 1.375, "cream", 0, 0.25, 0);
  door(s, 0, 1.2, 0.5, 0.75);
  for (const sx of [-1, 1]) s.window(0.25, 0.375, sx * 0.75, 0.875, 0.95);
  // the copper dome with its slit
  s.ball(1.25, "copper", 0, 1.625, 0, 0.8);
  s.box(0.375, 1.0, 1.375, "charcoal", 0, 1.75, 0.125);
  // Ohm's law on a sign: V over I R
  s.box(1.5, 0.875, Q, "navy", 0, 0.25, 1.5);
  s.box(Q, 0.25, Q, "steel", -0.625, 0, 1.5);
  s.box(Q, 0.25, Q, "steel", 0.625, 0, 1.5);
  s.text("V", "white", 0, 1.0, 1.5 + Q / 2, 0.75);
  s.slab(0.75, Q / 4, Q / 4, "white", 0, 0.625, 1.5 + Q / 2);
  s.text("IR", "white", 0, 0.5625, 1.5 + Q / 2, 0.75);
  if (t >= 1) {
    // a telescope out of the slit, and a side wing
    for (let i = 0; i < 6; i++) s.box(0.25, 0.25, 0.25, i === 5 ? "charcoal" : "white", 0, 2.375 + i * 0.1875, 0.125 + i * 0.1875);
    s.box(1.25, 1.0, 1.25, "cream", -1.5, 0.25, -0.375);
    s.roof(1.5, 1.5, 0.5, "copper", -1.5, 1.25, -0.375, 2);
    s.window(0.375, 0.375, -1.5, 0.625, 0.25);
    // a small dish on the roof
    s.box(Q, 0.375, Q, "steel", -1.5, 1.75, -0.375);
    s.box(0.625, Q, 0.625, "white", -1.5, 2.125, -0.375);
  }
  return done(s, t ? 3.6 : 2.9, [1.625, 1.75]);
}

/** An upright cell (AA style): a coloured wrap, a silver top with its nub. */
function cell(s: Shape, x: number, z: number, h: number, wrap: Col, r = 0.5): void {
  s.cyl(r, h, wrap, x, 0.125, z);
  s.cyl(r, 0.125, "black", x, 0.125 + h * 0.62, z);
  s.cyl(r, 0.125, "silver", x, 0.125 + h, z);
  s.cyl(0.125, 0.125, "silver", x, 0.25 + h, z);
}

function powerStation(s: Shape, t: number): Built {
  plinth(s, 5.0, 4.5, "#BFB8AA");
  // the control shed
  s.box(1.75, 1.25, 1.25, "cream", -1.375, 0.125, 1.125);
  s.roof(2.0, 1.5, 0.375, "charcoal", -1.375, 1.375, 1.125, 2);
  door(s, -1.625, 1.75, 0.375, 0.75);
  s.window(0.375, 0.375, -0.875, 0.75, 1.75);
  s.text("+", "red", -1.375, 1.75, 1.8, 1);
  cell(s, 0.5, 1.25, 1.75, "orange");
  cell(s, 1.625, 1.25, 1.75, "green");
  let top = 2.4;
  if (t >= 1) {
    cell(s, 0.5, 0.0, 2.25, "blue");
    cell(s, 1.625, 0.0, 2.25, "orange");
    // a transformer with insulators, and wires across
    s.box(1.25, 1.0, 1.0, "steel", -1.375, 0.125, -0.5);
    for (const x of [-1.75, -1.375, -1.0]) {
      s.box(Q, 0.375, Q, "white", x, 1.125, -0.5);
      s.box(0.25, Q, 0.25, "white", x, 1.375, -0.5);
    }
    s.box(2.75, Q / 2, Q, "black", 0.125, 2.6, 0.0);
    top = 2.9;
  }
  if (t >= 2) {
    // a cooling tower with steam, and a pylon
    s.cone(1.0, 2.75, "#DAD5CB", 1.0, 0.125, -1.375, 4, 0.75);
    s.cyl(0.625, Q, "#B9B2A6", 1.0, 2.875, -1.375);
    s.smoke.push([1.0, 3.1, -1.375]);
    for (const sx of [-1, 1]) s.box(Q, 3.0, Q, "steel", -1.375 + sx * 0.375, 0.125, -1.75);
    s.box(1.0, Q, Q, "steel", -1.375, 2.5, -1.75);
    s.box(0.75, Q, Q, "steel", -1.375, 3.0, -1.75);
    beacon(s, -1.375, 3.125, -1.75);
    top = 3.5;
  }
  s.box(0.25, 0.25, Q, "ledGreen", 0.0, 0.5, 1.8, { glow: true, day: "#4FA85E" });
  s.light(0, 0.62, 1.85, "ledGreen", 1);
  return done(s, top, [2.375, 2.125]);
}

function lemonTreeAt(s: Shape, x: number, z: number, k = 1): void {
  s.box(0.25, 0.75 * k, 0.25, "trunk", x, 0, z);
  s.box(1.0 * k, 0.625 * k, 1.0 * k, "leaf", x, 0.625 * k, z);
  s.box(0.625 * k, 0.375 * k, 0.625 * k, "leaf2", x, 1.25 * k, z);
  for (const [dx, dy, dz] of [[0.375, 0.75, 0.5], [-0.5, 0.875, 0.25], [0.25, 1.0, -0.5], [-0.25, 0.75, -0.5]] as const) s.box(Q, Q, Q, "lemon", x + dx * k, dy * k, z + dz * k);
}

function lemonGrove(s: Shape, t: number): Built {
  const trees: [number, number][] = [[-1.25, -1.0], [0.25, -1.375], [1.375, -0.5], [-1.5, 0.5]];
  if (t >= 1) trees.push([1.375, 1.0], [-0.25, 1.375]);
  for (const [x, z] of trees) lemonTreeAt(s, x, z);
  // lemons on the ground with copper and zinc strips, wired in series to an LED post
  const cells: [number, number][] = [[-0.5, 0.25], [0, -0.25], [0.5, 0.25]];
  if (t >= 1) cells.push([0, 0.75]);
  for (const [x, z] of cells) {
    s.ball(0.25, "lemon", x, 0.25, z, 0.75);
    s.box(Q, 0.25, Q / 2, "copper", x - 0.125, 0.375, z);
    s.box(Q, 0.25, Q / 2, "silver", x + 0.125, 0.375, z);
  }
  s.box(1.25, Q / 2, Q / 2, "red", 0, 0.5, 0.0);
  s.box(Q, 1.5, Q, "silver", 0.875, 0, 0.25);
  s.box(0.25, 0.25, 0.25, "ledYellow", 0.875, 1.5, 0.25, { glow: true, day: "#F0CB3C" });
  s.light(0.875, 1.6, 0.25, "ledYellow", 1.8);
  if (t >= 1) {
    // a little juice barn
    s.box(1.0, 0.75, 0.875, "lemon", 0.75, 0, -1.875 + 0.25);
    s.roof(1.25, 1.125, 0.375, "leaf2", 0.75, 0.75, -1.625, 2);
  }
  return done(s, 1.9, null);
}

function insulatorPost(s: Shape, x: number, z: number, h: number): void {
  s.box(Q, h, Q, "steel", x, 0.125, z);
  s.box(0.25, Q, 0.25, "white", x, 0.125 + h, z);
  s.box(Q, Q, Q, "white", x, 0.25 + h, z);
}

function switchyard(s: Shape, t: number): Built {
  plinth(s, 5.25, 4.0, "#B9B4A8");
  // a low fence round the yard
  for (const sz of [-1, 1]) for (let x = -2.5; x <= 2.5; x += 0.5) s.box(Q, 0.375, Q, "steel", x, 0.125, sz * 1.875);
  for (const sz of [-1, 1]) s.box(5.0, Q / 2, Q / 2, "steel", 0, 0.4375, sz * 1.875);
  // gantries and wires
  const gantries = t >= 1 ? [-1.5, 0, 1.5] : [-1.0, 1.0];
  for (const x of gantries) {
    for (const sz of [-1, 1]) s.box(Q, 2.25, Q, "steel", x, 0.125, sz * 1.25);
    s.box(Q, Q, 2.75, "steel", x, 2.375, 0);
    for (const z of [-0.75, 0, 0.75]) insulatorPost(s, x, z, 2.25);
  }
  for (const z of [-0.75, 0, 0.75]) s.box(gantries.length > 2 ? 3.25 : 2.25, Q / 2, Q / 2, "black", 0, 2.6, z);
  // big toggle switches
  for (const [x, z] of [[-1.875, -0.5], [0.0, 0.875], [1.875, -0.5]] as const) {
    s.box(0.5, 0.375, 0.5, "charcoal", x, 0.125, z);
    s.cyl(0.125, 0.25, "silver", x, 0.5, z);
    for (let i = 0; i < 3; i++) s.box(Q, Q, Q, "silver", x + 0.0625 + i * 0.0625, 0.75 + i * 0.125, z);
    s.box(0.25, 0.25, 0.25, "red", x + 0.25, 1.0, z);
  }
  if (t >= 1) {
    s.box(1.25, 1.125, 0.875, "cream", -1.75, 0.125, 1.25);
    s.roof(1.5, 1.125, 0.375, "charcoal", -1.75, 1.25, 1.25, 2);
    s.window(0.5, 0.375, -1.75, 0.625, 1.6875);
    beacon(s, 1.5, 2.5, -1.25);
  }
  return done(s, 2.9, [2.75, 2.125]);
}

function relayClocktower(s: Shape, t: number): Built {
  plinth(s, 3.0, 3.0);
  const H = t === 0 ? 1.75 : 4.25;
  for (const [x, z] of [[-0.625, -0.625], [0.625, -0.625], [-0.625, 0.625], [0.625, 0.625], [0, -0.625]] as const) s.box(0.25, 0.25, 0.25, "silver", x, 0.125, z);
  s.box(2.0, H, 2.0, "blue", 0, 0.375, 0);
  s.box(2.0, Q, 2.0, "blueDark", 0, 0.375 + H, 0);
  door(s, 0, 1.0, 0.5, 0.875);
  s.text("12V", "white", 0, 0.375 + H - 0.375, 1.0 + Q / 2, 1);
  for (const sx of [-1, 1]) s.window(0.375, 0.5, sx * 1.0625, 0.9, 0, sx as 1 | -1);
  let top = 0.5 + H;
  if (t >= 1) {
    // the clock face, and a window onto the copper coil inside
    s.vdisc(0.625, Q, "white", 0, 0.375 + H - 1.25, 1.0 + Q / 2);
    s.box(Q, 0.5, Q, "ink", 0, 0.375 + H - 1.25, 1.0 + Q);
    s.box(0.375, Q, Q, "ink", 0.1875, 0.375 + H - 1.25, 1.0 + Q);
    s.box(1.0, 1.0, Q, "glassDark", 0, 1.75, 1.0 + Q / 4);
    for (let i = 0; i < 4; i++) s.box(0.75, Q, Q, i % 2 ? "copperDark" : "copper", 0, 1.875 + i * 0.1875, 1.0 + Q / 2);
    s.roof(2.25, 2.25, 0.75, "blueDark", 0, 0.5 + H, 0, 3);
    beacon(s, 0, 1.25 + H, 0, "ledRed");
    top = 1.5 + H;
  }
  return done(s, top, [1.5, 1.5]);
}

function breadboardPlaza(s: Shape, t: number): Built {
  const W = 5.0;
  const D = 3.5;
  s.box(W, 0.375, D, "white", 0, 0, 0);
  const y = 0.375;
  for (const sz of [-1, 1]) {
    s.slab(W - 0.5, Q / 4, Q, "red", 0, y, sz * 1.5);
    s.slab(W - 0.5, Q / 4, Q, "blue", 0, y, sz * 1.0);
    for (let i = 0; i < 9; i++) s.slab(Q, Q / 4, Q, "charcoal", -2.0 + i * 0.5, y, sz * 1.25);
  }
  s.slab(W - 0.25, Q / 4, 0.25, "#DCDCD6", 0, y, 0);
  for (const sz of [-1, 1]) for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) s.slab(Q, Q / 4, Q, "charcoal", -2.0 + i * 0.5, y, sz * (0.375 + r * 0.1875));
  // parts plugged in: a resistor bench, an LED lamp, jumper arches
  s.xdisc(0.25, 1.0, "beige", -1.25, y + 0.5, 0.5);
  for (const x of [-1.875, -0.625]) s.box(Q, 0.5, Q, "silver", x, y, 0.5);
  s.box(Q, 1.5, Q, "silver", 1.5, y, -0.5);
  s.cyl(0.25, 0.375, "ledRed", 1.5, y + 1.5, -0.5, { glow: true, day: "#D9473A" });
  s.light(1.5, y + 1.7, -0.5, "ledRed", 2.2);
  for (const [x0, x1, z, c] of [[-2.0, -0.5, -0.5, "yellow"], [0.0, 1.0, 0.5, "green"], [1.25, 2.0, 1.25, "orange"]] as const) {
    s.box(Q, 0.625, Q, c, x0, y, z);
    s.box(x1 - x0 + Q, Q, Q, c, (x0 + x1) / 2, y + 0.625, z);
    s.box(Q, 0.625, Q, c, x1, y, z);
  }
  if (t >= 1) {
    // a chip and a capacitor join the plaza
    s.box(1.25, 0.5, 0.625, "black", 0.5, y + 0.125, -0.25);
    for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) s.box(Q, 0.25, Q, "silver", 0.0 + i * 0.3125, y, -0.25 + sz * 0.375);
    s.flatText("555", "white", 0.5, y + 0.625, -0.25, 0.75);
    s.cyl(0.375, 1.0, "navy", -1.5, y, -0.875);
    s.cyl(0.375, Q, "silver", -1.5, y + 1.0, -0.875);
    s.box(0.25, 0.75, Q, "#D7DCE6", -1.5, y + 0.125, -0.5625);
  }
  return done(s, 2.2, [2.75, 2.0]);
}

function capacitorWaterTower(s: Shape, t: number): Built {
  const lift = t >= 1 ? 2.0 : 0;
  if (t >= 1) {
    for (const [x, z] of [[-0.875, -0.875], [0.875, -0.875], [-0.875, 0.875], [0.875, 0.875]] as const) s.box(0.25, lift, 0.25, "steel", x, 0, z);
    for (const sz of [-1, 1]) {
      s.box(2.0, Q, Q, "steel", 0, lift * 0.45, sz * 0.875);
      s.box(Q, Q, 2.0, "steel", sz * 0.875, lift * 0.7, 0);
    }
    // a ladder up the front leg
    for (let y = 0.25; y < lift; y += 0.25) s.box(0.375, Q / 2, Q, "silver", 0.875, y, 1.0625);
  } else s.cyl(1.25, 0.25, "#C9C2B4", 0, 0, 0);
  const y0 = lift + (t ? 0 : 0.25);
  const h = 2.25;
  s.cyl(1.125, 0.25, "charcoal", 0, y0, 0);
  s.cyl(1.125, h, "navy", 0, y0 + 0.25, 0);
  s.box(0.5, h, Q, "#D7DCE6", 0, y0 + 0.25, 1.0625);
  for (let i = 0; i < 4; i++) s.slab(0.25, Q / 2, Q / 4, "navy", 0, y0 + 0.5 + i * 0.5, 1.13);
  s.cyl(1.125, 0.125, "silver", 0, y0 + 0.25 + h, 0);
  s.slab(1.5, Q / 4, 0.125, "steel", 0, y0 + 0.375 + h, 0);
  s.slab(0.125, Q / 4, 1.5, "steel", 0, y0 + 0.375 + h, 0);
  s.text("1000", "navy", 0.625, y0 + h - 0.25, 1.0625 - Q / 2, 0.5);
  if (t === 0) door(s, -0.5, 1.05, 0.375, 0.75);
  return done(s, y0 + h + 0.5, [1.5, 1.5]);
}

/** A TO-92 transistor as a tower: a D-shaped black body on three legs, flat face to +z. */
function to92(s: Shape, x: number, z: number, legs: number, h: number): void {
  for (const dx of [-0.375, 0, 0.375]) s.box(0.25, legs, 0.25, "silver", x + dx, 0, z);
  s.box(1.25, h, 0.5, "black", x, legs, z);
  s.box(0.875, h, 0.375, "black", x, legs, z - 0.4375);
  s.box(0.5, h - 0.25, 0.25, "black", x, legs + 0.125, z - 0.6875);
  s.text("NPN", "grey", x, legs + h - 0.25, z + 0.25 + Q / 4, 0.5);
}

function transistorGatehouse(s: Shape, t: number): Built {
  plinth(s, 4.5, 2.5, "#C9C2B4");
  to92(s, -1.5, 0, 0.75, 2.0);
  to92(s, 1.5, 0, 0.75, 2.0);
  // the gate arch between them, with a portcullis of pins
  s.box(1.75, 0.5, 0.75, "charcoal", 0, 2.0, 0);
  s.box(1.75, Q, 0.875, "copper", 0, 2.5, 0);
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) s.box(Q, 0.75, Q, "silver", x, 1.25, 0.25);
  for (const sx of [-1, 1]) {
    s.box(0.25, 0.25, 0.25, "amber", sx * 0.75, 2.625, 0.375, { glow: true, day: "#D9962F" });
    s.light(sx * 0.75, 2.75, 0.375, "amber", 1.4);
  }
  let top = 2.9;
  if (t >= 1) {
    s.box(3.75, 1.75, 1.25, "cream", 0, 0.125, -1.375 + 0.25);
    s.roof(4.0, 1.5, 0.625, "charcoal", 0, 1.875, -1.125, 3);
    for (const x of [-0.75, 0.75]) s.window(0.375, 0.5, x, 0.875, -0.5);
    for (const sx of [-1, 1]) {
      s.box(Q, 1.25, Q, "steel", sx * 1.5, 2.75, 0);
      s.box(0.5, 0.375, Q / 2, sx < 0 ? "red" : "blue", sx * 1.5 + sx * 0.25, 3.5, 0);
    }
    top = 4.0;
  }
  return done(s, top, [2.25, 1.25]);
}

function sirenTower(s: Shape, t: number): Built {
  s.cyl(1.0, 0.25, "#C9C2B4", 0, 0, 0);
  if (t === 0) {
    s.box(0.25, 1.25, 0.25, "steel", 0, 0.25, 0);
    s.cyl(0.625, 0.75, "black", 0, 1.5, 0);
    s.cyl(0.25, Q, "charcoal", 0, 2.25, 0);
    s.box(Q, Q, Q, "white", 0, 2.375, 0);
    s.box(0.25, 0.25, Q, "red", 0.375, 1.75, 0.625);
    return done(s, 2.5, [1.125, 1.125]);
  }
  // a lattice tower with speakers facing out and a warning light
  const H = 3.5;
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) s.box(Q, H, Q, "steel", x, 0.25, z);
  for (let y = 0.75; y < H; y += 0.75) {
    s.box(1.0, Q, Q, "steel", 0, y, 0.5);
    s.box(1.0, Q, Q, "steel", 0, y, -0.5);
    s.box(Q, Q, 1.0, "steel", 0.5, y, 0);
    s.box(Q, Q, 1.0, "steel", -0.5, y, 0);
  }
  s.box(1.25, Q, 1.25, "charcoal", 0, H + 0.25, 0);
  for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0]] as const) {
    const x = dx * 0.6875;
    const z = dz * 0.6875;
    if (dz) {
      s.vdisc(0.5, 0.25, "black", x, H - 0.5, z);
      s.vdisc(0.375, Q, "grey", x, H - 0.5, z + 0.1875);
      s.vdisc(0.125, Q, "black", x, H - 0.5, z + 0.25);
    } else {
      s.xdisc(0.5, 0.25, "black", x, H - 0.5, z);
      s.xdisc(0.375, Q, "grey", x + dx * 0.1875, H - 0.5, z);
    }
  }
  beacon(s, 0, H + 0.375, 0);
  return done(s, H + 0.8, [1.125, 1.125]);
}

// ---------------------------------------------------------------------------------------------------------------
// Making it permanent (Forge Isle).

const WOOD: Col = "#A07A4E";

/** A solder spool on its side on an axle between two posts: flanges of colour f and radius r, the axle at yc. */
function spoolOnStand(s: Shape, x: number, z: number, yc: number, r: number, f: Col): void {
  for (const sx of [-1, 1]) {
    s.box(0.25, Q, 0.625, "charcoal", x + sx * 0.625, 0.125, z);
    s.box(Q, yc - 0.0625, 0.25, "steel", x + sx * 0.625, 0.25, z);
    s.xdisc(r, Q, f, x + sx * 0.4375, yc, z);
  }
  for (let i = 0; i < 6; i++) s.xdisc(r - 0.125, Q, i % 2 ? "#BAC1C9" : "silver", x - 0.3125 + i * Q, yc, z);
  s.box(1.5, Q, Q, "steel", x, yc - Q / 2, z);
}

function solderForge(s: Shape, t: number): Built {
  plinth(s, 4.25, 3.0, "#BFB8AA");
  // the workshop: brick walls (a second storey for the great forge), a slate roof and a chimney that grows with it
  const wh = t >= 2 ? 2.25 : 1.5;
  s.box(2.25, wh, 1.75, "#C76B3B", -0.75, 0.125, -0.25);
  s.roof(2.5, 2.0, 0.625, "charcoal", -0.75, wh + 0.125, -0.25, 3);
  door(s, -1.375, 0.625, 0.5, 0.875);
  if (t >= 2) {
    s.box(2.375, Q, 1.875, "#A85A30", -0.75, 1.625, -0.25);
    for (const x of [-1.375, -0.375]) s.window(0.375, 0.375, x, 1.875, 0.625);
    s.window(0.375, 0.375, 0.375 + Q / 2, 1.875, -0.25, 1);
  }
  const ch = t >= 2 ? 2.25 : 1.5;
  s.box(0.5, ch, 0.5, "#8E8579", -1.5, wh + 0.125, -0.75);
  if (t >= 2) for (const y of [wh + 1.0, wh + 1.75]) s.box(0.625, Q, 0.625, "copper", -1.5, y, -0.75);
  s.smoke.push([-1.5, wh + 0.25 + ch, -0.75]);
  if (t >= 1) {
    // the hearth: the forge's mouth glows through the front wall
    s.box(1.0, 0.75, Q, "#5A4A3A", -0.375, 0.25, 0.625);
    s.box(0.75, 0.5, Q, "orange", -0.375, 0.3125, 0.6875, { glow: true, day: "#CF6A30" });
    s.light(-0.375, 0.6, 0.85, "orange", 2.4);
    s.window(0.375, 0.25, -0.375, 1.25, 0.625);
  } else s.window(0.5, 0.375, -0.375, 0.75, 0.625);
  // the anvil in the yard, its face a solder pad: a copper square round a bright bead
  const ax = -0.375;
  const az = 1.125;
  s.box(0.5, Q, 0.375, "charcoal", ax, 0.125, az);
  s.box(0.25, 0.25, 0.25, "charcoal", ax, 0.25, az);
  s.box(0.75, 0.1875, 0.375, "charcoal", ax, 0.5, az);
  s.box(0.25, Q, 0.25, "charcoal", ax + 0.5, 0.5625, az);
  s.box(0.25, Q / 2, 0.25, "copper", ax, 0.6875, az);
  s.box(Q, Q / 2, Q, "silver", ax, 0.75, az);
  // the iron in its coil stand, its tip glowing; the great forge's iron is a tower over the yard
  const ix = 1.25;
  const iz = 0.5;
  const big = t >= 2;
  const turns = big ? 8 : 4;
  const hh = big ? 2.25 : 1.25;
  s.box(big ? 1.0 : 0.75, 0.25, big ? 1.0 : 0.75, "charcoal", ix, 0.125, iz);
  for (let i = 0; i < turns; i++) s.cyl(big ? 0.375 : 0.25, Q / 2, "silver", ix, 0.5 + i * 0.25, iz);
  if (big) s.box(Q, 2.0, Q, "steel", ix - 0.375, 0.375, iz - 0.375);
  s.box(0.25, hh, 0.25, "yellow", ix, 0.75, iz);
  if (big) for (const y of [1.25, 2.0]) s.box(0.375, Q, 0.375, "ink", ix, y, iz);
  s.box(Q, 0.5, Q, "silver", ix, 0.25, iz);
  s.box(Q, 0.375, Q, "steel", ix, 0.625 + hh, iz);
  s.box(big ? 0.25 : Q, big ? 0.25 : Q, big ? 0.25 : Q, "orange", ix, 0.75 + hh, iz, { glow: true, day: "#C66A2A" });
  s.light(ix, 0.85 + hh, iz, "orange", big ? 2.2 : 1.4);
  s.smoke.push([ix, 0.95 + hh, iz]);
  // solder: a small spool, then a big one on a stand
  if (t >= 1) spoolOnStand(s, 1.125, -0.875, 0.875, 0.75, "red");
  else {
    s.cyl(0.375, 0.375, "silver", 1.25, 0.125, -0.75);
    s.cyl(0.125, 0.5, "charcoal", 1.25, 0.125, -0.75);
  }
  let top = 3.0;
  if (t >= 2) {
    // a quench trough by the door, and a lamp post over the yard
    s.box(0.875, 0.375, 0.5, "#8E8579", -1.375, 0.125, 1.125);
    s.box(0.625, Q / 2, 0.25, "#6FA8C8", -1.375, 0.4375, 1.125);
    s.box(Q, 1.75, Q, "steel", 0.625, 0.125, 1.25);
    s.box(0.375, Q, 0.375, "charcoal", 0.625, 1.875, 1.25);
    s.box(0.25, 0.25, 0.25, "warm", 0.625, 1.625, 1.25, { glow: true, day: "#E8D6A8" });
    s.light(0.625, 1.75, 1.25, "warm", 1.8);
    top = 4.7;
  }
  return done(s, top, [2.125, 1.5]);
}

/** A steel lattice tower from y = 0.125 to h: four legs leaning in from w0 apart to w1, ringed every half unit. */
function lattice(s: Shape, x: number, z: number, h: number, w0: number, w1: number, col: Col = "steel"): void {
  for (let i = 0, y = 0.125; y < h; i++, y += 0.25) {
    const w = w0 + ((w1 - w0) * y) / h;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) s.box(Q, 0.25, Q, col, x + (dx * w) / 2, y, z + (dz * w) / 2);
    if (i % 2 === 1) {
      for (const sz of [-1, 1]) s.box(w, Q, Q, col, x, y, z + (sz * w) / 2);
      for (const sx of [-1, 1]) s.box(Q, Q, w, col, x + (sx * w) / 2, y, z);
    }
  }
}

/**
 * A cable hung along x from (x0, y0) to (x1, y1) at depth z, sagging by `sag` in the middle, drawn as one unbroken
 * run of 1/8 steps. Heat-shrink sleeves sit on it at the given fractions of its length.
 */
function cable(s: Shape, x0: number, y0: number, x1: number, y1: number, z: number, sag: number, col: Col, sleeves: [number, Col][] = []): void {
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / Q));
  const yAt = (k: number) => y0 + (y1 - y0) * k - sag * 4 * k * (1 - k);
  for (let i = 0; i < n; i++) {
    const a = yAt(i / n);
    const b = yAt((i + 1) / n);
    s.box(Q, Math.abs(b - a) + Q / 2, Q, col, x0 + (x1 - x0) * ((i + 0.5) / n), Math.min(a, b) - Q / 4, z);
  }
  for (const [k, c] of sleeves) s.slab(0.25, 0.1875, 0.1875, c, x0 + (x1 - x0) * k, yAt(k) - 0.09375, z);
}

/** A ceramic insulator hanging from an arm at y: two white sheds. */
function insulator(s: Shape, x: number, y: number, z: number): void {
  s.box(Q, 0.375, Q, "cream", x, y - 0.375, z);
  for (const yy of [y - 0.1875, y - 0.375]) s.box(0.25, Q / 2, 0.25, "white", x, yy, z);
}

function cablePylon(s: Shape, t: number): Built {
  const big = t >= 1;
  plinth(s, 3.75, 3.0);
  // the pylon at one end, a wooden pole at the other, cables strung between them
  const px = -1.0;
  const pz = -0.375;
  const H = big ? 4.0 : 3.0;
  lattice(s, px, pz, H, 1.0, 0.375);
  s.box(0.5, Q, 0.5, "steel", px, H, pz);
  const qx = 1.375;
  const P = big ? 2.25 : 1.75;
  s.box(0.25, P, 0.25, WOOD, qx, 0.125, pz);
  const pairs: [number, number, number, Col, Col][] = [[H - 0.25, P - 0.125, 0.75, "red", "ink"]];
  if (big) pairs.push([H - 1.0, P - 0.625, 1.125, "yellow", "blue"]);
  for (const [ay, by, half, c0, c1] of pairs) {
    s.box(Q, Q, 2 * half + Q, "steel", px, ay, pz);
    s.box(Q, Q, 2 * half + Q, WOOD, qx, by, pz);
    for (const sz of [-1, 1]) {
      insulator(s, px, ay, pz + sz * half);
      insulator(s, qx, by, pz + sz * half);
      const sleeves: [number, Col][] = sz > 0 ? [[0.3, "orange"], [0.7, "orange"]] : [[0.5, "blue"]];
      cable(s, px, ay - 0.5, qx, by - 0.5, pz + sz * half, 0.35, sz > 0 ? c0 : c1, big ? sleeves : sleeves.slice(0, 1));
    }
  }
  // the regulator hut at the pole's foot: steady 5 V, its lamp says so
  const hx = 0.625;
  const hz = 0.875;
  s.box(1.125, 0.75, 0.75, "cream", hx, 0.125, hz);
  s.roof(1.375, 1.0, 0.375, "charcoal", hx, 0.875, hz, 2);
  s.box(0.625, 0.4375, Q, "navy", hx - 0.125, 0.25, hz + 0.375);
  s.text("5V", "white", hx - 0.125, 0.625, hz + 0.4375, 0.5);
  s.box(Q, Q, Q, "ledGreen", hx + 0.375, 0.5, hz + 0.4375, { glow: true, day: "#3FB45A" });
  s.light(hx + 0.375, 0.55, hz + 0.5, "ledGreen", 1.2);
  s.box(Q, P - 1.0, Q, "red", qx - 0.1875, 0.875, pz + 0.125);
  if (big) {
    // the wall adapter that feeds it, its prongs up, its cord across the yard; a beacon on the pylon
    s.box(0.875, 0.75, 0.75, "black", 0.375, 0.125, -1.0);
    s.box(0.875, Q, 0.75, "charcoal", 0.375, 0.875, -1.0);
    for (const x of [0.1875, 0.5625]) s.box(Q, 0.375, 0.25, "silver", x, 1.0, -1.0);
    s.text("12V", "white", 0.375, 0.6875, -0.625, 0.5);
    s.box(Q, Q, 1.0, "ink", 0.375, 0.125, 0.0);
    beacon(s, px, H + Q, pz);
  }
  return done(s, H + (big ? 0.5 : 0.25), [1.875, 1.5]);
}

function perfboardPier(s: Shape, t: number): Built {
  // a brown perfboard deck on posts, holes in a grid, a few parts soldered on
  for (const [x, z] of [[-1.75, -1.0], [1.75, -1.0], [-1.75, 1.0], [1.75, 1.0], [0, -1.0], [0, 1.0]] as const) s.box(0.25, 0.75, 0.25, "#8E7A5A", x, 0, z);
  s.box(4.25, 0.25, 2.5, "#B88A4E", 0, 0.75, 0);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) s.slab(Q, Q / 4, Q, "#6E5434", -1.75 + i * 0.5, 1.0, -0.75 + j * 0.5);
  s.xdisc(0.25, 0.75, "beige", -0.75, 1.375, 0.25);
  s.cyl(0.375, 0.75, "navy", 1.0, 1.0, -0.25);
  s.cyl(0.375, Q, "silver", 1.0, 1.75, -0.25);
  s.box(0.25, 0.75, Q, "#D7DCE6", 1.0, 1.0, 0.0625);
  s.box(0.75, 0.375, 0.5, "black", 0.25, 1.0, 0.75);
  s.flatText("555", "white", 0.25, 1.375, 0.75, 0.5);
  // every joint shining: solder on the pads round the parts
  for (const [x, z] of [[-1.25, 0.25], [-0.25, 0.25], [0.75, 0.25], [1.25, -0.75], [-1.25, -0.75], [-0.25, 0.75], [0.75, 0.75]] as const) s.slab(0.1875, Q / 2, 0.1875, "silver", x, 1.0, z);
  s.box(Q, 0.75, Q, "silver", -1.5, 1.0, -0.5);
  s.box(0.25, 0.25, 0.25, "ledGreen", -1.5, 1.75, -0.5, { glow: true, day: "#3FB45A" });
  s.light(-1.5, 1.85, -0.5, "ledGreen", 1.5);
  let top = 2.0;
  if (t >= 1) {
    // a railing of header pins along the back, lamps at the far end, and the robot's blinker on a post
    s.box(4.0, 0.25, 0.25, "black", 0, 1.0, -1.125);
    for (let i = 0; i < 16; i++) s.box(Q, 0.375, Q, "gold", -1.875 + i * 0.25, 1.25, -1.125);
    for (const z of [-0.875, 0.875]) {
      s.box(Q, 1.25, Q, "steel", 1.875, 1.0, z);
      s.box(0.25, 0.25, 0.25, "warm", 1.875, 2.25, z, { glow: true, day: "#E8D6A8" });
      s.light(1.875, 2.4, z, "warm", 1.6);
    }
    s.box(Q, 1.5, Q, "steel", -0.375, 1.0, -0.5);
    s.box(0.5, 0.25, 0.25, "charcoal", -0.375, 2.5, -0.5);
    s.box(0.25, 0.25, 0.25, "ledRed", -0.5625, 2.75, -0.5, { glow: true, day: "#C0392F" });
    s.box(0.25, 0.25, 0.25, "#4FA85E", -0.1875, 2.75, -0.5);
    s.light(-0.5625, 2.9, -0.5, "ledRed", 1.6);
    // a ladder down the front, to the clouds
    for (let y = 0.125; y < 0.75; y += 0.1875) s.box(0.5, Q / 2, Q, "#8E7A5A", 0.75, y, 1.3125);
    for (const sx of [-1, 1]) s.box(Q, 0.875, Q, "#8E7A5A", 0.75 + sx * 0.25, 0, 1.3125);
    top = 3.1;
  }
  return done(s, top, [2.25, 1.375]);
}

// ---------------------------------------------------------------------------------------------------------------
// Chips (Silicon Isle).

/** A DIP chip as a building: black body, silver legs bent down to the board, white text on top. */
function dip(s: Shape, w: number, d: number, h: number, legs: number, label: string, y = 0): void {
  s.box(w, h, d, "black", 0, y + 0.375, 0);
  s.box(w, Q / 2, d, "charcoal", 0, y + 0.375 + h, 0);
  for (let i = 0; i < legs; i++) {
    const x = -w / 2 + (w / legs) * (i + 0.5);
    for (const sz of [-1, 1]) {
      s.box(0.25, Q, 0.375, "silver", x, y + 0.5, sz * (d / 2 + 0.125));
      s.box(0.25, y + 0.5, Q, "silver", x, 0, sz * (d / 2 + 0.25));
      s.pads.push([x, sz * (d / 2 + 0.25)]);
    }
  }
  s.flatText(label, "white", 0.25, y + 0.4375 + h, 0, 1);
  s.cyl(0.125, Q / 4, "charcoal", -w / 2 + 0.375, y + 0.4375 + h, -d / 2 + 0.375);
}

/** A clock face on a wall facing +z, centred at height yc: white, a rim, two hands. */
function clockFace(s: Shape, x: number, yc: number, z: number, r = 0.375): void {
  s.vdisc(r + Q, Q, "charcoal", x, yc, z);
  s.vdisc(r, Q, "white", x, yc, z + Q / 2);
  s.box(Q, r * 0.75, Q / 2, "ink", x, yc, z + Q);
  s.box(r * 0.625, Q, Q / 2, "ink", x + (r * 0.625) / 2, yc, z + Q);
}

function timerFactory(s: Shape, t: number): Built {
  dip(s, 3.5, 2.0, 1.25, 4, "555");
  for (const x of [-1.0, 1.0]) s.window(0.5, 0.375, x, 0.875, 1.0);
  door(s, 0, 1.0, 0.625, 0.875);
  // chimneys
  const stacks: [number, number, number][] = [[1.25, 1.25, -0.5], [0.75, 0.875, -0.5]];
  if (t >= 1) stacks.push([1.25, 1.75, 0.25]);
  for (const [x, h, z] of stacks) {
    s.cyl(0.25, h, "#8E8579", x, 1.6875, z);
    s.cyl(0.25, Q, "red", x, 1.6875 + h - Q, z);
    s.smoke.push([x, 1.8 + h, z]);
  }
  s.box(0.25, 0.25, Q, "ledGreen", -1.5, 1.25, 1.0, { glow: true, day: "#3FB45A" });
  s.light(-1.5, 1.35, 1.05, "ledGreen", 1.0);
  let top = 3.2;
  if (t >= 1) {
    // the clock tower on the roof's back corner: the factory keeps the island's time
    const cx = -1.125;
    const cz = -0.5;
    s.box(0.875, 1.75, 0.875, "black", cx, 1.6875, cz);
    s.box(1.0, Q, 1.0, "silver", cx, 3.4375, cz);
    clockFace(s, cx, 2.875, cz + 0.4375);
    s.xdisc(0.375, Q, "charcoal", cx + 0.4375 + Q / 2, 2.875, cz);
    s.xdisc(0.25, Q, "white", cx + 0.5 + Q / 2, 2.875, cz);
    s.box(Q, 0.1875, Q / 2, "ink", cx + 0.5 + Q, 2.875, cz);
    s.roof(1.0, 1.0, 0.5, "charcoal", cx, 3.5625, cz, 2);
    beacon(s, cx, 4.0625, cz, "ledGreen");
    top = 4.5;
  }
  return done(s, top, [2.25, 1.75]);
}

function alarmLighthouse(s: Shape, t: number): Built {
  // it stands on a 555: a black chip for a plinth, its legs down the sides, its number on the front
  s.box(3.0, 0.5, 2.25, "black", 0, 0, 0);
  for (let i = 0; i < 4; i++)
    for (const sz of [-1, 1]) {
      const x = -1.125 + i * 0.75;
      s.box(0.25, Q, 0.25, "silver", x, 0.3125, sz * 1.1875);
      s.box(0.25, 0.4375, Q, "silver", x, 0, sz * 1.3125);
    }
  s.flatText("555", "white", 0.875, 0.5, -0.625, 0.75);
  // the tower: warning bands of yellow and charcoal
  const tx = -0.375;
  const H = [2.0, 3.0, 4.0][Math.min(2, t)]!;
  const bands = Math.round(H / 0.5);
  for (let i = 0; i < bands; i++) s.cyl(i < 2 ? 0.75 : 0.625, 0.5, i % 2 ? "charcoal" : "yellow", tx, 0.5 + i * 0.5, 0);
  s.box(0.5, 0.75, Q, "#5A4A3A", tx, 0.5, 0.75);
  s.box(0.375, 0.6875, Q, "charcoal", tx, 0.5, 0.8125);
  for (let y = 1.75; y < H; y += 1.0) s.window(0.25, 0.375, tx, 0.5 + y, 0.625);
  const y0 = 0.5 + H;
  // the gallery and the alarm lamp in its cage: a red LED, asleep by day, bright at night
  s.cyl(0.875, Q, "steel", tx, y0, 0);
  for (const [dx, dz] of [[-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]] as const) s.box(Q, 0.25, Q, "steel", tx + dx, y0 + Q, dz);
  s.cyl(0.375, 0.5, "ledRed", tx, y0 + Q, 0, { glow: true, day: "#A8433A" });
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) s.box(Q, 0.5, Q, "charcoal", tx + dx * 0.375, y0 + Q, dz * 0.375);
  s.cone(0.5, 0.375, "charcoal", tx, y0 + 0.625, 0, 2);
  s.box(Q, 0.25, Q, "steel", tx, y0 + 1.0, 0);
  s.light(tx, y0 + 0.4, 0, "ledRed", t === 0 ? 3.0 : 4.2);
  if (t >= 1) {
    // two horns under the gallery, calling over the island
    for (const side of [0, 1] as const) {
      const hy = y0 - 0.5;
      if (side === 0) {
        s.box(0.25, 0.25, 0.25, "charcoal", tx + 0.3125, hy, 0.6875);
        s.vdisc(0.25, Q, "black", tx + 0.3125, hy + 0.125, 0.875);
        s.vdisc(0.125, Q, "grey", tx + 0.3125, hy + 0.125, 0.9375);
      } else {
        s.box(0.25, 0.25, 0.25, "charcoal", tx + 0.6875, hy, -0.3125);
        s.xdisc(0.25, Q, "black", tx + 0.875, hy + 0.125, -0.3125);
        s.xdisc(0.125, Q, "grey", tx + 0.9375, hy + 0.125, -0.3125);
      }
    }
  }
  if (t >= 2) {
    // the keeper's cottage, its door ajar: the reed switch on the frame, the magnet on the door
    const cx = 0.875;
    const cz = 0.25;
    s.box(1.0, 0.75, 1.0, "cream", cx, 0.5, cz);
    s.roof(1.25, 1.25, 0.375, "charcoal", cx, 1.25, cz, 2);
    s.box(0.375, 0.625, Q, "charcoal", cx - 0.125, 0.5, cz + 0.5);
    s.box(Q, 0.625, 0.375, "#9A6A44", cx - 0.3125, 0.5, cz + 0.6875);
    s.box(Q, 0.25, Q, "red", cx - 0.3125, 0.75, cz + 0.875);
    s.box(Q, 0.375, Q, "glass", cx + 0.125, 0.75, cz + 0.5625);
    s.window(0.25, 0.25, cx + 0.5 + Q / 2, 0.75, cz, 1);
  }
  return done(s, y0 + 1.3, [1.5, 1.25]);
}

function counterBillboard(s: Shape, t: number): Built {
  const big = t >= 1;
  const W = big ? 3.75 : 3.25;
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.375);
    s.box(0.25, 2.0, 0.25, "steel", x, 0, -0.25);
    if (big) {
      s.box(0.25, 2.0, 0.25, "steel", x, 0, -0.75);
      for (const y of [0.5, 1.25]) s.box(Q, Q, 0.5, "steel", x, y, -0.5);
    }
  }
  s.box(W, 2.0, 0.5, "charcoal", 0, 1.75, -0.25);
  s.box(W - 0.25, 1.75, Q, "ink", 0, 1.875, 0.0625);
  const digits = big ? [1, 2, 8] : [4, 2];
  digits.forEach((d, i) => sevenSeg(s, d, (i - (digits.length - 1) / 2) * 1.0, 3.4375, 0.125));
  s.box(Q, Q, Q, "ledRed", W / 2 - 0.5, 2.125, 0.125, { glow: true, day: "#C0392F" });
  s.light(0, 2.8, 0.4, "ledRed", 3.2);
  s.box(W + 0.25, Q, 0.75, "steel", 0, 3.75, -0.25);
  const lamps = big ? [-1.5, -0.5, 0.5, 1.5] : [-1.25, 1.25];
  for (const x of lamps) {
    s.box(Q, 0.25, Q, "steel", x, 3.875, 0.125);
    s.box(0.25, Q, 0.25, "warm", x, 4.0, 0.25, { glow: true, day: "#E8D6A8" });
  }
  if (big) {
    // a ticket booth under the board, its awning striped
    s.box(0.875, 0.875, 0.625, "cream", 0.75, 0, 0.625);
    s.window(0.5, 0.25, 0.75, 0.5, 0.9375);
    for (let i = 0; i < 4; i++) s.box(0.25, Q, 0.375, i % 2 ? "white" : "red", 0.375 + i * 0.25, 0.875, 1.0);
    s.light(0.75, 0.6, 1.1, "warm", 1.2);
  }
  return done(s, 4.3, [1.75, 0.75]);
}

function logicCastle(s: Shape, t: number): Built {
  plinth(s, 5.0, 5.0, "#A8A296");
  // walls: the front one first, the rest as the castle grows
  const walls: [number, number, number, number][] = [[0, 2, 4, 0.5]];
  if (t >= 1) walls.push([0, -2, 4, 0.5], [-2, 0, 0.5, 4], [2, 0, 0.5, 4]);
  else walls.push([-2, 1.0, 0.5, 2], [2, 1.0, 0.5, 2]);
  for (const [x, z, w, d] of walls) {
    s.box(w, 1.25, d, "charcoal", x, 0.125, z);
    for (let i = -w / 2 + 0.25; i < w / 2; i += 0.5) if (w > 1) s.box(0.25, 0.25, d, "silver", x + i, 1.375, z);
    for (let i = -d / 2 + 0.25; i < d / 2; i += 0.5) if (d > 1) s.box(w, 0.25, 0.25, "silver", x, 1.375, z + i);
  }
  // corner towers: chips standing up
  const towers: [number, number][] = t >= 1 ? [[-2, -2], [2, -2], [-2, 2], [2, 2]] : [[-2, 2], [2, 2]];
  for (const [x, z] of towers) {
    s.box(1.0, 2.25, 1.0, "black", x, 0.125, z);
    s.box(1.125, Q, 1.125, "silver", x, 2.375, z);
    for (const dx of [-0.375, 0.375]) for (const dz of [-0.375, 0.375]) s.box(0.25, 0.25, 0.25, "black", x + dx, 2.5, z + dz);
    s.window(0.25, 0.375, x, 1.25, z + 0.5);
  }
  // the keep
  s.box(1.75, 2.75, 1.75, "black", 0, 0.125, -0.25);
  s.flatText("OR", "white", 0, 2.875, -0.25, 1);
  s.box(Q, 1.0, Q, "steel", 0.5, 2.875, -0.75);
  s.box(0.625, 0.375, Q / 2, "blue", 0.8125, 3.5, -0.75);
  s.window(0.375, 0.5, -0.375, 1.5, 0.625);
  s.window(0.375, 0.5, 0.375, 1.5, 0.625);
  door(s, 0, 2.25, 0.75, 1.0);
  s.box(0.25, 0.25, Q, "ledRed", 0, 2.375, 0.625, { glow: true, day: "#B9443A" });
  s.light(0, 2.5, 0.7, "ledRed", 1);
  let top = 4.0;
  if (t >= 2) {
    // banners of one and nought on the towers, lanterns at the gate, a copper drawbridge
    ([[-2, -2, "1"], [2, -2, "0"], [-2, 2, "0"], [2, 2, "1"]] as const).forEach(([x, z, bit]) => {
      s.box(Q, 1.0, Q, "steel", x, 2.75, z);
      s.box(0.5, 0.5, Q / 2, bit === "1" ? "red" : "blue", x + 0.3125, 3.25, z);
      s.text(bit, "white", x + 0.3125, 3.6875, z + Q / 2, 0.5);
    });
    for (const sx of [-1, 1]) {
      s.box(0.25, 0.25, 0.25, "amber", sx * 0.625, 1.5, 2.3125, { glow: true, day: "#D9962F" });
      s.light(sx * 0.625, 1.6, 2.4, "amber", 1.4);
    }
    s.box(0.75, Q / 2, 0.625, "copper", 0, 0.125, 2.5625);
    top = 4.3;
  }
  return done(s, top, [2.5, 2.5]);
}

function diceArcade(s: Shape, t: number): Built {
  plinth(s, 4.0, 3.0, "#C9C2B4");
  s.box(3.25, 1.5, 2.0, "violet", 0, 0.125, -0.25);
  s.box(3.5, Q, 2.25, "#6A3FA0", 0, 1.625, -0.25);
  door(s, 0, 0.75, 0.75, 1.0);
  for (const sx of [-1, 1]) s.window(0.625, 0.5, sx * 1.0625, 0.75, 0.75);
  // a glowing sign and two dice on the roof
  s.box(2.25, 0.375, Q, "ledYellow", 0, 1.25, 0.8125, { glow: true, day: "#E0B93A" });
  s.light(0, 1.45, 0.9, "ledYellow", 2);
  die(s, -0.75, 1.75, -0.25, 1.0, 5, 1, 3);
  die(s, 0.75, 1.75, -0.5, 1.0, 3, 2, 6);
  s.light(0, 2.6, 0.4, "ledRed", 2.4);
  if (t >= 1) {
    // bulbs round the roof's edge, and a big die on a pedestal by the door
    for (let i = 0; i < 7; i++) {
      const x = -1.5 + i * 0.5;
      s.box(Q, Q, Q, "warm", x, 1.5, 0.9375, { glow: true, day: "#F0E2B8" });
    }
    s.light(-1.0, 1.6, 1.0, "warm", 1.4);
    s.light(1.0, 1.6, 1.0, "warm", 1.4);
    s.box(0.875, 0.375, 0.875, "#6A3FA0", 1.375, 0.125, 1.0);
    die(s, 1.375, 0.5, 1.0, 0.75, 6, 4, 5);
  }
  return done(s, 2.9, [2.0, 1.5]);
}

// ---------------------------------------------------------------------------------------------------------------
// Beyond (Signal Isle).

function coilWindmill(s: Shape, t: number): Built {
  const big = t >= 1;
  s.cyl(1.0, 0.25, "#C9C2B4", 0, 0, 0);
  // the tower is a coil: copper windings on a dark former
  const rings = big ? 16 : 12;
  for (let i = 0; i < rings; i++) s.cyl(0.625, 0.25, i % 2 ? "copperDark" : "copper", 0, 0.25 + i * 0.25, 0);
  const H = 0.25 + rings * 0.25;
  s.cyl(0.75, 0.25, "charcoal", 0, H, 0);
  s.roof(1.25, 1.25, 0.5, "charcoal", 0, H + 0.25, 0, 2);
  door(s, 0, 0.625, 0.375, 0.75);
  // a hub and four blades facing +z
  const hy = H - 0.25;
  const L = big ? 8 : 6;
  s.box(0.375, 0.375, 0.5, "steel", 0, hy, 0.875);
  for (let i = 1; i <= L; i++) {
    const k = i * 0.25;
    s.box(0.25, 0.25, Q, "white", 0, hy + 0.0625 + k, 1.125);
    s.box(0.25, 0.25, Q, "white", 0, hy + 0.0625 - k, 1.125);
    s.box(0.25, 0.25, Q, "white", k, hy + 0.0625, 1.125);
    s.box(0.25, 0.25, Q, "white", -k, hy + 0.0625, 1.125);
  }
  const tip = L * 0.25;
  for (const [x, y] of [[0.25, hy + 0.0625 + tip], [-0.25, hy + 0.0625 - tip], [tip, hy + 0.0625 - 0.25], [-tip, hy + 0.0625 + 0.25]] as const) s.box(0.25, 0.25, Q, "red", x, y, 1.125);
  let top = H + 0.9;
  if (big) {
    // a generator shed beside it, a magnet on its roof, its lamp lit by the wind
    s.box(1.0, 0.75, 0.875, "cream", 1.375, 0.25, -0.375);
    s.roof(1.25, 1.125, 0.375, "charcoal", 1.375, 1.0, -0.375, 2);
    s.window(0.25, 0.25, 1.375 + 0.5 + Q / 2, 0.5, -0.375, 1);
    s.box(0.25, 0.25, 0.25, "warm", 1.375, 0.75, 0.125, { glow: true, day: "#E8D6A8" });
    s.light(1.375, 0.85, 0.2, "warm", 1.8);
    for (const sx of [-1, 1]) s.box(0.25, 0.375, 0.25, "red", 1.375 + sx * 0.25, 1.375, -0.375);
    s.box(0.75, 0.125, 0.25, "red", 1.375, 1.375, -0.375);
    for (const sx of [-1, 1]) s.box(0.25, Q, 0.25, "silver", 1.375 + sx * 0.25, 1.75, -0.375);
    s.box(0.75, Q, Q, "copper", 0.75, 0.375, -0.375);
    top = H + 1.0;
  }
  return done(s, top, [1.25, 1.25]);
}

function radioMast(s: Shape, t: number): Built {
  plinth(s, 3.0, 3.0, "#BFB8AA");
  const H = [3.5, 5.0, 6.5][Math.min(2, t)]!;
  // a lattice mast, narrowing, in red and white
  for (let y = 0.125; y < H; y += 0.5) {
    const w = 0.75 - (y / H) * 0.375;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) s.box(Q, 0.5, Q, "red", (dx * w) / 2, y, (dz * w) / 2);
    s.box(w, Q, Q, y % 1 < 0.5 ? "white" : "red", 0, y, w / 2);
    s.box(Q, Q, w, y % 1 < 0.5 ? "white" : "red", w / 2, y, 0);
  }
  // the radio hut at its foot
  s.box(1.0, 0.75, 0.75, "cream", -0.875, 0.125, 0.875);
  s.roof(1.25, 1.0, 0.25, "charcoal", -0.875, 0.875, 0.875, 2);
  s.window(0.25, 0.25, -0.875, 0.5, 1.25);
  if (t >= 1) {
    // guy wires to four anchors, and a dish
    for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]] as const) {
      s.box(0.25, 0.25, 0.25, "charcoal", x, 0.125, z);
      for (let i = 2; i < 24; i++) s.box(Q, Q / 2, Q, "#AEB4BC", (x * (24 - i)) / 24, 0.25 + (i * (H * 0.6)) / 24, (z * (24 - i)) / 24);
    }
    s.box(0.75, Q, Q, "white", 0, 3.5, 0.375);
    s.box(0.625, 0.625, Q, "white", 0, 3.25, 0.4375);
  }
  if (t >= 2) {
    // a second dish facing the other way, and a cross arm of aerials near the top
    s.box(Q, 0.625, 0.625, "white", 0.4375, 4.25, 0);
    s.box(Q, Q, 0.75, "white", 0.375, 4.5, 0);
    s.box(Q, Q, 1.5, "steel", 0, H - 0.75, 0);
    for (const sz of [-1, 1]) s.box(Q, 0.5, Q, "steel", 0, H - 0.75, sz * 0.75);
  } else if (t === 0) {
    // a long wire from the mast down to the hut
    for (let i = 1; i < 12; i++) s.box(Q, Q / 2, Q, "#8C9198", -0.0625 - (i * 0.75) / 12, H - 0.5 - (i * (H - 1.5)) / 12, (i * 0.75) / 12);
  }
  beacon(s, 0, H, 0);
  return done(s, H + 0.4, [1.5, 1.5]);
}

function microcontrollerHq(s: Shape, t: number): Built {
  // a blue board raised on standoffs, a square chip, headers along both edges, a USB port and status LEDs
  for (const [x, z] of [[-2, -1.25], [2, -1.25], [-2, 1.25], [2, 1.25]] as const) s.box(0.25, 0.75, 0.25, "gold", x, 0, z);
  s.box(4.75, 0.25, 3.0, "#1F6FB8", 0, 0.75, 0);
  for (const sz of [-1, 1]) {
    s.box(3.5, 0.375, 0.25, "black", 0, 1.0, sz * 1.25);
    for (let i = 0; i < 14; i++) s.box(Q, 0.25, Q, "gold", -1.625 + i * 0.25, 1.375, sz * 1.25);
  }
  s.box(1.75, 0.5, 1.75, "ink", 0.25, 1.0, 0);
  for (let i = 0; i < 6; i++) {
    const k = -0.625 + i * 0.25;
    s.box(Q, Q, 0.25, "silver", 0.25 + k, 1.0, 1.0);
    s.box(Q, Q, 0.25, "silver", 0.25 + k, 1.0, -1.0);
    s.box(0.25, Q, Q, "silver", 1.25, 1.0, k);
    s.box(0.25, Q, Q, "silver", -0.75, 1.0, k);
  }
  s.flatText("MCU", "#9AA6B4", 0.25, 1.5, 0, 0.75);
  s.box(0.875, 0.5, 0.75, "silver", -2.125, 1.0, 0);
  s.box(0.5, 0.25, Q, "ink", -2.125, 1.125, 0.375);
  s.box(0.625, 0.375, 0.625, "black", -1.25, 1.0, 0.375);
  s.vdisc(0.125, Q, "red", -1.25, 1.25, 0.6875);
  for (const [x, c, d] of [[1.75, "ledGreen", "#3FB45A"], [2.0, "amber", "#D9962F"]] as const) {
    s.box(Q, Q, Q, c, x, 1.0, 0.75, { glow: true, day: d });
    s.light(x, 1.1, 0.75, c, 1.1);
  }
  // the office inside: windows under the board
  s.box(3.25, 0.75, 1.75, "cream", 0.25, 0, 0);
  for (const x of [-0.75, 0.25, 1.25]) s.window(0.5, 0.375, x, 0.25, 0.875);
  let top = 2.0;
  if (t >= 1) {
    // an LED matrix on the roof, smiling, and an aerial
    const mx = 0.25;
    const my = 2.0;
    for (const sx of [-1, 1]) s.box(Q, 0.5, Q, "steel", mx + sx * 0.625, 1.5, -0.25);
    s.box(1.5, 1.375, 0.25, "ink", mx, my, -0.25);
    const face = ["0010100", "0010100", "0000000", "1000001", "0111110"];
    face.forEach((row, r) =>
      [...row].forEach((on, c) => {
        if (on === "1") s.slab(0.1875, 0.1875, Q / 2, "ledRed", mx - 0.5625 + c * 0.1875, my + 1.0 - r * 0.1875, -0.0625, { glow: true, day: "#C0392F" });
      }),
    );
    s.light(mx, my + 0.6, 0.1, "ledRed", 2.4);
    s.box(Q, 1.25, Q, "black", 1.75, 1.0, -0.75);
    s.box(0.25, Q, 0.25, "black", 1.75, 2.25, -0.75);
    top = 3.4;
  }
  return done(s, top, [2.5, 1.625]);
}

function ledSundial(s: Shape, t: number): Built {
  const big = t >= 1;
  // the stone dial on its steps, a cream face with hour marks
  let y = 0;
  if (big) {
    s.cyl(2.0, 0.25, "#B9B2A6", 0, 0, 0);
    y = 0.25;
  }
  s.cyl(1.75, 0.25, "#C9C2B4", 0, y, 0);
  s.cyl(1.375, Q / 2, "cream", 0, y + 0.25, 0);
  const fy = y + 0.3125;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s.slab(Q, Q / 4, Q, "#8E8579", Math.cos(a) * 1.125, fy, Math.sin(a) * 1.125);
  }
  // the gnomon: a stepped copper fin, and the shadow it throws on the face
  for (let i = 0; i < 6; i++) s.box(0.25, (6 - i) * 0.1875, Q, "copper", -0.5 + i * 0.25, fy, 0);
  s.slab(0.875, Q / 4, 0.25, "#9C9488", 0.375, fy, 0.375);
  // seven LEDs round the rim; one, the second hand, burns brighter
  const post = big ? 0.75 : 0.25;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
    const x = Math.cos(a) * 1.5;
    const z = Math.sin(a) * 1.5;
    const lead = i === 2;
    s.box(Q, post, Q, "steel", x, fy - Q / 2, z);
    s.box(0.25, 0.25, 0.25, lead ? "ledWhite" : "ledYellow", x, fy - Q / 2 + post, z, { glow: true, day: lead ? "#E8E2D0" : "#E0B93A" });
    s.light(x, fy + post + 0.1, z, lead ? "ledWhite" : "ledYellow", lead ? 2.0 : 1.3);
  }
  let top = fy + post + 0.5;
  if (big) {
    // the timekeeper: a pillar with a clock display, beside the dial
    s.box(0.75, 1.5, 0.5, "charcoal", 1.375, y + 0.25, -1.375);
    s.box(0.625, 0.375, Q, "lcdLit", 1.375, y + 1.25, -1.0625, { glow: true, day: "lcd" });
    s.text("12", "ink", 1.375, y + 1.5625, -1.0, 0.5);
    s.box(0.875, Q, 0.625, "copper", 1.375, y + 1.75, -1.375);
    top = Math.max(top, y + 2.0);
  }
  return done(s, top, [1.875, 1.875]);
}

export function buildLandmark(s: Shape, kind: string, tier: number): Built {
  switch (kind) {
    case "spark-gap":
      return sparkGap(s, tier);
    case "pump-house":
      return pumpHouse(s, tier);
    case "meter-tower":
      return meterTower(s, tier);
    case "resistor-hall":
      return resistorHall(s, tier);
    case "lighthouse":
      return lighthouse(s, tier);
    case "observatory":
      return observatory(s, tier);
    case "power-station":
      return powerStation(s, tier);
    case "lemon-grove":
      return lemonGrove(s, tier);
    case "switchyard":
      return switchyard(s, tier);
    case "relay-clocktower":
      return relayClocktower(s, tier);
    case "breadboard-plaza":
      return breadboardPlaza(s, tier);
    case "capacitor-water-tower":
      return capacitorWaterTower(s, tier);
    case "transistor-gatehouse":
      return transistorGatehouse(s, tier);
    case "siren-tower":
      return sirenTower(s, tier);
    case "solder-forge":
      return solderForge(s, tier);
    case "cable-pylon":
      return cablePylon(s, tier);
    case "perfboard-pier":
      return perfboardPier(s, tier);
    case "timer-factory":
      return timerFactory(s, tier);
    case "alarm-lighthouse":
      return alarmLighthouse(s, tier);
    case "counter-billboard":
      return counterBillboard(s, tier);
    case "logic-castle":
      return logicCastle(s, tier);
    case "dice-arcade":
      return diceArcade(s, tier);
    case "coil-windmill":
      return coilWindmill(s, tier);
    case "radio-mast":
      return radioMast(s, tier);
    case "microcontroller-hq":
      return microcontrollerHq(s, tier);
    case "led-sundial":
      return ledSundial(s, tier);
    default:
      s.box(2, 2, 2, "grey", 0, 0, 0);
      return done(s, 2.2, [1.25, 1.25]);
  }
}
