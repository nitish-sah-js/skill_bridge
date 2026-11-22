import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json, LearningTaskRow, RoadmapRow, RoadmapWeekRow, TaskStatus } from "@/types/database";
import { AppError, dbError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/features/profiles/service";
import { getSkillGapReport } from "@/features/skill-gap/service";
import { taskStatusPatch, unmetDependencies, type TaskLike } from "@/features/progress/calculations";
import { generateRoadmap, type RoadmapPlan } from "./generator";

type Client = SupabaseClient<Database>;

export type RoadmapTask = LearningTaskRow & { weekNumber: number; skillName: string | null };
export type RoadmapView = {
  roadmap: RoadmapRow & { notes: string[] };
  weeks: (RoadmapWeekRow & { tasks: RoadmapTask[] })[];
  tasks: RoadmapTask[];
};

export function toTaskLike(t: RoadmapTask): TaskLike & RoadmapTask {
  return {
    ...t,
    estimatedMinutes: t.estimated_minutes,
    actualMinutes: t.actual_minutes,
    completedAt: t.completed_at,
    sortOrder: t.sort_order,
    dependsOnTaskIds: t.depends_on_task_ids,
    isStretch: t.is_stretch,
  };
}

/** Build a plan from the student's current gap analysis and replace their active roadmap. */
export async function generateRoadmapForUser(supabase: Client, userId: string): Promise<{ roadmapId: string; plan: RoadmapPlan }> {
  const profile = await getProfile(supabase, userId);
  if (!profile.weekly_learning_hours || !profile.learning_pace) {
    throw new AppError("PRECONDITION_FAILED", "Set your weekly learning hours and pace in your profile first.");
  }
  const report = await getSkillGapReport(supabase, userId);
  if (report.state === "no_career") throw new AppError("PRECONDITION_FAILED", "Choose a target career first.");
  if (!report.latestAttempt) {
    throw new AppError("PRECONDITION_FAILED", "Complete the skill assessment before generating a roadmap.");
  }

  const skillIds = report.career.skills.map((s) => s.skillId);
  const [templates, completed] = await Promise.all([
    supabase.from("learning_task_templates").select("*").in("skill_id", skillIds),
    supabase
      .from("learning_tasks")
      .select("template_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("template_id", "is", null),
  ]);
  if (templates.error) throw dbError("load task templates", templates.error);
  if (completed.error) throw dbError("load completed tasks", completed.error);

  const plan = generateRoadmap({
    career: { id: report.career.id, name: report.career.name, suggestedProjects: report.career.suggestedProjects },
    analysis: report.analysis,
    dependencies: report.career.dependencies,
    templates: templates.data.map((t) => ({
      id: t.id,
      key: t.key,
      skillId: t.skill_id,
      level: t.level,
      taskType: t.task_type,
      title: t.title,
      description: t.description,
      estimatedMinutes: t.estimated_minutes,
      completionCriteria: t.completion_criteria,
      resourceUrl: t.resource_url,
    })),
    completedTemplateIds: new Set(completed.data.map((c) => c.template_id!)),
    weeklyHours: profile.weekly_learning_hours,
    pace: profile.learning_pace,
    attemptId: report.latestAttempt.id,
  });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("replace_active_roadmap", {
    p_user_id: userId,
    p_plan: plan as unknown as Json,
  });
  if (error) throw dbError("save roadmap", error);
  return { roadmapId: data, plan };
}

/** The active roadmap, or the most recently completed one. Null when none exists. */
export async function getCurrentRoadmap(supabase: Client, userId: string): Promise<RoadmapView | null> {
  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError("load roadmap", error);
  if (!roadmap) return null;
  return loadRoadmapView(supabase, roadmap);
}

async function loadRoadmapView(supabase: Client, roadmap: RoadmapRow): Promise<RoadmapView> {
  const [weeks, tasks] = await Promise.all([
    supabase.from("roadmap_weeks").select("*").eq("roadmap_id", roadmap.id).order("week_number"),
    supabase.from("learning_tasks").select("*").eq("roadmap_id", roadmap.id).order("sort_order"),
  ]);
  if (weeks.error) throw dbError("load roadmap weeks", weeks.error);
  if (tasks.error) throw dbError("load roadmap tasks", tasks.error);

  const skillIds = [...new Set(tasks.data.map((t) => t.skill_id).filter((id): id is string => id !== null))];
  const { data: skills, error } = skillIds.length
    ? await supabase.from("skills").select("id, name").in("id", skillIds)
    : { data: [], error: null };
  if (error) throw dbError("load roadmap skills", error);
  const skillName = new Map(skills.map((s) => [s.id, s.name]));
  const weekNumber = new Map(weeks.data.map((w) => [w.id, w.week_number]));

  const enriched: RoadmapTask[] = tasks.data
    .map((t) => ({
      ...t,
      weekNumber: weekNumber.get(t.roadmap_week_id) ?? 0,
      skillName: t.skill_id ? (skillName.get(t.skill_id) ?? null) : null,
    }))
    .sort((a, b) => a.weekNumber - b.weekNumber || a.sort_order - b.sort_order);

  return {
    roadmap: { ...roadmap, notes: z.array(z.string()).catch([]).parse(roadmap.generation_notes) },
    weeks: weeks.data.map((w) => ({ ...w, tasks: enriched.filter((t) => t.roadmap_week_id === w.id) })),
    tasks: enriched,
  };
}

export async function getTask(supabase: Client, userId: string, taskId: string) {
  const { data: task, error } = await supabase
    .from("learning_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw dbError("load task", error);
  if (!task) throw new AppError("NOT_FOUND", "Task not found.");

  const { data: roadmap, error: roadmapError } = await supabase.from("roadmaps").select("*").eq("id", task.roadmap_id).single();
  if (roadmapError) throw dbError("load task roadmap", roadmapError);
  const view = await loadRoadmapView(supabase, roadmap);
  const enriched = view.tasks.find((t) => t.id === taskId)!;
  const week = view.weeks.find((w) => w.id === task.roadmap_week_id)!;
  const blockers = unmetDependencies(toTaskLike(enriched), view.tasks.map(toTaskLike))
    .map((id) => view.tasks.find((t) => t.id === id))
    .filter((t): t is RoadmapTask => t !== undefined);

  let resources: { title: string; url: string }[] = [];
  if (task.skill_id) {
    const { data: skill } = await supabase.from("skills").select("resources").eq("id", task.skill_id).maybeSingle();
    resources = z.array(z.object({ title: z.string(), url: z.string() })).catch([]).parse(skill?.resources ?? []);
  }
  return { task: enriched, week, roadmap: view.roadmap, blockers, resources };
}

/**
 * Update task progress as the signed-in user. RLS restricts the row to its owner and column
 * grants restrict which fields can change; task completion never alters proficiency scores.
 */
export async function updateTask(
  supabase: Client,
  userId: string,
  taskId: string,
  patch: { status?: TaskStatus; actualMinutes?: number | null; notes?: string | null },
) {
  const { data: current, error } = await supabase
    .from("learning_tasks")
    .select("id, roadmap_id, status, started_at, completed_at, task_type")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw dbError("load task", error);
  if (!current) throw new AppError("NOT_FOUND", "Task not found.");

  const { data: roadmap } = await supabase.from("roadmaps").select("status").eq("id", current.roadmap_id).single();
  if (roadmap?.status === "archived") {
    throw new AppError("CONFLICT", "This task belongs to an archived roadmap and can no longer be changed.");
  }
  if (patch.status === "completed" && current.task_type === "assessment") {
    throw new AppError("CONFLICT", "This task completes automatically when you submit the follow-up assessment.");
  }

  const update: Database["public"]["Tables"]["learning_tasks"]["Update"] = {};
  if (patch.status && patch.status !== current.status) {
    Object.assign(update, taskStatusPatch({ status: current.status, startedAt: current.started_at }, patch.status, new Date()));
  }
  if (patch.actualMinutes !== undefined) update.actual_minutes = patch.actualMinutes;
  if (patch.notes !== undefined) update.notes = patch.notes;

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await supabase.from("learning_tasks").update(update).eq("id", taskId).eq("user_id", userId);
    if (updateError) throw dbError("update task", updateError);
  }
  await syncRoadmapStatus(userId, current.roadmap_id);
}

/** Mark a roadmap completed when every task is done (and reopen it if a task is reopened). */
export async function syncRoadmapStatus(userId: string, roadmapId: string) {
  const admin = createAdminClient();
  const { data: tasks, error } = await admin.from("learning_tasks").select("status").eq("roadmap_id", roadmapId).eq("user_id", userId);
  if (error || !tasks) return;
  const allDone = tasks.length > 0 && tasks.every((t) => t.status === "completed");
  await admin
    .from("roadmaps")
    .update({ status: allDone ? "completed" : "active" })
    .eq("id", roadmapId)
    .eq("user_id", userId)
    .in("status", allDone ? ["active"] : ["completed"]);
}
