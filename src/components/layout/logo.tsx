import { cn } from "@/lib/utils";

/** Wordmark: a gauge with its target tick, the product's core visual idea. */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <svg viewBox="0 0 28 16" className="h-4 w-7" aria-hidden>
        <rect x="0" y="5" width="28" height="6" rx="3" className={inverted ? "fill-white/20" : "fill-muted-foreground/20"} />
        <rect x="0" y="5" width="15" height="6" rx="3" className={inverted ? "fill-white" : "fill-primary"} />
        <rect x="20" y="1" width="2.5" height="14" rx="1.25" className="fill-target" />
      </svg>
      <span className="font-heading text-lg tracking-tight">SkillBridge</span>
    </span>
  );
}
