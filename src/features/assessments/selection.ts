import { ASSESSMENT_CONFIG } from "@/config/engine";

export type SelectableSkill = { skillId: string; importanceWeight: number };
export type SelectableQuestion = { id: string; skillId: string; difficulty: "beginner" | "intermediate" | "advanced" };
export type SelectableChallenge = { id: string; skillId: string };

export type Rng = () => number;

/**
 * Decide how many MCQs each skill receives.
 * Skills are ranked by importance. Each ranked skill first receives `minPerSkill` questions
 * (so it can reach "assessed"); remaining slots are distributed proportionally to importance
 * using largest remainders. Allocation never exceeds the questions available for a skill.
 */
export function allocateQuestions(
  skills: SelectableSkill[],
  available: Record<string, number>,
  total: number = ASSESSMENT_CONFIG.questionCount,
  minPerSkill: number = ASSESSMENT_CONFIG.minQuestionsPerSkill,
): Record<string, number> {
  const ranked = [...skills]
    .filter((s) => (available[s.skillId] ?? 0) > 0)
    .sort((a, b) => b.importanceWeight - a.importanceWeight || a.skillId.localeCompare(b.skillId));

  const allocation: Record<string, number> = Object.fromEntries(ranked.map((s) => [s.skillId, 0]));
  let remaining = total;

  // Pass 1: guarantee the minimum for as many skills as possible, most important first.
  for (const s of ranked) {
    const give = Math.min(minPerSkill, available[s.skillId], remaining);
    if (give < Math.min(minPerSkill, available[s.skillId])) break;
    allocation[s.skillId] = give;
    remaining -= give;
  }

  // Pass 2: distribute leftovers proportionally to importance (largest remainder).
  while (remaining > 0) {
    const open = ranked.filter((s) => allocation[s.skillId] < available[s.skillId]);
    if (open.length === 0) break;
    const weightSum = open.reduce((sum, s) => sum + s.importanceWeight, 0);
    const shares = open.map((s) => ({ s, exact: (s.importanceWeight / weightSum) * remaining }));
    let given = 0;
    for (const { s, exact } of shares) {
      const add = Math.min(Math.floor(exact), available[s.skillId] - allocation[s.skillId]);
      allocation[s.skillId] += add;
      given += add;
    }
    let left = remaining - given;
    const byRemainder = shares
      .filter(({ s }) => allocation[s.skillId] < available[s.skillId])
      .sort((a, b) => (b.exact % 1) - (a.exact % 1) || b.s.importanceWeight - a.s.importanceWeight);
    for (const { s } of byRemainder) {
      if (left === 0) break;
      allocation[s.skillId] += 1;
      left -= 1;
    }
    const progressed = remaining - left;
    remaining = left;
    if (progressed === 0) break;
  }

  return allocation;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 } as const;

/**
 * Pick the concrete questions for an attempt. Questions the student has not seen before are
 * preferred (useful for follow-up assessments); within a skill, difficulties are mixed.
 * Output is ordered by skill importance, then difficulty.
 */
export function selectQuestions(input: {
  skills: SelectableSkill[];
  questions: SelectableQuestion[];
  seenQuestionIds?: Set<string>;
  total?: number;
  minPerSkill?: number;
  rng?: Rng;
}): string[] {
  const rng = input.rng ?? Math.random;
  const seen = input.seenQuestionIds ?? new Set<string>();
  const bySkill = new Map<string, SelectableQuestion[]>();
  for (const q of input.questions) {
    const list = bySkill.get(q.skillId) ?? [];
    list.push(q);
    bySkill.set(q.skillId, list);
  }
  const available = Object.fromEntries([...bySkill].map(([k, v]) => [k, v.length]));
  const allocation = allocateQuestions(input.skills, available, input.total, input.minPerSkill);

  const ordered = [...input.skills].sort((a, b) => b.importanceWeight - a.importanceWeight);
  const picked: SelectableQuestion[] = [];
  for (const skill of ordered) {
    const count = allocation[skill.skillId] ?? 0;
    if (!count) continue;
    const pool = bySkill.get(skill.skillId) ?? [];
    const unseen = shuffle(pool.filter((q) => !seen.has(q.id)), rng);
    const seenPool = shuffle(pool.filter((q) => seen.has(q.id)), rng);
    // Round-robin across difficulty levels so a skill is not judged on only easy questions.
    const candidates = [...unseen, ...seenPool];
    const chosen: SelectableQuestion[] = [];
    const levels = ["beginner", "intermediate", "advanced"] as const;
    let level = 0;
    while (chosen.length < count && candidates.length) {
      const wanted = levels[level % levels.length];
      const idx = candidates.findIndex((q) => q.difficulty === wanted);
      chosen.push(candidates.splice(idx === -1 ? 0 : idx, 1)[0]);
      level++;
    }
    chosen.sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
    picked.push(...chosen);
  }
  return picked.map((q) => q.id);
}

/** Pick practical challenges from the most important skills, one per skill, preferring unseen. */
export function selectChallenges(input: {
  skills: SelectableSkill[];
  challenges: SelectableChallenge[];
  seenChallengeIds?: Set<string>;
  count?: number;
  rng?: Rng;
}): string[] {
  const rng = input.rng ?? Math.random;
  const seen = input.seenChallengeIds ?? new Set<string>();
  const count = input.count ?? ASSESSMENT_CONFIG.practicalCount;
  const ranked = [...input.skills].sort((a, b) => b.importanceWeight - a.importanceWeight);

  const pickFor = (skillId: string, allowSeen: boolean) => {
    const pool = shuffle(input.challenges.filter((c) => c.skillId === skillId), rng);
    return pool.find((c) => !seen.has(c.id)) ?? (allowSeen ? pool[0] : undefined);
  };

  const result: string[] = [];
  const usedSkills = new Set<string>();
  for (const allowSeen of [false, true]) {
    for (const s of ranked) {
      if (result.length >= count) break;
      if (usedSkills.has(s.skillId)) continue;
      const c = pickFor(s.skillId, allowSeen);
      if (c) {
        result.push(c.id);
        usedSkills.add(s.skillId);
      }
    }
  }
  return result;
}
