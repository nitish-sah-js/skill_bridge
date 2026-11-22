# SkillBridge

SkillBridge is a career guidance and skill development platform for students. A student picks a target tech career, takes an assessment, sees exactly which skills fall short of that career's targets, follows a personalised six-week roadmap, and re-measures with a follow-up assessment. An AI mentor explains concepts at the student's measured level.

**Assess → Analyze → Personalize → Learn → Measure improvement.**

## Features

- **Accounts and profiles**: email/password auth (Supabase Auth), password reset, and a six-step onboarding that saves after every step.
- **Career catalog**: five careers (Software Developer, Cybersecurity Engineer, Data Analyst, AI/ML Engineer, Web Developer), 33 skills, each career with 8–12 weighted skills and editable proficiency targets.
- **Assessment engine**: 20 MCQs plus 2 practical challenges per attempt, chosen from a pool of 198 questions and 33 challenges. Questions are allocated by skill importance, and follow-ups prefer unseen questions. Scoring runs server-side; answer keys never reach the browser. Drafts autosave, and duplicate submissions are rejected atomically.
- **Skill-gap engine** (deterministic): raw gap, status (meets target / developing / beginner / not assessed), priority score, prerequisite-aware ordering, and an importance-weighted readiness indicator with coverage stated.
- **Roadmap engine** (rule-based): a six-week plan that puts prerequisites first, fits the student's weekly hours × pace, caps two focus skills per week, and ends with a capstone week and follow-up assessment. Regenerating archives the old plan and never reschedules completed work.
- **Progress tracking**: task states (not started / in progress / completed / needs review), time logging, weekly activity, skill history from recorded assessments only, and before/after comparisons.
- **AI mentor**: Groq-backed streaming chat with persisted conversations. Context is limited to what the question needs (top gaps, mentioned skills, active week, current task, practical feedback). It is rate-limited and reports provider failures honestly.

## Architecture

```text
Browser (Next.js App Router, React 19, Tailwind, shadcn/ui on Base UI)
   │  Server Components read data directly; client components call /api/* (JSON, Zod-validated)
   ▼
Authenticated server layer (src/features/*/service.ts, route handlers, server actions for auth)
   ├── Assessment engine   src/features/assessments/{selection,scoring,practical-grading}.ts
   ├── Skill-gap engine    src/features/skill-gap/engine.ts
   ├── Roadmap engine      src/features/roadmap/generator.ts
   ├── Progress maths      src/features/progress/calculations.ts
   └── Mentor service ───► src/lib/ai (provider interface) ───► Groq API
   ▼
Supabase Postgres (RLS on every user table) + Supabase Auth
```

- **Pure engines vs IO.** All scoring, gap, roadmap and progress logic is pure TypeScript under `src/features/*`, with no database or UI imports. Unit tests cover the engines directly. Services (`service.ts`) load data, call the engines, and persist results.
- **Two Supabase clients.** `lib/supabase/server.ts` acts as the signed-in user, so RLS applies. `lib/supabase/admin.ts` uses the secret key and is server-only. It is used only after ownership checks, for answer keys, persisting scores, writing roadmaps and mentor replies.
- **Atomic writes.** `finalize_assessment` and `replace_active_roadmap` are Postgres functions executable only by `service_role`. They run each multi-table write as one transaction. `finalize_assessment` row-locks the attempt to block double submission.
- **Configuration.** All policy numbers (question count, MCQ/practical weights, status thresholds, pace factors, mentor rate limits) live in `src/config/engine.ts`.

### Scoring and gap formulas

| Quantity | Formula |
|---|---|
| MCQ skill score | earned points ÷ available points × 100 |
| Skill proficiency | 70% MCQ + 30% practical if the practical was attempted, otherwise MCQ only |
| Evidence rule | A skill needs ≥2 MCQs or an attempted practical; otherwise it stays **not assessed**, never 0 |
| Raw gap | max(0, required − current) |
| Status | current/required ≥ 1.0 meets target; ≥ 0.6 developing; otherwise beginner |
| Priority | 100 × (gap ÷ required) × (importance ÷ max importance) × (1 + 0.1 × blocked dependents), capped at 100 |
| Readiness indicator | importance-weighted mean of min(current/required, 1) over assessed skills; shown with coverage; labelled *partial* below 60% coverage. It is not a hiring probability. |

Practical challenges are graded deterministically. Each rubric criterion is met when any of its regex patterns matches the answer. Code is never executed.

## Database

Migrations are in `supabase/migrations/`. The main tables:

- Catalog (world-readable): `careers`, `skills`, `career_skills`, `skill_dependencies`, `learning_task_templates`.
- Answer keys (no client access at all): `assessment_questions`, `practical_challenges`.
- Student data (owner-only via RLS): `profiles`, `assessment_attempts`, `assessment_responses`, `practical_submissions`, `attempt_skill_scores`, `user_skill_levels`, `skill_history`, `roadmaps`, `roadmap_weeks`, `learning_tasks`, `conversations`, `messages`.

Students can read their own rows but cannot write score-bearing tables. Column grants restrict the profile fields they can change and limit learning tasks to progress fields (status, timestamps, time spent, notes).

Questions, challenges and task templates belong to skills, not careers, so a shared skill such as Python is authored once.

### Seed data

`supabase/seed-data/` holds the authored content as JSON. `npm run seed:generate` validates it: schema, unique keys, compilable rubric regexes, rubric totals, acyclic prerequisites, and ≥20 questions plus ≥2 practicals per career. It then regenerates `supabase/seed.sql`, which is idempotent (upserts by slug/key). Proficiency targets are illustrative starting values; edit them in the JSON or directly in `career_skills`.

## Local development

Requirements: Node 20.9+ (tested on 22), npm, and Docker for the local Supabase stack.

```bash
npm install
npx supabase start            # local Postgres + Auth; applies migrations and seed.sql
npx supabase status -o env    # copy API_URL, PUBLISHABLE_KEY (or ANON_KEY) and SECRET_KEY (or SERVICE_ROLE_KEY)
cp .env.example .env.local    # fill in the values above (and GROQ_API_KEY for the mentor)
npm run dev                   # http://localhost:3000
```

Reset the local database (re-runs migrations and seed): `npx supabase db reset`.

Local email confirmation is off (`supabase/config.toml`), so sign-up logs you straight in. Password-reset emails are captured by the local Mailpit inbox shown in `supabase status`.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_…` key. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted instead. |
| `SUPABASE_SECRET_KEY` | yes | `sb_secret_…` key, server-only. The legacy `SUPABASE_SERVICE_ROLE_KEY` is accepted instead. Never expose it to the browser. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Base URL for auth email links. Falls back to the request host. |
| `GROQ_API_KEY` | for the mentor | Without it the mentor shows a "not configured" notice; everything else works. |
| `GROQ_MODEL` | no | Defaults to `llama-3.3-70b-versatile`. Use any chat model your Groq account offers. |

`GET /api/health` reports which of these are configured, as booleans only.

## Testing

```bash
npm run lint
npm run typecheck
npm test                 # unit + integration (Vitest)
npm run test:unit
npm run test:integration # migrations + seed + RLS + RPCs on in-process Postgres (PGlite)
npx vitest run tests/unit/skill-gap.test.ts -t "raw gap"   # a single test
npm run test:e2e         # Playwright: needs Supabase configured in .env.local
npm run build
```

The integration suite runs the real migrations and seed on PGlite with a small Supabase shim (auth schema, `auth.uid()`, client roles). It checks:

- RLS isolation between students
- answer-key lockdown
- column grants
- atomic, non-duplicable submission
- roadmap archiving
- follow-up history

Routine tests never call the live AI API; the Groq client is tested against a mocked `fetch`.

The Playwright journey registers a student, completes onboarding and the Cybersecurity assessment, then:

- generates a roadmap and completes a task
- asks the mentor, or checks the honest "not configured" state when `GROQ_API_KEY` is unset
- signs out and back in, then takes a follow-up assessment

First run: `npx playwright install chromium`.

## Deploying to Vercel

1. Create a Supabase project. Link it and push the schema and seed:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   psql "<connection string>" -f supabase/seed.sql   # or paste seed.sql into the SQL editor
   ```
2. In Supabase **Auth → URL Configuration**, set the Site URL to your Vercel domain and add `https://<domain>/auth/callback` as a redirect URL.
3. Import the repo in Vercel and set the environment variables above (Production and Preview).
4. Deploy. Check `https://<domain>/api/health`.

## Known limitations

- Practical grading checks for evidence of the expected concepts with regex rubrics. It does not run code, so unusual but correct answers can be under-scored. The rubric and a reference answer are shown with every result.
- Proficiency targets, importance weights and the readiness indicator are SkillBridge's own configurable values, not industry standards.
- Only assessments change proficiency. Completing roadmap tasks tracks progress but intentionally does not raise skill scores.
- Mentor rate limiting is per user (20/hour, 100/day), counted from stored messages. There is no global spend cap beyond your Groq account limits.
- Supabase email confirmation is on by default in hosted projects. Students then confirm by email before their first sign-in.
- `src/types/database.ts` is maintained by hand. Regenerate it with `npx supabase gen types typescript --local` after schema changes.
