-- The remainder of the operator hub, so no surface anywhere runs on fixtures.

create type public.escalation_category as enum ('clinical', 'pricing_exception', 'complaint', 'scheduling_conflict', 'scope', 'other');
create type public.escalation_status as enum ('open', 'answered', 'closed');
create type public.notification_channel as enum ('in_app', 'discord', 'email', 'whatsapp');
create type public.notification_severity as enum ('informational', 'important', 'urgent');
create type public.delivery_status as enum ('delivered', 'failed', 'skipped');

-- One report per operator, per placement, per shift. The core block is locked;
-- the configured block varies per client.
create table public.eod_report (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete cascade,
  shift_date date not null,
  submitted_at timestamptz not null default now(),
  shift_start_actual text not null,
  shift_end_actual text not null,
  conversations_handled integer not null default 0,
  appointments_booked integer not null default 0,
  follow_ups_completed integer not null default 0,
  escalations_raised integer not null default 0,
  blockers text not null default '',
  notes text not null default '',
  configured jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  supersedes_id uuid references public.eod_report (id),
  superseded_by_id uuid references public.eod_report (id),
  correction_reason text,
  created_at timestamptz not null default now()
);

comment on table public.eod_report is 'Immutable once submitted. A correction inserts a new version and both stay visible, which is what makes the case file usable as evidence.';

create index eod_report_placement_idx on public.eod_report (placement_id, shift_date desc);
create index eod_report_current_idx on public.eod_report (placement_id) where superseded_by_id is null;

create table public.eod_comment (
  id uuid primary key default gen_random_uuid(),
  eod_report_id uuid not null references public.eod_report (id) on delete cascade,
  author_profile_id uuid references public.profile (id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.escalation (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  category public.escalation_category not null,
  customer_context text not null,
  needed text not null,
  status public.escalation_status not null default 'open',
  raised_at timestamptz not null default now(),
  response_due_at timestamptz not null,
  answered_at timestamptz,
  answer text,
  answered_by uuid references public.profile (id),
  closed_at timestamptz,
  routed_to text[] not null default '{}'
);

create index escalation_placement_idx on public.escalation (placement_id, raised_at desc);
create index escalation_open_idx on public.escalation (response_due_at) where status = 'open';

create table public.operator_task (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  title text not null,
  detail text not null default '',
  due_on date,
  completed_on date,
  assigned_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

create index operator_task_operator_idx on public.operator_task (operator_id) where completed_on is null;

create table public.operator_notification (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  severity public.notification_severity not null,
  title text not null,
  body text not null,
  sent_by text not null default 'System',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index operator_notification_operator_idx on public.operator_notification (operator_id, created_at desc);

-- Every send attempt with its status. When a placement is going wrong the
-- question is always whether the operator was actually told.
create table public.notification_attempt (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.operator_notification (id) on delete cascade,
  channel public.notification_channel not null,
  status public.delivery_status not null,
  attempted_at timestamptz not null default now(),
  detail text,
  unique (notification_id, channel)
);

-- Response-time samples per placement per day, from the GHL ingestion.
create table public.response_day (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  day date not null,
  conversations integer not null default 0,
  within_standard integer not null default 0,
  unique (placement_id, day)
);

create index response_day_lookup_idx on public.response_day (placement_id, day desc);

create table public.operator_training (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  title text not null,
  detail text not null default '',
  completed_on date,
  created_at timestamptz not null default now()
);

-- Per-placement operating configuration the hub reads.
alter table public.placement
  add column shift_start text not null default '09:00',
  add column shift_end text not null default '18:00',
  add column time_zone text not null default 'America/New_York',
  add column response_standard_minutes integer not null default 5,
  add column escalation_response_hours integer not null default 4,
  add column term_months smallint not null default 3,
  add column renewed_from_id uuid references public.placement (id);

alter table public.operator
  add column handle text,
  add column phone text,
  add column time_zone text not null default 'UTC',
  add column certified_on date,
  add column joined_on date,
  add column preferred_channel public.notification_channel not null default 'in_app';

-- Immutability, matching the rest of the system.
create trigger eod_report_guard_update before update on public.eod_report
  for each row execute function app.guard_versioned_update();

create trigger eod_report_guard_delete before delete on public.eod_report
  for each row execute function app.forbid_mutation();

create trigger eod_comment_immutable before update or delete on public.eod_comment
  for each row execute function app.forbid_mutation();

-- RLS: admin sees everything, an operator sees only their own.
do $$
declare t text;
  tables text[] := array['eod_report', 'eod_comment', 'escalation', 'operator_task',
                         'operator_notification', 'notification_attempt', 'response_day',
                         'operator_training'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (app.is_admin()) with check (app.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

create policy eod_report_operator_own on public.eod_report
  for all to authenticated
  using (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()))
  with check (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()));

create policy eod_comment_operator_read on public.eod_comment
  for select to authenticated
  using (exists (
    select 1 from public.eod_report r join public.operator o on o.id = r.operator_id
    where r.id = eod_report_id and o.profile_id = auth.uid()
  ));

create policy escalation_operator_own on public.escalation
  for all to authenticated
  using (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()))
  with check (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()));

create policy operator_task_own on public.operator_task
  for all to authenticated
  using (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()))
  with check (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()));

create policy operator_notification_own on public.operator_notification
  for all to authenticated
  using (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()))
  with check (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()));

create policy notification_attempt_own on public.notification_attempt
  for select to authenticated
  using (exists (
    select 1 from public.operator_notification n join public.operator o on o.id = n.operator_id
    where n.id = notification_id and o.profile_id = auth.uid()
  ));

create policy response_day_operator_read on public.response_day
  for select to authenticated
  using (exists (
    select 1 from public.placement pl join public.operator o on o.id = pl.operator_id
    where pl.id = placement_id and o.profile_id = auth.uid()
  ));

create policy operator_training_own on public.operator_training
  for select to authenticated
  using (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()));

create policy placement_operator_read on public.placement
  for select to authenticated
  using (exists (select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()));

revoke all on all tables in schema public from anon;
