import { describe, expect, it } from "vitest";
import { allocateQuestions, selectChallenges, selectQuestions } from "@/features/assessments/selection";

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const skills = Array.from({ length: 10 }, (_, i) => ({ skillId: `s${i}`, importanceWeight: 1 + (10 - i) / 10 }));
const questions = skills.flatMap((s) =>
  (["beginner", "beginner", "intermediate", "intermediate", "advanced", "advanced"] as const).map((difficulty, i) => ({
    id: `${s.skillId}-q${i}`,
    skillId: s.skillId,
    difficulty,
  })),
);

describe("question allocation", () => {
  it("gives every skill the minimum when capacity allows (10 skills × 2 = 20)", () => {
    const allocation = allocateQuestions(skills, Object.fromEntries(skills.map((s) => [s.skillId, 6])), 20, 2);
    expect(Object.values(allocation).every((n) => n === 2)).toBe(true);
  });

  it("distributes extra questions toward more important skills", () => {
    const eight = skills.slice(0, 8);
    const allocation = allocateQuestions(eight, Object.fromEntries(eight.map((s) => [s.skillId, 6])), 20, 2);
    expect(Object.values(allocation).reduce((a, b) => a + b, 0)).toBe(20);
    expect(allocation.s0).toBeGreaterThanOrEqual(allocation.s7);
    expect(Math.min(...Object.values(allocation))).toBeGreaterThanOrEqual(2);
  });

  it("is configurable and respects available question counts", () => {
    const allocation = allocateQuestions(skills.slice(0, 2), { s0: 3, s1: 1 }, 10, 2);
    expect(allocation).toEqual({ s0: 3, s1: 1 });
    const small = allocateQuestions(skills, Object.fromEntries(skills.map((s) => [s.skillId, 6])), 6, 2);
    expect(Object.values(small).filter((n) => n > 0)).toHaveLength(3);
  });
});

describe("question and challenge selection", () => {
  it("selects the configured count with no duplicates and mixed difficulty", () => {
    const ids = selectQuestions({ skills, questions, rng: seeded() });
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    const s0 = questions.filter((q) => ids.includes(q.id) && q.skillId === "s0");
    expect(new Set(s0.map((q) => q.difficulty)).size).toBe(2);
  });

  it("prefers questions the student has not seen", () => {
    const first = selectQuestions({ skills, questions, rng: seeded(3) });
    const second = selectQuestions({ skills, questions, seenQuestionIds: new Set(first), rng: seeded(4) });
    expect(second.filter((id) => first.includes(id))).toHaveLength(0);
  });

  it("picks practical challenges from distinct high-importance skills", () => {
    const challenges = skills.map((s) => ({ id: `${s.skillId}-p`, skillId: s.skillId }));
    expect(selectChallenges({ skills, challenges, rng: seeded() })).toEqual(["s0-p", "s1-p"]);
    expect(
      selectChallenges({ skills, challenges, seenChallengeIds: new Set(["s0-p"]), rng: seeded() }),
    ).toEqual(["s1-p", "s2-p"]);
  });
});
