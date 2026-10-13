# How to write a lab

A lab is the hands-on step of a lesson: a 3D bench driven by the real simulator, a short list of tasks, and a
solution that proves the tasks can be done. This guide covers the lab file. For the bigger picture see
`docs/ARCHITECTURE.md` (Labs, Workbench, Simulator); for wording rules see `docs/CONTENT.md`.

The two reference labs are `content/labs/welcome-to-the-bench.ts` (a pre-wired loop on the desk) and
`content/labs/first-glow.ts` (a loop built from the tray, with a part to burn out). Copy one to start.

## The file

`content/labs/<lab-id>.ts`, named after the lesson's `lab` step, default-exports `defineLab({...})`:

```ts
import { defineLab, type LabView } from "@ohmland/lab";

export default defineLab({
  id: "first-glow",
  title: "Your first glow",
  bench: { board: "none", parts: [...], leads: [...], tray: [...], instruments: [] },
  mascot: { start: "...", hint: "...", success: "...", fried: "...", exit: "..." },
  fried: { led: "Red LED, no resistor on 9 V" },
  tasks: [{ id: "build-loop", prompt: "...", goal: (lab) => ..., hints: ["..."], success: "..." }],
  solution: [{ do: "lead", from: "B1.pos", to: "R1.a" }, { do: "check", task: "build-loop" }],
});
```

Helpers shared by several labs go in `content/labs/lib/` (never in `content/labs/` itself: every `.ts` there is a lab).

## The bench

```ts
bench: {
  board: "none",                    // "none", "half" (400 points) or "full" (830 points; "breadboard" also works)
  parts: [
    { id: "B1", kind: "battery", at: "desk:-72,2", rot: 270, params: { emf: 9.4, internalOhms: 1.7, mAh: 500 }, locked: true },
    { id: "S1", kind: "toggle-switch", at: "desk:-6,-42", params: { base: true, to: "a" }, label: "Switch" },
    { id: "R1", kind: "resistor", at: "e5-e9", params: { ohms: 1500 } },
    { id: "D1", kind: "led", at: "e10", params: { color: "red", maxmA: 50 } },
  ],
  leads: ["B1.pos -> S1.com", { id: "TL2", from: "S1.b", to: "R1.a", color: "yellow" }],
  wires: ["a9 -> rail-:9"],
  tray: [{ kind: "lead", params: { color: "red" }, count: 1 }, { id: "D2", kind: "led", params: { color: "red" }, count: 1 }],
  instruments: [{ kind: "meter", mode: "off", red: "vohm", black: "com" }, { kind: "scope", traces: [{ label: "C1", volts: "C1.pos" }] }],
  controls: [{ id: "light", label: "Lamp", part: "Q2", key: "light", min: 0, max: 1, value: 0.3, unit: "%" }],
  nodes: { c: "C1.pos" },
}
```

**Kinds** are the bench's (`packages/bench`, `BenchPartKind`): resistor, led, battery, pushbutton, slide-switch,
toggle-switch, fuse, ceramic-cap, electrolytic-cap, trimmer, relay, npn, phototransistor, diode, speaker, cup, lemon.
`params` are typed per kind (`PartParamsMap`). Useful ones: resistor `ohms` (the bands), `actualOhms` (an
out-of-spec part, whose body then looks slightly darkened), `tolerance` (percent, default 5: the simulator spreads each
part's value by its id), `watts` (1 W parts are bigger, 2 W and up are white ceramic blocks); capacitors
`actualFarads`; pushbutton `normallyClosed`; battery `snap` (leads that go into the board), `size` (`"aa"` in a
cradle, `"coin"` in a holder), `chem` (`"nimh"`, `"lithium"`) and `worn` (a scuffed, used one); toggle-switch
`base: true` (a big switch on a wooden block for desk circuits: wire it between `com` and `b`, so "on" means thrown
to b).

**Lab props** are desk-only kinds for the Unit 1 experiments (models and numbers in `packages/bench/README.md`):

| Kind | What it is | Leads |
|---|---|---|
| `holder` | Two spring clips holding a resistor (or diode); a screw terminal at each end | `a b` |
| `station` | A battery tester: a bay for any battery, + and − posts, a switchable `load` (`loadOhms`, 100 Ω) | `a` (+) `b` (−) |
| `fruit` | Half a lemon with two electrode slots; `touching` pushes the electrodes together | (the electrodes') |
| `electrode` | A copper-plated coin or a zinc strip (`metal`) | `tip` |
| `skin` | A skin patch: `moisture` dry, damp, wet or salty, probe `pressure` light or firm | `m0` to `m4`, 1 cm apart |
| `sample` | A bare copper wire or a plastic ruler (`material`) | `a b` |
| `card` | A pencil card: a line from the 0 mark, `length` (cm), `layers`, `wide` | `p0` to `p20`, every 0.5 cm |
| `tag`, `bin`, `chart`, `clock`, `showcase` | A value label (`text`), a reject bin, the colour code, a clock showing simulated time, a display case | none |

Holders (`holder`, `station`, `fruit`, `bin`) have **seats**: a part dropped on one goes in (the one already there
pops out), and a seated part's leads touch the holder's contacts. Props have **settings** (moisture, the test load,
the pencil line) on their selection bar, and some have clickable spots on the model (the skin's moisture tabs, the
tester's load switch); dragging along a pencil card draws or shades its line. Dropping a part right onto one of its
own kind swaps the two, clips and probe tips included (a fresh LED for a dead one, an old battery for a fresh one).

**Places** (`at`):

| Shorthand | Meaning |
|---|---|
| `"e12"` | The part's first lead in hole e12, the rest following its footprint (`rot` turns it) |
| `"e5-e9"`, `"a12-rail-:12"` | Holes for the first two leads (stretchable parts, flying leads, or one hole per lead) |
| `"rail+:12"`, `"rail-:12"`, `"top+:12"`, `"top-:12"` | Rail holes (near plus and minus, far plus and minus); raw `bp12`, `bn12`, `tp12`, `tn12` work too |
| `"rails"` | A battery with snap leads in the near rails at the left end of the board |
| `"desk:left"`, `"desk:x,z"` | A spot on the desk in millimetres from the middle (x to the right, z toward you) |
| `"in:H1"`, `"in:FC1.left"` | In a holder: its first free seat that fits, or that seat |
| `"on:B1"` | Solutions only: take B1's place, swapping the two (clips and probe tips follow) |
| nothing, `"shelf"` | Laid out in a row in front of the board (the shelf is the back row) |

`holes: { a: "e5", b: "e12" }` places leads one by one when the shorthand cannot say it. Real scale: 1 unit is 1 mm,
a 5 mm LED is 5 mm, so leave 50 to 80 mm between desk parts and test the framing.

**Attach points** for leads, probes and solution steps: a part lead `"R1.a"` (lead names: resistor `a b`, LED and
diode `anode cathode`, battery and lemon `pos neg`, switches `a com b`, pushbutton `a1 a2 b1 b2`, trimmer
`a wiper b`, npn `e b c`, props as in the table above), a hole `"e12"` or `"rail+:3"`, a jumper end `"W1.b"`, a clip
`"TL1.a"`, a probe `"red"`. A probe tip can touch a clip (even one lying loose) or the other probe's tip.

**Leads** are crocodile test leads, `"B1.pos -> S1.com"` or `{ id, from, to, color }`; either end may be `null`
(lying on the desk). Each has 0.15 Ω of resistance in the simulator, and each meter probe lead 0.1 Ω (touching the
tips together reads about 0.2 Ω). **Wires** are breadboard jumpers.

**Locked** parts cannot be moved, rotated or deleted; switches still flip and buttons still press.

**Tray** items are what the learner can drag in. `count` is how many; `id` names the first one placed (goals can
then say `"D2"`). `kind: "lead"` is a clip lead.

**Instruments**: `"meter"` or `{ kind: "meter", mode, range, red, black, probes: { red: "B1.pos" }, at, spareFuses }`,
and `{ kind: "scope", traces, window, range }` (one or two traces: `{ label, volts: node, ref? }`, `{ label, amps:
partId }` or `{ label, glow: ledId }`). `{ kind: "inspect", show: "stress" | "heat", parts: ["led"] }` floats a
readout over parts (by id or kind): an LED's current as a share of its maximum (green, amber past half, red past
90%), or a part's temperature with a touch-feel word (cool, warm, hot, ouch). `logger`, `stopwatch` and `tapper` are
accepted and planned.

**Controls** are sliders bound to a simulator input (`light`, `ohms`, `position`): the lamp over a phototransistor,
a fingertip's resistance. Two more need no part: `key: "speed"` sets how fast the simulation runs (1 is real time, up
to 3600 for a time-lapse; pair it with a `clock` prop), and `key: "room"` dims the room lights (1 bright down to
0.1) so a faint glow shows. Goals read them with `lab.control(id)`.

**Nodes** name nodes for goals and scope traces: `nodes: { c: "C1.pos" }` makes `lab.volts("c")` work.

The first drafts of the Unit 1 and 2 labs used simulator kinds and `props` (`kind: "switch"`, `kind: "wire"` with
`at: "B1.pos|S1.a"`, `kind: "multimeter"`). Those still load (see `LegacyPart` in `define.ts`), but write new labs
with the forms above and move old ones over when you finish their goals.

## Tasks

```ts
{
  id: "break-the-loop",                 // stable: progress stores it for XP
  prompt: "Keep the switch on. Now unclip any one lead, anywhere in the loop.",   // markdown
  goal: (lab) => lab.closed("S1") && lab.bench.detachedLeadEnds >= 1 && lab.loopOpen("D1"),
  hints: ["Drag one end of any clip lead off its part.", "Pick a lead far from the LED."],   // gentlest first
  highlight: ["TL1"],                   // pulses on the bench once the first hint is open
  success: "Dark. One gap anywhere stops the flow everywhere.",
  notice: "The gap does not have to be next to the LED.",   // what to notice, under the success line
  mascot: { hint: "...", success: "..." },                  // overrides the lab's lines for this task
  note: { id: "sum", label: "Your total", unit: "V" },      // a notebook entry: lab.note("sum")
  trigger: "some-achievement",          // fired when the task is done (see Achievements)
  bonus: true,                          // or optional: true
}
```

- Required tasks are checked **one at a time, in order**: only the current one runs, on every snapshot (about 30 a
  second). So a later task can assume the earlier ones happened ("mend the loop" just checks `isLit`).
- Bonus tasks are checked **all the time** and never block Continue. The learner can skip them.
- Continue is always available: the tasks guide, they never trap (a browser without WebGL can finish the lesson).
- Each task done is worth `XP.task` (15) when the lesson completes. Task ids are kept even if the lab changes.
- "Show me" appears once every hint has been read and plays the task's part of the solution on the bench.

## What a goal can read (`LabView`)

| Helper | |
|---|---|
| `lab.part(id)` | Simulated state: `i`, `v`, `p`, `temp`, `health`, `glow`, `closed`, `extra` (see packages/sim/README.md) |
| `lab.benchPart(id)`, `lab.prop(id)` | The part as placed (kind, params, holes), its params |
| `lab.bench`, `lab.bench.detachedLeadEnds` | The BenchState; clip ends lying loose |
| `lab.isLit(id, min = 0.1)`, `lab.closed(id)` | LED glowing and alive; switch (thrown to b), button, relay (COM on NO), fuse closed |
| `lab.fried(kind?)`, `lab.died(id)` | A part (of a kind: `led`, `resistor`, `fuse`, `meter-fuse`, ...) died in this lab |
| `lab.event(type, id?)`, `lab.count(type, id?, seconds?)` | Simulator events since the lab started |
| `lab.volts(node, ref?)`, `lab.amps(id)` | A node's voltage (name, attach point or netlist node); current size |
| `lab.connected(a, b)` | Two attach points are joined by metal |
| `lab.seriesLoop(["B1", "R1", "D1"])` | Exactly these parts form one series loop in this order, from the battery's plus |
| `lab.chain(["FC1", "FC2"])` | The parts are linked end to end in one open chain (any order, nothing else on the links): `{ ends, flipped }`, the first end where most of them point from (a cell stack's plus), and the parts turned the other way |
| `lab.parallel("R1", "R2")` | Both parts' leads sit on the same two nodes |
| `lab.probed(a, b, "rev" \| "either")` | Red probe on `a` (or metal joined to it), black on `b` |
| `lab.holds("H1")`, `lab.heldBy("R2")` | Who sits in a holder; which holder a part sits in |
| `lab.distance("L1", "R1")` | Desk distance between two parts, in mm (a label placed by a resistor) |
| `lab.doneAt(taskId)` | When a task was done in this visit, and the meter as it read then (`?.meter?.si`) |
| `lab.loopOpen(id?)` | No current anywhere (or through `id`) |
| `lab.meter` | `mode`, `range`, `auto`, `red`/`black` (sockets), `redAt`/`blackAt`, `display`, `unit`, `value` (OL is Infinity), `si`, `fuse`, `beep` |
| `lab.across(id, "rev" \| "either")`, `lab.probesAcross(id, opts)` | Red probe on the first lead, black on the second |
| `lab.inSeries("M1", id)`, `lab.meterInSeriesWith(id)` | The meter on a current range, right socket, carrying the part's current |
| `lab.meterReads(value, { tol, unit })` | The display within `tol` (default 5%), in its own unit or in `unit` |
| `lab.heldFor(seconds, cond, key?)` | `cond` has held for that long in simulated time (per task) |
| `lab.history("glow:D1", seconds)` | Recent samples of `glow:`, `i:`, `v:`, `temp:`, `p:` a part or `volts:` a node |
| `lab.blinkPeriod(id)`, `lab.toneHz(id)` | Seconds between an LED's flashes; the speaker's pitch from the audio stream |
| `lab.relayClicks(id, seconds?)`, `lab.relayClicked(id)` | Relay contact moves |
| `lab.logged(tag)`, `lab.readings(tag?)`, `lab.readingsLog` | Stable meter readings in the notebook (see below) |
| `lab.note(id)`, `lab.control(id)`, `lab.task(id)` | Typed numbers, slider values, other tasks' status |
| `lab.memory` | Scratch space kept between checks of the same task |
| `lab.trigger(name)` | Fire an achievement trigger from a goal |

Goals must be pure apart from `lab.memory` and `lab.trigger`: no timers, no globals. A goal that throws counts as
false (and warns once in the console).

**The notebook** logs a reading by itself when the meter shows the same value for 0.6 s with a probe on something.
Each reading is tagged with what the probes were on: the part id and `across:R1` (or `rev:R1`) for voltage and
resistance, `series:D1` for current. Add your own tags with `notebook: { tags: { open: (lab) => !lab.closed("S1") } }`.

## Fried parts

When the simulator kills a part, the runtime adds it to the Hall of Fried Parts, shows a card with the simulator's
explanation and a "Replace part" button (or "Replace meter fuse"), and the mascot says the lab's `fried` line. Name
the Hall entry with `fried: { D1: "...", led: "..." }` (by part id or kind) or a function `(f) => string`.

## Achievements

A task's `trigger`, a lab's `triggers: { name: (lab) => boolean }` (checked on every snapshot) and `lab.trigger(name)`
fire a named trigger once per visit. An achievement in `apps/web/src/progress/achievements.ts` with
`labEvent: "name"` unlocks when it fires. The runtime also fires `relay-clicked`, `relay-worn-out`,
`capacitor-reversed-died` and `speaker-concert-a` by itself, in every lab and on the free-build bench.

## Solutions

Every lab ships a solution: bench actions, as data. `apps/web/src/lab/solutions.test.ts` replays each one with the
real simulator (no browser) and fails if a required task is not done, a checkpoint is late or a step does not apply.
An empty solution is reported as skipped.

| Step | |
|---|---|
| `{ do: "lead", id?, from, to, color? }` | A clip lead from the tray between two attach points (either may be null) |
| `{ do: "clip", lead, end: "a" \| "b", to }` | Move one clip (`to: null` unclips it) |
| `{ do: "place", part, kind, at, params? }`, `{ do: "move", part, at }`, `rotate`, `remove` | Parts |
| `{ do: "wire", from, to }`, `{ do: "unwire", wire }` | Breadboard jumpers |
| `{ do: "probe", red?, black?, mode?, range? }`, `{ do: "plug", probe, socket }`, `{ do: "dial", mode, range? }` | The meter |
| `{ do: "flip", part, to? }`, `{ do: "press", part, seconds? }`, `{ do: "set", part, key, value }` | Switches, buttons, raw inputs |
| `{ do: "param", part, params }`, `{ do: "action", part, action }` | A prop's settings (`{ moisture: "wet" }`, `{ length: 5 }`) and one-shot actions (`"erase"`), as from its selection bar |
| `{ do: "control", id, value }`, `{ do: "note", id, value }` | Sliders, notebook entries |
| `{ do: "replace", part }`, `{ do: "replaceFuse" }`, `{ do: "wait", seconds }` | |
| `{ do: "check", task }` | By here, this task is done. Also splits the solution for "Show me" |

Each step lets 0.25 s of simulated time pass. Put a `check` after the steps of each task: "Show me" rewinds to the
bench at the previous check and plays the steps up to this one.

## Trying a lab

- `pnpm --filter @ohmland/web test` replays every solution. Every Unit 1 (basics) lab must have one; the bench
  must build without warnings. A `speed` control raised in a solution fast-forwards the replay like the runtime.
- `replayLab(lab, (line) => console.log(line))` (`apps/web/src/lab/replay.ts`) prints each step with the meter's
  display and the tasks done so far: handy while writing a solution.
- `pnpm dev`, open the lesson, Continue to the lab. The page installs `window.ohmlandLab` (`status()`, `bench()`,
  `part(id)`, `meter()`, `project(anchor)`) for poking at it from the console; the e2e helpers in
  `apps/web/e2e/lab.ts` use it to click and drag like a learner.
- `node apps/web/scripts/lab-shots.mjs` takes the curated lab screenshots.
