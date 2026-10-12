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
  src/progress/           local-first learner store, XP, levels, achievements, parts bin
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
  course.yaml                         unit order
  units/<unit-id>/unit.yaml           title, summary, island theme, module order
  units/<unit-id>/<module-id>/module.yaml     title, summary, landmark {id, name}, lesson order
  units/<unit-id>/<module-id>/<lesson-id>/lesson.yaml
  labs/<lab-id>.ts                    lab definitions (typed TS, default export defineLab(...))
```

`lesson.yaml` (validated by zod in `apps/web/src/content/schema.ts`; markdown allowed in `body`/`text` fields):

```yaml
id: meet-the-meter            # globally unique, kebab-case, stable forever (progress keys on it)
version: 1                    # bump when steps change incompatibly
title: Meet your multimeter
summary: One sentence for the course map.
minutes: 10
unlocks:
  parts: [multimeter, test-leads]       # parts bin ids that unlock on completion
  isle: meter-kiosk                     # island piece this lesson places
steps:
  - type: hook                # sets the scene; optional ungraded prediction
    body: "markdown"
    visual: { kind: part, part: multimeter }   # optional: spinning 3D part, image, or none
    predict: { prompt: "...", options: ["...", "..."] }
  - type: lab
    lab: meet-the-meter       # content/labs/meet-the-meter.ts
  - type: explain
    cards:
      - title: "..."
        body: "markdown"
        widget: { kind: ohms-law, props: {} }   # optional interactive widget from a registry
  - type: quiz
    items: [ ...quiz items, see below ]
  - type: wrap
    rules: ["One-line rule card text", "..."]   # collected into the learner's rulebook
    realWorld:                # optional "Try it for real" card for learners with hardware
      parts: ["..."]
      safety: ["..."]
```

Quiz item types (`type` field): `choice` (single or multiple answers, every option has a `why`), `numeric` (answer,
unit, tolerance in percent; accepts SI prefixes such as `4.7k`, `470`, `0.47M`), `order`, `match`, `color-code`
(read or build a resistor's bands), `hotspot` (tap the right spot on a figure or 3D part). Every item has `id`
(unique within the lesson), `prompt`, `explain` (shown after answering) and optional `hint`.

## Learner progress (`apps/web/src/progress`)

Stored in IndexedDB (`idb-keyval`), one record per profile, mirrored to Firestore for signed-in learners:

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
  inProgress: Record<LessonId, { step: number; answers: Record<string, unknown>; at: string }>;
  achievements: Record<AchievementId, { at: string }>;
  fried: { kind: string; label: string; lessonId: string | null; at: string }[];   // Hall of Fried Parts (cap 500)
  sandbox: { saved: Record<string, { name: string; bench: unknown; at: string }> };
  settings: { muted: boolean; reducedMotion: "system" | "on" | "off"; theme: "system" | "light" | "dark" };
  updatedAt: string;
};
```

Derived, never stored:

- **XP** = sum over completed lessons of `30 + 10 * firstTry + 15 * tasks.length`, plus 100 per completed module,
  plus each unlocked achievement's `xp`.
- **Level** from XP with `xpForLevel(L) = 50 * L * (L - 1)` (level 1 at 0, 2 at 100, 3 at 300, 4 at 600, ...).
  Each level has a title (Spark, Tinkerer, ...), defined in `progress/levels.ts`.
- **Parts bin** = union of `unlocks.parts` of completed lessons.
- **Island** = `makeIsle(seed, events)` where events are lesson and module completions ordered by `at`.

Merge on sign-in (device + cloud): earliest `at` per lesson, union of tasks, max `firstTry`, union of achievements
(earliest `at`), union of fried parts by `(kind, at)`, newest settings.

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
export default defineLab({
  id: "meet-the-meter",
  bench: { board: "none" | "breadboard", parts: [...initially placed], tray: [...available parts], instruments: ["meter"] },
  tasks: [
    { id: "measure-battery", prompt: "markdown", goal: (lab) => ..., hints: ["...", "..."], success: "markdown" },
  ],
});
```

`goal` receives a read-only view: bench state, latest snapshot, event log and meter state, plus helpers
(`lab.part("D1")`, `lab.meterReads(9, { tol: 0.05 })`, `lab.isLit("D1")`, `lab.fried("led")`). A lab is solvable by
design: each lab ships a `solution` (bench actions) that a test replays.

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
merge, island determinism. Playwright for a few critical paths: finish a lesson as a guest, complete a lab, island
reveal, sign-in smoke test. Plus `pnpm lint:copy` (no em dashes) and the content check.
