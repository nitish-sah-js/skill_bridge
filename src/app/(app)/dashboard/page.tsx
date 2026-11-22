import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Flag,
  Gauge,
  ListChecks,
  Map as MapIcon,
  PlayCircle,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getProfile } from "@/features/profiles/service";
import { getProgressReport, type ProgressReport } from "@/features/progress/service";
import { ReadinessPanel } from "@/components/skills/readiness-panel";
import { SkillGapList } from "@/components/skills/skill-gap-list";
import { StartAssessmentButton } from "@/components/careers/career-actions";
import { GenerateRoadmapButton } from "@/components/roadmap/generate-roadmap-button";
import { TaskRow } from "@/components/roadmap/task-row";
import { buttonVariants } from "@/components/ui/button";
import { firstName, formatDate, formatMinutes, formatScore } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };


type NextStep = { title: string; body: string; icon: LucideIcon; action: ReactNode };

function nextStep(report: ProgressReport, openAttemptId: string | null): NextStep {
  const gap = report.gap;
  if (gap.state === "no_career") {
    return {
      title: "Choose a target career",
      body: "Everything in SkillBridge is measured against a career's skill requirements.",
      icon: Compass,
      action: (
        <Link href="/careers" className={buttonVariants({ size: "lg" })}>
          Explore careers
        </Link>
      ),
    };
  }
  if (openAttemptId) {
    return {
      title: "Finish your assessment",
      body: "Your answers are saved. Pick up where you left off.",
      icon: ClipboardCheck,
      action: (
        <Link href={`/assessment/${openAttemptId}`} className={buttonVariants({ size: "lg" })}>
          Resume assessment
        </Link>
      ),
    };
  }
  if (!gap.latestAttempt) {
    return {
      title: `Measure your ${gap.career.name} skills`,
      body: "20 questions and 2 short practical challenges, about 30 minutes. Your results drive your gaps and roadmap.",
      icon: Target,
      action: <StartAssessmentButton careerId={gap.career.id} />,
    };
  }
  if (!report.roadmap) {
    return {
      title: "Turn your gaps into a plan",
      body: "Generate a six-week roadmap that starts with your highest-priority, foundational skills.",
      icon: MapIcon,
      action: <GenerateRoadmapButton />,
    };
  }
  if (report.roadmap.roadmap.status === "completed") {
    return {
      title: "Roadmap complete",
      body: "Measure how far you have come with a follow-up assessment, then regenerate your plan.",
      icon: Trophy,
      action: <StartAssessmentButton careerId={gap.career.id} label="Start follow-up assessment" />,
    };
  }
  if (report.nextTask) {
    return {
      title: report.nextTask.title,
      body: `Week ${report.nextTask.weekNumber}${report.nextTask.skillName ? `, ${report.nextTask.skillName}` : ""}, about ${formatMinutes(report.nextTask.estimated_minutes)}.`,
      icon: PlayCircle,
      action: (
        <Link href={`/roadmap/tasks/${report.nextTask.id}`} className={buttonVariants({ size: "lg" })}>
          {report.nextTask.status === "not_started" ? "Start task" : "Continue task"}
        </Link>
      ),
    };
  }
  return {
    title: "Keep going",
    body: "Review your roadmap for what is next.",
    icon: MapIcon,
    action: (
      <Link href="/roadmap" className={buttonVariants({ size: "lg" })}>
        Open roadmap
      </Link>
    ),
  };
}

export default async function DashboardPage() {
  const { user, supabase } = await requireUser("/dashboard");
  const [profile, report] = await Promise.all([getProfile(supabase, user.id), getProgressReport(supabase, user.id)]);
  const gap = report.gap;
  const openAttempt =
    gap.state === "ready" ? report.attempts.find((a) => a.status === "in_progress" && a.career_id === gap.career.id) : undefined;
  const step = nextStep(report, openAttempt?.id ?? null);
  const latest = report.attempts.find((a) => a.status === "submitted" && gap.state === "ready" && a.career_id === gap.career.id);
  const activeWeek = report.roadmap?.weeks.find((w) => w.week_number === report.activeWeek);
  const StepIcon = step.icon;

  const readiness = gap.state === "ready" ? gap.analysis.readiness : null;
  const stats: { label: string; value: string; detail?: string; icon: LucideIcon; href: string }[] = [
    {
      label: "Readiness",
      value: readiness?.score != null ? `${Math.round(readiness.score)}` : "Not assessed",
      detail: readiness?.score != null ? "/100" : undefined,
      icon: Gauge,
      href: gap.state === "ready" ? "/skill-gap" : "/careers",
    },
    {
      label: "Skills assessed",
      value: readiness ? `${readiness.assessedCount}` : "None",
      detail: readiness ? `of ${readiness.totalCount}` : undefined,
      icon: ListChecks,
      href: gap.state === "ready" ? "/skill-gap" : "/careers",
    },
    {
      label: "Roadmap",
      value: report.completion ? `${report.completion.percent}%` : "Not started",
      detail: report.completion ? "complete" : undefined,
      icon: MapIcon,
      href: "/roadmap",
    },
    {
      label: "Tasks done",
      value: `${report.totals.tasksCompletedAllTime}`,
      detail: report.totals.minutesLoggedAllTime ? `${formatMinutes(report.totals.minutesLoggedAllTime)} logged` : undefined,
      icon: CalendarCheck,
      href: "/progress",
    },
  ];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {profile.full_name ? `Hi, ${firstName(profile.full_name)}` : "Welcome back"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {gap.state === "ready" ? (
            <>
              Working toward{" "}
              <Link href={`/careers/${gap.career.slug}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {gap.career.name}
              </Link>
              {latest ? `. Last assessed ${formatDate(latest.submitted_at!)}.` : "."}
            </>
          ) : (
            "No target career selected yet."
          )}
        </p>
      </div>

      <section
        aria-labelledby="next-step"
        className="relative mb-4 flex flex-col gap-4 overflow-hidden rounded-xl border border-primary/30 bg-linear-to-br from-primary/20 via-accent to-card p-5 shadow-[0_12px_32px_-18px_var(--primary)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/20">
            <StepIcon className="size-6" aria-hidden />
          </span>
          <div className="max-w-xl">
            <p className="text-sm font-medium text-primary">Your next step</p>
            <h2 id="next-step" className="mt-0.5 text-xl font-semibold leading-snug sm:text-2xl">
              {step.title}
            </h2>
            <p className="mt-1 text-sm leading-snug text-foreground/80">{step.body}</p>
          </div>
        </div>
        <div className="shrink-0 sm:pl-4">{step.action}</div>
      </section>

      <ul className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className={cn(
                "surface",
                "group flex h-full items-center gap-3 p-3.5 outline-none transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              <IconBadge icon={s.icon} />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{s.label}</span>
                <span className="block truncate font-heading text-lg font-semibold leading-tight tabular-nums">
                  {s.value}
                  {s.detail && <span className="ml-1 text-xs font-normal text-muted-foreground">{s.detail}</span>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Panel title="Career readiness" icon={Gauge} href={gap.state === "ready" ? "/skill-gap" : undefined} linkLabel="Skill gap">
          {gap.state === "ready" ? (
            <ReadinessPanel readiness={gap.analysis.readiness} compact />
          ) : (
            <Placeholder text="Choose a career to see your readiness." href="/careers" cta="Explore careers" />
          )}
          {latest && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
              <span>
                Latest assessment:{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatScore(latest.total_score)}/100</span>{" "}
                ({latest.kind === "follow_up" ? "follow-up" : "initial"})
              </span>
              <Link href={`/assessment/${latest.id}`} className="ml-auto font-medium text-primary underline-offset-4 hover:underline">
                Results
              </Link>
            </p>
          )}
        </Panel>

        <Panel
          title="Top skill gaps"
          icon={Target}
          href={gap.state === "ready" && gap.analysis.priorities.length ? "/skill-gap" : undefined}
          linkLabel="All skills"
        >
          {gap.state === "ready" && gap.analysis.priorities.length > 0 ? (
            <SkillGapList skills={gap.analysis.priorities.slice(0, 3)} />
          ) : gap.state === "ready" && gap.analysis.readiness.assessedCount > 0 ? (
            <Placeholder text="Every assessed skill meets its target." href="/roadmap" cta="Open roadmap" />
          ) : gap.state === "ready" ? (
            <Placeholder text="Your largest gaps appear here after your first assessment." href="/assessment" cta="Take the assessment" />
          ) : (
            <Placeholder text="Pick a target career, then measure your skills against it." href="/careers" cta="Explore careers" />
          )}
          {gap.state === "ready" && gap.analysis.notAssessed.length > 0 && gap.analysis.readiness.assessedCount > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
              <span>
                {gap.analysis.notAssessed.length} skill{gap.analysis.notAssessed.length === 1 ? "" : "s"} not yet assessed.
              </span>
              <Link href="/skill-gap" className="ml-auto font-medium text-primary underline-offset-4 hover:underline">
                See which
              </Link>
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          title={activeWeek ? `This week: ${activeWeek.title}` : "Roadmap"}
          icon={Flag}
          href={report.roadmap ? "/roadmap" : undefined}
          linkLabel="Full roadmap"
        >
          {report.roadmap && report.completion ? (
            <>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {report.completion.completedTasks} of {report.completion.totalTasks} tasks
                </span>
                <span className="font-semibold text-primary tabular-nums">{report.completion.percent}%</span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Roadmap completion"
                aria-valuenow={report.completion.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${report.completion.percent}%` }} />
              </div>
              {activeWeek ? (
                <>
                  <p className="mt-3 text-sm leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Week {activeWeek.week_number} of {report.roadmap.roadmap.duration_weeks}:
                    </span>{" "}
                    {activeWeek.objective}
                  </p>
                  <ul className="mt-1 divide-y">
                    {activeWeek.tasks.slice(0, 4).map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </ul>
                </>
              ) : (
                <Placeholder className="mt-3" text="All tasks complete." href="/progress" cta="View progress" />
              )}
            </>
          ) : gap.state === "ready" && gap.latestAttempt ? (
            <div className="flex flex-col gap-3 rounded-lg bg-accent/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-snug text-muted-foreground">No roadmap yet. Generate one from your assessment results.</p>
              <div className="shrink-0">
                <GenerateRoadmapButton />
              </div>
            </div>
          ) : (
            <Placeholder text="Your six-week plan appears here after your assessment." href="/assessment" cta="Take the assessment" />
          )}
        </Panel>

        <div className="grid content-start gap-4">
          <Panel title="Recent improvements" icon={TrendingUp} href={report.improvements.length ? "/progress" : undefined} linkLabel="Progress">
            {report.improvements.length ? (
              <ul className="grid gap-1.5 text-sm">
                {report.improvements.slice(0, 4).map((i) => (
                  <li key={i.skillId} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-1.5">
                    <span className="truncate">{i.skillName}</span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                        i.delta > 0 ? "bg-strong/12 text-strong" : i.delta < 0 ? "bg-beginner/10 text-beginner" : "text-muted-foreground",
                      )}
                    >
                      {i.delta > 0 ? "+" : ""}
                      {Math.round(i.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Placeholder
                text="Improvements show once a follow-up assessment re-measures a skill."
                href={latest ? "/assessment" : "/progress"}
                cta={latest ? "Reassess" : "View progress"}
              />
            )}
          </Panel>

          <Link
            href="/mentor"
            className={cn(
              "surface",
              "group flex items-center gap-3 p-4 outline-none transition-colors hover:border-primary/50 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <IconBadge icon={Bot} />
            <span className="flex-1">
              <span className="block font-semibold">Ask the AI mentor</span>
              <span className="block text-sm leading-snug text-muted-foreground">Explanations at your level, tied to your gaps.</span>
            </span>
            <Sparkles className="size-4 text-primary" aria-hidden />
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
      <Icon className="size-4.5" aria-hidden />
    </span>
  );
}

function Placeholder({ text, href, cta, className }: { text: string; href: string; cta: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg bg-accent/60 p-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-sm leading-snug text-muted-foreground">{text}</p>
      <Link href={href} className={cn(buttonVariants({ size: "sm" }), "shrink-0 self-start sm:self-auto")}>
        {cta}
      </Link>
    </div>
  );
}

function Panel({
  title,
  icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("surface", "p-4 sm:p-5")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconBadge icon={icon} />
          <h2 className="truncate font-semibold">{title}</h2>
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {linkLabel}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
