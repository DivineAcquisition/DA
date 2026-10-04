-- DA Operator Academy. Access is enforced as the authenticated role, which is
-- what PostgREST uses. The curriculum rows come from the migration. The people
-- below exist only inside this throwaway database.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== curriculum is configuration: draft programs, no people, no lessons =='
do $$
begin
  assert (select count(*) from public.academy_program) = 7, 'seven programs';
  assert (select count(*) from public.academy_program where status <> 'draft') = 0, 'all draft';
  assert (select count(*) from public.academy_module) = 13, 'core has 13 modules';
  assert (
    select count(*) from public.academy_module m
    join public.academy_program p on p.id = m.program_id
    where p.slug <> 'da-operator-academy'
  ) = 0, 'vertical and internal programs have no modules yet';
  assert (select count(*) from public.academy_lesson) = 0, 'no lessons';
  assert (select count(*) from public.academy_question) = 0, 'no questions';
  assert (select count(*) from public.academy_enrollment) = 0, 'no enrollments';
  assert (select count(*) from public.academy_attempt) = 0, 'no attempts';
  assert (select title from public.academy_module m
            join public.academy_program p on p.id = m.program_id
           where p.slug = 'da-operator-academy' and m.order_number = 8)
    = 'Applied Acquisition: The DA Speed-to-Lead System';
  assert (select count(*) from public.academy_quiz where kind = 'module') = 10;
  assert (select count(*) from public.academy_quiz where kind = 'final') = 1;
  assert (select bool_and(questions_per_attempt = 5 and pass_mark = 4 and pass_mark_unit = 'correct'
            and max_attempts = 5 and lockout_minutes = 30 and shuffle_answers and active)
          from public.academy_quiz where kind = 'module');
  assert (select questions_per_attempt = 30 and pass_mark = 85 and pass_mark_unit = 'percent'
            and max_attempts = 5 and lockout_minutes = 120 and shuffle_answers and active
          from public.academy_quiz where kind = 'final');
  assert (select coalesce(sum(d.question_count), 0)
          from public.academy_quiz_draw d
          join public.academy_quiz q on q.id = d.quiz_id
          where q.kind = 'final') = 30, 'final quiz draws 3 from each of modules 1-10';
  assert (select count(*) from public.role_permission where permission_key = 'academy.trainee' and role = 'operator') = 1;
  assert (select count(*) from public.role_permission where permission_key = 'academy.review' and role = 'manager') = 1;
  assert (select count(*) from public.role_permission where permission_key = 'academy.manage' and role = 'admin') = 1;
  assert (select count(*) from public.role_permission where permission_key = 'academy.manage' and role = 'owner') = 1;
end $$;

\echo '== two trainees, two managers, agreements linked not copied =='
do $$
declare
  v_program uuid;
begin
  insert into auth.users (id, email) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@divineacquisition.io')
  on conflict (id) do nothing;
  update public.profile set role = 'admin', state = 'active'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  insert into auth.users (id, email) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'trainee.a@academy.test'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'trainee.b@academy.test'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'manager.a@academy.test'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'manager.b@academy.test');
  update public.profile set role = 'operator', state = 'active', full_name = 'Trainee A'
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  update public.profile set role = 'operator', state = 'active', full_name = 'Trainee B'
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  update public.profile set role = 'manager', state = 'active', full_name = 'Manager A'
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  update public.profile set role = 'manager', state = 'active', full_name = 'Manager B'
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';

  insert into public.role_application (id, role_slug, role_title, full_name, email, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21', 'operator', 'Operator', 'Trainee A', 'trainee.a@academy.test', 'new');

  insert into public.operator (id, profile_id, name, email, status, role_application_id) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Trainee A', 'trainee.a@academy.test', 'applicant', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Trainee B', 'trainee.b@academy.test', 'applicant', null);

  insert into public.da_agreement_template (id, name, recipient_type, docuseal_template_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa41', 'Operator agreement', 'operator', 'academy-verify-template');

  insert into public.da_recipient (id, full_name, email, recipient_type, operator_id) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa31', 'Trainee A', 'trainee.a@academy.test', 'operator', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa32', 'Trainee B', 'trainee.b@academy.test', 'operator', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12');

  insert into public.da_agreement (id, recipient_id, template_id, status, docuseal_submission_id) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa51', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa31', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa41', 'sent', 'academy-sub-a'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa52', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa32', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa41', 'completed', 'academy-sub-b');

  select id into v_program from public.academy_program where slug = 'da-operator-academy';
  insert into public.academy_enrollment (id, profile_id, program_id, track, start_date, target_completion_date, manager_id, status) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', v_program, 'Core', '2026-10-04', '2026-12-01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'active'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa62', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', v_program, 'Core', '2026-10-04', '2026-12-01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'active');

  assert (select operator_id from public.academy_enrollment where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61')
    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', 'enrollment links the operator';
  assert (select role_application_id from public.academy_enrollment where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61')
    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21', 'enrollment links the application';
  assert (select agreement_id from public.academy_enrollment where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61')
    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa51', 'enrollment links the agreement row';
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academy_enrollment'
      and column_name in ('full_name', 'email')
  ), 'enrollment does not copy the person';
end $$;

\echo '== unsigned agreement: holding screen, no modules =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare
  v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'agreement_pending', v ->> 'state';
  assert jsonb_array_length(v -> 'modules') = 0, 'shell hides modules';
  assert (select count(*) from public.academy_module) = 0, 'direct module read is empty';
  assert (select count(*) from public.academy_enrollment) = 1, 'own enrollment only';
  assert (select count(*) from public.academy_enrollment where profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2') = 0,
    'the other trainee is invisible';
end $$;

\echo '== signed and active: own program, unpublished modules, next one locked =='
reset role;
update public.da_agreement set status = 'completed' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa51';
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare
  v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'active', v ->> 'state';
  assert v -> 'program' ->> 'name' = 'DA Operator Academy';
  assert jsonb_array_length(v -> 'modules') = 13;
  assert v -> 'modules' -> 0 ->> 'display' = 'unpublished';
  assert v -> 'modules' -> 1 ->> 'display' = 'unpublished';
  assert v -> 'modules' -> 2 ->> 'display' = 'locked';
  assert (v -> 'modules' -> 0 -> 'openable') = 'false'::jsonb;
  assert v -> 'next_action' ->> 'title' = 'Not yet published';
  assert v -> 'certification' = 'null'::jsonb;
  assert (select count(*) from public.academy_program) = 1, 'only the enrolled program';
  assert (select count(*) from public.academy_enrollment) = 1;
  assert (select count(*) from public.academy_question) = 0;
end $$;

\echo '== a trainee cannot change quiz settings or read another enrollment =='
do $$
begin
  update public.academy_quiz set pass_mark = 1 where kind = 'final';
  begin
    insert into public.academy_question (module_id, prompt, question_type, correct_answer)
    select id, 'Should not insert', 'multiple_choice', 'a' from public.academy_module limit 1;
    raise exception 'a trainee insert should be refused';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.academy_assign_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'academy_admin', 'grant', 'no');
    raise exception 'a trainee cannot assign Academy roles';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  assert (select pass_mark from public.academy_quiz where kind = 'final') = 85, 'settings stayed put';
end $$;

\echo '== lesson bodies follow the lock, and questions stay hidden =='
insert into public.academy_lesson (module_id, lesson_code, sort_order, title, body, published)
select m.id, 'M00-L01', 1, 'Welcome', 'Unpublished body', false
from public.academy_module m
join public.academy_program p on p.id = m.program_id
where p.slug = 'da-operator-academy' and m.order_number = 0;

insert into public.academy_lesson (id, module_id, lesson_code, sort_order, title, body, published)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa71', m.id, 'M02-L01', 1, 'The standard', 'Published body', true
from public.academy_module m
join public.academy_program p on p.id = m.program_id
where p.slug = 'da-operator-academy' and m.order_number = 2;

insert into public.academy_asset (lesson_id, asset_type, storage_path, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa71', 'document', 'academy/m02/guide.pdf', 'live'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa71', 'document', 'academy/m02/draft.pdf', 'draft');

insert into public.academy_question (module_id, prompt, question_type, options, correct_answer, explanation, concept_tag)
select m.id, 'Which one is the standard?', 'multiple_choice',
  '[{"id":"a","text":"The written one"}]'::jsonb, 'a', 'After a pass.', 'standard'
from public.academy_module m
join public.academy_program p on p.id = m.program_id
where p.slug = 'da-operator-academy' and m.order_number = 1;

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_lesson) = 0, 'locked and unpublished lessons stay hidden';
  assert (select count(*) from public.academy_asset) = 0, 'files stay hidden with the lesson';
  assert (select count(*) from public.academy_question) = 0, 'the answer key is not readable';
end $$;

\echo '== a passed module-1 quiz unlocks module 2 and nothing past a practical gate =='
reset role;
insert into public.academy_attempt (
  enrollment_id, quiz_id, attempt_number, questions_drawn, answers, score, passed, finished_at, time_taken_seconds
)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61', q.id, 1, '{}', '[]'::jsonb, 5, true, now(), 40
from public.academy_quiz q
join public.academy_module m on m.id = q.module_id
where m.order_number = 1;

insert into public.academy_progress (enrollment_id, lesson_id, status, time_spent_seconds)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa62', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa71', 'completed', 90);

insert into public.academy_hold (enrollment_id, quiz_id, reason, attempts_used, status, reviewer_id, review_notes)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61', q.id, 'Fifth failed attempt', 5, 'open',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Manager note only'
from public.academy_quiz q
join public.academy_module m on m.id = q.module_id
where m.order_number = 1;

insert into public.academy_certification (enrollment_id, profile_id, level, granted_by)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  1,
  'aaaaaaaa-0000-0000-0000-000000000001'
);

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare
  v jsonb;
begin
  v := public.academy_shell();
  assert v -> 'modules' -> 2 ->> 'display' = 'available', v -> 'modules' -> 2 ->> 'display';
  assert v -> 'modules' -> 3 ->> 'display' = 'locked', 'practical gate still holds module 3';
  assert v -> 'certification' ->> 'label' = 'Certified Operator';
  assert (select count(*) from public.academy_lesson) = 1, 'the unlocked published lesson';
  assert (select body from public.academy_lesson) = 'Published body';
  assert (select count(*) from public.academy_asset) = 1, 'live file only';
  assert (select storage_path from public.academy_asset) = 'academy/m02/guide.pdf';
  assert (select count(*) from public.academy_attempt) = 1;
  assert (select count(*) from public.academy_progress) = 0, 'the other trainee''s progress is hidden';
  assert (select count(*) from public.academy_hold) = 0, 'review notes are hidden';
  assert (select count(*) from public.academy_certification) = 1;
  assert (select count(*) from public.academy_question) = 0;
end $$;

\echo '== trainee B sees none of A, and each manager sees only their assignee =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_enrollment where profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') = 0;
  assert (select count(*) from public.academy_attempt) = 0;
  assert (select count(*) from public.academy_certification) = 0;
  assert (select count(*) from public.academy_hold) = 0;
  assert (select count(*) from public.academy_progress) = 1, 'B sees their own progress';
  assert public.academy_shell() ->> 'state' = 'active';
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_enrollment) = 1;
  assert (select profile_id from public.academy_enrollment) = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  assert (select review_notes from public.academy_hold) = 'Manager note only';
  assert (select count(*) from public.academy_attempt) = 1;
  assert (select count(*) from public.academy_progress) = 0, 'B is not assigned to this manager';
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_enrollment) = 1;
  assert (select profile_id from public.academy_enrollment) = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  assert (select count(*) from public.academy_hold) = 0;
  assert (select count(*) from public.academy_attempt) = 0;
end $$;

\echo '== a denied reviewer sees nobody, and restoring the role brings their trainee back =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
select public.academy_assign_role(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'reviewer', 'deny', 'Not this manager'
);
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_enrollment) = 0, 'a denied reviewer sees nobody';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
select public.academy_assign_role(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'reviewer', 'grant', 'Restored'
);
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_enrollment) = 1, 'the grant restores the assigned trainee';
  assert (select profile_id from public.academy_enrollment) = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
end $$;

\echo '== a superseded agreement closes the shell again until the new one is signed =='
reset role;
insert into public.da_agreement (id, recipient_id, template_id, status, docuseal_submission_id)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa53',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa31',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa41',
  'sent',
  'academy-sub-a2'
);
update public.da_agreement
   set superseded_by_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa53'
 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa51';
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare
  v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'agreement_pending', v ->> 'state';
  assert jsonb_array_length(v -> 'modules') = 0;
  assert (select agreement_id from public.academy_enrollment where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61')
    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa51', 'the stored link can be stale; access reads DocuSeal';
end $$;
reset role;
update public.da_agreement set status = 'completed' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa53';

\echo '== invited, stalled, on hold, completed, withdrawn =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
update public.academy_enrollment set status = 'invited' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61';
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'invited', v ->> 'state';
  assert jsonb_array_length(v -> 'modules') = 0;
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
update public.academy_enrollment set status = 'stalled' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61';
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'stalled', v ->> 'state';
  assert v ->> 'banner' = 'Your training has stalled. Continue where you left off.';
  assert jsonb_array_length(v -> 'modules') = 13;
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
update public.academy_enrollment set status = 'on_hold_review' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61';
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'on_hold', v ->> 'state';
  assert jsonb_array_length(v -> 'modules') = 0, 'hold shell has no modules';
  assert (select count(*) from public.academy_module) = 0;
  assert (select count(*) from public.academy_attempt) = 0;
  assert (select count(*) from public.academy_lesson) = 0;
  assert (select count(*) from public.academy_certification) = 0;
  assert (select count(*) from public.academy_enrollment) = 1, 'the enrollment row explains the hold';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_attempt) = 1, 'the assigned reviewer still sees the attempt';
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
update public.academy_enrollment set status = 'completed' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61';
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'completed', v ->> 'state';
  assert jsonb_array_length(v -> 'modules') = 13, 'completed material stays reachable';
  assert v -> 'certification' ->> 'label' = 'Certified Operator';
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
update public.academy_enrollment set status = 'withdrawn' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa61';
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false); end $$;
do $$
declare v jsonb;
begin
  v := public.academy_shell();
  assert v ->> 'state' = 'no_access', v ->> 'state';
  assert v -> 'program' = 'null'::jsonb;
  assert (select count(*) from public.academy_enrollment) = 0, 'withdrawn reads as no rows';
  assert (select count(*) from public.academy_attempt) = 0;
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_enrollment) = 0, 'a reviewer loses a withdrawn trainee';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_enrollment) = 2, 'academy admin still sees both';
  assert (select count(*) from public.academy_question) = 1, 'academy admin can read the pool';
  assert (select count(*) from public.academy_program) = 7;
end $$;
update public.academy_quiz set lockout_minutes = 31 where kind = 'final';

\echo '== suspension removes access without deleting the enrollment =='
reset role;
update public.profile set state = 'suspended' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', false); end $$;
do $$
begin
  assert public.academy_shell() ->> 'state' = 'no_access';
  assert (select count(*) from public.academy_enrollment) = 0;
end $$;

\echo '== role denial, access changes, and quiz settings land in the audit log =='
reset role;
do $$
begin
  assert exists (
    select 1 from public.audit_event
    where action = 'academy.role_assigned'
      and entity_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
      and actor_profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and after_value ->> 'effect' = 'deny'
  ), 'role denial is audited';
  assert exists (
    select 1 from public.audit_event
    where action = 'academy.access_changed'
      and acting_as_profile_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and actor_profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ), 'status changes are audited';
  assert exists (
    select 1 from public.audit_event
    where action = 'academy.settings_changed'
      and actor_profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and after_value ->> 'lockout_minutes' = '31'
  ), 'quiz setting changes are audited';
end $$;

\echo '== anon cannot read the Academy =='
set role anon;
do $$
begin
  begin
    perform count(*) from public.academy_enrollment;
    raise exception 'anon should not have academy table privileges';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.academy_shell();
    raise exception 'anon should not call academy_shell';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
