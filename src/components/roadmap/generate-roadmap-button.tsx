"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/** Generate a roadmap. With `regenerate`, confirm first because the current plan is archived. */
export function GenerateRoadmapButton({ regenerate = false }: { regenerate?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      await apiFetch("/api/roadmaps/generate", { method: "POST" });
      toast.success(regenerate ? "Roadmap regenerated" : "Roadmap generated");
      setOpen(false);
      router.push("/roadmap");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not generate a roadmap.");
    } finally {
      setBusy(false);
    }
  }

  if (!regenerate) {
    return (
      <Button size="lg" onClick={() => void generate()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "Generating…" : "Generate my roadmap"}
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw /> Regenerate
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate your roadmap?</AlertDialogTitle>
            <AlertDialogDescription>
              A new plan is built from your latest skill gaps and weekly hours. The current plan is archived. Tasks you
              completed stay in your progress history and won&apos;t be scheduled again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button onClick={() => void generate()} disabled={busy}>
              {busy ? "Generating…" : "Regenerate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
