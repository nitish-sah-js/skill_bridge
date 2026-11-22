import { describe, expect, it } from "vitest";
import {
  activeWeekNumber,
  nextRecommendedTask,
  roadmapCompletion,
  skillImprovements,
  taskStatusPatch,
  weekStartUtc,
  weeklyActivity,
  type TaskLike,
} from "@/features/progress/calculations";

const task = (id: string, weekNumber: number, status: TaskLike["status"], extra: Partial<TaskLike> = {}): TaskLike => ({
  id,
  status,
  estimatedMinutes: 60,
  actualMinutes: null,
  completedAt: status === "completed" ? "2026-10-06T10:00:00Z" : null,
  weekNumber,
  sortOrder: 0,
  dependsOnTaskIds: [],
  ...extra,
});

describe("roadmap completion", () => {
  it("counts completed tasks and minutes", () => {
    const c = roadmapCompletion([task("a", 1, "completed"), task("b", 1, "in_progress"), task("c", 2, "not_started", { estimatedMinutes: 120 })]);
    expect(c).toMatchObject({ totalTasks: 3, completedTasks: 1, inProgressTasks: 1, percent: 33, minutesPercent: 25 });
  });
  it("is 0 for an empty roadmap", () => {
    expect(roadmapCompletion([]).percent).toBe(0);
  });
});

describe("next task and active week", () => {
  it("prefers needs-review, then in-progress, then unblocked tasks", () => {
    const tasks = [
      task("a", 1, "completed"),
      task("b", 1, "not_started", { sortOrder: 1, dependsOnTaskIds: ["x"] }),
      task("c", 2, "not_started", { dependsOnTaskIds: ["a"] }),
    ];
    expect(nextRecommendedTask(tasks)?.id).toBe("c");
    expect(nextRecommendedTask([...tasks, task("d", 3, "in_progress")])?.id).toBe("d");
    expect(nextRecommendedTask([...tasks, task("e", 3, "needs_review")])?.id).toBe("e");
    expect(activeWeekNumber(tasks)).toBe(1);
    expect(activeWeekNumber([task("a", 1, "completed")])).toBeNull();
  });
});

describe("weekly activity", () => {
  it("buckets completions and assessments by UTC week", () => {
    expect(weekStartUtc(new Date("2026-10-11T23:00:00Z"))).toBe("2026-10-05");
    const activity = weeklyActivity(
      [
        { completedAt: "2026-10-06T10:00:00Z", estimatedMinutes: 60, actualMinutes: 45 },
        { completedAt: "2026-09-29T10:00:00Z", estimatedMinutes: 30, actualMinutes: null },
        { completedAt: "2025-01-01T10:00:00Z", estimatedMinutes: 30, actualMinutes: null },
      ],
      [{ submittedAt: "2026-10-07T10:00:00Z" }],
      new Date("2026-10-10T12:00:00Z"),
      4,
    );
    expect(activity.map((a) => a.weekStart)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(activity[3]).toMatchObject({ tasksCompleted: 1, minutes: 45, assessments: 1 });
    expect(activity[2]).toMatchObject({ tasksCompleted: 1, minutes: 30 });
  });
});

describe("skill history", () => {
  it("reports improvements only from recorded data with at least two points", () => {
    const result = skillImprovements([
      { skillId: "linux", proficiency: 32, recordedAt: "2026-09-01", sourceType: "initial_assessment" },
      { skillId: "linux", proficiency: 61, recordedAt: "2026-10-01", sourceType: "follow_up_assessment" },
      { skillId: "python", proficiency: 54, recordedAt: "2026-09-01", sourceType: "initial_assessment" },
    ]);
    expect(result).toEqual([{ skillId: "linux", first: 32, latest: 61, delta: 29 }]);
  });
});

describe("task status transitions", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("sets timestamps consistently", () => {
    expect(taskStatusPatch({ status: "not_started", startedAt: null }, "in_progress", now)).toEqual({
      status: "in_progress",
      started_at: now.toISOString(),
      completed_at: null,
    });
    expect(taskStatusPatch({ status: "in_progress", startedAt: "2026-10-01T00:00:00Z" }, "completed", now)).toEqual({
      status: "completed",
      started_at: "2026-10-01T00:00:00Z",
      completed_at: now.toISOString(),
    });
    expect(taskStatusPatch({ status: "completed", startedAt: "x" }, "not_started", now)).toEqual({
      status: "not_started",
      started_at: null,
      completed_at: null,
    });
  });
});
