import type { Metadata } from "next";
import { requireUser } from "@/features/auth/session";
import { getMentorPageData } from "@/features/mentor/page-data";
import { PageHeader } from "@/components/layout/page-header";
import { MentorLayout } from "@/components/mentor/mentor-layout";
import { MentorChat } from "@/components/mentor/mentor-chat";

export const metadata: Metadata = { title: "AI mentor" };

export default async function MentorPage() {
  const { user, supabase } = await requireUser("/mentor");
  const data = await getMentorPageData(supabase, user.id);
  return (
    <>
      <PageHeader title="AI mentor" description="Explanations, practice and debugging help tuned to your measured level." />
      <MentorLayout conversations={data.conversations} activeId={null} configured={data.configured}>
        <MentorChat conversationId={null} initialMessages={[]} suggestions={data.suggestions} careerName={data.careerName} />
      </MentorLayout>
    </>
  );
}
