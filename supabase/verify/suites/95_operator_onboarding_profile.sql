-- Finishing operator onboarding opens one profile case file and enrolls them
-- in the Academy. A client finish does not. An end-of-day report filed on a
-- client placement still belongs to the operator profile.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== operator protocols point at the Academy =='
do $$
begin
  assert (select next_steps from public.da_onboarding_protocol where key = 'va_sales_operator') ilike '%Academy%',
    'sales operator onboarding names the Academy';
  assert (select next_steps from public.da_onboarding_protocol where key = 'standard_operator') ilike '%Academy%',
    'standard operator onboarding names the Academy';
  assert position('record_kind' in pg_get_viewdef('public.v_case_file_health'::regclass)) > 0,
    'client health leaves operator profiles out';
end $$;

\echo '== a sales operator who finishes is routed to the Academy and given one profile =='
do $$
declare
  v_recipient uuid := 'f95f95f9-0000-4000-8000-000000000001';
  v_token text := 'f95salesoperatoronboardingtoken01';
  v_result jsonb;
  v_case uuid;
  v_operator uuid;
  v_profile uuid;
  v_client_case uuid := 'f95f95f9-0000-4000-8000-0000000000c1';
  v_placement uuid := 'f95f95f9-0000-4000-8000-0000000000d1';
  v_leaked boolean;
  v_table text;
begin
  insert into public.da_recipient (id, full_name, email, recipient_type)
  values (v_recipient, 'Ana Cruz', 'ana.cruz@operators.test', 'operator');

  insert into public.da_onboarding_submission (protocol_key, recipient_id, access_token, status, answers)
  values (
    'va_sales_operator',
    v_recipient,
    v_token,
    'pending',
    jsonb_build_object(
      'legal_name', jsonb_build_object('kind', 'form_question', 'value', 'Ana Cruz'),
      'preferred_name', jsonb_build_object('kind', 'form_question', 'value', 'Ana'),
      'email', jsonb_build_object('kind', 'form_question', 'value', 'ana.work@operators.test'),
      'whatsapp', jsonb_build_object('kind', 'form_question', 'value', '+639171234567'),
      'discord', jsonb_build_object('kind', 'form_question', 'value', 'ana.cruz'),
      'city_country', jsonb_build_object('kind', 'form_question', 'value', 'Manila, Philippines'),
      'timezone', jsonb_build_object('kind', 'form_question', 'value', 'Asia/Manila'),
      'shift', jsonb_build_object('kind', 'form_question', 'value', '9am_530pm_est'),
      'training_availability', jsonb_build_object('kind', 'form_question', 'value', 'yes_all_five'),
      'bank_name', jsonb_build_object('kind', 'form_question', 'value', 'Bank of the Philippine Islands'),
      'account_number', jsonb_build_object('kind', 'form_question', 'value', '9988776655'),
      'account_number_confirm', jsonb_build_object('kind', 'form_question', 'value', '9988-7766-55'),
      'da_login', jsonb_build_object('kind', 'form_question', 'value', 'ana.cruz@divineacquisition.io'),
      'da_password', jsonb_build_object('kind', 'form_question', 'value', 'saved'),
      'payout', jsonb_build_object('kind', 'form_question', 'value', 'wise', 'last4', '4412'),
      'has_computer', jsonb_build_object('kind', 'form_question', 'value', 'yes'),
      'has_internet', jsonb_build_object('kind', 'form_question', 'value', 'yes'),
      'has_headset', jsonb_build_object('kind', 'form_question', 'value', 'yes'),
      'has_quiet_workspace', jsonb_build_object('kind', 'form_question', 'value', 'yes'),
      'apploye_download', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()),
      'weekly_hours', jsonb_build_object('kind', 'form_question', 'value', 'part_time_4_5'),
      'work_schedule', jsonb_build_object('kind', 'form_question', 'value', '{"days":[{"day":"mon","start":"09:00","end":"13:00"}]}'),
      'years_sales', jsonb_build_object('kind', 'form_question', 'value', 'y3_5'),
      'roles_held', jsonb_build_object('kind', 'form_question', 'value', 'sdr,appointment_setter'),
      'industries_sold', jsonb_build_object('kind', 'form_question', 'value', 'med_spa,home_services'),
      'verticals_interest', jsonb_build_object('kind', 'form_question', 'value', 'med_spa'),
      'confirm_training_unpaid', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()),
      'confirm_shift_commitment', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()),
      'confirm_agreement_read', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()),
      'confirm_accuracy', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now())
    )
  );

  insert into app.onboarding_credential (submission_id, login_email, password_hash, payout_method, payout_reference)
  select s.id,
         'ana.cruz@divineacquisition.io',
         extensions.crypt('Correct-horse-1', extensions.gen_salt('bf')),
         'wise',
         'wise|USD|Ana Cruz|ana@wise.com'
    from public.da_onboarding_submission s
   where s.access_token = v_token;

  v_result := public.da_onboarding_finish(v_token, 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;

  select o.id, o.profile_id into v_operator, v_profile
    from public.operator o
   where lower(o.email) = 'ana.cruz@divineacquisition.io';

  assert v_operator is not null, 'an operator row is opened';
  assert (select name from public.operator where id = v_operator) = 'Ana', 'preferred name is the profile name';
  assert (select status from public.operator where id = v_operator) = 'in_training';
  assert (select time_zone from public.operator where id = v_operator) = 'Asia/Manila';
  assert (select handle from public.operator where id = v_operator) = 'ana.cruz';
  assert (select payout_method::text from public.operator where id = v_operator) = 'wise';
  assert (select payout_reference from public.operator where id = v_operator) = 'wise|USD|Ana Cruz|ana@wise.com';
  assert (select extensions.crypt('Correct-horse-1', encrypted_password) = encrypted_password
            from auth.users where id = v_profile),
    'the Divine Acquisition password is the login password';
  assert (select email from public.profile where id = v_profile) = 'ana.cruz@divineacquisition.io';
  assert (select state from public.profile where id = v_profile) = 'active';
  assert (select role from public.profile where id = v_profile) = 'operator';

  select id into v_case
    from public.client_case_file
   where operator_id = v_operator and record_kind = 'operator';
  assert v_case is not null, 'one operator profile case file';
  assert (select count(*) from public.client_case_file where operator_id = v_operator) = 1;
  assert (select count(*) from public.placement where case_file_id = v_case) = 0,
    'the profile is not a live placement';
  assert (select case_file_id from public.da_onboarding_submission where access_token = v_token) = v_case;
  assert position('9988776655' in (select notes from public.client_case_file where id = v_case)) = 0,
    'the bank account number stays off the case file';
  assert (select notes from public.client_case_file where id = v_case) ilike '%Mon 09:00-13:00%';
  assert position('ana@wise.com' in (select notes from public.client_case_file where id = v_case)) = 0,
    'the payout reference stays off the case file';
  assert position('Correct-horse-1' in (select notes from public.client_case_file where id = v_case)) = 0;
  assert position('ana@wise.com' in (select answers::text from public.da_onboarding_submission where access_token = v_token)) = 0;
  assert position('Correct-horse-1' in (select answers::text from public.da_onboarding_submission where access_token = v_token)) = 0;
  assert position('9988776655' in (select payout_reference from public.operator where id = v_operator)) = 0;
  assert (select contact_email from public.client_case_file where id = v_case) = 'ana.work@operators.test';
  assert not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name like 'academy%' and column_name ilike '%payout%'
  ), 'Academy tables do not have payout columns';
  for v_table in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_name like 'academy%' and table_type = 'BASE TABLE'
  loop
    execute format(
      'select exists (select 1 from public.%I t where row_to_json(t)::text like %L)',
      v_table, '%ana@wise.com%'
    ) into v_leaked;
    assert not coalesce(v_leaked, false), v_table;
    execute format(
      'select exists (select 1 from public.%I t where row_to_json(t)::text like %L)',
      v_table, '%Correct-horse-1%'
    ) into v_leaked;
    assert not coalesce(v_leaked, false), v_table;
  end loop;

  assert (select e.status from public.academy_enrollment e
            join public.academy_program p on p.id = e.program_id
           where e.profile_id = v_profile and p.slug = 'da-operator-academy') = 'active',
    'enrolled in the Academy';
  assert (select count(*) from public.academy_enrollment where profile_id = v_profile) = 1;

  -- Finishing again does not open a second profile or a second enrollment.
  v_result := public.da_onboarding_finish(v_token, 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert (select count(*) from public.client_case_file where operator_id = v_operator) = 1;
  assert (select count(*) from public.academy_enrollment where profile_id = v_profile) = 1;

  -- A report filed on a client placement is still part of this profile.
  insert into public.client_case_file (id, name, slug) values (v_client_case, 'Northwind Dental', 'northwind-dental-f95');
  insert into public.placement (id, operator_id, case_file_id, start_date, end_date)
  values (v_placement, v_operator, v_client_case, current_date - 1, current_date + 30);
  insert into public.eod_report (
    placement_id, operator_id, shift_date, shift_start_actual, shift_end_actual,
    conversations_handled, appointments_booked, follow_ups_completed
  ) values (
    v_placement, v_operator, current_date, '09:00', '17:30', 8, 2, 4
  );

  assert (select count(*) from public.eod_report r
            join public.client_case_file c on c.operator_id = r.operator_id and c.record_kind = 'operator'
           where c.id = v_case and r.placement_id = v_placement) = 1,
    'the client-placement report is on the operator profile';
  assert (select case_file_id from public.placement where id = v_placement) = v_client_case,
    'the report''s placement still belongs to the client';
end $$;

\echo '== an unfinished form does not open a profile =='
do $$
declare
  v_recipient uuid := 'f95f95f9-0000-4000-8000-000000000002';
  v_result jsonb;
begin
  insert into public.da_recipient (id, full_name, email, recipient_type)
  values (v_recipient, 'Bea Santos', 'bea.santos@operators.test', 'operator');
  insert into public.da_onboarding_submission (protocol_key, recipient_id, access_token, status)
  values ('va_sales_operator', v_recipient, 'f95unfinishedonboardingtoken0001', 'pending');

  v_result := public.da_onboarding_finish('f95unfinishedonboardingtoken0001', 'suite');
  assert v_result ->> 'ok' = 'false', v_result::text;
  assert v_result ->> 'error' = 'missing';
  assert not exists (select 1 from public.operator where lower(email) = 'bea.santos@operators.test');
  assert not exists (select 1 from public.client_case_file where contact_email = 'bea.santos@operators.test');
end $$;

\echo '== every operator protocol, not only the sales form, opens the same kind of profile =='
do $$
declare
  v_recipient uuid := 'f95f95f9-0000-4000-8000-000000000003';
  v_result jsonb;
  v_operator uuid;
begin
  insert into public.da_recipient (id, full_name, email, recipient_type)
  values (v_recipient, 'Cam Reyes', 'cam.reyes@operators.test', 'operator');
  insert into public.da_onboarding_submission (protocol_key, recipient_id, access_token, status, answers)
  values (
    'standard_operator',
    v_recipient,
    'f95standardoperatoronboardingtok1',
    'pending',
    jsonb_build_object(
      'sop_reviewed', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()),
      'tool_access_granted', jsonb_build_object('kind', 'credential_handoff', 'access', 'received'),
      'shift_window_confirmed', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now())
    )
  );

  v_result := public.da_onboarding_finish('f95standardoperatoronboardingtok1', 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  select id into v_operator from public.operator where lower(email) = 'cam.reyes@operators.test';
  assert (select record_kind from public.client_case_file where operator_id = v_operator) = 'operator';
  assert (select e.status from public.academy_enrollment e
            join public.academy_program p on p.id = e.program_id
           where e.operator_id = v_operator and p.slug = 'da-operator-academy') = 'active';
end $$;

\echo '== an existing applicant is updated, not duplicated, and a placed operator stays placed =='
do $$
declare
  v_result jsonb;
  v_case uuid;
begin
  insert into auth.users (id, email) values
    ('f95f95f9-0000-4000-8000-000000000011', 'eli.applicant@operators.test'),
    ('f95f95f9-0000-4000-8000-000000000021', 'noa.placed@operators.test');
  update public.profile set role = 'operator', state = 'pending', full_name = 'Eli Applicant'
   where id = 'f95f95f9-0000-4000-8000-000000000011';
  update public.profile set role = 'operator', state = 'active', full_name = 'Noa Placed'
   where id = 'f95f95f9-0000-4000-8000-000000000021';

  insert into public.operator (id, profile_id, name, email, status) values
    ('f95f95f9-0000-4000-8000-000000000012', 'f95f95f9-0000-4000-8000-000000000011', 'Eli Applicant', 'eli.applicant@operators.test', 'applicant'),
    ('f95f95f9-0000-4000-8000-000000000022', 'f95f95f9-0000-4000-8000-000000000021', 'Noa Placed', 'noa.placed@operators.test', 'placed');

  insert into public.da_recipient (id, full_name, email, recipient_type, operator_id) values
    ('f95f95f9-0000-4000-8000-000000000013', 'Eli Applicant', 'eli.applicant@operators.test', 'operator', 'f95f95f9-0000-4000-8000-000000000012'),
    ('f95f95f9-0000-4000-8000-000000000023', 'Noa Placed', 'noa.placed@operators.test', 'operator', 'f95f95f9-0000-4000-8000-000000000022');

  insert into public.da_onboarding_submission (protocol_key, recipient_id, access_token, status, answers) values
    ('standard_operator', 'f95f95f9-0000-4000-8000-000000000013', 'f95existingapplicantonboarding01', 'pending',
      jsonb_build_object(
        'sop_reviewed', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()),
        'tool_access_granted', jsonb_build_object('kind', 'credential_handoff', 'access', 'received'),
        'shift_window_confirmed', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now())
      )),
    ('standard_operator', 'f95f95f9-0000-4000-8000-000000000023', 'f95placedoperatoronboardingtoken1', 'pending',
      jsonb_build_object(
        'sop_reviewed', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()),
        'tool_access_granted', jsonb_build_object('kind', 'credential_handoff', 'access', 'not_received'),
        'shift_window_confirmed', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now())
      ));

  v_result := public.da_onboarding_finish('f95existingapplicantonboarding01', 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert (select count(*) from public.operator where lower(email) = 'eli.applicant@operators.test') = 1;
  assert (select status from public.operator where id = 'f95f95f9-0000-4000-8000-000000000012') = 'in_training';
  assert (select state from public.profile where id = 'f95f95f9-0000-4000-8000-000000000011') = 'active';
  select id into v_case from public.client_case_file
   where operator_id = 'f95f95f9-0000-4000-8000-000000000012' and record_kind = 'operator';
  assert v_case is not null;
  assert (select status from public.academy_enrollment where profile_id = 'f95f95f9-0000-4000-8000-000000000011') = 'active';

  v_result := public.da_onboarding_finish('f95placedoperatoronboardingtoken1', 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert (select status from public.operator where id = 'f95f95f9-0000-4000-8000-000000000022') = 'placed',
    'a placed operator is not sent back to training';
  assert (select count(*) from public.client_case_file where operator_id = 'f95f95f9-0000-4000-8000-000000000022') = 1;
end $$;

\echo '== a client who finishes is not enrolled and does not get an operator profile =='
do $$
declare
  v_recipient uuid := 'f95f95f9-0000-4000-8000-000000000004';
  v_before integer;
  v_result jsonb;
begin
  insert into public.da_onboarding_protocol (key, recipient_type, name)
  values ('client_kickoff_f95', 'client', 'Client kickoff')
  on conflict (key) do nothing;
  insert into public.da_onboarding_protocol_step (protocol_key, key, label, kind, required, sort_order)
  values ('client_kickoff_f95', 'ready', 'I am ready for kickoff.', 'acknowledgment', true, 10)
  on conflict (protocol_key, key) do nothing;

  insert into public.da_recipient (id, full_name, email, recipient_type, business_name)
  values (v_recipient, 'Dana Client', 'dana.client@clients.test', 'client', 'Dana Co');
  insert into public.da_onboarding_submission (protocol_key, recipient_id, access_token, status, answers)
  values (
    'client_kickoff_f95',
    v_recipient,
    'f95clientonboardingtoken00000001',
    'pending',
    jsonb_build_object('ready', jsonb_build_object('kind', 'acknowledgment', 'confirmed_at', now()))
  );

  select count(*) into v_before from public.academy_enrollment;
  v_result := public.da_onboarding_finish('f95clientonboardingtoken00000001', 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert (select count(*) from public.academy_enrollment) = v_before, 'a client is not enrolled';
  assert not exists (select 1 from public.operator where lower(email) = 'dana.client@clients.test');
  assert not exists (
    select 1 from public.client_case_file where record_kind = 'operator' and contact_email = 'dana.client@clients.test'
  );
end $$;
