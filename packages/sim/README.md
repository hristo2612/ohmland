# @ohmland/sim

The circuit simulator behind Ohmland's labs. Pure TypeScript, no DOM: it runs in a Web Worker in the browser and
in Node for tests. LEDs glow because current flows through a fitted diode model, resistors smoke because a thermal
model says so, capacitors charge along a real curve, and a relay that switches its own coil really buzzes.

The netlist and snapshot contract lives in [`src/types.ts`](src/types.ts) (see also `docs/ARCHITECTURE.md`).

## Using it

### In the browser (worker)

```ts
import { createSimClient } from "@ohmland/sim/client"; // light: no engine code on the main thread

const sim = await createSimClient(); // spawns src/worker.ts as a module worker (Vite understands the pattern)
sim.load(netlist);
sim.onSnapshot((s) => render(s)); // about 30 per second while running
sim.onAudio((samples, rate) => audioWorkletPort.postMessage(samples)); // only when a speaker exists
sim.run({ speed: 1 }); // real time; 0.1 is slow motion
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
| `run({ speed })` | Advances simulated time with wall time x `speed`, snapshots at about 30 Hz. |
| `pause()` | Stops the scheduler. |
| `step(dt)` | Advances exactly `dt` simulated seconds; returns the snapshot and also sends it to listeners. |
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
| led | anode to cathode | `glow` 0..1, `extra.damage` 0..1, `extra.color` |
| npn | `i` collector current, `v` = Vce | `extra.ib`, `ie`, `vbe`, `vbc`, `beta`, `region` (`off`, `active`, `saturation`, `reverse`, `dead`) |
| phototransistor | collector current, Vce | `extra.light` |
| switch, pushbutton | a to b | `closed` |
| spdt | current into `com`; `v` = com minus the selected throw | `closed: true`, `extra.to` |
| pot | `i` a to wiper, `v` = a minus wiper, `p` total | `extra.position`, `vWiperB`, `iWiperB` |
| fuse | a to b | `closed` (false once blown), `extra.blown`, `extra.rating` |
| capacitor | pos to neg (charging current positive) | `p` is loss in leakage or reverse conduction; `extra.charge`, `energy`, `damage` |
| relay | coil current coilA to coilB, coil voltage | `closed` (true when COM connects to NO), `extra.contact` (`no`/`nc`), `moving`, `clicks` (count), `coilVolts`, `contactAmps` |
| speaker | a to b | |
| multimeter | current into the socket in use (VΩ, mA or 10 A) and its voltage to COM | `display`, `unit`, `extra.mode`, `range`, `auto`, `fuse` (`ok`/`blown`), `beep`, `value` (reading in SI units), `socket` |
| wire | a to b (worked out from KCL, wires are merged away in the solver) | |

`nodes` lists every node name in the netlist (wired-together names share a voltage) plus `gnd` at 0 V.

## Events

| Type | Raised by | When | `data` |
|---|---|---|---|
| `died` | led, diode, npn, resistor, pot, capacitor, speaker | part fails (open circuit from then on) | amps, watts or volts, ratings |
| `damaged` | led, npn, capacitor | wear has started (not sent when the part dies within a blink) | amps, watts or volts |
| `smoke` | resistor, pot, npn, speaker | health becomes smoking | watts, temp |
| `blown` | fuse | element melts | amps (peak), rating, seconds |
| `meter-fuse` | multimeter | internal 200 mA fuse melts | amps, rating |
| `shorted` | battery, cell | terminal voltage collapsed under load for 0.1 s | amps, volts |
| `reversed` | led (more than 5 V backwards), capacitor (polarised, reversed), battery (forced backwards) | | volts or amps |
| `clicked` | relay | contacts move; merged per snapshot with `data.count` | contact, count |

Messages are complete, friendly sentences meant for the learner (they name the cause and the fix). Labs can
use `data` to write their own.

## Inputs (`setInput`)

| Kind | Key | Value |
|---|---|---|
| switch | `closed` | boolean |
| pushbutton | `pressed` | boolean |
| spdt | `to` | `"a"` or `"b"` |
| pot | `position` | 0..1 (also `ohms`) |
| phototransistor | `light` | 0..1 |
| probe-resistance, resistor | `ohms` | number (skin, water: labs vary it live) |
| multimeter | `mode` | `MeterMode` |
| multimeter | `range` | `"auto"` or a range label: `200mV 2V 20V 200V 600V`, `200 2k 20k 200k 2M 20M` (ohms), `200uA 2mA 20mA 200mA`, `10A` |
| multimeter | `replaceFuse` | `true`: fits a new internal mA fuse |
| any | `replace` | `true`: swaps in a fresh part with the same id (clears damage, heat, blown state, charge history) |

## Rebuilds

`load()` builds a new circuit but carries over, for every part whose `id` and kind survive: capacitor voltage,
inductor currents (relay coil, speaker), temperatures, damage and death, battery charge and polarisation, fuse heat
and blown state, the meter's fuse, relay contact position and pending moves. Simulated time continues and the
previous node voltages seed Newton's first guess, so editing a live circuit feels continuous.

Live inputs set with `setInput` also survive, unless the new netlist changes that field compared with the previous
netlist (then the netlist wins). That works whether the bench stores switch positions in the netlist or only sends
inputs.

## Engine

- **Modified nodal analysis** on node voltages only. Wires merge nodes with union-find (their currents are recovered
  from KCL for snapshots). Batteries, cells and the ohmmeter are Norton sources, inductors are Norton companions, so
  there are no branch-current rows. `gnd` is the reference; without it the first battery's negative terminal is.
- **Dense LU with partial pivoting** on a `Float64Array`, allocated once per circuit. Unknowns are numbered by a
  greedy minimum-degree ordering and the elimination skips zeros in the pivot row, so fill-in stays small. Linear
  circuits reuse their factors until something changes.
- **gmin** (1e-12 S) from every node to ground, so floating islands never make the matrix singular.
- **Newton-Raphson** with SPICE style `pnjlim` junction limiting. Fallbacks when it does not converge: smaller steps,
  then gmin stepping (coarse, then fine), then source stepping, and as a last resort the step is accepted with the
  previous solution (time moves on, the worker never freezes).
- **Folds.** Regenerative circuits (astables, latches) run off the end of their solution branch and have to snap to
  the other one. When Newton fails at a step that is already small, the engine treats it as a discontinuity: it
  solves the jump with backward Euler by homotopy, skips the error check for that step and restarts integration.
  One jump per edge.
- **Transient**: trapezoidal integration, backward Euler on the first step after any discontinuity (switch,
  relay contacts, a part dying, a fuse blowing, an input, a jump, a rebuild). Adaptive steps from a local truncation
  error estimate (third divided difference of capacitor voltages and inductor currents), a breakpoint queue (relay
  contact moves land exactly), and a maximum step of 2 ms, or 1/44100 s when a speaker is present. Stiff elements
  far faster than any useful step (the speaker's voice coil inductance) always use backward Euler and are left out of
  the error check.

## Models and defaults

Ambient is 25 °C. Thermal models are first order (`dT/dt` towards `25 + P x Rth` with time constant `tau`).

### Resistor (`ohms`, `watts` = 0.25, `tolerance` = 0)

- `Rth` = 62.5 / watts °C/W (250 °C/W for 1/4 W), `tau` = 4 s for 1/4 W (bigger parts are slower).
- Health: hot above 100 °C, smoking above 250 °C (about 3.6 x rating sustained), burns open after sustained
  temperatures above 350 °C (a 15 Ω part across 9 V smokes after about 1 s and burns open after about 4 s).
- `tolerance` (e.g. 0.05) gives each part a fixed spread seeded by its id.

### Battery (`emf`, `internalOhms`, `mAh` optional) and cell (`emf`, `internalOhms`)

- Norton source with internal resistance. Batteries add two polarisation states that pull the terminal voltage down
  under heavy load: fast (1.5 x `internalOhms`, 0.3 s) and slow (0.6 x `internalOhms`, builds in 5 s, recovers in
  60 s). A 9.5 V, 1.7 Ω battery into a short gives about 5 A for an instant, 2.2 A after 0.5 s and 1.9 A after 4 s;
  into 1.5 Ω of leads and fuse about 1.6 A. After the short the voltage recovers over a minute.
- `mAh` (batteries only) drains; open-circuit voltage falls gently with charge then drops near empty, and internal
  resistance rises. Without `mAh` the battery never drains.
- Heats from internal losses (`Rth` 20 °C/W, `tau` 200 s): hot above 50 °C, smoking above 110 °C. Event `shorted`.
- Cells (fruit cells, emf about 0.9 V, internal about 1 kΩ) have no polarisation or capacity.

### LED (`color`, `maxmA` = 20)

Shockley diode plus series resistance, fitted per colour (Vf at 20 mA): red 2.0 V, orange 2.05 V, yellow 2.1 V,
green 2.2 V, blue 3.1 V, white 3.1 V. Red sits near 1.75 V at 1 mA, 1.85 V at 5 mA and 1.96 V at 15 mA.

- `glow` = log-like perceived brightness of the current averaged over 15 ms (the eye's persistence): about 0.25 at
  0.5 mA, 0.65 at 5 mA, 0.86 at 15 mA, 1 at 30 mA. Dimmer when worn.
- Reverse: blocks until about 5 V, then leaks through a soft 200 kΩ breakdown (no light, event `reversed`).
- Damage starts above 2.5 x `maxmA` (50 mA): rate `((I / 50 mA)^2 - 1) / 3` per second, so about 1 s at 100 mA and a
  few milliseconds at the 1 A a 9 V battery pushes straight through it. Dead LEDs are open circuits.

### Diodes (`model` = 1N4148 or 1N4001)

1N4148: Is 2.52 nA, n 1.752, Rs 0.568 Ω, BV 100 V, rated 200 mA. 1N4001: Is 14.11 nA, n 1.984, Rs 0.034 Ω, BV 75 V,
rated 1 A. Damage above twice the rating or above 200 °C.

### NPN 2N3904

Gummel-Poon lite: Is 6.734 fA, Bf 416.4, Br 0.7371, Ise 6.734 fA with Ne 1.259 (low-current beta roll-off), Ikf
66.78 mA (high-injection roll-off), Vaf 74 V (Early effect), Rc 1 Ω (internal collector node), soft base-emitter
breakdown near 7 V (clips the deep negative base swing in astables, which makes them run 10 to 20% fast, as real
ones do). Effective beta is about 170 at 10 mA; Vce(sat) about 0.1 V at 15 mA with a 10 kΩ base resistor.
Junction temperature model `Rth` 200 °C/W (625 mW at 150 °C), `tau` 3 s. Damage above 200 mA or 150 °C junction;
dead transistors are open.

### Phototransistor (`light` = 0)

Collector current `light x 1.5 mA + 10 nA` (dark), with a soft saturation knee near 0.1 V and an Early slope.

### Switches

`switch` (`closed`), `pushbutton` (`pressed`, default released), `spdt` (`to`): 0.05 Ω on, 1 GΩ off.

### Fuse (`amps`)

I²t melting through a two-node thermal model (element and body). Never opens at its rating (it holds up to about
1.5 x), opens in about 1.4 s at 2 x, about 80 ms at 3 x and a few milliseconds at 10 x. Each fuse's real rating is
spread by up to 8% from its id. Cold resistance `0.12 + 0.1 / amps` Ω (0.22 Ω for 1 A). Blown fuses are open.

### Capacitor (`farads`, `volts`, `polarized` = false, `leakOhms`)

Trapezoidal companion. `leakOhms` defaults to none, or 5 MΩ for polarised parts. Polarised parts conduct when
reversed beyond about 1 V (soft knee, 2 kΩ slope) and wear out (`reversed`, then `damaged`, then `died`); any part
with a `volts` rating wears out above 1.2 x the rating. Brief reverse voltages under 1 V (as in an astable) are fine.
A dead capacitor is open.

### Relay (`coilOhms`, `pullIn`, `dropOut`, `coilHenries` = 0.1, `operateMs` = 5, `releaseMs` = 3)

Coil: `coilOhms` in series with an inductance, with a core-loss resistance (20 x `coilOhms`, 2 to 50 kΩ) across the
inductance that bounds the kickback (about -170 V for a 540 Ω, 9 V relay). The armature follows the coil's
magnetising current: its "coil voltage" is `|I| x coilOhms`, equal to the terminal voltage in steady state. Contacts
move `operateMs` after it rises past `pullIn` and `releaseMs` after it falls below `dropOut`; after each move the
armature needs 2 ms to settle before it can move again. A relay that feeds its own coil through its NC contact buzzes
at about 80 Hz; 1000 µF across the coil slows it to about 1.5 Hz (with `dropOut` at 30% of 9 V).

### Speaker (`ohms`, `henries` = 50 µH, `watts` = 0.5)

Voice coil resistance plus inductance. Overheats like a resistor (smoke, then burns open) when driven hard without a
series resistor.

### Pot (`ohms`, `position`)

Two resistors either side of the wiper, ends floored at max(1 Ω, 0.01% of `ohms`). Thermal model of a 1/4 W part.

### Probe resistance (`ohms`)

A plain resistor without a thermal model (skin, tongue, water). Change it live with `setInput(id, "ohms", value)`.

### Multimeter (`mode`, `range` = `"auto"`)

Sockets are always physically there: VΩ to COM, mA to COM through the shunt and the internal 200 mA fuse
(0.5 Ω), 10 A to COM through 0.01 Ω (unfused).

| Mode | Behaviour |
|---|---|
| `dcv`, `acv` | 10 MΩ input. AC reads the RMS of the AC part. Ranges 200 mV to 600 V (AC from 2 V). |
| `dca-ma` | Shunt per range: 200 µA 1 kΩ, 2 mA 100 Ω, 20 mA 10 Ω, 200 mA 2 Ω (plus the fuse). Auto starts on 200 mA. |
| `dca-10a` | Reads the 10 A socket. |
| `ohm` | A 2.8 V source behind the range resistor (1 kΩ for the 200 Ω range up to 100 MΩ for 20 MΩ), ratiometric reading. A powered circuit gives a wrong reading, as on a real meter. |
| `continuity` | Ohms on the 200 Ω range; `extra.beep` below 50 Ω. |
| `diode` | 3.0 V behind 2.2 kΩ (about 1 mA); shows the forward drop, `OL` above 1.999 V (reversed or open). |
| `off` | Blank display; the mA and 10 A sockets are still connected inside. |

The display updates every 0.1 simulated seconds from the average over that window, as 3.5 digits (1999 counts),
with a minus sign for reversed polarity and `OL` over range. Auto-range keeps the current range while the reading
fits comfortably, otherwise picks the smallest range that fits. Wrong-socket mistakes behave physically: measuring a
battery's voltage with the red lead in the mA socket shorts it through the shunt and blows the fuse (event
`meter-fuse`); the mA range then reads nothing until `setInput(id, "replaceFuse", true)`.

## Audio

When a speaker exists and someone listens with `onAudio`, the speaker voltage is resampled (linear interpolation
between solver points) to 44.1 kHz, high-passed at 20 Hz (a speaker cannot reproduce DC), scaled so 1 V is full
scale and passed through a tanh soft limiter. Chunks of up to 1024 samples are delivered as `Float32Array`s
(transferred from the worker). Samples follow simulated time, so slow motion lowers the pitch. Several speakers are
summed.

## Contract additions

All optional, nothing renamed: resistor `tolerance`; pushbutton `pressed`; capacitor `leakOhms`; relay
`coilHenries`, `operateMs`, `releaseMs`; phototransistor `light`; speaker `henries`, `watts`; input keys
`replaceFuse` and `replace`; type `InputValue`.

## Performance

Node 22 on an Apple M5 Pro, wall time per simulated second:

| Circuit | Unknowns | Time |
|---|---|---|
| LED + resistor on 9 V | 3 | 2 ms |
| relay buzzer | 5 | 7 ms |
| two-transistor LED astable (1 Hz) | 11 | 9 ms |
| audio astable (1.7 kHz) + emitter follower + speaker | 12 | 0.35 s |
| two coupled astables + speaker driver ("siren", 6 transistors) | 23 | 1.4 s |

The siren is the heaviest Unit 2 circuit: it runs at about 0.7 x real time and reports `lag`.

## Known limitations

- Transistors have no junction capacitance, so switching edges are instantaneous jumps rather than resolved
  nanosecond transients. Fine at the time scales of these labs.
- The relay has no contact bounce and no contact wear.
- Two coupled audio-rate oscillators exceed real time (see above).
- Not modelled yet: PNP transistors, the 555 timer and logic chips (later units). Devices are classes with
  `stampLinear`, `stampNonlinear`, `accept` and `beginStep` hooks plus breakpoints, which is what those need.

## Tests

`pnpm --filter @ohmland/sim test` runs the golden circuits in `test/`: divider, LED operating points per colour, LED
burn-out, RC time constant, rebuild continuity, relay buzzer and its slowed version, inductive kickback, transistor
saturation and gain, the astable against 0.69 RC, fuse blow times, overheating, a reversed electrolytic, multimeter
readings and mistakes, the real-time scheduler, the worker client, audio and a performance check.
