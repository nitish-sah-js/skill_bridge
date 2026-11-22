"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, Loader2, Play, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { openTestWindow, testWindowUrl } from "@/features/assessments/test-window";

type ButtonSize = "default" | "sm" | "lg";

export function SetTargetCareerButton({
  careerId,
  careerName,
  isTarget,
  size = "default",
  variant = "outline",
  className,
}: {
  careerId: string;
  careerName: string;
  isTarget: boolean;
  size?: ButtonSize;
  variant?: "default" | "outline";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (isTarget) {
    return (
      <Button variant="outline" size={size} disabled className={cn("border-primary/50 text-primary disabled:opacity-100", className)}>
        <CircleCheck aria-hidden /> Your target career
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiFetch("/api/profile", { method: "PATCH", json: { target_career_id: careerId } });
          toast.success(`${careerName} is now your target career`);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof ApiClientError ? e.message : "Could not update your target career.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Target aria-hidden />}
      {busy ? "Saving…" : "Set as target career"}
    </Button>
  );
}

/** Start (or resume) an assessment in the separate proctored test window. */
export function StartAssessmentButton({
  careerId,
  label = "Start assessment",
  variant = "default",
  size = "default",
  className,
}: {
  careerId: string;
  label?: string;
  variant?: "default" | "outline";
  size?: ButtonSize;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Opened before the request so the browser does not treat it as an unsolicited popup.
        const testWindow = openTestWindow();
        try {
          const { attemptId } = await apiFetch<{ attemptId: string }>("/api/assessments", {
            method: "POST",
            json: { careerId },
          });
          if (testWindow) testWindow.location.href = testWindowUrl(attemptId);
          else toast.error("Your browser blocked the test window. Allow pop-ups for this site, then use Open test window.");
          router.push(`/assessment/${attemptId}`);
        } catch (e) {
          testWindow?.close();
          toast.error(e instanceof ApiClientError ? e.message : "Could not start the assessment.");
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
      {busy ? "Preparing…" : label}
    </Button>
  );
}
