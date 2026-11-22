"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Maximize, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssessmentRunner } from "@/components/assessment/assessment-runner";
import { PROCTORING_CONFIG } from "@/config/engine";
import { createStrikeTracker, VIOLATION_LABELS } from "@/features/assessments/proctoring";
import type { InProgressAttempt, ViolationResult } from "@/features/assessments/service";
import { TEST_FINISHED_MESSAGE } from "@/features/assessments/test-window";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { ViolationType } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

type Phase = "intro" | "running" | "warning" | "finished";
type Draft = { answers: Record<string, number | null>; practicals: Record<string, string> };

const MAX = PROCTORING_CONFIG.maxWarnings;

const RULES = [
  "Stay in this window until you submit. Switching tabs or apps counts as a rule break.",
  "Stay in fullscreen.",
  "Don't refresh or close this window.",
  "Don't take screenshots. Copy, paste and right-click are turned off.",
];

async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch {
    // Some browsers refuse fullscreen; leaving the window is still detected.
  }
}

/**
 * The assessment inside the separate test window: fullscreen, rule breaks detected and
 * reported to the server, a warning for each of the first three, automatic submission on
 * the fourth (decided server-side). Browsers cannot truly block tabs or screenshots; this
 * detects, warns and counts.
 */
export function ProctoredTest({ attempt }: { attempt: InProgressAttempt }) {
  const router = useRouter();
  const storageKey = `skillbridge:proctor:${attempt.id}`;
  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(attempt.violationCount);
  const [lastType, setLastType] = useState<ViolationType | null>(null);
  const [finishReason, setFinishReason] = useState<"submitted" | "auto">("submitted");
  const [reportError, setReportError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(PROCTORING_CONFIG.closeDelaySeconds);

  const phaseRef = useRef<Phase>("intro");
  const tracker = useRef(createStrikeTracker());
  const draft = useRef<Draft>({ answers: attempt.draftAnswers, practicals: attempt.draftPracticals });
  const pending = useRef<ViolationType[]>([]);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const finish = useCallback(
    (reason: "submitted" | "auto") => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      setFinishReason(reason);
      go("finished");
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      window.opener?.postMessage({ type: TEST_FINISHED_MESSAGE, attemptId: attempt.id }, window.location.origin);
    },
    [attempt.id, go, storageKey],
  );

  const send = useCallback(
    async (type: ViolationType) => {
      try {
        const result = await apiFetch<ViolationResult>(`/api/assessments/${attempt.id}/violations`, {
          method: "POST",
          json: { type, ...draft.current },
        });
        setReportError(null);
        setCount(result.count);
        if (result.outcome === "auto_submitted") finish("auto");
      } catch (e) {
        if (e instanceof ApiClientError && e.code === "CONFLICT") return finish("auto");
        // Keep it and retry when the connection is back; the warning still shows now.
        pending.current.push(type);
        setReportError("Couldn't reach the server. This rule break will be sent when you're back online.");
      }
    },
    [attempt.id, finish],
  );

  const strike = useCallback(
    (type: ViolationType | null) => {
      if (!type || phaseRef.current === "finished") return;
      setLastType(type);
      setCount((c) => c + 1);
      go("warning");
      void send(type);
    },
    [go, send],
  );

  // A reload while the test was running counts once the page is back. The ref keeps
  // React's development double-invoke from reporting it twice.
  const reloadChecked = useRef(false);
  useEffect(() => {
    if (reloadChecked.current) return;
    reloadChecked.current = true;
    let wasRunning = false;
    try {
      wasRunning = sessionStorage.getItem(storageKey) === "running";
    } catch {}
    if (wasRunning) {
      setLastType("reload");
      void send("reload");
      setCount((c) => c + 1);
    }
  }, [send, storageKey]);

  useEffect(() => {
    if (phase !== "running" && phase !== "warning") return;
    const t = tracker.current;
    const now = () => Date.now();

    const onVisibility = () => {
      if (document.hidden) t.away(now());
      else {
        t.back(now());
        strike(t.check(now()));
      }
    };
    const onBlur = () => t.away(now());
    const onFocus = () => {
      t.back(now());
      strike(t.check(now()));
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement && phaseRef.current === "running") strike(t.instant("fullscreen_exit"));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const reload = e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
      if (reload) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") strike(t.instant("screenshot_key"));
    };
    const block = (e: Event) => e.preventDefault();
    const blockSelection = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("textarea, input")) return;
      e.preventDefault();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onOnline = () => {
      const queued = pending.current.splice(0);
      queued.forEach((type) => void send(type));
    };
    const timer = window.setInterval(() => strike(t.check(now())), 250);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("selectstart", blockSelection);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("selectstart", blockSelection);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
    };
  }, [phase, send, strike]);

  // Close the window a few seconds after the test ends; fall back to the results page.
  useEffect(() => {
    if (phase !== "finished") return;
    if (secondsLeft <= 0) {
      window.close();
      const fallback = window.setTimeout(() => router.replace(`/assessment/${attempt.id}`), 300);
      return () => window.clearTimeout(fallback);
    }
    const tick = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(tick);
  }, [phase, secondsLeft, attempt.id, router]);

  async function begin() {
    await enterFullscreen();
    try {
      sessionStorage.setItem(storageKey, "running");
    } catch {}
    tracker.current.acknowledge();
    go("running");
  }

  async function returnToTest() {
    await enterFullscreen();
    tracker.current.acknowledge();
    go("running");
  }

  const onDraftChange = useCallback((next: Draft) => {
    draft.current = next;
  }, []);

  const warningsUsed = Math.min(count, MAX);

  if (phase === "finished") {
    return (
      <CenteredCard>
        <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <CircleCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">
          {finishReason === "auto" ? "Your test was submitted automatically" : "Assessment submitted"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {finishReason === "auto"
            ? `You broke the test rules ${MAX + 1} times, so your answers were saved and submitted.`
            : "Your answers have been scored."}{" "}
          Your results are in the SkillBridge tab.
        </p>
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          This window closes in {Math.max(secondsLeft, 0)} s.
        </p>
      </CenteredCard>
    );
  }

  if (phase === "intro") {
    return (
      <CenteredCard>
        <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Before you begin</h1>
        <p className="mt-1 text-muted-foreground">
          {attempt.career.name} {attempt.kind === "follow_up" ? "follow-up " : ""}assessment
        </p>
        <ul className="mt-5 grid gap-2.5 text-sm">
          {RULES.map((rule) => (
            <li key={rule} className="flex gap-2.5">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {rule}
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-lg border border-developing/40 bg-developing/10 p-3 text-sm leading-snug">
          Each rule break shows a warning. After {MAX} warnings, the next rule break saves your answers and submits the
          test automatically.
          {count > 0 && (
            <strong className="mt-1 block">
              {lastType === "reload" ? "Reloading the test counted as a rule break. " : ""}
              Warnings used: {warningsUsed} of {MAX}.
            </strong>
          )}
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={() => void begin()}>
          <Maximize aria-hidden /> Begin test in fullscreen
        </Button>
      </CenteredCard>
    );
  }

  return (
    <div className="min-h-dvh select-none">
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-primary/20 bg-background/90 px-4 backdrop-blur sm:px-6">
        <span className="truncate text-sm font-medium">{attempt.career.name} assessment</span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
            warningsUsed === 0 ? "border-primary/40 text-primary" : "border-developing/50 bg-developing/10 text-developing",
          )}
        >
          <ShieldAlert className="size-3.5" aria-hidden />
          Warnings: {warningsUsed} of {MAX}
        </span>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <AssessmentRunner attempt={attempt} onDraftChange={onDraftChange} onSubmitted={() => finish("submitted")} />
      </main>

      <AlertDialog open={phase === "warning"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {count > MAX ? "Submitting your test" : `Warning ${warningsUsed} of ${MAX}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lastType ? VIOLATION_LABELS[lastType] : "A test rule was broken."}{" "}
              {count > MAX
                ? "That was one rule break too many. Your answers are being saved and submitted."
                : count === MAX
                  ? "This is your last warning. The next rule break submits your test automatically."
                  : `${MAX - count} warning${MAX - count === 1 ? "" : "s"} left before your test is submitted automatically.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {reportError && <p className="text-sm text-destructive">{reportError}</p>}
          <AlertDialogFooter>
            {count > MAX ? (
              <Button disabled>
                <Loader2 className="animate-spin" aria-hidden /> Submitting…
              </Button>
            ) : (
              <Button onClick={() => void returnToTest()}>Return to test</Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="surface w-full max-w-lg p-6 sm:p-8">{children}</div>
    </main>
  );
}
