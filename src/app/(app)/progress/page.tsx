import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  Clock,
  LineChart,
  Map as MapIcon,
  PlayCircle,
  Target,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getProgressReport } from "@/features/progress/service";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ActivityChart, SkillHistoryChart } from "@/components/progress/charts";
import { SkillGapList } from "@/components/skills/skill-gap-list";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMinutes, formatScore } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };


export default async function ProgressPage() {
  const { user, supabase } = await requireUser("/progress");
  const report = await getProgressReport(supabase, user.id);
  const submitted = report.attempts.filter((a) => a.status === "submitted");

  if (submitted.length === 0 && !report.roadmap) {
    return (
      <>
        <PageHeader title="Progress" />
        <EmptyState
          icon={BarChart3}
          title="No progress recorded yet"
          action={
            <Link href="/assessment" className={buttonVariants()}>
              Take the assessment
            </Link>
          }
        >
          Progress is built only from things you actually do: assessments you submit and tasks you complete.
        </EmptyState>
      </>
    );
  }

  const targets = report.gap.state === "ready" ? Object.fromEntries(report.gap.career.skills.map((s) => [s.skillId, s.requiredProficiency])) : {};
  const latest = submitted[0];
  const stats: { label: string; value: string; icon: LucideIcon; percent?: number }[] = [
    {
      label: "Roadmap complete",
      value: report.completion ? `${report.completion.percent}%` : "No roadmap",
      icon: MapIcon,
      percent: report.completion?.percent,
    },
    {
      label: "Tasks done",
      value: report.completion ? `${report.completion.completedTasks} / ${report.completion.totalTasks}` : `${report.totals.tasksCompletedAllTime}`,
      icon: CalendarCheck,
    },
    { label: "Assessments", value: String(submitted.length), icon: ClipboardCheck },
    {
      label: "Time logged",
      value: report.totals.minutesLoggedAllTime ? formatMinutes(report.totals.minutesLoggedAllTime) : "None logged",
      icon: Clock,
    },
  ];

  return (
    <>
      <PageHeader
        title="Progress"
        description="Everything here comes from your recorded assessments and completed tasks."
        actions={
          report.nextTask ? (
            <Link href={`/roadmap/tasks/${report.nextTask.id}`} className={buttonVariants()}>
              <PlayCircle aria-hidden />
              Next task
            </Link>
          ) : (
            <Link href="/roadmap" className={buttonVariants({ variant: "outline" })}>
              <MapIcon aria-hidden />
              Open roadmap
            </Link>
          )
        }
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={cn("surface", "flex flex-col gap-2 p-3.5")}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="truncate font-heading text-xl font-semibold leading-tight tabular-nums">{s.value}</dd>
                </div>
              </div>
              {s.percent !== undefined && (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${s.percent}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel id="activity-title" title="Weekly activity" icon={Activity}>
          <ActivityChart data={report.activity} />
        </Panel>
        <Panel id="history-title" title="Skill history" icon={LineChart}>
          {report.history.length ? (
            <SkillHistoryChart series={report.history} targets={targets} />
          ) : (
            <Placeholder text="No skill measurements yet." href="/assessment" cta="Take the assessment" />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel id="improve-title" title="Change since first measurement" icon={TrendingUp}>
          {report.improvements.length ? (
            <ul className="grid gap-1.5 text-sm">
              {report.improvements.map((i) => (
                <li key={i.skillId} className="flex items-center justify-between gap-4 rounded-md bg-muted/50 px-2.5 py-1.5">
                  <span className="truncate">{i.skillName}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground">
                      {Math.round(i.first)} to {Math.round(i.latest)}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-xs font-semibold",
                        i.delta > 0 ? "bg-strong/12 text-strong" : i.delta < 0 ? "bg-beginner/10 text-beginner" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i.delta > 0 ? "+" : ""}
                      {Math.round(i.delta)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder
              text="Take a follow-up assessment to see how your skills have changed. Comparisons need at least two measurements."
              href="/assessment"
              cta="Reassess"
            />
          )}
        </Panel>

        <Panel
          id="latest-title"
          title="Latest assessment"
          icon={ClipboardCheck}
          link={latest ? { href: `/assessment/${latest.id}`, label: "View results" } : undefined}
        >
          {latest ? (
            <div className="flex items-center gap-4">
              <p className="font-heading text-4xl font-semibold leading-none tabular-nums">
                {formatScore(latest.total_score)}
                <span className="text-lg text-muted-foreground">/100</span>
              </p>
              <p className="text-sm leading-snug text-muted-foreground">
                {latest.kind === "follow_up" ? "Follow-up" : "Initial"} assessment on {formatDate(latest.submitted_at!)}.
              </p>
            </div>
          ) : (
            <Placeholder text="None submitted yet." href="/assessment" cta="Take the assessment" />
          )}
          {report.nextTask && (
            <Link
              href={`/roadmap/tasks/${report.nextTask.id}`}
              className="group mt-3 flex items-center gap-3 rounded-lg border border-primary/25 bg-accent/60 p-3 outline-none transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <PlayCircle className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Suggested next task</span>
                <span className="block truncate font-medium text-primary">{report.nextTask.title}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
        </Panel>
      </div>

      {report.gap.state === "ready" && report.gap.analysis.priorities.length > 0 && (
        <div className="mt-4">
          <Panel id="gaps-title" title="Current skill gaps" icon={Target} link={{ href: "/skill-gap", label: "All skills" }}>
            <SkillGapList skills={report.gap.analysis.priorities.slice(0, 5)} />
          </Panel>
        </div>
      )}
    </>
  );
}

function Panel({
  id,
  title,
  icon: Icon,
  link,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("surface", "p-4 sm:p-5")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
            <Icon className="size-4.5" aria-hidden />
          </span>
          <h2 id={id} className="truncate font-semibold">
            {title}
          </h2>
        </div>
        {link && (
          <Link
            href={link.href}
            className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {link.label}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-accent/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-snug text-muted-foreground">{text}</p>
      <Link href={href} className={cn(buttonVariants({ size: "sm" }), "shrink-0 self-start sm:self-auto")}>
        {cta}
      </Link>
    </div>
  );
}
