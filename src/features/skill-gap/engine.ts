import { GAP_CONFIG } from "@/config/engine";

export type GapSkillInput = {
  skillId: string;
  name: string;
  requiredProficiency: number;
  importanceWeight: number;
  /** Measured proficiency, or null when the skill has not been assessed. */
  currentProficiency: number | null;
};

export type SkillDependency = { prerequisiteSkillId: string; dependentSkillId: string };

export type SkillStatus = "strong" | "developing" | "beginner" | "not_assessed";

export type SkillGap = GapSkillInput & {
  /** max(0, required - current); null when not assessed. */
  rawGap: number | null;
  /** rawGap / required (0-1); null when not assessed. */
  normalizedGap: number | null;
  status: SkillStatus;
  /** 0-100 priority, higher = study sooner; null when not assessed. */
  priorityScore: number | null;
  /** Career skills with gaps that list this skill as a prerequisite. */
  blockedDependents: string[];
};

export type Readiness = {
  /** Importance-weighted mean of min(current/required, 1) over assessed skills, 0-100. Null if nothing assessed. */
  score: number | null;
  /** Share (0-1) of total career importance weight that has been assessed. */
  coverage: number;
  isPartial: boolean;
  assessedCount: number;
  totalCount: number;
};

export type GapAnalysis = {
  skills: SkillGap[];
  readiness: Readiness;
  /** Assessed skills with a gap, highest priority first. */
  priorities: SkillGap[];
  strengths: SkillGap[];
  notAssessed: SkillGap[];
};

type Thresholds = { strongRatio: number; developingRatio: number; dependentBoost: number; minReadinessCoverage: number };

export function rawGap(required: number, current: number): number {
  return Math.max(0, round1(required - current));
}

export function classifySkill(
  required: number,
  current: number | null,
  thresholds: Pick<Thresholds, "strongRatio" | "developingRatio"> = GAP_CONFIG,
): SkillStatus {
  if (current === null) return "not_assessed";
  if (required <= 0) return "strong";
  const ratio = current / required;
  if (ratio >= thresholds.strongRatio) return "strong";
  if (ratio >= thresholds.developingRatio) return "developing";
  return "beginner";
}

/**
 * Deterministic skill-gap analysis.
 *
 * priority = 100 × normalizedGap × (importance / maxImportance) × (1 + boost × blockedDependents)
 * capped at 100, where blockedDependents counts career skills that depend on this skill and are
 * themselves below requirement or unassessed. Foundational skills therefore rise in priority.
 */
export function analyzeSkillGaps(
  inputs: GapSkillInput[],
  dependencies: SkillDependency[] = [],
  thresholds: Thresholds = GAP_CONFIG,
): GapAnalysis {
  const maxImportance = Math.max(...inputs.map((s) => s.importanceWeight), 1e-9);
  const inCareer = new Map(inputs.map((s) => [s.skillId, s]));

  const needsWork = (s: GapSkillInput) =>
    s.currentProficiency === null || s.currentProficiency < s.requiredProficiency;

  const skills: SkillGap[] = inputs.map((s) => {
    const status = classifySkill(s.requiredProficiency, s.currentProficiency, thresholds);
    const blockedDependents = dependencies
      .filter((d) => d.prerequisiteSkillId === s.skillId)
      .map((d) => inCareer.get(d.dependentSkillId))
      .filter((d): d is GapSkillInput => d !== undefined && needsWork(d))
      .map((d) => d.skillId);

    if (s.currentProficiency === null) {
      return { ...s, rawGap: null, normalizedGap: null, status, priorityScore: null, blockedDependents };
    }
    const gap = rawGap(s.requiredProficiency, s.currentProficiency);
    const normalizedGap = s.requiredProficiency > 0 ? gap / s.requiredProficiency : 0;
    const priority =
      100 *
      normalizedGap *
      (s.importanceWeight / maxImportance) *
      (1 + thresholds.dependentBoost * blockedDependents.length);
    return {
      ...s,
      rawGap: gap,
      normalizedGap: round3(normalizedGap),
      status,
      priorityScore: round1(Math.min(100, priority)),
      blockedDependents,
    };
  });

  const assessed = skills.filter((s) => s.currentProficiency !== null);
  const totalWeight = skills.reduce((sum, s) => sum + s.importanceWeight, 0);
  const assessedWeight = assessed.reduce((sum, s) => sum + s.importanceWeight, 0);
  const coverage = totalWeight > 0 ? assessedWeight / totalWeight : 0;
  const score =
    assessed.length === 0 || assessedWeight === 0
      ? null
      : round1(
          (100 *
            assessed.reduce(
              (sum, s) =>
                sum +
                s.importanceWeight *
                  (s.requiredProficiency > 0 ? Math.min(1, s.currentProficiency! / s.requiredProficiency) : 1),
              0,
            )) /
            assessedWeight,
        );

  const priorities = skills
    .filter((s) => s.rawGap !== null && s.rawGap > 0)
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || (b.rawGap ?? 0) - (a.rawGap ?? 0));

  return {
    skills,
    readiness: {
      score,
      coverage: round3(coverage),
      isPartial: coverage < thresholds.minReadinessCoverage,
      assessedCount: assessed.length,
      totalCount: skills.length,
    },
    priorities,
    strengths: skills.filter((s) => s.status === "strong"),
    notAssessed: skills.filter((s) => s.status === "not_assessed"),
  };
}

/**
 * Order skills so prerequisites come before dependents (Kahn's algorithm). Among skills
 * that are ready at the same time, the given `rank` decides (lower = earlier).
 * Dependencies on skills outside `skillIds` are ignored. Cycles fall back to rank order.
 */
export function orderByPrerequisites(
  skillIds: string[],
  dependencies: SkillDependency[],
  rank: (skillId: string) => number,
): string[] {
  const set = new Set(skillIds);
  const edges = dependencies.filter(
    (d) => set.has(d.prerequisiteSkillId) && set.has(d.dependentSkillId),
  );
  const indegree = new Map(skillIds.map((id) => [id, 0]));
  for (const e of edges) indegree.set(e.dependentSkillId, (indegree.get(e.dependentSkillId) ?? 0) + 1);

  const result: string[] = [];
  const ready = skillIds.filter((id) => indegree.get(id) === 0);
  const remaining = new Set(skillIds);
  while (remaining.size) {
    if (ready.length === 0) {
      // Cycle: release the best-ranked remaining skill.
      ready.push([...remaining].sort((a, b) => rank(a) - rank(b))[0]);
    }
    ready.sort((a, b) => rank(a) - rank(b));
    const next = ready.shift()!;
    if (!remaining.has(next)) continue;
    remaining.delete(next);
    result.push(next);
    for (const e of edges.filter((x) => x.prerequisiteSkillId === next)) {
      const d = (indegree.get(e.dependentSkillId) ?? 0) - 1;
      indegree.set(e.dependentSkillId, d);
      if (d === 0 && remaining.has(e.dependentSkillId)) ready.push(e.dependentSkillId);
    }
  }
  return result;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
