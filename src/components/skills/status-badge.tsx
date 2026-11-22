import { cn } from "@/lib/utils";
import { SKILL_STATUS_LABEL } from "@/lib/utils/format";

const STYLE = {
  strong: "bg-strong/12 text-strong ring-strong/25",
  developing: "bg-developing/12 text-developing ring-developing/25",
  beginner: "bg-beginner/10 text-beginner ring-beginner/25",
  not_assessed: "bg-muted text-muted-foreground ring-border",
} as const;

const DOT = {
  strong: "bg-strong",
  developing: "bg-developing",
  beginner: "bg-beginner",
  not_assessed: "bg-unassessed",
} as const;

export function SkillStatusBadge({ status, className }: { status: keyof typeof STYLE; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", STYLE[status], className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[status])} />
      {SKILL_STATUS_LABEL[status]}
    </span>
  );
}
