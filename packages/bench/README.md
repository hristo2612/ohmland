# @ohmland/bench

The lab workbench for Ohmland: a solderless breadboard, procedural part models, a handheld multimeter, mini clip
test leads and jumper wires on a sheet of the notebook's grid paper. Learners drag parts from a tray, snap them into
the board, wire it up and probe it. The simulator (`@ohmland/sim`) drives what they see: LEDs glow, resistors smoke,
fuses blow, relays click, the meter reads.

Two interchangeable views draw the same bench (docs/BENCH-VIEWS.md): the 3D bench on paper (this package's React
Three Fiber scene) and the 2D ink bench (`src/ink`). `<BenchView>` switches between them on one store.

Consumed from source (`"exports"`: `.` everything, `./core` the pure half, `./view` the view switcher and controller
types without three.js). Every model is built in code: no downloaded model or image files, no third-party model
libraries.

![Bench](screenshots/bench-desktop.png)

![First glow, spotlight on the LED and resistor](screenshots/spotlight.png)

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

## Two views: `<BenchView>`

```tsx
import { BenchView, type BenchController } from "@ohmland/bench/view"; // no three.js until the 3D view is shown

const ctrl = useRef<BenchController | null>(null);
<BenchView view={settings.benchView === "ink" ? "ink" : "3d"} store={runtime.store} tray={tray} controllerRef={ctrl} />;
ctrl.current?.focus(["part:R1", "part:D1"]);
ctrl.current?.spotlight(["part:D1"]);
```

`BenchView` takes the `<Bench>` props plus `view: "3d" | "ink"` and lazy-loads the renderer (`preloadBenchView(view)`
warms it). It keeps one store for its life, so switching views loses nothing; while the next renderer's code loads,
the current one stays on screen. Its `controllerRef` receives a hub that stays the same object across switches:
overlays subscribe to `onViewChange` once, and the last `focus` and `spotlight` carry over to the new view.
`hub.inner()` is the active view's own controller (in 3D, a `Bench3DController`).

### `BenchController`

| Method | |
|---|---|
| `project(target)` | `{ x, y, visible }` in CSS px relative to the bench element (null for an unknown target). Cheap: call it from every overlay on every view change. |
| `onViewChange(cb)` | Called once per drawn frame in which the camera, the canvas size or the bench changed (so overlays follow drags too). Returns an unsubscribe. |
| `focus(targets, { padding?, instant? })` | Frames the targets from the front (turned a quarter on tall screens when they are wide), with some bench around them; smooth unless reduced motion or `instant`. An empty list frames the work area. |
| `spotlight(targets \| null)` | Lays a veil of the page colour over everything else (their ink fades with it) and rings each target in red pencil. `null` lifts it. |

Targets: `part:D1` (a part, from its rendered model; `part:M1` is the meter), `part:M1/display`, `part:M1/dial`,
`part:M1/com` (any socket), `lead:TL1` and `wire:W1` (whole), and any anchor: `hole:e12`, `pin:R1.a`, `wire:W1.b`,
`lead:TL1.a`, `probe:red`, `socket:com`. `parseTarget` and `targetPoint` (a renderer-free point) are exported for
other views.

`Bench3DController` adds `project([x, y, z])` for world points, `projectClient(target)` (page coordinates, for tests),
`topView()`, `resetView()`, `atHome()`, `pickAt(x, y)` and `stats()` (draw calls of the last frame, all passes).

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
| `quality` | `"high" \| "low"` | High: ink outlines, bloom, the key light's soft shadow map, DPR up to 2. Low: no post-processing (so no ink lines), contact shadows only, DPR up to 1.5. Both draw the paper and the contact shadows. |
| `readOnly` | `boolean` | Camera only; no tray, no edits. |
| `locked` | `string[]` | Part ids that cannot be moved, rotated or deleted (switches still flip, buttons still press). |
| `highlight` | `string[]` | Part ids (pulsing red pencil frame) or anchors such as `"hole:e12"`, `"pin:R1.a"` (pulsing ring) for lab hints. |
| `labels` | `Partial<BenchLabels>` | Translated UI strings (see `DEFAULT_LABELS`). |
| `camera` | `{ position, target }` | Initial camera; defaults to a framing of the work area (measured from the rendered models on the first frame). |
| `frame` | `[x0, z0, x1, z1] \| null` | Desk rectangle (mm) that the first camera and reset view frame, instead of the whole bench. |
| `theme` | `"light" \| "dark"` | Page colours. By default the bench reads the page's notebook tokens (`--paper`, `--grid`, `--ink`, `--blue`, `--red`, ...) and follows theme changes. |
| `margin` | `boolean` | The notebook's rose margin line, a few cells left of the work area (default true). |
| `controllerRef` | `Ref<BenchController>` | Receives a `Bench3DController` (above). |
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
or pinch zooms toward the cursor. A double click or double tap on a part frames it; on the empty desk it frames the
work area again. The first view, and the view after a resize while the learner has not moved the camera, frames the
work area: the lab's `frame` when it sets one, else the board, the parts, the meter and the leads that hold
something. Rendering is on demand: nothing is drawn while nothing changes, except while smoke or a hint pulse
animates.

Chrome is quiet and appears only when it means something: Wire and X-ray with a breadboard, undo and redo once there is
history, "reset view" once the camera has moved, the selection bar while something is selected, the tray while it
holds something left to place (one column for up to seven items).

### The paper look

- The desk is grid paper drawn in a shader (5 mm cells, about 24 CSS px at a lab's usual framing, rules about one pixel
  wide from any distance) in the page colour exactly: the page is unlit and a tone curve leaves colours below 0.94
  alone. The rose margin line sits left of the work area.
- Light is soft and low in contrast: a strong sky fill, one gentle key light and a cool rim. Materials are made matte
  and slightly quieter as they first appear (`paperizeMaterial`); metals turn a soft pencil grey; resistor bands keep
  their exact colours. Glass is plain see-through plastic.
- Contact shadows under everything on the page and on the board, plus the key light's shadow map on high quality, are
  drawn again only when the bench changes: orbiting the camera redraws neither.
- Ink: on high quality a screen-space pass draws a pen line just outside every silhouette from the depth buffer
  alone (no second render of the scene), 1.6 CSS px wide. It was chosen over inverted hulls from the design study
  (`design/round2/lessons/bench-look`): it looks the same, costs one full-screen pass instead of doubling the draw
  calls, and does not outline each mesh of a part separately.
- Glows are a tinted wash on a light page and add light on the night page (or with the room lights down).

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
conductor), which is what topology checks want. Each plugged-in meter probe lead is a `wire` of `probeOhms` (default
0.1 Ω, 0 when `leadOhms` is 0) named `M1:red` / `M1:black`, so touching the tips together reads about 0.2 Ω.
Resistors pass their nominal `ohms`, `tolerance` (percent / 100) and `actualOhms`; capacitors `actualFarads`;
pushbuttons `normallyClosed`.

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

### Lab props (Unit 1)

Desk-only kinds built for the Unit 1 labs, in the same procedural style (`models/LabProps.tsx`):

| Kind | Model | Leads | Simulator |
|---|---|---|---|
| `holder` | Block with two brass spring clips and two screw terminals | `a b` | none: the seated resistor's leads join `a` and `b` |
| `station` | Battery tester: bay, red + and black − posts, a LOAD rocker, the 100 Ω load on show | `a b` | `T1:load` resistor (`loadOhms`) when `load` is on; the seated battery joins `pos`→`a`, `neg`→`b` |
| `fruit` | Lemon half with two slots | none | a `cell` between the two seated electrodes: copper and zinc apart 0.92 V (±0.03, by id) with copper plus, 1.2 kΩ; same metal about 0 V; `touching` 0 V, 1 Ω |
| `electrode` | Copper-plated coin or galvanised strip (`metal`); lies flat, stands upright in a slot | `tip` | none |
| `skin` | Skin pad on a wooden base, scale 0 to 4 cm, moisture tabs (clickable) | `m0` to `m4` | ladder: a contact per mark (dry 400/250 kΩ light/firm, damp 80/50, wet 18/12, salty 4/3) and bulk per cm between marks (20, 10, 5, 2 kΩ) |
| `sample` | Bare copper wire or plastic ruler (`material`) | `a b` | `probe-resistance` 0.02 Ω or 10 TΩ |
| `card` | White card with a ruler, a pencil beside it; drag along the strip to draw | `p0` to `p20` (every 0.5 cm) | ladder over the drawn line: 1 kΩ contact per point, 20 kΩ per cm ÷ layers ÷ 2 if wide; points past the line touch bare card |
| `tag` | Paper value label (`text`) | none | none |
| `bin` | Red reject tray with five seats | none | none |
| `chart` | Colour code card on a stand | none | none |
| `clock` | Desk clock showing simulated hours and minutes | none | none |
| `showcase` | Glass case: a phone Li-ion pack and a model car battery, safety placards | none | none |

`skinOhms(moisture, pressure, cm)` and `pencilOhms(cm, layers, wide)` give the expected values.

**Seats.** A `PartDef` may declare `seats(params)`: named spots that accept kinds, place the held part (`place(held)`
returns its local position and turn) and optionally `joins` its leads to the holder's. Who sits where is
`params.held` (`{ r: "R2" }`), so the bench stays plain JSON. `movePart` seats a part dropped within 16 mm of a seat
(the previous occupant pops out in front), takes it out when dragged away, and keeps seated parts with a moving
holder; `seatPart`, `unseat`, `syncHeld`, `holderOf` and `seatNear` script it. `swapParts(a, b)` and
`dropOnto(id, target, from)` swap two parts' places, seats and attachments; the bench does this when a part is
dropped right on one of its kind.

**Settings, actions, hotspots.** `PartDef.settings` (`{ key, values, also? }`) show on the selection bar as chips or a
select (labels in `BenchLabels.settings`, by `kind.key`); `PartDef.actions` are one-shot buttons (the card's erase);
`PartDef.hotspots(params)` are clickable setting spots or the card's drawing strip (pick types `setting`, `draw`).
`penStroke(base, reach)` is the drawing rule: a first stroke draws from the 0 mark, a stroke over the whole line adds
a layer (up to four) and may extend it.

**Room lights and readouts.** The store's `ambient` (1 to 0.1) dims the lights and background and lifts LED halos;
`inspect: [{ show: "stress" | "heat", parts: [...] }]` floats a stress bar (LED current as a share of `maxmA`) or a
temperature tag with a touch-feel word over every matching part.

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
DPDT switch `a1 com1 b1 a2 com2 b2`; fuse, speaker, cup and touch pads `a b`; battery and lemon `pos neg`; lab props
as in the table above.

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
  board with an overloaded resistor; `?scene=empty`, `?scene=half` (400-point board); `?scene=props` every lab
  prop on one desk; `?scene=modules` the desk modules; `?scene=glow` the first-glow loop (`glow0` before it is
  wired).
- A toggle above the bench switches between the 3D and ink views on the same store (`view=ink` starts in ink,
  `toggle=0` hides it). `theme=dark` shows the night page.
- `?mode=gallery` every part in rows (`&rows=0-3`, `&row=2`, `&focus=4` for a close-up).
- `?mode=preview` a few `<PartPreview>` turntables.
- Screenshot helpers: `q=low`, `panel=0`, `tray=0`, `glow=0.8`, `health=R1:smoking,D1:dead`, `display=OL`,
  `unit=kΩ`, `closed=1`, `hover=hole:e12`, `xray=1`, `select=R1`, `hint=R1,hole:e12`, `cam=x,y,z&target=x,y,z`,
  `focus=part:R1,part:D1` (or `all`), `spot=part:D1`.

## Tests and screenshots

```bash
pnpm --filter @ohmland/bench test        # Vitest: netlist, snapping, colour code, controller hub, targets
pnpm --filter @ohmland/bench typecheck
pnpm --filter @ohmland/bench shots       # Playwright: interaction, controller and view switch checks + screenshots
```

The Playwright run starts the playground itself. On macOS headless Chromium renders WebGL through Metal; elsewhere the
config switches to SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`). If Chromium is missing:
`pnpm --filter @ohmland/bench exec playwright install chromium`. Screenshots are quantised (undithered) to stay small
when ImageMagick (`magick`) is installed. `BENCH_PORT=5400 pnpm shots` uses another port.

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
  5.8 mm rim, 1/4 W resistor 6.3 mm long. Shapes are simplified but proportioned after datasheet packages. Test
  leads use mini clips (26 mm, a 6 mm sleeve) on 1.8 mm cable, so they do not dwarf what they hold; at a full lab
  framing a resistor is about 40 px long on a 1440 px bench, so lessons `focus()` the parts in play to read bands.
- Colour bands follow the standard code (4 bands: two digits, multiplier, gold 5 %; 5 bands: three digits,
  multiplier, brown 1 %), drawn as raised rings with metallic gold and silver.
- Performance: one instanced draw for all 830 hole pits and one for the x-ray strips, shared geometries and
  materials, render on demand, DPR capped at 2 (1.5 on low), shadows redrawn only when the bench changes. The demo
  bench (a populated board, meter, probes and a lead) draws about 200 calls a frame on high (scene, ink, bloom) and
  180 on low, and orbits at 60 fps with the CPU throttled 4x on an M-series Mac (about 460 fps uncapped).
- The bench never imports the simulator at runtime; it only uses its types.
