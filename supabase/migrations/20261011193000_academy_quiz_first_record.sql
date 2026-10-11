-- The first failed quiz attempt keeps a record of the answers that were wrong.

create or replace function app.academy_module_first_record(p_enrollment uuid, p_quiz uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_attempt;
begin
  select * into v
  from public.academy_attempt
  where enrollment_id = p_enrollment and quiz_id = p_quiz and finished_at is not null
  order by finished_at asc
  limit 1;
  if v.id is null or v.passed is true then
    return null;
  end if;
  return jsonb_build_object(
    'attempt_number', v.attempt_number,
    'score', v.score,
    'total', coalesce(array_length(v.questions_drawn, 1), 0),
    'passed', false,
    'misses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item ->> 'id',
        'prompt', item ->> 'prompt',
        'scenario', item ->> 'scenario',
        'your_text', coalesce(nullif(item ->> 'your_text', ''), 'No answer selected'),
        'correct_text', item ->> 'correct_text',
        'explanation', item ->> 'explanation'
      ) order by ord)
      from jsonb_array_elements(app.academy_public_questions(v.id, true)) with ordinality as listed(item, ord)
      where coalesce(item ->> 'selected', '') is distinct from coalesce(item ->> 'correct_option_id', '')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function app.academy_module_first_record(uuid, uuid) from public, anon, authenticated;

create or replace function app.academy_lesson_first_record(p_enrollment uuid, p_lesson uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_lesson_quiz_attempt;
begin
  select * into v
  from public.academy_lesson_quiz_attempt
  where enrollment_id = p_enrollment and lesson_id = p_lesson and finished_at is not null
  order by finished_at asc
  limit 1;
  if v.id is null or v.passed is true then
    return null;
  end if;
  return jsonb_build_object(
    'attempt_number', 1,
    'score', v.score,
    'total', coalesce(v.total, 0),
    'passed', false,
    'misses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'prompt', q.prompt,
        'scenario', q.scenario,
        'your_text', coalesce((
          select opt ->> 'text'
          from jsonb_array_elements(q.options) opt
          where opt ->> 'id' = v.answers ->> q.id::text
          limit 1
        ), 'No answer selected'),
        'correct_text', (
          select opt ->> 'text'
          from jsonb_array_elements(q.options) opt
          where opt ->> 'id' = q.correct_answer
          limit 1
        ),
        'explanation', q.explanation
      ) order by drawn.ord)
      from unnest(v.questions_drawn) with ordinality as drawn(qid, ord)
      join public.academy_question q on q.id = drawn.qid
      where coalesce(v.answers ->> q.id::text, '') is distinct from coalesce(q.correct_answer, '')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function app.academy_lesson_first_record(uuid, uuid) from public, anon, authenticated;

create or replace function public.academy_quiz_state(p_module_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_module public.academy_module;
  v_quiz public.academy_quiz;
  v_card jsonb;
  v_open public.academy_attempt;
  v_last public.academy_attempt;
  v_other uuid;
  v_phase text;
  v_reveal boolean := false;
  v_warning text;
  v_result jsonb;
  v_rules text;
begin
  if v_enrollment.id is not null then
    perform app.academy_prepare_enrollment(v_enrollment.id);
  end if;
  if v_enrollment.id is null or not app.academy_content_open(v_enrollment.id) then
    return jsonb_build_object(
      'phase', case when v_enrollment.status = 'on_hold_review' then 'held' else 'unavailable' end,
      'can_start', false
    );
  end if;
  select * into v_module from public.academy_module where id = p_module_id and program_id = v_enrollment.program_id;
  if v_module.id is null or not app.academy_module_unlocked(v_enrollment.id, v_module.id) then
    return jsonb_build_object('phase', 'unavailable', 'can_start', false, 'blocked', 'locked');
  end if;
  select * into v_quiz from public.academy_quiz where module_id = v_module.id;
  if v_quiz.id is null then
    return jsonb_build_object('phase', 'unavailable', 'can_start', false, 'blocked', 'pool');
  end if;

  v_card := app.academy_quiz_card(v_enrollment.id, v_module.id);
  select * into v_open from public.academy_attempt
  where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and finished_at is null;
  select * into v_last from public.academy_attempt
  where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and finished_at is not null
  order by finished_at desc limit 1;
  select a.quiz_id into v_other from public.academy_attempt a
  where a.enrollment_id = v_enrollment.id and a.finished_at is null and a.quiz_id <> v_quiz.id
  limit 1;

  if v_card ->> 'status' = 'passed' then
    v_phase := 'pass';
    v_reveal := true;
    select * into v_last from public.academy_attempt
    where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and passed is true
    order by finished_at desc limit 1;
  elsif v_open.id is not null then
    v_phase := 'take';
  elsif v_card ->> 'status' = 'not_available' then
    v_phase := 'unavailable';
  elsif v_last.id is not null and v_last.passed is not true then
    v_phase := 'fail';
  else
    v_phase := 'start';
  end if;

  if coalesce((v_card ->> 'attempts_remaining')::integer, 0) = 1 and v_phase in ('fail', 'start') then
    v_warning := 'Only one attempt remains. Failing it places the program on review.';
  end if;

  if v_last.id is not null and v_phase in ('fail', 'pass') then
    v_result := jsonb_build_object(
      'score', v_last.score,
      'total', coalesce(array_length(v_last.questions_drawn, 1), v_quiz.questions_per_attempt),
      'pass_mark_label', app.academy_pass_label(
        coalesce((v_last.rules ->> 'pass_mark')::numeric, v_quiz.pass_mark),
        coalesce(v_last.rules ->> 'pass_mark_unit', v_quiz.pass_mark_unit),
        coalesce((v_last.rules ->> 'questions_per_attempt')::integer, v_quiz.questions_per_attempt)
      ),
      'abandoned', v_last.abandoned,
      'warning', v_warning,
      'concepts', case when v_reveal then '[]'::jsonb else app.academy_fail_concepts(v_last.id) end,
      'review', case when v_reveal then app.academy_public_questions(v_last.id, true) else '[]'::jsonb end,
      'breakdown', case when v_reveal and v_quiz.kind = 'final' then app.academy_final_breakdown(v_last.id) else '[]'::jsonb end
    );
  end if;

  v_rules := format(
    'This attempt has %s questions. Pass mark: %s. You have %s of %s attempts left. A failed attempt locks the next one for %s minutes. Unanswered questions are wrong. Leaving does not give you another attempt.',
    v_quiz.questions_per_attempt,
    app.academy_pass_label(v_quiz.pass_mark, v_quiz.pass_mark_unit, v_quiz.questions_per_attempt),
    v_card ->> 'attempts_remaining',
    v_card ->> 'attempts_allowed',
    v_quiz.lockout_minutes
  );
  if v_quiz.time_limit_seconds is not null then
    v_rules := v_rules || format(' You have %s minutes.', round(v_quiz.time_limit_seconds / 60.0));
  end if;

  return jsonb_build_object(
    'phase', v_phase,
    'can_start', v_card ->> 'status' = 'available' and v_open.id is null and v_other is null,
    'blocked', case
      when v_card ->> 'retry_block' = 'acknowledge' then 'acknowledge'
      when v_card ->> 'retry_block' = 'retest' then 'retest'
      when v_card ->> 'retry_block' = 'lessons' then 'plan_lessons'
      when v_card ->> 'status' = 'not_available' and not app.academy_lessons_complete(v_enrollment.id, v_module.id) then 'lessons'
      when v_card ->> 'status' = 'not_available' then 'pool'
      when v_other is not null then 'other'
      when v_card ->> 'status' = 'locked' and v_last.lockout_until > now() then 'lockout'
      when v_card ->> 'status' = 'locked' then 'reopen'
      else null
    end,
    'module_id', v_module.id,
    'module_title', v_module.title,
    'module_order', v_module.order_number,
    'kind', v_quiz.kind,
    'rules', v_rules,
    'pass_mark_label', app.academy_pass_label(v_quiz.pass_mark, v_quiz.pass_mark_unit, v_quiz.questions_per_attempt),
    'questions_per_attempt', v_quiz.questions_per_attempt,
    'lockout_minutes', v_quiz.lockout_minutes,
    'time_limit_seconds', v_quiz.time_limit_seconds,
    'attempts_used', v_card -> 'attempts_used',
    'attempts_allowed', v_card -> 'attempts_allowed',
    'attempts_remaining', v_card -> 'attempts_remaining',
    'lockout_until', v_card -> 'lockout_until',
    'reopen', coalesce(v_card -> 'reopen', '[]'::jsonb),
    'retest_on', v_card -> 'retest_on',
    'warning', v_warning,
    'attempt', case when v_open.id is null then null else jsonb_build_object(
      'id', v_open.id,
      'started_at', v_open.started_at,
      'time_limit_seconds', nullif(v_open.rules ->> 'time_limit_seconds', '')::integer,
      'questions', app.academy_public_questions(v_open.id, false)
    ) end,
    'result', v_result,
    'first_attempt', app.academy_module_first_record(v_enrollment.id, v_quiz.id)
  );
end;
$$;


create or replace function public.academy_lesson_quiz_state(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment;
  v_used integer;
  v_allowed integer;
  v_open public.academy_lesson_quiz_attempt;
  v_passed boolean;
begin
  if not app.academy_lesson_has_quiz(p_lesson_id) then
    return jsonb_build_object('has_quiz', false);
  end if;
  if app.academy_manages() then
    return jsonb_build_object(
      'has_quiz', true,
      'passed', false,
      'attempts_used', 0,
      'attempts_allowed', 3,
      'attempts_remaining', 3,
      'pass_percent', 85,
      'preview', true,
      'flagged', false,
      'questions', app.academy_lesson_quiz_questions(array(
        select q.id
        from public.academy_question q
        join public.academy_concept c on c.id = q.concept_id
        where c.lesson_id = p_lesson_id and q.active
        order by q.created_at
      ))
    );
  end if;
  v_enrollment := app.academy_primary_for_actor();
  if v_enrollment.id is null
     or not app.academy_content_open(v_enrollment.id)
     or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    return jsonb_build_object('has_quiz', false);
  end if;
  v_allowed := app.academy_lesson_attempts_allowed(v_enrollment.id, p_lesson_id);
  select count(*) into v_used
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is not null;
  v_passed := app.academy_lesson_quiz_passed(v_enrollment.id, p_lesson_id);
  select * into v_open
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is null
  order by started_at desc
  limit 1;
  return jsonb_build_object(
    'has_quiz', true,
    'passed', v_passed,
    'attempts_used', v_used,
    'attempts_allowed', v_allowed,
    'attempts_remaining', greatest(v_allowed - v_used, 0),
    'pass_percent', 85,
    'preview', false,
    'flagged', (not v_passed) and v_used >= v_allowed,
    'first_attempt', app.academy_lesson_first_record(v_enrollment.id, p_lesson_id),
    'attempt', case when v_open.id is null then null else jsonb_build_object(
      'id', v_open.id,
      'answers', v_open.answers,
      'questions', app.academy_lesson_quiz_questions(v_open.questions_drawn)
    ) end
  );
end;
$$;


create or replace function public.academy_lesson_quiz_submit(p_attempt_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v public.academy_lesson_quiz_attempt;
  v_q uuid;
  v_selected text;
  v_correct_id text;
  v_score integer := 0;
  v_total integer := 0;
  v_percent numeric;
  v_passed boolean;
  v_used integer;
  v_allowed integer;
  v_flagged boolean := false;
begin
  select * into v from public.academy_lesson_quiz_attempt where id = p_attempt_id for update;
  if v.id is null or v.enrollment_id is distinct from v_enrollment.id or v.finished_at is not null then
    raise exception 'attempt_closed' using errcode = '42501';
  end if;
  foreach v_q in array v.questions_drawn
  loop
    v_total := v_total + 1;
    v_selected := v.answers ->> v_q::text;
    select correct_answer into v_correct_id from public.academy_question where id = v_q;
    if v_selected is not null and v_selected = v_correct_id then
      v_score := v_score + 1;
    end if;
  end loop;
  v_percent := case when v_total = 0 then 0 else round(100.0 * v_score / v_total, 1) end;
  v_passed := v_total > 0 and (v_score::numeric / v_total * 100) >= 85;
  update public.academy_lesson_quiz_attempt
  set score = v_score,
      total = v_total,
      passed = v_passed,
      finished_at = now()
  where id = v.id;
  v_allowed := app.academy_lesson_attempts_allowed(v.enrollment_id, v.lesson_id);
  select count(*) into v_used
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v.enrollment_id and lesson_id = v.lesson_id and finished_at is not null;
  if not v_passed and v_used >= v_allowed then
    perform app.academy_flag_lesson_quiz(v.enrollment_id, v.lesson_id, v_used);
    v_flagged := true;
  end if;
  return jsonb_build_object(
    'has_quiz', true,
    'passed', v_passed,
    'attempts_used', v_used,
    'attempts_allowed', v_allowed,
    'attempts_remaining', greatest(v_allowed - v_used, 0),
    'pass_percent', 85,
    'preview', false,
    'flagged', v_flagged,
    'first_attempt', app.academy_lesson_first_record(v.enrollment_id, v.lesson_id),
    'result', jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_percent, 'passed', v_passed)
  );
end;
$$;
