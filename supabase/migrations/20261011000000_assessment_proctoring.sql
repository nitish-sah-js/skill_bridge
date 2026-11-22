-- Proctoring for assessments: count rule breaks (leaving the test window, leaving fullscreen,
-- reloading, the Print Screen key) and mark attempts that were submitted automatically.

alter table public.assessment_attempts
  add column violation_count integer not null default 0 check (violation_count >= 0),
  add column violations jsonb not null default '[]'::jsonb,
  add column auto_submitted boolean not null default false;

-- Record one rule break on an open attempt and return the new count. The app decides
-- what happens at the threshold (warn or auto-submit through finalize_assessment).
create or replace function public.record_assessment_violation(
  p_attempt_id uuid,
  p_user_id uuid,
  p_type text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
begin
  if p_type not in ('focus_lost', 'fullscreen_exit', 'reload', 'screenshot_key') then
    raise exception 'INVALID_VIOLATION_TYPE' using errcode = '22023';
  end if;

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

  update public.assessment_attempts
  set violation_count = violation_count + 1,
      violations = violations || jsonb_build_array(jsonb_build_object('type', p_type, 'at', now()))
  where id = p_attempt_id;

  return v_attempt.violation_count + 1;
end;
$$;

revoke execute on function public.record_assessment_violation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_assessment_violation(uuid, uuid, text) to service_role;

-- finalize_assessment now also stores whether the submission was automatic.
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
      auto_submitted = coalesce((p_result ->> 'autoSubmitted')::boolean, false),
      draft_answers = '{}'::jsonb,
      draft_practicals = '{}'::jsonb
  where id = p_attempt_id;
end;
$$;

revoke execute on function public.finalize_assessment(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_assessment(uuid, uuid, jsonb) to service_role;
