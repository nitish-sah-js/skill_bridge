import { Gauge } from "lucide-react";
import type { Readiness } from "@/features/skill-gap/engine";
import { cn } from "@/lib/utils";

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Ring gauge for the readiness score; an unmeasured score renders as a dashed, empty ring. */
function ReadinessRing({ score }: { score: number | null }) {
  const value = score === null ? null : Math.max(0, Math.min(100, score));
  return (
    <div className="relative grid size-20 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 72 72" className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          className={value === null ? "stroke-unassessed/50" : "stroke-muted"}
          strokeDasharray={value === null ? "4 4" : undefined}
        />
        {value !== null && (
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={`${(value / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        )}
      </svg>
      <Gauge className={cn("size-6", value === null ? "text-muted-foreground" : "text-primary")} />
    </div>
  );
}

/** Internal readiness indicator with its coverage and limitations stated alongside it. */
export function ReadinessPanel({ readiness, compact }: { readiness: Readiness; compact?: boolean }) {
  const coveragePct = Math.round(readiness.coverage * 100);
  return (
    <div
      className={cn(
        "grid gap-3",
        !compact &&
          "surface p-4 sm:p-5",
      )}
    >
      {!compact && <h2 className="font-semibold">Career readiness</h2>}
      <div className="flex items-center gap-4">
        <ReadinessRing score={readiness.score} />
        <div className="grid gap-1.5">
          <div className="flex items-end gap-2">
            <p className="font-heading text-4xl font-semibold tabular-nums leading-none">
              {readiness.score === null ? "—" : Math.round(readiness.score)}
              {readiness.score !== null && <span className="text-xl text-muted-foreground">/100</span>}
            </p>
            {readiness.isPartial && readiness.score !== null && (
              <span className="mb-0.5 rounded-md bg-developing/12 px-1.5 py-0.5 text-xs font-medium text-developing ring-1 ring-inset ring-developing/25">
                Partial
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Skills assessed"
              aria-valuenow={coveragePct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${coveragePct}%` }} />
            </div>
            <span className="tabular-nums">{coveragePct}% coverage</span>
          </div>
        </div>
      </div>
      <p className="text-sm leading-snug">
        {readiness.score === null
          ? "No skills measured yet. Take the assessment to get a readiness indicator."
          : `Readiness indicator based on ${readiness.assessedCount} of ${readiness.totalCount} skills (${coveragePct}% of the career's weighted skills).`}
      </p>
      {!compact && (
        <p className="text-xs leading-snug text-muted-foreground">
          This is SkillBridge&apos;s internal measure: the importance-weighted share of each target you meet, capped at
          100 per skill. It only covers skills you have been assessed on, uses editable targets, and is not a prediction
          of getting hired.
        </p>
      )}
    </div>
  );
}
