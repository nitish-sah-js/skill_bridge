import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getProfile } from "@/features/profiles/service";
import { listCareers } from "@/features/careers/service";
import { OnboardingWizard } from "@/components/profile/onboarding-wizard";
import { Logo } from "@/components/layout/logo";
import { firstName } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const { user, supabase } = await requireUser("/onboarding");
  const profile = await getProfile(supabase, user.id);
  if (profile.onboarding_completed) redirect("/dashboard");

  const [careers, skills] = await Promise.all([
    listCareers(supabase),
    supabase.from("skills").select("name").order("name"),
  ]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-primary/20 bg-card/60 px-4 py-3 backdrop-blur sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold sm:text-3xl">
            {profile.full_name ? `Welcome, ${firstName(profile.full_name)}` : "Welcome"}
          </h1>
          <p className="mt-1.5 max-w-2xl leading-snug text-muted-foreground">
            Tell us where you are and where you want to go. Each step saves as you go, so you can leave and come back.
          </p>
        </div>
        <OnboardingWizard
          initialStep={profile.onboarding_step}
          careers={careers}
          skillSuggestions={(skills.data ?? []).map((s) => s.name).slice(0, 14)}
          initial={{
            full_name: profile.full_name,
            education_level: profile.education_level ?? undefined,
            experience_level: profile.experience_level ?? undefined,
            institution: profile.institution ?? "",
            graduation_year: profile.graduation_year,
            interests: profile.interests,
            current_skills: profile.current_skills,
            target_career_id: profile.target_career_id ?? undefined,
            weekly_learning_hours: profile.weekly_learning_hours ?? undefined,
            learning_pace: profile.learning_pace ?? undefined,
            learning_goals: profile.learning_goals ?? "",
          }}
        />
      </main>
    </div>
  );
}
