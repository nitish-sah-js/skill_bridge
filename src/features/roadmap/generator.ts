import { ROADMAP_CONFIG } from "@/config/engine";
import { orderByPrerequisites, type GapAnalysis, type SkillDependency, type SkillGap } from "@/features/skill-gap/engine";

export type LearningPace = "relaxed" | "steady" | "intensive";
export type TaskType = "learn" | "practice" | "project" | "assessment";

export type TaskTemplate = {
  id: string;
  key: string;
  skillId: string;
  level: number;
  taskType: TaskType;
  title: string;
  description: string;
  estimatedMinutes: number;
  completionCriteria: string;
  resourceUrl: string | null;
};

export type PlannedTask = {
  key: string;
  templateId: string | null;
  skillId: string | null;
  taskType: TaskType;
  title: string;
  description: string;
  estimatedMinutes: number;
  completionCriteria: string;
  resourceUrl: string | null;
  sortOrder: number;
  isStretch: boolean;
  dependsOn: string[];
};

export type PlannedWeek = {
  weekNumber: number;
  title: string;
  objective: string;
  completionCriterion: string;
  focusSkillIds: string[];
  tasks: PlannedTask[];
};

export type RoadmapPlan = {
  careerId: string;
  title: string;
  durationWeeks: number;
  weeklyMinutesBudget: number;
  learningPace: LearningPace;
  attemptId: string | null;
  notes: string[];
  weeks: PlannedWeek[];
};

export type RoadmapInput = {
  career: { id: string; name: string; suggestedProjects: { title: string; description: string }[] };
  analysis: GapAnalysis;
  dependencies: SkillDependency[];
  templates: TaskTemplate[];
  completedTemplateIds: Set<string>;
  weeklyHours: number;
  pace: LearningPace;
  attemptId: string | null;
};

const TYPE_ORDER: Record<TaskType, number> = { learn: 0, practice: 1, project: 2, assessment: 3 };

export function weeklyBudgetMinutes(weeklyHours: number, pace: LearningPace): number {
  return Math.max(30, Math.round(weeklyHours * 60 * ROADMAP_CONFIG.paceFactor[pace]));
}

export function levelFor(proficiency: number): 1 | 2 | 3 {
  if (proficiency >= ROADMAP_CONFIG.levelBands.level3From) return 3;
  if (proficiency >= ROADMAP_CONFIG.levelBands.level2From) return 2;
  return 1;
}

/** Templates that move a skill from its current level up to the level its requirement implies. */
export function tasksForSkill(skill: SkillGap, templates: TaskTemplate[], completed: Set<string>): TaskTemplate[] {
  const start = levelFor(skill.currentProficiency ?? 0);
  const target = Math.max(start, levelFor(skill.requiredProficiency));
  return templates
    .filter((t) => t.skillId === skill.skillId && t.level >= start && t.level <= target && !completed.has(t.id))
    .sort((a, b) => a.level - b.level || TYPE_ORDER[a.taskType] - TYPE_ORDER[b.taskType] || a.key.localeCompare(b.key));
}

/**
 * Rule-based six-week roadmap.
 *
 * 1. Skills below requirement are ranked by gap priority; unassessed skills follow by importance.
 * 2. Prerequisites are scheduled before dependents.
 * 3. Weeks 1-5 are filled up to the weekly minute budget (hours × pace factor) with at most
 *    two focus skills per week. Work that does not fit is reported, not crammed in.
 * 4. Empty weeks receive stretch work on skills that already meet requirements.
 * 5. The final week is a capstone project plus a follow-up assessment.
 * Templates the student completed in earlier roadmaps are skipped.
 */
export function generateRoadmap(input: RoadmapInput): RoadmapPlan {
  const budget = weeklyBudgetMinutes(input.weeklyHours, input.pace);
  const contentWeeks = ROADMAP_CONFIG.capstoneWeek - 1;
  const notes: string[] = [];
  const byId = new Map(input.analysis.skills.map((s) => [s.skillId, s]));

  const gapSkills = input.analysis.priorities;
  const unassessed = [...input.analysis.notAssessed].sort((a, b) => b.importanceWeight - a.importanceWeight);
  const rankList = [...gapSkills, ...unassessed].map((s) => s.skillId);
  const rank = (id: string) => rankList.indexOf(id);
  const orderedSkillIds = orderByPrerequisites(rankList, input.dependencies, rank);

  type Slot = { tasks: PlannedTask[]; minutes: number; skills: string[] };
  const weeks: Slot[] = Array.from({ length: contentWeeks }, () => ({ tasks: [], minutes: 0, skills: [] }));
  const lastTaskKeyBySkill = new Map<string, string>();
  let weekIndex = 0;
  let deferredMinutes = 0;
  let deferredTasks = 0;
  let oversized = 0;

  const place = (skill: SkillGap, template: TaskTemplate, isStretch: boolean, allowAdvance: boolean): boolean => {
    while (weekIndex < contentWeeks) {
      const week = weeks[weekIndex];
      const newSkill = !week.skills.includes(skill.skillId);
      const skillCapReached = newSkill && week.skills.length >= ROADMAP_CONFIG.maxSkillsPerWeek;
      const overBudget = week.tasks.length > 0 && week.minutes + template.estimatedMinutes > budget;
      if (skillCapReached || overBudget) {
        if (!allowAdvance) return false;
        weekIndex++;
        continue;
      }
      if (week.tasks.length === 0 && template.estimatedMinutes > budget) oversized++;

      const dependsOn: string[] = [];
      const previous = lastTaskKeyBySkill.get(skill.skillId);
      if (previous) dependsOn.push(previous);
      else {
        for (const d of input.dependencies) {
          if (d.dependentSkillId !== skill.skillId) continue;
          const prereqKey = lastTaskKeyBySkill.get(d.prerequisiteSkillId);
          if (prereqKey) dependsOn.push(prereqKey);
        }
      }
      const key = `w${weekIndex + 1}-${template.key}`;
      week.tasks.push({
        key,
        templateId: template.id,
        skillId: skill.skillId,
        taskType: template.taskType,
        title: template.title,
        description: template.description,
        estimatedMinutes: template.estimatedMinutes,
        completionCriteria: template.completionCriteria,
        resourceUrl: template.resourceUrl,
        sortOrder: week.tasks.length,
        isStretch,
        dependsOn,
      });
      week.minutes += template.estimatedMinutes;
      if (newSkill) week.skills.push(skill.skillId);
      lastTaskKeyBySkill.set(skill.skillId, key);
      return true;
    }
    return false;
  };

  for (const skillId of orderedSkillIds) {
    const skill = byId.get(skillId)!;
    for (const template of tasksForSkill(skill, input.templates, input.completedTemplateIds)) {
      if (!place(skill, template, false, true)) {
        deferredTasks++;
        deferredMinutes += template.estimatedMinutes;
      }
    }
  }

  // Stretch work for otherwise empty weeks: advanced templates on skills already at target.
  const stretchPool = input.analysis.strengths
    .flatMap((s) =>
      input.templates
        .filter((t) => t.skillId === s.skillId && t.level === 3 && !input.completedTemplateIds.has(t.id))
        .map((t) => ({ skill: s, template: t })),
    )
    .sort((a, b) => b.skill.importanceWeight - a.skill.importanceWeight);
  for (let i = 0; i < contentWeeks; i++) {
    if (weeks[i].tasks.length > 0) continue;
    weekIndex = i;
    for (const item of [...stretchPool]) {
      if (weeks[i].skills.length >= ROADMAP_CONFIG.maxSkillsPerWeek && !weeks[i].skills.includes(item.skill.skillId))
        continue;
      if (place(item.skill, item.template, true, false)) stretchPool.splice(stretchPool.indexOf(item), 1);
    }
  }

  const plannedWeeks: PlannedWeek[] = weeks.map((week, i) => {
    const focus = week.skills.map((id) => byId.get(id)!);
    if (week.tasks.length === 0) {
      return {
        weekNumber: i + 1,
        title: "Review & consolidation",
        objective:
          "No new gap work fits this week. Revisit any task marked “needs review” and rework earlier exercises.",
        completionCriterion: "All earlier tasks are completed or re-checked.",
        focusSkillIds: [],
        tasks: [],
      };
    }
    const hours = Math.round((week.minutes / 60) * 10) / 10;
    return {
      weekNumber: i + 1,
      title: focus.map((s) => s.name).join(" & "),
      objective: focus.map(describeObjective).join(" "),
      completionCriterion: `Complete all ${week.tasks.length} task${week.tasks.length === 1 ? "" : "s"} (≈${hours} h) and meet each task's completion criterion.`,
      focusSkillIds: week.skills,
      tasks: week.tasks,
    };
  });

  plannedWeeks.push(buildCapstoneWeek(input, budget));

  if (deferredTasks > 0) {
    notes.push(
      `${deferredTasks} further task${deferredTasks === 1 ? "" : "s"} (≈${Math.round(deferredMinutes / 60)} h) did not fit your weekly time. Regenerate after this plan, or increase weekly hours.`,
    );
  }
  if (oversized > 0) {
    notes.push("Some single tasks are longer than your weekly budget; split them across sessions.");
  }
  if (gapSkills.length === 0 && unassessed.length === 0) {
    notes.push("All career skills currently meet their targets, so weeks contain stretch work.");
  }
  if (unassessed.length > 0) {
    notes.push(
      `${unassessed.length} skill${unassessed.length === 1 ? " has" : "s have"} not been assessed yet and ${unassessed.length === 1 ? "is" : "are"} scheduled from the fundamentals.`,
    );
  }

  return {
    careerId: input.career.id,
    title: `${input.career.name}: ${ROADMAP_CONFIG.durationWeeks}-week plan`,
    durationWeeks: ROADMAP_CONFIG.durationWeeks,
    weeklyMinutesBudget: budget,
    learningPace: input.pace,
    attemptId: input.attemptId,
    notes,
    weeks: plannedWeeks,
  };
}

function describeObjective(skill: SkillGap): string {
  if (skill.currentProficiency === null) {
    return `Build a baseline in ${skill.name} (not yet assessed; target ${skill.requiredProficiency}).`;
  }
  if (skill.status === "strong") {
    return `Deepen ${skill.name} beyond the ${skill.requiredProficiency} target.`;
  }
  return `Move ${skill.name} from ${Math.round(skill.currentProficiency)} toward the ${skill.requiredProficiency} target.`;
}

function buildCapstoneWeek(input: RoadmapInput, budget: number): PlannedWeek {
  const assessmentMinutes = ROADMAP_CONFIG.followUpAssessmentMinutes;
  const projectMinutes = Math.min(
    ROADMAP_CONFIG.maxCapstoneProjectMinutes,
    Math.max(ROADMAP_CONFIG.minCapstoneProjectMinutes, budget - assessmentMinutes),
  );
  const focus = input.analysis.priorities.slice(0, 3);
  const project = input.career.suggestedProjects[0] ?? {
    title: `${input.career.name} capstone`,
    description: "Combine the skills from this roadmap in one small, complete project.",
  };
  const skillList = focus.map((s) => s.name).join(", ");
  return {
    weekNumber: ROADMAP_CONFIG.capstoneWeek,
    title: "Capstone & follow-up assessment",
    objective: `Apply what you practised${skillList ? ` (${skillList})` : ""} in a capstone project, then re-measure your skills.`,
    completionCriterion: "Capstone project delivered and follow-up assessment submitted.",
    focusSkillIds: focus.map((s) => s.skillId),
    tasks: [
      {
        key: "capstone-project",
        templateId: null,
        skillId: focus[0]?.skillId ?? null,
        taskType: "project",
        title: `Capstone: ${project.title}`,
        description: project.description,
        estimatedMinutes: projectMinutes,
        completionCriteria: "A working project with a short README explaining what you built and what you learned.",
        resourceUrl: null,
        sortOrder: 0,
        isStretch: false,
        dependsOn: [],
      },
      {
        key: "follow-up-assessment",
        templateId: null,
        skillId: null,
        taskType: "assessment",
        title: "Take the follow-up assessment",
        description:
          "Retake the career assessment to measure how your proficiency changed. New results update your skill history and gap analysis.",
        estimatedMinutes: assessmentMinutes,
        completionCriteria: "Follow-up assessment submitted.",
        resourceUrl: null,
        sortOrder: 1,
        isStretch: false,
        dependsOn: [],
      },
    ],
  };
}
