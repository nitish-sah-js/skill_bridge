import { ASSESSMENT_CONFIG } from "@/config/engine";
import { gradePractical, round2, type CriterionFeedback, type RubricCriterion } from "./practical-grading";

export type ScoringQuestion = {
  id: string;
  skillId: string;
  correctOptionIndex: number;
  optionCount: number;
  points: number;
};

export type ScoringChallenge = {
  id: string;
  skillId: string;
  rubric: RubricCriterion[];
  maxPoints: number;
};

export type SkillEvidenceStatus = "assessed" | "insufficient_evidence";

export type SkillScore = {
  skillId: string;
  mcqEarned: number;
  mcqAvailable: number;
  mcqQuestionCount: number;
  practicalEarned: number | null;
  practicalAvailable: number | null;
  mcqScore: number | null;
  practicalScore: number | null;
  /** Combined proficiency (0-100). Null when evidence is insufficient. */
  proficiency: number | null;
  status: SkillEvidenceStatus;
};

export type AttemptResult = {
  responses: {
    questionId: string;
    selectedIndex: number | null;
    isCorrect: boolean;
    awardedPoints: number;
    maxPoints: number;
  }[];
  practicals: {
    challengeId: string;
    content: string;
    attempted: boolean;
    awardedPoints: number;
    maxPoints: number;
    feedback: CriterionFeedback[];
  }[];
  skills: SkillScore[];
  totals: {
    mcqEarned: number;
    mcqAvailable: number;
    practicalEarned: number;
    practicalAvailable: number;
    /** Overall attempt score (0-100) using the same MCQ/practical weighting as skills. */
    totalScore: number;
  };
};

type ScoringPolicy = {
  mcqWeight: number;
  practicalWeight: number;
  minQuestionsPerSkill: number;
};

const DEFAULT_POLICY: ScoringPolicy = {
  mcqWeight: ASSESSMENT_CONFIG.mcqWeight,
  practicalWeight: ASSESSMENT_CONFIG.practicalWeight,
  minQuestionsPerSkill: ASSESSMENT_CONFIG.minQuestionsPerSkill,
};

/**
 * Combine MCQ and practical evidence for one skill.
 * - Both available: weighted blend (default 70/30).
 * - Only one available: that component alone.
 * - Neither: null (unknown, never zero).
 */
export function combineSkillScore(
  mcqScore: number | null,
  practicalScore: number | null,
  policy: Pick<ScoringPolicy, "mcqWeight" | "practicalWeight"> = DEFAULT_POLICY,
): number | null {
  if (mcqScore !== null && practicalScore !== null) {
    const total = policy.mcqWeight + policy.practicalWeight;
    return round2((mcqScore * policy.mcqWeight + practicalScore * policy.practicalWeight) / total);
  }
  return mcqScore ?? practicalScore ?? null;
}

/**
 * Score a submitted attempt. Pure function: the answer key comes from the server and the
 * result is persisted atomically by the `finalize_assessment` database function.
 *
 * Missing data handling:
 * - Unanswered MCQs earn 0 points but still count as available points.
 * - A blank practical (shorter than the attempt threshold) is "not attempted" and is excluded,
 *   so the skill falls back to its MCQ evidence.
 * - A skill with fewer than `minQuestionsPerSkill` MCQs and no attempted practical is
 *   "insufficient_evidence" and does not update the student's measured proficiency.
 */
export function scoreAttempt(input: {
  questions: ScoringQuestion[];
  answers: Record<string, number | null | undefined>;
  challenges: ScoringChallenge[];
  practicalAnswers: Record<string, string | undefined>;
  policy?: Partial<ScoringPolicy>;
}): AttemptResult {
  const policy = { ...DEFAULT_POLICY, ...input.policy };

  const responses = input.questions.map((q) => {
    const raw = input.answers[q.id];
    const selectedIndex =
      typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < q.optionCount ? raw : null;
    const isCorrect = selectedIndex !== null && selectedIndex === q.correctOptionIndex;
    return {
      questionId: q.id,
      selectedIndex,
      isCorrect,
      awardedPoints: isCorrect ? q.points : 0,
      maxPoints: q.points,
    };
  });

  const practicals = input.challenges.map((c) => {
    const content = (input.practicalAnswers[c.id] ?? "").trim();
    const grade = gradePractical(c.rubric, content, c.maxPoints);
    return {
      challengeId: c.id,
      skillId: c.skillId,
      content,
      attempted: grade.attempted,
      awardedPoints: grade.awardedPoints,
      maxPoints: c.maxPoints,
      feedback: grade.feedback,
    };
  });

  const skillIds = [...new Set([...input.questions.map((q) => q.skillId), ...input.challenges.map((c) => c.skillId)])];

  const skills: SkillScore[] = skillIds.map((skillId) => {
    const qs = input.questions.filter((q) => q.skillId === skillId);
    const rs = responses.filter((r) => qs.some((q) => q.id === r.questionId));
    const mcqEarned = rs.reduce((s, r) => s + r.awardedPoints, 0);
    const mcqAvailable = rs.reduce((s, r) => s + r.maxPoints, 0);
    const mcqQuestionCount = qs.length;

    const attemptedPracticals = practicals.filter((p) => p.skillId === skillId && p.attempted);
    const practicalEarned = attemptedPracticals.length
      ? attemptedPracticals.reduce((s, p) => s + p.awardedPoints, 0)
      : null;
    const practicalAvailable = attemptedPracticals.length
      ? attemptedPracticals.reduce((s, p) => s + p.maxPoints, 0)
      : null;

    const hasEnoughMcq = mcqQuestionCount >= policy.minQuestionsPerSkill;
    const mcqScore = mcqAvailable > 0 ? round2((mcqEarned / mcqAvailable) * 100) : null;
    const practicalScore =
      practicalEarned !== null && practicalAvailable ? round2((practicalEarned / practicalAvailable) * 100) : null;

    const sufficient = hasEnoughMcq || practicalScore !== null;
    const proficiency = sufficient
      ? combineSkillScore(hasEnoughMcq ? mcqScore : null, practicalScore, policy)
      : null;

    return {
      skillId,
      mcqEarned,
      mcqAvailable,
      mcqQuestionCount,
      practicalEarned,
      practicalAvailable,
      mcqScore,
      practicalScore,
      proficiency,
      status: sufficient && proficiency !== null ? "assessed" : "insufficient_evidence",
    };
  });

  const mcqEarned = responses.reduce((s, r) => s + r.awardedPoints, 0);
  const mcqAvailable = responses.reduce((s, r) => s + r.maxPoints, 0);
  const attempted = practicals.filter((p) => p.attempted);
  const practicalEarned = attempted.reduce((s, p) => s + p.awardedPoints, 0);
  // Unattempted practicals still count against the overall attempt score.
  const practicalAvailable = practicals.reduce((s, p) => s + p.maxPoints, 0);

  const totalScore =
    combineSkillScore(
      mcqAvailable > 0 ? (mcqEarned / mcqAvailable) * 100 : null,
      practicalAvailable > 0 ? (practicalEarned / practicalAvailable) * 100 : null,
      policy,
    ) ?? 0;

  return {
    responses,
    practicals: practicals.map((p) => ({
      challengeId: p.challengeId,
      content: p.content,
      attempted: p.attempted,
      awardedPoints: p.awardedPoints,
      maxPoints: p.maxPoints,
      feedback: p.feedback,
    })),
    skills,
    totals: { mcqEarned, mcqAvailable, practicalEarned, practicalAvailable, totalScore: round2(totalScore) },
  };
}
