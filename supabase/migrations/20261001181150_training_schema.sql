-- Prompt 8B: training simulations live in their own schema (Sales Operator
-- Placement Agreement 3.2), apart from every live table. Only
-- public.portal_training_playbook reads it, and only for a VA in training.
create schema if not exists training;
revoke all on schema training from public, anon, authenticated;
create table if not exists training.simulation (
  key text primary key,
  kind text not null check (kind in ('playbook')),
  label text not null default 'Training simulation',
  content jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table training.simulation enable row level security;
revoke all on training.simulation from public, anon, authenticated;
