/**
 * Build-time course loader. Reads the repo's content/ folder with fs, parses YAML, validates every file against the
 * zod schemas, checks cross-references (folders, labs, parts, island pieces), renders markdown fields to HTML and returns one typed
 * Course. Any problem fails the build with every issue listed, file by file. Server only: never import from islands.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { ISLE_PIECES, isIslePiece } from "./isle-pieces";
import { blockMd, inlineMd } from "./markdown";
import type { CourseOutline } from "./outline";
import {
  courseSchema,
  lessonSchema,
  moduleSchema,
  partsSchema,
  unitSchema,
  type LessonFile,
  type PartFile,
  type QuizItem,
  type Step,
} from "./schema";

/** A lesson as the player receives it. Markdown fields (see schema.ts) now hold sanitised HTML. */
export type LessonData = LessonFile & { unit: string; module: string; href: string; index: number };
export type ModuleData = {
  id: string;
  unit: string;
  title: string;
  summary: string;
  landmark: { id: string; name: string };
  lessons: LessonData[];
};
export type UnitData = {
  id: string;
  number: number;
  title: string;
  summary: string;
  isle: { theme: string; seed?: number | undefined };
  modules: ModuleData[];
};
export type UpcomingUnit = { id: string; number: number; title: string; summary: string };
export type Course = {
  title: string;
  units: UnitData[];
  upcoming: UpcomingUnit[];
  lessons: LessonData[];
  parts: PartFile[];
  outline: CourseOutline;
};

export class ContentError extends Error {
  constructor(problems: string[]) {
    super(`Ohmland content is invalid (${problems.length} ${problems.length === 1 ? "problem" : "problems"}):\n\n${problems.join("\n\n")}\n`);
    this.name = "ContentError";
  }
}

/** Finds the repo's content/ folder: OHMLAND_CONTENT_DIR, or the nearest content/course.yaml above the cwd. */
export function findContentDir(start = process.cwd()): string {
  const env = process.env.OHMLAND_CONTENT_DIR;
  if (env) return resolve(env);
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "content", "course.yaml"))) return join(dir, "content");
    const up = dirname(dir);
    if (up === dir) throw new ContentError([`Could not find content/course.yaml above ${start}`]);
    dir = up;
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)), "") || "(root)";
}

type Ctx = { root: string; problems: string[] };

function fileLabel(ctx: Ctx, file: string) {
  return relative(dirname(ctx.root), file);
}

function report(ctx: Ctx, file: string, lines: string[]) {
  ctx.problems.push(`  ${fileLabel(ctx, file)}\n${lines.map((l) => `    ${l}`).join("\n")}`);
}

function readYaml(ctx: Ctx, file: string): unknown {
  if (!existsSync(file)) {
    report(ctx, file, ["file is missing"]);
    return undefined;
  }
  try {
    return parseYaml(readFileSync(file, "utf8"));
  } catch (e) {
    report(ctx, file, [`YAML error: ${(e as Error).message.split("\n")[0]}`]);
    return undefined;
  }
}

function validate<S extends z.ZodType>(ctx: Ctx, file: string, schema: S, raw: unknown): z.infer<S> | undefined {
  if (raw === undefined) return undefined;
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  report(
    ctx,
    file,
    result.error.issues.map((i) => `${formatPath(i.path)}: ${i.message}`),
  );
  return undefined;
}

function renderItem(item: QuizItem): QuizItem {
  const base = { ...item, prompt: inlineMd(item.prompt), explain: blockMd(item.explain), hint: item.hint ? inlineMd(item.hint) : undefined };
  switch (base.type) {
    case "choice":
      return { ...base, options: base.options.map((o) => ({ ...o, text: inlineMd(o.text), why: inlineMd(o.why) })) };
    case "order":
      return { ...base, items: base.items.map(inlineMd) };
    case "match":
      return { ...base, pairs: base.pairs.map((p) => ({ left: inlineMd(p.left), right: inlineMd(p.right) })) };
    default:
      return base;
  }
}

function renderStep(step: Step): Step {
  switch (step.type) {
    case "hook":
      return {
        ...step,
        body: blockMd(step.body),
        predict: step.predict ? { prompt: inlineMd(step.predict.prompt), options: step.predict.options.map(inlineMd) } : undefined,
      };
    case "lab":
      return { ...step, intro: step.intro ? blockMd(step.intro) : undefined };
    case "explain":
      return { ...step, cards: step.cards.map((c) => ({ ...c, body: blockMd(c.body) })) };
    case "quiz":
      return { ...step, items: step.items.map(renderItem) };
    case "wrap":
      return {
        ...step,
        rules: step.rules.map(inlineMd),
        realWorld: step.realWorld
          ? {
              body: step.realWorld.body ? blockMd(step.realWorld.body) : undefined,
              parts: step.realWorld.parts.map(inlineMd),
              safety: step.realWorld.safety.map(inlineMd),
            }
          : undefined,
      };
  }
}

/** Removes undefined values so the data serialises cleanly into island props. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadCourse(root = findContentDir()): Course {
  const ctx: Ctx = { root, problems: [] };
  const course = validate(ctx, join(root, "course.yaml"), courseSchema, readYaml(ctx, join(root, "course.yaml")));
  const partsFile = join(root, "parts.yaml");
  const partsData = validate(ctx, partsFile, partsSchema, readYaml(ctx, partsFile));
  const parts = partsData?.parts ?? [];
  const partIds = new Set<string>();
  for (const p of parts) {
    if (partIds.has(p.id)) report(ctx, partsFile, [`duplicate part id "${p.id}"`]);
    partIds.add(p.id);
  }

  const units: UnitData[] = [];
  const lessons: LessonData[] = [];
  const lessonIds = new Map<string, string>();
  const landmarkIds = new Set<string>();

  for (const [ui, unitId] of (course?.units ?? []).entries()) {
    const unitDir = join(root, "units", unitId);
    const unitFile = join(unitDir, "unit.yaml");
    const unit = validate(ctx, unitFile, unitSchema, readYaml(ctx, unitFile));
    if (!unit) continue;
    if (unit.id !== unitId) report(ctx, unitFile, [`id "${unit.id}" must match its folder name "${unitId}"`]);
    const unitData: UnitData = { id: unitId, number: ui + 1, title: unit.title, summary: unit.summary, isle: unit.isle, modules: [] };

    for (const moduleId of unit.modules) {
      const moduleDir = join(unitDir, moduleId);
      const moduleFile = join(moduleDir, "module.yaml");
      const mod = validate(ctx, moduleFile, moduleSchema, readYaml(ctx, moduleFile));
      if (!mod) continue;
      if (mod.id !== moduleId) report(ctx, moduleFile, [`id "${mod.id}" must match its folder name "${moduleId}"`]);
      if (landmarkIds.has(mod.landmark.id)) report(ctx, moduleFile, [`landmark id "${mod.landmark.id}" is used twice`]);
      landmarkIds.add(mod.landmark.id);
      const moduleData: ModuleData = { id: moduleId, unit: unitId, title: mod.title, summary: mod.summary, landmark: mod.landmark, lessons: [] };

      for (const lessonId of mod.lessons) {
        const lessonFile = join(moduleDir, lessonId, "lesson.yaml");
        const lesson = validate(ctx, lessonFile, lessonSchema, readYaml(ctx, lessonFile));
        if (!lesson) continue;
        const issues: string[] = [];
        if (lesson.id !== lessonId) issues.push(`id "${lesson.id}" must match its folder name "${lessonId}"`);
        const clash = lessonIds.get(lesson.id);
        if (clash) issues.push(`lesson id "${lesson.id}" is already used by ${clash}`);
        lessonIds.set(lesson.id, fileLabel(ctx, lessonFile));
        lesson.unlocks.parts.forEach((p, i) => {
          if (!partIds.has(p)) issues.push(`unlocks.parts[${i}]: no part "${p}" in content/parts.yaml`);
        });
        if (lesson.unlocks.isle && !isIslePiece(lesson.unlocks.isle))
          issues.push(`unlocks.isle: "${lesson.unlocks.isle}" is not an island piece (known pieces: ${ISLE_PIECES.join(", ")})`);
        lesson.steps.forEach((s, i) => {
          if (s.type === "lab" && !existsSync(join(root, "labs", `${s.lab}.ts`)))
            issues.push(`steps[${i}].lab: no lab file content/labs/${s.lab}.ts`);
          if (s.type === "hook" && s.visual?.kind === "part" && !partIds.has(s.visual.part))
            issues.push(`steps[${i}].visual.part: no part "${s.visual.part}" in content/parts.yaml`);
        });
        if (issues.length) {
          report(ctx, lessonFile, issues);
          continue;
        }
        const data: LessonData = clean({
          ...lesson,
          steps: lesson.steps.map(renderStep),
          unit: unitId,
          module: moduleId,
          href: `/learn/${unitId}/${lesson.id}`,
          index: lessons.length,
        });
        lessons.push(data);
        moduleData.lessons.push(data);
      }
      unitData.modules.push(moduleData);
    }
    units.push(unitData);
  }

  const upcoming: UpcomingUnit[] = (course?.upcoming ?? []).map((u, i) => ({ ...u, number: units.length + i + 1 }));
  for (const u of upcoming)
    if (course?.units.includes(u.id)) report(ctx, join(root, "course.yaml"), [`unit "${u.id}" is listed both in units and upcoming`]);

  if (ctx.problems.length) throw new ContentError(ctx.problems);

  const renderedParts = parts.map((p) => ({ ...p, facts: p.facts.map(inlineMd) }));
  return { title: course?.title ?? "", units, upcoming, lessons, parts: renderedParts, outline: outlineOf(units, lessons) };
}

function outlineOf(units: UnitData[], lessons: LessonData[]): CourseOutline {
  const outline: CourseOutline = { units: [], modules: [], lessons: {}, order: lessons.map((l) => l.id) };
  for (const u of units) {
    outline.units.push({ id: u.id, number: u.number, title: u.title, modules: u.modules.map((mm) => mm.id) });
    for (const mod of u.modules)
      outline.modules.push({ id: mod.id, unit: u.id, title: mod.title, landmark: mod.landmark, lessons: mod.lessons.map((l) => l.id) });
  }
  for (const l of lessons) {
    const wrap = l.steps.find((s) => s.type === "wrap");
    outline.lessons[l.id] = {
      id: l.id,
      title: l.title,
      href: l.href,
      unit: l.unit,
      module: l.module,
      minutes: l.minutes,
      parts: l.unlocks.parts,
      isle: l.unlocks.isle,
      rules: wrap?.type === "wrap" ? wrap.rules.length : 0,
    };
  }
  return clean(outline);
}

let cached: Course | null = null;

/** The course, loaded once per build (re-read on every request in dev so edits show up). */
export function getCourse(): Course {
  if (cached && import.meta.env?.PROD) return cached;
  cached = loadCourse();
  return cached;
}
