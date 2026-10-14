# Unit 3, Making it permanent: blueprint

Status: build sheet for Unit 3 (`permanent`) in the bench-first lesson format of `docs/curriculum/start-here.md`
(section 1) and under `docs/DESIGN-PRINCIPLES.md`. It replaces the Unit 3 outline in `docs/curriculum/later-units.md`
(differences in section 8.1). Content authors turn each lesson into a lab file (`content/labs/<id>.ts`) plus a thin
`lesson.yaml`. Text in double quotes is final learner-facing copy. Anything marked **NEW** goes beyond today's contracts
(`docs/ARCHITECTURE.md`, `docs/LABS.md`, `apps/web/src/lab/define.ts`, `packages/sim/src/types.ts`) and beyond the
Start here needs (`start-here.md` section 6: R1 to R11, V1 to V7, P1 to P7, B1 to B4, S1 to S3, which this unit
reuses), and is collected in section 7.

All content is original. Facts come from standard physics, datasheets and first-aid guidance; the research notes in
`.private/` were read for facts only. Follow `docs/CONTENT.md`: no em dashes, no emoji, units with a space,
conventional current.

---

## 1. How a lesson works in this unit

Exactly as `start-here.md` section 1: a case on the bench; beats (a robot line, one action or check, an optional
discovery note or rule stamp); the three-period lesson for every new part or word; control of error in the bench; 2 to
4 objectives that fill the robot's eyes; one optional secret; a relaxed fix-it round; at most one pop-up card; a
notebook page that fills itself and is signed off with a "Case closed" stamp. Budgets as `conversion-guide.md` A3: main
path under 150 words, on demand under 60, robot lines at most 12 words, notes at most 6, rules at most 8.

Three things are new here:

1. **The solder station.** Most cases happen on a station bench (section 3): an iron, solder, helping hands and the
   work, driven by a small station engine that runs beside the circuit simulator on the same clock. Soldering is
   physical, so the mini-game is real-time physics, never a countdown. The joint answers with its shape, its shine, a
   tug and a beep.
2. **Real hazards stay off the bench.** A 330 °C tip and a mains adapter are real dangers. The bench lets the learner
   scorch the desk or cook an LED, because that is free here. Safety facts the bench cannot show sit on one pop-up card
   (MP1, MP8) and on every notebook page's "Try it for real" fold (section 8.5).
3. **Your spool.** In MP2 the learner picks leaded or lead-free solder for the rest of the unit (default lead-free).
   Melting points, tip settings and the look of a good joint follow that pick.

---

## 2. Unit overview

- **Unit id:** `permanent` · **Shown name:** Making it permanent · **Placed after** `switching`, before `chips`.
- **Island:** Forge Isle, a board-shaped island with a glowing workshop quarter: anvil pads, solder-bright streams and
  a pier of perfboard planks.
- **Prerequisites:** Start here, Basics and Switching, in particular the twin blinker (`twin-flasher`), the scope,
  electrolytic polarity and the smoothing capacitor.
- **Lessons:** 12, 5 to 10 minutes each, about 85 minutes.
- **Story glue:** the robot's twin blinker rattled apart on the bridge from Switching's island: jumpers popped and an
  LED fell out. It wants a blinker it can wear on its antenna, so circuits must become solid. Each case makes something
  sturdier. The unit ends with the blinker on the antenna and the bridge to Silicon Isle extending.
- **Order of ideas:** the iron and its heat, solder and its melting point, the joint (heat the work), reading joints,
  heat that travels into parts; then wires (strip, splice, sleeve); then power from the wall (polarity, then a steady
  5 V); then perfboard (mirror, build in batches, trace a fault).

### 2.1 Modules and landmarks

| Module | Id | Lessons | Landmark id | Landmark name | Reveal caption | Robot line |
|---|---|---|---|---|---|---|
| M1 Solder joints | `soldering` | 1 to 5 | `solder-forge` | The Solder Forge | "A forge glows on the shore, its anvil shaped like a solder pad." | "Hot iron, good joints, and a lamp that kept its cool." |
| M2 Wires and power | `wires-and-power` | 6 to 9 | `cable-pylon` (NEW) | The Cable Pylon | "A pylon strings sleeved cables across the island, carrying a steady 5 V." | "Clean ends, snug sleeves, steady power." |
| M3 Perfboard | `perfboard` | 10 to 12 | `perfboard-pier` | The Perfboard Pier | "Planks of perfboard reach out over the clouds, every joint shining." | "Built for keeps. Next stop, Silicon Isle." |

Summaries for `module.yaml`: `soldering` "A hot iron, two spools, a first joint, five patients and a lamp saved from
the heat." · `wires-and-power` "Bare ends, sleeved splices, an adapter's plus and a steady 5 V." · `perfboard` "A
mirrored board, a blinker built for keeps and a fault that comes and goes."

`cable-pylon` is new. The outline's `power-station` for this module is already a Basics landmark.

### 2.2 Lesson list

| # | Lesson id | Case title | Min | One big idea | New word or part | Island piece | Parts unlocked |
|---|---|---|---|---|---|---|---|
| 1 | `hot-bench` | The hot end | 6 | The tip burns at once, even just after switch-off, so it lives in its stand | soldering iron | `iron-stand` (NEW) | `soldering-iron` |
| 2 | `pick-the-solder` | Two spools | 6 | Each solder melts at its own temperature; set the tip well above it | solder | `solder-spool` (NEW) | `solder` |
| 3 | `first-joint` | The loose ends | 8 | Heat the work, and let the hot work melt the solder | joint | `jumper-arch` | `helping-hands` |
| 4 | `joint-doctor` | Five patients | 7 | A joint's shape tells you what went wrong, and the fix | cold joint; braid | `meter-kiosk` | `desoldering-braid` |
| 5 | `cook-an-led` | Too hot to glow | 7 | Heat runs along a lead into a part; a clip on the lead carries it away | heat sink | `heatsink` | `heat-sink-clip`, `led-3mm` |
| 6 | `strip-the-wire` | Bare ends | 5 | Match the stripper's notch to the wire's gauge | wire stripper; gauge (AWG) | `wire-spool` | `wire-stripper`, `hookup-wire` |
| 7 | `splice-and-shrink` | The short snap | 7 | Heat-shrink goes on the wire before the joint is made | heat-shrink | `battery` | `heat-shrink` |
| 8 | `bench-supply` | The flat batteries | 6 | An adapter's label shows its plus, and plus must meet plus | wall adapter; centre plus | `fuse` | `wall-adapter`, `barrel-jack` |
| 9 | `steady-five` | Five, exactly | 8 | A regulator turns a higher, lumpy push into a steady 5 V | regulator | `regulator` (NEW) | `regulator-7805` |
| 10 | `perfboard-plan` | The mirror board | 7 | Flip the board and left becomes right: the underside is mirrored | perfboard | `header-fence` | `perfboard` |
| 11 | `pocket-blinker` | The antenna blinker | 10 | Build in small batches, check each, and test before you trim | none (a build) | `led-lamp` | none |
| 12 | `perfboard-debug` | The winking fault | 8 | Check every connection on the plan, one line at a time | intermittent | `test-lead-arch` | none |

Totals: 85 minutes. `pocket-blinker` is the unit's one 10-minute build (a full circuit soldered from parts). Every id is
checked unique against Start here, Basics, Switching, the conversion guide and the Unit 4 and 5 outlines; the ids
appear elsewhere only in the old Unit 3 outline. All lessons start at version 1.

### 2.3 Standard benches (unless a lesson says otherwise)

**Station bench** (MP1 to MP5, MP7, MP11, MP12):

| Name | Bench part | Model | Notes |
|---|---|---|---|
| Station `ST1`, iron `IR1` | NEW `solder-station`: a base with a dial (150 to 450 °C), a display of the tip temperature and a power switch; the iron on a cord; a stand with a brass-wool cup and a damp sponge | iron model (SE1) | Setpoint 330 °C in MP1. From MP3 on, the learner's working heat from MP2: 330 °C leaded, 370 °C lead-free. |
| Spool `SD` | NEW `solder`: 0.8 mm rosin core, the learner's pick | joint model (SE2) | Leaded Sn63/Pb37 melts at 183 °C; lead-free SAC305 melts over 217 to 220 °C. |
| Helping hands `HH1` | NEW `helping-hands`: two clips on arms and a magnifier | holds the work still | Magnifier view (BP3). |
| Fan `FN1` | a small fume fan beside the station | none | On from MP1; flux smoke drifts into it. |
| Glasses | drawn on the robot's face from MP1's card on | none | |
| Heat view | a toggle (BP4) | station temperatures | Ink hatching, denser is hotter; numbers on demand. |

**Circuit bench:** as `start-here.md` 2.3. Bench battery `B1` (`battery`, emf 9.4, internalOhms 1.7, mAh 500), red
LEDs, clip leads of 0.15 Ω; the meter and the scope as in Units 1 and 2.

Where a lesson's idea is not soldering, the robot solders for the learner: MP10 tacks its joints, and fix-it benches
arrive pre-built.

### 2.4 How each lesson is written below

As `start-here.md` 2.4 (Case, Bench, Beats, Objectives, Checks, Secret, Fix-it, Notebook, Robot lines, On demand,
Words), plus **Accuracy**: every claim the lesson makes and the value used, for the fact-checker. Lessons are numbered
MP1 to MP12.

---

## 3. The solder station: the soldering mini-game

### 3.1 What is on it

The station base with its dial and display; the iron on its cord; the stand with brass wool and a damp sponge; the
learner's spool; helping hands holding the work; a fan; the magnifier; the heat view. Later lessons add heat-sink clips,
desoldering braid, heat-shrink and a heat gun, a wire stripper and snips, and perfboard. The work is one of three
kinds: two wires crossed, two wires side by side (a splice), or a leg through a perfboard pad.

### 3.2 Controls

- **Iron:** drag the iron by its handle and drop the tip on a spot: a joint, a lead, the brass wool, the stand, the
  desk. On work it **rests** there, held as if by a steady hand, until dragged away. This frees the one pointer (or one
  thumb) for the solder.
- **Solder:** drag the spool's free end to a spot and hold. Solder feeds while held, about 3 mm of wire a second.
  Release to stop.
- **Tug and wiggle:** drag a wire end or a leg away from its joint. Before the joint has set, this counts as moving it.
- **Dial:** turn the station's dial, or use the arrow keys while it has focus.
- **Keyboard:** Tab moves between spots; I rests or lifts the iron at the focused spot; hold S to feed solder there;
  T tugs; M opens the magnifier on the focused joint; H toggles the heat view; W wipes the tip in the brass wool.
- Clips, braid, tubes, the stripper, snips and the heat gun are dragged like any bench part.

### 3.3 What the learner sees and hears

- The real tip stays steel grey (silver once tinned): a 330 °C tip does not glow. Heat shows only in the heat view,
  drawn as ink hatching, so colour keeps its meaning (`DESIGN-PRINCIPLES.md` 7).
- Solder that meets work above its melting point slumps and runs along the metal; a wisp of flux smoke drifts to the
  fan; a soft sizzle follows the app's sound setting.
- While molten the fillet has a liquid sheen. As it sets it changes to bright (leaded) or satin (lead-free). Under
  reduced motion this is a fade.
- No score and no verdict pop-up. The joint's shape is the feedback; the magnifier, a tug and the meter's beep confirm
  it. The notebook names a joint's verdict only after the learner has looked at it.

### 3.4 The joint model (station engine SE2)

Per joint: a lumped work temperature, molten volume, wetted fraction, flux left on the work, peak temperature, time
above melt, a moved-while-setting flag and the neighbour pads. Per iron: tip temperature, setpoint, tinning (fresh,
tinned, oxidised) and contact conductance (a tinned tip and a molten bridge raise it about four times). A solder bead
carried on the tip loses its flux.

Calibration targets (model targets checked by golden tests in 7.8; not learner facts):

| Situation | Target |
|---|---|
| Crossed pair of 22 AWG solid copper, tinned tip at 330 °C | the work reaches 183 °C in 2 to 3 s |
| Same, solder fed at the work | full wetting 1 to 2 s later; a good joint in 3 to 5 s in all |
| Leg through a perfboard pad | melt in 1 to 2 s; a good joint in 2 to 4 s |
| Lead-free at 370 °C | about 20% slower to melt than leaded at 330 °C |
| Oxidised (black) tip on the crossed pair | no melt within 15 s |
| Two 14 AWG wires | 8 to 12 s (behind the "not flowing by 10 to 15 s, get more heat in" hint) |
| Bead carried on the tip | flux gone in about 2 s above 300 °C; on cold work it balls up, wetting under 0.4 |
| Tip on the desk paper | a scorch mark after 2 s |
| Iron switched off at 330 °C | above 200 °C after a minute; below 50 °C after about 8 minutes |
| Tip on the copper bar (MP1) | the tip dips 60 to 100 °C and recovers within 5 s of lifting |

### 3.5 Verdicts

Checked in this order; the first match wins.

| Verdict | Rule | Looks like | Electrical | Mechanical | Fix |
|---|---|---|---|---|---|
| burnt | peak above 420 °C, or over 10 s above melt on a pad | dark brown flux; a lifted pad; wire insulation shrunk back | good, unless the pad lifted (open) | holds | clean, rejoin; nearby parts may be cooked |
| bridge | solder reaches a neighbour pad (volume over 2.5 times ideal beside a pad 2.54 mm away, or the iron dragged across) | a solder neck joining two pads | joins two nets | holds | braid |
| disturbed | moved while setting | frosty, cracked surface | intermittent | weak | reheat |
| cold | wetted under 0.6, or the work never 15 °C above melt | dull, grainy, balled; a gap at the lead | intermittent: opens when flexed or tugged | rocks or pulls apart | reheat with a touch of fresh solder (fresh flux) |
| too much | volume over 1.8 times ideal | a round ball hiding the lead | good (can hide a cold joint) | holds | braid |
| too little | volume under 0.5 times ideal, or under 80% of the pad covered | a thin ring, the hole showing | good above 0.3 times ideal, intermittent below | weak | add solder |
| good | anything else | a smooth, concave little volcano with the lead's outline showing; bright (leaded) or satin (lead-free) | 0.005 Ω | holds | none |

### 3.6 Quick mode

Used for MP11's build, MP12's repairs and pre-built fix-it benches. Press and hold on a joint: the iron rests there and
solder feeds by itself once the work passes melt. Release to lift both. Released too soon: too little or cold. Held
well past a full fillet: too much, then a bridge, then burnt. A thin ink ring fills around the joint while solder feeds
(it shows state, not time left). The same engine and verdicts run underneath.

### 3.7 Relaxed play and access

- No timers. Holding longer is always allowed; the consequence is the joint's shape.
- A station speed setting (normal or half): at half speed all station physics runs at half rate; verdicts are
  unchanged.
- Keyboard and one-hand play as in 3.2. Screen readers hear the tip temperature, the joint's state ("molten", "set")
  and, after a look in the magnifier, the joint's shape in words.
- Reduced motion: no smoke drift; fillet growth and setting are fades.

### 3.8 Safety inside the game

- An iron dropped anywhere but the stand or the work shows the consequence (a scorch on the desk paper, a softening
  cord) and then slides home.
- The game never shows a hand touching the tip, catching the iron or a face over the smoke. Flux smoke always drifts to
  the fan.

---

## 4. Module 1: Solder joints (`soldering`)

Landmark `solder-forge`.

---

### MP1. `hot-bench`: The hot end

- **Minutes** 6 · **Island piece** `iron-stand` (NEW) · **Unlocks** `soldering-iron`.
- **Big idea:** The tip is hot enough to burn at once, and stays hot after switch-off, so it lives in its stand.
- **New:** "soldering iron" (part). The stand is named only as the iron's home. Pop-up card: bench habits.
- **Case:** "The hot end". Robot intro (beat 1): "This is a soldering iron. Switch it on."

**Bench.** Station bench (2.3) with nothing in the helping hands. ST1 off, dial at 330 °C, IR1 in its stand. The desk is
grid paper. A copper bar CB1 (10 mm square, 100 mm long) on a tile, for the secret. The desk clock and the time-lapse
control (`key: "speed"`, existing). Heat view on. Fix-it bench: ST1 on at 330 °C, IR1 lying on the desk with its tip on
its own cord.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is a soldering iron. Switch it on." | Flip ST1's power switch. | The display climbs to 330 °C in about 20 s; the heat view hatches the tip densely. Note on the tip: "330 °C: hotter than an oven" |
| 2 | "Show me the hot end." | Tap the tip (period 2). | A wrong tap shows that part's own name. |
| 3 | "Done for now. Put it down." | Drop the iron anywhere. | On the desk: a brown scorch spreads, then the iron slides into its stand. In the stand: nothing burns. Note on the stand: "its home, every time". Rule: "The iron lives in its stand." |
| 4 | Predict: "Switch off. Safe to touch when?" chips "right away", "in a minute", "after many minutes" | Switch off, then fast-forward. | The display sinks slowly, still above 200 °C after a minute. Note on the tip: "off, but hot for minutes" |
| 5 | Card: "Bench habits: do or don't?" | Sort the card (below). | Each habit lands with its stamp. |
| 6 | Check: "What is this?" (the iron glows) chips "a soldering iron", "a heat gun", "a meter probe" | Pick a chip (period 3). | Answer "a soldering iron". |
| 7 | Secret: "Secret: press the tip on the copper bar." | Optional: switch on, rest the tip on CB1. | The display dips by about 80 °C, then climbs back once lifted. Note on CB1: "big metal drinks heat" |
| 8 | Fix-it: "My iron's on its cord. Make it safe." | Lift the iron into its stand. | The cord stops smoking. Note on the cord: "cord safe, iron home" |
| 9 | "Case closed. Nobody got burned." | Sign the page. | Stamp, eyes full, island piece. |

**Pop-up card: bench habits** (NEW card kind `bench-habits` on the Start here R9 host; info only, never simulated).
Drag five habits onto "do" or "don't". Each lands with a stamp line:

| Habit | Tray | Stamp line |
|---|---|---|
| "Safety glasses on" | do | "Snipped legs and solder can fly." |
| "Fan on, window open" | do | "Flux smoke irritates lungs." |
| "Snack by the iron" | don't | "Wash your hands, then eat." |
| "Catch a falling iron" | don't | "Step back. Let it drop." |
| "Touch the tip" | don't | "Burn? Cool running water, 20 minutes." |

A wrong drop slides to the other side and shows its stamp line. The card counts as one graded check (all five right on
the first try).

**Objectives** (3 eyes)

- O1 Heat it up: `switch-on` (`lab.iron.on && lab.iron.tipC >= lab.iron.setC - 10`).
- O2 Home and cool: `park-it` (the iron left the stand at least once since the task began, kept in `lab.memory`, and
  now `lab.iron.inStand`), `cool-down` (`!lab.iron.on && lab.iron.tipC < 50`).
- O3 Bench habits: `habits` (`lab.card("bench-habits").done`).
- Secret: `copper-drinks` (bonus; `lab.iron.at === "CB1"` while `lab.iron.tipC <= lab.iron.setC - 40`, then
  `lab.iron.tipC >= lab.iron.setC - 10` within 10 s of lifting, via `lab.memory`).
- Fix-it: `fix-it` (`lab.iron.inStand && lab.temp("cord:IR1") < 60`).

**Checks:** beat 2 (tap the tip); beat 6 "a soldering iron"; the card.

**Notebook page:** "Case 1: The hot end". Sketch: the station with the iron in its stand; a cooling curve with
"minutes" under it; the scorch mark if the learner made one; the notes, the rule, the card's stamps, the beat 4 guess in
blue, a tick for the fix-it, the secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint (any beat): "Hot end: the shiny tip. Cool end: the grip."
Fried (nothing can die here): "Nothing fried. Only the desk got toasted."

**On demand:** beat 1 "The switch is on the station's front." · beat 4 "Fast-forward sits by the clock." · fix-it
"Lift it by the handle."

**Words:** main path 103 plus the card 44, total 147; on demand 33.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Tip setting | 330 °C | Typical: 320 to 350 °C with leaded solder, 350 to 380 °C with lead-free. |
| Hotter than an oven | 330 °C | Home ovens bake at about 180 to 220 °C; most top out near 250 to 290 °C. |
| Warm-up | about 20 s to 330 °C | Temperature-controlled stations reach working heat in well under a minute; simple plug-in irons can take minutes. |
| Cooling after switch-off | above 200 °C after a minute; below 50 °C after about 8 minutes | Model target. Real irons take from a few minutes to over ten: treat any iron as hot. |
| Falling iron | step back, never catch it | |
| Glasses | snipped leads fly; hot flux and solder can spit | |
| Flux smoke | mostly rosin (colophony) fume: a lung irritant and sensitiser, a known cause of occupational asthma | A fan or fume extractor and an open window. |
| Hands and food | leaded solder leaves lead on the skin; the risk is hand to mouth, not vapour | Soldering heat is far below lead's boiling point (1,749 °C). |
| Burns | cool or lukewarm running water for 20 minutes; no ice, no butter or creams | Standard first aid (NHS, Red Cross). |
| Copper bar | a big copper mass draws heat faster than the heater replaces it, for a moment | The display dips, then recovers. |
| Cord | a hot tip melts cord insulation within seconds | Keep the cord behind the iron. |

---

### MP2. `pick-the-solder`: Two spools

- **Minutes** 6 · **Island piece** `solder-spool` (NEW) · **Unlocks** `solder`.
- **Big idea:** Each solder melts at its own temperature, so the tip is set well above it.
- **New:** "solder" (part). Leaded and lead-free are two kinds of it, met as two spools.
- **Case:** "Two spools". Robot intro (beat 1): "This is solder. Hold it on the tip."

**Bench.** Station bench. ST1 on, dial at 150 °C, IR1 in its stand (the tip reachable). Spools: SD1 labelled "Sn63
Pb37, rosin core, 0.8 mm"; SD2 labelled "Sn96.5 Ag3.0 Cu0.5, lead-free, rosin core, 0.8 mm"; SD3 labelled "acid core,
for sheet metal and plumbing" (for the secret). A scrap copper wire SW1 on a tile. Clock and time-lapse control. Fix-it
bench: ST1 at 200 °C with only the lead-free spool.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is solder. Hold it on the tip." | Touch SD1's end to the tip. | Nothing happens. Note on SD1: "150 °C: still solid" |
| 2 | "Keep holding. Turn the dial up slowly." | Turn the dial while SD1 touches the tip. | At 183 °C it melts; flux smoke drifts to the fan. Note on SD1: "tin-lead: melts at 183 °C" |
| 3 | (no line) | | The tip turns silver. Note on the tip: "tinned tip: a silver coat" |
| 4 | Predict: "Lead-free next. It melts..." chips "lower", "the same", "higher" | Hold SD2 on the tip; keep turning up. | Solid at 200 °C; it melts near 220 °C. Note on SD2: "lead-free: melts near 220 °C" |
| 5 | "Show me the lead-free spool." | Tap SD2 (period 2). | A wrong tap shows that spool's own label. |
| 6 | "Joints steal heat. Pick your spool. Set the dial." | Tap SD1 or SD2 to make it yours; turn the dial to its mark (330 or 370 °C). | Note on the dial: "about 150 °C above the melt". Rule: "Set the tip well above the melt." |
| 7 | Check: "What is this?" (SD1 glows) chips "solder", "fuse wire", "hookup wire" | Pick a chip (period 3). | Answer "solder". |
| 8 | Secret: "Secret: try the acid-core spool." | Optional: melt SD3 onto SW1, then fast-forward a day. | A green crust creeps along the copper. Note on SW1: "acid flux eats electronics" |
| 9 | Fix-it: "My lead-free solder won't melt. Fix it." | Turn the dial from 200 °C to the lead-free mark. | It melts and runs. Note on the dial: "200 °C: under its melt" |
| 10 | "Case closed. Spool picked, dial set." | Sign the page. | |

The pick in beat 6 is the unit setting `solder` (NEW LR4). Skipping it leaves lead-free.

**Objectives** (3 eyes)

- O1 Find the melt: `melt-leaded` (`lab.spool("SD1").melted`; the notebook keeps `firstMeltTipC`).
- O2 Lead-free: `melt-lead-free` (`lab.spool("SD2").melted`).
- O3 Working heat: `set-working` (`lab.solderKind === "leaded" ? lab.iron.setC >= 320 && lab.iron.setC <= 350 :
  lab.solderKind === "lead-free" && lab.iron.setC >= 350 && lab.iron.setC <= 380`).
- Secret: `acid-spool` (bonus; `lab.spool("SD3").melted && (lab.prop("SW1")?.corrosion ?? 0) >= 0.5`).
- Fix-it: `fix-it` (`lab.spool("SD2").melted && lab.iron.setC >= 350`).

**Checks:** beat 5 (tap SD2); beat 7 "solder".

**Notebook page:** "Case 2: Two spools". Sketch: both spools with their labels; a temperature scale marked 183 °C,
about 220 °C and the learner's working mark; the silver tip; notes, rule, the beat 4 guess in blue, the chosen spool
circled, secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Hold the solder on the tip while you turn." Fried (nothing
can die): "Nothing to fry. Solder just melts."

**On demand:** beat 2 "Turn slowly: the tip needs a moment." · beat 6 "Leaded: about 330. Lead-free: about 370." ·
fix-it "Lead-free needs a hotter tip."

**Words:** main path 105; on demand 33.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Tin-lead 63/37 | melts at 183 °C | Eutectic: melts and sets at one temperature. 60/40 melts over 183 to about 190 °C (parts bin). |
| Lead-free SAC305 (Sn96.5 Ag3.0 Cu0.5) | melts over 217 to 220 °C ("near 220") | Tin-copper Sn99.3 Cu0.7 melts at 227 °C (parts bin). |
| Working heat | 330 °C leaded, 370 °C lead-free ("about 150 °C above the melt") | Typical ranges 320 to 350 °C and 350 to 380 °C. |
| Why higher | the joint draws heat out of the tip | |
| Rosin core | flux inside the wire cleans oxide so solder can wet the metal | |
| Tinning | a thin coat of solder on the tip carries heat and protects the plating | |
| Acid-core solder | its flux keeps corroding copper and parts; never for electronics | The time-lapse crust is an illustration over one simulated day. |
| Lead and the law | lead is restricted in products sold in the EU (RoHS); leaded solder is still sold for repair and hobby use | Parts bin fact. Both kinds make good joints. |

---

### MP3. `first-joint`: The loose ends

- **Minutes** 8 · **Island piece** `jumper-arch` · **Unlocks** `helping-hands`.
- **Big idea:** Heat the work, and let the hot work melt the solder.
- **New:** "joint" (word). The helping hands are furniture: used, not taught.
- **Case:** "The loose ends". Robot intro (beat 1): "Two wires, crossed. Let's make them one."

**Bench.** Station bench at the learner's working heat and spool, tip tinned. HH1 holds two bare 22 AWG solid copper
wires W1 and W2 (25 mm bare), crossed and touching; the crossing is spot J1. A second clip holds a scrap pair W3 and W4
crossing at J2 (for the secret). Heat view off (a toggle). Fix-it bench: J1 already soldered with the tip on W1 only:
the solder hugs W1 and W2 lies in it, unwetted.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Two wires, crossed. Let's make them one." then "Touch solder to the crossing." | Touch the solder to J1, iron still in its stand. | Nothing melts. Note on J1: "cold wires: solder stays solid" |
| 2 | "Rest the iron on the crossing." | Drop the tip on J1; it rests there. | Both wires darken in the heat view. Note on W1: "the wires heat up first" |
| 3 | Predict: "Touch solder to the wires again. It will..." chips "stay solid", "melt and flow" | Touch the solder to J1, beside the tip. | It slumps and runs round both wires; smoke drifts to the fan. Note: "hot wires melt it: it flows" |
| 4 | "Plenty. Lift the solder, then the iron." | Lift the solder, then the iron. | The fillet sets. Note on J1: "a joint: one metal path" |
| 5 | "Hold still while it sets. Then tug." | Wait for the surface to settle, then tug W2. | It holds. Rule: "Heat the work. The work melts the solder." |
| 6 | "Show me the joint." | Tap J1 (period 2). | A wrong tap shows that part's own name. |
| 7 | Check: "What is this?" (J1 glows) chips "a joint", "a crossing", "a clip" | Pick a chip (period 3). | Answer "a joint". |
| 8 | Secret: "Secret: melt solder on the tip, then dab it on." | Optional: feed solder onto the tip in the air, wait, dab it on the cold J2. | A dull ball sits on top and pops off at a tug. Note on J2: "flux burned off: it won't stick" |
| 9 | Fix-it: "This joint let go of one wire. Fix it." | Rest the tip on both wires; add a little solder. | Both wires wet; the tug holds. Note: "heat both wires, both bond" |
| 10 | "Case closed. That bond is for keeps." | Sign the page. | |

Feeding where the resting tip meets the work also counts as feeding the work (it is standard practice). Only solder
melted on a tip that is not on the work counts as "on the tip".

**Objectives** (3 eyes; `lab.meltC` is the learner's spool's full-melt temperature, 183 or 220)

- O1 Heat first: `cold-touch` (solder touched J1 while `lab.joint("J1").tempC < lab.meltC`, kept in `lab.memory`),
  `heat-the-work` (`lab.iron.at === "J1" && lab.joint("J1").tempC >= lab.meltC`).
- O2 Feed the work: `feed-the-joint` (`lab.joint("J1").fedAt === "work" && lab.joint("J1").wetted >= 0.8`).
- O3 Tug test: `tug-holds` (`lab.joint("J1").state === "set" && lab.joint("J1").verdict === "good" &&
  lab.tug("J1") === "held"`; trigger `first-bond`).
- Secret: `carry-on-tip` (bonus; `lab.joint("J2").fedAt === "tip" && lab.joint("J2").verdict === "cold"`).
- Fix-it: `fix-it` (`["W1", "W2"].every((w) => lab.joint("J1").touched.includes(w)) && lab.joint("J1").verdict ===
  "good" && lab.tug("J1") === "held"`).

**Checks:** beat 6 (tap J1); beat 7 "a joint".

**Notebook page:** "Case 3: The loose ends". Sketch: the crossed wires before and after, with the fillet drawn large and
an arrow "heat in here, solder in there"; notes, rule, the beat 3 guess in blue, secret box (the dull ball).

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Iron on both wires. Solder on the hot wires." Fried
(nothing can die): "Nothing fried. Practice is free here."

**On demand:** beat 2 "Drag the tip onto the crossing. It stays." · beat 3 "Touch the solder to the wires, not the
iron." · beat 5 "Wait until the shine stops changing." · fix-it "Heat view: which wire stayed cool?"

**Words:** main path 126; on demand 44.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Wire | 22 AWG solid copper, 0.64 mm | |
| Time to a joint | 3 to 5 s on a crossed pair with a tinned tip | Model target (3.4). Hint threshold: not flowing by 10 to 15 s means not enough heat is getting in. |
| Heat the work | solder is fed to the hot work (or where tip and work meet), not carried on the tip | |
| Carried solder | its flux burns off in seconds on a hot tip; it then balls up instead of wetting | |
| Hold still | tin-lead 63/37 sets at once at 183 °C; lead-free sets over 220 to 217 °C, a moment longer | Moving it while it sets gives a disturbed joint. |
| Good joint | smooth, concave, wetting both wires; bright with leaded solder, satin with lead-free | |
| Tug test | a joint must hold mechanically as well as conduct | |

---

### MP4. `joint-doctor`: Five patients

- **Minutes** 7 · **Island piece** `meter-kiosk` · **Unlocks** `desoldering-braid`.
- **Big idea:** A joint's shape tells you what went wrong, and the fix.
- **New:** "cold joint" (word, three periods: beats 2, 5, 8). Desoldering braid (a tool, met by name and use in beats
  6 and 7; used again in MP12).
- **Case:** "Five patients". Robot intro (beat 1): "Five joints. One is healthy. Magnifier on."

**Bench.** Station bench at working heat. HH1 holds a strip of perfboard, one row of seven pads P1 to P7, underside
up. Stiff wire legs L1 to L6 come through P1 to P6 from the top. Joints: J1 good; J2 cold (dull, grainy, a gap at the
lead); J3 too much (a ball); J4 too little (a thin ring, the hole showing); J5 bridged to P6; J6 good. P7 is empty with
a spare leg L7 beside it (for the secret). Meter M1 on the desk, dial off, plugs in. Tray: desoldering braid BR1.
Fix-it bench: a small lamp board (B1, R1 1 kΩ, red D1 on a pad strip) whose D1 cathode joint JF is cold and opens when
the board is tapped.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Five joints. One is healthy. Magnifier on." | Open the magnifier and look at J1 to J5. | Note on J1: "healthy: a smooth little volcano" |
| 2 | "Wiggle each leg." | Wiggle L1 to L5. | L2 rocks in a grey, grainy lump. Note on J2: "cold joint: dull, grainy, loose" |
| 3 | "Now compare these two." | Turn J3 and J4 under the magnifier. | Note between them: "ball: too much. Ring: too little." |
| 4 | "Beep the last joint to its neighbour." | Continuity on; probes on P5 and P6. | Beep. Note on J5: "bridge: two pads joined" |
| 5 | "Show me the cold joint." | Tap J2 (period 2). | A wrong tap shows that joint's own name. |
| 6 | "This is braid. It soaks up solder. Fix the ball." | Lay BR1 on J3; rest the iron on the braid. | The ball wicks into the copper; a volcano is left. Note on BR1: "hot braid drinks the extra" |
| 7 | "Now heal the rest." | Reheat J2 with a touch of solder; add solder to J4; wick the bridge at J5. | Each becomes a volcano. Rule: "Smooth volcano: healthy. Anything else: fix it." |
| 8 | Check: "What is this?" (J2's before-picture glows) chips "a cold joint", "a bridge", "too little" | Pick a chip (period 3). | Answer "a cold joint". |
| 9 | Secret: "Secret: make a cold joint on purpose." | Optional: on P7, lift the iron the moment solder touches. | Note on J7: "lifted too soon: cold" |
| 10 | Fix-it: "My lamp flickers when I tap it. Fix it." | Tap the board, find the leg that moves, reheat its joint. | A steady glow. Note on JF: "reheated: steady light" |
| 11 | "Case closed. Every patient's healthy." | Sign the page. | |

Control of error on the repairs: braid on the thin J4 takes even more away (the hole shows wider); solder added to the
ball at J3 grows it into a bridge to P4. Each joint simply shows its new shape.

**Objectives** (3 eyes)

- O1 Examine: `magnify` (`["J1", "J2", "J3", "J4", "J5"].every((j) => lab.viewed("magnifier:" + j))`),
  `wiggle-cold` (`lab.tug("J2") === "loose"`).
- O2 Find the bridge: `beep-bridge` (`lab.meter?.mode === "continuity" && lab.meter.beep && lab.probed("pad:P5",
  "pad:P6", "either")`).
- O3 Heal them: `wick-the-ball` (`lab.joint("J3").verdict === "good"`), `heal-all` (`["J2", "J4",
  "J5"].every((j) => lab.joint(j).verdict === "good") && lab.joint("J5").bridgeTo === null`).
- Secret: `make-cold` (bonus; `lab.joint("J7").verdict === "cold"`).
- Fix-it: `fix-it` (`lab.joint("JF").verdict === "good" && lab.heldFor(2, lab.flexed && lab.isLit("D1", 0.3))`).

**Checks:** beat 5 (tap J2); beat 8 "a cold joint".

**Notebook page:** "Case 4: Five patients". Sketch: five joints in a row as side views (volcano, grey lump, ball, ring,
bridge), each with its note; the braid drawn soaking up a ball; the rule; secret box; a tick for the fix-it.

**Robot lines:** start = beat 1. Success = beat 11. Hint: "Healthy joints look like little volcanoes." Fried (no part
can die on the strip; the fix-it lamp is limited by 1 kΩ): "Nothing fried. Just lumpy metal."

**On demand:** beat 1 "Lead-free volcanoes look satin. Still healthy." · beat 6 "Braid on the ball, iron on the
braid." · beat 7 "Grey: reheat. Gap: add. Ball or bridge: wick." · fix-it "Tap the board. Watch which leg moves."

**Words:** main path 113; on demand 40.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Good through-hole joint | concave fillet, smooth, wets pad and lead; the lead's outline shows | |
| Lead-free look | satin or slightly grainy when good | Shine alone is not the test. |
| Cold joint | dull, grainy, may not wet the lead; weak and can come and go | Cure: reheat with a dab of cored solder for fresh flux. |
| Too much | a convex ball; can hide a poor joint and reach a neighbour | Remove with braid. |
| Too little | the pad not covered, a gap at the lead | Add solder. |
| Bridge | solder joining neighbouring pads: a short | Braid, or drag it away with a clean tip. |
| Pad pitch | 2.54 mm | |
| Braid | fine copper braid with flux; heated on a joint, molten solder wicks into it | Cut off the used, silvered end. |
| Continuity | our meter beeps below about 30 Ω; test only unpowered metal | As in Start here. |

---

### MP5. `cook-an-led`: Too hot to glow

- **Minutes** 7 · **Island piece** `heatsink` · **Unlocks** `heat-sink-clip`, `led-3mm`.
- **Big idea:** Heat runs along a lead into a part; a metal clip on the lead carries it away.
- **New:** "heat sink" (part: a copper clip).
- **Case:** "Too hot to glow". Robot intro (beat 1): "My antenna lamp needs a joint. Rest the iron on its leg."

**Bench.** No board. B1, a clip lead to R1 470 Ω in a holder, a clip lead to the end of D1's anode leg; D1 is a 3 mm
red LED (NEW `size: 3`, maxmA 20), its body held in a plastic peg, legs hanging 20 mm. D1.cathode clips back to
B1.neg. The anode leg has a marked iron spot SP1, 12 mm below the body. Station at working heat. Heat view on. A
stopwatch (existing, NEW trigger: it runs while the iron rests on SP1). Tray: copper clip HS1, steel clip HS2, three
spare 3 mm red LEDs. Fix-it bench: the same, with HS1 on the anode leg at 16 mm, below the iron spot.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My antenna lamp needs a joint. Rest the iron on its leg." | Drop the tip on SP1; it rests there. | Hatching creeps up the leg into the body; the stopwatch runs; the glow sags. Note on the leg: "heat runs up the leg" |
| 2 | (no line) | Keep the iron there. | About 30 s in, the lamp goes dark for good. Note on D1: "cooked inside, about 30 s" |
| 3 | "Fresh lamp. This is a heat sink. Clip it near the body." | Drop a spare LED on D1; clip HS1 on the anode leg between SP1 and the body. | Note on HS1: "heat sink: copper drinks heat" |
| 4 | Predict: "Same heat, 30 seconds. My lamp will..." chips "die again", "dim a bit", "stay bright" | Rest the iron on SP1 for 30 s or more. | The hatching pools in the clip; the lamp stays bright. Note on D1: "past 30 s, still bright". Rule: "Clip between the heat and the part." |
| 5 | "Show me the heat sink." | Tap HS1 (period 2). | A wrong tap shows that part's own name. |
| 6 | Check: "What is this?" (HS1 glows) chips "a heat sink", "a clip lead", "a gate" | Pick a chip (period 3). | Answer "a heat sink". |
| 7 | Secret: "Secret: try the steel clip." | Optional: swap HS1 for HS2 and heat again. | It dims later than bare, sooner than with copper. Note on HS2: "steel: a weaker heat path" |
| 8 | Fix-it: "My heat sink isn't helping. Fix it." | Move HS1 from below SP1 to between SP1 and the body. | The lamp lasts. Note on HS1: "clip on the body's side" |
| 9 | "Case closed. My lamp kept its cool." | Sign the page. | |

The LED's death in beat 2 is the unit's fried moment by design. If the learner lifts early, the lamp brightens again
as it cools; the robot asks to keep holding (on demand), and the beat waits.

**Objectives** (2 eyes)

- O1 Heat travels: `cook-it` (`lab.died("D1")` while `lab.iron.at === "SP1"`).
- O2 Sink it: `clip-on` (`lab.clip("HS1").on === "D1.anode" && lab.clip("HS1").mm < 12`), `survive-30`
  (`lab.heldFor(30, lab.iron.at === "SP1") && lab.isLit("D1", 0.5) && (lab.part("D1")?.extra?.damage ?? 0) < 0.2`;
  stores the die's peak in `lab.shared.copperPeak`).
- Secret: `steel-clip` (bonus; HS2 on D1.anode below 12 mm, the iron on SP1 for 30 s, and
  `lab.stats("temp:die:D1", 30).max >= lab.shared.copperPeak + 30`).
- Fix-it: `fix-it` (`lab.clip("HS1").mm < 12 && lab.heldFor(30, lab.iron.at === "SP1") && lab.isLit("D1", 0.5)`).
- Lab `fried: { D1: "3 mm red LED, cooked by the iron" }`. Trigger `cool-head` (hidden): a clipped run lasting 120 s
  with D1 lit above 0.5.

**Checks:** beat 5 (tap HS1); beat 6 "a heat sink".

**Notebook page:** "Case 5: Too hot to glow". Sketch: the LED hanging from its peg, the leg with the iron spot and the
clip, hatching arrows splitting into the clip; the stopwatch readings of both runs; notes, rule, the beat 4 guess in
blue, secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "The clip goes between the iron and the body." Fried (beat 2,
by design): "Oof. Cooked from the inside. Fresh ones are in the tray."

**On demand:** beat 1 "Keep the iron there. Watch the lamp." · beat 3 "Drag the clip onto the leg, near the lamp." ·
fix-it "Is the clip between the heat and the lamp?"

**Words:** main path 113; on demand 45.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| LED current | (9.4 V − 2.0 V) ÷ 470 Ω, about 16 mA | |
| Heat along a lead | copper conducts heat about 400 W/(m·K), plain steel about 50, stainless about 15, epoxy about 0.2 | Why copper beats steel. |
| Datasheet limit | LED hand soldering typically about 300 to 350 °C for at most 3 s, the joint at least 2 to 3 mm from the body | Check the part's own sheet. |
| Our timings | glow down by a third near 15 s, dead near 30 s; alive at 120 s with a copper clip | A model of a hobby test with an iron held far longer than any joint needs. Real times vary with the iron, lead length and LED. |
| Hot LEDs | light output falls as the die warms; lasting overheating cracks the die or breaks the bond wire for good | |
| 3 mm vs 5 mm | the 3 mm heats faster: less mass | |
| Where the clip goes | on the lead, between the joint and the body | |

---

## 5. Module 2: Wires and power (`wires-and-power`)

Landmark `cable-pylon` (NEW).

---

### MP6. `strip-the-wire`: Bare ends

- **Minutes** 5 · **Island piece** `wire-spool` · **Unlocks** `wire-stripper`, `hookup-wire`.
- **Big idea:** Match the stripper's notch to the wire's gauge.
- **New:** "wire stripper" (part); "gauge" (word, as AWG). Snips are furniture.
- **Case:** "Bare ends". Robot intro (beat 1): "I need bare ends. This is a wire stripper."

**Bench.** A reel HW1 of red 22 AWG solid hookup wire, labelled "22 AWG solid", its end out. Stripper WS1 with notches
30 to 16 AWG on a solid scale and a stranded scale, a jaw stop at 10 mm and a mm ruler on the jaw. Snips SN1.
Magnifier. A half breadboard (for the fix-it). Reel HW2 "22 AWG stranded, 7 strands" (for the secret). Fix-it bench:
HW1's end stripped at the 26 notch (nicked) and pushed into a breadboard hole, where it has snapped off.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "I need bare ends. This is a wire stripper." then "Strip the end in the 26 notch." | Close WS1 at 26 on HW1's end, pull. | The jacket comes off; the copper has a bright notch. Note on the copper: "too small: nicked copper" |
| 2 | "Snip that. Now try the 18 notch." | Snip off the nicked end; strip at 18. | The jaws close but the jacket stretches and slides. Note: "too big: it just slips" |
| 3 | "The reel says 22. Your turn." | Strip at 22. | Clean bare copper, no mark. Note on the reel: "22 AWG: 0.64 mm copper". Rule: "Match the notch to the wire's gauge." |
| 4 | "Show me the 22 notch." | Tap it on the solid scale (period 2). | A wrong tap shows that notch's own number. |
| 5 | Check: "Which wire is thicker?" chips "18 AWG", "26 AWG" | Pick a chip. | Answer "18 AWG". Note on the scale: "bigger number, thinner wire" |
| 6 | Check: "What is this?" (WS1 glows) chips "a wire stripper", "snips", "pliers" | Pick a chip (period 3). | Answer "a wire stripper". |
| 7 | Secret: "Secret: strip the stranded wire, then twist." | Optional: strip HW2 at 22 on the stranded scale; twist the strands. | Note on HW2: "strands twisted: no stray hairs" |
| 8 | Fix-it: "My wire snapped in the board. Fix it." | Snip off the nicked end; strip again at 22; push it in. | It bends and seats. Note: "a nick snaps: strip again" |
| 9 | "Case closed. Clean ends, every time." | Sign the page. | |

**Objectives** (2 eyes)

- O1 Wrong notches: `nick-it` (`lab.strip("HW1").tries.some((t) => t.notch === 26 && t.nicked)`), `slip-it`
  (`lab.strip("HW1").tries.some((t) => t.notch === 18 && t.slipped)`).
- O2 Right notch: `clean-strip` (`lab.strip("HW1").clean && lab.strip("HW1").notch === 22 && lab.strip("HW1").scale ===
  "solid"`).
- Secret: `twist-strands` (bonus; `lab.strip("HW2").clean && lab.strip("HW2").twisted`).
- Fix-it: `fix-it` (`lab.strip("HW1").clean && lab.connected("HW1.end", "a5")`).

**Checks:** beat 4 (tap the 22 notch); beat 5 "18 AWG" (wrong: "Bigger numbers mean thinner wire."); beat 6 "a wire
stripper".

**Notebook page:** "Case 6: Bare ends". Sketch: three stripped ends side by side (nicked, slipped, clean) under their
notch numbers; the gauge note drawn as three circles of shrinking size labelled 18, 22, 26; rule; secret box.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "The reel's label names the notch." Fried (nothing can die):
"Just wire. Nothing fried."

**On demand:** beat 1 "Close the jaws on the wire, then pull." · beat 5 wrong "Bigger numbers mean thinner wire." ·
beat 7 "Stranded wire has its own scale." · fix-it "Snip off the nicked end first."

**Words:** main path 111; on demand 35.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| AWG | bigger numbers are thinner | 18 AWG 1.02 mm, 22 AWG 0.64 mm, 26 AWG 0.40 mm, 30 AWG 0.25 mm copper. |
| Notch too small | nicks or cuts the copper; a nick breaks after a few bends | |
| Notch too big | does not cut through the jacket, which stretches | |
| Strip length | 10 mm at the jaw stop | Enough for a splice or a breadboard hole. |
| Stranded 22 AWG | often 7 strands of 30 AWG, slightly larger overall than solid | Strippers mark a separate stranded scale. Twist strands so none strays. |

---

### MP7. `splice-and-shrink`: The short snap

- **Minutes** 7 · **Island piece** `battery` · **Unlocks** `heat-shrink`.
- **Big idea:** Heat-shrink goes on the wire before the joint is made.
- **New:** "heat-shrink" (part, three periods: beats 2, 6, 7). The heat gun is named by a note on first use.
- **Case:** "The short snap". Robot intro (beat 1): "My battery snap's leads are short. Splice the red pair."

**Bench.** Station bench at working heat. A 9 V battery snap BS1 whose short leads (red and black, stranded) end
stripped 10 mm; two extension wires EX1 (red) and EX2 (black), 22 AWG, stripped 10 mm at one end, their far ends
already soldered into a two-pin header H1. HH1 holds the red ends side by side. Both ends of each future splice are
captive: the snap at one end, the header at the other. Tray: heat-shrink tubes T1 (1.6 mm), T2 and T4 (3.2 mm), T3
(6.4 mm), all 2:1, black; a spare splice SP (for the secret). Heat gun HG1 in its rest. Snips. Fix-it bench: the black
pair spliced and sleeved, but the tube split from too much heat; EX2's header end not yet soldered (free).

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My battery snap's leads are short. Splice the red pair." | Solder the side-by-side splice JR (full mini-game). | A slim joint. |
| 2 | "This is heat-shrink. Slide it over the joint." | Try to slide T2 over JR. | It cannot get on: both ends are held. Note on T2: "both ends held: no way on" |
| 3 | "Snip it. Tube on first, then solder again." | Snip through JR; slide T2 onto EX1 and park it away from the heat; resolder JR. | Note on T2: "on first, parked far from heat" |
| 4 | "Slide it over the joint. Heat gun on." | Slide T2 over JR; sweep HG1 along it. | It shrinks to half and hugs the joint. Note on HG1's air: "hot air: shrinks to half". Rule: "Tube on first. Then solder." |
| 5 | "Now the black pair. Tube first!" | T4 onto EX2, solder JB, slide, shrink. | |
| 6 | "Show me the heat-shrink." | Tap a tube (period 2). | A wrong tap shows that part's own name. |
| 7 | Check: "What is this?" (T2 glows) chips "heat-shrink", "a jumper", "the jacket" | Pick a chip (period 3). | Answer "heat-shrink". |
| 8 | Secret: "Secret: shrink the big tube on a spare splice." | Optional: T3 over SP, shrink it. | Note on T3: "too big: shrunk, still loose" |
| 9 | Fix-it: "This tube split. Redo it, gently." | Snip off the split tube; slide a new one on from EX2's free end; shrink with the gun kept moving, a hand's width away. | Snug, no split. Note: "keep the heat moving" |
| 10 | "Case closed. My snap reaches now." | Sign the page. | |

The trap in beats 1 and 2 is deliberate: the robot forgets too, and the bench shows why the rule exists. Snipping
through a splice leaves tinned ends, so no new strip is needed.

**Objectives** (3 eyes)

- O1 Splice: `red-splice` (`lab.joint("JR").verdict === "good"`).
- O2 Tube first: `tube-first` (`lab.tube("T2").onBefore("JR")`: T2 was on EX1 before JR last set), `shrink-red`
  (`lab.tube("T2").over === "JR" && lab.tube("T2").shrink >= 0.9 && !lab.tube("T2").split && lab.joint("JR").verdict
  === "good"`).
- O3 Black pair: `black-pair` (`lab.joint("JB").verdict === "good" && lab.tube("T4").over === "JB" &&
  lab.tube("T4").shrink >= 0.9 && !lab.tube("T4").split`).
- Secret: `too-big` (bonus; `lab.tube("T3").over === "SP" && lab.tube("T3").shrink >= 0.9 && !lab.tube("T3").grip`).
- Fix-it: `fix-it` (a fresh tube over JB with `shrink >= 0.9`, not split).

**Checks:** beat 6 (tap a tube); beat 7 "heat-shrink".

**Notebook page:** "Case 7: The short snap". Sketch: the order drawn as a strip of four frames (tube on, solder, slide,
shrink), the first frame with the robot's forgotten tube crossed out; notes, rule, secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Tube on the wire before the joint." Fried (nothing can die):
"Nothing fried. Tubes are cheap."

**On demand:** beat 3 "Push the tube far from the joint." · beat 4 "Keep the gun moving, a hand's width away." ·
fix-it "Slide the new tube on from the free end."

**Words:** main path 105; on demand 36.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Shrink ratio | 2:1: shrinks to about half its diameter | 3.2 mm shrinks to 1.6 mm; 6.4 mm to 3.2 mm (too loose on a thin splice). |
| Shrink temperature | typical polyolefin tube starts near 90 °C and fully shrinks by about 120 °C | Check the tube's sheet. |
| Heat gun | hot air from about 100 °C to over 500 °C; held too close or too long it scorches or splits the tube | Its nozzle stays hot for minutes. |
| Length | tubes also get a little shorter (up to about 5 to 10%) | |
| Method | hot air only, never the soldering iron or a flame | As the outline's errata ask. |
| Order | the tube must go on before the joint closes the wire's last free end | |
| Splice | side by side, slim enough for the tube | |

---

### MP8. `bench-supply`: The flat batteries

- **Minutes** 6 · **Island piece** `fuse` · **Unlocks** `wall-adapter`, `barrel-jack`.
- **Big idea:** An adapter's label shows its plus, and plus must meet plus.
- **New:** "wall adapter" (part); "centre plus" (the label's polarity drawing). Pop-up card: wall side or bench side.
- **Case:** "The flat batteries". Robot intro (beat 1): "Third flat battery this week. Plug the adapter into this
  jack."

**Bench.** Half board. The robot's lamp: R1 1 kΩ and red D1 in series between the near rails; C1, 100 µF 16 V
electrolytic, across the rails, stripe on −. A barrel-jack board J1 lies on the desk, its two pins free and unmarked
(anchors `J1.tip`, the centre contact, and `J1.sleeve`). A power strip PS1 (mains never modelled; it takes only
adapters) with AD1 plugged in: label "OUTPUT 9 V ⎓ 1 A", regulated, centre plus; its barrel plug lies free. Meter M1,
dial off, plugs in. Shelf: AD2 "OUTPUT 9 V ~ 1 A" (AC) with a spare jack board J2 on the desk; AD3 "OUTPUT 9 V ⎓
500 mA", centre minus. Scope available, trace on J2's pins (for the secret). Fix-it bench: J1 in the rails as after
beat 4, but AD3 plugged into it: lamp dark, C1 reversed and warming.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Third flat battery this week. Plug the adapter into this jack." | Push AD1's barrel plug into J1. | Note on J1: "9 V waiting on two pins" |
| 2 | "Which pin is plus? Ask the meter." | Dial to 20 V DC; a probe on each pin; swap if it reads minus. | 9.0 with red on the centre pin. Note on that pin: "positive reading: red's on plus" |
| 3 | "The label knows too. Find its plus." | Tap AD1's label, then its polarity drawing. | The drawing zooms: a dot inside a C, the dot's line running to +. Note: "dot in the middle: centre plus" |
| 4 | "Plus pin into the plus rail." | Plug J1 into the rails, centre pin on the red rail. | The lamp glows. Rule: "Plus meets plus. Check before you plug." |
| 5 | "Show me plus on the other label." | Tap the + end of AD3's polarity drawing (period 2). | A wrong tap shows that mark's own name. |
| 6 | Check: "What does this mean?" (AD1's drawing glows) chips "centre plus", "centre minus" | Pick a chip (period 3). | Answer "centre plus". |
| 7 | Card: "Wall side or bench side?" | Sort the card (below). | Each item lands with its stamp. |
| 8 | Secret: "Secret: scope the AC adapter's pins." | Optional: AD2 into J2 on the desk; scope on J2. | The trace swings above and below zero; the meter on DC reads about 0. Note on AD2: "~ AC: flips back and forth" |
| 9 | Fix-it: "My lamp's dark and my capacitor's warm. Fix it." | Unplug AD3 from J1; plug in AD1. | The lamp glows; C1 cools. Note on AD3: "centre minus: backwards here" |
| 10 | "Case closed. No more flat batteries." | Sign the page. | |

If the learner plugs J1 in the wrong way round in beat 4, the bench answers as in the fix-it: dark lamp, C1 warming in
the heat readout (existing `inspect: "heat"` on C1). The robot nudges: "Backwards! Turn the jack round."

**Pop-up card: wall side or bench side** (NEW card kind `wall-side`; info only, mains never simulated). Drag five
items onto "wall side" or "bench side":

| Item | Tray | Stamp line |
|---|---|---|
| "The prongs" | wall side | "Mains, 230 V or 120 V. Hands off." |
| "Inside the case" | wall side | "Never opened. Ever." |
| "A plugged-in cord" | wall side | "Never cut or strip it." |
| "The barrel plug" | bench side | "9 V. Bench-safe." |
| "The jack's pins" | bench side | "9 V. Bench-safe." |

A wrong drop slides to the other side and shows its stamp line. One graded check (all five right on the first try).

**Objectives** (3 eyes)

- O1 Find plus: `find-plus` (`lab.meter?.mode === "dcv" && lab.probed("J1.tip", "J1.sleeve") && (lab.meter.value ?? 0)
  >= 8.5`).
- O2 Plus meets plus: `read-label` (`lab.viewed("label:AD1")`), `plug-in-right` (`lab.connected("J1.tip", "rail+:1")
  && lab.connected("J1.sleeve", "rail-:1") && lab.isLit("D1")`).
- O3 Wall side: `wall-card` (`lab.card("wall-side").done`).
- Secret: `ac-wave` (bonus; `lab.adapter("AD2").into === "J2"`, the scope on J2, and `lab.stats("volts:J2.tip", 0.1)`
  with `min < -8` and `max > 8`).
- Fix-it: `fix-it` (`lab.adapter("AD1").into === "J1" && lab.isLit("D1") && !lab.died("C1")`).

**Checks:** beat 5 (tap +); beat 6 "centre plus"; the card.

**Notebook page:** "Case 8: The flat batteries". Sketch: the adapter's label drawn large with the polarity drawing
circled; the meter reading 9.0 with red on the centre pin; the card's two columns; notes, rule, secret box (a wave
crossing zero).

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Red probe on plus reads positive." Fried (C1 can die if the
centre-minus adapter is left in): "Pop. That capacitor got it backwards. Spare's in the tray."

**On demand:** beat 2 "Dial to 20 V. One probe per pin." · beat 3 "Look for the dot in the C." · beat 4 wrong
"Backwards! Turn the jack round." · fix-it "Read the dark lamp's adapter label."

**Words:** main path 108 plus the card 36, total 144; on demand 42.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Lamp current | (9.0 V − 1.9 V) ÷ 1 kΩ, about 7 mA | |
| Polarity drawing | a dot inside a C; the line from the dot names the centre's polarity | Standard adapter marking. |
| Centre plus | most 5.5 mm barrel adapters are centre plus; many guitar-pedal adapters are centre minus | Always read the label. |
| DC and AC marks | ⎓ (a solid line over a dashed one) means DC; ~ means AC | |
| Meter sign | positive with red on plus, as in Start here | |
| Reversed supply | the LED and 1 kΩ just stay dark at 9 V; a reversed electrolytic conducts, heats and can vent | Matches the simulator (LED soft breakdown above 5 V; electrolytic reverse wear). |
| AC on a DC meter | reads close to 0 V (the average of a wave) | The scope shows it swinging both ways. |
| Mains | 230 V (UK, Europe, much of the world) or 120 V (North America); can kill | Never opened, never cut, never part of a lab. |
| Cords | never cut or strip a plugged-in adapter cord; use a ready-made barrel-jack board | As the outline's errata ask. |

---

### MP9. `steady-five`: Five, exactly

- **Minutes** 8 · **Island piece** `regulator` (NEW, moved from the Unit 4 outline) · **Unlocks** `regulator-7805`.
- **Big idea:** A regulator turns a higher, lumpy push into a steady 5 V.
- **New:** "regulator" (part, three periods: beats 2, 5, 7; its legs named in beat 3).
- **Case:** "Five, exactly". Robot intro (beat 1): "Chips on the next island want 5 V. Scope on."

**Bench.** Half board. U1, a 7805 in a TO-220 package (NEW bench kind `regulator` for the simulator's `regulator7805`, legs `in gnd out`), legs in e10,
e11, e12 (printed side toward the learner). C2 0.33 µF from the IN strip to the − rail; C3 0.1 µF from the OUT strip
to the − rail. Jumper W1 from the GND strip to the − rail; jumper W2 from the + rail to the IN strip. The 5 V lamp: R5
220 Ω from the OUT strip to red D5 (maxmA 20) to the − rail. J1 in the near rails with AD4 plugged in: label "9 V ⎓
300 mA, unregulated" (NEW `supply`: emf 13 V, 8 Ω, filter 400 µF, ripple at 100 Hz, or 120 Hz by region; about 12.8 V
with 0.5 V of lumps at this load). Named nodes `in` (U1.in) and `out` (U1.out). Scope: trace 1 on `in`, trace 2 on
`out` (hidden until beat 2), range 0 to 14 V, window 0.05 s. Meter M1 on 20 V DC, probes held on OUT and the − rail.
Inspect: stress on D5, heat on U1. Tray: B1 with snap leads (`charge` 0.3, Start here B1) and a 47 Ω 1 W load RL.
Shelf decoys: a 2N3904 Q9 and a 100 µF can C9. Clock and time-lapse control. Fix-it bench: the same build with W1
missing (the GND strip goes nowhere), AD4 feeding.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Chips on the next island want 5 V. Scope on." | Switch on the scope. | Trace 1 wobbles near 12.8 V. Note on trace 1: "lumpy push, about 13 V" |
| 2 | "This is a regulator. Show trace two." | Show trace 2. | A flat line at 5.0 V; the meter reads 5.00. Note on U1: "lumps in, steady 5 V out" |
| 3 | "Its legs: tap each one." | Tap U1's three legs. | Each names itself. Note on U1: "in, ground, out: left to right" |
| 4 | Predict: "On a dying battery, the output..." chips "sinks too", "holds 5 V", "holds, then sinks" | Swap J1 for B1 on the rails; fast-forward. | OUT holds 5.00 while IN slides toward 7 V, then follows it down. Note on the meter: "under 7 V in: it sags". Rule: "A 7805 needs about 7 V in." |
| 5 | "Show me the regulator." | Tap U1, not Q9 or C9 (period 2). | A wrong tap shows that part's own name. |
| 6 | Check: "Tap its output leg." | Tap a leg. | Answer: U1's right leg. |
| 7 | Check: "What is this?" (U1 glows) chips "a regulator", "a transistor", "a heat sink" | Pick a chip (period 3). | Answer "a regulator". |
| 8 | Secret: "Secret: heat view on, then the big load." | Optional: AD4 back on the rails; RL from OUT to −. | U1's heat readout climbs toward 80 °C ("hot"). Note on U1: "spare volts turn to heat" |
| 9 | Fix-it: "My 5 V lamp sees 11 V. Fix it." | Add a jumper from the GND strip to the − rail. | The meter reads 5.00; D5's stress bar falls back to green. Note on W1: "ground leg grounded: 5 V" |
| 10 | "Case closed. Five, exactly." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Lumps in, flat out: `scope-in` (`lab.view("scope") && (lab.stats("volts:in", 0.1)?.span ?? 0) >= 0.3`),
  `flat-out` (trace 2 shown and `const s = lab.stats("volts:out", 0.5)` has `s.span < 0.02 && s.mean >= 4.8 && s.mean
  <= 5.2`).
- O2 Name the legs: `tap-legs` (`["U1.in", "U1.gnd", "U1.out"].every((a) => lab.tapped(a))`).
- O3 Needs headroom: `battery-sag` (B1 on the rails; `lab.memory` has seen `volts:out` at 4.9 or more while `volts:in`
  was 7.2 or more, and later `volts:out` at 4.7 or less while `volts:in` was 6.5 or less).
- Secret: `spare-heat` (bonus; RL from `out` to the − rail with AD4 feeding, and `(lab.part("U1")?.temp ?? 0) >= 55`).
- Fix-it: `fix-it` (`lab.connected("U1.gnd", "rail-:1")` and `lab.volts("out")` between 4.8 and 5.2).

**Checks:** beat 5 (tap U1); beat 6 (tap OUT); beat 7 "a regulator".

**Notebook page:** "Case 9: Five, exactly". Sketch: the two scope traces, lumpy above and flat below, with U1 drawn
between them and its legs labelled; the battery run drawn as two lines (IN falling, OUT flat then falling) with the
7 V mark; notes, rule, the beat 4 guess in blue, secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "In on the left, out on the right." Fried (none expected: D5
glares at 11 V but stays under its damage threshold): "Bright, but alive. Ground that leg."

**On demand:** beat 1 "The scope's switch is on its front." · beat 4 "Fast-forward sits by the clock." · beat 8 "Clip
the big load from OUT to minus." · fix-it "Follow the middle leg. Where does it go?"

**Words:** main path 118; on demand 42.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| 7805 output | 5.0 V; within 4.8 to 5.2 V at room temperature | About ±5% over all load, line and temperature. |
| Pinout | TO-220, printed side toward you, legs down: in, ground, out; the tab is ground | 79xx negative regulators differ; not used here. |
| Headroom | dropout about 2 V (datasheet typical at 1 A; the simulator uses 1.95 V): "about 7 V in" for 5 V out | Maximum input 35 V. |
| Ripple rejection | about 60 to 80 dB: 0.5 V of lumps in gives well under a millivolt out | |
| Capacitors | 0.33 µF on the input, 0.1 µF on the output | The usual datasheet circuit. |
| Quiescent current | about 4 to 8 mA, out of the ground leg | The simulator uses 4 mA. |
| Heat | P = (Vin − 5 V) × I; with about 12 V in and about 120 mA, near 0.9 W | Without a heat sink a TO-220 rises about 50 to 65 °C per watt (the simulator: 65), so about 80 °C here after a few minutes; the 7805 has thermal shutdown and current limiting. |
| Ground leg open | no regulation: the output rises toward the input, less the dropout | Can wreck 5 V parts. The model target is 10 to 11.5 V with AD4 (7.8). |
| Unregulated adapter | a "9 V" unregulated adapter reads about 12 to 13 V on a light load, with lumps at 100 Hz (50 Hz mains) or 120 Hz (60 Hz) | |
| Lamp | (5.0 V − 1.95 V) ÷ 220 Ω, about 14 mA; at 11 V about 41 mA | D5's stress bar turns red; the simulator starts LED damage at 2.5 × maxmA (50 mA). |
| Big load | 5 V ÷ 47 Ω, about 106 mA; 0.53 W in RL | Hence a 1 W resistor. |
| 9 V alkaline | falls from about 9.4 V toward 7 V through most of its life | The sag shows near the end of the time-lapse. |

---

## 6. Module 3: Perfboard (`perfboard`)

Landmark `perfboard-pier`.

---

### MP10. `perfboard-plan`: The mirror board

- **Minutes** 7 · **Island piece** `header-fence` · **Unlocks** `perfboard`.
- **Big idea:** Flip the board over and left becomes right: the underside is a mirror of the plan.
- **New:** "perfboard" (part).
- **Case:** "The mirror board". Robot intro (beat 1): "This is perfboard. Drop my lamp's parts on the ghosts."

**Bench.** Perfboard PB1 (NEW, 10 columns by 6 rows, a copper pad on every hole) in HH1, top up. Plan card PC1: the
top view with ghost outlines: red LED D1 on the left (long leg toward the top edge), R1 1 kΩ on the right, and the
spliced battery snap BS1 from MP7 with its two leads through holes on the top edge. Tack mode: legs bent together
conduct, and the robot solders them on sign-off. Shelf decoys: a half breadboard BB9 and a stripboard SB9. B1 on the
desk. Fix-it bench: PB1F, the same lamp built by the robot from the top drawing read from underneath: D1 sits turned
round.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is perfboard. Drop my lamp's parts on the ghosts." | Place D1, R1 and BS1's leads on their ghosts. | Note on PB1: "every hole alone, nothing joined" |
| 2 | Predict: "Flip it. The LED will be on the..." chips "left", "right" | Tap flip. | D1's legs poke through on the right. Note: "flipped: left became right" |
| 3 | "Bend the legs to meet, like the plan." | Drag leg ends along the underside to their partners, following the plan's lines. | Each meeting tacks with a small click. |
| 4 | "Clip on the battery." | Snap B1 onto BS1. | The lamp glows. Rule: "Underneath, the plan is mirrored." |
| 5 | "Show me the perfboard." | Tap PB1, not BB9 or SB9 (period 2). | A wrong tap shows that board's own name. |
| 6 | Check: "Tap the LED's long leg, underneath." | Tap a leg on the underside. | Answer: D1's anode, now on the mirrored side. |
| 7 | Check: "What is this?" (PB1 glows) chips "perfboard", "breadboard", "stripboard" | Pick a chip (period 3). | Answer "perfboard". |
| 8 | Secret: "Secret: let two bare legs cross." | Optional: bend one leg across another. | The lamp goes dark. Note at the crossing: "bare legs crossing: a short" |
| 9 | Fix-it: "My second lamp board is dark. Fix it." | Lift D1, turn it round, bend its legs again. | It glows. Note on D1: "mirror slip: LED backwards" |
| 10 | "Case closed. Left is right, underneath." | Sign the page. | The robot solders the tacks. |

**Objectives** (3 eyes)

- O1 Place: `place-parts` (`onGhosts(lab, "PC1", ["D1", "R1", "BS1"])`, a helper in `content/labs/lib/`).
- O2 Mirror: `flip-it` (`lab.board("PB1").flipped`), `route-it` (`lab.board("PB1").matchesPlan("PC1")`).
- O3 Light it: `light-it` (`lab.isLit("D1")` with B1 snapped onto BS1).
- Secret: `cross-legs` (bonus; `lab.board("PB1").crossings > 0 && (lab.loopOpen("D1") || lab.event("shorted"))`).
- Fix-it: `fix-it` (`lab.isLit("D1")` on PB1F).

**Checks:** beat 5 (tap PB1); beat 6 (D1's anode underneath); beat 7 "perfboard".

**Notebook page:** "Case 10: The mirror board". Sketch: the top view and the underside side by side with a dashed
mirror line between them, the LED's long leg marked on both; notes, rule, the beat 2 guess in blue, secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Flipped over, left and right swap." Fried (a crossing can
short the battery; nothing dies): "Whoa, a shortcut under the board. Uncross those."

**On demand:** beat 1 "Each ghost shows where a leg goes." · beat 3 "Follow the mirrored lines on the plan." · fix-it
"Which leg is long? Which side is plus?"

**Words:** main path 92; on demand 36.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Hole pitch | 0.1 in = 2.54 mm, as on a breadboard | |
| Pad-per-hole perfboard | each hole has its own copper pad, joined to nothing | Unlike a breadboard's strips or stripboard's copper strips. Plain unplated board exists too (parts bin). |
| Flipping | left to right mirrors the columns; rows stay | |
| Bare legs | must never cross underneath; an insulated jumper goes on top instead | |
| LED legs | long leg is the anode | |
| Lamp current | (9.4 V − 1.9 V) ÷ 1 kΩ, about 7.5 mA | |

---

### MP11. `pocket-blinker`: The antenna blinker

- **Minutes** 10 · **Island piece** `led-lamp` · **Unlocks** none.
- **Big idea:** Build in small batches and check each one, then test before you trim.
- **New:** none. Every part is known; the lesson is the build.
- **Case:** "The antenna blinker". Robot intro (beat 1): "My blinker, for keeps. Batch one: transistors and lamps."

**Bench.** Station bench at working heat, quick mode (3.6) on. PB2 (12 by 9 pads) in HH1. Plan card PC2: the twin
blinker from Unit 2's `twin-flasher` with ghosts in three batches and the mirrored underside lines. Tray: Q1, Q2
(2N3904), D1, D2 (3 mm red), R1, R2 (1 kΩ), R3, R4 (68 kΩ), C1, C2 (10 µF 16 V electrolytic), the spliced snap BS1.
B1 on the desk. Snips SN1, magnifier, saw SW1 and vise V1, the cut line marked on the plan. Fix-it bench: PB2F, the
same blinker built by the robot with one cold joint JQ at Q2's base.

The circuit is the one learners built on the breadboard: from plus, each 1 kΩ feeds an LED into a collector; each
68 kΩ feeds a base; C1 runs + on Q1's collector to its stripe on Q2's base, C2 the other way; emitters to minus.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My blinker, for keeps. Batch one: transistors and lamps." | Drop Q1, Q2, D1 and D2 on their ghosts (flat faces and long legs as drawn). | |
| 2 | "Flip it. Solder those ten legs." | Flip; quick-solder each leg. | Each joint shows its shape. |
| 3 | "Magnifier. Check every joint now." | Sweep the magnifier; reheat any joint that is not a volcano. | Note on the board: "caught now, fixed in seconds". Rule: "Build a little, check a little." |
| 4 | "Batch two: four resistors. Bend, solder, snip." | Place R1 to R4; flip; bend along the plan; solder; snip the ends. | Snipped ends spring away. Note on a clipping: "snipped legs fly: glasses on" |
| 5 | "Batch three: capacitors and battery leads." | Place C1, C2 (stripes as drawn) and BS1's leads; flip; solder; check. | |
| 6 | Check: "Tap C1's minus leg, underneath." | Tap a leg on the underside. | Answer: C1's stripe leg, mirrored. |
| 7 | Predict: "Battery on. It will..." chips "blink", "stay dark", "stay lit" | Snap B1 onto BS1. | The lamps take turns, about 0.8 s a blink. Note on PB2: "same blink, now for keeps" |
| 8 | "Test passed. Now saw off the spare board." | Clamp the empty end in V1; drag SW1 along the line. | The offcut drops. Rule: "Test first, then trim." |
| 9 | Secret: "Secret: flex it while it blinks." | Optional: press the board's corners. | Still blinking. Note: "good joints don't mind" |
| 10 | Fix-it: "My spare blinker won't start. One joint looks grey." | Find JQ with the magnifier; reheat it. | It blinks. Note on JQ: "one cold joint, no blink" |
| 11 | "Case closed. Look, I'm blinking!" | Sign the page. | The robot clips the blinker to its antenna. |

The saw stops at any line that crosses a populated hole (BP15), so the trim cannot ruin the build; trimming before the
test is allowed but leaves `trim` undone until `it-blinks` is.

**Objectives** (3 eyes)

- O1 Batch one: `batch-one` (Q1, Q2, D1, D2 on their ghosts the right way round, and their ten joints set and good:
  `goodJoints(lab, "PB2", ["Q1", "Q2", "D1", "D2"])`, a helper in `content/labs/lib/`).
- O2 Batches two and three: `batch-two` (R1 to R4 on their ghosts, joints good, `lab.board("PB2").snipped(["R1",
  "R2", "R3", "R4"])`), `batch-three` (`crossed(lab)` from the `twin-flasher` lab, C1 and C2 joints good, BS1's leads
  on the plan's + and − pads).
- O3 Test, then trim: `it-blinks` (`takingTurns(lab, 0.6, 1.3)`; trigger `wearable`), `trim`
  (`lab.board("PB2").trimmed && lab.board("PB2").cutClear`).
- Secret: `flex-test` (bonus; `lab.heldFor(2, lab.flexed) && takingTurns(lab, 0.6, 1.3)`).
- Fix-it: `fix-it` (`lab.joint("JQ").verdict === "good" && takingTurns(lab, 0.6, 1.3)` on PB2F).

`crossed` and `takingTurns` move from `content/labs/twin-flasher.ts` to `content/labs/lib/flasher.ts` so both labs
share them.

**Checks:** beat 6 (C1's minus leg underneath).

**Notebook page:** "Case 11: The antenna blinker". Sketch: the finished board, top and underside, the three batches
shaded differently, the cut line, the robot with the blinker on its antenna; notes, rules, the beat 7 guess in blue,
secret box.

**Robot lines:** start = beat 1. Success = beat 11. Hint: "Follow the plan's ghosts, one batch at a time." Fried (a
reversed electrolytic warms): "Ouch. That capacitor's in backwards. Stripe toward the base."

**On demand:** beat 3 "Not a volcano? Reheat it now." · beat 5 "Stripe toward the base, as drawn." · beat 8 "Clamp
the empty end. Saw along the line." · fix-it "Magnifier first. Look for grey."

**Words:** main path 109; on demand 43.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Circuit | 2N3904s, 1 kΩ collector resistors, 68 kΩ base resistors, 10 µF, red LEDs, as Unit 2 `twin-flasher` | |
| Blink | about 0.84 s per cycle in the simulator | 1.4 × R × C is about 0.95 s nominal; the simulator runs 10 to 20% fast, as real ones do (packages/sim README). |
| 3 mm LEDs | same electrical behaviour as 5 mm | |
| Electrolytics | stripe (minus) toward the base, + toward the collector | |
| 2N3904 legs | flat face toward you, legs down: E, B, C | |
| Snipping | clipped leads fly: glasses on; hold or cover the lead | |
| Trimming | clamp the waste side; perfboard dust irritates skin and lungs | "Try it for real" fold. |

---

### MP12. `perfboard-debug`: The winking fault

- **Minutes** 8 · **Island piece** `test-lead-arch` · **Unlocks** none.
- **Big idea:** Check every connection on the plan, one line at a time.
- **New:** "intermittent" (word: a fault that comes and goes).
- **Case:** "The winking fault". Robot intro (beat 1): "My spare blinker winks, then quits. Unclip its battery."

**Bench.** PB3, a finished antenna blinker (the robot's spare) with an intermittent cold joint J7 at D2's cathode pad
(on plan line 7): it opens while the board is pressed. B1 snapped onto BS1 at the start: it blinks until the board
flexes. Plan card PC3: every pad-to-pad connection drawn as a numbered line with a tick box (NEW LR5). Meter M1 (red
in VΩ, black in COM, dial off). Board flex control (BP14). Station at working heat, quick mode, the learner's spool,
braid. Fix-it bench: PB4, another blinker with a solder bridge JB from Q1's collector pad to the minus line's pad
beside it: both LEDs lit, no blinking.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My spare blinker winks, then quits. Unclip its battery." | Unsnap B1 from BS1. | Note on M1: "beep tests: power off" |
| 2 | "Meter to beep. Test the plan's first line." | Dial to continuity; probe line 1's two pads. | Beep; line 1 ticks. Note on PC3: "beep: joined. Tick it." |
| 3 | "Keep going, line by line." | Beep every line. | Every line ticks. |
| 4 | Predict: "All beep. Will pressing the board change one?" chips "no", "yes" | Hold the board pressed; beep the lines again. | Line 7 stutters. Note on J7: "intermittent: it comes and goes". Rule: "Check every line, one at a time." |
| 5 | "Show me the intermittent joint." | Tap J7 (period 2). | Magnified: grey and grainy. |
| 6 | "Heal it with a touch of solder." | Reheat J7. | A volcano. |
| 7 | "Battery on. Press the board." | Snap B1 on; hold the board pressed. | Still blinking. Note: "pressed, still blinking" |
| 8 | Check: "What is this?" (J7's old stutter replays) chips "intermittent", "a short", "an open" | Pick a chip (period 3). | Answer "intermittent". |
| 9 | Secret: "Secret: beep two pads with no line between." | Optional. | Silence. Note: "no line, no beep: good" |
| 10 | Fix-it: "Last blinker stares with both eyes. Fix it." | Unclip; beep pads the plan doesn't join; wick the bridge. | It blinks. Note on JB: "a beep with no line: bridge" |
| 11 | "Case closed. Forge Isle is built!" | Sign the page. | The robot wears its blinker; the bridge to Silicon Isle extends. |

**Objectives** (3 eyes)

- O1 Power off: `power-off` (`!lab.connected("B1.pos", "BS1.red") && lab.loopOpen()`).
- O2 Walk the plan: `beep-the-plan` (`lab.plan("PC3").ticks.length === lab.plan("PC3").lines`), `flex-find`
  (`lab.plan("PC3").silent.includes(7)`: line 7 went silent while `lab.flexed`).
- O3 Heal it: `reheat` (`lab.joint("J7").verdict === "good"`), `flex-proof` (B1 on BS1, `lab.heldFor(3, lab.flexed)
  && takingTurns(lab, 0.6, 1.3)`).
- Secret: `no-line-no-beep` (bonus; continuity mode, probes on two pads with no plan line between them, `!lab.connected`
  between them, and no beep for 0.5 s via `lab.heldFor`).
- Fix-it: `fix-it` (`lab.joint("JB").bridgeTo === null && takingTurns(lab, 0.6, 1.3)` on PB4).

**Checks:** beat 5 (tap J7); beat 8 "intermittent".

**Notebook page:** "Case 12: The winking fault". Sketch: the plan card with its column of ticks and line 7 circled, a
small drawing of the board bending; notes, rule, the beat 4 guess in blue, secret box. The unit's last page carries a
"Making it permanent: complete" stamp.

**Robot lines:** start = beat 1. Success = beat 11. Hint: "One line at a time. Tick, then next." Fried (none expected;
the bridge only shorts a collector): "Nothing fried. Just a lazy joint."

**On demand:** beat 2 "Probe both pads of line one." · beat 4 "Hold the board pressed, then beep again." · fix-it
"Beep where the plan has no line."

**Words:** main path 114; on demand 34.

**Accuracy**

| Claim | Value used | Notes |
|---|---|---|
| Continuity | test with the power off; our meter beeps below about 30 Ω | Parts do not beep through (1 kΩ, LEDs, junctions read over range), so each plan line is a metal-only path. |
| Intermittent | a fault that comes and goes with flexing, heat or vibration; cold and cracked joints are common causes | |
| Bridge in this circuit | Q1's collector shorted to minus: D1 lit through R1, Q2 held on by its 68 kΩ, so D2 lit too; no blinking | D1 about 7.5 mA. |
| Method | follow a written plan and mark off each connection | |

---

## 7. NEW NEEDS (lesson player, engines, simulator, bench, models, island)

Already there and used as is: the Start here runtime (beats, notes, rules, checks, objectives, secrets, fix-it, cards,
notebook: R1 to R11), `lab.view` (R10), the `battery` `charge` start parameter (B1), the clock and time-lapse control,
the scope, the meter with continuity, `inspect: "stress"` and `inspect: "heat"`, the stopwatch, `lab.heldFor`,
`lab.stats`, `lab.history`, `lab.memory`, `lab.shared`, the electrolytic reverse model, the LED's soft reverse
breakdown, the `twin-flasher` circuit and its helpers, and the simulator's new `regulator7805` kind.

### 7.1 Lesson player and lab runtime

| Id | Need | Size | Used in |
|---|---|---|---|
| LR1 | Station benches: a lab bench may hold a solder station area (`bench.station: { iron, spools, hands, work, fan }`) beside or instead of a circuit. The station engine and the circuit simulator share the lab clock and the `speed` control, so time-lapse cools an iron. | M | MP1 to MP5, MP7, MP11, MP12 |
| LR2 | Solution steps for the new actions, so `solutions.test.ts` replays every lab headlessly: `iron` (rest at a spot or lift), `feed` (spot, seconds), `tug`, `wiggle`, `station-dial`, `spool` (pick), `sink-clip` (lead, mm), `braid`, `strip` (wire, notch, scale), `snip`, `twist`, `tube` (on wire, over joint), `heat-gun` (target, mm, seconds), `flip`, `bend` (leg, pad), `saw` (line), `flex` (on or off), `adapter` (into a jack or the strip), `magnify`, `view`, `tap`. | M | all |
| LR3 | Card kinds `bench-habits` and `wall-side` on the R9 host (two trays, stamp lines, one graded check). | S | MP1, MP8 |
| LR4 | Unit setting `solder: "leaded" or "lead-free"` chosen in MP2 (default lead-free), read by later labs (`lab.solderKind`, `lab.meltC`), the iron's default setpoint and the joint renderer's finish. | S | MP2 on |
| LR5 | Plan panel: numbered connection lines that tick when the meter beeps across their two pads and mark a line silent when it stops beeping while the board is pressed. | S to M | MP12 (MP10, MP11 show plans) |
| LR6 | Twelve notebook sketches (the R8 notebook, hand-drawn SVG per lab). | M (art) | all |

### 7.2 LabView additions

| Helper | Returns | Used in |
|---|---|---|
| `lab.iron` | `{ on, setC, tipC, tinned: "fresh" or "tinned" or "oxidised", at: spot or null, inStand }` | MP1 to MP5 |
| `lab.solderKind`, `lab.meltC` | the learner's spool and its full-melt temperature (183 or 220) | MP2 on |
| `lab.spool(id)` | `{ kind, melted, firstMeltTipC }` | MP2 |
| `lab.joint(id)` | `{ state: "bare" or "molten" or "set", verdict, wetted, volume (1 = ideal), peakC, tempC, fedAt: "work" or "tip" or null, touched, moved, bridgeTo }` | MP3, MP4, MP7, MP11, MP12 |
| `lab.tug(id)` | the last tug or wiggle: "held", "pulled", "loose" or null | MP3, MP4 |
| `lab.temp(anchor)` | °C at a station anchor ("tip", "cord:IR1", "die:D1", "clip:HS1"); history source `temp:<anchor>` | MP1, MP5 |
| `lab.clip(id)` | heat-sink clip `{ on: lead or null, mm: distance from the body }` | MP5 |
| `lab.strip(wire)` | `{ notch, scale, mm, clean, nicked, slipped, cutStrands, twisted, tries }` | MP6 |
| `lab.tube(id)` | `{ on, over, shrink (0 to 1), split, grip, onBefore(jointId) }` | MP7 |
| `lab.adapter(id)` | `{ inStrip, into: jack or null }` | MP8 |
| `lab.viewed(anchor)`, `lab.tapped(anchor)` | the learner looked (label zoom, magnifier) or tapped | MP4, MP8, MP9 |
| `lab.card(kind)` | `{ done, firstTry }` | MP1, MP8 |
| `lab.board(id)` | `{ flipped, trimmed, cutClear, crossings, legs, snipped(ids), matchesPlan(planId) }` | MP10 to MP12 |
| `lab.plan(id)` | `{ lines, ticks, silent }` | MP12 |
| `lab.flexed` | the board is pressed | MP4, MP11, MP12 |
| `lab.view(name)` | as Start here R10, plus "heat", "scope", "magnifier", "underside" | several |

Size: M in all (the view grows; the data comes from the engines below).

### 7.3 Station engine: soldering and heat (pure TypeScript, deterministic, beside the circuit solver)

| Id | Need | Size | Used in |
|---|---|---|---|
| SE1 | **Iron temperature model:** setpoint 150 to 450 °C, a 60 W heater with on/off control, tip thermal mass, warm-up (about 20 s to 330 °C), recovery after a heavy load, tinning state (fresh, tinned, oxidised; oxidises when left hot and dry), cooling after switch-off (3.4 targets), heat drawn by whatever the tip touches (wires, pads, a copper bar, the cord, the desk paper). | M | MP1 to MP5 |
| SE2 | **Joint-quality model:** the per-joint thermal and solder model and the verdict engine of 3.4 and 3.5 (melt by alloy, flux on tip and work, wetting, volume, setting window, movement, neighbour pads, burn), with three outputs: a shape for the renderer, an electrical result (ohms, intermittent, bridged nets) and a mechanical result (holds, pulls, rocks). Includes quick mode (3.6). | L | MP2 to MP4, MP7, MP11, MP12 |
| SE3 | **Thermal damage to parts:** a lumped network from an iron spot on a lead, along lead segments, to a part's body (an LED's die, a transistor), with clip heat sinks (copper, steel) as thermal masses tied to air; body temperature goes to the circuit simulator (CS3). Calibrated to MP5's targets (7.8). Also gives MP11 its accidental case: a joint held far too long next to an LED. | M | MP5, MP11 |
| SE4 | Heat-shrink model: shrink fraction from heat dose (gun distance and time), the 2:1 limit, a split above an overheat dose, grip when the shrunk diameter is under the covered diameter. | S | MP7 |
| SE5 | Strip model: notch against copper and jacket diameters on solid and stranded scales; outcomes clean, nicked, slipped, cut strands; length from the jaw stop; twisting. | S | MP6 |
| SE6 | Braid: removes solder from a joint heated through it; the braid end silvers and stops working until cut. | S | MP4, MP12 |
| SE7 | Intermittent joints and flex: cold, disturbed and thin joints carry a contact state that opens while the board is pressed, tapped or tugged; pushed to the circuit simulator (CS4). | S | MP4, MP11, MP12 |
| SE8 | Heat view data: temperatures at every station anchor for the overlay (BP4). | S | MP1, MP3, MP5 |

### 7.4 Circuit simulator (`packages/sim`)

| Id | Need | Size | Used in |
|---|---|---|---|
| CS1 | `supply` kind (wall adapter), pins `pos neg`: `emf`, `ohms` (output resistance), `regulated` (holds `emf` up to `amps`, then folds back), `filterFarads` with `rippleHz` 100 or 120, twice the simulator's `MAINS_HZ` (unregulated: a ripple of about I ÷ (f × C) riding on the sagging output), `ac` (a sine of `emf` RMS at 50 or 60 Hz). The plug's polarity lives on the bench (which of `pos` and `neg` reaches the jack's tip). | M | MP8, MP9 |
| CS2 | **7805 regulator:** the simulator's `regulator7805` (pins `in gnd out`, `heatsink`) now exists and covers the set point (5 V within about 1%), dropout (about 1.95 V), 4 mA ground current, foldback, the TO-220 thermal model, shutdown and damage. Still to confirm or add, with golden tests (7.8): ripple on the input above dropout stays off the output (a few mV at most); a floating ground leg gives no regulation, the output rising toward the input less the dropout; `extra.dropout` is true while a sagging battery feeds it. | S | MP9 (and Unit 4) |
| CS3 | External heat into parts: `setInput(id, "bodyC", °C)` from the station engine; LED glow falls as the die warms and damage builds while it is very hot, ending in `died` with `cause: "overheat"`. Calibrated with SE3. | M | MP5, MP11 |
| CS4 | Solder joints in the netlist: each joint is a wire with `ohms` (0.005 Ω good, rising to open while intermittent and flexed); a bridge joins two nets. Uses the existing `setInput(id, "ohms")`. | S | MP4, MP10 to MP12 |
| CS5 | LED `size` 3 or 5: only the thermal mass changes. | S | MP5, MP11 |

### 7.5 Bench props and interactions (`packages/bench`)

| Id | Need | Size | Used in |
|---|---|---|---|
| BP1 | **Soldering iron and station:** base, dial, display, power switch, the iron on a cord with a resting tip, stand with brass wool and a damp sponge, fan; drag-to-rest iron, hold-to-feed solder, keyboard and one-hand play (3.2), consequences off the stand (scorch, softening cord). | L | MP1 to MP5, MP7, MP11, MP12 |
| BP2 | Helping hands with two clips; work pieces: crossed wires, a side-by-side splice, a leg through a pad. | M | station lessons |
| BP3 | Magnifier: zoom on one joint, drag to turn it, see the underside; `lab.viewed`. | M | MP4, MP11, MP12 |
| BP4 | Heat view: ink hatching by temperature on station parts, leads, clips and parts (denser is hotter), numbers on demand; the same in 3D and ink. | M | MP1, MP3, MP5, MP9 |
| BP5 | Tug and wiggle: drag a wire end or a leg; the joint's verdict decides (holds, pulls apart, rocks). | S | MP3, MP4 |
| BP6 | **Solder:** spools (leaded, lead-free, acid-core) with labels; pick one; touch the end to the tip or to the work. | S | MP2 on |
| BP7 | Heat-sink clips (copper, steel) that clip onto a lead at a distance; a marked iron spot on a lead. | S | MP5 |
| BP8 | **Wire stripper** with solid and stranded scales, a jaw stop and ruler; snips; hookup wire reels (22 AWG solid red and black, 22 AWG 7-strand) whose stripped ends go into breadboard holes and splices. | M | MP6, MP7 |
| BP9 | **Heat-shrink** tubes (1.6, 3.2 and 6.4 mm, 2:1) that slide along a wire only from a free end, park, and slide over a joint; a heat gun whose distance and dwell come from the drag. | M | MP7 |
| BP10 | Power strip (takes adapters only), wall adapters with printed labels (DC or AC mark, volts, current, polarity drawing, regulated or not), barrel plugs, barrel-jack boards with two pins that go into the rails either way round; label zoom. | M | MP8, MP9 |
| BP11 | Regulator bench part: TO-220 7805, legs `in gnd out`, three holes in a row. | S | MP9 |
| BP12 | **Perfboard:** pad-per-hole boards in set sizes; parts into holes from the top; flip (mirror about the vertical axis); bend legs along the underside hole to hole; joints where legs meet pads (tacked in MP10, quick mode in MP11, the full game on demand); bridges between neighbour pads; bare-leg crossings as shorts; snipping; the netlist from the board; `matchesPlan`. | L | MP10 to MP12 |
| BP13 | Plan card: an ink drawing of a board's top and mirrored underside, ghost outlines that parts snap to, numbered lines (LR5). | M | MP10 to MP12 |
| BP14 | Board flex: press and hold the board (or a toggle for one-hand play); `lab.flexed`. | S | MP4, MP11, MP12 |
| BP15 | Saw and vise: clamp the board's empty end, drag along a line; a line through a populated hole will not cut. | S | MP11 |
| BP16 | Safety touches: the robot's glasses from MP1, clippings that spring away when legs are snipped. | S | MP1 on |

### 7.6 3D and ink models

Every model needs both a 3D model and an ink drawing (`docs/BENCH-VIEWS.md`: the views must match). Our own designs.

| Id | Model | Size |
|---|---|---|
| MD1 | Soldering station: base with dial and display, iron and cord, stand with brass-wool cup and damp sponge, fume fan; scorch-mark decal. | M |
| MD2 | Solder spools: leaded, lead-free, acid-core, with labels; a wire end that can bead. | S |
| MD3 | Helping hands with magnifier. | M |
| MD4 | Joint renders for every verdict (good, cold, disturbed, too much, too little, bridge, burnt) on three kinds of work (crossed wires, splice, pad and leg), each in leaded bright and lead-free satin, plus molten states and flux wisps; procedural. | L |
| MD5 | Heat-sink clips (copper, steel); a 3 mm LED. | S |
| MD6 | Wire stripper with scales, snips, hookup wire reels and ends (jacketed, stripped, nicked, twisted, stranded). | M |
| MD7 | Heat-shrink tubes in three sizes (loose, shrunk, split) and a heat gun. | M |
| MD8 | Wall adapters (regulated DC, AC, centre minus, unregulated) with label art, a power strip, barrel plugs, a barrel-jack board. | M |
| MD9 | TO-220 7805 regulator with tab and printed marking (moves here from the Unit 4 3D list). | S |
| MD10 | Perfboard, pad per hole, top and underside; bent legs; plan card; saw, vise and offcut; stripboard and breadboard decoys exist. | M |
| MD11 | Desoldering braid on a spool. | S |
| MD12 | Copper bar; scrap wire with a corrosion state. | S |

### 7.7 Island and course

| Id | Need | Size |
|---|---|---|
| IC1 | Unit id `permanent` everywhere: `content/course.yaml` lists the upcoming unit as `making-it-permanent`, while `packages/isle` uses `permanent`. Use `permanent`, and add it to `units` after `switching` when content lands. | S |
| IC2 | Landmark `cable-pylon` (NEW) in `LANDMARKS_BY_UNIT.permanent` (between `solder-forge` and `perfboard-pier`) and `LANDMARK_SPEC` (foot 2.3, tiers 1), plus its model. | M |
| IC3 | New pieces `iron-stand`, `solder-spool` and `regulator` in `PIECES` and `PIECE_FOOT` (0.9 each), with models. | S each |
| IC4 | Models for `solder-forge` and `perfboard-pier` (in the catalog, no art yet). | M |
| IC5 | Thirteen parts-bin entries in `content/parts.yaml` (8.6). | S |

### 7.8 Engine and simulator checks (golden tests to add)

- SE1 and SE2: every row of the 3.4 table.
- SE2: on the crossed pair, solder fed at the work for 1.5 s gives `good`; a bead carried for 3 s and dabbed on cold
  wires gives `cold`; a tug during the setting window gives `disturbed`; 4 s of extra feed on a pad beside a
  neighbour gives `bridge`; braid with the iron for 3 s turns a `too much` joint `good`.
- SE3 and CS3 (MP5): iron at 330 °C on a 3 mm red LED's lead 12 mm from the body, LED at about 16 mm A: glow down by a
  third at 12 to 18 s and `died` at 25 to 35 s; a copper clip at 6 mm keeps it lit above 0.8 of its starting glow at
  120 s; a steel clip at 6 mm lets it die at 50 to 80 s; at 370 °C each time is about 20% shorter; a 5 mm LED lasts
  about 1.5 times as long.
- CS1 (MP8): AD1 gives 9.0 V ± 0.1 V at 20 mA. AD2 (9 V AC) peaks beyond ±10 V and a DC meter reads within ±0.3 V of
  zero. AD3 into J1 reverses the rails: C1 (100 µF 16 V) raises `reversed` within 1 s, warms visibly within 10 s and
  is `damaged` before `died`; the red LED with 1 kΩ stays dark and unharmed.
- CS1 (MP9): AD4 (emf 13 V, 8 Ω, 400 µF, 100 Hz) gives about 12.8 V with 0.4 to 0.6 V of ripple at 20 mA, and about
  12 V with about 3 V of ripple at 125 mA, troughs above 10 V.
- CS2 (MP9): with AD4 and the 220 Ω lamp, OUT is 4.9 to 5.1 V with under 10 mV of ripple. On B1 draining at 3600x,
  OUT stays within 0.1 V until IN falls below about 6.95 V, then follows IN less about 1.95 V. With RL (47 Ω) on AD4, U1's
  junction passes 55 °C within a minute and settles near 80 °C. With the ground leg open on AD4, OUT is 10 to 11.5 V; D5 shows red stress with no `died`.
- CS4: a joint flagged intermittent opens (no loop current) while the board is pressed, and closes again when it is
  released.
- MP11: the perfboard blinker blinks every 0.8 to 0.9 s, the same as the breadboard lab.

### 7.9 Order of work

1. LR1, LR2, SE1, SE2, SE8, BP1 to BP6, MD1 to MD4: MP1 to MP4 can ship (wave 1).
2. SE3, CS3, CS5, BP7, MD5: MP5.
3. SE4, SE5, BP8, BP9, MD6, MD7: MP6, MP7.
4. CS1, BP10, LR3, MD8: MP8. CS2 checks, BP11, MD9: MP9 (the `regulator7805` model is already in the simulator).
5. BP12 to BP15, LR5, SE6, SE7, CS4, MD10, MD11: MP10 to MP12.
6. IC1 to IC5 and LR6 alongside; the unit opens when its first module ships.

### 7.10 Summary by size

| Size | Needs |
|---|---|
| L | SE2 joint-quality model; BP1 soldering iron and station interactions; BP12 perfboard; MD4 joint renders |
| M | LR1 station benches, LR2 solution steps, LR6 sketches, LabView additions (7.2), SE1 iron temperature, SE3 thermal damage to parts, CS1 adapter supply, CS3 external heat into parts, BP2 helping hands, BP3 magnifier, BP4 heat view, BP8 wire stripper and wire, BP9 heat-shrink and heat gun, BP10 adapters and jacks, BP13 plan card, MD1, MD3, MD6, MD7, MD8, MD10, IC2, IC4 |
| S | LR3 cards, LR4 spool setting, LR5 plan panel (S to M), SE4, SE5, SE6, SE7, SE8, CS2 7805 checks, CS4, CS5, BP5, BP6 solder spools, BP7 heat-sink clips, BP11, BP14, BP15, BP16, MD2, MD5, MD9, MD11, MD12, IC1, IC3, IC5 |

---

## 8. Notes for authors and for the rest of the course

### 8.1 Differences from the Unit 3 outline (`later-units.md`)

- 9 lessons become 12. New: `pick-the-solder` (melting points and the spool choice), `strip-the-wire` (stripping was
  folded into the splice), `steady-five` (the 7805, moved from Unit 4). `joint-doctor` now comes before
  `cook-an-led`, so the heat lesson can close the module.
- `bench-supply` is narrowed to labels and polarity. The ripple comparison moves into `steady-five`, where the
  regulator answers it. No cord is cut: a ready-made barrel-jack board, as the outline's errata ask.
- A temperature-controlled station with a dial replaces the 15 W and 30 W fixed irons, so lessons can use real tip
  temperatures. Perfboard is pad-per-hole; plain unplated board is a parts-bin fact.
- Module 2 is "Wires and power" with the new landmark `cable-pylon`; the outline's `power-station` already belongs to
  Basics.
- `later-units.md` should point its Unit 3 section here.

### 8.2 Handover to Unit 4

- The 7805 now lives in MP9 `steady-five`. Unit 4's `five-volts-exactly` keeps logic levels and floating inputs and can
  open with a one-beat recap of the regulator. Its island piece `regulator` moves here; Unit 4 picks another.
- The simulator's `regulator7805` serves both units; the MP9 checks in 7.8 become shared golden tests.
- Unit 4 can rely on: soldering, perfboard, the barrel-jack board and an adapter, and "about 7 V in for 5 V out".

### 8.3 Achievements and bonus list

Suggested new achievements: `first-bond` ("Pass your first tug test", 20 XP; trigger from MP3 `tug-holds`), `cool-head`
("Keep a lamp alive under the iron for two minutes", 25 XP, hidden; MP5), `wearable` ("Build the antenna blinker",
30 XP; MP11 `it-blinks`), `for-keeps` ("Complete all 12 lessons of Making it permanent", 50 XP), `secret-smith` ("Find
six secrets in Making it permanent", 25 XP, hidden). None of these ids exist yet.

Bonus list for `secret-smith` (12): `copper-drinks`, `acid-spool`, `carry-on-tip`, `make-cold`, `steel-clip`,
`twist-strands`, `too-big`, `ac-wave`, `spare-heat`, `cross-legs`, `flex-test`, `no-line-no-beep`.

### 8.4 Hall of Fried Parts

- By design: MP5's 3 mm LED, "3 mm red LED, cooked by the iron".
- By accident: MP8's C1 if the centre-minus adapter stays in ("100 µF capacitor, reversed by a centre-minus
  adapter"); MP11's electrolytics if put in backwards; an LED cooked by a joint held far too long beside it (SE3).

### 8.5 Try it for real folds

Each notebook page carries an optional fold (at most 40 words, outside the budget) with real parts and safety lines.
Every soldering fold (MP1 to MP5, MP7, MP11, MP12) carries the same four habits in short form: iron in its stand,
glasses on, fan or open window, wash hands before eating. Younger learners solder with an adult.

| Lesson | Real parts | Extra safety line |
|---|---|---|
| MP1 | A temperature-controlled iron and stand | "Burn: cool running water for 20 minutes." |
| MP2 | Leaded or lead-free rosin-core solder, 0.5 to 1 mm | "Never use acid-core solder on electronics." |
| MP3 | 22 AWG solid hookup wire, helping hands | none |
| MP4 | Desoldering braid | "Braid gets hot fast. Hold it by the spool." |
| MP5 | A copper clip, a 3 mm LED, 470 Ω, a 9 V battery | "Parts stay hot after the iron leaves." |
| MP6 | A wire stripper, 22 AWG wire | none |
| MP7 | 2:1 heat-shrink, a small heat gun | "The gun's nozzle stays hot for minutes." |
| MP8 | A 9 V DC adapter, a barrel-jack board | "Never open an adapter or cut a plugged-in cord." |
| MP9 | A 7805, 0.33 µF and 0.1 µF capacitors | "The 7805 can run hot under load." |
| MP10 | Pad-per-hole perfboard | none |
| MP11 | The blinker's parts, perfboard, a fine saw | "Cut boards outdoors or over a bin: the dust irritates." |
| MP12 | A meter with a beep | "Beep only with the power off." |

### 8.6 Parts bin entries (new, for `content/parts.yaml`)

| Id | Name | Blurb | Facts |
|---|---|---|---|
| `soldering-iron` | Soldering iron | A temperature-controlled iron that lives in its stand. | Tip at 320 to 350 °C for leaded solder, 350 to 380 °C for lead-free. Stays hot for minutes after switch-off. |
| `solder` | Solder | A soft metal wire with flux in its core. | Tin-lead 63/37 melts at 183 °C; lead-free SAC305 at 217 to 220 °C. Never acid-core for electronics. |
| `helping-hands` | Helping hands | Two clips on arms, with a magnifier. | Holds work still while a joint sets. |
| `desoldering-braid` | Desoldering braid | Fine copper braid that soaks up molten solder. | Heat braid and joint together; cut off the used end. |
| `heat-sink-clip` | Heat-sink clip | A copper clip that pulls heat out of a lead. | Goes between the joint and the part's body. Copper beats steel. |
| `led-3mm` | 3 mm LED | A smaller LED, same as a 5 mm one electrically. | Less mass, so it heats faster under an iron. |
| `wire-stripper` | Wire stripper | Notched jaws that cut the jacket, not the copper. | Match the notch to the gauge; stranded wire has its own scale. |
| `hookup-wire` | Hookup wire | 22 AWG solid copper in a plastic jacket. | 0.64 mm copper. AWG: bigger numbers are thinner. |
| `heat-shrink` | Heat-shrink tube | Tube that shrinks to about half its width when heated. | Slide it on before soldering. Shrink with hot air, never the iron. |
| `wall-adapter` | Wall adapter | Turns mains into low-voltage DC for the bench. | Read the label: DC mark, volts, current, polarity. Unregulated ones read high on a light load. |
| `barrel-jack` | Barrel-jack board | A socket for an adapter's plug, with two pins for the rails. | 5.5 mm plugs are usually centre plus; some pedal adapters are centre minus. |
| `regulator-7805` | 7805 regulator | Three legs: about 7 V or more in, a steady 5 V out. | Printed side toward you: in, ground, out; the tab is ground. Spare volts become heat. |
| `perfboard` | Perfboard | A board of holes 2.54 mm apart, each with its own pad. | Nothing is joined until you join it. Underneath, the layout is mirrored. |

### 8.7 Writing

- Robot lines under 12 words, notes under 6, rules under 8; recount the quoted copy in each beats table (and its card)
  after any edit, as in `start-here.md`.
- Safety lines stay calm and exact. Never show or suggest catching an iron, cutting a live cord, opening an adapter,
  shrinking tube with the iron, or soldering without glasses and air.
- Never import wording from `.private/`. The hobby LED-cooking test and the adapter-ripple comparison are general ideas;
  the cases, numbers on our bench and all copy here are our own.
