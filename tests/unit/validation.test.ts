import { describe, expect, it } from "vitest";
import {
  onboardingStepSchemas,
  profilePatchSchema,
  submitAssessmentSchema,
  taskUpdateSchema,
} from "@/lib/validation/schemas";

const uuid = "4f2b8e1a-1c2d-4e3f-9a8b-7c6d5e4f3a2b";

describe("profile validation", () => {
  it("normalises optional text and de-duplicates tags", () => {
    const parsed = profilePatchSchema.parse({ institution: "  ", interests: ["Security", "Security", " Data "] });
    expect(parsed.institution).toBeNull();
    expect(parsed.interests).toEqual(["Security", "Data"]);
  });

  it("rejects unknown fields so protected columns cannot be written", () => {
    expect(profilePatchSchema.safeParse({ onboarding_completed: true }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ id: uuid }).success).toBe(false);
  });

  it("validates weekly hours and the onboarding step fields", () => {
    expect(onboardingStepSchemas[5].safeParse({ weekly_learning_hours: 0, learning_pace: "steady", learning_goals: "" }).success).toBe(false);
    expect(onboardingStepSchemas[5].safeParse({ weekly_learning_hours: 6, learning_pace: "steady", learning_goals: "" }).success).toBe(true);
    expect(onboardingStepSchemas[4].safeParse({ target_career_id: "nope" }).success).toBe(false);
  });
});

describe("assessment and task validation", () => {
  it("accepts answers keyed by question id only", () => {
    expect(submitAssessmentSchema.safeParse({ answers: { [uuid]: 2 }, practicals: { [uuid]: "find /" } }).success).toBe(true);
    expect(submitAssessmentSchema.safeParse({ answers: { "not-a-uuid": 2 }, practicals: {} }).success).toBe(false);
    expect(submitAssessmentSchema.safeParse({ answers: { [uuid]: -1 }, practicals: {} }).success).toBe(false);
    expect(submitAssessmentSchema.safeParse({ answers: {}, practicals: { [uuid]: "x".repeat(5001) } }).success).toBe(false);
  });

  it("requires at least one valid task change", () => {
    expect(taskUpdateSchema.safeParse({}).success).toBe(false);
    expect(taskUpdateSchema.safeParse({ status: "done" }).success).toBe(false);
    expect(taskUpdateSchema.safeParse({ status: "completed" }).success).toBe(true);
    expect(taskUpdateSchema.safeParse({ actualMinutes: 2000 }).success).toBe(false);
  });
});
