-- Internal practice forms: admin-only tables and cascade delete.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures: admin session =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== an admin can create a practice; stage defaults to audit_scheduled =='
do $$
declare
  v_id uuid;
  r public.practices%rowtype;
begin
  insert into public.practices (practice_name, contact_name, practice_type)
  values ('Northside Dental', 'Jordan Lee', 'dental')
  returning id into v_id;

  select * into r from public.practices where id = v_id;
  assert r.stage = 'audit_scheduled';
  assert r.call_id is null;
end $$;

\echo '== one audit per practice; dormant_revenue is not a column =='
do $$
declare
  v_practice uuid;
begin
  select id into v_practice from public.practices where practice_name = 'Northside Dental';

  insert into public.audits (practice_id, recall_list_size, avg_hygiene_value, unscheduled_treatment_value)
  values (v_practice, 100, 150, 20000);

  begin
    insert into public.audits (practice_id) values (v_practice);
    raise exception 'a second audit for one practice should be refused';
  exception when unique_violation then null;
  end;

  assert not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'audits' and column_name = 'dormant_revenue'
  );
end $$;

\echo '== deleting a practice cascades the three form tables =='
do $$
declare
  v_practice uuid;
begin
  select id into v_practice from public.practices where practice_name = 'Northside Dental';
  insert into public.debriefs (practice_id, outcome) values (v_practice, 'thinking');
  insert into public.requirements (practice_id, items) values (v_practice, '[]'::jsonb);

  delete from public.practices where id = v_practice;
  assert not exists (select 1 from public.audits where practice_id = v_practice);
  assert not exists (select 1 from public.debriefs where practice_id = v_practice);
  assert not exists (select 1 from public.requirements where practice_id = v_practice);
end $$;

\echo '== an operator cannot read or write practices =='
insert into public.practices (practice_name, contact_name, practice_type)
values ('Hidden Practice', 'Admin Only', 'med_spa');

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  begin
    insert into public.practices (practice_name, contact_name, practice_type)
    values ('Blocked', 'Blocked', 'dental');
    raise exception 'an operator must not write practices';
  exception when insufficient_privilege then null;
  end;

  assert (select count(*) from public.practices) = 0,
    'RLS hides every practice from an operator';
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

delete from public.practices where practice_name = 'Hidden Practice';

\echo ''
\echo 'ALL INTERNAL FORM ASSERTIONS PASSED'
