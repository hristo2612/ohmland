/**
 * Lesson pieces, built in the voxel kit: electronic parts grown to building size, standing on the board.
 * Local coordinates: a piece stands on y = 0, its front faces +z, and 1 unit is one board cell.
 */
import { Q, type Built, type Col, type Shape } from "./kit";

const done = (s: Shape, top: number, outline: [number, number] | null): Built => ({ top, lights: s.lights, smoke: s.smoke, pads: s.pads, outline });

/** A silver lead from the board up to height h, with its pad. */
function lead(s: Shape, x: number, z: number, h: number, col: Col = "silver"): void {
  s.box(Q, h, Q, col, x, 0, z);
  s.pads.push([x, z]);
}

/** A horizontal cylinder along x made of coloured segments of 1/8, at height yc. Each segment: [colour, radius]. */
function xbody(s: Shape, segs: [Col, number][], x0: number, yc: number): void {
  segs.forEach(([c, r], i) => s.xdisc(r, Q, c, x0 + (i + 0.5) * Q, yc, 0));
}

/** A pixel arc (an arch) in the xy plane at depth z: centre (0, yc), radius R, thickness t, from left foot to right foot. */
function arch(s: Shape, R: number, yc: number, z: number, t: number, col: Col, depth = 2 * Q): void {
  const n = Math.round((R + t) / Q);
  for (let j = 0; j < n; j++) {
    const y = (j + 0.5) * Q;
    // the run of pixels on this row whose centre is within the ring
    let run0: number | null = null;
    for (let i = -n; i <= n; i++) {
      const x = (i + 0.5) * Q;
      const d = Math.sqrt(x * x + y * y);
      const inside = d >= R - t / 2 && d <= R + t / 2 && i < n;
      if (inside && run0 === null) run0 = i;
      if ((!inside || i === n) && run0 !== null) {
        const w = (i - run0) * Q;
        s.box(w, Q, depth, col, run0 * Q + w / 2, yc + j * Q, z);
        run0 = null;
      }
    }
  }
}

const BANDS: Col[][] = [
  ["red", "red", "brown", "#D4A93C"],
  ["brown", "black", "red", "#D4A93C"],
  ["yellow", "violet", "brown", "#D4A93C"],
  ["brown", "black", "orange", "#D4A93C"],
];

function resistor(s: Shape, v: number): Built {
  const b = BANDS[v % BANDS.length]!;
  const yc = 0.75;
  const big = 0.375;
  const thin = 0.25;
  xbody(
    s,
    [
      ["beige", thin],
      [b[0]!, big],
      ["beige", big],
      [b[1]!, thin],
      ["beige", thin],
      [b[2]!, thin],
      ["beige", thin],
      ["beige", big],
      [b[3]!, big],
      ["beige", thin],
    ],
    -0.625,
    yc,
  );
  for (const sx of [-1, 1]) {
    s.box(0.375, Q, Q, "silver", sx * 0.8125, yc - Q / 2, 0);
    lead(s, sx * 0.9375, 0, yc + Q / 2);
  }
  return done(s, 1.2, [1.125, 0.5]);
}

const LED: [Col, Col][] = [
  ["ledRed", "#D9473A"],
  ["ledGreen", "#3FB45A"],
  ["ledYellow", "#F0CB3C"],
  ["ledBlue", "#3F7FDB"],
  ["ledWhite", "#DDE6EA"],
];

function ledLamp(s: Shape, v: number): Built {
  const [lit, day] = LED[v % LED.length]!;
  const h = 1.875;
  // two legs, the cathode with a little kink, on a small base
  s.cyl(0.25, Q, "charcoal", 0, 0, 0);
  s.box(Q, h, Q, "silver", 0.1875, 0, 0);
  s.box(Q, 0.75, Q, "silver", -0.1875, 0, 0);
  s.box(Q, Q, 0.25, "silver", -0.1875, 0.75, 0.0625);
  s.box(Q, h - 0.875, Q, "silver", -0.1875, 0.875, 0.125);
  s.box(Q, Q, 0.25, "silver", -0.1875, h - Q, 0.0625);
  s.pads.push([0.1875, 0], [-0.1875, 0]);
  // flange, body and dome
  s.cyl(0.375, Q, lit, 0, h, 0, { glow: true, day });
  s.cyl(0.25, 0.375, lit, 0, h + Q, 0, { glow: true, day });
  s.box(0.25, Q, 0.25, lit, 0, h + 0.5, 0, { glow: true, day });
  s.light(0, h + 0.3, 0, lit, 2.6);
  return done(s, h + 0.7, [0.375, 0.375]);
}

const LABEL: Col[] = ["orange", "blue", "green"];

function battery(s: Shape, v: number): Built {
  const w = 0.875;
  const d = 0.625;
  s.box(w, 0.625, d, "black", 0, 0, 0);
  s.box(w, Q / 2, d, "silver", 0, 0.625, 0);
  s.box(w, 0.75, d, LABEL[v % LABEL.length]!, 0, 0.6875, 0);
  s.box(w, Q, d, "charcoal", 0, 1.4375, 0);
  s.text("9V", "white", 0, 1.3125, d / 2 + Q / 4, 1);
  s.box(0.25, Q, Q / 2, "white", -0.25, 0.375, d / 2 + Q / 4);
  // snap terminals: a round plus, a hex minus
  s.cyl(0.125, 0.25, "silver", -0.1875, 1.5625, 0);
  s.box(0.375, 0.125, 0.375, "silver", 0.1875, 1.5625, 0);
  s.box(0.25, 0.125, 0.25, "steel", 0.1875, 1.6875, 0);
  // the snap's wires run down the back into the board
  for (const [x, c] of [[-0.1875, "red"], [0.1875, "black"]] as const) {
    s.box(Q, Q, 0.5, c, x, 1.8125, -0.125);
    s.box(Q, 1.9375, Q, c, x, 0, -0.4375);
    s.pads.push([x, -0.5]);
  }
  return done(s, 2.0, [0.625, 0.5]);
}

function meterKiosk(s: Shape): Built {
  const w = 1.0;
  const d = 0.5;
  const z = d / 2;
  // the yellow holster and the dark face
  s.box(w, 1.5, d, "yellow", 0, 0, 0);
  s.box(w - 0.25, 1.25, Q, "charcoal", 0, 0.125, z);
  // the display, with digits
  s.box(0.625, 0.375, Q, "lcdLit", 0, 1.0, z + Q / 2, { glow: true, day: "lcd" });
  s.box(Q, 0.25, Q / 2, "ink", -0.125, 1.0625, z + Q);
  s.box(Q, 0.25, Q / 2, "ink", 0.125, 1.0625, z + Q);
  s.box(Q / 2, Q / 2, Q / 2, "ink", 0, 1.0625, z + Q);
  // the dial with its pointer
  s.vdisc(0.25, Q, "black", 0, 0.625, z + Q / 2);
  s.box(Q, 0.1875, Q / 2, "white", 0, 0.625, z + Q);
  // sockets
  s.box(Q, Q, Q / 2, "red", 0.25, 0.25, z + Q / 2);
  s.box(Q, Q, Q / 2, "ink", -0.25, 0.25, z + Q / 2);
  // a kiosk awning
  s.box(w + 0.25, Q, d + 0.375, "orange", 0, 1.5, 0.125);
  s.box(w + 0.25, Q / 2, Q, "white", 0, 1.4375, z + 0.25);
  s.light(0, 1.2, z + 0.2, "lcdLit", 1.1);
  s.pads.push([-0.375, 0], [0.375, 0]);
  return done(s, 1.75, [0.625, 0.5]);
}

function fuse(s: Shape): Built {
  s.box(1.5, 0.25, 0.625, "black", 0, 0, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) s.box(0.25, 0.625, Q, "silver", sx * 0.5, 0.25, sz * 0.25);
    s.pads.push([sx * 0.5, 0]);
  }
  const yc = 0.75;
  s.xdisc(0.25, 0.75, "glass", 0, yc, 0);
  s.slab(0.625, Q / 2, Q / 4, "charcoal", 0, yc - Q / 4, 0.26);
  for (const sx of [-1, 1]) s.xdisc(0.375, 0.25, "silver", sx * 0.5, yc, 0);
  return done(s, 1.15, [0.875, 0.5]);
}

function testLeadArch(s: Shape): Built {
  const R = 0.875;
  for (const [z, c] of [[0.1875, "red"], [-0.1875, "black"]] as const) {
    arch(s, R, 0.625, z, 0.25, c, 0.25);
    for (const sx of [-1, 1]) {
      // the alligator clip: insulated boot and steel jaws biting the board
      s.box(0.375, 0.375, 0.375, c, sx * R, 0.25, z);
      s.box(0.25, 0.25, 0.3125, "silver", sx * R, 0, z);
      s.box(Q, Q / 2, 0.3125, "steel", sx * (R + 0.125), 0.125, z);
    }
  }
  s.pads.push([-R, 0], [R, 0]);
  return done(s, 0.625 + R + 0.25, [1.125, 0.5]);
}

const FRUIT: [Col, Col][] = [
  ["lemon", "lemonDark"],
  ["#F39A2C", "#D97F1E"],
  ["#B98A55", "#9B7044"],
];

function cellJar(s: Shape, v: number): Built {
  const [c, c2] = FRUIT[v % FRUIT.length]!;
  s.cyl(0.5, Q, "white", 0, 0, 0);
  s.ball(0.5, c, 0, 0.5, 0, 0.75);
  s.box(0.25, 0.25, 0.25, c2, 0.5, 0.375, 0);
  s.box(0.25, 0.25, 0.25, c2, -0.5, 0.375, 0);
  if (v % FRUIT.length !== 2) s.box(0.25, Q, 0.375, "leaf", -0.125, 0.875, -0.125);
  // copper and zinc strips, wired to the board
  s.box(0.25, 0.625, Q, "copper", -0.25, 0.625, 0.125);
  s.box(0.25, 0.625, Q, "silver", 0.25, 0.625, 0.125);
  for (const [x, col] of [[-0.25, "red"], [0.25, "black"]] as const) {
    s.box(Q, Q, 0.625, col, x, 1.25, 0.375);
    s.box(Q, 1.375, Q, col, x, 0, 0.625);
    s.pads.push([x, 0.625]);
  }
  return done(s, 1.4, [0.625, 0.75]);
}

function switchPost(s: Shape, v: number): Built {
  if (v % 2 === 0) {
    // a slide switch
    s.box(1.125, 0.5, 0.625, "black", 0, 0.25, 0);
    s.box(1.125, Q / 2, 0.625, "silver", 0, 0.75, 0);
    s.box(0.5, Q / 2, 0.25, "ink", 0.125, 0.8125, 0);
    s.box(0.25, 0.3125, 0.25, "white", 0.25, 0.8125, 0);
    for (const x of [-0.375, 0, 0.375]) lead(s, x, 0, 0.25);
    return done(s, 1.2, [0.75, 0.5]);
  }
  // a toggle switch: body, hex nut, bushing and a bat lever
  s.box(0.75, 0.5, 0.625, "blueDark", 0, 0.25, 0);
  for (const x of [-0.25, 0, 0.25]) lead(s, x, 0, 0.25);
  s.box(0.5, Q, 0.5, "silver", 0, 0.75, 0);
  s.cyl(0.125, 0.25, "silver", 0, 0.875, 0);
  for (let i = 0; i < 4; i++) s.box(Q, Q, Q, "silver", 0.0625 + i * 0.0625, 1.125 + i * 0.125, 0);
  s.box(0.25, 0.25, 0.25, "silver", 0.3125, 1.5, 0);
  return done(s, 1.8, [0.625, 0.5]);
}

const CAPS: Col[] = ["red", "blue", "yellow", "green"];

function pushbutton(s: Shape, v: number): Built {
  for (const x of [-0.3125, 0.3125]) for (const z of [-0.25, 0.25]) lead(s, x, z, 0.25);
  s.box(0.75, 0.3125, 0.75, "black", 0, 0.125, 0);
  s.box(0.625, Q / 2, 0.625, "silver", 0, 0.4375, 0);
  s.cyl(0.25, 0.1875, "charcoal", 0, 0.5, 0);
  s.cyl(0.25, 0.1875, CAPS[v % CAPS.length]!, 0, 0.6875, 0);
  return done(s, 0.95, [0.5, 0.5]);
}

function relay(s: Shape): Built {
  for (const [x, z] of [[-0.375, -0.25], [-0.375, 0.25], [0.375, -0.25], [0.375, 0], [0.375, 0.25]] as const) lead(s, x, z, 0.125);
  s.box(1.125, 0.875, 0.75, "blue", 0, 0.125, 0);
  s.box(1.125, Q / 2, 0.75, "blueDark", 0, 1.0, 0);
  s.text("5V", "white", -0.125, 0.8125, 0.375 + Q / 4, 0.75);
  s.slab(0.75, Q / 2, Q / 4, "white", 0, 0.375, 0.375 + Q / 8);
  s.slab(0.5, Q / 2, Q / 4, "white", -0.125, 0.25, 0.375 + Q / 8);
  s.box(Q, Q, Q, "ledRed", 0.375, 1.0625, 0.25, { glow: true, day: "#8E3A33" });
  s.light(0.375, 1.15, 0.25, "ledRed", 0.8);
  return done(s, 1.2, [0.75, 0.5]);
}

function breadboardPatch(s: Shape): Built {
  const W = 2.25;
  const D = 1.5;
  s.box(W, 0.25, D, "white", 0, 0, 0);
  const y = 0.25;
  // power rails along both long edges
  for (const sz of [-1, 1]) {
    s.slab(W - 0.25, Q / 4, Q / 2, "red", 0, y, sz * 0.6875);
    s.slab(W - 0.25, Q / 4, Q / 2, "blue", 0, y, sz * 0.4375);
    for (let i = 0; i < 8; i++) s.slab(Q, Q / 4, Q, "charcoal", -0.875 + i * 0.25, y, sz * 0.5625);
  }
  // the centre channel and the two hole fields
  s.slab(W - 0.125, Q / 4, Q, "#DCDCD6", 0, y, 0);
  for (const sz of [-1, 1]) for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) s.slab(Q, Q / 4, Q, "charcoal", -1.0 + i * 0.25, y, sz * (0.1875 + r * 0.125));
  // a resistor and an LED plugged in
  s.box(0.5, 0.25, 0.25, "beige", -0.375, y, 0.0);
  s.box(Q, 0.25, 0.25, "red", -0.4375, y, 0.0);
  s.box(Q, 0.5, Q, "silver", 0.5, y, 0.1875);
  s.box(0.25, 0.25, 0.25, "ledGreen", 0.5, y + 0.5, 0.1875, { glow: true, day: "#3FB45A" });
  s.light(0.5, y + 0.65, 0.1875, "ledGreen", 1.2);
  for (const [x0, x1, z, c] of [[-0.875, -0.125, -0.25, "yellow"], [0.125, 0.875, 0.25, "orange"]] as const) {
    s.box(Q, 0.25, Q, c, x0, y, z);
    s.box(x1 - x0 + Q, Q, Q, c, (x0 + x1) / 2, y + 0.25, z);
    s.box(Q, 0.25, Q, c, x1, y, z);
  }
  s.pads.push([-1, -0.625], [1, -0.625], [-1, 0.625], [1, 0.625]);
  return done(s, 0.9, [1.25, 0.875]);
}

const JUMPERS: Col[][] = [
  ["red", "yellow", "green"],
  ["blue", "orange", "violet"],
  ["green", "red", "white"],
];

function jumperArch(s: Shape, v: number): Built {
  const cols = JUMPERS[v % JUMPERS.length]!;
  cols.forEach((c, i) => {
    const z = -0.375 + i * 0.375;
    const R = 0.375 + i * 0.25;
    arch(s, R, 0.375, z, Q, c, Q);
    for (const sx of [-1, 1]) {
      s.box(0.25, 0.375, 0.25, "black", sx * R, 0, z);
      s.box(Q, Q, Q, "silver", sx * R, 0.375, z);
      s.pads.push([sx * R, z]);
    }
  });
  return done(s, 1.4, [1.125, 0.625]);
}

const CANS: [Col, Col, number][] = [
  ["navy", "#D7DCE6", 1.5],
  ["black", "#D6B25A", 1.75],
  ["#2F5FB0", "#CFE0F5", 1.25],
];

function capacitor(s: Shape, v: number): Built {
  const [body, stripe, h] = CANS[v % CANS.length]!;
  const r = 0.5;
  lead(s, -0.25, 0, Q);
  lead(s, 0.25, 0, Q);
  s.cyl(r - Q, Q, "charcoal", 0, Q, 0);
  s.cyl(r, h, body, 0, 0.25, 0);
  // the polarity stripe with its minus marks, on the front
  s.box(0.25, h, Q, stripe, 0, 0.25, r - Q / 2);
  for (let i = 0; i < 3; i++) s.slab(Q, Q / 2, Q / 4, body, 0, 0.25 + h * (0.3 + i * 0.22), r + Q / 2);
  // a rolled rim and the silver top with its vent
  s.cyl(r, Q, "silver", 0, 0.25 + h, 0);
  s.slab(0.5, Q / 4, Q / 2, "steel", 0, 0.375 + h, 0);
  s.slab(Q / 2, Q / 4, 0.5, "steel", 0, 0.375 + h, 0);
  return done(s, h + 0.5, [0.625, 0.625]);
}

function ceramicCap(s: Shape, v: number): Built {
  const c = v % 2 ? "#E2B84A" : "#E8923A";
  lead(s, -0.1875, 0, 0.5);
  lead(s, 0.1875, 0, 0.5);
  s.vdisc(0.375, 0.25, c, 0, 0.875, 0);
  s.text("104", "#5A3A1A", 0, 1.0, 0.13, 0.5);
  return done(s, 1.3, [0.375, 0.375]);
}

function pot(s: Shape, v: number): Built {
  for (const x of [-0.25, 0, 0.25]) lead(s, x, x === 0 ? -0.25 : 0.25, 0.125);
  if (v % 2 === 0) {
    s.box(0.875, 0.5, 0.875, "blue", 0, 0.125, 0);
    s.cyl(0.375, Q, "white", 0, 0.625, 0);
    s.slab(0.5, Q / 4, Q / 2, "charcoal", 0, 0.75, 0);
    s.slab(Q / 2, Q / 4, 0.5, "charcoal", 0, 0.75, 0);
    return done(s, 0.85, [0.625, 0.625]);
  }
  s.box(0.875, 0.375, 0.875, "steel", 0, 0.125, 0);
  s.cyl(0.125, 0.25, "silver", 0, 0.5, 0);
  s.cyl(0.375, 0.5, "black", 0, 0.75, 0);
  s.box(Q, Q, 0.25, "white", 0, 1.25, 0.125);
  return done(s, 1.35, [0.625, 0.625]);
}

function transistor(s: Shape): Built {
  for (const x of [-0.25, 0, 0.25]) lead(s, x, 0, 0.5);
  // the TO-92 body: flat face to the front, round at the back
  s.box(0.75, 0.75, 0.25, "black", 0, 0.5, 0);
  s.box(0.5, 0.75, 0.25, "black", 0, 0.5, -0.25);
  s.box(0.5, 0.5, Q / 4 + 0.01, "charcoal", 0, 0.625, 0.13);
  s.slab(0.375, Q / 4, Q / 4, "grey", 0, 1.0, 0.135);
  s.slab(0.25, Q / 4, Q / 4, "grey", 0, 0.875, 0.135);
  return done(s, 1.3, [0.5, 0.375]);
}

function phototransistor(s: Shape): Built {
  lead(s, -0.125, 0, 0.625);
  lead(s, 0.125, 0, 0.625);
  s.cyl(0.25, 0.375, "glass", 0, 0.625, 0);
  s.box(0.25, Q, 0.25, "glass", 0, 1.0, 0);
  s.box(Q, Q, Q, "charcoal", 0, 0.8125, 0.1875);
  return done(s, 1.2, [0.375, 0.375]);
}

function speaker(s: Shape, v: number): Built {
  const yc = 0.875;
  const frame = v % 2 ? "charcoal" : "black";
  s.box(0.75, Q, 0.5, "charcoal", 0, 0, -0.125);
  s.box(0.25, 0.375, 0.25, "steel", 0, Q, -0.125);
  s.box(0.5, 0.5, 0.375, "steel", 0, yc - 0.25, -0.375);
  s.vdisc(0.625, 0.25, frame, 0, yc, -0.0625);
  s.vdisc(0.5, Q, "grey", 0, yc, 0.125);
  s.vdisc(0.375, Q, "#7F858E", 0, yc, 0.1875);
  s.vdisc(0.25, Q, frame, 0, yc, 0.25);
  s.pads.push([-0.25, -0.125], [0.25, -0.125]);
  return done(s, 1.55, [0.75, 0.5]);
}

function diode(s: Shape): Built {
  const yc = 0.625;
  xbody(
    s,
    [
      ["black", 0.25],
      ["black", 0.25],
      ["black", 0.25],
      ["black", 0.25],
      ["black", 0.25],
      ["silver", 0.25],
      ["black", 0.25],
    ],
    -0.4375,
    yc,
  );
  for (const sx of [-1, 1]) {
    s.box(0.375, Q, Q, "silver", sx * 0.625, yc - Q / 2, 0);
    lead(s, sx * 0.75, 0, yc + Q / 2);
  }
  return done(s, 1.0, [0.875, 0.375]);
}

const SPOOLS: [Col, Col][] = [
  ["red", "redDark"],
  ["blue", "blueDark"],
  ["green", "#2E8A47"],
  ["yellow", "#D9A823"],
];

function wireSpool(s: Shape, v: number): Built {
  const [c, c2] = SPOOLS[v % SPOOLS.length]!;
  s.cyl(0.625, Q, "charcoal", 0, 0, 0);
  for (let i = 0; i < 5; i++) s.cyl(0.5, Q, i % 2 ? c2 : c, 0, Q + i * Q, 0);
  s.cyl(0.625, Q, "charcoal", 0, 0.75, 0);
  s.cyl(0.125, Q, "steel", 0, 0.875, 0);
  // a loose end runs off to the board
  s.box(Q, Q, 0.5, c, 0.375, 0.625, 0.625);
  s.box(Q, 0.625, Q, c, 0.375, 0, 0.8125);
  s.box(Q, Q, Q, "copper", 0.375, 0, 0.9375);
  s.pads.push([0.375, 0.875]);
  return done(s, 1.0, [0.75, 0.75]);
}

function heatsink(s: Shape, v: number): Built {
  const tall = v % 2 ? 1.5 : 1.125;
  s.box(1.125, 0.25, 0.75, "steel", 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const x = -0.5 + i * 0.25;
    const h = tall - Math.abs(i - 2) * 0.125;
    s.box(Q, h, 0.75, i % 2 ? "alu" : "#C6D0D9", x, 0.25, 0);
  }
  s.box(0.5, 0.375, Q, "black", 0, 0.25, 0.4375);
  for (const x of [-0.125, 0, 0.125]) s.box(Q / 2, 0.25, Q / 2, "silver", x, 0, 0.5);
  s.pads.push([-0.125, 0.5], [0.125, 0.5]);
  return done(s, tall + 0.3, [0.75, 0.5]);
}

function headerFence(s: Shape): Built {
  s.box(1.875, 0.25, 0.25, "black", 0, 0, 0);
  s.box(1.875, Q / 2, 0.25, "charcoal", 0, 0.25, 0);
  for (let i = 0; i < 8; i++) {
    const x = -0.875 + i * 0.25;
    s.box(Q, 0.5, Q, "gold", x, 0.3125, 0);
    s.pads.push([x, 0]);
  }
  return done(s, 0.9, [1.0, 0.25]);
}

function moss(s: Shape, v: number): Built {
  const a: Col = v % 2 ? "moss" : "moss2";
  const b: Col = v % 2 ? "moss2" : "moss";
  const hi: Col = "#A9D65C";
  s.box(0.75, Q, 0.625, a, 0, 0, 0);
  s.box(0.5, Q, 0.5, b, 0.0625, Q, -0.0625);
  s.box(0.25, Q, 0.25, hi, 0.125, 2 * Q, -0.0625);
  s.box(0.375, Q, 0.375, b, -0.375, 0, 0.3125);
  s.box(0.25, Q, 0.25, hi, -0.375, Q, 0.3125);
  s.box(0.25, Q, 0.25, a, 0.375, 0, 0.375);
  if (v % 3 === 0) s.box(Q, Q, Q, "white", 0.125, 3 * Q, -0.0625);
  if (v % 3 === 1) s.box(Q, Q, Q, "yellow", -0.375, 2 * Q, 0.3125);
  return done(s, 0.4, null);
}

function tuft(s: Shape, v: number): Built {
  // a low clump of blades in two greens, the outer ones shorter, leaning out a step near the top
  const a: Col = v % 2 ? "moss" : "leaf";
  const b: Col = v % 2 ? "leaf" : "#9BCB4A";
  const blades: [number, number, number, number, number][] = [
    [0, 0, 0.375, 0, 0],
    [0.125, 0.125, 0.25, 1, 0],
    [-0.125, 0.0625, 0.3125, -1, 0],
    [0.0625, -0.125, 0.25, 0, -1],
    [-0.0625, -0.1875, 0.1875, 0, 0],
    [0.1875, -0.0625, 0.1875, 0, 0],
    [-0.1875, 0.1875, 0.25, -1, 1],
  ];
  blades.forEach(([x, z, h, lx, lz], i) => {
    const c = i % 2 ? a : b;
    s.box(Q, h, Q, c, x, 0, z);
    if (lx || lz) s.box(Q, Q, Q, c, x + lx * Q, h, z + lz * Q);
  });
  if (v % 3 === 0) s.box(Q, Q, Q, "white", 0.25, 0.125, 0.1875);
  if (v % 3 === 1) s.box(Q, Q, Q, "yellow", -0.25, 0.125, -0.125);
  return done(s, 0.5, null);
}

function lemonTree(s: Shape, v: number): Built {
  // a round crown in two greens on a short trunk, lemons hanging on the sides the camera sees
  const big = v % 2 === 1;
  const y = big ? 0.875 : 0.75;
  s.box(0.25, y + 0.25, 0.25, "trunk", 0, 0, 0);
  s.box(0.125, 0.125, 0.375, "trunk", 0, y - 0.25, 0.1875);
  const w = big ? 1.5 : 1.25;
  s.box(w, 0.625, w - 0.25, "leaf2", 0, y, 0);
  s.box(w - 0.25, 0.625, w, "leaf2", 0, y, 0);
  s.box(w - 0.25, 0.375, w - 0.25, "leaf", 0, y + 0.625, 0);
  s.box(w - 0.75, 0.25, w - 0.75, "#7CC85A", 0, y + 1.0, 0);
  const h = w / 2;
  const lemons: [number, number, number][] = [
    [h - 0.25, y + 0.125, h + 0.0625],
    [-h + 0.375, y + 0.25, h + 0.0625],
    [h + 0.0625, y + 0.25, -h + 0.375],
    [h + 0.0625, y + 0.0625, 0.125],
    [0, y + 0.0, h + 0.0625],
  ];
  for (const [x, yy, z] of lemons) s.box(0.25, 0.25, 0.25, "lemon", x, yy - 0.125, z);
  return done(s, y + 1.25, null);
}

/** The robot's charging dock by the plaza: a round copper pad and a small pylon with a charge meter. */
function dock(s: Shape): Built {
  s.cyl(0.625, Q, "copper", 0, 0, 0.125);
  s.cyl(0.5, 0.1875, "charcoal", 0, 0, 0.125);
  s.cyl(0.25, 0.25, "silver", 0, 0, 0.125);
  s.box(0.5, 1.125, 0.25, "cream", 0, 0, -0.5);
  s.box(0.5, Q, 0.375, "copper", 0, 1.125, -0.5);
  for (let i = 0; i < 3; i++) s.box(0.25, Q, Q / 2, "ledGreen", 0, 0.375 + i * 0.1875, -0.375, { glow: true, day: "#4FA85E" });
  s.box(Q, 0.25, Q, "steel", 0, 1.25, -0.5);
  s.box(0.25, 0.1875, 0.25, "amber", 0, 1.5, -0.5, { glow: true, day: "#D9962F" });
  s.light(0, 1.6, -0.5, "amber", 1.2);
  return done(s, 1.75, [0.75, 0.75]);
}

// ---------------------------------------------------------------------------------------------------------------
// Parts shared with the landmarks.

/** A small LED on its legs: lit (glowing at night) or dark. */
export function smallLed(s: Shape, x: number, z: number, h: number, col: Col, lit: boolean, day: Col = "#B9443A"): void {
  lead(s, x, z, h);
  if (lit) {
    s.box(Q, Q, Q, col, x, h, z, { glow: true, day });
    s.light(x, h + 0.06, z, col, 0.8);
  } else s.box(Q, Q, Q, "#5A3A36", x, h, z);
}

/** A seven-segment digit on a wall facing +z: width 0.75, height 1.25, top at y. Lit segments glow red at night. */
export function sevenSeg(s: Shape, digit: number, x: number, y: number, z: number): void {
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

/** Pip spots on a die face, in steps from its centre (x right, y up). */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, 1], [1, -1]],
  3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
  6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]],
};

/**
 * A die of side a with its bottom at y, showing `front` on +z, `top` on top and `right` on +x (three faces that meet at
 * a corner, as on a real die). Its pips are LEDs: dark red by day, glowing at night.
 */
export function die(s: Shape, x: number, y: number, z: number, a: number, front: number, top: number, right: number): void {
  s.box(a, a, a, "white", x, y, z);
  const k = a / 4;
  const o = { glow: true, day: "#9E3A32" } as const;
  for (const [px, py] of PIPS[front]!) s.box(Q, Q, Q / 2, "ledRed", x + px * k, y + a / 2 - Q / 2 + py * k, z + a / 2, o);
  for (const [px, py] of PIPS[top]!) s.slab(Q, Q / 4, Q, "ledRed", x + px * k, y + a, z - py * k, o);
  for (const [px, py] of PIPS[right]!) s.box(Q / 2, Q, Q, "ledRed", x + a / 2, y + a / 2 - Q / 2 + py * k, z - px * k, o);
}

/**
 * A DIP chip lying on the board: a black body w long (along x), lifted on `n` legs a side bent down to the board, a
 * notch and pin 1 marked at its left end, a label printed on top. Returns the height of its top.
 */
export function dipChip(s: Shape, x: number, z: number, n: number, label: string, k = 0.75, h = 0.5, lift = 0.25): number {
  const w = n * 0.25 + 0.25;
  const d = 0.625;
  s.box(w, h, d, "black", x, lift, z);
  for (let i = 0; i < n; i++) {
    const lx = x - ((n - 1) * 0.25) / 2 + i * 0.25;
    for (const sz of [-1, 1]) {
      s.box(Q, Q, 0.1875, "silver", lx, lift + 0.125, z + sz * (d / 2 + 0.0625));
      s.box(Q, lift + 0.25, Q, "silver", lx, 0, z + sz * (d / 2 + 0.125));
      s.pads.push([lx, z + sz * (d / 2 + 0.125)]);
    }
  }
  const top = lift + h;
  s.slab(Q, Q / 4, 0.25, "#4A4A52", x - w / 2 + Q / 2, top, z);
  s.slab(Q, Q / 4, Q, "grey", x - w / 2 + 0.25, top, z + d / 2 - 0.1875);
  s.flatText(label, "white", x + 0.0625, top, z, k);
  return top;
}

// ---------------------------------------------------------------------------------------------------------------
// Making it permanent.

/** A square ring of wire lying flat, `half` from its middle to its outer edge, its bottom at y. */
function flatRing(s: Shape, x: number, y: number, z: number, half: number, col: Col): void {
  for (const sz of [-1, 1]) s.box(2 * half, Q / 2, Q, col, x, y, z + sz * (half - Q / 2));
  for (const sx of [-1, 1]) s.box(Q, Q / 2, 2 * half - 2 * Q, col, x + sx * (half - Q / 2), y, z);
}

/** The soldering iron at rest: a weighted stand, its sponge, the iron leaning in a coil with its tip glowing. */
function ironStand(s: Shape): Built {
  const z = -0.125;
  s.box(1.5, 0.1875, 1.0, "charcoal", 0, 0, -0.0625);
  // the wet sponge in its tray at the front
  s.box(0.625, Q, 0.4375, "steel", 0.375, 0.1875, 0.3125);
  s.box(0.5, Q, 0.3125, "#E0BE4C", 0.375, 0.25, 0.3125);
  // the coil: turns of wire stacked on a slant, held by a post at the back
  const x0 = -0.375;
  const y0 = 0.4375;
  const dx = 0.0625;
  const dy = 0.1875;
  for (let i = 0; i < 6; i++) flatRing(s, x0 + i * dx, y0 + i * dy, z, 0.25, "silver");
  s.box(Q, y0 + 5 * dy - 0.125, Q, "steel", x0 + 2 * dx, 0.1875, z - 0.3125);
  // the iron leans along the coil: its tip glowing below the coil, the handle out of the top
  const at = (k: number): [number, number] => [x0 + k * dx, y0 + k * dy];
  const [tx, ty] = at(-1.25);
  s.box(Q, Q, Q, "orange", tx, ty, z, { glow: true, day: "#C66A2A" });
  s.light(tx, ty + 0.06, z, "orange", 1.2);
  s.smoke.push([tx, ty + 0.1, z]);
  for (let k = -0.75; k <= 5.5; k += 0.5) {
    const [x, y] = at(k);
    s.box(Q, Q, Q, "steel", x, y, z);
  }
  for (let k = 6; k <= 10; k += 1) {
    const [x, y] = at(k);
    s.box(0.25, 0.25, 0.25, k < 7 ? "ink" : "blue", x, y - 0.0625, z);
  }
  return done(s, 2.3, [0.875, 0.625]);
}

const FLANGES: Col[] = ["red", "blue"];

/** A reel of solder on an axle between two posts, a loose end run down to a bright bead on a pad. */
function solderSpool(s: Shape, v: number): Built {
  const f = FLANGES[v % FLANGES.length]!;
  const yc = 0.625;
  for (const sx of [-1, 1]) {
    s.box(0.25, Q, 0.625, "charcoal", sx * 0.5625, 0, 0);
    s.box(Q, yc + Q / 2, 0.25, "steel", sx * 0.5625, Q, 0);
    s.xdisc(0.5, Q, f, sx * 0.375, yc, 0);
  }
  for (let i = 0; i < 5; i++) s.xdisc(0.375, Q, i % 2 ? "#BAC1C9" : "silver", -0.25 + i * Q, yc, 0);
  s.xdisc(0.125, Q, "charcoal", 0.5, yc, 0);
  // the loose end, and the bead it made
  s.box(Q, Q, 0.4375, "silver", 0.125, 0.25, 0.5625);
  s.box(Q, 0.25, Q, "silver", 0.125, 0, 0.75);
  s.box(0.25, Q / 2, 0.25, "silver", 0.125, 0, 0.875);
  s.pads.push([0.125, 0.875]);
  return done(s, 1.3, [0.75, 0.625]);
}

/** A 7805 regulator: a black body on three legs, its metal tab with a mounting hole standing above. */
function regulator(s: Shape): Built {
  for (const x of [-0.25, 0, 0.25]) lead(s, x, 0.0625, 0.375);
  s.box(1.0, 1.25, Q, "silver", 0, 0.375, -0.1875);
  s.vdisc(0.125, Q, "charcoal", 0, 1.375, -0.125);
  s.box(1.0, 0.75, 0.375, "black", 0, 0.375, 0.0625);
  s.text("7805", "#C4CAD2", 0, 1.0, 0.25, 0.5);
  s.slab(0.5, Q / 2, Q / 2, "grey", 0, 0.5, 0.25);
  return done(s, 1.75, [0.625, 0.375]);
}

// ---------------------------------------------------------------------------------------------------------------
// Chips.

/** The 555: an eight-legged black chip; one look has a red LED blinking beside it. */
function chipBlock(s: Shape, v: number): Built {
  const top = dipChip(s, 0, 0, 4, "555");
  if (v % 2) smallLed(s, 0.875, 0.375, 0.5, "ledRed", true);
  return done(s, top + 0.2, [0.75, 0.5]);
}

/**
 * A door alarm: a door frame with a reed switch (a glass capsule) on its post and a magnet on the door's edge. The door
 * stands open, so the alarm lamp on the lintel is lit.
 */
function reedGate(s: Shape): Built {
  s.box(1.375, Q / 2, 0.5, "#B9B2A6", 0, 0, 0);
  for (const sx of [-1, 1]) s.box(0.25, 1.375, 0.25, "cream", sx * 0.5625, 0, -0.125);
  s.box(1.375, 0.25, 0.25, "cream", 0, 1.375, -0.125);
  // the door, swung open on its hinge, the magnet on its free edge
  s.box(Q, 1.125, 0.75, "#9A6A44", -0.375, 0.0625, 0.375);
  s.box(Q / 2, Q, Q, "gold", -0.3125, 0.5625, 0.6875);
  s.box(Q, 0.25, Q, "red", -0.3125, 0.875, 0.6875);
  s.box(Q, Q, Q, "silver", -0.3125, 1.125, 0.6875);
  // the reed switch on the other post: two reeds in a glass capsule, its wires down the post
  s.box(Q, 0.5, Q, "glass", 0.4375, 0.75, 0.0625);
  s.slab(Q / 2, 0.25, Q / 2, "silver", 0.4375, 0.8125, 0.125);
  s.slab(Q / 2, 0.25, Q / 2, "silver", 0.4375, 1.0, 0.125);
  s.slab(Q / 2, 0.75, Q / 2, "ink", 0.4375, 0, 0.0625);
  s.pads.push([0.4375, 0.1875]);
  // the alarm lamp, lit: the door is open
  s.box(0.25, Q, 0.25, "charcoal", 0, 1.625, -0.125);
  s.box(0.25, 0.25, 0.25, "ledRed", 0, 1.75, -0.125, { glow: true, day: "#C0392F" });
  s.light(0, 1.85, -0.125, "ledRed", 1.6);
  return done(s, 2.1, [0.75, 0.5]);
}

const GATES: [string, boolean[], boolean][] = [
  ["AND", [true, true], true],
  ["OR", [false, true], true],
  ["NOT", [false], true],
];

/** A fourteen-legged logic chip with its gate printed on top, LEDs at its ends showing its inputs and its output. */
function logicChip(s: Shape, v: number): Built {
  const [label, ins, out] = GATES[v % GATES.length]!;
  const top = dipChip(s, 0, 0, 7, label);
  ins.forEach((on, i) => smallLed(s, -1.1875, (i - (ins.length - 1) / 2) * 0.25, 0.625, "ledGreen", on, "#3F9A55"));
  smallLed(s, 1.1875, 0, 0.625, "ledRed", out);
  return done(s, top + 0.2, [1.25, 0.5]);
}

const DIGITS = [8, 2, 5];

/** A seven-segment display standing on its legs, one digit showing. */
function sevenSegPiece(s: Shape, v: number): Built {
  for (const x of [-0.25, 0, 0.25]) for (const z of [-0.0625, 0.0625]) lead(s, x, z, 0.25);
  s.box(1.0, 1.5, 0.375, "ink", 0, 0.25, 0);
  sevenSeg(s, DIGITS[v % DIGITS.length]!, -0.0625, 1.625, 0.1875);
  s.box(Q, Q, Q, "ledRed", 0.375, 0.375, 0.1875, { glow: true, day: "#C0392F" });
  s.light(0, 1.0, 0.45, "ledRed", 1.6);
  return done(s, 1.95, [0.625, 0.375]);
}

const FACES: [number, number, number][] = [
  [5, 1, 3],
  [3, 2, 6],
  [6, 4, 5],
];

/** An LED die on a chip that rolls it. */
function diceBlock(s: Shape, v: number): Built {
  const [front, top, right] = FACES[v % FACES.length]!;
  s.box(0.875, 0.25, 0.875, "black", 0, 0.125, 0);
  for (const x of [-0.25, 0, 0.25])
    for (const sz of [-1, 1]) {
      s.box(Q, 0.25, Q, "silver", x, 0, sz * 0.5);
      s.pads.push([x, sz * 0.5]);
    }
  die(s, 0, 0.375, 0, 0.75, front, top, right);
  s.light(0.1, 0.8, 0.3, "ledRed", 1.3);
  return done(s, 1.35, [0.625, 0.625]);
}

// ---------------------------------------------------------------------------------------------------------------
// Beyond.

const WOOD: Col = "#A07A4E";

/** An electromagnet crane: a bolt wound with copper hangs from a little gantry, a paperclip caught on its tip. */
function coilBolt(s: Shape): Built {
  s.box(1.375, Q, 0.875, WOOD, 0, 0, 0);
  s.box(0.25, 1.75, 0.25, WOOD, -0.5, Q, -0.25);
  s.box(1.0, 0.1875, 0.25, WOOD, -0.125, 1.75, -0.25);
  const bx = 0.25;
  const bz = -0.25;
  // the bolt: hex head under the arm, a shaft through the windings, the tip below them
  s.box(0.375, Q, 0.375, "steel", bx, 1.625, bz);
  s.box(Q, 1.0, Q, "steel", bx, 0.625, bz);
  for (let i = 0; i < 5; i++) s.cyl(0.25, Q, i % 2 ? "copperDark" : "copper", bx, 0.8125 + i * Q, bz);
  // a paperclip lifted off the base, and two still lying there
  for (const sx of [-1, 1]) s.box(Q, 0.375, Q, "silver", bx + sx * 0.125, 0.25, bz);
  s.box(0.375, Q, Q, "silver", bx, 0.25, bz);
  s.box(0.375, Q, Q, "silver", bx, 0.5, bz);
  for (const [x, z] of [[0.375, 0.25], [-0.0625, 0.3125]] as const) {
    s.slab(0.375, Q / 4, Q / 2, "silver", x, Q, z - 0.0625);
    s.slab(0.375, Q / 4, Q / 2, "silver", x, Q, z + 0.0625);
  }
  // a cell lying on the base, wired to the windings
  for (let i = 0; i < 4; i++) s.xdisc(0.125, Q, i === 0 ? "black" : "orange", -0.5 + i * Q, 0.25, 0.25);
  s.slab(Q / 2, Q / 2, Q / 2, "silver", -0.0625, 0.21875, 0.25);
  s.slab(Q / 2, 0.75, Q / 2, "red", 0.0, 0.1875, 0.25);
  s.slab(Q / 2, Q / 2, 0.25, "red", 0.0, 0.9375, 0.125);
  s.slab(Q / 2, 0.375, Q / 2, "ink", -0.625, 0.1875, 0.25);
  return done(s, 2.15, [0.75, 0.5]);
}

/** A ring of pixels standing in the xy plane, its lower half (a U) or the whole of it: centre (x, yc), radii rin to rout. */
function bowl(s: Shape, x: number, yc: number, z: number, rout: number, rin: number, col: Col, depth: number): void {
  const n = Math.round(rout / Q);
  for (let j = 0; j < n; j++) {
    const dy = (j + 0.5) * Q;
    let run0: number | null = null;
    for (let i = -n; i <= n; i++) {
      const d = Math.hypot((i + 0.5) * Q, dy);
      const inside = i < n && d >= rin && d <= rout;
      if (inside && run0 === null) run0 = i;
      if (!inside && run0 !== null) {
        const w = (i - run0) * Q;
        s.box(w, Q, depth, col, x + run0 * Q + w / 2, yc - (j + 1) * Q, z);
        run0 = null;
      }
    }
  }
}

/** A magnet: a red horseshoe with silver poles and a clip clinging to one, or a bar magnet over a compass. */
function magnet(s: Shape, v: number): Built {
  if (v % 2 === 0) {
    s.box(1.0, Q, 0.5, "charcoal", 0, 0, 0);
    bowl(s, 0, 0.625, 0, 0.5, 0.25, "red", 0.375);
    for (const sx of [-1, 1]) {
      s.box(0.25, 0.5, 0.375, "red", sx * 0.375, 0.625, 0);
      s.box(0.25, 0.25, 0.375, "silver", sx * 0.375, 1.125, 0);
    }
    // a paperclip hangs from the right pole's front
    for (const x of [0.3125, 0.5625]) s.box(Q, 0.4375, Q, "silver", x, 0.875, 0.25);
    s.box(0.375, Q, Q, "silver", 0.4375, 0.8125, 0.25);
    return done(s, 1.45, [0.625, 0.375]);
  }
  for (const sx of [-1, 1]) s.box(0.25, 0.25, 0.375, "charcoal", sx * 0.375, 0, -0.125);
  s.box(0.625, 0.375, 0.375, "red", -0.3125, 0.25, -0.125);
  s.box(0.625, 0.375, 0.375, "blue", 0.3125, 0.25, -0.125);
  s.text("N", "white", -0.3125, 0.5625, 0.0625, 0.5);
  s.text("S", "white", 0.3125, 0.5625, 0.0625, 0.5);
  // a compass in front, its red needle drawn to the south pole
  s.cyl(0.25, Q, "white", 0, 0, 0.4375);
  s.slab(0.25, Q / 4, Q, "red", 0.125, Q, 0.4375);
  s.slab(0.25, Q / 4, Q, "grey", -0.125, Q, 0.4375);
  return done(s, 0.75, [0.75, 0.625]);
}

/**
 * A crystal set on its baseboard: the tuning coil wound on a tube, the telescopic antenna raised beside it, and an
 * earth wire run to a copper stake.
 */
function antenna(s: Shape): Built {
  s.box(1.25, Q, 0.875, WOOD, 0, 0, 0);
  // the coil: copper turns on a cream tube
  const cx = -0.3125;
  const cz = 0.0625;
  s.cyl(0.25, Q, "cream", cx, Q, cz);
  for (let i = 0; i < 6; i++) s.cyl(0.25, Q, i % 2 ? "copperDark" : "copper", cx, 0.25 + i * Q, cz);
  s.cyl(0.25, Q, "cream", cx, 1.0, cz);
  // the antenna, narrowing as it rises, a ball on its tip, its lead to the top of the coil
  const ax = 0.3125;
  const az = -0.1875;
  s.box(0.25, 0.25, 0.25, "charcoal", ax, Q, az);
  s.slab(0.1875, 0.75, 0.1875, "silver", ax, 0.375, az);
  s.slab(0.125, 0.75, 0.125, "#DDE2E8", ax, 1.125, az);
  s.slab(0.0625, 0.75, 0.0625, "silver", ax, 1.875, az);
  s.slab(0.1875, 0.1875, 0.1875, "silver", ax, 2.625, az);
  s.slab(0.5, Q / 2, Q / 2, "ink", 0.0625, 0.875, az);
  // the earth: a green wire to a copper stake at the front
  s.slab(Q / 2, Q / 2, 0.375, "green", 0.1875, Q, 0.25);
  s.box(Q, 0.25, Q, "copper", 0.1875, Q, 0.4375);
  s.box(0.25, Q / 2, 0.25, "copper", 0.1875, 0.375, 0.4375);
  return done(s, 2.9, [0.75, 0.5]);
}

const BOARDS: Col[] = ["#1F6FB8", "#2E8A47"];

/** A little microcontroller board on standoffs: a square chip, two header rows, a USB socket, two LEDs. */
function mcuBoard(s: Shape, v: number): Built {
  const c = BOARDS[v % BOARDS.length]!;
  for (const x of [-0.875, 0.875]) for (const z of [-0.5, 0.5]) s.box(Q, 0.25, Q, "gold", x, 0, z);
  s.box(2.0, Q, 1.25, c, 0, 0.25, 0);
  const y = 0.375;
  for (const sz of [-1, 1]) {
    s.box(1.5, 0.1875, 0.1875, "black", 0.125, y, sz * 0.5);
    for (let i = 0; i < 6; i++) s.slab(Q / 2, 0.125, Q / 2, "gold", -0.5 + i * 0.25, y + 0.1875, sz * 0.5);
  }
  s.slab(0.625, Q / 4, 0.625, "silver", 0.125, y, 0);
  s.box(0.5, Q, 0.5, "ink", 0.125, y + Q / 4, 0);
  s.box(0.375, 0.25, 0.375, "silver", -0.875, y, 0);
  s.box(0.25, Q / 2, 0.25, "#3A3B42", -0.875, y + 0.25, 0);
  for (const [z, col, day] of [[0.1875, "ledGreen", "#3FB45A"], [-0.1875, "amber", "#D9962F"]] as const) {
    s.box(Q, Q, Q, col, 0.75, y, z, { glow: true, day });
    s.light(0.75, y + 0.1, z, col, 0.9);
  }
  return done(s, 0.9, [1.125, 0.75]);
}

export function buildPiece(s: Shape, kind: string, v: number): Built {
  switch (kind) {
    case "resistor":
      return resistor(s, v);
    case "led-lamp":
      return ledLamp(s, v);
    case "battery":
      return battery(s, v);
    case "meter-kiosk":
      return meterKiosk(s);
    case "fuse":
      return fuse(s);
    case "test-lead-arch":
      return testLeadArch(s);
    case "cell-jar":
      return cellJar(s, v);
    case "switch":
      return switchPost(s, v);
    case "pushbutton":
      return pushbutton(s, v);
    case "relay":
      return relay(s);
    case "breadboard-patch":
      return breadboardPatch(s);
    case "jumper-arch":
      return jumperArch(s, v);
    case "capacitor":
      return capacitor(s, v);
    case "ceramic-cap":
      return ceramicCap(s, v);
    case "pot":
      return pot(s, v);
    case "transistor":
      return transistor(s);
    case "phototransistor":
      return phototransistor(s);
    case "speaker":
      return speaker(s, v);
    case "diode":
      return diode(s);
    case "wire-spool":
      return wireSpool(s, v);
    case "heatsink":
      return heatsink(s, v);
    case "header-fence":
      return headerFence(s);
    case "moss":
      return moss(s, v);
    case "tuft":
      return tuft(s, v);
    case "lemon-tree":
      return lemonTree(s, v);
    case "iron-stand":
      return ironStand(s);
    case "solder-spool":
      return solderSpool(s, v);
    case "regulator":
      return regulator(s);
    case "chip-block":
      return chipBlock(s, v);
    case "reed-gate":
      return reedGate(s);
    case "seven-seg":
      return sevenSegPiece(s, v);
    case "logic-chip":
      return logicChip(s, v);
    case "dice-block":
      return diceBlock(s, v);
    case "coil-bolt":
      return coilBolt(s);
    case "magnet":
      return magnet(s, v);
    case "antenna":
      return antenna(s);
    case "mcu-board":
      return mcuBoard(s, v);
    case "dock":
      return dock(s);
    default:
      s.box(0.5, 0.5, 0.5, "grey", 0, 0, 0);
      return done(s, 0.6, null);
  }
}

/** Pieces small enough to drop out when the camera is far away. */
export const SMALL = new Set(["moss", "tuft", "pushbutton", "ceramic-cap", "transistor", "phototransistor", "header-fence", "pot", "diode", "jumper-arch", "fuse"]);
