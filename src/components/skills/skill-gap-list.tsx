import type { SkillGap } from "@/features/skill-gap/engine";
import { GapGauge } from "./gap-gauge";
import { SkillStatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";

/** Status-colored left edge and tint so each row stands apart from its card. */
const ROW_ACCENT: Record<SkillGap["status"], string> = {
  strong: "border-l-strong bg-strong/10",
  developing: "border-l-developing bg-developing/10",
  beginner: "border-l-beginner bg-beginner/10",
  not_assessed: "border-l-unassessed bg-unassessed/10",
};

export function SkillGapList({ skills, showPriority }: { skills: SkillGap[]; showPriority?: boolean }) {
  return (
    <ul className="grid gap-3">
      {skills.map((s, index) => (
        <li key={s.skillId} className={cn("grid gap-3 rounded-lg border border-l-4 border-border px-4 py-3.5", ROW_ACCENT[s.status])}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="flex min-w-0 items-center gap-2 font-medium leading-snug">
              {showPriority && (
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-primary/30 tabular-nums"
                >
                  {index + 1}
                </span>
              )}
              {s.name}
            </span>
            <span className="flex items-center gap-2.5 text-sm">
              <span className="tabular-nums text-muted-foreground">
                {s.currentProficiency === null ? "Not measured" : `${Math.round(s.currentProficiency)}`} / target {s.requiredProficiency}
                {s.rawGap !== null && s.rawGap > 0 && <span className="font-medium text-foreground"> · gap {Math.round(s.rawGap)}</span>}
              </span>
              {showPriority && s.priorityScore !== null && (
                <span
                  className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary"
                  title="Priority score (0-100)"
                >
                  P{Math.round(s.priorityScore)}
                </span>
              )}
              <SkillStatusBadge status={s.status} />
            </span>
          </div>
          <GapGauge current={s.currentProficiency} required={s.requiredProficiency} status={s.status} label={s.name} />
        </li>
      ))}
    </ul>
  );
}
