-- ---------------------------------------------------------------------------
-- Home-services internal audit / debrief / requirements forms
-- (admin.divineacquisition.io). Four tables. Administrator-only, matching
-- the existing da_* / hs_calls RLS pattern. Separate from public.practices.
-- ---------------------------------------------------------------------------

create table public.hs_companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  call_id uuid references public.hs_calls (id) on delete set null,
  company_name text not null check (length(btrim(company_name)) between 1 and 200),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 200),
  trade text not null check (trade in (
    'hvac', 'plumbing', 'electrical', 'roofing', 'cleaning',
    'landscaping', 'pest', 'garage_doors', 'multi_trade', 'other'
  )),
  phone text check (phone is null or length(btrim(phone)) between 1 and 40),
  email text check (email is null or (position('@' in email) > 1 and length(email) <= 320)),
  city text check (city is null or length(btrim(city)) between 1 and 120),
  state text check (state is null or length(btrim(state)) between 1 and 80),
  service_radius_miles integer check (service_radius_miles is null or service_radius_miles >= 0),
  stage text not null default 'audit_scheduled'
    check (stage in ('audit_scheduled', 'audited', 'proposal_sent', 'won', 'lost'))
);

comment on table public.hs_companies is
  'Parent record for the home-services 30-minute audit, post-audit debrief, and kickoff requirements.';

comment on column public.hs_companies.service_radius_miles is
  'Stored on the company record. No editor in this brief; left null until a later form asks for it.';

create index hs_companies_created_at_idx on public.hs_companies (created_at desc);
create index hs_companies_stage_idx on public.hs_companies (stage, created_at desc);
create index hs_companies_trade_idx on public.hs_companies (trade, created_at desc);
create index hs_companies_call_id_idx on public.hs_companies (call_id) where call_id is not null;

create trigger hs_companies_touch_updated_at before update on public.hs_companies
  for each row execute function app.touch_updated_at();

create table public.hs_audits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.hs_companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  crm_in_use text check (crm_in_use is null or length(btrim(crm_in_use)) between 1 and 200),
  crew_count text check (crew_count is null or crew_count in ('owner_only', 'two_to_four', 'five_to_ten', 'ten_plus')),
  trucks integer check (trucks is null or trucks >= 0),
  who_answers_phone text check (who_answers_phone is null or who_answers_phone in (
    'owner', 'one_admin', 'two_plus_admin', 'answering_service', 'nobody'
  )),
  after_hours_handling text check (after_hours_handling is null or length(after_hours_handling) <= 2000),
  current_ad_spend numeric check (current_ad_spend is null or current_ad_spend >= 0),
  current_ad_channels text check (current_ad_channels is null or length(current_ad_channels) <= 2000),
  missed_calls_weekly integer check (missed_calls_weekly is null or missed_calls_weekly >= 0),
  avg_response_time text check (avg_response_time is null or length(avg_response_time) <= 2000),
  existing_followup text check (existing_followup is null or length(existing_followup) <= 5000),
  pillar_speed text check (pillar_speed is null or pillar_speed in ('red', 'amber', 'green')),
  pillar_speed_note text check (pillar_speed_note is null or length(pillar_speed_note) <= 2000),
  pillar_estimates text check (pillar_estimates is null or pillar_estimates in ('red', 'amber', 'green')),
  pillar_estimates_note text check (pillar_estimates_note is null or length(pillar_estimates_note) <= 2000),
  pillar_repeat text check (pillar_repeat is null or pillar_repeat in ('red', 'amber', 'green')),
  pillar_repeat_note text check (pillar_repeat_note is null or length(pillar_repeat_note) <= 2000),
  past_customer_count integer check (past_customer_count is null or past_customer_count >= 0),
  avg_job_value numeric check (avg_job_value is null or avg_job_value >= 0),
  unsold_estimates_value numeric check (unsold_estimates_value is null or unsold_estimates_value >= 0),
  monthly_lead_volume integer check (monthly_lead_volume is null or monthly_lead_volume >= 0),
  monthly_jobs_booked integer check (monthly_jobs_booked is null or monthly_jobs_booked >= 0),
  close_rate numeric check (close_rate is null or (close_rate >= 0 and close_rate <= 100))
);

comment on table public.hs_audits is
  'One audit per home-services company. idle_revenue and lead_to_job_gap are computed at read time, not stored.';

create trigger hs_audits_touch_updated_at before update on public.hs_audits
  for each row execute function app.touch_updated_at();

create table public.hs_debriefs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.hs_companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  outcome text check (outcome is null or outcome in (
    'verbal_yes', 'thinking', 'needs_partner', 'not_a_fit', 'no_decision'
  )),
  biggest_leak text check (biggest_leak is null or length(biggest_leak) <= 2000),
  their_words text check (their_words is null or length(their_words) <= 10000),
  objections_raised text[] not null default '{}'::text[],
  objection_notes text check (objection_notes is null or length(objection_notes) <= 10000),
  decision_makers text check (decision_makers is null or length(decision_makers) <= 2000),
  season_timing text check (season_timing is null or season_timing in (
    'in_season', 'shoulder', 'off_season', 'year_round'
  )),
  timeline text check (timeline is null or timeline in ('now', 'this_quarter', 'later', 'unknown')),
  proposed_price numeric check (proposed_price is null or proposed_price >= 0),
  next_step text check (next_step is null or length(next_step) <= 2000),
  next_step_due date,
  fit_rating integer check (fit_rating is null or fit_rating between 1 and 5),
  would_i_take_them boolean,
  notes text check (notes is null or length(notes) <= 20000)
);

create trigger hs_debriefs_touch_updated_at before update on public.hs_debriefs
  for each row execute function app.touch_updated_at();

create table public.hs_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.hs_companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  due_at timestamptz,
  items jsonb not null default '[]'::jsonb,
  crm_export_owner_name text check (crm_export_owner_name is null or length(btrim(crm_export_owner_name)) between 1 and 200),
  crm_export_owner_email text check (crm_export_owner_email is null or (position('@' in crm_export_owner_email) > 1 and length(crm_export_owner_email) <= 320)),
  crm_export_owner_phone text check (crm_export_owner_phone is null or length(btrim(crm_export_owner_phone)) between 1 and 40),
  dispatch_owner_name text check (dispatch_owner_name is null or length(btrim(dispatch_owner_name)) between 1 and 200),
  decision_maker_name text check (decision_maker_name is null or length(btrim(decision_maker_name)) between 1 and 200)
);

create trigger hs_requirements_touch_updated_at before update on public.hs_requirements
  for each row execute function app.touch_updated_at();

alter table public.hs_companies enable row level security;
alter table public.hs_audits enable row level security;
alter table public.hs_debriefs enable row level security;
alter table public.hs_requirements enable row level security;

create policy hs_companies_admin_all on public.hs_companies
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy hs_audits_admin_all on public.hs_audits
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy hs_debriefs_admin_all on public.hs_debriefs
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy hs_requirements_admin_all on public.hs_requirements
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

revoke all on public.hs_companies from anon, authenticated;
revoke all on public.hs_audits from anon, authenticated;
revoke all on public.hs_debriefs from anon, authenticated;
revoke all on public.hs_requirements from anon, authenticated;

grant select, insert, update, delete on public.hs_companies to authenticated;
grant select, insert, update, delete on public.hs_audits to authenticated;
grant select, insert, update, delete on public.hs_debriefs to authenticated;
grant select, insert, update, delete on public.hs_requirements to authenticated;
