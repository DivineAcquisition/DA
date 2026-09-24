-- Advancing a role application creates the operator row it is hiring.
--
-- application_status has no "hired" value and does not gain one.
-- 'advanced' already means the person moved forward, and operator_status
-- already starts at 'applicant'. That is the whole mapping.
--
-- Style matches the other row triggers in this schema: a BEFORE UPDATE
-- function in the private app schema, so NEW.converted_operator_id can be
-- set in the same statement. The function is security definer because
-- profile.id references auth.users and the reviewer is not allowed to
-- write auth.users directly. search_path is empty, same as the other
-- definer functions.

alter table public.operator
  add column if not exists role_application_id uuid references public.role_application (id);

alter table public.role_application
  add column if not exists converted_operator_id uuid references public.operator (id);

comment on column public.operator.role_application_id is
  'The application this roster row was created from. Null for operators who predate the hiring conversion.';

comment on column public.role_application.converted_operator_id is
  'Set when status becomes advanced. Stays null for rejected and withdrawn applications.';

-- One application converts once. id is already unique; the predicate is what
-- the partial index is for, and it rejects a second write that tries to
-- record a conversion on a row that already has one only if a duplicate id
-- were possible. The operator-side index below is the one that stops two
-- operator rows from the same application.
create unique index if not exists role_application_single_conversion
  on public.role_application (id)
  where converted_operator_id is not null;

create unique index if not exists operator_role_application_once
  on public.operator (role_application_id)
  where role_application_id is not null;

create or replace function app.handle_application_advanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_user_id uuid;
  v_operator_id uuid;
  v_email text := lower(btrim(new.email));
begin
  -- The WHEN clause already requires this. Checked again so a second
  -- execution in the same statement cannot insert a second operator.
  if new.converted_operator_id is not null then
    return new;
  end if;

  select p.id into v_profile_id
  from public.profile p
  where lower(p.email) = v_email
  order by p.created_at
  limit 1;

  if v_profile_id is null then
    select u.id into v_user_id
    from auth.users u
    where lower(u.email::text) = v_email
    limit 1;

    if v_user_id is null then
      v_user_id := extensions.gen_random_uuid();

      -- profile.id references auth.users. The hosted auth table has columns
      -- the local verify shim does not, so the insert follows whichever
      -- shape is present. handle_new_user then inserts the profile as
      -- operator / pending unless an outstanding invite already named a role.
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'auth'
          and table_name = 'users'
          and column_name = 'aud'
      ) then
        insert into auth.users (
          id, instance_id, aud, role, email,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values (
          v_user_id,
          (select u.instance_id from auth.users u limit 1),
          'authenticated',
          'authenticated',
          v_email,
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', new.full_name),
          now(),
          now()
        );
      else
        insert into auth.users (
          id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) values (
          v_user_id,
          v_email,
          jsonb_build_object('full_name', new.full_name),
          '{"provider":"email","providers":["email"]}'::jsonb,
          now(),
          now()
        );
      end if;
    end if;

    select p.id into v_profile_id
    from public.profile p
    where p.id = v_user_id;

    if v_profile_id is null then
      insert into public.profile (id, email, full_name, role, state)
      values (v_user_id, v_email, new.full_name, 'operator', 'pending')
      returning id into v_profile_id;
    end if;
  end if;

  -- An existing profile is reused as-is. Role and state are not written.

  -- tier, base_monthly, tax_doc_status, time_zone, and preferred_channel are
  -- not null and already have defaults. They are omitted so the application
  -- does not invent them. country and payout_method are nullable and stay null.
  insert into public.operator (
    profile_id, name, email, phone, status, role_application_id, joined_on
  ) values (
    v_profile_id, new.full_name, new.email, new.phone, 'applicant', new.id, current_date
  )
  returning id into v_operator_id;

  new.converted_operator_id := v_operator_id;
  return new;
end;
$$;

comment on function app.handle_application_advanced() is
  'When a role application moves to advanced, create one applicant operator and link the two rows. A later save of the same status does not convert again.';

revoke all on function app.handle_application_advanced() from public, anon, authenticated;

drop trigger if exists role_application_advance on public.role_application;

create trigger role_application_advance
  before update on public.role_application
  for each row
  when (
    old.status is distinct from new.status
    and new.status = 'advanced'
    and new.converted_operator_id is null
  )
  execute function app.handle_application_advanced();
