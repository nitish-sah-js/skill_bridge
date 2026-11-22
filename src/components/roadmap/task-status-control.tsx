"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Circle, CircleDot, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { TaskStatus } from "@/types/database";
import { cn } from "@/lib/utils";

async function patchTask(taskId: string, body: Record<string, unknown>) {
  return apiFetch(`/api/learning-tasks/${taskId}`, { method: "PATCH", json: body });
}

/** Round toggle used in task lists: not started → in progress → completed. */
export function TaskCheck({ taskId, status, title, disabled }: { taskId: string; status: TaskStatus; title: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<TaskStatus | null>(null);
  const shown = pending ?? status;
  const next: TaskStatus = shown === "completed" ? "not_started" : shown === "in_progress" || shown === "needs_review" ? "completed" : "in_progress";
  const label =
    shown === "completed" ? `Mark "${title}" as not started` : next === "completed" ? `Mark "${title}" as completed` : `Start "${title}"`;

  return (
    <button
      type="button"
      disabled={disabled || pending !== null}
      aria-label={label}
      title={disabled ? "Completes automatically when you submit the follow-up assessment" : label}
      onClick={async () => {
        setPending(next);
        try {
          await patchTask(taskId, { status: next });
          router.refresh();
        } catch (e) {
          toast.error(e instanceof ApiClientError ? e.message : "Could not update the task.");
        } finally {
          setPending(null);
        }
      }}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border-2 outline-none transition-all hover:scale-110 disabled:hover:scale-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
        shown === "completed" && "border-strong bg-strong text-background",
        shown === "in_progress" && "border-primary bg-primary/15 text-primary",
        shown === "needs_review" && "border-developing bg-developing/15 text-developing",
        shown === "not_started" && "border-muted-foreground/40 hover:border-primary hover:bg-primary/10",
      )}
    >
      {shown === "completed" ? <Check className="size-3.5" /> : shown === "not_started" ? null : <CircleDot className="size-3.5" />}
    </button>
  );
}

/** Full status controls with notes and time spent, for the task detail page. */
export function TaskStatusPanel({
  taskId,
  status,
  actualMinutes,
  notes,
  isAssessment,
}: {
  taskId: string;
  status: TaskStatus;
  actualMinutes: number | null;
  notes: string | null;
  isAssessment: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [minutes, setMinutes] = useState(actualMinutes?.toString() ?? "");
  const [text, setText] = useState(notes ?? "");

  async function update(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await patchTask(taskId, body);
      toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not update the task.");
    } finally {
      setBusy(false);
    }
  }

  const minutesValue = minutes.trim() === "" ? null : Number(minutes);
  const minutesInvalid = minutesValue !== null && (!Number.isInteger(minutesValue) || minutesValue < 0 || minutesValue > 1440);

  return (
    <div className="grid gap-3">
      {!isAssessment && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent/30 p-3">
          {status !== "completed" && (
            <Button size="lg" disabled={busy} onClick={() => void update({ status: "completed" }, "Task completed")}>
              <Check /> Mark completed
            </Button>
          )}
          {status !== "in_progress" && status !== "completed" && (
            <Button size="lg" variant="outline" disabled={busy} onClick={() => void update({ status: "in_progress" }, "Task started")}>
              <Circle /> Start task
            </Button>
          )}
          {status !== "needs_review" && (
            <Button variant="outline" disabled={busy} onClick={() => void update({ status: "needs_review" }, "Marked for review")}>
              <CircleDot /> Needs review
            </Button>
          )}
          {status !== "not_started" && (
            <Button variant="ghost" disabled={busy} onClick={() => void update({ status: "not_started" }, "Task reset")}>
              <RotateCcw /> Reset
            </Button>
          )}
        </div>
      )}
      <form
        className="grid gap-3 surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (minutesInvalid) return;
          void update({ actualMinutes: minutesValue, notes: text.trim() === "" ? null : text.trim() }, "Saved");
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="actual-minutes" className="text-sm font-medium">
            Time spent (minutes) <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="actual-minutes"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-invalid={minutesInvalid}
            className="h-9 w-32 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          />
          {minutesInvalid && <p className="text-sm text-destructive">Enter whole minutes between 0 and 1440.</p>}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="task-notes" className="text-sm font-medium">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="task-notes"
            rows={3}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={busy || minutesInvalid}>
            <Save /> Save notes
          </Button>
        </div>
      </form>
    </div>
  );
}
