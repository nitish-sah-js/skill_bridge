import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { dbError } from "@/lib/api/errors";
import { getCareer, type CareerDetail } from "@/features/careers/service";
import { getProfile } from "@/features/profiles/service";
import { analyzeSkillGaps, type GapAnalysis } from "./engine";

type Client = SupabaseClient<Database>;

export type SkillGapReport =
  | { state: "no_career" }
  | {
      state: "ready";
      career: CareerDetail;
      analysis: GapAnalysis;
      /** Latest submitted attempt for this career, if any. */
      latestAttempt: { id: string; submittedAt: string; kind: "initial" | "follow_up" } | null;
      measuredAt: string | null;
    };

/** Gap analysis for the student's target career, built from their measured skill levels. */
export async function getSkillGapReport(supabase: Client, userId: string): Promise<SkillGapReport> {
  const profile = await getProfile(supabase, userId);
  if (!profile.target_career_id) return { state: "no_career" };

  const career = await getCareer(supabase, profile.target_career_id);
  const [levels, attempt] = await Promise.all([
    supabase
      .from("user_skill_levels")
      .select("skill_id, current_proficiency, updated_at")
      .eq("user_id", userId)
      .in("skill_id", career.skills.map((s) => s.skillId)),
    supabase
      .from("assessment_attempts")
      .select("id, submitted_at, kind")
      .eq("user_id", userId)
      .eq("career_id", career.id)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (levels.error) throw dbError("load skill levels", levels.error);
  if (attempt.error) throw dbError("load latest attempt", attempt.error);

  const levelBySkill = new Map(levels.data.map((l) => [l.skill_id, Number(l.current_proficiency)]));
  const analysis = analyzeSkillGaps(
    career.skills.map((s) => ({
      skillId: s.skillId,
      name: s.name,
      requiredProficiency: s.requiredProficiency,
      importanceWeight: s.importanceWeight,
      currentProficiency: levelBySkill.get(s.skillId) ?? null,
    })),
    career.dependencies,
  );

  const measuredAt = levels.data.map((l) => l.updated_at).sort().at(-1) ?? null;
  return {
    state: "ready",
    career,
    analysis,
    latestAttempt: attempt.data
      ? { id: attempt.data.id, submittedAt: attempt.data.submitted_at!, kind: attempt.data.kind }
      : null,
    measuredAt,
  };
}
