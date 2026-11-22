"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-t-destructive/50 bg-card p-5 shadow-[0_8px_24px_-16px_rgb(0_0_0/0.25)] sm:flex-row sm:items-center sm:gap-4 dark:shadow-[0_12px_32px_-14px_rgb(0_0_0/0.85)]">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/30">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <div className="flex-1">
        <h1 className="text-lg font-semibold">This page could not load</h1>
        <p className="mt-1 max-w-prose text-sm leading-snug text-muted-foreground">
          Your data is safe. This is usually a temporary connection problem. Try again, and if it keeps happening, sign out
          and back in.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Dashboard
        </Link>
      </div>
    </div>
  );
}
