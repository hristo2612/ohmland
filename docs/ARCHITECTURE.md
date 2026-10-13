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
| Hosting | Firebase Hosting, project id `ohmland` (`firebase.json`: `apps/web/dist`, clean URLs, immutable `/_astro/**`) |
| Firebase tooling | firebase-tools 15.31.0 and @firebase/rules-unit-testing 5.0.2 (dev dependencies of `apps/web`) |
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
docs/                     ARCHITECTURE.md (this), CONTENT.md (writing + copyright rules), CURRICULUM.md,
                          ACCOUNTS.md (Firebase setup, emulators, the synced document)
scripts/                  repo checks (copy lint, content check)
firebase.json, .firebaserc, firestore.rules    Firebase Hosting, the project, the Firestore security rules
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
  labs/lib/                           goal helpers shared by labs (not labs themselves)
```

Every file is validated by zod (`apps/web/src/content/schema.ts`) when the site builds (`apps/web/src/content/load.ts`);
any problem fails the build with a list of every issue, file by file and field by field. The loader also checks
cross-references: folder names match ids, lesson ids are unique across the course, every `lab` step has its
`content/labs/<lab>.ts`, every `unlocks.parts` id and hook `visual.part` exists in `parts.yaml`, landmark ids are
unique, and every `unlocks.isle` is a known island piece (`PIECES` in `packages/isle/src/catalog.ts`, mirrored in
`apps/web/src/content/isle-pieces.ts`). Pieces are kinds, so many lessons may place the same one. Unknown fields are
errors (typos never pass silently).

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
profile, mirrored to Firestore (`learners/{uid}`) for signed-in learners. When the browser refuses storage, the store falls back to memory
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

Achievements are a registry in `progress/achievements.ts`: `{ id, title, description, icon, xp, hidden?, labEvent?,
check }`, where `check({ state, outline, events })` is a pure predicate over the learner record, the course outline and
the latest lab events (`fried`, `task`, `trigger`, `lesson-complete`). The store evaluates them after a lesson
completes, after every fried part and on every lab event, and stores only `{ at }` per unlocked id. Fried parts are recorded with
`recordFried(kind, label, lessonId, { silent? })`, which the lab runtime calls when the simulator reports a dead part.
Labs also send `labEvent({ type: "task" | "trigger", ... })`: an achievement with `labEvent: "<name>"` unlocks when
a lab fires that trigger (docs/LABS.md, Achievements).

Merge on sign-in (device + cloud, `progress/merge.ts`, also used by "Import progress"): earliest `at` per lesson,
union of tasks, max `firstTry`, max `version` and `items`, newest in-progress entry per lesson, union of achievements
(earliest `at`), union of fried parts by `(kind, at)` (oldest first, capped), newest saved benches, newest settings.
Merge is commutative and idempotent.

Cloud sync plugs in through `ProgressSync` (`progress/sync.ts`): `pull()`, `push(state)` (fire and forget),
`flush()`, `replace(state)` (no merge, for "Delete all progress"), `onStatus(cb)`, optional `subscribe(onRemote)`, and
`disconnect()` (stops syncing, does not sign out). The store's `attachSync(sync)` pulls, merges, keeps the result
without stamping it, pushes it, and then hands every change to `push`; `detachSync()` stops. The store's
`sync.status` is `local | syncing | synced | offline | error` (the header dot and the account page read it).

Accounts (`src/account`, details and setup in `docs/ACCOUNTS.md`): Firebase Auth (Google, GitHub; popup, redirect when
popups are blocked or in an iOS home-screen app) and Firestore Lite, loaded only on `/account` and on pages of a device
whose `ohmland:signed-in` localStorage key is set (`account/boot.ts`, from `layouts/Base.astro`, after the page is
idle). One document per learner, `learners/{uid}`, holds everything but `inProgress`, each entry packed into a short
string so `firestore.rules` can check every byte (`account/remote.ts`):

```
v: 1
lessons:      { <lessonId>: "<at>|<version>|<firstTry>|<items>|<task>,<task>" }   <= 2000, <= 256,000 chars
achievements: { <achievementId>: "<at>" }                                        <= 500
fried:        [ "<at>|<kind>|<lessonId or empty>|<label>" ]                      <= 500, label <= 80
sandbox:      { <saveId>: "<JSON { name, at, bench }>" }                          <= 50, <= 256,000 chars
settings:     { muted, reducedMotion, theme }
updatedAt:    "<at>"
```

Writes are debounced (about 2 s), read and merge the cloud copy in a transaction before writing, wait while offline and
retry, flush when the page is hidden and go as a keepalive REST write when it closes. A learner signing in on a device
whose progress may not be theirs (last joined to another account, or guest progress while the account already has
some) is asked whether to add it; a guest signing in to a new account is not asked. Ids of saved benches must match
`[A-Za-z0-9_-]{1,64}` to sync.

The lesson player reports to the island through `IsleHooks` (`lesson/isle-hooks.ts`): `prefetch()` once the learner
moves past the quiz (never on a lesson's first load), `prime()` inside the tap on "Finish lesson" (the isle's
`primeAudio()`), and `reveal({ before, after, outline, muted, signal, onShow })` after a first finish is saved. The
reveal frames the island above its caption card (`inset`). The reveal is a modal
dialog (`isle/reveal.tsx`, loaded on demand) that resolves with what it showed once the learner closes it. Through
`revealWithin()` the finale waits for it to get on screen for at most `REVEAL_TIMEOUT_MS`; a reveal that fails or is
late is aborted and never blocks the finale. Every island view loads the isle and three.js through `isle/load.ts`
(one dynamic import) and passes the isle its words from `en.ts`.

## Simulator (`packages/sim`)

A Modified Nodal Analysis engine with Newton-Raphson for nonlinear parts and companion models for capacitors and
inductors, run in a Web Worker. Small circuits (under about 60 nodes) must run in real time; the heaviest Unit 2
circuit (the five-transistor siren) runs at about 4 x real time. Models, defaults and numbers: `packages/sim/README.md`.

Netlist contract (stable; `packages/bench` and `content/labs` depend on it):

```ts
type NodeId = string;                      // "gnd" is the reference node
type Netlist = { parts: PartSpec[]; seed?: string };   // seed: mixed into per-part spreads (tolerances etc.)
type PartSpec =                            // discriminated by kind; pins map pin name -> node
  | { id: string; kind: "resistor"; pins: { a: NodeId; b: NodeId }; ohms: number; watts?: number;
      tolerance?: number; actualOhms?: number }        // tolerance default 0.05; actualOhms forces the real value
  | { id: string; kind: "battery"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number; mAh?: number }
  | { id: string; kind: "led"; pins: { anode: NodeId; cathode: NodeId }; color: LedColor; maxmA?: number }
  | { id: string; kind: "switch"; pins: { a: NodeId; b: NodeId }; closed: boolean }        // input: closed
  | { id: string; kind: "pushbutton"; pins: { a: NodeId; b: NodeId }; pressed?: boolean;
      normallyClosed?: boolean }                                                            // input: pressed
  | { id: string; kind: "spdt"; pins: { com: NodeId; a: NodeId; b: NodeId }; to: "a" | "b" }  // input: to
  | { id: string; kind: "dpdt"; pins: { com1: NodeId; a1: NodeId; b1: NodeId; com2: NodeId; a2: NodeId; b2: NodeId };
      to: "a" | "b" }                                       // two SPDT poles on one actuator; input: to
  | { id: string; kind: "fuse"; pins: { a: NodeId; b: NodeId }; amps: number }
  | { id: string; kind: "capacitor"; pins: { pos: NodeId; neg: NodeId }; farads: number; volts?: number; polarized?: boolean;
      leakOhms?: number; esrOhms?: number; tolerance?: number; actualFarads?: number }
  | { id: string; kind: "pot"; pins: { a: NodeId; wiper: NodeId; b: NodeId }; ohms: number; position: number }
  | { id: string; kind: "relay"; pins: { coilA: NodeId; coilB: NodeId; com: NodeId; no: NodeId; nc: NodeId;
      com2?: NodeId; no2?: NodeId; nc2?: NodeId }; coilOhms: number; pullIn: number; dropOut: number;
      coilHenries?: number; operateMs?: number; releaseMs?: number; tolerance?: number }
  | { id: string; kind: "npn"; pins: { c: NodeId; b: NodeId; e: NodeId }; model?: "2N3904" }
  | { id: string; kind: "phototransistor"; pins: { c: NodeId; e: NodeId }; light?: number }  // input: light 0..1
  | { id: string; kind: "diode"; pins: { anode: NodeId; cathode: NodeId }; model?: "1N4001" | "1N4148" }
  | { id: string; kind: "speaker"; pins: { a: NodeId; b: NodeId }; ohms: number; henries?: number; watts?: number;
      enclosure?: boolean }
  | { id: string; kind: "multimeter"; pins: { com: NodeId; vohm: NodeId; ma: NodeId; a10: NodeId };
      mode: MeterMode; range?: string }                     // input: mode, range, replaceFuse
  | { id: string; kind: "probe-resistance"; pins: { a: NodeId; b: NodeId }; ohms: number }  // skin, water; input: ohms
  | { id: string; kind: "cell"; pins: { pos: NodeId; neg: NodeId }; emf: number; internalOhms: number }  // fruit cell etc.
  | { id: string; kind: "wire"; pins: { a: NodeId; b: NodeId }; ohms?: number };  // ohms: clip and test leads
type MeterMode = "off" | "dcv" | "acv" | "dca-ma" | "dca-10a" | "ohm" | "continuity" | "diode";
```

The sim package owns the exact types (`packages/sim/src/types.ts`) and may add kinds and optional params, but must
not rename existing fields.

Runtime API:

```ts
import { createSimClient } from "@ohmland/sim/client"; // main thread: no engine code, spawns the worker
// In-thread (tests, Node, lab solution checks): import { createSimulation, simulateFor } from "@ohmland/sim"

const sim = await createSimClient();            // createSimulation() is the same API in-thread
sim.load(netlist);                               // full rebuild; keeps state (charge, damage, heat, wear) of parts whose id survives
sim.setInput(partId, key, value);                // pressed, closed, to, position, light, ohms, mode, range,
                                                 // replaceFuse (meter: fit a new mA fuse), replace (any part: fresh part, same id)
sim.run({ speed: 1 });                           // real time; below 1 slow motion; up to 3600 time-lapse (audio muted above 4)
                                                 // in-thread step(dt, { speed }) takes a time-lapse's larger steps (replays)
sim.onSnapshot((s: Snapshot) => ...);            // about 30 per second
type Snapshot = {
  t: number;                                     // simulated seconds
  nodes: Record<NodeId, number>;                 // volts
  parts: Record<string, PartState>;
  events: SimEvent[];                            // since last snapshot
  lag?: number;                                  // 0..1, how far behind real time x speed the sim is
};
type PartState = {
  i: number; v: number; p: number;               // current through (first pin to second), voltage across, power
  temp: number;                                  // degrees C
  health: "ok" | "hot" | "smoking" | "dead";     // dead parts become open
  glow?: number;                                 // LEDs: 0..1 perceived brightness (30 ms average, brief flashes held)
  closed?: boolean;                              // relays, switches
  display?: string;                              // multimeter: "9.12", "OL", "-0.42", " .000"
  unit?: string;                                 // multimeter annunciator
  extra?: Record<string, number | string | boolean>;  // per-kind detail (actual values, wear, armature, ...)
};
type SimEventType = "damaged" | "died" | "blown" | "clicked" | "shorted" | "reversed" | "smoke" | "meter-fuse"
  | "spark" | "warning";                        // data.cause on damage events: reverse, overvoltage, overcurrent,
                                                 // overheat, overpower, worn; clicked has data.to ("no" | "nc")
```

Sign conventions worth knowing: a battery's `i` flows from `pos` to `neg` through the part, so it is negative while
the battery discharges; `extra.out` is the current it delivers from its + terminal. For transistors `i` is the
collector current and `v` is Vce (collector minus emitter), not the first-pin-to-second-pin rule.

Audio: speakers expose an audio-rate sample stream (`sim.onAudio`, 44.1 kHz with the rate passed along) for an
AudioWorklet.

Damage is part of the lesson design: LEDs die above their current rating, resistors smoke above their power rating,
fuses blow on I squared t, the meter's mA input fuse blows, batteries heat when shorted, electrolytics vent when
reversed or over-volted, speakers cook above their rating, contacts spark and wear out. Every damage event carries
enough context for the lab to explain what happened.

## Workbench (`packages/bench`)

React Three Fiber components and logic for the lab bench:

- Procedural low-poly part models built in code (no downloaded models), clean and readable: resistor with correct
  colour bands for its value, LEDs (3 and 5 mm, colours, glow + bloom), 9 V battery and snap, alligator test leads,
  jumper wires, solderless breadboard, multimeter (rotary dial, LCD, banana sockets, probes), pushbutton, slide and
  toggle switches, fuse, capacitors (electrolytic, ceramic, with legs that bend to reach holes up to seven apart),
  potentiometer, relay (DPDT, or single changeover with `poles: 1`), NPN transistor (TO-92), phototransistor, small
  speaker, touch pads, AA and coin cells, 1 W and 5 W resistors, plus lab props: cups of water, fruit cells, a
  resistor holder, a battery tester, a lemon half with copper and zinc electrodes, a skin patch, a copper wire and a
  plastic ruler, a pencil card, value labels, a reject bin, a colour chart, a desk clock, a display case.
- Desk modules for circuits built with clip leads: a pushbutton, slide or toggle switch, panel pot, relay or DPDT
  switch (`dpdt-switch`) mounted on a wooden block with brass screw terminals (`base: true`, `tag` prints a name on
  its front). A relay or DPDT switch can be a mystery (`mystery`: its terminals are wired inside in a shuffled order
  and show only numbers; `peek` shows the inside). `partLegs(part)` gives the leads a part actually has.
- Holders have seats (`PartDef.seats`, who sits where in `params.held`): a part dropped on one goes in and its leads
  join the holder's contacts. Props have settings and actions on the selection bar and clickable spots on the model
  (`PartDef.settings`, `actions`, `hotspots`). A part dropped right on one of its kind swaps places and wiring.
- The store also holds `inspect` (stress and heat readouts drawn over parts) and `ambient` (room lights, 1 to 0.1).
- Interaction: drag from a tray, snap leads into breadboard holes, rotate, delete, wire hole to hole, clip alligator
  leads and meter probes onto leads or terminals. Mouse, touch and keyboard.
- `benchToNetlist(bench: BenchState): { netlist: Netlist; nodeOf(anchor): NodeId }` using union-find over the
  breadboard's internal strips and every clip/lead connection.
- Part visuals read `PartState` (glow, health: smoke, scorch, cracked) from the simulator snapshot.

`BenchState` is plain serialisable data (saved for sandbox builds and lab checkpoints).

`@ohmland/bench/core` exports the pure half (BenchState ops, layout, `benchToNetlist`, the store) without React Three
Fiber or three.js, for lab runtimes, solution replays and tests. `benchToNetlist` gives each crocodile lead 0.15 Ω
(`leadOhms`, 0 merges the clips into one node) and each plugged-in meter probe lead 0.1 Ω (`probeOhms`, parts
`<meter>:red` and `<meter>:black`). Part mappings may build small internal networks (the skin's and the pencil
line's resistor ladders, internal nodes named `<id>#k`) and look at other parts (`NetContext`: a fruit cell reads its
electrodes). `<Bench locked>` keeps parts in place; `<Bench store>` without a
`snapshot` prop leaves the snapshot to whoever owns the store (each part model subscribes to its own state).

## Labs (`content/labs/*.ts`)

The authoring guide is `docs/LABS.md`; the types are in `apps/web/src/lab/define.ts` (imported by labs as
`@ohmland/lab`, a Vite alias and a tsconfig path).

```ts
import { defineLab } from "@ohmland/lab";

export default defineLab({
  id: "first-glow",
  title: "Your first glow",
  bench: {
    board: "none",                      // "none" | "half" | "full" ("breadboard" = "full")
    parts: [{ id: "B1", kind: "battery", at: "desk:-74,6", params: { emf: 9.4 }, locked: true }],   // bench kinds, typed params
    leads: ["B1.pos -> S1.com"],        // crocodile leads; wires: ["a9 -> rail-:9"] for jumpers
    tray: [{ kind: "lead", params: { color: "red" }, count: 1 }, { id: "D2", kind: "led", params: { color: "red" } }],
    instruments: ["meter", { kind: "scope", traces: [{ label: "C1", volts: "C1.pos" }] }],
    controls: [], nodes: {},            // sliders bound to sim inputs; named nodes
  },
  mascot: { start, hint, success, fried, exit },
  fried: { led: "Red LED, no resistor on 9 V" },                    // Hall labels by part id or kind
  triggers: { lawmaker: (lab) => ... },                             // achievement triggers, checked every snapshot
  tasks: [{ id, prompt, goal: (lab) => boolean, hints, success, notice?, bonus?, mascot?, highlight?, note?, trigger? }],
  solution: [{ do: "lead", from: "B1.pos", to: "R1.a" }, { do: "check", task: "build-loop" }],
});
```

Places (`at`) are shorthand: holes (`"e12"`, `"e5-e9"`, `"rail+:12"`), `"rails"` for a snap battery, desk spots
(`"desk:x,z"` in mm), a holder's seat (`"in:H1"`), and in solutions another part's place (`"on:B1"`, a swap).
Attach points are `"R1.a"`, `"e12"`, `"W1.b"`, `"TL1.a"`, `"red"`, and in solutions `"wired:K1.coil1"` (the terminal
of a mystery part wired as that lead). `frame` names the desk rectangle the camera frames. `defineLab` checks the
cheap invariants (kebab-case id, unique task, part and panel ids, checkpoints and panel answers that name real tasks
and panels) when the lab loads. The first-draft form of the Unit 1 and 2 stubs (simulator kinds, `props`,
`kind: "wire"` leads) still loads.

Labs can declare panels (worksheets beside the tasks, `panels.ts` logic and `panels-ui.tsx`): continuity and truth
tables that fill themselves from the bench, a pin map that counts wrong submissions, tags, a hole hunt and a symbol
builder. Instruments beyond the meter and scope: a data logger (plot from a trigger, with a cursor), a stopwatch
(starts on a switch, stops on a relay's contact, keeps runs), an auto-tapper (works a pushbutton in simulated time)
and `{ kind: "inspect" }` readouts over parts. The scope can take a single shot: the runtime pauses the worker,
applies the learner's switch action and steps the simulator in sub-microsecond to tens-of-microsecond steps through
the next few milliseconds (a coil's kickback).

`goal` receives a read-only `LabView` (`createLabView(...)`, pure): the bench, the latest snapshot, the event log and
recent history, the meter (mode, range, sockets, parsed value), the notebook, and helpers for the blueprint's checks
(`isLit`, `closed`, `fried`, `died`, `event`, `count`, `volts`, `amps`, `connected`, `joins`, `legs`, `seriesLoop`,
`chain`, `parallel`, `loopOpen`, `across`, `probed`, `inSeries`, `meterReads`, `heldFor`, `history`, `stats`,
`timeAbove`, `periods`, `blinkPeriod`, `relayPeriods`, `toneHz`, `toneHistory`, `relayClicks`, `actual`, `panel`,
`runs`, `loggerStart`, `tapping`, `logged`, `note`, `control`, `holds`, `heldBy`, `distance`, `doneAt`, `trigger`,
per-task `memory` and lab-wide `shared`). Required tasks are checked in order, one at a time; bonus tasks all the
time. Every lab ships a `solution` (bench actions with `check` points); `apps/web/src/lab/solutions.test.ts` replays
each one headlessly (`replay.ts`: bench ops + the in-thread simulator) and fails when a required task is not done or
a lab has no solution. Controls can drive a part's input (every part of a kind with `part: "*"`), the run speed
(`key: "speed"`, a time-lapse the replay fast-forwards too) or the room lights (`key: "room"`).

Runtime (`apps/web/src/lab`):

- `LabStepHost` (lesson player) lazy-loads `LabStep` and the lab module (`import.meta.glob`, one chunk per lab);
  `LabStep` lazy-loads `BenchView`, the only module that imports three.js. `prefetch.ts` warms all three, spawns
  the simulator worker and draws the bench's desk texture (`prepareBench()`, when idle) on the learner's first tap on
  the step before the lab (or after 4 s), never during first load; a lesson resumed at its lab starts them all at
  once from `LabStepHost`. `LabStep` and `BenchView` are preloadable components: once warm they render without a
  Suspense fallback (React would hold a revealed fallback back for 300 ms).
- `<Bench>` holds its first frame while three's `compileAsync` compiles the scene's shaders in parallel (in the
  variant post-processing renders, on high quality) and uploads the drawn textures, for at most 2.5 s, and reports
  ready one frame after the first.
- `LabRuntime` (`runtime.ts`) owns the bench store, the worker client and a `LabSession` (`session.ts`, pure: task
  order, notebook, fried parts, triggers). Each committed bench change rebuilds the netlist and calls `sim.load`
  (state carries over by part id); bench `input` actions go to `sim.setInput`; snapshots go to the bench store and
  the session. Goals wait for the first snapshot of a new circuit before they run again.
- Finished tasks are saved in the lesson answers (`tasks:<lab>`, task XP on completion) and sent to the store as a
  `task` lab event; dead parts go to `recordFried(kind, label, lessonId, { silent: true })` with an in-lab card and
  "Replace part" (`replace` input) or "Replace meter fuse" (`replaceFuse`); triggers go to `labEvent`.
- Instruments panel: the meter readout (mirrors the LCD, dial and range settable), the scope (canvas, two traces of
  history, a single shot, a pitch readout), the logger, stopwatch and tapper, sliders (a slider can drive every part
  of a kind: the desk lamp lights every phototransistor), the lab's panels, the notebook and a connections panel
  (every clip and probe as selects: the keyboard path).
- Sound: short synthesised cues, relay clicks synthesised from `clicked` events (a buzz when they come fast) and the
  speaker stream through an AudioWorklet (ScriptProcessor fallback), created on the learner's first tap, silent when
  muted.
- Layout: bench beside the panel on desktops; on phones the bench takes 55% and the panel is a bottom sheet. Quality
  is automatic (low on phones, small or weak devices and software WebGL) with a toggle remembered in
  `localStorage` (`ohmland:bench-quality`).
- `window.ohmlandLab` (`project`, `pickAt`, `bench`, `status`, `part`, `meter`, `sim`, `showMe`, `panel`) is a test
  and tutorial hook.

The free-build bench (`/bench`, `Sandbox.tsx`) is the same runtime with no tasks: the tray comes from the parts bin
(`sandbox-parts.ts`, a battery and three clip leads for everyone), the meter and scope come with their parts, builds
save to `LearnerState.sandbox` (`saveBench`, `deleteBench`), and fried parts go to the Hall with no lesson.

## Island (`packages/isle`)

`makeIsle(seed, events): IslePlan` is pure and deterministic across CPUs (seeded PRNG, no `Math.sin`/`cos` in the
planner, Pitko's fdlibm approach). `mountIsle(el, plan, opts)` renders with vanilla three.js, instanced meshes,
orthographic isometric camera, flat-shaded vertex colours, voxel style. `view.reveal(from, to)` animates what the
latest events added. Each unit is its own island in an archipelago, linked by cable bridges.

- `preloadIsle()` fetches the renderer and three.js without drawing, so a mount that follows starts at once.
- `primeAudio()` (also `@ohmland/isle/audio`, which has no three.js in it) creates and resumes the page's shared isle
  audio context; call it inside a tap so the reveal's sound plays in Safari. `opts.audio` passes a context of your own.
- `opts.inset: { bottom }` is screen space (CSS px) covered by, say, a caption card: the isle and its reveals frame
  above it. `view.setInset()` changes it.
- `opts.autoRotate` (degrees a second) turns a teaser slowly round instead of swaying, refitting the frame as it turns;
  at its start angle it frames exactly as a still view does, so a poster drawn still matches it.
- `view.clearPick()` forgets the tapped thing, so a label the learner closed is not sent again as the camera moves.

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
merge, island determinism, SI parsing, the resistor colour code, the cloud document packing and the sync write queue.
Playwright for a few critical paths: finish a lesson as a guest, a guest's pages load no Firebase, complete a lab,
island reveal. Plus `pnpm lint:copy` (no em dashes), the content check (the web build fails on invalid content) and
`pnpm --filter @ohmland/web lint:colors` (no raw colours or durations outside `tokens.css`).

With the Firebase emulators (Java 21+, `docs/ACCOUNTS.md`): `pnpm test:rules` runs `apps/web/rules` (Vitest and
`@firebase/rules-unit-testing` on the Firestore emulator) and `pnpm e2e:accounts` runs `apps/web/e2e/accounts`
(sign in with the Auth emulator's fake Google user, sync, offline, a second device, the "progress from before"
question, account deletion, a change sent while the tab closes) against an emulator build.

`apps/web/scripts/screenshots.mjs` takes screenshots of every page and lesson step in both themes at 1440x900 and
390x844 for visual review; a curated set lives in `apps/web/screenshots/` (with the lab shots from
`scripts/lab-shots.mjs`). Headless Chromium gets WebGL from SwiftShader (`--use-angle=swiftshader
--enable-unsafe-swiftshader`). The island's clock is pinned (`?time=12:00` in light shots, `22:00` in dark ones),
seeded learners (`scripts/seed.mjs`: one lesson done, the first module done, or one lesson short of it) use fixed
dates, and shots wait for islands to settle, so islands look the same in every run. `apps/web/scripts/isle-poster.mjs` renders the
landing hero's day and night stills from the live island (1200 and 640 px wide, plus the tiny blurred copies that
`tokens.css` inlines so the hero frame is never empty).
