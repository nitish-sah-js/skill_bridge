import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CareerRow, Database, SkillRow } from "@/types/database";
import { AppError, dbError } from "@/lib/api/errors";

type Client = SupabaseClient<Database>;

const projectsSchema = z.array(z.object({ title: z.string(), description: z.string() })).catch([]);
const resourcesSchema = z
  .array(z.object({ title: z.string(), url: z.string(), kind: z.string() }))
  .catch([]);

export type Resource = z.infer<typeof resourcesSchema>[number];

export type CareerSkill = {
  skillId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  requiredProficiency: number;
  importanceWeight: number;
  resources: Resource[];
};

export type CareerSummary = Pick<CareerRow, "id" | "slug" | "name" | "description"> & { skillCount: number };

export type CareerDetail = Pick<CareerRow, "id" | "slug" | "name" | "description" | "responsibilities" | "prerequisites"> & {
  suggestedProjects: { title: string; description: string }[];
  skills: CareerSkill[];
  dependencies: { prerequisiteSkillId: string; dependentSkillId: string }[];
};

export async function listCareers(supabase: Client): Promise<CareerSummary[]> {
  const [careers, links] = await Promise.all([
    supabase.from("careers").select("id, slug, name, description, sort_order").order("sort_order"),
    supabase.from("career_skills").select("career_id"),
  ]);
  if (careers.error) throw dbError("list careers", careers.error);
  if (links.error) throw dbError("list career skills", links.error);
  return careers.data.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    skillCount: links.data.filter((l) => l.career_id === c.id).length,
  }));
}

export async function getCareer(supabase: Client, idOrSlug: string): Promise<CareerDetail> {
  const isUuid = z.string().uuid().safeParse(idOrSlug).success;
  const query = supabase.from("careers").select("*");
  const { data: career, error } = await (isUuid ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug)).maybeSingle();
  if (error) throw dbError("load career", error);
  if (!career) throw new AppError("NOT_FOUND", "Career not found.");

  const { data: links, error: linkError } = await supabase
    .from("career_skills")
    .select("skill_id, required_proficiency, importance_weight")
    .eq("career_id", career.id);
  if (linkError) throw dbError("load career skills", linkError);

  const skillIds = links.map((l) => l.skill_id);
  const [skills, deps] = await Promise.all([
    skillIds.length
      ? supabase.from("skills").select("*").in("id", skillIds)
      : Promise.resolve({ data: [] as SkillRow[], error: null }),
    skillIds.length
      ? supabase.from("skill_dependencies").select("prerequisite_skill_id, dependent_skill_id").in("dependent_skill_id", skillIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (skills.error) throw dbError("load skills", skills.error);
  if (deps.error) throw dbError("load skill dependencies", deps.error);

  const skillById = new Map(skills.data.map((s) => [s.id, s]));
  const careerSkills: CareerSkill[] = links
    .map((l) => {
      const s = skillById.get(l.skill_id)!;
      return {
        skillId: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description,
        category: s.category,
        requiredProficiency: l.required_proficiency,
        importanceWeight: Number(l.importance_weight),
        resources: resourcesSchema.parse(s.resources),
      };
    })
    .sort((a, b) => b.importanceWeight - a.importanceWeight || a.name.localeCompare(b.name));

  return {
    id: career.id,
    slug: career.slug,
    name: career.name,
    description: career.description,
    responsibilities: career.responsibilities,
    prerequisites: career.prerequisites,
    suggestedProjects: projectsSchema.parse(career.suggested_projects),
    skills: careerSkills,
    dependencies: deps.data.map((d) => ({
      prerequisiteSkillId: d.prerequisite_skill_id,
      dependentSkillId: d.dependent_skill_id,
    })),
  };
}
