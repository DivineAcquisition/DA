-- Recipients point at the real record they stand for, onboarding protocols
-- become rows, and an advanced application starts its operator on one.
--
-- Three gaps, one migration, because the third depends on the first two:
--
--   1. da_recipient was a contact card matched to operators and case files by
--      comparing email strings. It now carries the link itself.
--   2. da_onboarding_submission.protocol_key was free text. It now references
--      da_onboarding_protocol, whose steps live in da_onboarding_protocol_step.
--      Same two-table shape as industry_template / industry_template_field.
--   3. app.handle_application_advanced (20260924171000) now also creates or
--      reuses the operator's recipient and starts Standard Operator Onboarding.
--      It stays one security-definer function doing sequential writes in one
--      transaction, which is how accept_client_invite() turns an invite into a
--      client_account. No second trigger is chained on operator.

-- 1. Recipient links ---------------------------------------------------------

alter table public.da_recipient
  add column if not exists case_file_id uuid
    references public.client_case_file (id) on delete set null,
  add column if not exists operator_id uuid
    references public.operator (id) on delete set null;

comment on column public.da_recipient.case_file_id is
  'The client case file this recipient represents. Only a client recipient may set it. Null until the case file exists, e.g. an agreement sent to a prospect.';
comment on column public.da_recipient.operator_id is
  'The operator this recipient represents. Only an operator recipient may set it. Null until the operator row exists.';

-- The foreign keys make each column point at the right table. This makes each
-- recipient type use only its own column, so a client can never point at an
-- operator and no recipient points at both.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'da_recipient_link_matches_type') then
    alter table public.da_recipient
      add constraint da_recipient_link_matches_type check (
        (recipient_type = 'client' and operator_id is null)
        or (recipient_type = 'operator' and case_file_id is null)
      );
  end if;
end
$$;

-- One operator, one recipient card. A case file can have several client
-- contacts, so it gets a plain index.
create unique index if not exists da_recipient_operator_uq
  on public.da_recipient (operator_id)
  where operator_id is not null;

create index if not exists da_recipient_case_file_idx
  on public.da_recipient (case_file_id)
  where case_file_id is not null;

-- Backfill: operator recipients match their operator by email, ignoring case.
-- Anything left unmatched is raised as an owner alert rather than dropped.
do $$
declare
  v_before integer;
  v_linked integer;
  r record;
begin
  select count(*) into v_before
    from public.da_recipient
   where recipient_type = 'operator';

  update public.da_recipient d
     set operator_id = o.id
    from public.operator o
   where d.recipient_type = 'operator'
     and d.operator_id is null
     and lower(btrim(o.email)) = lower(btrim(d.email))
     -- Skip an email that two operators share; the admin picks.
     and (select count(*) from public.operator o2
           where lower(btrim(o2.email)) = lower(btrim(d.email))) = 1
     and not exists (select 1 from public.da_recipient d2 where d2.operator_id = o.id);

  get diagnostics v_linked = row_count;

  for r in
    select id, full_name, email
      from public.da_recipient
     where recipient_type = 'operator'
       and operator_id is null
  loop
    insert into public.owner_alert (kind, summary)
    values (
      'da_recipient.unlinked',
      format(
        'Operator recipient %s <%s> (%s) has no operator record with that email. It links automatically when their application is advanced, or an admin can set da_recipient.operator_id.',
        r.full_name, r.email, r.id
      )
    );
  end loop;

  raise notice 'da_recipient backfill: % operator recipients, % linked, % flagged',
    v_before, v_linked, v_before - v_linked;
end
$$;

-- 2. Onboarding protocols ----------------------------------------------------

create table if not exists public.da_onboarding_protocol (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  recipient_type text not null check (recipient_type in ('client', 'operator')),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

comment on table public.da_onboarding_protocol is
  'An onboarding flow a recipient can be started on. Steps live in da_onboarding_protocol_step, the same shape as industry_template / industry_template_field.';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'da_onboarding_step_kind') then
    create type public.da_onboarding_step_kind as enum (
      'form_question',      -- a plain intake question
      'acknowledgment',     -- yes, I have read this
      'credential_handoff', -- tool access was granted; the credential itself lives in client_credential
      'material_review'     -- review a piece of onboarding material
    );
  end if;
end
$$;

create table if not exists public.da_onboarding_protocol_step (
  id uuid primary key default gen_random_uuid(),
  protocol_key text not null
    references public.da_onboarding_protocol (key) on delete cascade on update cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(btrim(label)) between 1 and 300),
  kind public.da_onboarding_step_kind not null,
  help text,
  -- The tools a credential_handoff step covers. Names only, never secrets.
  options text[],
  required boolean not null default true,
  sort_order integer not null default 100,
  unique (protocol_key, key)
);

create index if not exists da_onboarding_protocol_step_order_idx
  on public.da_onboarding_protocol_step (protocol_key, sort_order);

-- The one protocol already in use. Its key is the value sitting in the only
-- existing da_onboarding_submission row, and its questions are defined in
-- lib/workspace/onboarding-protocol.ts, so it has no step rows here.
insert into public.da_onboarding_protocol (key, recipient_type, name, description, sort_order)
values (
  'va_sales_operator', 'operator', 'VA Sales Operator Onboarding',
  'Shown after the Sales Operator placement agreement is signed. Questions are defined in the app (lib/workspace/onboarding-protocol.ts).',
  20
)
on conflict (key) do nothing;

insert into public.da_onboarding_protocol (key, recipient_type, name, description, sort_order)
values (
  'standard_operator', 'operator', 'Standard Operator Onboarding',
  'Every new operator starts here when their application is advanced.',
  10
)
on conflict (key) do nothing;

insert into public.da_onboarding_protocol_step (protocol_key, key, label, kind, help, options, sort_order)
values
  ('standard_operator', 'sop_reviewed',
   'I have reviewed the operator SOP.', 'acknowledgment', null, null, 10),
  ('standard_operator', 'tool_access_granted',
   'Tool access has been granted (GHL, Discord, Vistrial).', 'credential_handoff',
   'Confirms access was granted. Logins are never stored here.',
   array['GHL', 'Discord', 'Vistrial'], 20),
  ('standard_operator', 'shift_window_confirmed',
   'I confirm my assigned shift window.', 'acknowledgment', null, null, 30)
on conflict (protocol_key, key) do nothing;

-- Any key already on a submission gets a protocol before the FK goes on, so
-- the constraint cannot fail on data we have not looked at. On the hosted
-- project this is a no-op: the only key in use is va_sales_operator.
insert into public.da_onboarding_protocol (key, recipient_type, name, description)
select distinct s.protocol_key, 'operator', s.protocol_key,
       'Created from an existing submission when protocol_key became a foreign key.'
  from public.da_onboarding_submission s
 where not exists (select 1 from public.da_onboarding_protocol p where p.key = s.protocol_key)
   and s.protocol_key ~ '^[a-z][a-z0-9_]*$';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'da_onboarding_submission_protocol_fkey') then
    alter table public.da_onboarding_submission
      add constraint da_onboarding_submission_protocol_fkey
      foreign key (protocol_key) references public.da_onboarding_protocol (key)
      on update cascade;
  end if;
end
$$;

-- One pending run of a protocol per recipient, so re-running the conversion
-- (or an admin double-click) cannot start the same onboarding twice.
create unique index if not exists da_onboarding_submission_pending_uq
  on public.da_onboarding_submission (recipient_id, protocol_key)
  where status = 'pending';

-- Same access as industry_template / industry_template_field: admins write,
-- signed-in staff read.
alter table public.da_onboarding_protocol enable row level security;
alter table public.da_onboarding_protocol_step enable row level security;

drop policy if exists da_onboarding_protocol_admin_write on public.da_onboarding_protocol;
create policy da_onboarding_protocol_admin_write on public.da_onboarding_protocol
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
drop policy if exists da_onboarding_protocol_read_all on public.da_onboarding_protocol;
create policy da_onboarding_protocol_read_all on public.da_onboarding_protocol
  for select to authenticated using (true);

drop policy if exists da_onboarding_protocol_step_admin_write on public.da_onboarding_protocol_step;
create policy da_onboarding_protocol_step_admin_write on public.da_onboarding_protocol_step
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
drop policy if exists da_onboarding_protocol_step_read_all on public.da_onboarding_protocol_step;
create policy da_onboarding_protocol_step_read_all on public.da_onboarding_protocol_step
  for select to authenticated using (true);

revoke all on public.da_onboarding_protocol from anon;
revoke all on public.da_onboarding_protocol_step from anon;
grant select, insert, update, delete on public.da_onboarding_protocol to authenticated;
grant select, insert, update, delete on public.da_onboarding_protocol_step to authenticated;

-- The public onboarding page now gets the protocol's steps with the
-- submission, so a protocol defined only in the database can render.
create or replace function public.da_load_onboarding(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_onboarding_submission%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_agreement public.da_agreement%rowtype;
  v_protocol public.da_onboarding_protocol%rowtype;
  v_template_name text;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row
    from public.da_onboarding_submission
   where access_token = v_token;

  if not found then
    return null;
  end if;

  select * into v_recipient from public.da_recipient where id = v_row.recipient_id;
  if not found then
    return null;
  end if;

  select * into v_protocol from public.da_onboarding_protocol where key = v_row.protocol_key;

  if v_row.agreement_id is not null then
    select * into v_agreement from public.da_agreement where id = v_row.agreement_id;
    if found then
      select name into v_template_name
        from public.da_agreement_template
       where id = v_agreement.template_id;
    end if;
  end if;

  if v_row.opened_at is null then
    update public.da_onboarding_submission
       set opened_at = now()
     where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'submission', jsonb_build_object(
      'id', v_row.id,
      'protocol_key', v_row.protocol_key,
      'status', v_row.status,
      'answers', v_row.answers,
      'completed_at', v_row.completed_at,
      'agreement_id', v_row.agreement_id
    ),
    'protocol', jsonb_build_object(
      'key', v_protocol.key,
      'name', v_protocol.name,
      'description', v_protocol.description,
      'steps', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', s.key,
                 'label', s.label,
                 'kind', s.kind,
                 'help', s.help,
                 'options', to_jsonb(s.options),
                 'required', s.required
               ) order by s.sort_order, s.key)
          from public.da_onboarding_protocol_step s
         where s.protocol_key = v_row.protocol_key
      ), '[]'::jsonb)
    ),
    'recipient', jsonb_build_object(
      'full_name', v_recipient.full_name,
      'email', v_recipient.email,
      'phone', v_recipient.phone
    ),
    'agreement', case
      when v_agreement.id is null then null
      else jsonb_build_object(
        'id', v_agreement.id,
        'status', v_agreement.status,
        'template_name', coalesce(v_template_name, 'Agreement'),
        'signed', v_agreement.status = 'completed'
      )
    end
  );
end;
$$;

revoke all on function public.da_load_onboarding(text) from public;
grant execute on function public.da_load_onboarding(text) to anon, authenticated, service_role;

-- 3. Advancing an application also starts the operator's onboarding ----------

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
  v_recipient_id uuid;
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

  -- The operator's recipient card. An unlinked operator recipient with the
  -- same email (an agreement sent before they applied) is adopted and only
  -- its blanks are filled; otherwise one is created from the application.
  select d.id into v_recipient_id
    from public.da_recipient d
   where d.recipient_type = 'operator'
     and d.operator_id is null
     and lower(btrim(d.email)) = v_email
   order by d.created_at
   limit 1;

  if v_recipient_id is not null then
    update public.da_recipient
       set operator_id = v_operator_id,
           phone = coalesce(phone, nullif(btrim(new.phone), ''))
     where id = v_recipient_id;
  else
    insert into public.da_recipient (full_name, email, phone, recipient_type, operator_id)
    values (new.full_name, v_email, nullif(btrim(new.phone), ''), 'operator', v_operator_id)
    returning id into v_recipient_id;
  end if;

  -- Standard Operator Onboarding, pending, with no agreement required yet.
  -- Token minted the way invite_client() mints one.
  insert into public.da_onboarding_submission (protocol_key, recipient_id, access_token, status)
  values (
    'standard_operator',
    v_recipient_id,
    encode(extensions.gen_random_bytes(24), 'hex'),
    'pending'
  )
  on conflict (recipient_id, protocol_key) where status = 'pending' do nothing;

  new.converted_operator_id := v_operator_id;
  return new;
end;
$$;

comment on function app.handle_application_advanced() is
  'When a role application moves to advanced: create one applicant operator, link the two rows, create or adopt the operator''s da_recipient, and start Standard Operator Onboarding. A later save of the same status does not convert again.';

revoke all on function app.handle_application_advanced() from public, anon, authenticated;
