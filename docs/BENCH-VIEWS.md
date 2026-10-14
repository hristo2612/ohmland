# Bench views: 3D and 2D ink

The workbench has two interchangeable views of the same circuit. The learner can switch between them at any time,
mid-lab, without losing anything: the bench state, the simulator and the lab progress are shared.

- **3D on paper** (`view: "3d"`): the React Three Fiber bench, restyled for the Lab Notebook look: a grid-paper desk
  instead of wood, soft ink outlines on parts, paper-matched lighting, and framing that keeps small parts readable.
- **2D ink** (`view: "ink"`): a top-down SVG drawing of the same bench at teaching scale, in the notebook's ink line
  style. Parts are drawn larger than life where that helps reading, but every lead lands on the same hole or clip point
  as in 3D, so the netlist is identical.

Default: `ink` on phones and small screens, `3d` on desktop. The learner's choice is remembered in settings
(`benchView: "auto" | "3d" | "ink"`).

## One state, two renderers

Both views render the same `BenchState` from the same bench store, emit the same actions, and read the same simulator
`Snapshot`. Nothing about a lab depends on the view. `benchToNetlist`, `benchOps`, anchors and the store are shared and
view-agnostic.

```tsx
<BenchView
  view="3d" | "ink"
  store={benchStore}            // or initial
  tray={...} snapshot={...} onChange={...} onAction={...}
  labels={...} highlight={...} readOnly={...} quality={...}
  controllerRef={ref}           // BenchController, below
  onReady={...}
/>
```

`<BenchView>` picks the renderer and lazy-loads it: the ink view must not pull in three.js, and the 3D view must not pull
in the ink renderer.

Import it from `@ohmland/bench/view` (the package entry `@ohmland/bench` re-exports it, but that entry also loads the
3D models). Both renderers take the same props (`BenchRendererProps` in `src/view/types.ts`, which also has `frame`
and `theme`); `camera` is 3D only. BenchView keeps one store for its whole life, so switching never loses the bench,
the undo history, the selection or the snapshot.

## BenchController (implemented by both views)

```ts
type ScreenPoint = { x: number; y: number; visible: boolean }; // CSS px relative to the bench element

interface BenchController {
  /** Where an anchor ("pin:R1.a", "part:D1", "hole:e12", "probe:red", "part:M1/display") is on screen right now. */
  project(anchor: string): ScreenPoint | null;
  /** Subscribe to camera or layout changes so overlays can reposition. Returns an unsubscribe. */
  onViewChange(cb: () => void): () => void;
  /** Frame these parts or anchors nicely (smooth unless reduced motion). Empty array: frame the whole work area. */
  focus(targets: string[], opts?: { padding?: number; instant?: boolean }): void;
  /** Temporarily emphasise parts (glow ring, dim the rest). */
  spotlight(targets: string[] | null): void;
}
```

The lesson player draws ink annotations (arrows, notes, ticks, rings) in a DOM/SVG overlay above either view using
`project()`, so annotations look and behave the same in 3D and 2D.

Implementation notes (both views):

- The controller BenchView hands out is a hub (`createControllerHub`): the same object across view switches.
  Subscriptions made on it survive a switch (they hear one change when the new view attaches), and the last `focus`
  and `spotlight` are applied to the new view. `hub.inner()` is the active view's own controller.
- Targets besides anchors: `part:<id>` (the meter is `part:M1`), `part:M1/display`, `part:M1/dial`,
  `part:M1/<socket>`, `lead:<id>` and `wire:<id>` for a whole lead or wire, `part:R1/a` for a part's lead and
  `part:<id>/<mark>` for a named spot on a part (`PartDef.marks`: a drawing's symbol `part:SD1/R1`, a box's `lid`,
  `knob` and `tag`, a padlock's `wheel1`, a gate's `flag` and `unit`, a tag's `text`). Both views place marks at the
  same desk point. `parseTarget` and `targetPoint` (a
  renderer-free world point) live in `src/view/targets.ts`.
- `project()` returns null for a target that does not exist; `visible` is false off screen or behind the camera.
- `onViewChange` fires at most once per drawn frame, for camera, size and bench changes (overlays follow drags).
- In 3D, `focus` frames the targets' rendered models with some bench around them (a single small part is framed no
  tighter than about 24 mm), and `spotlight` veils the rest of the bench in the page colour and rings each target in
  red pencil. The 3D controller (`Bench3DController`) adds `project([x, y, z])`, `projectClient()` (page px, for
  tests), `topView()`, `resetView()`, `atHome()`, `pickAt()` and `stats()`.
- In ink, `focus` frames the targets' drawn outlines with some bench around them (never tighter than about 24 mm, a
  comfortable reading scale at most) and keeps that framing when the bench resizes until the learner pans; it waits for
  the view's first size, so a focus set before the ink view loads (the hub replays it) still lands. `spotlight` fades
  the rest to the page colour (the board a little less, as context) and rings each target in red pencil. Besides the
  shared targets, ink takes a bare part id, `part:R1/a` (a lead), `part:M1/dialFace`, `part:M1/sockets`, `board` and
  `strip:14a-e`. The ink controller (`InkController`) adds `projectClient()`, `resetView()`, `atHome()`, `pickAt()`
  and `camera()`. Its drawing works at teaching scale: small desk parts are drawn larger than life, but every lead,
  terminal, clip point and socket sits exactly where `partPose` and `anchorPosition` put it, so `project()` agrees
  with the 3D view on every anchor (see packages/bench/README.md, "2D ink view").

## Overlays

Teaching overlays draw over the bench in both views, from one state in the bench store (`overlay`, set with
`setOverlay({ flow, push })` and `trace(anchor | null)`) and the same pure data (`packages/bench/src/flow.ts`):

- **Flow dots** (`flow: "current" | "electrons"`): paper dots ringed in ink ride every clip lead, jumper and part, at a
  speed from its current (a gentle power law: about 8 mm/s at 0.7 mA, 20 mm/s at the lamp's 7.5 mA, capped at
  40 mm/s; nothing moves below 1 µA), plus to minus. `"electrons"` draws them as short ink dashes going the other way
  at an eighth of the speed. A jumper's current comes from the parts on one side of it (the current law). Dots stop
  under reduced motion. Calm and optional: off unless a lab or lesson turns them on.
- **Gates** (a `gate` part clipped round a lead) count the dots that pass them (`DOT_SPACING` apart, so a gate ticks at
  speed / 8 mm), from the simulator's snapshots: the store keeps the counts (`gates`), so both views show the same
  number. In number mode the flag reads the lead's current ("0.0075 A") with a unit button.
- **Push** (`push: true`): red pencil hatching across every lead, denser the higher its voltage above the battery's
  minus (none at 0 V), and a hatched hill by each battery and on each sealed box, as tall as its push (9.5 V is full).
- **The loop tracer** (`trace: { from }`): a red pencil line runs from the terminal, lead by lead and part by part along
  the metal (`traceLoop`), offset beside the cables so it reads on a red lead, over about a third of a second per
  step, and ends in a ring where it closed or a ring and a cross at the gap (an insulated spot, a loose clip, an open
  switch). Instant under reduced motion.

Parts shut in a sealed box are drawn in neither view and no pointer, clip or probe can reach them; the box's own
terminals and knob stand for them. Open, the box shows them and the wires inside.

## Interaction parity

Everything a learner can do in one view works in the other: take parts from the tray, place and move them, stretch
resistor leads, rotate, delete, wire hole to hole, clip and unclip test leads, move meter probes and plugs, turn the
meter dial, flip switches, press buttons, use sliders such as light and fingertip, x-ray the breadboard, undo and redo.
Mouse, touch and keyboard in both.

## Accessibility

The ink view is the accessible default for screen readers: every part and connection point is a focusable SVG element
with a name. The connections panel works in both views.
