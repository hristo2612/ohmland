# Writing and content rules

These rules apply to lessons, labs, quiz items, UI text and docs.

## Originality and copyright

Ohmland teaches the same fundamentals as classic beginner electronics books. Facts, physics, formulas, standard
component values and the general idea of an experiment (for example "measure the current through an LED as you change
the resistor") are free for anyone to teach. Expression is not.

- Never copy or closely paraphrase any book's sentences, headings, jokes, anecdotes, figures, schematics, tables or
  code. Write from your own understanding.
- Do not reuse distinctive titles or project names from any book. Name things in our own voice.
- Draw our own diagrams and build our own 3D models. Do not trace published figures.
- Do not use third-party trademarks in names ("Make:", "Arduino", "SparkFun"...). Describe generic parts instead:
  "a microcontroller board", "an Uno-style board".
- Book-derived research notes live in the git-ignored `.private/` folder and must never be committed or quoted.
- Recommending books as companion reading on the About page is fine.

## Accuracy

- Every number must be right. Prefer standard datasheet values (2N3904, 1N4001, 555, 74HC series) and standard
  physics. When a common teaching source has an error, use the correct value.
- Show units every time, with a space: `470 Ω`, `9 V`, `20 mA`, `4.7 kΩ`, `100 µF`. Use the proper symbols Ω and µ.
- Use conventional current (plus to minus) unless a lesson is explicitly about electron flow.
- Safety notes must be correct and calm. Low-voltage battery circuits are safe; mains electricity, lithium cells and
  large capacitors are not, and lessons say so plainly.

## Voice

- Friendly, curious, plain. Short sentences, one idea each. Talk to the learner as "you".
- Write for a 12-year-old who has never touched electronics. Every instruction is a whole sentence: the verb, the thing
  and where it is ("Drag the red clip onto the battery's plus (+) snap"), never a state that reads like an order
  ("Probes on the skin.").
- Bench lessons mix two voices (docs/LESSONS.md, "Writing beats"). Why first opens each new idea: a short sentence of
  purpose, then the step ("Let's measure dry skin. ..."), on a lesson's first beat, an objective's first beat, a new
  part, the secret and the fix-it. Every other beat is one clear sentence. A result may carry a short "because".
- Name a new word the moment it appears, with a short phrase right after it ("the probes, the meter's two pointed
  tips", "Ω, ohms"). `content/glossary.yaml` lists the words a test checks. Use the screen's own labels as the screen
  spells them (WET, Beep, Ω, Range).
- No "it", "that" or "this" pointing back at something from an earlier step: name it again.
- Celebrate experimenting and breaking things in the simulator: it is free and safe here.
- No em dashes anywhere (use a colon, comma, parentheses or a new sentence). `pnpm lint:copy` enforces it.
- No emoji in UI or content. Exclamation marks only in celebrations, and sparingly.
- Buttons are verbs: "Check answer", "Continue", "Try again".
- Each explanation card fits on a phone screen: about 40 to 90 words.
- Quiz feedback explains why, in one or two sentences, for right and wrong answers alike.

## The mascot

A small robot with a visor and two amber eyes, drawn in ink in the app (a voxel model on the island). Its lines are
written in red pencil in the margin. It gives hints, reacts to burned-out parts with sympathy rather than blame,
and never lectures. Its lines are short and complete: 22 words at most, usually 12 to 20.

## UI text

All UI strings live in `apps/web/src/i18n/en.ts`. Content text lives in `content/`. Components never contain
hard-coded English, so the app can be translated later.
