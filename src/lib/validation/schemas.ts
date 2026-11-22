import { z } from "zod";
import { ASSESSMENT_CONFIG, MENTOR_CONFIG } from "@/config/engine";

export const EDUCATION_LEVELS = [
  { value: "high_school", label: "High school" },
  { value: "diploma", label: "Diploma" },
  { value: "undergraduate", label: "Undergraduate degree" },
  { value: "postgraduate", label: "Postgraduate degree" },
  { value: "bootcamp", label: "Bootcamp" },
  { value: "self_taught", label: "Self-taught" },
  { value: "other", label: "Other" },
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "none", label: "No experience yet" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export const LEARNING_PACES = [
  { value: "relaxed", label: "Relaxed", description: "Plan uses ~75% of your hours, leaving room for other commitments." },
  { value: "steady", label: "Steady", description: "Plan uses ~90% of your hours." },
  { value: "intensive", label: "Intensive", description: "Plan uses all of your stated hours." },
] as const;

const educationLevel = z.enum(["high_school", "diploma", "undergraduate", "postgraduate", "bootcamp", "self_taught", "other"], { error: "Choose your education level." });
const experienceLevel = z.enum(["none", "beginner", "intermediate", "advanced"], { error: "Choose your experience level." });
const learningPace = z.enum(["relaxed", "steady", "intensive"], { error: "Choose a pace." });

const tagList = z
  .array(z.string().trim().min(1).max(40))
  .max(20, "Add at most 20 items.")
  .transform((items) => [...new Set(items)]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const profileFieldsSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name.").max(120),
  education_level: educationLevel,
  institution: optionalText(160),
  graduation_year: z.number({ error: "Enter a year like 2027." }).int().min(1950, "Enter a year like 2027.").max(2100, "Enter a year like 2027.").nullable(),
  interests: tagList,
  current_skills: tagList,
  experience_level: experienceLevel,
  target_career_id: z.string({ error: "Choose a target career." }).uuid("Choose a target career."),
  weekly_learning_hours: z.number({ error: "Enter a number of hours." }).int("Use whole hours.").min(1, "At least 1 hour.").max(60, "At most 60 hours."),
  learning_pace: learningPace,
  learning_goals: optionalText(1000),
});
export type ProfileFields = z.infer<typeof profileFieldsSchema>;

/** Partial update used by onboarding (one step at a time) and the profile page. */
export const profilePatchSchema = profileFieldsSchema
  .partial()
  .extend({
    onboarding_step: z.number().int().min(1).max(6).optional(),
    complete_onboarding: z.boolean().optional(),
  })
  .strict();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const onboardingStepSchemas = {
  1: profileFieldsSchema.pick({ full_name: true }),
  2: profileFieldsSchema.pick({ education_level: true, institution: true, graduation_year: true, experience_level: true }),
  3: profileFieldsSchema.pick({ interests: true, current_skills: true }),
  4: profileFieldsSchema.pick({ target_career_id: true }),
  5: profileFieldsSchema.pick({ weekly_learning_hours: true, learning_pace: true, learning_goals: true }),
} as const;

export const startAssessmentSchema = z.object({ careerId: z.string().uuid() }).strict();

const answersSchema = z.record(z.string().uuid(), z.number().int().min(0).max(9).nullable());
const practicalAnswersSchema = z.record(z.string().uuid(), z.string().max(ASSESSMENT_CONFIG.maxPracticalLength));

export const saveDraftSchema = z
  .object({ answers: answersSchema.optional(), practicals: practicalAnswersSchema.optional() })
  .strict();

export const submitAssessmentSchema = z
  .object({ answers: answersSchema, practicals: practicalAnswersSchema })
  .strict();

export const violationTypes = ["focus_lost", "fullscreen_exit", "reload", "screenshot_key"] as const;
export type ViolationType = (typeof violationTypes)[number];

/** A proctoring rule break, sent with the current draft so an auto-submit scores the latest answers. */
export const violationSchema = z
  .object({ type: z.enum(violationTypes), answers: answersSchema.optional(), practicals: practicalAnswersSchema.optional() })
  .strict();

export const taskUpdateSchema = z
  .object({
    status: z.enum(["not_started", "in_progress", "completed", "needs_review"]).optional(),
    actualMinutes: z.number().int().min(0).max(1440).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const mentorMessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Type a question first.")
      .max(MENTOR_CONFIG.maxMessageLength, `Keep questions under ${MENTOR_CONFIG.maxMessageLength} characters.`),
    taskId: z.string().uuid().optional(),
  })
  .strict();

export const createConversationSchema = z
  .object({ title: z.string().trim().min(1).max(120).optional(), taskId: z.string().uuid().optional() })
  .strict();

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(72),
});
export const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
});
