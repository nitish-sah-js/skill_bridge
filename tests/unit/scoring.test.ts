import { describe, expect, it } from "vitest";
import { combineSkillScore, scoreAttempt, type ScoringChallenge, type ScoringQuestion } from "@/features/assessments/scoring";
import { gradePractical, isAttempted } from "@/features/assessments/practical-grading";

const q = (id: string, skillId: string, correct: number, points = 1): ScoringQuestion => ({
  id,
  skillId,
  correctOptionIndex: correct,
  optionCount: 4,
  points,
});

const linuxChallenge: ScoringChallenge = {
  id: "c-linux",
  skillId: "linux",
  maxPoints: 10,
  rubric: [
    { key: "find", description: "Uses find", points: 4, patterns: ["\\bfind\\b"], hint: "Use the find command." },
    { key: "perm", description: "Filters by permission", points: 4, patterns: ["-perm"], hint: "Filter with -perm." },
    { key: "suid", description: "Targets SUID bit", points: 2, patterns: ["4000|u=s"], hint: "SUID is 4000." },
  ],
};

describe("MCQ scoring", () => {
  it("awards points only for correct answers and computes per-skill percentages", () => {
    const result = scoreAttempt({
      questions: [q("q1", "linux", 0, 1), q("q2", "linux", 1, 3), q("q3", "python", 2, 2), q("q4", "python", 3, 2)],
      answers: { q1: 0, q2: 2, q3: 2, q4: 3 },
      challenges: [],
      practicalAnswers: {},
    });
    const linux = result.skills.find((s) => s.skillId === "linux")!;
    const python = result.skills.find((s) => s.skillId === "python")!;
    expect(linux).toMatchObject({ mcqEarned: 1, mcqAvailable: 4, mcqScore: 25, proficiency: 25, status: "assessed" });
    expect(python).toMatchObject({ mcqEarned: 4, mcqAvailable: 4, mcqScore: 100, proficiency: 100 });
    expect(result.totals).toMatchObject({ mcqEarned: 5, mcqAvailable: 8 });
  });

  it("treats unanswered and out-of-range answers as incorrect without crashing", () => {
    const result = scoreAttempt({
      questions: [q("q1", "linux", 0), q("q2", "linux", 1)],
      answers: { q1: null, q2: 7 },
      challenges: [],
      practicalAnswers: {},
    });
    expect(result.responses.map((r) => r.selectedIndex)).toEqual([null, null]);
    expect(result.skills[0]).toMatchObject({ mcqScore: 0, proficiency: 0, status: "assessed" });
  });

  it("marks skills with too few questions as insufficient evidence instead of zero", () => {
    const result = scoreAttempt({
      questions: [q("q1", "linux", 0), q("q2", "linux", 1), q("q3", "crypto", 0)],
      answers: { q1: 0, q2: 1, q3: 3 },
      challenges: [],
      practicalAnswers: {},
    });
    const crypto = result.skills.find((s) => s.skillId === "crypto")!;
    expect(crypto.status).toBe("insufficient_evidence");
    expect(crypto.proficiency).toBeNull();
  });
});

describe("practical grading and weighting", () => {
  it("grades rubric criteria deterministically and explains misses", () => {
    const grade = gradePractical(linuxChallenge.rubric, "find / -type f 2>/dev/null", 10);
    expect(grade).toMatchObject({ attempted: true, awardedPoints: 4, score: 40 });
    expect(grade.feedback.filter((f) => !f.met).map((f) => f.hint)).toEqual(["Filter with -perm.", "SUID is 4000."]);
  });

  it("treats blank submissions as not attempted", () => {
    expect(isAttempted("   \n ")).toBe(false);
    expect(gradePractical(linuxChallenge.rubric, "ok", 10)).toMatchObject({ attempted: false, score: null });
  });

  it("ignores invalid regex patterns rather than throwing", () => {
    const grade = gradePractical(
      [{ key: "x", description: "bad", points: 1, patterns: ["(unclosed"], hint: "h" }],
      "some reasonable answer",
      1,
    );
    expect(grade.awardedPoints).toBe(0);
  });

  it("combines MCQ and practical as 70/30 when both exist", () => {
    expect(combineSkillScore(50, 100)).toBe(65);
    expect(combineSkillScore(50, null)).toBe(50);
    expect(combineSkillScore(null, 80)).toBe(80);
    expect(combineSkillScore(null, null)).toBeNull();
  });

  it("applies the practical component only when it was attempted", () => {
    const base = {
      questions: [q("q1", "linux", 0), q("q2", "linux", 0)],
      answers: { q1: 0, q2: 1 },
      challenges: [linuxChallenge],
    };
    const skipped = scoreAttempt({ ...base, practicalAnswers: { "c-linux": "" } });
    expect(skipped.skills[0]).toMatchObject({ practicalScore: null, proficiency: 50 });

    const done = scoreAttempt({ ...base, practicalAnswers: { "c-linux": "find / -perm -4000 -type f" } });
    expect(done.skills[0]).toMatchObject({ practicalScore: 100, proficiency: 65 });
    expect(done.totals).toMatchObject({ practicalEarned: 10, practicalAvailable: 10, totalScore: 65 });
  });

  it("lets an attempted practical alone establish evidence for a skill", () => {
    const result = scoreAttempt({
      questions: [],
      answers: {},
      challenges: [linuxChallenge],
      practicalAnswers: { "c-linux": "find / -perm 4000" },
    });
    expect(result.skills[0]).toMatchObject({ status: "assessed", proficiency: 100, mcqScore: null });
  });
});
