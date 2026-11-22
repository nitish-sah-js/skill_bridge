import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bot, Compass, Target } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getSkillGapReport } from "@/features/skill-gap/service";
import { getCurrentRoadmap } from "@/features/roadmap/service";
import { GAP_CONFIG } from "@/config/engine";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ReadinessPanel } from "@/components/skills/readiness-panel";
import { SkillGapList } from "@/components/skills/skill-gap-list";
import { SkillComparisonChart } from "@/components/skills/skill-comparison-chart";
import { StartAssessmentButton } from "@/components/careers/career-actions";
import { GenerateRoadmapButton } from "@/components/roadmap/generate-roadmap-button";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Skill gap" };

export default async function SkillGapPage() {
  const { user, supabase } = await requireUser("/skill-gap");
  const [report, roadmap] = await Promise.all([getSkillGapReport(supabase, user.id), getCurrentRoadmap(supabase, user.id)]);

  if (report.state === "no_career") {
    return (
      <>
        <PageHeader title="Skill gap" />
        <EmptyState
          icon={Compass}
          title="Choose a target career"
          action={
            <Link href="/careers" className={buttonVariants()}>
              Explore careers
            </Link>
          }
        >
          Gaps are measured against a career&apos;s required skills.
        </EmptyState>
      </>
    );
  }

  const { analysis, career } = report;
  if (analysis.readiness.assessedCount === 0) {
    return (
      <>
        <PageHeader title="Skill gap" description={`Against the ${career.name} requirements.`} />
        <EmptyState icon={Target} title="Nothing measured yet" action={<StartAssessmentButton careerId={career.id} />}>
          Take the {career.name} assessment. Until then every skill is “not assessed”, which is different from zero.
        </EmptyState>
      </>
    );
  }

  const top = analysis.priorities[0];
  const recommendation = !roadmap
    ? { text: "Turn these gaps into a six-week plan sized to your weekly hours.", action: <GenerateRoadmapButton /> }
    : analysis.notAssessed.length > 0
      ? {
          text: `${analysis.notAssessed.length} skill${analysis.notAssessed.length === 1 ? " is" : "s are"} unmeasured. A follow-up assessment fills in the picture.`,
          action: <StartAssessmentButton careerId={career.id} label="Start follow-up assessment" />,
        }
      : {
          text: top ? `Keep working on ${top.name}, your highest-priority gap, in your roadmap.` : "All targets met. Consider stretch tasks in your roadmap.",
          action: (
            <Link href="/roadmap" className={buttonVariants()}>
              Open roadmap
            </Link>
          ),
        };

  const total = analysis.skills.length;
  const breakdown = [
    { key: "strong", label: "Meet target", value: analysis.strengths.length, dot: "bg-strong" },
    { key: "developing", label: "Developing", value: analysis.skills.filter((s) => s.status === "developing").length, dot: "bg-developing" },
    { key: "beginner", label: "Beginner", value: analysis.skills.filter((s) => s.status === "beginner").length, dot: "bg-beginner" },
    { key: "not_assessed", label: "Not assessed", value: analysis.notAssessed.length, dot: "bg-unassessed" },
  ];

  return (
    <>
      <PageHeader
        title="Skill gap"
        description={
          <>
            {career.name} requirements vs your measured proficiency
            {report.measuredAt && <>, last measured {formatDate(report.measuredAt)}</>}.
          </>
        }
        actions={
          <Link href="/mentor" className={buttonVariants({ variant: "outline" })}>
            <Bot aria-hidden />
            Ask the mentor
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <ReadinessPanel readiness={analysis.readiness} />
        <div className="grid content-start gap-6">
          <section aria-labelledby="next-title" className="surface border-l-4 border-l-primary p-5 sm:p-6">
            <h2 id="next-title" className="font-semibold">
              Recommended next step
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{recommendation.text}</p>
            <div className="mt-4">{recommendation.action}</div>
          </section>

          <section aria-labelledby="breakdown-title" className="surface p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="breakdown-title" className="font-semibold">
                {total} required skill{total === 1 ? "" : "s"}
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {analysis.readiness.assessedCount} of {total} assessed
              </span>
            </div>
            <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              {breakdown.map((b) =>
                b.value > 0 ? <div key={b.key} className={b.dot} style={{ width: `${(b.value / Math.max(total, 1)) * 100}%` }} /> : null,
              )}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {breakdown.map((b) => (
                <div key={b.key}>
                  <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className={cn("size-2 rounded-full", b.dot)} aria-hidden />
                    {b.label}
                  </dt>
                  <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums leading-none">{b.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <section aria-labelledby="priority-title" className="surface mt-6 p-5 sm:p-6">
        <SectionHeading id="priority-title" title="Priority gaps" count={analysis.priorities.length} />
        <p className="mt-1.5 mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Ranked by gap size relative to the target × the skill&apos;s importance, boosted when other gaps depend on it.
        </p>
        {analysis.priorities.length ? (
          <SkillGapList skills={analysis.priorities} showPriority />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">No gaps among assessed skills.</p>
            <Link href="/roadmap" className={cn(buttonVariants(), "shrink-0 self-start sm:self-auto")}>
              Open roadmap
            </Link>
          </div>
        )}
      </section>

      {(analysis.strengths.length > 0 || analysis.notAssessed.length > 0) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {analysis.strengths.length > 0 && (
            <section aria-labelledby="strength-title" className="surface p-5 sm:p-6">
              <SectionHeading id="strength-title" title="Meeting the target" count={analysis.strengths.length} />
              <p className="mt-1.5 mb-5 text-sm leading-relaxed text-muted-foreground">
                Meeting a target means reaching SkillBridge&apos;s threshold, not mastery.
              </p>
              <SkillGapList skills={analysis.strengths} />
            </section>
          )}
          {analysis.notAssessed.length > 0 && (
            <section aria-labelledby="unassessed-title" className="surface p-5 sm:p-6">
              <SectionHeading
                id="unassessed-title"
                title="Not assessed"
                count={analysis.notAssessed.length}
                action={
                  <Link href="/assessment" className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Assess these
                  </Link>
                }
              />
              <p className="mt-1.5 mb-5 text-sm leading-relaxed text-muted-foreground">Not enough evidence yet. These are unknown, not zero.</p>
              <SkillGapList skills={analysis.notAssessed} />
            </section>
          )}
        </div>
      )}

      <section aria-labelledby="chart-title" className="surface mt-6 p-5 sm:p-6">
        <SectionHeading id="chart-title" title="Current vs target" />
        <div className="mt-5">
          <SkillComparisonChart
            data={analysis.skills.map((s) => ({ name: s.name, current: s.currentProficiency, required: s.requiredProficiency }))}
          />
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Status thresholds: meets target at ≥{Math.round(GAP_CONFIG.strongRatio * 100)}% of the target, developing at ≥
        {Math.round(GAP_CONFIG.developingRatio * 100)}%, otherwise beginner.
      </p>
    </>
  );
}

function SectionHeading({ id, title, count, action }: { id: string; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}
