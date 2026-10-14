# Voice rewrite: the brief for rewrite agents

Every bench lesson is being rewritten in the course's new voice. This page is the whole job: the rule, a checklist per
beat, the two reference lessons before and after, what to touch, what not to touch, and how to check your work. Read
`docs/LESSONS.md` ("Writing beats" and "Budgets") and `docs/CONTENT.md` ("Voice") first.

## Why

The old lines were written to a 12-word cap and drifted into field notes: "Probes on the skin. Turn the dial to Ω."
A beginner reads the first half as an order, finds nothing to do (the probes are already there), does not know what a
probe, a dial or Ω is, and is never told where the result will show. The user tried four voices and chose two, mixed:
sometimes "clear sentences", sometimes "why first". Their words: short is still good, but a line must be clear and
complete.

## The rule

**Why first.** Open each new idea with one short sentence of purpose, then the step. Use it on:

- the first beat of the lesson,
- the first beat of each objective (a beat with `objective:`),
- a beat that brings in a new part (a `meet`, or the part's first job),
- the secret's `say` and the fix-it's `say`.

The purpose sentence is a real reason, not filler: "Let's measure dry skin.", "Let's test the loop rule.", "Big
numbers get short names." Never "Let's do this." A `done` line on any beat may carry a short "because" ("Dark at once,
because one gap anywhere breaks the whole loop").

**Clear sentence.** Every other beat is one complete, concrete instruction. Name the verb, the thing, and where it is.
Name a new word the moment it appears, with a short phrase right after it ("the probes, the meter's two pointed tips";
"Ω, ohms"; "OL means over the limit"). Use the screen's own labels, spelled as the screen spells them (WET, Beep, Ω,
Range, ON, V⎓).

**Never** write a state as if it were an order (wrong: "Probes on the skin."; right: "The probes already touch the
skin patch: turn the dial to Ω."). Never start with "it", "that", "this" or "its" pointing at something from an earlier
beat: the note that named it has faded and the camera has moved, so name the thing again ("the loose clip", "the black
probe"). Never telegraph ("Quick one.", "Still dark.", "Your turn.").

**Length.** About 22 words at most for a robot line (both why-first sentences together), notes 6, rules 8. The schema
enforces 22 / 6 / 8 per line, 320 words on the main path and 120 of on-demand lines; the references use about 245 and
280 on the main path. Shorter is better when nothing is lost; the cap is not a target.

**The test for every beat:** a 12-year-old with zero electronics finishes reading and knows what to do, where to do it,
and what to look for.

## Checklist per beat

1. Pick the voice: why first (first beat, an objective's first beat, a new part, the secret, the fix-it) or a clear
   sentence (everything else).
2. The line has a verb the learner does, the thing they do it to, and where that thing is ("on the wooden block", "on
   the battery", "under Range on the meter panel", "along the skin patch").
3. Every word a beginner would not know is named with a short phrase the first time this lesson uses it, even if an
   earlier lesson named it once ("Ω, ohms" again is fine). `content/glossary.yaml` lists the ones the test checks;
   the test is a floor, not the whole job.
4. Every label in the line matches the bench and the panels exactly. Open the lesson and look; do not trust the old
   line or the blueprint.
5. The learner knows where the result shows: the line says it ("then read the screen"), or the `done` line does ("The
   screen says 0.840 MΩ").
6. Numbers are realistic and true: read them off the bench while you play. If a reading depends on the range, say
   both forms ("About 46 kΩ, or 0.046 MΩ").
7. No state written as an order, no leading "it / that / this / its" pointing back, no fragments.
8. A guess beat: the line says what to guess ("Guess what the lamp will do, then ..."). The `done` line follows the
   robot's "Called it." or "You guessed ...", so it starts with the result.
9. The `done` line is a complete sentence about what just happened, with a short "because" when it turns a result into
   a discovery.
10. Notes and rules stay field notes on the bench ("loop: metal all the way round", "Measure ohms with no battery
    connected."): they label, they do not instruct. A rule must be earned by this lesson.
11. Hints, `wrong` lines and nudges stand alone. A hint the learner asks for is written under the robot's line (the line
    stays); a `wrong` line, a check's `hint` after a wrong answer and a nudge take the line's place for a moment, so
    they name the thing again and say the move.
12. On a phone, in 3D and in Ink, what the line names is on screen while the learner works, and its marks can be told
    apart. A phone frames the task's `highlight` (or the beat's `spot`). If the line names something off screen or too
    small, add a `spot` that frames it (what-resists' secret spots the skin patch, so the 2 and 4 marks are readable),
    or reword the line toward what is framed. Report framing bugs instead of changing the bench.
13. Say how to tell look-alikes apart by what the learner can see. The 3D battery's two snaps carry no readable + or
    −, so welcome says "the metal stud the black wire is clipped to".

## What to touch

In `content/units/<unit>/<module>/<lesson>/lesson.yaml`:

- `start.say` (and `start.title` or `start.go` only if they are unclear),
- every beat's `say`, `done`, `note.text`, `rule`, `hint`, `wrong` lines,
- chip wording (`guess.options`, `pick.options`) only when a chip is unclear; then keep `answer` and the `wrong` keys
  equal to the new chip text,
- `secret.say`, `secret.done`, `secret.note.text`, `secret.rule`,
- `fixit.say` and any `fixit.tasks[].say`,
- `end.say`,
- `spot` on a beat, only to frame what the line names (checklist 12),
- the file's header comment, if it describes the old wording.

In `content/labs/<lab>.ts`, for the tasks this lesson walks:

- `hints` (gentlest first; each one stands alone),
- each nudge's `say` (not its `when`),
- `success` (shown when the beat has no `done` line, as the lesson moves on: keep it short),
- `mascot.fried` if it points at something vague ("Unclip that one.").

## What not to touch

- Task ids, `goal`s, `setup`s, `highlight`s, `prompt`s, `notice`s, notebook tags, the `solution`.
- The bench: parts, leads, positions, labels, instruments, the frame.
- The beats' order, count and actions (`do`, `meet`, `tap`, `pick`, `number`, `popup`), their answers and anchors,
  `trace`, `tool`, `then`, `objective` names. Do not bump `version` (the beats are the same).
- `watch` (refused by the schema in real lessons) and the coach mark: they belong to the try-out page only.
- `content/variants/`, other agents' lessons, `packages/bench`, the player.
- `STRICT_LESSONS` and `FIRST_USE_MODE` in `apps/web/src/lesson/bench/lessons.test.ts`: the orchestrator flips them
  when the rewrite lands. Check your lesson with the environment variable below instead.

## The references, before and after

### Welcome to the bench (`start-here/welcome-to-the-bench`)

| Beat | Voice | Before | After |
|---|---|---|---|
| start | | My desk lamp is dark. Take the case? | My desk lamp won't light. Will you help me find out why? |
| b0 | why first (lesson) | Flip its switch. | Let's try the easy fix first. Flip the switch, the silver lever on the wooden block, over to ON. |
| b1 | clear | Still dark. Tap the battery's minus snap. | Tap the battery's minus (−) snap, the metal stud the black wire is clipped to. My pencil will trace the path from there. |
| b1 wrong | | That's plus. Minus is the other snap. | That's the plus (+) snap. Tap the other metal stud, the one with the black wire. |
| b1 done | because | (none) | My pencil stops at the red clip, the jaws on the red wire, because it bites plastic, not metal. |
| b2 | clear | Move that clip onto the metal snap. | Drag the red clip off the battery's plastic wrapper and onto its plus (+) snap, the other metal stud. |
| b2 done | because | (the lab's "It glows!") | It glows, because electricity can now flow through metal all the way round. |
| b2 rule | | Flow needs a closed loop. | Flow needs a closed loop of metal. |
| b3 | why first (objective) | Unclip a lead far from the lamp. Guess first. | Let's test the loop rule. Guess what the lamp will do, then pull the black clip off the lamp. |
| b3 done | because | Dark at once. | Dark at once, because one gap anywhere breaks the whole loop. |
| b4 | clear | Clip it back. | Put the loose clip back on the metal it came from, so the loop is closed again. |
| b5 | clear | What is this, all the way round? | What do we call a metal path that goes all the way round and back? |
| b5 wrong | | (none) | The lamp is one stop on the path. What is the whole path called? / A line has two ends. This path has none: it comes back round. |
| secret | why first | Curious? Swap the battery's two clips. | Bonus: let's see if the way round matters. Swap the battery's two clips, red onto minus and black onto plus. |
| secret done | because | Dark, and nothing broke. | Dark, but nothing broke, because this lamp only lets flow through one way. |
| fixit | why first | Fix-it time. Switch on, still dark. Your turn. | Fix-it time, to test your eye. The switch is on, but the lamp stays dark: find the gap. |
| end | | Case closed. First light in ages. | Case closed. You followed the loop and found the gap: first light in ages. |

The lab (`content/labs/welcome-to-the-bench.ts`):

| Task | Before | After |
|---|---|---|
| close-the-switch hint | The lever on the wooden block. | The switch is the wooden block with OFF and ON printed on it. Tap or drag its lever over to ON. |
| close-the-switch success | Click. Nothing. | Click. The switch is on, but the lamp is still dark. |
| find-the-gap hint | Drag the clip onto the shiny snap. | The red clip sits on the battery's plastic wrapper. Drag it onto the round metal stud, the plus (+) snap. |
| find-the-gap nudge | Keep the switch on for this one. | Flip the switch back to ON: the loop is open there too. |
| break-the-loop hint | Drag any clip off its part. | Drag the black clip off the lamp's leg and drop it on the empty desk. |
| break-the-loop nudge | Keep the switch on for this one. | Flip the switch back to ON, so a clip is the only gap. |
| mend-the-loop hint | Drag the loose clip back onto the metal it came from. | Find the clip lying loose on the desk, and drag it back onto the metal it came from. |
| mend-the-loop success | Light's back. | The light is back, because the loop is closed again. |
| fix-it hints | Follow the clips round. One bites wood, not metal. / Move that clip onto the screw terminal. | Follow the wires round the loop, clip by clip. One clip bites wood instead of metal. / Move the yellow clip off the wooden block and onto the metal screw beside the lever. |
| fix-it success | Wood is a gap too. Fixed. | Fixed! Wood is a gap too, because it carries no flow. |
| mascot.fried | Whoa, a shortcut. Unclip that one. | Oh no, too much flow burned a part out. Move the last clip back, then tap Replace. |

### What resists? (`basics/what-resists`)

| Beat | Voice | Before | After |
|---|---|---|---|
| start | | Even you resist a little. Let's measure. | Everything squeezes the flow a little, even your own skin. Let's measure how much. |
| b0 | why first (lesson) | Probes on the skin. Turn the dial to Ω. | Let's measure dry skin. The probes, the meter's two pointed tips, already touch the skin patch: turn the dial to Ω, ohms. |
| b0 done | because | Almost a million ohms! | The screen says 0.840 MΩ: almost a million ohms, because dry skin is a poor path for flow. |
| b0 rule | | Measure squeeze with the power off. | Measure ohms with no battery connected. |
| b1 | clear | It says 0.840 MΩ. How many kΩ is that? | The screen says 0.840 MΩ, which is 0.840 million ohms. How many kΩ, thousands of ohms, is that? |
| b1 hint | | M is a million. k is a thousand. | One MΩ is 1,000 kΩ, so multiply 0.840 by 1,000. |
| b1 done | because | (none) | Right, 840 kΩ, because one MΩ is a thousand kΩ. |
| b2 | why first (objective) | Tap Wet on the patch. Guess first. | Let's see what water does to the ohms. Guess, then tap WET, one of the tabs along the skin patch. |
| b2 done | because | About 46 kΩ. Water lets the flow in. | About 46 kΩ, or 0.046 MΩ: far fewer ohms, because water lets the flow into your skin. |
| b3 | clear | Quick one. What does Ω measure? | Look at the meter's dial, circled on the bench. What does the Ω setting measure? |
| b3 wrong | | Push is V, volts. Try again. | Push is measured in V, volts. Try another. |
| secret | why first | Curious? Move one probe to 4 cm. Double the ohms? | Bonus: does twice the distance give twice the ohms? Drag the black probe from the 2 mark to the 4 mark. |
| secret done | because | Up a little. Nowhere near double. | The ohms barely go up, because most of them are where the tips touch your skin. |
| fixit | why first | Fix-it time. Dry skin reads OL. Fix it. | Fix-it time. OL means over the limit: the skin's ohms are too big for the meter's range. Get a real number. |
| end | | You resist. Now you can prove it. | You resist a little, and now you can measure how much. |

The lab (`content/labs/what-resists.ts`):

| Task | Before | After |
|---|---|---|
| dry-skin hints | Ω is on the dial, between V and the beeper. / Keep the probes on the 0 and 2 cm marks. | Turn the meter's round dial to Ω, just after V~, or tap Ω on the meter panel. / Leave the probes where they are, on the 0 and 2 marks of the skin patch. |
| dry-skin nudge | OL? Step the range up to 2M. | The screen says OL: the number is too big. Under Range, pick 2 MΩ, two million ohms. |
| wet-skin hints | The tabs on the patch set how wet it is. / A smaller range shows more digits. | WET is one of the four tabs along the front of the skin patch, after DRY and DAMP. Tap it. / Leave the probes on the 0 and 2 marks, so only the water changes. |
| wet-skin nudge | Keep the probes 2 cm apart. | Put the probes back 2 cm apart, on the 0 and 2 marks, so only the water changes. |
| fix-dry hints | OL: the skin is over 200 kΩ. / Step the range up one at a time. | The meter is on its 200 kΩ range, and dry skin is far more than 200 kΩ. / Under Range on the meter panel, pick a bigger range, such as 2 MΩ. |
| double-spacing hints | Hold each reading still until the notebook logs it. / Move one probe to the 4 cm mark. | Drag the tip of the black probe from the 2 mark across to the 4 mark. / Hold the probe still until the notebook writes the number down. |

## How to verify

Work in your own worktree and run `git merge main` before each commit (another agent may have touched a lab you share).

1. Lessons against labs and the word budgets:
   `pnpm --filter @ohmland/web exec vitest run src/lesson/bench/lessons.test.ts`
2. First uses, held strict for your lessons (comma-separated ids), with the course's report printed:
   `OHMLAND_FIRST_USE=<lesson-id> pnpm --filter @ohmland/web exec vitest run src/lesson/bench/lessons.test.ts -t "first use" --silent=false`
   A term is reported only at its first use in the course. If the report names your lesson, introduce the term in
   that line (a short naming phrase, a note, or a `meet`). Rerun after edits: removing a word moves its first use to a
   later lesson. A real jargon word the glossary lacks goes into `content/glossary.yaml`, in its group.
3. `pnpm lint:copy` (no em dashes anywhere).
4. Play the lesson on desktop and on a phone, in 3D and in Ink, and read every beat as a beginner. `pnpm dev`, open
   `/learn/<unit>/<lesson>`; `window.ohmlandLab.step(...)` plays the lab's solution steps to move fast. Ask for each
   hint once to see it under the line. Do not use the user's Chrome; use headless Playwright.
5. If an e2e spec quotes your lesson's words (`grep -rn "<old words>" apps/web/e2e`), update only those quotes, then run
   `OHMLAND_E2E_PORT=<free port> pnpm --filter @ohmland/web exec playwright test`.
6. Commit with a plain imperative message, no AI attribution, no em dashes.

## Known gaps (do not fix in the rewrite)

- A phone frames one task's working parts. A line that names two far-apart places may show only one; check, then add a
  `spot` or reword toward the framed one.
- Nudges and wrong lines replace the robot's line instead of adding under it, unlike hints.
- The blueprints in `docs/curriculum/` quote the old 12-word budget and old lines. This brief and `docs/LESSONS.md`
  win.
