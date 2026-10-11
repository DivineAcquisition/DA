-- A lesson quiz must be passed at 85 percent, within 3 attempts, before the lesson can be marked complete.
-- The final module quiz keeps its own attempt rules.

create table public.academy_lesson_quiz_attempt (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  questions_drawn uuid[] not null,
  answers jsonb not null default '{}'::jsonb,
  score integer,
  total integer,
  passed boolean,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index academy_lesson_quiz_attempt_lookup
  on public.academy_lesson_quiz_attempt (enrollment_id, lesson_id, started_at desc);

create unique index academy_lesson_quiz_one_open
  on public.academy_lesson_quiz_attempt (enrollment_id, lesson_id)
  where finished_at is null;

comment on table public.academy_lesson_quiz_attempt is
  'One sitting of a lesson quiz. Three finished attempts. Pass is 85 percent. Does not record the final quiz.';

alter table public.academy_lesson_quiz_attempt enable row level security;
revoke all on public.academy_lesson_quiz_attempt from anon, authenticated;

create or replace function app.academy_lesson_has_quiz(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_question q
    join public.academy_concept c on c.id = q.concept_id
    where c.lesson_id = p_lesson_id and q.active
  );
$$;

create or replace function app.academy_lesson_quiz_passed(p_enrollment_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_lesson_quiz_attempt a
    where a.enrollment_id = p_enrollment_id
      and a.lesson_id = p_lesson_id
      and a.passed is true
  );
$$;

create or replace function app.academy_completion_gaps(p_enrollment_id uuid, p_lesson_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson public.academy_lesson;
  v_progress public.academy_progress;
  v_duration integer;
  v_watched integer;
  v_pct numeric;
  v_gaps text[] := '{}';
begin
  select * into v_lesson from public.academy_lesson where id = p_lesson_id;
  select * into v_progress
  from public.academy_progress
  where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;

  if v_lesson.video_asset_id is not null then
    select duration_seconds into v_duration from public.academy_asset where id = v_lesson.video_asset_id;
    v_watched := coalesce(v_progress.watched_seconds, 0);
    if v_duration is null or v_duration <= 0 then
      v_gaps := array_append(v_gaps, 'This video has no duration yet.');
    else
      v_pct := v_watched::numeric / v_duration * 100;
      if v_pct < v_lesson.required_watch_percent then
        v_gaps := array_append(v_gaps, format('Watch %s%% of the video.', v_lesson.required_watch_percent));
      end if;
    end if;
  elsif app.academy_word_count(v_lesson.body) > 0 then
    if coalesce(v_progress.reading_seconds, 0) < app.academy_reading_seconds(v_lesson.body) then
      v_gaps := array_append(v_gaps, 'Stay on the page long enough to read the lesson.');
    end if;
    if not coalesce(v_progress.scrolled_to_end, false) then
      v_gaps := array_append(v_gaps, 'Scroll to the end of the lesson.');
    end if;
  else
    v_gaps := array_append(v_gaps, 'This lesson has no video or written lesson.');
  end if;

  if v_lesson.document_asset_id is not null
     and (v_progress.document_opened_at is null or v_progress.document_asset_id is distinct from v_lesson.document_asset_id) then
    v_gaps := array_append(v_gaps, 'Open the companion document.');
  end if;

  if app.academy_lesson_has_quiz(p_lesson_id)
     and not app.academy_lesson_quiz_passed(p_enrollment_id, p_lesson_id) then
    v_gaps := array_append(v_gaps, 'Pass the lesson quiz.');
  end if;

  return v_gaps;
end;
$$;

create or replace function app.academy_lesson_quiz_questions(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'prompt', q.prompt,
    'scenario', q.scenario,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object('id', opt ->> 'id', 'text', opt ->> 'text')), '[]'::jsonb)
      from jsonb_array_elements(q.options) opt
    )
  ) order by array_position(p_ids, q.id)), '[]'::jsonb)
  from public.academy_question q
  where q.id = any(p_ids);
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
    'attempts_allowed', 3,
    'attempts_remaining', greatest(3 - v_used, 0),
    'pass_percent', 85,
    'preview', false,
    'attempt', case when v_open.id is null then null else jsonb_build_object(
      'id', v_open.id,
      'answers', v_open.answers,
      'questions', app.academy_lesson_quiz_questions(v_open.questions_drawn)
    ) end
  );
end;
$$;

create or replace function public.academy_lesson_quiz_start(p_lesson_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_used integer;
  v_open public.academy_lesson_quiz_attempt;
  v_ids uuid[];
begin
  if v_enrollment.id is null or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    raise exception 'lesson_closed' using errcode = '42501';
  end if;
  if not app.academy_lesson_has_quiz(p_lesson_id) then
    raise exception 'no_quiz: this lesson has no quiz' using errcode = 'P0002';
  end if;
  if app.academy_lesson_quiz_passed(v_enrollment.id, p_lesson_id) then
    raise exception 'already_passed: this lesson quiz is already passed' using errcode = '42501';
  end if;
  select * into v_open
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is null
  limit 1;
  if v_open.id is not null then
    return public.academy_lesson_quiz_state(p_lesson_id);
  end if;
  select count(*) into v_used
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is not null;
  if v_used >= 3 then
    raise exception 'attempts_used: this lesson quiz has no attempts left' using errcode = '42501';
  end if;
  select coalesce(array_agg(q.id order by random()), '{}') into v_ids
  from public.academy_question q
  join public.academy_concept c on c.id = q.concept_id
  where c.lesson_id = p_lesson_id and q.active;
  insert into public.academy_lesson_quiz_attempt (enrollment_id, lesson_id, questions_drawn)
  values (v_enrollment.id, p_lesson_id, v_ids);
  return public.academy_lesson_quiz_state(p_lesson_id);
end;
$$;

create or replace function public.academy_lesson_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v public.academy_lesson_quiz_attempt;
begin
  select * into v from public.academy_lesson_quiz_attempt where id = p_attempt_id;
  if v.id is null or v.enrollment_id is distinct from v_enrollment.id or v.finished_at is not null then
    raise exception 'attempt_closed' using errcode = '42501';
  end if;
  if not (p_question_id = any(v.questions_drawn)) then
    raise exception 'bad_question' using errcode = '22023';
  end if;
  update public.academy_lesson_quiz_attempt
  set answers = jsonb_set(coalesce(answers, '{}'::jsonb), array[p_question_id::text], to_jsonb(p_option_id), true)
  where id = v.id;
  return public.academy_lesson_quiz_state(v.lesson_id);
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
  return public.academy_lesson_quiz_state(v.lesson_id) || jsonb_build_object(
    'result', jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_percent, 'passed', v_passed)
  );
end;
$$;

revoke all on function public.academy_lesson_quiz_state(uuid) from public, anon;
revoke all on function public.academy_lesson_quiz_start(uuid) from public, anon;
revoke all on function public.academy_lesson_quiz_answer(uuid, uuid, text) from public, anon;
revoke all on function public.academy_lesson_quiz_submit(uuid) from public, anon;
grant execute on function public.academy_lesson_quiz_state(uuid) to authenticated;
grant execute on function public.academy_lesson_quiz_start(uuid) to authenticated;
grant execute on function public.academy_lesson_quiz_answer(uuid, uuid, text) to authenticated;
grant execute on function public.academy_lesson_quiz_submit(uuid) to authenticated;

update public.academy_quiz
set max_attempts = 3,
    pass_mark = 85,
    pass_mark_unit = 'percent'
where kind = 'module';

update public.academy_lesson
set body = replace(
  body,
  'The Module 6 quiz draws from these notes. An attempt has 5 questions. You pass with 4 correct.',
  'Pass this lesson quiz before you can mark the lesson complete. You have 3 attempts. You need 85 percent.'
)
where lesson_code = 'M06-L01'
  and body like '%An attempt has 5 questions.%';
