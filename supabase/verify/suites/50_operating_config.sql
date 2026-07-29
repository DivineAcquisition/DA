-- Per-client operating configuration. It used to live in the application: the
-- industry template was inferred by string-matching the notes column, and the
-- definition of a qualified booking was one string literal shared by everybody.
\set ON_ERROR_STOP on
set search_path = public;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== the templates are rows, and every one carries its fields =='
do $$
begin
  assert (select count(*) from public.industry_template) = 5,
    'the five templates that used to be a TypeScript array';
  assert (select count(*) from public.industry_template_field where template_key = 'med-spa') = 3;
  assert (select options from public.industry_template_field where key = 'treatmentInterest')
    @> array['Injectables', 'Laser'],
    'a select carries its options';
  assert (select count(*) from public.industry_template_field where template_key = 'generic') = 0,
    'the generic template is core only';
end $$;

\echo '== a select must carry options, and nothing else may =='
do $$
begin
  begin
    insert into public.industry_template_field (template_key, key, label, field_type)
    values ('generic', 'pickOne', 'Pick one', 'select');
    raise exception 'a select with no options should be refused';
  exception when sqlstate '23514' then null;
  end;

  begin
    insert into public.industry_template_field (template_key, key, label, field_type, options)
    values ('generic', 'howMany', 'How many', 'number', array['a', 'b']);
    raise exception 'options on a number field should be refused';
  exception when sqlstate '23514' then null;
  end;
end $$;

\echo '== the locked core cannot be redefined per client =='
do $$
begin
  -- A client-specific appointmentsBooked would silently break every
  -- cross-operator comparison, which is the whole reason the core is locked.
  begin
    insert into public.industry_template_field (template_key, key, label, field_type)
    values ('generic', 'appointmentsBooked', 'Appointments booked (theirs)', 'number');
    raise exception 'a template may not shadow a core key';
  exception when sqlstate '23514' then null;
  end;

  begin
    insert into public.case_file_eod_field (case_file_id, key, label, field_type)
    values ('cccccccc-0000-0000-0000-000000000001', 'conversationsHandled', 'Theirs', 'number');
    raise exception 'a client override may not shadow a core key either';
  exception when sqlstate '23514' then null;
  end;
end $$;

\echo '== a client is configured by column, not by matching its notes =='
do $$
declare
  v_case_file public.client_case_file;
begin
  v_case_file := public.create_case_file(
    'Bright Smile Aesthetics', 'Med spa, two locations', 'Dr Renata Vos', 'renata@example.test',
    '2026-07-01', 3000, 40000, 'med-spa', 'Clinical director', 'WhatsApp');

  assert v_case_file.industry_key = 'med-spa', 'the template is asked for, not inferred';
  assert v_case_file.qualified_booking_definition =
    'A consult booked with a confirmed time, a named treatment interest, and a reachable phone number.',
    'and seeds this client''s own definition from the template';
  assert v_case_file.contact_role = 'Clinical director';
  assert v_case_file.contact_channel = 'WhatsApp';

  -- Tidying the notes cannot change what operators are asked any more.
  update public.client_case_file set notes = 'No longer mentions a med spa' where id = v_case_file.id;
  assert (select industry_key from public.client_case_file where id = v_case_file.id) = 'med-spa',
    'the notes column has no say in it';

  assert (select count(*) from public.eod_fields_for_case_file(v_case_file.id)) = 3,
    'the template''s fields resolve for this client';
end $$;

\echo '== an unknown template is refused rather than silently becoming generic =='
do $$
begin
  begin
    perform public.create_case_file('Nowhere Clinic', null, null, null, null, null, null, 'chiropractic');
    raise exception 'an unknown industry should have been refused';
  exception when sqlstate 'P0002' then null;
  end;
end $$;

\echo '== a per-client override replaces the template rather than adding to it =='
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.client_case_file where slug = 'bright-smile-aesthetics';

  insert into public.case_file_eod_field (case_file_id, key, label, field_type, required, sort_order)
  values (v_id, 'membershipsSold', 'Memberships sold', 'number', true, 10);

  assert (select count(*) from public.eod_fields_for_case_file(v_id)) = 1,
    'the override stands alone, so what an operator is asked is predictable';
  assert (select key from public.eod_fields_for_case_file(v_id)) = 'membershipsSold';
  assert (select overridden from public.eod_fields_for_case_file(v_id)) = true,
    'and it is visibly an override';

  delete from public.case_file_eod_field where case_file_id = v_id;
  assert (select count(*) from public.eod_fields_for_case_file(v_id)) = 3,
    'removing it falls back to the template';
end $$;

\echo '== changing the template keeps a definition the admin wrote themselves =='
do $$
declare
  v_id uuid;
  v_row public.client_case_file;
begin
  select id into v_id from public.client_case_file where slug = 'bright-smile-aesthetics';

  -- Still the template's suggestion, so switching industry may move it.
  v_row := public.set_case_file_operating_config(v_id, 'cleaning');
  assert v_row.industry_key = 'cleaning';
  assert v_row.qualified_booking_definition like 'A walkthrough or first clean%',
    'an untouched definition follows the template';

  -- Now the admin writes their own.
  v_row := public.set_case_file_operating_config(v_id, null, 'A first clean booked and paid for up front.');
  assert v_row.qualified_booking_definition = 'A first clean booked and paid for up front.';

  v_row := public.set_case_file_operating_config(v_id, 'coaching');
  assert v_row.industry_key = 'coaching';
  assert v_row.qualified_booking_definition = 'A first clean booked and paid for up front.',
    'a deliberate edit is not undone by a later change of industry';

  assert (select count(*) from public.audit_event where action = 'case_file.config_changed') = 3,
    'rule 10: every change is in the audit log';
end $$;

\echo '== an escalation is routed to people who exist =='
do $$
declare
  v_id uuid;
begin
  insert into public.escalation (placement_id, operator_id, case_file_id, category, customer_context, needed, response_due_at)
  values (
    '22222222-3333-0000-0000-000000000001', '11111111-2222-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000001', 'clinical', 'Asked about a contraindication',
    'A clinical answer before I reply', now() + interval '4 hours'
  )
  returning id into v_id;

  -- The hub used to write the literal 'DA Admin'. Nobody is called that, so when
  -- an operator asked who had their escalation the answer was a string.
  assert (select routed_to from public.escalation where id = v_id) = array['admin@divineacquisition.io'],
    format('expected the real roster, got %s', (select routed_to from public.escalation where id = v_id));

  -- An explicit routing decision still stands.
  insert into public.escalation (placement_id, operator_id, case_file_id, category, customer_context, needed, response_due_at, routed_to)
  values (
    '22222222-3333-0000-0000-000000000001', '11111111-2222-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000001', 'pricing_exception', 'Wants a discount',
    'A price I can offer', now() + interval '4 hours', array['Named Person']
  )
  returning id into v_id;

  assert (select routed_to from public.escalation where id = v_id) = array['Named Person'];
end $$;

\echo '== an operator can be told who staff are, by name and nothing else =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  -- The hub printed 'DA Admin' for whoever assigned a task or adjusted a pay
  -- statement, because an operator may only read their own profile row. An
  -- operator disputing a deduction has to be able to find out who made it.
  assert (select count(*) from public.v_staff_name) >= 1,
    'the staff directory is readable';
  assert (select display_name from public.v_staff_name limit 1) is not null;

  begin
    perform count(*) from public.profile where role = 'admin';
    -- Readable rows are still limited to their own by RLS, so this returns zero
    -- rather than raising.
    assert (select count(*) from public.profile where role = 'admin') = 0,
      'the roster itself stays closed';
  exception when sqlstate '42501' then null;
  end;
end $$;

reset role;

\echo '== the dictionary is readable by an operator, the overrides are not writable =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  -- An operator has to be able to read the field definitions to fill the form in.
  assert (select count(*) from public.industry_template) = 5;
  assert (select count(*) from public.industry_template_field) >= 12;

  begin
    insert into public.industry_template (key, name, suggested_qualified_booking)
    values ('made-up', 'Made up', 'Anything');
    raise exception 'an operator should not be able to add a template';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.set_case_file_operating_config(
      'cccccccc-0000-0000-0000-000000000001', 'cleaning');
    raise exception 'an operator should not be able to reconfigure a client';
  exception when sqlstate '42501' then null;
  end;
end $$;

reset role;

\echo ''
\echo 'ALL OPERATING CONFIG ASSERTIONS PASSED'
