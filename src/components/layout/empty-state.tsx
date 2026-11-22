import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-primary/35 bg-linear-to-br from-accent/60 to-card p-5 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {children && <div className="mt-1 max-w-prose text-muted-foreground">{children}</div>}
      </div>
      {action && <div className="sm:ml-auto">{action}</div>}
    </div>
  );
}
