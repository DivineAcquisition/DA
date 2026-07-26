create table public.metric_definition (
  key text primary key,
  label text not null,
  unit text not null,
  direction public.metric_direction not null,
  category text not null,
  sort_order integer not null,
  help text
);

comment on table public.metric_definition is 'The fields captured in the baseline and re-measured in every progress snapshot. direction decides whether a rise is an improvement, which is how the growth report can show what got worse without hand-labelling.';

insert into public.metric_definition (key, label, unit, direction, category, sort_order, help) values
  ('avg_lead_response_minutes', 'Average lead response time', 'minutes', 'down_is_good', 'responsiveness', 10, 'Mean time from lead arriving to first human contact.'),
  ('leads_no_response_count', 'Leads with no response at all', 'leads', 'down_is_good', 'responsiveness', 20, 'Leads that were never contacted. Usually the single most damaging number in the audit.'),
  ('leads_per_month', 'Leads captured per month', 'leads', 'up_is_good', 'volume', 30, null),
  ('booking_rate', 'Booking rate', 'percent', 'up_is_good', 'conversion', 40, 'Share of leads that became a booked appointment.'),
  ('show_rate', 'Show rate', 'percent', 'up_is_good', 'conversion', 50, 'Share of booked appointments that were kept.'),
  ('monthly_revenue', 'Monthly revenue', 'currency', 'up_is_good', 'revenue', 60, null),
  ('revenue_new_customers', 'Revenue from new customers', 'currency', 'up_is_good', 'revenue', 70, null),
  ('revenue_returning_customers', 'Revenue from returning customers', 'currency', 'up_is_good', 'revenue', 80, null),
  ('dormant_lead_count', 'Dormant or unworked leads', 'leads', 'down_is_good', 'database', 90, 'Leads sitting in their system that nobody is working. This is the reactivation opportunity.'),
  ('monthly_ad_spend', 'Monthly ad spend', 'currency', 'down_is_good', 'paid', 100, 'Lower is better only at equal output; read alongside cost per lead and lead volume.'),
  ('cost_per_lead', 'Cost per lead', 'currency', 'down_is_good', 'paid', 110, null);

create table public.client_case_file (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  vertical text,
  contact_name text,
  contact_email text,
  status public.engagement_status not null default 'audit',
  engagement_start date,
  engagement_end date,
  retainer_amount numeric(12, 2),
  revenue_goal_monthly numeric(12, 2),
  install_started_at timestamptz,
  drive_folder_id text,
  drive_folder_url text,
  notes text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_case_file is 'Master record for one engagement. Every other object attaches to this.';
comment on column public.client_case_file.install_started_at is 'Rule 1: once set, the baseline is locked and can never be edited, only annotated.';

create index client_case_file_status_idx on public.client_case_file (status);

create trigger client_case_file_touch
  before update on public.client_case_file
  for each row execute function app.touch_updated_at();

create table public.case_file_drive_folder (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  category public.evidence_category not null,
  folder_id text not null,
  folder_url text,
  created_at timestamptz not null default now(),
  unique (case_file_id, category)
);

create table public.snapshot (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  kind public.snapshot_kind not null,
  taken_at timestamptz not null default now(),
  period_start date,
  period_end date,
  trigger public.snapshot_trigger not null default 'manual',
  locked_at timestamptz,
  tooling text[] not null default '{}',
  notes text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

comment on column public.snapshot.locked_at is 'Rules 1 and 2. Once set, this snapshot and its metrics reject every write.';

create unique index snapshot_one_baseline_per_case_file on public.snapshot (case_file_id) where kind = 'baseline';

create index snapshot_case_file_taken_idx on public.snapshot (case_file_id, taken_at desc);

create table public.snapshot_metric (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.snapshot (id) on delete cascade,
  metric_key text not null references public.metric_definition (key),
  value numeric(14, 2),
  source public.measurement_source not null default 'measured',
  measurement_note text,
  created_at timestamptz not null default now(),
  unique (snapshot_id, metric_key)
);

comment on column public.snapshot_metric.source is 'Whether this figure is defensible or the client estimate.';

create index snapshot_metric_key_idx on public.snapshot_metric (metric_key);

create table public.snapshot_lead_source (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.snapshot (id) on delete cascade,
  source text not null,
  leads_per_month numeric(10, 2),
  unique (snapshot_id, source)
);

create table public.snapshot_annotation (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.snapshot (id) on delete cascade,
  body text not null,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

create index snapshot_annotation_snapshot_idx on public.snapshot_annotation (snapshot_id);

create or replace function app.guard_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked_at is not null then
    raise exception 'snapshot_locked: snapshot % locked at % and can no longer be edited. Annotate it instead.', old.id, old.locked_at using errcode = '23514';
  end if;

  if new.id <> old.id or new.case_file_id <> old.case_file_id or new.kind <> old.kind or new.taken_at <> old.taken_at then
    raise exception 'snapshot_identity_fixed: a snapshot identity, case file, kind and timestamp cannot change' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger snapshot_guard_update
  before update on public.snapshot
  for each row execute function app.guard_snapshot_update();

create or replace function app.guard_snapshot_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked_at is not null then
    raise exception 'snapshot_locked: snapshot % is locked and cannot be deleted', old.id using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger snapshot_guard_delete
  before delete on public.snapshot
  for each row execute function app.guard_snapshot_delete();

create or replace function app.guard_snapshot_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.snapshot_id, old.snapshot_id);
  locked timestamptz;
begin
  select s.locked_at into locked from public.snapshot s where s.id = target;

  if locked is not null then
    raise exception 'snapshot_locked: snapshot % locked at %; its measurements are immutable', target, locked using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger snapshot_metric_guard
  before insert or update or delete on public.snapshot_metric
  for each row execute function app.guard_snapshot_child();

create trigger snapshot_lead_source_guard
  before insert or update or delete on public.snapshot_lead_source
  for each row execute function app.guard_snapshot_child();

create trigger snapshot_annotation_immutable
  before update or delete on public.snapshot_annotation
  for each row execute function app.forbid_mutation();

create table public.tracking_metric_daily (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  day date not null,
  metric_key text not null references public.metric_definition (key),
  value numeric(14, 2) not null,
  ingested_at timestamptz not null default now(),
  unique (case_file_id, day, metric_key)
);

create index tracking_metric_daily_lookup_idx on public.tracking_metric_daily (case_file_id, metric_key, day desc);

comment on table public.tracking_metric_daily is 'Landing zone for the GoHighLevel ingestion. Automatic snapshots aggregate from here.';
