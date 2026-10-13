# Foundations: three ways to start from zero

Status: proposal. Three sequence variants for a new first unit, for the owner to pick from (or mix). Nothing here is
built yet. Working title and id: **Foundations** (`foundations`), placed before Basics (`basics`).

What this doc takes as settled:

- **Bench-first lessons.** The lab is the lesson. You stay at the bench the whole time, the robot guides each step with
  a very short line, a discovery note pops up on the part at the moment you find something, and quick checks happen on
  the bench instead of a quiz page.
- Much less reading, a playful warm voice (most robot lines under 12 words), the Lab Notebook look (ink line drawings
  on grid paper).
- Micro-lessons of 4 to 8 minutes. Each places one island piece; each module ends with a landmark.

How lessons are described below: **Do** (what your hands do), **See** (what the bench shows), **Notes** (the discovery
notes that pop up on parts, near-final copy), **Check** (the bench check that replaces quiz items).

---

## 1. Diagnosis: where the course starts too deep

Root cause: Unit 1 follows the classic beginner-book order, which opens with the meter and a resistance measurement
and assumes you already know what electricity, a circuit and a battery are. On top of that, every lesson carries a
hook, four explain cards and five or six quiz items: about 600 words of reading around each lab.

| Where | What it assumes or rushes |
|---|---|
| U1 L1 `welcome-to-the-bench` (8 min) | The first hands-on moment is a pre-wired loop of four parts nobody has introduced ("a tiny light"). One card then names atoms, electrons, current, voltage, resistance and circuit; the next adds conventional current; a quiz asks you to match all four words. None of them is seen or felt first. |
| U1 L2 `meet-the-meter` (12 min) | The dial tour explains DC and AC volts, amps, milliamps, ohms and continuity before current, voltage or resistance mean anything. The mA and 10A sockets arrive before "flow" exists as an idea. |
| U1 L3 `tiny-and-huge-numbers` (10 min) | Four prefixes (k, M, m, µ), letter codes (4k7, 3R3), ranges, OL and autoranging in one lesson, plus a resistor measured in kilohms one lesson before resistance is explained. |
| U1 L4 `what-resists` (13 min) | The first real meaning of resistance, conductor and insulator only arrives in lesson 4, mixed with contact resistance and fair-test design. |
| U1 L7 `first-glow` (11 min) | The first circuit the learner wires, LED polarity, why a resistor is needed, schematic symbols and "order doesn't matter" all land at once. Symbols get a bonus task, never their own time. |
| Never taught before it is used | Static versus flowing charge (never). Atoms (one card in L16 `lemon-cell`). What a battery is and does (L16 to L18). A parts tour: clip leads, the switch and plain wire are never introduced. Safety reasoning: one card and one quiz item in L1. |
| Breadboard | First seen in U2 L7 `breadboard-inside`, lesson 25 of the course. |
| Continuity beep | Used in U1 L14 `fuse-guard`, then presented as new in U2 L1 `switch-anatomy` ("today you get a beeping tool"). |
| Schematic symbols | A bonus task in U1 L7; taught properly only in U2 L2 `mystery-switch` (symbols card, dot rule). |

---

## 2. The three variants

### 2.0 At a glance

| | A. Spark to circuit | B. Tools first | C. Case files |
|---|---|---|---|
| Pitch | The story of electricity, from atoms up to your first loop | Meet your bench, meter and breadboard, then discover electricity with them | Every lesson is a small puzzle on the bench that reveals one idea |
| Lessons, time | 12, about 77 min | 10, about 66 min | 12, about 77 min |
| First light | Lesson 2 (the tester) | Lesson 1, about minute 3 | Lesson 1, about minute 2 |
| Meter arrives | Lesson 8, after push, flow and squeeze | Lesson 2, before them | Lesson 8, after them |
| Breadboard | Lesson 10 | Lesson 4 | Lesson 10 |
| Feel | Calm, logical, a guided tour of nature | Practical, "now I own a bench" | Playful, a detective partner |
| Biggest risk | Opens on content the circuit simulator cannot drive (static) | Dial jargon before meaning; four tool lessons in a row feel like a manual | Puzzle cost; a stuck beginner; framing can wear thin |
| New tech | Most of it needed up front | Least | Medium |

Topic coverage (lesson numbers within each variant):

| Topic | A | B | C |
|---|---|---|---|
| Charge, electrons, atoms; static vs flowing | 1, 2, 5 | 6, 7 | 2, 3, 4 |
| Conductors and insulators | 2 | 3 | 2 |
| Circuit as a closed loop | 3 | 1, 7 | 1 |
| Push, flow, squeeze (V, I, R intuitions) | 4, 5, 6 | 7, 8, 9 | 4, 5, 6 |
| What a battery is and does | 7 | 2 | 7 |
| Multimeter tour, battery reading | 8 | 2 | 8 |
| Continuity beep | 10 | 3 | 10 |
| Breadboard (strips, channel, rails, x-ray, game) | 10 | 4 | 10 |
| Components tour | 11 (and along the way) | 1 | 11 |
| Schematic symbols | 11, 12 | 10 | 11, 12 |
| Units and prefixes (milli, kilo) | 9 | 5 | 9 |
| Safety (9 V safe, mains not) | 7 | 8 | 7 |

### 2.1 Shared choices (all three variants)

- **Everyday words first, units second.** Push, flow and squeeze are the words; volts (V), amps (A) and ohms (Ω) are
  introduced as their units. No formulas: Ohm's law stays a discovery in Basics (`find-the-law`).
- **One analogy, drawn in notebook ink: the marble loop.** A ring of track packed full of touching marbles. The battery
  is a lift that raises marbles (lift height is push, in volts). A gate counts marbles per second (flow, in amps). A
  narrow, bumpy stretch is a resistor (squeeze, in ohms): it slows the whole ring at once and gets warm. The LED is a
  one-way flap with a stiff spring: it swings only one way, needs nearly 2 V of drop to open, and flashes as marbles
  pass. Block the track anywhere and every marble stops, because they all touch. One at-home extra for squeeze: blow
  through a thin straw, then a long one.
- **Leave Basics its discoveries.** Foundations does not measure how much things resist (`what-resists`), does not
  stack cells or reveal the six cells inside a 9 V (`stack-the-cells`), and does not burn out an LED (`led-burnout`).
  Squeeze controls bottom out at a safe 470 Ω.
- **Bench defaults.** Clip leads on the desk until the breadboard lesson, then a half-size board (400 holes). The
  standard loop: 9 V battery (emf 9.4 V), 1 kΩ resistor, red LED: about 7.5 mA, a clear glow.
- **Ids that move.** Three current Unit 1 ids move into Foundations so progress and achievements survive:
  `welcome-to-the-bench`, `meet-the-meter`, `first-glow`. Each keeps the task ids whose action survives and bumps
  `version`. Every other Foundations id is new and checked unique against Units 1 and 2.
- **Landmarks.** Two new ones, `spark-gap` (The Spark Gap) and `pump-house` (The Pump House), plus `meter-tower` (The
  Meter Tower) moved from Basics, whose first module dissolves (section 3).

---

### 2.2 Variant A: "Spark to circuit" (the story of electricity)

Pitch: start tiny and build up. Charges, then charges on the move, then the loop, then push, flow and squeeze, then
the tools to measure and build. The order a physics teacher would choose.

Robot voice: "Everything is made of tiny charges. Let's find some." / "Static sits still. Next, we make it move." /
"Your first board. Your first light."

| # | Module | Lesson id | Title | Min | Big idea | Piece |
|---|---|---|---|---|---|---|
| 1 | A1 Sparks and flow (`sparks-and-flow`) | `rub-and-stick` | Rub, stick, zap | 6 | Atoms hold plus and minus charge; rubbing moves electrons; charge that sits still is static | capacitor |
| 2 | | `will-it-light` | Will it light? | 6 | Conductors let charge move, insulators hold it | wire-spool |
| 3 | | `welcome-to-the-bench` (moved) | Close the loop | 5 | Charge flows only around a complete loop | switch |
| 4 | A2 Push, flow, squeeze (`push-flow-squeeze`) | `the-push` | The push | 6 | Voltage is push, measured between two points; an LED needs enough of it | battery |
| 5 | | `the-flow` | The flow | 6 | Current is charge passing a point each second, the same all the way round | led-lamp |
| 6 | | `the-squeeze` | The squeeze | 6 | Resistance is how hard the path is; more squeeze, less flow everywhere | pot |
| 7 | | `pocket-power` | Pocket power, wall power | 7 | A battery is a chemical pump that runs down; small batteries are safe, the wall socket is not | cell-jar |
| 8 | A3 Tools of the trade (`tools-of-the-trade`) | `meet-the-meter` (moved) | Meet the meter | 8 | The meter turns push, flow and squeeze into numbers; black in COM, red in VΩ | meter-kiosk |
| 9 | | `milli-and-kilo` | Milli, kilo, go! | 5 | Kilo is a thousand times bigger, milli a thousand times smaller | header-fence |
| 10 | | `holes-that-hold-hands` | Holes that hold hands | 8 | Hidden metal strips join holes in fives; rails run long; the channel splits the sides | breadboard-patch |
| 11 | | `picture-language` | Parts and their pictures | 6 | Every part has a symbol; a drawing shows connections, not positions | diode |
| 12 | | `first-glow` (moved) | Your first board | 8 | Read a drawing, pick the parts, build it on the board | jumper-arch |

Landmarks: A1 `spark-gap` "The Spark Gap" (two copper horns with a small spark dancing between them). A2 `pump-house`
"The Pump House" (a battery-driven lift sends glowing marbles round a loop of track). A3 `meter-tower` "The Meter
Tower" (moved from Basics).

**A1 `rub-and-stick`: Rub, stick, zap**
- Do: rub the balloon on the wool scarf; hold it over paper bits; bring it near a second rubbed balloon; shuffle across
  the rug and touch the metal doorknob.
- See: minus marks gather on the balloon; paper hops up; the two balloons swing apart; a spark snaps at the knob.
- Notes: (zoom on an atom) "Atoms: a plus centre, minus electrons around it." (balloon) "Rubbing moved electrons from
  the wool onto the balloon." (balloons) "Same charges push apart. Opposites pull together." (spark) "Static is charge
  sitting still. A spark is it jumping."
- Check: tap what two rubbed balloons will do: pull together, push apart, nothing.

**A2 `will-it-light`: Will it light?**
- Do: the robot's tester is a battery, resistor and LED with two loose clips. Clip each tray object between them: key,
  coin, foil, paper clip, plastic spoon, eraser, rubber band, glass marble, wooden stick, pencil lead. Then touch both
  clips with a fingertip.
- See: metals light it; plastic, rubber, glass and wood leave it dark; pencil lead lights it; your finger does not.
- Notes: (magnifier on the key) "In metals, some electrons roam free." (spoon) "In plastic, electrons stay home. An
  insulator." (pencil lead) "Graphite conducts. Not every conductor is metal." (finger) "You conduct a little. Far too
  little for this LED."
- Check: a plastic-coated paper clip. Predict, test: dark on the coating, bright on the bare end.

**A3 `welcome-to-the-bench`: Close the loop** (reuses the current lab and task ids)
- Do: flip the switch; unclip any lead; clip it back. Bonus: clip a spare lead straight from plus to minus.
- See: glow; dark at once, wherever the gap is; glow again. Bonus: LED dark, battery warming (heat shimmer).
- Notes: "A circuit is a closed loop. One gap stops it all." (switch) "A switch is a gap you control. Closed means on."
  (bonus) "A short circuit: a shortcut with no part in it. The battery heats up."
- Check: tap three different spots where a gap would turn the LED off.

**A4 `the-push`: The push**
- Do: run the loop from an AA cell, then from the 9 V battery. Turn on the push view and the marble-loop panel.
- See: AA: dark, or the faintest glimmer. 9 V: a clear glow. The push view shades the plus side high; the marble lift
  rises six times higher.
- Notes: "Voltage is push, measured in volts (V)." (LED) "A red LED needs nearly 2 V before it really lights."
  (labels) "AA: 1.5 V. This one: 9 V." (two points) "Push is always between two points, like height."
- Check: tap two points with no push between them (both ends of one lead).

**A5 `the-flow`: The flow**
- Do: turn on flow dots. Clip a gate counter before the LED and one after it. Toggle "show electrons".
- See: dots stream from plus round to minus; both gates count the same; brighter LED, faster dots. Electrons drift
  the other way.
- Notes: "Current is flow, measured in amps (A)." "Nothing gets used up. What goes in comes out." "The LED takes
  energy, not charge." (electrons) "Electrons drift minus to plus. Drawings show plus to minus." (speed) "Each electron
  creeps slower than a snail. The push arrives at once."
- Check: predict a third gate after the resistor: fewer, the same, more.

**A6 `the-squeeze`: The squeeze**
- Do: turn the squeeze knob on a variable resistor (470 Ω and up). On the marble panel, swap a short wide stretch for
  a long narrow one. Swap two fixed resistors marked "small squeeze" and "big squeeze".
- See: more squeeze: dimmer LED and slower dots everywhere, not only after the resistor. Less squeeze: brighter.
- Notes: "Resistance is squeeze, measured in ohms (Ω)." "A resistor is a part made to squeeze a set amount." "Squeeze
  anywhere slows the whole loop." (try at home) "Blow through a thin straw, then a long one."
- Check: two loops on the same battery: tap the one that will glow brighter.

**A7 `pocket-power`: Pocket power, wall power**
- Do: x-ray an AA cell; fast-forward the LED loop; then sort the danger shelf: AA, 9 V, coin cell, wall socket, car
  battery, phone battery, disposable camera.
- See: two chemicals inside, kept apart by a thin wall; hours pass in seconds and the LED fades as the battery empties;
  shelf items get a "bench-safe" or "hands off" stamp.
- Notes: "A battery turns chemical energy into push." "It pumps electrons already in the wire." "Flat means the
  chemicals are used up." (9 V) "Too little push to drive a flow you'd feel." (socket) "230 V, or 120 V in North
  America. It can kill." (car battery) "Only 12 V, but hundreds of amps into a short." (phone battery) "Lithium: can
  burn if damaged or shorted." (camera) "Its flash holds about 300 V, even switched off." (coin cell) "Bench-safe.
  Swallowed, it burns: keep from small children."
- Check: the shelf sort itself; then "What ran out: the electrons or the chemicals?"

**A8 `meet-the-meter`: Meet the meter** (moved; keeps `plug-in`, `set-dial`, `read-battery`, `swap-probes`, `tired-battery`)
- Do: tour mode: tap the display, the dial, each socket, the probes. Plug black into COM, red into VΩ. Dial to DC
  volts, 20 V. Probe the 9 V battery, then swap the probes. Bonus: the tired battery. Dial to OFF.
- See: each feature glows with its note; 9.4 V; -9.4 V; the tired one about 7.6 V.
- Notes: (dial) "V with a straight line: steady push, like a battery's." "A: flow. Ω: squeeze. The beep: joined or
  not?" (sockets) "COM is home for black. Red moves." "mA and 10A are for flow. Later." (display) "OL: too big for this
  setting." (reading) "Labelled 9 V, reads about 9.4 V fresh." (minus) "Probes swapped. Nothing's broken."
- Check: set the dial for checking a battery; tap where black lives.

**A9 `milli-and-kilo`: Milli, kilo, go!**
- Do: resistors tagged 1 kΩ, 4.7 kΩ and 10 kΩ go into bins marked 1,000 Ω, 4,700 Ω and 10,000 Ω. A gate counter's
  unit button flips 0.0075 A to 7.5 mA. Then a timed round of tag pairs.
- See: the decimal point hops three places with each prefix step.
- Notes: "k is kilo: times 1,000. 4.7 kΩ is 4,700 Ω." "m is milli: a thousandth. 7.5 mA is 0.0075 A." "Small k,
  small m. Letter case matters."
- Check: the timed round, six pairs; no penalty, beat your own time.

**A10 `holes-that-hold-hands`: Holes that hold hands**
- Do: meter to the beep, touch the tips together. Probe a12 with c12, a12 with a13, e12 with f12. Guess the partners of
  a hole, then switch on x-ray. Place an LED with both legs in one strip, then move one leg.
- See: beep, silence, silence; the x-ray shows the metal strips; the LED lights once its legs sit in different strips.
- Notes: (beep) "Beep: joined by a good conductor. Silence: a gap." "Beep-test only with the power off." "Five holes
  in a strip share one clip." "The channel is a wall." "Rails run the long way: one for +, one for -." "Both legs in
  one strip: the clip bypasses the part."
- Check: which-holes game, three rounds (a strip hole, a rail hole, a hole by the channel).

**A11 `picture-language`: Parts and their pictures**
- Do: tap each desk part (wire, clip lead, battery, switch, resistor, LED): it flips into its symbol on the notebook
  page. Then drag the parts around the desk.
- See: what each part does, then its symbol; the drawing does not change when parts move.
- Notes: (battery) "Long line is +, short line is -." (wire) "A line. A dot where wires join." (crossing) "Crossing
  with no dot: not joined." (switch) "A hinged gap." (resistor) "A zigzag, or a box in many countries." (LED) "The
  arrow points the flow's way. Little arrows: light out." (LED part) "Long leg toward +." "A drawing shows connections,
  not positions."
- Check: symbol matcher (tap a symbol, then its part, six pairs); "Same circuit?" for two different-looking benches.

**A12 `first-glow`: Your first board** (moved; keeps `build-loop`, `flip-led`, `swap-order`, `match-symbols`)
- Do: follow the drawing: battery onto the rails, switch, the 1 kΩ (picked by its tag), LED with the long leg toward
  +, a jumper back to -. Flip the LED round, then back. Bonus: swap the resistor and LED order.
- See: glow; dark when flipped, and nothing breaks; same glow in the other order.
- Notes: "Every part bridges two strips." "Backwards LED: no light, no harm." "The resistor keeps the LED safe. Next
  unit shows why." "In one loop, order doesn't matter."
- Check: the build itself (it must match the drawing); tap the LED's + leg before placing it.

Strengths: the most logical order; push, flow and squeeze are felt before the meter names them, so the dial makes
sense; a satisfying arc from a spark to a built circuit. Risks: lesson 1 depends on the static toy (new tech, section
4) and is not a circuit at all; three "concept" lessons in a row (4 to 6) lean on overlays rather than building.

---

### 2.3 Variant B: "Tools first" (meet your bench)

Pitch: you've just been handed a workbench. Meet the parts, the meter, the beep and the board, then use them to
uncover what electricity is. The shortest variant, and the one closest to what the bench can already do.

Robot voice: "This is your bench now. Meet the crew." / "Black in COM. It never moves house." / "Beep means joined.
Silence means a gap."

| # | Module | Lesson id | Title | Min | Big idea | Piece |
|---|---|---|---|---|---|---|
| 1 | B1 Your bench (`your-bench`) | `welcome-to-the-bench` (moved) | Hello, bench | 6 | Six parts, each with a job; joined in a loop they make light | switch |
| 2 | | `meet-the-meter` (moved) | Meet the meter | 8 | The meter turns the invisible into numbers; a battery is a chemical pump that runs down | meter-kiosk |
| 3 | | `the-beep` | The beep test | 6 | Continuity beeps when a good conductor joins two points; metals conduct, plastics insulate | test-lead-arch |
| 4 | | `holes-that-hold-hands` | Inside the breadboard | 7 | Hidden metal strips join holes in fives; rails run long; the channel splits the sides | breadboard-patch |
| 5 | | `milli-and-kilo` | Milli, kilo, go! | 5 | Kilo is a thousand times bigger, milli a thousand times smaller | header-fence |
| 6 | B2 What flows? (`what-flows`) | `rub-and-stick` | What is electricity? | 6 | Atoms hold charge; rubbing moves electrons; in metals some roam free | capacitor |
| 7 | | `close-the-loop` | Loop on the board | 7 | Charge flows around a closed loop, the same everywhere, never used up | led-lamp |
| 8 | | `the-push` | Push, and how much is safe | 7 | Voltage is push between two points; an LED needs enough; 9 V is safe, mains is not | battery |
| 9 | | `the-squeeze` | The squeeze | 6 | More ohms, less flow, everywhere in the loop | resistor |
| 10 | | `first-glow` (moved) | Draw it, build it | 8 | A schematic is a picture language; build from one | jumper-arch |

Landmarks: B1 `meter-tower` "The Meter Tower" (moved from Basics). B2 `pump-house` "The Pump House".

**B1 `welcome-to-the-bench`: Hello, bench** (keeps `close-the-switch`)
- Do: pick up each tray part (wire, clip lead, battery, switch, resistor, LED) and drop it on its dashed outline on the
  desk. Flip the switch.
- See: each part turns in your hand as its note pops; the outlines form a loop; the LED glows.
- Notes: (wire) "Copper inside, plastic outside." (clip lead) "A wire with a spring clip each end." (battery) "Small
  round snap is +. Big six-sided one is -." (switch) "Opens and closes a gap." (resistor) "Holds the flow back. The
  stripes are a code." (LED) "Lights one way only. Long leg to +."
- Check: tap the part that holds the flow back; tap the LED's + leg.

**B2 `meet-the-meter`: Meet the meter** (moved; keeps its task ids)
- Do: tour mode (display, dial, sockets, probes). Plug in. DC volts, 20 V. Measure the fresh 9 V, then the tired one,
  then swap probes. Dial to OFF.
- See: 9.4 V; about 7.6 V; a minus sign.
- Notes: (dial) "V: push. A: flow. Ω: squeeze. Each gets a lesson soon." (sockets) "Black lives in COM. Red moves."
  "mA and 10A: for flow, later." (fresh) "A battery turns chemicals into push." (tired) "Same label, less left. Its
  chemicals are running out." (minus) "Probes swapped. Nothing's broken."
- Check: set the dial for a battery; tap the COM socket.

**B3 `the-beep`: The beep test**
- Do: dial to the beep, touch the tips. Probe a clip lead, the switch on and off, then tray objects: key, coin, foil,
  spoon, eraser, rubber band, glass marble, wooden stick. Find the broken cable among three.
- See: beeps for metal and a closed switch; silence and OL for plastic, rubber, glass and wood; one cable silent.
- Notes: "Beep: a good conductor joins the tips." "Conductor: lets charge through. Insulator: doesn't." (x-ray on the
  broken cable) "The copper snapped inside. The plastic hid it." "Beep-test only unpowered things."
- Check: sort the last three objects into conductor and insulator bins, then beep your guesses (the coated paper clip
  is one).

**B4 `holes-that-hold-hands`: Inside the breadboard**
- Do: beep between pairs of holes; guess a hole's partners; x-ray; fix an LED whose legs share a strip (battery and
  resistor already on the board).
- See, Notes, Check: as A10.

**B5 `milli-and-kilo`: Milli, kilo, go!**
- Do: tag-and-bin game: resistors tagged in kΩ into bins in plain ohms; an LED tag "20 mA" into "0.02 A"; a battery tag
  "9,000 mV" into "9 V". Timed round.
- Notes: as A9, with "20 mA is 0.02 A" and "9 V is 9,000 mV".
- Check: the timed round.

**B6 `rub-and-stick`: What is electricity?**
- Do, See, Notes, Check: as A1, plus the magnifier on a clip lead: "Remember the beeping key? Its electrons roam free."

**B7 `close-the-loop`: Loop on the board**
- Do: on the board, battery on the rails, switch, resistor and LED in place: add the last jumper. Flow dots on. Pull
  any jumper. Clip gate counters before and after the LED. Toggle "show electrons".
- See: glow and streaming dots; a gap anywhere stops everything; both gates equal.
- Notes: "A circuit is a closed loop. One gap stops it all." "Current is flow, measured in amps (A)." "Nothing gets
  used up." "Electrons drift minus to plus. Drawings show plus to minus." "Slower than a snail, but all at once."
- Check: tap three spots where a gap would stop the light; predict the gate after the resistor.

**B8 `the-push`: Push, and how much is safe**
- Do: measure an AA (about 1.6 V) and the 9 V. Run the loop from each. Probe both ends of one jumper. Sort the danger
  shelf.
- See: AA loop dark, 9 V loop glowing; 0.00 V across one jumper; shelf stamps.
- Notes: "Voltage is push, measured in volts (V)." "A red LED needs nearly 2 V before it really lights." "Push is
  between two points. Same point: 0 V." Shelf notes as A7 (9 V, socket, car battery, phone battery, camera, coin cell).
- Check: the shelf sort.

**B9 `the-squeeze`: The squeeze**
- Do: rank three resistors (470 Ω, 1 kΩ, 10 kΩ, labels readable after B5) by predicted brightness, then swap each into
  the loop with flow dots on. Turn the trimmer.
- See: 10 kΩ dim, 470 Ω bright; dots slow everywhere at once.
- Notes: "Resistance is squeeze, measured in ohms (Ω)." "More ohms, less flow." "Squeeze anywhere slows the whole
  loop." (try at home) "Blow through a thin straw, then a long one."
- Check: the ranking.

**B10 `first-glow`: Draw it, build it** (moved; keeps `build-loop`, `flip-led`, `swap-order`, `match-symbols`)
- Do: tap each part to see its symbol; drag parts around and watch the drawing stay put; build a fresh loop from a
  drawing; flip the LED.
- Notes: symbol notes as A11, build notes as A12.
- Check: symbol matcher; the build.

Strengths: cheapest to build (the meter, beep, x-ray and hover nets exist); light in the first three minutes; the learner
reaches Basics fluent with the meter, so Basics can go faster. Risks: the dial and sockets are explained before push,
flow and squeeze exist, which is the exact problem in today's L2; lessons 1 to 5 are all tours and drills, which is
the "too much like a manual" feeling the owner is moving away from.

---

### 2.4 Variant C: "Case files" (mystery boxes)

Pitch: every lesson opens on something odd at the bench. You and the robot investigate; solving it opens the box, and
the idea it hid becomes a discovery note in your notebook ("case notes"). Cases are ordered so each one needs only what
earlier cases revealed.

Robot voice: "My desk lamp is dark. Can you crack this?" / "Follow the loop. Where does the metal stop?" / "Case
closed. Loops need metal all the way round."

| # | Module | Lesson id | Title | Min | Big idea | Piece |
|---|---|---|---|---|---|---|
| 1 | C1 First cases (`first-cases`) | `welcome-to-the-bench` (moved) | The dark lamp | 5 | A circuit is a complete loop; metal must touch metal | led-lamp |
| 2 | | `will-it-light` | The junk drawer | 6 | Conductors let charge move, insulators hold it | test-lead-arch |
| 3 | | `rub-and-stick` | The clingy balloon | 6 | Atoms hold charge; rubbing moves electrons; static sits still on insulators | capacitor |
| 4 | | `the-flow` | The counting gates | 6 | Current is charge flowing, the same all the way round, never used up | wire-spool |
| 5 | C2 Push and squeeze (`push-and-squeeze`) | `the-push` | Two boxes, one lamp | 6 | Voltage is push between two points; an LED needs enough | battery |
| 6 | | `the-squeeze` | The stubborn knob | 6 | Resistance is squeeze; more squeeze, less flow everywhere | pot |
| 7 | | `pocket-power` | The tired battery | 7 | A battery is a chemical pump that runs down; small batteries are safe, mains is not | cell-jar |
| 8 | C3 Tool cases (`tool-cases`) | `meet-the-meter` (moved) | The black box | 8 | The meter reads push; black in COM, red in VΩ; a minus sign tells you which side is + | meter-kiosk |
| 9 | | `milli-and-kilo` | The prefix padlock | 5 | Kilo is a thousand times bigger, milli a thousand times smaller | header-fence |
| 10 | | `holes-that-hold-hands` | The secret wiring | 8 | Beep the holes: hidden strips of five, rails, the channel | breadboard-patch |
| 11 | | `parts-drawer` | The mixed-up drawer | 6 | Each part has a job and a symbol | resistor |
| 12 | | `first-glow` (moved) | The torn blueprint | 8 | A drawing shows connections; finish it, then build it | jumper-arch |

Landmarks: C1 `spark-gap` "The Spark Gap". C2 `pump-house` "The Pump House". C3 `meter-tower` "The Meter Tower"
(moved from Basics).

**C1 `welcome-to-the-bench`: The dark lamp** (keeps `close-the-switch`, `break-the-loop`, `mend-the-loop`)
- Case: the robot's desk lamp (battery, switch, resistor, LED, four clip leads) is dark, though it all looks connected.
- Do: flip the switch: nothing. Tap the battery's + with the loop tracer: the path lights lead by lead and stops at a
  clip resting on the battery's plastic wrapper. Move it onto the metal terminal. Then unclip any other lead. Bonus:
  the short circuit from A3.
- See: the tracer halts at the plastic; glow once moved; dark again with any gap.
- Notes: "Plastic is a gap. Clips must bite metal." "A circuit is a closed loop. One gap stops it all." (switch) "A
  gap you control. Closed means on."
- Check: tap three spots where a gap would turn the lamp off.

**C2 `will-it-light`: The junk drawer**
- Case: a clip lead is lost. What in this drawer could stand in?
- Do, See, Notes: as A2 (predict before each test).
- Check: the coated paper clip.

**C3 `rub-and-stick`: The clingy balloon**
- Case: a balloon is stuck to the wall with nothing holding it.
- Do, See: as A1, plus "stick it to the wall".
- Notes: as A1, plus (wall) "Its extra electrons nudge the wall's away. The wall pulls back." (balloon) "Rubber is an
  insulator. The charge can't run off."
- Check: "Can the balloon keep the lamp lit?" No: a spark is one quick jump; a lamp needs a steady flow round a loop.

**C4 `the-flow`: The counting gates**
- Case: does the LED eat some of the flow? Two gate counters will tell.
- Do, See, Notes, Check: as A5.

**C5 `the-push`: Two boxes, one lamp**
- Case: two sealed boxes with the same terminals. One lights the lamp, the other doesn't.
- Do: clip the lamp to box A, then box B; push view on; open both boxes.
- See: A dark (one AA cell inside), B glowing (a 9 V battery); B's push hill is six times taller.
- Notes, Check: as A4.

**C6 `the-squeeze`: The stubborn knob**
- Case: turning this box's knob dims the lamp. What's inside?
- Do: turn the knob with flow dots on; open the box (a variable resistor); swap two fixed resistors.
- Notes, Check: as A6.

**C7 `pocket-power`: The tired battery**
- Case: yesterday the lamp was bright. Today it's dim. Who did it?
- Do: fast-forward a fresh battery to watch it happen; x-ray an AA; fit a fresh battery. Then the robot finds a shelf
  of more power sources: sort it.
- Notes, Check: as A7.

**C8 `meet-the-meter`: The black box** (moved; keeps its task ids)
- Case: a sealed box with two terminals. Is there a battery inside? Which side is +?
- Do: meter tour; plug in; DC volts, 20 V; probe the box; swap probes. Open the box.
- See: 9.4 V, so there is a battery; the minus sign shows which terminal is +; the box confirms it.
- Notes: as A8, plus "A minus sign means red is on the lower side."
- Check: set the dial for this job; tap COM.

**C9 `milli-and-kilo`: The prefix padlock**
- Case: the parts cabinet has a three-wheel padlock; each wheel opens with a prefix pair.
- Do, Notes: as A9; each correct bin turns one wheel.
- Check: the timed round opens the cabinet (its parts are lesson 12's).

**C10 `holes-that-hold-hands`: The secret wiring**
- Case: an LED sits in the breadboard with both legs pushed in. Still dark.
- Do: meter to the beep, touch the tips; beep-map which holes are joined; then x-ray; fix the LED; play the game.
- Notes, Check: as A10.

**C11 `parts-drawer`: The mixed-up drawer**
- Case: the labels fell off the parts drawers. Put each part back with its name and symbol.
- Do: test each part to learn its job (beep the switch on and off, try the LED both ways in the tester, read the
  battery with the meter, spot the resistor's stripes); drop it in its drawer; the drawer shows its symbol.
- Notes: per part, the job plus symbol notes from A11.
- Check: symbol matcher; "Same circuit?" for two different-looking benches.

**C12 `first-glow`: The torn blueprint** (moved; keeps `build-loop`, `flip-led`, `swap-order`, `match-symbols`)
- Case: half the lamp's blueprint is torn off.
- Do: drag the missing symbols (switch, LED) onto the torn half; pick parts by their value tags; build it on the board;
  flip the LED.
- Notes: "A drawing shows connections, not positions." Build notes as A12.
- Check: the finished drawing and the build must match.

Strengths: discover-first in the strictest sense; light within two minutes; the robot gets a natural role with very
short lines; push, flow and squeeze come before the meter, so the dial reads as words you know; every lesson ends on an
"aha". Risks: each case needs props and a sealed box; a beginner can stall on a puzzle (mitigated by the loop tracer,
gentle hints and "Show me"); eleven mysteries in a row could feel samey, so cases vary the mechanic (find the gap, sort,
predict, open, beep, map, rebuild).

---

## 3. Impact on the existing course

### 3.1 Changes common to all variants

| Current lesson | Change | Why |
|---|---|---|
| U1 L1 `welcome-to-the-bench` | **Moves** to Foundations (A3, B1, C1). Keeps id and task ids, bumps version. Explain cards and quiz become notes and bench checks. | All of it is Foundations material. |
| U1 L2 `meet-the-meter` | **Moves** to Foundations (A8, B2, C8). Keeps id, task ids and the `first-reading` achievement. | The meter tour is a foundation. |
| U1 L3 `tiny-and-huge-numbers` | **Stays, trimmed**, as the first lesson of Basics: "Pick the right range" (ranges, OL, mega and micro, autoranging), 10 to 6 min. The kilo and milli card becomes a one-line recap. Keeps its lab and task ids. | Foundations teaches kilo and milli; ranges and OL are what `what-resists` needs next. |
| U1 L4 `what-resists` | Trim: card 1 "Everything resists" becomes a recap line; drop the `extremes` bonus (copper vs plastic). Keeps skin, water, fair test and all numbers. | Foundations says what conducts; Basics says how much. |
| U1 L5, L6 | No change. L5 now measures what the straw note predicted. | |
| U1 L7 `first-glow` | **Moves** to Foundations as the final build (A12, B10, C12), on the breadboard. Keeps id, `build-loop` (and `glow-getter`), `flip-led`, `swap-order`, `match-symbols`. Its "Why the resistor is there" card moves to `led-burnout`. | The first build belongs at the end of Foundations. |
| U1 L8 `led-burnout` | Becomes the first lesson of Current and LEDs; starts from the board loop; absorbs "why the resistor" (+2 min). | Gives the resistor its reason right where it burns out. |
| U1 L9 `measure-the-flow` | Card 2 "The same all the way round" becomes one line ("Your gates said so. Now the meter agrees."). Card 4 keeps µA and the electrons-per-second fact; mA is a recap. | Foundations shows equal gates qualitatively. |
| U1 L10 `volts-across` | Card 1 "Voltage is a difference" becomes a recap. | Foundations' "push is between two points". |
| U1 L11 to L15 | No change. | |
| U1 L16 `lemon-cell` | Card 3 "Atoms in one card" shrinks to ions only; card 4 keeps the Franklin and Thomson history but not the re-explanation of electron drift. | Atoms, electrons and drift direction are now in Foundations. |
| U1 L17, L18 | No change. Foundations deliberately leaves stacking cells and the six cells inside a 9 V to L17. | |
| U1 module `your-meter` | **Dissolves.** `meter-tower` moves to Foundations. | |
| U1 totals | 18 to 15 lessons, 6 to 5 modules, about 210 to about 175 min. `island-founder` says "all 15 lessons". `curious-mind` needs 8 Basics bonus tasks, but only 6 stay (3 move, `extremes` goes): lower it to 5 or add two bonus tasks. | |
| U1 story | The arrival scene (cable bridge, flickering robot) moves to Foundations lesson 1; Foundations ends with the robot's face glowing faintly and the bridge to Bareboard Isle extending. | |
| U2 L1 `switch-anatomy` | Hook no longer presents the beeper as new; `beep-test` shrinks to a one-step warm-up (or becomes a bonus). Fixes today's clash with U1 L14. | Continuity is in Foundations. |
| U2 L2 `mystery-switch` | Card 3 keeps switch symbols only; card 4 (dots and crossings) and q2, q3 (dot rule, basic symbol match) become recaps or go. | Foundations teaches basic symbols and the dot rule. |
| U2 L7 `breadboard-inside` | Drop `xray-hunt`, `fix-dark-led`, card 1 "What's under the holes" and q1. Keep `bus-gap`, `relay-on-board`, cards 2 to 4 and q2 to q5 (q2 as recap). Retitle "Board bugs and a relay on board"; 12 to 8 min. It becomes the first use of the full 830-hole board and of split rails. | Strips, rails, the channel and the same-strip bug are now Foundations. |

Unit 1 after Foundations:

| Module | Lessons |
|---|---|
| Resistance (`resistance`) | `tiny-and-huge-numbers` (Pick the right range), `what-resists`, `draw-a-resistor`, `reading-the-stripes` |
| Current and LEDs (`current-and-leds`) | `led-burnout`, `measure-the-flow` |
| Voltage and Ohm's law (`voltage-and-ohms-law`) | `volts-across`, `find-the-law`, `series-and-parallel` |
| Power and heat (`power-and-heat`) | `watts-and-heat`, `fuse-guard`, `inside-the-battery` |
| Cells and batteries (`cells-and-batteries`) | `lemon-cell`, `stack-the-cells`, `battery-field-guide` |

Optional, recommended: move `led-burnout` and `series-and-parallel` onto the half board so the breadboard skill does not
sit idle for 15 lessons (medium: lab rewrites plus solution replays). The rest of Basics stays on clip leads, which suit
meter-in-series work and desk props.

Existing learners: progress keys on lesson ids, so the three moved lessons keep their completion and XP. The new
Foundations lessons would make the course map send someone already in Basics back to lesson 1; Foundations should
show as open, never as "current", for anyone who has finished a Basics lesson (small change, section 4).

### 3.2 Variant deltas

| Variant | Extra impact |
|---|---|
| A | None beyond 3.1. Its gate counters and push view turn U1 L9 and L10 into "confirm with the meter" lessons, a clean intuition-to-numbers ramp. |
| B | B8 measures an AA, so U1 L3's `aa-cell` task becomes pure range practice (pick the 2 V range). B3 already sorts metals and plastics by beep, so U1 L4 drops `extremes` (as in 3.1) and U1 L14 `continuity-check` becomes practice. B2 uses the tired battery as the core "batteries run down" moment, so U1 L18 should not repeat it as a discovery. |
| C | None beyond 3.1. C8 reuses `meet-the-meter`'s tasks with the battery inside a box prop. |

---

## 4. New features each variant needs

Sizes: S (a day or two), M (about a week), L (more than a week). "Sim today" says whether the current simulator and
bench can drive it. Needed: x; optional: o.

| Id | Feature | Size | Sim today | A | B | C |
|---|---|---|---|---|---|---|
| R1 | Lab-only lessons: a lesson is a lab plus a short wrap; schema without hook, explain or quiz steps; ARCHITECTURE lesson length "8 to 15" becomes "4 to 15" | M | n/a | x | x | x |
| R2 | Discovery notes: lines on a task (or trigger) pinned to a part, hole or meter feature, drawn as margin notes, saved to the notebook | M | yes (anchors via `project`) | x | x | x |
| R3 | Bench checks: tap a part, tap holes, drop in a bin, or pick one of 2 to 4 cards over the bench; graded on the first try like quiz items so `firstTry` and `items` XP keep working | M | yes | x | x | x |
| R4 | Ghost outlines: dashed spots on the desk or board where a part goes | S | yes | o | x | o |
| V1 | Flow dots: dots ride leads, jumpers and parts at a speed from the part current (log scale), plus to minus; "show electrons" reverses them, labelled as slowed for real | M | yes (per-part `i`); bench needs lead and jumper paths. Planned as `flow-dots` | x | x | x |
| V2 | Gate counters: clip-on counters reading a lead's flow, unit toggle A and mA | S after V1 | yes | x | x | x |
| V3 | Push view: shade every lead and strip by its node voltage above battery minus (ink hatching, denser is higher) | M | yes (nodes, `nodeOf`). Planned as `pressure-map` | x | o | x |
| V4 | Marble-loop panel: a 2D notebook drawing driven live by the sim (lift height = battery volts, gate rate = loop current, narrow track = resistance, flap = LED) | M | yes, for a single series loop only (hidden otherwise) | x | o | x |
| V5 | Magnifier: zoom into a wire or object to see atoms; free electrons drift in metals, stay put in plastic | M | illustration only (no goal reads it) | x | x | x |
| V6 | Cutaways: AA cell, broken cable (snapped copper inside whole plastic) | S each | bench only | x | x | x |
| V7 | Loop tracer: tap a terminal and the path lights part by part until it reaches a gap | S | yes (`connectivity`) | o | o | x |
| P1 | Everyday objects: key, coin, foil, paper clip, coated paper clip (insulated body, bare end), pencil lead, eraser, rubber band, glass marble, plastic spoon, wooden stick; clips and probes bite them | M (models) | yes: each is a `probe-resistance` with a fixed value (metals under 0.1 Ω, pencil lead a few ohms, insulators 1e12 Ω or more) | x | x | x |
| P2 | Insulated attach spots: a clip can rest on a battery's wrapper or a coating and join nothing | S | yes (no node) | o | o | x |
| P3 | Fingertip: touch two clips or probes | S | yes (skin values from `what-resists`) | x | o | x |
| P4 | **Static toy**: balloon, wool scarf, paper bits, second balloon, rug and doorknob, with a small charge model (rubbing moves charge, like repels, charged attracts neutral, charge stays put on insulators, spark above a threshold) | L | **No.** The circuit simulator has no electrostatics. Needs its own small, pure, deterministic model so goals still read real state | x | x | x |
| P5 | Danger shelf: info-only props (wall socket, car battery, phone battery, disposable camera, 9 V, AA, coin cell) with a sort | S to M (art) | never simulated, by design: Ohmland does not model mains | x | x | x |
| P6 | Broken cable: a clip-lead param `broken: true` (open in the netlist) | S | yes | o | x | x |
| P7 | Sealed box: a lid that hides parts and shows only terminals or a knob; opens on solve or with x-ray | M | yes (bench grouping) | | | x |
| P8 | Fast-forward: a time-lapse button in labs plus a battery charge gauge (lab `speed` and `extra.soc` exist) | S | yes (a 500 mAh battery runs the 1 kΩ loop for about 65 h: about a minute at 3600x) | x | o | x |
| M1 | Meter tour mode: zoomed camera; display, OL, minus sign, each dial sector, each socket with its rating, probes and finger guards all tappable with notes; highlight anchors for sectors and sockets | M | yes. Planned as `meter-explorer` | x | x | x |
| M2 | Beep sound and LCD beep icon (if not already wired to `extra.beep`) | S | yes | x | x | x |
| B1 | Which-holes game: pick mode (tap a hole, tap its partners, check against `connectivity(bench)`), three rounds | S to M | yes (x-ray and hover nets exist). Same need as U2 L7 `xray-hunt`, which it replaces | x | x | x |
| S1 | Drawn schematic card: a hand-authored ink SVG per lab whose symbols carry part ids; tap a symbol to light its part and back; drag missing symbols in | M | not sim | x | x | x |
| S2 | Live schematic generated from the netlist (U1 N7) | L | not needed if S1 exists | | | |
| S3 | Symbol matcher and "Same circuit?" checks | S after S1, R3 | | x | x | x |
| S4 | Build-from-drawing goal: the bench loop matches the drawing | S | yes (`lab.seriesLoop`) | x | x | x |
| U1 | Prefix game: tags and bins, the decimal point hopping three places, a timed round. Planned as `prefix-slider` | S to M | n/a | x | x | x |
| U2 | Prefix padlock wrapper | S | n/a | | | x |
| I1 | `foundations` in the isle catalog (`UNITS`, `LANDMARKS_BY_UNIT`, `LANDMARK_SPEC`), landmark models `spark-gap` and `pump-house`, `meter-tower` moved from `basics`; `course.yaml` units `[foundations, basics, switching]` | M | n/a | x | x | x |
| I2 | Optional "Sketch Isle" theme: the island starts as an ink sketch on grid paper and inks itself in as pieces land (fits the Lab Notebook look) | M to L | n/a | o | o | o |
| I3 | Course map: Foundations never becomes "current" for a learner already in Basics | S | n/a | x | x | x |

Things the simulator cannot do and should not fake: electrostatics (P4 needs its own model), atom-level motion (V5 is a
labelled illustration), mains (never). Not needed: a live `emf` input for batteries, because every variant swaps
batteries instead of turning a voltage knob.

Rough totals beyond the shared bench-first runtime (R1 to R3): A about 7 to 9 weeks, B about 5 to 6, C about 8 to 10.
B is cheapest because it skips V3, V4, P7 and most of P8; the static toy (P4) is the single biggest item in all three.

---

## 5. Recommendation

**Pick C, "Case files", and build it in two waves.**

Why:

1. **It answers the owner's feedback in the right order.** Push, flow and squeeze are felt before the meter appears,
   so the dial reads as words you already know. B repeats today's mistake (the dial before its meaning); A gets the
   order right but opens on a balloon instead of a circuit.
2. **It is bench-first by nature.** A mystery on the bench is the purest "discover first": there is nothing to read
   until you have found something, and the discovery note lands at that moment. The robot's job (partner, hint giver)
   fits lines under 12 words.
3. **Fast first win.** You fix a dark lamp within about two minutes of arriving, the same payoff as B without B's tour.
4. **It keeps Basics' best moments intact.** Like the others, it leaves resistance numbers, cell stacking and the LED
   burnout to Basics, so the ramp goes feel, then measure, then calculate.

How to de-risk it:

- **Wave 1:** cases 1, 2 and 4 to 12, using the existing simulator, bench x-ray and meter plus V1 to V4, P1, P5 to P8,
  M1, B1, S1 and U1. **Wave 2:** case 3 (the clingy balloon) once the static toy exists. Nothing later depends on case
  3 except one contrast line in case 4, so it can ship last or slip to optional.
- Keep each case tiny (one question, one reveal) and always offer the loop tracer, hints and "Show me", so nobody stalls.
- If the sealed box (P7) slips, only cases 5, 6 and 8 use it; they work as plain bench lessons with the parts in view.
- Borrow from B: the beep-map of the breadboard (already in C10) and its "tired battery" reading as a bonus in C8.
- Borrow from A: its calmer titles if the case framing tests as too cute; the lesson order still works without it.

Open questions for the owner: the unit's shown name ("Foundations", "Start here", "First steps"); whether Foundations
gets its own small island (I1, recommended) or becomes the first district of Bareboard Isle; whether Basics moves two
labs onto the breadboard (3.1).

---

## Appendix: facts used (for review)

| Fact | Value used |
|---|---|
| 9 V battery terminals | Smaller round snap is +, larger six-sided snap is -. Fresh alkaline reads about 9.4 to 9.6 V unloaded (bench emf 9.4 V). |
| AA alkaline | Nominal 1.5 V, fresh about 1.6 V (bench emf 1.58 V); the end with the bump is +. Inside: zinc and manganese dioxide kept apart by a separator. |
| Red LED | Needs about 1.8 to 2 V (sim: 1.75 V at 1 mA, 1.85 V at 5 mA). A single AA cell through 1 kΩ gives far under 0.1 mA: dark or a faint glimmer. 9.4 V through 1 kΩ: about 7.5 mA. Long leg anode (+), flat rim side cathode (-). |
| Electron drift | In a clip lead carrying a few milliamps, around a thousandth of a millimetre per second: far slower than a snail. The push travels at close to light speed, so lamps light at once. |
| Static | Rubbing a rubber balloon on wool moves electrons onto the balloon (balloon negative). It clings to a neutral wall by nudging the wall's electrons away. A spark you can feel is thousands of volts with very little charge. Charge stays put on insulators. |
| Conductors | Metals (copper about one free electron per atom), graphite. Insulators: plastic, rubber, glass, dry wood. Dry skin conducts weakly (hundreds of kilohms between two points, from `what-resists`). |
| Safety | 9 V across dry skin drives at most tens of microamps (about 11 µA through the 840 kΩ dry-skin model): nothing you can feel. Mains: 230 V (UK, Europe and much of the world), 120 V (North America). Less than a tenth of an amp through the chest can stop a heart. A 12 V car battery can deliver hundreds of amps into a short. Lithium packs can burn if damaged or shorted. Camera flash capacitors hold about 300 V. Swallowed coin cells cause internal burns. |
| Breadboard | Half size: 30 numbered positions, holes a to e and f to j, 400 holes (300 in strips of five, 4 rails of 25). Full size: 63 positions, 830 holes (630 plus 4 rails of 50). Pitch 2.54 mm (0.1 in). The channel separates e from f. Rail stripes are paint: red for + is a habit, not wiring. Some full boards split their rails halfway. |
| Meter (bench) | Manual ranging, 3.5 digits (up to 1999), OL over range, minus sign for swapped probes. Sockets COM, VΩ, mA (fused, 200 mA), 10A (unfused). Continuity beeps below about 30 Ω. |
| Prefixes | k (kilo) times 1,000; m (milli) one thousandth. 4.7 kΩ = 4,700 Ω; 7.5 mA = 0.0075 A; 20 mA = 0.02 A; 9 V = 9,000 mV. |
| Symbols | Cell: long line +, short line -. Resistor: zigzag (US) or rectangle (IEC). LED: triangle into a bar, pointing the way conventional current flows, two small arrows out. Junction dot joins; crossing with no dot does not. |
| Units' names | Volt after Alessandro Volta, ampere after André-Marie Ampère, ohm after Georg Ohm. |
