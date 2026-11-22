import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSkillGapReport } from "@/features/skill-gap/service";
import { isMentorConfigured } from "@/lib/ai/provider";
import { listConversations } from "./service";

/** Shared data for the mentor pages: conversation list and personalised starter questions. */
export async function getMentorPageData(supabase: SupabaseClient<Database>, userId: string) {
  const [conversations, gap] = await Promise.all([listConversations(supabase, userId), getSkillGapReport(supabase, userId)]);
  const careerName = gap.state === "ready" ? gap.career.name : null;
  const priorities = gap.state === "ready" ? gap.analysis.priorities : [];
  const fallback = gap.state === "ready" ? gap.career.skills : [];

  const first = priorities[0]?.name ?? fallback[0]?.name;
  const second = priorities[1]?.name ?? fallback[1]?.name;
  const suggestions = [
    first && careerName && `Why is ${first} a priority for becoming a ${careerName}?`,
    second && `Explain the basics of ${second} to me as a beginner.`,
    first && `Give me a short ${first} exercise at my current level.`,
    gap.state === "ready" && gap.latestAttempt && "Help me understand the mistakes in my practical challenge.",
  ].filter((s): s is string => Boolean(s));

  return {
    conversations: conversations.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at })),
    careerName,
    suggestions: suggestions.length ? suggestions : ["What should I learn first for my target career?"],
    configured: isMentorConfigured(),
  };
}
