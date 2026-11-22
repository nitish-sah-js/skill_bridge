-- SkillBridge initial schema
-- Catalog tables are world-readable; user-owned tables are protected by RLS.
-- Answer keys (assessment_questions, practical_challenges) are readable only by the service role.
-- Score-bearing tables are written only through service-role RPC functions so students
-- cannot alter their own proficiency, attempts or answer keys from the browser.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.education_level as enum (
  'high_school', 'diploma', 'undergraduate', 'postgraduate', 'bootcamp', 'self_taught', 'other'
);
create type public.experience_level as enum ('none', 'beginner', 'intermediate', 'advanced');
create type public.learning_pace as enum ('relaxed', 'steady', 'intensive');
create type public.difficulty_level as enum ('beginner', 'intermediate', 'advanced');
create type public.assessment_kind as enum ('initial', 'follow_up');
create type public.attempt_status as enum ('in_progress', 'submitted', 'abandoned');
create type public.skill_evidence_status as enum ('assessed', 'insufficient_evidence', 'not_assessed');
create type public.skill_source as enum ('initial_assessment', 'follow_up_assessment');
create type public.roadmap_status as enum ('active', 'completed', 'archived');
create type public.task_status as enum ('not_started', 'in_progress', 'completed', 'needs_review');
create type public.task_type as enum ('learn', 'practice', 'project', 'assessment');
create type public.message_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Career & skill catalog
-- ---------------------------------------------------------------------------
create table public.careers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null,
  responsibilities text[] not null default '{}',
  prerequisites text[] not null default '{}',
  suggested_projects jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null,
  category text not null,
  resources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.career_skills (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete restrict,
  required_proficiency smallint not null check (required_proficiency between 0 and 100),
  importance_weight numeric(3, 2) not null default 1.00 check (importance_weight > 0 and importance_weight <= 2),
  created_at timestamptz not null default now(),
  unique (career_id, skill_id)
);
create index career_skills_skill_idx on public.career_skills (skill_id);

create table public.skill_dependencies (
  id uuid primary key default gen_random_uuid(),
  prerequisite_skill_id uuid not null references public.skills (id) on delete cascade,
  dependent_skill_id uuid not null references public.skills (id) on delete cascade,
  unique (prerequisite_skill_id, dependent_skill_id),
  check (prerequisite_skill_id <> dependent_skill_id)
);
create index skill_dependencies_dependent_idx on public.skill_dependencies (dependent_skill_id);

-- Answer keys: never exposed to anon/authenticated roles.
create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  skill_id uuid not null references public.skills (id) on delete cascade,
  question_text text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_option_index smallint not null check (correct_option_index >= 0),
  explanation text not null,
  difficulty public.difficulty_level not null,
  points smallint not null default 1 check (points > 0),
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (correct_option_index < jsonb_array_length(options))
);
create index assessment_questions_skill_idx on public.assessment_questions (skill_id) where is_active;

create table public.practical_challenges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  skill_id uuid not null references public.skills (id) on delete cascade,
  title text not null,
  instructions text not null,
  expected_output text not null,
  difficulty public.difficulty_level not null,
  evaluation_rubric jsonb not null check (jsonb_typeof(evaluation_rubric) = 'array'),
  maximum_points smallint not null check (maximum_points > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index practical_challenges_skill_idx on public.practical_challenges (skill_id) where is_active;

-- Reusable learning activities the roadmap engine draws from.
create table public.learning_task_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  task_type public.task_type not null,
  title text not null,
  description text not null,
  estimated_minutes smallint not null check (estimated_minutes between 5 and 600),
  completion_criteria text not null,
  resource_url text,
  created_at timestamptz not null default now()
);
create index learning_task_templates_skill_idx on public.learning_task_templates (skill_id, level);

-- ---------------------------------------------------------------------------
-- Student profile
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  education_level public.education_level,
  institution text check (char_length(institution) <= 160),
  graduation_year smallint check (graduation_year between 1950 and 2100),
  interests text[] not null default '{}',
  current_skills text[] not null default '{}',
  experience_level public.experience_level,
  target_career_id uuid references public.careers (id) on delete set null,
  weekly_learning_hours smallint check (weekly_learning_hours between 1 and 60),
  learning_pace public.learning_pace,
  learning_goals text check (char_length(learning_goals) <= 1000),
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 6),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_target_career_idx on public.profiles (target_career_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Assessments
-- ---------------------------------------------------------------------------
create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  career_id uuid not null references public.careers (id) on delete restrict,
  kind public.assessment_kind not null default 'initial',
  status public.attempt_status not null default 'in_progress',
  question_ids uuid[] not null,
  challenge_ids uuid[] not null default '{}',
  draft_answers jsonb not null default '{}'::jsonb,
  draft_practicals jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  mcq_earned_points integer,
  mcq_available_points integer,
  practical_earned_points integer,
  practical_available_points integer,
  total_score numeric(5, 2) check (total_score is null or total_score between 0 and 100),
  created_at timestamptz not null default now(),
  check ((status = 'submitted') = (submitted_at is not null))
);
create index assessment_attempts_user_idx on public.assessment_attempts (user_id, created_at desc);
-- At most one open attempt per student and career.
create unique index assessment_attempts_one_open_idx
  on public.assessment_attempts (user_id, career_id) where status = 'in_progress';

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete restrict,
  selected_option_index smallint,
  is_correct boolean not null,
  awarded_points smallint not null check (awarded_points >= 0),
  max_points smallint not null check (max_points > 0),
  response_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table public.practical_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.practical_challenges (id) on delete restrict,
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  submission_content text not null check (char_length(submission_content) <= 5000),
  attempted boolean not null,
  awarded_points smallint not null check (awarded_points >= 0),
  max_points smallint not null check (max_points > 0),
  feedback jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (attempt_id, challenge_id)
);
create index practical_submissions_user_idx on public.practical_submissions (user_id);

-- Per-attempt, per-skill breakdown (including skills with insufficient evidence).
create table public.attempt_skill_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete restrict,
  mcq_earned_points smallint not null default 0,
  mcq_available_points smallint not null default 0,
  mcq_question_count smallint not null default 0,
  practical_earned_points smallint,
  practical_available_points smallint,
  mcq_score numeric(5, 2),
  practical_score numeric(5, 2),
  proficiency numeric(5, 2) check (proficiency is null or proficiency between 0 and 100),
  status public.skill_evidence_status not null,
  unique (attempt_id, skill_id)
);

-- Current measured proficiency. Only skills with sufficient evidence get a row.
create table public.user_skill_levels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  current_proficiency numeric(5, 2) not null check (current_proficiency between 0 and 100),
  assessment_status public.skill_evidence_status not null default 'assessed',
  source_attempt_id uuid references public.assessment_attempts (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (user_id, skill_id)
);

create table public.skill_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  proficiency numeric(5, 2) not null check (proficiency between 0 and 100),
  source_type public.skill_source not null,
  source_id uuid not null,
  recorded_at timestamptz not null default now(),
  unique (user_id, skill_id, source_id)
);
create index skill_history_user_idx on public.skill_history (user_id, skill_id, recorded_at);

-- ---------------------------------------------------------------------------
-- Roadmaps
-- ---------------------------------------------------------------------------
create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  career_id uuid not null references public.careers (id) on delete restrict,
  title text not null,
  duration_weeks smallint not null default 6 check (duration_weeks between 1 and 12),
  status public.roadmap_status not null default 'active',
  weekly_minutes_budget integer not null check (weekly_minutes_budget > 0),
  learning_pace public.learning_pace not null,
  generated_from_attempt_id uuid references public.assessment_attempts (id) on delete set null,
  generation_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index roadmaps_user_idx on public.roadmaps (user_id, created_at desc);
create unique index roadmaps_one_active_idx on public.roadmaps (user_id) where status = 'active';
create trigger roadmaps_updated_at before update on public.roadmaps
  for each row execute function public.set_updated_at();

create table public.roadmap_weeks (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 12),
  title text not null,
  objective text not null,
  completion_criterion text not null,
  focus_skill_ids uuid[] not null default '{}',
  unique (roadmap_id, week_number)
);

create table public.learning_tasks (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  roadmap_week_id uuid not null references public.roadmap_weeks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid references public.learning_task_templates (id) on delete set null,
  skill_id uuid references public.skills (id) on delete set null,
  task_type public.task_type not null,
  title text not null,
  description text not null,
  estimated_minutes smallint not null check (estimated_minutes > 0),
  completion_criteria text not null,
  resource_url text,
  sort_order smallint not null default 0,
  depends_on_task_ids uuid[] not null default '{}',
  is_stretch boolean not null default false,
  status public.task_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  actual_minutes smallint check (actual_minutes is null or actual_minutes between 0 and 1440),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null))
);
create index learning_tasks_roadmap_idx on public.learning_tasks (roadmap_id, sort_order);
create index learning_tasks_user_idx on public.learning_tasks (user_id, status);
create index learning_tasks_completed_idx on public.learning_tasks (user_id, completed_at) where completed_at is not null;
create trigger learning_tasks_updated_at before update on public.learning_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AI mentor
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  context_task_id uuid references public.learning_tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.message_role not null,
  content text not null check (char_length(content) between 1 and 20000),
  model text,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_user_rate_idx on public.messages (user_id, created_at) where role = 'user';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.careers enable row level security;
alter table public.skills enable row level security;
alter table public.career_skills enable row level security;
alter table public.skill_dependencies enable row level security;
alter table public.learning_task_templates enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.practical_challenges enable row level security;
alter table public.profiles enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.practical_submissions enable row level security;
alter table public.attempt_skill_scores enable row level security;
alter table public.user_skill_levels enable row level security;
alter table public.skill_history enable row level security;
alter table public.roadmaps enable row level security;
alter table public.roadmap_weeks enable row level security;
alter table public.learning_tasks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Public catalog (read-only for clients).
create policy "catalog readable" on public.careers for select to anon, authenticated using (is_active);
create policy "catalog readable" on public.skills for select to anon, authenticated using (true);
create policy "catalog readable" on public.career_skills for select to anon, authenticated using (true);
create policy "catalog readable" on public.skill_dependencies for select to anon, authenticated using (true);
create policy "catalog readable" on public.learning_task_templates for select to anon, authenticated using (true);

-- Answer keys: no policies, and no table privileges for client roles.
revoke all on public.assessment_questions from anon, authenticated;
revoke all on public.practical_challenges from anon, authenticated;

-- Profiles: owner may read and edit their own row.
create policy "own profile read" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (
  full_name, education_level, institution, graduation_year, interests, current_skills,
  experience_level, target_career_id, weekly_learning_hours, learning_pace, learning_goals,
  onboarding_step, onboarding_completed
) on public.profiles to authenticated;

-- Score-bearing records: owner read-only. Writes happen via service-role functions.
create policy "own attempts read" on public.assessment_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own responses read" on public.assessment_responses for select to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id and a.user_id = (select auth.uid())
  ));
create policy "own practical submissions read" on public.practical_submissions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own attempt skill scores read" on public.attempt_skill_scores for select to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id and a.user_id = (select auth.uid())
  ));
create policy "own skill levels read" on public.user_skill_levels for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own skill history read" on public.skill_history for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on
  public.assessment_attempts, public.assessment_responses, public.practical_submissions,
  public.attempt_skill_scores, public.user_skill_levels, public.skill_history
  from anon, authenticated;

-- Roadmaps: owner read; task progress columns are owner-writable.
create policy "own roadmaps read" on public.roadmaps for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own roadmap weeks read" on public.roadmap_weeks for select to authenticated
  using (exists (
    select 1 from public.roadmaps r
    where r.id = roadmap_id and r.user_id = (select auth.uid())
  ));
create policy "own tasks read" on public.learning_tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own tasks progress update" on public.learning_tasks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke insert, update, delete on public.roadmaps, public.roadmap_weeks, public.learning_tasks
  from anon, authenticated;
grant update (status, started_at, completed_at, actual_minutes, notes) on public.learning_tasks to authenticated;

-- Mentor: owner reads; messages are written by the server after provider calls.
create policy "own conversations read" on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own conversations delete" on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "own messages read" on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update on public.conversations from anon, authenticated;
revoke insert, update, delete on public.messages from anon, authenticated;

revoke all on all tables in schema public from anon;
grant select on public.careers, public.skills, public.career_skills, public.skill_dependencies,
  public.learning_task_templates to anon;

-- ---------------------------------------------------------------------------
-- Transactional write functions (service role only)
-- ---------------------------------------------------------------------------

-- Persist a scored assessment atomically. Scoring itself happens in the application
-- (src/features/assessments/scoring.ts); this function guarantees all-or-nothing writes
-- and prevents double submission via a row lock + status check.
create or replace function public.finalize_assessment(
  p_attempt_id uuid,
  p_user_id uuid,
  p_result jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_source public.skill_source;
  v_now timestamptz := now();
begin
  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt_id
  for update;

  if not found or v_attempt.user_id <> p_user_id then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  v_source := case when v_attempt.kind = 'follow_up'
    then 'follow_up_assessment'::public.skill_source
    else 'initial_assessment'::public.skill_source end;

  insert into public.assessment_responses
    (attempt_id, question_id, selected_option_index, is_correct, awarded_points, max_points)
  select p_attempt_id, (r ->> 'questionId')::uuid, (r ->> 'selectedIndex')::smallint,
         (r ->> 'isCorrect')::boolean, (r ->> 'awardedPoints')::smallint, (r ->> 'maxPoints')::smallint
  from jsonb_array_elements(p_result -> 'responses') r;

  insert into public.practical_submissions
    (user_id, challenge_id, attempt_id, submission_content, attempted, awarded_points, max_points, feedback, submitted_at)
  select p_user_id, (s ->> 'challengeId')::uuid, p_attempt_id, s ->> 'content',
         (s ->> 'attempted')::boolean, (s ->> 'awardedPoints')::smallint, (s ->> 'maxPoints')::smallint,
         coalesce(s -> 'feedback', '[]'::jsonb), v_now
  from jsonb_array_elements(p_result -> 'practicals') s;

  insert into public.attempt_skill_scores
    (attempt_id, skill_id, mcq_earned_points, mcq_available_points, mcq_question_count,
     practical_earned_points, practical_available_points, mcq_score, practical_score, proficiency, status)
  select p_attempt_id, (k ->> 'skillId')::uuid, (k ->> 'mcqEarned')::smallint, (k ->> 'mcqAvailable')::smallint,
         (k ->> 'mcqQuestionCount')::smallint, (k ->> 'practicalEarned')::smallint,
         (k ->> 'practicalAvailable')::smallint, (k ->> 'mcqScore')::numeric, (k ->> 'practicalScore')::numeric,
         (k ->> 'proficiency')::numeric, (k ->> 'status')::public.skill_evidence_status
  from jsonb_array_elements(p_result -> 'skills') k;

  -- Only skills with sufficient evidence update the student's measured proficiency.
  insert into public.user_skill_levels
    (user_id, skill_id, current_proficiency, assessment_status, source_attempt_id, updated_at)
  select p_user_id, (k ->> 'skillId')::uuid, (k ->> 'proficiency')::numeric, 'assessed', p_attempt_id, v_now
  from jsonb_array_elements(p_result -> 'skills') k
  where k ->> 'status' = 'assessed'
  on conflict (user_id, skill_id) do update
    set current_proficiency = excluded.current_proficiency,
        assessment_status = excluded.assessment_status,
        source_attempt_id = excluded.source_attempt_id,
        updated_at = excluded.updated_at;

  insert into public.skill_history (user_id, skill_id, proficiency, source_type, source_id, recorded_at)
  select p_user_id, (k ->> 'skillId')::uuid, (k ->> 'proficiency')::numeric, v_source, p_attempt_id, v_now
  from jsonb_array_elements(p_result -> 'skills') k
  where k ->> 'status' = 'assessed';

  update public.assessment_attempts
  set status = 'submitted',
      submitted_at = v_now,
      mcq_earned_points = (p_result -> 'totals' ->> 'mcqEarned')::integer,
      mcq_available_points = (p_result -> 'totals' ->> 'mcqAvailable')::integer,
      practical_earned_points = (p_result -> 'totals' ->> 'practicalEarned')::integer,
      practical_available_points = (p_result -> 'totals' ->> 'practicalAvailable')::integer,
      total_score = (p_result -> 'totals' ->> 'totalScore')::numeric,
      draft_answers = '{}'::jsonb,
      draft_practicals = '{}'::jsonb
  where id = p_attempt_id;
end;
$$;

-- Replace the student's active roadmap with a freshly generated plan.
-- The previous roadmap (and its completed tasks) is archived, never deleted.
create or replace function public.replace_active_roadmap(
  p_user_id uuid,
  p_plan jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_roadmap_id uuid;
  v_week jsonb;
  v_week_id uuid;
  v_task jsonb;
  v_task_ids jsonb := '{}'::jsonb;
  v_new_id uuid;
begin
  -- Serialize concurrent regenerations for the same student.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 42));

  update public.roadmaps set status = 'archived'
  where user_id = p_user_id and status in ('active', 'completed');

  insert into public.roadmaps
    (user_id, career_id, title, duration_weeks, weekly_minutes_budget, learning_pace,
     generated_from_attempt_id, generation_notes)
  values (
    p_user_id,
    (p_plan ->> 'careerId')::uuid,
    p_plan ->> 'title',
    (p_plan ->> 'durationWeeks')::smallint,
    (p_plan ->> 'weeklyMinutesBudget')::integer,
    (p_plan ->> 'learningPace')::public.learning_pace,
    nullif(p_plan ->> 'attemptId', '')::uuid,
    coalesce(p_plan -> 'notes', '[]'::jsonb)
  )
  returning id into v_roadmap_id;

  for v_week in select * from jsonb_array_elements(p_plan -> 'weeks') loop
    insert into public.roadmap_weeks
      (roadmap_id, week_number, title, objective, completion_criterion, focus_skill_ids)
    values (
      v_roadmap_id,
      (v_week ->> 'weekNumber')::smallint,
      v_week ->> 'title',
      v_week ->> 'objective',
      v_week ->> 'completionCriterion',
      coalesce(array(select jsonb_array_elements_text(v_week -> 'focusSkillIds'))::uuid[], '{}')
    )
    returning id into v_week_id;

    for v_task in select * from jsonb_array_elements(v_week -> 'tasks') loop
      insert into public.learning_tasks
        (roadmap_id, roadmap_week_id, user_id, template_id, skill_id, task_type, title, description,
         estimated_minutes, completion_criteria, resource_url, sort_order, is_stretch, depends_on_task_ids)
      values (
        v_roadmap_id,
        v_week_id,
        p_user_id,
        nullif(v_task ->> 'templateId', '')::uuid,
        nullif(v_task ->> 'skillId', '')::uuid,
        (v_task ->> 'taskType')::public.task_type,
        v_task ->> 'title',
        v_task ->> 'description',
        (v_task ->> 'estimatedMinutes')::smallint,
        v_task ->> 'completionCriteria',
        nullif(v_task ->> 'resourceUrl', ''),
        (v_task ->> 'sortOrder')::smallint,
        coalesce((v_task ->> 'isStretch')::boolean, false),
        -- Dependencies reference earlier tasks by their plan key.
        coalesce(array(
          select (v_task_ids ->> dep)::uuid
          from jsonb_array_elements_text(coalesce(v_task -> 'dependsOn', '[]'::jsonb)) dep
          where v_task_ids ? dep
        ), '{}')
      )
      returning id into v_new_id;
      v_task_ids := v_task_ids || jsonb_build_object(v_task ->> 'key', v_new_id);
    end loop;
  end loop;

  return v_roadmap_id;
end;
$$;

revoke execute on function public.finalize_assessment(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.replace_active_roadmap(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.finalize_assessment(uuid, uuid, jsonb) to service_role;
grant execute on function public.replace_active_roadmap(uuid, jsonb) to service_role;
