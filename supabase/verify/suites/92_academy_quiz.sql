-- Quiz engine. Draws, scoring, secrecy, lockouts, and holds.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== shuffle changes order, and the curriculum gates are in place =='
do $$
declare
  v_changed integer := 0;
  i integer;
begin
  for i in 1..40 loop
    if app.academy_permute('["a","b","c","d"]'::jsonb) <> '["a","b","c","d"]'::jsonb then
      v_changed := v_changed + 1;
    end if;
  end loop;
  assert v_changed > 0, 'shuffle did not reorder';
  assert (select count(*) from public.academy_gate_part gp
    join public.academy_module m on m.id = gp.module_id
    join public.academy_program p on p.id = m.program_id
    where p.slug = 'da-operator-academy' and m.order_number = 2) = 2, 'module 2 has a quiz and a practical';
  assert (select count(*) from public.academy_gate_part gp
    join public.academy_module m on m.id = gp.module_id
    join public.academy_program p on p.id = m.program_id
    where p.slug = 'da-operator-academy' and m.order_number = 8) = 3, 'module 8 has a quiz and two simulations';
end $$;

\echo '== a live lesson, a pool, and one signed trainee =='
do $$
declare
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_module uuid;
  v_lesson uuid;
  v_concept uuid;
  v_quiz uuid;
  i integer;
begin
  insert into auth.users (id, email) values (v_admin, 'admin@divineacquisition.io') on conflict (id) do nothing;
  update public.profile set role = 'admin', state = 'active' where id = v_admin;
  insert into auth.users (id, email) values
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'quiz.trainee@academy.test'),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'quiz.other@academy.test'),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'quiz.hold@academy.test');
  update public.profile set role = 'operator', state = 'active'
  where id in (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
  );
  insert into public.operator (id, profile_id, name, email, status) values
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc11', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Quiz Trainee', 'quiz.trainee@academy.test', 'applicant'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc12', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'Other', 'quiz.other@academy.test', 'applicant'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc13', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'Hold', 'quiz.hold@academy.test', 'applicant');
  insert into public.da_agreement_template (id, name, recipient_type, docuseal_template_id)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccc41', 'Quiz agreement', 'operator', 'academy-quiz-template')
  on conflict (id) do nothing;
  insert into public.da_recipient (id, full_name, email, recipient_type, operator_id) values
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc31', 'Quiz Trainee', 'quiz.trainee@academy.test', 'operator', 'cccccccc-cccc-4ccc-8ccc-cccccccccc11'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc32', 'Other', 'quiz.other@academy.test', 'operator', 'cccccccc-cccc-4ccc-8ccc-cccccccccc12'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc33', 'Hold', 'quiz.hold@academy.test', 'operator', 'cccccccc-cccc-4ccc-8ccc-cccccccccc13');
  insert into public.da_agreement (id, recipient_id, template_id, status, docuseal_submission_id) values
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc51', 'cccccccc-cccc-4ccc-8ccc-cccccccccc31', 'cccccccc-cccc-4ccc-8ccc-cccccccccc41', 'completed', 'academy-quiz-a'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc52', 'cccccccc-cccc-4ccc-8ccc-cccccccccc32', 'cccccccc-cccc-4ccc-8ccc-cccccccccc41', 'completed', 'academy-quiz-b'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccc53', 'cccccccc-cccc-4ccc-8ccc-cccccccccc33', 'cccccccc-cccc-4ccc-8ccc-cccccccccc41', 'completed', 'academy-quiz-c');

  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  perform set_config('request.jwt.claim.sub', v_admin::text, false);
  perform public.academy_save_lesson(jsonb_build_object(
    'module_id', v_module, 'lesson_code', 'M01-L01', 'title', 'Who we are', 'sort_order', 1,
    'body', 'The offer.', 'status', 'live', 'required_watch_percent', 90
  ));
  select id into v_lesson from public.academy_lesson where lesson_code = 'M01-L01';
  perform public.academy_save_concept(jsonb_build_object(
    'module_id', v_module, 'name', 'Offer', 'lesson_id', v_lesson
  ));
  select id into v_concept from public.academy_concept where module_id = v_module and name = 'Offer';
  for i in 1..8 loop
    perform public.academy_save_question(jsonb_build_object(
      'module_id', v_module,
      'prompt', 'Question ' || i,
      'question_type', 'multiple_choice',
      'options', jsonb_build_array(
        jsonb_build_object('id', 'a', 'text', 'Alpha ' || i),
        jsonb_build_object('id', 'b', 'text', 'Beta ' || i),
        jsonb_build_object('id', 'c', 'text', 'Gamma ' || i),
        jsonb_build_object('id', 'd', 'text', 'Delta ' || i)
      ),
      'correct_answer', 'b',
      'explanation', 'Because ' || i,
      'concept_id', v_concept,
      'difficulty', 'medium',
      'active', true
    ));
  end loop;

  insert into public.academy_enrollment (profile_id, program_id, track, status)
  select u.id, p.id, 'Core', 'active'
  from public.academy_program p
  join (values
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::uuid),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2'::uuid),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3'::uuid)
  ) as u(id) on true
  where p.slug = 'da-operator-academy';

  insert into public.academy_progress (enrollment_id, lesson_id, status, completed_at, completed_version)
  select e.id, v_lesson, 'completed', now(), 1
  from public.academy_enrollment e
  where e.profile_id in (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
  );

  select id into v_quiz from public.academy_quiz where module_id = v_module;
  assert app.academy_quiz_servable(v_quiz), 'eight questions make the module quiz live';
  assert app.academy_pool_message(v_quiz) like '%Repeated attempts%', 'a pool under 15 warns';
end $$;

\echo '== the draw hides the key, prefers unseen questions, and counts an open attempt =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', false); end $$;
do $$
declare
  v_module uuid;
  v jsonb;
  v_attempt uuid;
  v_first uuid[];
  v_unseen uuid[];
  v_second uuid[];
begin
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  assert public.academy_shell() -> 'modules' -> 1 ->> 'display' = 'quiz_available',
    public.academy_shell() -> 'modules' -> 1 ->> 'display';
  assert public.academy_shell() -> 'next_action' ->> 'title' = 'Take the Module 1 quiz';

  v := public.academy_start_quiz(v_module, 'phone');
  assert v ->> 'phase' = 'take', v ->> 'phase';
  assert jsonb_array_length(v -> 'attempt' -> 'questions') = 5;
  assert v -> 'attempt' -> 'questions' -> 0 ? 'explanation' = false, 'no explanation while taking';
  assert v -> 'attempt' -> 'questions' -> 0 ? 'correct_option_id' = false, 'no correct id while taking';
  assert (v -> 'attempt' -> 'questions' -> 0 ->> 'prompt') like 'Question %';
  v_attempt := (v -> 'attempt' ->> 'id')::uuid;
  v := public.academy_start_quiz(v_module, 'phone');
  assert (v -> 'attempt' ->> 'id')::uuid = v_attempt, 'a second start resumes the open attempt';
  assert (select count(*) from public.academy_attempt) = 1, 'one open attempt';
  assert (select count(*) from public.academy_attempt_key) = 0, 'the key is not readable';
  assert (select count(*) from public.academy_question) = 0, 'the pool is not readable';
  assert (select count(*) from public.academy_attempt_flag) = 0, 'the speed flag is not readable';

  select questions_drawn into v_first from public.academy_attempt where id = v_attempt;
  v := public.academy_submit_quiz(v_attempt);
  assert v ->> 'phase' = 'fail', v ->> 'phase';
  assert (v -> 'result' ->> 'score')::int = 0;
  assert jsonb_array_length(v -> 'result' -> 'review') = 0, 'a fail has no review';
  assert v::text not like '%Because %', 'a fail does not include the explanation';
  assert jsonb_array_length(v -> 'result' -> 'concepts') > 0, 'a fail names the missed concept';
  assert v ->> 'can_start' = 'false';
  assert v ->> 'blocked' = 'lockout';
  perform public.academy_record_lesson_open((v -> 'result' -> 'concepts' -> 0 ->> 'lesson_id')::uuid);
end $$;

reset role;
update public.academy_attempt
set lockout_until = now() - interval '1 minute'
where enrollment_id = (
  select id from public.academy_enrollment where profile_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
) and passed is not true and finished_at is not null;

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', false); end $$;
do $$
declare
  v_module uuid;
  v jsonb;
  v_attempt uuid;
  v_first uuid[];
  v_second uuid[];
begin
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  v := public.academy_quiz_state(v_module);
  assert v ->> 'can_start' = 'true', v ->> 'blocked';

  v := public.academy_start_quiz(v_module, 'desktop');
  select questions_drawn into v_second from public.academy_attempt where finished_at is null;
end $$;

reset role;
do $$
declare
  v_module uuid;
  v_first uuid[];
  v_second uuid[];
  v_unseen uuid[];
begin
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  select questions_drawn into v_first
  from public.academy_attempt a
  join public.academy_enrollment e on e.id = a.enrollment_id
  where e.profile_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and a.attempt_number = 1;
  select questions_drawn into v_second
  from public.academy_attempt a
  join public.academy_enrollment e on e.id = a.enrollment_id
  where e.profile_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and a.finished_at is null;
  select coalesce(array_agg(id), '{}') into v_unseen from public.academy_question q
  where q.module_id = v_module and not (q.id = any(v_first));
  assert coalesce(array_length(v_unseen, 1), 0) = 3, 'three questions were held back';
  assert v_unseen <@ v_second, 'the second attempt uses unseen questions first';
end $$;

set role authenticated;

\echo '== another trainee cannot read the attempt, and a pass keeps the review =='
do $$ begin perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_attempt) = 0;
  assert (select count(*) from public.academy_question) = 0;
  assert (select count(*) from public.academy_attempt_key) = 0;
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', false); end $$;
do $$
declare
  v_module uuid;
  v_attempt uuid;
  v_answers jsonb := '[]'::jsonb;
  v_item jsonb;
  v_n integer := 0;
  v jsonb;
begin
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  select id into v_attempt from public.academy_attempt where finished_at is null;
  for v_item in
    select value from public.academy_attempt_key k, lateral jsonb_array_elements(k.questions)
    where k.attempt_id = v_attempt
  loop
    v_n := v_n + 1;
    v_answers := v_answers || jsonb_build_array(jsonb_build_object(
      'question_id', v_item ->> 'id',
      'option_id', case when v_n = 1 then 'a' else v_item ->> 'correct_id' end
    ));
  end loop;
  update public.academy_attempt set answers = v_answers where id = v_attempt;
  assert not found, 'the trainee cannot write an attempt';
end $$;

reset role;
do $$
declare
  v_attempt uuid;
  v_answers jsonb := '[]'::jsonb;
  v_item jsonb;
  v_n integer := 0;
begin
  select id into v_attempt from public.academy_attempt where finished_at is null;
  for v_item in
    select value from public.academy_attempt_key k, lateral jsonb_array_elements(k.questions)
    where k.attempt_id = v_attempt
  loop
    v_n := v_n + 1;
    v_answers := v_answers || jsonb_build_array(jsonb_build_object(
      'question_id', v_item ->> 'id',
      'option_id', case when v_n = 1 then 'a' else v_item ->> 'correct_id' end
    ));
  end loop;
  update public.academy_attempt set answers = v_answers where id = v_attempt;
end $$;

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', false); end $$;
do $$
declare
  v_module uuid;
  v_attempt uuid;
  v jsonb;
  v_before integer;
begin
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  select id into v_attempt from public.academy_attempt where finished_at is null;
  v := public.academy_submit_quiz(v_attempt);
  assert v ->> 'phase' = 'pass', v ->> 'phase';
  assert (v -> 'result' ->> 'score')::int = 4;
  assert jsonb_array_length(v -> 'result' -> 'review') = 5;
  assert v -> 'result' -> 'review' -> 0 ? 'explanation';
  begin
    perform public.academy_start_quiz(v_module, 'phone');
    raise exception 'a passed quiz accepted another attempt';
  exception when sqlstate '42501' then null;
  end;
  select count(*) into v_before from public.academy_attempt;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  perform public.academy_preview_quiz((select id from public.academy_quiz where module_id = v_module));
  assert (select count(*) from public.academy_attempt) = v_before, 'preview writes no attempt';
end $$;

\echo '== settings stay on the attempt, a used question cannot be deleted, and a short pool cannot go live =='
reset role;
do $$
declare
  v_quiz uuid;
  v_old integer;
  v_question uuid;
begin
  select q.id into v_quiz from public.academy_quiz q
  join public.academy_module m on m.id = q.module_id
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  select (rules ->> 'lockout_minutes')::int into v_old from public.academy_attempt
  where quiz_id = v_quiz and passed is true limit 1;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  perform public.academy_save_quiz_settings(jsonb_build_object(
    'id', v_quiz, 'questions_per_attempt', 5, 'pass_mark', 4, 'pass_mark_unit', 'correct',
    'max_attempts', 5, 'lockout_minutes', 5, 'shuffle_answers', true, 'active', true,
    'abandoned_minutes', 60, 'min_seconds_per_question', 15
  ));
  assert (select (rules ->> 'lockout_minutes')::int from public.academy_attempt
    where quiz_id = v_quiz and passed is true limit 1) = v_old, 'an old attempt keeps its rules';

  select id into v_question from public.academy_question q
  where q.module_id = (select module_id from public.academy_quiz where id = v_quiz)
    and exists (select 1 from public.academy_attempt a where q.id = any(a.questions_drawn))
  limit 1;
  begin
    delete from public.academy_question where id = v_question;
    raise exception 'a used question was deleted';
  exception when sqlstate '23503' then null;
  end;

  select q.id into v_quiz from public.academy_quiz q
  join public.academy_module m on m.id = q.module_id
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 3;
  begin
    perform public.academy_save_quiz_settings(jsonb_build_object(
      'id', v_quiz, 'questions_per_attempt', 5, 'pass_mark', 4, 'pass_mark_unit', 'correct',
      'max_attempts', 5, 'lockout_minutes', 30, 'shuffle_answers', true, 'active', true,
      'abandoned_minutes', 60, 'min_seconds_per_question', 15
    ));
    raise exception 'a short pool went live';
  exception when sqlstate '23514' then null;
  end;
end $$;

\echo '== the fifth failure opens a hold, and the third failure only records a notice =='
do $$
declare
  v_module uuid;
  v_quiz uuid;
  v jsonb;
  i integer;
begin
  select m.id, q.id into v_module, v_quiz
  from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  join public.academy_quiz q on q.module_id = m.id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  perform public.academy_save_quiz_settings(jsonb_build_object(
    'id', v_quiz, 'questions_per_attempt', 5, 'pass_mark', 4, 'pass_mark_unit', 'correct',
    'max_attempts', 5, 'lockout_minutes', 0, 'shuffle_answers', true, 'active', true,
    'abandoned_minutes', 60, 'min_seconds_per_question', 15
  ));
  perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', false);
  for i in 1..5 loop
    if i > 1 then
      perform public.academy_record_lesson_open((
        select id from public.academy_lesson where lesson_code = 'M01-L01'
      ));
    end if;
    v := public.academy_start_quiz(v_module, 'phone');
    v := public.academy_submit_quiz((v -> 'attempt' ->> 'id')::uuid);
    if i = 3 then
      assert exists (
        select 1 from public.academy_notice n where n.kind = 'third_fail' and n.sent_at is null
      ), 'the third failure records an unsent notice';
    elsif i = 4 then
      assert v ->> 'warning' = 'Only one attempt remains. Failing it places the program on review.', v ->> 'warning';
    elsif i = 5 then
      assert v ->> 'phase' = 'held', v ->> 'phase';
    end if;
  end loop;
  assert (select status from public.academy_enrollment where profile_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3') = 'on_hold_review';
  assert exists (
    select 1 from public.academy_hold h
    join public.academy_enrollment e on e.id = h.enrollment_id
    where e.profile_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
      and h.status = 'open' and h.attempts_used = 5 and h.concept_summary like '%Offer%'
  ), 'the hold stores the concept summary';
  assert exists (
    select 1 from public.audit_event where action = 'academy.hold_opened'
  );
  assert public.academy_shell() ->> 'state' = 'on_hold';
  begin
    perform public.academy_start_quiz(v_module, 'phone');
    raise exception 'a held trainee started a quiz';
  exception when sqlstate '42501' then null;
  end;
end $$;

\echo '== an extra gate stays pending until an admin marks it, with a note =='
reset role;
do $$
declare
  v_module uuid;
  v_lesson uuid;
  v_concept uuid;
  v_part uuid;
  v_enrollment uuid;
  i integer;
  v jsonb;
  v_attempt uuid;
  v_answers jsonb;
  v_item jsonb;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 2;
  perform public.academy_save_lesson(jsonb_build_object(
    'module_id', v_module, 'lesson_code', 'M02-L01', 'title', 'The standard', 'sort_order', 1,
    'body', 'The standard.', 'status', 'live', 'required_watch_percent', 90
  ));
  select id into v_lesson from public.academy_lesson where lesson_code = 'M02-L01';
  perform public.academy_save_concept(jsonb_build_object(
    'module_id', v_module, 'name', 'Standard', 'lesson_id', v_lesson
  ));
  select id into v_concept from public.academy_concept where name = 'Standard';
  for i in 1..5 loop
    perform public.academy_save_question(jsonb_build_object(
      'module_id', v_module, 'prompt', 'Standard ' || i, 'question_type', 'scenario',
      'scenario', 'A client asks.',
      'options', jsonb_build_array(
        jsonb_build_object('id', 'a', 'text', 'One'),
        jsonb_build_object('id', 'b', 'text', 'Two')
      ),
      'correct_answer', 'a', 'explanation', 'The standard holds.',
      'concept_id', v_concept, 'difficulty', 'easy', 'active', true
    ));
  end loop;
  select e.id into v_enrollment from public.academy_enrollment e
  where e.profile_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  insert into public.academy_progress (enrollment_id, lesson_id, status, completed_at, completed_version)
  values (v_enrollment, v_lesson, 'completed', now(), 1);

  perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', false);
  v := public.academy_start_quiz(v_module, 'phone');
  v_attempt := (v -> 'attempt' ->> 'id')::uuid;
  v_answers := '[]'::jsonb;
  for v_item in
    select value from public.academy_attempt_key k, lateral jsonb_array_elements(k.questions)
    where k.attempt_id = v_attempt
  loop
    v_answers := v_answers || jsonb_build_array(jsonb_build_object(
      'question_id', v_item ->> 'id', 'option_id', v_item ->> 'correct_id'
    ));
  end loop;
  update public.academy_attempt set answers = v_answers where id = v_attempt;
  v := public.academy_submit_quiz(v_attempt);
  assert v ->> 'phase' = 'pass', v ->> 'phase';
  assert public.academy_shell() -> 'modules' -> 2 ->> 'display' = 'quiz_passed_pending',
    public.academy_shell() -> 'modules' -> 2 ->> 'display';
  assert public.academy_shell() -> 'modules' -> 3 ->> 'display' = 'locked';

  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  select id into v_part from public.academy_gate_part where module_id = v_module and part_key = 'practical';
  begin
    perform public.academy_satisfy_gate(v_enrollment, v_part, '   ');
    raise exception 'an empty note was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform public.academy_satisfy_gate(v_enrollment, v_part, 'Reflection received.');
  perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', false);
  assert public.academy_shell() -> 'modules' -> 2 ->> 'display' = 'complete';
  assert public.academy_shell() -> 'modules' -> 3 ->> 'display' <> 'locked';
  assert exists (
    select 1 from public.audit_event
    where action = 'academy.gate_override' and after_value ->> 'note' = 'Reflection received.'
  );
end $$;

\echo '== the final quiz draws three questions from each of modules 1 through 10 =='
reset role;
do $$
declare
  v_order integer;
  v_module uuid;
  v_lesson uuid;
  v_concept uuid;
  v_enrollment uuid;
  v_part uuid;
  i integer;
  v jsonb;
  v_final uuid;
  v_counts integer;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  select e.id into v_enrollment from public.academy_enrollment e
  where e.profile_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  for v_order in 3..10 loop
    select m.id into v_module from public.academy_module m
    join public.academy_program p on p.id = m.program_id
    where p.slug = 'da-operator-academy' and m.order_number = v_order;
    perform public.academy_save_lesson(jsonb_build_object(
      'module_id', v_module, 'lesson_code', format('M%s-L01', lpad(v_order::text, 2, '0')),
      'title', 'Lesson ' || v_order, 'sort_order', 1, 'body', 'Lesson.', 'status', 'live', 'required_watch_percent', 90
    ));
    select id into v_lesson from public.academy_lesson
    where lesson_code = format('M%s-L01', lpad(v_order::text, 2, '0'));
    perform public.academy_save_concept(jsonb_build_object(
      'module_id', v_module, 'name', 'Tag ' || v_order, 'lesson_id', v_lesson
    ));
    select id into v_concept from public.academy_concept where module_id = v_module and name = 'Tag ' || v_order;
    for i in 1..3 loop
      perform public.academy_save_question(jsonb_build_object(
        'module_id', v_module, 'prompt', format('M%s Q%s', v_order, i), 'question_type', 'multiple_choice',
        'options', jsonb_build_array(
          jsonb_build_object('id', 'a', 'text', 'Yes'),
          jsonb_build_object('id', 'b', 'text', 'No')
        ),
        'correct_answer', 'a', 'explanation', 'Yes.', 'concept_id', v_concept, 'difficulty', 'hard', 'active', true
      ));
    end loop;
    insert into public.academy_progress (enrollment_id, lesson_id, status, completed_at, completed_version)
    values (v_enrollment, v_lesson, 'completed', now(), 1);
    insert into public.academy_attempt (enrollment_id, quiz_id, attempt_number, score, passed, finished_at, rules)
    select v_enrollment, q.id, 1, 5, true, now(), '{}'::jsonb
    from public.academy_quiz q where q.module_id = v_module;
    for v_part in select id from public.academy_gate_part where module_id = v_module and part_key <> 'quiz'
    loop
      perform public.academy_satisfy_gate(v_enrollment, v_part, 'Bridge for the final.');
    end loop;
  end loop;

  select m.id into v_final from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 11;
  perform set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', false);
  v := public.academy_start_quiz(v_final, 'desktop');
  assert jsonb_array_length(v -> 'attempt' -> 'questions') = 30, v -> 'attempt' -> 'questions';
  assert v -> 'attempt' -> 'questions' -> 0 ? 'correct_option_id' = false;

  select count(*) into v_counts from (
    select (item ->> 'module_id') as module_id, count(*)
    from public.academy_attempt_key k
    cross join lateral jsonb_array_elements(k.questions) item
    where k.attempt_id = (v -> 'attempt' ->> 'id')::uuid
    group by 1
    having count(*) = 3
  ) even;
  assert v_counts = 10, 'each of modules 1 through 10 contributed 3 questions';
end $$;
