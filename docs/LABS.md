# How to write a lab

A lab is the hands-on step of a lesson: a 3D bench driven by the real simulator, a short list of tasks, and a
solution that proves the tasks can be done. This guide covers the lab file. For the bigger picture see
`docs/ARCHITECTURE.md` (Labs, Workbench, Simulator); for wording rules see `docs/CONTENT.md`.

The reference labs are `content/labs/welcome-to-the-bench.ts` (a pre-wired loop on the desk),
`content/labs/first-glow.ts` (a torn drawing to mend, a breadboard build from the tray, a fix-it bench),
`content/labs/how-a-breadboard-works.ts` (a breadboard lamp that starts wrong, a jumper to slide) and, for Start here's
props, `content/labs/milli-and-kilo.ts` (a gate, tags, the padlocked cabinet) and `content/labs/parts-drawer.ts`
(symbol drawers and a tester with a gap). They are bench lessons' labs (`docs/LESSONS.md`). Copy one to start.

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

`settle: 5` (opt-in) runs the circuit for that many simulated seconds, unseen and unjudged, before the learner sees
it: at the start, and after a reset, a fix-it setup or a "Show me" rewind (each loads fresh parts). A 555 wakes with its
latch in a random state, so a one-shot may glow once at power-up; settling lets that glow end, and every learner starts
from a calm bench. The headless solution replay settles the same way. Labs without it show the bench at once.

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
toggle-switch, dpdt-switch, fuse, ceramic-cap, electrolytic-cap, trimmer, relay, npn, phototransistor, diode,
speaker, touch-pads, cup, lemon, and the lab props below. `params` are typed per kind (`PartParamsMap`). Useful ones:
resistor `ohms` (the bands), `actualOhms` (an out-of-spec part, whose body then looks slightly darkened), `tolerance`
(percent, default 5: the simulator spreads each part's value by its id), `watts` (1 W parts are bigger, 2 W and up
are white ceramic blocks); capacitors `actualFarads` and `span` (holes between the legs, 1 to 7: the legs bend to
reach); electrolytics `tolerance` (percent, default 20) and `leakOhms` (default 1 MΩ from 100 µF up: a lab that times
a long 555 delay sets 5 and 5e7 so the delay matches 1.1 × R × C); pushbutton `normallyClosed`; battery `snap` (leads that go into the board), `size` (`"aa"` in a cradle,
`"coin"` in a holder), `chem` (`"nimh"`, `"lithium"`) and `worn` (a scuffed, used one); relay `poles: 1` (one
changeover: `coil1 coil2 com1 nc1 no1`), `coilOhms`, `coilHenries` (a kickback worth catching); toggle-switch
`throws: 1` (on/off only).

**Desk modules**: `base: true` mounts a pushbutton, slide or toggle switch, trimmer (a panel knob), relay or
dpdt-switch on a wooden block with brass screw terminals, for circuits built with clip leads; `tag: "S1"` prints a
name on its front. A base toggle switch is wired between `com` and `b`, so "on" means thrown to b. A relay or
dpdt-switch with `mystery: "shuffle"` hides how its terminals are wired inside (shuffled per learner, from the
learner's seed; a string of digits such as `"31402"` fixes the order) and shows only terminal numbers; `peek: true`
shows the inside.

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

**Start here props** (docs/curriculum/start-here.md, section 6; models in `packages/bench/README.md`):

| Kind | What it is | Leads |
|---|---|---|
| `sample` | More `material`s, the junk drawer's everyday objects: `key`, `coin`, `foil` (0.01 Ω), `pencil` (a pencil lead, 5 Ω), `spoon` (plastic), `metal-spoon`, `eraser`, `marble` (glass), `wood` (a dry stick, 1 TΩ), `string`, `clip` (a coated paper clip: `a` and `b` are its bare cut ends, `coat:PC1` its coating) | `a b` |
| `gate` | A counting gate: clips round a clip lead (`at: "lead:TL3"`, or dropped on one) and ticks once per flow dot that passes, with a rate bar; `mode: "number"` shows the current, its unit (`"A"`, `"mA"`) a button | none |
| `box` | A sealed box: parts sit inside (`at: "in:BOXA.s1"`, seats `s1` to `s4`) under a lid, only two brass terminals (or a knob) show. `wiring` joins what is inside: `{ "s1.pos": "t1", "s1.neg": "t2" }`, junctions `j1` to `j4` join parts to each other (`{ "s1.wiper": "j1", "s2.a": "j1" }`). `marks: "plain"` hides which terminal is plus; `knob: true` shows a knob that turns the trimmer inside; `tag: "10 kΩ"` ties a value tag to it; `label: "A"`. Tapping the lid opens it (`lid: true`); while it is shut, nothing inside can be seen, picked or clipped. A 9 V battery inside lies on its back | `t1 t2` |
| `box` with `style: "cabinet"` | The parts cabinet: no terminals, eight seats, a three-wheel padlock `lock: { wheels: ["4,700 Ω", "0.02 A", "9,000 mV"], set: [false, false, false] }` (each wheel shows its answer once set; the lid stays shut while one is unset) | none |
| `bin` with `style: "tray"` | A big sorting tray with a `label` on its front (the junk drawer's "lets flow through", "stops flow") | none |
| `bin` with `style: "drawer"` | A parts drawer with a symbol `face` (`battery`, `switch`, `resistor`, `led`) instead of a word; it takes only its own kind of part (`accepts` overrides: a wrong part stays out on the desk) | none |
| `schematic` | A drawing on a card: `symbols` round one loop (the first on the left, a battery with plus at the top, the rest clockwise), each `{ kind, part?, text? }`; `torn: 2` tears that symbol off, leaving a gap a `piece` fits into | none |
| `piece` | A torn piece of a drawing with one `symbol`; tapping it turns it a quarter (`turn`); dropped on the gap it sits in it | none |
| `balloon`, `scarf`, `paper`, `comb`, `wall` | The static toy (wave 2, see below) | none |

Batteries take `charge` (0 to 1, the state of charge a battery starts at: a tired battery for a time-lapse) and, for an
AA cell, `xray: true` (cut open along its length: the can, manganese dioxide, the separator, the zinc paste and the
brass pin); an AA with `xray` set (start it at `false`) toggles it when tapped. A `tag` tapped toggles `alt`: its value written out without the prefix ("10
kΩ" becomes "10,000 Ω", "20 mA" becomes "0.02 A", "2.2 MΩ" becomes "2,200,000 Ω", "9 V" stays).

**The static toy** is its own small model, not the circuit simulator (`packages/bench/src/static.ts`): moving a balloon,
a comb or a plastic spoon back and forth over the scarf rubs charge onto it (minus marks on it, as many plus marks on
the scarf, eight at most); a metal spoon keeps none (it drains through your hand). A charged thing within about 4 cm
of the paper bits lifts them; a charged balloon dropped against the wall's face sticks there, an uncharged one falls
back to the desk; two charged balloons will not come closer than about 4.5 cm.

Holders (`holder`, `station`, `fruit`, `bin`, `box`, `schematic`) have **seats**: a part dropped on one goes in (the one already there
pops out), and a seated part's leads touch the holder's contacts. Props have **settings** (moisture, the test load,
the pencil line) on their selection bar, and some have clickable spots on the model (the skin's moisture tabs, the
tester's load switch); dragging along a pencil card draws or shades its line, and a cup's "Add salt" stirs in a pinch
(`salt` counts them; each adds a parallel 7.5 kΩ). Dropping a part right onto one of its
own kind swaps the two, clips and probe tips included (a fresh LED for a dead one, an old battery for a fresh one).

**Unit 3 kinds** (soldering, perfboard, wire, wall power; models, numbers and screenshots in
`packages/bench/README.md`, "Unit 3"): `solder-station` (`on`, `setC`, `iron`: `"stand"`, a spot such as `"PB1.C7"`,
or `"desk"`; `tinning`, `spool`), `solder-spool` (`alloy`: `"leaded"`, `"lead-free"`, `"acid"`), `solder-braid`,
`perfboard` (`cols`, `rows`, `flipped` copper side up, `tack` legs meet without solder, `flexed` intermittent joints
open, `plan` a plan card's id, `joints`, `bends`, `links`), `plan-card` (`ghosts`, `lines`), `heat-sink-clip`
(`metal`, `on: "D1.anode"`, `mm`), `hookup-wire` (`color`, `awg`, `stranded`, `len`; ends `a b`), `wire-stripper`,
`heat-shrink` (`size`), `heat-gun`, `barrel-jack` (`tip sleeve`) and `wall-adapter` (`volts`, `amps`, `type`:
`"regulated"`, `"unregulated"`, `"ac"`; `centre`: `"plus"`, `"minus"`; `into: "J1"`). A bench with a station gets the
solder overlay in both views by itself: the iron, feeding, the magnifier, tugs, quick mode, heat view and the keys.

Legs go through a perfboard with `holes: { anode: "PB1:C7", cathode: "PB1:C8" }`. A leg touches its pad only through
a joint, so a fresh board conducts nothing until it is soldered (or `tack: true`). Setups and solutions cannot hold an
iron: they write the joints a beat needs with `madeJoint` (`@ohmland/bench/core`), e.g. `{ do: "param", part: "PB1",
params: { joints: { C7: madeJoint("good"), C8: madeJoint("cold") } } }`, and the iron's place with `{ do: "param",
part: "ST1", params: { iron: "PB1.C7" } }`. Spots are anchors (`spot:PB1.C7`, `spot:D1.anode`, `spot:ST1.stand`) for
`highlight` and the view's `focus`.

**Places** (`at`):

| Shorthand | Meaning |
|---|---|
| `"e12"` | The part's first lead in hole e12, the rest following its footprint (`rot` turns it) |
| `"e5-e9"`, `"a12-rail-:12"` | Holes for the first two leads (stretchable parts, flying leads, or one hole per lead) |
| `"rail+:12"`, `"rail-:12"`, `"top+:12"`, `"top-:12"` | Rail holes (near plus and minus, far plus and minus); raw `bp12`, `bn12`, `tp12`, `tn12` work too |
| `"rails"` | A battery with snap leads in the near rails at the left end of the board |
| `"desk:left"`, `"desk:x,z"` | A spot on the desk in millimetres from the middle (x to the right, z toward you) |
| `"in:H1"`, `"in:FC1.left"` | In a holder: its first free seat that fits, or that seat |
| `"lead:TL3"`, `"lead:TL3@0.3"` | A gate clipped round clip lead TL3 (halfway, or that far along from clip a) |
| `"on:B1"` | Solutions only: take B1's place, swapping the two (clips and probe tips follow) |
| nothing, `"shelf"` | Laid out in a row in front of the board (the shelf is the back row) |

A part with flying leads (a speaker, a desk battery's snap) can sit on the desk with `at: "desk:x,z"` and still put
its leads in holes with `holes`.

`holes: { a: "e5", b: "e12" }` places leads one by one when the shorthand cannot say it. Real scale: 1 unit is 1 mm,
a 5 mm LED is 5 mm, so leave 50 to 80 mm between desk parts and test the framing. `frame: ["tp1", "bn30",
"desk:-120,-40"]` makes the camera frame the rectangle around those places at the start and on reset view (default:
the whole bench); frame the circuit, not the empty half of the board. `splitRails: true` breaks a full board's
rails between columns 31 and 33.

**Attach points** for leads, probes and solution steps: a part lead `"R1.a"` (lead names: resistor `a b`, LED and
diode `anode cathode`, battery and lemon `pos neg`, switches `a com b`, pushbutton `a1 a2 b1 b2`, trimmer
`a wiper b`, npn `e b c`, relay `coil1 coil2 com1 nc1 no1 com2 nc2 no2`, dpdt-switch `a1 com1 b1 a2 com2 b2`, props
as in the table above), a hole `"e12"` or `"rail+:3"`, a jumper end `"W1.b"`, a clip `"TL1.a"`, a probe `"red"`. Three
**insulated spots** take a clip and join nothing: `"wrap:B1"` (a battery's plastic wrapper, beside its + snap),
`"base:S1"` (a desk switch's wooden block) and `"coat:PC1"` (a coated paper clip's coating); the tracer stops there. A
probe tip can touch a clip (even one lying loose) or the other probe's tip. On a mystery part `"K1.coil1"` is terminal
1 whatever it does inside; solutions say `"wired:K1.coil1"` for the terminal wired as the coil, so they work for
every shuffle.

**Leads** are crocodile test leads, `"B1.pos -> S1.com"` or `{ id, from, to, color }`; either end may be `null`
(lying on the desk). Each has 0.15 Ω of resistance in the simulator, and each meter probe lead 0.1 Ω (touching the
tips together reads about 0.2 Ω). **Wires** are breadboard jumpers.

**Locked** parts cannot be moved, rotated or deleted; switches still flip and buttons still press.

**Tray** items are what the learner can drag in. `count` is how many; `id` names the first one placed (goals can
then say `"D2"`). `kind: "lead"` is a clip lead.

**Instruments**:

| Config | |
|---|---|
| `"meter"`, `{ kind: "meter", mode, range, red, black, probes, tips, at, rot, spareFuses }` | `probes: { red: "B1.pos" }` starts the tips on something; `tips: { red: "desk:x,z" }` lays loose tips near the circuit when the meter sits off to one side |
| `{ kind: "scope", traces, window, range, capture, pitch, levels, duty }` | One or two traces: `{ label, volts: node, ref? }`, `{ label, amps: partId }` or `{ label, glow: ledId }`. `capture: { ms: 4, edge: "off" }` adds Arm: the next switch action (only switching off, with `edge: "off"`) is caught at a fast time base (`lab.capture()` reads it). `pitch: "SP1"` shows the speaker's pitch. `levels: [{ of: "U1.8", fraction: 2 / 3 }, { volts: 3 }]` draws dashed reference lines on the first trace's scale (a share of a node follows the supply as it sags). `duty: true` (or a trace index) adds a readout of high time, low time and duty; that trace's node is watched, so a kilohertz signal reads exactly |
| `{ kind: "logger", traces, start, seconds, range }` | Plots from a trigger (`start`: one or a list of `{ part, to }`, `{ part, pressed }`, `{ part, contact: "no" }`) or its Start button, with a cursor. `lab.loggerStart()` |
| `{ kind: "stopwatch", start, stop, watch? }` | Starts and stops by itself on those triggers and keeps every run; `watch` notes a node's volts at the start. Besides the logger's triggers, `{ part: "D1", lit: false }` (the moment an LED stops drawing current, timed halfway between snapshots) and `{ node: "U1.6", above: 6 }` or `{ node, below }` (the node is watched: the exact crossing). Switching a start switch back abandons a run; a start press, lamp or node is a moment, so a tapped button keeps timing. `lab.runs()` |
| `{ kind: "tapper", part, hz? }` | Presses a pushbutton `hz` times a second while switched on. `lab.tapping(id)` |
| `{ kind: "inspect", show: "stress" \| "heat", parts: ["led"] }` | Floats a readout over parts (by id or kind): an LED's current as a share of its maximum (green, amber past half, red past 90%), or a part's temperature with a touch-feel word (cool, warm, hot, ouch) |

**Controls** are sliders bound to a simulator input (`light`, `ohms`, `position`, `proximity`): the lamp over a phototransistor,
a fingertip on touch pads, a trimmer's knob. `part: "*"` drives every part that takes the input (one lamp for every
phototransistor). `scale: "log"` suits resistances. Two more need no part: `key: "speed"` sets how fast the simulation
runs (1 is real time, up to 3600 for a time-lapse; pair it with a `clock` prop), and `key: "room"` dims the room
lights (1 bright down to 0.1) so a faint glow shows. Goals read them with `lab.control(id)`. A `proximity` control is
the hand near a chip (`{ id: "hand", label: "Hand", key: "proximity", part: "U1", min: 0, max: 1, value: 0 }`, or
`part: "*"` for every chip): drawn as an ink hand moving toward the chip, it makes floating inputs pick up hum.

**Panels** are small worksheets beside the tasks, `panels: [...]` on the lab (not the bench). `show: ["task-id"]`
shows one only from that task on. Goals read `lab.panel(id)` (`cells`, `size`, `answer`, `submissions`, `wrong`,
`correct`).

| Panel | |
|---|---|
| `{ kind: "continuity", id, part }` | Every pair of the part's legs in each position, filled in as the meter (continuity mode) probes them |
| `{ kind: "truth-table", id, inputs, output \| outputs, mystery?, name? }` | Logs the outputs for every input combination tried, once steady; clears when the wiring changes. Inputs: a switch by its throws `{ part, label, a, b }`, a button, switch or DIP position by closed `{ part, label, low?, high? }`, or a node by its logic level `{ node, label }`. Outputs: an LED `{ part }` (lit) or a node `{ node }` (high). The row the inputs are on now is marked. `name: "AND"` is written under the table, with `mystery: true` only once every row is filled. Cells: `"0,1"` for the first output, `"0,1#1"` for the second |
| `{ kind: "pin-map", id, part, roles: [{ id, label, legs }], swap?, peek? }` | Name every terminal; counts wrong submissions; `swap` lets two role groups trade (which pole is "A"); `peek` opens the part once right |
| `{ kind: "tags", id, items, options, answer }` | Tag each item with one option |
| `{ kind: "hole-hunt", id, start, cols }` | Tap every hole joined to `start` on a map of the board |
| `{ kind: "symbol", id, answer: { slots, linked } }` | Build a symbol from two slots and an optional link |
| `{ kind: "xray", id, part, pins? }` | The chip x-ray (see Chips). Closed it is a "Look inside" button; open, `lab.view("xray:<part>")` is true and the cells note what the 555 did meanwhile: `trigger`, `threshold`, `reset`, `discharge`, `latch` (set), `high`, `low` |
| `{ kind: "timing", id, channels, window?, quiet? }` | Up to 8 channels `{ label, node, level? }` (watched: exact edges) or `{ label, part }` (an LED lit, a button closed, from the snapshots), as high and low lines over the last `window` seconds (default 2). The latest burst (two or more edges each within `quiet`, default 0.02 s, of the next; `burst: false` leaves a free-running clock out) can be replayed in slow motion over 4 s, with a scrubber and marks on states under 1 µs. `lab.timing(id)` |
| `{ kind: "histogram", id, button, dice, rolls?, hold?, settle?, read? }` | Every roll of `button` (let go, then `settle` s, default 0.3) is read from the pip LEDs (`dice: [["P1", ...]]`, one list per die: the face is the number of pips lit) or `read(lab)`, and tallied as faces, or sums and all 36 pairs for two dice, with a fair band (expected count plus or minus two standard deviations). "Roll for me" presses it with holds of 0.15 to 0.6 s (`hold`); a thousand rolls are sampled from 20 ms of the running dice recorded finely (exact for a clock of a few hundred hertz and up). `lab.rolls(id)` |
| `{ kind: "keys", id, buttons: [{ part, key, label }] }` | Big on-screen keys for pushbuttons, each held while pressed, plus a keyboard key (`"a"`, `"l"`, `" "`) that works all through the lab, so two players can share a keyboard. "Pin down" holds a button for touch screens |

**Nodes** name nodes for goals and scope traces: `nodes: { c: "C1.pos" }` makes `lab.volts("c")` work.

**Overlays** draw over the bench in both views (docs/BENCH-VIEWS.md): `overlays: { flow: "current", push: true,
offer: ["flow", "electrons", "push"] }` sets what is on at the start and which toggles the lab's panel offers.
`flow` rides dots along every lead, jumper and part at a speed from its current (plus to minus), or with `"electrons"`
the other way and far slower; `push` hatches every lead by its voltage above the battery's minus and stands a hill by
each battery and on each sealed box. The loop tracer has no switch: a lesson starts it from a terminal
(`runtime.trace("pin:B1.neg")`, or `{ do: "trace", from: "B1.neg" }`).

**Watch** lists nodes the simulator checks for edges after every solver step (`Netlist.watch`, see
`packages/sim/README.md`): `watch: ["U1.3", { node: "clk", level: 2.5 }]`. Snapshots come 30 times a second; a
watched node's edges in between are counted and timed exactly (a bounce, a ripple, a 1 kHz clock), for
`lab.edges(node)` and exact `lab.widths` and `lab.duty`. A chip pin is watched at half its chip's supply unless a
`level` is given. Timing diagram channels, stopwatch node triggers and the scope's duty trace are watched anyway.

The first drafts of the Unit 1 and 2 labs used simulator kinds and `props` (`kind: "switch"`, `kind: "wire"` with
`at: "B1.pos|S1.a"`, `kind: "multimeter"`). Those still load (see `LegacyPart` in `define.ts`), but write new labs
with the forms above and move old ones over when you finish their goals.

## Chips

Unit 4's chips are bench parts with a `model` ("555", "555-cmos", "74HC08", "74HC393", "4026B" ...) run as the
simulator's `timer555` or `logic` part under the same id. Goals and attach points name their pins by number or by
name: `"U1.6"`, `"U1.thresh"`, `"U1.threshold"` and `lab.pin("U1", 6)` are the same pin; logic pins go by datasheet
name either way round (`"U2.1A"`, `"U2.a1"`, `"DM1.CO"`), and `plus` and `minus` name the supply pins. They work in
`lab.volts`, `lab.connected`, `lab.joins`, `lab.probed`, scope traces and watches, whatever leg names the bench gives
the chip (numbers or datasheet names): the view goes through the netlist's pin table (`chips.ts`, `chipPinRef`).

| Helper | |
|---|---|
| `lab.pin(chip, pin)` | `{ n, name, node, volts, level }` |
| `lab.chipSeat(id)` | `{ seated, straddles, pin1: "left" \| "right", turned, columns, oneSide, shorted, holes }`: straddling the channel with every pin on its own strip; which end the notch (pin 1) is at, `turned` for notch right; `oneSide` and the pin pairs a strip `shorted`. Null off the board |
| `lab.logic(node)` | `H`, `L`, `X` (between 30% and 70%) or `Z` (unpowered): a logic chip's pin as the chip reads it, a 555 pin against its supply, any other node against the supply of a chip on it (else the bench's highest voltage) |
| `lab.view("xray:U1")` | The chip x-ray is open |
| `lab.bench.rejected` | Parts the board refused to seat (a surface-mount lookalike dropped on holes), from the bench's `rejected` list or a refused-part action it reports (a `BenchAction` whose type contains "refus" or "reject", with `partId`) |

**The x-ray** (`{ kind: "xray", part, pins }`) draws a 555 seen from above, notch left, with only the blocks of the
pins in `pins` (the lesson's 555 map so far, section 2.4 of the Unit 4 blueprint): pins 1 and 8 the two rails; 2 the
low watcher and its 1/3 line; 3 the output stage; 2, 3 or 6 the inside switch (named the latch once pin 4 is); 6 the
high watcher and its 2/3 line; 7 the drain switch; 4 the reset line; 5 the ladder of three equal resistors with pin 5
on its 2/3 tap. Live, each named pin shows its volts, a watcher shows "2.10 < 3.13 V" and turns amber while it fires,
the latch dot lights when set, the drain switch closes, the reset line turns amber while it holds the latch off.
Unnamed pins show only a dashed number. A screen reader hears one sentence per block, and the state changes as they
happen. For a gate chip the x-ray shows which gate is which, wired to its pins, high pins amber. The notebook's still
map is `<Chip555Map pins={[1, 8, 2, 3]} />` (`xray.tsx`), stamped "Complete" with all eight pins: a 555's x-ray draws
it, with the lab's `pins`, on the bench lesson's signed-off notebook page (also the module's finale), so the map grows
lesson by lesson.

**Notebook figures.** A panel can write one small ink figure onto the bench lesson's signed-off notebook page
(`apps/web/src/lesson/bench/NotebookFigures.tsx`, `figureOf`, by panel kind). It gets the lab and what the session
recorded (its notes and panel states). Today the 555's x-ray offers the 555 map.

The simulator places a chip's edges exactly, but a switch or button acting on a chip input is seen by the chip at the
end of the solver's first 1 µs step after it, so a slow-motion replay of a button-clocked counter shows about half a
microsecond between the clock edge and the ripple. Chip-driven clocks (a 555) are exact.

## Code (Unit 5)

A microcontroller board (`kind: "mcu-board"`, the simulator's `mcuboard`: packages/bench and packages/sim READMEs)
runs a program in bench C (packages/code). The lab names the board its **code drawer** works on, the program the
drawer starts with and, for use outside a lesson, the blocks its palette offers:

```ts
bench: {
  parts: [{ id: "U1", kind: "mcu-board", at: "desk:-110,-4", locked: true }, ...],
  code: { board: "U1", source: START, palette: ["digitalWrite(7, LOW);", "delay"], text: false },
}
```

| Field | |
|---|---|
| `board` | The board's part id. |
| `source` | The program in the drawer at the start, not yet uploaded (default: the board's `program` param, else an empty `setup` and `loop`). Put a program on the board from the start with the part's `params: { program, upload: 1 }`. |
| `palette` | Blocks offered outside a lesson: a block's name (`pinMode`, `digitalWrite`, `analogWrite`, `delay`, `every`, `if`, `if-else`, `while`, `for`, `Serial.begin`, `Serial.print`, `Serial.println`, `randomSeed`, `count`, `comment`) or steps written in bench C. Declarations at the start of an entry are globals it needs (`unsigned long last = 0;`), added at the top of the program unless already declared; each `every` block gets a clock variable of its own (`last`, `last2` ...). In a bench lesson each beat brings its own `palette` (docs/LESSONS.md); a beat without one offers none. |
| `text` | `false` hides the text view (lessons before the text view, lesson 14). |

The drawer shows the program as ink blocks and, beside them on a wide screen (in their place on a phone), as text
(CodeMirror 6, its own lazy chunk). Both are views of one tree: an edit in either redraws the other. Upload is the
one primary action: a program with a mistake is refused at once, the mistake shown as `line:col` and a sentence (in
the text and on its block); a good one plays a short upload, then the board restarts and runs it. An upload is not a
bench edit: undo leaves the program on the board. Two more tools sit beside the drawer, one at a time in a lesson's
dock: the serial monitor (`tool: serial`, what the board printed since its last upload, with simulated times) and the
`millis()` readout (`tool: millis`, with a jump to nine seconds before day 49's wrap).

Solutions upload with a **code step**: `{ do: "code", part: "U1", source: BLINK }` does what Upload does. A program
with a mistake is refused (the board keeps what it had, `lab.code("U1").errorsSeen` notes the kind), one that
compiles goes up and the board restarts, even when it is the same program again. Raw inputs work as for any part:
`{ do: "set", part: "U1", key: "millis", value: 4294967296 - 9000 }` is the day-49 jump, `key: "reset"` the reset
button, `key: "power"` (`"usb"`, `"jack"`, `"off"`) the cable. A task's `setup` can upload a broken program for a
fix-it round the same way; the drawer then shows it.

| Helper | |
|---|---|
| `lab.board(id)` | `{ power, powered, program, source, error, line, millis, uploads, wraps }`: `program` is `"none"`, `"running"`, `"error"`, `"stopped"` or `"off"`; `source` the program on the board; `error` `"line:col sentence"`; `wraps` how often `millis()` rolled over since the last upload. Null for other parts |
| `lab.uploads(board)` | Uploads since the lab started (Upload, code steps, setups and "Show me" alike) |
| `lab.serial(board)` | `{ lines, times, partial, text }`: the lines printed since the last upload, when each ended (simulated seconds), the line still being printed, and all of it as the monitor shows it |
| `lab.millis(board)` | `millis()` now |
| `lab.code(board)` | The drawer: `{ view: "blocks" \| "text", source, error, errorsSeen, attempts }`; `error` is `{ line, col, kind, message }` from the last refused Upload (null once one goes up), `errorsSeen` the kinds met in this visit (`"case"`, `"semicolon"` ...: packages/code README) |
| `lab.pin("U1", 13)`, `lab.pin("U1", "A0")` | A board pin: `{ n, name: "D13", node, volts, level: "H" \| "L" \| "Z", mode: "INPUT" \| "INPUT_PULLUP" \| "OUTPUT" \| "PWM", mA, dead }` |
| History `pin:U1:13` | The pin as the program reads it, 1 HIGH and 0 LOW: `lab.periods("pin:U1:7", 0.5)`, `lab.stats("pin:U1:2")`. The board's lamps are parts: `lab.isLit("U1:L")`, `lab.blinkPeriod("U1:L")` |
| `lab.view("code:text")`, `lab.view("millis:U1")`, `lab.view("serial:U1")` | The drawer's text is open; the readout or the monitor is on screen |

`content/labs/mcu-demo.ts` is the reference: a board with an LED on pin 7, a first upload, a blink and a bonus that
prints. `apps/web/src/lab/mcu.test.ts` replays code steps (refused and good uploads, pin traces, serial lines, the
day-49 wrap).

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
  setup: BREAK_IT,                      // bench lessons: steps applied as the task's beat begins (see below)
  nudges: [{ when: (lab) => backwards(lab), say: "Dark? Turn the LED around." }],   // bench lessons
}
```

- Required tasks are checked **one at a time, in order**: only the current one runs, on every snapshot (about 30 a
  second). So a later task can assume the earlier ones happened ("mend the loop" just checks `isLit`).
- Bonus tasks are checked **all the time** and never block Continue. The learner can skip them.
- Continue is always available: the tasks guide, they never trap (a browser without WebGL can finish the lesson).
- In a bench lesson (`docs/LESSONS.md`) the lesson's beats name the tasks, and only the current beat's task (and the
  lesson's secret) can complete. `setup` lists solution steps the lesson applies when the task's beat begins, on top
  of the bench at the previous check (parts coming into play, a fix-it round's broken circuit); the solution must
  start the task's own steps with the same steps (spread one const into both). `nudges` are short robot lines for a
  mistake the bench is showing; the first whose `when` holds for a moment is said. The `success` line is what the
  robot says when a beat has no line of its own.
- Each task done is worth `XP.task` (15) when the lesson completes. Task ids are kept even if the lab changes.
- "Show me" appears once every hint has been read and plays the task's part of the solution on the bench.

## What a goal can read (`LabView`)

| Helper | |
|---|---|
| `lab.part(id)` | Simulated state: `i`, `v`, `p`, `temp`, `health`, `glow`, `closed`, `extra` (see packages/sim/README.md) |
| `lab.benchPart(id)`, `lab.prop(id)`, `lab.legs(id)` | The part as placed (kind, params, holes), its params, the leads it has |
| `lab.actual(id, key)` | An instance value from the simulator: `actualOhms`, `actualFarads`, a relay's `pullIn`, a transistor's `bf` |
| `lab.bench`, `lab.bench.detachedLeadEnds` | The BenchState; clip ends lying loose |
| `lab.isLit(id, min = 0.1)`, `lab.closed(id)` | LED glowing and alive; switch (thrown to b), button, relay (COM on NO), fuse closed |
| `lab.fried(kind?)`, `lab.died(id)` | A part (of a kind: `led`, `resistor`, `fuse`, `meter-fuse`, ...) died in this lab |
| `lab.event(type, id?)`, `lab.count(type, id?, seconds?)` | Simulator events since the lab started |
| `lab.volts(node, ref?)`, `lab.amps(id)` | A node's voltage (name, attach point or netlist node); current size |
| `lab.connected(a, b)` | Two attach points are joined by metal |
| `lab.joins(id, a, b, "forward"?)` | A two-lead part sits between `a` and `b` (either way round, or first lead on `a`) |
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
| `lab.history("glow:D1", seconds)` | Recent samples of `glow:`, `i:`, `v:`, `temp:`, `p:` a part, `volts:` a node, `closed:` a button or switch (1 or 0), `count:` a counter (its `count` or `count1`), `logic:` a node (1 high, 0 low) or `extra:U1.<key>` |
| `lab.presses(id, seconds?)`, `lab.values(source, seconds?)` | A button's closed spells `{ start, end }` (the last may still be on); the values a source went through, repeats removed (`lab.values("count:U2")`: `[3, 4, 5, 0]`) |
| `lab.widths(source, level?, seconds?)`, `lab.duty(source, level?, seconds?)` | Lengths of the complete high stretches; `{ high, low, period, duty, cycles }` of the latest whole cycles. Exact from the edge log for a watched `volts:` node, else interpolated between snapshots |
| `lab.edges(node, seconds?)` | `{ rises, falls, times, exact, high }`: a watched node's crossings (`exact: false` when counted from the snapshots, which miss fast edges) |
| `lab.timing(id)`, `lab.rolls(id)`, `lab.capture()` | A timing diagram's latest `burst` (`start`, `end`, each channel's level and edges, `glitches` under 1 µs, `states`: every channel's level after each edge) and its `replays`; a histogram's `list` of rolls, `tally` (`faces`, `pairs`, `sums`), `rolling`, `sampled`; the scope's last single shot |
| `lab.pin`, `lab.chipSeat`, `lab.logic`, `lab.bench.rejected` | Chips (see Chips) |
| `lab.stats(source, seconds?)`, `lab.timeAbove(source, level, seconds?)` | Min, max, mean, span of a source; time spent at or above a level |
| `lab.periods(source, level?, seconds?)` | Seconds between rising crossings (a blinking LED, a ticking node), oldest first |
| `lab.blinkPeriod(id)`, `lab.toneHz(id)`, `lab.toneHistory(seconds?)` | Seconds between an LED's flashes; the speaker's pitch; pitch over time (a siren's glide) |
| `lab.relayClicks(id, seconds?)`, `lab.relayClicked(id)`, `lab.relayPeriods(id)` | Relay contact moves; seconds between pull-ins |
| `lab.panel(id)`, `lab.runs()`, `lab.loggerStart()`, `lab.tapping(id)` | Panels and instruments (see above) |
| `lab.logged(tag)`, `lab.readings(tag?)`, `lab.readingsLog` | Stable meter readings in the notebook (see below) |
| `lab.gate(id)`, `lab.gateUnit(id)`, `lab.gateTicks(id)` | The current through the lead a gate is on (amps, 0 off a lead); its number mode's unit; the dots it has counted. History source `gate:G1` (`lab.stats("gate:G1")`) |
| `lab.lidOpen(id)` | A sealed box's (or the cabinet's) lid is open |
| `lab.view(name)` | A view is on: `"push"`, `"flow"`, `"electrons"`, `"xray"` (the board's), `"xray:XA"` (that AA cut open), `"xray:U1"` (a chip's x-ray panel open), `"trace"`, `"code:text"`, `"millis:U1"`, `"serial:U1"` (see Code) |
| `lab.board`, `lab.uploads`, `lab.serial`, `lab.millis`, `lab.code` | The microcontroller board and its code drawer (see Code) |
| `lab.trace(from)` | The loop tracer from a terminal, worked out on the bench as it is: `{ closed, gap, parts, leads }` (`gap` is what the last clip bites, a loose clip, or an open switch's lead) |
| `lab.tagShown(id)` | What a tag shows now ("10 kΩ" or, tapped, "10,000 Ω"); a sealed box's tag too |
| `lab.drawing(id)` | A schematic card: `{ complete, pieces: [{ id, seated, turn, right }] }`, complete once the torn piece sits in its gap the right way round |
| `lab.charge(id)` | A battery's state of charge, 0..1 |
| `lab.static(id)`, `lab.stuck(id)`, `lab.lifted(paperId)`, `lab.apart(a, b)` | The static toy: charge in marks (negative is minus marks); a balloon stuck to a wall; what lifts the paper bits; two balloons' distance in mm |
| `lab.note(id)`, `lab.control(id)`, `lab.task(id)` | Typed numbers, slider values, other tasks' status |
| `lab.memory`, `lab.shared` | Scratch space kept between checks of the same task; shared by every task of the lab |
| `lab.trigger(name)` | Fire an achievement trigger from a goal |
| `lab.solder` | Soldering, perfboard, wire and wall power (Unit 3): see below |

**`lab.solder`** (`apps/web/src/lab/solder.ts`). Joints read from the live station while they are hot and from what
the bench keeps once they set, so goals also hold in a headless replay.

| Helper | |
|---|---|
| `lab.solder.iron` | `on`, `setC`, `tipC`, `tinned`, `at` (the spot it rests on), `inStand`, `onDesk`, `held`; null without a station |
| `lab.solder.solderKind`, `lab.solder.meltC`, `lab.solder.spool(id)` | The spool in use and its melt (183 leaded, 220 lead-free); a spool's first melt on the tip (`firstMeltTipC`) |
| `lab.solder.joint("PB1.C7")` | `state` (`bare`, `molten`, `set`), `verdict` (`good`, `cold`, `disturbed`, `too-much`, `too-little`, `bridge`, `burnt`), `wetted`, `volume` (1 is a good fillet), `peakC`, `tempC`, `fedAt` (`work` or `tip`), `moved`, `bridgeTo`, `coldTouch` |
| `lab.solder.tug(spot)`, `lab.solder.viewed(spot)` | The last tug's answer (`held`, `loose`, `pulled`); looked at under the magnifier |
| `lab.solder.temp("die:D1")` | °C at `tip`, `die:D1`, `clip:HS1`, `joint:PB1.C7`, `lead:D1.anode@6`, `tube:T1` |
| `lab.solder.board("PB1")` | `flipped`, `flexed`, `tack`, `crossings`, `legs` (`{ part, leg, pad, bentTo }`), `joints` (verdicts by pad), `snipped(ids)`, `matchesPlan("PC1")` |
| `lab.solder.plan("PC1")` | `{ lines, joined }`: which numbered lines are joined by metal now |
| `lab.solder.clip(id)`, `strip(wire, end?)`, `tube(id)`, `adapter(id)` | A clip's lead and distance; a stripped end (`notch`, `mm`, `clean`, `nicked`, every try); a tube's wire, splice, `shrink`, `split`, `grip`; an adapter's jack and label |
| `lab.solder.heatView`, `quickMode`, `spots()` | The learner's switches; every spot the iron can go to |

`soundJoint(lab, spot)` and `padsOf(bench, part)` (same file) check a part's joints one by one. A cooked LED shows in
`lab.part("D1")` (`glow` falls as its die warms; `lab.died("D1")` with cause `overheat`), and a wall adapter is a
`supply` in the simulator (`lab.volts`, the meter and the scope read its ripple or its AC).

Goals must be pure apart from `lab.memory`, `lab.shared` and `lab.trigger`: no timers, no globals. A goal that throws counts as
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

Renaming or moving a task an achievement names breaks it: the achievement's `refs` list every lesson, task and trigger
it uses, and `apps/web/src/progress/achievements.test.ts` fails when one no longer exists or no learner can reach it.
A bonus task in a bench lesson only completes when it is the lesson's secret or fires a trigger. The solution test
also fails when a lab's solution never fires a trigger the lab declares.

## Solutions

Every lab ships a solution: bench actions, as data. `apps/web/src/lab/solutions.test.ts` replays each one with the
real simulator (no browser) and fails if a required task is not done, a checkpoint is late or a step does not apply.
An empty solution is reported as skipped.

| Step | |
|---|---|
| `{ do: "lead", id?, from, to, color? }` | A clip lead from the tray between two attach points (either may be null) |
| `{ do: "clip", lead, end: "a" \| "b", to }` | Move one clip (`to: null` unclips it) |
| `{ do: "place", part, kind, at, params?, holes? }`, `{ do: "move", part, at, holes? }`, `rotate`, `remove` | Parts. For a part on flying leads, `at` lists a hole per lead in order (a lead left out comes out of its hole): `"a22-top+:57-top-:58"`. With `at`, `holes` puts every leg in its hole one by one, as the bench config does: a perfboard's `{ a: "PB1:A8", b: "PB1:A4" }` |
| `{ do: "move", part, holes: { tip: "a22" } }` | Move only the named flying leads (null takes one out), keeping the rest: the logic probe's tip from hole to hole with its supply leads left on the rails. A probe pen always stands at its tip, as a drag puts it |
| `{ do: "wire", from, to }`, `{ do: "unwire", wire }` | Breadboard jumpers |
| `{ do: "probe", red?, black?, mode?, range? }`, `{ do: "plug", probe, socket }`, `{ do: "dial", mode, range? }` | The meter |
| `{ do: "flip", part, to? }`, `{ do: "press", part, seconds? }`, `{ do: "set", part, key, value }` | Switches, buttons, raw inputs |
| `{ do: "param", part, params }`, `{ do: "action", part, action }` | A prop's settings (`{ moisture: "wet" }`, `{ length: 5 }`) and one-shot actions (`"erase"`; a stripper's `"strip"` strips the wire end in its jaws, a wire's `"twist"`), as from its selection bar |
| `{ do: "control", id, value }`, `{ do: "note", id, value }` | Sliders, notebook entries |
| `{ do: "panel", id, value }`, `{ do: "tapper", on }` | Submit a panel answer (a pin map names the legs as wired inside, e.g. `{ coil1: "coil" }`); work the auto-tapper. The chip panels take `"open"` and `"close"` (x-ray), `"replay"` (timing), `{ roll: n }` and `"clear"` (histogram) |
| `{ do: "roll", id, times? }` | Let a histogram's auto-roller roll (the replay waits until it is done) |
| `{ do: "replace", part }`, `{ do: "replaceFuse" }`, `{ do: "wait", seconds }` | |
| `{ do: "view", name, on }`, `{ do: "trace", from }` | Switch an overlay (`"flow"`, `"electrons"`, `"push"`, `"xray"`), a chip's x-ray panel (`"xray:U1"`) or a code tool's view (`"code:text"`, `"millis:U1"`, `"serial:U1"`); run the tracer from a terminal (null clears it) |
| `{ do: "code", part, source }` | Upload a program to a microcontroller board, as the code drawer's Upload does (see Code) |
| `{ do: "rub", part, on, strokes? }` | The static toy: rub a balloon (comb, spoon) back and forth on the scarf. A `move` to a desk spot moves it as a drag would (over the scarf it rubs, at the wall it sticks or falls) |
| `{ do: "check", task }` | By here, this task is done. Also splits the solution for "Show me" |

Start here props change through `param` as their taps do: `{ lid: true }` opens a box, `{ alt: true }` taps a tag open
(`{ tagAlt: true }` on a box's tag), `{ turn: 90 }` turns a torn piece, `{ xray: true }` cuts an AA open, `{ mode:
"number", unit: "mA" }` sets a gate; a gate is clipped on with `{ do: "move", part: "G1", at: "lead:TL3" }`.

Each step lets 0.25 s of simulated time pass. Put a `check` after the steps of each task: "Show me" rewinds to the
bench at the previous check and plays the steps up to this one.

## For the lesson player

The lab runtime (`apps/web/src/lab/runtime.ts`) drives the bench's teaching overlays for a lesson: `runtime.setView(
"push" | "flow" | "electrons" | "xray", on)`, `runtime.trace(anchor | null)` (the tracer inks the path from that
terminal, part by part, in both views, and stops at a gap with a red mark). `runtime.ui` carries `views` (what is on)
for toggles. Taps on a part's named spots use the controller's targets: `part:SD1/R1` (a drawing's symbol for R1),
`part:BOXA/lid`, `part:KB/knob`, `part:KB/tag`, `part:CAB/wheel2`, `part:G1/unit`, `part:L1/text`, besides leads
(`part:R1/a`) and anchors. The pure helpers (`traceLoop`, `flowMap`, `pushMap`, `gateAmps`, `expandPrefix`,
`tagText`, `symbolInk`, `slotTurn`) come from `@ohmland/bench/core` for notebook sketches and checks.

For Unit 4, `runtime.setView("xray:U1", on)` opens a chip's x-ray panel (the panel's own button does the same).
`apps/web/src/lab/xray.tsx` exports `Chip555Map` (the notebook's 555 map for the pins named so far, stamped when all
eight are) and the pure drawings `Chip555Drawing` and `LogicChipDrawing`; `apps/web/src/lab/chips.ts` has what a tap
check needs to name a chip pin (`chipPinRef(anchor, bench, netlist)` gives its number from `U1.trig` or `pin:U1.2`,
`pinCode` its datasheet label), so a wrong tap can show the pin's number, and its name once the lesson has named it.
`runtime.holdButton(part, "pin")` and `runtime.releaseButton(part)` hold a button down from outside the keys panel.

## Trying a lab

- `pnpm --filter @ohmland/web test` replays every solution. Every Unit 1 (basics) lab must have one; the bench
  must build without warnings. A `speed` control raised in a solution fast-forwards the replay like the runtime.
- `replayLab(lab, (line) => console.log(line))` (`apps/web/src/lab/replay.ts`) prints each step with the meter's
  display and the tasks done so far: handy while writing a solution.
- `pnpm dev`, open the lesson, Continue to the lab. The page installs `window.ohmlandLab` (`status()`, `bench()`,
  `part(id)`, `meter()`, `project(anchor)`) for poking at it from the console; the e2e helpers in
  `apps/web/e2e/lab.ts` use it to click and drag like a learner.
- `node apps/web/scripts/lab-shots.mjs` takes the curated lab screenshots.
- `pnpm dev`, open `/dev/code-drawer`: the mcu-demo lab in the bench lesson player with the code drawer, the serial
  monitor and the millis readout docked (a dev-only page, never built). `BASE_URL=http://localhost:4321 node
  apps/web/scripts/code-shots.mjs` screenshots it on desktop and phone.
