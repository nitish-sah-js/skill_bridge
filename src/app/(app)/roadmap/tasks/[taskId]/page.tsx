import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Layers,
  ListOrdered,
  Lock,
  Sparkles,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/features/auth/session";
import { getTask } from "@/features/roadmap/service";
import { AppError } from "@/lib/api/errors";
import { uuidParam } from "@/lib/api/response";
import { PageHeader } from "@/components/layout/page-header";
import { TaskStatusPanel } from "@/components/roadmap/task-status-control";
import { AskMentorButton } from "@/components/mentor/ask-mentor-button";
import { StartAssessmentButton } from "@/components/careers/career-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TASK_STATUS_LABEL, TASK_TYPE_LABEL, formatDate, formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/database";

export const metadata: Metadata = { title: "Learning task" };

const pill = "rounded-full border px-2 py-0.5 text-[11px] font-medium";
const resourceLink =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-primary outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";
const STATUS_PILL: Record<TaskStatus, string> = {
  not_started: "border-border bg-muted text-muted-foreground",
  in_progress: "border-primary/50 bg-primary/15 text-primary",
  needs_review: "border-developing/50 bg-developing/15 text-developing",
  completed: "border-strong/50 bg-strong/15 text-strong",
};

function MetaItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="leading-snug font-medium">{value}</dd>
      </div>
    </div>
  );
}

export default async function TaskPage({ params }: PageProps<"/roadmap/tasks/[taskId]">) {
  const { taskId } = await params;
  const { user, supabase } = await requireUser(`/roadmap/tasks/${taskId}`);
  if (!uuidParam.safeParse(taskId).success) notFound();
  const { task, week, roadmap, blockers, resources } = await getTask(supabase, user.id, taskId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const archived = roadmap.status === "archived";

  return (
    <>
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/roadmap" />}>Roadmap</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Week {week.week_number}</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-60 truncate">{task.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader title={task.title} description={week.title} actions={!archived && <AskMentorButton taskId={task.id} title={task.title} />} />

      {archived && (
        <Alert className="mb-4">
          <Lock />
          <AlertDescription>This task is from an archived roadmap and is read-only.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-4">
          <section className={cn("surface", "p-4")}>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className={cn(pill, STATUS_PILL[task.status])}>{TASK_STATUS_LABEL[task.status]}</span>
              <span className={cn(pill, "border-primary/50 bg-primary/15 text-primary")}>{TASK_TYPE_LABEL[task.task_type]}</span>
              {task.is_stretch && <span className={cn(pill, "border-primary/50 bg-primary/15 text-primary")}>Stretch</span>}
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {formatMinutes(task.estimated_minutes)}
              </span>
            </div>
            <p className="leading-snug">{task.description}</p>
            <div className="mt-3 flex gap-3 rounded-lg border border-primary/30 bg-accent/30 p-3">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30"
                aria-hidden
              >
                <Target className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Completion criteria</p>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{task.completion_criteria}</p>
              </div>
            </div>
          </section>

          {blockers.length > 0 && task.status !== "completed" && (
            <Alert className="border-developing/40 bg-developing/10">
              <ListOrdered className="text-developing" />
              <AlertDescription>
                Recommended first:{" "}
                {blockers.map((b, i) => (
                  <span key={b.id}>
                    {i > 0 && ", "}
                    <Link href={`/roadmap/tasks/${b.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {b.title}
                    </Link>
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {task.task_type === "assessment" ? (
            <section className={cn("surface", "flex flex-col gap-3 p-4 sm:flex-row sm:items-center")}>
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30"
                aria-hidden
              >
                <ClipboardCheck className="size-5" />
              </span>
              <p className="flex-1 text-sm leading-snug text-muted-foreground">
                This task completes automatically when you submit the follow-up assessment. Your new results are added to
                your skill history and update your gaps.
              </p>
              {task.status !== "completed" && !archived && (
                <StartAssessmentButton careerId={roadmap.career_id} label="Start follow-up assessment" />
              )}
            </section>
          ) : (
            !archived && (
              <section aria-labelledby="progress-title">
                <h2 id="progress-title" className="mb-2 font-semibold">
                  Your progress
                </h2>
                <TaskStatusPanel
                  taskId={task.id}
                  status={task.status}
                  actualMinutes={task.actual_minutes}
                  notes={task.notes}
                  isAssessment={false}
                />
              </section>
            )
          )}
        </div>

        <aside className="grid content-start gap-3">
          <dl className={cn("surface", "grid gap-3 p-4 text-sm")}>
            <MetaItem icon={CircleDot} label="Status" value={TASK_STATUS_LABEL[task.status]} />
            <MetaItem icon={Layers} label="Type" value={`${TASK_TYPE_LABEL[task.task_type]}${task.is_stretch ? " (stretch)" : ""}`} />
            {task.skillName && <MetaItem icon={Sparkles} label="Skill" value={task.skillName} />}
            <MetaItem icon={Clock} label="Estimated time" value={formatMinutes(task.estimated_minutes)} />
            {task.actual_minutes !== null && <MetaItem icon={Timer} label="Time spent" value={formatMinutes(task.actual_minutes)} />}
            {task.completed_at && <MetaItem icon={CheckCircle2} label="Completed" value={formatDate(task.completed_at)} />}
          </dl>

          {(task.resource_url || resources.length > 0) && (
            <section aria-labelledby="res-title" className={cn("surface", "p-4")}>
              <h2 id="res-title" className="flex items-center gap-2 font-semibold">
                <BookOpen className="size-4 text-primary" aria-hidden />
                Resources
              </h2>
              <ul className="mt-2 grid gap-1 text-sm">
                {task.resource_url && (
                  <li>
                    <a href={task.resource_url} target="_blank" rel="noreferrer" className={resourceLink}>
                      <span className="min-w-0 flex-1 truncate">Task resource</span>
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    </a>
                  </li>
                )}
                {resources.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noreferrer" className={resourceLink}>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="flex gap-2 px-1 text-xs leading-snug text-muted-foreground">
            <Bot className="size-4 shrink-0 text-primary" aria-hidden />
            Completing tasks tracks your progress. Skill scores change only when you take an assessment.
          </p>
        </aside>
      </div>
    </>
  );
}
