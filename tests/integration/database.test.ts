/**
 * Runs the real migrations and seed on an in-process Postgres (PGlite) with a minimal
 * Supabase auth shim, then drives the same engines the API uses against it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, asUser, createTestDatabase, createUser } from "./db-harness";
import { selectChallenges, selectQuestions } from "@/features/assessments/selection";
import { scoreAttempt } from "@/features/assessments/scoring";
import { rubricSchema } from "@/features/assessments/practical-grading";
import { analyzeSkillGaps } from "@/features/skill-gap/engine";
import { generateRoadmap } from "@/features/roadmap/generator";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

let db: PGlite;
let careerId: string;

type CareerSkill = { skill_id: string; name: string; required_proficiency: number; importance_weight: string };

async function careerSkills(): Promise<CareerSkill[]> {
  const r = await db.query<CareerSkill>(
    `select cs.skill_id, s.name, cs.required_proficiency, cs.importance_weight
       from career_skills cs join skills s on s.id = cs.skill_id where cs.career_id = $1`,
    [careerId],
  );
  return r.rows;
}

/** Create and submit an attempt for a user, answering correctly with probability by skill. */
async function takeAssessment(userId: string, correctFor: (skillId: string, i: number) => boolean) {
  const skills = (await careerSkills()).map((s) => ({ skillId: s.skill_id, importanceWeight: Number(s.importance_weight) }));
  const questions = await db.query<{ id: string; skill_id: string; difficulty: "beginner"; correct_option_index: number; points: number; options: string[] }>(
    `select id, skill_id, difficulty, correct_option_index, points, options from assessment_questions where skill_id = any($1)`,
    [skills.map((s) => s.skillId)],
  );
  const challenges = await db.query<{ id: string; skill_id: string; evaluation_rubric: unknown; maximum_points: number; expected_output: string }>(
    `select id, skill_id, evaluation_rubric, maximum_points, expected_output from practical_challenges where skill_id = any($1)`,
    [skills.map((s) => s.skillId)],
  );
  const seen = await db.query<{ question_ids: string[] }>(`select question_ids from assessment_attempts where user_id = $1`, [userId]);

  const questionIds = selectQuestions({
    skills,
    questions: questions.rows.map((q) => ({ id: q.id, skillId: q.skill_id, difficulty: q.difficulty })),
    seenQuestionIds: new Set(seen.rows.flatMap((r) => r.question_ids)),
  });
  const challengeIds = selectChallenges({
    skills,
    challenges: challenges.rows.map((c) => ({ id: c.id, skillId: c.skill_id })),
  });
  const prior = await db.query(`select 1 from assessment_attempts where user_id = $1 and status = 'submitted'`, [userId]);
  const attempt = await db.query<{ id: string }>(
    `insert into assessment_attempts (user_id, career_id, kind, question_ids, challenge_ids)
     values ($1, $2, $3, $4, $5) returning id`,
    [userId, careerId, prior.rows.length ? "follow_up" : "initial", questionIds, challengeIds],
  );
  const attemptId = attempt.rows[0].id;

  const chosen = questions.rows.filter((q) => questionIds.includes(q.id));
  const answers = Object.fromEntries(
    chosen.map((q, i) => [q.id, correctFor(q.skill_id, i) ? q.correct_option_index : (q.correct_option_index + 1) % 4]),
  );
  const chosenChallenges = challenges.rows.filter((c) => challengeIds.includes(c.id));
  const result = scoreAttempt({
    questions: chosen.map((q) => ({ id: q.id, skillId: q.skill_id, correctOptionIndex: q.correct_option_index, optionCount: q.options.length, points: q.points })),
    answers,
    challenges: chosenChallenges.map((c) => ({ id: c.id, skillId: c.skill_id, rubric: rubricSchema.parse(c.evaluation_rubric), maxPoints: c.maximum_points })),
    // First challenge answered with the reference answer, second left blank.
    practicalAnswers: { [chosenChallenges[0].id]: chosenChallenges[0].expected_output },
  });
  await db.query(`select finalize_assessment($1, $2, $3)`, [attemptId, userId, JSON.stringify(result)]);
  return { attemptId, result };
}

beforeAll(async () => {
  db = await createTestDatabase();
  await createUser(db, ALICE, "Alice");
  await createUser(db, BOB, "Bob");
  careerId = (await db.query<{ id: string }>(`select id from careers where slug = 'cybersecurity-engineer'`)).rows[0].id;
});

afterAll(async () => {
  await db?.close();
});

describe("seed data", () => {
  it("creates five careers with 8-12 skills each and enough questions", async () => {
    const r = await db.query<{ slug: string; skills: number; questions: number; practicals: number }>(`
      select c.slug, count(distinct cs.skill_id)::int skills, count(distinct q.id)::int questions, count(distinct p.id)::int practicals
      from careers c join career_skills cs on cs.career_id = c.id
      left join assessment_questions q on q.skill_id = cs.skill_id
      left join practical_challenges p on p.skill_id = cs.skill_id
      group by c.slug order by c.slug`);
    expect(r.rows).toHaveLength(5);
    for (const row of r.rows) {
      expect(row.skills).toBeGreaterThanOrEqual(8);
      expect(row.skills).toBeLessThanOrEqual(12);
      expect(row.questions).toBeGreaterThanOrEqual(20);
      expect(row.practicals).toBeGreaterThanOrEqual(2);
    }
  });

  it("is idempotent when re-applied", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    await db.exec(readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8"));
    const r = await db.query<{ n: number }>(`select count(*)::int n from careers`);
    expect(r.rows[0].n).toBe(5);
  });
});

describe("profiles and authentication", () => {
  it("creates a profile for each new auth user from signup metadata", async () => {
    const rows = await asUser(db, ALICE, (tx) => tx.query<{ id: string; full_name: string }>(`select id, full_name from profiles`));
    expect(rows.rows).toEqual([{ id: ALICE, full_name: "Alice" }]);
  });

  it("lets a student update allowed profile columns only on their own row", async () => {
    await asUser(db, ALICE, async (tx) => {
      await tx.query(`update profiles set target_career_id = $1, weekly_learning_hours = 6, learning_pace = 'steady' where id = $2`, [careerId, ALICE]);
      const other = await tx.query(`update profiles set full_name = 'hacked' where id = $1`, [BOB]);
      expect(other.affectedRows).toBe(0);
      await expect(tx.query(`update profiles set created_at = now() where id = $1`, [ALICE])).rejects.toThrow(/permission denied/);
    });
    const bob = await db.query<{ full_name: string }>(`select full_name from profiles where id = $1`, [BOB]);
    expect(bob.rows[0].full_name).toBe("Bob");
  });
});

describe("answer key protection", () => {
  it("denies clients any access to questions and practical rubrics", async () => {
    await asUser(db, ALICE, async (tx) => {
      await expect(tx.query(`select correct_option_index from assessment_questions limit 1`)).rejects.toThrow(/permission denied/);
      await expect(tx.query(`select evaluation_rubric from practical_challenges limit 1`)).rejects.toThrow(/permission denied/);
    });
    await asRole(db, "anon", async (tx) => {
      await expect(tx.query(`select * from assessment_questions limit 1`)).rejects.toThrow(/permission denied/);
      const careers = await tx.query(`select slug from careers`);
      expect(careers.rows.length).toBe(5);
    });
  });

  it("does not let clients call the privileged write functions", async () => {
    await asUser(db, ALICE, async (tx) => {
      await expect(tx.query(`select replace_active_roadmap($1, '{}'::jsonb)`, [ALICE])).rejects.toThrow(/permission denied/);
      await expect(
        tx.query(`select finalize_assessment(gen_random_uuid(), $1, '{}'::jsonb)`, [ALICE]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("assessment persistence", () => {
  let attemptId: string;

  it("persists scores, responses, practical feedback and skill history atomically", async () => {
    const taken = await takeAssessment(ALICE, (_skill, i) => i % 3 === 0);
    attemptId = taken.attemptId;
    const attempt = await db.query<{ status: string; total_score: string }>(`select status, total_score from assessment_attempts where id = $1`, [attemptId]);
    expect(attempt.rows[0].status).toBe("submitted");
    expect(Number(attempt.rows[0].total_score)).toBe(taken.result.totals.totalScore);

    const counts = await db.query<{ responses: number; practicals: number; levels: number; history: number }>(
      `select (select count(*)::int from assessment_responses where attempt_id = $1) responses,
              (select count(*)::int from practical_submissions where attempt_id = $1) practicals,
              (select count(*)::int from user_skill_levels where user_id = $2) levels,
              (select count(*)::int from skill_history where user_id = $2) history`,
      [attemptId, ALICE],
    );
    const assessed = taken.result.skills.filter((s) => s.status === "assessed").length;
    expect(counts.rows[0]).toEqual({ responses: 20, practicals: 2, levels: assessed, history: assessed });

    const blank = await db.query<{ attempted: boolean }>(`select attempted from practical_submissions where attempt_id = $1 order by attempted`, [attemptId]);
    expect(blank.rows.map((r) => r.attempted)).toEqual([false, true]);
  });

  it("rejects a duplicate submission without double counting", async () => {
    await expect(
      db.query(`select finalize_assessment($1, $2, $3)`, [attemptId, ALICE, JSON.stringify({ responses: [], practicals: [], skills: [], totals: {} })]),
    ).rejects.toThrow(/ATTEMPT_ALREADY_SUBMITTED/);
    const history = await db.query<{ n: number }>(`select count(*)::int n from skill_history where source_id = $1`, [attemptId]);
    expect(history.rows[0].n).toBeGreaterThan(0);
    const responses = await db.query<{ n: number }>(`select count(*)::int n from assessment_responses where attempt_id = $1`, [attemptId]);
    expect(responses.rows[0].n).toBe(20);
  });

  it("rejects finalizing another student's attempt", async () => {
    await expect(
      db.query(`select finalize_assessment($1, $2, '{}'::jsonb)`, [attemptId, BOB]),
    ).rejects.toThrow(/ATTEMPT_NOT_FOUND/);
  });

  it("allows only one open attempt per student and career", async () => {
    await db.query(`insert into assessment_attempts (user_id, career_id, question_ids) values ($1, $2, '{}')`, [BOB, careerId]);
    await expect(
      db.query(`insert into assessment_attempts (user_id, career_id, question_ids) values ($1, $2, '{}')`, [BOB, careerId]),
    ).rejects.toThrow(/duplicate key/);
    await db.query(`update assessment_attempts set status = 'abandoned' where user_id = $1`, [BOB]);
  });

  it("isolates assessment records between students and blocks client score edits", async () => {
    await asUser(db, BOB, async (tx) => {
      const attempts = await tx.query(`select id from assessment_attempts where user_id = $1`, [ALICE]);
      const levels = await tx.query(`select id from user_skill_levels`);
      const responses = await tx.query(`select id from assessment_responses`);
      expect(attempts.rows).toHaveLength(0);
      expect(levels.rows).toHaveLength(0);
      expect(responses.rows).toHaveLength(0);
    });
    await asUser(db, ALICE, async (tx) => {
      const own = await tx.query(`select id from user_skill_levels`);
      expect(own.rows.length).toBeGreaterThan(0);
      await expect(tx.query(`update user_skill_levels set current_proficiency = 100`)).rejects.toThrow(/permission denied/);
      await expect(tx.query(`update assessment_attempts set total_score = 100`)).rejects.toThrow(/permission denied/);
      await expect(
        tx.query(`insert into skill_history (user_id, skill_id, proficiency, source_type, source_id) select $1, id, 100, 'initial_assessment', gen_random_uuid() from skills limit 1`, [ALICE]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("assessment proctoring", () => {
  const CAROL = "33333333-3333-4333-8333-333333333333";
  let attemptId: string;

  beforeAll(async () => {
    await createUser(db, CAROL, "Carol");
    const attempt = await db.query<{ id: string }>(
      `insert into assessment_attempts (user_id, career_id, question_ids) values ($1, $2, '{}') returning id`,
      [CAROL, careerId],
    );
    attemptId = attempt.rows[0].id;
  });

  it("starts attempts with no rule breaks and not auto-submitted", async () => {
    const row = await db.query<{ violation_count: number; violations: unknown; auto_submitted: boolean }>(
      `select violation_count, violations, auto_submitted from assessment_attempts where id = $1`,
      [attemptId],
    );
    expect(row.rows[0]).toEqual({ violation_count: 0, violations: [], auto_submitted: false });
  });

  it("counts each rule break and logs its type", async () => {
    const first = await db.query<{ n: number }>(`select record_assessment_violation($1, $2, 'focus_lost') n`, [attemptId, CAROL]);
    const second = await db.query<{ n: number }>(`select record_assessment_violation($1, $2, 'reload') n`, [attemptId, CAROL]);
    expect([first.rows[0].n, second.rows[0].n]).toEqual([1, 2]);
    const row = await db.query<{ violation_count: number; violations: { type: string }[] }>(
      `select violation_count, violations from assessment_attempts where id = $1`,
      [attemptId],
    );
    expect(row.rows[0].violation_count).toBe(2);
    expect(row.rows[0].violations.map((v) => v.type)).toEqual(["focus_lost", "reload"]);
  });

  it("rejects unknown types, other students and clients", async () => {
    await expect(db.query(`select record_assessment_violation($1, $2, 'devtools')`, [attemptId, CAROL])).rejects.toThrow(
      /INVALID_VIOLATION_TYPE/,
    );
    await expect(db.query(`select record_assessment_violation($1, $2, 'focus_lost')`, [attemptId, BOB])).rejects.toThrow(
      /ATTEMPT_NOT_FOUND/,
    );
    await asUser(db, CAROL, async (tx) => {
      await expect(
        tx.query(`select record_assessment_violation($1, $2, 'focus_lost')`, [attemptId, CAROL]),
      ).rejects.toThrow(/permission denied/);
      await expect(tx.query(`update assessment_attempts set violation_count = 0`)).rejects.toThrow(/permission denied/);
    });
  });

  it("stores the auto-submitted flag on finalize and then refuses further rule breaks", async () => {
    const empty = { responses: [], practicals: [], skills: [], totals: { mcqEarned: 0, mcqAvailable: 0, practicalEarned: 0, practicalAvailable: 0, totalScore: 0 } };
    await db.query(`select finalize_assessment($1, $2, $3)`, [attemptId, CAROL, JSON.stringify({ ...empty, autoSubmitted: true })]);
    const row = await db.query<{ status: string; auto_submitted: boolean }>(
      `select status, auto_submitted from assessment_attempts where id = $1`,
      [attemptId],
    );
    expect(row.rows[0]).toEqual({ status: "submitted", auto_submitted: true });
    await expect(db.query(`select record_assessment_violation($1, $2, 'focus_lost')`, [attemptId, CAROL])).rejects.toThrow(
      /ATTEMPT_ALREADY_SUBMITTED/,
    );
  });

  it("leaves normal submissions unflagged", async () => {
    const r = await db.query<{ auto_submitted: boolean }>(`select auto_submitted from assessment_attempts where user_id = $1 and status = 'submitted'`, [ALICE]);
    expect(r.rows.every((x) => x.auto_submitted === false)).toBe(true);
  });
});

describe("roadmaps, tasks and follow-up assessments", () => {
  async function analysisFor(userId: string) {
    const skills = await careerSkills();
    const levels = await db.query<{ skill_id: string; current_proficiency: string }>(
      `select skill_id, current_proficiency from user_skill_levels where user_id = $1`,
      [userId],
    );
    const deps = await db.query<{ prerequisite_skill_id: string; dependent_skill_id: string }>(`select * from skill_dependencies`);
    const level = new Map(levels.rows.map((l) => [l.skill_id, Number(l.current_proficiency)]));
    const dependencies = deps.rows.map((d) => ({ prerequisiteSkillId: d.prerequisite_skill_id, dependentSkillId: d.dependent_skill_id }));
    return {
      analysis: analyzeSkillGaps(
        skills.map((s) => ({
          skillId: s.skill_id,
          name: s.name,
          requiredProficiency: s.required_proficiency,
          importanceWeight: Number(s.importance_weight),
          currentProficiency: level.get(s.skill_id) ?? null,
        })),
        dependencies,
      ),
      dependencies,
    };
  }

  async function generateAndSave(userId: string) {
    const { analysis, dependencies } = await analysisFor(userId);
    const templates = await db.query<{
      id: string; key: string; skill_id: string; level: number; task_type: "learn"; title: string; description: string;
      estimated_minutes: number; completion_criteria: string; resource_url: string | null;
    }>(`select * from learning_task_templates`);
    const completed = await db.query<{ template_id: string }>(
      `select template_id from learning_tasks where user_id = $1 and status = 'completed' and template_id is not null`,
      [userId],
    );
    const plan = generateRoadmap({
      career: { id: careerId, name: "Cybersecurity Engineer", suggestedProjects: [] },
      analysis,
      dependencies,
      templates: templates.rows.map((t) => ({
        id: t.id, key: t.key, skillId: t.skill_id, level: t.level, taskType: t.task_type, title: t.title,
        description: t.description, estimatedMinutes: t.estimated_minutes, completionCriteria: t.completion_criteria, resourceUrl: t.resource_url,
      })),
      completedTemplateIds: new Set(completed.rows.map((c) => c.template_id)),
      weeklyHours: 6,
      pace: "steady",
      attemptId: null,
    });
    const r = await db.query<{ id: string }>(`select replace_active_roadmap($1, $2) id`, [userId, JSON.stringify(plan)]);
    return { roadmapId: r.rows[0].id, plan };
  }

  it("stores a six-week plan with tasks and resolved dependencies", async () => {
    const { roadmapId, plan } = await generateAndSave(ALICE);
    const weeks = await db.query<{ n: number }>(`select count(*)::int n from roadmap_weeks where roadmap_id = $1`, [roadmapId]);
    const tasks = await db.query<{ n: number; with_deps: number }>(
      `select count(*)::int n, count(*) filter (where cardinality(depends_on_task_ids) > 0)::int with_deps from learning_tasks where roadmap_id = $1`,
      [roadmapId],
    );
    expect(weeks.rows[0].n).toBe(6);
    expect(tasks.rows[0].n).toBe(plan.weeks.reduce((s, w) => s + w.tasks.length, 0));
    expect(tasks.rows[0].with_deps).toBeGreaterThan(0);
  });

  it("lets the owner change task progress but nothing else", async () => {
    const task = (await db.query<{ id: string }>(
      `select t.id from learning_tasks t join roadmaps r on r.id = t.roadmap_id
       where r.user_id = $1 and r.status = 'active' and t.template_id is not null order by t.sort_order limit 1`,
      [ALICE],
    )).rows[0];
    await asUser(db, ALICE, async (tx) => {
      await tx.query(`update learning_tasks set status = 'completed', completed_at = now(), started_at = now() where id = $1`, [task.id]);
      await expect(tx.query(`update learning_tasks set estimated_minutes = 1 where id = $1`, [task.id])).rejects.toThrow(/permission denied/);
      await expect(tx.query(`update learning_tasks set status = 'completed'`)).rejects.toThrow(/check constraint/);
    });
    await asUser(db, BOB, async (tx) => {
      const r = await tx.query(`update learning_tasks set status = 'not_started', completed_at = null where id = $1`, [task.id]);
      expect(r.affectedRows).toBe(0);
      expect((await tx.query(`select id from learning_tasks`)).rows).toHaveLength(0);
      expect((await tx.query(`select id from roadmaps`)).rows).toHaveLength(0);
    });
  });

  it("archives the old roadmap and skips completed templates on regeneration", async () => {
    const completed = await db.query<{ template_id: string }>(
      `select template_id from learning_tasks where user_id = $1 and status = 'completed'`,
      [ALICE],
    );
    const { roadmapId } = await generateAndSave(ALICE);
    const statuses = await db.query<{ status: string }>(`select status from roadmaps where user_id = $1 order by created_at`, [ALICE]);
    expect(statuses.rows.map((r) => r.status)).toEqual(["archived", "active"]);
    const reused = await db.query(`select 1 from learning_tasks where roadmap_id = $1 and template_id = $2`, [roadmapId, completed.rows[0].template_id]);
    expect(reused.rows).toHaveLength(0);
    const kept = await db.query(`select 1 from learning_tasks where user_id = $1 and status = 'completed'`, [ALICE]);
    expect(kept.rows).toHaveLength(1);
  });

  it("records a follow-up assessment in skill history and updates the gap", async () => {
    const before = await analysisFor(ALICE);
    await takeAssessment(ALICE, () => true);
    const after = await analysisFor(ALICE);

    const history = await db.query<{ source_type: string; n: number }>(
      `select source_type, count(*)::int n from skill_history where user_id = $1 group by source_type order by source_type`,
      [ALICE],
    );
    expect(history.rows.map((r) => r.source_type).sort()).toEqual(["follow_up_assessment", "initial_assessment"]);
    const kinds = await db.query<{ kind: string }>(`select kind from assessment_attempts where user_id = $1 and status = 'submitted' order by created_at`, [ALICE]);
    expect(kinds.rows.map((r) => r.kind)).toEqual(["initial", "follow_up"]);

    const gapBefore = before.analysis.skills.reduce((s, k) => s + (k.rawGap ?? 0), 0);
    const gapAfter = after.analysis.skills.reduce((s, k) => s + (k.rawGap ?? 0), 0);
    expect(gapAfter).toBeLessThan(gapBefore);
  });
});

describe("mentor data isolation", () => {
  it("lets students read and delete only their own conversations, and never write messages directly", async () => {
    const convo = await db.query<{ id: string }>(`insert into conversations (user_id, title) values ($1, 'Subnetting') returning id`, [ALICE]);
    await db.query(`insert into messages (conversation_id, user_id, role, content) values ($1, $2, 'user', 'What is a /24?')`, [convo.rows[0].id, ALICE]);

    await asUser(db, BOB, async (tx) => {
      expect((await tx.query(`select id from conversations`)).rows).toHaveLength(0);
      expect((await tx.query(`select id from messages`)).rows).toHaveLength(0);
      const del = await tx.query(`delete from conversations where id = $1`, [convo.rows[0].id]);
      expect(del.affectedRows).toBe(0);
    });
    await asUser(db, ALICE, async (tx) => {
      expect((await tx.query(`select id from messages`)).rows).toHaveLength(1);
      await expect(
        tx.query(`insert into messages (conversation_id, user_id, role, content) values ($1, $2, 'assistant', 'fake')`, [convo.rows[0].id, ALICE]),
      ).rejects.toThrow(/permission denied/);
      const del = await tx.query(`delete from conversations where id = $1`, [convo.rows[0].id]);
      expect(del.affectedRows).toBe(1);
    });
    expect((await db.query(`select id from messages`)).rows).toHaveLength(0);
  });
});
