/**
 * Try-out copies of lessons written another way (content/variants/<set>/): the same lab, bench, tasks and solution as
 * the real lesson, other words. Loaded only by the hidden /variants pages, never by the course: no map, no progress,
 * no XP (the player runs them as a `trial`). Their word budgets are looser than the course's, so a voice can be tried
 * before the course's budgets change; their `labLines` stand in for the lab's own task words.
 *
 *   content/variants/<set>/variants.yaml           the set: its lessons, and each variant's name and style
 *   content/variants/<set>/<variant>/<lesson>/lesson.yaml   a bench lesson (format: bench), plus `labLines`
 *
 * Server only (build time), like load.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ContentError, findContentDir, getCourse, type BenchLessonData } from "./load";
import { benchSchemas, countWords, idSchema, labId, type WordBudget } from "./schema";

/** Instructions of about 20 words (and a second line under them), notes of 8: room for a whole sentence. */
export const VARIANT_BUDGET: WordBudget = { say: 24, note: 8, rule: 8, chip: 4, onDemand: 24, lesson: 400, onDemandAll: 300 };

const line = z
  .string()
  .trim()
  .min(1)
  .refine((s) => countWords(s) <= VARIANT_BUDGET.say, `at most ${VARIANT_BUDGET.say} words`);

/** A lesson's own words for its lab's tasks, by task id: hints (gentlest first), nudges (in the lab's order), success. */
const labLinesSchema = z.record(labId, z.strictObject({ hints: z.array(line).min(1).max(4).optional(), nudges: z.array(line).min(1).optional(), success: line.optional() }));
export type LabLines = z.infer<typeof labLinesSchema>;

const setSchema = z.strictObject({
  title: z.string().trim().min(1),
  /** A line or two under the title: what to compare. */
  intro: z.string().trim().min(1),
  /** The real lessons every variant rewrites, in the order the page lists them. */
  lessons: z.array(idSchema).min(1),
  variants: z
    .array(
      z.strictObject({
        id: idSchema,
        name: z.string().trim().min(1),
        /** One line on how this variant talks. */
        style: z.string().trim().min(1),
        /** The bench draws the first move of each beat's task (the coach mark). */
        coach: z.boolean().default(false),
      }),
    )
    .min(1),
});

export type VariantLesson = BenchLessonData & { labLines?: LabLines };
export type Variant = { id: string; name: string; style: string; coach: boolean; lessons: VariantLesson[] };
export type VariantSet = { title: string; intro: string; variants: Variant[] };

/** The tasks a bench lesson walks (its beats', its fix-it's, its secret's): a variant must walk the same ones. */
const tasksOf = (l: BenchLessonData) => [...l.beats.map((b) => b.do ?? ""), ...(l.fixit?.tasks.map((t) => t.task) ?? []), l.secret?.task ?? ""].join(" ");

export function loadVariants(set: string, root = findContentDir()): VariantSet {
  const problems: string[] = [];
  const dir = join(root, "variants", set);
  const label = (f: string) => relative(join(root, ".."), f);
  const read = (file: string): unknown => {
    if (!existsSync(file)) {
      problems.push(`${label(file)}: file is missing`);
      return undefined;
    }
    try {
      return parseYaml(readFileSync(file, "utf8"));
    } catch (e) {
      problems.push(`${label(file)}: YAML error: ${(e as Error).message.split("\n")[0]}`);
      return undefined;
    }
  };
  const issues = (file: string, error: z.ZodError) => problems.push(`${label(file)}\n${error.issues.map((i) => `    ${i.path.join(".")}: ${i.message}`).join("\n")}`);

  const setFile = join(dir, "variants.yaml");
  const parsed = setSchema.safeParse(read(setFile));
  if (!parsed.success) {
    issues(setFile, parsed.error);
    throw new ContentError(problems);
  }
  const course = getCourse();
  const lessonSchema = benchSchemas(VARIANT_BUDGET).lesson;
  const variants = parsed.data.variants.map((v): Variant => {
    const lessons = parsed.data.lessons.flatMap((id): VariantLesson[] => {
      const file = join(dir, v.id, id, "lesson.yaml");
      const raw = read(file);
      if (raw === undefined) return [];
      const { labLines, ...rest } = raw as { labLines?: unknown };
      const lesson = lessonSchema.safeParse(rest);
      const lines = labLinesSchema.optional().safeParse(labLines);
      if (!lesson.success) issues(file, lesson.error);
      if (!lines.success) issues(file, lines.error);
      if (!lesson.success || !lines.success) return [];
      const real = course.lessons.find((l): l is BenchLessonData => l.id === id && l.format === "bench");
      const wrong = !real
        ? `no bench lesson "${id}" in the course`
        : lesson.data.id !== id
          ? `id "${lesson.data.id}" must be "${id}"`
          : lesson.data.lab !== real.lab || tasksOf(lesson.data as BenchLessonData) !== tasksOf(real)
            ? `must keep "${id}"'s lab and walk its tasks (${tasksOf(real)})`
            : null;
      if (wrong || !real) {
        problems.push(`${label(file)}: ${wrong}`);
        return [];
      }
      const href = `/variants/${set}/${v.id}/${id}`;
      const data: VariantLesson = { ...lesson.data, title: `${lesson.data.title} · ${v.name}`, unit: real.unit, module: real.module, href, index: real.index, ...(lines.data ? { labLines: lines.data } : {}) };
      return [JSON.parse(JSON.stringify(data)) as VariantLesson];
    });
    return { ...v, lessons };
  });
  if (problems.length) throw new ContentError(problems);
  return { title: parsed.data.title, intro: parsed.data.intro, variants };
}
