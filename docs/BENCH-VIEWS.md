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

## Interaction parity

Everything a learner can do in one view works in the other: take parts from the tray, place and move them, stretch
resistor leads, rotate, delete, wire hole to hole, clip and unclip test leads, move meter probes and plugs, turn the
meter dial, flip switches, press buttons, use sliders such as light and fingertip, x-ray the breadboard, undo and redo.
Mouse, touch and keyboard in both.

## Accessibility

The ink view is the accessible default for screen readers: every part and connection point is a focusable SVG element
with a name. The connections panel works in both views.
