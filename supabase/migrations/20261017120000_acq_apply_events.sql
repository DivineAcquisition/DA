-- Counts for the coaches application. Service role writes. Test rows stay in the
-- table and are left out of the read the workspace page shows.

create table if not exists public.acq_apply_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null default '',
  ad_name text not null default 'direct',
  event_name text not null,
  screen text,
  question smallint,
  test boolean not null default false
);

create index if not exists acq_apply_events_day_idx
  on public.acq_apply_events (created_at desc);

alter table public.acq_apply_events enable row level security;
