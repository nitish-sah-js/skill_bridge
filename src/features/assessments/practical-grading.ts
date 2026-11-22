import { z } from "zod";
import { ASSESSMENT_CONFIG } from "@/config/engine";

export const rubricCriterionSchema = z.object({
  key: z.string().min(1),
  description: z.string().min(1),
  points: z.number().int().positive(),
  patterns: z.array(z.string().min(1)).min(1),
  hint: z.string().min(1),
});
export const rubricSchema = z.array(rubricCriterionSchema).min(1);
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export type CriterionFeedback = {
  key: string;
  description: string;
  met: boolean;
  points: number;
  awarded: number;
  hint?: string;
};

export type PracticalGrade = {
  attempted: boolean;
  awardedPoints: number;
  maxPoints: number;
  /** 0-100, or null when the challenge was not attempted. */
  score: number | null;
  feedback: CriterionFeedback[];
};

function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export function isAttempted(content: string): boolean {
  return content.replace(/\s+/g, "").length >= ASSESSMENT_CONFIG.minPracticalLength;
}

/**
 * Deterministic rubric grading: a criterion is met when any of its patterns matches the
 * submission. This checks for evidence of the expected concepts; it does not execute code.
 */
export function gradePractical(rubric: RubricCriterion[], content: string, maxPoints: number): PracticalGrade {
  const text = content.slice(0, ASSESSMENT_CONFIG.maxPracticalLength);
  if (!isAttempted(text)) {
    return {
      attempted: false,
      awardedPoints: 0,
      maxPoints,
      score: null,
      feedback: rubric.map((c) => ({
        key: c.key,
        description: c.description,
        met: false,
        points: c.points,
        awarded: 0,
        hint: c.hint,
      })),
    };
  }

  const feedback = rubric.map((criterion) => {
    const met = criterion.patterns.some((p) => compile(p)?.test(text) ?? false);
    return {
      key: criterion.key,
      description: criterion.description,
      met,
      points: criterion.points,
      awarded: met ? criterion.points : 0,
      hint: met ? undefined : criterion.hint,
    };
  });

  const awarded = Math.min(
    maxPoints,
    feedback.reduce((sum, f) => sum + f.awarded, 0),
  );
  return {
    attempted: true,
    awardedPoints: awarded,
    maxPoints,
    score: round2((awarded / maxPoints) * 100),
    feedback,
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
