import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { dbError } from "@/lib/api/errors";
import { getCurrentRoadmap, toTaskLike, type RoadmapView } from "@/features/roadmap/service";
import { getSkillGapReport, type SkillGapReport } from "@/features/skill-gap/service";
import { listAttempts, type AttemptSummary } from "@/features/assessments/service";
import {
  activeWeekNumber,
  nextRecommendedTask,
  roadmapCompletion,
  skillImprovements,
  weeklyActivity,
  type RoadmapCompletion,
  type WeeklyActivity,
} from "./calculations";

type Client = SupabaseClient<Database>;

export type SkillHistorySeries = {
  skillId: string;
  skillName: string;
  points: { recordedAt: string; proficiency: number; sourceType: string }[];
};

export type ProgressReport = {
  gap: SkillGapReport;
  roadmap: RoadmapView | null;
  completion: RoadmapCompletion | null;
  activeWeek: number | null;
  nextTask: RoadmapView["tasks"][number] | null;
  activity: WeeklyActivity[];
  attempts: AttemptSummary[];
  history: SkillHistorySeries[];
  improvements: { skillId: string; skillName: string; first: number; latest: number; delta: number }[];
  totals: { tasksCompletedAllTime: number; minutesLoggedAllTime: number };
};

/** Everything the progress and dashboard pages need, computed from stored records only. */
export async function getProgressReport(supabase: Client, userId: string, now = new Date()): Promise<ProgressReport> {
  const [gap, roadmap, attempts, completedTasks, history] = await Promise.all([
    getSkillGapReport(supabase, userId),
    getCurrentRoadmap(supabase, userId),
    listAttempts(supabase, userId),
    supabase
      .from("learning_tasks")
      .select("completed_at, estimated_minutes, actual_minutes")
      .eq("user_id", userId)
      .eq("status", "completed"),
    supabase
      .from("skill_history")
      .select("skill_id, proficiency, recorded_at, source_type")
      .eq("user_id", userId)
      .order("recorded_at"),
  ]);
  if (completedTasks.error) throw dbError("load completed tasks", completedTasks.error);
  if (history.error) throw dbError("load skill history", history.error);

  const skillIds = [...new Set(history.data.map((h) => h.skill_id))];
  const { data: skills, error } = skillIds.length
    ? await supabase.from("skills").select("id, name").in("id", skillIds)
    : { data: [], error: null };
  if (error) throw dbError("load skill names", error);
  const skillName = new Map(skills.map((s) => [s.id, s.name]));

  const points = history.data.map((h) => ({
    skillId: h.skill_id,
    proficiency: Number(h.proficiency),
    recordedAt: h.recorded_at,
    sourceType: h.source_type,
  }));
  const series: SkillHistorySeries[] = skillIds.map((id) => ({
    skillId: id,
    skillName: skillName.get(id) ?? "Skill",
    points: points.filter((p) => p.skillId === id).map(({ recordedAt, proficiency, sourceType }) => ({ recordedAt, proficiency, sourceType })),
  }));

  const taskLikes = roadmap?.tasks.map(toTaskLike) ?? [];
  const next = nextRecommendedTask(taskLikes);

  return {
    gap,
    roadmap,
    completion: roadmap ? roadmapCompletion(taskLikes) : null,
    activeWeek: roadmap ? activeWeekNumber(taskLikes) : null,
    nextTask: next ? (roadmap!.tasks.find((t) => t.id === next.id) ?? null) : null,
    activity: weeklyActivity(
      completedTasks.data.map((t) => ({
        completedAt: t.completed_at!,
        estimatedMinutes: t.estimated_minutes,
        actualMinutes: t.actual_minutes,
      })),
      attempts.filter((a) => a.submitted_at).map((a) => ({ submittedAt: a.submitted_at! })),
      now,
    ),
    attempts,
    history: series,
    improvements: skillImprovements(points).map((i) => ({ ...i, skillName: skillName.get(i.skillId) ?? "Skill" })),
    totals: {
      tasksCompletedAllTime: completedTasks.data.length,
      minutesLoggedAllTime: completedTasks.data.reduce((s, t) => s + (t.actual_minutes ?? 0), 0),
    },
  };
}
