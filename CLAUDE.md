# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

SkillBridge: a Next.js 16 (App Router, React 19, TypeScript strict) + Supabase app that assesses students against a target tech career, computes skill gaps, generates a six-week roadmap, tracks progress, and offers a Groq-backed AI mentor. See README.md for product details and formulas.

## Commands

```bash
npm run dev                      # dev server (needs .env.local, see README)
npm run lint && npm run typecheck
npm test                         # all Vitest tests (unit + PGlite integration)
npx vitest run tests/unit/roadmap.test.ts            # one file
npx vitest run -t "raw gap"                           # one test by name
npm run test:e2e                 # Playwright; needs Supabase in .env.local
npm run build
npm run seed:generate            # validate supabase/seed-data/*.json → regenerate supabase/seed.sql
npx supabase start | db reset    # local stack (Docker); reset re-applies migrations + seed
npx next typegen                 # regenerate PageProps/RouteContext types after adding routes
```

## Architecture rules that span files

- **Pure engines, separate IO.** `src/features/{assessments,skill-gap,roadmap,progress}/` contain pure modules (`scoring.ts`, `selection.ts`, `practical-grading.ts`, `engine.ts`, `generator.ts`, `calculations.ts`) with no DB/UI imports, plus a `service.ts` (`server-only`) that loads data, calls the engine and persists. Keep business logic out of route handlers and components. Tunable numbers live in `src/config/engine.ts`.
- **Two Supabase clients.** `lib/supabase/server.ts` = signed-in user, RLS enforced; use it for reads and owner-scoped writes. `lib/supabase/admin.ts` = secret key, bypasses RLS; only after verifying ownership, and only for answer keys (`assessment_questions`, `practical_challenges` have no client grants), score persistence, roadmap writes and mentor messages.
- **Multi-table writes go through SQL functions** in the migration (`finalize_assessment`, `replace_active_roadmap`), executable only by `service_role`. The app computes results in TS and passes JSON. If you change the payload shape, change both the TS producer and the SQL function.
- **Honesty invariants (tested):** unassessed skills are `null`/"not assessed", never 0. Task completion never changes proficiency; only assessments write `user_skill_levels`/`skill_history`. Mentor failures roll back the stored question and return an error, never a fake reply.
- **Schema changes:** add a new migration file, update `src/types/database.ts` by hand (hand-maintained Supabase `Database` type), and extend `tests/integration/database.test.ts`. That suite runs the real migrations + seed on PGlite with a shim (`tests/integration/db-harness.ts`) for `auth.users`, `auth.uid()` and the anon/authenticated/service_role roles.
- **Seed content** is authored as JSON in `supabase/seed-data/` (format in its README). Questions, practicals and task templates belong to skills, not careers. Never hand-edit `supabase/seed.sql`.
- **API shape:** route handlers wrap bodies in `handle()` from `lib/api/response.ts` → `{ ok: true, data } | { ok: false, error: { code, message } }`. Throw `AppError` for user-safe errors; validate input with Zod schemas from `lib/validation/schemas.ts` (shared with client forms). Client code calls the API through `apiFetch` (`lib/api/client.ts`). The mentor message endpoint streams NDJSON events instead.
- **Auth:** `src/proxy.ts` (Next 16's renamed middleware) refreshes the session and does optimistic redirects only. Every page/handler re-verifies with `requireUser()` / `requireApiUser()` from `features/auth/session.ts`. The `(app)` layout also redirects to `/onboarding` until `profiles.onboarding_completed`.

## Conventions and gotchas

- Next 16: `params`/`searchParams` are Promises; use the global `PageProps<"/route">` / `RouteContext<"/api/route">` helpers. `cacheComponents` is intentionally off (cookie-based auth on every page).
- shadcn/ui here is the **Base UI** variant ("base-nova"): compose with `render={<Link …/>}`, not `asChild`. Forms use styled native `<select>`/radio inputs plus React Hook Form (`useWatch`, not `form.watch`, to satisfy the React Compiler lint).
- Design tokens are in `src/app/globals.css` (`--target`, `--strong`, `--developing`, `--beginner`, `--unassessed` plus shadcn tokens). The recurring visual is `components/skills/gap-gauge.tsx`.
- When writing files through a bash heredoc in this environment, avoid the Unicode ellipsis character; the shell wrapper fails to parse it. Use the file-writing tool instead.
