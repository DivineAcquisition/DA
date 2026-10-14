-- Save, finish, and account provisioning for the expanded sales-operator form.
-- Password plaintext never lands in answers. Payout references never land in
-- answers, case-file notes, or Academy tables.

create or replace function public.da_onboarding_save_step(
  p_token text,
  p_step text,
  p_input jsonb,
  p_client text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.da_onboarding_submission%rowtype;
  v_step public.da_onboarding_protocol_step%rowtype;
  v_agreement_status text;
  v_prev jsonb;
  v_answer jsonb;
  v_value text;
  v_other text;
  v_input jsonb := coalesce(p_input, '{}'::jsonb);
  v_norm jsonb;
  v_email text;
  v_password text;
  v_confirm text;
  v_hash text;
  v_composed jsonb;
  v_check jsonb;
  v_clear_schedule boolean := false;
begin
  v_row := public.da_onboarding_resolve(p_token, p_client);
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_row from public.da_onboarding_submission where id = v_row.id for update;

  if v_row.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'message', 'This onboarding is already finished, so answers are locked.');
  end if;

  if v_row.agreement_id is not null then
    select status into v_agreement_status from public.da_agreement where id = v_row.agreement_id;
    if coalesce(v_agreement_status, '') <> 'completed' then
      return jsonb_build_object('ok', false, 'error', 'sign_first',
        'message', 'Sign your agreement first, then come back here.');
    end if;
  end if;

  select * into v_step
    from public.da_onboarding_protocol_step
   where protocol_key = v_row.protocol_key and key = btrim(coalesce(p_step, ''));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_step');
  end if;

  v_prev := v_row.answers -> v_step.key;
  if jsonb_typeof(v_prev) <> 'object' then
    v_prev := null;
  end if;

  if v_step.kind = 'form_question' then
    if v_step.input_type = 'da_login' then
      v_value := btrim(coalesce(v_input ->> 'value', ''));
      if v_value = '' then
        update app.onboarding_credential
           set login_email = null, updated_at = now()
         where submission_id = v_row.id;
        update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
        return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
      end if;
      v_norm := app.normalize_da_login(v_value);
      if coalesce((v_norm ->> 'ok')::boolean, false) is not true then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', coalesce(v_norm ->> 'message', 'Choose a username on divineacquisition.io.'));
      end if;
      v_email := v_norm ->> 'email';
      if app.da_login_taken(v_email, v_row.id) then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'That Divine Acquisition username is already taken.');
      end if;
      begin
        insert into app.onboarding_credential (submission_id, login_email)
        values (v_row.id, v_email)
        on conflict (submission_id) do update
          set login_email = excluded.login_email, updated_at = now();
      exception when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'That Divine Acquisition username is already taken.');
      end;
      v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
        'value', v_email, 'answered_at', now());

    elsif v_step.input_type = 'password' then
      v_password := coalesce(v_input ->> 'password', '');
      v_confirm := coalesce(v_input ->> 'confirm', '');
      if v_password = '' and v_confirm = '' then
        update app.onboarding_credential
           set password_hash = null, updated_at = now()
         where submission_id = v_row.id;
        update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
        return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
      end if;
      if v_password <> v_confirm then
        return jsonb_build_object('ok', false, 'error', 'mismatch', 'step', v_step.key,
          'message', 'Those passwords do not match. Type them again.');
      end if;
      if length(v_password) < 12 or length(v_password) > 72 then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Use at least 12 characters.');
      end if;
      select login_email into v_email
        from app.onboarding_credential
       where submission_id = v_row.id;
      if v_email is null then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Choose your Divine Acquisition username first.');
      end if;
      if lower(v_password) in (lower(v_email), split_part(lower(v_email), '@', 1)) then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Use a password that is not your username or email.');
      end if;
      v_hash := extensions.crypt(v_password, extensions.gen_salt('bf'));
      update app.onboarding_credential
         set password_hash = v_hash, updated_at = now()
       where submission_id = v_row.id;
      v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
        'value', 'saved', 'answered_at', now());

    elsif v_step.input_type = 'payout' then
      if btrim(coalesce(v_input ->> 'method', '')) = '' then
        update app.onboarding_credential
           set payout_method = null, payout_reference = null, updated_at = now()
         where submission_id = v_row.id;
        update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
        return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
      end if;
      v_composed := app.compose_onboarding_payout(v_input);
      if coalesce((v_composed ->> 'ok')::boolean, false) is not true then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', coalesce(v_composed ->> 'message', 'Check the payout details.'));
      end if;
      insert into app.onboarding_credential (submission_id, payout_method, payout_reference)
      values (v_row.id, v_composed ->> 'method', v_composed ->> 'reference')
      on conflict (submission_id) do update
        set payout_method = excluded.payout_method,
            payout_reference = excluded.payout_reference,
            updated_at = now();
      v_answer := jsonb_build_object(
        'kind', v_step.kind,
        'label', v_step.label,
        'value', v_composed ->> 'method',
        'last4', app.payout_last4(v_composed ->> 'reference'),
        'answered_at', now()
      );

    elsif v_step.input_type = 'schedule' then
      v_value := btrim(coalesce(v_input ->> 'value', ''));
      if v_value = '' then
        update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
        return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
      end if;
      if length(v_value) > 2000 then
        return jsonb_build_object('ok', false, 'error', 'too_long', 'step', v_step.key,
          'message', 'That answer is too long.');
      end if;
      v_check := app.check_onboarding_schedule(app.onboarding_answer(v_row.answers, 'weekly_hours'), v_value);
      if coalesce((v_check ->> 'ok')::boolean, false) is not true then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', coalesce(v_check ->> 'message', 'Check the days and hours you can work.'));
      end if;
      v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
        'value', v_value, 'answered_at', now());

    elsif v_step.input_type = 'multi_select' then
      v_value := regexp_replace(btrim(coalesce(v_input ->> 'value', '')), '\s+', '', 'g');
      if v_value = '' then
        update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
        return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
      end if;
      if length(v_value) > 2000 or v_value ~ '^,|,,|,$' then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Pick from the list.');
      end if;
      if exists (
        select 1
          from unnest(string_to_array(v_value, ',')) as token
         where not exists (
           select 1 from jsonb_array_elements(coalesce(v_step.choices, '[]'::jsonb)) c
            where c ->> 'value' = token
         )
      ) then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Pick from the list.');
      end if;
      if exists (
           select 1 from jsonb_array_elements(coalesce(v_step.choices, '[]'::jsonb)) c
            where c ->> 'value' = 'no_preference'
         )
         and position('no_preference' in v_value) > 0
         and v_value <> 'no_preference' then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'No preference stands on its own. Clear the other choices, or clear no preference.');
      end if;
      v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
        'value', v_value, 'answered_at', now());

    else
      v_value := btrim(coalesce(v_input ->> 'value', ''));

      if v_value = '' then
        update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
        return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
      end if;

      if length(v_value) > (case when v_step.input_type = 'textarea' then 5000 else 500 end) then
        return jsonb_build_object('ok', false, 'error', 'too_long', 'step', v_step.key,
          'message', 'That answer is too long.');
      end if;
      if v_step.input_type = 'email' and v_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Enter a valid email address.');
      end if;
      if v_step.input_type = 'phone' and v_value !~ '^\+?[0-9 ()./-]{6,40}$' then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Enter a phone number with digits only, including the country code.');
      end if;
      if v_step.input_type in ('select', 'single_select')
         and not exists (select 1 from jsonb_array_elements(v_step.choices) c where c ->> 'value' = v_value) then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'Pick one of the options.');
      end if;
      if v_step.key = 'has_computer' and v_value = 'no' then
        return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
          'message', 'A phone cannot be used for this work. You need a laptop or desktop.');
      end if;
      if v_step.must_match is not null then
        v_other := v_row.answers -> v_step.must_match ->> 'value';
        if v_other is not null
           and regexp_replace(v_other, '[[:space:]-]', '', 'g') <> regexp_replace(v_value, '[[:space:]-]', '', 'g') then
          return jsonb_build_object('ok', false, 'error', 'mismatch', 'step', v_step.key,
            'message', 'These don''t match. Type it again carefully.');
        end if;
      end if;

      v_clear_schedule := v_step.key = 'weekly_hours'
        and coalesce(v_prev ->> 'value', '') is distinct from v_value;
      v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
        'value', v_value, 'answered_at', now());
    end if;

  elsif v_step.kind = 'acknowledgment' then
    if coalesce((v_input ->> 'confirmed')::boolean, false) is not true then
      update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
      return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
    end if;
    v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
      'confirmed_at', coalesce(v_prev -> 'confirmed_at', to_jsonb(now())));

  elsif v_step.kind = 'credential_handoff' then
    if coalesce(v_input ->> 'access', '') not in ('received', 'not_received') then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key);
    end if;
    v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
      'tools', to_jsonb(v_step.options), 'access', v_input ->> 'access', 'at', now());

  elsif v_step.kind = 'material_review' then
    if v_input ->> 'action' = 'opened' then
      v_answer := coalesce(v_prev, '{}'::jsonb)
        || jsonb_build_object('kind', v_step.kind, 'label', v_step.label, 'asset_id', v_step.asset_id,
             'opened_at', coalesce(v_prev -> 'opened_at', to_jsonb(now())));
    elsif v_input ->> 'action' = 'confirm' then
      if v_prev is null or not (v_prev ? 'opened_at') then
        return jsonb_build_object('ok', false, 'error', 'not_opened', 'step', v_step.key,
          'message', 'Open the material first, then confirm you reviewed it.');
      end if;
      v_answer := v_prev || jsonb_build_object('label', v_step.label,
        'confirmed_at', coalesce(v_prev -> 'confirmed_at', to_jsonb(now())));
    else
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key);
    end if;
  end if;

  update public.da_onboarding_submission
     set answers = jsonb_set(answers, array[v_step.key], v_answer, true)
   where id = v_row.id;

  if v_clear_schedule then
    update public.da_onboarding_submission
       set answers = answers - 'work_schedule'
     where id = v_row.id;
  end if;

  return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', v_answer);
end;
$$;

revoke all on function public.da_onboarding_save_step(text, text, jsonb, text) from public;
grant execute on function public.da_onboarding_save_step(text, text, jsonb, text) to anon, authenticated, service_role;

create or replace function public.da_onboarding_finish(p_token text, p_client text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.da_onboarding_submission%rowtype;
  v_agreement_status text;
  v_missing record;
  v_a text;
  v_b text;
  v_cred app.onboarding_credential%rowtype;
  v_check jsonb;
begin
  v_row := public.da_onboarding_resolve(p_token, p_client);
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_row from public.da_onboarding_submission where id = v_row.id for update;

  if v_row.status = 'completed' then
    perform app.provision_onboarded_operator(v_row.id);
    return jsonb_build_object('ok', true, 'completed_at', v_row.completed_at);
  end if;

  if v_row.agreement_id is not null then
    select status into v_agreement_status from public.da_agreement where id = v_row.agreement_id;
    if coalesce(v_agreement_status, '') <> 'completed' then
      return jsonb_build_object('ok', false, 'error', 'sign_first',
        'message', 'Sign your agreement first, then come back here.');
    end if;
  end if;

  select s.key, s.label into v_missing
    from public.da_onboarding_protocol_step s
   where s.protocol_key = v_row.protocol_key
     and s.required
     and public.da_onboarding_step_visible(s.show_when, v_row.answers)
     and not coalesce(public.da_onboarding_step_done(s.kind, v_row.answers -> s.key), false)
   order by s.sort_order, s.key
   limit 1;

  if found then
    return jsonb_build_object('ok', false, 'error', 'missing', 'step', v_missing.key,
      'message', 'This one still needs an answer.');
  end if;

  for v_missing in
    select s.key, s.must_match
      from public.da_onboarding_protocol_step s
     where s.protocol_key = v_row.protocol_key and s.must_match is not null
  loop
    v_a := regexp_replace(coalesce(v_row.answers -> v_missing.key ->> 'value', ''), '[[:space:]-]', '', 'g');
    v_b := regexp_replace(coalesce(v_row.answers -> v_missing.must_match ->> 'value', ''), '[[:space:]-]', '', 'g');
    if v_a <> v_b then
      return jsonb_build_object('ok', false, 'error', 'mismatch', 'step', v_missing.key,
        'message', 'These don''t match. Type it again carefully.');
    end if;
  end loop;

  select * into v_cred from app.onboarding_credential where submission_id = v_row.id;

  if exists (
    select 1 from public.da_onboarding_protocol_step s
     where s.protocol_key = v_row.protocol_key and s.key = 'da_password' and s.required
  ) then
    if v_cred is null
       or v_cred.password_hash is null
       or v_cred.login_email is null
       or lower(v_cred.login_email) is distinct from lower(coalesce(app.onboarding_answer(v_row.answers, 'da_login'), ''))
    then
      return jsonb_build_object('ok', false, 'error', 'missing', 'step', 'da_password',
        'message', 'Save your Divine Acquisition password before you finish.');
    end if;
  end if;

  if exists (
    select 1 from public.da_onboarding_protocol_step s
     where s.protocol_key = v_row.protocol_key
       and s.key = 'payout'
       and s.required
       and public.da_onboarding_step_visible(s.show_when, v_row.answers)
  ) then
    if v_cred is null
       or v_cred.payout_reference is null
       or v_cred.payout_method is distinct from app.onboarding_answer(v_row.answers, 'payout')
    then
      return jsonb_build_object('ok', false, 'error', 'missing', 'step', 'payout',
        'message', 'Save your payout details before you finish.');
    end if;
  end if;

  if app.onboarding_answer(v_row.answers, 'has_computer') = 'no' then
    return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', 'has_computer',
      'message', 'A phone cannot be used for this work. You need a laptop or desktop.');
  end if;

  if app.onboarding_answer(v_row.answers, 'work_schedule') is not null then
    v_check := app.check_onboarding_schedule(
      app.onboarding_answer(v_row.answers, 'weekly_hours'),
      app.onboarding_answer(v_row.answers, 'work_schedule')
    );
    if coalesce((v_check ->> 'ok')::boolean, false) is not true then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', 'work_schedule',
        'message', coalesce(v_check ->> 'message', 'Check the days and hours you can work.'));
    end if;
  end if;

  update public.da_onboarding_submission
     set status = 'completed',
         completed_at = coalesce(completed_at, now())
   where id = v_row.id
  returning * into v_row;

  perform app.provision_onboarded_operator(v_row.id);

  return jsonb_build_object('ok', true, 'completed_at', v_row.completed_at);
end;
$$;

comment on function public.da_onboarding_finish(text, text) is
  'Finishes onboarding once every required step is answered. An operator is enrolled in the Academy and given one profile case file. A password and payout destination are applied from the private credential row, not from Academy tables.';

revoke all on function public.da_onboarding_finish(text, text) from public;
grant execute on function public.da_onboarding_finish(text, text) to anon, authenticated, service_role;

create or replace function app.provision_onboarded_operator(p_submission_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_submission public.da_onboarding_submission%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_operator public.operator%rowtype;
  v_email text;
  v_name text;
  v_legal text;
  v_phone text;
  v_handle text;
  v_country text;
  v_zone text;
  v_shift text;
  v_shift_label text;
  v_contact_email text;
  v_profile uuid;
  v_user_id uuid;
  v_created_user boolean := false;
  v_case uuid;
  v_slug text;
  v_base text;
  v_suffix integer := 0;
  v_notes text;
  v_program uuid;
  v_channel text;
  v_definition text;
  v_cred app.onboarding_credential%rowtype;
  v_personal text;
  v_login text;
  v_account_email text;
  v_hash text;
  v_has_cred boolean := false;
  v_schedule text;
  v_weekly text;
  v_payout_last4 text;
  v_method_label text;
begin
  select * into v_submission from public.da_onboarding_submission where id = p_submission_id;
  if v_submission.id is null then
    return null;
  end if;

  select * into v_recipient from public.da_recipient where id = v_submission.recipient_id;
  if v_recipient.id is null or v_recipient.recipient_type <> 'operator' then
    return null;
  end if;

  select * into v_cred from app.onboarding_credential where submission_id = p_submission_id;
  v_personal := lower(btrim(v_recipient.email));
  if found then
    v_has_cred := true;
    v_login := nullif(lower(btrim(v_cred.login_email)), '');
    v_hash := v_cred.password_hash;
  end if;
  v_account_email := coalesce(v_login, v_personal);
  v_email := v_account_email;
  v_legal := app.onboarding_answer(v_submission.answers, 'legal_name');
  v_name := coalesce(
    app.onboarding_answer(v_submission.answers, 'preferred_name'),
    v_legal,
    nullif(btrim(v_recipient.full_name), '')
  );
  v_name := left(coalesce(v_name, 'Sales operator'), 200);
  v_phone := left(app.onboarding_answer(v_submission.answers, 'whatsapp'), 40);
  v_handle := nullif(ltrim(coalesce(app.onboarding_answer(v_submission.answers, 'discord'), ''), '@'), '');
  v_handle := left(v_handle, 80);
  v_country := left(app.onboarding_answer(v_submission.answers, 'city_country'), 120);
  v_zone := app.onboarding_answer(v_submission.answers, 'timezone');
  if v_zone is null or v_zone !~ '^[A-Za-z]+(?:/[A-Za-z0-9_+-]+)+$' then
    v_zone := null;
  end if;
  v_shift := app.onboarding_answer(v_submission.answers, 'shift');
  v_contact_email := app.onboarding_answer(v_submission.answers, 'email');
  if v_contact_email is null or position('@' in v_contact_email) < 2 then
    v_contact_email := v_recipient.email;
  end if;

  if v_recipient.operator_id is not null then
    select * into v_operator from public.operator where id = v_recipient.operator_id;
  end if;

  if v_operator.id is null then
    select * into v_operator
      from public.operator
     where lower(btrim(email)) in (v_account_email, v_personal)
     order by case when lower(btrim(email)) = v_account_email then 0 else 1 end, created_at
     limit 1;
  end if;

  if v_operator.profile_id is not null then
    v_profile := v_operator.profile_id;
  else
    select p.id into v_profile
      from public.profile p
     where lower(btrim(p.email)) in (v_account_email, v_personal)
     order by case when lower(btrim(p.email)) = v_account_email then 0 else 1 end, p.created_at
     limit 1;
  end if;

  if v_operator.id is null and v_profile is not null then
    select * into v_operator from public.operator where profile_id = v_profile;
  end if;

  if v_profile is null then
    if not exists (
      select 1 from public.account_invite i
       where lower(i.email) = v_email
         and i.accepted_at is null
         and i.cancelled_at is null
         and i.expires_at > now()
    ) then
      -- A live invite keeps handle_new_user from raising an uninvited-signup
      -- alert. The person was brought in by onboarding, not a public signup.
      insert into public.account_invite (email, full_name, role, scope_kind, token_hash, expires_at)
      values (
        v_email,
        v_name,
        'operator',
        'placements',
        encode(extensions.digest(extensions.gen_random_uuid()::text, 'sha256'), 'hex'),
        now() + interval '7 days'
      );
    end if;

    select u.id into v_user_id
      from auth.users u
     where lower(u.email::text) = v_email
     limit 1;

    if v_user_id is null then
      v_user_id := extensions.gen_random_uuid();
      -- profile.id references auth.users. Hosted auth has columns the local
      -- verify shim does not, so the insert follows whichever shape is present.
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'auth'
          and table_name = 'users'
          and column_name = 'aud'
      ) then
        insert into auth.users (
          id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values (
          v_user_id,
          (select u.instance_id from auth.users u limit 1),
          'authenticated',
          'authenticated',
          v_email,
          v_hash,
          now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', v_name),
          now(),
          now()
        );
      else
        insert into auth.users (
          id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) values (
          v_user_id,
          v_email,
          v_hash,
          now(),
          jsonb_build_object('full_name', v_name),
          '{"provider":"email","providers":["email"]}'::jsonb,
          now(),
          now()
        );
      end if;
      v_created_user := true;
    end if;

    select p.id into v_profile from public.profile p where p.id = v_user_id;
    if v_profile is null then
      insert into public.profile (id, email, full_name, role, state)
      values (v_user_id, v_email, v_name, 'operator', 'active')
      returning id into v_profile;
    end if;
  end if;

  if v_profile is null then
    raise exception 'operator_profile_missing: onboarding could not open an account for %', v_email
      using errcode = 'P0002';
  end if;

  if v_created_user then
    update public.account_invite
       set accepted_at = now(),
           accepted_profile_id = v_profile
     where lower(email) = v_email
       and accepted_at is null
       and cancelled_at is null;
  end if;

  -- A pending operator can sign in and reach the Academy. A suspended account
  -- stays suspended.
  update public.profile
     set state = 'active',
         full_name = coalesce(full_name, v_name)
   where id = v_profile
     and role = 'operator'
     and state = 'pending';

  if v_login is not null and v_hash is not null then
    if exists (
      select 1 from auth.users u
       where lower(u.email::text) = v_login
         and u.id <> v_profile
    ) then
      raise exception 'login_taken: that Divine Acquisition username is already taken'
        using errcode = '23505';
    end if;
    update auth.users
       set email = v_login,
           encrypted_password = v_hash,
           email_confirmed_at = coalesce(email_confirmed_at, now())
     where id = v_profile;
    update public.profile
       set email = v_login
     where id = v_profile
       and lower(btrim(email)) is distinct from v_login;
  end if;

  if v_zone is not null then
    update public.profile
       set time_zone = v_zone
     where id = v_profile
       and time_zone is null;
  end if;

  if v_operator.id is null then
    insert into public.operator (
      profile_id, name, email, phone, handle, country, time_zone, status, joined_on
    ) values (
      v_profile,
      v_name,
      v_email,
      v_phone,
      v_handle,
      v_country,
      coalesce(v_zone, 'UTC'),
      'in_training',
      current_date
    )
    returning * into v_operator;
  else
    update public.operator
       set name = v_name,
           email = case
             when v_login is not null
              and lower(btrim(email)) = v_personal
              and not exists (
                select 1 from public.operator other
                 where lower(btrim(other.email)) = v_login
                   and other.id <> v_operator.id
              ) then v_login
             else email
           end,
           phone = coalesce(v_phone, phone),
           handle = coalesce(v_handle, handle),
           country = coalesce(v_country, country),
           time_zone = coalesce(v_zone, time_zone),
           status = case when status = 'applicant' then 'in_training'::public.operator_status else status end,
           joined_on = coalesce(joined_on, current_date),
           profile_id = case
             when profile_id is not null then profile_id
             when not exists (
               select 1 from public.operator other
                where other.profile_id = v_profile
                  and other.id <> v_operator.id
             ) then v_profile
             else profile_id
           end
     where id = v_operator.id
    returning * into v_operator;
  end if;

  if v_recipient.operator_id is null
     and not exists (
       select 1 from public.da_recipient d
        where d.operator_id = v_operator.id
          and d.id <> v_recipient.id
     )
  then
    update public.da_recipient
       set operator_id = v_operator.id
     where id = v_recipient.id;
  end if;

  if v_phone is not null then
    update public.da_recipient
       set phone = v_phone
     where id = v_recipient.id
       and (phone is null or btrim(phone) = '');
  end if;

  if v_has_cred and v_cred.payout_reference is not null then
    v_payout_last4 := app.payout_last4(v_cred.payout_reference);
    v_method_label := case v_cred.payout_method
      when 'wise' then 'Wise'
      when 'remitly' then 'Remitly'
      else initcap(v_cred.payout_method)
    end;
    if v_operator.payout_reference is null then
      update public.operator
         set payout_method = v_cred.payout_method::public.payout_method,
             payout_reference = v_cred.payout_reference
       where id = v_operator.id
      returning * into v_operator;

      perform app.audit(
        'operator.payout_set', 'operator', v_operator.id::text,
        format('Set payout during onboarding to %s ending %s', v_method_label, v_payout_last4),
        null,
        jsonb_build_object('method', v_cred.payout_method, 'ending', v_payout_last4),
        null, v_profile);

      perform app.raise_owner_alert(
        'payout.method_set',
        format('%s set where their pay goes during onboarding. Details are with admins.', v_operator.name),
        null, v_profile, 'important');

      perform app.notify_staff(
        app.admin_recipient_ids(), 'payout.method_set', 'important',
        format('%s set a payout method during onboarding', v_operator.name),
        format('Now %s ending %s. Confirm it before the first payout.', v_method_label, v_payout_last4),
        v_operator.id);

      insert into public.operator_notification (operator_id, severity, title, body, sent_by)
      values (
        v_operator.id, 'important', 'Your payout method is on file',
        format('Your pay will go to %s ending %s. If this is not right, contact DA before your first payout.',
               v_method_label, v_payout_last4),
        'System'
      );
    end if;
  end if;

  select id into v_case
    from public.client_case_file
   where operator_id = v_operator.id
     and record_kind = 'operator';

  if v_case is null then
    v_slug := 'operator-' || trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
    if v_slug is null or v_slug = 'operator-' then
      v_slug := 'operator-' || substr(replace(v_operator.id::text, '-', ''), 1, 12);
    end if;
    v_base := v_slug;
    while exists (select 1 from public.client_case_file where slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base || '-' || v_suffix;
    end loop;

    if v_shift is not null then
      select c.label into v_shift_label
        from public.da_onboarding_protocol_step s
        cross join lateral jsonb_to_recordset(coalesce(s.choices, '[]'::jsonb)) as c(value text, label text)
       where s.protocol_key = v_submission.protocol_key
         and s.key = 'shift'
         and c.value = v_shift
       limit 1;
    end if;

    v_notes := 'Sales operator profile. Every end-of-day report this operator files, and the metrics they log, are kept on this case file.';
    if v_legal is not null and v_legal is distinct from v_name then
      v_notes := v_notes || E'\nLegal name: ' || v_legal;
    end if;
    if v_country is not null then
      v_notes := v_notes || E'\nCity and country: ' || v_country;
    end if;
    if coalesce(v_shift_label, v_shift) is not null then
      v_notes := v_notes || E'\nShift: ' || coalesce(v_shift_label, v_shift);
    end if;

    if v_login is not null then
      v_notes := v_notes || E'\nDivine Acquisition login: ' || v_login;
    end if;
    -- Method and last four only. The full payout reference stays on the operator.
    if v_payout_last4 is not null then
      v_notes := v_notes || E'\nPayout: ' || coalesce(v_method_label, 'Payout') || ', ending ' || v_payout_last4;
    end if;
    v_weekly := app.onboarding_choice_label(
      v_submission.protocol_key, 'weekly_hours', app.onboarding_answer(v_submission.answers, 'weekly_hours'));
    v_schedule := app.onboarding_schedule_text(app.onboarding_answer(v_submission.answers, 'work_schedule'));
    if coalesce(v_weekly, v_schedule) is not null then
      v_notes := v_notes || E'\nAvailability: ' || concat_ws('. ', v_weekly, v_schedule);
    end if;
    if app.onboarding_answer(v_submission.answers, 'time_off_30') is not null then
      v_notes := v_notes || E'\nTime off in the first 30 days: ' || app.onboarding_answer(v_submission.answers, 'time_off_30');
    end if;
    if app.onboarding_answer(v_submission.answers, 'has_computer') is not null then
      v_notes := v_notes || E'\nEquipment: laptop or desktop '
        || coalesce(app.onboarding_choice_label(v_submission.protocol_key, 'has_computer', app.onboarding_answer(v_submission.answers, 'has_computer')), '')
        || '; internet '
        || coalesce(app.onboarding_choice_label(v_submission.protocol_key, 'has_internet', app.onboarding_answer(v_submission.answers, 'has_internet')), '')
        || '; headset '
        || coalesce(app.onboarding_choice_label(v_submission.protocol_key, 'has_headset', app.onboarding_answer(v_submission.answers, 'has_headset')), '')
        || '; quiet workspace '
        || coalesce(app.onboarding_choice_label(v_submission.protocol_key, 'has_quiet_workspace', app.onboarding_answer(v_submission.answers, 'has_quiet_workspace')), '');
    end if;
    if v_submission.answers -> 'apploye_download' ? 'confirmed_at' then
      v_notes := v_notes || E'\nApploye: downloaded. Productivity, including inactivity, is tracked.';
    end if;
    if app.onboarding_answer(v_submission.answers, 'years_sales') is not null then
      v_notes := v_notes || E'\nExperience: '
        || coalesce(app.onboarding_choice_label(v_submission.protocol_key, 'years_sales', app.onboarding_answer(v_submission.answers, 'years_sales')), '')
        || '. Roles: ' || coalesce(app.onboarding_multi_label(v_submission.protocol_key, 'roles_held', app.onboarding_answer(v_submission.answers, 'roles_held')), '')
        || '. Industries: ' || coalesce(app.onboarding_multi_label(v_submission.protocol_key, 'industries_sold', app.onboarding_answer(v_submission.answers, 'industries_sold')), '')
        || '. Verticals: ' || coalesce(app.onboarding_multi_label(v_submission.protocol_key, 'verticals_interest', app.onboarding_answer(v_submission.answers, 'verticals_interest')), '');
    end if;

    v_channel := case
      when v_handle is not null then 'Discord'
      when v_phone is not null then 'WhatsApp'
      else null
    end;

    select t.suggested_qualified_booking into v_definition
      from public.industry_template t
     where t.key = 'generic';

    insert into public.client_case_file (
      name, slug, vertical, contact_name, contact_email, status, engagement_start,
      notes, industry_key, qualified_booking_definition, contact_role, contact_channel,
      record_kind, operator_id
    ) values (
      v_name,
      v_slug,
      'Sales operator',
      v_name,
      v_contact_email,
      'active',
      current_date,
      v_notes,
      'generic',
      v_definition,
      'Sales operator',
      v_channel,
      'operator',
      v_operator.id
    )
    returning id into v_case;
  end if;

  update public.da_onboarding_submission
     set case_file_id = v_case
   where id = v_submission.id
     and case_file_id is distinct from v_case;

  select id into v_program from public.academy_program where slug = 'da-operator-academy';
  if v_program is null then
    raise exception 'academy_missing: DA Operator Academy is not configured' using errcode = 'P0002';
  end if;

  insert into public.academy_enrollment (
    profile_id, program_id, operator_id, agreement_id, track, start_date, status
  ) values (
    v_profile,
    v_program,
    v_operator.id,
    v_submission.agreement_id,
    'Core',
    current_date,
    'active'
  )
  on conflict (profile_id, program_id) do update
    set status = 'active',
        operator_id = coalesce(public.academy_enrollment.operator_id, excluded.operator_id),
        agreement_id = coalesce(public.academy_enrollment.agreement_id, excluded.agreement_id),
        start_date = coalesce(public.academy_enrollment.start_date, excluded.start_date)
  where public.academy_enrollment.status = 'invited';

  return v_case;
end;
$$;

comment on function app.provision_onboarded_operator(uuid) is
  'After operator onboarding is finished: one profile case file, Academy enrollment, and the Divine Acquisition login when they created one. Payout details are copied onto the operator payout record only. They are not written to Academy tables or the case file.';

revoke all on function app.provision_onboarded_operator(uuid) from public, anon, authenticated;


create or replace function public.portal_change_payout(p_method text, p_reference text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_audit bigint;
  v_ref text := btrim(coalesce(p_reference, ''));
begin
  perform app.require('portal.payout.change');
  v_op := app.portal_operator();

  if coalesce(p_method, '') not in ('wise', 'payoneer', 'bank_transfer', 'paypal', 'crypto_usdc', 'remitly') then
    raise exception 'method_invalid: pick a payout method' using errcode = '23514';
  end if;
  if length(v_ref) not between 4 and 200 then
    raise exception 'reference_required: add the account, email or wallet the money goes to' using errcode = '23514';
  end if;

  perform app.require_step_up('change your payout method');

  update public.operator
     set payout_method = p_method::public.payout_method, payout_reference = v_ref
   where id = v_op.id;

  v_audit := app.audit('operator.payout_changed', 'operator', v_op.id::text,
    format('Changed their payout method to %s ending %s', replace(p_method, '_', ' '), right(v_ref, 4)),
    jsonb_build_object('method', v_op.payout_method,
                       'ending', case when v_op.payout_reference is not null then right(v_op.payout_reference, 4) end),
    jsonb_build_object('method', p_method, 'ending', right(v_ref, 4)),
    null, v_op.profile_id);

  -- The alert feed is shared with managers: it says that it changed, not to what.
  perform app.raise_owner_alert('payout.method_changed',
    format('%s changed where their pay goes. Details are with admins.', v_op.name),
    v_audit, v_op.profile_id, 'urgent');

  perform app.notify_staff(app.admin_recipient_ids(), 'payout.method_changed', 'urgent',
    format('%s changed their payout method', v_op.name),
    format('Now %s ending %s. Confirm it with them before the next payout.', replace(p_method, '_', ' '), right(v_ref, 4)),
    v_op.id);

  insert into public.operator_notification (operator_id, severity, title, body, sent_by)
  values (v_op.id, 'important', 'Your payout method changed',
          format('Your pay will now go to %s ending %s. If you did not make this change, contact DA immediately.',
                 replace(p_method, '_', ' '), right(v_ref, 4)),
          'System');

  return jsonb_build_object('ok', true, 'last4', right(v_ref, 4));
end;
$$;

