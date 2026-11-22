import { describe, expect, it } from "vitest";
import { analyzeSkillGaps, type GapSkillInput } from "@/features/skill-gap/engine";
import { generateRoadmap, levelFor, weeklyBudgetMinutes, type TaskTemplate } from "@/features/roadmap/generator";

const skill = (skillId: string, required: number, current: number | null, importanceWeight = 1): GapSkillInput => ({
  skillId,
  name: skillId.toUpperCase(),
  requiredProficiency: required,
  currentProficiency: current,
  importanceWeight,
});

function templatesFor(skillId: string, minutes = 60): TaskTemplate[] {
  return [
    { level: 1, taskType: "learn" as const },
    { level: 1, taskType: "practice" as const },
    { level: 2, taskType: "practice" as const },
    { level: 3, taskType: "project" as const },
  ].map((t, i) => ({
    id: `${skillId}-t${i + 1}`,
    key: `${skillId}-t${i + 1}`,
    skillId,
    level: t.level,
    taskType: t.taskType,
    title: `${skillId} task ${i + 1}`,
    description: "desc",
    estimatedMinutes: minutes,
    completionCriteria: "done",
    resourceUrl: null,
  }));
}

const career = { id: "career", name: "Cybersecurity Engineer", suggestedProjects: [{ title: "Lab", description: "Build a lab" }] };
const deps = [
  { prerequisiteSkillId: "linux", dependentSkillId: "forensics" },
  { prerequisiteSkillId: "networking", dependentSkillId: "fundamentals" },
];
const inputs = [
  skill("forensics", 55, 10, 1.3),
  skill("linux", 70, 32, 1.0),
  skill("networking", 75, 80, 1.2),
  skill("fundamentals", 75, null, 1.0),
];
const templates = ["forensics", "linux", "networking", "fundamentals"].flatMap((s) => templatesFor(s));

function plan(overrides: Partial<Parameters<typeof generateRoadmap>[0]> = {}) {
  return generateRoadmap({
    career,
    analysis: analyzeSkillGaps(inputs, deps),
    dependencies: deps,
    templates,
    completedTemplateIds: new Set(),
    weeklyHours: 4,
    pace: "steady",
    attemptId: "attempt",
    ...overrides,
  });
}

describe("roadmap generation", () => {
  it("produces six weeks ending with a capstone and follow-up assessment", () => {
    const p = plan();
    expect(p.weeks).toHaveLength(6);
    expect(p.weeks[5].tasks.map((t) => t.taskType)).toEqual(["project", "assessment"]);
  });

  it("schedules prerequisites before dependent skills", () => {
    const allTasks = plan().weeks.flatMap((w) => w.tasks.map((t) => ({ ...t, week: w.weekNumber })));
    const firstIndex = (id: string) => allTasks.findIndex((t) => t.skillId === id);
    expect(firstIndex("linux")).toBeLessThan(firstIndex("forensics"));
    const forensicsFirst = allTasks[firstIndex("forensics")];
    expect(forensicsFirst.dependsOn.some((k) => k.includes("linux"))).toBe(true);
  });

  it("never exceeds the weekly budget except for a single oversized task", () => {
    const p = plan();
    expect(p.weeklyMinutesBudget).toBe(weeklyBudgetMinutes(4, "steady"));
    for (const w of p.weeks.slice(0, 5)) {
      const minutes = w.tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
      expect(w.tasks.length === 1 || minutes <= p.weeklyMinutesBudget).toBe(true);
      expect(new Set(w.tasks.map((t) => t.skillId)).size).toBeLessThanOrEqual(2);
    }
  });

  it("does not schedule skills that already meet the requirement as gap work", () => {
    const tasks = plan().weeks.flatMap((w) => w.tasks);
    expect(tasks.filter((t) => t.skillId === "networking" && !t.isStretch)).toHaveLength(0);
  });

  it("starts at the level matching current proficiency", () => {
    expect(levelFor(32)).toBe(1);
    expect(levelFor(45)).toBe(2);
    expect(levelFor(70)).toBe(3);
  });

  it("skips templates completed in earlier roadmaps (regeneration preserves work)", () => {
    const p = plan({ completedTemplateIds: new Set(["linux-t1", "linux-t2"]) });
    const ids = p.weeks.flatMap((w) => w.tasks.map((t) => t.templateId));
    expect(ids).not.toContain("linux-t1");
    expect(ids).not.toContain("linux-t2");
    expect(ids).toContain("linux-t3");
  });

  it("reports work that does not fit instead of overloading a low time budget", () => {
    const p = plan({ weeklyHours: 1, pace: "relaxed" });
    expect(p.notes.some((n) => n.includes("did not fit"))).toBe(true);
  });

  it("fills empty weeks with stretch work when everything meets requirements", () => {
    const strong = [skill("linux", 50, 90), skill("networking", 50, 95)];
    const p = generateRoadmap({
      career,
      analysis: analyzeSkillGaps(strong),
      dependencies: [],
      templates,
      completedTemplateIds: new Set(),
      weeklyHours: 3,
      pace: "steady",
      attemptId: null,
    });
    expect(p.weeks[0].tasks.every((t) => t.isStretch)).toBe(true);
    expect(p.notes.some((n) => n.includes("stretch"))).toBe(true);
  });
});
