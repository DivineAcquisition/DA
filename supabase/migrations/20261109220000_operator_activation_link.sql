-- An operator activation link is the account invite. Starting onboarding
-- issues one whenever the person has not signed in, including when a profile
-- already exists. A linked profile is not a sign-in.

create or replace function app.issue_operator_activation(p_email text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'required: a work email' using errcode = '23514';
  end if;

  update public.account_invite
     set token_hash = app.hash_token(v_token),
         expires_at = now() + interval '7 days',
         full_name = coalesce(v_name, full_name),
         last_sent_at = now()
   where lower(email) = v_email
     and accepted_at is null
     and cancelled_at is null;
  if not found then
    insert into public.account_invite (
      email, full_name, role, scope_kind, token_hash, invited_by, expires_at
    ) values (
      v_email, v_name, 'operator', 'clients', app.hash_token(v_token), auth.uid(), now() + interval '7 days'
    );
  end if;
  return v_token;
end;
$$;

revoke all on function app.issue_operator_activation(text, text) from public, anon, authenticated;

create or replace function public.hire_issue_activation(p_operator uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_name text;
  v_profile uuid;
  v_signed boolean;
  v_token text;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin sends an activation link' using errcode = '42501';
  end if;

  select lower(email), name, profile_id
    into v_email, v_name, v_profile
  from public.operator
  where id = p_operator;
  if v_email is null then
    raise exception 'operator_not_found' using errcode = 'P0002';
  end if;

  v_signed := exists (
    select 1 from auth.users u
    where u.id = v_profile and u.last_sign_in_at is not null
  );
  if not coalesce(p_force, false) and v_signed then
    return jsonb_build_object('token', null, 'email', v_email, 'name', v_name, 'skipped', 'signed_in');
  end if;
  if not coalesce(p_force, false) and exists (
    select 1 from public.account_invite i
    where lower(i.email) = v_email
      and i.accepted_at is null
      and i.cancelled_at is null
      and i.expires_at > now()
  ) then
    return jsonb_build_object('token', null, 'email', v_email, 'name', v_name, 'skipped', 'live_invite');
  end if;

  v_token := app.issue_operator_activation(v_email, v_name);
  perform app.hire_audit('hire.activation_link', p_operator, format('Activation link issued for %s', v_email),
    jsonb_build_object('email', v_email));
  return jsonb_build_object('token', v_token, 'email', v_email, 'name', v_name, 'skipped', null);
end;
$$;

revoke all on function public.hire_issue_activation(uuid, boolean) from public, anon;
grant execute on function public.hire_issue_activation(uuid, boolean) to authenticated;

create or replace function public.hire_create(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p ->> 'work_email', '')));
  v_first text := btrim(coalesce(p ->> 'first_name', ''));
  v_last text := btrim(coalesce(p ->> 'last_name', ''));
  v_role text := coalesce(p ->> 'role_kind', 'sales_operator');
  v_op uuid;
  v_profile uuid;
  v_program uuid;
  v_app uuid := nullif(p ->> 'application_id', '')::uuid;
  v_token text;
  v_name text;
  v_signed boolean;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin adds an operator' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_first = '' or v_last = '' then
    raise exception 'required: first name, last name, and a work email' using errcode = '23514';
  end if;
  if v_role not in ('va', 'sales_operator') then
    raise exception 'invalid_role: choose VA or Sales Operator' using errcode = '23514';
  end if;

  select id into v_op from public.operator where lower(email) = v_email;
  if v_app is not null and v_op is null then
    select converted_operator_id into v_op from public.role_application where id = v_app;
  end if;
  select id into v_profile from public.profile where lower(email) = v_email order by created_at limit 1;
  if v_op is null and v_profile is not null then
    select id into v_op from public.operator where profile_id = v_profile;
  end if;

  v_signed := v_profile is not null and exists (
    select 1 from auth.users u where u.id = v_profile and u.last_sign_in_at is not null
  );

  if v_op is not null then
    select name into v_name from public.operator where id = v_op;
    if not v_signed then
      v_token := app.issue_operator_activation(v_email, coalesce(v_name, v_first || ' ' || v_last));
    end if;
    return jsonb_build_object(
      'operator_id', v_op, 'created', false, 'existing', true, 'token', v_token,
      'email', v_email, 'name', v_name, 'has_account', v_profile is not null
    );
  end if;

  select id into v_program
  from public.academy_program
  where id = nullif(p ->> 'program_id', '')::uuid
     or (nullif(p ->> 'program_id', '') is null and slug = 'da-operator-academy')
  limit 1;

  v_name := v_first || ' ' || v_last;
  insert into public.operator (profile_id, name, email, phone, status, role_application_id, joined_on)
  values (v_profile, v_name, v_email, nullif(btrim(coalesce(p ->> 'phone', '')), ''), 'applicant', v_app, current_date)
  returning id into v_op;

  if v_app is not null then
    update public.role_application
       set converted_operator_id = v_op
     where id = v_app and converted_operator_id is null;
    update public.role_application
       set status = 'advanced'
     where id = v_app and status is distinct from 'advanced';
  end if;

  insert into public.operator_journey (
    operator_id, stage, role_kind, work_email, personal_email, first_name, last_name,
    manager_profile_id, application_id, program_id, note, created_by, signed_in_at
  ) values (
    v_op, 'invited', v_role, v_email, nullif(btrim(coalesce(p ->> 'personal_email', '')), ''),
    v_first, v_last, nullif(p ->> 'manager_id', '')::uuid, v_app, v_program,
    nullif(btrim(coalesce(p ->> 'note', '')), ''), auth.uid(),
    (select u.last_sign_in_at from auth.users u where u.id = v_profile)
  );
  insert into public.operator_onboarding (operator_id, answers)
  select v_op, case when a.id is null then '{}'::jsonb else jsonb_strip_nulls(jsonb_build_object(
    'legal_name', a.full_name,
    'preferred_name', split_part(a.full_name, ' ', 1),
    'mobile', a.phone,
    'why', a.why_you,
    'industries', a.experience
  )) end
  from (select 1) seed
  left join public.role_application a on a.id = v_app;

  if v_profile is not null and v_program is not null then
    insert into public.academy_enrollment (profile_id, program_id, operator_id, role_application_id, track, start_date, manager_id, status)
    values (v_profile, v_program, v_op, v_app, 'Core', current_date, nullif(p ->> 'manager_id', '')::uuid, 'active')
    on conflict (profile_id, program_id) do update
      set operator_id = coalesce(public.academy_enrollment.operator_id, excluded.operator_id);
  end if;

  if not v_signed then
    v_token := app.issue_operator_activation(v_email, v_name);
  end if;

  if coalesce(p ->> 'grant_override', '') = 'true' then
    if length(btrim(coalesce(p ->> 'override_reason', ''))) < 3 then
      raise exception 'reason_required: an override needs a reason' using errcode = '23514';
    end if;
    perform public.hire_grant_override(v_op, p ->> 'override_reason', current_date,
      coalesce(nullif(p ->> 'override_days', '')::integer, 30), false);
  end if;

  perform app.hire_audit('hire.created', v_op, format('Added %s and sent the activation link', v_name),
    jsonb_build_object('role', v_role, 'email', v_email));
  perform app.hire_refresh(v_op, 'Added by DA Admin');
  return jsonb_build_object(
    'operator_id', v_op, 'created', true, 'existing', false, 'token', v_token,
    'email', v_email, 'name', v_name, 'has_account', v_profile is not null
  );
end;
$$;

-- A profile row is not a sign-in. Clear stamps that were written because the
-- account already existed, when that person has never signed in.
update public.operator_journey j
   set signed_in_at = null, updated_at = now()
  from public.operator o
  left join auth.users u on u.id = o.profile_id
 where j.operator_id = o.id
   and j.signed_in_at is not null
   and u.last_sign_in_at is null;
