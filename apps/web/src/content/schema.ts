/**
 * The course format (docs/ARCHITECTURE.md, "Content format"), as zod schemas. The loader (load.ts) validates every
 * YAML file under the repo's content/ folder against these at build time and fails the build on the first bad file.
 *
 * Fields documented as markdown accept a small markdown subset (paragraphs, lists, bold, italic, code, links); see
 * markdown.ts. Everything else is plain text.
 */
import { z } from "zod";
import { FIGURE_IDS, FIGURE_REGIONS, type FigureId } from "../quiz/figures/regions";
import { canWriteWithBands } from "../quiz/colorCode";
import { isValidUnit } from "../quiz/si";
import { WIDGET_KINDS } from "../lesson/widgets/kinds";
import { PART_ICONS } from "../parts/kinds";

/** Stable ids: kebab-case, lowercase letters and digits. Progress keys on them, so never rename one. */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case (lowercase letters, digits and single dashes)");

const text = z.string().trim().min(1, "must not be empty");
/** A markdown field (block: paragraphs and lists). */
const markdown = text;
/** A short markdown field (inline only: bold, italic, code, links). */
const inline = text;

// Course, unit, module ---------------------------------------------------------------------------------------------

export const upcomingUnitSchema = z.strictObject({
  id: idSchema,
  title: text,
  summary: text,
});

export const courseSchema = z.strictObject({
  title: text,
  /** Units with content, in order. Each has a folder content/units/<id>/ with a unit.yaml. */
  units: z.array(idSchema).min(1),
  /** Units that are planned but not written yet: shown as "coming soon" on the course map. */
  upcoming: z.array(upcomingUnitSchema).default([]),
});

export const unitSchema = z.strictObject({
  id: idSchema,
  title: text,
  summary: text,
  /** The unit's island in the archipelago. */
  isle: z.strictObject({
    theme: idSchema,
    seed: z.number().int().nonnegative().optional(),
  }),
  /** Module folders inside this unit's folder, in order. */
  modules: z.array(idSchema).min(1),
});

export const moduleSchema = z.strictObject({
  id: idSchema,
  title: text,
  summary: text,
  /** The landmark this module builds on the unit's island when its last lesson is done. */
  landmark: z.strictObject({ id: idSchema, name: text }),
  /** Lesson folders inside this module's folder, in order. */
  lessons: z.array(idSchema).min(1),
});

// Quiz items -------------------------------------------------------------------------------------------------------

const itemBase = {
  /** Unique within the lesson; answers and first-try credit key on it. */
  id: idSchema,
  /** The question (inline markdown). */
  prompt: inline,
  /** Shown after answering, right or wrong (markdown). */
  explain: markdown,
  /** Optional nudge offered after a wrong try (inline markdown). */
  hint: inline.optional(),
};

export const choiceItemSchema = z
  .strictObject({
    ...itemBase,
    type: z.literal("choice"),
    /** Show checkboxes even when only one option is right, so the count is not a giveaway. */
    multi: z.boolean().optional(),
    shuffle: z.boolean().default(true),
    options: z
      .array(
        z.strictObject({
          text: inline,
          correct: z.boolean().default(false),
          /** Why this option is right or wrong (inline markdown). Every option has one. */
          why: inline,
        }),
      )
      .min(2)
      .max(6),
  })
  .superRefine((item, ctx) => {
    if (!item.options.some((o) => o.correct)) ctx.addIssue({ code: "custom", message: "at least one option must be correct", path: ["options"] });
  });

export const numericItemSchema = z
  .strictObject({
    ...itemBase,
    type: z.literal("numeric"),
    /** The answer in `unit`. */
    answer: z.number(),
    /** The unit the answer box is in, with an optional prefix: Ω, kΩ, V, mV, A, mA, µA, W, mW, F, µF, nF, Hz, s, ms. */
    unit: text,
    /** Accepted error, in percent of the answer. */
    tolerance: z.number().min(0).max(50).default(2),
  })
  .superRefine((item, ctx) => {
    if (!isValidUnit(item.unit)) ctx.addIssue({ code: "custom", message: `unknown unit "${item.unit}"`, path: ["unit"] });
  });

export const orderItemSchema = z.strictObject({
  ...itemBase,
  type: z.literal("order"),
  /** The steps in the right order (inline markdown). The player shuffles them. */
  items: z.array(inline).min(2).max(7),
});

export const matchItemSchema = z
  .strictObject({
    ...itemBase,
    type: z.literal("match"),
    pairs: z.array(z.strictObject({ left: inline, right: inline })).min(2).max(6),
  })
  .superRefine((item, ctx) => {
    const rights = item.pairs.map((p) => p.right);
    if (new Set(rights).size !== rights.length) ctx.addIssue({ code: "custom", message: "every right-hand side must be different", path: ["pairs"] });
  });

export const colorCodeItemSchema = z
  .strictObject({
    ...itemBase,
    type: z.literal("color-code"),
    /** read: show the bands, ask for the value. build: give the value, pick the bands. */
    mode: z.enum(["read", "build"]),
    ohms: z.number().positive(),
    bands: z.union([z.literal(4), z.literal(5)]).default(4),
  })
  .superRefine((item, ctx) => {
    if (!canWriteWithBands(item.ohms, item.bands))
      ctx.addIssue({ code: "custom", message: `${item.ohms} Ω cannot be written with ${item.bands} bands`, path: ["ohms"] });
  });

export const hotspotItemSchema = z
  .strictObject({
    ...itemBase,
    type: z.literal("hotspot"),
    /** A figure from the app's figure registry (src/quiz/figures). */
    figure: z.enum(FIGURE_IDS as [FigureId, ...FigureId[]]),
    /** The region (or regions) that count as right. */
    answer: z.union([idSchema, z.array(idSchema).min(1)]),
  })
  .superRefine((item, ctx) => {
    const regions = FIGURE_REGIONS[item.figure] as readonly string[];
    for (const a of Array.isArray(item.answer) ? item.answer : [item.answer])
      if (!regions.includes(a)) ctx.addIssue({ code: "custom", message: `figure "${item.figure}" has no region "${a}" (it has ${regions.join(", ")})`, path: ["answer"] });
  });

export const quizItemSchema = z.discriminatedUnion("type", [
  choiceItemSchema,
  numericItemSchema,
  orderItemSchema,
  matchItemSchema,
  colorCodeItemSchema,
  hotspotItemSchema,
]);

// Steps ------------------------------------------------------------------------------------------------------------

export const visualSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("part"), part: idSchema }),
  z.strictObject({ kind: z.literal("image"), src: text, alt: text }),
  z.strictObject({ kind: z.literal("none") }),
]);

export const hookStepSchema = z.strictObject({
  type: z.literal("hook"),
  /** Optional heading; defaults to the lesson title. */
  title: text.optional(),
  body: markdown,
  visual: visualSchema.optional(),
  /** An ungraded prediction: the learner picks one, then finds out in the lab. */
  predict: z.strictObject({ prompt: inline, options: z.array(inline).min(2).max(4) }).optional(),
  /** A short line from the mascot (under 20 words). */
  mascot: text.optional(),
});

export const labStepSchema = z.strictObject({
  type: z.literal("lab"),
  /** content/labs/<lab>.ts */
  lab: idSchema,
  /** Optional lead-in shown above the bench (markdown). */
  intro: markdown.optional(),
});

export const explainCardSchema = z.strictObject({
  title: text,
  /** About 40 to 90 words (markdown). */
  body: markdown,
  widget: z.strictObject({ kind: z.enum(WIDGET_KINDS), props: z.record(z.string(), z.unknown()).default({}) }).optional(),
  mascot: text.optional(),
});

export const explainStepSchema = z.strictObject({
  type: z.literal("explain"),
  cards: z.array(explainCardSchema).min(1).max(6),
});

export const quizStepSchema = z.strictObject({
  type: z.literal("quiz"),
  items: z.array(quizItemSchema).min(1).max(8),
});

export const wrapStepSchema = z.strictObject({
  type: z.literal("wrap"),
  /** One-line rule cards (inline markdown), collected into the learner's rulebook. */
  rules: z.array(inline).min(1).max(5),
  /** An optional "Try it for real" card for learners with hardware. */
  realWorld: z
    .strictObject({
      body: markdown.optional(),
      parts: z.array(inline).min(1),
      safety: z.array(inline).min(1),
    })
    .optional(),
});

export const stepSchema = z.discriminatedUnion("type", [hookStepSchema, labStepSchema, explainStepSchema, quizStepSchema, wrapStepSchema]);

// Lesson -----------------------------------------------------------------------------------------------------------

export const lessonSchema = z
  .strictObject({
    /** The classic stepper (hook, lab, explain, quiz, wrap). Optional: a lesson without `format` is this one. */
    format: z.literal("steps").optional(),
    id: idSchema,
    /** Bump when steps change incompatibly; saved in-progress answers of an older version are dropped. */
    version: z.number().int().min(1),
    title: text,
    /** One sentence for the course map. */
    summary: text,
    minutes: z.number().int().min(1).max(30),
    unlocks: z
      .strictObject({
        /** Parts bin ids (content/parts.yaml) that unlock on completion. */
        parts: z.array(idSchema).default([]),
        /** The island piece this lesson places. */
        isle: idSchema.optional(),
      })
      .default({ parts: [] }),
    steps: z.array(stepSchema).min(2),
  })
  .superRefine((lesson, ctx) => {
    const steps = lesson.steps;
    if (steps[0]?.type !== "hook") ctx.addIssue({ code: "custom", message: "the first step must be a hook (discover first)", path: ["steps", 0, "type"] });
    if (steps[steps.length - 1]?.type !== "wrap")
      ctx.addIssue({ code: "custom", message: "the last step must be a wrap", path: ["steps", steps.length - 1, "type"] });
    if (steps.filter((s) => s.type === "wrap").length > 1) ctx.addIssue({ code: "custom", message: "a lesson has one wrap step", path: ["steps"] });
    const seen = new Set<string>();
    steps.forEach((s, si) => {
      if (s.type !== "quiz") return;
      s.items.forEach((item, ii) => {
        if (seen.has(item.id)) ctx.addIssue({ code: "custom", message: `duplicate quiz item id "${item.id}"`, path: ["steps", si, "items", ii, "id"] });
        seen.add(item.id);
      });
    });
  });

// Bench lessons (format 2) ----------------------------------------------------------------------------------------
//
// A bench-first lesson: the learner sits at the bench the whole time and the robot guides them, one beat at a time.
// Each beat is one short robot line plus one thing to do (a lab task, a tap on the bench, a pick, a number), and
// optionally a discovery: an ink note drawn onto a part and a rule stamped into the margin. docs/LESSONS.md.

/** Word limits per kind of line (docs/LESSONS.md, "Budgets"): a robot line, a note on a part, a rule, a chip. */
export const WORDS = { say: 12, note: 6, rule: 8, chip: 4, onDemand: 12 } as const;
/** The most words a lesson's main path may show (every line on the way through, not hints or the UI chrome). */
export const LESSON_MAX_WORDS = 150;
/** The most words of on-demand text (hints and lines for wrong taps or picks) in the lesson file. */
export const ON_DEMAND_MAX_WORDS = 60;

export const countWords = (s: string): number => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** One short line of plain text (no markdown), at most `max` words. */
const words = (max: number) => text.refine((s) => countWords(s) <= max, `at most ${max} words`);
/** A robot line (or a done line, a start button). */
const line = words(WORDS.say);
const noteLine = words(WORDS.note);
const ruleLine = words(WORDS.rule);
const chip = words(WORDS.chip);
const onDemand = words(WORDS.onDemand);

/**
 * Something on the bench, in the lab's shorthand: a part ("D1"), a part's lead ("D1.anode"), a hole ("e12",
 * "rail+:3"), a clip lead end ("TL1.a"), or a raw bench anchor ("pin:D1.anode", "part:D1").
 */
const anchor = z.string().trim().regex(/^[A-Za-z0-9_+:.-]+$/, "must name a part, a lead or a hole (D1, D1.anode, e12, rail+:3)");

/** The lab part ids and task ids in a lab file. */
const labId = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "must be a lab part or task id");

/** A discovery drawn onto the bench: an arrow from a short line of ink to `at`. `at: tap` means where the learner tapped. */
const noteSchema = z.strictObject({ at: z.union([anchor, z.literal("tap")]), text: noteLine });

export const POPUP_WIDGETS = ["resistor-slider"] as const;
export type PopupWidget = (typeof POPUP_WIDGETS)[number];

/** A tap check on the bench. Exactly one of `answer`, `joinedTo` or `anyHole`. */
const tapSchema = z
  .strictObject({
    /** What counts as right: one anchor or several. */
    answer: z.union([anchor, z.array(anchor).min(1)]).optional(),
    /** What can be tapped (default: the answers and every part on the bench). */
    among: z.array(anchor).min(2).optional(),
    /** Breadboards: any hole joined to this one counts (it is marked on the board). */
    joinedTo: anchor.optional(),
    /** Any hole on the board counts; ungraded. The note's text may say {hole}. */
    anyHole: z.literal(true).optional(),
  })
  .superRefine((t, ctx) => {
    const n = [t.answer, t.joinedTo, t.anyHole].filter((x) => x !== undefined).length;
    if (n !== 1) ctx.addIssue({ code: "custom", message: "a tap needs exactly one of answer, joinedTo or anyHole" });
    if (t.among && t.answer === undefined) ctx.addIssue({ code: "custom", message: "among only goes with answer", path: ["among"] });
  });

const pickSchema = z
  .strictObject({
    options: z.array(chip).min(2).max(4),
    /** The right option (its text). Without one, the pick is an ungraded question. */
    answer: chip.optional(),
    /** Point at a part while asking ("What is this?"). */
    on: anchor.optional(),
  })
  .superRefine((p, ctx) => {
    if (p.answer !== undefined && !p.options.includes(p.answer)) ctx.addIssue({ code: "custom", message: "answer must be one of the options", path: ["answer"] });
    if (new Set(p.options).size !== p.options.length) ctx.addIssue({ code: "custom", message: "options must differ", path: ["options"] });
  });

const numberSchema = z
  .strictObject({
    answer: z.number(),
    /** The box's unit (V, mA, kΩ ...); leave out for a plain count. */
    unit: text.optional(),
    /** Accepted error in percent of the answer. */
    tolerance: z.number().min(0).max(50).default(5),
  })
  .superRefine((n, ctx) => {
    if (n.unit && !isValidUnit(n.unit)) ctx.addIssue({ code: "custom", message: `unknown unit "${n.unit}"`, path: ["unit"] });
  });

const popupSchema = z.strictObject({
  widget: z.enum(POPUP_WIDGETS),
  /** The part the card is taped to. */
  at: anchor,
  props: z.record(z.string(), z.unknown()).default({}),
});

/** A prediction right before an action: the learner guesses, then does it and sees. Never graded. */
const guessSchema = z
  .strictObject({ options: z.array(chip).min(2).max(3), answer: chip.optional() })
  .superRefine((g, ctx) => {
    if (g.answer !== undefined && !g.options.includes(g.answer)) ctx.addIssue({ code: "custom", message: "answer must be one of the options", path: ["answer"] });
  });

export const beatSchema = z
  .strictObject({
    /** The robot's line for this beat. */
    say: line,
    /** Parts in play: spotlit and framed (part ids or attach points). */
    spot: z.array(anchor).min(1).optional(),
    /** Show the metal strips inside the breadboard during this beat. */
    xray: z.boolean().optional(),
    /**
     * The one instrument or panel this beat needs: meter, scope, logger, stopwatch, tapper, controls, or a lab panel
     * id. Without it, a lab panel tied to the beat's task (its `show`) appears; otherwise none.
     */
    tool: z.string().trim().regex(/^[a-z0-9-]+$/, "must be meter, scope, logger, stopwatch, tapper, controls or a panel id").optional(),

    // One thing to do (at most one of these; none means a plain Next).
    /** The three-period lesson's first period: name a part ("This is an LED."). Tap it to go on. */
    meet: labId.optional(),
    /** A lab task id: the beat ends when its goal is met on the bench. */
    do: labId.optional(),
    tap: tapSchema.optional(),
    pick: pickSchema.optional(),
    number: numberSchema.optional(),
    /** The lesson's one hands-on pop-up card, taped to a part. */
    popup: popupSchema.optional(),

    /** A guess before a `do` action. */
    guess: guessSchema.optional(),
    /** A nudge after a wrong tap, pick or number (a `do` beat uses its lab task's hints). On demand. */
    hint: onDemand.optional(),
    /** Lines for particular wrong taps or picks, by anchor or option text. On demand. */
    wrong: z.record(z.string(), onDemand).optional(),

    // The discovery, shown when the beat is done.
    /** The robot's reaction. */
    done: line.optional(),
    note: noteSchema.optional(),
    /** A rule stamped into the margin and the notebook. */
    rule: ruleLine.optional(),
    /**
     * Starts an objective: a short name that groups this beat and the ones after it (until the next objective). The
     * robot's eyes fill in equal steps as objectives finish. Never shown as a list.
     */
    objective: words(5).optional(),
  })
  .superRefine((b, ctx) => {
    const actions = (["meet", "do", "tap", "pick", "number", "popup"] as const).filter((k) => b[k] !== undefined);
    if (actions.length > 1) ctx.addIssue({ code: "custom", message: `a beat does one thing (found ${actions.join(", ")})` });
    if (b.guess && !b.do) ctx.addIssue({ code: "custom", message: "a guess goes before a do action", path: ["guess"] });
    if (b.note?.at === "tap" && !b.tap) ctx.addIssue({ code: "custom", message: "at: tap needs a tap beat", path: ["note", "at"] });
    if (b.wrong && !b.tap && !b.pick) ctx.addIssue({ code: "custom", message: "wrong lines go with a tap or a pick", path: ["wrong"] });
  });

/** Every line on a bench lesson's main path, for the word budget (hints and wrong lines are on demand). */
export function benchLessonLines(l: Pick<z.infer<typeof benchLessonObject>, "start" | "beats" | "fixit" | "secret" | "end">): string[] {
  const out: string[] = [l.start.say];
  if (l.start.title) out.push(l.start.title);
  if (l.start.go) out.push(l.start.go);
  for (const b of l.beats) {
    out.push(b.say);
    if (b.done) out.push(b.done);
    if (b.note) out.push(b.note.text);
    if (b.rule) out.push(b.rule);
    if (b.guess) out.push(...b.guess.options);
    if (b.pick) out.push(...b.pick.options);
  }
  if (l.fixit) out.push(l.fixit.say, ...l.fixit.tasks.flatMap((t) => (t.say ? [t.say] : [])));
  if (l.secret) {
    out.push(l.secret.say);
    if (l.secret.done) out.push(l.secret.done);
    if (l.secret.note) out.push(l.secret.note.text);
    if (l.secret.rule) out.push(l.secret.rule);
  }
  out.push(l.end.say);
  return out;
}

/** The lesson file's on-demand lines: hints and lines for wrong taps or picks. */
export function benchLessonOnDemand(l: Pick<z.infer<typeof benchLessonObject>, "beats">): string[] {
  return l.beats.flatMap((b) => [...(b.hint ? [b.hint] : []), ...Object.values(b.wrong ?? {})]);
}

const benchLessonObject = z.strictObject({
  format: z.literal("bench"),
  id: idSchema,
  version: z.number().int().min(1),
  title: text,
  summary: text,
  minutes: z.number().int().min(1).max(30),
  unlocks: z
    .strictObject({ parts: z.array(idSchema).default([]), isle: idSchema.optional() })
    .default({ parts: [] }),
  /** content/labs/<lab>.ts: the bench, its tasks and their solution. */
  lab: idSchema,
  /** The first screen: the mission's title, the robot's opening line and the button that opens the bench. */
  start: z.strictObject({ title: words(5).optional(), say: line, go: chip.optional() }),
  beats: z.array(beatSchema).min(1).max(16),
  /** The closing check: broken benches to fix. Relaxed by default; the learner may race a clock. */
  fixit: z
    .strictObject({
      say: line,
      /** Lab tasks, each with a `setup` that breaks the bench. */
      tasks: z.array(z.strictObject({ task: labId, say: line.optional() })).min(1).max(3),
      /** Seconds on the optional clock. */
      timer: z.number().int().min(20).max(300).default(60),
    })
    .optional(),
  /** The secret bonus: a bonus lab task, offered at the end if the learner has not found it by then. */
  secret: z
    .strictObject({ task: labId, say: line, done: line.optional(), note: noteSchema.optional(), rule: ruleLine.optional() })
    .optional(),
  /** The robot's last line, on the signed-off notebook page. */
  end: z.strictObject({ say: line }),
});

export const benchLessonSchema = benchLessonObject.superRefine((l, ctx) => {
  const main = benchLessonLines(l).reduce((n, s) => n + countWords(s), 0);
  if (main > LESSON_MAX_WORDS) ctx.addIssue({ code: "custom", message: `${main} words on the main path; a bench lesson stays under ${LESSON_MAX_WORDS}`, path: ["beats"] });
  const extra = benchLessonOnDemand(l).reduce((n, s) => n + countWords(s), 0);
  if (extra > ON_DEMAND_MAX_WORDS) ctx.addIssue({ code: "custom", message: `${extra} words of hints and wrong lines; keep them under ${ON_DEMAND_MAX_WORDS}`, path: ["beats"] });
  const rules = l.beats.filter((b) => b.rule).length + (l.secret?.rule ? 1 : 0);
  if (rules > 3) ctx.addIssue({ code: "custom", message: `${rules} rules; stamp 1 or 2, 3 at most`, path: ["beats"] });
  const popups = l.beats.filter((b) => b.popup).length;
  if (popups > 1) ctx.addIssue({ code: "custom", message: "a lesson has at most one pop-up card", path: ["beats"] });
  const tasks = [...l.beats.flatMap((b) => (b.do ? [b.do] : [])), ...(l.fixit?.tasks.map((t) => t.task) ?? []), ...(l.secret ? [l.secret.task] : [])];
  const seen = new Set<string>();
  for (const t of tasks) {
    if (seen.has(t)) ctx.addIssue({ code: "custom", message: `task "${t}" is used twice`, path: ["beats"] });
    seen.add(t);
  }
});

// Parts catalog ----------------------------------------------------------------------------------------------------

export const partSchema = z.strictObject({
  id: idSchema,
  name: text,
  /** Which 2D drawing to use (src/parts/PartIcon.tsx). */
  icon: z.enum(PART_ICONS),
  /** One line under the name. */
  blurb: text,
  /** Key facts for the details drawer (inline markdown), two to five. */
  facts: z.array(inline).min(1).max(6),
});

export const partsSchema = z.strictObject({ parts: z.array(partSchema).min(1) });

export type CourseFile = z.infer<typeof courseSchema>;
export type UnitFile = z.infer<typeof unitSchema>;
export type ModuleFile = z.infer<typeof moduleSchema>;
export type LessonFile = z.infer<typeof lessonSchema>;
export type BenchLessonFile = z.infer<typeof benchLessonObject>;
export type Beat = z.infer<typeof beatSchema>;
export type BeatNote = z.infer<typeof noteSchema>;
export type TapCheck = z.infer<typeof tapSchema>;
export type PickCheck = z.infer<typeof pickSchema>;
export type NumberCheck = z.infer<typeof numberSchema>;
export type Popup = z.infer<typeof popupSchema>;
export type PartFile = z.infer<typeof partSchema>;
export type Step = z.infer<typeof stepSchema>;
export type HookStep = z.infer<typeof hookStepSchema>;
export type LabStep = z.infer<typeof labStepSchema>;
export type ExplainStep = z.infer<typeof explainStepSchema>;
export type ExplainCard = z.infer<typeof explainCardSchema>;
export type QuizStep = z.infer<typeof quizStepSchema>;
export type WrapStep = z.infer<typeof wrapStepSchema>;
export type QuizItem = z.infer<typeof quizItemSchema>;
export type ChoiceItem = z.infer<typeof choiceItemSchema>;
export type NumericItem = z.infer<typeof numericItemSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type MatchItem = z.infer<typeof matchItemSchema>;
export type ColorCodeItem = z.infer<typeof colorCodeItemSchema>;
export type HotspotItem = z.infer<typeof hotspotItemSchema>;
export type Visual = z.infer<typeof visualSchema>;
