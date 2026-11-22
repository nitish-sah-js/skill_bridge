"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; updated_at: string };

export function ConversationList({ conversations, activeId }: { conversations: Item[]; activeId: string | null }) {
  const router = useRouter();

  async function remove(id: string) {
    try {
      await apiFetch(`/api/mentor/conversations/${id}`, { method: "DELETE" });
      toast.success("Conversation deleted");
      if (id === activeId) router.push("/mentor");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not delete the conversation.");
    }
  }

  return (
    <nav
      aria-label="Conversations"
      className="grid gap-2 surface p-2"
    >
      <Link href="/mentor" className={cn(buttonVariants(), "w-full justify-start")}>
        <Plus /> New conversation
      </Link>
      {conversations.length === 0 ? (
        <p className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
          <MessageSquare className="size-4 text-primary/70" aria-hidden />
          No conversations yet.
        </p>
      ) : (
        <ul className="grid max-h-[60dvh] gap-0.5 overflow-y-auto">
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id} className="group flex items-center gap-1">
                <Link
                  href={`/mentor/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
                    active && "border-primary bg-accent font-medium text-accent-foreground",
                  )}
                >
                  <MessageSquare className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  <span className="truncate">{c.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  aria-label={`Delete conversation: ${c.title}`}
                  className="rounded p-1.5 text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
