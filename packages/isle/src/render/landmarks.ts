/**
 * Landmarks: the big builds a module brings, grown from electronic parts into buildings. Most rise through tiers as
 * later modules are finished on their island. Local coordinates as for pieces: standing on y = 0, front facing +z.
 */
import { Q, type Built, type Col, type Shape } from "./kit";

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

function solderForge(s: Shape): Built {
  plinth(s, 4.25, 3.0, "#BFB8AA");
  s.box(2.25, 1.5, 1.75, "#C76B3B", -0.75, 0.125, -0.25);
  s.roof(2.5, 2.0, 0.625, "charcoal", -0.75, 1.625, -0.25, 3);
  door(s, -1.0, 0.625, 0.5, 0.875);
  s.window(0.5, 0.375, -0.25, 0.75, 0.625);
  s.box(0.5, 1.5, 0.5, "#8E8579", -1.5, 1.625, -0.75);
  s.smoke.push([-1.5, 3.25, -0.75]);
  // the iron in its coil stand, its tip glowing
  s.box(0.75, 0.25, 0.75, "charcoal", 1.25, 0.125, 0.5);
  for (let i = 0; i < 4; i++) s.cyl(0.25, Q / 2, "silver", 1.25, 0.5 + i * 0.25, 0.5);
  s.box(0.25, 1.25, 0.25, "yellow", 1.25, 0.75, 0.5);
  s.box(Q, 0.5, Q, "silver", 1.25, 0.25, 0.5);
  s.box(Q, Q, Q, "orange", 1.25, 2.0, 0.5, { glow: true, day: "#C66A2A" });
  s.box(Q, 0.375, Q, "steel", 1.25, 1.875, 0.5);
  s.light(1.25, 2.1, 0.5, "orange", 1.4);
  s.smoke.push([1.25, 2.2, 0.5]);
  // a spool of solder
  s.cyl(0.375, 0.375, "silver", 1.25, 0.125, -0.75);
  s.cyl(0.125, 0.5, "charcoal", 1.25, 0.125, -0.75);
  return done(s, 3.0, [2.125, 1.5]);
}

function perfboardPier(s: Shape): Built {
  // a brown perfboard deck on posts, holes in a grid, a few parts soldered on
  for (const [x, z] of [[-1.75, -1.0], [1.75, -1.0], [-1.75, 1.0], [1.75, 1.0], [0, -1.0], [0, 1.0]] as const) s.box(0.25, 0.75, 0.25, "#8E7A5A", x, 0, z);
  s.box(4.25, 0.25, 2.5, "#B88A4E", 0, 0.75, 0);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) s.slab(Q, Q / 4, Q, "#6E5434", -1.75 + i * 0.5, 1.0, -0.75 + j * 0.5);
  s.xdisc(0.25, 0.75, "beige", -0.75, 1.375, 0.25);
  s.cyl(0.375, 0.75, "navy", 1.0, 1.0, -0.25);
  s.box(0.75, 0.375, 0.5, "black", 0.25, 1.0, 0.75);
  s.box(Q, 0.75, Q, "silver", -1.5, 1.0, -0.5);
  s.box(0.25, 0.25, 0.25, "ledGreen", -1.5, 1.75, -0.5, { glow: true, day: "#3FB45A" });
  s.light(-1.5, 1.85, -0.5, "ledGreen", 1.5);
  return done(s, 2.0, [2.25, 1.375]);
}

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

function timerFactory(s: Shape): Built {
  dip(s, 3.5, 2.0, 1.25, 4, "555");
  for (const x of [-1.0, 1.0]) s.window(0.5, 0.375, x, 0.875, 1.0);
  door(s, 0, 1.0, 0.625, 0.875);
  // chimneys
  for (const [x, h] of [[1.25, 1.25], [0.75, 0.875]] as const) {
    s.cyl(0.25, h, "#8E8579", x, 1.6875, -0.5);
    s.cyl(0.25, Q, "red", x, 1.6875 + h - Q, -0.5);
    s.smoke.push([x, 1.8 + h, -0.5]);
  }
  s.box(0.25, 0.25, Q, "ledGreen", -1.5, 1.25, 1.0, { glow: true, day: "#3FB45A" });
  s.light(-1.5, 1.35, 1.05, "ledGreen", 1.0);
  return done(s, 3.2, [2.25, 1.75]);
}

function logicCastle(s: Shape): Built {
  plinth(s, 5.0, 5.0, "#A8A296");
  // walls
  for (const [x, z, w, d] of [[0, -2, 4, 0.5], [0, 2, 4, 0.5], [-2, 0, 0.5, 4], [2, 0, 0.5, 4]] as const) {
    s.box(w, 1.25, d, "charcoal", x, 0.125, z);
    for (let i = -w / 2 + 0.25; i < w / 2; i += 0.5) if (w > 1) s.box(0.25, 0.25, d, "silver", x + i, 1.375, z);
    for (let i = -d / 2 + 0.25; i < d / 2; i += 0.5) if (d > 1) s.box(w, 0.25, 0.25, "silver", x, 1.375, z + i);
  }
  // corner towers: chips standing up
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) {
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
  return done(s, 4.0, [2.5, 2.5]);
}

/** A seven-segment digit on a wall facing +z: width 0.75, height 1.25, top at y. */
function sevenSeg(s: Shape, digit: number, x: number, y: number, z: number): void {
  const segs = ["1110111", "0010010", "1011101", "1011011", "0111010", "1101011", "1101111", "1010010", "1111111", "1111011"][digit]!;
  const lit = (i: number) => segs[i] === "1";
  const on = (i: number): [Col, { glow: boolean; day: Col }] => (lit(i) ? ["ledRed", { glow: true, day: "#C0392F" }] : ["#3A1C1C", { glow: true, day: "#2F2626" }]);
  const H = (i: number, yy: number) => s.box(0.5, Q, Q, on(i)[0], x, yy, z, on(i)[1]);
  const V = (i: number, xx: number, yy: number) => s.box(Q, 0.5, Q, on(i)[0], xx, yy, z, on(i)[1]);
  H(0, y - Q);
  V(1, x - 0.3125, y - 0.625);
  V(2, x + 0.3125, y - 0.625);
  H(3, y - 0.6875);
  V(4, x - 0.3125, y - 1.1875);
  V(5, x + 0.3125, y - 1.1875);
  H(6, y - 1.25);
}

function counterBillboard(s: Shape): Built {
  for (const sx of [-1, 1]) s.box(0.25, 2.0, 0.25, "steel", sx * 1.25, 0, -0.25);
  s.box(3.25, 2.0, 0.5, "charcoal", 0, 1.75, -0.25);
  s.box(3.0, 1.75, Q, "ink", 0, 1.875, 0.0625);
  sevenSeg(s, 4, -0.5, 3.4375, 0.125);
  sevenSeg(s, 2, 0.5, 3.4375, 0.125);
  s.box(Q, Q, Q, "ledRed", 1.0, 2.125, 0.125, { glow: true, day: "#C0392F" });
  s.light(0, 2.8, 0.4, "ledRed", 3.2);
  s.box(3.5, Q, 0.75, "steel", 0, 3.75, -0.25);
  for (const sx of [-1, 1]) {
    s.box(Q, 0.25, Q, "steel", sx * 1.25, 3.875, 0.125);
    s.box(0.25, Q, 0.25, "warm", sx * 1.25, 4.0, 0.25, { glow: true, day: "#E8D6A8" });
  }
  return done(s, 4.3, [1.75, 0.75]);
}

function die(s: Shape, x: number, y: number, z: number, n: number): void {
  s.box(1.0, 1.0, 1.0, "white", x, y, z);
  const pips: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]], 5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]] };
  for (const [px, py] of pips[n]!) s.box(Q, Q, Q / 2, "ledRed", x + px * 0.25, y + 0.4375 + py * 0.25, z + 0.5, { glow: true, day: "#B9443A" });
  for (const [px, pz] of pips[7 - n]!) s.slab(Q, Q / 4, Q, "ledRed", x + px * 0.25, y + 1.0, z + pz * 0.25, { glow: true, day: "#B9443A" });
}

function diceArcade(s: Shape): Built {
  plinth(s, 4.0, 3.0, "#C9C2B4");
  s.box(3.25, 1.5, 2.0, "violet", 0, 0.125, -0.25);
  s.box(3.5, Q, 2.25, "#6A3FA0", 0, 1.625, -0.25);
  door(s, 0, 0.75, 0.75, 1.0);
  for (const sx of [-1, 1]) s.window(0.625, 0.5, sx * 1.0625, 0.75, 0.75);
  // a glowing sign and two dice on the roof
  s.box(2.25, 0.375, Q, "ledYellow", 0, 1.25, 0.8125, { glow: true, day: "#E0B93A" });
  s.light(0, 1.45, 0.9, "ledYellow", 2);
  die(s, -0.75, 1.75, -0.25, 5);
  die(s, 0.75, 1.75, -0.5, 3);
  s.light(0, 2.6, 0.4, "ledRed", 2.4);
  return done(s, 2.9, [2.0, 1.5]);
}

function coilWindmill(s: Shape): Built {
  s.cyl(1.0, 0.25, "#C9C2B4", 0, 0, 0);
  // the tower is a coil: copper windings on a dark former
  for (let i = 0; i < 12; i++) s.cyl(i % 2 ? 0.625 : 0.5625 + 0.0625, 0.25, i % 2 ? "copperDark" : "copper", 0, 0.25 + i * 0.25, 0);
  s.cyl(0.75, 0.25, "charcoal", 0, 3.25, 0);
  s.roof(1.25, 1.25, 0.5, "charcoal", 0, 3.5, 0, 2);
  door(s, 0, 0.625, 0.375, 0.75);
  // a hub and four blades facing +z
  s.box(0.375, 0.375, 0.5, "steel", 0, 3.0, 0.875);
  for (let i = 1; i <= 6; i++) {
    const k = i * 0.25;
    s.box(0.25, 0.25, Q, "white", 0, 3.0 + 0.0625 + k, 1.125);
    s.box(0.25, 0.25, Q, "white", 0, 3.0 + 0.0625 - k, 1.125);
    s.box(0.25, 0.25, Q, "white", k, 3.0625, 1.125);
    s.box(0.25, 0.25, Q, "white", -k, 3.0625, 1.125);
  }
  for (const [x, y] of [[0.25, 4.375], [-0.25, 1.75], [1.625, 3.375], [-1.625, 2.875]] as const) s.box(0.25, 0.25, Q, "red", x, y, 1.125);
  return done(s, 4.6, [1.25, 1.25]);
}

function radioMast(s: Shape): Built {
  plinth(s, 3.0, 3.0, "#BFB8AA");
  const H = 6.0;
  // a lattice mast, narrowing, with guy wires
  for (let y = 0.125; y < H; y += 0.5) {
    const w = 0.75 - (y / H) * 0.375;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) s.box(Q, 0.5, Q, "red", (dx * w) / 2, y, (dz * w) / 2);
    s.box(w, Q, Q, y % 1 < 0.5 ? "white" : "red", 0, y, w / 2);
    s.box(Q, Q, w, y % 1 < 0.5 ? "white" : "red", w / 2, y, 0);
  }
  for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]] as const) {
    s.box(0.25, 0.25, 0.25, "charcoal", x, 0.125, z);
    for (let i = 2; i < 24; i++) s.box(Q, Q / 2, Q, "#AEB4BC", (x * (24 - i)) / 24, 0.25 + (i * 3.5) / 24, (z * (24 - i)) / 24);
  }
  // dishes and a little hut
  s.box(0.75, Q, Q, "white", 0, 3.5, 0.375);
  s.box(0.625, 0.625, Q, "white", 0, 3.25, 0.4375);
  s.box(1.0, 0.75, 0.75, "cream", -0.875, 0.125, 0.875);
  s.window(0.25, 0.25, -0.875, 0.5, 1.25);
  beacon(s, 0, H, 0);
  return done(s, H + 0.4, [1.5, 1.5]);
}

function microcontrollerHq(s: Shape): Built {
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
  return done(s, 2.0, [2.5, 1.625]);
}

export function buildLandmark(s: Shape, kind: string, tier: number): Built {
  switch (kind) {
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
      return solderForge(s);
    case "perfboard-pier":
      return perfboardPier(s);
    case "timer-factory":
      return timerFactory(s);
    case "logic-castle":
      return logicCastle(s);
    case "counter-billboard":
      return counterBillboard(s);
    case "dice-arcade":
      return diceArcade(s);
    case "coil-windmill":
      return coilWindmill(s);
    case "radio-mast":
      return radioMast(s);
    case "microcontroller-hq":
      return microcontrollerHq(s);
    default:
      s.box(2, 2, 2, "grey", 0, 0, 0);
      return done(s, 2.2, [1.25, 1.25]);
  }
}
