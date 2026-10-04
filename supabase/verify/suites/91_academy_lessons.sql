-- Lesson player and content loader. Runs as authenticated, same as PostgREST.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== settings and word count =='
do $$
begin
  assert (select default_watch_percent from public.academy_setting) = 90;
  assert app.academy_word_count('Hello, world!') = 2;
  assert app.academy_reading_seconds('Hello, world!') = 30;
  assert app.academy_watched_seconds(app.academy_add_watch('[]'::jsonb, 0, 10)) = 10;
  assert app.academy_watched_seconds(app.academy_add_watch(
    '[{"start":0,"end":10},{"start":40,"end":50}]'::jsonb, 10, 40
  )) = 50, 'a later fill-in merges the gap';
end $$;

\echo '== a live video lesson, a written lesson, and one signed trainee =='
do $$
declare
  v_module uuid;
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  insert into auth.users (id, email) values (v_admin, 'admin@divineacquisition.io') on conflict (id) do nothing;
  update public.profile set role = 'admin', state = 'active' where id = v_admin;
  insert into auth.users (id, email) values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'lesson.trainee@academy.test'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'lesson.other@academy.test');
  update public.profile set role = 'operator', state = 'active' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  update public.profile set role = 'operator', state = 'active' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

  insert into public.operator (id, profile_id, name, email, status) values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Lesson Trainee', 'lesson.trainee@academy.test', 'applicant'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Other Trainee', 'lesson.other@academy.test', 'applicant');
  insert into public.da_agreement_template (id, name, recipient_type, docuseal_template_id)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb41', 'Lesson agreement', 'operator', 'academy-lesson-template')
  on conflict (id) do nothing;
  insert into public.da_recipient (id, full_name, email, recipient_type, operator_id) values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb31', 'Lesson Trainee', 'lesson.trainee@academy.test', 'operator', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb32', 'Other Trainee', 'lesson.other@academy.test', 'operator', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12');
  insert into public.da_agreement (id, recipient_id, template_id, status, docuseal_submission_id) values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb51', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb31', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb41', 'completed', 'academy-lesson-sub-a'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb52', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb32', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb41', 'completed', 'academy-lesson-sub-b');

  select m.id into v_module
  from public.academy_module m
  join public.academy_program p on p.id = m.program_id
  where p.slug = 'da-operator-academy' and m.order_number = 0;

  perform set_config('request.jwt.claim.sub', v_admin::text, false);
  perform public.academy_save_lesson(jsonb_build_object(
    'module_id', v_module, 'lesson_code', 'M00-L08', 'title', 'Video lesson', 'sort_order', 8,
    'body', '', 'status', 'live', 'required_watch_percent', 90,
    'video', jsonb_build_object('provider', 'vimeo', 'provider_id', '123456789', 'url', 'https://vimeo.com/123456789', 'duration_seconds', 100)
  ));
  perform public.academy_save_lesson(jsonb_build_object(
    'module_id', v_module, 'lesson_code', 'M00-L09', 'title', 'Written lesson', 'sort_order', 9,
    'body', 'One two three four five six seven eight nine ten.', 'status', 'live', 'required_watch_percent', 90
  ));

  insert into public.academy_enrollment (profile_id, program_id, track, manager_id, status)
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', p.id, 'Core', v_admin, 'active'
  from public.academy_program p where p.slug = 'da-operator-academy'
  on conflict (profile_id, program_id) do update set status = 'active';
  insert into public.academy_enrollment (profile_id, program_id, track, status)
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', p.id, 'Core', 'active'
  from public.academy_program p where p.slug = 'da-operator-academy'
  on conflict (profile_id, program_id) do update set status = 'active';
end $$;

\echo '== skipping ahead does not count, and mark complete waits =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false); end $$;
do $$
declare
  v_lesson uuid;
  v_watched integer;
  v jsonb;
begin
  select id into v_lesson from public.academy_lesson where lesson_code = 'M00-L08';
  perform public.academy_record_playback(v_lesson, 2);
end $$;
reset role;
update public.academy_progress
set last_playback_at = clock_timestamp() - interval '4 seconds',
    playback_position_seconds = 2
where lesson_id = (select id from public.academy_lesson where lesson_code = 'M00-L08');
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false); end $$;
do $$
declare
  v_lesson uuid;
  v_watched integer;
  v jsonb;
begin
  select id into v_lesson from public.academy_lesson where lesson_code = 'M00-L08';
  perform public.academy_record_playback(v_lesson, 6);
  select watched_seconds into v_watched from public.academy_progress where lesson_id = v_lesson;
  assert v_watched between 4 and 8, v_watched::text;
  perform public.academy_record_playback(v_lesson, 90);
  assert (select watched_seconds from public.academy_progress where lesson_id = v_lesson) = v_watched,
    'a seek does not count as watched';
  v := public.academy_mark_lesson_complete(v_lesson);
  assert v ->> 'ok' = 'false';
  assert v ->> 'missing' like '%Watch 90%%';
end $$;

\echo '== a companion document blocks completion until it is opened =='
reset role;
insert into public.academy_asset (lesson_id, asset_type, provider, storage_path, file_name, status)
select id, 'document', 'file', 'M00-L08/v1/M00-L08_companion.pdf', 'M00-L08_companion.pdf', 'live'
from public.academy_lesson where lesson_code = 'M00-L08';
update public.academy_lesson l
set document_asset_id = a.id
from public.academy_asset a
where a.lesson_id = l.id and a.storage_path = 'M00-L08/v1/M00-L08_companion.pdf' and l.lesson_code = 'M00-L08';
update public.academy_progress
set watched_seconds = 90, watched_ranges = '[{"start":0,"end":90}]'::jsonb
where lesson_id = (select id from public.academy_lesson where lesson_code = 'M00-L08');
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false); end $$;
do $$
declare
  v_lesson uuid;
  v jsonb;
begin
  select id into v_lesson from public.academy_lesson where lesson_code = 'M00-L08';
  v := public.academy_mark_lesson_complete(v_lesson);
  assert v ->> 'missing' like '%companion document%';
  perform public.academy_open_document(v_lesson);
  assert (select document_opened_at is not null from public.academy_progress where lesson_id = v_lesson);
  v := public.academy_mark_lesson_complete(v_lesson);
  assert v ->> 'ok' = 'true', v::text;
  assert public.academy_shell() -> 'modules' -> 0 ->> 'display' = 'in_progress';
end $$;

\echo '== written lessons wait for time and the end of the page =='
do $$
declare
  v_lesson uuid;
  v jsonb;
begin
  select id into v_lesson from public.academy_lesson where lesson_code = 'M00-L09';
  assert public.academy_lesson_page(v_lesson) ->> 'state' = 'ok';
  v := public.academy_mark_lesson_complete(v_lesson);
  assert v ->> 'ok' = 'false';
  assert v ->> 'missing' like '%read%' or v ->> 'missing' like '%Scroll%';
end $$;
reset role;
update public.academy_progress
set reading_seconds = 30, scrolled_to_end = true
where lesson_id = (select id from public.academy_lesson where lesson_code = 'M00-L09')
  and enrollment_id = (
    select id from public.academy_enrollment where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
      and program_id = (select id from public.academy_program where slug = 'da-operator-academy')
  );
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false); end $$;
do $$
declare
  v_lesson uuid;
begin
  select id into v_lesson from public.academy_lesson where lesson_code = 'M00-L09';
  assert (public.academy_mark_lesson_complete(v_lesson) ->> 'ok') = 'true';
  assert public.academy_shell() -> 'next_action' ->> 'title' = 'Lessons complete, quiz not yet available'
    or (public.academy_shell() -> 'modules' -> 0 ->> 'display') in ('lessons_complete', 'complete');
end $$;

\echo '== another trainee cannot read this progress, and a hold closes the lesson =='
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', false); end $$;
do $$
begin
  assert (select count(*) from public.academy_progress) = 0, 'progress is private';
  assert public.academy_lesson_page((select id from public.academy_lesson where lesson_code = 'M00-L08')) ->> 'state' = 'ok';
end $$;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
update public.academy_enrollment
set status = 'on_hold_review'
where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  and program_id = (select id from public.academy_program where slug = 'da-operator-academy');
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false); end $$;
do $$
declare
  v_token text;
begin
  assert public.academy_lesson_page((select id from public.academy_lesson where lesson_code = 'M00-L08')) ->> 'state' = 'on_hold';
  assert (select count(*) from public.academy_progress) = 0;
  select token into v_token from public.academy_document_grant
  where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' limit 1;
  assert (public.academy_claim_document(v_token) ->> 'ok') = 'false', 'a hold closes the document';
end $$;

\echo '== versions stay, live content is required, and import does not delete =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
do $$
declare
  v_before integer;
  v jsonb;
begin
  select count(*) into v_before from public.academy_lesson where archived_at is null;
  begin
    perform public.academy_save_lesson(jsonb_build_object(
      'module_id', (select module_id from public.academy_lesson where lesson_code = 'M00-L09'),
      'lesson_code', 'M00-L07', 'title', '', 'sort_order', 7, 'body', '', 'status', 'live'
    ));
    raise exception 'a live lesson with no content should be refused';
  exception when others then
    if sqlerrm not like '%live lesson%' then raise; end if;
  end;
  v := public.academy_apply_import('batch.csv', jsonb_build_array(jsonb_build_object(
    'module_id', (select module_id from public.academy_lesson where lesson_code = 'M00-L08'),
    'lesson_code', 'M00-L08', 'title', 'Video lesson revised', 'sort_order', 8,
    'body', 'A short revision.', 'status', 'live', 'required_watch_percent', 90, 'completion_policy', 'keep'
  )));
  assert (v ->> 'updated')::integer = 1;
  assert (select count(*) from public.academy_lesson where lesson_code = 'M00-L08') = 1;
  assert (select content_version from public.academy_lesson where lesson_code = 'M00-L08') >= 2;
  assert (select count(*) from public.academy_lesson_version where lesson_id = (select id from public.academy_lesson where lesson_code = 'M00-L08')) >= 1;
  assert (select count(*) from public.academy_lesson where archived_at is null) >= v_before;
  assert exists (
    select 1 from public.audit_event
    where action = 'academy.import' and actor_profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  );
end $$;

\echo '== an expired document ticket does not resolve =='
reset role;
update public.academy_enrollment
set status = 'active'
where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  and program_id = (select id from public.academy_program where slug = 'da-operator-academy');
update public.academy_document_grant
set expires_at = now() - interval '1 minute'
where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
create temp table academy_expired_token as
select token from public.academy_document_grant
where profile_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
limit 1;
grant select on academy_expired_token to authenticated;
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', false); end $$;
do $$
declare
  v_token text;
begin
  select token into v_token from academy_expired_token;
  assert (public.academy_claim_document(v_token) ->> 'ok') = 'false';
end $$;
reset role;
