-- Hire journey, onboarding answers, certification override, readiness waivers,
-- per-placement GHL readiness, and off-boarding checklist.
-- Existing operator.status rows are not rewritten. A journey exists only for
-- operators added through this flow (or off-boarded through it).

create table public.operator_journey (
  operator_id uuid primary key references public.operator (id) on delete cascade,
  stage text not null check (stage in ('invited', 'onboarding', 'ready', 'placed', 'paused', 'offboarded')),
  stage_reason text,
  role_kind text not null check (role_kind in ('va', 'sales_operator')),
  work_email text not null,
  personal_email text,
  first_name text not null,
  last_name text not null,
  manager_profile_id uuid references public.profile (id),
  application_id uuid references public.role_application (id),
  program_id uuid references public.academy_program (id),
  note text,
  invited_at timestamptz not null default now(),
  signed_in_at timestamptz,
  onboarding_completed_at timestamptz,
  ready_emailed_at timestamptz,
  paused_at timestamptz,
  offboarded_at timestamptz,
  last_day date,
  offboard_reason text,
  reminder_count integer not null default 0,
  last_reminder_at timestamptz,
  manager_alerted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.operator_journey is
  'Hire stage for operators added through Add operator. Existing roster rows have no journey, so their portal stage stays as it was.';

create table public.operator_onboarding (
  operator_id uuid primary key references public.operator (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  setup_flags text[] not null default '{}',
  setup_cleared_at timestamptz,
  setup_cleared_by uuid,
  submitted_at timestamptz,
  ack_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.operator_onboarding is
  'Onboarding answers. Payout details are not stored here. They stay on the payout record.';

create table public.certification_override (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  reason text not null,
  starts_on date not null,
  expires_on date not null,
  status text not null check (status in ('active', 'closed', 'revoked', 'expired')),
  closed_reason text,
  exception_confirmed boolean not null default false,
  granted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on > starts_on)
);

comment on table public.certification_override is
  'Temporary workspace access. It is not a certification and is not read by app.so_certification_level.';

create index certification_override_open_idx
  on public.certification_override (operator_id, expires_on)
  where status = 'active';

create table public.readiness_waiver (
  operator_id uuid not null references public.operator (id) on delete cascade,
  item text not null check (item in ('account', 'onboarding', 'agreement', 'payout', 'academy', 'setup', 'manager')),
  reason text not null,
  waived_by uuid,
  waived_at timestamptz not null default now(),
  primary key (operator_id, item)
);

comment on table public.readiness_waiver is
  'A waived readiness item. Shown as Waived with the reason. Never counted as met.';

create table public.placement_ghl_readiness (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete cascade,
  client_case_file_id uuid references public.client_case_file (id) on delete cascade,
  ghl_user_exists boolean,
  mapped boolean,
  phone_assigned text check (phone_assigned in ('yes', 'no', 'not_needed')),
  confirmed_on date,
  operator_confirmed_at timestamptz,
  unique (operator_id, client_case_file_id)
);

comment on table public.placement_ghl_readiness is
  'GHL readiness for one operator in one client sub-account. Prompt 3 activates placements against operator_confirmed_at.';

create table public.operator_offboard_item (
  operator_id uuid not null references public.operator (id) on delete cascade,
  item_key text not null,
  label text not null,
  done_at timestamptz,
  done_by uuid,
  primary key (operator_id, item_key)
);

alter table public.operator_journey enable row level security;
alter table public.operator_onboarding enable row level security;
alter table public.certification_override enable row level security;
alter table public.readiness_waiver enable row level security;
alter table public.placement_ghl_readiness enable row level security;
alter table public.operator_offboard_item enable row level security;

revoke all on public.operator_journey from anon, authenticated;
revoke all on public.operator_onboarding from anon, authenticated;
revoke all on public.certification_override from anon, authenticated;
revoke all on public.readiness_waiver from anon, authenticated;
revoke all on public.placement_ghl_readiness from anon, authenticated;
revoke all on public.operator_offboard_item from anon, authenticated;

grant select, insert, update, delete on public.operator_journey to service_role;
grant select, insert, update, delete on public.operator_onboarding to service_role;
grant select, insert, update, delete on public.certification_override to service_role;
grant select, insert, update, delete on public.readiness_waiver to service_role;
grant select, insert, update, delete on public.placement_ghl_readiness to service_role;
grant select, insert, update, delete on public.operator_offboard_item to service_role;

-- Helpers --------------------------------------------------------------------

create or replace function app.hire_audit(
  p_action text,
  p_operator uuid,
  p_summary text,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  select profile_id into v_profile from public.operator where id = p_operator;
  if auth.uid() is not null then
    perform app.audit(p_action, 'operator', p_operator::text, p_summary, null, p_after, null, v_profile);
  else
    insert into public.audit_event (action, entity_type, entity_id, summary, after_value, acting_as_profile_id, actor_email)
    values (p_action, 'operator', p_operator::text, p_summary, p_after, v_profile, 'system');
  end if;
end;
$$;

create or replace function app.cert_override_access(p_operator uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.certification_override o
    where o.operator_id = p_operator
      and o.status in ('active', 'expired')
      and o.starts_on <= current_date
      and o.expires_on + coalesce((select s.cert_grace_days from public.team_setting s where s.id = 1), 0) >= current_date
      and o.status <> 'revoked'
      and o.status <> 'closed'
  );
$$;

comment on function app.cert_override_access(uuid) is
  'Workspace access only. app.so_certification_level does not call this.';

create or replace function app.hire_payout_complete(p_operator uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.operator o
    where o.id = p_operator
      and o.payout_method is not null
      and nullif(btrim(coalesce(o.payout_reference, '')), '') is not null
  );
$$;

create or replace function app.hire_agreement_signed(p_operator uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.da_agreement a
    join public.da_recipient r on r.id = a.recipient_id
    where r.operator_id = p_operator
      and a.status = 'completed'
  );
$$;

create or replace function app.hire_readiness(p_operator uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_j public.operator_journey;
  v_on public.operator_onboarding;
  v_signed boolean;
  v_level smallint;
  v_override boolean;
  v_manager boolean;
  v_waiver text[];
  v_items jsonb := '[]'::jsonb;
  v_item text;
  v_state text;
  v_detail text;
  v_met boolean;
begin
  select * into v_op from public.operator where id = p_operator;
  if v_op.id is null then
    return '[]'::jsonb;
  end if;
  select * into v_j from public.operator_journey where operator_id = p_operator;
  select * into v_on from public.operator_onboarding where operator_id = p_operator;
  select coalesce(array_agg(item), '{}') into v_waiver from public.readiness_waiver where operator_id = p_operator;
  v_signed := v_j.signed_in_at is not null
    or exists (select 1 from public.login_event l where l.profile_id = v_op.profile_id and l.outcome = 'success');
  v_level := case when v_op.profile_id is null then null else app.so_certification_level(v_op.profile_id) end;
  v_override := app.cert_override_access(p_operator);
  v_manager := v_j.manager_profile_id is not null
    or exists (
      select 1 from public.placement pl
      where pl.operator_id = p_operator and pl.manager_profile_id is not null and pl.status in ('draft', 'active', 'paused')
    );

  for v_item, v_met, v_detail in
    select * from (values
      ('account', v_op.profile_id is not null and v_signed and case when v_op.profile_id is null then false else app.effective_state(v_op.profile_id) = 'active' end,
        case when v_signed then 'Signed in' else 'Has not signed in' end),
      ('onboarding', v_on.submitted_at is not null or v_j.onboarding_completed_at is not null,
        case when v_on.submitted_at is not null then 'Form submitted' else 'Form not submitted' end),
      ('agreement', app.hire_agreement_signed(p_operator),
        case when app.hire_agreement_signed(p_operator) then 'Signed' else 'Not signed' end),
      ('payout', app.hire_payout_complete(p_operator),
        case when app.hire_payout_complete(p_operator) then 'Yes' else 'No' end),
      ('academy', coalesce(v_level, 0) >= 1 or v_override,
        case
          when coalesce(v_level, 0) >= 1 then 'Level 1 certified'
          when v_override then 'Override active'
          else 'Not certified'
        end),
      ('setup', v_on.operator_id is not null and (
          coalesce(array_length(v_on.setup_flags, 1), 0) = 0 or v_on.setup_cleared_at is not null
        ) and v_on.submitted_at is not null,
        case
          when v_on.setup_cleared_at is not null then 'Flagged items cleared'
          when coalesce(array_length(v_on.setup_flags, 1), 0) > 0 then 'Flagged for the manager'
          when v_on.submitted_at is not null then 'Passed'
          else 'Not submitted'
        end),
      ('manager', v_manager, case when v_manager then 'Assigned' else 'Not assigned' end)
    ) as row(item, met, detail)
  loop
    v_state := case
      when v_item = any (v_waiver) then 'waived'
      when v_item = 'setup' and coalesce(array_length(v_on.setup_flags, 1), 0) > 0 and v_on.setup_cleared_at is null and v_on.submitted_at is not null then 'flagged'
      when v_met then 'met'
      else 'missing'
    end;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'key', v_item,
      'state', v_state,
      'detail', case when v_state = 'waived' then (select reason from public.readiness_waiver w where w.operator_id = p_operator and w.item = v_item) else v_detail end
    ));
  end loop;
  return v_items;
end;
$$;

create or replace function app.hire_ready(p_operator uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_and(item ->> 'state' in ('met', 'waived')), false)
    and count(*) = 7
  from jsonb_array_elements(app.hire_readiness(p_operator)) item;
$$;

create or replace function app.hire_refresh(p_operator uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j public.operator_journey;
  v_next text;
  v_place text := 'none';
begin
  select * into v_j from public.operator_journey where operator_id = p_operator for update;
  if v_j.operator_id is null then
    return null;
  end if;
  if exists (
    select 1 from public.placement pl
    where pl.operator_id = p_operator and pl.placement_type is not null and pl.status = 'active'
  ) then
    v_place := 'active';
  elsif exists (
    select 1 from public.placement pl
    where pl.operator_id = p_operator and pl.placement_type is not null and pl.status = 'paused'
  ) then
    v_place := 'paused';
  end if;

  v_next := case
    when v_j.stage = 'offboarded' or v_j.offboarded_at is not null then 'offboarded'
    when v_place = 'paused' or v_j.paused_at is not null and v_place <> 'active' then 'paused'
    when v_place = 'active' then 'placed'
    when app.hire_ready(p_operator) then 'ready'
    when v_j.signed_in_at is not null then 'onboarding'
    else 'invited'
  end;

  if v_next is distinct from v_j.stage then
    update public.operator_journey
       set stage = v_next,
           stage_reason = p_reason,
           ready_at = case when v_next = 'ready' then coalesce(ready_at, now()) else ready_at end,
           updated_at = now()
     where operator_id = p_operator;
    update public.operator
       set status = case v_next
         when 'ready' then 'on_bench'::public.operator_status
         when 'placed' then 'placed'::public.operator_status
         when 'offboarded' then case
           when v_j.last_day is not null and v_j.last_day < current_date then 'inactive'::public.operator_status
           else status
         end
         else status
       end
     where id = p_operator
       and status is distinct from case v_next
         when 'ready' then 'on_bench'::public.operator_status
         when 'placed' then 'placed'::public.operator_status
         when 'offboarded' then case
           when v_j.last_day is not null and v_j.last_day < current_date then 'inactive'::public.operator_status
           else status
         end
         else status
       end;
    perform app.hire_audit('operator.stage.' || v_next, p_operator,
      format('Stage is now %s. %s', v_next, coalesce(p_reason, '')),
      jsonb_build_object('from', v_j.stage, 'to', v_next));
  end if;

  if v_j.last_day is not null and v_j.last_day < current_date and v_j.offboarded_at is not null then
    update public.operator set status = 'inactive' where id = p_operator and status is distinct from 'inactive';
  end if;
  return v_next;
end;
$$;

-- Profile link: the invite creates the profile later. Enroll then. -----------

create or replace function app.hire_link_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op uuid;
  v_program uuid;
begin
  select o.id into v_op
  from public.operator o
  where o.profile_id is null and lower(o.email) = lower(new.email)
  order by o.created_at desc
  limit 1;
  if v_op is null then
    return new;
  end if;
  update public.operator set profile_id = new.id where id = v_op and profile_id is null;
  update public.operator_journey
     set signed_in_at = coalesce(signed_in_at, now()), updated_at = now()
   where operator_id = v_op;
  select program_id into v_program from public.operator_journey where operator_id = v_op;
  if v_program is not null then
    insert into public.academy_enrollment (profile_id, program_id, operator_id, track, start_date, status)
    values (new.id, v_program, v_op, 'Core', current_date, 'active')
    on conflict (profile_id, program_id) do update
      set operator_id = coalesce(public.academy_enrollment.operator_id, excluded.operator_id),
          status = case when public.academy_enrollment.status = 'withdrawn' then public.academy_enrollment.status else 'active' end;
  end if;
  perform app.hire_refresh(v_op, 'Signed in for the first time');
  return new;
end;
$$;

drop trigger if exists profile_hire_link on public.profile;
create trigger profile_hire_link
  after insert on public.profile
  for each row execute function app.hire_link_profile();

-- Add operator ----------------------------------------------------------------

create or replace function public.hire_grant_override(p_operator uuid, p_reason text, p_start date, p_days integer, p_exception boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return null;
end;
$$;

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
  if v_op is not null then
    return jsonb_build_object('operator_id', v_op, 'created', false, 'existing', true, 'token', null, 'email', v_email,
      'name', (select name from public.operator where id = v_op));
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
    case when v_profile is not null then now() else null end
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

  if v_profile is null then
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    update public.account_invite
       set token_hash = app.hash_token(v_token),
           expires_at = now() + interval '7 days',
           full_name = v_name,
           last_sent_at = now()
     where lower(email) = v_email and accepted_at is null and cancelled_at is null;
    if not found then
      insert into public.account_invite (
        email, full_name, role, scope_kind, token_hash, invited_by, expires_at
      ) values (
        v_email, v_name, 'operator', 'clients', app.hash_token(v_token), auth.uid(), now() + interval '7 days'
      );
    end if;
  end if;

  if coalesce(p ->> 'grant_override', '') = 'true' then
    if length(btrim(coalesce(p ->> 'override_reason', ''))) < 3 then
      raise exception 'reason_required: an override needs a reason' using errcode = '23514';
    end if;
    perform public.hire_grant_override(v_op, p ->> 'override_reason', current_date,
      coalesce(nullif(p ->> 'override_days', '')::integer, 30), false);
  end if;

  perform app.hire_audit('hire.created', v_op, format('Added %s and sent the invite', v_name),
    jsonb_build_object('role', v_role, 'email', v_email));
  perform app.hire_refresh(v_op, 'Added by DA Admin');
  return jsonb_build_object(
    'operator_id', v_op, 'created', true, 'existing', false, 'token', v_token,
    'email', v_email, 'name', v_name, 'has_account', v_profile is not null
  );
end;
$$;

-- The grant function is created below. hire_create calls it, so it must exist
-- before a row is added. Declared here as a forward wrapper after the body.

create or replace function public.hire_grant_override(
  p_operator uuid,
  p_reason text,
  p_start date,
  p_days integer,
  p_exception boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_end date;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin grants an override' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: write why this override is needed' using errcode = '23514';
  end if;
  v_end := p_start + coalesce(p_days, 30);
  if (v_end - p_start) > 60 and not coalesce(p_exception, false) then
    raise exception 'too_long: an override is 60 days unless you confirm an exception' using errcode = '23514';
  end if;
  if (v_end - p_start) > 365 then
    raise exception 'too_long: an exception cannot run longer than a year' using errcode = '23514';
  end if;
  insert into public.certification_override (operator_id, reason, starts_on, expires_on, status, exception_confirmed, granted_by)
  values (p_operator, btrim(p_reason), p_start, v_end, 'active', coalesce(p_exception, false), auth.uid())
  returning id into v_id;
  perform app.hire_audit('operator.override.granted', p_operator,
    format('Certification override through %s. %s', v_end, btrim(p_reason)),
    jsonb_build_object('override_id', v_id, 'expires_on', v_end));
  perform app.hire_refresh(p_operator, 'Override granted');
  return v_id;
end;
$$;

create or replace function public.hire_extend_override(p_id uuid, p_expires date, p_reason text, p_exception boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.certification_override;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin extends an override' using errcode = '42501';
  end if;
  select * into v from public.certification_override where id = p_id and status = 'active';
  if v.id is null then
    raise exception 'not_found: that override is not active' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: write why you are extending it' using errcode = '23514';
  end if;
  if (p_expires - v.starts_on) > 60 and not coalesce(p_exception, false) then
    raise exception 'too_long: an override is 60 days unless you confirm an exception' using errcode = '23514';
  end if;
  update public.certification_override
     set expires_on = p_expires, exception_confirmed = coalesce(p_exception, exception_confirmed), updated_at = now()
   where id = p_id;
  perform app.hire_audit('operator.override.extended', v.operator_id,
    format('Override now runs through %s. %s', p_expires, btrim(p_reason)),
    jsonb_build_object('override_id', p_id, 'expires_on', p_expires));
end;
$$;

create or replace function public.hire_revoke_override(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.certification_override;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin revokes an override' using errcode = '42501';
  end if;
  select * into v from public.certification_override where id = p_id and status = 'active';
  if v.id is null then
    raise exception 'not_found: that override is not active' using errcode = 'P0002';
  end if;
  update public.certification_override
     set status = 'revoked', closed_reason = btrim(p_reason), updated_at = now()
   where id = p_id;
  perform app.hire_audit('operator.override.revoked', v.operator_id,
    format('Override revoked. %s', btrim(p_reason)), jsonb_build_object('override_id', p_id));
  perform app.hire_refresh(v.operator_id, 'Override revoked');
end;
$$;

create or replace function public.hire_waive(p_operator uuid, p_item text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin waives a readiness item' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: write why this item is waived' using errcode = '23514';
  end if;
  insert into public.readiness_waiver (operator_id, item, reason, waived_by)
  values (p_operator, p_item, btrim(p_reason), auth.uid())
  on conflict (operator_id, item) do update
    set reason = excluded.reason, waived_by = excluded.waived_by, waived_at = now();
  perform app.hire_audit('operator.readiness.waived', p_operator,
    format('Waived %s. %s', p_item, btrim(p_reason)), jsonb_build_object('item', p_item));
  perform app.hire_refresh(p_operator, 'Readiness item waived');
end;
$$;

create or replace function public.hire_clear_setup(p_operator uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'admin_required: a manager clears flagged setup items' using errcode = '42501';
  end if;
  update public.operator_onboarding
     set setup_cleared_at = now(), setup_cleared_by = auth.uid(), updated_at = now()
   where operator_id = p_operator;
  perform app.hire_audit('operator.readiness.setup_cleared', p_operator, 'Cleared flagged setup items', null);
  perform app.hire_refresh(p_operator, 'Setup flags cleared');
end;
$$;

create or replace function public.hire_set_stage(p_operator uuid, p_stage text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin sets a stage' using errcode = '42501';
  end if;
  if p_stage not in ('invited', 'onboarding', 'ready', 'placed', 'paused', 'offboarded') then
    raise exception 'invalid_stage' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: write why you are changing the stage' using errcode = '23514';
  end if;
  update public.operator_journey
     set stage = p_stage,
         stage_reason = btrim(p_reason),
         paused_at = case when p_stage = 'paused' then now() else null end,
         updated_at = now()
   where operator_id = p_operator;
  perform app.hire_audit('operator.stage.' || p_stage, p_operator, btrim(p_reason), jsonb_build_object('to', p_stage, 'manual', true));
end;
$$;

create or replace function public.hire_offboard(p_operator uuid, p_reason text, p_last_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin off-boards an operator' using errcode = '42501';
  end if;
  if p_last_day is null or length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'required: a last day and a reason' using errcode = '23514';
  end if;
  update public.operator_journey
     set stage = 'offboarded', offboarded_at = now(), last_day = p_last_day,
         offboard_reason = btrim(p_reason), stage_reason = btrim(p_reason), updated_at = now()
   where operator_id = p_operator;
  insert into public.operator_offboard_item (operator_id, item_key, label) values
    (p_operator, 'ghl', 'Remove GHL users in each client sub-account they worked in'),
    (p_operator, 'discord', 'Remove Discord access'),
    (p_operator, 'payroll', 'Close payroll for the final period')
  on conflict do nothing;
  if p_last_day < current_date then
    update public.operator set status = 'inactive' where id = p_operator;
  end if;
  perform app.hire_audit('operator.offboard', p_operator,
    format('Off-boarded. Last day %s. %s', p_last_day, btrim(p_reason)),
    jsonb_build_object('last_day', p_last_day));
end;
$$;

create or replace function public.hire_tick_offboard(p_operator uuid, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin ticks the off-boarding list' using errcode = '42501';
  end if;
  update public.operator_offboard_item
     set done_at = now(), done_by = auth.uid()
   where operator_id = p_operator and item_key = p_item and done_at is null;
  perform app.hire_audit('operator.offboard.ticked', p_operator, format('Ticked %s', p_item), jsonb_build_object('item', p_item));
end;
$$;

-- Reads ---------------------------------------------------------------------

create or replace function public.hire_search_applications(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.full_name, 'email', a.email, 'phone', a.phone,
      'status', a.status, 'role', a.role_title, 'operator_id', a.converted_operator_id,
      'why', left(coalesce(a.why_you, ''), 400), 'experience', left(coalesce(a.experience, ''), 400)
    ) order by a.received_at desc)
    from public.role_application a
    where a.status not in ('rejected', 'withdrawn')
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or a.full_name ilike '%' || btrim(p_query) || '%'
        or a.email ilike '%' || btrim(p_query) || '%'
      )
    limit 20
  ), '[]'::jsonb);
end;
$$;

create or replace function public.hire_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', coalesce(nullif(btrim(full_name), ''), email)) order by full_name)
      from public.profile where role in ('manager', 'admin', 'owner') and state = 'active'
    ), '[]'::jsonb),
    'programs', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug) order by (slug = 'da-operator-academy') desc, name)
      from public.academy_program
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hire_operator_view(p_operator uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff boolean := app.is_admin() or app.is_manager();
  v_self boolean;
  v_j public.operator_journey;
  v_on public.operator_onboarding;
  v_answers jsonb;
begin
  select exists (select 1 from public.operator o where o.id = p_operator and o.profile_id = app.acting_profile()) into v_self;
  if not v_staff and not v_self then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  select * into v_j from public.operator_journey where operator_id = p_operator;
  select * into v_on from public.operator_onboarding where operator_id = p_operator;
  v_answers := coalesce(v_on.answers, '{}'::jsonb) - 'payout' - 'payout_method' - 'payout_reference';
  if v_staff and not app.is_admin() then
    v_answers := v_answers;
  end if;
  return jsonb_build_object(
    'journey', case when v_j.operator_id is null then null else jsonb_build_object(
      'stage', v_j.stage, 'reason', v_j.stage_reason, 'role_kind', v_j.role_kind,
      'manager_id', v_j.manager_profile_id, 'signed_in_at', v_j.signed_in_at,
      'onboarding_completed_at', v_j.onboarding_completed_at, 'last_day', v_j.last_day,
      'offboard_reason', v_j.offboard_reason, 'reminder_count', v_j.reminder_count
    ) end,
    'answers', case when v_self or v_staff then v_answers else '{}'::jsonb end,
    'submitted', v_on.submitted_at,
    'ack_at', v_on.ack_at,
    'setup_flags', coalesce(to_jsonb(v_on.setup_flags), '[]'::jsonb),
    'setup_cleared', v_on.setup_cleared_at is not null,
    'payout_complete', app.hire_payout_complete(p_operator),
    'readiness', app.hire_readiness(p_operator),
    'ready', app.hire_ready(p_operator),
    'override', (
      select jsonb_build_object('id', o.id, 'reason', o.reason, 'starts_on', o.starts_on, 'expires_on', o.expires_on,
        'status', o.status, 'days_left', o.expires_on - current_date,
        'modules_done', (
          select count(*) from public.academy_progress pr
          join public.academy_enrollment e on e.id = pr.enrollment_id
          where e.operator_id = p_operator and pr.status = 'completed'
        ),
        'modules_total', (
          select count(*) from public.academy_lesson l
          join public.academy_module m on m.id = l.module_id
          join public.academy_program prog on prog.id = m.program_id
          where prog.slug = 'da-operator-academy'
        ))
      from public.certification_override o
      where o.operator_id = p_operator and o.status = 'active'
      order by o.expires_on desc limit 1
    ),
    'offboard', coalesce((
      select jsonb_agg(jsonb_build_object('key', item_key, 'label', label, 'done', done_at is not null) order by item_key)
      from public.operator_offboard_item where operator_id = p_operator
    ), '[]'::jsonb),
    'ghl', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'placement_id', g.placement_id, 'client_id', g.client_case_file_id,
        'user', g.ghl_user_exists, 'mapped', g.mapped, 'phone', g.phone_assigned,
        'confirmed_on', g.confirmed_on, 'operator_confirmed', g.operator_confirmed_at is not null
      ))
      from public.placement_ghl_readiness g where g.operator_id = p_operator
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hire_roster()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'operator_id', j.operator_id,
      'stage', j.stage,
      'met', (select count(*) from jsonb_array_elements(app.hire_readiness(j.operator_id)) i where i ->> 'state' = 'met'),
      'waived', (select count(*) from jsonb_array_elements(app.hire_readiness(j.operator_id)) i where i ->> 'state' = 'waived'),
      'ready', app.hire_ready(j.operator_id)
    ))
    from public.operator_journey j
  ), '[]'::jsonb);
end;
$$;

-- Operator writes -----------------------------------------------------------

create or replace function public.hire_save_onboarding(p_answers jsonb, p_submit boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op uuid;
  v_clean jsonb;
  v_flags text[] := '{}';
  v_prev timestamptz;
begin
  select id into v_op from public.operator where profile_id = app.acting_profile();
  if v_op is null then
    raise exception 'not_an_operator' using errcode = '42501';
  end if;
  if not exists (select 1 from public.operator_journey where operator_id = v_op) then
    raise exception 'no_journey: this onboarding form is for operators added through the hire flow' using errcode = '23514';
  end if;
  v_clean := coalesce(p_answers, '{}'::jsonb) - 'payout' - 'payout_method' - 'payout_reference' - 'account_number';
  select ack_at into v_prev from public.operator_onboarding where operator_id = v_op;
  if v_prev is not null then
    v_clean := v_clean || jsonb_build_object(
      'ack_academy', true, 'ack_gates', true, 'ack_logins', true,
      'ack_confidential', true, 'ack_eod', true, 'ack_myself', true
    );
  end if;
  if v_clean ->> 'laptop' = 'no' then v_flags := v_flags || array['laptop']; end if;
  if v_clean ->> 'internet' = 'no' then v_flags := v_flags || array['internet']; end if;
  if v_clean ->> 'headset' = 'no' then v_flags := v_flags || array['headset']; end if;
  if v_clean ->> 'quiet' = 'no' then v_flags := v_flags || array['quiet']; end if;
  insert into public.operator_onboarding (operator_id, answers, setup_flags)
  values (v_op, v_clean, v_flags)
  on conflict (operator_id) do update
    set answers = excluded.answers, setup_flags = excluded.setup_flags, updated_at = now();
  if p_submit then
    if not app.hire_payout_complete(v_op) then
      raise exception 'payout_required: finish payout details before submitting' using errcode = '23514';
    end if;
    update public.operator_onboarding
       set submitted_at = coalesce(submitted_at, now()), ack_at = coalesce(ack_at, now()), updated_at = now()
     where operator_id = v_op;
    update public.operator_journey
       set onboarding_completed_at = coalesce(onboarding_completed_at, now()), updated_at = now()
     where operator_id = v_op;
    perform app.notify_staff(app.admin_recipient_ids(), 'hire.onboarding', 'important',
      'Onboarding submitted', 'An operator submitted onboarding. Pay details stay on the payout record.', v_op);
    if (select manager_profile_id from public.operator_journey where operator_id = v_op) is not null then
      perform app.notify_staff(
        array[(select manager_profile_id from public.operator_journey where operator_id = v_op)],
        'hire.onboarding', 'important', 'Onboarding submitted',
        'Your operator submitted onboarding. Pay details are not included.', v_op);
    end if;
    perform app.hire_audit('hire.onboarding_submitted', v_op, 'Submitted onboarding', null);
    perform app.hire_refresh(v_op, 'Onboarding submitted');
  end if;
  return public.hire_operator_view(v_op);
end;
$$;

create or replace function public.hire_note_sign_in()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op uuid;
  v_stage text;
begin
  select id into v_op from public.operator where profile_id = app.acting_profile();
  if v_op is null then
    return jsonb_build_object('journey', false);
  end if;
  update public.operator_journey
     set signed_in_at = coalesce(signed_in_at, now()), updated_at = now()
   where operator_id = v_op and signed_in_at is null;
  if found then
    perform app.hire_refresh(v_op, 'Signed in for the first time');
  end if;
  select stage into v_stage from public.operator_journey where operator_id = v_op;
  if v_stage is null then
    return jsonb_build_object('journey', false);
  end if;
  return public.hire_operator_view(v_op) || jsonb_build_object('operator_id', v_op);
end;
$$;

create or replace function public.hire_confirm_ghl(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op uuid;
begin
  select id into v_op from public.operator where profile_id = app.acting_profile();
  update public.placement_ghl_readiness
     set operator_confirmed_at = now()
   where id = p_id and operator_id = v_op and operator_confirmed_at is null;
  if not found then
    raise exception 'not_found: that GHL check is not yours' using errcode = 'P0002';
  end if;
  perform app.hire_audit('hire.ghl_confirmed', v_op, 'Confirmed they can sign in to the client GHL with their own user', jsonb_build_object('readiness_id', p_id));
end;
$$;

create or replace function public.hire_save_ghl(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  insert into public.placement_ghl_readiness (
    operator_id, placement_id, client_case_file_id, ghl_user_exists, mapped, phone_assigned, confirmed_on
  ) values (
    (p ->> 'operator_id')::uuid,
    nullif(p ->> 'placement_id', '')::uuid,
    nullif(p ->> 'client_id', '')::uuid,
    nullif(p ->> 'user', '')::boolean,
    nullif(p ->> 'mapped', '')::boolean,
    p ->> 'phone',
    nullif(p ->> 'confirmed_on', '')::date
  )
  on conflict (operator_id, client_case_file_id) do update
    set ghl_user_exists = excluded.ghl_user_exists,
        mapped = excluded.mapped,
        phone_assigned = excluded.phone_assigned,
        confirmed_on = excluded.confirmed_on,
        placement_id = coalesce(excluded.placement_id, public.placement_ghl_readiness.placement_id);
end;
$$;

-- Sweep for the cron --------------------------------------------------------

create or replace function public.hire_due()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grace integer := coalesce((select cert_grace_days from public.team_setting where id = 1), 0);
begin
  update public.operator o
     set status = 'inactive'
    from public.operator_journey j
   where j.operator_id = o.id
     and j.offboarded_at is not null
     and j.last_day is not null
     and j.last_day < current_date
     and o.status is distinct from 'inactive';

  update public.certification_override o
     set status = 'closed', closed_reason = 'Level 1 certified', updated_at = now()
   where o.status = 'active'
     and exists (
       select 1 from public.operator op
       where op.id = o.operator_id and op.profile_id is not null
         and coalesce(app.so_certification_level(op.profile_id), 0) >= 1
     );
  update public.certification_override
     set status = 'expired', updated_at = now()
   where status = 'active'
     and expires_on + v_grace < current_date;

  return jsonb_build_object(
    'reminders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'operator_id', j.operator_id, 'email', o.email, 'name', o.name, 'count', j.reminder_count + 1
      ))
      from public.operator_journey j
      join public.operator o on o.id = j.operator_id
      where j.stage = 'onboarding'
        and j.onboarding_completed_at is null
        and j.signed_in_at is not null
        and j.reminder_count < 3
        and j.signed_in_at <= now() - ((j.reminder_count + 1) * interval '48 hours')
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'override_id', c.id, 'operator_id', c.operator_id, 'email', o.email, 'name', o.name,
        'days', c.expires_on - current_date, 'expires_on', c.expires_on
      ))
      from public.certification_override c
      join public.operator o on o.id = c.operator_id
      where c.status = 'active' and (c.expires_on - current_date) in (14, 7, 2)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hire_mark_reminder(p_operator uuid, p_count integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager uuid;
  v_name text;
begin
  update public.operator_journey
     set reminder_count = greatest(reminder_count, p_count), last_reminder_at = now(), updated_at = now()
   where operator_id = p_operator;
  if p_count >= 3 then
    select j.manager_profile_id, o.name into v_manager, v_name
    from public.operator_journey j
    join public.operator o on o.id = j.operator_id
    where j.operator_id = p_operator and j.manager_alerted_at is null;
    if v_manager is not null then
      perform app.notify_staff(array[v_manager], 'hire.onboarding_stalled', 'important',
        format('%s has not finished onboarding', v_name),
        'Three reminders have gone out. Onboarding is still open.', p_operator);
      update public.operator_journey set manager_alerted_at = now() where operator_id = p_operator;
    end if;
  end if;
end;
$$;

create or replace function public.hire_mark_ready_email(p_operator uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.operator_journey set ready_emailed_at = now() where operator_id = p_operator and ready_emailed_at is null;
$$;

create or replace function public.hire_ready_unsent()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('operator_id', j.operator_id, 'email', o.email, 'name', o.name)), '[]'::jsonb)
  from public.operator_journey j
  join public.operator o on o.id = j.operator_id
  where j.stage = 'ready' and j.ready_emailed_at is null;
$$;

-- Projection only. Does not write. Used to see who would move if applied. ----

create or replace function public.hire_stage_projection()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'operator_id', o.id,
    'name', o.name,
    'stored_status', o.status,
    'portal_stage', app.operator_stage(o),
    'has_journey', j.operator_id is not null,
    'projected', case
      when j.stage = 'offboarded' or o.status = 'inactive' then 'offboarded'
      when exists (select 1 from public.placement pl where pl.operator_id = o.id and pl.status = 'paused' and pl.placement_type is not null) then 'paused'
      when exists (select 1 from public.placement pl where pl.operator_id = o.id and pl.status = 'active' and pl.placement_type is not null) then 'placed'
      when j.operator_id is not null and app.hire_ready(o.id) then 'ready'
      when o.status in ('certified', 'on_bench') then 'ready'
      when o.status = 'in_training' then 'onboarding'
      when o.status = 'applicant' then 'onboarding'
      else 'invited'
    end
  ) order by o.name), '[]'::jsonb)
  from public.operator o
  left join public.operator_journey j on j.operator_id = o.id;
$$;

-- Workspace access: an active override opens the workspace. The level stays real.

create or replace function public.so_workspace()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid := app.acting_profile();
  v_op public.operator;
  v_level smallint;
  v_pl public.placement;
  v_latest public.placement;
  v_name text;
  v_recert date;
  v_warn integer;
  v_grace integer;
  v_phase text;
  v_days integer;
  v_lapsed date;
  v_cert jsonb;
  v_override boolean := false;
  v_access text := 'none';
begin
  if v_profile is null then
    raise exception 'not_signed_in: sign in first' using errcode = '42501';
  end if;

  perform app.portal_view_audit('workspace');
  perform app.so_file_due_alerts();

  select * into v_op from public.operator where profile_id = v_profile;
  if v_op.id is null then
    return jsonb_build_object('state', 'no_access', 'reason', 'not_an_operator');
  end if;
  v_name := coalesce(nullif(btrim(v_op.name), ''), v_op.email);
  v_override := app.cert_override_access(v_op.id);

  if exists (select 1 from public.lockdown l where l.released_at is null) then
    return jsonb_build_object('state', 'no_access', 'reason', 'lockdown', 'operator_name', v_name);
  end if;

  if app.effective_state(v_profile) is distinct from 'active' or app.operator_stage(v_op) = 'inactive' then
    return jsonb_build_object('state', 'no_access', 'reason', 'deactivated', 'operator_name', v_name);
  end if;

  select s.cert_warning_days, s.cert_grace_days into v_warn, v_grace
  from public.team_setting s where s.id = 1;

  v_level := app.so_certification_level(v_profile);
  v_access := case when coalesce(v_level, 0) >= 1 then 'certified' when v_override then 'override' else 'none' end;
  if coalesce(v_level, -1) < 1 and not v_override then
    select max(c.recertify_on) into v_lapsed
    from public.academy_certification c
    join public.academy_enrollment e on e.id = c.enrollment_id
    where c.profile_id = v_profile and e.status <> 'withdrawn' and c.level >= 1
      and c.recertify_on is not null
      and c.recertify_on + v_grace < current_date;
    return jsonb_build_object(
      'state', 'not_certified', 'operator_name', v_name, 'certification_level', v_level,
      'grace_ended', v_lapsed is not null, 'recertify_on', v_lapsed, 'access', 'none');
  end if;

  select c.recertify_on into v_recert
  from public.academy_certification c
  join public.academy_enrollment e on e.id = c.enrollment_id
  where c.profile_id = v_profile and e.status <> 'withdrawn' and c.level = v_level
    and (c.recertify_on is null or c.recertify_on + v_grace >= current_date)
  order by c.recertify_on nulls first
  limit 1;

  if v_recert is null then
    v_phase := 'current';
    v_days := null;
  elsif v_recert < current_date then
    v_phase := 'grace';
    v_days := (v_recert + v_grace) - current_date;
  elsif v_recert <= current_date + v_warn then
    v_phase := 'warning';
    v_days := v_recert - current_date;
  else
    v_phase := 'current';
    v_days := v_recert - current_date;
  end if;
  v_cert := jsonb_build_object('phase', v_phase, 'recertify_on', v_recert, 'days_left', v_days);

  select * into v_pl from public.placement
  where operator_id = v_op.id and placement_type is not null and status = 'active'
  limit 1;

  if v_pl.id is null then
    select * into v_pl from public.placement
    where operator_id = v_op.id and placement_type is not null and status = 'paused'
    order by paused_at desc nulls last, created_at desc
    limit 1;
  end if;

  if v_pl.id is null then
    select * into v_latest from public.placement
    where operator_id = v_op.id and placement_type is not null
    order by (status = 'draft') desc, coalesce(closed_on, start_date) desc, created_at desc
    limit 1;
    if v_latest.id is not null and v_latest.status in ('ended', 'renewed') then
      return jsonb_build_object('state', 'no_access', 'reason', 'placement_ended', 'operator_name', v_name, 'certification', v_cert, 'access', v_access);
    end if;
    return jsonb_build_object('state', 'awaiting_placement', 'operator_name', v_name,
      'certification_level', coalesce(v_level, 0), 'pending', v_latest.id is not null, 'certification', v_cert, 'access', v_access);
  end if;

  return jsonb_build_object(
    'state', case when v_pl.status = 'active' then 'active' else 'paused' end,
    'operator_name', v_name,
    'certification_level', coalesce(v_level, 0),
    'access', v_access,
    'certification', v_cert,
    'placement', jsonb_build_object(
      'id', v_pl.id,
      'client_name', (select cf.name from public.client_case_file cf where cf.id = v_pl.case_file_id),
      'manager_name', (select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profile p where p.id = v_pl.manager_profile_id),
      'placement_type', v_pl.placement_type,
      'time_zone', v_pl.time_zone,
      'working_days', to_jsonb(v_pl.working_days),
      'shift_start', v_pl.shift_start,
      'shift_end', v_pl.shift_end,
      'eod_deadline', coalesce(v_pl.eod_deadline, v_pl.shift_end),
      'paused_at', v_pl.paused_at
    )
  );
end;
$$;

revoke all on function public.so_workspace() from public, anon;
grant execute on function public.so_workspace() to authenticated;

-- Activity log picks up hire audit rows.

create or replace function public.so_team_activity(
  p_operator_id uuid default null,
  p_actor_id uuid default null,
  p_type text default null,
  p_from date default null,
  p_to date default null,
  p_zone text default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
  v_zone text := app.safe_tz(p_zone);
begin
  return jsonb_build_object('is_admin', v_admin, 'events', coalesce((
    select jsonb_agg(to_jsonb(ev) order by ev.at desc)
    from (
      select * from (
        select
          'hire:' || a.id::text as id,
          a.at,
          'onboarding'::text as type,
          a.summary,
          a.actor_profile_id as actor_id,
          coalesce(app.profile_name(a.actor_profile_id), 'System') as actor_name,
          o.id as operator_id,
          o.name as operator_name
        from public.audit_event a
        join public.operator o on o.id::text = a.entity_id
        where a.entity_type = 'operator'
          and (a.action like 'hire.%' or a.action like 'operator.stage.%' or a.action like 'operator.override.%'
            or a.action like 'operator.readiness.%' or a.action like 'operator.offboard%')
        union all
        select
          'ql:' || c.id::text as id,
          c.changed_at as at,
          'quick_log'::text as type,
          format('%s %s → %s', m.label, coalesce(to_char(c.previous_value, 'FM999999990.##'), '—'), to_char(c.new_value, 'FM999999990.##')) as summary,
          c.changed_by as actor_id,
          app.profile_name(c.changed_by) as actor_name,
          d.operator_id,
          o.name as operator_name
        from public.activity_value_change c
        join public.activity_day d on d.id = c.activity_day_id
        join public.activity_metric m on m.key = c.metric_key
        join public.operator o on o.id = d.operator_id
        where v_admin or c.source = 'operator'
        union all
        select
          'login:' || l.id::text,
          l.at,
          'sign_in',
          'Signed in',
          l.profile_id,
          app.profile_name(l.profile_id),
          o.id,
          o.name
        from public.login_event l
        join public.operator o on o.profile_id = l.profile_id
        where l.outcome = 'success'
        union all
        select
          'read:' || n.id::text,
          n.read_at,
          'alert',
          format('Read “%s”', n.title),
          o.profile_id,
          o.name,
          o.id,
          o.name
        from public.operator_notification n
        join public.operator o on o.id = n.operator_id
        where n.read_at is not null
        union all
        select
          'audit:' || a.id::text,
          a.at,
          case
            when a.action like 'task.%' or a.action = 'workspace.task.created' then 'task'
            when a.action like 'workspace.eod.%' then 'eod'
            when a.action like 'workspace.placement.%' or a.action like 'workspace.outcome.%' then 'placement'
            when a.action like 'workspace.target.%' then 'target'
            when a.action in ('workspace.settings', 'workspace.domain') then 'settings'
            when a.action like 'workspace.alert.%' then 'alert'
            when a.action like 'view_as.%' or a.action = 'impersonation.ended' then 'view_as'
            when a.action = 'account.role_changed' then 'role'
            else null
          end,
          a.summary,
          a.actor_profile_id,
          app.profile_name(a.actor_profile_id),
          o.id,
          o.name
        from public.audit_event a
        left join public.operator o on o.profile_id = a.acting_as_profile_id
        where (v_admin or a.action not ilike '%mismatch%')
          and (v_admin or a.entity_type is distinct from 'activity_mismatch')
          and (v_admin or a.entity_type is distinct from 'operator_pay_impact')
          and (v_admin or a.entity_type is distinct from 'ghl_connection')
          and (v_admin or a.entity_type is distinct from 'payout')
      ) raw
      where raw.type is not null
        and (p_type is null or raw.type = p_type)
        and (p_operator_id is null or raw.operator_id = p_operator_id)
        and (p_actor_id is null or raw.actor_id = p_actor_id)
        and (p_actor_name is null or raw.actor_name ilike '%' || p_actor_name || '%')
        and (p_from is null or (raw.at at time zone v_zone)::date >= p_from)
        and (p_to is null or (raw.at at time zone v_zone)::date <= p_to)
      order by raw.at desc
      limit 300
    ) ev
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.hire_create(jsonb) from public, anon;
revoke all on function public.hire_grant_override(uuid, text, date, integer, boolean) from public, anon;
revoke all on function public.hire_extend_override(uuid, date, text, boolean) from public, anon;
revoke all on function public.hire_revoke_override(uuid, text) from public, anon;
revoke all on function public.hire_waive(uuid, text, text) from public, anon;
revoke all on function public.hire_clear_setup(uuid) from public, anon;
revoke all on function public.hire_set_stage(uuid, text, text) from public, anon;
revoke all on function public.hire_offboard(uuid, text, date) from public, anon;
revoke all on function public.hire_tick_offboard(uuid, text) from public, anon;
revoke all on function public.hire_search_applications(text) from public, anon;
revoke all on function public.hire_options() from public, anon;
revoke all on function public.hire_operator_view(uuid) from public, anon;
revoke all on function public.hire_roster() from public, anon;
revoke all on function public.hire_save_onboarding(jsonb, boolean) from public, anon;
revoke all on function public.hire_note_sign_in() from public, anon;
revoke all on function public.hire_confirm_ghl(uuid) from public, anon;
revoke all on function public.hire_save_ghl(jsonb) from public, anon;
revoke all on function public.hire_due() from public, anon, authenticated;
revoke all on function public.hire_mark_reminder(uuid, integer) from public, anon, authenticated;
revoke all on function public.hire_mark_ready_email(uuid) from public, anon, authenticated;
revoke all on function public.hire_ready_unsent() from public, anon, authenticated;
revoke all on function public.hire_stage_projection() from public, anon;

grant execute on function public.hire_create(jsonb) to authenticated;
grant execute on function public.hire_grant_override(uuid, text, date, integer, boolean) to authenticated;
grant execute on function public.hire_extend_override(uuid, date, text, boolean) to authenticated;
grant execute on function public.hire_revoke_override(uuid, text) to authenticated;
grant execute on function public.hire_waive(uuid, text, text) to authenticated;
grant execute on function public.hire_clear_setup(uuid) to authenticated;
grant execute on function public.hire_set_stage(uuid, text, text) to authenticated;
grant execute on function public.hire_offboard(uuid, text, date) to authenticated;
grant execute on function public.hire_tick_offboard(uuid, text) to authenticated;
grant execute on function public.hire_search_applications(text) to authenticated;
grant execute on function public.hire_options() to authenticated;
grant execute on function public.hire_operator_view(uuid) to authenticated;
grant execute on function public.hire_roster() to authenticated;
grant execute on function public.hire_save_onboarding(jsonb, boolean) to authenticated;
grant execute on function public.hire_note_sign_in() to authenticated;
grant execute on function public.hire_confirm_ghl(uuid) to authenticated;
grant execute on function public.hire_save_ghl(jsonb) to authenticated;
grant execute on function public.hire_due() to service_role;
grant execute on function public.hire_mark_reminder(uuid, integer) to service_role;
grant execute on function public.hire_mark_ready_email(uuid) to service_role;
grant execute on function public.hire_ready_unsent() to service_role;
grant execute on function public.hire_stage_projection() to service_role;
