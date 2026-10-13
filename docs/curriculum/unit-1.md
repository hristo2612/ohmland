# Unit 1 blueprint: Basics

This is the build sheet for Unit 1. Content authors turn each lesson below into a `lesson.yaml` and each lab into a
`content/labs/<lab-id>.ts`. Text in blockquotes (`>`) is final learner-facing copy: hooks and explain cards. Quiz,
task, wrap and mascot text is also final copy unless marked as a note. Anything marked **SIM NEEDS** goes beyond the
current contracts in `docs/ARCHITECTURE.md` and needs engine, bench or runtime work before the lab can ship.

All content here is original. It teaches standard physics and standard component values. Follow `docs/CONTENT.md`
when editing: no em dashes, units with a space, proper Ω and µ symbols, conventional current.

---

## 0. Conventions used in this blueprint

### 0.1 Ids

- Unit id: `basics`. Module ids: `your-meter`, `resistance`, `current-and-leds`, `voltage-and-ohms-law`,
  `power-and-heat`, `cells-and-batteries`.
- Lesson ids and lab ids are identical (one lab per lesson). Task ids are unique within their lab. Quiz item ids are
  unique within their lesson.
- Part ids inside a lab: `B` batteries, `X` single cells, `R` resistors, `D` LEDs, `S` switches, `F` fuses, `M1` the
  meter, `P` probe-resistance props, `FC` fruit cells. `gnd` is the battery's negative terminal node.

### 0.2 Standard bench parts (unless a lab says otherwise)

| Name | Netlist spec | Notes |
|---|---|---|
| Bench battery | `battery` emf 9.4, internalOhms 1.7, mAh 500 | A fresh 9 V alkaline. Reads 9.3 to 9.5 V unloaded. |
| Red LED | `led` color red, maxmA 50 | Typical 20 mA, absolute max 50 mA. Vf about 1.8 V at 5 mA, 1.95 V at 15 mA, 2.0 to 2.1 V at 20 mA. |
| Resistor | `resistor` watts 0.25 | 5% tolerance: actual value seeded per lab within ±5% of nominal. |
| Clip lead | bench connection | In labs with currents above 0.1 A, emitted as a 0.15 Ω `resistor` (see SIM NEEDS N3). |
| Meter | `multimeter` id M1, manual-ranging skin | Ranges below. Starts `off` unless the lab says otherwise. |

Meter ranges (labels as passed in `range`):

- `dcv`: 200mV, 2V, 20V, 200V. Input resistance 10 MΩ on every range.
- `dca-ma`: 2mA, 20mA, 200mA. Burden about 100 Ω, 10 Ω, 1 Ω. Internal fuse 200 mA (fast).
- `dca-10a`: 10A. Burden about 0.05 Ω. Unfused, rated 10 A for up to 10 s.
- `ohm`: 200, 2k, 20k, 200k, 2M. Display in the range's unit (2k range shows 0.466 for 466 Ω).
- `continuity`: beeps below about 30 Ω. `diode`: not used in Unit 1.
- Display: 3.5 digits (1999 counts). Over range shows `OL`. Reversed polarity shows a leading minus.
- Probe leads: about 0.1 Ω each.

### 0.3 Goal notation

Goals are written as compact pseudo code against the lab view. Helpers already in the contract: `part(id)`,
`meterReads(value, { tol })`, `isLit(id)` (glow > 0.1 and not dead), `fried(kind)` (a part of that kind died during
this lab). Additional helpers used below are proposed in SIM NEEDS N1:

- `meter.mode`, `meter.range`, `meter.red` / `meter.black` (socket the lead is plugged into: `com`, `vohm`, `ma`, `a10`),
  `meter.value` (parsed display number, `OL` as `Infinity`), `meter.display` (raw string).
- `across(partId)`: the probes touch that part's two pins, red on the first pin listed in its `pins`.
  `across(partId, "rev")`: red on the second pin.
- `inSeries(M1, partId)`: the meter's current path is in the same single loop as that part.
- `heldFor(seconds, condition)`: condition stayed true for that long in sim time.
- `note(id)`: a number the learner typed into the lab notebook for this task.
- `logged(tag)`: a meter reading was captured in the notebook with that tag (the notebook auto-tags readings by what
  the probes touch).
- `prop(id).state`: state of a custom lab prop (skin patch, water cup, pencil line, fruit cell).
- `event(type, partId?)`: a sim event of that type occurred during this lab.

### 0.4 Task types

All tasks are bench tasks checked against simulated state. Two task flavours need small runtime support
(SIM NEEDS N1, N2): **notebook** tasks (the learner types a number that is checked against the sim's real value) and
**bonus** tasks (optional: they give task XP but never block "Continue").

---

## 1. Unit overview

### 1.1 Goals

By the end of Unit 1 a learner with zero background can:

1. Use a multimeter correctly for DC volts, DC current (mA and 10 A), resistance and continuity, choose ranges, read
   prefixes and units, and avoid the classic mistakes (wrong socket, ammeter across a source).
2. Explain current, voltage and resistance in plain words, and connect each to how it is measured: current in series,
   voltage across, resistance with the power off.
3. Read resistor colour bands, understand tolerance and preferred values.
4. Build a battery, resistor and LED loop, get the LED polarity right, and size the resistor for a safe current.
5. Discover Ohm's law (V = I × R) from their own measurements and use it in all three forms, plus series and
   parallel resistance.
6. Calculate power (P = V × I), pick a resistor with an adequate power rating, explain what a fuse does, and explain
   why a real battery's voltage sags under load (internal resistance).
7. Build a working cell from fruit and two metals, stack cells in series, and choose and handle batteries safely.

### 1.2 The learner's journey

| Module | Feeling | Big moment |
|---|---|---|
| M1 Your meter | "I can see the invisible." | First real reading of a battery, and the first `OL`. |
| M2 Resistance | "Everything resists, even me." | Measuring your own skin, salt water and a pencil line. |
| M3 Current and LEDs | "I built a light, then I broke it." | First glow, then a deliberate LED burnout for the Hall of Fried Parts. |
| M4 Voltage and Ohm's law | "I found a law of nature." | Four measurements multiply to the battery voltage. |
| M5 Power and heat | "Now I know why things smoke." | A smoking resistor, a fuse that snaps, a battery that sags. |
| M6 Cells and batteries | "I made electricity from a lemon." | Four fruit cells light an LED with no resistor needed. |

Every module starts with something to try, ends with a landmark build on the island, and includes at least one
moment where breaking a part is the lesson.

### 1.3 The island: Bareboard Isle

- **Name:** Bareboard Isle. The first island in the archipelago.
- **Look at the start:** a bare circuit board floating in the sky. Matte green solder mask, empty copper pads, faint
  silkscreen outlines where parts will go, a single dead street lamp in the square where the robot sits.
- **Growth:** each lesson places one piece on a pad that was waiting for it, so the island reads like a board being
  populated. Copper trace roads light up as connected pieces join the network.
- **Districts:** the six landmarks sit in a rough ring: the Meter Tower near the arrival bridge (you need to see
  before you build), Resistor Hall in the middle, the Lighthouse on the cliff edge, the Observatory on the highest
  layer of FR4, the Power Station by the dangling wire roots, and the Lemon Grove on the far shore.
- **Palette notes:** warm amber for anything glowing, scorch marks stay visible on pads where parts fried (a quiet
  nod to the Hall of Fried Parts), lemons are the only yellow on the island.

### 1.4 The story

Light narrative glue, delivered through hooks and mascot lines only. Never more than two sentences per lesson.

You arrive by cable bridge on a bare board island. The robot that lives there has an LED face that is flickering on
almost no power: the island has no working lab. Together you set up a bench, learn to measure, light a lamp, find
the rule that governs every circuit, learn to respect heat, and finally make power from fruit. In the last lesson the
robot's face lights up at full brightness for the first time, powered by the Lemon Grove, and the cable bridge to
Unit 2 (Switching) extends.

The robot's working name is open (suggestion: "Dot", since an LED is a dot of light). Lines below do not use a name.

### 1.5 Lesson map

| # | Module | Lesson id | Title | Min | Island piece |
|---|---|---|---|---|---|
| 1 | M1 | `welcome-to-the-bench` | Welcome to the bench | 8 | switch |
| 2 | M1 | `meet-the-meter` | Meet your multimeter | 12 | meter-kiosk |
| 3 | M1 | `tiny-and-huge-numbers` | Tiny numbers, huge numbers | 10 | header-fence |
| 4 | M2 | `what-resists` | What resists? | 13 | wire-spool |
| 5 | M2 | `draw-a-resistor` | Draw a resistor | 10 | pot |
| 6 | M2 | `reading-the-stripes` | Reading the stripes | 13 | resistor |
| 7 | M3 | `first-glow` | Your first glow | 11 | led-lamp |
| 8 | M3 | `led-burnout` | One LED, too much current | 10 | diode |
| 9 | M3 | `measure-the-flow` | Measuring the flow | 13 | test-lead-arch |
| 10 | M4 | `volts-across` | Across, not in | 11 | jumper-arch |
| 11 | M4 | `find-the-law` | Find the law yourself | 14 | meter-kiosk |
| 12 | M4 | `series-and-parallel` | End to end, side by side | 13 | resistor |
| 13 | M5 | `watts-and-heat` | Watts and warm resistors | 12 | heatsink |
| 14 | M5 | `fuse-guard` | The part that fails first | 12 | fuse |
| 15 | M5 | `inside-the-battery` | The battery's hidden resistor | 11 | battery |
| 16 | M6 | `lemon-cell` | A battery from the fruit bowl | 12 | lemon-tree |
| 17 | M6 | `stack-the-cells` | Stack the cells | 12 | lemon-tree |
| 18 | M6 | `battery-field-guide` | A field guide to batteries | 10 | cell-jar |

18 lessons, about 210 minutes. Pieces reused on purpose: `meter-kiosk` (2 and 11), `resistor` (6 and 12, a second
row), `lemon-tree` (16 and 17, the grove starts growing before its landmark).

---

## 2. Module 1: Your meter (`your-meter`)

Summary: How the lab works, what electricity is in one minute, and the tool you will use in every lesson.
Landmark: `meter-tower`.

---

### L1. `welcome-to-the-bench`: Welcome to the bench

- **Summary:** Light your first LED with a switch and learn that current needs a complete loop.
- **Minutes:** 8
- **Prerequisites:** none
- **Objectives:** close and open a circuit; explain that current flows only around a complete loop; name current,
  voltage and resistance; know the sim is a safe place to break things and mains is never safe.
- **Unlocks:** parts `[battery-9v, alligator-clips]`; isle `switch`

#### Hook

> You step off the cable bridge onto a bare island. It looks like a giant circuit board: flat green land, copper
> paths, nothing built yet. A small robot rolls up. Its LED face flickers, then fades. It points at a workbench with a
> battery, a switch, a resistor and a tiny light. Everything here runs on electricity, and right now almost nothing
> works. Let's change that, one experiment at a time.

Visual: `{ kind: none }` (the 3D bench loads behind the hook).

Predict (ungraded): "The battery, switch, resistor and light are joined in one loop. If you unclip a single wire,
far away from the light, what happens to the light?"
Options: "It stays on" / "It gets dimmer" / "It goes out". (Revealed in task 2.)

#### Lab `welcome-to-the-bench`

- **Board:** none.
- **Initial parts:**
  - B1 `battery` emf 9.4, internalOhms 1.7, mAh 500. pos `n1`, neg `gnd`.
  - S1 `switch` a `n1`, b `n2`, closed false. (A large slide switch on a small wooden base.)
  - R1 `resistor` 1.5 kΩ, 0.25 W. a `n2`, b `n3`.
  - D1 `led` red. anode `n3`, cathode `gnd`.
  - Four clip leads already attached: B1.pos to S1.a, S1.b to R1.a, R1.b to D1.anode, D1.cathode to B1.neg.
- **Tray:** one spare clip lead.
- **Instruments:** none.
- **Tasks:**
  1. `close-the-switch`
     - Prompt: "Flip the switch and watch the LED."
     - Goal: `part(S1).closed && isLit(D1)`.
     - Hints: (1) "The switch is the slider on the wooden block. Click or tap it."
     - Success: "It glows. Current is flowing all the way around the loop."
     - Notice: the light comes on instantly, with no delay.
  2. `break-the-loop`
     - Prompt: "Keep the switch on. Now unclip any one lead, anywhere in the loop."
     - Goal: `part(S1).closed && bench.detachedLeadEnds >= 1 && part(D1).i < 1e-6`.
     - Hints: (1) "Drag one end of any clip lead off its part." (2) "Pick a lead far from the LED, then watch the LED."
     - Success: "Dark. One gap anywhere stops the flow everywhere."
     - Notice: the gap does not have to be next to the LED. Compare with your prediction.
  3. `mend-the-loop`
     - Prompt: "Clip the lead back on so the LED lights again."
     - Goal: task 2 done, then `isLit(D1)`.
     - Hints: (1) "Every part needs a lead on both of its ends."
     - Success: "Loop complete, light back on. You just repaired your first circuit."
  4. `swap-battery-leads` (bonus)
     - Prompt: "Curious? Swap the two leads on the battery's terminals."
     - Goal: `part(S1).closed && part(D1).v < -1 && part(D1).glow == 0`.
     - Hints: (1) "Unclip both battery leads and clip each onto the other terminal."
     - Success: "Nothing lights, and nothing breaks. The LED only lets current through one way. More on that in
       module 3."
- **Fried moments:** none.
- **SIM NEEDS:** N1 (`bench.detachedLeadEnds`, or an equivalent "loop open" helper).

#### Explain

1. **Electricity in one minute**
   > Everything is made of atoms, and atoms contain tiny charged particles called electrons. In a metal wire, some
   > electrons are free to drift. A battery pushes them around a path. That steady movement of charge is called
   > current. The push that drives it is called voltage. Anything that makes the flow harder is resistance. Current,
   > voltage and resistance: those three words carry this whole unit.

   Widget: `flow-dots` (dots drift around the bench loop at a speed tied to the sim current; stop when the loop opens).
2. **No loop, no flow**
   > Current only flows around a complete loop: out of the battery, through the parts and back into the battery. A
   > loop like that is called a circuit. Break it anywhere and the flow stops everywhere at once, not just after the
   > gap. A switch is simply a tidy way to open and close a gap on purpose.
3. **Which way does it flow?**
   > By an old agreement, we draw current leaving the battery's plus (+) terminal and coming back to its minus (−)
   > terminal. This is called conventional current, and every diagram in Ohmland uses it. Inside a metal wire the
   > electrons actually drift the other way. The maths gives the same answers either way. You will meet those
   > electrons again in the battery module.
4. **Break things here, not there**
   > On this bench you can burn out parts, blow fuses and drain batteries, and nothing real gets hurt. That is the
   > point: breaking things is a fast way to learn their limits. Small batteries, like the 9 V kind, are safe to
   > experiment with at home. Wall sockets are not. Mains electricity can kill, so it stays out of this course.

#### Quiz

1. `open-switch` (choice) "A loop has a battery, a switch, a resistor and an LED. The switch is open. Which parts
   carry current?"
   - "None of them" (correct). Why: an open switch is a gap, and a loop with a gap carries no current anywhere.
   - "Only the battery". Why: a battery with no complete loop has nowhere to push current.
   - "The parts between the battery's plus terminal and the switch". Why: current does not fill parts up to a gap.
     With a gap anywhere, the flow stops everywhere.
   - Explain: current needs a complete loop. Open the switch and the whole loop stops at once.
2. `which-word` (match) "Match each word to its meaning."
   - current: the flow of charge; voltage: the push that drives the flow; resistance: how hard a path is to flow
     through; circuit: a complete loop current can flow around.
   - Explain: these four words come back in every lesson. Voltage pushes, current flows, resistance holds it back,
     and all of it happens in a circuit.
3. `label-touch` (choice, spot the mistake) "Every part of Mia's circuit is connected, except one clip lead is clipped
   to the battery's plastic wrapper instead of its metal terminal. What does the LED do?"
   - "It stays dark" (correct). Why: plastic does not conduct, so the loop is not complete.
   - "It lights normally". Why: touching the battery is not enough. The lead must touch the metal terminal.
   - "It glows dimly". Why: a loop is either complete or it is not. Plastic leaves a gap.
   - Explain: a connection only counts when metal touches metal. Insulating plastic is a gap.
   - Hint: "What is a battery's wrapper made of?"
4. `direction` (choice) "In Ohmland's diagrams, which way do we draw current?"
   - "From the battery's plus terminal, through the circuit, back to minus" (correct). Why: that is conventional
     current, the agreed direction for diagrams.
   - "From minus to plus". Why: that is the direction electrons drift in a wire. Diagrams use the conventional
     direction instead.
   - "Both ways at once". Why: in a battery circuit current flows one way around the loop.
   - Explain: we use conventional current, plus to minus. Electrons drift the opposite way, and the maths works
     either way.
5. `safe-to-try` (choice) "Which of these is fine to experiment with at home?"
   - "A 9 V battery" (correct). Why: its low voltage and modest current make it a safe learning tool.
   - "A wall socket". Why: mains electricity can kill. Never experiment with it.
   - "A car battery". Why: it is only 12 V, but it can deliver hundreds of amps into a short circuit, enough to melt
     tools and cause burns.
   - Explain: low voltage alone is not the whole story. A 9 V battery is safe because it is low voltage and can only
     supply a small current.

#### Wrap

- Rules:
  - "Current only flows around a complete loop."
  - "Break the loop anywhere and the flow stops everywhere."
  - "Diagrams show current flowing from plus to minus."
  - "Break things in the simulator. Never touch mains."
- Try it for real: parts "a 9 V alkaline battery", "a red LED", "a 1.5 kΩ resistor", "four alligator clip leads";
  safety "Use a 9 V alkaline battery or smaller. Never connect anything to a wall socket."

#### Mascot

- Start: "Welcome! My face runs on fumes. Let's get this bench working."
- Hint: "Look for a gap. Light only flows around a full loop."
- Success: "A glow! That's the first light on this island in ages."

---

### L2. `meet-the-meter`: Meet your multimeter

- **Summary:** Plug in the leads, set the dial and take your first real reading of a battery.
- **Minutes:** 12
- **Prerequisites:** `welcome-to-the-bench`
- **Objectives:** identify the meter's sockets and dial sectors; set up for DC volts; measure a battery's voltage;
  interpret a negative reading; switch the meter off after use.
- **Unlocks:** parts `[multimeter, test-leads]`; isle `meter-kiosk`

#### Hook

> The robot hands you a chunky gadget with a dial, a screen and two wires, one red and one black. "This is how we
> see electricity," it beeps. You can't watch current or feel voltage, but this meter can measure both, plus
> resistance. Every experiment on this island starts with it. First job: find out whether the bench battery is fresh
> or tired.

Visual: `{ kind: part, part: multimeter }`.

Predict (ungraded): "A brand-new battery is labelled 9 V. What will the meter read?"
Options: "Exactly 9.00 V" / "A little under 9 V" / "A little over 9 V". (A fresh one reads about 9.4 V.)

#### Lab `meet-the-meter`

- **Board:** none.
- **Initial parts:** B1 `battery` emf 9.4, internalOhms 1.7 (standing upright, terminals up). B2 `battery` emf 7.6,
  internalOhms 6 (a scuffed "used" battery, set aside for the bonus task). M1 `multimeter` mode off, both leads lying
  unplugged next to it.
- **Tray:** none.
- **Instruments:** meter.
- **Tasks:**
  1. `plug-in`
     - Prompt: "Plug the black lead into **COM** and the red lead into **VΩ**."
     - Goal: `meter.black == "com" && meter.red == "vohm"`.
     - Hints: (1) "COM is short for common. It's where black always goes." (2) "VΩ is the socket for volts and
       ohms. The red plug goes there."
     - Success: "Leads in. Black in COM is a habit for life."
  2. `set-dial`
     - Prompt: "Turn the dial to DC volts, on the 20 V range."
     - Goal: `meter.mode == "dcv" && meter.range == "20V"`.
     - Hints: (1) "DC volts is the V with a straight line." (2) "Pick 20, the smallest range bigger than 9 V."
     - Success: "Ready to read up to 20 V."
  3. `read-battery`
     - Prompt: "Touch the red probe to the battery's small round terminal (+) and the black probe to the larger
       six-sided terminal (−)."
     - Goal: `across(B1) && meter.value >= 9.0 && meter.value <= 9.6`.
     - Hints: (1) "The two snaps on top are the terminals. Plus is the smaller, round one." (2) "Both probes must
       touch metal at the same time."
     - Success: "About 9.4 V. That battery is fresh."
     - Notice: the reading is a bit over 9 V, and it barely changes, because the meter draws almost no current.
  4. `swap-probes`
     - Prompt: "Now swap: red on minus, black on plus. What changes?"
     - Goal: `across(B1, "rev") && meter.value <= -9.0`.
     - Hints: (1) "Same terminals, other probes."
     - Success: "A minus sign. The meter isn't broken. It's telling you the red probe is on the lower side."
  5. `tired-battery` (bonus)
     - Prompt: "There's a used battery at the back of the bench. Measure it too."
     - Goal: `across(B2) && meter.value >= 7.2 && meter.value <= 8.0`.
     - Success: "About 7.6 V. Same label, less left in it."
- **Fried moments:** none.
- **SIM NEEDS:** N1 (`meter.red`, `meter.black`, `across`).
- **Lab exit:** when the learner presses Continue, the meter dial animates to OFF and the mascot says its "off" line
  (habit building, no task).

#### Explain

1. **Four sockets, two leads**
   > The black lead lives in COM, short for common, and almost never moves. The red lead does the moving. For volts
   > and ohms it goes in VΩ. For small currents it goes in mA, and for big currents in 10A. Plugging the red lead into
   > the wrong socket is the most common meter mistake, so glance at it before every measurement.

   Widget: `meter-explorer` (hover or tap any socket or dial sector to see what it is for).
2. **Reading the dial**
   > Each part of the dial is one kind of measurement. V with a straight line means DC volts: the steady kind a
   > battery makes. V with a wavy line means AC volts, the kind in wall sockets. A means amps and mA means milliamps.
   > Ω, the Greek letter omega, means ohms, for resistance. A little sound-wave icon marks continuity: the meter
   > beeps when two points are connected.
3. **Why 9.4 and not 9?**
   > A battery's label gives its nominal voltage, a round number for its type. A fresh 9 V alkaline battery usually
   > reads about 9.4 to 9.6 V with nothing connected. As it gets used, the reading slides down, so a quick voltage
   > check tells you roughly how much life is left. A reading well under 9 V means the battery is getting tired.
4. **A minus sign is just information**
   > Swap the probes and the meter shows a minus sign. Nothing is wrong. The meter always reports the red probe's
   > voltage compared with the black probe's. A negative number just means the black probe is touching the more
   > positive side. That makes the meter a handy way to find out which end of something is plus.

#### Quiz

1. `black-lead` (choice) "Where does the black lead go?"
   - "COM" (correct). Why: COM is the shared reference socket for every measurement.
   - "VΩ". Why: that is where the red lead goes for volts and ohms.
   - "mA". Why: the red lead goes there to measure small currents. Black stays in COM.
   - Explain: black in COM, always. Only the red lead moves between sockets.
2. `pick-range` (choice) "Your manual meter has DC volt ranges of 200 mV, 2 V, 20 V and 200 V. Which suits a 9 V
   battery best?"
   - "20 V" (correct). Why: it is the smallest range bigger than 9 V, so it shows the most digits.
   - "2 V". Why: 9 V is over this range's limit, so the screen shows OL.
   - "200 V". Why: it works, but you lose detail: you would see 9.4 instead of 9.42.
   - "200 mV". Why: far too small. You would see OL.
   - Explain: pick the smallest range that is still bigger than what you expect to measure.
3. `negative-reading` (choice, predict) "You measure a battery and the screen shows -9.42. What happened?"
   - "The probes are on the opposite terminals" (correct). Why: red is on minus and black on plus, so the meter
     shows a negative number.
   - "The battery is wired backwards inside". Why: a battery cannot flip itself. The meter only compares its two
     probes.
   - "The meter is damaged". Why: measuring volts the wrong way round is harmless. The minus sign is information.
   - Explain: the reading is always red compared with black. Swap them and the sign flips.
4. `dial-hotspot` (hotspot, 3D meter) "Tap the dial setting you would use to check a battery's voltage."
   - Target: the DC volts sector (any range). Wrong taps on AC volts, ohms or amps get a short note.
   - Explain: batteries make steady DC voltage, so you use the V with a straight line.
   - Hint: "Batteries make steady, one-direction voltage."
5. `ac-symbol` (choice) "Which marking means AC volts?"
   - "V with a wavy line" (correct). Why: the wave stands for voltage that keeps reversing, like a wall socket's.
   - "V with a straight line". Why: that one means DC, the steady kind from a battery.
   - "Ω". Why: that is the ohms setting, for resistance.
   - Explain: wavy means AC, straight means DC.
6. `blank-screen` (choice, spot the mistake) "The dial is on 20 V DC and the probes are on a battery, but the screen
   is completely blank. Most likely cause?"
   - "The meter's own battery is flat or missing" (correct). Why: a meter needs its own power to show anything.
   - "The battery being tested is dead". Why: a dead battery would still show a number, such as 0.00 or a low
     voltage. A blank screen means the meter itself is off.
   - "The probes are swapped". Why: swapped probes show a minus sign, not a blank screen.
   - Explain: a totally blank display almost always means the meter has no power of its own.

#### Wrap

- Rules:
  - "Black lead in COM. Red lead moves, so check it first."
  - "Measure voltage with the probes on two points."
  - "A minus sign means the probes are swapped, nothing more."
  - "Switch the meter off when you're done."
- Try it for real: parts "any digital multimeter", "a 9 V alkaline battery"; safety "Checking a battery's voltage is
  completely safe.", "Keep your meter away from wall sockets. Mains needs a properly rated meter and training."

#### Mascot

- Start: "Meet my favourite tool. It sees what we can't."
- Hint: "Black in COM, red in VΩ. Then the dial."
- Success: "9.4 volts. That battery is ready for anything."
- Lab exit: "Dial to OFF. Real meters thank you with longer battery life."

---

### L3. `tiny-and-huge-numbers`: Tiny numbers, huge numbers

- **Summary:** Learn the prefixes k, M, m and µ, choose meter ranges, and find out what OL means.
- **Minutes:** 10
- **Prerequisites:** `meet-the-meter`
- **Objectives:** convert between units with k, M, m and µ; tell M from m; choose the best manual range; interpret
  OL; read kilohms off the display.
- **Unlocks:** parts `[battery-aa]`; isle `header-fence`

#### Hook

> Electronics numbers come in wild sizes. An LED sips a few thousandths of an amp. A resistor can be a million ohms.
> Writing all those zeros gets old fast, so engineers use short prefixes: k, M, m and µ. Your meter uses them too,
> and its dial has several ranges for each kind of measurement. Pick the wrong range and the screen just says OL.
> Time to find out what that means.

Visual: `{ kind: part, part: multimeter }`.

Predict (ungraded): "You set the meter to its 2 V range and measure the 9 V battery. What does the screen show?"
Options: "2.00" / "9.42" / "OL" / "0.00". (Revealed in task 1.)

#### Lab `tiny-and-huge-numbers`

- **Board:** none.
- **Initial parts:** B1 bench battery. X1 `battery` emf 1.58, internalOhms 0.15, mAh 2500 (an AA cell lying in a
  small cradle with exposed end caps). R1 `resistor` 470 Ω (seeded actual 466 Ω), lying loose with both leads
  exposed. M1 with leads already in COM and VΩ, dial off.
- **Tray:** none.
- **Instruments:** meter.
- **Tasks:**
  1. `over-the-limit`
     - Prompt: "Set DC volts to the **2 V** range and measure the 9 V battery."
     - Goal: `meter.mode == "dcv" && meter.range == "2V" && across(B1) && meter.display == "OL"`.
     - Hints: (1) "Red on the round terminal, black on the six-sided one."
     - Success: "OL means over limit. 9 V is too big for a 2 V range. The meter is fine."
  2. `climb-a-range`
     - Prompt: "Turn up one range at a time. Stop at the first range that shows a real number."
     - Goal: `meter.range == "20V" && across(B1) && meter.value >= 9.0 && meter.value <= 9.6`.
     - Hints: (1) "The next range up from 2 V is 20 V."
     - Success: "20 V is the smallest range above 9 V, so it gives you the most useful digits."
     - Notice: on 200 V the same battery shows only one decimal place.
  3. `aa-cell`
     - Prompt: "Now measure the AA cell. Find the range that shows the most digits without OL."
     - Goal: `meter.range == "2V" && across(X1) && meter.value >= 1.40 && meter.value <= 1.65`.
     - Hints: (1) "An AA cell is about 1.5 V." (2) "The smallest range bigger than 1.5 V wins."
     - Success: "1.582 V. That's also 1,582 millivolts, if you like big numbers."
  4. `kilo-ohms` (notebook)
     - Prompt: "Turn the dial to **Ω, 2k range** and touch the probes to the resistor's two wire ends. The screen is
       in kilohms. Type the value in plain ohms into your notebook."
     - Goal: `meter.mode == "ohm" && meter.range == "2k" && across(R1) && note("ohms") >= 455 && note("ohms") <= 480`.
     - Hints: (1) "k means a thousand." (2) "0.466 thousand ohms is 466 ohms."
     - Success: "466 Ω. Same resistor, two ways to write it: 0.466 kΩ or 466 Ω."
     - Notice: resistors don't care which probe is which, so either way round works.
- **Fried moments:** none.
- **SIM NEEDS:** N1, N2 (notebook entry).

#### Explain

1. **Prefixes save zeros**
   > A prefix is a shortcut for a power of a thousand. k (kilo) means times 1,000. M (mega) means times 1,000,000. m
   > (milli) means divided by 1,000. µ (micro) means divided by 1,000,000. So 4,700 Ω is 4.7 kΩ, and 0.020 A is
   > 20 mA. Converting is just moving the decimal point three places at a time.

   Widget: `prefix-slider` (type a value, slide between µ, m, base, k and M, and watch the decimal point hop three
   places each step).
2. **Big M, little m**
   > Capital M means mega, a million. Small m means milli, a thousandth. One letter's case changes the value by a
   > factor of a billion: 5 MΩ is a billion times more than 5 mΩ. Printed parts sometimes use the letter as the
   > decimal point to avoid lost dots: 4k7 means 4.7 kΩ, 2M2 means 2.2 MΩ, and 3R3 means 3.3 Ω.
3. **Ranges and OL**
   > A manual meter makes you choose a range: the biggest value it will show. Too small, and you get OL, for over
   > limit (some meters show a lone 1 instead). Too big, and you lose digits. The sweet spot is the smallest range
   > that is still bigger than your reading. When you have no idea, start on the biggest range and step down.
4. **Meters that choose for you**
   > Auto-ranging meters pick the range by themselves. Handy, but now you must read the small unit letters on the
   > screen. A display of 1.48 could mean 1.48 V or 1.48 mV, which is a thousand times less. Our bench meter is
   > manual on purpose: it makes you think about the size of a value before you measure it.

#### Quiz

1. `amps-to-ma` (numeric) "0.047 A is how many milliamps?" Answer 47, unit mA, tolerance 0%.
   - Explain: milli means a thousandth, so multiply amps by 1,000: 0.047 × 1,000 = 47 mA.
   - Hint: "Move the decimal point three places right."
2. `ohms-to-meg` (numeric) "Write 3,300,000 Ω in megohms." Answer 3.3, unit MΩ, tolerance 0%.
   - Explain: a megohm is a million ohms, so 3,300,000 Ω is 3.3 MΩ.
3. `mv-reading` (choice) "An auto-ranging meter shows 1.48 with a small mV beside it. What is that in volts?"
   - "0.00148 V" (correct). Why: mV means millivolts. Divide by 1,000.
   - "1.48 V". Why: that ignores the m. The value is a thousand times smaller.
   - "1,480 V". Why: that treats milli as if it meant kilo.
   - Explain: always read the unit on an auto-ranging meter. The m makes a thousandfold difference.
4. `twelve-volts` (choice) "You expect about 12 V. Ranges: 200 mV, 2 V, 20 V, 200 V. Which do you choose?"
   - "20 V" (correct). Why: the smallest range above 12 V gives the most detail.
   - "2 V". Why: 12 V is over this limit, so you would see OL.
   - "200 V". Why: safe, but it shows fewer digits than 20 V.
   - Explain: the smallest range that still fits your value is the best one.
5. `prefix-match` (match) "Match each prefix to what it does."
   - k: times 1,000; M: times 1,000,000; m: divided by 1,000; µ: divided by 1,000,000.
   - Explain: each step is a factor of a thousand. Capitals make things bigger, except k, which is small by
     tradition.
6. `big-or-small` (choice) "Which is larger: 5 mΩ or 5 MΩ?"
   - "5 MΩ, by a factor of a billion" (correct). Why: mega is a million and milli is a thousandth. A million divided
     by a thousandth is a billion.
   - "5 mΩ, by a factor of a thousand". Why: small m is milli, the tiny one.
   - "They are the same". Why: the case of the letter matters a lot here.
   - Explain: capital M is mega, small m is milli. Mixing them up is a billionfold mistake.

#### Wrap

- Rules:
  - "k is a thousand, M is a million, m is a thousandth, µ is a millionth."
  - "Capital M and small m are a billion times apart."
  - "Choose the smallest range that's bigger than what you expect."
  - "OL means over limit: go up a range."
- Try it for real: parts "a multimeter", "a 9 V battery", "an AA battery", "any resistor"; safety "All of these
  measurements are safe. Measure resistors on their own, never while they are in a powered circuit."

#### Mascot

- Start: "Big numbers, tiny numbers. Let's tame them both."
- Hint: "OL? Nothing's broken. Turn the dial up one step."
- Success: "Kilo, mega, milli, micro. You speak fluent meter now."

---

## 3. Module 2: Resistance (`resistance`)

Summary: What resists current, how to measure it on everyday things, and how resistors announce their values.
Landmark: `resistor-hall`.

---

### L4. `what-resists`: What resists?

- **Summary:** Measure skin, water, copper and plastic, and meet conductors, insulators and fair tests.
- **Minutes:** 13
- **Prerequisites:** `tiny-and-huge-numbers`
- **Objectives:** measure resistance on the Ω setting; sort materials into conductors, insulators and in-between;
  explain why dissolved salt lowers water's resistance; recognise contact resistance; design a fair test by changing
  one variable at a time.
- **Unlocks:** parts `[]`; isle `wire-spool`

#### Hook

> Is your finger a wire? Sort of. Almost everything lets a little current through, and almost everything holds some
> back. That holding back is called resistance, and your meter can measure it with a tiny, harmless test current. The
> robot has set out a patch of skin, three cups of water, a copper wire and a plastic ruler. Let's find out who
> resists the most.

Visual: `{ kind: none }`.

Predict (ungraded): "Which of these do you think resists current the most?"
Options: "Salty water" / "Tap water" / "Distilled water" / "Dry skin". (Dry skin and distilled water both turn out
high; salty water is lowest.)

#### Lab `what-resists`

- **Board:** none.
- **Props (SIM NEEDS N4):**
  - `skin` a stylised forearm patch with controls: moisture (dry, damp, wet, salty), probe spacing marks (1, 2, 3,
    4 cm), pressure (light, firm). Probes snap to the marks.
  - `cup-distilled`, `cup-tap`, `cup-salty`: three labelled cups; dipping both probes in a cup connects that cup.
  - `copper-wire`: a 10 cm bare copper wire. `ruler`: a plastic ruler.
- **Netlist:** each prop is a `probe-resistance` whose `ohms` the lab sets (input key `ohms`), with ±4% random drift
  once per second for skin and water.
  - P1 skin: ohms = 2 × contact + spacing × bulk. Contact per probe (light / firm): dry 400 kΩ / 250 kΩ, damp 80 kΩ /
    50 kΩ, wet 18 kΩ / 12 kΩ, salty 4 kΩ / 3 kΩ. Bulk per cm: dry 20 kΩ, damp 10 kΩ, wet 5 kΩ, salty 2 kΩ.
    Examples (light): dry 2 cm 840 kΩ; wet 2 cm 46 kΩ; wet 4 cm 56 kΩ; salty 2 cm 12 kΩ.
  - P2 distilled 1.2 MΩ; P3 tap 40 kΩ; P4 salty 1.5 kΩ; P5 copper 0.02 Ω; P6 ruler 1e13 Ω.
- **Instruments:** meter, leads in COM and VΩ, dial off.
- **Tasks:**
  1. `dry-skin`
     - Prompt: "Set the dial to Ω, **200k** range. Touch both probes to the dry skin, 2 cm apart."
     - Goal: `meter.mode == "ohm" && prop(skin).moisture == "dry" && prop(skin).spacing == 2 && meter.range == "2M"
       && meter.value >= 0.3 && meter.value <= 1.9` (value in MΩ on the 2M range).
     - Hints: (1) "OL on 200k? The skin is over 200 kΩ. Step up a range." (2) "The 2M range goes up to just under
       2 MΩ."
     - Success: "Hundreds of kilohms. Dry skin is a pretty poor conductor."
  2. `wet-skin`
     - Prompt: "Tap **Wet** to moisten the skin and measure again, same spacing."
     - Goal: `prop(skin).moisture == "wet" && prop(skin).spacing == 2 && meter.display != "OL" && reading < 100 kΩ`.
     - Hints: (1) "Wet skin reads much lower. A smaller range gives more digits."
     - Success: "Tens of kilohms. Water where the probes touch lets current in far more easily."
  3. `double-spacing`
     - Prompt: "Keep the skin wet and the pressure the same. Measure at 2 cm, then at 4 cm. Does the reading double?"
     - Goal: `logged("skin wet 2cm") && logged("skin wet 4cm")` with the same pressure setting for both.
     - Hints: (1) "Move both probes to the 4 cm marks, or one probe to the far mark."
     - Success: "It went up, but nowhere near double. Most of the resistance is where the probes touch the skin, and
       that part didn't change."
     - Notice: contact resistance dominates; distance is only a small part.
  4. `three-cups`
     - Prompt: "Measure all three cups of water: distilled, tap and salty."
     - Goal: `logged("cup-distilled") && logged("cup-tap") && logged("cup-salty")`, each a non-OL reading.
     - Hints: (1) "Distilled water may need the 2M range." (2) "Salty water reads low. Try 2k."
     - Success: "Pure water barely conducts. It's what's dissolved in it that carries the current."
  5. `extremes` (bonus)
     - Prompt: "Last two: the copper wire and the plastic ruler."
     - Goal: `logged("copper-wire") && reading < 1 Ω` and `logged("ruler") && meter.range == "2M" && meter.display ==
       "OL"`.
     - Success: "Copper: next to nothing (most of that is your probe leads). Plastic: OL on every range. A conductor
       and an insulator."
- **Fried moments:** none.
- **SIM NEEDS:** N1, N4 (props and drift).

#### Explain

1. **Everything resists**
   > Resistance is how strongly something opposes current, measured in ohms (Ω). Metals like copper and silver have
   > very low resistance: they are conductors. Plastic, rubber and glass have huge resistance: they are insulators.
   > Plenty of things sit in between, like skin, damp wood and graphite. An ordinary wire is both at once: a copper
   > conductor wrapped in a plastic insulator.
2. **How the meter measures ohms**
   > On the Ω setting, the meter sends a tiny current from its own battery through whatever the probes touch, then
   > works out the resistance from the voltage that appears. That is why you never measure resistance in a powered
   > circuit: the circuit's own voltage confuses the meter, and can damage it. Measure parts on their own, with the
   > power off.
3. **Why skin readings wobble**
   > Your skin readings drifted because things you didn't control kept changing: how wet the skin was, how hard the
   > probes pressed, exactly where they landed. Scientists call these uncontrolled variables. To compare two
   > measurements fairly, change only one thing at a time. That is why you kept moisture and pressure the same when
   > you changed the spacing.
4. **Water is a fake conductor**
   > Pure water conducts poorly. Tap water and sea water conduct because of what is dissolved in them: salts and
   > minerals split into charged particles called ions, and the ions carry the current. More salt means more ions and
   > less resistance. It is also why wet hands and electrical equipment are a bad mix.

   Widget: `salt-shaker` (add pinches of salt to a cup and watch the ohms fall, on a log scale).

#### Quiz

1. `ol-next` (choice, predict) "You measure dry skin on the 200k range and the meter shows OL. What do you do next?"
   - "Switch up to the 2M range" (correct). Why: OL means the value is over 200 kΩ, so you need a bigger range.
   - "Press the probes harder". Why: that would lower the reading, but it changes the experiment instead of fixing
     the range.
   - "Replace the meter's battery". Why: OL is not a fault. It just means over limit.
   - Explain: OL always means "too big for this range". Step up until you get a number.
2. `spacing-double` (choice, predict) "On wet skin the meter reads 46 kΩ with the probes 2 cm apart. You move them
   to 4 cm. Roughly what will it read?"
   - "About 56 kΩ" (correct). Why: the contact resistance at each probe stays the same. Only the small part from
     distance grows.
   - "About 92 kΩ". Why: it would double only if all the resistance came from distance. Most comes from the contacts.
   - "About 23 kΩ". Why: a longer path never lowers the resistance here.
   - Explain: contact resistance dominates skin readings, so doubling the distance adds only a little.
3. `material-match` (match) "Match each material to the best description."
   - copper wire: conductor, very low resistance; plastic ruler: insulator, OL on every range; salty water: conducts
     because of dissolved ions; distilled water: conducts poorly, few ions.
   - Explain: metals conduct, plastics insulate, and water conducts only as well as its dissolved ions allow.
4. `to-kilo` (numeric) "Write 68,000 Ω in kilohms." Answer 68, unit kΩ, tolerance 0%.
   - Explain: divide by 1,000 to go from ohms to kilohms.
5. `letter-notation` (match) "Match each printed code to its value."
   - 4k7: 4.7 kΩ; 1R0: 1.0 Ω; 2M2: 2.2 MΩ; 680R: 680 Ω.
   - Explain: the letter sits where the decimal point goes, and also tells you the prefix. R means plain ohms.
6. `fair-test` (choice) "You want to know whether probe spacing changes skin resistance. Which test is fair?"
   - "Change the spacing and keep moisture and pressure the same" (correct). Why: with only one change, any
     difference must come from the spacing.
   - "Change the spacing and wet the skin for a clearer reading". Why: with two changes you can't tell which one
     caused the difference.
   - "Measure each spacing on a different day". Why: moisture and pressure will change between days too.
   - Explain: a fair test changes one variable and holds the rest steady.

#### Wrap

- Rules:
  - "Resistance is measured in ohms (Ω)."
  - "Conductors have low resistance. Insulators have very high resistance."
  - "Measure resistance with the power off."
  - "Change one thing at a time."
- Try it for real: parts "a multimeter", "two glasses of water", "a pinch of salt"; safety "Measuring your own skin
  on the Ω setting is safe: the test current is tiny.", "Never hold probes that touch anything powered, and never go
  near mains."

#### Mascot

- Start: "Everything resists a little. Let's find out who resists a lot."
- Hint: "OL just means bigger than this range. Step the dial up."
- Success: "Distilled water, terrible conductor. Salty water, much better. Science!"

---

### L5. `draw-a-resistor`: Draw a resistor

- **Summary:** Draw graphite lines, measure them, and discover how length and thickness set resistance.
- **Minutes:** 10
- **Prerequisites:** `what-resists`
- **Objectives:** predict how length and cross-section change resistance; design a line to hit a target value;
  describe a potentiometer as a resistor with a sliding contact.
- **Unlocks:** parts `[pencil-line]`; isle `pot`

#### Hook

> The "lead" in a pencil isn't lead at all. It's graphite, a form of carbon that conducts electricity, just not very
> well. That makes a pencil line a resistor you can draw. The robot has slid a card and a very soft pencil across the
> bench. Draw a line, put your probes on it, and find out what length and thickness do to resistance.

Visual: `{ kind: part, part: pencil-line }`.

Predict (ungraded): "You measure a pencil line end to end. Then you move one probe to the middle. The reading..."
Options: "halves" / "doubles" / "stays the same".

#### Lab `draw-a-resistor`

- **Board:** none.
- **Prop (SIM NEEDS N5):** `pencil-card`: a white card and a soft pencil. The learner draws a straight line by
  dragging (length 1 to 10 cm, snapping to 0.5 cm), can shade over it again (layers 1 to 4) and pick a width (narrow
  2 mm or wide 4 mm). An eraser clears the card. Probe tips snap to any point on the line.
- **Netlist:** P1 `probe-resistance` between the two probe points. ohms = 2 kΩ (contacts) + 20 kΩ per cm of probe
  separation, divided by layers, divided by 2 if wide. ±3% drift. Examples: narrow, 1 layer, 5 cm: 102 kΩ; 2.5 cm:
  52 kΩ; 2 layers, 5 cm: 52 kΩ.
- **Instruments:** meter, leads in COM and VΩ, dial on Ω 200k.
- **Tasks:**
  1. `first-line`
     - Prompt: "Draw a **5 cm** line with one pass. Put a probe on each end and measure it."
     - Goal: `prop(card).length == 5 && prop(card).layers == 1 && probes at both ends && reading between 80 kΩ and
       125 kΩ`.
     - Hints: (1) "Drag across the card to draw. The ruler shows centimetres." (2) "Probes snap onto the line."
     - Success: "About 100 kΩ. A pencil line really is a resistor."
  2. `half-way`
     - Prompt: "Slide one probe to the middle of the line."
     - Goal: `probe separation 2.0 to 3.0 cm && reading between 0.40 and 0.62 of the task 1 reading`.
     - Success: "About half. Half the length, half the resistance."
  3. `go-darker`
     - Prompt: "Shade over the whole line once more, then measure end to end again."
     - Goal: `prop(card).layers >= 2 && probes at both ends && reading < 0.65 × task 1 reading`.
     - Success: "More graphite gives the current more room, so the resistance drops."
  4. `hit-target`
     - Prompt: "Your turn to design. Make a line that measures **50 kΩ**, give or take 10%."
     - Goal: `reading between 45 kΩ and 55 kΩ`, probes on the line.
     - Hints: (1) "Shorter lines resist less." (2) "A second layer roughly halves the resistance." (3) "Try 5 cm with
       two layers, or 2.5 cm with one."
     - Success: "Right on target. You just designed a resistor."
  5. `slide-along` (bonus)
     - Prompt: "Keep one probe at the start and slowly drag the other along the line."
     - Goal: probe moved through at least 4 positions with readings rising each time.
     - Success: "A resistor with a sliding contact is called a potentiometer. You'll use real ones in the next unit."
- **Fried moments:** none.
- **SIM NEEDS:** N1, N2, N5.

#### Explain

1. **Longer means more**
   > A longer path gives current more material to push through, so resistance rises in step with length. Double the
   > length, double the resistance. That is why your reading halved when you measured half the line. Wires work the
   > same way: a very long, thin wire has noticeable resistance, even though copper is a great conductor.
2. **Thicker means less**
   > A wider or thicker path gives current more room, like extra lanes on a road. Double the cross-section and you
   > halve the resistance. Shading the line again added more graphite, so the reading dropped. That is why cables
   > for big currents are thick, while the wires inside a phone charger can be thin.

   Widget: `strip-resistance` (sliders for length and width of a strip, live ohms readout).
3. **Sliding contacts**
   > Real resistors use the same ideas: a thin film of carbon or metal, with its length and thickness chosen to hit a
   > value. A potentiometer is a resistor with a sliding contact. Move it, and the resistance between the contact and
   > either end changes smoothly, exactly like your probe gliding along the pencil line. Many volume knobs work this
   > way.

#### Quiz

1. `quarter-line` (numeric) "A 10 cm pencil line measures 200 kΩ end to end. Ignoring the contacts, what will you
   read with the probes 2.5 cm apart?" Answer 50, unit kΩ, tolerance 5%.
   - Explain: 2.5 cm is a quarter of the line, so you read a quarter of the resistance: 50 kΩ.
   - Hint: "What fraction of the line is between the probes?"
2. `double-both` (choice, predict) "You draw a new line twice as long and twice as wide as the old one. Its
   resistance is..."
   - "About the same" (correct). Why: doubling the length doubles it, doubling the width halves it. They cancel.
   - "Double". Why: that only counts the extra length and forgets the extra width.
   - "Four times as much". Why: extra width lowers resistance, it doesn't raise it.
   - Explain: length pushes resistance up, width pulls it down, in equal proportion.
3. `lowest-line` (choice) "Which pencil line has the lowest resistance?"
   - "Short, wide and dark" (correct). Why: short means less length, and wide and dark both mean more material.
   - "Long, thin and light". Why: that is the highest-resistance combination.
   - "Long, wide and light". Why: the width helps, but the length and light shading push resistance up.
   - Explain: for low resistance you want a short path with lots of conducting material.
4. `thick-cable` (choice) "Why are the cables to a car's starter motor so thick?"
   - "So they can carry a big current with very little resistance" (correct). Why: thick copper has low resistance,
     so little energy is wasted as heat.
   - "So they are strong enough to pull on". Why: strength is a bonus, not the reason for all that copper.
   - "Thick insulation stops shocks". Why: most of the thickness is copper, not insulation. The car runs at only 12 V.
   - Explain: big currents need low-resistance paths, which means lots of copper.
5. `quarter-hotspot` (hotspot, line figure) "One probe sits at the left end of a 10 cm line. Tap where the other probe
   should go to read about a quarter of the full resistance."
   - Target: the 2.5 cm mark (±0.5 cm).
   - Explain: resistance grows evenly along the line, so a quarter of the length gives a quarter of the resistance.

#### Wrap

- Rules:
  - "Longer path, more resistance."
  - "Wider or thicker path, less resistance."
  - "A resistor with a sliding contact is a potentiometer."
- Try it for real: parts "a very soft pencil (6B or softer)", "plain paper or card", "a multimeter"; safety "Completely
  safe.", "Real pencil lines vary a lot: expect anything from tens of kilohms to several megohms."

#### Mascot

- Start: "Grab the pencil. Today we draw electronics."
- Hint: "Too high? Make it shorter, or shade it darker."
- Success: "You drew a working resistor. Art class meets physics."

---

### L6. `reading-the-stripes`: Reading the stripes

- **Summary:** Decode resistor colour bands, check them with the meter, and catch an out-of-spec part.
- **Minutes:** 13
- **Prerequisites:** `draw-a-resistor`
- **Objectives:** read and write 4-band colour codes; explain tolerance and check a part against it; recognise E6
  preferred values; account for test-lead resistance.
- **Unlocks:** parts `[resistor]`; isle `resistor`

#### Hook

> Resistors are far too small for printed numbers, so they wear coloured stripes instead. Each colour stands for a
> digit, and the stripes together spell out the value. Learn the code and you can read a resistor at a glance, no
> meter needed. The robot has tipped out a bag of five resistors. One of them, it whispers, is not telling the truth
> about its value.

Visual: `{ kind: part, part: resistor }`.

Predict (ungraded): "Two resistors have identical stripes. Will the meter show exactly the same number for both?"
Options: "Yes, exactly" / "Close, but a little different" / "Completely different".

#### Lab `reading-the-stripes`

- **Board:** none.
- **Initial parts:** five loose resistors, not connected to anything, each with bands rendered from its nominal value:
  - R1 15 Ω (brown, green, black, gold), actual 15.2 Ω.
  - R2 150 Ω (brown, green, brown, gold), actual 148 Ω.
  - R3 470 Ω (yellow, violet, brown, gold), actual 466 Ω.
  - R4 1.5 kΩ (brown, green, red, gold), actual 1.52 kΩ.
  - R5 2.2 kΩ (red, red, red, gold), actual 2.46 kΩ (out of tolerance; body very slightly darkened).
- **Props:** a colour chart card (always visible), five value labels to drag, a small parts bin for rejects.
- **Instruments:** meter, leads in COM and VΩ, dial on Ω 2k.
- **Tasks:**
  1. `decode-yellow` (notebook)
     - Prompt: "Find the resistor with **yellow, violet, brown** stripes. Use the colour chart to decode it, and type
       its value in ohms."
     - Goal: `note("value") == 470`.
     - Hints: (1) "The first two stripes are digits: yellow is 4, violet is 7." (2) "The third stripe is how many
       zeros to add. Brown is 1."
     - Success: "4, 7 and one zero: 470 Ω."
  2. `measure-it`
     - Prompt: "Now measure it on the 2k range. Is it exactly 470 Ω?"
     - Goal: `meter.mode == "ohm" && across(R3) && meter.value >= 0.447 && meter.value <= 0.493`.
     - Success: "Close, not exact. The gold stripe promises within 5%, and this one is well inside that."
  3. `probe-tips`
     - Prompt: "Switch to the 200 range and touch the two probe tips together. What does a 'zero' read?"
     - Goal: `meter.range == "200" && probes shorted && meter.value >= 0.1 && meter.value <= 0.4`.
     - Success: "About 0.2 Ω. That's the meter's own leads. It only matters when you measure tiny resistances."
     - Notice: the 15 Ω resistor will read about 0.2 Ω high for this reason.
  4. `sort-the-bag`
     - Prompt: "Read and measure the other four, then drag the right value label onto each resistor."
     - Goal: labels 15 Ω, 150 Ω, 470 Ω, 1.5 kΩ, 2.2 kΩ placed on R1 to R5 respectively.
     - Hints: (1) "Read the stripes first, then confirm with the meter." (2) "Brown, green, red is 1, 5 and two
       zeros."
     - Success: "Five for five. Stripes and meter agree."
  5. `find-the-liar`
     - Prompt: "One resistor measures outside its 5% tolerance. Find it and drop it in the reject bin."
     - Goal: `R5 in reject bin`, and no other resistor in the bin.
     - Hints: (1) "Work out 5% above and below each value." (2) "2.2 kΩ plus 5% is 2.31 kΩ."
     - Success: "Caught it. 2.46 kΩ is more than 5% above 2.2 kΩ. That one was probably overheated at some point."
- **Fried moments:** none.
- **SIM NEEDS:** N1, N2, N6 (seeded per-part actual values, including one forced out-of-tolerance part).

#### Explain

1. **The colour code**
   > Each colour is a digit: black 0, brown 1, red 2, orange 3, yellow 4, green 5, blue 6, violet 7, grey 8, white 9.
   > Red through violet runs in rainbow order, which helps it stick. Hold the resistor with the gold or silver stripe
   > on the right. The first two stripes are digits, and the third says how many zeros to add. A gold third stripe
   > means divide by 10 instead.

   Widget: `color-code` (rotate a 3D resistor, tap each band to change its colour, live value readout; also a "read
   this one" drill).
2. **Tolerance**
   > No factory makes perfect resistors. The last stripe promises how close the real value will be: gold means within
   > 5%, silver within 10%. A 470 Ω gold-stripe resistor can measure anywhere from 446.5 Ω to 493.5 Ω and still be
   > fine. Precision resistors carry five stripes (three digits, a multiplier, then tolerance), often with brown for
   > 1%.
3. **Why 47 and not 50?**
   > Resistor values come from preferred-value series. The oldest, E6, has six steps per decade: 10, 15, 22, 33, 47
   > and 68, times any power of ten. They are spaced so each value's 20% tolerance range nearly meets the next. Finer
   > series add steps: E12 adds 12, 18, 27, 39, 56 and 82. That is why 470 Ω and 4.7 kΩ turn up everywhere.

#### Quiz

1. `read-4k7` (color-code, read) Bands yellow, violet, red, gold. Answer 4.7 kΩ, tolerance ±5%.
   - Explain: yellow 4, violet 7, red means two zeros: 4,700 Ω, which is 4.7 kΩ. Gold is ±5%.
2. `build-330` (color-code, build) "Give a 330 Ω, 5% resistor its stripes." Answer orange, orange, brown, gold.
   - Explain: 3, 3, then one zero (brown) makes 330. Gold for 5%.
   - Hint: "How many zeros follow 33 in 330?"
3. `in-spec` (choice) "A 2.2 kΩ resistor with a gold stripe measures 2,290 Ω. Is it within tolerance?"
   - "Yes" (correct). Why: 5% of 2,200 is 110, so anything from 2,090 to 2,310 Ω is fine.
   - "No, it's 90 Ω too high". Why: 90 Ω is only about 4% of 2,200 Ω, inside the 5% allowance.
   - "You need a datasheet to tell". Why: the gold stripe already tells you the tolerance.
   - Explain: work out the allowed range from the tolerance stripe, then compare.
4. `odd-one-out` (choice) "Which of these is **not** an E6 preferred value: 15, 33, 40, 68?"
   - "40" (correct). Why: the E6 values are 10, 15, 22, 33, 47 and 68. 40 falls between 33 and 47.
   - "15". Why: 15 is in the E6 series.
   - "33". Why: 33 is in the E6 series.
   - "68". Why: 68 is in the E6 series.
   - Explain: E6 is 10, 15, 22, 33, 47, 68, then repeats times ten.
5. `wrong-end` (choice, spot the mistake) "Lee reads a resistor as gold, red, violet, yellow and gets nonsense. What
   went wrong?"
   - "Lee read it from the wrong end" (correct). Why: the gold tolerance stripe goes on the right. Read the other way,
     it is yellow, violet, red, gold: 4.7 kΩ.
   - "The resistor is faulty". Why: the stripes are fine. They were just read backwards.
   - "Gold means zero". Why: gold is a tolerance (or a divide-by-10 multiplier), never a first digit.
   - Explain: put the gold or silver stripe on the right, then read left to right.
6. `body-colour` (choice) "Two resistors have identical stripes. One has a blue body, the other a beige body. What does
   that tell you about their values?"
   - "Nothing: the stripes set the value" (correct). Why: body colour depends on the type and maker, not the value.
   - "The blue one has a higher value". Why: body colour never encodes the value.
   - "The blue one is exactly 1%". Why: blue bodies are common on precision parts, but only the stripes are a
     promise.
   - Explain: ignore the body colour. Read the stripes.

#### Wrap

- Rules:
  - "Gold or silver stripe on the right, then read left to right."
  - "Two digits, then the number of zeros."
  - "Gold means ±5%, silver means ±10%."
  - "A real value close to the label is normal. Outside tolerance is not."
- Try it for real: parts "an assorted resistor kit", "a multimeter"; safety "Safe. Wear glasses when trimming
  resistor leads: the clipped ends can fly."

#### Mascot

- Start: "Stripes, not numbers. Let's crack the code."
- Hint: "Gold stripe on the right. Then read from the left."
- Success: "You caught the liar. Nothing gets past you now."

---

## 4. Module 3: Current and LEDs (`current-and-leds`)

Summary: Build your first LED circuit, push an LED past its limit on purpose, and measure current properly.
Landmark: `lighthouse`.

---

### L7. `first-glow`: Your first glow

- **Summary:** Wire a battery, resistor and LED into a loop yourself, and learn which way an LED goes.
- **Minutes:** 11
- **Prerequisites:** `reading-the-stripes`
- **Objectives:** build a series loop from loose parts; identify an LED's anode and cathode; explain why a resistor is
  needed; read the battery, resistor and LED schematic symbols; know that order in a single loop doesn't matter.
- **Unlocks:** parts `[led-red]`; isle `led-lamp`

#### Hook

> The robot's face is a single LED, and right now it is dark. Time to learn how to light one. An LED, short for
> light-emitting diode, is choosy: it only works one way round, and it needs a resistor to keep it safe. Today you'll
> wire one up yourself from a battery, a resistor and a few clip leads. No pre-built loop this time. Your hands, your
> circuit.

Visual: `{ kind: part, part: led-red }`.

Predict (ungraded): "You connect an LED the wrong way round. What do you think happens?"
Options: "It lights anyway" / "It stays dark" / "It burns out instantly".

#### Lab `first-glow`

- **Board:** none.
- **Initial parts (loose, unconnected):** B1 bench battery; R1 `resistor` 1.5 kΩ; D1 `led` red (5 mm, longer anode
  lead, flat spot on the cathode side of the rim).
- **Tray:** four clip leads (red, black, green, yellow), one spare red LED.
- **Instruments:** none. Live schematic panel on (SIM NEEDS N7).
- **Tasks:**
  1. `build-loop`
     - Prompt: "Use clip leads to make one loop: battery plus, then the resistor, then the LED, then back to battery
       minus. The LED's **longer leg** faces the plus side."
     - Goal: `isLit(D1)` and the loop contains exactly B1, R1 and D1 in series.
     - Hints: (1) "Plus, resistor, LED, minus. Each clip lead joins two neighbours." (2) "The resistor's ends are
       identical. The LED's are not: longer leg toward plus." (3) "See the flat edge on the LED's rim? That side goes
       toward minus."
     - Success: "Your loop, your light. Nicely done."
  2. `flip-led`
     - Prompt: "Turn the LED around by swapping its two legs."
     - Goal: `part(D1).v < -1 && part(D1).glow == 0`, loop otherwise intact.
     - Success: "Dark, and no harm done. An LED only lets current through in one direction."
     - Notice: almost the whole battery voltage now sits across the LED backwards. The resistor keeps any current
       tiny, so a short reverse test like this is harmless, though datasheets say to stay under about 5 V in reverse.
  3. `swap-order`
     - Prompt: "Turn the LED back. Now move the resistor to the other side, between the LED's short leg and battery
       minus."
     - Goal: `isLit(D1)` and topology B1.pos to D1.anode, D1.cathode to R1, R1 to B1.neg.
     - Success: "Same glow. In a single loop, the order of the parts doesn't matter."
  4. `match-symbols` (bonus)
     - Prompt: "Tap a symbol in the schematic panel, then the matching part on the bench. Do all three."
     - Goal: battery, resistor and LED symbols each matched to their part.
     - Success: "That's a schematic: the same circuit, drawn with symbols."
- **Fried moments:** optional. If the learner clips the LED straight across the battery with no resistor, D1 dies:
  Hall entry kind `led`, label "Red LED, no resistor on 9 V". The spare LED lets them carry on.
- **SIM NEEDS:** N7 (live schematic), LED reverse model (no damage at 9.4 V reverse through 1.5 kΩ).

#### Explain

1. **Anode and cathode**
   > An LED's two legs have different jobs. The anode is the positive side: the longer leg. The cathode is the
   > negative side: the shorter leg, next to a flat spot on the rim. Current flows in through the anode and out
   > through the cathode. Connect it backwards and the LED blocks the flow, so nothing lights. If someone has trimmed
   > the legs, look for the flat spot.

   Widget: `led-anatomy` (3D LED, tap to label anode, cathode, flat spot, lens).
2. **Why the resistor is there**
   > An LED can't limit its own current. Once the voltage across a red LED reaches about 2 V, a tiny bit more voltage
   > lets a lot more current through. Wired straight to a 9 V battery, it would take as much current as the battery
   > could supply, and burn out. The resistor holds the current to a sensible level. Next lesson you'll see what
   > happens when it isn't up to the job.
3. **Drawing circuits**
   > Engineers draw circuits with symbols. A battery is a pair of lines, with the longer line for plus. A resistor is
   > a zigzag, or a small rectangle in many countries. An LED is a triangle pointing into a bar, with two little
   > arrows for the light coming out. The triangle points the way conventional current flows: from plus toward minus.

   Widget: `schematic-split` (3D bench beside its schematic; hover a part in one to highlight it in the other).
4. **Order doesn't matter**
   > In a single loop, the same current passes through every part, one after another. So it makes no difference
   > whether the resistor comes before or after the LED: it limits the current either way. What matters is that every
   > part is in the loop, and that the LED faces the right way.

#### Quiz

1. `cathode-hotspot` (hotspot, 3D LED) "Tap the LED's cathode, the leg that goes toward minus."
   - Target: the shorter leg on the flat-spot side.
   - Explain: the cathode is the shorter leg, beside the flat spot on the rim.
   - Hint: "Look for the flat edge on the rim."
2. `reversed-led` (choice, predict) "In a working battery, resistor and LED loop, you turn the LED around. What
   happens?"
   - "It goes dark" (correct). Why: an LED blocks current in the reverse direction.
   - "It glows more dimly". Why: an LED doesn't half-conduct backwards. It blocks.
   - "It burns out". Why: with the LED blocking, almost no current flows, so nothing is overloaded.
   - Explain: LEDs conduct one way only. Backwards, they stay dark.
3. `current-path` (order) "Current leaves the battery's plus terminal in the circuit shown (plus, resistor, LED,
   minus). Put the places it passes in order."
   - Correct order: battery plus terminal; resistor; LED anode; LED cathode; battery minus terminal.
   - Explain: conventional current flows from plus, through each part in turn, into the LED's anode and out of its
     cathode, then back to minus.
4. `symbol-match` (match, symbol images) "Match each symbol to its part."
   - long and short parallel lines: battery; zigzag line: resistor; triangle into a bar with two outward arrows: LED;
     plain line: wire.
   - Explain: schematics replace pictures with simple symbols, so circuits are quick to draw and read.
5. `dark-loop` (choice, spot the mistake) "Ana's LED stays dark. Her loop runs: battery plus to the LED's short leg,
   LED's long leg to the resistor, resistor to battery minus. What's wrong?"
   - "The LED is backwards" (correct). Why: the short leg (cathode) is facing plus. Swap the LED's legs.
   - "The resistor is on the wrong side". Why: in a single loop the resistor works on either side.
   - "She needs a second resistor". Why: one resistor is enough. The LED is simply reversed.
   - Explain: long leg toward plus. Check the LED first whenever a loop stays dark.
6. `resistor-way-round` (choice) "Does it matter which way round a resistor goes?"
   - "No" (correct). Why: resistors behave the same in both directions.
   - "Yes, the gold stripe must face plus". Why: the gold stripe only shows tolerance.
   - "Only on 9 V circuits". Why: resistors have no polarity at any voltage.
   - Explain: resistors have no polarity. LEDs do.

#### Wrap

- Rules:
  - "LED: long leg (anode) toward plus, flat side (cathode) toward minus."
  - "An LED always needs something to limit its current, usually a resistor."
  - "In a single loop, the order of the parts doesn't matter."
  - "Resistors work either way round. LEDs don't."
- Try it for real: parts "a 9 V battery (a snap connector helps)", "a red 5 mm LED", "a 1.5 kΩ resistor", "three
  alligator clip leads"; safety "Never connect an LED straight across a 9 V battery without a resistor: it will burn
  out."

#### Mascot

- Start: "My face is an LED. Let's learn how to light one."
- Hint: "Long leg toward plus. Flat side toward minus."
- Fried: "Oof. No resistor, no mercy. There's a spare in the tray."
- Success: "It glows! You built that loop from scratch."

---

### L8. `led-burnout`: One LED, too much current

- **Summary:** Shrink the resistor step by step until the LED gives up, then learn to read a part's limits.
- **Minutes:** 10
- **Prerequisites:** `first-glow`
- **Objectives:** relate smaller resistance to larger current and brighter light; explain why too much current
  destroys an LED; distinguish absolute maximum from typical ratings; know damage is permanent.
- **Unlocks:** parts `[]`; isle `diode`

#### Hook

> Your LED glows politely. What if you want it brighter? Less resistance should let more current through. But every
> part has a limit, and LEDs are famously easy to push past theirs. The robot has a tray of smaller resistors and a
> few spare LEDs. In real life, cooking an LED wastes a part. Here it earns a spot in the Hall of Fried Parts. Go on,
> find the limit.

Visual: `{ kind: part, part: led-red }`.

Predict (ungraded): "You swap the 1.5 kΩ resistor for a 15 Ω one. What happens?"
Options: "Very bright, and it stays that way" / "A bright flash, then darkness" / "Nothing changes".

#### Lab `led-burnout`

- **Board:** none.
- **Initial parts:** B1 bench battery; a pair of resistor clips (R slot) holding R1 1.5 kΩ; D1 red LED. Wired: B1.pos
  to R slot, R slot to D1.anode, D1.cathode to B1.neg. LED is lit.
- **Tray:** resistors 470 Ω, 150 Ω, 15 Ω (all 0.25 W); three spare red LEDs.
- **Instruments:** LED stress bar (SIM NEEDS N8): a bar above D1 showing its current as a share of its 50 mA maximum,
  green below 50%, amber to 90%, red above. No numbers yet.
- **Expected:** 1.5 kΩ about 5 mA (glow about 0.35); 470 Ω about 16 mA (about 0.6); 150 Ω about 47 mA (about 0.9,
  bar amber-red, health `hot`); 15 Ω several hundred mA, LED dies within about 0.5 s with a bright flash.
- **Tasks:**
  1. `brighter`
     - Prompt: "Swap the 1.5 kΩ resistor for the **470 Ω** one."
     - Goal: `R slot holds 470 Ω && isLit(D1) && part(D1).glow > 0.5`.
     - Hints: (1) "Drag a resistor from the tray onto the two clips. The old one pops out."
     - Success: "Brighter. Less resistance lets more current through."
  2. `brighter-still`
     - Prompt: "Now try **150 Ω**. Watch the LED's stress bar."
     - Goal: `R slot holds 150 Ω && part(D1).glow > 0.8 && part(D1).health != "dead"`.
     - Success: "Dazzling, and the stress bar is nearly full. It's alive, but close to its limit."
  3. `too-far`
     - Prompt: "Go on. Try the **15 Ω** resistor."
     - Goal: `fried("led")`.
     - Success: "Flash, then nothing. Far too much current, and the LED died. It goes to the Hall of Fried Parts."
     - Fried: Hall entry kind `led`, label "Red LED, 15 Ω on 9 V".
  4. `no-comeback`
     - Prompt: "Put the 1.5 kΩ resistor back. Does the dead LED recover? Then swap in a fresh LED."
     - Goal: dead D1 observed in place with 1.5 kΩ (glow 0 for at least 1 s), then a fresh LED in the loop with
       `isLit`.
     - Success: "Dead LEDs stay dead. The fresh one is happy at a safe current."
- **SIM NEEDS:** N8 (stress bar); dead state must stay with the part when it is moved or re-clipped (bench keeps the
  part id).

#### Explain

1. **Current is the flow**
   > Current is how much charge flows past a point each second, measured in amperes, or amps (A). LED currents are
   > small, so we use milliamps: 1 mA is a thousandth of an amp. Your LED drew about 5 mA with 1.5 kΩ, about 16 mA
   > with 470 Ω, and nearly 50 mA with 150 Ω. Less resistance, more current, more light.
2. **What killed it**
   > An LED turns some of its power into light and the rest into heat, all inside a speck of crystal about the size of
   > a grain of sand. Push too much current through and that speck overheats in a fraction of a second. With 15 Ω,
   > the current jumped to several hundred milliamps, many times the limit. The LED flashed and died.
3. **Reading the limits**
   > Every part comes with a datasheet. Its absolute maximum ratings are lines you must never cross: for our LED, a
   > current of 50 mA. Its typical values describe normal use: 20 mA. Good designs stay well below the maximum, so
   > parts live for years. For a small indicator LED, 5 to 15 mA is plenty bright.

   Widget: `datasheet-viewer` (an original, generic LED datasheet; tap a term to see what it means).
4. **No healing**
   > Damage is permanent. A burned-out LED stays dark even when you give it a safe current again, and a damaged one
   > may glow weakly forever. That's why designers work out the current before they power anything up. In Ohmland,
   > fried parts go to the Hall. In real life, they go in the bin.

#### Quiz

1. `predict-47` (choice, predict) "A red LED runs from 9 V through 470 Ω. Someone swaps in 47 Ω. What happens?"
   - "A bright flash, then the LED dies or is damaged" (correct). Why: the current jumps to roughly 150 mA, about
     three times the LED's 50 mA limit.
   - "Slightly brighter, nothing else". Why: a tenth of the resistance means roughly ten times the current, far too
     much.
   - "It gets dimmer". Why: less resistance means more current, not less.
   - Explain: cutting the resistance by ten raises the current about tenfold. That is well past the limit.
2. `design-current` (choice) "The datasheet says: typical 20 mA, absolute maximum 50 mA. Which current is the best
   design choice for an indicator light?"
   - "15 mA" (correct). Why: bright enough, and comfortably below both the typical and maximum values.
   - "45 mA". Why: technically allowed, but so close to the limit that the LED runs hot and wears out sooner.
   - "50 mA". Why: that is the absolute limit itself, with no safety margin at all.
   - "60 mA". Why: over the absolute maximum. The LED will be damaged.
   - Explain: design around typical values, well under the absolute maximum.
3. `a-to-ma` (numeric) "0.015 A is how many milliamps?" Answer 15, unit mA, tolerance 0%.
   - Explain: multiply by 1,000 to go from amps to milliamps.
4. `dead-reuse` (choice) "An LED burned out on a tiny resistor. You put it back with 1.5 kΩ. What happens?"
   - "It stays dark" (correct). Why: the damage is permanent. A safe current can't repair it.
   - "It glows normally". Why: burned-out LEDs don't recover.
   - "It glows extra bright". Why: a dead LED can't glow at all, let alone brighter.
   - Explain: overheating destroys the LED's crystal. Damage doesn't undo itself.
5. `brightest-survivor` (choice) "On a 9 V battery, which resistor gives the brightest LED that still survives: 1.5 kΩ,
   470 Ω, 150 Ω or 15 Ω?"
   - "150 Ω" (correct). Why: about 47 mA, just under the 50 mA limit. It survives, but with almost no margin.
   - "470 Ω". Why: it survives comfortably, but it's not the brightest. It is the sensible everyday choice.
   - "15 Ω". Why: that one destroys the LED.
   - "1.5 kΩ". Why: the safest, and the dimmest.
   - Explain: 150 Ω is the brightest survivor, but 470 Ω is the wise choice for a light that should last.
6. `abs-max` (choice) "What does absolute maximum mean on a datasheet?"
   - "A limit the part must never exceed, even briefly" (correct). Why: crossing it can damage the part at once or
     shorten its life.
   - "The best value to design for". Why: designs aim for typical values, well below the maximum.
   - "The value printed on the part". Why: parts rarely print their limits. You find them in the datasheet.
   - Explain: absolute maximums are hard limits. Typical values are what you design for.

#### Wrap

- Rules:
  - "Less resistance means more current."
  - "Every part has an absolute maximum. Never cross it."
  - "Design for typical values, well below the limit."
  - "Burned-out parts don't heal."
- Try it for real: parts "red LEDs (have spares)", "resistors: 1.5 kΩ, 470 Ω, 150 Ω, 15 Ω", "a 9 V battery", "clip
  leads"; safety "Burning out an LED on a 9 V battery is safe, but the 15 Ω resistor heats up fast: let it cool before
  touching.", "Keep your face back from any part you are overloading."

#### Mascot

- Start: "Brighter is always better, right? Let's test that."
- Hint: "Less resistance, more current. Keep an eye on that stress bar."
- Fried: "Poor little LED. It gave everything it had. To the Hall."
- Success: "Fresh LED, sensible resistor. Bright and built to last."

---

### L9. `measure-the-flow`: Measuring the flow

- **Summary:** Put the meter in series to measure current, prove it's the same everywhere, and blow a meter fuse once.
- **Minutes:** 13
- **Prerequisites:** `led-burnout`
- **Objectives:** set the meter up for current; connect it in series; show that current is the same at every point
  in a loop; explain why an ammeter across a source blows its fuse; round readings sensibly.
- **Unlocks:** parts `[]`; isle `test-lead-arch`

#### Hook

> So far you've judged current by brightness. Time to measure it. There's a catch: current flows through things, so
> the meter has to become part of the loop. You break the circuit and let the current pass through the meter itself.
> Get it right and you can count the flow anywhere. Get it wrong and the meter's own little fuse pops. Today you'll
> do both.

Visual: `{ kind: part, part: multimeter }`.

Predict (ungraded): "You measure the current just before the LED, then just after it. The second reading is..."
Options: "Lower, because the LED used some up" / "The same" / "Higher".

#### Lab `measure-the-flow`

- **Board:** none.
- **Initial parts:** B1 bench battery; R1 470 Ω; D1 red LED. Wired with three clip leads: L1 B1.pos to R1.a, L2 R1.b
  to D1.anode, L3 D1.cathode to B1.neg. LED lit.
- **Tray:** two spare meter fuses (200 mA), one spare clip lead.
- **Instruments:** meter, leads in COM and VΩ, dial off.
- **Expected:** about 15.7 mA on the 200mA range.
- **Tasks:**
  1. `set-up-amps`
     - Prompt: "Set the meter up for current: red lead into **mA**, dial to DC mA, **200mA** range."
     - Goal: `meter.red == "ma" && meter.mode == "dca-ma" && meter.range == "200mA"`.
     - Hints: (1) "The mA socket is for small currents." (2) "Not sure how big a current is? Start on the biggest mA
       range."
     - Success: "Ready to count milliamps."
  2. `break-and-bridge`
     - Prompt: "Unclip lead L1 from the battery's plus terminal. Then close the gap with the meter: red probe on
       battery plus, black probe on the lead's free clip."
     - Goal: `inSeries(M1, D1) && isLit(D1) && meter.value >= 14 && meter.value <= 17.5`.
     - Hints: (1) "The current has to go through the meter, so the meter fills the gap." (2) "Red toward the battery's
       plus, black toward the resistor."
     - Success: "About 15.7 mA, flowing right through your meter."
  3. `other-side`
     - Prompt: "Restore L1, then measure again on the far side of the LED: between its short leg and battery minus."
     - Goal: `inSeries(M1, D1)` with the meter between D1.cathode and B1.neg, and `|meter.value - task2 value| <= 0.3`.
     - Success: "Same number. The LED doesn't use up current: everything that goes in comes out."
  4. `the-classic`
     - Prompt: "Now the mistake every beginner makes once. Restore the loop. Keep the meter on mA and touch the probes
       straight across the battery."
     - Goal: `event("meter-fuse", "M1")`.
     - Success: "Pop. Nothing limited the current, it shot past 3 A, and the meter's 200 mA fuse blew to save the
       meter."
     - Fried: Hall entry kind `meter-fuse`, label "Meter fuse, 200 mA (amps across a battery)".
  5. `fresh-fuse`
     - Prompt: "Open the meter's back, fit a fresh fuse from the tray, and measure the LED current again, the right
       way."
     - Goal: meter fuse replaced, then `inSeries(M1, D1) && meter.value >= 14 && meter.value <= 17.5`.
     - Success: "Back in business. Current meters go in series, never across."
- **SIM NEEDS:** N1, N9 (meter fuse state, blow event, bench action to replace it).

#### Explain

1. **Through, not across**
   > Current is a flow, so to measure it the flow must pass through the meter. You open the loop and let the meter
   > close the gap. That is called connecting it in series. On mA, the meter's input is almost a plain wire, so it
   > barely changes the circuit. The setup: red lead in mA, dial on mA, loop broken, meter in the gap.

   Widget: `flow-dots` (dots stream around the loop and through the meter; a counter ticks with the reading).
2. **The same all the way round**
   > In a single loop the current is the same at every point. The LED doesn't use up current. It uses up energy:
   > charge enters with a higher voltage and leaves with a lower one, and the difference becomes light and heat.
   > Every bit of charge that enters a part leaves it again. That's why your meter read the same on both sides.
3. **Why the meter has a fuse**
   > On mA, the meter is close to a short circuit. Put it straight across a battery and nothing limits the current
   > except the battery itself, so amps flow. A small fuse inside gives its life to protect the meter. Many low-cost
   > meters leave the 10A input unfused, so that socket deserves extra care.
4. **Amps, milliamps, microamps**
   > 1 A is 1,000 mA, and 1 mA is 1,000 µA. One amp means about 6.24 × 10^18 electrons pass a point every second,
   > a number with nineteen digits. An indicator LED needs a few milliamps. A phone charger supplies an amp or two. A
   > quartz wristwatch ticks along on about a microamp.

#### Quiz

1. `amps-across-led` (choice, spot the mistake) "Jo sets the meter to mA and touches the probes to the two legs of a
   glowing LED. What happens?"
   - "The LED goes out, because the meter becomes a shortcut around it" (correct). Why: on mA the meter is nearly a
     wire, so current bypasses the LED. The resistor still limits the current, so the fuse survives here.
   - "The meter shows the LED's current". Why: to measure current the meter must be in series, not across.
   - "The LED gets brighter". Why: current now flows through the meter instead of the LED.
   - Explain: an ammeter goes in the loop, never across a part.
2. `same-current` (choice, predict) "In a battery, resistor and LED loop you read 12.0 mA between the battery and the
   resistor. What will you read between the LED and battery minus?"
   - "12.0 mA" (correct). Why: in a single loop the current is the same everywhere.
   - "Less than 12.0 mA". Why: the LED doesn't use up current, only energy.
   - "0 mA". Why: current flows all the way around the loop, or not at all.
   - Explain: one loop, one current.
3. `ma-to-amps` (numeric) "Write 15.7 mA in amps." Answer 0.0157, unit A, tolerance 0.5%.
   - Explain: divide by 1,000: move the decimal point three places left.
4. `zero-reading` (choice) "After an accident, your meter reads 0.0 on every mA range, even in a working circuit, but
   it still measures volts perfectly. What's the likely cause?"
   - "The mA fuse has blown" (correct). Why: a blown fuse opens the mA path, so no current can reach the meter's
     measuring circuit.
   - "The meter's battery is flat". Why: then the volts setting wouldn't work either.
   - "The circuit has no current". Why: you said the circuit is working, so current is flowing.
   - Explain: if volts work but mA reads zero everywhere, check the mA fuse.
5. `round-it` (numeric) "Your meter shows 7.46 mA. Round it to one decimal place." Answer 7.5, unit mA, tolerance 0%.
   - Explain: the digit after the first decimal is 6. Five or more rounds up, so 7.46 becomes 7.5.
   - Hint: "Look at the digit you are dropping."
6. `two-amps` (choice) "You expect a current of about 2 A. Which socket should the red lead use?"
   - "10A" (correct). Why: 2 A is ten times what the 200 mA fuse can take.
   - "mA". Why: 2 A would blow the 200 mA fuse instantly.
   - "VΩ". Why: that socket is for volts and ohms. In series it would block almost all the current.
   - Explain: big currents go through the 10A socket, briefly.

#### Wrap

- Rules:
  - "To measure current, break the loop and put the meter in the gap."
  - "Current is the same everywhere in a single loop."
  - "Never put a meter set to amps across a battery."
  - "Check the red lead's socket before every measurement."
- Try it for real: parts "a multimeter with a fused mA input", "a 9 V battery", "a 470 Ω resistor", "a red LED",
  "clip leads"; safety "Don't blow your real meter's fuse on purpose: it is cheap but fiddly to replace.", "Use the
  10A input only for a few seconds at a time. Many meters don't fuse it."

#### Mascot

- Start: "Brightness is a guess. Let's count the current."
- Hint: "Break the loop first. The meter fills the gap."
- Fried: "Pop. Every meter owner does that once. Spare fuse in the tray."
- Success: "Same reading on both sides. Current isn't used up."

---

## 5. Module 4: Voltage and Ohm's law (`voltage-and-ohms-law`)

Summary: Measure the push, watch voltage drops add up, discover V = I × R from your own data, and combine resistors.
Landmark: `observatory`.

---

### L10. `volts-across`: Across, not in

- **Summary:** Measure voltage across each part of a running circuit and find that the drops add up.
- **Minutes:** 11
- **Prerequisites:** `measure-the-flow`
- **Objectives:** measure voltage in parallel on a powered circuit; explain voltage as a difference between two
  points; show that voltage drops around a loop sum to the supply; state typical LED forward voltages by colour.
- **Unlocks:** parts `[led-color]`; isle `jumper-arch`

#### Hook

> Current flows through things. Voltage is different: it's a push measured between two points, like the height
> difference between the top and bottom of a slide. To measure it you don't break anything. You just touch two places
> in a running circuit. Today you'll measure the battery, the resistor and the LED one by one, and spot a pattern
> hiding in the numbers.

Visual: `{ kind: none }`.

Predict (ungraded): "In a battery, resistor and LED loop, you measure across the resistor and across the LED, then add
the two readings. You get..."
Options: "Less than the battery voltage" / "About the battery voltage" / "Twice the battery voltage".

#### Lab `volts-across`

- **Board:** none.
- **Initial parts:** B1 bench battery; R1 470 Ω; D1 red LED; wired as a loop and lit (same as L9).
- **Meter starts in a trap:** red lead in **mA**, dial on DC mA 200mA, as if left from last time.
- **Tray:** one spare meter fuse.
- **Instruments:** meter.
- **Expected:** battery 9.37 V under load; resistor about 7.4 V; LED about 1.95 V.
- **Tasks:**
  1. `reset-meter`
     - Prompt: "The meter is still set up for current. Make it ready for volts: red lead into **VΩ**, dial to DC V,
       **20V** range."
     - Goal: `meter.red == "vohm" && meter.mode == "dcv" && meter.range == "20V"`.
     - Hints: (1) "Check where the red lead is plugged in right now." (2) "VΩ socket first, then the V with a straight
       line."
     - Success: "Good habit. A meter left on amps is the number one way to blow its fuse."
     - Note: if the learner probes anything while still on mA, the meter fuse blows (Hall entry kind `meter-fuse`) and
       the mascot's fried line plays. The spare fuse lets them continue.
  2. `battery-volts`
     - Prompt: "With the LED lit, measure across the battery: red on plus, black on minus."
     - Goal: `across(B1) && meter.value >= 9.0 && meter.value <= 9.6`.
     - Success: "About 9.4 V, measured while the battery is working."
  3. `resistor-volts`
     - Prompt: "Now measure across the resistor: a probe on each end, red on the end nearer battery plus."
     - Goal: `across(R1) && meter.value >= 6.9 && meter.value <= 7.9`.
     - Success: "About 7.4 V. The resistor takes most of the push."
  4. `led-volts`
     - Prompt: "And across the LED: red on the long leg, black on the short leg. Try the 2V range for extra digits."
     - Goal: `across(D1) && meter.value >= 1.80 && meter.value <= 2.10`.
     - Success: "About 1.95 V. That's the LED's forward voltage."
  5. `add-them-up` (notebook)
     - Prompt: "Add your resistor and LED readings and type the total."
     - Goal: `|note("sum") - (logged R1 + logged D1)| <= 0.05 && |note("sum") - logged B1| <= 0.15`.
     - Success: "The two drops add up to the battery voltage. The push is shared out around the loop."
- **Fried moments:** optional meter fuse (see task 1 note).
- **SIM NEEDS:** N1, N2, N9.

#### Explain

1. **Voltage is a difference**
   > Voltage is always measured between two points. It's the difference in electrical push between them, a bit like
   > the height difference between the top and bottom of a slide. Saying "this point is at 5 V" only makes sense
   > compared with somewhere else, usually the battery's minus terminal. That's why the meter needs two probes.

   Widget: `pressure-map` (colours every node of the bench circuit by its voltage relative to battery minus).
2. **Across, not in**
   > To measure voltage, leave the circuit alone and touch the probes to two points, in parallel with what you're
   > measuring. On volts the meter's input is about 10 MΩ, so it borrows almost no current and barely disturbs
   > anything. That's why a voltmeter can go straight across a battery safely, while a meter on amps can't.
3. **The drops add up**
   > Around any loop, the voltage drops add up to the voltage supplied. Your battery gave about 9.4 V, the resistor
   > took about 7.4 V and the LED about 2 V. This is Kirchhoff's voltage law, named after the physicist who stated it
   > in 1845. It makes a handy check: if your drops don't add up, one of your measurements is off.
4. **Every LED has its voltage**
   > An LED barely conducts until the voltage across it reaches its forward voltage, then holds close to that value
   > as the current rises. Red, orange and yellow LEDs sit around 1.8 to 2.2 V. Blue, white and bright green ones
   > need about 2.8 to 3.4 V. The crystal sets the colour of the light, and it sets the forward voltage too.

#### Quiz

1. `resistor-drop` (numeric) "A 9.0 V battery lights a red LED through a resistor. The LED drops 2.0 V. What voltage is
   across the resistor?" Answer 7.0, unit V, tolerance 1%.
   - Explain: the drops add up to the supply, so the resistor gets 9.0 − 2.0 = 7.0 V.
2. `swapped-volts` (numeric, predict) "The meter reads 7.40 V across a resistor. You swap the probes. What will it
   read?" Answer -7.4, unit V, tolerance 1%.
   - Explain: same voltage, opposite sign. The meter reports red compared with black.
3. `volts-in-series` (choice, spot the mistake) "Kai breaks the LED loop and puts the meter, set to DC volts, into the
   gap. What happens?"
   - "The LED goes out and the meter shows most of the battery voltage" (correct). Why: on volts the meter is about
     10 MΩ, so almost no current flows. With no current, nearly all the push appears across the meter.
   - "The meter shows the current". Why: on volts it measures voltage, wherever you put it.
   - "The meter's fuse blows". Why: the volts input has a very high resistance, so only a tiny current flows.
   - Explain: voltmeters go across parts. In series, they block the current.
4. `why-safe` (choice) "Why can a meter on DC volts go straight across a battery, but not a meter on mA?"
   - "On volts it has a very high resistance. On mA it has almost none" (correct). Why: high resistance lets only a
     trickle flow. Almost no resistance lets amps flow.
   - "The volts setting has a stronger fuse". Why: the volts input doesn't rely on a fuse. Its high resistance keeps
     the current tiny.
   - "Batteries can't push current through a voltmeter". Why: they push a tiny current, about 1 µA here, which is
     harmless.
   - Explain: the meter's input resistance decides how much current flows through it.
5. `how-to-measure` (match) "Match each quantity to how you measure it."
   - voltage: probes across two points, circuit running; current: meter in series, loop broken; resistance: part on
     its own, power off.
   - Explain: across for volts, in series for amps, unpowered for ohms.
6. `blue-led` (choice) "You swap the red LED for a blue one in the same circuit. Its forward voltage will be about..."
   - "3 V" (correct). Why: blue LEDs need roughly 2.8 to 3.4 V.
   - "2 V". Why: that is typical for red. Blue needs more.
   - "9 V". Why: the LED takes its forward voltage. The resistor takes the rest.
   - Explain: the LED's colour comes from its crystal, and so does its forward voltage.

#### Wrap

- Rules:
  - "Voltage is measured between two points, with the circuit running."
  - "Voltmeters go across. Ammeters go in series."
  - "Around a loop, the voltage drops add up to the supply."
  - "Red LEDs drop about 2 V. Blue and white drop about 3 V."
- Try it for real: parts "a multimeter", "a 9 V battery", "a 470 Ω resistor", "a red LED", "clip leads"; safety "Before
  measuring volts, check the red lead is in VΩ. Left in mA, it shorts the battery through the meter."

#### Mascot

- Start: "Current goes through. Voltage sits across. Let's measure the push."
- Hint: "Red lead still in mA? Move it before you touch anything."
- Fried: "The leftover-lead trap. Happens to everyone. Spare fuse in the tray."
- Success: "7.4 plus 2.0 makes 9.4. The loop balances its books."

---

### L11. `find-the-law`: Find the law yourself

- **Summary:** Measure the current through four resistors and discover V = I × R from your own data.
- **Minutes:** 14
- **Prerequisites:** `volts-across`
- **Objectives:** collect and tabulate measurements; find V = I × R from data; rearrange it to find I or R; keep units
  consistent (V, A, Ω or V, mA, kΩ); size an LED resistor.
- **Unlocks:** parts `[]`; isle `meter-kiosk`

#### Hook

> You have a meter, a battery and a handful of resistors. Researchers in the 1820s had far cruder tools than yours,
> and still found one of the most useful rules in all of electronics. You're going to find it again, from your own
> measurements. Measure, write it down, look for the pattern. No formula until you've earned it.

Visual: `{ kind: none }`.

Predict (ungraded): "Same battery, but you double the resistance in the loop. The current..."
Options: "doubles" / "halves" / "stays the same".

#### Lab `find-the-law`

- **Board:** none.
- **Initial parts:** B1 bench battery; an empty resistor holder (two clips, H.a and H.b) with H.b wired to B1.neg.
- **Tray:** resistors 1 kΩ (actual 1.01 kΩ), 1.5 kΩ (1.49 kΩ), 2.2 kΩ (2.21 kΩ), 3.3 kΩ (3.28 kΩ); a 4.7 kΩ (4.68 kΩ)
  appears for task 4; two clip leads.
- **Instruments:** meter, leads in COM and VΩ, dial off. Lab notebook with a four-row table: R (kΩ), I (mA) filled
  automatically from stable readings, and an empty "I × R" column for the learner.
- **Expected (20mA range, about 10 Ω burden):** 9.20 mA, 6.26 mA, 4.23 mA, 2.86 mA; 4.7 kΩ about 2.0 mA.
- **Tasks:**
  1. `battery-first`
     - Prompt: "Start by measuring the battery on DC volts. The notebook logs it."
     - Goal: `across(B1) && logged("battery") && meter.value >= 9.0 && meter.value <= 9.6`.
     - Success: "Battery voltage logged. Keep that number in mind."
  2. `fill-the-table`
     - Prompt: "Switch to current (red lead in **mA**, **20mA** range) and put the meter in series: battery plus to
       red probe, black probe to the holder. Then clip in each resistor in turn: 1 kΩ, 1.5 kΩ, 2.2 kΩ, 3.3 kΩ."
     - Goal: four logged series current readings, one per resistor.
     - Hints: (1) "One loop: battery plus, meter, holder, back to minus." (2) "Reading zero? Check the red lead is in
       mA." (3) "Swap resistors by dragging a new one onto the holder."
     - Success: "Four rows of real data. Now look closely."
  3. `spot-the-pattern` (notebook)
     - Prompt: "For each row, multiply the current in mA by the resistance in kΩ. Type the four answers."
     - Goal: each `note` within 2% of logged I × nominal R.
     - Hints: (1) "First row: about 9.2 × 1." (2) "Compare your answers with the battery voltage."
     - Success: "All four land close to your battery voltage. That's not a coincidence. That's a law."
  4. `predict-and-test` (notebook)
     - Prompt: "Here's a 4.7 kΩ resistor. Predict its current first, then clip it in and measure."
     - Goal: `note("prediction")` within 10% of logged battery voltage ÷ 4.7, then a measured reading within 5% of the
       prediction.
     - Hints: (1) "Volts divided by kilohms gives milliamps."
     - Success: "Predicted, then confirmed. That's what a law of physics is for."
- **Fried moments:** none (if the learner probes the battery on mA by mistake, N9 applies as usual).
- **SIM NEEDS:** N1, N2, N6.

#### Explain

1. **The pattern: V = I × R**
   > Your products all came out close to the battery voltage. That's Ohm's law: the voltage across a resistance
   > equals the current through it times the resistance. V = I × R. Georg Ohm published it in 1827 after years of
   > patient experiments. It works for resistors and wires at any scale, from a pencil line to a power cable.

   Widget: `ohms-law` (set any two of V, I and R with sliders, see the third; a "from my data" button plots the
   learner's four rows).
2. **Three ways to use it**
   > The same rule rearranges three ways: V = I × R, I = V ÷ R, and R = V ÷ I. Want the current through 2.2 kΩ on
   > 9 V? I = 9 ÷ 2,200 ≈ 0.0041 A, about 4.1 mA. Need a resistor that passes 15 mA with 7 V across it?
   > R = 7 ÷ 0.015 ≈ 467 Ω. In formulas, current is written I, from the French word for intensity.
3. **The milliamp shortcut**
   > Mixing units is the classic Ohm's law trap. 9 ÷ 470 is 0.019, but is that amps or milliamps? Stick to one
   > matched set. Volts, amps and ohms work together. So do volts, milliamps and kilohms: 2 mA × 4.7 kΩ = 9.4 V.
   > Mix milliamps with plain ohms and your answer is off by a factor of a thousand.
4. **Why not exactly 9.4?**
   > Your products weren't perfect, and that's fine. Each resistor is only within 5% of its label. On current ranges
   > the meter adds a little resistance of its own, about 10 Ω on 20 mA. Even the battery has a small resistance
   > inside it, which you'll meet in module 5. Small gaps between theory and measurement are normal. Big ones mean
   > something is wrong.

#### Quiz

1. `current-calc` (numeric) "12 V across 2.4 kΩ. What current flows?" Answer 5, unit mA, tolerance 1%.
   - Explain: I = V ÷ R = 12 ÷ 2.4 kΩ = 5 mA (volts divided by kilohms gives milliamps).
2. `resistance-calc` (numeric) "5 V pushes 25 mA through a resistor. What is its resistance?" Answer 200, unit Ω,
   tolerance 1%.
   - Explain: R = V ÷ I = 5 ÷ 0.025 = 200 Ω.
   - Hint: "Convert 25 mA to amps first."
3. `led-resistor` (numeric) "A red LED drops 2.0 V. You want 15 mA from a 9 V battery. What resistance do you need?"
   Answer 467, unit Ω, tolerance 2%.
   - Explain: the resistor gets 9 − 2 = 7 V, so R = 7 ÷ 0.015 ≈ 467 Ω.
   - Hint: "First work out how much voltage is left for the resistor."
4. `nearest-value` (choice) "Your calculation says 467 Ω. Which resistor do you actually use?"
   - "470 Ω" (correct). Why: it's the nearest standard value, and it gives just under 15 mA.
   - "460 Ω". Why: not a value you'll find in a typical kit. Use the nearest standard value.
   - "4.7 kΩ". Why: ten times too big. The LED would only get about 1.5 mA.
   - Explain: round to the nearest standard value. Slightly higher is the safe direction for an LED.
5. `double-r` (choice, predict) "Same battery. You swap a 1 kΩ resistor for a 2 kΩ one. The current..."
   - "halves" (correct). Why: I = V ÷ R, so doubling R halves I.
   - "doubles". Why: more resistance means less current, not more.
   - "stays the same". Why: the battery voltage is the same, but the resistance changed.
   - Explain: with a fixed voltage, current and resistance move in opposite directions.
6. `unit-slip` (choice, spot the mistake) "Max calculates 9 V ÷ 470 Ω and writes 0.019 mA. What went wrong?"
   - "It should be 0.019 A, which is 19 mA" (correct). Why: volts divided by ohms gives amps.
   - "It should be 4,230 mA". Why: that multiplies instead of dividing.
   - "Nothing, it's right". Why: 0.019 mA is a thousand times too small.
   - Explain: volts ÷ ohms = amps. Volts ÷ kilohms = milliamps.

#### Wrap

- Rules:
  - "V = I × R. Also I = V ÷ R and R = V ÷ I."
  - "Use volts, amps and ohms, or volts, milliamps and kilohms. Never mix the sets."
  - "LED resistor = (supply voltage − LED voltage) ÷ current."
  - "Measurements land close to theory, never exactly on it."
- Try it for real: parts "a multimeter", "a 9 V battery", "resistors: 1 kΩ, 1.5 kΩ, 2.2 kΩ, 3.3 kΩ, 4.7 kΩ", "clip
  leads", "a notebook"; safety "Every current in this experiment is under 10 mA. Completely safe."

#### Mascot

- Start: "Measure first, formula later. Let's find a law."
- Hint: "Multiply mA by kΩ. What number keeps turning up?"
- Success: "You just rediscovered Ohm's law. With your own data!"

---

### L12. `series-and-parallel`: End to end, side by side

- **Summary:** Combine resistors in series and in parallel, predict the totals, and measure the currents.
- **Minutes:** 13
- **Prerequisites:** `find-the-law`
- **Objectives:** calculate series and parallel resistance; explain why parallel totals are smaller than the smallest
  branch; predict how adding a parallel branch changes current; recognise a short circuit as a near-zero parallel path.
- **Unlocks:** parts `[]`; isle `resistor`

#### Hook

> Two resistors can team up in two ways. End to end, current has to squeeze through both, one after the other. Side
> by side, current gets a choice of paths. One arrangement makes the total resistance bigger, the other makes it
> smaller. The robot bets you can't predict how much smaller. Grab two 1 kΩ resistors and prove it wrong.

Visual: `{ kind: part, part: resistor }`.

Predict (ungraded): "Two 1 kΩ resistors side by side, with both pairs of ends joined. Total resistance?"
Options: "2 kΩ" / "1 kΩ" / "500 Ω".

#### Lab `series-and-parallel`

- **Board:** none.
- **Initial parts (loose):** B1 bench battery; R1 1 kΩ (actual 1.00 kΩ); R2 1 kΩ (actual 0.99 kΩ); R3 3.3 kΩ (actual
  3.30 kΩ).
- **Tray:** five clip leads.
- **Instruments:** meter, leads in COM and VΩ, dial on Ω 20k.
- **Tasks:**
  1. `series-ohms`
     - Prompt: "Clip R1 and R2 end to end. Measure from one free end to the other."
     - Goal: R1 and R2 share exactly one node, probes on the two free ends, reading 1.90 to 2.10 kΩ.
     - Success: "About 2 kΩ. End to end, resistances add."
  2. `parallel-ohms`
     - Prompt: "Now put them side by side: join the two left ends together, and the two right ends together. Measure
       across the pair."
     - Goal: R1 and R2 in parallel, probes across the pair, reading 0.47 to 0.53 kΩ.
     - Hints: (1) "Two clip leads: one joins the left ends, one joins the right ends." (2) "Try the 2k range for more
       digits."
     - Success: "About 500 Ω. Two equal paths, half the resistance."
  3. `predict-mixed` (notebook)
     - Prompt: "Swap R2 for the 3.3 kΩ resistor, still side by side with R1. Predict the total first, then measure."
     - Goal: `note("prediction")` within 5% of 767 Ω, then measured R1 ∥ R3 between 730 Ω and 800 Ω.
     - Hints: (1) "Product over sum: (1 × 3.3) ÷ (1 + 3.3), in kilohms." (2) "It must be less than 1 kΩ."
     - Success: "About 767 Ω, less than either resistor alone."
  4. `four-times`
     - Prompt: "Put R1 and R2 back. Measure the battery current with the pair in series, then with the pair in
       parallel. Use the 20mA range."
     - Goal: logged series current 4.3 to 5.0 mA and logged parallel current 17.0 to 19.5 mA.
     - Success: "About 4.7 mA, then about 18.4 mA: roughly four times as much. Half the resistance in each step, twice
       over."
- **Fried moments:** none.
- **SIM NEEDS:** N1, N2.

#### Explain

1. **End to end: add them**
   > In series, current passes through one resistor and then the next, so their resistances simply add:
   > R = R1 + R2. Two 1 kΩ resistors make 2 kΩ, three make 3 kΩ. On 9 V, two 1 kΩ in series pass 4.5 mA, and each
   > one takes half the voltage: 4.5 V apiece.

   Widget: `series-parallel` (flip two resistors between series and parallel, see total R, battery current and
   branch currents update).
2. **Side by side: more paths**
   > In parallel, current splits between the paths and joins up again, so the pair conducts more easily than either
   > one alone. For two resistors, the total is (R1 × R2) ÷ (R1 + R2): product over sum. Two equal resistors give
   > exactly half. For any number of branches, add the reciprocals: 1/R = 1/R1 + 1/R2 + 1/R3 and so on.
3. **The smallest wins**
   > A parallel group always has less resistance than its smallest member. Put 100 Ω beside 1 MΩ and you get just
   > under 100 Ω, because nearly all the current takes the easy path. That's why a short circuit is so dramatic: a
   > wire across a part is a parallel path of almost zero ohms, and it steals nearly all the current.
4. **Shared voltage, shared current**
   > Every branch of a parallel group has the same voltage across it, because their ends are joined. Each branch then
   > takes its own current by Ohm's law, and the branch currents add up. Series is the mirror image: one current
   > through everything, with the voltage shared out. Most real circuits mix both.

#### Quiz

1. `series-total` (numeric) "1 kΩ and 3.3 kΩ in series. Total resistance?" Answer 4.3, unit kΩ, tolerance 1%.
   - Explain: in series, just add: 1 + 3.3 = 4.3 kΩ.
2. `parallel-total` (numeric) "1 kΩ and 3.3 kΩ in parallel. Total resistance?" Answer 767, unit Ω, tolerance 2%.
   - Explain: product over sum: (1,000 × 3,300) ÷ 4,300 ≈ 767 Ω.
   - Hint: "Multiply them, then divide by their sum."
3. `tiny-and-huge` (choice) "100 Ω in parallel with 1 MΩ. The total is about..."
   - "Just under 100 Ω" (correct). Why: the total is always below the smallest branch, and the 1 MΩ path carries
     almost nothing.
   - "About 1 MΩ". Why: adding a parallel path can only lower the total.
   - "About 500 kΩ". Why: parallel resistance isn't an average.
   - Explain: in parallel, the smallest resistance dominates.
4. `add-a-branch` (choice, predict) "A 1 kΩ resistor across 9 V draws 9 mA. You add a second 1 kΩ in parallel. What
   current does the battery supply now?"
   - "18 mA" (correct). Why: each branch has the full 9 V and takes 9 mA, and the currents add.
   - "4.5 mA". Why: that would be the two resistors in series.
   - "9 mA". Why: the new branch adds its own current on top.
   - Explain: parallel branches each draw their own current from the same voltage.
5. `sams-claim` (choice, spot the mistake) "Sam says two 1 kΩ resistors in parallel make 2 kΩ. What do you tell Sam?"
   - "That's the series total. In parallel they make 500 Ω" (correct). Why: two equal parallel resistors give half.
   - "Sam is right". Why: adding resistances is the series rule.
   - "In parallel they make 1 kΩ". Why: a second path lowers the total below either resistor.
   - Explain: series adds. Parallel gives less than the smallest.
6. `three-equal` (numeric) "Three 3.3 kΩ resistors in parallel. Total resistance?" Answer 1.1, unit kΩ, tolerance 2%.
   - Explain: N equal resistors in parallel give the value divided by N: 3.3 ÷ 3 = 1.1 kΩ.

#### Wrap

- Rules:
  - "Series: resistances add."
  - "Parallel: the total is less than the smallest branch."
  - "Two equal resistors in parallel make half."
  - "Parallel branches share a voltage. Series parts share a current."
- Try it for real: parts "two 1 kΩ resistors", "a 3.3 kΩ resistor", "a multimeter", "a 9 V battery", "clip leads";
  safety "Safe at these values: the biggest current is under 20 mA."

#### Mascot

- Start: "Two resistors, two ways to team up. Place your bets."
- Hint: "Side by side? The total is smaller than the smaller one."
- Success: "Half! You called it. More paths, less resistance."

---

## 6. Module 5: Power and heat (`power-and-heat`)

Summary: Watts and heat, power ratings, fuses that fail on purpose, and the resistance hiding inside every battery.
Landmark: `power-station`.

---

### L13. `watts-and-heat`: Watts and warm resistors

- **Summary:** Calculate power with P = V × I, overheat a resistor on purpose, and choose a rating that survives.
- **Minutes:** 12
- **Prerequisites:** `series-and-parallel`
- **Objectives:** calculate electrical power from voltage and current; use P = I² × R and P = V² ÷ R; explain power
  ratings and choose one with margin; tell temperature, heat and power apart.
- **Unlocks:** parts `[resistor-power]`; isle `heatsink`

#### Hook

> Every part that carries current turns some energy into heat. In your LED circuits that heat was far too small to
> notice. Connect a small resistor straight across a battery, though, and things change fast. Today you'll measure how
> much power a part is handling, watch one overheat, and learn to pick parts that keep their cool.

Visual: `{ kind: part, part: resistor-power }`.

Predict (ungraded): "You clip a small 15 Ω resistor straight across the 9 V battery. What happens to it?"
Options: "It stays cool" / "It gets slightly warm" / "It gets hot enough to smoke".

#### Lab `watts-and-heat`

- **Board:** none.
- **Initial parts:** B1 bench battery (sag model, N10); a load holder: two clips joined to B1.pos and B1.neg by clip
  leads (0.15 Ω each, N3).
- **Tray:** R1 1 kΩ 0.25 W; R2 and R3 15 Ω 0.25 W; R4 15 Ω 1 W; R5 15 Ω 5 W (ceramic power resistor).
- **Instruments:** meter (leads in COM and VΩ, DC V 20V); heat view (N8: each resistor shows its temperature in °C
  and a touch-feel label: cool below 35 °C, warm to 50 °C, hot to 70 °C, "ouch" above).
- **Expected:** 1 kΩ: 9.4 V, 9.4 mA, about 88 mW, settles near 45 °C. 15 Ω: about 0.55 A and 4.5 W. The 1/4 W part
  smokes within about 3 s and burns open within about 10 s. The 1 W part smokes within about 10 s. The 5 W part runs
  very hot (well over 100 °C) and survives.
- **Tasks:**
  1. `cool-one` (notebook)
     - Prompt: "Clip the 1 kΩ resistor into the holder and measure the voltage across it. Power is voltage times
       current: P = V × I, where I = V ÷ R. Type the power in milliwatts."
     - Goal: R1 in holder, `logged("R1")`, `note("mW")` between 80 and 95.
     - Hints: (1) "I = 9.4 V ÷ 1,000 Ω ≈ 0.0094 A." (2) "P = 9.4 × 0.0094 ≈ 0.088 W. How many mW is that?"
     - Success: "About 88 mW. Barely warm. A 1/4 W resistor can handle 250 mW."
  2. `cook-one`
     - Prompt: "Swap in a 15 Ω, 1/4 W resistor and watch it closely."
     - Goal: `fried("resistor")` with R2 or R3.
     - Success: "Smoke, then a scorched break. That little resistor was taking about 18 times its rating."
     - Fried: Hall entry kind `resistor`, label "15 Ω, 1/4 W resistor across 9 V".
  3. `power-it` (notebook)
     - Prompt: "Now clip in the big 15 Ω, **5 W** resistor. Measure the voltage across it and type its power in watts."
     - Goal: R5 in holder and alive, `logged("R5")`, `note("W")` within 10% of (logged V)² ÷ 15.
     - Hints: (1) "P = V² ÷ R works when you know voltage and resistance." (2) "About 8.3 × 8.3 ÷ 15."
     - Success: "Around 4.5 W, all of it turning into heat."
  4. `survive-ten`
     - Prompt: "Leave it there for 10 seconds. Does the 5 W resistor survive?"
     - Goal: `heldFor(10, R5 in holder && part(R5).health != "dead")`.
     - Success: "Hot enough to burn a finger, but alive. 4.5 W is within its 5 W rating, and its big body sheds the heat."
     - Notice: the battery's voltage has crept down while it works hard. Module 5's last lesson explains why.
  5. `one-watt-too` (bonus)
     - Prompt: "Curious about the 1 W version? Give it a go."
     - Goal: `event("smoke", "R4")`.
     - Success: "Better than the 1/4 W one, but still smoking. 4.5 W is too much for a 1 W rating."
     - Fried (if it burns open): Hall entry kind `resistor`, label "15 Ω, 1 W resistor across 9 V".
- **SIM NEEDS:** N1, N2, N3, N8 (temperature and touch-feel labels), N10. Resistor thermal model: about 250 °C/W for
  1/4 W, about 100 °C/W for 1 W, about 25 °C/W for the 5 W ceramic; smoke above about 4 times the rating sustained,
  burn open far beyond it.

#### Explain

1. **Power: how fast energy moves**
   > Power is the rate at which energy is delivered or turned into something else, such as light or heat. It's
   > measured in watts (W), and one watt means one joule of energy every second. A small indicator LED uses about
   > 0.04 W. A phone charger might deliver 20 W. A kettle uses around 2,000 W, which is 2 kW.
2. **P = V × I**
   > Electrical power is voltage times current: P = V × I. Your 1 kΩ resistor had 9.4 V across it and 9.4 mA
   > through it: 9.4 × 0.0094 ≈ 0.088 W, or 88 mW. Combine it with Ohm's law and you get two shortcuts: P = I² × R
   > and P = V² ÷ R. Use whichever fits the two values you know.

   Widget: `power-bar` (tap any part on the bench to see V, I and P, with P drawn as a bar against its rating).
3. **Power ratings**
   > Every resistor has a power rating: the most power it can turn into heat without damage. Small everyday
   > resistors are usually 1/4 W. Bigger bodies spread heat over more surface, so they're rated higher: 1 W, 5 W and
   > beyond. A good habit is to choose a rating at least double the power you expect, so the part runs cooler and
   > lasts longer.
4. **Temperature, heat, power**
   > These three get mixed up all the time. Temperature is how hot something is, in degrees. Heat is energy flowing
   > from hotter things to cooler ones, in joules. Power is how fast energy flows, in watts. A tiny part can get very
   > hot from very little power, because there is so little of it to warm up.

#### Quiz

1. `skin-power` (numeric) "9 V across 45 kΩ of damp skin. How much power is that?" Answer 1.8, unit mW, tolerance 2%.
   - Explain: I = 9 ÷ 45,000 = 0.2 mA, so P = 9 × 0.0002 = 0.0018 W = 1.8 mW. Far too little to warm anything. What
     you'd feel is nerves reacting to the current, not heat.
2. `at-the-limit` (choice) "5 V across a 100 Ω resistor. Is a 1/4 W resistor a good choice?"
   - "No, it would run right at its limit" (correct). Why: I = 50 mA and P = 5 × 0.05 = 0.25 W, exactly the rating,
     with no margin.
   - "Yes, there's plenty of margin". Why: 0.25 W is the full rating, so there is no margin at all.
   - "No, it needs a 5 W resistor". Why: a 1/2 W part already gives double margin. 5 W is overkill.
   - Explain: calculate the power, then pick a rating about twice as big.
3. `which-hotter` (choice, predict) "Same 9 V battery. Which gets hotter across it: a 1 kΩ resistor or a 15 Ω resistor?"
   - "The 15 Ω resistor" (correct). Why: with the same voltage, P = V² ÷ R, so less resistance means more current and
     more power.
   - "The 1 kΩ resistor, because more resistance makes more heat". Why: that's only true when the current is the same.
     Here the voltage is fixed.
   - "They get equally hot". Why: their currents differ by a factor of about 67.
   - Explain: across a fixed voltage, the smaller resistor draws more current and makes more heat.
4. `joules` (choice) "Which of these is measured in joules?"
   - "Heat" (correct). Why: heat is energy, and energy is measured in joules.
   - "Temperature". Why: temperature is measured in degrees.
   - "Power". Why: power is energy per second, measured in watts.
   - Explain: joules for energy, watts for joules per second, degrees for temperature.
5. `w-to-mw` (numeric) "Write 0.0035 W in milliwatts." Answer 3.5, unit mW, tolerance 0%.
   - Explain: multiply by 1,000: 0.0035 W is 3.5 mW.
6. `pick-rating` (choice) "A resistor will turn 0.6 W into heat. Which power rating do you choose?"
   - "2 W" (correct). Why: at least double the expected power gives a cool, long-lived part.
   - "1 W". Why: it would survive, but run hot with little margin.
   - "1/4 W". Why: less than half the power it must handle. It would cook.
   - Explain: work out the power, then pick a rating at least twice as high.

#### Wrap

- Rules:
  - "P = V × I. Also P = I² × R and P = V² ÷ R."
  - "Pick a power rating at least double the power you expect."
  - "Everyday small resistors are rated 1/4 W."
  - "Across the same battery, a smaller resistance makes more heat."
- Try it for real: parts "a 9 V battery", "a 1 kΩ resistor", "a 15 Ω, 1/4 W resistor", "clip leads"; safety "A 15 Ω
  resistor across a 9 V battery gets hot enough to burn within seconds. Connect it only briefly and don't touch it
  until it cools.", "Do this only with a small alkaline battery, never with lithium packs or car batteries."

#### Mascot

- Start: "Everything that carries current gets a little warm. Let's push that."
- Hint: "Power is volts times amps. Got both numbers?"
- Fried: "Smells like learning. That one's going in the Hall."
- Success: "Rated for five watts, handling four and a half. Cutting it close!"

---

### L14. `fuse-guard`: The part that fails first

- **Summary:** Blow a fuse on purpose, test fuses with continuity, and use two fuses to bracket a big current.
- **Minutes:** 12
- **Prerequisites:** `watts-and-heat`
- **Objectives:** explain what a fuse does and why ratings are approximate; test a fuse with continuity; measure a
  large current safely on the 10 A input; reason about a current from which fuses blow.
- **Unlocks:** parts `[fuse]`; isle `fuse`

#### Hook

> Some parts are designed to fail. A fuse is a thin strip of metal sealed in a little glass tube. When too much
> current flows, the strip melts and breaks the circuit before anything more precious gets hurt. Today you'll
> sacrifice one on purpose, then use two fuses and your meter to work out how much current a small battery can really
> push.

Visual: `{ kind: part, part: fuse }`.

Predict (ungraded): "A 1 A fuse is clipped straight across a 9 V battery. What happens?"
Options: "Nothing" / "The fuse blows" / "The battery bursts".

#### Lab `fuse-guard`

- **Board:** none.
- **Initial parts:** B1 bench battery (sag model, N10). F1 `fuse` 1 A (glass, end caps marked 1A, a green dot). F2 `fuse`
  3 A (marked 3A, a red dot). Both loose.
- **Tray:** three clip leads (0.15 Ω each, N3).
- **Instruments:** meter, leads in COM and VΩ, dial off.
- **Expected:** F1 across the battery sees several amps and blows within about 0.3 s. With F2, the 10A input (about
  0.05 Ω) and two leads in the loop, the current starts above 3 A and settles at about 1.6 to 2.4 A within 2 s as the
  battery sags. F2 survives several seconds at that level.
- **Tasks:**
  1. `blow-1a`
     - Prompt: "Clip the 1 A fuse straight across the battery with two clip leads. Watch the thin wire inside."
     - Goal: `event("blown", "F1")`.
     - Success: "Snap. The wire melted and left a gap. The fuse gave its life in a fraction of a second."
     - Fried: Hall entry kind `fuse`, label "1 A fuse across a 9 V battery".
  2. `continuity-check`
     - Prompt: "Set the dial to continuity (the sound-wave symbol). Test the blown fuse, then the 3 A fuse."
     - Goal: `meter.mode == "continuity"`, `across(F1)` showing `OL` with no beep, and `across(F2)` with a beep.
     - Hints: (1) "Touch a probe to each metal end cap."
     - Success: "Silence from the blown one, a beep from the good one. That's how you test a fuse in two seconds."
  3. `measure-big`
     - Prompt: "Measure the current through the 3 A fuse. Red lead into **10A**, dial to **10A**. Make one loop:
       battery, 3 A fuse, meter, back to battery. Hold it for 3 seconds, then break the loop."
     - Goal: `meter.red == "a10" && meter.mode == "dca-10a" && inSeries(M1, F2) && heldFor(3, part(F2).health !=
       "dead" && |part(F2).i| > 1)`, with a logged reading between 1.4 and 2.6 A.
     - Hints: (1) "Big currents use the 10A socket, never mA." (2) "Keep it short. The 10A input isn't built for long
       runs."
     - Success: "About 2 A. Too much for the 1 A fuse, within the 3 A fuse's rating. Two fuses bracketed the current."
  4. `battery-check` (bonus)
     - Prompt: "Back to DC volts. Measure the battery now, then again after 30 seconds."
     - Goal: two logged readings across B1, both below the starting value, the second at least 0.05 V higher.
     - Success: "It dipped, then crept back up, but not all the way. Heavy current tires a battery. Next lesson shows
       why."
- **Fried moments:** F1 (required). If the learner leaves the 10A input loaded for more than 10 s, the meter shows a
  heat warning (N9); no damage in normal mode.
- **SIM NEEDS:** N1, N3, N9 (10A input heating and warning), N10 (battery sag and recovery). Fuse model: fast-acting
  I²t curve, rated current carried indefinitely, about 1 to 5 s at 2 times rating, under 0.3 s at 4 times, ±10%
  random spread per fuse; cold resistance about 0.1 Ω (1 A) and 0.03 Ω (3 A).

#### Explain

1. **A weak link on purpose**
   > A fuse is a deliberately weak spot: a thin strip of metal that melts when the current is too high for too long.
   > Once it melts, the loop is broken and all current stops. That protects the wiring, the battery and every other
   > part. A blown fuse can't be repaired, only replaced, and always with one of the same rating.
2. **Ratings are rough**
   > A fuse's rating is the current it can carry indefinitely, not the current that blows it instantly. A fast fuse at
   > twice its rating may take a second or more to open. At several times its rating it's gone in a blink. So fuses
   > bracket a current roughly, and the time matters as much as the size.

   Widget: `fuse-curve` (drag a current slider, see the time to blow for 1 A and 3 A fuses on a log scale).
3. **Where fuses go**
   > Fuses have no polarity: the wire melts whichever way the current flows. Where they sit matters more. Put a fuse
   > close to the power source so it protects everything after it. And never swap in a higher rating or a bit of wire.
   > The fuse would survive the next fault, and something more expensive would burn instead.
4. **The big-current socket**
   > Currents above a couple of hundred milliamps go through the meter's 10A socket. Inside, a thick, very low
   > resistance path carries the current. On many meters that input has no fuse, and it's meant for short
   > measurements: about 10 seconds, then a rest. Treat it like a stopwatch reading: connect, read, disconnect.

#### Quiz

1. `bracket` (choice) "In a circuit, a 1 A fuse blows quickly but a 3 A fuse survives. What can you say about the
   current?"
   - "More than about 1 A, and probably less than about 3 A" (correct). Why: the 1 A fuse proves it's over 1 A, and
     the survivor suggests it's under 3 A. Fuse ratings are approximate, so "about".
   - "Exactly 2 A". Why: fuses only bracket a range. A meter gives the exact value.
   - "More than 3 A". Why: then the 3 A fuse would most likely have blown too.
   - Explain: two fuses give a rough range. A meter on 10A pins it down.
2. `limit-myth` (choice) "Does a 1 A fuse limit the current to 1 A?"
   - "No. It lets any current through until it melts, then stops it all" (correct). Why: a fuse is either a wire or a
     gap. It never holds current at a value.
   - "Yes, it holds the current at 1 A". Why: nothing in a fuse controls current. It just melts.
   - "Only in DC circuits". Why: fuses work the same way in AC and DC.
   - Explain: a fuse is an on-or-off safety switch, not a current limiter.
3. `fuse-polarity` (choice) "Does it matter which way round a fuse goes?"
   - "No" (correct). Why: heat melts the wire whichever way the current flows.
   - "Yes, the marked end goes to plus". Why: the marking is just the rating.
   - "Only for big fuses". Why: no fuse has polarity.
   - Explain: fuses, like resistors, work either way round.
4. `bigger-fuse` (choice, spot the mistake) "A gadget's 1 A fuse keeps blowing. Ravi fits a 10 A fuse instead. Good
   idea?"
   - "No: something is drawing too much current, and now nothing will stop it" (correct). Why: the fuse was doing its
     job. The real fault is still there.
   - "Yes, problem solved". Why: the fault remains and can now overheat wires or parts.
   - "Yes, if the voltage rating matches". Why: the current rating is what protects the circuit.
   - Explain: a fuse that keeps blowing is a symptom. Find the fault, and replace like with like.
5. `ideal-amps` (numeric) "A 9 V battery with 1.5 Ω of internal resistance drives a fuse, meter and leads that add up
   to 1.5 Ω. What's the ideal current?" Answer 3, unit A, tolerance 1%.
   - Explain: total resistance is 3 Ω, so I = 9 ÷ 3 = 3 A. A real battery delivers less, because its voltage sags.
6. `big-current-steps` (order) "Put these steps for measuring a large current in order."
   - Correct order: move the red lead to 10A; turn the dial to 10A; break the loop and connect the meter in series;
     read the value quickly; disconnect and move the red lead back to VΩ.
   - Explain: set the meter up before connecting, keep the measurement short, and leave the meter ready for volts.

#### Wrap

- Rules:
  - "A fuse is a weak link on purpose: it melts to save everything else."
  - "Replace a fuse only with the same rating."
  - "Fuses have no polarity."
  - "Use the 10A socket for big currents, and only briefly."
- Try it for real: parts "a 9 V battery", "fast-blow glass fuses rated 1 A and 3 A (5 × 20 mm)", "clip leads", "a
  multimeter with a 10A input"; safety "Fuses and leads get hot: let them cool before touching.", "Keep connections to a
  few seconds. Never try this with a car battery or a lithium pack: they can push enough current to melt wires and
  start fires."

#### Mascot

- Start: "Meet the bravest part on the bench. It's built to fail."
- Hint: "Big current? Red lead to 10A, and keep it quick."
- Fried: "The fuse gave its life, exactly as designed. A hero of the Hall."
- Success: "Between one and three amps. Bracketed like a detective."

---

### L15. `inside-the-battery`: The battery's hidden resistor

- **Summary:** Catch a battery's internal resistance by measuring its voltage at rest and under load.
- **Minutes:** 11
- **Prerequisites:** `fuse-guard`
- **Objectives:** model a battery as an ideal source plus internal resistance; calculate internal resistance from two
  readings; explain voltage sag and why short-circuit current is limited; test batteries under load.
- **Unlocks:** parts `[]`; isle `battery`

#### Hook

> On paper, a 9 V battery across a fraction of an ohm should push well over 10 A. In the last lesson, yours managed
> about 2 A. Something inside the battery was holding the current back. Every real battery hides a resistance in its
> chemistry. You can't measure it with the ohms setting, but you can catch it in the act with a voltmeter and a load.

Visual: `{ kind: part, part: battery-9v }`.

Predict (ungraded): "You measure a battery with nothing connected, then again while it powers a heavy load. The second
reading is..."
Options: "Exactly the same" / "Lower" / "Higher".

#### Lab `inside-the-battery`

- **Board:** none.
- **Initial parts:** B1 bench battery (emf 9.4, internalOhms 1.7, sag model N10). S1 `switch` (open). R1 15 Ω 5 W.
  Loop: B1.pos to S1.a, S1.b to R1.a, R1.b to B1.neg (clip leads 0.15 Ω each). B2 `battery` emf 8.6, internalOhms 8 (an
  old, scuffed battery on a shelf; swapping it in moves the same clip leads).
- **Instruments:** meter on DC V 20V, probes clipped to the battery terminals with hook grabbers (they follow the
  battery when it's swapped).
- **Expected:** B1 open 9.40 V; loaded about 8.45 V (0.55 A); r about 1.7 Ω. B2 open 8.60 V; loaded about 5.7 V; r
  about 8 Ω.
- **Tasks:**
  1. `open-voltage`
     - Prompt: "With the switch off, read the battery voltage."
     - Goal: `part(S1).closed == false && across(B1) && logged("open") && meter.value >= 9.3 && meter.value <= 9.5`.
     - Success: "About 9.4 V with nothing to power. That's the battery's full push."
  2. `loaded-voltage`
     - Prompt: "Switch on the 15 Ω load and read the battery again straight away."
     - Goal: `part(S1).closed && logged("loaded")` within 2 s of closing, reading 8.2 to 8.7 V and at least 0.5 V below
       the open reading.
     - Success: "Down by almost a volt, just from doing work. Some of the push is being spent inside the battery."
  3. `find-r` (notebook)
     - Prompt: "Work out the internal resistance. Current first: I = loaded voltage ÷ 15 Ω. Then r = (open voltage −
       loaded voltage) ÷ I."
     - Goal: `note("r")` between 1.0 and 3.0 Ω.
     - Hints: (1) "8.45 ÷ 15 ≈ 0.56 A." (2) "(9.40 − 8.45) ÷ 0.56 ≈ 1.7 Ω."
     - Success: "About 1.7 Ω, hiding inside the battery the whole time."
  4. `old-battery`
     - Prompt: "Swap in the old battery from the shelf. Take both readings again: switch off, then on."
     - Goal: B2 in the loop, logged open reading 8.4 to 8.8 V and loaded reading 5.2 to 6.2 V.
     - Success: "8.6 V at rest looks fine. Under load it slumps below 6 V. Old batteries hide their age until you make
       them work."
  5. `watch-it-sag` (bonus)
     - Prompt: "Fresh battery back in. Leave the load on for 20 seconds and watch the reading, then switch off."
     - Goal: `heldFor(20, part(S1).closed)` with B1, reading falls at least 0.1 V further during that time, then rises
       after switching off.
     - Success: "It keeps sinking while it works, then recovers a little at rest. The chemistry can only react so
       fast."
- **Fried moments:** none.
- **SIM NEEDS:** N1, N2, N3, N10. Bench: swapping a battery keeps existing clip and grabber connections (N11).

#### Explain

1. **A resistor inside every battery**
   > A real battery behaves like a perfect voltage source with a small resistor in series, hidden inside. That
   > internal resistance comes from the chemicals, the electrodes and the joins between them. A fresh 9 V alkaline
   > battery has roughly 1.5 to 2 Ω. A fresh AA cell has much less, around 0.1 to 0.2 Ω. As batteries age, their
   > internal resistance climbs.

   Widget: `battery-model` (an ideal source and a resistor inside a dashed battery outline; drag a load slider and
   watch the terminal voltage and internal drop change).
2. **Why the voltage sags**
   > When current flows, the hidden resistance takes its share of the voltage, just like any resistor in a loop:
   > V = I × r. With 0.56 A flowing through 1.7 Ω, about 0.95 V is lost inside the battery, so the terminals only
   > offer about 8.45 V. No current, no loss: that's why a battery at rest reads its full voltage.
3. **No infinite current**
   > On paper, a 9 V battery shorted by a 0.01 Ω wire would push 900 A. It can't. The internal resistance caps the
   > current at a few amps, and the chemistry can't react fast enough to keep even that up for long. Ohm's law isn't
   > broken. You just have to count the battery's own resistance as part of the loop.
4. **Test batteries under load**
   > An old battery can read almost normal on a meter, because the meter draws next to no current. Put it to work and
   > its high internal resistance drags the voltage down. That's why a battery that "measures fine" can still fail to
   > run a gadget. For a fair test, measure while it's powering something.

#### Quiz

1. `internal-r` (numeric) "A battery reads 9.5 V with nothing connected and 9.0 V while 0.5 A flows. What is its
   internal resistance?" Answer 1, unit Ω, tolerance 2%.
   - Explain: 0.5 V is lost inside while 0.5 A flows, so r = 0.5 ÷ 0.5 = 1 Ω.
2. `short-max` (numeric) "A 9 V battery with 1.5 Ω of internal resistance is shorted by a perfect wire. What is the
   most current it could push?" Answer 6, unit A, tolerance 2%.
   - Explain: only the internal resistance limits it: 9 ÷ 1.5 = 6 A. Real chemistry sags, so you'd see less.
3. `fine-but-flat` (choice) "A battery reads 9.1 V on your meter, but your gadget won't run on it. Most likely cause?"
   - "High internal resistance: under load its voltage collapses" (correct). Why: the meter draws almost no current,
     so it can't reveal a weak battery.
   - "The meter is wrong". Why: the reading is right for an unloaded battery. It just isn't the whole story.
   - "The gadget needs exactly 9.0 V". Why: devices work over a range of voltages. 9.1 V would be fine if it held up.
   - Explain: test batteries under load to see how they really perform.
4. `aa-or-9v` (choice) "Which usually has lower internal resistance: a fresh AA alkaline cell or a fresh 9 V alkaline
   battery?"
   - "The AA cell" (correct). Why: about 0.1 to 0.2 Ω, versus about 1.5 to 2 Ω. A 9 V battery is six small cells in
     series, and their resistances add.
   - "The 9 V battery". Why: higher voltage doesn't mean lower resistance. Its small cells add up their resistance.
   - "They're the same". Why: size and construction make a big difference.
   - Explain: bigger electrodes and fewer cells in series mean less internal resistance.
5. `law-broken` (choice, spot the mistake) "Lena says: Ohm's law fails at high current, because my battery gave 2 A
   when the maths said 15 A. What's the better explanation?"
   - "The battery's internal resistance and sagging chemistry were left out of the maths" (correct). Why: include the
     battery's own resistance and the numbers line up much better.
   - "Ohm's law only works below 1 A". Why: it holds for resistors at any current.
   - "The meter must be faulty". Why: the meter was fine. The model of the battery was too simple.
   - Explain: when theory and measurement disagree, check what the model left out.
6. `terminal-v` (numeric) "A 9.4 V battery with 2 Ω inside drives a 45 Ω load. What voltage appears at its terminals?"
   Answer 9.0, unit V, tolerance 1%.
   - Explain: I = 9.4 ÷ (45 + 2) = 0.2 A, so the load gets 0.2 × 45 = 9.0 V and 0.4 V is lost inside.
   - Hint: "Find the current first, using the total resistance."

#### Wrap

- Rules:
  - "Every battery has internal resistance."
  - "Under load a battery's voltage sags. More current, more sag."
  - "Test batteries while they work, not just at rest."
  - "Count the battery's own resistance and Ohm's law still holds."
- Try it for real: parts "a fresh and an old 9 V battery", "a 15 Ω resistor rated 5 W or more", "a clip lead to act as
  a switch", "a multimeter"; safety "The load draws about half an amp and gets hot: use a 5 W resistor and don't touch
  it while it's on.", "Run the load for short spells only."

#### Mascot

- Start: "Batteries have secrets. Let's catch one in the act."
- Hint: "Read it once at rest, once while working. Compare."
- Success: "1.7 hidden ohms, found. Nothing hides from your meter."

---

## 7. Module 6: Cells and batteries (`cells-and-batteries`)

Summary: Make a cell from fruit and two metals, stack cells in series, and learn to choose and handle real batteries.
Landmark: `lemon-grove`.

---

### L16. `lemon-cell`: A battery from the fruit bowl

- **Summary:** Build a copper and zinc fruit cell, find its plus side, and learn what happens inside.
- **Minutes:** 12
- **Prerequisites:** `inside-the-battery`
- **Objectives:** build a working electrochemical cell; identify its positive and negative electrodes; explain the
  roles of electrodes and electrolyte; describe ions and electrons in plain words; contrast electron flow with
  conventional current.
- **Unlocks:** parts `[fruit-cell]`; isle `lemon-tree`

#### Hook

> Every battery you've used so far came from a factory. Now you'll make one from a lemon. Push two different metals
> into the fruit, a copper coin and a strip of zinc-coated steel, and a chemical reaction starts pushing charge from
> one to the other. The robot has a basket of lemons and a little box of metal bits. Let's find out how much push a
> piece of fruit can give.

Visual: `{ kind: part, part: fruit-cell }`.

Predict (ungraded): "One lemon, with a copper coin and a zinc strip pushed into it. What voltage do you expect?"
Options: "About 0.001 V" / "About 1 V" / "About 9 V".

#### Lab `lemon-cell`

- **Board:** none.
- **Prop (SIM NEEDS N12):** `lemon` (FC1): a lemon half on a saucer with two electrode slots. Tray: two copper-plated
  coins, two galvanized (zinc-plated) strips. Dropping an electrode into a slot inserts it; dragging one electrode onto
  the other makes them touch inside the fruit. Each electrode has a clip point on its exposed end.
- **Netlist:** FC1 `cell` with emf and internalOhms set by the lab from the electrode pair. Copper and zinc, apart:
  emf 0.92 (random ±0.03), internalOhms 1,200, pos on the copper electrode. Same metal twice: emf 0 (±0.005),
  internalOhms 1,200. Electrodes touching: emf 0, internalOhms 1.
- **Tray (bonus):** D1 red LED and two clip leads.
- **Instruments:** meter, leads in COM and VΩ, DC V 2V.
- **Tasks:**
  1. `make-a-cell`
     - Prompt: "Push a copper coin and a zinc strip into the lemon, close together but not touching. Measure between
       them: red on the copper, black on the zinc."
     - Goal: FC1 has copper and zinc, apart, `across(FC1) && meter.value >= 0.80 && meter.value <= 1.00`.
     - Hints: (1) "One metal in each slot." (2) "The 2V range shows the most digits for under a volt."
     - Success: "About 0.9 V from a lemon. You just made a cell."
  2. `which-is-plus`
     - Prompt: "Swap the probes: red on the zinc, black on the copper."
     - Goal: `across(FC1, "rev") && meter.value <= -0.80 && meter.value >= -1.00`.
     - Success: "Negative. So copper is the plus side, and zinc is the minus side."
  3. `same-metal`
     - Prompt: "Replace the zinc strip with the second copper coin, and measure again."
     - Goal: FC1 has two copper electrodes, `|meter.value| < 0.05`.
     - Success: "Almost nothing. A cell needs two different metals."
  4. `touching`
     - Prompt: "Put the zinc strip back, then push the two metals together so they touch inside the lemon."
     - Goal: FC1 copper and zinc touching, `|meter.value| < 0.05`.
     - Success: "Zero again. Touching electrodes short the cell out from the inside."
  5. `one-lemon-led` (bonus)
     - Prompt: "Separate the metals. Can one lemon light the red LED? Long leg to copper, short leg to zinc."
     - Goal: D1 anode on the copper electrode, cathode on the zinc, `part(D1).glow < 0.02`.
     - Success: "Not a flicker. 0.9 V is less than half of what a red LED needs. You're going to need more lemons."
- **Fried moments:** none.
- **SIM NEEDS:** N1, N12 (fruit cell prop and electrode logic).

#### Explain

1. **Two metals and a juice**
   > A cell needs three things: two different metals, called electrodes, and something between them that conducts
   > using ions, called the electrolyte. In your lemon cell the electrodes are copper and zinc, and the lemon juice is
   > the electrolyte. One cell like this gives about 0.9 V. Strictly speaking, a battery is several cells joined
   > together, though people use the word for single cells too.
2. **What happens inside**
   > Zinc gives up electrons easily. At the zinc strip, atoms leave the metal as positive zinc ions and dissolve into
   > the juice, leaving their electrons behind. Those electrons travel out through your wire to the copper. There,
   > hydrogen ions from the acidic juice collect them and pair up into hydrogen gas: the tiny bubbles on the coin.
   > Slowly, the zinc is used up.

   Widget: `cell-cutaway` (a zoomed animation: zinc ions leaving the strip, electrons moving through the wire,
   bubbles forming on the copper; a toggle shows conventional current arrows going the other way).
3. **Atoms in one card**
   > An atom has a tiny nucleus of positive protons, surrounded by negative electrons. Normally the charges balance.
   > An atom that loses electrons becomes a positive ion, and one that gains electrons becomes a negative ion.
   > Opposite charges attract and like charges repel. That push and pull between separated charges is what a
   > voltmeter measures.
4. **Electrons go the other way**
   > In your wire, electrons drift from the zinc (minus) toward the copper (plus). Diagrams still show current
   > flowing from plus to minus. Benjamin Franklin picked which kind of charge to call positive in the 1740s, long
   > before anyone knew about electrons. When J. J. Thomson discovered the electron in 1897, it turned out to be
   > negative. The convention stayed, and the maths works either way.

#### Quiz

1. `plus-electrode` (choice) "In a copper and zinc fruit cell, which electrode is the positive terminal?"
   - "The copper" (correct). Why: electrons arrive at the copper from the zinc, so copper is the plus side.
   - "The zinc". Why: zinc gives up electrons and is the negative side.
   - "Whichever one is bigger". Why: the metals decide the polarity, not their size.
   - Explain: copper is plus, zinc is minus. Your meter showed it when you swapped the probes.
2. `bubbles` (choice) "What are the tiny bubbles that form on the copper coin?"
   - "Hydrogen gas" (correct). Why: hydrogen ions from the juice collect electrons at the copper and pair up as gas.
   - "Oxygen". Why: no oxygen is released at the copper in this cell.
   - "Air escaping from the lemon". Why: the bubbles only appear while the cell is delivering current.
   - Explain: the bubbles are a sign of the reaction at work.
3. `energy-source` (choice) "Where does the fruit cell's energy actually come from?"
   - "The chemical reaction of the zinc, which slowly gets used up" (correct). Why: zinc dissolving and hydrogen
     forming releases the energy.
   - "The lemon juice itself". Why: the juice is the electrolyte that lets the reaction happen. Vinegar or salty water
     can do the same job.
   - "The copper coin". Why: the copper is where electrons are collected. It isn't consumed.
   - Explain: the juice is the go-between. The zinc is the fuel.
4. `two-coins` (choice, predict) "You build a cell with two copper coins in the lemon. What will the meter read?"
   - "About 0 V" (correct). Why: identical electrodes push equally, so there is no difference between them.
   - "About 0.9 V". Why: that needs two different metals.
   - "About 1.8 V". Why: two coins don't double anything. With the same metal, the voltage cancels.
   - Explain: voltage comes from the difference between two metals.
5. `electron-drift` (choice) "In the wire from the zinc to the copper, which way do electrons drift?"
   - "From the zinc to the copper, minus to plus" (correct). Why: electrons are negative and move toward plus.
   - "From the copper to the zinc". Why: that is the direction of conventional current, the opposite way.
   - "Both ways equally". Why: then there would be no current.
   - Explain: electrons go minus to plus. Conventional current is drawn plus to minus.
6. `cell-mv` (numeric) "A fruit cell gives 0.92 V. How many millivolts is that?" Answer 920, unit mV, tolerance 0%.
   - Explain: multiply by 1,000: 0.92 V is 920 mV.

#### Wrap

- Rules:
  - "A cell is two different metals in an electrolyte."
  - "In a copper and zinc cell, copper is plus and zinc is minus."
  - "The electrodes must never touch."
  - "Electrons drift minus to plus. We draw current plus to minus."
- Try it for real: parts "a lemon, or lemon juice in a small cup", "a clean copper coin or copper strip", "a
  galvanized (zinc-plated) nail or bracket", "a multimeter"; safety "Don't eat the lemon afterwards: metal dissolves into
  the juice.", "Wash your hands, and keep coins and small parts away from young children."

#### Mascot

- Start: "Lunch or laboratory? Today a lemon is both."
- Hint: "Two different metals, close together, not touching."
- Success: "Nine tenths of a volt from fruit. Nature makes batteries too!"

---

### L17. `stack-the-cells`: Stack the cells

- **Summary:** Link fruit cells in series, discover that voltages add, and light an LED with no resistor.
- **Minutes:** 12
- **Prerequisites:** `lemon-cell`
- **Objectives:** connect cells in series correctly; predict the total voltage, including a reversed cell; explain
  why high internal resistance limits current; explain why series adds voltage but not current capacity.
- **Unlocks:** parts `[]`; isle `lemon-tree`

#### Hook

> One lemon gives about 0.9 V. A red LED needs nearly 2 V before it even starts to glow. The fix is the same trick
> every battery uses inside: link cells in a chain so their voltages add up. The robot has lined up four lemon cells
> and a pile of clip leads, and its dim LED face is watching you hopefully. Your mission: a fruit-powered light.

Visual: `{ kind: part, part: fruit-cell }`.

Predict (ungraded): "Two lemon cells of 0.9 V each, the zinc of one clipped to the copper of the next. Total voltage?"
Options: "0.9 V" / "1.8 V" / "0.45 V".

#### Lab `stack-the-cells`

- **Board:** none.
- **Initial parts:** FC1 to FC4: four lemon cells, each copper and zinc (emf 0.90 to 0.94, internalOhms 1,000 to
  1,400, seeded). D1 red LED, loose.
- **Tray:** five clip leads.
- **Instruments:** meter, leads in COM and VΩ, DC V 2V. Room-lights switch (SIM NEEDS N13).
- **Expected:** two cells about 1.83 V; four cells about 3.65 V unloaded; total internal resistance about 4.8 kΩ;
  LED current about 0.4 mA, glow about 0.05; stack voltage with the LED connected about 1.7 V.
- **Tasks:**
  1. `two-in-series`
     - Prompt: "Link two cells: clip the zinc of one to the copper of the next. Measure from the free copper to the
       free zinc."
     - Goal: FC1 and FC2 in series, aiding; probes across the free ends; reading 1.70 to 1.95 V.
     - Success: "About 1.8 V. In series, cell voltages add up."
  2. `wrong-way`
     - Prompt: "Now link the same two cells copper to copper, and measure across the free ends."
     - Goal: two cells in series, opposing; `|meter.value| < 0.1`.
     - Success: "Almost nothing. Back to back, the two cells cancel each other out."
  3. `four-stack`
     - Prompt: "Build a chain of all four, zinc to copper at every link. Measure the whole stack."
     - Goal: FC1 to FC4 in series, aiding; probes across the free ends; reading 3.4 to 3.8 V.
     - Hints: (1) "3.6 V is over the 2V range. Step up to 20V." (2) "Every link joins a zinc to the next copper."
     - Success: "About 3.6 V. Enough to light a red LED."
  4. `light-it`
     - Prompt: "Connect the LED across the stack: long leg to the free copper, short leg to the free zinc. Dim the room
       lights if you need to."
     - Goal: D1 forward-connected across the four-cell stack, `part(D1).glow > 0.02 && part(D1).i > 0.0002`.
     - Hints: (1) "Long leg toward copper, the plus end of the stack." (2) "It will be faint. Try the room-lights
       switch."
     - Success: "A glow from fruit! Faint, but completely yours."
     - Story beat: the robot's LED face brightens in sync with D1.
  5. `why-no-resistor` (bonus)
     - Prompt: "Keep the LED lit and measure across the stack again."
     - Goal: reading 1.5 to 2.0 V across the stack with D1 connected and lit.
     - Success: "From 3.6 V down to about 1.7 V. The lemons' internal resistance swallows the rest and keeps the
       current under half a milliamp. That's why no resistor was needed."
- **Fried moments:** none possible: four cells can't push more than about 0.8 mA, even into a short.
- **SIM NEEDS:** N1, N12, N13 (room-lights dimming so faint glows are visible).

#### Explain

1. **Series adds voltage**
   > Link cells in a chain, the plus of one to the minus of the next, and their voltages add. Two fruit cells give
   > about 1.8 V, four give about 3.6 V. Get one link backwards and that cell subtracts instead: four cells with one
   > reversed give about 1.8 V. Every multi-cell battery relies on this. A 9 V battery is six 1.5 V cells in series.

   Widget: `cell-stack` (drag cells into a chain, flip any one, watch the total voltage update).
2. **Why the LED survived**
   > You connected an LED straight across the stack, with no resistor, and it survived. Each lemon cell has an
   > internal resistance of roughly a thousand ohms. Four in series add up to several thousand ohms, which holds the
   > current well under 1 mA. The cells' own resistance did the resistor's job. Try that with a 9 V battery and the
   > LED is toast.
3. **Voltage up, current no better**
   > Stacking cells in series raises the voltage, but all the current still passes through every cell, so their
   > internal resistances add up too. More lemons in a chain won't give you a strong current. For more current you'd
   > need bigger electrodes placed closer together, or several stacks connected side by side in parallel.

#### Quiz

1. `four-cells` (numeric) "Four fruit cells of 0.9 V each, all linked correctly in series. Total voltage?" Answer 3.6,
   unit V, tolerance 1%.
   - Explain: in series the voltages add: 4 × 0.9 = 3.6 V.
2. `one-reversed` (numeric, predict) "In that same stack of four, one cell is linked the wrong way round. What's the
   total now?" Answer 1.8, unit V, tolerance 2%.
   - Explain: three cells add and the reversed one subtracts: 0.9 + 0.9 + 0.9 − 0.9 = 1.8 V.
   - Hint: "A reversed cell pushes against the others."
3. `no-resistor-why` (choice) "Why can a fruit battery light an LED with no resistor, when a 9 V battery would destroy
   it?"
   - "The fruit cells' high internal resistance limits the current" (correct). Why: thousands of ohms inside the
     stack keep the current far below the LED's limit.
   - "Fruit electricity is gentler". Why: charge is charge. The difference is the resistance in the loop.
   - "The LED only needs 0.9 V". Why: a red LED needs about 1.7 V or more to glow at all.
   - Explain: a source with high internal resistance limits current all by itself.
4. `trace-the-chain` (order) "A three-cell fruit battery lights an LED. Trace the chain from the LED's long leg to its
   short leg, through every cell."
   - Correct order: LED long leg (anode); cell 1 copper; cell 1 zinc; cell 2 copper; cell 2 zinc; cell 3 copper; cell
     3 zinc; LED short leg (cathode).
   - Explain: the long leg meets the stack's free copper, its plus end. Each link joins a zinc to the next copper, and
     the last free zinc, the minus end, meets the short leg.
5. `copper-to-copper` (choice, spot the mistake) "Zoe's two-cell stack reads about 0 V. Her link joins the copper of
   cell 1 to the copper of cell 2. What should she do?"
   - "Link the zinc of one cell to the copper of the next" (correct). Why: copper to copper puts the cells back to
     back, so they cancel.
   - "Add a third cell". Why: the wiring is wrong, so more cells won't fix it.
   - "Push the metals closer together". Why: spacing changes internal resistance, not the cancelling.
   - Explain: in series, always join plus to minus: zinc to copper.
6. `inside-9v` (choice) "What's inside a typical 9 V alkaline battery?"
   - "Six 1.5 V cells in series" (correct). Why: 6 × 1.5 V = 9 V.
   - "One big 9 V cell". Why: no single common chemistry makes 9 V per cell.
   - "Nine 1 V cells". Why: alkaline cells are 1.5 V each, so it takes six.
   - Explain: a 9 V battery is a stack of six small alkaline cells.

#### Wrap

- Rules:
  - "Cells in series: their voltages add."
  - "Join plus to minus every time. A reversed cell subtracts."
  - "Series raises voltage, not current."
  - "High internal resistance can limit current all by itself."
- Try it for real: parts "four lemons, or lemon juice split into four small cups", "four copper coins or strips", "four
  galvanized nails or brackets", "five clip leads", "a red LED", "a multimeter"; safety "Don't eat the fruit
  afterwards.", "The glow is faint: try it in a dim room."

#### Mascot

- Start: "One lemon isn't enough. Let's build a team."
- Hint: "Zinc to copper at every link. Copper to copper cancels out."
- Success: "My face! It's glowing! Fruit-powered and fabulous."

---

### L18. `battery-field-guide`: A field guide to batteries

- **Summary:** Measure four kinds of battery at rest and under load, estimate run time, and learn which ones need care.
- **Minutes:** 10
- **Prerequisites:** `stack-the-cells`
- **Objectives:** tell primary from secondary batteries; estimate run time from capacity; match a battery to a job by
  its internal resistance and capacity; state the main battery safety rules.
- **Unlocks:** parts `[coin-cell]`; isle `cell-jar`

#### Hook

> Batteries come in a whole zoo of shapes and chemistries: the chunky 9 V, the AA in a remote, the coin cell in a
> watch, the rechargeable pack in a phone. They differ in voltage, in how much charge they hold, in how much current
> they can deliver, and in how carefully they must be treated. Time to test a few and learn which battery suits which
> job.

Visual: `{ kind: part, part: coin-cell }`.

Predict (ungraded): "Which can deliver the most current: a coin cell, an AA cell or a 9 V battery?"
Options: "The coin cell" / "The AA cell" / "The 9 V battery". (The AA, because its internal resistance is lowest.)

#### Lab `battery-field-guide`

- **Board:** none.
- **Initial parts:** a battery shelf with B1 9 V alkaline (emf 9.4, internalOhms 1.7, mAh 500); X1 AA alkaline (emf
  1.58, internalOhms 0.15, mAh 2500); X2 AA NiMH rechargeable (emf 1.32, internalOhms 0.03, mAh 2000); X3 3 V lithium
  coin cell (emf 3.2, internalOhms 15, mAh 225). A test station: two spring clips, with a switchable 100 Ω test load
  across them. A display case behind glass holds a phone lithium-ion pack and a car battery: info only, not
  connectable (tap for a safety card).
- **Instruments:** meter, DC V 20V, probes clipped to the test station. Time-lapse control (SIM NEEDS N14).
- **Expected under 100 Ω:** 9 V 9.24 V; AA alkaline 1.58 V (no visible drop); NiMH 1.32 V; coin cell about 2.78 V.
- **Tasks:**
  1. `survey`
     - Prompt: "Drop each battery into the test station with the load off and log its resting voltage."
     - Goal: logged resting readings for B1 (9.0 to 9.6 V), X1 (1.50 to 1.65 V), X2 (1.25 to 1.40 V) and X3 (3.0 to
       3.3 V).
     - Success: "Four chemistries, four voltages. The rechargeable AA sits lower than the alkaline one, by design."
  2. `load-test`
     - Prompt: "Now switch on the 100 Ω load and log each battery again while it works."
     - Goal: logged loaded readings for all four.
     - Hints: (1) "Load switch on, then read. Do all four."
     - Success: "The AA cells barely notice. The coin cell sags by about 0.4 V. Its high internal resistance makes it
       a sipper, not a gulper."
  3. `run-time` (notebook)
     - Prompt: "An LED circuit drawing 15 mA runs from the 500 mAh 9 V battery. Estimate how many hours it will last,
       then run the time-lapse."
     - Goal: `note("hours")` between 25 and 40, then the time-lapse is played to the end.
     - Hints: (1) "Capacity in mAh divided by current in mA gives hours."
     - Success: "About 33 hours, close to what the time-lapse shows. Real batteries give a little more or less,
       depending on the load and the temperature."
- **Fried moments:** none.
- **SIM NEEDS:** N1, N2, N14 (time-lapse with battery depletion), N15 (display case props).

#### Explain

1. **Single-use or rechargeable**
   > Primary batteries are single-use: their chemistry runs one way, and once it's spent they're done. Alkaline AA,
   > AAA and 9 V batteries are primary, and so is your lemon cell. Secondary batteries are rechargeable: a charger
   > drives the reaction backwards. NiMH AAs and the lithium-ion packs in phones are secondary. Never try to recharge
   > a primary battery.
2. **Capacity: how long it lasts**
   > Capacity is how much charge a battery can deliver, in milliamp-hours (mAh). Divide it by the current and you get
   > a rough run time: 500 mAh at 15 mA lasts about 33 hours. Real capacity shrinks at high currents and in the cold.
   > Rough figures: a 9 V alkaline about 500 mAh, an AA alkaline 2,000 to 2,800 mAh, a coin cell about 220 mAh.

   Widget: `run-time` (pick a battery and a load, see the estimated hours and a discharge curve).
3. **Match the battery to the job**
   > Voltage isn't everything. A coin cell's high internal resistance suits gentle jobs, like a watch sipping
   > microamps. AA cells have low internal resistance and big capacity, good for torches and toys. A 9 V battery is
   > handy for small electronics but holds little charge. For a big current, you need a battery built to deliver one.
4. **Batteries that deserve respect**
   > A car battery is only 12 V, but it can push hundreds of amps through a short, enough to melt a spanner.
   > Lithium-ion packs can overheat and catch fire if shorted, punctured or crushed. Keep a 9 V battery away from
   > coins and keys in your pocket. Keep coin cells away from small children: a swallowed one can cause serious
   > internal burns.

#### Quiz

1. `primary-or-secondary` (match, two categories) "Sort each battery: single-use (primary) or rechargeable
   (secondary)."
   - 9 V alkaline: primary; lemon cell: primary; NiMH AA: secondary; phone lithium-ion pack: secondary.
   - Explain: primaries run their chemistry once. Secondaries can be driven backwards by a charger.
2. `aa-hours` (numeric) "A 2,000 mAh AA cell powers a gadget drawing 20 mA. Roughly how many hours will it run?"
   Answer 100, unit h, tolerance 2%.
   - Explain: 2,000 mAh ÷ 20 mA = 100 hours, as a rough estimate.
3. `pocket-9v` (choice) "Why shouldn't a 9 V battery ride loose in a pocket with coins?"
   - "Coins can bridge its terminals and short it, making it hot" (correct). Why: the two terminals sit side by side,
     so one coin can short them.
   - "Coins drain it by magnetism". Why: magnetism has nothing to do with it. A short circuit does.
   - "It's perfectly fine". Why: a shorted 9 V battery can get hot enough to burn.
   - Explain: keep battery terminals covered, or keep them away from loose metal.
4. `coin-job` (choice) "Which job suits a coin cell best?"
   - "A watch drawing a few microamps" (correct). Why: tiny currents barely dent its voltage, and its charge lasts for
     years.
   - "A small motor drawing 1 A". Why: with about 15 Ω inside, its voltage would collapse.
   - "A bright torch drawing 300 mA". Why: far too much current for its high internal resistance.
   - Explain: coin cells are sippers. Choose them for tiny currents.
5. `two-aa` (choice, predict) "Two 2,000 mAh AA cells in series. What do you get?"
   - "About 3 V, still about 2,000 mAh" (correct). Why: series adds voltage. The same current flows through both, so
     the capacity doesn't add.
   - "About 1.5 V and 4,000 mAh". Why: that is what two cells in parallel would give.
   - "About 3 V and 4,000 mAh". Why: series doubles the voltage, not the capacity.
   - Explain: series adds voltage. Parallel adds capacity.
6. `car-battery` (choice) "A car battery is only 12 V. Why is it treated with so much care?"
   - "It can deliver hundreds of amps into a short circuit" (correct). Why: that much current melts metal and causes
     burns and fires.
   - "12 V gives a dangerous shock through dry skin". Why: 12 V is usually too low to push much current through dry
     skin. The danger is a short circuit.
   - "It contains mains electricity". Why: it's a DC battery with no connection to the mains.
   - Explain: danger depends on how much current a source can deliver, not only on its voltage.

#### Wrap

- Rules:
  - "Primary batteries are single-use. Secondary batteries are rechargeable."
  - "Run time is roughly capacity (mAh) divided by current (mA)."
  - "Series adds voltage. Parallel adds capacity."
  - "Never short, puncture or crush lithium packs, and never recharge a primary battery."
- Try it for real: parts "a 9 V battery", "alkaline and rechargeable AA cells", "a 3 V coin cell", "a 100 Ω resistor",
  "a multimeter"; safety "Never puncture, crush or short a lithium battery.", "Take used batteries to a recycling point
  instead of the bin."

#### Mascot

- Start: "So many batteries. Let's meet the whole family."
- Hint: "Capacity divided by current. That gives you hours."
- Success: "Bench built, lamp lit, lab powered. This island is officially alive."

---

## 8. Module landmarks

Shown in the big reveal when the module's last lesson completes. Caption is final copy (one line). The mascot line
plays as the camera settles.

| Module | Landmark id | In-world name | Reveal caption | Mascot line |
|---|---|---|---|---|
| M1 Your meter | `meter-tower` | The Meter Tower | "A tower with a glowing display rises by the bridge. Now the island can measure itself." | "Now we can see what we're doing. Finally." |
| M2 Resistance | `resistor-hall` | Resistor Hall | "A long hall striped in every colour of the code. You can read every value on its walls." | "Brown, black, red. That's a thousand ohms of hall." |
| M3 Current and LEDs | `lighthouse` | The Lighthouse | "A lighthouse with one red LED at the top, wired with the right resistor, so it shines for years." | "Sensible current, steady light. That's how lighthouses last." |
| M4 Voltage and Ohm's law | `observatory` | The Observatory | "A dome on the highest layer of the board, where you found the law every circuit obeys." | "V equals I times R. From up here, it's everywhere." |
| M5 Power and heat | `power-station` | The Power Station | "Fuses on guard, heatsinks cooling, batteries treated with respect. The island has power, safely." | "Nothing smoking. Well, nothing that shouldn't be." |
| M6 Cells and batteries | `lemon-grove` | The Lemon Grove | "A grove of lemon trees wired in series lights the robot's face, and the bridge to the next island." | "Full brightness! Next stop: switches, relays and more." |

Island placement notes: Meter Tower beside the arrival bridge; Resistor Hall at the centre square, its roof striped
brown, black, red (1 kΩ); Lighthouse on the cliff edge with a real red glow at night; Observatory on a raised FR4
layer; Power Station near the dangling wire roots with a small fuse-box detail; Lemon Grove on the far shore, where
the Unit 2 cable bridge anchors.

---

## 9. Hall of Fried Parts in this unit

Every deliberate or likely burnout, so authors and the achievements engine agree on kinds and labels.

| Lesson | Required? | Kind | Label |
|---|---|---|---|
| `first-glow` | optional (LED with no resistor) | `led` | Red LED, no resistor on 9 V |
| `led-burnout` | required (task `too-far`) | `led` | Red LED, 15 Ω on 9 V |
| `measure-the-flow` | required (task `the-classic`) | `meter-fuse` | Meter fuse, 200 mA (amps across a battery) |
| `volts-across` | optional (probing while still on mA) | `meter-fuse` | Meter fuse, 200 mA (red lead left in mA) |
| `watts-and-heat` | required (task `cook-one`) | `resistor` | 15 Ω, 1/4 W resistor across 9 V |
| `watts-and-heat` | bonus (task `one-watt-too`) | `resistor` | 15 Ω, 1 W resistor across 9 V |
| `fuse-guard` | required (task `blow-1a`) | `fuse` | 1 A fuse across a 9 V battery |

Any other burnout the simulator detects (for example a learner shorting an LED in the sandbox) also lands in the
Hall with a label built from the event context.

---

## 10. Achievements

XP follows the fixed rules in `docs/ARCHITECTURE.md`; each value below is the achievement's own `xp`.

| Id | Title | Description (shown to learner) | XP | Hidden | Unlock condition |
|---|---|---|---|---|---|
| `first-reading` | First reading | "Measure a battery's voltage with your own meter." | 25 | no | Lab `meet-the-meter` task `read-battery` completed. |
| `stripe-sharp` | Stripe sharp | "Finish Reading the stripes with every quiz answer right first time." | 50 | no | Lesson `reading-the-stripes` completed with `firstTry == items`. |
| `glow-getter` | Glow getter | "Light an LED in a loop you wired yourself." | 25 | no | Lab `first-glow` task `build-loop` completed. |
| `into-the-hall` | Into the Hall | "Burn out your first part. Every maker has one." | 25 | no | `fried.length >= 1`. |
| `meter-bites-back` | The meter bites back | "Blow your meter's own fuse." | 25 | yes | Any `fried` entry with kind `meter-fuse`. |
| `curator` | Curator of crispy things | "Fill the Hall with an LED, a resistor, a fuse and a meter fuse." | 75 | yes | The set of `fried` kinds includes `led`, `resistor`, `fuse` and `meter-fuse`. |
| `lawmaker` | Lawmaker | "Find Ohm's law with every product within 5% of your battery, then predict a current within 5%." | 75 | no | Lab `find-the-law`: tasks `spot-the-pattern` and `predict-and-test` completed, all four logged I × R products within 5% of the logged battery voltage, and the 4.7 kΩ prediction within 5% of the measured current (lab-emitted trigger, N16). |
| `smoke-tester` | Smoke tester | "Smoke a 1/4 W resistor and a 1 W resistor." | 50 | yes | Lab `watts-and-heat`: `event("smoke")` on a 0.25 W resistor and on R4 (1 W), same or different sessions. |
| `bracketed` | Bracketed | "Blow the 1 A fuse, keep the 3 A fuse alive, and measure the current in between." | 50 | no | Lab `fuse-guard` tasks `blow-1a` and `measure-big` completed with no `blown` event on F2 in that lab session. |
| `sour-power` | Sour power | "Light an LED using nothing but fruit." | 50 | no | Lab `stack-the-cells` task `light-it` completed. |
| `upside-down` | Upside down | "Flip one cell in a four-cell stack and measure what's left." | 25 | yes | Lab `stack-the-cells`: four cells in series with exactly one reversed, a logged reading between 1.6 and 2.0 V (lab-emitted trigger, N16). |
| `curious-mind` | Curious mind | "Complete 8 bonus tasks in Basics." | 50 | no | At least 8 bonus task ids (listed in section 12) present in `lessons[*].tasks` across Unit 1. |
| `clean-sweep` | Clean sweep | "Finish a whole Basics module with every quiz answer right first time." | 50 | no | Some module in unit `basics` has every lesson completed with `firstTry == items`. |
| `island-founder` | Island founder | "Complete all 18 lessons of Basics and bring Bareboard Isle to life." | 100 | no | Every lesson in unit `basics` completed. |

---

## 11. Parts bin entries introduced in this unit

Descriptions are final copy for `/parts`. "Symbol" describes what authors should draw (our own artwork).

### `multimeter`: Multimeter

Your measuring tool for the whole course. A rotary dial chooses what to measure (volts, amps, ohms or continuity) and
how big a value to expect. The screen shows up to 1999 counts, OL when a value is too big for the range, and a minus
sign when the probes are the other way round. A meter can't fix a circuit, but it will always tell you the truth
about one.

- DC volts input resistance: 10 MΩ, so it barely disturbs a circuit.
- mA input protected by a 200 mA fuse. 10A input unfused, for about 10 s at a time.
- Ohms ranges from 200 Ω to 2 MΩ. Continuity beeps below about 30 Ω.
- Black lead in COM always. The red lead moves between VΩ, mA and 10A.
- Symbol: a circle with a letter inside: V for a voltmeter, A for an ammeter, Ω for an ohmmeter.
- Safety: check the red lead's socket before every measurement. Never probe a wall socket.

### `test-leads`: Meter probes

A red and a black lead, each with a shrouded plug at one end and a sharp steel tip at the other. Insulated handles
with finger guards keep your fingers away from the metal. Swap the tips for small hook grabbers when you want both
hands free.

- About 0.1 Ω each, which only matters when measuring tiny resistances.
- Black plugs into COM. Red plugs into VΩ, mA or 10A, depending on the job.
- Touching both tips together on the ohms range shows the leads' own resistance.
- Symbol: drawn as plain lines to the meter symbol.
- Safety: hold probes behind the finger guards.

### `battery-9v`: 9 V battery

The rectangular battery with two snap terminals on top. It's the workhorse power source of this unit: safe, cheap
and just strong enough to teach every lesson about current, heat and fuses.

- Nominal 9 V. A fresh alkaline one reads about 9.4 to 9.6 V at rest.
- Six 1.5 V alkaline cells in series inside.
- Capacity about 500 mAh at light loads. Internal resistance about 1.5 to 2 Ω when fresh.
- Terminals: the small round snap is plus, the larger six-sided snap is minus.
- Symbol: several pairs of long and short parallel lines. The long line is plus.
- Safety: don't carry it loose with coins or keys. A shorted 9 V battery gets hot.

### `alligator-clips`: Clip leads

Short wires with a sprung, toothed clip at each end. Clip one to a battery terminal and the other to a part's leg and
you have a connection, no soldering needed. All of Unit 1 is built with them.

- About 0.1 to 0.2 Ω each, including the clip contacts.
- Colours are labels, not rules. By habit, red goes to plus and black to minus.
- Every clip is a possible loose connection: check them first when a circuit misbehaves.
- Symbol: a plain line, like any wire.
- Safety: none at battery voltages.

### `battery-aa`: AA cell

The everyday cylindrical cell in remotes, toys and torches. Bigger electrodes than a 9 V battery give it far more
capacity and much lower internal resistance.

- Nominal 1.5 V (alkaline). A fresh one reads about 1.55 to 1.65 V.
- Capacity about 2,000 to 2,800 mAh at light loads.
- Internal resistance about 0.1 to 0.2 Ω when fresh.
- The end with the raised button is plus. The flat end is minus.
- Symbol: one long and one short parallel line. The long line is plus.
- Safety: don't try to recharge alkaline cells, and don't mix old and new cells in one device.

### `pencil-line`: Pencil-line resistor

A line of graphite drawn on card. Graphite is carbon that conducts, just not very well, so a pencil line is a resistor
you can draw, shade and reshape. Slide a probe along it and you have a homemade potentiometer.

- Typical values: tens of kilohms to a few megohms, depending on the pencil, paper and line.
- Resistance grows with length and falls with width and darkness.
- A sliding contact turns it into a variable resistor.
- Symbol: a resistor symbol. Add a diagonal arrow through it when it is used as a variable resistor.
- Safety: none.

### `resistor`: Resistor (1/4 W)

The most common part in electronics. A small cylinder with a wire at each end and coloured stripes that tell you its
value. It sets how much current flows in a circuit, and it doesn't care which way round it goes.

- Power rating 1/4 W (0.25 W).
- Gold stripe: ±5% tolerance. Silver: ±10%. Brown, on 5-stripe parts: ±1%.
- Common values follow the E6 and E12 series: 10, 15, 22, 33, 47, 68 (E6), plus 12, 18, 27, 39, 56, 82 (E12).
- Colour code: black 0, brown 1, red 2, orange 3, yellow 4, green 5, blue 6, violet 7, grey 8, white 9.
- Symbol: a zigzag line, or a small rectangle in IEC style.
- Safety: wear glasses when trimming leads. The clipped ends can fly.

### `led-red`: Red LED (5 mm)

A light-emitting diode in a red 5 mm dome. It glows when current flows from its anode to its cathode, and blocks
current the other way. It always needs something, usually a resistor, to limit its current.

- Forward voltage about 1.8 to 2.2 V (around 2 V at 20 mA).
- Typical current 20 mA. Absolute maximum 50 mA for the bench LED; many small LEDs are rated lower, so check the
  datasheet.
- Maximum reverse voltage about 5 V.
- Longer leg is the anode (plus). Shorter leg, by the flat spot on the rim, is the cathode (minus).
- Symbol: a triangle pointing into a bar, with two small arrows pointing away for the light.
- Safety: never connect it straight across a battery without a resistor.

### `led-color`: Coloured LEDs

The same idea as the red LED, with different crystals for different colours. The colour sets the forward voltage, so
a resistor that suits a red LED gives a blue one less current.

- Orange and yellow: about 2.0 to 2.2 V.
- Yellow-green indicator types: about 2.1 V. Bright (true) green: about 3.0 to 3.4 V.
- Blue and white: about 2.8 to 3.4 V.
- Same current limits as the red LED: design for 5 to 15 mA.
- Symbol: the LED symbol. The colour is written beside it.
- Safety: don't stare into bright blue or white LEDs at close range.

### `resistor-power`: Power resistor (5 W)

A chunky resistor in a white ceramic body. It does the same job as a small resistor, but its size lets it shed far
more heat, so it survives loads that would burn a 1/4 W part in seconds.

- Power rating 5 W. The value and rating are printed on the body instead of stripes.
- Runs well above 100 °C near its full rating, and that's normal for this type.
- Used in Unit 1 as a 15 Ω load across a 9 V battery (about 4.5 W).
- Symbol: the resistor symbol, with the wattage written beside it.
- Safety: it gets hot enough to burn. Let it cool, and keep it clear of anything that can melt.

### `fuse`: Glass fuse

A thin metal wire sealed in a glass tube with metal caps. Too much current for too long melts the wire and breaks
the circuit, protecting everything else. It is the one part designed to fail.

- Common size 5 × 20 mm. Unit 1 uses fast-acting 1 A and 3 A fuses.
- The rating is what it carries indefinitely. Bigger overloads blow it faster.
- No polarity.
- A blown fuse reads OL on continuity, and often shows a visible gap.
- Symbol: a small rectangle with a line running through it lengthwise (IEC), or an S-shaped line (older US style).
- Safety: always replace a fuse with the same rating, never a bigger one or a bit of wire.

### `fruit-cell`: Fruit cell

A lemon with a copper coin and a zinc-plated strip pushed into it. The zinc reacts with the acidic juice, and a small
voltage appears between the two metals. Weak, slow and wonderful.

- About 0.9 V per cell. Copper is plus, zinc is minus.
- Internal resistance around a thousand ohms, so the current stays well under 1 mA.
- Cells in series add voltage: four make about 3.6 V, enough for a faint red glow.
- The electrodes must not touch. Two of the same metal give about 0 V.
- Symbol: a single cell: one long and one short parallel line.
- Safety: don't eat the fruit afterwards. Wash your hands.

### `coin-cell`: 3 V coin cell

A flat, round lithium cell like the ones in watches and key fobs. It holds its voltage for years at tiny currents,
but its high internal resistance means it sags quickly under a heavy load.

- Nominal 3 V. A fresh one reads about 3.0 to 3.3 V.
- The common 20 mm size (often marked 2032) holds about 220 mAh.
- Internal resistance about 10 to 20 Ω when fresh, rising with age and cold.
- The flat face with the printing is plus.
- Symbol: a single cell: one long and one short parallel line.
- Safety: keep coin cells away from small children. A swallowed one can cause serious internal burns. Never recharge
  one.

---

## 12. Bonus tasks (for `curious-mind`)

`welcome-to-the-bench/swap-battery-leads`, `meet-the-meter/tired-battery`, `what-resists/extremes`,
`draw-a-resistor/slide-along`, `first-glow/match-symbols`, `watts-and-heat/one-watt-too`, `fuse-guard/battery-check`,
`inside-the-battery/watch-it-sag`, `lemon-cell/one-lemon-led`, `stack-the-cells/why-no-resistor`. Ten in total.

---

## 13. SIM NEEDS register

Everything below goes beyond the current contracts. Tags: [sim] engine, [bench] workbench, [lab] lab runtime,
[ui] lesson player or overlays.

| Id | Tag | Need | Used in |
|---|---|---|---|
| N1 | [lab] | Goal helpers beyond the contract: `meter.red` / `meter.black` (socket), `meter.mode`, `meter.range`, `meter.value` (parsed, `OL` as Infinity), `across(part, "rev"?)`, `inSeries(M1, part)`, `heldFor(s, cond)`, `logged(tag)`, `prop(id).state`, `event(type, part?)`, `bench.detachedLeadEnds`, simple topology checks (series, parallel, aiding or opposing cells). | All labs |
| N2 | [lab] | Lab notebook: auto-logs stable meter readings with tags from what the probes touch; numeric entry tasks checked against sim values; an optional `bonus: true` task flag (gives task XP, never blocks Continue). | L3, L5, L6, L10, L11, L12, L13, L15, L18 |
| N3 | [bench] | Clip lead resistance: a lab-level option (for example `leadOhms: 0.15`) that emits each clip lead as a small resistor, so high-current labs get realistic totals. | L13, L14, L15 |
| N4 | [bench] [lab] | Material props mapped to `probe-resistance`: skin patch (moisture, spacing, pressure), three water cups, copper wire, plastic ruler. Lab sets `ohms` from prop state with ±4% drift each second. | L4 |
| N5 | [bench] | Pencil card prop: draw a line by dragging, shade layers, choose width, erase; probes snap anywhere along the line; lab sets `ohms` from probe separation, layers and width. | L5 |
| N6 | [lab] [sim] | Seeded actual values for toleranced resistors (bands render the nominal value, the sim uses the actual one), including a forced out-of-tolerance part. Suggest an optional `nominalOhms` on resistor parts, or a lab-side mapping. | L6, L11, L12, all resistor labs |
| N7 | [ui] [bench] | Live schematic panel generated from the bench netlist, with hover linking between symbol and 3D part. | L7 (and widget `schematic-split`) |
| N8 | [ui] [bench] | Inspect overlays from `PartState`: LED stress bar (current as a share of `maxmA`), resistor temperature in °C with touch-feel labels, power bar against rating. | L8, L13 |
| N9 | [sim] [bench] | Meter internals: mA fuse state that persists once blown (emits `meter-fuse`), a bench action to replace it, per-range burden (2mA 100 Ω, 20mA 10 Ω, 200mA 1 Ω, 10A 0.05 Ω), and 10A input heating with a warning after about 10 s. | L9, L10, L14 |
| N10 | [sim] | Battery sag: a polarisation term on `battery` that pulls terminal voltage down over seconds at high current and recovers partly at rest, plus charge depletion from `mAh`. Targets: with about 0.6 Ω external, current starts above 3 A and settles at 1.6 to 2.4 A within 2 s; at 0.55 A, an extra 0.1 to 0.3 V of sag over 20 s; most of that recovers within 30 s. | L13, L14, L15 |
| N11 | [bench] | Swapping a part into an occupied spot keeps existing clip and grabber connections; a moved part keeps its id, so damage persists. | L8, L15 |
| N12 | [bench] [lab] | Fruit cell prop: lemon with two electrode slots, copper or zinc electrodes, touching state; lab maps it to `cell` emf and internalOhms, with `pos` on the copper side. | L16, L17 |
| N13 | [bench] | Room-lights dimming so faint LED glow (0.02 to 0.1) is clearly visible; bloom tuned for low glow. | L17 |
| N14 | [sim] [lab] | Time-lapse: run at very high speed (about 3,600 times real time) with battery depletion and LED dimming, plus an on-screen clock. | L18 |
| N15 | [bench] | Small lab props: resistor holder clips, reject bin, draggable value labels, colour chart card, battery shelf, test station with switchable load, display case with info-only items. | L6, L8, L11, L13, L18 |
| N16 | [lab] | Labs can emit named achievement triggers from their own checks (for `lawmaker` and `upside-down`). | L11, L17 |

Simulator tuning targets that are within the contract but must be checked by golden tests:

- Red LED I-V: about 1.75 V at 1 mA, 1.85 V at 5 mA, 1.95 V at 15 mA, 2.0 to 2.1 V at 20 mA, about 2.3 V at 50 mA; about
  1.65 V at 0.4 mA. Damage accumulates above `maxmA` (50), fast above 100 mA; dead parts stay dead. Reverse: no damage
  at 9.4 V through 1.5 kΩ.
- Resistor thermal: about 250 °C/W (1/4 W), 100 °C/W (1 W), 25 °C/W (5 W ceramic); smoke above about 4 times the
  rating when sustained; burn open far beyond. A 15 Ω, 1/4 W part across the bench battery smokes within about 3 s and
  opens within about 10 s.
- Fuse: carries its rating indefinitely; about 1 to 5 s at 2 times rating; under 0.3 s at 4 times; ±10% spread.
- Meter display: 3.5 digits, `OL` over range, leading minus when reversed, accuracy about ±(0.5% + 2 digits).

---

## 14. Accuracy checklist

A fact-checker should confirm each item below before content ships. Values given are the ones this blueprint uses.

| Claim | Value used | Notes |
|---|---|---|
| Fresh 9 V alkaline, open circuit | 9.4 to 9.6 V | Nominal 9 V; six 1.5 V cells in series. |
| 9 V alkaline capacity | about 500 mAh | Light loads; drops at high current. Makers quote roughly 500 to 600 mAh. |
| 9 V alkaline internal resistance | about 1.5 to 2 Ω fresh | Rises with use and cold. |
| AA alkaline | 1.5 V nominal, about 1.6 V fresh, 2,000 to 2,800 mAh, about 0.1 to 0.2 Ω | |
| AA NiMH | 1.2 V nominal, about 1.3 to 1.4 V fresh off charge, about 2,000 mAh | |
| Coin cell (20 mm, 2032 size) | 3 V nominal, about 220 mAh, about 10 to 20 Ω fresh | Internal resistance varies by maker and temperature. |
| Red LED forward voltage | about 1.8 to 2.2 V, around 2 V at 20 mA | |
| Other LED colours | orange and yellow about 2.0 to 2.2 V; blue, white and bright green about 2.8 to 3.4 V | Yellow-green indicator LEDs about 2.1 V. |
| LED current limits | typical 20 mA; bench LED absolute max 50 mA; reverse max about 5 V | Many generic 5 mm LEDs list 30 mA max: the parts bin says to check the datasheet. |
| LED circuit currents on the bench battery | 1.5 kΩ about 5 mA; 470 Ω about 16 mA; 150 Ω about 47 mA; 15 Ω several hundred mA | Using 9.4 V and Vf about 1.85 to 2.3 V. |
| LED resistor example | (9 − 2) ÷ 0.015 ≈ 467 Ω, use 470 Ω | |
| Voltmeter input resistance | 10 MΩ | Typical for digital meters; some cheap meters about 1 MΩ. |
| Meter mA fuse | 200 mA in our meter | Real meters use about 200 to 500 mA fast fuses. |
| Meter 10A input | often unfused; about 10 s on, then a rest | Many meters specify 10 to 15 s on and about 15 min off. |
| Continuity threshold | beeps below about 30 Ω | Varies by meter, roughly 10 to 100 Ω. |
| Fuse behaviour | carries rating indefinitely; fast types open in about 1 to 5 s at 2 times rating, well under a second at several times | Exact curves depend on the standard (UL 248-14 or IEC 60127) and maker. |
| Colour code | black 0 to white 9 as listed; gold ±5%, silver ±10%; gold multiplier ×0.1 | |
| E6 and E12 series | E6: 10, 15, 22, 33, 47, 68. E12 adds 12, 18, 27, 39, 56, 82 | |
| Tolerance example | 470 Ω ±5% is 446.5 to 493.5 Ω; 2.2 kΩ ±5% is 2,090 to 2,310 Ω | |
| Prefixes | p 10^-12, n 10^-9, µ 10^-6, m 10^-3, k 10^3, M 10^6 | 5 MΩ ÷ 5 mΩ = 10^9. |
| 1 ampere | about 6.24 × 10^18 electrons per second | |
| Ohm's law history | Georg Ohm published in 1827 | Ohm was born in 1789 (some sources wrongly give 1787). |
| Kirchhoff's voltage law | stated by Gustav Kirchhoff in 1845 | |
| Current symbol I | from the French "intensité du courant" | Not from "induced". |
| Franklin's sign convention | 1740s, an arbitrary choice | |
| Electron discovery | J. J. Thomson, 1897 | |
| Power examples | 9 V across 45 kΩ is 1.8 mW; 9 V across 50 kΩ is 1.62 mW; 5 V across 100 Ω is 50 mA and 0.25 W | |
| 15 Ω across the bench battery | about 0.55 A and 4.5 W (ideal 0.6 A and 5.4 W with no internal resistance) | About 18 times a 1/4 W rating. |
| 1 kΩ across the bench battery | about 9.4 mA and 88 mW | |
| Ideal short | 9 V across 0.01 Ω would be 900 A | Not achievable: internal resistance limits it to a few amps. |
| Internal resistance example | 0.56 A causes about 0.95 V drop across 1.7 Ω | |
| Skin resistance (probe tips) | dry: hundreds of kΩ to over 1 MΩ; wet: tens of kΩ; salty: around 10 kΩ | Illustrative; real values vary enormously with contact area. |
| Water | distilled about 1 MΩ between probes, tap tens of kΩ, salty about 1 to 2 kΩ | Depends on probe spacing and area. Ultra-pure water is far higher. |
| Pencil lines | tens of kΩ to a few MΩ | Depends on graphite grade, paper and shading. |
| Fruit cell | copper and zinc about 0.9 V (0.8 to 1.0 V); internal resistance hundreds of ohms to a few kΩ; copper plus, zinc minus; hydrogen bubbles at the copper | The zinc and its reaction supply the energy; the juice is the electrolyte. |
| Four fruit cells and a red LED | about 3.6 V open, about 0.4 mA, stack falls to about 1.7 V under the LED | |
| Mains frequency (if mentioned) | 50 Hz or 60 Hz depending on country | |
| Car battery | 12 V, hundreds of amps into a short | 12 V is usually too low to shock through dry skin; the hazard is short-circuit current. |
| Kettle power | about 2 to 3 kW | |
| Indicator LED power | about 0.04 W (2 V × 20 mA) | |
| Quartz watch current | around 1 µA | |
| Swallowed coin cells | can cause serious internal burns | Standard safety guidance. |

---

## 15. Notes for authors

- Every hook and explain card in this file was written to 40 to 90 words. Keep it that way when editing.
- Units always take a space (`470 Ω`, `9 V`, `15 mA`). Write values with the Ω and µ symbols, not "ohms" or "u".
- Never import wording, project names or figures from any book. The research notes in `.private/` are background only.
- When a lab's numbers change in the simulator, update the "Expected" line and any task ranges in the same commit.
