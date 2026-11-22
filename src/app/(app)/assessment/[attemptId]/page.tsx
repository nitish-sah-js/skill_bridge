import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getAttempt } from "@/features/assessments/service";
import { getCareer } from "@/features/careers/service";
import { AppError } from "@/lib/api/errors";
import { uuidParam } from "@/lib/api/response";
import { PageHeader } from "@/components/layout/page-header";
import { TestWindowPanel } from "@/components/assessment/test-window-panel";
import { PROCTORING_CONFIG } from "@/config/engine";
import { AssessmentResults } from "@/components/assessment/assessment-results";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const metadata: Metadata = { title: "Assessment" };

export default async function AttemptPage({ params }: PageProps<"/assessment/[attemptId]">) {
  const { attemptId } = await params;
  const { user, supabase } = await requireUser(`/assessment/${attemptId}`);
  if (!uuidParam.safeParse(attemptId).success) notFound();

  const attempt = await getAttempt(user.id, attemptId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const kindLabel = attempt.kind === "follow_up" ? "Follow-up assessment" : "Initial assessment";

  const crumbs = (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/assessment" />}>Assessment</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{attempt.status === "submitted" ? "Results" : "In progress"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  if (attempt.status === "in_progress") {
    return (
      <>
        {crumbs}
        <PageHeader
          title={`${attempt.career.name}: ${kindLabel.toLowerCase()}`}
          description="The test runs fullscreen in its own window, with warnings for leaving it."
        />
        <TestWindowPanel attemptId={attempt.id} violationCount={attempt.violationCount} maxWarnings={PROCTORING_CONFIG.maxWarnings} />
      </>
    );
  }

  const career = await getCareer(supabase, attempt.career.id);
  return (
    <>
      {crumbs}
      <PageHeader title={`${kindLabel} results`} description={`${attempt.career.name}. Scores are calculated on the server from your submitted answers.`} />
      <AssessmentResults
        attempt={attempt}
        requiredBySkill={new Map(career.skills.map((s) => [s.skillId, s.requiredProficiency]))}
      />
    </>
  );
}
