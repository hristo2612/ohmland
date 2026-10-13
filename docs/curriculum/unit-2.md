# Unit 2 blueprint: Switching

Status: blueprint for content authors. Each lesson below becomes `content/units/switching/<module-id>/<lesson-id>/lesson.yaml`
plus one `content/labs/<lab-id>.ts`. Every word here is original Ohmland text and may be used as is or polished.
Follow `docs/CONTENT.md` when editing (no em dashes, units with a space, conventional current).

Conventions used in this file:

- Netlist parts use the kinds and pin names from `packages/sim/src/types.ts`. Node names are lowercase (`vcc`, `gnd`, `k1coil`...).
- Unless a lab says otherwise the battery is `B1`: `battery`, pins `{pos: vcc, neg: gnd}`, `emf: 9`, `internalOhms: 1.5`.
  Labs fix the EMF at 9.0 V so numbers in prompts match. Unit 1 already taught battery sag.
- "Goal" lines describe what `goal(lab)` must check against the snapshot, the event log and bench state.
- **SIM NEEDS** marks anything beyond the current simulator contract. **BENCH NEEDS** and **LAB NEEDS** mark workbench
  and lab-runtime features. All of them are collected again in section 9.
- Unit 1 parts assumed in the bin: `multimeter`, `test-leads`, `battery-9v`, `resistor` (assortment), `led-red`, `fuse`.
- Quiz items: `(correct)` marks the right option. Every option carries its own "why".

---

## 1. Unit overview

**Unit id:** `switching` · **Island:** Switchback Isle · **Lessons:** 19 · **About 3.8 hours**

### Goals

By the end of the unit the learner can:

1. Describe any switch by poles and throws, map an unknown one with a continuity tester, and read switch, relay,
   capacitor, diode and transistor symbols.
2. Explain a relay as a switch moved by an electromagnet, find its pull-in and drop-out voltages, and protect the
   circuit from the coil's kickback with a diode.
3. Build on a breadboard confidently, knowing exactly which holes are joined.
4. Predict how a capacitor charges and discharges through a resistor, use the time constant (τ = R × C), and use
   capacitors to store, smooth, couple and block.
5. Use an NPN transistor as a current-controlled switch: base current in, larger collector current out, saturation
   when fully on.
6. Build oscillators with no moving parts: a two-transistor flasher that becomes a tone and then a siren.

### The big idea

Unit 1 was about one circuit at a time. Unit 2 is about **one current controlling another**. First your finger moves
a switch. Then a current moves a relay. Then a tiny current steers a big one through a transistor. Finally two
transistors steer each other, and the circuit runs by itself. That last step is the seed of every clock, timer and
computer the learner will meet in Units 4 and 5.

### The learner's journey

| Module | Feeling | The "aha" |
|---|---|---|
| M1 Switches | "I can see inside things with a beep." | Two switches can each flip one light. |
| M2 Relays | "Electricity can flip a switch." | A coil fights being switched off. |
| M3 Breadboard | "I can build tidy circuits fast." | A relay wired to cut its own power starts to buzz. |
| M4 Capacitors | "Circuits can remember for a while." | Charging is fast, then slow, always by the same curve. |
| M5 Transistors | "No moving parts, and it still switches." | A fingertip's trickle lights a lamp. |
| M6 Blink and beep | "My circuit runs by itself." | Shrink one capacitor and a blink becomes a song. |

### Island theme: Switchback Isle

A second floating board, linked to Unit 1's island by a cable bridge. Its look is a railway junction drawn in copper:
traces split at switch points, signal lamps stand at every fork, and a clocktower ticks in the middle. Each lesson adds a
piece; each module raises a landmark: the Switchyard, the Relay Clocktower, Breadboard Plaza, the Capacitor Water
Tower, the Transistor Gatehouse and, last, the Siren Tower, which sounds once when the unit is complete.

### Story glue (light)

The robot has spotted a bare board drifting next to the first island. "It needs a way to decide things," it says. The
learner and the robot wire it up together: first by hand, then with magnets, then with no moving parts at all. Story
appears only in hooks and mascot lines, one or two sentences at a time. It never blocks a lab.

### Module and lesson map

| # | Module (id) | Lesson id | Title | Min | Island piece |
|---|---|---|---|---|---|
| 1 | M1 Switches (`switches`) | `switch-anatomy` | What's Inside a Switch | 10 | switch |
| 2 | | `mystery-switch` | The Mystery Switch | 10 | test-lead-arch |
| 3 | | `stairway-light` | Either Switch, Any Time | 12 | led-lamp |
| 4 | M2 Relays (`relays`) | `meet-the-relay` | A Switch Flipped by a Magnet | 10 | relay |
| 5 | | `relay-thresholds` | Click In, Click Out | 10 | wire-spool |
| 6 | | `coil-kickback` | The Coil Kicks Back | 12 | diode |
| 7 | M3 Breadboard (`breadboard`) | `breadboard-inside` | X-Ray the Breadboard | 12 | breadboard-patch |
| 8 | | `relay-buzzer` | A Relay That Switches Itself | 12 | jumper-arch |
| 9 | M4 Capacitors (`capacitors`) | `capacitor-fill-fade` | Fill It, Watch It Fade | 10 | capacitor |
| 10 | | `capacitor-labels` | Reading the Fine Print | 12 | ceramic-cap |
| 11 | | `rc-time-constant` | Counting in Taus | 14 | resistor |
| 12 | | `smoothing-and-coupling` | Smooth It, Kick It Through | 12 | battery |
| 13 | M5 Transistors (`transistors`) | `meet-the-transistor` | A Tiny Current in Charge | 12 | transistor |
| 14 | | `touch-switch` | All the Way On | 12 | heatsink |
| 15 | | `delay-timer` | Wait for It | 14 | pot |
| 16 | M6 Blink and beep (`blink-and-beep`) | `night-light` | Lights On at Dusk | 12 | phototransistor |
| 17 | | `twin-flasher` | The Twin Blinker | 14 | led-lamp |
| 18 | | `flasher-to-tone` | Shrink It to a Song | 12 | speaker |
| 19 | | `siren` | The Siren Button | 15 | pushbutton |

Total about 226 minutes.

---

## 2. Modules

Each module is `content/units/switching/<module-id>/module.yaml`.

| Module | Id | Summary (for module.yaml) | Landmark | Lessons |
|---|---|---|---|---|
| M1 Switches | `switches` | Poles and throws, mapping a mystery switch by continuity, schematic symbols and a two-way stairway light. | `switchyard` | 1 to 3 |
| M2 Relays | `relays` | Coil and contacts, NO, NC and COM, pull-in and drop-out, isolation, coil kickback and the protection diode. | `relay-clocktower` | 4 to 6 |
| M3 The breadboard and a self-switching relay | `breadboard` | How a breadboard is wired inside, moving circuits onto it, and a relay that buzzes until a capacitor tames it. | `breadboard-plaza` | 7 to 8 |
| M4 Capacitors and time | `capacitors` | What capacitors store, units, codes, polarity and ratings, RC charging, the time constant, smoothing, coupling and blocking DC. | `capacitor-water-tower` | 9 to 12 |
| M5 Transistors | `transistors` | NPN pins, gain, the 0.7 V threshold, saturation, transistor versus relay, a touch switch and an adjustable delay timer. | `transistor-gatehouse` | 13 to 15 |
| M6 Blink and beep | `blink-and-beep` | A phototransistor night light, a two-transistor flasher, a tone in a speaker and a two-oscillator siren. | `siren-tower` | 16 to 19 |

Design notes on the split: M3 is deliberately short (two lessons) because its second lesson is a big "aha" that needs
room. Capacitor theory sits after the buzzer, so the learner has already felt a capacitor stretch time before naming
it. Every module ends on a lesson whose lab leaves a satisfying build on the bench, which becomes the landmark.

---

## 3. Lessons

### Module M1: Switches (`switches`)

Landmark: `switchyard`. Prerequisites for the module: Unit 1 complete (meter use, LED with series resistor, Ohm's law).

#### Lesson 1. `switch-anatomy`: What's Inside a Switch

- **Summary:** Peek inside three switches and learn to describe any switch by its poles and throws.
- **Minutes:** 10 · **Prerequisites:** Unit 1 complete.
- **Objectives:**
  - Use the meter's continuity mode to tell connected from not connected.
  - Name the pole, the throws and the actuator of a switch.
  - Classify SPST, SPDT and DPDT; tell momentary from latching, normally open from normally closed.
- **Unlocks:** parts `[toggle-switch, slide-switch, pushbutton]` · isle `switch`

**Hook**

> Every gadget you own is full of decisions: on or off, this way or that way. The humblest decision-maker is a switch.
> Inside its plastic shell there is a little piece of springy metal that either touches a contact or doesn't. Today you
> get a beeping tool that can hear the difference, and three switches to interrogate. Nothing here can break, so poke
> at everything.

Predict (ungraded): "A slide switch has three legs. How many of them do you think connect to each other at once?"
Options: "All three" · "Two at a time" · "None, it's a trick" · "It depends on the position".

**Lab `switch-anatomy`**

- Board: none (parts sit on the mat, joined by test leads). Instruments: meter.
- Initial parts:
  - `M1` multimeter, pins `{com: p1, vohm: p2, ma: m_ma, a10: m_a10}`, mode `continuity`. Probe tips start parked.
  - `S1` switch (SPST toggle), pins `{a: s1a, b: s1b}`, closed false.
  - `S2` spdt (slide), pins `{com: s2c, a: s2a, b: s2b}`, to "a".
  - `S3` pushbutton (normally open), pins `{a: s3a, b: s3b}`.
  - `S4` pushbutton, normally closed variant (see SIM NEEDS), pins `{a: s4a, b: s4b}`.
- Tray: two spare test leads.
- Tasks:
  1. `beep-test`. Prompt: "Set the meter to continuity and touch the two probe tips together. Then probe the toggle
     switch `S1` in both positions." Goal: `M1.display` showed the continuity reading (beep) at least once with probes
     joined, and the learner probed `S1` in both states (one reading OL, one beep). Hints: "The continuity mode has a
     little sound-wave symbol on the dial." / "Flip S1 by clicking its lever, then probe again." Success: "Beep means
     there's a path with almost no resistance. OL means no path at all." Notice: a switch is just a gap you can close.
  2. `find-the-pole`. Prompt: "The slide switch `S2` has three legs. Probe every pair in both slider positions and fill
     the table." Goal: the 3-pair by 2-position table (LAB NEEDS: continuity table panel) is complete and correct: the
     middle leg beeps with one outer leg per position, the outer pair never beeps. Hints: "There are only three pairs:
     left-middle, middle-right, left-right." / "Which leg is part of every beep? That one is special." Success: "The
     middle leg is the pole. It always connects to one throw or the other, never both, never neither." Notice: SPDT
     means one pole, two throws.
  3. `press-and-hold`. Prompt: "Two pushbuttons look identical. Probe each one, first released, then while held." Goal:
     both buttons probed in both states; the learner tags `S3` as "normally open" and `S4` as "normally closed" in the
     labeling panel. Hints: "Hold a button by pressing and keeping the pointer down (or Space on the keyboard)." /
     "Normally means 'when nobody touches it'." Success: "S3 connects only while pressed. S4 is connected until you press
     it. Both spring back when you let go." Notice: momentary switches return by themselves; the toggle stays put.
- Damage moments: none in this lab.
- SIM NEEDS: `pushbutton` optional param `normallyClosed?: boolean` (default false).
- BENCH NEEDS: "peek inside" toggle that makes switch bodies translucent and shows the moving contact strip.

**Explain**

1. **Pole, throw, actuator.** The pole is the contact that moves. A throw is a place it can land. The actuator is the
   part your finger pushes: a lever, slider or button. Describe a switch by counting: how many separate poles move
   together, and how many throws each one has. A light switch on a wall has one pole and one throw: SPST, single pole
   single throw. Widget idea: `switch-xray` (tap a switch type to see its contacts move).
2. **SPDT and friends.** Single pole, double throw (SPDT) means the pole always lands on one of two throws. That makes
   it a chooser, not just an on-off. Double pole (DP) switches have two independent poles moved by one actuator, so a
   DPDT has six legs and makes two choices at once. On schematics a dashed line between poles means "these move
   together".
3. **Momentary or staying put.** A toggle or slide switch stays where you leave it. A pushbutton is momentary: a spring
   returns it. Normally open (NO) buttons connect only while pressed, like a doorbell. Normally closed (NC) buttons
   disconnect while pressed, like the fridge-door switch that turns the light off when the door shuts on it.
4. **Ratings matter.** A switch's contacts have a current rating. Every time contacts open under load, a tiny spark
   eats at them. Motors are the worst: they gulp two or more times their running current when they start, so pick a
   switch rated well above the running current.

**Quiz**

- **q1** `choice`: "How many legs does a DPDT switch have?"
  - 3: "That's an SPDT: one pole plus two throws."
  - 4: "That would be a DPST: two poles with one throw each."
  - (correct) 6: "Two poles, each with its own pair of throws: 2 × 3 = 6."
  - 8: "No common switch type has 8 legs for two poles."
  - explain: "Count each pole with its throws. Double pole, double throw is two separate SPDT switches sharing one
    actuator." hint: "Start from SPDT and double it."
- **q2** `choice`: "Your meter beeps between a switch's middle leg and its left leg. You slide the actuator. What do you
  expect now?"
  - "Still a beep between middle and left": "Then the slider did nothing. On an SPDT it moves the pole to the other throw."
  - (correct) "A beep between middle and right": "The pole moved to the other throw."
  - "A beep between left and right": "The two throws never connect to each other in an SPDT."
  - explain: "In an SPDT the middle leg is usually the pole. Each position joins it to one throw."
- **q3** `match`: "Match each switch to where you'd find it."
  - Normally open pushbutton → doorbell
  - Normally closed pushbutton → fridge light that goes off when the door presses it
  - SPST toggle → simple on/off for a desk lamp
  - SPDT slide → choosing between two settings
  - explain: "NO connects only while pressed, NC disconnects while pressed, toggles stay put, SPDT picks one of two."
- **q4** `numeric`: "A small fan motor runs at 1.5 A. Using a 'starting surge of about twice running current' rule,
  what is the smallest switch rating you should pick?" answer 3, unit A, tolerance 0.
  - explain: "2 × 1.5 A = 3 A. In a shop you'd round up to the next standard size, perhaps 5 A."
  - hint: "Double the running current."
- **q5** `hotspot` (3D slide switch, legs labeled only by position): "Tap the pole." Target: middle leg.
  - explain: "On almost every slide switch the middle leg is the pole. When in doubt, the continuity table proves it."

**Wrap**

- Rules: "A pole is the moving contact; throws are where it can land." · "SPST is on-off; SPDT chooses between two." ·
  "Normally open connects when pressed; normally closed disconnects when pressed." · "Continuity beep means a path;
  OL means no path."
- Try it for real: parts: a multimeter with continuity mode, a slide switch, a tactile pushbutton. Safety: "Only test
  switches that are not wired into anything, and never open or test wall switches: mains wiring can kill."

**Mascot lines:** "Beep means yes. Silence means no. Switches can't lie to the beeper." · "The middle leg is usually
the boss." · "Press, hold, probe. Patience is a tool too."

---

#### Lesson 2. `mystery-switch`: The Mystery Switch

- **Summary:** Map an unlabeled switch from continuity alone, then draw it as a schematic symbol.
- **Minutes:** 10 · **Prerequisites:** `switch-anatomy`.
- **Objectives:**
  - Plan a systematic test of every pin pair in every position.
  - Deduce poles and throws from a continuity table.
  - Read and draw schematic symbols for switches, batteries, LEDs and resistors; apply the dot rule for crossings.
- **Unlocks:** parts `[]` · isle `test-lead-arch`

**Hook**

> The robot found a switch in a parts drawer. No label, no datasheet, six shiny legs. It might be two switches in one
> body, or something stranger. Professionals meet mystery parts all the time, and they don't guess. They test every
> pair of pins in every position and let the pattern speak. Your job: crack this switch and draw its symbol.

Predict: "Six legs. How many different pin pairs could you test?" Options: "6" · "12" · "15" · "36".
(Answer revealed in explain card 1: 15.)

**Lab `mystery-switch`**

- Board: none. Instruments: meter (continuity).
- Initial parts: a DPDT slide switch in "mystery" skin, built as two `spdt` parts that share one actuator
  (SIM/BENCH NEEDS: ganged actuator). `SA` spdt `{com: x2, a: x1, b: x3}`, `SB` spdt `{com: x5, a: x4, b: x6}`, both
  `to: "a"`, ganged. The bench shuffles which physical leg carries which node, seeded per learner (BENCH NEEDS: mystery
  mode with seeded pin shuffle). Legs are labeled only 1 to 6 by position.
- Tray: nothing.
- Tasks:
  1. `map-pairs`. Prompt: "Test pin pairs in both slider positions. Record each pair that beeps." Goal: the learner's
     continuity log (LAB NEEDS: auto-log of probe pairs and results) covers every pair that ever beeps, in both
     positions. Hints: "Keep one probe on pin 1 and walk the other across 2 to 6. Then move to pin 2." / "You only need
     to check each pair once per position." Success: "That's a complete map. Now for the detective part."
  2. `name-the-legs`. Prompt: "Label each leg: pole A, pole B, or a throw. Then pair each throw with its pole." Goal:
     the submitted pin map matches the hidden map. Wrong submissions are allowed and counted (used by the `pin-sleuth`
     achievement). Hints: "A pole beeps in both positions, each time with a different partner." / "There are two
     groups that never talk to each other. That means two poles." Success: "Two poles, two throws each, one actuator. A
     DPDT, cracked by beeps alone."
  3. `draw-it`. Prompt: "Build the schematic symbol: drag two SPDT symbols onto the canvas and join their poles with a
     dashed line." Goal: symbol editor contains two SPDT symbols linked by the "ganged" dashed line (LAB NEEDS: tiny
     symbol canvas). Hints: "The dashed line means 'mechanically linked, electrically separate'." Success: "Engineers
     around the world will read that drawing the same way."
- SIM NEEDS: ganged actuator for two `spdt` parts (or a `dpdt` kind with `com1, a1, b1, com2, a2, b2`). Either is fine;
  the netlist stays two separate electrical switches.

**Explain**

1. **Testing everything, once.** Six pins make 15 different pairs (6 × 5 ÷ 2). That sounds like a lot, but a
   systematic sweep takes two minutes and leaves no doubt. Write each result down. Guessing feels faster but costs
   more when it's wrong. Widget idea: `pair-counter` (slide the number of pins and watch the pair count grow).
2. **Reading the pattern.** A pole is the pin that always beeps with somebody, but the somebody changes when you slide.
   Throws beep only in one position. Two groups that never beep with each other are electrically separate: two poles.
   Write the groups as little families, one pole and its throws, and the whole switch suddenly makes sense. The same
   method cracks relays, connectors and mystery cables.
3. **Symbols are a language.** A switch symbol shows a lever hinged at the pole, resting near a throw. A battery is
   long and short lines, long for positive. An LED is a triangle pointing the way conventional current flows, with
   two tiny arrows for light. A resistor is a zigzag, or a small rectangle in many countries.
4. **Dots and crossings.** On a schematic, two lines that cross without a dot are not connected: one wire just passes
   over the other. A dot means a real junction. Careful drawers avoid four-way junctions and use two offset T-shapes,
   so a faint dot can never be misread.

**Quiz**

- **q1** `numeric`: "A switch has 4 pins. How many different pairs can you test?" answer 6, unit (none), tolerance 0.
  - explain: "4 × 3 ÷ 2 = 6. Each pair counted once." hint: "Each pin pairs with every other pin; don't count A-B and B-A twice."
- **q2** `choice`: "Two lines cross on a schematic with no dot. Are those wires connected?"
  - "Yes, any touching lines connect": "Crossing lines only connect where a dot is drawn."
  - (correct) "No, one passes over the other": "No dot, no connection."
  - "Only if they're the same colour": "Schematic meaning never depends on colour."
  - explain: "The dot is the junction. No dot means the wires just cross."
- **q3** `match`: "Match the symbol to the part." (Figures drawn by us.) Long and short parallel lines → battery ·
  Triangle with bar and two small arrows → LED · Zigzag → resistor · Hinged lever near a contact → switch.
  - explain: "These four symbols appear in almost every circuit you'll see in this unit."
- **q4** `choice`: "In your continuity log, pin 3 beeps with pin 1 in one position and with pin 5 in the other. Pins 1
  and 5 never beep together. What is pin 3?"
  - (correct) "A pole": "It always connects to one throw or the other."
  - "A throw": "A throw beeps in only one position."
  - "A broken pin": "A broken pin wouldn't beep at all."
  - explain: "The pin that changes partners when you slide is the pole."
- **q5** `choice`: "What does a dashed line between two switch symbols mean?"
  - "They are wired together": "Electrically they stay separate."
  - (correct) "One actuator moves both": "It's a mechanical link, like two oars locked together."
  - "One of them is optional": "Optional parts aren't shown with dashed links."
  - explain: "Dashed lines on switches and relays show mechanical linkage, not wiring."

**Wrap**

- Rules: "Test every pair in every position, then let the pattern decide." · "No dot, no connection." · "A dashed line
  between switches means one actuator, separate circuits."
- Try it for real: parts: a multimeter, any multi-pin switch from an old gadget. Safety: "Unplug and remove batteries
  from anything before you take a switch out of it."

**Mascot lines:** "Fifteen pairs. We have time. We have beeps." · "No label? No problem. Patterns don't lie." · "I'll
hold the probe. You hold the pencil."

---

#### Lesson 3. `stairway-light`: Either Switch, Any Time

- **Summary:** Wire two SPDT switches so either one flips the same light, and meet your first truth table.
- **Minutes:** 12 · **Prerequisites:** `mystery-switch`.
- **Objectives:**
  - Wire two switches in series and see that only one combination conducts.
  - Wire a two-way (stairway) circuit with two traveler wires and explain why any flip toggles the light.
  - Fill a truth table and recognise the "same" and "different" patterns.
- **Unlocks:** parts `[]` · isle `led-lamp`

**Hook**

> Picture a long staircase with one light. You switch it on at the bottom, climb up, and now you want it off from the
> top. Two switches, one lamp, and either switch must work no matter what the other one did. Electricians solve this
> every day with two ordinary SPDT switches and two wires. Can you work out the trick before you see it?

Predict: "Two switches control one lamp. Upstairs flips, then downstairs flips. If the lamp started off, how does it
end?" Options: "On" · "Off" · "Depends on the wiring".

**Lab `stairway-light`**

- Board: none. Instruments: meter.
- Initial parts:
  - `B1` battery (standard).
  - `R1` resistor `{a: vcc, b: r1b}`, 470 Ω.
  - `D1` led `{anode: r1b, cathode: ledk}`, color red.
  - `SA` spdt `{com: ledk, a: a1, b: a2}`, `SB` spdt `{com: gnd, a: b1, b: b2}`, both `to: "a"`.
  - Pre-wired by test leads: `vcc` through `R1` and `D1` to the pole of `SA`; the pole of `SB` to `gnd`. All four
    throws are free for the learner to wire.
- Tray: four test leads (wire), meter.
- Tasks:
  1. `series-pair`. Prompt: "Clip one lead from throw `A1` to throw `B1`. Try all four switch combinations and fill the
     table." Goal: truth table panel (LAB NEEDS: auto truth table that logs SA, SB and D1 lit) has all 4 rows, exactly
     one row lit. Hints: "Only one path exists, and both switches must line up on it." / "Flip one switch at a time."
     Success: "Exactly one combination lights the lamp. That's two switches in series: both must agree to one path."
  2. `two-travelers`. Prompt: "Add a second lead from `A2` to `B2`. Now try all four combinations again." Goal: table
     shows 2 lit rows (both up or both down), and from any state a single flip toggles `D1`. Hints: "Each pair of throws
     gets its own wire. Those two wires are called travelers." / "Watch the current path: it travels along whichever
     traveler both poles touch." Success: "Any single flip changes the lamp. That's the stairway trick."
  3. `cross-the-travelers`. Prompt: "Swap the travelers so `A1` goes to `B2` and `A2` goes to `B1`. What changes?" Goal:
     table shows lit rows exactly when the switches differ. Hints: "Predict first, then flip." Success: "Still a perfect
     stairway, but now 'different' means on. Both versions toggle on every flip."
- Damage moments: if the learner clips a lead from `vcc` straight to a throw that `SB` grounds, the battery is shorted:
  `shorted` event, battery warms. The robot explains, nothing dies. If the learner bypasses `R1`, `D1` dies (Unit 1 callback).
- Notice: the stairway circuit computes "same" or "different": the first logic function of the course.

**Explain**

1. **Series means AND.** With one wire between the switches there's a single road: switch A must point at it *and*
   switch B must point at it. One row of four lights up. Hold onto that "and". In Unit 4 you'll meet it again as a
   chip called an AND gate.
2. **Two travelers.** Give each pair of throws its own wire and there are two roads. The lamp is on whenever both poles
   pick the same road. Flip either switch and that pole jumps to the other road, so the lamp changes state. That's why
   either switch always works. Widget idea: `stairway-sim` (a two-storey stairwell where you flip switches and see the
   current take one traveler).
3. **Truth tables.** A truth table lists every combination of inputs and the output for each. Two switches give
   2 × 2 = 4 rows. Your stairway produced "on when they match" or, with crossed travelers, "on when they differ".
   Logic designers call those XNOR and XOR. You just built one with your hands.
4. **Names around the world.** In North America this is called three-way switching, because each switch has three
   terminals. In the UK and many other places it's called two-way switching. Same circuit, different counting. Need
   a third switch on a middle landing? Electricians add an intermediate switch that swaps the two travelers over, and
   any number of those can sit between the two ends.

**Quiz**

- **q1** `choice`: "A stairway light is on. You flip the upstairs switch, then the downstairs switch. Now the light is..."
  - "On, then off": "It does go off after the first flip, but there's a second flip."
  - (correct) "On": "Two flips, two toggles: back where it started."
  - "Off": "Each flip toggles it. Two toggles cancel out."
  - explain: "Every single flip toggles the lamp, so an even number of flips leaves it as it was."
- **q2** `numeric`: "How many rows does a truth table need for three switches?" answer 8, tolerance 0.
  - explain: "Each switch doubles the combinations: 2 × 2 × 2 = 8." hint: "Two switches gave 4."
- **q3** `choice`: "Your stairway works from the bottom switch but the top switch only works half the time. What's the
  most likely wiring fault?"
  - (correct) "One traveler is missing": "With one traveler you're back to a series pair, where only one combination conducts."
  - "The LED is reversed": "Then it would never light."
  - "The battery is weak": "A weak battery dims the LED but doesn't change which switch works."
  - explain: "A stairway needs both travelers. Lose one and some flips stop working."
- **q4** `order`: "Put the current's path in order for the lit state (switches both on throw 1)." Items: battery
  positive → resistor → LED → switch A pole → traveler 1 → switch B pole → battery negative.
  - explain: "Conventional current leaves the positive terminal, passes the resistor and LED, then rides whichever
    traveler both poles touch."
- **q5** `choice`: "Two switches in series with a lamp. Which description fits?"
  - (correct) "Lamp on only when A and B are both closed": "One road, two gates, both must be open."
  - "Lamp on when either is closed": "That's two switches in parallel."
  - "Lamp toggles on every flip": "That's the stairway circuit."
  - explain: "Series switches give AND; parallel switches give OR."

**Wrap**

- Rules: "Switches in series: all must close (AND)." · "Switches in parallel: any can close (OR)." · "Two SPDT switches
  with two travelers let either one toggle a lamp." · "A truth table lists every input combination and its output."
- Try it for real: parts: two SPDT slide switches, 9 V battery and snap, 470 Ω resistor, red LED, five test leads.
  Safety: "Build this at 9 V only. Real stair lights use mains wiring: leave that to electricians."

**Mascot lines:** "Upstairs, downstairs, any switch, any time." · "You just built a logic gate. With your hands. I'm
impressed." · "Four rows, one truth. Tables never get tired."

**Module M1 landmark:** see section 4 (`switchyard`).

---

### Module M2: Relays (`relays`)

Landmark: `relay-clocktower`. Prerequisite: M1.

#### Lesson 4. `meet-the-relay`: A Switch Flipped by a Magnet

- **Summary:** Find the coil and the contacts of an unlabeled relay, and hear it switch for the first time.
- **Minutes:** 10 · **Prerequisites:** `stairway-light`.
- **Objectives:**
  - Explain a relay as a coil (electromagnet) that moves a switch.
  - Identify coil pins with the ohm range and COM, NC and NO with continuity.
  - State that the coil side and the contact side are electrically separate.
- **Unlocks:** parts `[relay]` · isle `relay`

**Hook**

> So far your finger has done all the switching. What if a current could do it instead? Wrap wire around a bit of iron,
> push current through, and the iron becomes a magnet strong enough to tug a springy contact across. That's a relay:
> a switch flipped by a magnet you can turn on and off. The robot has one with five pins and no labels. Time to find
> out which pin does what.

Predict: "A relay is a switch moved by a magnet. Will current from the magnet's coil flow through the switch contacts?"
Options: "Yes, it's all one circuit" · "No, they're separate" · "Only when the relay clicks".

**Lab `meet-the-relay`**

- Board: none. Instruments: meter.
- Initial parts:
  - `K1` relay `{coilA: k1a, coilB: k1b, com: kc, no: kno, nc: knc}`, `coilOhms: 540`, `pullIn: 6.0`, `dropOut: 1.8`.
    Mystery skin: the five legs are labeled 1 to 5 and the leg-to-node order is shuffled per learner (BENCH NEEDS).
  - `B1` battery (standard). `S1` pushbutton `{a: vcc, b: sw}`. Lead from `B1` negative parked, lead from `sw` parked.
- Tray: two test leads.
- Tasks:
  1. `find-the-coil`. Prompt: "Set the meter to the 2 kΩ range and measure between pairs of legs. One pair reads a few
     hundred ohms. Tag it as the coil." Goal: coil legs tagged correctly. Hints: "Contacts read either almost 0 Ω or OL.
     The coil is a long thin wire, so it reads somewhere in between." / "Ten pairs is all there is. Sweep them."
     Success: "About 540 Ω. That's a long coil of very thin copper." Notice: the coil reads the same either way round.
  2. `find-com-nc`. Prompt: "Switch to continuity. With the relay resting, which pair beeps?" Goal: learner tags the
     beeping pair as "COM + NC (order unknown)". Hints: "Leave the coil legs out of it." Success: "One pair is already
     connected at rest. That's the normally closed contact and the common. Which one is which? We need the magnet."
  3. `energize`. Prompt: "Clip the leads so `S1` connects the battery to the coil. Hold the button and probe again."
     Goal: K1 `clicked` event seen, and final pin map (coil A/B, COM, NO, NC) submitted correctly. Hints: "Listen for
     the click." / "COM is the leg that beeps with one partner at rest and a different partner while you hold the
     button." Success: "A double-throw switch inside a box, flipped by electricity. Nothing on the coil side ever
     touches the contact side."
- Damage moments: clipping the battery across COM and NC (closed at rest) shorts it: `shorted` event, battery warms,
  robot explains "those two legs are joined inside, so that was a wire across the battery".
- Notice: the coil and the contacts never beep with each other. That separation is why relays are so useful.
- BENCH NEEDS: relay x-ray and exploded views (coil, iron core, armature, contact strips); click sound on `clicked` with
  a softer sound on release.

**Explain**

1. **An electromagnet.** Current flowing through a coil of wire makes a magnetic field. Wind the coil around iron and
   the field gets much stronger. Turn the current off and the magnetism mostly vanishes. A relay uses that magnet to
   pull a small iron lever, the armature, which pushes springy contacts from one position to another. Widget idea:
   `relay-xray` (press a button and watch the armature swing in slow motion).
2. **Two worlds in one box.** The coil side is the control side. The contact side is the switched side. They share a
   box but not a single wire. A relay with a 9 V coil can switch a circuit running from a different battery, or even
   one at a different voltage. That separation is called isolation.
3. **COM, NO, NC.** Inside is an SPDT switch. COM is the pole. NC (normally closed) touches COM when the coil is off. NO
   (normally open) touches COM only while the coil is on. Many relays have two of these sets moved together (DPDT).
   Schematics always draw relays at rest, coil off.
4. **Where relays live.** A car's starter motor needs about 100 A, far too much for the key switch. The key powers a
   relay's small coil, and the relay's chunky contacts handle the big current. Washing machines, fridges and heating
   systems are full of relays doing the same job.

**Quiz**

- **q1** `choice`: "You measure pairs on an unknown relay. Which reading is most likely the coil?"
  - "0.2 Ω": "That's a closed contact: almost no resistance."
  - (correct) "520 Ω": "A coil of thin wire has a few hundred ohms."
  - "OL": "OL means no connection, like an open contact."
  - explain: "Contacts read near zero or OL. A small relay coil reads hundreds of ohms."
- **q2** `choice`: "The meter beeps on COM and NC. You energize the coil. What happens?"
  - (correct) "The beeping stops": "The pole leaves NC and moves to NO."
  - "The beep gets louder": "Continuity is just yes or no."
  - "Nothing changes": "If nothing changed, the relay isn't pulling in."
  - explain: "Energizing the coil moves COM from NC to NO."
- **q3** `choice`: "A relay schematic shows COM resting on NC. Is the coil powered?"
  - (correct) "Not necessarily: symbols always show the resting state": "Relays are drawn with the coil off."
  - "Yes": "Schematics never show a relay pulled in."
  - explain: "Drawings show relays relaxed. You have to read the circuit to know when the coil is on."
- **q4** `match`: "Match the relay term to its meaning." COM → the moving contact (pole) · NC → connected to COM when
  the coil is off · NO → connected to COM when the coil is on · Coil → the electromagnet that does the moving.
  - explain: "Those four names are printed on most relay datasheets."
- **q5** `choice`: "Why use a relay to start a car instead of running the starter current through the key switch?"
  - "Relays are cheaper than switches": "Not the reason; it's about current."
  - (correct) "A small current in the coil can control a huge current in the contacts": "The key only carries the coil's small current."
  - "The relay makes extra current": "Relays switch current; they don't create it."
  - explain: "Relays let a small, safe control current switch a large one."

**Wrap**

- Rules: "A relay is a switch moved by an electromagnet." · "Coil side and contact side are electrically separate." ·
  "COM touches NC at rest and NO when energized." · "Schematics show relays at rest."
- Try it for real: parts: a small 9 V DC relay, 9 V battery and snap, pushbutton, multimeter, test leads. Safety: "Keep
  relay experiments at battery voltages. Never connect relay contacts to mains."

**Mascot lines:** "Hear that click? That's a magnet doing your job." · "Two worlds, one box, zero shared wires." · "At
rest, COM hugs NC. Energized, it switches partners."

---

#### Lesson 5. `relay-thresholds`: Click In, Click Out

- **Summary:** Switch two LEDs with a relay, then find the exact voltages where it pulls in and lets go.
- **Minutes:** 10 · **Prerequisites:** `meet-the-relay`.
- **Objectives:**
  - Wire a changeover so a relay chooses between two loads, powered from a separate battery.
  - Measure pull-in and drop-out voltages and explain why they differ (hysteresis).
  - Read relay datasheet terms: coil voltage, coil resistance and current, must-operate, must-release, contact rating.
- **Unlocks:** parts `[led-green, led-yellow, potentiometer]` · isle `wire-spool`

**Hook**

> A relay doesn't care how gently you ask. Below a certain coil voltage, nothing. Above it, a confident click. But here's
> the odd part: once it has clicked, you can turn the voltage way down and it still hangs on. Why would a switch need
> more push to start than to stay? Grab a knob and find out exactly where those two points are.

Predict: "The relay clicks on at about 6 V. As you turn the voltage back down, where will it let go?" Options: "Also
about 6 V" · "Somewhere well below 6 V" · "Above 6 V".

**Lab `relay-thresholds`**

- Board: none. Instruments: meter.
- Initial parts:
  - `B1` battery (standard) for the coil side. `B2` battery `{pos: v2, neg: g2}`, emf 9, internalOhms 1.5, for the LED side.
  - `K1` relay `{coilA: k1a, coilB: gnd, com: kc, no: kno, nc: knc}`, 540 Ω, pullIn 6.0, dropOut 1.8 (per-instance ±5%).
  - `S1` pushbutton `{a: vcc, b: k1a}`.
  - `R2` 470 Ω, `D2` led yellow, `R3` 470 Ω, `D3` led green, placed but unclipped.
- Tray: test leads, `P1` pot (panel knob) 1 kΩ.
- Tasks:
  1. `changeover`. Prompt: "Using only battery B2, make the yellow LED light when the relay rests and the green LED light
     while you hold S1." Goal: `kc` connected to `v2`; with S1 released D2 lit and D3 dark; with S1 held D3 lit and D2
     dark. Hints: "COM gets the B2 positive. Each throw feeds one LED through its own resistor." / "Both LEDs return to
     B2's negative terminal." Success: "The relay chooses which LED gets B2's power. And B2 never touches B1." Notice:
     two separate batteries, one magnetic link.
  2. `find-pull-in`. Prompt: "Swap S1 for the knob P1 wired as a voltage divider (ends to B1, middle to the coil). Put
     the meter across the coil. Turn the knob up slowly until the relay clicks. What did the meter read?" Goal: learner
     entry within ±0.3 V of the instance `pullIn`, and a `clicked` event occurred. Hints: "Turn in small steps; the click
     is sudden." / "Write down the reading the moment you hear the click." Success: "That's the pull-in voltage. Below
     it the magnet is too weak to move the armature."
  3. `find-drop-out`. Prompt: "Now turn the knob down slowly. When does it let go?" Goal: learner entry within ±0.3 V of
     the instance `dropOut`. Hints: "It holds on much longer than you'd expect. Keep going." Success: "Pull-in about 6 V,
     drop-out under 2 V. Starting takes a lot more push than staying."
- Damage moments: none planned.
- Notice: the gap between the two numbers is hysteresis. It stops the relay chattering when the voltage wobbles near
  one threshold.
- SIM NEEDS: relay state machine with separate pull-in and drop-out thresholds (contract fields exist), per-instance
  spread, operate time about 4 ms and release time about 3 ms (see section 9).

**Explain**

1. **Why the gap?** A magnet's pull gets much stronger as the gap to the iron shrinks. To start, the coil must tug the
   armature across a wide air gap. Once the armature is pulled in, the gap is tiny, so a weak current holds it. That
   difference gives the relay two thresholds. Widget idea: `hysteresis-loop` (sweep the coil voltage up and down and
   trace the closed and open states).
2. **Hysteresis is a feature.** Imagine a single threshold at 6 V and a supply wobbling between 5.9 V and 6.1 V. The
   relay would click on and off like a nervous woodpecker. Two thresholds far apart mean a small wobble can't flip it.
   You'll meet the same idea in thermostats and in chips in Unit 4.
3. **Reading a relay datasheet.** Coil voltage: the voltage it's designed for, say 9 V. Coil resistance and current:
   540 Ω draws about 16.7 mA at 9 V, about 150 mW. Must-operate voltage: the highest voltage it might need to pull in,
   often 75% of the rated value. Must-release voltage: below this it's guaranteed to let go, often 10%.
4. **Contact ratings.** Contacts have their own limit, such as 2 A at 30 V DC. That number usually assumes a plain
   resistive load. Motors and lamps draw a surge when they start, so leave plenty of margin. A relay with a 9 V coil
   can switch a 24 V circuit as long as the contacts are rated for it.

**Quiz**

- **q1** `numeric`: "A 12 V relay coil measures 400 Ω. What current does it draw at 12 V?" answer 30, unit mA,
  tolerance 3. hint: "I = V ÷ R." explain: "12 V ÷ 400 Ω = 0.03 A = 30 mA. Its power is 12 V × 0.03 A = 0.36 W."
- **q2** `choice`: "A relay pulled in at 6.1 V and let go at 1.7 V. Which statement is true?"
  - (correct) "It's working normally": "Drop-out is always well below pull-in. That's hysteresis."
  - "It's faulty: the two should match": "A gap between them is designed in."
  - "The meter is broken": "Both readings are typical for a 9 V relay."
  - explain: "Pulling in needs more magnetic force than holding, because the air gap is wider at rest."
- **q3** `choice`: "Which relay type keeps its position with no power at all?"
  - "A normally closed relay": "NC still springs back when the coil is off."
  - (correct) "A latching relay": "It stays where the last pulse put it."
  - "Any DPDT relay": "Two poles don't change the holding behaviour."
  - explain: "Latching relays use a magnet or a mechanical catch, so a short pulse sets or resets them."
- **q4** `match`: "Match the datasheet term to its meaning." Coil voltage → the voltage it's designed to run on ·
  Must-operate voltage → the voltage that guarantees a pull-in · Must-release voltage → the voltage below which it's
  guaranteed to let go · Switching capacity → the most current the contacts can safely carry.
  - explain: "These four lines tell you how to drive a relay and what it can switch."
- **q5** `choice`: "Can a relay with a 9 V coil switch a 24 V lamp circuit?"
  - (correct) "Yes, if the contacts are rated for it": "Coil and contacts are isolated; check the contact rating."
  - "No, only 9 V circuits": "The coil voltage only describes the control side."
  - "Only with a second relay": "One relay is enough."
  - explain: "The contact rating decides what the relay can switch, not the coil voltage."

**Wrap**

- Rules: "A relay pulls in at one voltage and drops out at a much lower one." · "Hysteresis stops chattering." · "Coil
  ratings describe the control side; contact ratings describe the switched side." · "Leave margin for loads that surge."
- Try it for real: parts: 9 V relay, two 9 V batteries, 1 kΩ potentiometer, two LEDs, two 470 Ω resistors, meter.
  Safety: "Keep both circuits at battery voltage."

**Mascot lines:** "Starting is hard. Staying is easy. Relays and I agree." · "Turn slowly. The click is sneaky." · "Two
batteries, one magnet. No wires between them."

---

#### Lesson 6. `coil-kickback`: The Coil Kicks Back

- **Summary:** Catch the voltage spike a coil makes when you switch it off, and tame it with a diode.
- **Minutes:** 12 · **Prerequisites:** `relay-thresholds`.
- **Objectives:**
  - Observe that interrupting a coil's current produces a large reverse voltage spike.
  - Explain the spike as the coil's stored magnetic energy trying to keep current flowing.
  - Place a protection diode correctly (band toward positive) and explain why it's reverse-biased in normal use.
  - Know the diode as a one-way valve: anode, cathode, band.
- **Unlocks:** parts `[diode-1n4001, scope]` · isle `diode`

**Hook**

> A coil has a stubborn streak. While current flows, it builds a magnetic field and stores a little energy there. Cut
> the current suddenly and that energy has to go somewhere, right now. The coil will push as hard as it takes to keep
> the current moving, even if that means hundreds of volts from a 9 V battery. Today you get an oscilloscope to watch
> it happen, and a tiny part that tames it.

Predict: "You switch off a relay powered by 9 V. What's the biggest voltage you'd expect across its coil?" Options:
"9 V" · "About 0 V" · "Much more than 9 V".

**Lab `coil-kickback`**

- Board: none. Instruments: meter, scope (BENCH NEEDS: 2-channel oscilloscope with single-shot trigger and time base
  down to 100 µs per division).
- Initial parts:
  - `B1` battery (standard). `S1` pushbutton `{a: vcc, b: k1a}`.
  - `K1` relay `{coilA: k1a, coilB: gnd, com: vcc, no: kno, nc: knc}`, 540 Ω, pullIn 6.0, dropOut 1.8.
  - Scope channel 1 clipped to `k1a`, ground clip on `gnd`, trigger on falling edge.
- Tray: `D2` led red, `D3` diode 1N4001.
- Tasks:
  1. `watch-the-spike`. Prompt: "Press and release S1 a few times and watch the scope at the moment you let go."
     Goal: a release captured with min V(`k1a`) below -50 V, and a `spark` event on `S1`. Hints: "Set the trigger to
     catch the falling edge." / "The spike is very short. Use the 1 ms per division setting." Success: "Hundreds of
     volts, pointing the wrong way, from a 9 V battery. And a spark jumped across the button's contacts." Notice: the
     button's contacts wear a little each time (wear counter visible in x-ray).
  2. `led-catcher`. Prompt: "Put the red LED across the coil, backwards: its cathode on the coil's top end, its anode on
     ground. Press and release again." Goal: D2 dark while held (glow < 0.05), D2 blip on release (peak glow > 0.1),
     scope min above -5 V. Hints: "Backwards means the LED's long leg goes to ground." / "Watch the LED at the moment
     you let go." Success: "The LED flashes when you let go, from current the coil pushed after the battery left. Your
     spike is gone." Notice: energy stored in the coil lit the LED.
  3. `diode-clamp`. Prompt: "Swap the LED for the 1N4001 diode, band toward the coil's positive end." Goal: after a
     release, min V(`k1a`) ≥ -1.2 V and no `spark` events on that release; K1 still clicks in and out. Hints: "The band
     marks the cathode. It goes to the side that's positive when the button is pressed." Success: "Clamped to under a
     volt. This diode lives across almost every relay coil in the world."
- Damage moments: if the LED or diode goes in forwards, pressing S1 puts the battery straight across it. The LED dies
  instantly; the diode gets hot and the battery is `shorted`. Robot: "Forwards, it's a shortcut around the coil. It has
  to face backwards."
- SIM NEEDS: coil inductance on `relay` (optional `coilHenries`, default about 0.3 H, see section 9); contact arc model
  so opening a coil circuit with no clamp produces a bounded spike (breakdown about 300 V), a new `spark` event and
  contact wear; LED perception that makes a sub-millisecond 15 mA pulse visible as a short blip.

**Explain**

1. **Coils resist change.** Current in a coil builds a magnetic field, and building it takes a moment. Collapsing it
   does too. While the field collapses, it drives current onward in the same direction. If the circuit is open, that
   current has nowhere to go, so the voltage climbs until something conducts: air at a spark, or a fragile transistor.
   Widget idea: `kickback-scope` (slow-motion replay of current and voltage at switch-off).
2. **How big?** The voltage a coil makes is its inductance times how fast the current changes. Inductance is measured in
   henries. A relay coil might be 0.3 H. Drop 17 mA to zero in 10 µs and the coil produces about 500 V. Faster switching
   means a bigger spike, which is why the spike is worst exactly when the switch is good.
3. **The diode: a one-way valve.** A diode lets conventional current flow from its anode to its cathode and blocks the
   other way. The band marks the cathode. Silicon diodes like the 1N4001 drop about 0.7 V when they conduct and handle
   1 A. On a schematic it's a triangle pointing at a bar: the arrow shows the direction current may flow.
4. **Why the diode faces backwards.** Placed with its band toward positive, the diode is reverse-biased while the coil
   is powered, so it does nothing. At switch-off the coil's voltage flips, the diode conducts, and the coil's current
   circles through it until the energy is used up. The spike is clamped to about 0.7 V. The relay just lets go a few
   milliseconds later.

**Quiz**

- **q1** `numeric`: "A 0.5 H coil carries 20 mA. A switch stops that current in 10 µs. Using V = L × (change in current
  ÷ time), how big is the spike?" answer 1000, unit V, tolerance 5. hint: "Change in current is 0.02 A; time is
  0.00001 s." explain: "0.5 × 0.02 ÷ 0.00001 = 1,000 V. Real circuits spark or break down before it gets that high."
- **q2** `hotspot` (3D relay with a diode across its coil): "Tap where the diode's band should face." Target: the coil
  end connected to the positive supply.
  - explain: "Band toward positive keeps the diode reverse-biased in normal use, ready to catch the kickback."
- **q3** `choice`: "Why doesn't the protection diode waste current while the relay is on?"
  - (correct) "It's reverse-biased, so it blocks": "Current only flows through it when the coil's voltage flips."
  - "It's too small to matter": "Size isn't the reason; direction is."
  - "It does waste some, but only a little": "A reverse-biased silicon diode passes almost nothing."
  - explain: "In normal use the diode points against the supply. It only conducts during the kickback."
- **q4** `order`: "Put these in order after you release the button (with a diode fitted)." Items: button contacts open →
  coil's field starts to collapse → coil voltage flips → diode conducts → current circles through the diode and fades →
  relay lets go.
  - explain: "The diode gives the coil's current a loop to fade in, instead of a spark."
- **q5** `choice`: "You fit the diode the wrong way round and press the button. What happens?"
  - "The relay clicks a bit slower": "Wrong way round, it's not across the coil's kickback any more; it's across the supply."
  - (correct) "It shorts the battery through the diode": "Forward-biased, it's a low-resistance path straight across the supply."
  - "Nothing, diodes work both ways": "Diodes are one-way by design."
  - explain: "Backwards is right. Forwards, the diode conducts the moment the button closes."
- **q6** `choice`: "Which end of a diode is the cathode?"
  - (correct) "The end with the band": "The band marks the cathode, matching the bar in the symbol."
  - "The longer lead": "That's the LED rule for the anode, and diodes usually have equal leads."
  - "The end without the band": "That's the anode."
  - explain: "Band equals bar equals cathode."

**Wrap**

- Rules: "A coil switched off makes a reverse voltage spike." · "Put a diode across every relay coil, band toward
  positive." · "Diodes pass current from anode to cathode; the band marks the cathode." · "Faster switching makes bigger spikes."
- Try it for real: parts: 9 V relay, 1N4001 diode, red LED, pushbutton, 9 V battery. Safety: "At 9 V the kickback can
  give a small sting if you hold the coil's leads while switching. Keep fingers off the coil terminals."

**Mascot lines:** "That spark was the coil saying 'not so fast!'" · "Backwards diode, happy coil." · "Band toward
positive. Say it with me." · "The LED glowed with leftover magnetism. Spooky, right?"

**Module M2 landmark:** see section 4 (`relay-clocktower`).

---

### Module M3: The breadboard and a self-switching relay (`breadboard`)

Landmark: `breadboard-plaza`. Prerequisite: M2.

#### Lesson 7. `breadboard-inside`: X-Ray the Breadboard

- **Summary:** See the hidden metal strips inside a breadboard, fix three classic mistakes, and move a relay circuit onto it.
- **Minutes:** 12 · **Prerequisites:** `coil-kickback`.
- **Objectives:**
  - Know which holes are joined: 5-hole strips on each side of the channel, and long power rails.
  - Find and fix a part shorted by sitting in one strip, and a dead half caused by split rails.
  - Translate a schematic into a breadboard layout, with parts straddling the channel.
- **Unlocks:** parts `[breadboard, jumper-wires]` · isle `breadboard-patch`

**Hook**

> Clip leads are great for three parts. At ten parts they turn into spaghetti. A breadboard is a plastic block full of
> holes, and hidden underneath are rows of springy metal clips that join some holes together. Push a leg in and it's
> connected. No tools, no mess, and you can rearrange everything in seconds. The catch? You have to know which holes are
> secretly holding hands. Let's switch on the x-ray.

Predict: "Do all the holes in one long row of a breadboard connect to each other?" Options: "Yes, the whole row" · "Only
small groups of holes" · "None of them connect".

**Lab `breadboard-inside`**

- Board: breadboard (830 points: 63 rows × 2 sides × 5 holes, plus 4 rails). Instruments: meter.
  BENCH NEEDS: x-ray toggle showing clips, hover highlight of a hole's whole net, optional split-rail variant.
- Initial parts:
  - `B1` battery (standard), clipped to the top-left red (+) and blue (-) rails with two short jumpers.
  - Station A: `R1` 470 Ω and `D1` red LED placed correctly (lit) for reference.
  - Station B: `R2` 470 Ω from + rail to row 20a; `D2` red LED with anode in 20b and cathode in 20d (same strip, dark);
    jumper from 21e to - rail.
  - Station C (lower half, rails split at row 32 in this variant): `R3` 470 Ω and `D3` LED in rows 45 to 47, wired to the
    lower rails, dark because the lower rails are not fed.
- Tray: jumper wires (red, blue, green, yellow), `K1` relay (breadboard footprint), `S1` pushbutton, `D4` diode
  1N4001, `R4` and `R5` 470 Ω, `D5` led yellow, `D6` led green.
- Tasks:
  1. `xray-hunt`. Prompt: "Switch on x-ray. Tap hole 12a, then tap every hole you think is connected to it. Check your
     guess." Goal: learner's selection equals the true net of 12a (12a to 12e). Hints: "Look at the metal clip under row
     12 on this side of the channel." / "The channel down the middle is a wall." Success: "Five holes per clip, and the
     clip stops at the channel."
  2. `fix-dark-led`. Prompt: "The LED at station B is dark. Fix it by moving one leg." Goal: `D2` lit, its anode and
     cathode in different nets. Hints: "Both of D2's legs are in row 20. What does that clip do to them?" / "Move the
     cathode to row 21, where the jumper to the - rail starts." Success: "Both legs in one strip means the strip shorts
     the LED. Every part needs its legs in different strips."
  3. `bus-gap`. Prompt: "Station C is dead. The meter will tell you why." Goal: two jumpers bridge the rail gap at row
     32 (red to red, blue to blue) and `D3` lights. Hints: "Measure the voltage between the + and - rails at row 10, then
     at row 50." / "Some boards split each rail halfway. Look for a gap in the printed stripe." Success: "Split rails are
     a classic trap. A bridge jumper and the lower half wakes up."
  4. `relay-on-board`. Prompt: "Rebuild the relay changeover on the board, with one battery: COM to +, yellow LED on NC,
     green LED on NO, the button feeding the coil, and the diode across the coil." Goal: K1 straddles the channel (no
     two relay pins in one net), D5 lit at rest, D6 lit while S1 is held, D4 band toward the coil's positive end.
     Hints: "The relay's pins sit on both sides of the channel so each pin gets its own strip." / "Build it from the
     schematic one wire at a time, ticking each connection off." Success: "Your first proper breadboard build. Neat,
     solid, and ready to be modified."
- Damage moments: a relay placed along a strip instead of across the channel shorts COM to NC and NO together (both
  LEDs on), and may join the coil to + directly. A part bridging + and - rails directly gives `shorted`.
- Notice: the length of the path through strips doesn't matter; the strips have almost no resistance.

**Explain**

1. **What's under the holes.** Each side of the center channel has rows of five holes joined by one metal clip. Rows are
   numbered, holes within a row are lettered (a to e on one side, f to j on the other). The long rails along the edges
   join every hole in their stripe. Use red for + and blue or black for -, and keep that habit forever. Widget idea:
   `breadboard-xray` (tap any hole, see its whole net light up).
2. **Why the channel?** The gap down the middle is the width of a chip. Parts with two rows of legs, like chips and our
   relay, sit across it so that every leg gets its own strip. Anything placed along a strip instead has all those legs
   shorted together.
3. **Three classic bugs.** Two legs of one part in the same strip: the part is bypassed. A rail with a hidden gap halfway:
   the bottom half is dead. A leg one hole off: it lands in the neighbouring strip and joins the wrong net. When
   something's dark, measure the rails first, then check each part's legs.
4. **Wires that stay put.** Breadboards like solid-core wire about 0.6 mm thick (22 AWG). Stranded wire frays and
   flexible jumpers with pins can hide a bad contact. Cut jumpers to length and lay them flat: when a circuit misbehaves
   you'll be able to see every connection at a glance.

**Quiz**

- **q1** `hotspot` (top-down breadboard): "Tap every hole connected to hole 30c." Target: 30a to 30e.
  - explain: "Hole 30c shares a clip with the other four holes of row 30 on its side of the channel."
- **q2** `choice`: "An LED's legs are in holes 12a and 12d. Why is it dark?"
  - (correct) "Both legs are in the same strip, so it's shorted": "The clip joins 12a to 12d, so no voltage reaches across the LED."
  - "The LED is backwards": "Possible in general, but here both legs share a clip, so polarity doesn't even matter."
  - "Row 12 is broken": "Strips rarely fail. The layout is the problem."
  - explain: "Every part must bridge two different strips."
- **q3** `choice`: "Your circuit works at the top of the board but the bottom half is dead. What do you check first?"
  - (correct) "Whether the power rails are split halfway": "Many boards break the rails mid-board."
  - "Whether the resistors are too big": "That would dim things, not kill a whole region."
  - "The battery's age": "A flat battery would kill the top half too."
  - explain: "Measure rail voltage at both ends. A gap needs a bridge jumper."
- **q4** `choice`: "Does a longer route through more strips and jumpers add noticeable resistance?"
  - "Yes, every strip adds about 100 Ω": "Strips are metal clips with a tiny fraction of an ohm."
  - (correct) "No, it's negligible in these circuits": "Clips and jumpers are far below an ohm."
  - explain: "For battery circuits like ours, breadboard connections act like plain wire."
- **q5** `numeric`: "A full breadboard has 63 rows with two 5-hole strips per row, plus 4 rails of 50 holes. How many
  holes in total?" answer 830, tolerance 0. explain: "63 × 2 × 5 = 630, plus 4 × 50 = 200, total 830."

**Wrap**

- Rules: "Holes in a 5-hole strip are joined; the channel separates the two sides." · "Every part needs its legs in
  different strips." · "Check for split rails when half the board is dead." · "Red for +, blue or black for -."
- Try it for real: parts: an 830-point breadboard, 22 AWG solid hookup wire, wire strippers. Safety: "Strip wire with
  strippers, never your teeth. Keep clipped wire ends off the board: they cause shorts."

**Mascot lines:** "X-ray on. Now the breadboard has no secrets." · "Same strip, same node. The LED never stood a
chance." · "Bridge the gap and the lower half wakes up."

---

#### Lesson 8. `relay-buzzer`: A Relay That Switches Itself

- **Summary:** Feed a relay's coil through its own contact and it starts to buzz; a capacitor slows it to a steady tick.
- **Minutes:** 12 · **Prerequisites:** `breadboard-inside`.
- **Objectives:**
  - Explain self-interrupting feedback: switching on cuts off its own supply.
  - Use a capacitor across the coil to hold the relay in for a while, and predict how C changes the rhythm.
  - Recognise that contacts wear when they switch fast, and limit surge current with a resistor.
- **Unlocks:** parts `[electrolytic-capacitor]` · isle `jumper-arch`

**Hook**

> Your relay changeover works perfectly: press the button, the relay switches. Now for a mischievous idea. What if the
> relay's coil got its power through the relay's own normally closed contact? Switch on, the contact opens, the coil
> loses power, the contact closes again, and round it goes. One wire move turns a polite switch into something alive.
> Make the move and listen.

Predict: "The coil is fed through its own NC contact. What will the relay do?" Options: "Click once and stay on" ·
"Never click" · "Click on and off by itself".

**Lab `relay-buzzer`**

- Board: breadboard. Instruments: meter, scope.
- Initial parts (the learner's changeover from lesson 7, rebuilt by the lab):
  - `B1` battery (standard) to the rails. `S2` switch (power) `{a: vcc, b: vsw}`, closed false.
  - `K1` relay `{coilA: k1a, coilB: gnd, com: vsw, no: kno, nc: knc}`, 540 Ω, pullIn 6.0, dropOut 1.8.
  - `D1` diode 1N4001 `{anode: gnd, cathode: k1a}` (protection).
  - `R2` 470 Ω `{a: knc, b: y}`, `D2` led yellow `{anode: y, cathode: gnd}`.
  - `R3` 470 Ω `{a: kno, b: g}`, `D3` led green `{anode: g, cathode: gnd}`.
  - `S1` pushbutton `{a: vsw, b: k1a}` (the coil's feed, to be replaced by a jumper from NC).
- Tray: `C1` capacitor 1,000 µF polarized (volts 16), `C2` capacitor 470 µF polarized (volts 16), `R4` 100 Ω, jumpers.
- Tasks:
  1. `move-one-wire`. Prompt: "Remove S1 and feed the coil from the relay's NC contact instead. Then turn on S2."
     Goal: with S2 closed, at least 40 K1 `clicked` events within some 1 s window; D2 and D3 both read glow 0.15 to 0.85.
     Hints: "One jumper from the NC strip to the coil's top strip does it." / "If nothing happens, check the coil still
     has its ground." Success: "It buzzes! Each time it pulls in, it cuts its own power. Each time it lets go, the power
     returns." Notice: both LEDs look half lit because they swap too fast to see. Turn S2 off soon: the contacts are
     sparking and wearing.
  2. `tame-it`. Prompt: "Add the 1,000 µF capacitor across the coil: + leg on the coil's top strip, - leg (the striped
     side) to ground. Turn on S2." Goal: K1 toggles with a full period of 0.5 to 1.4 s for at least 3 cycles. Hints:
     "The stripe on the capacitor's sleeve marks its negative leg." / "The longer leg is positive." Success: "Tick, tock.
     The capacitor keeps the coil powered after the contact opens, so the relay stays in for most of a second."
  3. `soften-the-surge`. Prompt: "Every time NC closes, the empty capacitor gulps a big surge through the contacts. Put
     the 100 Ω resistor between NC and the coil to soften it." Goal: R4 in series between `knc` and `k1a`, K1 period 0.4
     to 1.3 s, and the yellow LED glows above 0.3 for at least 50 ms in each cycle. Hints: "NC to R4, R4 to the coil's
     top strip. Remove the direct jumper." Success: "Gentler on the contacts, and now the yellow LED gets a real blink
     while the capacitor refills."
  4. `faster-ticks`. Prompt: "Swap in the 470 µF capacitor. Predict first: faster or slower?" Goal: period 0.2 to 0.7 s.
     Success: "About half the capacitance, about half the hold time."
- Damage moments:
  - Leaving the relay buzzing for more than about 20 s in total wears the contacts out: K1 `died` (contacts stuck open),
    added to the Hall of Fried Parts as "relay: contacts worn out by buzzing". Robot: "It buzzed itself to bits. Real
    relays do that too. New one on the bench."
  - `C1` in backwards gets about -8 V: `reversed` event, then heats and vents after a few seconds (`died`).
- SIM NEEDS: relay operate and release delays (so the buzz sits around 50 to 150 Hz instead of at the solver step), an
  audible buzz synthesized from click events above about 30 per second, contact wear accumulating per spark and per
  switching event under surge, and an LED brightness average over about 30 ms so fast switching looks half bright.

**Explain**

1. **A switch that cuts its own power.** When the coil's supply passes through NC, success undoes itself: pulling in
   opens NC, which starves the coil, which lets the armature fall, which closes NC again. That loop is called negative
   feedback with a delay, and the delay is the armature's travel time, a few milliseconds. Hence a buzz. Old electric
   doorbells worked exactly this way.
2. **The capacitor as a reservoir.** While NC is closed, the capacitor fills almost instantly. When NC opens, the
   capacitor feeds the coil, its voltage sinking as the charge drains. The relay hangs on until the voltage falls below
   drop-out, then lets go and the cycle restarts. Widget idea: `relay-tank` (coil voltage over time with the pull-in
   and drop-out lines drawn across it).
3. **Estimating the tick.** The drain rate depends on the coil's resistance and the capacitance. Multiply them: 540 Ω ×
   1,000 µF = 0.54 s. Falling from 9 V to the 1.8 V drop-out takes about 1.6 of those, close to 0.9 s. Double the
   capacitance and the hold time doubles. You'll learn the curve properly in the next module.
4. **Contacts have a lifespan.** Each switching event under load sparks a little. A buzzing relay switches over a
   hundred times a second, so it ages fast. Inrush current into an empty capacitor is also harsh. A small series
   resistor softens the surge; a protection diode handles the coil's kickback.

**Quiz**

- **q1** `choice`: "Why does the relay buzz when its coil is fed through its own NC contact?"
  - (correct) "Pulling in cuts its own power, and letting go restores it": "Each state causes the other."
  - "The battery is too weak": "A weak battery would stop it, not start it."
  - "The relay is broken": "It's doing exactly what the wiring tells it."
  - explain: "Feedback through NC turns the relay into a self-interrupting switch."
- **q2** `choice`: "You add a large capacitor across the coil. The buzz becomes..."
  - "Faster": "The capacitor adds hold time, so each cycle gets longer."
  - (correct) "Slower": "The capacitor keeps the coil powered after NC opens."
  - "Silent forever": "It still cycles, just slowly."
  - explain: "Stored charge holds the relay in until it drains to drop-out."
- **q3** `numeric`: "Multiply coil resistance by capacitance: 540 Ω and 470 µF. What do you get, in seconds?" answer
  0.254, unit s, tolerance 3. hint: "470 µF is 0.00047 F." explain: "540 × 0.00047 = 0.254 s. That number sets how
  fast the capacitor drains through the coil."
- **q4** `choice`: "Which leg of an electrolytic capacitor goes to the more negative side?"
  - (correct) "The one by the stripe of minus signs, usually the shorter leg": "The sleeve stripe marks negative."
  - "The longer leg": "The longer leg is positive."
  - "Either, they're interchangeable": "Electrolytics are polarized; backwards they leak and can burst."
  - explain: "Stripe and short leg go toward negative."
- **q5** `order`: "Order one tick of the tamed relay, starting from 'NC closes'." Items: NC closes → capacitor refills →
  coil voltage passes pull-in → relay pulls in and NC opens → capacitor drains through the coil → voltage falls below
  drop-out → relay lets go.
  - explain: "Fill fast, drain slow, repeat. The drain sets most of the period."

**Wrap**

- Rules: "A relay fed through its own NC contact buzzes." · "A capacitor across the coil stretches each click: bigger C,
  slower ticks." · "Fast switching wears contacts out." · "Electrolytics have a negative stripe: respect it."
- Try it for real: parts: breadboard, 9 V relay, 1N4001, 1,000 µF and 470 µF electrolytics (16 V or more), 100 Ω,
  two LEDs with 470 Ω resistors, slide switch, 9 V battery. Safety: "Run the buzz only for a few seconds: it wears the
  relay. Check the capacitor's stripe before powering up."

**Mascot lines:** "It's alive! And slightly annoying." · "A capacitor is a little tank that keeps the coil fed." ·
"Buzzing too long wears the contacts out. Short bursts, please."

**Module M3 landmark:** see section 4 (`breadboard-plaza`).

---

### Module M4: Capacitors and time (`capacitors`)

Landmark: `capacitor-water-tower`. Prerequisite: M3.

#### Lesson 9. `capacitor-fill-fade`: Fill It, Watch It Fade

- **Summary:** Charge a capacitor through a resistor, watch an LED fade as it drains, and find out why both plates matter.
- **Minutes:** 10 · **Prerequisites:** `relay-buzzer`.
- **Objectives:**
  - Describe a capacitor as two conductors separated by an insulator, holding equal and opposite charge.
  - See charging and discharging through resistors as gradual, and dumping through a small resistor as fast.
  - Explain why a capacitor with one plate disconnected cannot charge.
- **Unlocks:** parts `[]` · isle `capacitor`

**Hook**

> The capacitor that tamed your buzzing relay deserves a closer look. It soaked up charge in a blink and then fed the
> coil for most of a second. No chemistry, no moving parts: just two metal layers that never touch. Today you'll fill
> one slowly, let it drain through an LED, and watch the light melt away. Then you'll try a small act of sabotage and
> see what a capacitor really needs.

Predict: "You charge a capacitor, then let it power an LED. How does the LED go out?" Options: "Instantly" · "It fades
gradually" · "It flickers, then stops".

**Lab `capacitor-fill-fade`**

- Board: breadboard. Instruments: meter (DC volts across C1), logger (LAB NEEDS: voltage vs time plot).
- Initial parts:
  - `B1` battery (standard). `S1` pushbutton "fill" `{a: vcc, b: f}`. `R1` 1 kΩ `{a: f, b: c}`.
  - `C1` capacitor `{pos: c, neg: gnd}`, 1,000 µF, polarized, volts 16.
  - `R2` 1 kΩ `{a: c, b: l}`, `D1` led red `{anode: l, cathode: gnd}`.
  - `S2` pushbutton "empty" `{a: c, b: e}`, `R3` 100 Ω `{a: e, b: gnd}`.
- Tray: nothing. Bench action "lift lead" on any leg (BENCH NEEDS: lift one leg out of its hole without removing the part).
- Tasks:
  1. `fill`. Prompt: "Hold the fill button for five seconds. Watch the LED and the meter." Goal: D1 glow rises from below
     0.05 to above 0.5 and takes more than 0.5 s to go from 10% to 90% of its final glow; C1 settles at 5.0 to 5.8 V.
     Hints: "Keep holding. It's slower than you think." Success: "The light crept up as the capacitor filled. Notice the
     meter: fast at first, then slower and slower."
  2. `fade`. Prompt: "Let go and watch." Goal: after release, D1 glow falls below 0.1 between 1 and 8 s later. Success:
     "The capacitor is powering the LED by itself, and running out gently."
  3. `dump`. Prompt: "Fill it again, then press the empty button." Goal: D1 glow below 0.05 within 0.3 s of S2 pressed
     and C1 below 0.5 V. Success: "Through just 100 Ω the charge rushes out almost at once."
  4. `lift-a-leg`. Prompt: "Lift the capacitor's negative leg out of the ground strip. Fill and release again." Goal:
     with C1's negative leg floating, D1 goes dark within 0.15 s of releasing S1. Hints: "Use the lift tool on the striped
     leg." Success: "No fade at all. A capacitor with one plate disconnected can't hold anything." Notice: the charge on
     one plate needs a matching opposite charge on the other, and that needs a path.
- Damage moments: if the learner removes R2, the full capacitor dumps straight into D1: bright flash, D1 `died`.
- Notice: during filling, current flows in the wires on both sides of the capacitor, yet nothing crosses the insulator.
- BENCH NEEDS: a fill gauge ring on capacitor bodies that tracks voltage relative to rating.

**Explain**

1. **Two plates and a gap.** A capacitor is two conductors with a thin insulator between them. Push charge onto one
   plate and the same amount is pushed off the other, out into the circuit. Current flows in the wires on both sides,
   but nothing crosses the gap. The capacitor ends up holding equal and opposite charges: separated, ready to flow back.
   Widget idea: `capacitor-inside` (charges pile up on one plate as they leave the other).
2. **A stretchy wall.** Picture a pipe blocked by a rubber sheet. Pump water in from one side and the sheet bulges,
   pushing water out the other side. Keep pumping and the sheet stretches tighter until it pushes back as hard as the
   pump. That's a full capacitor. Let go and the sheet springs back, sending the water the other way.
3. **Farads.** Capacitance is measured in farads (F), named after Michael Faraday. One farad is huge, so real parts use
   microfarads (µF, millionths), nanofarads (nF, billionths) and picofarads (pF, trillionths). 1,000 pF = 1 nF, and
   1,000 nF = 1 µF. Your 1,000 µF capacitor is a big one for a breadboard.
4. **Capacitor or battery?** Both store energy, but a battery makes its voltage from chemistry and releases it slowly.
   A capacitor only holds what you put in, and can give it all back in a flash. That's perfect for smoothing, timing and
   short bursts, and useless for running a torch all evening.

**Quiz**

- **q1** `choice`: "While a capacitor charges, does current flow through its insulator?"
  - "Yes, that's how it charges": "Charge piles up on the plates; the insulator blocks it."
  - (correct) "No, but current flows in the wires on both sides": "Charge arriving on one plate pushes the same amount off the other."
  - "Only for big capacitors": "Size doesn't change the physics."
  - explain: "Nothing crosses the gap. Equal charge leaves one plate as it arrives on the other."
- **q2** `numeric`: "Convert 0.0022 µF to picofarads." answer 2200, unit pF, tolerance 0. hint: "1 µF = 1,000,000 pF."
  explain: "0.0022 × 1,000,000 = 2,200 pF, also written 2.2 nF."
- **q3** `numeric`: "How many nanofarads is 0.47 µF?" answer 470, unit nF, tolerance 0. explain: "Move the decimal point
  three places: 0.47 µF = 470 nF."
- **q4** `choice`: "A charged capacitor powers an LED through a resistor. You swap the resistor for a bigger one. The fade..."
  - (correct) "Lasts longer and starts dimmer": "Less current flows, so the charge drains more slowly."
  - "Ends sooner": "A bigger resistor slows the drain."
  - "Stays the same": "The resistor sets how fast charge leaves."
  - explain: "More resistance means less current, so the capacitor empties more slowly."
- **q5** `choice`: "A capacitor's negative leg is lifted out of the circuit. You press the fill button. What happens?"
  - (correct) "It can't charge, so the LED just follows the button": "One plate needs a return path to match the other."
  - "It charges twice as fast": "With no return path there's no charging at all."
  - "It explodes": "Nothing dramatic: it simply does nothing."
  - explain: "Charge pushed onto one plate must push charge off the other. No path, no charge."

**Wrap**

- Rules: "A capacitor stores equal and opposite charge on two plates." · "Charge through a resistor and it fills
  gradually; dump through a small resistor and it empties fast." · "Both plates must be connected for a capacitor to
  work." · "1,000 pF = 1 nF; 1,000 nF = 1 µF."
- Try it for real: parts: 1,000 µF 16 V electrolytic, two 1 kΩ, 100 Ω, red LED, two pushbuttons, breadboard, 9 V
  battery. Safety: "Small capacitors at 9 V are harmless. Big capacitors inside old TVs, microwaves and camera flashes can
  stay charged with dangerous voltages long after unplugging: never open them."

**Mascot lines:** "Watch it fade. Slowly. Like a sunset in a box." · "No plate, no party." · "A capacitor gives back
exactly what you put in. Fair, really."

---

#### Lesson 10. `capacitor-labels`: Reading the Fine Print

- **Summary:** Decode capacitor markings, respect polarity and voltage ratings, and see a capacitor block steady current.
- **Minutes:** 12 · **Prerequisites:** `capacitor-fill-fade`.
- **Objectives:**
  - Read ceramic codes (two digits plus a multiplier, in pF) and tolerance letters.
  - Distinguish ceramic (non-polarized, small values) from electrolytic (polarized, large values).
  - Explain working voltage, and why a reversed or over-voltage electrolytic is dangerous.
  - Show that a capacitor blocks steady DC once charged.
- **Unlocks:** parts `[ceramic-capacitor]` · isle `ceramic-cap`

**Hook**

> Capacitors are bad at introducing themselves. A tiny yellow bead might say only "104". A big can says "100 µF 16 V"
> and has a stripe of minus signs down one side. Those few characters tell you its value, its tolerance, which way round
> it goes and how much voltage it can take. Ignore them and things get dramatic. Today you learn to read the fine print,
> and then you get to ignore it once, on purpose.

Predict: "A ceramic capacitor is marked 104. What do you think it means?" Options: "104 pF" · "100,000 pF" · "104 µF" ·
"104 volts".

**Lab `capacitor-labels`**

- Board: breadboard. Instruments: meter (DC mA, 2 mA range, in series).
- Station A (current through a capacitor):
  - `B1` battery (standard). `R1` 10 kΩ `{a: vcc, b: r}`.
  - `M1` multimeter `{com: x, vohm: mv, ma: r, a10: ma10}`, mode `dca-ma`, range "2mA".
  - Empty capacitor socket between `x` and `gnd` (two strips).
- Station B ("the blast box", a clear lid prop): `S1` switch `{a: vcc, b: bb}` and an empty socket from `bb` to `gnd`.
- Tray: `CA` ceramic 100 nF marked "104", `CB` electrolytic 100 µF 16 V, `CC` electrolytic 100 µF 6.3 V.
- Tasks:
  1. `ceramic-blocks`. Prompt: "Plug the 104 ceramic into station A. Watch the meter. Then turn it round and try again."
     Goal: in both orientations, |I(M1)| below 2 µA one second after insertion. Hints: "The meter may twitch at the start.
     Watch what it settles to." Success: "A blip, then nothing. Once it's charged, no steady current gets through. And
     ceramics don't care which way round they go."
  2. `electrolytic-right-way`. Prompt: "Now plug in the 100 µF electrolytic the right way: stripe toward ground." Goal:
     initial current above 0.5 mA, falling below 20 µA within 10 s. Success: "Bigger capacitor, bigger gulp, slower
     settle. Then it blocks too, apart from a tiny leak."
  3. `electrolytic-backwards`. Prompt: "Flip the electrolytic so the stripe faces the positive side." Goal: after 8 s,
     current still above 100 µA and a `reversed` event on `CB`. Hints: "Just watch the meter. Does it settle this time?"
     Success: "It never settles. Backwards, the insulating layer breaks down and the capacitor leaks like a sieve."
  4. `blast-box`. Prompt: "Optional, and it's loud. Put the 6.3 V capacitor in the blast box backwards and close S1."
     Goal: `CC` `died` with reason reverse voltage (Hall of Fried Parts). Hints: "There's no resistor in the blast box.
     That's the point." Success: "It heated, bulged and vented. That's why polarity and voltage ratings matter. Add it
     to the Hall of Fried Parts." Notice: real ones do this too, sometimes with a bang and a smelly puff.
- Damage moments: task 4 by design. A correctly oriented 6.3 V part in the blast box also fails slowly from overvoltage
  (9 V on a 6.3 V rating): leakage rises, then `died`.
- SIM NEEDS: electrolytic leakage (default about 1 MΩ equivalent at rated voltage), reverse-voltage model (leakage rising
  over seconds, heating, `reversed` then `died` with a vent animation), overvoltage model for `volts` rating, small ESR so
  shorted capacitors don't produce infinite current.

**Explain**

1. **Ceramic and electrolytic.** Ceramics are small beads or discs, usually under 1 µF, and they fit either way round.
   Electrolytics are little cans in a plastic sleeve, usually 1 µF and up, and they're polarized: the leg by the stripe
   of minus signs goes to the more negative side, and that leg is shorter. On schematics, a curved or hollow plate marks
   the negative side of a polarized capacitor.
2. **Three digits.** Small ceramics use a code in picofarads: two digits, then how many zeros. 104 = 10 followed by four
   zeros = 100,000 pF = 100 nF = 0.1 µF. 473 = 47,000 pF = 47 nF. 222 = 2.2 nF. A letter may follow: J means ±5%, K
   ±10%, M ±20%. Here K never means kilo. Widget idea: `cap-code-decoder` (type a code, see pF, nF and µF together).
3. **Working voltage.** Every capacitor has a maximum voltage its insulator can take. Exceed it and the insulator leaks
   or breaks down. Using a higher rating than you need is always fine: a 16 V part is happy on 9 V. Electrolytics come as
   low as 6.3 V, so read the can.
4. **Blocking DC.** Once a capacitor is charged, a steady voltage pushes no more current through it. Only a change in
   voltage makes current flow. That's why a capacitor in series stops steady current but lets sudden changes through.
   You'll use that in two lessons' time.

**Quiz**

- **q1** `numeric`: "A ceramic is marked 104. What is its value in nF?" answer 100, unit nF, tolerance 0. hint: "10 then
  four zeros, in picofarads." explain: "100,000 pF = 100 nF = 0.1 µF."
- **q2** `numeric`: "A ceramic is marked 473. Value in nF?" answer 47, unit nF, tolerance 0. explain: "47 then three
  zeros = 47,000 pF = 47 nF."
- **q3** `choice`: "What does '223K' printed on a ceramic mean?"
  - "223 kilofarads": "That would be absurdly large. K is a tolerance letter."
  - (correct) "22 nF, ±10%": "22 + three zeros pF = 22 nF; K means 10% tolerance."
  - "22 kΩ": "That's resistor territory."
  - explain: "On capacitors, the letter after the code is the tolerance. K = ±10%."
- **q4** `choice`: "Your circuit runs on 9 V. Which electrolytic can you use?"
  - (correct) "16 V rated": "Higher rating than the circuit voltage: fine."
  - "6.3 V rated": "9 V exceeds its rating; it will leak and can fail."
  - "Either, the rating is just a suggestion": "Exceed it and the insulator breaks down."
  - explain: "Pick a working voltage comfortably above the circuit's highest voltage."
- **q5** `hotspot` (3D electrolytic, legs equal length view): "Tap the negative leg." Target: leg under the stripe.
  explain: "The stripe of minus signs runs down the negative side."
- **q6** `choice`: "An electrolytic is wired backwards in series with 10 kΩ across 9 V. What does an ammeter show?"
  - "Zero after a moment, like the right way round": "Backwards, the insulating layer breaks down."
  - (correct) "A current that never settles to near zero": "It leaks badly and warms up."
  - explain: "Reversed electrolytics conduct. With enough current they heat, bulge and vent."

**Wrap**

- Rules: "Ceramic code: two digits plus zeros, in picofarads; 104 = 100 nF." · "Electrolytics are polarized: stripe and
  short leg to negative." · "Never exceed a capacitor's voltage rating; a higher rating is always fine." · "A charged
  capacitor blocks steady current."
- Try it for real: parts: 100 nF ceramic, 100 µF 16 V electrolytic, 10 kΩ, meter, 9 V battery. Safety: "Do not
  reverse or overvolt real electrolytics. They can burst and spray hot electrolyte. Wear eye protection if you
  experiment."

**Mascot lines:** "104 is a code, not a price." · "K means ten percent. It never means kilo here." · "That pop goes
straight to the Hall of Fried Parts. Bravo, scientist."

---

#### Lesson 11. `rc-time-constant`: Counting in Taus

- **Summary:** Log a capacitor charging and discharging, discover the 63% mark, and predict timing with τ = R × C.
- **Minutes:** 14 · **Prerequisites:** `capacitor-labels`.
- **Objectives:**
  - Recognise the charging curve as fast-then-slow (exponential), not a straight line.
  - Compute τ = R × C in seconds and use it: 63% after 1τ, more than 99% after 5τ.
  - Predict how changing R or C changes timing, and explain why measured τ differs a little from nominal.
- **Unlocks:** parts `[logger]` · isle `resistor`

**Hook**

> Every capacitor you've charged so far started fast and finished slowly. Is there a pattern, or is each one different?
> Here's a surprise: every resistor and capacitor pair follows the same curve, only stretched or squashed in time. Find
> one number for your circuit and you can predict the voltage at any moment. Engineers call that number tau. Let's
> measure it.

Predict: "A capacitor charges to half of the battery voltage in 1 second. How long until it's fully charged?" Options:
"1 more second" · "2 seconds total, exactly" · "Much longer, it keeps slowing down".

**Lab `rc-time-constant`**

- Board: breadboard. Instruments: meter (DC volts across C1), logger with plot and "mark" cursor, stopwatch.
- Initial parts:
  - `B1` battery (standard, EMF 9.0 V). `S1` spdt `{com: t, a: vcc, b: gnd}`, to "b" (discharge).
  - `R1` 1 kΩ `{a: t, b: c}`. `C1` capacitor `{pos: c, neg: gnd}`, 1,000 µF, polarized, volts 16 (instance value ±20%).
- Tray: resistors 2.2 kΩ, 4.7 kΩ, 10 kΩ; capacitor 470 µF.
- Tasks:
  1. `find-tau`. Prompt: "Start with C1 empty. Slide S1 to charge and let the logger run. Mark the moment C1 reaches
     5.69 V, which is 63.2% of 9 V. How many seconds?" Goal: learner's τ within 10% of the instance's actual τ (R1 ×
     C1 actual, plus source resistance). Hints: "Use the cursor on the plot to find where the curve crosses 5.69 V." /
     "Measure from the moment you slid the switch." Success: "About one second. And 1 kΩ × 1,000 µF = 1 s. That's no
     coincidence."
  2. `discharge-tau`. Prompt: "Let it fill completely, then slide S1 back to discharge. When does it fall to 3.31 V?"
     Goal: learner's discharge τ within 10% of actual. Success: "The same τ going down: it drops 63% of the way to zero
     in one tau."
  3. `ten-times-slower`. Prompt: "Swap R1 for 10 kΩ. Predict τ, then measure it." Goal: logged τ within 10% of actual
     (about 10 s). Success: "Ten times the resistance, ten times the time."
  4. `hit-the-target`. Prompt: "Choose a resistor and capacitor from the tray so τ is about 2.2 s. Prove it with the
     logger." Goal: nominal R × C between 2.1 and 2.3 s and logged τ within 20% of 2.2 s. Hints: "τ = R × C. Try pairs."
     / "There are two good answers on this tray." Success: "2.2 kΩ × 1,000 µF or 4.7 kΩ × 470 µF. Different parts, same
     timing."
- Damage moments: none.
- Notice: measured τ is close to nominal but not exact, because electrolytics can be 20% off their printed value.
- LAB NEEDS: logger that records a node voltage at 20 samples per second, with plot, cursor readout and per-run reset.

**Explain**

1. **Fast, then slow.** Current into a capacitor depends on the difference between the supply and the capacitor's
   voltage. Empty, the difference is big and charge rushes in. Nearly full, the difference is small and charge trickles.
   So the curve rises steeply, then flattens, and never quite touches the supply. Widget idea: `rc-curve-explorer`
   (drag R and C, the curve stretches, τ markers move).
2. **Two tanks and a pipe.** Picture a full tank joined to an empty one by a thin pipe. Water races across at first,
   then slows as the levels get close. A thinner pipe (more resistance) or a wider tank to fill (more capacitance) both
   make it take longer. Multiply the two and you get the time scale: τ = R × C.
3. **Ohms times farads is seconds.** τ = R × C, with R in ohms and C in farads, gives seconds. 1 kΩ × 1,000 µF = 1,000 ×
   0.001 = 1 s. 10 kΩ × 100 µF = 1 s too. Each τ closes 63.2% of whatever gap remains. After 5τ the capacitor is above
   99%: call it full.
4. **The table to remember.** Charging from 0 V on a 9 V supply: 1τ 5.69 V, 2τ 7.78 V, 3τ 8.55 V, 4τ 8.84 V, 5τ 8.94 V.
   Discharging from 9 V: 3.31 V, 1.22 V, 0.45 V, 0.16 V, 0.06 V. The same shape, upside down. Real parts drift a little
   from these numbers because of tolerance and leakage.

**Quiz**

- **q1** `numeric`: "What is τ for 47 kΩ and 22 µF?" answer 1.034, unit s, tolerance 2. hint: "47,000 × 0.000022."
  explain: "47,000 Ω × 0.000022 F = 1.034 s."
- **q2** `numeric`: "A capacitor charges from 0 V toward 12 V. What is its voltage after 2τ?" answer 10.38, unit V,
  tolerance 2. hint: "After 2τ it has covered about 86.5% of the gap." explain: "12 × (1 - 0.135) ≈ 10.4 V."
- **q3** `numeric`: "How long until a capacitor is effectively full with 100 kΩ and 10 µF?" answer 5, unit s,
  tolerance 2. explain: "τ = 100,000 × 0.00001 = 1 s, and 5τ = 5 s."
- **q4** `choice`: "You double R and halve C. Charging becomes..."
  - "Twice as slow": "Doubling R alone would do that, but halving C cancels it."
  - (correct) "The same speed": "R × C is unchanged."
  - "Four times as fast": "The product didn't shrink."
  - explain: "Timing depends on the product R × C only."
- **q5** `choice` (four small plots drawn by us): "Which graph shows a capacitor charging through a resistor?"
  - "A straight rising line": "That would need a constant current, not a resistor."
  - (correct) "Steep at first, flattening toward the supply": "Current shrinks as the gap closes."
  - "Slow at first, then shooting up": "That's the opposite shape."
  - "A sudden jump to full": "Only with no resistor at all."
  - explain: "RC charging always rises fast, then levels off."
- **q6** `choice`: "Is τ the time it takes to fully charge?"
  - "Yes": "After one τ it's only at about 63%."
  - (correct) "No, it's the time to cover 63% of the gap": "Full takes about 5τ."
  - explain: "τ is the time scale. Five of them make 'full' for practical purposes."

**Wrap**

- Rules: "τ = R × C (ohms × farads = seconds)." · "After 1τ: 63% of the way. After 5τ: effectively full." · "Bigger R or
  bigger C means slower." · "Charging is fast, then slow, never a straight line."
- Try it for real: parts: 1,000 µF 16 V electrolytic, 1 kΩ and 10 kΩ, SPDT switch, meter, stopwatch, 9 V battery.
  Safety: "Nothing risky at these values. A fresh battery gives the cleanest data."

**Mascot lines:** "Tau: the only Greek letter with a stopwatch." · "Sixty-three percent. Every single tau." · "Same curve,
different stretch. Capacitors are very consistent."

---

#### Lesson 12. `smoothing-and-coupling`: Smooth It, Kick It Through

- **Summary:** Use a capacitor to smooth a flickering supply, then use one in series to pass a sudden change but block a steady one.
- **Minutes:** 12 · **Prerequisites:** `rc-time-constant`.
- **Objectives:**
  - Explain smoothing: a capacitor across a supply fills on peaks and feeds the load during dips.
  - Explain coupling: the voltage across a capacitor cannot jump, so a sudden step on one side appears on the other, then fades.
  - Summarise: capacitors pass changes and block steady DC; know passive vs active parts.
- **Unlocks:** parts `[]` · isle `battery`

**Hook**

> Capacitors have two party tricks, and they look like opposites. Put one *across* a shaky supply and it irons out the
> bumps, like a shock absorber. Put one *in line* with a signal and it passes every sudden change while refusing to pass
> anything steady. Same part, different position, completely different job. Let's flicker a light, fix it, and then
> build a button that only flashes once no matter how long you hold it.

Predict: "An LED is fed through a capacitor in series. You press and hold a button for 3 seconds. How long does the LED
glow?" Options: "3 seconds" · "A brief flash" · "Never".

**Lab `smoothing-and-coupling`**

- Board: breadboard. Instruments: meter, scope, auto-tapper (LAB NEEDS: toggles a pushbutton's `pressed` input at a set
  rate, default 4 per second).
- Station A (smoothing):
  - `B1` battery (standard). `S1` pushbutton `{a: vcc, b: s0}`. `R1` 100 Ω `{a: s0, b: s}`.
  - `R2` 1 kΩ `{a: s, b: l1}`, `D1` led red `{anode: l1, cathode: gnd}`.
- Station B (coupling):
  - `S2` pushbutton `{a: vcc, b: p}`. `C2` capacitor `{pos: p, neg: q}`, 100 µF, polarized, volts 16.
  - `R3` 1 kΩ `{a: q, b: l2}`, `D2` led red `{anode: l2, cathode: gnd}`.
  - `S3` pushbutton "reset" `{a: p, b: rr}`, `R4` 100 Ω `{a: rr, b: q}` (discharges C2).
- Tray: capacitors 470 µF and 47 µF.
- Tasks:
  1. `flicker`. Prompt: "Turn on the auto-tapper for S1. Watch D1." Goal: with tapper on and no capacitor at node `s`,
     D1 glow ripple (max minus min over 1 s) above 0.6. Success: "On, off, on, off. That's what a choppy supply looks like."
  2. `smooth-it`. Prompt: "Add the 470 µF capacitor from the resistor's output to ground (stripe to ground)." Goal: with
     tapper on, D1 glow ripple below 0.25 and mean glow above 0.2 over 2 s. Hints: "The capacitor goes across the supply,
     not in line with it." Success: "Steady light from a stuttering source. The capacitor fills during each tap and feeds
     the LED in between." Notice (optional comparison): with 47 µF the ripple returns, because a small tank empties fast.
  3. `one-flash`. Prompt: "Station B: press and hold S2 for three seconds." Goal: while S2 is held for at least 2 s, D2
     glow is above 0.3 for less than 0.6 s in total. Success: "A flash, then darkness, even though you're still pressing."
  4. `no-encore`. Prompt: "Let go and press S2 again. Then press reset (S3) and try once more." Goal: second press
     without reset peaks below 0.15; after S3, the next S2 press peaks above 0.3. Hints: "What's left in C2 after the
     first press?" Success: "The capacitor only passes a change. Already charged, there's no change left to pass, until
     you empty it."
- Damage moments: none planned. If the learner puts C2 in backwards, a `reversed` warning appears; it leaks but survives
  at this current.
- Notice: the scope on both plates of C2 shows them jump together at the press, then the lower plate sags back to zero.

**Explain**

1. **Smoothing.** A capacitor across a supply is a small reservoir. When the supply surges, it soaks up the extra. When
   the supply dips, it tops the circuit up. Bigger capacitors smooth more but take longer to fill. Every phone charger
   and every chip on a circuit board has capacitors doing this job. Widget idea: `ripple-tank` (drag C and watch a
   bumpy trace flatten).
2. **The voltage across a capacitor can't jump.** Changing it means moving charge, and that takes time through any
   resistor. So when one plate suddenly rises by 9 V, the other plate rises by 9 V too, at that instant. Then charge
   drains away through the resistor and the far plate sags back. A sudden change passes through; a steady level fades.
3. **Current without crossing.** During that flash, real current flows in the wires on both sides of C2, yet no charge
   crosses the insulator. The current is set by how fast the voltage changes: bigger or faster changes push more. Hold a
   voltage steady and the current stops. That's why we say capacitors pass changes and block DC.
4. **Passive and active.** Resistors and capacitors are passive: they can't switch or amplify, and they don't need a
   power supply of their own. Transistors, coming up next, are active: they use one current to control another. Put
   passive and active parts together and you get timers, flashers and amplifiers.

**Quiz**

- **q1** `choice`: "In the coupling circuit you hold the button for 10 seconds. How long does the LED glow?"
  - "10 seconds": "Steady voltage doesn't pass through a capacitor."
  - (correct) "A brief flash, fading in about a time constant": "Only the change at the press passes through."
  - "It doesn't glow at all": "The sudden step does get through."
  - explain: "A series capacitor passes the step, then blocks the steady level."
- **q2** `choice`: "You want one short pulse from a long button press. Which part goes in series with the signal?"
  - (correct) "A capacitor, with a resistor to ground after it": "The capacitor passes the step; the resistor lets it fade and resets the level."
  - "A bigger resistor": "That only reduces the current; the signal stays as long as the press."
  - "A diode": "A diode passes one direction, but doesn't shorten anything."
  - explain: "A coupling capacitor turns a long step into a short pulse."
- **q3** `choice`: "Is a bigger smoothing capacitor always better?"
  - "Yes, always": "It also responds more slowly and draws a big surge at switch-on."
  - (correct) "No, it trades smoothness for slower response and a bigger switch-on surge": "Engineers pick 'enough'."
  - explain: "Bigger smooths more, but fills slowly and gulps current when power arrives."
- **q4** `match`: "Match the capacitor job to where it sits." Smoothing → across the supply (to ground) · Coupling → in
  series with a signal · Timing → with a resistor that charges it · Blocking DC → in series, once charged.
  - explain: "Position decides the job: across for smoothing, in line for coupling."
- **q5** `choice`: "A signal swings between 8 V and 9 V. After a coupling capacitor (with a resistor to ground), what
  swing appears?"
  - "Still 8 V to 9 V": "The steady 8.5 V part is blocked."
  - (correct) "About -0.5 V to +0.5 V, centred on 0 V": "Only the 1 V change passes."
  - "Nothing": "The changes do pass."
  - explain: "The capacitor removes the steady offset and passes the wiggle."

**Wrap**

- Rules: "Across a supply, a capacitor smooths." · "In series, a capacitor passes changes and blocks steady DC." · "The
  voltage across a capacitor can't change instantly." · "Resistors and capacitors are passive; transistors are active."
- Try it for real: parts: 470 µF and 100 µF electrolytics, two LEDs, 100 Ω, two 1 kΩ, three pushbuttons, 9 V battery,
  breadboard. Safety: "Mind the stripe on every electrolytic."

**Mascot lines:** "Across: shock absorber. In line: change detector." · "One flash per change. Capacitors are strict
about that." · "You're thinking in time now. That's a big step."

**Module M4 landmark:** see section 4 (`capacitor-water-tower`).

---

### Module M5: Transistors (`transistors`)

Landmark: `transistor-gatehouse`. Prerequisite: M4.

#### Lesson 13. `meet-the-transistor`: A Tiny Current in Charge

- **Summary:** Place a 2N3904 the right way round, steer an LED with a trickle of base current, and measure its gain.
- **Minutes:** 12 · **Prerequisites:** `smoothing-and-coupling`.
- **Objectives:**
  - Identify the 2N3904's emitter, base and collector (flat face toward you, legs down: E, B, C).
  - Show that a small base current controls a much larger collector current, and compute gain β = Ic ÷ Ib.
  - Explain the about 0.7 V base-emitter threshold and why the base always needs a current-limiting resistor.
- **Unlocks:** parts `[npn-transistor]` · isle `transistor`

**Hook**

> A relay lets a small current control a big one, but it clicks, wears out and takes milliseconds to move. Now meet a
> black crumb of plastic with three legs and no moving parts at all. Feed its middle leg about a thousandth of the
> current a relay coil needs and it lets a big current flow through the other two. It's the most important
> invention you've never noticed: there are billions inside the device you're using right now.

Predict: "You feed the transistor's base about 20 µA. Roughly how much current do you think can flow through the LED?"
Options: "About 20 µA" · "A few mA" · "Several amps".

**Lab `meet-the-transistor`**

- Board: breadboard. Instruments: meter (DC mA with 200 µA and 20 mA ranges).
- Initial parts:
  - `B1` battery (standard). `R1` 470 Ω `{a: vcc, b: la}`, `D1` led red `{anode: la, cathode: lc}`.
  - `S1` pushbutton `{a: vcc, b: sb}`. Base resistor socket between strips `sb` and `qb`.
  - `Q1` npn 2N3904 in the tray (target: `{c: lc, b: qb, e: gnd}`). Per-instance β 150 to 250.
- Tray: `Q1`; base resistors 1 MΩ, 470 kΩ, 220 kΩ; jumper wires.
- Tasks:
  1. `place-q1`. Prompt: "Place Q1 with its flat face toward you. Its legs are E, B, C from left to right. Put C in the
     LED's strip, B in the base strip and E on ground." Goal: Q1 pins land on `lc`, `qb`, `gnd` respectively. Hints:
     "Hover a leg to see its name." / "Flat face toward you, legs pointing down: emitter on the left." Success: "Correct
     way round. A backwards transistor sort of works, badly, which is the worst kind of bug."
  2. `small-steers-big`. Prompt: "Put the 470 kΩ resistor in the base socket. Press S1." Goal: D1 glow above 0.15 with
     S1 held and below 0.02 released. Success: "A trickle into the base, a real current through the LED."
  3. `measure-gain`. Prompt: "Measure the base current, then the collector current. Divide to get the gain."
     Goal: learner's β entry within 10% of the instance's Ic ÷ Ib at that operating point. Hints: "Break the base path
     and put the meter in series, on the 200 µA range." / "Then do the same in the collector path, on the 20 mA range."
     Success: "Your transistor multiplies base current by about β. Every 2N3904 is a little different."
  4. `double-it`. Prompt: "Swap to 220 kΩ. Predict the collector current first, then measure." Goal: collector current
     with 220 kΩ is 1.7 to 2.4 times the 470 kΩ value. Success: "About twice the base current, about twice the collector
     current."
  5. `no-resistor`. Prompt: "Optional experiment: remove the base resistor and jumper S1 straight to the base. Press
     once." Goal: Q1 `died` (Hall of Fried Parts). Success: "The base-emitter junction is like a diode. With no resistor
     it took amps from the battery and burned out in a blink."
- Damage moments: task 5 by design. A reversed Q1 (C and E swapped) gives a dim LED (reverse β about 3), plus a
  `reversed` event.
- SIM NEEDS: 2N3904 model with per-instance β, Vbe about 0.65 V at 1 mA, reverse-mode β 1 to 5, damage above 200 mA
  collector current or 625 mW, near-instant death with an unlimited base current (section 9).

**Explain**

1. **Three legs, three jobs.** The collector is where the big current comes in, the emitter is where it leaves, and the
   base is the control. On the symbol, the arrow sits on the emitter and points the way conventional current flows out
   of an NPN. Hold a 2N3904 flat face toward you, legs down: E, B, C. Always check the datasheet: not every
   three-legged black part agrees. Widget idea: `transistor-valve` (base current opens a valve on a much bigger pipe).
2. **A trickle controls a river.** Picture a faucet where a tiny stream on the handle decides how much water flows from
   a big pipe. The base current is the trickle; the collector current is the river. Their ratio is the gain, β (also
   written hFE). For a 2N3904 it's typically 100 to 300. The current still comes from the battery: the transistor only
   decides how much.
3. **The 0.7 V door.** Between base and emitter is a junction that behaves like a diode. Nothing much happens until the
   base is about 0.6 to 0.7 V above the emitter. Past that, base current rises very steeply with voltage. That's why the
   base always gets a resistor: it turns a voltage into a sensible current, like 9 V through 470 kΩ giving about 18 µA.
4. **NPN and PNP.** You're using an NPN: the base is pulled up to turn it on, and current flows collector to emitter.
   Its mirror twin, the PNP (like the 2N3906), turns on when its base is pulled down below the emitter, and its symbol's
   arrow points in. Same idea, opposite directions.

**Quiz**

- **q1** `hotspot` (3D 2N3904, flat face toward viewer, legs down): "Tap the base." Target: middle leg.
  explain: "Flat face toward you, legs down: E, B, C. The base is in the middle."
- **q2** `numeric`: "Base current 0.04 mA, collector current 7.6 mA. What is β?" answer 190, tolerance 3. hint: "β =
  Ic ÷ Ib." explain: "7.6 ÷ 0.04 = 190."
- **q3** `numeric`: "9 V feeds the base through 100 kΩ. Taking Vbe as 0.7 V, what is the base current in µA?" answer
  83, unit µA, tolerance 3. explain: "(9 - 0.7) ÷ 100,000 = 0.000083 A = 83 µA."
- **q4** `choice`: "Why must the base always have a resistor (or other current limit)?"
  - (correct) "Above about 0.7 V the base-emitter junction conducts like a diode, so current would soar": "The resistor sets a safe base current."
  - "To make the transistor slower": "Speed isn't the reason."
  - "The base needs exactly 9 V": "The base sits near 0.7 V above the emitter when on."
  - explain: "A junction past its threshold takes as much current as the supply allows, unless something limits it."
- **q5** `choice`: "Where does the collector current come from?"
  - "The transistor generates it": "Transistors don't create energy."
  - (correct) "The battery, through the LED and resistor; the transistor controls how much": "It's a valve, not a pump."
  - "The base current, amplified inside": "The base current only sets the level; the battery supplies it."
  - explain: "The supply pushes the current. The transistor opens or closes the path."
- **q6** `choice`: "On a transistor symbol the arrow points in toward the base. What type is it?"
  - "NPN": "NPN arrows point out of the emitter."
  - (correct) "PNP": "Arrow pointing in means PNP."
  - explain: "The arrow shows conventional current at the emitter: out for NPN, in for PNP."

**Wrap**

- Rules: "2N3904, flat face toward you, legs down: E, B, C." · "Collector current ≈ β × base current." · "The base
  turns on at about 0.7 V above the emitter." · "Always limit base current with a resistor."
- Try it for real: parts: 2N3904, 470 Ω, 470 kΩ and 220 kΩ, red LED, pushbutton, meter, 9 V battery, breadboard.
  Safety: "Never connect a battery straight across any two transistor legs."

**Mascot lines:** "Tiny trickle, big river. I love this part." · "E, B, C. Flat face, friendly face." · "That
transistor gave its life for science. Hall of Fried Parts, row two."

---

#### Lesson 14. `touch-switch`: All the Way On

- **Summary:** Push a transistor into saturation, use it as a proper switch, and build a touch switch sensitive enough for a feather-light fingertip.
- **Minutes:** 12 · **Prerequisites:** `meet-the-transistor`.
- **Objectives:**
  - Distinguish the in-between (active) region from saturation, where the transistor acts as a closed switch.
  - Pick a base resistor that saturates the transistor with margin.
  - Chain two transistors (a Darlington pair) to multiply gain; compare transistors with relays.
- **Unlocks:** parts `[touch-pads]` · isle `heatsink`

**Hook**

> A light switch is either on or off. Halfway is useless, and in electronics it's also warm. A transistor can sit
> anywhere between off and fully on, so to use it as a switch you have to push it all the way. Today you'll find the
> point where more base current stops helping, and then build a switch you work with a fingertip. Your skin conducts a
> little. Is a little enough?

Predict: "You keep lowering the base resistor, giving more and more base current. What happens to the LED?" Options:
"It gets brighter forever" · "It brightens, then stops getting brighter" · "It gets dimmer".

**Lab `touch-switch`**

- Board: breadboard. Instruments: meter.
- Initial parts: the lesson 13 circuit with `Q1` placed: `R1` 470 Ω, `D1` red, `Q1` `{c: lc, b: qb, e: gnd}`, `S1`
  pushbutton, base socket.
- Tray: base resistors 470 kΩ, 10 kΩ, 4.7 kΩ; `R5` 10 kΩ (pad protection); `T1` touch pads (probe-resistance
  `{a: pad1, b: pad2}`, ohms set by the fingertip prop from 100 kΩ (firm, damp) to 2 MΩ (light, dry)); `Q2` npn 2N3904.
- Tasks:
  1. `active-vs-saturated`. Prompt: "With 470 kΩ in the base, hold S1 and measure the voltage from collector to
     emitter. Then swap to 10 kΩ and measure again." Goal: logged Vce above 2 V with 470 kΩ and below 0.3 V with 10 kΩ.
     Hints: "Black probe on the emitter, red on the collector." Success: "With plenty of base current, Q1 is fully on:
     only about 0.1 V across it. That's saturation."
  2. `no-brighter`. Prompt: "Swap to 4.7 kΩ: double the base current again. Does the LED get brighter?" Goal: collector
     current with 4.7 kΩ within 5% of the 10 kΩ value. Success: "No change. In saturation the LED and its resistor set
     the current, not the transistor."
  3. `touch-it`. Prompt: "Replace the base resistor and button with the touch pads in series with R5. Touch lightly, then
     firmly." Goal: D1 glow at 2 MΩ less than half its glow at 100 kΩ. Hints: "The fingertip slider sets how firm and
     damp your touch is." Success: "It works, but only with a firm touch. A single transistor's gain isn't quite enough
     for a light one."
  4. `darlington`. Prompt: "Add Q2: its emitter drives Q1's base, its collector joins Q1's collector, and the touch pads
     feed Q2's base." Goal: with the touch at 2 MΩ, D1 glow at least 85% of its task 1 saturated glow. Hints: "Q2's
     emitter goes into the strip with Q1's base." / "R5 stays in series with the pads." Success: "Feather touch, full
     light. Q2's gain multiplies Q1's: roughly 200 × 200 = 40,000."
- Damage moments: removing R5 and bridging the pads with a wire puts the battery across Q2's and Q1's base-emitter
  junctions in a row, with nothing to limit the current: both transistors die (Hall of Fried Parts). Robot: "That's
  what R5 is for. Fingers are never zero ohms, but wires are." Fingertips alone are safe at 9 V; one fingertip only.
- SIM NEEDS: `probe-resistance` driven by the bench's fingertip prop via `setInput(id, "ohms", value)` (already in the
  contract); saturation behaviour with Vce(sat) 0.05 to 0.2 V.

**Explain**

1. **Saturation.** As base current rises, collector current rises with it, until the transistor can't drop any less
   voltage. Then it's saturated: fully on, about 0.1 V from collector to emitter. Now the load decides the current, and
   extra base current changes nothing. That's what you want from a switch. Widget idea: `saturation-curve` (slide base
   current, watch collector current rise then flatten).
2. **Switches run cool.** Heat in a transistor is the voltage across it times the current through it. Off: no current,
   no heat. Saturated: 0.1 V × 15 mA = 1.5 mW, barely warm. Halfway: perhaps 5 V × 7 mA = 35 mW. A switch should spend
   its life at the two cool ends and cross the warm middle quickly.
3. **Designing a transistor switch.** Work out the load current, divide by the lowest β the datasheet promises (100 for a
   2N3904 at 10 mA), then give the base two to five times that. For 15 mA: at least 0.15 mA, so aim for 0.5 mA. From 9
   V that's (9 - 0.7) ÷ 0.5 mA, about 16 kΩ: pick 10 kΩ or 15 kΩ.
4. **Transistor or relay?** Transistors are tiny, silent, fast (millions of switches per second) and never wear out, but
   they drop a little voltage when on, leak a tiny bit when off, and usually handle DC only. Relays switch big currents
   and AC, offer changeover contacts and full isolation, and drop nothing when closed, but they're slow, bulky and wear
   out. Choose by the job.

**Quiz**

- **q1** `numeric`: "An LED circuit needs 15 mA through a transistor with a minimum β of 100. What is the smallest base
  current that could saturate it, in mA?" answer 0.15, unit mA, tolerance 2. explain: "15 mA ÷ 100 = 0.15 mA. Designers
  give two to five times that for margin."
- **q2** `choice`: "A saturated transistor carries 15 mA. Roughly what voltage is across collector and emitter?"
  - (correct) "About 0.1 V": "Fully on, it drops very little."
  - "About 0.7 V": "That's base to emitter, not collector to emitter."
  - "Half the supply": "That's the warm in-between region."
  - explain: "Saturation means the smallest possible Vce, typically 0.05 to 0.2 V."
- **q3** `choice`: "Which job suits a relay better than a transistor?"
  - "Blinking an LED 20,000 times a second": "A relay can't move that fast."
  - (correct) "Switching a mains-powered heater from a battery circuit": "Relays switch AC and keep the circuits fully isolated."
  - "A pocket-sized silent touch switch": "Transistors win on size and silence."
  - explain: "Big AC loads and isolation are relay territory; speed and size favour transistors."
- **q4** `numeric`: "Two transistors with β = 150 and β = 200 form a Darlington pair. Roughly what is the combined gain?"
  answer 30000, tolerance 5. explain: "Gains multiply: 150 × 200 = 30,000."
- **q5** `choice`: "Why does a transistor switch run cooler fully on than half on?"
  - (correct) "Heat is Vce × Ic, and Vce is tiny when saturated": "Low voltage across it means low power."
  - "Less current flows when fully on": "More current flows, but almost no voltage is across it."
  - "Transistors never get warm": "Half on, they can get quite warm."
  - explain: "Power = voltage × current. Saturated, the voltage term nearly vanishes."

**Wrap**

- Rules: "Saturated: fully on, about 0.1 V across, the load sets the current." · "Give the base two to five times the
  minimum it needs." · "Two transistors chained multiply their gains." · "Relays for big loads and AC; transistors for
  speed, size and silence."
- Try it for real: parts: two 2N3904, 470 Ω, 10 kΩ, red LED, two bare wire ends as touch pads, 9 V battery. Safety:
  "Touch the pads with one fingertip only, never across both hands, and never on broken skin. At 9 V it's harmless."

**Mascot lines:** "All the way on, or all the way off. No dithering." · "Your fingertip just flipped a switch. With
physics." · "Forty thousand times gain. I feel dizzy."

---

#### Lesson 15. `delay-timer`: Wait for It

- **Summary:** Combine a capacitor, a transistor and a relay into a timer you can set with a screwdriver.
- **Minutes:** 14 · **Prerequisites:** `touch-switch`.
- **Objectives:**
  - Explain why the relay can't be driven straight from the timing capacitor.
  - Use a transistor as an emitter follower: the emitter follows the base about 0.7 V lower, with current gain.
  - Use a trimmer potentiometer as an adjustable resistor and calibrate a delay.
- **Unlocks:** parts `[trimmer]` · isle `pot`

**Hook**

> You know how to make time with a capacitor and a resistor, and how to switch big things with a relay. Put them together
> and you should get a timer: flip a switch, wait, click. The robot tried it and nothing clicked, ever. Something is
> draining the capacitor faster than it fills. Find the culprit, fix it with a transistor, and then tune your timer to
> exactly five seconds.

Predict: "A 1,000 µF capacitor charges through 1 kΩ and also powers a 540 Ω relay coil directly. Will the relay click?"
Options: "Yes, after about a second" · "Yes, after a long time" · "Never".

**Lab `delay-timer`**

- Board: breadboard. Instruments: meter, stopwatch (LAB NEEDS: auto-measures time from a switch event to a relay event).
- Initial parts:
  - `B1` battery (standard). `S1` switch "start" `{a: vcc, b: v}`, closed false.
  - `R1` 1 kΩ `{a: v, b: t}`. `P1` pot 10 kΩ `{a: t, wiper: bnode, b: bnode}` (used as a variable resistor), position 0.
  - `C1` capacitor `{pos: bnode, neg: gnd}`, 1,000 µF, polarized, volts 16.
  - `S2` pushbutton "reset" `{a: bnode, b: rs}`, `R3` 100 Ω `{a: rs, b: gnd}`.
  - `K1` relay `{coilA: k1a, coilB: gnd, com: v, no: kno, nc: knc}`, 540 Ω, pullIn 6.0, dropOut 1.8. `D1` diode 1N4001
    `{anode: gnd, cathode: k1a}`.
  - `R2` 470 Ω `{a: kno, b: g}`, `D2` led green `{anode: g, cathode: gnd}`.
  - Starting wiring: a jumper joins `bnode` straight to `k1a` (no transistor yet).
- Tray: `Q1` npn 2N3904, jumpers.
- Tasks:
  1. `no-click`. Prompt: "Press reset, then switch on S1. Wait ten seconds. Measure C1's voltage." Goal: after at least
     8 s with S1 closed, C1 between 2.8 and 3.5 V and K1 never closed; learner enters the reading. Hints: "Meter across
     C1, red on the + leg." Success: "Stuck near 3.2 V. The coil drains current as fast as the 1 kΩ supplies it: together
     they form a divider, and 3.2 V is far below the 6 V the relay needs."
  2. `add-q1`. Prompt: "Remove the jumper. Put Q1 in: base to C1's + strip, collector to the switched supply `v`,
     emitter to the coil. Reset, then switch on." Goal: K1 closes 0.9 to 2.2 s after S1 closes, and D2 lights. Hints:
     "The coil now hangs from the emitter." / "Reset C1 before each run." Success: "Click! The capacitor only has to feed
     the base, a tiny current. The transistor feeds the coil from the battery."
  3. `five-seconds`. Prompt: "Turn the trimmer to set a delay of 5 seconds. Reset between tries." Goal: three consecutive
     runs measure 4.5 to 5.5 s. Hints: "More resistance, longer delay." / "τ = R × C. You need about 3.6 s of τ: what R
     does that mean with 1,000 µF?" Success: "Five seconds, on demand. That's a timer."
  4. `impatient-restart`. Prompt: "Switch S1 off, then straight back on, without pressing reset. Time it." Goal: a run
     without reset measures less than 70% of the previous run. Success: "Much shorter: C1 still had charge left over. Real
     timers need a way to empty their capacitor, like your reset button."
- Damage moments: wiring Q1's base directly to `v` (bypassing R1 and P1) puts the battery across the base-emitter junction
  and the coil: Q1 overheats and dies. Wiring P1 across its two ends gives a fixed 10 kΩ: no adjustment (robot hint).
- Notice: the emitter voltage follows the capacitor about 0.7 V below it; the relay clicks when the emitter reaches pull-in.

**Explain**

1. **Why it never clicked.** The coil is a 540 Ω path to ground hanging on the capacitor. With 1 kΩ feeding it, the
   capacitor can only reach 9 × 540 ÷ 1,540, about 3.2 V, before the coil drains current as fast as it arrives. The
   relay wants 6 V. Patience can't fix a divider. Widget idea: `delay-scope` (capacitor, emitter and pull-in line on one plot).
2. **The emitter follower.** Hang the load from the emitter and feed the collector from the supply. The emitter sits
   about 0.7 V below the base and follows it up. The base draws only the load current divided by β, so the capacitor
   barely notices. Current gain, no voltage gain: the output is a little lower than the input, but much stronger.
3. **Timing it.** The relay clicks when the emitter reaches 6 V, so the capacitor must reach about 6.7 V. On a 9 V
   supply that takes about 1.4 time constants. With 1 kΩ and 1,000 µF, τ = 1 s, so the delay is about 1.4 s. Add 2.6 kΩ
   with the trimmer and τ grows to 3.6 s: about 5 s of delay.
4. **The trimmer.** A trimmer potentiometer is a small resistor track with a sliding contact, the wiper. Between the two
   ends it's always the full value. Between the wiper and one end you get anything from zero to full. The fixed 1 kΩ in
   series makes sure the resistance never reaches zero. On schematics it's a resistor with an arrow or a little T.

**Quiz**

- **q1** `choice`: "Why does the timer need a transistor?"
  - (correct) "Fed directly, the coil drains the capacitor so it never reaches pull-in": "The transistor lets a tiny base current control the coil current."
  - "The relay needs AC": "It's a DC relay."
  - "The transistor makes the delay longer": "The RC values set the delay."
  - explain: "The coil plus the charging resistor form a divider stuck near 3 V. The follower removes that load."
- **q2** `numeric`: "An emitter follower's base is held at 5.0 V. What voltage is the emitter at?" answer 4.3, unit V,
  tolerance 3. explain: "About 0.7 V below the base: 5.0 - 0.7 = 4.3 V."
- **q3** `numeric`: "A timer uses 1 kΩ plus a 10 kΩ trimmer with 470 µF. What is the largest τ?" answer 5.17, unit s,
  tolerance 2. hint: "Maximum R is 11 kΩ." explain: "11,000 × 0.00047 = 5.17 s. The smallest is 1,000 × 0.00047 = 0.47 s."
- **q4** `choice`: "You restart the timer immediately after switching it off. The delay is..."
  - (correct) "Shorter, because the capacitor is still partly charged": "It starts part of the way up the curve."
  - "Longer, because the capacitor is tired": "Capacitors don't get tired."
  - "The same": "Only if the capacitor is fully emptied first."
  - explain: "A timer measures from wherever the capacitor starts. Empty it for a full delay."
- **q5** `choice`: "A trimmer is wired using its two outer legs only. Turning it..."
  - "Changes the resistance from 0 to 10 kΩ": "That needs the wiper."
  - (correct) "Does nothing: it's always the full 10 kΩ": "The ends are fixed; only the wiper moves."
  - "Shorts the circuit": "The track still has its full resistance."
  - explain: "Use the wiper and one end to make a variable resistor."

**Wrap**

- Rules: "A load that drains the timing capacitor ruins the timing; buffer it with a transistor." · "An emitter follows
  the base about 0.7 V lower, with current gain." · "Wiper plus one end of a trimmer makes a variable resistor; keep a
  fixed resistor in series." · "Empty the capacitor before each timing run."
- Try it for real: parts: 2N3904, 9 V relay, 1N4001, 1,000 µF 16 V, 1 kΩ, 10 kΩ trimmer, 100 Ω, 470 Ω, green LED,
  slide switch, pushbutton, 9 V battery. Safety: "Keep the protection diode across the coil, band toward positive."

**Mascot lines:** "Wait for it... wait for it... click!" · "The transistor carries the coil so the capacitor doesn't
have to." · "Five seconds. I counted. Twice."

**Module M5 landmark:** see section 4 (`transistor-gatehouse`).

---

### Module M6: Blink and beep (`blink-and-beep`)

Landmark: `siren-tower`. Prerequisite: M5.

#### Lesson 16. `night-light`: Lights On at Dusk

- **Summary:** Use a phototransistor to sense light, then flip its logic so a lamp turns on as darkness falls.
- **Minutes:** 12 · **Prerequisites:** `delay-timer`.
- **Objectives:**
  - Describe a phototransistor as a transistor whose base current is made by light.
  - Invert a sensor's action by letting it steal a transistor's base current.
  - Set a switching threshold with a trimmer.
- **Unlocks:** parts `[phototransistor]` · isle `phototransistor`

**Hook**

> Street lamps don't have someone flipping a switch at sunset. They notice the dark by themselves. The trick is a
> transistor with a window: light falling on it does the job your fingertip did last module, letting current through.
> Your mission is a lamp for Switchback Isle that wakes up when the light fades and sleeps when morning comes. The
> catch: a sensor that conducts in the light needs a little cunning to make a lamp that lights in the dark.

Predict: "A phototransistor conducts more when light shines on it. Wired in series with an LED, when is the LED
brightest?" Options: "In the dark" · "In bright light" · "It doesn't change".

**Lab `night-light`**

- Board: breadboard. Instruments: meter. BENCH NEEDS: a desk lamp and shade prop whose slider drives the `light` input
  (0 = pitch dark, 0.3 = room light, 1 = bright lamp) of every phototransistor on the bench.
- Station A: `PT1` phototransistor `{c: vcc, e: pe}`, `R1` 1 kΩ `{a: pe, b: la}`, `D1` led red `{anode: la, cathode: gnd}`.
- Station B: `R2` 470 Ω `{a: vcc, b: la2}`, `D2` led yellow `{anode: la2, cathode: lc2}`, `Q1` npn `{c: lc2, b: qb, e: gnd}`,
  `R3` 4.7 kΩ `{a: vcc, b: pb}`, `P1` pot 50 kΩ `{a: pb, wiper: qb, b: qb}`, position 0.5.
- Tray: `PT2` phototransistor.
- Tasks:
  1. `follow-the-light`. Prompt: "At station A, slide the light from dark to bright." Goal: D1 glow at light 1.0 exceeds
     its glow at light 0.1 by more than 0.3. Success: "More light, more current. The phototransistor is a light-operated
     valve."
  2. `flip-it`. Prompt: "At station B, Q1's base is fed through the trimmer. Plug PT2 in from Q1's base strip to ground
     (collector to the base strip). Then make it dark, then bright." Goal: D2 glow above 0.6 at light 0.05 and below
     0.05 at light 0.8. Hints: "The phototransistor's collector is usually the shorter leg, by the flat side. Check the
     part's info card." / "In light, PT2 steals Q1's base current." Success: "Dark: Q1's base gets its current, the lamp
     shines. Light: PT2 drains that current to ground first."
  3. `set-dusk`. Prompt: "Turn the trimmer so the lamp comes on as light drops below about 0.25." Goal: D2 glow above 0.5
     at light 0.18 and below 0.1 at light 0.32. Hints: "Less base resistance feeds Q1 more current, so it takes more light
     to steal it all." Success: "Your lamp now has a sense of when dusk is."
- Damage moments: PT2 in backwards does nothing (`reversed` warning, no damage at this current).
- SIM NEEDS: phototransistor model: collector current about 2 mA × light (0..1), dark current about 100 nA, Vce(sat)
  about 0.2 V; reversed connection conducts almost nothing.
- Notice: near the threshold the lamp glows dimly instead of snapping on. That's a hint of a problem Unit 4 solves with
  a circuit that has hysteresis, just like the relay did.

**Explain**

1. **A transistor with a window.** In a phototransistor, light falling on the base region frees charge that acts like
   base current. No base leg needed: most have just a collector and an emitter. More light, more collector current, up
   to a few milliamps in bright light. It's a valve that light opens. Widget idea: `light-valve` (drag a sun across the
   sky, watch the current gauge).
2. **Stealing base current.** In the night light, Q1's base is fed by the trimmer. PT2 sits between that base and
   ground. In the dark it's closed, so Q1 gets its current and the lamp shines. In the light it opens and the current
   takes the easy road to ground instead of into Q1's base. Q1 goes off. The sensor's action is flipped.
3. **Setting the threshold.** The lamp changes state when PT2's current roughly equals what the trimmer supplies. Lower
   resistance supplies more, so it takes brighter light to steal it all: the lamp switches on earlier in the evening.
   That's a sensitivity knob, and every automatic light has one somewhere.
4. **The fuzzy edge.** Between dark and light the lamp passes through dim. A real street light would flicker at dusk
   as clouds drift by. The cure is hysteresis: switch on at one level and off at a clearly different one. Remember the
   relay's pull-in and drop-out? Same idea, coming back in Unit 4.

**Quiz**

- **q1** `choice`: "In the night light, why does bright light turn the lamp off?"
  - (correct) "The phototransistor diverts Q1's base current to ground": "No base current, no collector current."
  - "Light weakens the LED": "LEDs don't care about room light."
  - "The phototransistor blocks the battery": "It's across the base, not in the lamp's path."
  - explain: "The sensor steals the base current that would turn Q1 on."
- **q2** `numeric`: "A phototransistor passes 2 mA at full light and scales evenly with light. What does it pass at light
  0.3?" answer 0.6, unit mA, tolerance 2. explain: "2 mA × 0.3 = 0.6 mA."
- **q3** `choice`: "Your night light turns on too late, only when it's nearly pitch dark. Which way do you turn the trimmer?"
  - (correct) "Toward less resistance": "More base current means it takes more light to steal it, so it switches earlier."
  - "Toward more resistance": "That makes it even less willing to switch on."
  - "Neither, swap the LED": "The LED doesn't set the threshold."
  - explain: "Feeding Q1 more current raises the light level needed to keep it off."
- **q4** `choice`: "How many legs does a typical phototransistor have?"
  - (correct) "Two: collector and emitter": "Light does the base's job."
  - "Three, like any transistor": "Some have a base leg, but most don't."
  - "Four": "Not for a basic phototransistor."
  - explain: "The light-sensitive base usually has no leg at all."
- **q5** `order`: "Order what happens as evening falls." Items: light on PT2 fades → PT2's current drops → more of the
  trimmer's current reaches Q1's base → Q1 turns on → the lamp lights.
  - explain: "Less light means less theft, so Q1 gets its base current back."

**Wrap**

- Rules: "A phototransistor conducts more as light increases." · "To flip a sensor's action, let it steal a transistor's
  base current." · "A trimmer in the base feed sets the switching threshold." · "Without hysteresis, a slow input gives
  a fuzzy switch."
- Try it for real: parts: phototransistor, 2N3904, 50 kΩ trimmer, 4.7 kΩ, 470 Ω, yellow LED, 9 V battery, breadboard.
  Safety: "Nothing risky here. Don't stare into bright lamps while testing."

**Mascot lines:** "Dusk detected. Lamp deployed." · "Light steals the base current. Sneaky but effective." · "Turn the
trimmer, change the sunset."

---

#### Lesson 17. `twin-flasher`: The Twin Blinker

- **Summary:** Build two transistors that switch each other off in turn: an LED flasher with no moving parts.
- **Minutes:** 14 · **Prerequisites:** `night-light`.
- **Objectives:**
  - Build a two-transistor astable multivibrator from a schematic.
  - Explain the cycle: one transistor turning on kicks the other's base negative through a capacitor, and an RC recovery sets the time.
  - Understand negative voltages as differences from the chosen 0 V reference.
  - Estimate the period: about 0.69 × R × C per half, about 1.4 × R × C in total.
- **Unlocks:** parts `[]` · isle `led-lamp`

**Hook**

> The relay buzzer ran by itself, but it clicked, sparked and wore out. Can you make something that runs forever with
> no moving parts? Take two identical transistor switches. Wire each one so that turning on shoves its twin off, and
> give the shove a capacitor so it fades with time. They'll take turns forever, like two kids on a seesaw. The robot
> wants two lamps on its new tower that blink in turn.

Predict: "Both halves of the circuit are identical. When you power it up, which LED lights first?" Options: "The left
one, always" · "The right one, always" · "Whichever transistor happens to be a little quicker".

**Lab `twin-flasher`**

- Board: breadboard. Instruments: meter, scope (2 channels, slow-motion control).
- Initial parts:
  - `B1` battery (standard). `S1` switch "power" `{a: vcc, b: vp}`, closed false.
  - `R1` 1 kΩ `{a: vp, b: a1}`, `D1` led red `{anode: a1, cathode: c1}`, `Q1` npn `{c: c1, b: b1, e: gnd}`.
  - `R2` 1 kΩ `{a: vp, b: a2}`, `D2` led red `{anode: a2, cathode: c2}`, `Q2` npn `{c: c2, b: b2, e: gnd}`.
- Tray: two 68 kΩ (`R3`, `R4`), two 10 µF electrolytics 16 V (`C1`, `C2`), two 22 µF electrolytics 16 V.
- Tasks:
  1. `bases-up`. Prompt: "Add a 68 kΩ resistor from the supply to each transistor's base. Switch on." Goal: both LEDs
     glow above 0.5 and steady (ripple below 0.05). Success: "Two independent switches, both on. Nothing interesting yet.
     Let's make them talk."
  2. `cross-couple`. Prompt: "Add a 10 µF capacitor from Q1's collector to Q2's base, and another from Q2's collector to
     Q1's base. The + leg goes to the collector." Goal: D1 and D2 each blink with a period of 0.6 to 1.3 s, and their
     lit times overlap less than 20%. Hints: "Each capacitor crosses over: collector on one side, base on the other." /
     "Stripe (negative) toward the base." Success: "They take turns! No moving parts, no wear, no clicks."
  3. `look-inside`. Prompt: "Set the scope to slow motion. Channel 1 on Q2's base, channel 2 on Q1's collector." Goal:
     scope has captured Q2's base going below -4 V at least once. Hints: "The scope's ground clip stays on the - rail."
     Success: "Q2's base dives far below zero, then climbs back up along a familiar curve. When it reaches about 0.7 V,
     Q2 switches on."
  4. `slow-it-down`. Prompt: "Swap both capacitors for 22 µF. Predict the new period, then check." Goal: period 1.3 to 2.9
     s. Success: "About twice the capacitance, about twice the period. Same rule as every RC circuit."
- Damage moments: a capacitor wired to its own transistor's base instead of crossing over stops the oscillation (one LED
  stuck on). Swapping the 1 kΩ and 68 kΩ positions starves the LEDs and stalls the flasher. Electrolytics in backwards
  give a `reversed` warning but survive at these currents.
- SIM NEEDS: 2N3904 base-emitter reverse breakdown starting around 7 V (rating 6 V) that clips the negative base swing
  softly without damage at microamp currents; transient solver handling 10 µs to 10 ms steps (also for lesson 18).

**Explain**

1. **The seesaw.** Say Q1 switches on. Its collector drops from about 7 V to nearly 0 V in an instant. The capacitor to
   Q2's base can't change its voltage that fast, so it drags Q2's base down by the same 7 V, to about -6 V. Q2 slams off.
   Now Q2's base slowly climbs back through its 68 kΩ. At about 0.7 V, Q2 turns on and does the same to Q1. Widget idea:
   `seesaw-stepper` (step through the cycle with nodes coloured by voltage).
2. **Below zero?** Voltage is always a difference between two points. We call the battery's negative terminal 0 V, but
   that's just a choice. A capacitor holding 7 V, with its top plate suddenly yanked to 0 V, puts its bottom plate at
   -7 V relative to our reference. Nothing is broken: it's charge sitting on a plate.
3. **How long is a blink?** Each half lasts about 0.69 × R × C: the time for the base to climb from about -6 V to 0.7 V.
   With 68 kΩ and 10 µF that's about 0.47 s, so a full cycle is about 0.94 s. Real ones run 10 to 20% faster, because the
   collector doesn't swing the full 9 V and parts vary.
4. **Who goes first?** Both halves are identical on paper, but no two real transistors are. At switch-on both bases rise
   together and the slightly quicker transistor wins. Engineers call this circuit an astable multivibrator: astable
   because it never settles, multivibrator because its output jumps between two states.

**Quiz**

- **q1** `numeric`: "A flasher uses R = 47 kΩ and C = 22 µF on both sides. Using 1.4 × R × C, what is the full period?"
  answer 1.45, unit s, tolerance 5. explain: "1.4 × 47,000 × 0.000022 ≈ 1.45 s."
- **q2** `choice`: "Why can the base go to about -6 V when the battery's lowest point is 0 V?"
  - (correct) "Voltage is relative, and a charged capacitor can hold one plate below our chosen 0 V": "A sudden drop on one plate drags the other down."
  - "The battery reverses for a moment": "The battery never flips."
  - "It's a measuring error": "The scope is right."
  - explain: "Voltages are differences. The capacitor carries its stored difference below the reference."
- **q3** `choice`: "You connect a capacitor from Q1's collector to Q1's own base instead of crossing over. What happens?"
  - (correct) "It stops oscillating": "Each half no longer kicks the other, so nothing alternates."
  - "It blinks twice as fast": "Without cross-coupling there's no cycle."
  - "Both LEDs blink together": "There's nothing linking them."
  - explain: "The cross-connection is the whole trick."
- **q4** `choice`: "The collector resistor is 1 kΩ. Which base resistor keeps the flasher reliable?"
  - "4.7 kΩ": "Ratio under 10: the base resistor is too strong a pull."
  - (correct) "47 kΩ": "Ratio about 47: comfortably between 10 and 100, and below β."
  - "4.7 MΩ": "Ratio 4,700: far too little base current to switch fully on."
  - explain: "Keep base resistor ÷ collector resistor between about 10 and 100, and below the transistor's β."
- **q5** `order`: "Order one half-cycle, starting with Q1 turning on." Items: Q1 switches on → Q1's collector drops →
  the capacitor drags Q2's base negative → Q2 turns hard off → Q2's base climbs through its resistor → Q2's base reaches
  0.7 V and Q2 turns on.
  - explain: "Each turn-on causes the other's turn-off, and the RC climb sets the timing."

**Wrap**

- Rules: "Two transistors cross-coupled by capacitors take turns forever." · "Each half lasts about 0.69 × R × C." ·
  "Voltage is relative: a capacitor can hold a node below 0 V." · "Keep the base-to-collector resistor ratio between
  about 10 and 100."
- Try it for real: parts: two 2N3904, two red LEDs, two 1 kΩ, two 68 kΩ, two 10 µF 16 V electrolytics, slide switch,
  9 V battery, breadboard. Safety: "Check each electrolytic's stripe faces the base it connects to."

**Mascot lines:** "Your turn, my turn, forever." · "Below zero volts. Don't worry, it's relative." · "No clicks, no
wear. These lamps will outlive me."

---

#### Lesson 18. `flasher-to-tone`: Shrink It to a Song

- **Summary:** Shrink the flasher's capacitors step by step until the blink becomes a buzz, a hum and finally a tone in a speaker.
- **Minutes:** 12 · **Prerequisites:** `twin-flasher`.
- **Objectives:**
  - Relate period and frequency (f = 1 ÷ period), with hertz and kilohertz.
  - Predict how frequency scales with R × C.
  - Drive a speaker with a transistor and a series resistor; explain why a speaker needs changing current.
  - Know the rough limits of seeing flicker and hearing pitch.
- **Unlocks:** parts `[speaker]` · isle `speaker`

**Hook**

> Your flasher blinks about once a second. Here's a thought experiment you can actually run: what if the capacitors were
> a thousand times smaller? The circuit would flip a thousand times faster. Your eyes would give up long before that, but
> your ears would just be getting interested. Add a speaker and shrink the capacitors in steps. Somewhere along the way,
> a blink turns into a song.

Predict: "Make both flasher capacitors 1,000 times smaller. What happens to the frequency?" Options: "1,000 times lower"
· "1,000 times higher" · "About the same".

**Lab `flasher-to-tone`**

- Board: breadboard. Instruments: scope with frequency readout (BENCH NEEDS), meter.
- Initial parts: the lesson 17 flasher with 68 kΩ and 10 µF, plus:
  - `Q3` npn `{c: spb, b: q3b, e: gnd}`, `R6` 4.7 kΩ `{a: c2, b: q3b}`.
  - `R7` resistor 220 Ω, watts 0.5 `{a: vp, b: spa}`. `SP1` speaker `{a: spa, b: spb}`, 8 Ω.
- Tray: pairs of capacitors: 1 µF ceramic ("105"), 100 nF ceramic ("104"), 10 nF ceramic ("103"); a jumper wire.
- Tasks:
  1. `tick-tock`. Prompt: "Switch on and listen." Goal: speaker produces at least 4 click transients in 2 s (current
     steps through SP1) while the LEDs alternate. Success: "Tick... tock. The speaker clicks each time Q3 switches."
  2. `flutter`. Prompt: "Swap both capacitors for 1 µF." Goal: oscillation frequency at Q2's collector 6 to 16 Hz.
     Success: "A rattle. The LEDs flicker too fast to follow but you can still see them flicker."
  3. `hum`. Prompt: "Now 100 nF." Goal: 60 to 160 Hz, and each LED's glow ripple below 0.1. Success: "A low hum, and
     the LEDs look steadily half lit. Your eyes stopped seeing the blinks somewhere around 50 per second."
  4. `song`. Prompt: "Now 10 nF." Goal: speaker tone 800 to 1,600 Hz. Success: "A clear tone! A thousand times smaller
     capacitors, a thousand times higher frequency. Same circuit, new job."
  5. `no-resistor`. Prompt: "Optional: jumper across R7 so the speaker gets no current limit. Listen for a moment." Goal:
     Q3 `died` from overheating (Hall of Fried Parts). Success: "With only the speaker's 8 Ω in the way, Q3 passed about
     200 mA with most of the 9 V across itself: over a watt in a part rated for 0.625 W. It cooked. That's why the
     speaker has a series resistor."
- Damage moments: task 5 by design. Battery current is high meanwhile (battery warms).
- SIM NEEDS: speaker audio stream at 48 kHz from `sim.onAudio`, with a simple acoustic filter (small cone in free air
  loses bass below about 300 Hz; optional "put it in a box" toggle) and a volume limiter; speaker damage above about
  0.5 W sustained.

**Explain**

1. **Hertz.** Frequency counts cycles per second, measured in hertz (Hz). Period is the time for one cycle. They're
   reciprocals: f = 1 ÷ period. A 1 ms period means 1,000 Hz, or 1 kHz. Capital M is mega (millions); lowercase m is
   milli (thousandths). Mixing them up is a billionfold mistake.
2. **Scaling time.** The flasher's timing is set by R × C. Shrink C by 1,000 and every half-cycle is 1,000 times
   shorter, so the frequency is 1,000 times higher. Shrink R instead and the same happens, within limits: keep the base
   resistor between about 10 and 100 times the collector resistor, or the flasher stalls. That's why we changed only
   the capacitors today. Widget idea:
   `frequency-ladder` (slide C from 10 µF to 10 nF and watch the frequency climb from blinks to beeps).
3. **Eyes and ears.** Above about 50 to 60 flashes per second, most people stop seeing flicker: the LEDs just look dimmer.
   Ears pick up roughly 20 Hz to 20 kHz when young, and the top end falls with age and loud noise. Your 1 kHz tone sits
   right where hearing is sharpest.
4. **Inside a speaker.** A speaker is a light coil of wire glued to a paper cone, sitting in a magnet's gap. Current in
   the coil pushes it one way or the other, and the cone pushes air. Only changing current makes sound; steady current
   just heats the coil. An 8 Ω speaker on 9 V would try to draw about 1 A, so the 220 Ω resistor keeps it to about 39 mA.

**Quiz**

- **q1** `numeric`: "A signal repeats every 2 ms. What is its frequency?" answer 500, unit Hz, tolerance 0. explain:
  "1 ÷ 0.002 s = 500 Hz."
- **q2** `choice`: "You divide both base resistors by 10 and both capacitors by 100. The new frequency is..."
  - "10 times higher": "Both changes count."
  - (correct) "1,000 times higher": "R × C shrinks by 10 × 100 = 1,000."
  - "100 times lower": "Smaller R and C make it faster, not slower."
  - explain: "Frequency scales with 1 ÷ (R × C)."
- **q3** `numeric`: "Write 2,500 Hz in kHz." answer 2.5, unit kHz, tolerance 0. explain: "Divide by 1,000."
- **q4** `choice`: "An LED flashes on and off 1,000 times a second. What do you see?"
  - "Rapid flashing": "Far too fast for eyes."
  - (correct) "A steady, slightly dimmer light": "Your eyes average flicker above about 50 to 60 Hz."
  - "Nothing at all": "It's on half the time, so it glows."
  - explain: "Persistence of vision blends fast flashes into a steady glow."
- **q5** `numeric`: "9 V drives an 8 Ω speaker through 220 Ω. What current flows when the transistor is fully on, in mA?"
  answer 39, unit mA, tolerance 3. explain: "9 ÷ (220 + 8) ≈ 0.039 A = 39 mA."
- **q6** `choice`: "Why does a speaker need a changing current to make sound?"
  - (correct) "Sound is air pushed back and forth; a steady current just holds the cone in one place": "Only movement makes waves."
  - "Speakers only work on AC mains": "Our transistor switching makes a changing current from a battery."
  - "Steady current is too weak": "Even a strong steady current makes no sound."
  - explain: "The cone must move to push air. Changes make it move."

**Wrap**

- Rules: "Frequency = 1 ÷ period; 1 kHz = 1,000 Hz." · "Shrink R × C and the frequency rises in proportion." · "Eyes
  blend flicker above about 50 Hz; ears hear about 20 Hz to 20 kHz." · "Never connect a speaker without a series
  resistor or other current limit."
- Try it for real: parts: the flasher, plus a 2N3904, 4.7 kΩ, 220 Ω 1/2 W resistor, 8 Ω speaker, 1 µF, 100 nF and 10 nF
  ceramics. Safety: "Keep the volume sensible and never hold a speaker against your ear while experimenting."

**Mascot lines:** "Blink, flicker, hum, sing. Same circuit!" · "My ears are LEDs. I just see it glowing." · "That
transistor sang its last note. Hall of Fried Parts welcomes it."

---

#### Lesson 19. `siren`: The Siren Button

- **Summary:** Let the slow flasher steer the fast tone generator and build a two-tone siren, then smooth it into a wail. The unit's landmark build.
- **Minutes:** 15 · **Prerequisites:** `flasher-to-tone`.
- **Objectives:**
  - Modulate one oscillator with another: a slow signal changes a fast one's frequency.
  - Explain why gentle resistors, not wires, should join two oscillators.
  - Use an RC filter on a control signal to turn steps into glides.
  - Debug a larger circuit with a calm, systematic routine.
- **Unlocks:** parts `[]` · isle `pushbutton`

**Hook**

> Switchback Isle has lamps that blink and a speaker that sings. Time to give it a voice that means business. You already
> own the two ingredients: a slow oscillator that flips once a second, and a fast one that makes a tone. Let the slow one
> lean on the fast one and the tone will change pitch with every flip. Add one capacitor and the pitch will slide.
> Press the big button and let the whole island hear it.

Predict: "The slow flasher nudges the tone generator up and down each time it flips. What will you hear?" Options: "One
steady tone" · "Two tones taking turns" · "Silence".

**Lab `siren`**

- Board: breadboard (full 830, both rail pairs bridged). Instruments: scope with frequency readout, meter.
- Initial parts (pre-built, labeled "slow" and "fast"):
  - Power: `B1` battery (standard), `S1` pushbutton "siren button" `{a: vcc, b: vp}`.
  - Slow oscillator: as lesson 17 with `Q1`, `Q2`, `D1`, `D2`, 1 kΩ collector loads, 68 kΩ base resistors, 10 µF capacitors.
    Q1's collector node is `c1`.
  - Fast oscillator: `Q3` `{c: c3, b: b3, e: gnd}`, `Q4` `{c: c4, b: b4, e: gnd}`, 1 kΩ collector resistors to `vp`, 68 kΩ
    base resistors to `vp`, 10 nF ceramics `c3` to `b4` and `c4` to `b3`.
  - Driver: `Q5` `{c: spb, b: q5b, e: gnd}`, `R11` 4.7 kΩ `{a: c4, b: q5b}`, `R12` 220 Ω 0.5 W `{a: vp, b: spa}`, `SP1`
    speaker 8 Ω `{a: spa, b: spb}`.
- Tray: `R8` and `R9` 100 kΩ, `R10` 10 kΩ, `C5` 22 µF electrolytic 16 V, two 1 µF ceramics.
- Tasks:
  1. `two-voices`. Prompt: "Hold the siren button. You should see a blink and hear a steady tone." Goal: with S1 held,
     the slow LEDs alternate and the tone stays within 5% of one frequency for 2 s. Success: "Two separate oscillators,
     ignoring each other. Let's introduce them."
  2. `bridge`. Prompt: "Connect R8 from Q3's base to Q1's collector, and R9 from Q4's base to Q1's collector." Goal: the
     tone alternates between two frequencies whose ratio is 1.15 to 1.8, switching every 0.3 to 0.7 s. Hints: "Both
     resistors meet at Q1's collector strip." Success: "Nee-naw! When Q1 is off, its high collector pushes extra current
     into the fast bases: higher pitch. When Q1 is on, it pulls them down: lower pitch."
  3. `wail`. Prompt: "Make it glide: move the joined end of R8 and R9 to an empty strip, connect that strip to Q1's
     collector through R10, and put C5 from that strip to ground (stripe to ground)." Goal: tone range ratio at least
     1.15 and no jump larger than 5% between successive 50 ms windows. Hints: "R10 and C5 make an RC filter, like the
     smoothing in module 4." Success: "Now it swoops up and down. The capacitor turns sudden steps into slopes."
  4. `trill`. Prompt: "Bonus: swap the slow oscillator's 10 µF capacitors for 1 µF." Goal: pitch modulation rate 6 to
     16 per second. Success: "A frantic trill. Every knob you've learned in this unit is now a sound design tool."
- Damage moments: a plain wire instead of R8 or R9 locks the oscillators together into one muddy pitch or stalls the fast
  one (robot explains). Holding the button for long drains the battery faster (total about 40 mA).
- Notice: the slow oscillator's LED faintly glows during its "off" half, because a little current now flows into the
  bridge. Small side effects like this are normal when circuits are joined.

**Explain**

1. **One oscillator steering another.** The fast oscillator's pitch depends on how hard its bases are pulled up. R8 and
   R9 add a second, gentler pull from Q1's collector. When that collector is high, the bases charge faster: higher
   pitch. When it's low, they charge slower: lower pitch. Changing one signal with another is called modulation.
   Widget idea: `modulation-mixer` (slow wave, fast wave and the result on one screen).
2. **Why resistors, not wires?** A wire would tie the two circuits' nodes together so they'd fight, and the fast one
   would stall or both would settle on some in-between rhythm. A 100 kΩ resistor only nudges: it adds a little current
   without taking over. Joining circuits gently is a skill you'll use constantly.
3. **From steps to slides.** Q1's collector jumps between high and low. R10 and C5 form an RC filter, the smoothing trick
   from module 4, so the control voltage rises and falls along curves instead. The pitch follows the curves: a wail
   instead of a two-tone. Bigger C5 means slower, lazier slides.
4. **Calm debugging.** Big circuits fail in small ways. Check the supply first: measure current, and anything over about
   100 mA here means a short. Then, with the black probe on ground, probe each node and compare with what you expect.
   Check part values and orientation, one at a time. If you're stuck, step away for five minutes. It works.

**Quiz**

- **q1** `choice`: "Why join the oscillators through 100 kΩ resistors instead of plain wires?"
  - (correct) "Resistors only nudge the fast oscillator; wires would force the circuits together": "Gentle coupling keeps both oscillating."
  - "Resistors make it louder": "Loudness comes from the driver stage."
  - "Wires are too expensive": "It's about behaviour, not cost."
  - explain: "A resistor adds a little influence. A wire takes over completely."
- **q2** `choice`: "What does C5 do in the wailing siren?"
  - "Sets the tone's pitch": "The 10 nF capacitors set the pitch range."
  - (correct) "Smooths the control voltage so the pitch glides": "With R10 it forms an RC filter."
  - "Protects the speaker": "The 220 Ω does that."
  - explain: "R10 and C5 turn the slow oscillator's square steps into curves."
- **q3** `numeric`: "The siren alternates between 1,400 Hz and 1,900 Hz. What is the ratio of high to low?" answer 1.36,
  tolerance 2. explain: "1,900 ÷ 1,400 ≈ 1.36."
- **q4** `choice`: "Your siren draws 350 mA when you press the button. What's most likely?"
  - (correct) "A short circuit somewhere": "Normal draw is about 40 mA."
  - "A very loud tone": "Volume doesn't explain seven times the current."
  - "A fresh battery": "A battery doesn't force extra current into a healthy circuit."
  - explain: "Measure supply current early. Far too much means a wiring error."
- **q5** `order`: "Order a calm debugging routine." Items: check the supply voltage and current → probe each node with the
  black probe on ground → compare readings with what you expect → check suspect parts' values and orientation → fix one
  thing and test again.
  - explain: "Start broad, then narrow down, changing one thing at a time."

**Wrap**

- Rules: "Modulation: one signal changes another's frequency or level." · "Join circuits through resistors, not wires,
  when you want influence without takeover." · "An RC filter turns steps into slopes." · "Debug from the supply inward,
  one change at a time."
- Try it for real: parts: five 2N3904, two red LEDs, four 1 kΩ, four 68 kΩ, two 10 µF, two 10 nF, two 100 kΩ, 10 kΩ,
  22 µF, 4.7 kΩ, 220 Ω 1/2 W, 8 Ω speaker, pushbutton, 9 V battery, full-size breadboard. Safety: "Keep the volume
  reasonable, and the battery will warm if you hold the button for minutes: give it a rest."

**Mascot lines:** "Nee-naw! The island has a voice." · "Gentle resistors make good neighbours." · "Wail, trill, swoop.
You're a sound designer now." · "Press it once more. For science."

**Module M6 landmark:** see section 4 (`siren-tower`).

---

## 4. Module landmarks

Each landmark appears when the module's last lesson completes (`makeIsle` module event). Captions show in the reveal toast.

| Module | Landmark id | In-world name | Reveal caption |
|---|---|---|---|
| M1 Switches | `switchyard` | The Switchyard | "Copper tracks now fork and rejoin across the island. Every route has a choice." |
| M2 Relays | `relay-clocktower` | The Relay Clocktower | "Its heart is a coil and its voice is a click. Listen: it keeps the island's time." |
| M3 Breadboard | `breadboard-plaza` | Breadboard Plaza | "A town square with hidden copper streets under every row of tiles." |
| M4 Capacitors | `capacitor-water-tower` | The Capacitor Water Tower | "It fills fast, drains slow, and keeps the lamps steady when the supply stutters." |
| M5 Transistors | `transistor-gatehouse` | The Transistor Gatehouse | "A small guard at the gate decides when the great crowd may pass." |
| M6 Blink and beep | `siren-tower` | The Siren Tower | "Two heartbeats, one voice. Switchback Isle can finally call out to the archipelago." |

Visual notes for `packages/isle` (our own designs): the switchyard is a fan of copper rails with switch points; the
clocktower has a translucent face showing a swinging armature; the plaza is a white tiled square with faint copper lines
visible through it; the water tower is an electrolytic can on legs with a minus stripe and a fill gauge; the gatehouse
is a black half-cylinder with three pillars (E, B, C); the siren tower carries two blinking lamps and a speaker cone.

---

## 5. Achievements

XP is added to the learner's total per the fixed rules in `docs/ARCHITECTURE.md`. Conditions are evaluated on lab events
as they happen (so event `data` fields such as `cause` are available) or from the progress record.

| Id | Title | Description | XP | Hidden | Unlock condition |
|---|---|---|---|---|---|
| `either-way` | Either Way Up | Wire a light that either of two switches can flip. | 50 | no | Lab `stairway-light` tasks `two-travelers` and `cross-the-travelers` completed. |
| `pin-sleuth` | Pin Sleuth | Map a mystery switch and a mystery relay without a single wrong guess. | 75 | no | `mystery-switch` task `name-the-legs` and `meet-the-relay` task `energize` each completed with zero incorrect pin-map submissions (LAB NEEDS: count submissions). |
| `first-click` | First Click | Hear a relay pull in. | 25 | no | First `clicked` event from any `relay` part, in any lab or the sandbox. |
| `spark-catcher` | Spark Catcher | See a coil's kickback spark, then tame it with a diode. | 50 | no | Lab `coil-kickback` tasks `watch-the-spike` and `diode-clamp` completed. |
| `buzzed-to-bits` | Buzzed to Bits | Wear out a relay's contacts by letting it buzz. | 25 | yes | A `died` event on a `relay` part with `data.cause: "worn"`. |
| `wrong-way-round` | Wrong Way Round | Vent an electrolytic capacitor by connecting it backwards. | 25 | yes | A `died` event on a polarized `capacitor` with `data.cause: "reverse"`. |
| `tau-tamer` | Tau Tamer | Measure every time constant in the RC lab within 5%. | 75 | no | All four `rc-time-constant` tasks completed, each submitted τ within 5% of the instance's actual τ. |
| `feather-touch` | Feather Touch | Light a lamp at full brightness with the lightest touch. | 50 | no | Lab `touch-switch` task `darlington` completed. |
| `five-second-club` | Five-Second Club | Tune your delay timer to five seconds, three times in a row, within 5%. | 75 | no | In `delay-timer` task `five-seconds`, three consecutive runs measure 4.75 to 5.25 s. |
| `night-shift` | Night Shift | Build your own dusk-activated light in the sandbox. | 50 | no | Sandbox challenge card `dusk-patrol` passed (section 8). |
| `tuning-fork` | Tuning Fork | Make a speaker sing concert A. | 75 | no | Any lab or sandbox circuit holds a speaker tone between 418 and 462 Hz for at least 2 s. |
| `wailer` | Wailer | Make the Siren Tower wail. | 100 | no | Lab `siren` task `wail` completed. |
| `smoke-signals` | Smoke Signals | Fill a shelf of the Hall of Fried Parts with five different Unit 2 parts. | 50 | yes | `fried` contains at least five distinct kinds from {`relay`, `capacitor`, `npn`, `diode`, `speaker`, `phototransistor`, `led`, `resistor`}, with at least one of `relay`, `capacitor`, `npn`. |
| `two-islands` | Two Islands | Complete every lesson on Switchback Isle. | 100 | no | All 19 Unit 2 lessons completed. |

---

## 6. Parts bin entries introduced in this unit

All descriptions are original. "Symbol" describes our own schematic drawing. Ids match `unlocks.parts` above.

**`toggle-switch`: Toggle switch (SPST)** (lesson 1)
- Description: A lever that stays where you flick it. One pole, one throw: on or off.
- Facts: SPST means single pole, single throw. · Stays in position until moved (maintained). · Contacts have a current
  rating; motors need two or more times their running current.
- Symbol: a short lever hinged at one terminal, angled away from the other.
- Safety: "Only switch battery circuits. Mains switches belong to electricians."

**`slide-switch`: Slide switch (SPDT)** (lesson 1)
- Description: A little slider that connects its middle leg to one side or the other. A chooser, not just an on-off.
- Facts: Single pole, double throw: three legs. · The middle leg is usually the pole. · The two outer legs never connect
  to each other. · Breadboard versions have legs 0.1 in (2.54 mm) apart.
- Symbol: a lever hinged at the pole, resting near one of two throws.
- Safety: "Low voltage only."

**`pushbutton`: Pushbutton** (lesson 1)
- Description: A springy button that only stays pressed while you hold it. Most connect when pressed; some disconnect.
- Facts: Momentary action. · Normally open (NO) connects while pressed; normally closed (NC) disconnects while pressed. ·
  Small tactile buttons are rated around 50 mA: keep big surges away from them.
- Symbol: a bar above two contacts (NO) or touching them (NC), with a small plunger.
- Safety: "Add a resistor when a button discharges a capacitor."

**`relay`: Relay (9 V coil)** (lesson 4)
- Description: A switch moved by an electromagnet. A small current in the coil flips contacts that can carry a separate
  circuit.
- Facts: Coil about 540 Ω, about 16.7 mA and 150 mW at 9 V. · Pulls in at about 6 V, lets go below about 2 V (hysteresis).
  · COM touches NC at rest and NO when energized. · Coil and contacts are electrically isolated. · Always fit a diode
  across the coil, band toward positive.
- Symbol: a rectangle for the coil, a changeover switch beside it, linked by a dashed line; drawn at rest.
- Safety: "Never connect relay contacts to mains in this course. Switch off a buzzing relay quickly."

**`potentiometer`: Potentiometer (1 kΩ panel knob)** (lesson 5)
- Description: A resistor with a sliding contact on a knob. Turn it to tap any voltage between its ends.
- Facts: Three legs: two ends and a wiper. · End to end it's always the full value. · Ends to the supply, wiper out: an
  adjustable voltage divider.
- Symbol: a resistor with an arrow pointing at its middle.
- Safety: "Don't put the full supply across a low-value pot's wiper and one end: it can overheat."

**`led-green` and `led-yellow`: Green and yellow LEDs** (lesson 5)
- Description: More colours for your indicators. Same rules as red: long leg positive, always a resistor.
- Facts: Typical forward voltage about 2.0 to 2.2 V (yellow) and about 2.0 to 3.0 V (green, depending on type). ·
  20 mA typical, keep below the rated maximum. · Flat rim marks the cathode.
- Symbol: as the red LED: triangle, bar, two small arrows pointing out.
- Safety: "Never connect an LED without a current limit."

**`diode-1n4001`: Diode 1N4001** (lesson 6)
- Description: A one-way valve for current. Our favourite bodyguard for relay coils.
- Facts: Conducts from anode to cathode; the band marks the cathode. · About 0.7 V drop at small currents, up to about
  1.0 V at 1 A. · Rated 1 A average, 50 V reverse. · Across a coil, band toward positive, it clamps kickback.
- Symbol: a triangle pointing at a bar (no light arrows).
- Safety: "Backwards across a supply, it's a short circuit."

**`scope`: Oscilloscope (bench tool)** (lesson 6)
- Description: A voltmeter that draws a graph over time, fast enough to catch spikes and tones.
- Facts: Plots voltage (up) against time (across). · Trigger freezes a repeating or one-off event. · Slow motion lets you
  watch microsecond events. · Shows frequency and period.
- Symbol: none (instrument).
- Safety: "Real scopes are for low-voltage circuits unless you know exactly what you're doing."

**`breadboard`: Solderless breadboard** (lesson 7)
- Description: A plastic block with hidden spring clips. Push legs in, circuits connect, nothing to solder.
- Facts: 830 holes: 63 rows of two 5-hole strips, plus four power rails. · The center channel separates the two sides. ·
  Holes are 0.1 in (2.54 mm) apart. · Some boards split their rails halfway.
- Symbol: none (a building surface).
- Safety: "Keep wire clippings off the board: they cause shorts."

**`jumper-wires`: Jumper wires** (lesson 7)
- Description: Short pieces of solid wire, cut to length and bent flat, that join strips and rails.
- Facts: Solid 22 AWG (about 0.6 mm) suits breadboards. · Red for +, blue or black for -, other colours for signals. ·
  Cut to length and lie flat so you can see every connection.
- Symbol: a plain line.
- Safety: "Strip insulation with strippers, not teeth."

**`electrolytic-capacitor`: Electrolytic capacitor** (lesson 8)
- Description: A can that stores a lot of charge for its size. Polarized: it has a right way round.
- Facts: Values from about 1 µF to thousands of µF. · Stripe of minus signs and the shorter leg mark negative. · Has a
  voltage rating; exceeding it or reversing it causes leakage, heat and venting. · Typical tolerance ±20%.
- Symbol: two plates, one curved or hollow (negative), often with a + by the straight plate.
- Safety: "Never reverse or overvolt one. Large ones in old equipment can hold dangerous charge."

**`ceramic-capacitor`: Ceramic capacitor** (lesson 10)
- Description: A small bead or disc for small values. Non-polarized: either way round works.
- Facts: Usually 10 pF to about 1 µF. · Three-digit code in pF: 104 = 100 nF. · Letter after the code is tolerance: J 5%,
  K 10%, M 20%. · Through-hole types are usually rated 25 V or more.
- Symbol: two straight parallel plates.
- Safety: "Low voltage parts: fine at 9 V."

**`logger`: Data logger (bench tool)** (lesson 11)
- Description: Records a meter reading many times a second and plots it, so curves become visible.
- Facts: 20 samples per second. · Cursor reads time and value. · Great for RC curves and slow changes.
- Symbol: none (instrument).
- Safety: "None."

**`npn-transistor`: NPN transistor 2N3904** (lesson 13)
- Description: A three-legged current amplifier and switch. A small base current controls a larger collector current.
- Facts: Flat face toward you, legs down: E, B, C. · Gain (β) typically 100 to 300 at 10 mA. · Base turns on at about
  0.7 V above the emitter. · Maximum 200 mA collector current, 40 V collector to emitter, 625 mW. · Saturated, about 0.1
  V from collector to emitter.
- Symbol: a bar (base) with two angled lines; the emitter line carries an arrow pointing out.
- Safety: "Always limit base current with a resistor. Never put a supply straight across two legs."

**`touch-pads`: Touch pads** (lesson 14)
- Description: Two bare contacts close together. A fingertip bridging them makes a high-value resistor.
- Facts: Skin between pads: roughly 100 kΩ (firm, damp) to several MΩ (light, dry). · Use a series resistor to protect
  the base. · Pairs well with a Darlington pair.
- Symbol: two small circles or plates facing each other.
- Safety: "One fingertip, 9 V only, never across two hands or broken skin."

**`trimmer`: Trimmer potentiometer** (lesson 15)
- Description: A tiny adjustable resistor you set with a screwdriver and then leave alone.
- Facts: Values 10 kΩ, 50 kΩ, 100 kΩ in our bin. · Wiper plus one end makes a variable resistor. · Keep a fixed resistor
  in series so it can't reach zero.
- Symbol: a resistor with a short T-shaped adjuster or an arrow.
- Safety: "Don't force the screw past its end stops."

**`phototransistor`: Phototransistor** (lesson 16)
- Description: A transistor with a window. Light lets current through.
- Facts: Usually two legs: collector and emitter. · Current rises with light, up to a few mA in bright light. · Check the
  datasheet for which leg is which. · Backwards it barely conducts.
- Symbol: a transistor symbol with two arrows pointing in, often without a base lead.
- Safety: "Low voltage only; some tolerate only about 5 V in reverse."

**`speaker`: Speaker (8 Ω)** (lesson 18)
- Description: A coil, a magnet and a paper cone. Changing current pushes the cone, and the cone pushes air.
- Facts: About 8 Ω. · Needs changing current; steady current only heats it. · Always use a series resistor or proper
  driver. · Louder in a box, because the box stops the front and back waves cancelling.
- Symbol: a small rectangle with a flared trapezoid (cone) beside it.
- Safety: "Keep volume reasonable. Never connect straight across a battery."

---

## 7. Accuracy checklist

A fact-checker must confirm each value against a current datasheet or standard reference before content ships.

**2N3904 (NPN, TO-92)**
- Pinout: flat face toward viewer, leads down: emitter, base, collector (left to right).
- VCEO 40 V; VCBO 60 V; VEBO 6.0 V (reverse base-emitter rating: relevant to the flasher's negative base swing).
- IC continuous 200 mA; PD 625 mW at 25 °C.
- hFE: 100 to 300 at IC 10 mA, VCE 1 V; minimum 70 at 1 mA; minimum 30 at 100 mA (gain falls at high current: never
  teach "constant gain up to 200 mA").
- VCE(sat) max 0.2 V at IC 10 mA / IB 1 mA; 0.3 V at 50 mA / 5 mA. VBE(on) about 0.65 to 0.7 V at small currents.
- Lesson numbers: 9 V through 470 kΩ: IB ≈ 17.7 µA; through 100 kΩ: about 83 µA; through 10 kΩ: about 0.83 mA.

**1N4001**: 50 V repetitive reverse, 1 A average forward, 30 A surge (8.3 ms), VF max 1.0 V at 1 A.

**Relay (9 V high-sensitivity small-signal class, for example 540 Ω coils)**
- Coil 540 Ω, 16.7 mA, about 150 mW at 9 V.
- Datasheet guarantees: must-operate at most 75% of rated (6.75 V); must-release at least 10% (0.9 V).
- Our sim defaults (typical, inside the guarantees): pull-in 6.0 V, drop-out 1.8 V, ±5% per instance.
- Operate time typically a few ms (datasheet maximum often about 7 ms), release a few ms. Contacts about 2 A at 30 V DC
  for this class; check the exact part.
- Coil inductance default 0.3 H is an engineering estimate: confirm order of magnitude (0.1 to 1 H) or measure.
- Kickback example: 0.3 H, 17 mA interrupted in 10 µs: about 510 V ideal. Quiz q1 in lesson 6: 0.5 H, 20 mA, 10 µs:
  1,000 V.

**RC math (V supply 9.0 V)**
- τ = R × C. 1 kΩ × 1,000 µF = 1 s; 10 kΩ × 1,000 µF = 10 s; 47 kΩ × 22 µF = 1.034 s; 100 kΩ × 10 µF = 1 s.
- Charge: V = Vs × (1 - e^(-t/τ)): 1τ 5.69 V (63.2%), 2τ 7.78 V, 3τ 8.55 V, 4τ 8.84 V, 5τ 8.94 V (99.3%).
- Discharge: V = V0 × e^(-t/τ): 3.31, 1.22, 0.45, 0.16, 0.06 V.
- 12 V supply after 2τ: 10.38 V.
- Relay hold with 1,000 µF across 540 Ω, 9 V to 1.8 V: 0.54 s × ln(5) = 0.87 s. With 470 µF: 0.254 s × ln(5) = 0.41 s.
- Coil plus 1 kΩ divider (lesson 15 task 1): 9 × 540 ÷ 1,540 = 3.16 V.
- Delay timer: t ≈ RC × ln(9 ÷ (9 - 6.7)) = 1.36 RC (ignoring base current). 1 kΩ × 1,000 µF: about 1.4 s. τ 3.6 s:
  about 4.9 s. 1 kΩ + 10 kΩ trimmer with 470 µF: τ from 0.47 to 5.17 s.
- Fill-and-fade (lesson 9): steady C1 voltage with S1 held ≈ 5.4 V (1 kΩ feed, 1 kΩ + LED load).

**Astable multivibrator**
- Half period t ≈ R × C × ln 2 ≈ 0.69 RC when the collector swing ≈ supply; full period ≈ 1.39 RC.
- With an LED in each collector the swing is about 7.3 V: half period ≈ RC × ln(15.6 ÷ 8.3) ≈ 0.63 RC, so real circuits
  run 10 to 20% faster than 1.4 RC predicts.
- 68 kΩ × 10 µF: half 0.47 s, period 0.94 s (≈ 1.06 Hz) nominal; lab accepts 0.6 to 1.3 s.
- Scaling: 1 µF ≈ 10 to 13 Hz, 100 nF ≈ 100 to 125 Hz, 10 nF ≈ 1.0 to 1.3 kHz.
- Ratio rule: base resistor ÷ collector resistor between about 10 and 100, and below the minimum β.
- Siren bridge (two 100 kΩ from both fast bases to the slow collector): computed tones about 1.4 kHz and 1.9 kHz;
  verify in the simulator and adjust lab windows.

**Capacitor codes**: 101 = 100 pF; 102 = 1 nF; 103 = 10 nF; 104 = 100 nF = 0.1 µF; 105 = 1 µF; 222 = 2.2 nF;
223 = 22 nF; 473 = 47 nF; two digits alone (for example "22") = 22 pF. Tolerance letters: J ±5%, K ±10%, M ±20%.
1,000 pF = 1 nF; 1,000 nF = 1 µF.

**Other numbers**
- Breadboard: 63 × 2 × 5 = 630 plus 4 × 50 = 200, total 830.
- LED with 470 Ω on 9 V: (9 - 1.9) ÷ 470 ≈ 15 mA.
- Speaker stage: 9 V ÷ (220 + 8) Ω ≈ 39 mA; resistor dissipation 0.34 W when on continuously (so specify 0.5 W);
  with R7 bypassed, Q3 (IB about 1.1 mA, β 150 to 250) passes roughly 165 to 275 mA with about 6 to 7 V across it,
  so it dissipates over 1 W against a 625 mW rating and fails in seconds. A bare 8 Ω speaker on 9 V would try to draw
  about 1 A (about 0.95 A with the battery's 1.5 Ω).
- Hearing about 20 Hz to 20 kHz (young adults), upper limit falls with age. Flicker fusion about 50 to 60 Hz for most
  people under typical conditions.
- Phototransistor sim scale: about 2 mA at light 1.0 (a bright lamp); real parts vary widely.
- Electrolytic leakage spec rule of thumb: about 0.01 × C × V µA (C in µF) maximum after a few minutes; sim default leak
  should sit well below that.
- Car starter current order of magnitude 100 A or more.

**Corrections we deliberately make (do not regress)**
- The 2N3904 base-emitter reverse rating is only 6 V; the classic flasher exceeds it slightly. Say so in an explain card
  or a sim note, and model soft breakdown.
- Transistor gain is not constant at high current (see hFE above).
- Emitter followers give current gain without voltage gain; common-emitter stages do give voltage gain. Don't say
  "transistors can't amplify voltage".
- Coupling: no charge crosses a capacitor's insulator; explain via charge leaving the far plate (avoid the
  "displacement current" framing for beginners).
- Mains voltages differ by country: 110 to 120 V AC in North America, 220 to 240 V AC in much of the world.

---

## 8. Sandbox unlocks and challenge cards

After Unit 2, the free-build bench (`/bench`) gains every part listed in section 6 plus the scope and logger. Available
values in the sandbox tray:

- Resistors: Unit 1 values plus 100 Ω, 220 Ω (0.25 W and 0.5 W), 4.7 kΩ, 10 kΩ, 22 kΩ, 47 kΩ, 68 kΩ, 100 kΩ, 220 kΩ,
  470 kΩ, 1 MΩ.
- Capacitors: ceramic 1 nF, 10 nF, 22 nF, 47 nF, 100 nF, 1 µF; electrolytic 1 µF, 10 µF, 22 µF, 47 µF, 100 µF, 470 µF,
  1,000 µF (16 V), plus a 100 µF 6.3 V (for the curious).
- Switches: toggle, slide, pushbutton (NO and NC); relay (9 V); trimmers 10 kΩ, 50 kΩ, 100 kΩ; potentiometer 1 kΩ.
- Semiconductors: red, green and yellow LEDs; 1N4001; 2N3904 (up to 8); phototransistor (up to 2).
- Output: speaker 8 Ω. Props: lamp-and-shade light control, touch pads.

Challenge cards (each checked by a small goal script, same helpers as labs):

1. **`dusk-patrol`: Dusk Patrol.** "Build a lamp that switches itself on when the light falls below 0.2 and is off above
   0.5." Check: an LED glows above 0.5 at light 0.15 and below 0.05 at light 0.5. Hint: "Let the light steal a
   transistor's base current." Reward: `night-shift` achievement.
2. **`doorbell-memory`: The Lingering Doorbell.** "Press a button briefly; an LED stays lit for 3 to 5 seconds after you
   let go, then goes out." Check: after a press shorter than 0.5 s, the LED stays above 0.3 glow for 3 to 5 s. Hint: "A
   capacitor can hold a transistor's base up for a while."
3. **`tuning-fork`: Concert A.** "Make the speaker sing 440 Hz, within 5%." Check: tone 418 to 462 Hz for 2 s. Hint:
   "Start from your tone generator and adjust R or C; a trimmer in one base helps fine-tune." Reward: `tuning-fork`.
4. **`relay-metronome`: Relay Metronome.** "Make a relay tick 60 times a minute, give or take 10%, with no button held."
   Check: K pull-in events every 0.9 to 1.1 s for 10 cycles. Hint: "Self-switching plus a capacitor, then tune with a
   series resistor."
5. **`both-or-either`: Both or Either.** "Two buttons, two LEDs. The green LED lights only when both are pressed; the
   yellow lights when either is pressed." Check: green follows A AND B, yellow follows A OR B over all four combinations.
   Hint: "Series for both, parallel for either." Foreshadows Unit 4's logic gates.

---

## 9. SIM NEEDS, BENCH NEEDS and LAB NEEDS (summary)

### SIM NEEDS (beyond the current contract; all are additive: new optional params, kinds or event types)

1. **Relay dynamics.** Armature delay: operate about 4 ms, release about 3 ms (optional params `operateMs`, `releaseMs`);
   pull-in and drop-out hysteresis (fields exist); per-instance spread ±5%; `clicked` events on both transitions with
   `data.to: "no" | "nc"`; armature position 0..1 in `PartState.extra` for animation. Needed for the buzzer (lesson 8)
   to oscillate at a realistic 50 to 150 Hz instead of the solver step.
2. **Relay coil inductance.** Optional `coilHenries` (default about 0.3 H) for kickback (lesson 6) and realistic release
   with a protection diode.
3. **Contact arc and wear.** Opening contacts (switch, pushbutton, spdt, relay) break down above about 300 V across the gap,
   conduct briefly, and emit a new `spark` event. Contacts accumulate wear from sparks and from surge currents; past a
   threshold the part dies with `data.cause: "worn"` (contacts stuck open). Buzzing for about 20 s should wear out a
   relay (lesson 8).
4. **Normally closed pushbutton.** Optional `normallyClosed?: boolean` on `pushbutton`.
5. **Ganged switches.** Either a `dpdt` kind (`com1, a1, b1, com2, a2, b2`) or a shared actuator id on two `spdt` parts
   (lesson 2). Optional second pole on `relay` (`com2, no2, nc2`) for sandbox realism; no Unit 2 lab requires it.
6. **Electrolytic behaviour.** Leakage (optional `leakOhms`, default about 1 MΩ at rated voltage), small ESR (about 0.1 to
   1 Ω) so shorting a charged capacitor has a finite current, reverse-voltage model (leakage grows over seconds, heats,
   `reversed` then `died` with `data.cause: "reverse"`), overvoltage model against `volts` (`data.cause: "overvoltage"`),
   per-instance tolerance ±20% exposed to labs as the actual value.
7. **2N3904 model.** Ebers-Moll or Gummel-Poon-lite with per-instance β (150 to 250 at 10 mA, falling at high current),
   VBE about 0.65 V at 1 mA, VCE(sat) 0.05 to 0.2 V, reverse-mode β 1 to 5 (with a `reversed` event), soft base-emitter
   reverse breakdown starting near 7 V (no damage at microamps), damage above 200 mA or 625 mW (`data.cause:
   "overcurrent"` or `"overheat"`), near-instant death with an unlimited base drive.
8. **Phototransistor model.** IC ≈ 2 mA × light (0..1), dark current about 100 nA, VCE(sat) about 0.2 V, negligible
   reverse conduction with a `reversed` event.
9. **Speaker.** Audio stream (`sim.onAudio`, 48 kHz) from speaker current, simple acoustic high-pass (around 300 Hz in
   free air, lower with an optional enclosure toggle), output limiter; damage above about 0.5 W sustained.
10. **LED perception.** Brightness averaged over about 30 ms (fast switching looks half bright) plus a short peak-hold so
    a sub-millisecond pulse of 10 mA or more reads as a visible blip (kickback flash in lesson 6).
11. **Transient range.** Adaptive time step from about 10 µs (1 to 2 kHz oscillators, kickback) to tens of ms (RC
    timers), real time for circuits up to five transistors plus a relay; slow-motion down to 1/1,000.
12. **Battery shorts and diodes.** A forward-biased 1N4001 across the battery must heat the diode and flag `shorted`
    (lesson 6 damage moment).

### BENCH NEEDS (`packages/bench`)

- Mystery mode for parts: hides pin labels and shuffles leg-to-node mapping with a per-learner seed (lessons 2 and 4).
- "Peek inside" translucency for switches and relays; exploded relay view; capacitor fill gauge ring.
- Breadboard x-ray, hover-highlight of a hole's whole net, split-rail board variant, relay footprint that straddles the
  channel, "lift one lead" action.
- Props: lamp-and-shade light slider driving `light` inputs; fingertip touch prop driving a `probe-resistance` part's
  `ohms` (100 kΩ to 2 MΩ via pressure and moisture sliders); a clear "blast box" lid for the capacitor pop.
- Oscilloscope: 2 channels, ground clip, edge and single-shot trigger, 100 µs to 2 s per division, frequency and period
  readout, slow-motion link to the sim.
- Data logger: 20 samples per second with plot and cursor. Stopwatch that can auto-start on a switch event and stop on a
  relay event.

### LAB NEEDS (`apps/web/src/lab`)

- Panels: continuity table (lesson 1), pin-map labeling form with submission counting (lessons 2 and 4), truth-table
  auto-logger (lesson 3), symbol canvas (lesson 2), numeric answer entry checked against instance values (lessons 5, 11,
  13, 15).
- Goal helpers: event counts in a time window (`clicked`), period and frequency of a node or part, glow history (peak,
  ripple, time above a level), relay event timing relative to a switch event, instance values of toleranced parts
  (`lab.actual("C1").farads`, `lab.beta("Q1")`).
- Auto-tapper: toggles a pushbutton's `pressed` input at a set rate (lesson 12).
- Fried-part flow: every `died` event shows the robot's explanation card and offers "Replace part" (lab state continues).
