# Unit 4, Chips: blueprint

Status: build sheet for Unit 4 (`chips`) in the bench-first lesson format of `docs/curriculum/start-here.md`, under
`docs/DESIGN-PRINCIPLES.md`. It replaces the Unit 4 outline in `docs/curriculum/later-units.md` (what changed is listed
in section 10). Content authors turn each lesson into a lab file (`content/labs/<id>.ts`) plus a thin `lesson.yaml`.
Text in double quotes is final learner-facing copy. Anything marked **NEW** goes beyond today's contracts
(`docs/ARCHITECTURE.md`, `docs/LABS.md`, `apps/web/src/lab/define.ts`, `packages/sim/src/types.ts`) and is collected
in section 8. The Start here runtime needs (its section 6.1, R1 to R11: beats, notes, rules, checks, objectives,
secrets, fix-its, notebook pages, cards, `lab.view`) are assumed built.

All content is original. Facts come from datasheets, standard physics and the research notes; no wording, titles,
figures or project names are taken from any book. Follow `docs/CONTENT.md`: no em dashes, no emoji, units with a
space, conventional current.

The simulator models this unit needs are in `packages/sim` (`timer555` with a CMOS option, `logic` for the 74HC parts,
the 74HC393 and the 4026B, `sevenseg`, `regulator7805`, contact `bounce`, the `proximity` input). Numbers below were
checked against those models' README; section 8.5 lists what the unit still needs from the simulator.

---

## 1. How a Chips lesson works

Chips lessons use `start-here.md` section 1 unchanged: a short run of beats (a robot line, one action, the bench's
answer), the three-period lesson, control of error in the bench, a mission of 2 to 4 objectives that fill the robot's
eyes, one optional secret, a relaxed fix-it round, at most one pop-up card, a self-filling notebook page signed "Case
closed", and the budgets of `conversion-guide.md` A3 (main path under 150 words, on demand under 60, robot lines at
most 12 words, notes at most 6, rules at most 8). Words are counted the same way: every quoted string in a lesson's
beats table. What is new here:

- **Pins are words.** Every 555 pin gets its own three periods: a note on the pin at the moment it does its job
  (period 1), a "Show me" tap on the chip, where a wrong tap shows that pin's own number and, once named, its name
  (period 2), and a "What is pin N?" chip check (period 3). Two pins that work as a pair (the way in and the way out,
  the watcher and the drain) share a lesson; the others get one each.
- **The 555 map.** A notebook page that fills itself across CH1 to CH10: a large DIP-8 with eight empty name tags and,
  beside it, the chip's insides drawn as blank paper. Each named pin inks its tag and the part of the inside it uses
  (section 2.4). CH10 stamps it complete: the learner has drawn the whole 555, one pin at a time.
- **The chip x-ray** (NEW CP1) shows the inside of the real chip on the bench, live, but only the blocks the map holds
  so far. The learner never sees a block before meeting its pin.
- **Numbers earn their place.** Three lessons are about a formula and carry a "type a number" check: CH5 (glow time
  1.1 × R × C), CH8 (the astable's pitch) and CH24 (binary place values). Elsewhere numbers live in notes and chips.
- **Games stay relaxed.** The reaction race (CH16) and the quiz buzzer (CH23) are games. Their objectives need a round
  or two, scores live only in the notebook, and the robot opponent never hurries the learner.
- **Lamps never load logic.** Wherever a logic signal also feeds another gate, its lamp hangs on a spare gate used as
  a buffer (a 74HC08 gate with both inputs joined). Benches show these as locked "lamp drivers" (section 2.3).

**Voice.** As in Start here: the cheeky-but-kind robot, one playful line in four, never cheeky about a mistake. Notes
on parts are terse field notes in lower case.

---

## 2. Unit overview

- **Unit id:** `chips` · **Shown name:** Chips · **Placed after** `permanent` (Unit 3).
- **Island:** Silicon Isle: a dense town of black chip blocks with silver pin fences, a factory, a lighthouse, a
  billboard of glowing digits, a castle of gates and an arcade.
- **Lessons:** 26, 6 to 9 minutes each, about 176 minutes. Wave 1 ships 21 lessons (about 136 minutes); wave 2 adds
  CH11, CH12, CH16, CH23 and CH26 once the door props, plug-in modules, the timing diagram and the histogram exist.
- **Story glue:** the robot finds that one black block does the work of its whole transistor blinker. It names every
  pin of that block, then builds a lighthouse that blinks, sings and guards the door, a billboard that counts, a
  castle whose gates think, and an arcade with fair dice for the islanders. The unit ends with the arcade lighting up
  and a radio mast blinking on the far horizon (Beyond).
- **Prerequisites:** Units 2 and 3. Used as known: switches in series, the relay and its diode, a capacitor filling
  through a resistor, "in line, a capacitor passes changes only", the transistor switch, the trimmer, the speaker,
  Hz, the scope (with single-shot capture), the stopwatch, the 9 V adapter. Soldering is needed only for the optional
  "Try it for real" folds.
- **Order of ideas:** the chip and its pin numbers; the one-shot, one pin pair at a time (trigger and output, the
  pull-up, threshold and discharge, the formula, reset and the latch); the 555 that never rests, its pitch, its duty
  cycle and its control pin; the door alarm built only from parts already met; then digits, counting, carrying and
  gating a clock; then a steady 5 V, gates and their tables, the bubble, a requirement turned into gates, memory from
  feedback, and bounce; then games: lockout, binary, modulus and dice.

### 2.1 Modules and landmarks

| Module | Id | Lessons | Landmark id | Landmark name | Reveal caption | Robot line |
|---|---|---|---|---|---|---|
| M1 The 555 timer | `timer-555` | CH1 to CH6 | `timer-factory` | The Timer Factory | "Eight legs, endless timing. The factory never misses a beat." | "Eight pins, every one named. The factory runs on time." |
| M2 The lighthouse | `alarm` | CH7 to CH12 | `alarm-lighthouse` (NEW) | The Alarm Lighthouse | "Its lamp sleeps until a door opens. Then the whole island knows." | "It blinks, it sings, it guards. Sleep well, island." |
| M3 Counters and displays | `counters` | CH13 to CH16 | `counter-billboard` | The Counter Billboard | "Digits roll across the billboard, one clock tick at a time." | "My billboard counts milliseconds. Faster than my fingers." |
| M4 Logic | `logic` | CH17 to CH22 | `logic-castle` | The Logic Castle | "Every gate in the castle answers only yes or no." | "The castle thinks in highs and lows now." |
| M5 The arcade | `arcade` | CH23 to CH26 | `dice-arcade` | The Dice Arcade | "Fair rolls guaranteed: thirty-six pairs, equal time." | "A buzzer, two fair dice, and a full arcade." |

Summaries for `module.yaml`: `timer-555` "One black chip, eight pins, and what each one does." · `alarm` "A lighthouse
that blinks, sings, bends its note and guards the door." · `counters` "Seven bars, a counter, a carry and a
millisecond race." · `logic` "Five steady volts, gates and their tables, a chord lock and a memory." · `arcade` "A
quiz buzzer, lamps that count in binary, a die that stops at six, and two fair dice."

`alarm-lighthouse` is a new landmark; the other four are in the isle catalog already. When wave 2 has not shipped, M2
ends on CH10 and M3 on CH15 (the landmark lands on the module's last shipped lesson), and M5 starts at CH24.

### 2.2 Lesson list

| # | Lesson id | Case title | Min | Wave | One big idea | New word or part | Island piece | Parts unlocked |
|---|---|---|---|---|---|---|---|---|
| CH1 | `meet-the-chips` | Pin 1 by the notch | 6 | 1 | Pins count from the notch, round the chip; plus to pin 8, minus to pin 1 | chip (555); pins 1, 8 | `chip-block` (NEW) | `ic-555` |
| CH2 | `one-shot` | One tap, one glow | 6 | 1 | A dip on pin 2 starts one glow of fixed length on pin 3 | pins 2, 3 | `capacitor` | none |
| CH3 | `ghost-press` | The ghost press | 6 | 1 | A floating input reads noise; a pull-up holds it high | pull-up | `resistor` | none |
| CH4 | `two-thirds-full` | Two thirds full | 7 | 1 | The glow ends when the capacitor fills to two thirds | pins 6, 7 | `header-fence` | none |
| CH5 | `dial-a-delay` | Dial a delay | 7 | 1 | The glow lasts about 1.1 × R × C | (the formula) | `pot` | none |
| CH6 | `set-and-clear` | Set and clear | 6 | 1 | Trigger sets, reset clears, and reset beats everything | pin 4; latch | `battery` | none |
| CH7 | `blink-forever` | It never rests | 6 | 1 | Pin 2 on the capacitor: the 555 retriggers itself forever | astable | `transistor` | none |
| CH8 | `sing-a-note` | Tune to A | 7 | 1 | Pitch ≈ 1.44 ÷ ((R1 + 2 × R2) × C) | (the formula) | `speaker` | none |
| CH9 | `short-and-sweet` | Short flash, long gap | 7 | 1 | Filling takes R1 and R2, emptying only R2; a diode skips R2 | duty cycle | `diode` | `diode-1n4148` |
| CH10 | `bend-the-pitch` | Bend the note | 6 | 1 | Pin 5 is the 2/3 line: higher on pin 5, lower note | pin 5 | `ceramic-cap` | none |
| CH11 | `door-left-open` | The door left open | 7 | 2 | A held trigger keeps the timer on; a capacitor makes a dip | reed switch | `reed-gate` (NEW) | `reed-switch` |
| CH12 | `armed-and-ready` | Exit, wait, alarm | 9 | 2 | Each timer's end starts the next | none | `wire-spool` | none |
| CH13 | `seven-segments` | Eight lights make a digit | 6 | 1 | Seven bars make every digit | seven-segment display | `seven-seg` (NEW) | `seven-segment`, `dip-switch` |
| CH14 | `count-the-ticks` | One tick, one step | 7 | 1 | A counter steps once per rising edge | counter (4026B); clock | `test-lead-arch` | `counter-4026b` |
| CH15 | `carry-the-one` | Carry the one | 6 | 1 | Each rollover clocks the next digit | carry out | `jumper-arch` | none |
| CH16 | `reaction-race` | Reaction race | 9 | 2 | Block the clock to stop the count | inhibit | `meter-kiosk` | none |
| CH17 | `five-volts-exactly` | Five volts, exactly | 6 | 1 | A regulator holds 5 V steady when fed 7 V or more | regulator (7805) | `regulator` (NEW) | `regulator-7805` |
| CH18 | `gatekeepers` | Both keys or either | 7 | 1 | A truth table lists a gate's every answer; the chip decides the rule | gate chip; AND, OR, truth table | `logic-chip` (NEW) | `logic-gates` |
| CH19 | `flip-the-answer` | The bubble flips it | 6 | 1 | A bubble flips a gate's answer: NAND, NOR | logic probe | `breadboard-patch` | `logic-probe` |
| CH20 | `chord-lock` | Chord lock | 8 | 1 | Flip a key's pull and "none pressed" becomes an AND | none | `relay` | none |
| CH21 | `two-gates-remember` | Two gates that remember | 6 | 1 | Two gates fed back to each other remember | feedback | `switch` | none |
| CH22 | `chatter` | One press, many counts | 7 | 1 | Contacts bounce; a latch takes only the first touch | bounce | `pushbutton` | none |
| CH23 | `first-buzzer-wins` | First buzzer wins | 7 | 2 | The winner, fed back, locks the others out | none | `fuse` | `ic-555-cmos` |
| CH24 | `count-in-binary` | Count in lamps | 7 | 1 | Each lamp is worth double the one before | binary counter (74HC393); binary | `led-lamp` | `counter-74hc393` |
| CH25 | `roll-a-six` | Stop at six | 6 | 1 | Reset on a pattern sets what a counter counts to | none | `dice-block` (NEW) | none |
| CH26 | `binary-dice` | Pips from bits | 8 | 2 | A few gates turn a count into any pattern | none | `cell-jar` | `ic-socket` |

Totals: 176 minutes (wave 1: 136). Every id is checked unique against Start here, Units 1 to 3 and Unit 5's outline.
Kept from the outline: `meet-the-chips`, `one-shot`, `seven-segments`, `carry-the-one`, `reaction-race`,
`five-volts-exactly`, `gatekeepers`, `chord-lock`, `first-buzzer-wins`, `count-in-binary`, `roll-a-six`,
`binary-dice`. No Unit 4 lesson exists yet, so nothing has progress to migrate.

### 2.3 Standard bench (unless a lesson says otherwise)

| Name | Bench part | Netlist | Notes |
|---|---|---|---|
| Bench battery `B1` | `battery` 9 V on the near rails (`at: "rails"`) | `battery` emf 9.4, internalOhms 1.7, mAh 500 | Unit 3's 9 V adapter (`supply`) may replace it; no goal depends on which. |
| 555 `U1` | `chip` model "555" (NEW CB1), across the channel, notch to the left | `timer555` | Bipolar. A "555-cmos" (`cmos: true`) wherever a 555 feeds 74HC logic (CH22 on). |
| Pin 5 capacitor | `ceramic-cap` 10 nF ("103"), pin 5 to − | `capacitor` | Everywhere except CH10. |
| Trigger pull-up | `resistor` 10 kΩ, pin 2 to + | `resistor` | 100 kΩ where a capacitor feeds pin 2 (CH11, CH12). |
| Lamp on pin 3 | `resistor` 1 kΩ and red `led` (maxmA 20) to − | | About 6 mA: pin 3 sits about 1.4 V under the supply. |
| Timing capacitors | `electrolytic-cap`, `tolerance: 0.05` where a note quotes a time | `capacitor` | Goals always compare with times computed from the parts' actual values (`lab.actual`), never the nominal ones. |
| Logic rail (CH17 on) | `regulator` 7805 (NEW CB3) at the left end, 0.33 µF in, 0.1 µF out, feeding the far rails | `regulator7805` | Near rails 9.4 V, far rails (`top+`, `top-`) 5 V, minus joined. 100 µF across each pair. |
| Logic inputs | `pushbutton` to +5 V with a 10 kΩ pull-down | | Unused gate inputs tied to −. |
| Logic lamps | red `led` with 1 kΩ to − | | About 3 mA. Only on outputs that feed nothing else; otherwise through a lamp driver (a 74HC08 gate, inputs joined). |
| Displays | `seven-seg` (NEW CB2), common cathode | `sevenseg` | On a carrier with a resistor per segment from CH14: 3.3 kΩ at 9.4 V (about 2 mA), 1 kΩ at 5 V (about 1.6 mA). |

Benches settle for 5 simulated seconds before beat 1, so any switch-on pulse of a 555 has ended. Contact `bounce` is
off on every bench except CH22's. No part dies on purpose in this unit except in CH5's fix-it (if the knob reaches
zero before the fix) and CH17's secret (a gate chip on 9 V).

Helpers shared by these labs go in `content/labs/lib/chips.ts`: `blinking(lab, led)` (at least two flashes in 5 s from
`lab.periods("glow:<led>", 0.3, 5)`), `oneShotT(lab, r, c)` (1.1 × actual R × actual C), `runNear(lab, t, tol)` (a
stopwatch run within `tol` of `t`), `duty(lab, node)` (from NEW `lab.widths` and `lab.periods`), `reading(lab, ids)`
(digits read off displays, most significant first), `face(lab, pips)` (the die face the pip glows show), `count(lab,
chip)` (`extra.count` or `extra.count1`) and `pin(lab, chip, name)` (a logic pin's `extra` level).

### 2.4 The 555 map

| Lesson | Pins named (three periods) | Inside, as the x-ray and the map draw it |
|---|---|---|
| CH1 | 1 (minus), 8 (plus) | the two supply rails |
| CH2 | 2 (trigger), 3 (output) | the low watcher with its 1/3 line, an inside switch (not yet named), the output stage |
| CH4 | 6 (threshold), 7 (discharge) | the high watcher with its 2/3 line, the drain switch from pin 7 to minus |
| CH6 | 4 (reset) | the reset line straight into the inside switch, now named the latch |
| CH10 | 5 (control) | the ladder of three equal resistors that makes the 1/3 and 2/3 lines, pin 5 on its upper tap; stamped complete |

CH3, CH5 and CH7 to CH9 use the map as it stands. The watchers are the datasheet's comparators and the latch its
flip-flop; those names go on the parts-bin card, not in the lessons.

### 2.5 How each lesson is written below

As in `start-here.md` 2.4: **Case**, **Bench**, **Beats** (copy in quotes; "Do" is the one action; "Bench answers"
is the note, rule or check), **Objectives** (task ids and their goals as `LabView` code, NEW helpers marked), **Checks**
(every graded check with its answer), **Secret**, **Fix-it bench**, **Notebook**, **Robot lines**, **On demand**, and
two more lines: **Accuracy** (the claims and values a fact-checker confirms for this lesson; unit-wide facts are in
section 9) and **Words** (main path, on demand).

---

## 3. Module 1: The 555 timer (`timer-555`)

Landmark `timer-factory`. One chip, met pin by pin. By the end of the module the 555 map holds every pin but pin 5.

---

### CH1. `meet-the-chips`: Pin 1 by the notch

- **Minutes** 6 · **Wave** 1 · **Island piece** `chip-block` (NEW) · **Unlocks** `ic-555`.
- **Big idea:** A chip's pins count from the notch, round the chip; the 555 takes plus on pin 8 and minus on pin 1.
- **New:** the chip (part: the 555, an 8-pin DIP); pin 1 and pin 8, the first two tags on the 555 map.
- **Case:** "Pin 1 by the notch". Robot intro (beat 1): "One black block replaces my whole blinker. Drop it in."

**Bench.** Half board; B1 on the near rails. A 555 blinker wired round an empty ink outline that straddles the channel
at columns 12 to 15, with a half-moon notch drawn at its left end (so pin 1 is hole e12, pins 1 to 4 run along row e,
pins 5 to 8 come back along row f, pin 8 at f12). R1 10 kΩ (+ to the pin 7 strip), R2 68 kΩ (pin 7 to pin 6 strips),
C1 10 µF (pin 6 strip to −), jumpers pin 2 to pin 6, pin 4 to +, pin 8 to +, pin 1 to −, C2 10 nF (pin 5 to −), R3
1 kΩ and D1 (red) from the pin 3 strip to −. All locked. Tray: U1 (`chip` model "555"). Shelf (secret): U9, an
8-leg surface-mount lookalike (`package: "soic"`). Chip x-ray (NEW CP1) offered from beat 4. Fix-it bench: the same
blinker with U2 sitting in rows b and e (pins 1 to 4 in row e, pins 8 to 5 in row b), all on one side of the channel.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "One black block replaces my whole blinker. Drop it in." | Drop U1 on the outline. | Notch to the drawn notch: D1 blinks about once a second. Note on U1: "chip: a whole circuit inside" |
| 2 | "Find the dot by the notch. Tap it." | Tap pin 1. | A 1 inks beside it. Note: "pin 1: by the dot" |
| 3 | "Now count round. Tap pins 1 to 8." | Tap the pins in order (a wrong tap shows that pin's own number). | Numbers ink on; an arrow runs round the chip. Rule: "Pins count from the notch, round the chip." |
| 4 | "Plus goes to pin 8, minus to pin 1. Tap the x-ray." | Open the chip x-ray. | Two rails drawn inside; the rest is blank paper. Note on pins 8 and 1: "pin 8 plus, pin 1 minus" |
| 5 | Predict: "Turn the chip round. My blinker will..." chips "keep blinking", "go dark" | Rotate U1 a half turn. | Dark, chip cool. Note: "turned round: wrong pins, all dark" |
| 6 | "Turn it back. Then show me the pin for plus." | Rotate U1 back; tap pin 8 (period 2). | Blinking again. |
| 7 | Check: "Which pin is this?" (pin 6 glows) chips "3", "6", "7" | Pick a chip. | Answer "6". |
| 8 | Check: "What does pin 1 take?" chips "minus", "plus", "the lamp" | Pick a chip (period 3). | Answer "minus". |
| 9 | Secret: "Secret: try the tiny chip on the shelf." | Optional: drop U9 on the board. | It will not seat. Note: "surface mount: legs too close" |
| 10 | Fix-it: "My second blinker is dark. Fix it." | Move U2 across the channel. | Blinks. Note: "across the gap: each pin alone" |
| 11 | "Case closed. Eight legs, one blinker." | Sign the page. | Stamp; pins 1 and 8 inked on the 555 map. |

**Objectives** (3 eyes)

- O1 Seat it: `drop-the-chip` (`lab.chipSeat("U1")?.straddles && lab.chipSeat("U1")?.pin1 === "left" &&
  blinking(lab, "D1")`; NEW `lab.chipSeat`, CR3).
- O2 Count round: `pin-one` (beat 2 tap on `U1.1`), `count-round` (beat 3 taps `U1.1` to `U1.8` in order; NEW CR1).
- O3 Power pins: `xray-on` (`lab.view("xray:U1")`), `turn-it-round` (`lab.chipSeat("U1")?.turned &&
  lab.heldFor(1, (lab.part("D1")?.glow ?? 1) < 0.05) && lab.part("U1")?.health === "ok"`), `turn-it-back` (O1's goal
  again, after `turn-it-round`).
- Secret: `too-small` (bonus; `lab.bench.rejected.includes("U9")`, NEW CR10).
- Fix-it: `fix-it` (fix-it bench; `lab.chipSeat("U2")?.straddles && blinking(lab, "D2")`).

**Checks:** beat 7 "6"; beat 8 "minus". Beats 2, 3 and 6 are taps: a wrong tap shows that pin's number, ungraded.

**Notebook page:** "Chips 1: Pin 1 by the notch". Sketch: the DIP-8 from above with its notch, dot and the arrow
through 1 to 8; the blinker beside it. The 555 map page opens with pins 1 and 8 inked. Notes, rule, the beat 5 guess
in blue, the fix-it tick; secret box (the tiny chip beside a row of holes).

**Robot lines:** start = beat 1. Success = beat 11. Hint: "Notch to the drawn notch. Pin 1 sits by the dot." Fried
(only if a learner wires plus to pin 1 by hand): "Hot chip. Plus met pin 1. Fresh one in."

**On demand:** beat 1 "Match the half-moon notch to the drawing." · beat 3 "Along the near side, back along the far
side." · fix-it "Each pin needs its own strip. Straddle the gap."

**Accuracy:** DIP-8: pin 1 by the notch and dot, numbers run counterclockwise seen from above; 2.54 mm pitch, rows
7.62 mm (0.3 in) apart, so it straddles the channel. 555 pins: 1 ground, 2 trigger, 3 output, 4 reset, 5 control,
6 threshold, 7 discharge, 8 supply (4.5 to 16 V bipolar). Blinker: 1.44 ÷ ((10 kΩ + 2 × 68 kΩ) × 10 µF) ≈ 0.99 Hz.
Turned round on this bench, pin 8 still lands on plus (the pin 4 hole) but pin 1 lands on the 10 nF and pin 5 on
minus, so the chip has under 3 V across it and stays dark with no damage (golden test, CS6). On one side of the
channel pins 1 and 8 share a strip with minus: unpowered, no harm. A surface-mount part's 1.27 mm pitch cannot enter
2.54 mm holes.

**Words:** main path 139, on demand 45.

---

### CH2. `one-shot`: One tap, one glow

- **Minutes** 6 · **Wave** 1 · **Island piece** `capacitor` · **Unlocks** none.
- **Big idea:** A dip on pin 2 starts one glow on pin 3, and the glow lasts the same time however long the tap.
- **New:** pin 2 (trigger) and pin 3 (output), a pair: the way in and the way out.
- **Case:** "One tap, one glow". Robot intro: "Tap my button once. Time the glow."

**Bench.** Half board, B1. U1 (555) seated and locked as in CH1. One-shot: R1 270 kΩ from + to pins 6 and 7
(joined), C1 10 µF (`tolerance: 0.05`) to −; pin 2 with R2 10 kΩ to + and S1 (pushbutton) to −; pin 4 to +; C2
10 nF on pin 5; R3 1 kΩ and D1 on pin 3. Stopwatch ST1 (known): starts on `{ part: "S1", pressed: true }`, stops on
`{ part: "D1", lit: false }` (NEW trigger, CR7). Chip x-ray with pins 1 and 8 drawn; this lesson inks the low watcher
and its 1/3 line, the inside switch and the output stage. Fix-it bench: a second one-shot whose R4 and D2 run from the
pin 1 strip to −, so both lamp ends sit on minus.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Tap my button once. Time the glow." | Tap S1. | D1 glows; ST1 reads about 3.0 s. Note on D1: "one tap: three seconds" |
| 2 | Predict: "Now hold it one second. The glow lasts..." chips "1 second", "3 seconds" | Hold S1 for about 1 s. | 3.0 s again. Note on ST1: "short or long: same glow". Rule: "One dip in, one fixed glow out." |
| 3 | "Open the x-ray. Tap again." | X-ray on; tap S1. | Pin 2 dips under the 1/3 line, its watcher lights, a switch inside flips on, pin 3 goes high. Note on pin 2: "pin 2: trigger, dips start it" |
| 4 | (no line) | | Note on pin 3: "pin 3: output, the glow leaves" |
| 5 | "Show me the output." | Tap pin 3 (period 2). | A wrong tap shows that pin's name or number. |
| 6 | Check: "What is pin 2?" chips "trigger", "output", "plus" | Pick a chip (period 3). | Answer "trigger". |
| 7 | Secret: "Secret: tap twice, fast." | Optional: two taps inside one glow. | Still one glow of 3.0 s. Note: "taps mid-glow: ignored" |
| 8 | Fix-it: "My second lamp never lights. Fix it." | Move R4's end from the pin 1 strip to the pin 3 strip. | Tap: it glows. Note: "lamps hang on pin 3" |
| 9 | "Case closed. One tap, one glow." | Sign the page. | Pins 2 and 3 inked on the map. |

**Objectives** (3 eyes)

- O1 Tap: `one-glow` (`runNear(lab, oneShotT(lab, "R1", "C1"), 0.08)`).
- O2 Hold: `hold-one-second` (a press of 0.6 to 2.0 s, from NEW history `closed:S1` (CR6), and the run that began
  with it within 8% of `oneShotT`).
- O3 Look inside: `xray-trigger` (`lab.view("xray:U1")`, and while it is on `lab.part("U1")?.extra?.trigger === true`
  once, kept in `lab.memory`).
- Secret: `double-tap` (bonus; two presses while `extra.output === "high"`, and that run within 8% of `oneShotT`).
- Fix-it: `fix-it` (`lab.joins("R4", "U2.3", "D2.anode")` and `lab.isLit("D2")` after a press).

**Checks:** beat 6 "trigger".

**Notebook page:** "Chips 2: One tap, one glow". Sketch: two press marks of different lengths under two equal glow
bars. Notes, rule, the beat 2 guess, the fix-it tick, secret box. Map: pins 2 and 3.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Watch the stopwatch. Tap, then let go." Fried (only if pin 3
is wired straight to minus or plus): "Pin 3 hit a rail head on. Fresh chip in."

**On demand:** beat 2 "Hold for about one second, then let go." · beat 3 "The x-ray button sits on the chip." · fix-it
"Which pin is the output?"

**Accuracy:** T = 1.1 × 270 kΩ × 10 µF = 2.97 s (exactly ln 3 × R × C = 2.966 s: the capacitor fills from empty to
2/3). The trigger fires below 1/3 of the supply (3.1 V of 9.4 V). Pin 3 high sits about 1.4 V under the supply
(bipolar output stage), so D1 carries about 6 mA through 1 kΩ. Taps during the glow do nothing once released (a 555
one-shot does not restart). The 10 nF on pin 5 keeps noise off the 2/3 line. A 10 µF electrolytic leaks about 10 MΩ
in the model, which lengthens this glow by about 2%.

**Words:** main path 89, on demand 37.

---

### CH3. `ghost-press`: The ghost press

- **Minutes** 6 · **Wave** 1 · **Island piece** `resistor` · **Unlocks** none.
- **Big idea:** An input connected to nothing floats and picks up noise; a pull-up resistor holds it high until the
  button pulls it low.
- **New:** the word "pull-up" (and "floats", what happens without one).
- **Case:** "The ghost press". Robot intro: "Pull the 10 kΩ off pin 2. Then wave nearby."

**Bench.** CH2's one-shot; R2 (the 10 kΩ pull-up) unlocked. Hand control HAND (NEW CR9): an ink hand the learner drags
toward U1, proximity 0 to 1. Scope (known), one trace on U1.2 with the 1/3 line drawn (NEW CP2). Tray: R5 1 MΩ. Fix-it
bench: a second one-shot whose pull-up R6 runs from pin 2 to the − rail.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Pull the 10 kΩ off pin 2. Then wave nearby." | Lift R2 into the tray; drag the hand near U1. | D1 flickers on by itself. Note on pin 2: "nothing holds it: it floats" |
| 2 | "Look at pin 2 on the scope." | Watch the trace. | It wanders and hums across the 1/3 line, more with the hand close. Note: "floating: it picks up hum" |
| 3 | Predict: "Put the 10 kΩ back. The ghost will..." chips "stay", "vanish" | Plug R2 back, pin 2 to plus. | Flat at 9.4 V, hand or no hand. Note on R2: "pull-up: holds pin 2 high". Rule: "Never leave an input floating." |
| 4 | "Now press the button." | Tap S1. | One clean glow. |
| 5 | "Show me the pull-up." | Tap R2 (period 2). | |
| 6 | Check: "What is this?" (R2 glows) chips "a pull-up", "a trigger", "a timer" | Pick a chip (period 3). | Answer "a pull-up". |
| 7 | Secret: "Secret: swap in the 1 MΩ. Wave again." | Optional: R5 in place of R2, hand close. | Still steady. Note: "even a weak pull beats hum" |
| 8 | Fix-it: "My other timer glows and never stops. Fix it." | Move R6's top end from the − rail to the + rail. | Dark until tapped. Note: "a pull-up goes to plus" |
| 9 | "Case closed. No more ghosts in my timer." | Sign the page. | |

**Objectives** (2 eyes)

- O1 Meet the ghost: `ghost` (R2 off the board, `lab.control("hand") >= 0.5`, S1 never pressed since, and
  `lab.timeAbove("glow:D1", 0.3, 10) > 0.2`), `hum` (`lab.stats("volts:U1.2", 2).span >= 3`).
- O2 Hold it high: `pull-up-back` (`lab.joins("R2", "U1.2", "rail+")` and `lab.heldFor(3, lab.control("hand") >= 0.5
  && (lab.part("D1")?.glow ?? 1) < 0.05)`), `clean-tap` (then a run within 8% of `oneShotT`).
- Secret: `weak-pull` (bonus; R5 joins U1.2 to +, hand at 0.8 or more, D1 dark held 3 s).
- Fix-it: `fix-it` (R6 joins U2.2 to +; D2 dark held 2 s, then lit after a press).

**Checks:** beat 6 "a pull-up".

**Notebook page:** "Chips 3: The ghost press". Sketch: pin 2 drawn twice, once with a wavy floating line and a hand,
once tied up to plus by a resistor. Notes, rule, the beat 3 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "A pin needs something holding it. Plus, through a resistor."
Fried: none possible: "Nothing broke. The ghost only scares lamps."

**On demand:** beat 1 "Drag the hand right up to the chip." · beat 3 "One leg in pin 2's strip, one on plus." · fix-it
"Which rail should a pull-up reach?"

**Accuracy:** An input connected to nothing has no defined level; on a 555 trigger it drifts and picks up mains hum
(50 Hz in the model; 60 Hz in some countries), so the timer fires at random, worse with a hand close. With the 10 kΩ
pull-up the pin sits at the supply and draws 0.94 mA to minus while the button is held. A 1 MΩ pull-up still holds a
555 trigger (a real bipolar trigger input draws well under 1 µA; the model draws none), though long wires make weak
pulls easier to disturb. Pull-ups go to plus; pull-downs to minus.

**Words:** main path 102, on demand 40.

---

### CH4. `two-thirds-full`: Two thirds full

- **Minutes** 7 · **Wave** 1 · **Island piece** `header-fence` · **Unlocks** none.
- **Big idea:** The glow ends when the timing capacitor fills to two thirds of the supply: pin 6 watches the climb and
  pin 7 empties the capacitor.
- **New:** pin 6 (threshold) and pin 7 (discharge), a pair: the watcher and the drain.
- **Case:** "Two thirds full". Robot intro: "Why three seconds? Tap, and watch the scope."

**Bench.** CH2's one-shot with its pull-up. Scope: trace 1 volts U1.6 (the capacitor), trace 2 volts U1.3, window 6 s,
range 0 to 10 V, lines at 1/3 and 2/3 of U1.8 (NEW CP2). Chip x-ray; this lesson inks the high watcher with its 2/3
line and the drain switch. Fix-it bench: a second one-shot, U2 with R7 270 kΩ and C3 10 µF, whose pin 6 jumper runs to the − rail; pin 7
alone meets the capacitor.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Why three seconds? Tap, and watch the scope." | Tap S1. | Trace 1 climbs, then drops to 0 V at once; trace 2 falls at the same moment. Note on trace 1: "climbs to 6.3 V, then empties" |
| 2 | Check: "The supply is 9.4 V. Where does the climb stop?" chips "3.1 V", "4.7 V", "6.3 V" | Pick a chip. | Answer "6.3 V". Rule: "The glow ends at two thirds full." |
| 3 | "Open the x-ray. Tap once more." | X-ray on; tap S1. | As the climb meets the 2/3 line, pin 6's watcher lights and the inside switch flips off. Note on pin 6: "pin 6: threshold, watches the climb" |
| 4 | Predict: "Next, pin 7 will..." chips "empty the capacitor", "fill it" | Watch. | A drain switch closes from pin 7 to minus; trace 1 drops. Note on pin 7: "pin 7: discharge, empties it" |
| 5 | "Show me the pin that empties it." | Tap pin 7 (period 2). | |
| 6 | Check: "What is pin 6?" chips "threshold", "discharge", "trigger" | Pick a chip (period 3). | Answer "threshold". |
| 7 | Secret: "Secret: hold the button through the whole climb." | Optional: hold S1 for 5 s. | The glow lasts while held; both watchers lit. Note: "a held trigger beats the threshold" |
| 8 | Fix-it: "My glow never ends. Fix it." | Move pin 6's jumper from − to the capacitor. | A 3 s glow. Note: "pin 6 must see the capacitor" |
| 9 | "Case closed. Two thirds full, every time." | Sign the page. | Pins 6 and 7 inked on the map. |

**Objectives** (3 eyes)

- O1 Watch the climb: `watch-climb` (after a press, `lab.stats("volts:U1.6", 5).max` between 6.0 and 6.5 V and the
  latest value below 0.3 V).
- O2 Threshold: beat 2 check; `xray-threshold` (x-ray on and `lab.part("U1")?.extra?.threshold === true` seen).
- O3 Discharge: `xray-discharge` (x-ray on, `extra.discharge === true` and `lab.volts("U1.6") < 0.2`).
- Secret: `hold-to-stretch` (bonus; S1 held 4 s or more with D1 lit throughout, and `extra.threshold &&
  extra.trigger` seen together).
- Fix-it: `fix-it` (`lab.connected("U2.6", "C3.pos")` and a run within 8% of `oneShotT(lab, "R7", "C3")`).

**Checks:** beat 2 "6.3 V"; beat 6 "threshold".

**Notebook page:** "Chips 4: Two thirds full". Sketch: the capacitor's ramp against the 1/3 and 2/3 lines with the
output's glow bar beneath; the drain switch drawn as a little lever from pin 7 to minus. Notes, rule, the beat 4 guess,
fix-it tick, secret box. Map: pins 6 and 7, the high watcher, the drain.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Follow trace 1 up to the dashed 2/3 line." Fried: none
expected: "Nothing hurt. Just a long glow."

**On demand:** beat 2 "Two thirds of 9.4 is about 6.3." · beat 3 "Watch where the climb meets the top line." · fix-it
"Which pin watches the capacitor?"

**Accuracy:** Threshold at 2/3 of the supply: 6.27 V at 9.4 V; trigger line at 1/3: 3.13 V. From empty to 2/3 takes
R × C × ln 3 ≈ 1.1 × R × C. Pin 7 is a transistor to minus (about 12 Ω in the model) that turns on when the glow
ends and empties the capacitor. While the trigger is held below 1/3 the output stays high even past the threshold
(datasheet priority: reset over trigger over threshold). In the fix-it fault the capacitor charges toward 9.4 V, never
meets pin 6, and the glow never ends.

**Words:** main path 113, on demand 35.

---

### CH5. `dial-a-delay`: Dial a delay

- **Minutes** 7 · **Wave** 1 · **Island piece** `pot` · **Unlocks** none.
- **Big idea:** The glow lasts about 1.1 × R × C.
- **New:** the formula (the trimmer is known from Unit 2).
- **Case:** "Dial a delay". Robot intro: "Turn the knob up, then tap."

**Bench.** The one-shot with R1 10 kΩ plus RV1 500 kΩ trimmer (wiper and one end; knob control `knob`) in series
from + to pins 6 and 7; C1 10 µF (default 20% tolerance: each learner's knob setting differs); stopwatch ST1 as in
CH2. Tray: C2 22 µF. Shelf (secret): B2, a 6 V pack (four AA in a holder, NEW CB9). Fix-it bench: a second one-shot, U2,
whose RV2 (500 kΩ, knob control `knob2`) runs straight from + to pins 6 and 7 with C3 10 µF, knob at mid; tray: R6
10 kΩ and a spare 555.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Turn the knob up, then tap." | Turn RV1 up; tap S1. | A longer glow on ST1. Note on RV1: "more ohms, longer glow" |
| 2 | Predict: "Swap 10 µF for 22 µF. The glow..." chips "about doubles", "stays the same", "halves" | Swap C1 for C2; tap. | About 2.2 times longer. Note on C2: "more C, longer glow too". Rule: "Glow ≈ 1.1 × R × C" |
| 3 | Check: "47 kΩ and 10 µF glow for about..." chips "0.05 s", "0.52 s", "5.2 s" | Pick a chip. | Answer "0.52 s". |
| 4 | Check: "With 10 µF, which R gives 2.0 s? Type kΩ." | Type a number. | Answer 182 (173 to 191 accepted). |
| 5 | "Put the 10 µF back. Dial in two seconds exactly." | Swap back; turn, tap, read; repeat. | A run between 1.9 and 2.1 s. Note on ST1: "2.0 s, by design" |
| 6 | Secret: "Secret: run it on the 6 V pack. Time it." | Optional: B2 in place of B1; tap. | Still about 2.0 s. Note: "the time ignores the supply" |
| 7 | Fix-it: "Make my knob safe at zero, then turn it down." | Put R6 in series with RV2; knob to zero; tap. | A blink of about 0.1 s, chip cool. Note: "10 kΩ keeps pin 7 alive". Rule: "Keep 10 kΩ between pin 7 and plus." |
| 8 | "Case closed. Two seconds, made to order." | Sign the page. | |

Control of error on the fix-it: turned to zero before the fix, U2 smokes on its first discharge and goes to the Hall of
Fried Parts; "Replace part" and the spare are there.

**Objectives** (3 eyes)

- O1 Knob and C: `longer-glow` (`lab.control("knob")` up by 0.2 or more, and a run at least 1.5 × the first run),
  `bigger-c` (`lab.joins("C2", "U1.6", "rail-")`, and a run at least 1.6 × the last run with C1 at the same knob).
- O2 The law: beat 3 and beat 4 checks.
- O3 Two seconds: `two-seconds` (C1 back; a run of 1.9 to 2.1 s).
- Secret: `six-volts` (bonus; `lab.volts("U1.8", "U1.1")` 5.8 to 6.6 V and a run of 1.85 to 2.15 s).
- Fix-it: `fix-it` (a fixed resistor of 1 kΩ or more in series with RV2 between + and U2.7, `lab.control("knob2") <=
  0.02`, `lab.part("U2")?.health === "ok"`, a run within 15% of `oneShotT(lab, "R6", "C3")`).

**Checks:** beat 3 "0.52 s"; beat 4 182 kΩ (tolerance 5%).

**Notebook page:** "Chips 5: Dial a delay". The formula written large, with the learner's own runs beside it (knob up,
22 µF, 2.0 s). Notes, rules, the beat 2 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "1.1 × R × 10 µF = 2 s. Solve for R." Fried: "Pop. Pin 7
met plus with nothing between. Fresh chip in."

**On demand:** beat 4 "2 ÷ (1.1 × 0.00001) ohms. Then in kΩ." · beat 5 "Too long? Turn the knob down a little." · fix-it
"Fix first, turn second."

**Accuracy:** 1.1 × 47 kΩ × 10 µF = 0.517 s. R for 2.0 s with 10 µF: 2.0 ÷ (1.1 × 10 µF) = 182 kΩ (a standard
180 kΩ gives 1.98 s). Knob range 1.1 × 10 kΩ × 10 µF = 0.11 s to 1.1 × 510 kΩ × 10 µF = 5.6 s. 22 µF gives 2.2
times. Electrolytics spread by up to ±20%, so the stopwatch, not the knob's position, is the judge. Both lines are
fractions of the supply, so 6.3 V and 9.4 V give the same time within a few percent (the lamp is dimmer on 6 V). With
no resistance between plus and pin 7, the discharge transistor shorts the supply when it turns on (the model's limit
is 50 mA; the chip dies on the first discharge). Keep at least 1 kΩ; 10 kΩ is the usual safe minimum.

**Words:** main path 119, on demand 39.

---

### CH6. `set-and-clear`: Set and clear

- **Minutes** 6 · **Wave** 1 · **Island piece** `battery` · **Unlocks** none.
- **Big idea:** With pin 6 tied to minus and no timing parts, the 555 remembers: a dip on pin 2 sets it, a low on pin
  4 clears it, and reset beats everything.
- **New:** pin 4 (reset); the word "latch" for the inside switch (periods 1 and 2 here; period 3 in CH21).
- **Case:** "Set and clear". Robot intro: "Press SET. Then let go, and wait."

**Bench.** U1 with pin 6 to −, pin 7 open, C2 10 nF on pin 5; pin 2 with R2 10 kΩ to + and S1 "SET" to −; pin 4 with
R4 10 kΩ to + and S2 "CLEAR" to −; R3 and D1 on pin 3. B1 joins the board through clip lead TL1 (for the secret).
Chip x-ray; this lesson inks the reset line and names the latch. Fix-it bench: the same latch with pin 6 jumpered to
+ instead of −.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Press SET. Then let go, and wait." | Tap S1; wait. | D1 stays lit. Note on D1: "no timing parts: it stays on" |
| 2 | "Now press CLEAR." | Tap S2. | Dark. Note on pin 4: "pin 4: reset, low clears it" |
| 3 | "Open the x-ray. SET, then CLEAR." | X-ray on; tap S1, then S2. | The inside switch flips on, stays, flips off. Note on it: "latch: it remembers on or off" |
| 4 | Predict: "Hold both buttons. The lamp will..." chips "light", "stay dark" | Hold S1 and S2. | Dark. Rule: "Reset beats everything." |
| 5 | "Show me the pin that clears it." | Tap pin 4 (period 2). | |
| 6 | Check: "What is pin 4?" chips "reset", "trigger", "threshold" | Pick a chip (period 3). | Answer "reset". |
| 7 | "Show me what remembers." | Tap the latch in the x-ray (period 2 for latch). | |
| 8 | Secret: "Secret: SET it, then unclip the battery and clip it back." | Optional: unclip and reclip TL1. | On or off, by chance. Note: "power back: a coin toss" |
| 9 | Fix-it: "My latch only glows while I hold SET. Fix it." | Move pin 6's jumper from + to −. | It stays on. Note: "pin 6 high: cleared at once" |
| 10 | "Case closed. A timer that remembers." | Sign the page. | Pin 4 and the latch inked on the map. |

**Objectives** (3 eyes)

- O1 Set: `stays-on` (S1 released, then `lab.heldFor(5, lab.isLit("D1"))`).
- O2 Clear: `clear-it` (S2 pressed and D1 dark).
- O3 Both: `reset-wins` (S1 and S2 closed together, D1 dark held 1 s).
- Secret: `power-back` (bonus; TL1 unclipped while D1 was lit, then reclipped; NEW CS8 checks that the state is lost).
- Fix-it: `fix-it` (`lab.connected("U2.6", "rail-")`; after S1 is released, D2 lit for 3 s).

**Checks:** beat 6 "reset".

**Notebook page:** "Chips 6: Set and clear". Sketch: SET and CLEAR buttons on either side of a latch drawn as a little
see-saw with a dot; the both-buttons case crossed out in favour of CLEAR. Notes, rule, the beat 4 guess, fix-it tick,
secret box. Map: pin 4 and the latch.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "SET dips pin 2. CLEAR pulls pin 4 low." Fried: none
expected: "No harm done. It just forgot."

**On demand:** beat 3 "Tap SET, then CLEAR, and watch the switch inside." · beat 4 "Hold both at the same time." ·
fix-it "Where should pin 6 sit so it never clears?"

**Accuracy:** With pin 6 at minus the threshold never fires; a trigger below 1/3 sets the latch; reset below about
0.7 V (datasheets: 0.4 to 1 V) clears it and overrides the trigger. Releasing CLEAR while SET is still held turns it on.
At switch-on a 555's latch starts in an unpredictable state (the model: set 60% of the time, seeded per power-up), so
the secret is honestly a coin toss. In the fix-it fault pin 6 sits above 2/3, so the latch clears the moment the
trigger lets go. Pin 7 is unused here.

**Words:** main path 103, on demand 39.

---

## 4. Module 2: The lighthouse (`alarm`)

Landmark `alarm-lighthouse` (NEW). The 555 that never rests, its voice, its beam and its control pin; then a door
guard built only from what the learner already knows. CH10 completes the 555 map.

---

### CH7. `blink-forever`: It never rests

- **Minutes** 6 · **Wave** 1 · **Island piece** `transistor` · **Unlocks** none.
- **Big idea:** Join pin 2 to the capacitor and the 555 triggers itself every time it empties: it blinks forever.
- **New:** the word "astable" (a 555 that never rests).
- **Case:** "It never rests". Robot intro: "My lighthouse needs a blinker. Move pin 2's jumper onto pin 6."

**Bench.** Half board, B1. U1 with R1 10 kΩ (+ to pin 7), R2 68 kΩ (pin 7 to pin 6), C1 10 µF (`tolerance: 0.05`,
pin 6 to −), pin 4 to +, C2 10 nF on pin 5, R3 and D1 on pin 3; pin 2 parked on + by jumper W1 (no pull-up, no
button). Beside it U2, CH2's one-shot, untouched and unlabelled (for period 2). Scope on U1.6 with the 1/3 and 2/3
lines, window 4 s. Tray: C3 22 µF; R9 1 kΩ and D9 (red) for the secret. Fix-it bench: the same blinker with C4 0.1 µF
("104") where the 10 µF belongs.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My lighthouse needs a blinker. Move pin 2's jumper onto pin 6." | Move W1's end from the + rail to pin 6's strip. | D1 blinks by itself, about once a second. Note on W1: "astable: it triggers itself" |
| 2 | "Open the x-ray. Watch the capacitor swing." | X-ray on. | The trace climbs to the 2/3 line, sinks to the 1/3 line, climbs again; the watchers take turns. Note on the trace: "up to 2/3, down to 1/3". Rule: "Pin 2 on the capacitor: it never rests." |
| 3 | Predict: "Swap in the 22 µF. The blink will..." chips "slow down", "speed up" | Swap C1 for C3. | About half as fast. Note on C3: "bigger C, slower blink" |
| 4 | "Put the 10 µF back. Then show me the astable." | Swap back; tap U1, not U2 (period 2). | A wrong tap on U2 shows "one-shot". |
| 5 | Check: "What is this?" (U1 glows) chips "an astable", "a one-shot", "a latch" | Pick a chip (period 3). | Answer "an astable". |
| 6 | Secret: "Secret: hang a second lamp from plus to pin 3." | Optional: R9 and D9 from + to pin 3, long leg toward plus. | The two lamps take turns. Note: "pin 3 pushes and pulls" |
| 7 | Fix-it: "My lighthouse lamp glows, but never blinks. Fix it." | Swap C4 (104) for the 10 µF. | Blinks. Note: "0.1 µF: too fast to see" |
| 8 | "Case closed. My lighthouse never sleeps." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Blink forever: `blink-forever` (`lab.connected("U1.2", "U1.6") && lab.periods("glow:D1", 0.3, 6).length >= 3`).
- O2 The swing: `xray-swing` (x-ray on; `lab.stats("volts:U1.6", 4)` min 2.9 to 3.4 V and max 6.0 to 6.5 V).
- O3 Slower: `bigger-c` (C3 in; mean of `lab.periods("glow:D1", 0.3, 10)` 1.8 to 2.6 times the period measured with
  C1).
- Secret: `two-lamps` (bonus; D9 between + and U1.3 through R9, `lab.periods("glow:D9", 0.3, 6).length >= 2`).
- Fix-it: `fix-it` (on the fix-it bench, a 10 µF between U1.6 and −; flash period 0.8 to 1.25 s).

**Checks:** beat 5 "an astable".

**Notebook page:** "Chips 7: It never rests". Sketch: the capacitor's saw-tooth between the 1/3 and 2/3 lines, the
lamp's flashes above it, the jumper from pin 2 to pin 6 circled. Notes, rule, the beat 3 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Pin 2 must sit on the capacitor's strip." Fried: none
expected: "Nothing hurt. It just blinks."

**On demand:** beat 1 "Lift the jumper's plus end, drop it in pin 6's strip." · beat 4 "The one that blinks by itself."
· fix-it "Read the capacitor's code: 104 is 0.1 µF."

**Accuracy:** f = 1.44 ÷ ((10 kΩ + 2 × 68 kΩ) × 10 µF) ≈ 0.99 Hz; high 0.693 × 78 kΩ × 10 µF ≈ 0.54 s, low
0.693 × 68 kΩ × 10 µF ≈ 0.47 s. The capacitor swings between 1/3 and 2/3 of the supply (3.1 V and 6.3 V); the first
flash after switch-on is longer (from empty: about 0.86 s). With 22 µF about 0.45 Hz; with 0.1 µF about 99 Hz, which
the eye sees as steady. An astable has no pull-up on pin 2 (it would feed the capacitor and fight the discharge through
R2). Pin 3 sources when high and sinks when low: a lamp from plus to pin 3 lights while pin 3 is low; when pin 3 is
high only about 1.4 V is left across it, too little to light.

**Words:** main path 111, on demand 38.

---

### CH8. `sing-a-note`: Tune to A

- **Minutes** 7 · **Wave** 1 · **Island piece** `speaker` · **Unlocks** none.
- **Big idea:** R1, R2 and C set the pitch: about 1.44 ÷ ((R1 + 2 × R2) × C).
- **New:** the formula (speaker, Hz and capacitor codes are known from Unit 2).
- **Case:** "Tune to A". Robot intro: "My lighthouse needs a voice. Turn the knob."

**Bench.** Half board, B1. U1 astable: R1 10 kΩ; R2 made of R2a 10 kΩ plus RV1 50 kΩ trimmer (wiper and one end);
C1 47 nF ("473"); pins 2 and 6 joined; pin 3 → R3 100 Ω → C3 100 µF (+ toward pin 3) → SP1 8 Ω speaker → −. Scope
with `pitch: "SP1"` (the pitch readout). Tray: C4 4.7 nF ("472"). Fix-it bench: the same singer with a 4.7 nF where
the 47 nF belongs; the tray holds a 47 nF.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My lighthouse needs a voice. Turn the knob." | Turn RV1 slowly. | The note slides; the pitch readout follows. Note on RV1: "more ohms, lower note" |
| 2 | Predict: "Swap in the 4.7 nF. The note will..." chips "jump up", "drop down" | Swap C1 for C4. | About ten times higher. Note on C4: "tenth the C: ten times higher". Rule: "Pitch ≈ 1.44 ÷ ((R1 + 2 × R2) × C)" |
| 3 | "Put the 47 nF back. Knob all the way down." | Swap back; RV1 to zero. | About 1 kHz. |
| 4 | Check: "R1 10 kΩ, R2 10 kΩ, 47 nF. Pitch in Hz?" | Type a number. | Answer 1021 (970 to 1070 accepted). Note on the readout: "the formula lands close" |
| 5 | "Now tune it to A: 440 Hz." | Turn RV1 until the readout holds 440 Hz. | Note: "440 Hz: the note A" |
| 6 | Secret: "Secret: find the A one octave up." | Optional: tune to 880 Hz. | Note: "double the pitch: an octave" |
| 7 | Fix-it: "My lighthouse squeaks like a mouse. Fix it." | Swap the 4.7 nF (472) for the 47 nF (473). | About 440 Hz. Note: "472 is 4.7 nF; 473, 47" |
| 8 | "Case closed. My lighthouse sings A." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Slide: `slide-the-note` (the pitch spans 300 Hz or more in `lab.toneHistory(10)` while RV1 moves).
- O2 Ten times: `tenth-c` (C4 in; `lab.toneHz("SP1")` at least 5 times the pitch logged just before the swap).
- O3 Tune: beat 4 check; `tune-a` (C1 in; `Math.abs((lab.toneHz("SP1") ?? 0) - 440) <= 9` held 1 s).
- Secret: `octave` (bonus; 880 ± 18 Hz held 1 s).
- Fix-it: `fix-it` (on the fix-it bench, a 47 nF between U1.6 and −; pitch 380 to 500 Hz).

**Checks:** beat 4, 1021 Hz (tolerance 5%).

**Notebook page:** "Chips 8: Tune to A". The formula written large with the learner's numbers in it; a little stave
with A marked at 440 Hz (and 880 Hz if found). Notes, rule, the beat 2 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Turn slowly. The readout catches up." Fried (only if the
100 Ω is bypassed and the output is overloaded): "My voice box overheated. Keep the 100 Ω in."

**On demand:** beat 4 "1.44 ÷ (30,000 × 0.000000047)." · beat 5 "Too high? Turn toward more ohms." · fix-it "Which code
means 47 nF?"

**Accuracy:** The pitch formula comes from high time 0.693 × (R1 + R2) × C plus low time 0.693 × R2 × C (1 ÷ 0.693 ≈
1.44). R2 = 10 kΩ: 1.44 ÷ (30 kΩ × 47 nF) = 1021 Hz; R2 = 60 kΩ: 236 Hz. A4 = 440 Hz needs R2 ≈ 29.8 kΩ (the knob near
19.8 kΩ); 880 Hz needs R2 ≈ 12.4 kΩ. 47 nF ceramics are ±10%, so knob positions differ; 4.7 nF gives ten times the
pitch (about 4.4 kHz at the A setting). The 100 Ω keeps the output's peaks near 8 V ÷ 108 Ω ≈ 74 mA (a bipolar 555 is
good for about 200 mA); the 100 µF passes the changes and blocks the steady part. A bipolar 555 runs up to a few
hundred kHz, not millions of cycles a second.

**Words:** main path 105, on demand 28.

---

### CH9. `short-and-sweet`: Short flash, long gap

- **Minutes** 7 · **Wave** 1 · **Island piece** `diode` · **Unlocks** `diode-1n4148`.
- **Big idea:** The capacitor fills through R1 and R2 but empties through R2 alone, so the flash is always the longer
  part; a diode across R2 lets it fill past R2, and the flash gets short.
- **New:** the words "duty cycle" (the share of each cycle spent on). The 1N4148 is a known part (a diode, Unit 2) in
  a small glass body; the robot calls it "this small diode".
- **Case:** "Short flash, long gap". Robot intro: "My beam stays on too long. Turn R2's knob."

**Bench.** Half board, B1. U1 astable: R1 10 kΩ; R2 made of R2a 4.7 kΩ plus RV1 100 kΩ trimmer (wiper and one end);
C1 10 µF (`tolerance: 0.05`); pins 2 and 6 joined; R3 and D1 on pin 3. Scope on U1.3 with a duty readout (high, low,
duty; NEW CP2). Chip x-ray. Tray: D2 (1N4148). Fix-it bench: D2 across R1 with its band toward the + rail.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My beam stays on too long. Turn R2's knob." | Turn RV1 through its range. | Faster or slower, but the readout never drops under 52%. Note on the readout: "duty cycle: the share spent on" |
| 2 | Predict: "Could any knob setting make the flash the shorter part?" chips "yes", "no" | Open the x-ray; watch one cycle. | Filling runs through R1 and R2, emptying only through R2. No. Note on R2: "fills through both, empties through one" |
| 3 | "Clip this small diode across R2, band toward pin 6." | Place D2: anode at pin 7's strip, band at pin 6's. | Short flashes, long gaps. Note on D2: "fills past R2: short flash". Rule: "A diode across R2 shortens the flash." |
| 4 | "Now get the duty cycle under 25%." | Turn RV1 up. | Under 25% (about 10% at the top of the knob). |
| 5 | "Show me the duty cycle." | Tap the duty on the readout (period 2). | |
| 6 | Check: "Flash 0.1 s, gap 0.3 s. Duty cycle?" chips "25%", "33%", "75%" | Pick a chip (period 3). | Answer "25%". |
| 7 | Secret: "Secret: with the diode in, make an even blink." | Optional: turn RV1 to about 6.7 kΩ. | 50%. Note: "R2 just over R1: even" |
| 8 | Fix-it: "My diode does nothing. Fix it." | Move D2 from across R1 to across R2, band toward pin 6. | Short flashes. Note: "across R2, band to pin 6" |
| 9 | "Case closed. Short and sweet." | Sign the page. | |

**Objectives** (3 eyes)

- O1 The floor: `try-the-knob` (RV1 moved over 0.6 or more of its travel; every duty sample above 0.5, from
  `duty(lab, "U1.3")`, NEW `lab.widths` CR4).
- O2 The diode: `diode-in` (`lab.joins("D2", "U1.7", "U1.6", "forward")` and duty below 0.45).
- O3 Under 25%: `under-25` (duty below 0.25 over three cycles).
- Secret: `even-blink` (bonus; diode in, duty 0.47 to 0.53).
- Fix-it: `fix-it` (on the fix-it bench, D2 joins U1.7 to U1.6 forward; duty below 0.4).

**Checks:** beat 6 "25%".

**Notebook page:** "Chips 9: Short flash, long gap". Two square waves: before (long highs) and after the diode (short
highs), each with its duty written in; the filling and emptying paths drawn as arrows round R1, R2 and D2. Notes,
rule, the beat 2 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "The band marks the end toward pin 6." Fried: none expected:
"Nothing hurt. Just a lazy beam."

**On demand:** beat 2 "Watch which resistors the filling passes." · beat 3 "Anode on pin 7's side, band on pin 6's." ·
fix-it "Which resistor should the diode skip?"

**Accuracy:** Without the diode, duty = (R1 + R2) ÷ (R1 + 2 × R2): 76% at R2 = 4.7 kΩ down to 52% at 104.7 kΩ, never
50% or below while R1 is above zero. With the diode, high ≈ R1 × C × ln((Vs − Vd − Vs/3) ÷ (Vs − Vd − 2Vs/3)) ≈
0.079 s for 10 kΩ, 10 µF, 9.4 V and Vd ≈ 0.54 V, a little over 0.693 × R1 × C because the diode's drop lowers what
the capacitor charges toward (the model measures the same effect); low = 0.693 × R2 × C. Duty about 10% at the top of
the knob, 25% at R2 ≈ 34 kΩ, 50% at R2 ≈ 11.4 kΩ (knob about 6.7 kΩ). 1N4148: a small glass signal diode, band at the
cathode, about 100 V and 200 mA. Across R1 with its band toward plus it never conducts (the fix-it fault is harmless).
With the diode in, the timing shifts slightly with the supply.

**Words:** main path 110, on demand 35.

---

### CH10. `bend-the-pitch`: Bend the note

- **Minutes** 6 · **Wave** 1 · **Island piece** `ceramic-cap` · **Unlocks** none.
- **Big idea:** Pin 5 is the 2/3 line itself: drive it higher and the capacitor must climb further, so the note drops;
  drive it lower and the note rises.
- **New:** pin 5 (control). The x-ray draws the ladder of three equal resistors, and the 555 map is complete.
- **Case:** "Bend the note". Robot intro: "One pitch is dull. Plug the knob's wire into pin 5."

**Bench.** Half board, B1. CH8's singer with fixed parts: R1 10 kΩ, R2 30 kΩ, C1 47 nF (about 437 Hz), pins 2 and 6
joined, pin 5's 10 nF removed, the speaker as in CH8. Pitch knob: R5 1 kΩ (+ to RV2's top), RV2 10 kΩ trimmer, R6 1 kΩ
(RV2's bottom to −); wire W5 from RV2's wiper, its far end parked in an empty strip. Meter M1 (known) on U1.5, dial on
20 V. Pitch readout. Shelf (secret): U2, a slow astable (10 kΩ, 470 kΩ, 0.47 µF) with R7 10 kΩ on its output, the far
end loose. Fix-it bench: W5 in pin 4's strip.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "One pitch is dull. Plug the knob's wire into pin 5." | Plug W5 into pin 5's strip; turn RV2. | The note bends up and down. Note on pin 5: "pin 5: control, bends the note" |
| 2 | Predict: "Turn pin 5 up. The note goes..." chips "lower", "higher" | Turn RV2 up; M1 climbs to about 8 V. | Lower, down to about 275 Hz. |
| 3 | "Open the x-ray." | X-ray on. | Three equal resistors run from pin 8 to pin 1; pin 5 sits on the 2/3 line and drags it. Note on them: "three equal resistors: both lines". Rule: "Higher on pin 5, lower note." |
| 4 | "Show me the pin that bends the note." | Tap pin 5 (period 2). | The map's last tag inks in. |
| 5 | Check: "What is pin 5?" chips "control", "reset", "output" | Pick a chip (period 3). | Answer "control". |
| 6 | Secret: "Secret: swap the knob's wire for the slow blinker's lead." | Optional: W5 off pin 5; R7's end on pin 5. | A two-tone warble. Note: "a slow 555 makes a siren" |
| 7 | Fix-it: "My pitch knob does nothing. Fix it." | Move W5 from pin 4's strip to pin 5's. | The note bends. Note: "pin 4 clears; pin 5 bends" |
| 8 | "Case closed. My 555 map is complete." | Sign the page. | The 555 map gets its stamp: every pin named, the whole inside drawn. |

**Objectives** (3 eyes)

- O1 Bend: `bend-it` (`lab.connected("RV2.wiper", "U1.5")` and a pitch span of 200 Hz or more within 10 s).
- O2 Up is down: `up-is-down` (`lab.volts("U1.5") >= 7.5 && (lab.toneHz("SP1") ?? 0) <= 330`).
- O3 The whole map: `full-map` (x-ray on with the ladder drawn), then the beat 5 check.
- Secret: `warble` (bonus; R7 joins U2.3 to U1.5, W5 off U1.5; over 3 s the pitch alternates between two values
  100 Hz or more apart).
- Fix-it: `fix-it` (on the fix-it bench, RV2's wiper joined to U1.5; a pitch span of 200 Hz or more).

**Checks:** beat 5 "control".

**Notebook page:** "Chips 10: Bend the note". Sketch: the ladder of three resistors with the 2/3 line pulled up and
down by the knob, and a pitch curve that falls as pin 5 rises. The 555 map's completion stamp. Notes, rule, the beat 2
guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Pin 5 is the control pin. Count from the notch." Fried: none
expected: "No harm. Pin 5 just steers."

**On demand:** beat 2 "Watch the meter and listen together." · beat 3 "Find where pin 5 joins the three resistors." ·
fix-it "Pin 4 resets. Which pin controls?"

**Accuracy:** Pin 5 is the upper tap of the internal divider (three equal resistors, about 5 kΩ each in a bipolar
555, so it looks like 3.3 kΩ to 6.3 V). Driving it to Vc moves the upper threshold to Vc and the lower to Vc ÷ 2. The
knob's chain (1 kΩ, 10 kΩ, 1 kΩ) would give 0.78 V to 8.6 V unloaded; pin 5's ladder pulls that to about 2.0 V to
8.1 V. High time = (R1 + R2) × C × ln((Vs − Vc/2) ÷ (Vs − Vc)), low time = 0.693 × R2 × C (unchanged), so with 10 kΩ,
30 kΩ and 47 nF the note runs from about 820 Hz (pin 5 at 2.0 V) to about 275 Hz (8.1 V), 437 Hz with pin 5 free.
Far outside about 20% to 90% of the supply the oscillation can stop (no damage). The secret's slow 555 runs at
1.44 ÷ (950 kΩ × 0.47 µF) ≈ 3.2 Hz; through 10 kΩ it pulls pin 5 between about 4.7 V and 6.7 V, so the note jumps
between about 575 Hz and 400 Hz. The control pin is pin 5 (some teaching text wrongly says pin 2). The story that
"555" comes from three 5 kΩ resistors is a myth; the resistors are real.

**Words:** main path 92, on demand 36.

---

### CH11. `door-left-open`: The door left open

- **Minutes** 7 · **Wave** 2 (needs the door props, NEW CB5) · **Island piece** `reed-gate` (NEW) · **Unlocks**
  `reed-switch`.
- **Big idea:** A trigger held low keeps a 555 on for as long as it is held; a capacitor in the line turns a held low
  into a short dip, so the timer ends on time.
- **New:** the reed switch (part).
- **Case:** "The door left open". Robot intro: "My lighthouse guards the door. Open it."

**Bench.** Full board, B1. A desk wall with door DR1 (NEW CB5): a magnet module on the door's edge, reed module SW1 on
the frame (normally open, closed while the magnet is near, so closed while the door is shut). Loop: + → SW1 → clip
lead TL1 (the sensor wire) → strip `loop` → R1 10 kΩ to −. Jumper W2 from `loop` to pin 2 of U1. Pin 2 also has R2
100 kΩ to +. U1 one-shot "last chance": R3 27 kΩ, C1 100 µF (`tolerance: 0.05`, `leakOhms: 5e7`, see CS1), C4 10 nF
on pin 5, R4 1 kΩ and D1 (yellow) on pin 3. Tray: C2 0.47 µF ("474"). Fix-it bench: door DR1 and window WN1, their
reed switches SW1 and SW2 wired side by side (in parallel) from + to `loop`, C2 already in line; D2 yellow.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My lighthouse guards the door. Open it." | Drag DR1 open. | D1 lights. Note on SW1: "reed switch: a magnet shuts it" |
| 2 | Predict: "Leave it open. The warning lamp will..." chips "end after 3 s", "never end" | Leave DR1 open; wait 8 s. | Lit the whole time. Note on pin 2: "held low: the glow never ends" |
| 3 | "Close the door. Put the 0.47 µF in pin 2's line." | Shut DR1; replace W2 with C2, `loop` to pin 2. | |
| 4 | "Open it again, and leave it open." | Open DR1; wait. | D1 lights, then goes out after about 3 s, door still open. Note on C2: "held low in, short dip out". Rule: "A trigger wants a dip, not a hold." |
| 5 | "Show me the reed switch." | Tap SW1 (period 2). | |
| 6 | Check: "What is this?" (SW1 glows) chips "a reed switch", "a relay", "a diode" | Pick a chip (period 3). | Answer "a reed switch". |
| 7 | Secret: "Secret: cut the sensor wire." | Optional: shut DR1, then unclip TL1. | D1 lights. Note: "cut wire: same as open door" |
| 8 | Fix-it: "My window doesn't count. Fix it." | Rewire SW2 in series with SW1. | Opening WN1 lights D2. Note: "in series: any opening counts" |
| 9 | "Case closed. No door stays secret." | Sign the page. | |

**Objectives** (3 eyes)

- O1 The door: `door-opens` (`lab.prop("DR1").open && lab.isLit("D1")`).
- O2 Held: `stuck-on` (`lab.heldFor(6, lab.prop("DR1").open && lab.isLit("D1"))`).
- O3 The dip: `dip-it` (`lab.joins("C2", "loop", "U1.2")`; after one opening with the door kept open, D1 lit and then
  dark within 15% of `oneShotT(lab, "R3", "C1")`).
- Secret: `cut-wire` (bonus; DR1 shut, TL1 unclipped, D1 lit).
- Fix-it: `fix-it` (`lab.chain(["SW1", "SW2"])` between + and `loop`; WN1 opened alone and D2 lit).

**Checks:** beat 6 "a reed switch".

**Notebook page:** "Chips 11: The door left open". Sketch: the door with its magnet and reed, pin 2's voltage drawn
twice: a long low (door left open, glow never ends) and a short dip (with the capacitor). Notes, rule, the beat 2
guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "The capacitor goes between the loop and pin 2." Fried: none
expected: "Nothing broke. The door just won."

**On demand:** beat 3 "Lift the jumper; the capacitor takes its place." · beat 4 "Open, then wait. Watch the lamp."
· fix-it "Both switches must sit in one line."

**Accuracy:** A reed switch is two springy contacts sealed in a small glass tube, moved by a magnet. Here it is
normally open and the door's magnet keeps it closed, so a shut house is a closed loop and any opening (or a cut wire)
breaks it. 1.1 × 27 kΩ × 100 µF = 2.97 s. With the door open and pin 2 tied to the loop, pin 2 sits at 9.4 × 10 ÷ 110
≈ 0.85 V for as long as the door stays open, and a trigger held low keeps the output high. Through 0.47 µF the same
step becomes a dip: pin 2 drops to about 0.85 V and climbs back past 3.1 V in about 16 ms (time constant 110 kΩ ×
0.47 µF ≈ 52 ms). Closing the door pushes pin 2 briefly above the supply; a trigger ignores rising edges (golden test
that it does no harm, CS6). The 10 kΩ pull-down draws 0.94 mA while the loop is shut (the alarm's standby current).
Switches in series: all must be closed (Unit 2); in parallel, one closed switch hides the others.

**Words:** main path 110, on demand 36.

---

### CH12. `armed-and-ready`: Exit, wait, alarm

- **Minutes** 9 · **Wave** 2 (door props NEW CB5, voice module NEW CB6) · **Island piece** `wire-spool` · **Unlocks**
  none.
- **Big idea:** Timers in a chain: when one timer's glow ends, its falling edge, passed on by a capacitor, starts the
  next.
- **New:** nothing new; every part is known. The lesson is the chain.
- **Case:** "Exit, wait, alarm". Robot intro: "Arm my door guard. Press GO, then open the door."

**Bench.** Full board. B1 through toggle switch SP (power) on a desk block. DR1 with SW1 and the loop from CH11 (fixed:
C2 in line, 10 kΩ pull-down). U1 exit delay: GO button S1 on pin 2 (10 kΩ pull-up), timing 27 kΩ or 270 kΩ chosen by
a `dpdt-switch` "TEST / LIVE" that swaps both timers' resistors, C 100 µF (`leakOhms: 5e7`), R and D1 (green) on pin
3; from U1.3, D9 (1N4148, band toward U2.2) to U2.2. U2 last chance: as CH11, 100 kΩ pull-up on pin 2, timing 27 kΩ
or 270 kΩ with 100 µF, R and D2 (yellow) on pin 3. U3 alarm latch: pin 6 to −, pin 2 with R9 100 kΩ to +, pin 4
with R10 10 kΩ to + and S2 "DISARM" to −, pin 3 to R and D3 (red) and to the enable of VM1, a voice module (CH8's
singer on a plug-in module, NEW CB6, its 555's pin 4 on the module's EN pin). Tray: C5 0.47 µF. Fix-it bench: the
whole alarm with C5 in place, SP off; tray: C6 100 µF.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Arm my door guard. Press GO, then open the door." | Tap S1; open DR1 while D1 is lit. | Green glows; yellow stays dark. Note on D9: "green on: the door is ignored" |
| 2 | "Close it. When green ends, open it again." | Shut DR1; wait; open. | Yellow glows 3 s and goes out. Silence. Note on U3: "yellow ended, but nobody told" |
| 3 | "Link yellow's pin 3 to the alarm's pin 2, through 0.47 µF." | Place C5 between U2.3 and U3.2. | |
| 4 | Predict: "Shut it, open it. The alarm sounds..." chips "at once", "when yellow ends" | Shut DR1; open it. | Red lamp and siren just as yellow goes out. Note on C5: "yellow's end: a falling edge". Rule: "Each timer's end starts the next." |
| 5 | Check: "Close the door. Will the siren stop?" chips "yes", "no" | Pick a chip, then shut DR1. | Answer "no": it keeps wailing. |
| 6 | "Press DISARM." | Tap S2. | Silence. Note on S2: "latched: only reset stops it" |
| 7 | Secret: "Secret: flip to LIVE and run it again." | Optional: LIVE; the whole sequence (fast-forward allowed). | The same chain, ten times slower. Note: "270 kΩ × 100 µF ≈ 30 s" |
| 8 | Fix-it: "My alarm wails the moment I switch on. Fix it." | Add C6 from U3's pin 4 to −; switch off, wait 10 s, switch on. | Quiet at switch-on. Note: "pin 4 held low while waking" |
| 9 | "Case closed. My lighthouse guards the island." | Sign the page. | |

**Objectives** (4 eyes)

- O1 Exit delay: `exit-delay` (S1 pressed; DR1 opened while `lab.isLit("D1")`; D2 dark throughout).
- O2 Silent end: `silent-end` (D2 lit, then dark; D3 still dark 2 s later).
- O3 The chain: `link-it` (`lab.joins("C5", "U2.3", "U3.2")`), `alarm` (D3 lit within 0.2 s of D2 going dark).
- O4 Latched: beat 5 check; `disarm` (DR1 shut, D3 lit until S2 is pressed, then dark).
- Secret: `live-delays` (bonus; LIVE selected and a D2 glow within 15% of 1.1 × 270 kΩ × the actual value of U2's timing capacitor).
- Fix-it: `fix-it` (`lab.joins("C6", "U3.4", "rail-")`; after SP has been off for 10 s or more and then on, D3 dark
  for 3 s).

**Checks:** beat 5 "no".

**Notebook page:** "Chips 12: Exit, wait, alarm". A timeline drawn by the bench (GO, green, door, yellow, red), the
falling edge circled where yellow hands over to red. Notes, rule, the beat 4 guess, fix-it tick, secret box. The
module's last page carries the lighthouse stamp.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Find where yellow ends. Something must carry that moment."
Fried: none expected: "Loud, but nothing broken."

**On demand:** beat 3 "One leg on yellow's pin 3, one on the alarm's pin 2." · beat 6 "DISARM pulls pin 4
low." · fix-it "Reset beats everything. Hold pin 4 low for a moment."

**Accuracy:** 1.1 × 27 kΩ × 100 µF ≈ 3.0 s (TEST) and 1.1 × 270 kΩ × 100 µF ≈ 30 s (LIVE). (Some published alarm
designs quote 3 s and 30 s for 47 kΩ and 470 kΩ with 10 µF; those actually give about 0.5 s and 5 s.) While U1 is
high (about 8.0 V), D9 holds U2's pin 2 near 7.4 V, so the door's dip cannot reach 3.1 V; when U1 is low the diode is
reverse biased and drops out. U2's falling output (8.0 V to 0) dips U3's pin 2 to about 1.4 V, back above 3.1 V after
about 11 ms (100 kΩ × 0.47 µF); its rising edge pushes pin 2 up, which a trigger ignores. At switch-on U3's pin 2
starts low and needs about 19 ms to pass 3.1 V, so U3 sets (and a 555's latch may start set anyway). 10 kΩ with
100 µF holds reset under 0.7 V for about 77 ms, longer than those 19 ms; 1 µF (0.8 ms) would be too short here.
After a quick off and on the 100 µF may still be charged: wait about 10 s (golden test, CS7). The default leakage
of a 100 µF electrolytic in the model (1 MΩ) would stretch the LIVE delay to about 40 s, hence `leakOhms` (CS1).

**Words:** main path 118, on demand 40.

---

## 5. Module 3: Counters and displays (`counters`)

Landmark `counter-billboard`. Seven bars, a chip that counts edges, a carry, and a clock that only counts while a
latch allows it. Runs on the 9.4 V rails with bipolar 555s (a 4026B works from 3 to 18 V).

---

### CH13. `seven-segments`: Eight lights make a digit

- **Minutes** 6 · **Wave** 1 · **Island piece** `seven-seg` (NEW) · **Unlocks** `seven-segment`, `dip-switch`.
- **Big idea:** A 7-segment display is seven bar-shaped LEDs (and a dot) sharing one common lead; the right bars draw
  any digit.
- **New:** the seven-segment display (part) and its bar letters a to g. The DIP switch is eight known slide switches
  in one block, named by a note only.
- **Case:** "Eight lights make a digit". Robot intro: "My billboard needs digits. Flip switch a."

**Bench.** Half board, B1. DS1 (`seven-seg`, NEW CB2), common cathode, straddling the channel at columns 14 to 18
(pins in rows c and g), both COM pins to −. DIP1, an 8-way DIP switch (NEW CB4) across the channel at columns 3 to 10:
pins 9 to 16 joined to + by a bus jumper, and each of pins 1 to 8 through its own 1 kΩ (R1 to R8) to bar a, b, c,
d, e, f, g and dp; tags under the switches read a to g and dp. Fix-it bench: the same build with R5's segment end in d's
strip instead of e's.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My billboard needs digits. Flip switch a." | Flip DIP1's switch a. | The top bar lights. Note on DS1: "seven bars and a dot" |
| 2 | "Now b and c." | Flip b and c. | A 7. Note: "a, b, c: a seven" |
| 3 | Predict: "All seven bars at once make..." chips "an 8", "a 0", "a box" | Flip d, e, f and g. | An 8. Rule: "Seven bars make every digit." |
| 4 | "Make a 4." | Set only f, g, b and c. | A 4. Note on DIP1: "eight switches in one block" |
| 5 | "Every bar shares one minus pin. Show me it." | Tap a COM pin (period 2 for the display's parts). | A wrong tap shows that bar's letter. Note on COM: "common cathode: one shared minus" |
| 6 | Check: "What is this?" (DS1 glows) chips "a seven-segment display", "eight lamps", "a counter" | Pick a chip (period 3). | Answer "a seven-segment display". |
| 7 | Secret: "Secret: spell HELLO, one letter at a time." | Optional: H, E, L, then O. | Note: "seven bars spell letters too" |
| 8 | Fix-it: "My 2 looks wrong. Fix it." | Move R5's end from d's strip to e's strip. | A proper 2. Note: "one strip off: a wrong bar" |
| 9 | "Case closed. Every digit from seven bars." | Sign the page. | |

**Objectives** (3 eyes)

- O1 First bars: `make-seven` (`lab.part("DS1")?.extra?.digit === "7"`).
- O2 All bars: `make-eight` (digit "8"), `make-four` (digit "4").
- O3 One common lead: the beat 5 tap (on `DS1.com` or `DS1.com2`), then the beat 6 check.
- Secret: `hello` (bonus; `extra.lit` has been "bcefg", "adefg", "def" and "abcdef", kept in `lab.memory`).
- Fix-it: `fix-it` (`lab.joins("R5", "DIP1.5", "DS1.e")` and digit "2" shown).

**Checks:** beat 6 "a seven-segment display".

**Notebook page:** "Chips 13: Eight lights make a digit". The display drawn large with its letters, and the learner's
7, 8 and 4 sketched beside it. Notes, rule, the beat 3 guess, fix-it tick, secret box (HELLO in bars).

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Clockwise from the top: a to f. The middle is g."
Fried (only if a segment is wired across 9 V without its resistor): "One bar burned out. Every bar needs its resistor."

**On demand:** beat 4 "A 4 has no top and no bottom." · beat 5 "The minus pins sit in the middle of each row." · fix-it
"Which bar is missing from your 2?"

**Accuracy:** Bars: a top, b upper right, c lower right, d bottom, e lower left, f upper left, g middle, dp the dot.
Common cathode: every bar's cathode joined; a 10-pin display has two COM pins joined inside. 1 kΩ per bar at 9.4 V
gives about 7.5 mA (red, about 1.9 V). One resistor per bar keeps them equally bright; one shared resistor in the
common lead makes a 1 brighter than an 8 (a parts-bin fact; the model shows it). Digit shapes as the 4026B draws them
(6 and 9 with tails). Letters: H bcefg, E adefg, L def, O abcdef. A DIP switch: eight small switches in a 16-pin
body, switch n joining pin n to pin 17 − n. The display's rows are 0.6 in apart, so its pins sit in rows c and g.

**Words:** main path 105, on demand 45.

---

### CH14. `count-the-ticks`: One tick, one step

- **Minutes** 7 · **Wave** 1 · **Island piece** `test-lead-arch` · **Unlocks** `counter-4026b`.
- **Big idea:** A counter chip adds one each time its clock input rises from low to high; a steady blinker becomes a
  clock.
- **New:** the counter chip (4026B, DIP-16); the word "clock" (periods 1 and 2 here, period 3 in CH16).
- **Case:** "One tick, one step". Robot intro: "This chip counts. Tap the button."

**Bench.** Full board, B1. U1 4026B (pin 16 to +, 8 to −, 3 display enable to +, 2 inhibit to −, 4 and 14 open, 15
reset with R1 10 kΩ to − and S2 "RESET" to +). S1 "TAP" from + to strip `tap`, with R2 10 kΩ from `tap` to −; jumper
W2 from `tap` to pin 1. U1's a to g pins to DS1 on a carrier (3.3 kΩ per bar), COM to −. U2, a 555 blinker (CH7's
values: 10 kΩ, 68 kΩ, 10 µF) with R3 and D1 on its pin 3. Tray: C5 0.1 µF. Fix-it bench: U3 and its display counting
from a blinker, but U3's pin 15 jumpered straight to +.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This chip counts. Tap the button." | Tap S1 a few times. | 1, 2, 3 on the display. Note on U1: "a counter: one tap, one step" |
| 2 | Predict: "Hold the button down. The count will..." chips "keep climbing", "step once" | Hold S1 for 3 s. | One step only. Note on pin 1: "counts the rise, not the hold". Rule: "A counter steps once per rising edge." |
| 3 | "Let my blinker tap. Move pin 1's wire to its output." | Move W2's end from `tap` to U2.3's strip. | A step with every flash. Note on U2: "a steady tick: a clock" |
| 4 | Predict: "After 9 comes..." chips "10", "0" | Watch. | 0. Note: "one digit: 9 rolls to 0" |
| 5 | "Show me the clock." | Tap U2 (period 2). | |
| 6 | Check: "What is this?" (U1 glows) chips "a counter", "a timer", "a display" | Pick a chip (period 3). | Answer "a counter". |
| 7 | "Press RESET." | Hold S2. | 0 while held. |
| 8 | Secret: "Secret: swap the clock's 10 µF for 0.1 µF." | Optional: C5 in place of U2's 10 µF. | Every bar looks lit. Note: "too fast to read: an 8" |
| 9 | Fix-it: "My counter is stuck on 0. Fix it." | Move pin 15's jumper from + to its pull-down strip. | It counts. Note: "reset held high: stuck at 0" |
| 10 | "Case closed. One tick, one step." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Tap: `tap-count` (count up by 3 or more with as many presses as steps; NEW history `count:U1` and `closed:S1`,
  CR6).
- O2 The edge: `hold-once` (S1 held 2 s or more; the count changed by exactly one during the hold).
- O3 Clock: `clock-in` (`lab.connected("U2.3", "U1.1")`, and a 9 followed by a 0 seen).
- Secret: `blur` (bonus; clock period under 0.02 s and every bar's glow on DS1 above 0.15).
- Fix-it: `fix-it` (U3.15 no longer on +; the count changes).

**Checks:** beat 6 "a counter".

**Notebook page:** "Chips 14: One tick, one step". A clock wave with a tick drawn at each rising edge and the digit
above each step; a held press drawn as one long high with a single tick. Notes, rule, both guesses, fix-it tick,
secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Pin 1 is the clock input. Count from the notch." Fried: none
expected: "No harm. Counters are patient."

**On demand:** beat 3 "Move the jumper from the button's strip to the blinker's output." · beat 7 "Reset is
pin 15: high means zero." · fix-it "What holds reset high?"

**Accuracy:** 4026B: pin 1 clock (counts on the rising edge, however long the high lasts), 2 clock inhibit (high
ignores the clock), 3 display enable in (high lights the outputs), 4 display enable out, 5 carry out, 6 f, 7 g, 8
minus, 9 d, 10 a, 11 e, 12 b, 13 c, 14 ungated c, 15 reset (active high), 16 plus; made for 3 to 18 V. Its bar outputs
are weak (about 500 Ω inside at 9 V), so 3.3 kΩ per bar gives about 2 mA. Inhibit and reset are active high, unlike the
555's active-low trigger and reset. One digit rolls 9 to 0. The clock: about 0.99 Hz; with 0.1 µF about 99 Hz, which
looks like an 8 (each bar lit part of the time). Button bounce is off in this lesson (CH22 switches it on).

**Words:** main path 115, on demand 37.

---

### CH15. `carry-the-one`: Carry the one

- **Minutes** 6 · **Wave** 1 (bare chips on a full board until the modules, NEW CB6, exist) · **Island piece**
  `jumper-arch` · **Unlocks** none.
- **Big idea:** A counter's carry output rises as it rolls from 9 to 0; clock the next counter with it and the digits
  count tens and hundreds.
- **New:** carry out (the pin, three periods). The digit modules are CH14's counter and display on one small board,
  named by a note.
- **Case:** "Carry the one". Robot intro: "My billboard stops at 9. Clip the tens CLK to CO."

**Bench.** Half board, B1. U1, a 555 clock: 10 kΩ, 68 kΩ, 1 µF (about 9.9 Hz). DM1 and DM2, digit modules (NEW CB6:
4026B, display, 3.3 kΩ per bar; header pins +, −, CLK, INH, RST, CO), INH to −, RST on a bus with R1 10 kΩ to − and
S1 "RESET" to +. DM1.CLK from U1.3. DM2.CLK on a clip lead W3, loose. Tray: DM3. Fix-it bench: DM2.CLK on the clock
line beside DM1.CLK.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My billboard stops at 9. Clip the tens CLK to CO." | Clip W3 to DM1.CO. | As the ones roll 9 to 0, the tens step: 09, 10. Note on CO: "carry: rises as 9 rolls over" |
| 2 | Predict: "At 19, the next tick shows..." chips "20", "10", "29" | Watch. | 20. Rule: "Each rollover clocks the next digit." |
| 3 | Check: "Two digits. What is the highest count?" chips "19", "99", "100" | Pick a chip. | Answer "99". |
| 4 | "Watch 99 tick over." | Watch (fast-forward allowed). | 00. |
| 5 | "Show me the carry." | Tap DM1.CO (period 2). | Note on DM1: "counter and display, one board" |
| 6 | Check: "What is this pin?" (CO glows) chips "carry out", "clock", "reset" | Pick a chip (period 3). | Answer "carry out". |
| 7 | Card: "These counters are CMOS. Do or don't?" | Sort the four habits (pop-up card, section 8.7). | Each lands with its stamp line. |
| 8 | Secret: "Secret: add a hundreds digit. Count to 999." | Optional: DM3 from the tray, its CLK to DM2.CO. | 999, then 000. Note: "three digits: up to 999" |
| 9 | Fix-it: "My tens digit races the ones. Fix it." | Move DM2.CLK from the clock line to DM1.CO. | Note: "tens tick only on the carry" |
| 10 | "Case closed. Carry the one!" | Sign the page. | |

**Objectives** (2 eyes)

- O1 Carry: `carry-in` (DM2.CLK joined to DM1.CO; the tens changed as the ones went 9 to 0).
- O2 Count up: `nineteen-twenty` (`reading(lab, ["DM2", "DM1"])` was "19" then "20"), the beat 3 check, `roll-99`
  ("99" then "00").
- Secret: `to-999` (bonus; DM3.CLK joined to DM2.CO; "999" then "000").
- Fix-it: `fix-it` (DM2.CLK joined to DM1.CO; a "09" then "10" seen).

**Checks:** beat 3 "99"; beat 6 "carry out"; the card (all four right on the first try).

**Notebook page:** "Chips 15: Carry the one". Two digits drawn as a little odometer with an arrow from the ones' CO to
the tens' CLK. Notes, rule, the beat 2 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "CO is pin 5 on the chip, CO on the module." Fried: none
expected: "Nothing hurt. Just two eager digits."

**On demand:** beat 1 "The tens' CLK lead goes on the ones' CO pin." · beat 4 "The fast-forward button is by the
clock." · fix-it "What should clock the tens?"

**Accuracy:** The 4026B's carry out is high for counts 0 to 4 and low for 5 to 9, so it rises as the count rolls from 9
to 0; the next counter steps on that rising edge (checked against the datasheet's timing diagram and the model). Clock
1.44 ÷ ((10 kΩ + 136 kΩ) × 1 µF) ≈ 9.9 Hz: 99 counts take about 10 s, 999 about 101 s. Two digits show 00 to 99, three
000 to 999.

**Words:** main path 105 plus the card 40, total 145; on demand 39.

---

### CH16. `reaction-race`: Reaction race

- **Minutes** 9 · **Wave** 2 (modules NEW CB6, timing diagram NEW CP3) · **Island piece** `meter-kiosk` · **Unlocks**
  none.
- **Big idea:** Block the clock and the count stops: a latch that holds the counters' inhibit pins high freezes them,
  so the digits show only the time between GO and STOP.
- **New:** the word "inhibit" (pin 2 of the 4026B).
- **Case:** "Reaction race". Robot intro: "Race me. Press START, wait for green, then hit STOP."

**Bench.** Full board, B1, 100 µF across the supply. U1 get-ready one-shot: S1 "START" on pin 2 (10 kΩ pull-up), 270 kΩ
and 10 µF (about 3.0 s); U1.3 drives R and D1 (red, "wait") to − and, through R and D2 (green, "go"), from +, so green
lights whenever U1 is low. U1.3 → C3 0.47 µF → U2.4; U2.4 sits on R5 10 kΩ to + and R6 47 kΩ to −. U2 latch: pin 6 to
−, S2 "STOP" on pin 2 (10 kΩ pull-up). U3, the 1 kHz clock: R1 10 kΩ, R2 4.7 kΩ plus RV1 10 kΩ trimmer, C 47 nF, the
trimmer preset by the lab to 1.000 kHz for this learner's actual parts. DM1 to DM3 chained (ones count milliseconds),
CLK of DM1 from U3.3; their INH pins on a bus held at − by jumper W9; RST bus with a 10 kΩ pull-down and S3 "RESET"
to +. Timing diagram TD1 (NEW CP3): START, U1.3, STOP, U2.3, clock. Fix-it bench: the counters free running (INH at −),
RV1 set so the clock runs at 1.10 kHz, R and D9 on DM3's CO, the desk clock CK1 ticking seconds.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Race me. Press START, wait for green, then hit STOP." | Tap S1; wait; tap S2 on green. | The digits keep running. Note on the digits: "STOP pressed, still counting" |
| 2 | "Move the inhibit wire from minus to the latch's pin 3." | Move W9's end from the − rail to U2.3. | The digits freeze. Note on INH: "inhibit high: the clock is ignored" |
| 3 | Predict: "RESET, START, STOP on green. The digits..." chips "freeze", "keep running" | Play a round. | They freeze at your time, for example 263. Rule: "Block the clock to stop the count." |
| 4 | Check: "The digits read 263. Your time?" chips "263 ms", "2.63 s", "26.3 s" | Pick a chip (the prompt quotes the learner's own reading; NEW CR11). | Answer in milliseconds. |
| 5 | "Play a few more rounds. RESET between them." | Optional rounds. | Each time logged. Note: "most people: 200 to 300 ms" |
| 6 | "Show me the inhibit pin." | Tap INH on a module (period 2). | |
| 7 | Check: "What does inhibit high do?" chips "ignores the clock", "resets to 0", "lights the dot" | Pick a chip (period 3; also period 3 for clock). | Answer "ignores the clock". |
| 8 | Secret: "Secret: beat 200 ms." | Optional: a round under 200. | Note: "under 200 ms: quick hands" |
| 9 | Fix-it: "My race clock runs fast. Match its blink to the clock." | Turn RV1 until D9 blinks with each tick of CK1. | Note: "1,000 ticks: one second" |
| 10 | "Case closed. Fastest fingers on the island!" | Sign the page. | The billboard landmark. |

**Objectives** (3 eyes)

- O1 No brakes: `no-brakes` (S2 pressed after D2 lit; `reading` still changing 0.5 s later).
- O2 The gate: `inhibit-wire` (W9 joins the INH bus to U2.3), `frozen` (after a round, `reading` steady for 2 s after
  S2, between 080 and 999).
- O3 Read it: beat 4 and beat 7 checks.
- Secret: `quick-hands` (bonus; a round reading 100 to 199 after green; under 100 counts as a jump start).
- Fix-it: `fix-it` (clock period 0.98 to 1.02 ms: the mean of `lab.periods("volts:U3.3", 4, 0.5)`).

**Checks:** beat 4 (the reading in ms); beat 7 "ignores the clock".

**Notebook page:** "Chips 16: Reaction race". The timing diagram as the bench drew it (START, wait, go, STOP, the
clock running only between go and STOP), the learner's times in blue, best one circled. Notes, rule, the beat 3 guess,
fix-it tick, secret box. The module's last page carries the billboard stamp.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Inhibit high freezes the count. Who should hold it high?"
Fried: none expected: "Nothing broke. Your fingers are fine too."

**On demand:** beat 2 "U2's pin 3 goes high when you hit STOP." · beat 3 "RESET first, then START." · fix-it "Too
fast? Turn toward more ohms."

**Accuracy:** At 1 kHz the three digits read milliseconds, tens of milliseconds and hundreds of milliseconds; full
scale 999 ms, then it rolls over. Clock 1.44 ÷ ((10 kΩ + 2 × R2) × 47 nF): R2 = 10.3 kΩ for 1.000 kHz; the trimmer's
range (R2 4.7 to 14.7 kΩ) spans about 1.58 kHz down to 780 Hz. Get-ready delay 1.1 × 270 kΩ × 10 µF ≈ 3.0 s. U2's
reset idles at 9.4 × 47 ÷ 57 ≈ 7.8 V; U1's falling edge kicks it below 0.7 V through 0.47 µF, clearing U2, whose low
output lets the counters count. A 555 output sources and sinks, so one output drives the red lamp (high) and the green
lamp (low). Simple visual reaction time is typically about 200 to 300 ms; under about 100 ms means the press came
before the light. A 10% fast clock blinks the 1-second lamp 11 times in 10 s: more resistance slows it. The hundreds'
carry out is high for 0 to 499 ms and low for 500 to 999 ms, one blink per second at 1 kHz. A game, not a test of
fitness.

**Words:** main path 127, on demand 36.

---

## 6. Module 4: Logic (`logic`)

Landmark `logic-castle`. A steady 5 V first; then gates, their tables, the bubble, a requirement turned into gates, and
memory made from feedback. Logic runs on the far rails at 5 V from the regulator, the 9.4 V rails beside it.

---

### CH17. `five-volts-exactly`: Five volts, exactly

- **Minutes** 6 · **Wave** 1 (with the cell-stack fallback until the adjustable supply, NEW CB8, exists) · **Island
  piece** `regulator` (NEW) · **Unlocks** `regulator-7805`.
- **Big idea:** A regulator turns a higher supply into a steady 5 V, as long as it is fed about 2 V more than it gives.
- **New:** the regulator (7805, a three-legged TO-220 part).
- **Case:** "Five volts, exactly". Robot intro: "Logic chips want 5 V, exactly. Turn up the supply."

**Bench.** Half board. PS1, the adjustable bench supply (NEW CB8, 0 to 12 V knob) on the near rails. VR1 (`regulator`,
NEW CB3) at the left end: in from the near + rail, ground to −, out to the far + rail; C1 0.33 µF on the input, C2
0.1 µF on the output; far − joined to near −. Meter M1 (known) on the far rails, dial on 20 V. Load: three red LEDs
with 470 Ω each on the 5 V rail behind slide switch SW1. Shelf (secret): U9, a 74HC08, and a jumper. Fix-it bench: VR1
fed from B4, a 4.5 V pack (three AA, NEW CB9), meter reading about 2.8 V; B1 in the tray.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Logic chips want 5 V, exactly. Turn up the supply." | Turn PS1 from 0 to 12 V. | The meter follows about 2 V below, then stops at 5.0 V. Note on VR1: "regulator: steady 5 V out" |
| 2 | Predict: "Supply at 6 V. The output reads..." chips "5.0 V", "about 4 V" | Set PS1 to 6 V. | About 4.1 V. Note: "it needs about 2 V spare". Rule: "Feed it 7 V or more." |
| 3 | "Back to 9 V. Switch on the lamp load." | PS1 to 9 V; flip SW1. | Three lamps lit; still 5.00 V. Note: "load on: still 5.00 V" |
| 4 | "Show me the input leg." | Tap VR1's left leg (period 2). | A wrong tap shows "ground" or "output". |
| 5 | Check: "What is this?" (VR1 glows) chips "a regulator", "a transistor", "a 555" | Pick a chip (period 3). | Answer "a regulator". |
| 6 | Secret: "Secret: feed the gate chip straight from 9 V." | Optional: jumper U9's pin 14 to the 9 V rail. | It smokes. Note: "9 V: too much for 74HC" |
| 7 | Fix-it: "My 5 V rail reads under 3 V. Fix it." | Swap B4 for B1. | 5.0 V. Note: "4.5 V in: no room left" |
| 8 | "Case closed. Five volts, steady as a rock." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Lock: `sweep` (PS1 has been at 5 V or less and later at 9 V or more; `lab.volts("VR1.out", "VR1.gnd")` 4.9 to
  5.1 V with the input at 7.5 V or more).
- O2 Headroom: `six-volts` (PS1 5.8 to 6.2 V; output 3.8 to 4.4 V).
- O3 Load: `load-on` (`lab.closed("SW1")`; input 7 V or more; output 4.9 to 5.1 V).
- Secret: `fry-a-gate` (bonus; `lab.died("U9")`).
- Fix-it: `fix-it` (B1 feeds VR1's input; output 4.9 to 5.1 V).

**Checks:** beat 5 "a regulator".

**Notebook page:** "Chips 17: Five volts, exactly". A graph the bench draws: output against input, a slope that flattens
at 5 V, with the 6 V guess marked. Notes, rule, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Watch the meter while you turn. Where does it stop?" Fried:
"That chip took 9 V. Logic lives on the 5 V rail."

**On demand:** beat 4 "Printed face toward you: in, ground, out." · fix-it "How much more than 5 V must it get?"

**Accuracy:** A 7805 holds 5 V (datasheet ±4% over load and temperature; each model part within about 1%). It needs
about 2 V more in than out (dropout; the model 1.95 V at light load), so 6 V in gives about 4.1 V and 4.5 V gives about
2.8 V. Legs, printed face toward you and legs down: input, ground, output. Input up to 35 V, but the extra becomes
heat: P = (Vin − 5 V) × I. Datasheet application: 0.33 µF on the input, 0.1 µF on the output. Three lamps: (5 − 1.9) ÷
470 ≈ 6.6 mA each, about 20 mA in all (about 0.09 W of heat at 9.4 V in). 74HC parts are made for 2 to 6 V and are
destroyed above 7 V. As a 9 V battery runs down below about 7 V, the 5 V rail starts to sag.

**Words:** main path 110, on demand 38.

---

### CH18. `gatekeepers`: Both keys or either

- **Minutes** 7 · **Wave** 1 · **Island piece** `logic-chip` (NEW) · **Unlocks** `logic-gates`.
- **Big idea:** A logic gate answers high or low by a fixed rule; a truth table lists its answer for every input, and
  the chip, not the wiring, decides the rule.
- **New:** the gate chip (74HC08, DIP-14); the words AND, OR and truth table, one idea: a gate is its table.
- **Case:** "Both keys or either". Robot intro: "The castle gate has two keys. Press A."

**Bench.** The standard 5 V rail (VR1 locked). U1 74HC08: pin 14 to +5, pin 7 to −, unused inputs 4, 5, 9, 10, 12 and
13 to −. S1 "A" and S2 "B" from +5 to pins 1 and 2, with R1 and R2 10 kΩ pull-downs; pin 3 → R3 1 kΩ → D1 → −.
Truth-table panel TT1 (CP4: inputs S1, S2 as up and down; output D1). Tray: U2 74HC32, U3 74HC86. Hand control (for
the fix-it). Fix-it bench: the AND build with R2 missing.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "The castle gate has two keys. Press A." | Press S1. | Dark. |
| 2 | "Hold A and press B." | Hold both. | Lit. Note on U1: "a gate: AND, both or nothing" |
| 3 | "Try all four ways. The table fills itself." | Try each pair of key positions. | TT1 reads 0, 0, 0, 1. Note on TT1: "truth table: every answer". Rule: "A truth table lists every answer." |
| 4 | "Swap in the OR chip. Same holes." | Lift U1; seat U2. | |
| 5 | Predict: "Press only A. The lamp..." chips "lights", "stays dark" | Press S1, then fill the table. | Lights; TT1 reads 0, 1, 1, 1. Note: "OR: either key, or both". Rule: "The chip decides the rule." |
| 6 | "Show me the AND chip." | Tap U1 in the tray (period 2). | |
| 7 | Check: "Which gate made 0, 1, 1, 1?" chips "AND", "OR" | Pick a chip (period 3). | Answer "OR". |
| 8 | Secret: "Secret: try the chip marked 86." | Optional: seat U3; fill the table. | 0, 1, 1, 0. Note: "XOR: one key, not both" |
| 9 | Fix-it: "My gate lamp flickers when I come near. Fix it." | Add a 10 kΩ from pin 2 to −. | Steady. Note: "pull-down: low until pressed" |
| 10 | "Case closed. My castle gates think." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Both keys: `and-both` (S1 and S2 closed, D1 lit), `and-table` (TT1 complete with 0001).
- O2 The swap: `or-chip` (U2 seated in U1's holes: `lab.chipSeat("U2")?.straddles`, same columns), `or-table` (0111).
- O3 Name it: beat 7 check.
- Secret: `xor-chip` (bonus; U3 seated, TT1 complete with 0110).
- Fix-it: `fix-it` (on the fix-it bench, a 10 kΩ joins U1.2 and −; D1 dark held 3 s with the hand at 0.8 or more; lit with both pressed).

**Checks:** beat 7 "OR".

**Notebook page:** "Chips 18: Both keys or either". The AND and OR tables side by side with their symbols (and XOR's,
if found, with a note linking it to Unit 2's stairway light). Notes, rules, the beat 5 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Notch to the left, like every chip." Fried (a chip seated
turned round, supply backwards): "Backwards chip, hot chip. Notch to the left."

**On demand:** beat 4 "Lift it out, drop the OR chip in, notch left." · beat 5 "Try all four again." · fix-it "Which
input has nothing holding it?"

**Accuracy:** 74HC08 quad 2-input AND: inputs 1 and 2 to output 3 (also 4, 5 to 6; 9, 10 to 8; 12, 13 to 11), pin 7
ground, pin 14 plus. The 74HC32 (OR) and 74HC86 (XOR) share that pinout, so they swap in the same holes. Tie unused
inputs to a rail. 10 kΩ pull-downs. The lamp: about 3 mA from a 5 V output through 1 kΩ, within the 4 mA design value.
At 5 V a 74HC input reads low below about 1.5 V and high above about 3.5 V (datasheets: 1.35 to 1.5 V and 3.15 to
3.5 V); the model switches at 2.5 V and labels the band between as undefined. Tables, inputs 00, 01, 10, 11: AND 0001,
OR 0111, XOR 0110. Unit 2's stairway light behaves as an XOR of its two switches.

**Words:** main path 108, on demand 35.

---

### CH19. `flip-the-answer`: The bubble flips it

- **Minutes** 6 · **Wave** 1 · **Island piece** `breadboard-patch` · **Unlocks** `logic-probe`.
- **Big idea:** A small circle (a bubble) on a gate means its answer is flipped: NAND is AND turned over, NOR is OR
  turned over.
- **New:** the logic probe (tool).
- **Case:** "The bubble flips it". Robot intro: "This is a logic probe. Touch its tip to plus."

**Bench.** The 5 V rail. LP1, the logic probe (NEW CP5), its red clip on +5 and black on −, tip on the desk. U1, a
74HC00 under tape marked "?1": S1 and S2 (to +5, pull-downs) on pins 1 and 2, output pin 3 on a test strip, other
inputs to −. U2, a 74HC02 under tape "?2": S3 and S4 on pins 2 and 3, output pin 1 on a test strip, other inputs to −.
A lone jumper end FT in an empty strip (nothing on it). TT1 (CP4, output = the probe's reading, gate names hidden).
Tray: U3 74HC04. Fix-it bench: probe LP2 with both clips lying on the desk.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is a logic probe. Touch its tip to plus." | Tip on +5. | The H lamp lights. Note on LP1: "probe: H means high" |
| 2 | "Now minus. Then the strip with nothing on it." | Tip on −, then on FT. | L, then neither lamp, or a flicker. Note on FT: "neither: floating" |
| 3 | "Use the probe: find a high pin on ?1." | Probe U1's pins (period 2). | Any H counts. |
| 4 | "Probe ?1's pin 3. Try all four key pairs." | Tip on U1.3; press S1 and S2 in each pair. | TT1 reads 1, 1, 1, 0. Note on U1: "AND, answer flipped: NAND" |
| 5 | Predict: "?2 is OR with a bubble. Both keys up gives..." chips "high", "low" | Tip on U2.1; try all pairs. | High; TT1 reads 1, 0, 0, 0. Note: "NOR: high only when both low". Rule: "A bubble flips the answer." |
| 6 | Check: "What is this?" (LP1 glows) chips "a logic probe", "a meter", "a scope" | Pick a chip (period 3). | Answer "a logic probe". |
| 7 | Secret: "Secret: chip 04 has six one-input gates. Probe one." | Optional: seat U3 in its marked spot; probe pin 2 while pressing S1. | Note: "NOT: one in, flipped out" |
| 8 | Fix-it: "My probe shows nothing, anywhere. Fix it." | Clip LP2's red to +5, black to −. | Its lamps work. Note: "the probe feeds on the circuit" |
| 9 | "Case closed. Bubbles flip answers." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Meet the probe: `probe-high`, `probe-low`, `probe-float` (NEW `lab.logicProbe` reads `H`, `L` or `-`, CP5).
- O2 NAND: `nand-table` (TT1 complete with 1110 for U1).
- O3 NOR: `nor-table` (TT1 complete with 1000 for U2).
- Secret: `not-gate` (bonus; U3 seated; the probe on U3.2 reads the opposite of S1, both ways).
- Fix-it: `fix-it` (LP2 powered from +5 and −; an `H` and an `L` reading both seen).

**Checks:** beat 6 "a logic probe".

**Notebook page:** "Chips 19: The bubble flips it". The AND and OR symbols with bubbles inked onto them, each with its
flipped table. Notes, rule, the beat 5 guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Read the lamp after each key pair." Fried: none expected: "No
harm. Probes only look."

**On demand:** beat 2 "FT is the jumper end in the empty strip." · beat 4 "Hold the tip on pin 3 while you press." ·
fix-it "Where does a probe get its power?"

**Accuracy:** A logic probe takes its power from the circuit (red clip to plus, black to minus); in its CMOS setting
it shows H above 70% and L below 30% of its supply, nothing in between, and a floating pin makes it flicker or show
nothing. 74HC00 NAND: 1110; 74HC02 NOR: 1000, with its outputs on pins 1, 4, 10 and 13 (not a drop-in for the 00, 08,
32 or 86); 74HC04 hex inverter: inputs 1, 3, 5, 9, 11, 13 to outputs 2, 4, 6, 8, 10, 12. A bubble on a symbol means
inversion.

**Words:** main path 115, on demand 37.

---

### CH20. `chord-lock`: Chord lock

- **Minutes** 8 · **Wave** 1 · **Island piece** `relay` · **Unlocks** none.
- **Big idea:** To check that a key is not pressed, flip its pull: a key to minus with a pull-up reads high when
  untouched, so "none of these" becomes one more AND.
- **New:** nothing new: the pull-up (CH3), the AND (CH18), the transistor and relay (Unit 2).
- **Case:** "Chord lock". Robot intro: "My castle lock opens for A and B. Mash all four."

**Bench.** The 5 V rail and the 9.4 V rail (one battery, so one minus). Keys S1 A, S2 B, S3 C, S4 D (sticky hold on
touch, NEW CR8). A and B: to +5 with R1, R2 10 kΩ pull-downs, into U1 74HC08 pins 1 and 2 (gate 1, output 3). C and
D: also to +5 with R3, R4 pull-downs, into pins 4 and 5 (gate 2, output 6). Gate 3: pin 9 from pin 3, pin 10 on
jumper W1 to +5 (so only A and B count). Pins 12 and 13 to −. Pin 8 → R7 2.2 kΩ → Q1 (2N3904) base; emitter to −;
relay K1 coil from +9.4 to Q1's collector with D9 (1N4001) across it, band to +9.4; K1's NO contact lights the castle
gate lamp D1 (and swings CH11's door, in a castle skin, once NEW CB5 exists). Probe LP1 (known) on the desk. Fix-it bench: C
flipped correctly; D's pull-up fitted but S4's leg still on +5.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My castle lock opens for A and B. Mash all four." | Hold S1 to S4. | Click: the gate lamp lights. Note on K1: "mash everything: it opens" |
| 2 | "Wrong keys must stay up. Flip C: pull-up, key to minus." | Move R3's end to +5 and S3's leg to −. | Probe on pin 4: H untouched, L pressed. Note on R3: "untouched C now reads high" |
| 3 | "Flip D too. Then move pin 10's wire to pin 6." | Flip D; move W1's end from +5 to pin 6. | |
| 4 | Predict: "Mash all four now. The gate..." chips "opens", "stays shut" | Hold S1 to S4. | Shut. Note: "C or D pressed: locked". Rule: "Flip the pull to check keys are up." |
| 5 | "Now only A and B." | Hold S1 and S2. | Click; the gate lamp lights. |
| 6 | Check: "C is pressed. What does pin 4 read?" chips "high", "low" | Pick a chip. | Answer "low". |
| 7 | Secret: "Secret: how many two-key chords hide in four keys?" chips "4", "6", "8" | Optional pick. | Answer "6". Note: "eight keys, four held: 70" |
| 8 | Fix-it: "My lock opens even with D held. Fix it." | Move S4's leg from +5 to −. | D held: locked. Note: "pull-up keys press to minus" |
| 9 | "Case closed. Only the right chord opens it." | Sign the page. | |

**Objectives** (3 eyes)

- O1 A bad lock: `mash-opens` (S1 to S4 closed and `lab.closed("K1")`).
- O2 Flip the pulls: `flip-c` (R3 joins U1.4 and +5; S3 joins U1.4 and −), `flip-d` (the same for R4, S4, U1.5),
  `link` (`lab.connected("U1.6", "U1.10")`).
- O3 A good lock: `mash-shut` (all four held, K1 open, held 1 s), `chord-opens` (only S1 and S2 held, K1 closed).
- Secret: `chord-count` (bonus; the chip "6").
- Fix-it: `fix-it` (S4 joins U1.5 and −; with S1, S2 and S4 held K1 is open; with S1 and S2 only, closed).

**Checks:** beat 6 "low"; secret "6".

**Notebook page:** "Chips 20: Chord lock". The four keys drawn as a little keypad, A and B tied up to plus by their
keys, C and D pulled up and pressing to minus; the three ANDs as a small tree into the relay. Notes, rule, the beat 4
guess, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "A flipped key idles high and presses low." Fried (only if the
relay's diode is removed and the transistor dies): "My transistor took the coil's kick. Diode back, fresh transistor."

**On demand:** beat 2 "Resistor end to the +5 rail, key leg to minus." · beat 3 "Pin 6 is gate 2's answer." · fix-it
"A pull-up key must press toward minus."

**Accuracy:** The lock opens for A · B · (not C) · (not D), the same as A AND B AND (NOT (C OR D)): "none of these" is a
NOR, built here from ANDs by flipping the pulls. Three of the 74HC08's four gates; the spare's inputs go to minus. The
2N3904's base current from a 5 V output through 2.2 kΩ is about 1.9 mA; the relay coil takes 9.4 V ÷ 540 Ω ≈ 17 mA.
The 1N4001 across the coil, band toward plus, catches the coil's kick (Unit 2). 5 V and 9.4 V share one minus, so the
transistor's base current has a way home. Chords of 2 from 4 keys: 6; of 4 from 8: 70. The lock checks a set held
together, not an order.

**Words:** main path 120, on demand 41.

---

### CH21. `two-gates-remember`: Two gates that remember

- **Minutes** 6 · **Wave** 1 · **Island piece** `switch` · **Unlocks** none.
- **Big idea:** Feed two NOR gates' outputs back into each other and they hold whichever state they were last pushed
  into, even with the switch gone.
- **New:** the word "feedback". "Latch" gets its period 3 here (periods 1 and 2 were CH6).
- **Case:** "Two gates that remember". Robot intro: "My castle needs a memory. Flip the switch both ways."

**Bench.** The 5 V rail. U1 74HC02: gate 1 (output pin 1, inputs 2 and 3), gate 2 (output pin 4, inputs 5 and 6);
SW1 slide switch, pole to +5, throw a to pin 2, throw b to pin 6, with R1 and R2 10 kΩ pull-downs on pins 2 and 6;
jumper W1 from pin 3 to −, W2 from pin 5 to −; gates 3 and 4 inputs to −. Lamp drivers U2 (74HC08, locked): gate 1's
inputs both on pin 1 → R and D1; gate 2's inputs both on pin 4 → R and D2. Fix-it bench: W1 crossed (pin 3 from pin 4)
but W2 still on −.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My castle needs a memory. Flip the switch both ways." | Flip SW1 to a, then to b. | The lamps swap. |
| 2 | Predict: "Pull the switch out. The lamps will..." chips "keep their state", "both light" | Lift SW1 into the tray. | Both light. Note: "no input: no memory" |
| 3 | "Put it back. Cross the wires: each output into the other gate." | Move W1's end from − to pin 4, W2's from − to pin 1. | |
| 4 | Predict: "Flip it, then pull it out. The lit lamp..." chips "stays lit", "goes dark" | Flip SW1; lift it out. | Stays lit. Note on W1 and W2: "feedback: each holds the other". Rule: "Two gates fed back remember." |
| 5 | "Show me the feedback." | Tap W1 or W2 (period 2). | |
| 6 | Check: "What is this pair of gates now?" chips "a latch", "a counter", "a clock" | Pick a chip (period 3). | Answer "a latch". |
| 7 | Secret: "Secret: jumper both inputs to plus at once." | Optional: two jumpers, +5 to pins 2 and 6. | Both lamps dark. Note: "both set: no memory left" |
| 8 | Fix-it: "My memory forgets one side. Fix it." | Move W2's end from − to pin 1. | It holds either way. Note: "both wires must cross" |
| 9 | "Case closed. Two gates, one memory." | Sign the page. | |

**Objectives** (3 eyes)

- O1 No memory yet: `forgets` (SW1 off the board, D1 and D2 both lit).
- O2 Cross: `cross-wires` (`lab.connected("U1.1", "U1.5") && lab.connected("U1.4", "U1.3")`).
- O3 Remember: `remembers` (after SW1 leaves the board, the lamp that was lit stays lit and the other dark, held 3 s;
  for both states).
- Secret: `both-set` (bonus; U1.2 and U1.6 both high and both lamps dark).
- Fix-it: `fix-it` (both crossed; holds either state with the switch out).

**Checks:** beat 6 "a latch".

**Notebook page:** "Chips 21: Two gates that remember". The two NOR symbols with their outputs crossed back, the switch
drawn lifted away and one lamp still glowing. A margin link to the 555 map's latch. Notes, rule, both guesses, fix-it
tick, secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Each output goes to the other gate's spare input." Fried:
none expected: "Nothing hurt. Just forgetful."

**On demand:** beat 3 "Pin 1 to pin 5, pin 4 to pin 3." · beat 4 "Flip first, then lift it out." · fix-it "Is every
output fed across?"

**Accuracy:** NOR: any high input forces a low output. Crossed, each gate's low output lets the other stay high, so the
pair holds its state with both outside inputs low (pull-downs). Both outside inputs high give both outputs low, which
is not a memory state; released together, the model's slightly different gates settle one way. The 555's latch (CH6)
does the same job. The lamps hang on a 74HC08 used as two buffers, so the latch's own outputs carry no lamp current.
74HC02 pins: outputs 1, 4, 10, 13.

**Words:** main path 110, on demand 34.

---

### CH22. `chatter`: One press, many counts

- **Minutes** 7 · **Wave** 1 (bare 4026B and display at 5 V until the modules exist) · **Island piece** `pushbutton` ·
  **Unlocks** none.
- **Big idea:** A switch's contacts bounce for a few milliseconds, so one press can give several clock edges; a latch
  fed from a two-way switch takes only the first touch.
- **New:** the word "bounce".
- **Case:** "One press, many counts". Robot intro: "Count my castle's visitors. Press the button once."

**Bench.** The 5 V rail. DM1, a 5 V digit module (4026B, display, 1 kΩ per bar), its RST on a button. S1, a pushbutton
with `bounce: 5` (NEW CB11), from +5 to strip `btn` with R1 10 kΩ to −; jumper W1 from `btn` to DM1.CLK. Scope (known)
on DM1.CLK with single-shot capture (`capture: { ms: 10 }`). CH21's latch on the board (U1 74HC02 crossed, lamp drivers
U2), fed by SW2, a slide switch with `bounce: 5`; its output Q on strip `q`. Shelf (secret): U3, a CMOS 555 one-shot
(10 kΩ, 10 µF, about 0.11 s) with a pull-up on pin 2 and a loose lead on pin 3. Fix-it bench: the latch fed from a
pushbutton S5 on pin 2 only, pin 6 left on its pull-down; DM1.CLK on `q`.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Count my castle's visitors. Press the button once." | Press S1 once. | The count jumps by several, not one. Note on DM1: "one press, several counts" |
| 2 | "Arm the scope, then press again." | Arm the capture; press S1. | A few ms of on, off, on before it settles. Note on the trace: "bounce: the contacts chatter" |
| 3 | "Clock wire to the latch now. Flip its switch five times." | Move W1's end from `btn` to `q`; flip SW2 on and off five times. | Exactly five counts. Note on U1: "the latch takes the first touch". Rule: "A latch ignores the bounce." |
| 4 | "Show me a bounce." | Tap a chatter spike on the capture (period 2). | |
| 5 | Check: "What is this?" (the spikes glow) chips "bounce", "a clock", "hum" | Pick a chip (period 3). | Answer "bounce". |
| 6 | Secret: "Secret: let a one-shot count the button instead." | Optional: S1's strip to U3.2, U3.3 to DM1.CLK. | One count per press. Note: "a one-shot ignores chatter too" |
| 7 | Fix-it: "My latch counts once, then never again. Fix it." | Swap S5 for a slide switch across both inputs. | One count per flip. Note: "a latch needs two throws" |
| 8 | "Case closed. One visitor, one count." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Extra counts: `bouncy` (one closed spell of S1 and the count up by 2 or more).
- O2 See it: `catch-bounce` (a capture holding 3 or more rising crossings on DM1.CLK: NEW `lab.capture()`, CS3).
- O3 Clean: `latch-count` (DM1.CLK joined to U1's Q; five SW2 round trips give exactly five counts).
- Secret: `one-shot` (bonus; through U3, five presses give five counts).
- Fix-it: `fix-it` (a changeover switch on both latch inputs; five flips, five counts).

**Checks:** beat 5 "bounce".

**Notebook page:** "Chips 22: One press, many counts". The captured chatter traced in ink beside the clean step from the
latch, with the counts each one caused. Notes, rule, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "A slide switch has two throws. The latch needs both." Fried:
none expected: "Nothing broke. The button just stutters."

**On demand:** beat 2 "Press Arm, then press the button." · beat 3 "On and off is one round trip: one count." · fix-it
"A button can set the latch. What clears it?"

**Accuracy:** Contact bounce typically lasts 1 to 10 ms (the model: 3 to 8 touches over up to 5 ms on a press and 1 to
3 rebounds on release, seeded per press, so each press differs). The 4026B counts every rising edge, even 1 ms apart. A changeover switch leaves its old
throw cleanly and chatters only on the throw it is arriving at; the latch is already set by the first touch, so the
chatter changes nothing. A single-throw button can only set the latch; nothing clears it. A 555 one-shot whose pulse
(1.1 × 10 kΩ × 10 µF ≈ 0.11 s) outlasts the chatter also gives one clean edge. A capacitor on a clock line is not a
fix (a slow edge can count twice on real chips). The 4026B and the CMOS 555 both run at 5 V here, so their levels match
the 74HC02.

**Words:** main path 89, on demand 40.

---

## 7. Module 5: The arcade (`arcade`)

Landmark `dice-arcade`. Games for the islanders: a quiz buzzer that only one player can win, lamps that count in
binary, a counter that stops at six, and dice. All at 5 V; every 555 here is the CMOS kind.

---

### CH23. `first-buzzer-wins`: First buzzer wins

- **Minutes** 7 · **Wave** 2 (timing diagram NEW CP3 with slow motion NEW CS4, robot player NEW CR12) · **Island
  piece** `fuse` · **Unlocks** `ic-555-cmos`.
- **Big idea:** Feed the winner's output back to every player's input through OR gates, and the first press locks all
  the others out.
- **New:** nothing new to name: OR gates (CH18) and 555 latches (CH6). The CMOS 555 (same pins, outputs that reach the
  rails) gets a note.
- **Case:** "First buzzer wins". Robot intro: "Quiz night. Press your buzzer, and I'll press mine."

**Bench.** The 5 V rail. U1 and U2, CMOS 555s as latches (pin 6 to −; pin 4 on a shared RESET line with R9 10 kΩ to +5
and S9 "RESET" to −). S1 (your buzzer) from node P1 to −, R1 10 kΩ from P1 to +5; S2 (the robot's buzzer, pressed by
the robot, NEW CR12) the same on P2. U3 74HC32: gate 1 (pins 1, 2 → 3) takes P1 and the block line, its output to
U1.2; gate 2 (pins 4, 5 → 6) takes P2 and the block line, output to U2.2; gate 3 (pins 9, 10 → 8) takes U1.3 and U2.3:
the block. Pins 2 and 5 (the block line) sit on jumper W1 to −; gate 4's inputs to −. R and D1 on U1.3, R and D2 on
U2.3. Timing diagram TD1: P1, P2, the block (U3.8), U1.3, U2.3, with slow-motion replay. Fix-it bench: the block line
reaches pin 2 only; pin 5 stays on −.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Quiz night. Press your buzzer, and I'll press mine." | Press S1; the robot presses S2 half a second later. | Both lamps light. Note on U1: "CMOS 555: same pins, full swing". |
| 2 | "Press RESET. Then move the block wire from minus to pin 8." | Tap S9; move W1's end to U3.8. | Note on W1: "no block yet: everyone won" |
| 3 | Predict: "You first, then me. My lamp..." chips "lights", "stays dark" | Race. | Stays dark. Note on U3.8: "the winner blocks the rest". Rule: "Feed the winner back: the rest lock out." |
| 4 | Check: "You won. What does my trigger read now?" chips "high", "low" | Pick a chip (the probe may help). | Answer "high". |
| 5 | "RESET. This time, let me win." | Tap S9; wait for the robot, then press S1. | The robot's lamp only. |
| 6 | Secret: "Secret: replay a win in slow motion." | Optional: slow-motion on TD1. | The block rises about 0.1 µs after the winner. Note: "blocked within 0.1 µs" |
| 7 | Fix-it: "I can still buzz after you win. Fix it." | Move pin 5's jumper from − to the block line. | Note: "every player needs the block" |
| 8 | "Case closed. One winner per question." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Everyone wins: `both-win` (D1 and D2 lit together).
- O2 Lock out: `block-line` (`lab.connected("U3.2", "U3.8") && lab.connected("U3.5", "U3.8")`), `you-win` (after a
  reset, S1 then S2: D1 lit, D2 dark, held 1 s).
- O3 Both ways: beat 4 check; `robot-wins` (after a reset, S2 then S1: D2 lit, D1 dark, held 1 s).
- Secret: `slow-motion` (bonus; the replay opened on a win).
- Fix-it: `fix-it` (`lab.connected("U3.5", "U3.8")`; S1 pressed and released, then S2: D2 dark).

**Checks:** beat 4 "high".

**Notebook page:** "Chips 23: First buzzer wins". The slow-motion timing diagram: P1 falls, U1.3 rises, the block rises,
P2 falls too late. Notes, rule, the beat 3 guess, fix-it tick, secret box. Optional rounds against the robot tallied.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "The block must reach every player's OR." Fried: none
expected: "Nothing broke. I was just slow."

**On demand:** beat 2 "Pin 8 is gate 3's output: the block." · beat 4 "A high on either OR input makes it high." · fix-it
"Does my OR see the block?"

**Accuracy:** An OR's output is low only when both inputs are low, so a player's trigger dips only while their buzzer is
pressed and the block is low. A 555 latch sets on the first dip and stays set when the trigger returns high; RESET low
clears both (the 555's reset is active low). CMOS 555s at 5 V give outputs at the rails that 74HC inputs read cleanly
(a bipolar 555's high sits about 1.5 V under its supply, marginal at 5 V). The lockout window is about the 555's delay
plus two gate delays (about 0.1 µs in the model); presses closer than that could both win, far closer than hands can
manage. Single-throw buzzers need no debouncing here: the latch takes the first touch. The lamps hang on the 555
outputs, which are strong, not on 74HC outputs.

**Words:** main path 102, on demand 36.

---

### CH24. `count-in-binary`: Count in lamps

- **Minutes** 7 · **Wave** 1 · **Island piece** `led-lamp` · **Unlocks** `counter-74hc393`.
- **Big idea:** Four lamps can count to 15 if each lamp is worth double the one before: that is binary.
- **New:** the binary counter chip (74HC393, DIP-14) and the word "binary", one idea: a count kept in lamps.
- **Case:** "Count in lamps". Robot intro: "This counter counts in lamps. Switch on its clock."

**Bench.** The 5 V rail. U1, a CMOS 555 clock (10 kΩ, 100 kΩ, 10 µF, about 0.69 Hz) with its own lamp D0, powered
through slide switch SW1. U2 74HC393: pin 1 (clock 1) from U1.3; pin 2 (clear 1) with R1 10 kΩ to − and S1 "RESET" to
+5; outputs QA to QD (pins 3 to 6) into U3, a 74HC08 as lamp drivers (locked), which light D1 to D4 through 1 kΩ each;
counter 2's clock (13) and clear (12) to −. Tags panel (known `tags`): 1, 2, 4, 8 to drop on the lamps. Fix-it bench:
the clock wire on pin 13 instead of pin 1.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This counter counts in lamps. Switch on its clock." | Flip SW1. | Lamp 1, then lamp 2 alone. Note on U2: "binary counter: lamps for digits" |
| 2 | Predict: "After lamp 2 alone comes..." chips "lamp 3", "lamps 1 and 2" | Watch. | Lamps 1 and 2. Note: "1 + 1 makes 10: carry left" |
| 3 | "Tag each lamp with its worth." | Drop the tags 1, 2, 4 and 8 on the lamps. | Rule: "Each lamp is worth double the last." |
| 4 | Check: "Lamps 8, 2 and 1 are lit. What number?" | Type a number. | Answer 11. |
| 5 | Predict: "After all four lamps, 15, comes..." chips "16", "0" | Watch (fast-forward allowed). | All dark. Note: "15 rolls over to 0" |
| 6 | "Show me the binary counter." | Tap U2 among the chips (period 2). | |
| 7 | Check: "What is this?" (U2 glows) chips "a binary counter", "a decade counter", "a gate" | Pick a chip (period 3). | Answer "a binary counter". |
| 8 | Secret: "Secret: does it step as my clock lamp lights, or goes out?" chips "lights", "goes out" | Optional pick, then watch. | Answer "goes out". Note: "the 393 steps on the fall" |
| 9 | Fix-it: "My counter never moves. Fix it." | Move the clock wire from pin 13 to pin 1. | It counts. Note: "pin 1 clocks counter one" |
| 10 | "Case closed. I count in binary now." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Watch it: `count-on` (`lab.part("U2")?.extra?.count1` has reached 3).
- O2 Worth: `worth` (`lab.panel("worth").correct`), the beat 4 check.
- O3 Roll over: `roll-over` (`count1` went from 15 to 0).
- Secret: `on-the-fall` (bonus; the chip "goes out").
- Fix-it: `fix-it` (`lab.connected("U1.3", "U2.1")` and the count changes).

**Checks:** beat 4, 11; beat 7 "a binary counter"; secret "goes out".

**Notebook page:** "Chips 24: Count in lamps". A table the bench fills: counts 0 to 15 as lamp patterns, the place
values 8, 4, 2, 1 over the columns. Notes, rule, both guesses, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Add up the worths of the lit lamps." Fried: none expected:
"Nothing hurt. Lamps count, chips relax."

**On demand:** beat 3 "Lamp 1 changes fastest. It is worth 1." · beat 4 "8 + 2 + 1." · fix-it "Pin 13 clocks the second
counter."

**Accuracy:** 74HC393, dual 4-bit ripple counter: clock 1 pin 1, clear 1 pin 2 (active high, holds 0000 while high), QA
to QD pins 3 to 6, ground 7, counter 2 on pins 8 to 13 (QD 8, QC 9, QB 10, QA 11, clear 12, clock 13), plus 14. It
steps on the clock's falling edge. Counts 0000 to 1111 (0 to 15), then 0000. Place values 1, 2, 4, 8 (QA lowest);
1011 = 11. Lamps through a 74HC08 used as buffers, about 3 mA each through 1 kΩ. The CMOS 555 clock: 1.44 ÷
((10 kΩ + 200 kΩ) × 10 µF) ≈ 0.69 Hz, so a full lap of 16 takes about 23 s.

**Words:** main path 126, on demand 31.

---

### CH25. `roll-a-six`: Stop at six

- **Minutes** 6 · **Wave** 1 (the secret's slow motion needs CS4) · **Island piece** `dice-block` (NEW) · **Unlocks**
  none.
- **Big idea:** Wire a pattern back to the clear pin and the counter starts over the moment it reaches that number, so
  it counts from 0 to one less.
- **New:** nothing new to name.
- **Case:** "Stop at six". Robot intro: "A die needs six faces. Jumper lamp 8's pin to reset."

**Bench.** CH24's counter and lamps, RESET button gone; pin 2 (clear 1) keeps its 10 kΩ pull-down and has a free jumper
W1. U4, a second 74HC08, gate 1's inputs and output on free strips. Timing diagram TD1 (clock, QA to QD, clear). Fix-it
bench: the AND fed from QA and QC.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "A die needs six faces. Jumper lamp 8's pin to reset." | W1 from QD (pin 6) to pin 2. | Counts 0 to 7, then 0. Note: "reset at 8: 0 to 7" |
| 2 | "Now try lamp 4's pin." | Move W1 to QC (pin 5). | 0 to 3. Note: "reset at 4: 0 to 3". Rule: "Reset on a number: count stops below it." |
| 3 | Check: "Six is 4 + 2. Which lamps feed the AND?" chips "4 and 2", "4 and 1", "2 and 1" | Pick a chip. | Answer "4 and 2". |
| 4 | "Wire lamps 4 and 2 into the AND, its output to reset." | QC to U4.1, QB to U4.2, U4.3 to pin 2; W1 off. | 0 to 5. Note: "0 to 5: six faces" |
| 5 | Check: "How many different counts now?" chips "5", "6", "7" | Pick a chip. | Answer "6". |
| 6 | Secret: "Secret: slow time right down at the reset." | Optional: slow-motion replay on TD1. | A 6 shows for a few nanoseconds. Note: "6 lives nanoseconds: a glitch" |
| 7 | Fix-it: "My die has only five faces. Fix it." | Move the AND's input from lamp 1's pin to lamp 2's. | 0 to 5. Note: "4 + 1 is 5: wrong stop" |
| 8 | "Case closed. Six faces, every time." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Stop at 8: `stop-at-8` (`lab.connected("U2.6", "U2.2")`; over 9 or more steps only counts 0 to 7 seen).
- O2 Stop at 4: `stop-at-4` (QC to clear; only 0 to 3 seen).
- O3 Stop at 6: beat 3 check; `stop-at-6` (QB and QC into an AND whose output reaches U2.2; over 7 or more steps only 0
  to 5 seen); beat 5 check.
- Secret: `glitch` (bonus; the replay shows `count1` at 6, NEW CS4).
- Fix-it: `fix-it` (AND inputs QB and QC; only 0 to 5 seen).

**Checks:** beat 3 "4 and 2"; beat 5 "6".

**Notebook page:** "Chips 25: Stop at six". The count drawn as a ring of states 0 to 5 with the AND tapping 4 and 2 back
to the clear pin; the glitch drawn as a tick too thin to see. Notes, rule, fix-it tick, secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Which lamps are lit at the count you want to skip?" Fried:
none expected: "No harm. Just a short die."

**On demand:** beat 1 "Lamp 8 is QD, pin 6." · beat 4 "Both AND inputs, then its output to pin 2." · fix-it "4 + 1 is
5. Six is 4 + 2."

**Accuracy:** The clear is level-held: the moment the count reaches the pattern, the clear empties it, so the pattern
state lasts only nanoseconds (the model shows it for a few ns). QD to clear: 0 to 7 (mod 8); QC: 0 to 3; QB: 0 to 1;
QB AND QC: 0 to 5 (110 is the first count with both high); QB AND QD gives 0 to 9; QA AND QC gives 0 to 4 (the fix-it's
fault). The four stages ripple a few gate delays apart.

**Words:** main path 116, on demand 40.

---

### CH26. `binary-dice`: Pips from bits

- **Minutes** 8 · **Wave** 2 (arcade board NEW CB7, histogram NEW CP6) · **Island piece** `cell-jar` · **Unlocks**
  `ic-socket`.
- **Big idea:** A few gates can turn a count into any pattern you like: here, the pips of a die.
- **New:** nothing new to name. The 74HC27 is a NOR with three inputs, and the arcade board's chips sit in sockets; both
  get a note.
- **Case:** "Pips from bits". Robot intro: "Watch my die count, slowly. Which faces show?"

**Bench.** The arcade dice board DB1 (NEW CB7, our design) plugged into the 5 V rail: seven pip LEDs laid out as a die,
DIP sockets, test-point jumpers. U1, a CMOS 555 roll clock (10 kΩ, 10 kΩ, 10 nF, about 4.8 kHz; switch SLOW swaps in
47 µF for about 1 Hz), its pin 4 on a 10 kΩ pull-down with ROLL (S1) to +5, so it runs only while ROLL is held. U2
74HC393 counter 1, cleared at 6 by U3 gate 1 (QB AND QC). Decoder: U4 74HC27 gate 1 = NOR(QA, QB, QC); U5 74HC32 gate
1 = OR(QC, that NOR); gate 2 = OR(QB, gate 1). Pips: the centre (QA through lamp driver U3 gate 2), one LED with 1 kΩ;
the middle pair (the NOR through U3 gate 3), two LEDs in series with 470 Ω; diagonal pair one (U5 gate 1 through U3 gate
4), two in series with 470 Ω; diagonal pair two (U5 gate 2 direct), two in series with 470 Ω. Test jumper TP1 parks U5
pin 1 (where QC belongs) on −. Shelf (secret): DB2, a second die board, its clock lead loose; histogram HG1 (NEW CP6)
with an auto-roller. Fix-it bench: DB1 complete except its clear jumper TP2 lifted off U3's output.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Watch my die count, slowly. Which faces show?" | SLOW on; hold ROLL. | 6, 1, 2, 3, then a blank face, then 1. Note on the blank: "count 4: a blank face" |
| 2 | "Tap the centre pip." | Tap it. | Its wire lights back to lamp 1's pin. Note: "centre: lit on odd counts" |
| 3 | Predict: "The middle pair lights for..." chips "000 only", "every even count" | Watch a lap. | Only at 000. Note on U4: "3-input NOR: lit when all low" |
| 4 | "Finish the corners: move the test jumper onto lamp 4's pin." | Move TP1 from − to QC. | Four and five show properly. Note: "corners: four, five and six". Rule: "A few gates turn counts into pips." |
| 5 | "Now roll for real. SLOW off, hold ROLL, let go." | Roll a few times. | Random faces. Note on DB1: "chips in sockets: no solder" |
| 6 | Check: "Count 011. Which face?" chips "2", "3", "4" | Pick a chip. | Answer "3". |
| 7 | Secret: "Secret: plug in die two. Roll a thousand times." | Optional: DB2's clock lead to DB1's QC; auto-roll 1,000 on HG1. | All 36 pairs about equal. Note: "36 pairs, about 28 each" |
| 8 | Fix-it: "My die rolls too many fours and fives. Fix it." | Put TP2 back on U3's output. | Six faces in order. Note: "no stop: fours, fives twice" |
| 9 | "Case closed. Fair dice for the arcade!" | Sign the page. | The arcade lights up: the unit's last stamp. |

**Objectives** (3 eyes)

- O1 Watch it: `slow-roll` (SLOW on; `count1` has gone round 0 to 5 once; the blank face seen: `face(lab, pips) ===
  0`).
- O2 Decode: `finish-corners` (`lab.connected("U5.1", "U2.5")`; in SLOW all six faces seen).
- O3 Roll: `fast-roll` (SLOW off; ROLL held 0.2 s or more, then released; a face shown), the beat 6 check.
- Secret: `two-dice` (bonus; DB2's clock joined to DB1's QC and HG1 holding 1,000 rolls or more).
- Fix-it: `fix-it` (TP2 on U3.3; in SLOW exactly six faces, each once a lap).

**Checks:** beat 6 "3".

**Notebook page:** "Chips 26: Pips from bits". The decoder table: count, the three bits, the face drawn as pips; the
learner's roll and, if found, the 36-pair histogram. Notes, rule, the beat 3 guess, fix-it tick, secret box. The page
carries the "Chips: complete" stamp.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Corners light for four, five and six. Which bit says four?"
Fried: none expected: "Nothing broke. The die was just unfair."

**On demand:** beat 4 "Lamp 4 is QC, pin 5." · beat 5 "Hold, then let go. Your timing is the luck." · fix-it "What
stops this counter at six?"

**Accuracy:** Faces by count (QC QB QA): 000 six, 001 one, 010 two, 011 three, 100 four, 101 five. Centre = QA; middle
pair = NOR(QA, QB, QC); diagonal one = QC OR middle; diagonal two = QB OR diagonal one. With QC parked low, count 100
shows nothing and 101 only the centre (beat 1). Two red LEDs in series drop about 3.8 V, so (5 − 3.8) ÷ 470 ≈ 2.5 mA;
the centre gets about 3 mA through 1 kΩ. Every signal that also feeds a gate drives its pips through a buffer (spare
74HC08 gates). Roll clock 1.44 ÷ ((10 kΩ + 20 kΩ) × 10 nF) ≈ 4.8 kHz: a lap of six in about 1.25 ms, both dice's 36
pairs in 7.5 ms, far finer than a finger's timing, which is where the luck comes from. Die two is clocked by die one's
QC, which falls once a lap (110 cleared to 000), so the pair visits all 36 combinations for equal times. 1,000 rolls:
each face about 167 times, each pair about 28. With the clear lifted, counts 110 and 111 show four and five again, so
those faces come up twice as often. 74HC27 triple 3-input NOR: gate 1 inputs 1, 2, 13, output 12. Sockets let chips
come out without desoldering; mind the socket's notch as well as the chip's.

**Words:** main path 120, on demand 39.

---

## 8. NEW NEEDS

Already there and used as is: the bench parts and props of Units 1 and 2 (`pushbutton`, `slide-switch`, `dpdt-switch`,
`toggle-switch` on a desk block, `trimmer`, `electrolytic-cap`, `ceramic-cap`, `diode`, `npn`, `relay`, `speaker`,
`tag`, `clock`), the meter, the scope with `pitch` and single-shot `capture`, the stopwatch, the `tags` panel, the
time-lapse control, `lab.periods`, `lab.toneHz`, `lab.toneHistory`, `lab.heldFor`, `lab.stats`, `lab.timeAbove`,
`lab.history`, `lab.chain`, `lab.joins`, `lab.actual`; and in the simulator the kinds `timer555` (with `cmos`),
`logic` (74HC00, 02, 04, 08, 27, 32, 86, 393 and the 4026B), `sevenseg`, `regulator7805`, the `bounce` field and the
`proximity` input. Start here's R1 to R11, V7 (loop tracer), P7 (sealed box, reused for modules) and S1 are assumed.

Sizes: S small (a day or two), M medium (about a week), L large (more than a week).

### 8.1 Lesson player and lab runtime

| Id | Need | Size | Used in |
|---|---|---|---|
| CR1 | Chip pins as attach points and tap targets: `U1.1` to `U1.16` by number, with function aliases (`U1.trig`, `DM1.CO`); a wrong tap shows the pin's number, and its name once a lesson has named it. | S | all |
| CR2 | The 555 map: a notebook page whose eight tags and inside blocks ink in as each pin's period 1 lands, kept across lessons in progress, stamped complete in CH10 (section 2.4). | S | CH1 to CH10 |
| CR3 | `lab.chipSeat(id)`: `{ straddles, pin1: "left" \| "right", turned, columns }` from the bench, for seating goals. | S | CH1, CH18, CH26 |
| CR4 | `lab.widths(source, level?, seconds?)`: the lengths of the high stretches (with `lab.periods`, the duty cycle). | S | CH7, CH9 |
| CR5 | `lab.logic(node)`: `H`, `L`, `X` or `Z` from the chip pin's `extra` level, or by 30% and 70% of the local supply for a plain node. | S | CH18 to CH26 |
| CR6 | History sources `closed:<id>` (buttons and switches) and `count:<id>` (a counter's state). | S | CH2, CH14, CH22, CH24 |
| CR7 | Stopwatch triggers `{ part, lit }` and `{ node, above \| below }`. | S | CH2 to CH5 |
| CR8 | Sticky hold (tap to hold a button down on touch screens, a pin marks it held) and keys bound to buttons for a second player. | S | CH20, CH23 |
| CR9 | Hand proximity control: `controls: [{ id: "hand", key: "proximity", part: "U1" \| "*" }]`, drawn as an ink hand dragged toward the chip. | S | CH3, CH18 |
| CR10 | `lab.bench.rejected`: parts the bench refused to seat (a surface-mount chip on holes). | S | CH1 |
| CR11 | Check prompts and chips templated from bench state ("The digits read {reading}. Your time?"). | S | CH16 |
| CR12 | A scripted bench actor: the robot presses a button after a delay or after the learner, for games and demos. | S | CH23 |

### 8.2 Bench parts and props

| Id | Need | Size | Used in |
|---|---|---|---|
| CB1 | `chip` kind: DIP-8, 14 and 16 bodies with a `model` ("555", "555-cmos", "74HC00", "74HC02", "74HC04", "74HC08", "74HC27", "74HC32", "74HC86", "74HC393", "4026B") mapped to `timer555` or `logic` with pins by number; seats across the channel or anywhere else and is simulated as placed (turned round, on one side); `label` and `hidden: true` for taped mystery chips; `package: "soic"` for a lookalike that will not seat. | M | all |
| CB2 | `seven-seg` display: 10 pins, rows 0.6 in apart (c and g), common cathode; a `carrier` variant with a resistor per bar (`segmentOhms`). | S | CH13 to CH16, CH22 |
| CB3 | `regulator` (7805): a TO-220 on the board, legs in, ground, out; heat readout through the existing `inspect`. | S | CH17 on |
| CB4 | `dip-switch`: 8 positions in a DIP-16 footprint, each a `switch` from pin n to pin 17 − n; tags relabel them. | S | CH13 |
| CB5 | Door and window props: a desk wall with a hinged door and a window, magnet modules on the moving parts, reed modules (`reed-switch`) with screw terminals on the frame. The reed is a `switch` whose `closed` follows the magnet's distance (no simulator change). A lead "snip" (unclip) action reads as a cut wire. A castle skin for CH20's gate. | M | CH11, CH12, (CH20) |
| CB6 | Plug-in modules: a small labelled board with a header row that plugs into the breadboard; inside, a sub-bench (any parts), shown with Start here's sealed-box lid (P7) that the learner may lift. Digit module (4026B, display, resistors; 9 V and 5 V variants), voice module (CH8's singer with an EN pin on its pin 4). | M | CH12, CH15, CH16, CH22 |
| CB7 | IC sockets (DIP-8, 14, 16) that chips plug into, with their own notch print, and the arcade dice board: our printed design with sockets, seven pip LEDs in a die layout, test-point jumpers and a header. A second board for die two. | M | CH26 |
| CB8 | Adjustable bench supply (Unit 3's `supply` need) with a 0 to 12 V knob; fallback until then: a cell-stack prop with a tap selector (1 to 8 AA). | S | CH17 |
| CB9 | Battery packs: 4.5 V (three AA) and 6 V (four AA) in holders, as `battery` bodies with their emf and internal resistance. | S | CH5, CH17 |
| CB10 | Mystery-chip tape: a `hidden` chip shows a taped "?1" label until a lesson reveals it. | S | CH19 |
| CB11 | `bounce` surfaced as a bench param on pushbuttons and slide switches, plus the global toggle in settings. | S | CH22 |

### 8.3 3D and ink models

| Id | Model | Size |
|---|---|---|
| CM1 | DIP bodies (8, 14, 16): black epoxy, a half-moon notch at the pin 1 end and a dimple dot by pin 1, generic part numbers printed in our own type (no maker names or logos), 2.54 mm pitch, rows 7.62 mm apart. Ink view: an outline with the notch and dot, pin numbers shown on tap, readable at phone size. | M |
| CM2 | Surface-mount lookalike (SOIC-8, 1.27 mm pitch), shown failing to seat. | S |
| CM3 | DIP sockets (8, 14, 16) with their own notch. | S |
| CM4 | 7-segment display: grey face, seven bars and a dot that glow one by one from the part's `extra` glows, dp at lower right, 10 pins; the carrier board with its resistors. | M |
| CM5 | TO-220 7805: black body, metal tab with its hole, three legs; a heat tint from `temp`. | S |
| CM6 | 1N4148: small orange glass body with a black band. | S |
| CM7 | DIP switch: 8 white sliders on a block, numbered, with tag slots below. | S |
| CM8 | Door sensor set: reed capsule (two contacts in glass) in a white module, magnet module, the wall with door and window; ink: a plan view of the door swinging. | M to L |
| CM9 | Logic probe: pen body, metal tip, red and black clip leads, H, L and pulse lamps (amber when lit). | S |
| CM10 | Plug-in module boards with header pins and a lid. | S |
| CM11 | Arcade dice board and a small cabinet for the arcade (our designs). | M |
| CM12 | Taped mystery chip (a paper strip with "?1"). | S |

### 8.4 Runtime panels and instruments

| Id | Need | Size | Used in |
|---|---|---|---|
| CP1 | Chip x-ray: tap a 555 and an ink inset opens beside it (a magnified bubble on phones, in both bench views) drawing its insides live: the ladder of three equal resistors, the 1/3 and 2/3 lines with their volts, the low and high watchers (amber when they fire), the latch (an on or off dot), the output stage, the drain switch (open or closed), the reset line. A block appears only once its pin is on the 555 map (CR2); the rest is blank paper. Fed by the 555's `extra` (latch, trigger, threshold, reset, discharge, upper, lower, output). `lab.view("xray:U1")`. | M to L | CH1 to CH10 |
| CP2 | Scope additions: reference lines at fractions of a node (`levels: [{ of: "U1.8", fraction: 2/3 }]`); a duty readout (high time, low time, duty) for a trace. | S | CH3, CH4, CH7, CH9 |
| CP3 | Timing diagram panel: `{ kind: "timing", id, channels: [{ label, node \| part }] }`, up to 8 channels drawn as high and low lines over a scrolling window, edges marked, a slow-motion replay of a chosen moment (stretching microseconds or nanoseconds, needs CS4) and a marker for states shorter than 1 µs. Goals read `lab.timing(id)`. | M | CH16, CH23, CH25 |
| CP4 | Truth table, extended: inputs may be pushbuttons (up and down) or nodes; the output may be an LED, a node or the logic probe's reading; `mystery: true` hides gate names until the table is complete. Goals read `cells` as today. | S | CH18, CH19 |
| CP5 | Logic probe instrument: powered from its clips (dark when unpowered); H above 70% and L below 30% of its supply, nothing between or when floating (flickering on a wandering pin); a pulse lamp that stretches any edge to about 0.1 s (needs CS3). `lab.logicProbe` returns `{ tip, reading, pulses }`. | S to M | CH19 on |
| CP6 | Histogram panel with an auto-roller: presses ROLL for a random human-like hold (0.15 to 0.6 s) N times and tallies faces (one die) or pairs and sums (two dice), with a "fair?" band. | M | CH26 |
| CP7 | Pop-up card `chip-care`: four habits sorted onto "do" and "don't" (section 8.7). Info only. | S | CH15 |

### 8.5 Simulator, beyond the kinds already added

| Id | Need | Size |
|---|---|---|
| CS1 | Long 555 delays and leakage: the model's 100 µF electrolytic leaks 1 MΩ (realistic for a worst-case part), which stretches 1.1 × 270 kΩ × 100 µF from 30 s to about 40 s. Labs set `leakOhms: 5e7` on long-delay timing capacitors (CH11, CH12); document it in LABS.md. No engine change. | S |
| CS2 | Golden tests for every number in this blueprint: one-shot 2.97 s; threshold 6.27 V of 9.4 V; astable 0.99 Hz with 0.54 s and 0.47 s; 1021 Hz and 440 Hz settings; the diode's duty (about 14% at R2 = 68 kΩ, 10% at 104.7 kΩ); pin 5's 2.0 to 8.1 V and 820 to 275 Hz; the dips of CH11 and CH12; carry on 9 to 0; the 1 kHz race clock; 7805 dropout; NOR latch hold; bounce counts; mod 6; every die face. | M |
| CS3 | Edge watch: crossing counts per watched node between snapshots, so goals and the probe's pulse lamp see edges the 30 Hz snapshot misses; `lab.capture()` returns the scope's single-shot samples. | S |
| CS4 | Slow-motion capture: a ring buffer of exact crossing times for watched nodes around an event, so the timing diagram can replay 0.1 µs (CH23) and a few-nanosecond glitch (CH25). The engine already locates crossings; this keeps them. | M |
| CS5 | Fast rolling: run 1,000 rolls headless at high speed, or record one 36-state lap's state times and sample release moments from it (exact for a steady clock). | M |
| CS6 | Harmless-mistake golden tests: a 555 turned round on CH1's bench (dark, no damage); a DIP on one side of the channel; CH9's diode across R1 (never conducts); CH11's door-close push above the supply on pin 2; CH17's 4.5 V feed; CH26's chip reversed in its socket. If any kills a part, the lesson changes. | S |
| CS7 | Power-up checks: a trigger still low at switch-on sets the latch (CH12's false alarm); a reset pin rising through 0.7 V on 10 kΩ and 100 µF releases cleanly after about 77 ms; a 100 µF keeps charge through a quick off and on. | S |
| CS8 | Power loss: unclipping a battery drops the chip's rail and loses its state, so the next power-up is a fresh coin toss (CH6's secret). | S |
| CS9 | Performance: CH16's bench (three 555s, one at 1 kHz, three 4026Bs and displays, a timing diagram) and CH26's (4.8 kHz clock, five logic chips, seven pips) at real time on a mid-range phone; add both to `test/perf.test.ts`. | M |

### 8.6 Island and course

| Id | Need | Size |
|---|---|---|
| CI1 | `alarm-lighthouse` added to `LANDMARKS_BY_UNIT.chips` and `LANDMARK_SPEC`; landmark models for all five; new pieces `chip-block`, `reed-gate`, `seven-seg`, `regulator`, `logic-chip`, `dice-block` in `PIECES` with footprints and art. | M |
| CI2 | `content/course.yaml`: `chips` moves from `upcoming` to `units` when wave 1 ships; module folders `timer-555`, `alarm`, `counters`, `logic`, `arcade`. | S |

### 8.7 The pop-up card (CH15)

Shown after beat 6 of CH15 as a card beat. Drag four habits onto "do" or
"don't". Each lands with its stamp line; a wrong drop slides across and shows its line. It counts as one graded check
(all four right on the first try).

| Habit | Tray | Stamp line |
|---|---|---|
| Keep chips in foam | do | "Foam ties every pin together." |
| Wear a wrist strap | do | "Its built-in resistor keeps you safe." |
| Shuffle on carpet first | don't | "Sparks you can't feel still harm CMOS." |
| Ground yourself to a wall socket | don't | "Never. Mains can kill." |

---

## 9. Accuracy checklist (unit-wide)

Per-lesson claims are in each lesson's **Accuracy** line. These hold across the unit; a fact-checker confirms each.

| Topic | Claim | Notes |
|---|---|---|
| 555 pins | 1 ground, 2 trigger, 3 output, 4 reset, 5 control, 6 threshold, 7 discharge, 8 supply | The control pin is pin 5 (some text says pin 2 once; pin 2 is the trigger). |
| 555 inside | Three equal resistors set 1/3 and 2/3 of the supply; trigger below 1/3 sets the latch; threshold above 2/3 clears it; reset low clears it and overrides both; a trigger held low wins over the threshold | Reset acts on the latch directly, not "through the threshold comparator". |
| Pin 5 | Driving it to Vc sets the upper threshold to Vc and the lower to Vc ÷ 2 | |
| 555 name | The number was a marketing choice; the "three 5 kΩ resistors" origin is a myth | The resistors are real (about 5 kΩ in bipolar parts). |
| One-shot | T = R × C × ln 3 ≈ 1.1 × R × C | 1.1 × 47 kΩ × 10 µF ≈ 0.52 s; 1.1 × 470 kΩ × 10 µF ≈ 5.2 s; 27 kΩ and 270 kΩ with 100 µF give about 3 s and 30 s; 1.1 × 100 kΩ × 10 µF ≈ 1.1 s (270 kΩ for 3 s). |
| Astable | f ≈ 1.44 ÷ ((R1 + 2 × R2) × C); high 0.693 × (R1 + R2) × C; low 0.693 × R2 × C; duty above 50% without a diode | |
| Speed | A bipolar 555 runs to a few hundred kHz | Not millions of cycles a second. |
| Outputs | A bipolar 555's high sits about 1.3 to 1.7 V under its supply; a CMOS 555 swings to the rails | Use a CMOS 555 (or a 74HCT input) when a 555 drives 74HC logic at 5 V. |
| Discharge | Never connect pin 7 to plus without resistance; 1 kΩ minimum, 10 kΩ usual | |
| Supply | Bipolar 555: 4.5 to 16 V; 74HC: 2 to 6 V, destroyed above 7 V; 4000B: 3 to 18 V | |
| 74HC levels | At 5 V, low below about 1.5 V, high above about 3.5 V (datasheets: VIL 1.35 to 1.5 V, VIH 3.15 to 3.5 V) | "Below 1 V is safely low, above 3.5 V is safely high" is a conservative design band, labelled as such. |
| Outputs and lamps | Design for about 4 mA per 74HC output; never drive a lamp and a logic input from the same 74HC output (buffer instead) | Some published dice and quiz designs break this rule; ours do not. |
| Pinouts | 74HC00, 08, 32, 86 share one pinout; the 74HC02's outputs are on pins 1, 4, 10, 13, so it is not a drop-in swap | |
| Active levels | 4026B reset and clock inhibit are active high; the 555's trigger and reset are active low; the 74HC393's clear is active high and level-held | |
| Edges | 4026B counts on the rising edge, 74HC393 on the falling edge | |
| Clock lines | Never put a capacitor on a clock line to clean it: decouple supply pins instead | A slow edge can count twice. |
| Transistor | 2N3904 in every example (some 2N2222 variants have reversed pinouts) | |
| Bounce | Typically 1 to 10 ms | |
| Reaction time | Simple visual reaction typically about 200 to 300 ms | A game, not a health or fitness test. |
| Static | CMOS chips can be harmed by discharges too small to feel; wrist straps have a built-in resistor (typically 1 MΩ); never ground yourself through mains | CH15 card. |
| Mains | Never part of a lab | |
| Source mistakes | Do not copy: a counter experiment numbered wrongly, a 393's clear called "pin 2 of the timer", a 393 labelled as a 74HC32 in figures, "3 s" for 100 kΩ and 10 µF | |

---

## 10. Notes for authors

- **Changes from the outline in `later-units.md`.** Modules: `alarm` now holds the oscillators (blink, pitch, duty,
  control pin) as well as the door guard, and `dice` becomes `arcade` (it opens with the quiz buzzer). `inside-the-555`
  is spread over CH2, CH4, CH6 and CH10 as the 555 map; its bistable mode is CH6; the inverting (Schmitt) mode is left
  for the parts bin. `square-wave-singer` became `blink-forever`, `sing-a-note` and `short-and-sweet`;
  `two-timer-warble` is CH10's secret (Unit 2's `siren` already taught a slow oscillator steering a fast one), and the
  divider-loading sandbox is reduced to CH10's accuracy facts. `door-guard-design` and `door-guard-build` became
  `door-left-open` and `armed-and-ready`; the randomised trials and the timeline panel are dropped, the test and live
  delays kept. `memory-and-bounce` split into `two-gates-remember` and `chatter`. Dropped: the chord lock's attacker
  bot (kept as a combinations secret) and the supply-sag dice bias (the model has no supply spike; a later bonus lab
  could add it).
- **New ids** (checked unique): `ghost-press`, `two-thirds-full`, `dial-a-delay`, `set-and-clear`, `blink-forever`,
  `sing-a-note`, `short-and-sweet`, `bend-the-pitch`, `door-left-open`, `armed-and-ready`, `count-the-ticks`,
  `flip-the-answer`, `two-gates-remember`, `chatter`.
- **Parts unlocks** (new `parts.yaml` entries): `ic-555` (CH1), `diode-1n4148` (CH9), `reed-switch` (CH11),
  `seven-segment` and `dip-switch` (CH13), `counter-4026b` (CH14), `regulator-7805` (CH17), `logic-gates` (CH18: the
  74HC00, 02, 04, 08, 27, 32 and 86 as one bin), `logic-probe` (CH19), `ic-555-cmos` (CH23), `counter-74hc393` (CH24),
  `ic-socket` (CH26). Parts-bin cards carry the datasheet names (comparator, flip-flop, monostable, astable,
  bistable) and the facts lessons leave out (the inverting mode, the 556, 74HCT, the shared display resistor).
- **Achievements** (suggested): `inside-out` ("Draw the whole 555", the CH10 map stamp, 25 XP); `quick-hands` (a race
  under 200 ms, hidden); `fair-and-square` (CH26's 1,000 rolls); `silicon-isle` ("Complete all 26 lessons of Chips",
  50 XP); `chip-secrets` ("Find eight secrets in Chips", 25 XP, hidden).
- **Bonus list for Chips** (for `chip-secrets`): `too-small`, `double-tap`, `weak-pull`, `hold-to-stretch`,
  `six-volts`, `power-back`, `two-lamps`, `octave`, `even-blink`, `warble`, `cut-wire`, `live-delays`, `hello`,
  `blur`, `to-999`, `quick-hands`, `fry-a-gate`, `xor-chip`, `not-gate`, `chord-count`, `both-set`, `one-shot`,
  `slow-motion`, `on-the-fall`, `glitch`, `two-dice`.
- **Hall of Fried Parts.** Two deaths are designed: CH5's 555 if the knob reaches zero before the fix, and CH17's
  secret gate chip on 9 V. Any other death is accidental and goes to the Hall with the lab's `fried` label.
- **Try it for real.** Optional folds (40 words at most, outside the budget) on CH2, CH7, CH8, CH13, CH14, CH18 and
  CH26, each naming the real parts and one safety line: 9 V battery or a 9 V adapter only, chips in by the notch,
  CMOS handled by the edges after touching the strap, logic only on the regulated 5 V.
- **Goals and tolerances.** Compare against values computed from the parts' actual values (`oneShotT`,
  `lab.actual`), never against nominal numbers: electrolytics spread by up to ±18% in the model, ceramics by ±9%.
- **Writing.** Keep robot lines at most 12 words, notes 6, rules 8. Recount with the method in `start-here.md` section
  1 after any edit. Never import wording from `.private/`.
