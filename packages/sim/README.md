# @ohmland/sim

The circuit simulator behind Ohmland's labs. Pure TypeScript, no DOM: it runs in a Web Worker in the browser and
in Node for tests. LEDs glow because current flows through a fitted diode model, resistors smoke because a thermal
model says so, capacitors charge along a real curve, and a relay that switches its own coil really buzzes (and,
left buzzing, wears its contacts out). For the later units it is mixed-signal: a 555 times from its own comparators
and latch, logic chips switch as events with propagation delays while the analog solver sees what their pins really
do, and an unconnected input reads noise, not 0.

The netlist and snapshot contract lives in [`src/types.ts`](src/types.ts) (see also `docs/ARCHITECTURE.md`).

## Using it

### In the browser (worker)

```ts
import { createSimClient } from "@ohmland/sim/client"; // light: no engine code on the main thread

const sim = await createSimClient(); // spawns src/worker.ts as a module worker (Vite understands the pattern)
sim.load(netlist);
sim.onSnapshot((s) => render(s)); // about 30 per second while running
sim.onAudio((samples, rate) => audioWorkletPort.postMessage(samples)); // only when a speaker exists
sim.run({ speed: 1 }); // real time; 0.1 is slow motion, up to 3600 for time-lapse
sim.setInput("S1", "pressed", true);
sim.pause();
const snap = await sim.step(0.5); // manual stepping
sim.dispose();
```

`createSimClient({ worker })` accepts any `postMessage`/`onmessage` port instead of spawning a worker (tests use a
`MessageChannel` with `attachSimHost(port)` on the other end).

### In-thread (tests, Node, lab solution checks)

```ts
import { createSimulation, simulateFor } from "@ohmland/sim";

const sim = createSimulation(); // same methods; step() and snapshot() return synchronously
sim.load(netlist);
const s = sim.step(1); // advance exactly 1 simulated second

// Run for a while and sample: one snapshot every sampleEvery seconds (events since the previous sample).
const samples = simulateFor(netlist, 2, {
  sampleEvery: 0.05,
  actions: [{ t: 0.5, id: "S1", key: "pressed", value: true }],
});
```

### API

| Method | Notes |
|---|---|
| `load(netlist)` | Full rebuild. Parts whose `id` survives keep their physical state (see "Rebuilds"). |
| `setInput(id, key, value)` | Live input, applied at the current simulated time (a discontinuity). Keys per kind below. |
| `run({ speed })` | Advances simulated time with wall time x `speed`, snapshots at about 30 Hz. `speed` up to 3600. |
| `pause()` | Stops the scheduler. |
| `step(dt, { speed? })` | Advances exactly `dt` simulated seconds; returns the snapshot and also sends it to listeners. In-thread, `speed` lets the solver take the larger steps a time-lapse at that speed would (headless replays). |
| `snapshot()` | Current state plus the events since the previous snapshot. |
| `onSnapshot(cb)`, `onAudio(cb)` | Return an unsubscribe function. |
| `dispose()` | Stops everything. |
| `time`, `running` | Current simulated time; scheduler state. |

`createSimulation({ snapshotHz = 30, budgetMs = 10, maxStep })`. In the client, `step()` and `snapshot()` return
promises; the other methods post a message and return at once.

**Real time and lag.** Each scheduler tick (about every 16 ms) tries to advance `wallDt x speed` within a CPU budget.
If the circuit is too heavy, the simulator runs slower than requested instead of freezing: the unreached time is
dropped and `snapshot.lag` (0..1, smoothed) says how far behind it is (0.5 means half speed). `step()` ignores the
budget and reports `lag: 0`.

**Time-lapse.** `run({ speed })` accepts up to 3600 (an hour per second, for "drain the battery" demos). Above 10 x
real time the largest solver step grows in proportion, which every model tolerates: thermal, battery and fuse states
are integrated exactly or sub-stepped, relay timers are breakpoints and reactive parts stay error-controlled. Event
times stay within a few percent of a real-time run (a 15 Ω resistor on 9 V still smokes at 1.0 s and burns open at
3.7 s at 600 x). Above 4 x the audio stream is muted rather than flooding the player.

## Netlist

Kinds, pins and fields are in `src/types.ts`. Optional extras added for the Unit 1 and 2 labs:

| Kind | Field | Default | Meaning |
|---|---|---|---|
| resistor | `tolerance` | 0.05 | The part's actual value is fixed by its id (and `Netlist.seed`) and lies within 0.9 x tolerance of nominal, usually much closer (bell-shaped spread). 0 gives an exact part. |
| resistor | `actualOhms` | | Forces the actual value (a part that is out of tolerance on purpose); `ohms` stays the nominal value the bands show. |
| capacitor | `tolerance` | 0.2 polarised, 0.1 otherwise | As for resistors. |
| capacitor | `actualFarads`, `esrOhms`, `leakOhms` | ESR 0.1 to 2 Ω for polarised parts; leak 1 MΩ for polarised parts of 100 µF and up, `1 MΩ x 100 µF / C` below (10 MΩ at 10 µF) | |
| pushbutton | `normallyClosed` | false | Connected until pressed. |
| switch, pushbutton, spdt, dpdt | `bounce` | off | `true`: contacts chatter for 1 to 5 ms on every make and break (seeded); a number: the longest chatter in ms. See "Contact bounce". |
| dpdt | pins `com1, a1, b1, com2, a2, b2`, `to` | | Two SPDT contact sets on one actuator: `com1` joins `a1` or `b1`, `com2` joins `a2` or `b2`. |
| relay | `tolerance` | 0.05 | Spread of each relay's actual `pullIn` and `dropOut`, seeded by id. |
| relay | pins `com2, no2, nc2` | | Optional second contact set on the same armature. |
| speaker | `enclosure` | false | Sound: free air loses the bass below about 300 Hz, an enclosure goes down to about 100 Hz. |
| wire | `ohms` | | A real resistance (clip leads about 0.15 Ω, test leads about 0.1 Ω). Without it wires are ideal and merge their nodes. |
| (netlist) | `seed` | | Mixed into every per-part spread (tolerances, fuse ratings, relay thresholds, transistor gain), so a lab can give each learner a different but repeatable bag of parts. |

Kinds added for the later units (Units 3 to 5):

| Kind | Pins | Fields | Notes |
|---|---|---|---|
| `inductor` | `a`, `b` | `henries`, `ohms` = 1 (winding), `watts` = 1 | A coil. See "Inductor". |
| `timer555` | `gnd trig out reset ctrl thresh dis vcc` (pins 1 to 8) | `cmos` = false | NE555; `cmos: true` is a 7555-style part. Pins may be left out. |
| `logic` | by datasheet name (`LOGIC_PINOUTS[model]` lists them in pin-number order) | `model` | `74HC00`, `74HC02`, `74HC04`, `74HC08`, `74HC14`, `74HC27`, `74HC32`, `74HC74`, `74HC86`, `74HC393`, `4026B`. Pins may be left out (an unconnected input floats). |
| `sevenseg` | `a` to `g`, `dp`, `com`, `com2` (`SEVENSEG_PINS` gives the 10-pin order) | `common` (`"cathode"` or `"anode"`), `color` = red, `maxmA` = 25 | Eight LEDs on one common pin; `com2` is joined to `com` inside. |
| `regulator7805` | `in`, `gnd`, `out` (TO-220 order) | `heatsink` = false | 5 V linear regulator. |

Pin names for the logic chips: quad 2-input gates (`00 02 08 32 86`) `a1 b1 y1` to `a4 b4 y4`; hex inverters
(`04 14`) `a1 y1` to `a6 y6`; triple 3-input NOR (`27`) `a1 b1 c1 y1` to `a3 b3 c3 y3`; dual D flip-flop (`74`)
`clr1 d1 clk1 pre1 q1 qn1` and the same with 2; dual 4-bit counter (`393`) `clk1 clr1 qa1 qb1 qc1 qd1` and the same
with 2; all 74HC parts have `vcc` and `gnd`. The 4026B has `clk inh dei deo co a b c d e f g ucs rst vdd vss`. The
74HC02 has its outputs first in each group (pins 1, 4, 10, 13): same names, different holes, so it is not a drop-in
swap for the others. `DIGIT_SEGMENTS` and `digitOf(lit)` decode segment patterns.

## Snapshot

```ts
type Snapshot = { t; nodes: Record<NodeId, volts>; parts: Record<id, PartState>; events: SimEvent[]; lag? };
type PartState = { i; v; p; temp; health: "ok" | "hot" | "smoking" | "dead"; glow?; closed?; display?; unit?; extra? };
```

For two-terminal parts `i` is the current from the first pin to the second through the part and `v` is first pin
minus second pin. Per kind:

| Kind | `i`, `v` | Also |
|---|---|---|
| battery, cell | `i` pos to neg through the part, so **negative while discharging**; `v` terminal voltage | `extra.out` (current delivered from +), `extra.emf` (open-circuit voltage now), `extra.soc`, `extra.internalOhms` |
| resistor | a to b | `extra.actualOhms` (and `ohms`, the same value), `nominalOhms`, `tolerance`, `watts` (rating) |
| led | anode to cathode | `glow` 0..1, `extra.damage` 0..1, `extra.color`, `extra.stress` (current as a share of `maxmA`) |
| diode | anode to cathode | `extra.model`, `damage` |
| npn | `i` collector current, `v` = Vce | `extra.ib`, `ie`, `vbe`, `vbc`, `beta` (Ic / Ib now), `bf` (this part's gain parameter), `region` (`off`, `active`, `saturation`, `reverse`, `dead`) |
| phototransistor | collector current, Vce | `extra.light` |
| switch, pushbutton | a to b | `closed`; `extra.wear` 0..1, `sparks`; pushbuttons also `pressed`, `normallyClosed` |
| spdt, dpdt | current into `com` (`com1`); `v` = com minus the selected throw | `closed` (false once worn out), `extra.to`, `wear`, `sparks`; dpdt also `i2`, `v2` for the second pole |
| pot | `i` a to wiper, `v` = a minus wiper, `p` total | `extra.position`, `vWiperB`, `iWiperB` |
| fuse | a to b | `closed` (false once blown), `extra.blown`, `extra.rating` |
| capacitor | pos to neg (charging current positive) | `p` is loss in leakage, ESR or reverse conduction; `extra.charge`, `energy`, `damage`, `actualFarads`, `nominalFarads`, `tolerance`, `esr` |
| relay | coil current coilA to coilB, coil voltage | `closed` (true when COM connects to NO), `extra.contact` (`no`/`nc`), `moving`, `clicks` (count), `coilVolts`, `contactAmps`, `armature` (0 relaxed to 1 pulled in, moving over the operate or release time), `pullIn`, `dropOut` (this relay's actual thresholds), `wear`, `sparks` |
| speaker | a to b | `extra.damage`, `watts` (rating) |
| multimeter | current into the socket in use (VΩ, mA or 10 A) and its voltage to COM | `display`, `unit`, `health` ("hot" while the 10 A input runs hot), `extra.mode`, `range`, `auto`, `fuse` (`ok`/`blown`), `beep`, `value` (reading in SI units), `socket`, `a10Hot` |
| wire | a to b (ideal wires: worked out from KCL, they are merged away in the solver; wires with `ohms`: a resistor) | |
| switch, pushbutton, spdt, dpdt with `bounce` | as above | `extra.bouncing` (true while contacts chatter) |
| inductor | a to b (winding current), `p` = winding loss | `extra.henries`, `ohms`, `iL` (current in the inductance), `energy` (½ L I²), `damage`, `watts` |
| timer555 | `i` current sourced from pin 3 (negative while sinking), `v` = pin 3 minus ground | `extra.output` (`high`, `low`, `off` when unpowered or dead), `latch`, `trigger`, `threshold` (comparators active), `reset` (reset pin active), `discharge` (pin 7 on), `upper` and `lower` (comparator references, volts above ground), `supply`, `supplyAmps`, `dischargeAmps`, `powered`, `cmos`, `damage` |
| logic | `i` supply current into the vcc (vdd) pin, `v` supply voltage | `extra.model`, `family` (`74HC`, `4000B`), `powered`, `damage`; one entry per logic pin by name: inputs `L` / `H` / `X` (undefined, between 0.3 and 0.7 of the supply) / `Z` (unpowered), outputs `L` / `H` / `Z` (floating) / `~` (oscillation guard); `oscillating`; 74: `state1`, `state2`; 393: `count1`, `count2`; 4026B: `count`, `digit` |
| sevenseg | `i` total segment current, `v` largest segment voltage, `glow` brightest segment | `extra.a` to `extra.g`, `extra.dp`: per-segment glow 0..1; `lit` (segments with glow above 0.3, as `"abcdg"`), `digit` (`"0"` to `"9"`, `"-"`, `" "` for dark, `""` for no digit), `common`, `color`, `dead` (dead segments) |
| regulator7805 | `i` current delivered from `out`, `v` = out minus gnd, `p` heat, `temp` junction | `extra.vin`, `vset` (this part's set point), `caseTemp`, `dropout` (input too low to regulate), `limiting` (current limit), `shutdown` (thermal), `heatsink`, `damage` |

`nodes` lists every node name in the netlist (wired-together names share a voltage) plus `gnd` at 0 V. Pins a part
leaves out appear as `<id>.<pin>~float`.

## Events

| Type | Raised by | When | `data` |
|---|---|---|---|
| `died` | led, diode, npn, resistor, pot, capacitor, speaker, switches and relays, inductor, timer555, logic, sevenseg (one segment), regulator7805 | part fails (open circuit from then on) | amps, watts or volts, ratings; `cause` where there are several: capacitor `reverse` / `overvoltage`, npn and diode `overcurrent` / `overheat`, speaker and inductor `overpower`, contacts `worn`; chips `overvoltage` (supply, or an input driven beyond the rails), `reverse` (supply backwards), `overcurrent` (an output, or the 555's pin 7), `overheat`; regulator `overheat`, `overvoltage`, `reverse`; sevenseg adds `segment` |
| `damaged` | led, npn, capacitor, diode, speaker, timer555, logic, sevenseg, regulator7805 | wear has started (not sent when the part dies within a blink) | as for `died` |
| `smoke` | resistor, pot, npn, speaker, inductor, timer555, logic | health becomes smoking (chips: above 150 °C inside) | watts, temp |
| `blown` | fuse | element melts | amps (peak), rating, seconds |
| `meter-fuse` | multimeter | internal 200 mA fuse melts | amps, rating |
| `shorted` | battery, cell | terminal voltage collapsed under load for 0.1 s (also with a forward diode straight across it) | amps, volts |
| `reversed` | led (more than 5 V backwards; `data.risk` is `"none"` or `"damage"`, see LED), capacitor (polarised, reversed; `cause: "reverse"`), battery (forced backwards), npn (collector and emitter swapped), phototransistor (backwards) | | volts or amps |
| `clicked` | relay | contacts move; merged per snapshot with `data.count` | contact, `to` (`no` / `nc`), count |
| `spark` | switch, pushbutton, spdt, dpdt, relay | opening contacts arc: something inductive drove the gap past about 300 V; merged per snapshot with `data.count` | volts, sparks, wear |
| `warning` | multimeter, timer555, logic, regulator7805 | no damage yet. Meter: the 10 A input has carried more than 1 A for over 10 s (`a10-heat`). 555: running below its minimum supply (`undervoltage`). Logic: an output over its current limit for 20 ms, shorted to a rail or fighting another output (`overload`, with `pin`); supply above the recommended maximum (`overvoltage`); an output fed back on itself oscillating at megahertz (`oscillating`, with `pin`). Regulator: thermal shutdown (`thermal-shutdown`) | amps, volts, seconds, temp, cause |

Messages are complete, friendly sentences meant for the learner (they name the cause and the fix). Labs can
use `data` to write their own.

## Inputs (`setInput`)

| Kind | Key | Value |
|---|---|---|
| switch | `closed` | boolean |
| pushbutton | `pressed` | boolean (`closed` also works and sets the contact itself) |
| spdt, dpdt | `to` | `"a"` or `"b"` (both poles of a dpdt move together) |
| pot | `position` | 0..1 (also `ohms`) |
| phototransistor | `light` | 0..1 |
| probe-resistance, resistor, wire with `ohms` | `ohms` | number (skin, water: labs vary it live; sets the actual value directly) |
| multimeter | `mode` | `MeterMode` |
| multimeter | `range` | `"auto"` or a range label: `200mV 2V 20V 200V 600V`, `200 2k 20k 200k 2M 20M` (ohms), `200uA 2mA 20mA 200mA`, `10A` |
| multimeter | `replaceFuse` | `true`: fits a new internal mA fuse |
| switch, pushbutton, spdt, dpdt | `bounce` | `true`, `false` or the longest chatter in ms (a global "bounce on" toggle sets it on every contact) |
| timer555, logic | `proximity` | 0..1: how close a hand is to the chip. Floating inputs pick up more, mostly mains hum (see "Floating inputs") |
| any | `replace` | `true`: swaps in a fresh part with the same id (clears damage, heat, wear, blown state, charge history) |

## Rebuilds

`load()` builds a new circuit but carries over, for every part whose `id` and kind survive: capacitor voltage,
inductor currents (inductor, relay coil, speaker), temperatures, damage and death, contact wear, battery charge and
polarisation, fuse heat and blown state, the meter's fuse and 10 A heat, relay contact position and pending moves,
the 555's comparators, latch and output, a logic chip's internal state (flip-flops, counts), input levels, output
levels and output changes still on their way, the regulator's temperatures and shutdown. Contact chatter in progress
is not carried over (the contact lands in its final state).
Simulated time continues and the previous node voltages seed Newton's first guess, so editing a live circuit feels
continuous. Per-part spreads depend only on ids (and `Netlist.seed`), so a rebuilt part keeps its actual value.

Live inputs set with `setInput` also survive, unless the new netlist changes that field compared with the previous
netlist (then the netlist wins). That works whether the bench stores switch positions in the netlist or only sends
inputs. Carrying an input over is not a new switching event (no contact wear).

## Engine

- **Modified nodal analysis** on node voltages only. Ideal wires merge nodes with union-find (their currents are
  recovered from KCL for snapshots). Batteries, cells and the ohmmeter are Norton sources, inductors are Norton
  companions, so there are no branch-current rows. `gnd` is the reference; without it the first battery's negative
  terminal is.
- **Sparse LU.** Devices stamp into a dense matrix (simple, and small for these circuits); the factorisation gathers
  the structurally non-zero entries (known from which unknowns each device couples) into compact storage and
  eliminates over a precomputed fill pattern. Unknowns are numbered by a greedy minimum-degree ordering. A dense
  pass with partial pivoting picks the row order once; later factorisations reuse it until a reused pivot becomes
  smaller than 1/1000 of an entry below it, then the order is chosen again (the idea behind KLU's refactor).
  Between Newton iterations only the entries nonlinear devices touch are refilled. Linear circuits reuse their
  factors until something changes. A device couples all of its unknowns unless it declares coupling groups
  (`Binder.group`): a chip couples each pin only with its own supply pins, so a 16-pin counter adds no dense block.
- **gmin** (1e-12 S) from every node to ground, so floating islands never make the matrix singular. Each island
  that shares no part with the reference (a battery lying alone, a second circuit on the same bench) also gets one
  firm tie (1 mS, at a source's minus terminal when it has one): a single tie carries no current, it only fixes the
  island's level, which gmin alone left so loose that long time-lapse runs could stall near a battery's end.
- **Newton-Raphson** with SPICE style `pnjlim` junction limiting and SPICE's default tolerances (1e-3 relative,
  1 µV absolute), starting from a linear extrapolation of the last two solutions on smooth stretches.
- **Folds.** Regenerative circuits (astables, latches) run off the end of their solution branch and have to snap to
  the other one. When Newton fails at a step that is already small, the engine treats it as a jump solved with
  backward Euler, then restarts integration. Jumps are solved cheapest first: from a memory of recent similar jumps
  (an oscillator snaps through the same few folds over and over, and the change the last one made is an excellent
  guess; a result that moves unrelated nodes is rejected), then plain Newton, then pseudo-transient continuation (a
  small capacitance from every node to ground integrated in pseudo time, which follows the path stray capacitance
  makes a real circuit take), and only then gmin and source stepping. Gmin stepping from scratch used to knock a
  slow oscillator coupled to a fast one into a non-physical state; the new order keeps it on its branch.
- **Transient**: trapezoidal integration, backward Euler on the first step after any discontinuity (switch,
  relay contacts, a part dying, a fuse blowing, an input, a jump, a rebuild). Adaptive steps from a local truncation
  error estimate (third divided difference of capacitor voltages and inductor currents), a breakpoint queue (relay
  contact moves land exactly), and a maximum step of 2 ms, or 1/44100 s when a speaker is present (the audio stream
  is interpolated to 44.1 kHz between solver points). Stiff elements far faster than any useful step (the speaker's
  voice coil inductance) always use backward Euler and are left out of the error check.
- **Event location.** Behavioural parts report threshold crossings (`Device.crossing(x0, x1)`: the fraction of the
  step where a comparator or logic input crosses, by linear interpolation). On a smooth stretch the engine shortens
  the step to land just past the first crossing, to within 20 ns or 0.1% of the step that found it, so a 555 or a
  Schmitt input switches at the right moment instead of whenever a 2 ms step happens to end. Crossings that change
  nothing (a 555 trigger comparator letting go while the latch is already set) are not located.
- **Digital edges.** A behavioural output changes after its propagation delay, at a breakpoint, as a soft break
  (`Ctx.markEdge`): the engine first takes a 1 ns backward Euler step, so every input the edge reaches sees it at once
  (a downstream chip registers it within nanoseconds and schedules its own outputs a delay later, which is how ripple
  and glitch states appear), then restarts integration with a backward Euler step of 5% of the step the error control
  preferred before the edge (at most 100 µs; capacitor voltages are continuous across an edge, and the error of that
  one step stays well under 0.1% of the timing). A settle step gets four times the usual Newton budget.
- **Watchdog.** If more than 500 steps in a row are shorter than 10 ns (outside settle steps), the engine skips ahead
  with steps of at least 0.2 µs for 10 µs, taking failed points as they come instead of rescuing them, so no circuit
  can pin simulated time and freeze the bench.

## Models and defaults

Ambient is 25 °C. Thermal models are first order (`dT/dt` towards `25 + P x Rth` with time constant `tau`).

### Resistor (`ohms`, `watts` = 0.25, `tolerance` = 0.05, `actualOhms`)

- Actual value: within 0.9 x tolerance of nominal, bell-shaped (standard deviation about 1.5% for a 5% part), fixed
  by id and `Netlist.seed`. `actualOhms` overrides it.
- `Rth` = 62.5 / watts °C/W (250 °C/W for 1/4 W), `tau` = 4 s for 1/4 W (bigger parts are slower).
- Health: hot above 100 °C, smoking above 250 °C (about 3.6 x rating sustained), burns open after sustained
  temperatures above 350 °C (a 15 Ω part across 9 V smokes after about 1 s and burns open after about 4 s).

### Battery (`emf`, `internalOhms`, `mAh` and `soc` optional) and cell (`emf`, `internalOhms`)

- Norton source with internal resistance. Batteries add two polarisation states that pull the terminal voltage down
  under load: a fast one (up to 2 x `internalOhms`, 0.3 s) that only matters at amps (it fades steeply below about
  1 A), and a slow one (0.35 x `internalOhms`, builds in 5 s, recovers in 20 s). A 9.4 V, 1.7 Ω battery reads about
  9.2 V on 100 Ω; into 0.55 Ω it gives about 3.4 A at first and 1.9 A after 2 s; on 15 Ω (0.55 A) it reads about
  8.3 V at once, sags a further 0.2 V over 20 s and gets nearly all of it back within 30 s of rest. A 9.5 V one into
  a short gives about 5 A for an instant and about 2 A after a few seconds.
- `mAh` (batteries only) drains; open-circuit voltage falls gently with charge then drops near empty, and internal
  resistance rises. A 500 mAh battery runs a 15 mA LED (470 Ω, red) for about 35 hours, slowly dimming, then fades
  out within a few hours. Without `mAh` the battery never drains.
- `soc` (0..1, default 1) is the charge a battery starts at: a lab's tired battery. Only a battery new to the circuit
  takes it; a rebuild keeps the charge a battery with the same id already has, and `replace` fits a full one. At
  0.08 of 500 mAh a red LED on 1 kΩ falls under 2% charge after about 7.5 simulated hours and goes dark after about
  17 (17 s of real time at 3600 x).
- Heats from internal losses (`Rth` 20 °C/W, `tau` 200 s): hot above 50 °C, smoking above 110 °C. Event `shorted`.
- Cells (fruit cells, emf about 0.9 V, internal about 1 kΩ) have no polarisation or capacity.

### LED (`color`, `maxmA` = 20)

Shockley diode plus series resistance, fitted per colour (Vf at 20 mA): red 2.0 V, orange 2.05 V, yellow 2.1 V,
green 2.2 V, blue 3.1 V, white 3.1 V. Red sits near 1.75 V at 1 mA, 1.85 V at 5 mA and 1.96 V at 15 mA.

- `glow` = log-like perceived brightness of the current averaged over 30 ms (the eye's persistence): about 0.25 at
  0.5 mA, 0.65 at 5 mA, 0.86 at 15 mA, 1 at 30 mA. Fast switching looks steady and partly lit (15 mA switched at
  100 Hz reads about 0.7). A brief pulse of 10 mA or more, even well under a millisecond (a coil's kickback through
  an LED), still shows as a blip of 0.25 that fades over about 80 ms, so a 30 Hz bench sees it. Dimmer when worn.
- Reverse: blocks until about 5 V, then leaks through a soft 200 kΩ breakdown (no light, no damage, event `reversed`).
  The event's message depends on the risk a real LED would face if it broke down: the engine works out the
  resistance the rest of the circuit presents across the LED (`Ctx.drivingOhms`, one extra solve with the step's
  factors), and the current it would allow past 5 V. Behind 1 kΩ on 9 V that is a few milliamps: "it takes no harm"
  (`data.risk: "none"`). Straight across a battery it is amps: "it could be damaged" (`data.risk: "damage"`).
- Damage starts above 2.5 x `maxmA` (50 mA): rate `((I / 50 mA)^2 - 1) / 3` per second, so about 1 s at 100 mA and a
  few milliseconds at the 1 A a 9 V battery pushes straight through it. Dead LEDs are open circuits.

### Diodes (`model` = 1N4148 or 1N4001)

1N4148: Is 2.52 nA, n 1.752, Rs 0.568 Ω, BV 100 V, rated 200 mA, surge 2 A, 350 °C/W. 1N4001: Is 14.11 nA, n 1.984,
Rs 0.034 Ω, BV 75 V, rated 1 A, surge 30 A, 100 °C/W (`tau` 2 s). They fail by heat (above 175 °C) or by current
far beyond the surge rating. A 1N4001 straight across a 9 V battery carries about 2 A, gets hot within a couple of
seconds while the battery reports `shorted`, and fails only if left there; a 1N4148 fails at once.

### NPN 2N3904

Gummel-Poon lite: Is 6.734 fA, Bf 416.4, Br 0.7371, Ise 6.734 fA with Ne 1.259 (low-current beta roll-off), Ikf
66.78 mA (high-injection roll-off), Vaf 74 V (Early effect), Rc 1 Ω (internal collector node), soft base-emitter
breakdown near 7 V (clips the deep negative base swing in astables, which makes them run 10 to 20% fast, as real
ones do). Each transistor's base current is scaled by a factor fixed by its id (Bf up, Ise down together), so hFE at
10 mA lies between about 150 and 250 (`extra.bf`); Vbe is about 0.66 V at 1 mA; Vce(sat) about 0.1 V at 15 mA with
a 10 kΩ base resistor. Junction temperature model `Rth` 200 °C/W (625 mW at 150 °C), `tau` 3 s. Damage above
200 mA or 150 °C junction (`cause` `overcurrent` or `overheat`); dead transistors are open. Collector and emitter
swapped: it conducts a trickle (reverse gain 0.74, as in the SPICE model) and raises `reversed`.

### Phototransistor (`light` = 0)

Collector current `light x 2 mA + 100 nA` (dark), saturating near 0.2 V (`tanh(Vce / 0.2 V)`), with an Early slope.
Backwards it passes 1% of that and raises `reversed`.

### Contacts: switch (`closed`), pushbutton (`pressed`, `normallyClosed`), spdt and dpdt (`to`)

0.05 Ω closed, 1 GΩ open. An open gap breaks down (arcs) above about 300 V with a 50 Ω slope: interrupting a coil's
current without a protection diode drives the gap there, the arc clamps the spike and the part raises `spark`.
Contacts wear by 1/6000 x (1 + (I / 1 A)^2) per make or break carrying more than 10 mA (a make counts its surge
over the first millisecond, so switching an empty capacitor in costs more) and by 1/1000 per spark. At wear 1 the
part dies with its contacts stuck open (`died`, cause `worn`).

**Contact bounce** (`bounce`, or `setInput(id, "bounce", value)`). On every make the contact touches, springs back
open and touches again, 3 to 8 times, the closed spells growing and the rebounds shrinking, over 1 to 5 ms (a number
caps the span in ms); a break rebounds 1 to 3 times over less than half that. Each actuation draws its chatter from a
seed made of the part id, `Netlist.seed` and the actuation count, so every press differs but a run repeats exactly.
Wear is booked once per actuation, not per rebound. A changeover switch (spdt, dpdt) leaves its old throw cleanly,
travels for 0.5 to 2 ms, then chatters on the new throw only, so a latch after it debounces it while a counter fed
from a pull-up and a bouncing button counts several times per press.

### Fuse (`amps`)

I²t melting through a two-node thermal model (element and body). Never opens at its rating (it holds up to about
1.5 x), opens in about 1 to 3 s at 2 x, about 0.1 s at 3 x, about 40 ms at 4 x and a few milliseconds at 10 x.
Each fuse's real rating is spread by up to 10% from its id (and `Netlist.seed`). Cold resistance `0.1 / amps` Ω
(0.1 Ω for 1 A, 0.03 Ω for 3 A). Blown fuses are open.

### Capacitor (`farads`, `volts`, `polarized` = false, `tolerance`, `actualFarads`, `esrOhms`, `leakOhms`)

Trapezoidal companion, with the ESR folded into it (no extra node). Actual value within 0.9 x tolerance (20% for
polarised parts, 10% otherwise). Polarised parts default to an ESR of `0.1 x sqrt(1000 µF / C)` Ω (0.1 to 2 Ω), so
shorting a charged one gives tens of amps, not infinity, and to a leakage that grows with capacitance (datasheets give
it as a multiple of C x V): 1 MΩ from 100 µF up, `1 MΩ x 100 µF / C` below (10 MΩ at 10 µF, 100 MΩ at 1 µF, at most
1 GΩ), so a 470 kΩ, 10 µF 555 delay runs about 4% long, as real ones do (others: no leakage). Polarised
parts conduct when reversed beyond about 1 V (soft knee, 2 kΩ slope) and wear out (`reversed`, then `damaged`,
then `died`, all with `cause: "reverse"`); any part with a `volts` rating wears out above 1.2 x the rating
(`cause: "overvoltage"`: a 6.3 V part on 9 V fails in about 2 s). Wear raises the leakage (up to 50 x) and the
reverse conduction, so a meter in series sees the current creep up. Brief reverse voltages under 1 V (as in an
astable) are fine. A dead capacitor is open.

### Relay (`coilOhms`, `pullIn`, `dropOut`, `coilHenries` = 0.1, `operateMs` = 5, `releaseMs` = 3, `tolerance` = 0.05)

Coil: `coilOhms` in series with an inductance, with a core-loss resistance (100 x `coilOhms`, 5 to 200 kΩ) across
the inductance. Unprotected, a 540 Ω, 9 V coil would kick back about 900 V, so whatever contact interrupts it arcs
near 300 V and sparks; a diode across the coil clamps it to under a volt, an LED to about 2 V. The armature follows
the coil's magnetising current: its "coil voltage" is `|I| x coilOhms`, equal to the terminal voltage in steady
state. Each relay's actual thresholds are within `tolerance` of `pullIn` and `dropOut` (seeded by id; reported in
`extra`). Contacts move `operateMs` after it rises past `pullIn` and `releaseMs` after it falls below `dropOut`;
after each move the armature needs 2 ms to settle before it can move again; `extra.armature` moves linearly over
those times. A relay that feeds its own coil through its NC contact buzzes at about 80 Hz (with a protection diode
and two LED loads its contacts wear out after about 18 s of buzzing); 1000 µF across the coil slows it to about
1.5 Hz (with `dropOut` at 30% of 9 V). Its contacts (and an optional second set) arc, spark and wear as above.

### Speaker (`ohms`, `henries` = 50 µH, `watts` = 0.5, `enclosure` = false)

Voice coil resistance plus inductance. The coil's thermal model puts it at its 225 °C limit when it dissipates its
rated `watts`: sustained power above that damages it and then burns it open (`smoke`, `damaged`, `died` with
`cause: "overpower"`); an 8 Ω speaker straight on a 9 V battery dies within seconds, behind 100 Ω it is fine.

### Pot (`ohms`, `position`)

Two resistors either side of the wiper, ends floored at max(1 Ω, 0.01% of `ohms`). Thermal model of a 1/4 W part.

### Probe resistance (`ohms`) and resistive wires (`ohms`)

A plain resistor without a thermal model (skin, tongue, water, clip leads). Change it live with
`setInput(id, "ohms", value)`.

### Multimeter (`mode`, `range` = `"auto"`)

Sockets are always physically there: VΩ to COM, mA to COM through the shunt and the internal 200 mA fuse
(0.5 Ω), 10 A to COM through 0.05 Ω (unfused).

| Mode | Behaviour |
|---|---|
| `dcv`, `acv` | 10 MΩ input. AC reads the RMS of the AC part. Ranges 200 mV to 600 V (AC from 2 V). |
| `dca-ma` | Shunt per range (burden including the fuse): 200 µA 1 kΩ, 2 mA 100 Ω, 20 mA 10 Ω, 200 mA 1 Ω. Auto starts on 200 mA. |
| `dca-10a` | Reads the 10 A socket. Rated for short measurements: more than 1 A for over 10 s makes it run hot (health `hot`, event `warning`), without damage; it cools after 5 s idle. |
| `ohm` | A 2.8 V source behind the range resistor (1 kΩ for the 200 Ω range up to 100 MΩ for 20 MΩ), ratiometric reading. A powered circuit gives a wrong reading, as on a real meter. |
| `continuity` | Ohms on the 200 Ω range; `extra.beep` below 30 Ω. |
| `diode` | 3.0 V behind 2.2 kΩ (about 1 mA); shows the forward drop, `OL` above 1.999 V (reversed or open). |
| `off` | Blank display; the mA and 10 A sockets are still connected inside. |

The display updates every 0.1 simulated seconds from the average over that window, as 3.5 digits (1999 counts),
with a minus sign for reversed polarity and `OL` over range. Auto-range keeps the current range while the reading
fits comfortably, otherwise picks the smallest range that fits. Wrong-socket mistakes behave physically: measuring a
battery's voltage with the red lead in the mA socket shorts it through the shunt and blows the fuse (event
`meter-fuse`); the mA range then reads nothing until `setInput(id, "replaceFuse", true)`.

### Inductor (`henries`, `ohms` = 1, `watts` = 1)

The winding resistance `ohms` in series with the inductance, and 100 kΩ across the inductance (core loss and the
winding's own capacitance) that bounds the kickback when nothing else carries the current: a switch that interrupts a
coil still arcs near 300 V and sparks, as with the relay. Current builds up with time constant L / R and in the end
only resistance limits it. The winding heats with I² R (`Rth` 175 / watts °C/W, `tau` 8 s for 1 W): hot above 100 °C,
smoking above 250 °C, and sustained temperatures above 350 °C burn it open (`died`, `cause: "overpower"`). The relay
and speaker keep their own built-in coils.

### 555 timer (`timer555`, `cmos` = false)

- **Inside.** Three equal resistors from vcc to ground (5 kΩ, or 100 kΩ for CMOS): the top tap is the control pin
  (so pin 5 has a real Thevenin impedance of 3.3 kΩ and an external divider on it sags as on a real chip), the bottom
  tap (an internal node) is the trigger reference, half the control voltage. Threshold comparator: pin 6 above pin 5.
  Trigger comparator: pin 2 below the bottom tap. Reset: pin 4 below 0.7 V above ground. 3 mV of hysteresis each.
  Driving pin 5 to Vc moves the thresholds to Vc and Vc / 2.
- **Latch priorities.** Reset low forces it low over everything; then an active trigger sets it high, so a trigger
  still held low when the capacitor reaches the threshold keeps the output high until it lets go (the stretch by
  holding, and the alarm's flaw); then the threshold resets it. The output and the discharge transistor follow the
  latch after 100 ns. The engine locates comparator crossings, so timing is exact rather than step-quantised.
- **Power up.** Below 3 V (1.5 V CMOS) nothing inside works and pin 3 floats. When the supply comes up the latch starts
  set or clear at random (60% set; seeded by id, `Netlist.seed` and the power-up count), then the comparators have
  their say: a monostable may fire once at switch-on, and 1 µF from reset to ground (with its pull-up) stops it.
  Running between 3 and 4.5 V a bipolar 555 raises `warning` (`undervoltage`).
- **Output, bipolar.** High: a Darlington to vcc, 1.33 V below the supply with no load, 1.5 V at 12 mA (an LED through
  470 Ω), 1.6 V at 50 mA, 1.7 V at 100 mA, current-limited softly near 250 mA; it cannot sink. Low: about 0.1 V at
  14 mA, 0.4 V at 50 mA, 2 V at 140 mA. A 10 kΩ internal load from pin 3 to ground. Pin 3 has diodes to both rails, so
  an inductive load (a speaker through a coupling capacitor) is clamped when the stage switches.
- **Output, CMOS.** MOSFETs to both rails: rail to rail with no load, 0.4 V below the supply at 14 mA; weaker
  sourcing (about 20 mA at 5 V and 40 mA at 9 V, through 50 Ω and 26 Ω) than sinking (100 and 200 mA, 12 and 6 Ω).
- **Discharge (pin 7).** A transistor to ground, 12 Ω (10 Ω CMOS), saturating near 150 mA. With R1 = 1 kΩ about 9 mA
  flows into it and it sits about 0.1 V above ground, which makes the low time about 3% longer than 0.693 R2 C, as on
  a real 555.
- **Supply current.** Bipolar about 0.6 mA per volt plus the divider (6.7 mA at 9 V with no load); CMOS about 15 µA
  per volt (0.14 mA at 9 V). Supply 4.5 to 16 V bipolar, 2 to 15 V CMOS.
- **Damage.** Above 18 V on the supply (`overvoltage`, within a fraction of a second at 20 V); supply backwards (a
  substrate diode conducts: `reverse`); pin 3 over 200 mA (100 mA CMOS) for long (`overcurrent`: a short to ground at
  9 V dies within a second); pin 7 over 50 mA, as when pin 7 is tied straight to + (`overcurrent`, dies on the first
  discharge, within a quarter of a second); junction above 150 °C (`Rth` 120 °C/W, `tau` 5 s; `smoke` there). A dead 555 is open.
- **Measured** (exact parts, 9 V battery): astable 10 kΩ, 47 kΩ, 1 µF: 13.853 Hz against 1.44 / ((R1 + 2 R2) C) =
  13.846 Hz, high time within 0.05% of 0.693 (R1 + R2) C, low time within 0.3% of 0.693 R2 C, duty 0.547 (formula
  0.548); 10 kΩ, 10 kΩ, 47 µF within 0.05%; 4.7 kΩ, 4.7 kΩ, 0.1 µF (1 kHz) within 0.15%. Monostable 100 kΩ, 10 µF:
  1.0979 s against 1.1 R C = 1.1000 s (ln 3 x R C = 1.0986 s exactly). A 1N4148 across R2 (4.7 kΩ, 10 kΩ, 1 µF): duty
  0.35, high 3.78 ms (0.693 R1 C = 3.26 ms; the diode drop lowers the voltage the capacitor charges toward), low
  6.97 ms (6.93 ms). Pin 5 held at 4 V: 19.2 Hz; at 7.5 V: 9.5 Hz (free running 13.85 Hz).

### Logic chips (`logic`, `model`)

Behavioural and event-driven. The analog solver only sees what the pins do; the logic is a state machine stepped by
input level changes.

| Family | Supply | Output | Gate delay | Limits |
|---|---|---|---|---|
| 74HC | works from 1.5 V, made for 2 to 6 V, destroyed above 7 V | about 50 Ω to the rail at 5 V (0.2 V drop at 4 mA), 175 Ω at 2 V | about 9 ns at 5 V, 30 ns at 2 V | 25 mA per output, 20 mA into an input's protection diode |
| 4000B (4026B) | works from 2.5 V, made for 3 to 18 V, destroyed above 20 V | about 1 kΩ at 5 V, 500 Ω at 9 V, 300 Ω at 15 V | about 120 ns at 5 V, 60 ns at 10 V | 15 mA per output, 10 mA into a protection diode |

- **Inputs.** An input switches at half the supply with 1% hysteresis (74HC14: up at 0.56, down at 0.36 of the
  supply). The snapshot classifies it against the datasheet bands: `L` below 0.3, `H` above 0.7 of the supply, `X`
  between. Each input has protection diodes to both supply pins (about 20 Ω in series): driving one beyond the rails
  pushes current into them (damage above the limit), and a high input on an unpowered chip powers it weakly through
  its diode, as on a real board. An input parked mid-rail draws extra supply current (about 2 mA at 5 V for a 74HC
  input right at half the supply, falling off within 0.3 of the supply either side, none below 1 V of supply).
- **Outputs.** A conductance to the vcc pin (high) or the ground pin (low), so an output's current really comes from
  the supply pins and a missing supply leaves it floating (`Z`). Output changes land after the propagation delay
  (scaled with the supply), inertially: a pulse shorter than the delay is swallowed. Each gate of a chip is a little
  different (up to 15%, seeded), so two cross-coupled gates released together resolve one way; the outputs of a
  counter or flip-flop that move on one clock edge share one delay.
- **Floating inputs** (no pull resistor, nothing driving them) read noise, not 0: every input has a very weak link
  (1 GΩ, down to 10 MΩ with `proximity` 1) to a wandering voltage made of slow drift (three tones from about 0.15 to
  6.5 Hz) and 50 Hz mains hum, kept inside the rails. Left alone an input drifts across the threshold now and then
  (an LED on the output flickers at random); a hand nearby (`proximity` near 1) makes it follow the hum (about 100
  flips a second); any real connection (a 10 kΩ pull-down, an output, skin from the pin to a rail through a
  `probe-resistance`) swamps it. The 555's trigger, threshold and reset pins pick up the same way.
- **Oscillation guard.** An output that toggles 40 times within 20 µs (an inverter fed back on itself) is held at
  half the supply (both output transistors half on: a meter reads about half the supply) with `~` in the snapshot and
  one `warning` (`oscillating`), until its inputs have been firm for 50 µs.
- **Power up.** Flip-flops and counters start in a random state (seeded by id, `Netlist.seed` and the power-up
  count); outputs then settle after one delay.
- **Damage.** Supply above the absolute maximum (`overvoltage`: 9 V kills a 74HC chip within about 0.1 s); supply
  backwards (`reverse`); an output over its limit (`overload` warning after 20 ms, then wear: a 74HC output shorted to
  ground at 5 V carries about 100 mA and dies in under 2 s; `overcurrent`); an input's protection diode over its limit (`overvoltage`);
  junction above 150 °C (`Rth` 100 °C/W, `tau` 5 s). A dead chip's outputs float.

| Model | Function | Notes |
|---|---|---|
| 74HC00, 02, 08, 32, 86 | quad 2-input NAND, NOR, AND, OR, XOR | 02 has its outputs first |
| 74HC04, 74HC14 | hex inverter, hex Schmitt inverter | |
| 74HC27 | triple 3-input NOR | |
| 74HC74 | dual D flip-flop | rising-edge clock (D as it was just before the edge), active-low preset and clear acting at once (both low: both outputs high), clock to Q about 1.6 gate delays |
| 74HC393 | dual 4-bit ripple counter | falling-edge clock, level-held active-high clear; the four stages ripple one delay apart (QA at 1.4, QD at 3.5 gate delays), so 0111 becomes 0110, 0100, 0000 and then 1000 within about 30 ns, and a counter cleared from a decoded state shows that state for a few nanoseconds (the glitch) |
| 4026B | decade counter with 7-segment outputs | rising-edge clock, clock inhibit and reset active high, display enable in and out, carry out high for 0 to 4 (it rises as the count rolls from 9 to 0), 6 and 9 drawn with their tails, `ucs` the ungated c segment |

### 7-segment display (`sevenseg`)

Eight LEDs (the colour's fitted model, rated `maxmA` each) between the segment pins and the common pin. Each
segment's glow is the LED glow (eye-averaged over 30 ms), so a counter changing digits briefly shows the old segments
fading (a 3 turning into a 4 reads as a 9 for a few tens of milliseconds) and a counter running at 100 Hz or faster
looks like an 8. One resistor in the common lead makes a 1 brighter than an 8 (the current is shared by fewer
segments). A segment straight across 9 V burns out on its own (`died` with `data.segment`, the message names it).

### 7805 regulator (`regulator7805`, `heatsink` = false)

The output follows the input about 1.95 V below it (2 V at 1 A) until it reaches its set point (5 V, each part within
about 1%, seeded), then holds it within about 50 mV per amp. It only sources current, up to about 2.2 A, less when
more than 7 V is across it (foldback, down to 0.4 A). Its ground pin carries about 4 mA. It turns (Vin - Vout) x I
into heat in a TO-220: junction 5 °C/W above the case, case 60 °C/W to the air (10 °C/W on a heat sink; case time
constant 45 s, 120 s with the sink). At 150 °C inside it switches its output off until it cools to 140 °C (`warning`,
`thermal-shutdown`), so an overloaded regulator cycles and its output sags: 9 V in, 1 A out heats a bare one to
shutdown in about 25 s, while on a heat sink it settles near 85 °C. Left cycling it wears out over about 90 s
in shutdown (`died`, `overheat`; real parts last longer, but a lab should show what running without a heat sink
costs). Above 35 V in (`overvoltage`) or connected backwards (`reverse`) it is destroyed. Output oscillation without
its capacitors is not modelled.

## Audio

When a speaker exists and someone listens with `onAudio`, each speaker's coil voltage goes through its acoustic
high-pass (300 Hz in free air, 100 Hz with `enclosure`), the sum is resampled (linear interpolation between solver
points) to 44.1 kHz, high-passed again at 20 Hz, scaled so 1 V is full scale and passed through a tanh soft limiter.
Chunks of up to 1024 samples are delivered as `Float32Array`s (transferred from the worker) with the sample rate, so
a 48 kHz player resamples them. Samples follow simulated time, so slow motion lowers the pitch; above 4 x real
time the stream is muted.

## Contract additions

All optional, nothing renamed. Fields: resistor `tolerance` (default now 0.05) and `actualOhms`; pushbutton
`pressed` and `normallyClosed`; capacitor `leakOhms`, `esrOhms`, `tolerance`, `actualFarads`; relay `coilHenries`,
`operateMs`, `releaseMs`, `tolerance` and pins `com2`, `no2`, `nc2`; phototransistor `light`; speaker `henries`,
`watts`, `enclosure`; wire `ohms`; `Netlist.seed`. Kind `dpdt`. Event types `spark` and `warning`; `data.cause` on
damage events; `data.to` on `clicked`. Input keys `replaceFuse` and `replace`; type `InputValue`. `run()` speeds up
to 3600.

For the later units, also additive: kinds `inductor`, `timer555`, `logic` (models `74HC00`, `74HC02`, `74HC04`,
`74HC08`, `74HC14`, `74HC27`, `74HC32`, `74HC74`, `74HC86`, `74HC393`, `4026B`), `sevenseg`, `regulator7805`; field
`bounce` on switch, pushbutton, spdt and dpdt (type `Bounce`); input keys `bounce` and `proximity`; types
`Timer555Pin`, `Quad2Pin`, `Hex1Pin`, `Triple3Pin`, `DualDPin`, `Dual393Pin`, `Counter4026Pin`, `SevenSegPin`,
`LogicModel`; exports `LOGIC_PINOUTS`, `TIMER555_PINS`, `SEVENSEG_PINS`, `REGULATOR7805_PINS`, `DIGIT_SEGMENTS`,
`digitOf`, `MAINS_HZ`; new `cause` values (`overload`, `oscillating`, `undervoltage`, `thermal-shutdown`) and
`data.segment`, `data.pin`. One default changed: electrolytics under 100 µF leak less (see "Capacitor"); parts from
100 µF up are unchanged, and every Unit 1 and 2 lab replay still passes.

## Performance

Node 22 on an Apple M5 Pro, wall time per simulated second (plain Node; vitest's module runner adds 50 to 100%):

| Circuit | Unknowns | Before | Now |
|---|---|---|---|
| LED + resistor on 9 V | 3 | 1 ms | 1 ms |
| relay buzzer | 5 | 1 ms | 3 ms |
| two-transistor LED astable (1 Hz) | 11 | 2 ms | 2 ms |
| audio astable (1.7 kHz) + emitter follower + speaker | 12 | 0.20 s | 0.11 s |
| Unit 2 siren: slow astable steering a fast one + speaker driver (5 transistors) | 24 | 0.60 s | 0.25 s |

The siren now runs at about 4 x real time (and its slow oscillator now oscillates properly, see "Folds"). Newton
iterations per simulated second fell from about 345,000 to 205,000 (the jump memory cuts each oscillator snap from
about 40 iterations to about 4; the predictor and SPICE's tolerances save the rest) and each iteration got about a
quarter cheaper (sparse LU with pivot reuse, partial refills). `test/perf.test.ts` guards it (wall time and iteration
count). In time-lapse, 45 hours of a battery-powered LED take well under 0.1 s of CPU.

Later-unit circuits (9 V battery, plain Node, per simulated second):

| Circuit | Unknowns | Steps | Newton iterations | Wall |
|---|---|---|---|---|
| 555 astable + LED, 1 Hz | 8 | 520 | 530 | 0.6 ms |
| 555 astable + LED, 1 kHz | 8 | 15,400 | 52,000 | 26 ms |
| 555 + 100 Ω + 100 µF + speaker, 1 kHz (audio rate steps) | 11 | 55,000 | 113,000 | 75 ms |
| 555 + LED clocking a 4026B into a display, 3 Hz (the counting demo) | 35 | 560 | 650 | 1.8 ms |
| 555 + LED clocking three 4026B into three displays, 10 Hz | 89 | 650 | 1,000 | 6 ms |
| the same at 1 kHz (the reaction timer's clock) | 89 | 17,700 | 65,700 | 0.27 s |
| 74HC04 with all six inputs floating | 13 | 1,000 | 2,250 | 2 ms |

The 1 kHz counter chain runs about 3.7 x faster than real time. Each 555 edge costs a few steps (the step to the
100 ns delay, a 1 ns settle step, the restart); each threshold crossing about three located retries. Two things made
the difference: restarting after an edge at a share of the step the error control wanted (instead of climbing back
from a microsecond) and giving a counter's outputs one shared delay per clock edge (one settle instead of ten).
`test/perf.test.ts` guards the counting demo and the 1 kHz chain (wall time, iteration count, and the count itself).

## Known limitations

- Transistors have no junction capacitance, so switching edges are instantaneous jumps rather than resolved
  nanosecond transients. Fine at the time scales of these labs. A snap lands within one small step (about 6 µs) of
  the true fold.
- An astable whose base resistors are less than about 10 x its collector resistors can latch with both transistors
  on at power-up, as real ones sometimes do.
- The relay has no contact bounce (switches and buttons do, with `bounce`). Contacts arc only above about 300 V (no
  low-voltage arcs on heavy DC loads).
- The reverse gain of a backwards transistor follows the SPICE model (about 0.7): a reversed transistor barely
  lights an LED. Higher values made low-ratio astables latch at power-up.
- Not modelled yet: PNP transistors.
- Chips have no pin or wiring capacitance and wires no inductance, so edges are instantaneous: a missing decoupling
  capacitor does not cause ground bounce or false counts, the bipolar 555's supply spike at each edge is not there,
  and a capacitor on a clock line only slows the edge (a slow edge through a non-Schmitt input switches once at half
  the supply instead of chattering). A 7805 without its capacitors does not oscillate.
- Logic inputs switch at exactly half the supply (with 1% hysteresis); real thresholds vary from part to part inside
  the datasheet bands. Outputs are resistances, not current-limited transistors: a 74HC output into a short gives
  about 100 mA at 5 V where a real one gives 50 to 80 mA. There is no metastability: a flip-flop samples D as it was
  just before the clock edge, whatever the setup time.
- The 555's reset, trigger and threshold inputs draw no bias current (they only pick up noise when floating), and
  timing errors from the engine's error control are about 0.1 to 0.3% at a kilohertz.
- Only the 4026B represents the 4000B family so far; the family's numbers are there for more parts.
- The 7805 wears out after about 90 s of thermal cycling, sooner than a real one, on purpose (see its section).

## Tests

`pnpm --filter @ohmland/sim test` runs the golden circuits in `test/`: divider, LED operating points per colour, LED
burn-out, RC time constant, rebuild continuity, relay buzzer and its slowed version, inductive kickback, transistor
saturation, gain and per-instance spread, a phototransistor, the astable against 0.69 RC, fuse blow times,
overheating, a reversed and an over-voltage electrolytic, speaker and diode damage, tolerances and seeds, clip lead
resistance, LED averaging and flash hold, battery sag and recovery, contacts (NC pushbutton, DPDT, sparks, wear,
relay armature and spread), multimeter readings, mistakes and the 10 A warning, the real-time scheduler, time-lapse,
the worker client, audio, and the siren's speed and behaviour. Golden-circuit resistors use `tolerance: 0`.

For the later units: `timer555.test.ts` (astable frequency, high and low times and duty against the formulas, the
capacitor swinging between a third and two thirds of the supply, supply independence, the steering diode, control
voltage, monostable 1.1 R C and the 470 kΩ electrolytic delay, the random power-up pulse and its reset capacitor, a
held trigger, reset priority, bistable mode, output levels bipolar and CMOS, an LED and a speaker, pin 7 to +, a
shorted output, overvoltage, a floating trigger and touch), `logic.test.ts` (truth tables, pinouts, no supply,
phantom power through an input, floating inputs, touch and hum, mid-rail supply current, propagation delay, the 74
flip-flop, the 393 ripple and mod-6 reset, bounce miscounting against a NOR latch, 4026B counters into displays with
carry, the 4000B supply range, abuse, the oscillation guard and Schmitt thresholds), `display.test.ts`,
`regulator.test.ts`, `inductor.test.ts`, `bounce.test.ts`, and the counter chain in `perf.test.ts`.
