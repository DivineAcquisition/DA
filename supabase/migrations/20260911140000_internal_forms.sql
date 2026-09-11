-- ---------------------------------------------------------------------------
-- Internal audit / debrief / requirements forms (admin.divineacquisition.io).
-- Four tables. Administrator-only, matching the existing da_* RLS pattern.
-- ---------------------------------------------------------------------------

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  call_id uuid references public.calls (id) on delete set null,
  practice_name text not null check (length(btrim(practice_name)) between 1 and 200),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 200),
  practice_type text not null check (practice_type in ('dental', 'med_spa', 'both')),
  phone text check (phone is null or length(btrim(phone)) between 1 and 40),
  email text check (email is null or (position('@' in email) > 1 and length(email) <= 320)),
  city text check (city is null or length(btrim(city)) between 1 and 120),
  state text check (state is null or length(btrim(state)) between 1 and 80),
  stage text not null default 'audit_scheduled'
    check (stage in ('audit_scheduled', 'audited', 'proposal_sent', 'won', 'lost'))
);

comment on table public.practices is
  'Parent record for the 30-minute audit, post-call debrief, and kickoff requirements.';

create index practices_created_at_idx on public.practices (created_at desc);
create index practices_stage_idx on public.practices (stage, created_at desc);
create index practices_call_id_idx on public.practices (call_id) where call_id is not null;

create trigger practices_touch_updated_at before update on public.practices
  for each row execute function app.touch_updated_at();

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null unique references public.practices (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  pms_in_use text check (pms_in_use is null or length(btrim(pms_in_use)) between 1 and 200),
  front_desk_size text check (front_desk_size is null or front_desk_size in ('one', 'two', 'three_plus')),
  operatories integer check (operatories is null or operatories >= 0),
  current_ad_spend numeric check (current_ad_spend is null or current_ad_spend >= 0),
  current_ad_channels text check (current_ad_channels is null or length(current_ad_channels) <= 2000),
  phone_owner text check (phone_owner is null or length(btrim(phone_owner)) between 1 and 200),
  missed_calls_weekly integer check (missed_calls_weekly is null or missed_calls_weekly >= 0),
  existing_followup text check (existing_followup is null or length(existing_followup) <= 5000),
  pillar_acquisition text check (pillar_acquisition is null or pillar_acquisition in ('red', 'amber', 'green')),
  pillar_acquisition_note text check (pillar_acquisition_note is null or length(pillar_acquisition_note) <= 2000),
  pillar_reactivation text check (pillar_reactivation is null or pillar_reactivation in ('red', 'amber', 'green')),
  pillar_reactivation_note text check (pillar_reactivation_note is null or length(pillar_reactivation_note) <= 2000),
  pillar_showup text check (pillar_showup is null or pillar_showup in ('red', 'amber', 'green')),
  pillar_showup_note text check (pillar_showup_note is null or length(pillar_showup_note) <= 2000),
  recall_list_size integer check (recall_list_size is null or recall_list_size >= 0),
  avg_hygiene_value numeric check (avg_hygiene_value is null or avg_hygiene_value >= 0),
  unscheduled_treatment_value numeric check (unscheduled_treatment_value is null or unscheduled_treatment_value >= 0),
  avg_new_patient_value numeric check (avg_new_patient_value is null or avg_new_patient_value >= 0),
  current_no_show_rate numeric check (current_no_show_rate is null or (current_no_show_rate >= 0 and current_no_show_rate <= 100)),
  monthly_new_patients integer check (monthly_new_patients is null or monthly_new_patients >= 0)
);

comment on table public.audits is
  'One audit per practice. dormant_revenue is computed at read time, not stored.';

create trigger audits_touch_updated_at before update on public.audits
  for each row execute function app.touch_updated_at();

create table public.debriefs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null unique references public.practices (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nullable until the administrator picks one; complete = outcome is set.
  outcome text check (outcome is null or outcome in ('verbal_yes', 'thinking', 'needs_partner', 'not_a_fit', 'no_decision')),
  biggest_leak text check (biggest_leak is null or length(biggest_leak) <= 2000),
  their_words text check (their_words is null or length(their_words) <= 10000),
  objections_raised text[] not null default '{}'::text[],
  objection_notes text check (objection_notes is null or length(objection_notes) <= 10000),
  decision_makers text check (decision_makers is null or length(decision_makers) <= 2000),
  timeline text check (timeline is null or timeline in ('now', 'this_quarter', 'later', 'unknown')),
  proposed_price numeric check (proposed_price is null or proposed_price >= 0),
  next_step text check (next_step is null or length(next_step) <= 2000),
  next_step_due date,
  fit_rating integer check (fit_rating is null or fit_rating between 1 and 5),
  would_i_take_them boolean,
  notes text check (notes is null or length(notes) <= 20000)
);

create trigger debriefs_touch_updated_at before update on public.debriefs
  for each row execute function app.touch_updated_at();

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null unique references public.practices (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  due_at timestamptz,
  items jsonb not null default '[]'::jsonb,
  pms_export_owner_name text check (pms_export_owner_name is null or length(btrim(pms_export_owner_name)) between 1 and 200),
  pms_export_owner_email text check (pms_export_owner_email is null or (position('@' in pms_export_owner_email) > 1 and length(pms_export_owner_email) <= 320)),
  pms_export_owner_phone text check (pms_export_owner_phone is null or length(btrim(pms_export_owner_phone)) between 1 and 40),
  front_desk_owner_name text check (front_desk_owner_name is null or length(btrim(front_desk_owner_name)) between 1 and 200),
  decision_maker_name text check (decision_maker_name is null or length(btrim(decision_maker_name)) between 1 and 200)
);

create trigger requirements_touch_updated_at before update on public.requirements
  for each row execute function app.touch_updated_at();

alter table public.practices enable row level security;
alter table public.audits enable row level security;
alter table public.debriefs enable row level security;
alter table public.requirements enable row level security;

create policy practices_admin_all on public.practices
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy audits_admin_all on public.audits
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy debriefs_admin_all on public.debriefs
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy requirements_admin_all on public.requirements
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

revoke all on public.practices from anon, authenticated;
revoke all on public.audits from anon, authenticated;
revoke all on public.debriefs from anon, authenticated;
revoke all on public.requirements from anon, authenticated;

grant select, insert, update, delete on public.practices to authenticated;
grant select, insert, update, delete on public.audits to authenticated;
grant select, insert, update, delete on public.debriefs to authenticated;
grant select, insert, update, delete on public.requirements to authenticated;
