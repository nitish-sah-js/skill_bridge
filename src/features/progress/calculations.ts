export type TaskLike = {
  id: string;
  status: "not_started" | "in_progress" | "completed" | "needs_review";
  estimatedMinutes: number;
  actualMinutes: number | null;
  completedAt: string | null;
  weekNumber: number;
  sortOrder: number;
  dependsOnTaskIds: string[];
  isStretch?: boolean;
};

export type RoadmapCompletion = {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  needsReviewTasks: number;
  /** Share of tasks completed, 0-100. */
  percent: number;
  /** Share of estimated minutes completed, 0-100. */
  minutesPercent: number;
  completedMinutes: number;
  totalMinutes: number;
};

export function roadmapCompletion(tasks: TaskLike[]): RoadmapCompletion {
  const completed = tasks.filter((t) => t.status === "completed");
  const totalMinutes = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const completedMinutes = completed.reduce((s, t) => s + t.estimatedMinutes, 0);
  return {
    totalTasks: tasks.length,
    completedTasks: completed.length,
    inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
    needsReviewTasks: tasks.filter((t) => t.status === "needs_review").length,
    percent: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    minutesPercent: totalMinutes ? Math.round((completedMinutes / totalMinutes) * 100) : 0,
    completedMinutes,
    totalMinutes,
  };
}

/** The week containing the earliest unfinished task; null when everything is done. */
export function activeWeekNumber(tasks: TaskLike[]): number | null {
  const open = tasks.filter((t) => t.status !== "completed");
  if (open.length === 0) return null;
  return Math.min(...open.map((t) => t.weekNumber));
}

/**
 * Next recommended task: tasks needing review first, then in-progress, then the first
 * not-started task whose dependencies are complete, in week/sort order.
 */
export function nextRecommendedTask<T extends TaskLike>(tasks: T[]): T | null {
  const ordered = [...tasks].sort((a, b) => a.weekNumber - b.weekNumber || a.sortOrder - b.sortOrder);
  const done = new Set(ordered.filter((t) => t.status === "completed").map((t) => t.id));
  return (
    ordered.find((t) => t.status === "needs_review") ??
    ordered.find((t) => t.status === "in_progress") ??
    ordered.find((t) => t.status === "not_started" && t.dependsOnTaskIds.every((d) => done.has(d))) ??
    ordered.find((t) => t.status === "not_started") ??
    null
  );
}

export function unmetDependencies(task: TaskLike, all: TaskLike[]): string[] {
  const done = new Set(all.filter((t) => t.status === "completed").map((t) => t.id));
  return task.dependsOnTaskIds.filter((d) => !done.has(d));
}

/** Monday 00:00 UTC of the week containing `date`, as YYYY-MM-DD. */
export function weekStartUtc(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export type WeeklyActivity = {
  weekStart: string;
  tasksCompleted: number;
  minutes: number;
  assessments: number;
};

/**
 * Activity per calendar week (UTC) for the last `weeks` weeks, oldest first.
 * Minutes use actual time when recorded, otherwise the task estimate.
 */
export function weeklyActivity(
  completedTasks: { completedAt: string; estimatedMinutes: number; actualMinutes: number | null }[],
  submittedAssessments: { submittedAt: string }[],
  now: Date,
  weeks = 8,
): WeeklyActivity[] {
  const buckets = new Map<string, WeeklyActivity>();
  const current = new Date(weekStartUtc(now) + "T00:00:00Z");
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { weekStart: key, tasksCompleted: 0, minutes: 0, assessments: 0 });
  }
  for (const t of completedTasks) {
    const b = buckets.get(weekStartUtc(new Date(t.completedAt)));
    if (!b) continue;
    b.tasksCompleted += 1;
    b.minutes += t.actualMinutes ?? t.estimatedMinutes;
  }
  for (const a of submittedAssessments) {
    const b = buckets.get(weekStartUtc(new Date(a.submittedAt)));
    if (b) b.assessments += 1;
  }
  return [...buckets.values()];
}

export type HistoryPoint = { skillId: string; proficiency: number; recordedAt: string; sourceType: string };

/** Change between the first and latest recorded value per skill (only skills with ≥2 records). */
export function skillImprovements(history: HistoryPoint[]): { skillId: string; first: number; latest: number; delta: number }[] {
  const bySkill = new Map<string, HistoryPoint[]>();
  for (const h of history) {
    const list = bySkill.get(h.skillId) ?? [];
    list.push(h);
    bySkill.set(h.skillId, list);
  }
  return [...bySkill.entries()]
    .filter(([, points]) => points.length >= 2)
    .map(([skillId, points]) => {
      const sorted = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      const first = sorted[0].proficiency;
      const latest = sorted[sorted.length - 1].proficiency;
      return { skillId, first, latest, delta: Math.round((latest - first) * 10) / 10 };
    })
    .sort((a, b) => b.delta - a.delta);
}

/** Validate a status change and compute the timestamp fields to persist. */
export function taskStatusPatch(
  current: { status: TaskLike["status"]; startedAt: string | null },
  next: TaskLike["status"],
  now: Date,
): { status: TaskLike["status"]; started_at: string | null; completed_at: string | null } {
  const iso = now.toISOString();
  return {
    status: next,
    started_at: next === "not_started" ? null : (current.startedAt ?? iso),
    completed_at: next === "completed" ? iso : null,
  };
}
