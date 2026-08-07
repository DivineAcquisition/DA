-- The DocuSeal workspace. Agreements are pulled rather than retyped, and what a
-- signer submits becomes the profile the next agreement is filled from.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures: a recipient, a template, and an agreement awaiting signature =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

do $$
declare
  v_recipient uuid;
  v_template uuid;
begin
  insert into public.da_recipient (full_name, email, recipient_type, business_name)
  values ('Ada Lovelace', 'ada@analytical.test', 'client', 'Analytical Engines LLC')
  returning id into v_recipient;

  insert into public.da_agreement_template (name, recipient_type, docuseal_template_id, docuseal_fields)
  values (
    'Client services agreement', 'client', '4001',
    '[{"name":"Full Name","type":"text","required":true},
      {"name":"Mailing Address","type":"text"},
      {"name":"Signature","type":"signature","required":true}]'::jsonb
  )
  returning id into v_template;

  insert into public.da_agreement (recipient_id, template_id, docuseal_submission_id, status, source)
  values (v_recipient, v_template, 'sub-9001', 'sent', 'docuseal');
end $$;

\echo '== a template pulled twice is the same template, not two =='
do $$
begin
  begin
    insert into public.da_agreement_template (name, recipient_type, docuseal_template_id)
    values ('Client services agreement (copy)', 'client', '4001');
    raise exception 'a second local template for one DocuSeal template should be refused';
  exception when unique_violation then null;
  end;
end $$;

\echo '== an agreement pulled twice is the same agreement, not two =='
do $$
declare
  v_recipient uuid;
  v_template uuid;
begin
  select id into v_recipient from public.da_recipient where email = 'ada@analytical.test';
  select id into v_template from public.da_agreement_template where docuseal_template_id = '4001';

  begin
    insert into public.da_agreement (recipient_id, template_id, docuseal_submission_id, status)
    values (v_recipient, v_template, 'sub-9001', 'sent');
    raise exception 'a second agreement for one DocuSeal submission should be refused';
  exception when unique_violation then null;
  end;
end $$;

\echo '== what the signer submitted lands on the agreement and on the recipient =='
do $$
declare
  v_ok boolean;
  r public.da_agreement;
begin
  v_ok := public.da_apply_agreement_values(
    'sub-9001',
    '{"Full Name":"Ada Lovelace","Mailing Address":"12 Baker Street","Notes":"   "}'::jsonb
  );
  assert v_ok, 'the submission is matched by its DocuSeal id';

  select * into r from public.da_agreement where docuseal_submission_id = 'sub-9001';
  assert r.submitted_values ->> 'Mailing Address' = '12 Baker Street',
    'the agreement carries its own answers';

  assert (
    select value from public.da_recipient_field
     where field_key = 'mailing address'
  ) = '12 Baker Street',
    'and the answer becomes the profile the next agreement is filled from';

  assert not exists (select 1 from public.da_recipient_field where field_key = 'notes'),
    'a blank answer teaches nothing and is not recorded';
end $$;

\echo '== a later answer corrects the earlier one rather than duplicating it =='
do $$
begin
  perform public.da_apply_agreement_values(
    'sub-9001', '{"Mailing Address":"14 Baker Street"}'::jsonb);

  assert (select count(*) from public.da_recipient_field where field_key = 'mailing address') = 1,
    'one recipient, one answer per field';
  assert (select value from public.da_recipient_field where field_key = 'mailing address')
    = '14 Baker Street',
    'the latest answer wins';
end $$;

\echo '== an unknown submission changes nothing =='
do $$
begin
  assert public.da_apply_agreement_values('sub-does-not-exist', '{"Full Name":"Nobody"}'::jsonb) = false,
    'there is nothing to record against';
  assert not exists (select 1 from public.da_recipient_field where value = 'Nobody');
end $$;

\echo '== a field is mapped once globally and once per template, never twice =='
do $$
declare
  v_template uuid;
begin
  select id into v_template from public.da_agreement_template where docuseal_template_id = '4001';

  insert into public.da_field_mapping (field_name, source_key) values ('Company', 'business_name');
  insert into public.da_field_mapping (agreement_template_id, field_name, source_key)
  values (v_template, 'Company', 'literal');

  begin
    insert into public.da_field_mapping (field_name, source_key) values ('company', 'full_name');
    raise exception 'a second global mapping for one field should be refused';
  exception when unique_violation then null;
  end;

  begin
    insert into public.da_field_mapping (agreement_template_id, field_name, source_key)
    values (v_template, 'COMPANY', 'full_name');
    raise exception 'a second mapping for one field on one template should be refused';
  exception when unique_violation then null;
  end;
end $$;

\echo '== none of it is readable without being an administrator =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  assert (select count(*) from public.da_recipient_field) = 0,
    'what a client typed on an agreement is not an operator''s to read';
  assert (select count(*) from public.da_field_mapping) = 0;
  assert (select count(*) from public.da_sync_run) = 0;
end $$;

set role anon;
do $$
begin
  begin
    perform count(*) from public.da_recipient_field;
    raise exception 'anon should have no grant on submitted values';
  exception when sqlstate '42501' then null;
  end;
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo ''
\echo 'ALL DOCUSEAL AGREEMENT ASSERTIONS PASSED'
