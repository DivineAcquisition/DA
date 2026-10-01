-- Prompt 8B: the abandonment liquidated damages amount is a setting, not code.
alter table public.team_setting
  add column if not exists abandonment_ld_amount numeric(10, 2) not null default 250 check (abandonment_ld_amount >= 0);
comment on column public.team_setting.abandonment_ld_amount is
  'The liquidated damages proposed for an abandoned shift (Sales Operator Placement Agreement 6.3). Admin-editable; proposals copy it when created.';
