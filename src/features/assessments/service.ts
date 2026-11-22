import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AssessmentAttemptRow, Database, DifficultyLevel, Json } from "@/types/database";
import { AppError, dbError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCareer } from "@/features/careers/service";
import { syncRoadmapStatus } from "@/features/roadmap/service";
import { selectChallenges, selectQuestions } from "./selection";
import { scoreAttempt } from "./scoring";
import { rubricSchema } from "./practical-grading";
import { strikeOutcome } from "./proctoring";
import type { ViolationType } from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;

const optionsSchema = z.array(z.string());
const draftAnswersSchema = z.record(z.string(), z.number().int().nullable()).catch({});
const draftPracticalsSchema = z.record(z.string(), z.string()).catch({});
const feedbackSchema = z
  .array(z.object({ key: z.string(), description: z.string(), met: z.boolean(), points: z.number(), awarded: z.number(), hint: z.string().optional() }))
  .catch([]);

export type ClientQuestion = {
  id: string;
  skillId: string;
  skillName: string;
  text: string;
  options: string[];
  difficulty: DifficultyLevel;
  points: number;
  timeLimitSeconds: number | null;
};

export type ClientChallenge = {
  id: string;
  skillId: string;
  skillName: string;
  title: string;
  instructions: string;
  difficulty: DifficultyLevel;
  maxPoints: number;
  /** Criterion descriptions only; patterns stay on the server. */
  criteria: { key: string; description: string; points: number }[];
};

export type InProgressAttempt = {
  status: "in_progress";
  id: string;
  kind: AssessmentAttemptRow["kind"];
  career: { id: string; name: string; slug: string };
  startedAt: string;
  questions: ClientQuestion[];
  challenges: ClientChallenge[];
  draftAnswers: Record<string, number | null>;
  draftPracticals: Record<string, string>;
  /** Proctoring rule breaks recorded so far. */
  violationCount: number;
};

export type SubmittedAttempt = {
  status: "submitted";
  id: string;
  kind: AssessmentAttemptRow["kind"];
  career: { id: string; name: string; slug: string };
  startedAt: string;
  submittedAt: string;
  /** Submitted by the server after too many proctoring rule breaks. */
  autoSubmitted: boolean;
  violationCount: number;
  totals: {
    mcqEarned: number;
    mcqAvailable: number;
    practicalEarned: number;
    practicalAvailable: number;
    totalScore: number;
  };
  questions: (ClientQuestion & {
    selectedIndex: number | null;
    correctIndex: number;
    isCorrect: boolean;
    explanation: string;
  })[];
  challenges: (ClientChallenge & {
    submission: string;
    attempted: boolean;
    awardedPoints: number;
    expectedOutput: string;
    feedback: z.infer<typeof feedbackSchema>;
  })[];
  skills: {
    skillId: string;
    skillName: string;
    mcqScore: number | null;
    practicalScore: number | null;
    proficiency: number | null;
    mcqQuestionCount: number;
    status: "assessed" | "insufficient_evidence" | "not_assessed";
  }[];
};

export type AttemptView = InProgressAttempt | SubmittedAttempt;

export type AttemptSummary = Pick<
  AssessmentAttemptRow,
  "id" | "career_id" | "kind" | "status" | "started_at" | "submitted_at" | "total_score" | "auto_submitted"
>;

/**
 * Start (or resume) an assessment for the given career. A student has at most one open
 * attempt per career, enforced by a partial unique index.
 */
export async function startAssessment(userId: string, careerId: string): Promise<{ attemptId: string; resumed: boolean }> {
  const admin = createAdminClient();

  const existing = await findOpenAttempt(admin, userId, careerId);
  if (existing) return { attemptId: existing, resumed: true };

  const career = await getCareer(admin, careerId);
  const skillIds = career.skills.map((s) => s.skillId);

  const [questions, challenges, previous] = await Promise.all([
    admin.from("assessment_questions").select("id, skill_id, difficulty").in("skill_id", skillIds).eq("is_active", true),
    admin.from("practical_challenges").select("id, skill_id").in("skill_id", skillIds).eq("is_active", true),
    admin.from("assessment_attempts").select("id, question_ids, challenge_ids").eq("user_id", userId).eq("status", "submitted"),
  ]);
  if (questions.error) throw dbError("load questions", questions.error);
  if (challenges.error) throw dbError("load challenges", challenges.error);
  if (previous.error) throw dbError("load previous attempts", previous.error);

  const selectable = career.skills.map((s) => ({ skillId: s.skillId, importanceWeight: s.importanceWeight }));
  const questionIds = selectQuestions({
    skills: selectable,
    questions: questions.data.map((q) => ({ id: q.id, skillId: q.skill_id, difficulty: q.difficulty })),
    seenQuestionIds: new Set(previous.data.flatMap((a) => a.question_ids)),
  });
  const challengeIds = selectChallenges({
    skills: selectable,
    challenges: challenges.data.map((c) => ({ id: c.id, skillId: c.skill_id })),
    seenChallengeIds: new Set(previous.data.flatMap((a) => a.challenge_ids)),
  });
  if (questionIds.length === 0) {
    throw new AppError("PRECONDITION_FAILED", "No assessment questions are available for this career yet.");
  }

  const { data: careerAttempts, error: countError } = await admin
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("career_id", careerId)
    .eq("status", "submitted")
    .limit(1);
  if (countError) throw dbError("check previous attempts", countError);

  const { data, error } = await admin
    .from("assessment_attempts")
    .insert({
      user_id: userId,
      career_id: careerId,
      kind: careerAttempts.length ? "follow_up" : "initial",
      question_ids: questionIds,
      challenge_ids: challengeIds,
    })
    .select("id")
    .single();
  if (error) {
    // Two concurrent starts: the unique index rejected the second one. Resume the winner.
    if (error.code === "23505") {
      const winner = await findOpenAttempt(admin, userId, careerId);
      if (winner) return { attemptId: winner, resumed: true };
    }
    throw dbError("create attempt", error);
  }
  return { attemptId: data.id, resumed: false };
}

async function findOpenAttempt(admin: Client, userId: string, careerId: string) {
  const { data, error } = await admin
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("career_id", careerId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (error) throw dbError("find open attempt", error);
  return data?.id ?? null;
}

async function loadOwnedAttempt(admin: Client, userId: string, attemptId: string) {
  const { data, error } = await admin
    .from("assessment_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw dbError("load attempt", error);
  if (!data) throw new AppError("NOT_FOUND", "Assessment not found.");
  return data;
}

async function loadAttemptContent(admin: Client, attempt: AssessmentAttemptRow) {
  const [questions, challenges, career] = await Promise.all([
    admin.from("assessment_questions").select("*").in("id", attempt.question_ids),
    attempt.challenge_ids.length
      ? admin.from("practical_challenges").select("*").in("id", attempt.challenge_ids)
      : Promise.resolve({ data: [], error: null }),
    admin.from("careers").select("id, name, slug").eq("id", attempt.career_id).single(),
  ]);
  if (questions.error) throw dbError("load attempt questions", questions.error);
  if (challenges.error) throw dbError("load attempt challenges", challenges.error);
  if (career.error) throw dbError("load attempt career", career.error);

  const skillIds = [...new Set([...questions.data.map((q) => q.skill_id), ...challenges.data.map((c) => c.skill_id)])];
  const { data: skills, error } = await admin.from("skills").select("id, name").in("id", skillIds);
  if (error) throw dbError("load attempt skills", error);
  const skillName = new Map(skills.map((s) => [s.id, s.name]));

  // Preserve the order chosen when the attempt was created.
  const qOrder = new Map(attempt.question_ids.map((id, i) => [id, i]));
  const cOrder = new Map(attempt.challenge_ids.map((id, i) => [id, i]));
  return {
    career: career.data,
    skillName,
    questions: [...questions.data].sort((a, b) => qOrder.get(a.id)! - qOrder.get(b.id)!),
    challenges: [...challenges.data].sort((a, b) => cOrder.get(a.id)! - cOrder.get(b.id)!),
  };
}

export async function getAttempt(userId: string, attemptId: string): Promise<AttemptView> {
  const admin = createAdminClient();
  const attempt = await loadOwnedAttempt(admin, userId, attemptId);
  if (attempt.status === "abandoned") throw new AppError("NOT_FOUND", "This assessment was abandoned.");
  const content = await loadAttemptContent(admin, attempt);

  const toClientQuestion = (q: (typeof content.questions)[number]): ClientQuestion => ({
    id: q.id,
    skillId: q.skill_id,
    skillName: content.skillName.get(q.skill_id) ?? "Skill",
    text: q.question_text,
    options: optionsSchema.parse(q.options),
    difficulty: q.difficulty,
    points: q.points,
    timeLimitSeconds: q.time_limit_seconds,
  });
  const toClientChallenge = (c: (typeof content.challenges)[number]): ClientChallenge => ({
    id: c.id,
    skillId: c.skill_id,
    skillName: content.skillName.get(c.skill_id) ?? "Skill",
    title: c.title,
    instructions: c.instructions,
    difficulty: c.difficulty,
    maxPoints: c.maximum_points,
    criteria: rubricSchema.parse(c.evaluation_rubric).map(({ key, description, points }) => ({ key, description, points })),
  });

  if (attempt.status === "in_progress") {
    return {
      status: "in_progress",
      id: attempt.id,
      kind: attempt.kind,
      career: content.career,
      startedAt: attempt.started_at,
      questions: content.questions.map(toClientQuestion),
      challenges: content.challenges.map(toClientChallenge),
      draftAnswers: draftAnswersSchema.parse(attempt.draft_answers),
      draftPracticals: draftPracticalsSchema.parse(attempt.draft_practicals),
      violationCount: attempt.violation_count,
    };
  }

  const [responses, submissions, skillScores] = await Promise.all([
    admin.from("assessment_responses").select("*").eq("attempt_id", attempt.id),
    admin.from("practical_submissions").select("*").eq("attempt_id", attempt.id),
    admin.from("attempt_skill_scores").select("*").eq("attempt_id", attempt.id),
  ]);
  if (responses.error) throw dbError("load responses", responses.error);
  if (submissions.error) throw dbError("load submissions", submissions.error);
  if (skillScores.error) throw dbError("load skill scores", skillScores.error);

  const responseByQuestion = new Map(responses.data.map((r) => [r.question_id, r]));
  const submissionByChallenge = new Map(submissions.data.map((s) => [s.challenge_id, s]));

  return {
    status: "submitted",
    id: attempt.id,
    kind: attempt.kind,
    career: content.career,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at!,
    autoSubmitted: attempt.auto_submitted,
    violationCount: attempt.violation_count,
    totals: {
      mcqEarned: attempt.mcq_earned_points ?? 0,
      mcqAvailable: attempt.mcq_available_points ?? 0,
      practicalEarned: attempt.practical_earned_points ?? 0,
      practicalAvailable: attempt.practical_available_points ?? 0,
      totalScore: Number(attempt.total_score ?? 0),
    },
    questions: content.questions.map((q) => {
      const r = responseByQuestion.get(q.id);
      return {
        ...toClientQuestion(q),
        selectedIndex: r?.selected_option_index ?? null,
        correctIndex: q.correct_option_index,
        isCorrect: r?.is_correct ?? false,
        explanation: q.explanation,
      };
    }),
    challenges: content.challenges.map((c) => {
      const s = submissionByChallenge.get(c.id);
      return {
        ...toClientChallenge(c),
        submission: s?.submission_content ?? "",
        attempted: s?.attempted ?? false,
        awardedPoints: s?.awarded_points ?? 0,
        expectedOutput: c.expected_output,
        feedback: feedbackSchema.parse(s?.feedback ?? []),
      };
    }),
    skills: skillScores.data
      .map((k) => ({
        skillId: k.skill_id,
        skillName: content.skillName.get(k.skill_id) ?? "Skill",
        mcqScore: k.mcq_score === null ? null : Number(k.mcq_score),
        practicalScore: k.practical_score === null ? null : Number(k.practical_score),
        proficiency: k.proficiency === null ? null : Number(k.proficiency),
        mcqQuestionCount: k.mcq_question_count,
        status: k.status,
      }))
      .sort((a, b) => (b.proficiency ?? -1) - (a.proficiency ?? -1)),
  };
}

/** Persist in-progress answers so a student can leave and resume. */
export async function saveDraft(
  userId: string,
  attemptId: string,
  draft: { answers?: Record<string, number | null>; practicals?: Record<string, string> },
) {
  const admin = createAdminClient();
  const attempt = await loadOwnedAttempt(admin, userId, attemptId);
  if (attempt.status !== "in_progress") throw new AppError("CONFLICT", "This assessment has already been submitted.");

  const allowedQ = new Set(attempt.question_ids);
  const allowedC = new Set(attempt.challenge_ids);
  const update: Database["public"]["Tables"]["assessment_attempts"]["Update"] = {};
  if (draft.answers) {
    update.draft_answers = Object.fromEntries(Object.entries(draft.answers).filter(([id]) => allowedQ.has(id))) as Json;
  }
  if (draft.practicals) {
    update.draft_practicals = Object.fromEntries(
      Object.entries(draft.practicals).filter(([id]) => allowedC.has(id)),
    ) as Json;
  }
  const { error } = await admin
    .from("assessment_attempts")
    .update(update)
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) throw dbError("save draft", error);
}

/**
 * Score and persist an attempt. Scoring runs on the server with the answer key; the
 * database function writes everything in one transaction and rejects a second submission.
 * Re-submitting an already-submitted attempt is treated as success (idempotent).
 */
export async function submitAssessment(
  userId: string,
  attemptId: string,
  input: { answers: Record<string, number | null>; practicals: Record<string, string> },
  options: { autoSubmitted?: boolean } = {},
): Promise<{ attemptId: string; alreadySubmitted: boolean }> {
  const admin = createAdminClient();
  const attempt = await loadOwnedAttempt(admin, userId, attemptId);
  if (attempt.status === "submitted") return { attemptId, alreadySubmitted: true };
  if (attempt.status !== "in_progress") throw new AppError("CONFLICT", "This assessment can no longer be submitted.");

  const content = await loadAttemptContent(admin, attempt);
  const result = scoreAttempt({
    questions: content.questions.map((q) => ({
      id: q.id,
      skillId: q.skill_id,
      correctOptionIndex: q.correct_option_index,
      optionCount: optionsSchema.parse(q.options).length,
      points: q.points,
    })),
    answers: input.answers,
    challenges: content.challenges.map((c) => ({
      id: c.id,
      skillId: c.skill_id,
      rubric: rubricSchema.parse(c.evaluation_rubric),
      maxPoints: c.maximum_points,
    })),
    practicalAnswers: input.practicals,
  });

  const { error } = await admin.rpc("finalize_assessment", {
    p_attempt_id: attemptId,
    p_user_id: userId,
    p_result: { ...result, autoSubmitted: options.autoSubmitted ?? false } as unknown as Json,
  });
  if (error) {
    if (error.message?.includes("ATTEMPT_ALREADY_SUBMITTED")) return { attemptId, alreadySubmitted: true };
    throw dbError("finalize assessment", error);
  }

  if (attempt.kind === "follow_up") await completeFollowUpTasks(admin, userId);
  return { attemptId, alreadySubmitted: false };
}

export type ViolationResult =
  | { count: number; outcome: "warning"; warningNumber: number; remaining: number }
  | { count: number; outcome: "auto_submitted" };

/**
 * Record one proctoring rule break. The latest draft is saved first so that, when the
 * threshold is crossed, the automatic submission scores exactly what the student had.
 */
export async function recordViolation(
  userId: string,
  attemptId: string,
  input: { type: ViolationType; answers?: Record<string, number | null>; practicals?: Record<string, string> },
): Promise<ViolationResult> {
  if (input.answers || input.practicals) await saveDraft(userId, attemptId, input);

  const admin = createAdminClient();
  const { data: count, error } = await admin.rpc("record_assessment_violation", {
    p_attempt_id: attemptId,
    p_user_id: userId,
    p_type: input.type,
  });
  if (error) {
    if (error.message?.includes("ATTEMPT_NOT_FOUND")) throw new AppError("NOT_FOUND", "Assessment not found.");
    if (error.message?.includes("ATTEMPT_ALREADY_SUBMITTED")) throw new AppError("CONFLICT", "This assessment has already been submitted.");
    throw dbError("record violation", error);
  }

  const outcome = strikeOutcome(count);
  if (outcome.kind === "warning") return { count, outcome: "warning", warningNumber: outcome.number, remaining: outcome.remaining };

  const attempt = await loadOwnedAttempt(admin, userId, attemptId);
  await submitAssessment(
    userId,
    attemptId,
    { answers: draftAnswersSchema.parse(attempt.draft_answers), practicals: draftPracticalsSchema.parse(attempt.draft_practicals) },
    { autoSubmitted: true },
  );
  return { count, outcome: "auto_submitted" };
}

/** A submitted follow-up assessment satisfies the roadmap's follow-up assessment task. */
async function completeFollowUpTasks(admin: Client, userId: string) {
  const { data: roadmap } = await admin
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!roadmap) return;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("learning_tasks")
    .update({ status: "completed", completed_at: now, started_at: now })
    .eq("roadmap_id", roadmap.id)
    .eq("task_type", "assessment")
    .neq("status", "completed");
  if (error) console.error("[assessments] could not complete follow-up task:", error.code);
  else await syncRoadmapStatus(userId, roadmap.id);
}

/** Abandon an open attempt (e.g. to restart). Submitted attempts are immutable. */
export async function abandonAttempt(userId: string, attemptId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("assessment_attempts")
    .update({ status: "abandoned" })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) throw dbError("abandon attempt", error);
}

/** Attempt history for the signed-in user (RLS-scoped read). */
export async function listAttempts(supabase: Client, userId: string): Promise<AttemptSummary[]> {
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("id, career_id, kind, status, started_at, submitted_at, total_score, auto_submitted")
    .eq("user_id", userId)
    .neq("status", "abandoned")
    .order("created_at", { ascending: false });
  if (error) throw dbError("list attempts", error);
  return data.map((a) => ({ ...a, total_score: a.total_score === null ? null : Number(a.total_score) }));
}
