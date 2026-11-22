import type { Metadata } from "next";
import { requireUser } from "@/features/auth/session";
import { getProfile } from "@/features/profiles/service";
import { listCareers } from "@/features/careers/service";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, supabase } = await requireUser("/profile");
  const [profile, careers, skills] = await Promise.all([
    getProfile(supabase, user.id),
    listCareers(supabase),
    supabase.from("skills").select("name").order("name"),
  ]);

  return (
    <>
      <PageHeader title="Profile" description={`Signed in as ${user.email}. These details shape your roadmap and mentor answers.`} />
      <ProfileForm
        careers={careers}
        skillSuggestions={(skills.data ?? []).map((s) => s.name).slice(0, 14)}
        initial={{
          full_name: profile.full_name,
          education_level: profile.education_level ?? "other",
          experience_level: profile.experience_level ?? "none",
          institution: profile.institution ?? "",
          graduation_year: profile.graduation_year,
          interests: profile.interests,
          current_skills: profile.current_skills,
          target_career_id: profile.target_career_id ?? "",
          weekly_learning_hours: profile.weekly_learning_hours ?? 5,
          learning_pace: profile.learning_pace ?? "steady",
          learning_goals: profile.learning_goals ?? "",
        }}
      />
    </>
  );
}
