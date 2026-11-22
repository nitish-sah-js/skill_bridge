"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/** Opens a mentor conversation that carries this task as context. */
export function AskMentorButton({ taskId, title }: { taskId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const convo = await apiFetch<{ id: string }>("/api/mentor/conversations", {
            method: "POST",
            json: { taskId, title: `Help with: ${title}`.slice(0, 120) },
          });
          router.push(`/mentor/${convo.id}`);
        } catch (e) {
          toast.error(e instanceof ApiClientError ? e.message : "Could not open the mentor.");
          setBusy(false);
        }
      }}
    >
      <Bot /> Ask the mentor
    </Button>
  );
}
