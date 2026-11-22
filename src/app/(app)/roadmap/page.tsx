import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, Info, ListChecks, Map as MapIcon, PartyPopper, Target } from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getCurrentRoadmap, toTaskLike } from "@/features/roadmap/service";
import { getSkillGapReport } from "@/features/skill-gap/service";
import { activeWeekNumber, roadmapCompletion } from "@/features/progress/calculations";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { GenerateRoadmapButton } from "@/components/roadmap/generate-roadmap-button";
import { TaskRow } from "@/components/roadmap/task-row";
import { StartAssessmentButton } from "@/components/careers/career-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Roadmap" };

const pill = "rounded-full border px-2 py-0.5 text-[11px] font-medium";

export default async function RoadmapPage() {
  const { user, supabase } = await requireUser("/roadmap");
  const [view, gap] = await Promise.all([getCurrentRoadmap(supabase, user.id), getSkillGapReport(supabase, user.id)]);

  if (!view) {
    const assessed = gap.state === "ready" && gap.latestAttempt;
    return (
      <>
        <PageHeader title="Roadmap" />
        <EmptyState
          icon={MapIcon}
          title={assessed ? "Generate your six-week roadmap" : "Assessment first"}
          action={
            assessed ? (
              <GenerateRoadmapButton />
            ) : gap.state === "ready" ? (
              <StartAssessmentButton careerId={gap.career.id} />
            ) : (
              <Link href="/careers" className={buttonVariants()}>
                Choose a career
              </Link>
            )
          }
        >
          {assessed
            ? "The plan prioritises your largest gaps, puts prerequisites first and fits your weekly hours."
            : "Your roadmap is built from measured skill gaps, so take the assessment first."}
        </EmptyState>
      </>
    );
  }

  const tasks = view.tasks.map(toTaskLike);
  const completion = roadmapCompletion(tasks);
  const activeWeek = activeWeekNumber(tasks);
  const done = view.roadmap.status === "completed";
  const newerAssessment =
    gap.state === "ready" &&
    gap.latestAttempt &&
    view.roadmap.generated_from_attempt_id !== gap.latestAttempt.id &&
    new Date(gap.latestAttempt.submittedAt) > new Date(view.roadmap.created_at);

  return (
    <>
      <PageHeader
        title={view.roadmap.title}
        description={`Generated ${formatDate(view.roadmap.created_at)}. Planned for up to ${formatMinutes(view.roadmap.weekly_minutes_budget)} a week (${view.roadmap.learning_pace} pace).`}
        actions={<GenerateRoadmapButton regenerate />}
      />

      {done && (
        <Alert className="mb-4 border-strong/40 bg-strong/10">
          <PartyPopper className="text-strong" />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>You completed every task in this roadmap. Check your progress, then regenerate for the next six weeks.</span>
            <Link href="/progress" className={buttonVariants({ size: "sm" })}>
              View progress
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {newerAssessment && !done && (
        <Alert className="mb-4 border-primary/40 bg-accent/40">
          <Info className="text-primary" />
          <AlertDescription>
            You have newer assessment results than this plan. Regenerate to re-prioritise; completed work is kept.
          </AlertDescription>
        </Alert>
      )}

      <section
        aria-label="Roadmap completion"
        className={cn("surface", "mb-4 grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5")}
      >
        <span
          className="hidden size-11 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30 sm:grid"
          aria-hidden
        >
          <ListChecks className="size-5" />
        </span>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {completion.completedTasks} of {completion.totalTasks} tasks completed
            </span>
            <span className="font-heading text-lg font-semibold text-primary tabular-nums">{completion.percent}%</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Roadmap completion"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completion.percent}%` }} />
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4 text-primary" aria-hidden />
          {formatMinutes(completion.completedMinutes)} of {formatMinutes(completion.totalMinutes)} planned
        </p>
      </section>

      {view.roadmap.notes.length > 0 && (
        <ul className="mb-4 grid gap-1.5 rounded-xl border border-dashed border-primary/30 bg-accent/30 p-3 text-sm leading-snug">
          {view.roadmap.notes.map((n) => (
            <li key={n} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      <ol className="grid gap-3">
        {view.weeks.map((week, idx) => {
          const completedCount = week.tasks.filter((t) => t.status === "completed").length;
          const weekDone = week.tasks.length > 0 && completedCount === week.tasks.length;
          const weekPercent = week.tasks.length > 0 ? Math.round((completedCount / week.tasks.length) * 100) : 0;
          const isActive = week.week_number === activeWeek;
          const minutes = week.tasks.reduce((s, t) => s + t.estimated_minutes, 0);
          const isLast = idx === view.weeks.length - 1;
          return (
            <li key={week.id} aria-current={isActive ? "step" : undefined} className="grid grid-cols-[2.25rem_1fr] gap-3">
              <div className="relative flex justify-center pt-3">
                <span
                  className={cn(
                    "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border font-heading text-sm font-semibold tabular-nums",
                    weekDone
                      ? "border-strong bg-strong text-background"
                      : isActive
                        ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "border-primary/40 bg-primary/10 text-primary",
                  )}
                  aria-hidden
                >
                  {weekDone ? <CheckCircle2 className="size-4.5" /> : week.week_number}
                </span>
                {!isLast && <span aria-hidden className="absolute top-12 -bottom-3 w-px bg-primary/25" />}
              </div>

              <div className={cn("surface", "min-w-0 overflow-hidden", isActive && "border-primary/60 ring-1 ring-primary/40")}>
                <div className="flex flex-col gap-2 p-4 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="leading-snug font-semibold">
                        <span className="sr-only">Week {week.week_number}: </span>
                        {week.title}
                      </h2>
                      {isActive && !weekDone && <span className={cn(pill, "border-primary/50 bg-primary/15 text-primary")}>This week</span>}
                      {weekDone && <span className={cn(pill, "border-strong/50 bg-strong/15 text-strong")}>Done</span>}
                    </div>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{week.objective}</p>
                    <p className="mt-1.5 flex gap-1.5 text-sm leading-snug">
                      <Target className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      <span>
                        <span className="font-medium">Done when:</span> {week.completion_criterion}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex-col sm:items-end">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" aria-hidden />
                      Week {week.week_number}
                    </span>
                    {minutes > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {formatMinutes(minutes)}
                      </span>
                    )}
                  </div>
                </div>

                {week.tasks.length > 0 && (
                  <div className="flex items-center gap-2 px-4 pb-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className={cn("h-full rounded-full", weekDone ? "bg-strong" : "bg-primary")} style={{ width: `${weekPercent}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {completedCount}/{week.tasks.length}
                      <span className="sr-only"> tasks done this week</span>
                    </span>
                  </div>
                )}

                {week.tasks.length > 0 ? (
                  <ul className="divide-y border-t bg-background/30 px-4">
                    {week.tasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </ul>
                ) : (
                  <p className="border-t px-4 py-3 text-sm text-muted-foreground">
                    No new tasks. Use this week to revisit anything marked “needs review”.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
