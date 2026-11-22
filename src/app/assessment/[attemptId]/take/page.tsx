import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getProfile } from "@/features/profiles/service";
import { getAttempt } from "@/features/assessments/service";
import { AppError } from "@/lib/api/errors";
import { uuidParam } from "@/lib/api/response";
import { ProctoredTest } from "@/components/assessment/proctored-test";
import { TestWindowClosed } from "@/components/assessment/test-window-panel";

export const metadata: Metadata = { title: "Assessment in progress" };

/** The proctored test window: no app navigation, only the assessment. */
export default async function TakeAssessmentPage({ params }: PageProps<"/assessment/[attemptId]/take">) {
  const { attemptId } = await params;
  const { user, supabase } = await requireUser(`/assessment/${attemptId}/take`);
  if (!uuidParam.safeParse(attemptId).success) notFound();
  const profile = await getProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");

  const attempt = await getAttempt(user.id, attemptId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  if (attempt.status !== "in_progress") return <TestWindowClosed attemptId={attempt.id} />;
  return <ProctoredTest attempt={attempt} />;
}
