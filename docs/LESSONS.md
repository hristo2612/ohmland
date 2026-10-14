# How to write a bench lesson

A bench lesson keeps the learner at the bench the whole time. There is no hook page, no explain cards and no quiz
page: the robot says one short line, the learner does one thing on the bench, and the bench answers. Discoveries are
drawn onto the parts, rules are stamped quietly under the robot's line (and slide into the notebook as the beat ends),
and checks are taps and picks on the bench. At the end the notebook page fills itself in and is signed off.

Read `docs/DESIGN-PRINCIPLES.md` first: it decides how much goes on a screen and how much we say. Wording rules are in
`docs/CONTENT.md`, the lab file in `docs/LABS.md`. The reference lessons are
`content/units/start-here/first-cases/welcome-to-the-bench` and Start here's Tool cases in
`content/units/start-here/tool-cases/` (meet-the-meter, milli-and-kilo, how-a-breadboard-works, parts-drawer,
first-glow), each with its lab in `content/labs/<id>.ts`.

## Two files

- `content/labs/<lab>.ts` holds the bench, the tasks (goals, hints, nudges, setups) and the solution. It is the source
  of truth for anything the simulator decides.
- `content/units/<unit>/<module>/<lesson>/lesson.yaml` holds the words and the order: the beats.

## lesson.yaml

```yaml
format: bench                 # a bench lesson (a file without `format` is a classic stepper lesson)
id: first-glow                # kebab-case, stable forever: progress keys on it
version: 2                    # bump when beats change; saved answers of another version are not resumed
title: Your first glow
summary: Wire a battery, a resistor and an LED into a loop, and find out which way an LED goes.
minutes: 8
lab: first-glow               # content/labs/first-glow.ts
unlocks: { parts: [led-red], isle: led-lamp }

start:                        # the first screen, over the bench
  title: Wake the robot's face            # the mission (optional, 5 words)
  say: My face is one LED. Dark for weeks. Wire me a glow?
  go: Let's wire it                       # the button (optional, 4 words; default "Start")

beats:
  - say: This is an LED. Tap it.          # the robot's line (12 words at most)
    objective: Make it glow               # starts an objective (optional): eyes fill per objective
    meet: D1                              # three-period lesson, first period: name a part
    note: { at: D1, text: LED }           # for meet: the name written onto the part
  - say: Clip a loop. Plus, resistor, LED, minus.
    do: build-loop                        # a lab task: the beat ends when its goal is met
    done: It glows! First light on this island in ages.   # the robot's reaction
    note: { at: R1, text: holds it to about 5 mA }        # a discovery drawn onto the part (6 words)
  - say: Want me brighter? Try another resistor.
    popup: { widget: resistor-slider, at: R1, props: { part: R1, led: D1, values: [470, 1000, 1500] } }
  - say: Quick one. Tap the long leg.
    tap: { answer: D1.anode, among: [D1.anode, D1.cathode] }   # a check on the bench, graded on the first try
    wrong: { D1.cathode: "That's the short leg. Try the other." }
    note: { at: D1.anode, text: "long leg: anode, toward plus" }
    rule: "LED: long leg to plus."        # stamped under the line, then into the notebook (8 words)
  - say: Swap the LED's legs. Guess first.
    guess: { options: [It still glows, It goes dark, It burns out], answer: It goes dark }   # before the action
    do: flip-led
    note: { at: D1, text: "backwards: blocked" }
    rule: LEDs work one way only.

secret:                       # the bonus, offered after the beats (and found any time by experimenting)
  task: no-resistor           # a bonus task in the lab
  say: Curious? Leave the resistor out. It's free here.
  done: Pop. That LED gave its life for science.
  spot: [R1, D1]              # the parts in play, as on a beat (optional)
  note: { at: D1, text: about 1 A for a blink }
  rule: Every LED needs a resistor.

fixit:                        # the closing check: a broken bench to repair, relaxed (the clock is opt-in)
  say: Fix-it time. No glow here. Why?
  tasks:
    - task: fix-reversed      # a lab task with a `setup` that breaks the bench
  timer: 60                   # seconds on the optional clock (default 60)

end:
  say: You built that from scratch. My face approves.
```

### A beat

Every beat has a robot line (`say`) and at most one thing to do:

| Field | The learner | Ends when |
|---|---|---|
| `meet: <part>` | taps the part the robot names (its name is written onto it) | the tap |
| `do: <task>` | works on the bench | the lab task's goal holds |
| `tap: { answer, among }` | taps one of the dashed targets on the bench | the right one is tapped |
| `tap: { joinedTo: <hole> }` | taps a breadboard hole joined to the marked one | a hole on the same strip is tapped |
| `tap: { anyHole: true }` | taps any hole (the note may say `{hole}`) | any hole |
| `pick: { options, answer?, on? }` | picks a chip (`on` rings a part: "What is this?") | the right chip (any chip without `answer`) |
| `number: { answer, unit?, tolerance? }` | types a number the bench gave them | within `tolerance` percent (default 5) |
| `popup: { widget, at, props }` | plays with the lesson's one pop-up card | "Got it" |
| nothing | reads, then taps Next | Next |

A `do` beat whose lab task declares a `note` (a number read off the bench, `lab.note(id)` in `docs/LABS.md`) shows a
box for it under the robot's line, labelled with the note's `label` and `unit`. The learner types the number and
presses Enter (or Check); the task's goal judges it against the bench, and if the task is still open a moment later the
robot nudges. Use it when the bench decides the right answer (a measured τ that depends on the parts); use `number`
when one fixed answer is right.

Optional, on any beat:

- `objective`: starts an objective (a few words). The robot's eyes fill in equal steps as each objective (and the
  fix-it round) finishes, and the current objective's name shows as a quiet kicker. Objectives are never listed.
- `spot: [parts]`: the parts in play. The bench frames and spotlights them. Meet, tap and pick beats spot their part by
  themselves; leave `spot` out when the result shows somewhere else (a switch that lights a lamp). The secret and the fix-it
  take a `spot` too (`secret: { spot: [R1, D1], ... }`, `fixit: { spot: [R3, D1], ... }`, framed through every fix-it
  task).
- `guess` (only with `do`): an ungraded prediction just before the action. The notebook keeps it in blue ink. When
  the beat is done the robot starts its line with how it went ("Called it." or "You guessed it stays lit."), so write
  the `done` line to follow that.
- `done`, `note`, `rule`: the discovery. A beat with any of them ends on a Next button so the learner can read it; a
  beat without one moves on by itself after a beat of the robot's success line. A beat with nothing to do draws its
  `note` and stamps its `rule` as it begins, beside its line, and the learner taps Next when they have read it.
- `hint` (checks) and `wrong` (lines for particular wrong taps or chips). A `do` beat uses its lab task's `hints`.
- `then` (checks): bench steps, written as the lab's solution steps, applied once the tap, pick or number is right,
  the way a setup is applied: `then: [{ do: param, part: PL1, params: { wheel1: 3 } }]` turns a padlock's first wheel
  to the digit just found. Use steps that set a state (`param`, `flip` with `to`, `clip`): a resumed lesson applies
  them again. A step that needs the bench to keep its new state through a later task's setup belongs in the lab's
  solution as well.
- `palette` and `program` (with `tool: code`, Unit 5): the blocks the drawer offers in this beat, each a block's name
  or steps in bench C (`palette: ["digitalWrite(13, LOW);", delay]`: one block, not a toolbox; a beat without a
  palette offers none), and a program the drawer starts the beat from (once per visit; the learner's edits after that
  are theirs). A code beat's one action is one edit, then Upload; its task's goal reads the bench (the lamp, the serial
  lines), not the code. Hide the text view until lesson 14 with the lab's `code: { text: false }` (docs/LABS.md, Code).
- `xray: true`: the breadboard's metal strips show during the beat.
- `trace: B1.neg`: the loop tracer runs from that terminal once the beat's action is done (the right tap on it, the
  task's goal met), or as the beat begins when it has nothing to do. Its red pencil line clears when the beat ends.
- `tool`: the one instrument or panel the beat needs: `meter`, `scope`, `logger`, `stopwatch`, `tapper`, `controls`,
  `views` (the lab's overlay toggles, Flow, Electrons and Push, from `overlays.offer`), the microcontroller board's
  `code` (the code drawer), `serial` (the serial monitor) or `millis` (its clock, with the day-49 jump), or a lab
  panel id. Without it, a lab panel tied to the beat's task (its `show`) appears. Never two at once. A tool stays
  open into the next beat that names it too (through that beat's guess), and closes when the next beat does not. The
  fix-it round and the secret take a `tool` too (`fixit: { tool: meter, ... }`, `secret: { tool: meter, ... }`): the
  meter's range, for one, can only be changed on its panel.

Anchors (`at`, `answer`, `among`, `on`, `spot`, `trace`) use the lab's shorthand: a part `D1`, a lead `D1.anode`, a
hole `e12` or `rail+:21`, a clip lead end `TL1.a`, a jumper end `W1.b`, or a raw bench anchor (`pin:D1.anode`,
`part:D1`). A named mark on a part is `part:<id>/<mark>`: the meter's `part:M1/dial`, `part:M1/display`, sockets
(`part:M1/com`) and the dial's letters by mode (`part:M1/dcv`, `part:M1/ohm`, `part:M1/dca-ma`), a drawing's symbol
`part:SD1/R1`, a box's `lid`, `knob`, `tag` and padlock wheels (`part:CAB/wheel1`), a gate's `flag` and `unit`, an LED's
stress bar (`part:D1/stress`) and a resistor's colour bands (`part:R3/band1` to `band4`). Taps, notes and the
spotlight work on marks in both views; a tapped mark that is wrong writes its own name ("dial", "wheel 2", "stripe 4").

## Control of error

The bench corrects the learner, not a grade. A wrong tap is never marked wrong: the tapped thing writes its own name
(or, on a breadboard, the strip it really belongs to), and the robot nudges. A wrong build shows its real consequence
(the LED stays dark, the part smokes) and a lab task's `nudges` say a gentle line once the bench has shown the mistake
for a moment:

```ts
nudges: [{ when: (lab) => backwards(lab), say: "Dark? Turn the LED around. Long leg to plus." }],
```

A simulator warning (a shorted battery, a part running hot) never prints its long explanation in a lesson. The part
that raised it gets a short note in red pencil and the robot says a kind line, both from `lessonBench.notices` in
`apps/web/src/i18n/en.ts` (keyed by the warning's kind or cause); the note leaves after a few seconds. In a fix-it round
warnings say nothing at all: the bench shows the evidence, and the learner finds the fault.

After a `setup` puts a broken bench down (a fix-it), its task's nudges wait for the learner's first move on the bench:
the broken bench matches them from the start, and a nudge before the learner has tried would give the fix away.

## Fix-it benches and parts that come into play

A lab task's `setup` is a list of solution steps the lesson applies when the task's beat begins, on top of the bench
the solution reaches at the previous check: the fix-it round's broken circuit (first-glow's LED turned round), or parts
that come into play halfway (milli-and-kilo's padlock wheels, all set before the lid can lift). The solution must start
that task's steps with the same steps: spread one const into both.

```ts
const SWAP_BATTERY: SolutionStep[] = [{ do: "clip", lead: "TL1", end: "a", to: "B1.neg" }, { do: "clip", lead: "TL3", end: "b", to: "B1.pos" }];
// the task
{ id: "fix-reversed", setup: SWAP_BATTERY, goal: (lab) => { if (!lab.isLit("D1")) lab.memory["dark"] = true; return lab.memory["dark"] === true && lit(lab); }, ... }
// the solution
[...earlierSteps, { do: "check", task: "flip-back" }, ...SWAP_BATTERY, ...fixSteps, { do: "check", task: "fix-reversed" }]
```

The setup's own simulator inputs (a meter's mode or range set with a `dial` step) are sent after the checkpoint's, so
`{ do: "dial", mode: "dcv", range: "200V" }` really leaves the meter on 200 V. A fix-it goal should need the broken
state first (the `memory` pattern above), so a bench that never broke does not count. The clock is the learner's
choice ("Race the clock"); nothing happens when it runs out.

## Order and the lab

The lesson walks the lab's required tasks one at a time: the beats' `do` tasks and then the fix-it tasks must be
exactly the lab's required tasks, in the lab's order. Only the task of the current beat (and the secret, which is a
bonus task) can complete. `apps/web/src/lesson/bench/lessons.test.ts` checks this, the setups, the tools and that every
anchor exists on the bench.

## Budgets

The build fails a lesson that breaks them (`apps/web/src/content/schema.ts`):

| Thing | Limit |
|---|---|
| Robot line (`say`, `done`, the start line) | 12 words |
| Note on a part | 6 words, lower case field-note style |
| Rule | 8 words; 3 rules at most per lesson (1 or 2 is better) |
| Chip (guess, pick, start button) | 4 words; 2 or 3 guess chips |
| Main path (start, every beat's line, done, note, rule and chips, the secret, the fix-it, the sign-off) | under 150 words |
| On demand (`hint`, `wrong`) | 12 words each, under 60 words in all |
| Pop-up cards | one per lesson, only when it is truly hands-on |

The learner acts within 5 seconds: the start screen has one button, and the first beat asks for a bench action.

## Introducing a part

Use the three-period lesson. "This is a resistor." (`meet`, or a note on the part at the moment it works.) "Tap the
resistor." (a `tap` check; a wrong tap names what was tapped.) "What is this?" (a `pick` with `on`, near the end).
One new part per lesson.

## XP and progress

Nothing new to learn: a graded check right on the first try counts like a quiz item (10 XP), a lab task like a lab task
(15 XP), the lesson 30 XP. The player saves the current beat and the answers (`check:<beat>`, `guess:<beat>`,
`tasks:<lab>`) and resumes at the beat, with the bench put back at that task's checkpoint.

## The notebook page

It fills itself in: rules found, guesses against what happened, checks and which try they came right on, the fix-it
round (and the time left if the learner raced the clock), parts that went to the Hall of Fried Parts. The learner can
open it any time from the bar (on a phone it also holds the 3D and Ink switch); at the end it is the signed-off
summary. Nothing to write.

A part that dies while the learner works gets "off to the Hall" in red pencil and a Replace control beside it on the
bench, for that beat only: a part fried on purpose (a fuse blown to be probed next) stays fried. Achievements a lesson
earns on the way never toast over the bench; the finale lists them.

## Trying a lesson

- `pnpm dev`, open `/learn/<unit>/<lesson>`. `window.ohmlandLab` works as in a lab (`status()`, `bench()`,
  `project(target)`, `step(solutionStep)`, `view()`).
- `pnpm --filter @ohmland/web test` validates the lesson against its lab and replays the lab's solution.
- `node apps/web/scripts/lesson-shots.mjs --lessons=<id>` plays a reference lesson and screenshots every moment.
