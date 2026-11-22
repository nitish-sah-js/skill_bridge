"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppWindow, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isTestFinishedMessage,
  openTestWindow,
  TEST_FINISHED_MESSAGE,
  testWindowUrl,
} from "@/features/assessments/test-window";

/**
 * Shown in the main app tab while an attempt is open: the test itself runs in a separate
 * window. Refreshes to the results when that window reports the test finished.
 */
export function TestWindowPanel({ attemptId, violationCount, maxWarnings }: { attemptId: string; violationCount: number; maxWarnings: number }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && isTestFinishedMessage(e.data, attemptId)) router.refresh();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [attemptId, router]);

  return (
    <section className="surface flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
        <AppWindow className="size-5" aria-hidden />
      </span>
      <div className="flex-1">
        <h2 className="font-semibold">Your test runs in a separate window</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Answers save automatically. If you closed the test window, reopen it to continue.
          {violationCount > 0 && ` Warnings used so far: ${Math.min(violationCount, maxWarnings)} of ${maxWarnings}.`}
        </p>
        {blocked && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Your browser blocked the test window. Allow pop-ups for this site, then try again.
          </p>
        )}
      </div>
      <Button size="lg" onClick={() => setBlocked(!openTestWindow(testWindowUrl(attemptId)))}>
        Open test window
      </Button>
    </section>
  );
}

/** The test window reached after the attempt was already submitted: tell the opener and close. */
export function TestWindowClosed({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  useEffect(() => {
    window.opener?.postMessage({ type: TEST_FINISHED_MESSAGE, attemptId }, window.location.origin);
    const timer = window.setTimeout(() => {
      window.close();
      router.replace(`/assessment/${attemptId}`);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [attemptId, router]);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="surface max-w-md p-6 text-center">
        <CircleCheck className="mx-auto size-8 text-primary" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">This test has been submitted</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your results are in the SkillBridge tab.</p>
      </div>
    </main>
  );
}
