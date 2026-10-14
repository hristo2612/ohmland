# Unit 5, Beyond: blueprint

Status: build sheet for Unit 5 (`beyond`) in the bench-first lesson format of `docs/curriculum/start-here.md` (section 1)
and the rules of `docs/curriculum/conversion-guide.md` (Part A), under `docs/DESIGN-PRINCIPLES.md`. It replaces the
Unit 5 outline in `docs/curriculum/later-units.md` and keeps its errata. Content authors turn each lesson into a lab
file (`content/labs/<id>.ts`) plus a thin `lesson.yaml`. Text in double quotes is final learner-facing copy. Anything
marked **NEW** goes beyond today's contracts (`docs/ARCHITECTURE.md`, `docs/LABS.md`, `apps/web/src/lab/define.ts`,
`packages/sim/src/types.ts`) and is collected in section 8.

All content is original. Facts come from standard physics, datasheets and the research notes; no wording, titles,
figures, schematics or code listings are taken from any book. Follow `docs/CONTENT.md`: no em dashes, no emoji, units
with a space, conventional current, no trademarks in names ("an Uno-style board", "a microcontroller board").

---

## 1. How a Unit 5 lesson works

Exactly as in `start-here.md` section 1: a lesson is a short run of **beats** (a robot line of at most 12 words, one
action, then what the bench answers), with a mission title, 2 to 4 objectives that fill the robot's eyes, one optional
secret, one relaxed fix-it round, at most one pop-up card and a notebook page that fills itself. Beat 1 is always a
bench action. Every new part or word gets the three-period lesson. Main path under 150 words; on demand under 60.

The shipped format is `docs/LESSONS.md` (`lesson.yaml` beats plus the lab file). This blueprint maps onto it as
follows: the case title is `start.title` and beat 1's robot line is `start.say` (beat 1 then shows only its action, so
the line is not counted twice); "This is X" plus "Show me X" is a `meet` beat or a note followed by a `tap` check;
"What is this?" is a `pick` with `on`; a prediction is a `guess` on the `do` beat it precedes; the secret is `secret`,
the fix-it is `fixit` (its broken bench is the fix-it task's `setup`, applied on top of the bench at the previous
check), the sign-off is `end.say`; each objective starts with `objective` on its first beat. The `do` tasks and fix-it
tasks listed under **Objectives** are the lab's required tasks, in order.

Two additions for this unit:

- **Hands on the physics.** Magnets are dragged (or the phone is shaken, NEW P3), coils are wound with a turns
  slider, knobs tune. The learner never types a formula. Where a number helps (a frequency, a delay in ms) it is read
  off the bench or typed into the code, never calculated.
- **Code beats.** In Modules 3 and 4 the bench gains a code drawer (NEW R12). A code beat's one action is one edit:
  drag one block in, change one number, or fix one word, then **Upload**. The board answers at once on the bench (an
  LED, the serial monitor, the die). Goals read the bench, not the code text, so any program that makes the bench do
  the right thing passes. The palette shows only the blocks the current beat needs (progressive disclosure).

**Voice.** The cheeky-but-kind sidekick, one playful line in four, never cheeky about a mistake. Notes are lower-case
field notes. Rules are at most 8 words.

---

## 2. Unit overview

- **Unit id:** `beyond` · **Shown name:** Beyond · **Placed after** `chips`.
- **Island:** Signal Isle, the highest island: a windmill of copper coils, a radio mast with a blinking tip, a
  headquarters whose windows are rows of pins, and (new) an LED sundial on the summit.
- **Story glue:** the robot hears faint voices drifting over the clouds. Module 1 builds the power (coils and
  magnets turn the windmill), Module 2 builds the radio that catches the voices, Modules 3 and 4 teach the islands to
  think and keep time. The unit ends with the robot rolling a die it programmed itself.
- **Prerequisites:** Unit 2 (the relay coil, the kickback and the diode clamp, capacitors, the scope, the speaker),
  Unit 4 (logic levels, pull-ups, contact bounce, the hardware dice). Start here's words (push, flow, squeeze, loop)
  are used throughout.
- **Lessons:** 18, 6 to 9 minutes each, about 123 minutes.
- **Order of ideas:** flow makes magnetism, then motion makes flow (and it alternates, and a diode makes it one-way),
  then the speaker joins the two. A coil fights change; with a capacitor it rings at one note; that note can carry a
  song; a diode and an earphone pull the song out; an antenna and the earth bring it from the air. Then a chip that
  runs a program: pins out, a loop with waits, the same program as text, pins in. Last, time: bounce, clocks instead
  of waits, and a die.

### 2.1 Modules and landmarks

| Module | Id | Lessons | Landmark id | Landmark name | Reveal caption | Robot line |
|---|---|---|---|---|---|---|
| M1 Magnets and motion | `magnetism` | 1 to 6 | `coil-windmill` | The Coil Windmill | "Blades turn, magnets spin through copper, and the island lights up." | "Flow makes magnets. Magnets make flow." |
| M2 Coils and radio | `radio` | 7 to 11 | `radio-mast` | The Radio Mast | "No battery, no plug: a long wire, a coil, and voices from far away." | "I heard them! The voices were real." |
| M3 A computer on a chip | `microcontrollers` | 12 to 15 | `microcontroller-hq` | Microcontroller HQ | "Rows of pins light up like windows. The island runs its own programs." | "Twenty pins and a program. I can think!" |
| M4 Code that keeps time | `keeping-time` | 16 to 18 | `led-sundial` (NEW) | The LED Sundial | "Seven lamps chase round a dial, never a millisecond late." | "Fair dice, on time, every time." |

`coil-windmill`, `radio-mast` and `microcontroller-hq` are already in the isle catalog
(`packages/isle/src/catalog.ts`). `led-sundial` is new (I1). Module 3 of the outline is split in two because seven
lessons under one landmark is too long a wait; if the new landmark slips, Module 4 folds back into Module 3.

### 2.2 Lesson list

| # | Lesson id | Case title | Min | One big idea | New part or word | Island piece | Parts unlocked |
|---|---|---|---|---|---|---|---|
| 1 | `electromagnet` | The paperclip crane | 6 | Flow in a coil makes a magnet; no flow, no magnet | coil (part); electromagnet | `wire-spool` | `coil` |
| 2 | `iron-core` | The feeble crane | 6 | An iron core makes an electromagnet far stronger | core | `coil-bolt` (NEW) | none |
| 3 | `shake-generator` | Shake to shine | 7 | A moving magnet in a coil makes a push; a still one makes none | magnet (part); generator | `magnet` (NEW) | `magnet` |
| 4 | `back-and-forth` | Two lamps take turns | 6 | In and out makes the push flip: alternating current | AC, DC | `led-lamp` | none |
| 5 | `one-way-street` | Keep the shakes | 7 | A diode lets one half through, so AC can fill a capacitor | rectifier | `diode` | `diode-1n4148` |
| 6 | `speaker-inside` | The hidden coil | 7 | A speaker is an electromagnet on a paper cone | signal generator (tool) | `speaker` | `signal-generator` |
| 7 | `coil-fights-back` | The late lamp | 7 | A coil fights every change in its flow | inductor (part) | `relay` | `inductor` |
| 8 | `resonance` | The tank's own note | 7 | A coil and a capacitor ring at one frequency | tuning capacitor (part); resonance | `capacitor` | `tuning-capacitor` |
| 9 | `riding-the-carrier` | The hidden song | 6 | AM hides a song in the height of a fast wave | carrier | `ceramic-cap` | none |
| 10 | `diode-detector` | Half a wave | 6 | A diode and a slow earphone pull the song back out | earphone (part) | `jumper-arch` | `earphone`, `diode-germanium` |
| 11 | `crystal-radio` | Voices from the air | 9 | An antenna catches every station; the tank picks one | antenna (part), ground | `antenna` (NEW) | `antenna` |
| 12 | `meet-the-mcu` | The board that listens | 6 | A program decides what each pin does | microcontroller board (part); program | `mcu-board` (NEW) | `mcu-board` |
| 13 | `first-blink` | The stuck lamp | 6 | The loop repeats forever; delay holds each step | loop (code), delay | `led-lamp` | none |
| 14 | `blocks-to-text` | Same blink, in words | 6 | Every block is a line of text, spelled exactly | text view (tool) | `header-fence` | none |
| 15 | `read-a-button` | Who pressed? | 7 | An input pin with a pull-up reads LOW when pressed | input; pull-up | `pushbutton` | none |
| 16 | `count-the-presses` | Five presses, twelve counts | 7 | Wait out the bounce before trusting a press | serial monitor (tool) | `meter-kiosk` | `serial-monitor` |
| 17 | `no-waiting` | Blink and listen | 8 | Check the clock instead of waiting | millis (the board's clock) | `pot` | none |
| 18 | `dice-in-code` | Roll in code | 9 | random(1, 7) rolls 1 to 6; comparisons light the pips | random | `dice-block` (NEW, shared with Unit 4) | none |

Totals: 123 minutes. Every id is checked unique against Start here, Units 1 to 4 and the existing labs. The outline's
`plan-before-code` and `same-dice-new-language` are dropped from the unit: the plan-first idea lives in lesson 18's
build order, and the three-language viewer becomes an optional free-build page (section 9).

### 2.3 Standard parts (unless a lesson says otherwise)

| Name | Bench part | Netlist | Notes |
|---|---|---|---|
| Bench battery `B1` | `battery` 9 V | `battery` emf 9.4, internalOhms 1.7, mAh 500 | As in Start here. |
| Crane coil `L1` | `coil` (NEW) 100 turns of enamelled 0.6 mm copper wound 40 mm long on a 10 mm rod, about 0.3 Ω | NEW `inductor` with `turns`, `core`, `ohms` | Core per lesson. |
| Generator `G1` | `generator` (NEW): clear tube, coil of 2,000 turns (20 Ω), neodymium magnet `MG1` sliding inside | NEW `inductor` plus an induced source (S3) | Magnet leaves the coil fully at both ends of the tube. |
| Red lamp `D1` | `led` red, maxmA 50 | `led` | The generator's brief pulses peak near 50 mA; maxmA 50 keeps them safe, as in Start here. |
| Signal generator `SG1` | `siggen` instrument (NEW N1): sine, square, DC, AM; 1 Hz to 3 MHz; 50 Ω output | NEW `source` kind | Introduced in lesson 6. |
| Radio coil `L8` | `coil` on a 75 mm bottle, 65 turns, a tap loop every 5 turns, clip `TAP` | `inductor`, L from the tap (Wheeler) | About 180 µH full, about 64 µH at 30 turns. |
| Tuning capacitor `C8` | `tuning-cap` (NEW): meshing plates, knob | `capacitor` 30 to 365 pF from the knob | |
| Board `U1` | `mcu-board` (NEW): an original Uno-style board, USB powered | NEW `mcu` kind (S9) | 5 V logic; onboard lamp "L" on pin 13. |
| Board lamps | `led` red with 470 Ω to GND | | About 6 mA from a 5 V pin. |

### 2.4 How each lesson is written below

A "Fix-it bench" below is the fix-it task's `setup` (solution steps that break the bench, including a code step that
loads a faulty program, R15). Same order as Start here: **Case**, **Bench**, **Beats** (copy in quotes; "Do" is the one action; "Bench answers" is
the note, rule or check), **Objectives** (task ids and goals as `LabView` code), **Checks**, **Fix-it bench**,
**Notebook page**, **Robot lines**, **On demand**, **Words**. Goals marked NEW use LabView helpers from section 8.4.

---

## 3. The code editor: recommendation

### 3.1 Options weighed

| | A. Real chip: avr8js with precompiled sketches | B. Ink blocks plus a small C-like subset on virtual time |
|---|---|---|
| What the learner edits | Numbers only (delays, pins), stored in EEPROM before reset | Real structure: blocks, lines, conditions, functions |
| Lessons it can carry | 12 and 13; not 15 to 18 (adding an `if`, a debounce wait, a clock check, face logic) | All of 12 to 18 |
| Feedback | Real ATmega328P timing | Instant upload; a friendly line:column message for each error |
| The day-49 clock jump (lesson 17) | About 7 × 10^13 cycles, or poking the core's private counter in RAM | One offset on the virtual clock |
| Tests | Needs the hex built in CI with a GPL and LGPL toolchain | Solutions replay in Node like every other lab |
| Weight | About 14 KB gzipped core plus a hex per lesson | Parser and interpreter about 20 KB gzipped (estimate); text editor lazy-loaded |
| Fidelity risk | None | The subset could drift from the real language |

### 3.2 Recommendation: B, with A as the referee

1. **Blocks first, text beside them, one program.** The single source of truth is an abstract syntax tree (AST).
   Blocks are one view of it, text is another; edit either and the other redraws. When the text does not parse, the
   blocks grey out on the last good version and the text shows one error at a time, as "line:column" plus a plain
   sentence ("4:18 Each step ends with a semicolon."). Text appears in lesson 14; before that the drawer shows blocks
   only.
2. **Our own ink blocks, not a block library.** About twenty block kinds drawn in the notebook's ink style, each one
   a node of the AST, so the sync is exact. The palette per beat is a lab field (`palette: [...]`), so a beat offers
   one block, not a toolbox. A third-party block library fights the locked visual style and pulls in far more than
   twenty blocks; keep it as the fallback if ours slips.
3. **The language: "bench C".** A strict subset of the C-like language Uno-style boards use, with the same function
   names, so everything the learner writes runs unchanged on a real board:
   - types `int` (16-bit, wraps at 32,767), `long` (32-bit), `unsigned long`, `bool`; `const`;
   - `if`/`else` (with or without braces), `while`, `for`, `++`, `--`, `+=`, `-=`, arithmetic, `%`, comparisons, `&&`, `||`, `!`;
   - `void` functions with no parameters, and functions that return an `int` (lesson 18);
   - `pinMode`, `digitalWrite`, `digitalRead`, `delay`, `millis`, `random(min, max)`, `randomSeed`, `Serial.begin`,
     `Serial.print`, `Serial.println`; `HIGH`, `LOW`, `INPUT`, `OUTPUT`, `INPUT_PULLUP`, `LED_BUILTIN` (13).
   - Anything else is a friendly error ("Arrays are not on this bench yet.") rather than a silent difference.
4. **Virtual time, inside the simulator worker.** The interpreter runs in lockstep with the circuit solver. Each
   simple statement costs 1 µs of simulated time and each pin call 4 µs, so a `loop()` with no `delay` spins at
   tens of kilohertz, fast enough to see contact bounce and slow enough to stay cheap. `delay(ms)` parks the
   program until a breakpoint; every `digitalWrite` is a breakpoint for the solver; `digitalRead` reads the pin's
   node voltage at that instant. `millis()` is simulated milliseconds as a 32-bit unsigned count plus a lab-settable
   offset (the day-49 jump). Pause, slow motion and time-lapse work as for every other lab.
5. **Upload is a ritual, not a wait.** Parse and check take a few milliseconds; a 0.6 s progress bar plays; the board
   resets and `setup()` runs. The board keeps the uploaded program across a power cycle (flash), as a real one does.
6. **avr8js as the referee, in CI only.** Every lesson's solution program and every fix-it program is also compiled
   with the real toolchain in CI and run on avr8js (MIT) against the same bench traces (blink periods, pin levels,
   serial lines). A mismatch fails the build. This keeps bench C honest without shipping a compiler. Later, the
   free-build bench may offer avr8js as an opt-in "real chip" mode.

**Why this fits the principles.** One edit per beat, an answer on the bench within a second of Upload, a palette that
offers one thing, errors that name the line and the fix in plain words, and no reading before doing.

---

## 4. Module 1: Magnets and motion (`magnetism`)

Landmark `coil-windmill`. Summary for `module.yaml`: "A paperclip crane, a shake-powered lamp, two lamps that take
turns, a bank of stored shakes and a speaker with a secret."

---

### B1. `electromagnet`: The paperclip crane

- **Minutes** 6 · **Island piece** `wire-spool` · **Unlocks** `coil`.
- **Big idea:** Flow in a coil makes a magnet. Stop the flow and the magnet is gone.
- **New:** the coil (part); "electromagnet" (word, the coil while flow runs).
- **Case:** "The paperclip crane". Robot intro (beat 1): "My crane won't lift a thing. Press its button."

**Bench.** A toy crane (NEW P6: an arm the learner can swing over a dish) whose hook is the crane coil L1 (2.3) wound
on a steel bolt (core not named until B2). B1 on the desk. S1 a `pushbutton` on a base (momentary, so contact stays
brief). Leads: TL1 B1.pos to S1.a1, TL2 S1.b1 to L1.a, TL3 L1.b to B1.neg. A dish of 12 paperclips under the hook.
Compass CP1 beside the bolt's tip. Iron-dust shaker for the field view (NEW V8). Tray (secret): a straight wire SW1
on the same bolt. Fix-it bench: crane two, TL2's clip biting the enamel `coat:L1.a` (NEW P2 from Start here).

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My crane won't lift a thing. Press its button." | Press and hold S1 over the dish. | Clips leap to the bolt. Note on L1: "electromagnet: a magnet made by flow" |
| 2 | "Let go." | Release S1. | The clips drop. Note: "no flow, no magnet". Rule: "Flow in a coil makes a magnet." |
| 3 | "This is a coil: wire wound in turns." then "Show me the coil." | Tap L1 (period 2). | A wrong tap shows that part's name. |
| 4 | "Shake iron dust round it. Press again." | Tap the shaker, press S1. | Dust draws loops from tip to tip. Note: "strongest at the ends" |
| 5 | Predict: "Swap the battery clips. The paperclips will..." chips "still jump", "push away", "stay put" | Swap TL1 and TL3 on the snaps, press S1. | Clips still jump; CP1's needle swings round. Note on CP1: "flow reversed: north and south swap" |
| 6 | Check: "Button down. What is this now?" chips "an electromagnet", "a battery", "a bolt" | Pick a chip (period 3). | Answer "an electromagnet". |
| 7 | Secret: "Secret: lift with one straight wire instead." | Optional: swap L1 for SW1, press. | Nothing lifts. Note: "one straight wire: a weak field" |
| 8 | Fix-it: "Crane two won't lift. Fix it." | Move TL2's clip to the scraped tip. | Lifts. Note: "enamel insulates: clip bare copper" |
| 9 | "Case closed. My crane lifts on command." | Sign the page. | Stamp, eyes full, island piece. |

**Objectives** (2 eyes; NEW `lab.lifted(id)` = clips held by that coil's core, `lab.compass(id)` = needle angle in
degrees, `lab.view("dust")`)

- O1 Lift and drop: `lift-clips` (`lab.closed("S1") && lab.lifted("L1") >= 3`), `drop-clips` (`!lab.closed("S1") &&
  lab.lifted("L1") === 0`).
- O2 Read the field: `see-the-field` (`lab.view("dust") && lab.closed("S1")`), `swap-poles` (a press with each
  battery orientation, both lifting at least 3 clips, and `lab.memory` holding compass angles 150 to 210 degrees
  apart).
- Secret: `straight-wire` (bonus; `lab.seriesLoop(["B1", "S1", "SW1"]) && lab.closed("S1") && lab.lifted("SW1") === 0`).
- Fix-it: `fix-it` (`lab.closed("S1") && lab.lifted("L1") >= 3` on the fix-it bench).

**Checks:** beat 6, answer "an electromagnet". Wrong: "It's a magnet only while flow runs. That's an electromagnet."

**Notebook page:** "Case 1: The paperclip crane". Sketch: the crane with a bunch of clips, dust loops in ink, the
compass arrow before and after the swap; notes; rule; the beat 5 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Hold the button while the hook's over the dish." Fried (no
part can die; the battery raises `shorted` if S1 is held over 5 s): "A coil is nearly a short. Quick presses,
please."

**On demand:** beat 1 "Hold the button down." · beat 5 "Each clip onto the other snap." · fix-it "Shiny copper
conducts. Brown enamel doesn't."

**Words:** main path 115, on demand 44.

---

### B2. `iron-core`: The feeble crane

- **Minutes** 6 · **Island piece** `coil-bolt` (NEW) · **Unlocks** none.
- **Big idea:** An iron core gathers the field and makes an electromagnet far stronger.
- **New:** "core" (the rod inside a coil).
- **Case:** "The feeble crane". Robot intro: "My new crane lifts nothing. Press its button."

**Bench.** The crane, its coil L2 (100 turns, as L1) wound on a plastic straw with nothing inside. B1, S1 and leads as
in B1. Core drawer: CR1 steel bolt, CR2 iron nail, CR3 aluminium rod, CR4 stainless steel rod, CR5 wooden dowel (each
slides into the straw; NEW P6 core slot). Two `bin` trays: BIN-YES "gathers the field" and BIN-NO "doesn't". L2 has a
turns control (`key: "turns"`, 100 to 200) used only by the secret. Dust view on. Fix-it bench: the crane with CR4 in
its coil.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My new crane lifts nothing. Press its button." | Press S1 over the dish. | One clip twitches. Note on L2: "air inside: a weak magnet" |
| 2 | "This is a core. Slide the steel bolt in." | Slide CR1 into L2, press S1. | A cluster leaps up; dust lines crowd into the bolt. Note on CR1: "steel gathers the field". Rule: "An iron core makes it far stronger." |
| 3 | "Show me the core." | Tap CR1 (period 2). | |
| 4 | Predict: "Aluminium rod next. It lifts..." chips "more", "about the same", "almost nothing" | Swap CR1 for CR3, press. | Almost nothing. Note on CR3: "aluminium: not magnetic" |
| 5 | "Test the rest. Drop each in a tray." | Test CR2, CR4, CR5; drop each in a tray. | A wrong drop slides to the other tray. Note on CR4: "most stainless: barely magnetic" |
| 6 | Check: "What is this?" (CR2 glows) chips "a core", "a coil", "a clip" | Pick a chip (period 3). | Answer "a core". |
| 7 | Secret: "Secret: wind on another hundred turns." | Optional: CR1 in, turns to 200, press. | More clips. Note: "more turns, stronger magnet" |
| 8 | Fix-it: "My crane drops its load. Fix it." | Swap CR4 for CR1 or CR2. | Lifts. Note: "iron or plain steel only" |
| 9 | "Case closed. The bolt did the heavy lifting." | Sign the page. | |

**Objectives** (2 eyes; NEW `lab.core(id)` = the core in a coil, or null)

- O1 Find the core: `air-core` (`lab.core("L2") === null && lab.closed("S1") && lab.lifted("L2") === 0`, held 0.5 s),
  `steel-core` (`lab.core("L2") === "CR1" && lab.closed("S1") && lab.lifted("L2") >= 4`; stores the count in
  `lab.shared`).
- O2 Sort the drawer: `aluminium-core` (`lab.core("L2") === "CR3" && lab.closed("S1") && lab.lifted("L2") <= 1`),
  `sort-cores` (CR2, CR4 and CR5 each tested once, recorded in `lab.memory`; `lab.holds("BIN-YES")` is CR1, CR2 and
  `lab.holds("BIN-NO")` is CR3, CR4, CR5, any order).
- Secret: `more-turns` (bonus; `lab.control("turns") >= 200 && lab.core("L2") === "CR1" && lab.closed("S1")` and
  `lab.lifted("L2")` at least 1.5 times the stored count).
- Fix-it: `fix-it` (core CR1 or CR2, `lab.closed("S1") && lab.lifted("L2") >= 4`).

**Checks:** beat 6, answer "a core".

**Notebook page:** "Case 2: The feeble crane". Sketch: five rods in two trays, each with its clip count drawn as tiny
clips; dust lines bunching into the bolt; notes; rule; the beat 4 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Count the clips. Which rods help?" Fried: as B1.

**On demand:** beat 2 "Drag the bolt into the straw." · beat 5 "Press with each rod, then sort it." · fix-it "One rod
lifted almost nothing. Is it in?"

**Words:** main path 104, on demand 33.

---

### B3. `shake-generator`: Shake to shine

- **Minutes** 7 · **Island piece** `magnet` (NEW) · **Unlocks** `magnet`.
- **Big idea:** A magnet moving through a coil makes a push. A still magnet makes none.
- **New:** the magnet (part, a neodymium cylinder with its ends marked N and S); "generator" (word).
- **Case:** "Shake to shine". Robot intro: "No battery anywhere. Drag the magnet through the coil."

**Bench.** Generator G1 (2.3) on the desk, magnet MG1 resting outside one end. Red LED D1 clipped straight across G1's
two leads (anode on G1.a). The magnet moves by dragging (pointer speed) or by shaking the phone (NEW P3). Tray
(secret): a spare clip lead TLX. Fix-it bench: a torch-generator whose spool has 50 turns (tag "50 turns"); the tray
holds the 2,000-turn spool.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "No battery anywhere. Drag the magnet through the coil." | Drag MG1 through G1. | D1 flashes. Note on G1: "moving magnet: a push" |
| 2 | "Now park it in the middle." | Hold MG1 still inside G1 for 2 s. | Dark. Note on MG1: "still magnet: no push". Rule: "Only a moving magnet makes a push." |
| 3 | "This is a magnet." then "Show me its north end." | Tap MG1's N end (period 2). | A wrong tap shows its name ("south end"). |
| 4 | Check: "Where does the light's energy come from?" chips "my arm", "the magnet", "the coil" | Pick a chip. | Answer "my arm". Note on G1: "generator: your motion becomes push" |
| 5 | Predict: "Work it harder. Shake faster. The flashes..." chips "get brighter", "get dimmer", "stay the same" | Shake fast. | Brighter. Note: "faster change, bigger push" |
| 6 | Check: "Coil and moving magnet together. What is this?" chips "a generator", "a battery", "a motor" | Pick a chip (period 3). | Answer "a generator". |
| 7 | Secret: "Secret: clip the coil's ends together, then drag." | Optional: TLX across G1, drag. | The magnet lags behind your finger. Note: "a closed coil pushes back" |
| 8 | Fix-it: "My torch generator barely glows. Fix it." | Swap the 50-turn spool for the 2,000-turn one. | Bright flashes. Note: "more turns, more push" |
| 9 | "Case closed. Light from a shake!" | Sign the page. | |

D1 lights on one stroke direction only. That is on purpose: B4 finds the other half.

**Objectives** (2 eyes; NEW `lab.magnetSpeed(id)` in m/s, `lab.inside(magnet, coil)`, history source `emf:<coil>`)

- O1 First light: `first-flash` (`lab.stats("glow:D1", 1).max >= 0.25` after MG1 has passed into G1; stores the peak
  of `emf:G1` in `lab.shared`), `park-it` (`lab.heldFor(2, lab.inside("MG1", "G1") && lab.magnetSpeed("MG1") < 0.01)`
  and `lab.stats("glow:D1", 2).max < 0.02`).
- O2 Work it harder: the beat 4 check, then `shake-fast` (`lab.stats("emf:G1", 2).max` at least twice the stored
  peak).
- Secret: `feel-the-drag` (bonus; `lab.connected("G1.a", "G1.b")` through TLX and NEW event `lenz-drag` on MG1).
- Fix-it: `fix-it` (the 2,000-turn spool fitted and `lab.stats("glow:D1", 2).max >= 0.4`).

**Checks:** beat 4 "my arm" (wrong: "The magnet stays just as strong. Your shaking did the work."); beat 6 "a
generator".

**Notebook page:** "Case 3: Shake to shine". Sketch: the tube, the magnet with motion lines, a flash drawn at the LED;
a still magnet with "0" beside it; notes; rule; the beat 5 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "In and out, all the way through." Fried (D1 dies only with
TLX across D1 instead of the coil, which cannot happen; none expected): "Nothing broke. Shake away."

**On demand:** beat 1 "Drag the magnet from one end to the other." · beat 2 "Let go with it inside." · beat 5 "On a
phone, shake the phone itself." · fix-it "Count the turns on each spool."

**Words:** main path 125, on demand 49.

---

### B4. `back-and-forth`: Two lamps take turns

- **Minutes** 6 · **Island piece** `led-lamp` · **Unlocks** none.
- **Big idea:** In and out makes the push flip direction: alternating current, AC. A battery's one-way push is DC.
- **New:** "AC" and "DC" (one pair of words for one idea).
- **Case:** "Two lamps take turns". Robot intro: "Two lamps, facing opposite ways. Push the magnet in."

**Bench.** G1 with MG1 resting outside its left end. D1 and D2 (red, maxmA 50) clipped across G1 in inverse parallel:
D1's anode on G1.a, D2's anode on G1.b. Scope SC1 with two traces: "Coil" (`volts: "G1.a", ref: "G1.b"`) and
"Battery" (an AA cell X1 on a stand, `volts: "X1.pos", ref: "X1.neg"`). The tube can stand upright (secret). Fix-it
bench: the same pair with D2 turned to face the same way as D1.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Two lamps, facing opposite ways. Push the magnet in." | Drag MG1 into the middle of G1. | D1 flashes. Note on D1: "push in: flow this way" |
| 2 | "Now pull it back out." | Drag MG1 out the way it came. | D2 flashes. Note on D2: "pull out: flow the other way" |
| 3 | "Shake it. Watch the scope." | Shake MG1 with SC1 on. | The coil trace swings above and below zero; the battery trace stays flat. Note on the coil trace: "up, down, up: alternating". Rule: "Back-and-forth push is AC. One-way is DC." |
| 4 | "Show me the one-way push." | Tap a trace (period 2). | Answer: the battery trace. A wrong tap shows "this one alternates: AC". |
| 5 | Card: "AC or DC? Sort the shelf." | Sort five items (pop-up card, below). | Each lands with its stamp line. |
| 6 | Check: "What is this?" (the coil trace glows) chips "AC", "DC" | Pick a chip (period 3). | Answer "AC". |
| 7 | Secret: "Secret: stand the tube up. Drop the magnet through." | Optional: tap "stand up", let MG1 fall. | D1, then D2, a blink apart. Note: "one pass: in, then out" |
| 8 | Fix-it: "Only one lamp ever flashes. Fix it." | Turn D2 round. | Both take turns. Note: "one lamp for each direction" |
| 9 | "Case closed. My generator makes AC." | Sign the page. | |

**Pop-up card: AC or DC?** (info only for the wall socket and the dynamo, which are never simulated). Drag each item
onto "AC" or "DC". A wrong drop slides across and shows its line. Counts as one graded check (all five right first).

| Item | Tray | Stamp line |
|---|---|---|
| AA cell | DC | "1.5 V, always one way." |
| Shake generator | AC | "In, out, in, out." |
| Bike hub dynamo | AC | "Spinning magnets, alternating push." |
| Wall socket | AC | "230 V or 120 V. It can kill." |
| Phone charger, USB end | DC | "5 V DC, made from the wall's AC." |

**Objectives** (3 eyes; NEW `lab.magnetPos(id)` = magnet centre along the tube in mm, 0 at the coil's middle)

- O1 One way, then back: `push-in` (a stroke from outside G1 to within 10 mm of its middle during which D1's glow
  peaks above 0.25 and D2's stays below 0.05, tracked in `lab.memory`), `pull-out` (the reverse stroke: D2 flashes,
  D1 does not).
- O2 See it alternate: `scope-ac` (SC1 on and `lab.stats("emf:G1", 2)` with min below -0.5 V and max above 0.5 V).
- O3 Sort the shelf: the card (`ac-or-dc`).
- Secret: `drop-through` (bonus; NEW `lab.prop("G1").upright`, MG1 passes through by itself, D1 then D2 peak above 0.2
  within 0.3 s of each other).
- Fix-it: `fix-it` (`lab.stats("glow:D1", 3).max >= 0.2 && lab.stats("glow:D2", 3).max >= 0.2`).

**Checks:** beat 4 (the battery trace); the card; beat 6 "AC".

**Notebook page:** "Case 4: Two lamps take turns". Sketch: the two lamps with arrows for in and out, the scope's AC
wave beside a flat DC line; the card's five items with stamps; notes; rule; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Stop in the middle, then pull back." Fried: none expected
("Both lamps are fine. Keep shaking.").

**On demand:** beat 1 "Stop with the magnet inside the coil." · beat 4 "Which line never changes?" · fix-it "Do both
lamps point the same way?"

**Words:** main path 125, on demand 31.

---

### B5. `one-way-street`: Keep the shakes

- **Minutes** 7 · **Island piece** `diode` · **Unlocks** `diode-1n4148`.
- **Big idea:** A diode lets only one half of the AC through, so the shakes can fill a capacitor and stay there.
- **New:** "rectifier" (a diode used to make AC one-way). The diode and the capacitor are known from Unit 2.
- **Case:** "Keep the shakes". Robot intro: "Shake ten times. Watch the meter."

**Bench.** G1 with MG1. D1 a 1N4148 (`diode` model 1N4148), anode on G1.a. C1 1000 µF 16 V electrolytic from
D1.cathode (+) to G1.b (−). Meter M1 on DC volts, probes across C1. A lamp branch across C1: S1 toggle (off), R2 1 kΩ,
D2 red LED. Scope SC1, two traces: "Coil push" (`volts: "G1.a", ref: "G1.b"`) and "Through the diode" (`amps: "D1"`).
Tray (secret): three more 1N4148s (D3 to D5) and a diamond-shaped bridge card to build on. Fix-it bench: a bike
lamp: G1, a 1N4148, R2 and D2 in series, no capacitor; tray C2 1000 µF.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Shake ten times. Watch the meter." | Shake MG1 ten strokes. | The meter climbs in steps. Note on C1: "each stroke adds a little" |
| 2 | Predict: "Stop shaking. The meter will..." chips "drop to zero", "hold its number" | Stop for 3 s. | It holds. Note on D1: "the diode blocks the way back" |
| 3 | "Scope on. Shake again." | Shake with SC1 on. | The coil swings both ways; the diode's flow only one way. Note on D1: "rectifier: AC in, one way out". Rule: "A diode turns AC into one-way flow." |
| 4 | "Show me the rectifier." | Tap D1 (period 2). | A wrong tap shows that part's name. |
| 5 | "Spend it. Flip the lamp switch." | Flip S1. | D2 glows, then fades. Note on D2: "stored shakes, spent as light" |
| 6 | Check: "What is this?" (D1 glows) chips "a rectifier", "a capacitor", "a coil" | Pick a chip (period 3). | Answer "a rectifier". |
| 7 | Secret: "Secret: four diodes in a diamond. Both strokes count." | Optional: build the bridge, shake. | The meter climbs about twice as fast. Note: "a bridge uses both strokes" |
| 8 | Fix-it: "My bike lamp flickers every stroke. Make it steady." | Drop C2 across the lamp, stripe to the minus side. | A steady glow while shaking. Note: "the capacitor fills the gaps" |
| 9 | "Case closed. Shakes in the bank." | Sign the page. | |

**Objectives** (2 eyes)

- O1 Fill and hold: `fill-it` (`(lab.volts("C1.pos", "C1.neg") ?? 0) >= 2`), `hold-it` (`lab.heldFor(3,
  lab.magnetSpeed("MG1") < 0.01)` and C1's voltage still at least 95% of its value when the magnet stopped).
- O2 One way out: `scope-halves` (SC1 on; over 2 s `lab.stats("emf:G1", 2).min < -0.5`, `lab.stats("i:D1", 2).max >
  0.001` and `lab.stats("i:D1", 2).min > -1e-6`), `spend-it` (`lab.closed("S1") && lab.isLit("D2", 0.2)`).
- Secret: `bridge` (bonus; NEW `lab.bridge(["D1", "D3", "D4", "D5"])` true and C1's voltage rising while shaking).
- Fix-it: `fix-it` (`lab.joins("C2", "R2.a", "D2.cathode", "forward")` or across the lamp branch either way that keeps
  C2's + toward the diode's band, and `lab.stats("glow:D2", 2).min >= 0.15` while MG1 moves).

**Checks:** beat 6, answer "a rectifier".

**Notebook page:** "Case 5: Keep the shakes". Sketch: the coil, the diode with an arrow one way, the capacitor filling
like a jar (three ink levels), the two scope traces; notes; rule; the beat 2 guess in blue; secret box (a diamond of
four diodes).

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Watch the meter between strokes." Fried (C2 put in
backwards raises `reversed`): "Stripe toward minus. That one's upset. Turn it round."

**On demand:** beat 2 "Hands off for three seconds." · beat 7 "Each corner of the diamond takes one diode." · fix-it
"Something to fill the gaps between strokes?"

**Words:** main path 105, on demand 34.

---

### B6. `speaker-inside`: The hidden coil

- **Minutes** 7 · **Island piece** `speaker` · **Unlocks** `signal-generator`.
- **Big idea:** A speaker is an electromagnet glued to a paper cone. Changing flow moves the cone; the cone pushes air.
- **New:** the signal generator (tool, three periods). The speaker is known from Unit 2; its voice coil is shown, not
  drilled.
- **Case:** "The hidden coil". Robot intro: "This is a signal generator. Turn its dial to 2 Hz."

**Bench.** Speaker SP1 (8 Ω, free air) on a stand with an explode slider (NEW V9: cone, dust cap, spider, voice coil
on its former, magnet, frame). Signal generator SG1 (NEW N1: frequency dial 1 Hz to 3 MHz, waveform sine,
square or DC, amplitude up to 1 V) clipped to SP1. Air view in front of the cone: ink rings, one per push (NEW V10).
Scope SC1 (off; for the secret, trace across SP1). Fix-it bench: SG1 left on DC.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is a signal generator. Turn its dial to 2 Hz." | Set SG1 to 3 Hz or less. | The cone pumps slowly. Note on the cone: "pushed out, pulled in" |
| 2 | "Slide the speaker apart. What's hidden?" | Drag the explode slider. | The parts spread; the coil jiggles in the magnet's gap. Note on the voice coil: "a coil: an electromagnet". Rule: "A speaker is an electromagnet on a cone." |
| 3 | "Show me the part that moves the cone." | Tap the voice coil. | A wrong tap names itself (spider, magnet, cone). |
| 4 | Predict: "Turn it up to 440 Hz. You'll..." chips "see it faster", "hear a note", "both" | Set SG1 to 440 Hz. | A clear note; the cone blurs; rings spread. Note on the rings: "pushes of air: sound" |
| 5 | "Use the generator. Make the note higher." | Set SG1 to 880 Hz or more (period 2). | Higher; the rings crowd closer. Note: "higher note, closer rings" |
| 6 | Check: "What is this?" (SG1 glows) chips "a signal generator", "a speaker", "a battery" | Pick a chip (period 3). | Answer "a signal generator". |
| 7 | Secret: "Secret: unplug the generator. Tap the cone." | Optional: unclip SG1, scope across SP1, tap the cone. | A wiggle on the scope. Note: "run backwards: a microphone" |
| 8 | Fix-it: "My speaker just clicks once. Fix it." | Switch SG1 from DC to sine. | A note. Note: "steady flow: one push, then silence" |
| 9 | "Case closed. The coil was hiding in there." | Sign the page. | |

**Objectives** (2 eyes; NEW `lab.siggen(id)` = `{ hz, wave, volts, on }`, history source `cone:<speaker>` in mm)

- O1 See the cone: `slow-wiggle` (`lab.siggen("SG1").hz <= 3` with a sine or square wave and
  `lab.stats("cone:SP1", 2).span > 0.5`), `explode` (`lab.view("explode:SP1")`).
- O2 Make a note: `concert-a` (`Math.abs((lab.toneHz("SP1") ?? 0) - 440) <= 9`; the runtime's `speaker-concert-a`
  trigger fires too), `higher-note` (`(lab.toneHz("SP1") ?? 0) >= 880`).
- Secret: `microphone` (bonus; SG1 unclipped, SC1 across SP1, NEW event `cone-tap`, then `lab.stats("v:SP1", 1).span >
  0.002`).
- Fix-it: `fix-it` (`lab.heldFor(1, lab.toneHz("SP1") !== null)`).

**Checks:** beat 3 (tap the voice coil); beat 6 "a signal generator".

**Notebook page:** "Case 6: The hidden coil". The exploded speaker drawn in ink with the voice coil circled; rings at
two spacings for 440 Hz and 880 Hz; notes; rule; the beat 4 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Low numbers on the dial are slow." Fried (SP1 cannot be
overdriven by SG1's 1 V; none expected): "Still singing. Nothing hurt."

**On demand:** beat 1 "Turn the dial all the way down." · beat 4 "Type 440 on the dial." · fix-it "Steady flow makes
no sound. Pick a wave."

**Words:** main path 115, on demand 31.

---

## 5. Module 2: Coils and radio (`radio`)

Landmark `radio-mast`. Summary for `module.yaml`: "A coil that fights back, a tank that sings one note, a song hidden
in a wave, and a radio with no battery."

---

### B7. `coil-fights-back`: The late lamp

- **Minutes** 7 · **Island piece** `relay` · **Unlocks** `inductor`.
- **Big idea:** A coil fights every change in its flow: slow to start, and it pushes on when cut.
- **New:** the inductor (part: a coil made to resist change). The kickback at release is known from Unit 2's
  `coil-kickback`; the new half is the slow start, and seeing both at once.
- **Case:** "The late lamp". Robot intro: "Two lamps across a coil. Press and hold the button."

**Bench.** B1, S1 (`pushbutton` on a base), R1 470 Ω, inductor L7 (NEW `inductor` bench kind: a big coil on a
removable iron core, 2 H with the core, 0.2 H without, 10 Ω) from R1.b to B1.neg. D1 red LED forward across L7 (anode
on R1.b), D2 red LED backwards across it (anode on B1.neg). Flow dots on L7 (Start here V1). The time control
(`key: "speed"`) reaches 0.001 here (NEW S12). Tray (secret): C7, a 1000 µF electrolytic. Fix-it bench: Unit 2's relay
driver: B1, S2 button, relay K1 (540 Ω coil, 0.3 H), no clamp diode; tray D9, a 1N4001.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Two lamps across a coil. Press and hold the button." | Press and hold S1. | D1 blinks, then goes dark. Note on D1: "a blink, then the coil wins" |
| 2 | "Now let go." | Release S1. | D2 blinks. Note on D2: "the coil pushes on, backwards" |
| 3 | "Slow time a thousandfold. Press, then let go." | Set the time control to 0.001; press and release. | D1 fades over seconds as the dots in L7 speed up; at release D2 fades as they slow. Note on L7: "flow grows slowly, fades slowly". Rule: "A coil fights every change in its flow." |
| 4 | "This is an inductor: a coil made to resist change." then "Show me the inductor." | Tap L7 (period 2). | A wrong tap shows that part's name. |
| 5 | Predict: "Pull out its iron core. The blinks get..." chips "longer", "shorter" | Slide the core out; press and release, still slowed. | Shorter. Note on L7: "less iron, less fight" |
| 6 | Check: "What is this?" (L7 glows) chips "an inductor", "a resistor", "a capacitor" | Pick a chip (period 3). | Answer "an inductor". |
| 7 | Secret: "Secret: swap the coil for a capacitor." | Optional: C7 in L7's place, press and release. | D1 lights late, fades slowly; D2 never. Note: "a capacitor: the mirror image" |
| 8 | Fix-it: "My relay button sparks every time. Fix it." | Clip D9 across K1's coil, band toward +. | No spark. Note: "the diode catches the push" |
| 9 | "Case closed. Coils hate change." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Press and release: `press-blink` (while S1 is held, `lab.stats("glow:D1", 0.5).max >= 0.2` and then D1's glow
  below 0.05 still pressed, tracked in `lab.memory`), `release-blink` (D2 peaks above 0.2 within 0.5 simulated
  seconds of release).
- O2 Slow it down: `slow-motion` (`(lab.control("speed") ?? 1) <= 0.002` and a press and a release both seen in it).
- O3 Meet the inductor: `core-out` (NEW `lab.core("L7") === null`, then a press in which `lab.timeAbove("glow:D1",
  0.1, 1)` is under half the value stored with the core in, in `lab.shared`).
- Secret: `capacitor-mirror` (bonus; `lab.joins("C7", "R1.b", "B1.neg")`, a press in which D1 first passes 0.1 glow
  more than 0.1 s after S1 closes).
- Fix-it: `fix-it` (`lab.joins("D9", "K1.coil2", "K1.coil1", "forward")` and a press and release with no `spark`
  event on S2 since D9 went in).

**Checks:** beat 6, answer "an inductor".

**Notebook page:** "Case 7: The late lamp". Sketch: the coil with D1 and D2, a slow-motion strip of three frames per
lamp, the core drawn beside it; notes; rule; the beat 5 guess in blue; secret box (the capacitor's mirror strip).

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Watch D1 as you press, D2 as you let go." Fried (D9 put in
forwards across K1, which shorts the coil through the diode): "Band toward plus. Forwards, it's a shortcut."

**On demand:** beat 3 "Drag the time control all the way down." · beat 5 "Grab the core's handle and slide." · fix-it
"Unit 2's trick: a diode across the coil."

**Words:** main path 114, on demand 39.

---

### B8. `resonance`: The tank's own note

- **Minutes** 7 · **Island piece** `capacitor` · **Unlocks** `tuning-capacitor`.
- **Big idea:** A coil and a capacitor side by side swap energy back and forth and ring at one frequency.
- **New:** the tuning capacitor (part); "resonance" (word).
- **Case:** "The tank's own note". Robot intro: "This coil and capacitor hide a favourite note. Press Sweep."

**Bench.** SG1 feeding, through R8 100 kΩ, a tank: the radio coil L8 (2.3, TAP on all 65 turns) side by side with the
tuning capacitor C8 (2.3, knob at 340 pF). Scope SC1 with a **Sweep** button (NEW S5: the generator glides 300 kHz to
3 MHz and the scope draws the tank's swing against frequency; a pencil mark shows SG1's own setting). A pluck button on
the tank for the secret. Fix-it bench: the same tank at 340 pF with a pencil target line at 990 kHz.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This coil and capacitor hide a favourite note. Press Sweep." | Press Sweep. | The curve draws one tall peak. Note on the peak: "one frequency, far bigger" |
| 2 | "Tune the generator to the peak." | Set SG1 within 3% of the peak. | The tank swings big; ink arrows slosh between coil and capacitor. Note on the tank: "resonance: the tank's own note". Rule: "A coil and capacitor ring at one note." |
| 3 | "Show me the resonance." | Tap the peak (period 2). | |
| 4 | "This is a tuning capacitor." then Predict: "More plates in. The peak moves..." chips "lower", "higher" | Turn C8's knob to mesh more plates; Sweep. | Lower. Note on C8: "more plates, lower note" |
| 5 | Predict: "Clip fewer coil turns. The peak moves..." chips "lower", "higher" | Move TAP down the coil; Sweep. | Higher. Note on TAP: "fewer turns, higher note" |
| 6 | Check: "What is this?" (the peak glows) chips "resonance", "a spark", "a short" | Pick a chip (period 3). | Answer "resonance". |
| 7 | Check: "What is this?" (C8 glows) chips "a tuning capacitor", "a coil", "a battery" | Pick a chip (period 3). | Answer "a tuning capacitor". |
| 8 | Secret: "Secret: switch the generator off. Pluck the tank." | Optional: SG1 off, tap the pluck button. | The scope rings at the note, fading. Note: "it rings alone, then fades" |
| 9 | Fix-it: "My tank should sing at 990 kHz. Fix it." | Tune C8 (and TAP) until the peak sits on the line. | Note: "on the line: 990 kHz" |
| 10 | "Case closed. The tank sings one note." | Sign the page. | |

Beat 4's knob turn is period 2 for the tuning capacitor.

**Objectives** (3 eyes; NEW `lab.sweep(id)` = `{ done, peakHz, peakVolts }` of the latest sweep, `lab.prop("C8").pF`,
`lab.prop("L8").turns`)

- O1 Find the note: `sweep` (`lab.sweep("SC1").done`), `tune-to-peak` (`Math.abs(lab.siggen("SG1").hz -
  lab.sweep("SC1").peakHz) <= 0.03 * lab.sweep("SC1").peakHz`).
- O2 Move the note: `more-plates` (C8 up by 50 pF or more and a new sweep with a lower peak), `fewer-turns` (TAP on
  fewer turns and a new sweep with a higher peak). Earlier peaks are kept in `lab.shared`.
- O3 Name them: the beat 6 and 7 checks.
- Secret: `pluck` (bonus; SG1 off and NEW event `rang` on L8 with `data.hz` within 3% of the latest peak).
- Fix-it: `fix-it` (`lab.sweep("SC1").done && Math.abs(lab.sweep("SC1").peakHz - 990e3) <= 20e3`).

**Checks:** beat 6 "resonance"; beat 7 "a tuning capacitor".

**Notebook page:** "Case 8: The tank's own note". Sketch: the coil and the meshing plates side by side, three sweep
curves drawn over each other (start, more plates, fewer turns) with arrows; notes; rule; both guesses in blue; secret
box (a fading ring).

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Sweep after every change." Fried: none possible ("Nothing
to break here. Tune away.").

**On demand:** beat 2 "Drag the generator's dial onto the peak's mark." · beat 5 "Fewer turns: clip a lower loop." ·
fix-it "Too low? Fewer plates, or fewer turns."

**Words:** main path 123, on demand 31.

---

### B9. `riding-the-carrier`: The hidden song

- **Minutes** 6 · **Island piece** `ceramic-cap` · **Unlocks** none.
- **Big idea:** AM radio hides a song in the changing height of a fast wave.
- **New:** "carrier" (the fast wave). The station is SG1 in its AM mode.
- **Case:** "The hidden song". Robot intro: "This station sends a song. Clip the speaker on."

**Bench.** Station ST1: SG1 in AM mode (NEW: carrier 990 kHz, an original jingle as the song, depth knob 0 to 120%,
starting at 60%, mute button). SP1 (8 Ω) on the desk with free clips. Scope SC1 on ST1's output, with a zoom and a
"drawing speed" slider (NEW V11: draws the carrier slowed, so a few dozen waves fit one wiggle of the song; labelled
"drawn slowed down"). Blue outline toggle on the scope. Fix-it bench: ST1 with the depth knob at 0.

The radio parts of this module run on the envelope model (NEW S6), not on the circuit solver: nothing on this bench is
solved at 990 kHz.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This station sends a song. Clip the speaker on." | Clip SP1 to ST1. | Silence; the cone does not move. Note on SP1: "too fast to follow: silence" |
| 2 | "Scope on. Zoom in." | Zoom SC1 in. | A fast wave whose height swells and shrinks. Note: "a fast wave, changing height" |
| 3 | "Slow the drawing right down." | Drag the drawing speed down. | A blue outline traces the song's wiggle. Note on the outline: "the song is in the height". Rule: "AM carries a song in the height." |
| 4 | "The fast wave is the carrier." then "Show me the carrier." | Tap the fast wave, not the outline (period 2). | A wrong tap shows "the song's outline". |
| 5 | Predict: "Mute the song. The carrier will..." chips "stop", "keep going, flat" | Tap mute. | The carrier runs on at one height. Note: "no song: steady height" |
| 6 | Check: "What is this?" (the fast wave glows) chips "the carrier", "the song", "a spark" | Pick a chip (period 3). | Answer "the carrier". |
| 7 | Secret: "Secret: turn the song up past full." | Optional: depth above 100%. | The wave pinches to nothing at the dips. Note: "too loud: the wave pinches off" |
| 8 | Fix-it: "My station sends a flat carrier. Fix it." | Turn the depth knob up. | The height dances again. Note: "no change in height, no song" |
| 9 | "Case closed. The song rides the carrier." | Sign the page. | |

**Objectives** (3 eyes; NEW `lab.radio()` = `{ station, loudness, audible }` at the listening part,
`lab.scope(id).msPerDiv`, `lab.siggen(id).depth`)

- O1 Hear nothing: `silent-speaker` (SP1 joined to ST1 and `lab.heldFor(1, !lab.radio().audible)`).
- O2 See the song: `zoom-in` (`lab.scope("SC1").msPerDiv <= 0.05`), `slow-drawing` (`(lab.control("drawing") ?? 1) <=
  0.05` with the outline on).
- O3 Steady carrier: `mute-song` (song muted and SG1 still on).
- Secret: `overmodulate` (bonus; `lab.siggen("SG1").depth > 1`).
- Fix-it: `fix-it` (`lab.siggen("SG1").depth >= 0.3` with the song playing).

**Checks:** beat 4 (tap the carrier); beat 6 "the carrier".

**Notebook page:** "Case 9: The hidden song". Sketch: the carrier drawn slowed with its blue outline, a flat carrier
beside it, the silent speaker; notes; rule; the beat 5 guess in blue; secret box (a pinched wave).

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Look at the shape of the tops." Fried: none possible
("Nothing breaks here. Listen and look.").

**On demand:** beat 2 "Pinch or scroll on the scope to zoom." · beat 4 "The wave, not the line around it." · fix-it
"A song needs the height to change."

**Words:** main path 113, on demand 35.

---

### B10. `diode-detector`: Half a wave

- **Minutes** 6 · **Island piece** `jumper-arch` · **Unlocks** `earphone`, `diode-germanium`.
- **Big idea:** A diode lets only the tops of the carrier through; the slow earphone averages them back into the song.
- **New:** the earphone (part: a high-impedance earpiece, 2,000 Ω or more). The diode is known; germanium is a kind of
  diode, met in beat 6, not a new part.
- **Case:** "Half a wave". Robot intro: "This is an earphone. Clip it on the station."

**Bench.** ST1 from B9 (song on, depth 60%), with a strong or weak setting (starts strong). Earphone E1 with free
clips. D1 a germanium signal diode (NEW model, glass body, band marked), D2 a 1N4148 (silicon) in the tray, EB1 a pair
of ordinary 32 Ω earbuds in the tray (secret). Scope SC1 with two traces: "After the diode" and "In the earphone" (the
averaged wave). Fix-it bench: ST1, D1 and E1 in a loop with a clip lead TLX across D1.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is an earphone. Clip it on the station." | Clip E1 across ST1. | Silence. Note on E1: "can't follow the carrier either" |
| 2 | "Put the diode in the way." | Clip D1 between ST1 and E1. | The song plays. Note on D1: "half the wave, all one way" |
| 3 | "Watch the earphone's trace." | Turn on SC1's second trace. | A smooth wiggle: the song. Note on E1: "too slow for the carrier: averages". Rule: "The diode cuts; the earphone averages." |
| 4 | "Show me the earphone." | Tap E1 (period 2). | A wrong tap shows that part's name. |
| 5 | Predict: "Weak station. Silicon diode in. You'll hear..." chips "the same song", "less, or nothing" | Set ST1 to weak; swap D1 for D2. | Silence. Note on D2: "silicon needs more push to start" |
| 6 | "Germanium back in." | Swap D2 for D1. | The faint song returns. Note on D1: "germanium starts at about 0.2 V" |
| 7 | Check: "What is this?" (E1 glows) chips "an earphone", "a speaker", "a diode" | Pick a chip (period 3). | Answer "an earphone". |
| 8 | Secret: "Secret: try ordinary earbuds instead." | Optional: swap E1 for EB1. | Almost nothing. Note: "low ohms drag the signal down" |
| 9 | Fix-it: "My detector hears nothing. Fix it." | Unclip TLX. | The song. Note: "no diode: the halves cancel" |
| 10 | "Case closed. The song's out." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Pull the song out: `silent-earphone` (E1 straight across ST1, `lab.heldFor(1, !lab.radio().audible)`),
  `diode-in` (D1 in series between ST1 and E1 and `lab.radio().loudness >= 0.3`).
- O2 See the average: `earphone-trace` (`lab.view("trace:SC1:2")`).
- O3 Germanium wins: `silicon-weak` (ST1 weak, D2 in D1's place, `lab.radio().loudness < 0.05` for 1 s),
  `germanium-back` (ST1 weak, D1 in place, `lab.radio().loudness >= 0.15`).
- Secret: `earbuds` (bonus; EB1 in E1's place, `lab.radio().loudness < 0.05`).
- Fix-it: `fix-it` (TLX gone from D1 and `lab.radio().loudness >= 0.3`).

**Checks:** beat 4 (tap E1); beat 7 "an earphone".

**Notebook page:** "Case 10: Half a wave". Sketch: three small traces stacked (carrier, tops only, smooth song) with
the diode and the earphone between them; notes; rule; the beat 5 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Station, diode, earphone, back to the station." Fried: none
possible ("Radio signals are tiny. Nothing can burn.").

**On demand:** beat 2 "Unclip one earphone lead, clip the diode in its place." · beat 5 "Weak switch on the station
first." · fix-it "Is the diode really in the loop?"

**Words:** main path 112, on demand 37.

---

### B11. `crystal-radio`: Voices from the air

- **Minutes** 9 · **Island piece** `antenna` (NEW) · **Unlocks** `antenna`.
- **Big idea:** A long wire catches every station's tiny power; the tank picks one; no battery is needed.
- **New:** the antenna (part) and the ground (word: a connection to the earth).
- **Case:** "Voices from the air". Robot intro: "Voices in the clouds! String the antenna to the tree."

**Bench.** The garden scene (NEW P8): a shed window with the set on the sill. The set is pre-wired and locked: L8 on
its bottle with TAP, C8, D1 (germanium) and E1, with a terminal ANT at the top of L8 and a terminal GND at the bottom.
Antenna wire AW1 (20 m) coiled on the lawn, a tree with a rope insulator. Ground choices: stake GS1 (in the tray), a
metal water pipe WP1 and a plastic drainpipe PP1 by the wall. A day and night toggle. Stations (fictional, original
audio, NEW S6): "Sketch Isle Radio" 630 kHz strong, "Pump House Tunes" 990 kHz medium, "Meter Tower Weather" 1,440 kHz
weak; at night only, "Far Shore Radio" 810 kHz. Fix-it bench: radio two, its GND clip on PP1.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Voices in the clouds! String the antenna to the tree." | Drag AW1's far end to the tree's insulator. | A faint jumble. Note on AW1: "a long wire catches every station" |
| 2 | "Push the ground stake in. Clip it on." | Place GS1, clip GND to it. | One station, faint but clear. Note on GS1: "the earth closes the loop" |
| 3 | "Turn the tuning knob slowly." | Turn C8 until a station is loud. | One station clear, the rest gone. Note on L8: "the tank picks one station". Rule: "The antenna catches all. The tank picks one." |
| 4 | Check: "No battery. Where's the power from?" chips "the far station", "a hidden battery", "the earth" | Pick a chip. | Answer "the far station". Note on AW1: "the station's power, caught by wire" |
| 5 | "Show me the antenna." | Tap AW1 (period 2). | A wrong tap shows that part's name. |
| 6 | "Find all three stations." | Tune to each station with TAP and C8. | Each station's name stamps into the notebook. |
| 7 | Card: "A storm's coming. Sort what you do." | Sort four cards (pop-up card, below). | Each lands with its line. |
| 8 | Check: "What is this?" (AW1 glows) chips "an antenna", "a ground", "a coil" | Pick a chip (period 3). | Answer "an antenna". |
| 9 | Secret: "Secret: wait for night. Listen again." | Optional: night on, tune. | A far station drifts in. Note: "at night, far stations reach you" |
| 10 | Fix-it: "Radio two is silent. Fix it." | Move GND from PP1 to WP1 or a stake. | A station. Note: "plastic pipe: no ground" |
| 11 | "Case closed. Voices from the air!" | Sign the page. | The mast's tip starts blinking. |

**Pop-up card: storm coming** (info only: lightning is never simulated). Drag each card onto "do" or "don't". A wrong
drop slides across and shows its line. One graded check (all four right first).

| Card | Tray | Line |
|---|---|---|
| Unclip the antenna from the set | do | "First, unclip it." |
| Drop its lead outside, away from the house | do | "Outside, far from you." |
| Keep listening by the window | don't | "Not in a storm." |
| Hold the antenna wire | don't | "Never touch it in a storm." |

**Objectives** (3 eyes; NEW `lab.antenna(id).strung`, `lab.ground(terminal)` = `"earth"`, `"none"` or null, and the
day or night setting in `lab.prop("SKY").night`)

- O1 Catch the air: `string-antenna` (`lab.antenna("AW1").strung`), `ground-it` (`lab.ground("GND") === "earth"`).
- O2 Tune in: `first-station` (`lab.radio().station !== null && lab.radio().loudness >= 0.4`), then the beat 4 check.
- O3 Every station: `three-stations` (`lab.memory` holds the three day stations, each heard at loudness 0.3 or more
  for 2 s), then the storm card.
- Secret: `night-listening` (bonus; night on and `lab.radio().station === "far-shore"` at loudness 0.2 or more for
  2 s).
- Fix-it: `fix-it` (`lab.ground("GND") === "earth" && lab.radio().loudness >= 0.3`).

**Checks:** beat 4 "the far station" (wrong: "No battery anywhere. The station's power arrives by air."); the storm
card; beat 8 "an antenna".

**Notebook page:** "Case 11: Voices from the air". Sketch: the garden, the antenna to the tree, the stake, the set on
the sill; a dial strip with the three stations marked where the learner found them (TAP and C8 written beside each);
notes; rule; the storm card's stamps; secret box (a moon over the far station).

**Robot lines:** start = beat 1. Success = beat 11. Hint: "Small turns. Stations hide in narrow spots." Fried: none
possible ("No battery, nothing to burn. Just listen.").

**On demand:** beat 2 "The stake is in the tray. Then clip GND to it." · beat 6 "No luck with the knob? Move the clip."
· fix-it "Is that pipe metal?"

**Words:** main path 141, on demand 46.

---

## 6. Module 3: A computer on a chip (`microcontrollers`)

Landmark `microcontroller-hq`. Summary for `module.yaml`: "A board that obeys, a lamp that blinks, the same program
in words, and a button the board can hear."

From here every bench has the board U1 (2.3) and the code drawer (R12). The board's onboard lamp is the part `U1:L`
(pin 13). Starting programs are given in bench C; blocks show the same thing.

---

### B12. `meet-the-mcu`: The board that listens

- **Minutes** 6 · **Island piece** `mcu-board` (NEW) · **Unlocks** `mcu-board`.
- **Big idea:** A microcontroller runs a program, and the program decides what each pin does.
- **New:** the microcontroller board (part); "program" (word). Upload is the one button that matters.
- **Case:** "The board that listens". Robot intro: "This is a microcontroller board. Press Upload."

**Bench.** U1 on the desk, USB cable to a laptop prop (the board's ON light lit). Half board beside it: a jumper from
U1 pin 7 to a red LED D1 with R1 470 Ω to a jumper on GND. A 9 V battery with a barrel plug lies on the desk (secret).
Code drawer, blocks only:

```c
void setup() {
  pinMode(13, OUTPUT);
  pinMode(7, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
}
```

Fix-it bench: the same build with D1's jumper on pin 8 while the program drives pin 7.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is a microcontroller board. Press Upload." | Tap Upload. | A short progress bar; U1:L lights. Note on U1:L: "pin 13 HIGH: 5 V out" |
| 2 | "Change HIGH to LOW. Upload again." | Flip the block's HIGH to LOW; Upload. | Dark. Note: "LOW: 0 V, dark". Rule: "The program decides what each pin does." |
| 3 | "Show me the chip that runs it." | Tap the microcontroller chip on U1 (period 2). | A wrong tap names itself: USB socket, regulator, reset button, pin header. |
| 4 | Predict: "Change 13 to 7, HIGH again. Which lamp lights?" chips "the board's", "the breadboard's", "both" | Edit the block; Upload. | D1 lights. Note on D1: "the program picked pin 7" |
| 5 | Check: "What is this?" (U1 glows) chips "a microcontroller board", "a breadboard", "a battery" | Pick a chip (period 3). | Answer "a microcontroller board". |
| 6 | Secret: "Secret: unplug the USB. Plug the battery in." | Optional: unplug USB, plug the battery into the jack. | D1 lights again. Note: "the program stays without power" |
| 7 | Fix-it: "Pin 7's lamp won't light. Fix it." | Move D1's jumper from pin 8 to pin 7. | Lit. Note: "wire and program must agree" |
| 8 | "Case closed. The board does as it's told." | Sign the page. | |

**Objectives** (2 eyes; NEW `lab.pin(board, n)` = `{ mode, level, volts, mA }`, `lab.uploads(board)`,
`lab.board(id).power` = `"usb"`, `"jack"` or `"off"`)

- O1 First upload: `upload` (`lab.uploads("U1") >= 1 && lab.isLit("U1:L")`), `pin-low` (`lab.pin("U1", 13).level ===
  "LOW" && !lab.isLit("U1:L")` after a second upload).
- O2 Pick a pin: `pin-seven` (`lab.pin("U1", 7).level === "HIGH" && lab.isLit("D1", 0.3)`).
- Secret: `keeps-program` (bonus; `lab.board("U1").power === "jack" && lab.isLit("D1", 0.3)` with no upload since the
  USB was unplugged).
- Fix-it: `fix-it` (`lab.isLit("D1", 0.3)` on the fix-it bench).

**Checks:** beat 3 (tap the chip); beat 5 "a microcontroller board".

**Notebook page:** "Case 12: The board that listens". Sketch: the board with its parts labelled in ink (USB, jack,
chip, pins 0 to 13, GND, the L lamp), the two lamps and their pins; the two programs side by side as blocks; notes;
rule; the beat 4 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Change the block, then Upload." Fried (a pin above 40 mA,
only if a learner wires D1 with no resistor): "Ouch, that pin worked too hard. Resistor first."

**On demand:** beat 2 "Tap the word HIGH on the block." · beat 4 "Tap 13 and type 7." · fix-it "Follow D1's jumper.
Which pin?"

**Words:** main path 102, on demand 30.

---

### B13. `first-blink`: The stuck lamp

- **Minutes** 6 · **Island piece** `led-lamp` · **Unlocks** none.
- **Big idea:** The loop repeats forever, top to bottom; delay holds a step so you can see it.
- **New:** "loop" (the block that repeats) and "delay" (hold this step), one idea: timing a repeat. The robot points out
  that this loop repeats, unlike the circuit loop of Start here.
- **Case:** "The stuck lamp". Robot intro: "My lamp is stuck on. Drag a LOW block into the loop."

**Bench.** U1 on USB. Code drawer, blocks only, with `setup()` holding `pinMode(13, OUTPUT)` and `loop()` holding only
`digitalWrite(13, HIGH)`. The palette offers one block per beat (LOW, then delay, then numbers). Fix-it bench: a loop
of HIGH, `delay(500)`, LOW, with no wait after LOW.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My lamp is stuck on. Drag a LOW block into the loop." | Add `digitalWrite(13, LOW)` after HIGH; Upload. | Steady, a little dimmer. Note on U1:L: "on, off, too fast to see" |
| 2 | "Add a 1000 ms wait after each." | Add `delay(1000)` after HIGH and after LOW; Upload. | One second on, one off. Note on the delay block: "delay: hold this step". Rule: "The loop repeats forever, top to bottom." |
| 3 | "Show me the loop." | Tap the loop block (period 2). | A wrong tap shows "setup: runs once". |
| 4 | Predict: "Both waits to 250. The blink gets..." chips "faster", "slower" | Edit both numbers; Upload. | Faster. Note: "250 ms: a quarter second" |
| 5 | "Make a heartbeat: blink, blink, rest." | Waits of 100, 100, 100, 700 with two blinks; Upload. | The lamp beats. Note: "the loop plays your rhythm" |
| 6 | Check: "What is this?" (the loop block glows) chips "the loop", "setup", "a delay" | Pick a chip (period 3). | Answer "the loop". |
| 7 | Check: "Which part runs only once?" chips "setup", "loop" | Pick a chip. | Answer "setup". |
| 8 | Secret: "Secret: blink an S: three quick flashes, then rest." | Optional. | Note: "dot, dot, dot: S" |
| 9 | Fix-it: "This lamp should blink. It stays on. Fix it." | Add a wait after LOW; Upload. | Blinks. Note: "off needs a wait too" |
| 10 | "Case closed. It blinks all by itself." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Too fast to see: `blur` (after an upload, `lab.stats("glow:U1:L", 1)` has mean 0.3 to 0.85 and span below 0.1:
  steady but switching, from `lab.pin("U1", 13)` changing level more than 100 times a second).
- O2 Blink: `one-second` (`Math.abs((lab.blinkPeriod("U1:L") ?? 0) - 2) <= 0.05`), `quarter` (`Math.abs((
  lab.blinkPeriod("U1:L") ?? 0) - 0.5) <= 0.03`).
- O3 Heartbeat: `heartbeat` (`lab.periods("glow:U1:L", 0.3, 6)` alternates near 0.2 s and 0.8 s, each within 10%).
- Secret: `morse-s` (bonus; three flashes with gaps under 0.4 s, then a gap over 0.8 s, seen twice).
- Fix-it: `fix-it` (`lab.blinkPeriod("U1:L") !== null`).

**Checks:** beat 6 "the loop"; beat 7 "setup".

**Notebook page:** "Case 13: The stuck lamp". Sketch: the loop drawn as a circular arrow through four blocks with a
timeline strip of on and off beneath, the heartbeat strip; notes; rule; the beat 4 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Every on and every off needs a wait." Fried: as B12.

**On demand:** beat 2 "Drag a delay block under each pin block." · beat 5 "On 100, off 100, on 100, off 700." · fix-it
"Count the waits. One is missing."

**Words:** main path 120, on demand 38.

---

### B14. `blocks-to-text`: Same blink, in words

- **Minutes** 6 · **Island piece** `header-fence` · **Unlocks** none.
- **Big idea:** Every block is a line of text, and text must be spelled exactly.
- **New:** the text view (tool), and how to read an error's "line:column".
- **Case:** "Same blink, in words". Robot intro: "Open the text view beside the blocks."

**Bench.** U1 on USB running the heartbeat from B13 (13 lines: `setup()` on lines 1 to 3, `loop()` on lines 4 to 13,
two-space indents, the first `digitalWrite` on line 5 and the first `delay(100);` on line 6). The code drawer gains a **Text** tab (CodeMirror 6, lazy-loaded,
NEW R13) that opens beside the blocks; tapping a block highlights its line and the other way round. Fix-it bench: the
heartbeat in text with `Delay(100);` on one line, and Upload refusing.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Open the text view beside the blocks." | Tap Text. | The same program, written out. Note: "same program, in words" |
| 2 | "Tap a block. Its line lights up." | Tap two blocks. | Each lights its line. |
| 3 | "In the text, change 700 to 1500." | Edit the number; Upload. | The block's number changes too; a slower beat. Note: "edit either: both change". Rule: "Blocks and text are one program." |
| 4 | Predict: "Type digitalwrite, small w. Upload will..." chips "still work", "show an error" | Retype the first `digitalWrite` (line 5); tap Upload. | Refused: "5:3 Did you mean digitalWrite?" Note: "capitals matter" |
| 5 | "Fix it. Then delete one semicolon." | Fix the capital; delete the `;` after the first delay; tap Upload. | "6:13 Each step ends with a semicolon." Note: "each step ends with ;" |
| 6 | Check: "An error at 7:15. Where?" chips "line 7, character 15", "line 15, character 7" | Pick a chip. | Answer "line 7, character 15". |
| 7 | "Show me the line with the long wait." | Tap `delay(1500);` in the text (period 2). | |
| 8 | Check: "Text and blocks: same program?" chips "yes, the same", "no, a copy" | Pick a chip (period 3). | Answer "yes, the same". |
| 9 | Secret: "Secret: write yourself a note after two slashes." | Optional: type `// my heartbeat`. | It turns grey; Upload ignores it. Note: "after //, notes for people" |
| 10 | Fix-it: "A friend typed this. Upload refuses. Fix it." | Change `Delay` to `delay`; Upload. | Blinks. Note: "spell it exactly" |
| 11 | "Case closed. You speak blink." | Sign the page. | |

**Objectives** (2 eyes; NEW `lab.code(board)` = `{ view, error, errorsSeen }`, where `error` is `{ line, col, kind }`
or null and `errorsSeen` lists kinds met in this visit. This is the one lab whose goals read the editor, because the
editor is the lesson.)

- O1 One program: `text-view` (`lab.view("code:text")`), `edit-in-text` (a text edit uploaded and `lab.periods(
  "glow:U1:L", 0.3, 8)` now holds a gap near 1.6 s, within 5%).
- O2 Read the errors: `case-error` (`lab.code("U1").errorsSeen.includes("case")`), `semicolon-error` (`...includes(
  "semicolon")`), then the beat 6 check.
- Secret: `comment` (bonus; an upload whose source has a `//` comment).
- Fix-it: `fix-it` (an upload with no error on the fix-it bench and `lab.blinkPeriod("U1:L") !== null`).

**Checks:** beat 6 "line 7, character 15"; beat 8 "yes, the same".

**Notebook page:** "Case 14: Same blink, in words". Blocks on the left, the text on the right, thin ink lines joining
each block to its line; the two error messages stamped with their fixes; notes; rule; the beat 4 guess in blue; secret
box.

**Robot lines:** start = beat 1. Success = beat 11. Hint: "The error names the line. Count from the top." Fried: as
B12.

**On demand:** beat 4 "Change the W to a w, then Upload." · beat 5 "Semicolons sit at the end of a line." · fix-it
"Built-in words start with a small letter."

**Words:** main path 139, on demand 40.

---

### B15. `read-a-button`: Who pressed?

- **Minutes** 7 · **Island piece** `pushbutton` · **Unlocks** none.
- **Big idea:** A pin set as an input can listen. With a pull-up, it reads HIGH when free and LOW when pressed.
- **New:** "input" (a pin that listens) and "pull-up" (the weak tie to 5 V that holds it HIGH), one idea: reading a
  button. Floating inputs and pull-ups are known from Unit 4's logic chips; here the chip has its own.
- **Case:** "Who pressed?". Robot intro: "Press the button. Watch the lamp."

**Bench.** U1 on USB. Half board: S1 (`pushbutton`) across the middle gap, one side jumpered to pin 2, the other to
GND. Pin tags on (NEW V12: a small H or L in ink above each pin in use). Code drawer, blocks, text tab available:

```c
void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}
void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}
```

Fix-it bench: the same, with S1's second side jumpered to 5 V instead of GND.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Press the button. Watch the lamp." | Press and hold S1. | U1:L lights; pin 2's tag shows L. Note on pin 2: "pressed: pin 2 reads LOW" |
| 2 | "Let go." | Release S1. | Dark; the tag shows H. Note on U1: "pull-up holds it HIGH". Rule: "With a pull-up, pressed reads LOW." |
| 3 | "Pin 2 listens: an input." then "Show me the input pin." | Tap pin 2 (period 2). | A wrong tap shows that pin's job ("13: output"). |
| 4 | Predict: "Pull-up off. The free pin reads..." chips "HIGH", "LOW", "anything" | Change `INPUT_PULLUP` to `INPUT`; Upload; hands off. | The lamp flickers at random. Note on pin 2: "nothing holds it: it floats" |
| 5 | "Put the pull-up back." | Change it back; Upload. | Steady and dark. |
| 6 | Check: "Button pressed. Pin 2 reads?" chips "HIGH", "LOW" | Pick a chip. | Answer "LOW". |
| 7 | Check: "What is pin 2 here?" chips "an input", "an output" | Pick a chip (period 3). | Answer "an input". |
| 8 | Secret: "Secret: light the lamp only when NOT pressed." | Optional: change `LOW` to `HIGH` in the test. | Note: "flip the test, flip the lamp" |
| 9 | Fix-it: "The lamp ignores my button. Fix it." | Move S1's jumper from 5 V to GND. | Works. Note: "pull-up buttons go to ground" |
| 10 | "Case closed. The board can listen." | Sign the page. | |

**Objectives** (3 eyes; NEW history source `pin:<board>:<n>` = 1 for HIGH, 0 for LOW)

- O1 Press and release: `press-reads-low` (`lab.closed("S1") && lab.pin("U1", 2).level === "LOW" &&
  lab.isLit("U1:L")`), `release-reads-high` (`!lab.closed("S1") && lab.pin("U1", 2).level === "HIGH" &&
  !lab.isLit("U1:L")`).
- O2 Float it: `float` (`lab.pin("U1", 2).mode === "INPUT"`, S1 released, and `lab.periods("pin:U1:2", 0.5, 2)`
  holding at least three changes), `pull-up-back` (`lab.pin("U1", 2).mode === "INPUT_PULLUP"` and
  `lab.heldFor(1, lab.pin("U1", 2).level === "HIGH")`).
- O3 Name it: the beat 6 and 7 checks.
- Secret: `invert` (bonus; U1:L seen lit with S1 released and dark with S1 pressed, in `lab.memory`).
- Fix-it: `fix-it` (`lab.connected("S1.b1", "U1.GND") && lab.closed("S1") && lab.isLit("U1:L")`).

**Checks:** beat 6 "LOW" (wrong: "The button ties pin 2 to ground, 0 V. That's LOW."); beat 7 "an input".

**Notebook page:** "Case 15: Who pressed?". Sketch: pin 2 with a soft spring drawn up to 5 V (the pull-up) and the
button down to ground; H and L tags for free and pressed; a scribble for floating; notes; rule; the beat 4 guess in
blue; secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Free: HIGH. Pressed: LOW. Watch the tag." Fried: as B12.

**On demand:** beat 4 "Keep your hands off the button." · beat 8 "Swap one word in the if." · fix-it "Where does the
button's other side go?"

**Words:** main path 104, on demand 43.

---

## 7. Module 4: Code that keeps time (`keeping-time`)

Landmark `led-sundial` (NEW). Summary for `module.yaml`: "A button that bounces, a board that blinks and listens at
once, and a die you program yourself."

---

### B16. `count-the-presses`: Five presses, twelve counts

- **Minutes** 7 · **Island piece** `meter-kiosk` · **Unlocks** `serial-monitor`.
- **Big idea:** One press bounces into many; waiting about 50 ms after each change lets the code trust it.
- **New:** the serial monitor (tool: the board's messages to the screen). Contact bounce is known from Unit 4; the
  new idea is fixing it in code.
- **Case:** "Five presses, twelve counts". Robot intro: "This is the serial monitor. Press the button five times."

**Bench.** U1 on USB; S1 from pin 2 to GND (as B15); contact bounce on (Unit 4's seeded chatter, 1 to 10 ms on press
and release, scripted so the first five presses count 12: NEW S11 `bounceScript`). Serial monitor panel (NEW R14) open under the board. Scope SC1 on pin 2 with single shot on a press.
Pins 0 and 1 carry a printed "RX" and "TX" and a note on first view: "0 and 1: the USB serial line". Program (blocks;
text tab available):

```c
int count = 0;
int last = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}
void loop() {
  int now = digitalRead(2);
  if (now != last) {
    if (now == LOW) {
      count++;
      Serial.println(count);
    }
    last = now;
  }
}
```

The palette offers one block: `delay(50);`, which goes inside the `if (now != last)` block. Fix-it bench: the same
program with the wait only inside `if (now == LOW)`, so release bounce still counts.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is the serial monitor. Press the button five times." | Press S1 five times. | The monitor reaches 12. Note on the monitor: "the board talks back here" |
| 2 | Predict: "More counts than presses. Why?" chips "it bounced", "the board's broken", "I pressed twice" | Arm the scope, press once. | Chatter on pin 2. Note on the trace: "one press, many quick touches" |
| 3 | "Add a 50 ms wait after each change." | Drop `delay(50);` inside `if (now != last)`; Upload. | |
| 4 | "Press five times again." | Press S1 five times. | Exactly 5. Note: "wait out the bounce". Rule: "Wait 50 ms, then trust the button." |
| 5 | "Show me the serial monitor." | Tap it (period 2). | |
| 6 | Check: "What is this?" (the monitor glows) chips "the serial monitor", "the scope", "the meter" | Pick a chip (period 3). | Answer "the serial monitor". |
| 7 | Secret: "Secret: try a 1 ms wait." | Optional: change 50 to 1; Upload; press. | Extra counts return. Note: "too short: the bounce outlasts it" |
| 8 | Fix-it: "My counter still adds extras when I let go. Fix it." | Move the wait so it follows every change; Upload. | Five presses, 5. Note: "letting go bounces too" |
| 9 | "Case closed. One press, one count." | Sign the page. | |

**Objectives** (2 eyes; NEW `lab.serial(board)` = the lines printed since the last upload, `lab.presses(id)` = the
learner's real presses of a button since the last upload, not counting bounce)

- O1 See the bounce: `over-count` (`lab.presses("S1") >= 5` and the last line of `lab.serial("U1")` is a number above
  `lab.presses("S1")`), `scope-bounce` (SC1 caught a press with at least 3 edges on pin 2 within 10 ms).
- O2 Count true: `debounce` (after an upload, `lab.presses("S1") >= 5` and the last serial number equals
  `lab.presses("S1")`).
- Secret: `too-short` (bonus; an upload whose program waits under 5 ms after a change, then a serial count above
  `lab.presses("S1")`).
- Fix-it: `fix-it` (`lab.presses("S1") >= 5` and the last serial number equals it on the fix-it bench).

**Checks:** beat 6 "the serial monitor".

**Notebook page:** "Case 16: Five presses, twelve counts". Sketch: the scope's chatter with a 50 ms bracket drawn over
it, the monitor's two columns of numbers (before and after); notes; rule; the beat 2 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Look at one press on the scope." Fried: as B12.

**On demand:** beat 2 "Arm, then press once." · beat 3 "The wait goes right after a change is seen." · fix-it "Does
letting go get a wait too?"

**Words:** main path 107, on demand 31.

---

### B17. `no-waiting`: Blink and listen

- **Minutes** 8 · **Island piece** `pot` · **Unlocks** none.
- **Big idea:** While the board waits in a delay it hears nothing. Checking the clock instead lets it blink and listen
  at once.
- **New:** "millis" (the board's clock: milliseconds since it started).
- **Case:** "Blink and listen". Robot intro: "Tap the button quickly. My second lamp misses it."

**Bench.** U1 on USB, S1 from pin 2 to GND, lamp D7 with 470 Ω on pin 7. A millis readout chip beside the board (NEW
V13: shows `millis()` live; a "jump to day 49" control for the secret). Program (blocks; text tab available):

```c
void setup() {
  pinMode(13, OUTPUT);
  pinMode(7, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
  if (digitalRead(2) == LOW) {
    digitalWrite(7, HIGH);
  } else {
    digitalWrite(7, LOW);
  }
}
```

The palette offers one block, "every 1000 ms", which writes this text (the parser shows the pattern as that block
again; edited out of shape, it falls back to plain `if` blocks):

```c
unsigned long last = 0;
bool lampOn = false;
// inside loop():
  if (millis() - last >= 1000) {
    last = millis();
    lampOn = !lampOn;
    digitalWrite(13, lampOn);
  }
```

Fix-it bench: a lighthouse lamp on pin 13 toggled every 5 s by `if (millis() >= next) { next = millis() + 5000; ... }`,
with the clock started 9 s before `millis()` wraps (2^32 ms, about 49.7 days).

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Tap the button quickly. My second lamp misses it." | Tap S1 (under 0.3 s). | D7 stays dark. Note on a delay block: "stuck in a delay: deaf" |
| 2 | Predict: "Hold the button instead. The lamp lights..." chips "at once", "late" | Hold S1 for 3 s. | Late. Note: "it only looks between waits" |
| 3 | "This is millis: the board's clock. Watch it count." | Tap the millis readout. | Milliseconds ticking up. Note: "milliseconds since the board started" |
| 4 | "Swap both delays for one clock check." | Replace the four blink blocks with "every 1000 ms"; Upload. | U1:L blinks and a tap lights D7 at once. Note: "check the clock, never wait". Rule: "Check the clock instead of waiting." |
| 5 | "Show me the clock check." | Tap `millis() - last >= 1000` (period 2). | |
| 6 | Check: "What is millis?" chips "the board's clock", "a kind of delay", "a pin" | Pick a chip (period 3). | Answer "the board's clock". |
| 7 | Secret: "Secret: jump the clock to day 49." | Optional: tap the jump. | `millis()` rolls over to 0; the blink never misses. Note: "the subtraction survives the wrap" |
| 8 | Fix-it: "My lighthouse goes haywire at day 49. Fix it." | Swap the `next` test for "every 5000 ms"; Upload; jump again. | Steady through the wrap. Note: "subtract, don't add" |
| 9 | "Case closed. Blinking and listening at once." | Sign the page. | |

On the fix-it bench, 4 s before the wrap `millis() + 5000` itself wraps to a small number, so `millis() >= next` is
true on every pass and the lamp flickers half-lit until `millis()` wraps too. The subtraction form is rollover-safe.

**Objectives** (2 eyes; NEW `lab.millis(board)` = the board's 32-bit clock, `lab.event("wrap", board)`)

- O1 A deaf board: `missed-tap` (a press shorter than 0.3 s during which D7 never lit, in `lab.memory`), `late-lamp`
  (a hold where D7 first lit more than 0.3 s after S1 closed).
- O2 Blink and listen: `millis-readout` (`lab.view("millis:U1")`), `blink-and-listen` (`Math.abs((lab.blinkPeriod(
  "U1:L") ?? 0) - 2) <= 0.05` and a press shorter than 0.3 s that lit D7 within 20 ms), then the beat 6 check.
- Secret: `day-49` (bonus; `lab.event("wrap", "U1")` and `lab.periods("pin:U1:13", 0.5, 8)` all within 5% of 2 s).
- Fix-it: `fix-it` (a wrap since the last upload and no period under 4.5 s in `lab.periods("pin:U1:13", 0.5, 20)`).

**Checks:** beat 6 "the board's clock".

**Notebook page:** "Case 17: Blink and listen". Sketch: two timelines, one with long waits and a missed tap, one with
a ticking clock and the tap caught; the wrap drawn as a clock face going from 4,294,967,295 to 0; notes; rule; the
beat 2 guess in blue; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "A delay is a nap. A clock check is a glance." Fried: as
B12.

**On demand:** beat 4 "Drag 'every 1000 ms' over the blink blocks." · beat 7 "The jump button sits under the readout."
· fix-it "Adding to millis can overflow. Subtract instead."

**Words:** main path 118, on demand 41.

---

### B18. `dice-in-code`: Roll in code

- **Minutes** 9 · **Island piece** `dice-block` (NEW, shared with Unit 4) · **Unlocks** none.
- **Big idea:** `random(1, 7)` picks a whole number from 1 to 6, and a few comparisons turn it into pips.
- **New:** "random" (a number the program can't predict).
- **Case:** "Roll in code". Robot intro: "My die stays dark. Press to stop the roll."

**Bench.** U1 on USB. A die board DIE (NEW P9): seven red LEDs in a die layout, each with its own 470 Ω: the centre on
pin 4, one diagonal pair (A) on pin 5, the other diagonal pair (B) on pin 6, the middle pair on pin 7. S1 from pin 2 to
GND with bounce on. Serial monitor open. The auto-tapper (Unit 2) on S1, off. A tally panel (NEW: counts each face the
die stops on). The program arrives built except `showFace()`: it rolls `face = random(1, 7)` every 60 ms with the B17
clock check, prints each roll, and a debounced press (B16) stops or restarts the roll. `showFace()` turns pins 4 to 7
LOW, and the palette offers its four tests one at a time:

```c
void showFace() {
  digitalWrite(4, LOW);
  digitalWrite(5, LOW);
  digitalWrite(6, LOW);
  digitalWrite(7, LOW);
  if (face % 2 == 1) digitalWrite(4, HIGH);
  if (face > 1) digitalWrite(5, HIGH);
  if (face > 3) digitalWrite(6, HIGH);
  if (face == 6) digitalWrite(7, HIGH);
}
```

Fix-it bench: the finished die with `random(1, 6)`, the tapper on, the tally filling with no sixes.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My die stays dark. Press to stop the roll." | Press S1. | The monitor freezes on a number; the lamps stay dark. Note on the monitor: "random: a fresh number each time" |
| 2 | "Light the centre when the number is odd." | Add the odd test; Upload; roll and stop. | The centre lights on 1, 3 and 5. Note on the centre: "odd: centre pip" |
| 3 | "Corner pair A above 1. Pair B above 3." | Add both tests; Upload. | Faces 1 to 5 look right. Note: "bigger number, more corners" |
| 4 | "Middle pair only for a six." | Add the `== 6` test; Upload. | Every face right. Rule: "A few comparisons turn numbers into pips." |
| 5 | "Show me the line that rolls." | Tap `random(1, 7)` (period 2). | |
| 6 | Predict: "Roll sixty times. Sixes will show..." chips "never", "about ten times", "every time" | Switch the tapper on until the tally reaches 60. | Each face about ten times. Note on the tally: "about one in six each" |
| 7 | Check: "random(1, 7) can give..." chips "1 to 6", "1 to 7", "0 to 7" | Pick a chip (period 3). | Answer "1 to 6". |
| 8 | Secret: "Secret: write = instead of == in the six test." | Optional: edit; Upload; roll. | The middle pair is always lit. Note: "= sets, == compares" |
| 9 | Fix-it: "My die never rolls a six. Fix it." | Change `random(1, 6)` to `random(1, 7)`; Upload. | Sixes appear. Note: "the top number is never picked" |
| 10 | "Case closed. A few lines, one fair die." | Sign the page. | The sundial lights; "Beyond: complete". |

**Objectives** (3 eyes; NEW `lab.dieFace(id)` = the face the seven lamps show (1 to 6) or null, `lab.tally(id)` =
counts per face at each stop since the last upload)

- O1 Stop the roll: `stop-roll` (after a press, the last line of `lab.serial("U1")` unchanged for 1 s).
- O2 Light the pips: `odd-centre` (stops on at least one odd and one even face with pin 4 HIGH exactly on the odd one),
  `all-faces` (five stops in a row where `lab.dieFace("DIE")` equals the last serial number).
- O3 Fair rolls: `sixty-rolls` (`lab.tally("DIE")` totals 60 or more and every face appears), then the beat 7 check.
- Secret: `assign-bug` (bonus; an upload with `=` in an `if` test, then a stop with pin 7 HIGH while the last serial
  number is not 6).
- Fix-it: `fix-it` (since the last upload, `lab.tally("DIE")` totals 30 or more and holds at least one 6).

**Checks:** beat 7 "1 to 6" (wrong: "The second number is where it stops, and it's never picked.").

**Notebook page:** "Case 18: Roll in code". The six faces drawn as pips beside the four tests that light them (a small
table: centre odd, A above 1, B above 3, middle at 6); the tally as six ink bars; a mini sketch of Unit 4's chip dice
beside the dozen lines that replaced it; notes; rule; the beat 6 guess in blue; secret box. The unit's last page
carries a "Beyond: complete" stamp.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Roll, stop, read the number, check the pips." Fried: as
B12.

**On demand:** beat 2 "Odd means `face % 2 == 1`." · beat 3 "One test per pair." · fix-it "Watch the tally. Which face
never comes?"

**Words:** main path 129, on demand 44.

---

## 8. NEW NEEDS (simulator, bench and models, runtime, island)

Sizes: S is a few days, M one to two weeks, L more. Everything in `start-here.md` section 6.1 (beats, notes, rules,
checks, objectives, secrets, fix-its, notebook pages, cards) is assumed built.

Already there and used as is: the transient solver with inductor companions (relay coil, speaker), `diode` models
1N4148 and 1N4001, electrolytic polarity and the `reversed` event, the scope with two traces and single shot, the
time control (`key: "speed"`), the auto-tapper, `lab.toneHz`, `lab.blinkPeriod`, `lab.periods`, `lab.stats`,
`lab.timeAbove`, the `speaker-concert-a` trigger, the speaker's audio stream and its free-air high-pass.

### 8.1 Simulator (`packages/sim`)

| Id | Need | Size | Used in |
|---|---|---|---|
| S1 | **`inductor` kind**: henries and series ohms, with the bench working out L from turns, geometry (Wheeler) and core (an effective permeability per material: air, wood and aluminium 1, stainless 304 about 1, steel bolt and iron nail about 50 to 100 as an open core). Reuses the relay's Norton companion. | M | B1, B2, B3, B7, B8 |
| S2 | **Magnetic model** beside the solver (not in the MNA): each coil's field at its tips from turns, current and core, capped where steel saturates; clips lifted from a threshold table; compass needle angle; field lines for the dust view, precomputed per coil shape and scaled and flipped by the live current. | M | B1, B2 |
| S3 | **Moving-magnet induction**: flux through the coil against magnet position (a lookup per coil and magnet, precomputed); EMF = −N × dΦ/dt as a source in series with the coil, from a pointer or device-motion position stream interpolated between solver steps; Lenz drag (force from EMF × current ÷ speed) fed back as the magnet lagging the finger; gravity drop for the upright tube. Calibrated so a brisk hand shake of G1 peaks at about 2 to 4 V. | L | B3, B4, B5 |
| S4 | **`source` kind** for the signal generator: sine, square, DC, AM (carrier, depth, an audio buffer), amplitude, 50 Ω. In the transient solver up to 20 kHz; above that it feeds S5 and S6 only. | M | B6, B8, B9, B10 |
| S5 | **AC sweep**: a small-signal complex solve of the linear netlist at 200 log-spaced frequencies; amplitude at a node; peak finder; a pluck rendered as a damped sine from the peak frequency and Q. | M | B8 |
| S6 | **Envelope-domain radio** (the outline's model): stations with carrier, strength, original audio, day or night reach; the antenna (length to capacitance, about 120 pF for 20 m, and pickup), ground quality (earth, none); each station's level from S5's tank response with antenna capacitance and the earphone's load; a detector on the envelope (germanium or silicon threshold, load impedance); a raw carrier on an earphone or speaker gives silence; audio out with a little static. `lab.radio()`. Nothing runs at radio frequency in real time. | L | B9, B10, B11 |
| S7 | **Germanium signal diode model**: Is about 1 µA, n about 1.5 (about 0.18 V at 0.1 mA, 0.27 V at 1 mA), more reverse leakage than silicon. | S | B10, B11 |
| S8 | **Speaker as a transducer**: cone position from coil current below the cone's resonance (`cone:<id>` history, mm), and the reverse: a tap on the cone injects an EMF pulse in the coil. | M | B6 |
| S9 | **Microcontroller `mcu` kind and bench C interpreter**: 20 pins; an output is 5 V or 0 V behind about 25 Ω; an input is high impedance with an optional 35 kΩ pull-up (datasheet 20 to 50 kΩ); thresholds 1.5 V and 3.0 V at 5 V; a floating input reads noise (Unit 4's model); per-pin current with a warning above 20 mA and damage above 40 mA; an output shorted to ground or to another output is reported; pins 0 and 1 belong to the USB serial link and warn when wired. The interpreter (parser, checker with friendly line:column errors, evaluator) runs in the worker on virtual time: 1 µs per simple statement, 4 µs per pin call, breakpoints at every pin write and every `delay` end, `millis()` as a 32-bit unsigned count with an offset, `random` seeded by learner and lab, `int` wrapping at 16 bits. USB or jack power; the program survives a power cycle. | L | B12 to B18 |
| S10 | **Board extras**: the onboard L lamp on pin 13 behind a buffer (it does not load the pin) and the ON lamp, as internal parts `U1:L` and `U1:ON`. | S | B12 to B18 |
| S11 | **Contact bounce** on pushbuttons (Unit 4's global chatter, 1 to 10 ms on make and break) plus `bounceScript` for a lesson that needs exact counts. | S (M if Unit 4's has not shipped) | B16, B17, B18 |
| S12 | **Slow motion to 0.001**: the time control reaches a thousandth; the LED's eye-persistence filters (30 ms average, 80 ms flash hold) run on wall time in slow motion, so the glow follows the current as it really changes. | S | B7 |

Golden tests to add (no new physics beyond the rows above):

- B1: the crane loop draws 2 to 4 A at first and at least 1.5 A after 2 s; nothing dies within 5 s.
- B3, B4: a calibrated 0.5 m/s stroke through G1 peaks at 2 to 4 V; D1's current stays under 60 mA.
- B5: ten strokes charge C1 to 1.5 to 3.5 V; with the meter on, C1 keeps 95% for 3 s.
- B7: with the core, D1 and D2 each glow above 0.1 for 10 to 40 ms; without it, under half that; no LED above 20 mA.
- B8: 180 µH and 340 pF peak at 643 kHz ± 2%; 144 pF peaks at 990 kHz ± 2%.
- B11: each station in 9.2 is reachable at loudness 0.3 or more with the tap and capacitor listed; none with PP1.
- B12: pin 7 drives D1 through 470 Ω at 5.5 to 7 mA.
- B13: `delay(1000)` twice gives a blink period of 2.000 s ± 0.01 s.
- B16: the scripted bounce gives 12 counts for five presses without the wait and 5 with it.
- B17: the fix-it program flickers within 4.5 s before the wrap; the subtraction version keeps 10 s periods across it.
- B18: `random(1, 7)` returns only 1 to 6 over 10,000 calls, each within 3% of a sixth.
- CI referee: every bench C solution and fix-it program, compiled with the real toolchain and run on avr8js, gives the
  same pin traces and serial lines within 1 ms (section 3.2).

### 8.2 Bench, views, props, 3D and ink models (`packages/bench`)

| Id | Need | Size | Used in |
|---|---|---|---|
| P3 | **Phone shake**: DeviceMotion as the magnet's position stream (asked once, with a calm permission line); drag stays the default. | S | B3 to B5 |
| P6 | **Crane and cores**: a crane prop with a swinging arm whose hook is a coil; a core slot; five rods (steel bolt, iron nail, aluminium, stainless, wood); a dish of paperclips that snap to the tip and drop; a compass. | M | B1, B2 |
| C1 | **`coil` kind**: a parametric coil model (turns, layers, enamel or PVC wire, a former: straw, bolt or a 75 mm bottle with tap loops every 5 turns and a TAP clip); insulated attach spots on the enamel (`coat:`). | M | B1, B2, B8, B11 |
| C2 | **`generator` kind**: a clear tube with a 2,000-turn spool, a neodymium cylinder magnet with N and S marks, a stand that turns the tube upright; spare spools tagged by turns. | M | B3 to B5 |
| C3 | **`inductor` kind**: a big coil on a removable iron core with a handle. | S | B7 |
| V8 | **Dust view**: iron dust drawn as ink field lines around a live coil; fades when the flow stops. | M | B1, B2 |
| V9 | **Speaker explode**: an explode slider and cutaway for about ten parts (frame, surround, cone, dust cap, spider, voice coil and former, top plate, magnet, pole piece, terminals). | M | B6 |
| V10 | **Air rings**: ink rings leaving the cone, spaced by frequency (slowed and labelled so). | S | B6 |
| N1 | **Signal generator**: a desk instrument with a frequency dial (typed or turned), wave switch, amplitude, and an AM panel (song, depth, mute, strong or weak). | M | B6, B8 to B10 |
| C4 | **`tuning-cap` kind**: meshing plates that turn with the knob, 30 to 365 pF. | S | B8, B11 |
| V11 | **Scope additions**: Sweep mode (amplitude against frequency on a log axis, a pencil mark for the generator, an optional target line), a drawing-speed slider for slowed carriers, a blue envelope outline. | M | B8, B9, B10 |
| C5 | **Radio parts**: a germanium diode (glass body), a high-impedance earphone, a pair of 32 Ω earbuds. | S | B10, B11 |
| P8 | **Garden scene**: a shed window with the set on the sill, a tree with a rope insulator, a draggable 20 m antenna wire, a ground stake, a metal water pipe, a plastic drainpipe, a day and night sky. | L | B11 |
| C6 | **`mcu-board` kind**: an original Uno-style board (our own layout and art, no logo or trademark): headers 0 to 13 (0 and 1 printed RX and TX), A0 to A5, GND, 5V, VIN; USB socket, barrel jack, reset button, ON and L lamps, the chip; a USB cable to a laptop prop; a 9 V battery with a barrel plug. | M | B12 to B18 |
| V12 | **Pin tags**: a small H or L in ink over each pin in use. | S | B15 to B18 |
| V13 | **Millis readout**: a live `millis()` chip by the board with a "jump to day 49" control (sets the clock 9 s before the wrap). | S | B17 |
| P9 | **Die board**: seven LEDs in a die layout with their resistors, wired to four header jumpers; a tally panel of six ink bars. | S | B18 |
| P10 | **Card art**: the five `ac-or-dc` items and four `storm` cards for R17's `sort-cards` widget (ink drawings). | S | B4, B11 |

### 8.3 Runtime and lesson player (`apps/web`)

| Id | Need | Size | Used in |
|---|---|---|---|
| R12 | **Code drawer**: a panel under the bench that shows the board's program as ink blocks (about twenty kinds, one per AST node); a per-beat `palette`; drag, drop and tap-to-edit (numbers, HIGH or LOW, pin numbers, conditions); the **Upload** ritual (check, 0.6 s bar, reset); the program saved per lesson. Loaded only by labs with a board. | L | B12 to B18 |
| R13 | **Text view**: CodeMirror 6 (MIT) with bench C highlighting, side by side with the blocks, two-way sync through the AST; one error at a time as "line:column" plus a plain sentence and a "did you mean" for wrong capitals; sugar blocks (the "every N ms" pattern) recognised when the text matches. | M | B14 to B18 |
| R14 | **Serial monitor**: lines with simulated timestamps, autoscroll, last 500 lines; filled by `Serial.print` and `Serial.println`. | S | B16, B18 |
| R15 | **Code in lab files**: `program: { source, palette?, lock? }` on the bench and per beat; solution steps `{ do: "code", replace: { line, text } }`, `{ do: "block", add, after }` and `{ do: "upload" }` so `solutions.test.ts` replays code lessons headlessly with the interpreter. | M | B12 to B18 |
| R16 | **LabView additions** (8.4) and history sources `emf:<coil>`, `cone:<speaker>`, `pin:<board>:<n>`; events `lenz-drag`, `cone-tap`, `rang`, `wrap`. | M | all |
| R17 | **Beat tools and cards**: new `tool` values `siggen`, `code`, `serial`, `millis` and `tally` (still one at a time); a `sort-cards` pop-up widget (items, two trays, a stamp line each; graded all-right-first) for the `ac-or-dc` and `storm` cards. | S | B4, B6 to B18 |

### 8.4 LabView additions (proposal)

| Helper | Returns |
|---|---|
| `lab.lifted(coil)`, `lab.compass(id)`, `lab.core(coil)` | Clips held by a coil's core; compass needle angle in degrees; the core rod in a coil, or null |
| `lab.magnetSpeed(id)`, `lab.magnetPos(id)`, `lab.inside(magnet, coil)` | Magnet speed in m/s; centre position along the tube in mm (0 at the coil's middle); magnet inside the coil |
| `lab.bridge(ids)` | Four diodes form a bridge rectifier (any order) |
| `lab.siggen(id)` | `{ hz, wave, volts, depth, song, on }` |
| `lab.sweep(scope)`, `lab.scope(id)` | The latest sweep `{ done, peakHz, peakVolts }`; the scope's `msPerDiv` and traces shown |
| `lab.radio()`, `lab.antenna(id)`, `lab.ground(terminal)` | `{ station, loudness, audible }` at the listening part; `{ strung }`; `"earth"`, `"none"` or null |
| `lab.pin(board, n)`, `lab.board(id)`, `lab.uploads(board)` | `{ mode, level, volts, mA }`; `{ power }`; uploads since the lab started |
| `lab.code(board)`, `lab.serial(board)`, `lab.millis(board)` | `{ view, error, errorsSeen }`; printed lines since the last upload; the 32-bit clock |
| `lab.presses(button)` | Real presses since the last upload (bounce not counted) |
| `lab.dieFace(id)`, `lab.tally(id)` | The face the die lamps show (1 to 6) or null; counts per face at each stop since the last upload |
| `lab.view(name)` | Adds `"dust"`, `"explode:<id>"`, `"trace:<scope>:<n>"`, `"code:text"`, `"millis:<board>"` to Start here's R10 |

### 8.5 Island, parts and course

| Id | Need | Size |
|---|---|---|
| I1 | `led-sundial` landmark: `LANDMARKS_BY_UNIT.beyond`, `LANDMARK_SPEC`, `messages.ts`, a model (a stone dial ringed by seven LEDs). If it slips, Module 4 folds into Module 3. | M |
| I2 | New pieces `coil-bolt`, `magnet`, `antenna`, `mcu-board`, and `dice-block` (shared with Unit 4): `PIECES`, `PIECE_FOOT`, models. | M |
| I3 | `content/units/beyond/` with `unit.yaml` and four `module.yaml` files; `course.yaml` moves `beyond` from `upcoming` to `units`. | S |
| I4 | `parts.yaml` entries: `coil`, `magnet`, `diode-1n4148`, `signal-generator`, `inductor`, `tuning-capacitor`, `earphone`, `diode-germanium`, `antenna`, `mcu-board`, `serial-monitor` (facts from section 9; the magnet's entry carries the safety facts). | S |

### 8.6 Build order

1. S9, S10, R12, R15 and C6 first: the board and the code drawer carry seven lessons and are the largest risk. Start
   with B12 and B13 on blocks only.
2. R13, R14, S11 and the CI referee (section 3.2) for B14 to B18.
3. S1, S2, C1, P6 and V8 for B1 and B2; then S3, C2 and P3 for B3 to B5.
4. S4, N1, S8, V9, V10 for B6; S12 and C3 for B7.
5. S5, S6, S7, V11, C4, C5 and P8 for the radio module.

---

## 9. Accuracy checklist

A fact-checker confirms each row before content ships. Numbers marked "model" are our simulator's choices, set to
match typical real parts.

### 9.1 Claims

| Lesson | Claim | Value used | Notes |
|---|---|---|---|
| B1 | Current in a coil makes a magnetic field; no current, no field | | A steel core keeps a little leftover magnetism; the clips still drop. |
| B1 | Crane loop current | 9.4 V, 1.7 Ω battery, about 0.3 Ω coil, leads and button: a few amps at first, about 2 A after a couple of seconds | Inductance does not limit steady DC; only resistance does, mostly the battery's own. Keep presses short. |
| B1 | Reversed flow | the field reverses; the compass swings round; soft-iron clips are still pulled | The clip is magnetised the matching way each time. |
| B1 | Field shape | strongest at the coil's ends; lines run from one end round to the other | |
| B1 | A straight wire | a weak circular field; it lifts no clip at these currents | |
| B1 | Enamel | a thin insulating varnish on magnet wire; ends must be scraped bare | |
| B2 | Cores | iron and plain steel gather the field; aluminium and wood do nothing | |
| B2 | Stainless | common grades (304) are barely magnetic; some grades (430) are magnetic | The drawer's rod is a 304 type. Say "most stainless". |
| B2 | Turns | the field grows with turns times current; current barely changes here because the battery limits it | Inductance grows with the square of the turns (parts bin, not taught). |
| B3 | Induction | EMF = −N × dΦ/dt: only a changing flux makes a push; faster motion, more turns or a stronger magnet make more | A parked magnet makes none. |
| B3 | Energy | comes from the work of moving the magnet; the magnet is not used up | |
| B3 | Lenz | a closed coil's current pushes against the motion that made it | |
| B3 | Generator numbers | model: 2,000 turns, about 20 Ω; a 19 mm by 25 mm neodymium magnet; brisk shaking peaks at about 2 to 4 V | An AC meter reads well below the peaks (it shows an RMS of brief pulses). |
| B3, B4 | Red LED | the lowest forward voltage of the common colours, about 1.8 to 2.0 V | Why red flashes first. |
| B4 | Polarity | entering and leaving the coil give opposite pushes; a full pass gives both | |
| B4 | AC and DC | AC changes direction back and forth; DC flows one way | |
| B4 | Card | mains is 230 V at 50 Hz in Europe, the UK and much of the world, 120 V at 60 Hz in North America, and can kill; a bike hub dynamo gives AC (about 6 V); a phone charger's USB end gives 5 V DC | USB fast-charge modes can negotiate higher voltages; 5 V is the default. |
| B5 | Rectifier | one diode passes one half of each cycle (half-wave); a bridge of four passes both halves the same way round, losing two diode drops | 1N4148: about 0.6 to 0.7 V at a few mA. |
| B5 | Holding charge | 1000 µF on a 10 MΩ meter: time constant about 10,000 s, so it holds for minutes | |
| B5 | Lamp from the capacitor | about 2 mA at first through 1 kΩ, fading within a few seconds | |
| B5 | Smoothing | a capacitor after the diode fills the gaps between strokes | Electrolytic stripe to minus. |
| B6 | Speaker | a voice coil in a magnet's ring gap, glued to a cone held by a spider; force on the coil is B × I × l | |
| B6 | Sound | changing current moves the cone, which pushes air; steady current gives one push and silence | |
| B6 | Hearing and pitch | people hear about 20 Hz to 20 kHz; 2 Hz is visible but silent; 440 Hz is concert A | Speed of sound about 343 m/s at 20 °C: 440 Hz has waves about 0.78 m long, 880 Hz about 0.39 m. |
| B6 | Microphone | moving the cone moves the coil in the field and induces a small voltage | |
| B6 | Speaker facts (parts bin) | "8 Ω" is nominal impedance; the DC resistance is about 6 to 7 Ω; only about 1% of the power becomes sound | |
| B7 | Self-inductance | V = L × di/dt: a coil's current cannot jump; it rises and falls with time constant L ÷ R | |
| B7 | Circuit numbers | 9.4 V, 470 Ω, 2 H, 10 Ω: steady 19.6 mA; D1 starts near 16 mA, D2 near 19.6 mA; both under 20 mA | Blinks of about 20 ms with the core, about ten times shorter without (0.2 H). |
| B7 | Mirror image | a capacitor's voltage cannot jump: the lamp across it lights late and fades slowly | |
| B7 | Clamp | a diode across a relay coil, band toward +, carries the coil's current at turn-off and stops the spark | As in Unit 2. |
| B8 | Resonance | f0 = 1 ÷ (2π × √(L × C)); a parallel tank has its highest impedance at f0, so the wanted frequency builds up across it | Not "other frequencies are dumped to ground" alone. |
| B8 | Coil | single-layer Wheeler: 65 turns, 76 mm diameter, 99 mm long, about 180 µH; 50 turns about 129 µH; 30 turns about 64 µH | |
| B8 | Tuning | 180 µH with 340 pF: about 643 kHz; with 144 pF: 990 kHz; more C or more L gives a lower note | |
| B9 | AM | the carrier's height follows the sound; a steady carrier carries no sound | |
| B9 | Band | medium wave: about 530 to 1,700 kHz with 10 kHz steps in the Americas; 531 to 1,602 kHz with 9 kHz steps in Europe and much of the world | 990 kHz is on both grids. |
| B9 | Ratio | a 1 kHz tone on a 990 kHz carrier is about 1,000 carrier waves per wiggle; the scope draws far fewer and says so | AM broadcast audio reaches about 4.5 to 5 kHz. |
| B9 | Overmodulation | past 100% depth the wave pinches to nothing and the sound distorts | |
| B9, B10 | A speaker or earphone on a raw carrier | cannot follow 990 kHz; the pushes average to zero: silence | |
| B10 | Detection | the diode passes one side; the earphone's slowness (and the circuit's capacitance) averages the pulses into the envelope | |
| B10 | Diodes | germanium starts to conduct at about 0.2 to 0.3 V; silicon at about 0.6 to 0.7 V at a milliamp, still higher than germanium at microamps | The note says "about 0.2 V to start". |
| B10 | Earphones | a high-impedance earphone (2,000 Ω or more, or a crystal earpiece) draws almost nothing; 32 Ω earbuds load the circuit and go nearly silent | |
| B11 | Power source | the transmitter's power, caught by the antenna; no battery | |
| B11 | Ground | the earth completes the circuit with the antenna; a plastic pipe is no ground | |
| B11 | Antenna | model: 20 m of wire, about 120 pF to ground, in parallel with C8 | Real values vary, roughly 100 to 300 pF for 15 to 30 m. |
| B11 | Night | medium-wave signals reach much farther at night (sky wave) | |
| B11 | Storm card | never use an outdoor antenna when a storm is near; unclip it and leave the lead outside, away from the house | |
| B12 | Uno-style board | 5 V logic; 14 digital pins (PWM on 3, 5, 6, 9, 10, 11), 6 analog inputs (10-bit), 16 MHz, 32 KB flash, 2 KB SRAM; onboard lamp on pin 13 | The L lamp is driven through a buffer on common boards. |
| B12 | Pin levels | HIGH about 5 V, LOW about 0 V; recommended up to 20 mA per pin, 40 mA absolute maximum | |
| B12 | Lamp current | (5 V − about 1.9 V) ÷ (470 Ω + about 25 Ω) is about 6 mA | |
| B12 | Program storage | the compiled program stays in flash without power and runs at power-up; the source code is never on the chip | Compiled code can be read back with a programmer unless locked. |
| B12 | Barrel jack | 7 to 12 V recommended, centre positive; a 9 V battery is fine | |
| B13 | Program flow | `setup()` runs once; `loop()` runs again and again until power is removed | |
| B13 | No delay | HIGH then LOW with no wait switches far too fast to see; the lamp looks steady and dimmer | |
| B13 | Delay | `delay(1000)` waits 1,000 ms; `delay(250)` a quarter second | |
| B13 | Morse S | three short flashes | |
| B14 | Spelling | names are case-sensitive (`digitalWrite`, `pinMode`, `delay`); each statement ends with a semicolon; `//` starts a comment | |
| B14 | Errors | "line:column" counts lines from 1 and characters from 1 | |
| B15 | Pull-up | `INPUT_PULLUP` turns on an internal pull-up of 20 to 50 kΩ (ATmega328P datasheet); free reads HIGH, pressed to ground reads LOW | |
| B15 | Floating | an input tied to nothing reads unpredictably | |
| B15 | Thresholds | at 5 V: LOW below 1.5 V (0.3 × VCC), HIGH above 3.0 V (0.6 × VCC) | ATmega328P datasheet values. |
| B15 | Fix-it | a pull-up button wired to 5 V never pulls the pin LOW; no harm | |
| B16 | Bounce | mechanical contacts chatter for about 1 to 10 ms on both press and release (sometimes longer) | |
| B16 | Debounce | waiting about 50 ms after a change outlasts the bounce; 1 ms does not | |
| B16 | Serial | `Serial.begin(9600)` starts the link; the monitor shows what the board prints | |
| B16 | Pins 0 and 1 | on Uno-style boards they are the serial lines shared with USB; buttons and lamps go on pins 2 and up | Printed RX and TX on our board. |
| B17 | Clock | `millis()` counts milliseconds since start in an `unsigned long` and wraps after 4,294,967,295 ms, about 49.7 days | |
| B17 | Rollover-safe test | `if (millis() - last >= interval)` stays right across the wrap; `next = millis() + interval` overflows near it | A 16-bit `int` overflows after 32,767 ms. |
| B17 | Delay blocks | during `delay()` the program reads no inputs | Interrupts exist but are not in bench C. |
| B18 | Random | `random(1, 7)` returns 1 to 6 (the upper number is never returned); numbers are pseudo-random, and the press time makes the stop unpredictable | Python's `randint(1, 6)` includes both ends (only if the free-build viewer shows Python). |
| B18 | Face logic | centre when odd; pair A above 1; pair B above 3; middle pair at 6 gives 1 to 6 correctly | Standard pip layout. |
| B18 | Pin load | two LEDs per pin at about 6 mA each, about 12 mA: within 20 mA | |
| B18 | `=` and `==` | `=` assigns, `==` compares; `if (face = 6)` is legal, always true, and changes `face` | Our checker warns, as real compilers often do. |
| B18 | Fairness | 60 rolls: about 10 of each face, with natural spread of about ±3 | |
| all | Safety folds | neodymium magnets pinch, can shatter, and can upset pacemakers, cards and phones; a coil on a battery gets hot; never connect anything to mains | Section 10. |

### 9.2 Radio station tuning (model, B8 and B11)

| Station | Carrier | Strength | TAP (turns, L) | C8 (plus 120 pF antenna) | When |
|---|---|---|---|---|---|
| Sketch Isle Radio | 630 kHz | strong | 65, 180 µH | about 234 pF | day and night |
| Pump House Tunes | 990 kHz | medium | 50, 129 µH | about 80 pF | day and night |
| Meter Tower Weather | 1,440 kHz | weak | 30, 64 µH | about 71 pF | day and night |
| Far Shore Radio | 810 kHz | far | 65, 180 µH | about 95 pF | night only |

All four carriers sit on both the 9 kHz and 10 kHz grids. Station names and audio are original.

---

## 10. Notes for authors and for the rest of the course

- **Achievements (suggested).** `crane-operator` ("Lift ten clips with a coil", 10 XP, on `iron-core/steel-core`),
  `voices-from-the-air` ("Find all three stations", 25 XP, on `crystal-radio/three-stations`), `fair-roller` ("Roll
  sixty times in code", 25 XP, on `dice-in-code/sixty-rolls`), `night-owl` (hidden, "Hear the far station at night",
  on `crystal-radio/night-listening`), and `islands-think` ("Complete all 18 lessons of Beyond", 50 XP).
- **Bonus list for Beyond:** `straight-wire`, `more-turns`, `feel-the-drag`, `drop-through`, `bridge`, `microphone`,
  `capacitor-mirror`, `pluck`, `overmodulate`, `earbuds`, `night-listening`, `keeps-program`, `morse-s`, `comment`,
  `invert`, `too-short`, `day-49`, `assign-bug`.
- **Hall of Fried Parts.** Nothing dies on purpose. Accidental deaths: a board pin driven past 40 mA (an LED with no
  resistor), an electrolytic put in backwards (B5 fix-it), a diode forwards across a relay coil (B7 fix-it).
- **Try it for real.** Optional notebook folds, 40 words at most, outside the budget. B1, B2: a bolt, a few metres of
  magnet wire, a 9 V battery, paperclips ("Press briefly: the coil is nearly a short, and it gets hot."). B3 to B5: a
  neodymium magnet and a home-wound spool ("Neodymium magnets pinch hard, can shatter, and can upset pacemakers, cards
  and phones."). B6: an old speaker to take apart ("Cut away from your hands."). B11: a germanium diode, a crystal
  earpiece, a bottle coil and a long wire ("Never use an outdoor antenna when a storm is near."). B12 to B18: any
  Uno-style board and a USB cable ("Wire with the USB unplugged. Never put more than 5 V on a pin.").
- **Words that change meaning.** "Loop" means a closed circuit in Start here and the repeating block from B13. The robot
  says so once in B13 ("This loop repeats. Not a circuit loop."), as an on-demand line.
- **Dropped from the outline.** `plan-before-code` (the plan-first habit lives in B18's build order: pips are added one
  test at a time), `same-dice-new-language` (an optional free-build viewer later: blocks, bench C and Python side by
  side; Python's `randint(1, 6)` includes both ends), the transformer card (parts bin facts for `inductor`), the
  LM386 amplifier for the radio (a later unit).
- **Writing.** Robot lines at most 12 words, notes at most 6, rules at most 8, chips at most 4 (the schema in
  `apps/web/src/content/schema.ts` enforces them). Recount each lesson's
  main path (every quoted string in its beats table, plus its card) after any edit. Never import wording from
  `.private/`.
