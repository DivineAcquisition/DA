-- ---------------------------------------------------------------------------
-- Per-client operating configuration, moved out of the application.
--
-- Five industry templates lived in lib/vistrial/industries.ts, and which one a
-- client got was decided like this:
--
--   const industry = row.notes?.includes('med spa') ? 'med-spa' : 'generic';
--
-- The free-text notes column, string-matched. That one line decided which
-- questions every operator on that client answered at the end of every shift, so
-- an admin tidying up a note could silently change the shape of the EOD report,
-- and adding a sixth industry needed a deploy. The definition of a qualified
-- booking — the sentence an operator is measured against — was a string literal,
-- identical for every client regardless of what they actually sell.
--
-- None of that is code. It is configuration with one owner, the admin, and it
-- belongs where the rest of the admin's entries live.
--
-- What stays in the application is the locked EOD core. That is a TypeScript type
-- with eight fixed fields, deliberately not configurable, because cross-operator
-- reporting only works while every operator answers the same questions. A type is
-- code. A per-client template is data.
-- ---------------------------------------------------------------------------

create type public.eod_field_type as enum ('number', 'text', 'select', 'boolean');

-- ---------------------------------------------------------------------------
-- The dictionary
--
-- Readable by every authenticated caller, like metric_definition: it describes
-- shapes rather than any client's data.
-- ---------------------------------------------------------------------------

create table public.industry_template (
  key text primary key check (key ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  description text not null default '',
  -- What counts as a booking worth paying for in this industry. The starting
  -- point for a client's own definition, not a substitute for it.
  suggested_qualified_booking text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

comment on table public.industry_template is
  'Starting points for a client''s EOD configuration. Adding an industry is a row, not a deploy.';

create table public.industry_template_field (
  id uuid primary key default gen_random_uuid(),
  template_key text not null references public.industry_template (key) on delete cascade,
  key text not null check (key ~ '^[a-zA-Z][a-zA-Z0-9_]*$'),
  label text not null,
  field_type public.eod_field_type not null,
  -- Only meaningful for a select. Enforced below rather than left to the caller.
  options text[],
  required boolean not null default false,
  help text,
  sort_order integer not null default 100,
  unique (template_key, key),
  constraint industry_template_field_options_match_type check (
    (field_type = 'select' and options is not null and array_length(options, 1) > 0)
    or (field_type <> 'select' and options is null)
  )
);

create index industry_template_field_template_idx on public.industry_template_field (template_key, sort_order);

-- ---------------------------------------------------------------------------
-- What a client is configured as
-- ---------------------------------------------------------------------------

alter table public.client_case_file
  add column industry_key text references public.industry_template (key),
  -- The sentence an operator is measured against. Seeded from the template and
  -- editable per client, because two med spas do not agree on what a qualified
  -- consult is.
  add column qualified_booking_definition text,
  add column contact_role text,
  add column contact_channel text;

comment on column public.client_case_file.industry_key is
  'Replaces inferring the industry by string-matching the notes column, which let a tidied-up note change the shape of every EOD report.';

create index client_case_file_industry_idx on public.client_case_file (industry_key);

-- Per-client overrides. The comment in the application always claimed templates
-- were "starting points, not constraints" and that every one could be overridden
-- per client; nothing implemented it. This does: any row here replaces the
-- template's field set for that client entirely, so an override is a deliberate
-- act rather than a merge nobody can predict.
create table public.case_file_eod_field (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  key text not null check (key ~ '^[a-zA-Z][a-zA-Z0-9_]*$'),
  label text not null,
  field_type public.eod_field_type not null,
  options text[],
  required boolean not null default false,
  help text,
  sort_order integer not null default 100,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  unique (case_file_id, key),
  constraint case_file_eod_field_options_match_type check (
    (field_type = 'select' and options is not null and array_length(options, 1) > 0)
    or (field_type <> 'select' and options is null)
  )
);

create index case_file_eod_field_case_file_idx on public.case_file_eod_field (case_file_id, sort_order);

-- ---------------------------------------------------------------------------
-- The locked core, refused as a configured key
--
-- These eight keys mirror the EodCore type in lib/vistrial/types.ts, which is
-- where they are actually fixed. They are repeated here so the database can
-- refuse a configured field that would shadow one: a client-specific
-- `appointmentsBooked` would silently break every cross-operator comparison. If
-- the type changes, change this list with it.
-- ---------------------------------------------------------------------------

create or replace function app.eod_core_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'shiftStartActual', 'shiftEndActual', 'conversationsHandled', 'appointmentsBooked',
    'followUpsCompleted', 'escalationsRaised', 'blockers', 'notes'
  ];
$$;

create or replace function app.guard_eod_field_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.key = any (app.eod_core_keys()) then
    raise exception 'eod_core_key_is_locked: % is a core field on every report for every client. A configured field may not redefine it.', new.key
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger industry_template_field_not_core
  before insert or update on public.industry_template_field
  for each row execute function app.guard_eod_field_key();

create trigger case_file_eod_field_not_core
  before insert or update on public.case_file_eod_field
  for each row execute function app.guard_eod_field_key();

-- ---------------------------------------------------------------------------
-- The effective field set
--
-- One place resolves template against override, so the hub, the admin workspace
-- and any future surface cannot disagree about what an operator is asked.
-- ---------------------------------------------------------------------------

create or replace function public.eod_fields_for_case_file(p_case_file_id uuid)
returns table (
  key text,
  label text,
  field_type public.eod_field_type,
  options text[],
  required boolean,
  help text,
  sort_order integer,
  overridden boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.key, f.label, f.field_type, f.options, f.required, f.help, f.sort_order, true
  from public.case_file_eod_field f
  where f.case_file_id = p_case_file_id

  union all

  select t.key, t.label, t.field_type, t.options, t.required, t.help, t.sort_order, false
  from public.industry_template_field t
  join public.client_case_file cf on cf.industry_key = t.template_key
  where cf.id = p_case_file_id
    -- An override replaces the template rather than adding to it.
    and not exists (select 1 from public.case_file_eod_field o where o.case_file_id = p_case_file_id)

  order by sort_order, key;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.industry_template enable row level security;
alter table public.industry_template_field enable row level security;
alter table public.case_file_eod_field enable row level security;

-- A dictionary, not client data. An operator has to be able to read the field
-- definitions to fill the form in.
create policy industry_template_read_all on public.industry_template
  for select to authenticated using (true);

create policy industry_template_admin_write on public.industry_template
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy industry_template_field_read_all on public.industry_template_field
  for select to authenticated using (true);

create policy industry_template_field_admin_write on public.industry_template_field
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy case_file_eod_field_admin_all on public.case_file_eod_field
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy case_file_eod_field_manager_scope on public.case_file_eod_field
  for all to authenticated
  using (app.is_manager() and app.in_scope_case_file(case_file_id))
  with check (app.is_manager() and app.in_scope_case_file(case_file_id));

-- The operator filling in the report needs to see what is being asked of them.
create policy case_file_eod_field_operator_read on public.case_file_eod_field
  for select to authenticated
  using (exists (
    select 1 from public.placement pl
    join public.operator o on o.id = pl.operator_id
    where pl.case_file_id = public.case_file_eod_field.case_file_id
      and o.profile_id = auth.uid()
  ));

revoke all on public.industry_template from anon;
revoke all on public.industry_template_field from anon;
revoke all on public.case_file_eod_field from anon;
revoke all on function public.eod_fields_for_case_file(uuid) from anon;

-- ---------------------------------------------------------------------------
-- The templates, as data
-- ---------------------------------------------------------------------------

insert into public.industry_template (key, name, description, suggested_qualified_booking, sort_order) values
  ('med-spa', 'Med spa / aesthetics',
   'Consult-led bookings with treatment interest worth tracking per shift.',
   'A consult booked with a confirmed time, a named treatment interest, and a reachable phone number.', 10),
  ('cleaning', 'Cleaning / recurring service',
   'Quote-led bookings where service type and recurrence drive the value.',
   'A walkthrough or first clean scheduled with an address, a service type, and a quoted range.', 20),
  ('coaching', 'Coaching / info',
   'Application-led bookings where show rate is the number that matters.',
   'A strategy call booked by an applicant who answered the qualifying questions and confirmed the time.', 30),
  ('home-services', 'Home services / trades',
   'Dispatch-led bookings where job type and urgency drive routing.',
   'An on-site estimate booked with an address, a job type, and an arrival window the customer confirmed.', 40),
  ('generic', 'Generic service business',
   'Core only, for clients that do not need industry-specific reporting yet.',
   'An appointment with a confirmed time and a reachable contact method.', 99);

insert into public.industry_template_field
  (template_key, key, label, field_type, options, required, help, sort_order) values
  ('med-spa', 'consultsBooked', 'Consults booked', 'number', null, true, null, 10),
  ('med-spa', 'treatmentInterest', 'Primary treatment interest', 'select',
   array['Injectables', 'Laser', 'Body contouring', 'Skin / facials', 'Mixed', 'None stated'], true, null, 20),
  ('med-spa', 'preTreatmentQuestions', 'Pre-treatment questions deferred to clinical', 'number', null, false,
   'Anything you routed to the clinical team rather than answering.', 30),

  ('cleaning', 'quotesSent', 'Quotes sent', 'number', null, true, null, 10),
  ('cleaning', 'serviceType', 'Dominant service type', 'select',
   array['Recurring residential', 'One-off deep clean', 'Move in / move out', 'Commercial'], true, null, 20),
  ('cleaning', 'recurringInterest', 'Asked about recurring service', 'boolean', null, false, null, 30),

  ('coaching', 'applicationsReviewed', 'Applications reviewed', 'number', null, true, null, 10),
  ('coaching', 'showRate', 'Show rate on today’s calls (%)', 'number', null, true, null, 20),
  ('coaching', 'disqualified', 'Disqualified on fit', 'number', null, false,
   'Applicants you turned away rather than booked.', 30),

  ('home-services', 'estimatesBooked', 'On-site estimates booked', 'number', null, true, null, 10),
  ('home-services', 'jobType', 'Dominant job type', 'select',
   array['Repair', 'Replacement', 'Maintenance plan', 'Emergency'], true, null, 20),
  ('home-services', 'emergencyCalls', 'Emergency calls routed', 'number', null, false, null, 30);

-- ---------------------------------------------------------------------------
-- Backfill
--
-- Reproduces the note-matching heuristic exactly once, here, so no client's
-- current behaviour changes on deploy. From now on the column is the owner and
-- the notes are just notes.
-- ---------------------------------------------------------------------------

update public.client_case_file
   set industry_key = case
         when notes is not null and position('med spa' in lower(notes)) > 0 then 'med-spa'
         else 'generic'
       end
 where industry_key is null;

-- The sentence every client previously shared, kept as each client's own so the
-- hub reads the same words it read yesterday.
update public.client_case_file
   set qualified_booking_definition = 'An appointment with a confirmed time and a reachable contact method.'
 where qualified_booking_definition is null;

alter table public.client_case_file
  alter column industry_key set default 'generic',
  alter column industry_key set not null;

-- ---------------------------------------------------------------------------
-- Setting it
-- ---------------------------------------------------------------------------

create or replace function public.create_case_file(
  p_name text,
  p_vertical text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_engagement_start date default null,
  p_retainer_amount numeric default null,
  p_revenue_goal_monthly numeric default null,
  p_industry_key text default 'generic',
  p_contact_role text default null,
  p_contact_channel text default null
)
returns public.client_case_file
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_slug text;
  v_suffix integer := 0;
  v_template public.industry_template;
  v_case_file public.client_case_file;
begin
  if coalesce(nullif(trim(p_name), ''), '') = '' then
    raise exception 'name_required' using errcode = '23514';
  end if;

  select * into v_template from public.industry_template where key = coalesce(p_industry_key, 'generic');

  if v_template.key is null then
    raise exception 'unknown_industry: % is not a template. Add it before using it.', p_industry_key
      using errcode = 'P0002';
  end if;

  v_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  while exists (select 1 from public.client_case_file where slug = v_slug || case when v_suffix = 0 then '' else '-' || v_suffix end) loop
    v_suffix := v_suffix + 1;
  end loop;

  if v_suffix > 0 then
    v_slug := v_slug || '-' || v_suffix;
  end if;

  insert into public.client_case_file (
    name, slug, vertical, contact_name, contact_email, engagement_start,
    retainer_amount, revenue_goal_monthly, created_by,
    industry_key, qualified_booking_definition, contact_role, contact_channel
  )
  values (
    trim(p_name), v_slug, p_vertical, p_contact_name, p_contact_email, p_engagement_start,
    p_retainer_amount, p_revenue_goal_monthly, auth.uid(),
    v_template.key,
    -- The template's sentence becomes this client's own, editable from here.
    v_template.suggested_qualified_booking,
    nullif(btrim(coalesce(p_contact_role, '')), ''),
    nullif(btrim(coalesce(p_contact_channel, '')), '')
  )
  returning * into v_case_file;

  return v_case_file;
end;
$$;

revoke all on function public.create_case_file(text, text, text, text, date, numeric, numeric, text, text, text) from anon;

-- Changing it afterwards. Switching template resets the qualified-booking
-- sentence to the new template's only when the client never wrote their own, so
-- an edit made deliberately is not undone by a later change of industry.
create or replace function public.set_case_file_operating_config(
  p_case_file_id uuid,
  p_industry_key text default null,
  p_qualified_booking_definition text default null,
  p_contact_role text default null,
  p_contact_channel text default null
)
returns public.client_case_file
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_before public.client_case_file;
  v_after public.client_case_file;
  v_template public.industry_template;
begin
  -- Explicit, so a caller who cannot see the row is told they are not allowed
  -- rather than that the client does not exist.
  perform app.require_admin();

  select * into v_before from public.client_case_file where id = p_case_file_id;

  if v_before.id is null then
    raise exception 'case_file_not_found: %', p_case_file_id using errcode = 'P0002';
  end if;

  if p_industry_key is not null then
    select * into v_template from public.industry_template where key = p_industry_key;
    if v_template.key is null then
      raise exception 'unknown_industry: % is not a template. Add it before using it.', p_industry_key
        using errcode = 'P0002';
    end if;
  end if;

  update public.client_case_file
     set industry_key = coalesce(p_industry_key, industry_key),
         qualified_booking_definition = coalesce(
           nullif(btrim(coalesce(p_qualified_booking_definition, '')), ''),
           case
             when v_template.key is not null
              and qualified_booking_definition = (
                select suggested_qualified_booking from public.industry_template where key = v_before.industry_key
              )
             then v_template.suggested_qualified_booking
             else qualified_booking_definition
           end
         ),
         contact_role = coalesce(nullif(btrim(coalesce(p_contact_role, '')), ''), contact_role),
         contact_channel = coalesce(nullif(btrim(coalesce(p_contact_channel, '')), ''), contact_channel)
   where id = p_case_file_id
  returning * into v_after;

  perform app.audit('case_file.config_changed', 'client_case_file', p_case_file_id::text,
    format('Operating configuration for %s: %s template, qualified booking "%s"',
           v_after.name, v_after.industry_key, v_after.qualified_booking_definition),
    jsonb_build_object(
      'industry_key', v_before.industry_key,
      'qualified_booking_definition', v_before.qualified_booking_definition,
      'contact_role', v_before.contact_role,
      'contact_channel', v_before.contact_channel),
    jsonb_build_object(
      'industry_key', v_after.industry_key,
      'qualified_booking_definition', v_after.qualified_booking_definition,
      'contact_role', v_after.contact_role,
      'contact_channel', v_after.contact_channel),
    p_case_file_id);

  return v_after;
end;
$$;

revoke all on function public.set_case_file_operating_config(uuid, text, text, text, text) from anon;
