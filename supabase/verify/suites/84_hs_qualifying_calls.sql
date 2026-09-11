-- Home-services qualifying call workspace: admin-only tables and reused calendar tokens.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures: admin session =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

update public.da_settings
   set default_booking_url = 'https://cal.example.test/audit'
 where id = 1;

\echo '== an admin can create an hs_call; status defaults to scheduled =='
do $$
declare
  v_id uuid;
  r public.hs_calls%rowtype;
begin
  insert into public.hs_calls (
    contact_name, company_name, trade, role, crew_count, who_answers_phone, stated_pain, phone, email
  ) values (
    'Alex Rivera', 'Rivera HVAC', 'hvac', 'owner', 'two_to_four', 'owner',
    'Missed calls on the truck', '555-0200', 'alex@riverahvac.test'
  ) returning id into v_id;

  select * into r from public.hs_calls where id = v_id;
  assert r.status = 'scheduled';
  assert r.calendar_token is null;
  assert r.stated_pain = 'Missed calls on the truck';
end $$;

\echo '== answers upsert per question_key and cascade-delete with the call =='
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.hs_calls where email = 'alex@riverahvac.test';

  insert into public.hs_call_answers (call_id, question_key, answer_text, flagged)
  values (v_id, 'why_responded', 'Saw the ad', false);

  insert into public.hs_call_answers (call_id, question_key, answer_text, flagged)
  values (v_id, 'why_responded', 'Saw the ad twice', true)
  on conflict (call_id, question_key) do update
    set answer_text = excluded.answer_text, flagged = excluded.flagged;

  assert (select count(*) from public.hs_call_answers where call_id = v_id) = 1;
  assert (select flagged from public.hs_call_answers where call_id = v_id and question_key = 'why_responded');
end $$;

\echo '== an hs_call calendar token resolves through the existing /c/ RPC =='
do $$
declare
  v_id uuid;
  v_token text := 'hscalltokentestvalue32charsxxxxxxxx';
  resolved jsonb;
begin
  assert length(v_token) >= 32;
  select id into v_id from public.hs_calls where email = 'alex@riverahvac.test';
  update public.hs_calls set calendar_token = v_token where id = v_id;

  resolved := public.da_resolve_calendar_token(v_token);
  assert resolved->>'destination_url' = 'https://cal.example.test/audit',
    'hs_call tokens reuse da_resolve_calendar_token and default_booking_url';
end $$;

\echo '== an operator cannot read or write hs_calls =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  begin
    insert into public.hs_calls (
      contact_name, company_name, trade, role, crew_count, who_answers_phone
    ) values (
      'Blocked', 'Blocked Co', 'plumbing', 'owner', 'owner_only', 'nobody'
    );
    raise exception 'an operator must not write hs_calls';
  exception when insufficient_privilege then null;
  end;

  assert (select count(*) from public.hs_calls) = 0,
    'RLS hides every hs_call from an operator';
  assert (select count(*) from public.hs_call_answers) = 0,
    'RLS hides every hs_call answer from an operator';
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== deleting an hs_call removes its answers =='
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.hs_calls where email = 'alex@riverahvac.test';
  delete from public.hs_calls where id = v_id;
  assert not exists (select 1 from public.hs_call_answers where call_id = v_id);
end $$;

\echo ''
\echo 'ALL HS QUALIFYING CALL ASSERTIONS PASSED'
