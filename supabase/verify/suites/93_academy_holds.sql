-- Hold reviews. Access, decisions, deadlines, and the trainee screen.
\set ON_ERROR_STOP on
set search_path = public;
create temp table academy_hold_ids (kind text primary key, hold_id uuid);
grant select, insert, update on academy_hold_ids to authenticated;

\echo '== reviewers, trainees, and a two-question module quiz =='
do $$
declare
  v_admin uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
  v_module uuid;
  v_lesson uuid;
  v_offer uuid;
  v_price uuid;
  v_quiz uuid;
  v_person record;
begin
  insert into auth.users (id, email) values
    (v_admin, 'hold.admin@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'hold.admin2@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd11', 'hold.reviewer.a@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd12', 'hold.reviewer.b@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd21', 'hold.reset@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd22', 'hold.extend@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd23', 'hold.release@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd24', 'hold.self@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd25', 'hold.final@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd26', 'hold.deadline@academy.test'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd27', 'hold.unassigned@academy.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'Hold Admin'
  where id = v_admin;
  update public.profile set role = 'admin', state = 'active', full_name = 'Second Admin'
  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd02';
  update public.profile set role = 'manager', state = 'active', full_name = 'Reviewer A'
  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd11';
  update public.profile set role = 'manager', state = 'active', full_name = 'Reviewer B'
  where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd12';
  update public.profile p
  set role = 'operator', state = 'active', full_name = n.person_name
  from (values
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd21'::uuid, 'Reset Trainee'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd22', 'Extend Trainee'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd23', 'Release Trainee'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd24', 'Self Trainee'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd25', 'Final Trainee'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd26', 'Deadline Trainee'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd27', 'Unassigned Trainee')
  ) as n(id, person_name)
  where p.id = n.id;

  for v_person in
    select * from (values
      ('dddddddd-dddd-4ddd-8ddd-dddddddddd21'::uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddd31'::uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddd41'::uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddd51'::uuid, 'Reset Trainee', 'hold.reset@academy.test'),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddd22', 'dddddddd-dddd-4ddd-8ddd-dddddddddd32', 'dddddddd-dddd-4ddd-8ddd-dddddddddd42', 'dddddddd-dddd-4ddd-8ddd-dddddddddd52', 'Extend Trainee', 'hold.extend@academy.test'),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddd23', 'dddddddd-dddd-4ddd-8ddd-dddddddddd33', 'dddddddd-dddd-4ddd-8ddd-dddddddddd43', 'dddddddd-dddd-4ddd-8ddd-dddddddddd53', 'Release Trainee', 'hold.release@academy.test'),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddd24', 'dddddddd-dddd-4ddd-8ddd-dddddddddd34', 'dddddddd-dddd-4ddd-8ddd-dddddddddd44', 'dddddddd-dddd-4ddd-8ddd-dddddddddd54', 'Self Trainee', 'hold.self@academy.test'),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddd25', 'dddddddd-dddd-4ddd-8ddd-dddddddddd35', 'dddddddd-dddd-4ddd-8ddd-dddddddddd45', 'dddddddd-dddd-4ddd-8ddd-dddddddddd55', 'Final Trainee', 'hold.final@academy.test'),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddd26', 'dddddddd-dddd-4ddd-8ddd-dddddddddd36', 'dddddddd-dddd-4ddd-8ddd-dddddddddd46', 'dddddddd-dddd-4ddd-8ddd-dddddddddd56', 'Deadline Trainee', 'hold.deadline@academy.test'),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddd27', 'dddddddd-dddd-4ddd-8ddd-dddddddddd37', 'dddddddd-dddd-4ddd-8ddd-dddddddddd47', 'dddddddd-dddd-4ddd-8ddd-dddddddddd57', 'Unassigned Trainee', 'hold.unassigned@academy.test')
    ) as t(profile_id, operator_id, recipient_id, agreement_id, person_name, email)
  loop
    insert into public.operator (id, profile_id, name, email, status)
    values (v_person.operator_id, v_person.profile_id, v_person.person_name, v_person.email, 'applicant');
    insert into public.da_recipient (id, full_name, email, recipient_type, operator_id)
    values (v_person.recipient_id, v_person.person_name, v_person.email, 'operator', v_person.operator_id);
  end loop;
  insert into public.da_agreement_template (id, name, recipient_type, docuseal_template_id)
  values ('dddddddd-dddd-4ddd-8ddd-dddddddddd61', 'Hold agreement', 'operator', 'academy-hold-template');
  insert into public.da_agreement (id, recipient_id, template_id, status, docuseal_submission_id)
  select t.agreement_id, t.recipient_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddd61', 'completed', 'academy-hold-' || t.agreement_id
  from (values
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd41'::uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddd51'::uuid),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd42', 'dddddddd-dddd-4ddd-8ddd-dddddddddd52'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd43', 'dddddddd-dddd-4ddd-8ddd-dddddddddd53'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd44', 'dddddddd-dddd-4ddd-8ddd-dddddddddd54'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd45', 'dddddddd-dddd-4ddd-8ddd-dddddddddd55'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd46', 'dddddddd-dddd-4ddd-8ddd-dddddddddd56'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd47', 'dddddddd-dddd-4ddd-8ddd-dddddddddd57')
  ) as t(recipient_id, agreement_id);

  perform set_config('request.jwt.claim.sub', v_admin::text, false);
  perform public.academy_assign_role('dddddddd-dddd-4ddd-8ddd-dddddddddd24', 'reviewer', 'grant', 'Self review test');

  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  perform public.academy_save_lesson(jsonb_build_object(
    'module_id', v_module, 'lesson_code', 'M01-L01', 'title', 'Who we are', 'sort_order', 1,
    'body', 'The offer and the price, explained in enough words to take a minute to read.',
    'status', 'live', 'required_watch_percent', 90
  ));
  select id into v_lesson from public.academy_lesson where lesson_code = 'M01-L01';
  perform public.academy_save_concept(jsonb_build_object('module_id', v_module, 'name', 'Offer', 'lesson_id', v_lesson));
  perform public.academy_save_concept(jsonb_build_object('module_id', v_module, 'name', 'Price', 'lesson_id', v_lesson));
  select id into v_offer from public.academy_concept where module_id = v_module and name = 'Offer';
  select id into v_price from public.academy_concept where module_id = v_module and name = 'Price';
  perform public.academy_save_question(jsonb_build_object(
    'module_id', v_module, 'prompt', 'What is the offer?', 'question_type', 'multiple_choice',
    'options', jsonb_build_array(
      jsonb_build_object('id', 'a', 'text', 'Alpha'), jsonb_build_object('id', 'b', 'text', 'Beta'),
      jsonb_build_object('id', 'c', 'text', 'Gamma'), jsonb_build_object('id', 'd', 'text', 'Delta')
    ),
    'correct_answer', 'b', 'explanation', 'Because the offer.', 'concept_id', v_offer, 'difficulty', 'medium', 'active', true
  ));
  perform public.academy_save_question(jsonb_build_object(
    'module_id', v_module, 'prompt', 'What is the price?', 'question_type', 'multiple_choice',
    'options', jsonb_build_array(
      jsonb_build_object('id', 'a', 'text', 'Alpha'), jsonb_build_object('id', 'b', 'text', 'Beta'),
      jsonb_build_object('id', 'c', 'text', 'Gamma'), jsonb_build_object('id', 'd', 'text', 'Delta')
    ),
    'correct_answer', 'b', 'explanation', 'Because the price.', 'concept_id', v_price, 'difficulty', 'medium', 'active', true
  ));
  select id into v_quiz from public.academy_quiz where module_id = v_module;
  perform public.academy_save_quiz_settings(jsonb_build_object(
    'id', v_quiz, 'questions_per_attempt', 2, 'pass_mark', 2, 'pass_mark_unit', 'correct',
    'max_attempts', 1, 'lockout_minutes', 0, 'shuffle_answers', true, 'active', true,
    'abandoned_minutes', 60, 'min_seconds_per_question', 15
  ));

  insert into public.academy_enrollment (profile_id, program_id, track, status, start_date, manager_id)
  select u.profile_id, p.id, 'Core', 'active', '2026-10-01', u.manager_id
  from public.academy_program p
  join (values
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd21'::uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddd11'::uuid),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd22', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd23', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd24', 'dddddddd-dddd-4ddd-8ddd-dddddddddd24'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd25', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd26', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddd27', null)
  ) as u(profile_id, manager_id) on true
  where p.slug = 'da-operator-academy';

  insert into public.academy_progress (enrollment_id, lesson_id, status, completed_at, completed_version, time_spent_seconds)
  select e.id, v_lesson, 'completed', now(), 1, 10
  from public.academy_enrollment e
  where e.profile_id in (
    'dddddddd-dddd-4ddd-8ddd-dddddddddd21',
    'dddddddd-dddd-4ddd-8ddd-dddddddddd22',
    'dddddddd-dddd-4ddd-8ddd-dddddddddd23',
    'dddddddd-dddd-4ddd-8ddd-dddddddddd24'
  );
end $$;

\echo '== one failed attempt opens one hold for the assigned reviewer =='
do $$
declare
  v_module uuid;
  v_quiz uuid;
  v jsonb;
  v_hold uuid;
  v_deadline timestamptz;
  v_opened timestamptz;
begin
  select m.id, q.id into v_module, v_quiz
  from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  join public.academy_quiz q on q.module_id = m.id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd21', false);
  v := public.academy_start_quiz(v_module, 'desktop');
  v := public.academy_submit_quiz((v -> 'attempt' ->> 'id')::uuid);
  assert v ->> 'phase' = 'held', v ->> 'phase';
  select h.id, h.deadline_at, h.opened_at into v_hold, v_deadline, v_opened
  from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd21';
  assert (select count(*) from public.academy_hold h
    join public.academy_enrollment e on e.id = h.enrollment_id
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd21'
      and h.status in ('open', 'under_review')) = 1, 'one open hold';
  assert (select reviewer_id from public.academy_hold where id = v_hold) = 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', 'reviewer is the manager';
  assert v_deadline > v_opened + interval '4 days', 'deadline is about five days';
  assert exists (select 1 from public.audit_event where action = 'academy.hold_opened');
  assert exists (select 1 from public.audit_event where action = 'academy.hold_assigned' and entity_id = v_hold::text);
  insert into academy_hold_ids values ('reset', v_hold);
  insert into public.academy_hold (enrollment_id, quiz_id, reason, attempts_used, status)
  select enrollment_id, quiz_id, 'Second', 1, 'open' from public.academy_hold where id = v_hold;
  assert (select count(*) from public.academy_hold h
    join public.academy_enrollment e on e.id = h.enrollment_id
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd21'
      and h.status in ('open', 'under_review')) = 1, 'a second open hold is refused';
end $$;

\echo '== a trainee cannot read notes or flags, and another reviewer cannot read the hold =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd21', false); end $$;
do $$
declare
  v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'on_hold';
  assert v -> 'hold' ->> 'manager_name' = 'Reviewer A';
  assert v -> 'hold' ->> 'review_started_at' is null;
  assert position('review_notes' in v::text) = 0;
  assert position('flagged_fast' in v::text) = 0;
  assert (select count(*) from public.academy_hold) = 0, 'the trainee cannot read holds';
  assert (select count(*) from public.academy_hold_note) = 0, 'the trainee cannot read notes';
  assert (select count(*) from public.academy_attempt_flag) = 0, 'the trainee cannot read flags';
  begin
    perform public.academy_hold_detail((select hold_id from academy_hold_ids where kind = 'reset'));
    raise exception 'trainee read the review';
  exception when sqlstate '42501' then null;
  end;
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd12', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_hold) = 0, 'the other reviewer sees no holds';
  assert (select count(*) from public.academy_attempt_flag) = 0;
  begin
    perform public.academy_hold_detail((select hold_id from academy_hold_ids where kind = 'reset'));
    raise exception 'the other reviewer opened the hold';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.academy_hold_summary();
    raise exception 'a reviewer opened the admin summary';
  exception when sqlstate '42501' then null;
  end;
end $$;

\echo '== the review screen, then reset, blocks the retry until the plan is confirmed =='
do $$
declare
  v_hold uuid;
  v jsonb;
  v_lesson uuid;
  v_module uuid;
  v_enrollment uuid;
begin
  select hold_id into v_hold from academy_hold_ids where kind = 'reset';
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  v := public.academy_hold_queue(null, null, null, false);
  assert (v -> 'counts' ->> 'open')::int = 1;
  assert v -> 'holds' -> 0 ->> 'trainee_name' = 'Reset Trainee';
  assert (v -> 'holds' -> 0 ->> 'attempts_used')::int = 1;
  assert (v -> 'holds' -> 0 ->> 'days_open')::int >= 0;
  perform public.academy_hold_begin(v_hold);
  assert (select status from public.academy_hold where id = v_hold) = 'under_review';
  assert (select review_started_by from public.academy_hold where id = v_hold) = 'dddddddd-dddd-4ddd-8ddd-dddddddddd11';
  assert exists (select 1 from public.audit_event where action = 'academy.hold_started' and entity_id = v_hold::text);
  begin
    perform public.academy_hold_resolve(v_hold, 'reset', 'Reread the offer.', 2, null, '{}', '{}');
    raise exception 'resolved without a checklist';
  exception when sqlstate '42501' then
    assert sqlerrm like '%checklist_open%', sqlerrm;
  end;
  perform public.academy_hold_save_checklist(v_hold, current_date, 'Call was calm.', 'They could name the offer.', 'Rushed', 'They clicked through.');
  perform public.academy_hold_add_note(v_hold, 'SECRET NOTE');
  v := public.academy_hold_detail(v_hold);
  assert v ->> 'pattern' = 'Misses spread across many concepts', v ->> 'pattern';
  assert jsonb_array_length(v -> 'concepts') = 2;
  assert (v -> 'lessons' -> 0 ->> 'time_spent_seconds')::int = 10;
  assert (v -> 'lessons' -> 0 ->> 'length_seconds')::int > 10;
  assert (v -> 'lessons' -> 0 ->> 'completed')::boolean;
  assert (v -> 'lessons' -> 0 ->> 'reopen_required')::boolean;
  assert (v -> 'attempts' -> 0 ->> 'flagged_fast')::boolean;
  assert v -> 'attempts' -> 0 -> 'concepts' @> '"Offer"'::jsonb;
  assert (select count(*) from public.academy_attempt_flag) = 1, 'the reviewer can read the flag';
  assert (select count(*) from public.academy_hold_note) = 1;
  select id into v_lesson from public.academy_lesson where lesson_code = 'M01-L01';
  perform public.academy_hold_resolve(v_hold, 'reset', 'Reread the offer lesson.', 2, null, array[v_lesson], '{}');
  assert (select e.status from public.academy_enrollment e
    join public.academy_hold h on h.enrollment_id = e.id
    where h.id = v_hold) = 'active';
  assert (select attempts_granted from public.academy_hold where id = v_hold) = 2, 'reset grants two attempts';
  assert (select a.lockout_until from public.academy_attempt a
    join public.academy_hold h on h.enrollment_id = a.enrollment_id and h.quiz_id = a.quiz_id
    where h.id = v_hold) is null, 'reset clears the lockout';
  assert (select count(*) from public.academy_attempt a
    join public.academy_hold h on h.enrollment_id = a.enrollment_id
    where h.id = v_hold) = 1, 'the attempt stays';
  begin
    perform public.academy_hold_resolve(v_hold, 'reset', 'Again', 1, null, '{}', '{}');
    raise exception 'resolved twice';
  exception when sqlstate '42501' then
    assert sqlerrm like '%already_resolved%', sqlerrm;
  end;

  select enrollment_id into v_enrollment from public.academy_hold where id = v_hold;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd21', false);
  v := public.academy_shell();
  assert v ->> 'state' = 'active';
  assert v -> 'remediation' ->> 'plan' = 'Reread the offer lesson.';
  assert (v -> 'remediation' ->> 'attempts_granted')::int = 2;
  assert position('SECRET NOTE' in v::text) = 0;
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  assert (public.academy_quiz_state(v_module) ->> 'blocked') = 'acknowledge', public.academy_quiz_state(v_module)::text;
  begin
    perform public.academy_start_quiz(v_module, 'desktop');
    raise exception 'retry started before the plan was confirmed';
  exception when sqlstate '42501' then null;
  end;
  perform public.academy_hold_acknowledge(v_hold);
  perform public.academy_record_lesson_open(v_lesson);
  assert (public.academy_quiz_state(v_module) ->> 'can_start')::boolean, public.academy_quiz_state(v_module)::text;
  v := public.academy_start_quiz(v_module, 'desktop');
  assert v ->> 'phase' = 'take', v ->> 'phase';
end $$;

\echo '== extend stays locked until the re-test date =='
do $$
declare
  v_module uuid;
  v_hold uuid;
  v jsonb;
  v_lesson uuid;
  v_enrollment uuid;
begin
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd22', false);
  v := public.academy_start_quiz(v_module, 'phone');
  perform public.academy_submit_quiz((v -> 'attempt' ->> 'id')::uuid);
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  select h.id into v_hold from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd22' and h.status = 'open';
  perform public.academy_hold_begin(v_hold);
  perform public.academy_hold_save_checklist(v_hold, current_date, 'Call held.', 'Partial explanation.', 'Concept not clear', 'The price did not land.');
  perform public.academy_hold_add_note(v_hold, 'Needs another week.');
  perform public.academy_hold_resolve(v_hold, 'extend', 'Study the price, then retest.', null, current_date + 2, '{}', '{}');
  assert (select attempts_granted from public.academy_hold where id = v_hold) = 3, 'null attempts uses the setting';
  select enrollment_id into v_enrollment from public.academy_hold where id = v_hold;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd22', false);
  v := public.academy_shell();
  assert v -> 'remediation' ->> 'retest_on' = (current_date + 2)::text;
  perform public.academy_hold_acknowledge(v_hold);
  select id into v_lesson from public.academy_lesson where lesson_code = 'M01-L01';
  perform public.academy_record_lesson_open(v_lesson);
  assert (public.academy_quiz_state(v_module) ->> 'blocked') = 'retest', public.academy_quiz_state(v_module)::text;
  begin
    perform public.academy_start_quiz(v_module, 'phone');
    raise exception 'extend opened before the re-test date';
  exception when sqlstate '42501' then null;
  end;
end $$;
reset role;
update public.academy_hold set retest_on = current_date
where id in (
  select h.id from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd22'
);
set role authenticated;
do $$
declare
  v_module uuid;
  v jsonb;
begin
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd22', false);
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  v := public.academy_start_quiz(v_module, 'phone');
  assert v ->> 'phase' = 'take', v ->> 'phase';
end $$;

\echo '== release needs a second admin, then the trainee loses access =='
do $$
declare
  v_module uuid;
  v_hold uuid;
  v jsonb;
  v_attempts integer;
begin
  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd23', false);
  v := public.academy_start_quiz(v_module, 'phone');
  perform public.academy_submit_quiz((v -> 'attempt' ->> 'id')::uuid);
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  select h.id into v_hold from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23' and h.status = 'open';
  insert into academy_hold_ids values ('release', v_hold);
  select count(*) into v_attempts from public.academy_attempt a
  join public.academy_enrollment e on e.id = a.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23';
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  perform public.academy_hold_begin(v_hold);
  perform public.academy_hold_save_checklist(v_hold, current_date, 'Call held.', 'Could not explain it.', 'Did not engage with the material', 'No notes in the lesson.');
  perform public.academy_hold_add_note(v_hold, 'Release this enrollment.');
  begin
    perform public.academy_hold_confirm_release(v_hold);
    raise exception 'a reviewer confirmed a release';
  exception when sqlstate '42501' then null;
  end;
  perform public.academy_hold_request_release(v_hold, 'Not a fit for the role', 'The material is not landing.');
  assert (select status from public.academy_enrollment e where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23') = 'on_hold_review';
  assert (select status from public.academy_hold where id = v_hold) = 'under_review';
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', false);
  perform public.academy_hold_request_release(v_hold, 'Not a fit for the role', 'Admin request replaces the reviewer request.');
  begin
    perform public.academy_hold_confirm_release(v_hold);
    raise exception 'the requester confirmed their own release';
  exception when sqlstate '42501' then
    assert sqlerrm like '%second_person%', sqlerrm;
  end;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02', false);
  perform public.academy_hold_confirm_release(v_hold);
  assert (select status from public.academy_enrollment where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23') = 'withdrawn';
  assert (select status::text from public.operator where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23') = 'inactive';
  assert (select count(*) from public.academy_attempt a
    join public.academy_enrollment e on e.id = a.enrollment_id
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23') = v_attempts, 'attempts stay';
  assert exists (select 1 from public.academy_hold_note n where n.hold_id = v_hold), 'notes stay';
  assert exists (select 1 from public.audit_event where action = 'academy.hold_release_confirmed' and entity_id = v_hold::text);
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd23', false);
  assert public.academy_shell() ->> 'state' = 'no_access';
  assert (select count(*) from public.academy_hold) = 0;
  assert (select count(*) from public.academy_hold_note) = 0;
end $$;

\echo '== an admin can reopen a release, and a reviewer cannot resolve their own hold =='
do $$
declare
  v_hold uuid;
  v_module uuid;
  v jsonb;
begin
  select hold_id into v_hold from academy_hold_ids where kind = 'release';
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  begin
    perform public.academy_hold_reopen(v_hold, 'Wrong person.');
    raise exception 'a reviewer reopened a hold';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02', false);
  begin
    perform public.academy_hold_reopen(v_hold, '   ');
    raise exception 'reopened without a note';
  exception when sqlstate '22023' then null;
  end;
  perform public.academy_hold_reopen(v_hold, 'Confirmed the wrong enrollment.');
  assert (select status from public.academy_enrollment where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23') = 'on_hold_review';
  assert (select status::text from public.operator where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd23') = 'applicant';
  assert (select status from public.academy_hold where id = v_hold) = 'under_review';
  assert exists (select 1 from public.audit_event where action = 'academy.hold_reopened' and entity_id = v_hold::text);

  select m.id into v_module from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd24', false);
  v := public.academy_start_quiz(v_module, 'desktop');
  perform public.academy_submit_quiz((v -> 'attempt' ->> 'id')::uuid);
  select h.id into v_hold from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd24' and h.status = 'open';
  assert (select reviewer_id from public.academy_hold where id = v_hold) = 'dddddddd-dddd-4ddd-8ddd-dddddddddd24';
  perform public.academy_hold_begin(v_hold);
  assert (select status from public.academy_hold where id = v_hold) = 'open', 'a reviewer does not start their own hold';
  begin
    perform public.academy_hold_resolve(v_hold, 'reset', 'Myself', 1, null, '{}', '{}');
    raise exception 'self review resolved';
  exception when sqlstate '42501' then
    assert sqlerrm like '%self_review%', sqlerrm;
  end;
end $$;

\echo '== deadlines, unassigned holds, and a final-quiz breakdown =='
reset role;
insert into public.academy_hold (enrollment_id, quiz_id, reason, attempts_used, status, deadline_at)
select e.id, q.id, 'No reviewer', 1, 'open', now() + interval '12 hours'
from public.academy_enrollment e
join public.academy_quiz q on q.module_id = (
  select m.id from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1
)
where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd27';
insert into public.academy_hold (enrollment_id, quiz_id, reason, attempts_used, status, opened_at, deadline_at)
select e.id, q.id, 'Deadline watch', 1, 'open', now() - interval '1 day', now() + interval '12 hours'
from public.academy_enrollment e
join public.academy_quiz q on q.module_id = (
  select m.id from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1
)
where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd26';
update public.academy_hold h
set deadline_at = now() - interval '1 hour'
from public.academy_enrollment e
where e.id = h.enrollment_id and e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd24';
set role authenticated;
do $$
declare
  v jsonb;
  v_final uuid;
  v_hold uuid;
  v_attempt uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_enrollment uuid;
  v_deadline timestamptz;
  v_lesson uuid;
begin
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', false);
  perform public.academy_hold_prepare();
  assert exists (
    select 1 from public.academy_hold_event ev
    join public.academy_hold h on h.id = ev.hold_id
    join public.academy_enrollment e on e.id = h.enrollment_id
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd26' and ev.kind = 'reminder'
  ), 'a reminder is recorded inside 24 hours';
  assert not exists (
    select 1 from public.academy_hold_event ev
    join public.academy_hold h on h.id = ev.hold_id
    join public.academy_enrollment e on e.id = h.enrollment_id
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd26' and ev.kind = 'escalation'
  );
  assert exists (
    select 1 from public.academy_hold_event ev
    join public.academy_hold h on h.id = ev.hold_id
    join public.academy_enrollment e on e.id = h.enrollment_id
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd24' and ev.kind = 'escalation'
  ), 'overdue records an escalation';
  assert exists (
    select 1 from public.academy_hold_event ev
    join public.academy_enrollment e on e.id = (
      select h.enrollment_id from public.academy_hold h where h.id = ev.hold_id
    )
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd27' and ev.kind = 'unassigned'
  );
  v := public.academy_hold_queue(null, null, null, false);
  assert (v -> 'holds' -> 0 ->> 'overdue')::boolean, 'overdue holds sort first';
  v := public.academy_hold_queue(null, null, null, true);
  assert jsonb_array_length(v -> 'holds') >= 1;
  assert (v -> 'holds' -> 0 ->> 'unassigned')::boolean;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd12', false);
  v := public.academy_hold_queue(null, null, null, false);
  assert jsonb_array_length(v -> 'holds') = 0, 'reviewer B still has an empty queue';

  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', false);
  select h.id into v_hold from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd27';
  perform public.academy_hold_assign(v_hold, 'dddddddd-dddd-4ddd-8ddd-dddddddddd12');
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd12', false);
  v := public.academy_hold_detail(v_hold);
  assert v ->> 'trainee_name' = 'Unassigned Trainee';
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  begin
    perform public.academy_hold_detail(v_hold);
    raise exception 'reviewer A read a reassigned hold';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  begin
    perform public.academy_hold_save_settings(9, 4);
    raise exception 'a reviewer changed hold settings';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', false);
  select h.deadline_at into v_deadline from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd21';
  perform public.academy_hold_save_settings(9, 4);
  assert (select deadline_at from public.academy_hold h
    join public.academy_enrollment e on e.id = h.enrollment_id
    where e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd21') = v_deadline, 'old deadlines stay put';
  assert exists (select 1 from public.audit_event where action = 'academy.hold_settings');
  perform public.academy_hold_save_list('struggle', '["Rushed","Other"]'::jsonb);
  assert exists (select 1 from public.audit_event where action = 'academy.hold_list');

  select q.id, e.id into v_final, v_enrollment
  from public.academy_quiz q
  join public.academy_module m on m.id = q.module_id
  join public.academy_program p on p.id = m.program_id
  join public.academy_enrollment e on e.program_id = p.id
  where p.slug = 'da-operator-academy' and m.order_number = 11
    and e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd25';
  select m.id into v_m1 from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  select m.id into v_m2 from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 2;
end $$;
reset role;
do $$
declare
  v_final uuid;
  v_enrollment uuid;
  v_attempt uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddd81';
  v_m1 uuid;
  v_m2 uuid;
  v_hold uuid;
  v jsonb;
  v_lesson uuid;
begin
  select q.id, e.id into v_final, v_enrollment
  from public.academy_quiz q
  join public.academy_module m on m.id = q.module_id
  join public.academy_program p on p.id = m.program_id
  join public.academy_enrollment e on e.program_id = p.id
  where p.slug = 'da-operator-academy' and m.order_number = 11
    and e.profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd25';
  select m.id into v_m1 from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 1;
  select m.id into v_m2 from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 2;
  insert into public.academy_attempt (
    id, enrollment_id, quiz_id, attempt_number, questions_drawn, answers, score, passed, started_at, finished_at, time_taken_seconds
  ) values (
    v_attempt, v_enrollment, v_final, 1, '{}', '[]'::jsonb, 0, false, now() - interval '5 minutes', now(), 40
  );
  insert into public.academy_attempt_key (attempt_id, questions) values (v_attempt, jsonb_build_array(
    jsonb_build_object('id', 'dddddddd-dddd-4ddd-8ddd-dddddddddd91', 'module_id', v_m1, 'concept', 'Offer', 'correct_id', 'b'),
    jsonb_build_object('id', 'dddddddd-dddd-4ddd-8ddd-dddddddddd92', 'module_id', v_m2, 'concept', 'Price', 'correct_id', 'b')
  ));
  insert into public.academy_hold (enrollment_id, quiz_id, reason, attempts_used, status)
  values (v_enrollment, v_final, 'Failed the last attempt', 1, 'open')
  returning id into v_hold;
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd11', false);
  perform public.academy_hold_begin(v_hold);
  v := public.academy_hold_detail(v_hold);
  assert jsonb_array_length(v -> 'module_scores') = 2, v -> 'module_scores';
  assert (v -> 'module_scores' -> 0 ->> 'total')::int = 1;
  perform public.academy_hold_save_checklist(v_hold, current_date, 'Call held.', 'Weak on both modules.', 'Rushed', 'Skipped the lessons.');
  perform public.academy_hold_add_note(v_hold, 'Final plan.');
  begin
    perform public.academy_hold_resolve(v_hold, 'reset', 'Review modules 1 and 2.', null, null, '{}', '{}');
    raise exception 'a final plan without modules was accepted';
  exception when sqlstate '22023' then
    assert sqlerrm like '%modules_required%', sqlerrm;
  end;
  perform public.academy_hold_resolve(v_hold, 'reset', 'Review module 1.', null, null, '{}', array[v_m1]);
  assert (select attempts_granted from public.academy_hold where id = v_hold) = 4, 'the new default is used';
  assert (app.academy_retry_gate(v_enrollment, (select q from public.academy_quiz q where q.id = v_final)) ->> 'block') = 'acknowledge';
  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd25', false);
  perform public.academy_hold_acknowledge(v_hold);
  assert (app.academy_retry_gate(v_enrollment, (select q from public.academy_quiz q where q.id = v_final)) ->> 'block') = 'lessons';
  select id into v_lesson from public.academy_lesson where lesson_code = 'M01-L01';
  insert into public.academy_progress (enrollment_id, lesson_id, status, last_opened_at)
  values (v_enrollment, v_lesson, 'not_started', clock_timestamp())
  on conflict (enrollment_id, lesson_id) do update set last_opened_at = clock_timestamp();
  assert (app.academy_retry_gate(v_enrollment, (select q from public.academy_quiz q where q.id = v_final)) ->> 'block') is null;

  perform set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', false);
  v := public.academy_hold_summary();
  assert (v ->> 'opened_30')::int >= 4;
  assert (v ->> 'reset')::int >= 1;
  assert (v ->> 'extend')::int >= 1;
  assert (v ->> 'release')::int = 0, 'the reopened release is no longer an outcome';
  assert v -> 'quizzes' is not null;
  assert exists (
    select 1 from jsonb_array_elements(v -> 'concepts') item
    where item ->> 'concept' in ('Offer', 'Price')
  );
end $$;
