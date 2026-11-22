/**
 * Tunable policy for the deterministic engines. Every number that shapes a score,
 * classification or schedule lives here so it can be reviewed and changed in one place.
 */

export const ASSESSMENT_CONFIG = {
  /** Multiple-choice questions per attempt. */
  questionCount: 20,
  /** Practical challenges per attempt. */
  practicalCount: 2,
  /** A skill needs at least this many MCQs (or an attempted practical) to count as assessed. */
  minQuestionsPerSkill: 2,
  /** Weighting used when both MCQ and practical evidence exist for a skill. */
  mcqWeight: 0.7,
  practicalWeight: 0.3,
  /** Submissions shorter than this (non-whitespace characters) count as not attempted. */
  minPracticalLength: 8,
  maxPracticalLength: 5000,
} as const;

export const GAP_CONFIG = {
  /** current / required at or above this ratio => "strong". */
  strongRatio: 1,
  /** current / required at or above this ratio (but below strong) => "developing". */
  developingRatio: 0.6,
  /** Extra priority per career skill that depends on this skill and still has a gap. */
  dependentBoost: 0.1,
  /** Readiness is labelled "partial" when assessed importance covers less than this share. */
  minReadinessCoverage: 0.6,
} as const;

export const ROADMAP_CONFIG = {
  durationWeeks: 6,
  /** The final week is reserved for a capstone project and follow-up assessment. */
  capstoneWeek: 6,
  followUpAssessmentMinutes: 45,
  minCapstoneProjectMinutes: 60,
  maxCapstoneProjectMinutes: 240,
  maxSkillsPerWeek: 2,
  /** Share of the stated weekly hours the plan schedules, by pace. */
  paceFactor: { relaxed: 0.75, steady: 0.9, intensive: 1 },
  /** Proficiency bands mapped to task template levels. */
  levelBands: { level2From: 40, level3From: 70 },
} as const;

export const MENTOR_CONFIG = {
  maxMessageLength: 2000,
  maxHistoryMessages: 12,
  requestTimeoutMs: 30_000,
  maxOutputTokens: 1024,
  rateLimit: { perHour: 20, perDay: 100 },
} as const;

export const PROCTORING_CONFIG = {
  /** Rule breaks that only warn; the next one auto-submits the attempt. */
  maxWarnings: 3,
  /** Focus losses shorter than this are ignored (system popups, flickers). */
  focusGraceMs: 1000,
  /** Seconds the finished screen stays up before the test window closes itself. */
  closeDelaySeconds: 5,
} as const;
