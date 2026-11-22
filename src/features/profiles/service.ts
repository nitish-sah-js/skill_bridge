import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProfileRow } from "@/types/database";
import { AppError, dbError } from "@/lib/api/errors";
import { profileFieldsSchema, type ProfilePatch } from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;

export async function getProfile(supabase: Client, userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw dbError("load profile", error);
  if (!data) throw new AppError("NOT_FOUND", "Your profile could not be found.");
  return data;
}

/** Fields required before onboarding can be marked complete. */
export function missingProfileFields(profile: ProfileRow): string[] {
  const result = profileFieldsSchema.safeParse({
    ...profile,
    weekly_learning_hours: profile.weekly_learning_hours ?? undefined,
  });
  return result.success ? [] : [...new Set(result.error.issues.map((i) => String(i.path[0])))];
}

/** Apply a validated partial update as the signed-in user (RLS + column grants enforce ownership). */
export async function updateProfile(supabase: Client, userId: string, patch: ProfilePatch): Promise<ProfileRow> {
  const { complete_onboarding, ...fields } = patch;

  if (fields.target_career_id) {
    const { data: career, error } = await supabase
      .from("careers")
      .select("id")
      .eq("id", fields.target_career_id)
      .maybeSingle();
    if (error) throw dbError("check career", error);
    if (!career) throw new AppError("VALIDATION_FAILED", "That career does not exist.");
  }

  let update: Database["public"]["Tables"]["profiles"]["Update"] = fields;
  if (complete_onboarding) {
    const current = await getProfile(supabase, userId);
    const merged = { ...current, ...fields };
    const missing = missingProfileFields(merged);
    if (missing.length) {
      throw new AppError("VALIDATION_FAILED", "Please complete every onboarding step first.", { missing });
    }
    update = { ...fields, onboarding_completed: true, onboarding_step: 6 };
  }

  const { data, error } = await supabase.from("profiles").update(update).eq("id", userId).select("*").single();
  if (error) throw dbError("update profile", error);
  return data;
}
