# Units 3 to 5: outline

Status: outline for planning, not yet a full blueprint. Each unit gets a full `unit-N.md` (like `unit-2.md`) before
content authoring starts. All titles and project names here are original Ohmland names. Follow `docs/CONTENT.md`.

Conventions:

- Island pieces come from the current catalog where they fit. Pieces marked **NEW** are proposals for the
  `packages/isle` catalog and need art.
- Landmark ids marked **NEW** are invented here; the others were fixed by the course plan.
- **SIM NEEDS** lists simulator and runtime work. **3D** lists new bench models (procedural, our own designs).
- "Errata to avoid" lists mistakes and loose statements in common teaching material for these topics, with the correct
  facts we teach instead.

---

## Unit 3: Making it permanent (`permanent`)

**Island:** Forge Isle, a board with a glowing workshop district: anvil-shaped pads, solder-bright rivers, a pier of
perfboard planks. **Story glue:** the robot wants a blinker it can wear on its antenna, so breadboard circuits must
become solid, small and tough. **Prerequisite:** Unit 2 (the twin flasher in particular).

**Unit goals:** make reliable solder joints and judge them; understand heat flow and heat sinks; power circuits from a
regulated adapter and judge supply quality; plan, build and debug a point-to-point perfboard circuit.

### Modules

| Module | Id | Landmark | Lessons |
|---|---|---|---|
| M1 Solder joints | `soldering` | `solder-forge` | 1 to 4 |
| M2 Heat and power | `heat-and-power` | `power-station` (NEW) | 5 to 6 |
| M3 Perfboard | `perfboard` | `perfboard-pier` | 7 to 9 |

### Lessons

| # | Id | Title | One-line summary | Lab idea | Island piece |
|---|---|---|---|---|---|
| 1 | `hot-bench` | The Hot Bench | Meet the iron, the stand, rosin-core solder and the habits that keep fingers and lungs happy. | Set up a virtual station: choose iron wattage and tip, pick the right solder from four spools (one is acid-core plumbing solder), park the iron, decide what to do when it rolls off the bench (step back). | `iron-stand` (NEW) |
| 2 | `first-joint` | First Bond | Heat the work, not the solder: make a crossed-wire joint that passes a tug test. | Soldering mini-game on two clamped 22 AWG wires: warm-up, tin the tip, heat the junction, feed solder at the junction, hold still, tug. Carrying solder on the tip yields a dull ball that fails. | `solder-spool` (NEW) |
| 3 | `splice-and-shrink` | Splice and Shrink | Join two wires end to end and insulate the joint with heat-shrink tubing. | Inline splice; the tubing must go on before soldering (forgetting means redoing the joint); heat gun distance controls shrink, overheating splits it. | `wire-spool` |
| 4 | `joint-doctor` | Joint Doctor | Tell a good joint from cold, disturbed, starved, bridged and burnt ones, and fix each. | A gallery of rendered joints to diagnose with a magnifier and thermal view, then a board with five planted faults to repair (reheat, add flux, wick, scrape a bridge). | `meter-kiosk` |
| 5 | `bench-supply` | Unplugged from Batteries | Choose a regulated 9 V DC adapter, confirm its polarity and judge its ripple. | Read adapter labels (spot the AC symbol), find polarity with the meter (a minus sign means swap), compare a good and a poor adapter's ripple on the scope under load, add a smoothing capacitor and see partial improvement. | `fuse` |
| 6 | `cook-an-led` | Heat Travels | Heat flows along leads into parts; a heat sink clip diverts it and saves the part. | Hold a virtual iron on a glowing 3 mm LED's lead: it dims after about 15 s and dies by about 30 s. Repeat with a copper clip on the lead: it survives about 2 minutes. Compare a steel clip and a 5 mm LED. Fried moment by design. | `heatsink` |
| 7 | `perfboard-plan` | Plan on a Grid | Lay out a circuit on 0.1 in perfboard and mirror it in your head when the board flips. | Perfboard editor: place the twin flasher on a tiny grid, then flip the board and route bare leads underneath without crossings; a mirror puzzle checks that every lead lands correctly. | `header-fence` |
| 8 | `pocket-blinker` | Pocket Blinker | Build the twin flasher point-to-point on a fingernail-sized board and make it blink. | Insert parts a few at a time, bend leads, solder (quick mini-game), inspect, power-test, then trim the board with a saw only after the test passes. | `led-lamp` |
| 9 | `perfboard-debug` | Trace the Fault | Find bad joints and bridges on a finished board, methodically. | Seeded faults (cold joint that fails when the board flexes, a bridge, a part one hole off). Black probe on ground, probe each node, flex the board, compare with expected voltages. | `test-lead-arch` |

Landmark captions (draft): `solder-forge`: "Bright metal, steady hands: circuits that stay put." · `power-station`: "Clean,
steady power for everything the island builds next." · `perfboard-pier`: "Planks of perfboard reach out over the
clouds, every joint shining."

### SIM NEEDS (Unit 3)

1. **Soldering mini-game engine** (not the circuit solver): per-joint lumped thermal model (tip temperature with heater
   recovery for 15 W vs 30 W, contact area by tip angle and tinning, heat loss to wire and air), solder that melts only on
   surfaces above its melting point, flux that burns off while solder sits on the tip, wetting and fillet growth,
   movement during freezing. Verdict engine: good, cold, disturbed, starved, excess, bridge, burnt, contaminated.
2. **Thermal network for parts**: heat injected at a lead (iron) flowing through lead segments to the die, with clip
   heat sinks as large thermal masses. The circuit sim needs a way to receive external heat per part (for example
   `setInput(id, "heat", watts)` or an ambient override) so LED brightness falls with temperature and damage accumulates.
3. **Adapter supply kind**: `supply` with EMF, regulation (output resistance), ripple amplitude and frequency (100 or
   120 Hz for full-wave from 50 or 60 Hz mains), current limit and short-circuit behaviour.
4. **Perfboard editor**: 0.1 in grid, flip (mirror) view, bare lead routing under the board, crossing and solder-bridge
   detection as shorts, comparison of the built net graph against a reference netlist with highlighted differences.
5. **Board flex**: intermittent cold-joint model (contact resistance jumps when the board is flexed) for fault tracing.

### 3D (Unit 3)

Soldering iron (15 W pencil and 30 W), stand with sponge and brass-wool cup, solder spool, helping hands with magnifier,
heat-shrink tubing (unshrunk and shrunk states), heat gun, solder sucker and desoldering braid, copper and steel
alligator clips, magnifier loupe, plain perfboard, breadboard-pattern plated board, stripboard, hacksaw and vise, wall
adapter with cord, barrel-jack breadboard adapter, screw terminal strip, small project box. Joint renders for every
verdict (our own models, not traced from photos).

### Accuracy notes and errata to avoid (Unit 3)

- Solder melting points: tin-lead 63/37 at 183 °C (eutectic); 60/40 from 183 to about 190 °C; lead-free SAC305 about 217
  to 220 °C. Typical tip settings about 320 to 350 °C (leaded) and 350 to 380 °C (lead-free).
- Visible soldering smoke is mainly burnt rosin flux, a respiratory irritant, not lead vapour. Teach ventilation and hand
  washing after handling leaded solder.
- Lead-free joints look duller than leaded ones. Do not teach "shiny means good" without that caveat.
- Present a damp sponge and brass wool as tip cleaners; avoid stating that sponges crack tips as fact.
- Real-world power: prefer a ready-made barrel-jack breadboard adapter over cutting adapter cords. If a lesson shows
  wiring adapter leads, the adapter must be unplugged first, and it remains strictly on the low-voltage side.
- Never imply that heat-shrink can be shrunk with the soldering iron.
- Unit conversions: 0.1 in = 2.54 mm; 3/16 in = 4.76 mm.

---

## Unit 4: Chips (`chips`)

**Island:** Silicon Isle, a dense city of black chip blocks with silver pin fences, a billboard of glowing digits, a
castle of logic gates and an arcade. **Story glue:** the robot discovers that a single black block can replace a whole
handful of transistors, and wants to build games for the islanders. **Prerequisites:** Units 2 and 3 (RC timing,
transistor switching, perfboard skills).

**Unit goals:** read chip packages and pinouts; use the 555 as a one-shot, a latch and an oscillator; design a small
system from a sequence of states; drive 7-segment displays from counters; think in highs and lows with logic gates;
build memory from feedback; count in binary and decode counts into patterns.

### Modules

| Module | Id | Landmark | Lessons |
|---|---|---|---|
| M1 The 555 timer | `timer-555` | `timer-factory` | 1 to 5 |
| M2 The alarm | `alarm` | `alarm-lighthouse` (NEW) | 6 to 7 |
| M3 Counters and displays | `counters` | `counter-billboard` | 8 to 10 |
| M4 Logic | `logic` | `logic-castle` | 11 to 15 |
| M5 Binary dice | `dice` | `dice-arcade` | 16 to 18 |

### Lessons

| # | Id | Title | One-line summary | Lab idea | Island piece |
|---|---|---|---|---|---|
| 1 | `meet-the-chips` | Chips, Packages and Pin 1 | Find pin 1, count pins counterclockwise, decode part numbers and seat a chip across the channel. | Chip inspector: rotate DIP-8, 14 and 16 packages and a surface-mount lookalike; tap pin numbers; drop a chip on the board (wrong way round or along a strip triggers an explanation). | `chip-block` (NEW) |
| 2 | `one-shot` | One Press, One Pulse | A 555 in monostable mode turns any button press into a clean pulse of set length, T ≈ 1.1 × R × C. | Build the one-shot with pull-ups, a reset button and a trimmer; hit a 3 s pulse within 5%; hold the trigger to stretch it; take the trimmer to zero with no series resistor and smoke the chip (fried moment). | `capacitor` |
| 3 | `inside-the-555` | X-Ray the 555 | Two comparators at one third and two thirds of the supply, a latch and a discharge switch explain every 555 trick. | X-ray mode with live comparator outputs; convert the one-shot into a latch (bistable) and into an inverting mode with hysteresis; predict the output as an input voltage rises and falls. | `header-fence` |
| 4 | `square-wave-singer` | Square-Wave Singer | Wire the 555 to retrigger itself and make tones; control duty cycle with a steering diode. | Astable 555 driving a speaker through a resistor and a coupling capacitor; tune to 262, 440 and 880 Hz from the formula; reach 25% duty using a 1N4148 across R2. | `speaker` |
| 5 | `two-timer-warble` | Two-Timer Warble | Feed one 555's output into another's control pin for vibrato and siren effects; learn voltage dividers and loading. | Divider sandbox (watch the midpoint sag under load), then a slow 555 modulating a fast one through pin 5 with a depth trimmer and a smoothing capacitor. | `pot` |
| 6 | `door-guard-design` | Door Guard, Draft One | Plan an intruder alarm as a sequence of states, wire magnetic reed sensors in a series loop, and discover why a held trigger breaks the design. | 3D room with door and window sensors; build the naive version and run the scripted "door left open" test: the alarm never sounds. The scope shows the trigger stuck low. | `reed-gate` (NEW) |
| 7 | `door-guard-build` | Door Guard, Fixed | Turn a level into an edge with a coupling capacitor and pull-up, mask it with a diode during the exit delay, latch the alarm, and survive power-up. | Tune coupling C, pull-up and pull-down until the spike dips below one third of the supply in 20 random trials; add the diode mask; chain monostable, monostable, bistable; pass the full test suite (door, window, cut wire, quick power cycle). | `diode` |
| 8 | `seven-segments` | Eight Lights Make a Digit | A 7-segment display is seven LEDs plus a dot; a decade counter with a built-in decoder drives it from a 555 clock. | Segment painter mini-game, then a 555 at 3 Hz clocking a 4026B into a common-cathode display; compare one shared resistor (uneven brightness) with one resistor per segment. | `seven-seg` (NEW) |
| 9 | `carry-the-one` | Carry the One | Chain decade counters through carry-out to count to 999. | Three counters and displays; verify each rollover carries; diagnose a scrambled digit caused by one segment wire a row off. | `jumper-arch` |
| 10 | `reaction-race` | Reaction Race | Three 555s and three counters make a millisecond reaction timer; calibrate its clock. | Start, random wait, go, stop: a playable timer with a best-of-five score; calibrate the 1 kHz clock with a once-per-second carry LED against a reference stopwatch. | `meter-kiosk` |
| 11 | `five-volts-exactly` | Five Volts, Exactly | Regulate 9 V down to 5 V, learn logic levels, and never leave an input floating. | LM7805 sweep (output tracks input until it locks at 5 V; capacitors stop oscillation); classify voltages as low, high or undefined; watch a floating input flicker as a virtual hand approaches. | `regulator` (NEW) |
| 12 | `gatekeepers` | Gatekeepers | AND, OR, NAND, NOR, XOR, XNOR and NOT: truth tables you can hold in your hand. | Two buttons with pull-downs into a 74HC08, then swap in a 74HC32 in the same holes; truth-table detective with mystery chips; notice that the stairway light was an XOR all along. | `logic-chip` (NEW) |
| 13 | `chord-lock` | Chord Lock | Turn a requirement into gates: four buttons must be held and four others must not, then a relay opens the "door". | Pull-ups for forbidden buttons turn a "none of these" check into ANDs; drive a 9 V relay from 5 V logic via a 2N3904 with a flyback diode; an attacker bot counts combinations. | `relay` |
| 14 | `first-buzzer-wins` | First Buzzer Wins | Feedback through an OR gate locks out every player but the first to press. | Local two to four player buzz-in game on keys or touch zones; slow-motion replay of the lockout; find the critical window where near-ties both win. | `pushbutton` |
| 15 | `memory-and-bounce` | Two Gates That Remember | Cross-coupled NOR or NAND gates hold a bit; mechanical contacts bounce, and a latch fixes it for double-throw switches. | Scope shows a button's raw chatter; a counter miscounts presses; an SPDT plus latch counts perfectly; pull the switch out and the latch still remembers; compare debouncers (latch, 555, RC plus Schmitt input). | `switch` |
| 16 | `count-in-binary` | Count in Binary | Watch a 4-bit counter count 0 to 15 in binary on four LEDs, and learn falling edges and level-held reset. | Slow 555 clock into a 74HC393; decode readings to decimal; hold reset; slow-motion ripple through the stages. | `led-lamp` |
| 17 | `roll-a-six` | Stop at Six | Feed a chosen state back to reset to change what a counter counts to. | Drag the reset jumper between outputs (mod 2, 4, 8), then use an AND of two outputs for mod 6; the glitch hunter flags the brief extra state. | `dice-block` (NEW) |
| 18 | `binary-dice` | Two Fair Dice | Decode the count into dice pips, chain two counters for 36 equal outcomes, and test fairness with statistics. | Build the pip decoder from a 3-input NOR and two ORs; cascade the second counter off the first; roll 1,000 times and read the histogram; reproduce a supply-sag bias, then fix it. | `cell-jar` |

Landmark captions (draft): `timer-factory`: "Eight legs, endless timing. The factory never misses a beat." ·
`alarm-lighthouse`: "Its lamp sleeps until a door opens. Then the whole island knows." · `counter-billboard`: "Digits
roll across the billboard, one clock tick at a time." · `logic-castle`: "Every gate in the castle answers only yes or
no." · `dice-arcade`: "Fair rolls guaranteed: thirty-six faces, equal time."

### SIM NEEDS (Unit 4)

1. **`ic` netlist kind**: `{ kind: "ic"; model: string; pins: Record<string, NodeId> }` with numbered pins, plus a
   behavioural model registry. Models needed: `555` (bipolar) and `555-cmos`, `74HC00`, `74HC02`, `74HC04`, `74HC08`,
   `74HC14`, `74HC27`, `74HC32`, `74HC86`, `74HC393`, `4026B`, `LM7805` (a 3-pin regulator, could be its own kind).
2. **555 behavioural model**: internal divider of three 5 kΩ resistors (so pin 5 has a real Thevenin impedance),
   comparators with tiny hysteresis, latch priority reset over trigger over threshold (and the trigger winning while held
   low), discharge switch about 10 Ω, bipolar output high about 1.7 V below the supply, 200 mA limit with heating, a short
   supply spike at bipolar switching edges (for decoupling lessons), damage with pin 7 tied to the supply.
3. **Mixed-signal engine**: event-driven digital logic with propagation delays (74HC about 10 ns, 4000B hundreds of
   ns), analog node voltages classified low, undefined or high per family; floating-input noise driven by a "hand
   proximity" prop; extra supply current and heat for inputs parked mid-rail; output contention detection; 9 V on a
   74HC supply pin destroys it; per-output current limits (about 4 mA design value for 74HC, about 1 mA for 4026B
   segments at 9 V).
4. **Counters**: 4026B (rising edge, clock inhibit active high, reset active high, display enable, carry, segment
   outputs) and 74HC393 (falling edge, ripple delays between stages, level-held reset).
5. **7-segment display** part (common cathode, 10 pins, two COM pins joined), segment brightness from current.
6. **Contact bounce** on every mechanical contact: seeded chatter of 1 to 10 ms, decaying, with a global toggle.
7. **Reed switch** part closed by a magnet prop's distance.
8. **Instruments**: logic probe (high, low, floating, pulsing), logic analyzer or timing diagram with up to 8 channels,
   frequency counter, histogram panel for the dice lab, multi-key input for local multiplayer.

### 3D (Unit 4)

DIP generator for 8, 14 and 16 pins with notch, dimple and printed part number; SOIC lookalike (for "won't fit");
DIP socket; TO-220 regulator with tab; 7-segment display; 1N4148 glass diode; reed switch capsule and the magnet and
switch modules of a door sensor; DIP switch; 3D room with a door and a window for the alarm; arcade cabinet style
enclosure for the dice; a printable dice board (our design).

### Accuracy notes and errata to avoid (Unit 4)

- The 555's **control voltage pin is pin 5**. Some teaching text mistakenly calls it pin 2 in one place; pin 2 is trigger.
- Reset acts directly on the internal latch and output, overriding everything. It does not work "through the threshold
  comparator".
- Driving pin 5 to a voltage Vc sets the upper threshold to Vc and the lower (trigger) threshold to Vc ÷ 2.
- If the trigger is still held low when the threshold is reached, the output stays high (this is the "stretch by
  holding" behaviour). The alarm's original flaw comes from exactly this.
- Use self-consistent timing: 1.1 × 47 kΩ × 10 µF ≈ 0.52 s and 1.1 × 470 kΩ × 10 µF ≈ 5.2 s, not 3 s and 30 s. For an
  alarm, 27 kΩ and 270 kΩ with 100 µF give about 3 s and 30 s. For the chord lock, 1.1 × 100 kΩ × 10 µF ≈ 1.1 s (use
  about 270 kΩ for 3 s). A reaction timer's 470 kΩ × 10 µF delay is about 5.2 s nominal; longer measured times come from
  capacitor tolerance.
- The story that "555" comes from three 5 kΩ resistors is a myth; the number was a marketing choice. The internal
  divider really is three equal resistors (about 5 kΩ in bipolar versions).
- A bipolar 555 runs up to a few hundred kHz, not millions of cycles per second.
- Astable formulas: f ≈ 1.44 ÷ ((R1 + 2 × R2) × C); high time 0.693 × (R1 + R2) × C; low time 0.693 × R2 × C. Duty is
  always above 50% without a steering diode.
- 74HC input thresholds at 5 V: datasheets give about 1.35 to 1.5 V maximum for a low and about 3.15 to 3.5 V minimum for
  a high. Teach "below 1 V is safely low, above 3.5 V is safely high" as a conservative design band, labelled as such.
- A bipolar 555's high output is about 1.5 to 1.7 V below its supply: marginal for 74HC inputs at 5 V. Prefer a CMOS
  555 or a 74HCT input when a 555 feeds logic.
- Don't drive an LED and a logic input from the same 74HC output (the LED drags the voltage down). Some published dice
  and quiz-buzzer designs break this rule; ours buffer or separate them.
- The 74HC02 (NOR) has outputs on pins 1, 4, 10 and 13, unlike the 00, 08, 32 and 86. It is not a drop-in swap.
- 4026B reset and clock inhibit are active high; the 555's trigger and reset are active low.
- Never put a capacitor on a clock line to "clean" it: a slow edge can double count. Decouple supply pins instead.
- Use the 2N3904, not the 2N2222, in examples: some 2N2222 variants have reversed pinouts.
- Internal mislabels seen in some sources (a counter experiment numbered wrongly, a 393 reset called "pin 2 of the
  timer", a 393 labelled as a 74HC32 in figures) must not be copied.

---

## Unit 5: Beyond (`beyond`)

**Island:** Signal Isle, the highest island in the archipelago: a windmill of copper coils, a radio mast with a blinking
tip, and a headquarters building whose windows are rows of pins. **Story glue:** the robot hears faint voices drifting
over the clouds and wants to listen in, then wants to teach the islands to think for themselves. **Prerequisites:**
Units 2 to 4 (relays and kickback, RC and diodes, logic levels, the hardware dice).

**Unit goals:** connect current and magnetism both ways (electromagnets and generators); explain speakers and
self-inductance; understand resonance and amplitude modulation and build a battery-free radio; write, upload and debug
microcontroller programs, planning before coding; rebuild the Unit 4 dice in a dozen lines.

### Modules

| Module | Id | Landmark | Lessons |
|---|---|---|---|
| M1 Magnetism and motion | `magnetism` | `coil-windmill` | 1 to 4 |
| M2 Radio | `radio` | `radio-mast` | 5 to 7 |
| M3 Microcontrollers | `microcontrollers` | `microcontroller-hq` | 8 to 13 |

### Lessons

| # | Id | Title | One-line summary | Lab idea | Island piece |
|---|---|---|---|---|---|
| 1 | `electromagnet` | Wire It, Magnetize It | Current in a coil makes a magnet; turns, current and an iron core make it stronger. | Wind a parametric coil on a bolt (turns slider, core material: steel, stainless, air), touch it to a 9 V battery briefly, lift paperclips; a compass flips with polarity; inductance grows with turns squared. | `wire-spool` |
| 2 | `shake-generator` | Shake to Shine | A magnet moving through a coil makes alternating current; rectify it and store it. | Drag (or shake the phone) to push a magnet through a coil; millivolts become volts with more turns; two LEDs in inverse parallel flash on alternate strokes; a diode and capacitor store the energy; a bridge of four diodes uses both strokes. | `magnet` (NEW) |
| 3 | `speaker-inside` | Inside the Speaker | A speaker is an electromagnet glued to a cone, pushing air into pressure waves; run it backwards and it's a microphone. | Exploded speaker with labelled parts (cone, spider, voice coil, magnet); drive it from a function generator and watch the cone and the wavefronts; wavelength calculator; signal-chain ordering puzzle. | `speaker` |
| 4 | `coil-fights-back` | The Coil Fights Back | A coil opposes changes in current: it delays a turn-on and kicks back at turn-off, the mirror image of a capacitor. | Two LEDs facing opposite ways across a big coil: one flashes on press, the other on release; slow motion at 1/1,000 speed; τ = L ÷ R; compare with a capacitor's fill and fade; recap the relay's protection diode. | `diode` |
| 5 | `resonance` | Ring at One Note | A coil and a capacitor together favour one frequency: f0 = 1 ÷ (2π √(L × C)). | Frequency sweep across a parallel LC tank shows a peak; change L (tap position) or C (variable capacitor) and watch the peak move; tuning-fork analogy built from our own visuals. | `capacitor` |
| 6 | `riding-the-carrier` | Riding the Carrier | AM radio hides sound in the strength of a fast carrier wave; a diode and a slow earphone recover it. | Step-through scope: audio, carrier, modulated wave, after the diode, after the earphone's averaging. Remove the diode and hear silence; swap silicon for germanium and weak signals return. | `header-fence` |
| 7 | `crystal-radio` | Sound from the Air | Build a radio with no battery: antenna, ground, tapped coil, germanium diode and a high-impedance earphone. | Virtual garden scene: string an antenna, choose a ground, move the tap clip and the variable capacitor to find three fictional stations (original or public-domain audio); night mode brings distant stations; a storm prompt tests lightning safety. | `antenna` (NEW) |
| 8 | `meet-the-mcu` | A Computer on a Chip | A microcontroller is a tiny computer with pins; a program decides what each pin does. | Tour an original Uno-style board (USB, power jack, regulator, pins, reset, onboard LED); match pins to jobs; compare compiling and interpreting; power it safely. | `mcu-board` (NEW) |
| 9 | `first-blink` | First Blink | Write, verify and upload a blink program, then change its timing with one number. | Code editor with blocks and text side by side; `setup` and `loop`; upload with a progress bar; make a heartbeat and a Morse letter; fix three syntax errors from friendly line:column messages. | `led-lamp` |
| 10 | `read-a-button` | Buttons and Pull-Ups | Read a button with an internal pull-up and handle bounce in software. | Wire a button to ground on pin 2; pressed reads LOW; count presses on the serial monitor and watch bounce inflate the count; add a 50 ms debounce. | `pushbutton` |
| 11 | `plan-before-code` | Plan Before You Code | Write the plan in plain words first, dry-run it, and catch the bugs before they exist. | Drag pseudocode steps into order for a die; a dry-run stepper reveals missing steps (lights never turned off, a held button refreezing the display). | `test-lead-arch` |
| 12 | `dice-in-code` | Roll in Code | Rebuild the hardware dice with random numbers, comparisons and rollover-safe timing. | Seven LEDs in a die pattern on four pins; face logic with a few comparisons; `millis()`-based ignore window; compare the code with Unit 4's chip version; fast-forward the clock to reveal the rollover bug in naive timing. | `dice-block` (NEW, reuse from Unit 4) |
| 13 | `same-dice-new-language` | Same Dice, New Language | The same program in blocks, a C-like language and Python, line by line. | Synchronised three-pane view; translate two functions into Python; a syntax codex fills in (indentation, case, `=` versus `==`, inclusive and exclusive random ranges). | `lemon-tree` |

Landmark captions (draft): `coil-windmill`: "Turn the blades, spin the magnets, light the island." · `radio-mast`: "No
battery, no plug: just a wire, a coil and voices from far away." · `microcontroller-hq`: "Twenty pins and a program.
The islands can think now."

### SIM NEEDS (Unit 5)

1. **`inductor` kind**: henries, series resistance, optional core (air, iron, ferrite) scaling L; `coupled` inductors or
   a `transformer` kind with a turns ratio for the transformer card.
2. **Moving-magnet induction**: flux through a coil as a function of magnet position (precomputed lookup per coil and
   magnet), EMF = -N × dΦ/dt each step, driven by pointer velocity or DeviceMotion; Lenz drag when the circuit is closed.
3. **Function generator source**: sine, square, triangle; 1 Hz to 20 kHz; amplitude and offset.
4. **Speaker as a transducer**: cone displacement from current, a simple impedance model (DC resistance about 6 to 7 Ω
   for an "8 Ω" speaker), reverse (microphone) mode from an audio input with permission.
5. **Radio without simulating megahertz in real time**: an envelope-domain model. Each fictional station has a carrier
   frequency, strength and an audio stream; the tank's resonance curve (from L, C, antenna capacitance and loading) sets
   each station's received amplitude; a detector model (germanium about 0.2 to 0.3 V, silicon about 0.6 V threshold)
   and a high-impedance earphone load produce the audio. The step-through scope can render a slowed-down carrier for
   teaching.
6. **Diode models**: germanium signal diode; bridge rectifier from four `diode` parts.
7. **Microcontroller emulator**: tier 1, a worker-hosted interpreter for a beginner subset of the Arduino-style C API
   (types, control flow, functions, `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `analogWrite`, `delay`,
   `millis`, `random`, serial print) running on virtual time, with friendly line:column errors. Tier 2 (advanced), real
   AVR emulation with an MIT-licensed ATmega328P emulator and a server-side compiler. Optional MicroPython in
   WebAssembly for lesson 13. Editor: CodeMirror 6 plus Blockly, with blocks and text kept in sync.
8. **Pin electrical model**: per-pin current from the attached circuit, warning above 20 mA, damage above 40 mA, output
   shorted to ground or another output detected, floating inputs read noisy values, internal pull-ups about 20 to 50 kΩ,
   bounce injected on buttons, warning when pins 0 and 1 are wired during upload.

### 3D (Unit 5)

Parametric coil generator (turns, layers, enamel or PVC wire), steel bolt and stainless rod, paperclips, compass,
neodymium cylinder magnet, clear tube spool, exploded speaker with about 12 parts, bottle coil with tap loops and a clip,
variable capacitor with meshing plates, high-impedance earphone and passive piezo disc, garden scene with antenna,
insulators and ground stake, original Uno-style and Nano-style boards (no trademarked names or art), USB cable, serial
monitor panel.

### Accuracy notes and errata to avoid (Unit 5)

- Inductance does not limit steady DC current; only resistance does. A coil of 25 ft of 22 AWG is only about 0.4 Ω, so a
  battery's internal resistance limits the current. Keep contact brief.
- Stainless steel rods make poor cores (common stainless grades are barely magnetic).
- Inductance grows with the square of the number of turns.
- Speed of sound about 343 m/s at 20 °C; wavelength = 343 ÷ f (about 17 m at 20 Hz, about 17 mm at 20 kHz).
- Speakers convert only around 1% of electrical power into sound; an 8 Ω rating is nominal impedance, not DC resistance.
- A parallel LC tank has maximum impedance at resonance, so the wanted station builds up a voltage across it. Avoid
  explanations that only say other frequencies are "diverted to ground" without this.
- AM broadcast band: about 530 to 1,700 kHz in the Americas (up to 1,710 kHz, 10 kHz spacing); 531 to 1,602 kHz with 9 kHz
  spacing in Europe and much of the world.
- Germanium diodes conduct at about 0.2 to 0.3 V, silicon at about 0.6 to 0.7 V.
- On an Uno-style board, pins 0 and 1 are the serial lines shared with USB. Use pins 2 and up for buttons and LEDs.
- Time comparisons must be rollover-safe: `if (millis() - start >= interval)`, not "store now plus interval and compare".
  `millis()` wraps after about 49.7 days; a 16-bit `int` overflows after 32,767 ms.
- `random(1, 7)` returns 1 to 6 in the Arduino-style API (upper bound excluded); Python's `randint(1, 6)` includes both
  ends.
- The board keeps the compiled program in flash, not your source code. Compiled code can be read back with a programmer
  unless protected, so "code can never be read back" is not accurate.
- Board GND is the reference for a microcontroller circuit; text that says to connect to "the timer's ground" in a
  microcontroller project is a leftover error.
- Uno-style board: 14 digital pins, 6 analog inputs (10-bit), PWM on pins 3, 5, 6, 9, 10, 11, 16 MHz clock, 32 KB flash,
  2 KB SRAM; 20 mA per pin recommended, 40 mA absolute maximum.
- Lightning: never use an outdoor antenna when a storm is near; disconnect it and leave the lead outside.
- Neodymium magnets can pinch skin, shatter, erase cards and disturb pacemakers: real-world cards must say so.

---

## Errata from Units 1 and 2 sources (kept here so all units stay consistent)

- Georg Ohm was born in 1789. The symbol I for current comes from the French "intensité du courant".
- James Watt greatly improved the steam engine; he didn't invent it.
- Indicator LEDs are efficient compared with filament bulbs but still turn much of their power into heat.
- When a battery's voltage collapses under a heavy load, Ohm's law still holds: teach internal resistance and sag.
- 2N3904 gain falls at high current (minimum about 30 at 100 mA); the base-emitter junction is rated for only 6 V reverse.
- Emitter followers have no voltage gain, but transistors do amplify voltage in common-emitter circuits.
- A capacitor never passes charge across its insulator; describe coupling as charge leaving the far plate.
- Mains is 110 to 120 V AC in North America and 220 to 240 V AC in much of the world. Mains is never part of a lab.

---

## Cross-unit build order for the simulator and bench

1. Unit 2 needs (see `unit-2.md` section 9) come first: relay dynamics, arcs and wear, capacitor damage, 2N3904 and
   phototransistor models, speaker audio, scope and logger.
2. Unit 3 adds the thermal and soldering engine (separate from the circuit solver), a `supply` kind and the perfboard
   editor.
3. Unit 4 adds the `ic` kind with behavioural models and the mixed-signal event engine; contact bounce becomes global.
4. Unit 5 adds inductors, induction from moving magnets, the envelope-domain radio model and the microcontroller
   emulator with its editor.
