-- ---------------------------------------------------------------------------
-- Workspace-owned Client Acquisition leads.
--
-- Admin workspace stores prospect records here. Airtable is a send destination,
-- not the source of truth. Call Intelligence (calls.divineacquisition.io) still
-- reads the DA Pipeline Airtable base on its own path.
-- ---------------------------------------------------------------------------

create table public.da_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null default '' check (length(full_name) <= 200),
  email text not null default '' check (email = '' or (position('@' in email) > 1 and length(email) <= 320)),
  phone text not null default '' check (length(phone) <= 40),
  company_name text not null default '' check (length(company_name) <= 200),
  coaching_niche text not null default '' check (length(coaching_niche) <= 200),
  stage text not null default 'Step 1 Captured' check (length(btrim(stage)) between 1 and 80),
  qualification_result text check (
    qualification_result is null
    or qualification_result in ('Qualified', 'Manual Review', 'Disqualified')
  ),
  readiness_score integer check (
    readiness_score is null or (readiness_score >= 0 and readiness_score <= 100)
  ),
  monthly_ad_spend text not null default '' check (length(monthly_ad_spend) <= 40),
  follow_up_owner text not null default '' check (length(follow_up_owner) <= 80),
  program_price text not null default '' check (length(program_price) <= 40),
  next_action text not null default '' check (length(next_action) <= 500),
  ghl_contact_id text not null default '' check (length(ghl_contact_id) <= 80),
  audit_booked_date text not null default '' check (length(audit_booked_date) <= 40),
  notes text not null default '' check (length(notes) <= 20000),
  meet_url text not null default '' check (meet_url = '' or meet_url ~* '^https?://'),
  calendar_event_id text not null default '' check (length(calendar_event_id) <= 200),
  payload jsonb not null default '{}'::jsonb,
  airtable_record_id text unique
    check (airtable_record_id is null or airtable_record_id ~ '^rec[A-Za-z0-9]{14}$'),
  airtable_synced_at timestamptz,
  airtable_sync_error text check (airtable_sync_error is null or length(airtable_sync_error) <= 2000)
);

comment on table public.da_leads is
  'Client Acquisition prospects owned by the admin workspace. Airtable receives a copy when a destination PAT is set.';

comment on column public.da_leads.airtable_record_id is
  'Destination id on the DA Pipeline Leads table after a successful send. Null until the first send, or when Airtable is not configured.';

comment on column public.da_leads.readiness_score is
  'Computed in-app from ad spend, follow-up owner, and program price. Not read back from Airtable formulas.';

create trigger da_leads_touch_updated_at before update on public.da_leads
  for each row execute function app.touch_updated_at();

create unique index da_leads_email_uidx
  on public.da_leads (lower(email))
  where email <> '';

create index da_leads_created_at_idx on public.da_leads (created_at desc);
create index da_leads_stage_idx on public.da_leads (stage, created_at desc);
create index da_leads_qualification_idx
  on public.da_leads (qualification_result, readiness_score desc)
  where qualification_result is not null;
create index da_leads_ghl_idx
  on public.da_leads (ghl_contact_id)
  where ghl_contact_id <> '';

alter table public.da_leads enable row level security;

create policy da_leads_admin_all on public.da_leads
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.da_leads from anon, authenticated;
grant select, insert, update, delete on public.da_leads to authenticated;

comment on table public.da_prospect_call is
  'Rule: DA Client Acquisition call events land in Supabase first, then a copy is sent to Airtable. Workspace leads live on da_leads; this table is the call ingress log.';

alter table public.da_prospect_call
  add column if not exists lead_id uuid references public.da_leads (id) on delete set null;

comment on column public.da_prospect_call.lead_id is
  'Workspace lead this call belongs to. airtable_lead_id remains the destination rec* after a successful send.';

create index da_prospect_call_workspace_lead_idx
  on public.da_prospect_call (lead_id, occurred_at desc)
  where lead_id is not null;
