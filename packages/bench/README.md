# @ohmland/bench

The 3D lab workbench for Ohmland: a warm wooden desk with a solderless breadboard, procedural part models,
a handheld multimeter, crocodile test leads and jumper wires. Learners drag parts from a tray, snap them into the
board, wire it up and probe it. The simulator (`@ohmland/sim`) drives what they see: LEDs glow, resistors smoke,
fuses blow, relays click, the meter reads.

React Three Fiber components, consumed from source (`"exports": { ".": "./src/index.ts" }`). Every model is built in
code: no downloaded model or image files, no third-party model libraries.

![Bench](screenshots/bench-desktop.png)

## Quick start

```tsx
import { Bench, benchToNetlist, emptyBench, type BenchState } from "@ohmland/bench";

function Lab({ sim }) {
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => sim.onSnapshot(setSnapshot), [sim]);
  return (
    <Bench
      initial={emptyBench({ kind: "bb830" })}
      tray={[{ kind: "resistor", params: { ohms: 470 } }, { kind: "led", params: { color: "red" } }, { kind: "battery", params: { snap: true } }]}
      snapshot={snapshot}
      onChange={(bench) => sim.load(benchToNetlist(bench).netlist)}
      onAction={(a) => a.type === "input" && sim.setInput(a.partId, a.key, a.value)}
    />
  );
}
```

`<Bench />` fills its parent; give the parent a size.

## Public API

### `<Bench />`

| Prop | Type | |
|---|---|---|
| `initial` | `BenchState` | Starting bench (ignored when `store` is given). |
| `store` | `BenchStore` | Drive the bench from your own store (`createBenchStore`). |
| `tray` | `TrayItem[]` | Parts the learner can drag in. `count` limits how many may be placed; `id` names the placed part when that id is free. |
| `snapshot` | `Snapshot \| null` | Latest simulator snapshot. Reads `glow`, `health`, `closed`, `display`, `unit` per part id. Leave it out when you own the store and set `snapshot` on it yourself (the lab runtime does, 30 times a second, without re-rendering React above the canvas). |
| `onChange` | `(bench) => void` | After every committed change (not during a drag, and not for the initial bench). Rebuild the netlist here. |
| `onAction` | `(action: BenchAction) => void` | Every user action. `type: "input"` actions (pushbutton `pressed`, switch `to`, trimmer `position`, meter `mode`) are meant for `sim.setInput`. |
| `quality` | `"high" \| "low"` | High: soft shadows, bloom, outline, glass transmission, DPR up to 2. Low: no shadows or post-processing, sprite halos for glow, DPR up to 1.5. |
| `readOnly` | `boolean` | Camera only; no tray, no edits. |
| `locked` | `string[]` | Part ids that cannot be moved, rotated or deleted (switches still flip, buttons still press). |
| `highlight` | `string[]` | Part ids (pulsing amber frame) or anchors such as `"hole:e12"`, `"pin:R1.a"` (pulsing ring) for lab hints. |
| `labels` | `Partial<BenchLabels>` | Translated UI strings (see `DEFAULT_LABELS`). |
| `camera` | `{ position, target }` | Initial camera; defaults to a fit of the whole bench. |
| `frame` | `[x0, z0, x1, z1] \| null` | Desk rectangle (mm) that the first camera and reset view frame, instead of the whole bench. |
| `controllerRef` | `Ref<BenchController>` | `topView()`, `resetView()`, `project(anchor)` (page coordinates), `pickAt(x, y)` (what is under a point), `stats()` (draw calls). |
| `onReady` | `() => void` | After the first frames have rendered. |

Interaction: drag parts from the tray (or tap a tray item, then tap the bench). Drag a part to move it; its leads snap
into the nearest free holes that fit its footprint, or it lies on the desk. Drag a resistor or diode lead to stretch it
(3 to 8 holes). Wire mode: click a hole then another (or drag between them); pick the colour in the toolbar.
Drag crocodile clips, probe tips and banana plugs; they snap to the nearest lead, terminal, wire end, hole or socket.
Turn the meter dial by dragging it, clicking it (next position) or clicking a label. Hover a hole (or tap it on touch)
to see everything metal-connected to it through the board; the X-ray toggle shows every strip. Right-click or
long-press for a context menu.

Keyboard (the bench is focusable): arrows move the selected part one hole (or turn a selected trimmer, or the meter
dial), `R` rotates, `Delete` removes, `Space` presses a selected pushbutton or flips a switch, `W` wire mode, `X` x-ray,
`T` top view, `Escape` cancels, `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` redo.

Camera: left drag orbits (limited to the front half and above the desk), right drag pans within the work area, wheel
or pinch zooms toward the cursor. Rendering is on demand: nothing is drawn while nothing changes, except while smoke
or a hint pulse animates.

### `benchToNetlist(bench, opts?)`

```ts
const { netlist, nodeOf, warnings } = benchToNetlist(bench);
nodeOf("pin:D1.anode") === nodeOf("pin:B1.pos"); // same node?
```

Union-find over: the five-hole terminal strips (a to e, f to j, the centre channel keeps them apart), the four power
rails (or eight halves with `splitRails`), leads seated in holes, leads joined inside a part (the pushbutton's facing
legs), jumper wire ends, crocodile clips (a lead is one conductor) and meter probes. The meter becomes a `multimeter`
part whose `com`, `vohm`, `ma` and `a10` pins are whatever the plug in that socket reaches through its probe tip; an
empty socket floats. Leads that touch nothing get their own node. The first battery's minus terminal (else the first
lemon cell's) is `"gnd"`. Other nodes are named after what is in them: a strip (`"14a-e"`), a rail (`"tp"`), or a
lead (`"R1.a"`).

Each crocodile lead becomes a simulator `wire` part with `leadOhms` (default 0.15 Ω), so high-current circuits see
realistic totals; its two clips are separate nodes. `benchToNetlist(bench, { leadOhms: 0 })` merges them (an ideal
conductor), which is what topology checks want. Resistors pass their nominal `ohms`, `tolerance` (percent / 100) and
`actualOhms`; capacitors `actualFarads`; pushbuttons `normallyClosed`.

`warnings` lists problems the learner may need to hear about: `hole-shared` (two leads in one hole), `hole-missing`,
`clip-missing`, `no-ground`.

Part mapping: resistor, led, diode, npn, phototransistor and fuse map one to one; slide and toggle switches are `spdt`;
ceramic and electrolytic capacitors are `capacitor` (`polarized` set); the trimmer is `pot`; the cup of water is
`probe-resistance` (distilled 600 kΩ, tap 30 kΩ, salty 1.2 kΩ); the lemon is a `cell`. The DPDT relay becomes two
simulator relays, `K1` and `K1:2`, whose coils sit in parallel at twice the coil resistance (and inductance) each,
so coil current and pull-in voltage match one real coil; a `poles: 1` relay is one simulator relay. The DPDT switch is a
simulator `dpdt` (two poles on one slider). Touch pads are a `probe-resistance` (a fingertip, 100 kOhm to 2 MOhm, set with the
`ohms` input). A mystery part (`mystery: "31402"`) is wired through its permutation: terminal i is the leg the
permutation names, so the netlist sees the real wiring while the model shows only numbers.

`connectivity(bench)` gives the metal-contact groups without building a netlist (used by the x-ray view).

### `@ohmland/bench/core`

The pure half of the package, with no React Three Fiber and no three.js: `benchOps`, `benchToNetlist`,
`connectivity`, anchors, board geometry, `partDef`, `partPose`, `fitCamera`, `createBenchStore` (React and zustand
only) and the types. Lab runtimes import it before the 3D view loads, and headless solution replays and tests use it
in Node.

### Store

`createBenchStore(initial)` returns a zustand store; `useBench(selector)` and `useBenchStore()` read the nearest
`<Bench>`'s store. State: `bench`, `past`/`future` (undo, 100 steps), `snapshot`, `ui` (selection, hover, mode, wire
colour, x-ray, drag state). Actions: `addPart`, `movePart`, `rotatePart`, `removePart`, `setParams`, `addWire`,
`removeWire`, `addLead`, `clipLead`, `removeLead`, `setMeterMode`, `plugProbe`, `touchProbe`, `press`, `undo`, `redo`,
`load`, `apply(fn)` and `begin`/`commit`/`cancel` (drags are one undo step).

The same operations exist as pure functions in `benchOps` (`movePart`, `fitOnBoard`, `moveSpanLeg`, `addWire`,
`clipLead`, `touchProbe`, ...), so a lab can script its solution without React.

### Models and previews

- `<PartPreview kind params state pose spin quality />`: one part on a slow turntable (its own canvas), framed
  automatically. `kind` can also be `"multimeter"` (`params: { mode, display, unit }`).
- `<PartGallery items? />`: every part in rows with name cards.
- For custom R3F scenes: `PartModel`, `MultimeterModel`, `Breadboard`, `AlligatorClip`, `BananaPlug`, `Probe`,
  `JumperWire`, `StudioEnvironment`, `StudioLights`, `Desk`.

Helpers: `resistorBands(ohms, 4 | 5)`, `bandsToOhms`, `formatOhms`, `formatFarads`, `ceramicCode`, `boardGeometry`,
`parseHole`, `holeWorld`, `partPose`, `anchorPosition`, `clipTargets`, `PART_KINDS`, `partDef`, `partLegs(part)` (the
leads a placed part actually has: a single-pole relay has five, a one-throw toggle two), `isThrowSwitch(kind)`.

Mystery parts: `shuffleFor(seed, n)` gives a permutation (never the identity) from any string, `physicalLeg(part,
leg)` is the terminal wired as `leg`, `wiredAs(part, terminal)` the reverse, and `terminalNumber(part, leg)` the
number printed beside a terminal.

## BenchState

Plain JSON, millimetres on the desk (x right, z toward the viewer, y up).

```ts
type BenchState = {
  v: 1;
  board: { kind: "bb830" | "bb400"; splitRails?: boolean; pos?: [x, z] } | null;
  parts: {
    id: string;                 // "R1", "D1", "K1"
    kind: BenchPartKind;
    params: PartParamsMap[kind];  // resistor { ohms, bands?, tolerance?, watts? }, led { color, size?, lens? }, ...
    pos: [x, z];                // body position when on the desk
    rot: number;                // degrees (quarter turns on the board)
    holes?: { [lead]: HoleId }; // "a1".."j63", rails "tp3" (far +), "tn3" (far -), "bp3" (near +), "bn3" (near -)
    ends?: { [lead]: [x, z] };  // free ends of flexible leads (battery snap, speaker wires)
  }[];
  wires: { id: string; a: HoleId; b: HoleId; color: WireColor }[];
  leads: { id: string; color: LeadColor; a: LeadEnd; b: LeadEnd }[];   // crocodile test leads
  meter: {
    id: string;                 // "M1"
    pos: [x, z]; rot: number;
    mode: "off" | "dcv" | "acv" | "dca-ma" | "dca-10a" | "ohm" | "continuity" | "diode";
    range?: string;
    probes: { red: MeterProbe; black: MeterProbe };  // { socket: "com" | "vohm" | "ma" | "a10" | null, plugPos, tip: LeadEnd }
  } | null;
};
type LeadEnd = { to: Anchor | null; pos: [x, z] };
// Anchor: "hole:e12" | "pin:R1.a" | "wire:W1.b" | "lead:TL1.a" | "probe:red" | "socket:com"
```

Lead names per part: resistor `a b`; diode and LED `anode cathode`; phototransistor `e c`; npn `e b c` (flat face
toward you, left to right); ceramic `a b`; electrolytic `pos neg`; trimmer `a wiper b`; slide and toggle switches
`a com b`; pushbutton `a1 a2 b1 b2` (a1 and a2 face each other across the channel and are always joined); relay
`coil1 coil2 com1 nc1 no1 com2 nc2 no2` (DIP-16 positions 1, 4, 6, 8 per side; `poles: 1` keeps the first five);
DPDT switch `a1 com1 b1 a2 com2 b2`; fuse, speaker, cup and touch pads `a b`; battery and lemon `pos neg`.

Footprints (board pitch 2.54 mm): LED and phototransistor 2 adjacent holes; small electrolytics 2 adjacent holes,
8 mm cans and up 2 holes apart; ceramic discs 2 holes apart; transistor, trimmer and slide switch 3 adjacent holes;
toggle switch 3 lugs 2 holes apart; pushbutton 4 legs straddling the channel; relay 8 pins straddling the channel;
fuse clips 4 holes apart; resistor and diode 3 to 8 holes; capacitors bend their legs to `span` holes (1 to 7); touch
pads 2 holes apart.

Desk modules: `base: true` on a pushbutton, slide or toggle switch, trimmer or relay (and every DPDT switch) puts the
part on a wooden block with brass screw terminals for clip leads (`tag` prints a name on its front). Base parts stay on
the desk. A mystery relay or DPDT switch has an opaque cover and numbered terminals; `peek: true` shows the inside.

## Playground

```bash
pnpm --filter @ohmland/bench dev     # vite playground, http://localhost:5199
```

- `/` the demo bench (LED + 470 Ω + 9 V battery on the board, meter across the LED, a test lead) with the full tray
  and a mock snapshot panel: LED glow sliders, health per part, meter display text and unit, relay closed. The panel
  also lists the live netlist and the action log.
- `?scene=clips` a section-one bench with no board, everything joined by crocodile leads; `?scene=smoke` a small
  board with an overloaded resistor; `?scene=empty`, `?scene=half` (400-point board).
- `?mode=gallery` every part in rows (`&rows=0-3`, `&row=2`, `&focus=4` for a close-up).
- `?mode=preview` a few `<PartPreview>` turntables.
- Screenshot helpers: `q=low`, `panel=0`, `tray=0`, `glow=0.8`, `health=R1:smoking,D1:dead`, `display=OL`,
  `unit=kΩ`, `closed=1`, `hover=hole:e12`, `xray=1`, `select=R1`, `hint=R1,hole:e12`, `cam=x,y,z&target=x,y,z`.

## Tests and screenshots

```bash
pnpm --filter @ohmland/bench test        # Vitest: netlist, snapping, colour code
pnpm --filter @ohmland/bench typecheck
pnpm --filter @ohmland/bench shots       # Playwright: interaction check + screenshots into screenshots/
```

The Playwright run starts the playground itself. On macOS headless Chromium renders WebGL through Metal; elsewhere the
config switches to SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`). If Chromium is missing:
`pnpm --filter @ohmland/bench exec playwright install chromium`. Screenshots are quantised to stay small when
ImageMagick (`magick`) is installed.

## Notes

- Render on demand also holds while the simulator runs: each part model subscribes to its own simulator state and
  re-renders only when something visible changes (health, glow in 2% steps, contacts, the meter display), and a
  snapshot that changes nothing visible draws no frame. `onChange` fires once a drag commits (its transaction closes),
  not only when the bench object changes.
- The toggle switch has a desk variant, `params.base: true`: panel-mounted in a small wooden block with three screw
  terminals (`a`, `com`, `b`) and ON/OFF marks (thrown to `b` is ON). It never goes into the board.
- On phones (compact layout) the selection bar shows no colour swatches (they would cover the bench); recolour from
  the long-press menu. Without a board the Wire and X-ray tools are hidden. A lead dropped from the tray leaves its
  loose clip toward the middle of the work area, so it stays in view.

- Scale is real: 1 scene unit is 1 mm, board pitch 2.54 mm, 9 V battery 48.5 x 26.5 x 17.5 mm, 5 mm LED with a
  5.8 mm rim, 1/4 W resistor 6.3 mm long. Shapes are simplified but proportioned after datasheet packages.
- Colour bands follow the standard code (4 bands: two digits, multiplier, gold 5 %; 5 bands: three digits,
  multiplier, brown 1 %), drawn as raised rings with metallic gold and silver.
- Performance: one instanced draw for all 830 hole pits and one for the x-ray strips, shared geometries and
  materials, render on demand, DPR capped at 2 (1.5 on low). A populated board is about 180 draw calls.
- The bench never imports the simulator at runtime; it only uses its types.
