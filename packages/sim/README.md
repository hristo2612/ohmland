# @ohmland/sim

The circuit simulator behind Ohmland's labs. Pure TypeScript, no DOM: it runs in a Web Worker in the browser and
in Node for tests. LEDs glow because current flows through a fitted diode model, resistors smoke because a thermal
model says so, capacitors charge along a real curve, and a relay that switches its own coil really buzzes (and,
left buzzing, wears its contacts out).

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
| capacitor | `actualFarads`, `esrOhms`, `leakOhms` | ESR 0.1 to 2 Ω and leak 1 MΩ for polarised parts | |
| pushbutton | `normallyClosed` | false | Connected until pressed. |
| dpdt | pins `com1, a1, b1, com2, a2, b2`, `to` | | Two SPDT contact sets on one actuator: `com1` joins `a1` or `b1`, `com2` joins `a2` or `b2`. |
| relay | `tolerance` | 0.05 | Spread of each relay's actual `pullIn` and `dropOut`, seeded by id. |
| relay | pins `com2, no2, nc2` | | Optional second contact set on the same armature. |
| speaker | `enclosure` | false | Sound: free air loses the bass below about 300 Hz, an enclosure goes down to about 100 Hz. |
| wire | `ohms` | | A real resistance (clip leads about 0.15 Ω, test leads about 0.1 Ω). Without it wires are ideal and merge their nodes. |
| (netlist) | `seed` | | Mixed into every per-part spread (tolerances, fuse ratings, relay thresholds, transistor gain), so a lab can give each learner a different but repeatable bag of parts. |

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

`nodes` lists every node name in the netlist (wired-together names share a voltage) plus `gnd` at 0 V.

## Events

| Type | Raised by | When | `data` |
|---|---|---|---|
| `died` | led, diode, npn, resistor, pot, capacitor, speaker, switches and relays | part fails (open circuit from then on) | amps, watts or volts, ratings; `cause` where there are several: capacitor `reverse` / `overvoltage`, npn and diode `overcurrent` / `overheat`, speaker `overpower`, contacts `worn` |
| `damaged` | led, npn, capacitor, diode, speaker | wear has started (not sent when the part dies within a blink) | as for `died` |
| `smoke` | resistor, pot, npn, speaker | health becomes smoking | watts, temp |
| `blown` | fuse | element melts | amps (peak), rating, seconds |
| `meter-fuse` | multimeter | internal 200 mA fuse melts | amps, rating |
| `shorted` | battery, cell | terminal voltage collapsed under load for 0.1 s (also with a forward diode straight across it) | amps, volts |
| `reversed` | led (more than 5 V backwards), capacitor (polarised, reversed; `cause: "reverse"`), battery (forced backwards), npn (collector and emitter swapped), phototransistor (backwards) | | volts or amps |
| `clicked` | relay | contacts move; merged per snapshot with `data.count` | contact, `to` (`no` / `nc`), count |
| `spark` | switch, pushbutton, spdt, dpdt, relay | opening contacts arc: something inductive drove the gap past about 300 V; merged per snapshot with `data.count` | volts, sparks, wear |
| `warning` | multimeter | no damage yet: the 10 A input has carried more than 1 A for over 10 s (`cause: "a10-heat"`) | amps, seconds, cause |

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
| any | `replace` | `true`: swaps in a fresh part with the same id (clears damage, heat, wear, blown state, charge history) |

## Rebuilds

`load()` builds a new circuit but carries over, for every part whose `id` and kind survive: capacitor voltage,
inductor currents (relay coil, speaker), temperatures, damage and death, contact wear, battery charge and
polarisation, fuse heat and blown state, the meter's fuse and 10 A heat, relay contact position and pending moves.
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
  factors until something changes.
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

## Models and defaults

Ambient is 25 °C. Thermal models are first order (`dT/dt` towards `25 + P x Rth` with time constant `tau`).

### Resistor (`ohms`, `watts` = 0.25, `tolerance` = 0.05, `actualOhms`)

- Actual value: within 0.9 x tolerance of nominal, bell-shaped (standard deviation about 1.5% for a 5% part), fixed
  by id and `Netlist.seed`. `actualOhms` overrides it.
- `Rth` = 62.5 / watts °C/W (250 °C/W for 1/4 W), `tau` = 4 s for 1/4 W (bigger parts are slower).
- Health: hot above 100 °C, smoking above 250 °C (about 3.6 x rating sustained), burns open after sustained
  temperatures above 350 °C (a 15 Ω part across 9 V smokes after about 1 s and burns open after about 4 s).

### Battery (`emf`, `internalOhms`, `mAh` optional) and cell (`emf`, `internalOhms`)

- Norton source with internal resistance. Batteries add two polarisation states that pull the terminal voltage down
  under load: a fast one (up to 2 x `internalOhms`, 0.3 s) that only matters at amps (it fades steeply below about
  1 A), and a slow one (0.35 x `internalOhms`, builds in 5 s, recovers in 20 s). A 9.4 V, 1.7 Ω battery reads about
  9.2 V on 100 Ω; into 0.55 Ω it gives about 3.4 A at first and 1.9 A after 2 s; on 15 Ω (0.55 A) it reads about
  8.3 V at once, sags a further 0.2 V over 20 s and gets nearly all of it back within 30 s of rest. A 9.5 V one into
  a short gives about 5 A for an instant and about 2 A after a few seconds.
- `mAh` (batteries only) drains; open-circuit voltage falls gently with charge then drops near empty, and internal
  resistance rises. A 500 mAh battery runs a 15 mA LED (470 Ω, red) for about 35 hours, slowly dimming, then fades
  out within a few hours. Without `mAh` the battery never drains.
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

### Fuse (`amps`)

I²t melting through a two-node thermal model (element and body). Never opens at its rating (it holds up to about
1.5 x), opens in about 1 to 3 s at 2 x, about 0.1 s at 3 x, about 40 ms at 4 x and a few milliseconds at 10 x.
Each fuse's real rating is spread by up to 10% from its id (and `Netlist.seed`). Cold resistance `0.1 / amps` Ω
(0.1 Ω for 1 A, 0.03 Ω for 3 A). Blown fuses are open.

### Capacitor (`farads`, `volts`, `polarized` = false, `tolerance`, `actualFarads`, `esrOhms`, `leakOhms`)

Trapezoidal companion, with the ESR folded into it (no extra node). Actual value within 0.9 x tolerance (20% for
polarised parts, 10% otherwise). Polarised parts default to an ESR of `0.1 x sqrt(1000 µF / C)` Ω (0.1 to 2 Ω), so
shorting a charged one gives tens of amps, not infinity, and to 1 MΩ of leakage (others: no leakage). Polarised
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

## Known limitations

- Transistors have no junction capacitance, so switching edges are instantaneous jumps rather than resolved
  nanosecond transients. Fine at the time scales of these labs. A snap lands within one small step (about 6 µs) of
  the true fold.
- An astable whose base resistors are less than about 10 x its collector resistors can latch with both transistors
  on at power-up, as real ones sometimes do.
- The relay has no contact bounce. Contacts arc only above about 300 V (no low-voltage arcs on heavy DC loads).
- The reverse gain of a backwards transistor follows the SPICE model (about 0.7): a reversed transistor barely
  lights an LED. Higher values made low-ratio astables latch at power-up.
- Not modelled yet: PNP transistors, the 555 timer and logic chips (later units). Devices are classes with
  `stampLinear`, `stampNonlinear`, `accept` and `beginStep` hooks plus breakpoints, which is what those need.

## Tests

`pnpm --filter @ohmland/sim test` runs the golden circuits in `test/`: divider, LED operating points per colour, LED
burn-out, RC time constant, rebuild continuity, relay buzzer and its slowed version, inductive kickback, transistor
saturation, gain and per-instance spread, a phototransistor, the astable against 0.69 RC, fuse blow times,
overheating, a reversed and an over-voltage electrolytic, speaker and diode damage, tolerances and seeds, clip lead
resistance, LED averaging and flash hold, battery sag and recovery, contacts (NC pushbutton, DPDT, sparks, wear,
relay armature and spread), multimeter readings, mistakes and the 10 A warning, the real-time scheduler, time-lapse,
the worker client, audio, and the siren's speed and behaviour. Golden-circuit resistors use `tolerance: 0`.
