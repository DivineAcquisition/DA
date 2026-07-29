-- ---------------------------------------------------------------------------
-- Leads, and the two timestamps everything about speed rests on.
--
-- Response time was previously only ever an aggregate: `response_day` counted
-- conversations and how many beat the standard, and `tracking_funnel_daily` held
-- a daily mean. Both are useful and both are rollups of something that did not
-- exist. There was no row saying "this lead arrived at 09:02 and a human replied
-- at 09:06", which means there was nothing to recompute a disputed number from
-- and nothing stopping a later contact from making a slow response look fast.
--
-- The lead is that row. It owns its own existence, its source, its UTMs, and the
-- timestamps. Response time is a generated column over them, so it cannot be
-- entered by hand from any surface — there is no column to enter it into.
-- ---------------------------------------------------------------------------

create table public.lead (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  -- The placement working this lead when it arrived. Response performance is
  -- attributed to whoever was on shift, so it is resolved at ingestion and left
  -- alone afterwards.
  placement_id uuid references public.placement (id) on delete set null,

  -- The contact id at the provider. Unique per client, which is what makes a
  -- redelivered ContactCreate an update of one lead rather than a second lead.
  external_id text not null,

  name text,
  email text,
  phone text,

  -- As reported by the provider. Vistrial does not infer a source.
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,

  -- Stamped once, all three. A later event of the same kind leaves the value
  -- alone; see the trigger below.
  lead_in_at timestamptz not null,
  first_touch_at timestamptz,
  first_booking_at timestamptz,

  stage text,
  stage_changed_at timestamptz,

  -- Response time is computed, never stored as an entered value. A generated
  -- column is the strongest form of that: there is no way to write it.
  response_minutes numeric(10, 2) generated always as (
    case
      when first_touch_at is null or first_touch_at < lead_in_at then null
      else round(extract(epoch from (first_touch_at - lead_in_at))::numeric / 60.0, 2)
    end
  ) stored,

  first_ingest_event_id uuid references public.ingest_event (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (case_file_id, external_id)
);

comment on table public.lead is
  'Rule 1: the owner of lead existence, source, UTMs and the lead-in and first-touch timestamps. Every response-time figure anywhere else is a read of this table.';

comment on column public.lead.response_minutes is
  'Generated from lead_in_at and first_touch_at. Response time is never stored as an entered value, so there is no column any surface could write it to.';

comment on column public.lead.first_touch_at is
  'Rule 3: stamped once. Overwriting it with the most recent contact is what makes a slow response look fast, so the trigger refuses to move it.';

create index lead_case_file_idx on public.lead (case_file_id, lead_in_at desc);
create index lead_placement_idx on public.lead (placement_id, lead_in_at desc);
create index lead_email_idx on public.lead (case_file_id, lower(email)) where email is not null;
create index lead_phone_idx on public.lead (case_file_id, phone) where phone is not null;
-- The leads still waiting on a human, which is the queue that matters live.
create index lead_awaiting_touch_idx on public.lead (case_file_id, lead_in_at)
  where first_touch_at is null;

create trigger lead_touch_updated_at before update on public.lead
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Stamp once
--
-- Written only when empty. Takes the columns to protect as trigger arguments so
-- the rule is declared at the table rather than restated in every handler, and
-- so a handler cannot forget it.
--
-- It retains the old value rather than raising. A provider redelivering an event
-- is normal and must not fail; the point is that the first value wins, not that
-- the second delivery is an error.
-- ---------------------------------------------------------------------------

create or replace function app.stamp_once()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_column text;
  v_row jsonb := to_jsonb(new);
  v_was jsonb := to_jsonb(old);
begin
  foreach v_column in array tg_argv loop
    if v_was -> v_column is not null and jsonb_typeof(v_was -> v_column) <> 'null' then
      v_row := jsonb_set(v_row, array[v_column], v_was -> v_column);
    end if;
  end loop;

  return jsonb_populate_record(new, v_row);
end;
$$;

comment on function app.stamp_once() is
  'Rule 3: the named timestamps are written only when empty. Retains the earlier value silently, because a redelivered event is routine and must not fail.';

create trigger lead_stamp_once before update on public.lead
  for each row execute function app.stamp_once('lead_in_at', 'first_touch_at', 'first_booking_at');

-- ---------------------------------------------------------------------------
-- Touches
--
-- Append only. First touch is a stamp on the lead because that is what has to be
-- cheap to read, but the stamp is only defensible if the individual contacts are
-- on record underneath it.
-- ---------------------------------------------------------------------------

create table public.lead_touch (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  -- 'sms', 'email', 'call', 'note' — as reported, not normalised into a guess.
  channel text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  occurred_at timestamptz not null,
  -- The delivery this came from, so any touch can be traced back to its payload.
  ingest_event_id uuid references public.ingest_event (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.lead_touch is
  'Every contact on a lead, append only. The evidence under lead.first_touch_at.';

create index lead_touch_lead_idx on public.lead_touch (lead_id, occurred_at);
create index lead_touch_case_file_idx on public.lead_touch (case_file_id, occurred_at desc);

create trigger lead_touch_no_update before update on public.lead_touch
  for each row execute function app.forbid_mutation();

create trigger lead_touch_no_delete before delete on public.lead_touch
  for each row execute function app.forbid_mutation();

create table public.lead_stage_event (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  occurred_at timestamptz not null,
  ingest_event_id uuid references public.ingest_event (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.lead_stage_event is
  'Pipeline movement, append only. lead.stage is the latest of these, kept on the lead so a funnel read is one scan.';

create index lead_stage_event_lead_idx on public.lead_stage_event (lead_id, occurred_at);

create trigger lead_stage_event_no_update before update on public.lead_stage_event
  for each row execute function app.forbid_mutation();

create trigger lead_stage_event_no_delete before delete on public.lead_stage_event
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Bookings gain their provenance
--
-- `booking` already distinguished ingested from manual, but an ingested row had
-- no provider identifier, so a redelivered AppointmentCreate would have become a
-- second booking, a second commission and a second invoice line.
--
-- customer_email is here for the same reason the reconciler already looks for
-- it: GoHighLevel carries an email far more often than a phone number, and
-- without the column that arm of the match was unreachable.
-- ---------------------------------------------------------------------------

alter table public.booking
  add column customer_email text,
  add column lead_id uuid references public.lead (id) on delete set null,
  -- The appointment id at the provider.
  add column external_ref text,
  add column ingest_event_id uuid references public.ingest_event (id) on delete set null;

create unique index booking_external_ref_idx on public.booking (case_file_id, external_ref)
  where external_ref is not null;

comment on column public.booking.external_ref is
  'Rule 4 at the booking: the provider appointment id, unique per client, so a redelivered appointment cannot become a second commission and a second invoice line.';

create index booking_lead_idx on public.booking (lead_id);

-- ---------------------------------------------------------------------------
-- Access
--
-- Clients read their own leads. Operators read the leads on their placements,
-- because response time is what they are measured on and a number an operator
-- cannot inspect is a number they cannot dispute.
-- ---------------------------------------------------------------------------

alter table public.lead enable row level security;
alter table public.lead_touch enable row level security;
alter table public.lead_stage_event enable row level security;

create policy lead_admin_all on public.lead
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy lead_manager_scope on public.lead
  for all to authenticated
  using (app.is_manager() and app.in_scope_case_file(case_file_id))
  with check (app.is_manager() and app.in_scope_case_file(case_file_id));

create policy lead_client_read on public.lead
  for select to authenticated using (app.client_can_read(case_file_id));

create policy lead_operator_read on public.lead
  for select to authenticated
  using (exists (
    select 1
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    where pl.id = public.lead.placement_id and o.profile_id = auth.uid()
  ));

create policy lead_touch_admin_all on public.lead_touch
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy lead_touch_manager_scope on public.lead_touch
  for all to authenticated
  using (app.is_manager() and app.in_scope_case_file(case_file_id))
  with check (app.is_manager() and app.in_scope_case_file(case_file_id));

create policy lead_touch_operator_read on public.lead_touch
  for select to authenticated
  using (exists (
    select 1
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    where pl.id = public.lead_touch.placement_id and o.profile_id = auth.uid()
  ));

create policy lead_stage_event_admin_all on public.lead_stage_event
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy lead_stage_event_manager_scope on public.lead_stage_event
  for all to authenticated
  using (app.is_manager() and app.in_scope_case_file(case_file_id))
  with check (app.is_manager() and app.in_scope_case_file(case_file_id));

create policy lead_stage_event_client_read on public.lead_stage_event
  for select to authenticated using (app.client_can_read(case_file_id));

revoke all on public.lead from anon;
revoke all on public.lead_touch from anon;
revoke all on public.lead_stage_event from anon;
