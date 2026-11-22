/**
 * Validates supabase/seed-data/*.json and writes supabase/seed.sql.
 * The generated SQL is idempotent (upserts keyed by slug/key), so it can be re-run safely.
 *
 *   npm run seed:generate
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "supabase", "seed-data");

const difficulty = z.enum(["beginner", "intermediate", "advanced"]);
const url = z.string().url().startsWith("https://");

const skillFileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().min(10),
  category: z.string().min(2),
  prerequisites: z.array(z.string()),
  resources: z
    .array(z.object({ title: z.string().min(2), url, kind: z.enum(["docs", "course", "article", "video", "interactive"]) }))
    .min(1),
  questions: z
    .array(
      z
        .object({
          key: z.string().min(2),
          difficulty,
          question: z.string().min(10),
          options: z.array(z.string().min(1)).length(4),
          correct_index: z.number().int().min(0).max(3),
          explanation: z.string().min(10),
          points: z.number().int().min(1).max(5),
        })
        .refine((q) => new Set(q.options).size === q.options.length, "options must be distinct"),
    )
    .min(2),
  practical: z
    .object({
      key: z.string().min(2),
      title: z.string().min(3),
      difficulty,
      instructions: z.string().min(10),
      expected_output: z.string().min(5),
      rubric: z
        .array(
          z.object({
            key: z.string(),
            description: z.string().min(3),
            points: z.number().int().positive(),
            patterns: z.array(z.string().min(1)).min(1),
            hint: z.string().min(3),
          }),
        )
        .min(1),
      max_points: z.number().int().positive(),
    })
    .nullable()
    .refine((p) => !p || p.rubric.reduce((s, c) => s + c.points, 0) === p.max_points, "rubric points must sum to max_points")
    .refine(
      (p) =>
        !p ||
        p.rubric.every((c) =>
          c.patterns.every((pattern) => {
            try {
              new RegExp(pattern, "i");
              return true;
            } catch {
              return false;
            }
          }),
        ),
      "every rubric pattern must be a valid RegExp",
    ),
  tasks: z
    .array(
      z.object({
        key: z.string().min(2),
        level: z.number().int().min(1).max(3),
        type: z.enum(["learn", "practice", "project"]),
        title: z.string().min(3),
        description: z.string().min(10),
        estimated_minutes: z.number().int().min(5).max(600),
        completion_criteria: z.string().min(5),
        resource_url: url.nullable().optional(),
      }),
    )
    .min(1),
});

const careerSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().min(10),
  responsibilities: z.array(z.string().min(3)).min(1),
  prerequisites: z.array(z.string().min(3)).min(1),
  suggested_projects: z.array(z.object({ title: z.string().min(3), description: z.string().min(10) })).min(1),
  sort_order: z.number().int(),
  skills: z
    .array(
      z.object({
        skill: z.string(),
        required_proficiency: z.number().int().min(0).max(100),
        importance_weight: z.number().positive().max(2),
      }),
    )
    .min(8)
    .max(12),
});

type SkillFile = z.infer<typeof skillFileSchema>;

function lit(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}
function json(value: unknown): string {
  return `${lit(JSON.stringify(value))}::jsonb`;
}
function textArray(values: string[]): string {
  return values.length ? `array[${values.map(lit).join(", ")}]::text[]` : `'{}'::text[]`;
}

function load(): { skills: SkillFile[]; careers: z.infer<typeof careerSchema>[] } {
  const skillsDir = path.join(dataDir, "skills");
  const skills = readdirSync(skillsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const parsed = skillFileSchema.safeParse(JSON.parse(readFileSync(path.join(skillsDir, file), "utf8")));
      if (!parsed.success) throw new Error(`${file}: ${z.prettifyError(parsed.error)}`);
      if (parsed.data.slug !== path.basename(file, ".json")) throw new Error(`${file}: slug does not match file name`);
      return parsed.data;
    });
  const careers = z.array(careerSchema).parse(JSON.parse(readFileSync(path.join(dataDir, "careers.json"), "utf8")));

  const slugs = new Set(skills.map((s) => s.slug));
  const keys = new Set<string>();
  for (const s of skills) {
    for (const p of s.prerequisites) if (!slugs.has(p)) throw new Error(`${s.slug}: unknown prerequisite ${p}`);
    for (const k of [...s.questions.map((q) => q.key), ...(s.practical ? [s.practical.key] : []), ...s.tasks.map((t) => t.key)]) {
      if (keys.has(k)) throw new Error(`duplicate key ${k}`);
      keys.add(k);
    }
  }
  for (const c of careers) {
    for (const cs of c.skills) if (!slugs.has(cs.skill)) throw new Error(`${c.slug}: unknown skill ${cs.skill}`);
    const withPractical = c.skills.filter((cs) => skills.find((s) => s.slug === cs.skill)?.practical);
    if (withPractical.length < 2) throw new Error(`${c.slug}: needs at least 2 skills with practical challenges`);
    const questionCount = c.skills.reduce((n, cs) => n + (skills.find((s) => s.slug === cs.skill)?.questions.length ?? 0), 0);
    if (questionCount < 20) throw new Error(`${c.slug}: only ${questionCount} questions available`);
  }
  assertAcyclic(skills);
  return { skills, careers };
}

function assertAcyclic(skills: SkillFile[]) {
  const graph = new Map(skills.map((s) => [s.slug, s.prerequisites]));
  const state = new Map<string, "visiting" | "done">();
  const visit = (slug: string, trail: string[]) => {
    if (state.get(slug) === "done") return;
    if (state.get(slug) === "visiting") throw new Error(`prerequisite cycle: ${[...trail, slug].join(" -> ")}`);
    state.set(slug, "visiting");
    for (const p of graph.get(slug) ?? []) visit(p, [...trail, slug]);
    state.set(slug, "done");
  };
  for (const s of skills) visit(s.slug, []);
}

function render(): string {
  const { skills, careers } = load();
  const out: string[] = [
    "-- GENERATED by scripts/generate-seed.ts from supabase/seed-data. Do not edit by hand.",
    "-- Idempotent: safe to run repeatedly. Proficiency targets are illustrative starting values.",
    "begin;",
    "",
  ];

  for (const s of skills) {
    out.push(
      `insert into public.skills (slug, name, description, category, resources) values (${lit(s.slug)}, ${lit(s.name)}, ${lit(s.description)}, ${lit(s.category)}, ${json(s.resources)})`,
      `  on conflict (slug) do update set name = excluded.name, description = excluded.description, category = excluded.category, resources = excluded.resources;`,
    );
  }
  out.push("");

  for (const c of careers) {
    out.push(
      `insert into public.careers (slug, name, description, responsibilities, prerequisites, suggested_projects, sort_order) values (${lit(c.slug)}, ${lit(c.name)}, ${lit(c.description)}, ${textArray(c.responsibilities)}, ${textArray(c.prerequisites)}, ${json(c.suggested_projects)}, ${c.sort_order})`,
      `  on conflict (slug) do update set name = excluded.name, description = excluded.description, responsibilities = excluded.responsibilities, prerequisites = excluded.prerequisites, suggested_projects = excluded.suggested_projects, sort_order = excluded.sort_order;`,
    );
    for (const cs of c.skills) {
      out.push(
        `insert into public.career_skills (career_id, skill_id, required_proficiency, importance_weight) select c.id, s.id, ${cs.required_proficiency}, ${cs.importance_weight} from public.careers c, public.skills s where c.slug = ${lit(c.slug)} and s.slug = ${lit(cs.skill)}`,
        `  on conflict (career_id, skill_id) do update set required_proficiency = excluded.required_proficiency, importance_weight = excluded.importance_weight;`,
      );
    }
  }
  out.push("");

  for (const s of skills) {
    for (const p of s.prerequisites) {
      out.push(
        `insert into public.skill_dependencies (prerequisite_skill_id, dependent_skill_id) select p.id, d.id from public.skills p, public.skills d where p.slug = ${lit(p)} and d.slug = ${lit(s.slug)} on conflict do nothing;`,
      );
    }
  }
  out.push("");

  for (const s of skills) {
    const skillRef = `(select id from public.skills where slug = ${lit(s.slug)})`;
    for (const q of s.questions) {
      out.push(
        `insert into public.assessment_questions (key, skill_id, question_text, options, correct_option_index, explanation, difficulty, points) values (${lit(q.key)}, ${skillRef}, ${lit(q.question)}, ${json(q.options)}, ${q.correct_index}, ${lit(q.explanation)}, ${lit(q.difficulty)}, ${q.points})`,
        `  on conflict (key) do update set skill_id = excluded.skill_id, question_text = excluded.question_text, options = excluded.options, correct_option_index = excluded.correct_option_index, explanation = excluded.explanation, difficulty = excluded.difficulty, points = excluded.points;`,
      );
    }
    if (s.practical) {
      const p = s.practical;
      out.push(
        `insert into public.practical_challenges (key, skill_id, title, instructions, expected_output, difficulty, evaluation_rubric, maximum_points) values (${lit(p.key)}, ${skillRef}, ${lit(p.title)}, ${lit(p.instructions)}, ${lit(p.expected_output)}, ${lit(p.difficulty)}, ${json(p.rubric)}, ${p.max_points})`,
        `  on conflict (key) do update set skill_id = excluded.skill_id, title = excluded.title, instructions = excluded.instructions, expected_output = excluded.expected_output, difficulty = excluded.difficulty, evaluation_rubric = excluded.evaluation_rubric, maximum_points = excluded.maximum_points;`,
      );
    }
    for (const t of s.tasks) {
      out.push(
        `insert into public.learning_task_templates (key, skill_id, level, task_type, title, description, estimated_minutes, completion_criteria, resource_url) values (${lit(t.key)}, ${skillRef}, ${t.level}, ${lit(t.type)}, ${lit(t.title)}, ${lit(t.description)}, ${t.estimated_minutes}, ${lit(t.completion_criteria)}, ${lit(t.resource_url ?? null)})`,
        `  on conflict (key) do update set skill_id = excluded.skill_id, level = excluded.level, task_type = excluded.task_type, title = excluded.title, description = excluded.description, estimated_minutes = excluded.estimated_minutes, completion_criteria = excluded.completion_criteria, resource_url = excluded.resource_url;`,
      );
    }
  }

  out.push("", "commit;", "");
  console.log(
    `Validated ${careers.length} careers, ${skills.length} skills, ${skills.reduce((n, s) => n + s.questions.length, 0)} questions, ${skills.filter((s) => s.practical).length} practical challenges, ${skills.reduce((n, s) => n + s.tasks.length, 0)} task templates.`,
  );
  return out.join("\n");
}

writeFileSync(path.join(root, "supabase", "seed.sql"), render());
console.log("Wrote supabase/seed.sql");
