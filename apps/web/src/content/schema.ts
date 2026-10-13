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
