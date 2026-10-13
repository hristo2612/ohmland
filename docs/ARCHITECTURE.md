# Ohmland architecture

Ohmland is a free, open-source web app that teaches electronics from zero, with no hardware needed. Learners do
hands-on virtual labs on a 3D workbench driven by a real circuit simulator, take short quizzes, earn XP and levels,
collect parts and achievements, and watch a floating voxel circuit-board island grow as they learn.

This document is the contract between the parts of the codebase. If you change a contract, update this file in the
same commit.

## Principles

1. **Discover first.** Every lesson starts with something to try (and often to break), then explains it.
2. **The simulator is the teacher.** LEDs glow because current flows, parts burn out because power exceeds a rating,
   capacitors charge along a real curve. Labs check goals against simulated state, never against scripted fakes.
3. **Local first.** Guests can do everything with no account. Progress lives on the device and syncs to Firebase
   only for signed-in learners.
4. **Derive, don't store.** XP, level, unlocked parts and the island are computed from the progress record. The
   island is a pure function of a seed and completion events (the Pitko village pattern).
5. **Load heavy things on demand.** three.js, the simulator worker and Firebase are dynamic imports. A lesson's text
   and quiz never wait for them.
6. **Original content only.** We teach the same physics as classic beginner books, but every word, figure, project
   name and line of code is ours. See `docs/CONTENT.md`.
7. **Desktop first, phone works.** Labs are designed for a laptop but must stay usable by touch on a phone.
8. **Accessible.** Keyboard paths, visible focus, 44 px touch targets, reduced motion respected, AA contrast in both
   themes.

## Stack (pinned)

| Layer | Choice |
|---|---|
| Runtime | Node 24 (`.nvmrc`), engines `>=22.12`, pnpm 10 workspaces |
| Language | TypeScript 5.9.3 (not 7: `astro check` does not support it yet) |
| Site | Astro 7.3.x static output + `@astrojs/react` 7.0.x, React 19.3 |
| 3D | three 0.186.1, @react-three/fiber 9.8.x, @react-three/drei 10.7.x (WebGL renderer) |
| State | zustand 5 for UI state, idb-keyval 6 for persistence |
| Schemas | zod 4 |
| Accounts | Firebase JS SDK 12.19.0: Auth (Google, GitHub), `firebase/firestore/lite` |
| Hosting | Firebase Hosting, project id `ohmland` |
| Tests | Vitest 5 (pure logic), Playwright 1.64 (a few end-to-end paths) |

Exact versions: pin exact versions (no `^`) in every `package.json`.

## Repository layout

```
apps/web/                 the site (Astro + React islands)
  src/pages/              routes (see "Routes")
  src/layouts/            page shells
  src/components/         shared UI (buttons, cards, dialogs, nav, icons)
  src/lesson/             lesson player and step renderers
  src/quiz/               quiz item components and grading
  src/lab/                lab runtime: bench + simulator + goals + instruments + mascot hints
  src/progress/           local-first learner store, XP, levels, achievements, parts bin, island events
  src/isle/               the island in the app: lazy loader, /isle page, landing hero, map card, finale reveal
  src/account/            Firebase auth + sync (lazy)
  src/i18n/               UI messages (en.ts); no UI words inline in components
  src/styles/tokens.css   the only file allowed to hold raw design values
packages/sim/             circuit simulator: pure TS, no DOM; worker entry + async client
packages/bench/           3D workbench: procedural part models, breadboard, meter, wires, interaction,
                          bench state -> netlist (React Three Fiber components)
packages/isle/            the progress island: pure planner + three.js renderer (vanilla three, lazy)
content/                  the course: units, modules, lessons (YAML), labs (TS), quiz items
docs/                     ARCHITECTURE.md (this), CONTENT.md (writing + copyright rules), CURRICULUM.md
scripts/                  repo checks (copy lint, content check)
```

Packages are consumed from source (`"exports": { ".": "./src/index.ts" }`), no separate build step.
Package names: `@ohmland/web`, `@ohmland/sim`, `@ohmland/bench`, `@ohmland/isle`.

## Course structure

```
Course (Ohmland)
  Unit      a floating island in the archipelago (5 units, matching the classic beginner progression)
    Module  ends with a landmark build on that unit's island (big reveal)
      Lesson  8 to 15 minutes, adds one component piece to the island (small reveal)
```

Planned units: 1 Basics (meter, resistance, current, voltage, power, cells), 2 Switching (switches, relays,
breadboards, capacitors, transistors, light and sound), 3 Making it permanent (soldering, perfboard), 4 Chips (555
timer, logic, counters, latches), 5 Beyond (magnetism, induction, radio, microcontrollers). Units 1 and 2 ship first.

## Content format (`content/`)

```
content/
  course.yaml                         title, unit order, upcoming (planned) units
  parts.yaml                          the parts bin catalog (id, name, icon, blurb, facts)
  units/<unit-id>/unit.yaml           id, title, summary, isle {theme, seed?}, module order
  units/<unit-id>/<module-id>/module.yaml     id, title, summary, landmark {id, name}, lesson order
  units/<unit-id>/<module-id>/<lesson-id>/lesson.yaml
  labs/<lab-id>.ts                    lab definitions (typed TS, default export defineLab(...))
```

Every file is validated by zod (`apps/web/src/content/schema.ts`) when the site builds (`apps/web/src/content/load.ts`);
any problem fails the build with a list of every issue, file by file and field by field. The loader also checks
cross-references: folder names match ids, lesson ids are unique across the course, every `lab` step has its
`content/labs/<lab>.ts`, every `unlocks.parts` id and hook `visual.part` exists in `parts.yaml`, landmark and island
piece ids are unique. Unknown fields are errors (typos never pass silently).

`course.yaml`:

```yaml
title: Ohmland
units: [basics]               # folders under content/units, in order
upcoming:                     # planned units, shown as "coming soon" until their folder exists
  - { id: switching, title: Switching, summary: "..." }
```

`lesson.yaml` (fields marked md accept a small markdown subset: paragraphs, `-`/`1.` lists, `**bold**`, `*italic*`,
`` `code` ``, `[links](https://...)`; everything else is escaped):

```yaml
id: meet-the-meter            # globally unique, kebab-case, stable forever (progress keys on it)
version: 1                    # bump when steps change incompatibly (saved in-progress answers are then dropped)
title: Meet your multimeter
summary: One sentence for the course map.
minutes: 10
unlocks:
  parts: [multimeter, test-leads]       # parts.yaml ids that unlock on completion
  isle: meter-kiosk                     # island piece this lesson places
steps:                        # the first step is a hook, the last a wrap (exactly one)
  - type: hook                # sets the scene
    title: "..."              # optional; defaults to the lesson title
    body: "md"
    visual: { kind: part, part: multimeter }   # optional: part | image {src, alt} | none
    predict: { prompt: "md", options: ["md", "md"] }   # optional ungraded guess, 2 to 4 options
    mascot: "short line"      # optional mascot line (under 20 words)
  - type: lab
    lab: meet-the-meter       # content/labs/meet-the-meter.ts
    intro: "md"               # optional
  - type: explain
    cards:                    # 1 to 6 cards, shown one at a time
      - title: "..."
        body: "md"
        widget: { kind: ohms-law, props: {} }   # optional; kinds: ohms-law, resistor-explorer
        mascot: "short line"  # optional
  - type: quiz
    items: [ ...quiz items, see below ]         # 1 to 8
  - type: wrap
    rules: ["md", "..."]      # 1 to 5 one-line rule cards, collected into the learner's rulebook
    realWorld:                # optional "Try it for real" card for learners with hardware
      body: "md"              # optional
      parts: ["md"]
      safety: ["md"]
```

Quiz items. Every item has `id` (unique within the lesson), `type`, `prompt` (md), `explain` (md, shown once
answered right or revealed) and optional `hint` (md, offered after a wrong try). The first try counts for XP;
retries are always allowed, and after two wrong tries the learner may reveal the answer.

```yaml
- type: choice                # single answer, or several when more than one option is correct
  multi: true                 # optional: checkboxes even with one right answer (so the count is no giveaway)
  shuffle: true               # default true
  options: [{ text: "md", correct: true, why: "md" }, { text: "md", why: "md" }]   # 2 to 6, every option has a why
- type: numeric
  answer: 14.9
  unit: mA                    # the box's unit: Ω kΩ MΩ V mV A mA µA W mW F µF nF pF Hz kHz s ms ...
  tolerance: 3                # percent, default 2
  # Accepts "15", "15 mA", "0.015 A", "15m", "4.7k", "4k7", "4R7", "1e3", "4,7". A bare number is read in the
  # box's unit. A prefix slip (0.015 typed in a mA box) gets a specific hint instead of a plain "wrong".
- type: order
  items: ["md", "md", "md"]   # in the right order, 2 to 7; shown shuffled
- type: match
  pairs: [{ left: "md", right: "md" }]   # 2 to 6, right-hand sides distinct; shown shuffled
- type: color-code
  mode: read                  # read: show the bands, type the value; build: pick the bands for the value
  ohms: 4700
  bands: 4                    # 4 (two digits) or 5 (three digits); the value must be writable with them
- type: hotspot
  figure: multimeter          # multimeter | led | breadboard (apps/web/src/quiz/figures)
  answer: com                 # a region id of that figure, or a list of them
```

`parts.yaml`: `parts: [{ id, name, icon, blurb, facts: ["md", ...] }]`, where `icon` is one of the 2D drawings in
`apps/web/src/parts/kinds.ts`. A 3D `PartPreview` from `packages/bench` replaces the drawing later.

## Learner progress (`apps/web/src/progress`)

Stored in IndexedDB (`idb-keyval`, database `ohmland`, store `learner`, key `profile:default`), one record per
profile, mirrored to Firestore for signed-in learners. When the browser refuses storage, the store falls back to memory
and the header shows a notice that progress will not be kept.

```ts
type LearnerState = {
  v: 1;
  lessons: Record<LessonId, {
    at: string;              // ISO time of first completion
    version: number;         // lesson version completed
    firstTry: number;        // quiz items right on the first try
    items: number;           // quiz items total
    tasks: string[];         // lab task ids completed
  }>;
  inProgress: Record<LessonId, { step: number; answers: Record<string, unknown>; at: string; version?: number }>;
  achievements: Record<AchievementId, { at: string }>;
  fried: { kind: string; label: string; lessonId: string | null; at: string }[];   // Hall of Fried Parts (cap 500)
  sandbox: { saved: Record<string, { name: string; bench: unknown; at: string }> };
  settings: { muted: boolean; reducedMotion: "system" | "on" | "off"; theme: "system" | "light" | "dark" };
  updatedAt: string;
};
```

`inProgress[id].version` is the lesson version the answers belong to; answers for another version are not resumed.
`answers` keys are the player's own (`item:<quizItemId>`, `predict:<step>`, `card:<step>`, `quiz:<step>`,
`tasks:<labId>`). Theme and motion are also mirrored to `localStorage` (`ohmland:theme`, `ohmland:motion`) so an
inline head script can apply them before the first paint.

Derived, never stored:

- **XP** = sum over completed lessons of `30 + 10 * firstTry + 15 * tasks.length`, plus 100 per completed module,
  plus each unlocked achievement's `xp`.
- **Level** from XP with `xpForLevel(L) = 50 * L * (L - 1)` (level 1 at 0, 2 at 100, 3 at 300, 4 at 600, ...).
  Twenty titles (Spark, Tinkerer, Wire Bender, ... Ohmland Legend) live in `i18n/en.ts`; levels past 20 keep the
  last title. `progress/levels.ts` maps levels to titles.
- **Parts bin** = union of `unlocks.parts` of completed lessons.
- **Course map states**: the current lesson is the first not done in course order; a lesson right after a done one
  is open; the rest are locked. Locks suggest an order; a locked lesson's page still works.
- **Island** = `makeIsle(seed, events)` from `progress/isleEvents.ts`: one event per finished lesson ordered by `at`
  (ties in course order), each module's event right after the lesson that finished it, and
  `seed = seedFrom(first lesson id, its at)` (a fixed seed before any lesson). Pieces and landmarks pass through as the
  content names them; ids the isle does not know fall back to its planner.

Achievements are a registry in `progress/achievements.ts`: `{ id, title, description, icon, xp, hidden?, check }`,
where `check({ state, outline, events })` is a pure predicate over the learner record, the course outline and the
latest lab events (`fried`, `task`, `lesson-complete`). The store evaluates them after a lesson completes and after
every fried part, and stores only `{ at }` per unlocked id. Fried parts are recorded with
`recordFried(kind, label, lessonId)`, which the lab runtime calls when the simulator reports a dead part.

Merge on sign-in (device + cloud, `progress/merge.ts`, also used by "Import progress"): earliest `at` per lesson,
union of tasks, max `firstTry`, max `version` and `items`, newest in-progress entry per lesson, union of achievements
(earliest `at`), union of fried parts by `(kind, at)` (oldest first, capped), newest saved benches, newest settings.
Merge is commutative and idempotent.

Cloud sync plugs in through `ProgressSync` (`progress/sync.ts`): `pull()`, `push(state)`, optional
`subscribe(onRemote)`, `disconnect()`. The store's `attachSync(sync)` pulls, merges, pushes, and then pushes after
every change. Firebase (`src/account`, lazy) will provide the implementation.

The lesson player reports to the island through `IsleHooks` (`lesson/isle-hooks.ts`): `prefetch()` once the learner
moves past the quiz (never on a lesson's first load), `prime()` inside the tap on "Finish lesson" (audio), and
`reveal({ before, after, outline, muted, signal, onShow })` after a first finish is saved. The reveal is a modal
dialog (`isle/reveal.tsx`, loaded on demand) that resolves with what it showed once the learner closes it. Through
`revealWithin()` the finale waits for it to get on screen for at most `REVEAL_TIMEOUT_MS`; a reveal that fails or is
late is aborted and never blocks the finale. Every island view loads the isle and three.js through `isle/load.ts`
(one dynamic import) and passes the isle its words from `en.ts`.

## Simulator (`packages/sim`)

A Modified Nodal Analysis engine with Newton-Raphson for nonlinear parts and companion models for capacitors and
inductors, run in a Web Worker. Small circuits (under about 60 nodes) must run in real time.

Netlist contract (stable; `packages/bench` and `content/labs` depend on it):

```ts
type NodeId = string;                      // "gnd" is the reference node
type Netlist = { parts: PartSpec[] };
type PartSpec =                            // discriminated by kind; pins map pin name -> node
  | { id: string; kind: "resistor"; pins: { a: NodeId; b: NodeId }; ohms: number; watts?: number }
  | { id: string; kind: "battery"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number; mAh?: number }
  | { id: string; kind: "led"; pins: { anode: NodeId; cathode: NodeId }; color: LedColor; maxmA?: number }
  | { id: string; kind: "switch"; pins: { a: NodeId; b: NodeId }; closed: boolean }        // input: closed
  | { id: string; kind: "pushbutton"; pins: { a: NodeId; b: NodeId } }                      // input: pressed
  | { id: string; kind: "spdt"; pins: { com: NodeId; a: NodeId; b: NodeId }; to: "a" | "b" }
  | { id: string; kind: "fuse"; pins: { a: NodeId; b: NodeId }; amps: number }
  | { id: string; kind: "capacitor"; pins: { pos: NodeId; neg: NodeId }; farads: number; volts?: number; polarized?: boolean }
  | { id: string; kind: "pot"; pins: { a: NodeId; wiper: NodeId; b: NodeId }; ohms: number; position: number }
  | { id: string; kind: "relay"; pins: { coilA: NodeId; coilB: NodeId; com: NodeId; no: NodeId; nc: NodeId }; coilOhms: number; pullIn: number; dropOut: number }
  | { id: string; kind: "npn"; pins: { c: NodeId; b: NodeId; e: NodeId }; model?: "2N3904" }
  | { id: string; kind: "phototransistor"; pins: { c: NodeId; e: NodeId } }               // input: light 0..1
  | { id: string; kind: "diode"; pins: { anode: NodeId; cathode: NodeId }; model?: "1N4001" | "1N4148" }
  | { id: string; kind: "speaker"; pins: { a: NodeId; b: NodeId }; ohms: number }
  | { id: string; kind: "multimeter"; pins: { com: NodeId; vohm: NodeId; ma: NodeId; a10: NodeId };
      mode: MeterMode; range?: string }                                                     // input: mode, range
  | { id: string; kind: "probe-resistance"; pins: { a: NodeId; b: NodeId }; ohms: number }  // skin, water, etc.
  | { id: string; kind: "cell"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number }  // fruit cell etc.
  | { id: string; kind: "wire"; pins: { a: NodeId; b: NodeId } };
type MeterMode = "off" | "dcv" | "acv" | "dca-ma" | "dca-10a" | "ohm" | "continuity" | "diode";
```

The sim package owns the exact types (`packages/sim/src/types.ts`) and may add kinds and optional params, but must
not rename existing fields.

Runtime API:

```ts
const sim = await createSimClient();            // spawns the worker; createSimulation() is the same API in-thread
sim.load(netlist);                               // full rebuild; keeps state (charge, damage, heat) of parts whose id survives
sim.setInput(partId, key, value);                // pressed, closed, position, light, mode, range
sim.run({ speed: 1 });                           // real time; speed < 1 for slow motion
sim.onSnapshot((s: Snapshot) => ...);            // about 30 per second
type Snapshot = {
  t: number;                                     // simulated seconds
  nodes: Record<NodeId, number>;                 // volts
  parts: Record<string, PartState>;
  events: SimEvent[];                            // since last snapshot: damaged, blown, clicked, shorted, reversed
};
type PartState = {
  i: number; v: number; p: number;               // current through (pin order a->b), voltage across, power
  temp: number;                                  // degrees C
  health: "ok" | "hot" | "smoking" | "dead";     // dead parts become open (or short, per kind)
  glow?: number;                                 // LEDs: 0..1 perceived brightness
  closed?: boolean;                              // relays, switches
  display?: string;                              // multimeter: "9.12", "OL", "-0.42", " .000"
  unit?: string;                                 // multimeter annunciator
};
```

Audio: speakers expose an audio-rate sample stream (`sim.onAudio`) for an AudioWorklet.

Damage is part of the lesson design: LEDs die above their current rating, resistors smoke above their power rating,
fuses blow on I squared t, the meter's mA input fuse blows, batteries heat when shorted. Every damage event carries
enough context for the lab to explain what happened.

## Workbench (`packages/bench`)

React Three Fiber components and logic for the lab bench:

- Procedural low-poly part models built in code (no downloaded models), clean and readable: resistor with correct
  colour bands for its value, LEDs (3 and 5 mm, colours, glow + bloom), 9 V battery and snap, alligator test leads,
  jumper wires, solderless breadboard, multimeter (rotary dial, LCD, banana sockets, probes), pushbutton, slide and
  toggle switches, fuse, capacitors (electrolytic, ceramic), potentiometer, relay, NPN transistor (TO-92),
  phototransistor, small speaker, plus lab props (cups of water, fruit cells).
- Interaction: drag from a tray, snap leads into breadboard holes, rotate, delete, wire hole to hole, clip alligator
  leads and meter probes onto leads or terminals. Mouse, touch and keyboard.
- `benchToNetlist(bench: BenchState): { netlist: Netlist; nodeOf(anchor): NodeId }` using union-find over the
  breadboard's internal strips and every clip/lead connection.
- Part visuals read `PartState` (glow, health: smoke, scorch, cracked) from the simulator snapshot.

`BenchState` is plain serialisable data (saved for sandbox builds and lab checkpoints).

## Labs (`content/labs/*.ts`)

```ts
import { defineLab } from "@ohmland/lab";   // apps/web/src/lab/define.ts (a Vite alias and a tsconfig path)

export default defineLab({
  id: "meet-the-meter",
  title: "Meet the meter",
  bench: {
    board: "none" | "breadboard",
    parts: [{ id: "B1", kind: "battery", at: "rails", props: { emf: 9 }, locked: true }],   // initially placed
    tray: [{ kind: "resistor", props: { ohms: 470 }, count: 2 }],                            // available parts
    instruments: ["meter"],
  },
  tasks: [
    { id: "measure-battery", prompt: "markdown", goal: (lab) => ..., hints: ["...", "..."], success: "markdown", optional?: true },
  ],
  solution: [{ do: "place", part: "R1", kind: "resistor", at: "a12", props: { ohms: 470 } }, { do: "probe", red: "R1.a", black: "R1.b", mode: "dcv" }],
});
```

`kind` and `mode` come from the `@ohmland/sim` netlist types. `at` anchors and the `BenchAction` shapes (`place`,
`move`, `remove`, `wire`, `set`, `probe`, `wait`) are deliberately loose until `packages/bench` owns `BenchState`.
`defineLab` checks the cheap invariants (kebab-case id, unique task and part ids) when the lab loads.

`goal` receives a read-only `LabView`: bench state, latest snapshot, event log and meter state, plus helpers
(`lab.part("D1")`, `lab.meterReads(9, { tol: 0.05 })`, `lab.isLit("D1")`, `lab.fried("led")`). `createLabView(...)`
builds one from raw runtime state, so goals can be tested against canned snapshots. A lab is solvable by design: each
lab ships a `solution` (bench actions) that a test replays.

The lesson's lab step lazy-loads `apps/web/src/lab/LabStep.tsx` and the lab module itself (`import.meta.glob`, one
chunk per lab). Until the bench and simulator land, `LabStep` shows a preview panel with the lab's tasks and hints;
dev builds add "Mark task done" and "Fry an LED" buttons to exercise task XP and the Hall of Fried Parts.

## Island (`packages/isle`)

`makeIsle(seed, events): IslePlan` is pure and deterministic across CPUs (seeded PRNG, no `Math.sin`/`cos` in the
planner, Pitko's fdlibm approach). `mountIsle(el, plan, opts)` renders with vanilla three.js, instanced meshes,
orthographic isometric camera, flat-shaded vertex colours, voxel style. `view.reveal(from, to)` animates what the
latest events added. Each unit is its own island in an archipelago, linked by cable bridges.

Look: a floating circuit board. Matte solder-mask green land, copper trace roads with vias, white silkscreen marks,
components as buildings (capacitor towers, IC factories, resistor rows, LED street lamps), layered FR4 edges, dangling
wire roots, clouds. The mascot (a small voxel robot with an LED face) floats over the square.

## Routes

| Path | Page |
|---|---|
| `/` | Landing: live island demo, what you learn, Start (no account needed) |
| `/learn` | Course map: units, modules, lessons, progress |
| `/learn/<unit>/<lesson>` | Lesson player |
| `/isle` | Your island, full screen |
| `/bench` | Sandbox with unlocked parts |
| `/parts` | Parts bin: every unlocked part with a 3D view and key facts |
| `/achievements` | Achievements and the Hall of Fried Parts |
| `/account` | Sign in (Google, GitHub), sync status, export and delete data |
| `/about` | Open source, licenses, credits, companion reading |

## Performance budgets

- Lesson page first load (text, quiz) under 250 KB gzipped JS; three.js and the sim worker load only when a lab or
  the island is on screen.
- Labs hold 50 fps on a mid-range laptop and stay usable on a mid-range phone (render on demand when idle).
- The island at 300 lessons holds 50 fps with the CPU throttled 4x.

## Testing (lean)

Vitest for pure logic that is easy to get wrong: simulator golden circuits, netlist building, XP/levels, progress
merge, island determinism, SI parsing and the resistor colour code. Playwright for a few critical paths: finish a
lesson as a guest, complete a lab, island reveal, sign-in smoke test. Plus `pnpm lint:copy` (no em dashes), the
content check (the web build fails on invalid content) and `pnpm --filter @ohmland/web lint:colors` (no raw colours
or durations outside `tokens.css`).

`apps/web/scripts/screenshots.mjs` takes screenshots of every page and lesson step in both themes at 1440x900 and
390x844 for visual review; a curated set lives in `apps/web/screenshots/`. Headless Chromium gets WebGL from
SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`). `apps/web/scripts/isle-poster.mjs` renders the
landing hero's day and night stills from the live island.
