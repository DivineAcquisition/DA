-- The money-relevant slice of the operator model, moved into Postgres because
-- performance billing and operator payouts both need it to be real: an invoice
-- may only include confirmed bookings, and a payout has to point at a statement.

create type public.operator_status as enum ('applicant', 'in_training', 'certified', 'placed', 'on_bench', 'inactive');
create type public.placement_status as enum ('draft', 'active', 'ended', 'renewed');
create type public.booking_source as enum ('ghl', 'manual');

-- Mirrors the reconciliation states in the operator hub. Only `confirmed` and
-- `system_only` are credited, because they are the two the GoHighLevel
-- ingestion can evidence.
create type public.booking_state as enum ('confirmed', 'pending_review', 'system_only', 'rejected');

create type public.payout_method as enum ('wise', 'payoneer', 'bank_transfer', 'paypal', 'crypto_usdc');
create type public.tax_doc_status as enum ('missing', 'requested', 'on_file', 'expired');

create table public.operator (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profile (id) on delete set null,
  name text not null,
  email text not null unique,
  country text,
  status public.operator_status not null default 'certified',
  tier smallint not null default 1 check (tier between 1 and 3),
  base_monthly numeric(12, 2) not null default 0,
  payout_method public.payout_method,
  -- A reference to the detail held with the transfer provider, never the
  -- account number itself.
  payout_reference text,
  tax_doc_status public.tax_doc_status not null default 'missing',
  tax_doc_reference text,
  tax_doc_reviewed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.operator.payout_reference is 'Identifier at the transfer provider. Vistrial stores no bank or card details.';
comment on column public.operator.tax_doc_reference is 'Where the contractor document lives. The status and the reference, never the contents.';

create trigger operator_touch before update on public.operator
  for each row execute function app.touch_updated_at();

create table public.placement (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status public.placement_status not null default 'active',
  closed_on date,
  monthly_booking_quota integer not null default 0,
  -- What DA pays the operator per booking above quota.
  commission_per_booking numeric(10, 2) not null default 0,
  -- What DA charges the client per confirmed booking, when billing on performance.
  client_rate_per_booking numeric(10, 2),
  created_at timestamptz not null default now()
);

create index placement_case_file_idx on public.placement (case_file_id);
create index placement_operator_idx on public.placement (operator_id);
create index placement_live_idx on public.placement (case_file_id) where status = 'active';

create table public.booking (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete cascade,
  scheduled_for timestamptz not null,
  recorded_at timestamptz not null default now(),
  source public.booking_source not null,
  state public.booking_state not null,
  customer_name text not null,
  customer_phone text,
  -- Set on a manual entry that reconciled against an ingested event, so the
  -- pair is credited once rather than twice.
  matched_booking_id uuid references public.booking (id) on delete set null,
  operator_note text,
  reviewed_by uuid references public.profile (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index booking_case_file_idx on public.booking (case_file_id, scheduled_for desc);
create index booking_placement_idx on public.booking (placement_id);
create index booking_billable_idx on public.booking (case_file_id, scheduled_for)
  where state in ('confirmed', 'system_only');

comment on table public.booking is 'Rule 4: only confirmed and system_only bookings may reach an invoice. A pending claim is one DA cannot evidence, and billing it invites the dispute that ends an engagement.';

-- Rule 4 as a predicate, shared by billing and by commission so the two can
-- never drift apart.
create or replace function public.booking_is_creditable(p_state public.booking_state, p_source public.booking_source, p_matched uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_state = 'system_only'
      or (p_state = 'confirmed' and not (p_source = 'manual' and p_matched is not null));
$$;

comment on function public.booking_is_creditable is 'A reconciled pair exists as two rows; credit sits with the ingested one so an appointment is only ever counted once.';

create table public.pay_period (
  id text primary key,
  start_date date not null,
  end_date date not null,
  closes_month boolean not null default false,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  unique (start_date, end_date)
);

create table public.pay_statement (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  period_id text not null references public.pay_period (id) on delete cascade,
  base_amount numeric(12, 2) not null default 0,
  base_detail text,
  commission_amount numeric(12, 2) not null default 0,
  commission_detail text,
  -- Rule 8: the individual bookings behind the commission, so an operator can
  -- always audit their own pay.
  commission_booking_ids uuid[] not null default '{}',
  speed_bonus_amount numeric(12, 2) not null default 0,
  speed_bonus_detail text,
  adjustment_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  locked boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (placement_id, period_id)
);

create index pay_statement_operator_idx on public.pay_statement (operator_id);
create index pay_statement_period_idx on public.pay_statement (period_id);

create table public.pay_adjustment (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.pay_statement (id) on delete cascade,
  label text not null,
  reason text not null,
  amount numeric(12, 2) not null,
  added_by uuid references public.profile (id),
  added_at timestamptz not null default now()
);

-- A locked statement is a record, not a working document.
create or replace function app.guard_pay_statement_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked then
    raise exception 'pay_statement_locked: statement % locked at %; corrections go on the next open period as an adjustment', old.id, old.locked_at using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pay_statement_guard_update before update on public.pay_statement
  for each row execute function app.guard_pay_statement_update();
