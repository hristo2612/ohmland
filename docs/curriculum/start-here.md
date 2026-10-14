# Start here: blueprint

Status: build sheet for the new first unit, variant C "Case files" from `docs/curriculum/foundations-options.md`, in the
bench-first lesson format and under `docs/DESIGN-PRINCIPLES.md`. Content authors turn each lesson into a lab file
(`content/labs/<id>.ts`) plus a thin `lesson.yaml`. Text in double quotes is final learner-facing copy. Anything marked
**NEW** goes beyond today's contracts (`docs/ARCHITECTURE.md`, `docs/LABS.md`, `apps/web/src/lab/define.ts`,
`packages/sim/src/types.ts`) and is collected in section 6.

All content is original. Facts come from standard physics and the research notes; no wording, titles or figures are
taken from any book. Follow `docs/CONTENT.md`: no em dashes, no emoji, units with a space, conventional current.

---

## 1. How a Start here lesson works

Each lesson is a small mystery (a "case") on the bench. The learner never leaves the bench (3D or 2D ink view, same
state). There is no hook page, no explain cards and no quiz page.

**Beats.** A lesson is a short sequence of beats. Only the current beat is visible. A beat has:

1. a robot line (red pencil, at most 12 words),
2. exactly one thing to do: a bench action with a goal, a prediction (ungraded chips), or a bench check (tap a part,
   pick a chip, type a number; graded on the first try like a quiz item),
3. optionally, what the bench answers with: a discovery note drawn onto the part that caused it (ink, at most 6 words),
   and sometimes a rule stamped into the notebook margin (at most 8 words).

**Within 5 seconds.** Beat 1 always asks for a bench action the learner can do at once.

**Three-period lesson** for every new part or word:

- Period 1, "This is...": the name arrives as a note on the part at the moment it is seen.
- Period 2, "Show me...": a tap on the bench. A wrong tap is not marked wrong: the tapped thing shows its own name.
- Period 3, "What is this?": a chip check near the end of the lesson.

**Control of error lives in the bench.** The lamp stays dark, the tracer stops at the gap, the wheel will not turn, the
part slides back out of the wrong drawer. Wrong is never a red flash; the robot nudges.

**Mission.** Each case has a title and 2 to 4 objectives. Objectives are not shown as a list. They group beats, carry
the task ids that progress and XP already use, and fill the robot's eyes in equal steps as each one completes.

**Secret objective.** One optional bonus per case, offered only after the required objectives ("Secret: ..."). Never
needed later.

**Fix-it round.** The case closes with one broken bench and one fault to repair. Relaxed by default: no timer, no score
on screen, hints and "Show me" always there. The first try still counts quietly toward XP.

**Pop-up card.** At most one per lesson, only for an idea the simulator cannot show (the safety shelf is the only one in
this unit).

**Notebook page.** Fills itself as the case runs: the title, an ink sketch of the bench, every discovery note, every
rule stamp, the learner's predictions in blue ink, a tick for the fix-it round, and a "?" box that fills if the secret
was found. The last beat signs it off with a "Case closed" stamp.

**Word budget.** Main path (every quoted line in a lesson's beats table, including the secret invitation, the fix-it
and the sign-off) stays under 150 words. Hints and alternative feedback appear only on demand and stay under 60 words.
The notebook page reuses the same strings, so it adds nothing. Counts are given per lesson.

**Voice.** Robot lines: the cheeky-but-kind sidekick from `design/round2/lessons/tones.html`, one playful line in four,
never cheeky about a mistake. Notes on parts: terse field notes, lower case, numbers when they help.

---

## 2. Unit overview

- **Unit id:** `start-here` · **Shown name:** Start here · **Placed before** `basics`.
- **Island:** its own small island, working name Sketch Isle: an ink sketch on grid paper that inks itself in as pieces
  land (optional theme I2). A cable bridge leads to Bareboard Isle.
- **Lessons:** 12, 4 to 8 minutes each, about 77 minutes. Wave 1 ships 11 of them; `rub-and-stick` ships in wave 2.
- **Story glue:** the arrival scene moves here. The learner crosses the bridge, the robot's LED face is flickering on
  fumes, and every case brings back a little light. The unit ends with the robot's face glowing faintly and the bridge
  to Bareboard Isle extending.
- **Order of ideas:** loop, then conductors and insulators, then charge, then flow, push and squeeze as feelings, then
  where push comes from. Only then the meter, whose dial words (V, A, Ω) the learner already owns. Then prefixes, the
  breadboard, symbols, and a first build from a drawing.

### 2.1 Modules and landmarks

| Module | Id | Lessons | Landmark id | Landmark name | Reveal caption | Robot line |
|---|---|---|---|---|---|---|
| M1 First cases | `first-cases` | 1 to 4 | `spark-gap` | The Spark Gap | "Two copper horns, and a small spark dancing between them." | "Gaps, charge, flow. Three cases closed." |
| M2 Push and squeeze | `push-and-squeeze` | 5 to 7 | `pump-house` | The Pump House | "A battery lift raises glowing marbles round a loop of track." | "Push, squeeze, and a pump that runs down." |
| M3 Tool cases | `tool-cases` | 8 to 12 | `meter-tower` | The Meter Tower | "A tower with a glowing display rises by the bridge." | "Now the island can measure itself." |

`spark-gap` and `pump-house` are new landmarks; `meter-tower` moves from Basics, whose module `your-meter` dissolves.
Module 1 still ends on lesson 4 when lesson 3 has not shipped.

### 2.2 Lesson list

| # | Lesson id | Case title | Min | Wave | One big idea | New word or part | Island piece | Parts unlocked |
|---|---|---|---|---|---|---|---|---|
| 1 | `welcome-to-the-bench` (moved, v+1) | The dark lamp | 5 | 1 | Flow needs a closed loop, metal on metal | loop | `led-lamp` | `battery-9v`, `alligator-clips` |
| 2 | `will-it-light` | The junk drawer | 6 | 1 | Conductors let flow through, insulators stop it | clip lead; conductor, insulator | `test-lead-arch` | none |
| 3 | `rub-and-stick` | The clingy balloon | 6 | **2** | Rubbing moves charge; on an insulator it sits still | static | `capacitor` | none |
| 4 | `the-flow` | The counting gates | 6 | 1 | Flow is the same all the way round | flow; gate | `wire-spool` | none |
| 5 | `the-push` | Two boxes, one lamp | 6 | 1 | Push drives the flow; an LED needs enough of it | push | `battery` | `battery-aa` |
| 6 | `the-squeeze` | The stubborn knob | 6 | 1 | Squeeze anywhere slows the whole loop | squeeze; resistor | `pot` | `resistor` |
| 7 | `pocket-power` | The tired battery | 7 | 1 | A battery is a chemical pump that runs down | chemical pump | `cell-jar` | none |
| 8 | `meet-the-meter` (moved, v+1) | The black box | 8 | 1 | The meter turns push into a number | meter | `meter-kiosk` | `multimeter`, `test-leads` |
| 9 | `milli-and-kilo` | The prefix padlock | 5 | 1 | k is a thousand, m is a thousandth | kilo, milli | `header-fence` | none |
| 10 | `holes-that-hold-hands` | The secret wiring | 8 | 1 | Hidden metal strips join the holes | breadboard; strip, rail | `breadboard-patch` | `breadboard`, `jumper-wires` |
| 11 | `parts-drawer` | The mixed-up drawer | 6 | 1 | A symbol draws what a part does | symbol | `resistor` | none |
| 12 | `first-glow` (moved, v+1) | The torn blueprint | 8 | 1 | A drawing shows connections, not places | drawing | `jumper-arch` | `led-red` |

Totals: 77 minutes (71 in wave 1). New ids are checked unique against Units 1 and 2. The three moved ids keep their
progress, the task ids whose action survives, and the `first-reading` and `glow-getter` achievements.

`resistor` and `led-red` were unlocked by Basics lessons before; the parts bin is a union, so nothing breaks. Basics'
`reading-the-stripes` and U2 `breadboard-inside` simply unlock nothing new for these ids any more.

### 2.3 Standard bench (unless a lesson says otherwise)

| Name | Bench part | Netlist | Notes |
|---|---|---|---|
| Bench battery `B1` | `battery` (9 V body) | `battery` emf 9.4, internalOhms 1.7, mAh 500 | Fresh 9 V alkaline. |
| Lamp resistor `R1` | `resistor` ohms 1000, watts 0.25 | `resistor` | With the red LED: about 7.5 mA, a clear glow. |
| Lamp `D1` | `led` color red, maxmA 50 | `led` | Called "my lamp" by the robot until lesson 11 names it. |
| Switch `S1` | `toggle-switch` base: true | wired `com` to `b` | "On" is thrown to b; `lab.closed("S1")`. |
| Clip leads `TL1`... | test leads, 0.15 Ω each | `wire` ohms 0.15 | |

No lesson in this unit burns out a part on purpose. Basics keeps the LED burnout, the stacked cells and the numbers.

### 2.4 How each lesson is written below

- **Case:** mission title and the robot's intro line (beat 1).
- **Bench:** starting parts, leads, tray and instruments.
- **Beats:** the main path, in order. Copy in quotes. "Do" is the one action; "Bench answers" is the note, rule or check.
- **Objectives:** task ids (kept or new), their goals as `LabView` code, and which beats they cover.
- **Checks:** every graded bench check with its answer.
- **Secret, Fix-it, Notebook, Robot lines, On demand, Words.**

---

## 3. Module 1: First cases (`first-cases`)

Landmark `spark-gap`. Summary for `module.yaml`: "Dark lamps, a junk drawer, a clingy balloon and two counting gates."

---

### SH1. `welcome-to-the-bench`: The dark lamp

- **Minutes** 5 · **Wave** 1 · **Island piece** `led-lamp` · **Unlocks** `battery-9v`, `alligator-clips` · **Version** bump.
- **Big idea:** Flow needs a closed loop, with metal touching metal all the way round.
- **New:** the word "loop". (Clip leads are named in SH2, the switch in SH11.)
- **Case:** "The dark lamp". Robot intro (beat 1): "My desk lamp is dark. Flip its switch?"

**Bench.** Desk, no board. B1, S1 (off), R1, D1 as in 2.3, all locked. Leads: TL1 from **`wrap:B1`** (the plastic wrapper
beside the + snap; NEW P2) to S1.com, TL2 S1.b to R1.a, TL3 R1.b to D1.anode, TL4 D1.cathode to B1.neg. Tray: one blue
clip lead (for the secret). Loop tracer on (NEW V7).

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "My desk lamp is dark. Flip its switch?" | Flip S1. | Still dark. |
| 2 | "Still dark. Tap the battery's minus snap." | Tap B1.neg: the tracer inks the path lead by lead. | Ink runs all the way round and stops one clip short. Note on TL1's clip: "plastic: a gap" |
| 3 | "Move that clip onto the metal snap." | Clip TL1 onto B1.pos. | Lamp glows; tracer circles the whole loop. Note around it: "a loop: metal all the way round". Rule: "Flow needs a closed loop." |
| 4 | Predict: "Unclip a lead far from the lamp. The lamp will..." chips "stay lit", "dim", "go dark" | Unclip any lead end. | Dark at once. Note on the loose clip: "one gap, all dark" |
| 5 | "Clip it back." | Reattach the loose end. | Glows. |
| 6 | Check: "What is this, all the way round?" chips "a loop", "a lamp", "a line" | Pick a chip (period 3). | Answer "a loop". |
| 7 | Secret: "Secret: swap the battery's two clips." | Optional: swap TL1 and TL4 on the snaps. | Dark. Note on D1: "backwards: dark, no harm" |
| 8 | Fix-it: "Lamp two is dark. Your turn." | Repair the second lamp. | Glows. Note on the block: "wood: a gap" |
| 9 | "Case closed. First light in ages." | Sign the page. | Stamp, eyes full, island piece. |

Period 2 for "loop" is beat 4: the learner shows they know where the loop is by breaking it.

**Objectives** (2 eyes)

- O1 Find the gap: `close-the-switch` (kept; goal now `lab.closed("S1")`), `find-the-gap` (new;
  `lab.closed("S1") && lab.isLit("D1")`).
- O2 Break it, mend it: `break-the-loop` (kept; `lab.closed("S1") && lab.bench.detachedLeadEnds >= 1 &&
  lab.loopOpen("D1")`), `mend-the-loop` (kept; `lab.isLit("D1")`).
- Secret: `swap-battery-leads` (kept, bonus; `lab.closed("S1") && (lab.part("D1")?.v ?? 0) < -1 &&
  (lab.part("D1")?.glow ?? 1) < 0.01`).
- Fix-it: `fix-it` (new). Goal on the fix-it bench: `lab.isLit("D1")`.

**Checks:** beat 6, answer "a loop".

**Fix-it bench.** A second lamp, same parts, S1 on. Fault: TL2's clip bites **`base:S1`** (the switch's wooden block,
NEW P2) instead of S1.b. Fix: move it onto the screw terminal.

**Notebook page:** "Case 1: The dark lamp". Sketch of the four-part loop with the gap circled at the wrapper. Notes from
beats 2, 3, 4 (and 7 if found), the rule stamp, the beat 4 guess in blue, a tick for the fix-it.

**Robot lines:** start = beat 1. Success = beat 9. Hint (on demand, any beat): "Follow the ink. Where does it stop?"
Fried (no part can die here; used if a lead shorts the battery): "Whoa, a shortcut. Unclip that one."

**On demand:** beat 1 "The lever on the wooden block." · beat 3 "Drag the clip onto the shiny snap." · beat 4 "Drag
any clip off its part." · fix-it "Tap a snap. Watch where the ink stops."

**Words:** main path 99, on demand 40.

---

### SH2. `will-it-light`: The junk drawer

- **Minutes** 6 · **Wave** 1 · **Island piece** `test-lead-arch` · **Unlocks** none.
- **Big idea:** Conductors let flow through; insulators stop it.
- **New:** "clip lead" (part); "conductor" and "insulator" (a pair of words for one idea).
- **Case:** "The junk drawer". Robot intro: "This is a clip lead. One went missing."

**Bench.** The lamp loop without its switch: B1, R1, D1, locked, with a gap between two free clips (TL2.b and TL3.a,
held apart on the desk). Junk drawer: everyday objects as `sample` parts (NEW P1: more materials), each with a clip
point at each end: K1 key, SP1 plastic spoon, CN1 coin, E1 rubber eraser, F1 foil strip, MB1 glass marble, WS1 wooden
stick, P1 pencil lead. Two `bin` trays, BIN-YES and BIN-NO, labelled "lets flow through" and "stops flow". Tray: one
spare red LED.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is a clip lead. One went missing." then "Show me a clip lead." | Tap any clip lead (period 2). | A wrong tap shows that part's name. |
| 2 | "Find a stand-in. Clip the key across the gap." | Bridge the gap with K1. | Glows. Note on K1: "metal: lets flow through" |
| 3 | Predict: "Now the plastic spoon. Lit or dark?" chips "lit", "dark" | Bridge with SP1. | Dark. Note on SP1: "plastic: stops flow" |
| 4 | "Flow-lovers are conductors. Flow-stoppers are insulators." | Drop K1 and SP1 in their trays. | Trays relabel: "conductors", "insulators". |
| 5 | "Sort the rest. Guess a tray, then test it." | For CN1, E1, F1, MB1, WS1: drop in a tray, then bridge the gap. | A wrong guess slides to the other tray by itself. Rule: "Metals conduct. Plastic, rubber, glass and wood don't." |
| 6 | Check: "What is this?" (E1 glows) chips "a conductor", "an insulator" | Pick a chip (period 3). | Answer "an insulator". |
| 7 | Secret: "Secret: try the pencil lead." | Optional: bridge with P1. | Glows. Note on P1: "graphite conducts. Not a metal!" |
| 8 | Fix-it: "This paper clip is coated. Make it work." | Move a clip from the coating to the bare end. | Glows. Note: "coating insulates, bare end conducts" |
| 9 | "Case closed. The key gets the job." | Sign the page. | |

**Objectives** (2 eyes)

- O1 Find a stand-in: `try-the-key` (new; `lab.isLit("D1") && lab.amps("K1") > 0.001`), `try-the-spoon` (new;
  `bridged(lab, "SP1") && lab.loopOpen("D1")` for 0.5 s via `lab.heldFor`).
- O2 Sort the drawer: `sort-the-drawer` (new). Each of CN1, E1, F1, MB1, WS1 has been bridged once (`lab.memory`
  records `bridged` with the result) and sits in the right tray: `lab.holds("BIN-YES")` is `CN1`, `F1`, `K1` in any
  order and `lab.holds("BIN-NO")` is `E1`, `MB1`, `SP1`, `WS1`.
- Secret: `pencil-lead` (bonus; `lab.isLit("D1") && lab.amps("P1") > 0.001`).
- Fix-it: `fix-it`. Fix-it bench: the same gap bridged by PC1, a coated paper clip whose jaws can bite `coat:PC1`
  (no node) or `PC1.bare` (NEW P2). Goal: `lab.isLit("D1") && lab.amps("PC1") > 0.001`.

`bridged(lab, id)` is a helper in `content/labs/lib/`: `lab.joins(id, "TL2.b", "TL3.a")`.

**Checks:** beat 6, answer "an insulator". (The sorting in beat 5 is the learner's period 2 for the two words.)

**Notebook page:** "Case 2: The junk drawer". Two columns drawn as trays, each object sketched in its column; the notes,
the rule, the spoon guess in blue; secret box for the pencil lead.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Clip one jaw on each end." Fried (an LED can die only if a
learner bridges R1 with metal and the lamp straight across the battery): "Oof. That lamp skipped its resistor. Spare's
in." (The tray has a spare LED.)

**On demand:** beat 2 "One jaw on each end of the key." · beat 5 "Not sure? Test first, then sort." · fix-it "Find the
shiny end."

**Words:** main path 102, on demand 32.

---

### SH3. `rub-and-stick`: The clingy balloon (wave 2)

- **Minutes** 6 · **Wave** 2 (needs the static toy, NEW P4) · **Island piece** `capacitor` · **Unlocks** none.
- **Big idea:** Rubbing moves charge; on an insulator the charge sits still. That is static.
- **New:** "static" (charge that sits still).
- **Case:** "The clingy balloon". Robot intro: "This balloon hangs on the wall. Nothing holds it."

**Bench.** Static toy (its own small pure model, not the circuit simulator): a balloon stuck to the wall, a fresh
balloon BL1, a wool scarf, paper bits on the desk, a plastic comb, a metal spoon; minus marks show charge on things.
For the secret, a second balloon BL2 on a string.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This balloon hangs on the wall. Nothing holds it." then "Rub this one on the scarf." | Rub BL1 on the scarf (drag back and forth). | Minus marks gather on BL1. Note: "charge, rubbed off the wool" |
| 2 | "Hold it over the paper bits." | Drag BL1 near the paper. | Bits hop up and cling. Note: "charge pulls" |
| 3 | Predict: "Put it on the wall. It will..." chips "fall", "stick" | Touch BL1 to the wall. | It sticks. Note on BL1: "rubber holds the charge still". Rule: "Charge that sits still is static." |
| 4 | "Show me the static." | Tap BL1's marked patch (period 2). | |
| 5 | Check: "Can it keep my lamp lit?" chips "yes", "no" | Pick a chip. | Answer "no". Note: "a lamp needs flow round a loop" |
| 6 | Check: "What is this?" (marks glow) chips "static", "flow", "a gap" | Pick a chip (period 3). | Answer "static". |
| 7 | Secret: "Secret: rub both balloons. Hang them side by side." | Optional: charge BL2, hang them close. | They swing apart. Note: "same charge pushes apart" |
| 8 | Fix-it: "I rubbed a metal spoon. No hop. Fix it." | Rub the plastic comb instead, hold it over the paper. | Bits hop. Note on the spoon: "metal: the charge runs off" |
| 9 | "Case closed. Charge can wait." | Sign the page. | |

**Objectives** (2 eyes; the static model exposes `lab.static(id)` = net charge, NEW)

- O1 Charge it: `rub-it` (`lab.static("BL1") < -k`), `paper-hop` (paper bits lifted while BL1 is charged).
- O2 Make it stick: `stick-it` (BL1 held on the wall for 2 s without falling).
- Secret: `two-balloons` (bonus; BL1 and BL2 both charged, hung within reach, apart angle above 10 degrees).
- Fix-it: `fix-it` (paper bits lifted by the comb).

**Checks:** beat 5 "no"; beat 6 "static". Wrong on beat 5: "A spark is one quick jump. A lamp needs steady flow."

**Notebook page:** "Case 3: The clingy balloon". Sketch: balloon with minus marks on the wall; notes; rule; wall guess
in blue.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "More rubs, more charge." Fried: none possible.

**On demand:** beat 1 "Drag it back and forth across the wool." · beat 8 "Plastic holds charge. Metal lets it go." ·
beat 5 wrong answer above.

**Words:** main path 108, on demand 30.

Nothing later depends on this case except one optional contrast in SH4's notebook ("static sits still, flow moves").

---

### SH4. `the-flow`: The counting gates

- **Minutes** 6 · **Wave** 1 · **Island piece** `wire-spool` · **Unlocks** none.
- **Big idea:** Flow goes all the way round, the same everywhere. The lamp uses none of it up.
- **New:** "flow" (word); "gate" (a clip-on flow counter, NEW V2).
- **Case:** "The counting gates". Robot intro: "Does my lamp eat some of the flow?"

**Bench.** The lamp loop with S1 (off), flow dots on (NEW V1: dots ride leads and parts at a speed from the part's
current, plus to minus). Tray: gates G1, G2 (clip onto a lead; tick and show a rate bar, no numbers yet).

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Does my lamp eat some of the flow? Switch on." | Flip S1. | Lamp glows, dots stream. Note on TL1: "flow: from + round to −" |
| 2 | "This is a gate. It counts the flow." | Clip G1 on TL3, into the lamp. | G1 ticks. |
| 3 | Predict: "Gate two goes after the lamp. It counts..." chips "less", "the same", "more" | Clip G2 on TL4, out of the lamp. | Same ticks. Note between the gates: "same flow in, same flow out". Rule: "Flow is the same all the way round." |
| 4 | "Show me the flow. Make it stop." | Flip S1 off (period 2). | Dots and gates stop together, everywhere. |
| 5 | Check: "What is this?" (dots glow) chips "flow", "a gap", "a loop" | Pick a chip (period 3). | Answer "flow". |
| 6 | Secret: "Secret: flip the dots to show electrons." | Optional: tap the dots toggle. | Dots crawl backwards, very slowly. Note: "electrons drift − to +, slower than a snail" |
| 7 | Fix-it: "The gate ticks. The lamp's dark. Find the shortcut." | Unclip the extra lead across the lamp. | Lamp glows. Note: "a shortcut steals the flow" |
| 8 | "Case closed. My lamp eats nothing." | Sign the page. | |

**Objectives** (2 eyes; NEW `lab.gate(id)` = the current through the lead it is on, 0 when unclipped)

- O1 Watch it flow: `see-the-flow` (`lab.closed("S1") && lab.isLit("D1")`), `first-gate` (`lab.gate("G1") > 0.001`
  with G1 on a lead in the loop).
- O2 Count both sides: `same-both-sides` (G1 on a lead into D1.anode, G2 on a lead from D1.cathode,
  `Math.abs(lab.gate("G1") - lab.gate("G2")) < 1e-5` and both above 1 mA), `stop-it` (`lab.loopOpen()` after O2's
  first task).
- Secret: `show-electrons` (bonus; the dots toggle set to electrons for 3 s).
- Fix-it: `fix-it`. Fix-it bench: the lamp loop on, gate on TL1, plus TLX from D1.anode to D1.cathode. Goal:
  `lab.isLit("D1")` (the learner removes or unclips TLX).

**Checks:** beat 5, answer "flow".

**Notebook page:** "Case 4: The counting gates". Sketch: the loop with two gates and equal tick marks; notes; rule;
the beat 3 guess in blue.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Gates clip onto a lead, like a clip." Fried (only through
the learner's own shortcut across R1 and D1): "Oof. Too much flow for my lamp. Fresh one in."

**On demand:** beat 2 "Drag the gate onto the lead going into the lamp." · beat 3 "Gate two: the lead coming out." ·
fix-it "Follow the dots. Where do they skip the lamp?"

**Words:** main path 98, on demand 43.

---

## 4. Module 2: Push and squeeze (`push-and-squeeze`)

Landmark `pump-house`. Summary for `module.yaml`: "Two sealed boxes, a stubborn knob and a battery that ran down."

---

### SH5. `the-push`: Two boxes, one lamp

- **Minutes** 6 · **Wave** 1 · **Island piece** `battery` · **Unlocks** `battery-aa`.
- **Big idea:** Push drives the flow. A red LED needs enough push before it glows.
- **New:** "push". Its unit, volts (V), arrives on the battery labels at the end.
- **Case:** "Two boxes, one lamp". Robot intro: "Two sealed boxes. Which one lights my lamp?"

**Bench.** A lamp module: R1 and D1 joined, with a red clip (to R1.a) and a black clip (from D1.cathode) left free.
Two sealed boxes (NEW P7), each showing only a + and a − terminal: box A holds X1 (`battery` size "aa", emf 1.58,
internalOhms 0.15), box B holds B1 (9 V). Push view toggle (NEW V3) available from beat 3. Tray (fix-it only): a fresh
9 V battery.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Two sealed boxes. Which one lights my lamp?" | Clip the lamp to box A, red to +. | Dark. |
| 2 | "Now box B." | Move both clips to box B. | Glows. |
| 3 | "Switch on the push view." | Tap the push view. | Ink hatching rises on each box: B's hill is far taller. Note on B: "push: it drives the flow" |
| 4 | "Show me the box with more push." | Tap box B (period 2). | |
| 5 | Predict: "What's inside box A?" chips "a small push", "nothing", "a broken lamp" | Open both lids. | An AA cell (1.5 V) and a 9 V battery. Note on the labels: "push is counted in volts, V" |
| 6 | (no line) | | Note on box A: "1.5 V: too little for my lamp". Rule: "A red LED needs about 2 V of push." |
| 7 | Check: "What is this?" (B's hill glows) chips "push", "flow", "a loop" | Pick a chip (period 3). | Answer "push". |
| 8 | Secret: "Secret: find two points with no push between." | Optional: tap two points. | Note: "same lead, no push across it" |
| 9 | Fix-it: "My reading lamp runs on one AA. Fix it." | Swap the AA for the 9 V from the tray. | Glows. Note: "9 V: plenty of push" |
| 10 | "Case closed. Box B had the push." | Sign the page. | |

Beat 6 is drawn without a robot line: the bench speaks.

**Objectives** (3 eyes)

- O1 Test both boxes: `box-a-dark` (lamp clips on box A's terminals, red on +, `(lab.part("D1")?.glow ?? 0) < 0.05`
  held 0.5 s), `box-b-lit` (`lab.isLit("D1")` with the clips on box B).
- O2 See the push: `push-view` (NEW `lab.view("push")` true).
- O3 Open the boxes: `open-boxes` (NEW `lab.lidOpen("BOXA") && lab.lidOpen("BOXB")`).
- Secret: `no-push-here` (bonus; a tap check, both taps on one node).
- Fix-it: `fix-it` (`lab.isLit("D1")` with the fresh battery in the loop).

**Checks:** beat 7 "push"; secret tap pair (any two anchors on one node).

**Notebook page:** "Case 5: Two boxes, one lamp". Sketch: both boxes, lids open, with hatched push hills; notes; rule;
the beat 5 guess in blue.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Red clip to +, black clip to −." Fried: none expected
(a reversed lamp only stays dark): "Backwards is just dark. Swap the clips."

**On demand:** beat 1 "Red clip on the + terminal." · beat 8 "Try both ends of one clip lead." · fix-it "The tray has
a bigger push."

**Words:** main path 104, on demand 31.

---

### SH6. `the-squeeze`: The stubborn knob

- **Minutes** 6 · **Wave** 1 · **Island piece** `pot` · **Unlocks** `resistor`.
- **Big idea:** Squeeze holds back the flow, and squeeze anywhere slows the whole loop.
- **New:** "squeeze" (word) and "resistor" (part).
- **Case:** "The stubborn knob". Robot intro: "Turn this box's knob. Watch my lamp."

**Bench.** B1, D1 and a sealed box KB with a knob on top, in one loop with clip leads. Inside KB: a 10 kΩ `trimmer`
used as a variable resistor (wiper and one end) in series with a fixed 470 Ω, so the loop never has less than 470 Ω
(about 16 mA at the knob's low end, about 0.7 mA at the top). The knob is a control bound to the trimmer's
`position`. Flow dots on. Gates G1, G2 in the tray. Tray: RS "small squeeze" (470 Ω) and RB "big squeeze" (10 kΩ),
tags hide the stripes' values.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Turn this box's knob. Watch my lamp." | Turn the knob up. | Lamp dims; dots slow. |
| 2 | "Clip a gate on each side of the box." | Clip G1 before KB, G2 after it. | Both tick. |
| 3 | Predict: "Turn it up again. Which gate slows?" chips "the one after", "the one before", "both" | Turn the knob. | Both slow together. Note: "both slow at once". Rule: "Squeeze anywhere slows the whole loop." |
| 4 | "Open the box." | Lift the lid. | A trimmer and a resistor. |
| 5 | "This is a resistor. It squeezes the flow." | Tap the knob's resistor. | Note on it: "resistor: a set squeeze" |
| 6 | "Show me a resistor." | Tap RS or RB in the tray (period 2). | A wrong tap shows that part's name. |
| 7 | Predict: "Big squeeze in. My lamp will be..." chips "brighter", "dimmer" | Swap KB for RB. | Dim. Note on RB: "big squeeze: dim" |
| 8 | Check: "What is this?" (RS glows) chips "a resistor", "a gate", "a lamp" | Pick a chip (period 3). | Answer "a resistor". |
| 9 | Secret: "Secret: put both resistors in the loop." | Optional: RS and RB in series. | Dimmer still. Note: "two squeezes add up" |
| 10 | Fix-it: "Too dim to read by. Fix it." | Swap RB for RS. | Bright. Note: "small squeeze: bright" |
| 11 | "Case closed. A resistor hid in there." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Turn the knob: `turn-the-knob` (`lab.control("knob") >= 0.8` and D1's glow fell by at least 0.3 since the task
  began, from `lab.history("glow:D1")`).
- O2 Gates both sides: `both-gates` (G1 and G2 on leads either side of KB, the knob moved by 0.3 or more while both
  are on, and their readings stay within 1% of each other: `lab.stats` on NEW `gate:G1` and `gate:G2` sources).
- O3 Meet the resistor: `open-the-box` (`lab.lidOpen("KB")`), `big-squeeze` (`lab.seriesLoop(["B1", "RB", "D1"])` or
  with RB after D1, and `lab.isLit("D1", 0.02)`).
- Secret: `two-squeezes` (bonus; RS and RB both in one series loop with D1 lit, any order: `lab.chain`).
- Fix-it: `fix-it` (RS in the loop, RB out, `lab.isLit("D1", 0.4)`).

**Checks:** beat 8, answer "a resistor".

**Notebook page:** "Case 6: The stubborn knob". Sketch: the opened box, the loop with two gates and short tick marks;
notes; rule; both guesses in blue.

**Robot lines:** start = beat 1. Success = beat 11. Hint: "Gates clip on the leads either side." Fried: none possible
(470 Ω minimum): "Nothing broke. Squeeze keeps my lamp safe."

**On demand:** beat 2 "One gate on the lead in, one on the lead out." · beat 7 "Unclip the box, clip in the big
squeeze." · fix-it "Which squeeze makes it bright?"

**Words:** main path 110, on demand 38.

---

### SH7. `pocket-power`: The tired battery

- **Minutes** 7 · **Wave** 1 · **Island piece** `cell-jar` · **Unlocks** none.
- **Big idea:** A battery is a chemical pump. It runs down as its chemicals are used up.
- **New:** "chemical pump" (what a battery is). The pop-up card adds which power sources are bench-safe: the same
  object family, and the one place in the unit where safety must sit.
- **Case:** "The tired battery". Robot intro: "Yesterday my lamp was bright. Today, dim. Who did it?"

**Bench.** The lamp loop on B1 with its charge started low (NEW: battery `charge` start parameter, 0.08 of 500 mAh, so
the time-lapse empties it in a few seconds of real time). A desk `clock` and a time-lapse control (`key: "speed"`,
existing). Push view on. An AA cell XA on a stand for the cutaway (NEW V6). Tray: a fresh 9 V battery B2. Fix-it bench:
a second lamp with a flat battery.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Yesterday my lamp was bright. Today, dim. Who did it?" | Press fast-forward. | Hours fly on the clock; the lamp fades; the push hill sinks. Note on B1: "push sinking, hour by hour" |
| 2 | "Peek inside a battery." | Tap the AA's x-ray. | Two chemicals behind a thin wall. Note: "a chemical pump" |
| 3 | Check: "What ran out?" chips "the chemicals", "the electrons" | Pick a chip. | Answer "the chemicals". Rule: "A battery runs down as its chemicals get used." |
| 4 | "Fit a fresh battery." | Swap B1 for B2. | Bright again. |
| 5 | Card: "Bench-safe or hands-off?" | Sort the shelf (pop-up card, below). | Each item gets its stamp. |
| 6 | Secret: "Secret: unclip the lamp, then fast-forward." | Optional. | The push hill barely moves. Note: "no flow, no drain" |
| 7 | Fix-it: "My torch is dim. Fix it." | Find the flat battery and swap it. | Bright. Note: "fresh push" |
| 8 | "Case closed. The chemicals did it." | Sign the page. | |

**Pop-up card: the danger shelf** (NEW P5; info only, never simulated). Drag seven items onto "bench-safe" or
"hands-off". Each lands with a stamp line:

| Item | Tray | Stamp line |
|---|---|---|
| AA cell | bench-safe | "1.5 V. Bench-safe." |
| 9 V battery | bench-safe | "9 V. Bench-safe." |
| Coin cell | bench-safe | "Bench-safe. Never let small children have one." |
| Wall socket | hands-off | "230 V or 120 V. It can kill." |
| Car battery | hands-off | "Only 12 V, but huge flow into a short." |
| Phone battery | hands-off | "Lithium. Can burn if damaged." |
| Camera flash | hands-off | "Holds about 300 V, even switched off." |

A wrong drop slides to the other side and shows its stamp line. The card counts as one graded check (all seven right
on the first try).

**Objectives** (3 eyes)

- O1 Catch it running down: `fast-forward` (the speed control above 1000 for long enough that B1's NEW `extra.soc`
  reading drops below 0.02, and D1's glow is below 0.05).
- O2 Look inside: `peek-inside` (NEW `lab.view("xray:XA")` true).
- O3 Fresh battery: `fresh-battery` (`lab.seriesLoop(["B2", "R1", "D1"]) && lab.isLit("D1", 0.3)`).
- Secret: `no-flow-no-drain` (bonus; `lab.loopOpen()` while the speed control runs at 1000 or more for at least 10
  simulated hours, with B2's `soc` falling by less than 0.01).
- Fix-it: `fix-it` (the fresh battery in the torch loop, `lab.isLit("D1", 0.3)`).

**Checks:** beat 3 "the chemicals" (wrong: "Electrons stay in the wire. The chemicals got used."); the shelf card.

**Notebook page:** "Case 7: The tired battery". Sketch: the clock, a fading lamp in three stages, the AA cutaway; notes;
rule; the shelf with its stamps; secret box.

**Robot lines:** start = beat 1. Success = beat 8. Hint: "Watch the push hill while time flies." Fried: none possible:
"Nothing burned. It just ran out."

**On demand:** beat 1 "The fast-forward button is by the clock." · beat 3 wrong answer above · fix-it "Push view
shows the tired one."

**Words:** main path 71 plus the card 42, total 113; on demand 35.

---

## 5. Module 3: Tool cases (`tool-cases`)

Landmark `meter-tower` (moved from Basics). Summary for `module.yaml`: "A black box, a padlock, a secret wiring job, a
mixed-up drawer and a torn blueprint."

---

### SH8. `meet-the-meter`: The black box

- **Minutes** 8 · **Wave** 1 · **Island piece** `meter-kiosk` · **Unlocks** `multimeter`, `test-leads` · **Version**
  bump.
- **Big idea:** The meter turns push into a number, in volts. The sign says which side is plus.
- **New:** "meter" (part). Its dial shows the words already known: V push, A flow, Ω squeeze.
- **Case:** "The black box". Robot intro: "Is there a battery in this box? Which side is plus?"

**Bench.** A sealed box BX (NEW P7) with two identical brass terminals, T1 and T2, no marks. Inside: B1 9 V, plus on a
seeded side. The meter M1, dial off, both plugs on the desk. On a shelf: B3, a worn 9 V (`worn: true`, emf 7.6,
internalOhms 6) for the secret. Fix-it bench: a fresh 9 V and a meter with red in VΩ but the dial on mA.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Is there a battery in this box? Which side is plus?" then "This is a meter. Plug black into COM." | Plug black into COM. | Note on COM: "black lives here" |
| 2 | "Red goes into VΩ." | Plug red into VΩ. | |
| 3 | "Look: your words are on the dial." | Turn the dial to 20 in the V part. | Note on the dial: "V push, A flow, Ω squeeze" |
| 4 | "Show me where the meter counts flow." | Tap the A part of the dial (period 2). | |
| 5 | Predict: "If it's a fresh 9 V, it reads..." chips "exactly 9", "a bit under", "a bit over" | Touch a probe to each terminal. | About 9.4, maybe with a minus sign. Note on the display: "9.4 V: a fresh 9 V" |
| 6 | "Now swap the probes." | Swap red and black. | The sign flips. Note: "minus: red is on the − side" |
| 7 | Check: "Tap the plus terminal." | Tap T1 or T2. | Answer: the terminal red touched on the plus reading. |
| 8 | "Open the box." | Lift the lid. | The battery's + snap sits under the tapped terminal. |
| 9 | Check: "What is this?" (the meter glows) chips "a meter", "a gate", "a battery" | Pick a chip (period 3). | Answer "a meter". |
| 10 | Secret: "Secret: measure the tired battery on the shelf." | Optional. | About 7.6. Note: "same label, less push left" |
| 11 | Fix-it: "My meter reads zero on a fresh battery. Fix it." | Turn the dial to 20 in the V part. | About 9.4. Note on the dial: "A counts flow. Push needs V." |
| 12 | "Dial to OFF. Case closed." | Turn the dial to OFF. | Stamp. |

**Objectives** (3 eyes)

- O1 Set up: `plug-in` (kept; `lab.meter.black === "com" && lab.meter.red === "vohm"`), `set-dial` (kept;
  `lab.meter.mode === "dcv" && lab.meter.range === "20V"`).
- O2 Read the box: `read-battery` (kept; probes on T1 and T2 either way, `Math.abs(lab.meter.value) >= 9.0 &&
  Math.abs(lab.meter.value) <= 9.6`), `swap-probes` (kept; a reading of each sign logged across the box:
  `lab.readings()` holds one at 9.0 or more and one at -9.0 or less).
- O3 Name the plus: the beat 7 check, then `open-the-box` (new; `lab.lidOpen("BX")`).
- Secret: `tired-battery` (kept, bonus; `lab.across("B3", "either")`, |value| 7.2 to 8.0).
- Fix-it: `fix-it` (`lab.meter.mode === "dcv"` and |value| 9.0 to 9.6 across the fresh battery).
- Exit habit: the dial to OFF (no task, as today).

`first-reading` (achievement) still unlocks on `read-battery`.

**Checks:** beat 7 (plus terminal); beat 9 "a meter".

**Fix-it note for the simulator:** with the dial on mA and red in VΩ, the meter must read 0.00 and nothing may blow
(the VΩ socket is not part of the current path). Verify in `packages/sim` (NEW S-check).

**Notebook page:** "Case 8: The black box". Sketch: the open box, the meter with its dial words, both readings (9.4 and
-9.4) in blue; notes; secret box.

**Robot lines:** start = beat 1. Success = beat 12. Hint: "Black in COM. Red in VΩ. Then the dial." Fried (the meter's
mA fuse can only blow if a learner moves red to mA and probes the battery): "Pop. The meter's fuse saved it. Spare's
in the tray."

**On demand:** beat 3 "The V part has 200m, 2, 20 and 200." · beat 5 "Both probe tips on the brass, at once." · fix-it
"Which letter on the dial means push?"

**Words:** main path 129, on demand 43.

---

### SH9. `milli-and-kilo`: The prefix padlock

- **Minutes** 5 · **Wave** 1 · **Island piece** `header-fence` · **Unlocks** none.
- **Big idea:** A prefix moves the decimal point three places: k is a thousand, m is a thousandth.
- **New:** "kilo" (k) and "milli" (m), one idea.
- **Case:** "The prefix padlock". Robot intro: "The cabinet's locked." then "The gate counts amps now. Tap the A."

**Bench.** The lamp loop on, gate G1 on TL3 in number mode (NEW V2 numbers: "0.0075 A", with a unit button). The knob
box KB from SH6 on the desk, its tag reading "10 kΩ". The parts cabinet, locked by a three-wheel padlock (NEW U2).
Inside the cabinet: SH12's parts. Fix-it bench: a drawer labelled "470 Ω" holding a resistor tagged "4.7 kΩ".

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "The cabinet's locked." then "The gate counts amps now. Tap the A." | Tap G1's unit button. | 0.0075 A becomes 7.5 mA; the point hops three places. Note: "m: milli, a thousandth" |
| 2 | "Now tap the k on the knob's tag." | Tap the k in "10 kΩ". | It becomes "10,000 Ω". Note: "k: kilo, a thousand". Rule: "k is a thousand. m is a thousandth." |
| 3 | "Show me a milli." | Tap the m among three tags "4.7 kΩ", "20 mA", "9 V" (period 2). | |
| 4 | Wheel 1: "4.7 kΩ is..." chips "47 Ω", "470 Ω", "4,700 Ω" | Pick a chip. | Answer "4,700 Ω". The wheel clicks. |
| 5 | Wheel 2: "20 mA is..." chips "0.2 A", "0.02 A", "0.002 A" | Pick a chip. | Answer "0.02 A". Click. |
| 6 | Wheel 3: "9 V is..." chips "90 mV", "900 mV", "9,000 mV" | Pick a chip. | Answer "9,000 mV". The cabinet opens. |
| 7 | Check: "What does k mean?" chips "a thousand", "a thousandth" | Pick a chip (period 3). | Answer "a thousand". |
| 8 | Secret: "Secret: find the tag with a capital M." | Optional: tap the "2.2 MΩ" tag inside the cabinet. | Note: "M: mega, a million. Case matters!" |
| 9 | Fix-it: "This drawer's label is wrong. Fix it." | Type the right label, in ohms. | Answer 4700 Ω. Note: "4.7 kΩ = 4,700 Ω" |
| 10 | "Case closed. Three wheels, three thousands." | Sign the page. | |

Control of error on the wheels: a wrong chip does not click; the decimal point slides to where that chip would put it.
No timer. (The timed round of the options doc is dropped: nothing in this unit is timed.)

**Objectives** (3 eyes)

- O1 Milli: `tap-the-a` (NEW `lab.gateUnit("G1") === "mA"`).
- O2 Kilo: `tap-the-k` (NEW `lab.tagShown("KB") === "10,000 Ω"`).
- O3 Open the padlock: `open-padlock` (the three wheel checks answered right, on any try).
- Secret: `mega` (bonus; the M tag tapped).
- Fix-it: `fix-it` (a number check: 4700, unit Ω, tolerance 0).

**Checks:** beat 3 (the m in "20 mA"); wheels 1 to 3; beat 7 "a thousand"; fix-it 4700 Ω.

**Notebook page:** "Case 9: The prefix padlock". Sketch: the padlock's three wheels with their pairs; the hop of the
decimal point drawn as three little arcs; notes; rule.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "Three places, every time." Fried: none possible.

**On demand:** beat 4 "k means times a thousand." · beat 5 "m means divide by a thousand." · fix-it "Move the point
three places right."

**Words:** main path 119, on demand 21.

---

### SH10. `holes-that-hold-hands`: The secret wiring

- **Minutes** 8 · **Wave** 1 · **Island piece** `breadboard-patch` · **Unlocks** `breadboard`, `jumper-wires`.
- **Big idea:** Hidden metal strips join the holes: strips of five, long rails, and a gap down the middle.
- **New:** "breadboard" (part); "strip" and "rail" (names for the hidden metal).
- **Case:** "The secret wiring". Robot intro: "This is a breadboard. My lamp's in, but dark."

**Bench.** Half board (`board: "half"`, 400 holes). B1 on the near rails (`at: "rails"`). R1 from `rail+:8` to `a8`.
D1 with its long leg in `c8` and its short leg in `e8` (same strip, on purpose). Jumper W1 from `a9` to `rail-:9`.
Meter M1 (for the secret) on the desk, dial off. Fix-it bench: the same build working except W1 goes to `rail+:9`.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "This is a breadboard. My lamp's in, but dark." | Switch on x-ray. | Metal strips show under the holes. Note: "five holes, one metal strip" |
| 2 | "Tap a hole. See who it holds hands with." | Tap two holes. | Each lights its strip. Note at the middle: "the gap splits the strips" |
| 3 | Check: "Why is my lamp dark?" chips "both legs, one strip", "lamp broken", "no battery" | Pick a chip. | Answer "both legs, one strip". Note on strip 8: "same strip: no push across" |
| 4 | "Move the short leg next door." | Move D1's short leg to strip 9. | Glows. Note: "each leg, its own strip". Rule: "A part needs its legs in different strips." |
| 5 | "The long stripes are rails. Slide the jumper along one." | Move W1's rail end far along the − rail. | Still glows. Note: "a rail runs the whole length" |
| 6 | "Show me a strip. X-ray off." | Hole hunt: tap every hole joined to the marked one, 3 rounds (period 2). | |
| 7 | Check: "What is this?" (a strip glows) chips "a strip", "a rail", "a jumper" | Pick a chip (period 3). | Answer "a strip". |
| 8 | Secret: "Secret: turn the meter to the beep. Touch an empty strip." | Optional: beep two holes of one empty strip, then two across the gap. | Note: "beep: joined. Silence: a gap." |
| 9 | Fix-it: "My second lamp is dark. Fix it." | Move W1's rail end from + to −. | Glows. Note: "red stripe +, blue stripe −" |
| 10 | "Case closed. The holes hold hands in fives." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Look inside: `xray-on` (NEW `lab.view("xray")` true), `tap-two-holes` (two hole taps recorded by the x-ray view).
- O2 Mend the lamp: the beat 3 check, then `move-the-leg` (`lab.isLit("D1")` with D1's two legs on different nodes:
  `!lab.connected("D1.anode", "D1.cathode")`).
- O3 The long way: `slide-the-jumper` (W1's rail end at least 10 columns from where it began, `lab.isLit("D1")`),
  `hole-hunt` (the existing `hole-hunt` panel: three rounds, one strip, one hole by the middle gap, one rail).
- Secret: `beep-a-strip` (bonus; `lab.meter.mode === "continuity" && lab.meter.beep` with both probes in holes of one
  strip that carries no part, then silence with the probes either side of the middle gap).
- Fix-it: `fix-it` (`lab.isLit("D1")` with W1 on a − rail hole).

**Checks:** beat 3 "both legs, one strip"; the hole hunt (3 rounds); beat 7 "a strip".

**Notebook page:** "Case 10: The secret wiring". Sketch: a strip of five drawn as x-ray metal under the holes, the LED
legs before and after; notes; rule; secret box.

**Robot lines:** start = beat 1. Success = beat 10. Hint: "X-ray on. Look under the legs." Fried (a leg in the wrong
place can join the rails directly; the battery is `shorted`, nothing dies): "Whoa, a shortcut across the rails. Pull
that one."

**On demand:** beat 4 "Drag the short leg one hole over." · beat 6 "Same number, same side: joined." · beat 8 "Beep
tests like a part with no power." · fix-it "Which stripe is minus?"

**Words:** main path 137, on demand 39.

---

### SH11. `parts-drawer`: The mixed-up drawer

- **Minutes** 6 · **Wave** 1 · **Island piece** `resistor` · **Unlocks** none.
- **Big idea:** A symbol draws what a part does.
- **New:** "symbol" (word), shown on four drawers. The LED gets its proper name here too.
- **Case:** "The mixed-up drawer". Robot intro: "The drawer labels fell off. Only symbols left."

**Bench.** The tester from SH2: B1, R1 and the lamp D9 in a loop with a gap between two free clips. Four drawers
(`bin` parts, NEW: a symbol face each): battery, switch (a hinged gap), resistor (zigzag), LED (triangle, bar, two
little arrows). Loose parts: B2 (9 V), S2 (toggle switch, one throw), RB (10 kΩ), D1 (red LED). Fix-it bench: the
same drawers with RB in the switch drawer and S2 in the resistor drawer.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "The drawer labels fell off. Only symbols left." then "This is a battery's symbol. Pop it in." | Drop B2 in the battery drawer. | Note on the symbol: "long line: +" |
| 2 | "Clip the switch into the gap. Flip it." | Bridge with S2, flip it. | On, off. Note on the switch symbol: "a gap you open and close" |
| 3 | "Now the LED. Try it both ways." | Bridge with D1, then turn it round. | Lit one way, dark the other. Note: "LED: one way only". Rule: "LED: long leg toward +." |
| 4 | (no line) | | Note on the LED symbol's triangle: "it points the way flow goes" |
| 5 | "And the resistor." | Bridge with RB. | The lamp dims. Note on the zigzag: "squeeze (a box, in many countries)" |
| 6 | "File them all." | Drop S2, D1 and RB in their drawers. | A wrong drawer will not close. |
| 7 | "Show me the LED's symbol." | Tap it (period 2). | |
| 8 | Check: "What is this?" (the zigzag glows) chips "resistor", "switch", "LED" | Pick a chip (period 3). | Answer "resistor". |
| 9 | Secret: "Secret: two lines cross, no dot. Joined?" chips "yes", "no" | Optional chip pick. | Answer "no". Note: "no dot, no join" |
| 10 | Fix-it: "Someone filed two parts wrong. Fix it." | Swap RB and S2 into the right drawers. | Both close. |
| 11 | "Case closed. Every drawer has its picture." | Sign the page. | |

**Objectives** (3 eyes)

- O1 Switch and battery: `file-battery` (`lab.heldBy("B2") === "DR-BAT"`), `test-switch` (S2 bridges the gap, and
  D9 has been lit and dark with it while S2 changed: `lab.memory`).
- O2 One-way LED: `led-both-ways` (D1 bridges the gap lit forward, then reversed with `(lab.part("D1")?.v ?? 0) < -1`
  and D9 dark).
- O3 File the parts: `test-resistor` (RB bridges the gap, D9 glow lower than with a plain clip), `file-all`
  (`lab.heldBy` of S2, D1 and RB are their drawers).
- Secret: `dot-rule` (bonus; chip "no").
- Fix-it: `fix-it` (RB and S2 back in their drawers).

**Checks:** beat 7 (tap the LED symbol); beat 8 "resistor"; secret "no".

**Notebook page:** "Case 11: The mixed-up drawer". The four symbols drawn large, each beside a tiny sketch of its part,
with the notes; the rule; secret box.

**Robot lines:** start = beat 1. Success = beat 11. Hint: "Test it first. Its job tells the drawer." Fried (only if a
learner bridges B2 straight across the lamp): "Oof. Too much push for my lamp. Fresh one in."

**On demand:** beat 3 "Long leg on the red clip side." · beat 6 "Match each job to its picture." · fix-it "Which
picture squeezes?"

**Words:** main path 105, on demand 34.

---

### SH12. `first-glow`: The torn blueprint

- **Minutes** 8 · **Wave** 1 · **Island piece** `jumper-arch` · **Unlocks** `led-red` · **Version** bump.
- **Big idea:** A drawing shows connections, not places.
- **New:** "drawing" (a circuit drawn in symbols). Everything else is known.
- **Case:** "The torn blueprint". Robot intro: "Half my blueprint tore off. The LED's missing."

**Bench.** Half board. The cabinet from SH9, open: B1 (snap), resistors tagged "1 kΩ", "470 Ω" and "10 kΩ", D1 red LED,
two jumpers. A drawn schematic card (NEW S1): battery and 1 kΩ resistor drawn, the LED's part torn off. Fix-it bench: the
same circuit built on the board with D1 backwards.

**Beats**

| # | Robot | Do | Bench answers |
|---|---|---|---|
| 1 | "Half my blueprint tore off. The LED's missing." | Drag the LED symbol onto the torn edge, turned the right way. | It snaps in. Note: "the triangle points from + toward −" |
| 2 | "Build it on the board. Follow the lines." | Place B1 on the rails, the 1 kΩ, D1 and a jumper. | Glows. Note on the card: "each line: a connection" |
| 3 | "Tap a symbol. Its part lights up." | Tap two symbols. | Each part glows on the bench. |
| 4 | "Show me the part for the zigzag." | Tap R1 (period 2). | |
| 5 | Predict: "Move the LED to another row. The drawing..." chips "changes", "stays the same" | Move D1 and its wiring; keep it glowing. | The card does not change. Note: "parts moved, drawing stayed". Rule: "A drawing shows connections, not places." |
| 6 | Check: "Same circuit?" (two different-looking benches) chips "same", "different" | Pick a chip (period 3). | Answer "same". |
| 7 | Secret: "Secret: put the resistor after the LED." | Optional. | Same glow. Note: "one loop: order doesn't matter" |
| 8 | Fix-it: "Last case. This board's lamp won't light." | Turn D1 round. | Glows. Note: "long leg toward +" |
| 9 | "Case closed. You built that from a drawing!" | Sign the page. | My face glows; the bridge to Bareboard Isle extends. |

**Objectives** (3 eyes)

- O1 Mend the blueprint: `mend-blueprint` (new; NEW `lab.drawing("card").complete`, the LED symbol pointing from the
  battery's + side).
- O2 Build it: `build-loop` (kept; `lab.isLit("D1") && lab.seriesLoop(["B1", "R1", "D1"])` with R1 the 1 kΩ and every
  part seated in holes). `glow-getter` still unlocks here.
- O3 Read the drawing: `match-symbols` (kept, now required; two symbols tapped and the zigzag check right), `move-it`
  (new; D1's holes differ from where `build-loop` found them and `lab.isLit("D1") && lab.seriesLoop(["B1", "R1",
  "D1"])`).
- Secret: `swap-order` (kept, bonus; `lab.isLit("D1") && lab.seriesLoop(["B1", "D1", "R1"])`).
- Fix-it: `flip-led` (kept id, now the fix-it; `lab.isLit("D1")` after D1 is turned round on the fix-it bench).
- Dropped: `no-resistor` (the LED burnout stays in Basics' `led-burnout`).

**Checks:** beat 4 (tap R1); beat 6 "same".

**Notebook page:** "Case 12: The torn blueprint". The mended drawing, taped together, beside a sketch of the board
build; notes; rule; secret box. The unit's last page carries a "Start here: complete" stamp.

**Robot lines:** start = beat 1. Success = beat 9. Hint: "Follow one line at a time." Fried (no resistor in the loop):
"Oof. My lamp skipped its resistor. Spare's in the cabinet."

**On demand:** beat 1 "The triangle points away from +." · beat 2 "Battery on the rails first." · beat 5 "Keep every
line's connection." · fix-it "Which leg is the long one?"

**Words:** main path 96, on demand 36.

---

## 6. NEW NEEDS (sim, bench, lab runtime, lesson player)

Already there today and used as is: `battery` sizes `aa` and `coin` and the `worn` look, `bin` and `tag` parts with
`lab.holds` and `lab.heldBy`, the `clock`, the time-lapse control (`key: "speed"`, up to 3600), room lights, the
`hole-hunt` panel, the bench's x-ray toggle and hover nets, the continuity beep (`lab.meter.beep`), `lab.joins`,
`lab.chain`, `lab.stats`, `lab.history`, the battery's state of charge in the simulator (`extra.soc`).

Built since, on the bench, simulator and lab runtime side, in both views (how to use them: `docs/LABS.md`, "Start
here props", "Overlays", the LabView table and "For the lesson player"): V1 flow dots, V2 gates, V3 the push view, V6
the AA cutaway, V7 the loop tracer, P1 everyday objects, P2 insulated spots, P4 the static toy, P7 sealed boxes, B1 a
battery's starting `charge`, B2 drawer faces, B3 the cabinet's padlock, B4 tag taps, and S1's card and torn piece (the
symbol taps are controller targets: `part:SD1/R1`). Strips on a breadboard are not hatched by the push view (leads and
jumpers are). The lesson player side (R1 to R11, P5, S3) is not part of that work.

### 6.1 Lesson player and lab runtime

| Id | Need | Size | Used in |
|---|---|---|---|
| R1 | Bench-first lessons: a lesson is one bench step plus an automatic wrap; the schema accepts lessons with no hook, explain or quiz step; ARCHITECTURE's "8 to 15 minutes" becomes "4 to 15". | M | all |
| R2 | Discovery notes and rule stamps: a note is `{ on: anchor, text }`, drawn in ink at `controller.project(anchor)` above either view; a rule stamps into the margin and the learner's rulebook. | M | all |
| R3 | Bench checks: `{ id, kind: "tap" \| "taps" \| "chips" \| "number", prompt, options?, answer, unit?, tol? }`, graded on the first try and counted in `firstTry` and `items`. A wrong tap shows the tapped thing's own name (the three-period rule). | M | all |
| R4 | Beats: `beats: Beat[]` in the lab file. A beat has `robot` (one or two lines), and one of `task`, `predict` (`{ prompt, chips }`, ungraded, saved for the notebook), `check` or `card`, plus optional `note` and `rule`. Only the current beat shows. Hints and "Show me" attach to the beat's task. | M | all |
| R5 | Objectives: `objectives: [{ id, tasks: [...] }]`, 2 to 4; the robot's eyes fill in equal steps as each completes. Not shown as a list. | S | all |
| R6 | Secret invitation: a bonus task shown as a "Secret: ..." beat only after the required objectives; skippable with one tap. | S | all |
| R7 | Fix-it round: `fixit: { bench, task }` swaps in a second bench after the secret; relaxed by default (no timer, no score on screen, hints and "Show me" on); the first try still counts. | M | all |
| R8 | Notebook page per lesson: title, a sketch (a hand-drawn SVG per lab), the notes, rules, the learner's predictions in blue, a fix-it tick, a secret box; signed off with a "Case closed" stamp; kept in the learner's notebook (derived from progress plus saved predictions). | M | all |
| R9 | Pop-up card host: one card per lesson at most, `card: { kind }`; this unit needs only `danger-shelf`. | S | SH7 |
| R10 | `lab.view(name)`: whether a view or overlay is on: `"push"`, `"xray"`, `"xray:<part>"`, `"dots:electrons"`. | S | SH5, SH7, SH10, SH4 |
| R11 | `fixit` and `checks` steps in `solution` replays, so `solutions.test.ts` covers the whole lesson. | S | all |

A lab file then reads like this (sketch for SH1; field names are a proposal):

```ts
export default defineLab({
  id: "welcome-to-the-bench",
  bench: { board: "none", parts: [...], leads: [{ id: "TL1", from: "wrap:B1", to: "S1.com" }, ...] },
  objectives: [{ id: "find-the-gap", tasks: ["close-the-switch", "find-the-gap"] }, { id: "break-mend", tasks: ["break-the-loop", "mend-the-loop"] }],
  beats: [
    { robot: "My desk lamp is dark. Flip its switch?", task: "close-the-switch" },
    { robot: "Still dark. Tap the battery's minus snap.", tracer: "B1.neg", note: { on: "lead:TL1.a", text: "plastic: a gap" } },
    { robot: "Move that clip onto the metal snap.", task: "find-the-gap", note: { on: "loop", text: "a loop: metal all the way round" }, rule: "Flow needs a closed loop." },
    { predict: { prompt: "Unclip a lead far from the lamp. The lamp will...", chips: ["stay lit", "dim", "go dark"] }, task: "break-the-loop" },
    ...
  ],
  checks: [{ id: "loop-word", kind: "chips", prompt: "What is this, all the way round?", options: ["a loop", "a lamp", "a line"], answer: "a loop" }],
  fixit: { bench: { ... }, task: "fix-it" },
  tasks: [...], solution: [...],
});
```

### 6.2 Bench, views and props

| Id | Need | Size | Used in |
|---|---|---|---|
| V1 | Flow dots: dots ride leads, jumpers and parts at a speed from the part current (log scale), plus to minus; an "electrons" toggle runs them the other way, very slowly, labelled as slowed down for real. | M | SH4, SH6 |
| V2 | Gate counters: a `gate` instrument that clips onto a lead and ticks at a rate from that lead's current, with a rate bar; a number mode with an A/mA unit button. LabView: `lab.gate(id)` (amps), `lab.gateUnit(id)`, history source `gate:<id>`. | S after V1 | SH4, SH6, SH9 |
| V3 | Push view: ink hatching on every lead and strip by its node voltage above battery minus (denser is higher); a sealed box shows its own push as a hill. | M | SH5, SH7 |
| V6 | Cutaway: x-ray of an AA cell (two chemicals and the separator). | S | SH7 |
| V7 | Loop tracer: tap a terminal and ink runs part by part along `connectivity` until it reaches a gap. Also offered as a hint in every fix-it. | S | SH1, fix-its |
| P1 | Everyday objects: more `sample` materials, each a fixed resistance between its two clip points: key, coin, foil (0.01 Ω), pencil lead (5 Ω), plastic spoon, rubber eraser, glass marble, dry wooden stick (1e12 Ω), and a coated paper clip (see P2). | M (models) | SH2 |
| P2 | Insulated attach spots: anchors a clip can bite that join nothing: `wrap:<battery>`, `base:<toggle-switch>` (the wooden block), `coat:<coated clip>`; the tracer stops there. | S | SH1, SH2 |
| P4 | Static toy (wave 2): its own small, pure, deterministic charge model (rubbing moves charge from wool to balloon; like charges push apart; a charged thing pulls neutral paper and walls; insulators hold charge where it lands; metal in your hand drains it). LabView `lab.static(id)`. The circuit simulator is not used. | L | SH3 |
| P5 | Danger shelf card: seven info-only items (AA, 9 V, coin cell, wall socket, car battery, phone battery, camera flash) and two trays. Never simulated, by design. | S to M (art) | SH7 |
| P7 | Sealed box: a lid that hides grouped parts and shows only terminals or a knob; opening is a bench action; `lab.lidOpen(id)`. If it slips, SH5, SH6 and SH8 run with the parts in view and the "open the box" beats removed. | M | SH5, SH6, SH8 |
| B1 | Battery `charge` start parameter (0 to 1), passed to the simulator's existing state of charge. | S | SH7 |
| B2 | Drawer faces: `bin` gets an optional `face` (a symbol drawing) and `accepts` (bench kinds); a part of another kind will not drop in (control of error). | S | SH11 |
| B3 | Padlock and cabinet: three wheels driven by checks; the cabinet opens when all three are right. | S | SH9 |
| B4 | Tag tap: a `tag` can show its value with or without the prefix ("10 kΩ" and "10,000 Ω"); `lab.tagShown(id)`. | S | SH9 |
| S1 | Schematic card: a hand-drawn ink SVG per lab whose symbols carry part ids; tapping a symbol spotlights its part; a torn piece can be dragged in and rotated; `lab.drawing(id)` gives `{ complete, pieces }`. | M | SH12 |
| S3 | "Same circuit?" check: two small ink benches beside a chip pair (built on R3). | S | SH12 |

### 6.3 Simulator checks (no new physics, golden tests to add)

- SH5: X1 (emf 1.58 V, 0.15 Ω) through 1 kΩ into a red LED gives glow below 0.05; B1 gives glow above 0.3.
- SH7: B1 at `charge` 0.08, 1 kΩ and a red LED: glow below 0.05 after about 6 simulated hours; an open loop loses
  under 0.01 of charge in 10 simulated hours.
- SH8 fix-it: meter on `dca-ma` with red in VΩ across a 9 V battery reads 0.00 and emits no `meter-fuse` event.
- SH1 secret: 9.4 V reversed across the red LED through 1 kΩ does no damage.

### 6.4 Island and course

| Id | Need | Size |
|---|---|---|
| I1 | `start-here` in the isle catalog (`UNITS`, `LANDMARKS_BY_UNIT`, `LANDMARK_SPEC`) and in `isle-pieces.ts`; new landmark models `spark-gap` and `pump-house`; `meter-tower` moves from `basics`; `course.yaml` units `[start-here, basics, switching]`. | M |
| I2 | Optional Sketch Isle theme: the island starts as an ink sketch and inks itself in as pieces land. | M to L |
| I3 | Course map: Start here shows as open, never as "current", for a learner who has finished any Basics lesson. | S |

---

## 7. Accuracy checklist

A fact-checker confirms each row before content ships.

| Lesson | Claim | Value used | Notes |
|---|---|---|---|
| all | Lamp current | 9.4 V, 1 kΩ, red LED: about 7.5 mA | Vf about 1.9 V at 7.5 mA (sim 1.85 V at 5 mA). |
| SH1 | Plastic wrapper, dry wood | insulators: a clip on them joins nothing | |
| SH1 | Reversed LED through 1 kΩ on 9.4 V | dark, no harm | Datasheets give about 5 V reverse maximum; if a small LED breaks down, 1 kΩ keeps the reverse current to a few mA. |
| SH2 | Conductors and insulators | metals conduct; plastic, rubber, glass, dry wood insulate at 9 V | |
| SH2 | Pencil lead | graphite conducts; a lead piece is a few ohms, so the lamp looks normal | Not a metal. |
| SH2 | Coated paper clip | the plastic coat insulates, the cut end conducts | |
| SH3 | Balloon on wool | the balloon gains electrons and ends up negative | Standard triboelectric order. |
| SH3 | Why it sticks | a charged balloon pulls on neutral paper and walls by shifting their charges | Not because the wall is charged. |
| SH3 | Like charges | two rubbed balloons push apart | |
| SH3 | Metal in the hand | a rubbed metal spoon you hold keeps no charge: it drains through you | |
| SH3 | Balloon and lamp | cannot keep a lamp lit: tiny charge, one brief discharge | |
| SH4 | Series loop | the same current at every point; nothing used up | |
| SH4 | Direction | drawings and dots go + to −; electrons drift − to + | |
| SH4 | Drift speed | about a thousandth of a millimetre per second at a few mA in a clip lead; a snail does about 1 mm/s | The push itself arrives almost at once. |
| SH4 | Shortcut across the LED | lamp dark, loop current about 9.4 mA, limited by R1 | |
| SH5 | AA cell | 1.5 V nominal, about 1.6 V fresh (bench 1.58 V) | |
| SH5 | Red LED threshold | needs about 1.8 to 2 V before it glows usefully | Rule says "about 2 V". |
| SH5 | Volt | unit of push, after Alessandro Volta | Name not shown; for the parts bin. |
| SH6 | Knob box | 470 Ω plus a 0 to 10 kΩ trimmer: about 16 mA down to about 0.7 mA | LED max 50 mA never reached. |
| SH6 | Series resistors | two in one loop add their squeeze | |
| SH7 | Alkaline cell | zinc and manganese dioxide kept apart by a separator, in a potassium hydroxide paste | |
| SH7 | What runs out | the chemicals; the battery pumps charges already in the wire | |
| SH7 | Run time | 500 mAh at 7.5 mA is about 65 hours | The lab starts at 8% charge. |
| SH7 | No flow, no drain | alkaline self-discharge is only a few percent a year | |
| SH7 | Shelf | mains 230 V (UK, Europe, much of the world) or 120 V (North America) can kill; a 12 V car battery can drive hundreds of amps into a short; lithium packs can burn if damaged or shorted; a camera flash capacitor holds about 300 V even when off; a swallowed coin cell causes serious internal burns | |
| SH8 | Fresh 9 V | reads about 9.4 to 9.6 V | Bench 9.4 V. |
| SH8 | Sockets | black in COM; red in VΩ for volts | |
| SH8 | Minus sign | the reading is red compared with black; swapped probes show a minus | |
| SH8 | Dial | V volts (push), A amps (flow), Ω ohms (squeeze) | |
| SH8 | Fix-it meter | on mA with red in VΩ the meter reads zero; the VΩ socket is not in the current path | Verify in the sim (6.3). |
| SH9 | Prefixes | k times 1,000; m divided by 1,000; M times 1,000,000 | 7.5 mA = 0.0075 A; 4.7 kΩ = 4,700 Ω; 20 mA = 0.02 A; 9 V = 9,000 mV. |
| SH10 | Half breadboard | 30 columns; holes a to e and f to j; 300 holes in 60 strips of five; 4 rails of 25; 400 in all; 2.54 mm pitch | |
| SH10 | Channel | separates e from f | |
| SH10 | Rail colours | red for +, blue for − is a habit, not wiring | |
| SH10 | Both legs in one strip | no voltage across the part; it is bypassed | |
| SH10 | Continuity | beeps below about 30 Ω on our meter; test only unpowered metal | |
| SH11 | Battery symbol | long line is + | |
| SH11 | Resistor symbol | zigzag (US style) or a small rectangle (IEC style) | |
| SH11 | LED symbol | triangle into a bar, two small arrows out; the triangle points the way conventional current flows; the bar is the cathode | |
| SH11 | LED legs | long leg anode (+); flat rim side cathode | |
| SH11 | Crossings | lines that cross with no dot are not joined | |
| SH12 | Drawings | show connections, not positions | |
| SH12 | Order in one loop | the resistor works on either side of the LED | |

---

## 8. Notes for authors and for the rest of the course

- **Moved lessons.** `welcome-to-the-bench`, `meet-the-meter` and `first-glow` keep their ids and bump `version`
  (in-progress answers for the old version are dropped, completions stay). Kept task ids: `close-the-switch`,
  `break-the-loop`, `mend-the-loop`, `swap-battery-leads`; `plug-in`, `set-dial`, `read-battery`, `swap-probes`,
  `tired-battery`; `build-loop`, `flip-led`, `swap-order`, `match-symbols`. `first-glow`'s `no-resistor` is dropped.
- **Achievements.** `first-reading` and `glow-getter` keep their conditions. Basics' `curious-mind` loses
  `welcome-to-the-bench/swap-battery-leads`, `meet-the-meter/tired-battery` and `first-glow/match-symbols` from its
  list (see the conversion guide for the new count). Suggested new ones: `case-closed` ("Close all 12 cases", 50 XP)
  and `secret-keeper` ("Find six secrets in Start here", 25 XP, hidden).
- **Bonus list for Start here** (for `secret-keeper`): `swap-battery-leads`, `pencil-lead`, `two-balloons`,
  `show-electrons`, `no-push-here`, `two-squeezes`, `no-flow-no-drain`, `tired-battery`, `mega`, `beep-a-strip`,
  `dot-rule`, `swap-order`.
- **Hall of Fried Parts.** No part dies on purpose in this unit. Accidental deaths (an LED with no resistor) still go
  to the Hall with the lab's `fried` label.
- **Try it for real.** Each notebook page may carry an optional fold with real parts and one safety line (40 words at
  most, outside the word budget). Cases 1, 2, 5, 6, 8, 10 and 12 have one; 3 adds "a balloon and a wool scarf".
- **Writing.** Keep robot lines under 12 words, notes under 6, rules under 8. Recount with the method in 1 (quoted
  copy in the beats table) after any edit. Never import wording from `.private/`.
