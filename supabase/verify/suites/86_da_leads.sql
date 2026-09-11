-- Workspace-owned Client Acquisition leads. Airtable is a destination, not the source.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures: admin session =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== da_leads exists with an Airtable destination id, not as a required key =='
do $$
begin
  assert exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'da_leads'
  );
  assert exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'da_leads' and column_name = 'airtable_record_id'
  );
  assert exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'da_prospect_call' and column_name = 'lead_id'
  );
end $$;

\echo '== an admin can create a lead; email is unique when present =='
do $$
declare
  v_id uuid;
  r public.da_leads%rowtype;
begin
  insert into public.da_leads (
    full_name, email, company_name, qualification_result, readiness_score, stage
  ) values (
    'Jordan Blake', 'jordan@example.com', 'Blake Coaching', 'Qualified', 85, 'Step 1 Captured'
  ) returning id into v_id;

  select * into r from public.da_leads where id = v_id;
  assert r.airtable_record_id is null;
  assert r.qualification_result = 'Qualified';
  assert r.readiness_score = 85;

  begin
    insert into public.da_leads (full_name, email)
    values ('Duplicate', 'jordan@example.com');
    raise exception 'duplicate email should be refused';
  exception when unique_violation then null;
  end;
end $$;

\echo '== deleting a lead nulls da_prospect_call.lead_id =='
do $$
declare
  v_lead uuid;
  v_call uuid;
begin
  select id into v_lead from public.da_leads where email = 'jordan@example.com';
  insert into public.da_prospect_call (kind, source, lead_id, email, full_name)
  values ('booking', 'calendar', v_lead, 'jordan@example.com', 'Jordan Blake')
  returning id into v_call;

  delete from public.da_leads where id = v_lead;
  assert (select lead_id from public.da_prospect_call where id = v_call) is null;
end $$;
