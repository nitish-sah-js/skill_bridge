import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConversationList } from "./conversation-list";

export function MentorLayout({
  conversations,
  activeId,
  configured,
  children,
}: {
  conversations: { id: string; title: string; updated_at: string }[];
  activeId: string | null;
  configured: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[250px_1fr] lg:gap-5">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <ConversationList conversations={conversations} activeId={activeId} />
      </aside>
      <div className="min-w-0 max-w-3xl">
        {!configured && (
          <Alert className="mb-4 border-developing/40 bg-developing/10">
            <AlertTitle>The AI mentor isn&apos;t configured</AlertTitle>
            <AlertDescription>
              This server has no GROQ_API_KEY, so questions can&apos;t be answered. Everything else in SkillBridge works
              without it.
            </AlertDescription>
          </Alert>
        )}
        {children}
      </div>
    </div>
  );
}
