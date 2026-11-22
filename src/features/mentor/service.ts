import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ConversationRow, Database, MessageRow } from "@/types/database";
import { MENTOR_CONFIG } from "@/config/engine";
import { AppError, dbError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getChatProvider } from "@/lib/ai/provider";
import { ProviderError } from "@/lib/ai/types";
import { getProfile } from "@/features/profiles/service";
import { getSkillGapReport } from "@/features/skill-gap/service";
import { getCurrentRoadmap, toTaskLike } from "@/features/roadmap/service";
import { activeWeekNumber } from "@/features/progress/calculations";
import {
  buildMentorMessages,
  conversationTitle,
  skillsMentioned,
  wantsPracticalFeedback,
  type MentorContext,
  type MentorSkill,
} from "./prompt";

type Client = SupabaseClient<Database>;

export type MentorStreamEvent =
  | { type: "start"; userMessageId: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; conversationId: string; title: string }
  | { type: "error"; message: string };

export async function listConversations(supabase: Client, userId: string): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw dbError("list conversations", error);
  return data;
}

/** RLS-scoped read: returns only conversations owned by the signed-in user. */
export async function getConversation(supabase: Client, userId: string, conversationId: string) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw dbError("load conversation", error);
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found.");
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (msgError) throw dbError("load messages", msgError);
  return { conversation, messages };
}

export async function createConversation(
  supabase: Client,
  userId: string,
  input: { title?: string; taskId?: string },
): Promise<ConversationRow> {
  if (input.taskId) {
    const { data: task, error } = await supabase
      .from("learning_tasks")
      .select("id")
      .eq("id", input.taskId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw dbError("check task", error);
    if (!task) throw new AppError("NOT_FOUND", "Task not found.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversations")
    .insert({ user_id: userId, title: input.title ?? "New conversation", context_task_id: input.taskId ?? null })
    .select("*")
    .single();
  if (error) throw dbError("create conversation", error);
  return data;
}

export async function deleteConversation(supabase: Client, userId: string, conversationId: string) {
  const { error, count } = await supabase
    .from("conversations")
    .delete({ count: "exact" })
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) throw dbError("delete conversation", error);
  if (!count) throw new AppError("NOT_FOUND", "Conversation not found.");
}

async function enforceRateLimit(admin: Client, userId: string) {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [hour, day] = await Promise.all([
    admin.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", hourAgo),
    admin.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", dayAgo),
  ]);
  if (hour.error || day.error) throw dbError("rate limit check", hour.error ?? day.error);
  if ((hour.count ?? 0) >= MENTOR_CONFIG.rateLimit.perHour || (day.count ?? 0) >= MENTOR_CONFIG.rateLimit.perDay) {
    throw new AppError(
      "RATE_LIMITED",
      `You've reached the mentor limit (${MENTOR_CONFIG.rateLimit.perHour} questions per hour, ${MENTOR_CONFIG.rateLimit.perDay} per day). Please try again later.`,
    );
  }
}

/** Collect only the student data relevant to this question. */
async function buildContext(supabase: Client, userId: string, question: string, taskId: string | null): Promise<MentorContext> {
  const [profile, gap, roadmap] = await Promise.all([
    getProfile(supabase, userId),
    getSkillGapReport(supabase, userId),
    getCurrentRoadmap(supabase, userId),
  ]);

  const toMentorSkill = (s: { name: string; currentProficiency: number | null; requiredProficiency: number; status: MentorSkill["status"] }): MentorSkill => ({
    name: s.name,
    current: s.currentProficiency,
    required: s.requiredProficiency,
    status: s.status,
  });

  const ctx: MentorContext = {
    studentName: profile.full_name || null,
    careerName: gap.state === "ready" ? gap.career.name : null,
    experienceLevel: profile.experience_level,
    learningGoals: profile.learning_goals,
    prioritySkills: gap.state === "ready" ? gap.analysis.priorities.slice(0, 5).map(toMentorSkill) : [],
    mentionedSkills: gap.state === "ready" ? skillsMentioned(question, gap.analysis.skills).map(toMentorSkill) : [],
    strengths: gap.state === "ready" ? gap.analysis.strengths.map((s) => s.name) : [],
    notAssessed: gap.state === "ready" ? gap.analysis.notAssessed.map((s) => s.name) : [],
    activeWeek: null,
    currentTask: null,
    practicalFeedback: [],
  };

  if (roadmap) {
    const weekNo = activeWeekNumber(roadmap.tasks.map(toTaskLike));
    const week = roadmap.weeks.find((w) => w.week_number === weekNo);
    if (week) ctx.activeWeek = { number: week.week_number, title: week.title, objective: week.objective };
  }

  if (taskId) {
    const { data: task } = await supabase
      .from("learning_tasks")
      .select("title, description, completion_criteria, status, skill_id")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    if (task) {
      const skill = task.skill_id && gap.state === "ready" ? gap.career.skills.find((s) => s.skillId === task.skill_id) : undefined;
      ctx.currentTask = {
        title: task.title,
        description: task.description,
        completionCriteria: task.completion_criteria,
        skill: skill?.name ?? null,
        status: task.status,
      };
    }
  }

  if (wantsPracticalFeedback(question) && gap.state === "ready" && gap.latestAttempt) {
    const { data: submissions } = await supabase
      .from("practical_submissions")
      .select("challenge_id, awarded_points, max_points, attempted, feedback")
      .eq("attempt_id", gap.latestAttempt.id)
      .eq("user_id", userId);
    if (submissions?.length) {
      // Challenge titles are not client-readable (answer-key table), so read them server-side.
      const admin = createAdminClient();
      const { data: challenges } = await admin
        .from("practical_challenges")
        .select("id, title, skill_id")
        .in("id", submissions.map((s) => s.challenge_id));
      const feedback = z.array(z.object({ met: z.boolean(), hint: z.string().optional() })).catch([]);
      ctx.practicalFeedback = submissions.map((s) => {
        const c = challenges?.find((x) => x.id === s.challenge_id);
        return {
          title: c?.title ?? "Practical challenge",
          skill: gap.career.skills.find((k) => k.skillId === c?.skill_id)?.name ?? "Skill",
          score: s.attempted ? `${s.awarded_points}/${s.max_points}` : "not attempted",
          missed: feedback.parse(s.feedback).filter((f) => !f.met && f.hint).map((f) => f.hint!),
        };
      });
    }
  }
  return ctx;
}

/**
 * Validate, rate-limit and start a mentor reply. Provider failures that happen before the
 * first token are thrown as AppErrors (so the route returns a proper HTTP status). Later
 * failures are reported in-band as an `error` event. On any failure the student's question
 * is removed again so the conversation never shows a question without an honest answer.
 */
export async function startMentorReply(
  supabase: Client,
  userId: string,
  conversationId: string,
  input: { content: string; taskId?: string },
): Promise<ReadableStream<Uint8Array>> {
  const provider = getChatProvider();
  if (!provider) {
    throw new AppError("SERVICE_UNAVAILABLE", "The AI mentor is not configured on this server (GROQ_API_KEY is missing).");
  }

  const { conversation, messages } = await getConversation(supabase, userId, conversationId);
  const admin = createAdminClient();
  await enforceRateLimit(admin, userId);

  const context = await buildContext(supabase, userId, input.content, input.taskId ?? conversation.context_task_id);
  const chat = buildMentorMessages(
    context,
    messages.map((m: MessageRow) => ({ role: m.role, content: m.content })),
    input.content,
  );

  const { data: userMessage, error } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "user", content: input.content })
    .select("id")
    .single();
  if (error) throw dbError("save question", error);

  const rollback = async () => {
    await admin.from("messages").delete().eq("id", userMessage.id).eq("user_id", userId);
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MENTOR_CONFIG.requestTimeoutMs);
  const iterator = provider
    .streamChat(chat, { signal: controller.signal, maxOutputTokens: MENTOR_CONFIG.maxOutputTokens })
    [Symbol.asyncIterator]();

  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (err) {
    clearTimeout(timeout);
    await rollback();
    throw providerToAppError(err);
  }

  const encoder = new TextEncoder();
  const send = (c: ReadableStreamDefaultController<Uint8Array>, event: MentorStreamEvent) =>
    c.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

  return new ReadableStream<Uint8Array>({
    async start(c) {
      let text = "";
      send(c, { type: "start", userMessageId: userMessage.id });
      try {
        let step = first;
        while (!step.done) {
          text += step.value;
          send(c, { type: "delta", text: step.value });
          step = await iterator.next();
        }
        clearTimeout(timeout);
        if (!text.trim()) throw new ProviderError("The AI provider returned an empty response.", "bad_response");

        const { data: saved, error: saveError } = await admin
          .from("messages")
          .insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: text, model: provider.model })
          .select("id")
          .single();
        if (saveError) throw saveError;

        const title = conversation.title === "New conversation" ? conversationTitle(input.content) : conversation.title;
        await admin.from("conversations").update({ title }).eq("id", conversationId).eq("user_id", userId);
        send(c, { type: "done", messageId: saved.id, conversationId, title });
      } catch (err) {
        clearTimeout(timeout);
        await rollback();
        const appError = err instanceof ProviderError ? providerToAppError(err) : null;
        if (!appError) console.error("[mentor] failed to complete reply:", err instanceof Error ? err.message : err);
        send(c, {
          type: "error",
          message: appError?.message ?? "The mentor reply could not be saved. Please try again.",
        });
      } finally {
        c.close();
      }
    },
    cancel() {
      clearTimeout(timeout);
      controller.abort();
    },
  });
}

function providerToAppError(err: unknown): AppError {
  if (err instanceof ProviderError) {
    console.error(`[mentor] provider error (${err.kind}${err.status ? ` ${err.status}` : ""})`);
    switch (err.kind) {
      case "timeout":
        return new AppError("UPSTREAM_ERROR", "The AI mentor took too long to respond. Please try again.");
      case "rate_limited":
        return new AppError("RATE_LIMITED", "The AI service is busy right now. Please wait a moment and try again.");
      case "auth":
        return new AppError("SERVICE_UNAVAILABLE", "The AI mentor is misconfigured on the server.");
      default:
        return new AppError("UPSTREAM_ERROR", "The AI mentor is unavailable right now. Your progress is safe; please try again later.");
    }
  }
  console.error("[mentor] unexpected error:", err instanceof Error ? err.message : err);
  return new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.");
}
