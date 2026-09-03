-- Pipeline Airtable token is backend-only: column exists, operators cannot read it.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== da_settings holds the pipeline Airtable token =='
do $$
begin
  assert exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'da_settings'
       and column_name = 'pipeline_airtable_pat'
  ),
    'pipeline_airtable_pat must live on da_settings, not in the app';
end $$;

\echo '== an operator cannot read the pipeline Airtable token =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  begin
    perform public.da_get_pipeline_airtable_pat();
    raise exception 'an operator must not read the pipeline Airtable token';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== an admin can call the reader (value may be empty in verify) =='
do $$
declare
  v text;
begin
  v := public.da_get_pipeline_airtable_pat();
  assert v is not null,
    'admin reader returns text, including empty when unset';
end $$;

\echo ''
\echo 'ALL PIPELINE AIRTABLE PAT ASSERTIONS PASSED'
