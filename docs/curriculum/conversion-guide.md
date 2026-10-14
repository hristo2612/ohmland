# Converting Units 1 and 2 to bench-first lessons

Status: guide for content authors. It says how every lesson in `docs/curriculum/unit-1.md` (Basics) and
`docs/curriculum/unit-2.md` (Switching) becomes a bench-first lesson in the format defined in
`docs/curriculum/start-here.md` (section 1), under `docs/DESIGN-PRINCIPLES.md`. Part A gives the rules, Part B converts
Unit 1, Part C converts Unit 2, Part D lists what changes in achievements and totals.

The physics, numbers, labs and task ids in the unit blueprints stay the source of truth. This guide decides what each
lesson keeps, cuts, moves or splits, and how its hook, cards, quiz and wrap turn into beats.

---

## Part A. Rules for every conversion

### A1. The shape of a converted lesson

- One bench step. No hook page, no explain cards, no quiz page. The lesson is a short run of **beats**: a robot line,
  one action (a bench task, an inline prediction or a bench check), then what the bench answers (a discovery note on a
  part, sometimes a rule stamp).
- Only the current beat is on screen. Objectives are never shown as a list; they fill the robot's eyes.
- The learner acts within 5 seconds: beat 1 is always a bench action.
- A **mission** (title plus robot intro line), 2 to 4 objectives, one optional **secret**, one relaxed **fix-it**
  round, a self-filling **notebook page** signed off at the end.

### A2. One idea per lesson (and when to split)

Write the lesson's big idea as one sentence. If it needs "and" to join two things the learner must newly understand
or do, it is two lessons. Other signs of two ideas: two new parts, rules about two different topics, two separate
"aha" moments, or more than 8 minutes of bench work.

How to split:

- The **kept id** goes to the half that keeps the most existing task ids. The other half gets a new id (kebab-case,
  unique across the course; the new ids below are checked).
- Both halves sit next to each other in the same module. The new half usually comes first when it is the simpler idea.
- The kept lesson bumps `version`. Task ids keep their names where the action survives, even if the lesson around
  them changes.
- **NEW (progress):** an optional `splitFrom: <old-id>` in the new lesson's `lesson.yaml`. A learner who finished the
  old lesson before the split sees the new half as done on the course map (a derived state, no XP until they play it).

Applying the same test to merges: two lessons that teach one idea may merge, but none in Units 1 and 2 qualify.

### A3. Budgets

| Thing | Limit |
|---|---|
| Main path text per lesson (every quoted line in the beats, secret, fix-it, sign-off, any card) | under 150 words |
| On-demand text per lesson (hints, wrong-answer nudges, fried line) | under 60 words |
| Robot line | at most 12 words, most under 10; one playful line in four |
| Discovery note on a part | at most 6 words, lower case field-note style |
| Rule stamp | at most 8 words; 1 or 2 per lesson, 3 at most |
| Prediction | 1 or 2 per lesson; 2 or 3 chips of at most 4 words each |
| Bench checks | 1 to 3 graded per lesson, plus the fix-it |
| Discoveries | 2 to 4 per lesson; at most one per beat |
| Beats | 7 to 12, counting the secret, the fix-it and the sign-off |
| Hints | at most 2 per beat, 12 words each |
| Minutes | 4 to 8 for a split or new lesson; 9 or 10 only for a build that cannot be shorter |

Count words the way `start-here.md` does: the quoted copy in the beats table.

### A4. Three-period lesson for new parts and words

For every part or word the lesson introduces:

1. "This is..." arrives as a discovery note on the part, at the moment it is seen working.
2. "Show me..." is a tap check. A wrong tap shows the tapped thing's own name; nothing flashes red.
3. "What is this?" is a chip check near the end (or the first beat of the next lesson, if the budget is tight).

A lesson introduces one new part. Tools count as parts (the scope, the logger, the stopwatch). If a lesson needs a new
tool and a new part, split it or let a neighbouring lesson introduce the tool.

### A5. Turning the old steps into beats

| Old step | Becomes |
|---|---|
| Hook text | The robot's intro line (beat 1), at most 12 words. Story glue stays only if it fits in that line. |
| Hook predict | An inline prediction right before the action that answers it, ungraded, chips trimmed to 4 words. |
| Hook visual | Dropped: the bench is the visual. |
| Lab task prompt | A robot line of at most 12 words. Long prompts become two beats. |
| Task success line | A discovery note (6 words) on the part, or dropped if the bench already shows it. |
| Task notice | A discovery note or a rule if it is the lesson's idea; otherwise dropped. |
| Task hints | Kept as on-demand hints, trimmed to 12 words. |
| Wrap rules | Rule stamps (1 or 2), stamped by the beat that earns them. The rest are dropped or become notes. |
| Try it for real | An optional fold on the notebook page, 40 words at most, outside the budget. Safety lines stay. |
| Mascot lines | Robot start, hint, fried and success lines, trimmed to 12 words. |

### A6. Explain cards

Decide per card, in this order:

1. **Discovery note:** the card names or explains what the learner just saw on the bench. Cut it to one note (6 words)
   on the part that shows it.
2. **Rule:** the card states the lesson's law in one line. Stamp it.
3. **Pop-up card:** the idea is needed now but the bench cannot show it (safety facts about things we never simulate,
   a printed code the learner must decode to continue). One per lesson, at most 40 words, one interaction, never
   before the first bench action, never a second idea.
4. **Parts bin:** reference facts (ratings, preferred values, datasheet terms, history, names of units) move to
   `parts.yaml` facts or the part's info card.
5. **Dropped:** history and trivia that are not reference, anything Start here already teaches, and second ideas that
   belong to another lesson.

Widgets named on cards (`flow-dots`, `meter-explorer`, `pressure-map`, `color-code`...) become bench features or
overlays only if a beat uses them; otherwise they are dropped.

### A7. Quiz items

Decide per item:

1. **Prediction:** "What will happen if..." about an action the learner is about to take. Ungraded, inline.
2. **Bench check:** answerable by tapping something on the current bench, picking a chip about it, or typing a number
   the bench produced. Graded on the first try. `hotspot` items become tap checks on the real part; `color-code` items
   become checks on a real resistor on the bench.
3. **Fix-it round:** "spot the mistake" items become the broken bench to repair (one per lesson; pick the best).
4. **Dropped:** pure arithmetic drills that are not the lesson's idea, prefix drills (Start here owns them), items that
   repeat a check, and trivia.

A numeric item survives as a "type a number" check only when calculating is the lesson's idea (`find-the-law`,
`use-the-law`, `count-the-watts`, `how-long`, `rc-time-constant`).

### A8. Missions, secrets and fix-its

- **Mission title:** a short noun phrase or a challenge, our own words ("Count the flow", "The weak link").
- **Objectives:** 2 to 4, each a group of existing or new task ids.
- **Secret:** the best existing bonus task, or a natural "what if" one step past the lesson's idea. Never a second idea
  the next lesson needs. A lesson may have none when its burnout or payoff is already the treat.
- **Fix-it:** one broken bench, one fault, drawn from the lesson's idea (or an earlier one). Relaxed: no timer, no score
  on screen, the loop tracer and "Show me" available. The fault should be found by the bench's own control of error
  (dark LED, OL, a smoking part, a stuck relay), not by reading.

### A9. Ids, progress and XP

- Lesson ids and kept task ids never change. Moved tasks keep their ids in their new lab.
- `firstTry` and `items` now come from bench checks and the fix-it. Achievements that need `firstTry == items`
  (`stripe-sharp`, `clean-sweep`) keep working.
- Achievements that name a lab and task that moved are listed in Part D with their new conditions.

### A10. Checklist for converting one lesson

1. Write the big idea in one sentence. Split if it fails A2.
2. List the new parts and words; plan their three periods.
3. Pick the objectives from the existing tasks; cut tasks that teach a second idea.
4. Write the beats: action first, then the bench's answer. Put each prediction right before its action.
5. Map every card (A6) and quiz item (A7). Record the decision in the lesson's entry below.
6. Choose the secret and the fix-it bench.
7. Write the robot lines, notes and rules within budget; count words.
8. Update the lab file (objectives, beats, checks, fix-it, solution) and replay the solution.
9. Bump `version`; update achievements if Part D says so.

---

## Part B. Unit 1, Basics

Three lessons move to Start here. Eight split. The module `your-meter` dissolves (its landmark `meter-tower` moves to
Start here). Basics goes from 18 lessons (about 210 minutes) to 23 shorter ones (about 153 minutes).

### B1. Summary table

| # | Lesson (id, title) | Change | New mission | Min | Module |
|---|---|---|---|---|---|
| 1 | `welcome-to-the-bench` Welcome to the bench | **Moved** to Start here (SH1) | The dark lamp | 5 | (Start here) |
| 2 | `meet-the-meter` Meet your multimeter | **Moved** to Start here (SH8) | The black box | 8 | (Start here) |
| 3 | `tiny-and-huge-numbers` Tiny numbers, huge numbers | **Trimmed**, retitled "Pick the right range" | Tame the OL | 6 | Resistance |
| 4 | `what-resists` What resists? | **Split**, kept half: skin | Your skin resists | 6 | Resistance |
| 4b | `salt-and-water` (new) | **Split**, new half: water | The three cups | 6 | Resistance |
| 5 | `draw-a-resistor` Draw a resistor | **Trimmed** | Draw a resistor | 8 | Resistance |
| 6 | `reading-the-stripes` Reading the stripes | **Split**, kept half: the code | Crack the stripes | 6 | Resistance |
| 6b | `the-liar` (new) | **Split**, new half: tolerance | One resistor lies | 6 | Resistance |
| 7 | `first-glow` Your first glow | **Moved** to Start here (SH12) | The torn blueprint | 8 | (Start here) |
| 8 | `led-burnout` One LED, too much current | **Trimmed**, absorbs "why the resistor" | How bright is too bright? | 8 | Current and LEDs |
| 9 | `measure-the-flow` Measuring the flow | **Trimmed** | Count the flow | 9 | Current and LEDs |
| 10 | `volts-across` Across, not in | **Split**, kept half: measuring across | Push across | 6 | Voltage and Ohm's law |
| 10b | `share-the-push` (new) | **Split**, new half: drops add up | The shared push | 6 | Voltage and Ohm's law |
| 11 | `find-the-law` Find the law yourself | **Split**, kept half: discover the law | Find the law | 9 | Voltage and Ohm's law |
| 11b | `use-the-law` (new) | **Split**, new half: size a resistor | Predict, then pick | 6 | Voltage and Ohm's law |
| 12a | `end-to-end` (new) | **Split**, new half: series | End to end | 5 | Voltage and Ohm's law |
| 12 | `series-and-parallel` End to end, side by side | **Split**, kept half: parallel; retitled "Side by side" | Side by side | 7 | Voltage and Ohm's law |
| 13a | `count-the-watts` (new) | **Split**, new half: P = V × I | Count the watts | 6 | Power and heat |
| 13 | `watts-and-heat` Watts and warm resistors | **Split**, kept half: ratings | Smoke and ratings | 7 | Power and heat |
| 14 | `fuse-guard` The part that fails first | **Split**, kept half: the fuse | The weak link | 6 | Power and heat |
| 14b | `big-current` (new) | **Split**, new half: the 10A socket | The 10 A socket | 6 | Power and heat |
| 15 | `inside-the-battery` The battery's hidden resistor | **Trimmed** | Catch the hidden resistor | 8 | Power and heat |
| 16 | `lemon-cell` A battery from the fruit bowl | **Trimmed** | Lemon power | 7 | Cells and batteries |
| 17 | `stack-the-cells` Stack the cells | **Trimmed** | Light it with fruit | 8 | Cells and batteries |
| 18 | `battery-field-guide` A field guide to batteries | **Split**, kept half: which battery for which job | Sippers and gulpers | 6 | Cells and batteries |
| 18b | `how-long` (new) | **Split**, new half: run time | How long will it last? | 5 | Cells and batteries |

Modules after the change (landmarks unchanged): Resistance (`resistor-hall`) 6 lessons; Current and LEDs
(`lighthouse`) 2; Voltage and Ohm's law (`observatory`) 6; Power and heat (`power-station`) 5; Cells and batteries
(`lemon-grove`) 4. Recommended as in the options doc: build `led-burnout` and both series and parallel lessons on the
half board, so the breadboard skill from Start here keeps working (lab rewrites plus solution replays).

### B2. Moved lessons (details in `start-here.md`)

**`welcome-to-the-bench`** → SH1 The dark lamp.
- Cards: "Electricity in one minute" dropped (each word now has its own case: SH4 flow, SH5 push, SH6 squeeze);
  "No loop, no flow" → SH1 notes and rule; "Which way does it flow?" → SH4 note and secret; "Break things here, not
  there" → SH7 danger shelf.
- Quiz: `open-switch` → SH1 beat 4 prediction; `label-touch` → SH1's case itself; `direction` → SH4 note;
  `safe-to-try` → SH7 shelf; `which-word` dropped.

**`meet-the-meter`** → SH8 The black box.
- Cards: "Four sockets" → notes on COM and VΩ (mA and 10A wait for `measure-the-flow` and `big-current`); "Reading
  the dial" → the dial note "V push, A flow, Ω squeeze" (AC dropped, a parts bin fact); "Why 9.4" → display note; "A
  minus sign" → beat 6 note.
- Quiz: `black-lead` → beat 1 action; `negative-reading` → beat 6; `dial-hotspot` → beat 4 tap; `pick-range` →
  `tiny-and-huge-numbers`; `ac-symbol`, `blank-screen` dropped.

**`first-glow`** → SH12 The torn blueprint.
- Cards: "Anode and cathode" → SH11 notes and SH12 fix-it; "Why the resistor is there" → `led-burnout`; "Drawing
  circuits" → SH11; "Order doesn't matter" → SH12 secret.
- Quiz: `reversed-led` → SH11 beat 3; `symbol-match` → SH11 checks; `dark-loop` and `cathode-hotspot` → SH12 fix-it;
  `current-path`, `resistor-way-round` dropped.

### B3. Kept, trimmed and split lessons

**3 `tiny-and-huge-numbers`** · Trimmed · "Tame the OL" · 6 min. Idea: a range is the biggest reading; OL means go up.
- Intro: "OL? Nothing's broken. Let's find out why." Objectives: O1 `over-the-limit`; O2 `climb-a-range`; O3
  `aa-cell`. Secret (new `two-hundred`): "Try 200 V on the battery." Note "works, fewer digits". `kilo-ohms` dropped
  (Ω mode starts in `what-resists`).
- Cards: "Ranges and OL" → notes "over limit: go up" and rule "Smallest range above your reading."; "Prefixes save
  zeros" dropped (SH9); "Big M, little m" → one note in `what-resists`; letter codes (4k7) → parts bin; "Meters that
  choose" → parts bin (multimeter facts).
- Quiz: `twelve-volts` → check (tap the range for 12 V); `ohms-to-meg` → `what-resists` check; `amps-to-ma`,
  `prefix-match`, `big-or-small`, `mv-reading` dropped.
- Fix-it: "The AA reads 1.6 on 200 V. Get more digits." Repair: dial to 2V.

**4 `what-resists`** · Split, kept half · "Your skin resists" · 6 min. Idea: the Ω setting measures squeeze, even
skin's. New: the Ω setting (three periods on the dial sector).
- Objectives: O1 `dry-skin` (with the M note: "M: mega, a million"); O2 `wet-skin`. Secret: `double-spacing` (now
  bonus): "Double the gap. Does it double?" Note "contacts do most of it". `extremes` dropped (SH2 owns metals and
  plastic).
- Cards: "Everything resists" → robot intro "Even you resist a little. Let's measure."; "How the meter measures ohms"
  → note "Ω: the meter sends its own tiny flow" and rule "Measure squeeze with the power off."; "Why skin readings
  wobble" → secret note; "Water is a fake conductor" → `salt-and-water`.
- Quiz: `ol-next` → fix-it; `ohms-to-meg` (from lesson 3) → check; `spacing-double` → secret prediction;
  `material-match` (water half) → `salt-and-water`; `to-kilo`, `letter-notation` dropped (parts bin for codes).
- Fix-it: "Dry skin reads OL. Fix it." Repair: range up to 2M.

**4b `salt-and-water`** (new) · "The three cups" · 6 min. Idea: pure water barely conducts; what's dissolved in it
does.
- Objectives: O1 `three-cups` (moved from `what-resists`); O2 `pinch-of-salt` (new: tap the salt shaker over tap water
  and watch the ohms fall; the cup's `ohms` steps down). Prediction before O1: "Which cup squeezes most?" chips
  "distilled", "tap", "salty". Secret: none.
- Cards: "Water is a fake conductor" → notes "pure water: hardly conducts", "salt: more ions, less squeeze" and rule
  "What's dissolved carries the flow."; the `salt-shaker` widget → a bench action (O2); "fair test" → one note on the
  cups: "same probes, only the water changes"; rule "Change one thing at a time."
- Quiz: `material-match` (water rows) → check "Which cup has the most ions?"; `fair-test` → check.
- Fix-it: "My salty cup reads OL. Fix it." Repair: the dial is on the 200 Ω range; step up to 2k.

**5 `draw-a-resistor`** · Trimmed · "Draw a resistor" · 8 min. Idea: a line's shape sets its squeeze (longer more,
wider or darker less).
- Objectives: O1 `first-line`, `half-way`; O2 `go-darker`; O3 `hit-target`. Secret: `slide-along` (note "a sliding
  contact: a potentiometer").
- Cards: "Longer means more" and "Thicker means less" → notes on the card and one rule "Longer: more squeeze. Wider:
  less."; "Sliding contacts" → secret note; `strip-resistance` widget dropped (the card prop does it).
- Quiz: `quarter-hotspot` → check on the real card (tap the 2.5 cm mark); `lowest-line` → check; `quarter-line`,
  `double-both`, `thick-cable` dropped.
- Fix-it: "My line reads OL. Fix it." Repair: a probe sits on bare card; move it onto the graphite.

**6 `reading-the-stripes`** · Split, kept half · "Crack the stripes" · 6 min. Idea: two digit stripes, then the
number of zeros. The colour `chart` sits on the bench (no card).
- Objectives: O1 `decode-yellow`; O2 `sort-the-bag` (labels by reading only). Prediction: "Which end do you read
  from?" chips "the gold end", "the other end".
- Cards: "The colour code" → the chart prop plus notes per stripe ("yellow: 4", "violet: 7", "brown: one zero") and
  rule "Gold on the right. Digits, then zeros."; "Tolerance" → `the-liar`; "Why 47 and not 50?" (E6) → parts bin.
- Quiz: `read-4k7` → check on a bench resistor (type its value); `wrong-end` → the prediction; `build-330` → secret
  (new `paint-330`: "Paint 330 Ω's stripes."); `in-spec` → `the-liar`; `odd-one-out`, `body-colour` dropped.
- Fix-it: "This label says 470 Ω. The stripes disagree. Fix it." Repair: drag the right tag.

**6b `the-liar`** (new) · "One resistor lies" · 6 min. Idea: a real value sits close to its label, within its
tolerance.
- Objectives: O1 `measure-it` (moved); O2 `find-the-liar` (moved). Secret: `probe-tips` (moved, now bonus): "Touch the
  tips together." Note "0.2 Ω: the leads themselves".
- Cards: "Tolerance" → notes "gold: within 5%" and rule "Close to the label is normal."
- Quiz: `in-spec` → check (2.2 kΩ measuring 2,290 Ω: in or out?).
- Fix-it: "A good resistor ended up in the reject bin. Rescue it." Repair: measure and move it out.

**8 `led-burnout`** · Trimmed · "How bright is too bright?" · 8 min. Idea: less squeeze means more flow, and past its
limit an LED dies for good. Absorbs first-glow's "Why the resistor is there" as the first discovery.
- Objectives: O1 `brighter`, `brighter-still`; O2 `too-far`; O3 `no-comeback`. Predictions: `predict-47` (before
  `too-far`), `dead-reuse` (before `no-comeback`). Secret: none (the burnout is the treat).
- Cards: "Current is the flow" dropped (SH4, SH9); "What killed it" → note on the dead LED "far past its limit:
  cooked"; "Reading the limits" → rule "Never cross a part's maximum." and parts bin (absolute maximum, typical);
  "No healing" → note "dead stays dead"; "Why the resistor" → note on R1 "the resistor sets the flow".
- Quiz: `brightest-survivor`, `design-current` → checks; `predict-47`, `dead-reuse` → predictions; `a-to-ma`,
  `abs-max` dropped.
- Fix-it: "This lamp cooks itself in a day. Fix it." Repair: swap 150 Ω for 470 Ω (stress bar back to green).

**9 `measure-the-flow`** · Trimmed · "Count the flow" · 9 min. Idea: to count flow, the meter goes into the loop. The
blown fuse is the bench's control of error for "never across".
- Objectives: O1 `set-up-amps`; O2 `break-and-bridge`; O3 `the-classic`, `fresh-fuse`. Secret: `other-side` (now
  bonus): "Measure on the far side too." Note "same number: your gates were right".
- Cards: "Through, not across" → note "the meter fills the gap" and rule "Flow is counted through the meter."; "The
  same all the way round" → the secret's note; "Why the meter has a fuse" → note on the blown fuse; "Amps, milliamps,
  microamps" → parts bin.
- Quiz: `zero-reading` → check after `fresh-fuse`; `same-current` → secret prediction; `amps-across-led` → fix-it;
  `ma-to-amps`, `round-it` dropped; `two-amps` → `big-current`.
- Fix-it: "My lamp went out when I measured. Fix it." Repair: the meter sits across the LED on mA; move it into the
  gap.

**10 `volts-across`** · Split, kept half · "Push across" · 6 min. Idea: push is measured across a part, with the
circuit running.
- Objectives: O1 `reset-meter`; O2 `resistor-volts`, `led-volts`. Prediction: "Red lead still in mA. Probe now?"
  chips "fine", "pop". Secret: none.
- Cards: "Voltage is a difference" → recap note "push: between two points" (SH5); "Across, not in" → rule "Push
  across. Flow through."; "The drops add up", "Every LED has its voltage" → `share-the-push`.
- Quiz: `how-to-measure` → check (chips: "across" or "in the gap" for push); `volts-in-series` → fix-it; `why-safe`,
  `swapped-volts` dropped; `resistor-drop`, `blue-led` → `share-the-push`.
- Fix-it: "My lamp died the moment I measured. Fix it." Repair: the meter on volts is in the gap; close the loop and
  put the probes across.
- As built: O1 is two beats, `move-the-plug` (new, the prediction's action) then `reset-meter` (the dial only, any DC
  volts range). Fix-it task `fix-in-gap` (the meter in the gap reads 8.01 V). The bench stacks the meter in front of
  the loop so it fits a phone.

**10b `share-the-push`** (new) · "The shared push" · 6 min. Idea: around a loop, the parts share the battery's push.
- Objectives: O1 `battery-volts` (moved); O2 `add-them-up` (moved, a number check). Secret (new `blue-led`): "Swap in
  the blue LED." Note "blue takes about 3 V".
- Cards: "The drops add up" → rule "The drops add up to the battery."; "Every LED has its voltage" → secret note and
  parts bin (`led-color`).
- Quiz: `resistor-drop` → number check; `blue-led` → secret prediction.
- Fix-it: "Resistor 9.4 V, LED 0 V. Fix it." Repair: remove the stray lead shorting the LED.
- As built: O2 measures first (`resistor-share`, `led-share`, new), then `add-them-up` is the lab note box (typed total
  judged against the learner's own readings: 7.40 + 1.97 V, battery 9.37 V). `resistor-drop` is a number check after
  it. Secret `blue-led`: drop the blue LED onto the red one; the probes follow it, 3.01 V. Fix-it `fix-stray-lead`: a
  green lead from the resistor straight to battery minus. Unlocks `led-color` (moved from `volts-across`).

**11 `find-the-law`** · Split, kept half · "Find the law" · 9 min. Idea: V = I × R, found in your own data and proved by
one prediction.
- Objectives: O1 `battery-first`; O2 `fill-the-table`; O3 `spot-the-pattern`, `predict-and-test`. Prediction:
  `double-r` before the table ("Double the squeeze. The flow..."). Secret: none. `lawmaker` unchanged.
- Cards: "The pattern" → rule "V = I × R." and a note on the table "every row: about 9.4"; "Why not exactly 9.4?" →
  note "close, never exact"; "Three ways to use it", "The milliamp shortcut" → `use-the-law`; the `ohms-law` widget
  dropped.
- Quiz: `double-r` → prediction; `current-calc`, `led-resistor`, `nearest-value`, `unit-slip` → `use-the-law`;
  `resistance-calc` dropped.
- Fix-it: "Row three reads zero. Fix it." Repair: the red plug sits in VΩ while the dial is on mA; move it to mA.
- As built: each row's I × R is typed while its reading is on the meter (`first-row`, new, for 1 kΩ; then
  `fill-the-table` for the rest), so nothing has to be remembered; `spot-the-pattern` asks for the number that keeps
  turning up (the battery's push). The prediction is its own note-only task, `predict-4k7` (new), before the kept
  `predict-and-test` measures; the 4.7 kΩ resistor comes into play on the desk. `lawmaker` fires as before. Fix-it
  task `fix-red-plug`. Readings: 9.19, 6.25, 4.23, 2.85 mA; 4.7 kΩ 2.00 mA.

**11b `use-the-law`** (new) · "Predict, then pick" · 6 min. Idea: turn the law round to choose a resistor.
- Objectives: O1 `size-the-resistor` (new: type the resistance for 15 mA from 9 V with a 2 V LED; answer 467 Ω,
  2%); O2 `pick-and-prove` (new: pick 470 Ω from the tray, put the meter in series, read 14 to 16 mA). Secret (new
  `ten-k`): "Predict the flow through 10 kΩ, then test."
- Cards: "Three ways to use it" → rule "I = V ÷ R. R = V ÷ I."; "The milliamp shortcut" → note "V, mA and kΩ go
  together".
- Quiz: `led-resistor` → O1; `nearest-value` → check; `current-calc` → secret; `unit-slip` → fix-it idea.
- Fix-it: "I picked 47 Ω for my LED. Fix it before it pops." Repair: swap for 470 Ω.
- As built: the bench opens with the meter already in series and a quick `wild-guess` (new: 4.7 kΩ, 1.62 mA). The two
  sums (7 V, then 467 Ω) are number checks, so `size-the-resistor` is not a lab task; `pick-and-prove` is the 470 Ω
  in the holder (15.41 mA), with nudges for the tray's 4.7 kΩ, 47 Ω (OL) and 10 kΩ. Secret `ten-k`: 0.76 mA. Fix-it
  task `fix-wrong-pick` (47 Ω reads OL on 20 mA; nothing burns in the simulator at about 120 mA).

**12a `end-to-end`** (new) · "End to end" · 5 min. Idea: in series, squeezes add.
- Objectives: O1 `series-ohms` (moved); O2 `series-current` (new: the pair in one loop with the battery, meter in
  series, 4.3 to 5.0 mA). Secret: none.
- Cards: "End to end: add them" → rule "In series, squeezes add."
- Quiz: `series-total` → number check.
- Fix-it: "These should read 2 kΩ. The meter says 1. Fix it." Repair: remove the lead shorting one resistor.
- As built, on the half board: the meter already probes strips 10 and 18 (OL) and R2 bridges 14 to 18 (1.99 kΩ).
  O2 is `meter-on-ma` (new: power comes in as a setup, the learner sets the meter for current) then `series-current`
  (the meter bridges strips 18 and 22: 4.69 mA). Secret (new `swap-in-3k3`): the 3.3 kΩ onto R2, 2.18 mA. Fix-it
  `fix-shorted` keeps the meter on current: a yellow jumper across R2 makes 9.28 mA.

**12 `series-and-parallel`** · Split, kept half, retitled "Side by side" · "Side by side" · 7 min. Idea: side by side,
the total is less than the smallest.
- Objectives: O1 `parallel-ohms`; O2 `predict-mixed`; O3 `four-times`. Prediction: `add-a-branch` before O3. Secret
  (new `smallest-wins`): "Put 100 Ω beside 1 MΩ." Note "just under 100 Ω".
- Cards: "Side by side: more paths" → rule "Side by side: less than the smallest."; "The smallest wins" → secret note;
  "Shared voltage, shared current" dropped (one note on O3: "each path takes its own flow").
- Quiz: `parallel-total` → O2 is that check; `add-a-branch` → prediction; `tiny-and-huge` → secret; `sams-claim` →
  fix-it; `three-equal` dropped.
- Fix-it: "Sam's side-by-side pair reads 2 kΩ. Fix it." Repair: rewire the series pair as a parallel
  pair.
- As built, on the half board: O2's prediction is its own note-only task `predict-pair` (new) before the kept
  `predict-mixed` (0.77 kΩ). O3 is `add-a-branch` (new, replacing `four-times`, whose series half now lives in
  `end-to-end`): power comes in with R1 alone (9.28 mA), the learner adds R2 beside it (18.43 mA). The secret
  `smallest-wins` stays on that powered bench: 1 MΩ beside the pair moves the flow by 0.01 mA. Fix-it
  `fix-sams-pair`: R2 back beside R1, then the black probe from strip 18 to 14 (OL in between).

**13a `count-the-watts`** (new) · "Count the watts" · 6 min. Idea: power is push times flow, in watts.
- Objectives: O1 `cool-one` (moved, number check in mW); O2 `power-it` (moved, number check in W). Secret: none.
- Cards: "Power: how fast energy moves" → note "watts: energy per second"; "P = V × I" → rule "P = V × I."; the
  `power-bar` widget → the heat overlay (existing `inspect` "heat").
- Quiz: `w-to-mw` → part of O1's entry; `skin-power`, `joules` dropped.
- Fix-it: "The heat label says ouch. Halve the power." Repair: swap 15 Ω for 30 Ω (half the power at the same push).

**13 `watts-and-heat`** · Split, kept half · "Smoke and ratings" · 7 min. Idea: a part's rating is the heat it can
shed; pick one with room to spare.
- Objectives: O1 `cook-one`; O2 `survive-ten`. Prediction: `which-hotter` before O1. Secret: `one-watt-too`.
- Cards: "Power ratings" → rule "Pick a rating twice the power."; "Temperature, heat, power" dropped (parts bin).
- Quiz: `at-the-limit`, `pick-rating` → checks; `which-hotter` → prediction.
- Fix-it: "This 1/4 W resistor keeps smoking. Fix it." Repair: swap in the 5 W part.

**14 `fuse-guard`** · Split, kept half · "The weak link" · 6 min. Idea: a fuse melts on purpose to save the rest; the
beep shows the gap. The continuity beep gets its three periods here.
- Objectives: O1 `blow-1a`; O2 `continuity-check`. Prediction (hook's): "A 1 A fuse across the battery?" chips
  "nothing", "it blows". Secret: none.
- Cards: "A weak link on purpose" → note "melted: a gap on purpose" and rule "A fuse melts to save the rest."; "Where
  fuses go" → fix-it; "Ratings are rough", "The big-current socket" → `big-current`.
- Quiz: `limit-myth` → check; `bigger-fuse` → fix-it; `fuse-polarity` dropped; `bracket`, `big-current-steps`,
  `ideal-amps` → `big-current` or dropped.
- Fix-it: "Someone fitted a 10 A fuse here. Fix it." Repair: swap for the 1 A fuse (the board's rating).

**14b `big-current`** (new) · "The 10 A socket" · 6 min. Idea: big flow goes through the 10A socket, briefly.
- Objectives: O1 `measure-big` (moved). Secret: `battery-check` (moved, bonus).
- Cards: "The big-current socket" → rule "Big flow: 10A socket, briefly."; "Ratings are rough" → note "1 A blew, 3 A
  held: between".
- Quiz: `bracket` → check; `two-amps` (from lesson 9) → check; `big-current-steps` dropped (the beats are that order).
- Fix-it: "The meter reads zero on 10A. Fix it." Repair: the red plug is in VΩ; move it to 10A. (Verify in the sim
  that VΩ in series on the 10A setting passes no current and blows nothing.)

**15 `inside-the-battery`** · Trimmed · "Catch the hidden resistor" · 8 min. Idea: a battery hides a resistance, so its
push sags under load.
- Objectives: O1 `open-voltage`, `loaded-voltage`; O2 `find-r` (number check); O3 `old-battery`. Secret:
  `watch-it-sag`.
- Cards: "A resistor inside every battery" → note and rule "Every battery hides a resistor."; "Why the voltage sags"
  → note "push lost inside"; "No infinite current" dropped; "Test batteries under load" → rule on O3 "Test a battery
  while it works."
- Quiz: `fine-but-flat` → check; `internal-r` is O2; `short-max`, `aa-or-9v`, `law-broken`, `terminal-v` dropped.
- Fix-it: "This battery reads 8.6 V, but my lamp won't run. Fix it." Repair: load-test it, swap in the fresh one.

**16 `lemon-cell`** · Trimmed · "Lemon power" · 7 min. Idea: two different metals in juice make a push.
- Objectives: O1 `make-a-cell`; O2 `which-is-plus`; O3 `same-metal`. Prediction: `two-coins` before O3. Secret:
  `one-lemon-led`.
- Cards: "Two metals and a juice" → rule "Two different metals plus juice: a cell."; "What happens inside" → note on
  the coin "hydrogen bubbles"; "Atoms in one card" → one note "zinc leaves as ions"; "Electrons go the other way"
  dropped (SH4).
- Quiz: `plus-electrode` → tap check; `energy-source` → check; `two-coins` → prediction; `bubbles`, `electron-drift`,
  `cell-mv` dropped.
- Fix-it (uses the kept task `touching`): "My lemon reads zero. Fix it." Repair: pull the touching electrodes apart.

**17 `stack-the-cells`** · Trimmed · "Light it with fruit" · 8 min. Idea: cells chained plus to minus add their push.
- Objectives: O1 `two-in-series`, `wrong-way`; O2 `four-stack`; O3 `light-it`. Secret: `why-no-resistor`.
- Cards: "Series adds voltage" → rule "Chain cells: their pushes add."; "Why the LED survived" → secret note; "Voltage
  up, current no better" dropped (`battery-field-guide`).
- Quiz: `four-cells` → prediction before O2; `inside-9v` → check at the end (x-ray the 9 V: six cells); `one-reversed`
  → fix-it; `no-resistor-why`, `trace-the-chain`, `copper-to-copper` dropped.
- Fix-it: "Three cells read only 0.9 V. Fix it." Repair: turn the reversed cell round.

**18 `battery-field-guide`** · Split, kept half · "Sippers and gulpers" · 6 min. Idea: some batteries hold their push
under load and some sag; match the battery to the job. The display case (`showcase`) is the one pop-up card.
- Objectives: O1 `survey`; O2 `load-test`. Secret: none.
- Cards: "Match the battery to the job" → rule "Big flow needs a gulper."; "Single-use or rechargeable" → note on the
  NiMH cell "rechargeable: lower push, by design"; "Batteries that deserve respect" → the showcase card (recap of SH7,
  under 40 words); "Capacity" → `how-long`.
- Quiz: `coin-job`, `primary-or-secondary` → checks; `pocket-9v`, `car-battery` dropped (SH7); `aa-hours`, `two-aa` →
  `how-long`.
- Fix-it: "The 100 Ω load drags the coin cell down. Pick a gulper." Repair: swap the coin cell for the AA alkaline.

**18b `how-long`** (new) · "How long will it last?" · 5 min. Idea: hours are roughly capacity divided by flow.
- Objectives: O1 `run-time` (moved: number check, then the time-lapse). Secret (new `two-aa`): "Two AAs end to end.
  More mAh?" Note "more push, same mAh".
- Cards: "Capacity" → rule "Hours: about mAh ÷ mA."; the `run-time` widget → the existing time-lapse and clock.
- Quiz: `aa-hours` → number check; `two-aa` → secret.
- Fix-it: "This torch lasts about 10 hours. Make it last 30." Repair: swap 150 Ω for 470 Ω (about 47 mA down to about
  16 mA; 500 mAh lasts about 31 hours).

---

## Part C. Unit 2, Switching

Nine lessons split; `breadboard-inside` is trimmed because Start here now teaches the strips. Switching goes from 19
lessons (about 226 minutes) to 28 (about 194 minutes). Every lesson keeps the unit blueprint's circuits and numbers.

### C1. Summary table

| # | Lesson (id, title) | Change | New mission | Min | Module |
|---|---|---|---|---|---|
| 1 | `switch-anatomy` What's Inside a Switch | **Split**, kept half: poles and throws | Poles and throws | 6 | Switches |
| 1b | `two-buttons` (new) | **Split**, new half: NO and NC buttons | Press or release | 5 | Switches |
| 2 | `mystery-switch` The Mystery Switch | **Trimmed** (symbols and dots now in Start here) | The mystery switch | 7 | Switches |
| 3a | `both-switches` (new) | **Split**, new half: switches in series | Both must agree | 5 | Switches |
| 3 | `stairway-light` Either Switch, Any Time | **Split**, kept half: the stairway trick | Either switch | 7 | Switches |
| 4 | `meet-the-relay` A Switch Flipped by a Magnet | **Trimmed** | A switch flipped by a magnet | 8 | Relays |
| 5a | `relay-chooser` (new) | **Split**, new half: changeover and isolation | Yellow or green | 5 | Relays |
| 5 | `relay-thresholds` Click In, Click Out | **Split**, kept half: pull-in and drop-out | Click in, click out | 7 | Relays |
| 6 | `coil-kickback` The Coil Kicks Back | **Split**, kept half: the spike (and the scope) | The coil kicks back | 7 | Relays |
| 6b | `the-diode` (new) | **Split**, new half: the clamp diode | A one-way valve | 6 | Relays |
| 7 | `breadboard-inside` X-Ray the Breadboard | **Trimmed**, retitled "The full board" | The full board | 7 | Breadboard |
| 8 | `relay-buzzer` A Relay That Switches Itself | **Split**, kept half: the buzz | It buzzes itself | 5 | Breadboard |
| 8b | `tame-the-buzz` (new) | **Split**, new half: the capacitor slows it | Slow the buzz | 7 | Breadboard |
| 9 | `capacitor-fill-fade` Fill It, Watch It Fade | **Trimmed** | Fill it, watch it fade | 7 | Capacitors |
| 10 | `capacitor-labels` Reading the Fine Print | **Trimmed**, retitled "Mind the stripe" (codes move to 18, blocking to 12b) | Mind the stripe | 6 | Capacitors |
| 11 | `rc-time-constant` Counting in Taus | **Trimmed** | Counting in taus | 9 | Capacitors |
| 12 | `smoothing-and-coupling` Smooth It, Kick It Through | **Split**, kept half: smoothing; retitled "Smooth it" | Smooth it | 6 | Capacitors |
| 12b | `kick-it-through` (new) | **Split**, new half: coupling and blocking | One flash per press | 7 | Capacitors |
| 13 | `meet-the-transistor` A Tiny Current in Charge | **Split**, kept half: small steers big | A tiny current in charge | 7 | Transistors |
| 13b | `count-the-gain` (new) | **Split**, new half: measuring β | Count the gain | 7 | Transistors |
| 14a | `all-the-way-on` (new) | **Split**, new half: saturation | All the way on | 6 | Transistors |
| 14 | `touch-switch` All the Way On | **Split**, kept half: touch and Darlington; retitled "Fingertip switch" | Fingertip switch | 7 | Transistors |
| 15 | `delay-timer` Wait for It | **Split**, kept half: the buffer | Wait for it | 7 | Transistors |
| 15b | `tune-the-timer` (new) | **Split**, new half: the trimmer and five seconds | Tune it to five | 7 | Transistors |
| 16 | `night-light` Lights On at Dusk | **Trimmed** | Lights on at dusk | 8 | Blink and beep |
| 17 | `twin-flasher` The Twin Blinker | **Trimmed** | The twin blinker | 9 | Blink and beep |
| 18 | `flasher-to-tone` Shrink It to a Song | **Trimmed** (takes the ceramic code, as a check) | Shrink it to a song | 9 | Blink and beep |
| 19 | `siren` The Siren Button | **Trimmed** | The siren button | 10 | Blink and beep |

Landmarks are unchanged: `switchyard`, `relay-clocktower`, `breadboard-plaza`, `capacitor-water-tower`,
`transistor-gatehouse`, `siren-tower`. The continuity beep is known by now (Start here's secret and Basics'
`fuse-guard`), so `switch-anatomy` keeps it as a one-beat warm-up.

### C2. Lessons

**1 `switch-anatomy`** · Split, kept half · "Poles and throws" · 6 min. Idea: a switch's pole moves between its
throws. New: the slide switch's pole and throws (three periods on its legs).
- Objectives: O1 `beep-test` (one warm-up beat: "Beep check. Touch the tips."); O2 `find-the-pole` (continuity panel).
  Secret (new `peek-inside`): "Peek inside the slide switch." Note "the pole slides between throws".
- Cards: "Pole, throw, actuator" → notes "pole: the moving contact", "throw: where it lands" and rule "The pole moves.
  The throws stay put."; "SPDT and friends" → note "SPDT: one pole, two throws" (DPDT → `mystery-switch`); "Momentary
  or staying put" → `two-buttons`; "Ratings matter" → parts bin.
- Quiz: `q2` → prediction before sliding; `q5` → tap check on the real switch; `q1` → `mystery-switch`; `q3` →
  `two-buttons`; `q4` dropped (parts bin).
- Fix-it: "My selector only lights one lamp. Fix it." Repair: the battery lead sits on a throw; move it to the pole.

**1b `two-buttons`** (new) · "Press or release" · 5 min. Idea: a normally open button joins while pressed; a normally
closed one breaks while pressed.
- Objectives: O1 `press-and-hold` (moved; tags panel). Secret: none.
- Cards: momentary part of "Momentary or staying put" → note "springs back by itself" and rule "NO joins when pressed.
  NC breaks."
- Quiz: `q3` → the tags panel is the check.
- Fix-it: "My doorbell rings all the time. Fix it." Repair: swap the NC button for the NO one.

**2 `mystery-switch`** · Trimmed · "The mystery switch" · 7 min. Idea: test every pair in every position, and the
pattern names the legs.
- Objectives: O1 `map-pairs`; O2 `name-the-legs`. Prediction (hook): "Six legs. How many pairs?" chips "6", "15",
  "36". Secret: `draw-it` (now bonus; note "dashed line: one slider, two circuits"). `pin-sleuth` unchanged.
- Cards: "Testing everything, once" → note "15 pairs, each once"; "Reading the pattern" → rule "A pole changes
  partners. A throw doesn't."; "Symbols are a language", "Dots and crossings" dropped (Start here SH11).
- Quiz: `q4` → check; `q5` → secret check; `q1` → the prediction idea, dropped as an item; `q2`, `q3` dropped.
- Fix-it: "Half my selector works backwards. Fix it." Repair: swap the two throw leads on pole B.

**3a `both-switches`** (new) · "Both must agree" · 5 min. Idea: two switches in series light the lamp only when both
are on.
- Objectives: O1 `series-pair` (moved; truth-table panel). Secret (new `either-one`): "Wire them side by side." Note
  "side by side: either one".
- Cards: "Series means AND" → rule "In series, both must close."; "Truth tables" → note on the panel "every
  combination, one row".
- Quiz: `q5` → check; `q2` dropped.
- Fix-it: "My safety lamp lights with one switch. Fix it." Repair: the switches are side by side; put them in series.

**3 `stairway-light`** · Split, kept half · "Either switch" · 7 min. Idea: with two travellers, either switch toggles
the lamp.
- Objectives: O1 `two-travelers`; O2 `cross-the-travelers`. Prediction: `q1` ("Lamp on. Flip upstairs, then
  downstairs." chips "on", "off"). Secret: none. `either-way` unchanged.
- Cards: "Two travelers" → note "two roads; the poles pick one" and rule "Any single flip toggles the lamp."; "Truth
  tables" → note "on when they match"; "Names around the world" → parts bin.
- Quiz: `q1` → prediction; `q3` → fix-it; `q2`, `q4` dropped.
- Fix-it: "The top switch only works half the time. Fix it." Repair: add the missing traveller.

**4 `meet-the-relay`** · Trimmed · "A switch flipped by a magnet" · 8 min. Idea: a coil's magnet moves a switch, and the
coil never touches the contacts. New: the relay (three periods on coil, COM, NO, NC).
- Objectives: O1 `find-the-coil`; O2 `find-com-nc`; O3 `energize`. Prediction: `q2` before O3. Secret (new
  `peek-relay`): "Peek inside while it clicks." Note "the armature swings".
- Cards: "An electromagnet" → note on the coil "flow makes a magnet"; "Two worlds in one box" → rule "Coil and contacts
  never touch."; "COM, NO, NC" → notes on the legs; "Where relays live" → parts bin.
- Quiz: `q1` → check (which reading is the coil); `q2` → prediction; `q4` → the pin map does it; `q3`, `q5` dropped
  (parts bin: "drawn at rest").
- Fix-it: "Pressing should light my lamp. It goes dark. Fix it." Repair: move the lamp lead from NC to NO.

**5a `relay-chooser`** (new) · "Yellow or green" · 5 min. Idea: a relay chooses which lamp a second battery feeds.
- Objectives: O1 `changeover` (moved). Secret: none. Unlocks `led-green`, `led-yellow` (moved from lesson 5).
- Cards: "Two worlds" recap → note "B2 never touches B1"; rule "A relay can switch another circuit."; "Contact
  ratings" → parts bin.
- Quiz: `q5` → check.
- Fix-it: "Green is on at rest. Fix it." Repair: swap the NO and NC leads.

**5 `relay-thresholds`** · Split, kept half · "Click in, click out" · 7 min. Idea: a relay pulls in at one push and lets
go at a much lower one.
- Objectives: O1 `find-pull-in`; O2 `find-drop-out`. Prediction (hook). Secret: none. Unlocks `potentiometer`.
- Cards: "Why the gap?" → note "close up, the magnet pulls harder"; "Hysteresis is a feature" → rule "Two thresholds
  stop the chatter."; datasheet and contact cards → parts bin.
- Quiz: `q2` → check; `q1`, `q3`, `q4` dropped (parts bin).
- Fix-it: "The relay never clicks, whatever the knob. Fix it." Repair: the coil hangs on the pot's end; move it to the
  wiper.

**6 `coil-kickback`** · Split, kept half · "The coil kicks back" · 7 min. Idea: cutting a coil's flow makes a big
backwards spike. New: the scope (three periods; the only new thing here).
- Objectives: O1 `watch-the-spike`; O2 `led-catcher`. Secret: none. Unlocks `scope`.
- Cards: "Coils resist change" → note "the field collapses and pushes on" and rule "A coil kicks back when cut off.";
  "How big?" → note on the trace "hundreds of volts, for a blink"; diode cards → `the-diode`.
- Quiz: `q1` dropped; the rest → `the-diode`.
- Fix-it: "The scope shows nothing. Fix it." Repair: clip the scope's ground lead back onto the − rail.

**6b `the-diode`** (new) · "A one-way valve" · 6 min. Idea: a diode across the coil, band toward +, swallows the kick.
New: the diode (three periods: band, cathode).
- Objectives: O1 `diode-clamp` (moved). Secret: none. Unlocks `diode-1n4001`.
- Cards: "The diode: a one-way valve" → note "band: the cathode"; "Why the diode faces backwards" → rule "Diode across
  the coil, band toward +."
- Quiz: `q2` → tap check; `q6` → check; `q5` → fix-it; `q3`, `q4` dropped.
- Fix-it: "Press the button and the battery warms up. Fix it." Repair: turn the forward diode round.

**7 `breadboard-inside`** · Trimmed, retitled · "The full board" · 7 min. Idea: parts with two rows of legs straddle the
middle gap. First use of the 830-hole board.
- Objectives: O1 `relay-on-board`. Dropped: `xray-hunt`, `fix-dark-led` (Start here SH10). Fix-it: `bus-gap` (kept id).
  Secret: none. Unlocks: none (`breadboard`, `jumper-wires` moved to SH10).
- Cards: "What's under the holes" dropped; "Why the channel?" → rule "Two-row parts straddle the gap."; "Three classic
  bugs" → the fix-it; "Wires that stay put" → parts bin.
- Quiz: `q3` → fix-it; `q1`, `q2`, `q4`, `q5` dropped.
- Fix-it (`bus-gap`): "The bottom half is dead. Fix it." Repair: bridge the split rails.

**8 `relay-buzzer`** · Split, kept half · "It buzzes itself" · 5 min. Idea: a relay fed through its own NC contact
switches itself on and off.
- Objectives: O1 `move-one-wire`. Prediction (hook). Secret: none.
- Cards: "A switch that cuts its own power" → note "pull in, lose power, let go" and rule "Coil fed through its own
  NC: a buzz."; "Contacts have a lifespan" → note "buzzing wears the contacts"; the capacitor cards → `tame-the-buzz`.
- Quiz: `q1` → check.
- Fix-it: "My buzzer clicks once and stops. Fix it." Repair: the coil is fed from NO; move it to NC.

**8b `tame-the-buzz`** (new) · "Slow the buzz" · 7 min. Idea: a capacitor across the coil keeps it fed, so a bigger
capacitor ticks slower. New: the electrolytic capacitor (three periods: can, stripe, short leg).
- Objectives: O1 `tame-it`; O2 `faster-ticks`. Prediction: `q2` before O1. Secret: `soften-the-surge` (bonus).
  Unlocks `electrolytic-capacitor`.
- Cards: "The capacitor as a reservoir" → note "a little tank for the coil" and rule "Bigger capacitor, slower ticks.";
  "Estimating the tick" dropped (`rc-time-constant`).
- Quiz: `q4` → tap check (the minus leg); `q2` → prediction; `q3`, `q5` dropped.
- Fix-it: "My capacitor is warming up. Fix it." Repair: turn the reversed electrolytic round before it vents.

**9 `capacitor-fill-fade`** · Trimmed · "Fill it, watch it fade" · 7 min. Idea: through a resistor, a capacitor fills
and empties gradually.
- Objectives: O1 `fill`; O2 `fade`; O3 `dump`. Fix-it: `lift-a-leg` (kept id). Secret: none.
- Cards: "Two plates and a gap" → note "nothing crosses the gap"; "A stretchy wall" dropped; "Farads" → note "µ:
  micro, a millionth" and parts bin; "Capacitor or battery?" → rule "A capacitor gives back what you put in."
- Quiz: `q1` → check; `q4` → prediction before O2's retry; `q5` → fix-it; `q2`, `q3` dropped.
- Fix-it (`lift-a-leg`): "My LED won't fade any more. Fix it." Repair: push the lifted minus leg back into ground.

**10 `capacitor-labels`** · Trimmed, retitled · "Mind the stripe" · 6 min. Idea: an electrolytic has a minus stripe and
a voltage limit, and fails when you ignore them.
- Objectives: O1 `electrolytic-right-way`; O2 `electrolytic-backwards`. Prediction: `q6` before O2. Secret: `blast-box`
  (now bonus). `ceramic-blocks` moves to `kick-it-through`; `ceramic-capacitor` unlock moves with it.
- Cards: "Ceramic and electrolytic" → note "stripe: the minus leg, the short one"; "Working voltage" → rule "Stay under
  the voltage on the can."; "Three digits" → `flasher-to-tone`'s pop-up card; "Blocking DC" → `kick-it-through`.
- Quiz: `q4`, `q5` → checks; `q6` → prediction; `q1`, `q2`, `q3` → `flasher-to-tone` card.
- Fix-it: "This 6.3 V can sits on 9 V. Fix it." Repair: swap in the 16 V part.

**11 `rc-time-constant`** · Trimmed · "Counting in taus" · 9 min. Idea: τ = R × C sets how fast a capacitor fills and
empties.
- Objectives: O1 `find-tau`; O2 `discharge-tau`; O3 `ten-times-slower`. Fix-it: `hit-the-target` (kept id). Secret:
  none.
- Cards: "Fast, then slow" → note on the logger "fast, then slower and slower"; "Two tanks and a pipe" dropped; "Ohms
  times farads is seconds" → rule "τ = R × C, in seconds."; "The table to remember" → note "one τ: 63% of the way" and
  parts bin (the table).
- Quiz: `q5` → prediction (hook); `q4`, `q6` → checks; `q1` → number check; `q2`, `q3` dropped.
- Fix-it (`hit-the-target`): "This timer should take 2.2 s. Fix it." Repair: 2.2 kΩ with 1,000 µF, or 4.7 kΩ with
  470 µF.

**12 `smoothing-and-coupling`** · Split, kept half, retitled · "Smooth it" · 6 min. Idea: a capacitor across a choppy
supply smooths it.
- Objectives: O1 `flicker`; O2 `smooth-it`. Secret (new `too-small`): "Try the 47 µF instead." Note "small tank:
  ripple again".
- Cards: "Smoothing" → rule "Across the supply, a capacitor smooths."; the coupling cards → `kick-it-through`;
  "Passive and active" → parts bin.
- Quiz: `q3` → check; `q4` → `kick-it-through`.
- Fix-it: "Still flickering. Fix it." Repair: the capacitor sits in line; move its minus leg to ground.

**12b `kick-it-through`** (new) · "One flash per press" · 7 min. Idea: in line, a capacitor passes a change and blocks a
steady push. New: the ceramic capacitor (three periods).
- Objectives: O1 `ceramic-blocks` (moved); O2 `one-flash`; O3 `no-encore`. Secret: none. Unlocks `ceramic-capacitor`.
- Cards: "The voltage across a capacitor can't jump" → note "the far plate jumps too, then sags"; "Current without
  crossing" → rule "In line, a capacitor passes changes only."; "Blocking DC" → note on O1 "a blip, then nothing".
- Quiz: `q1` → prediction (hook); `q2` → check; `q4` → check (chips "across", "in line"); `q5` dropped.
- Fix-it: "My button flashes once, then never again. Fix it." Repair: put back the reset path that empties C2.

**13 `meet-the-transistor`** · Split, kept half · "A tiny current in charge" · 7 min. Idea: a trickle into the base lets
a big flow through. New: the transistor (three periods on E, B, C). Unlocks `npn-transistor`.
- Objectives: O1 `place-q1`; O2 `small-steers-big`. Prediction (hook): before O2, chips "About 18 µA", "A few mA",
  "Several amps". Secret: `no-resistor` (now bonus; the burnout).
- Cards: "Three legs, three jobs" → note "flat face: E, B, C"; "A trickle controls a river" → rule "A small base flow
  steers a big one." and note on the LED "3.6 mA: 200 times more"; "The 0.7 V door" → secret note "the base needs its
  resistor"; "NPN and PNP" → parts bin.
- Quiz: `q1` → tap check (the base, among E, B and C); `q5` → chip check ("Where does the LED's flow come from?", the
  battery; note "battery pushes, Q1 decides"); `q4` → secret; `q2`, `q3` → `count-the-gain`; `q6` dropped. A closing
  "What is this?" chip check on Q1 is the third period.
- Fix-it (`fix-backwards`): "Press S1. Why so dim?" Repair: Q1 sits in its rows turned round (C and E swapped, about
  0.17 mA); turn it flat face toward you.
- As built: R3 (470 kΩ) is already in the base row, so O1 is only placing Q1 in rows 20 to 22. Pressing S1 sends
  17.7 µA into the base and 3.6 mA through the LED (this Q1's gain is about 205).

**13b `count-the-gain`** (new) · "Count the gain" · 7 min. Idea: the collector flow is about β times the base flow.
- Objectives: O1 "Count both flows": `measure-collector` and `measure-base` (new), then `measure-gain` (moved); O2
  `double-it` (moved), after a guess (chips "About the same", "About double", "Ten times more"). Secret: none.
- Cards: gain part of "A trickle controls a river" → rule "Collector flow ≈ β × base flow." and note "β, its gain:
  about 200"; "every 2N3904 differs a little" became the robot's line once the gain is typed.
- Quiz: `q2` → `measure-gain`; `q3` dropped. A new chip check closes the lesson: β 200 with 20 µA into the base makes
  4 mA.
- Fix-it (`fix-link`): "My base meter reads zero. Why?" Repair: the yellow test link is still in while the probes
  bridge it, so the wire carries the flow and the meter reads 0.0 µA; pull the link.
- As built: no button, so the base is always fed. Two jumpers off the + rail are test links: pull the green one (the
  LED's feed) or the yellow one (the base's) and bridge the gap with the probes; the meter ranges by itself.
  Collector 3.63 mA, base 17.7 µA. `measure-gain` is the lab's note box: the typed gain is judged against the
  learner's own two readings (within 10%). `double-it` swaps R3 for 220 kΩ: 37 µA and 7.8 mA.

**14a `all-the-way-on`** (new) · "All the way on" · 6 min. Idea: with enough base flow a transistor is fully on, and
more changes nothing.
- Objectives: O1 "Half on": `half-on` (new); O2 "All the way on": `active-vs-saturated` (moved), then `no-brighter`
  (moved) after a guess (chips "Brighter", "The same", "Dimmer"). Secret: none.
- Cards: "Saturation" → rule "Fully on: the load sets the flow." and notes "half on: 5.5 V across", "saturated: fully
  on, 0.1 V" and, on R1, "this resistor sets the flow"; "Switches run cool" dropped (neither state gets warm here,
  about 20 mW half on and 2 mW fully on, so the meter across Q1 tells the story); "Designing a transistor switch" →
  parts bin.
- Quiz: `q2` → chip check ("Fully on, how much sits across Q1?", about 0.1 V); `q1`, `q5` dropped.
- Fix-it (`fix-half-on`): "My lamp switch only glows dimly. Why?" Repair: a 1 MΩ base resistor leaves Q1 half on
  (6.5 V across, 1.6 mA); swap in a smaller one until it is fully on.
- As built: lesson 13's circuit with Q1 in and 470 kΩ in the base. The meter probes C to E with S1 held: 5.5 V and
  3.6 mA; 10 kΩ gives 0.11 V and 14.8 mA; 4.7 kΩ gives 0.09 V and the same 14.8 mA.

**14 `touch-switch`** · Split, kept half, retitled · "Fingertip switch" · 7 min. Idea: two transistors chained multiply
their gain, enough for a fingertip. New: the touch pads (named in a `meet` beat). Unlocks `touch-pads`.
- Objectives: O1 "One transistor": `touch-it`; O2 "Two in a chain": `feed-q2` (new), then `darlington` after a guess
  (chips "Barely glows", "Full light"). Secret: none. `feather-touch` unchanged.
- Cards: Darlington part → note "gains multiply: 200 × 200" and rule "Chained transistors multiply their gains.";
  "Transistor or relay?" → parts bin.
- Quiz: `q4` → chip check (gains of 150 and 200, chained: 30,000); `q3` dropped.
- Fix-it (`fix-emitter`): "My touch lamp never lights. Why?" Repair: the yellow jumper from Q2's emitter lands in row
  24, off Q1's base row; move it to row 21.
- As built: the fingertip slider sets the pads from a light dry touch (2 MΩ) to a firm damp one (100 kΩ). One
  transistor glows faintly at a light touch (0.7 mA) and fully at a firm one (14.5 mA). Q2 waits on the far half with
  its two jumpers already in; the learner moves R5's far leg to Q2's base, and the pair lights fully (13.3 mA) at the
  lightest touch.

**15 `delay-timer`** · Split, kept half · "Wait for it" · 7 min. Idea: a load that drains the timing capacitor ruins the
timer; a transistor buffer fixes it.
- Objectives: O1 "Why no click?": `no-click`, after a guess (chips "In a second", "After a while", "Never"); O2 "Add a
  buffer": `buffer-in` (new), then `add-q1`. Secret: `impatient-restart` (kept id, now the bonus).
- Cards: "Why it never clicked" → note "drained by the coil: 3 V"; "The emitter follower" → rule "The emitter follows
  the base, 0.7 V lower." and note "C1 feeds only the base".
- Quiz: `q1` → a number check (probe C1: about 3.17 V); `q2` → a number check on the real bench (base to emitter:
  about 0.74 V); `q4` → secret; `q3`, `q5` → `tune-the-timer`.
- Fix-it (`fix-bypass`, new): "My timer never clicks. Why?" Repair: the yellow jumper is back, feeding the coil
  straight from C1; pull it so Q1 carries the coil alone.
- As built: the stopwatch starts on S1 and stops on the relay. Without Q1, C1 sticks at 3.16 V and K1 never clicks.
  `buffer-in` pulls the jumper and plugs Q1 into rows 20 to 22 (two jumpers already wait for its base and collector);
  `add-q1` is a fair run from an empty C1 (S1 off, reset, on): a click after about 1.5 s. The secret, off and straight
  back on without the reset, gives barely a wait (note "start empty for a full wait").

**15b `tune-the-timer`** (new) · "Tune it to five" · 7 min. Idea: more resistance in the RC means a longer delay; a
trimmer sets it. New: the trimmer by name (three periods: a `meet` beat, a tap on the wiper, a closing chip check).
- Objectives: O1 "Turn the knob": `longer-delay` (new), after a guess (chips "Shorter wait", "Longer wait", "No
  change"); O2 "Five seconds": `five-seconds` (moved). Secret: none. Unlocks `trimmer`.
- Cards: "Timing it" → note "clicks when C1 nears 6.7 V"; "The trimmer" → note "trimmer: wiper in the middle" and rule
  "Wiper and one end: a variable resistor."
- Quiz: `q3` dropped (the stopwatch times every run, so no sum is needed); `q5` → fix-it.
- Fix-it (`fix-wiper`): "The knob does nothing. Why?" Repair: the blue jumper to C1 sits on an end of the trimmer, so
  the whole 10 kΩ track is always in (about 15 s, whatever the knob says); move it to the wiper.
- As built: delay-timer's finished timer with R1 (1 kΩ) and the 10 kΩ trimmer in C1's feed: 1.47 s at the knob's zero,
  5.0 s near 23%, 18.4 s at its stop. `five-seconds` wants three runs in a row within 0.5 s of 5 s (the
  `five-second-club` trigger wants them tighter). The knob turns on the board (drag it, or use the arrow keys).

**16 `night-light`** · Trimmed · "Lights on at dusk" · 8 min. Idea: a light sensor that steals base flow makes a lamp
that lights in the dark. New: the phototransistor (a `meet` beat, a chip check on its legs, a closing chip check).
- Objectives: O1 "A light valve": `follow-the-light`; O2 "Flip it": `plug-pt2` (new), then `flip-it` after a guess
  (chips "On in the light", "On in the dark"). Fix-it: `set-dusk` (kept id). Secret: none.
- Cards: "A transistor with a window" → note "more light, more flow"; "Stealing base current" → rule "In light, the
  sensor steals the base flow." and note "dark: on. light: off."; "Setting the threshold" → the fix-it; "The fuzzy
  edge" dropped (the dim glow near the threshold waits for Unit 4).
- Quiz: `q4` → chip check ("How many legs does it have?", two; note "light does the base's job"); `q1` → the guess
  before `flip-it`; `q3` → fix-it; `q2`, `q5` dropped.
- Fix-it (`set-dusk`): "My lamp only wakes in pitch dark. Why?" Repair: turn the trimmer toward less resistance until
  the lamp is on at 18% light and off at 32%.
- As built: the desk lamp slider lights every phototransistor. Station A is PT1 feeding the red LED (glow 0.15 at
  10% light, 0.5 in full light); station B is Q1 switching the yellow lamp, its base fed through R3 and the trimmer.
  The learner plugs PT2 into rows 30 and 31, across Q1's base. The trimmer starts at 90%, where the lamp wakes only
  below about 7% light.

**17 `twin-flasher`** · Trimmed · "The twin blinker" · 9 min. Idea: two transistors cross-coupled by capacitors take
turns forever.
- Objectives: O1 "Two switches": `bases-up`; O2 "Make them talk": `cross-couple`, after a guess (chips "Both stay on",
  "They take turns", "Both go dark"), then `look-inside` (kept, still required) on the scope, after a guess (chips
  "Down to 0 V", "Below 0 V"). Fix-it: `slow-it-down` (kept id). Secret (new `one-cap`): "Pull one capacitor out."
  Note "no cross, no turns".
- Cards: "The seesaw" → note "one on kicks the other off" and rule "Cross-coupled, they take turns."; "Below zero?" →
  note on Q2's base "down to −7 V, then back"; "How long is a blink?" → fix-it; "Who goes first?" dropped.
- Quiz: `q6` → chip check ("Q1 switches on. What happens to Q2?", it gets kicked off); `q2` → the `look-inside` guess;
  `q3` → the secret; `q1`, `q4`, `q5` dropped.
- Fix-it (`slow-it-down`): "Too fast for my tower. Make it 2 s." Repair: swap both 10 µF for 22 µF.
- As built: Q1 and Q2 face each other across the channel; the learner adds the 68 kΩ base resistors, then the two
  10 µF capacitors (+ on one collector, stripe on the other base). 10 µF blinks every 0.83 s, 22 µF every 1.87 s;
  Q2's base dives to about −6.8 V. With one capacitor out, both LEDs just stay on.

**18 `flasher-to-tone`** · Trimmed · "Shrink it to a song" · 9 min. Idea: shrink the capacitors and the blink speeds up
until it is a tone. New: the speaker (a `meet` beat and a closing chip check). The bead code from `capacitor-labels`
is a chip check, not a pop-up card: "Bead code: two digits, then zeros, in pF. Which is 1 µF?" (105).
- Objectives: O1 "Tick, tock": `tick-tock`; O2 "Faster and faster": the bead check, `flutter`, `hum`; O3 "Make it
  sing": `song`. Secret (new `lopsided`): "Mix one 104 with one 103." Note "each cap times its half".
- Cards: "Hertz" → note "about 1,300 a second: 1.3 kHz"; "Scaling time" → rule "Smaller capacitors, higher pitch.";
  "Eyes and ears" → note on the LED "too fast to see: steady"; "Inside a speaker" → note "a click each time Q3
  switches".
- Quiz: `q4` → guess before `hum` (chips "Even faster", "A steady glow"); `q1`, `q2`, `q3`, `q5`, `q6` dropped.
- Fix-it (`fix-speaker`): "My speaker is silent. Why?" Repair: one of the speaker's legs has slipped out of Q3's
  collector row; plug it back in.
- As built: lesson 17's flasher, built, with Q3 driving an 8 Ω speaker through 220 Ω on the far half; the scope shows
  Q2's collector and reads the pitch. 10 µF ticks (two clicks per 0.8 s cycle), 1 µF (105) flutters at 10 to 13 Hz,
  100 nF (104) hums at about 130 Hz with both LEDs steady, 10 nF (103) sings at about 1.3 kHz. The lopsided pair
  gives about 220 Hz. The burnout secret was dropped: without R7, Q3 only runs hot.

**19 `siren`** · Trimmed · "The siren button" · 10 min (the unit's landmark build). Idea: a slow oscillator nudging a
fast one moves the pitch; a capacitor turns the steps into a wail (the smoothing idea, already known).
- Objectives: O1 "Two voices": `two-voices`; O2 "Introduce them": `bridge`, after a guess (chips "One steady tone",
  "Two tones in turn", "Silence"); O3 "Make it wail": `wail`. Secret: `trill` ("1 µF beads for C1 and C2. C5 out.",
  note "small caps: a fast warble"). `wailer` unchanged.
- Cards: "One oscillator steering another" → note "1.36 to 1.85 kHz: nee-naw" and rule "Join circuits gently, through
  resistors."; "Why resistors, not wires?" → fix-it; "From steps to slides" → note on C5 "steps become slopes"; "Calm
  debugging" → the fix-it's hints.
- Quiz: `q1` → fix-it; `q2` → chip check ("So what does C5 do?", it smooths the steps); `q3`, `q4`, `q5` dropped.
- Fix-it (`fix-muddy`): "My siren sounds muddy. Why?" Repair: swap the plain wire for the 100 kΩ R9.
- As built: holding the button, the fast oscillator holds about 1.2 kHz while Q1 blinks every 0.83 s. Two 100 kΩ from
  the fast bases to Q1's collector swap the pitch between about 1,360 and 1,850 Hz; R10 (10 kΩ) and C5 (22 µF) turn
  that into a glide between about 1.40 and 1.65 kHz. A plain wire in place of one 100 kΩ makes the pitch jump about
  between 1.0 and 2.4 kHz.

---

## Part D. Achievements, unlocks and totals

### D1. Achievements to update

| Id | Change |
|---|---|
| `first-reading`, `glow-getter` | Unchanged conditions; their lessons now live in Start here. |
| `island-founder` | "Finish all 23 lessons of Basics." The count in the description comes from the course outline. |
| `curious-mind` | Every secret Basics offers (the achievements test keeps the list complete): `two-hundred`, `double-spacing`, `slide-along`, `tiny-gold`, `probe-tips`, `other-side`, `blue-led`, `ten-k`, `swap-in-3k3`, `smallest-wins`, `one-watt-too`, `battery-check`, `watch-it-sag`, `one-lemon-led`, `why-no-resistor` (15 once Start here takes its lessons). The threshold is half, rounded up: 8. |
| `bracketed` | `fuse-guard/blow-1a` done, and `big-current/measure-big` done with no `blown` event on F2 in that lab (a trigger in `big-current`). |
| `lawmaker`, `smoke-tester`, `sour-power`, `upside-down`, `stripe-sharp`, `clean-sweep` | Unchanged (their tasks stay in their labs; checks still feed `firstTry`). |
| `two-islands` | "Finish all 28 lessons of Switching." The count comes from the course outline. |
| `spark-catcher` | `coil-kickback/watch-the-spike` and `the-diode/diode-clamp` done. |
| `tau-tamer` | The three `rc-time-constant` tasks plus the `hit-the-target` fix-it, each τ within 5%. |
| `five-second-club` | Lab `tune-the-timer`, task `five-seconds`. |
| `tuning-fork` | No lesson's tone lands near 440 Hz, so it is the free bench's challenge (unit-2.md, section 8): a flasher of tray parts (100 nF beads, two 10 kΩ in each base) sings about 433 Hz. The description says so. |
| `night-shift` | The sandbox card `dusk-patrol` needs a light control the free bench lacks, so for now it is `night-light/set-dusk` (lamp on at 18% light, off at 32%). |
| `pin-sleuth`, `either-way`, `feather-touch`, `wailer`, `first-click`, `buzzed-to-bits`, `wrong-way-round`, `smoke-signals` | Unchanged. |

### D2. Parts unlocks that move

| Part | Was | Now |
|---|---|---|
| `battery-9v`, `alligator-clips` | `welcome-to-the-bench` | same id, now in Start here |
| `multimeter`, `test-leads` | `meet-the-meter` | same id, now in Start here |
| `battery-aa` | `tiny-and-huge-numbers` | Start here `the-push` |
| `resistor` | `reading-the-stripes` | Start here `the-squeeze` (Basics keeps no unlock) |
| `led-red` | `first-glow` | same id, now in Start here |
| `breadboard`, `jumper-wires` | `breadboard-inside` | Start here `holes-that-hold-hands` |
| `led-green`, `led-yellow` | `relay-thresholds` | `relay-chooser` |
| `diode-1n4001` | `coil-kickback` | `the-diode` |
| `electrolytic-capacitor` | `relay-buzzer` | `tame-the-buzz` |
| `ceramic-capacitor` | `capacitor-labels` | `kick-it-through` |
| `trimmer` | `delay-timer` | `tune-the-timer` |

Island pieces stay with the kept ids. Each new lesson places a piece too; suggested: `salt-and-water` `cell-jar`,
`the-liar` `resistor`, `share-the-push` `jumper-arch`, `use-the-law` `meter-kiosk`, `end-to-end` `resistor`,
`count-the-watts` `heatsink`, `big-current` `fuse`, `how-long` `cell-jar`; `two-buttons` `pushbutton`, `both-switches`
`switch`, `relay-chooser` `led-lamp`, `the-diode` `diode`, `tame-the-buzz` `capacitor`, `kick-it-through`
`ceramic-cap`, `count-the-gain` `transistor`, `all-the-way-on` `heatsink`, `tune-the-timer` `pot`.

### D3. Totals

| Unit | Before | After |
|---|---|---|
| Start here | none | 12 lessons, about 77 min (wave 1: 11, about 71 min) |
| Basics | 18 lessons, about 210 min | 23 lessons, about 153 min |
| Switching | 19 lessons, about 226 min | 28 lessons, about 194 min |
| Course | 37 lessons, about 436 min | 63 lessons, about 424 min |

More, shorter lessons, a little less time, and roughly a quarter of the reading: each lesson stays under 150 words of
main-path text where the old ones carried about 600.

### D4. Order of work

1. The bench-first runtime (start-here.md 6.1, R1 to R11) and the converted reference labs `welcome-to-the-bench` and
   `first-glow`.
2. Start here wave 1, so new learners get the new opening first.
3. Basics in module order; then Switching in module order. Convert a whole module at a time so its landmark lands on
   the right lesson.
4. Start here wave 2 (`rub-and-stick`) once the static toy exists.
