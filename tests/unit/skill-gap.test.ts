import { describe, expect, it } from "vitest";
import { analyzeSkillGaps, classifySkill, orderByPrerequisites, rawGap, type GapSkillInput } from "@/features/skill-gap/engine";

const skill = (skillId: string, required: number, current: number | null, importanceWeight = 1): GapSkillInput => ({
  skillId,
  name: skillId,
  requiredProficiency: required,
  currentProficiency: current,
  importanceWeight,
});

describe("raw gap", () => {
  it("is required minus current, never negative", () => {
    expect(rawGap(70, 32)).toBe(38);
    expect(rawGap(75, 78)).toBe(0);
  });
});

describe("classification", () => {
  it("uses configurable ratio thresholds", () => {
    expect(classifySkill(70, 70)).toBe("strong");
    expect(classifySkill(65, 54)).toBe("developing");
    expect(classifySkill(60, 18)).toBe("beginner");
    expect(classifySkill(60, null)).toBe("not_assessed");
    expect(classifySkill(60, 30, { strongRatio: 1, developingRatio: 0.5 })).toBe("developing");
  });
});

describe("gap analysis", () => {
  const inputs = [
    skill("networking", 75, 78, 1.3),
    skill("python", 65, 54, 1.0),
    skill("linux", 70, 32, 1.2),
    skill("crypto", 60, 18, 1.0),
    skill("forensics", 55, null, 0.8),
  ];

  it("matches the documented example gaps", () => {
    const { skills } = analyzeSkillGaps(inputs);
    expect(skills.map((s) => [s.skillId, s.rawGap])).toEqual([
      ["networking", 0],
      ["python", 11],
      ["linux", 38],
      ["crypto", 42],
      ["forensics", null],
    ]);
  });

  it("ranks priorities by normalized gap × importance", () => {
    const { priorities } = analyzeSkillGaps(inputs);
    // crypto: 0.7 × (1.0/1.3); linux: 0.543 × (1.2/1.3); python: 0.169 × (1.0/1.3)
    expect(priorities.map((p) => p.skillId)).toEqual(["crypto", "linux", "python"]);
    expect(priorities[0].priorityScore).toBeCloseTo(53.8, 1);
  });

  it("boosts prerequisites that block other gaps", () => {
    const deps = [{ prerequisiteSkillId: "python", dependentSkillId: "crypto" }];
    const plain = analyzeSkillGaps(inputs).skills.find((s) => s.skillId === "python")!;
    const boosted = analyzeSkillGaps(inputs, deps).skills.find((s) => s.skillId === "python")!;
    expect(boosted.blockedDependents).toEqual(["crypto"]);
    expect(boosted.priorityScore!).toBeGreaterThan(plain.priorityScore!);
  });

  it("never reports an unassessed student as 0% ready or fully assessed", () => {
    const { readiness, notAssessed } = analyzeSkillGaps([skill("a", 60, null), skill("b", 70, null)]);
    expect(readiness.score).toBeNull();
    expect(readiness.coverage).toBe(0);
    expect(readiness.isPartial).toBe(true);
    expect(notAssessed).toHaveLength(2);
  });

  it("computes an importance-weighted readiness over assessed skills only", () => {
    const { readiness } = analyzeSkillGaps([skill("a", 50, 50, 1), skill("b", 100, 50, 1), skill("c", 60, null, 2)]);
    expect(readiness.score).toBe(75);
    expect(readiness.coverage).toBe(0.5);
    expect(readiness.isPartial).toBe(true);
  });

  it("changes when an assessment result changes", () => {
    const before = analyzeSkillGaps([skill("linux", 70, 32)]);
    const after = analyzeSkillGaps([skill("linux", 70, 61)]);
    expect(after.skills[0].rawGap).toBe(9);
    expect(after.skills[0].priorityScore!).toBeLessThan(before.skills[0].priorityScore!);
  });
});

describe("prerequisite ordering", () => {
  it("places prerequisites first and otherwise follows rank", () => {
    const order = orderByPrerequisites(
      ["websec", "crypto", "fundamentals", "networking"],
      [
        { prerequisiteSkillId: "fundamentals", dependentSkillId: "websec" },
        { prerequisiteSkillId: "fundamentals", dependentSkillId: "crypto" },
        { prerequisiteSkillId: "networking", dependentSkillId: "fundamentals" },
      ],
      (id) => ["websec", "crypto", "fundamentals", "networking"].indexOf(id),
    );
    expect(order).toEqual(["networking", "fundamentals", "websec", "crypto"]);
  });

  it("does not loop forever on cycles", () => {
    const order = orderByPrerequisites(
      ["a", "b"],
      [
        { prerequisiteSkillId: "a", dependentSkillId: "b" },
        { prerequisiteSkillId: "b", dependentSkillId: "a" },
      ],
      (id) => (id === "a" ? 0 : 1),
    );
    expect(order).toEqual(["a", "b"]);
  });
});
