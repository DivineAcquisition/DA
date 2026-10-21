-- One pipeline for every prospect the admin workspace sells to.
--
-- Two offer lines: coaching (acq. applications) and local markets (home
-- services, med spa, dental, and any market added later in the workspace).
-- da_leads already holds coaching applications. This adds a market list, the
-- home-services strategy sessions booked on go.divineacquisition.io, an owner
-- (the setter working the lead), and a timeline of stage changes, owner
-- changes, notes and touches. The timeline is what speed to contact, show
-- rate and close rate are measured from.
--
-- Local leads never get da_leads.scheduled_for. That column drives the
-- coaching audit reminders; a go. session time stays on go_strategy_bookings,
-- which has its own reminder job.

-- Markets ------------------------------------------------------------------

create table if not exists public.da_markets (
  slug text primary key check (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (length(btrim(label)) between 2 and 60),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

comment on table public.da_markets is
  'Local markets the pipeline sells into (home services, med spa, dental, ...). Admins add markets in the workspace.';

insert into public.da_markets (slug, label, sort_order) values
  ('home_services', 'Home services', 10),
  ('med_spa', 'Med spa', 20),
  ('dental', 'Dental', 30)
on conflict (slug) do nothing;

alter table public.da_markets enable row level security;

drop policy if exists da_markets_admin_all on public.da_markets;
create policy da_markets_admin_all on public.da_markets
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.da_markets from anon, authenticated;
grant select, insert, update on public.da_markets to authenticated;

-- Lead columns -------------------------------------------------------------

alter table public.da_leads
  add column if not exists offer_line text not null default 'coaching',
  add column if not exists market text references public.da_markets (slug) on update cascade,
  add column if not exists owner_id uuid references public.profile (id) on delete set null,
  add column if not exists stage_changed_at timestamptz,
  add column if not exists first_touch_at timestamptz;

alter table public.da_leads
  drop constraint if exists da_leads_offer_line_check;

alter table public.da_leads
  add constraint da_leads_offer_line_check check (offer_line in ('coaching', 'local'));

alter table public.da_leads
  drop constraint if exists da_leads_market_line_check;

alter table public.da_leads
  add constraint da_leads_market_line_check check (offer_line = 'local' or market is null);

comment on column public.da_leads.offer_line is
  'Which offer the prospect is buying: coaching (acq. application) or local (a local-market business).';
comment on column public.da_leads.market is
  'For local leads, the market (da_markets.slug). Null for coaching.';
comment on column public.da_leads.owner_id is
  'The setter or manager working this lead.';
comment on column public.da_leads.stage_changed_at is
  'When the stage last changed. Set by trigger.';
comment on column public.da_leads.first_touch_at is
  'First logged touch (call, text, email, DM). Speed to contact is first_touch_at - created_at.';

update public.da_leads set stage_changed_at = coalesce(stage_changed_at, updated_at, created_at);

create index if not exists da_leads_offer_stage_idx on public.da_leads (offer_line, market, stage, created_at desc);
create index if not exists da_leads_owner_idx on public.da_leads (owner_id) where owner_id is not null;

-- Timeline -----------------------------------------------------------------

create table if not exists public.da_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.da_leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_id uuid references public.profile (id) on delete set null,
  kind text not null check (kind in ('created', 'stage', 'owner', 'note', 'touch', 'booking')),
  from_stage text check (from_stage is null or length(from_stage) <= 80),
  to_stage text check (to_stage is null or length(to_stage) <= 80),
  channel text check (channel is null or channel in ('call', 'sms', 'email', 'dm', 'meeting', 'other')),
  body text not null default '' check (length(body) <= 4000),
  meta jsonb not null default '{}'::jsonb
);

comment on table public.da_lead_events is
  'Timeline for a pipeline lead: created, stage and owner changes (by trigger), notes and touches (by staff), and bookings.';

create index if not exists da_lead_events_lead_idx on public.da_lead_events (lead_id, created_at desc);
create index if not exists da_lead_events_kind_idx on public.da_lead_events (kind, created_at desc);

alter table public.da_lead_events enable row level security;

drop policy if exists da_lead_events_admin_all on public.da_lead_events;
create policy da_lead_events_admin_all on public.da_lead_events
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.da_lead_events from anon, authenticated;
grant select, insert, update, delete on public.da_lead_events to authenticated;

-- Stage and owner changes write themselves to the timeline, whichever path
-- made them (the workspace, the application flow, booking messages, a cron).

create or replace function app.da_leads_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.stage_changed_at := coalesce(new.stage_changed_at, now());
    return new;
  end if;

  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;

create or replace function app.da_leads_timeline_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is not null and not exists (select 1 from public.profile where id = v_actor) then
    v_actor := null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.da_lead_events (lead_id, created_at, actor_id, kind, to_stage, meta)
    values (
      new.id, new.created_at, v_actor, 'created', new.stage,
      jsonb_strip_nulls(jsonb_build_object('offer_line', new.offer_line, 'market', new.market))
    );
    return null;
  end if;

  if new.stage is distinct from old.stage then
    insert into public.da_lead_events (lead_id, actor_id, kind, from_stage, to_stage)
    values (new.id, v_actor, 'stage', old.stage, new.stage);
  end if;

  if new.owner_id is distinct from old.owner_id then
    insert into public.da_lead_events (lead_id, actor_id, kind, meta)
    values (
      new.id,
      v_actor,
      'owner',
      jsonb_build_object('from', old.owner_id, 'to', new.owner_id)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists da_leads_timeline_before on public.da_leads;
create trigger da_leads_timeline_before
  before insert or update of stage on public.da_leads
  for each row execute function app.da_leads_timeline();

drop trigger if exists da_leads_timeline_after on public.da_leads;
create trigger da_leads_timeline_after
  after insert or update of stage, owner_id on public.da_leads
  for each row execute function app.da_leads_timeline_log();

-- The first touch stamps the lead so speed to contact is a column read.

create or replace function app.da_lead_events_first_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'touch' then
    update public.da_leads
       set first_touch_at = new.created_at
     where id = new.lead_id
       and (first_touch_at is null or first_touch_at > new.created_at);
  end if;
  return null;
end;
$$;

drop trigger if exists da_lead_events_first_touch on public.da_lead_events;
create trigger da_lead_events_first_touch
  after insert on public.da_lead_events
  for each row execute function app.da_lead_events_first_touch();

-- go. strategy sessions join the pipeline as local / home services ------------

alter table public.go_strategy_bookings
  add column if not exists lead_id uuid references public.da_leads (id) on delete set null;

create index if not exists go_strategy_bookings_lead_idx
  on public.go_strategy_bookings (lead_id) where lead_id is not null;

comment on column public.go_strategy_bookings.lead_id is
  'The pipeline lead for this session. Set by trigger when the session is booked.';

-- Booking still goes through the security definer functions. Admins can read
-- sessions so the pipeline can show them.
drop policy if exists go_strategy_bookings_admin_read on public.go_strategy_bookings;
create policy go_strategy_bookings_admin_read on public.go_strategy_bookings
  for select to authenticated
  using (app.is_admin());

grant select on public.go_strategy_bookings to authenticated;

create or replace function app.go_booking_to_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.da_leads%rowtype;
begin
  select * into v_lead
  from public.da_leads
  where email <> '' and lower(email) = lower(new.email)
  limit 1;

  if v_lead.id is null then
    insert into public.da_leads (
      full_name, email, phone, stage, offer_line, market, ghl_contact_id, payload
    ) values (
      left(new.full_name, 200),
      lower(new.email),
      left(new.phone, 40),
      'Audit Booked',
      'local',
      'home_services',
      coalesce(new.ghl_contact_id, ''),
      jsonb_build_object('origin', 'go_strategy_booking', 'goBookingId', new.id, 'trade', 'cleaning')
    )
    returning * into v_lead;
  else
    update public.da_leads
       set phone = case when phone = '' then left(new.phone, 40) else phone end,
           stage = case
             when offer_line = 'local' and stage in ('Step 1 Captured', 'Application Abandoned', 'Qualified - Not Booked', 'No Show', 'Recycled')
               then 'Audit Booked'
             else stage
           end
     where id = v_lead.id;
  end if;

  update public.go_strategy_bookings set lead_id = v_lead.id where id = new.id;

  insert into public.da_lead_events (lead_id, kind, body, meta)
  values (
    v_lead.id,
    'booking',
    'Strategy session booked',
    jsonb_build_object('go_booking_id', new.id, 'scheduled_for', new.scheduled_for, 'time_zone', new.time_zone)
  );
  return null;
end;
$$;

drop trigger if exists go_strategy_bookings_to_lead on public.go_strategy_bookings;
create trigger go_strategy_bookings_to_lead
  after insert on public.go_strategy_bookings
  for each row execute function app.go_booking_to_lead();

-- The GHL contact arrives after the booking row. Copy it to the lead.
create or replace function app.go_booking_sync_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null and coalesce(new.ghl_contact_id, '') <> '' then
    update public.da_leads
       set ghl_contact_id = new.ghl_contact_id
     where id = new.lead_id
       and ghl_contact_id = '';
  end if;
  return null;
end;
$$;

drop trigger if exists go_strategy_bookings_sync_lead on public.go_strategy_bookings;
create trigger go_strategy_bookings_sync_lead
  after update of ghl_contact_id on public.go_strategy_bookings
  for each row execute function app.go_booking_sync_lead();

-- A booking released because the meeting could not be created never happened.
-- Drop the lead it created, unless someone has worked it since.
create or replace function app.go_booking_released()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.lead_id is null then
    return null;
  end if;

  delete from public.da_leads l
   where l.id = old.lead_id
     and l.payload->>'goBookingId' = old.id::text
     and l.owner_id is null
     and not exists (select 1 from public.go_strategy_bookings b where b.lead_id = l.id)
     and not exists (
       select 1 from public.da_lead_events e
        where e.lead_id = l.id and e.kind in ('note', 'touch', 'owner')
     );
  return null;
end;
$$;

drop trigger if exists go_strategy_bookings_released on public.go_strategy_bookings;
create trigger go_strategy_bookings_released
  after delete on public.go_strategy_bookings
  for each row execute function app.go_booking_released();

-- Backfill: sessions already booked become leads.
do $$
declare
  r record;
  v_lead uuid;
begin
  for r in
    select * from public.go_strategy_bookings where lead_id is null order by created_at
  loop
    select id into v_lead from public.da_leads
     where email <> '' and lower(email) = lower(r.email)
     limit 1;

    if v_lead is null then
      insert into public.da_leads (
        created_at, full_name, email, phone, stage, offer_line, market, ghl_contact_id, payload, stage_changed_at
      ) values (
        r.created_at,
        left(r.full_name, 200),
        lower(r.email),
        left(r.phone, 40),
        -- Whether a past session was held is not recorded. The pipeline flags
        -- booked sessions in the past as needing an outcome.
        'Audit Booked',
        'local',
        'home_services',
        coalesce(r.ghl_contact_id, ''),
        jsonb_build_object('origin', 'go_strategy_booking', 'goBookingId', r.id, 'trade', 'cleaning', 'backfilled', true),
        r.created_at
      )
      returning id into v_lead;
    end if;

    update public.go_strategy_bookings set lead_id = v_lead where id = r.id;

    insert into public.da_lead_events (lead_id, created_at, kind, body, meta)
    values (
      v_lead,
      r.created_at,
      'booking',
      'Strategy session booked',
      jsonb_build_object('go_booking_id', r.id, 'scheduled_for', r.scheduled_for, 'time_zone', r.time_zone)
    );
  end loop;
end;
$$;

-- Staff who can be assigned a lead. Admin only for now.
create or replace function public.pipeline_assignees()
returns table (id uuid, full_name text, email text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email, p.role::text
    from public.profile p
   where app.is_admin()
     and p.role::text in ('owner', 'admin', 'manager', 'operator')
     and p.state::text = 'active'
   order by case p.role::text when 'operator' then 1 when 'manager' then 2 else 3 end, p.full_name nulls last;
$$;

revoke all on function public.pipeline_assignees() from public, anon;
grant execute on function public.pipeline_assignees() to authenticated;
