-- Questions for one lesson, without the answer key, plus a check that reveals the explanation after a choice.

create or replace function public.academy_lesson_quiz(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson public.academy_lesson;
  v_quiz public.academy_quiz;
  v_enrollment public.academy_enrollment;
begin
  select * into v_lesson from public.academy_lesson where id = p_lesson_id and archived_at is null;
  if not found or v_lesson.id is null then
    return jsonb_build_object('questions', '[]'::jsonb);
  end if;
  if not app.academy_manages() then
    v_enrollment := app.academy_primary_for_actor();
    if v_enrollment.id is null
       or not app.academy_content_open(v_enrollment.id)
       or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
      return jsonb_build_object('questions', '[]'::jsonb);
    end if;
  end if;
  select * into v_quiz from public.academy_quiz where module_id = v_lesson.module_id and kind = 'module';
  return jsonb_build_object(
    'lesson_id', v_lesson.id,
    'module_id', v_lesson.module_id,
    'questions_per_attempt', v_quiz.questions_per_attempt,
    'pass_mark_label', case when v_quiz.id is null then null else app.academy_pass_label(v_quiz.pass_mark, v_quiz.pass_mark_unit, v_quiz.questions_per_attempt) end,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'prompt', q.prompt,
        'scenario', q.scenario,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object('id', opt ->> 'id', 'text', opt ->> 'text') order by opt ->> 'id'), '[]'::jsonb)
          from jsonb_array_elements(q.options) opt
        )
      ) order by q.created_at)
      from public.academy_question q
      join public.academy_concept c on c.id = q.concept_id
      where c.lesson_id = p_lesson_id and q.active
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.academy_lesson_quiz(uuid) is
  'Active quiz questions for one lesson. Options only. The answer is checked separately.';

create or replace function public.academy_check_lesson_answer(p_question_id uuid, p_option_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_question public.academy_question;
  v_lesson uuid;
  v_enrollment public.academy_enrollment;
  v_correct_text text;
begin
  select q.* into v_question from public.academy_question q where q.id = p_question_id and q.active;
  if not found or v_question.id is null then
    return jsonb_build_object('ok', false);
  end if;
  select c.lesson_id into v_lesson from public.academy_concept c where c.id = v_question.concept_id;
  if v_lesson is null then
    return jsonb_build_object('ok', false);
  end if;
  if not app.academy_manages() then
    v_enrollment := app.academy_primary_for_actor();
    if v_enrollment.id is null
       or not app.academy_content_open(v_enrollment.id)
       or not app.academy_lesson_open(v_enrollment.id, v_lesson) then
      return jsonb_build_object('ok', false);
    end if;
  end if;
  select opt ->> 'text' into v_correct_text
  from jsonb_array_elements(v_question.options) opt
  where opt ->> 'id' = v_question.correct_answer;
  return jsonb_build_object(
    'ok', true,
    'correct', v_question.correct_answer = p_option_id,
    'explanation', v_question.explanation,
    'correct_text', v_correct_text
  );
end;
$$;

comment on function public.academy_check_lesson_answer(uuid, text) is
  'Checks one lesson-quiz choice and returns the explanation. Does not record an attempt.';

revoke all on function public.academy_lesson_quiz(uuid) from public, anon;
revoke all on function public.academy_check_lesson_answer(uuid, text) from public, anon;
grant execute on function public.academy_lesson_quiz(uuid) to authenticated;
grant execute on function public.academy_check_lesson_answer(uuid, text) to authenticated;
