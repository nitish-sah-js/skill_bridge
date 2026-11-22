import Link from "next/link";
import { BookOpen, ChevronRight, ClipboardCheck, Clock, Dumbbell, FolderGit2, Sparkles, type LucideIcon } from "lucide-react";
import type { RoadmapTask } from "@/features/roadmap/service";
import type { TaskType } from "@/types/database";
import { TASK_STATUS_LABEL, TASK_TYPE_LABEL, formatMinutes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { TaskCheck } from "./task-status-control";

const TYPE_ICON: Record<TaskType, LucideIcon> = {
  learn: BookOpen,
  practice: Dumbbell,
  project: FolderGit2,
  assessment: ClipboardCheck,
};

export function TaskRow({ task, readOnly }: { task: RoadmapTask; readOnly?: boolean }) {
  const TypeIcon = TYPE_ICON[task.task_type];
  const completed = task.status === "completed";
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <TaskCheck taskId={task.id} status={task.status} title={task.title} disabled={readOnly || task.task_type === "assessment"} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/roadmap/tasks/${task.id}`}
          className={cn(
            "text-sm leading-snug font-medium underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:underline",
            completed && "text-muted-foreground line-through decoration-muted-foreground/50",
          )}
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TypeIcon className="size-3.5 text-primary/80" aria-hidden />
            {TASK_TYPE_LABEL[task.task_type]}
          </span>
          {task.skillName && <span>{task.skillName}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {formatMinutes(task.estimated_minutes)}
          </span>
          {task.is_stretch && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
              <Sparkles className="size-3" aria-hidden />
              Stretch
            </span>
          )}
          {task.status !== "not_started" && !completed && (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                task.status === "needs_review"
                  ? "border-developing/50 bg-developing/15 text-developing"
                  : "border-primary/50 bg-primary/15 text-primary",
              )}
            >
              {TASK_STATUS_LABEL[task.status]}
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </li>
  );
}
