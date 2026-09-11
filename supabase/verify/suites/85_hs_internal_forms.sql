-- Home-services internal forms: admin-only tables and cascade delete.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures: admin session =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== an admin can create a company; stage defaults to audit_scheduled =='
do $$
declare
  v_id uuid;
  r public.hs_companies%rowtype;
begin
  insert into public.hs_companies (company_name, contact_name, trade)
  values ('Apex HVAC', 'Jordan Lee', 'hvac')
  returning id into v_id;

  select * into r from public.hs_companies where id = v_id;
  assert r.stage = 'audit_scheduled';
  assert r.call_id is null;
  assert r.service_radius_miles is null;
end $$;

\echo '== one audit per company; idle_revenue is not a column =='
do $$
declare
  v_company uuid;
begin
  select id into v_company from public.hs_companies where company_name = 'Apex HVAC';

  insert into public.hs_audits (company_id, past_customer_count, avg_job_value, unsold_estimates_value)
  values (v_company, 40, 2500, 18000);

  begin
    insert into public.hs_audits (company_id) values (v_company);
    raise exception 'a second audit for one company should be refused';
  exception when unique_violation then null;
  end;

  assert not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'hs_audits' and column_name = 'idle_revenue'
  );
  assert not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'hs_audits' and column_name = 'lead_to_job_gap'
  );
end $$;

\echo '== deleting a company cascades the three form tables =='
do $$
declare
  v_company uuid;
begin
  select id into v_company from public.hs_companies where company_name = 'Apex HVAC';
  insert into public.hs_debriefs (company_id, outcome) values (v_company, 'thinking');
  insert into public.hs_requirements (company_id, items) values (v_company, '[]'::jsonb);

  delete from public.hs_companies where id = v_company;
  assert not exists (select 1 from public.hs_audits where company_id = v_company);
  assert not exists (select 1 from public.hs_debriefs where company_id = v_company);
  assert not exists (select 1 from public.hs_requirements where company_id = v_company);
end $$;

\echo '== an operator cannot read or write hs_companies =='
insert into public.hs_companies (company_name, contact_name, trade)
values ('Hidden Company', 'Admin Only', 'plumbing');

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  begin
    insert into public.hs_companies (company_name, contact_name, trade)
    values ('Blocked', 'Blocked', 'hvac');
    raise exception 'an operator must not write hs_companies';
  exception when insufficient_privilege then null;
  end;

  assert (select count(*) from public.hs_companies) = 0,
    'RLS hides every hs_company from an operator';
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

delete from public.hs_companies where company_name = 'Hidden Company';

\echo ''
\echo 'ALL HS INTERNAL FORM ASSERTIONS PASSED'
