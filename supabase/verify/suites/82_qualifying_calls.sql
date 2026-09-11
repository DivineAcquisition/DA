-- 15-minute qualifying call workspace: admin-only tables and reused calendar tokens.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures: admin session =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

update public.da_settings
   set default_booking_url = 'https://cal.example.test/audit'
 where id = 1;

\echo '== an admin can create a call; status defaults to scheduled =='
do $$
declare
  v_id uuid;
  r public.calls%rowtype;
begin
  insert into public.calls (
    contact_name, practice_name, practice_type, role, front_desk_size, stated_pain, phone, email
  ) values (
    'Jordan Lee', 'Northside Dental', 'dental', 'owner', 'two', 'Missed calls after 5pm', '555-0100', 'jordan@northside.test'
  ) returning id into v_id;

  select * into r from public.calls where id = v_id;
  assert r.status = 'scheduled';
  assert r.calendar_token is null;
  assert r.stated_pain = 'Missed calls after 5pm';
end $$;

\echo '== answers upsert per question_key and cascade-delete with the call =='
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.calls where email = 'jordan@northside.test';

  insert into public.call_answers (call_id, question_key, answer_text, flagged)
  values (v_id, 'why_responded', 'Saw the ad', false);

  insert into public.call_answers (call_id, question_key, answer_text, flagged)
  values (v_id, 'why_responded', 'Saw the ad twice', true)
  on conflict (call_id, question_key) do update
    set answer_text = excluded.answer_text, flagged = excluded.flagged;

  assert (select count(*) from public.call_answers where call_id = v_id) = 1;
  assert (select flagged from public.call_answers where call_id = v_id and question_key = 'why_responded');
end $$;

\echo '== a qualifying-call calendar token resolves through the existing /c/ RPC =='
do $$
declare
  v_id uuid;
  v_token text := 'qualifyingcalltokentestvalue32charsxx';
  resolved jsonb;
begin
  assert length(v_token) >= 32;
  select id into v_id from public.calls where email = 'jordan@northside.test';
  update public.calls set calendar_token = v_token where id = v_id;

  resolved := public.da_resolve_calendar_token(v_token);
  assert resolved->>'destination_url' = 'https://cal.example.test/audit',
    'call tokens reuse da_resolve_calendar_token and default_booking_url';
end $$;

\echo '== an operator cannot read or write qualifying calls =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  begin
    insert into public.calls (
      contact_name, practice_name, practice_type, role, front_desk_size
    ) values (
      'Blocked', 'Blocked Practice', 'dental', 'owner', 'one'
    );
    raise exception 'an operator must not write qualifying calls';
  exception when insufficient_privilege then null;
  end;

  assert (select count(*) from public.calls) = 0,
    'RLS hides every qualifying call from an operator';
  assert (select count(*) from public.call_answers) = 0,
    'RLS hides every call answer from an operator';
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== deleting a call removes its answers =='
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.calls where email = 'jordan@northside.test';
  delete from public.calls where id = v_id;
  assert not exists (select 1 from public.call_answers where call_id = v_id);
end $$;

\echo ''
\echo 'ALL QUALIFYING CALL ASSERTIONS PASSED'
