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
    case "dock":
      return dock(s);
    default:
      s.box(0.5, 0.5, 0.5, "grey", 0, 0, 0);
      return done(s, 0.6, null);
  }
}

/** Pieces small enough to drop out when the camera is far away. */
export const SMALL = new Set(["moss", "tuft", "pushbutton", "ceramic-cap", "transistor", "phototransistor", "header-fence", "pot", "diode", "jumper-arch", "fuse"]);
