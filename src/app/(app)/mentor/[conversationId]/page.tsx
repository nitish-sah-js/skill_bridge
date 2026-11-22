import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { getConversation } from "@/features/mentor/service";
import { getMentorPageData } from "@/features/mentor/page-data";
import { AppError } from "@/lib/api/errors";
import { uuidParam } from "@/lib/api/response";
import { PageHeader } from "@/components/layout/page-header";
import { MentorLayout } from "@/components/mentor/mentor-layout";
import { MentorChat } from "@/components/mentor/mentor-chat";

export const metadata: Metadata = { title: "AI mentor" };

export default async function ConversationPage({ params }: PageProps<"/mentor/[conversationId]">) {
  const { conversationId } = await params;
  const { user, supabase } = await requireUser(`/mentor/${conversationId}`);
  if (!uuidParam.safeParse(conversationId).success) notFound();

  const [{ conversation, messages }, data] = await Promise.all([
    getConversation(supabase, user.id, conversationId).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
    getMentorPageData(supabase, user.id),
  ]);

  let taskTitle: string | null = null;
  if (conversation.context_task_id) {
    const { data: task } = await supabase
      .from("learning_tasks")
      .select("title")
      .eq("id", conversation.context_task_id)
      .eq("user_id", user.id)
      .maybeSingle();
    taskTitle = task?.title ?? null;
  }

  return (
    <>
      <PageHeader
        title={conversation.title}
        description={
          taskTitle ? (
            <>
              About your task{" "}
              <Link href={`/roadmap/tasks/${conversation.context_task_id}`} className="text-primary underline-offset-4 hover:underline">
                {taskTitle}
              </Link>
              .
            </>
          ) : (
            "AI mentor conversation"
          )
        }
      />
      <MentorLayout conversations={data.conversations} activeId={conversation.id} configured={data.configured}>
        <MentorChat
          key={conversation.id}
          conversationId={conversation.id}
          taskId={conversation.context_task_id ?? undefined}
          initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
          suggestions={taskTitle ? [`I'm stuck on "${taskTitle}". Where should I start?`, ...data.suggestions.slice(0, 2)] : data.suggestions}
          careerName={data.careerName}
        />
      </MentorLayout>
    </>
  );
}
