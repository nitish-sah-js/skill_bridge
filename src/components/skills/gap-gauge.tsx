import { cn } from "@/lib/utils";

type Status = "strong" | "developing" | "beginner" | "not_assessed";

const FILL: Record<Status, string> = {
  strong: "bg-strong",
  developing: "bg-developing",
  beginner: "bg-beginner",
  not_assessed: "bg-unassessed",
};

/**
 * Current proficiency as a filled bar, the required level as an amber tick, and the
 * remaining gap hatched. Unknown proficiency renders as a fully hatched track.
 */
export function GapGauge({
  current,
  required,
  status,
  label,
  size = "md",
  className,
}: {
  current: number | null;
  required: number;
  status: Status;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const height = size === "sm" ? "h-2" : "h-3";
  const value = current === null ? null : Math.max(0, Math.min(100, current));
  const description =
    value === null
      ? `${label}: not assessed yet, target ${required}`
      : `${label}: ${Math.round(value)} of 100, target ${required}${value < required ? `, gap ${Math.round(required - value)}` : ", target met"}`;

  return (
    <div
      role="img"
      aria-label={description}
      className={cn("relative w-full overflow-visible rounded-full bg-muted ring-1 ring-inset ring-border/60", height, className)}
    >
      {value === null ? (
        <div className="hatch absolute inset-0 rounded-full text-unassessed" />
      ) : (
        <>
          <div className={cn("absolute inset-y-0 left-0 rounded-full", FILL[status])} style={{ width: `${value}%` }} />
          {value < required && (
            <div
              className="hatch absolute inset-y-0 text-beginner/80"
              style={{ left: `${value}%`, width: `${required - value}%` }}
            />
          )}
        </>
      )}
      <div
        aria-hidden
        className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-target"
        style={{ left: `calc(${required}% - 1px)` }}
      />
    </div>
  );
}
